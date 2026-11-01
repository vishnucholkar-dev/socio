import React, { useMemo, useState } from 'react';
import { ApartmentData, MaintenanceStatement, WaterStatement } from '../types/apartment';
import { formatINRExact } from '../services/calculations';
import { monthSortKey, sameCalendarMonth } from '../services/storage';

interface Props {
  data: ApartmentData;
  month: string;
  isAdmin: boolean;
  onCloseCycle: (month: string, note: string) => void;
  onOpenNext: (month: string) => void;
  onReopen: (month: string, reason: string) => void;
  onOpenCycle?: (month: string, reason?: string) => void;
  onInitializeCycle?: (month: string, targetStatus: 'open' | 'closed' | 'legacy-closed', reason: string) => void;
}

function balanceReview(statement?: MaintenanceStatement) {
  if (!statement) return { cash: 0, bank: 0, recordedCash: 0, recordedBank: 0 };
  const sumPayments = (channel: 'Cash' | 'Bank') => statement.flats.reduce((sum, flat) => {
    if (flat.receipts) return sum + flat.receipts.reduce((receiptSum, receipt) => {
      const receiptChannel = receipt.mode === 'Cash' ? 'Cash' : 'Bank';
      return receiptChannel === channel ? receiptSum + receipt.amount : receiptSum;
    }, 0);
    const flatChannel = flat.mode === 'Cash' ? 'Cash' : flat.mode === 'Online' || flat.mode === 'Bank' ? 'Bank' : null;
    return sum + (flatChannel === channel ? (flat.paid || 0) : 0);
  }, 0);
  const calc = (channel: 'Cash' | 'Bank') => {
    const opening = channel === 'Cash' ? statement.cash_opening : statement.bank_opening;
    const inflows = statement.inflows.reduce((sum, item) => sum + ((item.type || 'Cash') === channel ? item.amount : 0), 0);
    const expenses = statement.expenses.reduce((sum, item) => sum + ((item.type || 'Cash') === channel ? item.amount : 0), 0);
    const transfers = (statement.transfers || []).reduce((sum, item) => sum + (item.to === channel ? item.amount : 0) - (item.from === channel ? item.amount : 0), 0);
    return Math.round((opening + sumPayments(channel) + inflows - expenses + transfers + Number.EPSILON) * 100) / 100;
  };
  return { cash: calc('Cash'), bank: calc('Bank'), recordedCash: statement.cash_balance, recordedBank: statement.bank_balance };
}

export const CycleManagement: React.FC<Props> = ({ data, month, isAdmin, onCloseCycle, onOpenNext, onReopen, onOpenCycle, onInitializeCycle }) => {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const cycleLabel = Object.keys(data.cycles || {}).find(label => sameCalendarMonth(label, month));
  const cycle = cycleLabel ? data.cycles[cycleLabel] : undefined;
  const maintenanceMatches = data.maintenance_statements.filter(item => sameCalendarMonth(item.sheet_name, month));
  const waterMatches = data.water_statements.filter(item => sameCalendarMonth(item.sheet_name, month));
  const maintenance = maintenanceMatches.length === 1 ? maintenanceMatches[0] : undefined;
  const water = waterMatches.length === 1 ? waterMatches[0] : undefined;
  const latestMonth = useMemo(() => {
    const ordered = [...Object.keys(data.cycles || {}).sort((a, b) => monthSortKey(a) - monthSortKey(b))];
    return ordered[ordered.length - 1];
  }, [data.cycles]);
  const balances = balanceReview(maintenance);
  const readings = water?.flats || [];
  const missingReadings = data.flats.filter(flat => !readings.some(item => item.flat === flat));
  const invalidReadings = readings.filter(item => !Number.isFinite(item.opening_reading) || !Number.isFinite(item.closing_reading) || item.opening_reading < 0 || item.closing_reading < item.opening_reading);
  const mismatch = Math.abs(balances.cash - balances.recordedCash) > 0.01 || Math.abs(balances.bank - balances.recordedBank) > 0.01;
  const hasAnotherOpen = Object.entries(data.cycles || {}).some(([label, state]) => !sameCalendarMonth(label, month) && state.status === 'open');
  const events = (data.cycle_audit || []).filter(event => sameCalendarMonth(event.month, month)).slice().reverse();

  const perform = (action: () => void) => {
    setMessage('');
    setReason('');
    action();
  };

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Monthly Cycle Management</h2>
            <p className="text-sm text-slate-500 mt-1">Selected month: <strong>{month}</strong></p>
            <p className="mt-2 text-xs text-slate-600">Status: <span className={`font-bold ${cycle?.status === 'open' ? 'text-emerald-700' : cycle?.status === 'initialization-required' ? 'text-amber-700' : 'text-slate-700'}`}>{cycle?.status === 'legacy-closed' ? 'Legacy closed (locked; not verified as reconciled)' : cycle?.status === 'initialization-required' ? 'Pending explicit administrator initialization' : cycle?.status || 'No cycle'}</span></p>
            {cycle?.initialized_as === 'legacy' && <p className="text-xs text-amber-700 mt-1">This month was detected during legacy initialization; historical open/close was not fabricated.</p>}
          </div>
          {isAdmin && <div className="flex flex-wrap gap-2">
            {cycle?.status === 'initialization-required' && onInitializeCycle && <>
              <button onClick={() => perform(() => onInitializeCycle(month, 'open', reason))} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">Initialize as Open</button>
              <button onClick={() => perform(() => onInitializeCycle(month, 'closed', reason))} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Initialize as Closed</button>
              <button onClick={() => perform(() => onInitializeCycle(month, 'legacy-closed', reason))} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold">Lock as Legacy Closed</button>
            </>}
            {cycle?.status === 'open' && <button onClick={() => perform(() => onCloseCycle(month, reason))} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold">Close & lock month</button>}
            {cycle?.status !== 'open' && onOpenCycle && (
              <button onClick={() => perform(() => onOpenCycle(month, reason || `Opened ${month} for concurrent entries`))} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold">Open {month}</button>
            )}
            {cycle?.status === 'closed' && cycleLabel === latestMonth && <button onClick={() => perform(() => onReopen(month, reason))} className="px-4 py-2 rounded-lg bg-amber-600 disabled:bg-slate-300 text-white text-sm font-semibold">Reopen with reason</button>}
            {cycle?.status === 'closed' && cycleLabel === latestMonth && <button onClick={() => perform(() => onOpenNext(month))} className="px-4 py-2 rounded-lg bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold">Open next month</button>}
          </div>}
        </div>
        {isAdmin && <div className="mt-4 max-w-2xl">
          <label className="block text-xs font-semibold text-slate-700 mb-1">{cycle?.status === 'open' ? 'Close note (required if balances do not reconcile)' : cycle?.status === 'initialization-required' ? 'Initialization note / reason' : 'Required reopen reason'}</label>
          <textarea value={reason} onChange={event => setReason(event.target.value)} rows={2} placeholder={cycle?.status === 'open' ? 'Add a note if the recorded cash/bank balances differ from the activity ledger.' : cycle?.status === 'initialization-required' ? 'Explain why this cycle is being opened or closed during initial migration.' : 'Explain why this historical cycle must be reopened.'} className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
        </div>}
        {isAdmin && cycle?.status === 'open' && <p className="mt-3 text-xs text-slate-500">Closing requires explicit water-reading confirmation. Legacy balances are not silently recalculated.</p>}
        {message && <pre className={`mt-3 whitespace-pre-wrap rounded-xl p-3 text-sm ${message.startsWith('Cycle change') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{message}</pre>}
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Summary label="Opening Cash" value={maintenance?.cash_opening || 0} />
        <Summary label="Closing Cash (recorded)" value={maintenance?.cash_balance || 0} />
        <Summary label="Opening Bank" value={maintenance?.bank_opening || 0} />
        <Summary label="Closing Bank (recorded)" value={maintenance?.bank_balance || 0} />
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-900">Pre-close review</h3>
        <div className="mt-3 space-y-2 text-sm">
          <ReviewLine ok={Boolean(maintenance)} label={maintenance ? 'Maintenance/collections statement present' : 'Maintenance/collections statement missing'} />
          <ReviewLine ok={Boolean(water) && !missingReadings.length && !invalidReadings.length} label={!water ? 'Water statement missing' : missingReadings.length ? `${missingReadings.length} flat(s) missing meter readings` : invalidReadings.length ? `${invalidReadings.length} invalid meter reading(s)` : 'All flat meter readings are present and non-decreasing'} />
          <ReviewLine ok={!mismatch} label={mismatch ? `Ledger mismatch. Calculated Cash ${formatINRExact(balances.cash)} / Bank ${formatINRExact(balances.bank)}; recorded ${formatINRExact(balances.recordedCash)} / ${formatINRExact(balances.recordedBank)}. Closing requires an explanatory note.` : 'Cash and bank ledgers reconcile separately'} />
          <p className="text-xs text-slate-500 pt-2">Outstanding dues: {formatINRExact(maintenance?.flats.reduce((sum, flat) => sum + Math.max(0, flat.pending || 0), 0) || 0)} • Expenses: {maintenance?.expenses.length || 0} • Inflows: {maintenance?.inflows.length || 0} • Transfers: {maintenance?.transfers?.length || 0}</p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-900">Cycle & transaction audit history</h3>
        <p className="text-xs text-amber-700 mt-1">Client-side history stored in this browser is an accidental-edit safeguard, not a tamper-proof audit log or authenticated authorization.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {events.length === 0 ? <p className="py-3 text-sm text-slate-500">No actions have been recorded for this month yet.</p> : events.map(event => <details key={event.id} className="py-3">
            <summary className="cursor-pointer flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold text-slate-800">{event.action}</span><span className="text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString()}</span></summary>
            <p className="text-xs text-slate-600 mt-2">Actor: {event.actor}{event.reason ? ` • Reason: ${event.reason}` : ''}{event.record_id ? ` • Record: ${event.record_id}` : ''}</p>
            {(event.before || event.after) && <pre className="mt-2 overflow-auto max-h-48 rounded bg-slate-50 p-2 text-[10px]">{JSON.stringify({ before: event.before, after: event.after }, null, 2)}</pre>}
          </details>)}
        </div>
      </section>
    </div>
  );
};

const Summary: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{formatINRExact(value)}</p></div>;
const ReviewLine: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => <p className={ok ? 'text-emerald-700' : 'text-amber-800'}>{ok ? '✓' : '⚠'} {label}</p>;
