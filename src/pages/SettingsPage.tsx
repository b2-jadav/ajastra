import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Palette, Bell, Shield, Info, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and account settings</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Account Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/20">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Account</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-foreground">Role</p>
                <p className="text-sm text-muted-foreground">Your current access level</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary font-medium capitalize">
                {user?.role}
              </span>
            </div>
            
            {user?.vehicleId && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                <div>
                  <p className="font-medium text-foreground">Assigned Vehicle</p>
                  <p className="text-sm text-muted-foreground">Your current vehicle assignment</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-success/20 text-success font-medium">
                  {user.vehicleId}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Appearance Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-warning/20">
              <Palette className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-3">
                {isDarkMode ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-warning" />
                )}
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">
                    {isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                  </p>
                </div>
              </div>
              <Switch 
                checked={isDarkMode} 
                onCheckedChange={setIsDarkMode}
              />
            </div>
          </div>
        </motion.div>

        {/* Preferences Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/20">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-foreground">Auto-refresh Map</p>
                <p className="text-sm text-muted-foreground">Automatically update map markers</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-foreground">Show Route Animations</p>
                <p className="text-sm text-muted-foreground">Animate route drawing on map</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-success/20">
              <Bell className="w-5 h-5 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-foreground">High Fill Alerts</p>
                <p className="text-sm text-muted-foreground">Notify when bins reach 80% capacity</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-foreground">Route Completion</p>
                <p className="text-sm text-muted-foreground">Notify when routes are completed</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </motion.div>

        {/* About Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-sat/20">
              <Info className="w-5 h-5 text-sat" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">About</h2>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="font-medium text-foreground">HydWaste Route Optimizer</p>
              <p className="text-sm text-muted-foreground mt-1">
                Version 1.0.0
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                AI-powered waste management route optimization system for Hyderabad. 
                Uses OSRM for road network routing and advanced algorithms for 
                optimal route planning.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
