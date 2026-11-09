import React, { useState } from 'react';
import { MaintenanceStatement, WaterStatement, StaffLoan } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, computeDynamicStatementBalances, sortFlatsBySequence } from '../services/calculations';

interface MonthlyStatementPdfExportProps {
  statement: MaintenanceStatement;
  waterStatement?: WaterStatement;
  sequence?: 'riser' | 'ascending';
  staffLoans?: StaffLoan[];
  onClose: () => void;
}

export const MonthlyStatementPdfExport: React.FC<MonthlyStatementPdfExportProps> = ({
  statement,
  waterStatement,
  sequence = 'riser',
  staffLoans = [],
  onClose
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const dynamic = computeDynamicStatementBalances(statement);

  // Compute metrics
  const totalBilled = statement.flats.reduce((sum, f) => sum + (f.actual || 0), 0);
  const totalFlatPaid = statement.flats.reduce((sum, f) => sum + (f.paid || 0), 0);
  const totalFlatPending = statement.flats.reduce((sum, f) => sum + (f.pending || 0), 0);
  const paidCount = statement.flats.filter(f => f.pending <= 1).length;
  const dueCount = statement.flats.filter(f => f.pending > 1).length;
  const recoveryRate = Math.round((totalFlatPaid / Math.max(1, totalFlatPaid + totalFlatPending)) * 100);

  const relevantLoans = (staffLoans || []).filter(loan => {
    if (loan.status === 'Active') return true;
    const hasMonthRepayment = (loan.repayments || []).some(r => sameCalendarMonth(r.monthSheet, statement.sheet_name));
    const wasDisbursedThisMonth = sameCalendarMonth(loan.disbursed_month_sheet, statement.sheet_name);
    return hasMonthRepayment || wasDisbursedThisMonth;
  });

  // Separate Paid disbursements from Billed unpaid liabilities
  const paidExpenses = statement.expenses.filter(e => e.status !== 'Billed');
  const billedExpenses = statement.expenses.filter(e => e.status === 'Billed');
  const totalPaidExpenses = dynamic.totalPaidExpenses;
  const totalBilledLiabilities = dynamic.billedExpenses;

  const cashInflows = statement.inflows.filter(i => (i.type || 'Cash') === 'Cash');
  const bankInflows = statement.inflows.filter(i => i.type === 'Bank');

  // Dynamic breakdown of actual cash & bank collections and inflows direct from records
  const cashFlatCollections = dynamic.cashFlatCollections;
  const bankFlatCollections = dynamic.bankFlatCollections;
  const otherCashInflows = dynamic.otherCashInflows;
  const otherBankInflows = dynamic.otherBankInflows;

  const totalCashIn = dynamic.totalCashReceived;
  const totalBankIn = dynamic.totalBankInflows;
  const totalReceiptsAndInflows = dynamic.totalReceiptsAndInflows;

  // Sort flats according to selected sequence (Vertical Riser by default)
  const sortedFlats = sortFlatsBySequence([...statement.flats], sequence);

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

    const paidExpensesRows = paidExpenses.length ? paidExpenses.map(e => `
      <tr>
        <td style="padding: 3px 6px; border: 1px solid #e2e8f0; font-weight: 500;">${e.description}</td>
        <td style="padding: 3px 6px; border: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 7pt;">${e.type || 'Cash'}</td>
        <td style="padding: 3px 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">₹${e.amount.toLocaleString('en-IN')}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="3" style="padding: 6px; text-align: center; color: #94a3b8; font-size: 7pt;">No paid outflows recorded</td>
      </tr>
    `;

    const billedExpensesHtml = billedExpenses.length > 0 ? `
      <div style="margin-top: 8px; padding: 6px 8px; border: 1px solid #fde68a; background-color: #fffbeb; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 7pt; font-weight: 800; color: #78350f; text-transform: uppercase;">📄 Accrued / Billed Unpaid Liabilities</span>
          <span style="font-size: 7.5pt; font-weight: 800; color: #78350f; font-family: monospace;">₹${totalBilledLiabilities.toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size: 6.5pt; color: #92400e;">
          ${billedExpenses.map(be => `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>• ${be.description}</span>
              <span style="font-family: monospace; font-weight: 700;">₹${be.amount.toLocaleString('en-IN')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const cashInflowRows = `
      <tr>
        <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #475569;">Opening Cash Balance</td>
        <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600;">₹${(statement.cash_opening ?? 0).toLocaleString('en-IN')}</td>
      </tr>
      ${cashFlatCollections > 0 ? `
        <tr>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #475569;">Flat Maintenance Collections (Cash)</td>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600; color: #047857;">₹${cashFlatCollections.toLocaleString('en-IN')}</td>
        </tr>
      ` : ''}
      ${cashInflows.map(i => `
        <tr>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #475569;">${i.description}</td>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600;">₹${i.amount.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
      <tr style="background: #f0fdf4; font-weight: 700;">
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; color: #065f46;">Total Cash Received (IA)</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #065f46;">₹${totalCashIn.toLocaleString('en-IN')}</td>
      </tr>
    `;

    const bankInflowRows = `
      <tr>
        <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #475569;">Opening Bank Balance</td>
        <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600;">₹${(statement.bank_opening ?? 0).toLocaleString('en-IN')}</td>
      </tr>
      ${bankFlatCollections > 0 ? `
        <tr>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #475569;">Flat Maintenance Collections (Bank / Online)</td>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600; color: #1e40af;">₹${bankFlatCollections.toLocaleString('en-IN')}</td>
        </tr>
      ` : ''}
      ${bankInflows.map(i => `
        <tr>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #475569;">${i.description}</td>
          <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600;">₹${i.amount.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
      <tr style="background: #eff6ff; font-weight: 700;">
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; color: #1e40af;">Total Bank Inflows (IB)</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #1e40af;">₹${totalBankIn.toLocaleString('en-IN')}</td>
      </tr>
      <tr style="background: #f1f5f9; font-weight: 800;">
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; color: #0f172a;">Total Available Bank Funds (Opening + IB)</td>
        <td style="padding: 3px 6px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #0f172a;">₹${((statement.bank_opening ?? 0) + totalBankIn).toLocaleString('en-IN')}</td>
      </tr>
    `;

    const flatColumnsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3.5px;">
        ${sortedFlats.map(f => {
          const isPaid = f.pending <= 1;
          const roundedBill = Math.round(f.actual || 0);
          const roundedPaid = Math.round(f.paid || 0);
          const roundedPending = Math.round(f.pending || 0);
          return `
            <div style="border: 1px solid ${isPaid ? '#a7f3d0' : f.paid > 0 ? '#fde68a' : '#fca5a5'}; background: #ffffff; padding: 2.5px 4.5px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt;">
              <div>
                <strong style="color: #0f172a; display: block;">Flat ${f.flat}</strong>
                <span style="font-family: monospace; color: #64748b; font-size: 5.6pt;">
                  Bill: ₹${roundedBill.toLocaleString('en-IN')}${(f.previous_pending || 0) > 0 ? ` +₹${Math.round(f.previous_pending).toLocaleString('en-IN')} arr` : ''}
                </span>
                ${roundedPaid > 0 && f.pending > 1 ? `<span style="font-family: monospace; color: #047857; font-weight: 700; font-size: 5.6pt; display: block;">Paid: ₹${roundedPaid.toLocaleString('en-IN')}</span>` : ''}
              </div>
              <div style="text-align: right;">
                <strong style="font-family: monospace; display: block; color: ${f.pending > 1 ? '#e11d48' : '#047857'}; font-size: 6.6pt;">
                  ${f.pending > 1 ? `₹${roundedPending.toLocaleString('en-IN')} Due` : `₹${roundedPaid.toLocaleString('en-IN')} Paid`}
                </strong>
                <span style="font-size: 5.4pt; font-weight: 800; text-transform: uppercase; padding: 0.5px 3.5px; border-radius: 9999px; background: ${isPaid ? '#d1fae5' : f.paid > 0 ? '#fef3c7' : '#ffe4e6'}; color: ${isPaid ? '#065f46' : f.paid > 0 ? '#92400e' : '#9f1239'};">
                  ${isPaid ? 'Paid' : f.paid > 0 ? 'Partial' : 'Due'}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const staffLoansHtml = relevantLoans.length ? `
      <div style="margin-top: 6px; margin-bottom: 6px; padding: 4px 6px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
          <strong style="color: #1e3a8a; font-size: 7pt; text-transform: uppercase;">Staff Loan & Advance Ledger</strong>
          <span style="font-size: 6pt; color: #1e40af; font-weight: 700;">${relevantLoans.length} Staff Loan Account(s)</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 6.5pt;">
          <thead>
            <tr style="background: #dbeafe; color: #1e40af; text-transform: uppercase; font-size: 5.8pt;">
              <th style="padding: 2px 4px; text-align: left; border: 1px solid #bfdbfe;">Staff Member</th>
              <th style="padding: 2px 4px; text-align: right; border: 1px solid #bfdbfe;">Total Loan</th>
              <th style="padding: 2px 4px; text-align: right; border: 1px solid #bfdbfe;">Total Repaid</th>
              <th style="padding: 2px 4px; text-align: right; border: 1px solid #bfdbfe;">Balance Pending</th>
              <th style="padding: 2px 4px; text-align: right; border: 1px solid #bfdbfe;">Paid in ${statement.sheet_name}</th>
            </tr>
          </thead>
          <tbody>
            ${relevantLoans.map(loan => {
              const totalRepaid = (loan.repayments || []).reduce((sum, r) => sum + r.amount, 0);
              const remainingBal = Math.max(0, loan.principal_amount - totalRepaid);
              const monthRepayments = (loan.repayments || []).filter(r => sameCalendarMonth(r.monthSheet, statement.sheet_name));
              const monthRepaidTotal = monthRepayments.reduce((sum, r) => sum + r.amount, 0);
              return `
                <tr style="background: #ffffff;">
                  <td style="padding: 2px 4px; border: 1px solid #bfdbfe; font-weight: 700; color: #0f172a;">
                    ${loan.borrower_name} <span style="font-size: 5.4pt; color: #64748b;">(${loan.designation || 'Staff'})</span>
                  </td>
                  <td style="padding: 2px 4px; border: 1px solid #bfdbfe; text-align: right; font-family: monospace;">
                    ₹${Math.round(loan.principal_amount).toLocaleString('en-IN')}
                  </td>
                  <td style="padding: 2px 4px; border: 1px solid #bfdbfe; text-align: right; font-family: monospace; color: #047857;">
                    ₹${Math.round(totalRepaid).toLocaleString('en-IN')}
                  </td>
                  <td style="padding: 2px 4px; border: 1px solid #bfdbfe; text-align: right; font-family: monospace; font-weight: 800; color: ${remainingBal > 0 ? '#b91c1c' : '#047857'};">
                    ₹${Math.round(remainingBal).toLocaleString('en-IN')}
                  </td>
                  <td style="padding: 2px 4px; border: 1px solid #bfdbfe; text-align: right; font-family: monospace; font-weight: 700; color: #1d4ed8;">
                    ${monthRepaidTotal > 0 ? `+₹${Math.round(monthRepaidTotal).toLocaleString('en-IN')}` : '₹0'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Monthly Association Financial Statement - ${statement.sheet_name}</title>
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
            padding: 2px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .header-box {
            text-align: center;
            padding-bottom: 6px;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 8px;
          }
          .tag {
            font-size: 7.5pt;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #2563eb;
          }
          .title {
            font-size: 13pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-top: 1px;
          }
          .sub {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 1px;
          }

          /* 3 Key Balances Banner */
          .balances-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 6px 10px;
            margin-bottom: 8px;
            text-align: center;
          }
          .b-label { font-size: 6.8pt; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .b-val { font-size: 11pt; font-weight: 900; font-family: monospace; margin-top: 1px; }

          /* 2-Column Ledgers */
          .ledgers-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 8px;
          }
          .ledger-card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 6px 8px;
          }
          .card-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 6px;
          }
          .card-title {
            font-size: 7.5pt;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .card-val {
            font-size: 8pt;
            font-weight: 800;
            font-family: monospace;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6.8pt;
          }
          th {
            background: #f8fafc;
            color: #64748b;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 6pt;
            padding: 2.5px 5px;
            border: 1px solid #e2e8f0;
          }

          /* 32 Flats Section */
          .flats-section {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 6px 8px;
            background: #f8fafc;
            margin-bottom: 8px;
          }
          .sec-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 5px;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            margin-bottom: 6px;
          }
          .metric-box {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 3px 6px;
            text-align: center;
          }
          .flats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 3.5px;
          }

          /* Committee Signatures */
          .signatures-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            padding-top: 6px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
            font-size: 7.2pt;
          }
          .sig-line {
            border-top: 1px solid #94a3b8;
            padding-top: 2px;
            font-weight: 700;
            color: #0f172a;
          }
        </style>
      </head>
      <body>
        <!-- Printable Header -->
        <div class="header-box">
          <div class="tag">Monthly Association Financial Statement</div>
          <div class="title">Rockcliff 'B' Block Residents Welfare Association</div>
          <div class="sub">Maintenance Statement for the Month of <strong>${statement.title || statement.sheet_name}</strong></div>
        </div>

        <!-- 3 Key Balances Banner -->
        <div class="balances-grid">
          <div>
            <div class="b-label">Cash in Hand (IA-EA)</div>
            <div class="b-val" style="color: ${dynamic.closingCash < 0 ? '#e11d48' : '#059669'};">₹${dynamic.closingCash.toLocaleString('en-IN')}</div>
          </div>
          <div style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">
            <div class="b-label">Bank Balance (IB-EB)</div>
            <div class="b-val" style="color: #2563eb;">₹${dynamic.closingBank.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="b-label">Total Liquid Funds</div>
            <div class="b-val" style="color: #7c3aed;">₹${dynamic.totalLiquidFunds.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <!-- Side-by-Side: Inflows vs Outflows -->
        <div class="ledgers-grid">
          <!-- Receipts & Inflows -->
          <div class="ledger-card">
            <div class="card-head">
              <span class="card-title" style="color: #047857;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background:#10b981;"></span>
                Receipts & Inflows (IA + IB)
              </span>
              <span class="card-val" style="color: #047857;">₹${totalFlatPaid.toLocaleString('en-IN')}</span>
            </div>

            <!-- Cash Inflows -->
            <div style="margin-bottom: 6px;">
              <div style="font-size: 6.8pt; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 2px;">
                Cash Inflows (IA)
              </div>
              <table>
                <tbody>
                  ${cashInflowRows}
                </tbody>
              </table>
            </div>

            <!-- Bank Inflows -->
            <div>
              <div style="font-size: 6.8pt; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 2px;">
                Bank Inflows (IB)
              </div>
              <table>
                <tbody>
                  ${bankInflowRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Expenses & Outflows -->
          <div class="ledger-card">
            <div class="card-head">
              <span class="card-title" style="color: #be123c;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background:#f43f5e;"></span>
                Expenses & Outflows (EA + EB)
              </span>
              <span class="card-val" style="color: #be123c;">₹${totalPaidExpenses.toLocaleString('en-IN')}</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Description</th>
                  <th style="text-align: center; width: 45px;">Mode</th>
                  <th style="text-align: right; width: 65px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${paidExpensesRows}
                <tr style="background: #fff1f2; font-weight: 800;">
                  <td colspan="2" style="padding: 3px 6px; border: 1px solid #fecdd3; color: #881337; text-transform: uppercase; font-size: 6.5pt;">Total Paid Outflows (EA+EB)</td>
                  <td style="padding: 3px 6px; border: 1px solid #fecdd3; text-align: right; font-family: monospace; color: #881337;">₹${totalPaidExpenses.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>

            <!-- Accrued / Billed Liabilities -->
            ${billedExpensesHtml}
          </div>
        </div>

        <!-- Monthly Assessment & 32 Flats Collection Status -->
        <div class="flats-section">
          <div class="sec-header">
            <div>
              <strong style="font-size: 7.2pt; text-transform: uppercase; color: #0f172a;">
                📋 Monthly Assessment & Flat Collection Status
              </strong>
              <div style="font-size: 6pt; color: #64748b;">Summary of 32 flats maintenance assessments, amount collected, and pending dues.</div>
            </div>
          </div>

          <!-- 4 Metrics Summary Bar -->
          <div class="metrics-grid">
            <div class="metric-box">
              <span style="font-size: 5.8pt; font-weight: 800; color: #64748b; text-transform: uppercase; display: block;">Total Billed</span>
              <strong style="font-size: 8pt; font-family: monospace; color: #0f172a;">₹${totalBilled.toLocaleString('en-IN')}</strong>
            </div>
            <div class="metric-box" style="background: #f0fdf4; border-color: #bbf7d0;">
              <span style="font-size: 5.8pt; font-weight: 800; color: #166534; text-transform: uppercase; display: block;">Collected Amount</span>
              <strong style="font-size: 8pt; font-family: monospace; color: #166534;">₹${totalFlatPaid.toLocaleString('en-IN')}</strong>
            </div>
            <div class="metric-box" style="background: #fff1f2; border-color: #fecdd3;">
              <span style="font-size: 5.8pt; font-weight: 800; color: #991b1b; text-transform: uppercase; display: block;">Pending Dues</span>
              <strong style="font-size: 8pt; font-family: monospace; color: #991b1b;">₹${totalFlatPending.toLocaleString('en-IN')}</strong>
            </div>
            <div class="metric-box" style="background: #eff6ff; border-color: #bfdbfe;">
              <span style="font-size: 5.8pt; font-weight: 800; color: #1e40af; text-transform: uppercase; display: block;">Collection Rate</span>
              <strong style="font-size: 8pt; font-family: monospace; color: #1e40af;">${recoveryRate}%</strong>
            </div>
          </div>

          <!-- Staff Loan & Advance Ledger -->
          ${staffLoansHtml}

          <!-- 32 Flats Cards Grid (4 Vertical Columns) -->
          ${flatColumnsHtml}
        </div>

        <!-- Committee Signatures -->
        <div class="signatures-grid">
          <div>
            <div style="height: 14px;"></div>
            <div class="sig-line">Prepared by (Treasurer)</div>
          </div>
          <div>
            <div style="height: 14px;"></div>
            <div class="sig-line">Verified by (Secretary)</div>
          </div>
          <div>
            <div style="height: 14px;"></div>
            <div class="sig-line">Approved by (President)</div>
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
            <p className="text-xs text-slate-500">{statement.sheet_name} • Full financial statement with A4 narrow margins</p>
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
            <span>⬇️ Print / Save as PDF</span>
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

      {/* Target Document Preview (Exact 1:1 Mirror of On-Screen Statement) */}
      <div
        className={`bg-white shadow-2xl p-6 sm:p-8 rounded-3xl w-full border border-slate-200 space-y-6 ${
          orientation === 'landscape' ? 'max-w-5xl' : 'max-w-4xl'
        }`}
      >
        {/* Printable Header */}
        <div className="text-center pb-4 border-b-2 border-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">
            Monthly Association Financial Statement
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1 uppercase tracking-tight">
            Rockcliff 'B' Block Residents Welfare Association
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintenance Statement for the Month of <strong>{statement.title || statement.sheet_name}</strong>
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
                  <span>Cash Inflows (IA)</span>
                </p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1.5 text-slate-600">Opening Cash Balance</td>
                      <td className="py-1.5 text-right font-mono font-semibold">{formatINR(statement.cash_opening ?? 0)}</td>
                    </tr>
                    {cashFlatCollections > 0 && (
                      <tr>
                        <td className="py-1.5 text-slate-600">Flat Maintenance Collections (Cash)</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-emerald-700">{formatINR(cashFlatCollections)}</td>
                      </tr>
                    )}
                    {cashInflows.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-600">{item.description}</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50/50 font-bold">
                      <td className="py-1.5 px-2 text-emerald-900">Total Cash Received (IA)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-900">
                        {formatINR(totalCashIn)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bank Inflows */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                  <span>Bank Inflows (IB)</span>
                </p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1.5 text-slate-600">Opening Bank Balance</td>
                      <td className="py-1.5 text-right font-mono font-semibold">{formatINR(statement.bank_opening ?? 0)}</td>
                    </tr>
                    {bankFlatCollections > 0 && (
                      <tr>
                        <td className="py-1.5 text-slate-600">Flat Maintenance Collections (Bank / Online)</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-blue-700">{formatINR(bankFlatCollections)}</td>
                      </tr>
                    )}
                    {bankInflows.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-600">{item.description}</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50/50 font-bold">
                      <td className="py-1.5 px-2 text-blue-900">Total Bank Inflows (IB)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-blue-900">
                        {formatINR(totalBankIn)}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                      <td className="py-1.5 px-2 text-slate-800">Total Available Bank Funds (Opening + IB)</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-900">
                        {formatINR((statement.bank_opening ?? 0) + totalBankIn)}
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
                {formatINR(totalPaidExpenses)}
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
                      {formatINR(totalPaidExpenses)}
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

        {/* 32 Flats Collection Status */}
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
          </div>

          {/* Collection Metrics Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Billed</span>
              <p className="text-base font-black text-slate-900 font-mono mt-0.5">
                {formatINR(totalBilled)}
              </p>
              <span className="text-[10px] text-slate-400">32 Flats Combined</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Collected Amount</span>
              <p className="text-base font-black text-emerald-700 font-mono mt-0.5">
                {formatINR(totalFlatPaid)}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold">
                {paidCount} Flats Settled
              </span>
            </div>

            <div className={`p-3 rounded-2xl border shadow-2xs ${totalFlatPending > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Pending Dues</span>
              <p className={`text-base font-black font-mono mt-0.5 ${totalFlatPending > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {formatINR(totalFlatPending)}
              </p>
              <span className="text-[10px] text-rose-600 font-bold">
                {dueCount} Flats Unpaid
              </span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Collection Rate</span>
              <p className="text-base font-black text-blue-700 font-mono mt-0.5">
                {recoveryRate}%
              </p>
              <span className="text-[10px] text-blue-600 font-bold">Recovery Status</span>
            </div>
          </div>

          {/* Staff Loan Ledger Preview */}
          {relevantLoans.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50/50 border border-blue-200 rounded-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200 mb-2">
                <span className="text-[11px] font-black uppercase text-blue-900 tracking-wider">
                  🤝 Staff Loan & Advance Ledger
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                  {relevantLoans.length} Account(s)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relevantLoans.map(loan => {
                  const totalRepaid = (loan.repayments || []).reduce((sum, r) => sum + r.amount, 0);
                  const remainingBal = Math.max(0, loan.principal_amount - totalRepaid);
                  const monthRepayments = (loan.repayments || []).filter(r => sameCalendarMonth(r.monthSheet, statement.sheet_name));
                  const monthRepaidTotal = monthRepayments.reduce((sum, r) => sum + r.amount, 0);

                  return (
                    <div key={loan.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-900">{loan.borrower_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          remainingBal === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {remainingBal === 0 ? '✓ Settled' : 'Active'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] text-center bg-slate-50 p-1.5 rounded-lg font-mono">
                        <div>
                          <span className="text-slate-400 block text-[9px]">Loan</span>
                          <span className="font-bold text-slate-800">{formatINR(loan.principal_amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">Repaid</span>
                          <span className="font-bold text-emerald-700">{formatINR(totalRepaid)}</span>
                        </div>
                        <div>
                          <span className="text-rose-600 block text-[9px]">Balance</span>
                          <span className="font-bold text-rose-600">{formatINR(remainingBal)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Paid in {statement.sheet_name}:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {monthRepaidTotal > 0 ? `+${formatINR(monthRepaidTotal)}` : '₹0'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 32 Flats Cards Grid (Direct 4-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {sortedFlats.map((f) => {
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
                      : f.paid > 0
                      ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                      : 'bg-white border-rose-300 shadow-2xs'
                  }`}
                >
                  <div>
                    <span className="font-black text-slate-900 block">Flat {f.flat}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Bill: {formatINR(roundedBill)}
                      {(f.previous_pending || 0) > 0 && (
                        <span className="text-rose-600 font-bold ml-1">+{formatINR(Math.round(f.previous_pending))} arr</span>
                      )}
                    </span>
                    {roundedPaid > 0 && f.pending > 1 && (
                      <span className="text-[10px] text-emerald-700 font-mono font-bold block">
                        Paid: {formatINR(roundedPaid)}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className={`font-mono font-black block text-xs ${
                      f.pending > 1 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {f.pending > 1
                        ? `${formatINR(roundedPending)} Due`
                        : `${formatINR(roundedPaid)} Paid`}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : f.paid > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isPaid ? 'Paid' : f.paid > 0 ? 'Partial' : 'Due'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Committee Signatures Block */}
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
