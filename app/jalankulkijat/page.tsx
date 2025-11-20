/**
 * Jalankulkija- ja pyöräilijälaskenta-asemien karttanäkymä
 * 
 * Tämä sivu näyttää interaktiivisen kartan Eco Counter -laskenta-asemista,
 * joilla mitataan jalankulkijoiden ja pyöräilijöiden määriä Oulussa.
 * Käyttäjä voi valita aseman kartalta ja siirtyä tarkastelemaan yksityiskohtaista dataa.
 * 
 * Käyttää:
 * - GraphQL API:a laskenta-asemien tietojen hakemiseen
 * - Leaflet-kirjastoa karttojen näyttämiseen
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Yksittäisen kanavan tiedot (esim. jalankulkijat sisään/ulos)
 */
interface EcoCounterChannel {
  id: string;
  siteId: string;
  name: string;
  domain: string;
  userType: number;
  timezone: string;
  interval: number;
  sens: number;
  lat: number;
  lon: number;
}

/**
 * Laskenta-aseman tiedot
 */
interface EcoCounterSite {
  id: string;
  siteId: string;
  name: string;        // Aseman nimi
  domain: string;      // Toimialue (esim. "Oulu_kaupunki")
  userType: number;
  timezone: string;
  interval: number;
  sens: number;
  channels: EcoCounterChannel[];  // Aseman kanavat (JK_IN, JK_OUT, PP_IN, PP_OUT)
}

/**
 * JalankulkijatPage - Pääkomponentti laskenta-asemien kartalle
 */
export default function JalankulkijatPage() {
  // Tilanhallinta
  const [sites, setSites] = useState<EcoCounterSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<EcoCounterSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  
  // Refenssit kartan hallintaan
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const iconsRef = useRef<any>(null);

  /**
   * Hakee laskenta-asemat GraphQL API:sta
   */
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const response = await fetch('https://api.oulunliikenne.fi/proxy/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query GetAllEcoCounterSites {
                ecoCounterSites {
                  id
                  siteId
                  name
                  domain
                  userType
                  timezone
                  interval
                  sens
                  channels {
                    id
                    siteId
                    name
                    domain
                    userType
                    timezone
                    interval
                    sens
                    lat
                    lon
                  }
                }
              }
            `
          })
        });

        const result = await response.json();
        if (result.data && result.data.ecoCounterSites) {
          // Suodata pois virheelliset asemat
          const validSites = result.data.ecoCounterSites.filter(
            (site: EcoCounterSite | null) => site && site.id && site.name
          );
          setSites(validSites);
        }
      } catch (error) {
        console.error('Error fetching eco counter sites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, []);

  /**
   * Alustaa Leaflet-kartan ja lisää markerit laskenta-asemille
   */
  useEffect(() => {
    if (!sites.length || !mapRef.current) return;

    const initMap = async () => {
      try {
        // Import Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Import Leaflet
        const L = await import('leaflet');

        // Clear existing map
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        // Initialize map
        const map = L.default.map(mapRef.current!, {
          center: [65.0121, 25.4651], // Oulu center
          zoom: 11,
        });

        // Add OpenStreetMap tiles
        L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Create custom marker icon for pedestrian/cyclist counters
        const customIcon = L.default.divIcon({
          html: `
            <div style="
              background-color: #10B981;
              border: 2px solid #059669;
              border-radius: 50%;
              width: 16px;
              height: 16px;
              position: relative;
            ">
              <div style="
                background-color: white;
                border-radius: 50%;
                width: 6px;
                height: 6px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
              "></div>
            </div>
          `,
          className: 'custom-marker-eco',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const selectedIcon = L.default.divIcon({
          html: `
            <div style="
              background-color: #EF4444;
              border: 2px solid #DC2626;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              position: relative;
              box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
            ">
              <div style="
                background-color: white;
                border-radius: 50%;
                width: 8px;
                height: 8px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
              "></div>
            </div>
          `,
          className: 'custom-marker-eco-selected',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        iconsRef.current = { customIcon, selectedIcon };

        // Clear existing markers
        markersRef.current.forEach(marker => map.removeLayer(marker));
        markersRef.current = [];

        // Add markers for each site's channels (which have lat/lon)
        const bounds = L.default.latLngBounds([]);
        
        sites.forEach((site) => {
          if (!site || !site.channels) return;
          
          site.channels.forEach((channel) => {
            if (channel && channel.lat && channel.lon) {
              const marker = L.default.marker([channel.lat, channel.lon], {
                icon: customIcon,
              });

              (marker as any)._siteId = site.id;

              const channelsJson = encodeURIComponent(JSON.stringify(site.channels.map(ch => ({ siteId: ch.siteId, name: ch.name }))));
              const popupContent = `
                <div style="min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937; font-size: 14px;">
                    ${site.name}
                  </h3>
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #4b5563; line-height: 1.3;">
                    ${channel.name}
                  </p>
                  <p style="margin: 0 0 8px 0; font-size: 10px; color: #6b7280;">
                    Lat: ${channel.lat.toFixed(4)}, Lon: ${channel.lon.toFixed(4)}
                  </p>
                  <a href="/jalankulkijat/${site.siteId}?domain=${site.domain}&name=${encodeURIComponent(site.name)}&channels=${channelsJson}" 
                     style="display: inline-block; background: #10B981; color: white; padding: 4px 8px; 
                            text-decoration: none; border-radius: 4px; font-size: 11px; margin-top: 4px;">
                    Näytä tiedot →
                  </a>
                </div>
              `;
              
              marker.bindPopup(popupContent);
              marker.on('click', () => setSelectedSite(site));
              
              marker.addTo(map);
              markersRef.current.push(marker);
              bounds.extend([channel.lat, channel.lon]);
            }
          });
        });

        // Fit bounds
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
          if (map.getZoom() > 13) {
            map.setZoom(13);
          }
        }

        setMapLoading(false);
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapLoading(false);
      }
    };

    initMap();
  }, [sites]);

  // Update marker icons when a site is selected
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current.length || !iconsRef.current) return;
    
    const map = mapInstanceRef.current;
    const icons = iconsRef.current;
    
    markersRef.current.forEach((marker: any) => {
      const isSelected = selectedSite?.id === marker._siteId;
      marker.setIcon(isSelected ? icons.selectedIcon : icons.customIcon);
      
      if (isSelected) {
        marker.openPopup();
        map.setView(marker.getLatLng(), 15, { animate: true, duration: 0.5 });
      }
    });
  }, [selectedSite]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-white mb-4">
            Ladataan laskenta-asemia...
          </h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-blue-50">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Jalankulkijat ja Pyöräilijät
              </h1>
            </div>
            <Link 
              href="/"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              <span className="text-lg">←</span>
              <span className="text-sm md:text-base font-medium">TPM-data</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row h-[calc(100vh-80px)]">
        {/* Sidebar with sites list */}
        <div className="w-full md:w-1/3 bg-white dark:bg-gray-900 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[40vh] md:max-h-full">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Laskenta-asemat ({sites.length})
            </h2>
            <div className="space-y-2">
              {sites.filter(site => site && site.id).map((site) => (
                <div
                  key={site.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSite?.id === site.id
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedSite(site)}
                >
                  <div className="font-medium text-gray-900 dark:text-white text-sm md:text-base">
                    {site.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {site.channels?.length || 0} kanava{site.channels?.length !== 1 ? 'a' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          {sites.length > 0 ? (
            <div ref={mapRef} className="w-full h-full" />
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {mapLoading ? 'Ladataan karttaa...' : 'Ladataan laskenta-asemia...'}
                </p>
              </div>
            </div>
          )}

          {/* Selected site info overlay */}
          {selectedSite && (
            <div className="absolute top-4 left-4 right-4 md:top-4 md:right-4 md:left-auto bg-white dark:bg-gray-900 p-3 md:p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 md:max-w-sm z-10">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  {selectedSite.name}
                </h4>
                <button
                  onClick={() => setSelectedSite(null)}
                  className="px-2 py-1 text-xs md:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Site ID: {selectedSite.siteId}
              </p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Kanavat ({selectedSite.channels?.length || 0}):
                </h5>
                {selectedSite.channels?.filter(channel => channel && channel.id).map((channel) => (
                  <div key={channel.id} className="text-xs text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-green-500">
                    <div className="font-medium">{channel.name}</div>
                    {channel.lat && channel.lon && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {channel.lat.toFixed(4)}, {channel.lon.toFixed(4)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-4">
                <Link
                  href={`/jalankulkijat/${selectedSite.siteId}?domain=${selectedSite.domain}&name=${encodeURIComponent(selectedSite.name)}&channels=${encodeURIComponent(JSON.stringify(selectedSite.channels.map(ch => ({ siteId: ch.siteId, name: ch.name }))))}`}
                  className="block w-full text-center bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
                >
                  Näytä tiedot →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Oskari Järvelin | <a href="https://wp.oulunliikenne.fi/avoin-data/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Avoin data</a> | <a href="https://github.com/oskarijarvelin/oulu2026tpm" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
