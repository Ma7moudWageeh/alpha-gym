import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { DollarSign, ArrowUpRight, ArrowDownRight, TrendingUp, Plus, Trash2, Calendar, Lock, X, PieChart, Award, Users, ShieldAlert, Printer } from 'lucide-react';
import HistoricalArchive from '../components/HistoricalArchive';

const Reports = () => {
  const { user } = useContext(AuthContext);
  const isOwner = user?.role === 'owner';

  const [timeframe, setTimeframe] = useState('month');
  const [customMonth, setCustomMonth] = useState(''); // today, week, month, all
  const [activeTab, setActiveTab] = useState('payments'); // payments, expenses, analytics

  const [summary, setSummary] = useState({ revenue: 0, expenses: 0, netProfit: 0 });
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    title: '',
    amount: '',
    category: 'Rent',
    expense_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [expenseError, setExpenseError] = useState('');

  const categories = ['Rent', 'Salaries', 'Maintenance', 'Utilities', 'Equipment', 'Miscellaneous'];

  const fetchData = async () => {
    if (!isOwner) return;
    setLoading(true);

    const [sumRes, payRes, expRes, distRes, dashMetricsRes] = await Promise.all([
      window.electronAPI.reports.getSummary({ timeframe, customMonth }),
      window.electronAPI.payments.getAll({ timeframe }),
      window.electronAPI.expenses.getAll({ timeframe }),
      window.electronAPI.reports.getClientDistribution(),
      window.electronAPI.reports.getDashboardMetrics({ timeframe, customMonth })
    ]);

    if (sumRes.success) setSummary(sumRes.summary);
    if (payRes.success) setPayments(payRes.payments);
    if (expRes.success) setExpenses(expRes.expenses);
    if (distRes.success) setDistribution(distRes.distribution);
    if (dashMetricsRes.success) setMetrics(dashMetricsRes.metrics);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [timeframe, isOwner]);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseError('');

    if (!expenseFormData.title || !expenseFormData.amount) {
      setExpenseError('Title and Amount are required.');
      return;
    }

    const result = await window.electronAPI.expenses.create({
      title: expenseFormData.title,
      amount: parseFloat(expenseFormData.amount),
      category: expenseFormData.category,
      notes: expenseFormData.notes,
      expense_date: expenseFormData.expense_date
    });

    if (result.error) {
      setExpenseError(result.error);
    } else {
      setIsExpenseModalOpen(false);
      setExpenseFormData({
        title: '',
        amount: '',
        category: 'Rent',
        expense_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    }
  };

  const handleExpenseDelete = async (id) => {
    if (!isOwner) return;
    if (window.confirm("Delete this expense record?")) {
      const result = await window.electronAPI.expenses.delete({ id, userRole: user.role });
      if (result.success) {
        fetchData();
      } else {
        alert(result.error || 'Failed to delete expense');
      }
    }
  };

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-brand-danger" />
        </div>
        <h2 className="text-2xl font-black font-display uppercase tracking-wider text-white">Access Restricted</h2>
        <p className="text-slate-400 max-w-md">
          Financial reports and analytics are strictly restricted to the System Owner.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-wider text-white">Reports & Analytics</h1>
          <p className="text-slate-400 mt-1">Track financial performance, membership growth, and plan sales.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center px-4 py-2.5 bg-brand-accent hover:bg-[#b8e600] text-black rounded-xl transition-colors font-medium shadow"
          >
            <Plus className="w-5 h-5 mr-2" /> Log Expense
          </button>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex space-x-2 bg-brand-panel p-1 rounded border border-[#222B3D] w-fit">
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'historical', label: 'All-Time Monthly Archive' }
        ].map(tf => (
          <button
            key={tf.key}
            onClick={() => setTimeframe(tf.key)}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
              timeframe === tf.key
                ? 'bg-[#181E2A] text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {timeframe === 'historical' ? (
        <HistoricalArchive />
      ) : (
        <>
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 bg-brand-panel border-[#222B3D] flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Revenue</p>
            <h3 className="text-3xl font-black font-display uppercase tracking-wider text-brand-success mt-2">{summary.revenue.toFixed(2)} EGP</h3>
            <div className="flex items-center text-xs font-semibold text-brand-success mt-2">
              <ArrowUpRight className="w-4 h-4 mr-1" /> Gross Inflow
            </div>
          </div>
          <div className="p-3 bg-brand-success/10 rounded border border-brand-success/20">
            <DollarSign className="w-6 h-6 text-brand-success" />
          </div>
        </div>

        <div className="card p-6 bg-brand-panel border-[#222B3D] flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Expenses</p>
            <h3 className="text-3xl font-black font-display uppercase tracking-wider text-brand-danger mt-2">{summary.expenses.toFixed(2)} EGP</h3>
            <div className="flex items-center text-xs font-semibold text-brand-danger mt-2">
              <ArrowDownRight className="w-4 h-4 mr-1" /> Logged Outflows
            </div>
          </div>
          <div className="p-3 bg-brand-danger/10 rounded border border-brand-danger/20">
            <DollarSign className="w-6 h-6 text-brand-danger" />
          </div>
        </div>

        <div className="card p-6 bg-brand-panel border-[#222B3D] flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Net Profit / Loss</p>
            <h3 className={`text-3xl font-black font-display uppercase tracking-wider mt-2 ${summary.netProfit >= 0 ? 'text-white' : 'text-brand-danger'}`}>
              {summary.netProfit.toFixed(2)} EGP
            </h3>
            <div className={`flex items-center text-xs font-semibold mt-2 ${summary.netProfit >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
              <TrendingUp className="w-4 h-4 mr-1" /> {summary.netProfit >= 0 ? 'Positive Margin' : 'Negative Margin'}
            </div>
          </div>
          <div className="p-3 bg-brand-accent/10 rounded border border-brand-accent/20">
            <TrendingUp className="w-6 h-6 text-brand-accent" />
          </div>
        </div>
      </div>

      {/* Member & Package Analytics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Status Distribution Card */}
        <div className="card p-6 bg-brand-panel border-[#222B3D]">
          <h3 className="text-lg font-black font-display uppercase tracking-wider text-white mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-brand-info" /> Membership Distribution
          </h3>

          {distribution ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0B0E14]/60 p-4 rounded border border-[#222B3D]">
                  <span className="text-xs text-slate-400 block font-medium">Active Members</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-display uppercase tracking-wider text-brand-success">{distribution.active.count}</span>
                    <span className="text-xs font-semibold text-brand-success bg-brand-success/10 px-2 py-0.5 rounded-full">{distribution.active.percentage}%</span>
                  </div>
                </div>

                <div className="bg-[#0B0E14]/60 p-4 rounded border border-[#222B3D]">
                  <span className="text-xs text-slate-400 block font-medium">Frozen Members</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-display uppercase tracking-wider text-brand-info">{distribution.frozen.count}</span>
                    <span className="text-xs font-semibold text-brand-info bg-brand-info/10 px-2 py-0.5 rounded-full">{distribution.frozen.percentage}%</span>
                  </div>
                </div>

                <div className="bg-[#0B0E14]/60 p-4 rounded border border-[#222B3D]">
                  <span className="text-xs text-slate-400 block font-medium">Expired Members</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-display uppercase tracking-wider text-brand-danger">{distribution.expired.count}</span>
                    <span className="text-xs font-semibold text-brand-danger bg-brand-danger/10 px-2 py-0.5 rounded-full">{distribution.expired.percentage}%</span>
                  </div>
                </div>

                <div className="bg-[#0B0E14]/60 p-4 rounded border border-[#222B3D]">
                  <span className="text-xs text-slate-400 block font-medium">Total Registered</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-display uppercase tracking-wider text-white">{distribution.totalClients}</span>
                    <span className="text-xs text-slate-500">100%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Loading distribution...</div>
          )}
        </div>

        {/* Package Popularity Card */}
        <div className="card p-6 bg-brand-panel border-[#222B3D]">
          <h3 className="text-lg font-black font-display uppercase tracking-wider text-white mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-brand-accent" /> Package Performance & Sales
          </h3>

          {metrics?.packageStats ? (
            <div className="space-y-3">
              {metrics.packageStats.map((pkg, idx) => (
                <div key={idx} className="bg-[#0B0E14]/60 p-3.5 rounded border border-[#222B3D] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white text-sm">{pkg.title}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{pkg.sales_count} subscriptions sold</p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-brand-success text-sm">{pkg.total_revenue.toFixed(2)} EGP</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Loading package performance...</div>
          )}
        </div>
      </div>

      {/* Tabs & Table for Detailed Logs */}
      <div className="card overflow-hidden">
        <div className="border-b border-[#222B3D] bg-brand-panel px-6 py-4 flex space-x-6">
          <button
            onClick={() => setActiveTab('payments')}
            className={`font-semibold text-base transition-colors pb-1 border-b-2 ${
              activeTab === 'payments'
                ? 'text-brand-accent border-brand-accent'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Payments Ledger ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`font-semibold text-base transition-colors pb-1 border-b-2 ${
              activeTab === 'expenses'
                ? 'text-brand-accent border-brand-accent'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Expenses Log ({expenses.length})
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading records...</div>
        ) : activeTab === 'payments' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121721]/50 text-slate-300 text-sm">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Type / Package</th>
                  <th className="px-6 py-4 font-medium">Note</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                  <th className="px-6 py-4 font-medium text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#121721]/20 transition-colors">
                    <td className="px-6 py-4 text-slate-400 text-sm font-mono">{p.paid_at?.split(' ')[0] || '-'}</td>
                    <td className="px-6 py-4 font-medium text-white">
                      {p.client_name || 'Client'} <span className="text-slate-500 text-xs font-mono">({p.client_code})</span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 capitalize">{p.package_title || p.type}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{p.note || '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-brand-success">+{p.amount.toFixed(2)} EGP</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => window.electronAPI.print.receipt({
                          payment_id: p.id,
                          client_name: p.client_name,
                          client_code: p.client_code,
                          package_name: p.package_title || p.type,
                          paid_amount: p.amount,
                          payment_date: p.paid_at?.split(' ')[0]
                        })}
                        className="p-1.5 bg-[#121721] hover:bg-[#181E2A] text-brand-accent rounded-xl transition-colors border border-[#222B3D]"
                        title="Print Thermal Receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No payments found for selected timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121721]/50 text-slate-300 text-sm">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Expense Title</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Notes</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                  <th className="px-6 py-4 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-[#121721]/20 transition-colors">
                    <td className="px-6 py-4 text-slate-400 text-sm font-mono">{e.expense_date}</td>
                    <td className="px-6 py-4 font-medium text-white">{e.title}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#181E2A] text-slate-300">
                        {e.category || 'Miscellaneous'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{e.description || '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-brand-danger">-{e.amount.toFixed(2)} EGP</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleExpenseDelete(e.id)} className="text-slate-500 hover:text-red-400 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No expenses found for selected timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 flex items-center justify-center p-4 z-[70]">
          <div className="bg-brand-surface border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-brand-panel">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">Log Expense</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
              {expenseError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm">
                  {expenseError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Expense Title *</label>
                <input
                  type="text"
                  value={expenseFormData.title}
                  onChange={(e) => setExpenseFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. July Electricity Bill"
                  className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Amount (EGP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseFormData.amount}
                    onChange={(e) => setExpenseFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="150.00"
                    className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Category</label>
                  <select
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Expense Date</label>
                <input
                  type="date"
                  value={expenseFormData.expense_date}
                  onChange={(e) => setExpenseFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Notes (Optional)</label>
                <textarea
                  value={expenseFormData.notes}
                  onChange={(e) => setExpenseFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="2"
                  className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-brand-accent hover:bg-[#b8e600] text-black rounded-xl text-sm font-semibold shadow-md"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default Reports;
