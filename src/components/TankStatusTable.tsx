import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Eye, MoreVertical, ChevronDown, ChevronRight, ChevronUp, ArrowUpDown, EyeOff, Expand, Minimize2 } from 'lucide-react';
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

const numberFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

function getStatus(percent: number, days: number | null): 'critical' | 'low' | 'normal' {
  // Critical: Immediate action required (≤1.5 days OR ≤10% fuel)
  if (percent <= 0.1 || (days !== null && days <= 1.5)) return 'critical';
  
  // Low: Schedule soon (≤2.5 days OR ≤20% fuel)
  if (percent <= 0.2 || (days !== null && days <= 2.5)) return 'low';
  
  // Normal: No immediate concern (>2.5 days AND >20% fuel)
  return 'normal';
}

const statusStyles = {
  critical: 'bg-red-500/10 text-red-700',
  low: 'bg-amber-400/20 text-amber-700',
  normal: 'bg-emerald-500/10 text-emerald-700',
};

const StatusBadge: React.FC<{ status: 'critical' | 'low' | 'normal' }> = ({ status }) => (
  <span className={cn('px-2 py-1 rounded text-xs font-semibold', statusStyles[status])}>
    {status === 'normal' ? 'Normal' : status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

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
  suppressNextRowClick
}) => {
  // Calculate percentage above minimum level (not total percentage)
  const percent = useMemo(() => {
    if (typeof tank.current_level !== 'number' || typeof tank.min_level !== 'number' || typeof tank.safe_level !== 'number') {
      return 0;
    }
    const usableCapacity = tank.safe_level - tank.min_level;
    const currentAboveMin = tank.current_level - tank.min_level;
    
    if (usableCapacity <= 0) return 0;
    return Math.max(0, Math.round((currentAboveMin / usableCapacity) * 100));
  }, [tank.current_level, tank.min_level, tank.safe_level]);
  const status = useMemo(() => {
    if (tank.days_to_min_level !== null && tank.days_to_min_level !== undefined && tank.days_to_min_level <= 2) return 'critical';
    if (tank.days_to_min_level !== null && tank.days_to_min_level !== undefined && tank.days_to_min_level <= 5) return 'low';
    if (percent <= 10) return 'critical';
    if (percent <= 20) return 'low';
    return 'normal';
  }, [percent, tank.days_to_min_level]);
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
              console.log('Checkbox clicked:', { tankId: tank.id, checked, isServiced });
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
          <PercentBar percent={percent} />
          <StatusBadge status={status as 'critical' | 'low' | 'normal'} />
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2 text-sm px-3 pb-2">
            <span>Current Level:</span>
            <span className="text-right">{fmt(tank.current_level)} L</span>
            <span>Safe Level:</span>
            <span className="text-right">{fmt(tank.safe_level)} L</span>
            <span>Days to Min:</span>
            <span className={cn('text-right', status === 'critical' ? 'text-red-500' : status === 'low' ? 'text-amber-500' : '')}>{tank.days_to_min_level ?? '—'}</span>
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
                  console.log('Checkbox clicked:', { tankId: tank.id, checked, isServiced });
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
              <PercentBar percent={percent} />
              <span className="text-xs text-gray-700">{percent}%</span>
            </td>
            <td className={cn('px-3 py-2 text-center',
              typeof tank.days_to_min_level === 'number' && tank.days_to_min_level <= 2 ? 'text-red-500' :
              typeof tank.days_to_min_level === 'number' && tank.days_to_min_level <= 5 ? 'text-amber-500' : 'text-gray-500')
            }>
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
            <td className="px-3 py-2 text-center"><StatusBadge status={status as 'critical' | 'low' | 'normal'} /></td>
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
                    console.log('Edit Dip selected', tank);
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
  suppressNextRowClick
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

  // Function to get group status based on tank conditions
  const getGroupStatus = (groupTanks: Tank[]) => {
    const allTanks = [...groupTanks];
    
    const criticalTanks = allTanks.filter(tank => {
      const percent = typeof tank.current_level_percent === 'number' ? tank.current_level_percent : 0;
      return percent <= 10 || (typeof tank.days_to_min_level === 'number' && tank.days_to_min_level <= 2);
    });
    
    const warningTanks = allTanks.filter(tank => {
      const percent = typeof tank.current_level_percent === 'number' ? tank.current_level_percent : 0;
      return (percent > 10 && percent <= 20) || (typeof tank.days_to_min_level === 'number' && tank.days_to_min_level > 2 && tank.days_to_min_level <= 5);
    });

    if (criticalTanks.length > 0) return 'critical';
    if (warningTanks.length > 0) return 'warning';
    return 'normal';
  };

  // Responsive: detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Track expanded state for all subgroup accordions per group
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  const toggleAllSubgroups = (groupId: string, expand: boolean) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: expand }));
  };

  return (
    <Accordion type="multiple" defaultValue={[]} className="w-full">
      {grouped.map(group => {
        const allGroupTanks = [...group.tanks, ...group.subGroups.flatMap(sg => sg.tanks)];
        const groupStatus = getGroupStatus(allGroupTanks);
        const totalTanks = allGroupTanks.length;
        
        const statusColors = {
          critical: 'border-l-red-500 bg-red-50/50 hover:bg-red-50',
          warning: 'border-l-amber-500 bg-amber-50/50 hover:bg-amber-50',
          normal: 'border-l-green-500 bg-green-50/50 hover:bg-green-50'
        };

        return (
          <AccordionItem value={group.id} key={group.id} className="border-none mb-2">
            <AccordionTrigger className={`px-6 py-4 font-semibold text-gray-800 sticky top-0 z-10 shadow-sm border border-gray-200 rounded-lg flex items-center justify-between group transition-all duration-200 border-l-4 ${statusColors[groupStatus]}`}>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold">{group.name}</span>
                <Badge variant="outline" className="bg-white/80 text-gray-600 border-gray-300">
                  {totalTanks} tanks
                </Badge>
                {group.shouldShowSubgroups && group.subGroups.length > 0 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {group.subGroups.length} subgroups
                  </Badge>
                )}
              </div>
              {group.shouldShowSubgroups && group.subGroups.length > 0 && (
                <div className="flex items-center gap-2 mr-2">
                  {expandedGroups[group.id] ? (
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={(e) => { e.stopPropagation(); toggleAllSubgroups(group.id, false); }}>
                      <Minimize2 className="w-4 h-4 mr-1" /> Collapse all
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={(e) => { e.stopPropagation(); toggleAllSubgroups(group.id, true); }}>
                      <Expand className="w-4 h-4 mr-1" /> Expand all
                    </Button>
                  )}
                </div>
              )}
            </AccordionTrigger>
            <AccordionContent className="bg-white dark:bg-gray-900 border-l-4 border-l-gray-200 ml-2">
              {/* Subgroups - only show if shouldShowSubgroups is true */}
              {group.shouldShowSubgroups && group.subGroups.length > 0 ? (
                <Accordion type="multiple" defaultValue={expandedGroups[group.id] ? group.subGroups.map(sg => sg.id) : []} className="w-full">
                  {group.subGroups.map(sub => (
                    <AccordionItem value={sub.id} key={sub.id} className="border-none">
                      <AccordionTrigger className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center gap-3">
                        {sub.name}
                        <Badge variant="outline" className="bg-gray-100 text-gray-700">
                          {sub.tanks.length} tank{sub.tanks.length !== 1 ? 's' : ''}
                        </Badge>
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
                                <tr className="bg-white dark:bg-gray-900 font-semibold text-gray-700 sticky top-0 shadow-xs">
                                  <th className="sticky left-0 z-10 bg-inherit px-3 py-3 text-center">
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
                                  <th className="sticky left-[42px] z-10 bg-inherit px-3 py-3 text-left">
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
                                  <th className="px-3 py-3 text-center">Rolling Avg (L/day)</th>
                                  <th className="px-3 py-3 text-center">Prev Day Used (L)</th>
                                  <th className="px-3 py-3 text-center">Status</th>
                                  <th className="px-3 py-3 text-center">Last Dip</th>
                                  <th className="hidden md:table-cell px-3 py-3 text-right">Ullage (L)</th>
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
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
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
                          <tr className="bg-white dark:bg-gray-900 font-semibold text-gray-700 sticky top-0 shadow-xs">
                            <th className="sticky left-0 z-10 bg-inherit px-3 py-3 text-center">
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
                            <th className="sticky left-[42px] z-10 bg-inherit px-3 py-3 text-left">
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
                            <th className="px-3 py-3 text-center">Rolling Avg (L/day)</th>
                            <th className="px-3 py-3 text-center">Prev Day Used (L)</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Last Dip</th>
                            <th className="hidden md:table-cell px-3 py-3 text-right">Ullage (L)</th>
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
                          <tr className="bg-white dark:bg-gray-900 font-semibold text-gray-700 sticky top-0 shadow-xs">
                            <th className="sticky left-0 z-10 bg-inherit px-3 py-3 text-center">
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
                            <th className="sticky left-[42px] z-10 bg-inherit px-3 py-3 text-left">
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
                            <th className="px-3 py-3 text-center">Rolling Avg (L/day)</th>
                            <th className="px-3 py-3 text-center">Prev Day Used (L)</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Last Dip</th>
                            <th className="hidden md:table-cell px-3 py-3 text-right">Ullage (L)</th>
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

export const TankStatusTable: React.FC<TankStatusTableProps> = ({ 
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
  
  const today = getPerthToday();

  // Check if a tank is serviced today
  const isServiced = useCallback((tankId: string) => {
    const tank = tanks.find(t => t.id === tankId);
    return tank?.serviced_on === today;
  }, [tanks, today]);

  // Handle serviced toggle
  const handleServicedToggle = useCallback(async (tankId: string, serviced: boolean) => {
    console.log('handleServicedToggle called:', { tankId, serviced });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('User:', user);
      if (!user) return;

      if (serviced) {
        console.log('Marking tank as serviced');
        await markTankServiced(tankId, user.id);
      } else {
        console.log('Unmarking tank as serviced');
        await unmarkTankServiced(tankId);
      }
      
      // Invalidate and refetch tanks data
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    } catch (error) {
      console.error('Error toggling tank serviced status:', error);
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
    console.log('=== TABLE ROW CLICKED ===');
    console.log('Tank clicked:', tank);
    console.log('Tank ID:', tank.id);
    console.log('Tank group_id:', tank.group_id);
    setEditDipModalOpen(false);
    setEditDipTank(null);
    openModal(tank);
    onTankClick?.(tank);
  }, [onTankClick, openModal, setEditDipModalOpen, setEditDipTank]);

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
        <Input 
          placeholder="Search by location or group" 
          className="flex-1" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setHideServiced(p => !p)}
          className="flex items-center gap-2"
        >
          {hideServiced ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {hideServiced ? 'Show all' : 'Hide serviced'}
        </Button>
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
      />
    </div>
  );
}; 