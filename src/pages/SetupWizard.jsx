import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Lock, KeyRound } from 'lucide-react';
import logo from '../assets/logo.png';

const SetupWizard = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    masterPin: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName || !formData.username || !formData.password || !formData.masterPin) {
      setError('All fields are required.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!/^\d{4,6}$/.test(formData.masterPin)) {
      setError('Master PIN must be 4 to 6 numeric digits.');
      return;
    }

    setLoading(true);
    const result = await window.electronAPI.auth.setupOwner({
      fullName: formData.fullName,
      username: formData.username,
      password: formData.password,
      masterPin: formData.masterPin
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#121721] rounded shadow-xl border border-[#222B3D] p-8 space-y-6">
        <div className="text-center">
          <img src={logo} alt="Alpha Gym Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-black font-display uppercase tracking-wider text-white tracking-tight">System Setup</h1>
          <p className="text-slate-400 mt-2">Create the master owner account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                placeholder="coach"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Master PIN (4-6 digits)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                name="masterPin"
                value={formData.masterPin}
                onChange={handleChange}
                maxLength="6"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all tracking-widest"
                placeholder="••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] text-white font-semibold rounded shadow-md transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating Owner...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupWizard;
