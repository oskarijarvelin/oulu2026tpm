/**
 * Historia-sivu
 * 
 * Näyttää kaikki Supabaseen tallennetut liikennemäärät graafeina.
 * Hakee datan suoraan Supabase-tietokannasta ja näyttää sen
 * interaktiivisina kaavioina laitteittain ja ilmaisimittain.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MONITORED_DEVICES } from '@/config/monitored-devices';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Supabase client (client-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Liikennetiedon tyyppi
 */
interface TrafficData {
  id: string;
  device_id: string;
  detector_id: string;
  measured_time: string;
  measurement_name: string;
  value: number;
  unit: string | null;
  sg_name: string | null;
  detector_name: string | null;
  created_at: string;
}

/**
 * Laitteen tilastot (yksittäinen IN tai OUT suunta)
 */
interface DeviceStats {
  deviceId: string;
  description?: string;
  totalRecords: number;
  latestMeasurement: string;
  direction: 'IN' | 'OUT' | 'ALL' | 'UNKNOWN';
  detectors: {
    [detectorId: string]: {
      count: number;
      latestValue: number;
      latestTime: string;
    };
  };
}

/**
 * Yhteenvetotilastot
 */
interface SummaryStats {
  totalIn: number;
  totalOut: number;
  latestInTime: string | null;
  latestOutTime: string | null;
}

/**
 * Risteyskohtainen yhteenveto (yhdistää IN/OUT samalle riville)
 */
interface IntersectionSummary {
  deviceId: string;
  description: string;
  inCount: number;
  outCount: number;
  totalCount: number;
  latestTime: string;
  inDetectorCount: number;
  outDetectorCount: number;
  totalDetectorCount: number;
  keywords: string[];
}

/**
 * Aikavälin aggregoitu data
 */
interface AggregatedData {
  timestamp: string;
  [key: string]: string | number; // deviceId_IN, deviceId_OUT, total_IN, total_OUT
}

/**
 * Graafidatan tyyppi
 */
interface ChartData {
  time: string;
  [key: string]: string | number;
}

export default function HistoriaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalIn: 0,
    totalOut: 0,
    latestInTime: null,
    latestOutTime: null,
  });
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  
  // Uudet filtterit
  const [aggregationStep, setAggregationStep] = useState<'5min' | '15min' | 'hour' | 'day' | 'week' | 'month' | 'year'>('hour');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'in' | 'out' | 'all' | 'time'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  /**
   * Palauttaa kaikki uniikit avainsanat konfiguraatiosta
   */
  function getUniqueKeywords(): string[] {
    const keywords = new Set<string>();
    MONITORED_DEVICES.forEach(device => {
      device.keywords?.forEach(keyword => keywords.add(keyword));
    });
    return Array.from(keywords).sort();
  }

  /**
   * Suodattaa laitteet valittujen avainsanojen mukaan
   */
  function getFilteredDeviceIds(): string[] {
    if (selectedKeywords.length === 0) {
      // Jos ei valittuja avainsanoja, palauta kaikki
      return Array.from(new Set(MONITORED_DEVICES.map(d => d.deviceId)));
    }
    
    // Palauta vain ne laitteet, joilla on vähintään yksi valittu avainsana
    const filteredDevices = new Set<string>();
    MONITORED_DEVICES.forEach(device => {
      if (device.keywords?.some(kw => selectedKeywords.includes(kw))) {
        filteredDevices.add(device.deviceId);
      }
    });
    return Array.from(filteredDevices);
  }

  /**
   * Luo värin avainsanalle hash-funktion avulla
   */
  function getKeywordColor(keyword: string): string {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    ];
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < keyword.length; i++) {
      hash = keyword.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Hakee liikennetiedot Supabasesta
   */
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Määritä aikaväli
        let timeFilter = new Date();
        switch (timeRange) {
          case '24h':
            timeFilter.setHours(timeFilter.getHours() - 24);
            break;
          case '7d':
            timeFilter.setDate(timeFilter.getDate() - 7);
            break;
          case '30d':
            timeFilter.setDate(timeFilter.getDate() - 30);
            break;
          case 'all':
            timeFilter = new Date(0); // Kaikki data
            break;
        }

        // Hae data Supabasesta
        const { data, error: fetchError } = await supabase
          .from('traffic_data')
          .select('*')
          .gte('measured_time', timeFilter.toISOString())
          .order('measured_time', { ascending: false })
          .limit(10000); // Rajoita maksimimäärää

        if (fetchError) throw fetchError;

        setTrafficData(data || []);

        // Laske tilastot
        const stats = calculateDeviceStats(data || []);
        setDeviceStats(stats);

        // Laske yhteenvetotilastot
        const summary = calculateSummaryStats(stats);
        setSummaryStats(summary);

        // Valitse ensimmäinen laite oletuksena
        if (stats.length > 0 && !selectedDevice) {
          setSelectedDevice(stats[0].deviceId + '|' + stats[0].direction);
        }
      } catch (err) {
        console.error('Virhe haettaessa dataa:', err);
        setError(err instanceof Error ? err.message : 'Tuntematon virhe');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [timeRange]);

  /**
   * Laskee tilastot laitteittain ja suunnittain (IN/OUT)
   * Käyttää MONITORED_DEVICES-konfiguraatiota kuvauksille ja järjestykselle
   */
  function calculateDeviceStats(data: TrafficData[]): DeviceStats[] {
    const deviceMap = new Map<string, DeviceStats>();

    // Alusta kaikki seuratut laitteet konfiguraatiosta
    // Huom: Samalla deviceId:llä voi olla useita rivejä (IN/OUT)
    MONITORED_DEVICES.forEach((monitoredDevice) => {
      const key = `${monitoredDevice.deviceId}|${monitoredDevice.direction}`;
      
      deviceMap.set(key, {
        deviceId: monitoredDevice.deviceId,
        description: monitoredDevice.description,
        direction: monitoredDevice.direction,
        totalRecords: 0,
        latestMeasurement: new Date(0).toISOString(),
        detectors: {},
      });
    });

    // Käy läpi data ja päivitä tilastot
    data.forEach((record) => {
      // Etsi oikea konfiguraatio tälle ilmaisimelle
      const matchingConfig = MONITORED_DEVICES.find(
        config => config.deviceId === record.device_id && 
                  config.detectors.includes(record.detector_id)
      );

      if (!matchingConfig) return; // Ohita jos ei löydy konfiguraatiosta

      const key = `${matchingConfig.deviceId}|${matchingConfig.direction}`;
      const stats = deviceMap.get(key);
      
      if (!stats) return;

      stats.totalRecords++;

      // Päivitä viimeisin mittausaika
      if (stats.totalRecords === 1 || new Date(record.measured_time) > new Date(stats.latestMeasurement)) {
        stats.latestMeasurement = record.measured_time;
      }

      if (!stats.detectors[record.detector_id]) {
        stats.detectors[record.detector_id] = {
          count: 0,
          latestValue: record.value,
          latestTime: record.measured_time,
        };
      }

      stats.detectors[record.detector_id].count++;
      
      // Päivitä viimeisin arvo jos uudempi
      if (new Date(record.measured_time) > new Date(stats.detectors[record.detector_id].latestTime)) {
        stats.detectors[record.detector_id].latestValue = record.value;
        stats.detectors[record.detector_id].latestTime = record.measured_time;
      }
    });

    // Palauta konfiguraation järjestyksessä, näytä vain ne joilla on dataa
    return MONITORED_DEVICES
      .map(device => {
        const key = `${device.deviceId}|${device.direction}`;
        return deviceMap.get(key)!;
      })
      .filter(stats => stats.totalRecords > 0);
  }

  /**
   * Laskee yhteenvetotilastot IN/OUT-suunnille
   */
  function calculateSummaryStats(stats: DeviceStats[]): SummaryStats {
    let totalIn = 0;
    let totalOut = 0;
    let latestInTime: string | null = null;
    let latestOutTime: string | null = null;

    stats.forEach((device) => {
      // Laske yhteenlaskettu arvo kaikista ilmaisimista
      const deviceTotal = Object.values(device.detectors).reduce(
        (sum, detector) => sum + detector.latestValue,
        0
      );

      if (device.direction === 'IN') {
        totalIn += deviceTotal;
        if (!latestInTime || (device.latestMeasurement && new Date(device.latestMeasurement) > new Date(latestInTime))) {
          latestInTime = device.latestMeasurement;
        }
      } else if (device.direction === 'OUT') {
        totalOut += deviceTotal;
        if (!latestOutTime || (device.latestMeasurement && new Date(device.latestMeasurement) > new Date(latestOutTime))) {
          latestOutTime = device.latestMeasurement;
        }
      }
    });

    return { totalIn, totalOut, latestInTime, latestOutTime };
  }

  /**
   * Luo risteyskohtaisen yhteenvedon (yhdistää IN/OUT)
   */
  function createIntersectionSummaries(stats: DeviceStats[]): IntersectionSummary[] {
    const summaryMap = new Map<string, IntersectionSummary>();

    stats.forEach((device) => {
      const key = `${device.deviceId}|${device.description || ''}`;
      
      if (!summaryMap.has(key)) {
        // Kerää kaikki avainsanat tälle laitteelle
        const deviceKeywords = new Set<string>();
        MONITORED_DEVICES
          .filter(md => md.deviceId === device.deviceId)
          .forEach(md => md.keywords?.forEach(kw => deviceKeywords.add(kw)));
        
        summaryMap.set(key, {
          deviceId: device.deviceId,
          description: device.description || '',
          inCount: 0,
          outCount: 0,
          totalCount: 0,
          latestTime: device.latestMeasurement,
          inDetectorCount: 0,
          outDetectorCount: 0,
          totalDetectorCount: 0,
          keywords: Array.from(deviceKeywords),
        });
      }

      const summary = summaryMap.get(key)!;
      const totalValue = Object.values(device.detectors).reduce((sum, d) => sum + d.latestValue, 0);

      if (device.direction === 'IN') {
        summary.inCount = totalValue;
        summary.inDetectorCount = Object.keys(device.detectors).length;
      } else if (device.direction === 'OUT') {
        summary.outCount = totalValue;
        summary.outDetectorCount = Object.keys(device.detectors).length;
      }

      // Päivitä viimeisin aika
      if (new Date(device.latestMeasurement) > new Date(summary.latestTime)) {
        summary.latestTime = device.latestMeasurement;
      }
    });

    // Laske totalCount ja totalDetectorCount
    summaryMap.forEach((summary) => {
      summary.totalCount = summary.inCount + summary.outCount;
      summary.totalDetectorCount = summary.inDetectorCount + summary.outDetectorCount;
    });

    return Array.from(summaryMap.values());
  }

  /**
   * Luo risteyskohtaisen yhteenvedon aggregoidusta datasta
   */
  function createAggregatedSummaries(): IntersectionSummary[] {
    const aggregated = aggregateData();
    if (aggregated.length === 0) return [];

    const summaryMap = new Map<string, IntersectionSummary>();

    // Alusta yhteenvedot kaikille laitteille
    const uniqueDevices = new Set<string>();
    MONITORED_DEVICES.forEach(d => {
      uniqueDevices.add(d.deviceId);
      const description = MONITORED_DEVICES.find(md => md.deviceId === d.deviceId)?.description || '';
      
      if (!summaryMap.has(d.deviceId)) {
        // Kerää kaikki avainsanat tälle laitteelle
        const deviceKeywords = new Set<string>();
        MONITORED_DEVICES
          .filter(md => md.deviceId === d.deviceId)
          .forEach(md => md.keywords?.forEach(kw => deviceKeywords.add(kw)));
        
        summaryMap.set(d.deviceId, {
          deviceId: d.deviceId,
          description: description,
          inCount: 0,
          outCount: 0,
          totalCount: 0,
          latestTime: new Date(0).toISOString(),
          inDetectorCount: 0,
          outDetectorCount: 0,
          totalDetectorCount: 0,
          keywords: Array.from(deviceKeywords),
        });
      }
    });

    // Laske summat aggregoidusta datasta
    aggregated.forEach((row) => {
      uniqueDevices.forEach((deviceId) => {
        const summary = summaryMap.get(deviceId)!;
        
        const inValue = (row[`${deviceId}_IN`] as number) || 0;
        const outValue = (row[`${deviceId}_OUT`] as number) || 0;
        const allValue = (row[deviceId] as number) || 0;

        summary.inCount += inValue;
        summary.outCount += outValue;
        summary.totalCount += allValue;
      });
    });

    // Etsi viimeisimmät mittausajat raakadatasta (ei aggregoidusta)
    uniqueDevices.forEach((deviceId) => {
      const summary = summaryMap.get(deviceId)!;
      const deviceData = trafficData.filter(d => d.device_id === deviceId);
      
      if (deviceData.length > 0) {
        const latestRecord = deviceData.reduce((latest, current) => 
          new Date(current.measured_time) > new Date(latest.measured_time) ? current : latest
        );
        summary.latestTime = latestRecord.measured_time;
      }
    });

    // Laske ilmaisimien määrät alkuperäisestä konfiguraatiosta
    summaryMap.forEach((summary, deviceId) => {
      const inConfig = MONITORED_DEVICES.find(d => d.deviceId === deviceId && d.direction === 'IN');
      const outConfig = MONITORED_DEVICES.find(d => d.deviceId === deviceId && d.direction === 'OUT');
      
      summary.inDetectorCount = inConfig?.detectors.length || 0;
      summary.outDetectorCount = outConfig?.detectors.length || 0;
      summary.totalDetectorCount = summary.inDetectorCount + summary.outDetectorCount;
    });

    // Palauta vain ne, joilla on dataa
    let results = Array.from(summaryMap.values()).filter(s => s.totalCount > 0);
    
    // Suodata avainsanojen mukaan jos valittuna
    if (selectedKeywords.length > 0) {
      results = results.filter(s => 
        s.keywords.some(kw => selectedKeywords.includes(kw))
      );
    }
    
    return results;
  }

  /**
   * Aggregoi datan valitun aikavälin mukaan
   */
  function aggregateData(): AggregatedData[] {
    if (trafficData.length === 0) return [];

    // Hae suodatetut laitteet avainsanojen mukaan
    const filteredDeviceIds = getFilteredDeviceIds();

    // Filtteröi data päivämäärien mukaan
    let filteredData = trafficData;
    
    // Suodata avainsanojen mukaan
    if (selectedKeywords.length > 0) {
      filteredData = filteredData.filter(d => filteredDeviceIds.includes(d.device_id));
    }
    
    // Jos ei ole asetettu mitään aikasuodatinta, käytä vain viimeisintä ajanjaksoa
    const hasTimeFilter = startDate || endDate;
    
    if (startDate) {
      filteredData = filteredData.filter(d => new Date(d.measured_time) >= new Date(startDate));
    }
    if (endDate) {
      filteredData = filteredData.filter(d => new Date(d.measured_time) <= new Date(endDate));
    }

    // Jos ei ole aikasuodatinta, rajoita viimeiseen ajanjaksoon aggregoinnin mukaan
    if (!hasTimeFilter && filteredData.length > 0) {
      // Etsi viimeisin mittausaika
      const latestTime = new Date(Math.max(...filteredData.map(d => new Date(d.measured_time).getTime())));
      
      // Laske ajanjakson alku aggregoinnin mukaan
      const periodStart = new Date(latestTime);
      switch (aggregationStep) {
        case '5min':
          periodStart.setMinutes(periodStart.getMinutes() - 5);
          break;
        case '15min':
          periodStart.setMinutes(periodStart.getMinutes() - 15);
          break;
        case 'hour':
          periodStart.setHours(periodStart.getHours() - 1);
          break;
        case 'day':
          periodStart.setDate(periodStart.getDate() - 1);
          break;
        case 'week':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'month':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'year':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
      
      // Suodata vain viimeisen ajanjakson data
      filteredData = filteredData.filter(d => new Date(d.measured_time) >= periodStart);
    }

    // Ryhmittele aikavälien mukaan
    const timeMap = new Map<string, Map<string, number>>();

    filteredData.forEach((record) => {
      const config = MONITORED_DEVICES.find(
        c => c.deviceId === record.device_id && c.detectors.includes(record.detector_id)
      );
      if (!config) return;

      const timestamp = roundToStep(new Date(record.measured_time), aggregationStep);
      
      // Laske sekä IN/OUT että ALL
      const keyDirection = `${config.deviceId}_${config.direction}`;
      const keyAll = config.deviceId;

      if (!timeMap.has(timestamp)) {
        timeMap.set(timestamp, new Map());
      }

      const deviceMap = timeMap.get(timestamp)!;
      deviceMap.set(keyDirection, (deviceMap.get(keyDirection) || 0) + record.value);
      deviceMap.set(keyAll, (deviceMap.get(keyAll) || 0) + record.value);
    });

    // Muunna Map -> Array ja laske summat
    const result: AggregatedData[] = [];
    timeMap.forEach((deviceMap, timestamp) => {
      const row: AggregatedData = { timestamp };
      let totalIn = 0;
      let totalOut = 0;
      let totalAll = 0;

      deviceMap.forEach((value, key) => {
        row[key] = value;
        if (key.endsWith('_IN')) totalIn += value;
        if (key.endsWith('_OUT')) totalOut += value;
        // ALL-arvot lasketaan suoraan deviceId:n perusteella
        const uniqueDevices = new Set<string>();
        MONITORED_DEVICES.forEach(d => uniqueDevices.add(d.deviceId));
        if (uniqueDevices.has(key)) {
          // Tämä on ALL-arvo, ei tee mitään tässä
        }
      });

      // Laske totalAll kaikista deviceId-arvoista (ilman _IN/_OUT)
      const uniqueDevices = new Set<string>();
      MONITORED_DEVICES.forEach(d => uniqueDevices.add(d.deviceId));
      uniqueDevices.forEach(deviceId => {
        totalAll += (row[deviceId] as number) || 0;
      });

      row['total_IN'] = totalIn;
      row['total_OUT'] = totalOut;
      row['total_ALL'] = totalAll;
      result.push(row);
    });

    return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Pyöristää ajan valitun stepin mukaan
   */
  function roundToStep(date: Date, step: string): string {
    const d = new Date(date);
    
    switch (step) {
      case '5min':
        d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
        break;
      case '15min':
        d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
        break;
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        d.setHours(0, 0, 0, 0);
        break;
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
      case 'year':
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        break;
    }
    
    return d.toISOString();
  }

  /**
   * Muodostaa graafidatan valitulle laitteelle (deviceId + direction kombinaatio)
   */
  function prepareChartData(deviceKey: string): ChartData[] {
    const [deviceId, direction] = deviceKey.split('|');
    
    // Etsi oikea konfiguraatio
    const config = MONITORED_DEVICES.find(
      d => d.deviceId === deviceId && d.direction === direction
    );
    
    if (!config) return [];

    const deviceData = trafficData
      .filter((d) => 
        d.device_id === deviceId && 
        config.detectors.includes(d.detector_id)
      )
      .sort((a, b) => new Date(a.measured_time).getTime() - new Date(b.measured_time).getTime());

    // Ryhmittele aikaleiman mukaan
    const timeMap = new Map<string, ChartData>();

    deviceData.forEach((record) => {
      const date = new Date(record.measured_time);
      date.setHours(date.getHours() + 2);
      const time = date.toLocaleString('fi-FI', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (!timeMap.has(time)) {
        timeMap.set(time, { time });
      }

      const dataPoint = timeMap.get(time)!;
      dataPoint[record.detector_id] = record.value;
    });

    return Array.from(timeMap.values());
  }

  /**
   * Muotoilee aikaleiman luettavaan muotoon
   * Lisää 2 tuntia koska tietokannassa ajat ovat 2h jäljessä
   */
  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    // Lisää 2 tuntia
    date.setHours(date.getHours() + 2);
    
    return date.toLocaleString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Värit eri ilmaisimille
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a4de6c', '#d084d0', '#8dd1e1'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Historia
              </h1>
            </div>
            <div className="flex gap-2">
              <a
                href="/"
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300 text-sm md:text-base font-medium backdrop-blur-sm shadow-sm"
              >
                <span className="text-lg">←</span>
                <span className="hidden sm:inline">Takaisin</span>
              </a>
              <a
                href="/jalankulkijat"
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300 text-sm md:text-base font-medium backdrop-blur-sm shadow-sm"
              >
                <span className="hidden sm:inline">🚶 Jalankulkijat</span>
                <span className="sm:hidden">🚶</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Yhteenveto IN/OUT/ALL */}
        {!loading && !error && deviceStats.length > 0 && (
          <>
            {selectedKeywords.length > 0 && (
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-semibold">Aktiiviset suodattimet:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedKeywords.map(keyword => (
                      <span
                        key={keyword}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getKeywordColor(keyword)}`}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Kaupunkiin saapuvat (IN) */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-6 rounded-xl border-2 border-green-300 dark:border-green-700 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">➡️</span>
                <div>
                  <h2 className="text-2xl font-bold text-green-800 dark:text-green-300">
                    Saapuvat
                  </h2>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-green-900 dark:text-green-200">
                  {(() => {
                    const aggregated = aggregateData();
                    const total = aggregated.reduce((sum, d) => sum + (d.total_IN as number || 0), 0);
                    return total.toLocaleString('fi-FI');
                  })()} ajoneuvoa
                </p>
              </div>
            </div>

            {/* Kaupungista poistuvat (OUT) */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 p-6 rounded-xl border-2 border-blue-300 dark:border-blue-700 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">⬅️</span>
                <div>
                  <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                    Poistuvat
                  </h2>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-200">
                  {(() => {
                    const aggregated = aggregateData();
                    const total = aggregated.reduce((sum, d) => sum + (d.total_OUT as number || 0), 0);
                    return total.toLocaleString('fi-FI');
                  })()} ajoneuvoa
                </p>
              </div>
            </div>

            {/* Kaikki yhteensä (ALL) */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 p-6 rounded-xl border-2 border-purple-300 dark:border-purple-700 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">🔄</span>
                <div>
                  <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                    Yhteensä
                  </h2>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-200">
                  {(() => {
                    const aggregated = aggregateData();
                    const total = aggregated.reduce((sum, d) => sum + (d.total_ALL as number || 0), 0);
                    return total.toLocaleString('fi-FI');
                  })()} ajoneuvoa
                </p>
              </div>
            </div>
            </div>
          </>
        )}

        {/* Latausanimaatio */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Virheviesti */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            <strong>Virhe:</strong> {error}
          </div>
        )}

        {/* Tilastot */}
        {!loading && !error && deviceStats.length > 0 && (
          <>
            {/* Filtterit */}
            <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-bold mb-4">Suodattimet</h2>
              
              {/* Avainsanasuodatin */}
              {getUniqueKeywords().length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-3">Suodata avainsanoilla</label>
                  <div className="flex flex-wrap gap-2">
                    {getUniqueKeywords().map(keyword => (
                      <button
                        key={keyword}
                        onClick={() => {
                          if (selectedKeywords.includes(keyword)) {
                            setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
                          } else {
                            setSelectedKeywords([...selectedKeywords, keyword]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selectedKeywords.includes(keyword)
                            ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800 ' + getKeywordColor(keyword)
                            : getKeywordColor(keyword) + ' opacity-50 hover:opacity-100'
                        }`}
                      >
                        {keyword}
                        {selectedKeywords.includes(keyword) && ' ✓'}
                      </button>
                    ))}
                  </div>
                  {selectedKeywords.length > 0 && (
                    <button
                      onClick={() => setSelectedKeywords([])}
                      className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline"
                    >
                      Tyhjennä avainsanasuodattimet
                    </button>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Aggregoinnin taso */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Aikaväli</label>
                  <select
                    value={aggregationStep}
                    onChange={(e) => setAggregationStep(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="5min">5 minuuttia</option>
                    <option value="15min">15 minuuttia</option>
                    <option value="hour">Tunti</option>
                    <option value="day">Päivä</option>
                    <option value="week">Viikko</option>
                    <option value="month">Kuukausi</option>
                    <option value="year">Vuosi</option>
                  </select>
                </div>

                {/* Aloitusaika */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Aloitusaika</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Lopetusaika */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Lopetusaika</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Nollaa filtterit */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setAggregationStep('hour');
                      setSelectedKeywords([]);
                    }}
                    className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Nollaa filtterit
                  </button>
                </div>
              </div>
            </div>

            {/* Risteyskohtainen taulukko */}
            <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold">Risteyskohtaiset tilastot</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setSortBy('name');
                        }}
                      >
                        Risteys {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          if (sortBy === 'in') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setSortBy('in');
                        }}
                      >
                        Saapuvat {sortBy === 'in' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          if (sortBy === 'out') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setSortBy('out');
                        }}
                      >
                        Poistuvat {sortBy === 'out' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          if (sortBy === 'all') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setSortBy('all');
                        }}
                      >
                        Yhteensä {sortBy === 'all' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          if (sortBy === 'time') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setSortBy('time');
                        }}
                      >
                        Viimeisin mittaus {sortBy === 'time' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {(() => {
                      const summaries = createAggregatedSummaries();
                      
                      // Järjestä
                      summaries.sort((a, b) => {
                        let comparison = 0;
                        switch (sortBy) {
                          case 'name':
                            comparison = a.deviceId.localeCompare(b.deviceId);
                            break;
                          case 'in':
                            comparison = a.inCount - b.inCount;
                            break;
                          case 'out':
                            comparison = a.outCount - b.outCount;
                            break;
                          case 'all':
                            comparison = a.totalCount - b.totalCount;
                            break;
                          case 'time':
                            comparison = new Date(a.latestTime).getTime() - new Date(b.latestTime).getTime();
                            break;
                        }
                        return sortOrder === 'asc' ? comparison : -comparison;
                      });

                      return summaries.map((summary) => (
                        <tr 
                          key={summary.deviceId}
                          onClick={() => {
                            // Valitse ensimmäinen IN-suunta tästä risteyksestä
                            const device = deviceStats.find(d => d.deviceId === summary.deviceId && d.direction === 'IN');
                            if (device) {
                              setSelectedDevice(`${device.deviceId}|${device.direction}`);
                            }
                          }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 dark:text-white">{summary.description}</div>
                            {summary.description && (
                              <div className="text-sm text-gray-600 dark:text-gray-400">Laite: {summary.deviceId}</div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              IN: {summary.inDetectorCount} | OUT: {summary.outDetectorCount} | ALL: {summary.totalDetectorCount} ilmaisinta
                            </div>
                            {summary.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {summary.keywords.map(keyword => (
                                  <span
                                    key={keyword}
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getKeywordColor(keyword)}`}
                                  >
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-lg font-bold text-green-700 dark:text-green-400">
                              {summary.inCount.toLocaleString('fi-FI')}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                              {summary.outCount.toLocaleString('fi-FI')}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                              {summary.totalCount.toLocaleString('fi-FI')}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                            {formatTime(summary.latestTime)}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Graafit aggregoidusta datasta */}
            <div className="space-y-8 mb-8">
              <h2 className="text-2xl font-bold">Liikennemäärien kehitys</h2>
              
              {/* Yhteenveto IN/OUT/ALL -graafi */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4">
                  Kaikkien risteysten yhteenlaskettu liikenne
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={aggregateData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        date.setHours(date.getHours() + 2);
                        return date.toLocaleString('fi-FI', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      }}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => {
                        const date = new Date(value);
                        date.setHours(date.getHours() + 2);
                        return date.toLocaleString('fi-FI');
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_IN"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Saapuvat"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_OUT"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      name="Poistuvat"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_ALL"
                      stroke="#a855f7"
                      strokeWidth={3}
                      name="Yhteensä"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Tyhjä data */}
        {!loading && !error && deviceStats.length === 0 && (
          <div className="text-center py-20">
            <div className="mb-6">
              <span className="text-6xl">📊</span>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              Ei liikennetietoja valitulla aikavälillä.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Tarkista että cron-job on ajettu ja Supabase-yhteys toimii.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 max-w-2xl mx-auto text-left">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Seuratut risteyket:</h3>
              <ul className="space-y-2 text-sm">
                {MONITORED_DEVICES.map((device) => (
                  <li key={device.deviceId} className="text-gray-700 dark:text-gray-300">
                    <span className="font-mono font-semibold">{device.deviceId}</span>
                    {device.description && (
                      <span className="text-gray-600 dark:text-gray-400"> - {device.description}</span>
                    )}
                    <span className="text-gray-500 dark:text-gray-500 text-xs ml-2">
                      ({device.detectors.length} ilmaisinta)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Oskari Järvelin | <a href="https://wp.oulunliikenne.fi/avoin-data/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">Avoin data</a> | <a href="https://github.com/oskarijarvelin/oulu2026tpm" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
