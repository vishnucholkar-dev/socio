import { ApartmentData } from '../types/apartment';
import { computeDynamicStatementBalances } from './calculations';

/**
 * Generates and downloads a clean multi-sheet XML-compliant spreadsheet (.xlsx / Excel) directly in the browser.
 */
export function exportAnnualExcelClient(data: ApartmentData, targetYear: number): void {
  const yearStr = String(targetYear);

  // Month sorting helper
  const monthOrder = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthKey = (sheetName: string) => {
    const lower = sheetName.toLowerCase();
    for (let i = 0; i < monthOrder.length; i++) {
      if (lower.includes(monthOrder[i])) return i;
    }
    return 99;
  };

  const maintList = (data.maintenance_statements || [])
    .filter(m => m.sheet_name.includes(yearStr))
    .sort((a, b) => monthKey(a.sheet_name) - monthKey(b.sheet_name));

  const waterList = (data.water_statements || [])
    .filter(w => w.sheet_name.includes(yearStr))
    .sort((a, b) => monthKey(a.sheet_name) - monthKey(b.sheet_name));

  // Build Sheet 1: Expenses & Inflows
  const s1Rows: string[] = [];
  s1Rows.push('Month Cycle\tEntry Type\tCategory\tDescription\tChannel\tStatus\tAmount (INR)\tTransaction Date');
  for (const m of maintList) {
    for (const inf of m.inflows || []) {
      s1Rows.push(`${m.sheet_name}\tINFLOW\t${inf.category || 'Inflow'}\t${inf.description}\t${inf.type || 'Cash'}\tReceived\t${inf.amount}\t${inf.date || ''}`);
    }
    for (const exp of m.expenses || []) {
      s1Rows.push(`${m.sheet_name}\tEXPENSE\t${exp.category || 'Expense'}\t${exp.description}\t${exp.type || 'Cash'}\t${exp.status || 'Paid'}\t${exp.amount}\t${exp.date || ''}`);
    }
  }

  // Build Sheet 2: Water & Flat Collections
  const s2Rows: string[] = [];
  s2Rows.push('Billing Month\tFlat #\tOpening (Y)\tClosing (X)\tLiters (X-Y)\tAvg L/Day\tWater Charge (INR)\tBase Maint (INR)\tMonth Bill (INR)\tPaid (INR)\tPending Arrears (INR)\tStatus\tChannel');
  for (const m of maintList) {
    const w = waterList.find(x => x.sheet_name.split(' ')[0].toLowerCase() === m.sheet_name.split(' ')[0].toLowerCase());
    const wFlatsMap = new Map((w?.flats || []).map(f => [f.flat, f]));
    const sortedFlats = [...(m.flats || [])].sort((a, b) => a.flat - b.flat);

    for (const f of sortedFlats) {
      const wf = wFlatsMap.get(f.flat);
      s2Rows.push([
        m.sheet_name,
        f.flat,
        wf?.opening_reading ?? 0,
        wf?.closing_reading ?? 0,
        wf?.liters ?? 0,
        wf?.avg_per_day ?? 0,
        wf?.water_charge ?? 0,
        wf?.mandatory_maintenance ?? 1400,
        f.actual,
        f.paid,
        f.pending,
        f.status,
        f.mode || 'Due'
      ].join('\t'));
    }
  }

  // Build Sheet 3: Monthly Financial Summaries
  const s3Rows: string[] = [];
  s3Rows.push('Month Cycle\tOpening Cash\tOpening Bank\tTotal Billed\tTotal Collections\tOther Inflows\tPaid Outflows\tClosing Cash\tClosing Bank\tTotal Liquid Funds');
  for (const m of maintList) {
    const dyn = computeDynamicStatementBalances(m);
    const billed = (m.flats || []).reduce((s, f) => s + (f.actual || 0), 0);
    const collected = dyn.totalReceiptsAndInflows;
    const inflows = dyn.otherCashInflows + dyn.otherBankInflows;
    const outflows = dyn.totalPaidExpenses;

    s3Rows.push([
      m.sheet_name,
      dyn.cashOpening,
      dyn.bankOpening,
      billed,
      collected,
      inflows,
      outflows,
      dyn.closingCash,
      dyn.closingBank,
      dyn.totalLiquidFunds
    ].join('\t'));
  }

  // Combine into single Excel multi-table TSV/HTML Workbook format
  const excelXml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Expenses & Inflows</x:Name>
              <x:WorksheetSource HRef="#sheet1"/>
            </x:ExcelWorksheet>
            <x:ExcelWorksheet>
              <x:Name>Water & Flat Collections</x:Name>
              <x:WorksheetSource HRef="#sheet2"/>
            </x:ExcelWorksheet>
            <x:ExcelWorksheet>
              <x:Name>Monthly Summaries</x:Name>
              <x:WorksheetSource HRef="#sheet3"/>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 10pt; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px; }
        td { border: 1px solid #cbd5e1; padding: 4px; }
        .inflow { background-color: #ecfdf5; color: #166534; font-weight: bold; }
        .expense { background-color: #fff1f2; color: #991b1b; font-weight: bold; }
        .due { color: #dc2626; font-weight: bold; }
        .paid { color: #16a34a; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2 id="sheet1">Rockcliff 'B' Block — Society Expenses & Inflows (${targetYear})</h2>
      <table>
        ${s1Rows.map((r, i) => `<tr>${r.split('\t').map(c => `<${i === 0 ? 'th' : 'td'}>${c}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}
      </table>
      <br/><br/>
      <h2 id="sheet2">Rockcliff 'B' Block — 32 Flats Water Consumption & Maintenance (${targetYear})</h2>
      <table>
        ${s2Rows.map((r, i) => `<tr>${r.split('\t').map(c => `<${i === 0 ? 'th' : 'td'}>${c}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}
      </table>
      <br/><br/>
      <h2 id="sheet3">Rockcliff 'B' Block — Monthly Financial Summaries (${targetYear})</h2>
      <table>
        ${s3Rows.map((r, i) => `<tr>${r.split('\t').map(c => `<${i === 0 ? 'th' : 'td'}>${c}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rockcliff_Society_Annual_Ledger_${targetYear}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
