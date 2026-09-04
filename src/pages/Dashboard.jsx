import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, MessageSquare, RefreshCw, X, CreditCard, ChevronRight, Printer, Snowflake } from 'lucide-react';
import CheckInModal from '../components/CheckInModal';
import { formatDateDDMMYYYY } from '../utils/dateFormat';
import DateInput from '../components/DateInput';

import { WhatsAppSingleButton } from '../components/common/WhatsAppButton';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const isOwner = user?.role === 'owner';
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    activeMembers: 0,
    frozenMembers: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    expiringSoon: 0
  });
  const [counts, setCounts] = useState({ expiring_soon_count: 0, total_alerts: 0 });
  const [expiringList, setExpiringList] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const [renewClient, setRenewClient] = useState(null);
  const [subFormData, setSubFormData] = useState({
    package_id: '',
    start_date: new Date().toISOString().split('T')[0],
    price: '',
    paid_amount: '',
    note: ''
  });
  const [subError, setSubError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const [metricsRes, countsRes, expiringRes, payRes, pkgRes] = await Promise.all([
      window.electronAPI.reports.getDashboardMetrics(),
      window.electronAPI.alerts.getCounts(),
      window.electronAPI.alerts.getExpiringSoon(),
      window.electronAPI.payments.getAll({ timeframe: 'month' }),
      window.electronAPI.packages.getAll()
    ]);

    if (metricsRes.success) setMetrics(metricsRes.metrics);
    if (countsRes.success) setCounts(countsRes);
    if (expiringRes.success) setExpiringList(expiringRes.subscriptions);
    if (payRes.success) setRecentPayments(payRes.payments.slice(0, 6));
    if (pkgRes.success) setPackages(pkgRes.packages.filter(p => p.is_active === 1));

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const onRefresh = () => fetchDashboardData();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboardData();
    };

    window.addEventListener('dashboard-refresh', onRefresh);
    window.addEventListener('focus', onRefresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('dashboard-refresh', onRefresh);
      window.removeEventListener('focus', onRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchDashboardData]);

  const openRenewModal = (sub) => {
    setRenewClient(sub);
    setSubError('');
    const defaultPkg = packages[0];
    setSubFormData({
      package_id: defaultPkg ? defaultPkg.id.toString() : '',
      start_date: new Date().toISOString().split('T')[0],
      price: defaultPkg ? defaultPkg.default_price.toString() : '',
      paid_amount: defaultPkg ? defaultPkg.default_price.toString() : '',
      note: 'Dashboard Renewal'
    });
  };

  const handlePackageSelect = (pkgId) => {
    const selected = packages.find(p => p.id.toString() === pkgId);
    if (selected) {
      setSubFormData(prev => ({
        ...prev,
        package_id: pkgId,
        price: selected.default_price.toString(),
        paid_amount: selected.default_price.toString()
      }));
    } else {
      setSubFormData(prev => ({ ...prev, package_id: pkgId }));
    }
  };

  const handleSubSubmit = async (e, shouldPrint = false) => {
    if (e) e.preventDefault();
    setSubError('');

    if (!subFormData.package_id || !subFormData.price) {
      setSubError('Package and price are required.');
      return;
    }

    const selectedPkg = packages.find(p => p.id.toString() === subFormData.package_id.toString());
    const pkgTitle = selectedPkg ? selectedPkg.title : 'Subscription';

    const payload = {
      client_id: renewClient.client_id,
      package_id: parseInt(subFormData.package_id, 10),
      start_date: subFormData.start_date,
      price: parseFloat(subFormData.price),
      paid_amount: parseFloat(subFormData.paid_amount || subFormData.price),
      note: subFormData.note
    };

    const result = await window.electronAPI.subscriptions.renew(payload);

    if (result.error) {
      setSubError(result.error);
    } else {
      const clientInfo = renewClient;
      setRenewClient(null);
      await fetchDashboardData();

      if (shouldPrint) {
        window.electronAPI.print.receipt({
          payment_id: result.subscription_id || 'RENEWAL',
          client_name: clientInfo.client_name,
          client_code: clientInfo.client_code,
          package_name: pkgTitle,
          amount: payload.price,
          paid_amount: payload.paid_amount,
          payment_date: payload.start_date,
          start_date: result.start_date || payload.start_date,
          end_date: result.end_date || '',
        });
      }
    }
  };


  const timeLeftLabel = (daysRemaining) => {
    const days = Number(daysRemaining);
    if (days === 0) return 'TODAY';
    if (days === 1) return '1 DAY';
    return `${days} DAYS`;
  };

  const validExpiringClients = (expiringList || []).filter((client) => {
    const daysLeft = client.days_remaining !== undefined ? Number(client.days_remaining) : Number(client.days_left);
    // Must not be overdue, and must be within the 1-day threshold
    return !Number.isNaN(daysLeft) && daysLeft >= 0 && daysLeft <= 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-display text-white uppercase tracking-wider">Dashboard</h1>
          <p className="text-slate-400 mt-1 uppercase tracking-widest text-xs font-bold">Welcome back, {user?.fullName || 'Operator'}!</p>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isOwner ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
        <div
          onClick={() => navigate('/clients?status=active')}
          className="card p-6 bg-[#121721] border-t-4 border-[#CCFF00] flex items-center justify-between cursor-pointer hover:border-[#CCFF00] hover:scale-[1.01] transition-all shadow-sm"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Active</p>
            <h3 className="text-4xl font-black font-display text-white mt-2">{metrics.activeMembers}</h3>
            <p className="text-xs text-[#CCFF00] mt-1 font-bold tracking-widest uppercase">Currently Subscribed</p>
          </div>
          <div className="p-3 bg-[#CCFF00]/10 rounded-xl border border-[#CCFF00]/20">
            <Users className="w-6 h-6 text-[#CCFF00]" />
          </div>
        </div>

        <div
          onClick={() => navigate('/clients?status=frozen')}
          className="card p-6 bg-[#121721] border-t-4 border-[#06B6D4] flex items-center justify-between cursor-pointer hover:border-[#06B6D4] hover:scale-[1.01] transition-all shadow-sm"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Frozen</p>
            <h3 className="text-4xl font-black font-display text-[#06B6D4] mt-2">{metrics.frozenMembers || 0}</h3>
            <p className="text-xs text-[#06B6D4]/80 mt-1 font-bold tracking-widest uppercase">Membership Paused</p>
          </div>
          <div className="p-3 bg-[#06B6D4]/10 rounded-xl border border-[#06B6D4]/20">
            <Snowflake className="w-6 h-6 text-[#06B6D4]" />
          </div>
        </div>

        {isOwner && (
          <div
            onClick={() => navigate('/reports')}
            className="card p-6 bg-[#121721] border-t-4 border-[#CCFF00] flex items-center justify-between cursor-pointer hover:border-[#CCFF00] hover:scale-[1.01] transition-all shadow-sm"
          >
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Today's Rev</p>
              <h3 className="text-3xl font-black font-display text-[#CCFF00] mt-2">{metrics.todayRevenue.toFixed(2)} EGP</h3>
              <p className="text-xs text-slate-500 mt-1 font-bold tracking-widest uppercase">Month: {metrics.monthRevenue.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-[#CCFF00]/10 rounded-xl border border-[#CCFF00]/20">
              <CreditCard className="w-6 h-6 text-[#CCFF00]" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="alerts-widget" className="lg:col-span-2 card overflow-hidden flex flex-col">
          <div className="border-b border-[#222B3D] bg-[#121721] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold tracking-wide text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>EXPIRING SOON ({validExpiringClients.length})</span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-wider text-sm">Loading alerts...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#181E2A] text-slate-400 text-xs uppercase tracking-widest font-black border-b border-[#222B3D]">
                    <th className="px-5 py-4">Member</th>
                    <th className="px-5 py-4">Package</th>
                    <th className="px-5 py-4">Time Left</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222B3D] text-sm">
                  {validExpiringClients.map((sub) => {
                    const daysLeft = sub.days_remaining !== undefined ? sub.days_remaining : sub.days_left;
                    return (
                      <tr
                        key={sub.id}
                        onClick={() => navigate(`/clients/${sub.client_id}`)}
                        className="cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-4 font-bold text-white">
                          {sub.client_name} <span className="text-slate-500 text-xs font-mono ml-1">({sub.client_code})</span>
                        </td>
                        <td className="px-5 py-4 text-slate-300 font-medium">{sub.package_title}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                            {timeLeftLabel(daysLeft)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <WhatsAppSingleButton
                              client={{ ...sub, name: sub.client_name, phone: sub.client_phone }}
                              context="EXPIRING"
                              disabled={!sub.client_phone}
                              size="md"
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); openRenewModal(sub); }}
                              className="inline-flex items-center px-4 py-2 bg-[#CCFF00] text-black hover:bg-[#b8e600] active:scale-95 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Renew
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {validExpiringClients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                        No memberships expiring soon.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden flex flex-col">
          <div className="border-b border-[#222B3D] bg-[#121721] px-6 py-4 flex items-center justify-between">
            <h3 className="font-black font-display tracking-wider uppercase text-white text-sm flex items-center">
              <CreditCard className="w-4 h-4 mr-2 text-[#CCFF00]" /> Recent Activity
            </h3>
            {isOwner && (
              <button
                onClick={() => navigate('/reports')}
                className="text-xs font-bold uppercase tracking-wider text-[#CCFF00] hover:underline flex items-center"
              >
                All <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#0B0E14]">
            {recentPayments.map((p) => (
              <div key={p.id} className="p-4 bg-[#121721] hover:bg-[#181E2A] rounded-xl border border-[#222B3D] flex items-center justify-between text-xs transition-colors">
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-wide">{p.client_name || 'Walk-in'}</p>
                  <p className="text-slate-400 mt-1 uppercase font-bold text-[10px] tracking-widest">{p.package_title || p.type}</p>
                  <p className="text-[#06B6D4] font-mono text-[10px] mt-1">{formatDateDDMMYYYY(p.paid_at)}</p>
                </div>
                <div className="text-right">
                  <span className="font-black font-display text-[#CCFF00] text-lg">+{p.amount.toFixed(0)}</span>
                </div>
              </div>
            ))}

            {recentPayments.length === 0 && (
              <div className="p-6 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                No recent transactions.
              </div>
            )}
          </div>
        </div>
      </div>

      <CheckInModal isOpen={checkInOpen} onClose={() => setCheckInOpen(false)} />

      {renewClient && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 flex items-center justify-center p-4 z-[70]">
          <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#222B3D] bg-[#0B0E14] flex justify-between items-center">
              <h3 className="text-lg font-black font-display tracking-wider uppercase text-white">
                Renew Membership
              </h3>
              <button onClick={() => setRenewClient(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubSubmit} className="p-6 space-y-5">
              {subError && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444] p-3 rounded-xl text-xs font-bold uppercase tracking-wide">
                  {subError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Select Package</label>
                <select
                  value={subFormData.package_id}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white font-medium outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition-all"
                >
                  {packages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.title} ({pkg.duration_days} DAYS) - {pkg.default_price} EGP
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Start Date</label>
                  <DateInput
                  value={subFormData.start_date}
                  onChange={(iso) => setSubFormData(prev => ({ ...prev, start_date: iso }))}
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white font-medium outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Price (EGP)</label>
                  <input
                    type="number"
                    value={subFormData.price}
                    onChange={(e) => setSubFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white font-medium outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Paid (EGP)</label>
                  <input
                    type="number"
                    value={subFormData.paid_amount}
                    onChange={(e) => setSubFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white font-medium outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Note / Ref</label>
                <input
                  type="text"
                  value={subFormData.note}
                  onChange={(e) => setSubFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="CASH, CARD..."
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white font-medium outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] transition-all uppercase placeholder-slate-600"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setRenewClient(null)}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-[#222B3D] border border-[#222B3D] text-white rounded font-bold uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white rounded font-bold uppercase tracking-wider text-xs transition-all active:scale-95"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubSubmit(e, true)}
                  className="px-4 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black rounded font-bold uppercase tracking-wider text-xs transition-all active:scale-95 flex items-center shadow-lg shadow-[#CCFF00]/20"
                >
                  <Printer className="w-4 h-4 mr-2" /> Save & Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
