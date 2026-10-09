type LocationType = "MAIN" | "BAR" | "KITCHEN";

export type Role =
  | "SUPER_ADMIN"
  | "OWNER"
  | "MANAGER"
  | "FINANCE"
  | "KASIR"
  | "LEADER"
  | "BAR"
  | "KITCHEN"
  | "BAKER";

export interface User {
  id: string;
  username: string;
  pin: string;
  name: string;
  role: Role;
  department?: LocationType | null;
  employeeId?: string | null;
}

export type ViewState =
  | "dashboard_finance"
  | "dashboard_inventory"
  | "cash_flow"
  | "inventory"
  | "import_sales"
  | "settings"
  | "users"
  | "audit_log"
  | "shifts"
  | "suppliers"
  | "purchases"
  | "hr"
  | "expense_categories"
  | "payroll"
  | "leader_checklist"
  | "finance_reports"
  | "bank_reconciliation"
  | "attendance_clock";

export type EmploymentType = "TETAP" | "KONTRAK" | "PARUH_WAKTU" | "MAGANG";
export type EmployeeStatus = "AKTIF" | "TIDAK_AKTIF" | "RESIGN" | "PHK";
type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA" | "LIBUR";

// ─── Expense Categories (Fase 1) ───────────────────────────────────────────
export type ExpenseCategoryType =
  | "PENDAPATAN"
  | "PENGELUARAN"
  | "BAHAN_BAKU"
  | "UTILITAS"
  | "HRD"
  | "ASET"
  | "LAINNYA";

export interface ExpenseCategory {
  id: string;
  name: string;
  type: ExpenseCategoryType;
  parentId: string | null;
  color: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  // UI-only: children populated from flat list
  children?: ExpenseCategory[];
}

export interface Budget {
  id: string;
  categoryId: string;
  period: string; // YYYY-MM
  targetAmount: number;
  createdBy: string;
  createdAt: string;
}

// ─── Payroll (Fase 4) ───────────────────────────────────────────────────────────
type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string; // YYYY-MM
  basicSalary: number;
  mealAllowance: number;
  positionAllowance: number;
  kpiBonus: number;
  transportAllowance: number;
  overtimePay: number; // Lembur / Tambahan Manual
  alphaDeduction: number;
  otherDeductions: number;
  grossPay: number;
  netPay: number;
  status: PayrollStatus;
  paidDate: string | null;
  paidVia: string | null; // accountId
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

// ─── Stock Opname (Fase 3) ───────────────────────────────────────────────────
type OpnameStatus = "DRAFT" | "FINAL";

export interface StockOpname {
  id: string;
  date: string;
  status: OpnameStatus;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface StockOpnameItem {
  id: string;
  opnameId: string;
  ingredientId: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  notes: string | null;
}

// ─── Bank Reconciliation (Fase 2) ────────────────────────────────────────────
type ReconciliationStatus = "DRAFT" | "FINAL";

export interface BankReconciliation {
  id: string;
  period: string; // YYYY-MM
  bankName: string;
  accountNumber: string | null;
  openingBalance: number;
  closingBalance: number;
  status: ReconciliationStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface BankStatementLine {
  id: string;
  reconciliationId: string;
  date: string;
  description: string;
  amount: number;
  transactionType: "DEBIT" | "CREDIT";
  isMatched: boolean;
  matchedTransactionId: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string | null;
  period: string; // YYYY-MM
  amount: number;
  notes: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  username: string; // Digunakan sebagai username login
  name: string;
  position: string; // Jabatan
  department: string;
  employmentType: EmploymentType;
  startDate: string; // ISO string
  endDate: string | null; // for contracts
  phone: string;
  email?: string;
  address: string;
  status: EmployeeStatus;
  createdAt: string;
}

export interface EmployeeContract {
  id: string;
  employeeId: string;
  basicSalary: number; // Gaji pokok
  mealAllowance: number; // Tunjangan makan
  positionAllowance: number; // Tunjangan jabatan
  transportAllowance: number; // Tunjangan transport
  alphaDeductionPerDay: number; // Potongan Alpha per hari
  kpiBonusTarget: number; // Target bonus KPI
  workingDaysPerMonth?: number; // HKE - Hari Kerja Efektif normal
  startDate: string; // ISO string
  endDate: string | null; // ISO string
  status: "ACTIVE" | "INACTIVE";
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  period: string; // Format: 'YYYY-MM'
  presentDays: number; // Hadir
  sickDays: number; // Sakit (dengan surat)
  permissionDays: number; // Izin resmi
  alphaDays: number; // Absen tanpa keterangan
  holidayDays: number; // Hari libur nasional di bulan itu
  workingDays: number; // Total hari kerja efektif bulan itu
  notes: string;
  createdBy: string;
  createdAt: string;
}


export interface EmployeeShift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftType: "PAGI" | "SORE" | "MIDDLE" | "OFF";
  notes?: string;
}
export interface DailyAttendance {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockInTime: string | null; // ISO string
  clockOutTime: string | null; // ISO string
  clockInLocation: { lat: number; lng: number } | null;
  clockOutLocation: { lat: number; lng: number } | null;
  clockInPhotoUrl: string | null;
  clockOutPhotoUrl: string | null;
  status: "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "ALPHA";
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  notes: string;
}


export interface DailyChecklist {
  id: string;
  employeeId: string;
  date: string;
  cleaningDone: boolean;
  equipmentChecked: boolean;
  leaderTasks?: string[];
  notes?: string;
}

export interface KPIRecord {
  id: string;
  employeeId: string;
  month: number; // 1-12
  year: number;
  targets: KPITarget[];
  totalScore: number; // 0-100
  kpiBonus: number; // Bonus dalam Rupiah berdasarkan score
  notes: string;
  evaluatedBy: string;
  createdAt: string;
}

export interface KPITarget {
  id: string;
  description: string; // Deskripsi target KPI
  weight: number; // Bobot (total semua harus = 100%)
  score: number; // Skor 0-100
}

export interface DeviceSession {
  id: string;
  userId: string;
  username: string;
  userName: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet";
  ipAddress?: string | null;
  location?: string | null;
  lastActive: string; // ISO string
  createdAt: string; // ISO string
  status: "ACTIVE" | "REVOKED";
  isCurrent?: boolean;
}

export interface Settings {
  logoDataUrl: string | null;
  brandName: string;
  companyAddress: string;
  bankDetails: string;
  salesPerson: string;
  footerMessage: string;
  language: "id" | "en";
  leaderBarTasks?: string[];
  leaderKitchenTasks?: string[];
  leaderBakerTasks?: string[];
  managerTasks?: string[];
  geminiApiKey?: string;
}

export interface CashAccount {
  id: string;
  name: string;
  type: "BANK" | "CASH" | "SAVINGS" | "E_WALLET";
  isDefault: boolean;
}

export interface CashTransaction {
  id: string;
  accountId: string;
  type: "CASH_IN" | "CASH_OUT" | "TRANSFER";
  date: string; // ISO string
  amount: number;
  description: string;
  category: string; // kept for backward compat
  categoryId?: string | null; // FK to ExpenseCategory
  referenceId?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  category: string;
  costPerUnit: number; // Fase 3: untuk valuation stok
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  // Fase 3: extended types
  type: "IN" | "OUT" | "ADJUSTMENT" | "WASTE" | "RETURN" | "TRANSFER" | "USAGE";
  quantity: number;
  date: string; // ISO string
  note: string;
  unitCost?: number | null;
  totalCost?: number | null;
  referenceId?: string | null; // link ke PO
  createdBy: string;
  location?: LocationType | null; // Tempat mutasi/pemakaian
}

export interface SalesTransaction {
  id: string;
  date: string; // ISO string
  menuName: string;
  quantitySold: number;
  totalPrice: number;
  importLogId: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number; // Jumlah yang dipakai per 1 penjualan
}

export interface Recipe {
  id: string;
  menuName: string;
  ingredients: RecipeIngredient[];
}

export interface SalesImportLog {
  id: string;
  importDate: string; // ISO string
  fileName: string;
  rowCount: number;
  status: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string;
  timestamp: string; // ISO string
}

export interface Supplier {
  id: string;
  name: string;
  picName: string;
  contact: string;
  address: string;
  notes: string;
}

export interface PurchaseOrderItem {
  productId: string; // Will be mapped to ingredientId for inventory purposes
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  date: string; // ISO string
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: "PAID" | "UNPAID" | "PARTIAL";
  paymentMethod?: "CASH" | "TEMPO";
  dueDate?: string;
  amountPaid?: number;
  deliveryStatus: "PENDING" | "RECEIVED";
}

export interface ShiftSession {
  id: string;
  userId: string;
  cashAccountId: string; // The specific cash drawer account
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  startingCash: number;
  expectedEndingCash: number | null;
  actualEndingCash: number | null;
  difference: number | null;
  status: "OPEN" | "CLOSED";
}

export interface ClosedPeriod {
  id: string;
  period: string; // YYYY-MM
  closedAt: string;
  closedBy: string;
  notes?: string;
}
