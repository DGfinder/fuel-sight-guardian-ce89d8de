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

  // Mock fuel tanks endpoint
  http.get('*/rest/v1/tanks_with_rolling_avg', () => {
    return HttpResponse.json([
      {
        id: 'tank-1',
        tank_name: 'Test Tank 1',
        location: 'Test Location',
        current_level: 1000,
        capacity: 2000,
        min_level: 200,
        status: 'Normal',
        group_id: 'group-1',
        group_name: 'Test Group',
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