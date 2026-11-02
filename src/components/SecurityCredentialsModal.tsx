import React, { useState } from 'react';
import { changeAdminPassword, changeWatchmanPin, resetFlatPin, resetAllFlatPins } from '../services/auth';

interface SecurityCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flatsList: number[];
}

export const SecurityCredentialsModal: React.FC<SecurityCredentialsModalProps> = ({
  isOpen,
  onClose,
  flatsList = []
}) => {
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminPwdMsg, setAdminPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newWatchmanPin, setNewWatchmanPin] = useState('');
  const [watchmanPinMsg, setWatchmanPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedResetFlat, setSelectedResetFlat] = useState<number>(flatsList[0] || 101);
  const [flatResetMsg, setFlatResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 rounded-2xl bg-blue-100 text-blue-700 text-lg font-bold">🛡️</span>
            <div>
              <h2 className="text-lg font-black text-slate-900">Security & Credentials Management</h2>
              <p className="text-xs text-slate-500">Admin credentials, Watchman PIN, and Flat Owner PIN resets</p>
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

        <div className="mt-6 space-y-6">
          {/* 1. Admin Password Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center space-x-1.5 mb-2">
              <span className="text-sm">👑</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Change Admin Password</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Set a new secure password for accessing the Administrator portal.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAdminPwdMsg(null);
                try {
                  changeAdminPassword(newAdminPassword);
                  setAdminPwdMsg({ type: 'success', text: 'Admin password updated successfully!' });
                  setNewAdminPassword('');
                  setTimeout(() => setAdminPwdMsg(null), 3000);
                } catch (err) {
                  setAdminPwdMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error' });
                }
              }}
              className="flex gap-2"
            >
              <input
                type="password"
                placeholder="New Admin Password (min 4 chars)"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                required
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Save
              </button>
            </form>
            {adminPwdMsg && (
              <span className={`text-xs font-bold mt-2 block ${adminPwdMsg.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                {adminPwdMsg.text}
              </span>
            )}
          </div>

          {/* 2. Watchman PIN Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center space-x-1.5 mb-2">
              <span className="text-sm">👮</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Change Watchman PIN</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Configure the 4-digit mobile meter reading PIN for the building watchman (Laxman).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setWatchmanPinMsg(null);
                try {
                  changeWatchmanPin(newWatchmanPin);
                  setWatchmanPinMsg({ type: 'success', text: 'Watchman PIN updated successfully!' });
                  setNewWatchmanPin('');
                  setTimeout(() => setWatchmanPinMsg(null), 3000);
                } catch (err) {
                  setWatchmanPinMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error' });
                }
              }}
              className="flex gap-2"
            >
              <input
                type="password"
                placeholder="New 4-digit PIN (default 1234)"
                value={newWatchmanPin}
                onChange={(e) => setNewWatchmanPin(e.target.value)}
                required
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Save
              </button>
            </form>
            {watchmanPinMsg && (
              <span className={`text-xs font-bold mt-2 block ${watchmanPinMsg.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                {watchmanPinMsg.text}
              </span>
            )}
          </div>

          {/* 3. Flat Owners Reset to Default Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm">🏠</span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Reset Flat Owner PIN to Default</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset ALL 32 flat owner passwords back to their default flat numbers?')) {
                    resetAllFlatPins();
                    setFlatResetMsg({ type: 'success', text: 'All 32 flat owner passwords successfully reset to default (flat number)!' });
                    setTimeout(() => setFlatResetMsg(null), 3500);
                  }
                }}
                className="text-[11px] text-rose-700 font-bold hover:underline"
              >
                Reset All 32 Flats to Default
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Admins cannot set custom passwords for owners. Flat owners set their own passwords, and Admins can reset them to default (Flat Number).
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedResetFlat}
                onChange={(e) => setSelectedResetFlat(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none"
              >
                {flatsList.map(f => <option key={f} value={f}>Flat {f}</option>)}
              </select>

              <button
                type="button"
                onClick={() => {
                  resetFlatPin(selectedResetFlat);
                  setFlatResetMsg({ type: 'success', text: `Flat ${selectedResetFlat} password reset to default ("${selectedResetFlat}")!` });
                  setTimeout(() => setFlatResetMsg(null), 3000);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                Reset Flat {selectedResetFlat} to Default
              </button>
            </div>
            {flatResetMsg && (
              <span className={`text-xs font-bold mt-2 block ${flatResetMsg.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                {flatResetMsg.text}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
