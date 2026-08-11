import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const AppShell = () => {
  return (
    <div className="min-h-screen bg-[#0B0E14]">
      <Sidebar />
      <TopNav />
      <main className="ml-64 pt-24 pb-8 px-8 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
