import assert from 'node:assert';

// Set up clean in-memory localStorage and DOM mocks
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class {
  constructor(type, detail) {
    this.type = type;
    this.detail = detail;
  }
};

const storage = await import('../src/services/storage.ts');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    store.clear();
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
    failedCount++;
  }
}

console.log('\n--- Running Rockcliff Storage & Cycle Management Tests ---\n');

// 1. MIGRATION & ACTIVE CYCLE INVARIANTS
runTest('Single active cycle policy: October 2026 is open, November is not open, earlier months are legacy-closed', () => {
  const data = storage.getApartmentData();
  const months = Object.keys(data.cycles);
  assert(months.length > 1, 'Should have multiple months in seed data');

  assert.strictEqual(data.cycles['October 2026'].status, 'open', 'October 2026 must be active open cycle');
  assert.strictEqual(data.cycles['November 2026'].status, 'initialization-required', 'November 2026 must not be open yet');

  for (const m of months) {
    if (m !== 'October 2026' && m !== 'November 2026') {
      assert.strictEqual(data.cycles[m].status, 'legacy-closed');
    }
  }
});

runTest('Edits are permitted in October 2026 (open) and blocked in November 2026 and legacy-closed cycles', () => {
  const data = storage.getApartmentData();

  // Permitted in October
  const withExpense = storage.addExpense('October 2026', {
    description: 'Diwali Lighting repair',
    amount: 1200,
    category: 'Electrical',
    type: 'Cash',
    date: '2026-10-15'
  });
  const octM = withExpense.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert(octM.expenses.some(e => e.description === 'Diwali Lighting repair'));

  // Blocked in November (not open)
  assert.throws(() => {
    storage.addExpense('November 2026', { description: 'Capacitor', amount: 500, category: 'Electrical', type: 'Cash', date: '2026-11-01' });
  }, /requires explicit cycle initialization/);

  // Blocked in September (legacy closed)
  assert.throws(() => {
    storage.addExpense('September Water 2026', { description: 'Old repair', amount: 500, category: 'Electrical', type: 'Cash', date: '2026-09-01' });
  }, /locked legacy cycle/);
});

runTest('Single open cycle invariant: Opening another cycle while October is open is blocked', () => {
  assert.throws(() => {
    storage.openCycle('November 2026', 'Open early');
  }, /Only one cycle can be open at a time/);
});

// 2. REOPEN & CLOSE SAFEGUARDS
runTest('Legacy-closed cycles cannot be reopened', () => {
  assert.throws(() => {
    storage.reopenCycle('September Water 2026', 'Want to edit legacy period');
  }, /legacy-closed periods cannot be reopened/);
});

// 3. BALANCE TRANSFERS & ATOMICITY
runTest('Balance transfer moves money between Cash and Bank correctly in October 2026', () => {
  // Add petty cash inflow first
  storage.addInflow('October 2026', {
    description: 'Petty Cash Replenishment',
    amount: 5000,
    type: 'Cash',
    date: '2026-10-01'
  });

  const maintBefore = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const initialCash = maintBefore.cash_balance;
  const initialBank = maintBefore.bank_balance;

  // Add transfer from Cash to Bank (deposit gate cash into society bank)
  const updated = storage.addBalanceTransfer('October 2026', {
    description: 'Bank Deposit of Petty Cash',
    amount: 1000,
    from: 'Cash',
    to: 'Bank',
    date: '2026-10-02'
  });

  const maintAfter = updated.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(maintAfter.cash_balance, Math.round((initialCash - 1000) * 100) / 100);
  assert.strictEqual(maintAfter.bank_balance, Math.round((initialBank + 1000) * 100) / 100);
  assert.strictEqual(maintAfter.transfers.length, 1);
});

runTest('Transfer update validates atomically and does not mutate balances on failure', () => {
  // Add cash inflow first
  storage.addInflow('October 2026', {
    description: 'Petty Cash Replenishment',
    amount: 5000,
    type: 'Cash',
    date: '2026-10-01'
  });

  storage.addBalanceTransfer('October 2026', {
    description: 'Deposit into Bank',
    amount: 500,
    from: 'Cash',
    to: 'Bank',
    date: '2026-10-02'
  });

  const dataBefore = storage.getApartmentData();
  const maintBefore = dataBefore.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const transferId = maintBefore.transfers[0].id;
  const cashBefore = maintBefore.cash_balance;
  const bankBefore = maintBefore.bank_balance;

  // Attempt update with amount exceeding available balance
  assert.throws(() => {
    storage.updateBalanceTransfer('October 2026', transferId, {
      description: 'Massive transfer',
      amount: 999999999,
      from: 'Cash',
      to: 'Bank',
      date: '2026-10-02'
    });
  }, /exceeds the available/);

  // Verify in-memory state was NOT mutated
  const dataAfter = storage.getApartmentData();
  const maintAfter = dataAfter.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(maintAfter.cash_balance, cashBefore, 'Cash balance should remain unchanged after failed update');
  assert.strictEqual(maintAfter.bank_balance, bankBefore, 'Bank balance should remain unchanged after failed update');
  assert.strictEqual(maintAfter.transfers[0].amount, 500, 'Transfer amount should remain 500');

  // Delete transfer reverses properly
  storage.deleteBalanceTransfer('October 2026', transferId);
  const dataDeleted = storage.getApartmentData();
  const maintDeleted = dataDeleted.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(maintDeleted.transfers.length, 0);
  assert.strictEqual(maintDeleted.cash_balance, Math.round((cashBefore + 500) * 100) / 100);
  assert.strictEqual(maintDeleted.bank_balance, Math.round((bankBefore - 500) * 100) / 100);
});

// 4. INCREMENTAL FLAT PAYMENTS & LEDGER RECONCILIATION
runTest('Incremental flat payments record individual receipts and reconcile channels in October', () => {
  // Flat 101 pays partial 1000 in Cash
  storage.recordFlatPayment('October 2026', 101, 1000, 'Cash', 'Advance receipt 1', '2026-10-05');

  let maint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  let flat101 = maint.flats.find(f => f.flat === 101);
  assert.strictEqual(flat101.paid, 1000);
  assert.strictEqual(flat101.receipts.length, 1);
  assert.strictEqual(flat101.receipts[0].mode, 'Cash');
  assert.strictEqual(flat101.receipts[0].amount, 1000);

  // Flat 101 pays another 500 via Online (Bank)
  storage.recordFlatPayment('October 2026', 101, 500, 'Online', 'UPI payment 2', '2026-10-10');

  maint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  flat101 = maint.flats.find(f => f.flat === 101);
  assert.strictEqual(flat101.paid, 1500);
  assert.strictEqual(flat101.receipts.length, 2);
  assert.strictEqual(flat101.receipts[1].mode, 'Online');
  assert.strictEqual(flat101.receipts[1].amount, 500);

  // Overpayment: paying more than the bill records an advance credit and updates status to Advance
  const payable = flat101.total_payable || flat101.actual;
  storage.recordFlatPayment('October 2026', 101, 2000, 'Online', 'Advance payment', '2026-10-15');
  maint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  flat101 = maint.flats.find(f => f.flat === 101);
  assert.strictEqual(flat101.paid, 3500);
  assert.strictEqual(flat101.pending, Math.round((payable - 3500) * 100) / 100);
  assert(flat101.pending < 0, 'Pending should be negative representing advance credit');
  assert.strictEqual(flat101.status, 'Advance');
});

// 5. SINGLE FLAT WATER READING SAVE & RECALCULATION
runTest('saveSingleFlatWaterReading updates single flat and dynamically recalculates all 32 flats', () => {
  const dataBefore = storage.getApartmentData();
  const octWaterBefore = dataBefore.water_statements.find(s => s.sheet_name === 'October 2026');
  const f101Before = octWaterBefore.flats.find(f => f.flat === 101);

  // Flat 101 opening reading is 102,833. Save new closing reading 120,000
  const updated = storage.saveSingleFlatWaterReading('October 2026', 101, 120000);
  const octWaterAfter = updated.water_statements.find(s => s.sheet_name === 'October 2026');
  const f101After = octWaterAfter.flats.find(f => f.flat === 101);

  assert.strictEqual(f101After.closing_reading, 120000);
  assert.strictEqual(f101After.liters, 120000 - 102833);
  assert(Number.isFinite(f101After.water_charge) && f101After.water_charge > 0);

  // Reject closing reading less than opening reading
  assert.throws(() => {
    storage.saveSingleFlatWaterReading('October 2026', 101, 100000);
  }, /cannot be less than opening reading/);
});

// 6. CLOSING OCTOBER AUTOMATICALLY ROLLS OVER TO NOVEMBER
runTest('Closing October 2026 automatically rolls over and opens November 2026', () => {
  const dataBefore = storage.getApartmentData();
  assert.strictEqual(dataBefore.cycles['October 2026'].status, 'open');
  assert.strictEqual(dataBefore.cycles['November 2026'].status, 'initialization-required');

  // Explicitly complete water statement before closing
  const octWater = dataBefore.water_statements.find(s => s.sheet_name === 'October 2026');
  storage.saveWaterStatement(octWater);

  // Close October 2026 with explanatory discrepancy note if needed
  const closedData = storage.closeCycle('October 2026', 'Closed after October general body meeting review');

  // October is now closed
  assert.strictEqual(closedData.cycles['October 2026'].status, 'closed');
  assert.strictEqual(closedData.cycles['October 2026'].close_reason, 'Closed after October general body meeting review');

  // November 2026 is automatically opened!
  assert.strictEqual(closedData.cycles['November 2026'].status, 'open', 'November must auto-open upon October close');
});

// 7. CORRUPT STORAGE RESILIENCE
runTest('Corrupt localStorage throws error without overwriting storage with seed data', () => {
  store.set('rockcliff_apartment_data_v10', '{ invalid json syntax !!!');

  assert.throws(() => {
    storage.getApartmentData();
  }, /unreadable.*original browser storage was preserved/);

  assert.strictEqual(store.get('rockcliff_apartment_data_v10'), '{ invalid json syntax !!!');
});

// 8. DUPLICATE STATEMENT REJECTION
runTest('Duplicate statement months throw error without corrupting existing data', () => {
  const initial = storage.getApartmentData();
  const dupMaint = JSON.parse(JSON.stringify(initial));
  dupMaint.maintenance_statements.push({ ...dupMaint.maintenance_statements[0] });
  store.set('rockcliff_apartment_data_v10', JSON.stringify(dupMaint));

  assert.throws(() => {
    storage.getApartmentData();
  }, /Duplicate maintenance statements exist/);
});

// 9. DIRECTORY CONTACTS CRUD WITH AUDIT
runTest('Directory contacts can be added, updated, and deleted with audit logging', () => {
  const initial = storage.getApartmentData();
  const initialContactCount = initial.contacts.length;

  const added = storage.saveContact({
    category: 'Plumber',
    name: 'Ramesh Plumber',
    phone: '+91 99999 88888',
    notes: 'Available for emergency pipeline leaks'
  });

  assert.strictEqual(added.contacts.length, initialContactCount + 1);
  const created = added.contacts.find(c => c.name === 'Ramesh Plumber');
  assert(created && created.id);

  // Update contact
  const updated = storage.saveContact({
    ...created,
    phone: '+91 99999 77777'
  });
  const modified = updated.contacts.find(c => c.id === created.id);
  assert.strictEqual(modified.phone, '+91 99999 77777');

  // Delete contact
  const deleted = storage.deleteContact(created.id);
  assert.strictEqual(deleted.contacts.length, initialContactCount);

  // Verify directory audit events
  const contactAudits = deleted.cycle_audit.filter(a => a.month === 'directory');
  assert(contactAudits.some(a => a.action === 'contact.saved'));
  assert(contactAudits.some(a => a.action === 'contact.deleted'));
});

// 10. BILLING CONFIG HISTORY WITH AUDIT
runTest('Billing config history tracks changes and audits them', () => {
  const initial = storage.getApartmentData();
  const initialLen = initial.billing_config_history.length;

  const updated = storage.addBillingConfig({
    effective_from: '2026-12',
    mandatory_maintenance: 1600,
    common_utilization: 6500,
    changed_by: 'AGM Committee 2026',
    notes: 'Approved rate hike for security guards salary revision'
  });

  assert.strictEqual(updated.billing_config_history.length, initialLen + 1);
  const latestConfig = storage.getLatestBillingConfig();
  assert.strictEqual(latestConfig.mandatory_maintenance, 1600);
  assert.strictEqual(latestConfig.common_utilization, 6500);

  const configAudit = updated.cycle_audit.filter(a => a.action === 'config.created');
  assert(configAudit.length > 0);
  assert.strictEqual(configAudit[configAudit.length - 1].month, '2026-12');
});

// 11. WATER CALCULATIONS LOGIC
runTest('Water billing calculation formula correctly distributes costs and adds mandatory rate', async () => {
  const calc = await import('../src/services/calculations.ts');
  const result = calc.calculateWaterBilling({
    tankerBill: 20000,
    electricityBill: 10000,
    commonUtilization: 6000,
    mandatoryMaintenance: 1400,
    days: 30,
    flatReadings: [
      { flat: 101, openingReading: 1000, closingReading: 3000, pendingAmount: 500 },
      { flat: 102, openingReading: 2000, closingReading: 4000, pendingAmount: 0 }
    ]
  });

  assert.strictEqual(result.netElectricity, 4000); // 10000 - 6000
  assert.strictEqual(result.totalPumpingCost, 24000); // 20000 + 4000
  assert.strictEqual(result.totalConsumptionLiters, 4000); // 2000 + 2000
  assert.strictEqual(result.literPerCharge, 6); // 24000 / 4000 = 6 per liter

  const f101 = result.flats.find(f => f.flat === 101);
  assert.strictEqual(f101.water_charge, 12000); // 2000 * 6
  assert.strictEqual(f101.actual_amount, 13400); // 12000 + 1400
  assert.strictEqual(f101.total_payable, 13900); // 13400 + 500 pending
});

// 12. OCTOBER 2026 VERIFIED BENCHMARK & FLAT 405 RECONCILIATION
runTest('October 2026 maintains verified society benchmark numbers (Flat 405: 1400 base + 1376 water = 2776)', () => {
  const data = storage.getApartmentData();
  const octMaint = data.maintenance_statements.find(s => s.sheet_name.includes('October 2026'));
  const octWater = data.water_statements.find(s => s.sheet_name.includes('October 2026'));

  assert(octWater, 'October 2026 water statement exists');
  assert(octMaint, 'October 2026 maintenance statement exists');

  assert.strictEqual(octWater.tanker_bill, 32400.0, 'October tanker bill must be 32,400');
  assert.strictEqual(octWater.electricity_bill, 18214.0, 'October electricity bill must be 18,214');
  assert.strictEqual(octWater.net_electricity, 12214.0, 'Net power must be 18,214 - 6,000 = 12,214');
  assert.strictEqual(octWater.total_water_consumption_liters, 534641.0, 'Total water consumption must be 534,641 L');

  const f405Water = octWater.flats.find(f => f.flat === 405);
  const f405Maint = octMaint.flats.find(f => f.flat === 405);

  assert(f405Water && f405Maint, 'Flat 405 exists in October statements');
  assert.strictEqual(f405Water.opening_reading, 443052.0, 'Flat 405 opening reading baseline');
  assert.strictEqual(f405Water.closing_reading, 459540.0, 'Flat 405 closing reading');
  assert.strictEqual(f405Water.liters, 16488.0, 'Flat 405 consumed liters');
  assert.strictEqual(f405Water.mandatory_maintenance, 1400.0, 'Flat 405 base maintenance is 1400');
  assert.strictEqual(f405Water.water_charge, 1375.87, 'Flat 405 water charge is 1375.87 (~1376)');
  assert.strictEqual(f405Water.actual_amount, 2775.87, 'Flat 405 total assessment is 2775.87 (~2776)');
  assert.strictEqual(f405Maint.actual, 2775.87, 'Flat 405 maintenance actual bill must match water actual amount');

  const totalBilled = octMaint.flats.reduce((sum, f) => sum + f.actual, 0);
  assert.strictEqual(totalBilled, 89414.0, 'October 2026 total society billed maintenance must be 89,414');
});

// 13. MARCH 2026 BENCHMARK & FLAT 405 RECONCILIATION
runTest('March 2026 maintains verified society benchmark numbers (Flat 405: 1400 base + 720 water = 2120)', () => {
  const data = storage.getApartmentData();
  const marMaint = data.maintenance_statements.find(s => s.sheet_name.includes('March') && s.sheet_name.includes('2026'));
  const marWater = data.water_statements.find(s => s.sheet_name.includes('March') && s.sheet_name.includes('2026'));

  assert(marWater, 'March 2026 water statement exists');
  assert(marMaint, 'March 2026 maintenance statement exists');

  assert.strictEqual(marWater.tanker_bill, 12600.0, 'March tanker bill must be 12,600');
  assert.strictEqual(marWater.electricity_bill, 16124.0, 'March electricity bill must be 16,124');
  assert.strictEqual(marWater.net_electricity, 10124.0, 'Net power must be 16,124 - 6,000 = 10,124');
  assert.strictEqual(marWater.total_water_consumption_liters, 453676.0, 'Total water consumption must be 453,676 L');

  const f405Water = marWater.flats.find(f => f.flat === 405);
  const f405Maint = marMaint.flats.find(f => f.flat === 405);

  assert(f405Water && f405Maint, 'Flat 405 exists in March statements');
  assert.strictEqual(f405Water.opening_reading, 326455.0, 'Flat 405 opening reading baseline');
  assert.strictEqual(f405Water.closing_reading, 340831.0, 'Flat 405 closing reading');
  assert.strictEqual(f405Water.liters, 14376.0, 'Flat 405 consumed liters');
  assert.strictEqual(f405Water.mandatory_maintenance, 1400.0, 'Flat 405 base maintenance is 1400');
  assert.strictEqual(f405Water.water_charge, 720.07, 'Flat 405 water charge is 720.07 (~720)');
  assert.strictEqual(f405Water.actual_amount, 2120.07, 'Flat 405 total assessment is 2120.07 (~2120)');
  assert.strictEqual(f405Maint.actual, 2120.07, 'Flat 405 maintenance actual bill must match water actual amount');
  assert.strictEqual(f405Maint.paid, 2120.07, 'Flat 405 paid in full (2120.07)');
  assert.strictEqual(f405Maint.pending, 0.0, 'Flat 405 pending is 0');
});

// 14. FLAT 207 SEPTEMBER DUE AND OCTOBER ARREARS CASCADE
runTest('Flat 207 has September 2026 recorded as Due and carries into October 2026 as pending arrears', () => {
  const data = storage.getApartmentData();
  const sepMaint = data.maintenance_statements.find(s => s.sheet_name.includes('September') && s.sheet_name.includes('2026'));
  const octMaint = data.maintenance_statements.find(s => s.sheet_name.includes('October') && s.sheet_name.includes('2026'));
  const octWater = data.water_statements.find(s => s.sheet_name.includes('October') && s.sheet_name.includes('2026'));

  assert(sepMaint && octMaint && octWater, 'September and October statements exist');

  const f207Sep = sepMaint.flats.find(f => f.flat === 207);
  assert(f207Sep, 'Flat 207 exists in September');
  assert.strictEqual(f207Sep.actual, 2095.8, 'September actual bill is 2095.8 (~2096)');
  assert.strictEqual(f207Sep.paid, 0.0, 'September paid is 0');
  assert.strictEqual(f207Sep.pending, 2095.8, 'September pending is 2095.8 (~2096)');
  assert.strictEqual(f207Sep.status, 'Due', 'September status is Due');

  const sepWater = data.water_statements.find(s => s.sheet_name.includes('September') && s.sheet_name.includes('2026'));
  const f207SepW = sepWater.flats.find(f => f.flat === 207);
  assert.strictEqual(f207SepW.pending_amount, 0.0, 'September water pending_amount is 0 for all flats');
  assert.strictEqual(f207SepW.total_payable, 2095.8, 'September water total_payable is 2095.8');

  const f207Oct = octMaint.flats.find(f => f.flat === 207);
  assert(f207Oct, 'Flat 207 exists in October');
  assert.strictEqual(f207Oct.actual, 2235.22, 'October month assessment is 2235.22 (~2235)');
  assert.strictEqual(f207Oct.previous_pending, 2095.8, 'October carries previous pending arrears 2095.8 (~2096)');
  assert.strictEqual(f207Oct.total_payable, 4331.02, 'Total payable is 2235.22 + 2095.8 = 4331.02 (~4331)');
  assert.strictEqual(f207Oct.pending, 4331.02, 'Total pending in October is 4331.02');

  const f207OctW = octWater.flats.find(f => f.flat === 207);
  assert(f207OctW, 'Flat 207 exists in October Water');
  assert.strictEqual(f207OctW.pending_amount, 2095.8, 'October water pending_amount carries 2095.8 for Flat 207');
  assert.strictEqual(f207OctW.total_payable, 4331.02, 'October water total_payable is 4331.02');

  // Verify other 31 flats have pending_amount === 0 in October Water Statement
  const otherFlatsWithPending = octWater.flats.filter(f => f.flat !== 207 && f.pending_amount > 0);
  assert.strictEqual(otherFlatsWithPending.length, 0, 'No other flat should have pending in October water statement');
});

// 15. OCTOBER 2026 CALIBRATED BANK BALANCE AND LIQUID FUNDS
runTest('October 2026 initializes with Bank Balance = 78,156.04 and Total Liquid Funds = 78,000.00', () => {
  const data = storage.getApartmentData();
  const octMaint = data.maintenance_statements.find(s => s.sheet_name.includes('October') && s.sheet_name.includes('2026'));

  assert(octMaint, 'October maintenance statement exists');
  assert.strictEqual(octMaint.bank_balance, 78156.04, 'October bank balance must be 78,156.04');
  assert.strictEqual(octMaint.total_balance, 78000.00, 'October total liquid funds must be 78,000.00');
  assert.strictEqual(octMaint.cash_balance, -156.04, 'October cash in hand balance must be -156.04');
});

// 16. POSITIVE AND NEGATIVE BALANCE ADJUSTMENTS IN OPEN CYCLE
runTest('Admin can directly adjust Bank and Cash balances with positive and negative amounts in open cycles', () => {
  const dataBefore = storage.getApartmentData();
  const octMaintBefore = dataBefore.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const initialBank = octMaintBefore.bank_balance; // 78156.04
  const initialCash = octMaintBefore.cash_balance; // -156.04

  // 1. Add delta to Bank Balance (+500)
  storage.adjustAccountBalance('October 2026', 'Bank', {
    type: 'delta',
    amount: 500,
    reason: 'Bank interest added'
  });

  let octMaint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(octMaint.bank_balance, Math.round((initialBank + 500) * 100) / 100);
  assert.strictEqual(octMaint.total_balance, Math.round((octMaint.cash_balance + octMaint.bank_balance) * 100) / 100);

  // 2. Subtract delta from Cash in Hand (-1000)
  storage.adjustAccountBalance('October 2026', 'Cash', {
    type: 'delta',
    amount: -1000,
    reason: 'Petty cash adjustment'
  });

  octMaint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(octMaint.cash_balance, Math.round((initialCash - 1000) * 100) / 100);
  assert.strictEqual(octMaint.total_balance, Math.round((octMaint.cash_balance + octMaint.bank_balance) * 100) / 100);

  // 3. Set exact balance (e.g. set Bank to 80,000 and Cash to 2,000)
  storage.adjustAccountBalance('October 2026', 'Bank', {
    type: 'exact',
    amount: 80000,
    reason: 'Exact bank calibration'
  });
  storage.adjustAccountBalance('October 2026', 'Cash', {
    type: 'exact',
    amount: 2000,
    reason: 'Exact cash calibration'
  });

  octMaint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(octMaint.bank_balance, 80000);
  assert.strictEqual(octMaint.cash_balance, 2000);
  assert.strictEqual(octMaint.total_balance, 82000);

  // 4. Closed cycles block adjustments
  assert.throws(() => {
    storage.adjustAccountBalance('September Water 2026', 'Bank', {
      type: 'exact',
      amount: 50000
    });
  }, /locked legacy cycle/);
});

// 17. BILLED VS PAID EXPENSE ACCOUNTING
runTest('Billed expenses do not deduct Cash/Bank balances until marked as Paid', () => {
  const dataBefore = storage.getApartmentData();
  const octMaintBefore = dataBefore.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const initialCash = octMaintBefore.cash_balance;
  const initialBank = octMaintBefore.bank_balance;

  // 1. Add an expense in 'Billed' mode
  const withBilled = storage.addExpense('October 2026', {
    description: 'Lift AMC Invoice (Payable)',
    amount: 7500,
    category: 'Lift AMC',
    type: 'Bank',
    status: 'Billed',
    date: '2026-10-15'
  });

  let octMaint = withBilled.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const billedExp = octMaint.expenses.find(e => e.description === 'Lift AMC Invoice (Payable)');
  assert(billedExp, 'Billed expense must exist in statement expenses');
  assert.strictEqual(billedExp.status, 'Billed');

  // Verify Bank and Cash balance DID NOT decrease!
  assert.strictEqual(octMaint.bank_balance, initialBank, 'Bank balance must not be deducted for Billed expense');
  assert.strictEqual(octMaint.cash_balance, initialCash, 'Cash balance must not be deducted for Billed expense');

  // 2. Mark expense as 'Paid'
  const withPaid = storage.updateExpense('October 2026', billedExp.id, {
    ...billedExp,
    status: 'Paid',
    paid_date: '2026-10-25'
  });

  octMaint = withPaid.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const paidExp = octMaint.expenses.find(e => e.id === billedExp.id);
  assert.strictEqual(paidExp.status, 'Paid');

  // Verify Bank balance is NOW deducted by exactly 7500
  assert.strictEqual(octMaint.bank_balance, Math.round((initialBank - 7500) * 100) / 100);

  // 3. Delete expense restores the balance
  const withDeleted = storage.deleteExpense('October 2026', billedExp.id);
  octMaint = withDeleted.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(octMaint.bank_balance, initialBank, 'Bank balance restored upon deleting paid expense');
});

// 18. AUTH CREDENTIALS & SELF-SERVICE PASSWORDS
runTest('Flat owners can change password and admin can reset flat PIN to default', async () => {
  const auth = await import('../src/services/auth.ts');

  // Initial default PIN verification
  assert.strictEqual(auth.verifyFlatPin(101, '101'), true, 'Default PIN is flat number');
  assert.strictEqual(auth.verifyFlatPin(101, '1234'), true, 'Default fallback is 1234');

  // Flat 101 self-service password change
  auth.changeFlatPassword(101, 'mySecurePass99');
  assert.strictEqual(auth.verifyFlatPin(101, 'mySecurePass99'), true, 'Custom PIN verified');
  assert.strictEqual(auth.verifyFlatPin(101, 'wrongPass'), false, 'Wrong PIN rejected');

  // Admin resets Flat 101 PIN back to default
  auth.resetFlatPin(101);
  assert.strictEqual(auth.verifyFlatPin(101, '101'), true, 'PIN successfully reset to flat number');

  // Admin password change
  auth.changeAdminPassword('adminSuperSecret2026');
  assert.strictEqual(auth.verifyAdminPassword('adminSuperSecret2026'), true, 'Admin custom password verified');
  auth.changeAdminPassword('admin'); // restore default
});

// 19. STAFF LOANS & ADVANCES WITH CASH/BANK REPAYMENTS
runTest('Staff loan disbursal and ad-hoc cash/bank repayments correctly update loan and account balances', () => {
  const data = storage.getApartmentData();
  const octMaint = data.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const initialCash = octMaint.cash_balance;
  const initialBank = octMaint.bank_balance;

  // 1. Disburse a new staff loan to Watchman Laxman of ₹5,000 from Cash
  const withLoan = storage.addStaffLoan({
    borrower_name: 'Laxman (Building Watchman)',
    designation: 'Watchman',
    principal_amount: 5000,
    disbursed_channel: 'Cash',
    disbursed_date: '2026-10-10',
    disbursed_month_sheet: 'October 2026',
    notes: 'Festival emergency advance'
  });

  const createdLoan = withLoan.staff_loans.find(l => l.borrower_name.includes('Laxman (Building Watchman)'));
  assert(createdLoan, 'Staff loan record should exist');
  assert.strictEqual(createdLoan.principal_amount, 5000, 'Principal amount must be 5000');
  assert.strictEqual(createdLoan.status, 'Active', 'Loan should be active');

  const afterLoanMaint = withLoan.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(afterLoanMaint.cash_balance, initialCash - 5000, 'Cash balance should decrease by 5000 disbursal');

  // 2. Watchman repays ₹1,500 in Cash
  const withCashRepay = storage.addLoanRepayment(createdLoan.id, {
    amount: 1500,
    channel: 'Cash',
    date: '2026-10-20',
    monthSheet: 'October 2026',
    notes: 'First cash installment'
  });

  const updatedLoan1 = withCashRepay.staff_loans.find(l => l.id === createdLoan.id);
  const totalRepaid1 = updatedLoan1.repayments.reduce((sum, r) => sum + r.amount, 0);
  assert.strictEqual(totalRepaid1, 1500, 'Repaid should be 1500');
  assert.strictEqual(updatedLoan1.principal_amount - totalRepaid1, 3500, 'Remaining balance should be 3500');

  const afterCashRepayMaint = withCashRepay.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(afterCashRepayMaint.cash_balance, initialCash - 5000 + 1500, 'Cash balance should increase by 1500');

  // 3. Watchman repays ₹3,500 via Bank transfer (settling in full)
  const withBankRepay = storage.addLoanRepayment(createdLoan.id, {
    amount: 3500,
    channel: 'Bank',
    date: '2026-10-28',
    monthSheet: 'October 2026',
    notes: 'Final bank transfer'
  });

  const updatedLoan2 = withBankRepay.staff_loans.find(l => l.id === createdLoan.id);
  const totalRepaid2 = updatedLoan2.repayments.reduce((sum, r) => sum + r.amount, 0);
  assert.strictEqual(totalRepaid2, 5000, 'Total repaid should equal 5000 principal');
  assert.strictEqual(updatedLoan2.status, 'Settled', 'Loan status should automatically update to Settled');

  const afterBankRepayMaint = withBankRepay.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(afterBankRepayMaint.bank_balance, initialBank + 3500, 'Bank balance should increase by 3500 repayment');

  // 4. Reverting the ₹3,500 repayment restores balance and reopens loan status to Active
  const lastRepay = updatedLoan2.repayments.find(r => r.amount === 3500);
  const withReverted = storage.deleteLoanRepayment(createdLoan.id, lastRepay.id);
  const updatedLoan3 = withReverted.staff_loans.find(l => l.id === createdLoan.id);
  assert.strictEqual(updatedLoan3.status, 'Active', 'Loan status should revert to Active');
  assert.strictEqual(updatedLoan3.repayments.length, 1, 'Only 1 repayment should remain');

  const afterRevertedMaint = withReverted.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  assert.strictEqual(afterRevertedMaint.bank_balance, initialBank, 'Bank balance restored upon reverting repayment');
});

// 20. FLAT OVERPAYMENT & SIGNED ADVANCE (+/-) ROLLOVER DEDUCTION
runTest('Flat overpayment records signed advance credit and automatically reduces subsequent month total payable', () => {
  const data = storage.getApartmentData();
  const octMaint = data.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const f102 = octMaint.flats.find(f => f.flat === 102);
  const octBill = f102.actual; // e.g. 3161
  const payAmount = Math.round((octBill + 1000) * 100) / 100;

  // 1. Flat 102 overpays by exactly 1,000 extra via Online (e.g. paying bill + 1000)
  storage.recordFlatPayment('October 2026', 102, payAmount, 'Online', 'Paid bill plus 1000 advance', '2026-10-12');

  const afterPay = storage.getApartmentData();
  const octMaintAfter = afterPay.maintenance_statements.find(s => s.sheet_name === 'October 2026');
  const f102After = octMaintAfter.flats.find(f => f.flat === 102);

  assert.strictEqual(f102After.paid, payAmount);
  assert.strictEqual(f102After.pending, -1000, 'Pending must be signed negative (-1000) representing advance credit');
  assert.strictEqual(f102After.status, 'Advance', 'Status must be Advance');

  // 2. Cascade / Rollover into subsequent month (e.g. November 2026)
  // Ensure water statement is explicitly saved before closing
  const octWater = afterPay.water_statements.find(s => s.sheet_name === 'October 2026');
  storage.saveWaterStatement(octWater);

  // Close October with note and roll over into November
  const withClosed = storage.closeCycle('October 2026', 'Closed to verify advance rollover');
  const novMaint = withClosed.maintenance_statements.find(s => s.sheet_name === 'November 2026');
  const novWater = withClosed.water_statements.find(s => s.sheet_name === 'November 2026');

  assert(novMaint, 'November maintenance statement must exist');
  assert(novWater, 'November water statement must exist');

  const f102Nov = novMaint.flats.find(f => f.flat === 102);
  const f102NovWater = novWater.flats.find(f => f.flat === 102);

  assert.strictEqual(f102Nov.previous_pending, -1000, 'November carried-forward arrears must be -1000');
  assert.strictEqual(f102NovWater.pending_amount, -1000, 'November water statement pending_amount must be -1000');
  assert.strictEqual(f102Nov.total_payable, Math.round((f102Nov.actual + (-1000)) * 100) / 100, 'November total payable must be reduced by 1000 advance');
});

console.log(`\n--- Test Results: ${passedCount} passed, ${failedCount} failed ---\n`);
if (failedCount > 0) {
  process.exit(1);
}
