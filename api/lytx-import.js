// Serverless importer: fetch many LYTX events via export endpoint then upsert into Supabase
import { supabase } from './lib/supabase';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { startDate, endDate, pageSize = 1000, maxPages = 100 } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Fetch aggregated events from our export aggregator
    const exportResp = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/lytx-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, pageSize, maxPages })
    });
    if (!exportResp.ok) {
      const text = await exportResp.text();
      return res.status(exportResp.status).json({ error: 'Export failed', details: text });
    }
    const { data: events } = await exportResp.json();

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ imported: 0, duplicates: 0 });
    }

    // Prepare a lightweight transform that matches lytx_safety_events schema
    const toDbRecord = (e) => {
      // Normalize fields safely
      const eventId = e.eventId || e.id || String(e.id || e.event_id);
      const groupName = e.groupName || e.group || '';
      const driverName = e.driverName || e.driver || 'Driver Unassigned';
      const vehicle = e.name || e.vehicle || e.vehicleId || null;
      const device = e.deviceSerialNumber || e.device || '';
      const eventDateTime = e.eventDateTime || e.event_datetime || new Date().toISOString();
      const status = (e.status || '').toString();
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
        timezone: e.timezone || 'Australia/Perth',
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
    };

    // Insert in chunks, upsert on event_id unique
    const chunkSize = 500;
    let imported = 0;
    let duplicates = 0;
    let failed = 0;

    for (let i = 0; i < events.length; i += chunkSize) {
      const batch = events.slice(i, i + chunkSize).map(toDbRecord);
      const { error } = await supabase
        .from('lytx_safety_events')
        .upsert(batch, { onConflict: 'event_id', ignoreDuplicates: false });
      if (error) {
        // Try smaller chunks if we hit payload limit
        if (error.message && error.message.toLowerCase().includes('payload')) {
          for (const rec of batch) {
            const { error: e1 } = await supabase
              .from('lytx_safety_events')
              .upsert(rec, { onConflict: 'event_id', ignoreDuplicates: false });
            if (e1) {
              failed++;
            } else {
              imported++;
            }
          }
        } else if (error.message && error.message.toLowerCase().includes('duplicate')) {
          duplicates += batch.length;
        } else {
          failed += batch.length;
        }
      } else {
        imported += batch.length;
      }
    }

    return res.status(200).json({ imported, duplicates, failed, total: events.length });
  } catch (e) {
    console.error('[lytx-import] failed:', e);
    return res.status(500).json({ error: 'Import failed', details: e.message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

