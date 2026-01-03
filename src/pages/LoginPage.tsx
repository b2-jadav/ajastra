import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, User, AlertCircle, Eye, EyeOff, LogOut, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import logoDark from '@/assets/logo-dark.jpg';
import logoLight from '@/assets/logo-light.jpg';

export default function LoginPage() {
  const [loginType, setLoginType] = useState<'admin' | 'driver'>('admin');
  const [password, setPassword] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const { data } = useData();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
  }, []);

  // Get available vehicle IDs for driver login
  const availableVehicles = [
    ...(data?.vehicles?.trucks || []),
    ...(data?.vehicles?.sats || [])
  ].map(v => v.id);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login('admin', undefined, password);
      if (!success) {
        setError('Invalid admin password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!vehicleId) {
        setError('Please select a vehicle');
        setIsLoading(false);
        return;
      }
      
      const success = await login('driver', vehicleId);
      if (!success) {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md p-8 rounded-lg shadow-xl ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <img
            src={isDarkMode ? logoDark : logoLight}
            alt="AJΔSTRA"
            className="h-12 w-auto mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">AJΔSTRA</h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            AI-powered Route Optimization
          </p>
        </div>

        {/* Login Type Selector */}
        <div className="flex gap-3 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setLoginType('admin');
              setError('');
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              loginType === 'admin'
                ? 'bg-cyan-500 text-white'
                : isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <User size={18} />
            Admin
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setLoginType('driver');
              setError('');
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              loginType === 'driver'
                ? 'bg-cyan-500 text-white'
                : isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Truck size={18} />
            Driver
          </motion.button>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              isDarkMode
                ? 'bg-red-900/30 border border-red-700 text-red-300'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}

        {/* Admin Login Form */}
        {loginType === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <Label htmlFor="password" className={isDarkMode ? 'text-gray-300' : ''}>
                Admin Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className={`${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''} pr-10`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className={`text-xs mt-2 ${
                isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Default password: 12345
              </p>
            </div>
            <Button
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              {isLoading ? 'Signing in...' : 'Sign in as Admin'}
            </Button>
          </form>
        )}

        {/* Driver Login Form */}
        {loginType === 'driver' && (
          <form onSubmit={handleDriverLogin} className="space-y-4">
            <div>
              <Label htmlFor="vehicle" className={isDarkMode ? 'text-gray-300' : ''}>
                Select Your Vehicle
              </Label>
              <select
                id="vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500'
                    : 'bg-white border-gray-300 text-black focus:border-cyan-500'
                } focus:outline-none`}
                disabled={isLoading}
              >
                <option value="">Choose a vehicle...</option>
                {availableVehicles.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              disabled={isLoading || !vehicleId}
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              {isLoading ? 'Signing in...' : 'Sign in as Driver'}
            </Button>
          </form>
        )}

        {/* Footer */}
        <div className={`mt-8 pt-4 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        } text-center text-sm ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <p>AJΔSTRA Smart Waste Collection System</p>
          <p className="mt-1">© 2024 All Rights Reserved</p>
        </div>
      </motion.div>
    </div>
  );
}
