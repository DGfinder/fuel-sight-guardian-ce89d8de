import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Minus,
  MoreHorizontal,
  Shield,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useDrivers } from '@/hooks/useDrivers';
import DriverCSVImportModal from './DriverCSVImportModal';
import type { 
  DriverProfile, 
  DriverFilters, 
  FleetName, 
  DriverStatus,
  RiskLevel 
} from '@/types/fleet';

export default function DriverManagementDashboard() {
  const { toast } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [filters, setFilters] = useState<DriverFilters>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Use the React Query hook for data fetching
  const { data: drivers = [], isLoading: loading, error, refetch } = useDrivers({ 
    ...filters, 
    search: searchTerm.trim() || undefined
  });

  // Calculate stats from the data
  const stats = React.useMemo(() => ({
    totalDrivers: drivers.length,
    activeDrivers: drivers.filter(d => d.status === 'Active').length,
    highRiskDrivers: drivers.filter(d => d.current_risk_level === 'High' || d.current_risk_level === 'Very High').length,
    recentIncidents: drivers.reduce((sum, d) => sum + d.recent_incidents, 0)
  }), [drivers]);

  // Handle errors
  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading drivers",
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  }, [error, toast]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchTerm.trim() || undefined });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const exportDrivers = () => {
    // Create CSV content
    const headers = [
      'Name', 'Employee ID', 'Fleet', 'Depot', 'Status', 'Phone', 'Email',
      'Current Risk Level', 'LYTX Score', 'Guardian Score', 'Recent Incidents'
    ];
    
    const csvContent = [
      headers.join(','),
      ...drivers.map(driver => [
        `"${driver.first_name} ${driver.last_name}"`,
        driver.employee_id || '',
        driver.fleet,
        driver.depot,
        driver.status,
        driver.phone || '',
        driver.email || '',
        driver.current_risk_level || '',
        driver.latest_lytx_score || '',
        driver.latest_guardian_score || '',
        driver.recent_incidents
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivers_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadgeVariant = (status: DriverStatus) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Inactive': return 'secondary';
      case 'On Leave': return 'outline';
      case 'Terminated': return 'destructive';
      default: return 'secondary';
    }
  };

  const getRiskBadgeVariant = (risk?: RiskLevel) => {
    switch (risk) {
      case 'Very High': return 'destructive';
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
      case 'Very Low': return 'outline';
      default: return 'secondary';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'Improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'Declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'Stable': return <Minus className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Driver Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage your fleet drivers across all systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportDrivers}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Drivers</p>
                <p className="text-2xl font-bold">{stats.totalDrivers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Drivers</p>
                <p className="text-2xl font-bold">{stats.activeDrivers}</p>
              </div>
              <Shield className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Risk</p>
                <p className="text-2xl font-bold">{stats.highRiskDrivers}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recent Incidents</p>
                <p className="text-2xl font-bold">{stats.recentIncidents}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drivers by name, employee ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>
            
            <div className="flex gap-2">
              <Select 
                value={filters.fleet || ''} 
                onValueChange={(value) => setFilters({ ...filters, fleet: value as FleetName || undefined })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Fleet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Fleets</SelectItem>
                  <SelectItem value="Stevemacs">Stevemacs</SelectItem>
                  <SelectItem value="Great Southern Fuels">Great Southern Fuels</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.status || ''} 
                onValueChange={(value) => setFilters({ ...filters, status: value as DriverStatus || undefined })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.risk_level || ''} 
                onValueChange={(value) => setFilters({ ...filters, risk_level: value as RiskLevel || undefined })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Risk</SelectItem>
                  <SelectItem value="Very Low">Very Low</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Very High">Very High</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Drivers ({drivers.length})</CardTitle>
          <CardDescription>
            Manage your fleet drivers and monitor their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Fleet & Depot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Recent Incidents</TableHead>
                <TableHead>Current Vehicle</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No drivers found</p>
                      <p className="text-sm text-muted-foreground">
                        Try adjusting your filters or import driver data
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(driver.first_name, driver.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{driver.first_name} {driver.last_name}</p>
                          {driver.employee_id && (
                            <p className="text-xs text-muted-foreground">{driver.employee_id}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{driver.fleet}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {driver.depot}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(driver.status)}>
                        {driver.status}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        {driver.phone && (
                          <p className="text-xs flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {driver.phone}
                          </p>
                        )}
                        {driver.email && (
                          <p className="text-xs flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {driver.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getRiskBadgeVariant(driver.current_risk_level)}>
                          {driver.current_risk_level || 'Unknown'}
                        </Badge>
                        {getTrendIcon(driver.performance_trend)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        {driver.latest_lytx_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">LYTX:</span>
                            <span className="text-xs font-medium">{driver.latest_lytx_score.toFixed(1)}</span>
                          </div>
                        )}
                        {driver.latest_guardian_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Guardian:</span>
                            <span className="text-xs font-medium">{driver.latest_guardian_score.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{driver.recent_incidents}</span>
                        {driver.recent_high_severity_incidents > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {driver.recent_high_severity_incidents} high
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {driver.current_vehicle_registration ? (
                        <Badge variant="outline">{driver.current_vehicle_registration}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Driver</DropdownMenuItem>
                          <DropdownMenuItem>View Performance</DropdownMenuItem>
                          <DropdownMenuItem>Assign Vehicle</DropdownMenuItem>
                          <DropdownMenuItem>View Incidents</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Import Modal */}
      <DriverCSVImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={() => {
          setShowImportModal(false);
          refetch();
        }}
      />
    </div>
  );
}