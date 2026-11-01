import React from 'react';
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
  onLogout
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm no-print">
      {/* Top Bar: Brand + Role Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Society Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <Building size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">Rockcliff 'B' Block</span>
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">32 Flats</span>
              </div>
              <p className="text-xs text-slate-500">Apartment Maintenance & Water Transactions System</p>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => {
                  setRole('admin');
                  if (activeTab === 'my-flat') setActiveTab('dashboard');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentRole === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👑</span>
                <span>Admin</span>
              </button>

              <button
                onClick={() => {
                  setRole('user');
                  setActiveTab('my-flat');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentRole === 'user'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏠</span>
                <span>Resident</span>
              </button>

              <button
                onClick={() => {
                  setRole('watchman');
                  setActiveTab('water-meter');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentRole === 'watchman'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield size={14} />
                <span>Watchman</span>
              </button>
            </div>

            {/* Resident Flat Picker (when in User role) */}
            {currentRole === 'user' && (
              <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                <span className="text-xs font-medium text-emerald-800">My Flat:</span>
                <select
                  value={selectedFlat}
                  onChange={(e) => setSelectedFlat(Number(e.target.value))}
                  className="bg-white border border-emerald-300 text-xs rounded-lg px-2 py-1 font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {flatsList.map(f => (
                    <option key={f} value={f}>Flat {f}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Month Selector */}
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
              <Calendar size={14} className="text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m} — {cycleStatuses[m] === 'legacy-closed' ? 'Legacy closed' : cycleStatuses[m] === 'initialization-required' ? 'Needs initialization' : cycleStatuses[m] || 'Not open'}</option>
                ))}
              </select>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out of current role"
                className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-rose-600 border border-slate-200 rounded-xl hover:bg-rose-50 transition-colors"
              >
                Logout
              </button>
            )}

          </div>
        </div>

          {/* Navigation Tabs based on Role (Desktop) */}
        <div className="hidden md:flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-100">
          {currentRole === 'admin' && (
            <>
              <TabBtn id="dashboard" label="Dashboard" icon={<Building size={16} />} active={activeTab === 'dashboard'} onClick={setActiveTab} />
              <TabBtn id="water-meter" label="Water Meter & Billing" icon={<Droplet size={16} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
              <TabBtn id="collections" label="Collections (32 Flats)" icon={<Receipt size={16} />} active={activeTab === 'collections'} onClick={setActiveTab} />
              <TabBtn id="expenses" label="Expenses (Cash/Bank)" icon={<DollarSign size={16} />} active={activeTab === 'expenses'} onClick={setActiveTab} />
              <TabBtn id="monthly-statement" label="Monthly Statement" icon={<Calendar size={16} />} active={activeTab === 'monthly-statement'} onClick={setActiveTab} />
              <TabBtn id="yearly-statement" label="Yearly Statement" icon={<TrendingUp size={16} />} active={activeTab === 'yearly-statement'} onClick={setActiveTab} />
              <TabBtn id="cycle-management" label="Cycle History" icon={<Calendar size={16} />} active={activeTab === 'cycle-management'} onClick={setActiveTab} />
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
              <TabBtn id="collections" label="Gate Cash Handover" icon={<Receipt size={16} />} active={activeTab === 'collections'} onClick={setActiveTab} />
              <TabBtn id="directory" label="Emergency Contacts" icon={<Phone size={16} />} active={activeTab === 'directory'} onClick={setActiveTab} />
            </>
          )}
        </div>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-50 px-2 py-1.5 flex justify-around items-center">
        {currentRole === 'admin' && (
          <>
            <MobileTabBtn id="dashboard" label="Home" icon={<Building size={18} />} active={activeTab === 'dashboard'} onClick={setActiveTab} />
            <MobileTabBtn id="water-meter" label="Water" icon={<Droplet size={18} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
            <MobileTabBtn id="collections" label="Flats" icon={<Receipt size={18} />} active={activeTab === 'collections'} onClick={setActiveTab} />
            <MobileTabBtn id="expenses" label="Expenses" icon={<DollarSign size={18} />} active={activeTab === 'expenses'} onClick={setActiveTab} />
            <MobileTabBtn id="monthly-statement" label="Reports" icon={<Calendar size={18} />} active={activeTab === 'monthly-statement' || activeTab === 'yearly-statement'} onClick={setActiveTab} />
            <MobileTabBtn id="cycle-management" label="Cycles" icon={<Calendar size={18} />} active={activeTab === 'cycle-management'} onClick={setActiveTab} />
            <MobileTabBtn id="directory" label="Contacts" icon={<Phone size={18} />} active={activeTab === 'directory'} onClick={setActiveTab} />
          </>
        )}

        {currentRole === 'user' && (
          <>
            <MobileTabBtn id="my-flat" label={`Flat ${selectedFlat}`} icon={<Receipt size={18} />} active={activeTab === 'my-flat'} onClick={setActiveTab} />
            <MobileTabBtn id="water-meter" label="My Water" icon={<Droplet size={18} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
            <MobileTabBtn id="monthly-statement" label="Society" icon={<Calendar size={18} />} active={activeTab === 'monthly-statement'} onClick={setActiveTab} />
            <MobileTabBtn id="directory" label="Contacts" icon={<Phone size={18} />} active={activeTab === 'directory'} onClick={setActiveTab} />
          </>
        )}

        {currentRole === 'watchman' && (
          <>
            <MobileTabBtn id="water-meter" label="Readings" icon={<Droplet size={18} />} active={activeTab === 'water-meter'} onClick={setActiveTab} />
            <MobileTabBtn id="collections" label="Gate Cash" icon={<Receipt size={18} />} active={activeTab === 'collections'} onClick={setActiveTab} />
            <MobileTabBtn id="directory" label="Emergency" icon={<Phone size={18} />} active={activeTab === 'directory'} onClick={setActiveTab} />
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
        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200/60'
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
    className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all min-w-[50px] ${
      active
        ? 'text-blue-600 font-extrabold'
        : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    <div className={`p-1 rounded-lg ${active ? 'bg-blue-50 text-blue-600' : ''}`}>
      {icon}
    </div>
    <span className="mt-0.5 leading-none">{label}</span>
  </button>
);
