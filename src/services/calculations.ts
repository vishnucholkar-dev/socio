import type { FlatWaterData, WaterStatement, MaintenanceStatement } from '../types/apartment';

export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
}

export function formatINRExact(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

export function formatLiters(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0 L';
  return Number(val).toLocaleString('en-IN') + ' L';
}

export interface WaterCalculationInput {
  tankerBill: number;
  electricityBill: number;
  commonUtilization?: number;
  mandatoryMaintenance?: number;
  days: number;
  flatReadings: {
    flat: number;
    closingReading: number;
    openingReading: number;
    pendingAmount?: number;
  }[];
}

export function calculateWaterBilling(input: WaterCalculationInput): {
  netElectricity: number;
  totalPumpingCost: number;
  totalConsumptionLiters: number;
  avgPerDayLiters: number;
  literPerCharge: number;
  flats: FlatWaterData[];
} {
  const commonUtil = input.commonUtilization ?? 6000;
  const mandatory = input.mandatoryMaintenance ?? 1400;
  const netElec = Math.max(0, input.electricityBill - commonUtil);
  const totalCost = input.tankerBill + netElec;

  // Calculate consumed liters per flat
  let totalLiters = 0;
  const calculatedFlats = input.flatReadings.map(f => {
    const liters = Math.max(0, f.closingReading - f.openingReading);
    totalLiters += liters;
    return {
      flat: f.flat,
      closing_reading: f.closingReading,
      opening_reading: f.openingReading,
      liters,
      avg_per_day: input.days > 0 ? Math.round((liters / input.days) * 10) / 10 : 0,
      pending_amount: f.pendingAmount ?? 0
    };
  });

  const ratePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
  const avgPerDayLiters = input.days > 0 ? Math.round(totalLiters / input.days) : 0;

  const flats: FlatWaterData[] = calculatedFlats.map(f => {
    const waterCharge = Math.round(f.liters * ratePerLiter * 100) / 100;
    const actual = Math.round((waterCharge + mandatory) * 100) / 100;
    const totalPayable = Math.round((actual + f.pending_amount) * 100) / 100;

    return {
      flat: f.flat,
      closing_reading: f.closing_reading,
      opening_reading: f.opening_reading,
      liters: f.liters,
      avg_per_day: f.avg_per_day,
      water_charge: waterCharge,
      mandatory_maintenance: mandatory,
      actual_amount: actual,
      pending_amount: f.pending_amount,
      total_payable: totalPayable
    };
  });

  return {
    netElectricity: netElec,
    totalPumpingCost: totalCost,
    totalConsumptionLiters: totalLiters,
    avgPerDayLiters,
    literPerCharge: ratePerLiter,
    flats
  };
}

export interface YearSummary {
  year: number;
  monthsCount: number;
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  totalExpenses: number;
  netSurplus: number;
  collectionRate: number;
  totalWaterLiters: number;
  avgLitersPerMonth: number;
  categories: { category: string; amount: number; percentage: number }[];
}

export function computeYearSummary(
  year: number,
  maintenanceStatements: MaintenanceStatement[],
  waterStatements: WaterStatement[]
): YearSummary {
  // Filter maintenance statements matching year
  const mStatements = maintenanceStatements.filter(m => m.sheet_name.includes(year.toString()));
  const wStatements = waterStatements.filter(w => w.sheet_name.includes(year.toString()));

  let totalBilled = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let totalExpenses = 0;
  const categoryMap: { [cat: string]: number } = {};

  mStatements.forEach(m => {
    m.flats.forEach(f => {
      totalBilled += f.actual || 0;
      totalCollected += f.paid || 0;
      totalPending += f.pending || 0;
    });

    m.expenses.forEach(e => {
      const amt = e.amount || 0;
      totalExpenses += amt;
      const cat = e.category || 'Maintenance & Repairs';
      categoryMap[cat] = (categoryMap[cat] || 0) + amt;
    });
  });

  let totalWaterLiters = 0;
  wStatements.forEach(w => {
    totalWaterLiters += w.total_water_consumption_liters || 0;
  });

  const categories = Object.keys(categoryMap)
    .map(cat => ({
      category: cat,
      amount: categoryMap[cat],
      percentage: totalExpenses > 0 ? Math.round((categoryMap[cat] / totalExpenses) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthsCount = Math.max(mStatements.length, wStatements.length);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const netSurplus = totalCollected - totalExpenses;

  return {
    year,
    monthsCount,
    totalBilled,
    totalCollected,
    totalPending,
    totalExpenses,
    netSurplus,
    collectionRate,
    totalWaterLiters,
    avgLitersPerMonth: monthsCount > 0 ? Math.round(totalWaterLiters / monthsCount) : 0,
    categories
  };
}
