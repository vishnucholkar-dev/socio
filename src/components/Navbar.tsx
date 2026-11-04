import React, { useState } from 'react';
import { CycleStatus, UserRole } from '../types/apartment';
import { Building, Shield, Users, Droplet, Receipt, DollarSign, Calendar, Phone, TrendingUp } from './Icons';

interface NavbarProps {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  cycleStatuses: Record<string, CycleStatus>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedFlat: number;
  setSelectedFlat: (flat: number) => void;
  flatsList: number[];
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  onOpenSecurity?: () => void;
  onOpenRatePolicy?: () => void;
  onOpenBackupExport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setRole,
  selectedMonth,
  setSelectedMonth,
  availableMonths,
  cycleStatuses,
  activeTab,
  setActiveTab,
  selectedFlat,
  setSelectedFlat,
  flatsList,
  onLogout,
  onOpenChangePassword,
  onOpenSecurity,
  onOpenRatePolicy,
  onOpenBackupExport
}) => {
  const [mobileAdminMenuOpen, setMobileAdminMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs no-print w-full max-w-full overflow-hidden">
      {/* =========================================================================
          DESKTOP & TABLET HEADER (Hidden on small mobile screens: sm:flex)
          ========================================================================= */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-3">
          {/* Logo & Society Name */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <Building size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-slate-900 text-base tracking-tight">Rockcliff 'B'</span>
                <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">32 Flats</span>
              </div>
              <p className="text-[11px] text-slate-400">Apartment Maintenance & Water System</p>
            </div>
          </div>

          {/* Controls & Badges */}
          <div className="flex items-center space-x-2 shrink-0">
            {currentRole === 'admin' ? (
              <div className="flex items-center space-x-1.5">
                <div className="flex items-center space-x-1 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span className="text-xs font-black text-blue-900 tracking-wide">
                    👑 Admin
                  </span>
                </div>

                {onOpenSecurity && (
                  <button
                    type="button"
                    onClick={onOpenSecurity}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs"
                  >
                    <span>🛡️</span>
                    <span>Security</span>
                  </button>
                )}

                {onOpenRatePolicy && (
                  <button
                    type="button"
                    onClick={onOpenRatePolicy}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs"
                  >
                    <span>⚙️</span>
                    <span>Rates</span>
                  </button>
                )}

                {onOpenBackupExport && (
                  <button
                    type="button"
                    onClick={onOpenBackupExport}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs"
                  >
                    <span>💾</span>
                    <span>Exports</span>
                  </button>
                )}
              </div>
            ) : currentRole === 'watchman' ? (
              <div className="flex items-center space-x-1 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                <span className="text-xs font-black text-purple-900 tracking-wide">
                  👮 Watchman
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-black text-emerald-900 tracking-wide">
                    Flat {selectedFlat}
                  </span>
                </div>
                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs"
                  >
                    <span>🔐</span>
                    <span>Change PIN</span>
                  </button>
                )}
              </div>
            )}

            {/* Desktop Month Selector */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Calendar size={14} className="text-slate-500 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m} {cycleStatuses[m] === 'open' ? '• open' : ''}</option>
                ))}
              </select>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 border border-slate-200 rounded-xl hover:bg-rose-50 transition-colors shrink-0"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Desktop Tab Bar */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-100">
          {currentRole === 'admin' && (
            <>
              <TabBtn id="dashboard" label="Dashboard" icon={<Building size={16} />} active={activeTab === 'dashboard'} onClick={setActiveTab} />
              <TabBtn id="water-meter" label="Water Meter & Billing" icon={<Droplet size={16} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
              <TabBtn id="collections" label="Collections (32 Flats)" icon={<Receipt size={16} />} active={activeTab === 'collections'} onClick={setActiveTab} />
              <TabBtn id="expenses" label="Expenses (Cash/Bank)" icon={<DollarSign size={16} />} active={activeTab === 'expenses'} onClick={setActiveTab} />
              <TabBtn id="monthly-statement" label="Monthly Statement" icon={<Calendar size={16} />} active={activeTab === 'monthly-statement'} onClick={setActiveTab} />
              <TabBtn id="yearly-statement" label="Yearly Statement" icon={<TrendingUp size={16} />} active={activeTab === 'yearly-statement'} onClick={setActiveTab} />
              <TabBtn id="cycle-management" label="Cycle History" icon={<Calendar size={16} />} active={activeTab === 'cycle-management'} onClick={setActiveTab} />
              <TabBtn id="security-audit" label="Security Audit & IPs" icon={<Shield size={16} />} active={activeTab === 'security-audit'} onClick={setActiveTab} />
              <TabBtn id="directory" label="Helpful Contacts" icon={<Phone size={16} />} active={activeTab === 'directory'} onClick={setActiveTab} />
            </>
          )}

          {currentRole === 'user' && (
            <>
              <TabBtn id="my-flat" label={`Dashboard (Flat ${selectedFlat})`} icon={<Building size={16} />} active={activeTab === 'my-flat'} onClick={setActiveTab} />
              <TabBtn id="resident-history" label="Billing & Receipt History" icon={<Receipt size={16} />} active={activeTab === 'resident-history'} onClick={setActiveTab} />
              <TabBtn id="water-meter" label="Flat Water Consumption & Maintenance" icon={<Droplet size={16} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
              <TabBtn id="monthly-statement" label="Society Monthly & Yearly Statements" icon={<Calendar size={16} />} active={activeTab === 'monthly-statement'} onClick={setActiveTab} />
              <TabBtn id="directory" label="Helpful Contacts" icon={<Phone size={16} />} active={activeTab === 'directory'} onClick={setActiveTab} />
            </>
          )}

          {currentRole === 'watchman' && (
            <>
              <TabBtn id="water-meter" label="Enter Water Meter Readings" icon={<Droplet size={16} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
              <TabBtn id="directory" label="Emergency Contacts" icon={<Phone size={16} />} active={activeTab === 'directory'} onClick={setActiveTab} />
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          COMPACT 2-ROW MOBILE HEADER (Strictly < 330px width: sm:hidden)
          ========================================================================= */}
      <div className="sm:hidden px-3 py-2 bg-white w-full max-w-full">
        {/* Row 1: Brand & Role & Logout */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center space-x-1.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              RC
            </div>
            <span className="font-black text-slate-900 text-sm tracking-tight">Rockcliff 'B'</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded-full">32</span>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {currentRole === 'admin' ? (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-blue-50 text-blue-900 border border-blue-200">
                👑 Admin
              </span>
            ) : currentRole === 'watchman' ? (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-purple-50 text-purple-900 border border-purple-200">
                👮 Watchman
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300">
                Flat {selectedFlat}
              </span>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg hover:bg-rose-50"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Full-Width Clean Month Selector + Admin Tools Trigger */}
        <div className="flex items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
          <div className="flex-1 flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl min-w-0">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer truncate"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m} {cycleStatuses[m] === 'open' ? '• open' : ''}</option>
              ))}
            </select>
          </div>

          {currentRole === 'admin' && (
            <button
              type="button"
              onClick={() => setMobileAdminMenuOpen(!mobileAdminMenuOpen)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold border border-slate-200 shrink-0 flex items-center space-x-1"
            >
              <span>⚙️</span>
              <span>Tools</span>
            </button>
          )}

          {currentRole === 'user' && onOpenChangePassword && (
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-200 shrink-0 flex items-center space-x-1"
            >
              <span>🔐</span>
              <span>PIN</span>
            </button>
          )}
        </div>

        {/* Mobile Admin Tools Drawer */}
        {currentRole === 'admin' && mobileAdminMenuOpen && (
          <div className="py-2 mt-1 border-t border-slate-100 flex flex-wrap gap-1.5 animate-in fade-in">
            {onOpenSecurity && (
              <button
                type="button"
                onClick={() => { onOpenSecurity(); setMobileAdminMenuOpen(false); }}
                className="flex-1 min-w-[90px] py-1.5 px-2 rounded-xl bg-blue-50 text-blue-900 text-[11px] font-bold border border-blue-200 text-center"
              >
                🛡️ Security
              </button>
            )}
            {onOpenRatePolicy && (
              <button
                type="button"
                onClick={() => { onOpenRatePolicy(); setMobileAdminMenuOpen(false); }}
                className="flex-1 min-w-[90px] py-1.5 px-2 rounded-xl bg-amber-50 text-amber-900 text-[11px] font-bold border border-amber-200 text-center"
              >
                ⚙️ Rates
              </button>
            )}
            {onOpenBackupExport && (
              <button
                type="button"
                onClick={() => { onOpenBackupExport(); setMobileAdminMenuOpen(false); }}
                className="flex-1 min-w-[90px] py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-900 text-[11px] font-bold border border-emerald-200 text-center"
              >
                💾 Backup/Excel
              </button>
            )}
            <button
              type="button"
              onClick={() => { setActiveTab('security-audit'); setMobileAdminMenuOpen(false); }}
              className="flex-1 min-w-[90px] py-1.5 px-2 rounded-xl bg-purple-50 text-purple-900 text-[11px] font-bold border border-purple-200 text-center"
            >
              🔍 Audit & IPs
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          PERSISTENT STICKY BOTTOM THUMB BAR (md:hidden)
          ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl z-50 px-1 py-1 flex justify-around items-center w-full max-w-full">
        {currentRole === 'admin' && (
          <>
            <MobileTabBtn id="dashboard" label="Home" icon={<Building size={17} />} active={activeTab === 'dashboard'} onClick={setActiveTab} />
            <MobileTabBtn id="water-meter" label="Water" icon={<Droplet size={17} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
            <MobileTabBtn id="collections" label="Flats" icon={<Receipt size={17} />} active={activeTab === 'collections'} onClick={setActiveTab} />
            <MobileTabBtn id="expenses" label="Expenses" icon={<DollarSign size={17} />} active={activeTab === 'expenses'} onClick={setActiveTab} />
            <MobileTabBtn id="monthly-statement" label="Reports" icon={<Calendar size={17} />} active={activeTab === 'monthly-statement' || activeTab === 'yearly-statement'} onClick={setActiveTab} />
          </>
        )}

        {currentRole === 'user' && (
          <>
            <MobileTabBtn id="my-flat" label="Dashboard" icon={<Building size={17} />} active={activeTab === 'my-flat'} onClick={setActiveTab} />
            <MobileTabBtn id="resident-history" label="Receipts" icon={<Receipt size={17} />} active={activeTab === 'resident-history'} onClick={setActiveTab} />
            <MobileTabBtn id="water-meter" label="Water" icon={<Droplet size={17} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
            <MobileTabBtn id="monthly-statement" label="Statements" icon={<Calendar size={17} />} active={activeTab === 'monthly-statement'} onClick={setActiveTab} />
            <MobileTabBtn id="directory" label="Contacts" icon={<Phone size={17} />} active={activeTab === 'directory'} onClick={setActiveTab} />
          </>
        )}

        {currentRole === 'watchman' && (
          <>
            <MobileTabBtn id="water-meter" label="Readings" icon={<Droplet size={17} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
            <MobileTabBtn id="directory" label="Emergency" icon={<Phone size={17} />} active={activeTab === 'directory'} onClick={setActiveTab} />
          </>
        )}
      </nav>
    </header>
  );
};

const TabBtn: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (id: string) => void;
}> = ({ id, label, icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
      active
        ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-200/60'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

const MobileTabBtn: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (id: string) => void;
}> = ({ id, label, icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all ${
      active
        ? 'text-blue-700 font-bold bg-blue-50/70'
        : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    <span className="p-0.5">{icon}</span>
    <span className="text-[10px] tracking-tight">{label}</span>
  </button>
);
