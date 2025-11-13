import React, { useState } from 'react';
import { Search, MapPin, TrendingUp, CheckCircle2, XCircle, Eye, EyeOff, Trash2, Info, User, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  usePOIDiscoveryDashboard,
  sortByTripCount,
  getHighPriorityPOIs
} from '@/hooks/usePoiDiscovery';
import {
  getPOITypeLabel,
  getPOITypeColor,
  getStatusLabel,
  suggestPOIType,
  formatAccuracy,
  type DiscoveredPOI
} from '@/api/poiDiscovery';
import POIClassificationModal from '@/components/POIClassificationModal';
import { POICustomerAssignmentModal } from '@/components/POICustomerAssignmentModal';
import { useCustomerAssignment, useBulkAutoAssign } from '@/hooks/useCustomerAssignment';

export default function POIDiscoveryPage() {
  const {
    pois,
    unclassified,
    summary,
    isLoading,
    discoverMutation,
    ignoreMutation,
    deleteMutation
  } = usePOIDiscoveryDashboard();

  const [discoveryDialogOpen, setDiscoveryDialogOpen] = useState(false);
  const [classifyModalOpen, setClassifyModalOpen] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<DiscoveredPOI | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poiToDelete, setPOIToDelete] = useState<DiscoveredPOI | null>(null);
  const [customerAssignmentModalOpen, setCustomerAssignmentModalOpen] = useState(false);
  const [poiForCustomerAssignment, setPOIForCustomerAssignment] = useState<DiscoveredPOI | null>(null);

  // Discovery parameters
  const [epsilonMeters, setEpsilonMeters] = useState(500);
  const [minPoints, setMinPoints] = useState(10);
  const [minIdleMinutes, setMinIdleMinutes] = useState(30);
  const [clearExisting, setClearExisting] = useState(false);

  // Customer assignment
  const {
    matches: customerMatches,
    isLoadingMatches,
    assignCustomer,
    autoAssign,
    setSelectedPOI: setCustomerAssignmentPOI,
  } = useCustomerAssignment();
  const bulkAutoAssignMutation = useBulkAutoAssign();

  const handleRunDiscovery = async () => {
    await discoverMutation.mutateAsync({
      epsilonMeters,
      minPoints,
      minIdleMinutes,
      clearExisting
    });
    setDiscoveryDialogOpen(false);
  };

  const handleClassify = (poi: DiscoveredPOI) => {
    setSelectedPOI(poi);
    setClassifyModalOpen(true);
  };

  const handleIgnore = async (poi: DiscoveredPOI) => {
    await ignoreMutation.mutateAsync({
      poiId: poi.id,
      reason: 'Not a significant location'
    });
  };

  const handleDeleteClick = (poi: DiscoveredPOI) => {
    setPOIToDelete(poi);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (poiToDelete) {
      await deleteMutation.mutateAsync(poiToDelete.id);
      setDeleteDialogOpen(false);
      setPOIToDelete(null);
    }
  };

  const handleAssignCustomer = (poi: DiscoveredPOI) => {
    setPOIForCustomerAssignment(poi);
    setCustomerAssignmentPOI(poi.id);
    setCustomerAssignmentModalOpen(true);
  };

  const handleCustomerAssignment = async (poiId: string, customerId: string, method: 'manual') => {
    await assignCustomer(poiId, customerId);
    setCustomerAssignmentModalOpen(false);
  };

  const handleAutoAssignCustomer = async (poiId: string) => {
    await autoAssign(poiId);
  };

  const handleBulkAutoAssign = async () => {
    await bulkAutoAssignMutation.mutateAsync();
  };

  const highPriorityPOIs = getHighPriorityPOIs(pois);
  const sortedPOIs = sortByTripCount(pois);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">POI Auto-Discovery</h2>
          <p className="text-muted-foreground mt-2">
            Automatically discover terminals and customer locations from trip data
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBulkAutoAssign}
            disabled={bulkAutoAssignMutation.isPending}
          >
            <Zap className="mr-2 h-4 w-4" />
            {bulkAutoAssignMutation.isPending ? 'Auto-Assigning...' : 'Bulk Auto-Assign Customers'}
          </Button>
          <Button
            onClick={() => setDiscoveryDialogOpen(true)}
            disabled={discoverMutation.isPending}
          >
            <Search className="mr-2 h-4 w-4" />
            {discoverMutation.isPending ? 'Discovering...' : 'Run Discovery'}
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How POI Discovery Works</AlertTitle>
        <AlertDescription>
          This tool uses PostGIS ST_ClusterDBSCAN to analyze your {summary.total_trips_covered.toLocaleString()} trips
          and automatically discover clusters of trip start points (terminals/depots) and end points (customer locations).
          Review and classify discovered locations to improve idle time attribution and route analysis.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total POIs</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">
              Discovered locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <Search className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.discovered}</div>
            <p className="text-xs text-muted-foreground">
              Unclassified POIs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.classified}</div>
            <p className="text-xs text-muted-foreground">
              User reviewed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminals</CardTitle>
            <MapPin className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.terminals}</div>
            <p className="text-xs text-muted-foreground">
              Fuel loading sites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{summary.customers}</div>
            <p className="text-xs text-muted-foreground">
              Delivery sites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_confidence}%</div>
            <p className="text-xs text-muted-foreground">
              Location accuracy
            </p>
          </CardContent>
        </Card>
      </div>

      {/* High Priority POIs Alert */}
      {highPriorityPOIs.length > 0 && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>High Priority Locations</AlertTitle>
          <AlertDescription>
            {highPriorityPOIs.length} high-traffic locations need classification.
            These represent {highPriorityPOIs.reduce((sum, p) => sum + p.trip_count, 0)} trips
            and should be reviewed first for maximum impact.
          </AlertDescription>
        </Alert>
      )}

      {/* Discovered POIs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Discovered Points of Interest</CardTitle>
          <CardDescription>
            Locations sorted by trip count (highest traffic first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedPOIs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>GPS Coordinates</TableHead>
                    <TableHead>Trips</TableHead>
                    <TableHead>Start/End</TableHead>
                    <TableHead>Avg Idle Time</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>GPS Accuracy</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPOIs.map((poi) => {
                    const suggestedType = suggestPOIType(poi);
                    const isHighPriority = highPriorityPOIs.some(p => p.id === poi.id);

                    return (
                      <TableRow key={poi.id} className={isHighPriority ? 'bg-yellow-50' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isHighPriority && (
                              <TrendingUp className="h-4 w-4 text-yellow-600" title="High Priority" />
                            )}
                            <div>
                              <div>{poi.actual_name || poi.suggested_name || 'Unknown Location'}</div>
                              {poi.matched_terminal_id && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Matched to terminal
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={getPOITypeColor(poi.poi_type)}>
                              {getPOITypeLabel(poi.poi_type)}
                            </Badge>
                            {poi.poi_type === 'unknown' && suggestedType !== 'unknown' && (
                              <span className="text-xs text-muted-foreground">
                                Likely: {getPOITypeLabel(suggestedType)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={poi.classification_status === 'classified' ? 'default' : 'outline'}>
                            {getStatusLabel(poi.classification_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {poi.poi_type === 'customer' && poi.matched_customer_id ? (
                            <Badge variant="outline" className="bg-green-50">
                              <User className="mr-1 h-3 w-3" />
                              Assigned
                            </Badge>
                          ) : poi.poi_type === 'customer' ? (
                            <span className="text-xs text-muted-foreground">Not assigned</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {poi.centroid_latitude.toFixed(6)}, {poi.centroid_longitude.toFixed(6)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{poi.trip_count}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>↑ {poi.start_point_count} starts</div>
                            <div>↓ {poi.end_point_count} ends</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {poi.avg_idle_time_hours
                            ? `${poi.avg_idle_time_hours.toFixed(1)}h`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden"
                              title={`${poi.confidence_score}% confidence`}
                            >
                              <div
                                className={`h-full ${
                                  poi.confidence_score >= 85
                                    ? 'bg-green-500'
                                    : poi.confidence_score >= 70
                                    ? 'bg-blue-500'
                                    : poi.confidence_score >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${poi.confidence_score}%` }}
                              />
                            </div>
                            <span className="text-xs">{poi.confidence_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatAccuracy(poi.gps_accuracy_meters)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {poi.classification_status === 'discovered' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleClassify(poi)}
                                  title="Classify"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleIgnore(poi)}
                                  disabled={ignoreMutation.isPending}
                                  title="Ignore"
                                >
                                  <EyeOff className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {poi.poi_type === 'customer' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAssignCustomer(poi)}
                                title={poi.matched_customer_id ? "Reassign Customer" : "Assign Customer"}
                              >
                                <User className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(poi)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No POIs discovered yet. Click "Run Discovery" to analyze your trip data.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discovery Configuration Dialog */}
      <AlertDialog open={discoveryDialogOpen} onOpenChange={setDiscoveryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run POI Discovery</AlertDialogTitle>
            <AlertDialogDescription>
              Configure discovery parameters. This will find locations where trucks stopped for
              significant time periods. You will manually classify each location as terminal/depot/customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="epsilon">Cluster Radius (meters)</Label>
              <Input
                id="epsilon"
                type="number"
                value={epsilonMeters}
                onChange={(e) => setEpsilonMeters(parseInt(e.target.value))}
                min="100"
                max="2000"
                step="50"
              />
              <p className="text-xs text-muted-foreground">
                Points within this distance will be grouped together. Default: 500m
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minpoints">Minimum Trips</Label>
              <Input
                id="minpoints"
                type="number"
                value={minPoints}
                onChange={(e) => setMinPoints(parseInt(e.target.value))}
                min="3"
                max="50"
                step="1"
              />
              <p className="text-xs text-muted-foreground">
                Minimum trips required to form a POI. Lower = more POIs. Default: 10
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minidleminutes">Minimum Idle Time (minutes)</Label>
              <Input
                id="minidleminutes"
                type="number"
                value={minIdleMinutes}
                onChange={(e) => setMinIdleMinutes(parseInt(e.target.value))}
                min="0"
                max="180"
                step="5"
              />
              <p className="text-xs text-muted-foreground">
                Only include stops where trucks idled for at least this long. Default: 30 minutes
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="clear"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="clear" className="cursor-pointer">
                Clear existing discoveries before running
              </Label>
            </div>
            {clearExisting && (
              <Alert variant="destructive">
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  This will delete all existing discovered POIs and start fresh.
                  Classified POIs will be preserved.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discoverMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRunDiscovery}
              disabled={discoverMutation.isPending}
            >
              {discoverMutation.isPending ? 'Discovering...' : 'Run Discovery'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* POI Classification Modal */}
      <POIClassificationModal
        open={classifyModalOpen}
        onOpenChange={setClassifyModalOpen}
        poi={selectedPOI}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete POI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this POI? This action cannot be undone.
              <div className="mt-4 p-3 bg-gray-100 rounded">
                <div className="font-medium">{poiToDelete?.actual_name || poiToDelete?.suggested_name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {poiToDelete?.trip_count} trips • {poiToDelete?.confidence_score}% confidence
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Assignment Modal */}
      <POICustomerAssignmentModal
        poi={poiForCustomerAssignment}
        isOpen={customerAssignmentModalOpen}
        onClose={() => setCustomerAssignmentModalOpen(false)}
        onAssign={handleCustomerAssignment}
        onAutoAssign={handleAutoAssignCustomer}
        customerMatches={customerMatches}
        isLoadingMatches={isLoadingMatches}
      />
    </div>
  );
}
