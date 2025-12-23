import React from 'react';
import { motion } from 'framer-motion';
import { Home, Edit3, Route, Settings, LogOut, Truck, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

type TabType = 'home' | 'modification' | 'routes' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs = [
  { id: 'home' as TabType, label: 'Homepage', icon: Home, adminOnly: false },
  { id: 'modification' as TabType, label: 'Modification', icon: Edit3, adminOnly: true },
  { id: 'routes' as TabType, label: 'Routes', icon: Route, adminOnly: false },
  { id: 'settings' as TabType, label: 'Settings', icon: Settings, adminOnly: false },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user, logout } = useAuth();

  const accessibleTabs = tabs.filter(tab => 
    !tab.adminOnly || user?.role === 'admin'
  );

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Route className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">HydWaste</h1>
            <p className="text-xs text-muted-foreground">Route Optimizer</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            {user?.role === 'admin' ? (
              <User className="w-4 h-4 text-primary" />
            ) : (
              <Truck className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground capitalize">{user?.role}</p>
            {user?.vehicleId && (
              <p className="text-xs text-muted-foreground truncate">{user.vehicleId}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {accessibleTabs.map((tab, index) => (
          <motion.button
            key={tab.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="font-medium">{tab.label}</span>
          </motion.button>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </motion.div>
  );
}
