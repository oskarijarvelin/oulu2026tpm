"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import proj4 from "proj4";

interface IntersectionData {
  id: string;
  location: string;
  north: string;
  east: string;
  uid: string; // unique per CSV row to support duplicate ids
}

// Convert TM35FIN coordinates to WGS84 using proper projection
function tm35finToWgs84(north: number, east: number) {
  try {
    // Define TM35FIN (EPSG:3067) projection
    const tm35fin = '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';
    // Define WGS84 (EPSG:4326) projection  
    const wgs84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs';
    
    // Transform coordinates
    const [lon, lat] = proj4(tm35fin, wgs84, [east, north]);
    
    // Validate coordinates are in reasonable range for Finland
    if (lat < 59 || lat > 71 || lon < 19 || lon > 32) {
      console.warn(`Coordinates out of range for Finland: lat=${lat}, lon=${lon} from TM35FIN(${north}, ${east})`);
    }
    
    return { lat, lon };
  } catch (error) {
    console.error('Coordinate transformation error:', error);
    // Fallback to approximate conversion
    const lat = 60 + (north - 7200000) / 111000;
    const lon = 25 + (east - 400000) / 55800;
    return { lat, lon };
  }
}

export default function MapPage() {
  const [intersections, setIntersections] = useState<IntersectionData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<IntersectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const handleDeviceSelect = (device: IntersectionData) => {
    setSelectedDevice(device);
  };

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
          .filter(item => item.id && item.north && item.east); // Filter out invalid entries
        
        setIntersections(intersectionsData);
      } catch (err) {
        console.error('Error loading intersections:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadIntersections();
  }, []);

  // Initialize map with Leaflet (only when intersections change)
  const iconsRef = useRef<any>(null);
  useEffect(() => {
    if (!intersections.length || !mapRef.current) return;

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

        // Create custom marker icon
        const customIcon = L.default.divIcon({
          html: `
            <div style="
              background-color: #3B82F6;
              border: 2px solid #1E40AF;
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
          className: 'custom-marker',
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
          className: 'custom-marker-selected',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        // Save icons to ref so they can be used when selectedDevice changes
        iconsRef.current = { customIcon, selectedIcon };

        // Clear existing markers
        markersRef.current.forEach(marker => map.removeLayer(marker));
        markersRef.current = [];

        // Add markers
        const bounds = L.default.latLngBounds([]);
        
        intersections.forEach((intersection) => {
          const coords = tm35finToWgs84(
            parseFloat(intersection.north),
            parseFloat(intersection.east)
          );

          const marker = L.default.marker([coords.lat, coords.lon], {
            icon: iconsRef.current.customIcon,
          });

          // Attach CSV-uid to the marker for later reference (supports duplicates)
          (marker as any)._tpmUid = intersection.uid;

          const popupContent = `
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937; font-size: 14px;">
                ${intersection.id}
              </h3>
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #4b5563; line-height: 1.3;">
                ${intersection.location}
              </p>
              <p style="margin: 0 0 8px 0; font-size: 10px; color: #6b7280;">
                TM35FIN: N: ${intersection.north}, E: ${intersection.east}
              </p>
              <a href="/?device=${intersection.id}&devUid=${intersection.uid}" 
                 style="display: inline-block; background: #3b82f6; color: white; padding: 4px 8px; 
                        text-decoration: none; border-radius: 4px; font-size: 11px; margin-top: 4px;">
                 Avaa liikennetiedot →
               </a>
            </div>
          `;

          marker.bindPopup(popupContent);
          marker.on('click', () => handleDeviceSelect(intersection));
          
          marker.addTo(map);
          markersRef.current.push(marker);
          bounds.extend([coords.lat, coords.lon]);
        });

        // Fit bounds
        if (intersections.length > 0) {
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
  }, [intersections]);

  // Update marker icons and open popup when a device is selected without re-initializing the map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current.length) return;
    const map = mapInstanceRef.current;
    const icons = iconsRef.current;
    markersRef.current.forEach((marker: any) => {
      const isSelected = selectedDevice?.uid === (marker as any)._tpmUid;
      if (icons) marker.setIcon(isSelected ? icons.selectedIcon : icons.customIcon);
      if (isSelected) {
        marker.openPopup();
        // center on selected marker smoothly
        map.setView(marker.getLatLng(), 15, { animate: true, duration: 0.5 });
      }
    });
  }, [selectedDevice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-white mb-4">
            Ladataan karttaa...
          </h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                TPM Laitteiden Kartta
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {intersections.length} laitetta löydetty
              </p>
            </div>
            <Link 
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Takaisin etusivulle
            </Link>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar with device list */}
        <div className="w-1/3 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Laitteet ({intersections.length})
            </h2>
            <div className="space-y-2">
              {intersections.map((intersection) => (
                <div
                  key={intersection.uid}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDevice?.uid === intersection.uid
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedDevice(intersection)}
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {intersection.id}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {intersection.location}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    N: {intersection.north}, E: {intersection.east}
                  </div>
                  <Link
                    href={`/?device=${intersection.id}&devUid=${intersection.uid}`}
                    className="inline-block mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Näytä tiedot
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          {intersections.length > 0 ? (
            <div
              ref={mapRef}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {mapLoading ? 'Ladataan karttaa...' : 'Ladataan laitteita...'}
                </p>
              </div>
            </div>
          )}

          {/* Selected device info overlay */}
          {selectedDevice && (
            <div className="absolute top-4 right-4 bg-white dark:bg-gray-900 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm z-10">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {selectedDevice.id}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {selectedDevice.location}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                Koordinaatit: N: {selectedDevice.north}, E: {selectedDevice.east}
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                {(() => {
                  const coords = tm35finToWgs84(
                    parseFloat(selectedDevice.north),
                    parseFloat(selectedDevice.east)
                  );
                  return `WGS84: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`;
                })()}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/?device=${selectedDevice.id}&devUid=${selectedDevice.uid}`}
                  className="flex-1 text-center bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Avaa tiedot
                </Link>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
