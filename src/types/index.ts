export type UserRole = 'admin' | 'driver';

export type VehicleStatus = 'active' | 'off-duty' | 'in-route';

export interface Vehicle {
  id: string;
  capacity: number;
  status: VehicleStatus;
  driver: string;
}

export interface Truck extends Vehicle {
  type: 'truck';
}

export interface SAT extends Vehicle {
  type: 'sat';
}

export interface SmartBin {
  id: string;
  lat: number;
  lng: number;
  capacity: number;
  currentLevel: number;
  area: string;
}

export interface CompactStation {
  id: string;
  lat: number;
  lng: number;
  capacity: number;
  currentLevel: number;
  area: string;
}

export interface Dumpyard {
  id: string;
  lat: number;
  lng: number;
  capacity: number;
  currentLevel: number;
  name: string;
}

export interface User {
  role: UserRole;
  vehicleId?: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  type: 'smartbin' | 'compact-station' | 'dumpyard';
  id: string;
  action: 'pickup' | 'dropoff';
}

export interface OptimizedRoute {
  vehicleId: string;
  vehicleType: 'truck' | 'sat';
  route: RoutePoint[];
  totalDistance: number;
  estimatedTime: number;
  coordinates: [number, number][];
}

export interface Database {
  vehicles: {
    trucks: Vehicle[];
    sats: Vehicle[];
  };
  smartBins: SmartBin[];
  compactStations: CompactStation[];
  dumpyards: Dumpyard[];
}
