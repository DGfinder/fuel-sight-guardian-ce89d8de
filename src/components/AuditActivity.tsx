/**
 * AuditActivity Component
 * 
 * Shows recent audit activity across the entire system - useful for admin dashboards
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useRecentAuditActivity } from '@/hooks/useAudit';
import { AuditService } from '@/lib/audit';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditActivityProps {
  className?: string;
  hours?: number;
  limit?: number;
  showTitle?: boolean;
}

export function AuditActivity({ 
  className = '', 
  hours = 24, 
  limit = 50,
  showTitle = true 
}: AuditActivityProps) {
  const { data: activities, isLoading, error } = useRecentAuditActivity(hours, limit);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoadingSpinner text="Loading recent activity..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm p-4 bg-red-50 rounded">
        Failed to load recent activity: {error.message}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-4 text-center">
        No recent activity in the last {hours} hours.
      </div>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            🔍 Recent Activity
            <Badge variant="secondary" className="text-xs">
              Last {hours}h
            </Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <ScrollArea className="h-80">
          <div className="space-y-2">
            {activities.map((activity, index) => (
              <ActivityEntry key={index} activity={activity} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface ActivityEntryProps {
  activity: {
    table_name: string;
    record_id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    user_email: string | null;
    created_at: string;
  };
}

function ActivityEntry({ activity }: ActivityEntryProps) {
  const { table_name, record_id, action, user_email, created_at } = activity;
  
  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true });
  const user = user_email?.split('@')[0] || 'System';
  
  const actionIcon = AuditService.getActionIcon(action);
  const actionColor = AuditService.getActionColor(action);
  const tableName = AuditService.formatTableName(table_name);

  const getActionDescription = () => {
    switch (action) {
      case 'INSERT':
        return `created a new ${tableName.toLowerCase()}`;
      case 'UPDATE':
        return `updated ${tableName.toLowerCase()}`;
      case 'DELETE':
        return `deleted ${tableName.toLowerCase()}`;
      default:
        return `performed ${action} on ${tableName.toLowerCase()}`;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0">
        <span className={`text-sm ${actionColor}`} title={action}>
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
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{timeAgo}</span>
          <span>•</span>
          <span className="font-mono text-xs bg-gray-100 px-1 rounded">
            {record_id.slice(0, 8)}...
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuditActivity;