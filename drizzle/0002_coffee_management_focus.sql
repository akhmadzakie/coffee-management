-- Migration: Fase 1-4 new tables and columns
-- ─── Fase 1: Expense Categories ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "expense_categories" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "type" varchar(50) NOT NULL,
  "parent_id" varchar(255),
  "color" varchar(20) NOT NULL DEFAULT '#6B7280',
  "icon" varchar(50) NOT NULL DEFAULT 'tag',
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0
);
ALTER TABLE "cash_transactions" ADD COLUMN IF NOT EXISTS "category_id" varchar(255);
CREATE TABLE IF NOT EXISTS "budgets" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "category_id" varchar(255) NOT NULL,
  "period" varchar(7) NOT NULL,
  "target_amount" real NOT NULL,
  "created_by" varchar(255) NOT NULL,
  "created_at" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "bank_reconciliations" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "account_id" varchar(255) NOT NULL,
  "period" varchar(7) NOT NULL,
  "bank_balance" real NOT NULL,
  "system_balance" real NOT NULL,
  "difference" real NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
  "notes" text,
  "created_by" varchar(255) NOT NULL,
  "created_at" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "reconciliation_id" varchar(255) NOT NULL,
  "date" text NOT NULL,
  "description" text NOT NULL,
  "amount" real NOT NULL,
  "type" varchar(10) NOT NULL,
  "is_matched" boolean NOT NULL DEFAULT false,
  "matched_transaction_id" varchar(255)
);
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "cost_per_unit" real NOT NULL DEFAULT 0;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "unit_cost" real;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "total_cost" real;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "reference_id" varchar(255);
CREATE TABLE IF NOT EXISTS "stock_opnames" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "date" text NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
  "notes" text,
  "created_by" varchar(255) NOT NULL,
  "created_at" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "stock_opname_items" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "opname_id" varchar(255) NOT NULL,
  "ingredient_id" varchar(255) NOT NULL,
  "system_stock" real NOT NULL,
  "physical_stock" real NOT NULL,
  "difference" real NOT NULL,
  "notes" text
);
CREATE TABLE IF NOT EXISTS "payroll_records" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "employee_id" varchar(255) NOT NULL,
  "period" varchar(7) NOT NULL,
  "basic_salary" real NOT NULL,
  "meal_allowance" real NOT NULL,
  "position_allowance" real NOT NULL,
  "kpi_bonus" real NOT NULL DEFAULT 0,
  "alpha_deduction" real NOT NULL DEFAULT 0,
  "other_deductions" real NOT NULL DEFAULT 0,
  "gross_pay" real NOT NULL,
  "net_pay" real NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
  "paid_date" text,
  "paid_via" varchar(255),
  "notes" text,
  "created_by" varchar(255) NOT NULL,
  "created_at" text NOT NULL
);
