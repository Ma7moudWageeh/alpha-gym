import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

const formatMonth = (yyyy_mm) => {
  const [year, month] = yyyy_mm.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return `${date.toLocaleString('default', { month: 'long' })} ${year} (${yyyy_mm})`;
};

export default function HistoricalArchive() {
  const [historicalData, setHistoricalData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('income'); // income or expenses

  const fetchHistoricalData = async (month = null) => {
    setLoading(true);
    try {
      const res = await window.electronAPI.reports.getHistoricalMonthlyData({ selectedMonth: month });
      if (res.success) {
        if (!month) {
          setHistoricalData(res.data);
          if (res.data.length > 0) {
            setSelectedMonth(res.data[res.data.length - 1].month); // Default to current/last month
          }
        } else {
          // If a specific month is requested, update that month in the array (or just use it for the detailed tables)
          // Actually, we can just fetch all without month, then we have all months' summaries.
          // Wait, the API returns incomeItems and expenseItems ONLY if selectedMonth is passed.
          // Let's first fetch all for the charts, then fetch the selected month for details.
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const [monthDetails, setMonthDetails] = useState(null);

  const fetchMonthDetails = async (month) => {
    try {
      const res = await window.electronAPI.reports.getHistoricalMonthlyData({ selectedMonth: month });
      if (res.success && res.data.length > 0) {
        setMonthDetails(res.data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const res = await window.electronAPI.reports.getHistoricalMonthlyData();
      if (res.success) {
        setHistoricalData(res.data);
        if (res.data.length > 0) {
          const lastMonth = res.data[res.data.length - 1].month;
          setSelectedMonth(lastMonth);
          await fetchMonthDetails(lastMonth);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchMonthDetails(selectedMonth);
    }
  }, [selectedMonth]);

  if (loading && historicalData.length === 0) {
    return <div className="p-8 text-center text-slate-400">Loading historical data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Timeline Selector */}
      <div className="flex items-center space-x-4 bg-brand-panel p-4 rounded-xl border border-[#222B3D]">
        <label htmlFor="month-selector" className="text-slate-400 font-bold uppercase tracking-widest text-sm">
          Select Archive Month:
        </label>
        <div className="relative">
          <select
            id="month-selector"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none bg-[#0B0E14] text-white font-semibold border border-[#222B3D] rounded-xl px-4 py-2.5 pr-10 focus:border-[#CCFF00] focus:outline-none transition-colors cursor-pointer"
          >
            {[...historicalData].reverse().map((data) => (
              <option key={data.month} value={data.month}>
                {formatMonth(data.month)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
      </div>

      {monthDetails && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-5 bg-brand-panel border-[#222B3D]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Revenue</p>
            <h3 className="text-2xl font-black font-display uppercase text-brand-success mt-1">{monthDetails.totalIncome.toFixed(2)} EGP</h3>
          </div>
          <div className="card p-5 bg-brand-panel border-[#222B3D]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Expenses</p>
            <h3 className="text-2xl font-black font-display uppercase text-brand-danger mt-1">{monthDetails.totalExpenses.toFixed(2)} EGP</h3>
          </div>
          <div className="card p-5 bg-brand-panel border-[#222B3D] border-t-2" style={{ borderTopColor: monthDetails.netProfit >= 0 ? '#10B981' : '#EF4444' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Net Profit</p>
            <h3 className={`text-2xl font-black font-display uppercase mt-1 ${monthDetails.netProfit >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
              {monthDetails.netProfit.toFixed(2)} EGP
            </h3>
          </div>
          <div className="card p-5 bg-brand-panel border-[#222B3D]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Subscriptions</p>
            <h3 className="text-2xl font-black font-display uppercase text-white mt-1">{monthDetails.subscriptionCount}</h3>
          </div>
        </div>
      )}

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 bg-brand-panel border-[#222B3D] h-80 flex flex-col">
          <h3 className="text-sm font-black font-display tracking-wider uppercase text-white mb-4">Revenue vs Expenses</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222B3D" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#181E2A' }} 
                  contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#222B3D', color: '#fff', borderRadius: '8px' }} 
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="totalIncome" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalExpenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="card p-5 bg-brand-panel border-[#222B3D] h-80 flex flex-col">
          <h3 className="text-sm font-black font-display tracking-wider uppercase text-white mb-4">Net Profit Trend</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222B3D" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#222B3D', color: '#fff', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#CCFF00" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Itemized Audit Logs */}
      {monthDetails && (
        <div className="card overflow-hidden">
          <div className="border-b border-[#222B3D] bg-brand-panel px-6 py-4 flex space-x-6 items-center justify-between">
            <div className="flex space-x-6">
              <button
                onClick={() => setActiveTab('income')}
                className={`font-semibold text-sm uppercase tracking-wider transition-colors pb-1 border-b-2 ${
                  activeTab === 'income'
                    ? 'text-brand-accent border-brand-accent'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                Income Log ({monthDetails.incomeItems.length})
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`font-semibold text-sm uppercase tracking-wider transition-colors pb-1 border-b-2 ${
                  activeTab === 'expenses'
                    ? 'text-brand-accent border-brand-accent'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                Expenses Log ({monthDetails.expenseItems.length})
              </button>
            </div>
          </div>
          
          <div className="bg-[#0B0E14]">
            {activeTab === 'income' ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121721] text-slate-400 text-xs uppercase tracking-widest font-black sticky top-0">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="px-5 py-3">Package / Type</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222B3D] text-sm">
                    {monthDetails.incomeItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#121721]/50 transition-colors">
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs">{formatDateDDMMYYYY(item.date) || '—'}</td>
                        <td className="px-5 py-3 text-white font-bold">{item.client_name || 'Walk-in'}</td>
                        <td className="px-5 py-3 text-slate-300">{item.package_title || item.type}</td>
                        <td className="px-5 py-3 text-right text-brand-success font-bold">+{item.amount.toFixed(2)} EGP</td>
                      </tr>
                    ))}
                    {monthDetails.incomeItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-xs">No income logged this month.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121721] text-slate-400 text-xs uppercase tracking-widest font-black sticky top-0">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222B3D] text-sm">
                    {monthDetails.expenseItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#121721]/50 transition-colors">
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs">{formatDateDDMMYYYY(item.date) || '—'}</td>
                        <td className="px-5 py-3">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#181E2A] text-slate-300">
                            {item.category || 'Miscellaneous'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white font-bold">{item.title} {item.description ? `- ${item.description}` : ''}</td>
                        <td className="px-5 py-3 text-right text-brand-danger font-bold">-{item.amount.toFixed(2)} EGP</td>
                      </tr>
                    ))}
                    {monthDetails.expenseItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-xs">No expenses logged this month.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
