/**
 * AuditTrail Component
 * 
 * Displays audit trail information for records with a clean, accessible interface
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuditTrail } from '@/hooks/useAudit';
import { AuditService } from '@/lib/audit';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditTrailProps {
  tableName: string;
  recordId: string;
  className?: string;
  limit?: number;
  showTitle?: boolean;
}

export function AuditTrail({ 
  tableName, 
  recordId, 
  className = '', 
  limit = 20,
  showTitle = true 
}: AuditTrailProps) {
  const { data: auditEntries, isLoading, error } = useAuditTrail(tableName, recordId, limit);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoadingSpinner text="Loading audit trail..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm p-4 bg-red-50 rounded">
        Failed to load audit trail: {error.message}
      </div>
    );
  }

  if (!auditEntries || auditEntries.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-4 text-center">
        No audit trail available for this record.
      </div>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            📋 Audit Trail
            <Badge variant="secondary" className="text-xs">
              {auditEntries.length} {auditEntries.length === 1 ? 'entry' : 'entries'}
            </Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {auditEntries.map((entry, index) => (
              <AuditEntry key={index} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface AuditEntryProps {
  entry: {
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    user_email: string | null;
    created_at: string;
  };
}

function AuditEntry({ entry }: AuditEntryProps) {
  const { action, old_values, new_values, user_email, created_at } = entry;
  
  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true });
  const user = user_email?.split('@')[0] || 'System';
  
  const actionIcon = AuditService.getActionIcon(action);
  const actionColor = AuditService.getActionColor(action);

  const getActionDescription = () => {
    switch (action) {
      case 'INSERT':
        return 'Created this record';
      case 'DELETE':
        return 'Deleted this record';
      case 'UPDATE': {
        const changes = AuditService.getChanges(old_values, new_values);
        return `Updated ${changes}`;
      }
      default:
        return `Performed ${action}`;
    }
  };

  const getChangedFields = () => {
    if (action !== 'UPDATE' || !old_values || !new_values) return null;

    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    const keys = new Set([...Object.keys(old_values), ...Object.keys(new_values)]);

    for (const key of keys) {
      if (key === 'updated_at' || key === 'created_at') continue;
      
      const oldVal = old_values[key];
      const newVal = new_values[key];

      if (oldVal !== newVal) {
        changes.push({ field: key, oldValue: oldVal, newValue: newVal });
      }
    }

    return changes.length > 0 ? changes : null;
  };

  const changes = getChangedFields();

  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0">
        <span className={`text-lg ${actionColor}`} title={action}>
          {actionIcon}
        </span>
      </div>
      
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">
            {user}
          </span>
          <Badge 
            variant={action === 'DELETE' ? 'destructive' : action === 'INSERT' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {action}
          </Badge>
        </div>
        
        <p className="text-sm text-gray-700 mb-1">
          {getActionDescription()}
        </p>
        
        {changes && changes.length > 0 && (
          <div className="mt-2 space-y-1">
            {changes.slice(0, 3).map(({ field, oldValue, newValue }) => (
              <div key={field} className="text-xs text-gray-600 bg-white p-2 rounded border">
                <span className="font-medium">{field}:</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-red-600 line-through">
                    {String(oldValue || 'null').slice(0, 50)}
                  </span>
                  <span>→</span>
                  <span className="text-green-600">
                    {String(newValue || 'null').slice(0, 50)}
                  </span>
                </div>
              </div>
            ))}
            {changes.length > 3 && (
              <div className="text-xs text-gray-500">
                ... and {changes.length - 3} more changes
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-gray-500 mt-2">
          {timeAgo}
        </div>
      </div>
    </div>
  );
}

export default AuditTrail;