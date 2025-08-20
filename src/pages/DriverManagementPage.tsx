/**
 * Driver Management Page
 * Modern table-based driver management interface with advanced filtering, sorting, and bulk operations
 * Optimized for fleet management workflows with enhanced data density and usability
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, AlertTriangle, TrendingUp, Shield, Download, Search, Filter, Eye, User,
  ChevronDown, ChevronUp, ArrowUpDown, MoreVertical, CheckSquare, Square,
  Calendar, Activity, Phone, Mail, FileText, Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DataCentreLayout from '@/components/DataCentreLayout';
import { useDriverManagementData, useDriverAlerts, useDriverSearch } from '@/hooks/useDriverProfile';
import DriverAnalyticsModal from '@/components/modals/DriverAnalyticsModal';

type SortField = 'name' | 'fleet' | 'safety_score' | 'lytx_events' | 'guardian_events' | 'high_risk_events' | 'last_activity' | 'total_trips';
type SortDirection = 'asc' | 'desc';
type RiskFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'inactive' | 'needs_attention';

interface DriverManagementPageProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
}

interface DriverWithSelection extends ReturnType<typeof useDriverManagementData>['drivers'][0] {
  selected?: boolean;
}

export const DriverManagementPage: React.FC<DriverManagementPageProps> = ({ fleet }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '1y'>('30d');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFleet, setSelectedFleet] = useState<string>(fleet || '');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  // Table state
  const [sortField, setSortField] = useState<SortField>('safety_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Fetch driver management data
  const {
    drivers,
    isLoading,
    error,
    refetch
  } = useDriverManagementData(selectedFleet);

  // Get real-time alerts
  const {
    alerts,
    alertCount,
    criticalCount,
    isLoading: isLoadingAlerts
  } = useDriverAlerts(selectedFleet);

  // Search drivers
  const {
    data: searchResults,
    isLoading: isSearching
  } = useDriverSearch(searchTerm, selectedFleet, {
    enabled: searchTerm.length >= 2
  });

  // Filter, sort, and paginate drivers
  const filteredAndSortedDrivers = useMemo(() => {
    let filtered = drivers.filter(driver => {
      // Text search filter
      if (searchTerm.length >= 2) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          driver.full_name.toLowerCase().includes(searchLower) ||
          driver.employee_id?.toLowerCase().includes(searchLower) ||
          driver.fleet.toLowerCase().includes(searchLower) ||
          driver.depot?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Risk level filter
      if (riskFilter !== 'all') {
        const riskLevel = driver.high_risk_events_30d > 0 ? 'critical' :
                         (driver.lytx_events_30d + driver.guardian_events_30d) > 3 ? 'high' :
                         (driver.lytx_events_30d + driver.guardian_events_30d) > 0 ? 'medium' : 'low';
        if (riskLevel !== riskFilter) return false;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        const isActive = driver.active_days_30d > 0;
        const needsAttention = driver.high_risk_events_30d > 0 || 
                              (driver.lytx_events_30d + driver.guardian_events_30d) > 2;
        
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
        if (statusFilter === 'needs_attention' && !needsAttention) return false;
      }
      
      return true;
    });
    
    // Sort filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.full_name;
          bValue = b.full_name;
          break;
        case 'fleet':
          aValue = a.fleet;
          bValue = b.fleet;
          break;
        case 'safety_score':
          aValue = a.overall_safety_score || 0;
          bValue = b.overall_safety_score || 0;
          break;
        case 'lytx_events':
          aValue = a.lytx_events_30d;
          bValue = b.lytx_events_30d;
          break;
        case 'guardian_events':
          aValue = a.guardian_events_30d;
          bValue = b.guardian_events_30d;
          break;
        case 'high_risk_events':
          aValue = a.high_risk_events_30d;
          bValue = b.high_risk_events_30d;
          break;
        case 'last_activity':
          aValue = a.last_activity_date ? new Date(a.last_activity_date).getTime() : 0;
          bValue = b.last_activity_date ? new Date(b.last_activity_date).getTime() : 0;
          break;
        case 'total_trips':
          aValue = a.total_trips_30d;
          bValue = b.total_trips_30d;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      
      if (typeof aValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });
    
    return filtered;
  }, [drivers, searchTerm, riskFilter, statusFilter, sortField, sortDirection]);
  
  // Paginated drivers for current page
  const paginatedDrivers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedDrivers.slice(startIndex, endIndex);
  }, [filteredAndSortedDrivers, currentPage, itemsPerPage]);
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedDrivers.length / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  
  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskFilter, statusFilter, selectedFleet]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!drivers.length) {
      return {
        totalDrivers: 0,
        totalTrips: 0,
        totalKm: 0,
        averageSafetyScore: 0,
        totalLytxEvents: 0,
        totalGuardianEvents: 0,
        totalHighRiskEvents: 0,
        activeDrivers: 0
      };
    }
    
    return {
      totalDrivers: drivers.length,
      totalTrips: drivers.reduce((sum, d) => sum + d.total_trips_30d, 0),
      totalKm: drivers.reduce((sum, d) => sum + d.total_km_30d, 0),
      averageSafetyScore: Math.round(drivers.reduce((sum, d) => sum + d.overall_safety_score, 0) / drivers.length),
      totalLytxEvents: drivers.reduce((sum, d) => sum + d.lytx_events_30d, 0),
      totalGuardianEvents: drivers.reduce((sum, d) => sum + d.guardian_events_30d, 0),
      totalHighRiskEvents: drivers.reduce((sum, d) => sum + d.high_risk_events_30d, 0),
      activeDrivers: drivers.filter(d => d.active_days_30d > 0).length
    };
  }, [drivers]);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedDrivers.size === filteredAndSortedDrivers.length) {
      setSelectedDrivers(new Set());
    } else {
      setSelectedDrivers(new Set(filteredAndSortedDrivers.map(d => d.id)));
    }
  };

  const handleSelectDriver = (driverId: string) => {
    const newSelection = new Set(selectedDrivers);
    if (newSelection.has(driverId)) {
      newSelection.delete(driverId);
    } else {
      newSelection.add(driverId);
    }
    setSelectedDrivers(newSelection);
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Risk level calculation
  const getRiskLevel = (driver: any): 'critical' | 'high' | 'medium' | 'low' => {
    if (driver.high_risk_events_30d > 0) return 'critical';
    if ((driver.lytx_events_30d + driver.guardian_events_30d) > 3) return 'high';
    if ((driver.lytx_events_30d + driver.guardian_events_30d) > 0) return 'medium';
    return 'low';
  };

  // Get risk color
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Days since last activity
  const getDaysSinceActivity = (lastActivity: string | null): number | null => {
    if (!lastActivity) return null;
    return Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
  };

  // Export selected drivers
  const handleExportSelected = async () => {
    const selectedDriverData = filteredAndSortedDrivers.filter(d => selectedDrivers.has(d.id));
    
    try {
      const report = {
        exported: new Date().toISOString(),
        selection_criteria: {
          fleet: selectedFleet || 'All Fleets',
          timeframe: selectedTimeframe,
          risk_filter: riskFilter,
          status_filter: statusFilter,
          search_term: searchTerm
        },
        drivers: selectedDriverData.map(driver => ({
          name: driver.full_name,
          employee_id: driver.employee_id,
          fleet: driver.fleet,
          depot: driver.depot,
          safety_score: driver.overall_safety_score,
          risk_level: getRiskLevel(driver),
          high_risk_events: driver.high_risk_events_30d,
          lytx_events: driver.lytx_events_30d,
          guardian_events: driver.guardian_events_30d,
          total_trips: driver.total_trips_30d,
          total_km: driver.total_km_30d,
          active_days: driver.active_days_30d,
          last_activity: driver.last_activity_date
        }))
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `selected_drivers_${selectedDriverData.length}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleExportReport = async () => {
    try {
      const report = {
        fleet: selectedFleet || 'All Fleets',
        generated: new Date().toISOString(),
        timeframe: selectedTimeframe,
        summary: summaryStats,
        alerts: alerts,
        drivers: drivers.map(driver => ({
          name: driver.full_name,
          employee_id: driver.employee_id,
          fleet: driver.fleet,
          depot: driver.depot,
          safety_score: driver.overall_safety_score,
          risk_level: driver.guardian_risk_level,
          high_risk_events: driver.high_risk_events_30d,
          lytx_events: driver.lytx_events_30d,
          guardian_events: driver.guardian_events_30d,
        }))
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `driver_management_report_${selectedFleet?.replace(/\s+/g, '_') || 'all_fleets'}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleDriverClick = (driverId: string) => {
    setSelectedDriverId(driverId);
  };

  return (
    <>
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              Driver Management
              {selectedFleet && (
                <Badge variant="outline" className="ml-2">
                  {selectedFleet}
                </Badge>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive driver analytics, safety monitoring, and performance management
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Fleet Filter */}
            <select
              value={selectedFleet}
              onChange={(e) => setSelectedFleet(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Fleets</option>
              <option value="Stevemacs">Stevemacs</option>
              <option value="Great Southern Fuels">Great Southern Fuels</option>
            </select>
            
            {/* Timeframe Selector */}
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
            
            <Button
              onClick={handleExportReport}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            
            <Button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Alert Banner */}
        {criticalCount > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Critical Attention Required
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {criticalCount} driver{criticalCount > 1 ? 's' : ''} require immediate attention due to critical safety events.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Drivers</p>
                  <p className="text-2xl font-bold text-blue-600">{summaryStats.totalDrivers}</p>
                </div>
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <span className="text-green-600 font-medium">{summaryStats.activeDrivers} Active</span>
                <span className="mx-1">•</span>
                <span className="text-gray-600">{summaryStats.totalTrips} Trips</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Safety Score</p>
                  <p className={`text-2xl font-bold ${
                    summaryStats.averageSafetyScore >= 80 ? 'text-green-600' :
                    summaryStats.averageSafetyScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {summaryStats.averageSafetyScore}
                  </p>
                </div>
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
              <p className="text-xs text-gray-600 mt-2">Fleet average</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total KM (30d)</p>
                  <p className="text-2xl font-bold text-green-600">{summaryStats.totalKm.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <span>LYTX: {summaryStats.totalLytxEvents}</span>
                <span className="mx-1">•</span>
                <span>Guardian: {summaryStats.totalGuardianEvents}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Safety Events</p>
                  <p className="text-2xl font-bold text-orange-600">{summaryStats.totalHighRiskEvents}</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
              <p className="text-xs text-gray-600 mt-2">High-risk events</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Toolbar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Search Section */}
              <div className="w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search drivers by name, ID, fleet, or depot..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {/* Filters Section */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                {/* Fleet Filter */}
                <select
                  value={selectedFleet}
                  onChange={(e) => setSelectedFleet(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Fleets</option>
                  <option value="Stevemacs">Stevemacs</option>
                  <option value="Great Southern Fuels">Great Southern Fuels</option>
                </select>
                
                {/* Risk Filter */}
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="critical">Critical Risk</option>
                  <option value="high">High Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="low">Low Risk</option>
                </select>
                
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Drivers</option>
                  <option value="inactive">Inactive Drivers</option>
                  <option value="needs_attention">Needs Attention</option>
                </select>
                
                {/* Timeframe */}
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportReport}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export All</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                  
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant="outline"
                    size="sm"
                    className="lg:hidden flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Data Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Driver Management Table
                <Badge variant="outline" className="ml-2">
                  {filteredAndSortedDrivers.length} of {drivers.length}
                </Badge>
              </CardTitle>
              
              {selectedDrivers.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedDrivers.size} selected</span>
                  <Button
                    onClick={() => setSelectedDrivers(new Set())}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading drivers...</p>
              </div>
            ) : filteredAndSortedDrivers.length > 0 ? (
              <>
                {/* Mobile Card View (hidden on desktop) */}
                <div className="block lg:hidden">
                <div className="space-y-3 p-4">
                  {paginatedDrivers.map((driver) => {
                    const riskLevel = getRiskLevel(driver);
                    const riskColor = getRiskColor(riskLevel);
                    const daysSinceActivity = getDaysSinceActivity(driver.last_activity_date);
                    const isSelected = selectedDrivers.has(driver.id);
                    
                    return (
                      <div
                        key={driver.id}
                        className={`p-4 rounded-lg border-l-4 transition-all ${
                          riskLevel === 'critical' ? 'border-red-500 bg-red-50' :
                          riskLevel === 'high' ? 'border-orange-500 bg-orange-50' :
                          riskLevel === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                          'border-green-500 bg-green-50'
                        } ${isSelected ? 'ring-2 ring-blue-200' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectDriver(driver.id)}
                            />
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{driver.full_name}</p>
                              <p className="text-sm text-gray-600">{driver.employee_id || 'No ID'}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDriverClick(driver.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <FileText className="h-4 w-4 mr-2" />
                                Export Data
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                Contact
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Fleet:</span>
                            <p className="font-medium">{driver.fleet}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Depot:</span>
                            <p className="font-medium">{driver.depot || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Safety Score:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{driver.overall_safety_score || 'N/A'}</span>
                              <Badge 
                                variant={riskLevel === 'critical' ? 'destructive' : 
                                        riskLevel === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {riskLevel.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Events:</span>
                            <p className="font-medium">
                              {driver.lytx_events_30d} LYTX, {driver.guardian_events_30d} Guardian
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Activity:</span>
                            <p className="font-medium">
                              {driver.total_trips_30d} trips, {driver.active_days_30d} days
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Active:</span>
                            <p className={`font-medium ${
                              daysSinceActivity === null ? 'text-gray-500' :
                              daysSinceActivity === 0 ? 'text-green-600' :
                              daysSinceActivity <= 7 ? 'text-blue-600' :
                              daysSinceActivity <= 14 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {daysSinceActivity === null ? 'No data' :
                               daysSinceActivity === 0 ? 'Today' :
                               daysSinceActivity === 1 ? '1 day ago' :
                               `${daysSinceActivity} days ago`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <Button
                            onClick={() => handleDriverClick(driver.id)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Full Profile
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Desktop Table View (hidden on mobile) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={selectedDrivers.size === filteredAndSortedDrivers.length && filteredAndSortedDrivers.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Driver
                          {sortField === 'name' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('fleet')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Fleet & Depot
                          {sortField === 'fleet' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('safety_score')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Safety Score
                          {sortField === 'safety_score' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('lytx_events')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          LYTX Events
                          {sortField === 'lytx_events' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('guardian_events')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Guardian Events
                          {sortField === 'guardian_events' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('total_trips')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Activity (30d)
                          {sortField === 'total_trips' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('last_activity')}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Last Activity
                          {sortField === 'last_activity' ? (
                            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedDrivers.map((driver) => {
                      const riskLevel = getRiskLevel(driver);
                      const riskColor = getRiskColor(riskLevel);
                      const daysSinceActivity = getDaysSinceActivity(driver.last_activity_date);
                      const isSelected = selectedDrivers.has(driver.id);
                      
                      return (
                        <tr
                          key={driver.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            riskLevel === 'critical' ? 'bg-red-50' :
                            riskLevel === 'high' ? 'bg-orange-50' :
                            riskLevel === 'medium' ? 'bg-yellow-50' :
                            'bg-white'
                          } ${isSelected ? 'ring-2 ring-blue-200' : ''}`}
                        >
                          <td className="w-12 px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectDriver(driver.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {driver.full_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  ID: {driver.employee_id || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{driver.fleet}</p>
                              <p className="text-xs text-gray-500">{driver.depot || 'No depot'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`px-2 py-1 text-xs font-medium rounded-full border ${riskColor}`}>
                                {driver.overall_safety_score || 'N/A'}
                              </div>
                              <Badge 
                                variant={riskLevel === 'critical' ? 'destructive' : 
                                        riskLevel === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {riskLevel.toUpperCase()}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-center">
                              <div className={`text-sm font-medium ${
                                driver.lytx_events_30d > 5 ? 'text-red-600' :
                                driver.lytx_events_30d > 2 ? 'text-orange-600' :
                                driver.lytx_events_30d > 0 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {driver.lytx_events_30d}
                              </div>
                              <div className="text-xs text-gray-500">events</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-center">
                              <div className={`text-sm font-medium ${
                                driver.guardian_events_30d > 3 ? 'text-red-600' :
                                driver.guardian_events_30d > 1 ? 'text-orange-600' :
                                driver.guardian_events_30d > 0 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {driver.guardian_events_30d}
                              </div>
                              <div className="text-xs text-gray-500">events</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {driver.total_trips_30d} trips
                              </div>
                              <div className="text-xs text-gray-500">
                                {driver.total_km_30d.toLocaleString()} km • {driver.active_days_30d} days
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className={`text-sm font-medium ${
                                daysSinceActivity === null ? 'text-gray-500' :
                                daysSinceActivity === 0 ? 'text-green-600' :
                                daysSinceActivity <= 7 ? 'text-blue-600' :
                                daysSinceActivity <= 14 ? 'text-orange-600' : 'text-red-600'
                              }`}>
                                {daysSinceActivity === null ? 'No data' :
                                 daysSinceActivity === 0 ? 'Today' :
                                 daysSinceActivity === 1 ? '1 day ago' :
                                 `${daysSinceActivity} days ago`}
                              </div>
                              <div className="text-xs text-gray-500">
                                {driver.last_activity_date 
                                  ? new Date(driver.last_activity_date).toLocaleDateString()
                                  : 'Never'
                                }
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => handleDriverClick(driver.id)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleDriverClick(driver.id)}>
                                    <User className="h-4 w-4 mr-2" />
                                    View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Export Data
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Contact Driver
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Manage
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredAndSortedDrivers.length > 0 && (
                <div className="hidden lg:flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">Show:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-700">per page</span>
                    </div>
                    
                    {selectedDrivers.size > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleSelectAllPages}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          {selectedDrivers.size === filteredAndSortedDrivers.length ? 'Deselect All' : 'Select All Pages'}
                        </Button>
                        <span className="text-sm text-gray-600">
                          {selectedDrivers.size} of {filteredAndSortedDrivers.length} selected
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedDrivers.length)} of {filteredAndSortedDrivers.length} drivers
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => setCurrentPage(1)}
                        disabled={!hasPrevPage}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        ««
                      </Button>
                      <Button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={!hasPrevPage}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        ‹
                      </Button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="px-3"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      
                      <Button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!hasNextPage}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        ›
                      </Button>
                      <Button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={!hasNextPage}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        »»
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No drivers found</p>
                <p className="text-sm text-gray-500">
                  {drivers.length === 0 
                    ? 'No driver data available for the selected fleet'
                    : 'Try adjusting your search or filter criteria'
                  }
                </p>
              </div>
            )}
            
            {/* Mobile Pagination */}
            {filteredAndSortedDrivers.length > 0 && (
              <div className="block lg:hidden px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <span className="text-sm text-gray-700">
                    {filteredAndSortedDrivers.length} total
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={!hasPrevPage}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    ‹ Previous
                  </Button>
                  
                  {selectedDrivers.size > 0 && (
                    <div className="text-xs text-gray-600">
                      {selectedDrivers.size} selected
                    </div>
                  )}
                  
                  <Button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={!hasNextPage}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    Next ›
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Recent Alerts
                <Badge variant="destructive" className="ml-2">
                  {alerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                      alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                      'border-yellow-500 bg-yellow-50'
                    } hover:bg-opacity-70 cursor-pointer`}
                    onClick={() => handleDriverClick(alert.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${
                          alert.severity === 'critical' ? 'text-red-800' :
                          alert.severity === 'high' ? 'text-orange-800' :
                          'text-yellow-800'
                        }`}>
                          {alert.driverName}
                        </p>
                        <p className={`text-sm ${
                          alert.severity === 'critical' ? 'text-red-600' :
                          alert.severity === 'high' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`}>
                          {alert.message}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                          className="text-xs"
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {alert.fleet} • {alert.depot}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {alerts.length > 10 && (
                  <div className="text-center pt-2 border-t">
                    <p className="text-sm text-gray-500">
                      Showing 10 of {alerts.length} alerts. Use driver search to view specific profiles.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600 mb-4">
                Unable to load driver management data. Please try again.
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to Use Driver Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Search & View Profiles</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Search drivers by name or employee ID</li>
                  <li>• Click any driver card to open detailed profile</li>
                  <li>• View trip analytics, safety events, and performance</li>
                  <li>• Export individual driver reports</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Monitor Safety & Performance</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Review drivers requiring immediate attention</li>
                  <li>• Track LYTX safety events and coaching progress</li>
                  <li>• Monitor Guardian distraction/fatigue alerts</li>
                  <li>• Compare performance across fleet</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DataCentreLayout>
    <DriverAnalyticsModal
      driverId={selectedDriverId}
      open={!!selectedDriverId}
      onClose={() => setSelectedDriverId(null)}
    />
    </>
  );
};

export default DriverManagementPage;