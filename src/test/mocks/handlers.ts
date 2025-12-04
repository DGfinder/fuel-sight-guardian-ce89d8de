import { http, HttpResponse } from 'msw'

// Mock API handlers for Supabase
export const handlers = [
  // Mock auth endpoints
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        user_metadata: {},
      },
    })
  }),

  // Mock fuel tanks endpoint (updated for single source of truth)
  http.get('*/rest/v1/fuel_tanks', () => {
    return HttpResponse.json([
      {
        id: 'tank-1',
        location: 'Test Location',
        product_type: 'Diesel',
        safe_level: 2000,
        min_level: 200,
        group_id: 'group-1',
        group_name: 'Test Group',
        subgroup: 'Test Subgroup',
        address: 'Test Address',
        vehicle: 'Test Vehicle',
        discharge: 'Test Discharge',
        bp_portal: 'Test Portal',
        delivery_window: 'Business Hours',
        afterhours_contact: 'Test Contact',
        notes: 'Test Notes',
        serviced_on: null,
        serviced_by: null,
        latitude: -31.9505,
        longitude: 115.8605,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  // Mock user permissions endpoint
  http.get('*/rest/v1/user_roles', () => {
    return HttpResponse.json([
      {
        id: 'role-1',
        user_id: 'mock-user-id',
        role: 'admin',
        group_id: 'group-1',
      },
    ])
  }),

  // Mock dip readings endpoint
  http.get('*/rest/v1/dip_readings', () => {
    return HttpResponse.json([
      {
        id: 'reading-1',
        tank_id: 'tank-1',
        value: 1000,
        created_at: new Date().toISOString(),
        recorded_by: 'mock-user-id',
      },
    ])
  }),

  // Mock tank alerts endpoint
  http.get('*/rest/v1/tank_alerts', () => {
    return HttpResponse.json([
      {
        id: 'alert-1',
        tank_id: 'tank-1',
        alert_type: 'Low Level',
        message: 'Tank level is low',
        created_at: new Date().toISOString(),
        acknowledged_at: null,
      },
    ])
  }),
]