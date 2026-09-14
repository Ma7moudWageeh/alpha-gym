import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

export const SettleDebtModal = ({ client, onClose, onSettled }) => {
  const [amount, setAmount] = useState(client.remaining_debt ? String(client.remaining_debt) : '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSettle = async () => {
    setError('');
    const cleanSettle = Number(parseFloat(amount || 0).toFixed(2));
    const settleAmount = Math.max(0, cleanSettle);

    if (settleAmount <= 0 || isNaN(settleAmount)) {
      setError('Settlement amount must be greater than zero');
      return;
    }
    const currentDebt = Number(client.remaining_debt || 0);
    if (settleAmount > currentDebt) {
      setError('Settlement amount cannot exceed remaining balance');
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI.settleDebt({
        clientId: client.id,
        amount: settleAmount,
        notes: notes.trim() || undefined
      });
      setSaving(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      const newRemainingDebt = res?.remaining_debt !== undefined
        ? res.remaining_debt
        : Math.max(0, currentDebt - settleAmount);

      if (onSettled) {
        onSettled(client.id, settleAmount, newRemainingDebt);
      }
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to settle debt.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
          <h3 className="text-lg font-black font-display uppercase tracking-wider text-white flex items-center gap-2">
            <span>💰</span> Settle Outstanding Balance
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#181E2A] rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex justify-between items-center text-xs text-amber-300">
              <span>Member:</span>
              <span className="font-bold text-white text-sm">{client.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-amber-300 mt-1">
              <span>Total Remaining Debt:</span>
              <span className="font-bold text-sm text-amber-400">{Number(client.remaining_debt || 0).toLocaleString()} EGP</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Settlement Amount (EGP) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              max={client.remaining_debt}
              min="1"
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-amber-400 transition-colors font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Partial cash settlement"
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#222B3D] bg-[#121721]/40 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSettle}
            disabled={saving}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-wider disabled:opacity-60 rounded-xl text-sm transition-colors cursor-pointer"
          >
            {saving ? 'Settling…' : 'Confirm Settlement'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettleDebtModal;
