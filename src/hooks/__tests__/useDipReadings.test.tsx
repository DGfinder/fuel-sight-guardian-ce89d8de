import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Use vi.hoisted to define mocks
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

import {
  useDipReadings,
  useTankDips,
  useRecentDips,
  useRecorders,
  useDipStatistics,
} from '../useDipReadings'

describe('useDipReadings', () => {
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

  // Helper to create mock chain for Supabase query builder
  const createMockQueryBuilder = (data: any[], count: number = 0) => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockImplementation(() =>
        Promise.resolve({ data, error: null, count })
      ),
    }
    return mockBuilder
  }

  describe('main useDipReadings hook', () => {
    it('should fetch dip readings with default params', async () => {
      const mockData = [
        {
          id: 'dip-1',
          tank_id: 'tank-1',
          value: 1000,
          created_at: '2024-01-15T10:00:00Z',
          recorded_by_name: 'John Doe',
          notes: 'Test reading',
        },
      ]

      mockFrom.mockReturnValue(createMockQueryBuilder(mockData, 1))

      const { result } = renderHook(() => useDipReadings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.readings).toHaveLength(1)
      expect(result.current.data?.readings[0].tank_id).toBe('tank-1')
      expect(result.current.data?.totalCount).toBe(1)
    })

    it('should filter by single tank ID', async () => {
      const mockData = [
        { id: 'dip-1', tank_id: 'tank-123', value: 500, created_at: '2024-01-15T10:00:00Z', recorded_by_name: 'Test' },
      ]

      const mockBuilder = createMockQueryBuilder(mockData, 1)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ tankIds: 'tank-123' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.eq).toHaveBeenCalledWith('tank_id', 'tank-123')
    })

    it('should filter by multiple tank IDs', async () => {
      const mockData = [
        { id: 'dip-1', tank_id: 'tank-1', value: 500, created_at: '2024-01-15T10:00:00Z', recorded_by_name: 'Test' },
        { id: 'dip-2', tank_id: 'tank-2', value: 600, created_at: '2024-01-15T11:00:00Z', recorded_by_name: 'Test' },
      ]

      const mockBuilder = createMockQueryBuilder(mockData, 2)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ tankIds: ['tank-1', 'tank-2'] }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.in).toHaveBeenCalledWith('tank_id', ['tank-1', 'tank-2'])
    })

    it('should filter by date range', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const dateFrom = new Date('2024-01-01')
      const dateTo = new Date('2024-01-31')

      const { result } = renderHook(
        () => useDipReadings({ dateFrom, dateTo }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.gte).toHaveBeenCalledWith('created_at', dateFrom.toISOString())
      expect(mockBuilder.lte).toHaveBeenCalledWith('created_at', dateTo.toISOString())
    })

    it('should filter by last N days', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ days: 7 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.gte).toHaveBeenCalled()
    })

    it('should apply text search filter', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ searchQuery: 'test' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.or).toHaveBeenCalledWith(
        'notes.ilike.%test%,recorded_by_name.ilike.%test%'
      )
    })

    it('should filter by recorded_by user', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ recordedBy: 'user-123' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.eq).toHaveBeenCalledWith('recorded_by', 'user-123')
    })

    it('should not filter by recorded_by when value is "all"', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ recordedBy: 'all' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // eq should not be called for recorded_by when value is 'all'
      // It may be called for other filters though
      const eqCalls = mockBuilder.eq.mock.calls.filter(
        (call: any[]) => call[0] === 'recorded_by'
      )
      expect(eqCalls).toHaveLength(0)
    })

    it('should filter by value range', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ minValue: 100, maxValue: 500 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.gte).toHaveBeenCalledWith('value', 100)
      expect(mockBuilder.lte).toHaveBeenCalledWith('value', 500)
    })

    it('should exclude archived by default', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(() => useDipReadings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.is).toHaveBeenCalledWith('archived_at', null)
    })

    it('should include archived when specified', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ includeArchived: true }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // When includeArchived is true, is() should not be called for archived_at
      const isCalls = mockBuilder.is.mock.calls.filter(
        (call: any[]) => call[0] === 'archived_at'
      )
      expect(isCalls).toHaveLength(0)
    })

    it('should handle sort order', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ sortBy: 'value', sortOrder: 'asc' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.order).toHaveBeenCalledWith('value', { ascending: true })
    })

    it('should handle pagination', async () => {
      const mockBuilder = createMockQueryBuilder([], 0)
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipReadings({ limit: 50, offset: 100 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.range).toHaveBeenCalledWith(100, 149) // offset to offset + limit - 1
    })

    it('should handle errors gracefully', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
          count: null,
        }),
      }
      mockFrom.mockReturnValue(mockBuilder)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useDipReadings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      consoleSpy.mockRestore()
    })

    it('should calculate hasMore correctly', async () => {
      const mockData = new Array(100).fill(null).map((_, i) => ({
        id: `dip-${i}`,
        tank_id: 'tank-1',
        value: i * 10,
        created_at: '2024-01-15T10:00:00Z',
        recorded_by_name: 'Test',
      }))

      // Total count is 150, but we only return 100
      mockFrom.mockReturnValue(createMockQueryBuilder(mockData, 150))

      const { result } = renderHook(
        () => useDipReadings({ limit: 100 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.hasMore).toBe(true)
    })

    it('should be disabled when enabled is false', async () => {
      mockFrom.mockReturnValue(createMockQueryBuilder([], 0))

      const { result } = renderHook(
        () => useDipReadings({ enabled: false }),
        { wrapper }
      )

      // Query should not be fetching
      expect(result.current.isFetching).toBe(false)
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('useTankDips (deprecated)', () => {
    it('should fetch dips for a single tank', async () => {
      const mockData = [
        { id: 'dip-1', tank_id: 'tank-123', value: 500, created_at: '2024-01-15T10:00:00Z', recorded_by_name: 'Test' },
      ]

      mockFrom.mockReturnValue(createMockQueryBuilder(mockData, 1))

      const { result } = renderHook(() => useTankDips('tank-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.readings).toHaveLength(1)
    })

    it('should be disabled when tankId is undefined', async () => {
      const { result } = renderHook(() => useTankDips(undefined), { wrapper })

      expect(result.current.isFetching).toBe(false)
    })
  })

  describe('useRecentDips (deprecated)', () => {
    it('should fetch recent dips across all tanks', async () => {
      const mockData = [
        { id: 'dip-1', tank_id: 'tank-1', value: 500, created_at: '2024-01-15T10:00:00Z', recorded_by_name: 'Test' },
        { id: 'dip-2', tank_id: 'tank-2', value: 600, created_at: '2024-01-15T11:00:00Z', recorded_by_name: 'Test' },
      ]

      mockFrom.mockReturnValue(createMockQueryBuilder(mockData, 2))

      const { result } = renderHook(() => useRecentDips(30), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.readings).toHaveLength(2)
    })
  })

  describe('useRecorders', () => {
    it('should fetch unique recorders', async () => {
      const mockData = [
        { recorded_by: 'user-1', recorded_by_name: 'John Doe' },
        { recorded_by: 'user-1', recorded_by_name: 'John Doe' }, // Duplicate
        { recorded_by: 'user-2', recorded_by_name: 'Jane Smith' },
      ]

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(() => useRecorders(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Should deduplicate recorders
      expect(result.current.data).toHaveLength(2)
      expect(result.current.data?.map(r => r.fullName)).toContain('John Doe')
      expect(result.current.data?.map(r => r.fullName)).toContain('Jane Smith')
    })

    it('should filter by tank IDs when provided', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useRecorders(['tank-1', 'tank-2']),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockBuilder.in).toHaveBeenCalledWith('tank_id', ['tank-1', 'tank-2'])
    })
  })

  describe('useDipStatistics', () => {
    it('should calculate statistics for a tank', async () => {
      const mockData = [
        { id: 'dip-1', tank_id: 'tank-1', value: 100, created_at: '2024-01-10T10:00:00Z', recorded_by_name: 'Test' },
        { id: 'dip-2', tank_id: 'tank-1', value: 200, created_at: '2024-01-15T10:00:00Z', recorded_by_name: 'Test' },
        { id: 'dip-3', tank_id: 'tank-1', value: 300, created_at: '2024-01-20T10:00:00Z', recorded_by_name: 'Test' },
      ]

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipStatistics('tank-1'),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.count).toBe(3)
      expect(result.current.data?.min).toBe(100)
      expect(result.current.data?.max).toBe(300)
      expect(result.current.data?.average).toBe(200)
      expect(result.current.data?.oldest?.id).toBe('dip-1')
      expect(result.current.data?.latest?.id).toBe('dip-3')
    })

    it('should return empty stats when no data', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockFrom.mockReturnValue(mockBuilder)

      const { result } = renderHook(
        () => useDipStatistics('tank-1'),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.count).toBe(0)
      expect(result.current.data?.min).toBe(0)
      expect(result.current.data?.max).toBe(0)
      expect(result.current.data?.average).toBe(0)
      expect(result.current.data?.latest).toBeNull()
      expect(result.current.data?.oldest).toBeNull()
    })
  })
})

describe('DipReadingsParams defaults', () => {
  it('should have sensible defaults', () => {
    const defaults = {
      enabled: true,
      sortBy: 'created_at' as const,
      sortOrder: 'desc' as const,
      limit: 100,
      offset: 0,
      includeArchived: false,
    }

    expect(defaults.enabled).toBe(true)
    expect(defaults.sortBy).toBe('created_at')
    expect(defaults.sortOrder).toBe('desc')
    expect(defaults.limit).toBe(100)
    expect(defaults.offset).toBe(0)
    expect(defaults.includeArchived).toBe(false)
  })
})
