import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, KeyRound } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import logo from '../assets/logo.png';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetData, setResetData] = useState({ username: '', masterPin: '', newPassword: '' });
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLoginChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleResetChange = (e) => {
    setResetData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.username || !formData.password) {
      setError('Username and password are required.');
      return;
    }
    setLoading(true);
    const result = await window.electronAPI.auth.login({
      username: formData.username,
      password: formData.password,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      login(result.user);
      navigate('/dashboard');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!resetData.username || !resetData.masterPin || !resetData.newPassword) {
      setResetError('All fields are required.');
      return;
    }
    setResetLoading(true);
    const result = await window.electronAPI.auth.resetPassword({
      username: resetData.username,
      pin: resetData.masterPin,
      newPassword: resetData.newPassword,
    });
    setResetLoading(false);
    if (result.error) {
      setResetError(result.error);
    } else {
      setResetSuccess('Password reset successfully. You can now log in.');
      setTimeout(() => setShowReset(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl p-8 space-y-6">
        {/* Logo & Title */}
        <div className="text-center">
          <img src={logo} alt="Alpha Gym Logo" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-black font-display text-white uppercase tracking-wider">Alpha Gym</h1>
          <p className="text-slate-400 mt-1 text-xs font-bold uppercase tracking-widest">Management System</p>
        </div>

        {error && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444] p-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleLoginChange}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                placeholder="coach"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Password</label>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6] hover:text-[#7c3aed] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleLoginChange}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#CCFF00] hover:bg-[#b8e600] active:scale-95 text-black font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Reset Password Modal */}
      {showReset && (
        <div className="fixed inset-0 bg-[#0B0E14]/90 flex items-center justify-center p-4 z-50">
          <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-black font-display text-white uppercase tracking-wider mb-5">Reset Password</h2>

            {resetError && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444] p-3 rounded-xl text-xs font-bold uppercase tracking-wider mb-4">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="bg-[#CCFF00]/10 border border-[#CCFF00]/40 text-[#CCFF00] p-3 rounded-xl text-xs font-bold uppercase tracking-wider mb-4">
                {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Username</label>
                <input
                  type="text"
                  name="username"
                  value={resetData.username}
                  onChange={handleResetChange}
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Master PIN</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    name="masterPin"
                    value={resetData.masterPin}
                    onChange={handleResetChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] tracking-widest transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={resetData.newPassword}
                  onChange={handleResetChange}
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReset(false)}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-[#222B3D] border border-[#222B3D] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
