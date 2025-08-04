import { QueryClient } from '@tanstack/react-query';

// Lytx Video API Configuration - Updated to use environment variables and correct Video API endpoints
const LYTX_API_KEY = import.meta.env.VITE_LYTX_API_KEY;
const LYTX_BASE_URL = import.meta.env.VITE_LYTX_BASE_URL || 'https://lytx-api.prod7.lv.lytx.com';

// API Response Types based on Lytx documentation
export interface LytxApiResponse<T> {
  data: T;
  totalCount?: number;
  page?: number;
  pageSize?: number;
}

export interface LytxSafetyEvent {
  id: string;
  eventId: string;
  vehicleId: string;
  driverId?: string;
  driverName?: string;
  employeeId?: string;
  groupId: string;
  groupName: string;
  deviceSerialNumber: string;
  eventDateTime: string;
  timezone: string;
  score: number;
  statusId: number;
  status: string;
  triggerId: number;
  trigger: string;
  triggerSubtypeId?: number;
  triggerSubtype?: string;
  behaviors: LytxEventBehavior[];
  notes?: LytxNote[];
  reviewedBy?: string;
  reviewedDate?: string;
  excluded?: boolean;
  exclusionReason?: string;
}

export interface LytxEventBehavior {
  id: number;
  name: string;
  description?: string;
}

export interface LytxNote {
  id: string;
  content: string;
  createdBy: string;
  createdDate: string;
  type: string;
}

export interface LytxVehicle {
  id: string;
  vehicleId: string;
  name: string;
  serialNumber: string;
  groupId: string;
  groupName: string;
  driverId?: string;
  driverName?: string;
  status: string;
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
}

export interface LytxEventStatus {
  id: number;
  name: string;
  description?: string;
}

export interface LytxEventTrigger {
  id: number;
  name: string;
  description?: string;
}

export interface LytxEventTriggerSubtype {
  id: number;
  triggerId: number;
  name: string;
  description?: string;
}

// API Client Class
class LytxApiClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = LYTX_BASE_URL;
    this.apiKey = LYTX_API_KEY;
    this.defaultHeaders = {
      'accept': 'application/json',
      'x-apikey': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<LytxApiResponse<T>> {
    try {
      // Use proxy in production, direct API in development
      const useProxy = typeof window !== 'undefined' && 
                      !window.location.hostname.includes('localhost') && 
                      !window.location.hostname.includes('127.0.0.1') &&
                      !window.location.hostname.includes('192.168.');
      
      let response: Response;
      
      if (useProxy) {
        // Use Vercel serverless function proxy
        response = await fetch('/api/lytx-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            endpoint,
            method: options.method || 'GET',
            headers: options.headers,
            ...(options.body && { body: options.body })
          })
        });
      } else {
        // Direct API call for local development
        const url = `${this.baseUrl}${endpoint}`;
        response = await fetch(url, {
          ...options,
          headers: {
            ...this.defaultHeaders,
            ...options.headers
          }
        });
      }

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const data = await response.json();
      
      // Handle different response formats from Lytx API
      if (Array.isArray(data)) {
        return {
          data,
          totalCount: data.length,
          page: 1,
          pageSize: data.length
        };
      }

      return {
        data: data.data || data,
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize
      };

    } catch (error) {
      console.error('Lytx API Error:', error);
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  private async handleApiError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If we can't parse the error response, use the status text
    }

    // Handle specific error cases
    switch (response.status) {
      case 401:
        throw new Error('Unauthorized: Invalid API key or expired session');
      case 403:
        throw new Error('Forbidden: Insufficient permissions for this resource');
      case 404:
        throw new Error('Not Found: The requested resource does not exist');
      case 429:
        throw new Error('Rate Limit Exceeded: Too many requests, please try again later');
      case 500:
        throw new Error('Internal Server Error: Lytx service is experiencing issues');
      default:
        throw new Error(errorMessage);
    }
  }

  // Safety Events API
  async getSafetyEvents(params: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
    driverId?: string;
    statusId?: number;
    triggerId?: number;
  } = {}): Promise<LytxApiResponse<LytxSafetyEvent[]>> {
    const queryParams = new URLSearchParams();
    
    // Set default pagination
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('pageSize', (params.pageSize || 50).toString());
    
    // Add optional filters
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.vehicleId) queryParams.append('vehicleId', params.vehicleId);
    if (params.driverId) queryParams.append('driverId', params.driverId);
    if (params.statusId) queryParams.append('statusId', params.statusId.toString());
    if (params.triggerId) queryParams.append('triggerId', params.triggerId.toString());

    return this.makeRequest<LytxSafetyEvent[]>(`/video/safety/events?${queryParams.toString()}`);
  }

  async getSafetyEvent(eventId: string): Promise<LytxApiResponse<LytxSafetyEvent>> {
    return this.makeRequest<LytxSafetyEvent>(`/video/safety/events/${eventId}`);
  }

  async getSafetyEventsWithMetadata(params: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<LytxApiResponse<LytxSafetyEvent[]>> {
    const queryParams = new URLSearchParams();
    
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('pageSize', (params.pageSize || 50).toString());
    
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);

    return this.makeRequest<LytxSafetyEvent[]>(`/video/safety/eventsWithMetadata?${queryParams.toString()}`);
  }

  // Reference Data API
  async getEventStatuses(): Promise<LytxApiResponse<LytxEventStatus[]>> {
    return this.makeRequest<LytxEventStatus[]>('/video/safety/events/statuses');
  }

  async getEventTriggers(): Promise<LytxApiResponse<LytxEventTrigger[]>> {
    return this.makeRequest<LytxEventTrigger[]>('/video/safety/events/triggers');
  }

  async getEventTriggerSubtypes(): Promise<LytxApiResponse<LytxEventTriggerSubtype[]>> {
    return this.makeRequest<LytxEventTriggerSubtype[]>('/video/safety/events/triggersubtypes');
  }

  async getEventBehaviors(): Promise<LytxApiResponse<LytxEventBehavior[]>> {
    return this.makeRequest<LytxEventBehavior[]>('/video/safety/events/behaviors');
  }

  // Vehicles API
  async getVehicles(params: {
    page?: number;
    limit?: number;
    groupId?: string;
    name?: string;
    includeSubgroups?: boolean;
  } = {}): Promise<LytxApiResponse<LytxVehicle[]>> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.groupId) queryParams.append('groupId', params.groupId);
    if (params.name) queryParams.append('name', params.name);
    if (params.includeSubgroups !== undefined) queryParams.append('includeSubgroups', params.includeSubgroups.toString());

    return this.makeRequest<LytxVehicle[]>(`/vehicles/all?${queryParams.toString()}`);
  }

  async getVehicle(vehicleId: string): Promise<LytxApiResponse<LytxVehicle>> {
    return this.makeRequest<LytxVehicle>(`/vehicles/${vehicleId}`);
  }

  async getVehicleBySerial(serialNumber: string): Promise<LytxApiResponse<LytxVehicle>> {
    return this.makeRequest<LytxVehicle>(`/vehicles/${serialNumber}`);
  }

  // Utility Methods
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test connection with a simple API call
      const response = await this.getEventStatuses();
      return {
        success: true,
        message: `Connected successfully. Retrieved ${response.data.length} event statuses.`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Update API configuration (for different environments)
  updateConfiguration(environment: string = 'prod7', location: string = 'lv') {
    this.baseUrl = `https://lytx-api.${environment}.${location}.lytx.com/video`;
  }

  // Get current configuration
  getConfiguration() {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey
    };
  }
}

// Create singleton instance
export const lytxApi = new LytxApiClient();

// React Query Keys
export const lytxQueryKeys = {
  safetyEvents: (params?: any) => ['lytx', 'safety', 'events', params],
  safetyEvent: (eventId: string) => ['lytx', 'safety', 'event', eventId],
  eventStatuses: () => ['lytx', 'safety', 'statuses'],
  eventTriggers: () => ['lytx', 'safety', 'triggers'],
  eventTriggerSubtypes: () => ['lytx', 'safety', 'triggerSubtypes'],
  eventBehaviors: () => ['lytx', 'safety', 'behaviors'],
  vehicles: (params?: any) => ['lytx', 'vehicles', params],
  vehicle: (vehicleId: string) => ['lytx', 'vehicle', vehicleId]
};

// Default export
export default lytxApi;