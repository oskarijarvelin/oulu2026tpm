"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import proj4 from "proj4";

interface IntersectionData {
  id: string;
  location: string;
  north: string;
  east: string;
}

interface MapComponentProps {
  intersections: IntersectionData[];
  selectedDevice: IntersectionData | null;
  onDeviceSelect: (device: IntersectionData) => void;
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

export default function MapComponent({ intersections, selectedDevice, onDeviceSelect }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Import Leaflet CSS
    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || intersections.length === 0) return;

    // Initialize map
    if (!mapInstanceRef.current) {
      // Calculate center from first few intersections for better positioning
      let centerLat = 65.0121, centerLon = 25.4651; // Default Oulu center
      
      if (intersections.length > 0) {
        const sampleCoords = intersections.slice(0, 5).map(intersection => {
          return tm35finToWgs84(
            parseFloat(intersection.north),
            parseFloat(intersection.east)
          );
        });
        
        centerLat = sampleCoords.reduce((sum, coord) => sum + coord.lat, 0) / sampleCoords.length;
        centerLon = sampleCoords.reduce((sum, coord) => sum + coord.lon, 0) / sampleCoords.length;
        
        console.log('Map center calculated from data:', centerLat, centerLon);
      }

      const map = L.map(mapRef.current, {
        center: [centerLat, centerLon],
        zoom: 11,
        zoomControl: true,
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Create custom icon
    const customIcon = L.divIcon({
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

    const selectedIcon = L.divIcon({
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

    // Add markers for all intersections
    const group = L.featureGroup();
    
    intersections.forEach((intersection) => {
      const coords = tm35finToWgs84(
        parseFloat(intersection.north),
        parseFloat(intersection.east)
      );

      // Debug: Log a few coordinate conversions
      if (intersections.indexOf(intersection) < 3) {
        console.log(`${intersection.id}: TM35FIN(${intersection.north}, ${intersection.east}) -> WGS84(${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)})`);
      }

      const isSelected = selectedDevice?.id === intersection.id;
      const marker = L.marker([coords.lat, coords.lon], {
        icon: isSelected ? selectedIcon : customIcon,
      });

      // Create popup content
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
          <a href="/?device=${intersection.id}&detector=D1_50" 
             style="display: inline-block; background: #3b82f6; color: white; padding: 4px 8px; 
                    text-decoration: none; border-radius: 4px; font-size: 11px; margin-top: 4px;">
            Avaa liikennetiedot →
          </a>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click handler
      marker.on('click', () => {
        onDeviceSelect(intersection);
      });

      marker.addTo(map);
      group.addLayer(marker);
      markersRef.current.push(marker);
    });

    // Fit map to show all markers
    if (intersections.length > 0) {
      map.fitBounds(group.getBounds(), { padding: [20, 20] });
      
      // Ensure reasonable zoom level
      if (map.getZoom() > 13) {
        map.setZoom(13);
      }
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [intersections, selectedDevice, onDeviceSelect]);

  // Center on selected device
  useEffect(() => {
    if (selectedDevice && mapInstanceRef.current) {
      const coords = tm35finToWgs84(
        parseFloat(selectedDevice.north),
        parseFloat(selectedDevice.east)
      );
      
      mapInstanceRef.current.setView([coords.lat, coords.lon], 15, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedDevice]);

  return <div ref={mapRef} className="w-full h-full" />;
}
