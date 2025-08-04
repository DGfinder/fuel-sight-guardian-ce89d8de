import React, { useState, useMemo } from 'react';
import { Search, Filter, Eye, Edit, UserCheck, X, AlertTriangle, Calendar, MapPin, User, Download, RefreshCw, ExternalLink, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useLytxSafetyEvents, useLytxReferenceData, useLytxRefreshData } from '@/hooks/useLytxData';
import { lytxDataTransformer } from '@/services/lytxDataTransform';

interface LYTXEvent {
  eventId: string;
  driver: string;
  employeeId: string;
  group: string;
  vehicle: string;
  device: string;
  date: string;
  time: string;
  timezone: string;
  score: number;
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  trigger: string;
  behaviors: string;
  eventType: 'Coachable' | 'Driver Tagged';
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  excluded?: boolean;
  assignedDate?: string;
  notes?: string;
  reviewedBy?: string;
}

// Enhanced LYTX event data based on 365-day export
const mockLYTXEvents: LYTXEvent[] = [
  {
    eventId: 'AAQZB23038',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Kewdale',
    vehicle: '1ILI310',
    device: 'QM40999887',
    date: '8/3/25',
    time: '6:31:52 PM',
    timezone: 'AUW',
    score: 0,
    status: 'New',
    trigger: 'Lens Obstruction',
    behaviors: '',
    eventType: 'Coachable',
    carrier: 'Stevemacs'
  },
  {
    eventId: 'AAQZB09348',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Geraldton',
    vehicle: '1GLD510',
    device: 'MV00252104',
    date: '8/3/25',
    time: '4:49:47 PM',
    timezone: 'AUW',
    score: 0,
    status: 'New',
    trigger: 'Food or Drink',
    behaviors: '',
    eventType: 'Coachable',
    carrier: 'Great Southern Fuels'
  },
  {
    eventId: 'AAQYA94405',
    driver: 'Andrew Buchanan',
    employeeId: 'A.Buchanan',
    group: 'Kalgoorlie',
    vehicle: '1GSF248',
    device: 'QM40025388',
    date: '8/3/25',
    time: '2:54:45 PM',
    timezone: 'AUW',
    score: 0,
    status: 'Resolved',
    trigger: 'Handheld Device',
    behaviors: '',
    eventType: 'Coachable',
    carrier: 'Great Southern Fuels',
    assignedDate: '8/4/25',
    reviewedBy: 'Safety Manager',
    notes: 'Driver coached on hands-free device usage'
  },
  {
    eventId: 'AAQYF72979',
    driver: 'Craig Bean',
    employeeId: 'C.Bean',
    group: 'Kewdale',
    vehicle: '1IFJ910',
    device: 'QM40999881',
    date: '7/31/25',
    time: '2:02:29 PM',
    timezone: 'AUW',
    score: 0,
    status: 'Resolved',
    trigger: 'Driver Tagged',
    behaviors: 'Driver Tagged',
    eventType: 'Driver Tagged',
    carrier: 'Stevemacs',
    assignedDate: '8/1/25',
    reviewedBy: 'Fleet Manager'
  },
  {
    eventId: 'AAQYX73948',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Geraldton',
    vehicle: '1GLD510',
    device: 'MV00252104',
    date: '8/2/25',
    time: '2:16:44 PM',
    timezone: 'AUW',
    score: 0,
    status: 'Face-To-Face',
    trigger: 'No Seat Belt',
    behaviors: 'Driver Unbelted [Roadway]',
    eventType: 'Coachable',
    carrier: 'Great Southern Fuels'
  },
  {
    eventId: 'AAQYX68032',
    driver: 'Matthew Ahearn',
    employeeId: 'M.Ahearn',
    group: 'Kalgoorlie',
    vehicle: '1EXV411',
    device: 'QM40025557',
    date: '8/2/25',
    time: '1:49:09 PM',
    timezone: 'AUW',
    score: 3,
    status: 'FYI Notify',
    trigger: 'Food or Drink',
    behaviors: 'Food / Drink - Distraction',
    eventType: 'Coachable',
    carrier: 'Great Southern Fuels',
    assignedDate: '8/3/25',
    excluded: true,
    notes: 'Equipment malfunction - excluded from analysis'
  }
];

interface LYTXEventTableProps {
  showTitle?: boolean;
  maxHeight?: string;
  carrierFilter?: 'All' | 'Stevemacs' | 'Great Southern Fuels';
}

const LYTXEventTable: React.FC<LYTXEventTableProps> = ({ 
  showTitle = true, 
  maxHeight = '600px',
  carrierFilter = 'All'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved'>('All');
  const [eventTypeFilter, setEventTypeFilter] = useState<'All' | 'Coachable' | 'Driver Tagged'>('All');
  const [driverFilter, setDriverFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [excludedFilter, setExcludedFilter] = useState<'All' | 'Included' | 'Excluded'>('All');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'driver' | 'vehicle'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showExcludeModal, setShowExcludeModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [exclusionReason, setExclusionReason] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [localEvents, setLocalEvents] = useState<LYTXEvent[]>([]);

  // Get date range for API calls (last 30 days by default)
  const dateRange = useMemo(() => lytxDataTransformer.createDateRange(30), []);

  // Fetch events from Lytx API
  const eventsQuery = useLytxSafetyEvents({
    page,
    pageSize: 200, // Get more events for better client-side filtering
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  // Fetch reference data
  const referenceData = useLytxReferenceData();

  // Refresh mutation
  const refreshMutation = useLytxRefreshData();

  // Use API data or fallback to mock data
  const events = eventsQuery.data?.events || localEvents.length > 0 ? localEvents : mockLYTXEvents;

  // Filter and search events
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(event => {
      const matchesSearch = event.eventId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.trigger.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || event.status === statusFilter;
      const matchesEventType = eventTypeFilter === 'All' || event.eventType === eventTypeFilter;
      const matchesCarrier = carrierFilter === 'All' || event.carrier === carrierFilter;
      const matchesDriver = driverFilter === 'All' || 
                           (driverFilter === 'Assigned' && event.driver !== 'Driver Unassigned') ||
                           (driverFilter === 'Unassigned' && event.driver === 'Driver Unassigned');
      const matchesExcluded = excludedFilter === 'All' ||
                             (excludedFilter === 'Included' && !event.excluded) ||
                             (excludedFilter === 'Excluded' && event.excluded);

      return matchesSearch && matchesStatus && matchesEventType && matchesCarrier && matchesDriver && matchesExcluded;
    });

    // Sort results
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;
      
      switch (sortBy) {
        case 'score':
          valueA = a.score;
          valueB = b.score;
          break;
        case 'driver':
          valueA = a.driver;
          valueB = b.driver;
          break;
        case 'vehicle':
          valueA = a.vehicle;
          valueB = b.vehicle;
          break;
        default:
          valueA = new Date(a.date + ' ' + a.time);
          valueB = new Date(b.date + ' ' + b.time);
      }

      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

    return filtered;
  }, [events, searchTerm, statusFilter, eventTypeFilter, carrierFilter, driverFilter, excludedFilter, sortBy, sortOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'Face-To-Face': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'FYI Notify': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'New': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-red-600 font-bold';
    if (score >= 4) return 'text-yellow-600 font-bold';
    if (score >= 1) return 'text-blue-600 font-bold';
    return 'text-gray-600';
  };

  const getCarrierColor = (carrier: string) => {
    return carrier === 'Stevemacs' ? 'text-blue-600' : 'text-green-600';
  };

  const handleSelectEvent = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.eventId)));
    }
  };

  const handleBulkAssign = () => {
    setSelectedDriver('');
    setShowAssignModal(true);
  };

  const handleBulkExclude = () => {
    setExclusionReason('');
    setShowExcludeModal(true);
  };

  const handleDriverAssignment = () => {
    if (!selectedDriver) return;
    
    const updatedEvents = events.map(event => {
      if (selectedEvents.has(event.eventId)) {
        return {
          ...event,
          driver: selectedDriver,
          employeeId: selectedDriver.split(' ').map(n => n.charAt(0)).join('.') + '.' + selectedDriver.split(' ').slice(-1)[0],
          status: 'Face-To-Face' as const,
          assignedDate: new Date().toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: '2-digit' 
          }),
          reviewedBy: 'Safety Manager'
        };
      }
      return event;
    });
    
    setLocalEvents(updatedEvents);
    setSelectedEvents(new Set());
    setShowAssignModal(false);
    setSelectedDriver('');
  };

  const handleEventExclusion = () => {
    const updatedEvents = events.map(event => {
      if (selectedEvents.has(event.eventId)) {
        return {
          ...event,
          excluded: !event.excluded,
          notes: exclusionReason || (event.excluded ? undefined : 'Excluded from analysis')
        };
      }
      return event;
    });
    
    setLocalEvents(updatedEvents);
    setSelectedEvents(new Set());
    setShowExcludeModal(false);
    setExclusionReason('');
  };

  const handleRefreshData = async () => {
    try {
      await refreshMutation.mutateAsync();
      // Clear local state to use fresh API data
      setLocalEvents([]);
      setSelectedEvents(new Set());
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const handleExportData = () => {
    // Prepare data for export
    const exportData = filteredEvents.map(event => ({
      'Event ID': event.eventId,
      'Driver': event.driver,
      'Employee ID': event.employeeId,
      'Group': event.group,
      'Vehicle': event.vehicle,
      'Device': event.device,
      'Date': event.date,
      'Time': event.time,
      'Timezone': event.timezone,
      'Score': event.score,
      'Status': event.status,
      'Trigger': event.trigger,
      'Behaviors': event.behaviors,
      'Event Type': event.eventType,
      'Carrier': event.carrier,
      'Excluded': event.excluded ? 'Yes' : 'No',
      'Assigned Date': event.assignedDate || '',
      'Notes': event.notes || '',
      'Reviewed By': event.reviewedBy || ''
    }));

    // Convert to CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => 
          `"${String(row[header] || '').replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lytx_events_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {showTitle && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">LYTX Event Management</h3>
              {/* Connection Status Indicator */}
              <div className="flex items-center gap-1">
                {eventsQuery.isLoading || refreshMutation.isPending ? (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                ) : eventsQuery.isError ? (
                  <WifiOff className="h-4 w-4 text-red-500" />
                ) : (
                  <Wifi className="h-4 w-4 text-green-500" />
                )}
                <span className={`text-xs ${eventsQuery.isError ? 'text-red-600' : 'text-gray-500'}`}>
                  {eventsQuery.isLoading ? 'Loading...' : 
                   eventsQuery.isError ? 'API Error' : 
                   'Live Data'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleRefreshData}
                disabled={eventsQuery.isLoading || refreshMutation.isPending}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Data
              </button>
              <button 
                onClick={handleExportData}
                disabled={eventsQuery.isLoading}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
          
          {/* Error Message */}
          {eventsQuery.isError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-800">
                  Failed to load LYTX data: {eventsQuery.error?.message || 'Unknown error'}
                </span>
                <button 
                  onClick={() => eventsQuery.refetch()}
                  className="ml-auto text-xs text-red-600 hover:text-red-800 underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          
          {/* Data Source Indicator */}
          <div className="mt-2 text-xs text-gray-500">
            {eventsQuery.data ? 
              `Showing live data from ${dateRange.startDate} to ${dateRange.endDate}` :
              'Showing demo data (API connection failed)'
            }
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Status</option>
            <option value="New">New</option>
            <option value="Face-To-Face">Face-To-Face</option>
            <option value="FYI Notify">FYI Notify</option>
            <option value="Resolved">Resolved</option>
          </select>
          
          <select 
            value={eventTypeFilter} 
            onChange={(e) => setEventTypeFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Types</option>
            <option value="Coachable">Coachable</option>
            <option value="Driver Tagged">Driver Tagged</option>
          </select>
          
          <select 
            value={driverFilter} 
            onChange={(e) => setDriverFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Drivers</option>
            <option value="Assigned">Assigned</option>
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <select 
            value={excludedFilter} 
            onChange={(e) => setExcludedFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Events</option>
            <option value="Included">Included in Analysis</option>
            <option value="Excluded">Excluded from Analysis</option>
          </select>
          
          <select 
            value={`${sortBy}-${sortOrder}`} 
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as any);
              setSortOrder(order as any);
            }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="score-desc">Highest Score</option>
            <option value="score-asc">Lowest Score</option>
            <option value="driver-asc">Driver A-Z</option>
            <option value="vehicle-asc">Vehicle A-Z</option>
          </select>

          {selectedEvents.size > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={handleBulkAssign}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <UserCheck className="h-4 w-4" />
                Assign Driver ({selectedEvents.size})
              </button>
              <button 
                onClick={handleBulkExclude}
                className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
              >
                <X className="h-4 w-4" />
                Toggle Exclude ({selectedEvents.size})
              </button>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600 mt-2">
          Showing {filteredEvents.length} of {events.length} events
          {selectedEvents.size > 0 && ` • ${selectedEvents.size} selected`}
        </div>
      </div>

      {/* Events Table */}
      <div className="relative overflow-auto" style={{ maxHeight }}>
        {/* Loading Overlay */}
        {eventsQuery.isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-600">Loading LYTX events...</span>
            </div>
          </div>
        )}
        
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-3 font-medium text-gray-900 text-sm">
                <input
                  type="checkbox"
                  checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="text-left p-3 font-medium text-gray-900 text-sm">Event</th>
              <th className="text-left p-3 font-medium text-gray-900 text-sm">Driver & Vehicle</th>
              <th className="text-left p-3 font-medium text-gray-900 text-sm">Details</th>
              <th className="text-left p-3 font-medium text-gray-900 text-sm">Status</th>
              <th className="text-left p-3 font-medium text-gray-900 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.isArray(filteredEvents) ? filteredEvents.map((event) => (
              <tr 
                key={event.eventId} 
                className={`hover:bg-gray-50 ${event.excluded ? 'bg-red-50' : ''}`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(event.eventId)}
                    onChange={() => handleSelectEvent(event.eventId)}
                    className="rounded"
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-start gap-2">
                    {event.excluded && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{event.eventId}</div>
                      <div className="text-xs text-gray-600">{event.trigger}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-lg font-bold ${getScoreColor(event.score)}`}>
                          {event.score}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          event.eventType === 'Coachable' ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                        }`}>
                          {event.eventType}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className={`text-sm font-medium ${event.driver === 'Driver Unassigned' ? 'text-red-600' : 'text-gray-900'}`}>
                        {event.driver}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{event.vehicle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-600">{event.group}</span>
                      <span className={`text-xs font-medium ${getCarrierColor(event.carrier)}`}>
                        {event.carrier}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">{event.date} {event.time}</span>
                    </div>
                    {event.behaviors && (
                      <div className="text-xs text-gray-600 max-w-48 truncate">
                        {event.behaviors}
                      </div>
                    )}
                    {event.assignedDate && (
                      <div className="text-xs text-green-600">
                        Assigned: {event.assignedDate}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                  {event.reviewedBy && (
                    <div className="text-xs text-gray-500 mt-1">
                      By: {event.reviewedBy}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button className="p-1 text-blue-600 hover:bg-blue-100 rounded text-sm">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-600 hover:bg-gray-100 rounded text-sm">
                      <Edit className="h-4 w-4" />
                    </button>
                    {event.driver === 'Driver Unassigned' && (
                      <button className="p-1 text-green-600 hover:bg-green-100 rounded text-sm">
                        <UserCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button className="p-1 text-blue-600 hover:bg-blue-100 rounded text-sm">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  {filteredEvents === null || filteredEvents === undefined ? 
                    'Loading events...' : 
                    'No events data available (invalid format)'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-12">
          <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or filters</p>
        </div>
      )}

      {/* Modals would go here */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Driver to Events</h3>
            <p className="text-gray-600 mb-4">Assign a driver to {selectedEvents.size} selected events</p>
            <div className="space-y-4">
              <select 
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Driver...</option>
                <option value="Andrew Buchanan">Andrew Buchanan</option>
                <option value="Craig Bean">Craig Bean</option>
                <option value="Matthew Ahearn">Matthew Ahearn</option>
                <option value="Mark Stevens">Mark Stevens</option>
                <option value="Sarah Mitchell">Sarah Mitchell</option>
                <option value="Glen Sawyer">Glen Sawyer</option>
                <option value="Mark Pearmine">Mark Pearmine</option>
                <option value="Steve Harvey">Steve Harvey</option>
                <option value="Shane Dietsch">Shane Dietsch</option>
              </select>
              <div className="text-xs text-gray-600">
                This will update the driver assignment and mark events as "Face-To-Face" status.
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDriverAssignment}
                  disabled={!selectedDriver}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Assign Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExcludeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Toggle Event Exclusion</h3>
            <p className="text-gray-600 mb-4">Toggle exclusion status for {selectedEvents.size} selected events</p>
            <div className="space-y-4">
              <textarea 
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                placeholder="Reason for exclusion (e.g., Equipment malfunction, False positive, Driver not at fault)..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              ></textarea>
              <div className="text-xs text-gray-600">
                <div className="mb-2">
                  <strong>Common exclusion reasons:</strong>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Equipment malfunction or false detection</li>
                  <li>Event occurred while parked/stationary</li>
                  <li>Driver was not at fault (external factors)</li>
                  <li>Duplicate event or system error</li>
                  <li>Training exercise or non-operational driving</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowExcludeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEventExclusion}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  {selectedEvents.size > 0 && 
                    events.filter(e => selectedEvents.has(e.eventId)).some(e => e.excluded) 
                    ? 'Include in Analysis' 
                    : 'Exclude from Analysis'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LYTXEventTable;