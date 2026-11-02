import React, { useState } from 'react';
import { MaintenanceStatement, WaterStatement } from '../types/apartment';
import { formatINR } from '../services/calculations';

interface MonthlyStatementPdfExportProps {
  statement: MaintenanceStatement;
  waterStatement?: WaterStatement;
  onClose: () => void;
}

export const MonthlyStatementPdfExport: React.FC<MonthlyStatementPdfExportProps> = ({
  statement,
  waterStatement,
  onClose
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Compute metrics
  const totalBilled = statement.flats.reduce((sum, f) => sum + (f.actual || 0), 0);
  const totalCollected = statement.flats.reduce((sum, f) => sum + (f.paid || 0), 0);
  const totalPending = statement.flats.reduce((sum, f) => sum + (f.pending || 0), 0);
  const totalInflows = statement.inflows.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = statement.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const paidCount = statement.flats.filter(f => f.pending <= 1).length;
  const dueCount = statement.flats.length - paidCount;

  const handlePrint = () => {
    const existingIframe = document.getElementById('monthly-statement-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'monthly-statement-print-iframe';
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

    const expensesRows = statement.expenses.map(e => `
      <tr>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; font-weight: 500;">${e.description}</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-size: 7pt;">${e.type || 'Cash'}</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700; color: #dc2626; font-family: monospace;">₹${e.amount.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const inflowsRows = statement.inflows.map(i => `
      <tr>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; font-weight: 500;">${i.description}</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-size: 7pt;">${i.type || 'Cash'}</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700; color: #16a34a; font-family: monospace;">₹${i.amount.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const sortedFlats = [...statement.flats].sort((a, b) => a.flat - b.flat);
    const flatStatusGrid = sortedFlats.map(f => {
      const isPaid = f.pending <= 1;
      return `
        <div style="border: 1px solid ${isPaid ? '#bbf7d0' : '#fecdd3'}; background-color: ${isPaid ? '#f0fdf4' : '#fff1f2'}; padding: 4px 6px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 7pt;">
          <span style="font-weight: 700; color: #0f172a;">Flat ${f.flat}</span>
          <span style="font-family: monospace; font-weight: 800; color: ${isPaid ? '#16a34a' : '#e11d48'};">
            ${isPaid ? '₹' + f.paid.toLocaleString('en-IN') + ' (Paid)' : '₹' + f.pending.toLocaleString('en-IN') + ' (Due)'}
          </span>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Monthly Statement - ${statement.sheet_name}</title>
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
          .header-box {
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 10px;
          }
          .title {
            font-size: 15pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
          }

          /* Balances Summary Grid */
          .balances-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 6px;
            margin-bottom: 10px;
            text-align: center;
          }
          .b-label { font-size: 6.5pt; font-weight: 800; color: #475569; text-transform: uppercase; }
          .b-val { font-size: 9pt; font-weight: 900; font-family: monospace; margin-top: 2px; }

          /* Collections Bar */
          .collections-bar {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 6px 10px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7.5pt;
          }

          /* Ledger Split Tables */
          .ledger-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.5pt;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 6.8pt;
            padding: 3px 6px;
            border: 1px solid #cbd5e1;
          }

          .flats-container {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px;
            margin-bottom: 10px;
            background: #fafafa;
          }
          .flats-header {
            font-size: 7.5pt;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
          }
          .flats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
          }

          /* Signatures */
          .signatures-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #64748b;
            padding-top: 3px;
            font-size: 7.5pt;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="title">ROCKCLIFF 'B' BLOCK RESIDENTS WELFARE ASSOCIATION</div>
          <div class="subtitle">FINANCIAL STATEMENT OF INFLOWS, OUTFLOWS & BANK BALANCES — ${statement.sheet_name.toUpperCase()}</div>
          <div class="sub-details">Official Society Monthly Financial Review • 32 Flats</div>
        </div>

        <div class="balances-grid">
          <div>
            <div class="b-label">Opening Cash</div>
            <div class="b-val">₹${statement.cash_opening.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="b-label">Opening Bank</div>
            <div class="b-val">₹${statement.bank_opening.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="b-label">Cash Balance</div>
            <div class="b-val" style="color: ${statement.cash_balance < 0 ? '#e11d48' : '#16a34a'};">₹${statement.cash_balance.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="b-label">Bank Balance</div>
            <div class="b-val" style="color: #2563eb;">₹${statement.bank_balance.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="b-label">Total Liquid Funds</div>
            <div class="b-val" style="color: #7c3aed;">₹${statement.total_balance.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div class="collections-bar">
          <div>
            <strong>Monthly Assessment Billed:</strong> ₹${totalBilled.toLocaleString('en-IN')} (32 Flats)
          </div>
          <div>
            <strong style="color: #16a34a;">Collected:</strong> ₹${totalCollected.toLocaleString('en-IN')} (${paidCount} Paid)
          </div>
          <div>
            <strong style="color: ${totalPending > 0 ? '#e11d48' : '#64748b'};">Pending Dues:</strong> ₹${totalPending.toLocaleString('en-IN')} (${dueCount} Due)
          </div>
        </div>

        <div class="ledger-grid">
          <!-- Inflows & Collections -->
          <div>
            <table style="border: 1px solid #cbd5e1;">
              <thead>
                <tr>
                  <th colspan="3" style="text-align: left; background: #ecfdf5; color: #065f46;">Receipts & Inflows</th>
                </tr>
                <tr>
                  <th style="text-align: left;">Source</th>
                  <th style="text-align: center;">Type</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 3px 6px; border: 1px solid #cbd5e1; font-weight: 500;">Flat Maintenance Collections</td>
                  <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-size: 7pt;">Mixed</td>
                  <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700; color: #16a34a; font-family: monospace;">₹${totalCollected.toLocaleString('en-IN')}</td>
                </tr>
                ${inflowsRows}
              </tbody>
              <tfoot>
                <tr style="background: #f8fafc; font-weight: 800;">
                  <td colspan="2" style="padding: 3px 6px; border: 1px solid #cbd5e1;">Total Inflows</td>
                  <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #16a34a;">₹${(totalCollected + totalInflows).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Expenses -->
          <div>
            <table style="border: 1px solid #cbd5e1;">
              <thead>
                <tr>
                  <th colspan="3" style="text-align: left; background: #fff1f2; color: #9f1239;">Expenses & Disbursements</th>
                </tr>
                <tr>
                  <th style="text-align: left;">Category / Purpose</th>
                  <th style="text-align: center;">Mode</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expensesRows.length ? expensesRows : '<tr><td colspan="3" style="padding: 6px; text-align: center; color: #94a3b8;">No expenses recorded</td></tr>'}
              </tbody>
              <tfoot>
                <tr style="background: #f8fafc; font-weight: 800;">
                  <td colspan="2" style="padding: 3px 6px; border: 1px solid #cbd5e1;">Total Expenses</td>
                  <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #dc2626;">₹${totalExpenses.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- 32 Flats Collection Status Grid -->
        <div class="flats-container">
          <div class="flats-header">
            <span>32 Flats Maintenance Collection Status</span>
            <span>${paidCount} Paid • ${dueCount} Due</span>
          </div>
          <div class="flats-grid">
            ${flatStatusGrid}
          </div>
        </div>

        <!-- Signatures -->
        <div class="signatures-grid">
          <div>
            <div style="height: 18px;"></div>
            <div class="sig-line">Treasurer</div>
            <div style="font-size: 6.5pt; color: #64748b;">Rockcliff 'B' Block</div>
          </div>
          <div>
            <div style="height: 18px;"></div>
            <div class="sig-line">Secretary</div>
            <div style="font-size: 6.5pt; color: #64748b;">Rockcliff 'B' Block</div>
          </div>
          <div>
            <div style="height: 18px;"></div>
            <div class="sig-line">President</div>
            <div style="font-size: 6.5pt; color: #64748b;">Rockcliff 'B' Block</div>
          </div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex flex-col items-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Control Action Bar */}
      <div className="no-print w-full max-w-4xl bg-white p-4 rounded-2xl border border-slate-200 shadow-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="p-2 bg-blue-100 text-blue-700 rounded-xl font-bold">📄</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Monthly Statement PDF Export Preview</h3>
            <p className="text-xs text-slate-500">{statement.sheet_name} • Clean single-month financial statement</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                orientation === 'portrait' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                orientation === 'landscape' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Landscape
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 active:scale-95 transition-all"
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

      {/* Target Document Preview */}
      <div
        className={`bg-white shadow-2xl p-6 sm:p-8 rounded-2xl w-full border border-slate-200 ${
          orientation === 'landscape' ? 'max-w-5xl' : 'max-w-4xl'
        }`}
      >
        <div className="text-center pb-3 border-b-2 border-slate-900 mb-3">
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-wide uppercase">
            ROCKCLIFF 'B' BLOCK RESIDENTS WELFARE ASSOCIATION
          </h1>
          <p className="text-xs font-bold text-slate-800 mt-0.5 uppercase">
            FINANCIAL STATEMENT OF INFLOWS, OUTFLOWS & BANK BALANCES — {statement.sheet_name}
          </p>
          <p className="text-[10px] text-slate-500">
            Official Society Monthly Financial Review • 32 Flats
          </p>
        </div>

        {/* Balances Summary */}
        <div className="grid grid-cols-5 gap-2 text-center text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-3">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Opening Cash</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.cash_opening)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Opening Bank</p>
            <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{formatINR(statement.bank_opening)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Cash Balance</p>
            <p className={`text-xs font-black font-mono mt-0.5 ${statement.cash_balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatINR(statement.cash_balance)}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Bank Balance</p>
            <p className="text-xs font-black text-blue-700 font-mono mt-0.5">{formatINR(statement.bank_balance)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-500">Total Liquid</p>
            <p className="text-xs font-black text-purple-700 font-mono mt-0.5">{formatINR(statement.total_balance)}</p>
          </div>
        </div>

        {/* Collection Status Bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 flex flex-wrap justify-between items-center text-xs">
          <div>
            <span className="text-slate-600 font-medium">Billed: </span>
            <strong className="text-slate-900 font-mono">{formatINR(totalBilled)}</strong>
          </div>
          <div>
            <span className="text-emerald-800 font-medium">Collected: </span>
            <strong className="text-emerald-700 font-mono">{formatINR(totalCollected)}</strong> ({paidCount} Paid)
          </div>
          <div>
            <span className="text-rose-800 font-medium">Pending Dues: </span>
            <strong className="text-rose-700 font-mono">{formatINR(totalPending)}</strong> ({dueCount} Due)
          </div>
        </div>

        {/* 32 Flats Collection Status Grid Preview */}
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
              32 Flats Maintenance Assessment & Collection Status
            </h4>
            <span className="text-[10px] font-bold text-slate-500">
              {paidCount} Paid • {dueCount} Pending Due
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[...statement.flats].sort((a, b) => a.flat - b.flat).map(f => {
              const isPaid = f.pending <= 1;
              return (
                <div
                  key={f.flat}
                  className={`p-1.5 rounded-lg border text-[11px] flex justify-between items-center ${
                    isPaid ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <span className="font-bold text-slate-800">Flat {f.flat}</span>
                  <span className={`font-mono font-bold text-[10px] ${isPaid ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isPaid ? `${formatINR(f.paid)} ✓` : `${formatINR(f.pending)} ⚠`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Committee Signatures Preview */}
        <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="h-8"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-800">Prepared by (Treasurer)</p>
            <p className="text-[9px] text-slate-400">Rockcliff 'B' Block</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-800">Verified by (Secretary)</p>
            <p className="text-[9px] text-slate-400">Rockcliff 'B' Block</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-slate-400 pt-1 font-bold text-slate-800">Approved by (President)</p>
            <p className="text-[9px] text-slate-400">Rockcliff 'B' Block</p>
          </div>
        </div>
      </div>
    </div>
  );
};
