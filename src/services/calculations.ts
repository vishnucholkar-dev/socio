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

export interface DynamicBalances {
  cashOpening: number;
  bankOpening: number;
  cashFlatCollections: number;
  bankFlatCollections: number;
  otherCashInflows: number;
  otherBankInflows: number;
  totalCashReceived: number; // IA
  totalBankInflows: number;  // IB
  totalReceiptsAndInflows: number;
  paidCashExpenses: number;
  paidBankExpenses: number;
  totalPaidExpenses: number; // EA + EB
  billedExpenses: number;
  netCashTransfers: number;
  netBankTransfers: number;
  closingCash: number;       // IA - EA + Net Transfers
  closingBank: number;       // IB - EB + Net Transfers
  totalLiquidFunds: number;  // closingCash + closingBank
}

export function computeDynamicStatementBalances(m: MaintenanceStatement | undefined | null): DynamicBalances {
  if (!m) {
    return {
      cashOpening: 0,
      bankOpening: 0,
      cashFlatCollections: 0,
      bankFlatCollections: 0,
      otherCashInflows: 0,
      otherBankInflows: 0,
      totalCashReceived: 0,
      totalBankInflows: 0,
      totalReceiptsAndInflows: 0,
      paidCashExpenses: 0,
      paidBankExpenses: 0,
      totalPaidExpenses: 0,
      billedExpenses: 0,
      netCashTransfers: 0,
      netBankTransfers: 0,
      closingCash: 0,
      closingBank: 0,
      totalLiquidFunds: 0
    };
  }

  const cashOpening = m.cash_opening ?? 0;
  const bankOpening = m.bank_opening ?? 0;

  // Flat Collections
  let cashFlatCollections = 0;
  let bankFlatCollections = 0;

  for (const flat of (m.flats || [])) {
    if (flat.receipts && flat.receipts.length > 0) {
      for (const r of flat.receipts) {
        if (r.mode === 'Cash') {
          cashFlatCollections += r.amount || 0;
        } else {
          bankFlatCollections += r.amount || 0;
        }
      }
    } else if ((flat.paid || 0) > 0) {
      if (flat.mode === 'Cash') {
        cashFlatCollections += flat.paid || 0;
      } else {
        bankFlatCollections += flat.paid || 0;
      }
    }
  }

  cashFlatCollections = Math.round((cashFlatCollections + Number.EPSILON) * 100) / 100;
  bankFlatCollections = Math.round((bankFlatCollections + Number.EPSILON) * 100) / 100;

  // Other Inflows
  let otherCashInflows = 0;
  let otherBankInflows = 0;
  for (const item of (m.inflows || [])) {
    if ((item.type || 'Cash') === 'Cash') {
      otherCashInflows += item.amount || 0;
    } else {
      otherBankInflows += item.amount || 0;
    }
  }
  otherCashInflows = Math.round((otherCashInflows + Number.EPSILON) * 100) / 100;
  otherBankInflows = Math.round((otherBankInflows + Number.EPSILON) * 100) / 100;

  const totalCashReceived = Math.round((cashFlatCollections + otherCashInflows + Number.EPSILON) * 100) / 100;
  const totalBankInflows = Math.round((bankFlatCollections + otherBankInflows + Number.EPSILON) * 100) / 100;
  const totalReceiptsAndInflows = Math.round((totalCashReceived + totalBankInflows + Number.EPSILON) * 100) / 100;

  // Paid vs Billed Expenses
  let paidCashExpenses = 0;
  let paidBankExpenses = 0;
  let billedExpenses = 0;

  for (const exp of (m.expenses || [])) {
    if (exp.status === 'Billed') {
      billedExpenses += exp.amount || 0;
    } else {
      if ((exp.type || 'Cash') === 'Cash') {
        paidCashExpenses += exp.amount || 0;
      } else {
        paidBankExpenses += exp.amount || 0;
      }
    }
  }
  paidCashExpenses = Math.round((paidCashExpenses + Number.EPSILON) * 100) / 100;
  paidBankExpenses = Math.round((paidBankExpenses + Number.EPSILON) * 100) / 100;
  billedExpenses = Math.round((billedExpenses + Number.EPSILON) * 100) / 100;
  const totalPaidExpenses = Math.round((paidCashExpenses + paidBankExpenses + Number.EPSILON) * 100) / 100;

  // Transfers
  let netCashTransfers = 0;
  let netBankTransfers = 0;
  for (const t of (m.transfers || [])) {
    const amt = t.amount || 0;
    if (t.to === 'Cash') netCashTransfers += amt;
    if (t.from === 'Cash') netCashTransfers -= amt;
    if (t.to === 'Bank') netBankTransfers += amt;
    if (t.from === 'Bank') netBankTransfers -= amt;
  }
  netCashTransfers = Math.round((netCashTransfers + Number.EPSILON) * 100) / 100;
  netBankTransfers = Math.round((netBankTransfers + Number.EPSILON) * 100) / 100;

  const closingCash = Math.round((cashOpening + totalCashReceived - paidCashExpenses + netCashTransfers + Number.EPSILON) * 100) / 100;
  const closingBank = Math.round((bankOpening + totalBankInflows - paidBankExpenses + netBankTransfers + Number.EPSILON) * 100) / 100;
  const totalLiquidFunds = Math.round((closingCash + closingBank + Number.EPSILON) * 100) / 100;

  return {
    cashOpening,
    bankOpening,
    cashFlatCollections,
    bankFlatCollections,
    otherCashInflows,
    otherBankInflows,
    totalCashReceived,
    totalBankInflows,
    totalReceiptsAndInflows,
    paidCashExpenses,
    paidBankExpenses,
    totalPaidExpenses,
    billedExpenses,
    netCashTransfers,
    netBankTransfers,
    closingCash,
    closingBank,
    totalLiquidFunds
  };
}
