import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '@/context/DataContext';

// Fix Leaflet default marker icons issue with Vite/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons - created as functions to avoid issues with Leaflet not being fully initialized
function getSmartBinIcon() {
  return L.divIcon({
    html: `<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #22c55e20; border: 2px solid #22c55e; border-radius: 12px; box-shadow: 0 4px 12px #22c55e40;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#22c55e" width="24" height="24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>`,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
}

function getCompactStationIcon() {
  return L.divIcon({
    html: `<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #f59e0b20; border: 2px solid #f59e0b; border-radius: 12px; box-shadow: 0 4px 12px #f59e0b40;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" width="24" height="24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg></div>`,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
}

function getDumpyardIcon() {
  return L.divIcon({
    html: `<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #ef444420; border: 2px solid #ef4444; border-radius: 12px; box-shadow: 0 4px 12px #ef444440;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" width="24" height="24"><path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg></div>`,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
}

function MapController() {
  const map = useMap();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

interface MapProps {
  showSmartBins: boolean;
  showCompactStations: boolean;
  showDumpyards: boolean;
}

function HyderabadMap({ showSmartBins, showCompactStations, showDumpyards }: MapProps) {
  const { data, routes } = useData();
  const hyderabadCenter: [number, number] = [17.385, 78.4867];

  const routeColors = [
    '#22d3ee', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', 
    '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'
  ];

  // Create icons inside the component to ensure Leaflet is initialized
  const smartBinIcon = getSmartBinIcon();
  const compactStationIcon = getCompactStationIcon();
  const dumpyardIcon = getDumpyardIcon();

  return (
    <MapContainer
      center={hyderabadCenter}
      zoom={12}
      className="w-full h-full rounded-xl"
      scrollWheelZoom={true}
      zoomControl={true}
      style={{ height: '100%', width: '100%' }}
    >
      <MapController />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Smart Bins */}
      {showSmartBins && data.smartBins.map((bin) => (
        <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={smartBinIcon}>
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-sm">{bin.id}</h3>
              <p className="text-xs text-gray-600">{bin.area}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>Fill Level:</span>
                  <span className={bin.currentLevel > 80 ? 'text-red-500' : 'text-green-500'}>
                    {bin.currentLevel}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full ${bin.currentLevel > 80 ? 'bg-red-500' : bin.currentLevel > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${bin.currentLevel}%` }}
                  />
                </div>
              </div>
              <p className="text-xs mt-1">Capacity: {bin.capacity}L</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Compact Stations */}
      {showCompactStations && data.compactStations.map((station) => (
        <Marker key={station.id} position={[station.lat, station.lng]} icon={compactStationIcon}>
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-sm">{station.id}</h3>
              <p className="text-xs text-gray-600">{station.area}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>Current Load:</span>
                  <span>{station.currentLevel}kg / {station.capacity}kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${(station.currentLevel / station.capacity) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Dumpyards */}
      {showDumpyards && data.dumpyards.map((dumpyard) => (
        <Marker key={dumpyard.id} position={[dumpyard.lat, dumpyard.lng]} icon={dumpyardIcon}>
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-sm">{dumpyard.name}</h3>
              <p className="text-xs text-gray-600">{dumpyard.id}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>Capacity:</span>
                  <span>{dumpyard.currentLevel.toLocaleString()} / {dumpyard.capacity.toLocaleString()} tons</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="h-2 rounded-full bg-red-500"
                    style={{ width: `${(dumpyard.currentLevel / dumpyard.capacity) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Routes */}
      {routes.map((route, index) => (
        <Polyline
          key={`${route.vehicleId}-${index}`}
          positions={route.coordinates}
          color={routeColors[index % routeColors.length]}
          weight={4}
          opacity={0.8}
          dashArray={route.vehicleType === 'sat' ? '10, 10' : undefined}
        />
      ))}
    </MapContainer>
  );
}

export default HyderabadMap;
