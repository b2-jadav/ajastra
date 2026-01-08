import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
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
  driverVehicleId?: string;
}

// Simpler, lighter circle markers instead of complex SVG icons
function createCircleIcon(color: string, size: number = 12) {
  return L.divIcon({
    html: `<div style="width: ${size}px; height: ${size}px; background: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'simple-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

const binIcon = createCircleIcon('#22c55e', 14);
const stationIcon = createCircleIcon('#f59e0b', 16);
const dumpyardIcon = createCircleIcon('#ef4444', 18);

export default function HyderabadMap({ showSmartBins, showCompactStations, showDumpyards, driverVehicleId }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const binClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const stationClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const dumpyardClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const routesRef = useRef<L.LayerGroup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const { data, routes } = useData();

  // Get driver's specific route
  const driverRoute = driverVehicleId 
    ? routes.find(r => r.vehicleId.toLowerCase() === driverVehicleId.toLowerCase())
    : null;

  // Get bin/station/dumpyard IDs that are in the driver's route - memoized
  const { driverBinIds, driverStationIds, driverDumpyardIds } = useMemo(() => ({
    driverBinIds: new Set(
      driverRoute?.route.filter(p => p.type === 'smartbin').map(p => p.id) || []
    ),
    driverStationIds: new Set(
      driverRoute?.route.filter(p => p.type === 'compact-station').map(p => p.id) || []
    ),
    driverDumpyardIds: new Set(
      driverRoute?.route.filter(p => p.type === 'dumpyard').map(p => p.id) || []
    )
  }), [driverRoute]);

  // Memoize filtered data to prevent recalculation
  const filteredData = useMemo(() => ({
    binsToShow: driverVehicleId
      ? data.smartBins.filter(bin => driverBinIds.has(bin.id))
      : data.smartBins,
    stationsToShow: driverVehicleId
      ? data.compactStations.filter(s => driverStationIds.has(s.id))
      : data.compactStations,
    dumpyardsToShow: driverVehicleId
      ? data.dumpyards.filter(d => driverDumpyardIds.has(d.id))
      : data.dumpyards
  }), [data, driverVehicleId, driverBinIds, driverStationIds, driverDumpyardIds]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // India bounds (approximate)
    const indiaBounds: L.LatLngBoundsExpression = [
      [6.5, 68.0],
      [35.5, 97.5]
    ];

    const map = L.map(mapContainerRef.current, {
      center: [17.385, 78.4867],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
      maxBounds: indiaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 5,
      preferCanvas: true, // Use canvas for better performance
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Create cluster groups with performance optimizations
    const clusterOptions: L.MarkerClusterGroupOptions = {
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      animate: false, // Disable animations for better performance
    };

    binClusterRef.current = L.markerClusterGroup({
      ...clusterOptions,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background: #22c55e; color: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${count}</div>`,
          className: 'marker-cluster-bins',
          iconSize: L.point(36, 36),
        });
      }
    }).addTo(map);

    stationClusterRef.current = L.markerClusterGroup({
      ...clusterOptions,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background: #f59e0b; color: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${count}</div>`,
          className: 'marker-cluster-stations',
          iconSize: L.point(36, 36),
        });
      }
    }).addTo(map);

    dumpyardClusterRef.current = L.markerClusterGroup({
      ...clusterOptions,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background: #ef4444; color: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${count}</div>`,
          className: 'marker-cluster-dumpyards',
          iconSize: L.point(36, 36),
        });
      }
    }).addTo(map);

    routesRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setIsMapReady(true);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
      binClusterRef.current = null;
      stationClusterRef.current = null;
      dumpyardClusterRef.current = null;
      routesRef.current = null;
    };
  }, []);

  // Update bin markers
  useEffect(() => {
    if (!isMapReady || !binClusterRef.current) return;

    binClusterRef.current.clearLayers();

    if (showSmartBins) {
      const markers: L.Marker[] = [];
      filteredData.binsToShow.forEach(bin => {
        const marker = L.marker([bin.lat, bin.lng], { icon: binIcon });
        marker.bindPopup(`
          <div style="min-width: 120px; font-size: 12px;">
            <strong>${bin.id}</strong>
            <div style="color: #666;">${bin.area}</div>
            <div style="margin-top: 4px;">Fill: ${bin.currentLevel}%</div>
          </div>
        `);
        markers.push(marker);
      });
      binClusterRef.current.addLayers(markers);
    }
  }, [isMapReady, showSmartBins, filteredData.binsToShow]);

  // Update station markers
  useEffect(() => {
    if (!isMapReady || !stationClusterRef.current) return;

    stationClusterRef.current.clearLayers();

    if (showCompactStations) {
      const markers: L.Marker[] = [];
      filteredData.stationsToShow.forEach(station => {
        const marker = L.marker([station.lat, station.lng], { icon: stationIcon });
        marker.bindPopup(`
          <div style="min-width: 120px; font-size: 12px;">
            <strong>${station.id}</strong>
            <div style="color: #666;">${station.area}</div>
            <div style="margin-top: 4px;">${station.currentLevel}/${station.capacity}kg</div>
          </div>
        `);
        markers.push(marker);
      });
      stationClusterRef.current.addLayers(markers);
    }
  }, [isMapReady, showCompactStations, filteredData.stationsToShow]);

  // Update dumpyard markers
  useEffect(() => {
    if (!isMapReady || !dumpyardClusterRef.current) return;

    dumpyardClusterRef.current.clearLayers();

    if (showDumpyards) {
      const markers: L.Marker[] = [];
      filteredData.dumpyardsToShow.forEach(dumpyard => {
        const marker = L.marker([dumpyard.lat, dumpyard.lng], { icon: dumpyardIcon });
        marker.bindPopup(`
          <div style="min-width: 120px; font-size: 12px;">
            <strong>${dumpyard.name}</strong>
            <div style="color: #666;">${dumpyard.id}</div>
          </div>
        `);
        markers.push(marker);
      });
      dumpyardClusterRef.current.addLayers(markers);
    }
  }, [isMapReady, showDumpyards, filteredData.dumpyardsToShow]);

  // Update routes - show only driver's route or all routes
  useEffect(() => {
    if (!isMapReady || !routesRef.current) return;

    routesRef.current.clearLayers();

    const routesToShow = driverVehicleId && driverRoute ? [driverRoute] : routes;

    const routeColors = [
      '#22d3ee', '#f59e0b', '#a855f7', '#22c55e', '#ef4444',
      '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'
    ];

    routesToShow.forEach((route, index) => {
      if (route.coordinates && route.coordinates.length > 1) {
        const polyline = L.polyline(route.coordinates, {
          color: routeColors[index % routeColors.length],
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routesRef.current?.addLayer(polyline);
      }
    });
  }, [isMapReady, routes, driverVehicleId, driverRoute]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full rounded-xl"
      style={{ minHeight: '400px' }}
    />
  );
}
