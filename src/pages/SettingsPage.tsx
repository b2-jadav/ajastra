import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Lock, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ChangePasswordModal({ isOpen, onClose }: PasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { changeAdminPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 4) {
      setMessage({ type: 'error', text: 'New password must be at least 4 characters' });
      return;
    }

    if (oldPassword === newPassword) {
      setMessage({ type: 'error', text: 'New password must be different from old password' });
      return;
    }

    setLoading(true);
    try {
      const success = await changeAdminPassword(oldPassword, newPassword);
      if (success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setTimeout(() => {
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          onClose();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: 'Old password is incorrect' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-700"
      >
        <div className="flex items-center gap-2 mb-4">
          <Lock className="text-cyan-400" size={24} />
          <h2 className="text-2xl font-bold text-white">Change Admin Password</h2>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-900/30 border border-green-700 text-green-300'
                : 'bg-red-900/30 border border-red-700 text-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <Check size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {message.text}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="oldPassword" className="text-gray-300">
              Old Password
            </Label>
            <div className="relative">
              <Input
                id="oldPassword"
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-gray-700 border-gray-600 text-white pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="newPassword" className="text-gray-300">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-gray-700 border-gray-600 text-white pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-gray-300">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-gray-700 border-gray-600 text-white pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-700 hover:bg-gray-600"
            >
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Settings Header */}
      <div className="flex items-center gap-3 mb-8">
        <Settings className="text-cyan-400" size={32} />
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">Configure your application preferences</p>
        </div>
      </div>

      {/* Admin Settings */}
      {user?.role === 'admin' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-700/50 border border-gray-600 rounded-lg p-6 backdrop-blur"
        >
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Lock size={20} className="text-cyan-400" />
            Admin Security
          </h2>
          <p className="text-gray-300 mb-4">
            Manage your admin account security settings
          </p>
          <Button
            onClick={() => setShowPasswordModal(true)}
            className="bg-cyan-500 hover:bg-cyan-600 flex items-center gap-2"
          >
            <Lock size={18} />
            Change Admin Password
          </Button>
        </motion.div>
      )}

      {/* Driver Information */}
      {user?.role === 'driver' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-700/50 border border-gray-600 rounded-lg p-6 backdrop-blur"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Driver Information</h2>
          <div className="space-y-2">
            <p className="text-gray-300">
              <span className="text-gray-400">Assigned Vehicle:</span> {user.vehicleId}
            </p>
            <p className="text-gray-400 text-sm mt-4">
              Contact your administrator to change your vehicle assignment
            </p>
          </div>
        </motion.div>
      )}

      {/* Theme Settings */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-700/50 border border-gray-600 rounded-lg p-6 backdrop-blur"
      >
        <h2 className="text-xl font-semibold text-white mb-4">Display Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 font-medium">Dark Mode</p>
              <p className="text-gray-400 text-sm">Currently {isDarkMode ? 'enabled' : 'disabled'}</p>
            </div>
            <div className="text-cyan-400 font-semibold">
              {isDarkMode ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Application Information */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-700/50 border border-gray-600 rounded-lg p-6 backdrop-blur"
      >
        <h2 className="text-xl font-semibold text-white mb-4">About</h2>
        <div className="space-y-2 text-gray-400 text-sm">
          <p>
            <span className="text-gray-300">Application:</span> AJΔSTRA Route Optimization
          </p>
          <p>
            <span className="text-gray-300">Role:</span> {user?.role === 'admin' ? 'Administrator' : 'Driver'}
          </p>
          <p>
            <span className="text-gray-300">Version:</span> 1.0.0
          </p>
        </div>
      </motion.div>

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </motion.div>
  );
}
