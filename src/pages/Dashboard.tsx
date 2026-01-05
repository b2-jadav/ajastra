import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { MobileHeader } from '@/components/Sidebar';
import HomePage from '@/pages/HomePage';
import ModificationPage from '@/pages/ModificationPage';
import RoutesPage from '@/pages/RoutesPage';
import SettingsPage from '@/pages/SettingsPage';

type TabType = 'home' | 'modification' | 'routes' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage />;
      case 'modification':
        return <ModificationPage />;
      case 'routes':
        return <RoutesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      {/* Mobile Header with Drawer */}
      <MobileHeader activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Desktop Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <motion.main 
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-hidden"
      >
        {renderContent()}
      </motion.main>
    </div>
  );
}
