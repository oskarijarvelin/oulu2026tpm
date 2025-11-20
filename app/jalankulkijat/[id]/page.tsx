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
  const [step, setStep] = useState<'_15m' | 'hour' | 'day' | 'week' | 'month' | 'year'>('hour');
  const [beginDate, setBeginDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0] + 'T00:00:00';
  });
  const [endDate, setEndDate] = useState<string>('');
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; dataIndex: number } | null>(null);

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
                    begin: "${beginDate}"${endDate ? `,\n                    end: "${endDate}"` : ''}
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
  }, [channels, domain, step, beginDate, endDate]);

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
      if (step === '_15m' || step === 'hour') {
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
      } else if (step === 'month') {
        return date.toLocaleDateString('fi-FI', { 
          month: 'long', 
          year: 'numeric'
        });
      } else {
        return date.toLocaleDateString('fi-FI', { 
          year: 'numeric'
        });
      }
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-gray-900">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aikaväli
              </label>
              <select
                value={step}
                onChange={(e) => setStep(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="_15m">15 minuuttia</option>
                <option value="hour">Tunti</option>
                <option value="day">Päivä</option>
                <option value="week">Viikko</option>
                <option value="month">Kuukausi</option>
                <option value="year">Vuosi</option>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Loppupäivämäärä (valinnainen)
              </label>
              <input
                type="date"
                value={endDate.split('T')[0]}
                onChange={(e) => setEndDate(e.target.value ? `${e.target.value}T23:59:59` : '')}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Jalankulkijat taulukko */}
              {(channelDataList.some(ch => ch.channelName.includes('JK_IN')) || 
                channelDataList.some(ch => ch.channelName.includes('JK_OUT'))) && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Jalankulkijat
                    </h2>
                  </div>
                  
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Päivämäärä
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            Saapuvat
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                            Poistuvat
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(() => {
                          const jkIn = channelDataList.find(ch => ch.channelName.includes('JK_IN'));
                          const jkOut = channelDataList.find(ch => ch.channelName.includes('JK_OUT'));
                          const maxLength = Math.max(jkIn?.data.length || 0, jkOut?.data.length || 0);
                          
                          return Array.from({ length: maxLength }, (_, index) => {
                            const inData = jkIn?.data[index];
                            const outData = jkOut?.data[index];
                            const date = inData?.date || outData?.date;
                            
                            return date ? (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                  {formatDate(date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                                  {inData ? inData.counts.toLocaleString('fi-FI') : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium text-cyan-600 dark:text-cyan-400">
                                  {outData ? outData.counts.toLocaleString('fi-FI') : '-'}
                                </td>
                              </tr>
                            ) : null;
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pyöräilijät taulukko */}
              {(channelDataList.some(ch => ch.channelName.includes('PP_IN')) || 
                channelDataList.some(ch => ch.channelName.includes('PP_OUT'))) && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Pyöräilijät
                    </h2>
                  </div>
                  
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Päivämäärä
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">
                            Saapuvat
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Poistuvat
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(() => {
                          const ppIn = channelDataList.find(ch => ch.channelName.includes('PP_IN'));
                          const ppOut = channelDataList.find(ch => ch.channelName.includes('PP_OUT'));
                          const maxLength = Math.max(ppIn?.data.length || 0, ppOut?.data.length || 0);
                          
                          return Array.from({ length: maxLength }, (_, index) => {
                            const inData = ppIn?.data[index];
                            const outData = ppOut?.data[index];
                            const date = inData?.date || outData?.date;
                            
                            return date ? (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                  {formatDate(date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                                  {inData ? inData.counts.toLocaleString('fi-FI') : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">
                                  {outData ? outData.counts.toLocaleString('fi-FI') : '-'}
                                </td>
                              </tr>
                            ) : null;
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Combined Chart */}
            <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Yhdistetty kaavio
              </h2>
              <div className="relative" style={{ height: '450px' }}>
                <svg 
                  viewBox="0 0 1000 450" 
                  className="w-full h-full" 
                  preserveAspectRatio="xMidYMid meet"
                  onMouseLeave={() => setTooltipData(null)}
                >
                  {(() => {
                    // Get all data points and find min/max
                    const allDataPoints = channelDataList.flatMap(ch => ch.data.map(d => d.counts));
                    const maxCount = Math.max(...allDataPoints, 1);
                    const minCount = Math.min(...allDataPoints, 0);
                    const range = maxCount - minCount || 1;

                    // Chart dimensions
                    const chartWidth = 900;
                    const chartHeight = 320;
                    const marginLeft = 80;
                    const marginBottom = 60;
                    const marginTop = 20;

                    // Get the longest dataset for x-axis
                    const maxDataLength = Math.max(...channelDataList.map(ch => ch.data.length), 1);
                    const xStep = chartWidth / Math.max(maxDataLength - 1, 1);

                    // Y-axis scaling
                    const yScale = (value: number) => {
                      return marginTop + chartHeight - ((value - minCount) / range) * chartHeight;
                    };

                    // Define colors for each channel
                    const channelColors = {
                      'JK_IN': '#2563eb',   // blue-600
                      'JK_OUT': '#0891b2',  // cyan-600
                      'PP_IN': '#16a34a',   // green-600
                      'PP_OUT': '#059669'   // emerald-600
                    };

                    // Draw grid lines
                    const gridLines = [];
                    for (let i = 0; i <= 5; i++) {
                      const y = marginTop + (chartHeight / 5) * i;
                      const value = maxCount - (range / 5) * i;
                      gridLines.push(
                        <g key={`grid-${i}`}>
                          <line
                            x1={marginLeft}
                            y1={y}
                            x2={marginLeft + chartWidth}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth="1"
                            className="text-gray-200 dark:text-gray-700"
                            strokeDasharray="4"
                          />
                          <text
                            x={marginLeft - 10}
                            y={y + 4}
                            textAnchor="end"
                            className="text-xs fill-gray-600 dark:fill-gray-400"
                          >
                            {Math.round(value).toLocaleString('fi-FI')}
                          </text>
                        </g>
                      );
                    }

                    // Draw lines for each channel
                    const channelLines = channelDataList.map((channelData, channelIdx) => {
                      const channelType = 
                        channelData.channelName.includes('JK_IN') ? 'JK_IN' :
                        channelData.channelName.includes('JK_OUT') ? 'JK_OUT' :
                        channelData.channelName.includes('PP_IN') ? 'PP_IN' :
                        channelData.channelName.includes('PP_OUT') ? 'PP_OUT' : 'JK_IN';
                      
                      const color = channelColors[channelType as keyof typeof channelColors];
                      
                      const points = channelData.data.map((point, index) => {
                        const x = marginLeft + index * xStep;
                        const y = yScale(point.counts);
                        return `${x},${y}`;
                      }).join(' ');

                      const pathData = channelData.data.map((point, index) => {
                        const x = marginLeft + index * xStep;
                        const y = yScale(point.counts);
                        return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                      }).join(' ');

                      return (
                        <g key={channelIdx}>
                          <path
                            d={pathData}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          {/* Draw points */}
                          {channelData.data.map((point, index) => {
                            const x = marginLeft + index * xStep;
                            const y = yScale(point.counts);
                            return (
                              <circle
                                key={index}
                                cx={x}
                                cy={y}
                                r="3"
                                fill={color}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={(e) => {
                                  const svg = e.currentTarget.ownerSVGElement;
                                  if (svg) {
                                    const pt = svg.createSVGPoint();
                                    pt.x = e.clientX;
                                    pt.y = e.clientY;
                                    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                                    setTooltipData({ x: svgP.x, y: svgP.y, dataIndex: index });
                                  }
                                }}
                              />
                            );
                          })}
                        </g>
                      );
                    });

                    // Draw axes
                    return (
                      <>
                        {gridLines}
                        
                        {/* Y-axis */}
                        <line
                          x1={marginLeft}
                          y1={marginTop}
                          x2={marginLeft}
                          y2={marginTop + chartHeight}
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-gray-400 dark:text-gray-600"
                        />
                        
                        {/* X-axis */}
                        <line
                          x1={marginLeft}
                          y1={marginTop + chartHeight}
                          x2={marginLeft + chartWidth}
                          y2={marginTop + chartHeight}
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-gray-400 dark:text-gray-600"
                        />

                        {channelLines}

                        {/* Tooltip */}
                        {tooltipData !== null && (() => {
                          const dataIndex = tooltipData.dataIndex;
                          // Get data for all channels at this index
                          const tooltipItems = channelDataList.map(ch => ({
                            label: getChannelLabel(ch.channelName),
                            value: ch.data[dataIndex]?.counts || 0,
                            date: ch.data[dataIndex]?.date,
                            channelType: 
                              ch.channelName.includes('JK_IN') ? 'JK_IN' :
                              ch.channelName.includes('JK_OUT') ? 'JK_OUT' :
                              ch.channelName.includes('PP_IN') ? 'PP_IN' :
                              ch.channelName.includes('PP_OUT') ? 'PP_OUT' : 'JK_IN'
                          })).filter(item => item.date);

                          if (tooltipItems.length === 0) return null;

                          const tooltipWidth = 200;
                          const tooltipHeight = 20 + tooltipItems.length * 20 + 10;
                          let tooltipX = tooltipData.x + 10;
                          let tooltipY = tooltipData.y - tooltipHeight / 2;

                          // Keep tooltip within bounds
                          if (tooltipX + tooltipWidth > marginLeft + chartWidth) {
                            tooltipX = tooltipData.x - tooltipWidth - 10;
                          }
                          if (tooltipY < marginTop) tooltipY = marginTop;
                          if (tooltipY + tooltipHeight > marginTop + chartHeight) {
                            tooltipY = marginTop + chartHeight - tooltipHeight;
                          }

                          return (
                            <g>
                              {/* Tooltip background */}
                              <rect
                                x={tooltipX}
                                y={tooltipY}
                                width={tooltipWidth}
                                height={tooltipHeight}
                                fill="white"
                                stroke="#d1d5db"
                                strokeWidth="1"
                                rx="4"
                                className="dark:fill-gray-800 dark:stroke-gray-600"
                                style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
                              />
                              {/* Tooltip date */}
                              <text
                                x={tooltipX + 10}
                                y={tooltipY + 15}
                                className="text-xs font-semibold fill-gray-900 dark:fill-white"
                              >
                                {formatDate(tooltipItems[0].date)}
                              </text>
                              {/* Tooltip values */}
                              {tooltipItems.map((item, idx) => (
                                <g key={idx}>
                                  <circle
                                    cx={tooltipX + 10}
                                    cy={tooltipY + 30 + idx * 20}
                                    r="3"
                                    fill={channelColors[item.channelType as keyof typeof channelColors]}
                                  />
                                  <text
                                    x={tooltipX + 20}
                                    y={tooltipY + 34 + idx * 20}
                                    className="text-xs fill-gray-700 dark:fill-gray-300"
                                  >
                                    {item.label}:
                                  </text>
                                  <text
                                    x={tooltipX + tooltipWidth - 10}
                                    y={tooltipY + 34 + idx * 20}
                                    textAnchor="end"
                                    className="text-xs font-semibold fill-gray-900 dark:fill-white"
                                  >
                                    {item.value.toLocaleString('fi-FI')}
                                  </text>
                                </g>
                              ))}
                            </g>
                          );
                        })()}

                        {/* Legend */}
                        <g transform={`translate(${marginLeft}, ${marginTop + chartHeight + 40})`}>
                          {channelDataList.map((channelData, idx) => {
                            const channelType = 
                              channelData.channelName.includes('JK_IN') ? 'JK_IN' :
                              channelData.channelName.includes('JK_OUT') ? 'JK_OUT' :
                              channelData.channelName.includes('PP_IN') ? 'PP_IN' :
                              channelData.channelName.includes('PP_OUT') ? 'PP_OUT' : 'JK_IN';
                            
                            const color = channelColors[channelType as keyof typeof channelColors];
                            const xOffset = (idx % 2) * 450;
                            const yOffset = Math.floor(idx / 2) * 20;
                            
                            return (
                              <g key={idx} transform={`translate(${xOffset}, ${yOffset})`}>
                                <line
                                  x1={0}
                                  y1={0}
                                  x2={30}
                                  y2={0}
                                  stroke={color}
                                  strokeWidth="3"
                                />
                                <circle
                                  cx={15}
                                  cy={0}
                                  r={4}
                                  fill={color}
                                />
                                <text
                                  x={40}
                                  y={4}
                                  className="text-xs fill-gray-700 dark:fill-gray-300"
                                >
                                  {getChannelLabel(channelData.channelName)}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Oskari Järvelin | <a href="https://wp.oulunliikenne.fi/avoin-data/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Avoin data</a> | <a href="https://github.com/oskarijarvelin/oulu2026tpm" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GitHub</a>
          </p>
        </div>
      </footer>
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
