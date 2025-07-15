/**
 * Optimized tank filtering and search hook
 * Separates filtering logic from main data fetching to improve performance
 */

import { useMemo } from 'react';
import { useTanks, Tank } from './useTanks';

export interface FilterOptions {
  searchTerm?: string;
  groupIds?: string[];
  statusFilter?: 'all' | 'critical' | 'low' | 'normal';
  sortBy?: 'location' | 'level' | 'days_to_min' | 'group';
  sortOrder?: 'asc' | 'desc';
}

export function useTanksFilter(filters: FilterOptions = {}) {
  const { tanks, isLoading, error, ...rest } = useTanks();

  const filteredTanks = useMemo(() => {
    if (!tanks) return [];

    let result = [...tanks];

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(tank => 
        tank.location?.toLowerCase().includes(searchLower) ||
        tank.group_name?.toLowerCase().includes(searchLower) ||
        tank.id.toLowerCase().includes(searchLower)
      );
    }

    // Apply group filter
    if (filters.groupIds && filters.groupIds.length > 0) {
      result = result.filter(tank => 
        tank.group_id && filters.groupIds!.includes(tank.group_id)
      );
    }

    // Apply status filter
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      result = result.filter(tank => {
        const level = tank.current_level_percent || 0;
        switch (filters.statusFilter) {
          case 'critical':
            return level <= 20;
          case 'low':
            return level > 20 && level <= 40;
          case 'normal':
            return level > 40;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    if (filters.sortBy) {
      result.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (filters.sortBy) {
          case 'location':
            aValue = a.location || '';
            bValue = b.location || '';
            break;
          case 'level':
            aValue = a.current_level_percent || 0;
            bValue = b.current_level_percent || 0;
            break;
          case 'days_to_min':
            aValue = a.days_to_min_level || 0;
            bValue = b.days_to_min_level || 0;
            break;
          case 'group':
            aValue = a.group_name || '';
            bValue = b.group_name || '';
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return filters.sortOrder === 'desc' ? -comparison : comparison;
        } else {
          const comparison = aValue - bValue;
          return filters.sortOrder === 'desc' ? -comparison : comparison;
        }
      });
    }

    return result;
  }, [tanks, filters.searchTerm, filters.groupIds, filters.statusFilter, filters.sortBy, filters.sortOrder]);

  // Memoized filter statistics
  const filterStats = useMemo(() => {
    if (!tanks) return { total: 0, filtered: 0, hidden: 0 };
    
    return {
      total: tanks.length,
      filtered: filteredTanks.length,
      hidden: tanks.length - filteredTanks.length,
    };
  }, [tanks, filteredTanks]);

  return {
    tanks: filteredTanks,
    isLoading,
    error,
    filterStats,
    ...rest,
  };
}

/**
 * Hook for getting tank groups for filter dropdown
 */
export function useTankGroups() {
  const { tanks, isLoading } = useTanks();

  const groups = useMemo(() => {
    if (!tanks) return [];
    
    const groupMap = new Map<string, { id: string; name: string; count: number }>();
    
    tanks.forEach(tank => {
      if (tank.group_id && tank.group_name) {
        const existing = groupMap.get(tank.group_id);
        if (existing) {
          existing.count++;
        } else {
          groupMap.set(tank.group_id, {
            id: tank.group_id,
            name: tank.group_name,
            count: 1,
          });
        }
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tanks]);

  return { groups, isLoading };
}

export default useTanksFilter;