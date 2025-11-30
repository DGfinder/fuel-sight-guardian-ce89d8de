/**
 * BulkActionsBar Component
 * Floating action bar when rows are selected
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Trash2, Edit, Archive, RotateCcw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  onClick: () => void;
}

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg',
        'px-4 py-3 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="bg-blue-500 text-white text-sm font-medium px-2 py-0.5 rounded-full">
          {selectedCount}
        </span>
        <span className="text-sm">selected</span>
      </div>

      <div className="h-6 w-px bg-gray-600" />

      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant || 'outline'}
            size="sm"
            onClick={action.onClick}
            className={cn(
              'gap-1.5',
              action.variant !== 'destructive' && 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-white'
            )}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-gray-600" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="text-gray-300 hover:text-white hover:bg-gray-700"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Pre-built action creators
export const bulkActions = {
  delete: (onClick: () => void): BulkAction => ({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    variant: 'destructive',
    onClick,
  }),
  edit: (onClick: () => void): BulkAction => ({
    id: 'edit',
    label: 'Edit',
    icon: <Edit className="h-4 w-4" />,
    onClick,
  }),
  archive: (onClick: () => void): BulkAction => ({
    id: 'archive',
    label: 'Archive',
    icon: <Archive className="h-4 w-4" />,
    onClick,
  }),
  restore: (onClick: () => void): BulkAction => ({
    id: 'restore',
    label: 'Restore',
    icon: <RotateCcw className="h-4 w-4" />,
    onClick,
  }),
  export: (onClick: () => void): BulkAction => ({
    id: 'export',
    label: 'Export',
    icon: <Download className="h-4 w-4" />,
    onClick,
  }),
};

export default BulkActionsBar;
