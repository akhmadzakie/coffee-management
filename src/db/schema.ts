import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  real,
  doublePrecision,
} from "drizzle-orm/pg-core";

// ─── Expense Categories (Fase 1) ────────────────────────────────────────────
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  // PENDAPATAN | PENGELUARAN | BAHAN_BAKU | UTILITAS | HRD | ASET | LAINNYA
  type: varchar("type", { length: 50 }).notNull(),
  parentId: varchar("parent_id", { length: 255 }), // null = root category
  color: varchar("color", { length: 20 }).default("#6B7280").notNull(),
  icon: varchar("icon", { length: 50 }).default("tag").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ─── Budgets (Fase 2) ────────────────────────────────────────────────────────
export const budgets = pgTable("budgets", {
  id: varchar("id", { length: 255 }).primaryKey(),
  categoryId: varchar("category_id", { length: 255 }),
  period: text("period").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ─── Bank Reconciliations (Fase 2) ───────────────────────────────────────────
export const bankReconciliations = pgTable("bank_reconciliations", {
  id: varchar("id", { length: 255 }).primaryKey(),
  period: text("period").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number"),
  openingBalance: doublePrecision("opening_balance").notNull().default(0),
  closingBalance: doublePrecision("closing_balance").notNull().default(0),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: text("created_at").notNull(),
});

export const bankStatementLines = pgTable("bank_statement_lines", {
  id: varchar("id", { length: 255 }).primaryKey(),
  reconciliationId: varchar("reconciliation_id", { length: 255 }).notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  transactionType: varchar("transaction_type", { length: 50 }).notNull().default("CREDIT"),
  matchedTransactionId: varchar("matched_transaction_id", { length: 255 }),
  isMatched: boolean("is_matched").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// ─── Stock Opnames (Fase 3) ──────────────────────────────────────────────────
export const stockOpnames = pgTable("stock_opnames", {
  id: varchar("id", { length: 255 }).primaryKey(),
  date: text("date").notNull(),
  status: varchar("status", { length: 50 }).default("DRAFT").notNull(), // DRAFT | FINAL
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const stockOpnameItems = pgTable("stock_opname_items", {
  id: varchar("id", { length: 255 }).primaryKey(),
  opnameId: varchar("opname_id", { length: 255 }).notNull(),
  ingredientId: varchar("ingredient_id", { length: 255 }).notNull(),
  systemStock: doublePrecision("system_stock").notNull(),
  physicalStock: doublePrecision("physical_stock").notNull(),
  difference: doublePrecision("difference").notNull(), // physicalStock - systemStock
  notes: text("notes"),
});

// ─── Payroll Records (Fase 4) ─────────────────────────────────────────────────
export const payrollRecords = pgTable("payroll_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  basicSalary: doublePrecision("basic_salary").notNull(),
  mealAllowance: doublePrecision("meal_allowance").notNull(),
  positionAllowance: doublePrecision("position_allowance").notNull(),
  kpiBonus: doublePrecision("kpi_bonus").default(0).notNull(),
  alphaDeduction: doublePrecision("alpha_deduction").default(0).notNull(),
  overtimePay: doublePrecision("overtime_pay").default(0).notNull(),
  otherDeductions: doublePrecision("other_deductions").default(0).notNull(),
  grossPay: doublePrecision("gross_pay").notNull(),
  netPay: doublePrecision("net_pay").notNull(),
  status: varchar("status", { length: 50 }).default("DRAFT").notNull(), // DRAFT | APPROVED | PAID
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: text("approved_at"),
  overtimeHours: doublePrecision("overtime_hours").default(0),
  overtimeRate: doublePrecision("overtime_rate").default(0),
  paidDate: text("paid_date"),
  paidVia: varchar("paid_via", { length: 255 }), // accountId
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const cashAccounts = pgTable("cash_accounts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'BANK', 'CASH', 'SAVINGS'
  isDefault: boolean("is_default").default(false).notNull(),
});

export const cashTransactions = pgTable("cash_transactions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'CASH_IN', 'CASH_OUT', 'TRANSFER'
  date: text("date").notNull(),
  amount: doublePrecision("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // kept for backward compat
  categoryId: varchar("category_id", { length: 255 }), // FK to expenseCategories
  referenceId: varchar("reference_id", { length: 255 }),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  username: text("username").notNull(),
  pin: text("pin").notNull(),
  name: text("name").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  department: varchar("department", { length: 50 }),
});

export const settings = pgTable("settings", {
  id: varchar("id", { length: 255 }).primaryKey(),
  logoDataUrl: text("logo_data_url"),
  brandName: text("brand_name").notNull(),
  companyAddress: text("company_address").notNull(),
  bankDetails: text("bank_details").notNull(),
  salesPerson: text("sales_person").notNull(),
  footerMessage: text("footer_message").notNull(),
  language: varchar("language", { length: 10 }).notNull(),
  leaderBarTasks: text("leader_bar_tasks").default("[]"),
  leaderKitchenTasks: text("leader_kitchen_tasks").default("[]"),
  leaderBakerTasks: text("leader_baker_tasks").default("[]"),
  managerTasks: text("manager_tasks").default("[]"),
  gemini_api_key: text("gemini_api_key"),
  taxEnabled: boolean("tax_enabled").default(false).notNull(),
  taxRate: doublePrecision("tax_rate").default(10).notNull(),
  taxMode: varchar("tax_mode", { length: 20 }).default("EXCLUSIVE").notNull(),
  maxCashierDiscount: doublePrecision("max_cashier_discount").default(10).notNull(),
  monthlyRevenueTarget: doublePrecision("monthly_revenue_target").default(150000000),
  targetBonusAmount: doublePrecision("target_bonus_amount").default(0),
  divisionKpiBonusTarget: text("division_kpi_bonus_target").default("{}"),
  scheduleApprovals: text("schedule_approvals").default("{}"),
  enableStoreSalesBonus: boolean("enable_store_sales_bonus").default(true),
  enableLeaderAllowanceBonus: boolean("enable_leader_allowance_bonus").default(true),
  enableKpiScoreBonus: boolean("enable_kpi_score_bonus").default(false),
  posSupervisorPin: text("pos_supervisor_pin").default("1234"),
  autoDeductStockOnSale: boolean("auto_deduct_stock_on_sale").default(true),
  allowNegativeStockSale: boolean("allow_negative_stock_sale").default(true),
});
export const deviceSessions = pgTable("device_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  username: text("username").notNull(),
  userName: text("user_name").notNull(),
  deviceName: text("device_name").notNull(),
  browser: text("browser").notNull(),
  os: text("os").notNull(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // 'desktop' | 'mobile' | 'tablet'
  ipAddress: text("ip_address"),
  location: text("location"),
  lastActive: text("last_active").notNull(), // ISO String
  createdAt: text("created_at").notNull(), // ISO String
  status: varchar("status", { length: 50 }).notNull(), // 'ACTIVE' | 'REVOKED'
});

export const ingredients = pgTable("ingredients", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  currentStock: doublePrecision("current_stock").notNull(),
  minStock: doublePrecision("min_stock").notNull(),
  category: text("category").notNull(),
  costPerUnit: doublePrecision("cost_per_unit").default(0).notNull(), // Fase 3: valuation
});

export const recipes = pgTable("recipes", {
  id: varchar("id", { length: 255 }).primaryKey(),
  menuName: text("menu_name").notNull().unique(),
  ingredients: text("ingredients").notNull(), // JSON string: [{ ingredientId, quantity }]
});

export const stockMovements = pgTable("stock_movements", {
  id: varchar("id", { length: 255 }).primaryKey(),
  ingredientId: varchar("ingredient_id", { length: 255 }).notNull(),
  // Fase 3: expanded types
  type: varchar("type", { length: 50 }).notNull(), // 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE' | 'RETURN' | 'TRANSFER' | 'USAGE'
  quantity: doublePrecision("quantity").notNull(),
  date: text("date").notNull(), // ISO String
  note: text("note"),
  unitCost: doublePrecision("unit_cost"), // harga per unit saat transaksi (untuk IN)
  totalCost: doublePrecision("total_cost"), // unitCost × quantity
  referenceId: varchar("reference_id", { length: 255 }), // link ke PO
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  location: varchar("location", { length: 50 }),
});

export const salesTransactions = pgTable("sales_transactions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  date: text("date").notNull(), // ISO String
  menuName: text("menu_name").notNull(),
  quantitySold: doublePrecision("quantity_sold").notNull(),
  totalPrice: doublePrecision("total_price").notNull(),
  importLogId: varchar("import_log_id", { length: 255 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("CASH"),
  orderId: varchar("order_id", { length: 255 }),
});

export const salesImportLogs = pgTable("sales_import_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  importDate: text("import_date").notNull(), // ISO String
  fileName: text("file_name").notNull(),
  rowCount: integer("row_count").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  tableName: varchar("table_name", { length: 255 }).notNull(),
  recordId: varchar("record_id", { length: 255 }).notNull(),
  timestamp: text("timestamp").notNull(), // ISO String
});

export const employees = pgTable("employees", {
  id: varchar("id", { length: 255 }).primaryKey(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  department: text("department").notNull(),
  employmentType: varchar("employment_type", { length: 50 }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const employeeContracts = pgTable("employee_contracts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  effectiveDate: text("effective_date").notNull(),
  basicSalary: doublePrecision("basic_salary").notNull(),
  mealAllowance: doublePrecision("meal_allowance").notNull(),
  positionAllowance: doublePrecision("position_allowance").notNull(),
  workingDaysPerMonth: integer("working_days_per_month").notNull(),
  notes: text("notes").notNull(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  period: text("period").notNull(),
  presentDays: integer("present_days").notNull(),
  sickDays: integer("sick_days").notNull(),
  permissionDays: integer("permission_days").notNull(),
  alphaDays: integer("alpha_days").notNull(),
  holidayDays: integer("holiday_days").notNull(),
  workingDays: integer("working_days").notNull(),
  notes: text("notes").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: text("created_at").notNull(),
});


export const employeeShifts = pgTable("employee_shifts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  date: text("date").notNull(),
  shiftType: varchar("shift_type", { length: 50 }).notNull(),
  notes: text("notes"),
});
export const dailyAttendances = pgTable("daily_attendances", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  date: text("date").notNull(),
  clockInTime: text("clock_in_time"),
  clockOutTime: text("clock_out_time"),
  clockInLocation: jsonb("clock_in_location"),
  clockOutLocation: jsonb("clock_out_location"),
  clockInPhotoUrl: text("clock_in_photo_url"),
  clockOutPhotoUrl: text("clock_out_photo_url"),
  status: varchar("status", { length: 50 }).notNull(),
  approvalStatus: varchar("approval_status", { length: 50 }).default("PENDING"),
  overtimeHours: doublePrecision("overtime_hours").default(0),
  overtimeApproved: boolean("overtime_approved").default(false),
  notes: text("notes"),
});


export const dailyChecklists = pgTable("daily_checklists", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  date: text("date").notNull(),
  cleaningDone: boolean("cleaning_done").default(false),
  equipmentChecked: boolean("equipment_checked").default(false),
  leaderTasks: text("leader_tasks").default("[]"),
  notes: text("notes"),
});

export const kpiRecords = pgTable("kpi_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  quarter: integer("quarter").notNull(),
  year: integer("year").notNull(),
  targets: jsonb("targets").notNull(),
  totalScore: doublePrecision("total_score").notNull(),
  kpiBonus: doublePrecision("kpi_bonus").notNull(),
  notes: text("notes").notNull(),
  evaluatedBy: varchar("evaluated_by", { length: 255 }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  picName: text("pic_name").notNull(),
  contact: text("contact").notNull(),
  address: text("address").notNull(),
  notes: text("notes").notNull(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id", { length: 255 }).primaryKey(),
  poNumber: text("po_number").notNull(),
  supplierId: varchar("supplier_id", { length: 255 }).notNull(),
  date: text("date").notNull(),
  items: jsonb("items").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  deliveryStatus: varchar("delivery_status", { length: 50 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("CASH"),
  dueDate: text("due_date"),
  amountPaid: doublePrecision("amount_paid").default(0),
});

export const shifts = pgTable("shifts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  cashAccountId: varchar("cash_account_id", { length: 255 }).notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  startingCash: doublePrecision("starting_cash").notNull(),
  expectedEndingCash: doublePrecision("expected_ending_cash"),
  actualEndingCash: doublePrecision("actual_ending_cash"),
  difference: doublePrecision("difference"),
  status: varchar("status", { length: 50 }).notNull(),
  picEmployeeId: varchar("pic_employee_id", { length: 255 }),
  picEmployeeName: text("pic_employee_name"),
  teamMembers: text("team_members"), // JSON string array
});



export const kpiTasks = pgTable("kpi_tasks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  period: text("period").notNull(), // YYYY-MM
  taskName: text("task_name").notNull(),
  weight: doublePrecision("weight").notNull(), // e.g. 20 for 20%
  target: doublePrecision("target").notNull(), 
  realization: doublePrecision("realization").default(0).notNull(),
  score: doublePrecision("score").default(0).notNull(), // (realization / target) * weight
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const kpiBonusRules = pgTable("kpi_bonus_rules", {
  id: varchar("id", { length: 255 }).primaryKey(),
  minScore: doublePrecision("min_score").notNull(),
  maxScore: doublePrecision("max_score").notNull(),
  bonusAmount: doublePrecision("bonus_amount").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const closedPeriods = pgTable("closed_periods", {
  id: varchar("id", { length: 255 }).primaryKey(),
  period: text("period").notNull(), // format YYYY-MM
  closedAt: text("closed_at").notNull(),
  closedBy: varchar("closed_by", { length: 255 }).notNull(),
  notes: text("notes"),
});

// ─── POS & Transaksi Kasir ──────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: varchar("id", { length: 255 }).primaryKey(),
  receiptNo: varchar("receipt_no", { length: 100 }).notNull(), // e.g. ORD-20261014-0001
  shiftId: varchar("shift_id", { length: 255 }), // link ke tabel shifts
  outletId: varchar("outlet_id", { length: 100 }).default("OUTLET-MAIN").notNull(),
  orderType: varchar("order_type", { length: 50 }).notNull(), // 'DINE_IN' | 'TAKE_AWAY'
  tableNumber: varchar("table_number", { length: 50 }), // Nomor meja untuk open bill
  customerName: varchar("customer_name", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull(), // 'OPEN' | 'PAID' | 'CANCELLED' | 'VOID' | 'REFUNDED'
  subtotal: doublePrecision("subtotal").notNull().default(0),
  discountPercent: doublePrecision("discount_percent").default(0).notNull(),
  discountAmount: doublePrecision("discount_amount").default(0).notNull(),
  discountReason: text("discount_reason"),
  taxPercent: doublePrecision("tax_percent").default(0).notNull(),
  taxAmount: doublePrecision("tax_amount").default(0).notNull(),
  taxMode: varchar("tax_mode", { length: 20 }).default("EXCLUSIVE").notNull(),
  totalAmount: doublePrecision("total_amount").notNull().default(0),
  notes: text("notes"),
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  cashierId: varchar("cashier_id", { length: 255 }),
  cashierName: varchar("cashier_name", { length: 100 }),
  createdAt: text("created_at").notNull(), // ISO String
  updatedAt: text("updated_at"),
  paidAt: text("paid_at"),
  voidReason: text("void_reason"),
  voidApprovedBy: varchar("void_approved_by", { length: 255 }),
  refundReason: text("refund_reason"),
  refundApprovedBy: varchar("refund_approved_by", { length: 255 }),
  refundAmount: doublePrecision("refund_amount"),
  refundMethod: varchar("refund_method", { length: 50 }),
  refundAt: text("refund_at"),
  refundRestockOption: varchar("refund_restock_option", { length: 50 }),
  kitchenStatus: varchar("kitchen_status", { length: 50 }).default("QUEUED").notNull(), // 'QUEUED' | 'PREPARING' | 'READY' | 'SERVED'
  appliedPromotionId: varchar("applied_promotion_id", { length: 255 }),
  appliedPromotionName: text("applied_promotion_name"),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id", { length: 255 }).primaryKey(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  menuName: text("menu_name").notNull(),
  recipeId: varchar("recipe_id", { length: 255 }),
  variantName: text("variant_name"), // e.g. "Iced", "Large", "Hot"
  quantity: doublePrecision("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").notNull(),
  subtotal: doublePrecision("subtotal").notNull(),
  modifiers: jsonb("modifiers").default([]), // [{ name, price, quantity }]
  notes: text("notes"), // catatan per item (less sugar, dll)
  printDestination: varchar("print_destination", { length: 50 }).default("BAR").notNull(), // 'BAR' | 'KITCHEN' | 'BAKERY' | 'NONE'
  isPrinted: boolean("is_printed").default(false).notNull(),
  itemStatus: varchar("item_status", { length: 50 }).default("QUEUED").notNull(), // 'QUEUED' | 'PREPARING' | 'READY' | 'SERVED'
  createdAt: text("created_at").notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id", { length: 255 }).primaryKey(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  shiftId: varchar("shift_id", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // 'CASH' | 'QRIS' | 'DEBIT' | 'CREDIT'
  amount: doublePrecision("amount").notNull(),
  cashReceived: doublePrecision("cash_received"),
  changeAmount: doublePrecision("change_amount"),
  referenceNo: text("reference_no"), // Kode approval EDC / nomor referensi QRIS
  cashAccountId: varchar("cash_account_id", { length: 255 }),
  createdAt: text("created_at").notNull(),
});

export const posPrinters = pgTable("pos_printers", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(), // e.g. "Printer Bar Depan", "Printer Kitchen"
  connectionType: varchar("connection_type", { length: 50 }).notNull(), // 'LAN' | 'BLUETOOTH' | 'USB'
  targetStation: varchar("target_station", { length: 50 }).notNull(), // 'RECEIPT' | 'BAR' | 'KITCHEN' | 'BAKERY'
  ipAddress: text("ip_address"), // e.g. "192.168.1.200"
  port: integer("port").default(9100).notNull(),
  macAddress: text("mac_address"),
  paperWidth: varchar("paper_width", { length: 20 }).default("80mm").notNull(), // '58mm' | '80mm'
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Menu Engineering, Products & Batch Preparations ────────────────────────
export const products = pgTable("products", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  division: varchar("division", { length: 50 }).default("BAR").notNull(), // 'BAR' | 'KITCHEN' | 'BAKER'
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  variants: jsonb("variants").default([]).notNull(),
  modifierGroups: jsonb("modifier_groups").default([]),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const batchPreparations = pgTable("batch_preparations", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  division: varchar("division", { length: 50 }).default("BAR").notNull(),
  targetIngredientId: varchar("target_ingredient_id", { length: 255 }).notNull(),
  targetIngredientName: text("target_ingredient_name"),
  yieldQuantity: doublePrecision("yield_quantity").notNull(),
  yieldUnit: varchar("yield_unit", { length: 50 }).notNull(),
  ingredients: jsonb("ingredients").notNull(), // [{ ingredientId, quantity }]
  notes: text("notes"),
  lastPreparedDate: text("last_prepared_date"),
});

// ─── Promo & Diskon (Pre-authorized Whitelist) ─────────────────────────────
export const promotions = pgTable("promotions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 100 }),
  type: varchar("type", { length: 50 }).notNull(), // 'PERCENT' | 'NOMINAL'
  value: doublePrecision("value").notNull(),
  minSpend: doublePrecision("min_spend"),
  maxDiscount: doublePrecision("max_discount"),
  isActive: boolean("is_active").default(true).notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  createdBy: varchar("created_by", { length: 255 }),
});

// ─── Remote In-App Approval Requests ────────────────────────────────────────
export const managerApprovalRequests = pgTable("manager_approval_requests", {
  id: varchar("id", { length: 255 }).primaryKey(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  receiptNo: varchar("receipt_no", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'REFUND' | 'VOID' | 'DISCOUNT'
  amount: doublePrecision("amount").notNull(),
  reason: text("reason").notNull(),
  cashierName: varchar("cashier_name", { length: 255 }).notNull(),
  tableNumber: varchar("table_number", { length: 50 }),
  customerName: text("customer_name"),
  refundMethod: varchar("refund_method", { length: 50 }), // 'CASH' | 'TRANSFER' | 'QRIS'
  refundRestockOption: varchar("refund_restock_option", { length: 50 }), // 'RETURN_TO_STOCK' | 'WASTE' | 'NONE'
  status: varchar("status", { length: 50 }).default("PENDING").notNull(), // 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedAt: text("requested_at").notNull(),
  respondedAt: text("responded_at"),
  respondedBy: varchar("responded_by", { length: 255 }),
  responseNote: text("response_note"),
});

