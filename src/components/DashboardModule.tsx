import React, { useState } from 'react';
import { ApartmentData, UserRole } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, formatLiters, computeDynamicStatementBalances } from '../services/calculations';
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
  const dynamicMaint = computeDynamicStatementBalances(currentMaint);

  // Current Month Specific Metrics
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

  // Find flats with pending dues for current month
  const pendingFlats = (currentMaint?.flats || [])
    .filter(f => (f.pending || 0) > 1)
    .sort((a, b) => a.flat - b.flat);

  const pendingFlatNumbersString = pendingFlats.map(f => f.flat).join(', ');
  const highDueFlats = [...pendingFlats].sort((a, b) => b.pending - a.pending);

  // Parse current active cycle year
  const activeYearMatch = selectedMonth.match(/202[4-6]/);
  const initialYear = activeYearMatch ? Number(activeYearMatch[0]) : 2026;

  // Dedicated Year Selection State for Admin Financial Trend Chart
  const [trendYear, setTrendYear] = useState<number>(initialYear);

  // Strict Calendar Month Mapping (Month 1 to 12)
  const monthOrder = [
    { num: 1, key: 'jan', short: 'Jan', full: 'January' },
    { num: 2, key: 'feb', short: 'Feb', full: 'February' },
    { num: 3, key: 'mar', short: 'Mar', full: 'March' },
    { num: 4, key: 'apr', short: 'Apr', full: 'April' },
    { num: 5, key: 'may', short: 'May', full: 'May' },
    { num: 6, key: 'jun', short: 'Jun', full: 'June' },
    { num: 7, key: 'jul', short: 'Jul', full: 'July' },
    { num: 8, key: 'aug', short: 'Aug', full: 'August' },
    { num: 9, key: 'sep', short: 'Sep', full: 'September' },
    { num: 10, key: 'oct', short: 'Oct', full: 'October' },
    { num: 11, key: 'nov', short: 'Nov', full: 'November' },
    { num: 12, key: 'dec', short: 'Dec', full: 'December' }
  ];

  const yearStatements = data.maintenance_statements.filter(m => m.sheet_name.includes(String(trendYear)));

  // Build sorted data strictly by month number (1 to 12) for the selected year
  const yearMonthlyData = monthOrder.map(mInfo => {
    const matchedMaint = yearStatements.find(s => {
      const lower = s.sheet_name.toLowerCase();
      return lower.includes(mInfo.key) || lower.includes(mInfo.full.toLowerCase());
    });

    if (!matchedMaint) return null;

    const col = matchedMaint.flats.reduce((s, f) => s + (f.paid || 0), 0);
    const exp = matchedMaint.expenses.reduce((s, e) => s + (e.status !== 'Billed' ? (e.amount || 0) : 0), 0);
    const billed = matchedMaint.flats.reduce((s, f) => s + (f.actual || 0), 0);

    return {
      monthNum: mInfo.num,
      shortLabel: mInfo.short,
      fullSheetName: matchedMaint.sheet_name,
      collected: col,
      expenses: exp,
      billed: billed,
      margin: col - exp
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.monthNum - b.monthNum);

  const maxValInYear = Math.max(...yearMonthlyData.map(d => Math.max(d.collected, d.expenses)), 95000);
  const totalYearCollections = yearMonthlyData.reduce((s, d) => s + d.collected, 0);
  const totalYearExpenses = yearMonthlyData.reduce((s, d) => s + d.expenses, 0);
  const totalYearMargin = totalYearCollections - totalYearExpenses;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
      {/* =========================================================================
          FIRST PLACE BANNER: PENDING MAINTENANCE FLAT NUMBERS OR ALL PAID
          ========================================================================= */}
      {pendingFlats.length > 0 ? (
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-rose-50 via-amber-50/70 to-rose-50 border border-rose-300/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-3 min-w-0">
            <span className="p-2 sm:p-2.5 rounded-xl bg-rose-100 text-rose-700 text-base sm:text-lg font-bold shrink-0 shadow-2xs">
              ⚠️
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-full border border-rose-200">
                  Pending Maintenance ({selectedMonth})
                </span>
                <span className="text-[11px] font-bold text-rose-700 font-mono">
                  {pendingFlats.length} Flats • Total {formatINR(totalPending)}
                </span>
              </div>
              <p className="text-sm sm:text-base font-black text-slate-900 mt-1 truncate">
                Pending Flats: <span className="font-mono text-rose-600 underline decoration-rose-300 font-extrabold">{pendingFlatNumbersString}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden xs:block">
                These flats have outstanding balances for {selectedMonth}. Click to collect or send payment reminders.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('collections')}
            className="px-4 py-2 sm:py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 shrink-0 transition-all active:scale-95"
          >
            <span>Collect Dues</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-300 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <span className="p-2 sm:p-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-base sm:text-lg font-bold shrink-0 shadow-2xs">
              ✓
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  {selectedMonth} Status
                </span>
                <span className="text-[11px] font-bold text-emerald-800">100% Collected</span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-emerald-950 mt-0.5">
                All 32 Flats Paid & Cleared — No Pending Maintenance!
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('collections')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs hidden sm:flex items-center space-x-1 shrink-0"
          >
            <span>View All</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Welcome & Command Center Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 text-blue-100">
                Society Executive Intelligence
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                Active Cycle: {selectedMonth}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
              Rockcliff 'B' Block Residents Association
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-xl hidden sm:block">
              Central management dashboard • 32 flats, meter-based water distribution, and reconciled society accounting.
            </p>
          </div>

          <div className="hidden sm:flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('water-meter')}
              className="px-3.5 py-2 bg-white text-blue-900 rounded-xl text-xs font-bold shadow-md hover:bg-blue-50 transition-all flex items-center space-x-1.5"
            >
              <Droplet size={14} className="text-blue-600" />
              <span>Water Meter Readings</span>
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className="px-3.5 py-2 bg-blue-600/80 hover:bg-blue-600 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
            >
              <Receipt size={14} />
              <span>32 Flats Collections</span>
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-white/20"
            >
              <DollarSign size={14} />
              <span>Expenses & Cash</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cumulative Lifetime Society Intelligence Grid */}
      <div className="w-full">
        <div className="flex items-center space-x-1.5 mb-2.5 px-0.5">
          <span className="p-1 rounded-md bg-purple-100 text-purple-700 font-bold text-xs">🏛️</span>
          <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
            Cumulative Lifetime Intelligence ({data.maintenance_statements.length} Months Tracked)
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
          <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase tracking-wider truncate block">Lifetime Collections</span>
            <p className="text-sm xs:text-base sm:text-xl lg:text-2xl font-black text-emerald-700 mt-1 font-mono tracking-tight truncate block">{formatINR(lifetimeCollections)}</p>
            <span className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate block">Total cleared owner payments</span>
          </div>

          <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] font-bold text-rose-800 uppercase tracking-wider truncate block">Lifetime Outflows</span>
            <p className="text-sm xs:text-base sm:text-xl lg:text-2xl font-black text-rose-600 mt-1 font-mono tracking-tight truncate block">{formatINR(lifetimeExpenses)}</p>
            <span className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate block">Total maintenance spent</span>
          </div>

          <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-800 uppercase tracking-wider truncate block">Lifetime Water Pumped</span>
            <p className="text-sm xs:text-base sm:text-xl lg:text-2xl font-black text-blue-900 mt-1 font-mono tracking-tight truncate block">{formatLiters(lifetimeWaterPumped)}</p>
            <span className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate block">32 flats consumption</span>
          </div>

          <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] font-bold text-purple-800 uppercase tracking-wider truncate block">Current Liquid Funds</span>
            <p className="text-sm xs:text-base sm:text-xl lg:text-2xl font-black text-purple-700 mt-1 font-mono tracking-tight truncate block">{formatINR(dynamicMaint.totalLiquidFunds)}</p>
            <span className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate block">Cash: {formatINR(dynamicMaint.closingCash)} | Bank: {formatINR(dynamicMaint.closingBank)}</span>
          </div>
        </div>
      </div>

      {/* Selected Month Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        {/* Month Target Billed */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase truncate block">{selectedMonth} Target</span>
          <p className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 mt-1 font-mono tracking-tight truncate block">{formatINR(totalBilled)}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate block">32 flats bill assessment</p>
        </div>

        {/* Collections */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 uppercase truncate block">{selectedMonth} Collected</span>
          <p className="text-base sm:text-xl lg:text-2xl font-black text-emerald-600 mt-1 font-mono tracking-tight truncate block">{formatINR(totalCollected)}</p>
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500 mt-1">
            <span className="font-bold text-emerald-700">{collectionPercent}%</span>
            <span className="text-slate-400">{currentMaint?.flats.filter(f => f.pending <= 1).length} / 32 Paid</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${collectionPercent}%` }}></div>
          </div>
        </div>

        {/* Water Consumption */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-semibold text-blue-600 uppercase truncate block">{selectedMonth} Water</span>
          <p className="text-base sm:text-xl lg:text-2xl font-black text-blue-600 mt-1 font-mono tracking-tight truncate block">
            {formatLiters(currentWater?.total_water_consumption_liters)}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate block">
            Rate: ₹{currentWater?.liter_per_charge?.toFixed(2) || '0.00'}/L
          </p>
        </div>

        {/* Pending Dues */}
        <div className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-xs flex flex-col justify-between min-w-0 overflow-hidden ${totalPending > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <span className="text-[10px] sm:text-xs font-semibold text-rose-600 uppercase truncate block">{selectedMonth} Pending</span>
          <p className="text-base sm:text-xl lg:text-2xl font-black text-rose-600 mt-1 font-mono tracking-tight truncate block">{formatINR(totalPending)}</p>
          <p className="text-[10px] sm:text-xs text-rose-700 mt-0.5 font-bold truncate block">
            {highDueFlats.length} flats requiring follow-up
          </p>
        </div>
      </div>

      {/* Two Column Grid: Financial Trend Curve & Delinquent Follow-up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Redesigned Multi-Month Financial Trend Chart with Year Selector & Calendar Month Sorting */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Financial Performance Curve</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">Collections vs Expenses Trend</h3>
              </div>

              {/* Year Selector Dropdown for this Chart Only */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Year:</span>
                <select
                  value={trendYear}
                  onChange={(e) => setTrendYear(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={2026}>Year 2026</option>
                  <option value={2025}>Year 2025</option>
                  <option value={2024}>Year 2024</option>
                </select>
              </div>
            </div>

            {/* Legend & Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold my-3">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
                  <span>Collections (₹)</span>
                </span>
                <span className="flex items-center space-x-1 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
                  <span>Paid Expenses (₹)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Months sorted strictly Jan → Dec
              </span>
            </div>

            {/* Responsive SVG Chart with strictly Calendar Month Order */}
            {yearMonthlyData.length > 0 ? (
              <div className="overflow-x-auto pt-1">
                <svg viewBox="0 0 540 190" className="w-full h-48 select-none">
                  {/* Grid Lines */}
                  <line x1="30" y1="20" x2="520" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="65" x2="520" y2="65" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="110" x2="520" y2="110" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="150" x2="520" y2="150" stroke="#cbd5e1" strokeWidth="1.5" />

                  {yearMonthlyData.map((d, i) => {
                    const totalSlots = yearMonthlyData.length;
                    const step = (520 - 40) / Math.max(1, totalSlots);
                    const x = 40 + i * step + step / 2;
                    const colH = Math.max(3, (d.collected / maxValInYear) * 125);
                    const expH = Math.max(3, (d.expenses / maxValInYear) * 125);

                    return (
                      <g key={d.monthNum} className="group">
                        {/* Collected Bar */}
                        <rect
                          x={x - 13}
                          y={150 - colH}
                          width="11"
                          height={colH}
                          rx="3"
                          fill="#10b981"
                          className="hover:opacity-90 transition-opacity"
                        />
                        {/* Expense Bar */}
                        <rect
                          x={x + 2}
                          y={150 - expH}
                          width="11"
                          height={expH}
                          rx="3"
                          fill="#f43f5e"
                          className="hover:opacity-90 transition-opacity"
                        />
                        {/* Month label in calendar order */}
                        <text x={x} y="168" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#475569">
                          {d.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No statement records found for Year {trendYear}.
              </div>
            )}
          </div>

          {/* Annual Performance Summary Strip for Selected Year */}
          {yearMonthlyData.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Year Collections</span>
                <span className="font-mono font-bold text-emerald-700 text-xs">{formatINR(totalYearCollections)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Year Expenses</span>
                <span className="font-mono font-bold text-rose-600 text-xs">{formatINR(totalYearExpenses)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Net Margin</span>
                <span className={`font-mono font-bold text-xs ${totalYearMargin >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                  {totalYearMargin >= 0 ? '+' : ''}{formatINR(totalYearMargin)}
                </span>
              </div>
            </div>
          )}
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
