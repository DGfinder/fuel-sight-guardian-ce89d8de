import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toPerthTime,
  formatPerthTimestamp,
  formatPerthDisplay,
  getPerthNow,
  getPerthToday,
  getPerthTomorrow,
  getPerthYesterday,
  getMinutesFromNowInPerth,
  formatPerthRelativeTime,
  getDeviceStatus,
  validateTimestamp,
  normalizeToPerthString,
} from '../timezone'

describe('timezone utilities', () => {
  describe('toPerthTime', () => {
    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = toPerthTime(date)
      expect(result.getTime()).toBe(date.getTime())
    })

    it('should handle ISO string dates', () => {
      const isoString = '2024-01-15T10:30:00Z'
      const result = toPerthTime(isoString)
      // toISOString adds milliseconds, so compare timestamps instead
      expect(result.getTime()).toBe(new Date(isoString).getTime())
    })

    it('should handle timestamps', () => {
      const timestamp = 1705318200000 // 2024-01-15T10:30:00Z
      const result = toPerthTime(timestamp)
      expect(result.getTime()).toBe(timestamp)
    })

    it('should return current date for invalid input', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = toPerthTime('invalid-date')
      expect(result.getTime()).toBeCloseTo(Date.now(), -3) // Within 1 second
      consoleSpy.mockRestore()
    })
  })

  describe('formatPerthTimestamp', () => {
    it('should format a valid date', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatPerthTimestamp(date)
      // Perth is UTC+8, so 10:30 UTC = 18:30 Perth
      expect(result).toMatch(/2024-01-15 18:30:00/)
    })

    it('should return current time for invalid input (toPerthTime fallback)', () => {
      // toPerthTime returns current date for invalid input, so formatPerthTimestamp formats it
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const before = Date.now()
      const result = formatPerthTimestamp('invalid')
      const after = Date.now()
      // Result should be a formatted date string (not "Invalid Date") because toPerthTime falls back to now
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      consoleSpy.mockRestore()
    })
  })

  describe('formatPerthDisplay', () => {
    it('should format for display with slashes', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatPerthDisplay(date)
      // Should be in DD/MM/YYYY HH:MM:SS format
      expect(result).toMatch(/15\/01\/2024 18:30:00/)
    })
  })

  describe('getPerthNow', () => {
    it('should return current time', () => {
      const now = Date.now()
      const result = getPerthNow()
      expect(result.getTime()).toBeCloseTo(now, -3) // Within 1 second
    })
  })

  describe('getPerthToday', () => {
    it('should return a valid YYYY-MM-DD string', () => {
      const result = getPerthToday()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return correct date for Perth timezone', () => {
      // Mock a specific UTC time
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T20:00:00Z')) // 04:00 next day in Perth

      const result = getPerthToday()
      expect(result).toBe('2024-01-16') // Perth is +8 hours, so it's already Jan 16

      vi.useRealTimers()
    })
  })

  describe('getPerthTomorrow', () => {
    it('should return tomorrow in Perth timezone', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T20:00:00Z'))

      const result = getPerthTomorrow()
      expect(result).toBe('2024-01-17')

      vi.useRealTimers()
    })
  })

  describe('getPerthYesterday', () => {
    it('should return yesterday in Perth timezone', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T20:00:00Z'))

      const result = getPerthYesterday()
      expect(result).toBe('2024-01-15') // Perth is Jan 16, so yesterday is Jan 15

      vi.useRealTimers()
    })
  })

  describe('getMinutesFromNowInPerth', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return 0 for current time', () => {
      const now = new Date('2024-01-15T10:00:00Z')
      const result = getMinutesFromNowInPerth(now)
      expect(result).toBe(0)
    })

    it('should return positive minutes for past time', () => {
      const pastTime = new Date('2024-01-15T09:30:00Z') // 30 minutes ago
      const result = getMinutesFromNowInPerth(pastTime)
      expect(result).toBe(30)
    })

    it('should return negative minutes for future time', () => {
      const futureTime = new Date('2024-01-15T10:30:00Z') // 30 minutes from now
      const result = getMinutesFromNowInPerth(futureTime)
      expect(result).toBe(-30)
    })
  })

  describe('formatPerthRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "Just now" for very recent times', () => {
      const justNow = new Date('2024-01-15T10:00:00Z')
      const result = formatPerthRelativeTime(justNow)
      expect(result).toBe('Just now')
    })

    it('should return minutes ago for times under 60 minutes', () => {
      const thirtyMinAgo = new Date('2024-01-15T09:30:00Z')
      const result = formatPerthRelativeTime(thirtyMinAgo)
      expect(result).toBe('30 min ago')
    })

    it('should return hours ago for times under 24 hours', () => {
      const twoHoursAgo = new Date('2024-01-15T08:00:00Z')
      const result = formatPerthRelativeTime(twoHoursAgo)
      expect(result).toBe('2h ago')
    })

    it('should return days ago for times under 7 days', () => {
      const twoDaysAgo = new Date('2024-01-13T10:00:00Z')
      const result = formatPerthRelativeTime(twoDaysAgo)
      expect(result).toBe('2d ago')
    })

    it('should show warning for future dates', () => {
      const futureTime = new Date('2024-01-15T10:30:00Z')
      const result = formatPerthRelativeTime(futureTime)
      expect(result).toContain('in future')
    })
  })

  describe('getDeviceStatus', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return online for recent readings (< 45 min)', () => {
      const recentReading = new Date('2024-01-15T09:30:00Z') // 30 min ago
      const result = getDeviceStatus(recentReading)
      expect(result.status).toBe('online')
      expect(result.colorClass).toContain('green')
    })

    it('should return stale for readings between 45 min and 4 hours', () => {
      const staleReading = new Date('2024-01-15T08:00:00Z') // 2 hours ago
      const result = getDeviceStatus(staleReading)
      expect(result.status).toBe('stale')
      expect(result.colorClass).toContain('yellow')
    })

    it('should return offline for readings over 4 hours old', () => {
      const oldReading = new Date('2024-01-15T05:00:00Z') // 5 hours ago
      const result = getDeviceStatus(oldReading)
      expect(result.status).toBe('offline')
      expect(result.colorClass).toContain('red')
    })

    it('should return no-data for null/undefined readings', () => {
      const result = getDeviceStatus(null as unknown as Date)
      expect(result.status).toBe('no-data')
      expect(result.colorClass).toContain('gray')
    })
  })

  describe('validateTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return valid for recent timestamp', () => {
      const recentTime = new Date('2024-01-15T09:30:00Z')
      const result = validateTimestamp(recentTime)
      expect(result.isValid).toBe(true)
      expect(result.isFuture).toBe(false)
      expect(result.isStale).toBe(false)
      expect(result.issues).toHaveLength(0)
    })

    it('should flag future timestamps', () => {
      const futureTime = new Date('2024-01-15T12:00:00Z') // 2 hours in future
      const result = validateTimestamp(futureTime)
      expect(result.isFuture).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]).toContain('future')
    })

    it('should flag stale timestamps when warnOnStale is true', () => {
      const staleTime = new Date('2024-01-13T10:00:00Z') // 2 days ago
      const result = validateTimestamp(staleTime, { warnOnStale: true })
      expect(result.isStale).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should not flag stale timestamps by default', () => {
      const staleTime = new Date('2024-01-13T10:00:00Z') // 2 days ago
      const result = validateTimestamp(staleTime)
      expect(result.isStale).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should flag suspicious years', () => {
      const oldDate = new Date('2019-01-15T10:00:00Z')
      const result = validateTimestamp(oldDate)
      expect(result.issues.some(i => i.includes('Suspicious year'))).toBe(true)
    })
  })

  describe('normalizeToPerthString', () => {
    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = normalizeToPerthString(date)
      expect(result).toMatch(/2024-01-15 18:30:00/)
    })

    it('should handle ISO strings', () => {
      const result = normalizeToPerthString('2024-01-15T10:30:00Z')
      expect(result).toMatch(/2024-01-15 18:30:00/)
    })

    it('should handle timestamps', () => {
      const timestamp = new Date('2024-01-15T10:30:00Z').getTime()
      const result = normalizeToPerthString(timestamp)
      expect(result).toMatch(/2024-01-15 18:30:00/)
    })

    it('should return empty string for null/undefined', () => {
      expect(normalizeToPerthString(null)).toBe('')
      expect(normalizeToPerthString(undefined)).toBe('')
    })

    it('should return Invalid Date for invalid input', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = normalizeToPerthString('not-a-date')
      expect(result).toBe('Invalid Date')
      consoleSpy.mockRestore()
    })
  })
})
