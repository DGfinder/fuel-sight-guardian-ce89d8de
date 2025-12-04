import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Eye, MoreVertical, ChevronDown, ChevronRight, ChevronUp, ArrowUpDown, EyeOff, Expand, Minimize2, Search } from 'lucide-react';
import { Tank } from '@/types/fuel';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { FixedSizeList as List } from 'react-window';
import PercentBar from './tables/PercentBar';
import EditDipModal from './modals/EditDipModal';
import { markTankServiced, unmarkTankServiced, supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useTankModal } from '@/contexts/TankModalContext';
import { formatPerthRelativeTime, formatPerthDisplay, getPerthToday } from '@/utils/timezone';
import { useIsMobile } from '@/hooks/use-mobile';
import { logger } from '@/lib/logger';
import { getFuelStatus, statusBadgeStyles, groupStatusColors, getDaysTextColor, FuelStatus } from '@/lib/fuel-colors';

const numberFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

const getStatusDisplayText = (status: FuelStatus): string => {
  switch (status) {
    case 'critical': return 'Critical';
    case 'low': return 'Low';
    case 'normal': return 'Normal';
    case 'unknown': return 'No Data';
    default: return 'Unknown';
  }
};

const StatusBadge: React.FC<{
  status: FuelStatus;
  percent?: number;
  daysToMin?: number | null;
}> = ({ status, percent, daysToMin }) => {
  // Determine the reason for the status
  const getStatusReason = () => {
    if (status === 'normal' || status === 'unknown') return null;

    const reasons: string[] = [];
    if (status === 'critical') {
      if (percent !== undefined && percent <= 10) reasons.push(`${percent}% (≤10%)`);
      if (daysToMin !== null && daysToMin !== undefined && daysToMin <= 1.5) {
        reasons.push(`${daysToMin.toFixed(1)} days (≤1.5)`);
      }
    } else if (status === 'low') {
      if (percent !== undefined && percent <= 20) reasons.push(`${percent}% (≤20%)`);
      if (daysToMin !== null && daysToMin !== undefined && daysToMin <= 2.5) {
        reasons.push(`${daysToMin.toFixed(1)} days (≤2.5)`);
      }
    }
    return reasons.length > 0 ? reasons.join(' & ') : null;
  };

  const reason = getStatusReason();

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('px-2 py-1 rounded text-xs font-semibold cursor-help', statusBadgeStyles[status])}>
            {getStatusDisplayText(status)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={cn('px-2 py-1 rounded text-xs font-semibold', statusBadgeStyles[status])}>
      {getStatusDisplayText(status)}
    </span>
  );
};

interface TankRowProps {
  tank: Tank;
  onClick: (tank: Tank) => void;
  todayBurnRate?: number;
  isMobile?: boolean;
  setEditDipTank: React.Dispatch<React.SetStateAction<Tank | null>>;
  setEditDipModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onServicedToggle: (tankId: string, serviced: boolean) => void;
  isServiced: boolean;
  today: string;
  onPrefetch?: () => void;
}

const fmt = (n: number | null | undefined) => typeof n === 'number' && !isNaN(n) ? n.toLocaleString('en-AU') : '—';

const TankRow: React.FC<TankRowProps & { suppressNextRowClick: React.MutableRefObject<boolean> }> = ({
  tank,
  onClick,
  todayBurnRate,
  isMobile,
  setEditDipTank,
  setEditDipModalOpen,
  onServicedToggle,
  isServiced,
  today,
  suppressNextRowClick,
  onPrefetch
}) => {
  // Calculate percentage above minimum level (not total percentage)
  const percent = useMemo(() => {
    if (typeof tank.current_level !== 'number' || typeof tank.min_level !== 'number' || typeof tank.safe_level !== 'number') {
      return null;
    }
    const usableCapacity = tank.safe_level - tank.min_level;
    const currentAboveMin = tank.current_level - tank.min_level;

    if (usableCapacity <= 0) return null;
    return Math.max(0, Math.round((currentAboveMin / usableCapacity) * 100));
  }, [tank.current_level, tank.min_level, tank.safe_level]);
  const status = useMemo(() => getFuelStatus(percent, tank.days_to_min_level), [percent, tank.days_to_min_level]);
  const lastDipTs = tank.last_dip?.created_at ? new Date(tank.last_dip.created_at) : null;
  const isDipOld = lastDipTs ? ((Date.now() - lastDipTs.getTime()) > 4 * 24 * 60 * 60 * 1000) : false;
  const ullage = typeof tank.safe_level === 'number' && typeof tank.current_level === 'number' ? tank.safe_level - tank.current_level : null;
  const rollingAvg = typeof tank.rolling_avg === 'number' ? tank.rolling_avg : null;
  const isRefillFlag = (tank as any)?.is_recent_refill === true;

  if (isMobile) {
    return (
      <AccordionItem value={tank.id}>
        <AccordionTrigger className="flex items-center gap-2 px-3 py-2">
          <Checkbox
            checked={isServiced}
            onCheckedChange={(checked) => {
              logger.debug('[TANK] Checkbox clicked:', { tankId: tank.id, checked, isServiced });
              onServicedToggle(tank.id, checked as boolean);
            }}
            className="h-4 w-4 text-green-700"
            onClick={(e) => {
              if (suppressNextRowClick.current) {
                suppressNextRowClick.current = false;
                return;
              }
              e.stopPropagation();
            }}
          />
          <span className="font-bold flex-1 text-left">{tank.location}</span>
          {percent !== null ? (
            <PercentBar percent={percent} />
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
          <StatusBadge status={status as 'critical' | 'low' | 'normal' | 'unknown'} percent={percent ?? undefined} daysToMin={tank.days_to_min_level} />
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2 text-sm px-3 pb-2">
            <span>Current Level:</span>
            <span className="text-right">{fmt(tank.current_level)} L</span>
            <span>Safe Level:</span>
            <span className="text-right">{fmt(tank.safe_level)} L</span>
            <span>Days to Min:</span>
            <span className={cn('text-right', getDaysTextColor(tank.days_to_min_level))}>{tank.days_to_min_level ?? '—'}</span>
            <span>Rolling Avg (L/day):</span>
            <span className="text-right">
              {typeof rollingAvg === 'number' && rollingAvg > 0
                ? <span>{Math.round(rollingAvg).toLocaleString()}</span>
                : '—'}
            </span>
            <span>Prev Day Used (L):</span>
            <span className="text-right">{typeof tank.prev_day_used === 'number' && tank.prev_day_used !== 0
              ? isRefillFlag
                ? <span className="text-green-600">Refill ↗</span>
                : <span>{Math.round(tank.prev_day_used).toLocaleString()}</span>
              : '—'}</span>
            <span>Last Dip:</span>
            <span className="text-right">
              {tank.last_dip?.created_at
                ? formatPerthRelativeTime(tank.last_dip.created_at)
                : '—'}
              {isDipOld && <AlertTriangle className="inline ml-1 text-red-500" size={16} />}
            </span>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <tr
            className={cn(
              'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer',
              'even:bg-gray-50/50 dark:even:bg-gray-800/50',
              isServiced && 'bg-gray-50 text-gray-400 hover:bg-gray-100/60 dark:bg-gray-800/60'
            )}
            onMouseEnter={onPrefetch}
            onClick={e => {
              if (suppressNextRowClick.current) {
                suppressNextRowClick.current = false;
                return;
              }
              if ((e.target as HTMLElement).closest('.kebab-menu') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
              onClick(tank);
            }}
          >
            <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-center">
              <Checkbox
                checked={isServiced}
                onCheckedChange={(checked) => {
                  logger.debug('[TANK] Checkbox clicked:', { tankId: tank.id, checked, isServiced });
                  onServicedToggle(tank.id, checked as boolean);
                }}
                className="h-4 w-4 text-green-700"
                onClick={(e) => {
                  if (suppressNextRowClick.current) {
                    suppressNextRowClick.current = false;
                    return;
                  }
                  e.stopPropagation();
                }}
              />
            </td>
            <td className="sticky left-[42px] z-10 bg-inherit px-3 py-2 font-bold">{tank.location}</td>
            <td className="px-3 py-2 text-center"><Badge variant="subtle">{tank.product_type}</Badge></td>
            <td className="px-3 py-2 text-center">
              <div className="flex flex-col items-center min-w-[100px]">
                <span className="font-semibold text-gray-900 tabular-nums">{fmt(tank.current_level)} L</span>
                <span className="text-xs text-gray-500 tabular-nums">/ {fmt(tank.safe_level)} L</span>
              </div>
            </td>
            <td className="px-3 py-2 text-center w-32">
              {percent !== null ? (
                <>
                  <PercentBar percent={percent} />
                  <span className="text-xs text-gray-700">{percent}%</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </td>
            <td className={cn('px-3 py-2 text-center', getDaysTextColor(tank.days_to_min_level))}>
              {tank.days_to_min_level ?? '—'}
            </td>
            <td className="px-3 py-2 text-center">
              {typeof rollingAvg === 'number' && rollingAvg !== 0
                ? <span>{Math.round(rollingAvg).toLocaleString()}</span>
                : '—'}
            </td>
            <td className="px-3 py-2 text-center">
              {typeof tank.prev_day_used === 'number' && tank.prev_day_used !== 0
                ? isRefillFlag 
                  ? <span className="text-green-600">Refill ↗</span>
                  : <span>{Math.round(tank.prev_day_used).toLocaleString()}</span>
                : '—'}
            </td>
            <td className="px-3 py-2 text-center"><StatusBadge status={status as 'critical' | 'low' | 'normal'} percent={percent} daysToMin={tank.days_to_min_level} /></td>
            <td className="px-3 py-2 text-center">
              {tank.last_dip?.created_at
                ? formatPerthRelativeTime(tank.last_dip.created_at)
                : '—'}
              {isDipOld && <AlertTriangle className="inline ml-1 text-red-500" size={16} />}
            </td>
            <td className="hidden md:table-cell px-3 py-2 text-right text-emerald-700">{fmt(ullage)}</td>
            <td className="px-3 py-2 text-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="kebab-menu"><MoreVertical size={16} /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => { /* TODO: Add Dip */ }}>Add Dip</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => {
                    logger.debug('[TANK] Edit Dip selected', tank);
                    suppressNextRowClick.current = true;
                    setEditDipTank(tank);
                    setEditDipModalOpen(true);
                  }}>Edit Dip</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        </TooltipTrigger>
        {isServiced && tank.serviced_by && (
          <TooltipContent>
            <p>Serviced by {tank.serviced_by} at {lastDipTs?.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

interface NestedGroupAccordionProps {
  tanks: Tank[];
  onTankClick: (tank: Tank) => void;
  todayBurnRate?: number;
  sortTanks: (t: Tank[]) => Tank[];
  SortButton: React.FC<{ field: string; children: React.ReactNode }>;
  setEditDipTank: React.Dispatch<React.SetStateAction<Tank | null>>;
  setEditDipModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onServicedToggle: (tankId: string, serviced: boolean) => void;
  isServiced: (tankId: string) => boolean;
  today: string;
  suppressNextRowClick: React.MutableRefObject<boolean>;
  isMobile: boolean;
  onPrefetchTank?: (tankId: string) => void;
}

const NestedGroupAccordion: React.FC<NestedGroupAccordionProps> = ({
  tanks,
  onTankClick,
  todayBurnRate,
  sortTanks,
  SortButton,
  setEditDipTank,
  setEditDipModalOpen,
  onServicedToggle,
  isServiced,
  today,
  suppressNextRowClick,
  isMobile,
  onPrefetchTank
}) => {
  // Group by group_name, then subgroup
  const grouped = useMemo(() => {
    const result: Record<string, { id: string; name: string; tanks: Tank[]; subGroups: { id: string; name: string; tanks: Tank[] }[]; shouldShowSubgroups: boolean }> = {};
    tanks.forEach(tank => {
      const group = tank.group_name || 'Other';
      const subgroup = tank.subgroup || 'No Subgroup';
      if (!result[group]) result[group] = { id: group, name: group, tanks: [], subGroups: [], shouldShowSubgroups: false };
      if (subgroup === 'No Subgroup') {
        result[group].tanks.push(tank);
      } else {
        let sg = result[group].subGroups.find(sg => sg.name === subgroup);
        if (!sg) {
          sg = { id: `${group}::${subgroup}`, name: subgroup, tanks: [] };
          result[group].subGroups.push(sg);
        }
        sg.tanks.push(tank);
      }
    });
    
    // Sort subgroups alphabetically within each group
    Object.values(result).forEach(group => {
      group.subGroups.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Determine which groups should show subgroups
    Object.values(result).forEach(group => {
      const totalTanks = group.tanks.length + group.subGroups.reduce((sum, sg) => sum + sg.tanks.length, 0);
      const hasMultipleSubgroups = group.subGroups.length > 1;
      const hasLargeSubgroups = group.subGroups.some(sg => sg.tanks.length > 10);
      
      // Force Kalgoorlie to always show subgroups as accordions
      if (group.name.toLowerCase().includes('kalgoorlie')) {
        group.shouldShowSubgroups = true;
      } else {
        group.shouldShowSubgroups = (
          (totalTanks > 20 && hasMultipleSubgroups) ||
          hasLargeSubgroups ||
          group.name.toLowerCase().includes('gsf') ||
          (group.subGroups.length > 0 && group.subGroups.some(sg => sg.name !== 'No Subgroup'))
        );
      }
      
      // If we're not showing subgroups, flatten all tanks into the main group
      if (!group.shouldShowSubgroups && group.subGroups.length > 0) {
        group.subGroups.forEach(sg => {
          group.tanks.push(...sg.tanks);
        });
        group.subGroups = [];
      }
    });
    
    // Convert to array and sort with Swan Transit first
    const groupsArray = Object.values(result);
    groupsArray.sort((a, b) => {
      if (a.name === 'Swan Transit') return -1;
      if (b.name === 'Swan Transit') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return groupsArray;
  }, [tanks]);

  // Helper function to calculate percent the same way as TankRow
  // This ensures group status matches individual row status
  const calculateTankPercent = (tank: Tank): number | null => {
    if (typeof tank.current_level !== 'number' ||
        typeof tank.min_level !== 'number' ||
        typeof tank.safe_level !== 'number') {
      return null;
    }
    const usableCapacity = tank.safe_level - tank.min_level;
    const currentAboveMin = tank.current_level - tank.min_level;
    if (usableCapacity <= 0) return null;
    return Math.max(0, Math.round((currentAboveMin / usableCapacity) * 100));
  };

  // Function to get group status based on tank conditions
  // Uses same percent calculation as TankRow for consistency
  const getGroupStatus = (groupTanks: Tank[]) => {
    const criticalTanks = groupTanks.filter(tank => {
      const percent = calculateTankPercent(tank);
      const days = tank.days_to_min_level;

      const percentCritical = percent !== null && percent <= 10;
      const daysCritical = typeof days === 'number' && days <= 1.5;

      return percentCritical || daysCritical;
    });

    const warningTanks = groupTanks.filter(tank => {
      const percent = calculateTankPercent(tank);
      const days = tank.days_to_min_level;

      const percentWarning = percent !== null && percent > 10 && percent <= 20;
      const daysWarning = typeof days === 'number' && days > 1.5 && days <= 2.5;

      return percentWarning || daysWarning;
    });

    if (criticalTanks.length > 0) return 'critical';
    if (warningTanks.length > 0) return 'warning';
    return 'normal';
  };

  // Function to get detailed group stats for inline display
  // Uses same percent calculation as TankRow for consistency
  const getGroupStats = (groupTanks: Tank[]) => {
    const criticalCount = groupTanks.filter(tank => {
      const percent = calculateTankPercent(tank);
      const days = tank.days_to_min_level;

      const percentCritical = percent !== null && percent <= 10;
      const daysCritical = typeof days === 'number' && days <= 1.5;

      return percentCritical || daysCritical;
    }).length;

    const warningCount = groupTanks.filter(tank => {
      const percent = calculateTankPercent(tank);
      const days = tank.days_to_min_level;

      const percentWarning = percent !== null && percent > 10 && percent <= 20;
      const daysWarning = typeof days === 'number' && days > 1.5 && days <= 2.5;

      return percentWarning || daysWarning;
    }).length;

    return { criticalCount, warningCount };
  };

  // Track expanded state for all subgroup accordions per group
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});
  const [expandedSubgroups, setExpandedSubgroups] = React.useState<Record<string, string[]>>({});

  const toggleAllSubgroups = (groupId: string, expand: boolean) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: expand }));
    const group = grouped.find(g => g.id === groupId);
    if (group) {
      const subgroupIds = group.subGroups.map(sg => sg.id);
      setExpandedSubgroups(prev => ({
        ...prev,
        [groupId]: expand ? subgroupIds : []
      }));
    }
  };

  return (
    <Accordion type="multiple" defaultValue={[]} className="w-full">
      {grouped.map(group => {
        const allGroupTanks = [...group.tanks, ...group.subGroups.flatMap(sg => sg.tanks)];
        const groupStatus = getGroupStatus(allGroupTanks);
        const { criticalCount, warningCount } = getGroupStats(allGroupTanks);
        const totalTanks = allGroupTanks.length;

        const statusColors = groupStatusColors;

        return (
          <AccordionItem value={group.id} key={group.id} className="border-none mb-3">
            <AccordionTrigger
              className={cn(
                "px-5 py-4 font-semibold text-gray-800",
                "sticky top-0 z-10",
                "backdrop-blur-md bg-white/80 border border-white/40",
                "rounded-xl shadow-lg hover:shadow-xl",
                "transition-all duration-300 hover:-translate-y-0.5",
                "flex items-center justify-between group",
                "border-l-4",
                statusColors[groupStatus]
              )}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-bold">{group.name}</span>

                {/* Tank count badge */}
                <Badge variant="outline" className="bg-white/80 text-gray-600 border-gray-200/50 shadow-sm">
                  {totalTanks} tanks
                </Badge>

                {/* Critical count - only if > 0 */}
                {criticalCount > 0 && (
                  <Badge className="bg-red-50/80 text-red-700 border border-red-200/50 shadow-sm backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 inline-block"></span>
                    {criticalCount} critical
                  </Badge>
                )}

                {/* Warning count - only if > 0 */}
                {warningCount > 0 && (
                  <Badge className="bg-amber-50/80 text-amber-700 border border-amber-200/50 shadow-sm backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5 inline-block"></span>
                    {warningCount} low
                  </Badge>
                )}

                {/* Subgroups badge - only show if more than 1 subgroup */}
                {group.shouldShowSubgroups && group.subGroups.length > 1 && (
                  <Badge className="bg-blue-50/80 text-blue-700 border border-blue-200/50 shadow-sm backdrop-blur-sm">
                    {group.subGroups.length} subgroups
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="bg-white dark:bg-gray-900 border-l-4 border-l-gray-200 ml-2">
              {/* Expand/Collapse all subgroups - only if > 1 subgroup */}
              {group.shouldShowSubgroups && group.subGroups.length > 1 && (
                <div className="flex items-center justify-between px-4 py-3 mb-2 bg-slate-50/80 backdrop-blur-sm rounded-lg border border-slate-100">
                  <span className="text-sm text-gray-600 font-medium">
                    {group.subGroups.length} locations
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs font-medium bg-white/80 hover:bg-white"
                    onClick={() => toggleAllSubgroups(group.id, !expandedGroups[group.id])}
                  >
                    {expandedGroups[group.id] ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 mr-1.5" />
                        Collapse All
                      </>
                    ) : (
                      <>
                        <Expand className="w-3.5 h-3.5 mr-1.5" />
                        Expand All
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Subgroups - only show if shouldShowSubgroups is true */}
              {group.shouldShowSubgroups && group.subGroups.length > 0 ? (
                <Accordion
                  type="multiple"
                  value={expandedSubgroups[group.id] || []}
                  onValueChange={(value) => setExpandedSubgroups(prev => ({...prev, [group.id]: value}))}
                  className="w-full"
                >
                  {group.subGroups.map(sub => {
                    const subStatus = getGroupStatus(sub.tanks);
                    const { criticalCount: subCritical, warningCount: subWarning } = getGroupStats(sub.tanks);

                    return (
                      <AccordionItem value={sub.id} key={sub.id} className="border-none mb-2">
                        <AccordionTrigger
                          className={cn(
                            "px-4 py-3 rounded-lg",
                            "backdrop-blur-sm shadow-sm",
                            "font-semibold transition-all duration-200",
                            "hover:shadow-md",
                            "flex items-center justify-between w-full",
                            // Solid border for visibility
                            "border",
                            // Status-aware colors with higher opacity
                            subStatus === 'critical' && "bg-red-50/90 border-red-200 text-red-900",
                            subStatus === 'warning' && "bg-amber-50/90 border-amber-200 text-amber-900",
                            subStatus === 'normal' && "bg-white/90 border-gray-200 text-gray-800"
                          )}
                        >
                          {/* Left side - Name */}
                          <span className="font-semibold text-left flex-1 min-w-0 truncate pr-4">
                            {sub.name}
                          </span>

                          {/* Right side - Badges in fixed order */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Tank count - always shown */}
                            <Badge variant="outline" className="bg-white/80 text-gray-600 border-gray-300">
                              {sub.tanks.length} tank{sub.tanks.length !== 1 ? 's' : ''}
                            </Badge>

                            {/* Critical count - only if > 0 */}
                            {subCritical > 0 && (
                              <Badge className="bg-red-100 text-red-700 border border-red-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 inline-block"></span>
                                {subCritical} critical
                              </Badge>
                            )}

                            {/* Warning count - only if > 0 */}
                            {subWarning > 0 && (
                              <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 inline-block"></span>
                                {subWarning} low
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                      <AccordionContent className="bg-white dark:bg-gray-900">
                        {/* Use virtualization for large subgroups */}
                        {sub.tanks.length > 50 ? (
                          <List
                            height={400}
                            itemCount={sub.tanks.length}
                            itemSize={48}
                            width={"100%"}
                          >
                            {({ index, style }: any) => (
                              <div style={style} key={sub.tanks[index].id}>
                                <table className="w-full">
                                  <tbody>
                                    <TankRow
                                      tank={sub.tanks[index]}
                                      onClick={onTankClick}
                                      todayBurnRate={todayBurnRate}
                                      setEditDipTank={setEditDipTank}
                                      setEditDipModalOpen={setEditDipModalOpen}
                                      onServicedToggle={onServicedToggle}
                                      isServiced={isServiced(sub.tanks[index].id)}
                                      today={today}
                                      isMobile={isMobile}
                                      suppressNextRowClick={suppressNextRowClick}
                                      onPrefetch={() => onPrefetchTank?.(sub.tanks[index].id)}
                                    />
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </List>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gray-50/90 backdrop-blur-sm font-semibold text-gray-600 text-xs uppercase tracking-wider sticky top-0 shadow-sm border-b border-gray-200/50">
                                  <th className="sticky left-0 z-10 bg-gray-50/90 backdrop-blur-sm px-3 py-3 text-center">
                                    <Checkbox
                                      checked={sub.tanks.every(tank => isServiced(tank.id))}
                                      onCheckedChange={(checked) => {
                                        sub.tanks.forEach(tank => {
                                          onServicedToggle(tank.id, checked as boolean);
                                        });
                                      }}
                                      className="h-4 w-4 text-green-700"
                                    />
                                  </th>
                                  <th className="sticky left-[42px] z-10 bg-gray-50/90 backdrop-blur-sm px-3 py-3 text-left">
                                    <SortButton field="location">Location / Tank</SortButton>
                                  </th>
                                  <th className="px-3 py-3 text-center">
                                    <SortButton field="product_type">Product</SortButton>
                                  </th>
                                  <th className="px-3 py-3 text-center">
                                    <SortButton field="current_level">Current Level</SortButton>
                                  </th>
                                  <th className="px-3 py-3 text-center">% Above Min</th>
                                  <th className="px-3 py-3 text-center">Days-to-Min</th>
                                  <th className="px-3 py-3 text-center">Rolling Avg</th>
                                  <th className="px-3 py-3 text-center">Prev Day</th>
                                  <th className="px-3 py-3 text-center">Status</th>
                                  <th className="px-3 py-3 text-center">Last Dip</th>
                                  <th className="hidden md:table-cell px-3 py-3 text-right">Ullage</th>
                                  <th className="px-3 py-3 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortTanks(sub.tanks).map(tank => (
                                  <TankRow
                                    key={tank.id}
                                    tank={tank}
                                    onClick={onTankClick}
                                    todayBurnRate={todayBurnRate}
                                    setEditDipTank={setEditDipTank}
                                    setEditDipModalOpen={setEditDipModalOpen}
                                    onServicedToggle={onServicedToggle}
                                    isServiced={isServiced(tank.id)}
                                    today={today}
                                    isMobile={isMobile}
                                    suppressNextRowClick={suppressNextRowClick}
                                    onPrefetch={() => onPrefetchTank?.(tank.id)}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : null}
              {/* Tanks not in subgroups OR all tanks when subgroups are flattened */}
              {group.tanks.length > 0 && (
                <>
                  {group.tanks.length > 200 ? (
                    // Use virtualization only for extremely large flat lists (>200 tanks)
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50/90 backdrop-blur-sm font-semibold text-gray-600 text-xs uppercase tracking-wider sticky top-0 shadow-sm border-b border-gray-200/50">
                            <th className="sticky left-0 z-10 bg-gray-50/90 backdrop-blur-sm px-3 py-3 text-center">
                              <Checkbox
                                checked={group.tanks.every(tank => isServiced(tank.id))}
                                onCheckedChange={(checked) => {
                                  group.tanks.forEach(tank => {
                                    onServicedToggle(tank.id, checked as boolean);
                                  });
                                }}
                                className="h-4 w-4 text-green-700"
                              />
                            </th>
                            <th className="sticky left-[42px] z-10 bg-gray-50/90 backdrop-blur-sm px-3 py-3 text-left">
                              <SortButton field="location">Location / Tank</SortButton>
                            </th>
                            <th className="px-3 py-3 text-center">
                              <SortButton field="product_type">Product</SortButton>
                            </th>
                            <th className="px-3 py-3 text-center">
                              <SortButton field="current_level">Current Level</SortButton>
                            </th>
                            <th className="px-3 py-3 text-center">% Above Min</th>
                            <th className="px-3 py-3 text-center">Days-to-Min</th>
                            <th className="px-3 py-3 text-center">Rolling Avg</th>
                            <th className="px-3 py-3 text-center">Prev Day</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Last Dip</th>
                            <th className="hidden md:table-cell px-3 py-3 text-right">Ullage</th>
                            <th className="px-3 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan={12} className="p-0">
                              <List
                                height={600}
                                itemCount={sortTanks(group.tanks).length}
                                itemSize={48}
                                width={"100%"}
                              >
                                {({ index, style }: any) => {
                                  const tank = sortTanks(group.tanks)[index];
                                  return (
                                    <div style={style} key={tank.id}>
                                      <table className="w-full">
                                        <tbody>
                                          <TankRow
                                            tank={tank}
                                            onClick={onTankClick}
                                            todayBurnRate={todayBurnRate}
                                            setEditDipTank={setEditDipTank}
                                            setEditDipModalOpen={setEditDipModalOpen}
                                            onServicedToggle={onServicedToggle}
                                            isServiced={isServiced(tank.id)}
                                            today={today}
                                            isMobile={isMobile}
                                            suppressNextRowClick={suppressNextRowClick}
                                            onPrefetch={() => onPrefetchTank?.(tank.id)}
                                          />
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                }}
                              </List>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Regular table for smaller lists
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50/90 backdrop-blur-sm font-semibold text-gray-600 text-xs uppercase tracking-wider sticky top-0 shadow-sm border-b border-gray-200/50">
                            <th className="sticky left-0 z-10 bg-gray-50/90 backdrop-blur-sm px-3 py-3 text-center">
                              <Checkbox
                                checked={group.tanks.every(tank => isServiced(tank.id))}
                                onCheckedChange={(checked) => {
                                  group.tanks.forEach(tank => {
                                    onServicedToggle(tank.id, checked as boolean);
                                  });
                                }}
                                className="h-4 w-4 text-green-700"
                              />
                            </th>
                            <th className="sticky left-[42px] z-10 bg-gray-50/90 backdrop-blur-sm px-3 py-3 text-left">
                              <SortButton field="location">Location / Tank</SortButton>
                            </th>
                            <th className="px-3 py-3 text-center">
                              <SortButton field="product_type">Product</SortButton>
                            </th>
                            <th className="px-3 py-3 text-center">
                              <SortButton field="current_level">Current Level</SortButton>
                            </th>
                            <th className="px-3 py-3 text-center">% Above Min</th>
                            <th className="px-3 py-3 text-center">Days-to-Min</th>
                            <th className="px-3 py-3 text-center">Rolling Avg</th>
                            <th className="px-3 py-3 text-center">Prev Day</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Last Dip</th>
                            <th className="hidden md:table-cell px-3 py-3 text-right">Ullage</th>
                            <th className="px-3 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortTanks(group.tanks).map(tank => (
                            <TankRow
                              key={tank.id}
                              tank={tank}
                              onClick={onTankClick}
                              todayBurnRate={todayBurnRate}
                              setEditDipTank={setEditDipTank}
                              setEditDipModalOpen={setEditDipModalOpen}
                              onServicedToggle={onServicedToggle}
                              isServiced={isServiced(tank.id)}
                              today={today}
                              isMobile={isMobile}
                              suppressNextRowClick={suppressNextRowClick}
                              onPrefetch={() => onPrefetchTank?.(tank.id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

export interface TankStatusTableProps {
  tanks: Tank[];
  onTankClick?: (tank: Tank) => void;
  todayBurnRate?: number;
  setEditDipTank: React.Dispatch<React.SetStateAction<Tank | null>>;
  setEditDipModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  suppressNextRowClick?: React.MutableRefObject<boolean>;
}

export const TankStatusTable = React.memo<TankStatusTableProps>(({
  tanks,
  onTankClick,
  todayBurnRate,
  setEditDipTank,
  setEditDipModalOpen,
  suppressNextRowClick: externalSuppressNextRowClick
}) => {
  const [sortConfig, setSortConfig] = useState<{ field: string | null; direction: 'asc' | 'desc' }>({ field: 'location', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [hideServiced, setHideServiced] = useState(false);
  const queryClient = useQueryClient();
  const { openModal } = useTankModal();
  const isMobile = useIsMobile();

  const today = getPerthToday();

  // Check if a tank is serviced today
  const isServiced = useCallback((tankId: string) => {
    const tank = tanks.find(t => t.id === tankId);
    return tank?.serviced_on === today;
  }, [tanks, today]);

  // Handle serviced toggle
  const handleServicedToggle = useCallback(async (tankId: string, serviced: boolean) => {
    logger.debug('[TANK] handleServicedToggle called:', { tankId, serviced });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      logger.debug('[TANK] User:', user);
      if (!user) return;

      if (serviced) {
        logger.debug('[TANK] Marking tank as serviced');
        await markTankServiced(tankId, user.id);
      } else {
        logger.debug('[TANK] Unmarking tank as serviced');
        await unmarkTankServiced(tankId);
      }

      // Invalidate and refetch tanks data
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    } catch (error) {
      logger.error('[TANK] Error toggling tank serviced status:', error);
    }
  }, [queryClient]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setHideServiced(prev => !prev);
      }
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTankClick = useCallback((tank: Tank) => {
    logger.debug('[TANK] Table row clicked:', { id: tank.id, location: tank.location, group_id: tank.group_id });
    setEditDipModalOpen(false);
    setEditDipTank(null);
    openModal(tank);
    onTankClick?.(tank);
  }, [onTankClick, openModal, setEditDipModalOpen, setEditDipTank]);

  // Prefetch tank dip readings on hover for instant modal loading
  const prefetchTankDips = useCallback((tankId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['ta-dip-readings', { tankId }],
      queryFn: async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const { data } = await supabase
          .from('ta_tank_dips')
          .select('*')
          .eq('tank_id', tankId)
          .is('archived_at', null)
          .gte('measured_at', startDate.toISOString())
          .order('measured_at', { ascending: false })
          .limit(50);
        return data || [];
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  }, [queryClient]);

  // Sorting logic for tanks within a group/subgroup
  const sortTanks = useCallback((tanksToSort: Tank[]) => {
    const field = (sortConfig.field || 'location') as keyof Tank; // Default to location
    return [...tanksToSort].sort((a, b) => {
      let aValue = a[field] as unknown as string | number | undefined;
      let bValue = b[field] as unknown as string | number | undefined;
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortConfig]);

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortButton: React.FC<{ field: string; children: React.ReactNode }> = ({ field, children }) => {
    const isActive = sortConfig.field === field;
    return (
      <button type="button" className="flex items-center gap-1" onClick={() => handleSort(field)}>
        {children}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-50" />
        )}
      </button>
    );
  };

  // Filter tanks based on search term and hide serviced
  const filteredTanks = useMemo(() => {
    let filtered = tanks;
    
    if (searchTerm) {
      filtered = filtered.filter(tank => 
        tank.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.group_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (hideServiced) {
      filtered = filtered.filter(tank => tank.serviced_on !== today);
    }
    
    return filtered;
  }, [tanks, searchTerm, hideServiced, today]);

  const localSuppressNextRowClick = useRef(false);
  const suppressNextRowClick = externalSuppressNextRowClick || localSuppressNextRowClick;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by location or group"
            className="pl-10 backdrop-blur-sm bg-white/70 border-white/30 shadow-sm focus:shadow-md transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Hide serviced button - disabled until functionality is implemented
        <Button
          size="sm"
          variant={hideServiced ? "default" : "outline"}
          onClick={() => setHideServiced(p => !p)}
          className={cn(
            "flex items-center gap-2 transition-all",
            hideServiced
              ? "bg-[#008457] text-white hover:bg-[#008457]/90"
              : "backdrop-blur-sm bg-white/70 hover:bg-white/90"
          )}
        >
          {hideServiced ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {hideServiced ? 'Show all' : 'Hide serviced'}
        </Button>
        */}
      </div>
      
      <NestedGroupAccordion
        tanks={filteredTanks}
        onTankClick={handleTankClick}
        todayBurnRate={todayBurnRate}
        sortTanks={sortTanks}
        SortButton={SortButton}
        setEditDipTank={setEditDipTank}
        setEditDipModalOpen={setEditDipModalOpen}
        onServicedToggle={handleServicedToggle}
        isServiced={isServiced}
        today={today}
        suppressNextRowClick={suppressNextRowClick}
        isMobile={isMobile}
        onPrefetchTank={prefetchTankDips}
      />
    </div>
  );
}); 