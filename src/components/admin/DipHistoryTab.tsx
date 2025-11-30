/**
 * DipHistoryTab Component
 * Dip readings management with archive/restore functionality
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Search,
  Edit,
  Archive,
  RotateCcw,
  ClipboardList,
  Download,
  MoreHorizontal,
  Filter,
  X,
} from 'lucide-react';
import { AdminDataTable, type Column } from './AdminDataTable';
import { BulkActionsBar, bulkActions } from './BulkActionsBar';
import { useDipReadingsCrud } from '@/hooks/admin/useDipReadingsCrud';
import type { DipReading, DipFilters } from '@/types/admin';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function DipHistoryTab() {
  // Filters
  const [filters, setFilters] = useState<Partial<DipFilters>>({});
  const [showFilters, setShowFilters] = useState(false);

  const {
    readings,
    tanks,
    isLoading,
    updateReading,
    archiveReading,
    restoreReading,
    bulkArchiveReadings,
    bulkRestoreReadings,
    isUpdating,
    isArchiving,
    isRestoring,
    isBulkArchiving,
  } = useDipReadingsCrud(filters);

  // State
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Dialog state
  const [editingReading, setEditingReading] = useState<DipReading | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<DipReading | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkArchiveReason, setBulkArchiveReason] = useState('');

  // Edit form state
  const [editValue, setEditValue] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // Sort data
  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) => {
      let aVal: any = a[sortBy as keyof DipReading];
      let bVal: any = b[sortBy as keyof DipReading];

      if (sortBy === 'created_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? (aVal || '').localeCompare(bVal || '')
          : (bVal || '').localeCompare(aVal || '');
      }

      return sortOrder === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }, [readings, sortBy, sortOrder]);

  // Check if any selected rows are archived
  const hasArchivedSelected = useMemo(() => {
    return readings.some((r) => selectedRows.has(r.id) && r.archived_at);
  }, [readings, selectedRows]);

  const hasActiveSelected = useMemo(() => {
    return readings.some((r) => selectedRows.has(r.id) && !r.archived_at);
  }, [readings, selectedRows]);

  // Table columns
  const columns: Column<DipReading>[] = [
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">
            {format(new Date(row.created_at), 'MMM d, yyyy')}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(row.created_at), 'h:mm a')}
          </div>
        </div>
      ),
    },
    {
      key: 'tank_location',
      header: 'Tank',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-medium">{row.tank_location}</span>
          <div className="text-xs text-gray-500">{row.tank_group}</div>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value (L)',
      sortable: true,
      render: (row) => (
        <span className="font-mono">{row.value.toLocaleString()}</span>
      ),
    },
    {
      key: 'created_by_name',
      header: 'Recorded By',
      sortable: true,
      render: (row) => (
        <span className="text-gray-600">{row.created_by_name || row.recorded_by || '—'}</span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <span className="text-gray-500 truncate max-w-xs block text-sm">
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'archived_at',
      header: 'Status',
      render: (row) => (
        row.archived_at ? (
          <Badge variant="secondary" className="bg-gray-100">
            Archived
          </Badge>
        ) : (
          <Badge className="bg-green-100 text-green-800">Active</Badge>
        )
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
                setEditingReading(row);
                setEditValue(row.value);
                setEditNotes(row.notes || '');
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {row.archived_at ? (
              <DropdownMenuItem
                onClick={() => restoreReading(row.id)}
                disabled={isRestoring}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setArchiveConfirm(row);
                  setArchiveReason('');
                }}
                className="text-orange-600"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
            )}
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
      setSortOrder('desc');
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
    if (selectedRows.size === sortedReadings.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedReadings.map((r) => r.id)));
    }
  };

  const handleSaveEdit = () => {
    if (editingReading) {
      updateReading(
        { id: editingReading.id, input: { value: editValue, notes: editNotes } },
        { onSuccess: () => setEditingReading(null) }
      );
    }
  };

  const handleArchive = () => {
    if (archiveConfirm && archiveReason.trim()) {
      archiveReading(
        { id: archiveConfirm.id, reason: archiveReason },
        { onSuccess: () => { setArchiveConfirm(null); setArchiveReason(''); } }
      );
    }
  };

  const handleBulkArchive = () => {
    if (bulkArchiveReason.trim()) {
      const activeIds = Array.from(selectedRows).filter(
        (id) => !readings.find((r) => r.id === id)?.archived_at
      );
      bulkArchiveReadings(
        { ids: activeIds, reason: bulkArchiveReason },
        { onSuccess: () => { setSelectedRows(new Set()); setBulkArchiveConfirm(false); setBulkArchiveReason(''); } }
      );
    }
  };

  const handleBulkRestore = () => {
    const archivedIds = Array.from(selectedRows).filter(
      (id) => readings.find((r) => r.id === id)?.archived_at
    );
    bulkRestoreReadings(archivedIds, {
      onSuccess: () => setSelectedRows(new Set()),
    });
  };

  const handleExportCsv = () => {
    const csvContent = [
      ['Date', 'Tank', 'Group', 'Value (L)', 'Recorded By', 'Notes', 'Status'],
      ...sortedReadings.map((r) => [
        format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
        r.tank_location,
        r.tank_group,
        String(r.value),
        r.created_by_name || r.recorded_by || '',
        r.notes || '',
        r.archived_at ? 'Archived' : 'Active',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dip-readings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
                  placeholder="Search dip readings..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-archived"
                    checked={filters.includeArchived || false}
                    onCheckedChange={(checked) => setFilters({ ...filters, includeArchived: checked })}
                  />
                  <Label htmlFor="show-archived" className="text-sm">
                    Show Archived
                  </Label>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(showFilters && 'bg-gray-100')}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" onClick={handleExportCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Filter Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <Select
                  value={filters.tankId || ''}
                  onValueChange={(v) => setFilters({ ...filters, tankId: v || null })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Tanks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Tanks</SelectItem>
                    {tanks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Dip Readings</span>
            <Badge variant="outline">{sortedReadings.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={sortedReadings}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No dip readings found"
            emptyIcon={<ClipboardList className="h-12 w-12 text-gray-300 mx-auto" />}
            selectable
            selectedRows={selectedRows}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            total={sortedReadings.length}
            rowClassName={(row) => row.archived_at ? 'bg-gray-50 opacity-75' : ''}
          />
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRows.size}
        onClearSelection={() => setSelectedRows(new Set())}
        actions={[
          ...(hasActiveSelected ? [bulkActions.archive(() => { setBulkArchiveConfirm(true); setBulkArchiveReason(''); })] : []),
          ...(hasArchivedSelected ? [bulkActions.restore(handleBulkRestore)] : []),
          bulkActions.export(handleExportCsv),
        ]}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingReading} onOpenChange={() => setEditingReading(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Dip Reading</DialogTitle>
            <DialogDescription>
              {editingReading && (
                <span>
                  {editingReading.tank_location} - {format(new Date(editingReading.created_at), 'MMM d, yyyy')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-value">Value (Litres)</Label>
              <Input
                id="edit-value"
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReading(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveConfirm} onOpenChange={() => setArchiveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Dip Reading</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for archiving this reading.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for archiving..."
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving || !archiveReason.trim()}
            >
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Archive Confirmation */}
      <AlertDialog open={bulkArchiveConfirm} onOpenChange={setBulkArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedRows.size} Dip Readings</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for archiving these readings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for archiving..."
            value={bulkArchiveReason}
            onChange={(e) => setBulkArchiveReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkArchive}
              disabled={isBulkArchiving || !bulkArchiveReason.trim()}
            >
              {isBulkArchiving ? 'Archiving...' : 'Archive All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DipHistoryTab;
