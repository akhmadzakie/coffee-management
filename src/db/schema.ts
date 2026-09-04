import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from 'drizzle-orm/pg-core';

export const cashTransactions = pgTable('cash_transactions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
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
