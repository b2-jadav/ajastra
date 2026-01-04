import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Building2, MapPin, Filter } from 'lucide-react';
import MapWrapper from '@/components/MapWrapper';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useData } from '@/context/DataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function HomePage() {
  const { data } = useData();
  const [showSmartBins, setShowSmartBins] = useState(true);
  const [showCompactStations, setShowCompactStations] = useState(true);
  const [showDumpyards, setShowDumpyards] = useState(true);

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
    <div className="w-full h-full flex flex-col bg-background p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* Header with filters */}
      <motion.div
        className="space-y-2 sm:space-y-4 mb-2 sm:mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            Hyderabad Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time waste management map
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <Filter className="w-4 sm:w-5 h-4 sm:h-5 text-muted-foreground" />
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Filters</span>
        </div>

        {/* Filter Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Checkbox
                id={`stat-${index}`}
                checked={stat.checked}
                onCheckedChange={(checked) => stat.onCheck(checked as boolean)}
                className="data-[state=checked]:bg-primary"
              />
              <Label htmlFor={`stat-${index}`} className="flex-1 cursor-pointer text-xs sm:text-sm">
                <span className="font-medium">{stat.label}</span>
                <span className="ml-1 text-muted-foreground">({stat.value})</span>
              </Label>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Map Container */}
      <motion.div
        className="flex-1 rounded-lg overflow-hidden border border-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <ErrorBoundary fallback={<div>Error loading map</div>} onError={(e) => console.error('Map render error:', e)}>
          <MapWrapper showSmartBins={showSmartBins} showCompactStations={showCompactStations} showDumpyards={showDumpyards} />
        </ErrorBoundary>
      </motion.div>
    </div>
  );
}
