import React, { useState } from 'react';
import { BillingConfigEntry } from '../types/apartment';
import { formatINR } from '../services/calculations';

interface RatePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  configHistory: BillingConfigEntry[];
  onAddConfig: (entry: Omit<BillingConfigEntry, 'id' | 'changed_at'>) => boolean;
}

export const RatePolicyModal: React.FC<RatePolicyModalProps> = ({
  isOpen,
  onClose,
  configHistory,
  onAddConfig
}) => {
  const latest = configHistory.length > 0 ? configHistory[configHistory.length - 1] : null;

  const [mandatory, setMandatory] = useState<number>(latest?.mandatory_maintenance || 1400);
  const [commonUtil, setCommonUtil] = useState<number>(latest?.common_utilization || 6000);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().slice(0, 7));
  const [changedBy, setChangedBy] = useState<string>('Society General Body / Admin');
  const [notes, setNotes] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = onAddConfig({
      mandatory_maintenance: mandatory,
      common_utilization: commonUtil,
      effective_from: effectiveFrom,
      changed_by: changedBy,
      notes: notes || 'Updated via Admin Settings Panel'
    });
    if (!saved) return;

    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 text-lg font-bold">⚙️</span>
            <div>
              <h2 className="text-lg font-black text-slate-900">Mandatory Maintenance & Common Utility Settings</h2>
              <p className="text-xs text-slate-500">Configure base society maintenance and motor pumping power deductions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mandatory Base Maintenance (₹)
              </label>
              <input
                type="number"
                value={mandatory}
                onChange={(e) => setMandatory(Number(e.target.value))}
                min="0"
                step="50"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Fixed fee billed to all 32 flats</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Common Electricity Deduction (-C) (₹)
              </label>
              <input
                type="number"
                value={commonUtil}
                onChange={(e) => setCommonUtil(Number(e.target.value))}
                min="0"
                step="100"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Lift & corridor power deduction</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Effective From Month
              </label>
              <input
                type="month"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Changed By / Authority
              </label>
              <input
                type="text"
                value={changedBy}
                onChange={(e) => setChangedBy(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              General Body Meeting / Approval Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved in AGM 2026 for security guard salary hike"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none"
            />
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-1.5">
              <span>✓</span>
              <span>Rate policy updated and logged in society audit history!</span>
            </div>
          )}

          {/* Historical Log */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Historical Rate Changes ({configHistory.length})
            </h4>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl text-xs divide-y divide-slate-100">
              {configHistory.slice().reverse().map((cfg, idx) => (
                <div key={cfg.id || idx} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900 block font-mono">
                      Base: {formatINR(cfg.mandatory_maintenance)} • Deduction: {formatINR(cfg.common_utilization)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{cfg.notes} — {cfg.changed_by}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {cfg.effective_from}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              Save Rate Policy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
