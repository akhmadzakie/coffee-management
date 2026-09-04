export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER_CABANG' | 'KASIR' | 'ADMIN_OPERASIONAL' | 'FINANCE' | 'PURCHASING' | 'BARISTA' | 'WAITER' | 'HRD' | 'MARKETING' | 'AUDITOR';

export interface User {
  id: string;
  username: string;
  pin: string;
  name: string;
  role: Role;
}

export type ViewState = 'dashboard' | 'cash_flow' | 'inventory' | 'import_sales' | 'settings' | 'users' | 'audit_log' | 'shifts' | 'suppliers' | 'purchases' | 'hr';

export type EmploymentType = 'TETAP' | 'KONTRAK' | 'PARUH_WAKTU' | 'MAGANG';
export type EmployeeStatus = 'AKTIF' | 'TIDAK_AKTIF' | 'RESIGN' | 'PHK';
export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA' | 'LIBUR';

export interface Employee {
  id: string;
  nik: string; // Nomor Induk Karyawan
  name: string;
  position: string; // Jabatan
  department: string;
  employmentType: EmploymentType;
  startDate: string; // ISO string
  endDate: string | null; // for contracts
  phone: string;
  address: string;
  status: EmployeeStatus;
  createdAt: string;
}

export interface EmployeeContract {
  id: string;
  employeeId: string;
  effectiveDate: string; // ISO string - tanggal berlaku
  basicSalary: number; // Gaji pokok
  mealAllowance: number; // Tunjangan makan
  positionAllowance: number; // Tunjangan jabatan
  alphaDeductionPerDay: number; // Potongan per hari alpha
  workingDaysPerMonth: number; // HKE - Hari Kerja Efektif normal
  notes: string;
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

export interface KPIRecord {
  id: string;
  employeeId: string;
  quarter: number; // 1, 2, 3, atau 4
  year: number;
  targets: KPITarget[];
  totalScore: number; // 0-100, average dari semua target
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
  deviceType: 'desktop' | 'mobile' | 'tablet';
  ipAddress?: string | null;
  location?: string | null;
  lastActive: string; // ISO string
  createdAt: string; // ISO string
  status: 'ACTIVE' | 'REVOKED';
  isCurrent?: boolean;
}

export interface Settings {
  logoDataUrl: string | null;
  brandName: string;
  companyAddress: string;
  bankDetails: string;
  salesPerson: string;
  footerMessage: string;
  language: 'id' | 'en';
}

export interface CashAccount {
  id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'SAVINGS';
  isDefault: boolean;
}

export interface CashTransaction {
  id: string;
  accountId: string;
  type: 'CASH_IN' | 'CASH_OUT' | 'TRANSFER';
  date: string; // ISO string
  amount: number;
  description: string;
  category: string;
  referenceId?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  category: string;
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string; // ISO string
  note: string;
  createdBy: string;
}

export interface SalesTransaction {
  id: string;
  date: string; // ISO string
  menuName: string;
  quantitySold: number;
  totalPrice: number;
  importLogId: string;
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
  action: 'CREATE' | 'UPDATE' | 'DELETE';
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
  status: 'PAID' | 'UNPAID';
  deliveryStatus: 'PENDING' | 'RECEIVED';
}

export interface ShiftSession {
  id: string;
  userId: string;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  startingCash: number;
  expectedEndingCash: number | null;
  actualEndingCash: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
}
