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

  // Cannot pay more than total payable
  assert.throws(() => {
    storage.recordFlatPayment('October 2026', 101, 500000, 'Online', 'Excess payment', '2026-10-15');
  }, /Payment cannot exceed the flat’s outstanding balance/);
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

  const f207Oct = octMaint.flats.find(f => f.flat === 207);
  assert(f207Oct, 'Flat 207 exists in October');
  assert.strictEqual(f207Oct.actual, 2235.22, 'October month assessment is 2235.22 (~2235)');
  assert.strictEqual(f207Oct.previous_pending, 2095.8, 'October carries previous pending arrears 2095.8 (~2096)');
  assert.strictEqual(f207Oct.total_payable, 4331.02, 'Total payable is 2235.22 + 2095.8 = 4331.02 (~4331)');
  assert.strictEqual(f207Oct.pending, 4331.02, 'Total pending in October is 4331.02');

  const f207OctW = octWater.flats.find(f => f.flat === 207);
  assert(f207OctW, 'Flat 207 exists in October Water');
  assert.strictEqual(f207OctW.pending_amount, 2095.8, 'October water pending_amount carries 2095.8');
  assert.strictEqual(f207OctW.total_payable, 4331.02, 'October water total_payable is 4331.02');
});

console.log(`\n--- Test Results: ${passedCount} passed, ${failedCount} failed ---\n`);
if (failedCount > 0) {
  process.exit(1);
}
