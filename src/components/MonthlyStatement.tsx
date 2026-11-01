import React from 'react';
import { MaintenanceStatement, WaterStatement } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, formatLiters } from '../services/calculations';
import { Printer, Calendar, Wallet, CreditCard, AlertCircle, CheckCircle2, TrendingUp } from './Icons';

interface MonthlyStatementProps {
  selectedMonth: string;
  allMaintenanceStatements: MaintenanceStatement[];
  allWaterStatements: WaterStatement[];
  onSelectMonth: (month: string) => void;
}

export const MonthlyStatement: React.FC<MonthlyStatementProps> = ({
  selectedMonth,
  allMaintenanceStatements,
  allWaterStatements,
  onSelectMonth
}) => {
  const maintenanceMatches = allMaintenanceStatements.filter(m => sameCalendarMonth(m.sheet_name, selectedMonth));
  const waterMatches = allWaterStatements.filter(w => sameCalendarMonth(w.sheet_name, selectedMonth));
  const currentMaint = maintenanceMatches.length === 1 ? maintenanceMatches[0] : undefined;
  const currentWater = waterMatches.length === 1 ? waterMatches[0] : undefined;

  if (!currentMaint || (waterMatches.length !== 0 && waterMatches.length !== 1)) {
    const message = maintenanceMatches.length > 1
      ? 'Duplicate maintenance statements exist for this calendar month; reconcile them before using this report.'
      : !maintenanceMatches.length
        ? 'No maintenance statement exists for this calendar month.'
        : 'Duplicate water statements exist for this calendar month; reconcile them before using this report.';
    return (
      <div role="alert" className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
        <h3 className="text-lg font-bold text-slate-800">Statement Unavailable</h3>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  const totalFlatPaid = currentMaint.flats.reduce((acc, f) => acc + (f.paid || 0), 0);
  const totalFlatPending = currentMaint.flats.reduce((acc, f) => acc + (f.pending || 0), 0);
  const cashExpenses = currentMaint.expenses.filter(e => (e.type || 'Cash') === 'Cash');
  const bankExpenses = currentMaint.expenses.filter(e => e.type === 'Bank');
  const totalExpenses = currentMaint.expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
            <Calendar size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {currentMaint.title || currentMaint.sheet_name}
            </h2>
            <p className="text-xs text-slate-500">Official Association Statement of Inflows, Outflows & Bank Balances</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <select
            value={currentMaint.sheet_name}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="bg-slate-100 text-xs font-bold text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allMaintenanceStatements.map(m => (
              <option key={m.sheet_name} value={m.sheet_name}>{m.sheet_name}</option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Official Printable Statement Sheet */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Printable Header */}
        <div className="text-center pb-4 border-b-2 border-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">
            Monthly Association Financial Statement
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1 uppercase tracking-tight">
            Rockcliff 'B' Block Residents Welfare Association
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintenance Statement for the Month of <strong>{currentMaint.title || currentMaint.sheet_name}</strong>
          </p>
        </div>

        {/* 3 Key Balances Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-center p-3">
            <span className="text-xs font-semibold text-slate-500 uppercase">Cash in Hand (IA-EA)</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{formatINR(currentMaint.cash_balance)}</p>
          </div>
          <div className="text-center p-3 border-y sm:border-y-0 sm:border-x border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Bank Balance (IB-EB)</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{formatINR(currentMaint.bank_balance)}</p>
          </div>
          <div className="text-center p-3">
            <span className="text-xs font-semibold text-purple-600 uppercase">Total Liquid Funds</span>
            <p className="text-2xl font-black text-purple-700 mt-1">{formatINR(currentMaint.total_balance)}</p>
          </div>
        </div>

        {/* Side-by-Side: Inflows vs Outflows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Inflows (IA + IB) */}
          <div className="border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="font-bold text-slate-900 text-sm">Receipts & Inflows (IA + IB)</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700">
                {formatINR(totalFlatPaid)}
              </span>
            </div>

            <div className="mt-3 space-y-4">
              {/* Cash Inflows */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                  <Wallet size={13} className="text-emerald-600" />
                  <span>Cash Inflows (IA)</span>
                </p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {currentMaint.cash_opening > 0 && (
                      <tr>
                        <td className="py-1.5 text-slate-600">Opening Cash Balance</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(currentMaint.cash_opening)}</td>
                      </tr>
                    )}
                    {currentMaint.inflows.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-600">{item.description}</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50/50 font-bold">
                      <td className="py-1.5 px-2 text-emerald-900">Total Cash Received (IA)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-900">
                        {formatINR(currentMaint.cash_total_in || totalFlatPaid)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bank Inflows */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                  <CreditCard size={13} className="text-blue-600" />
                  <span>Bank Inflows (IB)</span>
                </p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {currentMaint.bank_opening > 0 && (
                      <tr>
                        <td className="py-1.5 text-slate-600">Opening Bank Balance</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(currentMaint.bank_opening)}</td>
                      </tr>
                    )}
                    <tr className="bg-blue-50/50 font-bold">
                      <td className="py-1.5 px-2 text-blue-900">Total Bank Inflows (IB)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-blue-900">
                        {formatINR(currentMaint.bank_total_in || currentMaint.bank_opening)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Outflows (EA + EB) */}
          <div className="border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <h3 className="font-bold text-slate-900 text-sm">Expenses & Outflows (EA + EB)</h3>
              </div>
              <span className="text-xs font-mono font-bold text-rose-600">
                {formatINR(totalExpenses)}
              </span>
            </div>

            <div className="mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="py-1.5 text-left">Description</th>
                    <th className="py-1.5 text-center">Mode</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentMaint.expenses.map((exp, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 text-slate-700 font-medium">{exp.description}</td>
                      <td className="py-1.5 text-center">
                        <span className="text-[10px] font-bold text-slate-400">
                          {exp.type || 'Cash'}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono font-semibold text-slate-900">
                        {formatINR(exp.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-rose-50/50 font-black border-t-2 border-rose-200">
                    <td colSpan={2} className="py-2 px-2 text-rose-900 uppercase text-[11px]">
                      Total Monthly Expenses (EA+EB)
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-rose-900 text-sm">
                      {formatINR(totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Delinquent Flats / Outstanding Dues */}
        {currentMaint.dues_list && currentMaint.dues_list.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <AlertCircle size={15} className="text-amber-600" />
              <span>Outstanding Dues Carried Forward</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {currentMaint.dues_list.map((d, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs flex justify-between">
                  <span className="font-semibold text-slate-800">{d.item}</span>
                  <span className="font-bold text-rose-600 font-mono">{formatINR(d.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Association Signatures */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-3 text-center text-xs text-slate-500">
          <div>
            <div className="h-10"></div>
            <p className="border-t border-slate-300 pt-1 font-semibold text-slate-800">Prepared by (Treasurer)</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="border-t border-slate-300 pt-1 font-semibold text-slate-800">Verified by (Secretary)</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="border-t border-slate-300 pt-1 font-semibold text-slate-800">Approved by (President)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
