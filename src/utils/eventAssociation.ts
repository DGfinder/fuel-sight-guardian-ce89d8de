import * as vehicleApi from '@/api/vehicles';
import type { VehicleEvent } from '@/types/fleet';

// Guardian Event Association
export async function associateGuardianEvent(
  guardianUnitId: string,
  eventData: {
    event_id: string;
    event_type: string;
    occurred_at: string;
    duration?: number;
    speed?: number;
    location?: string;
    latitude?: number;
    longitude?: number;
    driver_name?: string;
    verified?: boolean;
    status?: string;
    severity?: 'Low' | 'Medium' | 'High' | 'Critical';
    metadata?: Record<string, any>;
  }
) {
  try {
    // Find vehicle by Guardian unit
    const vehicle = await vehicleApi.getVehicleByGuardianUnit(guardianUnitId);
    
    if (!vehicle) {
      console.warn(`No vehicle found for Guardian unit: ${guardianUnitId}`);
      return null;
    }

    // Create vehicle event
    const vehicleEvent: Omit<VehicleEvent, 'id' | 'created_at'> = {
      vehicle_id: vehicle.id,
      event_id: eventData.event_id,
      source: 'Guardian',
      event_type: eventData.event_type,
      occurred_at: eventData.occurred_at,
      duration: eventData.duration,
      speed: eventData.speed,
      location: eventData.location,
      latitude: eventData.latitude,
      longitude: eventData.longitude,
      driver_name: eventData.driver_name,
      verified: eventData.verified || false,
      status: eventData.status,
      severity: eventData.severity,
      metadata: eventData.metadata || {}
    };

    const createdEvent = await vehicleApi.createVehicleEvent(vehicleEvent);
    
    // Update vehicle safety metrics
    if (eventData.event_type === 'fatigue') {
      await vehicleApi.updateVehicle(vehicle.id, {
        fatigue_events: vehicle.fatigue_events + 1
      });
    } else {
      await vehicleApi.updateVehicle(vehicle.id, {
        safety_events: vehicle.safety_events + 1
      });
    }

    return {
      vehicle,
      event: createdEvent
    };
  } catch (error) {
    console.error('Error associating Guardian event:', error);
    throw error;
  }
}

// Lytx Event Association
export async function associateLytxEvent(
  lytxDeviceId: string,
  eventData: {
    event_id: string;
    event_type: string;
    occurred_at: string;
    duration?: number;
    speed?: number;
    location?: string;
    latitude?: number;
    longitude?: number;
    driver_name?: string;
    verified?: boolean;
    status?: string;
    severity?: 'Low' | 'Medium' | 'High' | 'Critical';
    metadata?: Record<string, any>;
  }
) {
  try {
    // Find vehicle by Lytx device
    const vehicle = await vehicleApi.getVehicleByLytxDevice(lytxDeviceId);
    
    if (!vehicle) {
      console.warn(`No vehicle found for Lytx device: ${lytxDeviceId}`);
      return null;
    }

    // Create vehicle event
    const vehicleEvent: Omit<VehicleEvent, 'id' | 'created_at'> = {
      vehicle_id: vehicle.id,
      event_id: eventData.event_id,
      source: 'Lytx',
      event_type: eventData.event_type,
      occurred_at: eventData.occurred_at,
      duration: eventData.duration,
      speed: eventData.speed,
      location: eventData.location,
      latitude: eventData.latitude,
      longitude: eventData.longitude,
      driver_name: eventData.driver_name,
      verified: eventData.verified || false,
      status: eventData.status,
      severity: eventData.severity,
      metadata: eventData.metadata || {}
    };

    const createdEvent = await vehicleApi.createVehicleEvent(vehicleEvent);
    
    // Update vehicle safety metrics
    await vehicleApi.updateVehicle(vehicle.id, {
      safety_events: vehicle.safety_events + 1
    });

    return {
      vehicle,
      event: createdEvent
    };
  } catch (error) {
    console.error('Error associating Lytx event:', error);
    throw error;
  }
}

// Batch processing functions
export async function processGuardianEventsBatch(
  events: Array<{
    guardianUnitId: string;
    eventData: Parameters<typeof associateGuardianEvent>[1];
  }>
) {
  const results = [];
  const errors = [];

  for (const { guardianUnitId, eventData } of events) {
    try {
      const result = await associateGuardianEvent(guardianUnitId, eventData);
      results.push(result);
    } catch (error) {
      errors.push({ guardianUnitId, eventData, error });
    }
  }

  return { results, errors };
}

export async function processLytxEventsBatch(
  events: Array<{
    lytxDeviceId: string;
    eventData: Parameters<typeof associateLytxEvent>[1];
  }>
) {
  const results = [];
  const errors = [];

  for (const { lytxDeviceId, eventData } of events) {
    try {
      const result = await associateLytxEvent(lytxDeviceId, eventData);
      results.push(result);
    } catch (error) {
      errors.push({ lytxDeviceId, eventData, error });
    }
  }

  return { results, errors };
}

// Get events for specific vehicle
export async function getVehicleEventsByRegistration(
  registration: string,
  filters?: {
    source?: 'Guardian' | 'Lytx' | 'Manual';
    event_type?: string;
    from_date?: string;
    to_date?: string;
    verified?: boolean;
  }
) {
  try {
    const vehicle = await vehicleApi.getVehicleByRegistration(registration);
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${registration}`);
    }

    return await vehicleApi.getVehicleEvents({
      vehicle_id: vehicle.id,
      ...filters
    });
  } catch (error) {
    console.error('Error getting vehicle events:', error);
    throw error;
  }
}

// Update event verification status
export async function updateEventVerification(
  eventId: string,
  verified: boolean,
  status?: string
) {
  try {
    return await vehicleApi.updateVehicleEvent(eventId, {
      verified,
      status
    });
  } catch (error) {
    console.error('Error updating event verification:', error);
    throw error;
  }
}

// Get summary statistics
export async function getEventSummaryByFleet(fleet?: 'Stevemacs' | 'Great Southern Fuels') {
  try {
    const vehicles = await vehicleApi.getVehicles({ fleet });
    
    const summary = {
      totalEvents: 0,
      verifiedEvents: 0,
      guardianEvents: 0,
      lytxEvents: 0,
      eventsByType: {} as Record<string, number>,
      eventsByVehicle: [] as Array<{
        registration: string;
        fleet: string;
        totalEvents: number;
        verifiedEvents: number;
      }>
    };

    for (const vehicle of vehicles) {
      const events = await vehicleApi.getVehicleEvents({ vehicle_id: vehicle.id });
      
      const vehicleStats = {
        registration: vehicle.registration,
        fleet: vehicle.fleet,
        totalEvents: events.length,
        verifiedEvents: events.filter(e => e.verified).length
      };

      summary.eventsByVehicle.push(vehicleStats);
      summary.totalEvents += events.length;
      summary.verifiedEvents += vehicleStats.verifiedEvents;
      summary.guardianEvents += events.filter(e => e.source === 'Guardian').length;
      summary.lytxEvents += events.filter(e => e.source === 'Lytx').length;

      // Count by event type
      events.forEach(event => {
        summary.eventsByType[event.event_type] = (summary.eventsByType[event.event_type] || 0) + 1;
      });
    }

    return summary;
  } catch (error) {
    console.error('Error getting event summary:', error);
    throw error;
  }
}