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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Oulu2026 TPM
          </h1>
          
          <div className="w-full max-w-md space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {intersections.map((intersection) => (
                      <option key={intersection.uid} value={intersection.uid}>
                        {intersection.id} - {intersection.location}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {detectorId ? `Näytetään vain tunnistin: ${detectorId}` : 'Näytetään kaikki saatavilla olevat tunnistimet'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {loading && (
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Ladataan liikennetietoja...
            </p>
          )}
          
          {error && (
            <p className="text-lg text-red-600 dark:text-red-400">
              Virhe: {error}
            </p>
          )}
          
          {trafficData && detectorId && (
            <div className="max-w-md space-y-4">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-2 text-black dark:text-zinc-50">
                  {trafficData.devName}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {new Date(trafficData.measuredTime).toLocaleString('fi-FI')}
                </p>
              </div>
              
              {trafficData.values.map((value, index) => (
                <div key={index} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-medium mb-2 text-black dark:text-zinc-50">
                    {value.detName} ({value.sgName})
                  </h3>
                  <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
                    <p><span className="font-medium">Liikennemäärä:</span> {value.value} ajoneuvoa</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!detectorId && Object.keys(allDetectorsData).length > 0 && (
            <div className="w-full max-w-4xl space-y-4">
              {/* Show location/coords for the selected CSV row (supports duplicates) */}
              <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-2 text-black dark:text-zinc-50">
                  {(() => {
                    const selected = devUid ? intersections.find(i => i.uid === devUid) : intersections.find(i => i.id === deviceId);
                    return selected?.location || deviceId;
                  })()}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {(() => {
                    const selected = devUid ? intersections.find(i => i.uid === devUid) : intersections.find(i => i.id === deviceId);
                    return `ID: ${deviceId} | Sijainti: N: ${selected?.north || '-'}, E: ${selected?.east || '-'}`;
                  })()}
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Tunnistin
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Liikennemäärä
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Luotettavuus
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Toiminnot
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {Object.entries(allDetectorsData).map(([detector, data]) => (
                        <tr key={detector} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {detector}
                          </td>
                          {data ? (
                            <>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {data.values[0]?.value || 0} ajoneuvoa
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {data.values[0]?.reliabValue || 0} / 5
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                <Link
                                  href={`/?device=${deviceId}${devUid ? `&devUid=${devUid}` : ''}&detector=${detector}`}
                                   className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
                                 >
                                   Näytä yksityiskohdat
                                 </Link>
                               </td>
                             </>
                           ) : (
                            <>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">-</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  Ei dataa
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">-</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">-</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">-</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {Object.values(allDetectorsData).filter(Boolean).length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-medium mb-2 text-black dark:text-zinc-50">
                    Yhteenveto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Kokonaisliikennemäärä:</span>{' '}
                      <span className="text-green-600 dark:text-green-400">
                        {Object.values(allDetectorsData)
                          .filter(Boolean)
                          .reduce((sum, data) => sum + (data?.values[0]?.value || 0), 0)} ajoneuvoa
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Viimeisin päivitys:</span>{' '}
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
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row mt-10">
          <button
            onClick={() => window.location.reload()}
            className="flex h-12 w-auto items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-white transition-colors hover:bg-blue-700 "
          >
            Päivitä tiedot
          </button>
          <Link
            href="/map"
            className="flex h-12 w-auto items-center justify-center rounded-full bg-green-600 px-5 text-white transition-colors hover:bg-green-700"
          >
            Kartta
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
