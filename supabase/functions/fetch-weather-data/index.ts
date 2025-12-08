/**
 * Weather Data Fetch Edge Function
 *
 * Fetches historical weather data from Open-Meteo API and stores in weather_history table.
 * Supports:
 * - Daily scheduled updates (fetch yesterday's weather)
 * - Historical backfill (fetch past 12 months)
 * - Per-location or all-locations fetch
 *
 * Open-Meteo Historical API: https://open-meteo.com/en/docs/historical-weather-api
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// TYPES
// ============================================

interface WeatherRecord {
  latitude: number;
  longitude: number;
  location_name: string | null;
  date: string;
  temperature_min: number | null;
  temperature_max: number | null;
  temperature_mean: number | null;
  precipitation_sum: number | null;
  precipitation_hours: number | null;
  wind_speed_max: number | null;
  wind_gusts_max: number | null;
  wind_direction_dominant: number | null;
  shortwave_radiation_sum: number | null;
  sunshine_duration: number | null;
  weather_code: number | null;
  data_source: string;
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    temperature_2m_mean?: number[];
    precipitation_sum?: number[];
    precipitation_hours?: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
    wind_direction_10m_dominant?: number[];
    shortwave_radiation_sum?: number[];
    sunshine_duration?: number[];
    weather_code?: number[];
  };
}

interface Location {
  latitude: number;
  longitude: number;
  location_name: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Round coordinates to 2 decimal places for grouping nearby locations
function roundCoord(coord: number, decimals: number = 2): number {
  return Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Fetch weather data from Open-Meteo API
async function fetchOpenMeteoData(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<OpenMeteoResponse | null> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: startDate,
    end_date: endDate,
    daily: [
      'temperature_2m_min',
      'temperature_2m_max',
      'temperature_2m_mean',
      'precipitation_sum',
      'precipitation_hours',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      'shortwave_radiation_sum',
      'sunshine_duration',
      'weather_code'
    ].join(','),
    timezone: 'Australia/Perth'
  });

  const url = `https://archive-api.open-meteo.com/v1/archive?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch weather for ${latitude},${longitude}:`, error);
    return null;
  }
}

// Transform Open-Meteo response to weather records
function transformWeatherData(
  data: OpenMeteoResponse,
  locationName: string | null
): WeatherRecord[] {
  const records: WeatherRecord[] = [];
  const { daily, latitude, longitude } = data;

  if (!daily || !daily.time) return records;

  for (let i = 0; i < daily.time.length; i++) {
    records.push({
      latitude: roundCoord(latitude, 4),
      longitude: roundCoord(longitude, 4),
      location_name: locationName,
      date: daily.time[i],
      temperature_min: daily.temperature_2m_min?.[i] ?? null,
      temperature_max: daily.temperature_2m_max?.[i] ?? null,
      temperature_mean: daily.temperature_2m_mean?.[i] ?? null,
      precipitation_sum: daily.precipitation_sum?.[i] ?? null,
      precipitation_hours: daily.precipitation_hours?.[i] ?? null,
      wind_speed_max: daily.wind_speed_10m_max?.[i] ?? null,
      wind_gusts_max: daily.wind_gusts_10m_max?.[i] ?? null,
      wind_direction_dominant: daily.wind_direction_10m_dominant?.[i] ?? null,
      shortwave_radiation_sum: daily.shortwave_radiation_sum?.[i] ?? null,
      sunshine_duration: daily.sunshine_duration?.[i] ?? null,
      weather_code: daily.weather_code?.[i] ?? null,
      data_source: 'open-meteo'
    });
  }

  return records;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      mode = 'daily',  // 'daily' | 'backfill' | 'range'
      start_date,      // For range/backfill mode
      end_date,        // For range mode
      latitude,        // Optional: specific location
      longitude,       // Optional: specific location
      months_back = 12 // For backfill mode
    } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Calculate date range based on mode
    let queryStartDate: string;
    let queryEndDate: string;

    const today = new Date();

    if (mode === 'daily') {
      // Fetch yesterday's weather (historical API has 5-day delay for some data)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      queryStartDate = formatDate(yesterday);
      queryEndDate = formatDate(yesterday);
    } else if (mode === 'backfill') {
      // Backfill last N months
      const startDateObj = new Date(today);
      startDateObj.setMonth(startDateObj.getMonth() - months_back);
      queryStartDate = start_date || formatDate(startDateObj);
      // End 5 days ago (Open-Meteo historical data delay)
      const endDateObj = new Date(today);
      endDateObj.setDate(endDateObj.getDate() - 5);
      queryEndDate = formatDate(endDateObj);
    } else if (mode === 'range' && start_date && end_date) {
      queryStartDate = start_date;
      queryEndDate = end_date;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid mode or missing date parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching weather data from ${queryStartDate} to ${queryEndDate} (mode: ${mode})`);

    // Get unique tank locations
    let locations: Location[] = [];

    if (latitude && longitude) {
      // Specific location provided
      locations = [{ latitude, longitude, location_name: null }];
    } else {
      // Get unique locations from ta_agbot_locations
      const { data: locationData, error: locError } = await supabase
        .from('ta_agbot_locations')
        .select('latitude, longitude, name')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (locError) {
        throw new Error(`Failed to fetch locations: ${locError.message}`);
      }

      // Group by rounded coordinates to avoid duplicates for nearby tanks
      const uniqueLocations = new Map<string, Location>();

      for (const loc of locationData || []) {
        if (loc.latitude && loc.longitude) {
          const lat = roundCoord(loc.latitude, 2);
          const lng = roundCoord(loc.longitude, 2);
          const key = `${lat},${lng}`;

          if (!uniqueLocations.has(key)) {
            uniqueLocations.set(key, {
              latitude: lat,
              longitude: lng,
              location_name: loc.name
            });
          }
        }
      }

      locations = Array.from(uniqueLocations.values());
    }

    console.log(`Processing ${locations.length} unique locations`);

    // Fetch and store weather data for each location
    let totalRecords = 0;
    let successfulLocations = 0;
    let failedLocations = 0;
    const errors: string[] = [];

    for (const location of locations) {
      try {
        console.log(`Fetching weather for ${location.location_name || 'unnamed'} (${location.latitude}, ${location.longitude})`);

        const weatherData = await fetchOpenMeteoData(
          location.latitude,
          location.longitude,
          queryStartDate,
          queryEndDate
        );

        if (!weatherData) {
          failedLocations++;
          errors.push(`Failed to fetch data for ${location.latitude},${location.longitude}`);
          continue;
        }

        const records = transformWeatherData(weatherData, location.location_name);

        if (records.length === 0) {
          console.log(`No weather records for ${location.location_name}`);
          continue;
        }

        // Upsert records (update if exists, insert if new)
        const { error: upsertError } = await supabase
          .from('weather_history')
          .upsert(records, {
            onConflict: 'latitude,longitude,date',
            ignoreDuplicates: false
          });

        if (upsertError) {
          failedLocations++;
          errors.push(`Failed to store data for ${location.location_name}: ${upsertError.message}`);
          continue;
        }

        totalRecords += records.length;
        successfulLocations++;

        // Rate limit: 1 request per second to be nice to Open-Meteo
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        failedLocations++;
        errors.push(`Error processing ${location.location_name}: ${error.message}`);
      }
    }

    const result = {
      success: true,
      mode,
      date_range: {
        start: queryStartDate,
        end: queryEndDate
      },
      locations_processed: locations.length,
      successful_locations: successfulLocations,
      failed_locations: failedLocations,
      total_records_stored: totalRecords,
      errors: errors.length > 0 ? errors : undefined,
      completed_at: new Date().toISOString()
    };

    console.log('Weather fetch complete:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (err) {
    console.error('Error in fetch-weather-data:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
