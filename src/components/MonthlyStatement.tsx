import React, { useState } from 'react';
import { MaintenanceStatement, WaterStatement } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, formatLiters, computeDynamicStatementBalances, sortFlatsBySequence } from '../services/calculations';
import { Printer, Calendar, Wallet, CreditCard, AlertCircle, CheckCircle2, TrendingUp } from './Icons';
import { MonthlyStatementPdfExport } from './MonthlyStatementPdfExport';

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
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [duesFilter, setDuesFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [sortSequence, setSortSequence] = useState<'riser' | 'ascending'>('riser');
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

  const dynamic = computeDynamicStatementBalances(currentMaint);
  const totalFlatPaid = currentMaint.flats.reduce((acc, f) => acc + (f.paid || 0), 0);
  const totalFlatPending = currentMaint.flats.reduce((acc, f) => acc + (f.pending || 0), 0);
  
  // Dynamic breakdown of actual cash & bank collections and inflows direct from records
  const cashFlatCollections = dynamic.cashFlatCollections;
  const bankFlatCollections = dynamic.bankFlatCollections;
  const otherCashInflows = dynamic.otherCashInflows;
  const otherBankInflows = dynamic.otherBankInflows;

  const totalCashReceived = dynamic.totalCashReceived;
  const totalBankInflows = dynamic.totalBankInflows;
  const totalReceiptsAndInflows = dynamic.totalReceiptsAndInflows;

  // Separate Paid disbursements from Billed unpaid liabilities
  const paidExpenses = currentMaint.expenses.filter(e => e.status !== 'Billed');
  const billedExpenses = currentMaint.expenses.filter(e => e.status === 'Billed');
  const cashExpenses = paidExpenses.filter(e => (e.type || 'Cash') === 'Cash');
  const bankExpenses = paidExpenses.filter(e => e.type === 'Bank');
  const totalExpenses = dynamic.totalPaidExpenses;
  const totalBilledLiabilities = dynamic.billedExpenses;

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
            type="button"
            onClick={() => setShowPdfExport(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
          >
            <span>📄</span>
            <span>PDF Export</span>
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
            <p className="text-2xl font-black text-emerald-600 mt-1">{formatINR(dynamic.closingCash)}</p>
          </div>
          <div className="text-center p-3 border-y sm:border-y-0 sm:border-x border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Bank Balance (IB-EB)</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{formatINR(dynamic.closingBank)}</p>
          </div>
          <div className="text-center p-3">
            <span className="text-xs font-semibold text-purple-600 uppercase">Total Liquid Funds</span>
            <p className="text-2xl font-black text-purple-700 mt-1">{formatINR(dynamic.totalLiquidFunds)}</p>
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
                {formatINR(totalReceiptsAndInflows)}
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
                    <tr>
                      <td className="py-1.5 text-slate-600">Opening Cash Balance</td>
                      <td className="py-1.5 text-right font-mono font-semibold">{formatINR(currentMaint.cash_opening ?? 0)}</td>
                    </tr>
                    {cashFlatCollections > 0 && (
                      <tr>
                        <td className="py-1.5 text-slate-600">Flat Maintenance Collections (Cash)</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-emerald-700">{formatINR(cashFlatCollections)}</td>
                      </tr>
                    )}
                    {currentMaint.inflows.filter(i => (i.type || 'Cash') === 'Cash').map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-600">
                          {item.description}
                          {item.category && <span className="text-[10px] text-slate-400 block">{item.category}{item.date ? ` • ${item.date}` : ''}</span>}
                        </td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50/50 font-bold">
                      <td className="py-1.5 px-2 text-emerald-900">Total Cash Received (IA)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-900">
                        {formatINR(totalCashReceived)}
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
                    <tr>
                      <td className="py-1.5 text-slate-600">Opening Bank Balance</td>
                      <td className="py-1.5 text-right font-mono font-semibold">{formatINR(currentMaint.bank_opening ?? 0)}</td>
                    </tr>
                    {bankFlatCollections > 0 && (
                      <tr>
                        <td className="py-1.5 text-slate-600">Flat Maintenance Collections (Bank / Online)</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-blue-700">{formatINR(bankFlatCollections)}</td>
                      </tr>
                    )}
                    {currentMaint.inflows.filter(i => i.type === 'Bank').map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-600">
                          {item.description}
                          {item.category && <span className="text-[10px] text-slate-400 block">{item.category}{item.date ? ` • ${item.date}` : ''}</span>}
                        </td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50/50 font-bold">
                      <td className="py-1.5 px-2 text-blue-900">Total Bank Inflows (IB)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-blue-900">
                        {formatINR(totalBankInflows)}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                      <td className="py-1.5 px-2 text-slate-800">Total Available Bank Funds (Opening + IB)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-900">
                        {formatINR((currentMaint.bank_opening ?? 0) + totalBankInflows)}
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
                  {paidExpenses.map((exp, idx) => (
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
                  {paidExpenses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 text-center text-slate-400">No paid outflows recorded</td>
                    </tr>
                  )}
                  <tr className="bg-rose-50/50 font-black border-t-2 border-rose-200">
                    <td colSpan={2} className="py-2 px-2 text-rose-900 uppercase text-[11px]">
                      Total Paid Outflows (EA+EB)
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-rose-900 text-sm">
                      {formatINR(totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Accrued / Billed Unpaid Invoices */}
              {billedExpenses.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-200 bg-amber-50/60 p-3 rounded-xl">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center space-x-1">
                      <span>📄</span>
                      <span>Accrued / Billed Unpaid Liabilities</span>
                    </span>
                    <span className="font-mono font-bold text-amber-900 text-xs">{formatINR(totalBilledLiabilities)}</span>
                  </div>
                  <div className="space-y-1">
                    {billedExpenses.map((be, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-amber-800">
                        <span>• {be.description}</span>
                        <span className="font-mono font-bold">{formatINR(be.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Redesigned Monthly Assessment & 32 Flats Collection Status */}
        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <span>📋</span>
                <span>Monthly Assessment & Flat Collection Status</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Summary of 32 flats maintenance assessments, amount collected, and pending dues for this billing cycle.
              </p>
            </div>

            {/* Filter buttons & Sorting toggle */}
            <div className="flex flex-wrap items-center gap-2 no-print">
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDuesFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${duesFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All (32)
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('due')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${duesFilter === 'due' ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'}`}
                >
                  Due Only ({currentMaint.flats.filter(f => f.pending > 1).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('paid')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${duesFilter === 'paid' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'}`}
                >
                  Paid Only ({currentMaint.flats.filter(f => f.pending <= 1).length})
                </button>
              </div>

              {/* Sequence Toggle Pill (Riser vs Ascending) */}
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSortSequence('riser')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    sortSequence === 'riser' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Plumbing shaft vertical sequence: 101, 201, 301, 401..."
                >
                  🏢 Vertical Riser
                </button>
                <button
                  type="button"
                  onClick={() => setSortSequence('ascending')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    sortSequence === 'ascending' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Sequential flat number order: 101, 102, 103..."
                >
                  🔢 Flat Ascending
                </button>
              </div>
            </div>
          </div>

          {/* Collection Metrics Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Billed</span>
              <p className="text-base font-black text-slate-900 font-mono mt-0.5">
                {formatINR(currentMaint.flats.reduce((sum, f) => sum + (f.actual || 0), 0))}
              </p>
              <span className="text-[10px] text-slate-400">32 Flats Combined</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Collected Amount</span>
              <p className="text-base font-black text-emerald-700 font-mono mt-0.5">
                {formatINR(totalFlatPaid)}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold">
                {currentMaint.flats.filter(f => f.pending <= 1).length} Flats Settled
              </span>
            </div>

            <div className={`p-3 rounded-2xl border shadow-2xs ${totalFlatPending > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Pending Dues</span>
              <p className={`text-base font-black font-mono mt-0.5 ${totalFlatPending > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {formatINR(totalFlatPending)}
              </p>
              <span className="text-[10px] text-rose-600 font-bold">
                {currentMaint.flats.filter(f => f.pending > 1).length} Flats Unpaid
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Collection Rate</span>
              <p className="text-base font-black text-blue-700 font-mono mt-0.5">
                {Math.round((totalFlatPaid / Math.max(1, totalFlatPaid + totalFlatPending)) * 100)}%
              </p>
              <span className="text-[10px] text-blue-600 font-bold">Recovery Status</span>
            </div>
          </div>

          {/* 32 Flats Cards Grid (Direct 4-Column Grid: Row 1 = 101,102,103,104 in Ascending OR 101,201,301,401 in Riser) */}
          {(() => {
            const sortedAndFiltered = sortFlatsBySequence(
              [...currentMaint.flats].filter(f => duesFilter === 'all' ? true : duesFilter === 'due' ? f.pending > 1 : f.pending <= 1),
              sortSequence
            );

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {sortedAndFiltered.map((f) => {
                  const isPaid = f.pending <= 1;
                  const roundedBill = Math.round(f.actual || 0);
                  const roundedPaid = Math.round(f.paid || 0);
                  const roundedPending = Math.round(f.pending || 0);

                  return (
                    <div
                      key={f.flat}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                        isPaid
                          ? 'bg-white border-emerald-200/80 shadow-2xs'
                          : 'bg-white border-rose-300 shadow-2xs'
                      }`}
                    >
                      <div>
                        <span className="font-black text-slate-900 block">Flat {f.flat}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Bill: {formatINR(roundedBill)}</span>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-bold block text-xs ${isPaid ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {isPaid ? formatINR(roundedPaid) : formatINR(roundedPending)}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isPaid ? 'Paid' : 'Due'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

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

      {showPdfExport && (
        <MonthlyStatementPdfExport
          statement={currentMaint}
          waterStatement={currentWater}
          sequence={sortSequence}
          onClose={() => setShowPdfExport(false)}
        />
      )}
    </div>
  );
};
