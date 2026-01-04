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
async function getOSRMRoute(
  coordinates: [number, number][],
  retries = 2,
  timeout = 8000
): Promise<{ coords: [number, number][]; distance: number; duration: number } | null> {
  if (coordinates.length < 2) return null;
  
  const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Backoff
          continue;
        }
        return null;
      }
      
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        return {
          coords: data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
          distance: data.routes[0].distance / 1000, // Convert to km
          duration: data.routes[0].duration / 60 // Convert to minutes
        };
      }
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
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
  
  // Create a set of remaining bins to collect
  const remainingBins = new Set(binsToCollect.map(b => b.id));
  const binMap = new Map(binsToCollect.map(b => [b.id, b]));
  
  // Track SAT times for calculating total time
  const satTimes: number[] = [];
  const truckTimes: number[] = [];
  
  // Track station waste accumulation
  const stationWaste = new Map<string, number>();
  stations.forEach(s => stationWaste.set(s.id, s.currentLevel || 0));
  
  // Process each active SAT one by one (fast nearest-neighbor approach)
  for (const sat of activeSATs) {
    if (remainingBins.size === 0) break;
    
    // Find nearest station with remaining bins nearby
    let bestStation = stations[0];
    let minAvgDist = Infinity;
    
    for (const station of stations) {
      let totalDist = 0;
      let count = 0;
      remainingBins.forEach(binId => {
        const bin = binMap.get(binId);
        if (bin) {
          const dist = haversineDistance(station.lat, station.lng, bin.lat, bin.lng);
          totalDist += dist;
          count++;
        }
      });
      const avgDist = count > 0 ? totalDist / count : Infinity;
      if (avgDist < minAvgDist) {
        minAvgDist = avgDist;
        bestStation = station;
      }
    }
    
    const station = bestStation;
    
    // Collect bins using nearest neighbor, respecting capacity and max 20 stops
    const collectedBins: SmartBin[] = [];
    let currentLoad = 0;
    let currentLat = station.lat;
    let currentLng = station.lng;
    
    while (collectedBins.length < MAX_STOPS_PER_SAT && remainingBins.size > 0) {
      // Find nearest remaining bin
      let nearestBin: SmartBin | null = null;
      let nearestDist = Infinity;
      
      remainingBins.forEach(binId => {
        const bin = binMap.get(binId);
        if (bin) {
          const dist = haversineDistance(currentLat, currentLng, bin.lat, bin.lng);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestBin = bin;
          }
        }
      });
      
      if (!nearestBin) break;
      
      // Check if adding this bin exceeds capacity (weight in kg)
      const binWeight = (nearestBin.currentLevel / 100) * nearestBin.capacity * 0.5;
      if (currentLoad + binWeight > sat.capacity) {
        break; // Capacity limit reached
      }
      
      // Add bin to route
      collectedBins.push(nearestBin);
      currentLoad += binWeight;
      currentLat = nearestBin.lat;
      currentLng = nearestBin.lng;
      remainingBins.delete(nearestBin.id);
    }
    
    if (collectedBins.length === 0) continue;
    
    // Calculate distance directly without waiting for OSRM
    let totalDist = haversineDistance(station.lat, station.lng, collectedBins[0].lat, collectedBins[0].lng);
    for (let i = 0; i < collectedBins.length - 1; i++) {
      totalDist += haversineDistance(
        collectedBins[i].lat, collectedBins[i].lng,
        collectedBins[i + 1].lat, collectedBins[i + 1].lng
      );
    }
    totalDist += haversineDistance(
      collectedBins[collectedBins.length - 1].lat, collectedBins[collectedBins.length - 1].lng,
      station.lat, station.lng
    );
    
    const tripTime = Math.round((totalDist / 25) * 60); // 25 km/h avg speed
    satTimes.push(tripTime);
    
    // Update station waste accumulation
    const currentStationWaste = stationWaste.get(station.id) || 0;
    stationWaste.set(station.id, currentStationWaste + currentLoad);
    
    // Build basic route coords
    const routeCoords: [number, number][] = [
      [station.lat, station.lng],
      ...collectedBins.map(b => [b.lat, b.lng] as [number, number]),
      [station.lat, station.lng]
    ];
    
    const route: OptimizedRoute = {
      vehicleId: sat.id,
      vehicleType: 'sat',
      route: [
        { lat: station.lat, lng: station.lng, type: 'compact-station', id: station.id, action: 'pickup' },
        ...collectedBins.map(b => ({
          lat: b.lat, lng: b.lng, type: 'smartbin' as const, id: b.id, action: 'pickup' as const
        })),
        { lat: station.lat, lng: station.lng, type: 'compact-station', id: station.id, action: 'dropoff' }
      ],
      totalDistance: Math.round(totalDist * 10) / 10,
      estimatedTime: tripTime,
      startTime: 0,
      tripNumber: 1,
      targetStationId: station.id,
      coordinates: routeCoords,
      osrmFetched: false
    };
    
    routes.push(route);
    
    // Callback for real-time updates
    if (onRouteGenerated) {
      onRouteGenerated(route, [...routes]);
    }
  }
  
  // Generate Truck routes (stations -> dumpyards)
  // Truck routing logic: truck full OR 2 stations OR stations = trucks
  if (activeTrucks.length > 0 && stations.length > 0) {
    // Sort stations by waste level (descending)
    const stationsWithWaste = stations.map(s => ({
      station: s,
      waste: stationWaste.get(s.id) || s.currentLevel || 0
    })).sort((a, b) => b.waste - a.waste);
    
    const assignedStations = new Set<string>();
    let truckIndex = 0;
    
    // Determine if stations = trucks (assign one station per truck)
    const oneStationPerTruck = stations.length <= activeTrucks.length;
    
    while (truckIndex < activeTrucks.length && assignedStations.size < stations.length) {
      const truck = activeTrucks[truckIndex];
      const truckStations: CompactStation[] = [];
      let truckLoad = 0;
      
      // Find nearest dumpyard for this truck
      const firstUnassigned = stationsWithWaste.find(s => !assignedStations.has(s.station.id));
      if (!firstUnassigned) break;
      
      let nearestDumpyard = activeDumpyards[0];
      let nearestDumpDist = Infinity;
      for (const dump of activeDumpyards) {
        const dist = haversineDistance(firstUnassigned.station.lat, firstUnassigned.station.lng, dump.lat, dump.lng);
        if (dist < nearestDumpDist) {
          nearestDumpDist = dist;
          nearestDumpyard = dump;
        }
      }
      
      // Assign stations to this truck
      for (const { station, waste } of stationsWithWaste) {
        if (assignedStations.has(station.id)) continue;
        
        // Check conditions to move to next truck:
        // 1. Truck is full
        // 2. Already has 2 stations
        // 3. One station per truck mode
        if (truckLoad + waste > truck.capacity) break;
        if (truckStations.length >= MAX_STATIONS_PER_TRUCK) break;
        if (oneStationPerTruck && truckStations.length >= 1) break;
        
        truckStations.push(station);
        truckLoad += waste;
        assignedStations.add(station.id);
      }
      
      if (truckStations.length === 0) {
        truckIndex++;
        continue;
      }
      
      // Optimize station order using nearest neighbor from dumpyard
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
      
      const tripTime = Math.round((totalDist / 35) * 60); // 35 km/h avg truck speed
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
        startTime: Math.max(...satTimes, 0), // Start after SATs complete
        coordinates: routeCoords,
        osrmFetched: false
      };
      
      routes.push(route);
      
      if (onRouteGenerated) {
        onRouteGenerated(route, [...routes]);
      }
      
      truckIndex++;
    }
  }
  
  // Now progressively fetch OSRM routes for accurate paths
  // Process in batches to avoid rate limiting
  fetchOSRMRoutesProgressively(routes, onRouteUpdated);
  
  return routes;
}

// Progressively fetch OSRM routes and update coordinates
async function fetchOSRMRoutesProgressively(
  routes: OptimizedRoute[],
  onRouteUpdated?: (routes: OptimizedRoute[]) => void
) {
  const BATCH_SIZE = 3; // Process 3 routes at a time
  const DELAY_BETWEEN_BATCHES = 300; // 300ms between batches
  
  for (let i = 0; i < routes.length; i += BATCH_SIZE) {
    const batch = routes.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (route) => {
      if (route.osrmFetched) return;
      
      const osrmResult = await getOSRMRoute(route.coordinates);
      if (osrmResult) {
        route.coordinates = osrmResult.coords;
        route.totalDistance = Math.round(osrmResult.distance * 10) / 10;
        route.estimatedTime = Math.round(osrmResult.duration);
        route.osrmFetched = true;
      } else {
        route.osrmFetched = true; // Mark as attempted even if failed
      }
    }));
    
    // Notify about updates
    if (onRouteUpdated) {
      onRouteUpdated([...routes]);
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < routes.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
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
      
      // Find header row
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        if (row && row.some((cell: any) => String(cell).toLowerCase().includes('longitude') || String(cell).toLowerCase().includes('latitude'))) {
          headerIdx = i;
          break;
        }
      }
      
      // Parse data rows
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 4) continue;
        
        const sNo = row[0];
        const location = String(row[1] || '');
        const col2Value = parseFloat(row[2]);
        const col3Value = parseFloat(row[3]);
        const estimatedWaste = parseFloat(row[4]) || 1.0;
        
        if (isNaN(col2Value) || isNaN(col3Value)) continue;
        
        // Auto-detect which column is lat vs lng based on value ranges
        // Latitude for India: 6-36, Longitude for India: 68-98
        // If col2 is in latitude range and col3 is in longitude range, use col2 as lat
        let lat: number, lng: number;
        
        if (col2Value >= 6 && col2Value <= 36 && col3Value >= 68 && col3Value <= 98) {
          // Col2 is latitude, Col3 is longitude (despite what headers may say)
          lat = col2Value;
          lng = col3Value;
        } else if (col3Value >= 6 && col3Value <= 36 && col2Value >= 68 && col2Value <= 98) {
          // Col3 is latitude, Col2 is longitude
          lat = col3Value;
          lng = col2Value;
        } else {
          // Can't determine, skip this row
          console.warn(`Skipping row ${i}: coordinates out of India range (${col2Value}, ${col3Value})`);
          continue;
        }
        
        result.bins?.push({
          id: `GVP-${sNo || i}`,
          lat: lat,
          lng: lng,
          capacity: 100, // Default bin capacity in liters
          currentLevel: Math.min(100, Math.round(estimatedWaste * 50)), // Convert waste estimate to fill %
          area: location,
          isSmartBin: true // Default to smart bin
        });
      }
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
