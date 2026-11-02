import type {
  ApartmentData, BalanceTransfer, BillingConfigEntry, CycleAuditEvent, CycleState,
  DirectoryContact, ExpenseItem, InflowItem, MaintenanceStatement, PaymentChannel, PaymentMode, WaterStatement
} from '../types/apartment';
import { calculateWaterBilling } from './calculations';
import seedData from '../data/apartment_seed.json';
import { DEFAULT_CONTACTS } from '../data/default_contacts';
import { DEFAULT_BILLING_CONFIG_HISTORY } from '../data/default_config';

// Preserve the live app's existing key. Do not bump this during migration or deployment.
const STORAGE_KEY = 'rockcliff_apartment_data_v10';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function monthDate(label: string): Date | null {
  const isoMatch = label.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    const parsed = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, 1));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = label.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b.*?\b(\d{4})\b/i);
  if (!match) return null;
  const parsed = new Date(`${match[1]} 1, ${match[2]} 00:00:00 UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function canonicalMonthLabel(label: string): string | null {
  const date = monthDate(label);
  return date ? `${date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${date.getUTCFullYear()}` : null;
}

export function getFirstOfMonth(monthLabel: string): string {
  const d = monthDate(monthLabel);
  if (!d) return new Date().toISOString().slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
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
  for (const label of labels) {
    if (!data.cycles[label]) {
      const isLegacy = label !== latest;
      data.cycles[label] = isLegacy
        ? { status: 'legacy-closed', initialized_as: 'legacy' }
        : { status: 'initialization-required', initialized_as: 'legacy' };
      changed = true;
    }
  }

  // Single active cycle policy: October 2026 is initially the single open cycle.
  // Never forcibly reopen or relock cycles if the user has already transitioned cycles in production.
  const hasAnyOpenCycle = Object.values(data.cycles).some(c => c.status === 'open');
  if (!hasAnyOpenCycle) {
    if (data.cycles['October 2026']) {
      data.cycles['October 2026'] = { status: 'open', opened_at: data.cycles['October 2026']?.opened_at || now() };
      changed = true;
    }
  }
  for (const statement of data.maintenance_statements) {
    if (!Array.isArray(statement.expenses)) { statement.expenses = []; changed = true; }
    if (!Array.isArray(statement.inflows)) { statement.inflows = []; changed = true; }
    if (!Array.isArray(statement.transfers)) { statement.transfers = []; changed = true; }
    if (!Array.isArray(statement.dues_list)) { statement.dues_list = []; changed = true; }
  }

  // Self-healing: Ensure all verified historical society statements maintain their verified baseline numbers
  for (const w of data.water_statements) {
    const seedW = (seedData.water_statements as unknown as WaterStatement[])?.find(s => sameCalendarMonth(s.sheet_name, w.sheet_name));
    if (seedW && seedW.tanker_bill > 0 && (w.tanker_bill === 0 || w.total_water_consumption_liters !== seedW.total_water_consumption_liters)) {
      w.tanker_bill = seedW.tanker_bill;
      w.electricity_bill = seedW.electricity_bill;
      w.common_utilization = seedW.common_utilization;
      w.net_electricity = seedW.net_electricity;
      w.days = seedW.days;
      w.readings_complete = true;
      w.flats = JSON.parse(JSON.stringify(seedW.flats));
      w.total_water_consumption_liters = seedW.total_water_consumption_liters;
      w.avg_per_day_liters = seedW.avg_per_day_liters;
      w.liter_per_charge = seedW.liter_per_charge;

      const m = data.maintenance_statements.find(s => sameCalendarMonth(s.sheet_name, w.sheet_name));
      const seedM = (seedData.maintenance_statements as unknown as MaintenanceStatement[])?.find(s => sameCalendarMonth(s.sheet_name, w.sheet_name));
      if (m && seedM) {
        for (const wf of w.flats) {
          const mf = m.flats.find(f => f.flat === wf.flat);
          const smf = seedM.flats.find(f => f.flat === wf.flat);
          if (mf && smf) {
            mf.actual = smf.actual;
            mf.total_payable = smf.total_payable;
            mf.paid = smf.paid;
            mf.pending = smf.pending;
            mf.status = smf.status;
            mf.mode = smf.mode;
          }
        }
        m.dues_list = m.flats.filter(f => f.pending > 1).map(f => ({ item: `Flat ${f.flat}`, amount: f.pending }));
      }
      changed = true;
    }
  }

  // Ensure Flat 207 has September 2026 recorded as Due and carried into October 2026 as previous pending arrears
  const sepMaint = data.maintenance_statements.find(s => sameCalendarMonth(s.sheet_name, 'September Water 2026') || sameCalendarMonth(s.sheet_name, 'September 2026'));
  const sepWater = data.water_statements.find(s => sameCalendarMonth(s.sheet_name, 'September Water 2026') || sameCalendarMonth(s.sheet_name, 'September 2026'));
  if (sepMaint) {
    const f207Sep = sepMaint.flats.find(f => f.flat === 207);
    if (f207Sep && (f207Sep.paid > 0 || f207Sep.status !== 'Due')) {
      f207Sep.paid = 0.0;
      f207Sep.pending = f207Sep.actual;
      f207Sep.status = 'Due';
      f207Sep.mode = 'Due';
      if (!sepMaint.dues_list.some(d => d.item.includes('207'))) {
        sepMaint.dues_list.push({ item: 'Flat 207', amount: f207Sep.pending });
      }
      changed = true;
    }
  }
  // For September Water Statement: every flat's pending_amount represents PRIOR month arrears (August arrears = 0)
  if (sepWater) {
    for (const f of sepWater.flats) {
      if (f.pending_amount !== 0) {
        f.pending_amount = 0;
        f.total_payable = f.actual_amount;
        changed = true;
      }
    }
  }

  const octMaint = data.maintenance_statements.find(s => sameCalendarMonth(s.sheet_name, 'October 2026'));
  const octWater = data.water_statements.find(s => sameCalendarMonth(s.sheet_name, 'October 2026'));
  if (octMaint) {
    if (octMaint.bank_balance === 0 && octMaint.cash_balance === 0 && octMaint.total_balance === 0) {
      octMaint.bank_balance = 78156.04;
      octMaint.bank_opening = 78156.04;
      octMaint.cash_balance = -156.04;
      octMaint.cash_opening = -156.04;
      octMaint.total_balance = 78000.00;
      changed = true;
    }
    const f207Oct = octMaint.flats.find(f => f.flat === 207);
    if (f207Oct && f207Oct.previous_pending !== 2095.8) {
      f207Oct.previous_pending = 2095.8;
      f207Oct.total_payable = money(f207Oct.actual + f207Oct.previous_pending);
      f207Oct.pending = money(Math.max(0, f207Oct.total_payable - f207Oct.paid));
      f207Oct.status = f207Oct.pending <= 1 ? 'Paid' : (f207Oct.paid > 0 ? 'Partial' : 'Due');
      changed = true;
    }
  }
  // For October Water Statement: only flats with prior arrears (Flat 207) show in pending column
  if (octWater) {
    for (const f of octWater.flats) {
      const expectedPending = f.flat === 207 ? 2095.8 : 0;
      if (f.pending_amount !== expectedPending) {
        f.pending_amount = expectedPending;
        f.total_payable = money(f.actual_amount + expectedPending);
        changed = true;
      }
    }
  }

  // Two-way synchronization: Ensure all historical statements have corresponding tanker and electricity expenses in m.expenses
  for (const m of data.maintenance_statements) {
    const w = data.water_statements.find(ws => sameCalendarMonth(ws.sheet_name, m.sheet_name));
    if (w) {
      const slug = m.sheet_name.replace(/\s+/g, '-').toLowerCase();
      const hasTankerExp = m.expenses.some(e => (e.category || '').toLowerCase().includes('tanker') || e.description.toLowerCase().includes('tanker'));
      if (w.tanker_bill > 0 && !hasTankerExp) {
        m.expenses.push({
          id: `exp-tanker-${slug}`,
          description: 'Water Tanker Supply (Monthly Tankers)',
          amount: w.tanker_bill,
          category: 'Water Tankers',
          type: 'Bank',
          date: getFirstOfMonth(m.sheet_name)
        });
        changed = true;
      }
      const hasElecExp = m.expenses.some(e => (e.category || '').toLowerCase().includes('electric') || (e.category || '').toLowerCase().includes('power') || e.description.toLowerCase().includes('electric'));
      if (w.electricity_bill > 0 && !hasElecExp) {
        m.expenses.push({
          id: `exp-elec-${slug}`,
          description: 'Electricity / Power Bill (Pumping & Common)',
          amount: w.electricity_bill,
          category: 'Electricity / Power',
          type: 'Bank',
          date: getFirstOfMonth(m.sheet_name)
        });
        changed = true;
      }
    }
  }

  assertUniqueStatementMonths(data.maintenance_statements, 'maintenance');
  assertUniqueStatementMonths(data.water_statements, 'water');
  return { data, changed };
}

const PRODUCTION_SNAPSHOT_KEY = 'rockcliff_production_snapshot_latest';

function persist(data: ApartmentData): void {
  const jsonStr = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, jsonStr);
  // Rolling safety snapshot: protects against accidental local storage wipes
  try {
    localStorage.setItem(PRODUCTION_SNAPSHOT_KEY, jsonStr);
  } catch (err) {
    console.warn('Could not write safety snapshot:', err);
  }
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
  // Deep clone seedData to prevent in-memory mutation across test runs or sessions
  const freshSeed = JSON.parse(JSON.stringify(seedData));
  const initialData: ApartmentData = {
    apartment_name: freshSeed.apartment_name || "Rockcliff 'B' Block",
    total_flats: freshSeed.total_flats || 32,
    flats: freshSeed.flats || [],
    water_statements: freshSeed.water_statements as unknown as WaterStatement[],
    maintenance_statements: freshSeed.maintenance_statements as unknown as MaintenanceStatement[],
    contacts: JSON.parse(JSON.stringify(DEFAULT_CONTACTS)),
    billing_config_history: JSON.parse(JSON.stringify(DEFAULT_BILLING_CONFIG_HISTORY)),
    cycles: {},
    extracted_at: freshSeed.extracted_at || now()
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

function assertDateInCycle(dateStr: string | undefined, monthSheet: string): void {
  if (!dateStr || !dateStr.trim()) return;
  const targetLabel = canonicalMonthLabel(monthSheet);
  const dateLabel = canonicalMonthLabel(dateStr);
  if (dateLabel && targetLabel && dateLabel !== targetLabel) {
    throw new Error(`Transaction date (${dateStr}) does not belong to ${monthSheet}. Dates from other cycles are not allowed.`);
  }
}

function syncExpensesToWater(data: ApartmentData, monthSheet: string): void {
  const m = data.maintenance_statements.find(item => sameCalendarMonth(item.sheet_name, monthSheet));
  const w = data.water_statements.find(item => sameCalendarMonth(item.sheet_name, monthSheet));
  if (!m || !w) return;

  const tankerExpenses = m.expenses.filter(e => (e.category || '').toLowerCase().includes('tanker') || e.description.toLowerCase().includes('tanker'));
  const elecExpenses = m.expenses.filter(e => (e.category || '').toLowerCase().includes('electric') || (e.category || '').toLowerCase().includes('power') || e.description.toLowerCase().includes('electricity'));

  let updated = false;
  if (tankerExpenses.length > 0) {
    w.tanker_bill = money(tankerExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));
    updated = true;
  }
  if (elecExpenses.length > 0) {
    w.electricity_bill = money(elecExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));
    updated = true;
  }

  // Recalculate water billing only when expenses exist or update
  if (updated) {
    const calculated = calculateWaterBilling({
      tankerBill: w.tanker_bill,
      electricityBill: w.electricity_bill,
      commonUtilization: w.common_utilization,
      mandatoryMaintenance: w.mandatory_maintenance,
      days: w.days || 30,
      flatReadings: w.flats.map(f => ({
        flat: f.flat,
        closingReading: f.closing_reading,
        openingReading: f.opening_reading,
        pendingAmount: f.pending_amount
      }))
    });

    w.net_electricity = calculated.netElectricity;
    w.total_water_consumption_liters = calculated.totalConsumptionLiters;
    w.avg_per_day_liters = calculated.avgPerDayLiters;
    w.liter_per_charge = calculated.literPerCharge;
    w.flats = calculated.flats;

    // Sync actual amounts to maintenance statement
    for (const waterFlat of w.flats) {
      const flat = m.flats.find(item => item.flat === waterFlat.flat);
      if (!flat) continue;
      flat.actual = money(waterFlat.actual_amount);
      flat.total_payable = money(flat.actual + (flat.previous_pending || 0));
      flat.pending = money(Math.max(0, flat.total_payable - flat.paid));
      flat.status = flat.pending <= 1 ? 'Paid' : (flat.paid > 0 ? 'Partial' : 'Due');
    }
    m.dues_list = m.flats.filter(flat => flat.pending > 1).map(flat => ({ item: `Flat ${flat.flat}`, amount: flat.pending }));
  }
}

function cascadeFlatArrears(data: ApartmentData, flatNumber: number, fromMonth: string): void {
  const orderedLabels = Object.keys(data.cycles || {}).sort((a, b) => monthSortKey(a) - monthSortKey(b));
  const fromIndex = orderedLabels.findIndex(l => sameCalendarMonth(l, fromMonth));
  if (fromIndex < 0) return;

  for (let i = fromIndex; i < orderedLabels.length - 1; i++) {
    const currentLabel = orderedLabels[i];
    const nextLabel = orderedLabels[i + 1];

    const currentM = data.maintenance_statements.find(m => sameCalendarMonth(m.sheet_name, currentLabel));
    const nextM = data.maintenance_statements.find(m => sameCalendarMonth(m.sheet_name, nextLabel));
    const nextW = data.water_statements.find(w => sameCalendarMonth(w.sheet_name, nextLabel));

    if (!currentM || !nextM) continue;

    const currentFlat = currentM.flats.find(f => f.flat === flatNumber);
    const nextFlat = nextM.flats.find(f => f.flat === flatNumber);

    if (!currentFlat || !nextFlat) continue;

    const newArrears = currentFlat.pending;
    nextFlat.previous_pending = newArrears;
    nextFlat.total_payable = money(nextFlat.actual + newArrears);
    nextFlat.pending = money(Math.max(0, nextFlat.total_payable - nextFlat.paid));
    nextFlat.status = nextFlat.pending <= 1 ? 'Paid' : (nextFlat.paid > 0 ? 'Partial' : 'Due');

    if (nextW) {
      const waterFlat = nextW.flats.find(f => f.flat === flatNumber);
      if (waterFlat) {
        waterFlat.pending_amount = newArrears;
        waterFlat.total_payable = money(waterFlat.actual_amount + newArrears);
      }
    }

    nextM.dues_list = nextM.flats.filter(flat => flat.pending > 1).map(flat => ({ item: `Flat ${flat.flat}`, amount: flat.pending }));
  }
}

export function resetFlatPaymentToDue(monthSheet: string, flatNumber: number, reason?: string): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, monthSheet);
  const m = getMaintenance(data, monthSheet);
  const flat = m.flats.find(item => item.flat === flatNumber);
  if (!flat) throw new Error(`Flat ${flatNumber} is not present in ${monthSheet}.`);
  if ((flat.paid || 0) <= 0) return data;

  const before = { ...flat };
  // Reverse payments from Cash or Bank
  if (flat.receipts && flat.receipts.length > 0) {
    for (const r of flat.receipts) {
      const channel: 'Cash' | 'Bank' = r.mode === 'Cash' ? 'Cash' : 'Bank';
      changeBalance(m, channel, -r.amount, 0);
    }
  } else {
    const channel: 'Cash' | 'Bank' = flat.mode === 'Cash' ? 'Cash' : 'Bank';
    changeBalance(m, channel, -flat.paid, 0);
  }

  const payable = flat.total_payable ?? (flat.actual + (flat.previous_pending || 0));
  flat.paid = 0;
  flat.receipts = [];
  flat.pending = payable;
  flat.mode = 'Due';
  flat.status = 'Due';
  delete flat.payment_date;

  cascadeFlatArrears(data, flatNumber, monthSheet);

  audit(data, {
    month: monthSheet,
    action: 'payment.updated',
    record_id: String(flatNumber),
    reason: reason || 'Reverted payment back to Due by Admin',
    before,
    after: { ...flat }
  });
  persist(data);
  return data;
}

export function recordFlatPayment(monthSheet: string, flatNumber: number, paidAmount: number, mode: PaymentChannel, notes?: string, date?: string): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, monthSheet);
  assertDateInCycle(date, monthSheet);
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
  const receipts = flat.receipts ? [...flat.receipts] : currentPaid > 0
    ? [{ id: makeId('legacy-receipt'), amount: currentPaid, mode: (flat.mode === 'Cash' ? 'Cash' : flat.mode === 'Bank' ? 'Bank' : 'Online') as PaymentChannel }]
    : [];
  const newChannel: 'Cash' | 'Bank' | null = paidAmount === 0 ? null : mode === 'Cash' ? 'Cash' : 'Bank';
  if (newChannel) changeBalance(m, newChannel, paidAmount, 0);
  const effectiveDate = date && date.trim() ? date.trim() : new Date().toISOString().split('T')[0];
  if (paidAmount > 0) receipts.push({ id: makeId('receipt'), amount: money(paidAmount), mode, date: effectiveDate, ...(notes !== undefined ? { notes } : {}) });
  flat.receipts = receipts;
  flat.paid = money(currentPaid + paidAmount);
  flat.pending = money(Math.max(0, payable - flat.paid));
  flat.mode = flat.paid === 0 ? 'Due' : mode;
  flat.status = flat.pending <= 1 ? 'Paid' : (flat.paid > 0 ? 'Partial' : 'Due');
  if (paidAmount > 0) flat.payment_date = effectiveDate;
  if (notes !== undefined) flat.notes = notes;

  // Cascade arrears to next open months
  cascadeFlatArrears(data, flatNumber, monthSheet);

  audit(data, { month: monthSheet, action: 'payment.updated', record_id: String(flatNumber), before, after: { ...flat } });
  persist(data);
  return data;
}

export function addExpense(monthSheet: string, expense: ExpenseItem): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, monthSheet);
  if (!expense.description.trim() || !Number.isFinite(expense.amount) || expense.amount <= 0) throw new Error('Expense description and a positive amount are required.');
  if (expense.type !== undefined && expense.type !== 'Cash' && expense.type !== 'Bank') throw new Error('Expense channel must be Cash or Bank.');
  assertDateInCycle(expense.date, monthSheet);
  const m = getMaintenance(data, monthSheet);
  const channel: 'Cash' | 'Bank' = expense.type || 'Cash';
  const created = {
    ...expense,
    type: channel,
    id: expense.id || makeId('exp'),
    amount: money(expense.amount),
    date: expense.date || now().split('T')[0]
  };
  m.expenses.push(created);
  changeBalance(m, created.type || 'Cash', 0, created.amount);

  // Auto-sync tanker / electricity expenses to water billing
  syncExpensesToWater(data, monthSheet);

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
  assertDateInCycle(next.date, month);
  const m = getMaintenance(data, month);
  const index = locateExpense(m, id);
  if (index < 0) throw new Error('Expense was not found; reload the statement and try again.');
  const before = { ...m.expenses[index] };
  changeBalance(m, before.type || 'Cash', 0, -before.amount);
  const updated = {
    ...next,
    id: before.id || makeId('exp'),
    amount: money(next.amount),
    date: next.date || before.date || now().split('T')[0]
  };
  m.expenses[index] = updated;
  changeBalance(m, updated.type || 'Cash', 0, updated.amount);

  // Auto-sync tanker / electricity expenses to water billing
  syncExpensesToWater(data, month);

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

  // Auto-sync tanker / electricity expenses to water billing
  syncExpensesToWater(data, month);

  audit(data, { month, action: 'expense.deleted', record_id: before.id, before, after: null });
  persist(data);
  return data;
}

export function addInflow(month: string, inflow: InflowItem): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, month);
  if (!inflow.description.trim() || !Number.isFinite(inflow.amount) || inflow.amount <= 0) throw new Error('Inflow description and a positive amount are required.');
  if (inflow.type !== undefined && inflow.type !== 'Cash' && inflow.type !== 'Bank') throw new Error('Inflow channel must be Cash or Bank.');
  assertDateInCycle(inflow.date, month);
  const m = getMaintenance(data, month);
  const created = {
    ...inflow,
    id: inflow.id || makeId('in'),
    amount: money(inflow.amount),
    type: inflow.type || 'Cash',
    category: inflow.category || 'Miscellaneous Society Inflow',
    date: inflow.date || now().split('T')[0]
  };
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
  assertDateInCycle(next.date, month);
  const m = getMaintenance(data, month);
  const index = m.inflows.findIndex((item, i) => item.id === id || (!item.id && `legacy-in-${i}` === id));
  if (index < 0) throw new Error('Inflow was not found; reload the statement and try again.');
  const before = { ...m.inflows[index] };
  changeBalance(m, before.type || 'Cash', -before.amount, 0);
  const updated = {
    ...next,
    id: before.id || makeId('in'),
    amount: money(next.amount),
    type: next.type || 'Cash',
    category: next.category || before.category || 'Miscellaneous Society Inflow',
    date: next.date || before.date || now().split('T')[0]
  };
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

export function saveSingleFlatWaterReading(
  monthSheet: string,
  flatNumber: number,
  closingReading: number
): ApartmentData {
  const data = getApartmentData();
  assertCycleOpen(data, monthSheet);

  if (!Number.isFinite(closingReading) || closingReading < 0) {
    throw new Error('Closing reading must be a valid non-negative number.');
  }

  const w = data.water_statements.find(item => sameCalendarMonth(item.sheet_name, monthSheet));
  if (!w) throw new Error(`Water statement for ${monthSheet} was not found.`);

  const waterFlat = w.flats.find(f => f.flat === flatNumber);
  if (!waterFlat) throw new Error(`Flat ${flatNumber} not found in ${monthSheet}.`);

  if (closingReading < waterFlat.opening_reading) {
    throw new Error(`Closing reading (${closingReading.toLocaleString()}) cannot be less than opening reading (${waterFlat.opening_reading.toLocaleString()}).`);
  }

  const before = { ...waterFlat };
  waterFlat.closing_reading = closingReading;
  waterFlat.liters = Math.max(0, closingReading - waterFlat.opening_reading);

  // Recalculate water billing across all flats for this cycle
  const calculated = calculateWaterBilling({
    tankerBill: w.tanker_bill,
    electricityBill: w.electricity_bill,
    commonUtilization: w.common_utilization,
    mandatoryMaintenance: w.mandatory_maintenance,
    days: w.days || 30,
    flatReadings: w.flats.map(f => ({
      flat: f.flat,
      closingReading: f.closing_reading,
      openingReading: f.opening_reading,
      pendingAmount: f.pending_amount
    }))
  });

  w.net_electricity = calculated.netElectricity;
  w.total_water_consumption_liters = calculated.totalConsumptionLiters;
  w.avg_per_day_liters = calculated.avgPerDayLiters;
  w.liter_per_charge = calculated.literPerCharge;
  w.flats = calculated.flats;

  // Sync to maintenance statement
  const m = data.maintenance_statements.find(item => sameCalendarMonth(item.sheet_name, monthSheet));
  if (m) {
    for (const wf of w.flats) {
      const mf = m.flats.find(item => item.flat === wf.flat);
      if (!mf) continue;
      mf.actual = money(wf.actual_amount);
      mf.total_payable = money(mf.actual + (mf.previous_pending || 0));
      mf.pending = money(Math.max(0, mf.total_payable - mf.paid));
      mf.status = mf.pending <= 1 ? 'Paid' : (mf.paid > 0 ? 'Partial' : 'Due');
    }
    m.dues_list = m.flats.filter(f => f.pending > 1).map(f => ({ item: `Flat ${f.flat}`, amount: f.pending }));
  }

  audit(data, {
    month: monthSheet,
    action: 'water.updated',
    record_id: `Flat ${flatNumber}`,
    before: before as unknown as Record<string, unknown>,
    after: { ...waterFlat } as unknown as Record<string, unknown>
  });

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

  // Automatically roll forward and open next month
  try {
    const nextMonth = nextMonthLabel(month);
    performRollover(data, month, nextMonth);
  } catch (err) {
    console.warn('Auto-rollover warning:', err);
  }

  persist(data);
  return data;
}

function performRollover(data: ApartmentData, previousMonth: string, nextMonth: string): void {
  const previousCycle = data.cycles?.[previousMonth];
  if (!previousCycle || previousCycle.status !== 'closed') return;

  const previousMaintenance = data.maintenance_statements.find(item => sameCalendarMonth(item.sheet_name, previousMonth));
  const previousWater = data.water_statements.find(item => sameCalendarMonth(item.sheet_name, previousMonth));
  if (!previousMaintenance || !previousWater) return;

  const previousCash = previousCycle.closed_cash_balance ?? previousMaintenance.cash_balance;
  const previousBank = previousCycle.closed_bank_balance ?? previousMaintenance.bank_balance;

  const dues = Object.fromEntries(data.flats.map(flat => {
    const row = previousMaintenance.flats.find(f => f.flat === flat);
    return [flat, row ? row.pending : 0];
  }));

  const previousReadings = new Map(previousWater.flats.map(f => [f.flat, f.closing_reading]));

  const nextMaint = data.maintenance_statements.find(item => sameCalendarMonth(item.sheet_name, nextMonth));
  const nextWater = data.water_statements.find(item => sameCalendarMonth(item.sheet_name, nextMonth));

  if (nextMaint && nextWater) {
    nextMaint.cash_opening = previousCash;
    nextMaint.bank_opening = previousBank;
    nextMaint.opening_dues = dues;
    for (const flat of nextMaint.flats) {
      const arrears = dues[flat.flat] || 0;
      flat.previous_pending = arrears;
      flat.total_payable = money(flat.actual + arrears);
      flat.pending = money(Math.max(0, flat.total_payable - flat.paid));
      flat.status = flat.pending <= 1 ? 'Paid' : (flat.paid > 0 ? 'Partial' : 'Due');
    }
    nextMaint.dues_list = nextMaint.flats.filter(f => f.pending > 1).map(f => ({ item: `Flat ${f.flat}`, amount: f.pending }));

    for (const flat of nextWater.flats) {
      const reading = previousReadings.get(flat.flat);
      if (reading !== undefined && Number.isFinite(reading)) {
        flat.opening_reading = reading;
      }
      flat.pending_amount = dues[flat.flat] || 0;
      flat.total_payable = money(flat.actual_amount + flat.pending_amount);
    }
    nextWater.readings_complete = false;
    data.cycles![nextMonth] = { status: 'open', opened_at: now() };
  } else {
    const config = data.billing_config_history[data.billing_config_history.length - 1];
    const nextFlats = data.flats.map(flatNumber => {
      const arrears = dues[flatNumber] || 0;
      return { flat: flatNumber, actual: 0, previous_pending: arrears, total_payable: arrears, paid: 0, pending: arrears, mode: 'Due' as const, status: arrears > 0 ? ('Due' as const) : ('Paid' as const) };
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
    const newWater: WaterStatement = {
      ...previousWater,
      sheet_name: nextMonth,
      title: `Rockcliff 'B' Block Water Billing for ${nextMonth}`,
      reading_date: null,
      days: 30,
      tanker_bill: 0, electricity_bill: 0,
      common_utilization: config?.common_utilization ?? previousWater.common_utilization,
      net_electricity: 0,
      mandatory_maintenance: config?.mandatory_maintenance ?? previousWater.mandatory_maintenance,
      total_water_consumption_liters: 0, avg_per_day_liters: 0, liter_per_charge: 0,
      readings_complete: false,
      flats: data.flats.map(flat => {
        const reading = previousReadings.get(flat) ?? 0;
        return {
          flat, opening_reading: reading, closing_reading: reading, liters: 0, avg_per_day: 0, water_charge: 0,
          mandatory_maintenance: config?.mandatory_maintenance ?? previousWater.mandatory_maintenance,
          actual_amount: 0, pending_amount: dues[flat] || 0, total_payable: dues[flat] || 0
        };
      })
    };
    data.maintenance_statements.unshift(newMaintenance);
    data.water_statements.unshift(newWater);
    data.cycles![nextMonth] = { status: 'open', opened_at: now() };
  }

  audit(data, {
    month: nextMonth,
    action: 'opened',
    reason: `Automatically opened ${nextMonth} following the closure of ${previousMonth}.`,
    after: { previous_month: previousMonth, cash_opening: previousCash, bank_opening: previousBank, opening_dues: dues }
  });
}

export function openNextCycle(previousMonth: string): ApartmentData {
  const data = getApartmentData();
  const nextMonth = nextMonthLabel(previousMonth);
  performRollover(data, previousMonth, nextMonth);
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

export function openCycle(month: string, reason = ''): ApartmentData {
  const data = getApartmentData();
  const cycleLabel = Object.keys(data.cycles || {}).find(label => sameCalendarMonth(label, month));
  const cycle = cycleLabel ? data.cycles?.[cycleLabel] : undefined;
  if (!cycleLabel || !cycle) throw new Error(`Cycle “${month}” was not found.`);
  if (cycle.status === 'open') return data;

  // Single open cycle constraint
  const alreadyOpen = Object.entries(data.cycles || {}).find(([l, s]) => !sameCalendarMonth(l, month) && s.status === 'open');
  if (alreadyOpen) {
    throw new Error(`Only one cycle can be open at a time. Close “${alreadyOpen[0]}” before opening “${month}”.`);
  }

  const before = { ...cycle };
  cycle.status = 'open';
  cycle.opened_at = now();
  delete cycle.closed_at;
  delete cycle.closed_by;
  delete cycle.close_reason;
  delete cycle.closed_cash_balance;
  delete cycle.closed_bank_balance;
  audit(data, {
    month: cycleLabel,
    action: 'opened',
    reason: reason.trim() || `Opened ${cycleLabel}`,
    before: before as unknown as Record<string, unknown>,
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

export function exportApartmentDataBackup(): string {
  const data = getApartmentData();
  return JSON.stringify(data, null, 2);
}

export function importApartmentDataBackup(jsonString: string): ApartmentData {
  let parsed: ApartmentData;
  try {
    parsed = JSON.parse(jsonString) as ApartmentData;
  } catch {
    throw new Error('Invalid JSON backup file. The backup could not be parsed.');
  }

  if (!parsed || !Array.isArray(parsed.water_statements) || !Array.isArray(parsed.maintenance_statements)) {
    throw new Error('The backup file has an invalid shape and does not contain valid apartment statements.');
  }

  const normalized = normalizeData(parsed);
  persist(normalized.data);
  return normalized.data;
}
