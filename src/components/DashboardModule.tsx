import React, { useState } from 'react';
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

  // Current Month Specific
  const totalBilled = currentMaint?.flats.reduce((acc, f) => acc + (f.actual || 0), 0) || 0;
  const totalCollected = currentMaint?.flats.reduce((acc, f) => acc + (f.paid || 0), 0) || 0;
  const totalPending = currentMaint?.flats.reduce((acc, f) => acc + (f.pending || 0), 0) || 0;
  const collectionPercent = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Cumulative Lifetime Intelligence (across all 31+ statements)
  const lifetimeCollections = data.maintenance_statements.reduce((sum, m) => {
    return sum + m.flats.reduce((fSum, f) => fSum + (f.paid || 0), 0);
  }, 0);

  const lifetimeExpenses = data.maintenance_statements.reduce((sum, m) => {
    return sum + m.expenses.reduce((eSum, e) => eSum + (e.status !== 'Billed' ? (e.amount || 0) : 0), 0);
  }, 0);

  const lifetimeWaterPumped = data.water_statements.reduce((sum, w) => {
    return sum + (w.total_water_consumption_liters || 0);
  }, 0);

  const totalSocietyFlats = data.flats.length || 32;

  // Find flats with pending dues for current month
  const highDueFlats = currentMaint?.flats
    .filter(f => f.pending > 10)
    .sort((a, b) => b.pending - a.pending) || [];

  // Recent 6 Months Trend for Visual Curve
  const recentStatements = [...data.maintenance_statements]
    .sort((a, b) => new Date(`${a.sheet_name} 1 UTC`).getTime() - new Date(`${b.sheet_name} 1 UTC`).getTime())
    .slice(-8);

  const trendData = recentStatements.map(m => {
    const col = m.flats.reduce((s, f) => s + (f.paid || 0), 0);
    const exp = m.expenses.reduce((s, e) => s + (e.status !== 'Billed' ? (e.amount || 0) : 0), 0);
    const shortLabel = m.sheet_name.split(' ')[0].slice(0, 3) + ' ' + (m.sheet_name.split(' ')[1] || '').slice(-2);
    return {
      month: m.sheet_name,
      shortLabel,
      collected: col,
      expenses: exp
    };
  });

  const maxTrendVal = Math.max(...trendData.map(t => Math.max(t.collected, t.expenses)), 95000);

  return (
    <div className="space-y-6">
      {/* Welcome & Command Center Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-blue-100">
                Society Executive Intelligence
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                Active Cycle: {selectedMonth}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Rockcliff 'B' Block Residents Association
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-xl">
              Central management dashboard • 32 flats, meter-based water distribution, and reconciled society accounting.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
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
              onClick={() => setActiveTab('expenses')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-white/20"
            >
              <DollarSign size={15} />
              <span>Expenses & Cash</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cumulative Lifetime Society Intelligence Grid */}
      <div>
        <div className="flex items-center space-x-2 mb-3 px-1">
          <span className="p-1 rounded-md bg-purple-100 text-purple-700 font-bold text-xs">🏛️</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Cumulative Society Lifetime Intelligence ({data.maintenance_statements.length} Months Tracked)
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Lifetime Collections</span>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{formatINR(lifetimeCollections)}</p>
            <span className="text-[11px] text-slate-400">Total cleared owner payments</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Lifetime Outflows</span>
            <p className="text-2xl font-black text-rose-600 mt-1 font-mono">{formatINR(lifetimeExpenses)}</p>
            <span className="text-[11px] text-slate-400">Total society maintenance spent</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Lifetime Water Pumped</span>
            <p className="text-2xl font-black text-blue-900 mt-1 font-mono">{formatLiters(lifetimeWaterPumped)}</p>
            <span className="text-[11px] text-slate-400">32 flats cumulative consumption</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Current Liquid Funds</span>
            <p className="text-2xl font-black text-purple-700 mt-1 font-mono">{formatINR(currentMaint?.total_balance)}</p>
            <span className="text-[11px] text-slate-400">Cash: {formatINR(currentMaint?.cash_balance)} | Bank: {formatINR(currentMaint?.bank_balance)}</span>
          </div>
        </div>
      </div>

      {/* Selected Month Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Month Target Billed */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">{selectedMonth} Assessment</span>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{formatINR(totalBilled)}</p>
          <p className="text-xs text-slate-400 mt-1">32 flats monthly bill target</p>
        </div>

        {/* Collections */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">{selectedMonth} Collected</span>
          <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">{formatINR(totalCollected)}</p>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span className="font-bold text-emerald-700">{collectionPercent}% Recovered</span>
            <span className="text-slate-400">{currentMaint?.flats.filter(f => f.pending <= 1).length} / 32 Paid</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${collectionPercent}%` }}></div>
          </div>
        </div>

        {/* Water Consumption */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 uppercase">{selectedMonth} Water Usage</span>
          <p className="text-2xl font-black text-blue-600 mt-2 font-mono">
            {formatLiters(currentWater?.total_water_consumption_liters)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Rate: <strong>₹{currentWater?.liter_per_charge?.toFixed(4) || '0.00'}/L</strong> • Tankers: {formatINR(currentWater?.tanker_bill)}
          </p>
        </div>

        {/* Pending Dues */}
        <div className={`p-5 rounded-3xl border shadow-sm ${totalPending > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <span className="text-xs font-semibold text-rose-600 uppercase">{selectedMonth} Pending</span>
          <p className="text-2xl font-black text-rose-600 mt-2 font-mono">{formatINR(totalPending)}</p>
          <p className="text-xs text-rose-700 mt-1 font-bold">
            {highDueFlats.length} flats requiring follow-up
          </p>
        </div>
      </div>

      {/* Two Column Grid: Financial Trend Curve & Delinquent Follow-up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Month Financial Trend Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Financial Performance Curve</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">Collections vs Expenses Trend</h3>
            </div>
            <div className="flex items-center space-x-3 text-xs font-bold">
              <span className="flex items-center space-x-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Collections</span>
              </span>
              <span className="flex items-center space-x-1 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span>Expenses</span>
              </span>
            </div>
          </div>

          <div className="mt-4">
            <svg viewBox="0 0 540 180" className="w-full h-44 select-none">
              <line x1="30" y1="20" x2="520" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="70" x2="520" y2="70" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="120" x2="520" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="150" x2="520" y2="150" stroke="#cbd5e1" strokeWidth="1.5" />

              {trendData.map((d, i) => {
                const step = (520 - 40) / Math.max(1, trendData.length);
                const x = 40 + i * step + step / 2;
                const colH = Math.max(4, (d.collected / maxTrendVal) * 120);
                const expH = Math.max(4, (d.expenses / maxTrendVal) * 120);

                return (
                  <g key={d.month}>
                    {/* Collected Bar */}
                    <rect x={x - 12} y={150 - colH} width="10" height={colH} rx="3" fill="#10b981" />
                    {/* Expense Bar */}
                    <rect x={x + 2} y={150 - expH} width="10" height={expH} rx="3" fill="#f43f5e" />
                    {/* Month label */}
                    <text x={x} y="168" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#64748b">
                      {d.shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Delinquent Flats Follow-up */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle size={18} />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Flats Requiring Payment Follow-up</h3>
                <p className="text-[11px] text-slate-500">{selectedMonth} Outstanding Balances</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('collections')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>View All 32</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {highDueFlats.length > 0 ? (
            <div className="space-y-2">
              {highDueFlats.slice(0, 6).map((flat) => (
                <div key={flat.flat} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center">
                      {flat.flat}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800">Flat {flat.flat}</p>
                      <p className="text-[10px] text-slate-400">Bill: {formatINR(flat.actual)}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-xs font-mono text-rose-600">{formatINR(flat.pending)}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase">
                      {flat.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-emerald-700 bg-emerald-50/50 rounded-2xl border border-emerald-200">
              <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-600" />
              <p className="font-bold">All 32 Flats Cleared!</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">No outstanding balances for {selectedMonth}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
