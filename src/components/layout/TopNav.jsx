import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, ChevronDown, UserPlus, Receipt, UserCheck, Bell, AlertCircle, Clock, Cake, X, Sparkles, Download, RefreshCw, MessageCircle } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import CheckInModal from '../CheckInModal';
import { openClientWhatsApp } from '../../utils/whatsapp';

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

  const [clearedIds, setClearedIds] = useState(() => {
    try {
      const key = `gym_cleared_notifications_${new Date().toISOString().slice(0, 10)}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });

  const [viewedIds, setViewedIds] = useState(() => {
    try {
      const key = `gym_viewed_notifications_${new Date().toISOString().slice(0, 10)}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });

  const [readIds, setReadIds] = useState(() => {
    try {
      const key = `gym_read_notifications_${new Date().toISOString().slice(0, 10)}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });

  const markAsRead = (id) => {
    if (!id) return;
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        const key = `gym_read_notifications_${new Date().toISOString().slice(0, 10)}`;
        localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const fetchAlerts = async () => {
    try {
      const [countsRes, alertsRes] = await Promise.all([
        window.electronAPI?.alerts?.getCounts?.() || { success: false },
        window.electronAPI?.alerts?.getAll?.() || { success: false }
      ]);
      if (alertsRes.success) {
        const storedCleared = (() => {
          try {
            const key = `gym_cleared_notifications_${new Date().toISOString().slice(0, 10)}`;
            return JSON.parse(localStorage.getItem(key) || '[]');
          } catch {
            return [];
          }
        })();

        const mapItem = (item, prefix) => ({
          ...item,
          id: item.notification_id || `${prefix}-${item.subscription_id || item.client_id || item.id}`,
          client_id: item.client_id || item.id,
          client_name: item.client_name || item.name || item.full_name || 'Member',
          phone: item.phone || item.client_phone || ''
        });

        setAlerts({
          birthdays: (alertsRes.birthdays || [])
            .map((item) => mapItem(item, 'birthday'))
            .filter((item) => !storedCleared.includes(item.id)),
          expiring_soon: (alertsRes.expiring_soon || [])
            .map((item) => mapItem(item, 'expiring'))
            .filter((item) => !storedCleared.includes(item.id)),
          expired_today: (alertsRes.expired_today || [])
            .map((item) => mapItem(item, 'expired'))
            .filter((item) => !storedCleared.includes(item.id))
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [updateInfo]);

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

  const toggleNotificationDropdown = () => {
    const willOpen = !notificationOpen;
    setNotificationOpen(willOpen);
    if (willOpen) {
      // Instant Exterior Counter Clear: mark all currently visible alerts as viewed
      const currentIds = [
        ...(alerts.birthdays || []).map((n) => n.id),
        ...(alerts.expiring_soon || []).map((n) => n.id),
        ...(alerts.expired_today || []).map((n) => n.id),
        ...(updateInfo ? ['update_available'] : [])
      ];
      setViewedIds((prev) => {
        const next = Array.from(new Set([...prev, ...currentIds]));
        try {
          const key = `gym_viewed_notifications_${new Date().toISOString().slice(0, 10)}`;
          localStorage.setItem(key, JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  const handleClearAll = () => {
    const allIds = [
      ...(alerts.birthdays || []).map((n) => n.id),
      ...(alerts.expiring_soon || []).map((n) => n.id),
      ...(alerts.expired_today || []).map((n) => n.id),
      ...(updateInfo ? ['update_available'] : [])
    ];
    const next = Array.from(new Set([...clearedIds, ...allIds]));
    setClearedIds(next);
    try {
      const key = `gym_cleared_notifications_${new Date().toISOString().slice(0, 10)}`;
      localStorage.setItem(key, JSON.stringify(next));
      localStorage.setItem('gym_notifications_cleared_at', new Date().toISOString());
    } catch (e) {}
    // Empty alerts from dropdown immediately
    setAlerts({ birthdays: [], expiring_soon: [], expired_today: [] });
  };

  const handleAlertClick = (clientId, notifId) => {
    if (notifId) {
      markAsRead(notifId);
    }
    if (clientId) {
      navigate(`/clients/${clientId}`);
    }
    setNotificationOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleBirthdays = (alerts.birthdays || []).filter((n) => !clearedIds.includes(n.id));
  const visibleExpiring = (alerts.expiring_soon || []).filter((n) => !clearedIds.includes(n.id));
  const visibleExpiredToday = (alerts.expired_today || []).filter((n) => !clearedIds.includes(n.id));
  const isUpdateVisible = updateInfo && !clearedIds.includes('update_available');

  const allVisibleNotifications = [
    ...visibleBirthdays,
    ...visibleExpiring,
    ...visibleExpiredToday
  ];

  const unviewedNotifications = allVisibleNotifications.filter((n) => !viewedIds.includes(n.id));
  const unreadCount = notificationOpen
    ? 0
    : unviewedNotifications.length + (isUpdateVisible && !viewedIds.includes('update_available') ? 1 : 0);
  const totalNotifications = allVisibleNotifications.length + (isUpdateVisible ? 1 : 0);

  return (
    <>
      <header className="fixed top-0 right-0 left-64 h-16 bg-[#0B0E14]/80 backdrop-blur-md border-b border-[#222B3D] z-10 flex items-center justify-between px-8">
        <div className="flex-1">
        </div>

        <div className="flex items-center space-x-6">
          {/* Notification Bell Badge */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={toggleNotificationDropdown}
              className="relative p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="View Alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1E293B] animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-[#121721] border border-[#222B3D] rounded-xl shadow-2xl z-50 max-h-[520px] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#222B3D] bg-[#0B0E14]">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-[#CCFF00]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Notifications</h3>
                    {totalNotifications > 0 && (
                      <span className="bg-brand-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {totalNotifications}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto max-h-[440px] scrollbar-thin scrollbar-thumb-[#222B3D] scrollbar-track-transparent divide-y divide-[#222B3D]">
                  {totalNotifications === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400">
                      <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No notifications at this time</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {/* App Update Available */}
                      {isUpdateVisible && (
                        <div className={`p-3 bg-blue-500/10 border-l-4 border-blue-500 mb-1 ${readIds.includes('update_available') ? 'opacity-60' : ''}`}>
                          <div className="flex items-start space-x-3">
                            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-white">
                                  {updateDownloaded ? 'Update Ready to Install' : `Update Available (${updateInfo?.version ? `v${updateInfo.version}` : 'New Version'})`}
                                </p>
                                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">New</span>
                              </div>
                              <p className="text-xs text-slate-300 mt-0.5">
                                {updateDownloaded
                                  ? 'Update downloaded. Restart the app to apply.'
                                  : 'A new version of Alpha Gym is ready to download.'}
                              </p>
                              {updateProgress !== null && !updateDownloaded && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-[10px] text-blue-400 font-bold mb-1">
                                    <span>Downloading...</span>
                                    <span>{Math.round(updateProgress)}%</span>
                                  </div>
                                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${updateProgress}%` }} />
                                  </div>
                                </div>
                              )}
                              <div className="mt-2 flex gap-2">
                                {updateDownloaded ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead('update_available');
                                      window.electronAPI?.updater?.quitAndInstall?.();
                                    }}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" /> Restart & Install
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead('update_available');
                                      window.electronAPI?.updater?.download?.();
                                    }}
                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download Update
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Birthdays Today */}
                      {visibleBirthdays.length > 0 && (
                        <div className="mb-1">
                          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-yellow-400 flex items-center gap-1.5">
                            <Cake className="w-3.5 h-3.5 text-yellow-400" />
                            <span>Birthdays Today</span>
                            <span className="bg-yellow-400/20 text-yellow-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {visibleBirthdays.length}
                            </span>
                          </div>
                          {visibleBirthdays.map((item) => {
                            const cId = item.client_id || item.id;
                            const cName = item.client_name || item.name || 'Member';
                            const isRead = readIds.includes(item.id);
                            return (
                              <button
                                key={`birthday-${item.id}`}
                                onClick={() => handleAlertClick(cId, item.id)}
                                className={`w-full px-4 py-3 hover:bg-[#181E2A] transition-colors text-left border-l-4 border-yellow-400 group cursor-pointer ${
                                  isRead ? 'opacity-60' : ''
                                }`}
                              >
                                <div className="flex items-start space-x-3">
                                  <Cake className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-white group-hover:text-yellow-300 transition-colors truncate">
                                        {cName}
                                      </p>
                                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                                          Birthday Today
                                        </span>
                                        {item.phone && (
                                          <button
                                            title="Send Birthday Wishes"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              markAsRead(item.id);
                                              openClientWhatsApp({ client: item, contextOverride: 'BIRTHDAY' });
                                            }}
                                            className="p-1 rounded-lg border text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 border-yellow-400/40 shadow-[0_0_10px_rgba(250,204,21,0.2)] transition-colors"
                                          >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                      Today is {cName}'s birthday! Wish them a happy birthday.
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{item.client_code || item.phone}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Expired Today */}
                      {visibleExpiredToday.length > 0 && (
                        <div className="mb-1">
                          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Expired Today</span>
                            <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {visibleExpiredToday.length}
                            </span>
                          </div>
                          {visibleExpiredToday.map((item) => {
                            const cId = item.client_id || item.id;
                            const cName = item.client_name || item.name || 'Member';
                            const isRead = readIds.includes(item.id);
                            return (
                              <button
                                key={`expired-today-${item.id}`}
                                onClick={() => handleAlertClick(cId, item.id)}
                                className={`w-full px-4 py-3 hover:bg-[#181E2A] transition-colors text-left border-l-4 border-rose-500 group cursor-pointer ${
                                  isRead ? 'opacity-60' : ''
                                }`}
                              >
                                <div className="flex items-start space-x-3">
                                  <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                                        {cName}
                                      </p>
                                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                          Expired Today ⚠️
                                        </span>
                                        {item.phone && (
                                          <button
                                            title="Send Expired Subscription Notice"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              markAsRead(item.id);
                                              openClientWhatsApp({ client: item, contextOverride: 'EXPIRED' });
                                            }}
                                            className="p-1 rounded-lg border text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30 transition-colors"
                                          >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                      Membership expired today
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{item.client_code || item.phone}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Expiring Soon */}
                      {visibleExpiring.length > 0 && (
                        <div className="mb-1">
                          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-orange-400" />
                            <span>Expiring Soon</span>
                            <span className="bg-orange-500/20 text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {visibleExpiring.length}
                            </span>
                          </div>
                          {visibleExpiring.map((item) => {
                            const cId = item.client_id || item.id;
                            const cName = item.client_name || item.name || 'Member';
                            const isRead = readIds.includes(item.id);
                            return (
                              <button
                                key={`expiring-${item.id}`}
                                onClick={() => handleAlertClick(cId, item.id)}
                                className={`w-full px-4 py-3 hover:bg-[#181E2A] transition-colors text-left border-l-4 border-orange-500 group cursor-pointer ${
                                  isRead ? 'opacity-60' : ''
                                }`}
                              >
                                <div className="flex items-start space-x-3">
                                  <Clock className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                                        {cName}
                                      </p>
                                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/30">
                                          {item.days_remaining <= 0 ? 'Today' : `${item.days_remaining}d left`}
                                        </span>
                                        {item.phone && (
                                          <button
                                            title="Send Expiring Soon Reminder"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              markAsRead(item.id);
                                              openClientWhatsApp({ client: item, contextOverride: 'EXPIRING' });
                                            }}
                                            className="p-1 rounded-lg border text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)] transition-colors"
                                          >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {item.package_title || 'Membership'} expires in {item.days_remaining} day{item.days_remaining !== 1 ? 's' : ''}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{item.client_code || item.phone}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
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
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-[#121721]/50 rounded-xl transition-colors cursor-pointer"
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

