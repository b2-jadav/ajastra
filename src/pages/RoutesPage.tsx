import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Route, Play, Loader2, FileSpreadsheet, 
  Truck, Package, Clock, MapPin, AlertCircle, CheckCircle2,
  Download, Search, ChevronDown, ChevronUp, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { generateOptimizedRoutes, parseExcelData, parseMultiSheetExcel, calculateTotalTime } from '@/utils/routeOptimizer';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function RoutesPage() {
  const { user } = useAuth();
  const { data, routes, setRoutes, isGeneratingRoutes, setIsGeneratingRoutes, updateData } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  // Get driver's route
  const driverRoute = user?.role === 'driver' && user?.vehicleId
    ? routes.find(r => r.vehicleId.toLowerCase() === user.vehicleId?.toLowerCase())
    : null;

  // Get assigned bins for driver
  const assignedBins = driverRoute?.route
    .filter(point => point.type === 'smartbin')
    .map(point => point.id) || [];

  const handleGenerateRoutes = async () => {
    setIsGeneratingRoutes(true);
    setRoutes([]); // Clear existing routes
    
    try {
      toast.info('Generating optimized routes...', { duration: 2000 });
      
      const optimizedRoutes = await generateOptimizedRoutes({
        bins: data.smartBins,
        stations: data.compactStations,
        dumpyards: data.dumpyards,
        sats: data.vehicles.sats,
        trucks: data.vehicles.trucks,
        onRouteGenerated: (route, allRoutes) => {
          // Progressive update - show routes as they're generated
          setRoutes([...allRoutes]);
        }
      });
      
      setRoutes(optimizedRoutes);
      toast.success(`Generated ${optimizedRoutes.length} optimized routes!`);
    } catch (error) {
      console.error('Route generation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate routes');
    } finally {
      setIsGeneratingRoutes(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadStatus('uploading');
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      (window as any).XLSX = XLSX;
      
      let parsedData;
      
      const hasMultiSheets = workbook.SheetNames.some((name: string) => 
        name.toLowerCase().includes('sample') || 
        name.toLowerCase().includes('gvp') ||
        name.toLowerCase().includes('fleet') ||
        name.toLowerCase().includes('sctp')
      );
      
      if (hasMultiSheets || workbook.SheetNames.length > 1) {
        parsedData = parseMultiSheetExcel(workbook);
      } else {
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        parsedData = parseExcelData(jsonData);
      }
      
      const totalImported = 
        (parsedData.bins?.length || 0) + 
        (parsedData.stations?.length || 0) + 
        (parsedData.dumpyards?.length || 0) + 
        (parsedData.sats?.length || 0) + 
        (parsedData.trucks?.length || 0);
      
      if (totalImported === 0) {
        toast.error('No valid data found.');
        setUploadStatus('error');
        setTimeout(() => setUploadStatus('idle'), 3000);
        return;
      }
      
      updateData({
        ...data,
        smartBins: parsedData.bins || [],
        compactStations: parsedData.stations || [],
        dumpyards: parsedData.dumpyards?.length ? parsedData.dumpyards : data.dumpyards,
        vehicles: {
          trucks: parsedData.trucks || [],
          sats: parsedData.sats || []
        }
      });
      
      setUploadStatus('success');
      toast.success(`Imported: ${parsedData.bins?.length || 0} GVPs, ${parsedData.stations?.length || 0} stations, ${parsedData.sats?.length || 0} SATs, ${parsedData.trucks?.length || 0} trucks`);
      
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (error) {
      console.error('File upload failed:', error);
      setUploadStatus('error');
      toast.error('Failed to parse Excel file.');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleExcel = () => {
    const gvpData = [
      ['Locations of GVPs'],
      [],
      ['S No.', 'Location of the GVPs', 'Longitude', 'Latitude', 'Estimated Waste'],
      [1, 'Hitech City', 78.3867, 17.4435, 1.10],
      [2, 'Madhapur', 78.3960, 17.4486, 0.85],
      [3, 'Kondapur', 78.3619, 17.4615, 1.25]
    ];
    
    const fleetData = [
      ['Fleet Data'],
      [],
      ['S No.', 'Vehicle Particulars', 'GVW (Gross Vehicle Weight)', 'Payload Capacity (in Tonnes)', 'No. of Vehicles Available'],
      [1, 'Mini Tipper', '7 T', 4.00, 5],
      [2, 'Mini Tipper', '11 T', 8.00, 3],
      [3, 'Compactor Truck', '28 T', 16.00, 2]
    ];
    
    const sctpData = [
      ['Locations of Transfer Stations'],
      [],
      ['S.No', 'Transferstation', 'Coordinates'],
      [1, 'Nagole', '17°23\'23.38"N, 78°33\'32.79"E'],
      [2, 'Mallapur', '17°26\'43.89"N, 78°34\'28.81"E'],
      [3, 'Saket', '17°29\'43.13"N, 78°34\'47.31"E']
    ];
    
    const wb = XLSX.utils.book_new();
    
    const wsGvp = XLSX.utils.aoa_to_sheet(gvpData);
    XLSX.utils.book_append_sheet(wb, wsGvp, 'Sample Data');
    
    const wsFleet = XLSX.utils.aoa_to_sheet(fleetData);
    XLSX.utils.book_append_sheet(wb, wsFleet, 'Fleet Details');
    
    const wsSctp = XLSX.utils.aoa_to_sheet(sctpData);
    XLSX.utils.book_append_sheet(wb, wsSctp, 'SCTP');
    
    XLSX.writeFile(wb, 'waste_management_template.xlsx');
    toast.success('Sample template downloaded!');
  };

  const toggleRouteExpand = (vehicleId: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  // Filter routes by search query (admin only) - strict exact match only
  const filteredRoutes = user?.role === 'admin' && searchQuery
    ? routes.filter(r => r.vehicleId.toLowerCase() === searchQuery.toLowerCase().trim())
    : routes;

  const totalDistance = routes.reduce((sum, r) => sum + r.totalDistance, 0);
  const timeCalc = calculateTotalTime(routes);
  const satRoutes = routes.filter(r => r.vehicleType === 'sat');
  const truckRoutes = routes.filter(r => r.vehicleType === 'truck');

  // Driver view
  if (user?.role === 'driver') {
    return (
      <div className="h-full overflow-auto p-6 scrollbar-thin">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Route</h1>
          <p className="text-muted-foreground">Vehicle: {user.vehicleId}</p>
        </div>

        {driverRoute ? (
          <div className="space-y-6">
            {/* Route Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Distance</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{driverRoute.totalDistance} km</p>
              </div>
              
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Est. Time</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{driverRoute.estimatedTime} min</p>
              </div>
              
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">Stops</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{assignedBins.length}</p>
              </div>
            </motion.div>

            {/* Assigned Bins Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-6"
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Assigned Bins</h2>
              <div className="grid gap-2 max-h-64 overflow-auto scrollbar-thin">
                {assignedBins.map((binId, index) => {
                  const bin = data.smartBins.find(b => b.id === binId);
                  return (
                    <div key={binId} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                      <span className="font-medium text-foreground">{binId}</span>
                      {bin && (
                        <span className="text-sm text-muted-foreground">- {bin.area}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Route className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No route assigned yet.</p>
            <p className="text-sm text-muted-foreground/70">
              Please wait for an admin to generate routes.
            </p>
          </motion.div>
        )}
      </div>
    );
  }

  // Admin view
  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Route Optimization</h1>
        <p className="text-muted-foreground">AI-powered route generation for waste collection</p>
      </div>

      <div className="grid gap-6">
        {/* Generate Routes Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/20">
              <Route className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Generate Optimized Routes</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Route Generation */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The AI will optimize routes based on:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  SATs collect from smart bins → compact stations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Trucks collect from compact stations → dumpyards
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Vehicle capacity constraints & fuel optimization
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  OSRM road network integration
                </li>
              </ul>
              
              
              <Button 
                onClick={handleGenerateRoutes}
                disabled={isGeneratingRoutes}
                variant="glow"
                size="xl"
                className="w-full mt-4"
              >
                {isGeneratingRoutes ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Optimizing Routes...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Generate Routes
                  </>
                )}
              </Button>
              
              {routes.length > 0 && (
                <Button 
                  onClick={() => {
                    setRoutes([]);
                    toast.success('All routes cleared');
                  }}
                  variant="outline"
                  size="lg"
                  className="w-full mt-2"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Clear Routes
                </Button>
              )}
            </div>

            {/* Excel Upload */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload Excel with sheets: "Sample Data" (GVPs), "Fleet Details", "SCTP" (stations)
              </p>
              
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-upload"
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                  {uploadStatus === 'uploading' ? (
                    <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                  ) : uploadStatus === 'success' ? (
                    <CheckCircle2 className="w-12 h-12 mx-auto text-success" />
                  ) : uploadStatus === 'error' ? (
                    <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                  ) : (
                    <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground" />
                  )}
                  <p className="mt-2 text-sm text-foreground font-medium">
                    {uploadStatus === 'uploading' ? 'Processing...' :
                     uploadStatus === 'success' ? 'Data Imported!' :
                     uploadStatus === 'error' ? 'Upload Failed' :
                     'Drop Excel file here or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .xlsx, .xls, .csv
                  </p>
                </label>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={downloadSampleExcel}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Sample Template
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Route Statistics */}
        {routes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Route className="w-4 h-4" />
                <span className="text-sm">Total Routes</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{routes.length}</p>
            </div>
            
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Total Distance</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalDistance.toFixed(1)} km</p>
            </div>
            
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Est. Time</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{timeCalc.hours} hrs</p>
            </div>
            
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Truck className="w-4 h-4" />
                <span className="text-sm">Vehicles</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {satRoutes.length} SAT, {truckRoutes.length} Truck
              </p>
            </div>
          </motion.div>
        )}

        {/* Route List with Search */}
        {routes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Generated Routes</h2>
              
              {/* Search for Admin */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search vehicle ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-auto scrollbar-thin">
              {filteredRoutes.map((route, index) => {
                // SATs collect from bins, Trucks collect from stations
                const stopCount = route.vehicleType === 'sat' 
                  ? route.route.filter(p => p.type === 'smartbin').length
                  : route.route.filter(p => p.type === 'compact-station').length;
                const stopLabel = route.vehicleType === 'sat' ? 'bin stops' : 'station stops';
                const isExpanded = expandedRoutes.has(route.vehicleId);
                
                return (
                  <Collapsible key={`${route.vehicleId}-${index}`} open={isExpanded}>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <CollapsibleTrigger 
                        className="flex items-center justify-between w-full"
                        onClick={() => toggleRouteExpand(route.vehicleId)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${route.vehicleType === 'sat' ? 'bg-sat/20' : 'bg-truck/20'}`}>
                            {route.vehicleType === 'sat' ? (
                              <Package className="w-5 h-5 text-sat" />
                            ) : (
                              <Truck className="w-5 h-5 text-truck" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-foreground">{route.vehicleId}</p>
                            <p className="text-sm text-muted-foreground">
                              {stopCount} {stopLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{route.totalDistance} km</p>
                            <p className="text-xs text-muted-foreground">{route.estimatedTime} min</p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-sm font-medium text-muted-foreground mb-2">Stops:</p>
                          <div className="grid gap-1 max-h-32 overflow-auto scrollbar-thin">
                            {route.route.map((point, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-4">{i + 1}.</span>
                                <span className={`${
                                  point.type === 'smartbin' ? 'text-smartbin' :
                                  point.type === 'compact-station' ? 'text-compact-station' : 'text-dumpyard'
                                }`}>
                                  {point.id}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({point.action})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {routes.length === 0 && !isGeneratingRoutes && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Route className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No routes generated yet.</p>
            <p className="text-sm text-muted-foreground/70">
              Click the generate button above to create optimized routes.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}