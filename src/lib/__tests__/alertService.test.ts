import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tank } from '@/types/fuel'

// Mock supabase before importing alertService
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        is: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}))

import {
  generateAlerts,
  getActiveAlertsCount,
  getActiveTankAlertsCount,
  getAlertsBreakdown,
} from '../alertService'

// Helper to create test tanks
function createTestTank(overrides: Partial<Tank> = {}): Tank {
  return {
    id: 'tank-1',
    location: 'Test Tank',
    group_id: 'group-1',
    group_name: 'Test Group',
    current_level: 1000,
    capacity: 5000,
    current_level_percent: 50,
    safe_level: 2000,
    min_level: 1000,
    days_to_min_level: 10,
    last_dip_ts: new Date().toISOString(),
    product_type: 'Diesel',
    ...overrides,
  } as Tank
}

describe('alertService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateAlerts', () => {
    it('should return 0 alerts for empty tank array', async () => {
      const result = await generateAlerts([])
      expect(result.generated).toBe(0)
      expect(result.resolved).toBe(0)
    })

    it('should not generate alerts for healthy tanks', async () => {
      const healthyTank = createTestTank({
        current_level_percent: 75,
        days_to_min_level: 15,
        last_dip_ts: new Date().toISOString(),
      })

      const result = await generateAlerts([healthyTank])
      expect(result.generated).toBe(0)
    })

    it('should generate critical_fuel alert for tanks <= 10%', async () => {
      const criticalTank = createTestTank({
        current_level_percent: 8,
        days_to_min_level: 5,
      })

      const result = await generateAlerts([criticalTank])
      expect(result.generated).toBe(1)
    })

    it('should generate critical_fuel alert when days_to_min <= 1.5', async () => {
      const criticalTank = createTestTank({
        current_level_percent: 25, // Not critical by percentage
        days_to_min_level: 1, // But critical by days
      })

      const result = await generateAlerts([criticalTank])
      expect(result.generated).toBe(1)
    })

    it('should generate low_fuel alert for tanks <= 20% (but > 10%)', async () => {
      const lowTank = createTestTank({
        current_level_percent: 15,
        days_to_min_level: 10,
      })

      const result = await generateAlerts([lowTank])
      expect(result.generated).toBe(1)
    })

    it('should generate low_fuel alert when days_to_min <= 2.5 (but > 1.5)', async () => {
      const lowTank = createTestTank({
        current_level_percent: 30, // Not low by percentage
        days_to_min_level: 2, // But low by days
      })

      const result = await generateAlerts([lowTank])
      expect(result.generated).toBe(1)
    })

    it('should NOT generate low_fuel alert if already critical', async () => {
      const criticalTank = createTestTank({
        current_level_percent: 8, // Critical level
        days_to_min_level: 1, // Also critical by days
      })

      const result = await generateAlerts([criticalTank])
      // Should only generate 1 alert (critical), not 2 (critical + low)
      expect(result.generated).toBe(1)
    })

    it('should generate no_reading alert for tanks with no dip timestamp', async () => {
      const noReadingTank = createTestTank({
        current_level_percent: 50,
        last_dip_ts: undefined,
      })

      const result = await generateAlerts([noReadingTank])
      expect(result.generated).toBe(1)
    })

    it('should generate no_reading alert for tanks with old dip (7+ days)', async () => {
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const oldReadingTank = createTestTank({
        current_level_percent: 50,
        last_dip_ts: eightDaysAgo.toISOString(),
      })

      const result = await generateAlerts([oldReadingTank])
      expect(result.generated).toBe(1)
    })

    it('should not generate no_reading alert for recent dips (< 7 days)', async () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const recentReadingTank = createTestTank({
        current_level_percent: 50,
        last_dip_ts: threeDaysAgo.toISOString(),
      })

      const result = await generateAlerts([recentReadingTank])
      expect(result.generated).toBe(0)
    })

    it('should skip tanks with null/undefined current_level_percent', async () => {
      const noDataTank = createTestTank({
        current_level_percent: undefined as unknown as number,
      })

      const result = await generateAlerts([noDataTank])
      expect(result.generated).toBe(0)
    })

    it('should handle multiple tanks with different conditions', async () => {
      const tanks = [
        createTestTank({ id: 'tank-1', current_level_percent: 5 }), // Critical
        createTestTank({ id: 'tank-2', current_level_percent: 15 }), // Low
        createTestTank({ id: 'tank-3', current_level_percent: 75 }), // Healthy
      ]

      const result = await generateAlerts(tanks)
      expect(result.generated).toBe(2) // Critical + Low
    })
  })

  describe('getActiveTankAlertsCount', () => {
    it('should return count from supabase', async () => {
      const { supabase } = await import('../supabase')
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      } as any)

      const count = await getActiveTankAlertsCount()
      expect(count).toBe(5)
    })

    it('should return 0 on error', async () => {
      const { supabase } = await import('../supabase')
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ count: null, error: { message: 'Error' } }),
          }),
        }),
      } as any)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const count = await getActiveTankAlertsCount()
      expect(count).toBe(0)
      consoleSpy.mockRestore()
    })
  })

  describe('getActiveAlertsCount', () => {
    it('should return sum of tank and agbot alerts', async () => {
      const { supabase } = await import('../supabase')

      // Mock both tank and agbot alert counts
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({
                count: callCount === 1 ? 3 : 2, // 3 tank alerts, 2 agbot alerts
                error: null
              }),
            }),
          }),
        } as any
      })

      const count = await getActiveAlertsCount()
      expect(count).toBe(5) // 3 + 2
    })
  })

  describe('getAlertsBreakdown', () => {
    it('should return breakdown by type', async () => {
      const { supabase } = await import('../supabase')

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        const tankData = [
          { alert_type: 'critical_fuel' },
          { alert_type: 'critical_fuel' },
          { alert_type: 'low_fuel' },
          { alert_type: 'no_reading' },
        ]
        const agbotData = [
          { alert_type: 'device_offline' },
          { alert_type: 'critical_fuel' },
        ]

        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({
                data: callCount === 1 ? tankData : agbotData,
                error: null
              }),
            }),
          }),
        } as any
      })

      const breakdown = await getAlertsBreakdown()

      expect(breakdown.tank.total).toBe(4)
      expect(breakdown.tank.critical).toBe(2)
      expect(breakdown.tank.low).toBe(1)
      expect(breakdown.tank.noReading).toBe(1)

      expect(breakdown.agbot.total).toBe(2)
      expect(breakdown.agbot.offline).toBe(1)
      expect(breakdown.agbot.critical).toBe(1)

      expect(breakdown.total).toBe(6)
    })

    it('should return zeros on error', async () => {
      const { supabase } = await import('../supabase')

      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Database error')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const breakdown = await getAlertsBreakdown()

      expect(breakdown.total).toBe(0)
      expect(breakdown.tank.total).toBe(0)
      expect(breakdown.agbot.total).toBe(0)
      consoleSpy.mockRestore()
    })
  })
})

describe('alert threshold constants', () => {
  // These tests verify the business logic thresholds are correct
  // Reset supabase mock before each test since previous tests may have modified it
  beforeEach(async () => {
    vi.clearAllMocks()
    const { supabase } = await import('../supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        is: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as any)
  })

  it('critical fuel threshold should be 10%', async () => {
    const tankAt10 = createTestTank({ current_level_percent: 10, days_to_min_level: 10 })
    const tankAt11 = createTestTank({ current_level_percent: 11, days_to_min_level: 10 })

    const result10 = await generateAlerts([tankAt10])
    const result11 = await generateAlerts([tankAt11])

    expect(result10.generated).toBe(1) // 10% is critical
    expect(result11.generated).toBe(1) // 11% is not critical, but IS low (under 20%)
  })

  it('low fuel threshold should be 20%', async () => {
    const tankAt20 = createTestTank({ current_level_percent: 20, days_to_min_level: 10 })
    const tankAt21 = createTestTank({ current_level_percent: 21, days_to_min_level: 10 })

    const result20 = await generateAlerts([tankAt20])
    const result21 = await generateAlerts([tankAt21])

    expect(result20.generated).toBe(1) // 20% is low
    expect(result21.generated).toBe(0) // 21% is healthy
  })

  it('days_to_min critical threshold should be 1.5 days', async () => {
    const tankAt1_5 = createTestTank({ current_level_percent: 50, days_to_min_level: 1.5 })
    const tankAt1_6 = createTestTank({ current_level_percent: 50, days_to_min_level: 1.6 })

    const result1_5 = await generateAlerts([tankAt1_5])
    const result1_6 = await generateAlerts([tankAt1_6])

    expect(result1_5.generated).toBe(1) // 1.5 days is critical
    expect(result1_6.generated).toBe(1) // 1.6 days is not critical, but IS low (under 2.5)
  })

  it('days_to_min low threshold should be 2.5 days', async () => {
    const tankAt2_5 = createTestTank({ current_level_percent: 50, days_to_min_level: 2.5 })
    const tankAt2_6 = createTestTank({ current_level_percent: 50, days_to_min_level: 2.6 })

    const result2_5 = await generateAlerts([tankAt2_5])
    const result2_6 = await generateAlerts([tankAt2_6])

    expect(result2_5.generated).toBe(1) // 2.5 days is low
    expect(result2_6.generated).toBe(0) // 2.6 days is healthy
  })

  it('no_reading threshold should be 7 days', async () => {
    const sixDaysAgo = new Date()
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const tankAt6Days = createTestTank({
      current_level_percent: 50,
      last_dip_ts: sixDaysAgo.toISOString()
    })
    const tankAt7Days = createTestTank({
      current_level_percent: 50,
      last_dip_ts: sevenDaysAgo.toISOString()
    })

    const result6Days = await generateAlerts([tankAt6Days])
    const result7Days = await generateAlerts([tankAt7Days])

    expect(result6Days.generated).toBe(0) // 6 days is ok
    expect(result7Days.generated).toBe(1) // 7 days triggers no_reading
  })
})
