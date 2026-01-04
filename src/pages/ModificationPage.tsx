import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Trash2, Truck, Package, Building2, MapPin, 
  Edit2, AlertTriangle, CheckCircle, XCircle, Settings2,
  CheckSquare, Square, Search, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useData } from '@/context/DataContext';
import { Vehicle, SmartBin, CompactStation, Dumpyard } from '@/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Permanent dumpyard IDs that cannot be deleted
const PERMANENT_DUMPYARD_IDS = ['DY001', 'DY002'];

export default function ModificationPage() {
  const { 
    data, 
    addTruck, removeTruck, updateTruckStatus,
    addSAT, removeSAT, updateSATStatus,
    addSmartBin, removeSmartBin, updateBinLevel,
    addCompactStation, removeCompactStation, updateStationLevel,
    addDumpyard, removeDumpyard, updateDumpyardLevel,
    updateData
  } = useData();

  // Form states
  const [newTruck, setNewTruck] = useState({ id: '', capacity: '' });
  const [newSAT, setNewSAT] = useState({ id: '', capacity: '' });
  const [newBin, setNewBin] = useState({ id: '', lat: '', lng: '', capacity: '', area: '', isSmartBin: true });
  const [newStation, setNewStation] = useState({ id: '', lat: '', lng: '', capacity: '', area: '' });
  const [newDumpyard, setNewDumpyard] = useState({ id: '', lat: '', lng: '', capacity: '', name: '' });
  
  // Multi-select states
  const [selectionMode, setSelectionMode] = useState<'none' | 'bins' | 'stations' | 'dumpyards' | 'trucks' | 'sats'>('none');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkFillLevel, setBulkFillLevel] = useState(50);
  const [bulkSmartBin, setBulkSmartBin] = useState(true);
  
  // Global search
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeTab, setActiveTab] = useState('vehicles');

  // Search results - exact match filtering
  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return null;
    
    const query = globalSearch.toLowerCase().trim();
    
    // Exact match: ID must equal query OR query must match complete ID (not partial)
    const exactMatch = (id: string) => {
      const idLower = id.toLowerCase();
      return idLower === query || idLower === query;
    };
    
    // For partial matching, ensure the query matches as a complete segment
    // e.g., "SAT-4T-1" should not match "SAT-4T-10"
    const segmentMatch = (id: string) => {
      const idLower = id.toLowerCase();
      if (idLower === query) return true;
      // Check if query matches the start and is followed by a non-alphanumeric or end
      if (idLower.startsWith(query)) {
        const nextChar = idLower[query.length];
        return !nextChar || !/[a-z0-9]/i.test(nextChar);
      }
      return false;
    };
    
    const bins = data.smartBins.filter(b => segmentMatch(b.id));
    const stations = data.compactStations.filter(s => segmentMatch(s.id));
    const dumpyards = data.dumpyards.filter(d => segmentMatch(d.id) || d.name.toLowerCase().includes(query));
    const trucks = data.vehicles.trucks.filter(t => segmentMatch(t.id));
    const sats = data.vehicles.sats.filter(s => segmentMatch(s.id));
    
    return { bins, stations, dumpyards, trucks, sats };
  }, [globalSearch, data]);

  // Handle clicking a search result to navigate and select
  const handleSearchResultClick = (type: 'bin' | 'station' | 'dumpyard' | 'truck' | 'sat', id: string) => {
    setGlobalSearch(''); // Clear search
    
    // Navigate to appropriate tab and select the item
    if (type === 'bin') {
      setActiveTab('bins');
      setSelectionMode('bins');
      setSelectedItems(new Set([id]));
    } else if (type === 'station' || type === 'dumpyard') {
      setActiveTab('facilities');
      if (type === 'station') {
        setSelectionMode('stations');
      } else {
        setSelectionMode('dumpyards');
      }
      setSelectedItems(new Set([id]));
    } else if (type === 'truck' || type === 'sat') {
      setActiveTab('vehicles');
      if (type === 'truck') {
        setSelectionMode('trucks');
      } else {
        setSelectionMode('sats');
      }
      setSelectedItems(new Set([id]));
    }
    
    toast.success(`Selected ${id}`);
  };
  
  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const selectAll = (type: 'bins' | 'stations' | 'dumpyards' | 'trucks' | 'sats') => {
    let items: string[] = [];
    switch (type) {
      case 'bins':
        items = data.smartBins.map(b => b.id);
        break;
      case 'stations':
        items = data.compactStations.map(s => s.id);
        break;
      case 'dumpyards':
        items = data.dumpyards.filter(d => !PERMANENT_DUMPYARD_IDS.includes(d.id)).map(d => d.id);
        break;
      case 'trucks':
        items = data.vehicles.trucks.map(t => t.id);
        break;
      case 'sats':
        items = data.vehicles.sats.map(s => s.id);
        break;
    }
    setSelectedItems(new Set(items));
  };
  
  const clearSelection = () => {
    setSelectionMode('none');
    setSelectedItems(new Set());
  };

  const toggleBulkSmartBin = () => {
    if (selectedItems.size === 0) {
      toast.error('No bins selected');
      return;
    }
    
    // Update selected bins to smart or regular based on bulkSmartBin toggle
    updateData({
      ...data,
      smartBins: data.smartBins.map(bin => 
        selectedItems.has(bin.id) ? { ...bin, isSmartBin: bulkSmartBin } : bin
      )
    });
    
    toast.success(`Updated ${selectedItems.size} bins to ${bulkSmartBin ? 'Smart' : 'Regular'}`);
  };
  
  const applyBulkAction = (action: 'delete' | 'setLevel') => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }
    
    if (action === 'delete') {
      selectedItems.forEach(id => {
        switch (selectionMode) {
          case 'bins':
            removeSmartBin(id);
            break;
          case 'stations':
            removeCompactStation(id);
            break;
          case 'dumpyards':
            if (!PERMANENT_DUMPYARD_IDS.includes(id)) {
              removeDumpyard(id);
            }
            break;
          case 'trucks':
            removeTruck(id);
            break;
          case 'sats':
            removeSAT(id);
            break;
        }
      });
      toast.success(`Deleted ${selectedItems.size} items`);
    } else if (action === 'setLevel') {
      selectedItems.forEach(id => {
        switch (selectionMode) {
          case 'bins':
            updateBinLevel(id, bulkFillLevel);
            break;
          case 'stations':
            const station = data.compactStations.find(s => s.id === id);
            if (station) {
              updateStationLevel(id, Math.round((bulkFillLevel / 100) * station.capacity));
            }
            break;
          case 'dumpyards':
            const dumpyard = data.dumpyards.find(d => d.id === id);
            if (dumpyard) {
              updateDumpyardLevel(id, Math.round((bulkFillLevel / 100) * dumpyard.capacity));
            }
            break;
        }
      });
      toast.success(`Updated fill level for ${selectedItems.size} items`);
    }
    
    clearSelection();
  };

  const handleAddTruck = () => {
    if (!newTruck.id || !newTruck.capacity) {
      toast.error('Please fill all fields');
      return;
    }
    addTruck({
      id: newTruck.id.toUpperCase(),
      capacity: parseInt(newTruck.capacity),
      status: 'active',
      driver: ''
    });
    setNewTruck({ id: '', capacity: '' });
    toast.success(`Truck ${newTruck.id.toUpperCase()} added successfully`);
  };

  const handleAddSAT = () => {
    if (!newSAT.id || !newSAT.capacity) {
      toast.error('Please fill all fields');
      return;
    }
    addSAT({
      id: newSAT.id.toUpperCase(),
      capacity: parseInt(newSAT.capacity),
      status: 'active',
      driver: ''
    });
    setNewSAT({ id: '', capacity: '' });
    toast.success(`SAT ${newSAT.id.toUpperCase()} added successfully`);
  };

  const handleAddBin = () => {
    if (!newBin.id || !newBin.lat || !newBin.lng || !newBin.capacity || !newBin.area) {
      toast.error('Please fill all fields');
      return;
    }
    addSmartBin({
      id: newBin.id.toUpperCase(),
      lat: parseFloat(newBin.lat),
      lng: parseFloat(newBin.lng),
      capacity: parseInt(newBin.capacity),
      currentLevel: 0,
      area: newBin.area,
      isSmartBin: newBin.isSmartBin
    });
    setNewBin({ id: '', lat: '', lng: '', capacity: '', area: '', isSmartBin: true });
    toast.success(`${newBin.isSmartBin ? 'Smart Bin' : 'Regular Bin'} ${newBin.id.toUpperCase()} added successfully`);
  };

  const handleAddStation = () => {
    if (!newStation.id || !newStation.lat || !newStation.lng || !newStation.capacity || !newStation.area) {
      toast.error('Please fill all fields');
      return;
    }
    addCompactStation({
      id: newStation.id.toUpperCase(),
      lat: parseFloat(newStation.lat),
      lng: parseFloat(newStation.lng),
      capacity: parseInt(newStation.capacity),
      currentLevel: 0,
      area: newStation.area
    });
    setNewStation({ id: '', lat: '', lng: '', capacity: '', area: '' });
    toast.success(`Compact Station ${newStation.id.toUpperCase()} added successfully`);
  };

  const handleAddDumpyard = () => {
    if (!newDumpyard.id || !newDumpyard.lat || !newDumpyard.lng || !newDumpyard.capacity || !newDumpyard.name) {
      toast.error('Please fill all fields');
      return;
    }
    addDumpyard({
      id: newDumpyard.id.toUpperCase(),
      lat: parseFloat(newDumpyard.lat),
      lng: parseFloat(newDumpyard.lng),
      capacity: parseInt(newDumpyard.capacity),
      currentLevel: 0,
      name: newDumpyard.name
    });
    setNewDumpyard({ id: '', lat: '', lng: '', capacity: '', name: '' });
    toast.success(`Dumpyard ${newDumpyard.name} added successfully`);
  };

  const handleDeleteDumpyard = (id: string, name: string) => {
    if (PERMANENT_DUMPYARD_IDS.includes(id)) {
      toast.error(`${name} is a permanent dumpyard and cannot be deleted`);
      return;
    }
    removeDumpyard(id);
    toast.success(`Dumpyard ${name} removed`);
  };

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Asset Management</h1>
        <p className="text-muted-foreground">Add, remove, and manage all waste management assets</p>
      </div>

      {/* Global Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID (bins, stations, dumpyards, vehicles)..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Search Results */}
        {searchResults && globalSearch.trim() && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-4 rounded-xl glass"
          >
            <h3 className="text-sm font-medium text-foreground mb-3">Search Results (click to select):</h3>
            <div className="grid gap-2 text-sm">
              {searchResults.bins.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trash2 className="w-4 h-4 text-smartbin" />
                    <span>Bins:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {searchResults.bins.map(b => (
                      <button 
                        key={b.id}
                        onClick={() => handleSearchResultClick('bin', b.id)}
                        className="px-2 py-1 rounded bg-smartbin/20 text-smartbin text-xs hover:bg-smartbin/30 transition-colors cursor-pointer"
                      >
                        {b.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.stations.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4 text-compact-station" />
                    <span>Stations:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {searchResults.stations.map(s => (
                      <button 
                        key={s.id}
                        onClick={() => handleSearchResultClick('station', s.id)}
                        className="px-2 py-1 rounded bg-compact-station/20 text-compact-station text-xs hover:bg-compact-station/30 transition-colors cursor-pointer"
                      >
                        {s.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.dumpyards.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-dumpyard" />
                    <span>Dumpyards:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {searchResults.dumpyards.map(d => (
                      <button 
                        key={d.id}
                        onClick={() => handleSearchResultClick('dumpyard', d.id)}
                        className="px-2 py-1 rounded bg-dumpyard/20 text-dumpyard text-xs hover:bg-dumpyard/30 transition-colors cursor-pointer"
                      >
                        {d.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.trucks.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Truck className="w-4 h-4 text-truck" />
                    <span>Trucks:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {searchResults.trucks.map(t => (
                      <button 
                        key={t.id}
                        onClick={() => handleSearchResultClick('truck', t.id)}
                        className="px-2 py-1 rounded bg-truck/20 text-truck text-xs hover:bg-truck/30 transition-colors cursor-pointer"
                      >
                        {t.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.sats.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="w-4 h-4 text-sat" />
                    <span>SATs:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {searchResults.sats.map(s => (
                      <button 
                        key={s.id}
                        onClick={() => handleSearchResultClick('sat', s.id)}
                        className="px-2 py-1 rounded bg-sat/20 text-sat text-xs hover:bg-sat/30 transition-colors cursor-pointer"
                      >
                        {s.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.bins.length === 0 && searchResults.stations.length === 0 && 
               searchResults.dumpyards.length === 0 && searchResults.trucks.length === 0 && 
               searchResults.sats.length === 0 && (
                <p className="text-muted-foreground">No results found</p>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="bins">Bins</TabsTrigger>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
        </TabsList>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-6">
          {/* Trucks Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-truck/20">
                  <Truck className="w-5 h-5 text-truck" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Trucks</h2>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add Truck
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Truck</DialogTitle>
                    <DialogDescription>Enter the details for the new truck.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Vehicle ID</Label>
                      <Input 
                        placeholder="e.g., T106" 
                        value={newTruck.id}
                        onChange={(e) => setNewTruck({ ...newTruck, id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Capacity (kg)</Label>
                      <Input 
                        type="number" 
                        placeholder="e.g., 5000"
                        value={newTruck.capacity}
                        onChange={(e) => setNewTruck({ ...newTruck, capacity: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddTruck} className="w-full">Add Truck</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-3">
              {data.vehicles.trucks.map((truck) => (
                <div key={truck.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{truck.id}</span>
                    <span className="text-sm text-muted-foreground">{truck.capacity}kg</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      truck.status === 'active' ? 'bg-success/20 text-success' : 
                      truck.status === 'off-duty' ? 'bg-destructive/20 text-destructive' :
                      'bg-warning/20 text-warning'
                    }`}>
                      {truck.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={truck.status} 
                      onValueChange={(value) => updateTruckStatus(truck.id, value as Vehicle['status'])}
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="off-duty">Off-duty</SelectItem>
                        <SelectItem value="in-route">In Route</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        removeTruck(truck.id);
                        toast.success(`Truck ${truck.id} removed`);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* SATs Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sat/20">
                  <Package className="w-5 h-5 text-sat" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">SATs (Small Area Trucks)</h2>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add SAT
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New SAT</DialogTitle>
                    <DialogDescription>Enter the details for the new SAT vehicle.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Vehicle ID</Label>
                      <Input 
                        placeholder="e.g., SAT109" 
                        value={newSAT.id}
                        onChange={(e) => setNewSAT({ ...newSAT, id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Capacity (kg)</Label>
                      <Input 
                        type="number" 
                        placeholder="e.g., 500"
                        value={newSAT.capacity}
                        onChange={(e) => setNewSAT({ ...newSAT, capacity: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddSAT} className="w-full">Add SAT</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-3 max-h-64 overflow-auto scrollbar-thin">
              {data.vehicles.sats.map((sat) => (
                <div key={sat.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{sat.id}</span>
                    <span className="text-sm text-muted-foreground">{sat.capacity}kg</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      sat.status === 'active' ? 'bg-success/20 text-success' : 
                      sat.status === 'off-duty' ? 'bg-destructive/20 text-destructive' :
                      'bg-warning/20 text-warning'
                    }`}>
                      {sat.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={sat.status} 
                      onValueChange={(value) => updateSATStatus(sat.id, value as Vehicle['status'])}
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="off-duty">Off-duty</SelectItem>
                        <SelectItem value="in-route">In Route</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        removeSAT(sat.id);
                        toast.success(`SAT ${sat.id} removed`);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Smart Bins Tab */}
        <TabsContent value="bins" className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-smartbin/20">
                  <Trash2 className="w-5 h-5 text-smartbin" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Smart Bins</h2>
                <span className="text-sm text-muted-foreground">({data.smartBins.length} total)</span>
              </div>
              <div className="flex items-center gap-2">
                {selectionMode === 'bins' ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => selectAll('bins')}>
                      <CheckSquare className="w-4 h-4 mr-1" /> Select All
                    </Button>
                    
                    {/* Smart Bin Toggle */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border">
                      <Checkbox
                        id="bulk-smart-bin"
                        checked={bulkSmartBin}
                        onCheckedChange={(checked) => setBulkSmartBin(checked as boolean)}
                      />
                      <Label htmlFor="bulk-smart-bin" className="text-xs cursor-pointer">
                        Smart Bin
                      </Label>
                      <Button variant="ghost" size="sm" onClick={toggleBulkSmartBin} disabled={selectedItems.size === 0}>
                        Apply
                      </Button>
                    </div>
                    
                    <Button variant="destructive" size="sm" onClick={() => applyBulkAction('delete')} disabled={selectedItems.size === 0}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete ({selectedItems.size})
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setSelectionMode('bins')}>
                    <Square className="w-4 h-4 mr-1" /> Select
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Add Bin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Smart Bin</DialogTitle>
                    <DialogDescription>Enter the location and details for the new smart bin.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Bin ID</Label>
                        <Input 
                          placeholder="e.g., BIN016" 
                          value={newBin.id}
                          onChange={(e) => setNewBin({ ...newBin, id: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Area</Label>
                        <Input 
                          placeholder="e.g., Begumpet"
                          value={newBin.area}
                          onChange={(e) => setNewBin({ ...newBin, area: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Latitude</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          placeholder="17.4500"
                          value={newBin.lat}
                          onChange={(e) => setNewBin({ ...newBin, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Longitude</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          placeholder="78.4500"
                          value={newBin.lng}
                          onChange={(e) => setNewBin({ ...newBin, lng: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Capacity (Liters)</Label>
                      <Input 
                        type="number" 
                        placeholder="100"
                        value={newBin.capacity}
                        onChange={(e) => setNewBin({ ...newBin, capacity: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50">
                      <Checkbox
                        id="isSmartBin"
                        checked={newBin.isSmartBin}
                        onCheckedChange={(checked) => setNewBin({ ...newBin, isSmartBin: checked as boolean })}
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="isSmartBin" className="cursor-pointer font-medium">Smart Bin</Label>
                        <span className="text-xs text-muted-foreground">Enable sensor-based fill level monitoring</span>
                      </div>
                    </div>
                    <Button onClick={handleAddBin} className="w-full">Add {newBin.isSmartBin ? 'Smart' : 'Regular'} Bin</Button>
                  </div>
                </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="grid gap-3 max-h-[500px] overflow-auto scrollbar-thin">
              {data.smartBins.map((bin) => (
                <div key={bin.id} className={`flex items-center justify-between p-3 rounded-lg bg-secondary/50 ${selectionMode === 'bins' && selectedItems.has(bin.id) ? 'ring-2 ring-primary' : ''}`}>
                  <div className="flex items-center gap-4 flex-1">
                    {selectionMode === 'bins' && (
                      <Checkbox
                        checked={selectedItems.has(bin.id)}
                        onCheckedChange={() => toggleSelection(bin.id)}
                      />
                    )}
                    <div className="min-w-[80px]">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{bin.id}</span>
                        {bin.isSmartBin ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-smartbin/20 text-smartbin">SMART</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">GENERAL</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{bin.area}</p>
                    </div>
                    <div className="text-sm text-muted-foreground min-w-[120px]">
                      {bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}
                    </div>
                    {bin.isSmartBin ? (
                      <div className="flex items-center gap-3 flex-1 max-w-[200px]">
                        <Slider
                          value={[bin.currentLevel]}
                          onValueChange={(value) => updateBinLevel(bin.id, value[0])}
                          max={100}
                          step={1}
                          className="flex-1"
                        />
                        <span className={`text-xs font-medium min-w-[35px] ${
                          bin.currentLevel > 80 ? 'text-destructive' : 
                          bin.currentLevel > 50 ? 'text-warning' : 'text-success'
                        }`}>{bin.currentLevel}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Capacity: {bin.capacity}L</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      removeSmartBin(bin.id);
                      toast.success(`Bin ${bin.id} removed`);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Facilities Tab */}
        <TabsContent value="facilities" className="space-y-6">
          {/* Compact Stations */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-compact-station/20">
                  <Building2 className="w-5 h-5 text-compact-station" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Compact Stations</h2>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add Station
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Compact Station</DialogTitle>
                    <DialogDescription>Enter the location and details for the new compact station.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Station ID</Label>
                        <Input 
                          placeholder="e.g., CS006" 
                          value={newStation.id}
                          onChange={(e) => setNewStation({ ...newStation, id: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Area</Label>
                        <Input 
                          placeholder="e.g., Banjara Hills"
                          value={newStation.area}
                          onChange={(e) => setNewStation({ ...newStation, area: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Latitude</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          placeholder="17.4500"
                          value={newStation.lat}
                          onChange={(e) => setNewStation({ ...newStation, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Longitude</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          placeholder="78.4500"
                          value={newStation.lng}
                          onChange={(e) => setNewStation({ ...newStation, lng: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Capacity (kg)</Label>
                      <Input 
                        type="number" 
                        placeholder="2000"
                        value={newStation.capacity}
                        onChange={(e) => setNewStation({ ...newStation, capacity: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddStation} className="w-full">Add Station</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-3">
              {data.compactStations.map((station) => (
                <div key={station.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-[80px]">
                      <span className="font-medium text-foreground">{station.id}</span>
                      <p className="text-xs text-muted-foreground">{station.area}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1 max-w-[250px]">
                      <Slider
                        value={[station.currentLevel]}
                        onValueChange={(value) => updateStationLevel(station.id, value[0])}
                        max={station.capacity}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground min-w-[100px]">
                        {station.currentLevel.toLocaleString()} / {station.capacity.toLocaleString()} kg
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      removeCompactStation(station.id);
                      toast.success(`Compact Station ${station.id} removed`);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dumpyards */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dumpyard/20">
                  <MapPin className="w-5 h-5 text-dumpyard" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Dumpyards</h2>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add Dumpyard
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Dumpyard</DialogTitle>
                    <DialogDescription>Enter the location and details for the new dumpyard.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Dumpyard ID</Label>
                        <Input 
                          placeholder="e.g., DY003" 
                          value={newDumpyard.id}
                          onChange={(e) => setNewDumpyard({ ...newDumpyard, id: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Name</Label>
                        <Input 
                          placeholder="e.g., New Dumpyard Facility"
                          value={newDumpyard.name}
                          onChange={(e) => setNewDumpyard({ ...newDumpyard, name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Latitude</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          placeholder="17.4500"
                          value={newDumpyard.lat}
                          onChange={(e) => setNewDumpyard({ ...newDumpyard, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Longitude</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          placeholder="78.4500"
                          value={newDumpyard.lng}
                          onChange={(e) => setNewDumpyard({ ...newDumpyard, lng: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Capacity (tons)</Label>
                      <Input 
                        type="number" 
                        placeholder="50000"
                        value={newDumpyard.capacity}
                        onChange={(e) => setNewDumpyard({ ...newDumpyard, capacity: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddDumpyard} className="w-full">Add Dumpyard</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-3">
              {data.dumpyards.map((dumpyard) => (
                <div key={dumpyard.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{dumpyard.name}</span>
                        {PERMANENT_DUMPYARD_IDS.includes(dumpyard.id) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary">PERMANENT</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{dumpyard.id}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1 max-w-[250px]">
                      <Slider
                        value={[dumpyard.currentLevel]}
                        onValueChange={(value) => updateDumpyardLevel(dumpyard.id, value[0])}
                        max={dumpyard.capacity}
                        step={100}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground min-w-[110px]">
                        {dumpyard.currentLevel.toLocaleString()} / {dumpyard.capacity.toLocaleString()} tons
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDeleteDumpyard(dumpyard.id, dumpyard.name)}
                    disabled={PERMANENT_DUMPYARD_IDS.includes(dumpyard.id)}
                  >
                    <Trash2 className={`w-4 h-4 ${PERMANENT_DUMPYARD_IDS.includes(dumpyard.id) ? 'text-muted-foreground' : 'text-destructive'}`} />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}