"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

interface AllDetectorsData {
  [detectorId: string]: TrafficData | null;
}

interface IntersectionData {
  id: string;
  location: string;
  north: string;
  east: string;
  uid: string; // unique per CSV row to support duplicate ids
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [allDetectorsData, setAllDetectorsData] = useState<AllDetectorsData>({});
  const [intersections, setIntersections] = useState<IntersectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  
  // Get parameters from URL, with defaults
  const deviceId = searchParams.get('device') || 'OULU002';
  const detectorId = searchParams.get('detector') || ''; // No default detector
  // Optional unique id to select a specific CSV row when device ids are duplicated
  const devUid = searchParams.get('devUid') || '';

  // Load intersections data
  useEffect(() => {
    const loadIntersections = async () => {
      try {
        const response = await fetch('/intersections.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n').slice(1); // Skip header
        const intersectionsData = lines
          .map(line => line.trim())
          .filter(line => line)
          .map((line, idx) => {
            const [id, location, north, east] = line.split(';');
            const trimmedId = id?.trim();
            return {
              id: trimmedId,
              location: location?.trim(),
              north: north?.trim(),
              east: east?.trim(),
              uid: `${trimmedId || 'unknown'}_${idx}`,
            } as IntersectionData;
          })
          .filter(item => item.id); // Filter out invalid entries
        
        setIntersections(intersectionsData);
      } catch (err) {
        console.error('Error loading intersections:', err);
      }
    };
    
    loadIntersections();
  }, []);

  useEffect(() => {
    const fetchTrafficData = async () => {
      setLoading(true);
      setError(null);
      setTrafficData(null);
      setAllDetectorsData({});

      try {
        if (detectorId) {
          // Fetch data for specific detector
          const apiUrl = `https://api.oulunliikenne.fi/tpm/kpi/traffic-volume/${deviceId}/${detectorId}`;
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setTrafficData(data);
        } else {
          // Fetch data for all detectors by omitting the detector ID from API URL
          const apiUrl = `https://api.oulunliikenne.fi/tpm/kpi/traffic-volume/${deviceId}`;
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const allDetectorsResponse = await response.json();
          console.log('All tunnistimet API response:', allDetectorsResponse);
          const allData: AllDetectorsData = {};
          
          // Check if response is an array of detector data
          if (Array.isArray(allDetectorsResponse)) {
            allDetectorsResponse.forEach((detectorData: TrafficData) => {
              if (detectorData.values && detectorData.values.length > 0) {
                const detectorId = detectorData.values[0].detName;
                allData[detectorId] = detectorData;
              }
            });
          } else if (allDetectorsResponse.values) {
            // If it's a single response with multiple values, group by detector name
            const detectorGroups: { [key: string]: TrafficData } = {};
            
            allDetectorsResponse.values.forEach((value: any) => {
              if (!detectorGroups[value.detName]) {
                detectorGroups[value.detName] = {
                  devName: allDetectorsResponse.devName,
                  measuredTime: allDetectorsResponse.measuredTime,
                  values: []
                };
              }
              detectorGroups[value.detName].values.push(value);
            });
            
            Object.keys(detectorGroups).forEach(detectorId => {
              allData[detectorId] = detectorGroups[detectorId];
            });
          } else {
            console.warn('Unexpected API response format:', allDetectorsResponse);
            throw new Error('Odottamaton API-vastauksen muoto');
          }

          console.log('Processed tunnistin data:', allData);
          setAllDetectorsData(allData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Virhe datan haussa');
      } finally {
        setLoading(false);
      }
    };

    fetchTrafficData();
  }, [deviceId, detectorId]);
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Oulu2026 TPM
              </h1>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                Risteystiedot
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col gap-4 sm:gap-6 w-full">
          
          <div className="w-full max-w-3xl space-y-3 sm:space-y-4">
            <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Valitse laite:
                  </label>
                  <select
                    value={
                      // prefer devUid if present, otherwise select first matching device id's uid
                      devUid || intersections.find(i => i.id === deviceId)?.uid || ''
                    }
                    onChange={(e) => {
                      const newUrl = new URL(window.location.href);
                      const selectedUid = e.target.value;
                      const selected = intersections.find(i => i.uid === selectedUid);
                      if (selected) {
                        newUrl.searchParams.set('device', selected.id);
                        newUrl.searchParams.set('devUid', selected.uid);
                      }
                      window.location.href = newUrl.toString();
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm sm:text-base bg-white dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    {intersections.map((intersection) => (
                      <option key={intersection.uid} value={intersection.uid}>
                        {intersection.id} - {intersection.location}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Tunnistin:
                  </label>
                  <select
                    value={detectorId}
                    onChange={(e) => {
                      const newUrl = new URL(window.location.href);
                      if (e.target.value) {
                        newUrl.searchParams.set('detector', e.target.value);
                      } else {
                        newUrl.searchParams.delete('detector');
                      }
                      window.location.href = newUrl.toString();
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm sm:text-base bg-white dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Kaikki tunnistimet</option>
                    {Object.keys(allDetectorsData)
                      .sort((a, b) => a.localeCompare(b))
                      .map((detector) => (
                        <option key={detector} value={detector}>
                          {detector} - {allDetectorsData[detector]?.values[0]?.sgName || 'Tuntematon sijainti'}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {detectorId ? `Näytetään vain tunnistin: ${detectorId}` : 'Näytetään kaikki saatavilla olevat tunnistimet'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {loading && (
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Ladataan liikennetietoja...
            </p>
          )}
          
          {error && (
            <p className="text-sm md:text-base text-red-600 dark:text-red-400">
              Virhe: {error}
            </p>
          )}
          
          {trafficData && detectorId && (
            <div className="w-full max-w-3xl space-y-3 sm:space-y-4">
              <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {trafficData.devName}
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  {new Date(trafficData.measuredTime).toLocaleString('fi-FI')}
                </p>
              </div>
              
              {trafficData.values.map((value, index) => (
                <div key={index} className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-base sm:text-lg font-medium mb-2 text-gray-900 dark:text-white">
                    {value.detName} ({value.sgName})
                  </h3>
                  <div className="space-y-1 text-sm sm:text-base text-gray-700 dark:text-gray-300">
                    <p><span className="font-medium">Liikennemäärä:</span> {value.value} ajoneuvoa</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!detectorId && Object.keys(allDetectorsData).length > 0 && (
            <div className="w-full space-y-3 sm:space-y-4">
              {/* Show location/coords for the selected CSV row (supports duplicates) */}
              <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {(() => {
                    const selected = devUid ? intersections.find(i => i.uid === devUid) : intersections.find(i => i.id === deviceId);
                    return selected?.location || deviceId;
                  })()}
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  {(() => {
                    const selected = devUid ? intersections.find(i => i.uid === devUid) : intersections.find(i => i.id === deviceId);
                    return `ID: ${deviceId} | Sijainti: N: ${selected?.north || '-'}, E: ${selected?.east || '-'}`;
                  })()}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm sm:text-base">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tunnistin
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Liikennemäärä
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Luotettavuus
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {Object.entries(allDetectorsData).map(([detector, data]) => (
                        <tr key={detector} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-all">
                            {detector}
                          </td>
                          {data ? (
                            <>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {data.values[0]?.value || 0} autoa
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {data.values[0]?.reliabValue || 0} / 5
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">-</td>
                              <td className="hidden sm:table-cell px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  Ei dataa
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">-</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {Object.values(allDetectorsData).filter(Boolean).length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-base sm:text-lg font-medium mb-2 text-gray-900 dark:text-white">
                    Yhteenveto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">Kokonaisliikennemäärä:</span>{' '}
                      <span className="text-green-600 dark:text-green-400">
                        {Object.values(allDetectorsData)
                          .filter(Boolean)
                          .reduce((sum, data) => sum + (data?.values[0]?.value || 0), 0)} ajoneuvoa
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">Viimeisin päivitys:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-400">
                        {(() => {
                          const latestTime = Object.values(allDetectorsData)
                            .filter(Boolean)
                            .map(data => new Date(data!.measuredTime))
                            .sort((a, b) => b.getTime() - a.getTime())[0];
                          return latestTime ? latestTime.toLocaleTimeString('fi-FI') : '-';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Risteyksen kuva */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-3 sm:p-4">
                  <h3 className="text-base sm:text-lg font-medium mb-3 text-gray-900 dark:text-white">
                    Risteyksen kuva
                  </h3>
                  <div 
                    className="relative w-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImageModalOpen(true)}
                  >
                    <Image
                      src={`/intersections/${deviceId}.png`}
                      alt={`Risteys ${deviceId}`}
                      width={800}
                      height={600}
                      className="w-full h-auto"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.error-message')) {
                          parent.style.cursor = 'default';
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'error-message flex items-center justify-center h-32 text-gray-500 dark:text-gray-400';
                          errorDiv.textContent = 'Kuvaa ei saatavilla';
                          parent.appendChild(errorDiv);
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                    Klikkaa kuvaa nähdäksesi sen suurempana
                  </p>
                </div>
              </div>

              {/* Image Modal */}
              {imageModalOpen && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4"
                  onClick={() => setImageModalOpen(false)}
                >
                  <div className="relative max-w-7xl max-h-full w-full">
                    <button
                      onClick={() => setImageModalOpen(false)}
                      className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xl sm:text-2xl z-10"
                    >
                      ✕
                    </button>
                    <Image
                      src={`/intersections/${deviceId}.png`}
                      alt={`Risteys ${deviceId}`}
                      width={1600}
                      height={1200}
                      className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row mt-6 md:mt-8">
          <button
            onClick={() => window.location.reload()}
            className="flex h-10 md:h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 md:px-5 text-sm md:text-base text-white transition-colors hover:bg-blue-700 font-medium"
          >
            Päivitä tiedot
          </button>
          <Link
            href="/"
            className="flex h-10 md:h-12 items-center justify-center rounded-lg bg-green-600 px-4 md:px-5 text-sm md:text-base text-white transition-colors hover:bg-green-700 font-medium"
          >
            🗺️ Kartta
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-white mb-4">
            Ladataan...
          </h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
