import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Download } from 'lucide-react';
import LytxDebugPanel from '@/components/LytxDebugPanel';

type Carrier = 'All' | 'Stevemacs' | 'Great Southern Fuels';

interface AnalyticsRow {
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  depot: string | null;
  month: string; // e.g. "Aug"
  year: number;
  month_num: number;
  total_events: number;
  coachable_events: number;
  driver_tagged_events: number;
  new_events: number;
  resolved_events: number;
  avg_score: number;
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
  const [monthsBack, setMonthsBack] = useState<number>(0);

  const query = useQuery({
    queryKey: ['lytx-simple-events', carrier, monthsBack],
    queryFn: async () => {
      console.log('🔍 LYTX Dashboard Debug - Starting query with:', { carrier, monthsBack });
      
      // Check current user session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('👤 User session:', session ? {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.app_metadata?.role,
        groups: session.user.user_metadata?.groups
      } : 'No session');
      
      // Read directly from events table to guarantee data visibility
      let q = supabase
        .from('lytx_safety_events')
        .select('carrier, depot, event_datetime, event_type, status, score, excluded')
        .order('event_datetime', { ascending: false });

      if (carrier !== 'All') {
        console.log('📊 Filtering by carrier:', carrier);
        q = q.eq('carrier', carrier);
      }

      console.log('🚀 Executing query...');
      // Fetch a sizeable page of events for visible analytics
      const { data, error } = await q.range(0, 9999);
      
      console.log('📈 Query result:', {
        success: !error,
        dataLength: data?.length || 0,
        error: error?.message || 'none',
        firstEvent: data?.[0],
        lastEvent: data?.[data.length - 1]
      });
      
      if (error) {
        console.error('❌ Query error details:', error);
        throw error;
      }

      // Also fetch the total count for KPI even if we only loaded a page
      console.log('🔢 Fetching total count...');
      let qc = supabase
        .from('lytx_safety_events')
        .select('*', { count: 'exact', head: true });
      if (carrier !== 'All') qc = qc.eq('carrier', carrier);
      const { count: totalCount = 0, error: countError } = await qc;
      
      console.log('📊 Count result:', {
        totalCount,
        countError: countError?.message || 'none'
      });

      const events = (data || []) as Array<{
        carrier: 'Stevemacs' | 'Great Southern Fuels';
        depot: string | null;
        event_datetime: string;
        event_type: 'Coachable' | 'Driver Tagged';
        status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
        score: number | null;
        excluded?: boolean | null;
      }>;

      // Aggregate by (year, month_num, month, carrier, depot)
      const byKey = new Map<string, AnalyticsRow>();
      for (const e of events) {
        const d = new Date(e.event_datetime);
        const year = d.getFullYear();
        const month_num = d.getMonth() + 1;
        const month = d.toLocaleString('en-US', { month: 'short' });
        const depot = e.depot || null;
        const key = `${year}-${month_num}-${e.carrier}-${depot || ''}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            carrier: e.carrier,
            depot,
            month,
            year,
            month_num,
            total_events: 0,
            coachable_events: 0,
            driver_tagged_events: 0,
            new_events: 0,
            resolved_events: 0,
            avg_score: 0,
          });
        }
        const row = byKey.get(key)!;
        row.total_events += 1;
        if (e.event_type === 'Coachable') row.coachable_events += 1;
        if (e.event_type === 'Driver Tagged') row.driver_tagged_events += 1;
        if (e.status === 'New') row.new_events += 1;
        if (e.status === 'Resolved') row.resolved_events += 1;
        row.avg_score += (e.score || 0);
      }

      // finalize avg score per group
      const rows = Array.from(byKey.values()).map(r => ({
        ...r,
        avg_score: r.total_events > 0 ? Math.round((r.avg_score / r.total_events) * 100) / 100 : 0,
      }));

      // Sort most recent first
      rows.sort((a, b) => (b.year - a.year) || (b.month_num - a.month_num));

      // Return both aggregates and a small recent sample for fallback rendering
      const recent = events.slice(0, 100).map(e => ({
        year: new Date(e.event_datetime).getFullYear(),
        month: new Date(e.event_datetime).toLocaleString('en-US', { month: 'short' }),
        carrier: e.carrier,
        depot: e.depot || null,
        status: e.status,
        event_type: e.event_type,
        score: e.score || 0,
        event_datetime: e.event_datetime,
      }));

      console.log('✅ Final result summary:', {
        aggregatedRows: rows.length,
        recentEvents: recent.length,
        kpiTotal: totalCount,
        sampleRow: rows[0],
        sampleRecent: recent[0]
      });

      return { rows: rows as AnalyticsRow[], recent, kpiTotal: totalCount };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const list = (query.data?.rows || [])
      .map(r => ({ ...r }))
      .sort((a, b) => (b.year - a.year) || (b.month_num - a.month_num));

    // monthsBack = 0 means all time
    if (!monthsBack || monthsBack <= 0) return list;

    // Keep up to N months most recent
    const seen: Set<string> = new Set();
    const filtered: AnalyticsRow[] = [];
    for (const r of list) {
      const key = `${r.year}-${String(r.month_num).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
      }
      if (seen.size <= monthsBack) {
        filtered.push(r);
      } else {
        break;
      }
    }
    return filtered;
  }, [query.data, monthsBack]);

  const totals = useMemo(() => {
    const totalEvents = (query.data?.kpiTotal ?? 0) || rows.reduce((s, r) => s + (r.total_events || 0), 0);
    const resolved = rows.reduce((s, r) => s + (r.resolved_events || 0), 0);
    const coachable = rows.reduce((s, r) => s + (r.coachable_events || 0), 0);
    const driverTagged = rows.reduce((s, r) => s + (r.driver_tagged_events || 0), 0);
    const scoreSum = rows.reduce((s, r) => s + ((typeof r.avg_score === 'number' ? r.avg_score : 0) * (r.total_events || 0)), 0);
    const avgScore = totalEvents > 0 ? Math.round((scoreSum / totalEvents) * 100) / 100 : 0;
    const resolutionRate = totalEvents > 0 ? Math.round(((resolved / totalEvents) * 100) * 100) / 100 : 0;
    return { totalEvents, resolved, coachable, driverTagged, avgScore, resolutionRate };
  }, [rows, query.data?.kpiTotal]);

  const handleExport = () => {
    const csvHeader = ['Carrier','Depot','Month','Year','Total','Coachable','Driver Tagged','New','Resolved','Avg Score'];
    const csvRows = rows.map(r => [
      r.carrier,
      r.depot || '',
      r.month,
      String(r.year),
      String(r.total_events || 0),
      String(r.coachable_events || 0),
      String(r.driver_tagged_events || 0),
      String(r.new_events || 0),
      String(r.resolved_events || 0),
      String(typeof r.avg_score === 'number' ? r.avg_score : parseFloat(r.avg_score as any) || 0)
    ]);
    const content = [csvHeader, ...csvRows].map(r => r.map(f => `"${f}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lytx_safety_analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">LYTX Safety (Simple)</h1>
            <p className="text-gray-600 text-sm">Reading from events table to guarantee data appears. API can be added later.</p>
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
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={carrier}
            onChange={e => setCarrier(e.target.value as Carrier)}
            className="px-3 py-2 border rounded"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>
          <select
            value={String(monthsBack)}
            onChange={e => setMonthsBack(Number(e.target.value))}
            className="px-3 py-2 border rounded"
          >
            <option value="0">All time</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="text-2xl font-bold">{totals.totalEvents.toLocaleString()}</div>
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
          <div className="text-2xl font-bold">{totals.coachable.toLocaleString()} / {totals.driverTagged.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Year</th>
                <th className="text-left p-3">Month</th>
                <th className="text-left p-3">Carrier</th>
                <th className="text-left p-3">Depot</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Coachable</th>
                <th className="text-right p-3">Driver Tagged</th>
                <th className="text-right p-3">Resolved</th>
                <th className="text-right p-3">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={9}>Loading...</td>
                </tr>
              )}
              {query.isError && (
                <tr>
                  <td className="p-4 text-red-600" colSpan={9}>Failed to load analytics.</td>
                </tr>
              )}
              {!query.isLoading && !query.isError && rows.length === 0 && (
                <>
                  <tr>
                    <td className="p-4 text-gray-700" colSpan={9}>No monthly aggregates yet. Showing recent events sample (first 100) from table.</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td colSpan={9} className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr>
                              <th className="text-left p-2">Date</th>
                              <th className="text-left p-2">Carrier</th>
                              <th className="text-left p-2">Depot</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Type</th>
                              <th className="text-right p-2">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(query.data?.recent || []).map((e: any, i: number) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-2">{new Date(e.event_datetime).toLocaleString()}</td>
                                <td className="p-2">{e.carrier}</td>
                                <td className="p-2">{e.depot || '—'}</td>
                                <td className="p-2">{e.status}</td>
                                <td className="p-2">{e.event_type}</td>
                                <td className="p-2 text-right">{e.score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </>
              )}
              {rows.map((r, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">{r.year}</td>
                  <td className="p-3">{r.month}</td>
                  <td className="p-3">{r.carrier}</td>
                  <td className="p-3">{r.depot || '—'}</td>
                  <td className="p-3 text-right">{r.total_events || 0}</td>
                  <td className="p-3 text-right">{r.coachable_events || 0}</td>
                  <td className="p-3 text-right">{r.driver_tagged_events || 0}</td>
                  <td className="p-3 text-right">{r.resolved_events || 0}</td>
                  <td className="p-3 text-right">{typeof r.avg_score === 'number' ? r.avg_score : parseFloat(r.avg_score as any) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debug Panel - Remove this after troubleshooting */}
      <LytxDebugPanel />
    </div>
  );
}

