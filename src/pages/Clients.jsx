import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  Search, Plus, Edit2, Trash2, User, X, Printer,
  ChevronRight, Calendar, AlertCircle, CheckSquare, Square,
  Users, Activity, Snowflake, MessageCircle
} from 'lucide-react';
import { formatDateDDMMYYYY, getAvatarGlowClass, getClientEffectiveStatus, getTodayStr, addDays } from '../utils/dateFormat';
import DateInput from '../components/DateInput';
import SettleDebtModal from '../components/modals/SettleDebtModal';
import { openClientWhatsApp } from '../utils/whatsapp';
import { WhatsAppContextualButtons } from '../components/common/WhatsAppButton';

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcAge(birthDate) {
  if (!birthDate) return '';
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age > 0 ? String(age) : '';
}

const EMPTY_CLIENT_FORM = {
  name: '', phone: '', birth_date: '', height_cm: '', weight_kg: '',
  area: '', other_sports: '', injuries: '',
  has_conditions: false, medical_details: '', notes: '',
};

const EMPTY_SUB_FORM = {
  package_id: '', start_date: getTodayStr(),
  price: '', paid_amount: '', note: '',
};

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function ClientAvatar({ client, name }) {
  const [broken, setBroken] = useState(false);
  const photoUrl = client?.profile_photo_url || client?.photoUrl || client?.photo_url;
  const initials = getInitials(name || client?.full_name || client?.name);
  const glowClass = getAvatarGlowClass(client);

  return (
    <div
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-300 ${glowClass} bg-slate-900/80 text-lime-400 select-none mr-3 flex-shrink-0`}
    >
      {photoUrl && !broken ? (
        <img
          src={photoUrl}
          alt={name || client?.name}
          className="w-full h-full object-cover rounded-xl"
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// ─── status badge ──────────────────────────────────────────────────────────────
const getStatusBadge = (status) => {
  const norm = String(status || '').toUpperCase();
  switch (norm) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-lime-400/10 text-lime-400 border border-lime-400/30">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400 mr-1.5"></span> ACTIVE
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span> EXPIRED
        </span>
      );
    case 'FROZEN':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-cyan-400/10 text-cyan-400 border border-cyan-400/30">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5"></span> FROZEN
        </span>
      );
    case 'INACTIVE':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-500/10 text-slate-400 border border-slate-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span> INACTIVE
        </span>
      );
    case 'NO PLAN':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-500/10 text-slate-400 border border-slate-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span> NO PLAN
        </span>
      );
  }
};

// ══════════════════════════════════════════════════════════════════════════════
const Clients = () => {
  const { user } = useContext(AuthContext);
  const isOwner = user?.role === 'owner';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [totalClients, setTotalClients] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ all: 0, active: 0, frozen: 0, expired: 0 });
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');

  useEffect(() => {
    const statusFromUrl = searchParams.get('status');
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl);
    }
  }, [searchParams]);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientFormData, setClientFormData] = useState(EMPTY_CLIENT_FORM);
  const [addInitialMembership, setAddInitialMembership] = useState(false);
  const [subFormData, setSubFormData] = useState(EMPTY_SUB_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newlyCreatedClient, setNewlyCreatedClient] = useState(null); // for post-create WA welcome
  const [clientToSettle, setClientToSettle] = useState(null);

  const activeTab = (statusFilter || 'all').toUpperCase();
  const setActiveTab = (tab) => setStatusFilter(tab.toLowerCase());

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    if (window.electronAPI?.clients?.getStats) {
      const res = await window.electronAPI.clients.getStats();
      if (res?.success && res.counts) {
        setStatusCounts(res.counts);
        if (res.total !== undefined) {
          setTotalClients(res.total);
        }
      }
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    // Always fetch full roster (status=all) so KPI counts stay accurate;
    // Expired filter applies the 30-day window client-side / via days_since_expiry.
    const result = await window.electronAPI.clients.getAll({ search: searchQuery, status: 'all' });
    if (result.success) {
      setClients(result.clients);
      if (result.totalCount !== undefined) {
        setTotalClients(result.totalCount);
      }
      if (result.counts) {
        setStatusCounts(result.counts);
      }
    }
    await fetchStats();
    setLoading(false);
  };

  const handleDebtSettled = async (clientId, settledAmount, newRemainingDebt) => {
    setClients((prevClients) =>
      prevClients.map((client) => {
        if (client.id === clientId) {
          const remaining = newRemainingDebt !== undefined
            ? Math.max(0, newRemainingDebt)
            : Math.max(0, Number(client.remaining_debt || 0) - Number(settledAmount || 0));
          return { ...client, remaining_debt: remaining };
        }
        return client;
      })
    );
    await fetchClients();
  };

  const fetchPackages = async () => {
    const result = await window.electronAPI.packages.getAll();
    if (result.success) setPackages(result.packages.filter(p => p.is_active === 1));
  };

  useEffect(() => { fetchPackages(); }, []);

  useEffect(() => {
    window.addEventListener('focus', fetchClients);
    window.addEventListener('dashboard-refresh', fetchClients);
    return () => {
      window.removeEventListener('focus', fetchClients);
      window.removeEventListener('dashboard-refresh', fetchClients);
    };
  }, [searchQuery]);

  useEffect(() => {
    const id = setTimeout(fetchClients, 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const debtCount = useMemo(() => {
    return clients.filter((c) => Number(c.remaining_debt || 0) > 0).length;
  }, [clients]);

  const displayedClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = clients.filter((client) => {
      if (q) {
        const matchesName = (client.name || '').toLowerCase().includes(q);
        const matchesPhone = (client.phone || '').includes(q);
        const matchesCode = (client.client_code || '').toLowerCase().includes(q);
        const matchesId = String(client.id || '').includes(q);
        if (!matchesName && !matchesPhone && !matchesCode && !matchesId) return false;
      }

      if (activeTab === 'ACTIVE') {
        return getClientEffectiveStatus(client) === 'ACTIVE';
      }
      if (activeTab === 'FROZEN') {
        return getClientEffectiveStatus(client) === 'FROZEN';
      }
      if (activeTab === 'EXPIRED') {
        return getClientEffectiveStatus(client) === 'EXPIRED';
      }
      if (activeTab === 'DEBT') {
        return Number(client.remaining_debt || 0) > 0;
      }
      return true; // 'ALL' tab
    });

    if (activeTab === 'DEBT') {
      result.sort((a, b) => {
        const debtDiff = Number(b.remaining_debt || 0) - Number(a.remaining_debt || 0);
        if (debtDiff !== 0) return debtDiff;
        return (b.id || 0) - (a.id || 0);
      });
    } else if (activeTab === 'EXPIRED') {
      result.sort((a, b) => {
        const dateA = new Date(a.end_date || a.subscription_end || a.latest_end_date || 0).getTime();
        const dateB = new Date(b.end_date || b.subscription_end || b.latest_end_date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || 0) - (a.id || 0);
      });
    } else {
      result.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return result;
  }, [clients, activeTab, searchQuery]);

  const totalCount = clients.length > 0 ? clients.length : (statusCounts.all || totalClients || 0);
  const activeCount = clients.length > 0 ? clients.filter((c) => getClientEffectiveStatus(c) === 'ACTIVE').length : (statusCounts.active || 0);
  const frozenCount = clients.length > 0 ? clients.filter((c) => getClientEffectiveStatus(c) === 'FROZEN').length : (statusCounts.frozen || 0);
  const expiredCount = clients.length > 0 ? clients.filter((c) => getClientEffectiveStatus(c) === 'EXPIRED').length : (statusCounts.expired || 0);

  const endDatePreview = (() => {
    if (!addInitialMembership || !subFormData.package_id || !subFormData.start_date) return null;
    const pkg = packages.find(p => p.id.toString() === subFormData.package_id);
    if (!pkg) return null;
    const duration = pkg.duration_days || 30;
    return addDays(subFormData.start_date, duration - 1);
  })();

  // ── open form ──────────────────────────────────────────────────────────────
  const openFormModal = (client = null) => {
    setFormError('');
    setAddInitialMembership(false);
    if (client) {
      setEditingClient(client);
      setClientFormData({
        name: client.name || '',
        phone: client.phone || '',
        birth_date: client.date_of_birth || '',
        height_cm: client.height_cm || '',
        weight_kg: client.weight_kg || '',
        area: client.area || '',
        other_sports: client.other_sports || '',
        injuries: client.injuries || '',
        has_conditions: !!client.has_conditions,
        medical_details: client.medical_details || '',
        notes: client.notes || '',
      });
      setSubFormData(EMPTY_SUB_FORM);
    } else {
      setEditingClient(null);
      setClientFormData(EMPTY_CLIENT_FORM);
      const defaultPkg = packages[0];
      setSubFormData({
        package_id: defaultPkg ? defaultPkg.id.toString() : '',
        start_date: new Date().toISOString().split('T')[0],
        price: defaultPkg ? defaultPkg.default_price.toString() : '',
        paid_amount: defaultPkg ? defaultPkg.default_price.toString() : '',
        note: '',
      });
    }
    setIsFormModalOpen(true);
  };

  // ── package select ─────────────────────────────────────────────────────────
  const handlePackageSelect = (pkgId) => {
    const pkg = packages.find(p => p.id.toString() === pkgId);
    setSubFormData(prev => ({
      ...prev,
      package_id: pkgId,
      price: pkg ? pkg.default_price.toString() : prev.price,
      paid_amount: pkg ? pkg.default_price.toString() : prev.paid_amount,
    }));
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleClientSubmit = async (e, printAfter = false) => {
    e.preventDefault();
    setFormError('');

    if (!clientFormData.name.trim() || !clientFormData.phone.trim()) {
      setFormError('Full Name and Phone are required.');
      return;
    }
    if (addInitialMembership && !editingClient) {
      if (!subFormData.package_id || !subFormData.price) {
        setFormError('Please select a package and confirm the price for the initial membership.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let clientId, clientCode;

      if (editingClient) {
        const res = await window.electronAPI.clients.update({
          id: editingClient.id,
          name: clientFormData.name,
          phone: clientFormData.phone,
          date_of_birth: clientFormData.birth_date || null,
          height_cm: parseFloat(clientFormData.height_cm) || 0,
          weight_kg: parseFloat(clientFormData.weight_kg) || 0,
          area: clientFormData.area || null,
          other_sports: clientFormData.other_sports || null,
          injuries: clientFormData.injuries || null,
          has_conditions: clientFormData.has_conditions ? 1 : 0,
          medical_details: clientFormData.medical_details || null,
          notes: clientFormData.notes || null,
        });
        if (res.error) { setFormError(res.error); return; }
        await fetchClients();
        if (typeof fetchStats === 'function') {
          await fetchStats();
        }
        window.dispatchEvent(new Event('dashboard-refresh'));
        setIsFormModalOpen(false);
        return;
      }

      // Create new client
      const createRes = await window.electronAPI.clients.create({
        name: clientFormData.name,
        phone: clientFormData.phone,
        birth_date: clientFormData.birth_date || null,
        height_cm: parseFloat(clientFormData.height_cm) || 0,
        weight_kg: parseFloat(clientFormData.weight_kg) || 0,
        area: clientFormData.area || null,
        other_sports: clientFormData.other_sports || null,
        injuries: clientFormData.injuries || null,
        has_conditions: clientFormData.has_conditions ? 1 : 0,
        medical_details: clientFormData.medical_details || null,
        notes: clientFormData.notes || null,
      });

      if (createRes.error) { setFormError(createRes.error); return; }
      clientId = createRes.id;
      clientCode = createRes.client_code;

      // Optional initial membership
      if (addInitialMembership && subFormData.package_id) {
        const pkg = packages.find(p => p.id.toString() === subFormData.package_id);
        const cleanPrice = Number(parseFloat(subFormData.price || 0).toFixed(2));
        const cleanPaid = Number(parseFloat(subFormData.paid_amount !== '' && subFormData.paid_amount !== undefined ? subFormData.paid_amount : cleanPrice).toFixed(2));
        const planPrice = Math.max(0, cleanPrice);
        const paidAmount = Math.max(0, cleanPaid);
        const remainingAmount = Math.max(0, Number((planPrice - paidAmount).toFixed(2)));

        const subRes = await window.electronAPI.subscriptions.create({
          client_id: clientId,
          package_id: parseInt(subFormData.package_id, 10),
          plan_id: parseInt(subFormData.package_id, 10),
          start_date: subFormData.start_date,
          price: planPrice,
          planPrice: planPrice,
          paid_amount: paidAmount,
          paidAmount: paidAmount,
          remaining_amount: remainingAmount,
          remainingAmount: remainingAmount,
          note: subFormData.note,
        });

        if (subRes.error) {
          setFormError(`Client created but subscription failed: ${subRes.error}`);
          return;
        }

        // Auto-print receipt if requested
        if (printAfter) {
          window.electronAPI.print.receipt({
            payment_id: subRes.subscription_id || clientId,
            client_name: clientFormData.name,
            client_phone: clientFormData.phone,
            client_age: calcAge(clientFormData.birth_date),
            client_weight: clientFormData.weight_kg,
            client_area: clientFormData.area || '',
            client_code: clientCode,
            package_name: pkg ? pkg.title : 'Subscription',
            amount: planPrice,
            price: planPrice,
            planPrice: planPrice,
            paid_amount: paidAmount,
            paidAmount: paidAmount,
            remaining_amount: remainingAmount,
            remainingAmount: remainingAmount,
            start_date: subFormData.start_date,
            end_date: subRes.end_date || endDatePreview || '',
            payment_date: subFormData.start_date,
          });
        }
      }

      // Immediately re-fetch full client list and refreshed stats BEFORE closing modal
      await fetchClients();
      if (typeof fetchStats === 'function') {
        await fetchStats();
      }
      window.dispatchEvent(new Event('dashboard-refresh'));
      setIsFormModalOpen(false);

      const createdClientData = {
        id: clientId,
        name: clientFormData.name,
        phone: clientFormData.phone,
        client_code: clientCode,
        end_date: addInitialMembership ? endDatePreview : null,
        created_at: new Date().toISOString(),
      };
      const effectiveStatus = getClientEffectiveStatus(createdClientData);
      setNewlyCreatedClient({
        ...createdClientData,
        status: effectiveStatus,
        sub_status: effectiveStatus.toLowerCase(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!isOwner) return;
    if (!window.confirm('Delete this client permanently? All their records will be removed.')) return;
    const res = await window.electronAPI.clients.delete({ id, userRole: user.role });
    if (res.success) {
      await fetchClients();
      if (typeof fetchStats === 'function') {
        await fetchStats();
      }
      window.dispatchEvent(new Event('dashboard-refresh'));
    } else {
      alert(res.error || 'Failed to delete client');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Post-create WhatsApp welcome banner */}
      {newlyCreatedClient && (
        <div className={`flex items-center justify-between p-4 border rounded-xl text-sm ${
          newlyCreatedClient.status === 'EXPIRED'
            ? 'bg-rose-500/10 border-rose-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div className={`flex items-center gap-2 ${
            newlyCreatedClient.status === 'EXPIRED' ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              <span className="font-bold">{newlyCreatedClient.name}</span> was added successfully.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {newlyCreatedClient.phone && (
              <button
                onClick={() => openClientWhatsApp({
                  client: newlyCreatedClient,
                  contextOverride: newlyCreatedClient.status === 'EXPIRED' ? 'EXPIRED' : 'WELCOME',
                })}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors ${
                  newlyCreatedClient.status === 'EXPIRED'
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-[#25D366] hover:bg-[#1da854]'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {newlyCreatedClient.status === 'EXPIRED'
                  ? 'Send Expired Notice via WhatsApp'
                  : 'Send Welcome Message via WhatsApp'}
              </button>
            )}
            <button
              onClick={() => setNewlyCreatedClient(null)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-display text-white uppercase tracking-wider">Clients</h1>
          <p className="text-slate-400 mt-1 uppercase tracking-widest text-xs font-bold">Total registered athletes: {totalClients}</p>
        </div>
        <button
          onClick={() => openFormModal()}
          className="flex items-center px-5 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] active:scale-95 text-black rounded-xl transition-all font-black uppercase tracking-wider text-sm"
        >
          <Plus className="w-5 h-5 mr-1" /> Add Client
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div 
          onClick={() => setActiveTab('ALL')}
          className={`card p-5 bg-[#121721] border ${activeTab === 'ALL' ? 'border-slate-400 bg-slate-800/20' : 'border-[#222B3D] hover:border-slate-600'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">All Clients</p>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-3xl font-black font-display text-white mt-2">{totalCount}</h3>
        </div>

        <div 
          onClick={() => setActiveTab('ACTIVE')}
          className={`card p-5 bg-[#121721] border ${activeTab === 'ACTIVE' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#222B3D] hover:border-emerald-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-400'}`}>Active</p>
            <Activity className={`w-4 h-4 ${activeTab === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <h3 className={`text-3xl font-black font-display mt-2 ${activeTab === 'ACTIVE' ? 'text-emerald-400' : 'text-[#CCFF00]'}`}>
            {activeCount}
          </h3>
        </div>

        <div 
          onClick={() => setActiveTab('FROZEN')}
          className={`card p-5 bg-[#121721] border ${activeTab === 'FROZEN' ? 'border-sky-500 bg-sky-500/10' : 'border-[#222B3D] hover:border-sky-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'FROZEN' ? 'text-sky-400' : 'text-slate-400'}`}>Frozen</p>
            <Snowflake className={`w-4 h-4 ${activeTab === 'FROZEN' ? 'text-sky-400' : 'text-slate-500'}`} />
          </div>
          <h3 className="text-3xl font-black font-display mt-2 text-sky-400">
            {frozenCount}
          </h3>
        </div>

        <div 
          onClick={() => setActiveTab('EXPIRED')}
          className={`card p-5 bg-[#121721] border ${activeTab === 'EXPIRED' ? 'border-red-500 bg-red-500/10' : 'border-[#222B3D] hover:border-red-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'EXPIRED' ? 'text-red-400' : 'text-slate-400'}`}>Expired</p>
            <AlertCircle className={`w-4 h-4 ${activeTab === 'EXPIRED' ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <h3 className={`text-3xl font-black font-display mt-2 ${activeTab === 'EXPIRED' ? 'text-red-400' : 'text-[#EF4444]'}`}>
            {expiredCount}
          </h3>
        </div>

        <div 
          onClick={() => setActiveTab('DEBT')}
          className={`card p-5 bg-[#121721] border ${activeTab === 'DEBT' ? 'border-amber-500 bg-amber-500/10' : 'border-[#222B3D] hover:border-amber-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'DEBT' ? 'text-amber-400' : 'text-slate-400'}`}>With Debt</p>
            <span className="text-base">💰</span>
          </div>
          <h3 className={`text-3xl font-black font-display mt-2 ${activeTab === 'DEBT' ? 'text-amber-400' : 'text-amber-300'}`}>
            {debtCount}
          </h3>
        </div>
      </div>

      {/* Table card */}
      <div className="card overflow-hidden bg-[#121721] border border-[#222B3D] flex flex-col min-h-[500px]">
        {/* Search */}
        <div className="p-5 border-b border-[#222B3D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-9 pr-4 py-2 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm focus:border-[#CCFF00] outline-none transition-colors"
            />
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            Showing {displayedClients.length} · Filter: {statusFilter}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-sm flex-1">Loading...</div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B0E14] text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-6 py-4 border-b border-[#222B3D]">Code</th>
                  <th className="px-6 py-4 border-b border-[#222B3D]">Client Name</th>
                  <th className="px-6 py-4 border-b border-[#222B3D]">Phone</th>
                  <th className="px-6 py-4 border-b border-[#222B3D]">Status</th>
                  {activeTab === 'DEBT' && (
                    <th className="px-6 py-4 border-b border-[#222B3D]">Remaining Balance</th>
                  )}
                  <th className="px-6 py-4 border-b border-[#222B3D] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222B3D]">
                {displayedClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-[#181E2A] transition-colors cursor-pointer group"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{client.client_code}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <ClientAvatar client={client} />
                        <span className="font-bold text-white text-sm">
                          {client.name}
                        </span>
                        {Number(client.remaining_debt) > 0 && activeTab !== 'DEBT' && (
                          <span 
                            title={`Remaining Balance: ${Number(client.remaining_debt).toLocaleString()} EGP`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 ml-2"
                          >
                            <span>💰</span>
                            <span>{Number(client.remaining_debt).toLocaleString()} EGP</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">{client.phone}</td>
                    <td className="px-6 py-4">{getStatusBadge(getClientEffectiveStatus(client))}</td>
                    {activeTab === 'DEBT' && (
                      <td className="px-6 py-4">
                        {Number(client.remaining_debt) > 0 ? (
                          <div className="flex flex-col items-start">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <span>💰</span>
                              <span>{Number(client.remaining_debt).toLocaleString()} EGP</span>
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Unpaid Balance</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Fully Paid</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {activeTab === 'DEBT' && Number(client.remaining_debt) > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setClientToSettle(client);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer mr-1"
                            title="Settle Outstanding Dues"
                          >
                            <span>💰</span> Settle
                          </button>
                        )}

                        <WhatsAppContextualButtons client={client} size="md" />

                        <button
                          onClick={(e) => { e.stopPropagation(); openFormModal(client); }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#222B3D] rounded-xl transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={(e) => handleDelete(e, client.id)}
                            className="p-1.5 text-slate-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-colors"
                            title="Delete"
                          ><Trash2 className="w-4 h-4" /></button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-600 ml-1" />
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedClients.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'DEBT' ? 6 : 5} className="px-6 py-16 text-center text-slate-500">
                      <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-bold uppercase tracking-widest text-sm">
                        {activeTab === 'DEBT' ? 'No members with outstanding debt.' : 'No athletes found.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer row */}
        <div className="p-4 border-t border-[#222B3D] bg-[#0B0E14] text-xs font-bold uppercase tracking-widest text-slate-500">
          {displayedClients.length} result{displayedClients.length !== 1 ? 's' : ''} shown — {totalCount} total registered
        </div>
      </div>

      {/* ═══════════════════ ADD / EDIT CLIENT MODAL ═══════════════════ */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#222B3D] bg-[#0B0E14] flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-black font-display tracking-wider uppercase text-white">
                {editingClient ? 'Edit Client Record' : 'Add New Client'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-[#222B3D] rounded-xl transition-colors"
              ><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {formError && (
                <div className="flex items-start gap-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] p-3 rounded-xl text-xs font-bold uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* ── Personal Details ── */}
              <div>
                <h4 className="text-xs font-black text-[#CCFF00] uppercase tracking-widest mb-4">Personal Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Full Name <span className="text-[#CCFF00]">*</span></label>
                    <input
                      type="text"
                      value={clientFormData.name}
                      onChange={e => setClientFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Ahmed Mohamed"
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Phone <span className="text-[#CCFF00]">*</span></label>
                    <input
                      type="text"
                      value={clientFormData.phone}
                      onChange={e => setClientFormData(p => ({ ...p, phone: e.target.value }))}
                      placeholder="e.g. 01012345678"
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Date of Birth</label>
                    <DateInput
                      value={clientFormData.birth_date}
                      onChange={(iso) => setClientFormData(p => ({ ...p, birth_date: iso }))}
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Village / Area</label>
                    <input
                      type="text"
                      value={clientFormData.area}
                      onChange={e => setClientFormData(p => ({ ...p, area: e.target.value }))}
                      placeholder="e.g. Nasr City"
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Height (cm)</label>
                    <input
                      type="number"
                      value={clientFormData.height_cm}
                      onChange={e => setClientFormData(p => ({ ...p, height_cm: e.target.value }))}
                      placeholder="175"
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={clientFormData.weight_kg}
                      onChange={e => setClientFormData(p => ({ ...p, weight_kg: e.target.value }))}
                      placeholder="80.5"
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Other Sports</label>
                    <input
                      type="text"
                      value={clientFormData.other_sports}
                      onChange={e => setClientFormData(p => ({ ...p, other_sports: e.target.value }))}
                      placeholder="Swimming, Football..."
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Injuries</label>
                    <input
                      type="text"
                      value={clientFormData.injuries}
                      onChange={e => setClientFormData(p => ({ ...p, injuries: e.target.value }))}
                      placeholder="Knee surgery..."
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
                    />
                  </div>
                </div>

                {/* Medical conditions checkbox */}
                <button
                  type="button"
                  onClick={() => setClientFormData(p => ({ ...p, has_conditions: !p.has_conditions }))}
                  className="mt-4 flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
                >
                  {clientFormData.has_conditions
                    ? <CheckSquare className="w-5 h-5 text-[#EF4444]" />
                    : <Square className="w-5 h-5 text-[#222B3D] group-hover:text-slate-500" />}
                  <span className="text-xs font-bold uppercase tracking-widest">Has medical conditions</span>
                </button>

                {clientFormData.has_conditions && (
                  <div className="mt-3 space-y-1.5">
                    <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Medical Details</label>
                    <textarea
                      rows={2}
                      value={clientFormData.medical_details}
                      onChange={e => setClientFormData(p => ({ ...p, medical_details: e.target.value }))}
                      placeholder="Describe the medical condition..."
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#EF4444] transition-colors resize-none"
                    />
                  </div>
                )}

                <div className="mt-4 space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Internal Notes</label>
                  <textarea
                    rows={2}
                    value={clientFormData.notes}
                    onChange={e => setClientFormData(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors resize-none"
                  />
                </div>
              </div>

              {/* ── Initial Membership (only for new clients) ── */}
              {!editingClient && (
                <div className="border-t border-[#222B3D] pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-[#8B5CF6] uppercase tracking-widest">
                      Initial Subscription <span className="text-slate-600 font-bold ml-2">(Optional)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setAddInitialMembership(p => !p)}
                      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
                        addInitialMembership ? 'bg-[#8B5CF6]' : 'bg-[#222B3D]'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        addInitialMembership ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {addInitialMembership && (
                    <div className="bg-[#0B0E14] border border-[#222B3D] rounded p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Package</label>
                          <select
                            value={subFormData.package_id}
                            onChange={e => handlePackageSelect(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#121721] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#8B5CF6] transition-colors uppercase"
                          >
                            <option value="">SELECT A PLAN...</option>
                            {packages.map(pkg => (
                              <option key={pkg.id} value={pkg.id}>
                                {pkg.title} ({pkg.duration_days} DAYS) — {pkg.default_price} EGP
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Start Date</label>
                          <DateInput
                            value={subFormData.start_date}
                            onChange={(iso) => setSubFormData(p => ({ ...p, start_date: iso }))}
                            className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Price (EGP)</label>
                          <input
                            type="number"
                            value={subFormData.price}
                            onChange={e => setSubFormData(p => ({ ...p, price: e.target.value }))}
                            placeholder="0"
                            className="w-full px-4 py-2.5 bg-[#121721] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#8B5CF6] transition-colors font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Paid (EGP)</label>
                          <input
                            type="number"
                            value={subFormData.paid_amount}
                            onChange={e => setSubFormData(p => ({ ...p, paid_amount: e.target.value }))}
                            placeholder="0"
                            className="w-full px-4 py-2.5 bg-[#121721] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#8B5CF6] transition-colors font-mono"
                          />
                        </div>
                      </div>

                      {/* Visual Pricing Summary Box */}
                      <div className="p-3 bg-[#121721] border border-[#222B3D] rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Package Price:</span>
                          <span className="font-mono text-white font-bold">{Number(subFormData.price || 0)} EGP</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Paid Amount:</span>
                          <span className="font-mono text-emerald-400 font-bold">{Number(subFormData.paid_amount !== '' && subFormData.paid_amount !== undefined ? subFormData.paid_amount : subFormData.price || 0)} EGP</span>
                        </div>
                        <div className="flex justify-between text-slate-400 border-t border-[#222B3D] pt-1.5">
                          <span>Remaining Debt:</span>
                          <span className={`font-mono ${Math.max(0, Number(subFormData.price || 0) - Number(subFormData.paid_amount !== '' && subFormData.paid_amount !== undefined ? subFormData.paid_amount : subFormData.price || 0)) > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                            {Math.max(0, Number(subFormData.price || 0) - Number(subFormData.paid_amount !== '' && subFormData.paid_amount !== undefined ? subFormData.paid_amount : subFormData.price || 0))} EGP
                          </span>
                        </div>
                      </div>

                      {endDatePreview && (
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#CCFF00] bg-[#CCFF00]/10 border border-[#CCFF00]/20 px-3 py-2 rounded">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          Ends on: {formatDateDDMMYYYY(endDatePreview)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-[#222B3D] bg-[#0B0E14] flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2.5 bg-[#181E2A] hover:bg-[#222B3D] text-white border border-[#222B3D] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >Cancel</button>

              {!editingClient && addInitialMembership ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => handleClientSubmit(e, true)}
                  className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7c3aed] disabled:opacity-60 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#8B5CF6]/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {submitting ? 'Saving…' : 'Save & Print Receipt'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => handleClientSubmit(e, false)}
                  className="px-5 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] disabled:opacity-60 text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#CCFF00]/20 transition-all active:scale-95"
                >
                  {submitting ? 'Processing…' : (editingClient ? 'Save Changes' : 'Create Record')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ QUICK SETTLE DEBT MODAL ═══════════════════ */}
      {clientToSettle && (
        <SettleDebtModal
          client={clientToSettle}
          onClose={() => setClientToSettle(null)}
          onSettled={handleDebtSettled}
        />
      )}

    </div>
  );
};

export default Clients;
