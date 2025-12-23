import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Package, Building2, MapPin, Filter } from 'lucide-react';
import HyderabadMap from '@/components/HyderabadMap';
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
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hyderabad Overview</h1>
            <p className="text-muted-foreground text-sm">Real-time waste management map</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
          </div>
        </div>
        
        {/* Filter Checkboxes */}
        <div className="flex flex-wrap gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-xl glass"
            >
              <Checkbox 
                id={stat.label} 
                checked={stat.checked}
                onCheckedChange={(checked) => stat.onCheck(checked as boolean)}
                className="data-[state=checked]:bg-primary"
              />
              <Label 
                htmlFor={stat.label} 
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{stat.label}</span>
                  <span className={`ml-2 text-sm font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              </Label>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 p-4">
        <motion.div 
          className="h-full rounded-xl overflow-hidden border border-border shadow-xl"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <HyderabadMap 
            showSmartBins={showSmartBins}
            showCompactStations={showCompactStations}
            showDumpyards={showDumpyards}
          />
        </motion.div>
      </div>
    </div>
  );
}
