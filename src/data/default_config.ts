import type { BillingConfigEntry } from '../types/apartment';

export const DEFAULT_BILLING_CONFIG_HISTORY: BillingConfigEntry[] = [
  {
    id: 'cfg_initial',
    effective_from: '2024-03',
    mandatory_maintenance: 1200,
    common_utilization: 6000,
    changed_at: '2024-03-01T00:00:00.000Z',
    changed_by: 'Society Founding Committee',
    notes: 'Initial B-Block Maintenance baseline prior to individual water meter setup.'
  },
  {
    id: 'cfg_water_meters',
    effective_from: '2024-12',
    mandatory_maintenance: 1400,
    common_utilization: 6000,
    changed_at: '2024-12-01T00:00:00.000Z',
    changed_by: 'General Body Resolution #2',
    notes: 'Water meters commissioned for all 32 flats. Mandatory maintenance set to ₹1,400 and common power deduction fixed at ₹6,000.'
  }
];
