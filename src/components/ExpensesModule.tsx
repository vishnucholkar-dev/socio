import React, { useState } from 'react';
import { MaintenanceStatement, ExpenseItem, UserRole, CycleStatus, InflowItem, BalanceTransfer } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR } from '../services/calculations';
import { DollarSign, Wallet, CreditCard, Plus, Search, AlertCircle, CheckCircle2, TrendingUp } from './Icons';

interface ExpensesModuleProps {
  currentRole: UserRole;
  selectedMonth: string;
  allMaintenanceStatements: MaintenanceStatement[];
  onAddExpense: (monthSheet: string, expense: ExpenseItem) => boolean;
  onUpdateExpense: (month: string, id: string, expense: ExpenseItem) => boolean;
  onDeleteExpense: (month: string, id: string) => boolean;
  onAddInflow: (month: string, inflow: InflowItem) => boolean;
  onUpdateInflow: (month: string, id: string, inflow: InflowItem) => boolean;
  onDeleteInflow: (month: string, id: string) => boolean;
  onAddTransfer: (month: string, transfer: Omit<BalanceTransfer, 'id'>) => boolean;
  onUpdateTransfer: (month: string, id: string, transfer: Omit<BalanceTransfer, 'id'>) => boolean;
  onDeleteTransfer: (month: string, id: string) => boolean;
  cycleStatus?: CycleStatus;
  openCycles?: string[];
  onOpenCycle?: (month: string) => void;
  allowOpenAction?: boolean;
}

const PRESET_EXPENSE_CATEGORIES = [
  'Water Tankers',
  'Security & Watchman',
  'Staff Salary (Laxman)',
  'Electricity / Power',
  'Garbage Collection',
  'Lift AMC',
  'Borewell & Motor',
  'Plumbing',
  'Electrical',
  'Cleaning & Housekeeping',
  'Maintenance & Repairs',
  'Miscellaneous'
];

const PRESET_INFLOW_CATEGORIES = [
  'Vendor Ad Rent (Lift / Gate Displays)',
  'Bank Savings Interest',
  'Scrap & Recyclable Sales',
  'Festival & Event Contributions',
  'Move-in / Move-out Charges',
  'Clubhouse / Terrace Booking',
  'Donation & Sponsorship',
  'Miscellaneous Society Inflow'
];

function getFirstOfMonth(monthLabel: string): string {
  const d = new Date(`${monthLabel} 1 UTC`);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function getLastOfMonth(monthLabel: string): string {
  const d = new Date(`${monthLabel} 1 UTC`);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export const ExpensesModule: React.FC<ExpensesModuleProps> = ({
  currentRole,
  selectedMonth,
  allMaintenanceStatements,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddInflow,
  onUpdateInflow,
  onDeleteInflow,
  onAddTransfer,
  onUpdateTransfer,
  onDeleteTransfer,
  cycleStatus = 'legacy-closed',
  openCycles,
  onOpenCycle,
  allowOpenAction = false
}) => {
  const matchingStatements = allMaintenanceStatements.filter(m => sameCalendarMonth(m.sheet_name, selectedMonth));
  const currentStatement = matchingStatements.length === 1 ? matchingStatements[0] : undefined;
  const canEdit = currentRole === 'admin' && cycleStatus === 'open' && matchingStatements.length === 1;

  const [activeTab, setActiveTab] = useState<'all' | 'Cash' | 'Bank'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetCycle, setTargetCycle] = useState<string>(selectedMonth);
  const [entryDate, setEntryDate] = useState<string>(() => getFirstOfMonth(selectedMonth));
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState<number>(0);
  const [category, setCategory] = useState('Water Tankers');
  const [inflowCategory, setInflowCategory] = useState('Vendor Ad Rent (Lift / Gate Displays)');
  const [expenseType, setExpenseType] = useState<'Cash' | 'Bank'>('Cash');
  const [entryKind, setEntryKind] = useState<'expense' | 'inflow' | 'transfer'>('expense');
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [inflowDescription, setInflowDescription] = useState('');
  const [inflowAmount, setInflowAmount] = useState<number>(0);
  const [inflowType, setInflowType] = useState<'Cash' | 'Bank'>('Cash');
  const [transferDescription, setTransferDescription] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferFrom, setTransferFrom] = useState<'Cash' | 'Bank'>('Cash');
  const [editingInflowId, setEditingInflowId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);

  if (!currentStatement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
        <h3 className="text-lg font-bold text-slate-800">{matchingStatements.length > 1 ? 'Duplicate Statements Found' : 'No Statement Available'}</h3>
        <p className="text-sm text-slate-500">{matchingStatements.length > 1 ? 'Editing is disabled until the duplicate month data is reconciled.' : 'Please choose another month from the top bar.'}</p>
      </div>
    );
  }

  // Filter expenses
  const filteredExpenses = currentStatement.expenses.filter(e => {
    if (activeTab !== 'all' && (e.type || 'Cash') !== activeTab) return false;
    if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
    if (searchQuery && !e.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalExpenseAmount = currentStatement.expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  // Category aggregations
  const categoryTotals: { [key: string]: number } = {};
  currentStatement.expenses.forEach(e => {
    const cat = e.category || 'Miscellaneous';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
  });

  // Inflow category aggregations
  const inflowCategoryTotals: { [key: string]: number } = {};
  currentStatement.inflows.forEach(i => {
    const cat = i.category || 'Miscellaneous Society Inflow';
    inflowCategoryTotals[cat] = (inflowCategoryTotals[cat] || 0) + (i.amount || 0);
  });

  const handleTargetCycleChange = (newCycle: string) => {
    setTargetCycle(newCycle);
    setEntryDate(getFirstOfMonth(newCycle));
  };

  const openNewEntry = (kind: 'expense' | 'inflow' | 'transfer') => {
    const initialCycle = (openCycles && openCycles.includes(selectedMonth)) ? selectedMonth : (openCycles?.[0] || selectedMonth);
    setTargetCycle(initialCycle);
    setEntryDate(getFirstOfMonth(initialCycle));
    setEntryKind(kind);
    setEditingExpense(null);
    setEditingExpenseId(null);
    setEditingInflowId(null);
    setEditingTransferId(null);
    setDesc('');
    setAmt(0);
    setCategory('Water Tankers');
    setInflowCategory('Vendor Ad Rent (Lift / Gate Displays)');
    setExpenseType('Cash');
    setInflowDescription('');
    setInflowAmount(0);
    setInflowType('Cash');
    setTransferDescription('');
    setTransferAmount(0);
    setTransferFrom('Cash');
    setShowAddModal(true);
  };

  const openEditExpense = (expense: ExpenseItem, index: number) => {
    if (!canEdit) return;
    setEntryKind('expense');
    setTargetCycle(currentStatement.sheet_name);
    setEntryDate(expense.date || getFirstOfMonth(currentStatement.sheet_name));
    setEditingExpense({ ...expense });
    setEditingExpenseId(expense.id || `legacy-exp-${currentStatement.expenses.indexOf(expense)}` || `legacy-exp-${index}`);
    setEditingInflowId(null);
    setEditingTransferId(null);
    setDesc(expense.description);
    setAmt(expense.amount);
    setCategory(expense.category || 'Miscellaneous');
    setExpenseType(expense.type || 'Cash');
    setShowAddModal(true);
  };

  const openEditInflow = (inflow: InflowItem, index: number) => {
    if (!canEdit) return;
    setEntryKind('inflow');
    setTargetCycle(currentStatement.sheet_name);
    setEntryDate(inflow.date || getFirstOfMonth(currentStatement.sheet_name));
    setEditingExpense(null);
    setEditingExpenseId(null);
    setEditingTransferId(null);
    setEditingInflowId(inflow.id || `legacy-in-${index}`);
    setInflowDescription(inflow.description);
    setInflowAmount(inflow.amount);
    setInflowType(inflow.type || 'Cash');
    setInflowCategory(inflow.category || 'Miscellaneous Society Inflow');
    setShowAddModal(true);
  };

  const openEditTransfer = (transfer: BalanceTransfer, index: number) => {
    if (!canEdit) return;
    setEntryKind('transfer');
    setTargetCycle(currentStatement.sheet_name);
    setEntryDate(transfer.date || getFirstOfMonth(currentStatement.sheet_name));
    setEditingExpense(null);
    setEditingExpenseId(null);
    setEditingInflowId(null);
    setEditingTransferId(transfer.id || `legacy-transfer-${index}`);
    setTransferDescription(transfer.description);
    setTransferAmount(transfer.amount);
    setTransferFrom(transfer.from);
    setShowAddModal(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    let saved = false;
    const saveMonth = editingExpenseId || editingInflowId || editingTransferId ? currentStatement.sheet_name : targetCycle;

    if (entryKind === 'expense') {
      if (!desc.trim() || !Number.isFinite(amt) || amt <= 0) return;
      const next: ExpenseItem = {
        ...(editingExpense || {}),
        description: desc.trim(),
        amount: amt,
        category,
        type: expenseType,
        date: entryDate
      };
      saved = editingExpenseId ? onUpdateExpense(saveMonth, editingExpenseId, next) : onAddExpense(saveMonth, next);
    } else if (entryKind === 'inflow') {
      if (!inflowDescription.trim() || !Number.isFinite(inflowAmount) || inflowAmount <= 0) return;
      const next: InflowItem = {
        description: inflowDescription.trim(),
        amount: inflowAmount,
        type: inflowType,
        category: inflowCategory,
        date: entryDate
      };
      saved = editingInflowId ? onUpdateInflow(saveMonth, editingInflowId, next) : onAddInflow(saveMonth, next);
    } else {
      if (!Number.isFinite(transferAmount) || transferAmount <= 0) return;
      const destination: 'Cash' | 'Bank' = transferFrom === 'Cash' ? 'Bank' : 'Cash';
      const next = {
        description: transferDescription.trim() || `Transfer ${transferFrom} to ${destination}`,
        amount: transferAmount,
        from: transferFrom,
        to: destination,
        date: entryDate
      };
      saved = editingTransferId ? onUpdateTransfer(saveMonth, editingTransferId, next) : onAddTransfer(saveMonth, next);
    }

    if (!saved) return;
    setDesc('');
    setAmt(0);
    setShowAddModal(false);
    setEditingExpense(null);
    setEditingExpenseId(null);
    setEditingInflowId(null);
    setEditingTransferId(null);
    setInflowDescription('');
    setInflowAmount(0);
    setTransferDescription('');
    setTransferAmount(0);
  };

  return (
    <div className="space-y-6">
      {cycleStatus !== 'open' && (
        allowOpenAction && onOpenCycle && currentRole === 'admin' ? (
          <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-900">
            <div>
              <span className="font-bold block">
                This cycle is currently awaiting activation.
              </span>
              <span className="text-xs text-amber-800">
                Click the button on the right to open this cycle and enable adding expenses and inflows.
              </span>
            </div>

            <button
              onClick={() => onOpenCycle(selectedMonth)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all"
            >
              🚀 Open Cycle & Enable Editing
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-2xs flex items-center space-x-3 text-slate-700">
            <span className="p-2 bg-slate-200/70 rounded-xl text-slate-700 text-sm">🔒</span>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {selectedMonth} is Finalized & Closed
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All financial records, receipts, and inflows for this period are safely locked and archived.
              </p>
            </div>
          </div>
        )
      )}
      {matchingStatements.length > 1 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Duplicate statements exist for this calendar month. Financial edits are disabled.</div>}
      {/* Liquidity & Balance Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Cash in Hand */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Cash in Hand (IA-EA)</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            {formatINR(currentStatement.cash_balance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Available gate/petty cash</p>
        </div>

        {/* Bank Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Bank Balance (IB-EB)</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <CreditCard size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">
            {formatINR(currentStatement.bank_balance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Society savings account</p>
        </div>

        {/* Total Liquid Funds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 uppercase">Total Liquid Funds</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-purple-700 mt-2">
            {formatINR(currentStatement.total_balance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Cash + Bank combined</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase">Month Outflows</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingUp size={18} />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">
            {formatINR(totalExpenseAmount)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{currentStatement.expenses.length} itemized items</p>
        </div>
      </div>

      {/* Top Expense Categories Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Spending by Category • {currentStatement.title || currentStatement.sheet_name}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCategory === cat
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <p className="text-[11px] font-medium text-slate-500 truncate">{cat}</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{formatINR(amount)}</p>
              </button>
            ))}
        </div>
      </div>

      {/* Filter and Add Expense Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between no-print">
        <div className="flex items-center space-x-1 w-full sm:w-auto">
          {(['all', 'Cash', 'Bank'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'all' ? 'All Expenses' : tab === 'Cash' ? 'Cash Expenses (EA)' : 'Bank Expenses (EB)'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-44"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {canEdit && <div className="flex flex-wrap gap-2">
            <button onClick={() => openNewEntry('expense')} className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"><Plus size={15} /><span>Add Expense</span></button>
            <button onClick={() => openNewEntry('inflow')} className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm"><Plus size={15} /><span>Add Inflow</span></button>
            <button onClick={() => openNewEntry('transfer')} className="flex items-center space-x-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-sm"><span>⇄</span><span>Transfer</span></button>
          </div>}
        </div>
      </div>

      {/* Itemized Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Itemized Outflows & Bills</h3>
            <p className="text-xs text-slate-500">Verified cash payments and bank transfers for society operations</p>
          </div>
          <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
            {filteredExpenses.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Expense Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Payment Channel</th>
                <th className="py-3 px-4 text-right">Amount</th>
                {canEdit && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-slate-400">
                    No expense records found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, idx) => (
                  <tr key={exp.id || `legacy-exp-${currentStatement.expenses.indexOf(exp)}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{exp.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {exp.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          (exp.type || 'Cash') === 'Cash'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {(exp.type || 'Cash') === 'Cash' ? <Wallet size={12} /> : <CreditCard size={12} />}
                        <span>{exp.type || 'Cash'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black font-mono text-slate-900 text-sm">
                      {formatINR(exp.amount)}
                    </td>
                    {canEdit && <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button onClick={() => openEditExpense(exp, currentStatement.expenses.indexOf(exp))} className="text-blue-700 font-semibold mr-3">Edit</button>
                      <button onClick={() => { if (window.confirm(`Delete expense “${exp.description}”?`)) onDeleteExpense(currentStatement.sheet_name, exp.id || `legacy-exp-${currentStatement.expenses.indexOf(exp)}`); }} className="text-rose-700 font-semibold">Delete</button>
                    </td>}
                  </tr>
                ))
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-black border-t-2 border-slate-300">
                  <td colSpan={4} className="py-3 px-4 text-slate-800 uppercase text-[11px]">
                    Total Filtered Outflows
                  </td>
                  <td className="py-3 px-4 text-right font-black font-mono text-rose-600 text-base">
                    {formatINR(filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Itemized Inflows */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div><h3 className="font-bold text-slate-900 text-sm">Itemized Inflows & Receipts</h3><p className="text-xs text-slate-500">Cash and bank income recorded for this cycle</p></div>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">{currentStatement.inflows.length} Records</span>
        </div>

        {/* Top Inflow Categories Breakdown */}
        {Object.keys(inflowCategoryTotals).length > 0 && (
          <div className="p-4 bg-slate-50/50 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Inflows by Category</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(inflowCategoryTotals).map(([cat, amount]) => (
                <div key={cat} className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <p className="text-[10px] font-medium text-slate-500 truncate">{cat}</p>
                  <p className="text-xs font-bold text-emerald-700 mt-0.5">{formatINR(amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200"><th className="py-3 px-4">Date</th><th className="py-3 px-4">Inflow Description</th><th className="py-3 px-4">Category</th><th className="py-3 px-4">Account</th><th className="py-3 px-4 text-right">Amount</th>{canEdit && <th className="py-3 px-4 text-right">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">{currentStatement.inflows.length === 0 ? <tr><td colSpan={canEdit ? 6 : 5} className="py-6 text-center text-slate-400">No inflows recorded.</td></tr> : currentStatement.inflows.map((inflow, index) => <tr key={inflow.id || `legacy-in-${index}`} className="hover:bg-slate-50"><td className="py-3 px-4 font-mono text-slate-500">{inflow.date || '—'}</td><td className="py-3 px-4 font-semibold text-slate-900">{inflow.description}</td><td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">{inflow.category || 'Miscellaneous'}</span></td><td className="py-3 px-4">{inflow.type || 'Cash'}</td><td className="py-3 px-4 text-right font-bold text-emerald-700">{formatINR(inflow.amount)}</td>{canEdit && <td className="py-3 px-4 text-right whitespace-nowrap"><button onClick={() => openEditInflow(inflow, index)} className="text-blue-700 font-semibold mr-3">Edit</button><button onClick={() => { if (window.confirm(`Delete inflow “${inflow.description}”?`)) onDeleteInflow(currentStatement.sheet_name, inflow.id || `legacy-in-${index}`); }} className="text-rose-700 font-semibold">Delete</button></td>}</tr>)}</tbody>
        </table></div>
      </div>

      {/* Itemized Cash/Bank Transfers */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div><h3 className="font-bold text-slate-900 text-sm">Cash/Bank Transfers</h3><p className="text-xs text-slate-500">Internal transfers between society accounts</p></div>
          <span className="text-xs font-bold bg-violet-100 text-violet-800 px-2.5 py-1 rounded-full">{(currentStatement.transfers || []).length} Records</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200"><th className="py-3 px-4">Transfer Description</th><th className="py-3 px-4">From → To</th><th className="py-3 px-4">Date</th><th className="py-3 px-4 text-right">Amount</th>{canEdit && <th className="py-3 px-4 text-right">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">{!(currentStatement.transfers || []).length ? <tr><td colSpan={canEdit ? 5 : 4} className="py-6 text-center text-slate-400">No transfers recorded.</td></tr> : currentStatement.transfers!.map((transfer, index) => <tr key={transfer.id || `legacy-transfer-${index}`} className="hover:bg-slate-50"><td className="py-3 px-4 font-semibold text-slate-900">{transfer.description}</td><td className="py-3 px-4">{transfer.from} → {transfer.to}</td><td className="py-3 px-4">{transfer.date}</td><td className="py-3 px-4 text-right font-bold text-violet-700">{formatINR(transfer.amount)}</td>{canEdit && <td className="py-3 px-4 text-right whitespace-nowrap"><button onClick={() => openEditTransfer(transfer, index)} className="text-blue-700 font-semibold mr-3">Edit</button><button onClick={() => { if (window.confirm(`Delete transfer “${transfer.description}”?`)) onDeleteTransfer(currentStatement.sheet_name, transfer.id || `legacy-transfer-${index}`); }} className="text-rose-700 font-semibold">Delete</button></td>}</tr>)}</tbody>
        </table></div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">{editingExpense ? 'Edit' : 'Add'} {entryKind === 'expense' ? 'Expense' : entryKind === 'inflow' ? 'Inflow' : 'Cash/Bank Transfer'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update the {entryKind} ledger for {currentStatement.sheet_name}
            </p>

            <form onSubmit={handleSaveEntry} className="mt-4 space-y-4">
              {openCycles && openCycles.length > 1 && !editingExpenseId && !editingInflowId && !editingTransferId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Billing Cycle</label>
                  <select
                    value={targetCycle}
                    onChange={(e) => handleTargetCycleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  >
                    {openCycles.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Date</label>
                <input
                  type="date"
                  min={getFirstOfMonth(targetCycle)}
                  max={getLastOfMonth(targetCycle)}
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {entryKind !== 'transfer' && <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{entryKind === 'expense' ? 'Expense Description' : 'Inflow Description'}</label>
                <input
                  type="text"
                  placeholder="e.g. Water Tanker 2 loads, Sump motor capacitor"
                  value={entryKind === 'expense' ? desc : inflowDescription}
                  onChange={(e) => entryKind === 'expense' ? setDesc(e.target.value) : setInflowDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 2500"
                  value={entryKind === 'expense' ? (amt || '') : entryKind === 'inflow' ? (inflowAmount || '') : (transferAmount || '')}
                  onChange={(e) => { const value = Number(e.target.value); if (entryKind === 'expense') setAmt(value); else if (entryKind === 'inflow') setInflowAmount(value); else setTransferAmount(value); }}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {entryKind === 'expense' && <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  {PRESET_EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>}

              {entryKind === 'inflow' && <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inflow Category</label>
                <select
                  value={inflowCategory}
                  onChange={(e) => setInflowCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  {PRESET_INFLOW_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>}

              {entryKind === 'expense' ? <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Paid Via</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseType('Cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      expenseType === 'Cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Wallet size={15} />
                    <span>Cash (EA)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType('Bank')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      expenseType === 'Bank'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard size={15} />
                    <span>Bank (EB)</span>
                  </button>
                </div>
              </div> : entryKind === 'inflow' ? <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Received Into</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'Bank'] as const).map(channel => <button key={channel} type="button" onClick={() => setInflowType(channel)} className={`py-2 px-3 rounded-xl border text-xs font-bold ${inflowType === channel ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>{channel}</button>)}
                </div>
              </div> : <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer From</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'Bank'] as const).map(channel => <button key={channel} type="button" onClick={() => setTransferFrom(channel)} className={`py-2 px-3 rounded-xl border text-xs font-bold ${transferFrom === channel ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'}`}>{channel} → {channel === 'Cash' ? 'Bank' : 'Cash'}</button>)}
                </div>
              </div>}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  {editingExpense ? 'Save Changes' : entryKind === 'inflow' ? 'Save Inflow' : entryKind === 'transfer' ? 'Save Transfer' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
