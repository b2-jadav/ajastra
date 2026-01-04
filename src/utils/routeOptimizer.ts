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

// Get OSRM route between points
async function getOSRMRoute(coordinates: [number, number][]): Promise<[number, number][]> {
  if (coordinates.length < 2) return coordinates;
  
  const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`
    );
    
    if (!response.ok) throw new Error('OSRM request failed');
    
    const data = await response.json();
    
    if (data.routes && data.routes[0]) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    }
  } catch (error) {
    console.warn('OSRM routing failed, using direct lines:', error);
  }
  
  return coordinates;
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

// Helper function to create SAT route
async function createSATRoute(
  sat: Vehicle,
  bins: SmartBin[],
  station: CompactStation,
  tripNumber: number,
  startTime: number
): Promise<OptimizedRoute> {
  const optimizedBatch = nearestNeighborTSP(station, bins);
  
  const routeCoords: [number, number][] = [
    [station.lat, station.lng],
    ...optimizedBatch.map(b => [b.lat, b.lng] as [number, number]),
    [station.lat, station.lng]
  ];
  
  const osrmRoute = await getOSRMRoute(routeCoords);
  
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
    coordinates: osrmRoute
  };
}

interface GenerateRoutesParams {
  bins: SmartBin[];
  stations: CompactStation[];
  dumpyards: Dumpyard[];
  sats: Vehicle[];
  trucks: Vehicle[];
  onRouteGenerated?: (route: OptimizedRoute) => void;
}

const MAX_STOPS_PER_SAT = 20;

export async function generateOptimizedRoutes({
  bins,
  stations,
  dumpyards,
  sats,
  trucks,
  onRouteGenerated
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
  
  // Filter active SATs only
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
  
  // Track station completion times for truck scheduling
  const stationCompletionTime = new Map<string, number>();
  
  // Process each active SAT one by one
  for (const sat of activeSATs) {
    if (remainingBins.size === 0) break;
    
    // Find nearest station to start from
    const stationDistances = stations.map(s => {
      // Find average distance to remaining bins
      let totalDist = 0;
      let count = 0;
      remainingBins.forEach(binId => {
        const bin = binMap.get(binId);
        if (bin) {
          totalDist += haversineDistance(s.lat, s.lng, bin.lat, bin.lng);
          count++;
        }
      });
      return { station: s, avgDist: count > 0 ? totalDist / count : Infinity };
    });
    stationDistances.sort((a, b) => a.avgDist - b.avgDist);
    const station = stationDistances[0].station;
    
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
      
      // Check if adding this bin exceeds capacity
      const binWeight = (nearestBin.currentLevel / 100) * nearestBin.capacity * 0.5; // kg
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
    
    // Build route coordinates for OSRM
    const routeCoords: [number, number][] = [
      [station.lat, station.lng],
      ...collectedBins.map(b => [b.lat, b.lng] as [number, number]),
      [station.lat, station.lng]
    ];
    
    // Get OSRM route (or fallback to direct)
    const osrmRoute = await getOSRMRoute(routeCoords);
    
    // Calculate total distance
    let totalDist = 0;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      totalDist += haversineDistance(
        routeCoords[i][0], routeCoords[i][1],
        routeCoords[i + 1][0], routeCoords[i + 1][1]
      );
    }
    
    const tripTime = Math.round((totalDist / 25) * 60); // Assuming 25 km/h avg speed
    
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
      coordinates: osrmRoute
    };
    
    routes.push(route);
    
    // Update station completion time
    const prevCompletion = stationCompletionTime.get(station.id) || 0;
    stationCompletionTime.set(station.id, Math.max(prevCompletion, tripTime));
    
    // Callback for real-time updates
    if (onRouteGenerated) {
      onRouteGenerated(route);
    }
  }
  
  // Generate Truck routes (compact stations -> dumpyards)
  if (activeTrucks.length > 0) {
    const stationAssignments = assignStationsToDumpyards(stations, activeDumpyards);
    let truckIndex = 0;
    
    for (const [dumpyardId, assignedStations] of stationAssignments) {
      if (assignedStations.length === 0) continue;
      
      const dumpyard = activeDumpyards.find(d => d.id === dumpyardId);
      if (!dumpyard) continue;
      
      const truck = activeTrucks[truckIndex % activeTrucks.length];
      if (!truck) continue;
      
      // Optimize station visit order using nearest neighbor
      const optimizedStations = nearestNeighborTSP(dumpyard, assignedStations, dumpyard);
      
      const routeCoords: [number, number][] = [
        [dumpyard.lat, dumpyard.lng],
        ...optimizedStations.map(s => [s.lat, s.lng] as [number, number]),
        [dumpyard.lat, dumpyard.lng]
      ];
      
      const osrmRoute = await getOSRMRoute(routeCoords);
      
      let totalDist = 0;
      for (let i = 0; i < routeCoords.length - 1; i++) {
        totalDist += haversineDistance(
          routeCoords[i][0], routeCoords[i][1],
          routeCoords[i + 1][0], routeCoords[i + 1][1]
        );
      }
      
      // Calculate truck start time
      let truckStartTime = 0;
      for (const station of optimizedStations) {
        const stationTime = stationCompletionTime.get(station.id) || 0;
        truckStartTime = Math.max(truckStartTime, stationTime);
      }
      
      const tripTime = Math.round((totalDist / 35) * 60);
      
      const route: OptimizedRoute = {
        vehicleId: truck.id,
        vehicleType: 'truck',
        route: [
          { lat: dumpyard.lat, lng: dumpyard.lng, type: 'dumpyard', id: dumpyard.id, action: 'pickup' },
          ...optimizedStations.map(s => ({
            lat: s.lat, lng: s.lng, type: 'compact-station' as const, id: s.id, action: 'pickup' as const
          })),
          { lat: dumpyard.lat, lng: dumpyard.lng, type: 'dumpyard', id: dumpyard.id, action: 'dropoff' }
        ],
        totalDistance: Math.round(totalDist * 10) / 10,
        estimatedTime: tripTime,
        startTime: truckStartTime,
        coordinates: osrmRoute
      };
      
      routes.push(route);
      
      if (onRouteGenerated) {
        onRouteGenerated(route);
      }
      
      truckIndex++;
    }
  }
  
  return routes;
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
