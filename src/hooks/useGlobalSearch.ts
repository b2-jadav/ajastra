import { useCallback } from 'react';
import { useData } from '@/context/DataContext';

export interface SearchResult {
  type: 'bin' | 'vehicle' | 'station' | 'dumpyard';
  id: string;
  lat: number;
  lng: number;
  name?: string;
}

export function useGlobalSearch() {
  const { data } = useData();

  const search = useCallback((query: string): SearchResult | null => {
    if (!query.trim()) return null;

    const searchTerm = query.toUpperCase().trim();

    // Search in smart bins
    const bin = data.smartBins.find(b => b.id.toUpperCase().includes(searchTerm));
    if (bin) {
      return {
        type: 'bin',
        id: bin.id,
        lat: bin.lat,
        lng: bin.lng,
        name: bin.id
      };
    }

    // Search in vehicles (trucks)
    const truck = data.vehicles.trucks.find(t => t.id.toUpperCase().includes(searchTerm));
    if (truck) {
      return {
        type: 'vehicle',
        id: truck.id,
        lat: 17.3850,
        lng: 78.4867,
        name: truck.id
      };
    }

    // Search in vehicles (SATs)
    const sat = data.vehicles.sats.find(s => s.id.toUpperCase().includes(searchTerm));
    if (sat) {
      return {
        type: 'vehicle',
        id: sat.id,
        lat: 17.3850,
        lng: 78.4867,
        name: sat.id
      };
    }

    // Search in compact stations
    const station = data.compactStations.find(s => s.id.toUpperCase().includes(searchTerm));
    if (station) {
      return {
        type: 'station',
        id: station.id,
        lat: station.lat,
        lng: station.lng,
        name: station.id
      };
    }

    // Search in dumpyards
    const dumpyard = data.dumpyards.find(d => d.id.toUpperCase().includes(searchTerm) || d.name.toUpperCase().includes(searchTerm));
    if (dumpyard) {
      return {
        type: 'dumpyard',
        id: dumpyard.id,
        lat: dumpyard.lat,
        lng: dumpyard.lng,
        name: dumpyard.name
      };
    }

    return null;
  }, [data]);

  return { search };
}
