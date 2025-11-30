import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomerDeliveryRequests } from '@/hooks/useCustomerAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Search,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RequestStatus = 'pending' | 'acknowledged' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const statusConfig: Record<RequestStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  acknowledged: { label: 'Acknowledged', icon: AlertCircle, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  in_progress: { label: 'In Progress', icon: Truck, color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export default function DeliveryHistory() {
  const { data: requests, isLoading } = useCustomerDeliveryRequests();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');

  // Filter requests
  const filteredRequests = (requests || []).filter((request) => {
    // Status filter
    if (statusFilter !== 'all' && request.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const tankName = request.agbot_locations?.location_id || request.agbot_locations?.address1 || '';
      return tankName.toLowerCase().includes(query);
    }

    return true;
  });

  // Group by status for summary
  const statusCounts = (requests || []).reduce(
    (acc, req) => {
      acc[req.status as RequestStatus] = (acc[req.status as RequestStatus] || 0) + 1;
      return acc;
    },
    {} as Record<RequestStatus, number>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Delivery History
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track your fuel delivery requests
          </p>
        </div>
        <Link to="/customer/request">
          <Button className="gap-2">
            <Plus size={16} />
            New Request
          </Button>
        </Link>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          label="Pending"
          count={statusCounts.pending || 0}
          icon={Clock}
          color="yellow"
          onClick={() => setStatusFilter('pending')}
          active={statusFilter === 'pending'}
        />
        <StatusCard
          label="Scheduled"
          count={statusCounts.scheduled || 0}
          icon={Calendar}
          color="purple"
          onClick={() => setStatusFilter('scheduled')}
          active={statusFilter === 'scheduled'}
        />
        <StatusCard
          label="In Progress"
          count={statusCounts.in_progress || 0}
          icon={Truck}
          color="blue"
          onClick={() => setStatusFilter('in_progress')}
          active={statusFilter === 'in_progress'}
        />
        <StatusCard
          label="Completed"
          count={statusCounts.completed || 0}
          icon={CheckCircle}
          color="green"
          onClick={() => setStatusFilter('completed')}
          active={statusFilter === 'completed'}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by tank..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Delivery Requests</span>
            <Badge variant="outline">{filteredRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {requests?.length === 0
                  ? "You haven't made any delivery requests yet"
                  : 'No requests match your filters'}
              </p>
              {requests?.length === 0 && (
                <Link to="/customer/request">
                  <Button>Request Your First Delivery</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  label,
  count,
  icon: Icon,
  color,
  onClick,
  active,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  color: 'yellow' | 'purple' | 'blue' | 'green';
  onClick: () => void;
  active: boolean;
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  };

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-shadow',
        active && 'ring-2 ring-offset-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestRow({ request }: { request: any }) {
  const status = statusConfig[request.status as RequestStatus] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="p-4 rounded-lg border hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        <div
          className={cn(
            'p-2 rounded-lg flex-shrink-0',
            status.color.replace('text-', 'bg-').replace('-800', '-100')
          )}
        >
          <StatusIcon size={20} className={status.color.split(' ')[1]} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">
              {request.agbot_locations?.location_id || request.agbot_locations?.address1 || 'Tank'}
            </h3>
            <Badge className={cn('text-xs border', status.color)}>{status.label}</Badge>
            {request.request_type === 'urgent' && (
              <Badge variant="destructive" className="text-xs">
                Urgent
              </Badge>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-1">
            Requested: {new Date(request.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {/* Additional Info */}
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            {request.requested_date && (
              <span className="text-gray-500">
                Requested for: {new Date(request.requested_date).toLocaleDateString('en-AU')}
              </span>
            )}
            {request.scheduled_date && (
              <span className="text-purple-600 dark:text-purple-400">
                Scheduled: {new Date(request.scheduled_date).toLocaleDateString('en-AU')}
              </span>
            )}
            {request.current_level_pct && (
              <span className="text-gray-500">
                Level at request: {request.current_level_pct.toFixed(0)}%
              </span>
            )}
            {request.requested_litres && (
              <span className="text-gray-500">
                Requested: {request.requested_litres.toLocaleString()}L
              </span>
            )}
          </div>

          {/* Notes */}
          {request.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
              "{request.notes}"
            </p>
          )}

          {/* Completion info */}
          {request.status === 'completed' && request.actual_litres_delivered && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              Delivered: {request.actual_litres_delivered.toLocaleString()}L on{' '}
              {new Date(request.completed_at).toLocaleDateString('en-AU')}
            </p>
          )}

          {/* Cancellation info */}
          {request.status === 'cancelled' && request.cancellation_reason && (
            <p className="text-sm text-gray-500 mt-2">
              Cancelled: {request.cancellation_reason}
            </p>
          )}
        </div>

        {/* Current Level Badge */}
        {request.agbot_locations?.latest_calibrated_fill_percentage !== undefined && (
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold">
              {request.agbot_locations.latest_calibrated_fill_percentage.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">Current</p>
          </div>
        )}
      </div>
    </div>
  );
}
