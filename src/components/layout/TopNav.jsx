import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, ChevronDown, UserPlus, Receipt, UserCheck, Bell, AlertCircle, Clock, Cake, X } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import CheckInModal from '../CheckInModal';

const TopNav = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [alerts, setAlerts] = useState({ expiring_soon: [], expired_today: [], birthdays: [] });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (window.electronAPI?.updater) {
      if (window.electronAPI.updater.onUpdateAvailable) {
        window.electronAPI.updater.onUpdateAvailable((info) => {
          setUpdateInfo(info);
        });
      }
      if (window.electronAPI.updater.onDownloadProgress) {
        window.electronAPI.updater.onDownloadProgress((progress) => {
          setUpdateProgress(progress.percent);
        });
      }
      if (window.electronAPI.updater.onUpdateDownloaded) {
        window.electronAPI.updater.onUpdateDownloaded(() => {
          setUpdateDownloaded(true);
        });
      }
      // Trigger initial check
      if (window.electronAPI.updater.check) {
        window.electronAPI.updater.check();
      }
    }
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [countsRes, alertsRes] = await Promise.all([
          window.electronAPI.alerts.getCounts(),
          window.electronAPI.alerts.getAll()
        ]);
        if (countsRes.success) setAlertCount(countsRes.total_alerts);
        if (alertsRes.success) setAlerts(alertsRes);
      } catch (e) {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    if (notificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationOpen]);

  const handleClearAll = () => {
    setAlerts({ expiring_soon: [], expired_today: [], birthdays: [] });
    setAlertCount(0);
    setNotificationOpen(false);
  };

  const handleAlertClick = (clientId) => {
    navigate(`/clients/${clientId}`);
    setNotificationOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-64 h-16 bg-[#0B0E14]/80 backdrop-blur-md border-b border-[#222B3D] z-10 flex items-center justify-between px-8">
        <div className="flex-1">
        </div>

        <div className="flex items-center space-x-6">
          {/* Notification Bell Badge */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="View Alerts"
            >
              <Bell className="w-5 h-5" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1E293B] animate-pulse">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-[#121721] border border-[#222B3D] rounded-xl shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#222B3D] bg-[#0B0E14]">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-[#CCFF00]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Notifications</h3>
                    {alertCount > 0 && (
                      <span className="bg-brand-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {alertCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-white transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-[#222B3D] scrollbar-track-transparent">
                  {alertCount === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400">
                      <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {/* Expired */}
                      {alerts.expired_today?.length > 0 && (
                        <div className="mb-2">
                          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Expired
                          </div>
                          {alerts.expired_today.map((item) => (
                            <button
                              key={`expired-${item.client_id}`}
                              onClick={() => handleAlertClick(item.client_id)}
                              className="w-full px-4 py-3 hover:bg-[#181E2A] transition-colors text-left border-l-4 border-red-500"
                            >
                              <div className="flex items-start space-x-3">
                                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{item.client_name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {item.package_title || 'Membership'} expired
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-1">{item.client_code || item.phone}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Expiring Soon */}
                      {alerts.expiring_soon?.length > 0 && (
                        <div className="mb-2">
                          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Expiring Soon
                          </div>
                          {alerts.expiring_soon.map((item) => (
                            <button
                              key={`expiring-${item.client_id}`}
                              onClick={() => handleAlertClick(item.client_id)}
                              className="w-full px-4 py-3 hover:bg-[#181E2A] transition-colors text-left border-l-4 border-orange-500"
                            >
                              <div className="flex items-start space-x-3">
                                <Clock className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{item.client_name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {item.package_title || 'Membership'} expires in {item.days_remaining} day{item.days_remaining !== 1 ? 's' : ''}
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-1">{item.client_code || item.phone}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Birthdays Today */}
                      {alerts.birthdays?.length > 0 && (
                        <div className="mb-2">
                          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Birthdays Today
                          </div>
                          {alerts.birthdays.map((item) => (
                            <button
                              key={`birthday-${item.client_id}`}
                              onClick={() => handleAlertClick(item.client_id)}
                              className="w-full px-4 py-3 hover:bg-[#181E2A] transition-colors text-left border-l-4 border-[#CCFF00]"
                            >
                              <div className="flex items-start space-x-3">
                                <Cake className="w-5 h-5 text-[#CCFF00] mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{item.client_name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    🎉 Birthday today!
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-1">{item.client_code || item.phone}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        <div className="h-6 w-px bg-[#181E2A]"></div>

        {/* User Profile */}
        <div className="flex items-center">
          <div className="text-right mr-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-white leading-tight">{user?.fullName || 'User'}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role === 'admin' ? 'Coach' : user?.role || 'Role'}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-[#121721]/50 rounded-xl transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
    <CheckInModal isOpen={checkInOpen} onClose={() => setCheckInOpen(false)} />
  </>
  );
};

export default TopNav;
