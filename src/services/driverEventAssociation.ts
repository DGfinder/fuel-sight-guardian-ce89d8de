import { supabase } from '@/lib/supabase';
import { DriverNameMatcher, DriverNameRecord, NameMatchResult } from './driverNameMatcher';
import { findDriverByName, createDriverIncident, getDriverNameMappings } from '@/api/drivers';
import type { 
  VehicleEvent, 
  DriverIncident, 
  SystemName,
  IncidentType,
  IncidentSourceSystem,
  Severity 
} from '@/types/fleet';

export interface EventAssociationResult {
  eventId: string;
  driverId?: string;
  confidence: number;
  matchedName?: string;
  matchedSystem?: SystemName;
  associationMethod: 'exact_match' | 'fuzzy_match' | 'manual_override' | 'unmatched';
  alternativeMatches?: Array<{
    driverId: string;
    confidence: number;
    matchedName: string;
  }>;
  error?: string;
}

export interface BatchAssociationResult {
  totalEvents: number;
  successful: number;
  failed: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  unmatched: number;
  results: EventAssociationResult[];
  errors: Array<{ eventId: string; error: string }>;
}

export interface AssociationOptions {
  minimumConfidence?: number;
  requireExactMatch?: boolean;
  createIncidents?: boolean;
  updateExistingAssociations?: boolean;
  batchSize?: number;
}

export class DriverEventAssociation {
  private static driverNameCache: Map<string, DriverNameRecord[]> = new Map();
  private static cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private static lastCacheUpdate: number = 0;

  /**
   * Load and cache all driver name mappings for faster lookups
   */
  private static async loadDriverNameCache(): Promise<DriverNameRecord[]> {
    const now = Date.now();
    const cacheKey = 'all_drivers';
    
    // Check if cache is still valid
    if (
      this.driverNameCache.has(cacheKey) && 
      (now - this.lastCacheUpdate) < this.cacheExpiry
    ) {
      return this.driverNameCache.get(cacheKey)!;
    }

    try {
      // Load all driver name mappings with driver status
      const { data, error } = await supabase
        .from('driver_name_mappings')
        .select(`
          *,
          driver:drivers!inner(
            id,
            first_name,
            last_name,
            status
          )
        `)
        .eq('driver.status', 'Active');

      if (error) throw error;

      const driverRecords: DriverNameRecord[] = data.map(mapping => ({
        driverId: mapping.driver_id,
        systemName: mapping.system_name as SystemName,
        mappedName: mapping.mapped_name,
        firstName: mapping.driver.first_name,
        lastName: mapping.driver.last_name,
        isActive: mapping.driver.status === 'Active'
      }));

      this.driverNameCache.set(cacheKey, driverRecords);
      this.lastCacheUpdate = now;
      
      return driverRecords;
    } catch (error) {
      console.error('Failed to load driver name cache:', error);
      return [];
    }
  }

  /**
   * Associate a single event with a driver
   */
  static async associateEventWithDriver(
    event: VehicleEvent,
    options: AssociationOptions = {}
  ): Promise<EventAssociationResult> {
    const {
      minimumConfidence = 0.7,
      requireExactMatch = false,
      createIncidents = true,
      updateExistingAssociations = false
    } = options;

    const result: EventAssociationResult = {
      eventId: event.id,
      confidence: 0,
      associationMethod: 'unmatched'
    };

    try {
      // Check if driver name is provided in the event
      if (!event.driver_name || event.driver_name.trim() === '') {
        result.error = 'No driver name provided in event';
        return result;
      }

      // Load driver name mappings
      const driverRecords = await this.loadDriverNameCache();
      
      if (driverRecords.length === 0) {
        result.error = 'No driver records available for matching';
        return result;
      }

      // Determine source system
      const sourceSystem = this.mapEventSourceToSystem(event.source);
      
      // Try exact match first if required
      if (requireExactMatch) {
        const exactMatch = driverRecords.find(record => 
          record.systemName === sourceSystem &&
          record.mappedName.toLowerCase() === event.driver_name.toLowerCase()
        );

        if (exactMatch) {
          result.driverId = exactMatch.driverId;
          result.confidence = 1.0;
          result.matchedName = exactMatch.mappedName;
          result.matchedSystem = exactMatch.systemName;
          result.associationMethod = 'exact_match';
        }
      } else {
        // Use fuzzy matching
        const matchResult = DriverNameMatcher.findBestMatch(
          event.driver_name,
          driverRecords,
          minimumConfidence
        );

        if (matchResult) {
          result.driverId = matchResult.driverId;
          result.confidence = matchResult.confidence;
          result.matchedName = matchResult.matchedName;
          result.matchedSystem = matchResult.matchedSystem;
          result.associationMethod = matchResult.confidence >= 0.9 ? 'exact_match' : 'fuzzy_match';
          
          if (matchResult.alternativeMatches) {
            result.alternativeMatches = matchResult.alternativeMatches.map(alt => ({
              driverId: alt.driverId,
              confidence: alt.confidence,
              matchedName: alt.matchedName
            }));
          }
        }
      }

      // Update the vehicle event with driver association
      if (result.driverId && (updateExistingAssociations || !event.driver_name)) {
        await this.updateEventDriverAssociation(event.id, result.driverId);
      }

      // Create incident record if configured and driver is matched
      if (createIncidents && result.driverId && this.shouldCreateIncident(event)) {
        await this.createIncidentFromEvent(event, result.driverId);
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error during association';
    }

    return result;
  }

  /**
   * Associate multiple events with drivers in batch
   */
  static async batchAssociateEvents(
    events: VehicleEvent[],
    options: AssociationOptions = {}
  ): Promise<BatchAssociationResult> {
    const { batchSize = 100 } = options;
    
    const batchResult: BatchAssociationResult = {
      totalEvents: events.length,
      successful: 0,
      failed: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      unmatched: 0,
      results: [],
      errors: []
    };

    // Process events in batches to avoid overwhelming the database
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      const batchPromises = batch.map(event => 
        this.associateEventWithDriver(event, options)
          .catch(error => ({
            eventId: event.id,
            confidence: 0,
            associationMethod: 'unmatched' as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          }))
      );

      const batchResults = await Promise.all(batchPromises);
      batchResult.results.push(...batchResults);

      // Update statistics
      batchResults.forEach(result => {
        if (result.error) {
          batchResult.failed++;
          batchResult.errors.push({ eventId: result.eventId, error: result.error });
        } else if (result.driverId) {
          batchResult.successful++;
          if (result.confidence >= 0.9) {
            batchResult.highConfidence++;
          } else if (result.confidence >= 0.7) {
            batchResult.mediumConfidence++;
          } else {
            batchResult.lowConfidence++;
          }
        } else {
          batchResult.unmatched++;
        }
      });
    }

    return batchResult;
  }

  /**
   * Process all unassociated events from Guardian and LYTX
   */
  static async processUnassociatedEvents(options: AssociationOptions = {}): Promise<BatchAssociationResult> {
    try {
      // Get all vehicle events without driver associations
      const { data: events, error } = await supabase
        .from('vehicle_events')
        .select('*')
        .not('driver_name', 'is', null)
        .is('driver_id', null) // Assuming we add driver_id column to vehicle_events
        .in('source', ['Guardian', 'Lytx'])
        .order('occurred_at', { ascending: false })
        .limit(1000); // Limit to prevent overwhelming

      if (error) throw error;

      return await this.batchAssociateEvents(events || [], options);
    } catch (error) {
      return {
        totalEvents: 0,
        successful: 0,
        failed: 1,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        unmatched: 0,
        results: [],
        errors: [{ eventId: 'batch', error: error instanceof Error ? error.message : 'Unknown error' }]
      };
    }
  }

  /**
   * Map event source to system name for driver matching
   */
  private static mapEventSourceToSystem(source: string): SystemName {
    switch (source.toLowerCase()) {
      case 'lytx':
        return 'LYTX';
      case 'guardian':
        return 'Guardian';
      default:
        return 'Standard';
    }
  }

  /**
   * Determine if an event should create an incident record
   */
  private static shouldCreateIncident(event: VehicleEvent): boolean {
    // Create incidents for safety-related events
    const safetyEventTypes = [
      'harsh_acceleration',
      'harsh_braking', 
      'harsh_cornering',
      'speeding',
      'following_too_close',
      'safety_violation',
      'fuel_theft',
      'unauthorized_access'
    ];

    return safetyEventTypes.some(type => 
      event.event_type.toLowerCase().includes(type.toLowerCase())
    );
  }

  /**
   * Create an incident record from a vehicle event
   */
  private static async createIncidentFromEvent(event: VehicleEvent, driverId: string): Promise<DriverIncident | null> {
    try {
      const incident: Omit<DriverIncident, 'id' | 'created_at' | 'updated_at'> = {
        driver_id: driverId,
        vehicle_id: event.vehicle_id,
        incident_type: this.mapEventTypeToIncidentType(event.event_type),
        source_system: this.mapEventSourceToIncidentSource(event.source),
        external_incident_id: event.event_id,
        incident_date: event.occurred_at,
        location: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
        description: `${event.event_type} event detected by ${event.source}`,
        severity: this.mapEventSeverityToIncidentSeverity(event.severity),
        status: 'Open',
        training_required: false,
        created_by: undefined
      };

      return await createDriverIncident(incident);
    } catch (error) {
      console.error('Failed to create incident from event:', error);
      return null;
    }
  }

  /**
   * Map event type to incident type
   */
  private static mapEventTypeToIncidentType(eventType: string): IncidentType {
    const lowerType = eventType.toLowerCase();
    
    if (lowerType.includes('safety') || lowerType.includes('violation')) {
      return 'Safety Event';
    }
    if (lowerType.includes('speeding') || lowerType.includes('traffic')) {
      return 'Traffic Violation';
    }
    if (lowerType.includes('damage') || lowerType.includes('collision')) {
      return 'Equipment Damage';
    }
    if (lowerType.includes('policy')) {
      return 'Policy Violation';
    }
    
    return 'Safety Event'; // Default
  }

  /**
   * Map event source to incident source system
   */
  private static mapEventSourceToIncidentSource(source: string): IncidentSourceSystem {
    switch (source.toLowerCase()) {
      case 'lytx':
        return 'LYTX';
      case 'guardian':
        return 'Guardian';
      default:
        return 'Manual';
    }
  }

  /**
   * Map event severity to incident severity
   */
  private static mapEventSeverityToIncidentSeverity(severity?: string): Severity {
    if (!severity) return 'Medium';
    
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Medium';
    }
  }

  /**
   * Update vehicle event with driver association
   */
  private static async updateEventDriverAssociation(eventId: string, driverId: string): Promise<void> {
    // Note: This assumes we add a driver_id column to vehicle_events table
    const { error } = await supabase
      .from('vehicle_events')
      .update({ 
        driver_id: driverId,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (error) {
      console.error('Failed to update event driver association:', error);
    }
  }

  /**
   * Get association statistics
   */
  static async getAssociationStats(): Promise<{
    totalEvents: number;
    associatedEvents: number;
    unassociatedEvents: number;
    associationRate: number;
    recentAssociations: number;
  }> {
    try {
      const [totalResult, associatedResult, recentResult] = await Promise.all([
        supabase.from('vehicle_events').select('id', { count: 'exact' }),
        supabase.from('vehicle_events').select('id', { count: 'exact' }).not('driver_id', 'is', null),
        supabase
          .from('vehicle_events')
          .select('id', { count: 'exact' })
          .not('driver_id', 'is', null)
          .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      const totalEvents = totalResult.count || 0;
      const associatedEvents = associatedResult.count || 0;
      const unassociatedEvents = totalEvents - associatedEvents;
      const associationRate = totalEvents > 0 ? (associatedEvents / totalEvents) * 100 : 0;
      const recentAssociations = recentResult.count || 0;

      return {
        totalEvents,
        associatedEvents,
        unassociatedEvents,
        associationRate,
        recentAssociations
      };
    } catch (error) {
      console.error('Failed to get association stats:', error);
      return {
        totalEvents: 0,
        associatedEvents: 0,
        unassociatedEvents: 0,
        associationRate: 0,
        recentAssociations: 0
      };
    }
  }

  /**
   * Clear the driver name cache (useful for testing or after bulk updates)
   */
  static clearCache(): void {
    this.driverNameCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Manually override an event-driver association
   */
  static async manualAssociation(eventId: string, driverId: string): Promise<EventAssociationResult> {
    try {
      await this.updateEventDriverAssociation(eventId, driverId);
      
      return {
        eventId,
        driverId,
        confidence: 1.0,
        associationMethod: 'manual_override'
      };
    } catch (error) {
      return {
        eventId,
        confidence: 0,
        associationMethod: 'unmatched',
        error: error instanceof Error ? error.message : 'Failed to create manual association'
      };
    }
  }
}