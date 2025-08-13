import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Download } from 'lucide-react';

type Carrier = 'All' | 'Stevemacs' | 'Great Southern Fuels';

interface EventRow {
  id: string;
  event_id: string;
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  depot: string | null;
  driver_name: string;
  vehicle_registration: string | null;
  event_datetime: string;
  event_type: 'Coachable' | 'Driver Tagged';
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  score: number;
  trigger: string;
  behaviors: string;
  group_name: string;
}

interface BehaviorStat {
  name: string;
  count: number;
  percentage: number;
}

export default function LytxSimpleDashboard() {
  const location = useLocation();
  const inferredCarrier: Carrier = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const c = sp.get('carrier');
      if (c === 'Stevemacs' || c === 'Great Southern Fuels') return c;
      const path = location.pathname.toLowerCase();
      if (path.includes('/lytx-safety/gsf')) return 'Great Southern Fuels';
      if (path.includes('/lytx-safety/stevemacs') || path.includes('/lytx-safety/smb')) return 'Stevemacs';
    } catch {}
    return 'All';
  }, [location.pathname, location.search]);

  const [carrier, setCarrier] = useState<Carrier>(inferredCarrier);
  const [pageSize, setPageSize] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [behaviorFilter, setBehaviorFilter] = useState<string>('All');

  const query = useQuery({
    queryKey: ['lytx-events', carrier, pageSize, searchTerm, statusFilter, behaviorFilter],
    queryFn: async () => {
      // Read directly from events table for individual event data
      let q = supabase
        .from('lytx_safety_events')
        .select(`
          id,
          event_id,
          carrier,
          depot,
          driver_name,
          vehicle_registration,
           device_serial,
          event_datetime,
          event_type,
          status,
          score,
          trigger,
          behaviors,
          group_name
        `)
        .order('event_datetime', { ascending: false });

      // Apply filters
      if (carrier !== 'All') {
        q = q.eq('carrier', carrier);
      }
      
      if (searchTerm) {
        q = q.or(`driver_name.ilike.%${searchTerm}%,vehicle_registration.ilike.%${searchTerm}%,trigger.ilike.%${searchTerm}%`);
      }
      
      if (statusFilter !== 'All') {
        q = q.eq('status', statusFilter);
      }
      
      if (behaviorFilter !== 'All') {
        q = q.ilike('behaviors', `%${behaviorFilter}%`);
      }

      // Fetch individual events with pagination
      const { data, error } = await q.range(0, pageSize - 1);
      
      if (error) throw error;

      // Also fetch the total count for KPI
      let qc = supabase
        .from('lytx_safety_events')
        .select('*', { count: 'exact', head: true });
      if (carrier !== 'All') qc = qc.eq('carrier', carrier);
      const { count: totalCount = 0 } = await qc;

      const events = (data || []) as EventRow[];
      
      // Parse behaviors for analytics
      const parseBehaviors = (behaviorStr: string): string[] => {
        if (!behaviorStr) return [];
        return behaviorStr.split(',').map(b => b.trim()).filter(b => b);
      };
      
      // Count behavior frequencies
      const behaviorCounts = new Map<string, number>();
      const triggerCounts = new Map<string, number>();
      
      events.forEach(event => {
        // Count behaviors
        const behaviors = parseBehaviors(event.behaviors || '');
        behaviors.forEach(behavior => {
          behaviorCounts.set(behavior, (behaviorCounts.get(behavior) || 0) + 1);
        });
        
        // Count triggers
        if (event.trigger) {
          triggerCounts.set(event.trigger, (triggerCounts.get(event.trigger) || 0) + 1);
        }
      });
      
      // Create behavior statistics
      const behaviorStats: BehaviorStat[] = Array.from(behaviorCounts.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / events.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 behaviors
        
      const triggerStats: BehaviorStat[] = Array.from(triggerCounts.entries())
        .map(([name, count]) => ({
          name,
          count, 
          percentage: Math.round((count / events.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 triggers
        
      // Calculate summary stats
      const coachableCount = events.filter(e => e.event_type === 'Coachable').length;
      const driverTaggedCount = events.filter(e => e.event_type === 'Driver Tagged').length;
      const resolvedCount = events.filter(e => e.status === 'Resolved').length;
      const avgScore = events.length > 0 ? events.reduce((sum, e) => sum + (e.score || 0), 0) / events.length : 0;


      return { 
        events, 
        totalCount, 
        behaviorStats, 
        triggerStats,
        summary: {
          coachableCount,
          driverTaggedCount,
          resolvedCount,
          avgScore: Math.round(avgScore * 100) / 100,
          resolutionRate: events.length > 0 ? Math.round((resolvedCount / events.length) * 100) : 0
        }
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const events = useMemo(() => {
    return query.data?.events || [];
  }, [query.data]);
  
  const behaviorStats = useMemo(() => {
    return query.data?.behaviorStats || [];
  }, [query.data]);
  
  const triggerStats = useMemo(() => {
    return query.data?.triggerStats || [];
  }, [query.data]);

  const totals = useMemo(() => {
    return query.data?.summary || {
      coachableCount: 0,
      driverTaggedCount: 0, 
      resolvedCount: 0,
      avgScore: 0,
      resolutionRate: 0
    };
  }, [query.data]);

  const handleExport = () => {
     const csvHeader = ['Event ID','Date','Driver','Vehicle','Carrier','Depot','Type','Status','Trigger','Behaviors'];
    const csvRows = events.map(e => [
      e.event_id,
      new Date(e.event_datetime).toLocaleDateString(),
      e.driver_name,
       e.vehicle_registration || (e as any).device_serial || '',
      e.carrier,
       e.depot || e.group_name || '',
      e.event_type,
      e.status,
      e.trigger,
      e.behaviors || ''
    ]);
    const content = [csvHeader, ...csvRows].map(r => r.map(f => `"${f}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lytx_safety_events.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">LYTX Safety Events</h1>
            <p className="text-gray-600 text-sm">Individual safety events with behavior analysis and filtering. Showing {events.length} of {query.data?.totalCount || 0} events.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => query.refetch()}
              disabled={query.isLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              <RefreshCw className={`h-4 w-4 ${query.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={carrier}
            onChange={e => setCarrier(e.target.value as Carrier)}
            className="px-3 py-2 border rounded"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>
          <input
            type="text"
            placeholder="Search driver, vehicle, or trigger..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="All">All Status</option>
            <option value="New">New</option>
            <option value="Face-To-Face">Face-To-Face</option>
            <option value="FYI Notify">FYI Notify</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select
            value={behaviorFilter}
            onChange={e => setBehaviorFilter(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="All">All Behaviors</option>
            <option value="Smoking">Smoking</option>
            <option value="Handheld Device">Cell Phone</option>
            <option value="Food">Eating/Drinking</option>
            <option value="Seat Belt">Seat Belt</option>
            <option value="Following Distance">Following Distance</option>
            <option value="Speeding">Speeding</option>
          </select>
          <select
            value={String(pageSize)}
            onChange={e => setPageSize(Number(e.target.value))}
            className="px-3 py-2 border rounded"
          >
            <option value="25">Show 25</option>
            <option value="50">Show 50</option>
            <option value="100">Show 100</option>
            <option value="200">Show 200</option>
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="text-2xl font-bold">{query.data?.totalCount?.toLocaleString() || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">Resolution Rate</div>
          <div className="text-2xl font-bold">{totals.resolutionRate}%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">Avg Score</div>
          <div className="text-2xl font-bold">{totals.avgScore}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">Coachable / Tagged</div>
          <div className="text-2xl font-bold">{totals.coachableCount?.toLocaleString() || 0} / {totals.driverTaggedCount?.toLocaleString() || 0}</div>
        </div>
      </div>

      {/* Behavior Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Behaviors Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Behaviors ({events.length} events)</h3>
          <div className="space-y-3">
            {behaviorStats.slice(0, 8).map((stat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 truncate" title={stat.name}>
                      {stat.name.length > 25 ? stat.name.substring(0, 22) + '...' : stat.name}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">{stat.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.max(stat.percentage, 2)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Triggers Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Event Triggers</h3>
          <div className="space-y-3">
            {triggerStats.slice(0, 8).map((stat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 truncate" title={stat.name}>
                      {stat.name.length > 25 ? stat.name.substring(0, 22) + '...' : stat.name}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">{stat.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.max(stat.percentage, 2)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Driver</th>
                <th className="text-left p-3">Vehicle</th>
                <th className="text-left p-3">Carrier</th>
                <th className="text-left p-3">Depot</th>
                 <th className="text-left p-3">Trigger</th>
                <th className="text-left p-3">Status</th>
                 <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Behaviors</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={10}>Loading events...</td>
                </tr>
              )}
              {query.isError && (
                <tr>
                  <td className="p-4 text-red-600" colSpan={10}>Failed to load events.</td>
                </tr>
              )}
              {!query.isLoading && !query.isError && events.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-700" colSpan={10}>No events found matching the current filters.</td>
                </tr>
              )}
              {events.map((event, idx) => {
                const behaviors = (event.behaviors || '').split(',').map(b => b.trim()).filter(b => b);
                 const statusColors = {
                  'New': 'bg-blue-100 text-blue-800',
                  'Face-To-Face': 'bg-yellow-100 text-yellow-800', 
                  'FYI Notify': 'bg-purple-100 text-purple-800',
                  'Resolved': 'bg-green-100 text-green-800'
                };
                 const typeColors = {
                  'Coachable': 'bg-orange-100 text-orange-800',
                  'Driver Tagged': 'bg-red-100 text-red-800'
                };
                
                return (
                  <tr key={event.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                    <td className="p-3 text-xs">
                      {new Date(event.event_datetime).toLocaleDateString()}<br/>
                      <span className="text-gray-500">{new Date(event.event_datetime).toLocaleTimeString()}</span>
                    </td>
                    <td className="p-3 font-medium">{event.driver_name}</td>
                    <td className="p-3 text-xs">{event.vehicle_registration || '—'}</td>
                     <td className="p-3 text-xs">{event.carrier}</td>
                     <td className="p-3 text-xs">{event.depot || event.group_name || '—'}</td>
                     <td className="p-3 text-xs max-w-40 truncate" title={event.trigger}>{event.trigger || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}>
                        {event.status}
                      </span>
                    </td>
                     <td className="p-3">
                       <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[event.event_type] || 'bg-gray-100 text-gray-800'}`}>
                         {event.event_type}
                       </span>
                     </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-48">
                        {behaviors.slice(0, 3).map((behavior, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs" title={behavior}>
                            {behavior.length > 15 ? behavior.substring(0, 12) + '...' : behavior}
                          </span>
                        ))}
                        {behaviors.length > 3 && (
                          <span className="px-2 py-1 bg-gray-300 text-gray-600 rounded text-xs">
                            +{behaviors.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Info */}
      {events.length > 0 && (
        <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
          <span>Showing {events.length} of {query.data?.totalCount?.toLocaleString() || 0} events</span>
          {events.length === pageSize && (
            <span className="text-blue-600">Increase page size to see more events</span>
          )}
        </div>
      )}
    </div>
  );
}

