import { LytxSafetyEvent, LytxVehicle, LytxEventStatus, LytxEventTrigger, LytxEventBehavior } from './lytxApi';

// Existing component interfaces (from LYTXEventTable.tsx)
export interface LYTXEvent {
  eventId: string;
  driver: string;
  employeeId: string;
  group: string;
  vehicle: string;
  device: string;
  date: string;
  time: string;
  timezone: string;
  score: number;
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  trigger: string;
  behaviors: string;
  eventType: 'Coachable' | 'Driver Tagged';
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  excluded?: boolean;
  assignedDate?: string;
  notes?: string;
  reviewedBy?: string;
}

// Reference data maps for transformation
export class LytxDataTransformer {
  private statusMap: Map<number, string> = new Map();
  private triggerMap: Map<number, string> = new Map();
  private behaviorMap: Map<number, string> = new Map();
  private vehicleMap: Map<string, LytxVehicle> = new Map();

  // Initialize reference data
  async initializeReferenceMaps(
    statuses: LytxEventStatus[],
    triggers: LytxEventTrigger[],
    behaviors: LytxEventBehavior[],
    vehicles: LytxVehicle[]
  ) {
    // Build status map
    statuses.forEach(status => {
      this.statusMap.set(status.id, status.name);
    });

    // Build trigger map
    triggers.forEach(trigger => {
      this.triggerMap.set(trigger.id, trigger.name);
    });

    // Build behavior map
    behaviors.forEach(behavior => {
      this.behaviorMap.set(behavior.id, behavior.name);
    });

    // Build vehicle map
    vehicles.forEach(vehicle => {
      this.vehicleMap.set(vehicle.id, vehicle);
      if (vehicle.serialNumber) {
        this.vehicleMap.set(vehicle.serialNumber, vehicle);
      }
    });
  }

  // Transform Lytx Safety Event to LYTXEvent
  transformSafetyEvent(lytxEvent: LytxSafetyEvent): LYTXEvent {
    const vehicle = this.vehicleMap.get(lytxEvent.vehicleId);
    
    return {
      eventId: lytxEvent.eventId || lytxEvent.id,
      driver: lytxEvent.driverName || 'Driver Unassigned',
      employeeId: lytxEvent.employeeId || '',
      group: this.mapGroupToDepot(lytxEvent.groupName),
      vehicle: this.extractVehicleRegistration(vehicle?.name || lytxEvent.vehicleId),
      device: lytxEvent.deviceSerialNumber,
      date: this.formatEventDate(lytxEvent.eventDateTime),
      time: this.formatEventTime(lytxEvent.eventDateTime),
      timezone: this.mapTimezone(lytxEvent.timezone),
      score: lytxEvent.score || 0,
      status: this.mapEventStatus(lytxEvent.status),
      trigger: this.triggerMap.get(lytxEvent.triggerId) || lytxEvent.trigger || 'Unknown',
      behaviors: this.formatBehaviors(lytxEvent.behaviors),
      eventType: this.determineEventType(lytxEvent),
      carrier: this.determineCarrier(lytxEvent.groupName),
      excluded: lytxEvent.excluded || false,
      assignedDate: lytxEvent.reviewedDate ? this.formatEventDate(lytxEvent.reviewedDate) : undefined,
      notes: this.formatNotes(lytxEvent.notes),
      reviewedBy: lytxEvent.reviewedBy
    };
  }

  // Map Lytx status to our component status
  private mapEventStatus(lytxStatus: string): 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved' {
    const statusLower = lytxStatus.toLowerCase();
    
    if (statusLower.includes('new') || statusLower.includes('open')) {
      return 'New';
    } else if (statusLower.includes('face') || statusLower.includes('coaching')) {
      return 'Face-To-Face';
    } else if (statusLower.includes('fyi') || statusLower.includes('notify')) {
      return 'FYI Notify';
    } else if (statusLower.includes('resolved') || statusLower.includes('closed')) {
      return 'Resolved';
    }
    
    return 'New'; // Default fallback
  }

  // Determine carrier from group name
  private determineCarrier(groupName: string): 'Stevemacs' | 'Great Southern Fuels' {
    const groupLower = groupName.toLowerCase();
    
    console.log('determineCarrier - analyzing group:', groupName, 'lowercased:', groupLower);
    
    // Check for Stevemacs indicators
    if (groupLower.includes('stevemacs') || groupLower.includes('smb') || groupLower.includes('kewdale')) {
      console.log('determineCarrier - matched Stevemacs for:', groupName);
      return 'Stevemacs';
    }
    
    // Check for GSF indicators - be more specific
    if (groupLower.includes('gsf') || 
        groupLower.includes('great southern') || 
        groupLower.includes('southern fuels') ||
        groupLower.includes('geraldton') ||
        groupLower.includes('kalgoorlie') ||
        groupLower.includes('narrogin') ||
        groupLower.includes('albany') ||
        groupLower.includes('bunbury') ||
        groupLower.includes('fremantle')) {
      console.log('determineCarrier - matched GSF for:', groupName);
      return 'Great Southern Fuels';
    }
    
    // If no specific match, default to GSF since we're using GSF's API key
    console.log('determineCarrier - defaulting to GSF for:', groupName);
    return 'Great Southern Fuels';
  }

  // Map group name to depot
  private mapGroupToDepot(groupName: string): string {
    const groupLower = groupName.toLowerCase();
    
    if (groupLower.includes('kewdale')) return 'Kewdale';
    if (groupLower.includes('geraldton')) return 'Geraldton';
    if (groupLower.includes('kalgoorlie')) return 'Kalgoorlie';
    if (groupLower.includes('narrogin')) return 'Narrogin';
    if (groupLower.includes('albany')) return 'Albany';
    if (groupLower.includes('bunbury')) return 'Bunbury';
    if (groupLower.includes('fremantle')) return 'Fremantle';
    
    return groupName; // Return original if no match
  }

  // Extract vehicle registration from vehicle name
  private extractVehicleRegistration(vehicleName: string): string {
    // Try to extract registration number patterns
    const regPatterns = [
      /\b([0-9][A-Z]{2,3}[0-9]{3})\b/,  // e.g., 1GLD510
      /\b([A-Z]{1,4}[0-9]{2,4})\b/,      // e.g., ABC123
      /\b([0-9]{1,4}[A-Z]{2,4})\b/       // e.g., 123ABC
    ];

    for (const pattern of regPatterns) {
      const match = vehicleName.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If no pattern match, return the original name
    return vehicleName;
  }

  // Format event date
  private formatEventDate(dateTimeString: string): string {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleDateString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: '2-digit' 
      });
    } catch {
      return dateTimeString;
    }
  }

  // Format event time
  private formatEventTime(dateTimeString: string): string {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return dateTimeString;
    }
  }

  // Map timezone
  private mapTimezone(timezone: string): string {
    if (timezone.includes('Australia') || timezone.includes('Perth')) {
      return 'AUW';
    }
    return timezone;
  }

  // Format behaviors array into string
  private formatBehaviors(behaviors: LytxEventBehavior[]): string {
    if (!behaviors || behaviors.length === 0) {
      return '';
    }
    
    return behaviors.map(b => b.name).join(', ');
  }

  // Format notes array into string
  private formatNotes(notes?: any[]): string | undefined {
    if (!notes || notes.length === 0) {
      return undefined;
    }
    
    return notes.map(note => note.content || note.text || note.note).join('; ');
  }

  // Determine event type
  private determineEventType(lytxEvent: LytxSafetyEvent): 'Coachable' | 'Driver Tagged' {
    const trigger = this.triggerMap.get(lytxEvent.triggerId) || lytxEvent.trigger || '';
    
    if (trigger.toLowerCase().includes('driver tagged') || trigger.toLowerCase().includes('tagged')) {
      return 'Driver Tagged';
    }
    
    return 'Coachable'; // Default to coachable
  }

  // Transform multiple events
  transformSafetyEvents(lytxEvents: LytxSafetyEvent[]): LYTXEvent[] {
    console.log('transformSafetyEvents - Processing', lytxEvents.length, 'events');
    
    const transformed = lytxEvents.map(event => this.transformSafetyEvent(event));
    
    // Log carrier breakdown after transformation
    const carrierBreakdown = transformed.reduce((acc, event) => {
      acc[event.carrier] = (acc[event.carrier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('transformSafetyEvents - Carrier breakdown:', carrierBreakdown);
    
    return transformed;
  }

  // Filter events by date range
  filterEventsByDateRange(events: LYTXEvent[], startDate?: Date, endDate?: Date): LYTXEvent[] {
    if (!startDate && !endDate) {
      return events;
    }

    return events.filter(event => {
      try {
        const eventDate = new Date(`${event.date} ${event.time}`);
        
        if (startDate && eventDate < startDate) {
          return false;
        }
        
        if (endDate && eventDate > endDate) {
          return false;
        }
        
        return true;
      } catch {
        return true; // Include events with invalid dates
      }
    });
  }

  // Get summary statistics with enhanced metrics
  getEventSummary(events: LYTXEvent[]) {
    const summary = {
      total: events.length,
      byStatus: {} as Record<string, number>,
      byEventType: {} as Record<string, number>,
      byCarrier: {} as Record<string, number>,
      byDepot: {} as Record<string, number>,
      byTrigger: {} as Record<string, number>,
      averageScore: 0,
      excluded: 0,
      unassigned: 0,
      highRiskEvents: 0,
      recentEvents: 0,
      resolutionRate: 0
    };

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    events.forEach(event => {
      // Count by status
      summary.byStatus[event.status] = (summary.byStatus[event.status] || 0) + 1;
      
      // Count by event type
      summary.byEventType[event.eventType] = (summary.byEventType[event.eventType] || 0) + 1;
      
      // Count by carrier
      summary.byCarrier[event.carrier] = (summary.byCarrier[event.carrier] || 0) + 1;
      
      // Count by depot
      summary.byDepot[event.group] = (summary.byDepot[event.group] || 0) + 1;
      
      // Count by trigger
      summary.byTrigger[event.trigger] = (summary.byTrigger[event.trigger] || 0) + 1;
      
      // Count excluded
      if (event.excluded) {
        summary.excluded++;
      }
      
      // Count unassigned drivers
      if (event.driver === 'Driver Unassigned') {
        summary.unassigned++;
      }
      
      // Count high risk events (score >= 5)
      if (event.score >= 5) {
        summary.highRiskEvents++;
      }
      
      // Count recent events (last 7 days)
      try {
        if (new Date(event.date) >= sevenDaysAgo) {
          summary.recentEvents++;
        }
      } catch {
        // Ignore date parsing errors
      }
    });

    // Calculate average score
    const totalScore = events.reduce((sum, event) => sum + event.score, 0);
    summary.averageScore = events.length > 0 ? totalScore / events.length : 0;
    
    // Calculate resolution rate
    const resolvedEvents = summary.byStatus['Resolved'] || 0;
    summary.resolutionRate = events.length > 0 ? (resolvedEvents / events.length) * 100 : 0;

    return summary;
  }

  // Get driver performance metrics
  getDriverPerformanceMetrics(events: LYTXEvent[]) {
    const driverMap = new Map<string, LYTXEvent[]>();
    
    events.forEach(event => {
      if (event.driver !== 'Driver Unassigned') {
        const key = `${event.driver}-${event.employeeId}`;
        if (!driverMap.has(key)) {
          driverMap.set(key, []);
        }
        driverMap.get(key)!.push(event);
      }
    });

    return Array.from(driverMap.entries()).map(([key, driverEvents]) => {
      const totalEvents = driverEvents.length;
      const resolvedEvents = driverEvents.filter(e => e.status === 'Resolved').length;
      const avgScore = driverEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents;
      const coachableEvents = driverEvents.filter(e => e.eventType === 'Coachable').length;
      const driverTaggedEvents = driverEvents.filter(e => e.eventType === 'Driver Tagged').length;
      
      // Get most recent event date
      const sortedEvents = driverEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastEventDate = sortedEvents[0]?.date || '';
      
      // Calculate risk level
      const riskLevel = totalEvents > 15 && avgScore > 4 ? 'critical' :
                       totalEvents > 10 && avgScore > 3 ? 'high' :
                       totalEvents > 5 && avgScore > 1 ? 'medium' : 'low';
      
      // Calculate trend based on recent vs older events
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentEvents = driverEvents.filter(e => new Date(e.date) >= thirtyDaysAgo);
      const olderEvents = driverEvents.filter(e => new Date(e.date) < thirtyDaysAgo);
      
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (recentEvents.length > 2 && olderEvents.length > 2) {
        const recentAvg = recentEvents.reduce((sum, e) => sum + e.score, 0) / recentEvents.length;
        const olderAvg = olderEvents.reduce((sum, e) => sum + e.score, 0) / olderEvents.length;
        const improvement = olderAvg - recentAvg;
        trend = improvement > 0.5 ? 'improving' : improvement < -0.5 ? 'declining' : 'stable';
      }

      return {
        driver: driverEvents[0].driver,
        employeeId: driverEvents[0].employeeId,
        depot: driverEvents[0].group,
        totalEvents,
        coachableEvents,
        driverTaggedEvents,
        resolutionRate: (resolvedEvents / totalEvents) * 100,
        averageScore: avgScore,
        riskLevel,
        trend,
        lastEventDate,
        eventsLast30Days: recentEvents.length
      };
    }).sort((a, b) => b.totalEvents - a.totalEvents);
  }

  // Get depot performance comparison
  getDepotComparison(events: LYTXEvent[]) {
    const depotMap = new Map<string, LYTXEvent[]>();
    
    events.forEach(event => {
      if (!depotMap.has(event.group)) {
        depotMap.set(event.group, []);
      }
      depotMap.get(event.group)!.push(event);
    });

    return Array.from(depotMap.entries()).map(([depot, depotEvents]) => {
      const totalEvents = depotEvents.length;
      const resolvedEvents = depotEvents.filter(e => e.status === 'Resolved').length;
      const avgScore = depotEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents;
      const uniqueDrivers = new Set(depotEvents.filter(e => e.driver !== 'Driver Unassigned').map(e => e.driver)).size;
      const unassignedEvents = depotEvents.filter(e => e.driver === 'Driver Unassigned').length;
      
      // Calculate events per day (assuming 30 day period)
      const eventsPerDay = totalEvents / 30;
      const eventsPerDriver = uniqueDrivers > 0 ? totalEvents / uniqueDrivers : 0;
      
      // Top 3 triggers for this depot
      const triggerCounts = depotEvents.reduce((acc, event) => {
        acc[event.trigger] = (acc[event.trigger] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topTriggers = Object.entries(triggerCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([trigger, count]) => ({ trigger, count, percentage: (count / totalEvents) * 100 }));

      return {
        depot,
        totalEvents,
        resolutionRate: (resolvedEvents / totalEvents) * 100,
        averageScore: avgScore,
        driverCount: uniqueDrivers,
        eventsPerDay,
        eventsPerDriver,
        unassignedRate: (unassignedEvents / totalEvents) * 100,
        topTriggers,
        // Performance rating
        performanceRating: this.calculateDepotPerformanceRating(
          (resolvedEvents / totalEvents) * 100,
          avgScore,
          eventsPerDriver
        )
      };
    }).sort((a, b) => b.totalEvents - a.totalEvents);
  }

  // Calculate depot performance rating
  private calculateDepotPerformanceRating(resolutionRate: number, avgScore: number, eventsPerDriver: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const resolutionScore = resolutionRate >= 90 ? 3 : resolutionRate >= 70 ? 2 : resolutionRate >= 50 ? 1 : 0;
    const severityScore = avgScore <= 1 ? 3 : avgScore <= 2 ? 2 : avgScore <= 3 ? 1 : 0;
    const frequencyScore = eventsPerDriver <= 2 ? 3 : eventsPerDriver <= 5 ? 2 : eventsPerDriver <= 10 ? 1 : 0;
    
    const totalScore = resolutionScore + severityScore + frequencyScore;
    
    return totalScore >= 8 ? 'excellent' : totalScore >= 6 ? 'good' : totalScore >= 4 ? 'fair' : 'poor';
  }

  // Create date range for API calls
  createDateRange(days: number = 30): { startDate: string; endDate: string } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  // Clear cached reference data
  clearCache() {
    this.statusMap.clear();
    this.triggerMap.clear();
    this.behaviorMap.clear();
    this.vehicleMap.clear();
  }
}

// Create singleton instance
export const lytxDataTransformer = new LytxDataTransformer();

export default lytxDataTransformer;