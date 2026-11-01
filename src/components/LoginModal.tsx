import React, { useState } from 'react';
import { UserRole, AuthSession } from '../types/apartment';
import { saveSession } from '../services/auth';
import { Shield, AlertCircle } from './Icons';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (session: AuthSession) => void;
  flatsList: number[];
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess, flatsList }) => {
  const [roleTab, setRoleTab] = useState<UserRole>('user');
  const [selectedFlat, setSelectedFlat] = useState<number>(flatsList[0] || 101);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (roleTab === 'admin') {
      // Admin verification (default admin / admin)
      if (pin.trim().toLowerCase() === 'admin' || pin.trim() === '1234') {
        const session: AuthSession = {
          role: 'admin',
          username: 'Administrator',
          loggedInAt: new Date().toISOString()
        };
        saveSession(session);
        onLoginSuccess(session);
      } else {
        setError('Invalid Admin credentials. Default password is "admin" or "1234".');
      }
    } else if (roleTab === 'watchman') {
      // Watchman verification (default 1234 or watchman)
      if (pin.trim() === '1234' || pin.trim().toLowerCase() === 'watchman') {
        const session: AuthSession = {
          role: 'watchman',
          username: 'Building Watchman (Laxman)',
          loggedInAt: new Date().toISOString()
        };
        saveSession(session);
        onLoginSuccess(session);
      } else {
        setError('Invalid Watchman PIN. Default PIN is "1234".');
      }
    } else {
      // Flat Owner verification (default: flat number e.g. 101 or rockcliff101)
      const expected1 = String(selectedFlat);
      const expected2 = `rockcliff${selectedFlat}`;
      if (pin.trim() === expected1 || pin.trim().toLowerCase() === expected2 || pin.trim() === '1234') {
        const session: AuthSession = {
          role: 'user',
          flatNumber: selectedFlat,
          username: `Flat ${selectedFlat} Owner`,
          loggedInAt: new Date().toISOString()
        };
        saveSession(session);
        onLoginSuccess(session);
      } else {
        setError(`Invalid PIN for Flat ${selectedFlat}. Default PIN is your flat number ("${selectedFlat}") or "1234".`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        <div className="text-center pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md mb-2">
            <Shield size={24} />
          </div>
          <h2 className="text-xl font-black text-slate-900">Rockcliff 'B' Block</h2>
          <p className="text-xs text-slate-500 mt-0.5">Apartment Management & Accounting Portal</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-2xl mt-5">
          <button
            type="button"
            onClick={() => { setRoleTab('user'); setError(null); setPin(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              roleTab === 'user' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏠 Resident
          </button>
          <button
            type="button"
            onClick={() => { setRoleTab('admin'); setError(null); setPin(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              roleTab === 'admin' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👑 Admin
          </button>
          <button
            type="button"
            onClick={() => { setRoleTab('watchman'); setError(null); setPin(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              roleTab === 'watchman' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👮 Watchman
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {roleTab === 'user' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Your Flat Number
              </label>
              <select
                value={selectedFlat}
                onChange={(e) => { setSelectedFlat(Number(e.target.value)); setError(null); }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
              >
                {flatsList.map(f => (
                  <option key={f} value={f}>Flat {f} (Floor {Math.floor(f / 100)})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {roleTab === 'user' ? 'Flat Password / PIN' : roleTab === 'admin' ? 'Admin Password' : '4-Digit Watchman PIN'}
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(null); }}
              placeholder={roleTab === 'user' ? `Default: ${selectedFlat} or 1234` : roleTab === 'admin' ? 'Default: admin or 1234' : 'Default: 1234'}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-[0.99]"
            >
              Sign In to Rockcliff Portal
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
          <span>Quick Login Hints: Resident = Flat No | Admin = "admin" | Watchman = "1234"</span>
        </div>
      </div>
    </div>
  );
};
