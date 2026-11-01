import React from 'react';
import { ApartmentData, UserRole } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, formatLiters } from '../services/calculations';
import { Building, Droplet, Receipt, DollarSign, Users, AlertCircle, CheckCircle2, ArrowRight, Phone, TrendingUp } from './Icons';

interface DashboardModuleProps {
  data: ApartmentData;
  selectedMonth: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  selectedFlat: number;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  data,
  selectedMonth,
  setActiveTab,
  currentRole,
  selectedFlat
}) => {
  const currentMaint = data.maintenance_statements.find(m => sameCalendarMonth(m.sheet_name, selectedMonth));
  const currentWater = data.water_statements.find(w => sameCalendarMonth(w.sheet_name, selectedMonth));

  const totalBilled = currentMaint?.flats.reduce((acc, f) => acc + (f.actual || 0), 0) || 0;
  const totalCollected = currentMaint?.flats.reduce((acc, f) => acc + (f.paid || 0), 0) || 0;
  const totalPending = currentMaint?.flats.reduce((acc, f) => acc + (f.pending || 0), 0) || 0;
  const collectionPercent = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Find flats with highest pending dues
  const highDueFlats = currentMaint?.flats
    .filter(f => f.pending > 100)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-blue-100">
              Apartment Management System
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
              Active Month: {selectedMonth}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Rockcliff 'B' Block Residents Association
          </h1>
          <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-xl">
            Managing 32 apartments across 4 floors with fair, meter-based water billing and transparent society accounting.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              onClick={() => setActiveTab('water-meter')}
              className="px-4 py-2 bg-white text-blue-900 rounded-xl text-xs font-bold shadow-md hover:bg-blue-50 transition-all flex items-center space-x-1.5"
            >
              <Droplet size={15} className="text-blue-600" />
              <span>Water Meter Readings</span>
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
            >
              <Receipt size={15} />
              <span>32 Flats Collections</span>
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
            >
              <Phone size={15} />
              <span>Plumber & Services</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Funds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Society Liquid Funds</span>
          <p className="text-2xl font-black text-purple-700 mt-2">
            {formatINR(currentMaint?.total_balance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cash: {formatINR(currentMaint?.cash_balance)} | Bank: {formatINR(currentMaint?.bank_balance)}
          </p>
        </div>

        {/* Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Collections ({selectedMonth})</span>
          <p className="text-2xl font-black text-emerald-600 mt-2">{formatINR(totalCollected)}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span>{collectionPercent}% Collected</span>
            <span className="text-slate-400">Target: {formatINR(totalBilled)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${collectionPercent}%` }}></div>
          </div>
        </div>

        {/* Water Consumption */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 uppercase">Total Water Consumed</span>
          <p className="text-2xl font-black text-blue-600 mt-2">
            {formatLiters(currentWater?.total_water_consumption_liters)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Rate: <strong>{formatINR(currentWater?.liter_per_charge)}/L</strong> • Tankers: {formatINR(currentWater?.tanker_bill)}
          </p>
        </div>

        {/* Pending Dues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 uppercase">Outstanding Dues</span>
          <p className="text-2xl font-black text-rose-600 mt-2">{formatINR(totalPending)}</p>
          <p className="text-xs text-slate-400 mt-1">Across 32 flats</p>
        </div>
      </div>

      {/* Two Column Grid: Pending Follow-up & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delinquent Flats Follow-up */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle size={18} />
              </span>
              <h3 className="font-bold text-slate-900 text-sm">Flats Requiring Payment Follow-up</h3>
            </div>
            <button
              onClick={() => setActiveTab('collections')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>View All 32</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {highDueFlats.length === 0 ? (
            <div className="p-6 text-center text-emerald-600 text-xs font-bold bg-emerald-50 rounded-2xl">
              ✓ All flat maintenance dues are fully cleared for this month!
            </div>
          ) : (
            <div className="space-y-2.5">
              {highDueFlats.map(flat => (
                <div
                  key={flat.flat}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-9 h-9 rounded-xl bg-slate-200 font-bold text-slate-800 flex items-center justify-center text-xs">
                      {flat.flat}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Flat {flat.flat}</p>
                      <p className="text-[10px] text-slate-500">Floor {Math.floor(flat.flat / 100)} • Mode: {flat.mode}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black font-mono text-rose-600">{formatINR(flat.pending)}</span>
                    <span className="block text-[10px] text-slate-400">Total Due</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Essential Services Quick Dial */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Phone size={18} />
              </span>
              <h3 className="font-bold text-slate-900 text-sm">Helpful Service Providers</h3>
            </div>
            <button
              onClick={() => setActiveTab('directory')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Full Directory</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.contacts.slice(0, 4).map(c => (
              <div key={c.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-0.5">
                    {c.category}
                  </span>
                  <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs font-mono font-bold text-slate-700 mt-1">{c.phone}</p>
                </div>
                <a
                  href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                  className="mt-3 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl text-center shadow-sm transition-all"
                >
                  Call Now
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
