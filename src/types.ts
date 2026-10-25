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
  | "dashboard_owner"
  | "dashboard_finance"
  | "dashboard_manager"
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
  | "attendance_clock"
  | "dashboard_employee"
  | "hpp_calculator"
  | "menu_management"
  | "pos_cashier"
  | "kitchen_display"
  | "promotions";

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
  rawPositionAllowance?: number;
  leaderJobdeskScore?: number;
  matchedLeaderTier?: LeaderAllowanceRule | null;
  kpiBonus: number;
  targetBonus?: number; // Bonus tembus target omzet toko
  transportAllowance: number;
  overtimeHours?: number; // Jam lembur yang disetujui
  overtimeRate?: number; // Upah lembur per jam
  overtimeApproved?: boolean; // Status persetujuan lembur oleh Manager
  overtimePay: number; // Lembur / Tambahan Manual yang disahkan
  alphaDeduction: number;
  lateDeduction?: number; // Potongan Keterlambatan proporsional jam kerja
  lateHours?: number; // Total jam keterlambatan
  lateDays?: number; // Jumlah hari terlambat
  otherDeductions: number;
  grossPay: number;
  netPay: number;
  status: PayrollStatus; // DRAFT | APPROVED (Final) | PAID (Dibayar)
  approvedBy?: string | null;
  approvedAt?: string | null;
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
  alphaDeductionPerDay?: number; // Opsional / legacy: Potongan Alpha per hari
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
  shiftType: "PAGI" | "SORE" | "MIDDLE" | "OFF" | string;
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
  overtimeHours?: number; // Jam kerja di atas 8 jam
  overtimeApproved?: boolean; // Persetujuan lembur oleh Manager
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

export interface TaskItemDetail {
  id?: string;
  text: string;
  shift?: "PAGI" | "MIDDLE" | "SORE" | "ALL";
  targetRole?: "STAFF" | "LEADER" | "ALL";
  isActive?: boolean;
}

export interface TaskCategoryGroup {
  id: string;
  category: string;
  items: (string | TaskItemDetail)[];
}

export interface LeaderAllowanceRule {
  id: string;
  grade: string;
  minScore: number;
  maxScore: number;
  payoutPercentage: number;
  label: string;
  isActive?: boolean;
}

export const DEFAULT_LEADER_ALLOWANCE_RULES: LeaderAllowanceRule[] = [
  { id: "lar-1", grade: "Grade A", minScore: 90, maxScore: 100, payoutPercentage: 100, label: "Sangat Baik (Cair Penuh 100%)", isActive: true },
  { id: "lar-2", grade: "Grade B", minScore: 80, maxScore: 89, payoutPercentage: 80, label: "Baik (Cair 80%)", isActive: true },
  { id: "lar-3", grade: "Grade C", minScore: 70, maxScore: 79, payoutPercentage: 50, label: "Cukup (Cair 50%)", isActive: true },
  { id: "lar-4", grade: "Grade D", minScore: 0, maxScore: 69, payoutPercentage: 0, label: "Kurang / Tidak Memenuhi (Hangus 0%)", isActive: true },
];

export interface ShiftDefinition {
  id: string; // e.g. "PAGI", "MIDDLE", "SORE" or custom
  name: string; // e.g. "Pagi (Opening)", "Middle", "Sore (Closing)"
  startTime: string; // "07:00"
  endTime: string; // "15:00"
  workHours: number; // default 8 jam kerja
  lateToleranceMinutes: number; // default 15 menit
  color?: string; // "emerald" | "blue" | "amber" | "purple" | "indigo" | "rose"
  isActive: boolean;
}

export const DEFAULT_SHIFT_DEFINITIONS: ShiftDefinition[] = [
  { id: "PAGI", name: "Pagi (Opening)", startTime: "07:00", endTime: "15:00", workHours: 8, lateToleranceMinutes: 15, color: "emerald", isActive: true },
  { id: "MIDDLE", name: "Middle", startTime: "11:00", endTime: "19:00", workHours: 8, lateToleranceMinutes: 15, color: "blue", isActive: true },
  { id: "SORE", name: "Sore (Closing)", startTime: "15:00", endTime: "23:00", workHours: 8, lateToleranceMinutes: 15, color: "amber", isActive: true },
];

export interface Settings {
  id?: string;
  logoDataUrl: string | null;
  brandName: string;
  companyAddress: string;
  bankDetails: string;
  salesPerson: string;
  footerMessage: string;
  language: "id" | "en";
  leaderBarTasks?: any;
  leaderKitchenTasks?: any;
  leaderBakerTasks?: any;
  managerTasks?: any;
  geminiApiKey?: string;
  monthlyRevenueTarget?: number;
  targetBonusAmount?: number; // Bonus per karyawan jika omzet tembus target
  divisionKpiBonusTarget?: Record<string, number>; // Plafon Target Bonus KPI per divisi yang diatur Manager
  scheduleApprovals?: Record<string, {
    status: "DRAFT" | "PENDING" | "APPROVED";
    approvedBy?: string;
    approvedAt?: string;
    submittedBy?: string;
    submittedAt?: string;
    revisedBy?: string;
    revisedAt?: string;
    leaderDivision?: string;
    notes?: string;
  }>;
  taxEnabled?: boolean;
  taxRate?: number;
  taxMode?: "INCLUSIVE" | "EXCLUSIVE";
  maxCashierDiscount?: number;
  leaderJobdeskAllowanceRules?: LeaderAllowanceRule[];
  shiftDefinitions?: ShiftDefinition[];
  enableStoreSalesBonus?: boolean;
  enableLeaderAllowanceBonus?: boolean;
  enableKpiScoreBonus?: boolean;
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
  createdBy?: string;
}

export interface Ingredient {
  id: string;
  code?: string;
  name: string;
  unit: string; // Base unit untuk resep (gr, ml, pcs, portion)
  currentStock: number;
  minStock: number;
  category: string;
  costPerUnit: number; // Harga per base unit (Rupiah)
  purchaseUnit?: string; // Satuan beli (Kg, Liter, Karton, Dus, Pack, Botol)
  conversionFactor?: number; // 1 purchaseUnit = X unit (misal 1000 untuk Kg->gr)
  purchasePrice?: number; // Harga beli per purchaseUnit
  storageLocation?: "BAR" | "CHILLER" | "DRY_STORAGE" | "KITCHEN" | "BAKERY" | string;
  notes?: string;
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

export interface DailySalesRecap {
  id: string;
  date: string; // YYYY-MM-DD
  shift?: "ALL" | "PAGI" | "SORE" | "MALAM";
  cashAmount: number;
  qrisAmount: number;
  edcAmount: number;
  transferAmount: number;
  totalAmount: number;
  notes?: string;
  recordedBy: string;
  createdAt: string;
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

// ─── Product, Variant & Kondimen Olahan (Menu Engineering) ───────────────────
export type ProductDivision = "BAR" | "KITCHEN" | "BAKER";

export interface PackagingOption {
  id: string;
  name: string;
  cost: number;
  division?: ProductDivision | "ALL";
  isIncluded?: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string; // e.g. "Hot 8oz", "Iced 16oz", "Botol 1L", "Single", "Double"
  sku?: string;
  price: number; // Harga jual resmi (Rupiah integer)
  recipeId?: string | null;
  recipe?: RecipeIngredient[]; // Takaran bahan spesifik varian ini
  packagingCost?: number;
  packagingNotes?: string;
  estimatedHpp?: number;
  isAvailable: boolean;
}

export interface ProductModifier {
  id: string;
  name: string; // e.g. "Extra Shot Espresso", "Ganti Susu Oat", "Sirup Vanilla"
  price: number; // Harga tambahan (e.g. 5000)
  cost?: number; // Estimasi HPP tambahan
  recipe?: RecipeIngredient[]; // Bahan yang dipotong (e.g. 18g espresso beans)
}

export interface ProductModifierGroup {
  id: string;
  name: string; // e.g. "Pilihan Susu", "Extra Shot", "Level Manis"
  minSelect?: number;
  maxSelect?: number;
  options: ProductModifier[];
}

export interface Product {
  id: string;
  name: string; // e.g. "Kopi Susu Gula Aren", "Cafe Latte"
  category: string; // "COFFEE" | "NON-COFFEE" | "FOOD" | "BAKERY" | "TEA" | "SNACK"
  division: ProductDivision;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  variants: ProductVariant[];
  modifierGroups?: ProductModifierGroup[];
  createdAt: string;
  updatedAt?: string;
}

export interface BatchPreparation {
  id: string;
  name: string; // e.g. "Saus Gula Aren Racikan", "Simple Syrup", "Sambal Matah", "Cold Brew Concentrate"
  division: ProductDivision; // "BAR" | "KITCHEN" | "BAKER"
  targetIngredientId: string; // ID bahan jadi di master Ingredient
  targetIngredientName?: string;
  yieldQuantity: number; // Jumlah hasil olahan, misal 1200
  yieldUnit: string; // "ml", "gr", "portion"
  ingredients: RecipeIngredient[]; // Bahan mentah yang dipakai (misal 1000 gr aren + 600 ml air)
  notes?: string;
  lastPreparedDate?: string;
}

export const DEFAULT_DIVISION_PACKAGING: Record<ProductDivision, PackagingOption[]> = {
  BAR: [
    { id: "cup-16oz", name: "Cup Plastik Injection 16oz", cost: 650, division: "BAR", isIncluded: true },
    { id: "lid-flat", name: "Tutup Flat Lid", cost: 200, division: "BAR", isIncluded: true },
    { id: "straw-steril", name: "Sedotan Steril", cost: 150, division: "BAR", isIncluded: true },
    { id: "cup-hot-8oz", name: "Paper Cup Hot 8oz + Lid", cost: 850, division: "BAR", isIncluded: false },
    { id: "bottle-1l", name: "Botol Kaca/PET 1 Liter + Segel", cost: 2800, division: "BAR", isIncluded: false },
    { id: "cup-sleeve", name: "Cup Sleeve / Stiker Logo", cost: 150, division: "BAR", isIncluded: false },
    { id: "tway-bag", name: "Kantong Plastik Takeaway 1 Cup", cost: 150, division: "BAR", isIncluded: false },
  ],
  KITCHEN: [
    { id: "rice-bowl", name: "Paper Bowl + Lid 650ml", cost: 1200, division: "KITCHEN", isIncluded: true },
    { id: "cutlery-set", name: "Sendok Garpu Kayu + Tisue", cost: 450, division: "KITCHEN", isIncluded: true },
    { id: "bento-box", name: "Bento Box Sekat 4", cost: 2200, division: "KITCHEN", isIncluded: false },
    { id: "kertas-nasi", name: "Kertas Nasi Laminasi", cost: 250, division: "KITCHEN", isIncluded: false },
    { id: "paperbag-food", name: "Paperbag Makanan Cokelat", cost: 800, division: "KITCHEN", isIncluded: false },
  ],
  BAKER: [
    { id: "paperbag-roti", name: "Paperbag Roti / Pastry Gusset", cost: 450, division: "BAKER", isIncluded: true },
    { id: "cake-box-slice", name: "Kotak Mika Slice Cake", cost: 950, division: "BAKER", isIncluded: false },
    { id: "cake-box-large", name: "Cake Box Karton 20x20", cost: 3500, division: "BAKER", isIncluded: false },
    { id: "baking-paper", name: "Baking Paper Alas", cost: 150, division: "BAKER", isIncluded: false },
  ],
};

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
  supplierName?: string;
  purchaseType?: "DISTRIBUTOR" | "MARKET";
  cashAccountId?: string;
  notes?: string;
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
  picEmployeeId?: string;
  picEmployeeName?: string;
  teamMembers?: string[];
}

export interface ClosedPeriod {
  id: string;
  period: string; // YYYY-MM
  closedAt: string;
  closedBy: string;
  notes?: string;
}

// ─── POS & Transaksi Kasir ──────────────────────────────────────────────────

export type OrderType = "DINE_IN" | "TAKE_AWAY";
export type OrderStatus = "OPEN" | "PAID" | "CANCELLED" | "VOID" | "REFUNDED";
export type PaymentMethod = "CASH" | "QRIS" | "DEBIT" | "CREDIT";
export type PrintDestination = "RECEIPT" | "BAR" | "KITCHEN" | "BAKERY" | "NONE";

export type KitchenStatus = "QUEUED" | "PREPARING" | "READY" | "SERVED";

export interface OrderModifier {
  name: string;
  price: number;
  quantity?: number;
  extraPrice?: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuName: string;
  recipeId?: string | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  modifiers?: OrderModifier[];
  notes?: string | null;
  printDestination: PrintDestination;
  isPrinted: boolean;
  itemStatus?: KitchenStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  shiftId?: string | null;
  paymentMethod: PaymentMethod;
  amount: number;
  cashReceived?: number | null;
  changeAmount?: number | null;
  referenceNo?: string | null;
  cashAccountId?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  receiptNo: string;
  shiftId?: string | null;
  outletId: string;
  orderType: OrderType;
  tableNumber?: string | null;
  customerName?: string | null;
  status: OrderStatus;
  kitchenStatus?: KitchenStatus;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountReason?: string | null;
  taxPercent: number;
  taxAmount: number;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  totalAmount: number;
  notes?: string | null;
  idempotencyKey?: string | null;
  cashierId?: string | null;
  cashierName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  paidAt?: string | null;
  voidReason?: string | null;
  voidApprovedBy?: string | null;
  refundReason?: string | null;
  refundApprovedBy?: string | null;
  refundAmount?: number | null;
  refundMethod?: string | null;
  refundAt?: string | null;
  refundRestockOption?: "RETURN_TO_STOCK" | "WASTE" | "NONE" | null;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  items?: OrderItem[];
  payments?: Payment[];
}

export interface PosPrinter {
  id: string;
  name: string;
  connectionType: "LAN" | "BLUETOOTH" | "USB";
  targetStation: PrintDestination;
  ipAddress?: string | null;
  port: number;
  macAddress?: string | null;
  paperWidth: "58mm" | "80mm";
  isActive: boolean;
  createdAt: string;
}

// ─── Promo & Diskon (Pre-authorized Whitelist) ─────────────────────────────
export type PromotionType = "PERCENT" | "NOMINAL";

export interface Promotion {
  id: string;
  name: string;
  code?: string | null;
  type: PromotionType;
  value: number; // Persentase (e.g. 20) atau Nominal Rp (e.g. 10000)
  minSpend?: number | null; // Minimal subtotal belanja agar promo dapat digunakan
  maxDiscount?: number | null; // Plafon maksimal potongan diskon (khusus tipe PERCENT)
  isActive: boolean; // Jika aktif, kasir bisa memilih promo ini di POS
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

// ─── Remote In-App Approval (Void, Refund, Diskon) ──────────────────────────
export type ApprovalRequestType = "REFUND" | "VOID" | "DISCOUNT";
export type ApprovalRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ManagerApprovalRequest {
  id: string;
  orderId: string;
  receiptNo: string;
  type: ApprovalRequestType;
  amount: number;
  reason: string;
  cashierName: string;
  tableNumber?: string | null;
  customerName?: string | null;
  refundMethod?: string | null;
  refundRestockOption?: "RETURN_TO_STOCK" | "WASTE" | "NONE" | null;
  status: ApprovalRequestStatus;
  requestedAt: string;
  respondedAt?: string | null;
  respondedBy?: string | null;
  responseNote?: string | null;
}

