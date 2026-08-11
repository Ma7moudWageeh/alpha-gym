import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  ArrowLeft, Edit2, Trash2, Plus, Printer, Snowflake, Sun,
  User, Phone, Calendar, Scale, MapPin, Activity, Heart,
  FileText, RefreshCw, AlertCircle, CheckSquare, Square, X,
  TrendingUp, TrendingDown, Minus, Camera, Trash
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age > 0 ? age : null;
}

function fmt(val, fallback = '—') {
  return val !== null && val !== undefined && val !== '' ? val : fallback;
}

const StatusBadge = ({ status }) => {
  const map = {
    active:  'bg-[#CCFF00]/10 text-[#CCFF00] border-[#CCFF00]/20',
    expired: 'bg-red-500/10 text-red-400 border-red-500/20',
    frozen:  'bg-sky-500/10 text-sky-400 border-sky-500/20',
  };
  const label = { active: 'Active', expired: 'Expired', frozen: 'Frozen' };
  const cls = map[status] || 'bg-[#181E2A] text-slate-400 border-slate-600';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label[status] || 'None'}
    </span>
  );
};

// ─── EDIT MODAL ────────────────────────────────────────────────────────────────
const EditClientModal = ({ client, packages, onClose, onSaved }) => {
  const [form, setForm] = useState({
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and Phone are required.');
      return;
    }
    setSaving(true);
    const res = await window.electronAPI.clients.update({
      id: client.id,
      name: form.name,
      phone: form.phone,
      date_of_birth: form.birth_date || null,
      height_cm: parseFloat(form.height_cm) || 0,
      weight_kg: parseFloat(form.weight_kg) || 0,
      area: form.area || null,
      other_sports: form.other_sports || null,
      injuries: form.injuries || null,
      has_conditions: form.has_conditions ? 1 : 0,
      medical_details: form.medical_details || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onSaved();
  };

  const F = ({ label, field, type = 'text', placeholder = '' }) => (
    <div className="space-y-1.5">
      <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={form[field]}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">Edit Client</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <F label="Full Name *" field="name" />
            <F label="Phone *" field="phone" />
            <F label="Date of Birth" field="birth_date" type="date" />
            <F label="Village / Area" field="area" placeholder="e.g. Nasr City" />
            <F label="Height (cm)" field="height_cm" type="number" placeholder="175" />
            <F label="Weight (kg)" field="weight_kg" type="number" placeholder="80" />
            <F label="Other Sports" field="other_sports" placeholder="Swimming, Football…" />
            <F label="Injuries" field="injuries" placeholder="Knee surgery 2022…" />
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, has_conditions: !p.has_conditions }))}
            className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
          >
            {form.has_conditions
              ? <CheckSquare className="w-5 h-5 text-[#CCFF00]" />
              : <Square className="w-5 h-5 text-slate-500" />}
            <span className="text-[10px] font-bold uppercase tracking-widest">Has medical conditions</span>
          </button>
          {form.has_conditions && (
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Medical Details</label>
              <textarea rows={2} value={form.medical_details}
                onChange={e => setForm(p => ({ ...p, medical_details: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm resize-none"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Internal Notes</label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#222B3D] bg-[#121721]/40 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] disabled:opacity-60 text-black rounded-xl text-sm font-semibold transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SUBSCRIPTION MODAL ────────────────────────────────────────────────────────
const SubscriptionModal = ({ client, packages, isRenew, onClose, onSaved }) => {
  const defaultPkg = packages[0];
  const [form, setForm] = useState({
    package_id: defaultPkg ? defaultPkg.id.toString() : '',
    start_date: new Date().toISOString().split('T')[0],
    price: defaultPkg ? defaultPkg.default_price.toString() : '',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const endDatePreview = (() => {
    if (!form.package_id || !form.start_date) return null;
    const pkg = packages.find(p => p.id.toString() === form.package_id);
    return pkg ? addDays(form.start_date, pkg.duration_days) : null;
  })();

  const handlePkgSelect = (id) => {
    const pkg = packages.find(p => p.id.toString() === id);
    setForm(prev => ({ ...prev, package_id: id, price: pkg ? pkg.default_price.toString() : prev.price }));
  };

  const submit = async (withPrint = false) => {
    setError('');
    if (!form.package_id || !form.price) { setError('Package and price are required.'); return; }
    setSaving(true);

    const pkg = packages.find(p => p.id.toString() === form.package_id);
    const payload = {
      client_id: client.id,
      package_id: parseInt(form.package_id, 10),
      start_date: form.start_date,
      price: parseFloat(form.price),
      paid_amount: parseFloat(form.price),
      note: form.note,
    };

    const fn = isRenew
      ? window.electronAPI.subscriptions.renew
      : window.electronAPI.subscriptions.create;
    const res = await fn(payload);
    setSaving(false);

    if (res.error) { setError(res.error); return; }

    if (withPrint) {
      window.electronAPI.print.receipt({
        payment_id: res.subscription_id || client.id,
        client_name: client.name,
        client_phone: client.phone,
        client_age: calcAge(client.date_of_birth) ? String(calcAge(client.date_of_birth)) : '',
        client_weight: client.weight_kg || '',
        client_area: client.area || '',
        client_code: client.client_code || '',
        package_name: pkg ? pkg.title : 'Subscription',
        amount: payload.price,
        paid_amount: payload.price,
        start_date: form.start_date,
        end_date: res.end_date || endDatePreview || '',
        payment_date: form.start_date,
      });
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
          <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">{isRenew ? 'Renew Subscription' : 'New Subscription'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Package</label>
            <select value={form.package_id} onChange={e => handlePkgSelect(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors">
              <option value="">Select package…</option>
              {packages.map(p => <option key={p.id} value={p.id}>{p.title} ({p.duration_days}d) — {p.default_price} EGP</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Price (EGP)</label>
              <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors" />
            </div>
          </div>
          {endDatePreview && (
            <div className="flex items-center gap-2 text-sm text-[#CCFF00] bg-[#CCFF00]/10 border border-[#CCFF00]/20 px-3 py-2 rounded">
              <Calendar className="w-4 h-4" /> Ends on: <strong>{endDatePreview}</strong>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Note (optional)</label>
            <input type="text" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Cash, Card, etc."
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#222B3D] bg-[#121721]/40 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Cancel</button>
          <button onClick={() => submit(false)} disabled={saving} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 border border-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Save</button>
          <button onClick={() => submit(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] disabled:opacity-60 text-black rounded-xl text-sm font-semibold transition-colors">
            <Printer className="w-4 h-4" />{saving ? 'Saving…' : 'Save & Print'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── WEIGHT MODAL ──────────────────────────────────────────────────────────────
const WeightModal = ({ client, onClose, onSaved }) => {
  const [weight, setWeight] = useState(client.weight_kg ? String(client.weight_kg) : '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');
    if (!weight || parseFloat(weight) <= 0) { setError('Valid weight is required.'); return; }
    setSaving(true);
    const res = await window.electronAPI.bodyProgress.add({
      client_id: client.id,
      weight_kg: parseFloat(weight),
      notes,
    });
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
          <h3 className="text-lg font-black font-display uppercase tracking-wider text-white flex items-center gap-2"><Scale className="w-5 h-5 text-[#CCFF00]" />Log Weight</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">{error}</div>}
          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Weight (kg) *</label>
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} autoFocus
              className="w-full px-4 py-3 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white text-xl font-black font-display uppercase tracking-wider outline-none focus:border-[#CCFF00] transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="After morning workout…"
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#222B3D] bg-[#121721]/40 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] disabled:opacity-60 text-black rounded-xl text-sm font-semibold transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isOwner = user?.role === 'owner';

  const [client, setClient] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeError, setFreezeError] = useState('');
  const [freezing, setFreezing] = useState(false);

  const fetchClient = useCallback(async () => {
    const res = await window.electronAPI.clients.getById({ id: parseInt(id, 10) });
    if (res.success) {
      setClient(res.client);
      // Use base64 URL sent from backend
      if (res.client.profile_photo_url) {
        setPhotoUrl(res.client.profile_photo_url);
      } else {
        setPhotoUrl(null);
      }
    }
    setLoading(false);
  }, [id]);

  const fetchPackages = useCallback(async () => {
    const res = await window.electronAPI.packages.getAll();
    if (res.success) setPackages(res.packages.filter(p => p.is_active === 1));
  }, []);

  useEffect(() => {
    fetchClient();
    fetchPackages();
  }, [fetchClient, fetchPackages]);

  const handleDelete = async () => {
    if (!isOwner) return;
    if (!window.confirm(`Delete "${client.name}" permanently? All records will be removed.`)) return;
    const res = await window.electronAPI.clients.delete({ id: client.id, userRole: user.role });
    if (res.success) navigate('/clients');
    else alert(res.error || 'Failed to delete client');
  };

  const handleUploadPhoto = async () => {
    if (photoUploading) return;
    setPhotoUploading(true);
    const res = await window.electronAPI.clients.uploadPhoto({ client_id: client.id });
    setPhotoUploading(false);
    if (res?.success) setPhotoUrl(res.photoPath);
  };

  const handleRemovePhoto = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Remove profile photo?')) return;
    const res = await window.electronAPI.clients.removePhoto({ client_id: client.id });
    if (res?.success) setPhotoUrl(null);
  };

  const handleFreeze = async () => {
    setFreezeError('');
    setFreezing(true);
    const res = await window.electronAPI.subscriptions.freeze({
      subscription_id: client.activeSubscription.id,
      reason: freezeReason,
    });
    setFreezing(false);
    if (res.error) { setFreezeError(res.error); return; }
    setShowFreezeModal(false);
    fetchClient();
  };

  const handleUnfreeze = async () => {
    const res = await window.electronAPI.subscriptions.unfreeze({
      subscription_id: client.activeSubscription.id,
    });
    if (res.error) alert(res.error);
    else fetchClient();
  };

  const handleReprintPayment = (payment) => {
    window.electronAPI.print.receipt({
      payment_id: payment.id,
      client_name: client.name,
      client_phone: client.phone,
      client_age: calcAge(client.date_of_birth) ? String(calcAge(client.date_of_birth)) : '',
      client_weight: client.weight_kg || '',
      client_area: client.area || '',
      client_code: client.client_code || '',
      package_name: payment.package_title || 'Subscription',
      amount: payment.amount,
      paid_amount: payment.amount,
      start_date: payment.sub_start_date || '',
      end_date: payment.sub_end_date || '',
      payment_date: payment.paid_at ? payment.paid_at.split(' ')[0] : '',
    });
  };

  // ── loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading client profile…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-slate-400">Client not found.</p>
        <button onClick={() => navigate('/clients')} className="text-[#CCFF00] hover:text-orange-300 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </button>
      </div>
    );
  }

  let activeSub = client.activeSubscription;
  if (activeSub) {
    const isExpired = new Date(activeSub.end_date) < new Date(new Date().setHours(0,0,0,0));
    const currentStatus = activeSub.status === 'frozen' ? 'frozen' : (isExpired ? 'expired' : 'active');
    activeSub = { ...activeSub, status: currentStatus };
  }
  
  if (client.subscriptionHistory) {
    client.subscriptionHistory = client.subscriptionHistory.map(sub => {
      const isExpired = new Date(sub.end_date) < new Date(new Date().setHours(0,0,0,0));
      const currentStatus = sub.status === 'frozen' ? 'frozen' : (isExpired ? 'expired' : 'active');
      return { ...sub, status: currentStatus };
    });
  }
  const age = calcAge(client.date_of_birth);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 mt-2 mb-6">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 text-slate-400 hover:text-[#CCFF00] transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-medium">Back</span>
        </button>

        <h1 className="text-2xl font-black font-display uppercase tracking-wider text-white flex-1 min-w-0 truncate px-4">{client.name}</h1>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#121721] hover:bg-[#181E2A] border border-[#222B3D] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>

          {isOwner && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Client
            </button>
          )}

          <button
            onClick={() => setShowSubModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] text-black rounded-xl text-sm font-semibold shadow-lg shadow-[#CCFF00]/20 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {activeSub ? 'Renew Subscription' : 'Add Subscription'}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-6 flex flex-col items-center text-center space-y-3">
            {/* Clickable photo avatar */}
            <div
              className="relative w-24 h-24 group cursor-pointer"
              onClick={handleUploadPhoto}
              title="Click to upload photo"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={client.name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#222B3D]"
                  onError={() => setPhotoUrl(null)}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#181E2A] border-2 border-[#222B3D] flex items-center justify-center">
                  <span className="text-2xl font-black text-[#8B5CF6] uppercase">
                    {client.name.trim().split(' ').slice(0, 2).map(p => p[0]).join('')}
                  </span>
                </div>
              )}
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-[#0B0E14]/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {photoUploading
                  ? <div className="w-5 h-5 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin"></div>
                  : <Camera className="w-6 h-6 text-[#CCFF00]" />}
              </div>
              {/* Remove X button — shown only when photo exists */}
              {photoUrl && (
                <button
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-[#EF4444] hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Remove photo"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>

            <div>
              <h2 className="text-xl font-black font-display text-white uppercase tracking-wider">{client.name}</h2>
              <p className="text-slate-400 font-mono text-xs mt-0.5">{client.client_code}</p>
            </div>
            {activeSub
              ? <StatusBadge status={activeSub.status} />
              : <StatusBadge status={null} />}
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Click photo to change</p>
          </div>

          {/* Personal Details */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Personal Details</h3>
            {[
              { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: client.phone },
              { icon: <Calendar className="w-4 h-4" />, label: 'Date of Birth', value: client.date_of_birth ? `${client.date_of_birth}${age ? ` (${age}y)` : ''}` : null },
              { icon: <MapPin className="w-4 h-4" />, label: 'Area', value: client.area },
              { icon: <Scale className="w-4 h-4" />, label: 'Weight', value: client.weight_kg ? `${client.weight_kg} kg` : null },
              { icon: <Activity className="w-4 h-4" />, label: 'Height', value: client.height_cm ? `${client.height_cm} cm` : null },
              { icon: <Activity className="w-4 h-4" />, label: 'Other Sports', value: client.other_sports },
            ].map(({ icon, label, value }) => value ? (
              <div key={label} className="flex items-start gap-3 text-sm">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-slate-400 text-xs">{label}</p>
                  <p className="text-white font-medium">{value}</p>
                </div>
              </div>
            ) : null)}
          </div>

          {/* Medical Info */}
          {(client.injuries || client.has_conditions || client.medical_details) && (
            <div className="card p-5 space-y-3 border-red-500/20">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4" /> Medical Info
              </h3>
              {client.injuries && (
                <div className="text-sm">
                  <p className="text-slate-400 text-xs mb-0.5">Injuries</p>
                  <p className="text-white">{client.injuries}</p>
                </div>
              )}
              {client.has_conditions && (
                <div className="text-sm">
                  <p className="text-slate-400 text-xs mb-0.5">Medical Conditions</p>
                  <p className="text-white">{client.medical_details || 'Yes (no details provided)'}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4" /> Notes
              </h3>
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Subscription Banner */}
          {activeSub && (
            <div className="card p-5 bg-brand-panel">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Active Subscription</p>
                  <p className="text-white text-lg font-black font-display uppercase tracking-wider">{activeSub.package_title || 'Package'}</p>
                  <p className="text-slate-400 text-sm mt-1 font-mono">{activeSub.start_date} → {activeSub.end_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Paid</p>
                    <p className="text-[#CCFF00] font-bold text-lg">{activeSub.price} EGP</p>
                  </div>
                  <StatusBadge status={activeSub.status} />
                </div>
              </div>

              {/* Freeze/Unfreeze */}
              <div className="flex gap-2 mt-4 border-t border-[#222B3D] pt-4">
                {activeSub.status === 'active' && (
                  <button
                    onClick={() => { setFreezeReason(''); setFreezeError(''); setShowFreezeModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    <Snowflake className="w-4 h-4" /> Freeze Membership
                  </button>
                )}
                {activeSub.status === 'frozen' && (
                  <button
                    onClick={handleUnfreeze}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#CCFF00]/10 hover:bg-emerald-500/20 border border-[#CCFF00]/20 text-[#CCFF00] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    <Sun className="w-4 h-4" /> Unfreeze Membership
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex space-x-1 bg-brand-panel p-1 rounded border border-[#222B3D] w-fit mb-4">
              {[
                { id: 'subscriptions', label: 'Subscriptions' },
                { id: 'payments', label: 'Payment History' },
                { id: 'weight', label: 'Weight History' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    activeTab === tab.id ? 'bg-[#181E2A] text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >{tab.label}</button>
              ))}
            </div>

            {/* ── Subscriptions Tab ── */}
            {activeTab === 'subscriptions' && (
              <div className="card overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#121721]/60 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 font-medium">Package</th>
                      <th className="px-5 py-3 font-medium">Start</th>
                      <th className="px-5 py-3 font-medium">End</th>
                      <th className="px-5 py-3 font-medium">Price</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {client.subscriptionHistory?.length > 0 ? client.subscriptionHistory.map(sub => (
                      <tr key={sub.id} className="hover:bg-[#121721]/20 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white">{sub.package_title || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-300 font-mono">{sub.start_date}</td>
                        <td className="px-5 py-3.5 text-slate-300 font-mono">{sub.end_date}</td>
                        <td className="px-5 py-3.5 text-[#CCFF00] font-semibold">{sub.price} EGP</td>
                        <td className="px-5 py-3.5"><StatusBadge status={sub.status} /></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No subscriptions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Payments Tab ── */}
            {activeTab === 'payments' && (
              <div className="card overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#121721]/60 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 font-medium">#</th>
                      <th className="px-5 py-3 font-medium">Package</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {client.payments?.length > 0 ? client.payments.map(pay => (
                      <tr key={pay.id} className="hover:bg-[#121721]/20 transition-colors">
                        <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{pay.id}</td>
                        <td className="px-5 py-3.5 text-white">{pay.package_title || pay.note || '—'}</td>
                        <td className="px-5 py-3.5 text-[#CCFF00] font-semibold">{pay.amount} EGP</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-xl text-xs bg-[#181E2A] text-slate-300 capitalize">{pay.type}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">{pay.paid_at ? pay.paid_at.split(' ')[0] : '—'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleReprintPayment(pay)}
                            className="flex items-center gap-1.5 ml-auto px-4 py-2 text-xs text-slate-300 hover:text-white bg-[#121721] hover:bg-[#181E2A] border border-[#222B3D] rounded-xl transition-colors"
                            title="Reprint Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" /> Reprint
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No payment history.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Weight History Tab ── */}
            {activeTab === 'weight' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowWeightModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] text-black rounded-xl text-sm font-semibold shadow-lg shadow-[#CCFF00]/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Log Weight
                  </button>
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#121721]/60 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Weight</th>
                        <th className="px-5 py-3 font-medium">Change</th>
                        <th className="px-5 py-3 font-medium">Notes</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {client.bodyProgress?.length > 0 ? client.bodyProgress.map((log, idx) => {
                        const prev = client.bodyProgress[idx + 1];
                        const diff = prev ? (log.weight_kg - prev.weight_kg).toFixed(1) : null;
                        return (
                          <tr key={log.id} className="hover:bg-[#121721]/20 transition-colors">
                            <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">{log.logged_at?.split(' ')[0]}</td>
                            <td className="px-5 py-3.5 font-bold text-white">{log.weight_kg} kg</td>
                            <td className="px-5 py-3.5">
                              {diff !== null ? (
                                parseFloat(diff) > 0 ? (
                                  <span className="text-red-400 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />+{diff}</span>
                                ) : parseFloat(diff) < 0 ? (
                                  <span className="text-[#CCFF00] flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />{diff}</span>
                                ) : (
                                  <span className="text-slate-500 flex items-center gap-1"><Minus className="w-3.5 h-3.5" />0.0</span>
                                )
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-slate-400 max-w-[160px] truncate">{log.notes || '—'}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={async () => {
                                  if (!window.confirm('Delete this entry?')) return;
                                  await window.electronAPI.bodyProgress.delete({ id: log.id });
                                  fetchClient();
                                }}
                                className="text-slate-600 hover:text-red-400 transition-colors"
                              ><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No weight entries recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {showEditModal && (
        <EditClientModal
          client={client}
          packages={packages}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); fetchClient(); }}
        />
      )}

      {showSubModal && (
        <SubscriptionModal
          client={client}
          packages={packages}
          isRenew={!!activeSub}
          onClose={() => setShowSubModal(false)}
          onSaved={() => { setShowSubModal(false); fetchClient(); }}
        />
      )}

      {showWeightModal && (
        <WeightModal
          client={client}
          onClose={() => setShowWeightModal(false)}
          onSaved={() => { setShowWeightModal(false); fetchClient(); }}
        />
      )}

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1E293B] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-white flex items-center gap-2"><Snowflake className="w-5 h-5 text-sky-400" />Freeze Membership</h3>
              <button onClick={() => setShowFreezeModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {freezeError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">{freezeError}</div>}
              <p className="text-slate-300 text-sm">Freezing pauses the subscription end date until unfrozen.</p>
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Reason (optional)</label>
                <textarea rows={2} value={freezeReason} onChange={e => setFreezeReason(e.target.value)} placeholder="Medical, Travel, etc."
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-sky-500 transition-colors resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#222B3D] bg-[#121721]/40 flex justify-end gap-3">
              <button onClick={() => setShowFreezeModal(false)} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Cancel</button>
              <button onClick={handleFreeze} disabled={freezing} className="flex items-center gap-2 px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-black rounded-xl text-sm font-semibold transition-colors">
                <Snowflake className="w-4 h-4" />{freezing ? 'Freezing…' : 'Freeze Membership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfile;
