-- ============================================================
-- Migration 003: Default Chart of Accounts seed function
-- Called when a new organization is created
-- ============================================================

create or replace function seed_default_chart_of_accounts(p_org_id uuid)
returns void as $$
begin
  -- ASSETS
  insert into chart_of_accounts (org_id, code, name, type, is_system) values
    (p_org_id, '1000', 'Assets', 'asset', true),
    (p_org_id, '1010', 'Cash', 'asset', true),
    (p_org_id, '1020', 'Checking Account', 'asset', true),
    (p_org_id, '1030', 'Savings Account', 'asset', true),
    (p_org_id, '1100', 'Accounts Receivable', 'asset', true),
    (p_org_id, '1200', 'Inventory', 'asset', true),
    (p_org_id, '1500', 'Fixed Assets', 'asset', true),
    (p_org_id, '1510', 'Equipment', 'asset', true),
    (p_org_id, '1520', 'Furniture & Fixtures', 'asset', true);

  -- LIABILITIES
  insert into chart_of_accounts (org_id, code, name, type, is_system) values
    (p_org_id, '2000', 'Liabilities', 'liability', true),
    (p_org_id, '2010', 'Accounts Payable', 'liability', true),
    (p_org_id, '2100', 'Credit Cards Payable', 'liability', true),
    (p_org_id, '2200', 'Loans Payable', 'liability', true),
    (p_org_id, '2300', 'Accrued Liabilities', 'liability', true),
    (p_org_id, '2400', 'Sales Tax Payable', 'liability', true);

  -- EQUITY
  insert into chart_of_accounts (org_id, code, name, type, is_system) values
    (p_org_id, '3000', 'Equity', 'equity', true),
    (p_org_id, '3010', 'Owner Equity', 'equity', true),
    (p_org_id, '3100', 'Retained Earnings', 'equity', true),
    (p_org_id, '3200', 'Owner Draws', 'equity', true);

  -- REVENUE
  insert into chart_of_accounts (org_id, code, name, type, is_system) values
    (p_org_id, '4000', 'Revenue', 'revenue', true),
    (p_org_id, '4010', 'Product Sales', 'revenue', true),
    (p_org_id, '4020', 'Service Revenue', 'revenue', true),
    (p_org_id, '4030', 'Other Income', 'revenue', true);

  -- COST OF GOODS SOLD
  insert into chart_of_accounts (org_id, code, name, type, is_system) values
    (p_org_id, '5000', 'Cost of Goods Sold', 'expense', true),
    (p_org_id, '5010', 'Direct Materials', 'expense', true),
    (p_org_id, '5020', 'Direct Labor', 'expense', true);

  -- OPERATING EXPENSES
  insert into chart_of_accounts (org_id, code, name, type, is_system) values
    (p_org_id, '6000', 'Operating Expenses', 'expense', true),
    (p_org_id, '6010', 'Payroll', 'expense', true),
    (p_org_id, '6020', 'Rent', 'expense', true),
    (p_org_id, '6030', 'Utilities', 'expense', true),
    (p_org_id, '6040', 'Marketing', 'expense', true),
    (p_org_id, '6050', 'Software & Subscriptions', 'expense', true),
    (p_org_id, '6060', 'Travel & Entertainment', 'expense', true),
    (p_org_id, '6070', 'Professional Services', 'expense', true),
    (p_org_id, '6080', 'Insurance', 'expense', true),
    (p_org_id, '6090', 'Office Supplies', 'expense', true),
    (p_org_id, '6100', 'Depreciation', 'expense', true),
    (p_org_id, '6900', 'Other Expenses', 'expense', true);
end;
$$ language plpgsql security definer;
