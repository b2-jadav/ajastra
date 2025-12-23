import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Route, Play, Loader2, FileSpreadsheet, Upload, 
  Truck, Package, Clock, MapPin, AlertCircle, CheckCircle2,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { generateOptimizedRoutes, parseExcelData } from '@/utils/routeOptimizer';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function RoutesPage() {
  const { user } = useAuth();
  const { data, routes, setRoutes, isGeneratingRoutes, setIsGeneratingRoutes, updateData } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handleGenerateRoutes = async () => {
    setIsGeneratingRoutes(true);
    
    try {
      toast.info('Generating optimized routes...', { duration: 2000 });
      
      const optimizedRoutes = await generateOptimizedRoutes({
        bins: data.smartBins,
        stations: data.compactStations,
        dumpyards: data.dumpyards,
        sats: data.vehicles.sats,
        trucks: data.vehicles.trucks
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
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      const parsedData = parseExcelData(jsonData);
      
      // Merge with existing data
      updateData({
        ...data,
        smartBins: [...data.smartBins, ...(parsedData.bins || [])],
        compactStations: [...data.compactStations, ...(parsedData.stations || [])],
        dumpyards: [...data.dumpyards, ...(parsedData.dumpyards || [])],
        vehicles: {
          trucks: [...data.vehicles.trucks, ...(parsedData.trucks || [])],
          sats: [...data.vehicles.sats, ...(parsedData.sats || [])]
        }
      });
      
      setUploadStatus('success');
      toast.success(`Imported: ${parsedData.bins?.length || 0} bins, ${parsedData.stations?.length || 0} stations, ${parsedData.sats?.length || 0} SATs, ${parsedData.trucks?.length || 0} trucks`);
      
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
    const sampleData = [
      ['Type', 'ID', 'Lat', 'Lng', 'Capacity', 'CurrentLevel', 'Area/Name'],
      ['bin', 'BIN001', '17.385', '78.4867', '100', '85', 'Hitech City'],
      ['station', 'CS001', '17.405', '78.455', '2000', '800', 'Ameerpet'],
      ['dumpyard', 'DY001', '17.52', '78.31', '50000', '25000', 'Jawaharnagar'],
      ['sat', 'SAT001', '', '', '500', '', ''],
      ['truck', 'T001', '', '', '5000', '', '']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'waste_management_template.xlsx');
    toast.success('Sample template downloaded!');
  };

  const totalDistance = routes.reduce((sum, r) => sum + r.totalDistance, 0);
  const totalTime = routes.reduce((sum, r) => sum + r.estimatedTime, 0);
  const satRoutes = routes.filter(r => r.vehicleType === 'sat');
  const truckRoutes = routes.filter(r => r.vehicleType === 'truck');

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
                    Vehicle capacity constraints
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
              </div>

              {/* Excel Upload */}
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload an Excel file to import bulk data:
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
        {routes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">Generated Routes</h2>
            
            <div className="space-y-3 max-h-96 overflow-auto scrollbar-thin">
              {routes.map((route, index) => (
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
        {routes.length === 0 && !isGeneratingRoutes && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Route className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No routes generated yet.</p>
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
