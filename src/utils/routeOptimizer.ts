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

interface GenerateRoutesParams {
  bins: SmartBin[];
  stations: CompactStation[];
  dumpyards: Dumpyard[];
  sats: Vehicle[];
  trucks: Vehicle[];
}

export async function generateOptimizedRoutes({
  bins,
  stations,
  dumpyards,
  sats,
  trucks
}: GenerateRoutesParams): Promise<OptimizedRoute[]> {
  const routes: OptimizedRoute[] = [];
  
  // Filter active vehicles only
  const activeSATs = sats.filter(s => s.status === 'active');
  const activeTrucks = trucks.filter(t => t.status === 'active');
  
  if (activeSATs.length === 0 || activeTrucks.length === 0) {
    throw new Error('No active vehicles available for routing');
  }
  
  // Filter bins that need collection (> 30% full)
  const binsToCollect = bins.filter(b => b.currentLevel >= 30);
  
  // Step 1: Assign bins to compact stations
  const binAssignments = assignBinsToStations(binsToCollect, stations);
  
  // Step 2: Assign stations to dumpyards
  const stationAssignments = assignStationsToDumpyards(stations, dumpyards);
  
  // Step 3: Generate SAT routes (bins -> compact stations)
  let satIndex = 0;
  
  for (const [stationId, assignedBins] of binAssignments) {
    if (assignedBins.length === 0) continue;
    
    const station = stations.find(s => s.id === stationId)!;
    const sat = activeSATs[satIndex % activeSATs.length];
    
    // Sort bins by priority (fill level) and distance
    const sortedBins = [...assignedBins].sort((a, b) => b.currentLevel - a.currentLevel);
    
    // Group bins based on SAT capacity
    let currentLoad = 0;
    let currentBatch: SmartBin[] = [];
    
    for (const bin of sortedBins) {
      const binWeight = (bin.currentLevel / 100) * bin.capacity * 0.5; // Approximate weight in kg
      
      if (currentLoad + binWeight <= sat.capacity) {
        currentBatch.push(bin);
        currentLoad += binWeight;
      } else {
        if (currentBatch.length > 0) {
          // Optimize route for current batch
          const optimizedBatch = nearestNeighborTSP(station, currentBatch);
          
          // Build coordinates for route
          const routeCoords: [number, number][] = [
            [station.lat, station.lng],
            ...optimizedBatch.map(b => [b.lat, b.lng] as [number, number]),
            [station.lat, station.lng]
          ];
          
          // Get OSRM route
          const osrmRoute = await getOSRMRoute(routeCoords);
          
          // Calculate distance
          let totalDist = 0;
          for (let i = 0; i < routeCoords.length - 1; i++) {
            totalDist += haversineDistance(
              routeCoords[i][0], routeCoords[i][1],
              routeCoords[i+1][0], routeCoords[i+1][1]
            );
          }
          
          routes.push({
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
            estimatedTime: Math.round((totalDist / 25) * 60), // Assuming 25 km/h average speed
            coordinates: osrmRoute
          });
        }
        
        currentBatch = [bin];
        currentLoad = (bin.currentLevel / 100) * bin.capacity * 0.5;
      }
    }
    
    // Handle remaining batch
    if (currentBatch.length > 0) {
      const optimizedBatch = nearestNeighborTSP(station, currentBatch);
      
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
      
      routes.push({
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
        estimatedTime: Math.round((totalDist / 25) * 60),
        coordinates: osrmRoute
      });
    }
    
    satIndex++;
  }
  
  // Step 4: Generate Truck routes (compact stations -> dumpyards)
  let truckIndex = 0;
  
  for (const [dumpyardId, assignedStations] of stationAssignments) {
    if (assignedStations.length === 0) continue;
    
    const dumpyard = dumpyards.find(d => d.id === dumpyardId)!;
    const truck = activeTrucks[truckIndex % activeTrucks.length];
    
    // Optimize station visit order
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
        routeCoords[i+1][0], routeCoords[i+1][1]
      );
    }
    
    routes.push({
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
      estimatedTime: Math.round((totalDist / 35) * 60), // Trucks faster on highways
      coordinates: osrmRoute
    });
    
    truckIndex++;
  }
  
  return routes;
}

// Parse Excel data
export interface ExcelData {
  bins: SmartBin[];
  stations: CompactStation[];
  dumpyards: Dumpyard[];
  sats: Vehicle[];
  trucks: Vehicle[];
}

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
            area: String(row[6]) || 'Unknown'
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
