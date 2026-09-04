import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, LineChart, Settings, User } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import logo from '../../assets/logo.png';

const navItems = [
  { path: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { path: '/clients', label: 'CLIENTS', icon: Users },
  { path: '/reports', label: 'REPORTS', icon: LineChart, ownerOnly: true },
  { path: '/settings', label: 'SETTINGS', icon: Settings }
];

const Sidebar = () => {
  const { user } = useContext(AuthContext);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0B0E14] border-r border-[#222B3D] flex flex-col z-20">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#222B3D]">
        <img src={logo} alt="Alpha Gym" className="w-8 h-8 mr-3 object-contain" />
        <span className="text-white font-black font-display text-lg tracking-wider uppercase">Alpha Gym</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          if (item.ownerOnly && user?.role !== 'owner') return null;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-6 py-3 font-bold text-sm tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'border-l-4 border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'text-slate-400 border-l-4 border-transparent hover:bg-[#181E2A] hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      
      {/* User Badge CTA */}
      <div className="p-4 border-t border-[#222B3D]">
        <div className="flex items-center justify-between p-3 bg-[#CCFF00] rounded">
          <div className="flex items-center">
            <User className="w-5 h-5 text-black mr-2" />
            <div>
              <div className="text-black font-black uppercase text-xs tracking-wider">{user?.username || 'SYSTEM'}</div>
              <div className="text-black/80 font-bold text-[10px] uppercase tracking-widest">
                {user?.role === 'admin' ? 'Coach' : user?.role || 'SYSTEM'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
