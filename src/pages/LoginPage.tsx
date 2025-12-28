import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, User, AlertCircle, LogIn, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { UserRole } from '@/types';
import logoDark from '@/assets/logo-dark.jpg';
import logoLight from '@/assets/logo-light.jpg';

export default function LoginPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { data } = useData();
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
  }, []);

  const handleLogin = () => {
    setError('');

    if (!role) {
      setError('Please select your role');
      return;
    }

    if (role === 'driver') {
      if (!vehicleId.trim()) {
        setError('Please enter your vehicle ID');
        return;
      }

      const allVehicles = [
        ...data.vehicles.trucks.map(t => ({ ...t, type: 'truck' })),
        ...data.vehicles.sats.map(s => ({ ...s, type: 'sat' }))
      ];

      const vehicle = allVehicles.find(v =>
        v.id.toLowerCase() === vehicleId.trim().toLowerCase()
      );

      if (!vehicle) {
        setError('Vehicle ID not found. Please check and try again.');
        return;
      }

      if (vehicle.status === 'off-duty') {
        setError('This vehicle is currently marked as off-duty.');
        return;
      }

      login('driver', vehicleId.trim().toUpperCase());
    } else {
      login('admin');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-2 sm:p-4 md:p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(187_85%_53%_/_0.1),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(217_91%_60%_/_0.1),_transparent_50%)]" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(hsl(187 85% 53% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(187 85% 53% / 0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm sm:max-w-md px-2 sm:px-4"
      >
        {/* Logo Section */}
        <motion.div
          className="text-center mb-6 sm:mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="inline-flex items-center justify-center w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 rounded-2xl bg-background/50 border border-primary/20 mb-3 sm:mb-4 overflow-hidden">
            <img
              src={isDarkMode ? logoDark : logoLight}
              alt="AJΔSTRA Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1 sm:mb-2">
            AJΔSTRA
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base">
            AI System for Smart Transport Routing Analytics
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground mb-4 sm:mb-6 text-center">
            Sign In to Continue
          </h2>

          {/* Role Selection */}
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            <Label className="text-muted-foreground text-xs sm:text-sm">Select Your Role</Label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={() => { setRole('admin'); setError(''); }}
                className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base ${
                  role === 'admin'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <User className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6" />
                <span className="font-medium">Admin</span>
              </button>
              <button
                onClick={() => { setRole('driver'); setError(''); }}
                className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base ${
                  role === 'driver'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <Truck className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6" />
                <span className="font-medium">Driver</span>
              </button>
            </div>
          </div>

          {/* Vehicle ID Input (for drivers) */}
          {role === 'driver' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 sm:mb-6"
            >
              <Label htmlFor="vehicleId" className="text-muted-foreground text-xs sm:text-sm mb-1 sm:mb-2 block">
                Vehicle ID
              </Label>
              <Input
                id="vehicleId"
                placeholder="e.g., T101 or SAT101"
                value={vehicleId}
                onChange={(e) => { setVehicleId(e.target.value); setError(''); }}
                className="bg-secondary/50 text-sm sm:text-base"
              />
              <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
                Enter your assigned vehicle ID (Truck: T101, SAT: SAT101)
              </p>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 sm:p-3 rounded-lg mb-4 sm:mb-6"
            >
              <AlertCircle className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{error}</span>
            </motion.div>
          )}

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            variant="glow"
            size="xl"
            className="w-full text-sm sm:text-base"
          >
            <LogIn className="w-4 sm:w-5 h-4 sm:h-5" />
            Sign In
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-center text-muted-foreground text-xs sm:text-sm md:text-base mt-4 sm:mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Powered by AJΔSTRA
        </motion.p>
      </motion.div>
    </div>
  );
}
