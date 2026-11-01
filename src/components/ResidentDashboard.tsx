import React from 'react';
import { MaintenanceStatement, WaterStatement } from '../types/apartment';
import { formatINR, formatLiters, formatINRExact } from '../services/calculations';
import { sameCalendarMonth } from '../services/storage';
import { Receipt, Droplet, CheckCircle2, AlertCircle, TrendingUp, Calendar, Phone, ArrowRight } from './Icons';

interface ResidentDashboardProps {
  selectedFlat: number;
  selectedMonth: string;
  allMaintenanceStatements: MaintenanceStatement[];
  allWaterStatements: WaterStatement[];
  setActiveTab: (tab: string) => void;
}

export const ResidentDashboard: React.FC<ResidentDashboardProps> = ({
  selectedFlat,
  selectedMonth,
  allMaintenanceStatements,
  allWaterStatements,
  setActiveTab
}) => {
  const currentMaint = allMaintenanceStatements.find(m => sameCalendarMonth(m.sheet_name, selectedMonth));
  const currentWater = allWaterStatements.find(w => sameCalendarMonth(w.sheet_name, selectedMonth));

  const flatMaint = currentMaint?.flats.find(f => f.flat === selectedFlat);
  const flatWater = currentWater?.flats.find(f => f.flat === selectedFlat);

  // Parse current year & month date
  const curDate = new Date(`${selectedMonth} 1 UTC`);
  const currentYear = isNaN(curDate.getTime()) ? new Date().getUTCFullYear() : curDate.getUTCFullYear();
  const currentMonthIdx = isNaN(curDate.getTime()) ? new Date().getUTCMonth() : curDate.getUTCMonth();

  // Previous Month (MoM)
  const prevMonthDate = new Date(Date.UTC(currentYear, currentMonthIdx - 1, 1));
  const prevMonthLabel = prevMonthDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }) + ' ' + prevMonthDate.getUTCFullYear();
  const prevMaint = allMaintenanceStatements.find(m => sameCalendarMonth(m.sheet_name, prevMonthLabel));
  const prevWater = allWaterStatements.find(w => sameCalendarMonth(w.sheet_name, prevMonthLabel));
  const prevFlatMaint = prevMaint?.flats.find(f => f.flat === selectedFlat);
  const prevFlatWater = prevWater?.flats.find(f => f.flat === selectedFlat);

  // Previous Year Same Month (YoY)
  const prevYearMonthDate = new Date(Date.UTC(currentYear - 1, currentMonthIdx, 1));
  const prevYearMonthLabel = prevYearMonthDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }) + ' ' + prevYearMonthDate.getUTCFullYear();
  const prevYearMaint = allMaintenanceStatements.find(m => sameCalendarMonth(m.sheet_name, prevYearMonthLabel));
  const prevYearWater = allWaterStatements.find(w => sameCalendarMonth(w.sheet_name, prevYearMonthLabel));
  const prevYearFlatMaint = prevYearMaint?.flats.find(f => f.flat === selectedFlat);
  const prevYearFlatWater = prevYearWater?.flats.find(f => f.flat === selectedFlat);

  // Year to Date (YTD) analytics for currentYear
  const thisYearStatements = allMaintenanceStatements.filter(m => {
    const d = new Date(`${m.sheet_name} 1 UTC`);
    return !isNaN(d.getTime()) && d.getUTCFullYear() === currentYear;
  });

  const totalPaidThisYear = thisYearStatements.reduce((sum, m) => {
    const f = m.flats.find(item => item.flat === selectedFlat);
    return sum + (f?.paid || 0);
  }, 0);

  const monthsPassedThisYear = Math.max(1, thisYearStatements.length);
  const monthlyAveragePaidThisYear = Math.round(totalPaidThisYear / monthsPassedThisYear);

  const isPaid = (flatMaint?.pending || 0) <= 1;

  return (
    <div className="space-y-6">
      {/* Welcome Banner for Resident */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-purple-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-white/20 text-white backdrop-blur-md">
                🏠 My Apartment Portal
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-400/30 text-emerald-200 border border-emerald-400/40">
                {selectedMonth}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Flat {selectedFlat} — Monthly Overview
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-xl">
              Rockcliff 'B' Block Residents Association • Personal maintenance breakdown, meter readings, and verified payment history.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setActiveTab('resident-history')}
              className="px-4 py-2.5 bg-white text-blue-900 rounded-xl text-xs font-bold shadow-md hover:bg-blue-50 transition-all flex items-center space-x-1.5"
            >
              <Receipt size={15} className="text-blue-600" />
              <span>Lifetime History</span>
            </button>
            <button
              onClick={() => setActiveTab('water-meter')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
            >
              <Droplet size={15} />
              <span>Society Water Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Month Billing & Payment Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Billing Summary</span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              {currentMaint?.title || selectedMonth}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
              isPaid
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-rose-100 text-rose-800 border border-rose-200'
            }`}>
              {isPaid ? 'PAID & CLEARED' : 'PAYMENT DUE'}
            </span>
          </div>
        </div>

        {/* 4 Metrics for Selected Month */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Month Bill (Actual)</span>
            <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{formatINR(flatMaint?.actual)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Base + Water charges</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-xs text-emerald-700 font-medium">Amount Paid</span>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{formatINR(flatMaint?.paid)}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Channel: {flatMaint?.mode || 'Due'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
            <span className="text-xs text-rose-700 font-medium">Pending Dues</span>
            <p className={`text-2xl font-black mt-1 font-mono ${(flatMaint?.pending || 0) > 1 ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatINR(flatMaint?.pending)}
            </p>
            <p className="text-[11px] text-rose-600 mt-0.5">Total due remaining</p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
            <span className="text-xs text-blue-700 font-medium">Water Consumed</span>
            <p className="text-2xl font-black text-blue-900 mt-1 font-mono">{formatLiters(flatWater?.liters || 0)}</p>
            <p className="text-[11px] text-blue-600 mt-0.5">Avg: {flatWater?.avg_per_day || 0} L/day</p>
          </div>
        </div>

        {/* Itemized Assessment Breakdown */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Itemized Bill Breakdown</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <span className="text-slate-500 block">1. Fixed Mandatory Maintenance</span>
              <span className="text-sm font-bold font-mono text-slate-900">{formatINR(flatWater?.mandatory_maintenance || 1400)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Security, cleaning, lift AMC</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <span className="text-slate-500 block">2. Metered Water Charge</span>
              <span className="text-sm font-bold font-mono text-slate-900">{formatINR(flatWater?.water_charge || 0)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{formatLiters(flatWater?.liters || 0)} @ ₹{flatWater?.water_charge ? formatINRExact(flatWater.water_charge / Math.max(1, flatWater.liters)) : '0.00'}/L</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <span className="text-slate-500 block">3. Previous Pending Arrears</span>
              <span className="text-sm font-bold font-mono text-slate-900">{formatINR(flatMaint?.previous_pending || 0)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Carried forward dues</span>
            </div>
          </div>
        </div>
      </div>

      {/* MoM & YoY Comparative Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Month over Month (MoM) Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Month-over-Month (MoM)</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">Compared to Previous Month ({prevMonthLabel})</h3>
            </div>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp size={16} />
            </span>
          </div>

          {prevFlatMaint ? (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Previous Month Assessment:</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(prevFlatMaint.actual)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Current Month Assessment:</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(flatMaint?.actual)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-slate-100 font-bold">
                <span>Assessment Difference:</span>
                {(() => {
                  const diff = (flatMaint?.actual || 0) - (prevFlatMaint.actual || 0);
                  const isUp = diff > 0;
                  return (
                    <span className={`font-mono ${isUp ? 'text-rose-600' : diff < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {isUp ? '+' : ''}{formatINR(diff)} ({isUp ? '▲ Increase' : diff < 0 ? '▼ Savings' : 'Equal'})
                    </span>
                  );
                })()}
              </div>

              {prevFlatWater && flatWater && (
                <div className="flex justify-between items-center py-1 text-slate-500 pt-1">
                  <span>Water Consumption Change:</span>
                  <span className="font-mono">
                    {formatLiters(flatWater.liters)} vs {formatLiters(prevFlatWater.liters)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-400">No previous month statement recorded.</p>
          )}
        </div>

        {/* Year over Year (YoY) Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Year-over-Year (YoY)</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">Compared to Last Year ({prevYearMonthLabel})</h3>
            </div>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Calendar size={16} />
            </span>
          </div>

          {prevYearFlatMaint ? (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">{prevYearMonthLabel} Assessment:</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(prevYearFlatMaint.actual)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">{selectedMonth} Assessment:</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(flatMaint?.actual)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-slate-100 font-bold">
                <span>Annualized Difference:</span>
                {(() => {
                  const diff = (flatMaint?.actual || 0) - (prevYearFlatMaint.actual || 0);
                  const isUp = diff > 0;
                  return (
                    <span className={`font-mono ${isUp ? 'text-rose-600' : diff < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {isUp ? '+' : ''}{formatINR(diff)} ({isUp ? '▲ Higher' : diff < 0 ? '▼ Lower' : 'Equal'})
                    </span>
                  );
                })()}
              </div>

              {prevYearFlatWater && flatWater && (
                <div className="flex justify-between items-center py-1 text-slate-500 pt-1">
                  <span>Annual Water Liters:</span>
                  <span className="font-mono">
                    {formatLiters(flatWater.liters)} vs {formatLiters(prevYearFlatWater.liters)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-400">No comparative record exists for {prevYearMonthLabel}.</p>
          )}
        </div>
      </div>

      {/* YTD Annual Spending & Average Paid Metrics */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Annual Spending Performance</span>
            <h3 className="text-base font-black text-slate-900">Year {currentYear} Cumulative Assessment & Payments</h3>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {monthsPassedThisYear} Months Recorded in {currentYear}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Total Maintenance Paid in {currentYear}
            </span>
            <p className="text-3xl font-black text-emerald-700 mt-2 font-mono">
              {formatINR(totalPaidThisYear)}
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              Sum of all cleared collections for Flat {selectedFlat} across {currentYear}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">
              Monthly Average Paid in {currentYear}
            </span>
            <p className="text-3xl font-black text-blue-700 mt-2 font-mono">
              {formatINR(monthlyAveragePaidThisYear)} <span className="text-sm font-semibold text-blue-500">/ month</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {formatINR(totalPaidThisYear)} ÷ {monthsPassedThisYear} months recorded
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
