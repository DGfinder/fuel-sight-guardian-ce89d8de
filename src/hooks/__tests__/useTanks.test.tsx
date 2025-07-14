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
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
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
        })),
      })),
    })),
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

  it('should fetch tanks when user has permissions', async () => {
    mockUseUserPermissions.mockReturnValue({
      data: {
        role: 'admin' as const,
        permissions: {
          canViewAllTanks: true,
          canManageTanks: true,
        },
        accessible_groups: [{ id: 'group-1', name: 'Test Group' }],
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

  it('should return loading state initially', () => {
    mockUseUserPermissions.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    const { result } = renderHook(() => useTanks(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('should handle empty permissions', () => {
    mockUseUserPermissions.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useTanks(), { wrapper })

    expect(result.current.data).toBeUndefined()
  })
})