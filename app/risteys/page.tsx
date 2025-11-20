/**
 * Risteyksen yksityiskohtainen näkymä
 * 
 * Tämä sivu näyttää TPM-risteyksen liikennetiedot:
 * - Reaaliaikaista dataa valitulta ilmaisimelta tai kaikista ilmaisimista
 * - Liikennemääriä eri suunnilta
 * - Mahdollisuuden vaihtaa risteystä ja ilmaisinta
 * - Risteyksen karttakuvan (jos saatavilla)
 * 
 * Käyttää:
 * - TPM API:a liikennetietojen hakemiseen
 * - CSV-tiedostoa risteysten sijaintitietoihin
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Liikennedata yhdeltä ilmaisimelta
 */
interface TrafficData {
  devName: string;          // Laitteen nimi
  measuredTime: string;     // Mittausaika
  values: Array<{
    sgName: string;         // Signal group nimi
    detName: string;        // Ilmaisimen nimi
    name: string;           // Mittauksen nimi
    value: number;          // Mitattu arvo
    unit: string;           // Yksikkö
    interval: number;       // Mittausväli
    reliabValue: number;    // Luotettavuusarvo
  }>;
}

/**
 * Kaikkien ilmaisimien data
 */
interface AllDetectorsData {
  [detectorId: string]: TrafficData | null;
}

/**
 * Risteyksen perustiedot
 */
interface IntersectionData {
  id: string;        // Risteyksen tunniste
  location: string;  // Sijainti/nimi
  north: string;     // Pohjoiskoordinaatti
  east: string;      // Itäkoordinaatti
  uid: string;       // Uniikki tunniste
}

/**
 * HomeContent - Pääkomponentti risteyksen tietojen näyttämiseen
 */
function HomeContent() {
  const searchParams = useSearchParams();
  
  // Tilanhallinta
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [allDetectorsData, setAllDetectorsData] = useState<AllDetectorsData>({});
  const [intersections, setIntersections] = useState<IntersectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  
  // URL-parametrit (oletusarvot jos ei määritelty)
  const deviceId = searchParams.get('device') || 'OULU002';
  const detectorId = searchParams.get('detector') || ''; // Tyhjä = kaikki ilmaisimet
  const devUid = searchParams.get('devUid') || ''; // Uniikki ID duplikaatti-ID:iden varalta

  /**
   * Lataa risteysdatan CSV-tiedostosta
   */
  useEffect(() => {
    const loadIntersections = async () => {
      try {
        const response = await fetch('/intersections.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n').slice(1); // Ohita otsikkorivi
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
          .filter(item => item.id); // Suodata virheelliset rivit
        
        setIntersections(intersectionsData);
      } catch (err) {
        console.error('Error loading intersections:', err);
      }
    };
    
    loadIntersections();
  }, []);

  /**
   * Hakee liikennetiedot TPM API:sta
   * Jos detectorId on määritelty, hakee vain sen ilmaisimen tiedot.
   * Muuten hakee kaikkien ilmaisimien tiedot.
   */
  useEffect(() => {
    const fetchTrafficData = async () => {
      setLoading(true);
      setError(null);
      setTrafficData(null);
      setAllDetectorsData({});

      try {
        if (detectorId) {
          // Hae tietyn ilmaisimen data
          const apiUrl = `https://api.oulunliikenne.fi/tpm/kpi/traffic-volume/${deviceId}/${detectorId}`;
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setTrafficData(data);
        } else {
          // Hae kaikkien ilmaisimien data
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Oulu2026 TPM
              </h1>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex h-8 sm:h-9 md:h-10 items-center justify-center gap-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 sm:px-4 text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-300 transition-colors font-medium backdrop-blur-sm shadow-sm"
              >
                <span className="hidden sm:inline">Päivitä tiedot</span>
                <span className="sm:hidden">🔄</span>
              </button>
              <Link
                href="/"
                className="flex h-8 sm:h-9 md:h-10 items-center justify-center gap-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 sm:px-4 text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-300 transition-colors font-medium backdrop-blur-sm shadow-sm"
              >
                <span className="text-lg">←</span>
                <span className="hidden sm:inline">Takaisin</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col gap-4 sm:gap-6 w-full">
          
          <div className="w-full space-y-3 sm:space-y-4">
            <div className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Valitse risteys:
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm sm:text-base bg-white dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  {intersections.map((intersection) => (
                    <option key={intersection.uid} value={intersection.uid}>
                      {intersection.id} - {intersection.location}
                    </option>
                  ))}
                </select>
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
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {trafficData.devName}
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  {new Date(trafficData.measuredTime).toLocaleString('fi-FI')}
                </p>
              </div>
              
              {trafficData.values.map((value, index) => (
                <div key={index} className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg">
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
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
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

              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <span className={(() => {
                                  const reliability = data.values[0]?.reliabValue || 0;
                                  return reliability >= 4 ? "text-green-600 dark:text-green-400 font-semibold" : 
                                         reliability >= 3 ? "text-yellow-600 dark:text-yellow-400 font-semibold" : 
                                         "text-red-600 dark:text-red-400 font-semibold";
                                })()}>
                                  {data.values[0]?.reliabValue || 0} / 5
                                </span>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
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
                      <span className={(() => {
                        const latestTime = Object.values(allDetectorsData)
                          .filter(Boolean)
                          .map(data => new Date(data!.measuredTime))
                          .sort((a, b) => b.getTime() - a.getTime())[0];
                        if (!latestTime) return "text-gray-600 dark:text-gray-400";
                        const now = new Date();
                        const diffMinutes = (now.getTime() - latestTime.getTime()) / (1000 * 60);
                        if (diffMinutes < 6) return "text-green-600 dark:text-green-400 font-semibold";
                        if (diffMinutes > 15) return "text-red-600 dark:text-red-400 font-semibold";
                        return "text-gray-600 dark:text-gray-400";
                      })()}>
                        {(() => {
                          const latestTime = Object.values(allDetectorsData)
                            .filter(Boolean)
                            .map(data => new Date(data!.measuredTime))
                            .sort((a, b) => b.getTime() - a.getTime())[0];
                          if (!latestTime) return '-';
                          const now = new Date();
                          const isSameDay = latestTime.toDateString() === now.toDateString();
                          return isSameDay 
                            ? latestTime.toLocaleTimeString('fi-FI')
                            : latestTime.toLocaleString('fi-FI');
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">Kokonaisluotettavuus:</span>{' '}
                      <span className={(() => {
                        const minReliability = Math.min(
                          ...Object.values(allDetectorsData)
                            .filter(Boolean)
                            .map(data => data?.values[0]?.reliabValue || 5)
                        );
                        return minReliability >= 4 ? "text-green-600 dark:text-green-400" : 
                               minReliability >= 3 ? "text-yellow-600 dark:text-yellow-400" : 
                               "text-red-600 dark:text-red-400";
                      })()}>
                        {(() => {
                          const minReliability = Math.min(
                            ...Object.values(allDetectorsData)
                              .filter(Boolean)
                              .map(data => data?.values[0]?.reliabValue || 5)
                          );
                          return `${minReliability} / 5`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Risteyksen kuva */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
      </main>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Oskari Järvelin | <a href="https://wp.oulunliikenne.fi/avoin-data/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">Avoin data</a> | <a href="https://github.com/oskarijarvelin/oulu2026tpm" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black font-sans">
        <div className="text-center">
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
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
