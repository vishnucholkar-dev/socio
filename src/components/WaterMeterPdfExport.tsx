import React, { useState, useEffect } from 'react';
import { WaterStatement } from '../types/apartment';
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

  // Add has-pdf-export class to body while modal is open to isolate print stream
  useEffect(() => {
    document.body.classList.add('has-pdf-export');
    return () => {
      document.body.classList.remove('has-pdf-export');
    };
  }, []);

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
    <div className="water-pdf-export-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex flex-col items-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Dynamic @page CSS rule strictly matching selected orientation and narrow margins */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 ${orientation};
                margin: 6mm 6mm !important;
              }
            }
          `
        }}
      />

      {/* Control Action Bar (Screen Only - Strictly Hidden in Print / PDF) */}
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
        className={`water-pdf-sheet bg-white shadow-2xl print:shadow-none p-6 sm:p-8 rounded-2xl print:rounded-none w-full print:w-full border border-slate-200 print:border-none ${
          orientation === 'landscape' ? 'max-w-5xl' : 'max-w-4xl'
        }`}
        style={{
          boxSizing: 'border-box'
        }}
      >
        {/* Association Formal Header */}
        <div className="text-center pb-2.5 border-b-2 border-slate-900 mb-2.5">
          <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-wide uppercase">
            ROCKCLIFF 'B' BLOCK RESIDENTS WELFARE ASSOCIATION
          </h1>
          <p className="text-[11px] font-bold text-slate-800 mt-0.5">
            WATER METER READING & CONSUMPTION LEDGER — {statement.sheet_name.toUpperCase()}
          </p>
          <p className="text-[9px] text-slate-500">
            32 Flats Individual Meter Billings & Utility Distribution Sheet
          </p>
        </div>

        {/* Compact Society Cost Parameters Breakdown */}
        <div className="grid grid-cols-6 gap-2 text-center text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl mb-2.5">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">Tanker Bill (A)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.tanker_bill)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">Electricity (B)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.electricity_bill)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">Common (-C)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.common_utilization)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">Net Power (D)</p>
            <p className="text-xs font-black text-blue-700 font-mono mt-0.5">{formatINR(statement.net_electricity)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">Total Liters (F)</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatLiters(statement.total_water_consumption_liters)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">Rate / Liter (G)</p>
            <p className="text-xs font-black text-purple-700 font-mono mt-0.5">₹{statement.liter_per_charge.toFixed(4)}/L</p>
          </div>
        </div>

        {/* 32-Flats Billing Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10px] font-mono border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[9px] tracking-wider border-b-2 border-slate-900">
                <th className="py-1 px-1.5 text-center border-r border-slate-300">Flat</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Opening (Y)</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Closing (X)</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Liters (X-Y)</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Avg L/D</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Water Cost</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Base Maint</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Month Bill</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">Pending</th>
                <th className="py-1 px-1.5 text-right">Total Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {flats.map((flat) => (
                <tr key={flat.flat} className="hover:bg-slate-50">
                  <td className="py-0.5 px-1.5 text-center font-bold font-sans text-slate-900 border-r border-slate-200">{flat.flat}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-600 border-r border-slate-200">{flat.opening_reading.toLocaleString()}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-900 font-bold border-r border-slate-200">{flat.closing_reading.toLocaleString()}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-purple-900 border-r border-slate-200">{flat.liters.toLocaleString()}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-500 border-r border-slate-200">{flat.avg_per_day}</td>
                  <td className="py-0.5 px-1.5 text-right font-semibold text-slate-800 border-r border-slate-200">{formatINR(flat.water_charge)}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-600 border-r border-slate-200">{formatINR(flat.mandatory_maintenance)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-slate-900 border-r border-slate-200">{formatINR(flat.actual_amount)}</td>
                  <td className={`py-0.5 px-1.5 text-right font-semibold border-r border-slate-200 ${flat.pending_amount > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {formatINR(flat.pending_amount)}
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-black text-slate-900">{formatINR(flat.total_payable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black border-t-2 border-b-2 border-slate-900 text-[10px]">
                <td className="py-1 px-1.5 text-center font-sans border-r border-slate-300">TOTALS</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">—</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">—</td>
                <td className="py-1 px-1.5 text-right text-purple-900 border-r border-slate-300">{totalLiters.toLocaleString()} L</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">—</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">{formatINR(totalWaterCost)}</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">{formatINR(totalBaseMaint)}</td>
                <td className="py-1 px-1.5 text-right text-blue-900 border-r border-slate-300">{formatINR(totalMonthBill)}</td>
                <td className={`py-1 px-1.5 text-right border-r border-slate-300 ${totalPending > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{formatINR(totalPending)}</td>
                <td className="py-1 px-1.5 text-right text-slate-900">{formatINR(totalPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Committee Signature Blocks */}
        <div className="mt-4 pt-4 border-t border-slate-400 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="h-6"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-900">President / Convenor</p>
            <p className="text-[9px] text-slate-500">Rockcliff 'B' Block</p>
          </div>
          <div>
            <div className="h-6"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-900">Secretary</p>
            <p className="text-[9px] text-slate-500">Rockcliff 'B' Block</p>
          </div>
          <div>
            <div className="h-6"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-900">Treasurer</p>
            <p className="text-[9px] text-slate-500">Rockcliff 'B' Block</p>
          </div>
        </div>

        {/* Verification Footer Note */}
        <div className="mt-3 pt-1 border-t border-slate-200 text-center text-[8.5px] text-slate-400">
          Generated from Rockcliff Management Records • Formula: G = (A + D) / F • Verified & Certified
        </div>
      </div>
    </div>
  );
};
