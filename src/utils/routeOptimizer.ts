import { SmartBin, CompactStation, Dumpyard, Vehicle, OptimizedRoute } from '@/types';

// Haversine distance formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get OSRM route between points with retry and timeout
// Uses traffic-aware routing with time annotations
async function getOSRMRoute(
  coordinates: [number, number][],
  retries = 3,
  timeout = 15000,
  useTrafficWeights = true
): Promise<{ coords: [number, number][]; distance: number; duration: number; avgSpeed: number } | null> {
  if (coordinates.length < 2) return null;
  
  const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  
  // Add annotations for traffic-aware routing (speed, duration per segment)
  const annotations = useTrafficWeights ? '&annotations=speed,duration' : '';
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson${annotations}&alternatives=true`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (attempt < retries) {
          const backoffTime = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
          console.log(`OSRM rate limited, waiting ${backoffTime}ms before retry...`);
          await new Promise(r => setTimeout(r, backoffTime));
          continue;
        }
        throw new Error('OSRM rate limit exceeded');
      }
      
      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error('OSRM request failed');
      }
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // Select best route based on duration (traffic-aware)
        // OSRM returns alternatives sorted by duration, but we can check
        let bestRoute = data.routes[0];
        
        // If alternatives exist, pick the one with shortest duration (accounts for traffic)
        if (data.routes.length > 1) {
          for (const route of data.routes) {
            if (route.duration < bestRoute.duration) {
              bestRoute = route;
            }
          }
        }
        
        const distance = bestRoute.distance / 1000; // km
        const duration = bestRoute.duration / 60; // minutes
        const avgSpeed = duration > 0 ? (distance / (duration / 60)) : 25; // km/h
        
        return {
          coords: bestRoute.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
          distance: distance,
          duration: duration,
          avgSpeed: avgSpeed
        };
      }
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  
  return null;
}

// Nearest neighbor algorithm for route optimization
function nearestNeighborTSP<T extends { lat: number; lng: number }>(
  start: { lat: number; lng: number },
  points: T[],
  end?: { lat: number; lng: number }
): T[] {
  if (points.length === 0) return [];
  
  const remaining = [...points];
  const route: T[] = [];
  let current = start;
  
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    
    route.push(remaining[nearestIdx]);
    current = remaining[nearestIdx];
    remaining.splice(nearestIdx, 1);
  }
  
  return route;
}

// Cluster bins to stations using k-means-like approach
function assignBinsToStations(
  bins: SmartBin[],
  stations: CompactStation[]
): Map<string, SmartBin[]> {
  const assignments = new Map<string, SmartBin[]>();
  
  stations.forEach(station => {
    assignments.set(station.id, []);
  });
  
  bins.forEach(bin => {
    if (bin.currentLevel < 30) return; // Skip nearly empty bins
    
    let nearestStation = stations[0];
    let nearestDist = Infinity;
    
    stations.forEach(station => {
      const dist = haversineDistance(bin.lat, bin.lng, station.lat, station.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    });
    
    assignments.get(nearestStation.id)?.push(bin);
  });
  
  return assignments;
}

// Assign stations to dumpyards
function assignStationsToDumpyards(
  stations: CompactStation[],
  dumpyards: Dumpyard[]
): Map<string, CompactStation[]> {
  const assignments = new Map<string, CompactStation[]>();
  
  dumpyards.forEach(dumpyard => {
    assignments.set(dumpyard.id, []);
  });
  
  stations.forEach(station => {
    let nearestDumpyard = dumpyards[0];
    let nearestDist = Infinity;
    
    dumpyards.forEach(dumpyard => {
      const dist = haversineDistance(station.lat, station.lng, dumpyard.lat, dumpyard.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestDumpyard = dumpyard;
      }
    });
    
    assignments.get(nearestDumpyard.id)?.push(station);
  });
  
  return assignments;
}

// Helper function to create SAT route (uses straight lines, OSRM fetched later)
function createSATRouteSync(
  sat: Vehicle,
  bins: SmartBin[],
  station: CompactStation,
  tripNumber: number,
  startTime: number
): OptimizedRoute {
  const optimizedBatch = nearestNeighborTSP(station, bins);
  
  const routeCoords: [number, number][] = [
    [station.lat, station.lng],
    ...optimizedBatch.map(b => [b.lat, b.lng] as [number, number]),
    [station.lat, station.lng]
  ];
  
  let totalDist = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    totalDist += haversineDistance(
      routeCoords[i][0], routeCoords[i][1],
      routeCoords[i+1][0], routeCoords[i+1][1]
    );
  }
  
  const tripTime = Math.round((totalDist / 25) * 60);
  
  return {
    vehicleId: sat.id,
    vehicleType: 'sat',
    route: [
      { lat: station.lat, lng: station.lng, type: 'compact-station', id: station.id, action: 'pickup' },
      ...optimizedBatch.map(b => ({
        lat: b.lat, lng: b.lng, type: 'smartbin' as const, id: b.id, action: 'pickup' as const
      })),
      { lat: station.lat, lng: station.lng, type: 'compact-station', id: station.id, action: 'dropoff' }
    ],
    totalDistance: Math.round(totalDist * 10) / 10,
    estimatedTime: tripTime,
    startTime,
    tripNumber,
    targetStationId: station.id,
    coordinates: routeCoords,
    osrmFetched: false // Flag to track if OSRM route has been fetched
  };
}

interface GenerateRoutesParams {
  bins: SmartBin[];
  stations: CompactStation[];
  dumpyards: Dumpyard[];
  sats: Vehicle[];
  trucks: Vehicle[];
  onRouteGenerated?: (route: OptimizedRoute, allRoutes: OptimizedRoute[]) => void;
  onRouteUpdated?: (routes: OptimizedRoute[]) => void; // Called when OSRM paths are fetched
}

const MAX_STOPS_PER_SAT = 20;
const MAX_STATIONS_PER_TRUCK = 2;

export async function generateOptimizedRoutes({
  bins,
  stations,
  dumpyards,
  sats,
  trucks,
  onRouteGenerated,
  onRouteUpdated
}: GenerateRoutesParams): Promise<OptimizedRoute[]> {
  const routes: OptimizedRoute[] = [];
  
  // Validate required data
  if (!bins || bins.length === 0) {
    throw new Error('No smart bins available. Please upload data with GVP locations.');
  }
  
  if (!stations || stations.length === 0) {
    throw new Error('No compact stations available. Please upload data with SCTP/station locations.');
  }
  
  if (!sats || sats.length === 0) {
    throw new Error('No SAT vehicles available. Please upload fleet data with Mini Tippers.');
  }
  
  // Use provided dumpyards or default
  const activeDumpyards = dumpyards && dumpyards.length > 0 ? dumpyards : [
    {
      id: 'DUMPYARD-DEFAULT',
      name: 'Central Dumpyard',
      lat: 17.4239,
      lng: 78.4738,
      capacity: 100000,
      currentLevel: 0
    }
  ];
  
  // Filter active vehicles only
  const activeSATs = sats.filter(s => s.status === 'active');
  const activeTrucks = trucks && trucks.length > 0 ? trucks.filter(t => t.status === 'active') : [];
  
  if (activeSATs.length === 0) {
    throw new Error('No active SAT vehicles available for routing');
  }
  
  // Filter bins that need collection (> 30% full), or all if none meet threshold
  let binsToCollect = bins.filter(b => b.currentLevel >= 30);
  if (binsToCollect.length === 0) {
    binsToCollect = [...bins];
  }
  
  // ========== BALANCED DISTRIBUTION ALGORITHM ==========
  // Calculate bins per vehicle for equal distribution
  const totalBins = binsToCollect.length;
  const numSATs = activeSATs.length;
  const binsPerSAT = Math.ceil(totalBins / numSATs);
  const effectiveBinsPerSAT = Math.min(binsPerSAT, MAX_STOPS_PER_SAT);
  
  console.log(`Balanced distribution: ${totalBins} bins across ${numSATs} SATs (${effectiveBinsPerSAT} bins each)`);
  
  // Assign bins to nearest stations first
  const stationBinMap = assignBinsToStations(binsToCollect, stations);
  
  // Create a pool of all bins with their assigned stations
  const binPool: { bin: SmartBin; station: CompactStation }[] = [];
  stationBinMap.forEach((stationBins, stationId) => {
    const station = stations.find(s => s.id === stationId);
    if (station) {
      stationBins.forEach(bin => {
        binPool.push({ bin, station });
      });
    }
  });
  
  // Sort bins by fill level (highest first for priority collection)
  binPool.sort((a, b) => b.bin.currentLevel - a.bin.currentLevel);
  
  // Track SAT times and station waste
  const satTimes: number[] = [];
  const truckTimes: number[] = [];
  const stationWaste = new Map<string, number>();
  stations.forEach(s => stationWaste.set(s.id, s.currentLevel || 0));
  
  // ========== DISTRIBUTE BINS EQUALLY TO ALL SATs ==========
  let binIndex = 0;
  
  for (let satIdx = 0; satIdx < activeSATs.length; satIdx++) {
    const sat = activeSATs[satIdx];
    
    // Calculate how many bins this SAT should get
    const remainingBins = binPool.length - binIndex;
    const remainingSATs = activeSATs.length - satIdx;
    const binsForThisSAT = Math.min(
      Math.ceil(remainingBins / remainingSATs),
      MAX_STOPS_PER_SAT
    );
    
    if (binsForThisSAT === 0 || binIndex >= binPool.length) {
      // Even if no bins, give SAT at least a check route if there are stations
      continue;
    }
    
    // Collect bins for this SAT
    const satBins: SmartBin[] = [];
    let currentLoad = 0;
    let targetStation: CompactStation | null = null;
    
    // Get the initial station from first bin
    const firstBinData = binPool[binIndex];
    if (firstBinData) {
      targetStation = firstBinData.station;
    }
    
    // Collect bins up to the calculated limit, respecting capacity
    while (satBins.length < binsForThisSAT && binIndex < binPool.length) {
      const binData = binPool[binIndex];
      
      // If this bin's station is different, use nearest neighbor to decide
      // For simplicity, prioritize bins near the first station
      const binWeight = (binData.bin.currentLevel / 100) * binData.bin.capacity * 0.5;
      
      if (currentLoad + binWeight > sat.capacity) {
        binIndex++;
        continue; // Skip bins that would exceed capacity
      }
      
      satBins.push(binData.bin);
      currentLoad += binWeight;
      
      // Use the station from the majority of assigned bins
      if (!targetStation) {
        targetStation = binData.station;
      }
      
      binIndex++;
    }
    
    if (satBins.length === 0 || !targetStation) continue;
    
    // Optimize bin order using nearest neighbor from station
    const optimizedBins = nearestNeighborTSP(targetStation, satBins);
    
    // Calculate distance
    let totalDist = haversineDistance(targetStation.lat, targetStation.lng, optimizedBins[0].lat, optimizedBins[0].lng);
    for (let i = 0; i < optimizedBins.length - 1; i++) {
      totalDist += haversineDistance(
        optimizedBins[i].lat, optimizedBins[i].lng,
        optimizedBins[i + 1].lat, optimizedBins[i + 1].lng
      );
    }
    totalDist += haversineDistance(
      optimizedBins[optimizedBins.length - 1].lat, optimizedBins[optimizedBins.length - 1].lng,
      targetStation.lat, targetStation.lng
    );
    
    // Estimate time based on traffic conditions (use slower speed during peak hours)
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);
    const avgSpeed = isPeakHour ? 18 : 25; // km/h - slower during peak
    const tripTime = Math.round((totalDist / avgSpeed) * 60);
    satTimes.push(tripTime);
    
    // Update station waste accumulation
    const currentStationWaste = stationWaste.get(targetStation.id) || 0;
    stationWaste.set(targetStation.id, currentStationWaste + currentLoad);
    
    // Build route coordinates
    const routeCoords: [number, number][] = [
      [targetStation.lat, targetStation.lng],
      ...optimizedBins.map(b => [b.lat, b.lng] as [number, number]),
      [targetStation.lat, targetStation.lng]
    ];
    
    const route: OptimizedRoute = {
      vehicleId: sat.id,
      vehicleType: 'sat',
      route: [
        { lat: targetStation.lat, lng: targetStation.lng, type: 'compact-station', id: targetStation.id, action: 'pickup' },
        ...optimizedBins.map(b => ({
          lat: b.lat, lng: b.lng, type: 'smartbin' as const, id: b.id, action: 'pickup' as const
        })),
        { lat: targetStation.lat, lng: targetStation.lng, type: 'compact-station', id: targetStation.id, action: 'dropoff' }
      ],
      totalDistance: Math.round(totalDist * 10) / 10,
      estimatedTime: tripTime,
      startTime: 0,
      tripNumber: 1,
      targetStationId: targetStation.id,
      coordinates: routeCoords,
      osrmFetched: false
    };
    
    routes.push(route);
    
    if (onRouteGenerated) {
      onRouteGenerated(route, [...routes]);
    }
  }
  
  // ========== BALANCED TRUCK DISTRIBUTION ==========
  // Distribute stations equally to all trucks
  if (activeTrucks.length > 0 && stations.length > 0) {
    // Sort stations by waste level (descending)
    const stationsWithWaste = stations.map(s => ({
      station: s,
      waste: stationWaste.get(s.id) || s.currentLevel || 0
    })).filter(s => s.waste > 0).sort((a, b) => b.waste - a.waste);
    
    // Calculate stations per truck for equal distribution
    const stationsPerTruck = Math.ceil(stationsWithWaste.length / activeTrucks.length);
    const effectiveStationsPerTruck = Math.min(stationsPerTruck, MAX_STATIONS_PER_TRUCK);
    
    console.log(`Balanced truck distribution: ${stationsWithWaste.length} stations across ${activeTrucks.length} trucks (${effectiveStationsPerTruck} each)`);
    
    let stationIndex = 0;
    
    for (let truckIdx = 0; truckIdx < activeTrucks.length; truckIdx++) {
      const truck = activeTrucks[truckIdx];
      
      // Calculate how many stations this truck should get
      const remainingStations = stationsWithWaste.length - stationIndex;
      const remainingTrucks = activeTrucks.length - truckIdx;
      const stationsForThisTruck = Math.min(
        Math.ceil(remainingStations / remainingTrucks),
        MAX_STATIONS_PER_TRUCK
      );
      
      if (stationsForThisTruck === 0 || stationIndex >= stationsWithWaste.length) {
        continue;
      }
      
      const truckStations: CompactStation[] = [];
      let truckLoad = 0;
      
      while (truckStations.length < stationsForThisTruck && stationIndex < stationsWithWaste.length) {
        const { station, waste } = stationsWithWaste[stationIndex];
        
        if (truckLoad + waste > truck.capacity) {
          stationIndex++;
          continue;
        }
        
        truckStations.push(station);
        truckLoad += waste;
        stationIndex++;
      }
      
      if (truckStations.length === 0) continue;
      
      // Find nearest dumpyard
      let nearestDumpyard = activeDumpyards[0];
      let nearestDumpDist = Infinity;
      for (const dump of activeDumpyards) {
        const dist = haversineDistance(truckStations[0].lat, truckStations[0].lng, dump.lat, dump.lng);
        if (dist < nearestDumpDist) {
          nearestDumpDist = dist;
          nearestDumpyard = dump;
        }
      }
      
      // Optimize station order using nearest neighbor
      const optimizedStations = nearestNeighborTSP(nearestDumpyard, truckStations);
      
      // Calculate distance
      let totalDist = haversineDistance(nearestDumpyard.lat, nearestDumpyard.lng, optimizedStations[0].lat, optimizedStations[0].lng);
      for (let i = 0; i < optimizedStations.length - 1; i++) {
        totalDist += haversineDistance(
          optimizedStations[i].lat, optimizedStations[i].lng,
          optimizedStations[i + 1].lat, optimizedStations[i + 1].lng
        );
      }
      totalDist += haversineDistance(
        optimizedStations[optimizedStations.length - 1].lat, optimizedStations[optimizedStations.length - 1].lng,
        nearestDumpyard.lat, nearestDumpyard.lng
      );
      
      // Traffic-aware timing for trucks
      const currentHour = new Date().getHours();
      const isPeakHour = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);
      const avgTruckSpeed = isPeakHour ? 25 : 35; // km/h
      const tripTime = Math.round((totalDist / avgTruckSpeed) * 60);
      truckTimes.push(tripTime);
      
      const routeCoords: [number, number][] = [
        [nearestDumpyard.lat, nearestDumpyard.lng],
        ...optimizedStations.map(s => [s.lat, s.lng] as [number, number]),
        [nearestDumpyard.lat, nearestDumpyard.lng]
      ];
      
      const route: OptimizedRoute = {
        vehicleId: truck.id,
        vehicleType: 'truck',
        route: [
          { lat: nearestDumpyard.lat, lng: nearestDumpyard.lng, type: 'dumpyard', id: nearestDumpyard.id, action: 'pickup' },
          ...optimizedStations.map(s => ({
            lat: s.lat, lng: s.lng, type: 'compact-station' as const, id: s.id, action: 'pickup' as const
          })),
          { lat: nearestDumpyard.lat, lng: nearestDumpyard.lng, type: 'dumpyard', id: nearestDumpyard.id, action: 'dropoff' }
        ],
        totalDistance: Math.round(totalDist * 10) / 10,
        estimatedTime: tripTime,
        startTime: Math.max(...satTimes, 0),
        coordinates: routeCoords,
        osrmFetched: false
      };
      
      routes.push(route);
      
      if (onRouteGenerated) {
        onRouteGenerated(route, [...routes]);
      }
    }
  }
  
  // Now progressively fetch OSRM routes for accurate paths with traffic data
  fetchOSRMRoutesProgressively(routes, onRouteUpdated);
  
  return routes;
}

// Progressively fetch OSRM routes and update coordinates
// OSRM public API limit: 1 request per second max
async function fetchOSRMRoutesProgressively(
  routes: OptimizedRoute[],
  onRouteUpdated?: (routes: OptimizedRoute[]) => void
) {
  const DELAY_BETWEEN_REQUESTS = 1100; // 1.1 seconds between requests (respecting 1/sec limit)
  
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (route.osrmFetched) continue;
    
    try {
      const osrmResult = await getOSRMRoute(route.coordinates);
      if (osrmResult) {
        route.coordinates = osrmResult.coords;
        route.totalDistance = Math.round(osrmResult.distance * 10) / 10;
        route.estimatedTime = Math.round(osrmResult.duration);
        route.osrmFetched = true;
      } else {
        route.osrmFetched = true; // Mark as attempted even if failed
      }
    } catch (error) {
      console.warn(`OSRM routing failed for ${route.vehicleId}, using direct lines:`, error);
      route.osrmFetched = true;
    }
    
    // Notify about updates after each route
    if (onRouteUpdated) {
      onRouteUpdated([...routes]);
    }
    
    // Delay between requests to respect rate limit
    if (i < routes.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS));
    }
  }
}

// Calculate total estimated time: max SAT time + max Truck time
export function calculateTotalTime(routes: OptimizedRoute[]): { minutes: number; hours: number } {
  const satRoutes = routes.filter(r => r.vehicleType === 'sat');
  const truckRoutes = routes.filter(r => r.vehicleType === 'truck');
  
  const maxSatTime = satRoutes.length > 0 ? Math.max(...satRoutes.map(r => r.estimatedTime)) : 0;
  const maxTruckTime = truckRoutes.length > 0 ? Math.max(...truckRoutes.map(r => r.estimatedTime)) : 0;
  
  const totalMinutes = maxSatTime + maxTruckTime;
  const hours = Math.round((totalMinutes / 60) * 10) / 10;
  
  return { minutes: totalMinutes, hours: Math.min(hours, 20) }; // Cap at 20 hours
}

// Parse DMS coordinates (e.g., 17°23'23.38"N, 78°33'32.79"E)
function parseDMSCoordinates(coordString: string): { lat: number; lng: number } | null {
  const regex = /(\d+)°(\d+)'([\d.]+)"([NS]),?\s*(\d+)°(\d+)'([\d.]+)"([EW])/;
  const match = coordString.match(regex);
  
  if (!match) return null;
  
  const latDeg = parseFloat(match[1]);
  const latMin = parseFloat(match[2]);
  const latSec = parseFloat(match[3]);
  const latDir = match[4];
  
  const lngDeg = parseFloat(match[5]);
  const lngMin = parseFloat(match[6]);
  const lngSec = parseFloat(match[7]);
  const lngDir = match[8];
  
  let lat = latDeg + latMin / 60 + latSec / 3600;
  let lng = lngDeg + lngMin / 60 + lngSec / 3600;
  
  if (latDir === 'S') lat = -lat;
  if (lngDir === 'W') lng = -lng;
  
  return { lat, lng };
}

// Parse Excel data
export interface ExcelData {
  bins: SmartBin[];
  stations: CompactStation[];
  dumpyards: Dumpyard[];
  sats: Vehicle[];
  trucks: Vehicle[];
}

// Parse multi-sheet workbook format
export function parseMultiSheetExcel(workbook: any): Partial<ExcelData> {
  const XLSX = (window as any).XLSX;
  const result: Partial<ExcelData> = {
    bins: [],
    stations: [],
    dumpyards: [],
    sats: [],
    trucks: []
  };
  
  // Parse GVPs sheet (dustbins/smartbins)
  const gvpSheetNames = ['Sample Data', 'GVPs', 'GVP', 'Locations of GVPs', 'Dustbins', 'Bins'];
  for (const sheetName of workbook.SheetNames) {
    if (gvpSheetNames.some(n => sheetName.toLowerCase().includes(n.toLowerCase()))) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      console.log(`Parsing GVP sheet "${sheetName}" with ${data.length} rows`);
      
      // Find header row
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        if (row && row.some((cell: any) => String(cell).toLowerCase().includes('longitude') || String(cell).toLowerCase().includes('latitude'))) {
          headerIdx = i;
          break;
        }
      }
      
      // Parse data rows - be more lenient with row requirements
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 3) continue; // Only need 3 columns minimum
        
        const sNo = row[0];
        const location = String(row[1] || '');
        
        // Try columns 2,3 first, then 3,4 if that fails
        let col2Value = parseFloat(row[2]);
        let col3Value = parseFloat(row[3]);
        const estimatedWaste = parseFloat(row[4]) || 1.0;
        
        // If col2 or col3 is NaN, try shifting columns
        if (isNaN(col2Value) || isNaN(col3Value)) {
          col2Value = parseFloat(row[3]);
          col3Value = parseFloat(row[4]);
        }
        
        if (isNaN(col2Value) || isNaN(col3Value)) continue;
        
        // Auto-detect which column is lat vs lng based on value ranges
        // Widened ranges for India: Lat 6-40, Long 65-100
        let lat: number, lng: number;
        
        if (col2Value >= 6 && col2Value <= 40 && col3Value >= 65 && col3Value <= 100) {
          lat = col2Value;
          lng = col3Value;
        } else if (col3Value >= 6 && col3Value <= 40 && col2Value >= 65 && col2Value <= 100) {
          lat = col3Value;
          lng = col2Value;
        } else {
          // Fallback: assume col2 is lat, col3 is lng if values are plausible
          if (col2Value >= -90 && col2Value <= 90 && col3Value >= -180 && col3Value <= 180) {
            lat = col2Value;
            lng = col3Value;
          } else {
            continue;
          }
        }
        
        result.bins?.push({
          id: `GVP-${sNo || i}`,
          lat: lat,
          lng: lng,
          capacity: 100,
          currentLevel: Math.min(100, Math.round(estimatedWaste * 50)),
          area: location,
          isSmartBin: true
        });
      }
      
      console.log(`Parsed ${result.bins?.length} GVPs from sheet "${sheetName}"`);
      break;
    }
  }
  
  // Parse Fleet Details sheet (vehicles)
  const fleetSheetNames = ['Fleet Details', 'Fleet', 'Vehicles', 'Fleet Data'];
  for (const sheetName of workbook.SheetNames) {
    if (fleetSheetNames.some(n => sheetName.toLowerCase().includes(n.toLowerCase()))) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // Find header row
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        if (row && row.some((cell: any) => String(cell).toLowerCase().includes('vehicle') || String(cell).toLowerCase().includes('payload'))) {
          headerIdx = i;
          break;
        }
      }
      
      // Parse data rows
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 4) continue;
        
        const vehicleType = String(row[1] || '').toLowerCase();
        const payloadCapacity = parseFloat(row[3]) || 4; // in tonnes
        const capacityInKg = payloadCapacity * 1000;
        const numVehicles = parseInt(row[4]) || 1;
        
        if (!vehicleType) continue;
        
        // Vehicles with 16000+ kg capacity are trucks, Mini Tipper = SAT (if smaller capacity)
        const isTruck = capacityInKg >= 16000 || (!vehicleType.includes('mini') && !vehicleType.includes('tipper') && !vehicleType.includes('sat'));
        
        for (let v = 0; v < numVehicles; v++) {
          const vehicle: Vehicle = {
            id: `${isTruck ? 'TRUCK' : 'SAT'}-${payloadCapacity}T-${v + 1}`,
            capacity: capacityInKg,
            status: 'active',
            driver: ''
          };
          
          if (isTruck) {
            result.trucks?.push(vehicle);
          } else {
            result.sats?.push(vehicle);
          }
        }
      }
      break;
    }
  }
  
  // Parse SCTP sheet (Transfer Stations)
  const sctpSheetNames = ['SCTP', 'Stations', 'Transfer Stations', 'Compact Stations'];
  for (const sheetName of workbook.SheetNames) {
    if (sctpSheetNames.some(n => sheetName.toLowerCase().includes(n.toLowerCase()))) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // Find header row
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        if (row && row.some((cell: any) => String(cell).toLowerCase().includes('station') || String(cell).toLowerCase().includes('coordinate'))) {
          headerIdx = i;
          break;
        }
      }
      
      // Parse data rows
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 3) continue;
        
        const sNo = row[0];
        const stationName = String(row[1] || '');
        const coordString = String(row[2] || '');
        
        if (!stationName || !coordString) continue;
        
        // Try parsing DMS coordinates
        const coords = parseDMSCoordinates(coordString);
        
        if (coords) {
          result.stations?.push({
            id: `SCTP-${sNo || i}`,
            lat: coords.lat,
            lng: coords.lng,
            capacity: 20000, // Default 20 tonnes
            currentLevel: 0,
            area: stationName
          });
        }
      }
      break;
    }
  }
  
  return result;
}

// Legacy single-sheet parser
export function parseExcelData(data: any[][]): Partial<ExcelData> {
  const result: Partial<ExcelData> = {
    bins: [],
    stations: [],
    dumpyards: [],
    sats: [],
    trucks: []
  };
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    
    const type = String(row[0]).toLowerCase().trim();
    
    switch (type) {
      case 'bin':
      case 'smartbin':
        if (row.length >= 5) {
          result.bins?.push({
            id: String(row[1]),
            lat: parseFloat(row[2]) || 0,
            lng: parseFloat(row[3]) || 0,
            capacity: parseInt(row[4]) || 100,
            currentLevel: parseInt(row[5]) || 0,
            area: String(row[6]) || 'Unknown',
            isSmartBin: true // Default to smart bin
          });
        }
        break;
        
      case 'station':
      case 'compact':
      case 'compactstation':
        if (row.length >= 5) {
          result.stations?.push({
            id: String(row[1]),
            lat: parseFloat(row[2]) || 0,
            lng: parseFloat(row[3]) || 0,
            capacity: parseInt(row[4]) || 2000,
            currentLevel: parseInt(row[5]) || 0,
            area: String(row[6]) || 'Unknown'
          });
        }
        break;
        
      case 'dumpyard':
        if (row.length >= 5) {
          result.dumpyards?.push({
            id: String(row[1]),
            lat: parseFloat(row[2]) || 0,
            lng: parseFloat(row[3]) || 0,
            capacity: parseInt(row[4]) || 50000,
            currentLevel: parseInt(row[5]) || 0,
            name: String(row[6]) || 'Dumpyard'
          });
        }
        break;
        
      case 'sat':
        if (row.length >= 3) {
          result.sats?.push({
            id: String(row[1]),
            capacity: parseInt(row[2]) || 500,
            status: (String(row[3]) as any) || 'active',
            driver: ''
          });
        }
        break;
        
      case 'truck':
        if (row.length >= 3) {
          result.trucks?.push({
            id: String(row[1]),
            capacity: parseInt(row[2]) || 5000,
            status: (String(row[3]) as any) || 'active',
            driver: ''
          });
        }
        break;
    }
  }
  
  return result;
}
