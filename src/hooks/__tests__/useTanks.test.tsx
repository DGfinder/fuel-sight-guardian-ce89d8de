import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTanks } from '../useTanks'
import { useUserPermissions } from '../useUserPermissions'

// Mock the dependencies
vi.mock('../useUserPermissions')
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'tank-1',
                location: 'Test Location',
                current_level: 1000,
                capacity: 2000,
                group_id: 'group-1',
              },
            ],
            error: null,
          }),
        }),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'tank-1',
                location: 'Test Location',
                current_level: 1000,
                capacity: 2000,
                group_id: 'group-1',
              },
            ],
            error: null,
          }),
        }),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'tank-1',
              location: 'Test Location',
              current_level: 1000,
              capacity: 2000,
              group_id: 'group-1',
            },
          ],
          error: null,
        }),
      }),
    }),
  },
}))

vi.mock('../../lib/realtime-manager', () => ({
  realtimeManager: {
    subscribeToTanks: vi.fn(),
    unsubscribe: vi.fn(),
    setQueryClient: vi.fn(),
    subscribe: vi.fn(),
  },
}))

const mockUseUserPermissions = vi.mocked(useUserPermissions)

describe('useTanks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it.skip('should fetch tanks when user has permissions', async () => {
    mockUseUserPermissions.mockReturnValue({
      data: {
        role: 'admin' as const,
        accessibleGroups: [{ id: 'group-1', name: 'Test Group' }],
        isAdmin: true,
        isManager: false,
        isPrivileged: true,
        canManageUsers: true,
        canManageGroups: true,
        canViewAllTanks: true,
        canEditAllTanks: true,
        canDeleteTanks: true,
        canViewAllDips: true,
        canEditAllDips: true,
        canDeleteDips: true,
        canViewAllAlerts: true,
        canAcknowledgeAlerts: true,
        canManageAlerts: true,
      },
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useTanks(), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('tank-1')
  })

  it('should return empty array when no user is authenticated', async () => {
    mockUseUserPermissions.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    const { result } = renderHook(() => useTanks(), { wrapper })

    // Wait for the query to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // useTanks returns [] when auth.getUser() returns no user
    expect(result.current.data).toEqual([])
  })

  it('should handle no authenticated user gracefully', async () => {
    mockUseUserPermissions.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useTanks(), { wrapper })

    // Wait for the query to resolve
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Returns empty array when no user
    expect(result.current.data).toEqual([])
  })
})