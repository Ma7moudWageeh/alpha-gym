import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import SetupWizard from './pages/SetupWizard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientProfile from './pages/ClientProfile';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AppShell from './components/layout/AppShell';
import UpdateNotification from './components/UpdateNotification';
import logo from './assets/logo.png';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const OwnerRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">Loading...</div>;
  }

  if (user?.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AppEntry = () => {
  const [checking, setChecking] = useState(true);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const result = await window.electronAPI.auth.checkOwnerExists();
        if (!result.exists) {
          navigate('/setup', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error("Failed to check setup:", err);
      } finally {
        setChecking(false);
      }
    };
    checkSetup();
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center">
        {!imageError ? (
          <img
            src={logo}
            alt="Loading"
            onError={() => setImageError(true)}
            className="w-24 h-24 mb-4 animate-pulse object-contain"
          />
        ) : (
          <div className="w-24 h-24 mb-4 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 flex items-center justify-center font-black text-3xl text-[#CCFF00] animate-pulse">
            AG
          </div>
        )}
        <p className="text-slate-400">Initializing Alpha Gym...</p>
      </div>
    );
  }

  return null;
};

function App() {
  return (
    <>
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<AppEntry />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected App Shell Routes */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientProfile />} />
          <Route path="/reports" element={<OwnerRoute><Reports /></OwnerRoute>} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
