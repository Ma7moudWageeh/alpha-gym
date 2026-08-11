import React, { useState, useEffect } from 'react';
import { X, Download, RefreshCw, Info } from 'lucide-react';

export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState('hidden'); // hidden, available, downloading, downloaded
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.updater) {
      const unsubAvailable = window.electronAPI.updater.onUpdateAvailable((data) => {
        setUpdateInfo(data);
        setUpdateState('available');
      });

      const unsubProgress = window.electronAPI.updater.onDownloadProgress((data) => {
        setUpdateState('downloading');
        setProgress(data.percent || 0);
      });

      const unsubDownloaded = window.electronAPI.updater.onUpdateDownloaded(() => {
        setUpdateState('downloaded');
      });

      const unsubError = window.electronAPI.updater.onError((err) => {
        console.error("Updater Error:", err);
        setUpdateState('hidden');
      });

      return () => {
        if (unsubAvailable) unsubAvailable();
        if (unsubProgress) unsubProgress();
        if (unsubDownloaded) unsubDownloaded();
        if (unsubError) unsubError();
      };
    }
  }, []);

  const handleDownload = () => {
    if (window.electronAPI && window.electronAPI.updater) {
      setUpdateState('downloading');
      setProgress(0);
      window.electronAPI.updater.download();
    }
  };

  const handleInstall = () => {
    if (window.electronAPI && window.electronAPI.updater) {
      window.electronAPI.updater.quitAndInstall();
    }
  };

  const dismiss = () => {
    setUpdateState('hidden');
  };

  if (updateState === 'hidden') return null;

  return (
    <div className="fixed top-6 right-6 z-50 w-96 bg-[#0F172A] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="p-4">
        {updateState === 'available' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Info className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">New Update Available!</h3>
                  <p className="text-slate-400 text-xs">Version {updateInfo?.version} is ready.</p>
                </div>
              </div>
              <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={handleDownload}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" /> Download Update
              </button>
            </div>
          </div>
        )}

        {updateState === 'downloading' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-blue-500 animate-bounce" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-white font-bold text-sm">Downloading...</h3>
                  <span className="text-blue-500 text-xs font-bold">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {updateState === 'downloaded' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Update Downloaded!</h3>
                  <p className="text-slate-400 text-xs">Restart the app to install.</p>
                </div>
              </div>
              <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={handleInstall}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Restart & Install Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
