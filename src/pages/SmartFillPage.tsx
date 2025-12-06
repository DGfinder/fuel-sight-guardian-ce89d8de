/**
 * SmartFill Monitoring Page (Modernized)
 * 5-tab structure: Dashboard | Tanks | Analytics | Customers | Sync Logs
 * Uses new ta_smartfill_* tables with fallback to legacy tables
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Activity,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  Database,
  Download,
  Eye,
  Filter,
  Fuel,
  Gauge,
  LayoutDashboard,
  MoreVertical,
  RefreshCw,
  Search,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

// Import new components
import {
  SmartFillDashboard,
  SmartFillCustomerCard,
  SmartFillAnalyticsTab,
  SmartFillSyncBadge,
} from '@/components/smartfill';
import SmartFillTankDetailModal from '@/components/SmartFillTankDetailModal';

// Import new analytics hooks
import {
  useSmartFillFleetOverview,
  useSmartFillTanks,
  useSmartFillCustomerSummaries,
  useSmartFillSyncLogs,
  useSmartFillManualSync,
  formatSmartFillRelativeTime,
  getSmartFillPercentageColor,
  getSmartFillPercentageBgColor,
  SmartFillTank,
} from '@/hooks/useSmartFillAnalytics';

// Import legacy hooks for backward compatibility
import {
  useSmartFillLocations,
  useSmartFillSummary,
  useSmartFillAlertsAndActions,
  formatSmartFillTimestamp,
} from '@/hooks/useSmartFillData';

import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface TankWithLocation extends SmartFillTank {
  customer_name?: string;
  location_name?: string;
}

// ============================================================================
// Tank Table Component
// ============================================================================

function TankTable({
  tanks,
  onTankClick,
  isLoading,
}: {
  tanks: TankWithLocation[];
  onTankClick: (tank: TankWithLocation) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg">Loading tanks...</span>
      </div>
    );
  }

  if (tanks.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">No tanks found</p>
        <p className="text-sm text-gray-400">Adjust filters or run a sync</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[180px]">Customer</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Tank</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Capacity</TableHead>
            <TableHead className="w-[160px]">Fill Level</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Last Update</TableHead>
            <TableHead className="w-[60px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tanks.map((tank) => {
            const fillPercent = tank.current_volume_percent || 0;
            const fillColor = fillPercent < 20 ? 'bg-red-500' : fillPercent < 40 ? 'bg-yellow-500' : 'bg-green-500';

            return (
              <TableRow
                key={tank.id}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onTankClick(tank)}
              >
                <TableCell className="font-medium">{tank.customer_name || 'Unknown'}</TableCell>
                <TableCell className="font-mono text-sm">{tank.unit_number}</TableCell>
                <TableCell className="font-mono text-sm">{tank.tank_number}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={tank.description}>
                  {tank.description || tank.name}
                </TableCell>
                <TableCell>
                  {tank.capacity ? `${tank.capacity.toLocaleString()} L` : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2.5">
                        <div
                          className={cn('h-2.5 rounded-full transition-all', fillColor)}
                          style={{ width: `${Math.min(100, fillPercent)}%` }}
                        />
                      </div>
                      <span className={cn('text-sm font-bold', getSmartFillPercentageColor(fillPercent))}>
                        {fillPercent.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {(tank.current_volume || 0).toLocaleString()} L
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      tank.health_status === 'healthy' ? 'default' :
                      tank.health_status === 'warning' ? 'secondary' : 'destructive'
                    }
                    className="text-xs"
                  >
                    {tank.current_status || tank.health_status || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatSmartFillRelativeTime(tank.last_reading_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTankClick(tank); }}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

function SmartFillPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [selectedTank, setSelectedTank] = useState<any>(null);
  const [tankModalOpen, setTankModalOpen] = useState(false);

  // Data hooks
  const { data: overview, isLoading: overviewLoading } = useSmartFillFleetOverview();
  const { data: tanks, isLoading: tanksLoading } = useSmartFillTanks();
  const { data: customerSummaries } = useSmartFillCustomerSummaries();
  const { data: syncLogs } = useSmartFillSyncLogs(20);
  const syncMutation = useSmartFillManualSync();

  // Legacy hooks for backward compatibility
  const { data: legacyLocations } = useSmartFillLocations();
  const legacySummary = useSmartFillSummary();

  // Merge tanks with customer names
  const tanksWithCustomers = useMemo((): TankWithLocation[] => {
    if (tanks && tanks.length > 0) {
      return tanks.map((t) => ({
        ...t,
        customer_name: (t as any).customer?.name || 'Unknown',
        location_name: (t as any).location?.name,
      }));
    }

    // Fallback to legacy data
    if (legacyLocations) {
      const allTanks: TankWithLocation[] = [];
      legacyLocations.forEach((loc: any) => {
        (loc.tanks || []).forEach((tank: any) => {
          allTanks.push({
            id: tank.id,
            location_id: loc.id,
            customer_id: loc.customer_id,
            external_guid: tank.tank_guid,
            unit_number: tank.unit_number,
            tank_number: tank.tank_number,
            name: tank.description,
            description: tank.description,
            capacity: tank.capacity,
            safe_fill_level: tank.safe_fill_level,
            current_volume: tank.latest_volume,
            current_volume_percent: tank.latest_volume_percent,
            current_status: tank.latest_status,
            health_status: (tank.latest_volume_percent || 0) < 20 ? 'critical' :
                          (tank.latest_volume_percent || 0) < 40 ? 'warning' : 'healthy',
            last_reading_at: tank.latest_update_time,
            is_active: true,
            is_monitored: true,
            created_at: tank.created_at,
            updated_at: tank.updated_at,
            customer_name: loc.customer_name,
            location_name: loc.description,
          });
        });
      });
      return allTanks;
    }

    return [];
  }, [tanks, legacyLocations]);

  // Get unique customers for filter
  const uniqueCustomers = useMemo(() => {
    return [...new Set(tanksWithCustomers.map((t) => t.customer_name))].filter(Boolean).sort();
  }, [tanksWithCustomers]);

  // Filter tanks
  const filteredTanks = useMemo(() => {
    return tanksWithCustomers.filter((tank) => {
      const matchesSearch =
        !searchTerm ||
        tank.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.unit_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.tank_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        tank.health_status === statusFilter ||
        tank.current_status?.toLowerCase().includes(statusFilter.toLowerCase());

      const matchesCustomer = customerFilter === 'all' || tank.customer_name === customerFilter;

      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [tanksWithCustomers, searchTerm, statusFilter, customerFilter]);

  // Handle tank click
  const handleTankClick = (tank: TankWithLocation) => {
    // Convert to legacy format for modal compatibility
    setSelectedTank({
      ...tank,
      latest_volume: tank.current_volume,
      latest_volume_percent: tank.current_volume_percent,
      latest_status: tank.current_status,
      latest_update_time: tank.last_reading_at,
      location: {
        customer_name: tank.customer_name,
        description: tank.location_name,
        timezone: 'Australia/Perth',
      },
    });
    setTankModalOpen(true);
  };

  // Calculate summary stats (prefer new data, fallback to legacy)
  const summary = overview || {
    total_customers: legacySummary.totalCustomers,
    total_tanks: legacySummary.totalTanks,
    avg_fill_percent: legacySummary.averageFillPercentage,
    critical_tanks: legacySummary.lowFuelCount,
    warning_tanks: 0,
    healthy_tanks: legacySummary.totalTanks - legacySummary.lowFuelCount,
  };

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gray-50"
    >
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Fuel className="w-7 h-7 text-blue-600" />
                SmartFill Monitoring
              </h1>
              <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                Real-time tank level monitoring via JSON-RPC API
                <SmartFillSyncBadge
                  isRunning={syncMutation.isPending}
                  lastSyncStatus={syncLogs?.[0]?.sync_status}
                />
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', syncMutation.isPending && 'animate-spin')} />
                {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="tanks" className="flex items-center gap-2">
              <Fuel className="w-4 h-4" />
              <span className="hidden sm:inline">Tanks</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {filteredTanks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Sync Logs</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <SmartFillDashboard
              onNavigateToTanks={() => setActiveTab('tanks')}
              onNavigateToCustomers={() => setActiveTab('customers')}
            />
          </TabsContent>

          {/* Tanks Tab */}
          <TabsContent value="tanks" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search tanks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="healthy">Healthy</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={customerFilter} onValueChange={setCustomerFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {uniqueCustomers.map((customer) => (
                          <SelectItem key={customer} value={customer!}>
                            {customer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
                {(searchTerm || statusFilter !== 'all' || customerFilter !== 'all') && (
                  <p className="text-sm text-gray-500 mt-3">
                    Showing {filteredTanks.length} of {tanksWithCustomers.length} tanks
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tank Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="w-5 h-5" />
                  All Tanks ({filteredTanks.length})
                </CardTitle>
                <CardDescription>Click any row for detailed information</CardDescription>
              </CardHeader>
              <CardContent>
                <TankTable
                  tanks={filteredTanks}
                  onTankClick={handleTankClick}
                  isLoading={tanksLoading && !legacyLocations}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <SmartFillAnalyticsTab />
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Customer Fleet Summary</h2>
                <p className="text-sm text-gray-600">
                  {customerSummaries?.length || uniqueCustomers.length} customers tracked
                </p>
              </div>
            </div>

            {customerSummaries && customerSummaries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customerSummaries.map((customer) => (
                  <SmartFillCustomerCard
                    key={customer.customer_id}
                    customer={customer}
                    onClick={() => {
                      setCustomerFilter(customer.customer_name);
                      setActiveTab('tanks');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniqueCustomers.map((customerName) => {
                  const customerTanks = tanksWithCustomers.filter(
                    (t) => t.customer_name === customerName
                  );
                  const avgFill =
                    customerTanks.length > 0
                      ? customerTanks.reduce((sum, t) => sum + (t.current_volume_percent || 0), 0) /
                        customerTanks.length
                      : 0;
                  const critical = customerTanks.filter(
                    (t) => (t.current_volume_percent || 0) < 20
                  ).length;
                  const warning = customerTanks.filter(
                    (t) => (t.current_volume_percent || 0) >= 20 && (t.current_volume_percent || 0) < 40
                  ).length;

                  return (
                    <SmartFillCustomerCard
                      key={customerName}
                      customer={{
                        customer_id: customerName!,
                        customer_name: customerName!,
                        is_active: true,
                        sync_enabled: true,
                        consecutive_failures: 0,
                        location_count: 1,
                        tank_count: customerTanks.length,
                        avg_fill_percent: avgFill,
                        critical_tanks: critical,
                        warning_tanks: warning,
                        healthy_tanks: customerTanks.length - critical - warning,
                        health_score: Math.round(
                          ((customerTanks.length - critical - warning) / customerTanks.length) * 100
                        ),
                      }}
                      onClick={() => {
                        setCustomerFilter(customerName!);
                        setActiveTab('tanks');
                      }}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Sync Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Synchronization History
                </CardTitle>
                <CardDescription>Recent API sync operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customers</TableHead>
                        <TableHead>Tanks</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!syncLogs || syncLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            No sync logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        syncLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {formatSmartFillRelativeTime(log.started_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.sync_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  log.sync_status === 'success'
                                    ? 'default'
                                    : log.sync_status === 'partial'
                                      ? 'secondary'
                                      : 'destructive'
                                }
                              >
                                {log.sync_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {log.customers_success}/{log.customers_attempted}
                            </TableCell>
                            <TableCell>{log.tanks_processed}</TableCell>
                            <TableCell>
                              {log.duration_ms ? `${log.duration_ms}ms` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                              {log.error_message && (
                                <span className="text-red-600">{log.error_message}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tank Detail Modal */}
      <SmartFillTankDetailModal
        tank={selectedTank}
        isOpen={tankModalOpen}
        onClose={() => {
          setTankModalOpen(false);
          setSelectedTank(null);
        }}
      />
    </motion.div>
  );
}

// ============================================================================
// Error Boundary Wrapper
// ============================================================================

const SmartFillPageWithErrorBoundary: React.FC = () => (
  <ErrorBoundary
    fallback={({ error, resetError }) => (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-red-800 mb-3">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="font-semibold text-lg">SmartFill Dashboard Error</h3>
          </div>
          <p className="text-red-700 mb-4">
            Failed to load the SmartFill monitoring dashboard. This may be due to API connectivity
            issues or data processing errors.
          </p>
          <Button onClick={resetError} variant="destructive">
            Retry Loading
          </Button>
        </div>
      </div>
    )}
  >
    <SmartFillPage />
  </ErrorBoundary>
);

export default SmartFillPageWithErrorBoundary;
