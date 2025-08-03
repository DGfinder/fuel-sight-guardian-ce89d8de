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
    
    if (groupLower.includes('stevemacs') || groupLower.includes('smb') || groupLower.includes('kewdale')) {
      return 'Stevemacs';
    }
    
    // Default to GSF since we're using GSF's API key
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
    return lytxEvents.map(event => this.transformSafetyEvent(event));
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

  // Get summary statistics
  getEventSummary(events: LYTXEvent[]) {
    const summary = {
      total: events.length,
      byStatus: {} as Record<string, number>,
      byEventType: {} as Record<string, number>,
      byCarrier: {} as Record<string, number>,
      byDepot: {} as Record<string, number>,
      averageScore: 0,
      excluded: 0,
      unassigned: 0
    };

    events.forEach(event => {
      // Count by status
      summary.byStatus[event.status] = (summary.byStatus[event.status] || 0) + 1;
      
      // Count by event type
      summary.byEventType[event.eventType] = (summary.byEventType[event.eventType] || 0) + 1;
      
      // Count by carrier
      summary.byCarrier[event.carrier] = (summary.byCarrier[event.carrier] || 0) + 1;
      
      // Count by depot
      summary.byDepot[event.group] = (summary.byDepot[event.group] || 0) + 1;
      
      // Count excluded
      if (event.excluded) {
        summary.excluded++;
      }
      
      // Count unassigned drivers
      if (event.driver === 'Driver Unassigned') {
        summary.unassigned++;
      }
    });

    // Calculate average score
    const totalScore = events.reduce((sum, event) => sum + event.score, 0);
    summary.averageScore = events.length > 0 ? totalScore / events.length : 0;

    return summary;
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