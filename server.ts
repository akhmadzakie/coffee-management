import "dotenv/config";
import express from "express";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { db, pool } from "./src/db/db.ts";
import * as schema from "./src/db/schema.ts";
import { eq, ne, not, desc, like, and, or, gte, lte } from "drizzle-orm";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getLocalDateString,
  getLocalPeriodString,
  getLocalDayUtcBounds,
  isTimestampOnLocalDate,
} from "./src/utils/dateUtils.ts";
import {
  resolveOrderItemIngredients,
  calculateTodayOrderSummary,
  resolvePaymentAccountId,
} from "./src/utils/posDomainLogic.ts";

const initialSettings = {
  id: "1",
  logoDataUrl: "/logo-wordmark-white.png",
  brandName: "Julia's",
  companyAddress: "Julia's • Specialty Room • Coffee • Eatery",
  bankDetails: "Bank BCA 1234567890",
  salesPerson: "Admin",
  footerMessage: "Terima kasih atas kunjungannya di Julia's.",
  language: "id",
  leaderBarTasks: "[]",
  leaderKitchenTasks: "[]",
  leaderBakerTasks: "[]",
  managerTasks: "[]",
  gemini_api_key: null,
  taxEnabled: false,
  taxRate: 10,
  taxMode: "EXCLUSIVE",
  maxCashierDiscount: 10,
  monthlyRevenueTarget: 150000000,
  targetBonusAmount: 0,
  divisionKpiBonusTarget: "{}",
  scheduleApprovals: "{}",
  enableStoreSalesBonus: true,
  enableLeaderAllowanceBonus: true,
  enableKpiScoreBonus: false,
};

const initialUsers = [
  {
    id: "admin-1",
    username: "admin",
    pin: "123456",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    department: "Management",
  },
  {
    id: "pos-terminal-1",
    username: "kasir",
    pin: "123456",
    name: "Terminal Kasir POS",
    role: "KASIR",
    department: "Bar & Kasir",
  },
];

const initialIngredients = [
  { id: "ing-coffee-beans", name: "House Blend Espresso Beans", unit: "gr", currentStock: 4500, minStock: 1000, category: "Coffee", costPerUnit: 250 },
  { id: "ing-fresh-milk", name: "Fresh Milk UHT Greenfields", unit: "ml", currentStock: 18000, minStock: 5000, category: "Dairy", costPerUnit: 18.5 },
  { id: "ing-aren-cair", name: "Gula Aren Cair Racikan", unit: "ml", currentStock: 2400, minStock: 800, category: "Kondimen Olahan", costPerUnit: 38 },
  { id: "ing-ice-cube", name: "Es Batu Kristal Tube", unit: "gr", currentStock: 25000, minStock: 5000, category: "Air & Es", costPerUnit: 2 },
  { id: "ing-aren-padat", name: "Gula Aren Batok Organik", unit: "gr", currentStock: 8000, minStock: 2000, category: "Pemanis", costPerUnit: 35 },
  { id: "ing-air", name: "Air Bersih Galon RO", unit: "ml", currentStock: 50000, minStock: 10000, category: "Air & Es", costPerUnit: 0.5 },
  { id: "ing-gula-pasir", name: "Gula Pasir Kristal Putih", unit: "gr", currentStock: 12000, minStock: 3000, category: "Pemanis", costPerUnit: 16 },
  { id: "ing-simple-syrup", name: "Simple Syrup (1:1)", unit: "ml", currentStock: 3200, minStock: 1000, category: "Kondimen Olahan", costPerUnit: 12 },
  { id: "ing-beras", name: "Beras Pulen Pandan Wangi", unit: "gr", currentStock: 15000, minStock: 5000, category: "Kitchen", costPerUnit: 16 },
  { id: "ing-ayam-fillet", name: "Daging Ayam Fillet Paha", unit: "gr", currentStock: 4800, minStock: 1500, category: "Kitchen", costPerUnit: 58 },
  { id: "ing-sambal-matah", name: "Sambal Matah Matang", unit: "gr", currentStock: 1800, minStock: 500, category: "Kondimen Olahan", costPerUnit: 48 },
  { id: "ing-adonan-croissant", name: "Dough Croissant Butter 70g", unit: "pcs", currentStock: 40, minStock: 15, category: "Bakery", costPerUnit: 6500 },
  { id: "ing-butter", name: "French Pure Butter Elle & Vire", unit: "gr", currentStock: 2500, minStock: 500, category: "Bakery", costPerUnit: 140 },
];

const initialRecipes = [
  {
    id: "rec-kopsu-aren",
    menuName: "Kopi Susu Gula Aren",
    ingredients: JSON.stringify([
      { ingredientId: "ing-coffee-beans", quantity: 18 },
      { ingredientId: "ing-fresh-milk", quantity: 120 },
      { ingredientId: "ing-aren-cair", quantity: 25 },
      { ingredientId: "ing-ice-cube", quantity: 120 },
    ]),
  },
  {
    id: "rec-cafe-latte",
    menuName: "Cafe Latte",
    ingredients: JSON.stringify([
      { ingredientId: "ing-coffee-beans", quantity: 18 },
      { ingredientId: "ing-fresh-milk", quantity: 150 },
    ]),
  },
  {
    id: "rec-iced-americano",
    menuName: "Iced Americano",
    ingredients: JSON.stringify([
      { ingredientId: "ing-coffee-beans", quantity: 18 },
      { ingredientId: "ing-air", quantity: 150 },
      { ingredientId: "ing-ice-cube", quantity: 120 },
    ]),
  },
  {
    id: "rec-butter-croissant",
    menuName: "Butter Croissant",
    ingredients: JSON.stringify([
      { ingredientId: "ing-adonan-croissant", quantity: 1 },
      { ingredientId: "ing-butter", quantity: 10 },
    ]),
  },
  {
    id: "rec-ricebowl-matah",
    menuName: "Rice Bowl Ayam Sambal Matah",
    ingredients: JSON.stringify([
      { ingredientId: "ing-beras", quantity: 120 },
      { ingredientId: "ing-ayam-fillet", quantity: 100 },
      { ingredientId: "ing-sambal-matah", quantity: 30 },
    ]),
  },
];

const initialProducts = [
  {
    id: "prod-kopsu-aren",
    name: "Kopi Susu Gula Aren",
    category: "COFFEE",
    division: "BAR",
    description: "Signature blend espresso dengan susu segar creamy dan siraman saus gula aren racikan Julia's.",
    isActive: true,
    variants: [
      {
        id: "var-kopsu-iced",
        productId: "prod-kopsu-aren",
        name: "Iced 16oz",
        sku: "JUL-BAR-001",
        price: 22000,
        packagingCost: 1000,
        recipeId: "rec-kopsu-aren",
        estimatedHpp: 7250,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 120 },
          { ingredientId: "ing-aren-cair", quantity: 25 },
          { ingredientId: "ing-ice-cube", quantity: 120 },
        ],
      },
      {
        id: "var-kopsu-hot",
        productId: "prod-kopsu-aren",
        name: "Hot 8oz",
        sku: "JUL-BAR-002",
        price: 20000,
        packagingCost: 850,
        recipeId: "rec-kopsu-aren",
        estimatedHpp: 6900,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 140 },
          { ingredientId: "ing-aren-cair", quantity: 20 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod-cafe-latte",
    name: "Cafe Latte",
    category: "COFFEE",
    division: "BAR",
    description: "Espresso klasik berpadu dengan steamed fresh milk bertekstur microfoam sutra.",
    isActive: true,
    variants: [
      {
        id: "var-latte-hot",
        productId: "prod-cafe-latte",
        name: "Hot 8oz",
        sku: "JUL-BAR-010",
        price: 25000,
        packagingCost: 850,
        recipeId: "rec-cafe-latte",
        estimatedHpp: 6500,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 150 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

const defaultCategories = [
  { id: "cat-pendapatan", name: "Pendapatan", type: "PENDAPATAN", parentId: null, color: "#10B981", icon: "trending-up", isActive: true, sortOrder: 1 },
  { id: "cat-pengeluaran", name: "Pengeluaran Operasional", type: "PENGELUARAN", parentId: null, color: "#EF4444", icon: "trending-down", isActive: true, sortOrder: 2 },
  { id: "cat-bahan-baku", name: "Bahan Baku", type: "BAHAN_BAKU", parentId: null, color: "#F59E0B", icon: "package", isActive: true, sortOrder: 3 },
  { id: "cat-utilitas", name: "Utilitas", type: "UTILITAS", parentId: null, color: "#3B82F6", icon: "zap", isActive: true, sortOrder: 4 },
  { id: "cat-hrd", name: "HRD & Personalia", type: "HRD", parentId: null, color: "#8B5CF6", icon: "users", isActive: true, sortOrder: 5 },
  { id: "cat-aset", name: "Pembelian Aset", type: "ASET", parentId: null, color: "#6366F1", icon: "briefcase", isActive: true, sortOrder: 6 },
  { id: "cat-lainnya", name: "Lainnya", type: "LAINNYA", parentId: null, color: "#6B7280", icon: "more-horizontal", isActive: true, sortOrder: 7 },
  // Children: Pendapatan
  { id: "cat-penjualan", name: "Penjualan Minuman", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#34D399", icon: "coffee", isActive: true, sortOrder: 1 },
  { id: "cat-penjualan-makanan", name: "Penjualan Makanan", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#6EE7B7", icon: "utensils", isActive: true, sortOrder: 2 },
  { id: "cat-pendapatan-lain", name: "Pendapatan Lain", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#A7F3D0", icon: "plus-circle", isActive: true, sortOrder: 3 },
  // Children: Pengeluaran
  { id: "cat-sewa", name: "Sewa Tempat", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "home", isActive: true, sortOrder: 1 },
  { id: "cat-kebersihan", name: "Kebersihan & Sanitasi", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "trash-2", isActive: true, sortOrder: 2 },
  { id: "cat-marketing-ops", name: "Marketing & Promosi", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "megaphone", isActive: true, sortOrder: 3 },
  { id: "cat-opex-lain", name: "Operasional Lainnya", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "settings", isActive: true, sortOrder: 4 },
  // Children: Bahan Baku
  { id: "cat-kopi", name: "Kopi & Espresso", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "coffee", isActive: true, sortOrder: 1 },
  { id: "cat-susu", name: "Susu & Dairy", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "droplets", isActive: true, sortOrder: 2 },
  { id: "cat-minuman", name: "Minuman & Sirup", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "cup-soda", isActive: true, sortOrder: 3 },
  { id: "cat-packaging", name: "Packaging & Kemasan", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "box", isActive: true, sortOrder: 4 },
  { id: "cat-bahan-lain", name: "Bahan Baku Lainnya", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "shopping-cart", isActive: true, sortOrder: 5 },
  // Children: Utilitas
  { id: "cat-listrik", name: "Listrik", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "zap", isActive: true, sortOrder: 1 },
  { id: "cat-air", name: "Air & PDAM", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "droplets", isActive: true, sortOrder: 2 },
  { id: "cat-internet", name: "Internet & Telepon", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "wifi", isActive: true, sortOrder: 3 },
  { id: "cat-gas", name: "Gas", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "flame", isActive: true, sortOrder: 4 },
  // Children: HRD
  { id: "cat-gaji", name: "Gaji Karyawan", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "wallet", isActive: true, sortOrder: 1 },
  { id: "cat-bpjs", name: "BPJS & Asuransi", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "shield", isActive: true, sortOrder: 2 },
  { id: "cat-tunjangan", name: "Tunjangan & Bonus", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "gift", isActive: true, sortOrder: 3 },
  { id: "cat-pelatihan", name: "Pelatihan Karyawan", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "book-open", isActive: true, sortOrder: 4 },
];

let isDbConnected = false;

async function ensureTables() {
  try {
    // Quick test if database is reachable (1.5s timeout)
    const client = await Promise.race([
      pool.connect(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Database connection timeout")), 1500)
      ),
    ]);
    if (client) {
      client.release();
      isDbConnected = true;
    }
  } catch (err: any) {
    isDbConnected = false;
    console.warn(
      "⚠️  Database PostgreSQL tidak terhubung / offline. Server akan berjalan dalam mode in-memory fallback:",
      err?.message
    );
    return;
  }

  const queries = [
    `CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'LAINNYA',
        parent_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
        color TEXT NOT NULL DEFAULT '#6B7280',
        icon TEXT NOT NULL DEFAULT 'tag',
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        category_id TEXT REFERENCES expense_categories(id),
        period TEXT NOT NULL,
        amount NUMERIC NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS bank_reconciliations (
        id TEXT PRIMARY KEY,
        period TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        account_number TEXT,
        opening_balance NUMERIC NOT NULL DEFAULT 0,
        closing_balance NUMERIC NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS bank_statement_lines (
        id TEXT PRIMARY KEY,
        reconciliation_id TEXT NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC NOT NULL DEFAULT 0,
        transaction_type TEXT NOT NULL DEFAULT 'CREDIT',
        matched_transaction_id TEXT,
        is_matched BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS stock_opnames (
        id TEXT PRIMARY KEY,
        period TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT,
        approved_by TEXT,
        approved_at TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS stock_opname_items (
        id TEXT PRIMARY KEY,
        opname_id TEXT NOT NULL REFERENCES stock_opnames(id) ON DELETE CASCADE,
        ingredient_id TEXT NOT NULL,
        system_stock NUMERIC NOT NULL DEFAULT 0,
        physical_stock NUMERIC NOT NULL DEFAULT 0,
        difference NUMERIC GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
        unit_cost NUMERIC NOT NULL DEFAULT 0,
        notes TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        department TEXT NOT NULL,
        employment_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS employee_contracts (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        effective_date TEXT NOT NULL,
        basic_salary NUMERIC NOT NULL DEFAULT 0,
        meal_allowance NUMERIC NOT NULL DEFAULT 0,
        position_allowance NUMERIC NOT NULL DEFAULT 0,
        alpha_deduction_per_day NUMERIC NOT NULL DEFAULT 0,
        working_days_per_month INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        present_days INTEGER NOT NULL DEFAULT 0,
        sick_days INTEGER NOT NULL DEFAULT 0,
        permission_days INTEGER NOT NULL DEFAULT 0,
        alpha_days INTEGER NOT NULL DEFAULT 0,
        holiday_days INTEGER NOT NULL DEFAULT 0,
        working_days INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS kpi_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        score NUMERIC NOT NULL DEFAULT 0,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        evaluated_by TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS payroll_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        period TEXT NOT NULL,
        basic_salary NUMERIC NOT NULL DEFAULT 0,
        meal_allowance NUMERIC NOT NULL DEFAULT 0,
        position_allowance NUMERIC NOT NULL DEFAULT 0,
        kpi_bonus NUMERIC NOT NULL DEFAULT 0,
        alpha_deduction NUMERIC NOT NULL DEFAULT 0,
        overtime_pay NUMERIC NOT NULL DEFAULT 0,
        other_deductions NUMERIC NOT NULL DEFAULT 0,
        gross_pay NUMERIC NOT NULL DEFAULT 0,
        net_pay NUMERIC NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        paid_date TEXT,
        paid_via TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        menu_name TEXT NOT NULL UNIQUE,
        ingredients TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS closed_periods (
        id TEXT PRIMARY KEY,
        period TEXT NOT NULL UNIQUE,
        closed_at TEXT NOT NULL,
        closed_by TEXT NOT NULL,
        notes TEXT
      )`,
    `ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES expense_categories(id)`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS approved_by TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS approved_at TEXT`,
    `ALTER TABLE daily_checklists ADD COLUMN IF NOT EXISTS leader_tasks TEXT DEFAULT '[]'`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS overtime_approved BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id TEXT`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS location TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE employees RENAME COLUMN nik TO username`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS leader_bar_tasks JSONB`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS leader_kitchen_tasks JSONB`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS leader_baker_tasks JSONB`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS manager_tasks JSONB`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 10`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'EXCLUSIVE'`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_cashier_discount NUMERIC DEFAULT 10`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS monthly_revenue_target DOUBLE PRECISION DEFAULT 150000000`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS target_bonus_amount DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS division_kpi_bonus_target TEXT DEFAULT '{}'`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS schedule_approvals TEXT DEFAULT '{}'`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_store_sales_bonus BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_leader_allowance_bonus BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_kpi_score_bonus BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS pos_supervisor_pin TEXT DEFAULT '1234'`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_deduct_stock_on_sale BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS allow_negative_stock_sale BOOLEAN DEFAULT TRUE`,
    `UPDATE cash_transactions SET type = 'CASH_OUT' WHERE type IN ('OUT', 'EXPENSE')`,
    `UPDATE cash_transactions SET type = 'CASH_IN' WHERE type IN ('IN', 'INCOME')`,
    `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        receipt_no TEXT NOT NULL,
        shift_id TEXT,
        outlet_id TEXT NOT NULL DEFAULT 'OUTLET-MAIN',
        order_type TEXT NOT NULL,
        table_number TEXT,
        customer_name TEXT,
        status TEXT NOT NULL,
        subtotal NUMERIC NOT NULL DEFAULT 0,
        discount_percent NUMERIC NOT NULL DEFAULT 0,
        discount_amount NUMERIC NOT NULL DEFAULT 0,
        discount_reason TEXT,
        tax_percent NUMERIC NOT NULL DEFAULT 0,
        tax_amount NUMERIC NOT NULL DEFAULT 0,
        tax_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
        total_amount NUMERIC NOT NULL DEFAULT 0,
        notes TEXT,
        idempotency_key TEXT,
        cashier_id TEXT,
        cashier_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        paid_at TEXT,
        void_reason TEXT,
        void_approved_by TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_name TEXT NOT NULL,
        recipe_id TEXT,
        variant_name TEXT,
        quantity NUMERIC NOT NULL,
        unit_price NUMERIC NOT NULL,
        subtotal NUMERIC NOT NULL,
        modifiers JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        print_destination TEXT NOT NULL DEFAULT 'BAR',
        is_printed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        shift_id TEXT,
        payment_method TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        cash_received NUMERIC,
        change_amount NUMERIC,
        reference_no TEXT,
        cash_account_id TEXT,
        created_at TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS pos_printers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        connection_type TEXT NOT NULL,
        target_station TEXT NOT NULL,
        ip_address TEXT,
        port INTEGER NOT NULL DEFAULT 9100,
        mac_address TEXT,
        paper_width TEXT NOT NULL DEFAULT '80mm',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL
      )`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'QUEUED'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_promotion_id TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_promotion_name TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_approved_by TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount REAL`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_method TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_at TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_restock_option TEXT`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'QUEUED'`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS pic_employee_id TEXT`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS pic_employee_name TEXT`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS team_members TEXT`,
    `CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        min_spend REAL,
        max_discount REAL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        start_date TEXT,
        end_date TEXT,
        description TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS manager_approval_requests (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        receipt_no TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        cashier_name TEXT NOT NULL,
        table_number TEXT,
        customer_name TEXT,
        refund_method TEXT,
        refund_restock_option TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        requested_at TEXT NOT NULL,
        responded_at TEXT,
        responded_by TEXT,
        response_note TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        division TEXT NOT NULL DEFAULT 'BAR',
        description TEXT,
        image_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        variants JSONB DEFAULT '[]'::jsonb,
        modifier_groups JSONB DEFAULT '[]'::jsonb,
        created_at TEXT NOT NULL,
        updated_at TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS batch_preparations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        division TEXT NOT NULL DEFAULT 'BAR',
        target_ingredient_id TEXT NOT NULL,
        target_ingredient_name TEXT,
        yield_quantity NUMERIC NOT NULL,
        yield_unit TEXT NOT NULL,
        ingredients JSONB NOT NULL,
        notes TEXT,
        last_prepared_date TEXT
      )`,
    `ALTER TABLE batch_preparations ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'BAR'`,
    `ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH'`,
    `ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS order_id TEXT`,
    `ALTER TABLE stock_opnames ADD COLUMN IF NOT EXISTS date TEXT`,
    `ALTER TABLE cash_transactions ALTER COLUMN amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE sales_transactions ALTER COLUMN quantity_sold TYPE DOUBLE PRECISION`,
    `ALTER TABLE sales_transactions ALTER COLUMN total_price TYPE DOUBLE PRECISION`,
    `ALTER TABLE ingredients ALTER COLUMN current_stock TYPE DOUBLE PRECISION`,
    `ALTER TABLE ingredients ALTER COLUMN min_stock TYPE DOUBLE PRECISION`,
    `ALTER TABLE ingredients ALTER COLUMN cost_per_unit TYPE DOUBLE PRECISION`,
    `ALTER TABLE stock_movements ALTER COLUMN quantity TYPE DOUBLE PRECISION`,
    `ALTER TABLE stock_movements ALTER COLUMN unit_cost TYPE DOUBLE PRECISION`,
    `ALTER TABLE stock_movements ALTER COLUMN total_cost TYPE DOUBLE PRECISION`,
    `ALTER TABLE shifts ALTER COLUMN starting_cash TYPE DOUBLE PRECISION`,
    `ALTER TABLE shifts ALTER COLUMN expected_ending_cash TYPE DOUBLE PRECISION`,
    `ALTER TABLE shifts ALTER COLUMN actual_ending_cash TYPE DOUBLE PRECISION`,
    `ALTER TABLE shifts ALTER COLUMN difference TYPE DOUBLE PRECISION`,
    `ALTER TABLE orders ALTER COLUMN subtotal TYPE DOUBLE PRECISION`,
    `ALTER TABLE orders ALTER COLUMN discount_amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE orders ALTER COLUMN tax_amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE orders ALTER COLUMN total_amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE orders ALTER COLUMN refund_amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE order_items ALTER COLUMN quantity TYPE DOUBLE PRECISION`,
    `ALTER TABLE order_items ALTER COLUMN unit_price TYPE DOUBLE PRECISION`,
    `ALTER TABLE order_items ALTER COLUMN subtotal TYPE DOUBLE PRECISION`,
    `ALTER TABLE payments ALTER COLUMN amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE payments ALTER COLUMN cash_received TYPE DOUBLE PRECISION`,
    `ALTER TABLE payments ALTER COLUMN change_amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE purchase_orders ALTER COLUMN total_amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE purchase_orders ALTER COLUMN amount_paid TYPE DOUBLE PRECISION`,
    `ALTER TABLE payroll_records ALTER COLUMN basic_salary TYPE DOUBLE PRECISION`,
    `ALTER TABLE payroll_records ALTER COLUMN gross_pay TYPE DOUBLE PRECISION`,
    `ALTER TABLE payroll_records ALTER COLUMN net_pay TYPE DOUBLE PRECISION`,
    `ALTER TABLE manager_approval_requests ALTER COLUMN amount TYPE DOUBLE PRECISION`
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
    } catch (err: any) {
      if (!err?.message?.includes("already exists") && !err?.message?.includes("duplicate") && !err?.message?.includes("does not exist")) {
        console.warn("⚠️  ensureTables warning for query:", q, err?.message);
      }
    }
  }

  // Migrasi PIN default lama (1234) ke PIN 6-digit standar (123456)
  try {
    const pin1234Hash = crypto.createHash("sha256").update("1234").digest("hex");
    const pin123456Hash = crypto.createHash("sha256").update("123456").digest("hex");
    await pool.query(
      `UPDATE users SET pin = $1 WHERE pin = '1234' OR pin = $2`,
      [pin123456Hash, pin1234Hash]
    );

    // Pastikan user default POS Kasir ada
    const checkKasir = await pool.query(`SELECT id FROM users WHERE username = 'kasir' LIMIT 1`);
    if (checkKasir.rowCount === 0) {
      await pool.query(
        `INSERT INTO users (id, username, pin, name, role, department)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["pos-terminal-1", "kasir", pin123456Hash, "Terminal Kasir POS", "KASIR", "Bar & Kasir"]
      );
    }
  } catch (migErr: any) {
    // Abaikan jika tabel users belum terisi atau database offline
  }

  console.log("✅ Schema ensured: Fase 1-4 & POS tables ready.");
}

async function startServer() {
  await ensureTables();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(compression({
    threshold: 1024,
  }));
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // --- RATE LIMITING ---
  const syncLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 requests per windowMs
    message: { error: "Too many requests from this IP, please try again later." }
  });
  app.use("/api/sync", syncLimiter);

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      isDbConnected,
      timestamp: new Date().toISOString(),
    });
  });


  const getTable = (tableName: string) => {
    switch (tableName) {
      case "cash_accounts":
        return schema.cashAccounts;
      case "cash_transactions":
        return schema.cashTransactions;
      case "settings":
        return schema.settings;
      case "users":
        return schema.users;
      case "device_sessions":
        return schema.deviceSessions;
      case "ingredients":
        return schema.ingredients;
      case "stock_movements":
        return schema.stockMovements;
      case "sales_transactions":
        return schema.salesTransactions;
      case "sales_import_logs":
        return schema.salesImportLogs;
      case "recipes":
        return schema.recipes;
      case "audit_logs":
        return schema.auditLogs;
      // Fase 1
      case "expense_categories":
        return schema.expenseCategories;
      // Fase 2
      case "budgets":
        return schema.budgets;
      case "bank_reconciliations":
        return schema.bankReconciliations;
      case "bank_statement_lines":
        return schema.bankStatementLines;
      // Fase 3
      case "stock_opnames":
        return schema.stockOpnames;
      case "stock_opname_items":
        return schema.stockOpnameItems;
      // Fase 4
      case "payroll_records":
        return schema.payrollRecords;
      case "employees":
        return schema.employees;
      case "employee_contracts":
      case "contracts":
        return schema.employeeContracts;
      case "attendance_records":
      case "attendances":
        return schema.attendanceRecords;
      case "daily_attendances":
        return schema.dailyAttendances;
      case "employee_shifts":
        return schema.employeeShifts;
      case "kpi_records":
        return schema.kpiRecords;
      case "shifts":
        return schema.shifts;
      // POS & Kasir
      case "orders":
        return schema.orders;
      case "order_items":
        return schema.orderItems;
      case "payments":
        return schema.payments;
      case "pos_printers":
        return schema.posPrinters;
      case "promotions":
        return schema.promotions;

      default:
        return null;
    }
  };

  const sanitizeIngredient = (i: any) => ({
    id: String(i.id || crypto.randomUUID()),
    name: String(i.name || ""),
    unit: String(i.unit || "pcs"),
    currentStock: Number(i.currentStock) || 0,
    minStock: Number(i.minStock) || 0,
    category: String(i.category || ""),
    costPerUnit: Number(i.costPerUnit) || 0,
  });

  const sanitizeRecipe = (r: any) => ({
    id: String(r.id || crypto.randomUUID()),
    menuName: String(r.menuName || ""),
    ingredients: Array.isArray(r.ingredients)
      ? JSON.stringify(r.ingredients)
      : (typeof r.ingredients === "string" ? r.ingredients : "[]"),
  });

  const formatRecipesForClient = (recs: any[]) =>
    (recs || []).map((r: any) => {
      let ingList = r?.ingredients;
      if (typeof ingList === "string") {
        try {
          ingList = JSON.parse(ingList);
        } catch {
          ingList = [];
        }
      }
      return {
        ...r,
        ingredients: Array.isArray(ingList) ? ingList : [],
      };
    });

  const formatShiftsForClient = (shiftList: any[]) =>
    (shiftList || []).map((s: any) => {
      let tm = s?.teamMembers;
      if (typeof tm === "string") {
        try {
          tm = JSON.parse(tm);
        } catch {
          tm = [];
        }
      }
      return {
        ...s,
        teamMembers: Array.isArray(tm) ? tm : [],
      };
    });

  const sanitizeStockMovement = (m: any) => ({
    id: String(m.id || crypto.randomUUID()),
    ingredientId: String(m.ingredientId || ""),
    type: String(m.type || "IN"),
    quantity: Number(m.quantity) || 0,
    date: String(m.date || new Date().toISOString()),
    note: m.note ? String(m.note) : null,
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
    totalCost: m.totalCost != null ? Number(m.totalCost) : null,
    referenceId: m.referenceId ? String(m.referenceId) : null,
    location: m.location ? String(m.location) : null,
    createdBy: String(m.createdBy || "System"),
  });

  const sanitizeSalesTransaction = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    date: String(s.date || new Date().toISOString()),
    menuName: String(s.menuName || ""),
    quantitySold: Number(s.quantitySold) || 0,
    totalPrice: Math.round(Number(s.totalPrice) || 0),
    importLogId: String(s.importLogId || ""),
    paymentMethod: s.paymentMethod ? String(s.paymentMethod) : "CASH",
    orderId: s.orderId ? String(s.orderId) : null,
  });

  const sanitizeSalesImportLog = (l: any) => ({
    id: String(l.id || crypto.randomUUID()),
    importDate: String(l.importDate || new Date().toISOString()),
    fileName: String(l.fileName || ""),
    rowCount: Number(l.rowCount) || 0,
    status: String(l.status || "SUCCESS"),
    createdBy: String(l.createdBy || "System"),
  });

  const sanitizeAuditLog = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    userId: String(a.userId || ""),
    action: String(a.action || "CREATE"),
    tableName: String(a.tableName || ""),
    recordId: String(a.recordId || ""),
    timestamp: String(a.timestamp || new Date().toISOString()),
  });

  const sanitizeCashTransaction = (f: any) => {
    let type = String(f.type || "CASH_IN");
    if (type === "OUT" || type === "EXPENSE") type = "CASH_OUT";
    if (type === "IN" || type === "INCOME") type = "CASH_IN";
    return {
      id: String(f.id || crypto.randomUUID()),
      accountId: String(f.accountId || ""),
      type,
      date: String(f.date || new Date().toISOString()),
      amount: Number(f.amount) || 0,
      description: String(f.description || ""),
      category: String(f.category || ""),
      categoryId: f.categoryId ? String(f.categoryId) : null,
      referenceId: f.referenceId ? String(f.referenceId) : null,
    };
  };

  // ─── New sanitizers (Fase 1-4) ───────────────────────────────────────────
  const sanitizeExpenseCategory = (c: any) => ({
    id: String(c.id || crypto.randomUUID()),
    name: String(c.name || ""),
    type: String(c.type || "LAINNYA"),
    parentId: c.parentId ? String(c.parentId) : null,
    color: String(c.color || "#6B7280"),
    icon: String(c.icon || "tag"),
    isActive: c.isActive !== undefined ? Boolean(c.isActive) : true,
    sortOrder: Number(c.sortOrder) || 0,
  });

  const sanitizeBudget = (b: any) => ({
    id: String(b.id || crypto.randomUUID()),
    categoryId: b.categoryId ? String(b.categoryId) : null,
    period: String(b.period || ""),
    amount: Number(b.amount) || 0,
    notes: b.notes ? String(b.notes) : null,
    createdAt: String(b.createdAt || new Date().toISOString()),
  });

  const sanitizeBankReconciliation = (r: any) => ({
    id: String(r.id || crypto.randomUUID()),
    period: String(r.period || ""),
    bankName: String(r.bankName || ""),
    accountNumber: r.accountNumber ? String(r.accountNumber) : null,
    openingBalance: Number(r.openingBalance) || 0,
    closingBalance: Number(r.closingBalance) || 0,
    status: String(r.status || "DRAFT"),
    notes: r.notes ? String(r.notes) : null,
    createdBy: r.createdBy ? String(r.createdBy) : null,
    createdAt: String(r.createdAt || new Date().toISOString()),
  });

  const sanitizeBankStatementLine = (l: any) => ({
    id: String(l.id || crypto.randomUUID()),
    reconciliationId: String(l.reconciliationId || ""),
    date: String(l.date || ""),
    description: String(l.description || ""),
    amount: Number(l.amount) || 0,
    transactionType: String(l.transactionType || "CREDIT"),
    isMatched: Boolean(l.isMatched),
    matchedTransactionId: l.matchedTransactionId ? String(l.matchedTransactionId) : null,
    createdAt: String(l.createdAt || new Date().toISOString()),
  });

  const sanitizeStockOpname = (o: any) => ({
    id: String(o.id || crypto.randomUUID()),
    date: String(o.date || new Date().toISOString()),
    status: String(o.status || "DRAFT"),
    notes: o.notes ? String(o.notes) : null,
    createdBy: String(o.createdBy || "System"),
    createdAt: String(o.createdAt || new Date().toISOString()),
  });

  const sanitizeStockOpnameItem = (i: any) => ({
    id: String(i.id || crypto.randomUUID()),
    opnameId: String(i.opnameId || ""),
    ingredientId: String(i.ingredientId || ""),
    systemStock: Number(i.systemStock) || 0,
    physicalStock: Number(i.physicalStock) || 0,
    difference: Number(i.difference) || 0,
    notes: i.notes ? String(i.notes) : null,
  });

  const sanitizePayrollRecord = (p: any) => ({
    id: String(p.id || crypto.randomUUID()),
    employeeId: String(p.employeeId || ""),
    period: String(p.period || ""),
    basicSalary: Number(p.basicSalary) || 0,
    mealAllowance: Number(p.mealAllowance) || 0,
    positionAllowance: Number(p.positionAllowance) || 0,
    kpiBonus: Number(p.kpiBonus) || 0,
    alphaDeduction: Number(p.alphaDeduction) || 0,
    overtimePay: Number(p.overtimePay) || 0,
    overtimeHours: Number(p.overtimeHours) || 0,
    overtimeRate: Number(p.overtimeRate) || 0,
    otherDeductions: Number(p.otherDeductions) || 0,
    grossPay: Number(p.grossPay) || 0,
    netPay: Number(p.netPay) || 0,
    status: String(p.status || "DRAFT"),
    approvedBy: p.approvedBy ? String(p.approvedBy) : null,
    approvedAt: p.approvedAt ? String(p.approvedAt) : null,
    paidDate: p.paidDate ? String(p.paidDate) : null,
    paidVia: p.paidVia ? String(p.paidVia) : null,
    notes: p.notes ? String(p.notes) : null,
    createdBy: String(p.createdBy || "System"),
    createdAt: String(p.createdAt || new Date().toISOString()),
  });

  const sanitizeCashAccount = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    name: String(a.name || ""),
    type: String(a.type || "CASH"),
    isDefault: Boolean(a.isDefault),
  });

  const sanitizeSettings = (st: any, existingRow?: any, isPrivilegedRole = true) => {
    const divTarget = typeof st?.divisionKpiBonusTarget === "object" ? { ...st.divisionKpiBonusTarget } : {};
    if (st?.leaderJobdeskAllowanceRules && Array.isArray(st.leaderJobdeskAllowanceRules)) {
      divTarget.__leaderAllowanceRules = st.leaderJobdeskAllowanceRules;
    }
    if (st?.shiftDefinitions && Array.isArray(st.shiftDefinitions)) {
      divTarget.__shiftDefinitions = st.shiftDefinitions;
    }

    const incomingKey = st?.gemini_api_key ?? st?.geminiApiKey;
    const isMaskedKey = typeof incomingKey === "string" && incomingKey.startsWith("••");
    let resolvedGeminiKey = existingRow?.gemini_api_key ?? process.env.GEMINI_API_KEY ?? null;
    if (isPrivilegedRole && incomingKey !== undefined && !isMaskedKey) {
      resolvedGeminiKey = incomingKey || process.env.GEMINI_API_KEY || null;
    }

    const incomingSupPin = st?.posSupervisorPin;
    const isMaskedPin = typeof incomingSupPin === "string" && incomingSupPin.startsWith("••");
    let resolvedSupervisorPin = String(existingRow?.posSupervisorPin || "1234");
    if (isPrivilegedRole && incomingSupPin !== undefined && incomingSupPin !== "" && !isMaskedPin) {
      resolvedSupervisorPin = String(incomingSupPin);
    }

    return {
      id: "1",
      logoDataUrl: st?.logoDataUrl || null,
      brandName: String(st?.brandName || "Julia's Management System"),
      companyAddress: String(st?.companyAddress || ""),
      bankDetails: String(st?.bankDetails || ""),
      salesPerson: String(st?.salesPerson || ""),
      footerMessage: String(st?.footerMessage || ""),
      language: String(st?.language || "id"),
      leaderBarTasks: Array.isArray(st?.leaderBarTasks) ? JSON.stringify(st.leaderBarTasks) : (st?.leaderBarTasks || "[]"),
      leaderKitchenTasks: Array.isArray(st?.leaderKitchenTasks) ? JSON.stringify(st.leaderKitchenTasks) : (st?.leaderKitchenTasks || "[]"),
      leaderBakerTasks: Array.isArray(st?.leaderBakerTasks) ? JSON.stringify(st.leaderBakerTasks) : (st?.leaderBakerTasks || "[]"),
      managerTasks: Array.isArray(st?.managerTasks) ? JSON.stringify(st.managerTasks) : (st?.managerTasks || "[]"),
      gemini_api_key: resolvedGeminiKey,
      taxEnabled: Boolean(st?.taxEnabled ?? false),
      taxRate: Number(st?.taxRate ?? 10),
      taxMode: String(st?.taxMode || "EXCLUSIVE"),
      maxCashierDiscount: Number(st?.maxCashierDiscount ?? 10),
      monthlyRevenueTarget: Number(st?.monthlyRevenueTarget !== undefined ? st.monthlyRevenueTarget : 150000000),
      targetBonusAmount: Number(st?.targetBonusAmount !== undefined ? st.targetBonusAmount : 0),
      divisionKpiBonusTarget: JSON.stringify(divTarget),
      scheduleApprovals: typeof st?.scheduleApprovals === "object" ? JSON.stringify(st.scheduleApprovals) : String(st?.scheduleApprovals || "{}"),
      enableStoreSalesBonus: st?.enableStoreSalesBonus !== false,
      enableLeaderAllowanceBonus: st?.enableLeaderAllowanceBonus !== false,
      enableKpiScoreBonus: Boolean(st?.enableKpiScoreBonus),
      posSupervisorPin: resolvedSupervisorPin,
      autoDeductStockOnSale: st?.autoDeductStockOnSale !== false,
      allowNegativeStockSale: st?.allowNegativeStockSale !== false,
    };
  };

  const sanitizeUser = (u: any) => {
    let role = String(u.role || "MANAGER");
    if (["ADMIN_OPERASIONAL", "HRD", "MARKETING", "PURCHASING"].includes(role)) role = "MANAGER";
    if (["BARISTA", "WAITER"].includes(role)) role = "KASIR";

    return {
      id: String(u.id || crypto.randomUUID()),
      username: String(u.username || ""),
      name: String(u.name || ""),
      role,
      department: u.department ? String(u.department) : null,
    };
  };

  const sanitizeUserForInsert = (u: any, existingPin?: string) => {
    let role = String(u.role || "MANAGER");
    if (["ADMIN_OPERASIONAL", "HRD", "MARKETING", "PURCHASING"].includes(role)) role = "MANAGER";
    if (["BARISTA", "WAITER"].includes(role)) role = "KASIR";
    let finalPin = u.pin ? String(u.pin) : (existingPin || "123456");
    if (finalPin.length !== 64) {
      finalPin = crypto.createHash("sha256").update(finalPin).digest("hex");
    }

    return {
      id: String(u.id || crypto.randomUUID()),
      username: String(u.username || ""),
      pin: finalPin,
      name: String(u.name || ""),
      role,
      department: u.department ? String(u.department) : null,
    };
  };

  const sanitizeDeviceSession = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    userId: String(s.userId || ""),
    username: String(s.username || ""),
    userName: String(s.userName || ""),
    deviceName: String(s.deviceName || "Unknown"),
    browser: String(s.browser || "Unknown"),
    os: String(s.os || "Unknown"),
    deviceType: String(s.deviceType || "desktop"),
    ipAddress: s.ipAddress ? String(s.ipAddress) : null,
    location: s.location ? String(s.location) : null,
    lastActive: String(s.lastActive || new Date().toISOString()),
    createdAt: String(s.createdAt || new Date().toISOString()),
    status: String(s.status || "ACTIVE"),
  });

  const sanitizeEmployee = (e: any) => ({
    id: String(e.id || crypto.randomUUID()),
    username: String(e.username || ""),
    name: String(e.name || ""),
    position: String(e.position || ""),
    department: String(e.department || ""),
    employmentType: String(e.employmentType || ""),
    startDate: String(e.startDate || ""),
    endDate: e.endDate ? String(e.endDate) : null,
    phone: String(e.phone || ""),
    address: String(e.address || ""),
    status: String(e.status || ""),
    createdAt: String(e.createdAt || new Date().toISOString()),
  });

  const sanitizeEmployeeContract = (c: any) => ({
    id: String(c.id || crypto.randomUUID()),
    employeeId: String(c.employeeId || ""),
    effectiveDate: String(c.effectiveDate || ""),
    basicSalary: Number(c.basicSalary) || 0,
    mealAllowance: Number(c.mealAllowance) || 0,
    positionAllowance: Number(c.positionAllowance) || 0,
    alphaDeductionPerDay: Number(c.alphaDeductionPerDay) || 0,
    workingDaysPerMonth: Number(c.workingDaysPerMonth) || 0,
    notes: String(c.notes || ""),
  });

  const sanitizeAttendanceRecord = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    employeeId: String(a.employeeId || ""),
    period: String(a.period || ""),
    presentDays: Number(a.presentDays) || 0,
    sickDays: Number(a.sickDays) || 0,
    permissionDays: Number(a.permissionDays) || 0,
    alphaDays: Number(a.alphaDays) || 0,
    holidayDays: Number(a.holidayDays) || 0,
    workingDays: Number(a.workingDays) || 0,
    notes: String(a.notes || ""),
    createdBy: String(a.createdBy || ""),
    createdAt: String(a.createdAt || new Date().toISOString()),
  });


  const sanitizeEmployeeShift = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    employeeId: String(s.employeeId || ""),
    date: String(s.date || ""),
    shiftType: String(s.shiftType || "OFF"),
    notes: String(s.notes || ""),
  });
  const sanitizeDailyAttendance = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    employeeId: String(a.employeeId || ""),
    date: String(a.date || ""),
    clockInTime: a.clockInTime ? String(a.clockInTime) : null,
    clockOutTime: a.clockOutTime ? String(a.clockOutTime) : null,
    clockInLocation: a.clockInLocation ? a.clockInLocation : null,
    clockOutLocation: a.clockOutLocation ? a.clockOutLocation : null,
    clockInPhotoUrl: a.clockInPhotoUrl ? String(a.clockInPhotoUrl) : null,
    clockOutPhotoUrl: a.clockOutPhotoUrl ? String(a.clockOutPhotoUrl) : null,
    status: String(a.status || "HADIR"),
    approvalStatus: a.approvalStatus ? String(a.approvalStatus) : "PENDING",
    overtimeHours: Number(a.overtimeHours) || 0,
    overtimeApproved: Boolean(a.overtimeApproved),
    notes: String(a.notes || ""),
  });


  const sanitizeDailyChecklist = (c: any) => ({
    id: String(c.id || crypto.randomUUID()),
    employeeId: String(c.employeeId || ""),
    date: String(c.date || ""),
    cleaningDone: Boolean(c.cleaningDone),
    equipmentChecked: Boolean(c.equipmentChecked),
    leaderTasks: Array.isArray(c.leaderTasks) ? JSON.stringify(c.leaderTasks) : (typeof c.leaderTasks === "string" ? c.leaderTasks : "[]"),
    notes: String(c.notes || ""),
  });

  const sanitizeKPIRecord = (k: any) => ({
    id: String(k.id || crypto.randomUUID()),
    employeeId: String(k.employeeId || ""),
    quarter: Number(k.quarter) || 1,
    year: Number(k.year) || new Date().getFullYear(),
    targets: Array.isArray(k.targets) ? k.targets : [],
    totalScore: Number(k.totalScore) || 0,
    kpiBonus: Number(k.kpiBonus) || 0,
    notes: String(k.notes || ""),
    evaluatedBy: String(k.evaluatedBy || ""),
    createdAt: String(k.createdAt || new Date().toISOString()),
  });

  const sanitizeSupplier = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    name: String(s.name || ""),
    picName: String(s.picName || ""),
    contact: String(s.contact || ""),
    address: String(s.address || ""),
    notes: String(s.notes || ""),
  });

  const sanitizePurchaseOrder = (p: any) => ({
    id: String(p.id || crypto.randomUUID()),
    poNumber: String(p.poNumber || ""),
    supplierId: String(p.supplierId || ""),
    date: String(p.date || new Date().toISOString()),
    items: Array.isArray(p.items) ? p.items : [],
    totalAmount: Number(p.totalAmount) || 0,
    status: String(p.status || "UNPAID"),
    deliveryStatus: String(p.deliveryStatus || "PENDING"),
    paymentMethod: String(p.paymentMethod || "CASH"),
    dueDate: p.dueDate ? String(p.dueDate) : null,
    amountPaid: Number(p.amountPaid) || 0,
  });

  const sanitizeShift = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    userId: String(s.userId || ""),
    cashAccountId: String(s.cashAccountId || ""),
    startTime: String(s.startTime || new Date().toISOString()),
    endTime: s.endTime ? String(s.endTime) : null,
    startingCash: Number(s.startingCash) || 0,
    expectedEndingCash:
      s.expectedEndingCash !== null && s.expectedEndingCash !== undefined
        ? Number(s.expectedEndingCash)
        : null,
    actualEndingCash:
      s.actualEndingCash !== null && s.actualEndingCash !== undefined
        ? Number(s.actualEndingCash)
        : null,
    difference:
      s.difference !== null && s.difference !== undefined
        ? Number(s.difference)
        : null,
    status: String(s.status || "OPEN"),
    picEmployeeId: s.picEmployeeId ? String(s.picEmployeeId) : null,
    picEmployeeName: s.picEmployeeName ? String(s.picEmployeeName) : null,
    teamMembers: Array.isArray(s.teamMembers)
      ? JSON.stringify(s.teamMembers)
      : s.teamMembers
        ? String(s.teamMembers)
        : null,
  });

  const sanitizePromotion = (p: any) => ({
    id: String(p.id || crypto.randomUUID()),
    name: String(p.name || ""),
    code: p.code ? String(p.code) : null,
    type: String(p.type || "PERCENT"),
    value: Number(p.value) || 0,
    minSpend: p.minSpend !== null && p.minSpend !== undefined ? Number(p.minSpend) : null,
    maxDiscount: p.maxDiscount !== null && p.maxDiscount !== undefined ? Number(p.maxDiscount) : null,
    isActive: Boolean(p.isActive !== undefined ? p.isActive : true),
    startDate: p.startDate ? String(p.startDate) : null,
    endDate: p.endDate ? String(p.endDate) : null,
    description: p.description ? String(p.description) : null,
    createdAt: String(p.createdAt || new Date().toISOString()),
    createdBy: p.createdBy ? String(p.createdBy) : null,
  });

  const initialPromotions = [
    {
      id: "promo-welcome-10",
      name: "Diskon Member Baru 10%",
      code: "MEMBER10",
      type: "PERCENT",
      value: 10,
      minSpend: 30000,
      maxDiscount: 20000,
      isActive: true,
      description: "Diskon 10% untuk member dengan belanja min. Rp 30.000 (Maks Rp 20.000)",
      createdAt: new Date().toISOString(),
      createdBy: "System",
    },
    {
      id: "promo-jumat-berkah",
      name: "Jumat Berkah Potongan Rp 5.000",
      code: "BERKAH5K",
      type: "NOMINAL",
      value: 5000,
      minSpend: 35000,
      maxDiscount: null,
      isActive: true,
      description: "Potongan langsung Rp 5.000 untuk pembelian min. Rp 35.000",
      createdAt: new Date().toISOString(),
      createdBy: "System",
    },
  ];

  // In-memory fallback state for offline usage
  let offlineState: any = {
    users: initialUsers,
    settings: initialSettings,
    ingredients: JSON.parse(JSON.stringify(initialIngredients)),
    recipes: formatRecipesForClient(initialRecipes),
    products: JSON.parse(JSON.stringify(initialProducts)),
    promotions: initialPromotions,
    cash_accounts: [
      { id: "cash-drawer-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true },
      { id: "bank-bca-main", name: "Rekening Bank / QRIS Utama", type: "BANK", isDefault: false },
    ],
    stock_movements: [],
    sales_transactions: [],
    orders: [],
    order_items: [],
    payments: [],
    shifts: [],
    device_sessions: [],
    expense_categories: defaultCategories,
    budgets: [],
    bank_reconciliations: [],
    bank_statement_lines: [],
    stock_opnames: [],
    stock_opname_items: [],
    payroll_records: [],
    closed_periods: [],
    batch_preparations: [],
    suppliers: [],
    purchase_orders: [],
    employees: [],
    contracts: [],
    employeeShifts: [],
    attendances: [],
    dailyAttendances: [],
    dailyChecklists: [],
    kpiRecords: [],
  };

  let serverDataVersion = Date.now();
  const bumpDataVersion = () => {
    serverDataVersion = Date.now();
  };

  // Helper autentikasi sesi berbasis Bearer token yang aman (tanpa fallback ke Super Admin!)
  const resolveAuthUser = async (req: express.Request) => {
    const authHeader = req.headers["authorization"] as string | undefined;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader?.split(" ")[1];
    if (!token) return null;

    if (isDbConnected) {
      try {
        const sessions = await db
          .select()
          .from(schema.deviceSessions)
          .where(eq(schema.deviceSessions.id, token))
          .limit(1);
        const session = sessions[0];
        if (session && session.status === "ACTIVE") {
          const userRows = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, session.userId))
            .limit(1);
          if (userRows[0]) return userRows[0];
        }
      } catch { }
    }

    if (offlineState) {
      const session = (offlineState.device_sessions || []).find(
        (s: any) => s.id === token && s.status !== "REVOKED" && s.status !== "EXPIRED"
      );
      if (session) {
        const u = (offlineState.users || []).find((usr: any) => usr.id === session.userId);
        if (u) return u;
      }
    }
    return null;
  };

  // Helper verifikasi PIN Supervisor / Manager / Unlock Layar POS dengan dukungan penuh SHA-256
  const verifyPosPin = async (
    rawPin: string,
    purpose: "SUPERVISOR" | "UNLOCK" = "SUPERVISOR",
    currentUserId?: string
  ): Promise<{ ok: boolean; status: number; approver?: any; error?: string }> => {
    const cleanPin = String(rawPin || "").trim();
    if (!cleanPin) {
      return { ok: false, status: 400, error: "PIN wajib diisi." };
    }
    const pinHash =
      cleanPin.length === 64
        ? cleanPin
        : crypto.createHash("sha256").update(cleanPin).digest("hex");

    let configuredSupervisorPin = "1234";
    let allUsers: any[] = [];

    if (isDbConnected) {
      try {
        const stRows = await db.select().from(schema.settings).limit(1);
        configuredSupervisorPin = String(stRows[0]?.posSupervisorPin || "1234").trim();
        allUsers = await db.select().from(schema.users);
      } catch { }
    }
    if (allUsers.length === 0 && offlineState) {
      const rawSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
      configuredSupervisorPin = String(rawSt?.posSupervisorPin || "1234").trim();
      allUsers = offlineState.users || initialUsers;
    }

    const supPinHash =
      configuredSupervisorPin.length === 64
        ? configuredSupervisorPin
        : crypto.createHash("sha256").update(configuredSupervisorPin).digest("hex");

    // 1. Jika tujuan UNLOCK layar kasir: cek juga PIN akun kasir yang sedang aktif
    if (purpose === "UNLOCK" && currentUserId) {
      const activeOperator = allUsers.find((u: any) => u.id === currentUserId);
      if (activeOperator && (activeOperator.pin === pinHash || activeOperator.pin === cleanPin)) {
        return {
          ok: true,
          status: 200,
          approver: { id: activeOperator.id, name: activeOperator.name, role: activeOperator.role },
        };
      }
    }

    // 2. Cek PIN Supervisor POS khusus yang disetel Manager di Pengaturan
    if (cleanPin === configuredSupervisorPin || pinHash === supPinHash) {
      return {
        ok: true,
        status: 200,
        approver: { id: "pos_supervisor", name: "Supervisor POS", role: "MANAGER" },
      };
    }

    // 3. Cek apakah PIN milik akun OWNER (Aturan #5b: Owner Read-Only tidak boleh mengotorisasi aksi operasional)
    const matchedOwner = allUsers.find(
      (u: any) => u.role === "OWNER" && (u.pin === pinHash || u.pin === cleanPin)
    );
    if (matchedOwner && purpose === "SUPERVISOR") {
      return {
        ok: false,
        status: 403,
        error: "Akun Owner berstatus Read-Only (Pengawasan). Otorisasi harus dilakukan oleh Manager atau Super Admin.",
      };
    }

    // 4. Cek apakah PIN cocok dengan akun MANAGER atau SUPER_ADMIN (mendukung SHA-256 maupun plaintext di offline seed)
    const matchedMgr = allUsers.find(
      (u: any) =>
        (u.role === "MANAGER" || u.role === "SUPER_ADMIN") &&
        (u.pin === pinHash || u.pin === cleanPin)
    );
    if (matchedMgr) {
      return {
        ok: true,
        status: 200,
        approver: { id: matchedMgr.id, name: matchedMgr.name, role: matchedMgr.role },
      };
    }

    return {
      ok: false,
      status: 403,
      error: "PIN Supervisor / Manager tidak valid atau tidak memiliki wewenang otorisasi.",
    };
  };

  const pinVerifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: { error: "Terlalu banyak percobaan PIN. Coba lagi dalam 1 menit." },
  });

  app.post("/api/pos/verify-pin", pinVerifyLimiter, async (req, res) => {
    try {
      const { pin, purpose = "SUPERVISOR", currentUserId } = req.body || {};
      const result = await verifyPosPin(pin, purpose === "UNLOCK" ? "UNLOCK" : "SUPERVISOR", currentUserId);
      if (!result.ok) {
        return res.status(result.status).json({ valid: false, error: result.error });
      }
      return res.json({ valid: true, approver: result.approver });
    } catch (err: any) {
      return res.status(500).json({ valid: false, error: err?.message || "Gagal memverifikasi PIN" });
    }
  });

  app.get("/api/sync", async (req, res) => {
    try {
      const authUser = await resolveAuthUser(req);
      const isPrivilegedRole =
        authUser?.role === "MANAGER" || authUser?.role === "SUPER_ADMIN";

      // Jika belum login (mis. halaman pilih akun Login): hanya kirim daftar nama akun publik & branding dasar,
      // TANPA membocorkan kas, gaji, inventori, audit log, API key, maupun PIN!
      if (!authUser) {
        let publicUsers: any[] = initialUsers;
        let rawSt: any = initialSettings;
        if (isDbConnected) {
          try {
            const [uRows, sRows] = await Promise.all([
              db.select().from(schema.users),
              db.select().from(schema.settings).limit(1),
            ]);
            if (uRows.length === 0) {
              await db.transaction(async (tx) => {
                await tx
                  .insert(schema.users)
                  .values(initialUsers.map((u: any) => sanitizeUserForInsert(u, u.pin)));
                await tx
                  .insert(schema.settings)
                  .values([sanitizeSettings(initialSettings)]);
              });
              publicUsers = initialUsers;
              rawSt = initialSettings;
            } else {
              publicUsers = uRows;
              rawSt = sRows[0] || initialSettings;
            }
          } catch {
            publicUsers = offlineState?.users || initialUsers;
            rawSt = (Array.isArray(offlineState?.settings) ? offlineState.settings[0] : offlineState?.settings) || initialSettings;
          }
        } else if (offlineState) {
          publicUsers = offlineState.users || initialUsers;
          rawSt = (Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings) || initialSettings;
        }

        return res.json({
          publicOnly: true,
          v: 0,
          users: publicUsers.map(sanitizeUser),
          settings: {
            id: "1",
            brandName: String(rawSt?.brandName || "Julia's"),
            logoDataUrl: rawSt?.logoDataUrl || "/logo-wordmark-white.png",
            companyAddress: String(rawSt?.companyAddress || ""),
            bankDetails: "",
            salesPerson: "",
            footerMessage: String(rawSt?.footerMessage || ""),
            language: rawSt?.language === "en" ? "en" : "id",
          },
          serverTime: new Date().toISOString(),
        });
      }

      const clientVersion = req.query.v ? Number(req.query.v) : null;
      if (clientVersion && clientVersion === serverDataVersion) {
        return res.json({
          notModified: true,
          v: serverDataVersion,
          serverTime: new Date().toISOString(),
        });
      }

      if (!isDbConnected) {
        const rawSettings = offlineState.settings && offlineState.settings.length > 0 ? (Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings) : initialSettings;
        const effectiveApiKey =
          rawSettings?.gemini_api_key ||
          rawSettings?.geminiApiKey ||
          process.env.GEMINI_API_KEY ||
          "";
        return res.json({
          ...offlineState,
          users: (offlineState.users || initialUsers).map(sanitizeUser),
          v: serverDataVersion,
          settings: {
            ...rawSettings,
            hasGeminiApiKey: Boolean(effectiveApiKey),
            hasPosSupervisorPin: Boolean(rawSettings?.posSupervisorPin),
            geminiApiKey: isPrivilegedRole ? effectiveApiKey : "",
            gemini_api_key: isPrivilegedRole ? effectiveApiKey : "",
            posSupervisorPin: isPrivilegedRole ? (rawSettings?.posSupervisorPin || "1234") : "",
          },
          serverTime: new Date().toISOString(),
        });
      }
      let cash_accounts: any[] = [];
      let cash_transactions: any[] = [];
      let settings: any[] = [];
      let users: any[] = [];
      let device_sessions: any[] = [];
      let ingredients: any[] = [];
      let stock_movements: any[] = [];
      let sales_transactions: any[] = [];
      let sales_import_logs: any[] = [];
      let recipes: any[] = [];
      let audit_logs: any[] = [];
      let employees: any[] = [];
      let employee_contracts: any[] = [];
      let attendance_records: any[] = [];
      let kpi_records: any[] = [];
      let employee_shifts: any[] = [];
      let daily_checklists: any[] = [];
      let daily_attendances: any[] = [];
      let suppliers: any[] = [];
      let purchase_orders: any[] = [];
      let shifts: any[] = [];
      // Fase 1-4 tables
      let expense_categories: any[] = [];
      let budgets: any[] = [];
      let bank_reconciliations: any[] = [];
      let bank_statement_lines: any[] = [];
      let stock_opnames: any[] = [];
      let stock_opname_items: any[] = [];
      let payroll_records: any[] = [];
      let closed_periods: any[] = [];
      let products: any[] = [];
      let batch_preparations: any[] = [];
      let promotions: any[] = [];

      try {
        [
          cash_accounts,
          cash_transactions,
          settings,
          users,
          device_sessions,
          ingredients,
          stock_movements,
          sales_transactions,
          sales_import_logs,
          recipes,
          audit_logs,
          employees,
          employee_contracts,
          employee_shifts,
          attendance_records,
          daily_checklists,
          daily_attendances,
          kpi_records,
          suppliers,
          purchase_orders,
          shifts,
          expense_categories,
          budgets,
          bank_reconciliations,
          bank_statement_lines,
          stock_opnames,
          stock_opname_items,
          payroll_records,
          closed_periods,
          products,
          batch_preparations,
          promotions,
        ] = await Promise.all([
          db.select().from(schema.cashAccounts),
          db.select().from(schema.cashTransactions),
          db.select().from(schema.settings),
          db.select().from(schema.users),
          db.select().from(schema.deviceSessions),
          db.select().from(schema.ingredients),
          db.select().from(schema.stockMovements),
          db.select().from(schema.salesTransactions),
          db.select().from(schema.salesImportLogs),
          db.select().from(schema.recipes),
          db.select().from(schema.auditLogs),
          db.select().from(schema.employees),
          db.select().from(schema.employeeContracts),
          db.select().from(schema.employeeShifts),
          db.select().from(schema.attendanceRecords),
          db.select().from(schema.dailyChecklists),
          db.select().from(schema.dailyAttendances),
          db.select().from(schema.kpiRecords),
          db.select().from(schema.suppliers),
          db.select().from(schema.purchaseOrders),
          db.select().from(schema.shifts),
          db.select().from(schema.expenseCategories),
          db.select().from(schema.budgets),
          db.select().from(schema.bankReconciliations),
          db.select().from(schema.bankStatementLines),
          db.select().from(schema.stockOpnames),
          db.select().from(schema.stockOpnameItems),
          db.select().from(schema.payrollRecords),
          db.select().from(schema.closedPeriods),
          db.select().from(schema.products),
          db.select().from(schema.batchPreparations),
          db.select().from(schema.promotions),
        ]);

        // Seed default promotions if empty
        if (promotions.length === 0) {
          try {
            await db.insert(schema.promotions).values(initialPromotions);
            promotions = initialPromotions;
          } catch (seedErr) {
            console.warn("Could not seed default promotions:", seedErr);
          }
        }

        // Seed default expense categories if empty
        if (expense_categories.length === 0) {
          const defaultCategories = [
            { id: "cat-pendapatan", name: "Pendapatan", type: "PENDAPATAN", parentId: null, color: "#10B981", icon: "trending-up", isActive: true, sortOrder: 1 },
            { id: "cat-pengeluaran", name: "Pengeluaran Operasional", type: "PENGELUARAN", parentId: null, color: "#EF4444", icon: "trending-down", isActive: true, sortOrder: 2 },
            { id: "cat-bahan-baku", name: "Bahan Baku", type: "BAHAN_BAKU", parentId: null, color: "#F59E0B", icon: "package", isActive: true, sortOrder: 3 },
            { id: "cat-utilitas", name: "Utilitas", type: "UTILITAS", parentId: null, color: "#3B82F6", icon: "zap", isActive: true, sortOrder: 4 },
            { id: "cat-hrd", name: "HRD & Personalia", type: "HRD", parentId: null, color: "#8B5CF6", icon: "users", isActive: true, sortOrder: 5 },
            { id: "cat-aset", name: "Pembelian Aset", type: "ASET", parentId: null, color: "#6366F1", icon: "briefcase", isActive: true, sortOrder: 6 },
            { id: "cat-lainnya", name: "Lainnya", type: "LAINNYA", parentId: null, color: "#6B7280", icon: "more-horizontal", isActive: true, sortOrder: 7 },
            // Children: Pendapatan
            { id: "cat-penjualan", name: "Penjualan Minuman", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#34D399", icon: "coffee", isActive: true, sortOrder: 1 },
            { id: "cat-penjualan-makanan", name: "Penjualan Makanan", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#6EE7B7", icon: "utensils", isActive: true, sortOrder: 2 },
            { id: "cat-pendapatan-lain", name: "Pendapatan Lain", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#A7F3D0", icon: "plus-circle", isActive: true, sortOrder: 3 },
            // Children: Pengeluaran
            { id: "cat-sewa", name: "Sewa Tempat", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "home", isActive: true, sortOrder: 1 },
            { id: "cat-kebersihan", name: "Kebersihan & Sanitasi", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "trash-2", isActive: true, sortOrder: 2 },
            { id: "cat-marketing-ops", name: "Marketing & Promosi", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "megaphone", isActive: true, sortOrder: 3 },
            { id: "cat-opex-lain", name: "Operasional Lainnya", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "settings", isActive: true, sortOrder: 4 },
            // Children: Bahan Baku
            { id: "cat-kopi", name: "Kopi & Espresso", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "coffee", isActive: true, sortOrder: 1 },
            { id: "cat-susu", name: "Susu & Dairy", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "droplets", isActive: true, sortOrder: 2 },
            { id: "cat-minuman", name: "Minuman & Sirup", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "cup-soda", isActive: true, sortOrder: 3 },
            { id: "cat-packaging", name: "Packaging & Kemasan", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "box", isActive: true, sortOrder: 4 },
            { id: "cat-bahan-lain", name: "Bahan Baku Lainnya", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "shopping-cart", isActive: true, sortOrder: 5 },
            // Children: Utilitas
            { id: "cat-listrik", name: "Listrik", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "zap", isActive: true, sortOrder: 1 },
            { id: "cat-air", name: "Air & PDAM", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "droplets", isActive: true, sortOrder: 2 },
            { id: "cat-internet", name: "Internet & Telepon", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "wifi", isActive: true, sortOrder: 3 },
            { id: "cat-gas", name: "Gas", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "flame", isActive: true, sortOrder: 4 },
            // Children: HRD
            { id: "cat-gaji", name: "Gaji Karyawan", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "wallet", isActive: true, sortOrder: 1 },
            { id: "cat-bpjs", name: "BPJS & Asuransi", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "shield", isActive: true, sortOrder: 2 },
            { id: "cat-tunjangan", name: "Tunjangan & Bonus", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "gift", isActive: true, sortOrder: 3 },
            { id: "cat-pelatihan", name: "Pelatihan Karyawan", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "book-open", isActive: true, sortOrder: 4 },
          ];
          try {
            await db.insert(schema.expenseCategories).values(defaultCategories.map(sanitizeExpenseCategory));
            expense_categories = defaultCategories as any;
          } catch (seedErr) {
            console.warn("Expense category seed skipped:", seedErr);
          }
        }

        // Auto seed if completely new database
        if (users.length === 0) {
          try {
            await db.transaction(async (tx) => {
              await tx
                .insert(schema.users)
                .values(initialUsers.map((u: any) => sanitizeUserForInsert(u, u.pin)));
              await tx
                .insert(schema.settings)
                .values([sanitizeSettings(initialSettings)]);
            });
            users = initialUsers as any;
            settings = [initialSettings] as any;
          } catch (seedErr) {
            console.warn("Auto seed skipped or failed:", seedErr);
          }
        }

        // Auto seed default cash drawer & bank/QRIS accounts if empty
        if (cash_accounts.length === 0) {
          try {
            const defaultAccounts = [
              { id: "cash-drawer-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true },
              { id: "bank-bca-main", name: "Rekening Bank / QRIS Utama", type: "BANK", isDefault: false },
            ];
            await db.insert(schema.cashAccounts).values(defaultAccounts.map(sanitizeCashAccount));
            cash_accounts = defaultAccounts as any;
          } catch (seedErr) {
            console.warn("Cash accounts seed skipped:", seedErr);
          }
        }

        // Auto seed ingredients, recipes, and products if ingredients is empty
        if (ingredients.length === 0) {
          try {
            await db.transaction(async (tx) => {
              for (const ing of initialIngredients) {
                await tx.insert(schema.ingredients).values(sanitizeIngredient(ing));
              }
              for (const rec of initialRecipes) {
                await tx.insert(schema.recipes).values(sanitizeRecipe(rec));
              }
              for (const prod of initialProducts) {
                await tx.insert(schema.products).values({
                  id: String(prod.id),
                  name: String(prod.name),
                  category: String(prod.category || "COFFEE"),
                  division: String(prod.division || "BAR"),
                  description: prod.description || null,
                  imageUrl: (prod as any).imageUrl || null,
                  isActive: Boolean(prod.isActive !== false),
                  variants: prod.variants || [],
                  modifierGroups: (prod as any).modifierGroups || [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            });
            ingredients = await db.select().from(schema.ingredients);
            recipes = await db.select().from(schema.recipes);
            products = await db.select().from(schema.products);
          } catch (seedErr) {
            console.warn("Ingredients and recipes seed skipped:", seedErr);
          }
        }
      } catch (dbErr) {
        console.error(
          "Database connection failed, using fallback data in memory:",
          dbErr,
        );
        if (offlineState) {
          return res.json({
            ...offlineState,
            serverTime: new Date().toISOString(),
          });
        }
        users = initialUsers as any;
        settings = [initialSettings] as any;
      }

      const parseTasksJson = (val: any) => {
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
          try {
            const p = JSON.parse(val);
            if (Array.isArray(p)) return p;
          } catch { }
        }
        return [];
      };

      const rawSettings = settings.length > 0 ? settings[0] : initialSettings;
      const effectiveApiKey =
        rawSettings.gemini_api_key ||
        rawSettings.geminiApiKey ||
        process.env.GEMINI_API_KEY ||
        "";
      const parseObjSafe = (val: any) => {
        if (!val) return {};
        if (typeof val === "object") return val;
        try {
          return JSON.parse(val);
        } catch {
          return {};
        }
      };

      const rawDivTarget = parseObjSafe(rawSettings.divisionKpiBonusTarget);
      const allowanceRules = Array.isArray(rawDivTarget.__leaderAllowanceRules)
        ? rawDivTarget.__leaderAllowanceRules
        : (Array.isArray(rawSettings.leaderJobdeskAllowanceRules) ? rawSettings.leaderJobdeskAllowanceRules : []);
      delete rawDivTarget.__leaderAllowanceRules;

      const shiftDefs = Array.isArray(rawDivTarget.__shiftDefinitions)
        ? rawDivTarget.__shiftDefinitions
        : (Array.isArray(rawSettings.shiftDefinitions) ? rawSettings.shiftDefinitions : []);
      delete rawDivTarget.__shiftDefinitions;

      const formattedSettings = {
        ...rawSettings,
        hasGeminiApiKey: Boolean(effectiveApiKey),
        hasPosSupervisorPin: Boolean(rawSettings.posSupervisorPin),
        geminiApiKey: isPrivilegedRole ? effectiveApiKey : "",
        gemini_api_key: isPrivilegedRole ? effectiveApiKey : "",
        posSupervisorPin: isPrivilegedRole ? String(rawSettings.posSupervisorPin || "1234") : "",
        leaderBarTasks: parseTasksJson(rawSettings.leaderBarTasks),
        leaderKitchenTasks: parseTasksJson(rawSettings.leaderKitchenTasks),
        leaderBakerTasks: parseTasksJson(rawSettings.leaderBakerTasks),
        managerTasks: parseTasksJson(rawSettings.managerTasks),
        leaderJobdeskAllowanceRules: allowanceRules,
        shiftDefinitions: shiftDefs,
        monthlyRevenueTarget: Number(rawSettings.monthlyRevenueTarget ?? 150000000),
        targetBonusAmount: Number(rawSettings.targetBonusAmount ?? 0),
        divisionKpiBonusTarget: rawDivTarget,
        scheduleApprovals: parseObjSafe(rawSettings.scheduleApprovals),
        enableStoreSalesBonus: rawSettings.enableStoreSalesBonus !== false,
        enableLeaderAllowanceBonus: rawSettings.enableLeaderAllowanceBonus !== false,
        enableKpiScoreBonus: Boolean(rawSettings.enableKpiScoreBonus),
        taxEnabled: Boolean(rawSettings.taxEnabled ?? false),
        taxRate: Number(rawSettings.taxRate ?? 10),
        taxMode: String(rawSettings.taxMode || "EXCLUSIVE"),
        maxCashierDiscount: Number(rawSettings.maxCashierDiscount ?? 10),
      };

      res.json({
        cash_accounts,
        cash_transactions,
        settings: formattedSettings,
        users: users.map(sanitizeUser),
        device_sessions,
        ingredients,
        stock_movements,
        sales_transactions,
        sales_import_logs,
        recipes: formatRecipesForClient(recipes),
        audit_logs,
        suppliers,
        purchase_orders,
        shifts: formatShiftsForClient(shifts),
        employees,
        contracts: employee_contracts,
        employeeShifts: employee_shifts,
        attendances: attendance_records,
        dailyChecklists: daily_checklists,
        dailyAttendances: daily_attendances,
        kpiRecords: kpi_records,
        // Fase 1-4
        expense_categories,
        budgets,
        bank_reconciliations,
        bank_statement_lines,
        stock_opnames,
        stock_opname_items,
        payroll_records,
        closed_periods,
        products,
        batch_preparations,
        promotions,
        v: serverDataVersion,
        serverTime: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Sync error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, pin } = req.body;
      let finalPin = String(pin || "");
      if (finalPin.length !== 64) {
        finalPin = crypto.createHash("sha256").update(finalPin).digest("hex");
      }

      let currentUsers;
      try {
        currentUsers = await db.select().from(schema.users);
      } catch (dbErr) {
        console.error("Login DB error, falling back to memory:", dbErr);
        if (offlineState && offlineState.users) {
          currentUsers = offlineState.users;
        } else {
          currentUsers = initialUsers;
        }
      }

      const user = currentUsers.find(u => {
        if (u.username !== username) return false;
        if (u.pin === finalPin || u.pin === pin) return true;
        // Izinkan login dengan PIN default 123456 jika data user di DB masih memakai PIN default lama 1234
        if (pin === "123456" && (u.pin === "1234" || u.pin === "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4")) {
          return true;
        }
        return false;
      });

      if (!user) {
        return res.status(401).json({ error: "Username atau PIN salah" });
      }

      const sessionId = crypto.randomUUID();
      const newSession = {
        id: sessionId,
        userId: user.id,
        username: user.username,
        userName: user.name,
        deviceName: req.headers["user-agent"]?.substring(0, 50) || "Unknown Device",
        browser: "Web",
        os: "Unknown",
        deviceType: "desktop",
        ipAddress: req.ip || "127.0.0.1",
        location: null,
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: "ACTIVE",
      };

      if (isDbConnected) {
        try {
          await db.insert(schema.deviceSessions).values(newSession);
        } catch { }
      }
      if (offlineState) {
        offlineState.device_sessions = offlineState.device_sessions || [];
        offlineState.device_sessions.push(newSession);
      }

      const { pin: _, ...userWithoutPin } = user;
      res.json({ success: true, token: sessionId, user: userWithoutPin });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/sync", async (req, res) => {
    try {
      const authHeader = req.headers["authorization"] as string;
      const token = authHeader?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
      }

      const requestUser = await resolveAuthUser(req);
      let currentUsersDB: any[] = [];

      if (!requestUser) {
        return res.status(401).json({ error: "Unauthorized: Sesi tidak valid atau telah berakhir" });
      }

      const isPrivilegedSyncUser =
        requestUser.role === "MANAGER" || requestUser.role === "SUPER_ADMIN";

      // ── ATURAN #5b: OWNER READ-ONLY ENFORCEMENT ──────────────────────────
      // Owner berstatus Read-Only (Pengawasan). Seluruh mutasi data via API ditolak di sisi server.
      if (requestUser.role === "OWNER") {
        return res.status(403).json({
          error: "Forbidden: Akun Owner berstatus Read-Only (Pengawasan). Tidak diizinkan melakukan perubahan data operasional.",
        });
      }

      let {
        cash_accounts,
        cash_transactions,
        settings,
        users,
        device_sessions,
        ingredients,
        stock_movements,
        sales_transactions,
        sales_import_logs,
        recipes,
        audit_logs,
        suppliers,
        purchase_orders,
        shifts,
        employees,
        contracts,
        employeeShifts,
        attendances,
        dailyChecklists,
        kpiTasks,
        kpiBonusRules,
        dailyAttendances,
        kpiRecords,
        expense_categories,
        budgets,
        bank_reconciliations,
        bank_statement_lines,
        stock_opnames,
        stock_opname_items,
        payroll_records,
        closed_periods,
        products,
        batch_preparations,
        promotions,
      } = req.body;

      if (requestUser.role === "KASIR") {
        // Kasir hanya diizinkan memperbarui data shift, absensi, dan sesi terminal
        // Cegah tablet kasir menimpa tabel master, payroll, keuangan, atau pengaturan
        users = undefined;
        settings = undefined;
        payroll_records = undefined;
        budgets = undefined;
        bank_reconciliations = undefined;
        bank_statement_lines = undefined;
        closed_periods = undefined;
        expense_categories = undefined;
        promotions = undefined;
        employees = undefined;
        contracts = undefined;
        kpiRecords = undefined;
        kpiTasks = undefined;
        kpiBonusRules = undefined;
        suppliers = undefined;
        purchase_orders = undefined;
        ingredients = undefined;
        recipes = undefined;
        products = undefined;
        batch_preparations = undefined;
        stock_opnames = undefined;
        stock_opname_items = undefined;
      } else if (requestUser.role === "FINANCE") {
        // Finance fokus pada keuangan & pembukuan, dilarang menimpa menu dan resep
        users = undefined;
        recipes = undefined;
        products = undefined;
        batch_preparations = undefined;
        promotions = undefined;
      } else if (["BARISTA", "KITCHEN", "BAKER", "LEADER"].includes(requestUser.role)) {
        // Staff operasional hanya boleh checklist, absensi, dan sesi
        users = undefined;
        settings = undefined;
        payroll_records = undefined;
        budgets = undefined;
        bank_reconciliations = undefined;
        bank_statement_lines = undefined;
        closed_periods = undefined;
        expense_categories = undefined;
        cash_accounts = undefined;
        cash_transactions = undefined;
        promotions = undefined;
        employees = undefined;
        contracts = undefined;
        suppliers = undefined;
        purchase_orders = undefined;
      }

      const mergeByIdPreservingExisting = (incomingList: any[], protectedRows: any[]) => {
        const map = new Map<string, any>();
        for (const row of protectedRows) {
          if (row?.id) map.set(String(row.id), row);
        }
        for (const item of incomingList) {
          if (item?.id) map.set(String(item.id), item);
        }
        return Array.from(map.values());
      };

      if (!isDbConnected && offlineState) {
        const offlineOrderIds = new Set<string>((offlineState.orders || []).map((o: any) => String(o.id)));
        if (ingredients !== undefined) offlineState.ingredients = ingredients;
        if (recipes !== undefined) offlineState.recipes = recipes;
        if (products !== undefined) offlineState.products = products;
        if (cash_accounts !== undefined) offlineState.cash_accounts = cash_accounts;
        if (cash_transactions !== undefined && Array.isArray(cash_transactions)) {
          const protectedPosCash = (offlineState.cash_transactions || []).filter(
            (ct: any) => ct.referenceId && offlineOrderIds.has(String(ct.referenceId))
          );
          offlineState.cash_transactions = mergeByIdPreservingExisting(cash_transactions, protectedPosCash);
        }
        if (stock_movements !== undefined && Array.isArray(stock_movements)) {
          const protectedPosMovements = (offlineState.stock_movements || []).filter(
            (sm: any) => sm.referenceId && offlineOrderIds.has(String(sm.referenceId))
          );
          offlineState.stock_movements = mergeByIdPreservingExisting(stock_movements, protectedPosMovements);
        }
        if (sales_transactions !== undefined && Array.isArray(sales_transactions)) {
          const protectedPosSales = (offlineState.sales_transactions || []).filter((st: any) =>
            String(st.importLogId || "").startsWith("POS-")
          );
          offlineState.sales_transactions = mergeByIdPreservingExisting(sales_transactions, protectedPosSales);
        }
        if (shifts !== undefined) offlineState.shifts = shifts;
        if (users !== undefined && Array.isArray(users)) {
          const existingOfflineUsers = offlineState.users || initialUsers;
          offlineState.users = users.map((u: any) =>
            sanitizeUserForInsert(u, existingOfflineUsers.find((cu: any) => String(cu.id) === String(u.id))?.pin)
          );
        }
        if (settings !== undefined && settings !== null) {
          const rawExisting = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
          const incomingSt = Array.isArray(settings) ? settings[0] : settings;
          offlineState.settings = [sanitizeSettings(incomingSt, rawExisting, isPrivilegedSyncUser)];
        }
        if (expense_categories !== undefined) offlineState.expense_categories = expense_categories;
        if (budgets !== undefined) offlineState.budgets = budgets;
        if (payroll_records !== undefined) offlineState.payroll_records = payroll_records;
        if (promotions !== undefined) offlineState.promotions = promotions;
        if (suppliers !== undefined) offlineState.suppliers = suppliers;
        if (purchase_orders !== undefined) offlineState.purchase_orders = purchase_orders;
        if (employees !== undefined) offlineState.employees = employees;
        if (contracts !== undefined) offlineState.contracts = contracts;
        if (employeeShifts !== undefined) offlineState.employeeShifts = employeeShifts;
        if (attendances !== undefined) offlineState.attendances = attendances;
        if (dailyAttendances !== undefined) offlineState.dailyAttendances = dailyAttendances;
        if (dailyChecklists !== undefined) offlineState.dailyChecklists = dailyChecklists;
        if (kpiRecords !== undefined) offlineState.kpiRecords = kpiRecords;
        if (audit_logs !== undefined && Array.isArray(audit_logs)) {
          offlineState.audit_logs = mergeByIdPreservingExisting(audit_logs, offlineState.audit_logs || []);
        }
        bumpDataVersion();
        return res.json({ success: true, v: serverDataVersion, serverTime: new Date().toISOString() });
      }

      await db.transaction(async (tx) => {
        // --- SNAPSHOT DATA TRANSAKSIONAL POS & SESI AKTIF AGAR TIDAK TERHAPUS MULTI-DEVICE ---
        let existingPaidIds = new Set<string>();
        let existingSettingsRow: any = null;
        let protectedPosSales: any[] = [];
        let protectedPosCash: any[] = [];
        let protectedPosMovements: any[] = [];
        let protectedAuditLogs: any[] = [];
        let protectedActiveSessions: any[] = [];

        const needPosOrdersCheck =
          cash_transactions !== undefined ||
          stock_movements !== undefined ||
          sales_transactions !== undefined;

        let posOrderIds = new Set<string>();
        if (needPosOrdersCheck) {
          const ordRows = await tx.select({ id: schema.orders.id, status: schema.orders.status, receiptNo: schema.orders.receiptNo }).from(schema.orders);
          const voidReceipts = new Set<string>();
          for (const o of ordRows) {
            posOrderIds.add(String(o.id));
            if (o.status === "VOID" || o.status === "CANCELLED") {
              voidReceipts.add(`POS-${o.receiptNo}`);
            }
          }
          if (sales_transactions !== undefined) {
            const dbPosSales = await tx
              .select()
              .from(schema.salesTransactions)
              .where(like(schema.salesTransactions.importLogId, "POS-%"));
            protectedPosSales = dbPosSales.filter((s) => !voidReceipts.has(String(s.importLogId)));
          }
          if (cash_transactions !== undefined) {
            const dbCash = await tx.select().from(schema.cashTransactions);
            protectedPosCash = dbCash.filter((ct) => ct.referenceId && posOrderIds.has(String(ct.referenceId)));
          }
          if (stock_movements !== undefined) {
            const dbMoves = await tx.select().from(schema.stockMovements);
            protectedPosMovements = dbMoves.filter((sm) => sm.referenceId && posOrderIds.has(String(sm.referenceId)));
          }
        }

        if (settings !== undefined && settings !== null) {
          const stRows = await tx.select().from(schema.settings).limit(1);
          existingSettingsRow = stRows[0] || null;
        }
        if (audit_logs !== undefined) {
          protectedAuditLogs = await tx.select().from(schema.auditLogs);
        }
        if (device_sessions !== undefined) {
          const sessRows = await tx.select().from(schema.deviceSessions);
          protectedActiveSessions = sessRows.filter((s) => s.status === "ACTIVE");
        }

        // --- PHASE 1: DELETES (Child -> Parent) ---
        if (promotions !== undefined) {
          await tx.delete(schema.promotions);
        }
        if (products !== undefined) {
          await tx.delete(schema.products);
        }
        if (batch_preparations !== undefined) {
          await tx.delete(schema.batchPreparations);
        }
        if (device_sessions !== undefined) {
          await tx.delete(schema.deviceSessions);
        }
        if (stock_opname_items !== undefined) {
          await tx.delete(schema.stockOpnameItems);
        }
        if (stock_opnames !== undefined) {
          await tx.delete(schema.stockOpnames);
        }
        if (bank_statement_lines !== undefined) {
          await tx.delete(schema.bankStatementLines);
        }
        if (bank_reconciliations !== undefined) {
          await tx.delete(schema.bankReconciliations);
        }
        if (shifts !== undefined) {
          await tx.delete(schema.shifts);
        }
        if (audit_logs !== undefined) {
          await tx.delete(schema.auditLogs);
        }
        if (recipes !== undefined) {
          await tx.delete(schema.recipes);
        }
        if (sales_import_logs !== undefined) {
          await tx.delete(schema.salesImportLogs);
        }
        if (sales_transactions !== undefined) {
          await tx.delete(schema.salesTransactions);
        }
        if (stock_movements !== undefined) {
          await tx.delete(schema.stockMovements);
        }
        if (cash_transactions !== undefined) {
          await tx.delete(schema.cashTransactions);
        }
        if (purchase_orders !== undefined) {
          await tx.delete(schema.purchaseOrders);
        }
        if (ingredients !== undefined) {
          await tx.delete(schema.ingredients);
        }
        if (suppliers !== undefined) {
          await tx.delete(schema.suppliers);
        }
        if (payroll_records !== undefined) {
          const existingPaid = await tx.select({ id: schema.payrollRecords.id }).from(schema.payrollRecords).where(eq(schema.payrollRecords.status, "PAID"));
          existingPaid.forEach(r => existingPaidIds.add(r.id));
          await tx.delete(schema.payrollRecords).where(not(eq(schema.payrollRecords.status, "PAID")));
        }
        if (kpiRecords !== undefined) {
          await tx.delete(schema.kpiRecords);
        }
        if (attendances !== undefined) {
          await tx.delete(schema.attendanceRecords);
        }
        if (dailyAttendances !== undefined) await tx.delete(schema.dailyAttendances);
        if (dailyChecklists !== undefined) await tx.delete(schema.dailyChecklists);
        if (employeeShifts !== undefined) await tx.delete(schema.employeeShifts);
        if (contracts !== undefined) {
          await tx.delete(schema.employeeContracts);
        }
        if (employees !== undefined) {
          await tx.delete(schema.employees);
        }
        if (budgets !== undefined) {
          await tx.delete(schema.budgets);
        }
        if (expense_categories !== undefined) {
          await tx.delete(schema.expenseCategories);
        }
        if (users !== undefined) {
          if (currentUsersDB.length === 0) {
            currentUsersDB = await tx.select().from(schema.users);
          }
          await tx.delete(schema.users);
        }
        if (cash_accounts !== undefined) {
          await tx.delete(schema.cashAccounts);
        }
        if (settings !== undefined && settings !== null) {
          await tx.delete(schema.settings);
        }
        if (closed_periods !== undefined) {
          await tx.delete(schema.closedPeriods);
        }

        // --- PHASE 2: INSERTS (Parent -> Child) ---
        let validUserIds: Set<string> | null = null;
        if (users !== undefined && Array.isArray(users)) {
          validUserIds = new Set(users.map((u: any) => String(u.id)));
        }

        if (settings !== undefined && settings !== null) {
          const incomingSt = Array.isArray(settings) ? settings[0] : settings;
          await tx.insert(schema.settings).values([sanitizeSettings(incomingSt, existingSettingsRow, isPrivilegedSyncUser)]);
        }
        if (cash_accounts !== undefined) {
          if (Array.isArray(cash_accounts) && cash_accounts.length > 0) {
            await tx.insert(schema.cashAccounts).values(cash_accounts.map(sanitizeCashAccount));
          }
        }
        if (users !== undefined) {
          if (Array.isArray(users) && users.length > 0) {
            await tx.insert(schema.users).values(users.map((u: any) => sanitizeUserForInsert(u, currentUsersDB.find((cu) => cu.id === String(u.id))?.pin)));
          }
        }
        if (expense_categories !== undefined) {
          if (Array.isArray(expense_categories) && expense_categories.length > 0) {
            await tx.insert(schema.expenseCategories).values(expense_categories.map(sanitizeExpenseCategory));
          }
        }
        if (budgets !== undefined) {
          if (Array.isArray(budgets) && budgets.length > 0) {
            await tx.insert(schema.budgets).values(budgets.map(sanitizeBudget));
          }
        }
        if (employees !== undefined) {
          if (Array.isArray(employees) && employees.length > 0) {
            await tx.insert(schema.employees).values(employees.map(sanitizeEmployee));
          }
        }
        if (dailyAttendances !== undefined) {
          if (Array.isArray(dailyAttendances) && dailyAttendances.length > 0) {
            await tx.insert(schema.dailyAttendances).values(dailyAttendances.map(sanitizeDailyAttendance));
          }
        }
        if (dailyChecklists !== undefined) {
          if (Array.isArray(dailyChecklists) && dailyChecklists.length > 0) {
            await tx.insert(schema.dailyChecklists).values(dailyChecklists.map(sanitizeDailyChecklist));
          }
        }
        if (employeeShifts !== undefined) {
          if (Array.isArray(employeeShifts) && employeeShifts.length > 0) {
            await tx.insert(schema.employeeShifts).values(employeeShifts.map(sanitizeEmployeeShift));
          }
        }
        if (contracts !== undefined) {
          if (Array.isArray(contracts) && contracts.length > 0) {
            await tx.insert(schema.employeeContracts).values(contracts.map(sanitizeEmployeeContract));
          }
        }
        if (attendances !== undefined) {
          if (Array.isArray(attendances) && attendances.length > 0) {
            await tx.insert(schema.attendanceRecords).values(attendances.map(sanitizeAttendanceRecord));
          }
        }
        if (kpiRecords !== undefined) {
          if (Array.isArray(kpiRecords) && kpiRecords.length > 0) {
            await tx.insert(schema.kpiRecords).values(kpiRecords.map(sanitizeKPIRecord));
          }
        }
        if (payroll_records !== undefined) {
          if (Array.isArray(payroll_records) && payroll_records.length > 0) {
            const incomingToInsert = payroll_records.filter((pr: any) => !existingPaidIds.has(pr.id));
            if (incomingToInsert.length > 0) {
              await tx.insert(schema.payrollRecords).values(incomingToInsert.map(sanitizePayrollRecord));
            }
          }
        }
        if (suppliers !== undefined) {
          if (Array.isArray(suppliers) && suppliers.length > 0) {
            await tx.insert(schema.suppliers).values(suppliers.map(sanitizeSupplier));
          }
        }
        if (ingredients !== undefined) {
          if (Array.isArray(ingredients) && ingredients.length > 0) {
            await tx.insert(schema.ingredients).values(ingredients.map(sanitizeIngredient));
          }
        }
        if (purchase_orders !== undefined) {
          if (Array.isArray(purchase_orders) && purchase_orders.length > 0) {
            await tx.insert(schema.purchaseOrders).values(purchase_orders.map(sanitizePurchaseOrder));
          }
        }
        if (closed_periods !== undefined) {
          if (Array.isArray(closed_periods) && closed_periods.length > 0) {
            await tx.insert(schema.closedPeriods).values(closed_periods.map((cp: any) => ({
              id: cp.id,
              period: cp.period,
              closedAt: cp.closedAt,
              closedBy: cp.closedBy,
              notes: cp.notes || '',
            })));
          }
        }
        if (cash_transactions !== undefined) {
          const mergedCashTx = mergeByIdPreservingExisting(
            Array.isArray(cash_transactions) ? cash_transactions : [],
            protectedPosCash
          );
          if (mergedCashTx.length > 0) {
            await tx.insert(schema.cashTransactions).values(mergedCashTx.map(sanitizeCashTransaction));
          }
        }
        if (stock_movements !== undefined) {
          const mergedMovements = mergeByIdPreservingExisting(
            Array.isArray(stock_movements) ? stock_movements : [],
            protectedPosMovements
          );
          if (mergedMovements.length > 0) {
            await tx.insert(schema.stockMovements).values(mergedMovements.map(sanitizeStockMovement));
          }
        }
        if (sales_transactions !== undefined) {
          const mergedSales = mergeByIdPreservingExisting(
            Array.isArray(sales_transactions) ? sales_transactions : [],
            protectedPosSales
          );
          if (mergedSales.length > 0) {
            await tx.insert(schema.salesTransactions).values(mergedSales.map(sanitizeSalesTransaction));
          }
        }
        if (recipes !== undefined) {
          if (Array.isArray(recipes) && recipes.length > 0) {
            await tx.insert(schema.recipes).values(recipes.map(sanitizeRecipe));
          }
        }
        if (sales_import_logs !== undefined) {
          if (Array.isArray(sales_import_logs) && sales_import_logs.length > 0) {
            await tx.insert(schema.salesImportLogs).values(sales_import_logs.map(sanitizeSalesImportLog));
          }
        }
        if (audit_logs !== undefined) {
          const mergedAudit = mergeByIdPreservingExisting(
            Array.isArray(audit_logs) ? audit_logs : [],
            protectedAuditLogs
          );
          let filteredItems = mergedAudit;
          if (validUserIds !== null) {
            filteredItems = mergedAudit.filter((item: any) => validUserIds!.has(String(item.userId)));
          }
          if (filteredItems.length > 0) {
            await tx.insert(schema.auditLogs).values(filteredItems.map(sanitizeAuditLog));
          }
        }
        if (shifts !== undefined) {
          if (Array.isArray(shifts) && shifts.length > 0) {
            let filteredItems = shifts;
            if (validUserIds !== null) {
              filteredItems = shifts.filter((item: any) => validUserIds!.has(String(item.userId)));
            }
            if (filteredItems.length > 0) {
              await tx.insert(schema.shifts).values(filteredItems.map(sanitizeShift));
            }
          }
        }
        if (bank_reconciliations !== undefined) {
          if (Array.isArray(bank_reconciliations) && bank_reconciliations.length > 0) {
            await tx.insert(schema.bankReconciliations).values(bank_reconciliations.map(sanitizeBankReconciliation));
          }
        }
        if (bank_statement_lines !== undefined) {
          if (Array.isArray(bank_statement_lines) && bank_statement_lines.length > 0) {
            await tx.insert(schema.bankStatementLines).values(bank_statement_lines.map(sanitizeBankStatementLine));
          }
        }
        if (stock_opnames !== undefined) {
          if (Array.isArray(stock_opnames) && stock_opnames.length > 0) {
            await tx.insert(schema.stockOpnames).values(stock_opnames.map(sanitizeStockOpname));
          }
        }
        if (stock_opname_items !== undefined) {
          if (Array.isArray(stock_opname_items) && stock_opname_items.length > 0) {
            try {
              await tx.insert(schema.stockOpnameItems).values(stock_opname_items.map(sanitizeStockOpnameItem));
            } catch (insErr: any) {
              const withoutDiff = stock_opname_items.map((i: any) => {
                const s = sanitizeStockOpnameItem(i);
                const { difference, ...rest } = s;
                return rest;
              });
              await tx.insert(schema.stockOpnameItems).values(withoutDiff as any);
            }
          }
        }
        if (device_sessions !== undefined) {
          const mergedSessions = mergeByIdPreservingExisting(
            Array.isArray(device_sessions) ? device_sessions : [],
            protectedActiveSessions
          );
          let filteredItems = mergedSessions;
          if (validUserIds !== null) {
            filteredItems = mergedSessions.filter((item: any) => validUserIds!.has(String(item.userId)));
          }
          if (filteredItems.length > 0) {
            await tx.insert(schema.deviceSessions).values(filteredItems.map(sanitizeDeviceSession));
          }
        }
        if (products !== undefined) {
          if (Array.isArray(products) && products.length > 0) {
            await tx.insert(schema.products).values(products.map((p: any) => ({
              id: String(p.id),
              name: String(p.name),
              category: String(p.category || "COFFEE"),
              division: String(p.division || "BAR"),
              description: p.description || null,
              imageUrl: p.imageUrl || null,
              isActive: Boolean(p.isActive !== false),
              variants: Array.isArray(p.variants) ? p.variants : [],
              modifierGroups: Array.isArray(p.modifierGroups) ? p.modifierGroups : [],
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString(),
            })));
          }
        }
        if (batch_preparations !== undefined) {
          if (Array.isArray(batch_preparations) && batch_preparations.length > 0) {
            await tx.insert(schema.batchPreparations).values(batch_preparations.map((bp: any) => ({
              id: String(bp.id),
              name: String(bp.name),
              targetIngredientId: String(bp.targetIngredientId),
              targetIngredientName: bp.targetIngredientName || null,
              yieldQuantity: Number(bp.yieldQuantity || 0),
              yieldUnit: String(bp.yieldUnit || "ml"),
              ingredients: Array.isArray(bp.ingredients) ? bp.ingredients : [],
              notes: bp.notes || null,
              lastPreparedDate: bp.lastPreparedDate || null,
            })));
          }
        }
        if (promotions !== undefined) {
          if (Array.isArray(promotions) && promotions.length > 0) {
            await tx.insert(schema.promotions).values(promotions.map(sanitizePromotion));
          }
        }
      });
      bumpDataVersion();
      res.json({ success: true, v: serverDataVersion, serverTime: new Date().toISOString() });
    } catch (e) {
      console.error("Save error (running in offline mode):", e);
      // Store in memory for offline usage so it doesn't get overwritten on next GET
      // Do NOT mask the error as offline if the db is reachable. We want the client to know it failed.
      console.error("Transaction failed due to constraint or logic error. Returning 500.");
      return res.status(500).json({ error: e.message || "Sync transaction failed" });
    }
  });

  // Session management endpoints for Connected Devices & Force Logout
  app.get("/api/sessions", async (req, res) => {
    try {
      // Sesi tanpa heartbeat lebih dari 15 menit dianggap sudah tidak aktif (offline/closed)
      const STALE_THRESHOLD_MS = 15 * 60 * 1000;
      const now = Date.now();

      if (!isDbConnected && offlineState) {
        const activeSessions = (offlineState.device_sessions || []).filter(
          (s: any) =>
            s.status === "ACTIVE" &&
            now - new Date(s.lastActive).getTime() <= STALE_THRESHOLD_MS,
        );
        return res.json({ sessions: activeSessions });
      }

      const allSessions = await db.select().from(schema.deviceSessions);

      // Auto-expire ghost/zombie sessions yang tabnya sudah ditutup (> 15 menit tanpa heartbeat)
      const staleSessions = allSessions.filter(
        (s) =>
          s.status === "ACTIVE" &&
          now - new Date(s.lastActive).getTime() > STALE_THRESHOLD_MS,
      );

      if (staleSessions.length > 0) {
        for (const s of staleSessions) {
          await db
            .update(schema.deviceSessions)
            .set({ status: "EXPIRED" })
            .where(eq(schema.deviceSessions.id, s.id));
        }
      }

      // Filter sesi yang benar-benar aktif saat ini
      const activeSessions = allSessions
        .filter(
          (s) =>
            s.status === "ACTIVE" &&
            now - new Date(s.lastActive).getTime() <= STALE_THRESHOLD_MS,
        )
        .sort(
          (a, b) =>
            new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
        );

      res.json({ sessions: activeSessions });
    } catch (err) {
      if (offlineState) {
        return res.json({ sessions: (offlineState.device_sessions || []).filter((s: any) => s.status === "ACTIVE") });
      }
      console.error("Fetch sessions error:", err);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions/heartbeat", async (req, res) => {
    try {
      const {
        sessionId,
        userId,
        username,
        userName,
        deviceName,
        browser,
        os,
        deviceType,
        location,
      } = req.body;
      if (!sessionId || !userId) {
        return res.status(400).json({ error: "Missing required session info" });
      }

      if (!isDbConnected && offlineState) {
        offlineState.device_sessions = offlineState.device_sessions || [];
        const existing = offlineState.device_sessions.find((s: any) => s.id === sessionId);
        if (existing) {
          existing.lastActive = new Date().toISOString();
        } else {
          offlineState.device_sessions.push({
            id: sessionId,
            userId,
            username,
            userName,
            deviceName: deviceName || "Unknown",
            browser: browser || "Web",
            os: os || "Unknown",
            deviceType: deviceType || "desktop",
            location: location || null,
            lastActive: new Date().toISOString(),
            status: "ACTIVE",
          });
        }
        return res.json({ success: true });
      }

      // Check if session was explicitly REVOKED or expired
      const existing = await db
        .select()
        .from(schema.deviceSessions)
        .where(eq(schema.deviceSessions.id, sessionId));
      if (existing.length > 0) {
        if (existing[0].status === "REVOKED") {
          return res.json({ success: false, revoked: true, status: "REVOKED" });
        }
        const lastActiveDate = new Date(existing[0].lastActive).getTime();
        if (Date.now() - lastActiveDate > 60 * 60 * 1000) {
          // Auto-logout after 1 hour idle
          await db
            .update(schema.deviceSessions)
            .set({ status: "REVOKED" })
            .where(eq(schema.deviceSessions.id, sessionId));
          return res.json({ success: false, revoked: true, status: "EXPIRED" });
        }
      }

      const now = new Date().toISOString();
      const clientIp =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "Localhost";
      const formattedIp = Array.isArray(clientIp)
        ? clientIp[0]
        : String(clientIp).split(",")[0].trim();

      // Atomic UPSERT using PostgreSQL ON CONFLICT DO UPDATE
      await db
        .insert(schema.deviceSessions)
        .values({
          id: String(sessionId),
          userId: String(userId),
          username: String(username || "user"),
          userName: String(userName || "User"),
          deviceName: String(deviceName || "Browser"),
          browser: String(browser || "Web Browser"),
          os: String(os || "Unknown OS"),
          deviceType: String(deviceType || "desktop"),
          ipAddress: formattedIp,
          location: location ? String(location) : null,
          lastActive: now,
          createdAt: now,
          status: "ACTIVE",
        })
        .onConflictDoUpdate({
          target: schema.deviceSessions.id,
          set: {
            lastActive: now,
            userId: String(userId),
            username: String(username || "user"),
            userName: String(userName || "User"),
            deviceName: String(deviceName || "Browser"),
            browser: String(browser || "Web Browser"),
            os: String(os || "Unknown OS"),
            deviceType: String(deviceType || "desktop"),
            ipAddress: formattedIp,
            ...(location ? { location: String(location) } : {}),
          },
        });

      return res.json({ success: true, revoked: false, status: "ACTIVE" });
    } catch (err) {
      console.error("Session heartbeat error:", err);
      res.status(500).json({ error: "Failed to record session" });
    }
  });

  app.post("/api/sessions/:id/revoke", async (req, res) => {
    try {
      const { id } = req.params;
      await db
        .update(schema.deviceSessions)
        .set({ status: "REVOKED" })
        .where(eq(schema.deviceSessions.id, id));

      res.json({ success: true, message: "Session revoked successfully" });
    } catch (err) {
      console.error("Revoke session error:", err);
      res.status(500).json({ error: "Failed to revoke session" });
    }
  });

  app.post("/api/sessions/revoke-others", async (req, res) => {
    try {
      const { currentSessionId, userId } = req.body;
      const allSessions = await db.select().from(schema.deviceSessions);

      const toRevoke = allSessions.filter(
        (s) =>
          s.id !== currentSessionId &&
          s.status === "ACTIVE" &&
          (!userId || s.userId === userId),
      );

      for (const s of toRevoke) {
        await db
          .update(schema.deviceSessions)
          .set({ status: "REVOKED" })
          .where(eq(schema.deviceSessions.id, s.id));
      }

      res.json({
        success: true,
        count: toRevoke.length,
        message: `${toRevoke.length} other session(s) revoked`,
      });
    } catch (err) {
      console.error("Revoke others error:", err);
      res.status(500).json({ error: "Failed to revoke other sessions" });
    }
  });

  app.post("/api/sessions/logout", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (sessionId) {
        await db
          .update(schema.deviceSessions)
          .set({ status: "REVOKED" })
          .where(eq(schema.deviceSessions.id, sessionId));
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Logout session error:", err);
      res.status(500).json({ error: "Failed to update session logout" });
    }
  });

  const rbacMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    try {
      const authHeader = req.headers["authorization"] as string;
      const token = authHeader?.split(" ")[1];

      if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

      const sessions = await db.select().from(schema.deviceSessions).where(eq(schema.deviceSessions.id, token));
      const session = sessions[0];
      if (!session) return res.status(401).json({ error: "Unauthorized: Invalid session" });

      const currentUsers = await db.select().from(schema.users).where(eq(schema.users.id, session.userId));
      const requestUser = currentUsers[0];
      if (!requestUser) return res.status(401).json({ error: "Unauthorized: User not found" });

      const role = requestUser.role;
      const table = req.params.table;

      // By default, only SUPER_ADMIN has full access, OWNER is read-only (so no POST/PUT/DELETE)
      if (!role) return res.status(401).json({ error: "No role provided" });
      if (role === "SUPER_ADMIN") return next();
      if (role === "OWNER")
        return res.status(403).json({ error: "Owner is read-only" });

      if (role === "FINANCE") {
        if (table !== "cash_transactions" && table !== "settings") {
          return res
            .status(403)
            .json({ error: "Finance only has access to Cash Flow" });
        }
        return next();
      }
      if (role === "MANAGER") {
        if (
          table !== "ingredients" &&
          table !== "stock_movements" &&
          table !== "sales_transactions" &&
          table !== "sales_import_logs" &&
          table !== "purchase_orders" &&
          table !== "suppliers"
        ) {
          return res
            .status(403)
            .json({
              error: "Manager only has access to Inventory, Sales, and Purchases",
            });
        }
        return next();
      }
      return res.status(403).json({ error: "Unauthorized role" });
    } catch (e) {
      console.error("RBAC Error:", e);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const auditLogMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const originalSend = res.json;
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
        const userId = (req.headers["x-user-id"] as string) || "System";
        const action =
          req.method === "POST"
            ? "CREATE"
            : req.method === "PUT"
              ? "UPDATE"
              : "DELETE";
        const tableName = req.params.table;
        const recordId = req.params.id || req.body.id || "unknown";

        db.insert(schema.auditLogs)
          .values({
            id: crypto.randomUUID(),
            userId,
            action,
            tableName,
            recordId,
            timestamp: new Date().toISOString(),
          })
          .catch((err) => console.error("Failed to write audit log:", err));
      }
      return originalSend.call(this, body);
    };
    next();
  };

  app.post("/api/import/sales", async (req, res) => {
    try {
      const authHeader = req.headers["authorization"] as string;
      const token = authHeader?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
      }

      const sessions = await db.select().from(schema.deviceSessions).where(eq(schema.deviceSessions.id, token));
      const session = sessions[0];
      if (!session) {
        return res.status(401).json({ error: "Unauthorized: Invalid session" });
      }

      const currentUsersDB = await db.select().from(schema.users).where(eq(schema.users.id, session.userId));
      const requestUser = currentUsersDB[0];

      if (!requestUser || (requestUser.role !== "SUPER_ADMIN" && requestUser.role !== "FINANCE" && requestUser.role !== "MANAGER")) {
        return res.status(403).json({ error: "Forbidden: insufficient permissions" });
      }

      const { sales_transactions, log } = req.body;

      // ── ATURAN ANTI DOUBLE COUNT (Import Arsip) ──────────────────────────
      // Cek apakah file dengan nama yang sama sudah pernah berhasil diimpor
      if (log?.fileName) {
        if (isDbConnected) {
          try {
            const existingLogs = await db
              .select()
              .from(schema.salesImportLogs)
              .where(and(eq(schema.salesImportLogs.fileName, log.fileName), eq(schema.salesImportLogs.status, "SUCCESS")));
            if (existingLogs.length > 0) {
              return res.status(400).json({
                error: `File "${log.fileName}" sudah pernah diimpor pada ${new Date(existingLogs[0].importDate).toLocaleString("id-ID")}. Impor ditolak untuk mencegah double count omzet dan pemotongan stok bahan berulang.`,
              });
            }
          } catch (chkErr) {
            console.warn("Could not check duplicate import logs in DB:", chkErr);
          }
        } else if (offlineState) {
          const existing = (offlineState.sales_import_logs || []).find(
            (l: any) => l.fileName === log.fileName && l.status === "SUCCESS"
          );
          if (existing) {
            return res.status(400).json({
              error: `File "${log.fileName}" sudah pernah diimpor pada ${new Date(existing.importDate).toLocaleString("id-ID")}. Impor ditolak untuk mencegah double count omzet dan pemotongan stok bahan berulang.`,
            });
          }
        }
      }

      const logId = crypto.randomUUID();

      await db.transaction(async (tx) => {
        // Insert log
        await tx.insert(schema.salesImportLogs).values({
          id: logId,
          importDate: new Date().toISOString(),
          fileName: log.fileName,
          rowCount: log.rowCount,
          status: "SUCCESS",
          createdBy: log.createdBy,
        });

        // Insert transactions
        if (
          Array.isArray(sales_transactions) &&
          sales_transactions.length > 0
        ) {
          const transactions = sales_transactions.map((s: any) => ({
            ...sanitizeSalesTransaction(s),
            importLogId: logId,
          }));
          await tx.insert(schema.salesTransactions).values(transactions);

          // Process stock reduction based on recipes
          const allRecipes = await tx.select().from(schema.recipes);
          const allIngredients = await tx.select().from(schema.ingredients);
          const stockMovementsToInsert: any[] = [];

          for (const s of transactions) {
            const recipe = allRecipes.find(r => r.menuName.toLowerCase() === s.menuName.toLowerCase());
            if (recipe) {
              let ingredientsList: any[] = [];
              try {
                ingredientsList = JSON.parse(recipe.ingredients);
              } catch (err) {
                console.warn(`Failed to parse recipe ingredients for ${recipe.menuName}`);
              }
              for (const reqIng of ingredientsList) {
                const dbIngredient = allIngredients.find(i => i.id === reqIng.ingredientId);
                if (dbIngredient) {
                  const qtyToDeduct = reqIng.quantity * s.quantitySold;
                  // Deduct current stock
                  await tx.update(schema.ingredients)
                    .set({ currentStock: Number(dbIngredient.currentStock) - qtyToDeduct })
                    .where(eq(schema.ingredients.id, reqIng.ingredientId));
                  // Update local copy to prevent sequential overwriting
                  dbIngredient.currentStock = Number(dbIngredient.currentStock) - qtyToDeduct;

                  // Add stock movement log
                  stockMovementsToInsert.push({
                    id: crypto.randomUUID(),
                    ingredientId: reqIng.ingredientId,
                    type: "OUT",
                    quantity: qtyToDeduct,
                    date: new Date().toISOString(),
                    note: `Auto deduction for sales: ${s.menuName} (${s.quantitySold}x)`,
                    unitCost: dbIngredient.costPerUnit,
                    totalCost: Number(dbIngredient.costPerUnit) * qtyToDeduct,
                    referenceId: s.id,
                    location: null,
                    createdBy: "System"
                  });
                }
              }
            }
          }

          if (stockMovementsToInsert.length > 0) {
            await tx.insert(schema.stockMovements).values(stockMovementsToInsert);
          }
        }
      });
      res.json({ success: true, logId });
    } catch (e) {
      console.error("Import sales error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post(
    "/api/:table",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        const table = getTable(req.params.table);
        if (!table) return res.status(404).json({ error: "Table not found" });
        await db.insert(table).values(req.body);
        res.json({ success: true });
      } catch (e) {
        console.error("Insert error:", e);
        res.status(500).json({ error: "Internal error" });
      }
    },
  );

  app.put(
    "/api/:table/:id",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        const table = getTable(req.params.table);
        if (!table) return res.status(404).json({ error: "Table not found" });
        await db.update(table).set(req.body).where(eq(table.id, req.params.id));
        res.json({ success: true });
      } catch (e) {
        console.error("Update error:", e);
        res.status(500).json({ error: "Internal error" });
      }
    },
  );

  app.delete(
    "/api/:table/:id",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        const table = getTable(req.params.table);
        if (!table) return res.status(404).json({ error: "Table not found" });
        await db.delete(table).where(eq(table.id, req.params.id));
        res.json({ success: true });
      } catch (e) {
        console.error("Delete error:", e);
        res.status(500).json({ error: "Internal error" });
      }
    },
  );

  // ─── AI ASSISTANT API ──────────────────────────────────────────────────────
  const GEMINI_CANDIDATE_MODELS = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ].filter(Boolean) as string[];

  async function generateContentWithFallback(ai: any, requestConfig: any) {
    let lastErr: any = null;
    for (const model of GEMINI_CANDIDATE_MODELS) {
      try {
        const rawRes = await ai.models.generateContent({
          ...requestConfig,
          model,
        });
        const response = (rawRes as any)?.response ?? rawRes;
        return { response, model };
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || "");
        if (
          msg.includes("404") ||
          msg.includes("not found") ||
          msg.includes("no longer available") ||
          msg.includes("NOT_FOUND") ||
          err?.status === 404
        ) {
          console.warn(`Gemini model ${model} unavailable, trying fallback model...`);
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }
  const GEMINI_MODEL = GEMINI_CANDIDATE_MODELS[0] || "gemini-2.5-flash";

  app.post("/api/ai/parse-receipt", async (req, res) => {
    try {
      const { text, imageBase64, mimeType, fileName } = req.body;
      let apiKey = process.env.GEMINI_API_KEY || null;
      try {
        const settings = await db.select().from(schema.settings).limit(1);
        if (settings[0]?.gemini_api_key) apiKey = settings[0].gemini_api_key;
        else if ((settings[0] as any)?.geminiApiKey) apiKey = (settings[0] as any).geminiApiKey;
      } catch { }

      // Extract text content if it's a text-based, CSV, or JSON document
      let effectiveText = text || "";
      const isTextFile =
        Boolean(imageBase64) &&
        (mimeType?.includes("text") ||
          mimeType?.includes("csv") ||
          mimeType === "application/json" ||
          fileName?.toLowerCase().endsWith(".txt") ||
          fileName?.toLowerCase().endsWith(".csv") ||
          fileName?.toLowerCase().endsWith(".json") ||
          fileName?.toLowerCase().endsWith(".md"));

      if (isTextFile && imageBase64) {
        try {
          const decoded = Buffer.from(imageBase64, "base64").toString("utf-8");
          if (decoded && decoded.trim()) {
            effectiveText = effectiveText
              ? `${effectiveText}\n\n[Isi Berkas ${fileName || "Dokumen"}]:\n${decoded}`
              : decoded;
          }
        } catch (decodeErr) {
          console.error("Gagal mendecode berkas teks:", decodeErr);
        }
      }

      if (!apiKey) {
        // Fallback Heuristic Parser when API key is not yet set
        const lines = (effectiveText || "").split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
        const fallbackTransactions: any[] = [];

        for (const line of lines) {
          const matchNumber = line.match(/(\d+(?:\.\d+)?)\s*(rb|ribu|k|jt|juta)?/i);
          let amount = 0;
          if (matchNumber) {
            let num = parseFloat(matchNumber[1]);
            const unit = (matchNumber[2] || "").toLowerCase();
            if (unit === "rb" || unit === "ribu" || unit === "k") num *= 1000;
            else if (unit === "jt" || unit === "juta") num *= 1000000;
            else if (num < 1000 && !unit) num *= 1000;
            amount = Math.round(num);
          } else {
            amount = 25000;
          }

          const isIncome = /pendapatan|omset|masuk|setor|terima|income/i.test(line);
          const isIngredient = /susu|biji|kopi|syrup|sirup|bean|powder|cup|sedotan|creamer|gula|teh/i.test(line);
          const category = isIngredient ? "Bahan Baku" : (isIncome ? "Penjualan" : "Operasional");

          fallbackTransactions.push({
            type: isIncome ? "CASH_IN" : "CASH_OUT",
            amount,
            category,
            description: line.replace(/(\d+(?:\.\d+)?)\s*(rb|ribu|k|jt|juta)?/gi, "").trim() || line
          });
        }

        // If no lines parsed from text, but user uploaded a file
        if (fallbackTransactions.length === 0) {
          const nameLower = (fileName || "").toLowerCase();
          if (nameLower.includes("susu") || nameLower.includes("milk")) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 95000,
              category: "Bahan Baku",
              description: `Pengadaan Susu Segar (${fileName || "Invoice"})`
            });
          } else if (nameLower.includes("kopi") || nameLower.includes("bean") || nameLower.includes("roast")) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 185000,
              category: "Bahan Baku",
              description: `Biji Kopi Espresso Blend 1kg (${fileName || "Invoice"})`
            });
          } else if (nameLower.includes("cup") || nameLower.includes("kemasan")) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 65000,
              category: "Bahan Baku",
              description: `Paper Cup & Lid 12oz (${fileName || "Invoice"})`
            });
          } else if (effectiveText) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 50000,
              category: "Operasional",
              description: effectiveText.slice(0, 80)
            });
          } else if (fileName) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 75000,
              category: "Operasional",
              description: `Pengeluaran Operasional (${fileName})`
            });
          }
        }

        return res.json({
          transactions: fallbackTransactions,
          note: `Diproses dengan heuristik cerdas internal${fileName ? ` untuk berkas "${fileName}"` : ""}. Pasang Gemini API Key di Pengaturan untuk pemrosesan OCR penuh dari dokumen PDF dan foto multi-halaman.`
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const contents: any[] = [];

      let promptText = "You are an AI assistant for a Coffee Shop management system. ";

      if (imageBase64) {
        const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
        const isImage = mimeType?.startsWith("image/") || fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|heic)$/);

        if (isPdf) {
          promptText += "Analyze this PDF invoice/receipt document. Identify all items purchased, prices, quantities, and the total. Also categorize each (e.g., 'Operasional', 'Bahan Baku', etc). ";
          contents.push({
            inlineData: { data: imageBase64, mimeType: "application/pdf" }
          });
        } else if (isImage) {
          promptText += "Analyze this receipt image. Identify the items bought, prices, and the total. Also categorize it (e.g., 'Operasional', 'Bahan Baku', etc). ";
          contents.push({
            inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" }
          });
        }
      }

      if (effectiveText) {
        promptText += "The user input / document text is: '" + effectiveText + "'. ";
        promptText += "Parse this text and extract any expenses, incomes, or stock updates. ";
      }

      promptText += "Return the result strictly as a JSON object matching this schema: { transactions: [{ type: 'CASH_OUT' | 'CASH_IN', amount: number, category: string, description: string }] }";

      contents.push({ text: promptText });

      const { response } = await generateContentWithFallback(ai, {
        model: GEMINI_MODEL,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["CASH_OUT", "CASH_IN"] },
                    amount: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["type", "amount", "category", "description"]
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) {
        throw new Error("Empty response from Gemini");
      }

      const result = JSON.parse(jsonStr);
      res.json(result);
    } catch (e: any) {
      console.error("AI parse error:", e);
      res.status(500).json({ error: e?.message || "Failed to parse with AI" });
    }
  });

  // ─── NATURAL LANGUAGE DATA ENTRY API ───────────────────────────────────────
  app.post("/api/ai/parse-natural-entry", async (req, res) => {
    try {
      const { text, storeContext } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Teks catatan belanja tidak boleh kosong" });
      }

      let apiKey = process.env.GEMINI_API_KEY || null;
      try {
        const settings = await db.select().from(schema.settings).limit(1);
        if (settings[0]?.gemini_api_key) apiKey = settings[0].gemini_api_key;
        else if ((settings[0] as any)?.geminiApiKey) apiKey = (settings[0] as any).geminiApiKey;
      } catch { }

      // Fallback NLP parser function (handles offline or when Gemini is unreachable)
      const parseLocalNaturalEntry = () => {
        const clean = text.trim();
        const sentences = clean.split(/(?:;|\n| lalu | dan kemudian |,| serta )/i).map((s: string) => s.trim()).filter(Boolean);
        const transactions: any[] = [];

        for (const sentence of sentences) {
          // Bersihkan dimensi ukuran barang (misal 80x100) agar tidak tertukar jadi nominal harga
          const sanitizedSentence = sentence.replace(/\b\d+\s*[*xX]\s*\d+\b/g, " ");
          let amount = 0;
          const rpMatch = sanitizedSentence.match(/(?:rp|rp\.?|seharga|total|harga|biaya|nilai)\s*(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?/i);
          const matchNumber = rpMatch || sanitizedSentence.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?/i);
          if (matchNumber) {
            let num = parseFloat(matchNumber[1].replace(",", "."));
            const unit = (matchNumber[2] || "").toLowerCase();
            if (unit === "rb" || unit === "ribu" || unit === "k") num *= 1000;
            else if (unit === "jt" || unit === "juta") num *= 1000000;
            else if (num < 1000 && !unit) num *= 1000;
            amount = Math.round(num);
          }

          if (amount <= 0) continue;

          // Detect type
          const isIncome = /terima|masuk|omset|pendapatan|setor|income|pelunasan/i.test(sentence);
          const type = isIncome ? "CASH_IN" : "CASH_OUT";

          // Detect category
          let category = "Operasional";
          if (/susu|milk|kopi|bean|espresso|syrup|sirup|teh|tea|matcha|aren|creamer|oat|butter|mentega|croissant|daging|ayam|beras|saus/i.test(sentence)) {
            category = "Bahan Baku";
          } else if (/es|ice|galon|air|cup|lid|sedotan|straw|paper|seal|plastik/i.test(sentence)) {
            category = "Operasional Bar";
          } else if (/sabun|sunlight|sampah|tissue|tisu|pel|sapu|lap|kebersihan|kantong|plastik/i.test(sentence)) {
            category = "Kebersihan & Sanitasi";
          } else if (/listrik|pln|wifi|indihome|pdam|gas|lpg/i.test(sentence)) {
            category = "Utilitas";
          } else if (isIncome) {
            category = "Pendapatan Lain";
          }

          // Detect suggested cash account
          let accountName = "Laci Kasir";
          if (/bca|bank|transfer|rekening|mandiri|debit|qris/i.test(sentence)) {
            accountName = "Bank BCA";
          } else if (/utama|brankas|owner|tabungan/i.test(sentence)) {
            accountName = "Kas Utama";
          }

          // Attempt to match with known ingredients in storeContext
          let matchedIngredient: any = null;
          let quantity = 1;
          const qtyMatch = sentence.match(/(\d+(?:[.,]\d+)?)\s*(liter|l|kg|gr|gram|pcs|pack|karung|karton|dus|bal|botol|galon)/i);
          if (qtyMatch) {
            quantity = parseFloat(qtyMatch[1].replace(",", "."));
          }

          if (Array.isArray(storeContext?.ingredients)) {
            const sentenceLower = sentence.toLowerCase();
            matchedIngredient = storeContext.ingredients.find((ing: any) => {
              const nameLower = (ing.name || "").toLowerCase();
              return sentenceLower.includes(nameLower) ||
                (nameLower.includes("susu") && sentenceLower.includes("susu")) ||
                (nameLower.includes("beans") && sentenceLower.includes("kopi")) ||
                (nameLower.includes("es batu") && (sentenceLower.includes("es") || sentenceLower.includes("kristal"))) ||
                (nameLower.includes("aren") && sentenceLower.includes("aren")) ||
                (nameLower.includes("galon") && (sentenceLower.includes("galon") || sentenceLower.includes("air")));
            });
          }

          transactions.push({
            type,
            amount,
            category,
            description: sentence.trim(),
            accountName,
            ingredientId: matchedIngredient?.id || null,
            ingredientName: matchedIngredient?.name || null,
            quantity: matchedIngredient ? quantity : null,
            unit: matchedIngredient?.unit || (qtyMatch ? qtyMatch[2] : null),
          });
        }

        return {
          summary: `${transactions.length} transaksi berhasil diekstrak dari catatan narasi.`,
          transactions,
          source: "local-nlp",
        };
      };

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Anda adalah sistem data entry cerdas untuk "Julia's Specialty Room • Coffee • Eatery".
Tugas Anda: mengekstrak catatan kasir/staf dalam bahasa Indonesia santai menjadi transaksi kas terstruktur.

Konteks Akun Kas: ${JSON.stringify(storeContext?.cashAccounts?.map((a: any) => a.name) || ["Laci Kasir", "Kas Utama", "Bank BCA"])}
Kategori Tersedia: ${JSON.stringify(storeContext?.categories?.map((c: any) => c.name) || ["Bahan Baku", "Operasional Bar", "Kebersihan & Sanitasi", "Utilitas", "Pendapatan Lain"])}
Daftar Bahan Baku di Gudang/Bar: ${JSON.stringify(storeContext?.ingredients?.map((i: any) => ({ id: i.id, name: i.name, unit: i.unit })) || [])}

Teks Catatan: "${text}"

Aturan Pemrosesan:
1. Pahami satuan angka: "25rb" = 25000, "150k" = 150000, "1.2jt" = 1200000.
2. Abaikan format dimensi ukuran (misal 80x100, 30x40). Jangan jadikan ukuran sebagai nominal harga!
3. Prioritaskan angka dengan awalan 'Rp', 'harga', atau 'total' sebagai nominal transaksi.
4. Tentukan type: "CASH_OUT" untuk belanja/beli/bayar/keluar, "CASH_IN" untuk pemasukan/terima/omset.
5. Untuk CASH_OUT (misal plastik sampah, sabun, kantong), jangan pernah gunakan kategori Pendapatan, gunakan kategori biaya operasional/kebersihan.
3. Cocokkan accountName jika pengguna menyebut "laci/kasir", "bank/bca", atau "kas utama".
4. Jika nama bahan disebutkan (susu, beans, es, gula aren, galon, dsb), cocokkan ingredientId & ingredientName dari daftar bahan baku, sertakan quantity dan unitnya.
5. Buat summary bahasa Indonesia yang ringkas dan ramah.`;

          const { response } = await generateContentWithFallback(ai, {
            model: GEMINI_MODEL,
            contents: [{ text: prompt }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  transactions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, enum: ["CASH_OUT", "CASH_IN"] },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        description: { type: Type.STRING },
                        accountName: { type: Type.STRING },
                        ingredientId: { type: Type.STRING },
                        ingredientName: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        unit: { type: Type.STRING },
                      },
                      required: ["type", "amount", "category", "description"],
                    },
                  },
                },
                required: ["summary", "transactions"],
              },
            },
          });

          const jsonStr = response.text;
          if (jsonStr) {
            const parsed = JSON.parse(jsonStr);
            return res.json({ ...parsed, source: "gemini" });
          }
        } catch (genErr: any) {
          console.warn("Gemini natural parser failed, falling back to local NLP:", genErr?.message);
        }
      }

      // Local fallback
      const localResult = parseLocalNaturalEntry();
      return res.json(localResult);
    } catch (e: any) {
      console.error("Parse natural entry error:", e);
      res.status(500).json({ error: e?.message || "Gagal memproses catatan teks" });
    }
  });

  // ─── EXECUTIVE AI MANAGEMENT INSIGHTS API ──────────────────────────────────
  app.post("/api/ai/executive-insights", async (req, res) => {
    try {
      const { metrics } = req.body;
      let apiKey = process.env.GEMINI_API_KEY || null;
      try {
        const settings = await db.select().from(schema.settings).limit(1);
        if (settings[0]?.gemini_api_key) apiKey = settings[0].gemini_api_key;
        else if ((settings[0] as any)?.geminiApiKey) apiKey = (settings[0] as any).geminiApiKey;
      } catch { }

      const prompt = `Anda adalah "Julia Coffee AI Copilot" — penasihat bisnis eksekutif untuk "Julia's Specialty Room • Coffee • Eatery".
Berdasarkan data performa toko berikut:
${JSON.stringify(metrics || {})}

Berikan ringkasan eksekutif manajemen yang padat, berbobot, dan actionable dalam format Markdown dengan 4 bagian:
1. 🩺 **Evaluasi Kesehatan Finansial & Profitabilitas**: Analisis margin, arus kas, dan run-rate omzet.
2. 🚨 **Audit Stok Kritis & Tindakan Segera**: Soroti bahan baku yang menipis/habis dan urutan prioritas belanja harian.
3. ☕ **Optimalisasi Menu & Food Cost**: Rekomendasi upselling menu margin tinggi (espresso based, specialty) dan strategi untuk menu lambat (slow-moving).
4. ⚡ **Taktik Operasional & Jam Sibuk**: Rekomendasi alokasi barista dan promo jam sepi (14:00 - 17:00).

Gunakan bahasa Indonesia yang profesional, hangat, menggunakan poin-poin tegas dan angka bold. Jangan bertele-tele.`;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const { response } = await generateContentWithFallback(ai, {
            model: GEMINI_MODEL,
            contents: [{ text: prompt }],
            config: { temperature: 0.6 },
          });

          if (response.text) {
            return res.json({
              briefing: response.text,
              source: "gemini",
            });
          }
        } catch (apiErr: any) {
          console.warn("Gemini executive briefing failed, falling back to smart local:", apiErr?.message);
        }
      }

      // Smart local executive briefing generator
      const rev = metrics?.totalRevenue || 0;
      const exp = metrics?.totalExpense || 0;
      const profit = Math.max(0, rev - exp);
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
      const lowStockCount = Array.isArray(metrics?.lowStockItems) ? metrics.lowStockItems.length : 0;
      const lowStockNames = Array.isArray(metrics?.lowStockItems)
        ? metrics.lowStockItems.slice(0, 3).map((i: any) => `${i.name} (Sisa: ${i.currentStock} ${i.unit})`).join(", ")
        : "Tidak ada stok kritis";

      const localBriefing = `### 🩺 1. Evaluasi Kesehatan Finansial & Profitabilitas
- **Omzet Tercatat:** Rp ${Number(rev).toLocaleString("id-ID")} dengan Pengeluaran Rp ${Number(exp).toLocaleString("id-ID")}.
- **Estimasi Laba Bersih Operasional:** Rp ${Number(profit).toLocaleString("id-ID")} (Margin **${margin}%**).
- **Rekomendasi:** Rasio biaya ideal specialty coffee adalah food cost 28-32% dan operasional maksimal 20%. Posisi keuangan toko saat ini dalam koridor **${margin >= 25 ? "Sangat Sehat & Produktif" : "Perlu Pengetatan Pengeluaran Kas Kecil"}**.

---

### 🚨 2. Audit Stok Kritis & Tindakan Segera
- Terdeteksi **${lowStockCount} bahan baku** berada di bawah batas stok minimum (*safety stock*).
- **Prioritas Belanja:** ${lowStockNames}.
- **Tindakan:** Segera lakukan pemesanan ke supplier atau belanja pasar harian sebelum jam sibuk esok hari agar alur pesanan kasir tidak tertunda.

---

### ☕ 3. Optimalisasi Menu & Food Cost
- **Cash Cow Produk:** Kopi susu gula aren dan espresso-based beverage memiliki kontribusi margin tertinggi (>65%).
- **Saran Menu Engineering:** Pasang paket pairing kopi filter/espresso dengan pastry/croissant untuk mendongkrak rata-rata belanja (*basket size*) dari Rp 28.000 menjadi Rp 45.000 per struk.

---

### ⚡ 4. Taktik Operasional & Jam Sibuk
- **Rush Hour (11:00 - 13:00 & 19:00 - 21:00):** Terapkan pembagian barista tetap (1 fokus dial-in espresso & steaming susu, 1 floater kasir & packaging).
- **Slow Hours (14:00 - 17:00):** Luncurkan promo *Afternoon Working Space* dengan voucher potongan pastry untuk menarik pelanggan komunitas remote work.`;

      return res.json({
        briefing: localBriefing,
        source: "local-expert",
      });
    } catch (e: any) {
      console.error("Executive insights error:", e);
      res.status(500).json({ error: e?.message || "Failed to generate executive insights" });
    }
  });

  app.post("/api/ai/ask-advisor", async (req, res) => {
    try {
      const { message, chatHistory = [], storeContext } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Pesan tidak boleh kosong" });
      }

      let apiKey = process.env.GEMINI_API_KEY || null;
      try {
        const settings = await db.select().from(schema.settings).limit(1);
        if (settings[0]?.gemini_api_key) apiKey = settings[0].gemini_api_key;
        else if ((settings[0] as any)?.geminiApiKey) apiKey = (settings[0] as any).geminiApiKey;
      } catch { }

      const systemInstruction = `Anda adalah "Julia Coffee AI Copilot" — konsultan bisnis eksekutif dan pakar operasional specialty coffee shop Indonesia.
Tugas Anda:
1. Memberikan rekomendasi bisnis, HPP, strategi promo, menu engineering, dan efisiensi barista secara praktis, terukur, dan profesional.
2. Menggunakan gaya bahasa bahasa Indonesia yang ramah, sopan, ringkas, dan terstruktur (gunakan bullet points, bolding untuk angka dan poin kunci).
3. Memberikan perhitungan matematis yang jelas jika ditanya tentang margin, HPP kopi susu, food cost target (28%-32%), atau target omset.
4. Konteks toko saat ini (jika ada): ${storeContext ? JSON.stringify(storeContext) : "Coffee Shop aktif"}.
Jawab dengan padat, berbobot, dan langsung memberikan langkah aksi (actionable insights).`;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });

          const contents = [];
          if (Array.isArray(chatHistory)) {
            for (const item of chatHistory.slice(-6)) {
              if (item.text) {
                contents.push({
                  role: item.role === "model" ? "model" : "user",
                  parts: [{ text: item.text }]
                });
              }
            }
          }
          contents.push({
            role: "user",
            parts: [{ text: message }]
          });

          const { response } = await generateContentWithFallback(ai, {
            model: GEMINI_MODEL,
            contents,
            config: {
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              temperature: 0.7,
            }
          });

          return res.json({
            reply: response.text || "Tidak ada jawaban yang dihasilkan.",
            source: "gemini"
          });
        } catch (apiErr: any) {
          console.warn("Gemini API call failed, falling back to local advisor:", apiErr?.message);
        }
      }

      // Intelligent Local Coffee Consultant Fallback
      const lower = message.toLowerCase();
      let fallbackReply = "";

      if (lower.includes("hpp") || lower.includes("margin") || lower.includes("harga")) {
        fallbackReply = `### ☕ Rekomendasi Kalkulasi HPP & Margin Kopi
1. **Target Food Cost Ideal:** Untuk specialty coffee shop, rasio HPP ideal adalah **28% - 32%** dari harga jual nett.
2. **Contoh Kopi Susu Gula Aren (Cup 12oz):**
   - Espresso 20g (Beans Rp 250rb/kg): **Rp 5.000**
   - Susu Fresh Milk 120ml (Rp 18rb/liter): **Rp 2.160**
   - Sirup Gula Aren 20ml: **Rp 800**
   - Cup, Lid, Straw, Seal: **Rp 1.200**
   - **Total HPP Pokok:** **Rp 9.160**
3. **Harga Jual Rekomendasi:** Rp 24.000 - Rp 28.000 (Gross Margin mencapai **62% - 67%**).
4. **Tips Profit:** Bundling dengan pastry/croissant dengan margin minimal 50% untuk menaikkan Average Basket Size pelanggan.`;
      } else if (lower.includes("rush hour") || lower.includes("antrean") || lower.includes("ramai") || lower.includes("workflow")) {
        fallbackReply = `### ⚡ Tips Optimalisasi Workflow Barista Saat Rush Hour
1. **Zonasi & Spesialisasi Barista:**
   - **Barista 1 (Dial-in & Milk Station):** Fokus dosing, tamping, pulling shot, dan steaming susu. Jangan sentuh kasir atau cup sealing.
   - **Barista 2 (Floater & Kasir):** Terima pesanan di POS, handle pembayaran QRIS/Cash, pasang lid/sedotan, dan serahkan ke pelanggan.
2. **Pre-batching & Mise en Place:**
   - Siapkan cup bertuliskan pesanan sebelumnya.
   - Gunakan pitcher susu bergaris takaran agar tidak ada susu terbuang (mengurangi waste).
3. **Prioritas Minuman:** Kelompokkan pesanan minuman dingin berbasis sirup terlebih dahulu, lalu espresso-based milk hot untuk menjaga suhu optimal.`;
      } else if (lower.includes("promo") || lower.includes("sepi") || lower.includes("omset") || lower.includes("penjualan")) {
        fallbackReply = `### 📈 Strategi Dongkrak Omset di Jam Sepi (14:00 - 17:00)
1. **Happy Hour "Coffee & Bite" Bundling:** Diskon 15-20% hanya untuk pembelian kopi + camilan pada pukul 14.00-17.00. Ini mengundang pekerja remote / mahasiswa untuk nongkrong.
2. **Loyalty Stamp Digital:** Program "Beli 5 Kopi Gratis 1" dengan mencatat nomor HP pelanggan di POS kasir untuk meningkatkan repeat order hingga 35%.
3. **Upselling Kasir Cerdas:** Ajarkan kasir menawarkan: *"Mau nambah extra shot espresso cuma Rp 5.000 kak?"* atau *"Mau ganti ke Oat Milk cuma nambah Rp 8.000?"* — meningkatkan tiket rata-rata tanpa modal besar.`;
      } else if (lower.includes("stok") || lower.includes("bahan") || lower.includes("waste") || lower.includes("opname")) {
        fallbackReply = `### 📦 Manajemen Stok & Pencegahan Kerugian (Waste)
1. **Prinsip FIFO Ketat (First In First Out):** Susu dan sirup yang datang lebih awal wajib digunakan terlebih dahulu dengan penandaan tanggal buka (*opening date tag*).
2. **Safety Stock Biji Kopi:** Tetapkan titik pesan ulang (*Reorder Point*) minimal 3 hari sebelum stok habis dengan memperhitungkan waktu restock sangrai/roastery.
3. **Audit Opname Rutin:** Lakukan stok opname susu dan biji kopi di setiap pergantian shift untuk melacak selisih pemakaian vs resep tertera di sistem.`;
      } else {
        fallbackReply = `### 💡 Panduan Manajemen Julia Coffee AI
Halo! Saya siap membantu mengembangkan coffee shop Anda menjadi lebih efisien dan menguntungkan.

**Topik yang sering dikonsultasikan:**
- **Analisis HPP & Margin:** Cara menghitung harga jual optimal agar margin di atas 65%.
- **SOP & Efisiensi Barista:** Cara mengatur kecepatan sajian di jam rush hour.
- **Strategi Promo:** Ide promo jam sepi (*slow hours*) dan paket bundling terlaris.
- **Audit Stok & Waste:** Menghilangkan kebocoran bahan baku susu dan biji kopi.

*Tips: Pasang Gemini API Key Anda di menu Pengaturan > Integrasi AI untuk analisis bebas tanpa batas menggunakan kecerdasan Gemini 2.5 Flash!*`;
      }

      return res.json({
        reply: fallbackReply,
        source: "local-expert",
        note: !apiKey ? "Kunci API Gemini belum diatur di Pengaturan. Menampilkan modul kecerdasan coffee shop internal." : undefined
      });
    } catch (e: any) {
      console.error("AI Advisor error:", e);
      res.status(500).json({ error: e?.message || "Failed to process advisor query" });
    }
  });

  // ─── POS & Kasir Tablet API ────────────────────────────────────────────────

  // Helper routing akun kas berdasarkan metode pembayaran (CASH -> Laci Kasir, QRIS/DEBIT/CREDIT -> Rekening Bank/E-Wallet)
  const resolveOfflinePaymentAccount = (
    paymentMethod: string,
    requestedAccountId?: string | null,
    shiftId?: string | null
  ): string => {
    offlineState.cash_accounts = offlineState.cash_accounts || [];
    const shift = shiftId ? (offlineState.shifts || []).find((s: any) => s.id === shiftId) : null;
    const resolved = resolvePaymentAccountId(
      paymentMethod,
      requestedAccountId,
      offlineState.cash_accounts,
      shift?.cashAccountId
    );
    if (resolved) return resolved;

    const method = String(paymentMethod || "CASH").toUpperCase();
    if (method === "CASH") {
      if (!offlineState.cash_accounts.some((a: any) => a.type === "CASH")) {
        offlineState.cash_accounts.push({
          id: "cash-drawer-main",
          name: "Laci Kasir Utama",
          type: "CASH",
          isDefault: true,
        });
      }
      return offlineState.cash_accounts.find((a: any) => a.type === "CASH")?.id || "cash-drawer-main";
    } else {
      if (!offlineState.cash_accounts.some((a: any) => a.type === "BANK" || a.type === "E_WALLET")) {
        offlineState.cash_accounts.push({
          id: "bank-bca-main",
          name: "Rekening Bank / QRIS Utama",
          type: "BANK",
          isDefault: false,
        });
      }
      return (
        offlineState.cash_accounts.find((a: any) => a.type === "BANK" || a.type === "E_WALLET")?.id ||
        "bank-bca-main"
      );
    }
  };

  const resolveDbPaymentAccount = async (
    tx: any,
    paymentMethod: string,
    requestedAccountId?: string | null,
    shiftId?: string | null
  ): Promise<string> => {
    const accounts = await tx.select().from(schema.cashAccounts);
    let shiftCashAccId: string | null = null;
    if (shiftId) {
      const shRows = await tx.select().from(schema.shifts).where(eq(schema.shifts.id, shiftId)).limit(1);
      shiftCashAccId = shRows[0]?.cashAccountId || null;
    }
    const resolved = resolvePaymentAccountId(paymentMethod, requestedAccountId, accounts, shiftCashAccId);
    if (resolved) return resolved;

    const method = String(paymentMethod || "CASH").toUpperCase();
    if (method === "CASH") {
      const fallbackId = "cash-drawer-main";
      if (!accounts.some((a: any) => a.id === fallbackId)) {
        await tx.insert(schema.cashAccounts).values({
          id: fallbackId,
          name: "Laci Kasir Utama",
          type: "CASH",
          isDefault: true,
        });
      }
      return fallbackId;
    } else {
      const fallbackBankId = "bank-bca-main";
      if (!accounts.some((a: any) => a.id === fallbackBankId)) {
        await tx.insert(schema.cashAccounts).values({
          id: fallbackBankId,
          name: "Rekening Bank / QRIS Utama",
          type: "BANK",
          isDefault: false,
        });
      }
      return fallbackBankId;
    }
  };

  // Helper pemotongan/pengembalian stok yang mendukung resep spesifik Varian (Hot/Iced/1L), Modifier (Extra Shot), & Substitusi Susu Oat/Soy
  const applyOfflineOrderStock = (
    items: any[],
    mode: "USAGE" | "RETURN" | "WASTE",
    notePrefix: string,
    actorName: string,
    orderId: string,
    nowIso: string
  ) => {
    offlineState.stock_movements = offlineState.stock_movements || [];
    offlineState.ingredients = offlineState.ingredients || [];
    const allRecipes = offlineState.recipes || [];
    const allProducts = offlineState.products || [];
    const allIngredients = offlineState.ingredients || [];

    for (const item of items) {
      const resolvedIngs = resolveOrderItemIngredients(item, allRecipes, allProducts, allIngredients);
      const variantLabel = item.variantName ? ` (${item.variantName})` : "";
      for (const rIng of resolvedIngs) {
        if (rIng.totalQuantity <= 0) continue;
        if (mode === "USAGE") {
          offlineState.stock_movements.push({
            id: crypto.randomUUID(),
            ingredientId: rIng.ingredientId,
            type: "USAGE",
            quantity: rIng.totalQuantity,
            date: nowIso,
            note: `${notePrefix} - ${item.menuName}${variantLabel} x${item.quantity || 1}`,
            createdBy: actorName,
            referenceId: orderId,
          });
          const ing = allIngredients.find((i: any) => i.id === rIng.ingredientId);
          if (ing) {
            ing.currentStock = Number(((Number(ing.currentStock) || 0) - rIng.totalQuantity).toFixed(4));
          }
        } else if (mode === "RETURN") {
          offlineState.stock_movements.push({
            id: crypto.randomUUID(),
            ingredientId: rIng.ingredientId,
            type: "RETURN",
            quantity: rIng.totalQuantity,
            date: nowIso,
            note: `${notePrefix} - ${item.menuName}${variantLabel} x${item.quantity || 1}`,
            createdBy: actorName,
            referenceId: orderId,
          });
          const ing = allIngredients.find((i: any) => i.id === rIng.ingredientId);
          if (ing) {
            ing.currentStock = Number(((Number(ing.currentStock) || 0) + rIng.totalQuantity).toFixed(4));
          }
        } else if (mode === "WASTE") {
          offlineState.stock_movements.push({
            id: crypto.randomUUID(),
            ingredientId: rIng.ingredientId,
            type: "WASTE",
            quantity: -rIng.totalQuantity,
            date: nowIso,
            note: `${notePrefix} - ${item.menuName}${variantLabel} x${item.quantity || 1}`,
            createdBy: actorName,
            referenceId: orderId,
          });
        }
      }
    }
  };

  const applyDbOrderStock = async (
    tx: any,
    items: any[],
    mode: "USAGE" | "RETURN" | "WASTE",
    notePrefix: string,
    actorName: string,
    orderId: string,
    nowIso: string
  ) => {
    if (!items || items.length === 0) return;
    const [allRecipes, allProducts, allIngredients] = await Promise.all([
      tx.select().from(schema.recipes),
      tx.select().from(schema.products),
      tx.select().from(schema.ingredients),
    ]);
    const ingStockMap = new Map<string, number>();
    for (const ing of allIngredients) {
      ingStockMap.set(String(ing.id), Number(ing.currentStock) || 0);
    }

    for (const item of items) {
      const resolvedIngs = resolveOrderItemIngredients(item, allRecipes, allProducts, allIngredients);
      const variantLabel = item.variantName ? ` (${item.variantName})` : "";
      for (const rIng of resolvedIngs) {
        if (rIng.totalQuantity <= 0) continue;
        if (mode === "USAGE") {
          await tx.insert(schema.stockMovements).values({
            id: crypto.randomUUID(),
            ingredientId: rIng.ingredientId,
            type: "USAGE",
            quantity: rIng.totalQuantity,
            date: nowIso,
            note: `${notePrefix} - ${item.menuName}${variantLabel} x${item.quantity || 1}`,
            createdBy: actorName,
            referenceId: orderId,
          });
          if (ingStockMap.has(rIng.ingredientId)) {
            const nextStock = Number(((ingStockMap.get(rIng.ingredientId) || 0) - rIng.totalQuantity).toFixed(4));
            ingStockMap.set(rIng.ingredientId, nextStock);
            await tx
              .update(schema.ingredients)
              .set({ currentStock: nextStock })
              .where(eq(schema.ingredients.id, rIng.ingredientId));
          }
        } else if (mode === "RETURN") {
          await tx.insert(schema.stockMovements).values({
            id: crypto.randomUUID(),
            ingredientId: rIng.ingredientId,
            type: "RETURN",
            quantity: rIng.totalQuantity,
            date: nowIso,
            note: `${notePrefix} - ${item.menuName}${variantLabel} x${item.quantity || 1}`,
            createdBy: actorName,
            referenceId: orderId,
          });
          if (ingStockMap.has(rIng.ingredientId)) {
            const nextStock = Number(((ingStockMap.get(rIng.ingredientId) || 0) + rIng.totalQuantity).toFixed(4));
            ingStockMap.set(rIng.ingredientId, nextStock);
            await tx
              .update(schema.ingredients)
              .set({ currentStock: nextStock })
              .where(eq(schema.ingredients.id, rIng.ingredientId));
          }
        } else if (mode === "WASTE") {
          await tx.insert(schema.stockMovements).values({
            id: crypto.randomUUID(),
            ingredientId: rIng.ingredientId,
            type: "WASTE",
            quantity: -rIng.totalQuantity,
            date: nowIso,
            note: `${notePrefix} - ${item.menuName}${variantLabel} x${item.quantity || 1}`,
            createdBy: actorName,
            referenceId: orderId,
          });
        }
      }
    }
  };

  // 1. Get POS Menu & Live Stock Availability
  app.get("/api/pos/menu", async (req, res) => {
    try {
      let allRecipes: any[] = [];
      let allIngredients: any[] = [];
      let allProducts: any[] = [];
      let settings: any = null;

      if (isDbConnected) {
        try {
          allRecipes = await db.select().from(schema.recipes);
          allIngredients = await db.select().from(schema.ingredients);
          allProducts = await db.select().from(schema.products);
          settings = (await db.select().from(schema.settings).limit(1))[0];
        } catch (dbErr) {
          console.warn("DB query failed in /api/pos/menu, using fallback state");
        }
      }

      if (allRecipes.length === 0 && offlineState) {
        allRecipes = offlineState.recipes || [];
        allIngredients = offlineState.ingredients || [];
        allProducts = offlineState.products || [];
        settings = (offlineState.settings && offlineState.settings.length > 0 ? (Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings) : initialSettings);
      }

      const ingredientMap = new Map(allIngredients.map((ing) => [ing.id, ing]));
      const productMap = new Map<string, { price?: number; variants: any[]; modifierGroups: any[]; category?: string; division?: string }>();

      for (const p of allProducts) {
        if (p.isActive === false) continue;
        let vars: any[] = [];
        let modGroups: any[] = [];
        try {
          vars = typeof p.variants === "string" ? JSON.parse(p.variants) : (Array.isArray(p.variants) ? p.variants : []);
        } catch {
          vars = [];
        }
        try {
          modGroups = typeof p.modifierGroups === "string" ? JSON.parse(p.modifierGroups) : (Array.isArray(p.modifierGroups) ? p.modifierGroups : []);
        } catch {
          modGroups = [];
        }
        const defaultPrice = vars.length > 0 && vars[0].price ? Number(vars[0].price) : undefined;
        productMap.set(String(p.name || "").toLowerCase().trim(), {
          price: defaultPrice,
          variants: vars.filter((v: any) => v.isAvailable !== false),
          modifierGroups: modGroups,
          category: p.category,
          division: p.division,
        });
      }

      const menuList = allRecipes.map((r) => {
        let recipeItems: { ingredientId: string; quantity: number }[] = [];
        try {
          recipeItems = typeof r.ingredients === "string" ? JSON.parse(r.ingredients) : r.ingredients;
        } catch {
          recipeItems = [];
        }

        let maxPortions = 9999;
        let hppCost = 0;

        for (const item of recipeItems) {
          const ing = ingredientMap.get(item.ingredientId);
          if (ing) {
            hppCost += (ing.costPerUnit || 0) * item.quantity;
            if (item.quantity > 0) {
              const possible = Math.floor((ing.currentStock || 0) / item.quantity);
              if (possible < maxPortions) {
                maxPortions = Math.max(0, possible);
              }
            }
          }
        }

        if (recipeItems.length === 0) {
          maxPortions = 999;
        }

        const lowerName = r.menuName.toLowerCase();
        let guessedCategory = "COFFEE";
        let defaultStation = "BAR";

        if (lowerName.includes("croissant") || lowerName.includes("pastry") || lowerName.includes("bread") || lowerName.includes("roti") || lowerName.includes("cake")) {
          guessedCategory = "BAKERY";
          defaultStation = "BAKERY";
        } else if (lowerName.includes("rice") || lowerName.includes("nasi") || lowerName.includes("pasta") || lowerName.includes("spaghetti") || lowerName.includes("burger") || lowerName.includes("fries") || lowerName.includes("snack")) {
          guessedCategory = "FOOD";
          defaultStation = "KITCHEN";
        } else if (lowerName.includes("tea") || lowerName.includes("juice") || lowerName.includes("matcha") || lowerName.includes("chocolate") || lowerName.includes("mocktail") || lowerName.includes("soda")) {
          guessedCategory = "NON-COFFEE";
          defaultStation = "BAR";
        }

        const matchedProduct = productMap.get(lowerName.trim());

        return {
          id: r.id,
          name: r.menuName,
          category: matchedProduct?.category || guessedCategory,
          defaultStation: matchedProduct?.division === "BAKER" ? "BAKERY" : (matchedProduct?.division || defaultStation),
          recipe: recipeItems,
          estimatedHpp: Math.round(hppCost),
          maxPortions,
          isAvailable: maxPortions > 0,
          price: matchedProduct?.price || undefined,
          variants: matchedProduct?.variants || [],
          modifierGroups: matchedProduct?.modifierGroups || [],
        };
      });

      res.json({
        menu: menuList,
        tax: {
          enabled: settings?.taxEnabled ?? false,
          rate: settings?.taxRate ?? 10,
          mode: settings?.taxMode ?? "EXCLUSIVE",
        },
        maxCashierDiscount: settings?.maxCashierDiscount ?? 10,
      });
    } catch (e: any) {
      console.error("POS menu fetch error:", e);
      res.status(500).json({ error: e?.message || "Failed to fetch POS menu" });
    }
  });

  // 2. Create Order (Open Bill or Paid Pay-First)
  app.post("/api/pos/orders", async (req, res) => {
    try {
      const {
        idempotencyKey,
        orderType = "DINE_IN",
        tableNumber,
        customerName,
        items = [],
        subtotal = 0,
        discountPercent = 0,
        discountAmount = 0,
        discountReason,
        taxPercent = 0,
        taxAmount = 0,
        taxMode = "EXCLUSIVE",
        totalAmount = 0,
        notes,
        cashierId,
        cashierName,
        shiftId,
        status = "OPEN",
        payment,
        appliedPromotionId,
        appliedPromotionName,
      } = req.body;

      // Idempotency check: prevent duplicate orders
      if (idempotencyKey) {
        if (isDbConnected) {
          try {
            const existing = await db
              .select()
              .from(schema.orders)
              .where(eq(schema.orders.idempotencyKey, idempotencyKey))
              .limit(1);
            if (existing.length > 0) {
              const existingItems = await db
                .select()
                .from(schema.orderItems)
                .where(eq(schema.orderItems.orderId, existing[0].id));
              const existingPayments = await db
                .select()
                .from(schema.payments)
                .where(eq(schema.payments.orderId, existing[0].id));
              return res.json({
                order: existing[0],
                items: existingItems,
                payments: existingPayments,
                isDuplicate: true,
              });
            }
          } catch { }
        } else if (offlineState) {
          const existing = (offlineState.orders || []).find((o: any) => o.idempotencyKey === idempotencyKey);
          if (existing) {
            const existingItems = (offlineState.order_items || []).filter((it: any) => it.orderId === existing.id);
            const existingPayments = (offlineState.payments || []).filter((p: any) => p.orderId === existing.id);
            return res.json({
              order: existing,
              items: existingItems,
              payments: existingPayments,
              isDuplicate: true,
            });
          }
        }
      }

      // Generate receipt number: ORD-YYYYMMDD-XXXX (menggunakan tanggal lokal WITA toko, bukan UTC)
      const dateStr = getLocalDateString().replace(/-/g, "");
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const receiptNo = `ORD-${dateStr}-${randomSuffix}`;
      const orderId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      if (!isDbConnected && offlineState) {
        offlineState.orders = offlineState.orders || [];
        offlineState.order_items = offlineState.order_items || [];
        offlineState.payments = offlineState.payments || [];
        offlineState.cash_transactions = offlineState.cash_transactions || [];
        offlineState.sales_transactions = offlineState.sales_transactions || [];
        offlineState.stock_movements = offlineState.stock_movements || [];

        const newOrder = {
          id: orderId,
          receiptNo,
          shiftId: shiftId || null,
          outletId: "OUTLET-MAIN",
          orderType,
          tableNumber: tableNumber || null,
          customerName: customerName || null,
          status,
          kitchenStatus: "QUEUED",
          subtotal: Math.round(Number(subtotal) || 0),
          discountPercent: Number(discountPercent) || 0,
          discountAmount: Math.round(Number(discountAmount) || 0),
          discountReason: discountReason || null,
          taxPercent: Number(taxPercent) || 0,
          taxAmount: Math.round(Number(taxAmount) || 0),
          taxMode: taxMode || "EXCLUSIVE",
          totalAmount: Math.round(Number(totalAmount) || 0),
          notes: notes || null,
          idempotencyKey: idempotencyKey || null,
          cashierId: cashierId || null,
          cashierName: cashierName || null,
          createdAt: nowIso,
          updatedAt: nowIso,
          paidAt: status === "PAID" ? nowIso : null,
          appliedPromotionId: appliedPromotionId || null,
          appliedPromotionName: appliedPromotionName || null,
        };
        offlineState.orders.push(newOrder);

        const insertedItems = [];
        for (const item of items) {
          const newItem = {
            id: crypto.randomUUID(),
            orderId,
            menuName: item.menuName,
            recipeId: item.recipeId || null,
            variantName: item.variantName || null,
            quantity: Number(item.quantity) || 1,
            unitPrice: Math.round(Number(item.unitPrice) || 0),
            subtotal: Math.round(Number(item.subtotal) || 0),
            modifiers: item.modifiers || [],
            notes: item.notes || null,
            printDestination: item.printDestination || "BAR",
            isPrinted: false,
            itemStatus: "QUEUED",
            createdAt: nowIso,
          };
          offlineState.order_items.push(newItem);
          insertedItems.push(newItem);
        }

        const insertedPayments = [];
        if (status === "PAID" && payment) {
          const payMethod = payment.paymentMethod || "CASH";
          const targetAccId = resolveOfflinePaymentAccount(payMethod, payment.cashAccountId, shiftId);
          const newPayment = {
            id: crypto.randomUUID(),
            orderId,
            shiftId: shiftId || null,
            paymentMethod: payMethod,
            amount: Math.round(Number(payment.amount) || Number(totalAmount) || 0),
            cashReceived: payment.cashReceived != null ? Math.round(Number(payment.cashReceived)) : null,
            changeAmount: payment.changeAmount != null ? Math.round(Number(payment.changeAmount)) : null,
            referenceNo: payment.referenceNo || null,
            cashAccountId: targetAccId,
            createdAt: nowIso,
          };
          offlineState.payments.push(newPayment);
          insertedPayments.push(newPayment);

          if (targetAccId) {
            offlineState.cash_transactions.push({
              id: crypto.randomUUID(),
              accountId: targetAccId,
              type: "CASH_IN",
              date: nowIso,
              amount: Math.round(Number(totalAmount) || 0),
              description: `Penjualan POS #${receiptNo} (${payMethod})`,
              category: "PENDAPATAN",
              referenceId: orderId,
            });
          }

          const rawOffSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
          const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale !== false;
          for (const item of items) {
            offlineState.sales_transactions.push({
              id: crypto.randomUUID(),
              date: nowIso,
              menuName: item.menuName,
              quantitySold: Number(item.quantity) || 1,
              totalPrice: Math.round(Number(item.subtotal) || 0),
              importLogId: `POS-${receiptNo}`,
              paymentMethod: payMethod,
              orderId,
            });
          }

          if (shouldAutoDeduct) {
            applyOfflineOrderStock(items, "USAGE", `POS Order #${receiptNo}`, cashierName || "Kasir", orderId, nowIso);
          }
        }

        bumpDataVersion();
        return res.status(201).json({
          order: newOrder,
          items: insertedItems,
          payments: insertedPayments,
        });
      }

      await db.transaction(async (tx) => {
        // Insert order
        await tx.insert(schema.orders).values({
          id: orderId,
          receiptNo,
          shiftId: shiftId || null,
          outletId: "OUTLET-MAIN",
          orderType,
          tableNumber: tableNumber || null,
          customerName: customerName || null,
          status,
          subtotal: Math.round(Number(subtotal) || 0),
          discountPercent: Number(discountPercent) || 0,
          discountAmount: Math.round(Number(discountAmount) || 0),
          discountReason: discountReason || null,
          taxPercent: Number(taxPercent) || 0,
          taxAmount: Math.round(Number(taxAmount) || 0),
          taxMode: taxMode || "EXCLUSIVE",
          totalAmount: Math.round(Number(totalAmount) || 0),
          notes: notes || null,
          idempotencyKey: idempotencyKey || null,
          cashierId: cashierId || null,
          cashierName: cashierName || null,
          createdAt: nowIso,
          updatedAt: nowIso,
          paidAt: status === "PAID" ? nowIso : null,
          appliedPromotionId: appliedPromotionId || null,
          appliedPromotionName: appliedPromotionName || null,
        });

        // Insert items
        for (const item of items) {
          await tx.insert(schema.orderItems).values({
            id: crypto.randomUUID(),
            orderId,
            menuName: item.menuName,
            recipeId: item.recipeId || null,
            variantName: item.variantName || null,
            quantity: Number(item.quantity) || 1,
            unitPrice: Math.round(Number(item.unitPrice) || 0),
            subtotal: Math.round(Number(item.subtotal) || 0),
            modifiers: item.modifiers || [],
            notes: item.notes || null,
            printDestination: item.printDestination || "BAR",
            isPrinted: false,
            createdAt: nowIso,
          });
        }

        // If PAID immediately (Pay-first): process payment, stock, cash in, sales transaction
        if (status === "PAID" && payment) {
          const payMethod = payment.paymentMethod || "CASH";
          const targetAccId = await resolveDbPaymentAccount(tx, payMethod, payment.cashAccountId, shiftId);
          const paymentId = crypto.randomUUID();
          await tx.insert(schema.payments).values({
            id: paymentId,
            orderId,
            shiftId: shiftId || null,
            paymentMethod: payMethod,
            amount: Math.round(Number(payment.amount) || Number(totalAmount) || 0),
            cashReceived: payment.cashReceived != null ? Math.round(Number(payment.cashReceived)) : null,
            changeAmount: payment.changeAmount != null ? Math.round(Number(payment.changeAmount)) : null,
            referenceNo: payment.referenceNo || null,
            cashAccountId: targetAccId,
            createdAt: nowIso,
          });

          if (targetAccId) {
            await tx.insert(schema.cashTransactions).values({
              id: crypto.randomUUID(),
              accountId: targetAccId,
              type: "CASH_IN",
              date: nowIso,
              amount: Math.round(Number(totalAmount) || 0),
              description: `Penjualan POS #${receiptNo} (${payMethod})`,
              category: "PENDAPATAN",
              referenceId: orderId,
            });
          }

          const currentSettings = await tx.select().from(schema.settings).limit(1);
          const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale !== false;

          for (const item of items) {
            await tx.insert(schema.salesTransactions).values({
              id: crypto.randomUUID(),
              date: nowIso,
              menuName: item.menuName,
              quantitySold: Number(item.quantity) || 1,
              totalPrice: Math.round(Number(item.subtotal) || 0),
              importLogId: `POS-${receiptNo}`,
              paymentMethod: payMethod,
              orderId,
            });
          }

          if (shouldAutoDeduct) {
            await applyDbOrderStock(tx, items, "USAGE", `POS Order #${receiptNo}`, cashierName || "Kasir", orderId, nowIso);
          }
        }
      });

      bumpDataVersion();

      const createdOrder = (
        await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1)
      )[0];
      const createdItems = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, orderId));
      const createdPayments = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.orderId, orderId));

      res.status(201).json({
        order: createdOrder,
        items: createdItems,
        payments: createdPayments,
      });
    } catch (e: any) {
      console.error("Create order error:", e);
      res.status(500).json({ error: e?.message || "Failed to create order" });
    }
  });

  // 3. Settle / Pay Open Bill
  app.post("/api/pos/orders/:id/pay", async (req, res) => {
    try {
      const orderId = req.params.id;
      const {
        paymentMethod = "CASH",
        amount,
        cashReceived,
        changeAmount,
        referenceNo,
        cashAccountId,
        shiftId,
        cashierName,
      } = req.body;

      const nowIso = new Date().toISOString();

      if (!isDbConnected && offlineState) {
        offlineState.orders = offlineState.orders || [];
        offlineState.payments = offlineState.payments || [];
        offlineState.cash_transactions = offlineState.cash_transactions || [];
        offlineState.sales_transactions = offlineState.sales_transactions || [];
        offlineState.stock_movements = offlineState.stock_movements || [];

        const currentOrder = offlineState.orders.find((o: any) => o.id === orderId);
        if (!currentOrder) {
          return res.status(404).json({ error: "Order tidak ditemukan" });
        }
        if (currentOrder.status === "PAID") {
          return res.status(400).json({ error: "Order sudah lunas" });
        }
        if (currentOrder.status === "CANCELLED" || currentOrder.status === "VOID") {
          return res.status(400).json({ error: `Order dalam status ${currentOrder.status}` });
        }

        const finalAmount = Math.round(Number(amount) || currentOrder.totalAmount || 0);
        currentOrder.status = "PAID";
        currentOrder.paidAt = nowIso;
        currentOrder.updatedAt = nowIso;

        const effectiveShiftId = shiftId || currentOrder.shiftId || null;
        const targetAccId = resolveOfflinePaymentAccount(paymentMethod, cashAccountId, effectiveShiftId);

        const newPayment = {
          id: crypto.randomUUID(),
          orderId,
          shiftId: effectiveShiftId,
          paymentMethod,
          amount: finalAmount,
          cashReceived: cashReceived != null ? Math.round(Number(cashReceived)) : null,
          changeAmount: changeAmount != null ? Math.round(Number(changeAmount)) : null,
          referenceNo: referenceNo || null,
          cashAccountId: targetAccId,
          createdAt: nowIso,
        };
        offlineState.payments.push(newPayment);

        if (targetAccId) {
          offlineState.cash_transactions.push({
            id: crypto.randomUUID(),
            accountId: targetAccId,
            type: "CASH_IN",
            date: nowIso,
            amount: finalAmount,
            description: `Pelunasan POS #${currentOrder.receiptNo} (${paymentMethod})`,
            category: "PENDAPATAN",
            referenceId: orderId,
          });
        }

        const items = (offlineState.order_items || []).filter((it: any) => it.orderId === orderId);
        const rawOffSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
        const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale !== false;
        for (const item of items) {
          offlineState.sales_transactions.push({
            id: crypto.randomUUID(),
            date: nowIso,
            menuName: item.menuName,
            quantitySold: Number(item.quantity) || 1,
            totalPrice: Math.round(Number(item.subtotal) || 0),
            importLogId: `POS-${currentOrder.receiptNo}`,
            paymentMethod,
            orderId,
          });
        }

        if (shouldAutoDeduct) {
          applyOfflineOrderStock(items, "USAGE", `Pelunasan #${currentOrder.receiptNo}`, cashierName || "Kasir", orderId, nowIso);
        }

        bumpDataVersion();
        return res.json({ success: true, order: currentOrder, payment: newPayment });
      }

      const orderList = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
      if (orderList.length === 0) {
        return res.status(404).json({ error: "Order tidak ditemukan" });
      }
      const currentOrder = orderList[0];
      if (currentOrder.status === "PAID") {
        return res.status(400).json({ error: "Order sudah lunas" });
      }
      if (currentOrder.status === "CANCELLED" || currentOrder.status === "VOID") {
        return res.status(400).json({ error: `Order dalam status ${currentOrder.status}` });
      }

      const finalAmount = Math.round(Number(amount) || currentOrder.totalAmount || 0);

      await db.transaction(async (tx) => {
        const effectiveShiftId = shiftId || currentOrder.shiftId || null;
        const targetAccId = await resolveDbPaymentAccount(tx, paymentMethod, cashAccountId, effectiveShiftId);

        // 1. Update order status
        await tx
          .update(schema.orders)
          .set({
            status: "PAID",
            paidAt: nowIso,
            updatedAt: nowIso,
          })
          .where(eq(schema.orders.id, orderId));

        // 2. Insert payment
        await tx.insert(schema.payments).values({
          id: crypto.randomUUID(),
          orderId,
          shiftId: effectiveShiftId,
          paymentMethod,
          amount: finalAmount,
          cashReceived: cashReceived != null ? Math.round(Number(cashReceived)) : null,
          changeAmount: changeAmount != null ? Math.round(Number(changeAmount)) : null,
          referenceNo: referenceNo || null,
          cashAccountId: targetAccId,
          createdAt: nowIso,
        });

        // 3. Cash in transaction
        if (targetAccId) {
          await tx.insert(schema.cashTransactions).values({
            id: crypto.randomUUID(),
            accountId: targetAccId,
            type: "CASH_IN",
            date: nowIso,
            amount: finalAmount,
            description: `Pelunasan POS #${currentOrder.receiptNo} (${paymentMethod})`,
            category: "PENDAPATAN",
            referenceId: orderId,
          });
        }

        // 4. Stock deductions and sales transactions
        const currentSettings = await tx.select().from(schema.settings).limit(1);
        const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale !== false;

        const items = await tx
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, orderId));

        for (const item of items) {
          await tx.insert(schema.salesTransactions).values({
            id: crypto.randomUUID(),
            date: nowIso,
            menuName: item.menuName,
            quantitySold: Number(item.quantity) || 1,
            totalPrice: Math.round(Number(item.subtotal) || 0),
            importLogId: `POS-${currentOrder.receiptNo}`,
            paymentMethod,
            orderId,
          });
        }

        if (shouldAutoDeduct) {
          await applyDbOrderStock(tx, items, "USAGE", `POS Order #${currentOrder.receiptNo}`, cashierName || currentOrder.cashierName || "Kasir", orderId, nowIso);
        }
      });

      bumpDataVersion();

      const updatedOrder = (
        await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1)
      )[0];
      const updatedPayments = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.orderId, orderId));

      res.json({
        order: updatedOrder,
        payments: updatedPayments,
        message: "Order berhasil dilunasi",
      });
    } catch (e: any) {
      console.error("Pay order error:", e);
      res.status(500).json({ error: e?.message || "Failed to settle order" });
    }
  });

  // 3b. Split Bill / Pecah Tagihan Meja
  app.post("/api/pos/orders/:id/split", async (req, res) => {
    try {
      const parentOrderId = req.params.id;
      const {
        splitMode = "ITEMS",
        splitItems = [],
        splitAmount = 0,
        payment,
        customerName,
        cashierName = "Kasir",
      } = req.body;

      if (!payment) {
        return res.status(400).json({ error: "Detail pembayaran split bill wajib disertakan." });
      }

      const nowIso = new Date().toISOString();
      const randomSuffix = Math.floor(100 + Math.random() * 900);

      // --- Offline State Support ---
      if (!isDbConnected && offlineState) {
        offlineState.orders = offlineState.orders || [];
        offlineState.order_items = offlineState.order_items || [];
        offlineState.payments = offlineState.payments || [];
        offlineState.cash_transactions = offlineState.cash_transactions || [];
        offlineState.sales_transactions = offlineState.sales_transactions || [];
        offlineState.stock_movements = offlineState.stock_movements || [];

        const parentOrder = offlineState.orders.find((o: any) => o.id === parentOrderId);
        if (!parentOrder) {
          return res.status(404).json({ error: "Order utama tidak ditemukan." });
        }
        if (parentOrder.status === "VOID" || parentOrder.status === "CANCELLED") {
          return res.status(400).json({ error: `Order utama berstatus ${parentOrder.status}` });
        }

        const splitOrderId = crypto.randomUUID();
        const splitReceiptNo = `${parentOrder.receiptNo}-S${randomSuffix}`;
        let splitSubtotal = 0;
        let splitTotal = 0;
        const insertedSplitItems: any[] = [];

        if (splitMode === "ITEMS") {
          const parentItems = offlineState.order_items.filter((it: any) => it.orderId === parentOrderId);
          for (const sIt of splitItems) {
            const pItem = parentItems.find((it: any) => it.id === sIt.id);
            if (!pItem) continue;
            const splitQty = Math.min(Number(sIt.quantity) || 1, Number(pItem.quantity) || 1);
            if (splitQty <= 0) continue;

            const itemSubtotal = (Number(pItem.unitPrice) || 0) * splitQty;
            splitSubtotal += itemSubtotal;

            const newSplitItem = {
              id: crypto.randomUUID(),
              orderId: splitOrderId,
              menuName: pItem.menuName,
              recipeId: pItem.recipeId || null,
              variantName: pItem.variantName || null,
              quantity: splitQty,
              unitPrice: Number(pItem.unitPrice) || 0,
              subtotal: itemSubtotal,
              modifiers: pItem.modifiers || [],
              notes: pItem.notes || null,
              printDestination: pItem.printDestination || "BAR",
              isPrinted: true,
              createdAt: nowIso,
            };
            offlineState.order_items.push(newSplitItem);
            insertedSplitItems.push(newSplitItem);

            // Deduct from parent order item
            if (pItem.quantity <= splitQty) {
              const idx = offlineState.order_items.indexOf(pItem);
              if (idx > -1) offlineState.order_items.splice(idx, 1);
            } else {
              pItem.quantity -= splitQty;
              pItem.subtotal = pItem.unitPrice * pItem.quantity;
            }
          }

          const taxRate = Number(parentOrder.taxPercent) || 0;
          let splitTax = 0;
          if (taxRate > 0) {
            splitTax = parentOrder.taxMode === "INCLUSIVE"
              ? Math.round((splitSubtotal * taxRate) / (100 + taxRate))
              : Math.round((splitSubtotal * taxRate) / 100);
          }
          splitTotal = parentOrder.taxMode === "EXCLUSIVE" ? splitSubtotal + splitTax : splitSubtotal;

          // Update parent order totals
          const remainingParentItems = offlineState.order_items.filter((it: any) => it.orderId === parentOrderId);
          if (remainingParentItems.length === 0) {
            parentOrder.status = "PAID";
            parentOrder.paidAt = nowIso;
            parentOrder.subtotal = 0;
            parentOrder.totalAmount = 0;
          } else {
            const newParentSubtotal = remainingParentItems.reduce((sum: number, it: any) => sum + (Number(it.subtotal) || 0), 0);
            let newParentTax = 0;
            if (taxRate > 0) {
              newParentTax = parentOrder.taxMode === "INCLUSIVE"
                ? Math.round((newParentSubtotal * taxRate) / (100 + taxRate))
                : Math.round((newParentSubtotal * taxRate) / 100);
            }
            parentOrder.subtotal = newParentSubtotal;
            parentOrder.taxAmount = newParentTax;
            parentOrder.totalAmount = parentOrder.taxMode === "EXCLUSIVE" ? newParentSubtotal + newParentTax : newParentSubtotal;
            parentOrder.updatedAt = nowIso;
          }
        } else {
          // EVENLY split
          splitTotal = Number(splitAmount) || Number(payment.amount) || 0;
          splitSubtotal = splitTotal;
          parentOrder.totalAmount = Math.max(0, (Number(parentOrder.totalAmount) || 0) - splitTotal);
          if (parentOrder.totalAmount <= 0) {
            parentOrder.status = "PAID";
            parentOrder.paidAt = nowIso;
          }
          parentOrder.updatedAt = nowIso;
        }

        const newSplitOrder = {
          id: splitOrderId,
          receiptNo: splitReceiptNo,
          shiftId: payment.shiftId || parentOrder.shiftId || null,
          outletId: "OUTLET-MAIN",
          orderType: parentOrder.orderType,
          tableNumber: parentOrder.tableNumber,
          customerName: customerName || `${parentOrder.customerName || "Tamu"} (Split)`,
          status: "PAID",
          subtotal: splitSubtotal,
          discountPercent: 0,
          discountAmount: 0,
          discountReason: null,
          taxPercent: parentOrder.taxPercent || 0,
          taxAmount: 0,
          taxMode: parentOrder.taxMode || "EXCLUSIVE",
          totalAmount: splitTotal,
          notes: `Split dari #${parentOrder.receiptNo}`,
          idempotencyKey: crypto.randomUUID(),
          cashierId: parentOrder.cashierId || null,
          cashierName: cashierName || parentOrder.cashierName || "Kasir",
          createdAt: nowIso,
          updatedAt: nowIso,
          paidAt: nowIso,
        };
        offlineState.orders.push(newSplitOrder);

        const splitPayMethod = payment.paymentMethod || "CASH";
        const splitShiftId = payment.shiftId || parentOrder.shiftId || null;
        const targetAccId = resolveOfflinePaymentAccount(splitPayMethod, payment.cashAccountId, splitShiftId);

        const newSplitPayment = {
          id: crypto.randomUUID(),
          orderId: splitOrderId,
          shiftId: splitShiftId,
          paymentMethod: splitPayMethod,
          amount: Math.round(splitTotal),
          cashReceived: payment.cashReceived != null ? Math.round(Number(payment.cashReceived)) : Math.round(splitTotal),
          changeAmount: payment.changeAmount != null ? Math.round(Number(payment.changeAmount)) : 0,
          referenceNo: payment.referenceNo || null,
          cashAccountId: targetAccId,
          createdAt: nowIso,
        };
        offlineState.payments.push(newSplitPayment);

        if (targetAccId) {
          offlineState.cash_transactions.push({
            id: crypto.randomUUID(),
            accountId: targetAccId,
            type: "CASH_IN",
            date: nowIso,
            amount: Math.round(splitTotal),
            description: `Split POS #${splitReceiptNo} (${splitPayMethod})`,
            category: "PENDAPATAN",
            referenceId: splitOrderId,
          });
        }

        for (const sItem of insertedSplitItems) {
          offlineState.sales_transactions.push({
            id: crypto.randomUUID(),
            date: nowIso,
            menuName: sItem.menuName,
            quantitySold: Number(sItem.quantity) || 1,
            totalPrice: Math.round(Number(sItem.subtotal) || 0),
            importLogId: `POS-${splitReceiptNo}`,
            paymentMethod: splitPayMethod,
            orderId: splitOrderId,
          });
        }

        // Deduct inventory for split items
        const rawOffSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
        const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale !== false;
        if (shouldAutoDeduct) {
          applyOfflineOrderStock(insertedSplitItems, "USAGE", `Split POS #${splitReceiptNo}`, cashierName || "Kasir", splitOrderId, nowIso);
        }

        bumpDataVersion();
        return res.json({
          success: true,
          splitOrder: newSplitOrder,
          splitItems: insertedSplitItems,
          payments: [newSplitPayment],
          parentOrder,
          remainingItemsCount: offlineState.order_items.filter((it: any) => it.orderId === parentOrderId).length,
        });
      }

      // --- PostgreSQL DB Mode ---
      const parentOrderList = await db.select().from(schema.orders).where(eq(schema.orders.id, parentOrderId)).limit(1);
      if (parentOrderList.length === 0) {
        return res.status(404).json({ error: "Order utama tidak ditemukan." });
      }
      const parentOrder = parentOrderList[0];
      if (parentOrder.status === "VOID" || parentOrder.status === "CANCELLED") {
        return res.status(400).json({ error: `Order utama berstatus ${parentOrder.status}` });
      }

      const splitOrderId = crypto.randomUUID();
      const splitReceiptNo = `${parentOrder.receiptNo}-S${randomSuffix}`;
      let splitSubtotal = 0;
      let splitTotal = 0;
      const insertedSplitItems: any[] = [];

      await db.transaction(async (tx) => {
        if (splitMode === "ITEMS") {
          const parentItems = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, parentOrderId));
          for (const sIt of splitItems) {
            const pItem = parentItems.find((it: any) => it.id === sIt.id);
            if (!pItem) continue;
            const splitQty = Math.min(Number(sIt.quantity) || 1, Number(pItem.quantity) || 1);
            if (splitQty <= 0) continue;

            const itemSubtotal = Math.round((Number(pItem.unitPrice) || 0) * splitQty);
            splitSubtotal += itemSubtotal;

            const splitItemRecord = {
              id: crypto.randomUUID(),
              orderId: splitOrderId,
              menuName: pItem.menuName,
              recipeId: pItem.recipeId || null,
              variantName: pItem.variantName || null,
              quantity: splitQty,
              unitPrice: Math.round(Number(pItem.unitPrice) || 0),
              subtotal: itemSubtotal,
              modifiers: pItem.modifiers || [],
              notes: pItem.notes || null,
              printDestination: pItem.printDestination || "BAR",
              isPrinted: true,
              createdAt: nowIso,
            };
            await tx.insert(schema.orderItems).values(splitItemRecord);
            insertedSplitItems.push(splitItemRecord);

            if (pItem.quantity <= splitQty) {
              await tx.delete(schema.orderItems).where(eq(schema.orderItems.id, pItem.id));
            } else {
              const newQty = pItem.quantity - splitQty;
              await tx.update(schema.orderItems).set({
                quantity: newQty,
                subtotal: Math.round((Number(pItem.unitPrice) || 0) * newQty),
              }).where(eq(schema.orderItems.id, pItem.id));
            }
          }

          const taxRate = Number(parentOrder.taxPercent) || 0;
          let splitTax = 0;
          if (taxRate > 0) {
            splitTax = parentOrder.taxMode === "INCLUSIVE"
              ? Math.round((splitSubtotal * taxRate) / (100 + taxRate))
              : Math.round((splitSubtotal * taxRate) / 100);
          }
          splitTotal = parentOrder.taxMode === "EXCLUSIVE" ? splitSubtotal + splitTax : splitSubtotal;

          // Update parent totals
          const remainingParentItems = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, parentOrderId));
          if (remainingParentItems.length === 0) {
            await tx.update(schema.orders).set({
              status: "PAID",
              paidAt: nowIso,
              subtotal: 0,
              totalAmount: 0,
              updatedAt: nowIso,
            }).where(eq(schema.orders.id, parentOrderId));
          } else {
            const newParentSubtotal = remainingParentItems.reduce((sum: number, it: any) => sum + (Number(it.subtotal) || 0), 0);
            let newParentTax = 0;
            if (taxRate > 0) {
              newParentTax = parentOrder.taxMode === "INCLUSIVE"
                ? Math.round((newParentSubtotal * taxRate) / (100 + taxRate))
                : Math.round((newParentSubtotal * taxRate) / 100);
            }
            const newParentTotal = parentOrder.taxMode === "EXCLUSIVE" ? newParentSubtotal + newParentTax : newParentSubtotal;
            await tx.update(schema.orders).set({
              subtotal: newParentSubtotal,
              taxAmount: newParentTax,
              totalAmount: newParentTotal,
              updatedAt: nowIso,
            }).where(eq(schema.orders.id, parentOrderId));
          }
        } else {
          // EVENLY split
          splitTotal = Math.round(Number(splitAmount) || Number(payment.amount) || 0);
          splitSubtotal = splitTotal;
          const newParentTotal = Math.max(0, Math.round(Number(parentOrder.totalAmount) || 0) - splitTotal);
          await tx.update(schema.orders).set({
            totalAmount: newParentTotal,
            status: newParentTotal <= 0 ? "PAID" : parentOrder.status,
            paidAt: newParentTotal <= 0 ? nowIso : parentOrder.paidAt,
            updatedAt: nowIso,
          }).where(eq(schema.orders.id, parentOrderId));
        }

        const splitPayMethod = payment.paymentMethod || "CASH";
        const splitShiftId = payment.shiftId || parentOrder.shiftId || null;
        const targetAccId = await resolveDbPaymentAccount(tx, splitPayMethod, payment.cashAccountId, splitShiftId);

        // Insert new completed split order
        await tx.insert(schema.orders).values({
          id: splitOrderId,
          receiptNo: splitReceiptNo,
          shiftId: splitShiftId,
          outletId: "OUTLET-MAIN",
          orderType: parentOrder.orderType,
          tableNumber: parentOrder.tableNumber,
          customerName: customerName || `${parentOrder.customerName || "Tamu"} (Split)`,
          status: "PAID",
          subtotal: splitSubtotal,
          discountPercent: 0,
          discountAmount: 0,
          discountReason: null,
          taxPercent: parentOrder.taxPercent || 0,
          taxAmount: 0,
          taxMode: parentOrder.taxMode || "EXCLUSIVE",
          totalAmount: splitTotal,
          notes: `Split dari #${parentOrder.receiptNo}`,
          idempotencyKey: crypto.randomUUID(),
          cashierId: parentOrder.cashierId || null,
          cashierName: cashierName || parentOrder.cashierName || "Kasir",
          createdAt: nowIso,
          updatedAt: nowIso,
          paidAt: nowIso,
        });

        // Insert payment
        await tx.insert(schema.payments).values({
          id: crypto.randomUUID(),
          orderId: splitOrderId,
          shiftId: splitShiftId,
          paymentMethod: splitPayMethod,
          amount: splitTotal,
          cashReceived: payment.cashReceived != null ? Math.round(Number(payment.cashReceived)) : splitTotal,
          changeAmount: payment.changeAmount != null ? Math.round(Number(payment.changeAmount)) : 0,
          referenceNo: payment.referenceNo || null,
          cashAccountId: targetAccId,
          createdAt: nowIso,
        });

        // Insert cash transaction
        if (targetAccId) {
          await tx.insert(schema.cashTransactions).values({
            id: crypto.randomUUID(),
            accountId: targetAccId,
            type: "CASH_IN",
            date: nowIso,
            amount: splitTotal,
            description: `Split POS #${splitReceiptNo} (${splitPayMethod})`,
            category: "PENDAPATAN",
            referenceId: splitOrderId,
          });
        }

        for (const sItem of insertedSplitItems) {
          await tx.insert(schema.salesTransactions).values({
            id: crypto.randomUUID(),
            date: nowIso,
            menuName: sItem.menuName,
            quantitySold: Number(sItem.quantity) || 1,
            totalPrice: Math.round(Number(sItem.subtotal) || 0),
            importLogId: `POS-${splitReceiptNo}`,
            paymentMethod: splitPayMethod,
            orderId: splitOrderId,
          });
        }

        // Deduct inventory
        const currentSettings = await tx.select().from(schema.settings).limit(1);
        const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale !== false;
        if (shouldAutoDeduct) {
          await applyDbOrderStock(tx, insertedSplitItems, "USAGE", `Split POS #${splitReceiptNo}`, cashierName || "Kasir", splitOrderId, nowIso);
        }
      });

      bumpDataVersion();

      const updatedParent = (await db.select().from(schema.orders).where(eq(schema.orders.id, parentOrderId)).limit(1))[0];
      const remainingItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, parentOrderId));
      const createdSplitOrder = (await db.select().from(schema.orders).where(eq(schema.orders.id, splitOrderId)).limit(1))[0];
      const createdSplitPayments = await db.select().from(schema.payments).where(eq(schema.payments.orderId, splitOrderId));

      res.json({
        success: true,
        splitOrder: createdSplitOrder,
        splitItems: insertedSplitItems,
        payments: createdSplitPayments,
        parentOrder: updatedParent,
        remainingItemsCount: remainingItems.length,
      });
    } catch (e: any) {
      console.error("Split order error:", e);
      res.status(500).json({ error: e?.message || "Failed to split order" });
    }
  });

  // 4. Void / Cancel Order with Manager PIN Approval
  app.post("/api/pos/orders/:id/void", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { managerPin, voidReason } = req.body;

      if (!managerPin) {
        return res.status(400).json({ error: "PIN Supervisor / Manager wajib diisi." });
      }

      const pinCheck = await verifyPosPin(managerPin, "SUPERVISOR");
      if (!pinCheck.ok) {
        return res.status(pinCheck.status).json({ error: pinCheck.error });
      }
      const approver = pinCheck.approver;

      if (!isDbConnected && offlineState) {
        offlineState.orders = offlineState.orders || [];
        offlineState.stock_movements = offlineState.stock_movements || [];
        offlineState.cash_transactions = offlineState.cash_transactions || [];
        offlineState.payments = offlineState.payments || [];
        offlineState.sales_transactions = offlineState.sales_transactions || [];
        offlineState.audit_logs = offlineState.audit_logs || [];

        const targetOrder = offlineState.orders.find((o: any) => o.id === orderId);
        if (!targetOrder) {
          return res.status(404).json({ error: "Order tidak ditemukan" });
        }
        if (targetOrder.status === "VOID" || targetOrder.status === "CANCELLED") {
          return res.status(400).json({ error: `Order sudah dalam status ${targetOrder.status}` });
        }

        const nowIso = new Date().toISOString();

        if (targetOrder.status === "PAID") {
          const items = (offlineState.order_items || []).filter((it: any) => it.orderId === orderId);
          applyOfflineOrderStock(
            items,
            "RETURN",
            `VOID Order #${targetOrder.receiptNo} (${voidReason || "Pembatalan"})`,
            approver.name,
            orderId,
            nowIso
          );

          const existingPayments = (offlineState.payments || []).filter((p: any) => p.orderId === orderId);
          for (const pay of existingPayments) {
            const accId =
              pay.cashAccountId ||
              resolveOfflinePaymentAccount(pay.method || "CASH", undefined, targetOrder.shiftId);
            offlineState.cash_transactions.push({
              id: crypto.randomUUID(),
              accountId: accId,
              type: "CASH_OUT",
              date: nowIso,
              amount: Math.round(Number(pay.amount) || 0),
              description: `VOID/Refund ${pay.method || "CASH"} POS #${targetOrder.receiptNo} (${voidReason || "Dibatalkan"})`,
              category: "PENGELUARAN",
              referenceId: orderId,
            });
          }

          // Batalkan entri rekap penjualan (sales_transactions) agar laporan penjualan tidak menghitung order yang di-VOID
          offlineState.sales_transactions = offlineState.sales_transactions.filter(
            (st: any) => st.orderId !== orderId && st.importLogId !== `POS-${targetOrder.receiptNo}`
          );

          targetOrder.status = "VOID";
          targetOrder.voidReason = voidReason || "Void oleh manager";
          targetOrder.voidApprovedBy = approver.name;
          targetOrder.updatedAt = nowIso;
        } else {
          targetOrder.status = "CANCELLED";
          targetOrder.voidReason = voidReason || "Dibatalkan kasir/manager";
          targetOrder.voidApprovedBy = approver.name;
          targetOrder.updatedAt = nowIso;
        }

        offlineState.audit_logs.push({
          id: crypto.randomUUID(),
          userId: approver.id,
          userName: approver.name,
          action: "VOID",
          tableName: "orders",
          recordId: orderId,
          timestamp: nowIso,
        });

        bumpDataVersion();

        return res.json({
          success: true,
          message: `Order #${targetOrder.receiptNo} berhasil ${targetOrder.status === "VOID" ? "di-VOID dan stok dikembalikan" : "dibatalkan"}`,
          approvedBy: approver.name,
        });
      }

      const orderList = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
      if (orderList.length === 0) {
        return res.status(404).json({ error: "Order tidak ditemukan" });
      }
      const targetOrder = orderList[0];

      if (targetOrder.status === "VOID" || targetOrder.status === "CANCELLED") {
        return res.status(400).json({ error: `Order sudah dalam status ${targetOrder.status}` });
      }

      const nowIso = new Date().toISOString();

      await db.transaction(async (tx) => {
        if (targetOrder.status === "PAID") {
          const items = await tx
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, orderId));

          await applyDbOrderStock(
            tx,
            items,
            "RETURN",
            `VOID Order #${targetOrder.receiptNo} (${voidReason || "Pembatalan"})`,
            approver.name,
            orderId,
            nowIso
          );

          const existingPayments = await tx
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.orderId, orderId));

          for (const pay of existingPayments) {
            const payMethod = pay.paymentMethod || (pay as any).method || "CASH";
            const accId =
              pay.cashAccountId ||
              (await resolveDbPaymentAccount(tx, payMethod, undefined, targetOrder.shiftId));
            await tx.insert(schema.cashTransactions).values({
              id: crypto.randomUUID(),
              accountId: accId,
              type: "CASH_OUT",
              date: nowIso,
              amount: Math.round(Number(pay.amount) || 0),
              description: `VOID/Refund ${payMethod} POS #${targetOrder.receiptNo} (${voidReason || "Dibatalkan"})`,
              category: "PENGELUARAN",
              referenceId: orderId,
            });
          }

          await tx
            .delete(schema.salesTransactions)
            .where(
              or(
                eq(schema.salesTransactions.orderId, orderId),
                eq(schema.salesTransactions.importLogId, `POS-${targetOrder.receiptNo}`)
              )
            );

          await tx
            .update(schema.orders)
            .set({
              status: "VOID",
              voidReason: voidReason || "Void oleh manager",
              voidApprovedBy: approver.name,
              updatedAt: nowIso,
            })
            .where(eq(schema.orders.id, orderId));
        } else {
          await tx
            .update(schema.orders)
            .set({
              status: "CANCELLED",
              voidReason: voidReason || "Dibatalkan kasir/manager",
              voidApprovedBy: approver.name,
              updatedAt: nowIso,
            })
            .where(eq(schema.orders.id, orderId));
        }

        await tx.insert(schema.auditLogs).values({
          id: crypto.randomUUID(),
          userId: approver.id,
          action: "VOID",
          tableName: "orders",
          recordId: orderId,
          timestamp: nowIso,
        });
      });

      bumpDataVersion();

      res.json({
        success: true,
        message: `Order #${targetOrder.receiptNo} berhasil ${targetOrder.status === "PAID" ? "di-VOID dan stok dikembalikan" : "dibatalkan"}`,
        approvedBy: approver.name,
      });
    } catch (e: any) {
      console.error("Void order error:", e);
      res.status(500).json({ error: e?.message || "Failed to void order" });
    }
  });

  // 4b. Refund Paid Order with Manager PIN Approval & Inventory Strategy
  app.post("/api/pos/orders/:id/refund", async (req, res) => {
    try {
      const orderId = req.params.id;
      const {
        managerPin,
        refundReason,
        refundMethod = "CASH",
        refundRestockOption = "RETURN_TO_STOCK",
        refundAmount: customRefundAmount,
      } = req.body;

      if (!managerPin) {
        return res.status(400).json({ error: "PIN Supervisor / Manager wajib diisi untuk otorisasi refund." });
      }

      if (!refundReason || !refundReason.trim()) {
        return res.status(400).json({ error: "Alasan refund wajib diisi untuk catatan pembukuan & audit." });
      }

      const pinCheck = await verifyPosPin(managerPin, "SUPERVISOR");
      if (!pinCheck.ok) {
        return res.status(pinCheck.status).json({ error: pinCheck.error });
      }
      const approver = pinCheck.approver;

      const nowIso = new Date().toISOString();

      if (!isDbConnected && offlineState) {
        offlineState.orders = offlineState.orders || [];
        offlineState.stock_movements = offlineState.stock_movements || [];
        offlineState.cash_transactions = offlineState.cash_transactions || [];
        offlineState.audit_logs = offlineState.audit_logs || [];

        const targetOrder = offlineState.orders.find((o: any) => o.id === orderId);
        if (!targetOrder) {
          return res.status(404).json({ error: "Order tidak ditemukan" });
        }
        if (targetOrder.status !== "PAID") {
          return res.status(400).json({ error: `Hanya pesanan berstatus LUNAS (PAID) yang dapat di-refund. Status order saat ini: ${targetOrder.status}` });
        }

        const finalRefundAmount = Math.round(
          Number(customRefundAmount) > 0 ? Number(customRefundAmount) : Number(targetOrder.totalAmount) || 0
        );

        const items = (offlineState.order_items || []).filter((it: any) => it.orderId === orderId);
        if (refundRestockOption === "RETURN_TO_STOCK") {
          applyOfflineOrderStock(
            items,
            "RETURN",
            `Refund Order #${targetOrder.receiptNo} (${refundReason.trim()})`,
            approver.name,
            orderId,
            nowIso
          );
        } else if (refundRestockOption === "WASTE") {
          applyOfflineOrderStock(
            items,
            "WASTE",
            `Kerusakan / Basi Refund #${targetOrder.receiptNo} (${refundReason.trim()})`,
            approver.name,
            orderId,
            nowIso
          );
        }

        const existingPayments = (offlineState.payments || []).filter((p: any) => p.orderId === orderId);
        const cashAccId = resolveOfflinePaymentAccount(
          refundMethod,
          existingPayments[0]?.cashAccountId,
          targetOrder.shiftId
        );
        offlineState.cash_transactions.push({
          id: crypto.randomUUID(),
          accountId: cashAccId,
          type: "CASH_OUT",
          date: nowIso,
          amount: finalRefundAmount,
          description: `Refund ${refundMethod} POS #${targetOrder.receiptNo}: ${refundReason.trim()}`,
          category: "PENGELUARAN",
          referenceId: orderId,
        });

        offlineState.audit_logs.push({
          id: crypto.randomUUID(),
          userId: approver.id,
          userName: approver.name,
          action: "REFUND",
          tableName: "orders",
          recordId: orderId,
          details: `Refund #${targetOrder.receiptNo} Rp ${finalRefundAmount.toLocaleString("id-ID")} via ${refundMethod}. Alasan: ${refundReason.trim()}. Restock: ${refundRestockOption}`,
          timestamp: nowIso,
        });

        targetOrder.status = "REFUNDED";
        targetOrder.refundReason = refundReason.trim();
        targetOrder.refundApprovedBy = approver.name;
        targetOrder.refundAmount = finalRefundAmount;
        targetOrder.refundMethod = refundMethod;
        targetOrder.refundAt = nowIso;
        targetOrder.refundRestockOption = refundRestockOption;
        targetOrder.updatedAt = nowIso;

        bumpDataVersion();

        return res.json({
          success: true,
          message: `Order #${targetOrder.receiptNo} berhasil di-refund sebesar Rp ${finalRefundAmount.toLocaleString("id-ID")}`,
          approvedBy: approver.name,
          order: targetOrder,
        });
      }

      const orderList = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
      if (orderList.length === 0) {
        return res.status(404).json({ error: "Order tidak ditemukan" });
      }
      const targetOrder = orderList[0];

      if (targetOrder.status !== "PAID") {
        return res.status(400).json({ error: `Hanya pesanan berstatus LUNAS (PAID) yang dapat di-refund. Status order saat ini: ${targetOrder.status}` });
      }

      const finalRefundAmount = Math.round(
        Number(customRefundAmount) > 0 ? Number(customRefundAmount) : Number(targetOrder.totalAmount) || 0
      );

      await db.transaction(async (tx) => {
        const items = await tx
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, orderId));

        if (refundRestockOption === "RETURN_TO_STOCK") {
          await applyDbOrderStock(
            tx,
            items,
            "RETURN",
            `Refund Order #${targetOrder.receiptNo} (${refundReason.trim()})`,
            approver.name,
            orderId,
            nowIso
          );
        } else if (refundRestockOption === "WASTE") {
          await applyDbOrderStock(
            tx,
            items,
            "WASTE",
            `Kerusakan / Basi Refund #${targetOrder.receiptNo} (${refundReason.trim()})`,
            approver.name,
            orderId,
            nowIso
          );
        }

        const existingPayments = await tx
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.orderId, orderId));

        const cashAccId = await resolveDbPaymentAccount(
          tx,
          refundMethod,
          existingPayments[0]?.cashAccountId,
          targetOrder.shiftId
        );

        await tx.insert(schema.cashTransactions).values({
          id: crypto.randomUUID(),
          accountId: cashAccId,
          type: "CASH_OUT",
          date: nowIso,
          amount: finalRefundAmount,
          description: `Refund ${refundMethod} POS #${targetOrder.receiptNo}: ${refundReason.trim()}`,
          category: "PENGELUARAN",
          referenceId: orderId,
        });

        await tx
          .update(schema.orders)
          .set({
            status: "REFUNDED",
            refundReason: refundReason.trim(),
            refundApprovedBy: approver.name,
            refundAmount: finalRefundAmount,
            refundMethod,
            refundAt: nowIso,
            refundRestockOption,
            updatedAt: nowIso,
          })
          .where(eq(schema.orders.id, orderId));

        await tx.insert(schema.auditLogs).values({
          id: crypto.randomUUID(),
          userId: approver.id,
          action: "REFUND",
          tableName: "orders",
          recordId: orderId,
          timestamp: nowIso,
        });
      });

      bumpDataVersion();

      res.json({
        success: true,
        message: `Order #${targetOrder.receiptNo} berhasil di-refund sebesar Rp ${finalRefundAmount.toLocaleString("id-ID")}`,
        approvedBy: approver.name,
      });
    } catch (e: any) {
      console.error("Refund order error:", e);
      res.status(500).json({ error: e?.message || "Failed to refund order" });
    }
  });

  // 4c. Remote In-App Approval: Kasir Request Otorisasi ke HP/Dashboard Manager
  app.post("/api/pos/approvals/request", async (req, res) => {
    try {
      const {
        orderId,
        receiptNo,
        type = "REFUND",
        amount = 0,
        reason,
        cashierName = "Kasir",
        tableNumber = "-",
        customerName = "Tamu",
        refundMethod = "CASH",
        refundRestockOption = "RETURN_TO_STOCK",
      } = req.body;

      if (!orderId || !reason || !reason.trim()) {
        return res.status(400).json({ error: "Order ID dan alasan wajib disertakan." });
      }

      const nowIso = new Date().toISOString();
      const requestId = crypto.randomUUID();

      const newRequest = {
        id: requestId,
        orderId,
        receiptNo,
        type,
        amount: Number(amount) || 0,
        reason: reason.trim(),
        cashierName,
        tableNumber,
        customerName,
        refundMethod,
        refundRestockOption,
        status: "PENDING",
        requestedAt: nowIso,
        respondedAt: null,
        respondedBy: null,
        responseNote: null,
      };

      if (!isDbConnected && offlineState) {
        offlineState.manager_approval_requests = offlineState.manager_approval_requests || [];
        offlineState.manager_approval_requests.unshift(newRequest);
        bumpDataVersion();
        return res.json({ success: true, request: newRequest });
      }

      await db.insert(schema.managerApprovalRequests).values(newRequest);
      bumpDataVersion();
      res.json({ success: true, request: newRequest });
    } catch (e: any) {
      console.error("Create approval request error:", e);
      res.status(500).json({ error: e?.message || "Failed to create approval request" });
    }
  });

  // 4d. Remote In-App Approval: Get Pending Requests (Untuk Dashboard Manager)
  app.get("/api/pos/approvals/pending", async (req, res) => {
    try {
      if (!isDbConnected && offlineState) {
        const list = (offlineState.manager_approval_requests || [])
          .filter((r: any) => r.status === "PENDING")
          .sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        return res.json(list);
      }

      const list = await db
        .select()
        .from(schema.managerApprovalRequests)
        .where(eq(schema.managerApprovalRequests.status, "PENDING"))
        .orderBy(desc(schema.managerApprovalRequests.requestedAt));

      res.json(list);
    } catch (e: any) {
      console.error("Get pending approvals error:", e);
      res.status(500).json({ error: e?.message || "Failed to get pending approvals" });
    }
  });

  // 4e. Remote In-App Approval: Get Single Request Status (Polling Kasir)
  app.get("/api/pos/approvals/:id/status", async (req, res) => {
    try {
      const { id } = req.params;

      if (!isDbConnected && offlineState) {
        const reqItem = (offlineState.manager_approval_requests || []).find((r: any) => r.id === id);
        if (!reqItem) return res.status(404).json({ error: "Permintaan otorisasi tidak ditemukan" });
        return res.json(reqItem);
      }

      const list = await db
        .select()
        .from(schema.managerApprovalRequests)
        .where(eq(schema.managerApprovalRequests.id, id))
        .limit(1);

      if (list.length === 0) {
        return res.status(404).json({ error: "Permintaan otorisasi tidak ditemukan" });
      }

      res.json(list[0]);
    } catch (e: any) {
      console.error("Get approval status error:", e);
      res.status(500).json({ error: e?.message || "Failed to get approval status" });
    }
  });

  // 4f. Remote In-App Approval: Get Approval History (Untuk Audit Log Dashboard)
  app.get("/api/pos/approvals/history", async (req, res) => {
    try {
      if (!isDbConnected && offlineState) {
        const history = (offlineState.manager_approval_requests || [])
          .filter((r: any) => r.status !== "PENDING")
          .sort((a: any, b: any) => new Date(b.respondedAt || b.requestedAt).getTime() - new Date(a.respondedAt || a.requestedAt).getTime())
          .slice(0, 30);
        return res.json(history);
      }

      const history = await db
        .select()
        .from(schema.managerApprovalRequests)
        .where(ne(schema.managerApprovalRequests.status, "PENDING"))
        .orderBy(desc(schema.managerApprovalRequests.requestedAt))
        .limit(30);

      res.json(history);
    } catch (e: any) {
      console.error("Get approval history error:", e);
      res.status(500).json({ error: e?.message || "Failed to get approval history" });
    }
  });

  // 4g. Remote In-App Approval: Manager Respond (APPROVE / REJECT)
  app.post("/api/pos/approvals/:id/respond", async (req, res) => {
    try {
      const { id } = req.params;
      let { action, responseNote = "" } = req.body;

      // Wajib memiliki sesi autentikasi aktif (tanpa token -> 401 Unauthorized)
      const authUser = await resolveAuthUser(req);
      if (!authUser) {
        return res.status(401).json({
          error: "Unauthorized: Sesi login diperlukan untuk merespons permintaan otorisasi.",
        });
      }

      if (authUser.role === "OWNER") {
        return res.status(403).json({
          error: "Forbidden: Akun Owner berstatus Read-Only (Pengawasan). Persetujuan otorisasi operasional adalah wewenang Manager.",
        });
      }

      if (authUser.role !== "MANAGER" && authUser.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          error: "Forbidden: Hanya Manager atau Super Admin yang berwenang memberikan otorisasi kasir.",
        });
      }

      const managerName = authUser.name || "Manager";

      if (action !== "APPROVE" && action !== "REJECT") {
        return res.status(400).json({ error: "Action harus APPROVE atau REJECT" });
      }

      const nowIso = new Date().toISOString();

      if (!isDbConnected && offlineState) {
        offlineState.stock_movements = offlineState.stock_movements || [];
        offlineState.cash_transactions = offlineState.cash_transactions || [];
        offlineState.sales_transactions = offlineState.sales_transactions || [];
        offlineState.audit_logs = offlineState.audit_logs || [];

        const reqItem = (offlineState.manager_approval_requests || []).find((r: any) => r.id === id);
        if (!reqItem) return res.status(404).json({ error: "Permintaan otorisasi tidak ditemukan" });
        if (reqItem.status !== "PENDING") {
          return res.status(400).json({ error: `Permintaan sudah diproses sebelumnya (${reqItem.status})` });
        }

        if (action === "REJECT") {
          reqItem.status = "REJECTED";
          reqItem.respondedAt = nowIso;
          reqItem.respondedBy = managerName;
          reqItem.responseNote = responseNote;
          bumpDataVersion();
          return res.json({ success: true, status: "REJECTED", message: "Permintaan ditolak" });
        }

        // Action is APPROVE -> Execute Refund / Void
        reqItem.status = "APPROVED";
        reqItem.respondedAt = nowIso;
        reqItem.respondedBy = managerName;
        reqItem.responseNote = responseNote;

        const targetOrder = (offlineState.orders || []).find((o: any) => o.id === reqItem.orderId);
        if (targetOrder) {
          const items = (offlineState.order_items || []).filter((it: any) => it.orderId === targetOrder.id);

          if (reqItem.type === "REFUND") {
            const finalRefundAmount = Math.round(
              Number(reqItem.amount) || Number(targetOrder.totalAmount) || 0
            );
            if (reqItem.refundRestockOption === "RETURN_TO_STOCK") {
              applyOfflineOrderStock(
                items,
                "RETURN",
                `Remote Refund #${targetOrder.receiptNo} (${reqItem.reason})`,
                managerName,
                targetOrder.id,
                nowIso
              );
            } else if (reqItem.refundRestockOption === "WASTE") {
              applyOfflineOrderStock(
                items,
                "WASTE",
                `Kerusakan Remote Refund #${targetOrder.receiptNo} (${reqItem.reason})`,
                managerName,
                targetOrder.id,
                nowIso
              );
            }

            const existingPayments = (offlineState.payments || []).filter((p: any) => p.orderId === targetOrder.id);
            const cashAccId = resolveOfflinePaymentAccount(
              reqItem.refundMethod || "CASH",
              existingPayments[0]?.cashAccountId,
              targetOrder.shiftId
            );
            offlineState.cash_transactions.push({
              id: crypto.randomUUID(),
              accountId: cashAccId,
              type: "CASH_OUT",
              date: nowIso,
              amount: finalRefundAmount,
              description: `Remote Refund ${reqItem.refundMethod || "CASH"} POS #${targetOrder.receiptNo}: ${reqItem.reason}`,
              category: "PENGELUARAN",
              referenceId: targetOrder.id,
            });

            targetOrder.status = "REFUNDED";
            targetOrder.refundReason = reqItem.reason;
            targetOrder.refundApprovedBy = managerName;
            targetOrder.refundAmount = finalRefundAmount;
            targetOrder.refundMethod = reqItem.refundMethod || "CASH";
            targetOrder.refundRestockOption = reqItem.refundRestockOption;
            targetOrder.refundAt = nowIso;
            targetOrder.updatedAt = nowIso;
          } else if (reqItem.type === "VOID") {
            if (targetOrder.status === "PAID") {
              applyOfflineOrderStock(
                items,
                "RETURN",
                `Remote VOID #${targetOrder.receiptNo} (${reqItem.reason})`,
                managerName,
                targetOrder.id,
                nowIso
              );
              const existingPayments = (offlineState.payments || []).filter((p: any) => p.orderId === targetOrder.id);
              for (const pay of existingPayments) {
                const accId =
                  pay.cashAccountId ||
                  resolveOfflinePaymentAccount(pay.method || "CASH", undefined, targetOrder.shiftId);
                offlineState.cash_transactions.push({
                  id: crypto.randomUUID(),
                  accountId: accId,
                  type: "CASH_OUT",
                  date: nowIso,
                  amount: Math.round(Number(pay.amount) || 0),
                  description: `Remote VOID/Refund ${pay.method || "CASH"} POS #${targetOrder.receiptNo}: ${reqItem.reason}`,
                  category: "PENGELUARAN",
                  referenceId: targetOrder.id,
                });
              }
              offlineState.sales_transactions = offlineState.sales_transactions.filter(
                (st: any) => st.orderId !== targetOrder.id && st.importLogId !== `POS-${targetOrder.receiptNo}`
              );
              targetOrder.status = "VOID";
            } else {
              targetOrder.status = "CANCELLED";
            }
            targetOrder.voidReason = reqItem.reason;
            targetOrder.voidApprovedBy = managerName;
            targetOrder.updatedAt = nowIso;
          }

          offlineState.audit_logs.push({
            id: crypto.randomUUID(),
            userId: authUser.id,
            userName: managerName,
            action: reqItem.type,
            tableName: "orders",
            recordId: targetOrder.id,
            timestamp: nowIso,
          });
        }

        bumpDataVersion();
        return res.json({ success: true, status: "APPROVED", message: `Permintaan ${reqItem.type} berhasil disetujui` });
      }

      // DB Connected mode
      const reqList = await db
        .select()
        .from(schema.managerApprovalRequests)
        .where(eq(schema.managerApprovalRequests.id, id))
        .limit(1);

      if (reqList.length === 0) {
        return res.status(404).json({ error: "Permintaan otorisasi tidak ditemukan" });
      }

      const reqItem = reqList[0];
      if (reqItem.status !== "PENDING") {
        return res.status(400).json({ error: `Permintaan sudah diproses sebelumnya (${reqItem.status})` });
      }

      if (action === "REJECT") {
        await db
          .update(schema.managerApprovalRequests)
          .set({
            status: "REJECTED",
            respondedAt: nowIso,
            respondedBy: managerName,
            responseNote: responseNote,
          })
          .where(eq(schema.managerApprovalRequests.id, id));

        bumpDataVersion();
        return res.json({ success: true, status: "REJECTED", message: "Permintaan ditolak" });
      }

      // Action is APPROVE
      await db.transaction(async (tx) => {
        const orderList = await tx.select().from(schema.orders).where(eq(schema.orders.id, reqItem.orderId)).limit(1);
        if (orderList.length > 0) {
          const targetOrder = orderList[0];
          const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, targetOrder.id));

          if (reqItem.type === "REFUND") {
            const finalRefundAmount = Math.round(
              Number(reqItem.amount) || Number(targetOrder.totalAmount) || 0
            );

            if (reqItem.refundRestockOption === "RETURN_TO_STOCK") {
              await applyDbOrderStock(
                tx,
                items,
                "RETURN",
                `Remote Refund #${targetOrder.receiptNo} (${reqItem.reason})`,
                managerName,
                targetOrder.id,
                nowIso
              );
            } else if (reqItem.refundRestockOption === "WASTE") {
              await applyDbOrderStock(
                tx,
                items,
                "WASTE",
                `Kerusakan Remote Refund #${targetOrder.receiptNo} (${reqItem.reason})`,
                managerName,
                targetOrder.id,
                nowIso
              );
            }

            const existingPayments = await tx.select().from(schema.payments).where(eq(schema.payments.orderId, targetOrder.id));
            const cashAccId = await resolveDbPaymentAccount(
              tx,
              reqItem.refundMethod || "CASH",
              existingPayments[0]?.cashAccountId,
              targetOrder.shiftId
            );

            await tx.insert(schema.cashTransactions).values({
              id: crypto.randomUUID(),
              accountId: cashAccId,
              type: "CASH_OUT",
              date: nowIso,
              amount: finalRefundAmount,
              description: `Remote Refund ${reqItem.refundMethod || "CASH"} POS #${targetOrder.receiptNo}: ${reqItem.reason}`,
              category: "PENGELUARAN",
              referenceId: targetOrder.id,
            });

            await tx
              .update(schema.orders)
              .set({
                status: "REFUNDED",
                refundReason: reqItem.reason,
                refundApprovedBy: managerName,
                refundAmount: finalRefundAmount,
                refundMethod: reqItem.refundMethod || "CASH",
                refundAt: nowIso,
                refundRestockOption: reqItem.refundRestockOption,
                updatedAt: nowIso,
              })
              .where(eq(schema.orders.id, targetOrder.id));

            await tx.insert(schema.auditLogs).values({
              id: crypto.randomUUID(),
              userId: authUser.id,
              action: "REFUND",
              tableName: "orders",
              recordId: targetOrder.id,
              timestamp: nowIso,
            });
          } else if (reqItem.type === "VOID") {
            if (targetOrder.status === "PAID") {
              await applyDbOrderStock(
                tx,
                items,
                "RETURN",
                `Remote VOID #${targetOrder.receiptNo} (${reqItem.reason})`,
                managerName,
                targetOrder.id,
                nowIso
              );

              const existingPayments = await tx.select().from(schema.payments).where(eq(schema.payments.orderId, targetOrder.id));
              for (const pay of existingPayments) {
                const payMethod = pay.paymentMethod || (pay as any).method || "CASH";
                const accId =
                  pay.cashAccountId ||
                  (await resolveDbPaymentAccount(tx, payMethod, undefined, targetOrder.shiftId));
                await tx.insert(schema.cashTransactions).values({
                  id: crypto.randomUUID(),
                  accountId: accId,
                  type: "CASH_OUT",
                  date: nowIso,
                  amount: Math.round(Number(pay.amount) || 0),
                  description: `Remote VOID/Refund ${payMethod} POS #${targetOrder.receiptNo}: ${reqItem.reason}`,
                  category: "PENGELUARAN",
                  referenceId: targetOrder.id,
                });
              }

              await tx
                .delete(schema.salesTransactions)
                .where(
                  or(
                    eq(schema.salesTransactions.orderId, targetOrder.id),
                    eq(schema.salesTransactions.importLogId, `POS-${targetOrder.receiptNo}`)
                  )
                );

              await tx
                .update(schema.orders)
                .set({
                  status: "VOID",
                  voidReason: reqItem.reason,
                  voidApprovedBy: managerName,
                  updatedAt: nowIso,
                })
                .where(eq(schema.orders.id, targetOrder.id));
            } else {
              await tx
                .update(schema.orders)
                .set({
                  status: "CANCELLED",
                  voidReason: reqItem.reason,
                  voidApprovedBy: managerName,
                  updatedAt: nowIso,
                })
                .where(eq(schema.orders.id, targetOrder.id));
            }

            await tx.insert(schema.auditLogs).values({
              id: crypto.randomUUID(),
              userId: authUser.id,
              action: "VOID",
              tableName: "orders",
              recordId: targetOrder.id,
              timestamp: nowIso,
            });
          }
        }

        await tx
          .update(schema.managerApprovalRequests)
          .set({
            status: "APPROVED",
            respondedAt: nowIso,
            respondedBy: managerName,
            responseNote: responseNote,
          })
          .where(eq(schema.managerApprovalRequests.id, id));
      });

      bumpDataVersion();

      res.json({
        success: true,
        status: "APPROVED",
        message: `Permintaan ${reqItem.type} #${reqItem.receiptNo} berhasil disetujui`,
      });
    } catch (e: any) {
      console.error("Respond approval error:", e);
      res.status(500).json({ error: e?.message || "Failed to respond to approval" });
    }
  });

  // 5. Get Active Open Bills
  app.get("/api/pos/orders/active", async (req, res) => {
    try {
      if (!isDbConnected && offlineState) {
        const activeOrders = (offlineState.orders || [])
          .filter((o: any) => o.status === "OPEN")
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const ordersWithItems = activeOrders.map((ord: any) => {
          const items = (offlineState.order_items || []).filter((it: any) => it.orderId === ord.id);
          return { ...ord, items };
        });

        return res.json(ordersWithItems);
      }

      const activeOrders = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.status, "OPEN"))
        .orderBy(desc(schema.orders.createdAt));

      const ordersWithItems = await Promise.all(
        activeOrders.map(async (ord) => {
          const items = await db
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, ord.id));
          return { ...ord, items };
        })
      );

      res.json(ordersWithItems);
    } catch (e: any) {
      console.error("Fetch active orders error:", e);
      res.status(500).json({ error: e?.message || "Failed to fetch active orders" });
    }
  });

  // 6. Get POS Orders Today / History Summary (MUST be before /:id)
  app.get("/api/pos/orders/today", async (req, res) => {
    try {
      const todayLocal = getLocalDateString();
      const { startUtcIso, endUtcIso } = getLocalDayUtcBounds(todayLocal);

      if (!isDbConnected && offlineState) {
        const todayOrders = (offlineState.orders || [])
          .filter((o: any) => isTimestampOnLocalDate(o.createdAt, todayLocal))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const summary = calculateTodayOrderSummary(todayOrders);

        return res.json({
          date: todayLocal,
          ...summary,
          orders: todayOrders,
        });
      }

      const todayOrders = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            gte(schema.orders.createdAt, startUtcIso),
            lte(schema.orders.createdAt, endUtcIso)
          )
        )
        .orderBy(desc(schema.orders.createdAt));

      const summary = calculateTodayOrderSummary(todayOrders);

      res.json({
        date: todayLocal,
        ...summary,
        orders: todayOrders,
      });
    } catch (e: any) {
      console.error("Fetch today orders error:", e);
      res.status(500).json({ error: e?.message || "Failed to fetch today orders" });
    }
  });

  // 6b. Get All POS Orders with Filters (MUST be before /:id)
  app.get("/api/pos/orders/all", async (req, res) => {
    try {
      const { startDate, endDate, status } = req.query as {
        startDate?: string;
        endDate?: string;
        status?: string;
      };

      const getOrderLocalDate = (createdAt?: string | null) => {
        if (!createdAt) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) return createdAt;
        const parsed = new Date(createdAt);
        return Number.isNaN(parsed.getTime()) ? createdAt.slice(0, 10) : getLocalDateString(parsed);
      };

      if (!isDbConnected && offlineState) {
        const allOrders = (offlineState.orders || [])
          .slice()
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const filteredOrders = allOrders.filter((ord: any) => {
          const ordDate = getOrderLocalDate(ord.createdAt);
          if (startDate && ordDate && ordDate < startDate) return false;
          if (endDate && ordDate && ordDate > endDate) return false;
          if (status && status !== "ALL" && ord.status !== status) return false;
          return true;
        });

        const ordersWithDetails = filteredOrders.slice(0, 200).map((ord: any) => {
          const items = (offlineState.order_items || []).filter((it: any) => it.orderId === ord.id);
          const payments = (offlineState.payments || []).filter((p: any) => p.orderId === ord.id);
          return { ...ord, items, payments };
        });

        const summary = calculateTodayOrderSummary(filteredOrders);
        let totalTax = 0;
        let totalDiscount = 0;

        for (const ord of filteredOrders) {
          if (ord.status === "PAID") {
            totalTax += Number(ord.taxAmount) || 0;
            totalDiscount += Number(ord.discountAmount) || 0;
          }
        }

        return res.json({
          orders: ordersWithDetails,
          totalCount: filteredOrders.length,
          paidCount: summary.paidCount,
          totalRevenue: summary.totalRevenue,
          refundTotal: summary.refundTotal,
          netRevenue: summary.netRevenue,
          totalTax,
          totalDiscount,
        });
      }

      const allOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));

      const filteredOrders = allOrders.filter((ord) => {
        const ordDate = getOrderLocalDate(ord.createdAt);
        if (startDate && ordDate && ordDate < startDate) return false;
        if (endDate && ordDate && ordDate > endDate) return false;
        if (status && status !== "ALL" && ord.status !== status) return false;
        return true;
      });

      const ordersWithDetails = await Promise.all(
        filteredOrders.slice(0, 200).map(async (ord) => {
          const items = await db
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, ord.id));
          const payments = await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.orderId, ord.id));
          return { ...ord, items, payments };
        })
      );

      const summary = calculateTodayOrderSummary(filteredOrders);
      let totalTax = 0;
      let totalDiscount = 0;

      for (const ord of filteredOrders) {
        if (ord.status === "PAID") {
          totalTax += Number(ord.taxAmount) || 0;
          totalDiscount += Number(ord.discountAmount) || 0;
        }
      }

      res.json({
        orders: ordersWithDetails,
        totalCount: filteredOrders.length,
        paidCount: summary.paidCount,
        totalRevenue: summary.totalRevenue,
        refundTotal: summary.refundTotal,
        netRevenue: summary.netRevenue,
        totalTax,
        totalDiscount,
      });
    } catch (e: any) {
      console.error("Fetch all POS orders error:", e);
      res.status(500).json({ error: e?.message || "Failed to fetch all orders" });
    }
  });

  // 7. Get Order Details by ID (for receipt reprint or detail view)
  app.get("/api/pos/orders/:id", async (req, res) => {
    try {
      if (!isDbConnected && offlineState) {
        const ord = (offlineState.orders || []).find((o: any) => o.id === req.params.id);
        if (!ord) {
          return res.status(404).json({ error: "Order tidak ditemukan" });
        }
        const items = (offlineState.order_items || []).filter((it: any) => it.orderId === req.params.id);
        const payments = (offlineState.payments || []).filter((p: any) => p.orderId === req.params.id);
        return res.json({ order: ord, items, payments });
      }

      const orderList = await db.select().from(schema.orders).where(eq(schema.orders.id, req.params.id)).limit(1);
      if (orderList.length === 0) {
        return res.status(404).json({ error: "Order tidak ditemukan" });
      }
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, req.params.id));
      const payments = await db.select().from(schema.payments).where(eq(schema.payments.orderId, req.params.id));
      res.json({ order: orderList[0], items, payments });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to fetch order details" });
    }
  });

  // 8. POS Printers Configuration API
  app.get("/api/pos/printers", async (req, res) => {
    try {
      if (!isDbConnected && offlineState) {
        return res.json(offlineState.pos_printers || []);
      }
      const printers = await db.select().from(schema.posPrinters);
      res.json(printers);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to fetch printers" });
    }
  });

  app.post("/api/pos/printers", async (req, res) => {
    try {
      const {
        id = crypto.randomUUID(),
        name,
        connectionType = "LAN",
        targetStation = "BAR",
        ipAddress,
        port = 9100,
        macAddress,
        paperWidth = "80mm",
        isActive = true,
      } = req.body;

      if (!isDbConnected && offlineState) {
        offlineState.pos_printers = offlineState.pos_printers || [];
        const existingIdx = offlineState.pos_printers.findIndex((p: any) => p.id === id);
        const printerRecord = {
          id,
          name,
          connectionType,
          targetStation,
          ipAddress: ipAddress || null,
          port: Number(port) || 9100,
          macAddress: macAddress || null,
          paperWidth,
          isActive: Boolean(isActive),
          createdAt:
            existingIdx >= 0 ? offlineState.pos_printers[existingIdx].createdAt : new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          offlineState.pos_printers[existingIdx] = printerRecord;
        } else {
          offlineState.pos_printers.push(printerRecord);
        }
        bumpDataVersion();
        return res.json({ success: true, message: "Printer configuration saved", printer: printerRecord });
      }

      const existing = await db.select().from(schema.posPrinters).where(eq(schema.posPrinters.id, id)).limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.posPrinters)
          .set({
            name,
            connectionType,
            targetStation,
            ipAddress: ipAddress || null,
            port: Number(port) || 9100,
            macAddress: macAddress || null,
            paperWidth,
            isActive: Boolean(isActive),
          })
          .where(eq(schema.posPrinters.id, id));
      } else {
        await db.insert(schema.posPrinters).values({
          id,
          name,
          connectionType,
          targetStation,
          ipAddress: ipAddress || null,
          port: Number(port) || 9100,
          macAddress: macAddress || null,
          paperWidth,
          isActive: Boolean(isActive),
          createdAt: new Date().toISOString(),
        });
      }

      bumpDataVersion();
      res.json({ success: true, message: "Printer configuration saved" });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to save printer" });
    }
  });

  // ─── Kitchen Display System (KDS) API ──────────────────────────────────────

  // 1. Get Active Kitchen & Bar Tickets
  app.get("/api/kds/tickets", async (req, res) => {
    try {
      const station = (req.query.station as string) || "ALL";

      if (!isDbConnected && offlineState) {
        const activeOrders = (offlineState.orders || [])
          .filter(
            (ord: any) =>
              (ord.status === "PAID" || ord.status === "OPEN") &&
              ord.kitchenStatus !== "SERVED" &&
              ord.status !== "VOID" &&
              ord.status !== "CANCELLED"
          )
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const tickets = activeOrders
          .map((ord: any) => {
            let items = (offlineState.order_items || []).filter((it: any) => it.orderId === ord.id);
            if (station !== "ALL") {
              items = items.filter((it: any) => it.printDestination === station);
            }
            return {
              id: ord.id,
              receiptNo: ord.receiptNo,
              orderType: ord.orderType,
              tableNumber: ord.tableNumber,
              customerName: ord.customerName,
              status: ord.status,
              kitchenStatus: ord.kitchenStatus || "QUEUED",
              createdAt: ord.createdAt,
              notes: ord.notes,
              items,
            };
          })
          .filter((t: any) => t.items.length > 0);

        return res.json(tickets);
      }

      const activeOrders = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            or(eq(schema.orders.status, "PAID"), eq(schema.orders.status, "OPEN")),
            not(eq(schema.orders.kitchenStatus, "SERVED")),
            not(eq(schema.orders.status, "VOID")),
            not(eq(schema.orders.status, "CANCELLED"))
          )
        )
        .orderBy(schema.orders.createdAt);

      const tickets = await Promise.all(
        activeOrders.map(async (ord) => {
          let items = await db
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, ord.id));

          if (station !== "ALL") {
            items = items.filter((it) => it.printDestination === station);
          }

          return {
            id: ord.id,
            receiptNo: ord.receiptNo,
            orderType: ord.orderType,
            tableNumber: ord.tableNumber,
            customerName: ord.customerName,
            status: ord.status,
            kitchenStatus: ord.kitchenStatus,
            createdAt: ord.createdAt,
            notes: ord.notes,
            items,
          };
        })
      );

      const validTickets = tickets.filter((t) => t.items.length > 0);
      res.json(validTickets);
    } catch (e: any) {
      console.error("Fetch KDS tickets error:", e);
      res.status(500).json({ error: e?.message || "Failed to fetch KDS tickets" });
    }
  });

  // 2. Update Single Order Item Status (QUEUED -> PREPARING -> READY -> SERVED)
  app.post("/api/kds/items/:id/status", async (req, res) => {
    try {
      const itemId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status wajib diisi" });
      }

      if (!isDbConnected && offlineState) {
        const item = (offlineState.order_items || []).find((it: any) => it.id === itemId);
        if (!item) {
          return res.status(404).json({ error: "Item pesanan tidak ditemukan" });
        }
        item.itemStatus = status;

        const siblingItems = (offlineState.order_items || []).filter((si: any) => si.orderId === item.orderId);
        const allReady = siblingItems.every((si: any) => si.itemStatus === "READY" || si.itemStatus === "SERVED");
        const allServed = siblingItems.every((si: any) => si.itemStatus === "SERVED");

        const targetOrder = (offlineState.orders || []).find((o: any) => o.id === item.orderId);
        if (targetOrder) {
          if (allServed) targetOrder.kitchenStatus = "SERVED";
          else if (allReady) targetOrder.kitchenStatus = "READY";
          else if (status === "PREPARING") targetOrder.kitchenStatus = "PREPARING";
          targetOrder.updatedAt = new Date().toISOString();
        }

        bumpDataVersion();
        return res.json({ success: true, message: "Status item berhasil diperbarui" });
      }

      await db
        .update(schema.orderItems)
        .set({ itemStatus: status })
        .where(eq(schema.orderItems.id, itemId));

      const item = (await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).limit(1))[0];
      if (item) {
        const siblingItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, item.orderId));
        const allReady = siblingItems.every((si) => si.itemStatus === "READY" || si.itemStatus === "SERVED");
        const allServed = siblingItems.every((si) => si.itemStatus === "SERVED");

        if (allServed) {
          await db.update(schema.orders).set({ kitchenStatus: "SERVED" }).where(eq(schema.orders.id, item.orderId));
        } else if (allReady) {
          await db.update(schema.orders).set({ kitchenStatus: "READY" }).where(eq(schema.orders.id, item.orderId));
        } else if (status === "PREPARING") {
          await db.update(schema.orders).set({ kitchenStatus: "PREPARING" }).where(eq(schema.orders.id, item.orderId));
        }
      }

      bumpDataVersion();
      res.json({ success: true, message: "Status item berhasil diperbarui" });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to update item status" });
    }
  });

  // 3. Update Entire Order Kitchen Status
  app.post("/api/kds/orders/:id/status", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status wajib diisi" });
      }

      if (!isDbConnected && offlineState) {
        const targetOrder = (offlineState.orders || []).find((o: any) => o.id === orderId);
        if (!targetOrder) {
          return res.status(404).json({ error: "Order tidak ditemukan" });
        }
        targetOrder.kitchenStatus = status;
        targetOrder.updatedAt = new Date().toISOString();

        for (const it of offlineState.order_items || []) {
          if (it.orderId === orderId) {
            it.itemStatus = status;
          }
        }

        bumpDataVersion();
        return res.json({ success: true, message: `Status tiket diubah menjadi ${status}` });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(schema.orders)
          .set({ kitchenStatus: status })
          .where(eq(schema.orders.id, orderId));

        await tx
          .update(schema.orderItems)
          .set({ itemStatus: status })
          .where(eq(schema.orderItems.orderId, orderId));
      });

      bumpDataVersion();
      res.json({ success: true, message: `Status tiket diubah menjadi ${status}` });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to update order status" });
    }
  });

  // ─── AI Status & Test Connection API ───────────────────────────────────────
  app.get("/api/ai/status", async (req, res) => {
    try {
      let apiKey = process.env.GEMINI_API_KEY || null;
      if (isDbConnected) {
        try {
          const settings = await db.select().from(schema.settings).limit(1);
          if (settings[0]?.gemini_api_key) apiKey = settings[0].gemini_api_key;
          else if ((settings[0] as any)?.geminiApiKey) apiKey = (settings[0] as any).geminiApiKey;
        } catch { }
      } else if (offlineState) {
        const rawSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
        if (rawSt?.geminiApiKey || rawSt?.gemini_api_key) {
          apiKey = rawSt.geminiApiKey || rawSt.gemini_api_key;
        }
      }

      const isConnected = Boolean(apiKey && apiKey.trim().length > 5);
      res.json({
        isConnected,
        model: isConnected ? "gemini-2.5-flash" : "heuristic-fallback",
        source: isConnected ? (process.env.GEMINI_API_KEY ? "Environment (.env)" : "Pengaturan Sistem") : "offline",
        message: isConnected
          ? "Koneksi Google Gemini 2.5 Flash aktif dan siap memproses konsultasi, OCR nota & input cerdas."
          : "Kunci API Gemini belum terkonfigurasi. Berjalan dalam mode pintar lokal (offline fallback).",
      });
    } catch (err: any) {
      res.status(500).json({ isConnected: false, error: err?.message });
    }
  });

  app.post("/api/ai/test-key", async (req, res) => {
    try {
      const { apiKey: customKey } = req.body;
      let keyToTest = customKey;
      if (!keyToTest) {
        if (isDbConnected) {
          try {
            const settings = await db.select().from(schema.settings).limit(1);
            keyToTest = settings[0]?.gemini_api_key || (settings[0] as any)?.geminiApiKey || process.env.GEMINI_API_KEY;
          } catch {
            keyToTest = process.env.GEMINI_API_KEY;
          }
        } else if (offlineState) {
          const rawSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
          keyToTest = rawSt?.geminiApiKey || rawSt?.gemini_api_key || process.env.GEMINI_API_KEY;
        } else {
          keyToTest = process.env.GEMINI_API_KEY;
        }
      }

      if (!keyToTest || keyToTest.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: "API Key kosong atau format tidak valid.",
        });
      }

      const ai = new GoogleGenAI({ apiKey: keyToTest.trim() });
      const { response } = await generateContentWithFallback(ai, {
        model: "gemini-2.5-flash",
        contents: [{ text: "Tes koneksi. Jawab singkat: OK!" }],
      });

      return res.json({
        success: true,
        reply: response.text?.trim() || "OK!",
        message: "Koneksi ke Google Gemini AI berhasil!",
      });
    } catch (err: any) {
      console.error("Gemini test connection failed:", err);
      return res.status(400).json({
        success: false,
        error: err?.message || "Gagal menghubungi Gemini API. Periksa apakah API Key benar dan aktif.",
      });
    }
  });

  // ─── Dashboard Summary API ─────────────────────────────────────────────────
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const now = new Date();
      const currentPeriod = getLocalPeriodString(now);
      const [curYear, curMonth] = currentPeriod.split("-").map(Number);
      const prevYear = curMonth === 1 ? curYear - 1 : curYear;
      const prevMonthNum = curMonth === 1 ? 12 : curMonth - 1;
      const prevPeriod = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;
      const todayLocal = getLocalDateString(now);
      const thirtyDaysLater = getLocalDateString(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

      let transactions: any[] = [];
      let employees: any[] = [];
      let ingredients: any[] = [];
      let payrolls: any[] = [];
      let expenseCategories: any[] = [];

      if (!isDbConnected && offlineState) {
        transactions = offlineState.cash_transactions || [];
        employees = offlineState.employees || [];
        ingredients = offlineState.ingredients || [];
        payrolls = offlineState.payroll_records || [];
        expenseCategories = offlineState.expense_categories || [];
      } else {
        [transactions, employees, ingredients, payrolls, expenseCategories] = await Promise.all([
          db.select().from(schema.cashTransactions),
          db.select().from(schema.employees),
          db.select().from(schema.ingredients),
          db.select().from(schema.payrollRecords),
          db.select().from(schema.expenseCategories),
        ]);
      }

      const getTxPeriod = (rawDate?: string) => {
        if (!rawDate) return "";
        if (/^\d{4}-\d{2}(-\d{2})?$/.test(rawDate)) return rawDate.slice(0, 7);
        const d = new Date(rawDate);
        return Number.isNaN(d.getTime()) ? rawDate.slice(0, 7) : getLocalPeriodString(d);
      };

      const currentTx = transactions.filter((t) => getTxPeriod(t.date) === currentPeriod);
      const prevTx = transactions.filter((t) => getTxPeriod(t.date) === prevPeriod);

      const sumIn = (txs: any[]) => txs.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const sumOut = (txs: any[]) => txs.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const currentRevenue = sumIn(currentTx);
      const currentExpense = sumOut(currentTx);
      const prevRevenue = sumIn(prevTx);
      const prevExpense = sumOut(prevTx);

      const expenseBreakdown = expenseCategories
        .filter((c) => !c.parentId)
        .map((cat) => {
          const childIds = expenseCategories.filter((c) => c.parentId === cat.id).map((c) => c.id);
          const allIds = [cat.id, ...childIds];
          const total = currentTx
            .filter((t) => t.type === "CASH_OUT" && t.categoryId && allIds.includes(t.categoryId))
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          return { categoryId: cat.id, name: cat.name, color: cat.color, total };
        })
        .filter((b) => b.total > 0)
        .sort((a, b) => b.total - a.total);

      const lowStockCount = ingredients.filter((i) => Number(i.currentStock) <= Number(i.minStock)).length;

      const activeEmployeeCount = employees.filter((e) => e.status === "AKTIF").length;
      const expiringContracts = employees.filter(
        (e) => e.endDate && e.endDate <= thirtyDaysLater && e.endDate >= todayLocal
      ).length;

      const currentPayrolls = payrolls.filter((p) => p.period === currentPeriod);
      const payrollStatus = {
        draft: currentPayrolls.filter((p) => p.status === "DRAFT").length,
        approved: currentPayrolls.filter((p) => p.status === "APPROVED").length,
        paid: currentPayrolls.filter((p) => p.status === "PAID").length,
        total: currentPayrolls.length,
      };

      res.json({
        currentPeriod,
        revenue: { current: currentRevenue, previous: prevRevenue },
        expense: { current: currentExpense, previous: prevExpense },
        profit: { current: currentRevenue - currentExpense, previous: prevRevenue - prevExpense },
        expenseBreakdown,
        lowStockCount,
        activeEmployeeCount,
        expiringContracts,
        payrollStatus,
      });
    } catch (e) {
      console.error("Dashboard summary error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        if (filePath.includes("assets")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} at localhost and local network`);
  });
}

startServer();

