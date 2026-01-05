import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, Edit3, Route, Settings, LogOut, Truck, User, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import logoDark from '@/assets/logo-dark.jpg';
import logoLight from '@/assets/logo-light.jpg';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

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

// Mobile Header Component
export function MobileHeader({ activeTab, onTabChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
    
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains('light'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const accessibleTabs = tabs.filter(tab => 
    !tab.adminOnly || user?.role === 'admin'
  );

  const handleTabChange = (tab: TabType) => {
    onTabChange(tab);
    setIsOpen(false);
  };

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden">
          <img 
            src={isDarkMode ? logoDark : logoLight} 
            alt="AJΔSTRA Logo" 
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="font-bold text-foreground text-sm">AJΔSTRA</h1>
      </div>
      
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
          {/* Logo Section */}
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
                <img 
                  src={isDarkMode ? logoDark : logoLight} 
                  alt="AJΔSTRA Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-bold text-foreground">AJΔSTRA</h1>
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
                onClick={() => handleTabChange(tab.id)}
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
          <div className="p-4 border-t border-sidebar-border mt-auto">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Desktop Sidebar Component
export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
    
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains('light'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const accessibleTabs = tabs.filter(tab => 
    !tab.adminOnly || user?.role === 'admin'
  );

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden md:flex w-64 h-screen bg-sidebar border-r border-sidebar-border flex-col"
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
            <img 
              src={isDarkMode ? logoDark : logoLight} 
              alt="AJΔSTRA Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-bold text-foreground">AJΔSTRA</h1>
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
