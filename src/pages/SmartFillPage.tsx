import React, { useState, useMemo, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  RefreshCw,
  Activity,
  Fuel,
  MapPin,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  Download,
  ExternalLink,
  Eye,
  MoreVertical,
  Users,
  Building2,
  Gauge,
  Timer,
  Droplets,
  Plus,
  ArrowUpDown,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

import {
  useSmartFillLocations,
  useSmartFillSummary,
  useSmartFillSync,
  useSmartFillSyncLogs,
  useSmartFillAPITest,
  useSmartFillSystemHealth,
  useSmartFillAlertsAndActions,
  useSmartFillPercentageColor,
  formatSmartFillTimestamp,
  calculateUllage
} from '@/hooks/useSmartFillData';
import SmartFillTankDetailModal from '@/components/SmartFillTankDetailModal';
import { SmartFillTank, SmartFillLocation } from '@/services/smartfill-api';

const SmartFillPage = () => {
  const [activeTab, setActiveTab] = useState('locations');
  const [fullSyncLoading, setFullSyncLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [sortBy, setSortBy] = useState('customer');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedTank, setSelectedTank] = useState<(SmartFillTank & { location?: SmartFillLocation; customer_name?: string; unit_number?: string }) | null>(null);
  const [tankModalOpen, setTankModalOpen] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');
  
  // Data hooks
  const { data: locations, isLoading, error } = useSmartFillLocations();
  const summary = useSmartFillSummary();
  const { data: syncLogs } = useSmartFillSyncLogs(10);
  const systemHealth = useSmartFillSystemHealth();
  const { actionItems, lowFuelTanks, staleTanks, errorTanks } = useSmartFillAlertsAndActions();
  
  // Mutation hooks
  const syncMutation = useSmartFillSync();
  const apiTestMutation = useSmartFillAPITest();

  // Get all tanks with location info for filtering and sorting
  const allTanks = useMemo(() => {
    if (!locations || !Array.isArray(locations)) return [];
    
    return locations.flatMap(location => {
      if (!Array.isArray(location.tanks)) {
        console.warn('[SMARTFILL PAGE] Location tanks is not an array:', location.tanks);
        return [];
      }
      return location.tanks.map(tank => ({
        ...tank,
        customer_name: location.customer_name,
        unit_number: location.unit_number,
        location: location
      }));
    });
  }, [locations]);

  // Get unique customers for filter dropdown
  const uniqueCustomers = useMemo(() => {
    return [...new Set(allTanks.map(tank => tank.customer_name))].sort();
  }, [allTanks]);

  // Filter and sort tanks based on current filters
  const filteredTanks = useMemo(() => {
    const filtered = allTanks.filter(tank => {
      const matchesSearch = !searchTerm || 
        tank.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.unit_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.tank_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tank.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || tank.latest_status === statusFilter;
      const matchesCustomer = customerFilter === 'all' || tank.customer_name === customerFilter;
      
      return matchesSearch && matchesStatus && matchesCustomer;
    });

    // Sort tanks
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortBy) {
        case 'customer':
          aValue = a.customer_name || '';
          bValue = b.customer_name || '';
          break;
        case 'volume':
          aValue = a.latest_volume_percent || 0;
          bValue = b.latest_volume_percent || 0;
          break;
        case 'updated':
          aValue = new Date(a.latest_update_time || 0);
          bValue = new Date(b.latest_update_time || 0);
          break;
        case 'capacity':
          aValue = a.capacity || 0;
          bValue = b.capacity || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allTanks, searchTerm, statusFilter, customerFilter, sortBy, sortOrder]);

  // Group tanks by customer for grouped view
  const groupedTanks = useMemo(() => {
    const groups = new Map<string, typeof filteredTanks>();
    
    filteredTanks.forEach(tank => {
      const customerName = tank.customer_name || 'Unknown Customer';
      if (!groups.has(customerName)) {
        groups.set(customerName, []);
      }
      groups.get(customerName)!.push(tank);
    });

    // Sort each group's tanks by unit number and tank number
    groups.forEach((tanks) => {
      tanks.sort((a, b) => {
        const aUnit = a.unit_number || '';
        const bUnit = b.unit_number || '';
        if (aUnit !== bUnit) return aUnit.localeCompare(bUnit);
        return (a.tank_number || '').localeCompare(b.tank_number || '');
      });
    });

    // Convert to array and sort by customer name
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([customerName, tanks]) => ({ customerName, tanks }));
  }, [filteredTanks]);

  // Auto-expand all customers when data loads (for better UX in grouped view)
  useEffect(() => {
    if (groupedTanks && groupedTanks.length > 0 && expandedCustomers.size === 0) {
      const allCustomers = new Set(groupedTanks.map(group => group.customerName));
      setExpandedCustomers(allCustomers);
    }
  }, [groupedTanks, expandedCustomers.size]);

  const toggleCustomerExpanded = (customerName: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName);
    } else {
      newExpanded.add(customerName);
    }
    setExpandedCustomers(newExpanded);
  };

  const expandAllCustomers = () => {
    const allCustomers = new Set(groupedTanks.map(group => group.customerName));
    setExpandedCustomers(allCustomers);
  };

  const collapseAllCustomers = () => {
    setExpandedCustomers(new Set());
  };

  const handleFilterByLowFuel = () => {
    setActiveTab('locations');
    setStatusFilter('all');
    setCustomerFilter('all');
    // Filter to show only tanks with < 20% fuel
    const lowFuelPercentage = 20;
    // We'll use a combination of search and sort to highlight low fuel tanks
    setSortBy('volume');
    setSortOrder('asc'); // Show lowest first
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setSortBy('customer');
    setSortOrder('asc');
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleAPITest = () => {
    apiTestMutation.mutate();
  };

  const handleFullSync = async () => {
    setFullSyncLoading(true);
    try {
      const response = await fetch('/api/smartfill-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Full sync completed:', result);
        window.location.reload();
      } else {
        console.error('Full sync failed:', result);
        alert(`Full sync failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Full sync error:', error);
      alert(`Full sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFullSyncLoading(false);
    }
  };

  const handleTankClick = (tank: any) => {
    setSelectedTank(tank);
    setTankModalOpen(true);
  };

  const handleRefreshTank = async (tankId: string) => {
    // Individual tank refresh would require API endpoint
    console.log('Refreshing tank:', tankId);
  };

  const handleExportTank = (tank: any) => {
    const exportData = {
      customer: tank.customer_name,
      unit_number: tank.unit_number,
      tank_number: tank.tank_number,
      description: tank.description,
      capacity: tank.capacity,
      current_volume: tank.latest_volume,
      volume_percent: tank.latest_volume_percent,
      status: tank.latest_status,
      last_updated: tank.latest_update_time,
      exported_at: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartfill-${tank.unit_number}-${tank.tank_number}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportData = () => {
    const exportData = {
      summary: {
        total_customers: summary.totalCustomers,
        total_locations: summary.totalLocations,
        total_tanks: summary.totalTanks,
        average_fill_percentage: summary.averageFillPercentage,
        low_fuel_count: summary.lowFuelCount,
        total_capacity: summary.totalCapacity,
        total_volume: summary.totalVolume
      },
      tanks: filteredTanks.map(tank => ({
        customer: tank.customer_name,
        unit_number: tank.unit_number,
        tank_number: tank.tank_number,
        description: tank.description,
        capacity: tank.capacity,
        safe_fill_level: tank.safe_fill_level,
        current_volume: tank.latest_volume,
        volume_percent: tank.latest_volume_percent,
        status: tank.latest_status,
        last_updated: tank.latest_update_time
      })),
      exported_at: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartfill-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusInfo = (status: string) => {
      const s = status.toLowerCase();
      if (s.includes('ok') || s.includes('normal')) return { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' };
      if (s.includes('offline')) return { variant: 'secondary' as const, icon: Clock, color: 'text-gray-600' };
      if (s.includes('error') || s.includes('fail')) return { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-600' };
      return { variant: 'secondary' as const, icon: AlertCircle, color: 'text-gray-600' };
    };

    const statusInfo = getStatusInfo(status);
    const Icon = statusInfo.icon;

    return (
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const TankMobileCard = ({ tank }: { tank: any }) => {
    const percentageColor = useSmartFillPercentageColor(tank.latest_volume_percent);
    
    return (
      <Card 
        className="p-4 hover:shadow-md cursor-pointer transition-all duration-200 border-l-4 border-blue-400"
        onClick={() => handleTankClick(tank)}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">
                Unit {tank.unit_number} - Tank {tank.tank_number}
              </h3>
              <p className="text-sm text-gray-600">{tank.customer_name}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tank.description}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={tank.latest_status || 'Unknown'} />
            </div>
          </div>

          {/* Fuel Level */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Fuel Level</span>
              <span className={`text-sm font-bold ${percentageColor}`}>
                {(tank.latest_volume_percent || 0).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  tank.latest_volume_percent < 20 ? 'bg-red-500' : 
                  tank.latest_volume_percent < 40 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, tank.latest_volume_percent || 0))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{(tank.latest_volume || 0).toLocaleString()} L current</span>
              <span>{(tank.capacity || 0).toLocaleString()} L capacity</span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
            <div>
              <span className="text-gray-500">Last Update:</span>
              <div className="font-medium text-gray-700">
                {formatSmartFillTimestamp(tank.latest_update_time)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Actions:</span>
              <div className="flex gap-1 mt-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTankClick(tank);
                  }}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportTank(tank);
                  }}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const FuelLevelBar = ({ percentage, volume }: { percentage: number; volume: number }) => {
    const colorClass = percentage < 20 ? 'bg-red-500' : percentage < 40 ? 'bg-yellow-500' : 'bg-green-500';
    const textColorClass = percentage < 20 ? 'text-red-600' : percentage < 40 ? 'text-yellow-600' : 'text-green-600';
    const glowClass = percentage < 20 ? 'shadow-red-500/50' : percentage < 40 ? 'shadow-yellow-500/50' : 'shadow-green-500/50';

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-3 shadow-inner">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${colorClass} ${percentage < 20 ? 'shadow-lg ' + glowClass : ''}`}
              style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
            />
          </div>
          <span className={`text-base font-bold ${textColorClass}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="text-xs text-gray-600 font-medium">
          {volume.toLocaleString()} L
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg">Loading SmartFill data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            SmartFill System Error
          </CardTitle>
          <CardDescription>
            Failed to load SmartFill data: {error.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={handleSync} disabled={syncMutation.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Retry Sync
            </Button>
            <Button variant="outline" onClick={handleAPITest} disabled={apiTestMutation.isPending}>
              <Activity className="w-4 h-4 mr-2" />
              Test API
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            SmartFill Monitoring
          </h1>
          <p className="text-gray-600 mt-1">JSON-RPC API fuel level monitoring for 33 customers</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleAPITest} 
            variant="outline"
            size="sm"
            disabled={apiTestMutation.isPending}
          >
            <Activity className={`w-4 h-4 mr-2 ${apiTestMutation.isPending ? 'animate-spin' : ''}`} />
            Test API
          </Button>
          <Button 
            onClick={handleSync}
            variant="outline"
            size="sm"
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Quick Sync
          </Button>
          <Button 
            onClick={handleFullSync}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            size="sm"
            disabled={fullSyncLoading}
          >
            <Database className={`w-4 h-4 mr-2 ${fullSyncLoading ? 'animate-spin' : ''}`} />
            Full API Sync
          </Button>
        </div>
      </div>

      {/* Enhanced System Health Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className={`bg-gradient-to-br ${systemHealth.isHealthy ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} hover:shadow-lg transition-all duration-300`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${systemHealth.isHealthy ? 'text-green-700' : 'text-red-700'}`}>API Status</p>
                <p className={`text-xl font-bold ${systemHealth.isHealthy ? 'text-green-900' : 'text-red-900'}`}>
                  {systemHealth.apiHealth.status.toUpperCase()}
                </p>
              </div>
              {systemHealth.isHealthy ? 
                <CheckCircle className="w-8 h-8 text-green-600" /> : 
                <XCircle className="w-8 h-8 text-red-600" />
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Customers</p>
                <p className="text-xl font-bold text-blue-900">{summary.totalCustomers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Locations</p>
                <p className="text-xl font-bold text-purple-900">{summary.totalLocations}</p>
              </div>
              <Building2 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Total Tanks</p>
                <p className="text-xl font-bold text-gray-900">{summary.totalTanks}</p>
              </div>
              <Fuel className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Avg Fill Level</p>
                <p className="text-xl font-bold text-green-900">{summary.averageFillPercentage}%</p>
              </div>
              <Gauge className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-gradient-to-br ${summary.lowFuelCount > 0 ? 'from-red-50 to-red-100 border-red-200' : 'from-green-50 to-green-100 border-green-200'} hover:shadow-lg transition-all duration-300 cursor-pointer`}
          onClick={summary.lowFuelCount > 0 ? handleFilterByLowFuel : handleResetFilters}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${summary.lowFuelCount > 0 ? 'text-red-700' : 'text-green-700'}`}>Low Fuel Tanks</p>
                <p className={`text-xl font-bold ${summary.lowFuelCount > 0 ? 'text-red-900' : 'text-green-900'}`}>{summary.lowFuelCount}</p>
                {summary.lowFuelCount > 0 && (
                  <p className="text-xs text-red-600 mt-1">Click to view</p>
                )}
              </div>
              {summary.lowFuelCount > 0 ?
                <AlertTriangle className="w-8 h-8 text-red-600" /> :
                <CheckCircle className="w-8 h-8 text-green-600" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="locations">Tanks ({filteredTanks.length})</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {actionItems.length > 0 && <Badge variant="destructive" className="ml-1">{actionItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          {/* Enhanced Search and Filters */}
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by customer, unit, tank, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
                
                <div className="flex flex-wrap gap-3 items-center">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Ok">Operational</SelectItem>
                      <SelectItem value="Offline">Offline</SelectItem>
                      <SelectItem value="Error">Error</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={customerFilter} onValueChange={setCustomerFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      {uniqueCustomers.map(customer => (
                        <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                    const [field, order] = value.split('-');
                    setSortBy(field);
                    setSortOrder(order as 'asc' | 'desc');
                  }}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer-asc">Customer A-Z</SelectItem>
                      <SelectItem value="customer-desc">Customer Z-A</SelectItem>
                      <SelectItem value="volume-desc">Fuel Level High-Low</SelectItem>
                      <SelectItem value="volume-asc">Fuel Level Low-High</SelectItem>
                      <SelectItem value="updated-desc">Recently Updated</SelectItem>
                      <SelectItem value="capacity-desc">Capacity High-Low</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Desktop View Toggle */}
                  <div className="hidden sm:flex items-center gap-1 border rounded-md p-1">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className="h-7"
                    >
                      <ArrowUpDown className="w-4 h-4 mr-1" />
                      Table
                    </Button>
                    <Button
                      variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grouped')}
                      className="h-7"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Grouped
                    </Button>
                  </div>

                  {/* Mobile View Toggle */}
                  <div className="sm:hidden flex items-center gap-1 border rounded-md p-1">
                    <Button
                      variant={mobileView === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setMobileView('cards')}
                      className="h-7"
                    >
                      <Building2 className="w-4 h-4 mr-1" />
                      Cards
                    </Button>
                    <Button
                      variant={mobileView === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setMobileView('table')}
                      className="h-7"
                    >
                      <ArrowUpDown className="w-4 h-4 mr-1" />
                      Table
                    </Button>
                  </div>

                  <Button variant="outline" onClick={handleExportData} size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              
              {(searchTerm || statusFilter !== 'all' || customerFilter !== 'all') && (
                <div className="mt-4 text-sm text-gray-600">
                  Showing {filteredTanks.length} of {allTanks.length} tanks
                  {searchTerm && ` matching "${searchTerm}"`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Tank Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="w-5 h-5" />
                SmartFill Tanks ({filteredTanks.length})
              </CardTitle>
              <CardDescription>
                Live data from SmartFill JSON-RPC API - Click any tank for detailed information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {viewMode === 'grouped' && groupedTanks.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-center">
                  <div className="text-sm text-blue-700 font-medium">
                    <Building2 className="w-4 h-4 inline mr-2" />
                    {groupedTanks.length} Customer Groups • {expandedCustomers.size} Expanded
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={expandAllCustomers}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Expand All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={collapseAllCustomers}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <ChevronRight className="w-4 h-4 mr-1" />
                      Collapse All
                    </Button>
                  </div>
                </div>
              )}

              {viewMode === 'table' ? (
                <>
                  {/* Mobile Card View */}
                  <div className="sm:hidden">
                    {mobileView === 'cards' ? (
                      <div className="grid gap-4">
                        {filteredTanks.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            {locations?.length === 0 ? (
                              <div className="flex flex-col items-center gap-2">
                                <Database className="w-12 h-12 text-gray-300" />
                                <p>No SmartFill data found</p>
                                <p className="text-sm">Run a full sync to fetch tank data from the API</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Filter className="w-12 h-12 text-gray-300" />
                                <p>No tanks match your filters</p>
                                <p className="text-sm">Try adjusting your search or filter criteria</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          filteredTanks.map(tank => (
                            <TankMobileCard 
                              key={`${tank.unit_number}-${tank.tank_number}`}
                              tank={tank}
                            />
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[120px]">Customer</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Tank</TableHead>
                              <TableHead className="min-w-[100px]">Fuel Level</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTanks.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                  {locations?.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2">
                                      <Database className="w-12 h-12 text-gray-300" />
                                      <p>No SmartFill data found</p>
                                      <p className="text-sm">Run a full sync to fetch tank data from the API</p>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-2">
                                      <Filter className="w-12 h-12 text-gray-300" />
                                      <p>No tanks match your filters</p>
                                      <p className="text-sm">Try adjusting your search or filter criteria</p>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredTanks.map(tank => (
                                <TableRow 
                                  key={`${tank.unit_number}-${tank.tank_number}`}
                                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                                  onClick={() => handleTankClick(tank)}
                                >
                                  <TableCell className="font-medium text-sm">
                                    {tank.customer_name}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">{tank.unit_number}</TableCell>
                                  <TableCell className="font-mono text-sm">{tank.tank_number}</TableCell>
                                  <TableCell>
                                    <FuelLevelBar 
                                      percentage={tank.latest_volume_percent || 0} 
                                      volume={tank.latest_volume || 0}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={tank.latest_status || 'Unknown'} />
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Customer</TableHead>
                          <TableHead>Unit #</TableHead>
                          <TableHead>Tank #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[120px]">Capacity</TableHead>
                          <TableHead className="w-[160px]">Fuel Level</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[120px]">Last Update</TableHead>
                          <TableHead className="w-[60px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                    {filteredTanks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          {locations?.length === 0 ? (
                            <div className="flex flex-col items-center gap-2">
                              <Database className="w-12 h-12 text-gray-300" />
                              <p>No SmartFill data found</p>
                              <p className="text-sm">Run a full sync to fetch tank data from the API</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Filter className="w-12 h-12 text-gray-300" />
                              <p>No tanks match your filters</p>
                              <p className="text-sm">Try adjusting your search or filter criteria</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTanks.map(tank => (
                        <TableRow 
                          key={`${tank.unit_number}-${tank.tank_number}`}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleTankClick(tank)}
                        >
                          <TableCell className="font-medium">{tank.customer_name}</TableCell>
                          <TableCell className="font-mono text-sm">{tank.unit_number}</TableCell>
                          <TableCell className="font-mono text-sm">{tank.tank_number}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={tank.description}>
                            {tank.description}
                          </TableCell>
                          <TableCell>{tank.capacity ? `${tank.capacity.toLocaleString()} L` : 'N/A'}</TableCell>
                          <TableCell>
                            <FuelLevelBar 
                              percentage={tank.latest_volume_percent || 0} 
                              volume={tank.latest_volume || 0}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={tank.latest_status || 'Unknown'} />
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            <div className="flex flex-col">
                              <span>{formatSmartFillTimestamp(tank.latest_update_time)}</span>
                              <span className="text-xs text-gray-500">{tank.latest_update_time?.split(' ')[0]}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Tank Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleTankClick(tank);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleRefreshTank(tank.id);
                                }}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Refresh Data
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportTank(tank);
                                }}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Tank Data
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                /* Grouped View */
                <div className="space-y-4">
                  {groupedTanks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {locations?.length === 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          <Database className="w-12 h-12 text-gray-300" />
                          <p>No SmartFill data found</p>
                          <p className="text-sm">Run a full sync to fetch tank data from the API</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="w-12 h-12 text-gray-300" />
                          <p>No tanks match your filters</p>
                          <p className="text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    groupedTanks.map(({ customerName, tanks }) => {
                      const avgFuelLevel = (tanks.reduce((sum, tank) => sum + (tank.latest_volume_percent || 0), 0)) / tanks.length;
                      const criticalTanks = tanks.filter(t => (t.latest_volume_percent || 0) < 20).length;
                      const lowTanks = tanks.filter(t => (t.latest_volume_percent || 0) >= 20 && (t.latest_volume_percent || 0) < 40).length;
                      const operationalTanks = tanks.filter(t => t.latest_status?.toLowerCase().includes('ok')).length;

                      // Determine overall health color
                      const healthColor = criticalTanks > 0 ? 'border-red-400' : lowTanks > 0 ? 'border-yellow-400' : 'border-green-400';
                      const healthBg = criticalTanks > 0 ? 'bg-red-50' : lowTanks > 0 ? 'bg-yellow-50' : 'bg-green-50';

                      return (
                        <Card key={customerName} className={`border-l-4 ${healthColor} ${healthBg}`}>
                          <CardHeader className="pb-3">
                            <div
                              className="flex items-center justify-between cursor-pointer group"
                              onClick={() => toggleCustomerExpanded(customerName)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {expandedCustomers.has(customerName) ? (
                                    <ChevronDown className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-blue-600" />
                                  )}
                                  <Building2 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                                    {customerName}
                                    {criticalTanks > 0 && (
                                      <Badge variant="destructive" className="ml-2 text-xs">
                                        {criticalTanks} Critical
                                      </Badge>
                                    )}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    {tanks.length} tank{tanks.length !== 1 ? 's' : ''} •
                                    Avg: <span className={`font-semibold ${avgFuelLevel < 20 ? 'text-red-600' : avgFuelLevel < 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                                      {avgFuelLevel.toFixed(1)}%
                                    </span> fuel level
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <Badge
                                    variant="outline"
                                    className={`${criticalTanks > 0 ? 'bg-red-100 text-red-700 border-red-300' : lowTanks > 0 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-green-100 text-green-700 border-green-300'}`}
                                  >
                                    {criticalTanks > 0 && (
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                    )}
                                    {tanks.length} tanks
                                  </Badge>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {operationalTanks} operational
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        
                        {expandedCustomers.has(customerName) && (
                          <CardContent className="pt-0">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50">
                                    <TableHead>Unit #</TableHead>
                                    <TableHead>Tank #</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[120px]">Capacity</TableHead>
                                    <TableHead className="w-[160px]">Fuel Level</TableHead>
                                    <TableHead className="w-[100px]">Status</TableHead>
                                    <TableHead className="w-[120px]">Last Update</TableHead>
                                    <TableHead className="w-[60px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tanks.map(tank => (
                                    <TableRow 
                                      key={`${tank.unit_number}-${tank.tank_number}`}
                                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                                      onClick={() => handleTankClick(tank)}
                                    >
                                      <TableCell className="font-mono text-sm">{tank.unit_number}</TableCell>
                                      <TableCell className="font-mono text-sm">{tank.tank_number}</TableCell>
                                      <TableCell className="max-w-[200px] truncate" title={tank.description}>
                                        {tank.description}
                                      </TableCell>
                                      <TableCell>{tank.capacity ? `${tank.capacity.toLocaleString()} L` : 'N/A'}</TableCell>
                                      <TableCell>
                                        <FuelLevelBar 
                                          percentage={tank.latest_volume_percent || 0} 
                                          volume={tank.latest_volume || 0}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <StatusBadge status={tank.latest_status || 'Unknown'} />
                                      </TableCell>
                                      <TableCell className="text-sm text-gray-600">
                                        <div className="flex flex-col">
                                          <span>{formatSmartFillTimestamp(tank.latest_update_time)}</span>
                                          <span className="text-xs text-gray-500">{tank.latest_update_time?.split(' ')[0]}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Tank Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleTankClick(tank);
                                            }}>
                                              <Eye className="w-4 h-4 mr-2" />
                                              View Details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleRefreshTank(tank.id);
                                            }}>
                                              <RefreshCw className="w-4 h-4 mr-2" />
                                              Refresh Data
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleExportTank(tank);
                                            }}>
                                              <Download className="w-4 h-4 mr-2" />
                                              Export Tank Data
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-red-200">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{lowFuelTanks.length}</p>
                <p className="text-sm text-gray-600">Low Fuel (&lt;20%)</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{staleTanks.length}</p>
                <p className="text-sm text-gray-600">Stale Data (&gt;24h)</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{errorTanks.length}</p>
                <p className="text-sm text-gray-600">Error Status</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>Tanks and locations requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <div className="text-center py-8 text-green-600">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-medium">All systems operational</p>
                  <p className="text-sm text-gray-600">No action items at this time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionItems.map((item, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border-l-4 ${
                        item.priority === 'high' ? 'border-red-500 bg-red-50' :
                        item.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {item.type === 'low_fuel' && <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />}
                        {item.type === 'stale_data' && <Clock className="w-4 h-4 text-yellow-600 mt-0.5" />}
                        {item.type === 'error' && <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.message}</p>
                          <Badge 
                            variant={item.priority === 'high' ? 'destructive' : 'secondary'}
                            className="mt-1 text-xs"
                          >
                            {item.priority.toUpperCase()} PRIORITY
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>Recent SmartFill API synchronization history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Locations</TableHead>
                      <TableHead>Tanks</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No sync logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncLogs?.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {formatSmartFillTimestamp(log.started_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.sync_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                log.sync_status === 'success' ? 'default' :
                                log.sync_status === 'partial' ? 'secondary' :
                                'destructive'
                              }
                            >
                              {log.sync_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.locations_processed || 0}</TableCell>
                          <TableCell>{log.tanks_processed || 0}</TableCell>
                          <TableCell className="text-sm">
                            {log.sync_duration_ms ? `${log.sync_duration_ms}ms` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {log.error_message && (
                              <span className="text-red-600 text-xs">
                                {log.error_message.substring(0, 50)}...
                              </span>
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

      {/* SmartFill Tank Detail Modal */}
      <SmartFillTankDetailModal
        tank={selectedTank}
        isOpen={tankModalOpen}
        onClose={() => {
          setTankModalOpen(false);
          setSelectedTank(null);
        }}
        onRefreshTank={handleRefreshTank}
      />
    </div>
  );
};

// Wrap with ErrorBoundary for better error handling
const SmartFillPageWithErrorBoundary: React.FC = () => (
  <ErrorBoundary 
    fallback={({ error, resetError }) => (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold">SmartFill Dashboard Error</h3>
          </div>
          <p className="text-red-700 mb-4">
            Failed to load SmartFill tank data. This may be due to API connectivity issues or data processing errors.
          </p>
          <button 
            onClick={resetError}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )}
  >
    <SmartFillPage />
  </ErrorBoundary>
);

export default SmartFillPageWithErrorBoundary;