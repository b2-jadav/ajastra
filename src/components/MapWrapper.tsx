import React, { Suspense, lazy } from 'react';

// Lazy load the map component to avoid SSR/hydration issues with Leaflet
const HyderabadMap = lazy(() => import('./HyderabadMap'));

interface MapWrapperProps {
  showSmartBins: boolean;
  showCompactStations: boolean;
  showDumpyards: boolean;
}

export default function MapWrapper(props: MapWrapperProps) {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-secondary/50 rounded-xl">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    }>
      <HyderabadMap {...props} />
    </Suspense>
  );
}
