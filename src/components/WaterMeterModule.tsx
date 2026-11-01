import React, { useState } from 'react';
import { WaterStatement, UserRole, FlatWaterData, CycleStatus, MaintenanceStatement } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, formatINRExact, formatLiters, calculateWaterBilling } from '../services/calculations';
import { Droplet, Calendar, AlertCircle, CheckCircle2, Plus, ArrowRight, Printer } from './Icons';

interface WaterMeterModuleProps {
  currentRole: UserRole;
  selectedMonth: string;
  allWaterStatements: WaterStatement[];
  allMaintenanceStatements?: MaintenanceStatement[];
  cycleStatus?: CycleStatus;
  selectedFlat: number;
  onSaveStatement: (statement: WaterStatement) => boolean;
  onOpenSettings?: () => void;
  onOpenCycle?: (month: string) => void;
}

export const WaterMeterModule: React.FC<WaterMeterModuleProps> = ({
  currentRole,
  selectedMonth,
  allWaterStatements,
  allMaintenanceStatements,
  cycleStatus = 'legacy-closed',
  selectedFlat,
  onSaveStatement,
  onOpenSettings,
  onOpenCycle
}) => {
  // Never substitute another month's statement when the selected month is missing.
  const matchingStatements = allWaterStatements.filter(w => sameCalendarMonth(w.sheet_name, selectedMonth));
  const currentStatement = matchingStatements.length === 1 ? matchingStatements[0] : undefined;
  const currentMaint = allMaintenanceStatements?.find(m => sameCalendarMonth(m.sheet_name, selectedMonth));
  const canEdit = cycleStatus === 'open' && currentRole !== 'user' && matchingStatements.length === 1;

  // Derive tanker and electricity expenses directly from current cycle's maintenance statement
  const cycleExpenses = currentMaint?.expenses || [];
  const expenseTankerTotal = cycleExpenses
    .filter(e => (e.category || '').toLowerCase().includes('tanker') || e.description.toLowerCase().includes('tanker'))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const expenseElecTotal = cycleExpenses
    .filter(e => (e.category || '').toLowerCase().includes('electric') || (e.category || '').toLowerCase().includes('power') || e.description.toLowerCase().includes('electricity'))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const initialTanker = expenseTankerTotal > 0 ? expenseTankerTotal : (currentStatement?.tanker_bill || 0);
  const initialElec = expenseElecTotal > 0 ? expenseElecTotal : (currentStatement?.electricity_bill || 0);

  const [isEditing, setIsEditing] = useState(false);
  const [tankerBill, setTankerBill] = useState(initialTanker);
  const [electricityBill, setElectricityBill] = useState(initialElec);
  const [commonUtil, setCommonUtil] = useState(currentStatement?.common_utilization || 6000);
  const [mandatoryMaint, setMandatoryMaint] = useState(currentStatement?.mandatory_maintenance || 1400);
  const [days, setDays] = useState(currentStatement?.days || 30);
  const [readings, setReadings] = useState<{ [flat: number]: { closing: number; opening: number } }>(() => {
    const map: { [flat: number]: { closing: number; opening: number } } = {};
    currentStatement?.flats?.forEach(f => {
      map[f.flat] = { closing: f.closing_reading, opening: f.opening_reading };
    });
    return map;
  });

  // Watchman active quick-entry state
  const [watchmanSavedMsg, setWatchmanSavedMsg] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all');
  const [mobileWalkthrough, setMobileWalkthrough] = useState(false);
  const [flatByFlatIndex, setFlatByFlatIndex] = useState(0);

  // Sync state if statement changes or maintenance expenses update
  React.useEffect(() => {
    if (currentStatement) {
      setTankerBill(initialTanker);
      setElectricityBill(initialElec);
      setCommonUtil(currentStatement.common_utilization);
      setMandatoryMaint(currentStatement.mandatory_maintenance);
      setDays(currentStatement.days);
      const map: { [flat: number]: { closing: number; opening: number } } = {};
      currentStatement.flats?.forEach(f => {
        map[f.flat] = { closing: f.closing_reading, opening: f.opening_reading };
      });
      setReadings(map);
      setIsEditing(false);
    }
  }, [currentStatement?.sheet_name, expenseTankerTotal, expenseElecTotal]);

  React.useEffect(() => {
    if (!canEdit) setIsEditing(false);
  }, [canEdit, selectedMonth]);

  if (!currentStatement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
        <h3 className="text-lg font-bold text-slate-800">{matchingStatements.length > 1 ? 'Duplicate Water Statements' : 'No Water Statement Found'}</h3>
        <p className="text-sm text-slate-500">{matchingStatements.length > 1 ? 'Editing is disabled until duplicate month data is reconciled.' : 'No water meter readings recorded for this period.'}</p>
      </div>
    );
  }

  // Live calculation if editing or watchman typing
  const liveCalculation = isEditing
    ? calculateWaterBilling({
        tankerBill,
        electricityBill,
        commonUtilization: commonUtil,
        mandatoryMaintenance: mandatoryMaint,
        days,
        flatReadings: currentStatement.flats.map(f => ({
          flat: f.flat,
          closingReading: readings[f.flat]?.closing ?? f.closing_reading,
          openingReading: readings[f.flat]?.opening ?? f.opening_reading,
          pendingAmount: f.pending_amount
        }))
      })
    : null;

  const displayFlats: FlatWaterData[] = liveCalculation ? liveCalculation.flats : currentStatement.flats;
  const displayLiterRate = liveCalculation ? liveCalculation.literPerCharge : currentStatement.liter_per_charge;
  const displayTotalLiters = liveCalculation ? liveCalculation.totalConsumptionLiters : currentStatement.total_water_consumption_liters;
  const displayNetElec = liveCalculation ? liveCalculation.netElectricity : currentStatement.net_electricity;

  // Handle Save
  const handleSave = () => {
    if (!canEdit) return;
    const calculated = calculateWaterBilling({
      tankerBill,
      electricityBill,
      commonUtilization: commonUtil,
      mandatoryMaintenance: mandatoryMaint,
      days,
      flatReadings: currentStatement.flats.map(f => ({
        flat: f.flat,
        closingReading: readings[f.flat]?.closing ?? f.closing_reading,
        openingReading: readings[f.flat]?.opening ?? f.opening_reading,
        pendingAmount: f.pending_amount
      }))
    });

    const updatedStatement: WaterStatement = {
      ...currentStatement,
      tanker_bill: tankerBill,
      electricity_bill: electricityBill,
      common_utilization: commonUtil,
      net_electricity: calculated.netElectricity,
      mandatory_maintenance: mandatoryMaint,
      days,
      total_water_consumption_liters: calculated.totalConsumptionLiters,
      avg_per_day_liters: calculated.avgPerDayLiters,
      liter_per_charge: calculated.literPerCharge,
      flats: calculated.flats
    };

    if (onSaveStatement(updatedStatement)) {
      setIsEditing(false);
      setWatchmanSavedMsg(true);
      setTimeout(() => setWatchmanSavedMsg(false), 3000);
    }
  };

  // User-specific flat highlight
  const residentFlatData = currentRole === 'user' ? displayFlats.find(f => f.flat === selectedFlat) : null;

  return (
    <div className="space-y-6">
      {cycleStatus !== 'open' && (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-900">
          <div>
            <span className="font-bold block">
              {cycleStatus === 'initialization-required'
                ? 'This cycle is awaiting admin activation.'
                : cycleStatus === 'legacy-closed'
                ? 'This cycle is locked as historical legacy data.'
                : `This cycle is currently ${cycleStatus}.`}
            </span>
            <span className="text-xs text-amber-800">
              {currentRole === 'admin'
                ? 'Click the button on the right to open this cycle and enable editing meter readings and bills.'
                : 'Meter readings and financial entries are currently in read-only mode.'}
            </span>
          </div>

          {currentRole === 'admin' && onOpenCycle && (
            <button
              onClick={() => onOpenCycle(selectedMonth)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all"
            >
              🚀 Open Cycle & Enable Editing
            </button>
          )}
        </div>
      )}
      {matchingStatements.length > 1 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Duplicate water statements were found for this calendar month; editing is disabled until duplicates are reconciled.</div>}
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Droplet size={20} />
            </span>
            <h2 className="text-xl font-bold text-slate-900">{currentStatement.title || currentStatement.sheet_name}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Water meter billing calculation sheet & consumption ledger • 32 Flats
          </p>
        </div>

        <div className="flex items-center space-x-2 no-print">
          {currentRole === 'admin' && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1"
            >
              <span>⚙️</span>
              <span>Rate Policy & History</span>
            </button>
          )}

          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              {currentRole === 'watchman' ? 'Enter / Update Meter Readings' : 'Edit Bills & Meter Readings'}
            </button>
          )}

          {canEdit && isEditing && (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
              >
                Save & Update All Bills
              </button>
            </>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            <Printer size={15} />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {watchmanSavedMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 text-sm">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <span>Meter readings saved successfully! All flat maintenance amounts updated.</span>
        </div>
      )}

      {/* Resident Flat Card (Only shown in User Role) */}
      {currentRole === 'user' && residentFlatData && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                Your Flat Statement
              </span>
              <h3 className="text-2xl font-black mt-2">Flat {residentFlatData.flat}</h3>
              <p className="text-blue-100 text-xs mt-0.5">
                Closing Reading: <strong className="text-white">{residentFlatData.closing_reading}</strong> | Opening: <strong className="text-white">{residentFlatData.opening_reading}</strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-center">
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl min-w-[110px]">
                <p className="text-xs text-blue-200">Water Consumed</p>
                <p className="text-lg font-bold text-white mt-0.5">{formatLiters(residentFlatData.liters)}</p>
                <p className="text-[10px] text-blue-200">({residentFlatData.avg_per_day} L/day)</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl min-w-[110px]">
                <p className="text-xs text-blue-200">Water Charge</p>
                <p className="text-lg font-bold text-white mt-0.5">{formatINR(residentFlatData.water_charge)}</p>
                <p className="text-[10px] text-blue-200">@ {formatINRExact(displayLiterRate)}/L</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl min-w-[110px]">
                <p className="text-xs text-blue-200">Base Maintenance</p>
                <p className="text-lg font-bold text-white mt-0.5">{formatINR(residentFlatData.mandatory_maintenance)}</p>
                <p className="text-[10px] text-blue-200">Fixed Monthly</p>
              </div>

              <div className="bg-white text-slate-900 p-3 rounded-xl min-w-[130px] shadow-md">
                <p className="text-xs font-semibold text-slate-500">Total Month Bill</p>
                <p className="text-xl font-black text-blue-600 mt-0.5">{formatINR(residentFlatData.actual_amount)}</p>
                {residentFlatData.pending_amount > 0 && (
                  <p className="text-[10px] text-rose-600 font-bold">+ {formatINR(residentFlatData.pending_amount)} Pending</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Building Parameters & Cost Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase">Tanker Bill (A)</p>
          {canEdit && isEditing && currentRole === 'admin' ? (
            <input
              type="number"
              value={tankerBill}
              onChange={(e) => setTankerBill(Number(e.target.value))}
              className="mt-1 w-full border border-blue-300 rounded px-2 py-1 text-sm font-bold text-slate-900"
            />
          ) : (
            <p className="text-lg font-bold text-slate-900 mt-1">{formatINR(tankerBill)}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">{expenseTankerTotal > 0 ? 'Synced from expenses' : 'Water tankers bought'}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase">Electricity (B)</p>
          {canEdit && isEditing && currentRole === 'admin' ? (
            <input
              type="number"
              value={electricityBill}
              onChange={(e) => setElectricityBill(Number(e.target.value))}
              className="mt-1 w-full border border-blue-300 rounded px-2 py-1 text-sm font-bold text-slate-900"
            />
          ) : (
            <p className="text-lg font-bold text-slate-900 mt-1">{formatINR(electricityBill)}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">{expenseElecTotal > 0 ? 'Synced from expenses' : 'Total power bill'}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase">Common (-C)</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatINR(commonUtil)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Lift/light deduction</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase">Net Water Power (D)</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{formatINR(displayNetElec)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Motor pumping power</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase">Total Water (F)</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatLiters(displayTotalLiters)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">All 32 flats combined</p>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
          <p className="text-[11px] font-bold text-blue-700 uppercase">Rate Per Liter (G)</p>
          <p className="text-lg font-black text-blue-900 mt-1">{formatINRExact(displayLiterRate)}/L</p>
          <p className="text-[10px] text-blue-600 font-medium mt-0.5">(A+D)/F formula</p>
        </div>
      </div>

      {/* Watchman Helper Banner */}
      {currentRole === 'watchman' && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs">
          <div className="flex items-start space-x-2">
            <span className="font-bold text-sm">💡 Watchman Instruction:</span>
            <div>
              <span>
                Enter the <strong>Closing Reading</strong> from each flat's water meter on the last day of the month.
                The app automatically computes consumed liters. If a reading is lower than opening, an error will highlight in red.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mode Toggle & Floor Selector (Mobile Friendly) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold text-slate-500 mr-1">Floor:</span>
          {(['all', 4, 3, 2, 1] as const).map(fl => (
            <button
              key={fl}
              onClick={() => setActiveFloor(fl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeFloor === fl
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {fl === 'all' ? 'All Flats (32)' : `${fl}th Floor`}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setMobileWalkthrough(!mobileWalkthrough)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              mobileWalkthrough
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📱</span>
            <span>{mobileWalkthrough ? 'Table View' : 'Flat-by-Flat Wizard Mode'}</span>
          </button>
        </div>
      </div>

      {/* Flat-by-Flat Step-by-Step Walkthrough Wizard */}
      {mobileWalkthrough && (() => {
        const sortedFlats = [...displayFlats].sort((a, b) => a.flat - b.flat);
        const currentFlat = sortedFlats[flatByFlatIndex] || sortedFlats[0];
        if (!currentFlat) return null;
        const currentClosing = readings[currentFlat.flat]?.closing ?? currentFlat.closing_reading;
        const currentOpening = readings[currentFlat.flat]?.opening ?? currentFlat.opening_reading;
        const currentError = currentClosing < currentOpening;
        const currentDiff = Math.max(0, currentClosing - currentOpening);

        return (
          <div className="space-y-4">
            {/* Flat Selector Strip */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Apartment (101 to 408)</p>
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                {sortedFlats.map((f, idx) => {
                  const c = readings[f.flat]?.closing ?? f.closing_reading;
                  const o = readings[f.flat]?.opening ?? f.opening_reading;
                  const isDone = c > o;
                  const isErr = c < o;
                  const isSelected = idx === flatByFlatIndex;
                  return (
                    <button
                      key={f.flat}
                      onClick={() => setFlatByFlatIndex(idx)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-purple-600 text-white ring-2 ring-purple-600 ring-offset-1'
                          : isErr
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.flat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Focused Flat Entry Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
                    {currentFlat.flat}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Apartment {currentFlat.flat}</h3>
                    <p className="text-xs text-slate-500">Floor {Math.floor(currentFlat.flat / 100)} • Flat {flatByFlatIndex + 1} of {sortedFlats.length}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Opening Reading Baseline</span>
                  <span className="text-lg font-mono font-bold text-slate-900">{currentOpening.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Closing Meter Reading
                  </label>
                  {canEdit ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={currentClosing || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setReadings(prev => ({
                          ...prev,
                          [currentFlat.flat]: { ...prev[currentFlat.flat], closing: val }
                        }));
                        if (!isEditing) setIsEditing(true);
                      }}
                      placeholder={`Must be ≥ ${currentOpening.toLocaleString()}`}
                      className={`w-full py-4 px-5 rounded-2xl text-2xl font-black font-mono border ${
                        currentError
                          ? 'border-rose-500 bg-rose-50 text-rose-900'
                          : 'border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-100'
                      } focus:outline-none transition-all`}
                    />
                  ) : (
                    <div className="w-full py-4 px-5 rounded-2xl text-2xl font-black font-mono border border-slate-200 bg-slate-50 text-slate-800">
                      {currentClosing.toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Calculation Feedback */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] text-slate-500 font-medium">Water Consumed</p>
                    <p className="text-lg font-bold font-mono text-purple-700 mt-0.5">{formatLiters(currentDiff)}</p>
                    <p className="text-[10px] text-slate-400">({Math.round(currentDiff / days)} L/day)</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] text-slate-500 font-medium">Water Charge</p>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{formatINR(currentFlat.water_charge)}</p>
                    <p className="text-[10px] text-slate-400">@ {formatINRExact(displayLiterRate)}/L</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 col-span-2 sm:col-span-1">
                    <p className="text-[11px] text-purple-700 font-bold">Total Month Bill</p>
                    <p className="text-lg font-black font-mono text-purple-900 mt-0.5">{formatINR(currentFlat.actual_amount)}</p>
                    <p className="text-[10px] text-purple-600">+ ₹{currentFlat.mandatory_maintenance} base</p>
                  </div>
                </div>

                {currentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>Closing reading cannot be lower than opening reading ({currentOpening.toLocaleString()}).</span>
                  </div>
                )}
              </div>

              {/* Navigation Controls */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={flatByFlatIndex === 0}
                  onClick={() => setFlatByFlatIndex(prev => Math.max(0, prev - 1))}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-40"
                >
                  ← Previous Flat
                </button>

                <div className="flex items-center space-x-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                    >
                      Save All Readings
                    </button>
                  )}

                  {flatByFlatIndex < sortedFlats.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setFlatByFlatIndex(prev => Math.min(sortedFlats.length - 1, prev + 1))}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md flex items-center space-x-1"
                    >
                      <span>Next Flat</span>
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFlatByFlatIndex(0)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
                    >
                      Return to 101
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mode View: Flat-by-Flat Wizard Mode OR Full 32-Flat Table */}
      {!mobileWalkthrough && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Flat Water Consumption & Maintenance Table</h3>
            <p className="text-xs text-slate-500">Every flat's meter reading, consumed liters, water charge, and total payable</p>
          </div>
          <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
            32 Flats
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 text-center">Flat</th>
                <th className="py-3 px-3">Opening (Y)</th>
                <th className="py-3 px-3">Closing (X)</th>
                <th className="py-3 px-3 text-right">Liters (X-Y)</th>
                <th className="py-3 px-3 text-right">Avg/Day</th>
                <th className="py-3 px-3 text-right">Water Cost</th>
                <th className="py-3 px-3 text-right">Base Maint</th>
                <th className="py-3 px-3 text-right">Actual Month</th>
                <th className="py-3 px-3 text-right">Pending</th>
                <th className="py-3 px-3 text-right font-bold text-slate-900">Total Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayFlats.map((flat) => {
                const isSelected = currentRole === 'user' && flat.flat === selectedFlat;
                const readingClosing = readings[flat.flat]?.closing ?? flat.closing_reading;
                const readingOpening = readings[flat.flat]?.opening ?? flat.opening_reading;
                const hasError = isEditing && readingClosing < readingOpening;

                return (
                  <tr
                    key={flat.flat}
                    className={`hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-blue-100/70 font-semibold ring-1 ring-blue-300' : ''
                    } ${hasError ? 'bg-rose-50' : ''}`}
                  >
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                      <span className={`px-2.5 py-1 rounded-lg ${isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'}`}>
                        {flat.flat} {isSelected && '★'}
                      </span>
                    </td>

                    {/* Opening Reading */}
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {canEdit && isEditing && currentRole === 'admin' ? (
                        <input
                          type="number"
                          value={readingOpening}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setReadings(prev => ({
                              ...prev,
                              [flat.flat]: { ...prev[flat.flat], opening: val }
                            }));
                          }}
                          className="w-24 px-1.5 py-0.5 text-xs font-mono border rounded border-slate-300"
                        />
                      ) : (
                        readingOpening.toLocaleString()
                      )}
                    </td>

                    {/* Closing Reading */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {canEdit && isEditing ? (
                        <div>
                          <input
                            type="number"
                            value={readingClosing}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setReadings(prev => ({
                                ...prev,
                                [flat.flat]: { ...prev[flat.flat], closing: val }
                              }));
                            }}
                            className={`w-24 px-1.5 py-0.5 text-xs font-mono font-bold border rounded ${
                              hasError ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-blue-400 bg-white'
                            }`}
                          />
                          {hasError && (
                            <span className="block text-[10px] text-rose-600 font-semibold">Lower than opening!</span>
                          )}
                        </div>
                      ) : (
                        readingClosing.toLocaleString()
                      )}
                    </td>

                    {/* Consumed Liters */}
                    <td className="py-2.5 px-3 text-right font-semibold text-blue-700">
                      {flat.liters.toLocaleString()} L
                    </td>

                    {/* Avg/Day */}
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {flat.avg_per_day} L
                    </td>

                    {/* Water Charge */}
                    <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                      {formatINR(flat.water_charge)}
                    </td>

                    {/* Base Maint */}
                    <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                      {formatINR(flat.mandatory_maintenance)}
                    </td>

                    {/* Actual Month */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                      {formatINR(flat.actual_amount)}
                    </td>

                    {/* Pending */}
                    <td className={`py-2.5 px-3 text-right font-mono ${flat.pending_amount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {formatINR(flat.pending_amount)}
                    </td>

                    {/* Total Payable */}
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono bg-slate-50/60">
                      {formatINR(flat.total_payable)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};
