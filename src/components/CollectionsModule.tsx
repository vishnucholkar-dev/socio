import React, { useState } from 'react';
import { MaintenanceStatement, FlatMaintenanceData, UserRole, WaterStatement, CycleStatus, PaymentChannel } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR } from '../services/calculations';
import { Receipt, CheckCircle2, AlertCircle, Printer, DollarSign, Wallet, CreditCard, Search, ArrowRight } from './Icons';

interface CollectionsModuleProps {
  currentRole: UserRole;
  selectedMonth: string;
  allMaintenanceStatements: MaintenanceStatement[];
  allWaterStatements: WaterStatement[];
  selectedFlat: number;
  onRecordPayment: (monthSheet: string, flatNumber: number, paidAmount: number, mode: PaymentChannel, notes?: string) => boolean;
  cycleStatus?: CycleStatus;
}

export const CollectionsModule: React.FC<CollectionsModuleProps> = ({
  currentRole,
  selectedMonth,
  allMaintenanceStatements,
  allWaterStatements,
  selectedFlat,
  onRecordPayment,
  cycleStatus = 'legacy-closed'
}) => {
  const matchingStatements = allMaintenanceStatements.filter(m => sameCalendarMonth(m.sheet_name, selectedMonth));
  const currentStatement = matchingStatements.length === 1 ? matchingStatements[0] : undefined;
  const matchingWater = allWaterStatements.filter(w => sameCalendarMonth(w.sheet_name, selectedMonth));
  const currentWater = matchingWater.length === 1 ? matchingWater[0] : undefined;
  const canEdit = cycleStatus === 'open' && currentRole !== 'user' && matchingStatements.length === 1;

  const [filterFloor, setFilterFloor] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Paid' | 'Due'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Recording Modal State
  const [activePaymentFlat, setActivePaymentFlat] = useState<FlatMaintenanceData | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<PaymentChannel>('Online');
  const [payNotes, setPayNotes] = useState<string>('');

  // Receipt Modal State
  const [receiptFlat, setReceiptFlat] = useState<FlatMaintenanceData | null>(null);

  if (!currentStatement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
        <h3 className="text-lg font-bold text-slate-800">No Statement Available</h3>
        <p className="text-sm text-slate-500">Please choose another month from the top bar.</p>
      </div>
    );
  }

  // Filter flats
  const filteredFlats = currentStatement.flats.filter(f => {
    const floor = Math.floor(f.flat / 100);
    if (filterFloor !== 'all' && floor !== filterFloor) return false;
    if (filterStatus === 'Paid' && f.pending > 1) return false;
    if (filterStatus === 'Due' && f.pending <= 1) return false;
    if (searchQuery && !f.flat.toString().includes(searchQuery)) return false;
    return true;
  });

  // Calculate totals
  const totalBilled = currentStatement.flats.reduce((acc, f) => acc + (f.actual || 0), 0);
  const totalCollected = currentStatement.flats.reduce((acc, f) => acc + (f.paid || 0), 0);
  const totalPending = currentStatement.flats.reduce((acc, f) => acc + (f.pending || 0), 0);
  const paidCount = currentStatement.flats.filter(f => f.pending <= 1).length;

  const handleOpenPayment = (flat: FlatMaintenanceData) => {
    setActivePaymentFlat(flat);
    setPayAmount(flat.pending > 0 ? flat.pending : 0);
    setPayMode(flat.mode === 'Due' ? 'Online' : flat.mode);
    setPayNotes(flat.notes || '');
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentFlat || !canEdit) return;
    if (onRecordPayment(currentStatement.sheet_name, activePaymentFlat.flat, payAmount, payMode, payNotes)) setActivePaymentFlat(null);
  };

  return (
    <div className="space-y-6">
      {cycleStatus !== 'open' && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">This cycle is {cycleStatus === 'initialization-required' ? 'pending explicit initialization by an administrator' : cycleStatus === 'legacy-closed' ? 'legacy closed and locked' : cycleStatus || 'not open'}; collections are view-only.</div>}
      {matchingStatements.length > 1 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Duplicate maintenance statements were found for this calendar month. No payments can be recorded.</div>}
      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Billed</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt size={18} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatINR(totalBilled)}</p>
          <p className="text-xs text-slate-400 mt-1">32 Flats Maintenance</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase">Collected</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatINR(totalCollected)}</p>
          <p className="text-xs text-slate-400 mt-1">{paidCount} of 32 flats paid</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase">Pending Dues</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle size={18} />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{formatINR(totalPending)}</p>
          <p className="text-xs text-slate-400 mt-1">{32 - paidCount} flats pending</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Collection Rate</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign size={18} />
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-700 mt-2">
            {totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0}%
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-purple-600 h-1.5 rounded-full"
              style={{ width: `${totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between no-print">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Floor filter */}
          <span className="text-xs font-semibold text-slate-500 mr-1">Floor:</span>
          {(['all', 4, 3, 2, 1] as const).map(fl => (
            <button
              key={fl}
              onClick={() => setFilterFloor(fl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterFloor === fl
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {fl === 'all' ? 'All Floors' : `${fl}th Floor`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 border-0 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="Paid">Paid Only</option>
            <option value="Due">Pending Dues Only</option>
          </select>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search Flat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-28 sm:w-36"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* 32-Flat Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {filteredFlats.map(flat => {
          const isPaid = flat.pending <= 1;
          const isSelected = currentRole === 'user' && flat.flat === selectedFlat;

          return (
            <div
              key={flat.flat}
              className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all relative ${
                isSelected
                  ? 'ring-2 ring-blue-600 border-blue-400 bg-blue-50/20'
                  : isPaid
                  ? 'border-emerald-200/80'
                  : 'border-rose-200/80'
              }`}
            >
              {/* Header: Flat # & Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-slate-900">
                  Flat {flat.flat}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800'
                      : flat.paid > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isPaid ? 'Paid' : flat.paid > 0 ? 'Partial' : 'Due'}
                </span>
              </div>

              {/* Amount Breakdown */}
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Actual Bill:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatINR(flat.actual)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Paid:</span>
                  <span className="font-semibold text-emerald-600 font-mono">{formatINR(flat.paid)}</span>
                </div>
                <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-100">
                  <span className="font-medium text-slate-700">Pending:</span>
                  <span className={`font-bold font-mono ${flat.pending > 1 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatINR(flat.pending)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Mode:</span>
                  <span className="font-medium text-slate-600">{flat.receipts?.length ? `${flat.receipts.length} receipt(s)` : flat.mode || 'N/A'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 no-print">
                <button
                  onClick={() => setReceiptFlat(flat)}
                  className="flex-1 flex items-center justify-center space-x-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors"
                >
                  <Receipt size={13} />
                  <span>Receipt</span>
                </button>

                {canEdit && (
                  <button
                    onClick={() => handleOpenPayment(flat)}
                    className="flex-1 flex items-center justify-center space-x-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    <DollarSign size={13} />
                    <span>Pay</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Recording Modal */}
      {activePaymentFlat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">Record Maintenance Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Flat {activePaymentFlat.flat} • {currentStatement.title || currentStatement.sheet_name}
            </p>

            <form onSubmit={handleSubmitPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMode('Online')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      payMode === 'Online'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard size={15} />
                    <span>Online (UPI/Bank)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMode('Bank')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      payMode === 'Bank'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard size={15} />
                    <span>Bank Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMode('Cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      payMode === 'Cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Wallet size={15} />
                    <span>Cash</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Ref / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref 412984, Handed to Watchman"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentFlat(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Confirm & Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Maintenance Receipt & Bill Modal */}
      {receiptFlat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 relative my-8">
            {/* Print Header */}
            <div className="text-center pb-4 border-b-2 border-slate-800">
              <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600">
                Official Maintenance Receipt
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                ROCKCLIFF 'B' BLOCK RESIDENTS ASSOCIATION
              </h2>
              <p className="text-[11px] text-slate-500">
                Hyderabad • 32 Flats Maintenance & Water Utility Bill
              </p>
            </div>

            {/* Receipt Metadata */}
            {(() => {
              const latestReceipt = receiptFlat.receipts && receiptFlat.receipts.length > 0 ? receiptFlat.receipts[receiptFlat.receipts.length - 1] : null;
              const mandatoryRate = currentWater?.mandatory_maintenance || 1400;
              return (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs py-3 border-b border-slate-200">
                    <div>
                      <p className="text-slate-400">Flat Number:</p>
                      <p className="text-base font-black text-slate-900">Flat {receiptFlat.flat}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Statement Period:</p>
                      <p className="font-bold text-slate-900">{currentStatement.title || currentStatement.sheet_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Receipt No:</p>
                      <p className="font-mono font-bold text-slate-700">{latestReceipt?.id || `RC-B-${receiptFlat.flat}-${Date.now().toString().slice(-4)}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Date Issued:</p>
                      <p className="font-medium text-slate-700">{latestReceipt?.date || new Date().toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Charges Breakdown */}
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Billing Breakdown</h4>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2 text-slate-600">Fixed Mandatory Maintenance</td>
                          <td className="py-2 text-right font-mono font-medium">{formatINR(mandatoryRate)}</td>
                        </tr>
                        {currentWater && (
                          <tr>
                            <td className="py-2 text-slate-600">
                              Water Consumption Charge
                              {currentWater.flats.find(f => f.flat === receiptFlat.flat) && (
                                <span className="block text-[10px] text-slate-400">
                                  {currentWater.flats.find(f => f.flat === receiptFlat.flat)?.liters.toLocaleString()} Liters @ {formatINR(currentWater.liter_per_charge)}/L
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right font-mono font-medium">
                              {formatINR(Math.max(0, receiptFlat.actual - mandatoryRate))}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-50 font-bold">
                          <td className="py-2 px-2 text-slate-900">Total Month Bill</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-900">{formatINR(receiptFlat.actual)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-emerald-700 font-semibold">Amount Paid</td>
                          <td className="py-2 text-right font-mono font-bold text-emerald-700">{formatINR(receiptFlat.paid)}</td>
                        </tr>
                        <tr className="border-t-2 border-slate-800 font-black">
                          <td className="py-2.5 text-slate-900">Balance Pending Due</td>
                          <td className={`py-2.5 text-right font-mono ${receiptFlat.pending > 1 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {formatINR(receiptFlat.pending)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {receiptFlat.receipts && receiptFlat.receipts.length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Receipt History ({receiptFlat.receipts.length})</p>
                        <div className="space-y-1">
                          {receiptFlat.receipts.map((r, i) => (
                            <div key={r.id || i} className="flex justify-between text-[11px] text-slate-600">
                              <span>{r.date} • {r.mode}{r.notes ? ` (${r.notes})` : ''}</span>
                              <span className="font-mono font-semibold text-emerald-700">{formatINR(r.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Payment Mode & Status Stamp */}
            <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Payment Mode: </span>
                <span className="font-bold text-slate-800">{receiptFlat.mode || 'Pending'}</span>
                {receiptFlat.notes && (
                  <p className="text-[10px] text-slate-500 mt-0.5">Ref: {receiptFlat.notes}</p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider ${
                receiptFlat.pending <= 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {receiptFlat.pending <= 1 ? 'PAID & CLEARED' : 'PAYMENT DUE'}
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-8 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 text-center text-[11px] text-slate-500">
              <div>
                <div className="h-10"></div>
                <p className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Resident / Payee</p>
              </div>
              <div>
                <div className="h-10"></div>
                <p className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Treasurer / Management Committee</p>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-200 no-print">
              <button
                onClick={() => setReceiptFlat(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
