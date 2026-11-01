import React, { useState } from 'react';
import { WaterStatement, FlatWaterData } from '../types/apartment';
import { formatINR, formatINRExact, formatLiters } from '../services/calculations';

interface WaterMeterPdfExportProps {
  statement: WaterStatement;
  onClose: () => void;
}

export const WaterMeterPdfExport: React.FC<WaterMeterPdfExportProps> = ({
  statement,
  onClose
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Compute totals across all flats
  const flats = [...(statement.flats || [])].sort((a, b) => a.flat - b.flat);
  const totalLiters = flats.reduce((sum, f) => sum + f.liters, 0);
  const totalWaterCost = flats.reduce((sum, f) => sum + f.water_charge, 0);
  const totalBaseMaint = flats.reduce((sum, f) => sum + f.mandatory_maintenance, 0);
  const totalMonthBill = flats.reduce((sum, f) => sum + f.actual_amount, 0);
  const totalPending = flats.reduce((sum, f) => sum + f.pending_amount, 0);
  const totalPayable = flats.reduce((sum, f) => sum + f.total_payable, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex flex-col items-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Control Action Bar (Screen Only - Hidden in Print / PDF) */}
      <div className="no-print w-full max-w-4xl bg-white p-4 rounded-2xl border border-slate-200 shadow-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="p-2 bg-purple-100 text-purple-700 rounded-xl font-bold">📄</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">A4 PDF Export Preview</h3>
            <p className="text-xs text-slate-500">Narrow margins • Strictly essential billing data only</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                orientation === 'portrait' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                orientation === 'landscape' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Landscape
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <span>⬇️ Save / Export as PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Target A4 Printable Sheet Document */}
      <div
        className={`bg-white shadow-2xl print:shadow-none p-6 sm:p-8 rounded-2xl print:rounded-none w-full print:w-full border border-slate-200 print:border-none ${
          orientation === 'landscape' ? 'max-w-5xl' : 'max-w-4xl'
        }`}
        style={{
          boxSizing: 'border-box'
        }}
      >
        {/* Association Formal Header */}
        <div className="text-center pb-3 border-b-2 border-slate-900 mb-3">
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-wide uppercase">
            ROCKCLIFF 'B' BLOCK RESIDENTS WELFARE ASSOCIATION
          </h1>
          <p className="text-xs font-bold text-slate-700 mt-0.5">
            WATER METER READING & CONSUMPTION LEDGER — {statement.sheet_name.toUpperCase()}
          </p>
          <p className="text-[10px] text-slate-500">
            32 Flats Individual Meter Billings & Utility Distribution Sheet
          </p>
        </div>

        {/* Compact Society Cost Parameters Breakdown */}
        <div className="grid grid-cols-6 gap-2 text-center text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-3">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Tanker Bill (A)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.tanker_bill)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Electricity (B)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.electricity_bill)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Common (-C)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.common_utilization)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Net Power (D)</p>
            <p className="text-xs font-black text-blue-700 font-mono mt-0.5">{formatINR(statement.net_electricity)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Total Liters (F)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatLiters(statement.total_water_consumption_liters)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Rate / Liter (G)</p>
            <p className="text-xs font-black text-purple-700 font-mono mt-0.5">₹{statement.liter_per_charge.toFixed(4)}/L</p>
          </div>
        </div>

        {/* 32-Flats Billing Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[9px] tracking-wider border-y-2 border-slate-900">
                <th className="py-1 px-1.5 text-center">Flat</th>
                <th className="py-1 px-1.5 text-right">Opening (Y)</th>
                <th className="py-1 px-1.5 text-right">Closing (X)</th>
                <th className="py-1 px-1.5 text-right">Liters (X-Y)</th>
                <th className="py-1 px-1.5 text-right">Avg L/Day</th>
                <th className="py-1 px-1.5 text-right">Water Cost</th>
                <th className="py-1 px-1.5 text-right">Base Maint</th>
                <th className="py-1 px-1.5 text-right">Month Bill</th>
                <th className="py-1 px-1.5 text-right">Pending</th>
                <th className="py-1 px-1.5 text-right">Total Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {flats.map((flat) => (
                <tr key={flat.flat} className="hover:bg-slate-50">
                  <td className="py-1 px-1.5 text-center font-bold font-sans text-slate-900">{flat.flat}</td>
                  <td className="py-1 px-1.5 text-right text-slate-600">{flat.opening_reading.toLocaleString()}</td>
                  <td className="py-1 px-1.5 text-right text-slate-900 font-bold">{flat.closing_reading.toLocaleString()}</td>
                  <td className="py-1 px-1.5 text-right font-bold text-purple-900">{flat.liters.toLocaleString()}</td>
                  <td className="py-1 px-1.5 text-right text-slate-500">{flat.avg_per_day}</td>
                  <td className="py-1 px-1.5 text-right font-semibold text-slate-800">{formatINR(flat.water_charge)}</td>
                  <td className="py-1 px-1.5 text-right text-slate-600">{formatINR(flat.mandatory_maintenance)}</td>
                  <td className="py-1 px-1.5 text-right font-bold text-slate-900">{formatINR(flat.actual_amount)}</td>
                  <td className={`py-1 px-1.5 text-right font-semibold ${flat.pending_amount > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {formatINR(flat.pending_amount)}
                  </td>
                  <td className="py-1 px-1.5 text-right font-black text-slate-900">{formatINR(flat.total_payable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black border-t-2 border-b-2 border-slate-900 text-[10px]">
                <td className="py-1.5 px-1.5 text-center font-sans">TOTALS</td>
                <td className="py-1.5 px-1.5 text-right">—</td>
                <td className="py-1.5 px-1.5 text-right">—</td>
                <td className="py-1.5 px-1.5 text-right text-purple-900">{totalLiters.toLocaleString()} L</td>
                <td className="py-1.5 px-1.5 text-right">—</td>
                <td className="py-1.5 px-1.5 text-right">{formatINR(totalWaterCost)}</td>
                <td className="py-1.5 px-1.5 text-right">{formatINR(totalBaseMaint)}</td>
                <td className="py-1.5 px-1.5 text-right text-blue-900">{formatINR(totalMonthBill)}</td>
                <td className={`py-1.5 px-1.5 text-right ${totalPending > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{formatINR(totalPending)}</td>
                <td className="py-1.5 px-1.5 text-right text-slate-900">{formatINR(totalPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Committee Signature Blocks */}
        <div className="mt-6 pt-6 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="h-8"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-800">President / Convenor</p>
            <p className="text-[9px] text-slate-400">Rockcliff 'B' Block</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-800">Secretary</p>
            <p className="text-[9px] text-slate-400">Rockcliff 'B' Block</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-800">Treasurer</p>
            <p className="text-[9px] text-slate-400">Rockcliff 'B' Block</p>
          </div>
        </div>

        {/* Verification Footer Note */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-400">
          Generated from Rockcliff Management Records • Formula: G = (A + D) / F • Verified & Certified
        </div>
      </div>
    </div>
  );
};
