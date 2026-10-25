import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  User,
  Role,
  DeviceSession,
  Settings,
  CashAccount,
  CashTransaction,
  Ingredient,
  StockMovement,
  SalesTransaction,
  DailySalesRecap,
  SalesImportLog,
  AuditLog,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  ShiftSession,
  Employee,
  EmployeeContract,
  AttendanceRecord,
  KPIRecord,
  DailyAttendance,
  DailyChecklist,
  EmployeeShift,
  // Fase 1-4
  ExpenseCategory,
  Budget,
  PayrollRecord,
  BankReconciliation,
  BankStatementLine,
  StockOpname,
  StockOpnameItem,
  Recipe,
  ClosedPeriod,
  DEFAULT_LEADER_ALLOWANCE_RULES,
  DEFAULT_SHIFT_DEFINITIONS,
  Product,
  ProductVariant,
  BatchPreparation,
  DEFAULT_DIVISION_PACKAGING,
  Promotion,
} from "../types";
import { detectDeviceAsync, DetectedDeviceInfo } from "../utils/deviceDetector";
import { get, set, del } from "idb-keyval";

const generateId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if randomUUID fails for any reason
  }
  return (
    "id_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
};

export const DEFAULT_INITIAL_INGREDIENTS: Ingredient[] = [
  { id: "ing-coffee-beans", name: "House Blend Espresso Beans", unit: "gr", currentStock: 4500, minStock: 1000, category: "Coffee", costPerUnit: 250, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 250000, storageLocation: "BAR" },
  { id: "ing-fresh-milk", name: "Fresh Milk UHT Greenfields", unit: "ml", currentStock: 18000, minStock: 5000, category: "Dairy", costPerUnit: 18.5, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 18500, storageLocation: "CHILLER" },
  { id: "ing-aren-padat", name: "Gula Aren Batok Organik", unit: "gr", currentStock: 8000, minStock: 2000, category: "Pemanis", costPerUnit: 35, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 35000, storageLocation: "DRY_STORAGE" },
  { id: "ing-air", name: "Air Bersih Galon RO", unit: "ml", currentStock: 50000, minStock: 10000, category: "Air & Es", costPerUnit: 0.5, purchaseUnit: "Galon (19L)", conversionFactor: 19000, purchasePrice: 9500, storageLocation: "BAR" },
  { id: "ing-gula-pasir", name: "Gula Pasir Kristal Putih", unit: "gr", currentStock: 12000, minStock: 3000, category: "Pemanis", costPerUnit: 16, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 16000, storageLocation: "DRY_STORAGE" },
  { id: "ing-aren-cair", name: "Gula Aren Cair Racikan", unit: "ml", currentStock: 2400, minStock: 800, category: "Kondimen Olahan", costPerUnit: 38, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 38000, storageLocation: "BAR" },
  { id: "ing-simple-syrup", name: "Simple Syrup (1:1)", unit: "ml", currentStock: 3200, minStock: 1000, category: "Kondimen Olahan", costPerUnit: 12, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 12000, storageLocation: "BAR" },
  { id: "ing-ice-cube", name: "Es Batu Kristal Tube", unit: "gr", currentStock: 25000, minStock: 5000, category: "Air & Es", costPerUnit: 2, purchaseUnit: "Plastik (10Kg)", conversionFactor: 10000, purchasePrice: 20000, storageLocation: "BAR" },
  { id: "ing-beras", name: "Beras Pulen Pandan Wangi", unit: "gr", currentStock: 15000, minStock: 5000, category: "Kitchen", costPerUnit: 16, purchaseUnit: "Karung (25Kg)", conversionFactor: 25000, purchasePrice: 400000, storageLocation: "KITCHEN" },
  { id: "ing-ayam-fillet", name: "Daging Ayam Fillet Paha", unit: "gr", currentStock: 4800, minStock: 1500, category: "Kitchen", costPerUnit: 58, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 58000, storageLocation: "KITCHEN" },
  { id: "ing-bawang-merah", name: "Bawang Merah Kupas", unit: "gr", currentStock: 3000, minStock: 1000, category: "Kitchen", costPerUnit: 38, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 38000, storageLocation: "KITCHEN" },
  { id: "ing-cabai-rawit", name: "Cabai Rawit Merah Segar", unit: "gr", currentStock: 2000, minStock: 800, category: "Kitchen", costPerUnit: 60, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 60000, storageLocation: "KITCHEN" },
  { id: "ing-minyak-kelapa", name: "Minyak Kelapa Asli", unit: "ml", currentStock: 4000, minStock: 1000, category: "Kitchen", costPerUnit: 32, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 32000, storageLocation: "KITCHEN" },
  { id: "ing-sambal-matah", name: "Sambal Matah Matang", unit: "gr", currentStock: 1800, minStock: 500, category: "Kondimen Olahan", costPerUnit: 48, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 48000, storageLocation: "KITCHEN" },
  { id: "ing-minyak-goreng", name: "Minyak Goreng Sawit", unit: "ml", currentStock: 10000, minStock: 3000, category: "Kitchen", costPerUnit: 18, purchaseUnit: "Jerigen (5L)", conversionFactor: 5000, purchasePrice: 90000, storageLocation: "KITCHEN" },
  { id: "ing-adonan-croissant", name: "Dough Croissant Butter 70g", unit: "pcs", currentStock: 40, minStock: 15, category: "Bakery", costPerUnit: 6500, purchaseUnit: "Dus (20pcs)", conversionFactor: 20, purchasePrice: 130000, storageLocation: "BAKERY" },
  { id: "ing-butter", name: "French Pure Butter Elle & Vire", unit: "gr", currentStock: 2500, minStock: 500, category: "Bakery", costPerUnit: 140, purchaseUnit: "Pack (250g)", conversionFactor: 250, purchasePrice: 35000, storageLocation: "CHILLER" },
  { id: "ing-sabun-cuci", name: "Sunlight Sabun Cuci Piring (Jerigen 5L)", unit: "jerigen", currentStock: 2, minStock: 1, category: "Kebersihan & Operasional", costPerUnit: 45000, purchaseUnit: "Jerigen (5L)", conversionFactor: 1, purchasePrice: 45000, storageLocation: "OPERATIONAL" },
  { id: "ing-plastik-sampah", name: "Plastik Sampah Hitam 80x100 (Pack)", unit: "pack", currentStock: 5, minStock: 2, category: "Kebersihan & Operasional", costPerUnit: 18000, purchaseUnit: "Pack", conversionFactor: 1, purchasePrice: 18000, storageLocation: "OPERATIONAL" },
];

export const DEFAULT_BATCH_PREPARATIONS: BatchPreparation[] = [
  {
    id: "bp-gula-aren",
    name: "Saus Gula Aren Racikan",
    division: "BAR",
    targetIngredientId: "ing-aren-cair",
    targetIngredientName: "Gula Aren Cair Racikan",
    yieldQuantity: 1200,
    yieldUnit: "ml",
    ingredients: [
      { ingredientId: "ing-aren-padat", quantity: 1000 },
      { ingredientId: "ing-air", quantity: 600 },
    ],
    notes: "Masak api kecil selama 25 menit bersama daun pandan hingga mengental. Saring sebelum disimpan di chiller botol.",
    lastPreparedDate: new Date().toISOString(),
  },
  {
    id: "bp-simple-syrup",
    name: "Simple Syrup Bar",
    division: "BAR",
    targetIngredientId: "ing-simple-syrup",
    targetIngredientName: "Simple Syrup (1:1)",
    yieldQuantity: 1600,
    yieldUnit: "ml",
    ingredients: [
      { ingredientId: "ing-gula-pasir", quantity: 1000 },
      { ingredientId: "ing-air", quantity: 1000 },
    ],
    notes: "Aduk hingga gula larut sempurna (rasio 1:1). Simpan dalam squeeze bottle bar.",
    lastPreparedDate: new Date().toISOString(),
  },
  {
    id: "bp-cold-brew",
    name: "Cold Brew Concentrate",
    division: "BAR",
    targetIngredientId: "ing-coffee-beans",
    targetIngredientName: "Cold Brew Concentrate",
    yieldQuantity: 1200,
    yieldUnit: "ml",
    ingredients: [
      { ingredientId: "ing-coffee-beans", quantity: 250 },
      { ingredientId: "ing-air", quantity: 1500 },
    ],
    notes: "Steep selama 16-18 jam di chiller 4°C, saring 2 lapis paper filter.",
    lastPreparedDate: new Date().toISOString(),
  },
  {
    id: "bp-sambal-matah",
    name: "Sambal Matah House",
    division: "KITCHEN",
    targetIngredientId: "ing-sambal-matah",
    targetIngredientName: "Sambal Matah Matang",
    yieldQuantity: 900,
    yieldUnit: "gr",
    ingredients: [
      { ingredientId: "ing-bawang-merah", quantity: 500 },
      { ingredientId: "ing-cabai-rawit", quantity: 300 },
      { ingredientId: "ing-minyak-kelapa", quantity: 200 },
    ],
    notes: "Iris halus bahan mentah, siram dengan minyak kelapa panas mendidih dan perasan jeruk limau.",
    lastPreparedDate: new Date().toISOString(),
  },
  {
    id: "bp-pastry-cream",
    name: "Pastry Cream (Vanilla Custard)",
    division: "BAKER",
    targetIngredientId: "ing-pastry-cream",
    targetIngredientName: "Pastry Cream Vanilla",
    yieldQuantity: 1000,
    yieldUnit: "gr",
    ingredients: [
      { ingredientId: "ing-fresh-milk", quantity: 600 },
      { ingredientId: "ing-gula-pasir", quantity: 150 },
    ],
    notes: "Masak susu segar, kuning telur, dan pati jagung hingga meletup dan kental berkilau. Dinginkan tertutup plastic wrap.",
    lastPreparedDate: new Date().toISOString(),
  },
];

export const DEFAULT_PRODUCTS: Product[] = [
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
        packagingNotes: "Cup 16oz + Lid + Sedotan Steril",
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
        packagingNotes: "Paper Cup Hot 8oz + Lid",
        estimatedHpp: 6900,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 140 },
          { ingredientId: "ing-aren-cair", quantity: 20 },
        ],
      },
      {
        id: "var-kopsu-1l",
        productId: "prod-kopsu-aren",
        name: "Botol 1 Liter",
        sku: "JUL-BAR-003",
        price: 85000,
        packagingCost: 2800,
        packagingNotes: "Botol PET 1L + Segel Cap",
        estimatedHpp: 28500,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 90 },
          { ingredientId: "ing-fresh-milk", quantity: 650 },
          { ingredientId: "ing-aren-cair", quantity: 140 },
        ],
      },
    ],
    modifierGroups: [
      {
        id: "modgrp-milk",
        name: "Pilihan Susu Alternatif",
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: "mod-oatmilk", name: "Ganti Oat Milk (Oatside)", price: 8000, cost: 3500 },
          { id: "mod-soymilk", name: "Ganti Soy Milk", price: 6000, cost: 2500 },
        ],
      },
      {
        id: "modgrp-extra",
        name: "Tambahan Shot & Topping",
        minSelect: 0,
        maxSelect: 2,
        options: [
          { id: "mod-extra-shot", name: "Extra Shot Espresso", price: 6000, cost: 2500, recipe: [{ ingredientId: "ing-coffee-beans", quantity: 9 }] },
          { id: "mod-caramel-drizzle", name: "Caramel Drizzle", price: 4000, cost: 1200 },
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
        estimatedHpp: 6500,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 150 },
        ],
      },
      {
        id: "var-latte-iced",
        productId: "prod-cafe-latte",
        name: "Iced 16oz",
        sku: "JUL-BAR-011",
        price: 27000,
        packagingCost: 1000,
        estimatedHpp: 6900,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 140 },
          { ingredientId: "ing-ice-cube", quantity: 120 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod-ayam-matah",
    name: "Nasi Ayam Sambal Matah",
    category: "FOOD",
    division: "KITCHEN",
    description: "Nasi pulen hangat dengan ayam fillet krispi keemasan disiram sambal matah racikan segar.",
    isActive: true,
    variants: [
      {
        id: "var-ayam-reguler",
        productId: "prod-ayam-matah",
        name: "Porsi Reguler",
        sku: "JUL-KIT-001",
        price: 35000,
        packagingCost: 1650,
        packagingNotes: "Paper Bowl 650ml + Sendok Garpu Kayu",
        estimatedHpp: 13500,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-beras", quantity: 150 },
          { ingredientId: "ing-ayam-fillet", quantity: 120 },
          { ingredientId: "ing-sambal-matah", quantity: 40 },
          { ingredientId: "ing-minyak-goreng", quantity: 30 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod-croissant-butter",
    name: "French Butter Croissant",
    category: "BAKERY",
    division: "BAKER",
    description: "Croissant berlapis renyah keemasan dengan mentega murni Prancis yang wangi gurih.",
    isActive: true,
    variants: [
      {
        id: "var-croissant-single",
        productId: "prod-croissant-butter",
        name: "Single Piece",
        sku: "JUL-BAK-001",
        price: 24000,
        packagingCost: 450,
        packagingNotes: "Paperbag Roti Gusset",
        estimatedHpp: 7800,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-adonan-croissant", quantity: 1 },
          { ingredientId: "ing-butter", quantity: 15 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "cat-pendapatan", name: "Pendapatan", type: "PENDAPATAN", parentId: null, color: "#10B981", icon: "trending-up", isActive: true, sortOrder: 1 },
  { id: "cat-pengeluaran", name: "Pengeluaran Operasional", type: "PENGELUARAN", parentId: null, color: "#EF4444", icon: "trending-down", isActive: true, sortOrder: 2 },
  { id: "cat-bahan-baku", name: "Bahan Baku", type: "BAHAN_BAKU", parentId: null, color: "#F59E0B", icon: "package", isActive: true, sortOrder: 3 },
  { id: "cat-utilitas", name: "Utilitas", type: "UTILITAS", parentId: null, color: "#3B82F6", icon: "zap", isActive: true, sortOrder: 4 },
  { id: "cat-hrd", name: "HRD & Personalia", type: "HRD", parentId: null, color: "#8B5CF6", icon: "users", isActive: true, sortOrder: 5 },
  { id: "cat-aset", name: "Pembelian Aset", type: "ASET", parentId: null, color: "#6366F1", icon: "briefcase", isActive: true, sortOrder: 6 },
  { id: "cat-lainnya", name: "Lainnya", type: "LAINNYA", parentId: null, color: "#6B7280", icon: "more-horizontal", isActive: true, sortOrder: 7 },
  // Sub-Kategori: Pendapatan
  { id: "cat-penjualan", name: "Penjualan Minuman", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#34D399", icon: "coffee", isActive: true, sortOrder: 1 },
  { id: "cat-penjualan-makanan", name: "Penjualan Makanan", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#6EE7B7", icon: "utensils", isActive: true, sortOrder: 2 },
  { id: "cat-pendapatan-lain", name: "Pendapatan Lain / Event", type: "PENDAPATAN", parentId: "cat-pendapatan", color: "#A7F3D0", icon: "plus-circle", isActive: true, sortOrder: 3 },
  // Sub-Kategori: Pengeluaran Operasional
  { id: "cat-sewa", name: "Sewa Tempat", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "home", isActive: true, sortOrder: 1 },
  { id: "cat-kebersihan", name: "Kebersihan & Sanitasi", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "trash-2", isActive: true, sortOrder: 2 },
  { id: "cat-marketing-ops", name: "Marketing & Promosi", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "megaphone", isActive: true, sortOrder: 3 },
  { id: "cat-opex-lain", name: "Operasional Lainnya", type: "PENGELUARAN", parentId: "cat-pengeluaran", color: "#FCA5A5", icon: "settings", isActive: true, sortOrder: 4 },
  // Sub-Kategori: Bahan Baku
  { id: "cat-kopi", name: "Kopi & Espresso", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "coffee", isActive: true, sortOrder: 1 },
  { id: "cat-susu", name: "Susu & Dairy", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "droplets", isActive: true, sortOrder: 2 },
  { id: "cat-minuman", name: "Minuman & Sirup", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "cup-soda", isActive: true, sortOrder: 3 },
  { id: "cat-packaging", name: "Packaging & Kemasan", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "box", isActive: true, sortOrder: 4 },
  { id: "cat-bahan-lain", name: "Bahan Baku Lainnya (Es/Gas/Galon)", type: "BAHAN_BAKU", parentId: "cat-bahan-baku", color: "#FCD34D", icon: "shopping-cart", isActive: true, sortOrder: 5 },
  // Sub-Kategori: Utilitas
  { id: "cat-listrik", name: "Listrik & PLN", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "zap", isActive: true, sortOrder: 1 },
  { id: "cat-air", name: "Air & PDAM", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "droplets", isActive: true, sortOrder: 2 },
  { id: "cat-internet", name: "Internet & WiFi", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "wifi", isActive: true, sortOrder: 3 },
  { id: "cat-gas", name: "Gas LPG", type: "UTILITAS", parentId: "cat-utilitas", color: "#93C5FD", icon: "flame", isActive: true, sortOrder: 4 },
  // Sub-Kategori: HRD
  { id: "cat-gaji", name: "Gaji & Upah Karyawan", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "wallet", isActive: true, sortOrder: 1 },
  { id: "cat-bpjs", name: "BPJS & Asuransi", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "shield", isActive: true, sortOrder: 2 },
  { id: "cat-tunjangan", name: "Bonus, Kasbon & Tunjangan", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "gift", isActive: true, sortOrder: 3 },
  { id: "cat-pelatihan", name: "Pelatihan & Seragam", type: "HRD", parentId: "cat-hrd", color: "#C4B5FD", icon: "book-open", isActive: true, sortOrder: 4 },
];

interface StoreContextType {
  currentUser: User | null;
  users: User[];
  sessions: DeviceSession[];
  settings: Settings;
  cashAccounts: CashAccount[];
  cashTransactions: CashTransaction[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  products: Product[];
  batchPreparations: BatchPreparation[];
  stockMovements: StockMovement[];
  salesTransactions: SalesTransaction[];
  dailySalesRecaps: DailySalesRecap[];
  addDailySalesRecap: (recap: Omit<DailySalesRecap, "id" | "createdAt">) => void;
  deleteDailySalesRecap: (id: string) => void;
  salesImportLogs: SalesImportLog[];
  auditLogs: AuditLog[];

  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  shifts: ShiftSession[];

  employees: Employee[];
  contracts: EmployeeContract[];
  attendances: AttendanceRecord[];
    dailyAttendances: DailyAttendance[];
  setDailyAttendances: (a: DailyAttendance[]) => void;
  updateDailyAttendance: (att: DailyAttendance) => void;
  dailyChecklists: DailyChecklist[];
  setDailyChecklists: (c: DailyChecklist[]) => void;
  employeeShifts: EmployeeShift[];
  setEmployeeShifts: (shifts: EmployeeShift[]) => void;
  kpiRecords: KPIRecord[];

  // Fase 1: Expense Categories
  expenseCategories: ExpenseCategory[];
  addExpenseCategory: (cat: ExpenseCategory) => void;
  updateExpenseCategory: (cat: ExpenseCategory) => void;
  deleteExpenseCategory: (id: string) => void;

  // Fase 2: Finance
  budgets: Budget[];
  addBudget: (b: Budget) => void;
  updateBudget: (b: Budget) => void;
  deleteBudget: (id: string) => void;
  bankReconciliations: BankReconciliation[];
  addBankReconciliation: (r: BankReconciliation) => void;
  updateBankReconciliation: (r: BankReconciliation) => void;
  
  bankStatementLines: BankStatementLine[];
  addBankStatementLine: (l: BankStatementLine) => void;
  updateBankStatementLine: (l: BankStatementLine) => void;
  bulkAddBankStatementLines: (lines: BankStatementLine[]) => void;

  // Fase 3: Inventory
  stockOpnames: StockOpname[];
  stockOpnameItems: StockOpnameItem[];
  addStockOpname: (o: StockOpname) => void;
  updateStockOpname: (o: StockOpname) => void;
  deleteStockOpname: (id: string) => void;
  addStockOpnameItem: (i: StockOpnameItem) => void;
  bulkAddStockOpnameItems: (items: StockOpnameItem[]) => void;
  updateStockOpnameItem: (i: StockOpnameItem) => void;

  // Fase 4: Payroll
  payrollRecords: PayrollRecord[];
  addPayrollRecord: (p: PayrollRecord) => void;
  updatePayrollRecord: (p: PayrollRecord) => void;
  deletePayrollRecord: (id: string) => void;
  bulkAddPayrollRecords: (records: PayrollRecord[]) => void;

  closedPeriods: ClosedPeriod[];
  closePeriod: (period: string, notes?: string) => void;
  reopenPeriod: (period: string, notes?: string) => void;

  // Generic state access (for new modules)
  state: any;
  dispatch: (action: any) => void;

  // Promo & Diskon (Pre-authorized Whitelist)
  promotions: Promotion[];
  addPromotion: (promo: Omit<Promotion, "id" | "createdAt">) => void;
  updatePromotion: (id: string, promo: Partial<Promotion>) => void;
  deletePromotion: (id: string) => void;
  togglePromotionStatus: (id: string) => void;

  addEmployee: (emp: Omit<Employee, "id" | "createdAt">) => string;
  updateEmployee: (emp: Employee) => void;
  deleteEmployee: (id: string) => void;

  addContract: (contract: Omit<EmployeeContract, "id">) => void;
  updateContract: (contract: EmployeeContract) => void;
  deleteContract: (id: string) => void;

  addAttendance: (
    att: Omit<AttendanceRecord, "id" | "createdAt" | "createdBy">,
  ) => void;
  updateAttendance: (att: AttendanceRecord) => void;

  addDailyAttendance: (
    att: Omit<DailyAttendance, "id">,
  ) => void;

  addKPI: (kpi: Omit<KPIRecord, "id" | "createdAt" | "evaluatedBy">) => void;
  updateKPI: (kpi: KPIRecord) => void;

  addSupplier: (supplier: Omit<Supplier, "id">) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;

  addPurchaseOrder: (po: Omit<PurchaseOrder, "id">) => void;
  addDirectMarketPurchase: (data: {
    marketName: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    cashAccountId?: string;
    notes?: string;
  }) => PurchaseOrder;
  updatePOStatus: (id: string, status: "PAID" | "UNPAID" | "PARTIAL") => void;
  payPurchaseOrder: (
    id: string,
    amount: number,
    cashAccountId: string,
    notes?: string,
    date?: string,
  ) => void;
  markPOAsReceived: (id: string) => void;
  deletePurchaseOrder: (id: string) => void;

  openShift: (shift: Omit<ShiftSession, "id">) => void;
  closeShift: (
    id: string,
    actualEndingCash: number,
    expectedEndingCash: number,
  ) => void;

  // Actions
  updateSettings: (settings: Settings) => void;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: Omit<User, "id">) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;

  addCashAccount: (account: Omit<CashAccount, "id">) => void;
  updateCashAccount: (account: CashAccount) => void;
  deleteCashAccount: (id: string) => void;

  addCashTransaction: (transaction: Omit<CashTransaction, "id">) => void;
  updateCashTransaction: (transaction: CashTransaction) => void;
  deleteCashTransaction: (id: string) => void;

  addIngredient: (ingredient: Omit<Ingredient, "id">) => void;
  updateIngredient: (ingredient: Ingredient) => void;
  deleteIngredient: (id: string) => void;

  addRecipe: (recipe: Omit<Recipe, "id">) => void;
  updateRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;

  addProduct: (product: Omit<Product, "id" | "createdAt">) => string;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

  addBatchPreparation: (bp: Omit<BatchPreparation, "id">) => string;
  updateBatchPreparation: (bp: BatchPreparation) => void;
  deleteBatchPreparation: (id: string) => void;
  executeBatchCook: (batchPrepId: string, multiplier?: number, notes?: string) => { success: boolean; message: string };

  addStockMovement: (movement: Omit<StockMovement, "id">) => void;
  addSalesTransactions: (transactions: Omit<SalesTransaction, "id">[], fileName?: string) => void;

  // Sync Status
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncData: () => Promise<void>;

  // Session handling
  currentSessionId: string;
  fetchSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<boolean>;
  revokeOtherSessions: () => Promise<boolean>;
  wasForceLoggedOut: boolean;
  dismissForceLogoutAlert: () => void;
  isReadOnly: boolean; // true for OWNER — can view but not edit
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [settings, setSettings] = useState<Settings>(() => {
    const defaultSettings: Settings = {
      id: "1",
      logoDataUrl: "/logo-wordmark-white.png",
      brandName: "Julia's",
      companyAddress: "Julia's • Specialty Room • Coffee • Eatery",
      bankDetails: "Bank BCA 1234567890",
      salesPerson: "Admin",
      footerMessage: "Terima kasih atas kunjungannya di Julia's.",
      language: "id",
      monthlyRevenueTarget: 150000000,
      targetBonusAmount: 0,
      divisionKpiBonusTarget: {},
      scheduleApprovals: {},
      leaderJobdeskAllowanceRules: DEFAULT_LEADER_ALLOWANCE_RULES,
      shiftDefinitions: DEFAULT_SHIFT_DEFINITIONS,
      enableStoreSalesBonus: true,
      enableLeaderAllowanceBonus: true,
      enableKpiScoreBonus: false,
    };
    try {
      const cached = localStorage.getItem("app_settings_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...defaultSettings, ...parsed };
      }
    } catch {}
    return defaultSettings;
  });

  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(
    [],
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    try {
      const saved = localStorage.getItem("app_ingredients_cache");
      if (saved) {
        const parsed: Ingredient[] = JSON.parse(saved);
        // Enrich any existing cached items with purchaseUnit & conversionFactor if missing
        return parsed.map((item) => {
          const matchDefault = DEFAULT_INITIAL_INGREDIENTS.find((d) => d.id === item.id);
          if (matchDefault && (!item.purchaseUnit || !item.conversionFactor)) {
            return {
              ...item,
              purchaseUnit: item.purchaseUnit || matchDefault.purchaseUnit,
              conversionFactor: item.conversionFactor || matchDefault.conversionFactor,
              purchasePrice: item.purchasePrice || matchDefault.purchasePrice,
              storageLocation: item.storageLocation || matchDefault.storageLocation,
            };
          }
          if (!item.purchaseUnit && (item.unit === "gr" || item.unit === "gram")) {
            return { ...item, purchaseUnit: "Kg", conversionFactor: 1000 };
          }
          if (!item.purchaseUnit && (item.unit === "ml" || item.unit === "mililiter")) {
            return { ...item, purchaseUnit: "Liter", conversionFactor: 1000 };
          }
          return item;
        });
      }
      return DEFAULT_INITIAL_INGREDIENTS;
    } catch {
      return DEFAULT_INITIAL_INGREDIENTS;
    }
  });

  const normalizeRecipeList = (list: any[]): Recipe[] => {
    if (!Array.isArray(list)) return [];
    return list.map((r) => {
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
  };

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem("app_recipes_cache");
      return saved ? normalizeRecipeList(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem("app_products_cache");
      return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
    } catch {
      return DEFAULT_PRODUCTS;
    }
  });
  const [batchPreparations, setBatchPreparations] = useState<BatchPreparation[]>(() => {
    try {
      const saved = localStorage.getItem("app_batch_preparations_cache");
      return saved ? JSON.parse(saved) : DEFAULT_BATCH_PREPARATIONS;
    } catch {
      return DEFAULT_BATCH_PREPARATIONS;
    }
  });
  const [promotions, setPromotions] = useState<Promotion[]>(() => {
    try {
      const saved = localStorage.getItem("coffee_promotions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [salesTransactions, setSalesTransactions] = useState<
    SalesTransaction[]
  >([]);
  const [salesImportLogs, setSalesImportLogs] = useState<SalesImportLog[]>([]);
  const [dailySalesRecaps, setDailySalesRecaps] = useState<DailySalesRecap[]>(() => {
    try {
      const saved = localStorage.getItem("app_daily_sales_recaps");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shifts, setShifts] = useState<ShiftSession[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [dailyAttendances, setDailyAttendances] = useState<DailyAttendance[]>([]);
  const [dailyChecklists, setDailyChecklists] = useState<DailyChecklist[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<EmployeeShift[]>([]);
  const [kpiRecords, setKpiRecords] = useState<KPIRecord[]>([]);
  const [kpiTasks, setKpiTasks] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("kpi_tasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [kpiBonusRules, setKpiBonusRules] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("kpi_bonus_rules");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "rule-1", minScore: 90, maxScore: 100, bonusAmount: 400000, isActive: true },
      { id: "rule-2", minScore: 80, maxScore: 89, bonusAmount: 250000, isActive: true },
      { id: "rule-3", minScore: 70, maxScore: 79, bonusAmount: 100000, isActive: true },
      { id: "rule-4", minScore: 0, maxScore: 69, bonusAmount: 0, isActive: true },
    ];
  });

  // Fase 1-4 state
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() => {
    try {
      const cached = localStorage.getItem("app_expense_categories_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_EXPENSE_CATEGORIES;
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliation[]>([]);
  const [bankStatementLines, setBankStatementLines] = useState<BankStatementLine[]>([]);
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>([]);
  const [stockOpnameItems, setStockOpnameItems] = useState<StockOpnameItem[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([]);

  // Generic dispatch for new modules
  const dispatch = (action: any) => {
    hasLocalChanges.current = true;
    switch (action.type) {
      case "ADD_EXPENSE_CATEGORY":
        setExpenseCategories((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_EXPENSE_CATEGORY":
        setExpenseCategories((prev) => prev.map((c) => c.id === action.payload.id ? action.payload : c));
        break;
      case "DELETE_EXPENSE_CATEGORY": {
        const toDelete = expenseCategories.find((c) => c.id === action.payload);
        if (toDelete) {
          const childIds = expenseCategories.filter((c) => c.parentId === toDelete.id).map((c) => c.id);
          setExpenseCategories((prev) => prev.filter((c) => c.id !== action.payload && !childIds.includes(c.id)));
        }
        break;
      }
      case "ADD_PAYROLL_RECORD":
        setPayrollRecords((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_PAYROLL_RECORD":
        setPayrollRecords((prev) => prev.map((p) => p.id === action.payload.id ? action.payload : p));
        break;
      case "DELETE_PAYROLL_RECORD":
        setPayrollRecords((prev) => prev.filter((p) => p.id !== action.payload));
        break;
      case "BULK_ADD_PAYROLL_RECORDS":
        setPayrollRecords((prev) => [...prev, ...action.payload]);
        break;
      case "ADD_BUDGET":
        setBudgets((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_BUDGET":
        setBudgets((prev) => prev.map((b) => b.id === action.payload.id ? action.payload : b));
        break;
      case "DELETE_BUDGET":
        setBudgets((prev) => prev.filter((b) => b.id !== action.payload));
        break;
      case "ADD_BANK_RECONCILIATION":
        setBankReconciliations((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_BANK_RECONCILIATION":
        setBankReconciliations((prev) => prev.map((r) => r.id === action.payload.id ? action.payload : r));
        break;
      case "ADD_BANK_STATEMENT_LINE":
        setBankStatementLines((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_BANK_STATEMENT_LINE":
        setBankStatementLines((prev) => prev.map((l) => l.id === action.payload.id ? action.payload : l));
        break;
      case "BULK_ADD_BANK_STATEMENT_LINES":
        setBankStatementLines((prev) => [...prev, ...action.payload]);
        break;
      case "SET_BANK_RECONCILIATIONS":
        setBankReconciliations(action.payload);
        break;
      case "SET_BANK_STATEMENT_LINES":
        setBankStatementLines(action.payload);
        break;
      case "ADD_STOCK_OPNAME":
        setStockOpnames((prev) => {
          const exists = prev.some((o) => o.id === action.payload.id);
          if (exists) {
            return prev.map((o) => (o.id === action.payload.id ? action.payload : o));
          }
          return [...prev, action.payload];
        });
        break;
      case "UPDATE_STOCK_OPNAME":
        setStockOpnames((prev) => prev.map((o) => (o.id === action.payload.id ? action.payload : o)));
        break;
      case "DELETE_STOCK_OPNAME":
        setStockOpnames((prev) => prev.filter((o) => o.id !== action.payload));
        setStockOpnameItems((prev) => prev.filter((i) => i.opnameId !== action.payload));
        break;
      case "ADD_STOCK_OPNAME_ITEM":
        setStockOpnameItems((prev) => {
          const exists = prev.some((i) => i.id === action.payload.id || (i.opnameId === action.payload.opnameId && i.ingredientId === action.payload.ingredientId));
          if (exists) {
            return prev.map((i) => (i.id === action.payload.id || (i.opnameId === action.payload.opnameId && i.ingredientId === action.payload.ingredientId) ? action.payload : i));
          }
          return [...prev, action.payload];
        });
        break;
      case "UPDATE_STOCK_OPNAME_ITEM":
        setStockOpnameItems((prev) => prev.map((i) => (i.id === action.payload.id ? action.payload : i)));
        break;
      case "BULK_ADD_STOCK_OPNAME_ITEMS":
        setStockOpnameItems((prev) => {
          const incomingIds = new Set(action.payload.map((i: any) => i.id));
          const incomingPairs = new Set(action.payload.map((i: any) => `${i.opnameId}_${i.ingredientId}`));
          const filtered = prev.filter((i) => !incomingIds.has(i.id) && !incomingPairs.has(`${i.opnameId}_${i.ingredientId}`));
          return [...filtered, ...action.payload];
        });
        break;
      case "ADD_CLOSED_PERIOD":
      case "CLOSE_PERIOD":
        setClosedPeriods((prev) => [
          ...prev.filter((p) => p.period !== action.payload.period),
          {
            id: action.payload.id || "cp_" + Date.now(),
            period: action.payload.period,
            closedAt: action.payload.closedAt || new Date().toISOString(),
            closedBy: action.payload.user || action.payload.closedBy || "Manager",
            notes: action.payload.notes || "",
          },
        ]);
        break;
      case "REMOVE_CLOSED_PERIOD":
      case "REOPEN_PERIOD":
        setClosedPeriods((prev) => prev.filter((p) => p.period !== (action.payload?.period || action.payload)));
        break;
      case "SET_STOCK_OPNAMES":
        setStockOpnames(action.payload);
        break;
      case "SET_STOCK_OPNAME_ITEMS":
        setStockOpnameItems(action.payload);
        break;
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [wasForceLoggedOut, setWasForceLoggedOut] = useState<boolean>(false);

  const hasLocalChanges = useRef(false);
  const isSyncingRef = useRef(false);
  const isApplyingServerUpdate = useRef(false);
  const deviceRef = useRef<DetectedDeviceInfo>({} as DetectedDeviceInfo);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize auth
  useEffect(() => {
    async function loadAuth() {
      try {
        const deviceInfo = await detectDeviceAsync();
        deviceRef.current = deviceInfo;

        let savedUser = await get("node_current_user");
        if (!savedUser) {
          const lsUser = localStorage.getItem("node_current_user");
          if (lsUser) {
            savedUser = JSON.parse(lsUser);
            await set("node_current_user", savedUser).catch(() => {});
          }
        }
        setCurrentUser(savedUser || null);
      } catch (err) {
        console.error("Failed to load auth state", err);
      } finally {
        setIsAuthLoaded(true);
      }
    }
    loadAuth();
  }, []);

  // Save auth
  useEffect(() => {
    if (isAuthLoaded) {
      if (currentUser) {
        set("node_current_user", currentUser).catch(console.error);
        localStorage.setItem("node_current_user", JSON.stringify(currentUser));
      } else {
        del("node_current_user").catch(console.error);
        localStorage.removeItem("node_current_user");
      }
    }
  }, [currentUser, isAuthLoaded]);

  // Sync Logic & Version tracking for Railway Network Egress Optimization
  const serverVersionRef = useRef<number | null>(null);

  const fetchFromServer = async (isManual = false) => {
    // Hemat kuota data & biaya Railway: jangan sync di background jika tab sedang diminimize/tidak aktif
    if (typeof document !== "undefined" && document.hidden && !isManual) return;
    if (isSyncingRef.current && !isManual) return;
    if (hasLocalChanges.current && !isManual) return;

    try {
      if (isManual) setIsSyncing(true);
      const url = isManual || !serverVersionRef.current
        ? "/api/sync"
        : `/api/sync?v=${serverVersionRef.current}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();

        // Jika server melaporkan data tidak berubah sejak sync terakhir, selesai seketika (35 byte)!
        if (data.notModified) {
          setLastSyncTime(new Date());
          return;
        }

        if (data.v) {
          serverVersionRef.current = data.v;
        }

        isApplyingServerUpdate.current = true;

        if (Array.isArray(data.cash_accounts))
          setCashAccounts(data.cash_accounts);
        if (Array.isArray(data.cash_transactions))
          setCashTransactions(data.cash_transactions);
        if (data.settings) {
          const s = data.settings;
          const parseArr = (v: any) => {
            if (Array.isArray(v)) return v;
            if (typeof v === "string") {
              try {
                const p = JSON.parse(v);
                if (Array.isArray(p)) return p;
              } catch {}
            }
            return [];
          };
          const parseObj = (v: any) => {
            if (v && typeof v === "object" && !Array.isArray(v)) return v;
            if (typeof v === "string") {
              try {
                const p = JSON.parse(v);
                if (p && typeof p === "object") return p;
              } catch {}
            }
            return {};
          };
          const newSettings: Settings = {
            ...s,
            monthlyRevenueTarget: Number(s.monthlyRevenueTarget !== undefined ? s.monthlyRevenueTarget : 150000000),
            targetBonusAmount: Number(s.targetBonusAmount !== undefined ? s.targetBonusAmount : 0),
            divisionKpiBonusTarget: parseObj(s.divisionKpiBonusTarget),
            scheduleApprovals: parseObj(s.scheduleApprovals),
            leaderBarTasks: parseArr(s.leaderBarTasks),
            leaderKitchenTasks: parseArr(s.leaderKitchenTasks),
            leaderBakerTasks: parseArr(s.leaderBakerTasks),
            managerTasks: parseArr(s.managerTasks),
            leaderJobdeskAllowanceRules: parseArr(s.leaderJobdeskAllowanceRules).length > 0
              ? parseArr(s.leaderJobdeskAllowanceRules)
              : (settings?.leaderJobdeskAllowanceRules && settings.leaderJobdeskAllowanceRules.length > 0
                  ? settings.leaderJobdeskAllowanceRules
                  : DEFAULT_LEADER_ALLOWANCE_RULES),
            shiftDefinitions: parseArr(s.shiftDefinitions).length > 0
              ? parseArr(s.shiftDefinitions)
              : (settings?.shiftDefinitions && settings.shiftDefinitions.length > 0
                  ? settings.shiftDefinitions
                  : DEFAULT_SHIFT_DEFINITIONS),
            enableStoreSalesBonus: s.enableStoreSalesBonus !== false,
            enableLeaderAllowanceBonus: s.enableLeaderAllowanceBonus !== false,
            enableKpiScoreBonus: Boolean(s.enableKpiScoreBonus),
          };
          setSettings(newSettings);
          try {
            localStorage.setItem("app_settings_cache", JSON.stringify(newSettings));
          } catch {}
        }
        if (Array.isArray(data.users) && data.users.length > 0)
          setUsers(data.users);
        if (Array.isArray(data.device_sessions))
          setSessions(data.device_sessions);
        if (Array.isArray(data.ingredients) && data.ingredients.length > 0)
          setIngredients(data.ingredients);
        if (Array.isArray(data.recipes))
          setRecipes(normalizeRecipeList(data.recipes));
        if (Array.isArray(data.stock_movements))
          setStockMovements(data.stock_movements);
        if (Array.isArray(data.sales_transactions))
          setSalesTransactions(data.sales_transactions);
        if (Array.isArray(data.sales_import_logs))
          setSalesImportLogs(data.sales_import_logs);

        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);
        if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
        if (Array.isArray(data.purchase_orders))
          setPurchaseOrders(data.purchase_orders);
        if (Array.isArray(data.shifts)) setShifts(data.shifts);
        if (Array.isArray(data.employees)) setEmployees(data.employees);
        if (Array.isArray(data.contracts)) setContracts(data.contracts);
        if (Array.isArray(data.attendances)) setAttendances(data.attendances);
        if (Array.isArray(data.dailyAttendances)) setDailyAttendances(data.dailyAttendances);
        if (Array.isArray(data.dailyChecklists)) {
          setDailyChecklists(data.dailyChecklists.map((c: any) => ({
            ...c,
            leaderTasks: typeof c.leaderTasks === 'string' ? (() => { try { return JSON.parse(c.leaderTasks); } catch { return []; } })() : (Array.isArray(c.leaderTasks) ? c.leaderTasks : [])
          })));
        }
        if (Array.isArray(data.employeeShifts)) setEmployeeShifts(data.employeeShifts);
        if (Array.isArray(data.kpiRecords)) setKpiRecords(data.kpiRecords);
        // Fase 1-4
        if (Array.isArray(data.expense_categories) && data.expense_categories.length > 0) {
          setExpenseCategories(data.expense_categories);
          try {
            localStorage.setItem("app_expense_categories_cache", JSON.stringify(data.expense_categories));
          } catch {}
        }
        if (Array.isArray(data.budgets)) setBudgets(data.budgets);
        if (Array.isArray(data.bank_reconciliations)) setBankReconciliations(data.bank_reconciliations);
        if (Array.isArray(data.bank_statement_lines)) setBankStatementLines(data.bank_statement_lines);
        if (Array.isArray(data.stock_opnames)) setStockOpnames(data.stock_opnames);
        if (Array.isArray(data.stock_opname_items)) setStockOpnameItems(data.stock_opname_items);
        if (Array.isArray(data.payroll_records)) setPayrollRecords(data.payroll_records);
        if (Array.isArray(data.promotions)) {
          setPromotions(data.promotions);
          try {
            localStorage.setItem("coffee_promotions", JSON.stringify(data.promotions));
          } catch {}
        }
        if (Array.isArray(data.closed_periods)) setClosedPeriods(data.closed_periods);
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        if (Array.isArray(data.batch_preparations) && data.batch_preparations.length > 0) {
          setBatchPreparations(data.batch_preparations);
        }

        setLastSyncTime(new Date());
        hasLocalChanges.current = false;

        setTimeout(() => {
          isApplyingServerUpdate.current = false;
        }, 150);
      }
    } catch (err) {
      console.warn("Failed to fetch from server:", err);
      setUsers((prev) =>
        prev.length === 0
          ? [
              {
                id: "admin-1",
                username: "admin",
                pin: "123456",
                name: "Super Admin (Offline)",
                role: "SUPER_ADMIN",
              },
              {
                id: "pos-terminal-1",
                username: "kasir",
                pin: "123456",
                name: "Terminal Kasir POS",
                role: "KASIR",
              },
            ]
          : prev,
      );
      isApplyingServerUpdate.current = false;
    } finally {
      setIsLoaded(true);
      if (isManual) setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchFromServer(false);
    
    // Polling cerdas: 25 detik sekali dan hanya jalan jika tab sedang aktif di layar
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchFromServer(false);
      }
    }, 25000);

    const handleFocus = () => fetchFromServer(false);
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchFromServer(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ─── Idle Session Timeout ──────────────────────────────────────────────────
  // Role operasional (KASIR, LEADER, FINANCE) akan otomatis logout setelah
  // 30 menit tidak ada aktivitas. SUPER_ADMIN & MANAGER dikecualikan.
  const IDLE_TIMEOUT_ROLES = ["KASIR", "LEADER", "FINANCE"];
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

  useEffect(() => {
    if (!currentUser || !IDLE_TIMEOUT_ROLES.includes(currentUser.role)) {
      // Clear timer jika role tidak perlu timeout
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      return;
    }

    const resetActivity = () => { lastActivityRef.current = Date.now(); };

    // Dengarkan semua event aktivitas user
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));

    // Cek setiap 60 detik apakah sudah idle
    idleTimerRef.current = setInterval(() => {
      const idleDuration = Date.now() - lastActivityRef.current;
      if (idleDuration >= IDLE_TIMEOUT_MS) {
        // Auto logout
        const curSessionId = deviceRef.current?.sessionId;
        if (curSessionId) {
          fetch("/api/sessions/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: curSessionId }),
          }).catch(() => {});
        }
        setCurrentUser(null);
        localStorage.removeItem("node_current_user");
        del("node_current_user").catch(() => {});
        localStorage.removeItem("node_session_id");
        del("node_session_id").catch(() => {});
        setWasForceLoggedOut(true); // Gunakan flag yg sama agar UI tampil info
      }
    }, 60_000); // cek tiap 1 menit

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [currentUser?.id, currentUser?.role]);

  const sendHeartbeat = async (user = currentUser) => {
    if (!user) return;
    try {
      const info = deviceRef.current;
      const res = await fetch("/api/sessions/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: info.sessionId,
          userId: user.id,
          username: user.username,
          userName: user.name,
          deviceName: info.deviceName,
          browser: info.browser,
          os: info.os,
          deviceType: info.deviceType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.revoked) {
          setCurrentUser(null);
          localStorage.removeItem("node_current_user");
          del("node_current_user").catch(() => {});
          localStorage.removeItem("node_session_id");
          del("node_session_id").catch(() => {});
          detectDeviceAsync().then((info) => {
            deviceRef.current = info;
            setWasForceLoggedOut(true);
          });
        }
      }
    } catch (err) {}
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          const currentId = deviceRef.current.sessionId;
          setSessions(
            data.sessions.map((s: any) => ({
              ...s,
              isCurrent: s.id === currentId,
            })),
          );
        }
      }
    } catch (err) {}
  };

  const revokeSession = async (sessionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (sessionId === deviceRef.current.sessionId) {
          setCurrentUser(null);
          localStorage.removeItem("node_current_user");
        }
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const revokeOtherSessions = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/sessions/revoke-others", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSessionId: deviceRef.current.sessionId,
          userId: currentUser?.id,
        }),
      });
      if (res.ok) {
        await fetchSessions();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    if (currentUser) {
      sendHeartbeat(currentUser);
      fetchSessions();
      // Heartbeat sesi setiap 30 detik (hanya saat tab aktif)
      const sessionInterval = setInterval(() => {
        if (typeof document !== "undefined" && !document.hidden) {
          sendHeartbeat(currentUser);
          fetchSessions();
        }
      }, 30000);
      return () => clearInterval(sessionInterval);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isLoaded || isApplyingServerUpdate.current || !hasLocalChanges.current || currentUser?.role === "OWNER")
      return;
    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        isSyncingRef.current = true;
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("node_session_id")}`,
          },
          body: JSON.stringify({
            cash_accounts: cashAccounts,
            cash_transactions: cashTransactions,
            settings: settings,
            users: users,
            device_sessions: sessions,
            ingredients: ingredients,
            recipes: recipes,
            stock_movements: stockMovements,
            sales_transactions: salesTransactions,
            sales_import_logs: salesImportLogs,
            audit_logs: auditLogs,
            suppliers,
            purchase_orders: purchaseOrders,
            shifts,
            employees,
            contracts,
            attendances,
            dailyAttendances,
        dailyChecklists,
            employeeShifts,
            kpiRecords,
            // Fase 1-4
            expense_categories: expenseCategories,
            budgets,
            bank_reconciliations: bankReconciliations,
            bank_statement_lines: bankStatementLines,
            stock_opnames: stockOpnames,
            stock_opname_items: stockOpnameItems,
            payroll_records: payrollRecords,
            closed_periods: closedPeriods,
            products,
            batch_preparations: batchPreparations,
            promotions,
          }),
        });
        if (res.ok) {
          hasLocalChanges.current = false;
          setLastSyncTime(new Date());
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Sync API failed:", errData);
          alert("Gagal sinkronisasi data ke server: " + (errData.error || "Unknown error"));
        }
      } catch (err) {
        console.error("Error saving data:", err);
      } finally {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    cashAccounts,
    cashTransactions,
    settings,
    users,
    sessions,
    ingredients,
    recipes,
    products,
    batchPreparations,
    stockMovements,
    salesTransactions,
    salesImportLogs,
    auditLogs,
    suppliers,
    purchaseOrders,
    shifts,
    employees,
    contracts,
    attendances,
    dailyAttendances,
    dailyChecklists,
    employeeShifts,
    kpiRecords,
    expenseCategories,
    budgets,
    bankReconciliations,
    bankStatementLines,
    stockOpnames,
    stockOpnameItems,
    payrollRecords,
    closedPeriods,
    promotions,
  ]);

  const markChanged = () => {
    if (!isApplyingServerUpdate.current && currentUser?.role !== "OWNER") {
      hasLocalChanges.current = true;
    }
  };

  const updateSettings = (newSettings: Settings) => {
    if (currentUser?.role === "OWNER") {
      alert("Akun Owner berstatus Read-Only (Pengawasan). Anda tidak diizinkan mengubah konfigurasi toko.");
      return;
    }
    setSettings(newSettings);
    try {
      localStorage.setItem("app_settings_cache", JSON.stringify(newSettings));
    } catch {}
    markChanged();

    // Kirim sinkronisasi langsung ke server agar tidak ter-rollback oleh background polling
    const token = localStorage.getItem("node_session_id");
    if (token) {
      fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: newSettings,
        }),
      }).then((res) => {
        if (res.ok) {
          hasLocalChanges.current = false;
        }
      }).catch((err) => console.warn("Direct settings sync failed:", err));
    }
  };

  const login = async (username: string, pin: string) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });
      if (!res.ok) {
        return false;
      }
      const data = await res.json();
      setCurrentUser(data.user);
      localStorage.setItem("node_current_user", JSON.stringify(data.user));
      localStorage.setItem("node_session_id", data.token);
      localStorage.setItem("node_session_id", data.token);
      fetchFromServer(true);
      sendHeartbeat(data.user);
      return true;
    } catch (e) {
      console.error("Login failed", e);
      return false;
    }
  };

  const logout = () => {
    const curSessionId = deviceRef.current?.sessionId;
    if (curSessionId) {
      fetch("/api/sessions/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: curSessionId }),
      }).catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem("node_current_user");
    del("node_current_user").catch(() => {});
    localStorage.removeItem("node_session_id");
    del("node_session_id").catch(() => {});
    detectDeviceAsync().then((info) => {
      deviceRef.current = info;
    });
  };

  const dismissForceLogoutAlert = () => setWasForceLoggedOut(false);
  const syncData = async () => await fetchFromServer(true);

  // ─── Audit Log Helper ─────────────────────────────────────────────────────
  const writeAuditLog = (
    action: "CREATE" | "UPDATE" | "DELETE",
    tableName: string,
    recordId: string,
  ) => {
    const log: AuditLog = {
      id: generateId(),
      userId: currentUser?.id || "system",
      action,
      tableName,
      recordId,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  
  const handleSetDailyChecklists = (c: DailyChecklist[]) => {
    setDailyChecklists(c);
    markChanged();
  };
  const handleSetEmployeeShifts = (shifts: EmployeeShift[]) => {
    setEmployeeShifts(shifts);
    markChanged();
  };
  const handleSetDailyAttendances = (a: DailyAttendance[]) => {
    setDailyAttendances(a);
    markChanged();
  };

  const addUser = (user: Omit<User, "id">) => {
    const id = generateId();
    setUsers((prev) => [...prev, { ...user, id }]);
    writeAuditLog("CREATE", "users", id);
    markChanged();
  };

  // ─── HR ACTIONS ─────────────────────────────────────────────────────────
  const addEmployee = (emp: Omit<Employee, "id" | "createdAt">) => {
    const id = generateId();
    setEmployees((prev) => [
      ...prev,
      { ...emp, id, createdAt: new Date().toISOString() },
    ]);
    writeAuditLog("CREATE", "employees", id);
    markChanged();
    return id;
  };

  const updateEmployee = (emp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));

    // Sinkronisasi otomatis ke akun pengguna (users)
    setUsers((prev) =>
      prev.map((u) => {
        const isMatched =
          (u.employeeId && u.employeeId === emp.id) ||
          u.username.toLowerCase() === emp.username.toLowerCase();

        if (!isMatched) return u;

        let role: Role = u.role;
        const posUpper = (emp.position || "").toUpperCase();
        const deptUpper = (emp.department || "").toUpperCase();

        if (posUpper.includes("MANAGER") || posUpper.includes("MANAJER")) {
          role = "MANAGER";
        } else if (posUpper.includes("FINANCE") || posUpper.includes("KEUANGAN") || posUpper.includes("AKUNTAN") || deptUpper.includes("FINANCE") || deptUpper.includes("KEUANGAN")) {
          role = "FINANCE";
        } else if (posUpper.includes("LEADER")) {
          role = "LEADER";
        } else if (posUpper.includes("KASIR")) {
          role = "KASIR";
        } else if (deptUpper.includes("BAR") || posUpper.includes("BAR")) {
          role = "BAR";
        } else if (
          deptUpper.includes("KITCHEN") ||
          deptUpper.includes("DAPUR") ||
          posUpper.includes("KITCHEN")
        ) {
          role = "KITCHEN";
        } else if (deptUpper.includes("BAKER") || posUpper.includes("BAKER")) {
          role = "BAKER";
        }

        return {
          ...u,
          username: emp.username.toLowerCase().trim(),
          name: emp.name.trim(),
          role,
          department: role === "LEADER" ? (emp.department as any) : (u.department || null),
          employeeId: emp.id,
        };
      })
    );

    writeAuditLog("UPDATE", "employees", emp.id);
    markChanged();
  };

  const deleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setUsers((prev) =>
      prev.map((u) => (u.employeeId === id ? { ...u, employeeId: null } : u))
    );
    setContracts((prev) => prev.filter((c) => c.employeeId !== id));
    setEmployeeShifts((prev) => prev.filter((s) => s.employeeId !== id));
    writeAuditLog("DELETE", "employees", id);
    markChanged();
  };

  const addContract = (contract: Omit<EmployeeContract, "id">) => {
    const id = generateId();
    setContracts((prev) => [...prev, { ...contract, id }]);
    writeAuditLog("CREATE", "contracts", id);
    markChanged();
  };

  const updateContract = (contract: EmployeeContract) => {
    setContracts((prev) =>
      prev.map((c) => (c.id === contract.id ? contract : c)),
    );
    writeAuditLog("UPDATE", "contracts", contract.id);
    markChanged();
  };

  const deleteContract = (id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
    writeAuditLog("DELETE", "contracts", id);
    markChanged();
  };

  const addAttendance = (
    att: Omit<AttendanceRecord, "id" | "createdAt" | "createdBy">,
  ) => {
    const id = generateId();
    setAttendances((prev) => [
      ...prev,
      {
        ...att,
        id,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || "system",
      },
    ]);
    writeAuditLog("CREATE", "attendances", id);
    markChanged();
  };

  const updateAttendance = (att: AttendanceRecord) => {
    setAttendances((prev) => prev.map((a) => (a.id === att.id ? att : a)));
    writeAuditLog("UPDATE", "attendances", att.id);
    markChanged();
  };

  const addDailyAttendance = (att: Omit<DailyAttendance, "id">) => {
    setDailyAttendances((prev) => {
      const existing = prev.find(
        (a) => a.employeeId === att.employeeId && a.date === att.date
      );
      if (existing) {
        const updated = prev.map((a) =>
          a.id === existing.id
            ? {
                ...existing,
                ...att,
                approvalStatus: att.approvalStatus || existing.approvalStatus || "PENDING",
              }
            : a
        );
        writeAuditLog("UPDATE", "daily_attendances", existing.id);
        markChanged();
        return updated;
      }
      const id = generateId();
      const newAtt: DailyAttendance = {
        approvalStatus: "PENDING",
        ...att,
        id,
      };
      writeAuditLog("CREATE", "daily_attendances", id);
      markChanged();
      return [...prev, newAtt];
    });
  };

  const updateDailyAttendance = (att: DailyAttendance) => {
    setDailyAttendances((prev) => prev.map((a) => (a.id === att.id ? att : a)));
    writeAuditLog("UPDATE", "daily_attendances", att.id);
    markChanged();
  };

  const addKPI = (kpi: Omit<KPIRecord, "id" | "createdAt" | "evaluatedBy">) => {
    const id = generateId();
    setKpiRecords((prev) => [
      ...prev,
      {
        ...kpi,
        id,
        createdAt: new Date().toISOString(),
        evaluatedBy: currentUser?.id || "system",
      },
    ]);
    writeAuditLog("CREATE", "kpi_records", id);
    markChanged();
  };

  const updateKPI = (kpi: KPIRecord) => {
    setKpiRecords((prev) => prev.map((k) => (k.id === kpi.id ? kpi : k)));
    writeAuditLog("UPDATE", "kpi_records", kpi.id);
    markChanged();
  };

  const updateKpiTask = (id: string, task: any) => {
    setKpiTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const updated = idx >= 0 
        ? prev.map((t, i) => i === idx ? { ...task, id } : t)
        : [...prev, { ...task, id }];
      try { localStorage.setItem("kpi_tasks", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged();
  };

  const deleteKpiTask = (id: string) => {
    setKpiTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      try { localStorage.setItem("kpi_tasks", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged();
  };

  const updateKpiBonusRule = (id: string, rule: any) => {
    setKpiBonusRules((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const updated = idx >= 0 
        ? prev.map((r, i) => i === idx ? { ...rule, id } : r)
        : [...prev, { ...rule, id }];
      try { localStorage.setItem("kpi_bonus_rules", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged();
  };

  const deleteKpiBonusRule = (id: string) => {
    setKpiBonusRules((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try { localStorage.setItem("kpi_bonus_rules", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged();
  };

  const updateUser = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    );

    // Sinkronisasi otomatis ke data karyawan (employees)
    setEmployees((prev) =>
      prev.map((emp) => {
        const isMatched =
          (updatedUser.employeeId && emp.id === updatedUser.employeeId) ||
          emp.username.toLowerCase() === updatedUser.username.toLowerCase();

        if (!isMatched) return emp;

        let pos = emp.position;
        let dept = emp.department;

        if (updatedUser.role === "KASIR") {
          pos = "Kasir";
        } else if (updatedUser.role === "MANAGER") {
          pos = "Manager";
        } else if (updatedUser.role === "FINANCE") {
          pos = "Finance";
          if (!dept || dept === "BAR") dept = "FINANCE";
        } else if (updatedUser.role === "LEADER") {
          pos = "Leader";
          if (updatedUser.department) dept = updatedUser.department;
        } else if (updatedUser.role === "BAR") {
          pos = "Karyawan";
          dept = "BAR";
        } else if (updatedUser.role === "KITCHEN") {
          pos = "Karyawan";
          dept = "KITCHEN";
        } else if (updatedUser.role === "BAKER") {
          pos = "Karyawan";
          dept = "BAKER";
        }

        return {
          ...emp,
          username: updatedUser.username.toLowerCase().trim(),
          name: updatedUser.name.trim(),
          position: pos,
          department: dept,
        };
      })
    );

    writeAuditLog("UPDATE", "users", updatedUser.id);
    markChanged();
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setSessions((prev) => prev.filter((s) => s.userId !== id));
    writeAuditLog("DELETE", "users", id);
    markChanged();
  };

  const addCashAccount = (acc: Omit<CashAccount, "id">) => {
    const id = generateId();
    setCashAccounts((prev) => [...prev, { ...acc, id }]);
    writeAuditLog("CREATE", "cash_accounts", id);
    markChanged();
  };

  const updateCashAccount = (acc: CashAccount) => {
    setCashAccounts((prev) => prev.map((a) => (a.id === acc.id ? acc : a)));
    writeAuditLog("UPDATE", "cash_accounts", acc.id);
    markChanged();
  };

  const deleteCashAccount = (id: string) => {
    setCashAccounts((prev) => prev.filter((a) => a.id !== id));
    writeAuditLog("DELETE", "cash_accounts", id);
    markChanged();
  };

  const addCashTransaction = (trx: Omit<CashTransaction, "id">) => {
    const id = generateId();
    setCashTransactions((prev) => [...prev, { ...trx, id }]);
    writeAuditLog("CREATE", "cash_transactions", id);
    markChanged();
  };

  const updateCashTransaction = (trx: CashTransaction) => {
    setCashTransactions((prev) =>
      prev.map((t) => (t.id === trx.id ? trx : t)),
    );
    writeAuditLog("UPDATE", "cash_transactions", trx.id);
    markChanged();
  };

  const deleteCashTransaction = (id: string) => {
    setCashTransactions((prev) => prev.filter((t) => t.id !== id));
    writeAuditLog("DELETE", "cash_transactions", id);
    markChanged();
  };

  const addIngredient = (ing: Omit<Ingredient, "id">) => {
    const id = generateId();
    setIngredients((prev) => [...prev, { ...ing, id }]);
    writeAuditLog("CREATE", "ingredients", id);
    markChanged();
  };

  const updateIngredient = (ing: Ingredient) => {
    setIngredients((prev) => prev.map((i) => (i.id === ing.id ? ing : i)));
    writeAuditLog("UPDATE", "ingredients", ing.id);
    markChanged();
  };

  const deleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    writeAuditLog("DELETE", "ingredients", id);
    markChanged();
  };

  const addRecipe = (recipe: Omit<Recipe, "id">) => {
    const id = generateId();
    setRecipes((prev) => [...prev, { ...recipe, id }]);
    writeAuditLog("CREATE", "recipes", id);
    markChanged();
  };

  const updateRecipe = (recipe: Recipe) => {
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
    writeAuditLog("UPDATE", "recipes", recipe.id);
    markChanged();
  };

  const deleteRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    writeAuditLog("DELETE", "recipes", id);
    markChanged();
  };

  const addProduct = (prod: Omit<Product, "id" | "createdAt">): string => {
    const id = generateId();
    const newProduct: Product = {
      ...prod,
      id,
      createdAt: new Date().toISOString(),
    };
    setProducts((prev) => [...prev, newProduct]);
    writeAuditLog("CREATE", "products", id);
    markChanged();
    return id;
  };

  const updateProduct = (prod: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...prod, updatedAt: new Date().toISOString() } : p))
    );
    writeAuditLog("UPDATE", "products", prod.id);
    markChanged();
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    writeAuditLog("DELETE", "products", id);
    markChanged();
  };

  const addBatchPreparation = (bp: Omit<BatchPreparation, "id">): string => {
    const id = generateId();
    const newBp: BatchPreparation = { ...bp, id };
    setBatchPreparations((prev) => [...prev, newBp]);
    writeAuditLog("CREATE", "batch_preparations", id);
    markChanged();
    return id;
  };

  const updateBatchPreparation = (bp: BatchPreparation) => {
    setBatchPreparations((prev) => prev.map((b) => (b.id === bp.id ? bp : b)));
    writeAuditLog("UPDATE", "batch_preparations", bp.id);
    markChanged();
  };

  const deleteBatchPreparation = (id: string) => {
    setBatchPreparations((prev) => prev.filter((b) => b.id !== id));
    writeAuditLog("DELETE", "batch_preparations", id);
    markChanged();
  };

  const executeBatchCook = (
    batchPrepId: string,
    multiplier: number = 1,
    notes?: string
  ): { success: boolean; message: string } => {
    const bp = batchPreparations.find((b) => b.id === batchPrepId);
    if (!bp) {
      return { success: false, message: "Kondimen olahan tidak ditemukan." };
    }
    if (multiplier <= 0) {
      return { success: false, message: "Jumlah batch harus lebih dari 0." };
    }

    // 1. Cek kecukupan stok seluruh bahan mentah
    const missingIngredients: string[] = [];
    let totalCostSpent = 0;

    for (const ri of bp.ingredients) {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      const neededQty = ri.quantity * multiplier;
      if (!ing) {
        missingIngredients.push(`Bahan dengan ID ${ri.ingredientId} tidak ditemukan di inventori.`);
        continue;
      }
      if (ing.currentStock < neededQty) {
        missingIngredients.push(
          `${ing.name} (Kurang ${(neededQty - ing.currentStock).toFixed(1)} ${ing.unit}, butuh ${neededQty} ${ing.unit}, stok ${ing.currentStock} ${ing.unit})`
        );
      }
      totalCostSpent += neededQty * (ing.costPerUnit || 0);
    }

    if (missingIngredients.length > 0) {
      return {
        success: false,
        message: `Stok bahan mentah tidak mencukupi untuk memasak ${multiplier} batch:\n- ${missingIngredients.join("\n- ")}`,
      };
    }

    // 2. Data target kondimen
    let targetIng = ingredients.find((i) => i.id === bp.targetIngredientId);
    const yieldedQty = bp.yieldQuantity * multiplier;
    const batchUnitCost = yieldedQty > 0 ? Math.round(totalCostSpent / yieldedQty) : 0;
    const nowIso = new Date().toISOString();

    // 3. Potong stok bahan mentah (USAGE)
    bp.ingredients.forEach((ri) => {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      const neededQty = ri.quantity * multiplier;
      const ingCost = ing ? (ing.costPerUnit || 0) : 0;

      addStockMovement({
        ingredientId: ri.ingredientId,
        type: "USAGE",
        quantity: neededQty,
        unitCost: ingCost,
        totalCost: ingCost * neededQty,
        date: nowIso,
        note: `Bahan Olahan Batch: ${bp.name} (${multiplier}x batch)${notes ? ` - ${notes}` : ""}`,
        createdBy: currentUser?.name || "Kitchen / Bar Staff",
      });
    });

    // 4. Tambah stok hasil kondimen (IN) & update unit valuation HPP
    if (targetIng) {
      const existingValuation = targetIng.currentStock * (targetIng.costPerUnit || 0);
      const newTotalValuation = existingValuation + totalCostSpent;
      const newTotalQty = targetIng.currentStock + yieldedQty;
      const weightedAvgCost = newTotalQty > 0 ? Math.round(newTotalValuation / newTotalQty) : batchUnitCost;

      addStockMovement({
        ingredientId: targetIng.id,
        type: "IN",
        quantity: yieldedQty,
        unitCost: batchUnitCost,
        totalCost: totalCostSpent,
        date: nowIso,
        note: `Hasil Olahan Batch: ${bp.name} (${yieldedQty} ${bp.yieldUnit})${notes ? ` - ${notes}` : ""}`,
        createdBy: currentUser?.name || "Kitchen / Bar Staff",
      });

      // Update unit valuation di master
      setIngredients((prev) =>
        prev.map((i) => (i.id === targetIng!.id ? { ...i, costPerUnit: weightedAvgCost } : i))
      );
    } else {
      const newIngId = bp.targetIngredientId || generateId();
      const newIng: Ingredient = {
        id: newIngId,
        name: bp.targetIngredientName || bp.name,
        unit: bp.yieldUnit,
        currentStock: yieldedQty,
        minStock: Math.round(bp.yieldQuantity * 0.5),
        category: "Kondimen Olahan",
        costPerUnit: batchUnitCost,
      };
      setIngredients((prev) => [...prev, newIng]);
      writeAuditLog("CREATE", "ingredients", newIngId);

      addStockMovement({
        ingredientId: newIngId,
        type: "IN",
        quantity: yieldedQty,
        unitCost: batchUnitCost,
        totalCost: totalCostSpent,
        date: nowIso,
        note: `Hasil Olahan Batch: ${bp.name} (${yieldedQty} ${bp.yieldUnit})${notes ? ` - ${notes}` : ""}`,
        createdBy: currentUser?.name || "Kitchen / Bar Staff",
      });
    }

    // 5. Update lastPreparedDate di batch preparation
    setBatchPreparations((prev) =>
      prev.map((b) => (b.id === batchPrepId ? { ...b, lastPreparedDate: nowIso } : b))
    );

    writeAuditLog("CREATE", "batch_cook", batchPrepId);
    markChanged();

    return {
      success: true,
      message: `Sukses memasak ${multiplier} batch "${bp.name}". Menghasilkan +${yieldedQty} ${bp.yieldUnit} dengan HPP Rp ${batchUnitCost.toLocaleString("id-ID")}/${bp.yieldUnit}.`,
    };
  };

  const addSupplier = (supplier: Omit<Supplier, "id">) => {
    const id = generateId();
    setSuppliers((prev) => [...prev, { ...supplier, id }]);
    writeAuditLog("CREATE", "suppliers", id);
    markChanged();
  };

  const updateSupplier = (supplier: Supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? supplier : s)),
    );
    writeAuditLog("UPDATE", "suppliers", supplier.id);
    markChanged();
  };

  const deleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    writeAuditLog("DELETE", "suppliers", id);
    markChanged();
  };

  const addPurchaseOrder = (po: Omit<PurchaseOrder, "id">) => {
    const id = generateId();
    const newPO: PurchaseOrder = { ...po, id };
    setPurchaseOrders((prev) => [...prev, newPO]);
    writeAuditLog("CREATE", "purchase_orders", id);

    // Auto tambah stok jika deliveryStatus === "RECEIVED"
    if (newPO.deliveryStatus === "RECEIVED") {
      newPO.items.forEach((item) => {
        const mvId = generateId();
        setStockMovements((prev) => [
          ...prev,
          {
            id: mvId,
            ingredientId: item.productId,
            type: "IN",
            quantity: item.quantity,
            date: newPO.date || new Date().toISOString(),
            note: `PO Masuk Stok: ${newPO.poNumber}`,
            createdBy: currentUser?.name || "System",
          },
        ]);
        setIngredients((prev) =>
          prev.map((ing) => {
            if (ing.id === item.productId) {
              return {
                ...ing,
                currentStock: ing.currentStock + item.quantity,
                costPerUnit: item.unitPrice > 0 ? item.unitPrice : ing.costPerUnit,
              };
            }
            return ing;
          }),
        );
        writeAuditLog("CREATE", "stock_movements", mvId);
      });
    }

    // Auto potong kas jika status PAID dan ada cashAccountId
    if (newPO.status === "PAID" && newPO.cashAccountId && newPO.totalAmount > 0) {
      const cashTrxId = generateId();
      const bahanBakuCat = expenseCategories.find(
        (c) => c.type === "BAHAN_BAKU" || c.id === "cat-bahan-baku" || c.name.toLowerCase().includes("bahan")
      );
      setCashTransactions((prev) => [
        ...prev,
        {
          id: cashTrxId,
          accountId: newPO.cashAccountId!,
          date: newPO.date || new Date().toISOString(),
          type: "CASH_OUT",
          amount: newPO.totalAmount,
          category: bahanBakuCat?.name || "Pembelian Bahan",
          categoryId: bahanBakuCat?.id || "cat-bahan-baku",
          description: `Pembelian PO: ${newPO.poNumber} (${newPO.supplierName || "Supplier"})`,
          referenceId: newPO.id,
        },
      ]);
      writeAuditLog("CREATE", "cash_transactions", cashTrxId);
    }

    markChanged();
  };

  const addDirectMarketPurchase = (data: {
    marketName: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    cashAccountId?: string;
    notes?: string;
  }): PurchaseOrder => {
    const id = generateId();
    const poNumber = `MKT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowISO = new Date().toISOString();

    const newPO: PurchaseOrder = {
      id,
      poNumber,
      supplierId: "MARKET_DIRECT",
      supplierName: data.marketName || "Pasar Tradisional / Belanja Harian",
      purchaseType: "MARKET",
      cashAccountId: data.cashAccountId,
      notes: data.notes,
      date: nowISO,
      items: data.items,
      totalAmount: data.totalAmount,
      status: "PAID",
      amountPaid: data.totalAmount,
      paymentMethod: "CASH",
      deliveryStatus: "RECEIVED",
    };

    setPurchaseOrders((prev) => [...prev, newPO]);
    writeAuditLog("CREATE", "purchase_orders", id);

    // Auto tambahkan mutasi stok IN dan perbarui stok bahan
    data.items.forEach((item) => {
      const mvId = generateId();
      setStockMovements((prev) => [
        ...prev,
        {
          id: mvId,
          ingredientId: item.productId,
          type: "IN",
          quantity: item.quantity,
          date: nowISO,
          note: `Belanja Pasar: ${poNumber} (${data.marketName || "Eceran"})`,
          createdBy: currentUser?.name || "Kasir/Barista",
        },
      ]);

      setIngredients((prev) =>
        prev.map((ing) => {
          if (ing.id === item.productId) {
            return {
              ...ing,
              currentStock: ing.currentStock + item.quantity,
              costPerUnit: item.unitPrice > 0 ? item.unitPrice : ing.costPerUnit,
            };
          }
          return ing;
        }),
      );
      writeAuditLog("CREATE", "stock_movements", mvId);
    });

    // Auto catat kas keluar pada akun kas yang dipilih
    if (data.cashAccountId && data.totalAmount > 0) {
      const cashTrxId = generateId();
      const bahanBakuCat = expenseCategories.find(
        (c) => c.type === "BAHAN_BAKU" || c.id === "cat-bahan-baku" || c.name.toLowerCase().includes("bahan")
      );
      setCashTransactions((prev) => [
        ...prev,
        {
          id: cashTrxId,
          accountId: data.cashAccountId!,
          date: nowISO,
          type: "CASH_OUT",
          amount: data.totalAmount,
          category: bahanBakuCat?.name || "Pembelian Bahan",
          categoryId: bahanBakuCat?.id || "cat-bahan-baku",
          description: `Belanja Pasar (${data.marketName || "Eceran"}): ${data.items.length} item bahan [${poNumber}]`,
          referenceId: id,
        },
      ]);
      writeAuditLog("CREATE", "cash_transactions", cashTrxId);
    }

    markChanged();
    return newPO;
  };

  const updatePOStatus = (id: string, status: "PAID" | "UNPAID" | "PARTIAL") => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status } : po)),
    );
    writeAuditLog("UPDATE", "purchase_orders", id);
    markChanged();
  };

  const payPurchaseOrder = (
    id: string,
    amount: number,
    cashAccountId: string,
    notes?: string,
    date?: string,
  ) => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return;

    const newAmountPaid = (po.amountPaid || 0) + amount;
    const isPaid = newAmountPaid >= po.totalAmount;

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              amountPaid: newAmountPaid,
              status: isPaid ? "PAID" : "PARTIAL",
            }
          : p,
      ),
    );

    const bahanBakuCat = expenseCategories.find(
      (c) => c.type === "BAHAN_BAKU" || c.id === "cat-bahan-baku" || c.name.toLowerCase().includes("bahan")
    );

    // Create Cash Transaction for this payment
    addCashTransaction({
      accountId: cashAccountId,
      date: date || new Date().toISOString(),
      type: "CASH_OUT",
      amount: amount,
      category: bahanBakuCat?.name || "Pembelian Bahan",
      categoryId: bahanBakuCat?.id || "cat-bahan-baku",
      description: `Pelunasan Hutang PO ${po.poNumber} (${po.supplierName || "Supplier"})${notes ? ` - ${notes}` : ""}`,
      referenceId: po.id,
    });

    writeAuditLog("UPDATE", "purchase_orders", id);
    markChanged();
  };

  const markPOAsReceived = (id: string) => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return;

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deliveryStatus: "RECEIVED" } : p)),
    );
    writeAuditLog("UPDATE", "purchase_orders", id);

    // Auto add stock movements & update ingredient stock for each PO item
    po.items.forEach((item) => {
      const mvId = generateId();
      setStockMovements((prev) => [
        ...prev,
        {
          id: mvId,
          ingredientId: item.productId,
          type: "IN",
          quantity: item.quantity,
          date: new Date().toISOString(),
          note: `PO Diterima: ${po.poNumber}`,
          createdBy: currentUser?.name || "System",
        },
      ]);
      // Update ingredient stock directly
      setIngredients((prev) =>
        prev.map((ing) => {
          if (ing.id === item.productId) {
            return { ...ing, currentStock: ing.currentStock + item.quantity };
          }
          return ing;
        }),
      );
      writeAuditLog("CREATE", "stock_movements", mvId);
    });

    markChanged();
  };

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
    writeAuditLog("DELETE", "purchase_orders", id);
    markChanged();
  };

  const openShift = (shift: Omit<ShiftSession, "id">) => {
    const id = generateId();
    setShifts((prev) => [...prev, { ...shift, id }]);
    writeAuditLog("CREATE", "shifts", id);
    markChanged();
  };

  const closeShift = (
    id: string,
    actualEndingCash: number,
    expectedEndingCash: number,
  ) => {
    setShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === id) {
          return {
            ...shift,
            endTime: new Date().toISOString(),
            expectedEndingCash,
            actualEndingCash,
            difference: actualEndingCash - expectedEndingCash,
            status: "CLOSED",
          };
        }
        return shift;
      }),
    );
    writeAuditLog("UPDATE", "shifts", id);
    markChanged();
  };

  const addPromotion = (promo: Omit<Promotion, "id" | "createdAt">) => {
    const id = generateId();
    const newPromo: Promotion = {
      ...promo,
      id,
      createdAt: new Date().toISOString(),
    };
    setPromotions((prev) => {
      const updated = [...prev, newPromo];
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("CREATE", "promotions", id);
    markChanged();
  };

  const updatePromotion = (id: string, promoData: Partial<Promotion>) => {
    setPromotions((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...promoData } : p));
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("UPDATE", "promotions", id);
    markChanged();
  };

  const deletePromotion = (id: string) => {
    setPromotions((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("DELETE", "promotions", id);
    markChanged();
  };

  const togglePromotionStatus = (id: string) => {
    setPromotions((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p));
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("UPDATE", "promotions", id);
    markChanged();
  };

  const addStockMovement = (mov: Omit<StockMovement, "id">) => {
    setStockMovements((prev) => [...prev, { ...mov, id: generateId() }]);

    // Update current stock automatically based on movement type
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === mov.ingredientId) {
          let newStock = ing.currentStock;
          if (mov.type === "IN" || mov.type === "RETURN") {
            newStock += mov.quantity;
          } else if (mov.type === "OUT" || mov.type === "WASTE" || mov.type === "USAGE" as any) {
            newStock -= mov.quantity;
          } else if (mov.type === "ADJUSTMENT") {
            // For ADJUSTMENT, quantity is the target stock (physical stock)
            newStock = mov.quantity;
          }
          // Note: TRANSFER does not affect the global physical stock count, it's just movement tracking.
          return { ...ing, currentStock: Math.max(0, newStock) };
        }
        return ing;
      }),
    );
    markChanged();
  };

  const addSalesTransactions = (
    transactions: Omit<SalesTransaction, "id">[],
    fileName: string = "Import Penjualan Excel"
  ) => {
    const logId = generateId();
    const newTxs: SalesTransaction[] = transactions.map((t) => ({
      ...t,
      id: generateId(),
      importLogId: logId,
    }));

    const newLog: SalesImportLog = {
      id: logId,
      importDate: new Date().toISOString(),
      fileName: fileName,
      rowCount: newTxs.length,
      status: "SUCCESS",
      createdBy: currentUser?.name || "Finance",
    };

    setSalesTransactions((prev) => [...newTxs, ...prev]);
    setSalesImportLogs((prev) => [newLog, ...prev]);
    writeAuditLog("CREATE", "sales_transactions", logId);
    markChanged();
  };

  const addDailySalesRecap = (recap: Omit<DailySalesRecap, "id" | "createdAt">) => {
    const newId = generateId();
    const newRecord: DailySalesRecap = {
      ...recap,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setDailySalesRecaps((prev) => {
      const updated = [newRecord, ...prev];
      try {
        localStorage.setItem("app_daily_sales_recaps", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Otomatis catat ke Buku Kas agar sinkron ke Keuangan & Laba Rugi
    if (newRecord.cashAmount > 0) {
      const cashAcc = cashAccounts.find((a) => a.type === "CASH") || cashAccounts[0];
      if (cashAcc) {
        addCashTransaction({
          accountId: cashAcc.id,
          type: "CASH_IN",
          amount: newRecord.cashAmount,
          category: "cat-penjualan",
          description: `Omzet Penjualan Tunai (${newRecord.date})${newRecord.notes ? ` - ${newRecord.notes}` : ""}`,
          date: newRecord.date,
          referenceId: newId,
          createdBy: newRecord.recordedBy || currentUser?.name || "Finance",
        });
      }
    }
    const nonCashTotal = newRecord.qrisAmount + newRecord.edcAmount + newRecord.transferAmount;
    if (nonCashTotal > 0) {
      const bankAcc = cashAccounts.find((a) => a.type === "BANK") || cashAccounts[0];
      if (bankAcc) {
        const parts = [
          newRecord.qrisAmount > 0 ? `QRIS: ${newRecord.qrisAmount.toLocaleString("id-ID")}` : null,
          newRecord.edcAmount > 0 ? `EDC: ${newRecord.edcAmount.toLocaleString("id-ID")}` : null,
          newRecord.transferAmount > 0 ? `Transfer: ${newRecord.transferAmount.toLocaleString("id-ID")}` : null,
        ].filter(Boolean).join(", ");

        addCashTransaction({
          accountId: bankAcc.id,
          type: "CASH_IN",
          amount: nonCashTotal,
          category: "cat-penjualan",
          description: `Omzet Non-Tunai (${parts}) - ${newRecord.date}`,
          date: newRecord.date,
          referenceId: newId,
          createdBy: newRecord.recordedBy || currentUser?.name || "Finance",
        });
      }
    }
    writeAuditLog("CREATE", "daily_sales_recap", newId);
    markChanged();
  };

  const deleteDailySalesRecap = (id: string) => {
    setDailySalesRecaps((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem("app_daily_sales_recaps", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("DELETE", "daily_sales_recap", id);
    markChanged();
  };

  if (!isAuthLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        users,
        sessions,
        settings,
        cashAccounts,
        cashTransactions,
        ingredients,
        recipes,
        stockMovements,
        salesTransactions,
        dailySalesRecaps,
        addDailySalesRecap,
        deleteDailySalesRecap,
        salesImportLogs,
        auditLogs,
        suppliers,
        purchaseOrders,
        shifts,
        employees,
        contracts,
        attendances,
        dailyAttendances,
        setDailyAttendances: handleSetDailyAttendances,
        dailyChecklists,
        setDailyChecklists: handleSetDailyChecklists,
        employeeShifts,
        setEmployeeShifts: handleSetEmployeeShifts,
        kpiRecords,
        kpiTasks,
        kpiBonusRules,
        updateKpiTask,
        deleteKpiTask,
        updateKpiBonusRule,
        deleteKpiBonusRule,
        updateSettings,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addContract,
        updateContract,
        deleteContract,
        addAttendance,
        updateAttendance,
        addDailyAttendance,
  updateDailyAttendance,
        addKPI,
        updateKPI,
        addCashAccount,
        updateCashAccount,
        deleteCashAccount,
        addCashTransaction,
        updateCashTransaction,
        deleteCashTransaction,
        addIngredient,
        updateIngredient,
        deleteIngredient,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        batchPreparations,
        addBatchPreparation,
        updateBatchPreparation,
        deleteBatchPreparation,
        executeBatchCook,
        addStockMovement,
        addSalesTransactions,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addPurchaseOrder,
        addDirectMarketPurchase,
        updatePOStatus,
        payPurchaseOrder,
        markPOAsReceived,
        deletePurchaseOrder,
        openShift,
        closeShift,
        isSyncing,
        lastSyncTime,
        syncData,
        currentSessionId: deviceRef.current.sessionId || "",
        fetchSessions,
        revokeSession,
        revokeOtherSessions,
        wasForceLoggedOut,
        dismissForceLogoutAlert,
        // OWNER hanya boleh view data, tidak boleh create/edit/delete apapun
        isReadOnly: currentUser?.role === "OWNER",
        // Fase 1-4
        expenseCategories,
        addExpenseCategory: (cat: ExpenseCategory) => dispatch({ type: "ADD_EXPENSE_CATEGORY", payload: cat }),
        updateExpenseCategory: (cat: ExpenseCategory) => dispatch({ type: "UPDATE_EXPENSE_CATEGORY", payload: cat }),
        deleteExpenseCategory: (id: string) => dispatch({ type: "DELETE_EXPENSE_CATEGORY", payload: id }),
        budgets,
        addBudget: (b: Budget) => dispatch({ type: "ADD_BUDGET", payload: b }),
        updateBudget: (b: Budget) => dispatch({ type: "UPDATE_BUDGET", payload: b }),
        deleteBudget: (id: string) => dispatch({ type: "DELETE_BUDGET", payload: id }),
        bankReconciliations,
        addBankReconciliation: (r: BankReconciliation) => dispatch({ type: "ADD_BANK_RECONCILIATION", payload: r }),
        updateBankReconciliation: (r: BankReconciliation) => dispatch({ type: "UPDATE_BANK_RECONCILIATION", payload: r }),
        bankStatementLines,
        addBankStatementLine: (l: BankStatementLine) => dispatch({ type: "ADD_BANK_STATEMENT_LINE", payload: l }),
        updateBankStatementLine: (l: BankStatementLine) => dispatch({ type: "UPDATE_BANK_STATEMENT_LINE", payload: l }),
        bulkAddBankStatementLines: (lines: BankStatementLine[]) => dispatch({ type: "BULK_ADD_BANK_STATEMENT_LINES", payload: lines }),
        stockOpnames,
        addStockOpname: (o: StockOpname) => dispatch({ type: "ADD_STOCK_OPNAME", payload: o }),
        updateStockOpname: (o: StockOpname) => dispatch({ type: "UPDATE_STOCK_OPNAME", payload: o }),
        deleteStockOpname: (id: string) => dispatch({ type: "DELETE_STOCK_OPNAME", payload: id }),
        stockOpnameItems,
        addStockOpnameItem: (i: StockOpnameItem) => dispatch({ type: "ADD_STOCK_OPNAME_ITEM", payload: i }),
        bulkAddStockOpnameItems: (items: StockOpnameItem[]) => dispatch({ type: "BULK_ADD_STOCK_OPNAME_ITEMS", payload: items }),
        updateStockOpnameItem: (i: StockOpnameItem) => dispatch({ type: "UPDATE_STOCK_OPNAME_ITEM", payload: i }),
        payrollRecords,
        addPayrollRecord: (p: PayrollRecord) => dispatch({ type: "ADD_PAYROLL_RECORD", payload: p }),
        updatePayrollRecord: (p: PayrollRecord) => dispatch({ type: "UPDATE_PAYROLL_RECORD", payload: p }),
        deletePayrollRecord: (id: string) => dispatch({ type: "DELETE_PAYROLL_RECORD", payload: id }),
        bulkAddPayrollRecords: (records: PayrollRecord[]) => dispatch({ type: "BULK_ADD_PAYROLL_RECORDS", payload: records }),
        state: {
          expenseCategories,
          budgets,
          bankReconciliations,
          bankStatementLines,
          stockOpnames,
          stockOpnameItems,
          payrollRecords,
        },
        closedPeriods,
        closePeriod: (period: string, user: string, notes?: string) => dispatch({ type: "CLOSE_PERIOD", payload: { period, user, notes } }),
        reopenPeriod: (period: string) => dispatch({ type: "REOPEN_PERIOD", payload: period }),
        promotions,
        addPromotion,
        updatePromotion,
        deletePromotion,
        togglePromotionStatus,
        dispatch,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
