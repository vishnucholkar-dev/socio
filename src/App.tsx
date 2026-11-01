import React, { useState, useEffect } from 'react';
import { UserRole, ApartmentData, WaterStatement, DirectoryContact, ExpenseItem, InflowItem, BillingConfigEntry, BalanceTransfer, PaymentChannel } from './types/apartment';
import {
  getApartmentData,
  recordFlatPayment,
  addExpense,
  updateExpense,
  deleteExpense,
  addInflow,
  updateInflow,
  deleteInflow,
  addBalanceTransfer,
  updateBalanceTransfer,
  deleteBalanceTransfer,
  saveWaterStatement,
  closeCycle,
  openNextCycle,
  reopenCycle,
  initializeCycle,
  nextMonthLabel,
  monthSortKey,
  sameCalendarMonth,
  saveContact,
  deleteContact,
  addBillingConfig
} from './services/storage';

import { Navbar } from './components/Navbar';
import { DashboardModule } from './components/DashboardModule';
import { WaterMeterModule } from './components/WaterMeterModule';
import { CollectionsModule } from './components/CollectionsModule';
import { ExpensesModule } from './components/ExpensesModule';
import { MonthlyStatement } from './components/MonthlyStatement';
import { YearlyStatement } from './components/YearlyStatement';
import { DirectoryModule } from './components/DirectoryModule';
import { SettingsModal } from './components/SettingsModal';
import { CycleManagement } from './components/CycleManagement';

export const App: React.FC = () => {
  const [data, setData] = useState<ApartmentData>(() => getApartmentData());
  const [currentRole, setRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedFlat, setSelectedFlat] = useState<number>(101);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // All cycle labels (including unopened successor periods) come from cycle metadata.
  const availableMonths = Object.keys(data.cycles || {}).sort((a, b) => monthSortKey(a) - monthSortKey(b));

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const latest = [...availableMonths].reverse().find(month => data.cycles?.[month]?.status === 'open');
    return latest || availableMonths[availableMonths.length - 1] || 'October 2026';
  });
  const selectedCycleLabel = availableMonths.find(month => sameCalendarMonth(month, selectedMonth));
  const selectedCycleStatus = selectedCycleLabel ? data.cycles[selectedCycleLabel]?.status : undefined;

  // Sync state with storage updates
  useEffect(() => {
    const handleDataChange = (e: any) => {
      if (e.detail) setData({ ...e.detail });
    };
    window.addEventListener('apartment-data-changed', handleDataChange);
    return () => window.removeEventListener('apartment-data-changed', handleDataChange);
  }, []);

  const runAction = (action: () => ApartmentData): boolean => {
    try { const updated = action(); setData({ ...updated }); setActionError(null); return true; }
    catch (error) { setActionError(error instanceof Error ? error.message : 'The operation could not be saved.'); return false; }
  };

  const handleRecordPayment = (monthSheet: string, flatNumber: number, paidAmount: number, mode: PaymentChannel, notes?: string) =>
    runAction(() => recordFlatPayment(monthSheet, flatNumber, paidAmount, mode, notes));

  const handleAddExpense = (monthSheet: string, expense: ExpenseItem) => runAction(() => addExpense(monthSheet, expense));
  const handleUpdateExpense = (month: string, id: string, expense: ExpenseItem) => runAction(() => updateExpense(month, id, expense));
  const handleDeleteExpense = (month: string, id: string) => runAction(() => deleteExpense(month, id));
  const handleAddInflow = (month: string, inflow: InflowItem) => runAction(() => addInflow(month, inflow));
  const handleUpdateInflow = (month: string, id: string, inflow: InflowItem) => runAction(() => updateInflow(month, id, inflow));
  const handleDeleteInflow = (month: string, id: string) => runAction(() => deleteInflow(month, id));
  const handleAddTransfer = (month: string, transfer: Omit<BalanceTransfer, 'id'>) => runAction(() => addBalanceTransfer(month, transfer));
  const handleUpdateTransfer = (month: string, id: string, transfer: Omit<BalanceTransfer, 'id'>) => runAction(() => updateBalanceTransfer(month, id, transfer));
  const handleDeleteTransfer = (month: string, id: string) => runAction(() => deleteBalanceTransfer(month, id));

  const handleSaveWaterStatement = (statement: WaterStatement) => runAction(() => saveWaterStatement(statement));
  const handleCloseCycle = (month: string, note: string) => runAction(() => closeCycle(month, note));
  const handleOpenNext = (month: string) => runAction(() => openNextCycle(month));
  const handleReopenCycle = (month: string, reason: string) => runAction(() => reopenCycle(month, reason));
  const handleInitializeCycle = (month: string, targetStatus: 'open' | 'closed' | 'legacy-closed', reason: string) => runAction(() => initializeCycle(month, targetStatus, reason));

  const handleSaveContact = (contact: DirectoryContact) => runAction(() => saveContact(contact));
  const handleDeleteContact = (id: string) => runAction(() => deleteContact(id));

  const handleAddConfig = (entry: Omit<BillingConfigEntry, 'id' | 'changed_at'>) => runAction(() => addBillingConfig(entry));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900 pb-20 md:pb-8">
      {/* Navbar with Role Switcher & Navigation Tabs */}
      <Navbar
        currentRole={currentRole}
        setRole={setRole}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        availableMonths={availableMonths}
        cycleStatuses={Object.fromEntries(Object.entries(data.cycles || {}).map(([month, state]) => [month, state.status]))}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedFlat={selectedFlat}
        setSelectedFlat={setSelectedFlat}
        flatsList={data.flats}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {actionError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 whitespace-pre-wrap">{actionError}<button className="float-right font-bold" onClick={() => setActionError(null)} aria-label="Dismiss error">×</button></div>}
        {activeTab === 'cycle-management' && (
          <CycleManagement data={data} month={selectedMonth} isAdmin={currentRole === 'admin'} onCloseCycle={handleCloseCycle} onOpenNext={(month) => { try { const updated = openNextCycle(month); setData({ ...updated }); setActionError(null); setSelectedMonth(nextMonthLabel(month)); } catch (error) { setActionError(error instanceof Error ? error.message : 'The operation could not be saved.'); } }} onReopen={handleReopenCycle} onInitializeCycle={handleInitializeCycle} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardModule
            data={data}
            selectedMonth={selectedMonth}
            setActiveTab={setActiveTab}
            currentRole={currentRole}
            selectedFlat={selectedFlat}
          />
        )}

        {activeTab === 'water-meter' && (
          <WaterMeterModule
            currentRole={currentRole}
            selectedMonth={selectedMonth}
            allWaterStatements={data.water_statements}
            selectedFlat={selectedFlat}
            onSaveStatement={handleSaveWaterStatement}
            cycleStatus={selectedCycleStatus}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {(activeTab === 'collections' || activeTab === 'my-flat') && (
          <CollectionsModule
            currentRole={currentRole}
            selectedMonth={selectedMonth}
            allMaintenanceStatements={data.maintenance_statements}
            allWaterStatements={data.water_statements}
            selectedFlat={selectedFlat}
            onRecordPayment={handleRecordPayment}
            cycleStatus={selectedCycleStatus}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesModule
            currentRole={currentRole}
            selectedMonth={selectedMonth}
            allMaintenanceStatements={data.maintenance_statements}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onAddInflow={handleAddInflow}
            onUpdateInflow={handleUpdateInflow}
            onDeleteInflow={handleDeleteInflow}
            onAddTransfer={handleAddTransfer}
            onUpdateTransfer={handleUpdateTransfer}
            onDeleteTransfer={handleDeleteTransfer}
            cycleStatus={selectedCycleStatus}
          />
        )}

        {activeTab === 'monthly-statement' && (
          <MonthlyStatement
            selectedMonth={selectedMonth}
            allMaintenanceStatements={data.maintenance_statements}
            allWaterStatements={data.water_statements}
            onSelectMonth={setSelectedMonth}
          />
        )}

        {activeTab === 'yearly-statement' && (
          <YearlyStatement
            maintenanceStatements={data.maintenance_statements}
            waterStatements={data.water_statements}
          />
        )}

        {activeTab === 'directory' && (
          <DirectoryModule
            currentRole={currentRole}
            contacts={data.contacts}
            onSaveContact={handleSaveContact}
            onDeleteContact={handleDeleteContact}
          />
        )}
      </main>

      {/* Settings Modal (Mandatory Maintenance & Common Utilization Configuration with History) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        configHistory={data.billing_config_history}
        onAddConfig={handleAddConfig}
      />

      {/* Mobile Floating Action Button to Toggle Role or Settings */}
      {currentRole === 'admin' && (
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Mandatory Maintenance & Utility Rate Settings"
          className="md:hidden fixed right-4 bottom-20 z-40 w-12 h-12 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center text-lg active:scale-95 transition-transform"
        >
          ⚙️
        </button>
      )}
    </div>
  );
};
