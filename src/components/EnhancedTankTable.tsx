import React, { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  GroupingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem 
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Eye,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  Columns,
  Download,
  Search
} from 'lucide-react';
import { Tank } from '@/types/fuel';
import { cn } from '@/lib/utils';
import PercentBar from './tables/PercentBar';
import { getFuelStatus, statusBadgeStyles, FuelStatus } from '@/lib/fuel-colors';

interface EnhancedTankTableProps {
  tanks: Tank[];
  onTankClick: (tank: Tank) => void;
  onServicedToggle: (tankId: string, serviced: boolean) => void;
  servicedTanks: Set<string>;
  loading?: boolean;
  className?: string;
}

export const EnhancedTankTable = React.memo(function EnhancedTankTable({
  tanks,
  onTankClick,
  onServicedToggle,
  servicedTanks,
  loading = false,
  className
}: EnhancedTankTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Enhanced columns with more features
  const columns = useMemo<ColumnDef<Tank>[]>(
    () => [
      {
        id: 'serviced',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={servicedTanks.has(row.original.id)}
            onCheckedChange={(checked) => 
              onServicedToggle(row.original.id, checked as boolean)
            }
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
      },
      {
        accessorKey: 'location',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Location
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue('location')}</div>
        ),
        enableGrouping: true,
        size: 200,
      },
      {
        accessorKey: 'tank_group.name',
        header: 'Group',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.tank_group?.name || 'Unknown'}
          </Badge>
        ),
        enableGrouping: true,
        size: 120,
      },
      {
        accessorKey: 'subgroup',
        header: 'Subgroup',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.getValue('subgroup') || '—'}
          </div>
        ),
        enableGrouping: true,
        size: 120,
      },
      {
        accessorKey: 'current_level_percent',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Fuel Level
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const percent = Math.round(row.getValue('current_level_percent') as number || 0);
          const status = getFuelStatus(percent, row.original.days_to_min_level);

          return (
            <div className="flex items-center space-x-2">
              <PercentBar
                percent={percent}
                className="w-16"
              />
              <Badge className={cn('text-xs', statusBadgeStyles[status])}>
                {percent}%
              </Badge>
            </div>
          );
        },
        sortingFn: 'basic',
        size: 150,
      },
      {
        accessorKey: 'current_level',
        header: 'Current (L)',
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {(row.getValue('current_level') as number)?.toLocaleString('en-AU') || '—'}
          </div>
        ),
        size: 100,
      },
      {
        accessorKey: 'safe_level',
        header: 'Capacity (L)',
        cell: ({ row }) => (
          <div className="text-right font-mono text-muted-foreground">
            {(row.getValue('safe_level') as number)?.toLocaleString('en-AU') || '—'}
          </div>
        ),
        size: 100,
      },
      {
        accessorKey: 'days_to_min_level',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Days Left
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const days = row.getValue('days_to_min_level') as number;
          if (days === null || days === undefined) return '—';

          const status: FuelStatus = days <= 1.5 ? 'critical' : days <= 2.5 ? 'low' : 'normal';

          return (
            <Badge className={cn('text-xs', statusBadgeStyles[status])}>
              {days.toFixed(1)}d
            </Badge>
          );
        },
        sortingFn: 'basic',
        size: 100,
      },
      {
        accessorKey: 'rolling_avg',
        header: 'Avg Consumption',
        cell: ({ row }) => {
          const avg = row.getValue('rolling_avg') as number;
          return (
            <div className="text-right font-mono text-sm">
              {avg ? `${avg.toLocaleString('en-AU')} L/day` : '—'}
            </div>
          );
        },
        size: 140,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const percent = Math.round(row.original.current_level_percent || 0);
          const status = getFuelStatus(percent, row.original.days_to_min_level);

          return (
            <div className="flex items-center space-x-1">
              {status === 'critical' && <AlertTriangle className="h-4 w-4 text-fuel-critical" />}
              <span className={cn('text-xs font-medium', {
                'text-fuel-critical-600': status === 'critical',
                'text-fuel-low-600': status === 'low',
                'text-fuel-normal-600': status === 'normal',
              })}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          );
        },
        enableSorting: false,
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onTankClick(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
      },
    ],
    [onTankClick, onServicedToggle, servicedTanks]
  );

  const table = useReactTable({
    data: tanks,
    columns,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      grouping,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableGrouping: true,
    enableRowSelection: true,
    globalFilterFn: 'includesString',
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  // Virtual scrolling for better performance with large datasets
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();
  
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52, // Estimated row height
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 
    ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Enhanced toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tanks..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(String(e.target.value))}
              className="pl-8 w-64"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Group by
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuCheckboxItem
                checked={grouping.includes('tank_group.name')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setGrouping(['tank_group.name']);
                  } else {
                    setGrouping([]);
                  }
                }}
              >
                Group by Tank Group
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={grouping.includes('subgroup')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setGrouping(['subgroup']);
                  } else {
                    setGrouping([]);
                  }
                }}
              >
                Group by Subgroup
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div 
          ref={tableContainerRef}
          className="h-[600px] overflow-auto"
        >
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b transition-colors hover:bg-muted/50 cursor-pointer',
                      row.getIsSelected() && 'bg-muted'
                    )}
                    onClick={() => onTankClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2 align-middle"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
});