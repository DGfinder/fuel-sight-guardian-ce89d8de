// 🔗 SIMPLIFIED GASBOT WEBHOOK - Ultra Simple Data Reception
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook-simple
// 
// Purpose: Simplest possible webhook to receive Gasbot tank data
// Authentication: Simple API key in query parameter or header
// Processing: Store raw data with minimal transformation

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Simple API key - can be passed as query param or header
const SIMPLE_API_KEY = process.env.GASBOT_SIMPLE_KEY || 'gasbot-2025';

export default async function handler(req, res) {
  console.log(`🔗 Gasbot webhook: ${req.method} ${req.url}`);
  
  // Accept both GET and POST for maximum flexibility
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Only GET and POST allowed' });
  }

  // Simple authentication - check query param, header, or body
  const apiKey = req.query.key || 
                 req.headers['x-api-key'] || 
                 req.headers['authorization']?.replace('Bearer ', '') ||
                 req.body?.api_key;

  if (apiKey !== SIMPLE_API_KEY) {
    console.log('❌ Invalid API key');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    let tankData = [];

    // Handle different data sources
    if (req.method === 'POST') {
      // Accept JSON body
      if (req.body && typeof req.body === 'object') {
        tankData = Array.isArray(req.body) ? req.body : [req.body];
      }
    } else if (req.method === 'GET') {
      // Accept URL params for simple testing
      if (req.query.location && req.query.fuel_level) {
        tankData = [{
          LocationId: req.query.location,
          AssetCalibratedFillLevel: req.query.fuel_level,
          DeviceOnline: req.query.online !== 'false',
          AssetSerialNumber: req.query.serial || 'unknown',
          TenancyName: req.query.customer || 'Unknown Customer'
        }];
      }
    }

    if (tankData.length === 0) {
      return res.status(400).json({ 
        error: 'No tank data provided',
        help: 'Send JSON array/object in POST body or use GET with location & fuel_level params'
      });
    }

    console.log(`📊 Processing ${tankData.length} tanks`);

    // Simple processing - store each tank reading
    const results = [];
    for (const tank of tankData) {
      try {
        // Extract only essential fields - handle missing/null values gracefully
        const simpleReading = {
          location_name: tank.LocationId || tank.location || 'Unknown Location',
          customer_name: tank.TenancyName || tank.customer || 'Unknown Customer', 
          fuel_level_percent: parseFloat(tank.AssetCalibratedFillLevel || tank.fuel_level || 0),
          raw_fuel_level: parseFloat(tank.AssetRawFillLevel || tank.AssetCalibratedFillLevel || tank.fuel_level || 0),
          device_serial: tank.AssetSerialNumber || tank.DeviceSerialNumber || tank.serial || 'unknown',
          device_online: tank.DeviceOnline !== false, // Default to true unless explicitly false
          volume_litres: parseFloat(tank.AssetReportedLitres || tank.volume || 0),
          battery_voltage: parseFloat(tank.DeviceBatteryVoltage || 0),
          last_reading: tank.AssetLastCalibratedTelemetryTimestamp || 
                       tank.timestamp || 
                       new Date().toISOString(),
          received_at: new Date().toISOString(),
          raw_data: tank // Store everything for reference
        };

        // Insert into simple readings table
        const { data, error } = await supabase
          .from('gasbot_simple_readings')
          .insert(simpleReading)
          .select()
          .single();

        if (error) {
          console.log(`⚠️ DB insert failed: ${error.message}`);
          results.push({ 
            location: simpleReading.location_name, 
            status: 'error', 
            error: error.message 
          });
        } else {
          console.log(`✅ ${simpleReading.location_name}: ${simpleReading.fuel_level_percent}%`);
          results.push({ 
            location: simpleReading.location_name, 
            status: 'success', 
            fuel_level: simpleReading.fuel_level_percent 
          });
        }

      } catch (recordError) {
        console.log(`❌ Processing error: ${recordError.message}`);
        results.push({ 
          status: 'error', 
          error: recordError.message 
        });
      }
    }

    // Return simple success response
    const successCount = results.filter(r => r.status === 'success').length;
    
    return res.status(200).json({
      success: true,
      message: `Processed ${successCount}/${tankData.length} tank readings`,
      timestamp: new Date().toISOString(),
      results: results
    });

  } catch (error) {
    console.error('💥 Webhook failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// 📋 USAGE EXAMPLES:
//
// POST with JSON array:
// curl -X POST https://your-app.vercel.app/api/gasbot-webhook-simple \
//   -H "Content-Type: application/json" \
//   -H "X-API-Key: gasbot-2025" \
//   -d '[{"LocationId":"Tank 1","AssetCalibratedFillLevel":75,"DeviceOnline":true}]'
//
// GET for testing:
// https://your-app.vercel.app/api/gasbot-webhook-simple?key=gasbot-2025&location=Tank1&fuel_level=75&online=true
//
// POST with single object:
// curl -X POST https://your-app.vercel.app/api/gasbot-webhook-simple?key=gasbot-2025 \
//   -H "Content-Type: application/json" \
//   -d '{"LocationId":"Tank 1","AssetCalibratedFillLevel":75}'