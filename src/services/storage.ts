import type {
  ApartmentData, BalanceTransfer, BillingConfigEntry, CycleAuditEvent, CycleState,
  DirectoryContact, ExpenseItem, InflowItem, MaintenanceStatement, PaymentChannel, PaymentMode, WaterStatement
} from '../types/apartment';
import seedData from '../data/apartment_seed.json';
import { DEFAULT_CONTACTS } from '../data/default_contacts';
import { DEFAULT_BILLING_CONFIG_HISTORY } from '../data/default_config';

// Preserve the live app's existing key. Do not bump this during migration or deployment.
const STORAGE_KEY = 'rockcliff_apartment_data_v10';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function monthDate(label: string): Date | null {
  const match = label.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b.*?\b(\d{4})\b/i);
  if (!match) return null;
  const parsed = new Date(`${match[1]} 1, ${match[2]} 00:00:00 UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function canonicalMonthLabel(label: string): string | null {
  const date = monthDate(label);
  return date ? `${date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${date.getUTCFullYear()}` : null;
}

export function sameCalendarMonth(left: string, right: string): boolean {
  const a = canonicalMonthLabel(left);
  return a !== null && a === canonicalMonthLabel(right);
}

export function monthSortKey(label: string): number {
  return monthDate(label)?.getTime() ?? Number.MIN_SAFE_INTEGER;
}

function assertUniqueStatementMonths(items: Array<{ sheet_name: string }>, kind: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = canonicalMonthLabel(item.sheet_name) || item.sheet_name.trim().toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate ${kind} statements exist for ${key}. Existing browser data was preserved; resolve duplicate months before continuing.`);
    seen.add(key);
  }
}

export function nextMonthLabel(label: string): string {
  const date = monthDate(label);
  if (!date) throw new Error(`Cannot determine the next calendar month from “${label}”.`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${date.getUTCFullYear()}`;
}

function audit(data: ApartmentData, event: Omit<CycleAuditEvent, 'id' | 'occurred_at' | 'actor'>): void {
  data.cycle_audit = data.cycle_audit || [];
  data.cycle_audit.push({ id: makeId('audit'), occurred_at: now(), actor: 'Local app user (client-side role)', ...event });
}

function normalizeData(input: ApartmentData): { data: ApartmentData; changed: boolean } {
  const data = input;
  let changed = false;
  if (!Array.isArray(data.cycle_audit)) { data.cycle_audit = []; changed = true; }
  if (!Array.isArray(data.billing_config_history)) { data.billing_config_history = DEFAULT_BILLING_CONFIG_HISTORY; changed = true; }
  if (!Array.isArray(data.contacts)) { data.contacts = DEFAULT_CONTACTS; changed = true; }
  if (!Array.isArray(data.maintenance_statements)) { data.maintenance_statements = []; changed = true; }
  if (!Array.isArray(data.water_statements)) { data.water_statements = []; changed = true; }
  // Empty arrays are intentional user data (e.g. all contacts deleted), never replace them with defaults.

  const labels = Array.from(new Set([
    ...data.maintenance_statements.map(statement => canonicalMonthLabel(statement.sheet_name) || statement.sheet_name),
    ...data.water_statements.map(statement => canonicalMonthLabel(statement.sheet_name) || statement.sheet_name)
  ])).sort((a, b) => monthSortKey(a) - monthSortKey(b));
  const hadCycleMap = Boolean(data.cycles && typeof data.cycles === 'object');
  const originalCycles = hadCycleMap ? data.cycles! : {};
  const normalizedCycles: NonNullable<ApartmentData['cycles']> = {};
  for (const [label, state] of Object.entries(originalCycles)) {
    const canonical = canonicalMonthLabel(label) || label;
    if (Object.prototype.hasOwnProperty.call(normalizedCycles, canonical)) {
      throw new Error(`Duplicate cycle metadata exists for ${canonical}. Existing values were preserved; resolve duplicate month labels before continuing.`);
    }
    normalizedCycles[canonical] = state;
    if (canonical !== label) changed = true;
  }
  data.cycles = normalizedCycles;
  if (!hadCycleMap) changed = true;
  const latest = labels[labels.length - 1];
  const present = new Set(labels);
  const cycleEntries = Object.entries(data.cycles);
  const openEntries = cycleEntries.filter(([, state]) => state.status === 'open');
  if (openEntries.length > 1) throw new Error('Multiple cycles are marked open. Existing browser data was preserved; resolve cycle status before continuing.');
  if (openEntries.length === 1 && present.has(openEntries[0][0]) && openEntries[0][0] !== latest) throw new Error('An earlier cycle is open while later statement data exists. Existing browser data was preserved; reconcile cycle ordering before continuing.');
  for (const label of labels) {
    if (!data.cycles[label]) {
      const isLegacy = label !== latest;
      data.cycles[label] = isLegacy
        ? { status: 'legacy-closed', initialized_as: 'legacy' }
        : { status: 'initialization-required', initialized_as: 'legacy' };
      changed = true;
    }
  }
  for (const statement of data.maintenance_statements) {
    if (!Array.isArray(statement.expenses)) { statement.expenses = []; changed = true; }
    if (!Array.isArray(statement.inflows)) { statement.inflows = []; changed = true; }
    if (!Array.isArray(statement.transfers)) { statement.transfers = []; changed = true; }
    if (!Array.isArray(statement.dues_list)) { statement.dues_list = []; changed = true; }
  }
  assertUniqueStatementMonths(data.maintenance_statements, 'maintenance');
  assertUniqueStatementMonths(data.water_statements, 'water');
  return { data, changed };
}

function persist(data: ApartmentData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('apartment-data-changed', { detail: data }));
}

export function getApartmentData(): ApartmentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let parsed: ApartmentData;
      try { parsed = JSON.parse(raw) as ApartmentData; }
      catch { throw new Error('The saved apartment data is unreadable. The original browser storage was preserved and was not replaced with seed data.'); }
      if (!parsed || !Array.isArray(parsed.water_statements) || !Array.isArray(parsed.maintenance_statements)) {
        throw new Error('The saved apartment data has an unsupported shape. The original browser storage was preserved.');
      }
      const normalized = normalizeData(parsed);
      if (normalized.changed) persist(normalized.data);
      return normalized.data;
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('saved apartment data') || err.message.includes('Existing browser data was preserved') || err.message.includes('Existing values were preserved'))) throw err;
    console.error('Unable to access existing apartment localStorage; no seed fallback was written.', err);
    throw new Error('Unable to access existing apartment browser storage. No seed data was written.');
  }

  // First-run fallback only: an existing saved value is never replaced with seed data.
  const initialData: ApartmentData = {
    apartment_name: seedData.apartment_name || "Rockcliff 'B' Block",
    total_flats: seedData.total_flats || 32,
    flats: seedData.flats || [],
    water_statements: seedData.water_statements as unknown as WaterStatement[],
    maintenance_statements: seedData.maintenance_statements as unknown as MaintenanceStatement[],
    contacts: DEFAULT_CONTACTS,
    billing_config_history: DEFAULT_BILLING_CONFIG_HISTORY,
    cycles: {},
    extracted_at: seedData.extracted_at || now()
  };
  const normalized = normalizeData(initialData);
  persist(normalized.data);
  return normalized.data;
}

/** Generic saves may update non-month data only. Month-scoped writes must use guarded operations below. */
export function saveApartmentData(data: ApartmentData): void {
  const current = getApartmentData();
  assertUniqueStatementMonths(data.maintenance_statements, 'maintenance');
  assertUniqueStatementMonths(data.water_statements, 'water');
  for (const oldStatement of current.maintenance_statements) {
    const next = data.maintenance_statements.find(item => sameCalendarMonth(item.sheet_name, oldStatement.sheet_name));
    if (!next) throw new Error('Existing monthly statements cannot be deleted through a generic save.');
    if (JSON.stringify(oldStatement) !== JSON.stringify(next)) assertCycleOpen(current, oldStatement.sheet_name);
  }
  for (const next of data.maintenance_statements) {
    if (!current.maintenance_statements.some(item => sameCalendarMonth(item.sheet_name, next.sheet_name))) throw new Error('New cycles must be created through the sequential open-next-cycle action.');
  }
  for (const oldStatement of current.water_statements) {
    const next = data.water_statements.find(item => sameCalendarMonth(item.sheet_name, oldStatement.sheet_name));
    if (!next) throw new Error('Existing monthly water statements cannot be deleted through a generic save.');
    if (JSON.stringify(oldStatement) !== JSON.stringify(next)) assertCycleOpen(current, oldStatement.sheet_name);
  }
  for (const next of data.water_statements) {
    if (!current.water_statements.some(item => sameCalendarMonth(item.sheet_name, next.sheet_name))) throw new Error('New water statements must be created through the sequential open-next-cycle action.');
  }
  if (JSON.stringify(current.cycles) !== JSON.stringify(data.cycles)) {
    throw new Error('Cycle status can only be changed through cycle-management actions.');
  }
  persist(data);
}

/**
 * Explicit first-run seed initializer only; not safe for resetting a live apartment.
 * Kept for backward compatibility with older integrations, but intentionally refuses to overwrite any saved data.
 */
export function resetToExcelSeed(): ApartmentData {
  if (localStorage.getItem(STORAGE_KEY) !== null) throw new Error('Seed initialization is disabled when apartment data already exists. Existing data was preserved.');
  const resetData: ApartmentData = {
    apartment_name: seedData.apartment_name || "Rockcliff 'B' Block",
    total_flats: seedData.total_flats || 32,
    flats: seedData.flats || [],
    water_statements: seedData.water_statements as unknown as WaterStatement[],
    maintenance_statements: seedData.maintenance_statements as unknown as MaintenanceStatement[],
    contacts: DEFAULT_CONTACTS,
    billing_config_history: DEFAULT_BILLING_CONFIG_HISTORY,
    cycles: {},
    extracted_at: seedData.extracted_at || now()
  };
  persist(normalizeData(resetData).data);
  return resetData;
}

export function addBillingConfig(entry: Omit<BillingConfigEntry, 'id' | 'changed_at'>): ApartmentData {
  const data = getApartmentData();
  const created = { ...entry, id: makeId('cfg'), changed_at: now() };
  data.billing_config_history.push(created);
  audit(data, { month: entry.effective_from, action: 'config.created', record_id: created.id, after: { ...created } });
  persist(data);
  return data;
}

export function getLatestBillingConfig(): BillingConfigEntry {
  const data = getApartmentData();
  return data.billing_config_history[data.billing_config_history.length - 1] || DEFAULT_BILLING_CONFIG_HISTORY[DEFAULT_BILLING_CONFIG_HISTORY.length - 1];
}

function assertCycleOpen(data: ApartmentData, month: string): CycleState {
  const cycleLabel = Object.keys(data.cycles || {}).find(label => sameCalendarMonth(label, month));
  const state = cycleLabel ? data.cycles?.[cycleLabel] : undefined;
  if (!state || state.status !== 'open') {
    if (state?.status === 'initialization-required') {
      throw new Error(`“${month}” requires explicit cycle initialization by an administrator before edits are allowed.`);
    }
    throw new Error(`“${month}” is ${state?.status === 'legacy-closed' ? 'a locked legacy cycle' : 'closed'}. Reopen it with an audited admin action before editing.`);
  }
  return state;
}

function getMaintenance(data: ApartmentData, month: string): MaintenanceStatement {
  const matches = data.maintenance_statements.filter(item => sameCalendarMonth(item.sheet_name, month));
  if (matches.length !== 1) throw new Error(matches.length ? `Multiple maintenance statements exist for ${month}; resolve duplicates before editing.` : `No maintenance statement exists for ${month}.`);
  return matches[0];
}

function changeBalance(m: MaintenanceStatement, channel: 'Cash' | 'Bank', inflowDelta: number, outflowDelta: number): void {
  const inflowKey = channel === 'Cash' ? 'cash_total_in' : 'bank_total_in';
  const outflowKey = channel === 'Cash' ? 'cash_total_out' : 'bank_total_out';
  const balanceKey = channel === 'Cash' ? 'cash_balance' : 'bank_balance';
  m[inflowKey] = money((m[inflowKey] || 0) + inflowDelta);
  m[outflowKey] = money((m[outflowKey] || 0) + outflowDelta);
  m[balanceKey] = money((m[balanceKey] || 0) + inflowDelta - outflowDelta);
  m.total_balance = money((m.cash_balance || 0) + (m.bank_balance || 0));
}

export function recordFlatPayment(monthSheet: string, flatNumber: number, paidAmount: number, mode: PaymentChannel, notes?: string): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, monthSheet);
  if (typeof mode !== 'string' || (mode !== 'Cash' && mode !== 'Online' && mode !== 'Bank')) throw new Error('Choose Cash, Online, or Bank for the payment channel.');
  if (typeof flatNumber !== 'number' || !Number.isFinite(flatNumber) || !Number.isFinite(paidAmount) || paidAmount < 0) throw new Error('Flat number and payment must be valid; payment must be non-negative.');
  const m = getMaintenance(data, monthSheet);
  const flat = m.flats.find(item => item.flat === flatNumber);
  if (!flat) throw new Error(`Flat ${flatNumber} is not present in ${monthSheet}.`);
  const payable = flat.total_payable ?? (flat.actual + (flat.previous_pending || 0));
  const currentPaid = money(flat.paid || 0);
  const currentPending = money(flat.pending ?? Math.max(0, payable - currentPaid));
  if (paidAmount > currentPending + 0.01) throw new Error('Payment cannot exceed the flat’s outstanding balance.');
  const before = { ...flat };
  // Legacy rows have only an aggregate paid amount/channel. Preserve it as a channel allocation
  // without inventing an old receipt date, then append this newly recorded incremental receipt.
  const receipts = flat.receipts ? [...flat.receipts] : currentPaid > 0
    ? [{ id: makeId('legacy-receipt'), amount: currentPaid, mode: (flat.mode === 'Cash' ? 'Cash' : flat.mode === 'Bank' ? 'Bank' : 'Online') as PaymentChannel }]
    : [];
  const newChannel: 'Cash' | 'Bank' | null = paidAmount === 0 ? null : mode === 'Cash' ? 'Cash' : 'Bank';
  if (newChannel) changeBalance(m, newChannel, paidAmount, 0);
  if (paidAmount > 0) receipts.push({ id: makeId('receipt'), amount: money(paidAmount), mode, date: new Date().toISOString().split('T')[0], ...(notes !== undefined ? { notes } : {}) });
  flat.receipts = receipts;
  flat.paid = money(currentPaid + paidAmount);
  flat.pending = money(Math.max(0, payable - flat.paid));
  flat.mode = flat.paid === 0 ? 'Due' : mode;
  flat.status = flat.pending <= 1 ? 'Paid' : (flat.paid > 0 ? 'Partial' : 'Due');
  if (paidAmount > 0) flat.payment_date = new Date().toISOString().split('T')[0];
  if (notes !== undefined) flat.notes = notes;
  audit(data, { month: monthSheet, action: 'payment.updated', record_id: String(flatNumber), before, after: { ...flat } });
  persist(data);
  return data;
}

export function addExpense(monthSheet: string, expense: ExpenseItem): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, monthSheet);
  if (!expense.description.trim() || !Number.isFinite(expense.amount) || expense.amount <= 0) throw new Error('Expense description and a positive amount are required.');
  if (expense.type !== undefined && expense.type !== 'Cash' && expense.type !== 'Bank') throw new Error('Expense channel must be Cash or Bank.');
  const m = getMaintenance(data, monthSheet);
  const channel: 'Cash' | 'Bank' = expense.type || 'Cash';
  const created = { ...expense, type: channel, id: expense.id || makeId('exp'), amount: money(expense.amount) };
  m.expenses.push(created);
  changeBalance(m, created.type || 'Cash', 0, created.amount);
  audit(data, { month: monthSheet, action: 'expense.created', record_id: created.id, after: { ...created } });
  persist(data);
  return data;
}

function locateExpense(m: MaintenanceStatement, id: string): number {
  return m.expenses.findIndex((item, index) => item.id === id || (!item.id && `legacy-exp-${index}` === id));
}

export function updateExpense(month: string, id: string, next: ExpenseItem): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  if (!next.description.trim() || !Number.isFinite(next.amount) || next.amount <= 0) throw new Error('Expense description and a positive amount are required.');
  if (next.type !== undefined && next.type !== 'Cash' && next.type !== 'Bank') throw new Error('Expense channel must be Cash or Bank.');
  const m = getMaintenance(data, month);
  const index = locateExpense(m, id);
  if (index < 0) throw new Error('Expense was not found; reload the statement and try again.');
  const before = { ...m.expenses[index] };
  changeBalance(m, before.type || 'Cash', 0, -before.amount);
  const updated = { ...next, id: before.id || makeId('exp'), amount: money(next.amount) };
  m.expenses[index] = updated;
  changeBalance(m, updated.type || 'Cash', 0, updated.amount);
  audit(data, { month, action: 'expense.updated', record_id: updated.id, before, after: { ...updated } });
  persist(data);
  return data;
}

export function deleteExpense(month: string, id: string): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  const m = getMaintenance(data, month);
  const index = locateExpense(m, id);
  if (index < 0) throw new Error('Expense was not found; reload the statement and try again.');
  const before = { ...m.expenses[index] };
  changeBalance(m, before.type || 'Cash', 0, -before.amount);
  m.expenses.splice(index, 1);
  audit(data, { month, action: 'expense.deleted', record_id: before.id, before, after: null });
  persist(data);
  return data;
}

export function addInflow(month: string, inflow: InflowItem): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  if (!inflow.description.trim() || !Number.isFinite(inflow.amount) || inflow.amount <= 0) throw new Error('Inflow description and a positive amount are required.');
  if (inflow.type !== undefined && inflow.type !== 'Cash' && inflow.type !== 'Bank') throw new Error('Inflow channel must be Cash or Bank.');
  const m = getMaintenance(data, month);
  const created = { ...inflow, id: inflow.id || makeId('in'), amount: money(inflow.amount), type: inflow.type || 'Cash' };
  m.inflows.push(created);
  changeBalance(m, created.type, created.amount, 0);
  audit(data, { month, action: 'inflow.created', record_id: created.id, after: { ...created } });
  persist(data);
  return data;
}

export function updateInflow(month: string, id: string, next: InflowItem): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  if (!next.description.trim() || !Number.isFinite(next.amount) || next.amount <= 0) throw new Error('Inflow description and a positive amount are required.');
  if (next.type !== undefined && next.type !== 'Cash' && next.type !== 'Bank') throw new Error('Inflow channel must be Cash or Bank.');
  const m = getMaintenance(data, month);
  const index = m.inflows.findIndex((item, i) => item.id === id || (!item.id && `legacy-in-${i}` === id));
  if (index < 0) throw new Error('Inflow was not found; reload the statement and try again.');
  const before = { ...m.inflows[index] };
  changeBalance(m, before.type || 'Cash', -before.amount, 0);
  const updated = { ...next, id: before.id || makeId('in'), amount: money(next.amount), type: next.type || 'Cash' };
  m.inflows[index] = updated;
  changeBalance(m, updated.type, updated.amount, 0);
  audit(data, { month, action: 'inflow.updated', record_id: updated.id, before, after: { ...updated } });
  persist(data);
  return data;
}

export function deleteInflow(month: string, id: string): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  const m = getMaintenance(data, month);
  const index = m.inflows.findIndex((item, i) => item.id === id || (!item.id && `legacy-in-${i}` === id));
  if (index < 0) throw new Error('Inflow was not found; reload the statement and try again.');
  const before = { ...m.inflows[index] };
  changeBalance(m, before.type || 'Cash', -before.amount, 0);
  m.inflows.splice(index, 1);
  audit(data, { month, action: 'inflow.deleted', record_id: before.id, before, after: null });
  persist(data);
  return data;
}

export function addBalanceTransfer(month: string, transfer: Omit<BalanceTransfer, 'id'>): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  if (!transfer.description.trim() || !Number.isFinite(transfer.amount) || transfer.amount <= 0 || (transfer.from !== 'Cash' && transfer.from !== 'Bank') || (transfer.to !== 'Cash' && transfer.to !== 'Bank') || transfer.from === transfer.to) {
    throw new Error('Transfer needs a description, a positive amount, and two different valid accounts.');
  }
  const m = getMaintenance(data, month);
  const created: BalanceTransfer = { ...transfer, id: makeId('transfer'), amount: money(transfer.amount) };
  m.transfers = m.transfers || [];
  const sourceBalance = created.from === 'Cash' ? m.cash_balance : m.bank_balance;
  if (created.amount > sourceBalance + 0.01) throw new Error(`Transfer exceeds the available ${created.from} balance (${money(sourceBalance).toFixed(2)}).`);
  m.transfers.push(created);
  changeBalance(m, created.from, 0, created.amount);
  changeBalance(m, created.to, created.amount, 0);
  audit(data, { month, action: 'transfer.created', record_id: created.id, after: { ...created } });
  persist(data);
  return data;
}

function locateTransfer(m: MaintenanceStatement, id: string): number {
  return (m.transfers || []).findIndex((item, index) => item.id === id || (!item.id && `legacy-transfer-${index}` === id));
}

export function updateBalanceTransfer(month: string, id: string, next: Omit<BalanceTransfer, 'id'>): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  if (!next.description.trim() || !Number.isFinite(next.amount) || next.amount <= 0 || (next.from !== 'Cash' && next.from !== 'Bank') || (next.to !== 'Cash' && next.to !== 'Bank') || next.from === next.to) {
    throw new Error('Transfer needs a description, a positive amount, and two different valid accounts.');
  }
  const m = getMaintenance(data, month);
  const index = locateTransfer(m, id);
  if (index < 0) throw new Error('Transfer was not found; reload the statement and try again.');
  const before = { ...m.transfers![index] };

  // Calculate hypothetical balances if the previous transfer is reversed, without mutating in-memory statement
  const reversedCash = money(m.cash_balance + (before.from === 'Cash' ? before.amount : -before.amount));
  const reversedBank = money(m.bank_balance + (before.from === 'Bank' ? before.amount : -before.amount));
  const availableInSource = next.from === 'Cash' ? reversedCash : reversedBank;

  if (next.amount > availableInSource + 0.01) {
    throw new Error(`Transfer exceeds the available ${next.from} balance (${money(availableInSource).toFixed(2)}).`);
  }

  // Safe to apply mutations now
  changeBalance(m, before.from, 0, -before.amount);
  changeBalance(m, before.to, -before.amount, 0);

  const updated: BalanceTransfer = { ...next, id: before.id || makeId('transfer'), amount: money(next.amount) };
  m.transfers![index] = updated;

  changeBalance(m, updated.from, 0, updated.amount);
  changeBalance(m, updated.to, updated.amount, 0);

  audit(data, { month, action: 'transfer.updated', record_id: updated.id, before, after: { ...updated } });
  persist(data);
  return data;
}

export function deleteBalanceTransfer(month: string, id: string): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  const m = getMaintenance(data, month);
  const index = locateTransfer(m, id);
  if (index < 0) throw new Error('Transfer was not found; reload the statement and try again.');
  const before = { ...m.transfers![index] };

  changeBalance(m, before.from, 0, -before.amount);
  changeBalance(m, before.to, -before.amount, 0);
  m.transfers!.splice(index, 1);

  audit(data, { month, action: 'transfer.deleted', record_id: before.id, before, after: null });
  persist(data);
  return data;
}

export function saveWaterStatement(statement: WaterStatement): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, statement.sheet_name);
  if (data.flats.some(flat => !statement.flats.some(item => item.flat === flat))) {
    throw new Error('Cannot save water readings until every apartment has an explicit meter reading.');
  }
  const seenFlats = new Set<number>();
  if (statement.flats.some(item => {
    if (seenFlats.has(item.flat)) return true;
    seenFlats.add(item.flat);
    return !data.flats.includes(item.flat) || !Number.isFinite(item.opening_reading) || !Number.isFinite(item.closing_reading) || item.opening_reading < 0 || item.closing_reading < item.opening_reading;
  }) || data.flats.some(flat => !seenFlats.has(flat))) {
    throw new Error('Each apartment must have exactly one valid, non-negative opening and closing meter reading before saving.');
  }
  const maintenanceMatches = data.maintenance_statements.filter(item => sameCalendarMonth(item.sheet_name, statement.sheet_name));
  if (maintenanceMatches.length > 1) throw new Error('Multiple maintenance statements exist for this calendar month; water billing was not saved.');
  const matchingWaterIndices = data.water_statements.map((item, position) => sameCalendarMonth(item.sheet_name, statement.sheet_name) ? position : -1).filter(position => position >= 0);
  if (matchingWaterIndices.length > 1) throw new Error('Multiple water statements exist for this calendar month; resolve duplicates before saving.');
  const index = matchingWaterIndices[0] ?? -1;
  const before = index >= 0 ? data.water_statements[index] : null;
  const updated: WaterStatement = { ...statement, readings_complete: true };
  const maintenance = maintenanceMatches[0];
  if (maintenance) {
    for (const waterFlat of updated.flats) {
      const flat = maintenance.flats.find(item => item.flat === waterFlat.flat);
      if (!flat) continue;
      const payable = money(waterFlat.actual_amount + (flat.previous_pending || 0));
      if (flat.paid > payable + 0.01) {
        throw new Error(`Flat ${flat.flat} has already paid more than the revised total payable. Resolve the overpayment before saving this water bill; no credit ledger is available.`);
      }
    }
  }
  if (index >= 0) data.water_statements[index] = updated;
  else data.water_statements.push(updated);
  if (maintenance) {
    for (const waterFlat of updated.flats) {
      const flat = maintenance.flats.find(item => item.flat === waterFlat.flat);
      if (!flat) continue;
      flat.actual = money(waterFlat.actual_amount);
      flat.total_payable = money(flat.actual + (flat.previous_pending || 0));
      flat.pending = money(Math.max(0, flat.total_payable - flat.paid));
      flat.status = flat.pending <= 1 ? 'Paid' : (flat.paid > 0 ? 'Partial' : 'Due');
    }
    maintenance.dues_list = maintenance.flats.filter(flat => flat.pending > 1).map(flat => ({ item: `Flat ${flat.flat}`, amount: flat.pending }));
  }
  audit(data, { month: statement.sheet_name, action: 'water.updated', record_id: statement.sheet_name, before: before as unknown as Record<string, unknown> | null, after: updated as unknown as Record<string, unknown> });
  persist(data);
  return data;
}

function validateWaterForClose(data: ApartmentData, month: string): string[] {
  const matches = data.water_statements.filter(item => sameCalendarMonth(item.sheet_name, month));
  if (matches.length !== 1) return [matches.length ? 'More than one water statement exists for this calendar month.' : 'Water statement is missing.'];
  const water = matches[0];
  const problems: string[] = [];
  if (water.readings_complete !== true) problems.push('A complete set of water readings has not been explicitly saved for this cycle.');
  const byFlat = new Map<number, typeof water.flats[number]>();
  for (const reading of water.flats) {
    if (byFlat.has(reading.flat)) problems.push(`Flat ${reading.flat} has duplicate meter readings.`);
    byFlat.set(reading.flat, reading);
  }
  for (const flat of data.flats) {
    const reading = byFlat.get(flat);
    if (!reading) problems.push(`Flat ${flat} has no meter reading.`);
    else if (!Number.isFinite(reading.opening_reading) || !Number.isFinite(reading.closing_reading) || reading.opening_reading < 0 || reading.closing_reading < reading.opening_reading) {
      problems.push(`Flat ${flat} has an invalid meter reading.`);
    }
  }
  return problems;
}

function validateLedgerForClose(data: ApartmentData, month: string, m: MaintenanceStatement): string[] {
  const problems: string[] = [];
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  for (const [label, value] of [['opening cash', m.cash_opening], ['opening bank', m.bank_opening], ['recorded cash balance', m.cash_balance], ['recorded bank balance', m.bank_balance]] as const) {
    if (!finite(value)) problems.push(`${label} is missing or non-finite.`);
  }
  const seen = new Set<number>();
  for (const flat of m.flats) {
    if (seen.has(flat.flat)) problems.push(`Flat ${flat.flat} has duplicate maintenance rows.`);
    seen.add(flat.flat);
    if (!data.flats.includes(flat.flat)) problems.push(`Flat ${flat.flat} is not in the configured apartment list.`);
    for (const [label, value] of [['billed amount', flat.actual], ['paid amount', flat.paid], ['pending amount', flat.pending]] as const) {
      if (!finite(value) || value < 0) problems.push(`Flat ${flat.flat} has an invalid ${label}.`);
    }
    const payable = flat.total_payable ?? (flat.actual + (flat.previous_pending || 0));
    if (!finite(payable) || payable < 0) problems.push(`Flat ${flat.flat} has an invalid total payable amount.`);
    else if (finite(flat.paid) && flat.paid > payable + 0.01) problems.push(`Flat ${flat.flat} has an overpayment that cannot be carried as credit.`);
    else if (finite(flat.paid) && finite(flat.pending) && Math.abs(flat.pending - money(Math.max(0, payable - flat.paid))) > 0.01) {
      problems.push(`Flat ${flat.flat} pending dues do not reconcile to total payable less payments.`);
    }
    if ((flat.paid || 0) > 0 && !['Cash', 'Online', 'Bank'].includes(flat.mode)) problems.push(`Flat ${flat.flat} has an unsupported payment channel.`);
  }
  for (const flat of data.flats) if (!seen.has(flat)) problems.push(`Flat ${flat} is missing from the maintenance statement.`);
  for (const flat of m.flats) {
    const receipts = flat.receipts;
    if (receipts !== undefined) {
      if (!Array.isArray(receipts)) problems.push(`Flat ${flat.flat} has malformed payment receipt history.`);
      else {
        let receiptTotal = 0;
        for (const receipt of receipts) {
          if (!finite(receipt.amount) || receipt.amount <= 0 || !['Cash', 'Online', 'Bank'].includes(receipt.mode)) {
            problems.push(`Flat ${flat.flat} has an invalid payment receipt.`);
          } else receiptTotal += receipt.amount;
        }
        if (Math.abs(receiptTotal - (flat.paid || 0)) > 0.01) problems.push(`Flat ${flat.flat} receipt history does not reconcile to cumulative payments.`);
      }
    }
  }
  for (const [label, rows] of [['inflow', m.inflows], ['expense', m.expenses]] as const) {
    for (const row of rows) {
      if (!finite(row.amount) || row.amount < 0) problems.push(`A ${label} has a missing or invalid amount.`);
      if (row.type !== undefined && row.type !== 'Cash' && row.type !== 'Bank') problems.push(`A ${label} has an unsupported account channel.`);
    }
  }
  for (const transfer of m.transfers || []) {
    if (!finite(transfer.amount) || transfer.amount <= 0 || (transfer.from !== 'Cash' && transfer.from !== 'Bank') || (transfer.to !== 'Cash' && transfer.to !== 'Bank') || transfer.from === transfer.to) problems.push('A transfer has invalid amount or account channels.');
  }
  return problems;
}

function roundedLedgerBalance(m: MaintenanceStatement, channel: 'Cash' | 'Bank'): number {
  const opening = channel === 'Cash' ? m.cash_opening : m.bank_opening;
  const receipts = m.flats.reduce((sum, flat) => {
    if (flat.receipts) return sum + flat.receipts.reduce((receiptSum, receipt) => {
      const receiptChannel = receipt.mode === 'Cash' ? 'Cash' : 'Bank';
      return receiptChannel === channel ? receiptSum + receipt.amount : receiptSum;
    }, 0);
    const paymentChannel = flat.mode === 'Cash' ? 'Cash' : flat.mode === 'Online' || flat.mode === 'Bank' ? 'Bank' : null;
    return paymentChannel === channel ? sum + flat.paid : sum;
  }, 0);
  const inflows = m.inflows.reduce((sum, item) => sum + ((item.type || 'Cash') === channel ? item.amount : 0), 0);
  const expenses = m.expenses.reduce((sum, item) => sum + ((item.type || 'Cash') === channel ? item.amount : 0), 0);
  const transfers = (m.transfers || []).reduce((sum, item) => sum + (item.to === channel ? item.amount : 0) - (item.from === channel ? item.amount : 0), 0);
  return money(opening + receipts + inflows - expenses + transfers);
}

export function closeCycle(month: string, discrepancyReason = ''): ApartmentData {
  const data = getApartmentData();
  const cycle = assertCycleOpen(data, month);
  const maintenance = getMaintenance(data, month);
  const problems = [...validateLedgerForClose(data, month, maintenance), ...validateWaterForClose(data, month)];
  if (problems.length) throw new Error(`Cannot close this cycle yet:\n• ${problems.slice(0, 8).join('\n• ')}${problems.length > 8 ? `\n• and ${problems.length - 8} more issue(s)` : ''}`);
  const expectedCash = roundedLedgerBalance(maintenance, 'Cash');
  const expectedBank = roundedLedgerBalance(maintenance, 'Bank');
  const cashMismatch = Math.abs(expectedCash - maintenance.cash_balance) > 0.01;
  const bankMismatch = Math.abs(expectedBank - maintenance.bank_balance) > 0.01;
  if ((cashMismatch || bankMismatch) && !discrepancyReason.trim()) {
    throw new Error(`Balance reconciliation needs review. Ledger: Cash ₹${expectedCash.toFixed(2)}, Bank ₹${expectedBank.toFixed(2)}. Recorded: Cash ₹${maintenance.cash_balance.toFixed(2)}, Bank ₹${maintenance.bank_balance.toFixed(2)}. Enter a close note explaining the discrepancy to continue.`);
  }
  const before = { ...cycle };
  cycle.status = 'closed';
  cycle.closed_at = now();
  cycle.closed_by = 'Local app admin (client-side role)';
  cycle.close_reason = discrepancyReason.trim() || 'Closed after cycle checklist review.';
  cycle.closed_cash_balance = maintenance.cash_balance;
  cycle.closed_bank_balance = maintenance.bank_balance;
  audit(data, { month, action: 'closed', reason: cycle.close_reason, before: before as unknown as Record<string, unknown>, after: { ...cycle } as unknown as Record<string, unknown> });
  persist(data);
  return data;
}

export function initializeCycle(month: string, targetStatus: 'open' | 'closed' | 'legacy-closed', reason = ''): ApartmentData {
  const data = getApartmentData();
  const cycleLabel = Object.keys(data.cycles || {}).find(label => sameCalendarMonth(label, month));
  const cycle = cycleLabel ? data.cycles?.[cycleLabel] : undefined;
  if (!cycleLabel || !cycle || cycle.status !== 'initialization-required') {
    throw new Error('Only a cycle awaiting explicit initialization can be initialized.');
  }

  const orderedCycles = Object.keys(data.cycles || {}).sort((a, b) => monthSortKey(a) - monthSortKey(b));
  const latestCycle = orderedCycles[orderedCycles.length - 1];

  if (targetStatus === 'open') {
    if (cycleLabel !== latestCycle) {
      throw new Error('Only the latest cycle can be initialized as open.');
    }
    const hasAnotherOpen = Object.entries(data.cycles || {}).some(([label, state]) => !sameCalendarMonth(label, cycleLabel) && state.status === 'open');
    if (hasAnotherOpen) {
      throw new Error('Another cycle is already open. Close that cycle before opening this month.');
    }
    cycle.status = 'open';
    cycle.opened_at = now();
  } else if (targetStatus === 'closed') {
    cycle.status = 'closed';
    cycle.closed_at = now();
    cycle.closed_by = 'Local app admin (client-side role)';
    cycle.close_reason = reason.trim() || 'Explicitly initialized as closed by administrator.';
    const m = data.maintenance_statements.find(item => sameCalendarMonth(item.sheet_name, cycleLabel));
    if (m) {
      cycle.closed_cash_balance = m.cash_balance;
      cycle.closed_bank_balance = m.bank_balance;
    }
  } else {
    cycle.status = 'legacy-closed';
    cycle.close_reason = reason.trim() || 'Locked as legacy historical period.';
  }

  audit(data, {
    month: cycleLabel,
    action: 'legacy.initialized',
    reason: reason.trim() || `Initialized as ${targetStatus}`,
    after: { ...cycle } as unknown as Record<string, unknown>
  });
  persist(data);
  return data;
}

export function reopenCycle(month: string, reason: string): ApartmentData {
  const data = getApartmentData();
  const cycleLabel = Object.keys(data.cycles || {}).find(label => sameCalendarMonth(label, month));
  const cycle = cycleLabel ? data.cycles?.[cycleLabel] : undefined;
  if (!cycleLabel || !cycle || cycle.status !== 'closed') throw new Error('Only a genuinely closed cycle can be reopened; legacy-closed periods cannot be reopened as if reconciled.');
  const orderedCycles = Object.keys(data.cycles || {}).sort((a, b) => monthSortKey(a) - monthSortKey(b));
  const latestCycle = orderedCycles[orderedCycles.length - 1];
  if (cycleLabel !== latestCycle) throw new Error('Only the latest closed cycle can be reopened. Reopening an older month would leave successor balances and arrears inconsistent.');
  if (!reason.trim()) throw new Error('An audit reason is required to reopen a cycle.');
  if (Object.entries(data.cycles || {}).some(([label, state]) => !sameCalendarMonth(label, month) && state.status === 'open')) {
    throw new Error('Another month is already open. Close that cycle before reopening this month.');
  }
  const before = { ...cycle };
  cycle.status = 'open';
  delete cycle.closed_at;
  delete cycle.closed_by;
  delete cycle.close_reason;
  delete cycle.closed_cash_balance;
  delete cycle.closed_bank_balance;
  cycle.opened_at = now();
  audit(data, { month: cycleLabel, action: 'reopened', reason: reason.trim(), before: before as unknown as Record<string, unknown>, after: { ...cycle } as unknown as Record<string, unknown> });
  persist(data);
  return data;
}

export function openNextCycle(previousMonth: string): ApartmentData {
  const data = getApartmentData();
  const labels = Object.keys(data.cycles || {}).sort((a, b) => monthSortKey(a) - monthSortKey(b));
  const latest = labels[labels.length - 1];
  if (previousMonth !== latest) throw new Error('Only the latest month can roll forward; skipped cycles are not allowed.');
  if (Object.values(data.cycles || {}).some(state => state.status === 'open')) throw new Error('Close the currently open cycle before opening another month.');
  const previousCycle = data.cycles?.[previousMonth];
  if (!previousCycle || previousCycle.status !== 'closed') throw new Error('A legacy-closed month is locked historical data, not a newly closed cycle; it cannot roll over automatically.');
  const nextMonth = nextMonthLabel(previousMonth);
  if (Object.keys(data.cycles || {}).some(label => sameCalendarMonth(label, nextMonth)) || data.maintenance_statements.some(item => sameCalendarMonth(item.sheet_name, nextMonth)) || data.water_statements.some(item => sameCalendarMonth(item.sheet_name, nextMonth))) {
    throw new Error(`${nextMonth} already has data. Nothing was overwritten.`);
  }
  const previousMaintenanceMatches = data.maintenance_statements.filter(item => sameCalendarMonth(item.sheet_name, previousMonth));
  if (previousMaintenanceMatches.length !== 1) throw new Error(`Expected exactly one prior maintenance statement for ${previousMonth}; found ${previousMaintenanceMatches.length}. Nothing was rolled over.`);
  const previousMaintenance = previousMaintenanceMatches[0];
  const previousWaterMatches = data.water_statements.filter(item => sameCalendarMonth(item.sheet_name, previousMonth));
  if (previousWaterMatches.length !== 1) throw new Error(`Expected exactly one prior water statement for ${previousMonth}; found ${previousWaterMatches.length}. Nothing was rolled over.`);
  const previousWater = previousWaterMatches[0];
  const waterProblems = validateWaterForClose(data, previousMonth);
  if (waterProblems.length) throw new Error(`The prior month has incomplete meter baselines:\n• ${waterProblems.slice(0, 6).join('\n• ')}`);
  const previousCash = previousCycle.closed_cash_balance ?? previousMaintenance.cash_balance;
  const previousBank = previousCycle.closed_bank_balance ?? previousMaintenance.bank_balance;
  if (!Number.isFinite(previousCash) || !Number.isFinite(previousBank)) throw new Error('The prior closed cash and bank balances must both be finite before rollover.');
  const previousFlatRows = new Map<number, typeof previousMaintenance.flats[number]>();
  for (const flatRow of previousMaintenance.flats) {
    if (previousFlatRows.has(flatRow.flat)) throw new Error(`The prior maintenance statement has duplicate rows for Flat ${flatRow.flat}; no dues were carried.`);
    previousFlatRows.set(flatRow.flat, flatRow);
  }
  for (const flat of data.flats) {
    const row = previousFlatRows.get(flat);
    if (!row || !Number.isFinite(row.pending) || row.pending < 0) throw new Error(`Flat ${flat} has missing or invalid prior pending dues; no dues were carried.`);
  }
  const dues = Object.fromEntries(data.flats.map(flat => [flat, previousFlatRows.get(flat)!.pending]));
  const config = data.billing_config_history
    .filter(item => item.effective_from <= `${new Date(`${nextMonth} 1`).getFullYear()}-${String(new Date(`${nextMonth} 1`).getMonth() + 1).padStart(2, '0')}`)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from)).slice(-1)[0]
    || data.billing_config_history[data.billing_config_history.length - 1];
  const nextFlats: MaintenanceStatement['flats'] = data.flats.map(flatNumber => {
    const arrears = dues[flatNumber] || 0;
    return { flat: flatNumber, actual: 0, previous_pending: arrears, total_payable: arrears, paid: 0, pending: arrears, mode: 'Due', status: arrears > 0 ? 'Due' : 'Paid' };
  });
  const newMaintenance: MaintenanceStatement = {
    sheet_name: nextMonth,
    title: `Rockcliff 'B' Block Maintenance for ${nextMonth}`,
    flats: nextFlats,
    inflows: [], expenses: [], transfers: [], opening_dues: dues,
    cash_opening: previousCash, bank_opening: previousBank,
    cash_total_in: 0, bank_total_in: 0,
    cash_total_out: 0, bank_total_out: 0,
    cash_balance: previousCash, bank_balance: previousBank, total_balance: money(previousCash + previousBank),
    dues_list: nextFlats.filter(flat => flat.pending > 1).map(flat => ({ item: `Flat ${flat.flat}`, amount: flat.pending })),
    legacy_previous_dues: true
  };
  const previousReadings = new Map(previousWater.flats.map(flat => [flat.flat, flat.closing_reading]));
  const newWater: WaterStatement = {
    ...previousWater,
    sheet_name: nextMonth,
    title: `Rockcliff 'B' Block Water Billing for ${nextMonth}`,
    reading_date: null,
    days: new Date(Date.UTC(Number(nextMonth.split(' ')[1]), new Date(`${nextMonth} 1`).getMonth() + 1, 0)).getUTCDate(),
    tanker_bill: 0, electricity_bill: 0,
    common_utilization: config?.common_utilization ?? previousWater.common_utilization,
    net_electricity: 0,
    mandatory_maintenance: config?.mandatory_maintenance ?? previousWater.mandatory_maintenance,
    total_water_consumption_liters: 0, avg_per_day_liters: 0, liter_per_charge: 0,
    readings_complete: false,
    flats: data.flats.map(flat => {
      const reading = previousReadings.get(flat);
      if (reading === undefined || !Number.isFinite(reading)) throw new Error(`Flat ${flat} has no valid closing meter reading; provide an opening reading before rollover.`);
      return { flat, opening_reading: reading, closing_reading: reading, liters: 0, avg_per_day: 0, water_charge: 0,
        mandatory_maintenance: config?.mandatory_maintenance ?? previousWater.mandatory_maintenance,
        actual_amount: 0, pending_amount: dues[flat] || 0, total_payable: dues[flat] || 0 };
    })
  };
  data.maintenance_statements.unshift(newMaintenance);
  data.water_statements.unshift(newWater);
  data.cycles![nextMonth] = { status: 'open', opened_at: now() };
  audit(data, { month: nextMonth, action: 'opened', reason: `Opened after closing ${previousMonth}; carried cash/bank separately, flat dues, and last valid meter readings.`, after: { previous_month: previousMonth, cash_opening: previousCash, bank_opening: previousBank, opening_dues: dues } });
  persist(data);
  return data;
}

export function saveContact(contact: DirectoryContact): ApartmentData {
  const data = getApartmentData();
  const idx = data.contacts.findIndex(item => item.id === contact.id);
  const before = idx !== -1 ? { ...data.contacts[idx] } : null;
  if (idx !== -1) data.contacts[idx] = contact;
  else data.contacts.push({ ...contact, id: makeId('c') });
  audit(data, { month: 'directory', action: 'contact.saved', record_id: contact.id, before, after: { ...(idx !== -1 ? contact : data.contacts[data.contacts.length - 1]) } });
  persist(data);
  return data;
}

export function deleteContact(id: string): ApartmentData {
  const data = getApartmentData();
  const before = data.contacts.find(item => item.id === id);
  data.contacts = data.contacts.filter(item => item.id !== id);
  audit(data, { month: 'directory', action: 'contact.deleted', record_id: id, before: before ? { ...before } : null, after: null });
  persist(data);
  return data;
}

export function recordCycleAudit(data: ApartmentData, event: Omit<CycleAuditEvent, 'id' | 'occurred_at' | 'actor'>): void {
  audit(data, event);
}
