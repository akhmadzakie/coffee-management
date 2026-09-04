import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from 'drizzle-orm/pg-core';

export const cashAccounts = pgTable('cash_accounts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: text('name').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'BANK', 'CASH', 'SAVINGS'
  isDefault: boolean('is_default').default(false).notNull(),
});

export const cashTransactions = pgTable('cash_transactions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'IN', 'OUT', 'TRANSFER'
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  referenceId: varchar('reference_id', { length: 255 }),
});

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: text('username').notNull(),
  pin: text('pin').notNull(),
  name: text('name').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
});

export const settings = pgTable('settings', {
  id: varchar('id', { length: 255 }).primaryKey(),
  logoDataUrl: text('logo_data_url'),
  brandName: text('brand_name').notNull(),
  companyAddress: text('company_address').notNull(),
  bankDetails: text('bank_details').notNull(),
  salesPerson: text('sales_person').notNull(),
  footerMessage: text('footer_message').notNull(),
  language: varchar('language', { length: 10 }).notNull(),
});

export const deviceSessions = pgTable('device_sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  username: text('username').notNull(),
  userName: text('user_name').notNull(),
  deviceName: text('device_name').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  deviceType: varchar('device_type', { length: 50 }).notNull(), // 'desktop' | 'mobile' | 'tablet'
  ipAddress: text('ip_address'),
  location: text('location'),
  lastActive: text('last_active').notNull(), // ISO String
  createdAt: text('created_at').notNull(), // ISO String
  status: varchar('status', { length: 50 }).notNull(), // 'ACTIVE' | 'REVOKED'
});

export const ingredients = pgTable('ingredients', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  currentStock: real('current_stock').notNull(),
  minStock: real('min_stock').notNull(),
  category: text('category').notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: varchar('id', { length: 255 }).primaryKey(),
  ingredientId: varchar('ingredient_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'IN' | 'OUT'
  quantity: real('quantity').notNull(),
  date: text('date').notNull(), // ISO String
  note: text('note'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

export const salesTransactions = pgTable('sales_transactions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  date: text('date').notNull(), // ISO String
  menuName: text('menu_name').notNull(),
  quantitySold: real('quantity_sold').notNull(),
  totalPrice: real('total_price').notNull(),
  importLogId: varchar('import_log_id', { length: 255 }).notNull(),
});

export const salesImportLogs = pgTable('sales_import_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  importDate: text('import_date').notNull(), // ISO String
  fileName: text('file_name').notNull(),
  rowCount: integer('row_count').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  tableName: varchar('table_name', { length: 255 }).notNull(),
  recordId: varchar('record_id', { length: 255 }).notNull(),
  timestamp: text('timestamp').notNull(), // ISO String
});

export const employees = pgTable('employees', {
  id: varchar('id', { length: 255 }).primaryKey(),
  nik: text('nik').notNull(),
  name: text('name').notNull(),
  position: text('position').notNull(),
  department: text('department').notNull(),
  employmentType: varchar('employment_type', { length: 50 }).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const employeeContracts = pgTable('employee_contracts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  employeeId: varchar('employee_id', { length: 255 }).notNull(),
  effectiveDate: text('effective_date').notNull(),
  basicSalary: real('basic_salary').notNull(),
  mealAllowance: real('meal_allowance').notNull(),
  positionAllowance: real('position_allowance').notNull(),
  alphaDeductionPerDay: real('alpha_deduction_per_day').notNull(),
  workingDaysPerMonth: integer('working_days_per_month').notNull(),
  notes: text('notes').notNull(),
});

export const attendanceRecords = pgTable('attendance_records', {
  id: varchar('id', { length: 255 }).primaryKey(),
  employeeId: varchar('employee_id', { length: 255 }).notNull(),
  period: text('period').notNull(),
  presentDays: integer('present_days').notNull(),
  sickDays: integer('sick_days').notNull(),
  permissionDays: integer('permission_days').notNull(),
  alphaDays: integer('alpha_days').notNull(),
  holidayDays: integer('holiday_days').notNull(),
  workingDays: integer('working_days').notNull(),
  notes: text('notes').notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const kpiRecords = pgTable('kpi_records', {
  id: varchar('id', { length: 255 }).primaryKey(),
  employeeId: varchar('employee_id', { length: 255 }).notNull(),
  quarter: integer('quarter').notNull(),
  year: integer('year').notNull(),
  targets: jsonb('targets').notNull(),
  totalScore: real('total_score').notNull(),
  kpiBonus: real('kpi_bonus').notNull(),
  notes: text('notes').notNull(),
  evaluatedBy: varchar('evaluated_by', { length: 255 }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: text('name').notNull(),
  picName: text('pic_name').notNull(),
  contact: text('contact').notNull(),
  address: text('address').notNull(),
  notes: text('notes').notNull(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: varchar('id', { length: 255 }).primaryKey(),
  poNumber: text('po_number').notNull(),
  supplierId: varchar('supplier_id', { length: 255 }).notNull(),
  date: text('date').notNull(),
  items: jsonb('items').notNull(),
  totalAmount: real('total_amount').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  deliveryStatus: varchar('delivery_status', { length: 50 }).notNull(),
});

export const shifts = pgTable('shifts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  cashAccountId: varchar('cash_account_id', { length: 255 }).notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  startingCash: real('starting_cash').notNull(),
  expectedEndingCash: real('expected_ending_cash'),
  actualEndingCash: real('actual_ending_cash'),
  difference: real('difference'),
  status: varchar('status', { length: 50 }).notNull(),
});
