import React, { useState } from 'react';
import { BillingConfigEntry } from '../types/apartment';
import { formatINR } from '../services/calculations';
import { Shield, CheckCircle2, Calendar, TrendingUp } from './Icons';
import { changeAdminPassword, changeWatchmanPin, resetFlatPin, resetAllFlatPins } from '../services/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  configHistory: BillingConfigEntry[];
  onAddConfig: (entry: Omit<BillingConfigEntry, 'id' | 'changed_at'>) => boolean;
  onExportBackup?: () => void;
  onImportBackup?: (jsonContent: string) => void;
  flatsList?: number[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  configHistory,
  onAddConfig,
  onExportBackup,
  onImportBackup,
  flatsList = []
}) => {
  const latest = configHistory.length > 0 ? configHistory[configHistory.length - 1] : null;

  const [mandatory, setMandatory] = useState<number>(latest?.mandatory_maintenance || 1400);
  const [commonUtil, setCommonUtil] = useState<number>(latest?.common_utilization || 6000);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().slice(0, 7));
  const [changedBy, setChangedBy] = useState<string>('Society General Body / Admin');
  const [notes, setNotes] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Password Management State
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminPwdMsg, setAdminPwdMsg] = useState<string | null>(null);
  const [newWatchmanPin, setNewWatchmanPin] = useState('');
  const [watchmanPinMsg, setWatchmanPinMsg] = useState<string | null>(null);
  const [selectedResetFlat, setSelectedResetFlat] = useState<number>(flatsList[0] || 101);
  const [flatResetMsg, setFlatResetMsg] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Shield size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900">Mandatory Maintenance & Common Utility Settings</h2>
              <p className="text-xs text-slate-500">Configure society billing parameters with complete historical audit trail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {successMsg && (
          <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>New billing policy recorded into audit history successfully!</span>
          </div>
        )}

        {/* Edit Configuration Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Base Maintenance (₹)
              </label>
              <input
                type="number"
                step="any"
                value={mandatory}
                onChange={(e) => setMandatory(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Fixed charge per flat (security, cleaning, garbage)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Common Power Deduction (₹)
              </label>
              <input
                type="number"
                step="any"
                value={commonUtil}
                onChange={(e) => setCommonUtil(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Deducted from Electricity Bill for lifts & corridor lights</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Effective From Month
              </label>
              <input
                type="month"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Authorized By / Authority
              </label>
              <input
                type="text"
                value={changedBy}
                onChange={(e) => setChangedBy(e.target.value)}
                required
                placeholder="e.g. Society AGM Resolution, Committee Decision"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Revision Notes / Reason (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Revised at AGM 2026 to accommodate increased security salaries and diesel costs."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              Update Policy & Append to History
            </button>
          </div>
        </form>

        {/* Historical Audit Trail */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp size={16} className="text-purple-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Rate Configuration History & Audit Trail
            </h3>
          </div>

          <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 text-slate-600 uppercase text-[10px] font-bold">
                <tr className="border-b border-slate-200">
                  <th className="py-2.5 px-3">Effective</th>
                  <th className="py-2.5 px-3">Mandatory Base</th>
                  <th className="py-2.5 px-3">Common Util</th>
                  <th className="py-2.5 px-3">Authorized By</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configHistory.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-blue-700">{item.effective_from}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{formatINR(item.mandatory_maintenance)}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{formatINR(item.common_utilization)}</td>
                    <td className="py-2 px-3 text-slate-700">{item.changed_by}</td>
                    <td className="py-2 px-3 text-slate-500 max-w-xs truncate">{item.notes || '-'}</td>
                    <td className="py-2 px-3 text-right text-[10px] text-slate-400 font-mono">
                      {new Date(item.changed_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cross-Browser Society Data Backup & Restore */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-base">💾</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Cross-Browser Backup & Restore
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Transfer your active society receipts, open cycles, and expenses seamlessly between Chrome, Edge, and other browsers.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {onExportBackup && (
              <button
                type="button"
                onClick={onExportBackup}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                ⬇️ Export Backup (JSON)
              </button>
            )}

            {onImportBackup && (
              <label className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-blue-200 shadow-xs">
                <span>⬆️ Import Backup (JSON)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      if (content) {
                        try {
                          onImportBackup(content);
                          setImportStatus('Backup restored successfully! All data updated.');
                          setTimeout(() => {
                            setImportStatus(null);
                            onClose();
                          }, 1500);
                        } catch (err) {
                          setImportStatus(err instanceof Error ? err.message : 'Import failed.');
                        }
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            )}

            {importStatus && (
              <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                importStatus.includes('successfully') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}>
                {importStatus}
              </span>
            )}
          </div>
        </div>

        {/* Security & Password Management Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-base">🔐</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Security & Credentials Management
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Change your Admin password, update Watchman PIN, or reset flat owner passwords back to their default flat number.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Change Admin Password */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Change Admin Password</span>
              <div className="flex space-x-2">
                <input
                  type="password"
                  placeholder="New Admin Password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      changeAdminPassword(newAdminPassword);
                      setAdminPwdMsg('Admin password updated!');
                      setNewAdminPassword('');
                      setTimeout(() => setAdminPwdMsg(null), 2500);
                    } catch (err) {
                      setAdminPwdMsg(err instanceof Error ? err.message : 'Error');
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl whitespace-nowrap"
                >
                  Save
                </button>
              </div>
              {adminPwdMsg && <span className="text-[11px] font-bold text-emerald-700 block">{adminPwdMsg}</span>}
            </div>

            {/* Change Watchman PIN */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Change Watchman PIN</span>
              <div className="flex space-x-2">
                <input
                  type="password"
                  placeholder="New 4-digit PIN (default 1234)"
                  value={newWatchmanPin}
                  onChange={(e) => setNewWatchmanPin(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      changeWatchmanPin(newWatchmanPin);
                      setWatchmanPinMsg('Watchman PIN updated!');
                      setNewWatchmanPin('');
                      setTimeout(() => setWatchmanPinMsg(null), 2500);
                    } catch (err) {
                      setWatchmanPinMsg(err instanceof Error ? err.message : 'Error');
                    }
                  }}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-xl whitespace-nowrap"
                >
                  Save
                </button>
              </div>
              {watchmanPinMsg && <span className="text-[11px] font-bold text-emerald-700 block">{watchmanPinMsg}</span>}
            </div>

            {/* Reset Flat Owner Password */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 block">Reset Flat Owner Password</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset ALL 32 flat owner passwords back to their default flat numbers?')) {
                      resetAllFlatPins();
                      setFlatResetMsg('All 32 flat owner passwords reset to default (flat number)!');
                      setTimeout(() => setFlatResetMsg(null), 3000);
                    }
                  }}
                  className="text-[11px] text-rose-700 font-bold hover:underline"
                >
                  Reset All 32 Flats to Default
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={selectedResetFlat}
                  onChange={(e) => setSelectedResetFlat(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                >
                  {flatsList.map(f => <option key={f} value={f}>Flat {f}</option>)}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    resetFlatPin(selectedResetFlat);
                    setFlatResetMsg(`Flat ${selectedResetFlat} password reset to "${selectedResetFlat}"!`);
                    setTimeout(() => setFlatResetMsg(null), 2500);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Reset Flat {selectedResetFlat} to Default
                </button>
              </div>
              {flatResetMsg && <span className="text-[11px] font-bold text-emerald-700 block">{flatResetMsg}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
