import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Database, SmartBin, CompactStation, Dumpyard, Vehicle, OptimizedRoute } from '@/types';
import initialData from '@/data/database.json';

interface DataContextType {
  data: Database;
  updateData: (newData: Database) => void;
  addSmartBin: (bin: SmartBin) => void;
  removeSmartBin: (id: string) => void;
  updateBinLevel: (id: string, level: number) => void;
  addCompactStation: (station: CompactStation) => void;
  removeCompactStation: (id: string) => void;
  updateStationLevel: (id: string, level: number) => void;
  addDumpyard: (dumpyard: Dumpyard) => void;
  removeDumpyard: (id: string) => void;
  updateDumpyardLevel: (id: string, level: number) => void;
  addTruck: (truck: Vehicle) => void;
  removeTruck: (id: string) => void;
  updateTruckStatus: (id: string, status: Vehicle['status']) => void;
  addSAT: (sat: Vehicle) => void;
  removeSAT: (id: string) => void;
  updateSATStatus: (id: string, status: Vehicle['status']) => void;
  routes: OptimizedRoute[];
  setRoutes: (routes: OptimizedRoute[]) => void;
  isGeneratingRoutes: boolean;
  setIsGeneratingRoutes: (value: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Database>(initialData as Database);
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [isGeneratingRoutes, setIsGeneratingRoutes] = useState(false);

  const updateData = (newData: Database) => {
    setData(newData);
  };

  const addSmartBin = (bin: SmartBin) => {
    setData(prev => ({
      ...prev,
      smartBins: [...prev.smartBins, bin]
    }));
  };

  const removeSmartBin = (id: string) => {
    setData(prev => ({
      ...prev,
      smartBins: prev.smartBins.filter(bin => bin.id !== id)
    }));
  };

  const updateBinLevel = (id: string, level: number) => {
    setData(prev => ({
      ...prev,
      smartBins: prev.smartBins.map(bin =>
        bin.id === id ? { ...bin, currentLevel: level } : bin
      )
    }));
  };

  const addCompactStation = (station: CompactStation) => {
    setData(prev => ({
      ...prev,
      compactStations: [...prev.compactStations, station]
    }));
  };

  const removeCompactStation = (id: string) => {
    setData(prev => ({
      ...prev,
      compactStations: prev.compactStations.filter(station => station.id !== id)
    }));
  };

  const updateStationLevel = (id: string, level: number) => {
    setData(prev => ({
      ...prev,
      compactStations: prev.compactStations.map(station =>
        station.id === id ? { ...station, currentLevel: level } : station
      )
    }));
  };

  const addDumpyard = (dumpyard: Dumpyard) => {
    setData(prev => ({
      ...prev,
      dumpyards: [...prev.dumpyards, dumpyard]
    }));
  };

  const removeDumpyard = (id: string) => {
    setData(prev => ({
      ...prev,
      dumpyards: prev.dumpyards.filter(dy => dy.id !== id)
    }));
  };

  const updateDumpyardLevel = (id: string, level: number) => {
    setData(prev => ({
      ...prev,
      dumpyards: prev.dumpyards.map(dy =>
        dy.id === id ? { ...dy, currentLevel: level } : dy
      )
    }));
  };

  const addTruck = (truck: Vehicle) => {
    setData(prev => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        trucks: [...prev.vehicles.trucks, truck]
      }
    }));
  };

  const removeTruck = (id: string) => {
    setData(prev => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        trucks: prev.vehicles.trucks.filter(t => t.id !== id)
      }
    }));
  };

  const updateTruckStatus = (id: string, status: Vehicle['status']) => {
    setData(prev => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        trucks: prev.vehicles.trucks.map(t => 
          t.id === id ? { ...t, status } : t
        )
      }
    }));
  };

  const addSAT = (sat: Vehicle) => {
    setData(prev => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        sats: [...prev.vehicles.sats, sat]
      }
    }));
  };

  const removeSAT = (id: string) => {
    setData(prev => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        sats: prev.vehicles.sats.filter(s => s.id !== id)
      }
    }));
  };

  const updateSATStatus = (id: string, status: Vehicle['status']) => {
    setData(prev => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        sats: prev.vehicles.sats.map(s => 
          s.id === id ? { ...s, status } : s
        )
      }
    }));
  };

  return (
    <DataContext.Provider value={{
      data,
      updateData,
      addSmartBin,
      removeSmartBin,
      updateBinLevel,
      addCompactStation,
      removeCompactStation,
      updateStationLevel,
      addDumpyard,
      removeDumpyard,
      updateDumpyardLevel,
      addTruck,
      removeTruck,
      updateTruckStatus,
      addSAT,
      removeSAT,
      updateSATStatus,
      routes,
      setRoutes,
      isGeneratingRoutes,
      setIsGeneratingRoutes
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
