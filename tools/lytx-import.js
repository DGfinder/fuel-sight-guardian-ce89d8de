/*
  LYTX Historical Importer (JavaScript)
  - Fetches LYTX safety events across many pages for a date range
  - Upserts into Supabase table `lytx_safety_events` on event_id

  Usage:
    node tools/lytx-import.js --start 2024-08-01 --end 2025-08-01 --pageSize 1000 --maxPages 100
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const val = args[i + 1];
    if (key) map[key] = val;
  }
  const start = map.start || map.s || '';
  const end = map.end || map.e || '';
  const pageSize = parseInt(map.pageSize || map.ps || '1000', 10);
  const maxPages = parseInt(map.maxPages || map.mp || '100', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error('Provide --start and --end in YYYY-MM-DD format');
  }
  return { start, end, pageSize, maxPages };
}

function requireEnv(name, alt) {
  const val = getEnv(name, alt);
  if (!val) {
    throw new Error(`Missing environment variable: ${name}${alt ? ` (or ${alt})` : ''}`);
  }
  return val;
}

function toDbRecord(e) {
  const eventId = e.eventId || e.id || String(e.id || e.event_id);
  const groupName = e.groupName || e.group || '';
  const driverName = e.driverName || e.driver || 'Driver Unassigned';
  const vehicle = e.name || e.vehicle || e.vehicleId || null;
  const device = e.deviceSerialNumber || e.device || '';
  const eventDateTime = e.recordDateUTC || e.creationDate || e.eventDateTime || e.event_datetime || new Date().toISOString();
  const status = (e.status || e.eventStatus || '').toString();
  const trigger = e.trigger || '';
  const behaviorsStr = Array.isArray(e.behaviors) ? e.behaviors.map(b => b?.name || '').filter(Boolean).join(', ') : (e.behaviors || '');

  const safeStatus = (() => {
    const s = status.toLowerCase();
    if (s.includes('face') || s.includes('coach')) return 'Face-To-Face';
    if (s.includes('fyi') || s.includes('notify')) return 'FYI Notify';
    if (s.includes('resolved') || s.includes('closed')) return 'Resolved';
    return 'New';
  })();

  const safeCarrier = (() => {
    const g = groupName.toLowerCase();
    if (g.includes('stevemacs') || g.includes('smb') || g.includes('kewdale')) return 'Stevemacs';
    return 'Great Southern Fuels';
  })();

  const depot = (() => {
    const g = groupName.toLowerCase();
    if (g.includes('kewdale')) return 'Kewdale';
    if (g.includes('geraldton')) return 'Geraldton';
    if (g.includes('kalgoorlie')) return 'Kalgoorlie';
    if (g.includes('narrogin')) return 'Narrogin';
    if (g.includes('albany')) return 'Albany';
    if (g.includes('bunbury')) return 'Bunbury';
    if (g.includes('fremantle')) return 'Fremantle';
    return groupName || 'Unknown';
  })();

  const eventType = (() => {
    const t = (trigger || '').toLowerCase();
    return t.includes('tagged') ? 'Driver Tagged' : 'Coachable';
  })();

  return {
    event_id: eventId,
    vehicle_registration: vehicle,
    device_serial: device,
    driver_name: driverName,
    employee_id: e.employeeId || null,
    group_name: groupName,
    depot,
    carrier: safeCarrier,
    event_datetime: new Date(eventDateTime).toISOString(),
    timezone: e.recordDateTZ || e.timezone || 'Australia/Perth',
    score: Number(e.score || 0),
    status: safeStatus,
    trigger,
    behaviors: behaviorsStr,
    event_type: eventType,
    excluded: !!e.excluded,
    assigned_date: e.reviewedDate ? new Date(e.reviewedDate).toISOString() : null,
    reviewed_by: e.reviewedBy || null,
    notes: Array.isArray(e.notes) ? e.notes.map(n => n?.content || n?.text || n?.note).filter(Boolean).join('; ') : (e.notes || null),
    raw_data: e,
  };
}

async function main() {
  const { start, end, pageSize, maxPages } = parseArgs();

  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') || '';
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const lytxKey = requireEnv('LYTX_API_KEY', 'VITE_LYTX_API_KEY');
  const baseUrl = getEnv('VITE_LYTX_BASE_URL') || 'https://lytx-api.prod7.lv.lytx.com';

  const headers = {
    accept: 'application/json',
    'x-apikey': lytxKey,
    'Content-Type': 'application/json',
  };

  const aggregate = [];
  let pagesFetched = 0;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${baseUrl}/video/safety/eventsWithMetadata`);
    url.searchParams.set('startDate', start);
    url.searchParams.set('endDate', end);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('includeSubgroups', 'true');

    process.stdout.write(`\rFetching page ${page}/${maxPages} ...`);
    const resp = await fetch(url.toString(), { headers });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`LYTX API Error ${resp.status}: ${text}`);
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from LYTX: ${text.slice(0, 200)}`);
    }

    const items = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.events) ? data.events : (Array.isArray(data.items) ? data.items : [])));
    if (items.length === 0) break;
    aggregate.push(...items);
    pagesFetched++;
    if (items.length < pageSize) break;
  }
  process.stdout.write(`\nFetched ${aggregate.length} events across ${pagesFetched} page(s)\n`);

  const chunkSize = 500;
  let imported = 0;
  let failed = 0;
  for (let i = 0; i < aggregate.length; i += chunkSize) {
    const batch = aggregate.slice(i, i + chunkSize).map(toDbRecord);
    const { error } = await supabase
      .from('lytx_safety_events')
      .upsert(batch, { onConflict: 'event_id', ignoreDuplicates: false });
    if (error) {
      if (error.message && error.message.toLowerCase().includes('payload')) {
        for (const rec of batch) {
          const { error: e1 } = await supabase
            .from('lytx_safety_events')
            .upsert(rec, { onConflict: 'event_id', ignoreDuplicates: false });
          if (e1) failed++; else imported++;
        }
      } else {
        failed += batch.length;
      }
    } else {
      imported += batch.length;
    }
    process.stdout.write(`\rUpserted ${Math.min(i + batch.length, aggregate.length)}/${aggregate.length}`);
  }
  process.stdout.write(`\nDone. Imported=${imported}, Failed=${failed}, Total=${aggregate.length}\n`);
}

if (!process.argv.includes('--range')) {
  main().catch((err) => {
    console.error('\nImport failed:', err.message);
    process.exit(1);
  });
}

// If invoked with --range, run month-by-month imports internally
if (process.argv.includes('--range')) {
  (async () => {
    const getArg = (name, fallback) => {
      const i = process.argv.indexOf(name);
      return i !== -1 ? process.argv[i + 1] : fallback;
    };
    const overallStart = getArg('--rangeStart', '2024-01-01');
    const overallEnd = getArg('--rangeEnd', new Date().toISOString().slice(0, 10));
    const pageSize = parseInt(getArg('--pageSize', '1000'), 10);
    const maxPages = parseInt(getArg('--maxPages', '200'), 10);

    const startDate = new Date(overallStart + 'T00:00:00Z');
    const endDate = new Date(overallEnd + 'T00:00:00Z');

    const pad = (n) => String(n).padStart(2, '0');

    for (let d = new Date(startDate); d < endDate; d.setMonth(d.getMonth() + 1)) {
      const s = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
      const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      let eDate = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
      if (eDate > endDate) eDate = endDate;
      const e = `${eDate.getUTCFullYear()}-${pad(eDate.getUTCMonth() + 1)}-${pad(eDate.getUTCDate())}`;

      process.stdout.write(`\nImporting ${s} to ${e}...\n`);
      const { spawn } = await import('node:child_process');
      await new Promise((resolve, reject) => {
        const p = spawn(process.execPath, ['tools/lytx-import.js', '--start', s, '--end', e, '--pageSize', String(pageSize), '--maxPages', String(maxPages)], { stdio: 'inherit' });
        p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`child exited with ${code}`)));
        p.on('error', reject);
      });
    }

    process.exit(0);
  })().catch((err) => { console.error(err); process.exit(1); });
}

