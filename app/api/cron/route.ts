/**
 * Cron Endpoint - Liikennetietojen automaattinen tallennus
 * 
 * Tämä endpoint hakee määriteltyjen risteysten ja ilmaisimien liikennemäärät
 * TPM API:sta ja tallentaa ne Supabaseen, jos samalla aikaleimalla ei ole
 * vielä tietuetta.
 * 
 * Käyttö:
 * - Voidaan ajaa cron-jobina (esim. Vercel Cron)
 * - Voidaan kutsua myös manuaalisesti GET /api/cron
 * 
 * Ympäristömuuttujat:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase projektin URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key
 * - CRON_SECRET: Valinnainen salaisuus cron-kutsujen suojaamiseen
 * 
 * Seurattavat risteydet:
 * - Määritelty tiedostossa: config/monitored-devices.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MONITORED_DEVICES } from '@/config/monitored-devices';

// Supabase-asiakasinstanssi (käyttää service role key:tä jos saatavilla)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Liikennetietojen tyyppi TPM API:sta
 */
interface TrafficData {
  devName: string;
  measuredTime: string;
  values: Array<{
    sgName: string;
    detName: string;
    name: string;
    value: number;
    unit: string;
    interval: number;
    reliabValue: number;
  }>;
}

/**
 * Tietokantaan tallennettavan tietueen tyyppi
 */
interface TrafficRecord {
  device_id: string;
  detector_id: string;
  measured_time: string;
  sg_name: string;
  detector_name: string;
  measurement_name: string;
  value: number;
  unit: string;
  interval: number;
  reliability_value: number;
  created_at?: string;
}

/**
 * Hakee liikennetiedot yhdeltä ilmaisimelta
 */
async function fetchTrafficData(deviceId: string, detectorId: string): Promise<TrafficData | null> {
  try {
    const apiUrl = `https://api.oulunliikenne.fi/tpm/kpi/traffic-volume/${deviceId}/${detectorId}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`HTTP error for ${deviceId}/${detectorId}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching data for ${deviceId}/${detectorId}:`, error);
    return null;
  }
}

/**
 * Tarkistaa onko tietue jo olemassa tietokannassa
 */
async function recordExists(deviceId: string, detectorId: string, measuredTime: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('traffic_data')
      .select('id')
      .eq('device_id', deviceId)
      .eq('detector_id', detectorId)
      .eq('measured_time', measuredTime)
      .limit(1);
    
    if (error) {
      console.error('Error checking record existence:', error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Error in recordExists:', error);
    return false;
  }
}

/**
 * Tallentaa liikennetiedot Supabaseen
 */
async function saveTrafficData(deviceId: string, detectorId: string, data: TrafficData): Promise<boolean> {
  try {
    // Tarkista onko tietue jo olemassa
    const exists = await recordExists(deviceId, detectorId, data.measuredTime);
    
    if (exists) {
      console.log(`Record already exists for ${deviceId}/${detectorId} at ${data.measuredTime}`);
      return true; // Ei virhe, mutta ei tallennettu
    }
    
    // Muodosta tietueet jokaiselle mittaukselle
    const records: TrafficRecord[] = data.values.map(value => ({
      device_id: deviceId,
      detector_id: detectorId,
      measured_time: data.measuredTime,
      sg_name: value.sgName,
      detector_name: value.detName,
      measurement_name: value.name,
      value: value.value,
      unit: value.unit,
      interval: value.interval,
      reliability_value: value.reliabValue,
      created_at: new Date().toISOString()
    }));
    
    // Tallenna tietokantaan
    const { error } = await supabase
      .from('traffic_data')
      .insert(records);
    
    if (error) {
      console.error(`Error saving data for ${deviceId}/${detectorId}:`, error);
      return false;
    }
    
    console.log(`Successfully saved ${records.length} records for ${deviceId}/${detectorId}`);
    return true;
  } catch (error) {
    console.error(`Error in saveTrafficData:`, error);
    return false;
  }
}

/**
 * GET handler - Hakee ja tallentaa liikennetiedot
 */
export async function GET(request: NextRequest) {
  // Tarkista valinnainen CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const results = {
    processed: 0,
    saved: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ deviceId: string; detectorId: string; status: string }>
  };
  
  try {
    // Käy läpi kaikki seurattavat laitteet ja ilmaisimet
    for (const device of MONITORED_DEVICES) {
      for (const detectorId of device.detectors) {
        results.processed++;
        
        // Hae data API:sta
        const data = await fetchTrafficData(device.deviceId, detectorId);
        
        if (!data) {
          results.failed++;
          results.details.push({
            deviceId: device.deviceId,
            detectorId,
            status: 'failed_to_fetch'
          });
          continue;
        }
        
        // Tallenna data
        const saved = await saveTrafficData(device.deviceId, detectorId, data);
        
        if (saved) {
          // Tarkista oliko jo olemassa
          const exists = await recordExists(device.deviceId, detectorId, data.measuredTime);
          if (exists && results.skipped === results.processed - 1) {
            results.skipped++;
            results.details.push({
              deviceId: device.deviceId,
              detectorId,
              status: 'skipped_exists'
            });
          } else {
            results.saved++;
            results.details.push({
              deviceId: device.deviceId,
              detectorId,
              status: 'saved'
            });
          }
        } else {
          results.failed++;
          results.details.push({
            deviceId: device.deviceId,
            detectorId,
            status: 'failed_to_save'
          });
        }
        
        // Pieni viive API-kutsujen välillä
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        processed: results.processed,
        saved: results.saved,
        skipped: results.skipped,
        failed: results.failed
      },
      details: results.details
    });
    
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
