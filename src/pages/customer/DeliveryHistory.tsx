import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomerDeliveryRequests } from '@/hooks/useCustomerAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { FilterCard } from '@/components/ui/FilterCard';
import { TimelineCard, TimelineEvent } from '@/components/ui/TimelineCard';
import { getStatusFromValue } from '@/components/ui/StatusBadge';
import {
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';

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
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
      >
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className="cursor-pointer"
        >
          <KPICard
            title="Pending"
            value={statusCounts.pending || 0}
            icon={Clock}
            color="yellow"
            trend="neutral"
            alert={statusFilter === 'pending'}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setStatusFilter(statusFilter === 'scheduled' ? 'all' : 'scheduled')}
          className="cursor-pointer"
        >
          <KPICard
            title="Scheduled"
            value={statusCounts.scheduled || 0}
            icon={Calendar}
            color="blue"
            trend="neutral"
            alert={statusFilter === 'scheduled'}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className="cursor-pointer"
        >
          <KPICard
            title="In Progress"
            value={statusCounts.in_progress || 0}
            icon={Truck}
            color="blue"
            trend="neutral"
            alert={statusFilter === 'in_progress'}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          className="cursor-pointer"
        >
          <KPICard
            title="Completed"
            value={statusCounts.completed || 0}
            icon={CheckCircle}
            color="green"
            trend="neutral"
            alert={statusFilter === 'completed'}
          />
        </motion.div>
      </motion.div>

      {/* Filters */}
      <FilterCard
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by tank..."
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as RequestStatus | 'all'),
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'acknowledged', label: 'Acknowledged' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
        onClearAll={() => {
          setSearchQuery('');
          setStatusFilter('all');
        }}
        activeFilterCount={statusFilter !== 'all' ? 1 : 0}
        defaultExpanded={true}
      />

      {/* Request List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Delivery Requests
          </h2>
          <Badge variant="outline">{filteredRequests.length}</Badge>
        </div>

        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.3 }}
                transition={{ delay: 0.2 }}
              >
                <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              </motion.div>
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
            </CardContent>
          </Card>
        ) : (
          <TimelineCard
            events={filteredRequests.map((request): TimelineEvent => {
              const status = statusConfig[request.status as RequestStatus] || statusConfig.pending;
              const details: Array<{ label: string; value: string | number }> = [];

              // Add requested date if available
              if (request.requested_date) {
                details.push({
                  label: 'Requested for',
                  value: new Date(request.requested_date).toLocaleDateString('en-AU'),
                });
              }

              // Add scheduled date if available
              if (request.scheduled_date) {
                details.push({
                  label: 'Scheduled',
                  value: new Date(request.scheduled_date).toLocaleDateString('en-AU'),
                });
              }

              // Add level at request
              if (request.current_level_pct !== undefined && request.current_level_pct !== null) {
                details.push({
                  label: 'Level at request',
                  value: `${request.current_level_pct.toFixed(0)}%`,
                });
              }

              // Add requested litres
              if (request.requested_litres) {
                details.push({
                  label: 'Requested',
                  value: `${request.requested_litres.toLocaleString()}L`,
                });
              }

              // Add current level if available
              if (request.agbot_locations?.latest_calibrated_fill_percentage !== undefined) {
                details.push({
                  label: 'Current level',
                  value: `${request.agbot_locations.latest_calibrated_fill_percentage.toFixed(0)}%`,
                });
              }

              // Add delivered litres if completed
              if (request.status === 'completed' && request.actual_litres_delivered) {
                details.push({
                  label: 'Delivered',
                  value: `${request.actual_litres_delivered.toLocaleString()}L`,
                });
              }

              // Build description
              let description = '';
              if (request.notes) {
                description = request.notes;
              }
              if (request.status === 'cancelled' && request.cancellation_reason) {
                description = `Cancelled: ${request.cancellation_reason}`;
              }
              if (request.status === 'completed' && request.actual_litres_delivered) {
                description = `Delivered ${request.actual_litres_delivered.toLocaleString()}L on ${new Date(request.completed_at).toLocaleDateString('en-AU')}`;
              }

              // Build title with tank name and urgent badge
              const tankName = request.agbot_locations?.location_id || request.agbot_locations?.address1 || 'Tank';
              const title = tankName + (request.request_type === 'urgent' ? ' (URGENT)' : '');

              return {
                id: request.id,
                date: new Date(request.created_at),
                title,
                description: description || undefined,
                status: getStatusFromValue(status.label),
                statusLabel: status.label,
                icon: status.icon,
                details: details.length > 0 ? details : undefined,
              };
            })}
            variant="vertical"
            expandable={true}
            showConnector={true}
            emptyMessage="No delivery requests found"
          />
        )}
      </div>
    </div>
  );
}
