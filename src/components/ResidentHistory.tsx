import React, { useState } from 'react';
import { MaintenanceStatement, FlatMaintenanceData, PaymentReceipt } from '../types/apartment';
import { formatINR, formatINRExact } from '../services/calculations';
import { Receipt, Calendar, Printer, CheckCircle2, AlertCircle } from './Icons';

interface ResidentHistoryProps {
  selectedFlat: number;
  allMaintenanceStatements: MaintenanceStatement[];
}

export const ResidentHistory: React.FC<ResidentHistoryProps> = ({
  selectedFlat,
  allMaintenanceStatements
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<{
    statementTitle: string;
    flatData: FlatMaintenanceData;
    receipt?: PaymentReceipt;
  } | null>(null);

  // Collect history across all statements sorted chronologically
  const flatHistory = allMaintenanceStatements
    .map(statement => {
      const flat = statement.flats.find(f => f.flat === selectedFlat);
      return {
        statement,
        flat
      };
    })
    .filter((entry): entry is { statement: MaintenanceStatement; flat: FlatMaintenanceData } => Boolean(entry.flat));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Resident Archives
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-2">
            Flat {selectedFlat} — Lifetime Billing & Payment Records
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete statement history, verified payment receipts, and balance records (March 2024 to Present)
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block font-medium">Total Statements</span>
          <span className="text-xl font-black font-mono text-slate-900">{flatHistory.length} Months</span>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Billing Month</th>
                <th className="py-3 px-4 text-right">Actual Bill</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-right">Pending Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Channel</th>
                <th className="py-3 px-4 text-right">Receipts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {flatHistory.map(({ statement, flat }) => {
                const isPaid = flat.pending <= 1;
                return (
                  <tr key={statement.sheet_name} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-900">
                      {statement.title || statement.sheet_name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                      {formatINR(flat.actual)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                      {formatINR(flat.paid)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${flat.pending > 1 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatINR(flat.pending)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {isPaid ? 'Paid' : 'Due'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans text-slate-600">
                      {flat.mode || 'Due'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => setSelectedReceipt({ statementTitle: statement.title || statement.sheet_name, flatData: flat })}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                      >
                        <Receipt size={12} />
                        <span>View Receipt</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Maintenance Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 relative my-8">
            <div className="text-center pb-4 border-b-2 border-slate-800">
              <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600">
                Official Maintenance Receipt
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                ROCKCLIFF 'B' BLOCK RESIDENTS ASSOCIATION
              </h2>
              <p className="text-[11px] text-slate-500">
                Hyderabad • Flat Maintenance & Utility Record
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs py-3 border-b border-slate-200">
              <div>
                <p className="text-slate-400">Flat Number:</p>
                <p className="text-base font-black text-slate-900">Flat {selectedReceipt.flatData.flat}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">Statement Period:</p>
                <p className="font-bold text-slate-900">{selectedReceipt.statementTitle}</p>
              </div>
              <div>
                <p className="text-slate-400">Receipt ID:</p>
                <p className="font-mono font-bold text-slate-700">RC-B-{selectedReceipt.flatData.flat}-{Date.now().toString().slice(-4)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">Date Issued:</p>
                <p className="font-medium text-slate-700">{selectedReceipt.flatData.payment_date || new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Billing Breakdown</h4>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50 font-bold">
                    <td className="py-2 px-2 text-slate-900">Total Month Assessment</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-900">{formatINR(selectedReceipt.flatData.actual)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-emerald-700 font-semibold">Amount Paid</td>
                    <td className="py-2 text-right font-mono font-bold text-emerald-700">{formatINR(selectedReceipt.flatData.paid)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-800 font-black">
                    <td className="py-2.5 text-slate-900">Balance Pending Due</td>
                    <td className={`py-2.5 text-right font-mono ${selectedReceipt.flatData.pending > 1 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatINR(selectedReceipt.flatData.pending)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {selectedReceipt.flatData.receipts && selectedReceipt.flatData.receipts.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Receipt History ({selectedReceipt.flatData.receipts.length})</p>
                  <div className="space-y-1">
                    {selectedReceipt.flatData.receipts.map((r, i) => (
                      <div key={r.id || i} className="flex justify-between text-[11px] text-slate-600 font-mono">
                        <span>{r.date} • {r.mode}</span>
                        <span className="font-bold text-emerald-700">{formatINR(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Payment Channel: </span>
                <span className="font-bold text-slate-800">{selectedReceipt.flatData.mode || 'Pending'}</span>
              </div>
              <div className={`px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider ${
                selectedReceipt.flatData.pending <= 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {selectedReceipt.flatData.pending <= 1 ? 'PAID & CLEARED' : 'PAYMENT DUE'}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 text-center text-[11px] text-slate-500">
              <div><p className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Resident / Payee</p></div>
              <div><p className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Treasurer / Association</p></div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-200 no-print">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
