import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import WhatsNewModal from '../modals/WhatsNewModal';
import packageJson from '../../../package.json';

const AppShell = () => {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const currentAppVersion = packageJson.version;

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('alpha_gym_last_seen_version');
    if (lastSeenVersion !== currentAppVersion) {
      setShowWhatsNew(true);
    }
  }, [currentAppVersion]);

  const handleDismiss = () => {
    localStorage.setItem('alpha_gym_last_seen_version', currentAppVersion);
    setShowWhatsNew(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14]">
      <Sidebar />
      <TopNav />
      <main className="ml-64 pt-24 pb-8 px-8 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={handleDismiss}
        currentVersion={currentAppVersion}
      />
    </div>
  );
};

export default AppShell;
