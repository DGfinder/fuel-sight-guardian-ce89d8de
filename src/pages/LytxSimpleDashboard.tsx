import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Download } from 'lucide-react';

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
  avg_score: number | string;
  unique_drivers?: number;
  high_risk_drivers?: number;
}

export default function LytxSimpleDashboard() {
  const [carrier, setCarrier] = useState<Carrier>('All');
  const [monthsBack, setMonthsBack] = useState<number>(12);

  const query = useQuery({
    queryKey: ['lytx-simple', carrier, monthsBack],
    queryFn: async () => {
      let q = supabase
        .from('lytx_safety_analytics')
        .select('*')
        .order('year', { ascending: false })
        .order('month_num', { ascending: false });

      if (carrier !== 'All') {
        q = q.eq('carrier', carrier);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AnalyticsRow[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const list = (query.data || [])
      .map(r => ({
        ...r,
        avg_score: typeof r.avg_score === 'string' ? parseFloat(r.avg_score) : r.avg_score,
      }))
      .sort((a, b) => (b.year - a.year) || (b.month_num - a.month_num));

    if (!monthsBack) return list;

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
    const totalEvents = rows.reduce((s, r) => s + (r.total_events || 0), 0);
    const resolved = rows.reduce((s, r) => s + (r.resolved_events || 0), 0);
    const coachable = rows.reduce((s, r) => s + (r.coachable_events || 0), 0);
    const driverTagged = rows.reduce((s, r) => s + (r.driver_tagged_events || 0), 0);
    const scoreSum = rows.reduce((s, r) => s + ((typeof r.avg_score === 'number' ? r.avg_score : 0) * (r.total_events || 0)), 0);
    const avgScore = totalEvents > 0 ? Math.round((scoreSum / totalEvents) * 100) / 100 : 0;
    const resolutionRate = totalEvents > 0 ? Math.round(((resolved / totalEvents) * 100) * 100) / 100 : 0;
    return { totalEvents, resolved, coachable, driverTagged, avgScore, resolutionRate };
  }, [rows]);

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
            <p className="text-gray-600 text-sm">Reading from analytics view to guarantee data appears. API can be added later.</p>
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
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="0">All time</option>
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
                <tr>
                  <td className="p-4 text-gray-500" colSpan={9}>No data available for the selected filters.</td>
                </tr>
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
    </div>
  );
}

