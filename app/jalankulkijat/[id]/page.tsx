"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

interface EcoCounterDataPoint {
  date: string;
  counts: number;
}

interface EcoCounterSiteData {
  date: string;
  counts: number;
}

interface ChannelInfo {
  siteId: string;
  name: string;
}

interface ChannelData {
  channelName: string;
  data: EcoCounterDataPoint[];
}

function SiteDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const domain = searchParams.get('domain') || 'Oulu_kaupunki';
  const siteName = searchParams.get('name') || 'Laskenta-asema';
  const channelsParam = searchParams.get('channels');
  
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [channelDataList, setChannelDataList] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'hour' | 'day' | 'week' | 'month'>('hour');
  const [beginDate, setBeginDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0] + 'T00:00:00';
  });

  // Parse channels from URL parameter
  useEffect(() => {
    if (channelsParam) {
      try {
        const parsedChannels = JSON.parse(decodeURIComponent(channelsParam));
        setChannels(parsedChannels);
      } catch (e) {
        console.error('Error parsing channels:', e);
        setChannels([]);
      }
    }
  }, [channelsParam]);

  useEffect(() => {
    const fetchData = async () => {
      if (!channels.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Fetch data for each channel separately
        const channelDataResults: ChannelData[] = [];
        
        for (const channel of channels) {
          const response = await fetch('https://api.oulunliikenne.fi/proxy/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query GetEcoCounterSiteData {
                  ecoCounterSiteData(
                    id: "${channel.siteId}",
                    domain: ${domain},
                    step: ${step},
                    begin: "${beginDate}"
                  ) {
                    date
                    counts
                  }
                }
              `
            })
          });

          const result = await response.json();
          
          if (result.errors) {
            console.error(`Error fetching channel ${channel.siteId}:`, result.errors);
            continue;
          }
          
          if (result.data && result.data.ecoCounterSiteData) {
            channelDataResults.push({
              channelName: channel.name,
              data: result.data.ecoCounterSiteData
            });
          }
        }
        
        setChannelDataList(channelDataResults);
      } catch (error) {
        console.error('Error fetching site data:', error);
        setError('Virhe tietojen haussa');
        setChannelDataList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [channels, domain, step, beginDate]);

  // Get channel label in Finnish
  const getChannelLabel = (name: string) => {
    if (name.includes('JK_IN')) return 'Saapuvat jalankulkijat';
    if (name.includes('JK_OUT')) return 'Poistuvat jalankulkijat';
    if (name.includes('PP_IN')) return 'Saapuvat pyöräilijät';
    if (name.includes('PP_OUT')) return 'Poistuvat pyöräilijät';
    return name;
  };

  // Get channel color
  const getChannelColor = (name: string) => {
    if (name.includes('JK_IN')) return 'text-blue-600 dark:text-blue-400';
    if (name.includes('JK_OUT')) return 'text-cyan-600 dark:text-cyan-400';
    if (name.includes('PP_IN')) return 'text-green-600 dark:text-green-400';
    if (name.includes('PP_OUT')) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // Calculate statistics for each channel
  const getChannelStats = (data: EcoCounterDataPoint[]) => {
    const total = data.reduce((sum, item) => sum + (item.counts || 0), 0);
    const average = data.length > 0 ? Math.round(total / data.length) : 0;
    const max = data.length > 0 ? Math.max(...data.map(d => d.counts || 0)) : 0;
    const min = data.length > 0 ? Math.min(...data.map(d => d.counts || 0)) : 0;
    return { total, average, max, min };
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (step === 'hour') {
        return date.toLocaleString('fi-FI', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else if (step === 'day') {
        return date.toLocaleDateString('fi-FI', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric'
        });
      } else if (step === 'week') {
        return `Viikko ${date.toLocaleDateString('fi-FI', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric'
        })}`;
      } else {
        return date.toLocaleDateString('fi-FI', { 
          month: 'long', 
          year: 'numeric'
        });
      }
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-blue-50">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                {siteName}
              </h1>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Site ID: {siteId}
              </p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/jalankulkijat"
                className="text-sm md:text-base text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Takaisin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-gray-900 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Suodattimet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aikaväli
              </label>
              <select
                value={step}
                onChange={(e) => setStep(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="hour">Tunti</option>
                <option value="day">Päivä</option>
                <option value="week">Viikko</option>
                <option value="month">Kuukausi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alkupäivämäärä
              </label>
              <input
                type="date"
                value={beginDate.split('T')[0]}
                onChange={(e) => setBeginDate(`${e.target.value}T00:00:00`)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Ladataan tietoja...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : channelDataList.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">Ei dataa valitulla aikavälillä</p>
          </div>
        ) : (
          <>
            {/* Statistics table */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Yhteenveto
                </h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tyyppi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Yhteensä
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Keskiarvo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Maksimi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Minimi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {channelDataList.map((channelData, idx) => {
                    const stats = getChannelStats(channelData.data);
                    const colorClass = getChannelColor(channelData.channelName);
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className={`px-4 py-3 text-sm font-medium ${colorClass}`}>
                          {getChannelLabel(channelData.channelName)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-semibold">
                          {stats.total.toLocaleString('fi-FI')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          {stats.average.toLocaleString('fi-FI')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                          {stats.max.toLocaleString('fi-FI')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">
                          {stats.min.toLocaleString('fi-FI')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Data Tables per channel */}
            {channelDataList.map((channelData, idx) => {
          const colorClass = getChannelColor(channelData.channelName);
          
          return (
            <div key={idx} className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className={`text-lg font-semibold ${colorClass}`}>
                  {getChannelLabel(channelData.channelName)} ({channelData.data.length} riviä)
                </h2>
              </div>
              
              {channelData.data.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-600 dark:text-gray-400">Ei dataa valitulla aikavälillä</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Päivämäärä
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Määrä
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {channelData.data.map((item, index) => (
                        <tr 
                          key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatDate(item.date)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${colorClass}`}>
                            {item.counts.toLocaleString('fi-FI')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
          </>
        )}
      </div>
    </div>
  );
}

export default function SiteDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-white mb-4">
            Ladataan tietoja...
          </h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </div>
    }>
      <SiteDetailsContent />
    </Suspense>
  );
}
