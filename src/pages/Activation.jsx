import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, Copy, Check, AlertCircle, Cpu } from 'lucide-react';

const Activation = ({ onActivationSuccess }) => {
  const navigate = useNavigate();
  const [machineId, setMachineId] = useState('LOADING...');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMachineId = async () => {
      try {
        const id = await window.electronAPI.license.getMachineId();
        setMachineId(id);
      } catch (err) {
        setMachineId('ERROR-FETCHING-ID');
      }
    };
    fetchMachineId();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    if (e) e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Please enter the license key.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.electronAPI.license.activate({ licenseKey: licenseKey.trim() });
      if (result.success) {
        if (onActivationSuccess) {
          await onActivationSuccess();
        }
        navigate('/login', { replace: true });
      } else {
        setError(result.error || 'Invalid or corrupted license key.');
      }
    } catch (err) {
      setError('System error during activation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4 relative overflow-hidden" dir="ltr">
      
      {/* Background kinetic effect */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#CCFF00]/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-[#8B5CF6]/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md">
        
        {/* Logo/Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-[#121721] border border-[#222B3D] flex items-center justify-center mb-4 shadow-xl shadow-black/50 relative">
            <div className="absolute inset-0 border border-[#CCFF00]/20 rounded-2xl animate-pulse"></div>
            <Shield className="w-10 h-10 text-[#CCFF00]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider mb-2 font-display">Alpha Gym System Activation</h1>
        </div>

        {/* Activation Card */}
        <div className="bg-[#121721] border border-[#222B3D] rounded-3xl p-6 shadow-2xl relative z-10">
          
          {error && (
            <div className="mb-6 bg-[#EF4444]/10 border border-[#EF4444]/20 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <p className="text-[#EF4444] text-sm font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            
            {/* Machine ID Section */}
            <div className="space-y-2">
              <label className="text-slate-400 text-xs font-bold tracking-widest flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-500" /> Hardware Machine ID
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#0B0E14] border border-[#222B3D] rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-[#8B5CF6] font-bold tracking-widest text-lg">{machineId}</span>
                </div>
                <button 
                  onClick={handleCopy}
                  className="bg-[#222B3D] hover:bg-slate-700 text-white p-3 rounded-xl transition-colors shrink-0 flex items-center justify-center border border-[#222B3D] hover:border-slate-500 relative"
                  title="Copy Code"
                >
                  {copied ? (
                    <>
                      <Check className="w-6 h-6 text-[#CCFF00]" />
                      <span className="absolute -top-8 bg-[#CCFF00] text-black text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap">Copied!</span>
                    </>
                  ) : (
                    <Copy className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#222B3D] to-transparent"></div>

            {/* License Key Input */}
            <form onSubmit={handleActivate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-slate-400 text-xs font-bold tracking-widest flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-500" /> License Key
                </label>
                <textarea
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Paste your activation license key here..."
                  rows={4}
                  className="w-full bg-[#0B0E14] border border-[#222B3D] rounded-xl px-4 py-3 text-white focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] outline-none transition-all font-mono text-sm resize-none"
                  dir="ltr"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#CCFF00] hover:bg-[#b8e600] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-black font-black text-lg py-3.5 rounded-xl transition-all shadow-lg shadow-[#CCFF00]/10 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <>Activate System</>
                )}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Activation;
