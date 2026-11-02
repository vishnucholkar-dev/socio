-- ==============================================================================
-- ROCKCLIFF 'B' BLOCK - DIRECT POSTGRESQL DATABASE UPDATE
-- Target: October 2026 Bank Balance & Total Liquid Funds Calibration
-- ==============================================================================

BEGIN;

-- 1. Check current values before updating
SELECT 
    id, 
    year, 
    month, 
    source_maintenance_sheet_name, 
    bank_opening, 
    cash_opening, 
    bank_balance, 
    cash_balance, 
    total_balance
FROM billing_cycles
WHERE (year = 2026 AND month = 10) 
   OR source_maintenance_sheet_name ILIKE '%October 2026%';

-- 2. Execute Direct Update
-- Bank Balance: ₹78,156.04 (or 78156.40)
-- Total Liquid Funds: ₹78,000.00
-- Cash in Hand: -₹156.04 (Total - Bank)
UPDATE billing_cycles
SET 
    bank_balance = 78156.04,
    cash_balance = -156.04,
    total_balance = 78000.00,
    bank_opening = 78156.04,
    cash_opening = -156.04
WHERE (year = 2026 AND month = 10) 
   OR source_maintenance_sheet_name ILIKE '%October 2026%';

-- 3. Verify updated row
SELECT 
    id, 
    year, 
    month, 
    source_maintenance_sheet_name, 
    bank_opening, 
    cash_opening, 
    bank_balance, 
    cash_balance, 
    total_balance
FROM billing_cycles
WHERE (year = 2026 AND month = 10) 
   OR source_maintenance_sheet_name ILIKE '%October 2026%';

COMMIT;
