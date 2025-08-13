import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTanks } from '@/hooks/useTanks';
import { useFilterTanksBySubgroup } from '@/hooks/useUserPermissions';
import { 
  Droplets, 
  MapPin, 
  Gauge, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  MoreVertical,
  RefreshCw,
  Edit
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { getFuelStatus } from '@/components/ui/fuel-status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditDipModal from '@/components/modals/EditDipModal';
import AddDipModal from '@/components/modals/AddDipModal';
import { TankStatusTable } from "@/components/TankStatusTable";
import { MobileTankCard } from "@/components/MobileTankCard";
import { SkeletonTankGrid } from "@/components/SkeletonTankCard";
import { SkeletonTable, SkeletonCard } from "@/components/ui/skeleton";
import { useTankModal } from '@/contexts/TankModalContext';
import type { Tank } from "@/types/fuel";

export default function TanksPage() {
  const { tanks, isLoading, error, refreshTanks } = useTanks();
  const { filterTanks, isLoading: permissionsLoading } = useFilterTanksBySubgroup();
  const { openModal } = useTankModal();
  const [searchParams] = useSearchParams();

  // Debug the tanks page state
  console.log('[TANKSPAGE DEBUG] Page State:', {
    isLoading,
    hasError: !!error,
    errorMessage: error?.message,
    tanksCount: tanks?.length || 0,
    tanksArray: Array.isArray(tanks),
    firstTankLocation: tanks?.[0]?.location,
    firstTankPercent: tanks?.[0]?.current_level_percent
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [daysToMinFilter, setDaysToMinFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState<Tank | null>(null);
  const [addDipModalOpen, setAddDipModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Initialize filters from URL parameters
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlGroup = searchParams.get('group');
    const urlDaysToMin = searchParams.get('daysToMin');
    const urlSearch = searchParams.get('search');
    
    if (urlStatus && ['all', 'critical', 'low', 'normal', 'low-fuel'].includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
    if (urlGroup) {
      setGroupFilter(urlGroup);
    }
    if (urlDaysToMin && ['all', '2', '5', '7'].includes(urlDaysToMin)) {
      setDaysToMinFilter(urlDaysToMin);
    }
    if (urlSearch) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  // Invalidate the sidebar's tank count when this page loads with the correct data
  useEffect(() => {
    if (tanks) {
      queryClient.invalidateQueries({ queryKey: ['tankCounts'] });
    }
  }, [tanks, queryClient]);

  // Enhanced filtering and sorting logic
  const { filteredTanks, stats } = useMemo(() => {
    if (!tanks) return { filteredTanks: [], stats: { total: 0, critical: 0, low: 0, normal: 0, lowFuel: 0 } };

    // First apply subgroup permissions filtering - only if permissions are loaded
    const permissionFilteredTanks = !permissionsLoading ? filterTanks(tanks) : [];
    
    const filtered = permissionFilteredTanks.filter(tank => {
      const matchesSearch = tank.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tank.group_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tank.product_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Enhanced status filtering with new 'low-fuel' option
      let matchesStatus = true;
      if (statusFilter === 'low-fuel') {
        // Low-fuel includes both critical (≤10%) and low (10-20%) tanks
        matchesStatus = tank.current_level_percent != null && tank.current_level_percent <= 20;
      } else if (statusFilter !== 'all') {
        matchesStatus = getFuelStatus(tank.current_level_percent) === statusFilter;
      }
      
      const matchesGroup = groupFilter === 'all' || tank.group_name === groupFilter;
      
      // Days to minimum filter
      let matchesDaysToMin = true;
      if (daysToMinFilter !== 'all') {
        const daysThreshold = parseInt(daysToMinFilter);
        matchesDaysToMin = tank.days_to_min_level != null && tank.days_to_min_level <= daysThreshold;
      }
      
      return matchesSearch && matchesStatus && matchesGroup && matchesDaysToMin;
    });

    // Sort tanks
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.location || '').localeCompare(b.location || '');
        case 'level':
          return b.current_level_percent - a.current_level_percent;
        case 'group':
          return (a.group_name || '').localeCompare(b.group_name || '');
        case 'status':
          return a.current_level_percent - b.current_level_percent;
        default:
          return 0;
      }
    });

    // Calculate stats
    const stats = {
      total: tanks.length,
      critical: tanks.filter(t => getFuelStatus(t.current_level_percent) === 'critical').length,
      low: tanks.filter(t => getFuelStatus(t.current_level_percent) === 'low').length,
      normal: tanks.filter(t => getFuelStatus(t.current_level_percent) === 'normal').length,
      lowFuel: tanks.filter(t => t.current_level_percent != null && t.current_level_percent <= 20).length
    };

    return { filteredTanks: filtered, stats };
  }, [tanks, searchTerm, statusFilter, groupFilter, daysToMinFilter, sortBy, filterTanks, permissionsLoading]);

  const uniqueGroups = useMemo(() => {
    if (!tanks) return [];
    return [...new Set(tanks.map(tank => tank.group_name).filter(Boolean))];
  }, [tanks]);

  const getStatusColor = (percentage: number | null) => {
    const status = getFuelStatus(percentage);
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'low': return 'bg-yellow-500';
      case 'normal': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (percentage: number | null) => {
    const status = getFuelStatus(percentage);
    switch (status) {
      case 'critical': return 'Critical';
      case 'low': return 'Low';
      case 'normal': return 'Normal';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (percentage: number | null) => {
    const status = getFuelStatus(percentage);
    switch (status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'low': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'normal': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  // Handler for clicking a tank row in the table
  const handleTankClick = (tank: Tank) => {
    // Example: open the edit dip modal for the selected tank
    setEditDipTank(tank);
    setEditDipModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <SkeletonCard className="h-8 w-48" />
            <SkeletonCard className="h-4 w-64" />
          </div>
          <SkeletonCard className="h-10 w-32" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        {/* Search and filters skeleton */}
        <SkeletonCard className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <SkeletonCard className="h-10 flex-1" />
            <div className="flex gap-3">
              <SkeletonCard className="h-10 w-32" />
              <SkeletonCard className="h-10 w-40" />
              <SkeletonCard className="h-10 w-32" />
            </div>
          </div>
        </SkeletonCard>

        {/* Desktop table skeleton - hidden on mobile */}
        <div className="hidden md:block">
          <SkeletonTable rows={8} columns={6} />
        </div>

        {/* Mobile cards skeleton - visible on mobile only */}
        <div className="block md:hidden">
          <SkeletonTankGrid count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    // Safely extract error message from various error types
    const errorMessage = (() => {
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') return error.message;
        if ('details' in error && typeof error.details === 'string') return error.details;
        if ('code' in error) return `Database error (${error.code})`;
      }
      return 'Unable to load tank data. Please check your connection and try again.';
    })();

    return (
      <div className="p-6 text-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Error loading tanks</h3>
          <p className="text-red-600 mt-1">{errorMessage}</p>
        </div>
        <Button onClick={() => refreshTanks()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Fuel Tanks
          </h1>
          <p className="text-gray-600 mt-1">Manage and monitor all fuel tanks</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => refreshTanks()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            onClick={() => {
              // TODO: Implement add tank functionality
              console.log('Add tank functionality needed');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tank
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Tanks</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <Droplets className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Critical</p>
                <p className="text-2xl font-bold text-red-900">{stats.critical}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700">Low</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.low}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Normal</p>
                <p className="text-2xl font-bold text-green-900">{stats.normal}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tanks by name, group, or product..."
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
                  <SelectItem value="low-fuel">Low Fuel (≤20%)</SelectItem>
                  <SelectItem value="critical">Critical (≤10%)</SelectItem>
                  <SelectItem value="low">Low (10-20%)</SelectItem>
                  <SelectItem value="normal">Normal (&gt;20%)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={daysToMinFilter} onValueChange={setDaysToMinFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Days to Min" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Timeframes</SelectItem>
                  <SelectItem value="2">≤ 2 Days</SelectItem>
                  <SelectItem value="5">≤ 5 Days</SelectItem>
                  <SelectItem value="7">≤ 7 Days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="level">Level</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(searchTerm || statusFilter !== 'all' || groupFilter !== 'all' || daysToMinFilter !== 'all') && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredTanks.length} of {stats.total} tanks
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tank Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTanks.map((tank) => (
          <Card 
            key={tank.id} 
            className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden cursor-pointer"
            onClick={() => openModal(tank)}
          >
            <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {tank.location}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {getStatusIcon(tank.current_level_percent)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => setAddDipModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Reading
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {
                        setEditDipTank(tank);
                        setEditDipModalOpen(true);
                      }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Last Reading
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => openModal(tank)}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        View Trends
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                {tank.group_name}
              </div>
              <Badge 
                variant={getFuelStatus(tank.current_level_percent) === 'critical' ? "destructive" : 
                        getFuelStatus(tank.current_level_percent) === 'low' ? "secondary" : "default"}
                className="w-fit"
              >
                {getStatusText(tank.current_level_percent)}
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Current Level</span>
                <span className="text-xl font-bold text-gray-900">
                  {tank.current_level?.toLocaleString() || 'N/A'}L
                </span>
              </div>
              
              {/* Enhanced Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-4 rounded-full transition-all duration-1000 ease-out ${getStatusColor(tank.current_level_percent)} relative overflow-hidden`}
                    style={{ 
                      width: `${Math.min(tank.current_level_percent || 0, 100)}%`
                    }}
                  >
                    <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-700">
                    {tank.current_level_percent?.toFixed(1) || 'N/A'}% Full
                  </span>
                  <span className="text-gray-500">
                    Safe: {tank.safe_level?.toLocaleString()}L
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <Gauge className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">Product:</span>
                  </div>
                  <span className="font-medium bg-gray-100 px-2 py-1 rounded text-xs">
                    {tank.product_type}
                  </span>
                </div>

                {tank.days_to_min_level && (
                  <div className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Days to minimum:</span>
                    <span className={`font-bold ${tank.days_to_min_level <= 2 ? 'text-red-600' : tank.days_to_min_level <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {tank.days_to_min_level?.toFixed(1)} days
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click
                    setEditDipTank(tank);
                    setEditDipModalOpen(true);
                  }}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit Dip
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click
                    setAddDipModalOpen(true);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Dip
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTanks.length === 0 && tanks && tanks.length > 0 && (
        <div className="text-center py-12">
          <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tanks match your filters</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria.</p>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setGroupFilter('all');
              setDaysToMinFilter('all');
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* No Tanks State */}
      {(!tanks || tanks.length === 0) && !isLoading && (
        <div className="text-center py-12">
          <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tanks found</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first fuel tank.</p>
          <Button
            onClick={() => {
              // TODO: Implement add tank functionality
              console.log('Add tank functionality needed');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Tank
          </Button>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <TankStatusTable
          tanks={filteredTanks}
          onTankClick={handleTankClick}
          setEditDipTank={setEditDipTank}
          setEditDipModalOpen={setEditDipModalOpen}
        />
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden">
        <div className="grid gap-4 pb-20"> {/* pb-20 for mobile nav space */}
          {filteredTanks.map((tank) => (
            <MobileTankCard
              key={tank.id}
              tank={tank}
              onTap={() => openModal(tank)}
              onLongPress={() => {
                setEditDipTank(tank);
                setEditDipModalOpen(true);
              }}
              onSwipeLeft={() => {
                // Quick action: View details
                openModal(tank);
              }}
              onSwipeRight={() => {
                // Quick action: Edit dip
                setEditDipTank(tank);
                setEditDipModalOpen(true);
              }}
            />
          ))}
          
          {filteredTanks.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tanks match your filters</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </div>
      </div>

      <AddDipModal
        open={addDipModalOpen}
        onOpenChange={setAddDipModalOpen}
        onSubmit={async () => {
          // Handle submission and close modal
          setAddDipModalOpen(false);
        }}
      />

      <EditDipModal
        isOpen={editDipModalOpen && !!editDipTank}
        onClose={() => {
          setEditDipModalOpen(false);
          setEditDipTank(null);
        }}
        initialGroupId={editDipTank?.group_id || ''}
        initialTankId={editDipTank?.id || ''}
      />
    </div>
  );
} 