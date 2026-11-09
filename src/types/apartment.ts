export type UserRole = 'admin' | 'user' | 'watchman';

export interface FlatWaterData {
  flat: number;
  closing_reading: number;
  opening_reading: number;
  liters: number;
  avg_per_day: number;
  water_charge: number;
  mandatory_maintenance: number;
  actual_amount: number;
  pending_amount: number;
  total_payable: number;
}

export interface WaterStatement {
  sheet_name: string;
  title: string;
  reading_date: string | null;
  days: number;
  tanker_bill: number;
  electricity_bill: number;
  common_utilization: number;
  net_electricity: number;
  mandatory_maintenance: number;
  total_water_consumption_liters: number;
  avg_per_day_liters: number;
  liter_per_charge: number;
  flats: FlatWaterData[];
  readings_complete: boolean;
}

export type PaymentChannel = 'Cash' | 'Online' | 'Bank';
export type PaymentMode = PaymentChannel | 'Due';

export interface PaymentReceipt {
  id: string;
  amount: number;
  mode: PaymentChannel;
  date?: string;
  notes?: string;
}

export interface FlatMaintenanceData {
  flat: number;
  actual: number;
  paid: number;
  pending: number;
  mode: PaymentMode;
  status: 'Paid' | 'Partial' | 'Due' | 'Advance';
  payment_date?: string;
  notes?: string;
  previous_pending?: number;
  total_payable?: number;
  /** Incremental receipt history; absent on legacy rows, which remain editable as an aggregate payment. */
  receipts?: PaymentReceipt[];
}

export interface ExpenseItem {
  id?: string;
  description: string;
  amount: number;
  category: string;
  type?: 'Cash' | 'Bank';
  date?: string;
  status?: 'Paid' | 'Billed';
  paid_date?: string;
}

export interface InflowItem {
  id?: string;
  description: string;
  amount: number;
  category?: string;
  type?: 'Cash' | 'Bank';
  date?: string;
}

export interface LoanRepayment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  channel: 'Cash' | 'Bank';
  monthSheet: string; // Target billing cycle, e.g. "October 2026"
  notes?: string;
  inflow_id?: string; // Linked statement inflow
}

export interface StaffLoan {
  id: string;
  borrower_name: string; // e.g. "Laxman (Watchman)"
  designation?: string; // e.g. "Building Watchman"
  principal_amount: number; // e.g. 10000
  disbursed_date: string; // YYYY-MM-DD
  disbursed_channel: 'Cash' | 'Bank';
  disbursed_month_sheet: string; // e.g. "October 2026"
  expense_id?: string; // Linked statement expense
  notes?: string;
  status: 'Active' | 'Settled';
  repayments: LoanRepayment[];
}

export interface AuthSession {
  role: UserRole;
  flatNumber?: number;
  username?: string;
  loggedInAt: string;
}

export type CycleStatus = 'open' | 'closed' | 'legacy-closed' | 'initialization-required';

export interface CycleState {
  status: CycleStatus;
  initialized_as?: 'legacy';
  opened_at?: string;
  closed_at?: string;
  close_reason?: string;
  closed_by?: string;
  closed_cash_balance?: number;
  closed_bank_balance?: number;
}

export interface CycleAuditEvent {
  id: string;
  month: string;
  action: 'opened' | 'closed' | 'reopened' | 'legacy.initialized' | 'expense.created' | 'expense.updated' | 'expense.deleted' | 'inflow.created' | 'inflow.updated' | 'inflow.deleted' | 'transfer.created' | 'transfer.updated' | 'transfer.deleted' | 'payment.updated' | 'water.updated' | 'contact.saved' | 'contact.deleted' | 'config.created' | 'balance.adjusted' | 'loan.created' | 'loan.repayment' | 'loan.deleted' | 'loan.repayment.deleted';
  occurred_at: string;
  actor: string;
  reason?: string;
  record_id?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface BalanceTransfer {
  id: string;
  description: string;
  amount: number;
  from: 'Cash' | 'Bank';
  to: 'Cash' | 'Bank';
  date: string;
}

export interface MaintenanceStatement {
  sheet_name: string;
  title: string;
  flats: FlatMaintenanceData[];
  inflows: InflowItem[];
  expenses: ExpenseItem[];
  cash_opening: number;
  bank_opening: number;
  cash_total_in: number;
  bank_total_in: number;
  cash_total_out: number;
  bank_total_out: number;
  cash_balance: number;
  bank_balance: number;
  total_balance: number;
  transfers?: BalanceTransfer[];
  opening_dues?: Record<number, number>;
  legacy_previous_dues?: boolean;
  dues_list: { item: string; amount: number }[];
}

export interface DirectoryContact {
  id: string;
  category: 'Plumber' | 'Electrician' | 'Water Tanker' | 'Elevator / Lift' | 'Security & Watchman' | 'Sanitation' | 'Borewell & Motors' | 'Committee' | 'Other';
  name: string;
  phone: string;
  alternate_phone?: string;
  notes?: string;
  available_hours?: string;
}

export interface BillingConfigEntry {
  id: string;
  effective_from: string; // e.g. "2024-03" or "2024-12"
  mandatory_maintenance: number;
  common_utilization: number;
  changed_at: string;
  changed_by: string;
  notes?: string;
}

export interface ApartmentData {
  apartment_name: string;
  total_flats: number;
  flats: number[];
  water_statements: WaterStatement[];
  maintenance_statements: MaintenanceStatement[];
  cycles: Record<string, CycleState>;
  contacts: DirectoryContact[];
  billing_config_history: BillingConfigEntry[];
  staff_loans?: StaffLoan[];
  cycle_audit?: CycleAuditEvent[];
  extracted_at: string;
}
