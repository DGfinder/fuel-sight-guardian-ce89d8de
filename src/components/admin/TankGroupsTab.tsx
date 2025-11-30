/**
 * TankGroupsTab Component
 * Tank Groups management with CRUD operations
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, Edit, Trash2, Layers, Download, AlertTriangle } from 'lucide-react';
import { AdminDataTable, type Column } from './AdminDataTable';
import { BulkActionsBar, bulkActions } from './BulkActionsBar';
import { TankGroupDialog } from './TankGroupDialog';
import { useTankGroupsCrud } from '@/hooks/admin/useTankGroupsCrud';
import type { TankGroup } from '@/types/admin';
import { format } from 'date-fns';

export function TankGroupsTab() {
  const {
    groups,
    isLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    bulkDeleteGroups,
    isCreating,
    isUpdating,
    isDeleting,
    isBulkDeleting,
  } = useTankGroupsCrud();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TankGroup | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TankGroup | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Filter and sort data
  const filteredGroups = useMemo(() => {
    let result = [...groups];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          (g.description || '').toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortBy as keyof TankGroup];
      let bVal: any = b[sortBy as keyof TankGroup];

      if (sortBy === 'tank_count') {
        aVal = a.tank_count || 0;
        bVal = b.tank_count || 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [groups, searchQuery, sortBy, sortOrder]);

  // Table columns
  const columns: Column<TankGroup>[] = [
    {
      key: 'name',
      header: 'Group Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-gray-500 truncate max-w-xs block">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'tank_count',
      header: 'Tanks',
      sortable: true,
      className: 'text-center',
      render: (row) => (
        <Badge variant="secondary">{row.tank_count || 0}</Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-gray-500 text-sm">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setEditingGroup(row);
              setShowDialog(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm(row);
            }}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
    if (selectedRows.size === filteredGroups.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredGroups.map((g) => g.id)));
    }
  };

  const handleSave = (data: { name: string; description?: string | null }) => {
    if (editingGroup) {
      updateGroup(
        { id: editingGroup.id, input: data },
        {
          onSuccess: () => {
            setShowDialog(false);
            setEditingGroup(null);
          },
        }
      );
    } else {
      createGroup(data, {
        onSuccess: () => {
          setShowDialog(false);
        },
      });
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteGroup(deleteConfirm.id, {
        onSuccess: () => setDeleteConfirm(null),
      });
    }
  };

  const handleBulkDelete = () => {
    bulkDeleteGroups(Array.from(selectedRows), {
      onSuccess: () => {
        setSelectedRows(new Set());
        setBulkDeleteConfirm(false);
      },
    });
  };

  const handleExportCsv = () => {
    const csvContent = [
      ['Name', 'Description', 'Tank Count', 'Created At'],
      ...filteredGroups.map((g) => [
        g.name,
        g.description || '',
        String(g.tank_count || 0),
        g.created_at,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tank-groups-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={() => {
                  setEditingGroup(null);
                  setShowDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Tank Groups</span>
            <Badge variant="outline">{filteredGroups.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={filteredGroups}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No tank groups found"
            emptyIcon={<Layers className="h-12 w-12 text-gray-300 mx-auto" />}
            selectable
            selectedRows={selectedRows}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            total={filteredGroups.length}
          />
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRows.size}
        onClearSelection={() => setSelectedRows(new Set())}
        actions={[
          bulkActions.delete(() => setBulkDeleteConfirm(true)),
          bulkActions.export(handleExportCsv),
        ]}
      />

      {/* Create/Edit Dialog */}
      <TankGroupDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setEditingGroup(null);
        }}
        group={editingGroup}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Tank Group
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"?
              {(deleteConfirm?.tank_count || 0) > 0 && (
                <span className="block mt-2 text-red-500 font-medium">
                  Warning: This group has {deleteConfirm?.tank_count} tanks. You must move
                  or delete them first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
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
              Delete {selectedRows.size} Tank Groups
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRows.size} selected tank groups?
              This action cannot be undone. Groups with existing tanks cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TankGroupsTab;
