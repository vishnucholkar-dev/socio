import React, { useState, useEffect } from 'react';
import { UserRole, ApartmentData, WaterStatement, DirectoryContact, ExpenseItem, InflowItem, BillingConfigEntry, BalanceTransfer, PaymentChannel, AuthSession } from './types/apartment';
import {
  getApartmentData,
  recordFlatPayment,
  resetFlatPaymentToDue,
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
  saveSingleFlatWaterReading,
  closeCycle,
  openNextCycle,
  reopenCycle,
  openCycle,
  initializeCycle,
  nextMonthLabel,
  monthSortKey,
  sameCalendarMonth,
  saveContact,
  deleteContact,
  addBillingConfig,
  exportApartmentDataBackup,
  importApartmentDataBackup
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
import { LoginModal } from './components/LoginModal';
import { ResidentHistory } from './components/ResidentHistory';
import { ResidentDashboard } from './components/ResidentDashboard';
import { getStoredSession, clearSession } from './services/auth';

export const App: React.FC = () => {
  const [data, setData] = useState<ApartmentData>(() => getApartmentData());
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [isLoginOpen, setIsLoginOpen] = useState(() => !getStoredSession());

  const currentRole = session?.role || 'user';
  const selectedFlat = session?.flatNumber || 101;
  const [activeTab, setActiveTab] = useState<string>(() => session?.role === 'admin' ? 'dashboard' : 'my-flat');
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

  const currentCycleIdx = availableMonths.findIndex(l => sameCalendarMonth(l, selectedMonth));
  const priorCycleLabel = currentCycleIdx > 0 ? availableMonths[currentCycleIdx - 1] : null;
  const isPriorCycleClosed = priorCycleLabel ? data.cycles?.[priorCycleLabel]?.status === 'closed' : false;

  const nextCycleLabel = currentCycleIdx >= 0 && currentCycleIdx < availableMonths.length - 1 ? availableMonths[currentCycleIdx + 1] : null;
  const nextMaint = nextCycleLabel ? data.maintenance_statements.find(m => sameCalendarMonth(m.sheet_name, nextCycleLabel)) : null;
  const nextHasActivity = Boolean(
    nextMaint && (
      nextMaint.expenses.length > 0 ||
      nextMaint.inflows.length > 0 ||
      nextMaint.flats.some(f => f.paid > 0)
    )
  );
  const allowOpenAction = currentRole === 'admin' && !nextHasActivity && currentCycleIdx === availableMonths.length - 1;

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

  const handleRecordPayment = (monthSheet: string, flatNumber: number, paidAmount: number, mode: PaymentChannel, notes?: string, date?: string) =>
    runAction(() => recordFlatPayment(monthSheet, flatNumber, paidAmount, mode, notes, date));

  const handleResetPaymentToDue = (monthSheet: string, flatNumber: number) =>
    runAction(() => resetFlatPaymentToDue(monthSheet, flatNumber));

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
  const handleSaveSingleReading = (monthSheet: string, flatNumber: number, closingReading: number) =>
    runAction(() => saveSingleFlatWaterReading(monthSheet, flatNumber, closingReading));
  const handleCloseCycle = (month: string, note: string) => runAction(() => closeCycle(month, note));
  const handleOpenNext = (month: string) => runAction(() => openNextCycle(month));
  const handleReopenCycle = (month: string, reason: string) => runAction(() => reopenCycle(month, reason));
  const handleOpenCycle = (month: string, reason?: string) => runAction(() => openCycle(month, reason));
  const handleInitializeCycle = (month: string, targetStatus: 'open' | 'closed' | 'legacy-closed', reason: string) => runAction(() => initializeCycle(month, targetStatus, reason));

  const handleSaveContact = (contact: DirectoryContact) => runAction(() => saveContact(contact));
  const handleDeleteContact = (id: string) => runAction(() => deleteContact(id));

  const handleAddConfig = (entry: Omit<BillingConfigEntry, 'id' | 'changed_at'>) => runAction(() => addBillingConfig(entry));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900 pb-20 md:pb-8">
      {/* Navbar with Role Switcher & Navigation Tabs */}
      <Navbar
        currentRole={currentRole}
        setRole={(newRole) => {
          const updated: AuthSession = {
            role: newRole,
            flatNumber: newRole === 'user' ? selectedFlat : undefined,
            username: newRole === 'admin' ? 'Administrator' : newRole === 'watchman' ? 'Watchman' : `Flat ${selectedFlat} Owner`,
            loggedInAt: new Date().toISOString()
          };
          setSession(updated);
          setActiveTab(newRole === 'admin' ? 'dashboard' : newRole === 'watchman' ? 'water-meter' : 'my-flat');
        }}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        availableMonths={availableMonths}
        cycleStatuses={Object.fromEntries(Object.entries(data.cycles || {}).map(([month, state]) => [month, state.status]))}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedFlat={selectedFlat}
        setSelectedFlat={(f) => {
          if (session) {
            const updated = { ...session, flatNumber: f };
            setSession(updated);
          }
        }}
        flatsList={data.flats}
        onLogout={() => {
          clearSession();
          setSession(null);
          setIsLoginOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {actionError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 whitespace-pre-wrap">{actionError}<button className="float-right font-bold" onClick={() => setActionError(null)} aria-label="Dismiss error">×</button></div>}
        {activeTab === 'cycle-management' && currentRole === 'admin' && (
          <CycleManagement data={data} month={selectedMonth} isAdmin={currentRole === 'admin'} onCloseCycle={handleCloseCycle} onOpenNext={(month) => { try { const updated = openNextCycle(month); setData({ ...updated }); setActionError(null); setSelectedMonth(nextMonthLabel(month)); } catch (error) { setActionError(error instanceof Error ? error.message : 'The operation could not be saved.'); } }} onReopen={handleReopenCycle} onOpenCycle={handleOpenCycle} onInitializeCycle={handleInitializeCycle} />
        )}
        {activeTab === 'dashboard' && currentRole !== 'user' && (
          <DashboardModule
            data={data}
            selectedMonth={selectedMonth}
            setActiveTab={setActiveTab}
            currentRole={currentRole}
            selectedFlat={selectedFlat}
          />
        )}
        {activeTab === 'my-flat' && (
          <ResidentDashboard
            selectedFlat={selectedFlat}
            selectedMonth={selectedMonth}
            allMaintenanceStatements={data.maintenance_statements}
            allWaterStatements={data.water_statements}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'water-meter' && (
          <WaterMeterModule
            currentRole={currentRole}
            selectedMonth={selectedMonth}
            allWaterStatements={data.water_statements}
            allMaintenanceStatements={data.maintenance_statements}
            selectedFlat={selectedFlat}
            onSaveStatement={handleSaveWaterStatement}
            onSaveSingleReading={handleSaveSingleReading}
            cycleStatus={selectedCycleStatus}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenCycle={handleOpenCycle}
            priorCycleClosed={isPriorCycleClosed}
            allowOpenAction={allowOpenAction}
          />
        )}

        {activeTab === 'collections' && currentRole !== 'user' && (
          <CollectionsModule
            currentRole={currentRole}
            selectedMonth={selectedMonth}
            allMaintenanceStatements={data.maintenance_statements}
            allWaterStatements={data.water_statements}
            selectedFlat={selectedFlat}
            onRecordPayment={handleRecordPayment}
            onResetPaymentToDue={handleResetPaymentToDue}
            cycleStatus={selectedCycleStatus}
            openCycles={availableMonths.filter(m => data.cycles?.[m]?.status === 'open')}
          />
        )}

        {activeTab === 'expenses' && currentRole === 'admin' && (
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
            openCycles={availableMonths.filter(m => data.cycles?.[m]?.status === 'open')}
            onOpenCycle={handleOpenCycle}
            allowOpenAction={allowOpenAction}
          />
        )}

        {activeTab === 'resident-history' && (
          <ResidentHistory
            selectedFlat={selectedFlat}
            allMaintenanceStatements={data.maintenance_statements}
            allWaterStatements={data.water_statements}
          />
        )}

        {activeTab === 'monthly-statement' && (
          <div className="space-y-8">
            <MonthlyStatement
              selectedMonth={selectedMonth}
              allMaintenanceStatements={data.maintenance_statements}
              allWaterStatements={data.water_statements}
              onSelectMonth={setSelectedMonth}
            />
            {currentRole === 'user' && (
              <div className="pt-6 border-t border-slate-200">
                <YearlyStatement
                  maintenanceStatements={data.maintenance_statements}
                  waterStatements={data.water_statements}
                />
              </div>
            )}
          </div>
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

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setIsLoginOpen(false);
          setActiveTab(newSession.role === 'admin' ? 'dashboard' : newSession.role === 'watchman' ? 'water-meter' : 'my-flat');
        }}
        flatsList={data.flats}
      />

      {/* Settings Modal (Mandatory Maintenance & Common Utilization Configuration with History) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        configHistory={data.billing_config_history}
        onAddConfig={handleAddConfig}
        onExportBackup={() => {
          const jsonStr = exportApartmentDataBackup();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rockcliff-society-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        onImportBackup={(jsonContent) => {
          runAction(() => importApartmentDataBackup(jsonContent));
        }}
        flatsList={data.flats}
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
