import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Building2, MapPin, Filter, Route, ChevronDown } from 'lucide-react';
import MapWrapper from '@/components/MapWrapper';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function HomePage() {
  const { data, routes } = useData();
  const { user } = useAuth();
  const [showSmartBins, setShowSmartBins] = useState(true);
  const [showCompactStations, setShowCompactStations] = useState(true);
  const [showDumpyards, setShowDumpyards] = useState(true);

  // Get driver's route if logged in as driver
  const driverRoute = user?.role === 'driver' && user?.vehicleId
    ? routes.find(r => r.vehicleId.toLowerCase() === user.vehicleId?.toLowerCase())
    : null;

  // Get assigned bin IDs for this driver
  const assignedBinIds = driverRoute?.route
    .filter(point => point.type === 'smartbin')
    .map(point => point.id) || [];

  const stats = [
    { 
      label: 'Smart Bins', 
      value: data.smartBins.length, 
      icon: Trash2, 
      color: 'text-smartbin',
      bgColor: 'bg-smartbin/10',
      checked: showSmartBins,
      onCheck: setShowSmartBins
    },
    { 
      label: 'Compact Stations', 
      value: data.compactStations.length, 
      icon: Building2, 
      color: 'text-compact-station',
      bgColor: 'bg-compact-station/10',
      checked: showCompactStations,
      onCheck: setShowCompactStations
    },
    { 
      label: 'Dumpyards', 
      value: data.dumpyards.length, 
      icon: MapPin, 
      color: 'text-dumpyard',
      bgColor: 'bg-dumpyard/10',
      checked: showDumpyards,
      onCheck: setShowDumpyards
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="p-3 md:p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {user?.role === 'driver' ? `Route for ${user.vehicleId}` : 'Hyderabad Overview'}
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              {user?.role === 'driver' 
                ? (driverRoute ? `${assignedBinIds.length} bins assigned` : 'No route assigned yet')
                : 'Real-time waste management map'}
            </p>
          </div>
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="text-sm">Filters</span>
            </div>
          )}
        </div>
        
        {/* Filter Checkboxes - Only for admin */}
        {user?.role === 'admin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl glass"
              >
                <Checkbox 
                  id={stat.label} 
                  checked={stat.checked}
                  onCheckedChange={(checked) => stat.onCheck(checked as boolean)}
                  className="data-[state=checked]:bg-primary"
                />
                <Label 
                  htmlFor={stat.label} 
                  className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                >
                  <div className={`p-1 md:p-1.5 rounded-lg ${stat.bgColor} shrink-0`}>
                    <stat.icon className={`w-3 h-3 md:w-4 md:h-4 ${stat.color}`} />
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 min-w-0">
                    <span className="text-xs md:text-sm font-medium text-foreground truncate">{stat.label}</span>
                    <span className={`text-xs md:text-sm font-bold ${stat.color} shrink-0`}>{stat.value}</span>
                  </div>
                </Label>
              </motion.div>
            ))}
          </div>
        )}

        {/* Driver info card */}
        {user?.role === 'driver' && driverRoute && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl glass"
          >
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/20">
              <Route className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs md:text-sm font-medium text-foreground">
                Distance: {driverRoute.totalDistance} km
              </p>
              <p className="text-xs text-muted-foreground">
                Est. Time: {driverRoute.estimatedTime} min
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 p-2 md:p-4">
        <motion.div 
          className="h-full rounded-xl overflow-hidden border border-border shadow-xl"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ErrorBoundary
            onError={(e) => console.error('Map render error:', e)}
          >
            <MapWrapper 
              showSmartBins={user?.role === 'admin' ? showSmartBins : true}
              showCompactStations={user?.role === 'admin' ? showCompactStations : true}
              showDumpyards={user?.role === 'admin' ? showDumpyards : true}
              driverVehicleId={user?.role === 'driver' ? user.vehicleId : undefined}
            />
          </ErrorBoundary>
        </motion.div>
      </div>
    </div>
  );
}
