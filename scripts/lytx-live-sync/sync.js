// Minimal LYTX → Supabase sync (polling) for live dashboard ingest
// Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LYTX_API_KEY
// Optional: LYTX_BASE (default prod7), SYNC_WINDOW_MINUTES (default 15)

import { createClient } from '@supabase/supabase-js';

const env = (key, fallback) => process.env[key] ?? fallback;

const SUPABASE_URL = env('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const LYTX_API_KEY = env('LYTX_API_KEY');
const LYTX_BASE = env('LYTX_BASE', 'https://lytx-api.prod7.lv.lytx.com');
const SYNC_WINDOW_MINUTES = Number(env('SYNC_WINDOW_MINUTES', '15'));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!LYTX_API_KEY) {
  console.error('Missing LYTX_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });

const httpGet = async (path, query = {}) => {
  const url = new URL(path, LYTX_BASE);
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach(item => url.searchParams.append(k, String(item)));
    else url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json', 'X-APIKey': LYTX_API_KEY } });
  if (!res.ok) throw new Error(`GET ${url.pathname} failed: ${res.status} ${await res.text()}`);
  return res.json();
};

// Simple status/trigger mappings based on observed IDs and DB constraints
const getStatusName = (id) => {
  // Map API status IDs to valid DB constraint values: 'New', 'Face-To-Face', 'FYI Notify', 'Resolved'
  const statusMap = { 
    1: 'New', 
    7: 'Resolved',  // Reviewed -> Resolved
    2: 'FYI Notify',  // In Review -> FYI Notify
    3: 'Face-To-Face'  // Coaching Complete -> Face-To-Face
  };
  return statusMap[id] || 'New';  // Default to 'New' for unknown statuses
};

const getTriggerName = (id) => {
  const triggerMap = { 2003: 'Food/Drink Detection', 2001: 'Cell Phone Use', 2002: 'Fatigue/Distraction' };
  return triggerMap[id] || `Trigger_${id}`;
};

const iso = d => d.toISOString();
const now = new Date();
const from = new Date(now.getTime() - SYNC_WINDOW_MINUTES * 60 * 1000);

const run = async () => {
  console.log(`LYTX sync starting. Window: ${from.toISOString()} → ${now.toISOString()}`);

  // Get recent events (API returns sorted by most recent first)
  const events = await httpGet('/video/safety/eventsWithMetadata', {
    limit: 100,
  });

  if (!Array.isArray(events) || events.length === 0) {
    console.log('No events in window.');
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const ev of events) {
    try {
      const record = {
        event_id: ev.customerEventId || ev.id,
        vehicle_registration: ev.vehicleId || null,
        device_serial: ev.erSerialNumber || 'Unknown',
        driver_name: (ev.driverFirstName && ev.driverLastName) 
          ? `${ev.driverFirstName} ${ev.driverLastName}`.trim() 
          : 'Driver Unassigned',
        employee_id: ev.driverEmployeeNum || null,
        group_name: ev.groupId,
        depot: ev.groupId,
        carrier: 'Great Southern Fuels',
        event_datetime: ev.recordDateUTC,
        timezone: ev.recordDateTZ || 'AUW',
        score: Number(ev.score) || 0,
        status: getStatusName(ev.eventStatusId),
        trigger: getTriggerName(ev.eventTriggerId),
        behaviors: Array.isArray(ev.behaviors) && ev.behaviors.length > 0
          ? ev.behaviors.map(b => b.name || String(b.id)).join(', ')
          : '',
        event_type: 'Coachable',
        excluded: false,
        assigned_date: ev.reviewedDate || null,
        reviewed_by: ev.reviewedBy || null,
        notes: Array.isArray(ev.notes) && ev.notes.length > 0 ? ev.notes.map(n => n.body || n.content).join('; ') : null,
        raw_data: ev,
      };

      const { error } = await supabase
        .from('lytx_safety_events')
        .upsert(record, { onConflict: 'event_id' });

      if (error) throw error;
      processed++;
    } catch (e) {
      failed++;
      console.error('Upsert failed:', e?.message || e);
    }
  }

  console.log(`LYTX sync complete. processed=${processed} failed=${failed}`);
};

run().catch(err => {
  console.error('Fatal sync error:', err?.message || err);
  process.exit(1);
});

