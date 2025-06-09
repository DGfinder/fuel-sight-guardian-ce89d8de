import React, { useState, useMemo, useCallback } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Eye, MoreVertical, ChevronDown, ChevronRight, ChevronUp, ArrowUpDown } from 'lucide-react';
import { Tank } from '@/types/fuel';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { FixedSizeList as List } from 'react-window';
import PercentBar from './tables/PercentBar';
import EditDipModal from './modals/EditDipModal';

const numberFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

function getStatus(percent: number, days: number | null): 'critical' | 'low' | 'normal' {
  if (percent < 0.2 || (days !== null && days <= 2)) return 'critical';
  if (percent < 0.4 || (days !== null && days <= 5)) return 'low';
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
}

const fmt = (n: number | null | undefined) => typeof n === 'number' && !isNaN(n) ? n.toLocaleString('en-AU') : '—';

const TankRow: React.FC<TankRowProps> = ({ tank, onClick, todayBurnRate, isMobile }) => {
  const percent = typeof tank.current_level_percent === 'number' ? Math.round(tank.current_level_percent * 100) : 0;
  const status = useMemo(() => {
    if (tank.days_to_min_level !== null && tank.days_to_min_level <= 2) return 'critical';
    if (tank.days_to_min_level !== null && tank.days_to_min_level <= 5) return 'low';
    if (tank.current_level_percent < 0.2) return 'critical';
    if (tank.current_level_percent < 0.4) return 'low';
    return 'normal';
  }, [tank.current_level_percent, tank.days_to_min_level]);
  const lastDipTs = tank.last_dip_ts ? new Date(tank.last_dip_ts) : null;
  const isDipOld = lastDipTs ? ((Date.now() - lastDipTs.getTime()) > 4 * 24 * 60 * 60 * 1000) : false;
  const ullage = tank.safe_fill - tank.current_level;
  const rollingAvg = typeof tank.rolling_avg_lpd === 'number' ? tank.rolling_avg_lpd : null;

  if (isMobile) {
    return (
      <AccordionItem value={tank.id}>
        <AccordionTrigger className="flex items-center gap-2 px-3 py-2">
          <span className="font-bold flex-1 text-left">{tank.location}</span>
          <PercentBar percent={percent} />
          <StatusBadge status={status as 'critical' | 'low' | 'normal'} />
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2 text-sm px-3 pb-2">
            <span>Current Level:</span>
            <span className="text-right">{fmt(tank.current_level)} L</span>
            <span>Safe Level:</span>
            <span className="text-right">{fmt(tank.safe_fill)} L</span>
            <span>Days to Min:</span>
            <span className={cn('text-right', status === 'critical' ? 'text-red-500' : status === 'low' ? 'text-amber-500' : '')}>{tank.days_to_min_level ?? '—'}</span>
            <span>Rolling Avg (L/day):</span>
            <span className="text-right">{rollingAvg === null ? '—' : rollingAvg > 0 ? <span className="text-emerald-600">Refill ↑</span> : <>{Math.abs(rollingAvg)} ↓</>}</span>
            <span>Last Dip:</span>
            <span className="text-right">{lastDipTs ? (lastDipTs.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + (tank.last_dip_user ? (' by ' + tank.last_dip_user) : '')) : '—'}{isDipOld && <AlertTriangle className="inline ml-1 text-red-500" size={16} />}</span>
            <span>Ullage (L):</span>
            <span className="text-right text-emerald-700">{fmt(ullage)}</span>
          </div>
          <div className="flex justify-end gap-2 px-3 pb-2">
            <Button variant="ghost" size="icon" onClick={() => onClick(tank)}><Eye size={16} /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => { /* TODO: Add Dip */ }}>Add Dip</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setEditDipTank(tank); setEditDipModalOpen(true); }}>Edit Dip</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <tr
      className={cn('hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors', 'even:bg-gray-50/50 dark:even:bg-gray-800/50 cursor-pointer')}
      onClick={e => {
        if ((e.target as HTMLElement).closest('.kebab-menu')) return;
        onClick(tank);
      }}
    >
      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-bold">{tank.location}</td>
      <td className="px-3 py-2 text-center"><Badge variant="secondary">{tank.product}</Badge></td>
      <td className="px-3 py-2 text-right">
        <div className="flex flex-col items-end">
          <span className="font-semibold">{fmt(tank.current_level)} L</span>
          <span className="text-xs text-gray-500">/ {fmt(tank.safe_fill)} L</span>
        </div>
      </td>
      <td className="px-3 py-2 text-center w-32">
        <PercentBar percent={percent} />
        <span className="text-xs text-gray-700">{percent}%</span>
      </td>
      <td className={cn('px-3 py-2 text-center',
        tank.days_to_min_level !== null && tank.days_to_min_level <= 2 ? 'text-red-500' :
        tank.days_to_min_level !== null && tank.days_to_min_level <= 5 ? 'text-amber-500' : 'text-gray-500')
      }>
        {tank.days_to_min_level ?? '—'}
      </td>
      <td className="px-3 py-2 text-center">
        {rollingAvg === null ? '—'
          : rollingAvg > 0 ? <span className="text-emerald-600">Refill ↑</span>
          : <span>-{Math.abs(rollingAvg)}</span>}
      </td>
      <td className="px-3 py-2 text-center"><StatusBadge status={status as 'critical' | 'low' | 'normal'} /></td>
      <td className="px-3 py-2 text-center">
        {lastDipTs ? (lastDipTs.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + (tank.last_dip_user ? (' by ' + tank.last_dip_user) : '')) : '—'}
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
            <DropdownMenuItem onSelect={() => { setEditDipTank(tank); setEditDipModalOpen(true); }}>Edit Dip</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

interface NestedGroupAccordionProps {
  tanks: Tank[];
  onTankClick: (tank: Tank) => void;
  todayBurnRate?: number;
  sortTanks: (t: Tank[]) => Tank[];
  SortButton: any;
}

const NestedGroupAccordion: React.FC<NestedGroupAccordionProps> = ({ tanks, onTankClick, todayBurnRate, sortTanks, SortButton }) => {
  // Group by group_name, then subgroup
  const grouped = useMemo(() => {
    const result: Record<string, { id: string; name: string; tanks: Tank[]; subGroups: { id: string; name: string; tanks: Tank[] }[] }> = {};
    tanks.forEach(tank => {
      const group = tank.group_name || 'Other';
      const subgroup = tank.subgroup || 'No Subgroup';
      if (!result[group]) result[group] = { id: group, name: group, tanks: [], subGroups: [] };
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
    return Object.values(result);
  }, [tanks]);

  // Responsive: detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <Accordion type="multiple" defaultValue={[]} className="w-full">
      {grouped.map(group => (
        <AccordionItem value={group.id} key={group.id} className="border-none">
          <AccordionTrigger className="bg-gray-50 px-4 py-3 font-semibold text-gray-700 sticky top-0 z-10 shadow-xs flex items-center gap-2">
            {group.name}
            <Badge variant="outline" className="bg-gray-50 text-gray-700 ml-2">{group.tanks.length + group.subGroups.reduce((acc, sg) => acc + sg.tanks.length, 0)} tanks</Badge>
          </AccordionTrigger>
          <AccordionContent className="bg-white dark:bg-gray-900">
            {/* Subgroups */}
            {group.subGroups.length > 0 ? (
              <Accordion type="multiple" defaultValue={[]} className="w-full">
                {group.subGroups.map(sub => (
                  <AccordionItem value={sub.id} key={sub.id} className="border-none">
                    <AccordionTrigger className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center gap-2">
                      {sub.name}
                      <Badge variant="outline" className="bg-gray-100 text-gray-700 ml-2">{sub.tanks.length}</Badge>
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
                          {({ index, style }) => (
                            <div style={style} key={sub.tanks[index].id}>
                              <table className="w-full">
                                <tbody>
                                  <TankRow tank={sub.tanks[index]} onClick={onTankClick} todayBurnRate={todayBurnRate} />
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
                                <th className="sticky left-0 z-10 bg-inherit px-3 py-3 text-left">
                                  <SortButton field="location">Location / Tank</SortButton>
                                </th>
                                <th className="px-3 py-3 text-center">
                                  <SortButton field="product">Product</SortButton>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <SortButton field="current_level">Current Level</SortButton>
                                </th>
                                <th className="px-3 py-3 text-center">% Full</th>
                                <th className="px-3 py-3 text-center">Days-to-Min</th>
                                <th className="px-3 py-3 text-center">Rolling Avg (L/day)</th>
                                <th className="px-3 py-3 text-center">Status</th>
                                <th className="px-3 py-3 text-center">Last Dip</th>
                                <th className="hidden md:table-cell px-3 py-3 text-right">Ullage (L)</th>
                                <th className="px-3 py-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortTanks(sub.tanks).map(tank => (
                                <TankRow key={tank.id} tank={tank} onClick={onTankClick} todayBurnRate={todayBurnRate} isMobile={isMobile} />
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
            {/* Tanks not in subgroups */}
            {group.tanks.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-white dark:bg-gray-900 font-semibold text-gray-700 sticky top-0 shadow-xs">
                      <th className="sticky left-0 z-10 bg-inherit px-3 py-3 text-left">
                        <SortButton field="location">Location / Tank</SortButton>
                      </th>
                      <th className="px-3 py-3 text-center">
                        <SortButton field="product">Product</SortButton>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <SortButton field="current_level">Current Level</SortButton>
                      </th>
                      <th className="px-3 py-3 text-center">% Full</th>
                      <th className="px-3 py-3 text-center">Days-to-Min</th>
                      <th className="px-3 py-3 text-center">Rolling Avg (L/day)</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-center">Last Dip</th>
                      <th className="hidden md:table-cell px-3 py-3 text-right">Ullage (L)</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortTanks(group.tanks).map(tank => (
                      <TankRow key={tank.id} tank={tank} onClick={onTankClick} todayBurnRate={todayBurnRate} isMobile={isMobile} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export interface TankStatusTableProps {
  tanks: Tank[];
  onTankClick?: (tank: Tank) => void;
  todayBurnRate?: number;
}

export const TankStatusTable: React.FC<TankStatusTableProps> = ({ tanks, onTankClick, todayBurnRate }) => {
  const [selectedTank, setSelectedTank] = useState<Tank | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: string | null; direction: 'asc' | 'desc' }>({ field: null, direction: 'asc' });
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState<Tank | null>(null);

  const handleTankClick = useCallback((tank: Tank) => {
    setSelectedTank(tank);
    setDrawerOpen(true);
    onTankClick?.(tank);
  }, [onTankClick]);

  // Sorting logic for tanks within a group/subgroup
  const sortTanks = useCallback((tanksToSort: Tank[]) => {
    if (!sortConfig.field) return tanksToSort;
    return [...tanksToSort].sort((a, b) => {
      let aValue = a[sortConfig.field!];
      let bValue = b[sortConfig.field!];
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
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

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => {
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

  return (
    <div className="space-y-4">
      <Input placeholder="Search by location" className="mb-4" />
      <NestedGroupAccordion tanks={tanks} onTankClick={handleTankClick} todayBurnRate={todayBurnRate} sortTanks={sortTanks} SortButton={SortButton} />
      {selectedTank && (
        <TankDetailsModal tank={selectedTank} open={drawerOpen} onOpenChange={setDrawerOpen} />
      )}
      {editDipTank && (
        <EditDipModal
          isOpen={editDipModalOpen}
          onClose={() => { setEditDipModalOpen(false); setEditDipTank(null); }}
          initialGroupId={editDipTank.group_id}
          initialTankId={editDipTank.id}
        />
      )}
    </div>
  );
}; 