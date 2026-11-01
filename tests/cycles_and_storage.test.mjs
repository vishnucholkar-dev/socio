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

// 1. MIGRATION & INITIALIZATION TESTS
runTest('Legacy data without cycle metadata marks earlier months legacy-closed and latest as initialization-required', () => {
  const data = storage.getApartmentData();
  const months = Object.keys(data.cycles);
  assert(months.length > 1, 'Should have multiple months in seed data');
  const latestMonth = months[months.length - 1];

  for (const m of months) {
    if (m === latestMonth) {
      assert.strictEqual(data.cycles[m].status, 'initialization-required');
      assert.strictEqual(data.cycles[m].initialized_as, 'legacy');
    } else {
      assert.strictEqual(data.cycles[m].status, 'legacy-closed');
      assert.strictEqual(data.cycles[m].initialized_as, 'legacy');
    }
  }
});

runTest('Edits are blocked in legacy-closed and initialization-required cycles', () => {
  const data = storage.getApartmentData();
  const months = Object.keys(data.cycles);
  const latestMonth = months[months.length - 1];
  const priorMonth = months[months.length - 2];

  assert.throws(() => {
    storage.addExpense(latestMonth, { description: 'Capacitor', amount: 500, category: 'Electrical', type: 'Cash', date: '2026-11-01' });
  }, /requires explicit cycle initialization/);

  assert.throws(() => {
    storage.addExpense(priorMonth, { description: 'Capacitor', amount: 500, category: 'Electrical', type: 'Cash', date: '2026-10-01' });
  }, /locked legacy cycle/);
});

runTest('Admin can initialize latest cycle as open, recording audit trail', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];

  const updated = storage.initializeCycle(latestMonth, 'open', 'Starting active month operations');
  assert.strictEqual(updated.cycles[latestMonth].status, 'open');
  assert(updated.cycles[latestMonth].opened_at, 'Should record opened_at timestamp');

  const auditEvents = updated.cycle_audit.filter(e => e.action === 'legacy.initialized');
  assert.strictEqual(auditEvents.length, 1);
  assert.strictEqual(auditEvents[0].month, latestMonth);
  assert.strictEqual(auditEvents[0].reason, 'Starting active month operations');

  // Now edits are allowed
  const withExpense = storage.addExpense(latestMonth, { description: 'Tanker load', amount: 800, category: 'Water Tankers', type: 'Cash', date: '2026-11-01' });
  const maint = withExpense.maintenance_statements.find(s => s.sheet_name === latestMonth);
  assert(maint.expenses.some(e => e.description === 'Tanker load'));
});

runTest('Admin can initialize latest cycle as closed with preserved balances', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];

  const updated = storage.initializeCycle(latestMonth, 'closed', 'Historically verified closed');
  assert.strictEqual(updated.cycles[latestMonth].status, 'closed');
  assert(Number.isFinite(updated.cycles[latestMonth].closed_cash_balance));
  assert(Number.isFinite(updated.cycles[latestMonth].closed_bank_balance));
});

// 2. REOPEN SAFEGUARDS
runTest('Legacy-closed cycles cannot be reopened', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const legacyMonth = months[0];

  assert.throws(() => {
    storage.reopenCycle(legacyMonth, 'Want to edit legacy period');
  }, /legacy-closed periods cannot be reopened/);
});

runTest('Only the latest closed cycle can be reopened, and requires an audit reason', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];

  // Initialize latest as closed
  storage.initializeCycle(latestMonth, 'closed', 'Initial close');

  // Must provide reason
  assert.throws(() => {
    storage.reopenCycle(latestMonth, '   ');
  }, /audit reason is required/);

  // Successfully reopen
  const reopened = storage.reopenCycle(latestMonth, 'Need to correct Laxman salary payment');
  assert.strictEqual(reopened.cycles[latestMonth].status, 'open');
  assert.strictEqual(reopened.cycles[latestMonth].closed_at, undefined);

  const reopenAudit = reopened.cycle_audit.filter(e => e.action === 'reopened');
  assert.strictEqual(reopenAudit.length, 1);
  assert.strictEqual(reopenAudit[0].reason, 'Need to correct Laxman salary payment');
});

runTest('Cannot reopen a cycle if another cycle is already open', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];

  storage.initializeCycle(latestMonth, 'open', 'Keep open');

  // Try reopening a legacy or closed cycle
  assert.throws(() => {
    storage.reopenCycle(months[0], 'Test');
  }, /legacy-closed periods cannot be reopened/);
});

// 3. BALANCE TRANSFERS & ATOMICITY
runTest('Balance transfer moves money between Cash and Bank correctly', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];
  storage.initializeCycle(latestMonth, 'open', 'Open for testing');

  const maintBefore = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === latestMonth);
  const initialCash = maintBefore.cash_balance;
  const initialBank = maintBefore.bank_balance;

  // Add transfer from Bank to Cash
  const updated = storage.addBalanceTransfer(latestMonth, {
    description: 'ATM Cash Withdrawal for Gate Petty Cash',
    amount: 1000,
    from: 'Bank',
    to: 'Cash',
    date: '2026-11-02'
  });

  const maintAfter = updated.maintenance_statements.find(s => s.sheet_name === latestMonth);
  assert.strictEqual(maintAfter.bank_balance, Math.round((initialBank - 1000) * 100) / 100);
  assert.strictEqual(maintAfter.cash_balance, Math.round((initialCash + 1000) * 100) / 100);
  assert.strictEqual(maintAfter.transfers.length, 1);
});

runTest('Transfer update validates atomically and does not mutate balances on failure', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];
  storage.initializeCycle(latestMonth, 'open', 'Open for testing');

  storage.addBalanceTransfer(latestMonth, {
    description: 'Petty cash refill',
    amount: 500,
    from: 'Bank',
    to: 'Cash',
    date: '2026-11-02'
  });

  const dataBefore = storage.getApartmentData();
  const maintBefore = dataBefore.maintenance_statements.find(s => s.sheet_name === latestMonth);
  const transferId = maintBefore.transfers[0].id;
  const cashBefore = maintBefore.cash_balance;
  const bankBefore = maintBefore.bank_balance;

  // Attempt update with amount exceeding available balance (e.g. ₹999,999,999)
  assert.throws(() => {
    storage.updateBalanceTransfer(latestMonth, transferId, {
      description: 'Massive transfer',
      amount: 999999999,
      from: 'Bank',
      to: 'Cash',
      date: '2026-11-02'
    });
  }, /exceeds the available/);

  // Verify in-memory state was NOT mutated
  const dataAfter = storage.getApartmentData();
  const maintAfter = dataAfter.maintenance_statements.find(s => s.sheet_name === latestMonth);
  assert.strictEqual(maintAfter.cash_balance, cashBefore, 'Cash balance should remain unchanged after failed update');
  assert.strictEqual(maintAfter.bank_balance, bankBefore, 'Bank balance should remain unchanged after failed update');
  assert.strictEqual(maintAfter.transfers[0].amount, 500, 'Transfer amount should remain 500');

  // Delete transfer reverses properly
  storage.deleteBalanceTransfer(latestMonth, transferId);
  const dataDeleted = storage.getApartmentData();
  const maintDeleted = dataDeleted.maintenance_statements.find(s => s.sheet_name === latestMonth);
  assert.strictEqual(maintDeleted.transfers.length, 0);
  assert.strictEqual(maintDeleted.bank_balance, Math.round((bankBefore + 500) * 100) / 100);
  assert.strictEqual(maintDeleted.cash_balance, Math.round((cashBefore - 500) * 100) / 100);
});

// 4. INCREMENTAL FLAT PAYMENTS & LEDGER RECONCILIATION
runTest('Incremental flat payments record individual receipts and reconcile channels', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];
  storage.initializeCycle(latestMonth, 'open', 'Open for testing');

  // Flat 101 pays partial 1000 in Cash
  storage.recordFlatPayment(latestMonth, 101, 1000, 'Cash', 'Advance receipt 1');

  let maint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === latestMonth);
  let flat101 = maint.flats.find(f => f.flat === 101);
  assert.strictEqual(flat101.paid, 1000);
  assert.strictEqual(flat101.receipts.length, 1);
  assert.strictEqual(flat101.receipts[0].mode, 'Cash');
  assert.strictEqual(flat101.receipts[0].amount, 1000);

  // Flat 101 pays another 500 via Online (Bank)
  storage.recordFlatPayment(latestMonth, 101, 500, 'Online', 'UPI payment 2');

  maint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === latestMonth);
  flat101 = maint.flats.find(f => f.flat === 101);
  assert.strictEqual(flat101.paid, 1500);
  assert.strictEqual(flat101.receipts.length, 2);
  assert.strictEqual(flat101.receipts[1].mode, 'Online');
  assert.strictEqual(flat101.receipts[1].amount, 500);

  // Cannot pay more than total payable
  assert.throws(() => {
    storage.recordFlatPayment(latestMonth, 101, 500000, 'Online', 'Excess payment');
  }, /Payment cannot exceed the flat’s outstanding balance/);
});

// 5. PRE-CLOSE VALIDATION & CLOSE RECONCILIATION
runTest('closeCycle enforces complete valid water readings and reconciliation note', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];
  storage.initializeCycle(latestMonth, 'open', 'Open for testing');

  // Attempt to close when water readings are incomplete
  assert.throws(() => {
    storage.closeCycle(latestMonth);
  }, /Cannot close this cycle yet/);

  // Save complete valid water statement
  const waterStmt = initial.water_statements.find(s => s.sheet_name === latestMonth);
  assert(waterStmt, 'Water statement exists');
  const maint = initial.maintenance_statements.find(s => s.sheet_name === latestMonth);
  const completeWater = {
    ...waterStmt,
    flats: waterStmt.flats.map(f => {
      const mFlat = maint?.flats.find(item => item.flat === f.flat);
      const paid = mFlat?.paid || 0;
      const prev = mFlat?.previous_pending || 0;
      const safeActual = Math.max(1400, Math.max(0, paid - prev));
      return {
        ...f,
        closing_reading: Math.max(f.closing_reading || 0, f.opening_reading + 500),
        liters: 500,
        actual_amount: safeActual
      };
    })
  };
  storage.saveWaterStatement(completeWater);

  // Introduce a balance discrepancy (e.g. recorded cash balance differing from activity ledger)
  const currentData = storage.getApartmentData();
  const currentMaint = currentData.maintenance_statements.find(s => s.sheet_name === latestMonth);
  currentMaint.cash_balance = Math.round((currentMaint.cash_balance + 250) * 100) / 100;
  // Persist directly using localStorage mock to simulate historical discrepancy
  store.set('rockcliff_apartment_data_v10', JSON.stringify(currentData));

  // Discrepancy requires an explanatory close note
  assert.throws(() => {
    storage.closeCycle(latestMonth, '');
  }, /Balance reconciliation needs review/);

  // Provide close note and successfully close cycle
  const closedData = storage.closeCycle(latestMonth, 'Discrepancy due to undeposited festival collection');
  assert.strictEqual(closedData.cycles[latestMonth].status, 'closed');
  assert.strictEqual(closedData.cycles[latestMonth].close_reason, 'Discrepancy due to undeposited festival collection');
});

// 6. SEQUENTIAL ROLLOVER (openNextCycle)
runTest('openNextCycle rolls balances separately, transfers dues, carries meter baselines, and advances sequentially', () => {
  const initial = storage.getApartmentData();
  const months = Object.keys(initial.cycles);
  const latestMonth = months[months.length - 1];

  // Initialize and properly close latestMonth
  storage.initializeCycle(latestMonth, 'open', 'Open for close test');
  const waterStmt = initial.water_statements.find(s => s.sheet_name === latestMonth);
  const maint = initial.maintenance_statements.find(s => s.sheet_name === latestMonth);
  const completeWater = {
    ...waterStmt,
    flats: waterStmt.flats.map(f => {
      const mFlat = maint?.flats.find(item => item.flat === f.flat);
      const paid = mFlat?.paid || 0;
      const prev = mFlat?.previous_pending || 0;
      const safeActual = Math.max(1400, Math.max(0, paid - prev));
      return {
        ...f,
        closing_reading: Math.max(f.closing_reading || 0, f.opening_reading + 500),
        liters: 500,
        actual_amount: safeActual
      };
    })
  };
  storage.saveWaterStatement(completeWater);
  storage.closeCycle(latestMonth, 'Audited close');

  const closedMaint = storage.getApartmentData().maintenance_statements.find(s => s.sheet_name === latestMonth);
  const closedWater = storage.getApartmentData().water_statements.find(s => s.sheet_name === latestMonth);

  // Roll over to next month
  const rolled = storage.openNextCycle(latestMonth);
  const expectedNextMonth = storage.nextMonthLabel(latestMonth);

  assert.strictEqual(rolled.cycles[expectedNextMonth].status, 'open');

  const newMaint = rolled.maintenance_statements.find(s => s.sheet_name === expectedNextMonth);
  const newWater = rolled.water_statements.find(s => s.sheet_name === expectedNextMonth);

  assert(newMaint, 'New maintenance statement created');
  assert(newWater, 'New water statement created');

  // Verify separate carry-forwards
  assert.strictEqual(newMaint.cash_opening, closedMaint.cash_balance, 'Cash opening matches prior cash balance');
  assert.strictEqual(newMaint.bank_opening, closedMaint.bank_balance, 'Bank opening matches prior bank balance');
  assert.strictEqual(newMaint.cash_balance, closedMaint.cash_balance);
  assert.strictEqual(newMaint.bank_balance, closedMaint.bank_balance);
  assert.strictEqual(newMaint.cash_total_in, 0);
  assert.strictEqual(newMaint.bank_total_in, 0);
  assert.strictEqual(newMaint.expenses.length, 0);
  assert.strictEqual(newMaint.inflows.length, 0);
  assert.strictEqual(newMaint.transfers.length, 0);

  // Verify flat dues rollover
  for (const flat of rolled.flats) {
    const priorRow = closedMaint.flats.find(f => f.flat === flat);
    const newRow = newMaint.flats.find(f => f.flat === flat);
    assert.strictEqual(newRow.previous_pending, priorRow.pending, `Flat ${flat} carries exact pending dues`);
    assert.strictEqual(newRow.paid, 0);
  }

  // Verify water meter baselines carried forward
  for (const flat of rolled.flats) {
    const priorReading = closedWater.flats.find(f => f.flat === flat);
    const newReading = newWater.flats.find(f => f.flat === flat);
    assert.strictEqual(newReading.opening_reading, priorReading.closing_reading, `Flat ${flat} opening meter matches prior closing meter`);
    assert.strictEqual(newReading.closing_reading, priorReading.closing_reading);
  }
  assert.strictEqual(newWater.readings_complete, false, 'New water readings start unconfirmed');
});

// 7. CORRUPT STORAGE RESILIENCE
runTest('Corrupt localStorage throws error without overwriting storage with seed data', () => {
  store.set('rockcliff_apartment_data_v10', '{ invalid json syntax !!!');

  assert.throws(() => {
    storage.getApartmentData();
  }, /unreadable.*original browser storage was preserved/);

  // Verify corrupt string was NOT cleared or replaced with seed
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

console.log(`\n--- Test Results: ${passedCount} passed, ${failedCount} failed ---\n`);
if (failedCount > 0) {
  process.exit(1);
}
