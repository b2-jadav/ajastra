import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Route, Play, Loader2, FileSpreadsheet, Upload, 
  Truck, Package, Clock, MapPin, AlertCircle, CheckCircle2,
  Download, Scale, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { generateOptimizedRoutes, parseExcelData, parseMultiSheetExcel } from '@/utils/routeOptimizer';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function RoutesPage() {
  const { user } = useAuth();
  const { data, routes, setRoutes, isGeneratingRoutes, setIsGeneratingRoutes, updateData } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [balancedWorkload, setBalancedWorkload] = useState(false);

  // Filter routes for drivers - they only see their own vehicle's routes
  const displayedRoutes = useMemo(() => {
    if (user?.role === 'driver' && user.vehicleId) {
      return routes.filter(r => r.vehicleId === user.vehicleId);
    }
    return routes;
  }, [routes, user]);

  const handleClearRoutes = () => {
    setRoutes([]);
    toast.success('All routes have been cleared');
  };

  const handleGenerateRoutes = async () => {
    setIsGeneratingRoutes(true);
    
    try {
      toast.info('Generating optimized routes...', { duration: 2000 });
      
      const optimizedRoutes = await generateOptimizedRoutes({
        bins: data.smartBins,
        stations: data.compactStations,
        dumpyards: data.dumpyards,
        sats: data.vehicles.sats,
        trucks: data.vehicles.trucks,
        balancedWorkload
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
      
      // Expose XLSX to window for multi-sheet parser
      (window as any).XLSX = XLSX;
      
      console.log('Excel sheets:', workbook.SheetNames);
      
      let parsedData;
      
      // Check if multi-sheet format (GVPs, Fleet Details, SCTP)
      const hasMultiSheets = workbook.SheetNames.some((name: string) => 
        name.toLowerCase().includes('sample') || 
        name.toLowerCase().includes('gvp') ||
        name.toLowerCase().includes('fleet') ||
        name.toLowerCase().includes('sctp')
      );
      
      if (hasMultiSheets || workbook.SheetNames.length > 1) {
        console.log('Using multi-sheet parser');
        parsedData = parseMultiSheetExcel(workbook);
      } else {
        // Legacy single-sheet format
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        console.log('Excel raw data:', jsonData);
        parsedData = parseExcelData(jsonData);
      }
      
      console.log('Parsed data:', parsedData);
      
      const totalImported = 
        (parsedData.bins?.length || 0) + 
        (parsedData.stations?.length || 0) + 
        (parsedData.dumpyards?.length || 0) + 
        (parsedData.sats?.length || 0) + 
        (parsedData.trucks?.length || 0);
      
      if (totalImported === 0) {
        toast.error('No valid data found. Check that sheets are named: "Sample Data" (GVPs), "Fleet Details", "SCTP" (stations).');
        setUploadStatus('error');
        setTimeout(() => setUploadStatus('idle'), 3000);
        return;
      }
      
      // Replace existing data with imported data (clear old data first)
      updateData({
        ...data,
        smartBins: parsedData.bins || [],
        compactStations: parsedData.stations || [],
        dumpyards: parsedData.dumpyards || [],
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
      toast.error('Failed to parse Excel file. Please check the format.');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleExcel = () => {
    // GVPs sheet (dustbins)
    const gvpData = [
      ['Locations of GVPs'],
      [],
      ['S No.', 'Location of the GVPs', 'Longitude', 'Latitude', 'Estimated Waste'],
      [1, 'Hitech City', 78.3867, 17.4435, 1.10],
      [2, 'Madhapur', 78.3960, 17.4486, 0.85],
      [3, 'Kondapur', 78.3619, 17.4615, 1.25]
    ];
    
    // Fleet Details sheet
    const fleetData = [
      ['Fleet Data'],
      [],
      ['S No.', 'Vehicle Particulars', 'GVW (Gross Vehicle Weight)', 'Payload Capacity (in Tonnes)', 'No. of Vehicles Available'],
      [1, 'Mini Tipper', '7 T', 4.00, 5],
      [2, 'Mini Tipper', '11 T', 8.00, 3],
      [3, 'Compactor Truck', '28 T', 16.00, 2]
    ];
    
    // SCTP sheet (Transfer Stations)
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

  const totalDistance = displayedRoutes.reduce((sum, r) => sum + r.totalDistance, 0);
  const totalTime = displayedRoutes.reduce((sum, r) => sum + r.estimatedTime, 0);
  const satRoutes = displayedRoutes.filter(r => r.vehicleType === 'sat');
  const truckRoutes = displayedRoutes.filter(r => r.vehicleType === 'truck');

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Route Optimization</h1>
        <p className="text-muted-foreground">AI-powered route generation for waste collection</p>
      </div>

      <div className="grid gap-6">
        {/* Generate Routes Section */}
        {user?.role === 'admin' && (
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
                
                {/* Balanced Workload Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-primary" />
                    <div>
                      <Label htmlFor="balanced-workload" className="font-medium cursor-pointer">
                        Balanced Workload
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Distribute dustbins equally across vehicles
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="balanced-workload"
                    checked={balancedWorkload}
                    onCheckedChange={setBalancedWorkload}
                  />
                </div>
                
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
                    onClick={handleClearRoutes}
                    variant="outline"
                    size="lg"
                    className="w-full mt-2 text-destructive hover:bg-destructive/10"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Clear All Routes
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
        )}

        {/* Route Statistics */}
        {displayedRoutes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Route className="w-4 h-4" />
                <span className="text-sm">{user?.role === 'driver' ? 'Your Routes' : 'Total Routes'}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{displayedRoutes.length}</p>
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
              <p className="text-2xl font-bold text-foreground">{Math.round(totalTime)} min</p>
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

        {/* Route List */}
        {displayedRoutes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {user?.role === 'driver' ? `Routes for ${user.vehicleId}` : 'Generated Routes'}
            </h2>
            
            <div className="space-y-3 max-h-96 overflow-auto scrollbar-thin">
              {displayedRoutes.map((route, index) => (
                <div key={`${route.vehicleId}-${index}`} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${route.vehicleType === 'sat' ? 'bg-sat/20' : 'bg-truck/20'}`}>
                      {route.vehicleType === 'sat' ? (
                        <Package className="w-5 h-5 text-sat" />
                      ) : (
                        <Truck className="w-5 h-5 text-truck" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{route.vehicleId}</p>
                      <p className="text-sm text-muted-foreground">
                        {route.route.length - 2} stops
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{route.totalDistance} km</p>
                    <p className="text-xs text-muted-foreground">{route.estimatedTime} min</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {displayedRoutes.length === 0 && !isGeneratingRoutes && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Route className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {user?.role === 'driver' 
                ? 'No routes assigned to your vehicle yet.'
                : 'No routes generated yet.'}
            </p>
            <p className="text-sm text-muted-foreground/70">
              {user?.role === 'admin' 
                ? 'Click the generate button above to create optimized routes.'
                : 'Routes will appear here once an admin generates them.'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
