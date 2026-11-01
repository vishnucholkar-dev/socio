import React, { useState } from 'react';
import { WaterStatement, UserRole, FlatWaterData, CycleStatus } from '../types/apartment';
import { sameCalendarMonth } from '../services/storage';
import { formatINR, formatINRExact, formatLiters, calculateWaterBilling } from '../services/calculations';
import { Droplet, Calendar, AlertCircle, CheckCircle2, Plus, ArrowRight, Printer } from './Icons';

interface WaterMeterModuleProps {
  currentRole: UserRole;
  selectedMonth: string;
  allWaterStatements: WaterStatement[];
  cycleStatus?: CycleStatus;
  selectedFlat: number;
  onSaveStatement: (statement: WaterStatement) => boolean;
  onOpenSettings?: () => void;
}

export const WaterMeterModule: React.FC<WaterMeterModuleProps> = ({
  currentRole,
  selectedMonth,
  allWaterStatements,
  cycleStatus = 'legacy-closed',
  selectedFlat,
  onSaveStatement,
  onOpenSettings
}) => {
  // Never substitute another month's statement when the selected month is missing.
  const matchingStatements = allWaterStatements.filter(w => sameCalendarMonth(w.sheet_name, selectedMonth));
  const currentStatement = matchingStatements.length === 1 ? matchingStatements[0] : undefined;
  const canEdit = cycleStatus === 'open' && currentRole !== 'user' && matchingStatements.length === 1;

  const [isEditing, setIsEditing] = useState(false);
  const [tankerBill, setTankerBill] = useState(currentStatement?.tanker_bill || 0);
  const [electricityBill, setElectricityBill] = useState(currentStatement?.electricity_bill || 0);
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

  // Sync state if statement changes
  React.useEffect(() => {
    if (currentStatement) {
      setTankerBill(currentStatement.tanker_bill);
      setElectricityBill(currentStatement.electricity_bill);
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
  }, [currentStatement?.sheet_name]);

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
      {cycleStatus !== 'open' && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">This cycle is {cycleStatus === 'initialization-required' ? 'pending explicit initialization by an administrator' : cycleStatus === 'legacy-closed' ? 'legacy closed and locked' : cycleStatus || 'not open'}; meter readings are view-only.</div>}
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
          <p className="text-[10px] text-slate-400 mt-0.5">Water tankers bought</p>
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
          <p className="text-[10px] text-slate-400 mt-0.5">Total power bill</p>
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
            <span>{mobileWalkthrough ? 'Exit Walkthrough' : 'Mobile Walkthrough Mode'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Walkthrough Mode (Cards for each flat with large touch targets) */}
      {mobileWalkthrough ? (
        <div className="space-y-4">
          <div className="bg-purple-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm">Water Meter Mobile Walkthrough</h4>
              <p className="text-xs text-purple-200">Walk door to door and enter meter values directly</p>
            </div>
            {canEdit && <button
              onClick={handleSave}
              className="px-4 py-2 bg-white text-purple-900 text-xs font-black rounded-xl shadow-sm hover:bg-purple-50 transition-all"
            >
              Save All
            </button>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayFlats
              .filter(f => activeFloor === 'all' || Math.floor(f.flat / 100) === activeFloor)
              .map(flat => {
                const readingClosing = readings[flat.flat]?.closing ?? flat.closing_reading;
                const readingOpening = readings[flat.flat]?.opening ?? flat.opening_reading;
                const hasError = readingClosing < readingOpening;
                const diff = Math.max(0, readingClosing - readingOpening);

                return (
                  <div
                    key={flat.flat}
                    className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${
                      hasError
                        ? 'border-rose-400 bg-rose-50/40 ring-1 ring-rose-400'
                        : readingClosing > readingOpening
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                          {flat.flat}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Flat {flat.flat}</p>
                          <p className="text-[10px] text-slate-500">Floor {Math.floor(flat.flat / 100)}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Opening Reading</span>
                        <span className="text-xs font-mono font-bold text-slate-700">{readingOpening.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Numeric Input */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Closing Meter Reading:
                      </label>
                      {canEdit ? <input
                        type="number"
                        inputMode="numeric"
                        value={readingClosing || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setReadings(prev => ({
                            ...prev,
                            [flat.flat]: { ...prev[flat.flat], closing: val }
                          }));
                          if (!isEditing) setIsEditing(true);
                        }}
                        placeholder="Enter 6-digit meter reading"
                        className={`w-full py-2.5 px-3 rounded-xl text-base font-black font-mono border ${
                          hasError
                            ? 'border-rose-500 bg-rose-50 text-rose-800'
                            : 'border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                        } focus:outline-none`}
                      /> : <p className="w-full py-2.5 px-3 rounded-xl text-base font-black font-mono border border-slate-200 bg-slate-50 text-slate-700">{readingClosing.toLocaleString()}</p>}
                    </div>

                    {/* Feedback badge */}
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      {hasError ? (
                        <span className="text-rose-600 font-bold flex items-center space-x-1">
                          <AlertCircle size={14} />
                          <span>Closing reading cannot be lower than {readingOpening.toLocaleString()}!</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>Consumed: <strong className="font-mono">{diff.toLocaleString()} L</strong> ({Math.round(diff / days)} L/day)</span>
                        </span>
                      )}

                      <span className="font-bold text-slate-900 font-mono">
                        {formatINR(flat.actual_amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="sticky bottom-16 md:bottom-4 p-3 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl flex justify-between items-center z-30">
            <span className="text-xs font-bold text-slate-700">Finished entering readings?</span>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all"
            >
              Save All Readings Now
            </button>
          </div>
        </div>
      ) : (
        <>
      {/* 32-Flat Table */}
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
                      isSelected ? 'bg-blue-50/80 font-medium' : ''
                    } ${hasError ? 'bg-rose-50' : ''}`}
                  >
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                      <span className={`px-2 py-0.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                        {flat.flat}
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
        </>
      )}
    </div>
  );
};
