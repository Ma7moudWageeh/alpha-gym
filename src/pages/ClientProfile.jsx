import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  ArrowLeft, Edit2, Trash2, Plus, Printer, Snowflake, Sun,
  User, Phone, Calendar, Scale, MapPin, Activity, Heart,
  FileText, RefreshCw, AlertCircle, CheckSquare, Square, X,
  TrendingUp, TrendingDown, Minus, Camera, Trash
} from 'lucide-react';
import { formatDateDDMMYYYY, isBirthdayToday, getAvatarGlowClass, getClientEffectiveStatus, getTodayStr, addDays } from '../utils/dateFormat';
import DateInput from '../components/DateInput';
import SettleDebtModal from '../components/modals/SettleDebtModal';

import { WhatsAppContextualButtons } from '../components/common/WhatsAppButton';

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, Math.min(name.length, 3)).toUpperCase();
}

const StatusBadge = ({ status }) => {
  const s = status ? String(status).toUpperCase() : '';
  const map = {
    ACTIVE:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    EXPIRED:  'bg-red-500/15 text-red-400 border-red-500/30',
    FROZEN:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    INACTIVE: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    'NO PLAN': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  const label = {
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    FROZEN: '❄️ FROZEN',
    INACTIVE: 'Inactive',
    'NO PLAN': 'No Plan',
  };
  const cls = map[s] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {label[s] || 'No Plan'}
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
      {type === 'date' ? (
        <DateInput
          value={form[field]}
          onChange={(iso) => setForm(p => ({ ...p, [field]: iso }))}
          className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm font-mono"
        />
      ) : (
        <input
          type={type}
          value={form[field]}
          onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
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
    paid_amount: defaultPkg ? defaultPkg.default_price.toString() : '',
    note: '',
  });
  const [stackAfterCurrent, setStackAfterCurrent] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cleanPrice = Number(parseFloat(form.price || 0).toFixed(2));
  const cleanPaid = Number(parseFloat(form.paid_amount || 0).toFixed(2));
  const planPrice = Math.max(0, cleanPrice);
  const paidAmount = Math.max(0, cleanPaid);
  const remainingAmount = Math.max(0, Number((planPrice - paidAmount).toFixed(2)));

  const todayStr = getTodayStr();
  const currentEndDate = client?.activeSubscription?.end_date || client?.latest_end_date || client?.end_date;
  const hasActivePlan = Boolean(isRenew && currentEndDate && currentEndDate >= todayStr);

  const pkg = packages.find(p => p.id.toString() === form.package_id);
  const planDuration = pkg ? pkg.duration_days : 30;

  const computedStartDate = (() => {
    if (hasActivePlan && stackAfterCurrent) {
      return addDays(currentEndDate, 1);
    }
    return form.start_date || todayStr;
  })();

  const computedEndDate = computedStartDate ? addDays(computedStartDate, planDuration - 1) : null;

  const handlePkgSelect = (id) => {
    const p = packages.find(item => item.id.toString() === id);
    const newPrice = p ? p.default_price.toString() : form.price;
    setForm(prev => ({
      ...prev,
      package_id: id,
      price: newPrice,
      paid_amount: newPrice,
    }));
  };

  const submit = async (withPrint = false) => {
    setError('');
    if (!form.package_id || !form.price) { setError('Package and price are required.'); return; }
    setSaving(true);

    const chosenStartDate = hasActivePlan && stackAfterCurrent ? computedStartDate : form.start_date;

    const payload = {
      client_id: client.id,
      package_id: parseInt(form.package_id, 10),
      start_date: chosenStartDate,
      stack_after_current: stackAfterCurrent,
      price: planPrice,
      paid_amount: paidAmount,
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
        amount: paidAmount,
        paid_amount: paidAmount,
        paidAmount: paidAmount,
        price: planPrice,
        planPrice: planPrice,
        remaining_amount: remainingAmount,
        remainingAmount: remainingAmount,
        start_date: res.start_date || form.start_date,
        end_date: res.end_date || computedEndDate || '',
        payment_date: new Date().toISOString().split('T')[0],
      });
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
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

          {hasActivePlan && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs leading-relaxed">
              ℹ️ <strong>Early Renewal:</strong> Current subscription active until <strong>{formatDateDDMMYYYY(currentEndDate)}</strong>. New plan will start on <strong>{formatDateDDMMYYYY(computedStartDate)}</strong> and expire on <strong>{formatDateDDMMYYYY(computedEndDate)}</strong> (Total days extended: +{planDuration}).
            </div>
          )}

          {hasActivePlan && (
            <div className="space-y-2 p-3 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="profile_renew_stack"
                  checked={stackAfterCurrent}
                  onChange={() => setStackAfterCurrent(true)}
                  className="text-[#CCFF00] focus:ring-[#CCFF00]"
                />
                <span className="font-semibold text-white">Stack after current plan <span className="text-[#CCFF00] text-[10px] font-bold">(Recommended)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="profile_renew_stack"
                  checked={!stackAfterCurrent}
                  onChange={() => setStackAfterCurrent(false)}
                  className="text-[#CCFF00] focus:ring-[#CCFF00]"
                />
                <span>Start immediately from today</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Start Date</label>
              <DateInput
                value={hasActivePlan && stackAfterCurrent ? computedStartDate : form.start_date}
                onChange={(iso) => setForm(p => ({ ...p, start_date: iso }))}
                disabled={hasActivePlan && stackAfterCurrent}
                className={`w-full px-3 py-2 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors font-mono text-sm ${hasActivePlan && stackAfterCurrent ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Price (EGP)</label>
              <input
                type="number"
                value={form.price}
                onChange={e => {
                  const val = e.target.value;
                  setForm(p => ({
                    ...p,
                    price: val,
                    paid_amount: p.paid_amount === p.price ? val : p.paid_amount
                  }));
                }}
                className="w-full px-3 py-2 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Paid (EGP)</label>
              <input
                type="number"
                value={form.paid_amount}
                onChange={e => setForm(p => ({ ...p, paid_amount: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors text-sm"
              />
            </div>
          </div>

          {/* Pricing Breakdown Box */}
          <div className="p-3 bg-[#0B0E14] border border-[#222B3D] rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Package Price:</span>
              <span className="font-semibold text-white">{planPrice} EGP</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Paid Amount:</span>
              <span className="font-semibold text-white">{paidAmount} EGP</span>
            </div>
            <div className={`flex justify-between border-t border-[#222B3D] pt-1 ${remainingAmount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              <span>Remaining Debt:</span>
              <span>{remainingAmount} EGP</span>
            </div>
          </div>

          {computedEndDate && (
            <div className="flex items-center gap-2 text-sm text-[#CCFF00] bg-[#CCFF00]/10 border border-[#CCFF00]/20 px-3 py-2 rounded">
              <Calendar className="w-4 h-4" /> Ends on: <strong>{formatDateDDMMYYYY(computedEndDate)}</strong>
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
      <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
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
  const [photoBroken, setPhotoBroken] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const fileInputRef = useRef(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeMode, setFreezeMode] = useState('timed'); // timed | indefinite
  const [freezeDays, setFreezeDays] = useState('7');
  const [freezeError, setFreezeError] = useState('');
  const [freezing, setFreezing] = useState(false);

  // Selective client delete & subscription void states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [purgeFinancials, setPurgeFinancials] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [selectedSubToVoid, setSelectedSubToVoid] = useState(null);
  const [voidingSub, setVoidingSub] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchClient = useCallback(async () => {
    const res = await window.electronAPI.clients.getById({ id: parseInt(id, 10) });
    if (res.success) {
      setClient(res.client);
      // Use base64 URL sent from backend
      if (res.client.profile_photo_url) {
        setPhotoUrl(res.client.profile_photo_url);
        setPhotoBroken(false);
      } else {
        setPhotoUrl(null);
        setPhotoBroken(false);
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

  const handleConfirmDeleteClient = async () => {
    if (!isOwner || !client) return;
    setDeletingClient(true);
    try {
      const res = await window.electronAPI.clients.delete({
        clientId: client.id,
        id: client.id,
        userRole: user?.role,
        purgeFinancials
      });
      if (res?.success) {
        setShowDeleteModal(false);
        window.dispatchEvent(new Event('dashboard-refresh'));
        navigate('/clients');
      } else {
        alert(res?.error || 'Failed to delete client');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete client');
    } finally {
      setDeletingClient(false);
    }
  };

  const handleConfirmVoidSubscription = async () => {
    if (!selectedSubToVoid || !client) return;
    setVoidingSub(true);
    try {
      const res = await window.electronAPI.subscriptions.delete({
        clientId: client.id,
        subscriptionId: selectedSubToVoid.id
      });
      if (res?.success) {
        setSelectedSubToVoid(null);
        await fetchClient();
        window.dispatchEvent(new Event('dashboard-refresh'));
        setToastMessage('Subscription voided and financial records updated.');
      } else {
        alert(res?.error || 'Failed to void subscription');
      }
    } catch (err) {
      alert(err.message || 'Failed to void subscription');
    } finally {
      setVoidingSub(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const filePath = window.electronAPI.getPathForFile
      ? window.electronAPI.getPathForFile(file)
      : (file.path || undefined);

    setPhotoUploading(true);
    const res = await window.electronAPI.clients.uploadPhoto({
      client_id: client.id,
      filePath: filePath || undefined,
      fromInput: true,
    });
    setPhotoUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (res?.success) {
      const url = res.photoUrl || res.profile_photo_url || res.photoPath;
      if (url) {
        setPhotoUrl(url);
        setPhotoBroken(false);
        setClient(prev => prev ? { ...prev, profile_photo_url: url, photoUrl: url } : prev);
      } else {
        await fetchClient();
      }
    } else if (res?.error) {
      alert(`Failed to upload photo: ${res.error}`);
    }
  };

  const triggerFileInput = (e) => {
    if (e) e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDeletePhoto = async (e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete profile photo permanently?')) return;
    const res = await window.electronAPI.clients.deletePhoto(client.id);
    if (res?.success) {
      setPhotoUrl(null);
      setPhotoBroken(false);
      setClient(prev => prev ? { ...prev, profile_photo_url: null, photoUrl: null, profile_photo: null } : prev);
      setShowImageModal(false);
    } else {
      alert(res?.error || 'Failed to delete photo');
    }
  };

  const handleFreeze = async () => {
    setFreezeError('');
    if (freezeMode === 'timed') {
      const days = parseInt(freezeDays, 10);
      if (!days || days < 1) {
        setFreezeError('Enter a valid number of freeze days.');
        return;
      }
    }
    setFreezing(true);
    const res = await window.electronAPI.subscriptions.freeze({
      subscription_id: client.activeSubscription.id,
      clientId: client.id,
      reason: freezeReason,
      mode: freezeMode,
      freeze_days: freezeMode === 'timed' ? parseInt(freezeDays, 10) : undefined,
    });
    setFreezing(false);
    if (res.error) { setFreezeError(res.error); return; }
    setShowFreezeModal(false);
    window.dispatchEvent(new Event('dashboard-refresh'));
    fetchClient();
  };

  const handleUnfreeze = async () => {
    const res = await window.electronAPI.subscriptions.unfreeze({
      subscription_id: client.activeSubscription.id,
      clientId: client.id,
    });
    if (res.error) {
      alert(res.error);
    } else {
      window.dispatchEvent(new Event('dashboard-refresh'));
      fetchClient();
    }
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
    // Prefer backend computed_status / profile-level client_status
    const profileStatus = client.client_status || activeSub.computed_status || activeSub.status;
    activeSub = { ...activeSub, status: profileStatus === 'expired' && activeSub.status === 'frozen' ? 'frozen' : (activeSub.status === 'frozen' ? 'frozen' : profileStatus) };
  }

  if (client.subscriptionHistory) {
    client.subscriptionHistory = client.subscriptionHistory.map(sub => ({
      ...sub,
      status: sub.computed_status || sub.status,
    }));
  }
  const age = calcAge(client.date_of_birth);
  const profileStatus = getClientEffectiveStatus({
    ...client,
    activeSubscription: activeSub,
  });

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

        <h1 className="text-2xl font-black font-display uppercase tracking-wider text-white flex items-center gap-2 flex-1 min-w-0 truncate px-4">
          <span className="truncate">{client.name}</span>
        </h1>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#121721] hover:bg-[#181E2A] border border-[#222B3D] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>

          {isOwner && (
            <button
              onClick={() => {
                setPurgeFinancials(false);
                setShowDeleteModal(true);
              }}
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
          <div className="card p-6 flex flex-col items-center text-center space-y-4">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />

            {/* Enlarged Avatar Container */}
            <div className="relative group">
              <div
                className={`w-32 h-32 rounded-2xl bg-[#0B0E14] shadow-lg flex items-center justify-center relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] ${getAvatarGlowClass(client)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (photoUrl && !photoBroken) {
                    setShowImageModal(true);
                  } else {
                    triggerFileInput(e);
                  }
                }}
                title={photoUrl && !photoBroken ? "Click to view full-screen preview" : "Click to upload photo"}
              >
                {photoUrl && !photoBroken ? (
                  <img
                    src={photoUrl}
                    alt={client.name}
                    className="w-full h-full object-cover rounded-2xl"
                    onError={() => setPhotoBroken(true)}
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-[#0B0E14] flex items-center justify-center avatar-initials-fallback">
                    <span className="text-3xl font-black text-[#CCFF00] uppercase font-display tracking-wider">
                      {getInitials(client.name)}
                    </span>
                  </div>
                )}

                {/* Camera Overlay on Hover */}
                <div className="absolute inset-0 bg-[#0B0E14]/75 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2 text-center">
                  {photoUploading ? (
                    <div className="w-6 h-6 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-[#CCFF00] mb-1" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                        {photoUrl && !photoBroken ? 'View Preview' : 'Upload Photo'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-black font-display text-white uppercase tracking-wider flex items-center justify-center gap-2">
                <span>{client.name}</span>
              </h2>
              <p className="text-slate-400 font-mono text-xs mt-0.5">{client.client_code}</p>
            </div>
            {profileStatus
              ? <StatusBadge status={profileStatus} />
              : <StatusBadge status={null} />}
            {isBirthdayToday(client.date_of_birth) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-full animate-pulse">
                <span className="text-base leading-none">🎉</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                  Celebrating Birthday Today
                </span>
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
              {photoUrl && !photoBroken ? 'Click image to expand preview' : 'Click container to select photo'}
            </p>
            {profileStatus === 'PENDING' && (
              <div className="w-full mt-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">Pending Activation</p>
                <p className="text-xs text-purple-200">Subscription starts automatically on member's first gym check-in.</p>
              </div>
            )}
            {(profileStatus === 'FROZEN' || profileStatus === 'frozen') && (activeSub?.freeze_reason || client.freeze_reason) && (
              <div className="w-full mt-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-1">Freeze Reason</p>
                <p className="text-sm text-sky-100">{activeSub?.freeze_reason || client.freeze_reason}</p>
                {activeSub?.freeze_mode === 'timed' && activeSub?.freeze_end_date && (
                  <p className="text-xs text-sky-300/80 mt-1">Auto-unfreeze: {formatDateDDMMYYYY(activeSub.freeze_end_date)}</p>
                )}
                {activeSub?.freeze_mode === 'indefinite' && (
                  <p className="text-xs text-sky-300/80 mt-1">Indefinite — manual unfreeze required</p>
                )}
              </div>
            )}
          </div>

          {/* Personal Details */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Personal Details</h3>
            {[
              { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: client.phone, isPhone: true },
              { icon: <Calendar className="w-4 h-4" />, label: 'Date of Birth', value: client.date_of_birth ? `${formatDateDDMMYYYY(client.date_of_birth)}${age ? ` (${age}y)` : ''}` : null },
              { icon: <MapPin className="w-4 h-4" />, label: 'Area', value: client.area },
              { icon: <Scale className="w-4 h-4" />, label: 'Weight', value: client.weight_kg ? `${client.weight_kg} kg` : null },
              { icon: <Activity className="w-4 h-4" />, label: 'Height', value: client.height_cm ? `${client.height_cm} cm` : null },
              { icon: <Activity className="w-4 h-4" />, label: 'Other Sports', value: client.other_sports },
            ].map(({ icon, label, value, isPhone }) => value ? (
              <div key={label} className="flex items-start gap-3 text-sm">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs">{label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{value}</p>
                    {isPhone && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <WhatsAppContextualButtons client={client} size="sm" />
                      </div>
                    )}
                  </div>
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
          {/* Outstanding Balance Warning Card */}
          {Number(client.remaining_debt) > 0 && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <h4 className="font-bold text-sm">Outstanding Client Balance</h4>
                  <p className="text-xs text-amber-400/80">
                    Total Due: <span className="font-bold text-base text-amber-300">{client.remaining_debt} EGP</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDebtModalOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Settle Balance
              </button>
            </div>
          )}

          {/* Active Subscription Banner */}
          {activeSub && (
            <div className="card p-5 bg-brand-panel">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Active Subscription</p>
                  <p className="text-white text-lg font-black font-display uppercase tracking-wider">{activeSub.package_title || 'Package'}</p>
                  <p className="text-slate-400 text-sm mt-1 font-mono">{formatDateDDMMYYYY(activeSub.start_date)} → {formatDateDDMMYYYY(activeSub.end_date)}</p>
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
              <div className="flex flex-col gap-3 mt-4 border-t border-[#222B3D] pt-4">
                {activeSub.status === 'frozen' && activeSub.freeze_reason && (
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-1">Freeze Reason</p>
                    <p className="text-sm text-sky-100">{activeSub.freeze_reason}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  {activeSub.status === 'active' && (
                    <button
                      onClick={() => {
                        setFreezeReason('');
                        setFreezeMode('timed');
                        setFreezeDays('7');
                        setFreezeError('');
                        setShowFreezeModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#CCFF00]/30 text-[#CCFF00] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                      <Snowflake className="w-4 h-4" /> Freeze Membership
                    </button>
                  )}
                  {activeSub.status === 'frozen' && (
                    <button
                      onClick={handleUnfreeze}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer"
                    >
                      <span>❄️</span>
                      <span>UNFREEZE MEMBERSHIP</span>
                    </button>
                  )}
                </div>
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
                      <th className="px-5 py-3 font-medium">Paid</th>
                      <th className="px-5 py-3 font-medium">Remaining</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      {isOwner && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {client.subscriptionHistory?.length > 0 ? client.subscriptionHistory.map(sub => (
                      <tr key={sub.id} className="hover:bg-[#121721]/20 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white">{sub.package_title || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-300 font-mono">{formatDateDDMMYYYY(sub.start_date)}</td>
                        <td className="px-5 py-3.5 text-slate-300 font-mono">{formatDateDDMMYYYY(sub.end_date)}</td>
                        <td className="px-5 py-3.5 text-white font-semibold">{sub.price || 0} EGP</td>
                        <td className="px-5 py-3.5 text-[#CCFF00] font-semibold">{sub.paid_amount !== undefined && sub.paid_amount !== null ? sub.paid_amount : (sub.price || 0)} EGP</td>
                        <td className="px-5 py-3.5 font-semibold">
                          {Number(sub.remaining_amount) > 0 ? (
                            <span className="text-amber-400 font-bold">{sub.remaining_amount} EGP</span>
                          ) : (
                            <span className="text-slate-500 font-normal">0 EGP</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={sub.status} /></td>
                        {isOwner && (
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedSubToVoid(sub)}
                              title="Void Subscription & Revert Revenue"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    )) : (
                      <tr><td colSpan={isOwner ? 8 : 7} className="px-5 py-10 text-center text-slate-500">No subscriptions yet.</td></tr>
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
                        <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">{formatDateDDMMYYYY(pay.paid_at) || '—'}</td>
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
                            <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">{formatDateDDMMYYYY(log.logged_at)}</td>
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
          onSaved={async () => {
            setShowEditModal(false);
            await fetchClient();
            window.dispatchEvent(new Event('dashboard-refresh'));
          }}
        />
      )}

      {showSubModal && (
        <SubscriptionModal
          client={client}
          packages={packages}
          isRenew={!!activeSub}
          onClose={() => setShowSubModal(false)}
          onSaved={() => {
            setShowSubModal(false);
            window.dispatchEvent(new Event('dashboard-refresh'));
            fetchClient();
          }}
        />
      )}

      {isDebtModalOpen && (
        <SettleDebtModal
          client={client}
          onClose={() => setIsDebtModalOpen(false)}
          onSettled={async () => {
            setIsDebtModalOpen(false);
            await fetchClient();
            window.dispatchEvent(new Event('dashboard-refresh'));
            setToastMessage('Balance settled successfully and ledger updated.');
          }}
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
          <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-white flex items-center gap-2"><Snowflake className="w-5 h-5 text-[#CCFF00]" />Freeze Membership</h3>
              <button onClick={() => setShowFreezeModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {freezeError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">{freezeError}</div>}

              <div className="space-y-2">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Freeze Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFreezeMode('timed')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${
                      freezeMode === 'timed'
                        ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-[#CCFF00]'
                        : 'bg-[#0B0E14] border-[#222B3D] text-slate-400'
                    }`}
                  >
                    Timed (Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreezeMode('indefinite')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${
                      freezeMode === 'indefinite'
                        ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-[#CCFF00]'
                        : 'bg-[#0B0E14] border-[#222B3D] text-slate-400'
                    }`}
                  >
                    Indefinite
                  </button>
                </div>
                <p className="text-slate-400 text-xs">
                  {freezeMode === 'timed'
                    ? 'End date extends by actual days frozen (capped to N). Auto-unfreezes when the freeze period ends.'
                    : 'Frozen until staff manually clicks Unfreeze. End date extends by days elapsed.'}
                </p>
              </div>

              {freezeMode === 'timed' && (
                <div className="space-y-1.5">
                  <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Freeze Days</label>
                  <input
                    type="number"
                    min="1"
                    value={freezeDays}
                    onChange={e => setFreezeDays(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors"
                    placeholder="7"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Reason</label>
                <textarea rows={2} value={freezeReason} onChange={e => setFreezeReason(e.target.value)} placeholder="Medical, Travel, etc."
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#222B3D] bg-[#0B0E14] flex justify-end gap-3">
              <button onClick={() => setShowFreezeModal(false)} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Cancel</button>
              <button onClick={handleFreeze} disabled={freezing} className="flex items-center gap-2 px-5 py-2 bg-[#CCFF00] hover:bg-[#b5e600] disabled:opacity-60 text-black font-bold rounded-xl text-sm transition-colors">
                <Snowflake className="w-4 h-4" />{freezing ? 'Freezing…' : 'Freeze Membership'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE PREVIEW LIGHTBOX MODAL ── */}
      {showImageModal && photoUrl && !photoBroken && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl overflow-hidden flex flex-col w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-[#0B0E14]/80">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
                <User className="w-4 h-4 text-[#CCFF00]" />
                {client.name} — Profile Photo
              </h3>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Container */}
            <div className="p-6 flex items-center justify-center bg-[#0B0E14] overflow-auto max-h-[70vh]">
              <img
                src={photoUrl}
                alt={client.name}
                className="max-w-full max-h-[65vh] rounded-2xl border border-[#222B3D] object-contain shadow-2xl"
              />
            </div>

            {/* Action Bar */}
            <div className="px-6 py-4 border-t border-[#222B3D] bg-[#0B0E14]/80 flex justify-between items-center">
              <button
                type="button"
                onClick={handleDeletePhoto}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl transition-colors font-bold text-xs uppercase tracking-wider"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Photo</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="flex items-center gap-2 px-4 py-2 bg-[#181E2A] hover:bg-[#222B3D] text-[#CCFF00] hover:text-[#b8e600] rounded-xl transition-colors font-bold text-xs uppercase tracking-wider border border-[#222B3D]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Change Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-4 py-2 bg-[#181E2A] hover:bg-slate-700 text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-wider border border-[#222B3D]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-100">Delete Athlete Profile</h3>
            </div>
            
            <p className="text-sm text-slate-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-200">{client.name}</strong>? This action cannot be undone.
            </p>

            {/* Financial Choice Box */}
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeFinancials}
                  onChange={(e) => setPurgeFinancials(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">
                    Purge all financial records & receipts
                  </span>
                  <span className="text-slate-400">
                    Check this if this account was created by mistake. This will immediately deduct the collected amounts from Today's Revenue and financial reports.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingClient}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteClient}
                disabled={deletingClient}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {deletingClient ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Subscription Confirmation Modal */}
      {selectedSubToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-100">Void Subscription</h3>
            </div>
            
            <p className="text-sm text-slate-400 leading-relaxed">
              Are you sure you want to void this subscription (<strong className="text-slate-200">{selectedSubToVoid.package_title || 'Subscription'}</strong>)? This action cannot be undone.
            </p>

            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <p>• Period: <span className="font-mono text-slate-300">{formatDateDDMMYYYY(selectedSubToVoid.start_date)}</span> to <span className="font-mono text-slate-300">{formatDateDDMMYYYY(selectedSubToVoid.end_date)}</span></p>
              <p>• Paid Amount: <span className="text-[#CCFF00] font-semibold">{selectedSubToVoid.paid_amount !== undefined && selectedSubToVoid.paid_amount !== null ? selectedSubToVoid.paid_amount : (selectedSubToVoid.price || 0)} EGP</span> will be deducted from Today's Revenue and financial reports.</p>
              <p>• Athlete active dates and status will roll back to the previous subscription or clear to no plan.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedSubToVoid(null)}
                disabled={voidingSub}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoidSubscription}
                disabled={voidingSub}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {voidingSub ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl shadow-2xl backdrop-blur-md text-sm font-semibold">
          <span>✓</span> {toastMessage}
        </div>
      )}
    </div>
  );
};

export default ClientProfile;
