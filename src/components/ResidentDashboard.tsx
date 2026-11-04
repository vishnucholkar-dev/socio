import React, { useState } from 'react';
import { MaintenanceStatement, WaterStatement } from '../types/apartment';
import { formatINR, formatLiters, formatINRExact } from '../services/calculations';
import { sameCalendarMonth } from '../services/storage';
import { changeFlatPassword } from '../services/auth';
import { ROCKCLIFF_UPI_QR_DATA_URI } from '../data/qrCodeDataUri';
import { Receipt, Droplet, CheckCircle2, AlertCircle, TrendingUp, Calendar, Phone, ArrowRight } from './Icons';

interface ResidentDashboardProps {
  selectedFlat: number;
  selectedMonth: string;
  allMaintenanceStatements: MaintenanceStatement[];
  allWaterStatements: WaterStatement[];
  setActiveTab: (tab: string) => void;
  isPwdModalOpen?: boolean;
  setIsPwdModalOpen?: (open: boolean) => void;
}

export const ResidentDashboard: React.FC<ResidentDashboardProps> = ({
  selectedFlat,
  selectedMonth,
  allMaintenanceStatements,
  allWaterStatements,
  setActiveTab,
  isPwdModalOpen = false,
  setIsPwdModalOpen
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

  // Interactive Chart Year State (defaults to current year)
  const [chartYear, setChartYear] = useState<number>(currentYear);

  // Filter statements for chartYear
  const yearMaintStatements = allMaintenanceStatements
    .filter(m => {
      const d = new Date(`${m.sheet_name} 1 UTC`);
      return !isNaN(d.getTime()) && d.getUTCFullYear() === chartYear;
    })
    .sort((a, b) => new Date(`${a.sheet_name} 1 UTC`).getTime() - new Date(`${b.sheet_name} 1 UTC`).getTime());

  // Aggregate monthly series for the selected chart year
  const monthlySeries = yearMaintStatements.map(m => {
    const fM = m.flats.find(item => item.flat === selectedFlat);
    const w = allWaterStatements.find(item => sameCalendarMonth(item.sheet_name, m.sheet_name));
    const fW = w?.flats.find(item => item.flat === selectedFlat);
    const shortMonth = m.sheet_name.split(' ')[0].slice(0, 3);
    return {
      monthLabel: m.sheet_name,
      shortMonth,
      paid: fM?.paid || 0,
      actual: fM?.actual || 0,
      liters: fW?.liters || 0,
      waterCharge: fW?.water_charge || 0
    };
  });

  const totalPaidThisYear = monthlySeries.reduce((sum, item) => sum + item.paid, 0);
  const totalLitersThisYear = monthlySeries.reduce((sum, item) => sum + item.liters, 0);
  const monthsCount = Math.max(1, monthlySeries.length);
  const monthlyAveragePaid = Math.round(totalPaidThisYear / monthsCount);
  const monthlyAverageLiters = Math.round(totalLitersThisYear / monthsCount);

  const isPaid = (flatMaint?.pending || 0) <= 1;

  // Individual reading check: If this flat's closing reading is recorded and > opening reading, reading is NOT pending!
  const hasRecordedReading = Boolean(
    flatWater &&
    Number.isFinite(flatWater.closing_reading) &&
    flatWater.closing_reading > flatWater.opening_reading
  );
  const isReadingPending = !hasRecordedReading;

  // QR Code Zoom Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const UPI_ID = 'MSROCKCLIFFTIRTHAFLATOWNERSWELFAREASSOCIATIONS.eazypay@icici';

  // Internal password modal state (backed by props or internal)
  const [internalPwdOpen, setInternalPwdOpen] = useState(false);
  const showPwdModal = isPwdModalOpen || internalPwdOpen;
  const setShowPwdModal = (val: boolean) => {
    setInternalPwdOpen(val);
    if (setIsPwdModalOpen) setIsPwdModalOpen(val);
  };
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SVG Chart Scaling
  const maxPaid = Math.max(...monthlySeries.map(s => Math.max(s.paid, s.actual)), 3000);
  const maxLiters = Math.max(...monthlySeries.map(s => s.liters), 20000);

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
              Flat {selectedFlat} — Monthly Overview & Analytics
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-xl">
              Rockcliff 'B' Block Residents Association • Personal maintenance breakdown, consumption trends, and verified receipts.
            </p>
          </div>

          {/* Compact UPI Scan & Pay Card (Click/Touch to Expand) */}
          <div
            onClick={() => setShowQrModal(true)}
            className="bg-white/95 text-slate-900 p-2.5 sm:p-3 rounded-2xl shadow-xl border border-white/60 cursor-pointer hover:bg-white hover:scale-[1.02] active:scale-95 transition-all flex items-center space-x-3 shrink-0 group select-none"
            title="Touch or click to open full QR Code for payment"
          >
            <div className="relative">
              <img
                src={ROCKCLIFF_UPI_QR_DATA_URI}
                alt="Payment QR Code"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs"
              />
              <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow-xs text-[10px]">
                🔍
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 block w-fit">
                Scan & Pay
              </span>
              <span className="text-xs font-black text-slate-900 block mt-1 leading-tight">
                ICICI UPI QR
              </span>
              <span className="text-[11px] text-blue-600 font-bold block mt-0.5 group-hover:underline">
                Tap to Zoom ↗
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Month All-in-One Executive Card (No Duplicate Numbers) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Billing Summary</span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              {currentMaint?.title || selectedMonth}
            </h2>
          </div>

          <div className="flex items-center space-x-2.5">
            {isReadingPending ? (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1">
                <span>⏳</span>
                <span>Meter Reading Pending</span>
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                <span>✓</span>
                <span>Reading Verified ({formatLiters(flatWater?.liters || 0)})</span>
              </span>
            )}
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
              isPaid
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-rose-100 text-rose-800 border border-rose-200'
            }`}>
              {isPaid ? 'PAID & CLEARED' : 'PAYMENT DUE'}
            </span>
          </div>
        </div>

        {/* Warning only if reading is ACTUALLY unrecorded */}
        {isReadingPending && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2.5">
            <span className="text-base shrink-0">⏳</span>
            <div>
              <p className="font-bold">Meter Reading Not Recorded Yet</p>
              <p className="text-amber-800 mt-0.5">
                The closing meter reading for {selectedMonth} has not been recorded for your flat yet.
                Your provisional bill currently displays the fixed base mandatory maintenance ({formatINR(flatWater?.mandatory_maintenance || 1400)}) and will automatically update once your reading is entered.
              </p>
            </div>
          </div>
        )}

        {/* Consolidated Billing & Consumption Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Month Bill (Actual)</span>
            <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{formatINR(flatMaint?.actual)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ₹{(flatWater?.mandatory_maintenance || 1400).toLocaleString('en-IN')} base + {formatINR(flatWater?.water_charge || 0)} water
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
            <span className="text-xs text-emerald-700 font-medium">Amount Paid</span>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{formatINR(flatMaint?.paid)}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Payment Mode: {flatMaint?.mode || 'Due'}</p>
          </div>

          <div className={`p-4 rounded-2xl border ${((flatMaint?.pending || 0) > 1) ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-xs text-slate-500 font-medium">Balance Pending Due</span>
            <p className={`text-2xl font-black mt-1 font-mono ${(flatMaint?.pending || 0) > 1 ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatINR(flatMaint?.pending)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {(flatMaint?.previous_pending || 0) > 0 ? `Includes +${formatINR(flatMaint?.previous_pending)} prior arrears` : 'No prior arrears'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
            <span className="text-xs text-blue-700 font-medium">Water Consumed</span>
            <p className="text-2xl font-black text-blue-900 mt-1 font-mono">{formatLiters(flatWater?.liters || 0)}</p>
            <p className="text-[11px] text-blue-600 mt-0.5">
              Reading: {flatWater?.opening_reading?.toLocaleString()} → {flatWater?.closing_reading?.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Itemized Assessment Breakdown */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            Bill Composition Breakdown
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-slate-500 block">1. Fixed Mandatory Maintenance</span>
              <span className="text-base font-bold font-mono text-slate-900">{formatINR(flatWater?.mandatory_maintenance || 1400)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Security, staff salary, lift AMC, power</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-slate-500 block">2. Metered Water Charge</span>
              <span className="text-base font-bold font-mono text-slate-900">{formatINR(flatWater?.water_charge || 0)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {formatLiters(flatWater?.liters || 0)} @ ₹{flatWater?.water_charge && flatWater.liters > 0 ? (flatWater.water_charge / flatWater.liters).toFixed(4) : '0.00'}/L
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-slate-500 block">3. Previous Pending Arrears</span>
              <span className={`text-base font-bold font-mono ${(flatMaint?.previous_pending || 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatINR(flatMaint?.previous_pending || 0)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Carried forward from preceding closed cycle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Direct MoM and YoY Comparative Analytics (Requested in prompt) */}
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
                <span className="text-slate-600">Previous Month Assessment ({prevMonthLabel}):</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(prevFlatMaint.actual)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Current Month Assessment ({selectedMonth}):</span>
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

      {/* Comprehensive Annual Totals & Average Bar (Requested by user) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">This Year Total Paid</span>
          <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{formatINR(totalPaidThisYear)}</p>
          <span className="text-[11px] text-slate-400">Year {chartYear} Cumulative Collections</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Monthly Average Paid</span>
          <p className="text-2xl font-black text-blue-700 mt-1 font-mono">{formatINR(monthlyAveragePaid)}</p>
          <span className="text-[11px] text-slate-400">Average across {monthsCount} recorded months</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Total Liters Water Used</span>
          <p className="text-2xl font-black text-purple-900 mt-1 font-mono">{formatLiters(totalLitersThisYear)}</p>
          <span className="text-[11px] text-slate-400">Year {chartYear} Cumulative Consumption</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Monthly Average Used</span>
          <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">{formatLiters(monthlyAverageLiters)}</p>
          <span className="text-[11px] text-slate-400">Per-month average usage</span>
        </div>
      </div>

      {/* Interactive Monthly & Yearly Visual SVG Chart */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <span>📊</span>
              <span>Flat {selectedFlat} Monthly Spending & Water Consumption Trend</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical visual curve of maintenance paid (bars) vs water liters consumed (line)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Select Year:</span>
            <select
              value={chartYear}
              onChange={(e) => setChartYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold my-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded-sm bg-blue-600 inline-block"></span>
            <span className="text-slate-700">Amount Paid (₹)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-1 bg-purple-600 inline-block"></span>
            <span className="text-slate-700">Liters Used (L)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-0.5 border-t border-dashed border-slate-400 inline-block"></span>
            <span className="text-slate-500">Avg Monthly Liters ({formatLiters(monthlyAverageLiters)})</span>
          </div>
        </div>

        {/* Pure Responsive SVG Chart (Zero External Dependencies) */}
        {monthlySeries.length > 0 ? (
          <div className="overflow-x-auto pt-2">
            <svg viewBox="0 0 720 220" className="w-full h-56 select-none">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="30" x2="700" y2="30" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="80" x2="700" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="130" x2="700" y2="130" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="180" x2="700" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Average Liters Reference Line */}
              {(() => {
                const avgY = 180 - (monthlyAverageLiters / maxLiters) * 140;
                return (
                  <line x1="40" y1={avgY} x2="700" y2={avgY} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1.5" />
                );
              })()}

              {/* Bars and Line Points */}
              {monthlySeries.map((item, idx) => {
                const totalItems = monthlySeries.length;
                const slotWidth = (700 - 50) / Math.max(1, totalItems);
                const x = 50 + idx * slotWidth + slotWidth / 2;
                const barHeight = Math.max(4, (item.paid / maxPaid) * 140);
                const barY = 180 - barHeight;
                const lineY = 180 - (item.liters / maxLiters) * 140;

                return (
                  <g key={item.monthLabel} className="group">
                    {/* Bar for Paid */}
                    <rect
                      x={x - 14}
                      y={barY}
                      width="28"
                      height={barHeight}
                      rx="5"
                      fill="url(#barGrad)"
                      className="opacity-90 hover:opacity-100 transition-opacity"
                    />

                    {/* Month Label */}
                    <text x={x} y="200" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">
                      {item.shortMonth}
                    </text>

                    {/* Value above bar */}
                    <text x={x} y={barY - 5} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1e3a8a">
                      ₹{Math.round(item.paid)}
                    </text>

                    {/* Water Liters Point */}
                    <circle cx={x} cy={lineY} r="4.5" fill="#7e22ce" stroke="#fff" strokeWidth="2" />
                    <text x={x} y={lineY - 7} textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#7e22ce">
                      {Math.round(item.liters / 1000)}kL
                    </text>
                  </g>
                );
              })}

              {/* Water Consumption Polyline */}
              {(() => {
                const totalItems = monthlySeries.length;
                const slotWidth = (700 - 50) / Math.max(1, totalItems);
                const points = monthlySeries
                  .map((item, idx) => {
                    const x = 50 + idx * slotWidth + slotWidth / 2;
                    const lineY = 180 - (item.liters / maxLiters) * 140;
                    return `${x},${lineY}`;
                  })
                  .join(' ');
                return <polyline fill="none" stroke="#7e22ce" strokeWidth="2.5" points={points} />;
              })()}
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            No historical records found for year {chartYear}.
          </div>
        )}
      </div>

      {/* Flat Owner Change Password Modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-purple-100 text-purple-700 font-bold text-sm">🔐</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">Change Flat {selectedFlat} PIN</h3>
                  <p className="text-[11px] text-slate-500">Personal resident password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPwdModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPwdMsg(null);
                try {
                  changeFlatPassword(selectedFlat, newPassword);
                  setPwdMsg({ type: 'success', text: 'Password updated successfully! Use this new PIN on your next login.' });
                  setTimeout(() => {
                    setShowPwdModal(false);
                  }, 2000);
                } catch (err) {
                  setPwdMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update password.' });
                }
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New PIN / Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 4 characters (e.g. 1234)"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Your default PIN is your flat number ("{selectedFlat}") or "1234".
                </span>
              </div>

              {pwdMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expanded UPI Payment QR Code Modal (Fitted for Mobile Screens) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xs sm:max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center relative animate-in fade-in zoom-in-95">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-full hover:bg-slate-100 transition-all"
            >
              ✕
            </button>

            {/* Header info matching receipt / bank banner */}
            <div className="pb-3 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                Official Society UPI QR
              </span>
              <h3 className="text-sm font-black text-slate-900 mt-2 leading-snug uppercase">
                M/S. ROCKCLIFF TIRTHA FLAT OWNERS WELFARE ASSOCIATIONS
              </h3>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                Scan with any UPI App (GPay, PhonePe, Paytm, BHIM)
              </p>
            </div>

            {/* QR Code Image */}
            <div className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center shadow-inner">
              <img
                src={ROCKCLIFF_UPI_QR_DATA_URI}
                alt="Rockcliff ICICI Payment QR Code"
                className="w-full max-w-[240px] h-auto object-contain rounded-xl shadow-xs bg-white"
              />
            </div>

            {/* UPI ID & Copy Button */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-left">
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                Official UPI ID:
              </span>
              <p className="text-[11px] font-mono font-bold text-slate-900 break-all select-all mt-0.5">
                {UPI_ID}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(UPI_ID);
                  setCopiedUpi(true);
                  setTimeout(() => setCopiedUpi(false), 2500);
                }}
                className="w-full mt-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center space-x-1"
              >
                <span>{copiedUpi ? '✓ Copied to Clipboard!' : '📋 Copy UPI ID'}</span>
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Flat {selectedFlat} Maintenance</span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="font-bold text-slate-700 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
