/**
 * Test Endpoint - Testaa Supabase-yhteys
 * 
 * Käytä tätä endpointia testaamaan Supabase-yhteyden toimivuus
 * ennen cron-jobin käyttöönottoa.
 * 
 * GET /api/test-supabase
 * 
 * Testaa:
 * - Supabase-yhteyden toimivuus
 * - Tietokantataulun olemassaolo
 * - Luku- ja kirjoitusoikeudet
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const results = {
    connection: false,
    tableExists: false,
    canRead: false,
    canWrite: false,
    errors: [] as string[]
  };

  try {
    // Testaa yhteys
    const supabase = createClient(supabaseUrl, supabaseKey);
    results.connection = true;

    // Testaa luku
    try {
      const { data, error } = await supabase
        .from('traffic_data')
        .select('count')
        .limit(1);

      if (error) {
        results.errors.push(`Read error: ${error.message}`);
      } else {
        results.tableExists = true;
        results.canRead = true;
      }
    } catch (error) {
      results.errors.push(`Table check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Testaa kirjoitus (dummy-tietue joka poistetaan heti)
    try {
      const testRecord = {
        device_id: 'TEST_DEVICE',
        detector_id: 'TEST_DETECTOR',
        measured_time: new Date().toISOString(),
        measurement_name: 'test',
        value: 0,
        sg_name: 'test',
        detector_name: 'test',
        unit: 'test',
        interval: 0,
        reliability_value: 0
      };

      const { data: insertData, error: insertError } = await supabase
        .from('traffic_data')
        .insert([testRecord])
        .select();

      if (insertError) {
        results.errors.push(`Write error: ${insertError.message}`);
      } else {
        results.canWrite = true;

        // Poista testimittaus
        if (insertData && insertData.length > 0) {
          await supabase
            .from('traffic_data')
            .delete()
            .eq('id', insertData[0].id);
        }
      }
    } catch (error) {
      results.errors.push(`Write test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Palauta tulokset
    return NextResponse.json({
      success: results.connection && results.tableExists && results.canRead && results.canWrite,
      timestamp: new Date().toISOString(),
      results,
      recommendation: results.canWrite 
        ? '✅ Supabase on konfiguroitu oikein! Voit ottaa cron-jobin käyttöön.'
        : '❌ Tarkista Supabase-asetukset. Katso virheet yksityiskohdista.'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      recommendation: '❌ Supabase-yhteys epäonnistui. Tarkista ympäristömuuttujat.'
    }, { status: 500 });
  }
}
