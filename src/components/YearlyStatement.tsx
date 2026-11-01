import React, { useState } from 'react';
import { MaintenanceStatement, WaterStatement } from '../types/apartment';
import { computeYearSummary, formatINR, formatLiters } from '../services/calculations';
import { TrendingUp, Printer, Calendar, Droplet, DollarSign, CheckCircle2, AlertCircle } from './Icons';

interface YearlyStatementProps {
  maintenanceStatements: MaintenanceStatement[];
  waterStatements: WaterStatement[];
}

export const YearlyStatement: React.FC<YearlyStatementProps> = ({
  maintenanceStatements,
  waterStatements
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const years = [2026, 2025, 2024];

  const summary = computeYearSummary(selectedYear, maintenanceStatements, waterStatements);

  // Month-by-month breakdown for the selected year
  const mInYear = maintenanceStatements.filter(m => m.sheet_name.includes(selectedYear.toString()));
  const wInYear = waterStatements.filter(w => w.sheet_name.includes(selectedYear.toString()));

  return (
    <div className="space-y-6">
      {/* Year Selector & Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <span className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
            <TrendingUp size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Annual Audit & Financial Performance Summary</h2>
            <p className="text-xs text-slate-500">Year-over-year collections, expenses, water procurement and surplus analysis</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {years.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedYear === yr
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Annual KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Billed ({selectedYear})</span>
          <p className="text-2xl font-black text-slate-900 mt-2">{formatINR(summary.totalBilled)}</p>
          <p className="text-xs text-slate-400 mt-1">{summary.monthsCount} recorded months</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase">Total Collected</span>
          <p className="text-2xl font-black text-emerald-600 mt-2">{formatINR(summary.totalCollected)}</p>
          <p className="text-xs text-emerald-700 font-semibold mt-1">{summary.collectionRate}% Collection Rate</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 uppercase">Total Expenses</span>
          <p className="text-2xl font-black text-rose-600 mt-2">{formatINR(summary.totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">Water tankers, staff, electricity</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-purple-600 uppercase">Net Annual Surplus</span>
          <p className={`text-2xl font-black mt-2 ${summary.netSurplus >= 0 ? 'text-purple-700' : 'text-rose-600'}`}>
            {formatINR(summary.netSurplus)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{summary.netSurplus >= 0 ? 'Surplus retained in bank' : 'Deficit drawn from reserves'}</p>
        </div>
      </div>

      {/* Water Annual Statistics */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-3 py-1 rounded-full text-blue-100">
              Annual Water Procurement Audit ({selectedYear})
            </span>
            <h3 className="text-2xl font-black mt-2">
              {formatLiters(summary.totalWaterLiters)} Consumed
            </h3>
            <p className="text-xs text-blue-200 mt-1">
              Average monthly consumption: <strong>{formatLiters(summary.avgLitersPerMonth)} / month</strong> across 32 flats
            </p>
          </div>

          <div className="flex items-center space-x-3 text-center">
            <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl min-w-[120px]">
              <p className="text-xs text-blue-200">Total Tanker Bills</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {formatINR(wInYear.reduce((acc, w) => acc + (w.tanker_bill || 0), 0))}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl min-w-[120px]">
              <p className="text-xs text-blue-200">Water Pumping Power</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {formatINR(wInYear.reduce((acc, w) => acc + (w.net_electricity || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Annual Expense Categories Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-4">Expense Categories Breakdown ({selectedYear})</h3>
        <div className="space-y-3">
          {summary.categories.map((c, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800">{c.category}</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(c.amount)} ({c.percentage}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${c.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Month-by-Month Statement Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">Monthly Accounting Ledger for Year {selectedYear}</h3>
          <span className="text-xs text-slate-500 font-semibold">{mInYear.length} Months Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Statement Month</th>
                <th className="py-3 px-4 text-right">Collections (Inflow)</th>
                <th className="py-3 px-4 text-right">Expenses (Outflow)</th>
                <th className="py-3 px-4 text-right">Net Margin</th>
                <th className="py-3 px-4 text-right">Closing Cash</th>
                <th className="py-3 px-4 text-right">Closing Bank</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Total Liquid Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {mInYear.map((m, idx) => {
                const coll = m.flats.reduce((a, f) => a + (f.paid || 0), 0);
                const exp = m.expenses.reduce((a, e) => a + (e.amount || 0), 0);
                const net = coll - exp;

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{m.sheet_name}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-semibold">{formatINR(coll)}</td>
                    <td className="py-3 px-4 text-right text-rose-600 font-semibold">{formatINR(exp)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatINR(net)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatINR(m.cash_balance)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatINR(m.bank_balance)}</td>
                    <td className="py-3 px-4 text-right font-black text-purple-900 bg-slate-50/50">
                      {formatINR(m.total_balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
