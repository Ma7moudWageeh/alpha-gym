import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  Search, Plus, Edit2, Trash2, User, X, Printer,
  ChevronRight, Calendar, AlertCircle, CheckSquare, Square,
  Users, Activity, Snowflake
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

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
  package_id: '', start_date: new Date().toISOString().split('T')[0],
  price: '', note: '',
};

// ─── status badge ──────────────────────────────────────────────────────────────
const getStatusBadge = (status) => {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] mr-1.5"></span> ACTIVE
        </span>
      );
    case 'expired':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] mr-1.5"></span> EXPIRED
        </span>
      );
    case 'frozen':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mr-1.5"></span> FROZEN
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700">
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

  // Form modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientFormData, setClientFormData] = useState(EMPTY_CLIENT_FORM);
  const [addInitialMembership, setAddInitialMembership] = useState(false);
  const [subFormData, setSubFormData] = useState(EMPTY_SUB_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchClients = async () => {
    setLoading(true);
    const result = await window.electronAPI.clients.getAll({ search: searchQuery, status: 'all' });
    if (result.success) {
      setClients(result.clients);
      if (result.totalCount !== undefined) {
        setTotalClients(result.totalCount);
      }
    }
    setLoading(false);
  };

  const fetchPackages = async () => {
    const result = await window.electronAPI.packages.getAll();
    if (result.success) setPackages(result.packages.filter(p => p.is_active === 1));
  };

  useEffect(() => { fetchPackages(); }, []);

  useEffect(() => {
    window.addEventListener('focus', fetchClients);
    return () => window.removeEventListener('focus', fetchClients);
  }, [fetchClients]);

  useEffect(() => {
    const id = setTimeout(fetchClients, 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const filteredClients = clients.filter(c => {
    if (statusFilter === 'all') return true;
    return c.sub_status === statusFilter;
  });

  const totalCount = clients.length;
  const activeCount = clients.filter(c => c.sub_status === 'active').length;
  const frozenCount = clients.filter(c => c.sub_status === 'frozen').length;
  const expiredCount = clients.filter(c => c.sub_status === 'expired').length;

  // ── computed end-date preview ───────────────────────────────────────────────
  const endDatePreview = (() => {
    if (!addInitialMembership || !subFormData.package_id || !subFormData.start_date) return null;
    const pkg = packages.find(p => p.id.toString() === subFormData.package_id);
    if (!pkg) return null;
    return addDays(subFormData.start_date, pkg.duration_days);
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
        setIsFormModalOpen(false);
        fetchClients();
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
        const subRes = await window.electronAPI.subscriptions.create({
          client_id: clientId,
          package_id: parseInt(subFormData.package_id, 10),
          start_date: subFormData.start_date,
          price: parseFloat(subFormData.price),
          paid_amount: parseFloat(subFormData.price),
          note: subFormData.note,
        });

        if (subRes.error) {
          setFormError(`Client created but subscription failed: ${subRes.error}`);
          return;
        }

        // Auto-print receipt
        window.electronAPI.print.receipt({
          payment_id: subRes.subscription_id || clientId,
          client_name: clientFormData.name,
          client_phone: clientFormData.phone,
          client_age: calcAge(clientFormData.birth_date),
          client_weight: clientFormData.weight_kg,
          client_area: clientFormData.area || '',
          client_code: clientCode,
          package_name: pkg ? pkg.title : 'Subscription',
          amount: parseFloat(subFormData.price),
          paid_amount: parseFloat(subFormData.price),
          start_date: subFormData.start_date,
          end_date: subRes.end_date || endDatePreview || '',
          payment_date: subFormData.start_date,
        });
      }

      setIsFormModalOpen(false);
      fetchClients();
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
    if (res.success) fetchClients();
    else alert(res.error || 'Failed to delete client');
  };

  // Helper to extract initials
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-display text-white uppercase tracking-wider">Client Directory</h1>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`card p-5 bg-[#121721] border ${statusFilter === 'all' ? 'border-slate-400' : 'border-[#222B3D] hover:border-slate-600'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Clients</p>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-3xl font-black font-display text-white mt-2">{totalCount}</h3>
        </div>

        <div 
          onClick={() => setStatusFilter('active')}
          className={`card p-5 bg-[#121721] border ${statusFilter === 'active' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#222B3D] hover:border-emerald-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${statusFilter === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>Active</p>
            <Activity className={`w-4 h-4 ${statusFilter === 'active' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <h3 className={`text-3xl font-black font-display mt-2 ${statusFilter === 'active' ? 'text-emerald-400' : 'text-[#CCFF00]'}`}>
            {activeCount}
          </h3>
        </div>

        <div 
          onClick={() => setStatusFilter('expired')}
          className={`card p-5 bg-[#121721] border ${statusFilter === 'expired' ? 'border-red-500 bg-red-500/10' : 'border-[#222B3D] hover:border-red-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${statusFilter === 'expired' ? 'text-red-400' : 'text-slate-400'}`}>Expired</p>
            <AlertCircle className={`w-4 h-4 ${statusFilter === 'expired' ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <h3 className={`text-3xl font-black font-display mt-2 ${statusFilter === 'expired' ? 'text-red-400' : 'text-[#EF4444]'}`}>
            {expiredCount}
          </h3>
        </div>

        <div 
          onClick={() => setStatusFilter('frozen')}
          className={`card p-5 bg-[#121721] border ${statusFilter === 'frozen' ? 'border-sky-500 bg-sky-500/10' : 'border-[#222B3D] hover:border-sky-500/50'} cursor-pointer transition-colors`}
        >
          <div className="flex justify-between items-start">
            <p className={`text-xs font-bold uppercase tracking-widest ${statusFilter === 'frozen' ? 'text-sky-400' : 'text-slate-400'}`}>Frozen</p>
            <Snowflake className={`w-4 h-4 ${statusFilter === 'frozen' ? 'text-sky-400' : 'text-slate-500'}`} />
          </div>
          <h3 className={`text-3xl font-black font-display mt-2 ${statusFilter === 'frozen' ? 'text-sky-400' : 'text-[#8B5CF6]'}`}>
            {frozenCount}
          </h3>
        </div>
      </div>

      {/* Table card */}
      <div className="card overflow-hidden bg-[#121721] border border-[#222B3D] flex flex-col min-h-[500px]">
        {/* Search & Filters */}
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

          <div className="flex space-x-1 bg-[#0B0E14] p-1 rounded border border-[#222B3D]">
            {['all', 'active', 'expired', 'frozen'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  statusFilter === s ? 'bg-[#181E2A] text-[#CCFF00] shadow-sm' : 'text-slate-500 hover:text-slate-300'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-sm flex-1">Loading...</div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B0E14] text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-6 py-4 border-b border-[#222B3D]">ID</th>
                  <th className="px-6 py-4 border-b border-[#222B3D]">Client Name</th>
                  <th className="px-6 py-4 border-b border-[#222B3D]">Phone</th>
                  <th className="px-6 py-4 border-b border-[#222B3D]">Status</th>
                  <th className="px-6 py-4 border-b border-[#222B3D] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222B3D]">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-[#181E2A] transition-colors cursor-pointer group"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{client.client_code}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {client.profile_photo_url ? (
                          <img
                            src={client.profile_photo_url}
                            alt={client.name}
                            className="w-10 h-10 rounded-xl object-cover border border-[#222B3D] mr-3"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#181E2A] border border-[#222B3D] text-[#8B5CF6] flex items-center justify-center mr-3 font-bold text-xs uppercase tracking-wider">
                            {getInitials(client.name)}
                          </div>
                        )}
                        <span className="font-bold text-white text-sm">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">{client.phone}</td>
                    <td className="px-6 py-4">{getStatusBadge(client.sub_status)}</td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); openFormModal(client); }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#222B3D] rounded-xl transition-colors"
                          title="Edit"
                        ><Edit2 className="w-4 h-4" /></button>
                        {isOwner && (
                          <button
                            onClick={(e) => handleDelete(e, client.id)}
                            className="p-1.5 text-slate-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-colors"
                            title="Delete"
                          ><Trash2 className="w-4 h-4" /></button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-600 ml-2" />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-bold uppercase tracking-widest text-sm">No athletes found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer row */}
        <div className="p-4 border-t border-[#222B3D] bg-[#0B0E14] text-xs font-bold uppercase tracking-widest text-slate-500">
          {filteredClients.length} result{filteredClients.length !== 1 ? 's' : ''} shown — {totalCount} total registered
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
                    <input
                      type="date"
                      value={clientFormData.birth_date}
                      onChange={e => setClientFormData(p => ({ ...p, birth_date: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#CCFF00] transition-colors"
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
                          <input
                            type="date"
                            value={subFormData.start_date}
                            onChange={e => setSubFormData(p => ({ ...p, start_date: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-[#121721] border border-[#222B3D] rounded-xl text-white text-sm outline-none focus:border-[#8B5CF6] transition-colors"
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
                      </div>

                      {endDatePreview && (
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#CCFF00] bg-[#CCFF00]/10 border border-[#CCFF00]/20 px-3 py-2 rounded">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          Ends on: {endDatePreview}
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
    </div>
  );
};

export default Clients;
