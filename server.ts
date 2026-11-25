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
import { eq, ne, not, desc, like, and, or, gte, lte, sql, inArray, notInArray } from "drizzle-orm";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getLocalDateString,
  getLocalPeriodString,
  getLocalDayUtcBounds,
  isTimestampOnLocalDate,
  DEFAULT_STORE_TIMEZONE,
} from "./src/utils/dateUtils.ts";
import {
  resolveOrderItemIngredients,
  calculateTodayOrderSummary,
  resolvePaymentAccountId,
  resolveIngredientPackagingFromText,
  matchIngredientFromStore,
  enrichParsedTransactionWithStore,
  parseSmartCoffeeTextEntry,
} from "./src/utils/posDomainLogic.ts";
import {
  recoverOrphanCashAccountsAndCategories,
  isNonOperationalCashTransaction,
  normalizeProfitSharePercentages,
} from "./src/utils/financeMetrics.ts";
import {
  sanitizeIngredientRecord,
  sanitizeEmployeeRecord,
  sanitizeEmployeeContractRecord,
  formatContractForClient,
  sanitizePayrollRecordData,
  sanitizePurchaseOrderRecord,
  sanitizeKPIRecordData,
  formatKpiRecordForClient,
  sanitizeKpiTaskRecord,
  sanitizeKpiBonusRuleRecord,
  applyRoleSyncRestrictions,
  filterVisibleSessionsForUser,
  canRevokeTargetSession,
  selectSessionsToRevokeOthers,
  resolveGeminiApiKeyForSave,
  dedupeRecipesByMenuName,
  mergeOfflinePayrollPreservingPaid,
  evaluateApiAccess,
  isValidKitchenStatus,
  evaluateSessionHeartbeat,
  evaluateGenericTableAccess,
  resolveCappedRefundAmount,
  validatePosOrderPayload,
  validateEvenlySplitAmount,
  validateApprovalRequestInput,
  mergePreservingProtectedRows,
  protectSuperAdminAccountsOnSync,
  getLocalPeriodFromTimestamp,
  protectClosedPeriodsOnSync,
  enforceClosedPeriodDataLock,
} from "./src/utils/syncSanitizers.ts";
import {
  CLEANING_CONFIRM_PHRASE,
  CORE_EXPENSE_CATEGORY_IDS,
  CLEANING_GROUP_DEFINITIONS,
  parseCleaningGroups,
  shouldAutoSeedDummyData,
  extractCleaningMetaFromSettings,
  validateClientSetupPayload,
  buildCleaningSummary,
} from "./src/utils/dataCleaning.ts";
import {
  protectCoreExpenseCategoriesOnSync,
  protectCashAccountsOnSync,
} from "./src/utils/systemGuards.ts";
import { sanitizePaymentAccountMapping } from "./src/utils/paymentRouting.ts";

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
    name: "Super Admin (IT & Sistem)",
    role: "SUPER_ADMIN",
    department: "IT & Sistem",
  },
  {
    id: "owner-1",
    username: "owner",
    pin: "123456",
    name: "Owner Julia's (Investor)",
    role: "OWNER",
    department: "Executive",
  },
  {
    id: "manager-1",
    username: "manager",
    pin: "123456",
    name: "Manager Operasional",
    role: "MANAGER",
    department: "Operasional",
  },
  {
    id: "pos-terminal-1",
    username: "kasir",
    pin: "123456",
    name: "Terminal Kasir POS",
    role: "KASIR",
    department: "Bar & Kasir",
  },
  {
    id: "leader-1",
    username: "leader",
    pin: "123456",
    name: "Rama (Leader Bar)",
    role: "LEADER",
    department: "BAR",
  },
  {
    id: "barista-1",
    username: "barista",
    pin: "123456",
    name: "Budi (Barista)",
    role: "BAR",
    department: "BAR",
  },
  {
    id: "kitchen-1",
    username: "kitchen",
    pin: "123456",
    name: "Chef Dapur",
    role: "KITCHEN",
    department: "KITCHEN",
  },
  {
    id: "baker-1",
    username: "baker",
    pin: "123456",
    name: "Pastry Baker",
    role: "BAKER",
    department: "BAKERY",
  },
  {
    id: "finance-1",
    username: "finance",
    pin: "123456",
    name: "Finance & Accounting",
    role: "FINANCE",
    department: "Finance",
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
  { id: "cat-penjualan-pastry", name: "Penjualan Pastry & Bakery", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#10B981", icon: "cake", isActive: true, sortOrder: 3 },
  { id: "cat-pendapatan-lain", name: "Pendapatan Lain", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#A7F3D0", icon: "plus-circle", isActive: true, sortOrder: 4 },
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
  // Children: Pembelian Aset
  { id: "cat-aset-mesin", name: "Mesin & Peralatan Bar/Dapur", type: "ASET", parentId: "cat-aset", color: "#A5B4FC", icon: "briefcase", isActive: true, sortOrder: 1 },
  { id: "cat-aset-furnitur", name: "Furnitur & Interior", type: "ASET", parentId: "cat-aset", color: "#A5B4FC", icon: "home", isActive: true, sortOrder: 2 },
  { id: "cat-aset-renovasi", name: "Renovasi & Inventaris", type: "ASET", parentId: "cat-aset", color: "#A5B4FC", icon: "settings", isActive: true, sortOrder: 3 },
  // Children: Lainnya
  { id: "cat-admin-bank", name: "Biaya Admin Bank & Pajak", type: "LAINNYA", parentId: "cat-lainnya", color: "#9CA3AF", icon: "shield", isActive: true, sortOrder: 1 },
  { id: "cat-lain-rupa", name: "Pengeluaran Lain-lain", type: "LAINNYA", parentId: "cat-lainnya", color: "#9CA3AF", icon: "more-horizontal", isActive: true, sortOrder: 2 },
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
        period TEXT,
        date TEXT,
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
    `CREATE TABLE IF NOT EXISTS daily_sales_recaps (
        id TEXT PRIMARY KEY,
        date VARCHAR(50) NOT NULL,
        shift VARCHAR(50) DEFAULT 'ALL',
        cash_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        qris_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        edc_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        transfer_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        online_delivery_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        refund_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        mdr_fee_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        cash_account_id VARCHAR(255),
        bank_account_id VARCHAR(255),
        qris_account_id VARCHAR(255),
        edc_account_id VARCHAR(255),
        transfer_account_id VARCHAR(255),
        online_delivery_account_id VARCHAR(255),
        non_cash_settlement_status VARCHAR(50) DEFAULT 'SETTLED',
        non_cash_settled_at VARCHAR(100),
        notes TEXT,
        recorded_by VARCHAR(255) DEFAULT '',
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
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
        quarter INTEGER NOT NULL DEFAULT 1,
        month INTEGER,
        year INTEGER NOT NULL DEFAULT 2026,
        period TEXT,
        targets JSONB NOT NULL DEFAULT '[]'::jsonb,
        total_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        kpi_bonus DOUBLE PRECISION NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        evaluated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS kpi_tasks (
        id VARCHAR(255) PRIMARY KEY,
        employee_id VARCHAR(255) NOT NULL,
        period TEXT NOT NULL,
        task_name TEXT NOT NULL,
        weight DOUBLE PRECISION NOT NULL DEFAULT 0,
        target DOUBLE PRECISION NOT NULL DEFAULT 0,
        realization DOUBLE PRECISION NOT NULL DEFAULT 0,
        score DOUBLE PRECISION NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS kpi_bonus_rules (
        id VARCHAR(255) PRIMARY KEY,
        min_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        max_score DOUBLE PRECISION NOT NULL DEFAULT 100,
        bonus_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
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
        notes TEXT,
        snapshot_json TEXT
      )`,
    `ALTER TABLE closed_periods ADD COLUMN IF NOT EXISTS snapshot_json TEXT`,
    `ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES expense_categories(id)`,
    `ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS vendor_name TEXT`,
    `ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS receipt_no TEXT`,
    `ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT`,
    `ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS items_json TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS approved_by TEXT`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS approved_at TEXT`,
    `ALTER TABLE daily_checklists ADD COLUMN IF NOT EXISTS leader_tasks TEXT DEFAULT '[]'`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS overtime_approved BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS corrected_by TEXT`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS corrected_at TEXT`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS correction_reason TEXT`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS code VARCHAR(100)`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_unit TEXT`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS conversion_factor DOUBLE PRECISION`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_price DOUBLE PRECISION`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS storage_location VARCHAR(100)`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS start_date TEXT`,
    `ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS end_date TEXT`,
    `ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE'`,
    `ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS transport_allowance DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS alpha_deduction_per_day DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS kpi_bonus_target DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS raw_position_allowance DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS leader_jobdesk_score DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS matched_leader_tier JSONB`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS transport_allowance DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS target_bonus DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_deduction DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_hours DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS late_days INTEGER DEFAULT 0`,
    `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime_approved BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_name TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS purchase_type VARCHAR(50) DEFAULT 'DISTRIBUTOR'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cash_account_id VARCHAR(255)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE stock_opnames ALTER COLUMN period DROP NOT NULL`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS quarter INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS month INTEGER`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2026`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS period TEXT`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS targets JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS total_score DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE kpi_records ADD COLUMN IF NOT EXISTS kpi_bonus DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE kpi_records ALTER COLUMN score DROP NOT NULL`,
    `ALTER TABLE kpi_records ALTER COLUMN period DROP NOT NULL`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id TEXT`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS location TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_pin_attempts INTEGER DEFAULT 0 NOT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS bulk_unit TEXT`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS bulk_conversion_factor DOUBLE PRECISION`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS bulk_price DOUBLE PRECISION`,
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
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_deduct_stock_on_sale BOOLEAN DEFAULT FALSE`,
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
        product_group TEXT,
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
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS product_group TEXT`,
    `ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH'`,
    `ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS order_id TEXT`,
    `ALTER TABLE stock_opnames ADD COLUMN IF NOT EXISTS date TEXT`,
    `ALTER TABLE stock_opname_items ADD COLUMN IF NOT EXISTS unit_cost DOUBLE PRECISION DEFAULT 0`,
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
    `ALTER TABLE manager_approval_requests ALTER COLUMN amount TYPE DOUBLE PRECISION`,
    `ALTER TABLE daily_sales_recaps ADD COLUMN IF NOT EXISTS qris_account_id VARCHAR(255)`,
    `ALTER TABLE daily_sales_recaps ADD COLUMN IF NOT EXISTS edc_account_id VARCHAR(255)`,
    `ALTER TABLE daily_sales_recaps ADD COLUMN IF NOT EXISTS transfer_account_id VARCHAR(255)`,
    `ALTER TABLE daily_sales_recaps ADD COLUMN IF NOT EXISTS online_delivery_account_id VARCHAR(255)`
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

    // Pastikan user default POS Kasir hanya dibuat pada DB yang benar-benar baru & auto-seed aktif
    const userCountRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM users`);
    const userCount = Number(userCountRes.rows?.[0]?.cnt || 0);
    const settingsRes = await pool.query(
      `SELECT division_kpi_bonus_target AS "divisionKpiBonusTarget" FROM settings LIMIT 1`
    );
    const allowInitialSeed = shouldAutoSeedDummyData(settingsRes.rows?.[0]);
    if (userCount === 0 && allowInitialSeed) {
      await pool.query(
        `INSERT INTO users (id, username, pin, name, role, department)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["pos-terminal-1", "kasir", pin123456Hash, "Terminal Kasir POS", "KASIR", "Bar & Kasir"]
      );
    }
  } catch (migErr: any) {
    // Abaikan jika tabel users belum terisi atau database offline
  }

  // Migrasi idempoten kategori inti Penjualan Pastry (cat-penjualan-pastry) pada DB yang sudah terisi
  try {
    const catCountRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM expense_categories`);
    const catCount = Number(catCountRes.rows?.[0]?.cnt || 0);
    if (catCount > 0) {
      const existingPastryCore = await pool.query(
        `SELECT id FROM expense_categories WHERE id = 'cat-penjualan-pastry' LIMIT 1`
      );
      if ((existingPastryCore.rows?.length || 0) === 0) {
        const customPastryRes = await pool.query(
          `SELECT * FROM expense_categories
           WHERE type = 'PENDAPATAN' AND id <> 'cat-pendapatan'
             AND name ~* '(pastry|bakery|roti)'
           ORDER BY sort_order ASC LIMIT 1`
        );
        const oldRow = customPastryRes.rows?.[0];
        if (oldRow) {
          await pool.query(
            `INSERT INTO expense_categories (id, name, type, parent_id, color, icon, is_active, sort_order)
             VALUES ($1, $2, 'PENDAPATAN', 'cat-pendapatan', $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [
              "cat-penjualan-pastry",
              String(oldRow.name || "Penjualan Pastry & Bakery"),
              String(oldRow.color || "#10B981"),
              String(oldRow.icon || "cake"),
              oldRow.is_active !== undefined ? Boolean(oldRow.is_active) : true,
              Number(oldRow.sort_order) || 3,
            ]
          );
          await pool.query(
            `UPDATE cash_transactions SET category_id = 'cat-penjualan-pastry' WHERE category_id = $1`,
            [oldRow.id]
          );
          await pool.query(
            `UPDATE budgets SET category_id = 'cat-penjualan-pastry' WHERE category_id = $1`,
            [oldRow.id]
          );
          await pool.query(`DELETE FROM expense_categories WHERE id = $1`, [oldRow.id]);
        } else {
          await pool.query(
            `INSERT INTO expense_categories (id, name, type, parent_id, color, icon, is_active, sort_order)
             VALUES ('cat-penjualan-pastry', 'Penjualan Pastry & Bakery', 'PENDAPATAN', 'cat-pendapatan', '#10B981', 'cake', true, 3)
             ON CONFLICT (id) DO NOTHING`
          );
        }
      }
    }
  } catch (pastryMigErr: any) {
    // Abaikan jika tabel belum tersedia pada mode offline
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
      case "daily_sales_recaps":
        return schema.dailySalesRecaps;
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
      case "kpi_tasks":
        return schema.kpiTasks;
      case "kpi_bonus_rules":
        return schema.kpiBonusRules;
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

  const sanitizeIngredient = (i: any) =>
    sanitizeIngredientRecord(i, crypto.randomUUID());

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

  const sanitizeDailySalesRecap = (r: any) => ({
    id: String(r.id || crypto.randomUUID()),
    date: String(r.date || getLocalDateString()),
    shift: String(r.shift || "ALL"),
    cashAmount: Math.round(Number(r.cashAmount) || 0),
    qrisAmount: Math.round(Number(r.qrisAmount) || 0),
    edcAmount: Math.round(Number(r.edcAmount) || 0),
    transferAmount: Math.round(Number(r.transferAmount) || 0),
    onlineDeliveryAmount: Math.round(Number(r.onlineDeliveryAmount) || 0),
    discountAmount: Math.round(Number(r.discountAmount) || 0),
    refundAmount: Math.round(Number(r.refundAmount) || 0),
    mdrFeeAmount: Math.round(Number(r.mdrFeeAmount) || 0),
    totalAmount: Math.round(Number(r.totalAmount) || 0),
    cashAccountId: r.cashAccountId ? String(r.cashAccountId) : null,
    bankAccountId: r.bankAccountId ? String(r.bankAccountId) : null,
    qrisAccountId: r.qrisAccountId ? String(r.qrisAccountId) : null,
    edcAccountId: r.edcAccountId ? String(r.edcAccountId) : null,
    transferAccountId: r.transferAccountId ? String(r.transferAccountId) : null,
    onlineDeliveryAccountId: r.onlineDeliveryAccountId ? String(r.onlineDeliveryAccountId) : null,
    nonCashSettlementStatus: r.nonCashSettlementStatus === "PENDING" ? "PENDING" : "SETTLED",
    nonCashSettledAt: r.nonCashSettledAt ? String(r.nonCashSettledAt) : null,
    notes: r.notes ? String(r.notes) : null,
    recordedBy: String(r.recordedBy || ""),
    createdAt: String(r.createdAt || new Date().toISOString()),
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
      vendorName: f.vendorName ? String(f.vendorName) : null,
      receiptNo: f.receiptNo ? String(f.receiptNo) : null,
      paymentMethod: f.paymentMethod ? String(f.paymentMethod) : null,
      itemsJson: typeof f.itemsJson === "string" && f.itemsJson.trim()
        ? f.itemsJson
        : Array.isArray(f.items) && f.items.length > 0
          ? JSON.stringify(f.items)
          : null,
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
    unitCost: Number(i.unitCost) || 0,
    notes: i.notes ? String(i.notes) : null,
  });

  const sanitizePayrollRecord = (p: any) =>
    sanitizePayrollRecordData(p, crypto.randomUUID());

  const sanitizeCashAccount = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    name: String(a.name || ""),
    type: String(a.type || "CASH"),
    isDefault: Boolean(a.isDefault),
  });

  const sanitizeClosedPeriodForDb = (cp: any) => {
    const snapJson = cp?.snapshot
      ? JSON.stringify(cp.snapshot)
      : typeof cp?.snapshotJson === "string"
        ? cp.snapshotJson
        : null;
    return {
      id: String(cp?.id || crypto.randomUUID()),
      period: String(cp?.period || ""),
      closedAt: String(cp?.closedAt || new Date().toISOString()),
      closedBy: String(cp?.closedBy || "Manager"),
      notes: cp?.notes ? String(cp.notes) : "",
      snapshotJson: snapJson,
    };
  };

  const formatClosedPeriodForClient = (cp: any) => {
    let parsedSnapshot = cp?.snapshot && typeof cp.snapshot === "object" ? cp.snapshot : null;
    const rawSnapJson = cp?.snapshotJson ?? cp?.snapshot_json ?? null;
    if (!parsedSnapshot && typeof rawSnapJson === "string" && rawSnapJson.trim()) {
      try {
        parsedSnapshot = JSON.parse(rawSnapJson);
      } catch {
        parsedSnapshot = null;
      }
    }
    return {
      id: String(cp?.id || ""),
      period: String(cp?.period || ""),
      closedAt: String(cp?.closedAt || cp?.closed_at || ""),
      closedBy: String(cp?.closedBy || cp?.closed_by || "Manager"),
      notes: cp?.notes || "",
      ...(parsedSnapshot ? { snapshot: parsedSnapshot } : {}),
      snapshotJson: typeof rawSnapJson === "string" ? rawSnapJson : parsedSnapshot ? JSON.stringify(parsedSnapshot) : null,
    };
  };

  const getActiveClosedPeriodSet = async (txOrNull?: any): Promise<Set<string>> => {
    if (!isDbConnected && offlineState) {
      return new Set(
        (offlineState.closed_periods || []).map((p: any) => String(p?.period || "").trim()).filter(Boolean)
      );
    }
    try {
      const executor = txOrNull || db;
      const rows = await executor.select().from(schema.closedPeriods);
      return new Set(rows.map((p: any) => String(p?.period || "").trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  };

  const sanitizeSettings = (
    st: any,
    existingRow?: any,
    isPrivilegedRole = true,
    isSuperAdmin = false
  ) => {
    const divTarget = typeof st?.divisionKpiBonusTarget === "object" ? { ...st.divisionKpiBonusTarget } : {};
    if (st?.leaderJobdeskAllowanceRules && Array.isArray(st.leaderJobdeskAllowanceRules)) {
      divTarget.__leaderAllowanceRules = st.leaderJobdeskAllowanceRules;
    }
    if (st?.shiftDefinitions && Array.isArray(st.shiftDefinitions)) {
      divTarget.__shiftDefinitions = st.shiftDefinitions;
    }
    if (st?.ingredientCategories && Array.isArray(st.ingredientCategories)) {
      divTarget.__ingredientCategories = st.ingredientCategories;
    }
    if (
      st?.ingredientCategoryDivisions &&
      typeof st.ingredientCategoryDivisions === "object" &&
      !Array.isArray(st.ingredientCategoryDivisions)
    ) {
      divTarget.__ingredientCategoryDivisions = st.ingredientCategoryDivisions;
    }
    if (
      st?.paymentAccountMapping &&
      typeof st.paymentAccountMapping === "object" &&
      !Array.isArray(st.paymentAccountMapping)
    ) {
      divTarget.__paymentAccountMapping = sanitizePaymentAccountMapping(st.paymentAccountMapping);
    }
    if (st?.menuCategories && typeof st.menuCategories === "object" && !Array.isArray(st.menuCategories)) {
      divTarget.__menuCategories = st.menuCategories;
    }
    if (st?.dailySalesRecaps && Array.isArray(st.dailySalesRecaps)) {
      divTarget.__dailySalesRecaps = st.dailySalesRecaps;
    }
    if (st?.defaultOverheadPercent !== undefined && st?.defaultOverheadPercent !== null) {
      divTarget.__defaultOverheadPercent = Number(st.defaultOverheadPercent);
    }
    if (
      st?.profitShareOwnerPercent !== undefined ||
      st?.profitShareReservePercent !== undefined ||
      st?.profitShareInvestorPercent !== undefined ||
      divTarget.__profitShareConfig
    ) {
      divTarget.__profitShareConfig =
        st?.profitShareOwnerPercent !== undefined ||
        st?.profitShareReservePercent !== undefined ||
        st?.profitShareInvestorPercent !== undefined
          ? normalizeProfitSharePercentages({
              ownerPercent: st?.profitShareOwnerPercent,
              reservePercent: st?.profitShareReservePercent,
              investorPercent: st?.profitShareInvestorPercent,
            })
          : normalizeProfitSharePercentages(divTarget.__profitShareConfig);
    }

    const existingCleaningMeta = extractCleaningMetaFromSettings(existingRow);
    const resolvedAutoSeedDisabled =
      st?.autoSeedDisabled !== undefined
        ? Boolean(st.autoSeedDisabled)
        : existingCleaningMeta.autoSeedDisabled;
    if (resolvedAutoSeedDisabled) {
      divTarget.__autoSeedDisabled = true;
    } else if (st?.autoSeedDisabled === false) {
      delete divTarget.__autoSeedDisabled;
    }
    const resolvedLastCleanedAt =
      st?.lastCleanedAt !== undefined ? st.lastCleanedAt : existingCleaningMeta.lastCleanedAt;
    if (resolvedLastCleanedAt) {
      divTarget.__lastCleanedAt = String(resolvedLastCleanedAt);
    }

    const incomingKey = st?.gemini_api_key ?? st?.geminiApiKey;
    const resolvedGeminiKey = resolveGeminiApiKeyForSave({
      role: isSuperAdmin ? "SUPER_ADMIN" : isPrivilegedRole ? "MANAGER" : "STAFF",
      incomingKey,
      existingKey: existingRow?.gemini_api_key ?? null,
      envKey: process.env.GEMINI_API_KEY ?? null,
    });

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
      autoDeductStockOnSale: st?.autoDeductStockOnSale === true,
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
      isSuspended: Boolean(u.isSuspended ?? u.is_suspended ?? false),
      failedPinAttempts: Number(u.failedPinAttempts ?? u.failed_pin_attempts ?? 0) || 0,
      suspendedAt: u.suspendedAt || u.suspended_at || null,
      suspendedReason: u.suspendedReason || u.suspended_reason || null,
    };
  };

  const sanitizeUserForInsert = (u: any, existingPin?: string, existingUser?: any) => {
    let role = String(u.role || "MANAGER");
    if (["ADMIN_OPERASIONAL", "HRD", "MARKETING", "PURCHASING"].includes(role)) role = "MANAGER";
    if (["BARISTA", "WAITER"].includes(role)) role = "KASIR";
    let finalPin = u.pin ? String(u.pin) : (existingPin || existingUser?.pin || "123456");
    if (finalPin.length !== 64) {
      finalPin = crypto.createHash("sha256").update(finalPin).digest("hex");
    }

    const isSuspended =
      u.isSuspended !== undefined
        ? Boolean(u.isSuspended)
        : Boolean(existingUser?.isSuspended ?? existingUser?.is_suspended ?? false);
    const failedPinAttempts = isSuspended
      ? Number(u.failedPinAttempts ?? existingUser?.failedPinAttempts ?? 3) || 3
      : Number(u.failedPinAttempts ?? 0) || 0;

    return {
      id: String(u.id || crypto.randomUUID()),
      username: String(u.username || ""),
      pin: finalPin,
      name: String(u.name || ""),
      role,
      department: u.department ? String(u.department) : null,
      isSuspended,
      failedPinAttempts,
      suspendedAt: isSuspended
        ? String(u.suspendedAt || existingUser?.suspendedAt || new Date().toISOString())
        : null,
      suspendedReason: isSuspended
        ? String(
            u.suspendedReason ||
              existingUser?.suspendedReason ||
              "Salah memasukkan PIN sebanyak 3 kali berturut-turut"
          )
        : null,
    };
  };

  const ensureDefaultUsers = async (targetDb: any, existingUsers: any[], allowAutoSeed = true) => {
    if (!allowAutoSeed) return existingUsers || [];
    if (!existingUsers) return initialUsers;
    const existingIds = new Set(existingUsers.map((u: any) => String(u.id || "")));
    const existingUsernames = new Set(
      existingUsers.map((u: any) => String(u.username || "").toLowerCase())
    );
    const missing = initialUsers.filter(
      (u: any) =>
        !existingIds.has(String(u.id || "")) &&
        !existingUsernames.has(String(u.username || "").toLowerCase())
    );
    if (missing.length > 0 && targetDb) {
      try {
        const sanitized = missing.map((u: any) => sanitizeUserForInsert(u, u.pin));
        await targetDb.insert(schema.users).values(sanitized).onConflictDoNothing();
        console.log(`[AutoSeed] Injected ${missing.length} missing default users into database.`);
        return [...existingUsers, ...sanitized];
      } catch (err) {
        console.warn("[AutoSeed] Failed to insert missing default users:", err);
      }
    }
    return existingUsers;
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

  const sanitizeEmployee = (e: any) =>
    sanitizeEmployeeRecord(e, crypto.randomUUID());

  const sanitizeEmployeeContract = (c: any) =>
    sanitizeEmployeeContractRecord(c, crypto.randomUUID());

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
    isCorrected: Boolean(a.isCorrected),
    correctedBy: a.correctedBy ? String(a.correctedBy) : null,
    correctedAt: a.correctedAt ? String(a.correctedAt) : null,
    correctionReason: a.correctionReason ? String(a.correctionReason) : null,
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

  const sanitizeKPIRecord = (k: any) =>
    sanitizeKPIRecordData(k, crypto.randomUUID());

  const sanitizeKpiTask = (t: any) =>
    sanitizeKpiTaskRecord(t, crypto.randomUUID());

  const sanitizeKpiBonusRule = (r: any) =>
    sanitizeKpiBonusRuleRecord(r, crypto.randomUUID());

  const sanitizeSupplier = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    name: String(s.name || ""),
    picName: String(s.picName || ""),
    contact: String(s.contact || ""),
    address: String(s.address || ""),
    notes: String(s.notes || ""),
  });

  const sanitizePurchaseOrder = (p: any) =>
    sanitizePurchaseOrderRecord(p, crypto.randomUUID());

  const sanitizeShift = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    userId: String(s.userId || ""),
    cashAccountId: String(s.cashAccountId || ""),
    startTime: String(s.startTime || new Date().toISOString()),
    endTime: s.endTime ? String(s.endTime) : null,
    startingCash: Math.round(Math.max(0, Number(s.startingCash) || 0)),
    expectedEndingCash:
      s.expectedEndingCash !== null && s.expectedEndingCash !== undefined
        ? Math.round(Number(s.expectedEndingCash) || 0)
        : null,
    actualEndingCash:
      s.actualEndingCash !== null && s.actualEndingCash !== undefined
        ? Math.round(Number(s.actualEndingCash) || 0)
        : null,
    difference:
      s.difference !== null && s.difference !== undefined
        ? Math.round(Number(s.difference) || 0)
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
    daily_sales_recaps: [],
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
    employees: [
      { id: "emp-kasir", username: "kasir", name: "Ahmad Kasir", position: "KASIR", department: "OPERASIONAL", status: "AKTIF", joinDate: "2024-01-10" },
      { id: "emp-barista", username: "barista", name: "Bima Barista", position: "BAR", department: "OPERASIONAL", status: "AKTIF", joinDate: "2024-01-15" },
      { id: "emp-leader", username: "leader", name: "Dian Leader", position: "LEADER", department: "OPERASIONAL", status: "AKTIF", joinDate: "2023-08-01" },
      { id: "emp-manager", username: "manager", name: "Siti Manager", position: "MANAGER", department: "MANAJEMEN", status: "AKTIF", joinDate: "2023-01-01" },
    ],
    contracts: [],
    employeeShifts: [],
    attendances: [],
    dailyAttendances: [],
    dailyChecklists: [],
    kpiRecords: [],
    kpiTasks: [],
    kpiBonusRules: [],
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

  const requireAuth = async (
    req: express.Request,
    res: express.Response,
    allowedRoles?: readonly string[]
  ) => {
    const authUser = await resolveAuthUser(req);
    const check = evaluateApiAccess(authUser, allowedRoles);
    if ("error" in check) {
      res.status(check.status).json({ error: check.error });
      return null;
    }
    return authUser;
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

    // 3. Cek apakah PIN milik akun OWNER
    const matchedOwner = allUsers.find(
      (u: any) => u.role === "OWNER" && (u.pin === pinHash || u.pin === cleanPin)
    );
    if (matchedOwner) {
      if (purpose === "SUPERVISOR") {
        return {
          ok: false,
          status: 403,
          error: "Akun Owner berstatus Read-Only (Pengawasan). Otorisasi harus dilakukan oleh Manager atau Super Admin.",
        };
      }
      // Untuk keluar POS (EXIT_POS) atau Unlock Terminal, PIN Owner sah dan diizinkan penuh
      return {
        ok: true,
        status: 200,
        approver: { id: matchedOwner.id, name: matchedOwner.name, role: matchedOwner.role },
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

  // ─── Feature flag modul operasional ───────────────────────────────────────
  // Sistem ini difokuskan sebagai aplikasi management (back-office). Modul kasir/POS
  // dan layar dapur (KDS) berjalan di aplikasi lain, sehingga endpoint-nya ditolak
  // secara default. Aktifkan kembali lewat ENABLE_POS=true / ENABLE_KDS=true.
  const POS_MODULE_ENABLED = process.env.ENABLE_POS === "true";
  const KDS_MODULE_ENABLED = process.env.ENABLE_KDS === "true";
  app.use("/api/pos", (_req, res, next) => {
    if (POS_MODULE_ENABLED) return next();
    return res.status(410).json({
      error: "Modul POS dinonaktifkan. Sistem ini hanya untuk kebutuhan management.",
    });
  });
  app.use("/api/kds", (_req, res, next) => {
    if (KDS_MODULE_ENABLED) return next();
    return res.status(410).json({
      error: "Modul KDS dinonaktifkan. Sistem ini hanya untuk kebutuhan management.",
    });
  });

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

  app.post("/api/closed-periods/verify-reopen-pin", pinVerifyLimiter, async (req, res) => {
    try {
      const authUser = await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER"]);
      if (!authUser) return;

      const { pin, reason } = req.body || {};
      const cleanReason = String(reason || "").trim();
      if (cleanReason.length < 5) {
        return res.status(400).json({
          valid: false,
          error: "Alasan pembukaan kembali periode wajib diisi minimal 5 karakter.",
        });
      }

      const rawPin = String(pin || "").trim();
      if (!rawPin) {
        return res.status(400).json({ valid: false, error: "PIN Manager / Super Admin wajib diisi." });
      }
      const hashedPin =
        rawPin.length === 64 ? rawPin : crypto.createHash("sha256").update(rawPin).digest("hex");
      const userPinMatches = authUser.pin === hashedPin || authUser.pin === rawPin;
      if (!userPinMatches) {
        return res.status(403).json({
          valid: false,
          error: "PIN otorisasi Manager / Super Admin salah.",
        });
      }

      return res.json({ valid: true, verifiedBy: authUser.name || authUser.role });
    } catch (err: any) {
      return res.status(500).json({ valid: false, error: err?.message || "Gagal memverifikasi PIN buka buku" });
    }
  });

  app.get("/api/sync", async (req, res) => {
    try {
      const authUser = await resolveAuthUser(req);
      const isPrivilegedRole =
        authUser?.role === "MANAGER" || authUser?.role === "SUPER_ADMIN";
      const isSuperAdminRole = authUser?.role === "SUPER_ADMIN";

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
            const allowPublicAutoSeed = shouldAutoSeedDummyData(sRows[0]);
            if (uRows.length === 0 && allowPublicAutoSeed) {
              await db.transaction(async (tx) => {
                await tx
                  .insert(schema.users)
                  .values(initialUsers.map((u: any) => sanitizeUserForInsert(u, u.pin)));
                await tx
                  .insert(schema.settings)
                  .values([sanitizeSettings(initialSettings, undefined, true, true)]);
              });
              publicUsers = initialUsers;
              rawSt = initialSettings;
            } else {
              publicUsers = allowPublicAutoSeed ? await ensureDefaultUsers(db, uRows, true) : uRows;
              rawSt = sRows[0] || initialSettings;
            }
          } catch {
            const rawOffline = offlineState?.users || initialUsers;
            rawSt = (Array.isArray(offlineState?.settings) ? offlineState.settings[0] : offlineState?.settings) || initialSettings;
            const allowOfflineSeed = shouldAutoSeedDummyData(rawSt);
            publicUsers = allowOfflineSeed
              ? initialUsers.map((iu: any) => rawOffline.find((ou: any) => ou.username === iu.username) || sanitizeUserForInsert(iu, iu.pin))
              : rawOffline;
          }
        } else if (offlineState) {
          const rawOffline = offlineState.users || initialUsers;
          rawSt = (Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings) || initialSettings;
          const allowOfflineSeed = shouldAutoSeedDummyData(rawSt);
          publicUsers = allowOfflineSeed
            ? initialUsers.map((iu: any) => rawOffline.find((ou: any) => ou.username === iu.username) || sanitizeUserForInsert(iu, iu.pin))
            : rawOffline;
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

      if (authUser.isSuspended) {
        return res.status(403).json({
          error: "Forbidden: Akun Anda sedang ditangguhkan (suspended).",
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

      const buildOfflineSyncPayload = () => {
        const rawSettings =
          offlineState.settings && offlineState.settings.length > 0
            ? Array.isArray(offlineState.settings)
              ? offlineState.settings[0]
              : offlineState.settings
            : initialSettings;
        const effectiveApiKey =
          rawSettings?.gemini_api_key ||
          rawSettings?.geminiApiKey ||
          process.env.GEMINI_API_KEY ||
          "";
        let rawDivObj: Record<string, any> = {};
        try {
          rawDivObj =
            typeof rawSettings?.divisionKpiBonusTarget === "string"
              ? JSON.parse(rawSettings.divisionKpiBonusTarget)
              : typeof rawSettings?.divisionKpiBonusTarget === "object" && rawSettings?.divisionKpiBonusTarget
                ? { ...rawSettings.divisionKpiBonusTarget }
                : {};
        } catch {
          rawDivObj = {};
        }
        const profitShareCfg = normalizeProfitSharePercentages(
          rawDivObj.__profitShareConfig || {
            ownerPercent: rawSettings?.profitShareOwnerPercent,
            reservePercent: rawSettings?.profitShareReservePercent,
            investorPercent: rawSettings?.profitShareInvestorPercent,
          }
        );
        delete rawDivObj.__profitShareConfig;
        const offIngCatDivisions =
          rawDivObj.__ingredientCategoryDivisions &&
          typeof rawDivObj.__ingredientCategoryDivisions === "object" &&
          !Array.isArray(rawDivObj.__ingredientCategoryDivisions)
            ? rawDivObj.__ingredientCategoryDivisions
            : rawSettings?.ingredientCategoryDivisions;
        delete rawDivObj.__ingredientCategoryDivisions;
        const offPaymentAccountMapping = sanitizePaymentAccountMapping(
          rawDivObj.__paymentAccountMapping || rawSettings?.paymentAccountMapping
        );
        delete rawDivObj.__paymentAccountMapping;
        const offlineCleaningMeta = extractCleaningMetaFromSettings({
          divisionKpiBonusTarget: rawDivObj,
          autoSeedDisabled: rawSettings?.autoSeedDisabled,
          lastCleanedAt: rawSettings?.lastCleanedAt,
        });
        delete rawDivObj.__autoSeedDisabled;
        delete rawDivObj.__lastCleanedAt;
        return {
          ...offlineState,
          users: (offlineState.users || initialUsers).map(sanitizeUser),
          device_sessions: filterVisibleSessionsForUser(
            offlineState.device_sessions || [],
            authUser
          ),
          contracts: (offlineState.contracts || []).map(formatContractForClient),
          kpiRecords: (offlineState.kpiRecords || []).map(formatKpiRecordForClient),
          closed_periods: (offlineState.closed_periods || []).map(formatClosedPeriodForClient),
          v: serverDataVersion,
          settings: {
            ...rawSettings,
            hasGeminiApiKey: Boolean(effectiveApiKey),
            hasPosSupervisorPin: Boolean(rawSettings?.posSupervisorPin),
            geminiApiKey: isSuperAdminRole ? effectiveApiKey : "",
            gemini_api_key: isSuperAdminRole ? effectiveApiKey : "",
            posSupervisorPin: isPrivilegedRole ? (rawSettings?.posSupervisorPin || "1234") : "",
            ...(offIngCatDivisions ? { ingredientCategoryDivisions: offIngCatDivisions } : {}),
            ...(Object.keys(offPaymentAccountMapping).length > 0
              ? { paymentAccountMapping: offPaymentAccountMapping }
              : {}),
            profitShareOwnerPercent: profitShareCfg.ownerPercent,
            profitShareReservePercent: profitShareCfg.reservePercent,
            profitShareInvestorPercent: profitShareCfg.investorPercent,
            autoSeedDisabled: offlineCleaningMeta.autoSeedDisabled,
            lastCleanedAt: offlineCleaningMeta.lastCleanedAt,
          },
          serverTime: new Date().toISOString(),
        };
      };

      if (!isDbConnected) {
        return res.json(buildOfflineSyncPayload());
      }
      let cash_accounts: any[] = [];
      let cash_transactions: any[] = [];
      let settings: any[] = [];
      let users: any[] = [];
      let device_sessions: any[] = [];
      let ingredients: any[] = [];
      let stock_movements: any[] = [];
      let sales_transactions: any[] = [];
      let daily_sales_recaps: any[] = [];
      let sales_import_logs: any[] = [];
      let recipes: any[] = [];
      let audit_logs: any[] = [];
      let employees: any[] = [];
      let employee_contracts: any[] = [];
      let attendance_records: any[] = [];
      let kpi_records: any[] = [];
      let kpi_tasks: any[] = [];
      let kpi_bonus_rules: any[] = [];
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
          daily_sales_recaps,
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
          kpi_tasks,
          kpi_bonus_rules,
        ] = await Promise.all([
          db.select().from(schema.cashAccounts),
          db.select().from(schema.cashTransactions),
          db.select().from(schema.settings),
          db.select().from(schema.users),
          db.select().from(schema.deviceSessions),
          db.select().from(schema.ingredients),
          db.select().from(schema.stockMovements),
          db.select().from(schema.salesTransactions),
          db.select().from(schema.dailySalesRecaps),
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
          db.select().from(schema.kpiTasks),
          db.select().from(schema.kpiBonusRules),
        ]);

        const allowAutoSeed = shouldAutoSeedDummyData(settings[0]);

        // Seed default promotions if empty (only when auto-seed is enabled)
        if (promotions.length === 0 && allowAutoSeed) {
          try {
            await db.insert(schema.promotions).values(initialPromotions).onConflictDoNothing();
            promotions = initialPromotions;
          } catch (seedErr) {
            console.warn("Could not seed default promotions:", seedErr);
          }
        }

        // Seed default expense categories if empty
        if (expense_categories.length === 0) {
          try {
            await db.insert(schema.expenseCategories).values(defaultCategories.map(sanitizeExpenseCategory)).onConflictDoNothing();
            expense_categories = defaultCategories as any;
          } catch (seedErr) {
            console.warn("Expense category seed skipped:", seedErr);
          }
        }

        // Auto seed if completely new database (only when auto-seed is enabled)
        if (users.length === 0 && allowAutoSeed) {
          try {
            await db.transaction(async (tx) => {
              await tx
                .insert(schema.users)
                .values(initialUsers.map((u: any) => sanitizeUserForInsert(u, u.pin)))
                .onConflictDoNothing();
              await tx
                .insert(schema.settings)
                .values([sanitizeSettings(initialSettings, undefined, true, true)])
                .onConflictDoNothing();
            });
            users = initialUsers as any;
            settings = [initialSettings] as any;
          } catch (seedErr) {
            console.warn("Auto seed skipped or failed:", seedErr);
          }
        } else if (allowAutoSeed) {
          users = (await ensureDefaultUsers(db, users, true)) as any;
        }

        // Auto seed default cash accounts & pulihkan Pos Kas / Pos Kategori yang masih direferensikan cash_transactions
        const cashRecovery = recoverOrphanCashAccountsAndCategories({
          cashAccounts: cash_accounts as any[],
          cashTransactions: cash_transactions as any[],
          expenseCategories: expense_categories as any[],
        });
        if (cashRecovery.addedAccounts.length > 0) {
          try {
            await db
              .insert(schema.cashAccounts)
              .values(cashRecovery.addedAccounts.map(sanitizeCashAccount))
              .onConflictDoNothing();
            cash_accounts = cashRecovery.recoveredAccounts as any;
            console.log(`[AutoRecover] Memulihkan ${cashRecovery.addedAccounts.length} Pos Kas ke database.`);
          } catch (seedErr) {
            console.warn("Cash accounts recovery/seed skipped:", seedErr);
            cash_accounts = cashRecovery.recoveredAccounts as any;
          }
        }
        if (cashRecovery.addedCategories.length > 0) {
          try {
            await db
              .insert(schema.expenseCategories)
              .values(cashRecovery.addedCategories.map(sanitizeExpenseCategory))
              .onConflictDoNothing();
            expense_categories = cashRecovery.recoveredCategories as any;
            console.log(`[AutoRecover] Memulihkan ${cashRecovery.addedCategories.length} Pos Kategori ke database.`);
          } catch (seedErr) {
            console.warn("Expense categories recovery skipped:", seedErr);
            expense_categories = cashRecovery.recoveredCategories as any;
          }
        }

        // Auto seed ingredients, recipes, and products if ingredients is empty and auto-seed is enabled
        if (ingredients.length === 0 && allowAutoSeed) {
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
                  productGroup: (prod as any).productGroup || null,
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
          return res.json(buildOfflineSyncPayload());
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
      const cleanDivForMigration = { ...rawDivTarget };
      const allowanceRules = Array.isArray(rawDivTarget.__leaderAllowanceRules)
        ? rawDivTarget.__leaderAllowanceRules
        : (Array.isArray(rawSettings.leaderJobdeskAllowanceRules) ? rawSettings.leaderJobdeskAllowanceRules : []);
      delete rawDivTarget.__leaderAllowanceRules;

      const shiftDefs = Array.isArray(rawDivTarget.__shiftDefinitions)
        ? rawDivTarget.__shiftDefinitions
        : (Array.isArray(rawSettings.shiftDefinitions) ? rawSettings.shiftDefinitions : []);
      delete rawDivTarget.__shiftDefinitions;

      const ingredientCategories = Array.isArray(rawDivTarget.__ingredientCategories)
        ? rawDivTarget.__ingredientCategories
        : (Array.isArray(rawSettings.ingredientCategories) ? rawSettings.ingredientCategories : undefined);
      delete rawDivTarget.__ingredientCategories;

      const ingredientCategoryDivisions =
        rawDivTarget.__ingredientCategoryDivisions &&
        typeof rawDivTarget.__ingredientCategoryDivisions === "object" &&
        !Array.isArray(rawDivTarget.__ingredientCategoryDivisions)
          ? rawDivTarget.__ingredientCategoryDivisions
          : (rawSettings.ingredientCategoryDivisions &&
              typeof rawSettings.ingredientCategoryDivisions === "object" &&
              !Array.isArray(rawSettings.ingredientCategoryDivisions)
                ? rawSettings.ingredientCategoryDivisions
                : undefined);
      delete rawDivTarget.__ingredientCategoryDivisions;

      const paymentAccountMappingRaw =
        rawDivTarget.__paymentAccountMapping || rawSettings.paymentAccountMapping;
      const paymentAccountMapping = sanitizePaymentAccountMapping(paymentAccountMappingRaw);
      delete rawDivTarget.__paymentAccountMapping;

      const menuCategories =
        rawDivTarget.__menuCategories &&
        typeof rawDivTarget.__menuCategories === "object" &&
        !Array.isArray(rawDivTarget.__menuCategories)
          ? rawDivTarget.__menuCategories
          : (rawSettings.menuCategories &&
              typeof rawSettings.menuCategories === "object" &&
              !Array.isArray(rawSettings.menuCategories)
                ? rawSettings.menuCategories
                : undefined);
      delete rawDivTarget.__menuCategories;

      const legacyDailySalesRecaps = Array.isArray(rawDivTarget.__dailySalesRecaps)
        ? rawDivTarget.__dailySalesRecaps
        : (Array.isArray(rawSettings.dailySalesRecaps) ? rawSettings.dailySalesRecaps : undefined);
      delete rawDivTarget.__dailySalesRecaps;
      delete cleanDivForMigration.__dailySalesRecaps;

      // Migrasi aman data rekap lama dari settings ke tabel relasional daily_sales_recaps (sekali jalan tanpa kehilangan data)
      if (
        daily_sales_recaps.length === 0 &&
        Array.isArray(legacyDailySalesRecaps) &&
        legacyDailySalesRecaps.length > 0
      ) {
        const migratedRecaps = legacyDailySalesRecaps.map(sanitizeDailySalesRecap);
        try {
          await db
            .insert(schema.dailySalesRecaps)
            .values(migratedRecaps)
            .onConflictDoNothing();
          await db
            .update(schema.settings)
            .set({ divisionKpiBonusTarget: JSON.stringify(cleanDivForMigration) })
            .where(eq(schema.settings.id, String(rawSettings.id || "1")));
          daily_sales_recaps = migratedRecaps;
        } catch (migErr) {
          console.warn("Migrasi daily_sales_recaps ditunda:", migErr);
          daily_sales_recaps = migratedRecaps;
        }
      }

      const defaultOverheadPercent =
        rawDivTarget.__defaultOverheadPercent !== undefined
          ? Number(rawDivTarget.__defaultOverheadPercent)
          : (rawSettings.defaultOverheadPercent !== undefined ? Number(rawSettings.defaultOverheadPercent) : undefined);
      delete rawDivTarget.__defaultOverheadPercent;

      const profitShareCfg = normalizeProfitSharePercentages(
        rawDivTarget.__profitShareConfig || {
          ownerPercent: rawSettings.profitShareOwnerPercent,
          reservePercent: rawSettings.profitShareReservePercent,
          investorPercent: rawSettings.profitShareInvestorPercent,
        }
      );
      delete rawDivTarget.__profitShareConfig;

      const cleaningMeta = extractCleaningMetaFromSettings({
        divisionKpiBonusTarget: rawDivTarget,
        autoSeedDisabled: rawSettings.autoSeedDisabled,
        lastCleanedAt: rawSettings.lastCleanedAt,
      });
      delete rawDivTarget.__autoSeedDisabled;
      delete rawDivTarget.__lastCleanedAt;

      const formattedSettings = {
        ...rawSettings,
        hasGeminiApiKey: Boolean(effectiveApiKey),
        hasPosSupervisorPin: Boolean(rawSettings.posSupervisorPin),
        geminiApiKey: isSuperAdminRole ? effectiveApiKey : "",
        gemini_api_key: isSuperAdminRole ? effectiveApiKey : "",
        posSupervisorPin: isPrivilegedRole ? String(rawSettings.posSupervisorPin || "1234") : "",
        leaderBarTasks: parseTasksJson(rawSettings.leaderBarTasks),
        leaderKitchenTasks: parseTasksJson(rawSettings.leaderKitchenTasks),
        leaderBakerTasks: parseTasksJson(rawSettings.leaderBakerTasks),
        managerTasks: parseTasksJson(rawSettings.managerTasks),
        leaderJobdeskAllowanceRules: allowanceRules,
        shiftDefinitions: shiftDefs,
        ...(ingredientCategories ? { ingredientCategories } : {}),
        ...(ingredientCategoryDivisions ? { ingredientCategoryDivisions } : {}),
        ...(Object.keys(paymentAccountMapping).length > 0 ? { paymentAccountMapping } : {}),
        ...(menuCategories ? { menuCategories } : {}),
        ...(defaultOverheadPercent !== undefined && !isNaN(defaultOverheadPercent)
          ? { defaultOverheadPercent }
          : {}),
        profitShareOwnerPercent: profitShareCfg.ownerPercent,
        profitShareReservePercent: profitShareCfg.reservePercent,
        profitShareInvestorPercent: profitShareCfg.investorPercent,
        autoSeedDisabled: cleaningMeta.autoSeedDisabled,
        lastCleanedAt: cleaningMeta.lastCleanedAt,
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
        device_sessions: filterVisibleSessionsForUser(device_sessions, authUser),
        ingredients,
        stock_movements,
        sales_transactions,
        daily_sales_recaps,
        sales_import_logs,
        recipes: formatRecipesForClient(recipes),
        audit_logs,
        suppliers,
        purchase_orders,
        shifts: formatShiftsForClient(shifts),
        employees,
        contracts: employee_contracts.map(formatContractForClient),
        employeeShifts: employee_shifts,
        attendances: attendance_records,
        dailyChecklists: daily_checklists,
        dailyAttendances: daily_attendances,
        kpiRecords: kpi_records.map(formatKpiRecordForClient),
        kpiTasks: kpi_tasks,
        kpiBonusRules: kpi_bonus_rules,
        // Fase 1-4
        expense_categories,
        budgets,
        bank_reconciliations,
        bank_statement_lines,
        stock_opnames,
        stock_opname_items,
        payroll_records,
        closed_periods: closed_periods.map(formatClosedPeriodForClient),
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

  app.post("/api/login", pinVerifyLimiter, async (req, res) => {
    try {
      const { username, pin } = req.body;
      const cleanUsername = String(username || "").trim().toLowerCase();
      let finalPin = String(pin || "");
      if (finalPin.length !== 64) {
        finalPin = crypto.createHash("sha256").update(finalPin).digest("hex");
      }

      let currentUsers: any[];
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

      const targetUser = currentUsers.find(
        (u: any) => String(u.username || "").trim().toLowerCase() === cleanUsername
      );

      if (!targetUser) {
        return res.status(401).json({ error: "Username operator tidak ditemukan." });
      }

      // 1. Cek apakah akun sedang berstatus Ter-suspend
      if (targetUser.isSuspended) {
        return res.status(403).json({
          error:
            "🔒 Akun ini sedang DITANGGUHKAN (Ter-suspend) karena salah memasukkan PIN 3x berturut-turut. Silakan hubungi Manager atau Super Admin untuk membuka suspend akun Anda.",
          isSuspended: true,
          failedAttempts: targetUser.failedPinAttempts || 3,
          remainingAttempts: 0,
          user: sanitizeUser(targetUser),
        });
      }

      // 2. Verifikasi kecocokan PIN
      const isPinValid =
        targetUser.pin === finalPin ||
        targetUser.pin === pin ||
        (pin === "123456" &&
          (targetUser.pin === "1234" ||
            targetUser.pin === "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"));

      if (!isPinValid) {
        const nextAttempts = (Number(targetUser.failedPinAttempts) || 0) + 1;

        // Cegah deadlock jika akun ini adalah satu-satunya Super Admin/Manager yang masih aktif
        const otherActiveAdminsOrManagers = currentUsers.filter(
          (u: any) =>
            u.id !== targetUser.id &&
            !u.isSuspended &&
            (u.role === "SUPER_ADMIN" || u.role === "MANAGER")
        );
        const canSuspendAccount =
          targetUser.role !== "SUPER_ADMIN" || otherActiveAdminsOrManagers.length > 0;

        const shouldSuspend = nextAttempts >= 3 && canSuspendAccount;
        const nowIso = new Date().toISOString();
        const suspendReason = "Salah memasukkan PIN sebanyak 3 kali berturut-turut";

        const updatedFields = {
          failedPinAttempts: nextAttempts,
          isSuspended: shouldSuspend,
          suspendedAt: shouldSuspend ? nowIso : null,
          suspendedReason: shouldSuspend ? suspendReason : null,
        };

        if (isDbConnected) {
          try {
            await db
              .update(schema.users)
              .set(updatedFields)
              .where(eq(schema.users.id, targetUser.id));

            if (shouldSuspend) {
              await db
                .update(schema.deviceSessions)
                .set({ status: "REVOKED" })
                .where(eq(schema.deviceSessions.userId, targetUser.id));

              await db.insert(schema.auditLogs).values({
                id: `audit-suspend-${Date.now()}`,
                userId: targetUser.id,
                action: "SUSPEND_PIN_3X",
                tableName: "users",
                recordId: targetUser.id,
                timestamp: nowIso,
              });
            }
          } catch (updateErr) {
            console.warn("Gagal memperbarui percobaan PIN di DB:", updateErr);
          }
        }

        if (offlineState && Array.isArray(offlineState.users)) {
          offlineState.users = offlineState.users.map((u: any) =>
            u.id === targetUser.id ? { ...u, ...updatedFields } : u
          );
          if (shouldSuspend) {
            offlineState.audit_logs = offlineState.audit_logs || [];
            offlineState.audit_logs.unshift({
              id: `audit-suspend-${Date.now()}`,
              userId: targetUser.id,
              action: "SUSPEND_PIN_3X",
              tableName: "users",
              recordId: targetUser.id,
              timestamp: nowIso,
            });
          }
        }

        bumpDataVersion();

        const updatedUserObj = sanitizeUser({ ...targetUser, ...updatedFields });

        if (shouldSuspend) {
          return res.status(403).json({
            error:
              "🚨 Akun Anda telah DITANGGUHKAN (Ter-suspend) karena salah memasukkan PIN sebanyak 3 kali! Notifikasi telah dikirim ke Manager & Super Admin untuk membuka kembali akun Anda.",
            isSuspended: true,
            failedAttempts: nextAttempts,
            remainingAttempts: 0,
            user: updatedUserObj,
          });
        }

        const remaining = Math.max(0, 3 - nextAttempts);
        return res.status(401).json({
          error: canSuspendAccount
            ? `PIN otorisasi salah! Percobaan gagal ke-${nextAttempts} dari 3. Sisa kesempatan: ${remaining}x lagi sebelum akun ter-suspend otomatis.`
            : "PIN otorisasi tidak sesuai. Silakan coba lagi.",
          isSuspended: false,
          failedAttempts: nextAttempts,
          remainingAttempts: remaining,
          user: updatedUserObj,
        });
      }

      // 3. Jika PIN benar dan sebelumnya sempat gagal (1x atau 2x), reset kembali counter ke 0
      if ((Number(targetUser.failedPinAttempts) || 0) > 0) {
        if (isDbConnected) {
          try {
            await db
              .update(schema.users)
              .set({ failedPinAttempts: 0 })
              .where(eq(schema.users.id, targetUser.id));
          } catch {}
        }
        if (offlineState && Array.isArray(offlineState.users)) {
          offlineState.users = offlineState.users.map((u: any) =>
            u.id === targetUser.id ? { ...u, failedPinAttempts: 0 } : u
          );
        }
        targetUser.failedPinAttempts = 0;
        bumpDataVersion();
      }

      const user = targetUser;

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

      res.json({ success: true, token: sessionId, user: sanitizeUser(user) });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Endpoint khusus bagi Manager atau Super Admin untuk membuka suspend akun (Unsuspend)
  app.post("/api/users/:id/unsuspend", async (req, res) => {
    try {
      const authUser = await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER"]);
      if (!authUser) return;

      const targetId = String(req.params.id || "").trim();
      if (!targetId) {
        return res.status(400).json({ error: "ID pengguna tidak valid." });
      }

      const nowIso = new Date().toISOString();
      const resetFields = {
        isSuspended: false,
        failedPinAttempts: 0,
        suspendedAt: null,
        suspendedReason: null,
      };

      if (isDbConnected) {
        await db
          .update(schema.users)
          .set(resetFields)
          .where(eq(schema.users.id, targetId));

        await db.insert(schema.auditLogs).values({
          id: `audit-unsuspend-${Date.now()}`,
          userId: authUser.id,
          action: "UNSUSPEND_USER",
          tableName: "users",
          recordId: targetId,
          timestamp: nowIso,
        });
      }

      if (offlineState && Array.isArray(offlineState.users)) {
        offlineState.users = offlineState.users.map((u: any) =>
          u.id === targetId ? { ...u, ...resetFields } : u
        );
        offlineState.audit_logs = offlineState.audit_logs || [];
        offlineState.audit_logs.unshift({
          id: `audit-unsuspend-${Date.now()}`,
          userId: authUser.id,
          action: "UNSUSPEND_USER",
          tableName: "users",
          recordId: targetId,
          timestamp: nowIso,
        });
      }

      bumpDataVersion();
      return res.json({ success: true, targetId });
    } catch (err: any) {
      console.error("Unsuspend user error:", err);
      return res.status(500).json({ error: err?.message || "Gagal membuka suspend akun" });
    }
  });

  app.post("/api/sync", async (req, res) => {
    try {
      const requestUser = await requireAuth(req, res);
      if (!requestUser) return;
      let currentUsersDB: any[] = [];

      const isPrivilegedSyncUser =
        requestUser.role === "MANAGER" || requestUser.role === "SUPER_ADMIN";
      const isSuperAdminSyncUser = requestUser.role === "SUPER_ADMIN";

      // ── ATURAN #5b: OWNER READ-ONLY ENFORCEMENT ──────────────────────────
      // Owner berstatus Read-Only (Pengawasan). Seluruh mutasi data via API ditolak di sisi server.
      if (requestUser.role === "OWNER") {
        return res.status(403).json({
          error: "Forbidden: Akun Owner berstatus Read-Only (Pengawasan). Tidak diizinkan melakukan perubahan data operasional.",
        });
      }

      const restrictedBody = applyRoleSyncRestrictions(
        requestUser.role,
        req.body || {}
      );
      let {
        cash_accounts,
        cash_transactions,
        settings,
        users,
        device_sessions,
        ingredients,
        stock_movements,
        sales_transactions,
        daily_sales_recaps,
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
      } = restrictedBody;

      const mergeByIdPreservingExisting = mergePreservingProtectedRows;

      if (!isDbConnected && offlineState) {
        const offlineOrderIds = new Set<string>((offlineState.orders || []).map((o: any) => String(o.id)));
        const existingClosedPeriods = offlineState.closed_periods || [];
        const guardedClosedPeriods =
          closed_periods !== undefined
            ? protectClosedPeriodsOnSync(requestUser.role, closed_periods, existingClosedPeriods).map(
                sanitizeClosedPeriodForDb
              )
            : existingClosedPeriods;
        if (closed_periods !== undefined) {
          offlineState.closed_periods = guardedClosedPeriods;
        }
        const effectiveClosedPeriods = guardedClosedPeriods;
        if (ingredients !== undefined && Array.isArray(ingredients)) {
          offlineState.ingredients = ingredients.map(sanitizeIngredient);
        }
        if (recipes !== undefined && Array.isArray(recipes)) {
          offlineState.recipes = dedupeRecipesByMenuName(recipes);
        }
        if (products !== undefined) offlineState.products = products;
        if (batch_preparations !== undefined) offlineState.batch_preparations = batch_preparations;
        if (Array.isArray(cash_accounts) && cash_accounts.length > 0) {
          offlineState.cash_accounts = cash_accounts;
        }
        if (cash_transactions !== undefined && Array.isArray(cash_transactions)) {
          const protectedPosCash = (offlineState.cash_transactions || []).filter(
            (ct: any) => ct.referenceId && offlineOrderIds.has(String(ct.referenceId))
          );
          const lockedCashTx = enforceClosedPeriodDataLock(
            cash_transactions,
            offlineState.cash_transactions || [],
            effectiveClosedPeriods,
            (t: any) => getLocalPeriodFromTimestamp(t?.date)
          );
          offlineState.cash_transactions = mergeByIdPreservingExisting(lockedCashTx, protectedPosCash);
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
        if (sales_import_logs !== undefined) {
          offlineState.sales_import_logs = Array.isArray(sales_import_logs)
            ? sales_import_logs.map(sanitizeSalesImportLog)
            : [];
        }
        if (daily_sales_recaps !== undefined) {
          const incomingRecaps = Array.isArray(daily_sales_recaps)
            ? daily_sales_recaps.map(sanitizeDailySalesRecap)
            : [];
          offlineState.daily_sales_recaps = enforceClosedPeriodDataLock(
            incomingRecaps,
            offlineState.daily_sales_recaps || [],
            effectiveClosedPeriods,
            (r: any) => getLocalPeriodFromTimestamp(r?.date)
          );
        }
        if (shifts !== undefined) offlineState.shifts = shifts;
        if (users !== undefined && Array.isArray(users) && users.length > 0) {
          const existingOfflineUsers = offlineState.users || initialUsers;
          const guardedUsers = protectSuperAdminAccountsOnSync(
            requestUser.role,
            users,
            existingOfflineUsers
          );
          offlineState.users = guardedUsers.map((u: any) => {
            const ex = existingOfflineUsers.find((cu: any) => String(cu.id) === String(u.id));
            return sanitizeUserForInsert(u, ex?.pin, ex);
          });
          const validOfflineUserIds = new Set(offlineState.users.map((u: any) => String(u.id)));
          offlineState.device_sessions = (offlineState.device_sessions || []).filter((s: any) =>
            validOfflineUserIds.has(String(s.userId))
          );
        }
        if (settings !== undefined && settings !== null) {
          const rawExisting = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
          const incomingSt = Array.isArray(settings) ? settings[0] : settings;
          offlineState.settings = [
            sanitizeSettings(
              incomingSt,
              rawExisting,
              isPrivilegedSyncUser,
              isSuperAdminSyncUser
            ),
          ];
        }
        if (expense_categories !== undefined) offlineState.expense_categories = expense_categories;
        if (budgets !== undefined) offlineState.budgets = budgets;
        if (bank_reconciliations !== undefined) {
          offlineState.bank_reconciliations = Array.isArray(bank_reconciliations)
            ? bank_reconciliations.map(sanitizeBankReconciliation)
            : [];
        }
        if (bank_statement_lines !== undefined) {
          offlineState.bank_statement_lines = Array.isArray(bank_statement_lines)
            ? bank_statement_lines.map(sanitizeBankStatementLine)
            : [];
        }
        if (stock_opnames !== undefined) {
          offlineState.stock_opnames = Array.isArray(stock_opnames)
            ? stock_opnames.map(sanitizeStockOpname)
            : [];
        }
        if (stock_opname_items !== undefined) {
          offlineState.stock_opname_items = Array.isArray(stock_opname_items)
            ? stock_opname_items.map(sanitizeStockOpnameItem)
            : [];
        }
        if (device_sessions !== undefined && Array.isArray(device_sessions)) {
          const protectedActive = (offlineState.device_sessions || []).filter(
            (s: any) => s.status === "ACTIVE"
          );
          offlineState.device_sessions = mergeByIdPreservingExisting(
            device_sessions.map(sanitizeDeviceSession),
            protectedActive
          );
        }
        if (payroll_records !== undefined && Array.isArray(payroll_records)) {
          const mergedPaidPayroll = mergeOfflinePayrollPreservingPaid(
            payroll_records.map(sanitizePayrollRecord),
            offlineState.payroll_records || []
          );
          offlineState.payroll_records = enforceClosedPeriodDataLock(
            mergedPaidPayroll,
            offlineState.payroll_records || [],
            effectiveClosedPeriods,
            (p: any) => String(p?.period || "")
          );
        }
        if (promotions !== undefined) offlineState.promotions = promotions;
        if (suppliers !== undefined) offlineState.suppliers = suppliers;
        if (purchase_orders !== undefined && Array.isArray(purchase_orders)) {
          offlineState.purchase_orders = purchase_orders.map(sanitizePurchaseOrder);
        }
        if (employees !== undefined && Array.isArray(employees)) {
          offlineState.employees = employees.map(sanitizeEmployee);
        }
        if (contracts !== undefined && Array.isArray(contracts)) {
          offlineState.contracts = contracts.map(sanitizeEmployeeContract);
        }
        if (employeeShifts !== undefined) offlineState.employeeShifts = employeeShifts;
        if (attendances !== undefined) offlineState.attendances = attendances;
        if (dailyAttendances !== undefined) offlineState.dailyAttendances = dailyAttendances;
        if (dailyChecklists !== undefined) offlineState.dailyChecklists = dailyChecklists;
        if (kpiRecords !== undefined && Array.isArray(kpiRecords)) {
          offlineState.kpiRecords = kpiRecords.map(sanitizeKPIRecord);
        }
        if (kpiTasks !== undefined && Array.isArray(kpiTasks)) {
          offlineState.kpiTasks = kpiTasks.map(sanitizeKpiTask);
        }
        if (kpiBonusRules !== undefined && Array.isArray(kpiBonusRules)) {
          offlineState.kpiBonusRules = kpiBonusRules.map(sanitizeKpiBonusRule);
        }
        if (audit_logs !== undefined && Array.isArray(audit_logs)) {
          offlineState.audit_logs = mergeByIdPreservingExisting(audit_logs, offlineState.audit_logs || []);
        }
        bumpDataVersion();
        return res.json({ success: true, v: serverDataVersion, serverTime: new Date().toISOString() });
      }

      await db.transaction(async (tx) => {
        // --- SNAPSHOT DATA TRANSAKSIONAL POS, REKENING KAS & KATEGORI AGAR TIDAK TERHAPUS MULTI-DEVICE ---
        let existingPaidIds = new Set<string>();
        let existingSettingsRow: any = null;
        let protectedPosSales: any[] = [];
        let protectedPosCash: any[] = [];
        let protectedPosMovements: any[] = [];
        let protectedAuditLogs: any[] = [];
        let protectedActiveSessions: any[] = [];
        let protectedDbAllCashTx: any[] = [];
        let existingClosedPeriods: any[] = [];
        let existingDbRecaps: any[] = [];
        let existingDbPayrolls: any[] = [];

        if (
          closed_periods !== undefined ||
          cash_transactions !== undefined ||
          daily_sales_recaps !== undefined ||
          payroll_records !== undefined
        ) {
          existingClosedPeriods = await tx.select().from(schema.closedPeriods);
        }
        const effectiveDbClosedPeriods =
          closed_periods !== undefined
            ? protectClosedPeriodsOnSync(requestUser.role, closed_periods, existingClosedPeriods)
            : existingClosedPeriods;
        if (daily_sales_recaps !== undefined) {
          existingDbRecaps = await tx.select().from(schema.dailySalesRecaps);
        }
        if (payroll_records !== undefined) {
          existingDbPayrolls = await tx.select().from(schema.payrollRecords);
        }

        const needPosOrdersCheck =
          cash_transactions !== undefined ||
          stock_movements !== undefined ||
          sales_transactions !== undefined;

        let posOrderIds = new Set<string>();
        if (cash_transactions !== undefined) {
          protectedDbAllCashTx = await tx.select().from(schema.cashTransactions);
        }

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
            protectedPosCash = protectedDbAllCashTx.filter((ct) => ct.referenceId && posOrderIds.has(String(ct.referenceId)));
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
        if (daily_sales_recaps !== undefined) {
          await tx.delete(schema.dailySalesRecaps);
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
        if (kpiTasks !== undefined) {
          await tx.delete(schema.kpiTasks);
        }
        if (kpiBonusRules !== undefined) {
          await tx.delete(schema.kpiBonusRules);
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
        // Jangan pernah hapus seluruh kategori atau pos kas jika payload kosong ([]) atau null
        const hasValidExpenseCategories =
          Array.isArray(expense_categories) && expense_categories.length > 0;
        const hasValidCashAccounts =
          Array.isArray(cash_accounts) && cash_accounts.length > 0;

        let guardedExpenseCategories = hasValidExpenseCategories ? expense_categories : null;
        if (hasValidExpenseCategories) {
          const existingDbCategories = await tx.select().from(schema.expenseCategories);
          guardedExpenseCategories = protectCoreExpenseCategoriesOnSync(
            expense_categories,
            existingDbCategories
          );
          await tx.delete(schema.expenseCategories);
        }
        const hasValidUsers = Array.isArray(users) && users.length > 0;
        if (hasValidUsers) {
          if (currentUsersDB.length === 0) {
            currentUsersDB = await tx.select().from(schema.users);
          }
          await tx.delete(schema.users);
        }
        let guardedCashAccounts = hasValidCashAccounts ? cash_accounts : null;
        if (hasValidCashAccounts) {
          const existingDbCashAccounts = await tx.select().from(schema.cashAccounts);
          const existingDbCashTxs = await tx
            .select({ accountId: schema.cashTransactions.accountId })
            .from(schema.cashTransactions);
          const existingDbRecaps = await tx
            .select({ bankAccountId: schema.dailySalesRecaps.bankAccountId })
            .from(schema.dailySalesRecaps);
          const existingDivMap =
            existingSettingsRow?.divisionKpiBonusTarget &&
            typeof existingSettingsRow.divisionKpiBonusTarget === "object"
              ? (existingSettingsRow.divisionKpiBonusTarget as Record<string, any>)
              : {};
          const existingPaymentMapping = sanitizePaymentAccountMapping(
            existingDivMap.__paymentAccountMapping || settings?.paymentAccountMapping
          );
          guardedCashAccounts = protectCashAccountsOnSync(
            cash_accounts,
            existingDbCashAccounts,
            existingDbCashTxs,
            existingDbRecaps,
            existingPaymentMapping
          );
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
        const guardedUsers = hasValidUsers
          ? protectSuperAdminAccountsOnSync(requestUser.role, users, currentUsersDB)
          : null;
        if (guardedUsers) {
          validUserIds = new Set(guardedUsers.map((u: any) => String(u.id)));
        }

        if (settings !== undefined && settings !== null) {
          const incomingSt = Array.isArray(settings) ? settings[0] : settings;
          await tx
            .insert(schema.settings)
            .values([
              sanitizeSettings(
                incomingSt,
                existingSettingsRow,
                isPrivilegedSyncUser,
                isSuperAdminSyncUser
              ),
            ]);
        }
        if (hasValidCashAccounts && guardedCashAccounts) {
          if (guardedCashAccounts.length > 0) {
            await tx.insert(schema.cashAccounts).values(guardedCashAccounts.map(sanitizeCashAccount)).onConflictDoNothing();
          }
        }
        if (guardedUsers && guardedUsers.length > 0) {
          await tx.insert(schema.users).values(
            guardedUsers.map((u: any) => {
              const ex = currentUsersDB.find((cu) => cu.id === String(u.id));
              return sanitizeUserForInsert(u, ex?.pin, ex);
            })
          );
          if (validUserIds) {
            const allDbSessions = await tx
              .select({ id: schema.deviceSessions.id, userId: schema.deviceSessions.userId })
              .from(schema.deviceSessions);
            for (const s of allDbSessions) {
              if (!validUserIds.has(String(s.userId))) {
                await tx.delete(schema.deviceSessions).where(eq(schema.deviceSessions.id, s.id));
              }
            }
          }
        }
        if (hasValidExpenseCategories && guardedExpenseCategories) {
          const sortedCategories = [...guardedExpenseCategories].sort((a, b) =>
            a.parentId && !b.parentId ? 1 : !a.parentId && b.parentId ? -1 : 0
          );
          if (sortedCategories.length > 0) {
            await tx.insert(schema.expenseCategories).values(sortedCategories.map(sanitizeExpenseCategory)).onConflictDoNothing();
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
        if (kpiTasks !== undefined) {
          if (Array.isArray(kpiTasks) && kpiTasks.length > 0) {
            await tx.insert(schema.kpiTasks).values(kpiTasks.map(sanitizeKpiTask));
          }
        }
        if (kpiBonusRules !== undefined) {
          if (Array.isArray(kpiBonusRules) && kpiBonusRules.length > 0) {
            await tx.insert(schema.kpiBonusRules).values(kpiBonusRules.map(sanitizeKpiBonusRule));
          }
        }
        if (payroll_records !== undefined) {
          const incomingFiltered = Array.isArray(payroll_records)
            ? payroll_records.filter((pr: any) => !existingPaidIds.has(pr.id))
            : [];
          const existingUnpaidOrAll = existingDbPayrolls.filter((pr: any) => !existingPaidIds.has(pr.id));
          const lockedPayrolls = enforceClosedPeriodDataLock(
            incomingFiltered,
            existingUnpaidOrAll,
            effectiveDbClosedPeriods,
            (p: any) => String(p?.period || "")
          );
          if (lockedPayrolls.length > 0) {
            await tx.insert(schema.payrollRecords).values(lockedPayrolls.map(sanitizePayrollRecord));
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
          if (Array.isArray(effectiveDbClosedPeriods) && effectiveDbClosedPeriods.length > 0) {
            const sanitizedClosed = effectiveDbClosedPeriods.map(sanitizeClosedPeriodForDb);
            await tx.execute(sql.raw("SAVEPOINT sp_closed_periods"));
            try {
              await tx.insert(schema.closedPeriods).values(sanitizedClosed);
              await tx.execute(sql.raw("RELEASE SAVEPOINT sp_closed_periods"));
            } catch {
              await tx.execute(sql.raw("ROLLBACK TO SAVEPOINT sp_closed_periods"));
              const withoutSnap = sanitizedClosed.map(({ snapshotJson: _sj, ...rest }) => rest);
              await tx.insert(schema.closedPeriods).values(withoutSnap as any);
              await tx.execute(sql.raw("RELEASE SAVEPOINT sp_closed_periods"));
            }
          }
        }
        if (cash_transactions !== undefined) {
          const lockedCashTx = enforceClosedPeriodDataLock(
            Array.isArray(cash_transactions) ? cash_transactions : [],
            protectedDbAllCashTx,
            effectiveDbClosedPeriods,
            (t: any) => getLocalPeriodFromTimestamp(t?.date)
          );
          const mergedCashTx = mergeByIdPreservingExisting(
            lockedCashTx,
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
        if (daily_sales_recaps !== undefined) {
          const sanitizedIncomingRecaps = Array.isArray(daily_sales_recaps)
            ? daily_sales_recaps.map(sanitizeDailySalesRecap)
            : [];
          const lockedRecaps = enforceClosedPeriodDataLock(
            sanitizedIncomingRecaps,
            existingDbRecaps,
            effectiveDbClosedPeriods,
            (r: any) => getLocalPeriodFromTimestamp(r?.date)
          );
          if (lockedRecaps.length > 0) {
            await tx
              .insert(schema.dailySalesRecaps)
              .values(lockedRecaps)
              .onConflictDoNothing();
          }
        }
        if (recipes !== undefined) {
          if (Array.isArray(recipes) && recipes.length > 0) {
            const uniqueRecipes = dedupeRecipesByMenuName(recipes);
            if (uniqueRecipes.length > 0) {
              await tx.insert(schema.recipes).values(uniqueRecipes.map(sanitizeRecipe)).onConflictDoNothing();
            }
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
        let validOpnameIds: Set<string> | null = null;
        if (stock_opnames !== undefined) {
          if (Array.isArray(stock_opnames)) {
            validOpnameIds = new Set(stock_opnames.map((o: any) => String(o.id)));
            if (stock_opnames.length > 0) {
              await tx.insert(schema.stockOpnames).values(stock_opnames.map(sanitizeStockOpname));
            }
          }
        }
        if (stock_opname_items !== undefined) {
          const rawItems = Array.isArray(stock_opname_items) ? stock_opname_items : [];
          const validItems = validOpnameIds
            ? rawItems.filter((i: any) => validOpnameIds!.has(String(i.opnameId || "")))
            : rawItems;
          if (validItems.length > 0) {
            await tx.execute(sql.raw("SAVEPOINT sp_stock_opname_items"));
            try {
              await tx.insert(schema.stockOpnameItems).values(validItems.map(sanitizeStockOpnameItem));
              await tx.execute(sql.raw("RELEASE SAVEPOINT sp_stock_opname_items"));
            } catch (_insErr: any) {
              await tx.execute(sql.raw("ROLLBACK TO SAVEPOINT sp_stock_opname_items"));
              const withoutDiff = validItems.map((i: any) => {
                const s = sanitizeStockOpnameItem(i);
                const { difference, ...rest } = s;
                return rest;
              });
              await tx.insert(schema.stockOpnameItems).values(withoutDiff as any);
              await tx.execute(sql.raw("RELEASE SAVEPOINT sp_stock_opname_items"));
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
              productGroup: p.productGroup || null,
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
              division: String(bp.division || "BAR"),
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
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      // Sesi tanpa heartbeat lebih dari 15 menit dianggap sudah tidak aktif (offline/closed)
      const STALE_THRESHOLD_MS = 15 * 60 * 1000;
      const now = Date.now();

      if (!isDbConnected && offlineState) {
        const activeSessions = (offlineState.device_sessions || []).filter(
          (s: any) =>
            s.status === "ACTIVE" &&
            now - new Date(s.lastActive).getTime() <= STALE_THRESHOLD_MS,
        );
        return res.json({
          sessions: filterVisibleSessionsForUser(activeSessions, authUser),
        });
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

      // Filter sesi yang benar-benar aktif saat ini sesuai hak akses user
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

      res.json({
        sessions: filterVisibleSessionsForUser(activeSessions, authUser),
      });
    } catch (err) {
      if (offlineState) {
        const authUser = await resolveAuthUser(req).catch(() => null);
        const active = (offlineState.device_sessions || []).filter(
          (s: any) => s.status === "ACTIVE",
        );
        return res.json({
          sessions: authUser ? filterVisibleSessionsForUser(active, authUser) : [],
        });
      }
      console.error("Fetch sessions error:", err);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions/heartbeat", async (req, res) => {
    try {
      const {
        sessionId,
        deviceName,
        browser,
        os,
        deviceType,
        location,
      } = req.body || {};
      const authHeader = req.headers["authorization"] as string | undefined;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const effectiveSessionId = String(sessionId || bearerToken || "").trim();
      if (!effectiveSessionId) {
        return res.status(400).json({ error: "Missing required session info" });
      }

      if (!isDbConnected && offlineState) {
        offlineState.device_sessions = offlineState.device_sessions || [];
        const existing = offlineState.device_sessions.find((s: any) => s.id === effectiveSessionId);
        const sessionUser = existing
          ? (offlineState.users || []).find((u: any) => u.id === existing.userId)
          : null;
        const evalResult = evaluateSessionHeartbeat(existing, sessionUser, Date.now());
        if (!evalResult.allow) {
          if (existing && (evalResult.status === "EXPIRED" || evalResult.status === "SUSPENDED")) {
            existing.status = "REVOKED";
          }
          return res.json({ success: false, revoked: true, status: evalResult.status });
        }
        existing.lastActive = new Date().toISOString();
        if (deviceName) existing.deviceName = String(deviceName);
        if (browser) existing.browser = String(browser);
        if (os) existing.os = String(os);
        if (deviceType) existing.deviceType = String(deviceType);
        if (location) existing.location = String(location);
        return res.json({ success: true, revoked: false, status: "ACTIVE" });
      }

      const existingRows = await db
        .select()
        .from(schema.deviceSessions)
        .where(eq(schema.deviceSessions.id, effectiveSessionId))
        .limit(1);
      const existing = existingRows[0] || null;
      const sessionUser = existing
        ? (
            await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, existing.userId))
              .limit(1)
          )[0] || null
        : null;

      const evalResult = evaluateSessionHeartbeat(existing, sessionUser, Date.now());
      if (!evalResult.allow) {
        if (existing && (evalResult.status === "EXPIRED" || evalResult.status === "SUSPENDED")) {
          await db
            .update(schema.deviceSessions)
            .set({ status: "REVOKED" })
            .where(eq(schema.deviceSessions.id, effectiveSessionId));
        }
        return res.json({ success: false, revoked: true, status: evalResult.status });
      }

      const now = new Date().toISOString();
      const clientIp =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "Localhost";
      const formattedIp = Array.isArray(clientIp)
        ? clientIp[0]
        : String(clientIp).split(",")[0].trim();

      await db
        .update(schema.deviceSessions)
        .set({
          lastActive: now,
          deviceName: String(deviceName || existing.deviceName || "Browser"),
          browser: String(browser || existing.browser || "Web Browser"),
          os: String(os || existing.os || "Unknown OS"),
          deviceType: String(deviceType || existing.deviceType || "desktop"),
          ipAddress: formattedIp,
          ...(location ? { location: String(location) } : {}),
        })
        .where(eq(schema.deviceSessions.id, effectiveSessionId));

      return res.json({ success: true, revoked: false, status: "ACTIVE" });
    } catch (err) {
      console.error("Session heartbeat error:", err);
      res.status(500).json({ error: "Failed to record session" });
    }
  });

  app.post("/api/sessions/:id/revoke", async (req, res) => {
    try {
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      const { id } = req.params;

      if (!isDbConnected && offlineState) {
        offlineState.device_sessions = offlineState.device_sessions || [];
        const target = offlineState.device_sessions.find((s: any) => s.id === id);
        if (!target) {
          return res.status(404).json({ error: "Session not found" });
        }
        if (!canRevokeTargetSession(authUser, target)) {
          return res.status(403).json({ error: "Forbidden: Anda tidak berhak memutus sesi pengguna lain." });
        }
        target.status = "REVOKED";
        return res.json({ success: true, message: "Session revoked successfully" });
      }

      const targetRows = await db
        .select()
        .from(schema.deviceSessions)
        .where(eq(schema.deviceSessions.id, id))
        .limit(1);
      const target = targetRows[0];
      if (!target) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (!canRevokeTargetSession(authUser, target)) {
        return res.status(403).json({ error: "Forbidden: Anda tidak berhak memutus sesi pengguna lain." });
      }

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
      const authUser = await requireAuth(req, res);
      if (!authUser) return;

      const authHeader = req.headers["authorization"] as string | undefined;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const effectiveCurrentSessionId = String(req.body?.currentSessionId || bearerToken || "");

      if (!isDbConnected && offlineState) {
        offlineState.device_sessions = offlineState.device_sessions || [];
        const toRevoke = selectSessionsToRevokeOthers(
          offlineState.device_sessions,
          authUser,
          effectiveCurrentSessionId,
        );
        const revokeSet = new Set(toRevoke.map((s) => s.id));
        offlineState.device_sessions = offlineState.device_sessions.map((s: any) =>
          revokeSet.has(s.id) ? { ...s, status: "REVOKED" } : s,
        );
        return res.json({
          success: true,
          count: toRevoke.length,
          message: `${toRevoke.length} other session(s) revoked`,
        });
      }

      const allSessions = await db.select().from(schema.deviceSessions);
      const toRevoke = selectSessionsToRevokeOthers(
        allSessions,
        authUser,
        effectiveCurrentSessionId,
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
        if (!isDbConnected && offlineState) {
          offlineState.device_sessions = (offlineState.device_sessions || []).map((s: any) =>
            s.id === sessionId ? { ...s, status: "REVOKED" } : s,
          );
        } else {
          await db
            .update(schema.deviceSessions)
            .set({ status: "REVOKED" })
            .where(eq(schema.deviceSessions.id, sessionId));
        }
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
      const requestUser = await resolveAuthUser(req);
      const check = evaluateGenericTableAccess(requestUser, req.params.table);
      if ("error" in check) {
        return res.status(check.status).json({ error: check.error });
      }
      (req as any).authUser = requestUser;
      return next();
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
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success) {
        const userId = String((req as any).authUser?.id || "System");
        const action =
          req.method === "POST"
            ? "CREATE"
            : req.method === "PUT"
              ? "UPDATE"
              : "DELETE";
        const tableName = req.params.table;
        const recordId = req.params.id || req.body?.id || "unknown";

        if (isDbConnected) {
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
      }
      return originalSend.call(this, body);
    };
    next();
  };

  app.post("/api/import/sales", async (req, res) => {
    try {
      const requestUser = await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "FINANCE"]);
      if (!requestUser) return;

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
                error: `File "${log.fileName}" sudah pernah diimpor pada ${new Date(existingLogs[0].importDate).toLocaleString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE })}. Impor ditolak untuk mencegah double count omzet dan pemotongan stok bahan berulang.`,
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
              error: `File "${log.fileName}" sudah pernah diimpor pada ${new Date(existing.importDate).toLocaleString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE })}. Impor ditolak untuk mencegah double count omzet dan pemotongan stok bahan berulang.`,
            });
          }
        }
      }

      if (!log?.fileName || !String(log.fileName).trim()) {
        return res.status(400).json({ error: "Nama file impor wajib disertakan." });
      }
      if (!Array.isArray(sales_transactions) || sales_transactions.length === 0) {
        return res.status(400).json({ error: "Daftar transaksi penjualan tidak boleh kosong." });
      }

      const activeClosedSet = await getActiveClosedPeriodSet();
      const lockedImportPeriods = Array.from(
        new Set(
          sales_transactions
            .map((s: any) => getLocalPeriodFromTimestamp(s?.date))
            .filter((p) => Boolean(p) && activeClosedSet.has(p))
        )
      );
      if (lockedImportPeriods.length > 0) {
        return res.status(400).json({
          error: `Impor ditolak: terdapat transaksi pada periode tutup buku (${lockedImportPeriods.join(", ")}).`,
        });
      }

      const logId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      if (!isDbConnected && offlineState) {
        offlineState.sales_import_logs = offlineState.sales_import_logs || [];
        offlineState.sales_transactions = offlineState.sales_transactions || [];
        offlineState.stock_movements = offlineState.stock_movements || [];
        offlineState.ingredients = offlineState.ingredients || [];

        offlineState.sales_import_logs.unshift(
          sanitizeSalesImportLog({
            id: logId,
            importDate: nowIso,
            fileName: log.fileName,
            rowCount: Number(log.rowCount) || sales_transactions.length,
            status: "SUCCESS",
            createdBy: log.createdBy || requestUser.name || "System",
          })
        );

        const sanitizedTxs = sales_transactions.map((s: any) => ({
          ...sanitizeSalesTransaction(s),
          importLogId: logId,
        }));
        offlineState.sales_transactions.unshift(...sanitizedTxs);

        const rawOffSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
        const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale === true;
        if (shouldAutoDeduct) {
          const allRecipes = offlineState.recipes || [];
          for (const s of sanitizedTxs) {
            const recipe = allRecipes.find(
              (r: any) => String(r.menuName || "").toLowerCase() === String(s.menuName || "").toLowerCase()
            );
            if (!recipe) continue;
            let ingredientsList: any[] = [];
            try {
              ingredientsList = Array.isArray(recipe.ingredients)
                ? recipe.ingredients
                : JSON.parse(recipe.ingredients || "[]");
            } catch {
              ingredientsList = [];
            }
            for (const reqIng of ingredientsList) {
              const ing = offlineState.ingredients.find((i: any) => i.id === reqIng.ingredientId);
              if (!ing) continue;
              const qtyToDeduct = (Number(reqIng.quantity) || 0) * (Number(s.quantitySold) || 0);
              if (qtyToDeduct <= 0) continue;
              ing.currentStock = Number(((Number(ing.currentStock) || 0) - qtyToDeduct).toFixed(4));
              offlineState.stock_movements.push({
                id: crypto.randomUUID(),
                ingredientId: reqIng.ingredientId,
                type: "OUT",
                quantity: qtyToDeduct,
                date: nowIso,
                note: `Auto deduction for sales: ${s.menuName} (${s.quantitySold}x)`,
                unitCost: Math.round(Number(ing.costPerUnit) || 0),
                totalCost: Math.round((Number(ing.costPerUnit) || 0) * qtyToDeduct),
                referenceId: s.id,
                location: null,
                createdBy: "System",
              });
            }
          }
        }

        bumpDataVersion();
        return res.json({ success: true, logId });
      }

      await db.transaction(async (tx) => {
        // Insert log
        await tx.insert(schema.salesImportLogs).values({
          id: logId,
          importDate: nowIso,
          fileName: log.fileName,
          rowCount: Number(log.rowCount) || sales_transactions.length,
          status: "SUCCESS",
          createdBy: log.createdBy || requestUser.name || "System",
        });

        // Insert transactions
        const transactions = sales_transactions.map((s: any) => ({
          ...sanitizeSalesTransaction(s),
          importLogId: logId,
        }));
        await tx.insert(schema.salesTransactions).values(transactions);

        const currentSettings = await tx.select().from(schema.settings).limit(1);
        const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale === true;
        if (shouldAutoDeduct) {
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
                  const nextStock = Number((Number(dbIngredient.currentStock) - qtyToDeduct).toFixed(4));
                  // Deduct current stock
                  await tx.update(schema.ingredients)
                    .set({ currentStock: nextStock })
                    .where(eq(schema.ingredients.id, reqIng.ingredientId));
                  // Update local copy to prevent sequential overwriting
                  dbIngredient.currentStock = nextStock;

                  // Add stock movement log
                  stockMovementsToInsert.push({
                    id: crypto.randomUUID(),
                    ingredientId: reqIng.ingredientId,
                    type: "OUT",
                    quantity: qtyToDeduct,
                    date: nowIso,
                    note: `Auto deduction for sales: ${s.menuName} (${s.quantitySold}x)`,
                    unitCost: Math.round(Number(dbIngredient.costPerUnit) || 0),
                    totalCost: Math.round((Number(dbIngredient.costPerUnit) || 0) * qtyToDeduct),
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
      bumpDataVersion();
      res.json({ success: true, logId });
    } catch (e) {
      console.error("Import sales error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  const PERIOD_LOCKED_GENERIC_TABLES = new Set([
    "cash_transactions",
    "daily_sales_recaps",
    "payroll_records",
    "purchase_orders",
    "sales_transactions",
  ]);

  const extractGenericRowPeriod = (tableName: string, row: any): string | null => {
    if (!row || typeof row !== "object") return null;
    if (tableName === "payroll_records") {
      const p = String(row.period || "").trim().slice(0, 7);
      return /^\d{4}-\d{2}$/.test(p) ? p : null;
    }
    if (row.date) return getLocalPeriodFromTimestamp(row.date);
    if (row.createdAt) return getLocalPeriodFromTimestamp(row.createdAt);
    return null;
  };

  const sanitizeGenericInsertPayload = (tableName: string, body: any) => {
    switch (tableName) {
      case "ingredients":
        return sanitizeIngredient(body);
      case "stock_movements":
        return sanitizeStockMovement(body);
      case "sales_transactions":
        return sanitizeSalesTransaction(body);
      case "daily_sales_recaps":
        return sanitizeDailySalesRecap(body);
      case "sales_import_logs":
        return sanitizeSalesImportLog(body);
      case "cash_transactions":
        return sanitizeCashTransaction(body);
      case "cash_accounts":
        return sanitizeCashAccount(body);
      case "expense_categories":
        return sanitizeExpenseCategory(body);
      case "budgets":
        return sanitizeBudget(body);
      case "bank_reconciliations":
        return sanitizeBankReconciliation(body);
      case "bank_statement_lines":
        return sanitizeBankStatementLine(body);
      case "stock_opnames":
        return sanitizeStockOpname(body);
      case "stock_opname_items":
        return sanitizeStockOpnameItem(body);
      case "payroll_records":
        return sanitizePayrollRecord(body);
      case "purchase_orders":
        return sanitizePurchaseOrder(body);
      default:
        return body;
    }
  };

  app.post(
    "/api/:table",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        if (!isDbConnected) {
          return res.status(503).json({ error: "Database sedang offline." });
        }
        const tableName = req.params.table;
        const table = getTable(tableName);
        if (!table) return res.status(404).json({ error: "Table not found" });
        const payload = sanitizeGenericInsertPayload(tableName, req.body);
        if (PERIOD_LOCKED_GENERIC_TABLES.has(tableName)) {
          const closedSet = await getActiveClosedPeriodSet();
          const period = extractGenericRowPeriod(tableName, payload);
          if (period && closedSet.has(period)) {
            return res.status(400).json({
              error: `Periode ${period} sudah tutup buku dan terkunci dari perubahan.`,
            });
          }
        }
        await db.insert(table).values(payload);
        bumpDataVersion();
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
        if (!isDbConnected) {
          return res.status(503).json({ error: "Database sedang offline." });
        }
        const tableName = req.params.table;
        const table = getTable(tableName);
        if (!table) return res.status(404).json({ error: "Table not found" });
        if (PERIOD_LOCKED_GENERIC_TABLES.has(tableName)) {
          const closedSet = await getActiveClosedPeriodSet();
          const existingRows = await db
            .select()
            .from(table)
            .where(eq(table.id, req.params.id))
            .limit(1);
          const existingPeriod = extractGenericRowPeriod(tableName, existingRows[0]);
          const incomingPeriod = extractGenericRowPeriod(tableName, req.body);
          const lockedPeriod =
            (existingPeriod && closedSet.has(existingPeriod) ? existingPeriod : null) ||
            (incomingPeriod && closedSet.has(incomingPeriod) ? incomingPeriod : null);
          if (lockedPeriod) {
            return res.status(400).json({
              error: `Periode ${lockedPeriod} sudah tutup buku dan terkunci dari perubahan.`,
            });
          }
        }
        await db.update(table).set(req.body).where(eq(table.id, req.params.id));
        bumpDataVersion();
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
        if (!isDbConnected) {
          return res.status(503).json({ error: "Database sedang offline." });
        }
        const tableName = req.params.table;
        const table = getTable(tableName);
        if (!table) return res.status(404).json({ error: "Table not found" });
        if (PERIOD_LOCKED_GENERIC_TABLES.has(tableName)) {
          const closedSet = await getActiveClosedPeriodSet();
          const existingRows = await db
            .select()
            .from(table)
            .where(eq(table.id, req.params.id))
            .limit(1);
          const existingPeriod = extractGenericRowPeriod(tableName, existingRows[0]);
          if (existingPeriod && closedSet.has(existingPeriod)) {
            return res.status(400).json({
              error: `Periode ${existingPeriod} sudah tutup buku dan data tidak dapat dihapus.`,
            });
          }
        }
        await db.delete(table).where(eq(table.id, req.params.id));
        bumpDataVersion();
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

  const resolveGeminiApiKey = async (): Promise<string | null> => {
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
    return apiKey && apiKey.trim().length > 5 ? apiKey.trim() : null;
  };

  app.post("/api/ai/parse-receipt", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "FINANCE"]))) return;
      const { text, imageBase64, mimeType, fileName, storeContext } = req.body;
      const apiKey = await resolveGeminiApiKey();

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

      const runReceiptLocalFallback = (reasonNote?: string) => {
        const smartParsed = effectiveText.trim()
          ? parseSmartCoffeeTextEntry(effectiveText, storeContext)
          : { transactions: [] as any[] };
        const fallbackTransactions: any[] = [...smartParsed.transactions];

        if (fallbackTransactions.length === 0) {
          const nameLower = (fileName || "").toLowerCase();
          const matchedFromFile = matchIngredientFromStore(storeContext?.ingredients || [], nameLower);
          if (nameLower.includes("susu") || nameLower.includes("milk")) {
            fallbackTransactions.push(
              enrichParsedTransactionWithStore(
                {
                  type: "CASH_OUT",
                  amount: 95000,
                  category: "Bahan Baku",
                  description: `Pengadaan Susu Segar (${fileName || "Invoice"})`,
                  ingredientId: matchedFromFile?.id || null,
                  quantity: 5,
                  unit: "liter",
                },
                storeContext,
                nameLower
              )
            );
          } else if (nameLower.includes("kopi") || nameLower.includes("bean") || nameLower.includes("roast")) {
            fallbackTransactions.push(
              enrichParsedTransactionWithStore(
                {
                  type: "CASH_OUT",
                  amount: 185000,
                  category: "Bahan Baku",
                  description: `Biji Kopi Espresso Blend 1kg (${fileName || "Invoice"})`,
                  ingredientId: matchedFromFile?.id || null,
                  quantity: 1,
                  unit: "kg",
                },
                storeContext,
                nameLower
              )
            );
          } else if (nameLower.includes("cup") || nameLower.includes("kemasan")) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 65000,
              category: "Packaging & Kemasan",
              description: `Paper Cup & Lid 12oz (${fileName || "Invoice"})`,
            });
          } else if (effectiveText) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 50000,
              category: "Operasional",
              description: effectiveText.slice(0, 80),
            });
          } else if (fileName) {
            fallbackTransactions.push({
              type: "CASH_OUT",
              amount: 75000,
              category: "Operasional",
              description: `Pengeluaran Operasional (${fileName})`,
            });
          }
        }

        return {
          transactions: fallbackTransactions,
          source: "local-ocr-fallback",
          note:
            reasonNote ||
            `Diproses dengan heuristik cerdas internal${fileName ? ` untuk berkas "${fileName}"` : ""}. Pasang Gemini API Key di Pengaturan untuk pemrosesan OCR penuh dari foto & PDF.`,
        };
      };

      if (!apiKey) {
        return res.json(runReceiptLocalFallback());
      }

      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents: any[] = [];

        let promptText = `Anda adalah asisten akuntansi & data entry untuk Coffee Shop "Julia's Specialty Room".
Konteks Akun Kas: ${JSON.stringify(storeContext?.cashAccounts?.map((a: any) => a.name) || ["Laci Kasir", "Kas Utama", "Bank BCA"])}
Kategori Tersedia: ${JSON.stringify(storeContext?.categories?.map((c: any) => c.name) || ["Bahan Baku", "Packaging & Kemasan", "Kebersihan & Sanitasi", "Utilitas", "Gaji & SDM", "Operasional", "Pendapatan Lain"])}
Master Bahan Baku Toko (cocokkan jika item adalah bahan baku): ${JSON.stringify(
          storeContext?.ingredients?.map((i: any) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.unit,
            purchaseUnit: i.purchaseUnit,
            conversionFactor: i.conversionFactor,
          })) || []
        )}

Instruksi Ekstraksi Nota Campuran & Akuntansi Ketat:
- Pecah tiap baris barang pada nota menjadi transaksi terpisah dengan kategori akurat (pisahkan Bahan Baku, Packaging & Kemasan untuk cup/lid/sedotan/plastik, Kebersihan untuk sabun/tisu/trashbag, serta Ongkir/Pajak/Biaya Layanan ke Operasional — JANGAN masukkan sabun/ongkir ke harga bahan baku).
- Jika nota mencantumkan qty dan harga satuan (@), hitung amount = qty * harga_satuan (dikurangi diskon baris jika ada).
- Pahami singkatan Indonesia: "ssu/fm/uht/gf" = Fresh Milk, "kpi/hb" = Biji Kopi, "krt/krtn" = Karton, "gln" = Galon, "rb/rbu/k" = ribuan, "jt" = jutaan.
- Jika item cocok dengan Master Bahan Baku Toko, isi ingredientId, ingredientName, quantity, unit kemasan beli ("Liter", "Kg", "Karton (12L)", "Dus", "Pack", "gr", "ml"), dan conversionFactor (jumlah baseUnit dalam 1 unit beli).
- Ekstrak vendorName (nama toko/supplier) dan receiptNo (nomor struk/invoice) bila tertera.
`;

        if (imageBase64) {
          const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
          const isImage = mimeType?.startsWith("image/") || fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|heic)$/);

          if (isPdf) {
            promptText += "Analisis dokumen faktur/nota PDF terlampir secara teliti. ";
            contents.push({
              inlineData: { data: imageBase64, mimeType: "application/pdf" }
            });
          } else if (isImage) {
            promptText += "Analisis foto struk/nota belanja terlampir secara teliti. ";
            contents.push({
              inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" }
            });
          }
        }

        if (effectiveText) {
          promptText += `\nTeks/Catatan tambahan pengguna: "${effectiveText}"\n`;
        }

        promptText += "Kembalikan hasil HANYA dalam format JSON sesuai schema.";
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
                      description: { type: Type.STRING },
                      accountName: { type: Type.STRING },
                      vendorName: { type: Type.STRING },
                      receiptNo: { type: Type.STRING },
                      ingredientId: { type: Type.STRING },
                      ingredientName: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      conversionFactor: { type: Type.NUMBER },
                    },
                    required: ["type", "amount", "category", "description"]
                  }
                }
              }
            }
          }
        });

        const jsonStr = response.text;
        if (jsonStr) {
          const result = JSON.parse(jsonStr);
          const enrichedTransactions = Array.isArray(result?.transactions)
            ? result.transactions.map((tx: any) => enrichParsedTransactionWithStore(tx, storeContext, effectiveText))
            : [];
          return res.json({ ...result, transactions: enrichedTransactions, source: "gemini" });
        }
      } catch (gemErr: any) {
        console.warn("Gemini OCR parse failed, auto-fallback to smart local:", gemErr?.message);
        return res.json(
          runReceiptLocalFallback(
            "Koneksi/kuota Gemini sedang terkendala, dialihkan otomatis ke ekstraktor cerdas lokal agar input tetap berjalan."
          )
        );
      }

      return res.json(runReceiptLocalFallback());
    } catch (e: any) {
      console.error("AI parse error:", e);
      res.status(500).json({ error: e?.message || "Failed to parse with AI" });
    }
  });

  // ─── NATURAL LANGUAGE DATA ENTRY API ───────────────────────────────────────
  app.post("/api/ai/parse-natural-entry", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "FINANCE"]))) return;
      const { text, storeContext } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Teks catatan belanja tidak boleh kosong" });
      }

      const apiKey = await resolveGeminiApiKey();

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Anda adalah sistem data entry akuntansi cerdas untuk "Julia's Specialty Room • Coffee • Eatery".
Tugas Anda: mengekstrak catatan kasir/finance/staf (termasuk typo, singkatan chat WA, harga satuan '@', dan nota campuran) menjadi daftar transaksi kas terstruktur.

Konteks Akun Kas: ${JSON.stringify(storeContext?.cashAccounts?.map((a: any) => a.name) || ["Laci Kasir", "Kas Utama", "Bank BCA"])}
Kategori Tersedia: ${JSON.stringify(storeContext?.categories?.map((c: any) => c.name) || ["Bahan Baku", "Packaging & Kemasan", "Kebersihan & Sanitasi", "Utilitas", "Gaji & SDM", "Operasional", "Pendapatan Lain"])}
Daftar Bahan Baku di Gudang/Bar: ${JSON.stringify(
            storeContext?.ingredients?.map((i: any) => ({
              id: i.id,
              name: i.name,
              baseUnit: i.unit,
              purchaseUnit: i.purchaseUnit,
              conversionFactor: i.conversionFactor,
              bulkUnit: i.bulkUnit,
              bulkConversionFactor: i.bulkConversionFactor,
            })) || []
          )}

Teks Catatan: "${text}"

Aturan Pemrosesan Ketat:
1. Pahami singkatan & typo umum: "ssu/fm/gf/uht" = Susu Fresh Milk, "kpi/hb" = Beans Kopi, "gln" = Galon, "krt/krtn/ctn" = Karton, "ktk" = Kotak, "krg/sak" = Karung, "slp" = Slop, "pck/pak" = Pack, "bks" = Bungkus, "klg" = Kaleng, "sch/sct" = Sachet, "btl" = Botol, "jrgn/jrg" = Jerigen, "ltr/lt/l" = Liter, "sdtn" = Sedotan, "pln/token" = Listrik, "gj" = Gaji, "tf/trf" = Transfer Bank, "rb/rbu/k" = x1000, "jt" = x1000000, titik pada "180.000"/"28.500" adalah pemisah ribuan.
2. JIKA ada "@" atau "per", WAJIB kalikan: amount = quantity * harga_satuan (mis. "2 krtn @210rb" => amount 420000; "2,5kg @ 180.000" => amount 450000). Jangan jadikan angka kuantitas ("6 liter 111rb") sebagai harga ("6000")!
3. Abaikan format dimensi ukuran (misal 80x100, 12oz) — jangan jadikan ukuran sebagai nominal!
4. Tentukan type: "CASH_OUT" untuk belanja/beli/bayar/keluar/token/gaji, "CASH_IN" untuk pemasukan/terima/omset.
5. Pisahkan kategori nota campuran: Bahan Baku hanya untuk bahan resep; Packaging untuk cup/lid/sedotan/plastik; Kebersihan untuk sabun/tisu/trashbag; Utilitas untuk listrik/wifi/gas/air PDAM; Ongkir/servis ke Operasional.
6. Wariskan akun kas & vendor jika disebut di awal kalimat untuk item-item berikutnya (mis. "tf bca beli susu ..., kopi ..., pln ..." -> semua akun Bank BCA).
7. Cocokkan ingredientId & ingredientName bila item termasuk bahan baku gudang. Prioritaskan pencocokan 3 tingkat satuan yang dideklarasikan bahan tersebut terlebih dahulu (bulkUnit dengan bulkConversionFactor -> purchaseUnit dengan conversionFactor -> baseUnit dengan 1), baru pakai preset ukuran kemasan standar bila tidak cocok. Lengkapi quantity, unit kemasan beli, dan conversionFactor (berapa baseUnit per 1 unit beli).
8. Buat summary bahasa Indonesia yang ringkas dan ramah.`;

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
                        vendorName: { type: Type.STRING },
                        ingredientId: { type: Type.STRING },
                        ingredientName: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        unit: { type: Type.STRING },
                        conversionFactor: { type: Type.NUMBER },
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
            const enrichedTransactions = Array.isArray(parsed?.transactions)
              ? parsed.transactions.map((tx: any) => enrichParsedTransactionWithStore(tx, storeContext, text))
              : [];
            return res.json({ ...parsed, transactions: enrichedTransactions, source: "gemini" });
          }
        } catch (genErr: any) {
          console.warn("Gemini natural parser failed, falling back to local NLP:", genErr?.message);
        }
      }

      const localResult = parseSmartCoffeeTextEntry(text, storeContext);
      return res.json(localResult);
    } catch (e: any) {
      console.error("Parse natural entry error:", e);
      res.status(500).json({ error: e?.message || "Gagal memproses catatan teks" });
    }
  });

  // ─── EXECUTIVE AI MANAGEMENT INSIGHTS API ──────────────────────────────────
  app.post("/api/ai/executive-insights", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "FINANCE", "OWNER"]))) return;
      const { metrics } = req.body;
      const apiKey = await resolveGeminiApiKey();

      const prompt = `Anda adalah "Julia Coffee AI Copilot" — penasihat bisnis eksekutif & auditor keuangan untuk "Julia's Specialty Room • Coffee • Eatery".
Berdasarkan DATA AKTUAL toko berikut:
${JSON.stringify(metrics || {})}

Berikan ringkasan eksekutif manajemen & keuangan yang padat, berbasis angka nyata di atas, dan langsung actionable dalam format Markdown 5 bagian:
1. 🩺 **Audit Keuangan, Komposisi Biaya & Hutang PO**: Analisis omzet aktual, pengeluaran total vs rincian \`expenseBreakdown\`, margin bersih, saldo \`totalCashLiquidity\`, dan tagihan \`unpaidPoList\` (sebutkan supplier & jatuh tempo terdekat/overdue).
2. 🚨 **Audit Stok Kritis, Waste & Selisih Laci Kas**: Sebutkan bahan kritis (\`lowStockItems\`), nilai \`wasteLossTotal\`, serta selisih kas shift (\`shiftVariances\`) jika ada.
3. 🏆 **Menu Engineering & Audit HPP**: Soroti menu laris vs menu bermargin tipis dari \`menuEngineering\` & \`menuAudit\` (terutama foodCostPct > 35% dan menu margin tebal untuk upselling).
4. 👥 **Audit Tim, Kedisiplinan & Operasional**: Soroti keterlambatan, lembur, atau rasio payroll dari \`hrSummary\`.
5. ⚡ **3 Langkah Aksi Segera**: Rekomendasi konkret hari ini untuk Finance & Manager.

Gunakan bahasa Indonesia profesional dan sebutkan nama menu, bahan, kategori, supplier, serta angka Rupiah aktual dari data (jangan mengarang angka baru).`;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const { response } = await generateContentWithFallback(ai, {
            model: GEMINI_MODEL,
            contents: [{ text: prompt }],
            config: { temperature: 0.4 },
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

      // Data-driven local executive briefing generator
      const rev = Number(metrics?.totalRevenue || 0);
      const exp = Number(metrics?.totalExpense || 0);
      const profit = rev - exp;
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
      const totalLiquidity = Number(metrics?.totalCashLiquidity || 0);
      const unpaidPoTotal = Number(metrics?.unpaidPoTotal || 0);
      const unpaidPoList = Array.isArray(metrics?.unpaidPoList) ? metrics.unpaidPoList : [];
      const expenseBreakdown = Array.isArray(metrics?.expenseBreakdown) ? metrics.expenseBreakdown : [];
      const shiftVariances = Array.isArray(metrics?.shiftVariances) ? metrics.shiftVariances : [];
      const wasteLossTotal = Number(metrics?.wasteLossTotal || 0);
      const lowStockList = Array.isArray(metrics?.lowStockItems) ? metrics.lowStockItems : [];
      const lowStockCount = lowStockList.length;
      const lowStockNames = lowStockCount > 0
        ? lowStockList.slice(0, 5).map((i: any) => `${i.name} (Sisa: ${i.currentStock} ${i.unit}, Min: ${i.minStock} ${i.unit})`).join("; ")
        : "Tidak ada bahan di bawah stok minimum";

      const menuAuditList = Array.isArray(metrics?.menuAudit) ? metrics.menuAudit : [];
      const highFoodCostMenus = menuAuditList
        .filter((m: any) => Number(m.foodCostPct) > 35)
        .sort((a: any, b: any) => b.foodCostPct - a.foodCostPct)
        .slice(0, 4);
      const topProducts = Array.isArray(metrics?.topProducts) ? metrics.topProducts.slice(0, 3) : [];
      const hrSummary = metrics?.hrSummary || {};

      const localBriefing = `### 🩺 1. Audit Keuangan, Komposisi Biaya & Hutang PO
- **Omzet Tercatat:** Rp ${rev.toLocaleString("id-ID")} | **Pengeluaran:** Rp ${exp.toLocaleString("id-ID")} | **Net Cash:** Rp ${profit.toLocaleString("id-ID")} (**${margin}%**).
- **Likuiditas Kas & Bank:** Rp ${totalLiquidity.toLocaleString("id-ID")} | **Hutang PO Belum Lunas:** Rp ${unpaidPoTotal.toLocaleString("id-ID")} (${unpaidPoList.length} tagihan).
${
  expenseBreakdown.length > 0
    ? `- **Pos Biaya Terbesar:** ${expenseBreakdown
        .slice(0, 3)
        .map((e: any) => `${e.category} Rp ${Number(e.total).toLocaleString("id-ID")} (${e.pct}%)`)
        .join(" • ")}.`
    : ""
}
${
  unpaidPoList.length > 0
    ? `- **Prioritas Pelunasan PO:** ${unpaidPoList
        .slice(0, 3)
        .map((p: any) => `${p.poNumber} (${p.supplierName}: Rp ${Number(p.remaining).toLocaleString("id-ID")}${p.dueDate ? `, tempo ${p.dueDate}` : ""})`)
        .join("; ")}.`
    : "- Seluruh PO supplier berstatus lunas."
}

---

### 🚨 2. Audit Stok Kritis, Waste & Laci Kas
- **Stok Kritis (${lowStockCount} bahan):** ${lowStockNames}.
- **Nilai Waste Bahan Tercatat:** Rp ${wasteLossTotal.toLocaleString("id-ID")}.
- **Audit Selisih Laci Kasir (Shift):** ${
        shiftVariances.length > 0
          ? shiftVariances
              .slice(0, 3)
              .map((s: any) => `${s.picName || "Kasir"} (${Number(s.difference) >= 0 ? "+" : ""}Rp ${Number(s.difference).toLocaleString("id-ID")})`)
              .join(", ")
          : "Tidak ditemukan selisih kas shift."
      }

---

### 🏆 3. Menu Engineering & Audit HPP
${
  highFoodCostMenus.length > 0
    ? `- **Menu Laris/Aktif dengan Food Cost >35% (Perlu Evaluasi Harga/Resep):**\n${highFoodCostMenus
        .map(
          (m: any) =>
            `  - **${m.name}**: Jual Rp ${Number(m.price).toLocaleString("id-ID")} | HPP Rp ${Number(m.hpp).toLocaleString("id-ID")} (Food Cost **${m.foodCostPct}%**)`
        )
        .join("\n")}`
    : "- Seluruh varian menu yang memiliki HPP tercatat berada dalam koridor food cost sehat (≤ 35%)."
}
${
  topProducts.length > 0
    ? `- **Menu Terlaris:** ${topProducts
        .map((p: any) => `${p.name} (${p.qty} terjual • Rp ${Number(p.rev).toLocaleString("id-ID")})`)
        .join(", ")}.`
    : "- Belum ada data penjualan item rinci."
}

---

### 👥 4. Audit SDM & Kedisiplinan Tim
- **Karyawan Aktif:** ${Number(hrSummary.activeEmployees || 0)} orang | **Telat Hadir:** ${Number(hrSummary.lateCount || 0)}x | **Lembur Menunggu ACC:** ${Number(hrSummary.pendingOvertimeCount || 0)}.`;

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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "FINANCE", "OWNER"]))) return;
      const { message, chatHistory = [], storeContext } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Pesan tidak boleh kosong" });
      }

      const apiKey = await resolveGeminiApiKey();

      const systemInstruction = `Anda adalah "Julia Coffee AI Copilot" — konsultan bisnis, akuntan finance, dan manajer operasional senior untuk specialty coffee shop Indonesia.
Tugas Anda:
1. SELALU analisis angka aktual dari konteks toko di bawah ini (\`expenseBreakdown\`, \`unpaidPoList\`, \`shiftVariances\`, \`wasteLossTotal\`, \`menuEngineering\`, \`menuAudit\`, \`hrSummary\`, \`lowStockItems\`, \`cashBalances\`) sebelum memberi saran.
2. Sebutkan nama menu, bahan baku, kategori biaya, nama supplier, tanggal jatuh tempo PO, atau akun kas yang spesifik beserta angka Rupiahnya.
3. Menggunakan gaya bahasa Indonesia yang ramah, ringkas, dan terstruktur (bullet points, bold angka kunci).
4. Data Aktual Toko Saat Ini: ${storeContext ? JSON.stringify(storeContext) : "Coffee Shop aktif"}.
Jawab dengan padat, berbobot, dan langsung memberikan langkah aksi.`;

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
              temperature: 0.5,
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

      // Data-Driven Local Coffee & Finance Consultant Fallback
      const lower = message.toLowerCase();
      let fallbackReply = "";
      const ctxMenuAudit = Array.isArray(storeContext?.menuAudit) ? storeContext.menuAudit : [];
      const ctxMenuEng = Array.isArray(storeContext?.menuEngineering) ? storeContext.menuEngineering : [];
      const ctxLowStock = Array.isArray(storeContext?.lowStockItems) ? storeContext.lowStockItems : [];
      const ctxExpenseBreakdown = Array.isArray(storeContext?.expenseBreakdown) ? storeContext.expenseBreakdown : [];
      const ctxUnpaidList = Array.isArray(storeContext?.unpaidPoList) ? storeContext.unpaidPoList : [];
      const ctxShiftVariances = Array.isArray(storeContext?.shiftVariances) ? storeContext.shiftVariances : [];
      const ctxHr = storeContext?.hrSummary || {};
      const ctxRev = Number(storeContext?.totalRevenue || 0);
      const ctxExp = Number(storeContext?.totalExpense || 0);
      const ctxCash = Number(storeContext?.totalCashLiquidity || 0);
      const ctxUnpaidPo = Number(storeContext?.unpaidPoTotal || 0);
      const ctxWasteTotal = Number(storeContext?.wasteLossTotal || 0);

      if (storeContext?.feature === "HPP_CALCULATOR") {
        const simName = storeContext.menuName || "Menu Simulasi";
        const simHpp = Math.round(Number(storeContext.totalHpp || 0));
        const simPrice = Math.round(Number(storeContext.targetSellingPrice || 0));
        const simFoodCost = Number(storeContext.foodCostPercent || 0);
        const simMargin = Number(
          storeContext.grossMarginPercent ??
            (simPrice > 0 ? ((simPrice - simHpp) / simPrice) * 100 : 0)
        );
        const simItems = Array.isArray(storeContext.items) ? storeContext.items : [];
        const highestIng = [...simItems].sort(
          (a: any, b: any) =>
            Number(b.subtotal || b.quantity * b.costPerUnit || 0) -
            Number(a.subtotal || a.quantity * a.costPerUnit || 0)
        )[0];
        const idealPrice30 =
          simHpp > 0 ? Math.ceil(simHpp / 0.3 / 500) * 500 : simPrice;
        fallbackReply = `### ☕ Analisis Simulator HPP: ${simName}
1. **Evaluasi Profitabilitas:** Total HPP **Rp ${simHpp.toLocaleString("id-ID")}** vs Harga Jual **Rp ${simPrice.toLocaleString("id-ID")}** (Food Cost **${simFoodCost.toFixed(1)}%**, Margin **${simMargin.toFixed(1)}%**). ${
          simFoodCost <= 32
            ? "Proporsi ini sudah sangat sehat dan masuk koridor ideal specialty coffee shop (28–32%)."
            : simFoodCost <= 38
              ? `Food Cost sedikit di atas target ideal 32%. Pertimbangkan menaikkan harga ke **Rp ${idealPrice30.toLocaleString("id-ID")}** agar food cost ~30%.`
              : `⚠️ Food Cost terlalu tinggi (>38%), margin rawan tergerus jika harga bahan naik. Harga jual ideal disarankan minimal **Rp ${idealPrice30.toLocaleString("id-ID")}** atau evaluasi gramasi bahan utama.`
        }
${
  highestIng
    ? `2. **Komponen Biaya Tertinggi:** **${highestIng.name}** menyumbang **Rp ${Math.round(Number(highestIng.subtotal || highestIng.quantity * highestIng.costPerUnit || 0)).toLocaleString("id-ID")}**. Beli via PO kemasan grosir/karton dari supplier untuk menekan biaya modal per ${highestIng.unit || "unit"}.`
    : "2. **Struktur Biaya:** Pastikan biaya kemasan/cup dan buffer penyusutan 3–5% tetap diperhitungkan."
}
3. **Strategi Upselling:** Tawarkan *Extra Shot* atau opsi ganti ke *Oat Milk* untuk menaikkan basket size tanpa menambah biaya cup baru.`;
      } else if (lower.includes("hpp") || lower.includes("margin") || lower.includes("harga") || lower.includes("menu")) {
        const sortedByFoodCost = [...ctxMenuAudit].sort((a: any, b: any) => b.foodCostPct - a.foodCostPct);
        const topMarginMenus = [...ctxMenuAudit].sort((a: any, b: any) => a.foodCostPct - b.foodCostPct).slice(0, 3);
        const workhorses = ctxMenuEng.filter((m: any) => m.quadrant === "WORKHORSE").slice(0, 3);
        fallbackReply = `### ☕ Audit HPP, Margin & Menu Engineering
- **Target Food Cost Ideal:** **28% - 32%** dari harga jual nett.
${
  sortedByFoodCost.length > 0
    ? `- **Menu dengan Food Cost Tertinggi:**\n${sortedByFoodCost
        .slice(0, 4)
        .map(
          (m: any) =>
            `  - **${m.name}**: Jual **Rp ${Number(m.price).toLocaleString("id-ID")}** | HPP **Rp ${Number(m.hpp).toLocaleString("id-ID")}** (Food Cost **${m.foodCostPct}%** • Margin ${m.marginPct}%)`
        )
        .join("\n")}
- **Menu Margin Terbaik untuk Dipromosikan:** ${topMarginMenus
        .map((m: any) => `${m.name} (Margin ${m.marginPct}%)`)
        .join(", ")}.`
    : `- **Contoh Referensi HPP Kopi Susu Gula Aren (Cup 12oz):** Espresso 20g (Rp 5.000) + Fresh Milk 120ml (Rp 2.160) + Gula Aren 20ml (Rp 800) + Kemasan (Rp 1.200) = **Rp 9.160**.`
}
${
  workhorses.length > 0
    ? `- **Menu Laris tapi Margin Tipis:** ${workhorses.map((w: any) => `${w.name} (${w.qtySold}x terjual, Food Cost ${w.foodCostPct}%)`).join(", ")}.`
    : ""
}`;
      } else if (lower.includes("kas") || lower.includes("uang") || lower.includes("hutang") || lower.includes("po") || lower.includes("keuangan") || lower.includes("laba") || lower.includes("biaya") || lower.includes("pengeluaran") || lower.includes("hemat")) {
        fallbackReply = `### 💰 Audit Keuangan, Rincian Biaya & Kewajiban PO
- **Omzet Tercatat:** Rp ${ctxRev.toLocaleString("id-ID")} | **Total Pengeluaran:** Rp ${ctxExp.toLocaleString("id-ID")}
- **Saldo Likuiditas Kas & Bank:** Rp ${ctxCash.toLocaleString("id-ID")}
${
  ctxExpenseBreakdown.length > 0
    ? `- **Komposisi Pengeluaran Terbesar:**\n${ctxExpenseBreakdown
        .slice(0, 5)
        .map((b: any) => `  - **${b.category}:** Rp ${Number(b.total).toLocaleString("id-ID")} (**${b.pct}%** dari total keluar)`)
        .join("\n")}\n`
    : ""
}- **Hutang PO Supplier Belum Lunas:** Rp ${ctxUnpaidPo.toLocaleString("id-ID")}${
          ctxUnpaidList.length > 0
            ? `\n${ctxUnpaidList
                .slice(0, 4)
                .map(
                  (p: any) =>
                    `  - **${p.poNumber}** (${p.supplierName}): Sisa **Rp ${Number(p.remaining).toLocaleString("id-ID")}**${p.dueDate ? ` • Jatuh tempo ${p.dueDate}` : ""}`
                )
                .join("\n")}`
            : " (Tidak ada tagihan PO berjalan)"
        }
${
  ctxShiftVariances.length > 0
    ? `- **⚠️ Selisih Laci Kasir Shift:** ${ctxShiftVariances
        .slice(0, 3)
        .map((s: any) => `${s.picName || "Kasir"} (${Number(s.difference) >= 0 ? "+" : ""}Rp ${Number(s.difference).toLocaleString("id-ID")})`)
        .join(", ")}`
    : "- **Audit Laci Kasir:** Seluruh shift tercatat seimbang."
}`;
      } else if (lower.includes("tim") || lower.includes("staf") || lower.includes("lembur") || lower.includes("telat") || lower.includes("absen") || lower.includes("prioritas")) {
        fallbackReply = `### 👥 Audit Kedisiplinan Tim & Prioritas Operasional
- **Staf Aktif:** ${Number(ctxHr.activeEmployees || 0)} karyawan | **Catatan Terlambat:** ${Number(ctxHr.lateCount || 0)}x | **Lembur Menunggu ACC:** ${Number(ctxHr.pendingOvertimeCount || 0)}
- **Stok Kritis Saat Ini:** ${ctxLowStock.length > 0 ? ctxLowStock.slice(0, 4).join(", ") : "Aman"}
- **Tagihan PO Berjalan:** Rp ${ctxUnpaidPo.toLocaleString("id-ID")} (${ctxUnpaidList.length} tagihan)`;
      } else if (lower.includes("rush hour") || lower.includes("antrean") || lower.includes("ramai") || lower.includes("workflow")) {
        fallbackReply = `### ⚡ Tips Optimalisasi Workflow Barista Saat Rush Hour
1. **Zonasi & Spesialisasi Barista:**
   - **Barista 1 (Dial-in & Milk Station):** Fokus dosing, tamping, pulling shot, dan steaming susu. Jangan sentuh kasir atau cup sealing.
   - **Barista 2 (Floater & Kasir):** Terima pesanan di POS, handle pembayaran QRIS/Cash, pasang lid/sedotan, dan serahkan ke pelanggan.
2. **Pre-batching & Mise en Place:**
   - Siapkan kondimen olahan (Saus Gula Aren / Simple Syrup / Cold Brew) lewat fitur **Batch Prep** sebelum jam ramai agar tidak meracik dari nol saat order menumpuk.`;
      } else if (lower.includes("promo") || lower.includes("sepi") || lower.includes("omset") || lower.includes("penjualan")) {
        fallbackReply = `### 📈 Strategi Dongkrak Omset di Jam Sepi (14:00 - 17:00)
1. **Happy Hour "Coffee & Bite" Bundling:** Diskon 15-20% khusus pembelian kopi + pastry di pukul 14.00-17.00${
          ctxMenuAudit.length > 0
            ? ` (prioritaskan bundling dengan ${[...ctxMenuAudit].sort((a: any, b: any) => a.foodCostPct - b.foodCostPct)[0]?.name || "menu margin tertinggi"})`
            : ""
        }.
2. **Upselling Kasir Cerdas:** Tawarkan *Extra Shot Espresso* atau ganti ke *Oat Milk* untuk menaikkan nilai struk rata-rata tanpa menambah biaya akuisisi pelanggan.`;
      } else if (lower.includes("stok") || lower.includes("bahan") || lower.includes("waste") || lower.includes("opname")) {
        fallbackReply = `### 📦 Audit Stok Bahan Baku & Kerugian Waste
${
  ctxLowStock.length > 0
    ? `- **Bahan Baku Kritis Saat Ini (${ctxLowStock.length} item):** ${ctxLowStock.slice(0, 6).join(", ")}.\n`
    : "- Saat ini tidak ada bahan yang berada di bawah batas minimum.\n"
}- **Total Nilai Waste Tercatat:** Rp ${ctxWasteTotal.toLocaleString("id-ID")}
1. **Prinsip FIFO Ketat (First In First Out):** Susu dan sirup yang datang lebih awal wajib dipakai lebih dulu dengan tanggal buka (*opening date tag*).
2. **Audit Opname Rutin:** Lakukan stok opname mingguan dan wajib isi alasan pada setiap bahan yang berselisih.`;
      } else {
        fallbackReply = `### 💡 Ringkasan Cepat Julia Coffee AI
- **Omzet Tercatat:** Rp ${ctxRev.toLocaleString("id-ID")} | **Pengeluaran:** Rp ${ctxExp.toLocaleString("id-ID")} | **Saldo Kas:** Rp ${ctxCash.toLocaleString("id-ID")}
- **Hutang PO Supplier:** Rp ${ctxUnpaidPo.toLocaleString("id-ID")} (${ctxUnpaidList.length} tagihan) | **Nilai Waste:** Rp ${ctxWasteTotal.toLocaleString("id-ID")}
- **Bahan Stok Kritis:** ${ctxLowStock.length > 0 ? ctxLowStock.slice(0, 4).join(", ") : "Aman"}
- **Katalog Menu Terpantau:** ${ctxMenuAudit.length} varian

**Anda dapat menanyakan:**
- *"Bagaimana komposisi pengeluaran terbesar kita & pos mana yang bisa dihemat?"*
- *"Tagihan PO supplier mana saja yang belum lunas?"*
- *"Menu mana yang paling laris tapi food cost-nya tinggi?"*
- *"Apakah ada selisih kas laci shift atau keterlambatan tim?"*`;
      }

      return res.json({
        reply: fallbackReply,
        source: "local-expert",
        note: !apiKey ? "Kunci API Gemini belum diatur di Pengaturan. Menampilkan analisis data internal toko." : undefined
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
    const rawOffDiv =
      offlineState?.settings?.divisionKpiBonusTarget &&
      typeof offlineState.settings.divisionKpiBonusTarget === "object"
        ? offlineState.settings.divisionKpiBonusTarget
        : {};
    const offPaymentMapping = sanitizePaymentAccountMapping(
      rawOffDiv.__paymentAccountMapping || offlineState?.settings?.paymentAccountMapping
    );
    const resolved = resolvePaymentAccountId(
      paymentMethod,
      requestedAccountId,
      offlineState.cash_accounts,
      shift?.cashAccountId,
      offPaymentMapping
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
    const stRows = await tx.select().from(schema.settings).limit(1);
    const rawDbDiv =
      stRows[0]?.divisionKpiBonusTarget && typeof stRows[0].divisionKpiBonusTarget === "object"
        ? (stRows[0].divisionKpiBonusTarget as Record<string, any>)
        : {};
    const dbPaymentMapping = sanitizePaymentAccountMapping(rawDbDiv.__paymentAccountMapping);
    const resolved = resolvePaymentAccountId(
      paymentMethod,
      requestedAccountId,
      accounts,
      shiftCashAccId,
      dbPaymentMapping
    );
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
      if (!(await requireAuth(req, res))) return;
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR", "LEADER"]))) return;
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

      const orderValidation = validatePosOrderPayload({
        items,
        status,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
      });
      if ("error" in orderValidation) {
        return res.status(400).json({ error: orderValidation.error });
      }

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
          const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale === true;
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
          const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale === true;

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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR", "LEADER"]))) return;
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
        const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale === true;
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

        // 1. Klaim order secara atomik agar pembayaran ganda konkuren ditolak
        const claimedOrders = await tx
          .update(schema.orders)
          .set({
            status: "PAID",
            paidAt: nowIso,
            updatedAt: nowIso,
          })
          .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "OPEN")))
          .returning();
        if (claimedOrders.length === 0) {
          throw new Error("ORDER_ALREADY_SETTLED");
        }

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
        const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale === true;

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
      if (e?.message === "ORDER_ALREADY_SETTLED") {
        return res.status(400).json({ error: "Order sudah lunas atau tidak lagi aktif" });
      }
      console.error("Pay order error:", e);
      res.status(500).json({ error: e?.message || "Failed to settle order" });
    }
  });

  // 3b. Split Bill / Pecah Tagihan Meja
  app.post("/api/pos/orders/:id/split", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR", "LEADER"]))) return;
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
        if (parentOrder.status !== "OPEN") {
          return res.status(400).json({ error: `Hanya tagihan berstatus OPEN yang dapat dipecah. Status saat ini: ${parentOrder.status}` });
        }

        const splitOrderId = crypto.randomUUID();
        const splitReceiptNo = `${parentOrder.receiptNo}-S${randomSuffix}`;
        let splitSubtotal = 0;
        let splitTax = 0;
        let splitTotal = 0;
        const insertedSplitItems: any[] = [];
        let evenlyFinalParentItems: any[] = [];

        if (splitMode === "ITEMS") {
          const parentItems = offlineState.order_items.filter((it: any) => it.orderId === parentOrderId);
          for (const sIt of splitItems) {
            const pItem = parentItems.find((it: any) => it.id === sIt.id);
            if (!pItem) continue;
            const splitQty = Math.min(Number(sIt.quantity) || 1, Number(pItem.quantity) || 1);
            if (splitQty <= 0) continue;

            const itemSubtotal = Math.round((Number(pItem.unitPrice) || 0) * splitQty);
            splitSubtotal += itemSubtotal;

            const newSplitItem = {
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

          if (insertedSplitItems.length === 0) {
            return res.status(400).json({ error: "Pilih minimal 1 item valid untuk dipecah." });
          }

          const taxRate = Number(parentOrder.taxPercent) || 0;
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
          const splitCheck = validateEvenlySplitAmount(
            Number(parentOrder.totalAmount) || 0,
            Number(splitAmount) || Number(payment.amount) || 0
          );
          if ("error" in splitCheck) {
            return res.status(400).json({ error: splitCheck.error });
          }
          splitTotal = splitCheck.splitTotal;
          splitSubtotal = splitTotal;
          parentOrder.totalAmount = splitCheck.newParentTotal;
          if (parentOrder.totalAmount <= 0) {
            parentOrder.status = "PAID";
            parentOrder.paidAt = nowIso;
            evenlyFinalParentItems = offlineState.order_items.filter((it: any) => it.orderId === parentOrderId);
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
          taxAmount: splitTax,
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

        const itemsForSalesAndStock = splitMode === "ITEMS" ? insertedSplitItems : evenlyFinalParentItems;
        for (const sItem of itemsForSalesAndStock) {
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

        // Deduct inventory for split items (or final parent items on closing evenly split)
        const rawOffSt = Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings;
        const shouldAutoDeduct = rawOffSt?.autoDeductStockOnSale === true;
        if (shouldAutoDeduct && itemsForSalesAndStock.length > 0) {
          applyOfflineOrderStock(itemsForSalesAndStock, "USAGE", `Split POS #${splitReceiptNo}`, cashierName || "Kasir", splitOrderId, nowIso);
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
      if (parentOrder.status !== "OPEN") {
        return res.status(400).json({ error: `Hanya tagihan berstatus OPEN yang dapat dipecah. Status saat ini: ${parentOrder.status}` });
      }

      const splitOrderId = crypto.randomUUID();
      const splitReceiptNo = `${parentOrder.receiptNo}-S${randomSuffix}`;
      let splitSubtotal = 0;
      let splitTax = 0;
      let splitTotal = 0;
      const insertedSplitItems: any[] = [];
      let evenlyFinalParentItems: any[] = [];

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

          if (insertedSplitItems.length === 0) {
            throw new Error("EMPTY_SPLIT_ITEMS");
          }

          const taxRate = Number(parentOrder.taxPercent) || 0;
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
          const splitCheck = validateEvenlySplitAmount(
            Number(parentOrder.totalAmount) || 0,
            Number(splitAmount) || Number(payment.amount) || 0
          );
          if ("error" in splitCheck) {
            throw new Error(`INVALID_SPLIT_AMOUNT:${splitCheck.error}`);
          }
          splitTotal = splitCheck.splitTotal;
          splitSubtotal = splitTotal;
          const newParentTotal = splitCheck.newParentTotal;
          await tx.update(schema.orders).set({
            totalAmount: newParentTotal,
            status: newParentTotal <= 0 ? "PAID" : parentOrder.status,
            paidAt: newParentTotal <= 0 ? nowIso : parentOrder.paidAt,
            updatedAt: nowIso,
          }).where(eq(schema.orders.id, parentOrderId));
          if (newParentTotal <= 0) {
            evenlyFinalParentItems = await tx
              .select()
              .from(schema.orderItems)
              .where(eq(schema.orderItems.orderId, parentOrderId));
          }
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
          taxAmount: splitTax,
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

        const itemsForSalesAndStock = splitMode === "ITEMS" ? insertedSplitItems : evenlyFinalParentItems;
        for (const sItem of itemsForSalesAndStock) {
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
        const shouldAutoDeduct = currentSettings[0]?.autoDeductStockOnSale === true;
        if (shouldAutoDeduct && itemsForSalesAndStock.length > 0) {
          await applyDbOrderStock(tx, itemsForSalesAndStock, "USAGE", `Split POS #${splitReceiptNo}`, cashierName || "Kasir", splitOrderId, nowIso);
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
      if (e?.message === "EMPTY_SPLIT_ITEMS") {
        return res.status(400).json({ error: "Pilih minimal 1 item valid untuk dipecah." });
      }
      if (typeof e?.message === "string" && e.message.startsWith("INVALID_SPLIT_AMOUNT:")) {
        return res.status(400).json({ error: e.message.slice("INVALID_SPLIT_AMOUNT:".length) });
      }
      console.error("Split order error:", e);
      res.status(500).json({ error: e?.message || "Failed to split order" });
    }
  });

  // 4. Void / Cancel Order with Manager PIN Approval
  app.post("/api/pos/orders/:id/void", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR", "LEADER"]))) return;
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
        const voidOrderPeriod = getLocalPeriodFromTimestamp(targetOrder.createdAt);
        const closedSetVoidOffline = await getActiveClosedPeriodSet();
        if (voidOrderPeriod && closedSetVoidOffline.has(voidOrderPeriod)) {
          return res.status(400).json({
            error: `Order berada pada periode tutup buku (${voidOrderPeriod}) dan tidak dapat di-void.`,
          });
        }
        if (targetOrder.status === "VOID" || targetOrder.status === "CANCELLED" || targetOrder.status === "REFUNDED") {
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
            const payMethod = pay.paymentMethod || pay.method || "CASH";
            const accId =
              pay.cashAccountId ||
              resolveOfflinePaymentAccount(payMethod, undefined, targetOrder.shiftId);
            offlineState.cash_transactions.push({
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

      const voidOrderPeriod = getLocalPeriodFromTimestamp(targetOrder.createdAt);
      const closedSetVoidDb = await getActiveClosedPeriodSet();
      if (voidOrderPeriod && closedSetVoidDb.has(voidOrderPeriod)) {
        return res.status(400).json({
          error: `Order berada pada periode tutup buku (${voidOrderPeriod}) dan tidak dapat di-void.`,
        });
      }

      if (targetOrder.status === "VOID" || targetOrder.status === "CANCELLED" || targetOrder.status === "REFUNDED") {
        return res.status(400).json({ error: `Order sudah dalam status ${targetOrder.status}` });
      }

      const nowIso = new Date().toISOString();
      const wasPaid = targetOrder.status === "PAID";

      await db.transaction(async (tx) => {
        const nextStatus = wasPaid ? "VOID" : "CANCELLED";
        const nextReason = wasPaid
          ? voidReason || "Void oleh manager"
          : voidReason || "Dibatalkan kasir/manager";
        const claimed = await tx
          .update(schema.orders)
          .set({
            status: nextStatus,
            voidReason: nextReason,
            voidApprovedBy: approver.name,
            updatedAt: nowIso,
          })
          .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, targetOrder.status)))
          .returning();
        if (claimed.length === 0) {
          throw new Error("ORDER_ALREADY_VOIDED");
        }

        if (wasPaid) {
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
        message: `Order #${targetOrder.receiptNo} berhasil ${wasPaid ? "di-VOID dan stok dikembalikan" : "dibatalkan"}`,
        approvedBy: approver.name,
      });
    } catch (e: any) {
      if (e?.message === "ORDER_ALREADY_VOIDED") {
        return res.status(400).json({ error: "Order sudah dibatalkan atau diproses sebelumnya" });
      }
      console.error("Void order error:", e);
      res.status(500).json({ error: e?.message || "Failed to void order" });
    }
  });

  // 4b. Refund Paid Order with Manager PIN Approval & Inventory Strategy
  app.post("/api/pos/orders/:id/refund", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR", "LEADER"]))) return;
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
        const refundOrderPeriod = getLocalPeriodFromTimestamp(targetOrder.createdAt);
        const closedSetRefundOffline = await getActiveClosedPeriodSet();
        if (refundOrderPeriod && closedSetRefundOffline.has(refundOrderPeriod)) {
          return res.status(400).json({
            error: `Order berada pada periode tutup buku (${refundOrderPeriod}) dan tidak dapat di-refund.`,
          });
        }
        if (targetOrder.status !== "PAID") {
          return res.status(400).json({ error: `Hanya pesanan berstatus LUNAS (PAID) yang dapat di-refund. Status order saat ini: ${targetOrder.status}` });
        }

        const finalRefundAmount = resolveCappedRefundAmount(targetOrder.totalAmount, customRefundAmount);

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

      const refundOrderPeriod = getLocalPeriodFromTimestamp(targetOrder.createdAt);
      const closedSetRefundDb = await getActiveClosedPeriodSet();
      if (refundOrderPeriod && closedSetRefundDb.has(refundOrderPeriod)) {
        return res.status(400).json({
          error: `Order berada pada periode tutup buku (${refundOrderPeriod}) dan tidak dapat di-refund.`,
        });
      }

      if (targetOrder.status !== "PAID") {
        return res.status(400).json({ error: `Hanya pesanan berstatus LUNAS (PAID) yang dapat di-refund. Status order saat ini: ${targetOrder.status}` });
      }

      const finalRefundAmount = resolveCappedRefundAmount(targetOrder.totalAmount, customRefundAmount);

      await db.transaction(async (tx) => {
        const claimed = await tx
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
          .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "PAID")))
          .returning();
        if (claimed.length === 0) {
          throw new Error("ORDER_ALREADY_REFUNDED");
        }

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
      if (e?.message === "ORDER_ALREADY_REFUNDED") {
        return res.status(400).json({ error: "Order sudah di-refund atau tidak lagi berstatus PAID" });
      }
      console.error("Refund order error:", e);
      res.status(500).json({ error: e?.message || "Failed to refund order" });
    }
  });

  // 4c. Remote In-App Approval: Kasir Request Otorisasi ke HP/Dashboard Manager
  app.post("/api/pos/approvals/request", async (req, res) => {
    try {
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR", "LEADER"]))) return;
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

      const targetOrder = !isDbConnected && offlineState
        ? (offlineState.orders || []).find((o: any) => o.id === orderId)
        : (await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1))[0];

      if (!targetOrder) {
        return res.status(404).json({ error: "Order tidak ditemukan." });
      }

      const reqValidation = validateApprovalRequestInput({
        type,
        orderStatus: targetOrder.status,
        orderTotalAmount: targetOrder.totalAmount,
        requestedAmount: amount,
      });
      if ("error" in reqValidation) {
        return res.status(400).json({ error: reqValidation.error });
      }

      const nowIso = new Date().toISOString();
      const requestId = crypto.randomUUID();

      const newRequest = {
        id: requestId,
        orderId,
        receiptNo: receiptNo || targetOrder.receiptNo,
        type: reqValidation.type,
        amount: reqValidation.normalizedAmount,
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "OWNER", "MANAGER"]))) return;
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
      if (!(await requireAuth(req, res))) return;
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "OWNER", "MANAGER"]))) return;
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

      if (authUser.isSuspended) {
        return res.status(403).json({
          error: "Forbidden: Akun Anda sedang ditangguhkan (suspended).",
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

        // Action is APPROVE -> Validasi order sebelum mengklaim & mengeksekusi
        const targetOrder = (offlineState.orders || []).find((o: any) => o.id === reqItem.orderId);
        if (!targetOrder) {
          return res.status(404).json({ error: "Order terkait tidak ditemukan" });
        }
        const approvalOrderPeriod = getLocalPeriodFromTimestamp(targetOrder.createdAt);
        const closedSetApprovalOffline = await getActiveClosedPeriodSet();
        if (approvalOrderPeriod && closedSetApprovalOffline.has(approvalOrderPeriod)) {
          return res.status(400).json({
            error: `Order berada pada periode tutup buku (${approvalOrderPeriod}) dan tidak dapat diproses.`,
          });
        }
        if (reqItem.type === "REFUND" && targetOrder.status !== "PAID") {
          return res.status(400).json({ error: `Order sudah tidak berstatus PAID (status saat ini: ${targetOrder.status})` });
        }
        if (
          reqItem.type === "VOID" &&
          (targetOrder.status === "VOID" || targetOrder.status === "CANCELLED" || targetOrder.status === "REFUNDED")
        ) {
          return res.status(400).json({ error: `Order sudah dalam status final (${targetOrder.status})` });
        }

        reqItem.status = "APPROVED";
        reqItem.respondedAt = nowIso;
        reqItem.respondedBy = managerName;
        reqItem.responseNote = responseNote;

        const items = (offlineState.order_items || []).filter((it: any) => it.orderId === targetOrder.id);

        if (reqItem.type === "REFUND") {
          const finalRefundAmount = resolveCappedRefundAmount(targetOrder.totalAmount, reqItem.amount);
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
              const payMethod = pay.paymentMethod || pay.method || "CASH";
              const accId =
                pay.cashAccountId ||
                resolveOfflinePaymentAccount(payMethod, undefined, targetOrder.shiftId);
              offlineState.cash_transactions.push({
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
        const rejectedRows = await db
          .update(schema.managerApprovalRequests)
          .set({
            status: "REJECTED",
            respondedAt: nowIso,
            respondedBy: managerName,
            responseNote: responseNote,
          })
          .where(and(eq(schema.managerApprovalRequests.id, id), eq(schema.managerApprovalRequests.status, "PENDING")))
          .returning();
        if (rejectedRows.length === 0) {
          return res.status(400).json({ error: "Permintaan sudah diproses sebelumnya" });
        }

        bumpDataVersion();
        return res.json({ success: true, status: "REJECTED", message: "Permintaan ditolak" });
      }

      // Action is APPROVE -> Atomik di dalam transaksi DB
      await db.transaction(async (tx) => {
        const claimedRequests = await tx
          .update(schema.managerApprovalRequests)
          .set({
            status: "APPROVED",
            respondedAt: nowIso,
            respondedBy: managerName,
            responseNote: responseNote,
          })
          .where(and(eq(schema.managerApprovalRequests.id, id), eq(schema.managerApprovalRequests.status, "PENDING")))
          .returning();
        if (claimedRequests.length === 0) {
          throw new Error("APPROVAL_ALREADY_PROCESSED");
        }

        const orderList = await tx.select().from(schema.orders).where(eq(schema.orders.id, reqItem.orderId)).limit(1);
        if (orderList.length === 0) {
          throw new Error("APPROVAL_ORDER_NOT_FOUND");
        }
        const targetOrder = orderList[0];
        const approvalOrderPeriod = getLocalPeriodFromTimestamp(targetOrder.createdAt);
        const closedSetApprovalDb = await getActiveClosedPeriodSet(tx);
        if (approvalOrderPeriod && closedSetApprovalDb.has(approvalOrderPeriod)) {
          throw new Error(`APPROVAL_ORDER_CLOSED_PERIOD:${approvalOrderPeriod}`);
        }
        const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, targetOrder.id));

        if (reqItem.type === "REFUND") {
          const finalRefundAmount = resolveCappedRefundAmount(targetOrder.totalAmount, reqItem.amount);

          const claimedOrder = await tx
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
            .where(and(eq(schema.orders.id, targetOrder.id), eq(schema.orders.status, "PAID")))
            .returning();
          if (claimedOrder.length === 0) {
            throw new Error("APPROVAL_ORDER_INVALID_STATE");
          }

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

          await tx.insert(schema.auditLogs).values({
            id: crypto.randomUUID(),
            userId: authUser.id,
            action: "REFUND",
            tableName: "orders",
            recordId: targetOrder.id,
            timestamp: nowIso,
          });
        } else if (reqItem.type === "VOID") {
          if (targetOrder.status === "VOID" || targetOrder.status === "CANCELLED" || targetOrder.status === "REFUNDED") {
            throw new Error("APPROVAL_ORDER_INVALID_STATE");
          }

          const wasPaid = targetOrder.status === "PAID";
          const nextVoidStatus = wasPaid ? "VOID" : "CANCELLED";
          const claimedOrder = await tx
            .update(schema.orders)
            .set({
              status: nextVoidStatus,
              voidReason: reqItem.reason,
              voidApprovedBy: managerName,
              updatedAt: nowIso,
            })
            .where(and(eq(schema.orders.id, targetOrder.id), eq(schema.orders.status, targetOrder.status)))
            .returning();
          if (claimedOrder.length === 0) {
            throw new Error("APPROVAL_ORDER_INVALID_STATE");
          }

          if (wasPaid) {
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
      });

      bumpDataVersion();

      res.json({
        success: true,
        status: "APPROVED",
        message: `Permintaan ${reqItem.type} #${reqItem.receiptNo} berhasil disetujui`,
      });
    } catch (e: any) {
      if (e?.message === "APPROVAL_ALREADY_PROCESSED") {
        return res.status(400).json({ error: "Permintaan sudah diproses sebelumnya" });
      }
      if (e?.message === "APPROVAL_ORDER_NOT_FOUND") {
        return res.status(404).json({ error: "Order terkait tidak ditemukan" });
      }
      if (e?.message === "APPROVAL_ORDER_INVALID_STATE") {
        return res.status(400).json({ error: "Status order sudah berubah dan tidak memenuhi syarat untuk diproses" });
      }
      if (typeof e?.message === "string" && e.message.startsWith("APPROVAL_ORDER_CLOSED_PERIOD:")) {
        const closedP = e.message.slice("APPROVAL_ORDER_CLOSED_PERIOD:".length);
        return res.status(400).json({ error: `Order berada pada periode tutup buku (${closedP}) dan tidak dapat diproses.` });
      }
      console.error("Respond approval error:", e);
      res.status(500).json({ error: e?.message || "Failed to respond to approval" });
    }
  });

  // 5. Get Active Open Bills
  app.get("/api/pos/orders/active", async (req, res) => {
    try {
      if (!(await requireAuth(req, res))) return;
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
      if (!(await requireAuth(req, res))) return;
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "OWNER", "MANAGER", "FINANCE", "KASIR"]))) return;
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
      if (!(await requireAuth(req, res))) return;
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
      if (!(await requireAuth(req, res))) return;
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "KASIR"]))) return;
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

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Nama printer wajib diisi" });
      }

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
      const authUser = await resolveAuthUser(req);
      if (authUser?.role === "OWNER" || authUser?.isSuspended) {
        return res.status(403).json({ error: "Forbidden: Akun tidak diizinkan mengubah status KDS" });
      }
      const itemId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status wajib diisi" });
      }
      if (!isValidKitchenStatus(status)) {
        return res.status(400).json({ error: "Status KDS tidak valid" });
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
      const authUser = await resolveAuthUser(req);
      if (authUser?.role === "OWNER" || authUser?.isSuspended) {
        return res.status(403).json({ error: "Forbidden: Akun tidak diizinkan mengubah status KDS" });
      }
      const orderId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status wajib diisi" });
      }
      if (!isValidKitchenStatus(status)) {
        return res.status(400).json({ error: "Status KDS tidak valid" });
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER", "FINANCE", "OWNER"]))) return;
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "MANAGER"]))) return;
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
      if (!(await requireAuth(req, res, ["SUPER_ADMIN", "OWNER", "MANAGER", "FINANCE"]))) return;
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

      const operationalTransactions = transactions.filter((t) => !isNonOperationalCashTransaction(t));
      const currentTx = operationalTransactions.filter((t) => getTxPeriod(t.date) === currentPeriod);
      const prevTx = operationalTransactions.filter((t) => getTxPeriod(t.date) === prevPeriod);

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

  // ─── ADMIN DATA PURGE / RESET ENDPOINT (Pembersihan Data Uji Coba) ──────────────
  // Syarat: sesi login aktif ber-role SUPER_ADMIN + ketik ulang PIN sendiri + kalimat konfirmasi.
  // Master data (menu, resep, bahan, user, pengaturan, rekening) TIDAK dihapus.
  const RESET_CONFIRM_TEXT = "HAPUS DATA UJI COBA";
  app.post("/api/admin/reset-transactions", pinVerifyLimiter, async (req, res) => {
    try {
      const requestUser: any = await resolveAuthUser(req);
      if (!requestUser) {
        return res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });
      }
      if (requestUser.isSuspended) {
        return res.status(403).json({ error: "Akun sedang ditangguhkan (suspended)." });
      }
      if (requestUser.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Hanya Super Admin yang boleh mereset data." });
      }

      const { pin, confirmText } = req.body || {};
      if (confirmText !== RESET_CONFIRM_TEXT) {
        return res.status(400).json({ error: `Ketik persis: ${RESET_CONFIRM_TEXT}` });
      }

      const rawPin = String(pin || "");
      const hashedPin = rawPin.length === 64 ? rawPin : crypto.createHash("sha256").update(rawPin).digest("hex");
      if (!rawPin || (requestUser.pin !== hashedPin && requestUser.pin !== rawPin)) {
        return res.status(403).json({ error: "PIN Super Admin salah." });
      }

      const resetAudit = {
        id: crypto.randomUUID(),
        userId: requestUser.id,
        action: "DELETE",
        tableName: "RESET_DATA_UJI_COBA",
        recordId: "ALL_TRANSACTIONS",
        timestamp: new Date().toISOString(),
      };

      if (!isDbConnected && offlineState) {
        offlineState.orders = [];
        offlineState.order_items = [];
        offlineState.payments = [];
        offlineState.sales_transactions = [];
        offlineState.daily_sales_recaps = [];
        offlineState.sales_import_logs = [];
        offlineState.shifts = [];
        offlineState.cash_transactions = [];
        offlineState.stock_movements = [];
        offlineState.stock_opnames = [];
        offlineState.stock_opname_items = [];
        offlineState.dailyAttendances = [];
        offlineState.dailyChecklists = [];
        offlineState.attendances = [];
        offlineState.audit_logs = [resetAudit];
        offlineState.payroll_records = [];
        offlineState.kpiRecords = [];
        offlineState.batch_preparations = [];
        offlineState.manager_approval_requests = [];
        bumpDataVersion();
        return res.json({ success: true, message: "Data transaksional berhasil dibersihkan (Offline Mode)." });
      }

      await db.transaction(async (tx) => {
        // Hapus pesanan dan pembayaran POS
        await tx.delete(schema.payments);
        await tx.delete(schema.orderItems);
        await tx.delete(schema.orders);

        // Hapus penjualan & mutasi kas
        await tx.delete(schema.salesTransactions);
        await tx.delete(schema.dailySalesRecaps);
        await tx.delete(schema.salesImportLogs);
        await tx.delete(schema.cashTransactions);
        await tx.delete(schema.shifts);

        // Hapus kartu stok & opname
        await tx.delete(schema.stockMovements);
        await tx.delete(schema.stockOpnameItems);
        await tx.delete(schema.stockOpnames);

        // Hapus catatan presensi & payroll uji coba
        await tx.delete(schema.dailyAttendances);
        await tx.delete(schema.dailyChecklists);
        await tx.delete(schema.attendanceRecords);
        await tx.delete(schema.payrollRecords);
        await tx.delete(schema.kpiRecords);
        await tx.delete(schema.batchPreparations);
        await tx.delete(schema.managerApprovalRequests);
        await tx.delete(schema.auditLogs);

        // Jejak audit: siapa yang melakukan reset
        await tx.insert(schema.auditLogs).values(resetAudit);
      });

      bumpDataVersion();
      res.json({
        success: true,
        message: "Data transaksi, shift, presensi, dan log uji coba berhasil dibersihkan ke kondisi awal.",
      });
    } catch (err: any) {
      console.error("Gagal membersihkan data transaksi:", err);
      res.status(500).json({ error: err?.message || "Gagal membersihkan data transaksi" });
    }
  });

  // ─── ADMIN DATA INVENTORY, BACKUP & CLIENT CLEANING ENDPOINTS (SUPER_ADMIN) ─────
  const requireSuperAdminAuth = async (req: express.Request, res: express.Response) => {
    const requestUser: any = await resolveAuthUser(req);
    if (!requestUser) {
      res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });
      return null;
    }
    if (requestUser.isSuspended) {
      res.status(403).json({ error: "Akun sedang ditangguhkan (suspended)." });
      return null;
    }
    if (requestUser.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Hanya Super Admin yang berhak mengakses fitur cleaning data." });
      return null;
    }
    return requestUser;
  };

  const INVENTORY_TABLE_MAP = [
    { name: "orders", table: schema.orders, offlineKey: "orders" },
    { name: "order_items", table: schema.orderItems, offlineKey: "order_items" },
    { name: "payments", table: schema.payments, offlineKey: "payments" },
    { name: "shifts", table: schema.shifts, offlineKey: "shifts" },
    { name: "sales_transactions", table: schema.salesTransactions, offlineKey: "sales_transactions" },
    { name: "daily_sales_recaps", table: schema.dailySalesRecaps, offlineKey: "daily_sales_recaps" },
    { name: "sales_import_logs", table: schema.salesImportLogs, offlineKey: "sales_import_logs" },
    { name: "manager_approval_requests", table: schema.managerApprovalRequests, offlineKey: "manager_approval_requests" },
    { name: "cash_transactions", table: schema.cashTransactions, offlineKey: "cash_transactions" },
    { name: "budgets", table: schema.budgets, offlineKey: "budgets" },
    { name: "bank_reconciliations", table: schema.bankReconciliations, offlineKey: "bank_reconciliations" },
    { name: "bank_statement_lines", table: schema.bankStatementLines, offlineKey: "bank_statement_lines" },
    { name: "closed_periods", table: schema.closedPeriods, offlineKey: "closed_periods" },
    { name: "stock_movements", table: schema.stockMovements, offlineKey: "stock_movements" },
    { name: "stock_opnames", table: schema.stockOpnames, offlineKey: "stock_opnames" },
    { name: "stock_opname_items", table: schema.stockOpnameItems, offlineKey: "stock_opname_items" },
    { name: "purchase_orders", table: schema.purchaseOrders, offlineKey: "purchase_orders" },
    { name: "daily_attendances", table: schema.dailyAttendances, offlineKey: "dailyAttendances" },
    { name: "daily_checklists", table: schema.dailyChecklists, offlineKey: "dailyChecklists" },
    { name: "attendance_records", table: schema.attendanceRecords, offlineKey: "attendances" },
    { name: "payroll_records", table: schema.payrollRecords, offlineKey: "payroll_records" },
    { name: "kpi_records", table: schema.kpiRecords, offlineKey: "kpiRecords" },
    { name: "audit_logs", table: schema.auditLogs, offlineKey: "audit_logs" },
    { name: "products", table: schema.products, offlineKey: "products" },
    { name: "recipes", table: schema.recipes, offlineKey: "recipes" },
    { name: "batch_preparations", table: schema.batchPreparations, offlineKey: "batch_preparations" },
    { name: "ingredients", table: schema.ingredients, offlineKey: "ingredients" },
    { name: "suppliers", table: schema.suppliers, offlineKey: "suppliers" },
    { name: "employees", table: schema.employees, offlineKey: "employees" },
    { name: "employee_contracts", table: schema.employeeContracts, offlineKey: "contracts" },
    { name: "employee_shifts", table: schema.employeeShifts, offlineKey: "employeeShifts" },
    { name: "promotions", table: schema.promotions, offlineKey: "promotions" },
    { name: "users", table: schema.users, offlineKey: "users" },
    { name: "device_sessions", table: schema.deviceSessions, offlineKey: "device_sessions" },
    { name: "pos_printers", table: schema.posPrinters, offlineKey: "pos_printers" },
    { name: "kpi_tasks", table: schema.kpiTasks, offlineKey: "kpiTasks" },
    { name: "kpi_bonus_rules", table: schema.kpiBonusRules, offlineKey: "kpiBonusRules" },
    { name: "expense_categories", table: schema.expenseCategories, offlineKey: "expense_categories" },
    { name: "cash_accounts", table: schema.cashAccounts, offlineKey: "cash_accounts" },
    { name: "settings", table: schema.settings, offlineKey: "settings" },
  ] as const;

  const getDatabaseTableCounts = async (executor: any = db): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    if (!isDbConnected && offlineState) {
      for (const item of INVENTORY_TABLE_MAP) {
        const val = offlineState[item.offlineKey];
        counts[item.name] = Array.isArray(val) ? val.length : val ? 1 : 0;
      }
      return counts;
    }
    const results = await Promise.all(
      INVENTORY_TABLE_MAP.map(async (item) => {
        try {
          const rows = await executor
            .select({ cnt: sql<number>`count(*)::int` })
            .from(item.table);
          return [item.name, Number(rows?.[0]?.cnt || 0)] as const;
        } catch {
          return [item.name, 0] as const;
        }
      })
    );
    for (const [name, cnt] of results) {
      counts[name] = cnt;
    }
    return counts;
  };

  app.get("/api/admin/data-inventory", async (req, res) => {
    try {
      const requestUser = await requireSuperAdminAuth(req, res);
      if (!requestUser) return;

      const currentSessionId = String(req.headers["x-session-id"] || "").trim();
      const tableCounts = await getDatabaseTableCounts();

      let userRows: any[] = [];
      let cashAccountRows: any[] = [];
      let settingsRow: any = initialSettings;
      let categoryRows: any[] = [];
      let sessionRows: any[] = [];

      if (!isDbConnected && offlineState) {
        userRows = offlineState.users || [];
        cashAccountRows = offlineState.cash_accounts || [];
        settingsRow =
          (Array.isArray(offlineState.settings) ? offlineState.settings[0] : offlineState.settings) ||
          initialSettings;
        categoryRows = offlineState.expense_categories || [];
        sessionRows = offlineState.device_sessions || [];
      } else {
        const [u, ca, st, ec, ds] = await Promise.all([
          db.select().from(schema.users),
          db.select().from(schema.cashAccounts),
          db.select().from(schema.settings).limit(1),
          db.select().from(schema.expenseCategories),
          db.select().from(schema.deviceSessions),
        ]);
        userRows = u;
        cashAccountRows = ca;
        settingsRow = st[0] || initialSettings;
        categoryRows = ec;
        sessionRows = ds;
      }

      const cleaningMeta = extractCleaningMetaFromSettings(settingsRow);
      const coreCategoryCount = categoryRows.filter((c: any) =>
        CORE_EXPENSE_CATEGORY_IDS.has(String(c.id))
      ).length;
      const customCategoryCount = Math.max(0, categoryRows.length - coreCategoryCount);
      const otherUsersCount = userRows.filter(
        (u: any) => String(u.id) !== String(requestUser.id)
      ).length;
      const cleanableSessionsCount = sessionRows.filter(
        (s: any) => !currentSessionId || String(s.id) !== currentSessionId
      ).length;

      const groupCounts: Record<string, number> = {};
      for (const def of CLEANING_GROUP_DEFINITIONS) {
        if (def.key === "dummyUsers") {
          groupCounts[def.key] = otherUsersCount;
        } else if (def.key === "devicesPrinters") {
          groupCounts[def.key] = Number(tableCounts.pos_printers || 0) + cleanableSessionsCount;
        } else if (def.key === "customExpenseCategories") {
          groupCounts[def.key] = customCategoryCount;
        } else {
          groupCounts[def.key] = def.tables.reduce(
            (sum, tbl) => sum + Number(tableCounts[tbl] || 0),
            0
          );
        }
      }

      res.json({
        isDbConnected,
        tableCounts,
        groupCounts,
        protectedSummary: {
          users: userRows.map(sanitizeUser),
          cashAccounts: cashAccountRows.map(sanitizeCashAccount),
          settings: {
            brandName: String(settingsRow?.brandName || "Julia's"),
            companyAddress: String(settingsRow?.companyAddress || ""),
            bankDetails: String(settingsRow?.bankDetails || ""),
            footerMessage: String(settingsRow?.footerMessage || ""),
            taxEnabled: Boolean(settingsRow?.taxEnabled ?? false),
            taxRate: Number(settingsRow?.taxRate ?? 10),
            taxMode: String(settingsRow?.taxMode || "EXCLUSIVE"),
            monthlyRevenueTarget: Number(settingsRow?.monthlyRevenueTarget ?? 150000000),
            autoDeductStockOnSale: settingsRow?.autoDeductStockOnSale === true,
            autoSeedDisabled: cleaningMeta.autoSeedDisabled,
            lastCleanedAt: cleaningMeta.lastCleanedAt,
          },
          expenseCategories: {
            total: categoryRows.length,
            coreCount: coreCategoryCount,
            customCount: customCategoryCount,
          },
        },
      });
    } catch (err: any) {
      console.error("Gagal memuat inventaris database:", err);
      res.status(500).json({ error: err?.message || "Gagal memuat inventaris database" });
    }
  });

  app.get("/api/admin/data-backup", async (req, res) => {
    try {
      const requestUser = await requireSuperAdminAuth(req, res);
      if (!requestUser) return;

      const tableCounts = await getDatabaseTableCounts();
      const data: Record<string, any[]> = {};

      if (!isDbConnected && offlineState) {
        for (const item of INVENTORY_TABLE_MAP) {
          const raw = offlineState[item.offlineKey];
          data[item.name] = Array.isArray(raw) ? raw : raw ? [raw] : [];
        }
      } else {
        const rowsList = await Promise.all(
          INVENTORY_TABLE_MAP.map(async (item) => {
            try {
              const rows = await db.select().from(item.table);
              return [item.name, rows as any[]] as const;
            } catch {
              return [item.name, [] as any[]] as const;
            }
          })
        );
        for (const [name, rows] of rowsList) {
          data[name] = [...rows];
        }
      }

      // Hapus field sensitif (PIN, hash PIN, API key) dari snapshot backup
      if (Array.isArray(data.users)) {
        data.users = data.users.map(sanitizeUser);
      }
      if (Array.isArray(data.settings)) {
        data.settings = data.settings.map((st: any) => {
          const copy = { ...st };
          delete copy.gemini_api_key;
          delete copy.geminiApiKey;
          delete copy.posSupervisorPin;
          return copy;
        });
      }

      const settingsRow = data.settings?.[0];
      const brandName = String(settingsRow?.brandName || "Cafe");
      const nowIso = new Date().toISOString();
      const localDateStamp = getLocalDateString(new Date());
      const filename = `backup-erp-${localDateStamp}.json`;

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.json({
        exportedAt: nowIso,
        exportedBy: requestUser.username,
        brandName,
        tableCounts,
        data,
      });
    } catch (err: any) {
      console.error("Gagal membuat backup JSON:", err);
      res.status(500).json({ error: err?.message || "Gagal membuat backup JSON" });
    }
  });

  app.post("/api/admin/clean-data", pinVerifyLimiter, async (req, res) => {
    try {
      const requestUser = await requireSuperAdminAuth(req, res);
      if (!requestUser) return;

      const { pin, confirmText } = req.body || {};
      if (confirmText !== CLEANING_CONFIRM_PHRASE) {
        return res.status(400).json({ error: `Ketik persis: ${CLEANING_CONFIRM_PHRASE}` });
      }

      const rawPin = String(pin || "");
      const hashedPin =
        rawPin.length === 64 ? rawPin : crypto.createHash("sha256").update(rawPin).digest("hex");
      if (!rawPin || (requestUser.pin !== hashedPin && requestUser.pin !== rawPin)) {
        return res.status(403).json({ error: "PIN Super Admin salah." });
      }

      const groups = parseCleaningGroups(req.body?.groups);
      const disableAutoSeed = req.body?.disableAutoSeed !== false;
      const keepUserIds = new Set<string>([
        String(requestUser.id),
        ...(Array.isArray(req.body?.keepUserIds) ? req.body.keepUserIds.map(String) : []),
      ]);
      const currentSessionId = String(req.headers["x-session-id"] || "").trim();

      let currentUsersSnapshot: any[] = [];
      if (!isDbConnected && offlineState) {
        currentUsersSnapshot = offlineState.users || [];
      } else {
        currentUsersSnapshot = await db.select().from(schema.users);
      }

      const keptUsernames = currentUsersSnapshot
        .filter((u: any) => !groups.dummyUsers || keepUserIds.has(String(u.id)))
        .map((u: any) => String(u.username || "").toLowerCase())
        .filter(Boolean);

      const clientValidation = validateClientSetupPayload(req.body?.clientSetup, keptUsernames);
      if (!clientValidation.valid) {
        return res.status(400).json({
          error: clientValidation.errors[0] || "Konfigurasi setup klien tidak valid.",
          errors: clientValidation.errors,
        });
      }

      const clientSetup = clientValidation.sanitized;
      const beforeCounts = await getDatabaseTableCounts();
      const cleanedAt = new Date().toISOString();
      const selectedGroupKeys = Object.entries(groups)
        .filter(([, checked]) => Boolean(checked))
        .map(([k]) => k);

      const cleanAudit = {
        id: crypto.randomUUID(),
        userId: String(requestUser.id),
        action: "DELETE",
        tableName: "CLEAN_CLIENT_DATA",
        recordId: selectedGroupKeys.join(",") || "SETUP_ONLY",
        timestamp: cleanedAt,
      };

      let createdUsersCount = 0;
      let updatedCashAccountsCount = 0;

      if (!isDbConnected && offlineState) {
        if (groups.salesPos) {
          offlineState.payments = [];
          offlineState.order_items = [];
          offlineState.orders = [];
          offlineState.sales_transactions = [];
          offlineState.daily_sales_recaps = [];
          offlineState.sales_import_logs = [];
          offlineState.shifts = [];
          offlineState.manager_approval_requests = [];
        }
        if (groups.financeCash) {
          offlineState.bank_statement_lines = [];
          offlineState.bank_reconciliations = [];
          offlineState.cash_transactions = [];
          offlineState.budgets = [];
          offlineState.closed_periods = [];
        }
        if (groups.inventoryOps) {
          offlineState.stock_opname_items = [];
          offlineState.stock_opnames = [];
          offlineState.stock_movements = [];
          offlineState.purchase_orders = [];
          if (!groups.catalogIngredients && Array.isArray(offlineState.ingredients)) {
            offlineState.ingredients = offlineState.ingredients.map((ing: any) => ({
              ...ing,
              currentStock: 0,
            }));
          }
        }
        if (groups.hrAudit) {
          offlineState.dailyAttendances = [];
          offlineState.dailyChecklists = [];
          offlineState.attendances = [];
          offlineState.payroll_records = [];
          offlineState.kpiRecords = [];
          offlineState.audit_logs = [];
        }
        if (groups.catalogMenu) {
          offlineState.batch_preparations = [];
          offlineState.recipes = [];
          offlineState.products = [];
        }
        if (groups.catalogIngredients) {
          offlineState.ingredients = [];
        }
        if (groups.hrSuppliers) {
          offlineState.employeeShifts = [];
          offlineState.contracts = [];
          offlineState.employees = [];
          offlineState.suppliers = [];
        }
        if (groups.promotions) {
          offlineState.promotions = [];
        }
        if (groups.dummyUsers && Array.isArray(offlineState.users)) {
          offlineState.users = offlineState.users.filter((u: any) =>
            keepUserIds.has(String(u.id))
          );
        }
        if (groups.devicesPrinters) {
          offlineState.pos_printers = [];
          offlineState.device_sessions = (offlineState.device_sessions || []).filter(
            (s: any) => currentSessionId && String(s.id) === currentSessionId
          );
        }
        if (groups.kpiTemplates) {
          offlineState.kpiTasks = [];
          offlineState.kpiBonusRules = [];
        }
        if (groups.customExpenseCategories) {
          offlineState.expense_categories = (offlineState.expense_categories || []).filter(
            (c: any) => CORE_EXPENSE_CATEGORY_IDS.has(String(c.id))
          );
          const existingCatIds = new Set(
            offlineState.expense_categories.map((c: any) => String(c.id))
          );
          for (const coreCat of defaultCategories) {
            if (!existingCatIds.has(coreCat.id)) {
              offlineState.expense_categories.push(coreCat);
            }
          }
        }

        const rawExistingSt =
          (Array.isArray(offlineState.settings)
            ? offlineState.settings[0]
            : offlineState.settings) || initialSettings;
        const mergedOfflineSt: any = {
          ...rawExistingSt,
          ...(clientSetup.applyProfile && clientSetup.profile ? clientSetup.profile : {}),
          autoSeedDisabled: disableAutoSeed,
          lastCleanedAt: cleanedAt,
        };
        if (groups.salesPos) {
          mergedOfflineSt.dailySalesRecaps = [];
        }
        offlineState.settings = [sanitizeSettings(mergedOfflineSt, rawExistingSt, true, true)];

        if (clientSetup.applyCashAccounts && clientSetup.cashAccounts.length > 0) {
          const referencedIds = new Set(
            (offlineState.cash_transactions || []).map((t: any) => String(t.accountId || ""))
          );
          const nextIds = new Set(clientSetup.cashAccounts.map((a) => a.id));
          const preservedOld = groups.financeCash
            ? []
            : (offlineState.cash_accounts || []).filter(
                (a: any) => referencedIds.has(String(a.id)) && !nextIds.has(String(a.id))
              );
          offlineState.cash_accounts = [
            ...clientSetup.cashAccounts.map(sanitizeCashAccount),
            ...preservedOld,
          ];
          updatedCashAccountsCount = clientSetup.cashAccounts.length;
        }

        if (clientSetup.newUsers.length > 0) {
          offlineState.users = offlineState.users || [];
          for (const nu of clientSetup.newUsers) {
            offlineState.users.push(
              sanitizeUserForInsert(
                {
                  id: `usr-${crypto.randomUUID().slice(0, 8)}`,
                  username: nu.username,
                  name: nu.name,
                  role: nu.role,
                  department: nu.department || nu.role,
                  pin: nu.pin,
                },
                nu.pin
              )
            );
            createdUsersCount += 1;
          }
        }

        offlineState.audit_logs = [cleanAudit, ...(offlineState.audit_logs || [])];
        const afterCounts = await getDatabaseTableCounts();
        bumpDataVersion();
        return res.json({
          success: true,
          summary: buildCleaningSummary(beforeCounts, afterCounts, groups),
          beforeCounts,
          afterCounts,
          autoSeedDisabled: disableAutoSeed,
          createdUsersCount,
          updatedCashAccountsCount,
        });
      }

      await db.transaction(async (tx) => {
        if (groups.salesPos) {
          await tx.delete(schema.payments);
          await tx.delete(schema.orderItems);
          await tx.delete(schema.orders);
          await tx.delete(schema.salesTransactions);
          await tx.delete(schema.dailySalesRecaps);
          await tx.delete(schema.salesImportLogs);
          await tx.delete(schema.shifts);
          await tx.delete(schema.managerApprovalRequests);
        }
        if (groups.financeCash) {
          await tx.delete(schema.bankStatementLines);
          await tx.delete(schema.bankReconciliations);
          await tx.delete(schema.cashTransactions);
          await tx.delete(schema.budgets);
          await tx.delete(schema.closedPeriods);
        }
        if (groups.inventoryOps) {
          await tx.delete(schema.stockOpnameItems);
          await tx.delete(schema.stockOpnames);
          await tx.delete(schema.stockMovements);
          await tx.delete(schema.purchaseOrders);
          if (!groups.catalogIngredients) {
            await tx.update(schema.ingredients).set({ currentStock: 0 });
          }
        }
        if (groups.hrAudit) {
          await tx.delete(schema.dailyAttendances);
          await tx.delete(schema.dailyChecklists);
          await tx.delete(schema.attendanceRecords);
          await tx.delete(schema.payrollRecords);
          await tx.delete(schema.kpiRecords);
          await tx.delete(schema.auditLogs);
        }
        if (groups.catalogMenu) {
          await tx.delete(schema.batchPreparations);
          await tx.delete(schema.recipes);
          await tx.delete(schema.products);
        }
        if (groups.catalogIngredients) {
          await tx.delete(schema.ingredients);
        }
        if (groups.hrSuppliers) {
          await tx.delete(schema.employeeShifts);
          await tx.delete(schema.employeeContracts);
          await tx.delete(schema.employees);
          await tx.delete(schema.suppliers);
        }
        if (groups.promotions) {
          await tx.delete(schema.promotions);
        }
        if (groups.dummyUsers) {
          const keepArr = Array.from(keepUserIds);
          if (keepArr.length > 0) {
            await tx.delete(schema.users).where(notInArray(schema.users.id, keepArr));
          }
        }
        if (groups.devicesPrinters) {
          await tx.delete(schema.posPrinters);
          if (currentSessionId) {
            await tx
              .delete(schema.deviceSessions)
              .where(ne(schema.deviceSessions.id, currentSessionId));
          } else {
            await tx.delete(schema.deviceSessions);
          }
        }
        if (groups.kpiTemplates) {
          await tx.delete(schema.kpiTasks);
          await tx.delete(schema.kpiBonusRules);
        }
        if (groups.customExpenseCategories) {
          await tx
            .delete(schema.expenseCategories)
            .where(notInArray(schema.expenseCategories.id, Array.from(CORE_EXPENSE_CATEGORY_IDS)));
          await tx
            .insert(schema.expenseCategories)
            .values(defaultCategories.map(sanitizeExpenseCategory))
            .onConflictDoNothing();
        }

        // Update settings (profil klien + flag __autoSeedDisabled & __lastCleanedAt)
        const existingSettingsRows = await tx.select().from(schema.settings).limit(1);
        const existingSt: any = existingSettingsRows[0] || initialSettings;
        let existingDiv: Record<string, any> = {};
        try {
          existingDiv =
            typeof existingSt.divisionKpiBonusTarget === "string"
              ? JSON.parse(existingSt.divisionKpiBonusTarget)
              : existingSt.divisionKpiBonusTarget &&
                  typeof existingSt.divisionKpiBonusTarget === "object"
                ? { ...existingSt.divisionKpiBonusTarget }
                : {};
        } catch {
          existingDiv = {};
        }
        if (groups.salesPos) {
          delete existingDiv.__dailySalesRecaps;
        }
        const mergedSettingsInput: any = {
          ...existingSt,
          divisionKpiBonusTarget: existingDiv,
          ...(clientSetup.applyProfile && clientSetup.profile ? clientSetup.profile : {}),
          autoSeedDisabled: disableAutoSeed,
          lastCleanedAt: cleanedAt,
        };
        const sanitizedSettingsRow = sanitizeSettings(
          mergedSettingsInput,
          existingSt,
          true,
          true
        );
        await tx
          .insert(schema.settings)
          .values([sanitizedSettingsRow])
          .onConflictDoUpdate({
            target: schema.settings.id,
            set: sanitizedSettingsRow,
          });

        // Update Pos Kas / Rekening klien bila diaktifkan
        if (clientSetup.applyCashAccounts && clientSetup.cashAccounts.length > 0) {
          const sanitizedAccounts = clientSetup.cashAccounts.map(sanitizeCashAccount);
          if (groups.financeCash) {
            await tx.delete(schema.cashAccounts);
            await tx.insert(schema.cashAccounts).values(sanitizedAccounts);
          } else {
            const remainingTxRefs = await tx
              .select({ accountId: schema.cashTransactions.accountId })
              .from(schema.cashTransactions);
            const protectedIds = new Set<string>([
              ...sanitizedAccounts.map((a) => a.id),
              ...remainingTxRefs.map((r) => String(r.accountId || "")).filter(Boolean),
            ]);
            if (protectedIds.size > 0) {
              await tx
                .delete(schema.cashAccounts)
                .where(notInArray(schema.cashAccounts.id, Array.from(protectedIds)));
            }
            for (const acc of sanitizedAccounts) {
              await tx
                .insert(schema.cashAccounts)
                .values([acc])
                .onConflictDoUpdate({
                  target: schema.cashAccounts.id,
                  set: acc,
                });
            }
          }
          updatedCashAccountsCount = sanitizedAccounts.length;
        }

        // Tambahkan akun user baru klien bila ada
        if (clientSetup.newUsers.length > 0) {
          const remainingUsers = await tx
            .select({ username: schema.users.username })
            .from(schema.users);
          const existingUsernamesSet = new Set(
            remainingUsers.map((u) => String(u.username || "").toLowerCase())
          );
          const usersToInsert = clientSetup.newUsers
            .filter((nu) => !existingUsernamesSet.has(nu.username.toLowerCase()))
            .map((nu) =>
              sanitizeUserForInsert(
                {
                  id: `usr-${crypto.randomUUID().slice(0, 8)}`,
                  username: nu.username,
                  name: nu.name,
                  role: nu.role,
                  department: nu.department || nu.role,
                  pin: nu.pin,
                },
                nu.pin
              )
            );
          if (usersToInsert.length > 0) {
            await tx.insert(schema.users).values(usersToInsert);
            createdUsersCount = usersToInsert.length;
          }
        }

        await tx.insert(schema.auditLogs).values(cleanAudit);
      });

      const afterCounts = await getDatabaseTableCounts();
      bumpDataVersion();
      res.json({
        success: true,
        summary: buildCleaningSummary(beforeCounts, afterCounts, groups),
        beforeCounts,
        afterCounts,
        autoSeedDisabled: disableAutoSeed,
        createdUsersCount,
        updatedCashAccountsCount,
      });
    } catch (err: any) {
      console.error("Gagal menjalankan pembersihan data klien:", err);
      res.status(500).json({ error: err?.message || "Gagal membersihkan data klien" });
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
        const normalized = filePath.replace(/\\/g, "/");
        const baseName = path.basename(normalized);
        if (normalized.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (
          normalized.endsWith(".html") ||
          baseName === "sw.js" ||
          baseName === "manifest.json" ||
          baseName.startsWith("logo-") ||
          baseName === "favicon.png" ||
          baseName === "apple-touch-icon.png" ||
          baseName.startsWith("icon-")
        ) {
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

