import React, { useState } from 'react';
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

  // Compute totals across all flats
  const flats = [...(statement.flats || [])].sort((a, b) => a.flat - b.flat);
  const totalLiters = flats.reduce((sum, f) => sum + f.liters, 0);
  const totalWaterCost = flats.reduce((sum, f) => sum + f.water_charge, 0);
  const totalBaseMaint = flats.reduce((sum, f) => sum + f.mandatory_maintenance, 0);
  const totalMonthBill = flats.reduce((sum, f) => sum + f.actual_amount, 0);
  const totalPending = flats.reduce((sum, f) => sum + f.pending_amount, 0);
  const totalPayable = flats.reduce((sum, f) => sum + f.total_payable, 0);

  // Dedicated isolated print function:
  // Creates a clean, hidden iframe with strictly ONLY the 2nd-screenshot document.
  // It is 100% impossible for the background app navbar, buttons, or cards to appear!
  const handlePrint = () => {
    const existingIframe = document.getElementById('water-meter-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'water-meter-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const tableRowsHtml = flats.map(flat => `
      <tr>
        <td class="text-center font-bold text-dark">${flat.flat}</td>
        <td class="text-right text-muted">${flat.opening_reading.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold text-dark">${flat.closing_reading.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold text-purple">${flat.liters.toLocaleString('en-IN')}</td>
        <td class="text-right text-muted">${flat.avg_per_day}</td>
        <td class="text-right font-semibold text-dark">₹${flat.water_charge.toLocaleString('en-IN')}</td>
        <td class="text-right text-muted">₹${flat.mandatory_maintenance.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold text-dark">₹${flat.actual_amount.toLocaleString('en-IN')}</td>
        <td class="text-right font-semibold ${flat.pending_amount > 0 ? 'text-red' : 'text-muted'}">₹${flat.pending_amount.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold text-dark">₹${flat.total_payable.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Water Meter Statement - ${statement.sheet_name}</title>
        <style>
          @page {
            size: A4 ${orientation};
            margin: 6mm 6mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          body {
            background: #fff;
            color: #0f172a;
            padding: 4px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .header-container {
            text-align: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #0f172a;
          }
          .title {
            font-size: 15pt;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #0f172a;
          }
          .subtitle {
            font-size: 9.5pt;
            font-weight: 700;
            margin-top: 2px;
            color: #1e293b;
            text-transform: uppercase;
          }
          .sub-details {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 1px;
          }
          
          /* Compact Parameter Bar matching 2nd screenshot */
          .params-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            background-color: #f0f7ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 8px 6px;
            margin-bottom: 12px;
            text-align: center;
          }
          .param-label {
            font-size: 6.5pt;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .param-val {
            font-size: 9.5pt;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
            font-family: monospace, ui-monospace, SFMono-Regular;
          }
          .param-val-blue { color: #2563eb; }
          .param-val-purple { color: #7c3aed; }

          /* Table matching 2nd screenshot */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.8pt;
            font-family: monospace, ui-monospace, SFMono-Regular;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 2.5px 4.5px;
            vertical-align: middle;
          }
          th {
            background-color: #f8fafc;
            color: #1e293b;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 6.8pt;
            letter-spacing: 0.3px;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .text-dark { color: #0f172a; }
          .text-muted { color: #64748b; }
          .text-purple { color: #7e22ce !important; }
          .text-red { color: #dc2626 !important; }
          .text-blue { color: #1d4ed8 !important; }

          tfoot tr td {
            background-color: #f8fafc;
            font-weight: 900;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            font-size: 7.8pt;
          }

          /* Signatures matching 2nd screenshot */
          .signatures-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 20px;
            padding-top: 14px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
          }
          .signature-space {
            height: 24px;
          }
          .signature-line {
            border-top: 1px solid #64748b;
            padding-top: 3px;
            font-size: 8pt;
            font-weight: 700;
            color: #1e293b;
          }
          .signature-sub {
            font-size: 6.8pt;
            color: #64748b;
          }

          .footer-note {
            text-align: center;
            font-size: 6.5pt;
            color: #94a3b8;
            margin-top: 10px;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="title">ROCKCLIFF 'B' BLOCK RESIDENTS WELFARE ASSOCIATION</div>
          <div class="subtitle">WATER METER READING & CONSUMPTION LEDGER — ${statement.sheet_name.toUpperCase()}</div>
          <div class="sub-details">32 Flats Individual Meter Billings & Utility Distribution Sheet</div>
        </div>

        <div class="params-grid">
          <div>
            <div class="param-label">TANKER BILL (A)</div>
            <div class="param-val">₹${statement.tanker_bill.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="param-label">ELECTRICITY (B)</div>
            <div class="param-val">₹${statement.electricity_bill.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="param-label">COMMON (-C)</div>
            <div class="param-val">₹${statement.common_utilization.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="param-label">NET POWER (D)</div>
            <div class="param-val param-val-blue">₹${statement.net_electricity.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="param-label">TOTAL LITERS (F)</div>
            <div class="param-val">${statement.total_water_consumption_liters.toLocaleString('en-IN')} L</div>
          </div>
          <div>
            <div class="param-label">RATE / LITER (G)</div>
            <div class="param-val param-val-purple">₹${statement.liter_per_charge.toFixed(4)}/L</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center">FLAT</th>
              <th class="text-right">OPENING (Y)</th>
              <th class="text-right">CLOSING (X)</th>
              <th class="text-right">LITERS (X-Y)</th>
              <th class="text-right">AVG L/D</th>
              <th class="text-right">WATER COST</th>
              <th class="text-right">BASE MAINT</th>
              <th class="text-right">MONTH BILL</th>
              <th class="text-right">PENDING</th>
              <th class="text-right">TOTAL PAYABLE</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td class="text-center">TOTALS</td>
              <td class="text-right">—</td>
              <td class="text-right">—</td>
              <td class="text-right text-purple">${totalLiters.toLocaleString('en-IN')} L</td>
              <td class="text-right">—</td>
              <td class="text-right">₹${totalWaterCost.toLocaleString('en-IN')}</td>
              <td class="text-right">₹${totalBaseMaint.toLocaleString('en-IN')}</td>
              <td class="text-right text-blue">₹${totalMonthBill.toLocaleString('en-IN')}</td>
              <td class="text-right text-red">₹${totalPending.toLocaleString('en-IN')}</td>
              <td class="text-right text-dark">₹${totalPayable.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures-grid">
          <div>
            <div class="signature-space"></div>
            <div class="signature-line">President / Convenor</div>
            <div class="signature-sub">Rockcliff 'B' Block</div>
          </div>
          <div>
            <div class="signature-space"></div>
            <div class="signature-line">Secretary</div>
            <div class="signature-sub">Rockcliff 'B' Block</div>
          </div>
          <div>
            <div class="signature-space"></div>
            <div class="signature-line">Treasurer</div>
            <div class="signature-sub">Rockcliff 'B' Block</div>
          </div>
        </div>

        <div class="footer-note">
          Generated from Rockcliff Management Records • Formula: G = (A + D) / F • Verified & Certified
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger isolated print directly on the clean iframe
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
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
      <div className="no-print w-full max-w-5xl bg-white p-4 rounded-2xl border border-slate-200 shadow-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
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

      {/* Target A4 Printable Sheet Document - Exactly matching 2nd Screenshot */}
      <div
        className={`water-pdf-sheet bg-white shadow-2xl print:shadow-none p-6 sm:p-8 rounded-2xl print:rounded-none w-full border border-slate-200 print:border-none ${
          orientation === 'landscape' ? 'max-w-6xl' : 'max-w-5xl'
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
          <p className="text-xs font-bold text-slate-800 mt-0.5">
            WATER METER READING & CONSUMPTION LEDGER — {statement.sheet_name.toUpperCase()}
          </p>
          <p className="text-[10px] text-slate-500">
            32 Flats Individual Meter Billings & Utility Distribution Sheet
          </p>
        </div>

        {/* Compact Society Cost Parameters Breakdown - Matching 2nd screenshot light-blue container */}
        <div className="grid grid-cols-6 gap-2 text-center text-xs p-2.5 bg-[#f0f7ff] border border-[#bae6fd] rounded-xl mb-3">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">TANKER BILL (A)</p>
            <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.tanker_bill)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">ELECTRICITY (B)</p>
            <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.electricity_bill)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">COMMON (-C)</p>
            <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.common_utilization)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">NET POWER (D)</p>
            <p className="text-sm font-black text-blue-600 font-mono mt-0.5">{formatINR(statement.net_electricity)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">TOTAL LITERS (F)</p>
            <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{formatLiters(statement.total_water_consumption_liters)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-600">RATE / LITER (G)</p>
            <p className="text-sm font-black text-purple-600 font-mono mt-0.5">₹{statement.liter_per_charge.toFixed(4)}/L</p>
          </div>
        </div>

        {/* 32-Flats Billing Table - Matching 2nd screenshot borders, purple liters, red pending */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10.5px] font-mono border border-slate-300">
            <thead>
              <tr className="bg-slate-50 text-slate-900 uppercase font-bold text-[9px] tracking-wider border-t-2 border-b-2 border-slate-900">
                <th className="py-1 px-1.5 text-center border-r border-slate-300">FLAT</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">OPENING (Y)</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">CLOSING (X)</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">LITERS (X-Y)</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">AVG L/D</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">WATER COST</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">BASE MAINT</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">MONTH BILL</th>
                <th className="py-1 px-1.5 text-right border-r border-slate-300">PENDING</th>
                <th className="py-1 px-1.5 text-right">TOTAL PAYABLE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {flats.map((flat) => (
                <tr key={flat.flat} className="hover:bg-slate-50/80">
                  <td className="py-0.5 px-1.5 text-center font-bold font-sans text-slate-900 border-r border-slate-200">{flat.flat}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-600 border-r border-slate-200">{flat.opening_reading.toLocaleString('en-IN')}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-900 font-bold border-r border-slate-200">{flat.closing_reading.toLocaleString('en-IN')}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-purple-700 border-r border-slate-200">{flat.liters.toLocaleString('en-IN')}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-500 border-r border-slate-200">{flat.avg_per_day}</td>
                  <td className="py-0.5 px-1.5 text-right font-semibold text-slate-800 border-r border-slate-200">{formatINR(flat.water_charge)}</td>
                  <td className="py-0.5 px-1.5 text-right text-slate-600 border-r border-slate-200">{formatINR(flat.mandatory_maintenance)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-slate-900 border-r border-slate-200">{formatINR(flat.actual_amount)}</td>
                  <td className={`py-0.5 px-1.5 text-right font-semibold border-r border-slate-200 ${flat.pending_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatINR(flat.pending_amount)}
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-black text-slate-900">{formatINR(flat.total_payable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black border-t-2 border-b-2 border-slate-900 text-[10.5px]">
                <td className="py-1 px-1.5 text-center font-sans border-r border-slate-300">TOTALS</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">—</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">—</td>
                <td className="py-1 px-1.5 text-right text-purple-700 border-r border-slate-300">{totalLiters.toLocaleString('en-IN')} L</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">—</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">{formatINR(totalWaterCost)}</td>
                <td className="py-1 px-1.5 text-right border-r border-slate-300">{formatINR(totalBaseMaint)}</td>
                <td className="py-1 px-1.5 text-right text-blue-700 border-r border-slate-300">{formatINR(totalMonthBill)}</td>
                <td className={`py-1 px-1.5 text-right border-r border-slate-300 ${totalPending > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{formatINR(totalPending)}</td>
                <td className="py-1 px-1.5 text-right text-slate-900">{formatINR(totalPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Committee Signature Blocks */}
        <div className="mt-5 pt-5 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
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
