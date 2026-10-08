import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { db, pool } from "./src/db/db.ts";
import * as schema from "./src/db/schema.ts";
import { eq, not } from "drizzle-orm";

const initialSettings = {
  id: "1",
  logoDataUrl: null,
  brandName: "Julia's Management System",
  companyAddress: "Alamat Julia's Management",
  bankDetails: "Bank BCA 1234567890",
  salesPerson: "Admin",
  footerMessage: "Terima kasih atas kunjungannya.",
  language: "id",
};

const initialUsers = [
  {
    id: "admin-1",
    username: "admin",
    pin: "1234",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    department: "Management",
  },
];

async function ensureTables() {
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
    `ALTER TABLE daily_checklists ADD COLUMN IF NOT EXISTS leader_tasks TEXT DEFAULT '[]'`,
    `ALTER TABLE daily_attendances ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id TEXT`,
    `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS location TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE employees RENAME COLUMN nik TO username`
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
  console.log("✅ Schema ensured: Fase 1-4 tables ready.");
}

async function startServer() {
  await ensureTables();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // --- RATE LIMITING ---
  const syncLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 requests per windowMs
    message: { error: "Too many requests from this IP, please try again later." }
  });
  app.use("/api/sync", syncLimiter);


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
    ingredients: String(r.ingredients || "[]"),
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
    totalPrice: Number(s.totalPrice) || 0,
    importLogId: String(s.importLogId || ""),
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

  const sanitizeCashTransaction = (f: any) => ({
    id: String(f.id || crypto.randomUUID()),
    accountId: String(f.accountId || ""),
    type: String(f.type || "CASH_IN"),
    date: String(f.date || new Date().toISOString()),
    amount: Number(f.amount) || 0,
    description: String(f.description || ""),
    category: String(f.category || ""),
    categoryId: f.categoryId ? String(f.categoryId) : null,
    referenceId: f.referenceId ? String(f.referenceId) : null,
  });

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
    otherDeductions: Number(p.otherDeductions) || 0,
    grossPay: Number(p.grossPay) || 0,
    netPay: Number(p.netPay) || 0,
    status: String(p.status || "DRAFT"),
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

  const sanitizeSettings = (st: any) => ({
    id: "1",
    logoDataUrl: st?.logoDataUrl || null,
    brandName: String(st?.brandName || "Julia's Management System"),
    companyAddress: String(st?.companyAddress || ""),
    bankDetails: String(st?.bankDetails || ""),
    salesPerson: String(st?.salesPerson || ""),
    footerMessage: String(st?.footerMessage || ""),
    language: String(st?.language || "id"),
  });

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
    let finalPin = u.pin ? String(u.pin) : (existingPin || "1234");
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
  });

  // In-memory fallback state for offline usage
  let offlineState: any = null;

  app.get("/api/sync", async (req, res) => {
    try {
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
        ]);

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

      res.json({
        cash_accounts,
        cash_transactions,
        settings: settings.length > 0 ? settings[0] : initialSettings,
        users: users.map(sanitizeUser),
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

      const user = currentUsers.find(u => 
        u.username === username && (u.pin === finalPin || u.pin === pin)
      );
      
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
      
      await db.insert(schema.deviceSessions).values(newSession);
      
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

      const sessions = await db.select().from(schema.deviceSessions).where(eq(schema.deviceSessions.id, token));
      const session = sessions[0];
      if (!session) {
        return res.status(401).json({ error: "Unauthorized: Invalid session" });
      }

      const currentUsersDB = await db.select().from(schema.users);
      const requestUser = currentUsersDB.find(u => u.id === session.userId);

      if (!requestUser) {
        return res.status(401).json({ error: "Unauthorized: User not found" });
      }

      if (requestUser.role === "OWNER") {
         return res.status(403).json({ error: "Forbidden: Read-only access" });
      }

      const {
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
        // Fase 1-4
        expense_categories,
        budgets,
        bank_reconciliations,
        bank_statement_lines,
        stock_opnames,
        stock_opname_items,
        payroll_records,
        closed_periods,
      } = req.body;

      await db.transaction(async (tx) => {
        // --- PHASE 1: DELETES (Child -> Parent) ---
        let existingPaidIds = new Set<string>();
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
          await tx.insert(schema.settings).values([sanitizeSettings(settings)]);
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
          if (Array.isArray(cash_transactions) && cash_transactions.length > 0) {
            await tx.insert(schema.cashTransactions).values(cash_transactions.map(sanitizeCashTransaction));
          }
        }
        if (stock_movements !== undefined) {
          if (Array.isArray(stock_movements) && stock_movements.length > 0) {
            await tx.insert(schema.stockMovements).values(stock_movements.map(sanitizeStockMovement));
          }
        }
        if (sales_transactions !== undefined) {
          if (Array.isArray(sales_transactions) && sales_transactions.length > 0) {
            await tx.insert(schema.salesTransactions).values(sales_transactions.map(sanitizeSalesTransaction));
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
          if (Array.isArray(audit_logs) && audit_logs.length > 0) {
            let filteredItems = audit_logs;
            if (validUserIds !== null) {
              filteredItems = audit_logs.filter((item: any) => validUserIds!.has(String(item.userId)));
            }
            if (filteredItems.length > 0) {
              await tx.insert(schema.auditLogs).values(filteredItems.map(sanitizeAuditLog));
            }
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
            await tx.insert(schema.stockOpnameItems).values(stock_opname_items.map(sanitizeStockOpnameItem));
          }
        }
        if (device_sessions !== undefined) {
          if (Array.isArray(device_sessions) && device_sessions.length > 0) {
            let filteredItems = device_sessions;
            if (validUserIds !== null) {
              filteredItems = device_sessions.filter((item: any) => validUserIds!.has(String(item.userId)));
            }
            if (filteredItems.length > 0) {
              await tx.insert(schema.deviceSessions).values(filteredItems.map(sanitizeDeviceSession));
            }
          }
        }
      });
      res.json({ success: true, serverTime: new Date().toISOString() });
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
      const allSessions = await db.select().from(schema.deviceSessions);
      // Filter active sessions and sort by lastActive descending
      const activeSessions = allSessions
        .filter((s) => s.status === "ACTIVE")
        .sort(
          (a, b) =>
            new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
        );

      res.json({ sessions: activeSessions });
    } catch (err) {
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

  // ─── Dashboard Summary API ─────────────────────────────────────────────────
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

      const [transactions, employees, ingredients, payrolls] = await Promise.all([
        db.select().from(schema.cashTransactions),
        db.select().from(schema.employees),
        db.select().from(schema.ingredients),
        db.select().from(schema.payrollRecords),
      ]);

      // Filter by period (date starts with YYYY-MM)
      const currentTx = transactions.filter((t) => t.date.startsWith(currentPeriod));
      const prevTx = transactions.filter((t) => t.date.startsWith(prevPeriod));

      const sumIn = (txs: any[]) => txs.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
      const sumOut = (txs: any[]) => txs.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);

      const currentRevenue = sumIn(currentTx);
      const currentExpense = sumOut(currentTx);
      const prevRevenue = sumIn(prevTx);
      const prevExpense = sumOut(prevTx);

      // Expense breakdown by categoryId
      const expenseCategories = await db.select().from(schema.expenseCategories);
      const expenseBreakdown = expenseCategories
        .filter((c) => !c.parentId) // root only
        .map((cat) => {
          const childIds = expenseCategories.filter((c) => c.parentId === cat.id).map((c) => c.id);
          const allIds = [cat.id, ...childIds];
          const total = currentTx
            .filter((t) => t.type === "CASH_OUT" && t.categoryId && allIds.includes(t.categoryId))
            .reduce((s, t) => s + t.amount, 0);
          return { categoryId: cat.id, name: cat.name, color: cat.color, total };
        })
        .filter((b) => b.total > 0)
        .sort((a, b) => b.total - a.total);

      // Low stock count
      const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minStock).length;

      // Active employees & expiring contracts
      const activeEmployeeCount = employees.filter((e) => e.status === "AKTIF").length;
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const expiringContracts = employees.filter(
        (e) => e.endDate && e.endDate <= thirtyDaysLater && e.endDate >= now.toISOString().slice(0, 10)
      ).length;

      // Payroll status for current period
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} at localhost and local network`);
  });
}

startServer();

