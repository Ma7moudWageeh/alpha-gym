import React, { useState } from 'react';
import { Search, X, CheckCircle, AlertTriangle, Snowflake, HelpCircle, User } from 'lucide-react';

const CheckInModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const res = await window.electronAPI.subscriptions.checkIn({ query: query.trim() });
    setLoading(false);

    if (res.success) {
      setResult(res);
    }
  };

  const resetSearch = () => {
    setQuery('');
    setResult(null);
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <div className="bg-brand-surface border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-brand-panel">
          <h3 className="text-xl font-black font-display uppercase tracking-wider text-white flex items-center">
            <User className="w-5 h-5 mr-2 text-brand-accent" /> Quick Check-In
          </h3>
          <button onClick={() => { resetSearch(); onClose(); }} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter client code, phone or name..."
                autoFocus
                className="w-full pl-4 pr-4 py-3 bg-brand-panel border border-[#222B3D] rounded-xl text-white focus:ring-2 focus:ring-brand-accent outline-none text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-brand-accent hover:bg-[#b8e600] text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Check'}
            </button>
          </form>

          {result && (
            <div className="mt-4 animate-in fade-in duration-200">
              {result.status === 'VALID' && (
                <div className="bg-brand-success/10 border border-brand-success/40 rounded p-6 text-center space-y-3">
                  <CheckCircle className="w-16 h-16 text-brand-success mx-auto" />
                  <h4 className="text-2xl font-black font-display uppercase tracking-wider text-white">{result.client.name}</h4>
                  <p className="text-brand-success font-semibold tracking-wider text-lg">ACCESS GRANTED • ACTIVE</p>
                  <div className="text-slate-300 text-sm bg-[#0B0E14]/50 p-3 rounded border border-[#222B3D]">
                    <p>Package: <strong className="text-white">{result.subscription.package_title}</strong></p>
                    <p>Expires: <strong className="text-white">{result.subscription.end_date}</strong></p>
                  </div>
                </div>
              )}

              {result.status === 'EXPIRED' && (
                <div className="bg-brand-danger/10 border border-brand-danger/40 rounded p-6 text-center space-y-3">
                  <AlertTriangle className="w-16 h-16 text-brand-danger mx-auto" />
                  <h4 className="text-2xl font-black font-display uppercase tracking-wider text-white">{result.client?.name || 'Member'}</h4>
                  <p className="text-brand-danger font-semibold tracking-wider text-lg">ACCESS DENIED • EXPIRED</p>
                  {result.subscription && (
                    <div className="text-slate-300 text-sm bg-[#0B0E14]/50 p-3 rounded border border-[#222B3D]">
                      <p>Last Package: <strong className="text-white">{result.subscription.package_title}</strong></p>
                      <p>Expired on: <strong className="text-white">{result.subscription.end_date}</strong></p>
                    </div>
                  )}
                </div>
              )}

              {result.status === 'FROZEN' && (
                <div className="bg-brand-info/10 border border-brand-info/40 rounded p-6 text-center space-y-3">
                  <Snowflake className="w-16 h-16 text-brand-info mx-auto" />
                  <h4 className="text-2xl font-black font-display uppercase tracking-wider text-white">{result.client.name}</h4>
                  <p className="text-brand-info font-semibold tracking-wider text-lg">SUBSCRIPTION FROZEN</p>
                  <div className="text-slate-300 text-sm bg-[#0B0E14]/50 p-3 rounded border border-[#222B3D]">
                    <p>Frozen on: <strong className="text-white">{result.subscription.frozen_on || 'N/A'}</strong></p>
                  </div>
                </div>
              )}

              {result.status === 'NOT_FOUND' && (
                <div className="bg-[#121721]/80 border border-[#222B3D] rounded p-6 text-center space-y-3">
                  <HelpCircle className="w-16 h-16 text-slate-500 mx-auto" />
                  <h4 className="text-xl font-black font-display uppercase tracking-wider text-white">Client Not Found</h4>
                  <p className="text-slate-400 text-sm">No client matching "{query}" was found in the database.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInModal;
