import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, Sparkles, Download, RefreshCw, Info, ExternalLink } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import CheckInModal from '../CheckInModal';
import WhatsNewModal from '../modals/WhatsNewModal';
import { CHANGELOG_DATA } from '../../data/changelog';

const TopNav = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('1.0.15');

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
      if (window.electronAPI.updater.check) {
        window.electronAPI.updater.check();
      }
    }
  }, []);

  const latestRelease = CHANGELOG_DATA?.[0] || {
    version: '1.0.15',
    title: 'النسخ السحابي الذكي، إدارة الاشتراكات، ولوحة التحكم الديناميكية',
    releaseDate: 'أكتوبر 2026'
  };

  const [clearedNotices, setClearedNotices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gym_cleared_system_notices') || '[]');
    } catch {
      return [];
    }
  });

  const [viewedNotices, setViewedNotices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gym_viewed_system_notices') || '[]');
    } catch {
      return [];
    }
  });

  const isUpdateVisible = updateInfo && !clearedNotices.includes('system_update');
  const releaseNoticeId = `release_v${latestRelease.version}`;
  const isReleaseVisible = !clearedNotices.includes(releaseNoticeId);

  const activeNotices = [];
  if (isUpdateVisible) {
    activeNotices.push({
      id: 'system_update',
      type: 'update',
      title: updateDownloaded ? 'Update Ready to Install' : `Update Available (v${updateInfo?.version || 'New'})`,
      desc: updateDownloaded ? 'Update downloaded. Restart the app to apply.' : 'A new official version of Alpha Gym is ready.',
      isDownloaded: updateDownloaded,
      progress: updateProgress
    });
  }
  if (isReleaseVisible) {
    activeNotices.push({
      id: releaseNoticeId,
      type: 'release',
      version: latestRelease.version,
      title: `Official Release v${latestRelease.version}`,
      desc: `${latestRelease.title} (${latestRelease.releaseDate})`,
      categories: latestRelease.categories || []
    });
  }

  const unreadCount = notificationOpen
    ? 0
    : activeNotices.filter((n) => !viewedNotices.includes(n.id)).length;

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
      const currentIds = activeNotices.map((n) => n.id);
      setViewedNotices((prev) => {
        const next = Array.from(new Set([...prev, ...currentIds]));
        try {
          localStorage.setItem('gym_viewed_system_notices', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  const handleClearAll = () => {
    const allIds = activeNotices.map((n) => n.id);
    const next = Array.from(new Set([...clearedNotices, ...allIds]));
    setClearedNotices(next);
    try {
      localStorage.setItem('gym_cleared_system_notices', JSON.stringify(next));
    } catch (e) {}
  };

  const handleOpenReleaseModal = (version) => {
    setSelectedVersion(version || latestRelease.version);
    setWhatsNewOpen(true);
    setNotificationOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-64 h-16 bg-[#0B0E14]/80 backdrop-blur-md border-b border-[#222B3D] z-10 flex items-center justify-between px-8">
        <div className="flex-1"></div>

        <div className="flex items-center space-x-6">
          {/* Notification Bell Badge — Exclusively System Updates & Releases */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={toggleNotificationDropdown}
              className="relative p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="System Notices & Updates"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1E293B] animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-[#121721] border border-[#222B3D] rounded-xl shadow-2xl z-50 max-h-[520px] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#222B3D] bg-[#0B0E14]">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">System Updates</h3>
                    {activeNotices.length > 0 && (
                      <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {activeNotices.length}
                      </span>
                    )}
                  </div>
                  {activeNotices.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer"
                    >
                      Dismiss All
                    </button>
                  )}
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto max-h-[440px] scrollbar-thin scrollbar-thumb-[#222B3D] scrollbar-track-transparent divide-y divide-[#222B3D]">
                  {activeNotices.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400">
                      <Bell className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-500" />
                      <p className="text-sm font-bold text-slate-300">System is Up to Date</p>
                      <p className="text-xs text-slate-500 mt-1">No pending updates or new releases</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {/* Live App Update Available */}
                      {isUpdateVisible && (
                        <div className="p-3 bg-blue-500/10 border-l-4 border-blue-500 mb-1">
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
                                      window.electronAPI?.updater?.quitAndInstall?.();
                                    }}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" /> Restart & Install
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.electronAPI?.updater?.download?.();
                                    }}
                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download Update
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Official System Release & Changelog Card */}
                      {isReleaseVisible && (
                        <div className="p-4 hover:bg-[#181E2A] transition-colors border-l-4 border-[#CCFF00]">
                          <div className="flex items-start space-x-3">
                            <Info className="w-5 h-5 text-[#CCFF00] mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-white">
                                  Official Release v{latestRelease.version}
                                </p>
                                <span className="bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  Installed
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1 font-medium">
                                {latestRelease.title}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Released {latestRelease.releaseDate}
                              </p>

                              <button
                                onClick={() => handleOpenReleaseModal(latestRelease.version)}
                                className="mt-3 px-3 py-1.5 bg-[#222B3D] hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[#CCFF00]" /> View What's New
                              </button>
                            </div>
                          </div>
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
      <WhatsNewModal
        isOpen={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
        currentVersion={selectedVersion}
      />
    </>
  );
};

export default TopNav;

