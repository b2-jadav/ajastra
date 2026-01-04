import React, { useEffect, useState } from 'react';
import HyderabadMap from './HyderabadMap';

interface MapWrapperProps {
  showSmartBins: boolean;
  showCompactStations: boolean;
  showDumpyards: boolean;
  driverVehicleId?: string;
}

export default function MapWrapper(props: MapWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-secondary/50 rounded-xl">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return <HyderabadMap {...props} />;
}
