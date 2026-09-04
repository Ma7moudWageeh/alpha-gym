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
  const [imageError, setImageError] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetData, setResetData] = useState({ username: '', masterPin: '', newPassword: '', confirmPassword: '' });
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLoginChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleResetChange = (e) => {
    setResetData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const closeReset = () => {
    setShowReset(false);
    setResetStep(1);
    setResetError('');
    setResetData({ username: '', masterPin: '', newPassword: '', confirmPassword: '' });
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

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!resetData.username || !resetData.masterPin) {
      setResetError('Username and Security PIN are required.');
      return;
    }
    setResetLoading(true);
    const result = await window.electronAPI.auth.verifyCredentialsPin({
      username: resetData.username,
      pin: resetData.masterPin,
    });
    setResetLoading(false);
    if (result.error) {
      setResetError(result.error);
      return;
    }
    setResetStep(2);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!resetData.newPassword) {
      setResetError('New password is required.');
      return;
    }
    if (resetData.newPassword !== resetData.confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetLoading(true);
    const result = await window.electronAPI.auth.resetPassword({
      username: resetData.username,
      pin: resetData.masterPin,
      newPassword: resetData.newPassword,
    });
    if (result.error) {
      setResetLoading(false);
      setResetError(result.error);
      return;
    }

    // Seamless auto-login with new credentials
    const loginResult = await window.electronAPI.auth.login({
      username: resetData.username,
      password: resetData.newPassword,
    });
    setResetLoading(false);

    if (loginResult.error) {
      setResetError(loginResult.error);
      return;
    }

    login(loginResult.user || result.user);
    closeReset();
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl p-8 space-y-6">
        {/* Logo & Title */}
        <div className="text-center">
          {!imageError ? (
            <img
              src={logo}
              alt="Alpha Gym Logo"
              onError={() => setImageError(true)}
              className="w-20 h-20 mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 flex items-center justify-center font-black text-2xl text-[#CCFF00]">
              AG
            </div>
          )}
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
                onClick={() => { setShowReset(true); setResetStep(1); setResetError(''); }}
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

      {/* Reset Password Modal — two-step */}
      {showReset && (
        <div className="fixed inset-0 bg-[#0B0E14]/90 flex items-center justify-center p-4 z-50">
          <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-black font-display text-white uppercase tracking-wider mb-1">
              {resetStep === 1 ? 'Verify Security PIN' : 'Set New Password'}
            </h2>
            <p className="text-slate-400 text-xs mb-5">
              {resetStep === 1
                ? 'Enter your username and Security PIN to continue.'
                : 'Choose a new password. You will be signed in automatically.'}
            </p>

            {resetError && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444] p-3 rounded-xl text-xs font-bold uppercase tracking-wider mb-4">
                {resetError}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleVerifyPin} className="space-y-4">
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
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Security PIN</label>
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

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={closeReset}
                    className="px-4 py-2.5 bg-[#181E2A] hover:bg-[#222B3D] border border-[#222B3D] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                  >
                    {resetLoading ? 'Verifying...' : 'Continue'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
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
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={resetData.confirmPassword}
                    onChange={handleResetChange}
                    className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setResetStep(1); setResetError(''); }}
                    className="px-4 py-2.5 bg-[#181E2A] hover:bg-[#222B3D] border border-[#222B3D] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                  >
                    {resetLoading ? 'Updating...' : 'Reset & Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
