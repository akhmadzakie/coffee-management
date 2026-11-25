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
  CashTransactionItem,
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
  ClosedPeriodSnapshot,
  DEFAULT_LEADER_ALLOWANCE_RULES,
  DEFAULT_SHIFT_DEFINITIONS,
  Product,
  ProductVariant,
  BatchPreparation,
  DEFAULT_DIVISION_PACKAGING,
  Promotion,
} from "../types";
import { detectDeviceAsync, DetectedDeviceInfo } from "../utils/deviceDetector";
import { LOCAL_STORAGE_DATA_CACHE_KEYS } from "../utils/dataCleaning";
import {
  evaluateCashAccountProtection,
  isCoreExpenseCategory,
  sanitizeCoreExpenseCategoryUpdate,
} from "../utils/systemGuards";
import { calculateCashFlowHppSync, resolveOrderItemIngredients } from "../utils/posDomainLogic";
import { getLocalDateString, getLocalPeriodString } from "../utils/dateUtils";
import { syncAttendanceRecordsWithDaily } from "../utils/attendanceRecap";
import {
  cascadeCashAccountDelete,
  cascadeExpenseCategoryDelete,
  cascadeExpenseCategoryUpdate,
  cascadePurchaseOrderDelete,
  computePeriodFinancialSummary,
  DEFAULT_INGREDIENT_CATEGORIES,
  getSaleTransactionAmount,
  isSalesCashTransaction,
  recoverOrphanCashAccountsAndCategories,
} from "../utils/financeMetrics";
import {
  aggregateBatchRequiredQuantities,
  computeBatchWeightedUnitCost,
  resolveDivisionStorageLocation,
  sanitizePayrollRecordData,
  validatePayrollMutation,
} from "../utils/syncSanitizers";
import { get, set, del } from "idb-keyval";
import { toast } from "../context/ToastContext";

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

export const normalizeCashTrxType = (type: any): "CASH_IN" | "CASH_OUT" | "TRANSFER" => {
  if (type === "TRANSFER") return "TRANSFER";
  if (type === "OUT" || type === "EXPENSE" || type === "CASH_OUT") return "CASH_OUT";
  return "CASH_IN";
};

export const DEFAULT_INITIAL_INGREDIENTS: Ingredient[] = [
  { id: "ing-coffee-beans", name: "House Blend Espresso Beans", unit: "gr", currentStock: 4500, minStock: 1000, category: "Biji Kopi", costPerUnit: 250, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 250000, storageLocation: "BAR" },
  { id: "ing-fresh-milk", name: "Fresh Milk UHT Greenfields", unit: "ml", currentStock: 18000, minStock: 5000, category: "Susu & Dairy", costPerUnit: 18.5, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 18500, storageLocation: "CHILLER" },
  { id: "ing-aren-padat", name: "Gula Aren Batok Organik", unit: "gr", currentStock: 8000, minStock: 2000, category: "Sirup & Pemanis", costPerUnit: 35, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 35000, storageLocation: "DRY_STORAGE" },
  { id: "ing-air", name: "Air Bersih Galon RO", unit: "ml", currentStock: 50000, minStock: 10000, category: "Air & Es", costPerUnit: 0.5, purchaseUnit: "Galon (19L)", conversionFactor: 19000, purchasePrice: 9500, storageLocation: "BAR" },
  { id: "ing-gula-pasir", name: "Gula Pasir Kristal Putih", unit: "gr", currentStock: 12000, minStock: 3000, category: "Sirup & Pemanis", costPerUnit: 16, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 16000, storageLocation: "DRY_STORAGE" },
  { id: "ing-aren-cair", name: "Gula Aren Cair Racikan", unit: "ml", currentStock: 2400, minStock: 800, category: "Bahan Olahan", costPerUnit: 38, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 38000, storageLocation: "BAR" },
  { id: "ing-simple-syrup", name: "Simple Syrup (1:1)", unit: "ml", currentStock: 3200, minStock: 1000, category: "Bahan Olahan", costPerUnit: 12, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 12000, storageLocation: "BAR" },
  { id: "ing-ice-cube", name: "Es Batu Kristal Tube", unit: "gr", currentStock: 25000, minStock: 5000, category: "Air & Es", costPerUnit: 2, purchaseUnit: "Plastik (10Kg)", conversionFactor: 10000, purchasePrice: 20000, storageLocation: "BAR" },
  { id: "ing-beras", name: "Beras Pulen Pandan Wangi", unit: "gr", currentStock: 15000, minStock: 5000, category: "Bahan Kitchen", costPerUnit: 16, purchaseUnit: "Karung (25Kg)", conversionFactor: 25000, purchasePrice: 400000, storageLocation: "KITCHEN" },
  { id: "ing-ayam-fillet", name: "Daging Ayam Fillet Paha", unit: "gr", currentStock: 4800, minStock: 1500, category: "Bahan Kitchen", costPerUnit: 58, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 58000, storageLocation: "KITCHEN" },
  { id: "ing-bawang-merah", name: "Bawang Merah Kupas", unit: "gr", currentStock: 3000, minStock: 1000, category: "Bahan Kitchen", costPerUnit: 38, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 38000, storageLocation: "KITCHEN" },
  { id: "ing-cabai-rawit", name: "Cabai Rawit Merah Segar", unit: "gr", currentStock: 2000, minStock: 800, category: "Bahan Kitchen", costPerUnit: 60, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 60000, storageLocation: "KITCHEN" },
  { id: "ing-minyak-kelapa", name: "Minyak Kelapa Asli", unit: "ml", currentStock: 4000, minStock: 1000, category: "Bahan Kitchen", costPerUnit: 32, purchaseUnit: "Liter", conversionFactor: 1000, purchasePrice: 32000, storageLocation: "KITCHEN" },
  { id: "ing-sambal-matah", name: "Sambal Matah Matang", unit: "gr", currentStock: 1800, minStock: 500, category: "Bahan Olahan", costPerUnit: 48, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 48000, storageLocation: "KITCHEN" },
  { id: "ing-minyak-goreng", name: "Minyak Goreng Sawit", unit: "ml", currentStock: 10000, minStock: 3000, category: "Bahan Kitchen", costPerUnit: 18, purchaseUnit: "Jerigen (5L)", conversionFactor: 5000, purchasePrice: 90000, storageLocation: "KITCHEN" },
  { id: "ing-adonan-croissant", name: "Dough Croissant Butter 70g", unit: "pcs", currentStock: 40, minStock: 15, category: "Bahan Bakery", costPerUnit: 6500, purchaseUnit: "Dus (20pcs)", conversionFactor: 20, purchasePrice: 130000, storageLocation: "BAKERY" },
  { id: "ing-butter", name: "French Pure Butter Elle & Vire", unit: "gr", currentStock: 2500, minStock: 500, category: "Bahan Bakery", costPerUnit: 140, purchaseUnit: "Pack (250g)", conversionFactor: 250, purchasePrice: 35000, storageLocation: "CHILLER" },
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
    targetIngredientId: "ing-cold-brew",
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
  // Sub-Kategori: Pembelian Aset
  { id: "cat-aset-mesin", name: "Mesin & Peralatan Bar/Dapur", type: "ASET", parentId: "cat-aset", color: "#A5B4FC", icon: "briefcase", isActive: true, sortOrder: 1 },
  { id: "cat-aset-furnitur", name: "Furnitur & Interior", type: "ASET", parentId: "cat-aset", color: "#A5B4FC", icon: "home", isActive: true, sortOrder: 2 },
  { id: "cat-aset-renovasi", name: "Renovasi & Inventaris", type: "ASET", parentId: "cat-aset", color: "#A5B4FC", icon: "settings", isActive: true, sortOrder: 3 },
  // Sub-Kategori: Lainnya
  { id: "cat-admin-bank", name: "Biaya Admin Bank & Pajak", type: "LAINNYA", parentId: "cat-lainnya", color: "#9CA3AF", icon: "shield", isActive: true, sortOrder: 1 },
  { id: "cat-lain-rupa", name: "Pengeluaran Lain-lain", type: "LAINNYA", parentId: "cat-lainnya", color: "#9CA3AF", icon: "more-horizontal", isActive: true, sortOrder: 2 },
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
  updateDailySalesRecap: (recap: DailySalesRecap) => void;
  settleDailySalesRecapNonCash: (
    id: string,
    opts?: { bankAccountId?: string; mdrFeeAmount?: number; settledDate?: string }
  ) => void;
  deleteDailySalesRecap: (id: string) => void;
  syncMissingSalesToCashFlow: (targetAccountId?: string) => {
    syncedCount: number;
    syncedAmount: number;
    skippedClosedCount?: number;
  };
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
  kpiTasks: any[];
  kpiBonusRules: any[];
  updateKpiTask: (id: string, task: any) => void;
  deleteKpiTask: (id: string) => void;
  updateKpiBonusRule: (id: string, rule: any) => void;
  deleteKpiBonusRule: (id: string) => void;

  // Fase 1: Expense Categories & Pos Kas Recovery
  expenseCategories: ExpenseCategory[];
  addExpenseCategory: (cat: ExpenseCategory) => void;
  updateExpenseCategory: (cat: ExpenseCategory) => void;
  deleteExpenseCategory: (id: string) => void;
  restoreDefaultExpenseCategories: () => number;
  restoreMissingCashPositions: () => {
    addedAccountCount: number;
    addedCategoryCount: number;
  };

  // Fase 2: Finance
  budgets: Budget[];
  addBudget: (b: Budget) => void;
  updateBudget: (b: Budget) => void;
  deleteBudget: (id: string) => void;
  bankReconciliations: BankReconciliation[];
  addBankReconciliation: (r: BankReconciliation) => void;
  updateBankReconciliation: (r: BankReconciliation) => void;
  deleteBankReconciliation: (id: string) => void;

  bankStatementLines: BankStatementLine[];
  addBankStatementLine: (l: BankStatementLine) => void;
  updateBankStatementLine: (l: BankStatementLine) => void;
  bulkAddBankStatementLines: (lines: BankStatementLine[]) => void;
  replaceBankReconLines: (reconciliationId: string, lines: BankStatementLine[]) => void;

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
  closePeriod: (
    period: string,
    user: string,
    notes?: string,
    snapshot?: ClosedPeriodSnapshot | null
  ) => void;
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
  }) => PurchaseOrder | null;
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
  lastLoginError: string;
  unsuspendUser: (userId: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: Omit<User, "id">) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;

  addCashAccount: (account: Omit<CashAccount, "id">) => string;
  updateCashAccount: (account: CashAccount) => void;
  deleteCashAccount: (id: string) => void;

  addCashTransaction: (transaction: Omit<CashTransaction, "id">) => string;
  updateCashTransaction: (transaction: CashTransaction) => void;
  deleteCashTransaction: (id: string) => void;

  addIngredient: (ingredient: Omit<Ingredient, "id">) => string;
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
  addSalesTransactions: (
    transactions: Omit<SalesTransaction, "id">[],
    fileName?: string,
    targetCashAccountId?: string
  ) => { count: number; cashSyncedAmount: number; stockDeductedCount: number };

  // Sync Status
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncData: () => Promise<void>;
  clearLocalCachesAndReload: () => Promise<void>;

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

/**
 * Helper untuk mengisolasi sesi auth antara Terminal POS Kasir (/pos),
 * Layar Dapur KDS (/kds), dan Web Management (/) agar tidak saling menimpa
 * di localStorage / IndexedDB saat dijalankan di domain / browser yang sama.
 */
export const getAuthStorageKeys = () => {
  if (typeof window === "undefined") {
    return { userKey: "node_current_user", sessionKey: "node_session_id" };
  }
  const pathname = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);

  const isPos =
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    searchParams.get("view") === "pos_cashier" ||
    searchParams.get("mode") === "pos";

  if (isPos) {
    return { userKey: "pos_cashier_user", sessionKey: "pos_session_id" };
  }

  const isKds =
    pathname === "/kds" ||
    pathname.startsWith("/kds/") ||
    searchParams.get("view") === "kitchen_display" ||
    searchParams.get("mode") === "kds";

  if (isKds) {
    return { userKey: "kds_screen_user", sessionKey: "kds_session_id" };
  }

  return { userKey: "node_current_user", sessionKey: "node_session_id" };
};

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
      posSupervisorPin: "1234",
      autoDeductStockOnSale: false,
      allowNegativeStockSale: true,
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

  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(() => {
    try {
      const cached = localStorage.getItem("app_cash_accounts_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(() => {
    try {
      const cached = localStorage.getItem("app_cash_transactions_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
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
      return [];
    } catch {
      return [];
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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [batchPreparations, setBatchPreparations] = useState<BatchPreparation[]>(() => {
    try {
      const saved = localStorage.getItem("app_batch_preparations_cache");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
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

  const hasLocalChanges = useRef(false);
  const dirtyTablesRef = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);
  const isApplyingServerUpdate = useRef(false);
  const deviceRef = useRef<DetectedDeviceInfo>({} as DetectedDeviceInfo);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markChanged = (...tables: string[]) => {
    if (isApplyingServerUpdate.current || currentUser?.role === "OWNER") return;
    hasLocalChanges.current = true;
    if (tables.length === 0) {
      dirtyTablesRef.current.add("*");
    } else {
      tables.forEach((t) => dirtyTablesRef.current.add(t));
    }
  };

  // Generic dispatch for new modules
  const dispatch = (action: any) => {
    if (currentUser?.role === "OWNER") return;
    switch (action.type) {
      case "ADD_EXPENSE_CATEGORY": {
        markChanged("expense_categories");
        setExpenseCategories((prev) => {
          const next = [...prev, action.payload];
          try {
            localStorage.setItem("app_expense_categories_cache", JSON.stringify(next));
          } catch {}
          return next;
        });
        break;
      }
      case "UPDATE_EXPENSE_CATEGORY": {
        const prevCat = expenseCategories.find((c) => c.id === action.payload.id);
        const safeCategory = sanitizeCoreExpenseCategoryUpdate(action.payload, prevCat);
        const nextTransactions = cascadeExpenseCategoryUpdate({
          updatedCategory: safeCategory,
          previousCategory: prevCat,
          cashTransactions,
        });
        const txChanged = nextTransactions.some((t, idx) => t !== cashTransactions[idx]);
        markChanged(...(txChanged ? ["expense_categories", "cash_transactions"] : ["expense_categories"]));
        setExpenseCategories((prev) => {
          const next = prev.map((c) => (c.id === safeCategory.id ? safeCategory : c));
          try {
            localStorage.setItem("app_expense_categories_cache", JSON.stringify(next));
          } catch {}
          return next;
        });
        if (txChanged) {
          setCashTransactions(nextTransactions);
          try {
            localStorage.setItem("app_cash_transactions_cache", JSON.stringify(nextTransactions));
          } catch {}
        }
        break;
      }
      case "DELETE_EXPENSE_CATEGORY": {
        if (isCoreExpenseCategory(action.payload)) {
          break;
        }
        const { updatedCategories, updatedTransactions, updatedBudgets } =
          cascadeExpenseCategoryDelete({
            categoryId: action.payload,
            categories: expenseCategories,
            cashTransactions,
            budgets,
          });
        const txChanged = updatedTransactions.some((t, idx) => t !== cashTransactions[idx]);
        const budgetChanged = updatedBudgets.length !== budgets.length;
        const dirty: string[] = ["expense_categories"];
        if (txChanged) dirty.push("cash_transactions");
        if (budgetChanged) dirty.push("budgets");
        markChanged(...dirty);
        setExpenseCategories(updatedCategories);
        try {
          localStorage.setItem("app_expense_categories_cache", JSON.stringify(updatedCategories));
        } catch {}
        if (txChanged) {
          setCashTransactions(updatedTransactions);
          try {
            localStorage.setItem("app_cash_transactions_cache", JSON.stringify(updatedTransactions));
          } catch {}
        }
        if (budgetChanged) {
          setBudgets(updatedBudgets);
        }
        break;
      }
      case "RESTORE_DEFAULT_EXPENSE_CATEGORIES": {
        markChanged("expense_categories");
        setExpenseCategories((prev) => {
          const existingMap = new Map(prev.map((c) => [c.id, c]));
          const restored: ExpenseCategory[] = [...prev.map((c) => ({ ...c, isActive: true }))];
          DEFAULT_EXPENSE_CATEGORIES.forEach((def) => {
            if (!existingMap.has(def.id)) {
              restored.push(def);
            }
          });
          try {
            localStorage.setItem("app_expense_categories_cache", JSON.stringify(restored));
          } catch {}
          return restored;
        });
        break;
      }
      case "ADD_PAYROLL_RECORD": {
        const rec = sanitizePayrollRecordData(action.payload, action.payload.id || generateId()) as PayrollRecord;
        const check = validatePayrollMutation({
          action: "CREATE",
          recordPeriod: rec.period,
          closedPeriods,
        });
        if ("error" in check) {
          toast.error(check.error);
          break;
        }
        setPayrollRecords((prev) => [...prev, rec]);
        writeAuditLog("CREATE", "payroll_records", rec.id);
        markChanged("payroll_records");
        break;
      }
      case "UPDATE_PAYROLL_RECORD": {
        const rec = sanitizePayrollRecordData(action.payload, action.payload.id || generateId()) as PayrollRecord;
        const existing = payrollRecords.find((p) => p.id === rec.id);
        const targetPeriod = existing?.period || rec.period;
        const check = validatePayrollMutation({
          action: "UPDATE",
          recordPeriod: targetPeriod,
          existingStatus: existing?.status,
          closedPeriods,
        });
        if ("error" in check) {
          toast.error(check.error);
          break;
        }
        if (rec.period !== targetPeriod) {
          const checkNewPeriod = validatePayrollMutation({
            action: "UPDATE",
            recordPeriod: rec.period,
            existingStatus: existing?.status,
            closedPeriods,
          });
          if ("error" in checkNewPeriod) {
            toast.error(checkNewPeriod.error);
            break;
          }
        }
        setPayrollRecords((prev) => prev.map((p) => (p.id === rec.id ? rec : p)));
        writeAuditLog("UPDATE", "payroll_records", rec.id);
        markChanged("payroll_records");
        break;
      }
      case "DELETE_PAYROLL_RECORD": {
        const existing = payrollRecords.find((p) => p.id === action.payload);
        if (existing) {
          const check = validatePayrollMutation({
            action: "DELETE",
            recordPeriod: existing.period,
            existingStatus: existing.status,
            closedPeriods,
          });
          if ("error" in check) {
            toast.error(check.error);
            break;
          }
        }
        setPayrollRecords((prev) => prev.filter((p) => p.id !== action.payload));
        writeAuditLog("DELETE", "payroll_records", String(action.payload));
        markChanged("payroll_records");
        break;
      }
      case "BULK_ADD_PAYROLL_RECORDS": {
        const closedSet = new Set(closedPeriods.map((p) => p.period));
        const existingPairSet = new Set(
          payrollRecords.map((r) => `${r.employeeId}::${r.period}`)
        );
        const validRecords: PayrollRecord[] = [];
        for (const raw of action.payload || []) {
          const rec = sanitizePayrollRecordData(raw, raw?.id || generateId()) as PayrollRecord;
          if (!rec.period || closedSet.has(rec.period)) continue;
          const pairKey = `${rec.employeeId}::${rec.period}`;
          if (existingPairSet.has(pairKey)) continue;
          existingPairSet.add(pairKey);
          validRecords.push(rec);
        }
        if (validRecords.length === 0) {
          toast.warning("Tidak ada slip gaji baru yang dapat dibuat (periode tutup buku atau sudah ada).");
          break;
        }
        setPayrollRecords((prev) => [...prev, ...validRecords]);
        writeAuditLog("CREATE", "payroll_records", `bulk-${validRecords.length}`);
        markChanged("payroll_records");
        break;
      }
      case "ADD_BUDGET":
        markChanged("budgets");
        setBudgets((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_BUDGET":
        markChanged("budgets");
        setBudgets((prev) => prev.map((b) => b.id === action.payload.id ? action.payload : b));
        break;
      case "DELETE_BUDGET":
        markChanged("budgets");
        setBudgets((prev) => prev.filter((b) => b.id !== action.payload));
        break;
      case "ADD_BANK_RECONCILIATION":
        markChanged("bank_reconciliations");
        setBankReconciliations((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_BANK_RECONCILIATION":
        markChanged("bank_reconciliations");
        setBankReconciliations((prev) => prev.map((r) => r.id === action.payload.id ? action.payload : r));
        break;
      case "ADD_BANK_STATEMENT_LINE":
        markChanged("bank_statement_lines");
        setBankStatementLines((prev) => [...prev, action.payload]);
        break;
      case "UPDATE_BANK_STATEMENT_LINE":
        markChanged("bank_statement_lines");
        setBankStatementLines((prev) => prev.map((l) => l.id === action.payload.id ? action.payload : l));
        break;
      case "BULK_ADD_BANK_STATEMENT_LINES":
        markChanged("bank_statement_lines");
        setBankStatementLines((prev) => [...prev, ...action.payload]);
        break;
      case "SET_BANK_RECONCILIATIONS":
        markChanged("bank_reconciliations");
        setBankReconciliations(action.payload);
        break;
      case "SET_BANK_STATEMENT_LINES":
        markChanged("bank_statement_lines");
        setBankStatementLines(action.payload);
        break;
      case "DELETE_BANK_RECONCILIATION":
        setBankReconciliations((prev) => prev.filter((r) => r.id !== action.payload));
        setBankStatementLines((prev) => prev.filter((l) => l.reconciliationId !== action.payload));
        writeAuditLog("DELETE", "bank_reconciliations", String(action.payload));
        markChanged("bank_reconciliations", "bank_statement_lines");
        break;
      case "REPLACE_BANK_RECON_LINES":
        markChanged("bank_statement_lines");
        setBankStatementLines((prev) => [
          ...prev.filter((l) => l.reconciliationId !== action.payload.reconciliationId),
          ...action.payload.lines,
        ]);
        break;
      case "ADD_STOCK_OPNAME":
        markChanged("stock_opnames");
        setStockOpnames((prev) => {
          const exists = prev.some((o) => o.id === action.payload.id);
          if (exists) {
            return prev.map((o) => (o.id === action.payload.id ? action.payload : o));
          }
          return [...prev, action.payload];
        });
        break;
      case "UPDATE_STOCK_OPNAME":
        markChanged("stock_opnames");
        setStockOpnames((prev) => prev.map((o) => (o.id === action.payload.id ? action.payload : o)));
        break;
      case "DELETE_STOCK_OPNAME":
        markChanged("stock_opnames", "stock_opname_items");
        setStockOpnames((prev) => prev.filter((o) => o.id !== action.payload));
        setStockOpnameItems((prev) => prev.filter((i) => i.opnameId !== action.payload));
        break;
      case "ADD_STOCK_OPNAME_ITEM":
        markChanged("stock_opname_items");
        setStockOpnameItems((prev) => {
          const exists = prev.some((i) => i.id === action.payload.id || (i.opnameId === action.payload.opnameId && i.ingredientId === action.payload.ingredientId));
          if (exists) {
            return prev.map((i) => (i.id === action.payload.id || (i.opnameId === action.payload.opnameId && i.ingredientId === action.payload.ingredientId) ? action.payload : i));
          }
          return [...prev, action.payload];
        });
        break;
      case "UPDATE_STOCK_OPNAME_ITEM":
        markChanged("stock_opname_items");
        setStockOpnameItems((prev) => prev.map((i) => (i.id === action.payload.id ? action.payload : i)));
        break;
      case "BULK_ADD_STOCK_OPNAME_ITEMS":
        markChanged("stock_opname_items");
        setStockOpnameItems((prev) => {
          const incomingIds = new Set(action.payload.map((i: any) => i.id));
          const incomingPairs = new Set(action.payload.map((i: any) => `${i.opnameId}_${i.ingredientId}`));
          const filtered = prev.filter((i) => !incomingIds.has(i.id) && !incomingPairs.has(`${i.opnameId}_${i.ingredientId}`));
          return [...filtered, ...action.payload];
        });
        break;
      case "ADD_CLOSED_PERIOD":
      case "CLOSE_PERIOD":
        if (
          currentUser?.role !== "SUPER_ADMIN" &&
          currentUser?.role !== "MANAGER" &&
          currentUser?.role !== "FINANCE"
        ) {
          toast.error("Hanya Finance, Manager, atau Super Admin yang dapat menutup periode buku.");
          break;
        }
        markChanged("closed_periods");
        setClosedPeriods((prev) => [
          ...prev.filter((p) => p.period !== action.payload.period),
          {
            id: action.payload.id || "cp_" + Date.now(),
            period: action.payload.period,
            closedAt: action.payload.closedAt || new Date().toISOString(),
            closedBy: action.payload.user || action.payload.closedBy || "Manager",
            notes: action.payload.notes || "",
            snapshot: action.payload.snapshot || null,
            snapshotJson: action.payload.snapshot ? JSON.stringify(action.payload.snapshot) : null,
          },
        ]);
        writeAuditLog("CREATE", "closed_periods", String(action.payload.period));
        break;
      case "REMOVE_CLOSED_PERIOD":
      case "REOPEN_PERIOD": {
        if (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "MANAGER") {
          toast.error("Hanya Manager atau Super Admin yang dapat membuka kembali periode tutup buku.");
          break;
        }
        const targetPeriod =
          typeof action.payload === "string" ? action.payload : action.payload?.period;
        const reasonSuffix = action.payload?.notes ? ` (${String(action.payload.notes).slice(0, 80)})` : "";
        markChanged("closed_periods");
        setClosedPeriods((prev) => prev.filter((p) => p.period !== targetPeriod));
        if (targetPeriod) {
          writeAuditLog("DELETE", "closed_periods", `${targetPeriod}${reasonSuffix}`);
        }
        break;
      }
      case "SET_STOCK_OPNAMES":
        markChanged("stock_opnames");
        setStockOpnames(action.payload);
        break;
      case "SET_STOCK_OPNAME_ITEMS":
        markChanged("stock_opname_items");
        setStockOpnameItems(action.payload);
        break;
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [wasForceLoggedOut, setWasForceLoggedOut] = useState<boolean>(false);
  const [lastLoginError, setLastLoginError] = useState<string>("");

  // Initialize auth
  useEffect(() => {
    async function loadAuth() {
      try {
        const { userKey, sessionKey } = getAuthStorageKeys();
        const deviceInfo = await detectDeviceAsync();
        const savedToken =
          localStorage.getItem(sessionKey) ||
          ((await get(sessionKey).catch(() => "")) as string);
        if (savedToken) {
          deviceInfo.sessionId = savedToken;
          localStorage.setItem(sessionKey, savedToken);
        }
        deviceRef.current = deviceInfo;

        let savedUser = await get(userKey);
        if (!savedUser) {
          const lsUser = localStorage.getItem(userKey);
          if (lsUser) {
            savedUser = JSON.parse(lsUser);
            await set(userKey, savedUser).catch(() => {});
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
      const { userKey } = getAuthStorageKeys();
      if (currentUser) {
        set(userKey, currentUser).catch(console.error);
        localStorage.setItem(userKey, JSON.stringify(currentUser));
      } else {
        del(userKey).catch(console.error);
        localStorage.removeItem(userKey);
      }
    }
  }, [currentUser, isAuthLoaded]);

  // Sync Logic & Version tracking for Railway Network Egress Optimization
  const serverVersionRef = useRef<number | null>(null);

  const fetchFromServer = async (isManual = false, overrideToken?: string) => {
    // Hemat kuota data & biaya Railway: jangan sync di background jika tab sedang diminimize/tidak aktif
    if (typeof document !== "undefined" && document.hidden && !isManual) return;
    if (isSyncingRef.current && !isManual) return;
    if (hasLocalChanges.current && !isManual) return;

    let didLoadAuthenticatedData = false;
    try {
      if (isManual) setIsSyncing(true);
      const { sessionKey } = getAuthStorageKeys();
      const token =
        overrideToken ||
        localStorage.getItem(sessionKey) ||
        deviceRef.current?.sessionId ||
        "";

      const url = isManual || !serverVersionRef.current
        ? "/api/sync"
        : `/api/sync?v=${serverVersionRef.current}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();

        // Jika belum login, server mengembalikan mode publicOnly (hanya daftar nama akun & branding halaman Login)
        if (data.publicOnly) {
          isApplyingServerUpdate.current = true;
          if (Array.isArray(data.users) && data.users.length > 0) {
            setUsers(data.users);
          }
          if (data.settings) {
            setSettings((prev) => ({
              ...prev,
              brandName: data.settings.brandName || prev.brandName,
              companyAddress: data.settings.companyAddress || prev.companyAddress,
              footerMessage: data.settings.footerMessage || prev.footerMessage,
              logoDataUrl: data.settings.logoDataUrl || prev.logoDataUrl,
              language: data.settings.language || prev.language,
            }));
          }
          serverVersionRef.current = null;
          setTimeout(() => {
            isApplyingServerUpdate.current = false;
          }, 100);
          return;
        }

        // Jika server melaporkan data tidak berubah sejak sync terakhir, selesai seketika (35 byte)!
        if (data.notModified) {
          didLoadAuthenticatedData = true;
          setLastSyncTime(new Date());
          return;
        }

        didLoadAuthenticatedData = true;
        if (data.v) {
          serverVersionRef.current = data.v;
        }

        isApplyingServerUpdate.current = true;

        const incomingAccounts: CashAccount[] = Array.isArray(data.cash_accounts)
          ? data.cash_accounts
          : cashAccounts;
        const normalizedTransactions: CashTransaction[] = Array.isArray(data.cash_transactions)
          ? data.cash_transactions.map((tx: any) => {
              let parsedItems = Array.isArray(tx.items) ? tx.items : undefined;
              if (!parsedItems && typeof tx.itemsJson === "string" && tx.itemsJson.trim()) {
                try {
                  const p = JSON.parse(tx.itemsJson);
                  if (Array.isArray(p)) parsedItems = p;
                } catch {}
              }
              return {
                ...tx,
                type: normalizeCashTrxType(tx.type),
                items: parsedItems,
              };
            })
          : cashTransactions;

        let loadedCategories: ExpenseCategory[] =
          Array.isArray(data.expense_categories) && data.expense_categories.length > 0
            ? data.expense_categories
            : expenseCategories;

        // Pulihkan otomatis Pos Kas dan Pos Kategori kustom jika ada transaksi yang kehilangan induknya
        const recovery = recoverOrphanCashAccountsAndCategories({
          cashAccounts: incomingAccounts,
          cashTransactions: normalizedTransactions,
          expenseCategories: loadedCategories,
        });

        setCashAccounts(recovery.recoveredAccounts);
        setCashTransactions(normalizedTransactions);
        setExpenseCategories(recovery.recoveredCategories);
        try {
          if (recovery.recoveredAccounts.length > 0) {
            localStorage.setItem("app_cash_accounts_cache", JSON.stringify(recovery.recoveredAccounts));
          }
          localStorage.setItem("app_cash_transactions_cache", JSON.stringify(normalizedTransactions));
          if (recovery.recoveredCategories.length > 0) {
            localStorage.setItem("app_expense_categories_cache", JSON.stringify(recovery.recoveredCategories));
          }
        } catch {}
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
            ingredientCategories: Array.isArray(s.ingredientCategories) && s.ingredientCategories.length > 0
              ? s.ingredientCategories
              : (settings?.ingredientCategories && settings.ingredientCategories.length > 0
                  ? settings.ingredientCategories
                  : DEFAULT_INGREDIENT_CATEGORIES),
            ingredientCategoryDivisions:
              s.ingredientCategoryDivisions &&
              typeof s.ingredientCategoryDivisions === "object" &&
              !Array.isArray(s.ingredientCategoryDivisions)
                ? s.ingredientCategoryDivisions
                : settings?.ingredientCategoryDivisions,
            menuCategories:
              s.menuCategories && typeof s.menuCategories === "object" && !Array.isArray(s.menuCategories)
                ? s.menuCategories
                : settings?.menuCategories,
            dailySalesRecaps: Array.isArray(data.daily_sales_recaps)
              ? data.daily_sales_recaps
              : Array.isArray(s.dailySalesRecaps)
              ? s.dailySalesRecaps
              : settings?.dailySalesRecaps,
            defaultOverheadPercent: s.defaultOverheadPercent !== undefined
              ? Number(s.defaultOverheadPercent)
              : (settings?.defaultOverheadPercent ?? 10),
            enableStoreSalesBonus: s.enableStoreSalesBonus !== false,
            enableLeaderAllowanceBonus: s.enableLeaderAllowanceBonus !== false,
            enableKpiScoreBonus: Boolean(s.enableKpiScoreBonus),
            posSupervisorPin: String(s.posSupervisorPin ?? ""),
            autoDeductStockOnSale: s.autoDeductStockOnSale === true,
            allowNegativeStockSale: s.allowNegativeStockSale !== false,
            autoSeedDisabled: Boolean(s.autoSeedDisabled),
            lastCleanedAt: s.lastCleanedAt ?? null,
          };
          setSettings(newSettings);
          if (!Array.isArray(data.daily_sales_recaps) && Array.isArray(s.dailySalesRecaps)) {
            const sortedLegacy = [...s.dailySalesRecaps].sort((a: DailySalesRecap, b: DailySalesRecap) =>
              b.date.localeCompare(a.date)
            );
            setDailySalesRecaps(sortedLegacy);
            try {
              localStorage.setItem("app_daily_sales_recaps", JSON.stringify(sortedLegacy));
            } catch {}
          }
          try {
            localStorage.setItem("app_settings_cache", JSON.stringify(newSettings));
          } catch {}
        }
        if (Array.isArray(data.users) && data.users.length > 0)
          setUsers(data.users);
        if (Array.isArray(data.device_sessions))
          setSessions(data.device_sessions);
        if (Array.isArray(data.ingredients)) {
          setIngredients(data.ingredients);
          try {
            localStorage.setItem("app_ingredients_cache", JSON.stringify(data.ingredients));
          } catch {}
        }
        if (Array.isArray(data.recipes)) {
          const normalizedRecipes = normalizeRecipeList(data.recipes);
          setRecipes(normalizedRecipes);
          try {
            localStorage.setItem("app_recipes_cache", JSON.stringify(normalizedRecipes));
          } catch {}
        }
        if (Array.isArray(data.stock_movements))
          setStockMovements(data.stock_movements);
        if (Array.isArray(data.sales_transactions))
          setSalesTransactions(data.sales_transactions);
        if (Array.isArray(data.daily_sales_recaps)) {
          const sortedRecaps = [...data.daily_sales_recaps].sort(
            (a: DailySalesRecap, b: DailySalesRecap) => b.date.localeCompare(a.date)
          );
          setDailySalesRecaps(sortedRecaps);
          try {
            localStorage.setItem("app_daily_sales_recaps", JSON.stringify(sortedRecaps));
          } catch {}
        }
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
        // Fase 1-4 (expense_categories sudah di-set dan dipulihkan bersama cash_accounts di atas)
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
        if (Array.isArray(data.products)) {
          setProducts(data.products);
          try {
            localStorage.setItem("app_products_cache", JSON.stringify(data.products));
          } catch {}
        }
        if (Array.isArray(data.batch_preparations)) {
          setBatchPreparations(data.batch_preparations);
          try {
            localStorage.setItem(
              "app_batch_preparations_cache",
              JSON.stringify(data.batch_preparations)
            );
          } catch {}
        }
        if (Array.isArray(data.kpiTasks)) {
          setKpiTasks(data.kpiTasks);
          try {
            localStorage.setItem("kpi_tasks", JSON.stringify(data.kpiTasks));
          } catch {}
        }
        if (Array.isArray(data.kpiBonusRules)) {
          setKpiBonusRules(data.kpiBonusRules);
          try {
            localStorage.setItem("kpi_bonus_rules", JSON.stringify(data.kpiBonusRules));
          } catch {}
        }

        setLastSyncTime(new Date());
        hasLocalChanges.current = false;
        dirtyTablesRef.current.clear();

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
      if (didLoadAuthenticatedData) {
        setIsLoaded(true);
      }
      if (isManual) setIsSyncing(false);
    }
  };

  // Sinkronisasi ulang begitu status autentikasi selesai dimuat dan pengguna terautentikasi
  useEffect(() => {
    if (isAuthLoaded && currentUser?.id) {
      fetchFromServer(true);
    }
  }, [isAuthLoaded, currentUser?.id]);

  // Simpan cache lokal pos kas & transaksi kas hanya setelah data terautentikasi dimuat
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (cashAccounts.length > 0) {
        localStorage.setItem("app_cash_accounts_cache", JSON.stringify(cashAccounts));
      }
      localStorage.setItem("app_cash_transactions_cache", JSON.stringify(cashTransactions));
    } catch {}
  }, [isLoaded, cashAccounts, cashTransactions]);

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
        const { userKey, sessionKey } = getAuthStorageKeys();
        const curSessionId = localStorage.getItem(sessionKey) || deviceRef.current?.sessionId;
        if (curSessionId) {
          fetch("/api/sessions/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${curSessionId}`,
            },
            body: JSON.stringify({ sessionId: curSessionId }),
          }).catch(() => {});
        }
        setCurrentUser(null);
        localStorage.removeItem(userKey);
        del(userKey).catch(() => {});
        localStorage.removeItem(sessionKey);
        del(sessionKey).catch(() => {});
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
      const { userKey, sessionKey } = getAuthStorageKeys();
      const info = deviceRef.current;
      const activeSessionId = localStorage.getItem(sessionKey) || info.sessionId;
      if (!activeSessionId) return;
      const res = await fetch("/api/sessions/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSessionId}`,
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
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
          localStorage.removeItem(userKey);
          del(userKey).catch(() => {});
          localStorage.removeItem(sessionKey);
          del(sessionKey).catch(() => {});
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
      const { sessionKey } = getAuthStorageKeys();
      const token = localStorage.getItem(sessionKey) || deviceRef.current.sessionId;
      if (!token) return;
      const res = await fetch("/api/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          const currentId = token;
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
      const { userKey, sessionKey } = getAuthStorageKeys();
      const token = localStorage.getItem(sessionKey) || deviceRef.current.sessionId;
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        const currentId = token;
        if (sessionId === currentId) {
          setCurrentUser(null);
          localStorage.removeItem(userKey);
          localStorage.removeItem(sessionKey);
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
      const { sessionKey } = getAuthStorageKeys();
      const currentId = localStorage.getItem(sessionKey) || deviceRef.current.sessionId;
      if (!currentId) return false;
      const res = await fetch("/api/sessions/revoke-others", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentId}`,
        },
        body: JSON.stringify({
          currentSessionId: currentId,
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
    if (
      !isLoaded ||
      isApplyingServerUpdate.current ||
      !hasLocalChanges.current ||
      !currentUser ||
      currentUser.role === "OWNER"
    )
      return;

    const { sessionKey } = getAuthStorageKeys();
    const token = localStorage.getItem(sessionKey) || deviceRef.current?.sessionId;
    if (!token) return;

    const timer = setTimeout(async () => {
      const sentKeys: string[] = Array.from(dirtyTablesRef.current);
      if (sentKeys.length === 0) {
        hasLocalChanges.current = false;
        return;
      }

      const fullTableMap: Record<string, any> = {
        cash_accounts: cashAccounts,
        cash_transactions: cashTransactions,
        settings: settings,
        users: users,
        device_sessions: sessions,
        ingredients: ingredients,
        recipes: recipes,
        stock_movements: stockMovements,
        sales_transactions: salesTransactions,
        daily_sales_recaps: dailySalesRecaps,
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
        kpiTasks,
        kpiBonusRules,
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
      };

      const payload: Record<string, any> = {};
      if (sentKeys.includes("*")) {
        Object.assign(payload, fullTableMap);
      } else {
        for (const k of sentKeys) {
          if (k in fullTableMap) {
            payload[k] = fullTableMap[k];
          }
        }
      }

      try {
        setIsSyncing(true);
        isSyncingRef.current = true;
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const resData = await res.json().catch(() => null);
          if (resData?.v) {
            serverVersionRef.current = resData.v;
          }
          sentKeys.forEach((k) => dirtyTablesRef.current.delete(k));
          hasLocalChanges.current = dirtyTablesRef.current.size > 0;
          setLastSyncTime(new Date());
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Sync API failed:", errData);
          if (res.status !== 401) {
            toast.error("Gagal sinkronisasi data ke server: " + (errData.error || "Unknown error"));
          }
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
    currentUser,
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
    dailySalesRecaps,
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
    kpiTasks,
    kpiBonusRules,
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

  const updateSettings = (newSettings: Settings) => {
    if (currentUser?.role === "OWNER") {
      toast.warning("Akun Owner berstatus Read-Only (Pengawasan). Anda tidak diizinkan mengubah konfigurasi toko.");
      return;
    }
    setSettings(newSettings);
    try {
      localStorage.setItem("app_settings_cache", JSON.stringify(newSettings));
    } catch {}
    markChanged("settings");

    // Tunda pengecekan ke microtask agar jika handler yang sama ikut mengubah ingredients/products,
    // semua tabel terkirim bersamaan via debounced sync tanpa balapan data.
    queueMicrotask(() => {
      const otherDirtyTables = Array.from(dirtyTablesRef.current).filter(
        (t) => t !== "settings" && t !== "audit_logs"
      );
      if (otherDirtyTables.length > 0) return;

      const { sessionKey } = getAuthStorageKeys();
      const token = localStorage.getItem(sessionKey) || deviceRef.current?.sessionId;
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
          if (res.ok && dirtyTablesRef.current.size <= 1) {
            dirtyTablesRef.current.delete("settings");
            hasLocalChanges.current = dirtyTablesRef.current.size > 0;
          }
        }).catch((err) => console.warn("Direct settings sync failed:", err));
      }
    });
  };

  const login = async (username: string, pin: string) => {
    setLastLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData?.user?.id) {
          setUsers((prev) =>
            prev.map((u) => (u.id === errData.user.id ? { ...u, ...errData.user } : u))
          );
        }
        setLastLoginError(
          errData?.error || "PIN otorisasi tidak sesuai. Silakan coba lagi."
        );
        return false;
      }
      const data = await res.json();
      setLastLoginError("");
      const { userKey, sessionKey } = getAuthStorageKeys();
      setCurrentUser(data.user);
      localStorage.setItem(userKey, JSON.stringify(data.user));
      set(userKey, data.user).catch(() => {});
      if (data.token) {
        localStorage.setItem(sessionKey, data.token);
        set(sessionKey, data.token).catch(() => {});
        if (deviceRef.current) {
          deviceRef.current.sessionId = data.token;
        }
      }
      serverVersionRef.current = null;
      await fetchFromServer(true, data.token);
      sendHeartbeat(data.user);
      return true;
    } catch (e) {
      console.error("Login failed", e);
      setLastLoginError("Gagal menghubungi server otentikasi.");
      return false;
    }
  };

  const unsuspendUser = async (userId: string): Promise<boolean> => {
    if (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "MANAGER") {
      return false;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              isSuspended: false,
              failedPinAttempts: 0,
              suspendedAt: null,
              suspendedReason: null,
            }
          : u
      )
    );
    writeAuditLog("UPDATE", "users", userId);
    markChanged("users");

    try {
      const { sessionKey } = getAuthStorageKeys();
      const token =
        localStorage.getItem(sessionKey) || deviceRef.current?.sessionId || "";
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/unsuspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        dirtyTablesRef.current.delete("users");
        hasLocalChanges.current = dirtyTablesRef.current.size > 0;
        return true;
      }
    } catch (err) {
      console.warn("Unsuspend API fallback to sync:", err);
    }
    return true;
  };

  const logout = () => {
    const { userKey, sessionKey } = getAuthStorageKeys();
    const curSessionId = localStorage.getItem(sessionKey) || deviceRef.current?.sessionId;
    if (curSessionId) {
      fetch("/api/sessions/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${curSessionId}`,
        },
        body: JSON.stringify({ sessionId: curSessionId }),
      }).catch(() => {});
    }
    setCurrentUser(null);
    serverVersionRef.current = null;
    dirtyTablesRef.current.clear();
    hasLocalChanges.current = false;
    localStorage.removeItem(userKey);
    del(userKey).catch(() => {});
    localStorage.removeItem(sessionKey);
    del(sessionKey).catch(() => {});
    detectDeviceAsync().then((info) => {
      deviceRef.current = info;
    });
  };

  const dismissForceLogoutAlert = () => setWasForceLoggedOut(false);
  const syncData = async () => await fetchFromServer(true);
  const clearLocalCachesAndReload = async () => {
    try {
      for (const cacheKey of LOCAL_STORAGE_DATA_CACHE_KEYS) {
        localStorage.removeItem(cacheKey);
      }
    } catch {}
    hasLocalChanges.current = false;
    dirtyTablesRef.current.clear();
    serverVersionRef.current = null;
    await fetchFromServer(true);
  };

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
    dirtyTablesRef.current.add("audit_logs");
  };

  
  const handleSetDailyChecklists = (c: DailyChecklist[]) => {
    if (currentUser?.role === "OWNER") return;
    setDailyChecklists(c);
    markChanged("dailyChecklists");
  };
  const handleSetEmployeeShifts = (shifts: EmployeeShift[]) => {
    if (currentUser?.role === "OWNER") return;
    setEmployeeShifts(shifts);
    markChanged("employeeShifts");
  };
  const handleSetDailyAttendances = (a: DailyAttendance[]) => {
    if (currentUser?.role === "OWNER") return;
    setDailyAttendances(a);
    const { updatedAttendances, changed } = syncAttendanceRecordsWithDaily({
      dailyAttendances: a,
      existingAttendances: attendances,
      affectedPairs: a
        .filter((item) => item.employeeId && item.date && item.date.length >= 7)
        .map((item) => ({
          employeeId: item.employeeId,
          period: item.date.slice(0, 7),
        })),
      employees,
      users,
    });
    if (changed) {
      setAttendances(updatedAttendances);
      markChanged("dailyAttendances", "attendances");
    } else {
      markChanged("dailyAttendances");
    }
  };

  const addUser = (user: Omit<User, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const id = generateId();
    setUsers((prev) => [...prev, { ...user, id }]);
    writeAuditLog("CREATE", "users", id);
    markChanged("users");
  };

  // ─── HR ACTIONS ─────────────────────────────────────────────────────────
  const addEmployee = (emp: Omit<Employee, "id" | "createdAt">) => {
    if (currentUser?.role === "OWNER") return "";
    const id = generateId();
    setEmployees((prev) => [
      ...prev,
      { ...emp, id, createdAt: new Date().toISOString() },
    ]);
    writeAuditLog("CREATE", "employees", id);
    markChanged("employees");
    return id;
  };

  const updateEmployee = (emp: Employee) => {
    if (currentUser?.role === "OWNER") return;
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));

    // Sinkronisasi otomatis ke akun pengguna (users) — jangan ubah role SUPER_ADMIN / OWNER
    setUsers((prev) =>
      prev.map((u) => {
        const isMatched =
          (u.employeeId && u.employeeId === emp.id) ||
          u.username.toLowerCase() === emp.username.toLowerCase();

        if (!isMatched) return u;

        let role: Role = u.role;
        if (u.role !== "SUPER_ADMIN" && u.role !== "OWNER") {
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
    markChanged("employees", "users");
  };

  const deleteEmployee = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setUsers((prev) =>
      prev.map((u) => (u.employeeId === id ? { ...u, employeeId: null } : u))
    );
    setContracts((prev) => prev.filter((c) => c.employeeId !== id));
    setEmployeeShifts((prev) => prev.filter((s) => s.employeeId !== id));
    writeAuditLog("DELETE", "employees", id);
    markChanged("employees", "users", "contracts", "employeeShifts");
  };

  const addContract = (contract: Omit<EmployeeContract, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const id = generateId();
    const roundedContract: EmployeeContract = {
      ...contract,
      id,
      basicSalary: Math.round(Math.max(0, Number(contract.basicSalary) || 0)),
      mealAllowance: Math.round(Math.max(0, Number(contract.mealAllowance) || 0)),
      positionAllowance: Math.round(Math.max(0, Number(contract.positionAllowance) || 0)),
      transportAllowance: Math.round(Math.max(0, Number(contract.transportAllowance) || 0)),
      alphaDeductionPerDay: Math.round(Math.max(0, Number(contract.alphaDeductionPerDay) || 0)),
      kpiBonusTarget: Math.round(Math.max(0, Number(contract.kpiBonusTarget) || 0)),
    };
    setContracts((prev) => [...prev, roundedContract]);
    writeAuditLog("CREATE", "contracts", id);
    markChanged("contracts");
  };

  const updateContract = (contract: EmployeeContract) => {
    if (currentUser?.role === "OWNER") return;
    const roundedContract: EmployeeContract = {
      ...contract,
      basicSalary: Math.round(Math.max(0, Number(contract.basicSalary) || 0)),
      mealAllowance: Math.round(Math.max(0, Number(contract.mealAllowance) || 0)),
      positionAllowance: Math.round(Math.max(0, Number(contract.positionAllowance) || 0)),
      transportAllowance: Math.round(Math.max(0, Number(contract.transportAllowance) || 0)),
      alphaDeductionPerDay: Math.round(Math.max(0, Number(contract.alphaDeductionPerDay) || 0)),
      kpiBonusTarget: Math.round(Math.max(0, Number(contract.kpiBonusTarget) || 0)),
    };
    setContracts((prev) =>
      prev.map((c) => (c.id === roundedContract.id ? roundedContract : c)),
    );
    writeAuditLog("UPDATE", "contracts", contract.id);
    markChanged("contracts");
  };

  const deleteContract = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setContracts((prev) => prev.filter((c) => c.id !== id));
    writeAuditLog("DELETE", "contracts", id);
    markChanged("contracts");
  };

  const addAttendance = (
    att: Omit<AttendanceRecord, "id" | "createdAt" | "createdBy">,
  ) => {
    if (currentUser?.role === "OWNER") return;
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
    markChanged("attendances");
  };

  const updateAttendance = (att: AttendanceRecord) => {
    if (currentUser?.role === "OWNER") return;
    setAttendances((prev) => prev.map((a) => (a.id === att.id ? att : a)));
    writeAuditLog("UPDATE", "attendances", att.id);
    markChanged("attendances");
  };

  const addDailyAttendance = (att: Omit<DailyAttendance, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const existing = dailyAttendances.find(
      (a) => a.employeeId === att.employeeId && a.date === att.date
    );
    let nextDailyAttendances: DailyAttendance[];
    let targetId: string;
    let actionType: "CREATE" | "UPDATE";

    if (existing) {
      targetId = existing.id;
      actionType = "UPDATE";
      nextDailyAttendances = dailyAttendances.map((a) =>
        a.id === existing.id
          ? {
              ...existing,
              ...att,
              approvalStatus: att.approvalStatus || existing.approvalStatus || "PENDING",
            }
          : a
      );
    } else {
      targetId = generateId();
      actionType = "CREATE";
      const newAtt: DailyAttendance = {
        approvalStatus: "PENDING",
        ...att,
        id: targetId,
      };
      nextDailyAttendances = [...dailyAttendances, newAtt];
    }

    setDailyAttendances(nextDailyAttendances);
    writeAuditLog(actionType, "daily_attendances", targetId);

    const period = (att.date || "").slice(0, 7);
    const { updatedAttendances, changed } = syncAttendanceRecordsWithDaily({
      dailyAttendances: nextDailyAttendances,
      existingAttendances: attendances,
      affectedPairs:
        att.employeeId && period.length === 7
          ? [{ employeeId: att.employeeId, period }]
          : [],
      employees,
      users,
    });
    if (changed) {
      setAttendances(updatedAttendances);
      markChanged("dailyAttendances", "attendances");
    } else {
      markChanged("dailyAttendances");
    }
  };

  const updateDailyAttendance = (att: DailyAttendance) => {
    if (currentUser?.role === "OWNER") return;
    const nextDailyAttendances = dailyAttendances.map((a) =>
      a.id === att.id ? att : a
    );
    setDailyAttendances(nextDailyAttendances);
    writeAuditLog("UPDATE", "daily_attendances", att.id);

    const period = (att.date || "").slice(0, 7);
    const { updatedAttendances, changed } = syncAttendanceRecordsWithDaily({
      dailyAttendances: nextDailyAttendances,
      existingAttendances: attendances,
      affectedPairs:
        att.employeeId && period.length === 7
          ? [{ employeeId: att.employeeId, period }]
          : [],
      employees,
      users,
    });
    if (changed) {
      setAttendances(updatedAttendances);
      markChanged("dailyAttendances", "attendances");
    } else {
      markChanged("dailyAttendances");
    }
  };

  const addKPI = (kpi: Omit<KPIRecord, "id" | "createdAt" | "evaluatedBy">) => {
    if (currentUser?.role === "OWNER") return;
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
    markChanged("kpiRecords");
  };

  const updateKPI = (kpi: KPIRecord) => {
    if (currentUser?.role === "OWNER") return;
    setKpiRecords((prev) => prev.map((k) => (k.id === kpi.id ? kpi : k)));
    writeAuditLog("UPDATE", "kpi_records", kpi.id);
    markChanged("kpiRecords");
  };

  const updateKpiTask = (id: string, task: any) => {
    if (currentUser?.role === "OWNER") return;
    setKpiTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const updated = idx >= 0 
        ? prev.map((t, i) => i === idx ? { ...task, id } : t)
        : [...prev, { ...task, id }];
      try { localStorage.setItem("kpi_tasks", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged("kpiTasks");
  };

  const deleteKpiTask = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setKpiTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      try { localStorage.setItem("kpi_tasks", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged("kpiTasks");
  };

  const updateKpiBonusRule = (id: string, rule: any) => {
    if (currentUser?.role === "OWNER") return;
    setKpiBonusRules((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const updated = idx >= 0 
        ? prev.map((r, i) => i === idx ? { ...rule, id } : r)
        : [...prev, { ...rule, id }];
      try { localStorage.setItem("kpi_bonus_rules", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged("kpiBonusRules");
  };

  const deleteKpiBonusRule = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setKpiBonusRules((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try { localStorage.setItem("kpi_bonus_rules", JSON.stringify(updated)); } catch {}
      return updated;
    });
    markChanged("kpiBonusRules");
  };

  const updateUser = (updatedUser: User) => {
    if (currentUser?.role === "OWNER") return;
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
    markChanged("users", "employees");
  };

  const deleteUser = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setSessions((prev) => prev.filter((s) => s.userId !== id));
    writeAuditLog("DELETE", "users", id);
    markChanged("users", "device_sessions");
  };

  const addCashAccount = (acc: Omit<CashAccount, "id">) => {
    if (currentUser?.role === "OWNER") return "";
    const id = generateId();
    const next = [...cashAccounts, { ...acc, id }];
    setCashAccounts(next);
    try {
      localStorage.setItem("app_cash_accounts_cache", JSON.stringify(next));
    } catch {}
    writeAuditLog("CREATE", "cash_accounts", id);
    markChanged("cash_accounts");
    return id;
  };

  const updateCashAccount = (acc: CashAccount) => {
    if (currentUser?.role === "OWNER") return;
    const prevAcc = cashAccounts.find((a) => a.id === acc.id);
    let safeAcc = acc;
    if (prevAcc) {
      const protection = evaluateCashAccountProtection(prevAcc, cashAccounts, cashTransactions);
      if (!protection.canChangeType) {
        safeAcc = {
          ...acc,
          type: prevAcc.type,
          isDefault: prevAcc.isDefault,
        };
      }
    }
    const next = cashAccounts.map((a) => (a.id === safeAcc.id ? safeAcc : a));
    setCashAccounts(next);
    try {
      localStorage.setItem("app_cash_accounts_cache", JSON.stringify(next));
    } catch {}
    writeAuditLog("UPDATE", "cash_accounts", safeAcc.id);
    markChanged("cash_accounts");
  };

  const deleteCashAccount = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    const targetAcc = cashAccounts.find((a) => a.id === id);
    if (!targetAcc) return;
    const protection = evaluateCashAccountProtection(targetAcc, cashAccounts, cashTransactions);
    if (!protection.canDelete) return;
    const { updatedAccounts, updatedTransactions, transactionsChanged } =
      cascadeCashAccountDelete({
        accountId: id,
        cashAccounts,
        cashTransactions,
      });
    setCashAccounts(updatedAccounts);
    try {
      localStorage.setItem("app_cash_accounts_cache", JSON.stringify(updatedAccounts));
    } catch {}
    if (transactionsChanged) {
      setCashTransactions(updatedTransactions);
      try {
        localStorage.setItem(
          "app_cash_transactions_cache",
          JSON.stringify(updatedTransactions)
        );
      } catch {}
    }
    writeAuditLog("DELETE", "cash_accounts", id);
    markChanged(
      ...(transactionsChanged
        ? ["cash_accounts", "cash_transactions"]
        : ["cash_accounts"])
    );
  };

  const addCashTransaction = (trx: Omit<CashTransaction, "id">) => {
    if (currentUser?.role === "OWNER") return "";
    const id = generateId();
    const cleanItems = Array.isArray(trx.items)
      ? trx.items.filter((it) => Number(it.totalPrice) > 0 || Number(it.unitPrice) > 0)
      : undefined;
    const itemsJson =
      cleanItems && cleanItems.length > 0
        ? JSON.stringify(cleanItems)
        : trx.itemsJson || null;
    const normalizedTrx: CashTransaction = {
      ...trx,
      type: normalizeCashTrxType(trx.type),
      amount: Math.round(Number(trx.amount) || 0),
      items: cleanItems && cleanItems.length > 0 ? cleanItems : undefined,
      itemsJson,
      id,
    };
    setCashTransactions((prev) => [...prev, normalizedTrx]);
    writeAuditLog("CREATE", "cash_transactions", id);
    markChanged("cash_transactions");
    return id;
  };

  const updateCashTransaction = (trx: CashTransaction) => {
    if (currentUser?.role === "OWNER") return;
    const cleanItems = Array.isArray(trx.items)
      ? trx.items.filter((it) => Number(it.totalPrice) > 0 || Number(it.unitPrice) > 0)
      : undefined;
    const itemsJson =
      cleanItems && cleanItems.length > 0
        ? JSON.stringify(cleanItems)
        : null;
    const normalizedTrx: CashTransaction = {
      ...trx,
      type: normalizeCashTrxType(trx.type),
      amount: Math.round(Number(trx.amount) || 0),
      items: cleanItems && cleanItems.length > 0 ? cleanItems : undefined,
      itemsJson,
    };
    setCashTransactions((prev) =>
      prev.map((t) => (t.id === trx.id ? normalizedTrx : t)),
    );
    writeAuditLog("UPDATE", "cash_transactions", trx.id);
    markChanged("cash_transactions");
  };

  const deleteCashTransaction = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    if (!cashTransactions.some((t) => t.id === id)) return;
    const linkedMovements = stockMovements.filter((m) => m.referenceId === id);
    setCashTransactions((prev) => prev.filter((t) => t.id !== id));
    writeAuditLog("DELETE", "cash_transactions", id);

    if (linkedMovements.length > 0) {
      const qtyToReverseByIng = new Map<string, number>();
      linkedMovements.forEach((m) => {
        const delta =
          m.type === "IN" || m.type === "RETURN"
            ? -Number(m.quantity || 0)
            : Number(m.quantity || 0);
        qtyToReverseByIng.set(
          m.ingredientId,
          (qtyToReverseByIng.get(m.ingredientId) || 0) + delta
        );
      });

      setStockMovements((prev) => prev.filter((m) => m.referenceId !== id));
      setIngredients((prev) =>
        prev.map((ing) => {
          const delta = qtyToReverseByIng.get(ing.id);
          if (!delta) return ing;
          return {
            ...ing,
            currentStock: Math.max(0, Number((ing.currentStock + delta).toFixed(4))),
          };
        })
      );
      markChanged("cash_transactions", "stock_movements", "ingredients");
      return;
    }

    markChanged("cash_transactions");
  };

  const addIngredient = (ing: Omit<Ingredient, "id">): string => {
    if (currentUser?.role === "OWNER") return "";
    const id = generateId();
    setIngredients((prev) => [...prev, { ...ing, id }]);
    writeAuditLog("CREATE", "ingredients", id);
    markChanged("ingredients");
    return id;
  };

  const updateIngredient = (ing: Ingredient) => {
    if (currentUser?.role === "OWNER") return;
    setIngredients((prev) => prev.map((i) => (i.id === ing.id ? ing : i)));
    writeAuditLog("UPDATE", "ingredients", ing.id);
    markChanged("ingredients");
  };

  const deleteIngredient = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    writeAuditLog("DELETE", "ingredients", id);
    markChanged("ingredients");
  };

  const addRecipe = (recipe: Omit<Recipe, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const id = generateId();
    setRecipes((prev) => [...prev, { ...recipe, id }]);
    writeAuditLog("CREATE", "recipes", id);
    markChanged("recipes");
  };

  const updateRecipe = (recipe: Recipe) => {
    if (currentUser?.role === "OWNER") return;
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
    writeAuditLog("UPDATE", "recipes", recipe.id);
    markChanged("recipes");
  };

  const deleteRecipe = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    writeAuditLog("DELETE", "recipes", id);
    markChanged("recipes");
  };

  const addProduct = (prod: Omit<Product, "id" | "createdAt">): string => {
    if (currentUser?.role === "OWNER") return "";
    const id = generateId();
    const newProduct: Product = {
      ...prod,
      id,
      variants: (prod.variants || []).map((v) => ({
        ...v,
        productId: v.productId || id,
      })),
      createdAt: new Date().toISOString(),
    };
    setProducts((prev) => [...prev, newProduct]);
    writeAuditLog("CREATE", "products", id);
    markChanged("products");
    return id;
  };

  const updateProduct = (prod: Product) => {
    if (currentUser?.role === "OWNER") return;
    setProducts((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...prod, updatedAt: new Date().toISOString() } : p))
    );
    writeAuditLog("UPDATE", "products", prod.id);
    markChanged("products");
  };

  const deleteProduct = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    writeAuditLog("DELETE", "products", id);
    markChanged("products");
  };

  const addBatchPreparation = (bp: Omit<BatchPreparation, "id">): string => {
    if (currentUser?.role === "OWNER") return "";
    const id = generateId();
    const newBp: BatchPreparation = { ...bp, id };
    setBatchPreparations((prev) => [...prev, newBp]);
    writeAuditLog("CREATE", "batch_preparations", id);
    markChanged("batch_preparations");
    return id;
  };

  const updateBatchPreparation = (bp: BatchPreparation) => {
    if (currentUser?.role === "OWNER") return;
    setBatchPreparations((prev) => prev.map((b) => (b.id === bp.id ? bp : b)));
    writeAuditLog("UPDATE", "batch_preparations", bp.id);
    markChanged("batch_preparations");
  };

  const deleteBatchPreparation = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setBatchPreparations((prev) => prev.filter((b) => b.id !== id));
    writeAuditLog("DELETE", "batch_preparations", id);
    markChanged("batch_preparations");
  };

  const executeBatchCook = (
    batchPrepId: string,
    multiplier: number = 1,
    notes?: string
  ): { success: boolean; message: string } => {
    if (currentUser?.role === "OWNER") {
      return {
        success: false,
        message:
          "Akun Owner berstatus Read-Only dan tidak dapat mengeksekusi produksi batch.",
      };
    }
    const bp = batchPreparations.find((b) => b.id === batchPrepId);
    if (!bp) {
      return { success: false, message: "Kondimen olahan tidak ditemukan." };
    }
    if (multiplier <= 0) {
      return { success: false, message: "Jumlah batch harus lebih dari 0." };
    }

    // 1. Cek kecukupan stok seluruh bahan mentah (diagregasi per ingredientId)
    const missingIngredients: string[] = [];
    let totalCostSpent = 0;
    const requiredByIngredient = aggregateBatchRequiredQuantities(bp.ingredients || [], multiplier);

    for (const [ingredientId, neededQty] of requiredByIngredient.entries()) {
      const ing = ingredients.find((i) => i.id === ingredientId);
      if (!ing) {
        missingIngredients.push(`Bahan dengan ID ${ingredientId} tidak ditemukan di inventori.`);
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
        totalCost: Math.round(ingCost * neededQty),
        date: nowIso,
        note: `Bahan Olahan Batch: ${bp.name} (${multiplier}x batch)${notes ? ` - ${notes}` : ""}`,
        createdBy: currentUser?.name || "Kitchen / Bar Staff",
      });
    });

    // 4. Tambah stok hasil kondimen (IN) & update unit valuation HPP
    if (targetIng) {
      const weightedAvgCost = computeBatchWeightedUnitCost(
        targetIng.currentStock,
        targetIng.costPerUnit || 0,
        yieldedQty,
        totalCostSpent
      );

      addStockMovement({
        ingredientId: targetIng.id,
        type: "IN",
        quantity: yieldedQty,
        unitCost: batchUnitCost,
        totalCost: Math.round(totalCostSpent),
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
        // Stok diisi oleh addStockMovement("IN", yieldedQty) di bawah agar tidak terhitung 2x
        currentStock: 0,
        minStock: Math.round(bp.yieldQuantity * 0.5),
        category: "Bahan Olahan",
        costPerUnit: batchUnitCost,
        storageLocation: resolveDivisionStorageLocation(bp.division),
      };
      setIngredients((prev) => [...prev, newIng]);
      writeAuditLog("CREATE", "ingredients", newIngId);

      addStockMovement({
        ingredientId: newIngId,
        type: "IN",
        quantity: yieldedQty,
        unitCost: batchUnitCost,
        totalCost: Math.round(totalCostSpent),
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
    markChanged("batch_preparations", "ingredients", "stock_movements");

    return {
      success: true,
      message: `Sukses memasak ${multiplier} batch "${bp.name}". Menghasilkan +${yieldedQty} ${bp.yieldUnit} dengan HPP Rp ${batchUnitCost.toLocaleString("id-ID")}/${bp.yieldUnit}.`,
    };
  };

  const addSupplier = (supplier: Omit<Supplier, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const id = generateId();
    setSuppliers((prev) => [...prev, { ...supplier, id }]);
    writeAuditLog("CREATE", "suppliers", id);
    markChanged("suppliers");
  };

  const updateSupplier = (supplier: Supplier) => {
    if (currentUser?.role === "OWNER") return;
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? supplier : s)),
    );
    writeAuditLog("UPDATE", "suppliers", supplier.id);
    markChanged("suppliers");
  };

  const deleteSupplier = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    writeAuditLog("DELETE", "suppliers", id);
    markChanged("suppliers");
  };

  const resolvePoItemFactor = (item: PurchaseOrderItem, ing?: Ingredient): number => {
    if (Number(item.conversionFactor) > 0) return Number(item.conversionFactor);
    if (item.unitMode === "PURCHASE" && Number(ing?.conversionFactor) > 0) {
      return Number(ing!.conversionFactor);
    }
    return 1;
  };

  const buildPoCashItems = (poItems: PurchaseOrderItem[]): CashTransactionItem[] =>
    poItems.map((item) => {
      const ing = ingredients.find((i) => i.id === item.productId);
      const factor = resolvePoItemFactor(item, ing);
      return {
        ingredientId: item.productId,
        unitMode: item.unitMode || (factor > 1 ? "CUSTOM" : "BASE"),
        conversionFactor: factor,
        name: ing?.name || "Bahan Baku",
        qty: Number(item.quantity || 1),
        unit: item.unit || ing?.unit || "pcs",
        unitPrice: Math.round(Number(item.unitPrice || 0)),
        totalPrice: Math.round(Number(item.subtotal || 0)),
      };
    });

  const applyPoItemsToInventoryAndHpp = (
    poItems: PurchaseOrderItem[],
    notePrefix: string,
    dateIso: string,
    creatorName: string,
    poReferenceId?: string
  ): boolean => {
    if (!Array.isArray(poItems) || poItems.length === 0) return false;

    const stockAddsByIngredientId = new Map<string, number>();
    const newMovements: StockMovement[] = [];

    poItems.forEach((item) => {
      const ing = ingredients.find((i) => i.id === item.productId);
      const factor = resolvePoItemFactor(item, ing);
      const baseQty = Number(item.quantity || 0) * factor;
      if (baseQty <= 0) return;

      stockAddsByIngredientId.set(
        item.productId,
        (stockAddsByIngredientId.get(item.productId) || 0) + baseQty
      );

      const mvId = generateId();
      const totalCost = Math.round(
        Number(item.subtotal) > 0
          ? Number(item.subtotal)
          : Number(item.quantity || 0) * Number(item.unitPrice || 0)
      );
      const rawLoc = String(ing?.storageLocation || "").toUpperCase();
      const movementLocation: "MAIN" | "BAR" | "KITCHEN" | "BAKERY" | "BAKER" | "FINANCE" =
        rawLoc === "BAR" || rawLoc === "CHILLER"
          ? "BAR"
          : rawLoc === "KITCHEN"
            ? "KITCHEN"
            : rawLoc === "BAKERY" || rawLoc === "BAKER"
              ? "BAKERY"
              : "MAIN";
      newMovements.push({
        id: mvId,
        ingredientId: item.productId,
        type: "IN",
        quantity: baseQty,
        unitCost: baseQty > 0 ? Math.round(totalCost / baseQty) : 0,
        totalCost,
        date: dateIso,
        note: `${notePrefix}${
          factor > 1
            ? ` (${item.quantity} ${item.unit || "kemasan"} = ${baseQty} ${ing?.unit || "unit"})`
            : ""
        }`,
        referenceId: poReferenceId || null,
        createdBy: creatorName,
        location: movementLocation,
      });
      writeAuditLog("CREATE", "stock_movements", mvId);
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...prev, ...newMovements]);
    }

    const hppSync = calculateCashFlowHppSync({
      itemRows: poItems.map((item) => {
        const ing = ingredients.find((i) => i.id === item.productId);
        const factor = resolvePoItemFactor(item, ing);
        return {
          ingredientId: item.productId,
          unitMode: item.unitMode || (factor > 1 ? "CUSTOM" : "BASE"),
          conversionFactor: factor,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.subtotal,
        };
      }),
      ingredients,
      batchPreparations,
      products,
      recipes,
      priceSyncMethod: "WEIGHTED_AVERAGE",
    });

    const syncedIngMap = new Map<string, Ingredient>();
    hppSync.directUpdates.forEach((upd) => syncedIngMap.set(upd.ingredient.id, upd.ingredient));
    hppSync.batchPrepUpdates.forEach((bUpd) => syncedIngMap.set(bUpd.ingredient.id, bUpd.ingredient));

    setIngredients((prev) =>
      prev.map((ing) => {
        const updatedIng = syncedIngMap.get(ing.id);
        const addedStock = stockAddsByIngredientId.get(ing.id) || 0;
        if (!updatedIng && addedStock === 0) return ing;
        const baseObj = updatedIng || ing;
        return {
          ...baseObj,
          currentStock: Number((ing.currentStock + addedStock).toFixed(4)),
        };
      })
    );

    if (hppSync.productsToUpdate.length > 0) {
      const updatedProdMap = new Map<string, Product>(
        hppSync.productsToUpdate.map((p) => [p.id, p])
      );
      setProducts((prev) => prev.map((p) => updatedProdMap.get(p.id) || p));
      return true;
    }

    return false;
  };

  const addPurchaseOrder = (po: Omit<PurchaseOrder, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const id = generateId();
    const roundedItems = (po.items || []).map((it) => ({
      ...it,
      unitPrice: Math.round(Number(it.unitPrice || 0)),
      subtotal: Math.round(Number(it.subtotal || 0)),
    }));
    const newPO: PurchaseOrder = {
      ...po,
      id,
      items: roundedItems,
      totalAmount: Math.round(Number(po.totalAmount || 0)),
      amountPaid:
        po.amountPaid !== undefined ? Math.round(Number(po.amountPaid)) : undefined,
    };
    const poDate = newPO.date || new Date().toISOString();
    setPurchaseOrders((prev) => [...prev, newPO]);
    writeAuditLog("CREATE", "purchase_orders", id);

    const dirty: string[] = ["purchase_orders"];
    let productsChanged = false;
    // Auto tambah stok (terkonversi ke satuan dasar) & sinkron HPP jika deliveryStatus === "RECEIVED"
    if (newPO.deliveryStatus === "RECEIVED") {
      productsChanged = applyPoItemsToInventoryAndHpp(
        newPO.items,
        `PO Masuk Stok: ${newPO.poNumber}`,
        poDate,
        currentUser?.name || "System",
        newPO.id
      );
      dirty.push("ingredients", "stock_movements");
      if (productsChanged) dirty.push("products");
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
          date: poDate,
          type: "CASH_OUT",
          amount: newPO.totalAmount,
          category: bahanBakuCat?.name || "Pembelian Bahan",
          categoryId: bahanBakuCat?.id || "cat-bahan-baku",
          description: `Pembelian PO: ${newPO.poNumber} (${newPO.supplierName || "Supplier"})`,
          vendorName: newPO.supplierName || null,
          receiptNo: newPO.poNumber,
          items: buildPoCashItems(newPO.items),
          referenceId: newPO.id,
        },
      ]);
      writeAuditLog("CREATE", "cash_transactions", cashTrxId);
      dirty.push("cash_transactions");
    }

    markChanged(...dirty);
  };

  const addDirectMarketPurchase = (data: {
    marketName: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    cashAccountId?: string;
    notes?: string;
  }): PurchaseOrder | null => {
    if (currentUser?.role === "OWNER") return null;
    const id = generateId();
    const periodCompact = getLocalPeriodString().replace("-", "");
    const poNumber = `MKT-${periodCompact}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowISO = new Date().toISOString();
    const roundedTotal = Math.round(Number(data.totalAmount || 0));
    const roundedItems = (data.items || []).map((it) => ({
      ...it,
      unitPrice: Math.round(Number(it.unitPrice || 0)),
      subtotal: Math.round(Number(it.subtotal || 0)),
    }));

    const newPO: PurchaseOrder = {
      id,
      poNumber,
      supplierId: "MARKET_DIRECT",
      supplierName: data.marketName || "Pasar Tradisional / Belanja Harian",
      purchaseType: "MARKET",
      cashAccountId: data.cashAccountId,
      notes: data.notes,
      date: nowISO,
      items: roundedItems,
      totalAmount: roundedTotal,
      status: "PAID",
      amountPaid: roundedTotal,
      paymentMethod: "CASH",
      deliveryStatus: "RECEIVED",
    };

    setPurchaseOrders((prev) => [...prev, newPO]);
    writeAuditLog("CREATE", "purchase_orders", id);

    // Auto tambahkan mutasi stok IN (konversi ke satuan dasar) & sinkron HPP
    const productsChanged = applyPoItemsToInventoryAndHpp(
      roundedItems,
      `Belanja Pasar: ${poNumber} (${data.marketName || "Eceran"})`,
      nowISO,
      currentUser?.name || "Kasir/Barista",
      id
    );

    const dirty: string[] = ["purchase_orders", "ingredients", "stock_movements"];
    if (productsChanged) dirty.push("products");

    // Auto catat kas keluar pada akun kas yang dipilih
    if (data.cashAccountId && roundedTotal > 0) {
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
          amount: roundedTotal,
          category: bahanBakuCat?.name || "Pembelian Bahan",
          categoryId: bahanBakuCat?.id || "cat-bahan-baku",
          description: `Belanja Pasar (${data.marketName || "Eceran"}): ${roundedItems.length} item bahan [${poNumber}]`,
          vendorName: newPO.supplierName || null,
          receiptNo: poNumber,
          items: buildPoCashItems(roundedItems),
          referenceId: id,
        },
      ]);
      writeAuditLog("CREATE", "cash_transactions", cashTrxId);
      dirty.push("cash_transactions");
    }

    markChanged(...dirty);
    return newPO;
  };

  const updatePOStatus = (id: string, status: "PAID" | "UNPAID" | "PARTIAL") => {
    if (currentUser?.role === "OWNER") return;
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status } : po)),
    );
    writeAuditLog("UPDATE", "purchase_orders", id);
    markChanged("purchase_orders");
  };

  const payPurchaseOrder = (
    id: string,
    amount: number,
    cashAccountId: string,
    notes?: string,
    date?: string,
  ) => {
    if (currentUser?.role === "OWNER") return;
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po || po.status === "PAID" || !cashAccountId) return;

    const roundedTotal = Math.max(0, Math.round(po.totalAmount || 0));
    const prevPaid = Math.max(0, Math.round(po.amountPaid || 0));
    const remaining = Math.max(0, roundedTotal - prevPaid);
    const effectiveAmount = Math.min(remaining, Math.max(0, Math.round(amount || 0)));
    if (effectiveAmount <= 0) return;

    const newAmountPaid = prevPaid + effectiveAmount;
    const isPaid = newAmountPaid >= roundedTotal;

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
      amount: effectiveAmount,
      category: bahanBakuCat?.name || "Pembelian Bahan",
      categoryId: bahanBakuCat?.id || "cat-bahan-baku",
      description: `Pelunasan Hutang PO ${po.poNumber} (${po.supplierName || "Supplier"})${notes ? ` - ${notes}` : ""}`,
      vendorName: po.supplierName || null,
      receiptNo: po.poNumber,
      items: prevPaid === 0 && isPaid ? buildPoCashItems(po.items) : undefined,
      referenceId: po.id,
    });

    writeAuditLog("UPDATE", "purchase_orders", id);
    markChanged("purchase_orders", "cash_transactions");
  };

  const markPOAsReceived = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po || po.deliveryStatus === "RECEIVED") return;

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deliveryStatus: "RECEIVED" } : p)),
    );
    writeAuditLog("UPDATE", "purchase_orders", id);

    // Auto add converted stock movements & sinkronkan harga modal + HPP menu saat barang PO tiba
    const productsChanged = applyPoItemsToInventoryAndHpp(
      po.items,
      `PO Diterima: ${po.poNumber}`,
      new Date().toISOString(),
      currentUser?.name || "System",
      po.id
    );

    if (productsChanged) {
      markChanged("purchase_orders", "ingredients", "stock_movements", "products");
    } else {
      markChanged("purchase_orders", "ingredients", "stock_movements");
    }
  };

  const deletePurchaseOrder = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    if (!purchaseOrders.some((p) => p.id === id)) return;
    const {
      updatedPurchaseOrders,
      updatedStockMovements,
      updatedIngredients,
      updatedCashTransactions,
      movementsChanged,
      ingredientsChanged,
      cashChanged,
    } = cascadePurchaseOrderDelete({
      poId: id,
      purchaseOrders,
      stockMovements,
      ingredients,
      cashTransactions,
    });
    setPurchaseOrders(updatedPurchaseOrders);
    if (movementsChanged) setStockMovements(updatedStockMovements);
    if (ingredientsChanged) {
      setIngredients(updatedIngredients);
      try {
        localStorage.setItem("app_ingredients_cache", JSON.stringify(updatedIngredients));
      } catch {}
    }
    if (cashChanged) {
      setCashTransactions(updatedCashTransactions);
      try {
        localStorage.setItem("app_cash_transactions_cache", JSON.stringify(updatedCashTransactions));
      } catch {}
    }
    writeAuditLog("DELETE", "purchase_orders", id);
    const dirty: string[] = ["purchase_orders"];
    if (movementsChanged) dirty.push("stock_movements");
    if (ingredientsChanged) dirty.push("ingredients");
    if (cashChanged) dirty.push("cash_transactions");
    markChanged(...dirty);
  };

  const openShift = (shift: Omit<ShiftSession, "id">) => {
    if (currentUser?.role === "OWNER") return;
    if (shifts.some((s) => s.status === "OPEN")) return;
    const id = generateId();
    const roundedShift: ShiftSession = {
      ...shift,
      id,
      startingCash: Math.round(Math.max(0, Number(shift.startingCash) || 0)),
    };
    setShifts((prev) => [...prev, roundedShift]);
    writeAuditLog("CREATE", "shifts", id);
    markChanged("shifts");
  };

  const closeShift = (
    id: string,
    actualEndingCash: number,
    expectedEndingCash: number,
  ) => {
    if (currentUser?.role === "OWNER") return;
    const targetShift = shifts.find((s) => s.id === id);
    if (!targetShift || targetShift.status === "CLOSED") return;
    const roundedActual = Math.round(Math.max(0, Number(actualEndingCash) || 0));
    const roundedExpected = Math.round(Number(expectedEndingCash) || 0);
    setShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === id) {
          return {
            ...shift,
            endTime: new Date().toISOString(),
            expectedEndingCash: roundedExpected,
            actualEndingCash: roundedActual,
            difference: roundedActual - roundedExpected,
            status: "CLOSED",
          };
        }
        return shift;
      }),
    );
    writeAuditLog("UPDATE", "shifts", id);
    markChanged("shifts");
  };

  const canManagePromotions =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER";

  const addPromotion = (promo: Omit<Promotion, "id" | "createdAt">) => {
    if (!canManagePromotions) return;
    const id = generateId();
    const newPromo: Promotion = {
      ...promo,
      name: String(promo.name || "").trim(),
      code: promo.code ? String(promo.code).trim().toUpperCase() : undefined,
      value: Math.max(0, Math.round(Number(promo.value) || 0)),
      minSpend: Math.max(0, Math.round(Number(promo.minSpend) || 0)),
      maxDiscount:
        promo.type === "PERCENT" && promo.maxDiscount !== undefined
          ? Math.max(0, Math.round(Number(promo.maxDiscount) || 0)) || undefined
          : undefined,
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
    markChanged("promotions");
  };

  const updatePromotion = (id: string, promoData: Partial<Promotion>) => {
    if (!canManagePromotions) return;
    setPromotions((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        const mergedType = promoData.type || p.type;
        return {
          ...p,
          ...promoData,
          name: promoData.name !== undefined ? String(promoData.name).trim() : p.name,
          code: promoData.code !== undefined ? (promoData.code ? String(promoData.code).trim().toUpperCase() : undefined) : p.code,
          value: promoData.value !== undefined ? Math.max(0, Math.round(Number(promoData.value) || 0)) : p.value,
          minSpend: promoData.minSpend !== undefined ? Math.max(0, Math.round(Number(promoData.minSpend) || 0)) : p.minSpend,
          maxDiscount:
            mergedType === "PERCENT"
              ? promoData.maxDiscount !== undefined
                ? Math.max(0, Math.round(Number(promoData.maxDiscount) || 0)) || undefined
                : p.maxDiscount
              : undefined,
        };
      });
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("UPDATE", "promotions", id);
    markChanged("promotions");
  };

  const deletePromotion = (id: string) => {
    if (!canManagePromotions) return;
    setPromotions((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("DELETE", "promotions", id);
    markChanged("promotions");
  };

  const togglePromotionStatus = (id: string) => {
    if (!canManagePromotions) return;
    setPromotions((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p));
      try {
        localStorage.setItem("coffee_promotions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    writeAuditLog("UPDATE", "promotions", id);
    markChanged("promotions");
  };

  const addStockMovement = (mov: Omit<StockMovement, "id">) => {
    if (currentUser?.role === "OWNER") return;
    const normalizedMov: StockMovement = {
      ...mov,
      id: generateId(),
      unitCost: mov.unitCost !== undefined ? Math.round(Number(mov.unitCost) || 0) : undefined,
      totalCost: mov.totalCost !== undefined ? Math.round(Number(mov.totalCost) || 0) : undefined,
    };
    setStockMovements((prev) => [...prev, normalizedMov]);

    // Update current stock automatically based on movement type
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === mov.ingredientId) {
          let newStock = ing.currentStock;
          if (mov.type === "IN" || mov.type === "RETURN") {
            newStock += mov.quantity;
          } else if (mov.type === "OUT" || mov.type === "WASTE" || (mov.type as any) === "USAGE") {
            newStock -= mov.quantity;
          } else if (mov.type === "ADJUSTMENT") {
            newStock = mov.quantity;
          }
          return { ...ing, currentStock: Math.max(0, Number(newStock.toFixed(4))) };
        }
        return ing;
      }),
    );
    markChanged("stock_movements", "ingredients");
  };

  const addSalesTransactions = (
    transactions: Omit<SalesTransaction, "id">[],
    fileName: string = "Import Penjualan Excel",
    targetCashAccountId?: string
  ) => {
    if (currentUser?.role === "OWNER" || !transactions || transactions.length === 0) {
      return { count: 0, cashSyncedAmount: 0, stockDeductedCount: 0 };
    }
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

    const changedDomains: string[] = ["sales_transactions", "sales_import_logs"];

    // 1. Sinkronkan ke Arus Kas per tanggal (cegah duplikasi bila tanggal tsb sudah punya rekap/POS cash-in)
    const toDateKey = (raw: string | undefined | null): string => {
      const s = String(raw || "").trim();
      if (!s) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const parsed = new Date(s);
      return Number.isNaN(parsed.getTime()) ? s.slice(0, 10) : getLocalDateString(parsed);
    };

    const revenueByDate = new Map<string, number>();
    newTxs.forEach((tx) => {
      const dayKey = toDateKey(tx.date);
      if (!dayKey) return;
      const amt = Math.max(0, getSaleTransactionAmount(tx));
      if (amt > 0) {
        revenueByDate.set(dayKey, (revenueByDate.get(dayKey) || 0) + amt);
      }
    });

    const existingRecapDates = new Set(
      dailySalesRecaps.map((r) => toDateKey(r.date)).filter(Boolean)
    );
    const existingCashSalesDates = new Set(
      cashTransactions
        .filter((c) => isSalesCashTransaction(c, expenseCategories))
        .map((c) => toDateKey(c.date))
        .filter(Boolean)
    );

    const targetAccount =
      (targetCashAccountId && cashAccounts.find((a) => a.id === targetCashAccountId)) ||
      cashAccounts.find((a) => a.isDefault) ||
      cashAccounts.find((a) => a.type === "CASH") ||
      cashAccounts[0];

    const closedSet = new Set(closedPeriods.map((p) => p.period));
    let cashSyncedAmount = 0;
    const cashEntriesToAdd: CashTransaction[] = [];
    if (targetAccount && revenueByDate.size > 0) {
      revenueByDate.forEach((dayAmount, dayKey) => {
        if (closedSet.has(dayKey.slice(0, 7))) return;
        if (!existingRecapDates.has(dayKey) && !existingCashSalesDates.has(dayKey)) {
          const roundedAmt = Math.round(dayAmount);
          cashSyncedAmount += roundedAmt;
          cashEntriesToAdd.push({
            id: generateId(),
            accountId: targetAccount.id,
            type: "CASH_IN",
            amount: roundedAmt,
            category: "Penjualan Menu & Kasir",
            categoryId: "cat-penjualan",
            description: `Omzet Penjualan (${fileName} • ${dayKey})`,
            date: dayKey,
            referenceId: `sales-log-${logId}-${dayKey}`,
            createdBy: currentUser?.name || "Finance",
          });
        }
      });
    }

    if (cashEntriesToAdd.length > 0) {
      setCashTransactions((prev) => [...prev, ...cashEntriesToAdd]);
      changedDomains.push("cash_transactions");
    }

    // 2. Potong stok bahan baku otomatis sesuai resep produk HANYA jika diaktifkan eksplisit
    let stockDeductedCount = 0;
    if (settings.autoDeductStockOnSale === true) {
      const usageByIng = new Map<string, { qty: number; menus: Set<string> }>();
      newTxs.forEach((tx) => {
        const qtySold = Number(tx.quantitySold) || 0;
        if (qtySold <= 0 || !tx.menuName) return;
        const usages = resolveOrderItemIngredients(
          { menuName: tx.menuName, quantity: qtySold },
          recipes,
          products,
          ingredients
        );
        usages.forEach((u) => {
          if (!u.ingredientId || u.totalQuantity <= 0) return;
          const cur = usageByIng.get(u.ingredientId) || { qty: 0, menus: new Set<string>() };
          cur.qty += u.totalQuantity;
          cur.menus.add(tx.menuName);
          usageByIng.set(u.ingredientId, cur);
        });
      });

      if (usageByIng.size > 0) {
        const nowIso = new Date().toISOString();
        const movementsToAdd: StockMovement[] = [];
        usageByIng.forEach((info, ingId) => {
          const ing = ingredients.find((i) => i.id === ingId);
          if (!ing) return;
          stockDeductedCount++;
          const sampleMenus = Array.from(info.menus).slice(0, 3).join(", ");
          const rawLoc = String(ing.storageLocation || "").toUpperCase();
          const movementLocation: "MAIN" | "BAR" | "KITCHEN" | "BAKERY" | "BAKER" | "FINANCE" =
            rawLoc === "BAR" || rawLoc === "CHILLER"
              ? "BAR"
              : rawLoc === "KITCHEN"
                ? "KITCHEN"
                : rawLoc === "BAKERY" || rawLoc === "BAKER"
                  ? "BAKERY"
                  : "MAIN";
          movementsToAdd.push({
            id: generateId(),
            ingredientId: ingId,
            type: "OUT",
            quantity: Number(info.qty.toFixed(4)),
            unitCost: ing.costPerUnit || 0,
            totalCost: Math.round((ing.costPerUnit || 0) * info.qty),
            date: nowIso,
            note: `Penjualan (${fileName}): ${sampleMenus}${info.menus.size > 3 ? ", ..." : ""}`,
            createdBy: currentUser?.name || "System Import",
            location: movementLocation,
          });
        });

        if (movementsToAdd.length > 0) {
          setStockMovements((prev) => [...prev, ...movementsToAdd]);
          setIngredients((prev) =>
            prev.map((ing) => {
              const info = usageByIng.get(ing.id);
              if (!info) return ing;
              return {
                ...ing,
                currentStock: Math.max(0, Number((ing.currentStock - info.qty).toFixed(4))),
              };
            })
          );
          changedDomains.push("ingredients", "stock_movements");
        }
      }
    }

    writeAuditLog("CREATE", "sales_transactions", logId);
    markChanged(...changedDomains);
    return { count: newTxs.length, cashSyncedAmount, stockDeductedCount };
  };

  const isRecapCashRef = (ref: string | null | undefined, recapId: string): boolean => {
    if (!ref) return false;
    return (
      ref === recapId ||
      ref === `recap-cash:${recapId}` ||
      ref === `recap-noncash:${recapId}` ||
      ref === `recap-mdr:${recapId}`
    );
  };

  const buildRecapCashTransactions = (recap: DailySalesRecap): CashTransaction[] => {
    const entries: CashTransaction[] = [];
    const cashAcc =
      (recap.cashAccountId && cashAccounts.find((a) => a.id === recap.cashAccountId)) ||
      cashAccounts.find((a) => a.type === "CASH") ||
      cashAccounts[0];
    const bankAcc =
      (recap.bankAccountId && cashAccounts.find((a) => a.id === recap.bankAccountId)) ||
      cashAccounts.find((a) => a.type === "BANK") ||
      cashAccounts[0];
    const actor = recap.recordedBy || currentUser?.name || "Finance";

    const cashAmt = Math.round(Number(recap.cashAmount) || 0);
    if (cashAmt > 0 && cashAcc) {
      entries.push({
        id: generateId(),
        accountId: cashAcc.id,
        type: "CASH_IN",
        amount: cashAmt,
        category: "Penjualan Menu & Kasir",
        categoryId: "cat-penjualan",
        description: `Omzet Penjualan Tunai (${recap.date})${recap.notes ? ` - ${recap.notes}` : ""}`,
        date: recap.date,
        referenceId: `recap-cash:${recap.id}`,
        paymentMethod: "Tunai",
        createdBy: actor,
      });
    }

    const qris = Math.round(Number(recap.qrisAmount) || 0);
    const edc = Math.round(Number(recap.edcAmount) || 0);
    const transfer = Math.round(Number(recap.transferAmount) || 0);
    const online = Math.round(Number(recap.onlineDeliveryAmount) || 0);
    const nonCashTotal = qris + edc + transfer + online;
    const settlementStatus = recap.nonCashSettlementStatus || "SETTLED";

    if (nonCashTotal > 0 && bankAcc && settlementStatus === "SETTLED") {
      const parts = [
        qris > 0 ? `QRIS: ${qris.toLocaleString("id-ID")}` : null,
        edc > 0 ? `EDC: ${edc.toLocaleString("id-ID")}` : null,
        transfer > 0 ? `Transfer: ${transfer.toLocaleString("id-ID")}` : null,
        online > 0 ? `Ojol: ${online.toLocaleString("id-ID")}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      const settleDate = recap.nonCashSettledAt || recap.date;

      entries.push({
        id: generateId(),
        accountId: bankAcc.id,
        type: "CASH_IN",
        amount: nonCashTotal,
        category: "Penjualan Menu & Kasir",
        categoryId: "cat-penjualan",
        description: `Omzet Non-Tunai (${parts}) - ${recap.date}`,
        date: settleDate,
        referenceId: `recap-noncash:${recap.id}`,
        paymentMethod: "Non-Tunai / Bank",
        createdBy: actor,
      });

      const mdrFee = Math.round(Number(recap.mdrFeeAmount) || 0);
      if (mdrFee > 0) {
        entries.push({
          id: generateId(),
          accountId: bankAcc.id,
          type: "CASH_OUT",
          amount: mdrFee,
          category: "Biaya Admin Bank & Pajak",
          categoryId: "cat-admin-bank",
          description: `Biaya MDR / Admin Non-Tunai (${recap.date})`,
          date: settleDate,
          referenceId: `recap-mdr:${recap.id}`,
          paymentMethod: "Potongan Bank / MDR",
          createdBy: actor,
        });
      }
    }

    return entries;
  };

  const persistDailySalesRecaps = (updater: (prev: DailySalesRecap[]) => DailySalesRecap[]) => {
    setDailySalesRecaps((prev) => {
      const updated = updater(prev);
      try {
        localStorage.setItem("app_daily_sales_recaps", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addDailySalesRecap = (recap: Omit<DailySalesRecap, "id" | "createdAt">) => {
    if (currentUser?.role === "OWNER") return;
    const newId = generateId();
    const newRecord: DailySalesRecap = {
      ...recap,
      cashAmount: Math.round(Number(recap.cashAmount) || 0),
      qrisAmount: Math.round(Number(recap.qrisAmount) || 0),
      edcAmount: Math.round(Number(recap.edcAmount) || 0),
      transferAmount: Math.round(Number(recap.transferAmount) || 0),
      onlineDeliveryAmount: Math.round(Number(recap.onlineDeliveryAmount) || 0),
      discountAmount: Math.round(Number(recap.discountAmount) || 0),
      refundAmount: Math.round(Number(recap.refundAmount) || 0),
      mdrFeeAmount: Math.round(Number(recap.mdrFeeAmount) || 0),
      totalAmount: Math.round(Number(recap.totalAmount) || 0),
      id: newId,
      createdAt: new Date().toISOString(),
    };
    persistDailySalesRecaps((prev) => [newRecord, ...prev]);

    const generatedCash = buildRecapCashTransactions(newRecord);
    if (generatedCash.length > 0) {
      setCashTransactions((prev) => [...prev, ...generatedCash]);
    }
    writeAuditLog("CREATE", "daily_sales_recap", newId);
    markChanged("cash_transactions", "daily_sales_recaps");
  };

  const updateDailySalesRecap = (recap: DailySalesRecap) => {
    if (currentUser?.role === "OWNER") return;
    const normalized: DailySalesRecap = {
      ...recap,
      cashAmount: Math.round(Number(recap.cashAmount) || 0),
      qrisAmount: Math.round(Number(recap.qrisAmount) || 0),
      edcAmount: Math.round(Number(recap.edcAmount) || 0),
      transferAmount: Math.round(Number(recap.transferAmount) || 0),
      onlineDeliveryAmount: Math.round(Number(recap.onlineDeliveryAmount) || 0),
      discountAmount: Math.round(Number(recap.discountAmount) || 0),
      refundAmount: Math.round(Number(recap.refundAmount) || 0),
      mdrFeeAmount: Math.round(Number(recap.mdrFeeAmount) || 0),
      totalAmount: Math.round(Number(recap.totalAmount) || 0),
    };
    persistDailySalesRecaps((prev) =>
      prev.map((r) => (r.id === normalized.id ? normalized : r))
    );
    const regenerated = buildRecapCashTransactions(normalized);
    setCashTransactions((prev) => [
      ...prev.filter((t) => !isRecapCashRef(t.referenceId, normalized.id)),
      ...regenerated,
    ]);
    writeAuditLog("UPDATE", "daily_sales_recap", normalized.id);
    markChanged("cash_transactions", "daily_sales_recaps");
  };

  const settleDailySalesRecapNonCash = (
    id: string,
    opts?: { bankAccountId?: string; mdrFeeAmount?: number; settledDate?: string }
  ) => {
    if (currentUser?.role === "OWNER") return;
    const target = dailySalesRecaps.find((r) => r.id === id);
    if (!target) return;
    const updated: DailySalesRecap = {
      ...target,
      bankAccountId: opts?.bankAccountId || target.bankAccountId || null,
      mdrFeeAmount:
        opts?.mdrFeeAmount !== undefined
          ? Math.round(Number(opts.mdrFeeAmount) || 0)
          : target.mdrFeeAmount,
      nonCashSettlementStatus: "SETTLED",
      nonCashSettledAt: opts?.settledDate || getLocalDateString(),
    };
    updateDailySalesRecap(updated);
  };

  const deleteDailySalesRecap = (id: string) => {
    if (currentUser?.role === "OWNER") return;
    if (!dailySalesRecaps.some((r) => r.id === id)) return;
    persistDailySalesRecaps((prev) => prev.filter((r) => r.id !== id));
    setCashTransactions((prev) => prev.filter((t) => !isRecapCashRef(t.referenceId, id)));
    writeAuditLog("DELETE", "daily_sales_recap", id);
    markChanged("cash_transactions", "daily_sales_recaps");
  };

  const syncMissingSalesToCashFlow = (targetAccountId?: string) => {
    if (currentUser?.role === "OWNER") {
      return { syncedCount: 0, syncedAmount: 0, skippedClosedCount: 0 };
    }
    const summary = computePeriodFinancialSummary({
      period: "ALL",
      salesTransactions,
      dailySalesRecaps,
      cashTransactions,
      expenseCategories,
      recipes,
      ingredients,
      products,
    });
    const targetAcc =
      (targetAccountId && cashAccounts.find((a) => a.id === targetAccountId)) ||
      cashAccounts.find((a) => a.isDefault) ||
      cashAccounts.find((a) => a.type === "CASH") ||
      cashAccounts[0];
    if (!targetAcc) return { syncedCount: 0, syncedAmount: 0, skippedClosedCount: 0 };

    const closedSet = new Set(closedPeriods.map((p) => p.period));
    const toCreate: CashTransaction[] = [];
    let syncedAmount = 0;
    let skippedClosedCount = 0;

    summary.dailyBreakdown.forEach((day) => {
      const gap = Math.round(
        day.recognizedRevenue - day.cashSalesInflow - day.pendingNonCash
      );
      if (gap > 0) {
        if (closedSet.has(day.date.slice(0, 7))) {
          skippedClosedCount++;
          return;
        }
        syncedAmount += gap;
        toCreate.push({
          id: generateId(),
          accountId: targetAcc.id,
          type: "CASH_IN",
          amount: gap,
          category: "Penjualan Menu & Kasir",
          categoryId: "cat-penjualan",
          description: `Sinkronisasi Omzet Penjualan (${day.date})`,
          date: day.date,
          referenceId: `sync-sales-${day.date}`,
          createdBy: currentUser?.name || "System Sync",
        });
      }
    });

    if (toCreate.length > 0) {
      setCashTransactions((prev) => [...prev, ...toCreate]);
      writeAuditLog("CREATE", "cash_transactions", `sync-sales-${toCreate.length}`);
      markChanged("cash_transactions");
    }
    return { syncedCount: toCreate.length, syncedAmount, skippedClosedCount };
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
        updateDailySalesRecap,
        settleDailySalesRecapNonCash,
        deleteDailySalesRecap,
        syncMissingSalesToCashFlow,
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
        lastLoginError,
        unsuspendUser,
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
        clearLocalCachesAndReload,
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
        restoreDefaultExpenseCategories: () => {
          if (currentUser?.role === "OWNER") return 0;
          const existingIds = new Set(expenseCategories.map((c) => c.id));
          const missingCount = DEFAULT_EXPENSE_CATEGORIES.filter((d) => !existingIds.has(d.id)).length;
          dispatch({ type: "RESTORE_DEFAULT_EXPENSE_CATEGORIES" });
          return missingCount;
        },
        restoreMissingCashPositions: () => {
          if (currentUser?.role === "OWNER") {
            return { addedAccountCount: 0, addedCategoryCount: 0 };
          }
          const existingCatIds = new Set(expenseCategories.map((c) => c.id));
          const missingDefaults = DEFAULT_EXPENSE_CATEGORIES.filter((d) => !existingCatIds.has(d.id));
          const baseCats = [...expenseCategories, ...missingDefaults];
          const recovery = recoverOrphanCashAccountsAndCategories({
            cashAccounts,
            cashTransactions,
            expenseCategories: baseCats,
          });
          if (recovery.addedAccounts.length > 0) {
            setCashAccounts(recovery.recoveredAccounts);
            markChanged("cash_accounts");
          }
          if (recovery.addedCategories.length > 0 || missingDefaults.length > 0) {
            setExpenseCategories(recovery.recoveredCategories);
            markChanged("expense_categories");
          }
          return {
            addedAccountCount: recovery.addedAccountCount,
            addedCategoryCount: recovery.addedCategoryCount + missingDefaults.length,
          };
        },
        budgets,
        addBudget: (b: Budget) => dispatch({ type: "ADD_BUDGET", payload: b }),
        updateBudget: (b: Budget) => dispatch({ type: "UPDATE_BUDGET", payload: b }),
        deleteBudget: (id: string) => dispatch({ type: "DELETE_BUDGET", payload: id }),
        bankReconciliations,
        addBankReconciliation: (r: BankReconciliation) => dispatch({ type: "ADD_BANK_RECONCILIATION", payload: r }),
        updateBankReconciliation: (r: BankReconciliation) => dispatch({ type: "UPDATE_BANK_RECONCILIATION", payload: r }),
        deleteBankReconciliation: (id: string) => dispatch({ type: "DELETE_BANK_RECONCILIATION", payload: id }),
        bankStatementLines,
        addBankStatementLine: (l: BankStatementLine) => dispatch({ type: "ADD_BANK_STATEMENT_LINE", payload: l }),
        updateBankStatementLine: (l: BankStatementLine) => dispatch({ type: "UPDATE_BANK_STATEMENT_LINE", payload: l }),
        bulkAddBankStatementLines: (lines: BankStatementLine[]) => dispatch({ type: "BULK_ADD_BANK_STATEMENT_LINES", payload: lines }),
        replaceBankReconLines: (reconciliationId: string, lines: BankStatementLine[]) =>
          dispatch({ type: "REPLACE_BANK_RECON_LINES", payload: { reconciliationId, lines } }),
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
        closePeriod: (
          period: string,
          user: string,
          notes?: string,
          snapshot?: ClosedPeriodSnapshot | null
        ) => dispatch({ type: "CLOSE_PERIOD", payload: { period, user, notes, snapshot } }),
        reopenPeriod: (period: string, notes?: string) => dispatch({ type: "REOPEN_PERIOD", payload: { period, notes } }),
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

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
