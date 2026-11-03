import React, { useState } from 'react';
import { MaintenanceStatement, WaterStatement, FlatMaintenanceData } from '../types/apartment';
import { formatINR, formatLiters, formatINRExact } from '../services/calculations';
import { sameCalendarMonth } from '../services/storage';
import { Receipt, CheckCircle2, AlertCircle, Calendar, Droplet, ArrowRight, Printer } from './Icons';

interface ResidentHistoryProps {
  selectedFlat: number;
  allMaintenanceStatements: MaintenanceStatement[];
  allWaterStatements: WaterStatement[];
}

export const ResidentHistory: React.FC<ResidentHistoryProps> = ({
  selectedFlat,
  allMaintenanceStatements,
  allWaterStatements
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<{
    statementTitle: string;
    flatData: FlatMaintenanceData;
    baseMaintenance: number;
    waterCharge: number;
    consumedLiters?: number;
    openingReading?: number;
    closingReading?: number;
    literRate?: number;
  } | null>(null);

  // Helper to extract clean short month: e.g. "Oct 2026", "Nov 2026"
  const getShortMonthLabel = (sheetName: string): string => {
    const parts = sheetName.replace(' Water', '').trim().split(/\s+/);
    if (parts.length >= 2) {
      const month = parts[0].slice(0, 3);
      const year = parts[parts.length - 1];
      return `${month} ${year}`;
    }
    return sheetName;
  };

  // Collect history across all statements sorted chronologically (newest first)
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
            Complete statement history, water meter readings, verified payment receipts, and balance records (March 2024 to Present)
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block font-medium">Total Statements</span>
          <span className="text-xl font-black font-mono text-slate-900">{flatHistory.length} Months</span>
        </div>
      </div>

      {/* History Table (Desktop View) */}
      <div className="hidden sm:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Billing Month</th>
                <th className="py-3 px-4">Water Meter Readings (Old → New)</th>
                <th className="py-3 px-4 text-right">Consumed & Rate</th>
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
                const waterStatement = allWaterStatements?.find(w => sameCalendarMonth(w.sheet_name, statement.sheet_name));
                const waterFlat = waterStatement?.flats.find(f => f.flat === selectedFlat);
                const baseMaint = waterFlat?.mandatory_maintenance || 1400;
                const waterCost = waterFlat ? waterFlat.water_charge : Math.max(0, flat.actual - baseMaint);
                const shortLabel = getShortMonthLabel(statement.sheet_name);
                const hasReadings = waterFlat && Number.isFinite(waterFlat.closing_reading) && waterFlat.closing_reading > 0;

                return (
                  <tr key={statement.sheet_name} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Clean Short Month/Year Label */}
                    <td className="py-3.5 px-4 font-sans font-black text-slate-900 text-sm whitespace-nowrap">
                      <span>{shortLabel}</span>
                    </td>

                    {/* 2. Water Meter Readings (Old -> New) */}
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {hasReadings ? (
                        <div>
                          <span className="font-bold text-slate-900">
                            {waterFlat.opening_reading.toLocaleString()} → {waterFlat.closing_reading.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans italic text-[11px]">
                          {waterFlat?.opening_reading ? `${waterFlat.opening_reading.toLocaleString()} (Awaiting)` : '—'}
                        </span>
                      )}
                    </td>

                    {/* 3. Consumed Liters & Rate per Liter */}
                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                      {hasReadings ? (
                        <div>
                          <span className="font-black text-blue-900 block">
                            {formatLiters(waterFlat.liters)}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-sans">
                            @ ₹{waterStatement?.liter_per_charge ? waterStatement.liter_per_charge.toFixed(4) : '0.00'}/L
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans text-[11px]">—</span>
                      )}
                    </td>

                    {/* 4. Actual Bill */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-black text-slate-900 block font-mono text-xs">
                        {formatINR(flat.actual)}
                      </span>
                      {waterCost > 0 && (
                        <span className="text-[10px] text-slate-400 font-sans font-normal block">
                          ₹{baseMaint.toLocaleString('en-IN')} base + {formatINR(waterCost)} wtr
                        </span>
                      )}
                    </td>

                    {/* 5. Amount Paid */}
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                      {formatINR(flat.paid)}
                    </td>

                    {/* 6. Pending Balance */}
                    <td className={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${flat.pending > 1 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatINR(flat.pending)}
                    </td>

                    {/* 7. Status Badge */}
                    <td className="py-3.5 px-4 text-center font-sans whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {isPaid ? 'Paid' : 'Due'}
                      </span>
                    </td>

                    {/* 8. Channel */}
                    <td className="py-3.5 px-4 text-center font-sans text-slate-600 whitespace-nowrap">
                      {flat.mode || 'Due'}
                    </td>

                    {/* 9. Receipt Button */}
                    <td className="py-3.5 px-4 text-right font-sans whitespace-nowrap">
                      <button
                        onClick={() => setSelectedReceipt({
                          statementTitle: `${shortLabel} Maintenance`,
                          flatData: flat,
                          baseMaintenance: baseMaint,
                          waterCharge: waterCost,
                          consumedLiters: waterFlat?.liters,
                          openingReading: waterFlat?.opening_reading,
                          closingReading: waterFlat?.closing_reading,
                          literRate: waterStatement?.liter_per_charge
                        })}
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

      {/* Touch-Friendly Vertical List of Receipt Cards (Mobile View: sm:hidden) */}
      <div className="sm:hidden space-y-3">
        {flatHistory.map(({ statement, flat }) => {
          const isPaid = flat.pending <= 1;
          const waterStatement = allWaterStatements?.find(w => sameCalendarMonth(w.sheet_name, statement.sheet_name));
          const waterFlat = waterStatement?.flats.find(f => f.flat === selectedFlat);
          const baseMaint = waterFlat?.mandatory_maintenance || 1400;
          const waterCost = waterFlat ? waterFlat.water_charge : Math.max(0, flat.actual - baseMaint);
          const shortLabel = getShortMonthLabel(statement.sheet_name);
          const hasReadings = waterFlat && Number.isFinite(waterFlat.closing_reading) && waterFlat.closing_reading > 0;

          return (
            <div key={statement.sheet_name} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 text-sm">{shortLabel}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isPaid ? 'Paid' : 'Due'}
                </span>
              </div>

              {/* Water Meter Reading Info */}
              {hasReadings && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Meter:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {waterFlat.opening_reading.toLocaleString()} → {waterFlat.closing_reading.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 mt-1">
                    <span>Usage:</span>
                    <span className="font-mono font-bold text-blue-900">
                      {formatLiters(waterFlat.liters)} @ ₹{waterStatement?.liter_per_charge ? waterStatement.liter_per_charge.toFixed(3) : '0.00'}/L
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Actual Bill</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{formatINR(flat.actual)}</span>
                  {waterCost > 0 && (
                    <span className="text-[9px] text-slate-400 block">₹{baseMaint} base + {formatINR(waterCost)} wtr</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">Amount Paid</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">{formatINR(flat.paid)}</span>
                  <span className="text-[9px] text-slate-400 block">Mode: {flat.mode || 'N/A'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReceipt({
                  statementTitle: `${shortLabel} Maintenance`,
                  flatData: flat,
                  baseMaintenance: baseMaint,
                  waterCharge: waterCost,
                  consumedLiters: waterFlat?.liters,
                  openingReading: waterFlat?.opening_reading,
                  closingReading: waterFlat?.closing_reading,
                  literRate: waterStatement?.liter_per_charge
                })}
                className="w-full py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-2xs"
              >
                <Receipt size={14} />
                <span>View Official Receipt</span>
              </button>
            </div>
          );
        })}
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

            {/* Meter Reading Details Inside Official Receipt */}
            {selectedReceipt.openingReading !== undefined && selectedReceipt.closingReading !== undefined && (
              <div className="mt-3 p-3 bg-blue-50/50 border border-blue-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">Meter Reading & Consumption</span>
                <div className="flex justify-between font-mono text-slate-800">
                  <span>Reading (Opening → Closing):</span>
                  <span className="font-bold">{selectedReceipt.openingReading.toLocaleString()} → {selectedReceipt.closingReading.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-800">
                  <span>Consumed Volume:</span>
                  <span className="font-bold text-blue-900">{formatLiters(selectedReceipt.consumedLiters || 0)}</span>
                </div>
                {selectedReceipt.literRate && (
                  <div className="flex justify-between font-mono text-slate-600 text-[11px]">
                    <span>Rate Applied:</span>
                    <span>₹{selectedReceipt.literRate.toFixed(4)} per Liter</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Billing Breakdown</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Fixed Mandatory Maintenance:</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(selectedReceipt.baseMaintenance)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Water Consumption Charge:</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(selectedReceipt.waterCharge)}</span>
                </div>
                {selectedReceipt.flatData.previous_pending > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-600">
                    <span>Carried-Forward Arrears:</span>
                    <span className="font-mono font-bold">{formatINR(selectedReceipt.flatData.previous_pending)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t-2 border-slate-800 font-bold text-sm">
                  <span className="text-slate-900">Total Assessment Billed:</span>
                  <span className="font-mono text-slate-900">{formatINR(selectedReceipt.flatData.total_payable || selectedReceipt.flatData.actual)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-emerald-800 font-bold block">Amount Paid</span>
                  <span className="text-[10px] text-emerald-600">Channel: {selectedReceipt.flatData.mode || 'Cash'}</span>
                </div>
                <span className="text-xl font-black font-mono text-emerald-700">
                  {formatINR(selectedReceipt.flatData.paid)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-200/60">
                <span className="text-slate-600">Balance Pending:</span>
                <span className={`font-mono font-bold ${(selectedReceipt.flatData.pending || 0) > 1 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {formatINR(selectedReceipt.flatData.pending)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
              <span>Status: {selectedReceipt.flatData.pending <= 1 ? 'PAID & CLEARED' : 'PARTIAL / DUE'}</span>
              <span>Rockcliff 'B' Block Residents Association</span>
            </div>

            <div className="mt-6 flex justify-end space-x-3 no-print">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5"
              >
                <Printer size={14} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
