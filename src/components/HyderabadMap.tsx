import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '@/context/DataContext';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapProps {
  showSmartBins: boolean;
  showCompactStations: boolean;
  showDumpyards: boolean;
}

// Custom icon creators
function createIcon(color: string, svgPath: string) {
  return L.divIcon({
    html: `<div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${color}20; border: 2px solid ${color}; border-radius: 10px; box-shadow: 0 4px 12px ${color}40, 0 0 0 2px rgba(0,0,0,0.3);">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="#000" stroke-width="0.5" width="20" height="20">${svgPath}</svg>
    </div>`,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
}

const binIcon = createIcon('#22c55e', '<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>');
const stationIcon = createIcon('#f59e0b', '<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>');
const dumpyardIcon = createIcon('#ef4444', '<path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>');

export default function HyderabadMap({ showSmartBins, showCompactStations, showDumpyards }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routesRef = useRef<L.LayerGroup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const { data, routes } = useData();

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // India bounds (approximate)
    const indiaBounds: L.LatLngBoundsExpression = [
      [6.5, 68.0],   // Southwest corner (southern tip, west border)
      [35.5, 97.5]   // Northeast corner (northern tip, east border)
    ];

    const map = L.map(mapContainerRef.current, {
      center: [17.385, 78.4867], // Hyderabad center
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
      maxBounds: indiaBounds,
      maxBoundsViscosity: 1.0, // Strict bounds - can't pan outside
      minZoom: 5, // Minimum zoom to see most of India
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    routesRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setIsMapReady(true);

    // Resize handling
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      routesRef.current = null;
    };
  }, []);

  // Update markers when data or visibility changes
  useEffect(() => {
    if (!isMapReady || !markersRef.current) return;

    markersRef.current.clearLayers();

    // Add smart bins
    if (showSmartBins) {
      data.smartBins.forEach(bin => {
        const marker = L.marker([bin.lat, bin.lng], { icon: binIcon });
        marker.bindPopup(`
          <div style="min-width: 150px;">
            <strong>${bin.id}</strong>
            <div style="color: #666; font-size: 12px;">${bin.area}</div>
            <div style="margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span>Fill Level:</span>
                <span style="color: ${bin.currentLevel > 80 ? '#ef4444' : '#22c55e'}">${bin.currentLevel}%</span>
              </div>
              <div style="background: #e5e7eb; border-radius: 4px; height: 6px; margin-top: 4px;">
                <div style="background: ${bin.currentLevel > 80 ? '#ef4444' : bin.currentLevel > 50 ? '#f59e0b' : '#22c55e'}; height: 100%; border-radius: 4px; width: ${bin.currentLevel}%;"></div>
              </div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">Capacity: ${bin.capacity}L</div>
            </div>
          </div>
        `);
        markersRef.current?.addLayer(marker);
      });
    }

    // Add compact stations
    if (showCompactStations) {
      data.compactStations.forEach(station => {
        const fillPercent = (station.currentLevel / station.capacity) * 100;
        const marker = L.marker([station.lat, station.lng], { icon: stationIcon });
        marker.bindPopup(`
          <div style="min-width: 150px;">
            <strong>${station.id}</strong>
            <div style="color: #666; font-size: 12px;">${station.area}</div>
            <div style="margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span>Load:</span>
                <span>${station.currentLevel}kg / ${station.capacity}kg</span>
              </div>
              <div style="background: #e5e7eb; border-radius: 4px; height: 6px; margin-top: 4px;">
                <div style="background: #f59e0b; height: 100%; border-radius: 4px; width: ${fillPercent}%;"></div>
              </div>
            </div>
          </div>
        `);
        markersRef.current?.addLayer(marker);
      });
    }

    // Add dumpyards
    if (showDumpyards) {
      data.dumpyards.forEach(dumpyard => {
        const fillPercent = (dumpyard.currentLevel / dumpyard.capacity) * 100;
        const marker = L.marker([dumpyard.lat, dumpyard.lng], { icon: dumpyardIcon });
        marker.bindPopup(`
          <div style="min-width: 150px;">
            <strong>${dumpyard.name}</strong>
            <div style="color: #666; font-size: 12px;">${dumpyard.id}</div>
            <div style="margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span>Capacity:</span>
                <span>${dumpyard.currentLevel.toLocaleString()} / ${dumpyard.capacity.toLocaleString()} tons</span>
              </div>
              <div style="background: #e5e7eb; border-radius: 4px; height: 6px; margin-top: 4px;">
                <div style="background: #ef4444; height: 100%; border-radius: 4px; width: ${fillPercent}%;"></div>
              </div>
            </div>
          </div>
        `);
        markersRef.current?.addLayer(marker);
      });
    }
  }, [isMapReady, showSmartBins, showCompactStations, showDumpyards, data]);

  // Update routes
  useEffect(() => {
    if (!isMapReady || !routesRef.current) return;

    routesRef.current.clearLayers();

    const routeColors = [
      '#22d3ee', '#f59e0b', '#a855f7', '#22c55e', '#ef4444',
      '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'
    ];

    routes.forEach((route, index) => {
      if (route.coordinates && route.coordinates.length > 1) {
        const polyline = L.polyline(route.coordinates, {
          color: routeColors[index % routeColors.length],
          weight: 6,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routesRef.current?.addLayer(polyline);
      }
    });
  }, [isMapReady, routes]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full rounded-xl"
      style={{ minHeight: '400px' }}
    />
  );
}
