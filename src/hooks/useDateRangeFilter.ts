import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface DateRangeState {
  startDate: Date | null;
  endDate: Date | null;
}

interface UseDateRangeFilterResult {
  startDate: Date | null;
  endDate: Date | null;
  setDateRange: (startDate: Date | null, endDate: Date | null) => void;
  clearDateRange: () => void;
  isFiltered: boolean;
  urlParams: {
    startDate: string | null;
    endDate: string | null;
  };
}

/**
 * Custom hook for managing date range filtering with URL persistence
 */
export const useDateRangeFilter = (
  defaultStartDate: Date | null = null,
  defaultEndDate: Date | null = null
): UseDateRangeFilterResult => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRangeState] = useState<DateRangeState>({
    startDate: defaultStartDate,
    endDate: defaultEndDate
  });

  // Parse date from URL parameter
  const parseDateFromUrl = useCallback((dateString: string | null): Date | null => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }, []);

  // Format date for URL parameter
  const formatDateForUrl = useCallback((date: Date | null): string | null => {
    if (!date) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }, []);

  // Initialize state from URL parameters on mount
  useEffect(() => {
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');
    
    const startDate = parseDateFromUrl(startParam) || defaultStartDate;
    const endDate = parseDateFromUrl(endParam) || defaultEndDate;
    
    setDateRangeState({ startDate, endDate });
  }, []); // Only run on mount

  // Update URL parameters when date range changes
  const updateUrlParams = useCallback((startDate: Date | null, endDate: Date | null) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (startDate) {
      newParams.set('startDate', formatDateForUrl(startDate)!);
    } else {
      newParams.delete('startDate');
    }
    
    if (endDate) {
      newParams.set('endDate', formatDateForUrl(endDate)!);
    } else {
      newParams.delete('endDate');
    }
    
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, formatDateForUrl]);

  // Set date range and update URL
  const setDateRange = useCallback((startDate: Date | null, endDate: Date | null) => {
    // Validate date range
    if (startDate && endDate && startDate > endDate) {
      console.warn('Start date cannot be after end date');
      return;
    }
    
    setDateRangeState({ startDate, endDate });
    updateUrlParams(startDate, endDate);
  }, [updateUrlParams]);

  // Clear date range
  const clearDateRange = useCallback(() => {
    setDateRangeState({ startDate: null, endDate: null });
    updateUrlParams(null, null);
  }, [updateUrlParams]);

  // Check if any filter is applied
  const isFiltered = Boolean(dateRange.startDate || dateRange.endDate);

  // Get current URL parameter values
  const urlParams = {
    startDate: formatDateForUrl(dateRange.startDate),
    endDate: formatDateForUrl(dateRange.endDate)
  };

  return {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    setDateRange,
    clearDateRange,
    isFiltered,
    urlParams
  };
};

/**
 * Hook for managing date range with local storage persistence
 */
export const useDateRangeFilterWithStorage = (
  storageKey: string = 'captive-payments-date-filter',
  defaultStartDate: Date | null = null,
  defaultEndDate: Date | null = null
): UseDateRangeFilterResult => {
  const urlResult = useDateRangeFilter(defaultStartDate, defaultEndDate);
  
  // Save to local storage when date range changes
  useEffect(() => {
    if (urlResult.isFiltered) {
      const storageData = {
        startDate: urlResult.startDate?.toISOString() || null,
        endDate: urlResult.endDate?.toISOString() || null,
        timestamp: Date.now()
      };
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(storageData));
      } catch (error) {
        console.warn('Failed to save date range to localStorage:', error);
      }
    }
  }, [urlResult.startDate, urlResult.endDate, urlResult.isFiltered, storageKey]);

  // Load from local storage on mount if no URL params
  useEffect(() => {
    if (!urlResult.isFiltered) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          
          // Only use stored data if it's less than a week old
          if (data.timestamp > oneWeekAgo) {
            const startDate = data.startDate ? new Date(data.startDate) : null;
            const endDate = data.endDate ? new Date(data.endDate) : null;
            
            if (startDate || endDate) {
              urlResult.setDateRange(startDate, endDate);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load date range from localStorage:', error);
      }
    }
  }, []); // Only run on mount

  return urlResult;
};

export default useDateRangeFilter;