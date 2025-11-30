/**
 * FuelTanksTab Component
 * Fuel Tanks management with advanced filtering and bulk operations
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Fuel,
  Download,
  AlertTriangle,
  Filter,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { AdminDataTable, type Column } from './AdminDataTable';
import { BulkActionsBar, bulkActions } from './BulkActionsBar';
import { FuelTankDialog } from './FuelTankDialog';
import { useFuelTanksCrud } from '@/hooks/admin/useFuelTanksCrud';
import type { FuelTank, TankFilters, ProductType, TankStatus } from '@/types/admin';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PRODUCT_TYPES: ProductType[] = ['Diesel', 'ULP', 'ULP98', 'ADF'];
const STATUSES: { value: TankStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-800' },
  { value: 'decommissioned', label: 'Decommissioned', color: 'bg-red-100 text-red-800' },
];

export function FuelTanksTab() {
  // Filters
  const [filters, setFilters] = useState<Partial<TankFilters>>({});
  const [showFilters, setShowFilters] = useState(false);

  const {
    tanks,
    groups,
    subgroups,
    isLoading,
    createTank,
    updateTank,
    deleteTank,
    bulkUpdateTanks,
    bulkDeleteTanks,
    isCreating,
    isUpdating,
    isDeleting,
    isBulkUpdating,
    isBulkDeleting,
  } = useFuelTanksCrud(filters);

  // State
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('location');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FuelTank | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkUpdateDialog, setBulkUpdateDialog] = useState<'group' | 'status' | null>(null);

  // Sort data
  const sortedTanks = useMemo(() => {
    return [...tanks].sort((a, b) => {
      let aVal: any = a[sortBy as keyof FuelTank];
      let bVal: any = b[sortBy as keyof FuelTank];

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? (aVal || '').localeCompare(bVal || '')
          : (bVal || '').localeCompare(aVal || '');
      }

      return sortOrder === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }, [tanks, sortBy, sortOrder]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.groupId) count++;
    if (filters.subgroup) count++;
    if (filters.productTypes && filters.productTypes.length > 0) count++;
    if (filters.statuses && filters.statuses.length > 0) count++;
    return count;
  }, [filters]);

  // Table columns
  const columns: Column<FuelTank>[] = [
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-medium">{row.location}</span>
          {row.subgroup && (
            <span className="text-gray-400 text-sm ml-2">({row.subgroup})</span>
          )}
        </div>
      ),
    },
    {
      key: 'group_name',
      header: 'Group',
      sortable: true,
      render: (row) => <span className="text-gray-600">{row.group_name}</span>,
    },
    {
      key: 'product_type',
      header: 'Product',
      sortable: true,
      render: (row) => <Badge variant="outline">{row.product_type}</Badge>,
    },
    {
      key: 'current_level',
      header: 'Current Level',
      sortable: true,
      render: (row) => {
        const percent = row.safe_level > 0 ? (row.current_level / row.safe_level) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  percent > 50 ? 'bg-green-500' : percent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <span className="text-sm">{row.current_level.toLocaleString()}L</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        const status = STATUSES.find((s) => s.value === row.status);
        return (
          <Badge className={status?.color || 'bg-gray-100'}>
            {status?.label || row.status}
          </Badge>
        );
      },
    },
    {
      key: 'last_dip_date',
      header: 'Last Dip',
      sortable: true,
      render: (row) => (
        <span className="text-gray-500 text-sm">
          {row.last_dip_date ? format(new Date(row.last_dip_date), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-12',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditingTank(row);
                setShowDialog(true);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteConfirm(row)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Handlers
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRows(newSet);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === sortedTanks.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedTanks.map((t) => t.id)));
    }
  };

  const handleSave = (data: any) => {
    if (editingTank) {
      updateTank(
        { id: editingTank.id, input: data },
        { onSuccess: () => { setShowDialog(false); setEditingTank(null); } }
      );
    } else {
      createTank(data, { onSuccess: () => setShowDialog(false) });
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteTank(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
    }
  };

  const handleBulkDelete = () => {
    bulkDeleteTanks(Array.from(selectedRows), {
      onSuccess: () => { setSelectedRows(new Set()); setBulkDeleteConfirm(false); },
    });
  };

  const handleBulkUpdate = (updates: Partial<FuelTank>) => {
    bulkUpdateTanks(
      { ids: Array.from(selectedRows), updates },
      { onSuccess: () => { setSelectedRows(new Set()); setBulkUpdateDialog(null); } }
    );
  };

  const handleExportCsv = () => {
    const csvContent = [
      ['Location', 'Group', 'Subgroup', 'Product Type', 'Current Level', 'Safe Level', 'Min Level', 'Status', 'Last Dip Date'],
      ...sortedTanks.map((t) => [
        t.location,
        t.group_name || '',
        t.subgroup || '',
        t.product_type,
        String(t.current_level),
        String(t.safe_level),
        String(t.min_level),
        t.status,
        t.last_dip_date || '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fuel-tanks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tanks..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(showFilters && 'bg-gray-100')}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                <Button variant="outline" onClick={handleExportCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => { setEditingTank(null); setShowDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tank
                </Button>
              </div>
            </div>

            {/* Filter Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <Select
                  value={filters.groupId || ''}
                  onValueChange={(v) => setFilters({ ...filters, groupId: v || null })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Groups</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.subgroup || ''}
                  onValueChange={(v) => setFilters({ ...filters, subgroup: v || null })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Subgroups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Subgroups</SelectItem>
                    {subgroups.map((sg) => (
                      <SelectItem key={sg} value={sg}>{sg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.productTypes?.[0] || ''}
                  onValueChange={(v) => setFilters({ ...filters, productTypes: v ? [v as ProductType] : [] })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Products</SelectItem>
                    {PRODUCT_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.statuses?.[0] || ''}
                  onValueChange={(v) => setFilters({ ...filters, statuses: v ? [v as TankStatus] : [] })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Fuel Tanks</span>
            <Badge variant="outline">{sortedTanks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={sortedTanks}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No fuel tanks found"
            emptyIcon={<Fuel className="h-12 w-12 text-gray-300 mx-auto" />}
            selectable
            selectedRows={selectedRows}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            total={sortedTanks.length}
          />
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRows.size}
        onClearSelection={() => setSelectedRows(new Set())}
        actions={[
          { id: 'change-group', label: 'Change Group', icon: <Fuel className="h-4 w-4" />, onClick: () => setBulkUpdateDialog('group') },
          { id: 'change-status', label: 'Change Status', icon: <Edit className="h-4 w-4" />, onClick: () => setBulkUpdateDialog('status') },
          bulkActions.delete(() => setBulkDeleteConfirm(true)),
          bulkActions.export(handleExportCsv),
        ]}
      />

      {/* Create/Edit Dialog */}
      <FuelTankDialog
        open={showDialog}
        onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingTank(null); }}
        tank={editingTank}
        groups={groups}
        subgroups={subgroups}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Fuel Tank
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.location}"? This will also delete all associated dip readings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {selectedRows.size} Fuel Tanks
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRows.size} selected tanks? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600" disabled={isBulkDeleting}>
              {isBulkDeleting ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Update Dialog - Group */}
      <AlertDialog open={bulkUpdateDialog === 'group'} onOpenChange={() => setBulkUpdateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Group for {selectedRows.size} Tanks</AlertDialogTitle>
            <AlertDialogDescription>Select the new group for all selected tanks.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select onValueChange={(v) => handleBulkUpdate({ group_id: v } as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Select new group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Update Dialog - Status */}
      <AlertDialog open={bulkUpdateDialog === 'status'} onOpenChange={() => setBulkUpdateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status for {selectedRows.size} Tanks</AlertDialogTitle>
            <AlertDialogDescription>Select the new status for all selected tanks.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select onValueChange={(v) => handleBulkUpdate({ status: v as TankStatus })}>
            <SelectTrigger>
              <SelectValue placeholder="Select new status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default FuelTanksTab;
