// System Test Suite - Julia's Coffee Management POS & ERP
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  BUILTIN_DEFAULT_LOGOS,
  DEFAULT_BRAND_LOGO_SETTING,
  isCustomBrandLogo,
  resolveBrandLogo,
  resolveThemeLogo,
  withBrandLogoVersion,
} from "../src/utils/brandLogo";
import {
  isCoreExpenseCategory,
  sanitizeCoreExpenseCategoryUpdate,
  protectCoreExpenseCategoriesOnSync,
  isProtectedIngredientCategory,
  validateIngredientCategoryRename,
  evaluateCashAccountProtection,
  protectCashAccountsOnSync,
} from "../src/utils/systemGuards";
import {
  resolveEffectivePaymentAccountMapping,
  resolveRecapChannelAllocations,
} from "../src/utils/paymentRouting";
import {
  DEFAULT_STORE_TIMEZONE,
  getLocalDateString,
  getLocalPeriodString,
  getLocalDayUtcBounds,
  isTimestampOnLocalDate,
} from "../src/utils/dateUtils";
import {
  resolveOrderItemIngredients,
  calculateShiftStats,
  calculateTodayOrderSummary,
  resolvePaymentAccountId,
  isAutoPosSaleCashIn,
  calculateCashFlowHppSync,
  getIngredientPackagingChoices,
  getPackagingSelectValue,
  resolveIngredientPackagingFromText,
  parseSmartCoffeeTextEntry,
  computeSplitItemsTotals,
} from "../src/utils/posDomainLogic";
import {
  getPreviousPeriodString,
  computeAutoOverheadBaseline,
  calculateHppOverheadSimulation,
  calculateFnbHealthMetrics,
  computePeriodicOpnameCogs,
  computeCashLiquidityBreakdown,
  computeOwnerProfitAllocation,
  computePeriodSavingsFlow,
  computePeriodFinancialSummary,
  normalizeProfitSharePercentages,
  isCapexCashTransaction,
  isAdminBankOrMdrTransaction,
  isNonOperationalCashTransaction,
  buildIngredientCategoryList,
  filterIngredientCategoriesByDivision,
  resolveIngredientCategoryDivision,
  applyRenameIngredientCategory,
  applyDeleteIngredientCategory,
  cascadeExpenseCategoryUpdate,
  cascadeExpenseCategoryDelete,
  cascadeCashAccountDelete,
  cascadePurchaseOrderDelete,
  recoverOrphanCashAccountsAndCategories,
  resolveBankStatementType,
  matchBankStatementLines,
  parseBankStatementAmount,
  parseBankStatementCsv,
} from "../src/utils/financeMetrics";
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
  recomputeOpnameItemsWithLiveStock,
  computeMovementActualQuantityAndCost,
  convertStockInputOnUnitToggle,
  validateRecipeSubmission,
  resolveDefaultTransferStation,
  resolveDivisionStorageLocation,
  mergeDuplicateRecipeIngredients,
  parseRecipeIngredientsSafe,
  splitRecipeItemsAndPackaging,
  computeSignedMarginMetrics,
  recalculateVariantFromLiveIngredients,
  validateBatchPrepSubmission,
  getLocalPeriodFromTimestamp,
  addDaysToLocalDate,
  computeDueDateStatus,
  validateSupplierSubmission,
  validatePoCheckoutInput,
  validatePoPaymentInput,
  extractWitaHour,
  aggregatePosOrderTopItems,
  validateDailySalesRecapSubmission,
  validateCashDepositSubmission,
  filterExpenseCategoryTree,
  parseImportedExpenseCategories,
  computeBudgetVsActual,
  validateCashPeriodAccess,
  resolveCategoryMatchForImport,
  computePayrollCategoryBreakdown,
  validatePayrollMutation,
  computeShiftExpectedCash,
  mergeOfflinePayrollPreservingPaid,
  getPromotionRuntimeStatus,
  validatePromotionInput,
  computePromotionDiscountPreview,
  computeOwnerCategoryContribution,
  computePeriodGrowthPercent,
  getWitaWeekStartDate,
  evaluateApiAccess,
  isValidKitchenStatus,
  evaluateSessionHeartbeat,
  evaluateGenericTableAccess,
  aggregateBatchRequiredQuantities,
  computeBatchWeightedUnitCost,
  resolveCappedRefundAmount,
  validatePosOrderPayload,
  validateEvenlySplitAmount,
  validateApprovalRequestInput,
  mergePreservingProtectedRows,
  protectSuperAdminAccountsOnSync,
  protectClosedPeriodsOnSync,
  enforceClosedPeriodDataLock,
} from "../src/utils/syncSanitizers";
import {
  CORE_EXPENSE_CATEGORY_IDS,
  parseCleaningGroups,
  shouldAutoSeedDummyData,
  validateClientSetupPayload,
  buildCleaningSummary,
  findUnlinkedStaffUsers,
  buildEmployeeDraftFromUser,
} from "../src/utils/dataCleaning";
import {
  buildEscPosReceipt,
  buildCashDrawerKickCommand,
} from "../src/utils/escpos";
import {
  formatWhatsAppPhoneNumber,
  buildWhatsAppReceiptText,
  buildWhatsAppReceiptUrl,
} from "../src/utils/whatsappReceipt";
import {
  exportSinglePayslipPDF,
  filterByDateRange,
  formatDateIndo,
  formatStockMovementTypeLabel,
} from "../src/utils/export";
import {
  normalizeTextCode,
  parseLocalizedNumber,
  parseFlexibleDateYmd,
  matchAndNormalizeImportRows,
} from "../src/utils/genericImport";
import {
  buildMenuImportPlan,
  parseOpnamePhysicalSheetRows,
  parseDailySalesRecapImportRows,
  groupImportedPurchaseOrders,
  buildRecipeImportPlan,
} from "../src/utils/importHelpers";
import {
  AttendanceRecord,
  Budget,
  CashTransaction,
  CashAccount,
  DailyAttendance,
  DailySalesRecap,
  Employee,
  ExpenseCategory,
  PayrollRecord,
  Promotion,
  Recipe,
  Ingredient,
  BatchPreparation,
  Product,
  PurchaseOrder,
  SalesTransaction,
  StockMovement,
  Supplier,
  User,
} from "../src/types";
import {
  buildAttendanceCorrectionUpdate,
  calculateWorkDurationHours,
  classifyDailyAttendanceStatus,
  computeMonthlyAttendanceRecap,
  evaluateClockInLateness,
  formatWitaTimeHm,
  getWitaTimeMinutes,
  resolveCanonicalEmployeeId,
  syncAttendanceRecordsWithDaily,
} from "../src/utils/attendanceRecap";
import {
  resolveProductAndVariant,
  inferProductGroup,
  formatCatalogMenuVariantLabel,
  computeProductSalesAnalytics,
  computePhysicalStockOutByIngredient,
  calculateVariantUnitHpp,
  getDivisionMenuCategories,
  applyRenameMenuCategory,
  applyDeleteMenuCategory,
} from "../src/utils/productSalesAnalytics";
import { mapSalesRows, parseDateToIso } from "../src/utils/salesImportMapper";

console.log("=========================================================");
console.log("   TESTING & SYSTEM AUDIT SUITE: JULIA'S COFFEE ERP/POS   ");
console.log("=========================================================\n");

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${description}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${description}`);
    console.error(`         Error: ${err.message}`);
    console.error(`         Stack: ${err.stack}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. FINANCIAL & MONEY ROUNDING TESTS (IDR Integer Currency)
// -------------------------------------------------------------
console.log("1. Pengujian Modul Keuangan & Pembulatan Rupiah:");

test("Perhitungan Diskon Kasir & Plafon Maksimum", () => {
  const subtotal = 150000;
  const maxDiscountAllowed = 10; // 10%
  const requestedDiscountPercent = 15; // 15% -> melebihi plafon

  const requiresSupervisorApproval = requestedDiscountPercent > maxDiscountAllowed;
  assert.strictEqual(requiresSupervisorApproval, true, "Diskon > 10% wajib minta otorisasi supervisor");

  const discountAmount = Math.round((subtotal * requestedDiscountPercent) / 100);
  assert.strictEqual(discountAmount, 22500);
  assert.strictEqual(Number.isInteger(discountAmount), true, "Diskon Rupiah harus integer murni");
});

test("Perhitungan Pajak PB1 Mode Eksklusif (Subtotal + Pajak = Total)", () => {
  const subtotal = 100000;
  const discountAmount = 10000;
  const taxableAmount = subtotal - discountAmount; // 90.000
  const taxRate = 10; // 10%
  const taxAmount = Math.round((taxableAmount * taxRate) / 100); // 9.000
  const totalAmount = taxableAmount + taxAmount; // 99.000

  assert.strictEqual(taxableAmount, 90000);
  assert.strictEqual(taxAmount, 9000);
  assert.strictEqual(totalAmount, 99000);
  assert.strictEqual(Number.isInteger(totalAmount), true);
});

test("Perhitungan Pajak PB1 Mode Inklusif (Harga Menu Sudah Termasuk Pajak)", () => {
  const totalPaid = 110000; // Harga kotor
  const taxRate = 10;
  // Pajak = totalPaid * taxRate / (100 + taxRate) = 110.000 * 10 / 110 = 10.000
  const taxAmount = Math.round((totalPaid * taxRate) / (100 + taxRate));
  const netSales = totalPaid - taxAmount; // 100.000 DPP

  assert.strictEqual(taxAmount, 10000);
  assert.strictEqual(netSales, 100000);
});

// -------------------------------------------------------------
// 2. CASH FLOW & REKONSILIASI TUTUP SHIFT KASIR
// -------------------------------------------------------------
console.log("\n2. Pengujian Rekonsiliasi Tutup Shift & Cash Flow:");

test("Formula Kas Diharapkan di Laci Kasir (Termasuk Cash Drop & Petty Cash)", () => {
  const initialFloat = 200000; // Modal awal di laci
  const cashSalesTotal = 1500000; // Total penjualan tunai
  const cashDropToSafe = 1000000; // Setoran kas tengah shift ke brankas
  const pettyCashExpense = 50000; // Pengeluaran kas kecil (beli es batu darurat)

  const expectedCashInDrawer = initialFloat + cashSalesTotal - cashDropToSafe - pettyCashExpense;
  assert.strictEqual(expectedCashInDrawer, 650000, "Kas di laci harus tepat Rp 650.000");

  // Kasir menghitung fisik laci saat tutup shift:
  const actualCountedCash1 = 650000;
  const discrepancy1 = actualCountedCash1 - expectedCashInDrawer;
  assert.strictEqual(discrepancy1, 0, "Shift seimbang sempurna (Balance)");

  // Skenario minus (kekurangan uang kas):
  const actualCountedCash2 = 620000;
  const discrepancy2 = actualCountedCash2 - expectedCashInDrawer;
  assert.strictEqual(discrepancy2, -30000, "Selisih minus Rp 30.000 harus tercatat di log audit");

  // Skenario surplus (kelebihan uang kas):
  const actualCountedCash3 = 660000;
  const discrepancy3 = actualCountedCash3 - expectedCashInDrawer;
  assert.strictEqual(discrepancy3, 10000, "Selisih surplus Rp 10.000 harus tercatat di log audit");
});

test("Normalisasi Tipe Mutasi Kas (Standardisasi CASH_IN / CASH_OUT)", () => {
  const rawTypes = ["CASH_OUT", "OUT", "EXPENSE", "CASH_IN", "IN", "INCOME"];
  const normalized = rawTypes.map((t) => {
    if (t === "OUT" || t === "EXPENSE" || t === "CASH_OUT") return "CASH_OUT";
    return "CASH_IN";
  });

  assert.deepStrictEqual(normalized, [
    "CASH_OUT",
    "CASH_OUT",
    "CASH_OUT",
    "CASH_IN",
    "CASH_IN",
    "CASH_IN",
  ]);
});

// -------------------------------------------------------------
// 3. INVENTORY & RECIPE DEDUCTION LOGIC
// -------------------------------------------------------------
console.log("\n3. Pengujian Manajemen Stok Bahan & Resep Menu:");

test("Kalkulasi Pemotongan Bahan Baku Berdasarkan Resep POS", () => {
  const recipe = [
    { ingredientId: "beans", quantity: 18 }, // 18 gr
    { ingredientId: "milk", quantity: 120 }, // 120 ml
    { ingredientId: "syrup", quantity: 25 }, // 25 ml
  ];

  const orderedQty = 3; // Pelanggan pesan 3 gelas

  const deductions = recipe.map((r) => ({
    ingredientId: r.ingredientId,
    deductQty: r.quantity * orderedQty,
  }));

  assert.strictEqual(deductions.find((d) => d.ingredientId === "beans")?.deductQty, 54);
  assert.strictEqual(deductions.find((d) => d.ingredientId === "milk")?.deductQty, 360);
  assert.strictEqual(deductions.find((d) => d.ingredientId === "syrup")?.deductQty, 75);
});

test("Mode Anti-Macet (Izinkan Jual saat Stok Sistem Habis/Negatif)", () => {
  const currentStock = 20; // Hanya ada 20 gr di sistem karena opname terlambat
  const neededQty = 54; // Butuh 54 gr

  const allowNegativeStock = true; // Setting Toko: Mode Anti-Macet Aktif
  let canProceed = false;
  let newStock = currentStock;

  if (allowNegativeStock || currentStock >= neededQty) {
    canProceed = true;
    newStock = currentStock - neededQty;
  }

  assert.strictEqual(canProceed, true, "Kasir tidak boleh macet melayani tamu");
  assert.strictEqual(newStock, -34, "Stok sistem menjadi minus 34 gr untuk direkonsiliasi");
});

test("Pengembalian Stok Otomatis saat Void / Refund Transaksi", () => {
  let stock = 100;
  const usedQty = 36;

  // Transaksi Terjual
  stock -= usedQty;
  assert.strictEqual(stock, 64);

  // Transaksi di-VOID / REFUND dengan opsi RETURN_TO_STOCK
  const restockOption = "RETURN_TO_STOCK";
  if (restockOption === "RETURN_TO_STOCK") {
    stock += usedQty;
  }
  assert.strictEqual(stock, 100, "Stok harus kembali utuh seperti semula setelah void");
});

// -------------------------------------------------------------
// 4. SECURITY, OTORISASI PIN & ROLE-BASED ACCESS CONTROL
// -------------------------------------------------------------
console.log("\n4. Pengujian Keamanan, PIN Supervisor & Role Access:");

test("Verifikasi PIN Otorisasi Supervisor POS Khusus", () => {
  const configuredSupervisorPin = "4321"; // Manajer mengubah PIN supervisor di Pengaturan
  const inputPin1: string = "4321";
  const inputPin2: string = "0000";

  const isAuth1 = inputPin1 === configuredSupervisorPin;
  const isAuth2 = inputPin2 === configuredSupervisorPin;

  assert.strictEqual(isAuth1, true, "PIN supervisor yang cocok berhasil otorisasi");
  assert.strictEqual(isAuth2, false, "PIN salah ditolak");
});

test("Proteksi Akun Owner Read-Only (Owner Dilarang Eksekusi Otorisasi Void Langsung)", () => {
  const user = { username: "owner", role: "OWNER", pin: "123456" };
  const inputPin = "123456";

  const isOwner = user.role === "OWNER" && user.pin === inputPin;
  assert.strictEqual(isOwner, true);

  // Aturan Sistem: Owner adalah akun pengawasan read-only
  const canAuthorizeVoid = user.role === "MANAGER" || user.role === "SUPER_ADMIN";
  assert.strictEqual(canAuthorizeVoid, false, "Akun Owner tidak boleh dipakai otorisasi void di kasir");
});

test("Restriksi Hak Akses Terminal Kasir POS", () => {
  const users = [
    { id: "1", name: "Andi", role: "KASIR" },
    { id: "2", name: "Budi", role: "BARISTA" },
    { id: "3", name: "Citra", role: "MANAGER" },
  ];

  const cashierUsers = users.filter((u) => u.role === "KASIR");
  assert.strictEqual(cashierUsers.length, 1);
  assert.strictEqual(cashierUsers[0].name, "Andi", "Hanya akun role KASIR yang muncul di login terminal kasir");
});

// -------------------------------------------------------------
// 5. PENYIMPANAN PENGATURAN & SINKRONISASI
// -------------------------------------------------------------
console.log("\n5. Pengujian Default & Sanitasi Settings:");

test("Default Nilai Pengaturan Baru", () => {
  const defaultSettings = {
    posSupervisorPin: "1234",
    autoDeductStockOnSale: false,
    allowNegativeStockSale: true,
  };

  assert.strictEqual(defaultSettings.posSupervisorPin, "1234");
  assert.strictEqual(defaultSettings.autoDeductStockOnSale, false);
  assert.strictEqual(defaultSettings.allowNegativeStockSale, true);
});

// -------------------------------------------------------------
// 6. SPLIT BILL (PECAH TAGIHAN PER ITEM & BAGI RATA)
// -------------------------------------------------------------
console.log("\n6. Pengujian Arsitektur Split Bill (Pecah Tagihan):");

test("Split Bill Per Menu: Pengurangan Item & Pembaruan Tagihan Induk", () => {
  const parentOrderItems = [
    { id: "it-1", menuName: "Kopi Susu", unitPrice: 25000, quantity: 2, subtotal: 50000 },
    { id: "it-2", menuName: "Croissant", unitPrice: 30000, quantity: 1, subtotal: 30000 },
  ];
  const initialParentTotal = 80000;

  // Tamu 1 bayar 1 Kopi Susu (Rp 25.000)
  const splitItems = [{ id: "it-1", quantity: 1 }];

  let splitSubtotal = 0;
  const remainingItems: typeof parentOrderItems = [];

  for (const pIt of parentOrderItems) {
    const sIt = splitItems.find((s) => s.id === pIt.id);
    if (sIt) {
      splitSubtotal += pIt.unitPrice * sIt.quantity;
      const leftQty = pIt.quantity - sIt.quantity;
      if (leftQty > 0) {
        remainingItems.push({ ...pIt, quantity: leftQty, subtotal: pIt.unitPrice * leftQty });
      }
    } else {
      remainingItems.push({ ...pIt });
    }
  }

  assert.strictEqual(splitSubtotal, 25000, "Nominal split porsi Tamu 1 harus Rp 25.000");

  const remainingParentTotal = remainingItems.reduce((s, it) => s + it.subtotal, 0);
  assert.strictEqual(remainingParentTotal, 55000, "Sisa tagihan meja harus tepat Rp 55.000");
  assert.strictEqual(remainingItems.length, 2, "Masih tersisa 2 menu di meja (1 Kopi Susu, 1 Croissant)");
  assert.strictEqual(remainingItems.find((it) => it.id === "it-1")?.quantity, 1);
});

test("Split Bill Bagi Rata (Evenly Split): Perhitungan Sisa Saldo Meja", () => {
  const totalBill = 100000;
  const personsCount = 4;
  const sharePerPerson = Math.round(totalBill / personsCount); // 25.000

  assert.strictEqual(sharePerPerson, 25000);

  // Pembayaran bertahap:
  let remainingTotal = totalBill;

  // Orang 1 bayar Rp 25.000
  remainingTotal -= sharePerPerson;
  assert.strictEqual(remainingTotal, 75000);

  // Orang 2 bayar Rp 25.000
  remainingTotal -= sharePerPerson;
  assert.strictEqual(remainingTotal, 50000);

  // Orang 3 & 4 bayar Rp 50.000
  remainingTotal -= sharePerPerson * 2;
  assert.strictEqual(remainingTotal, 0, "Tagihan meja lunas saat seluruh pecahan terbayar");
});

// -------------------------------------------------------------
// 7. REMOTE APPROVAL STATE MACHINE
// -------------------------------------------------------------
console.log("\n7. Pengujian Persetujuan Jarak Jauh (Remote Approval):");

test("Alur Transisi Status Otorisasi Jarak Jauh (PENDING -> APPROVED)", () => {
  type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
  const request: {
    id: string;
    orderId: string;
    type: "VOID" | "REFUND";
    status: ApprovalStatus;
    respondedBy?: string;
  } = {
    id: "req-1",
    orderId: "ord-1",
    type: "VOID",
    status: "PENDING",
  };

  assert.strictEqual(request.status, "PENDING", "Permintaan awal berstatus PENDING");

  // Manager merespon APPROVE dari HP
  request.status = "APPROVED";
  request.respondedBy = "Budi (Manager)";

  assert.strictEqual(request.status, "APPROVED");
  assert.strictEqual(request.respondedBy, "Budi (Manager)");
});

// -------------------------------------------------------------
// 8. DATE UTILS & STORE TIMEZONE (WITA - Asia/Makassar)
// -------------------------------------------------------------
console.log("\n8. Pengujian Date Utils Zona Waktu WITA (Asia/Makassar):");

test("Konversi Tanggal Lokal & Periode Bulanan Sesuai WITA", () => {
  assert.strictEqual(DEFAULT_STORE_TIMEZONE, "Asia/Makassar");

  // 2026-10-29T23:30:00.000Z adalah 2026-10-30 07:30:00 WITA (+08:00)
  const utcDateNight = new Date("2026-10-29T23:30:00.000Z");
  const localDateStr = getLocalDateString(utcDateNight);
  assert.strictEqual(localDateStr, "2026-10-30", "Harus terdeteksi sebagai tanggal 30 Oktober di WITA");

  const localPeriodStr = getLocalPeriodString(utcDateNight);
  assert.strictEqual(localPeriodStr, "2026-10", "Periode harus 2026-10");

  const isOnLocalDate = isTimestampOnLocalDate("2026-10-29T23:30:00.000Z", "2026-10-30");
  assert.strictEqual(isOnLocalDate, true, "Timestamp UTC malam harus cocok dengan tanggal lokal target");

  const isNotOnLocalDate = isTimestampOnLocalDate("2026-10-29T15:00:00.000Z", "2026-10-30"); // Jam 23:00 tgl 29 WITA
  assert.strictEqual(isNotOnLocalDate, false, "Jam 23:00 tgl 29 WITA bukan tgl 30");

  const { startUtcIso, endUtcIso } = getLocalDayUtcBounds("2026-10-30");
  assert.strictEqual(startUtcIso, "2026-10-29T16:00:00.000Z", "Midnight 00:00 WITA tgl 30 adalah 16:00 UTC tgl 29");
  assert.strictEqual(endUtcIso, "2026-10-30T15:59:59.999Z", "End of day 23:59:59.999 WITA adalah 15:59:59.999 UTC tgl 30");
});

// -------------------------------------------------------------
// 9. DEDUKSI RESEP MENU, VARIAN, MODIFIERS & ALT-MILK SUBSTITUSI
// -------------------------------------------------------------
console.log("\n9. Pengujian Deduksi Bahan Baku Sesuai Resep, Varian & Modifier:");

test("Resolusi Resep dengan Modifier Penambah & Substitusi Susu Nabati", () => {
  const menuItems: any[] = [
    {
      id: "prod-latte",
      name: "Caffe Latte",
      price: 28000,
      category: "Coffee",
      division: "BAR",
      variants: [
        { id: "var-reg", name: "Regular", price: 28000 },
        {
          id: "var-1l",
          name: "Botol 1 Liter",
          price: 85000,
          recipe: [
            { ingredientId: "ing-beans", amount: 72, quantity: 72, unit: "g" },
            { ingredientId: "ing-fresh-milk", amount: 600, quantity: 600, unit: "ml" },
            { ingredientId: "ing-syrup", amount: 80, quantity: 80, unit: "ml" },
          ],
        },
      ],
    },
  ];

  const recipes: any[] = [
    {
      id: "rec-latte",
      menuItemId: "prod-latte",
      ingredients: [
        { ingredientId: "ing-beans", amount: 18, quantity: 18, unit: "g" },
        { ingredientId: "ing-fresh-milk", amount: 150, quantity: 150, unit: "ml" },
        { ingredientId: "ing-syrup", amount: 20, quantity: 20, unit: "ml" },
      ],
    },
  ];

  const ingredients: any[] = [
    { id: "ing-beans", name: "Espresso Beans House Blend", currentStock: 5000, unit: "g", minStock: 500, costPerUnit: 250 },
    { id: "ing-fresh-milk", name: "Fresh Milk Diamond", currentStock: 10000, unit: "ml", minStock: 2000, costPerUnit: 20 },
    { id: "ing-oat-milk", name: "Oatside Oat Milk", currentStock: 5000, unit: "ml", minStock: 1000, costPerUnit: 45 },
    { id: "ing-syrup", name: "Vanilla Syrup", currentStock: 2000, unit: "ml", minStock: 200, costPerUnit: 150 },
  ];

  // Skenario 1: Pesanan 1 porsi Caffe Latte Regular + Extra Shot (+9g) + Ganti Susu Oat
  const orderItemReg = {
    menuName: "Caffe Latte",
    variantName: "Regular",
    quantity: 1,
    modifiers: [
      { name: "Extra Shot Espresso", price: 5000 },
      { name: "Ganti Oat Milk", price: 5000 },
    ],
  };

  const deductionsReg = resolveOrderItemIngredients(orderItemReg, recipes, menuItems, ingredients);
  const beansDeduction = deductionsReg.find((d) => d.ingredientId === "ing-beans");
  const oatDeduction = deductionsReg.find((d) => d.ingredientId === "ing-oat-milk");
  const dairyDeduction = deductionsReg.find((d) => d.ingredientId === "ing-fresh-milk");
  const syrupDeduction = deductionsReg.find((d) => d.ingredientId === "ing-syrup");

  assert.ok(beansDeduction, "Kopi espresso harus terpotong");
  assert.strictEqual(beansDeduction.totalQuantity, 27, "18g dasar + 9g ekstra shot = 27g kopi");

  assert.ok(oatDeduction, "Susu Oat harus terpotong karena substitusi");
  assert.strictEqual(oatDeduction.totalQuantity, 150, "Susu Oat 150ml menggantikan susu sapi");

  assert.strictEqual(dairyDeduction, undefined, "Susu sapi (Fresh Milk) TIDAK boleh terpotong karena disubstitusi");

  assert.ok(syrupDeduction, "Sirup vanila tetap terpotong sesuai resep dasar");
  assert.strictEqual(syrupDeduction.totalQuantity, 20);

  // Skenario 2: Pesanan 2 porsi Caffe Latte Varian Botol 1 Liter (resep khusus variant)
  const orderItemBottle = {
    menuName: "Caffe Latte",
    variantName: "Botol 1 Liter",
    quantity: 2,
  };

  const deductionsBottle = resolveOrderItemIngredients(orderItemBottle, recipes, menuItems, ingredients);
  const beansBottle = deductionsBottle.find((d) => d.ingredientId === "ing-beans");
  const milkBottle = deductionsBottle.find((d) => d.ingredientId === "ing-fresh-milk");
  const syrupBottle = deductionsBottle.find((d) => d.ingredientId === "ing-syrup");

  assert.strictEqual(beansBottle?.totalQuantity, 72 * 2, "72g x 2 = 144g kopi untuk 2 botol 1 Liter");
  assert.strictEqual(milkBottle?.totalQuantity, 600 * 2, "600ml x 2 = 1200ml susu untuk 2 botol 1 Liter");
  assert.strictEqual(syrupBottle?.totalQuantity, 80 * 2, "80ml x 2 = 160ml sirup untuk 2 botol 1 Liter");
});

// -------------------------------------------------------------
// 10. ELIMINASI 2X DOUBLE COUNTING KAS & STATISTIK TUTUP SHIFT
// -------------------------------------------------------------
console.log("\n10. Pengujian Eliminasi 2x Double Counting Kas Laci Shift:");

test("Perhitungan Statistik Shift: Penjualan Kas, Non-Tunai, Petty Cash & Refund", () => {
  const mockShift = {
    startTime: "2026-10-30T01:00:00.000Z", // Jam 09:00 WITA
    startingCash: 100000, // Modal awal laci
    cashAccountId: "acc-drawer",
  };

  const mockSalesTransactions: any[] = [
    // 1. Tunai Rp 50.000
    {
      id: "stx-1",
      date: "2026-10-30T01:10:00.000Z",
      totalPrice: 50000,
      paymentMethod: "CASH",
    },
    // 2. Tunai Rp 100.000
    {
      id: "stx-2",
      date: "2026-10-30T01:20:00.000Z",
      totalPrice: 100000,
      paymentMethod: "CASH",
    },
    // 3. QRIS Rp 75.000
    {
      id: "stx-3",
      date: "2026-10-30T01:30:00.000Z",
      totalPrice: 75000,
      paymentMethod: "QRIS",
    },
    // 4. EDC/Debit Rp 40.000
    {
      id: "stx-4",
      date: "2026-10-30T01:40:00.000Z",
      totalPrice: 40000,
      paymentMethod: "DEBIT",
    },
  ];

  // Kasir memasukkan mutasi kas kecil manual di laci (beli es darurat Rp 15.000)
  // DAN server membuat mutasi otomatis CASH_IN dari penjualan POS (Rp 50.000 & Rp 100.000)
  // DAN ada kas keluar refund tunai Rp 20.000
  const mockCashTransactions: any[] = [
    // 1. Transaksi otomatis dari POS untuk ord-1
    {
      id: "ctx-pos-1",
      accountId: "acc-drawer",
      type: "CASH_IN",
      amount: 50000,
      category: "Penjualan Kasir",
      description: "Penjualan POS #ORD-001 (CASH)",
      date: "2026-10-30T01:10:00.000Z",
    },
    // 2. Transaksi otomatis dari POS untuk ord-2
    {
      id: "ctx-pos-2",
      accountId: "acc-drawer",
      type: "CASH_IN",
      amount: 100000,
      category: "Penjualan Kasir",
      description: "Penjualan POS #ORD-002 (CASH)",
      date: "2026-10-30T01:20:00.000Z",
    },
    // 3. Mutasi kas kecil manual operasional laci
    {
      id: "ctx-manual-petty",
      accountId: "acc-drawer",
      type: "CASH_OUT",
      amount: 15000,
      category: "Operasional",
      description: "Beli es batu darurat",
      date: "2026-10-30T02:00:00.000Z",
    },
    // 4. Kas keluar refund tunai
    {
      id: "ctx-refund-cash",
      accountId: "acc-drawer",
      type: "CASH_OUT",
      amount: 20000,
      category: "Refund Kasir",
      description: "Refund Kasir #ORD-005 (CASH)",
      date: "2026-10-30T02:15:00.000Z",
    },
  ];

  const stats = calculateShiftStats(mockShift, mockSalesTransactions, mockCashTransactions);

  // Verifikasi tidak ada 2x double counting:
  // Penjualan tunai harus tepat Rp 150.000 (bukan Rp 300.000!)
  assert.strictEqual(stats.cashSales, 150000, "Penjualan tunai dari shiftOrders harus tepat Rp 150.000");
  assert.strictEqual(stats.qrisSales, 75000, "Penjualan QRIS harus Rp 75.000");
  assert.strictEqual(stats.edcSales, 40000, "Penjualan Debit harus Rp 40.000");
  assert.strictEqual(stats.refundCash, 20000, "Refund kas laci harus Rp 20.000");
  assert.strictEqual(stats.otherCashOut, 15000, "Pengeluaran kas kecil manual non-refund Rp 15.000");

  // Kas di laci yang diharapkan = modal awal (100.000) + kas masuk (150.000) - kas refund (20.000) - manual expense (15.000) = 215.000
  assert.strictEqual(stats.expectedEndingCash, 215000, "Kas fisik akhir di laci harus tepat Rp 215.000 tanpa double counting");
});

// -------------------------------------------------------------
// 11. REKAP ORDER HARI INI & PENDAPATAN BERSIH (NET REVENUE)
// -------------------------------------------------------------
console.log("\n11. Pengujian Rekap Order Hari Ini (Gross vs Net Revenue):");

test("Kalkulasi Omzet Hari Ini: PAID + REFUNDED Gross Dikurangi Refund", () => {
  const todayOrders: any[] = [
    {
      id: "o1",
      orderNumber: "ORD-001",
      totalAmount: 50000,
      paymentMethod: "CASH",
      status: "PAID",
    },
    {
      id: "o2",
      orderNumber: "ORD-002",
      totalAmount: 100000,
      paymentMethod: "QRIS",
      status: "PAID",
    },
    {
      id: "o3",
      orderNumber: "ORD-003",
      totalAmount: 30000,
      refundAmount: 30000,
      paymentMethod: "CASH",
      status: "REFUNDED",
    },
    {
      id: "o4",
      orderNumber: "ORD-004",
      totalAmount: 40000,
      paymentMethod: "CASH",
      status: "VOID",
    },
  ];

  const summary = calculateTodayOrderSummary(todayOrders);

  assert.strictEqual(summary.paidCount, 2, "2 pesanan berstatus PAID");
  assert.strictEqual(summary.refundCount, 1, "1 pesanan berstatus REFUNDED");
  assert.strictEqual(summary.voidCount, 1, "1 pesanan berstatus VOID");

  // Gross = 50.000 + 100.000 + 30.000 = 180.000
  assert.strictEqual(summary.totalRevenue, 180000, "Gross omzet harus Rp 180.000 (PAID + REFUNDED)");
  assert.strictEqual(summary.refundTotal, 30000, "Total refund harus Rp 30.000");

  // Net = 180.000 - 30.000 = 150.000
  assert.strictEqual(summary.netRevenue, 150000, "Net omzet harus Rp 150.000 (totalRevenue - refundTotal)");
});

// -------------------------------------------------------------
// 12. ROUTING REKENING PEMBAYARAN KASIR (DRAWER vs BANK/E-WALLET)
// -------------------------------------------------------------
console.log("\n12. Pengujian Routing Rekening Kas / Bank Otomatis:");

test("Routing Metode Pembayaran ke Akun Kas/Bank yang Benar", () => {
  const accounts: any[] = [
    { id: "acc-drawer", name: "Kas Laci Kasir", type: "CASH", balance: 500000, isDefault: true },
    { id: "acc-bca", name: "Bank BCA Operasional", type: "BANK", balance: 15000000, isDefault: true },
    { id: "acc-qris", name: "QRIS Midtrans / Settlement", type: "E_WALLET", balance: 2500000 },
  ];

  assert.strictEqual(resolvePaymentAccountId("CASH", null, accounts, "acc-drawer"), "acc-drawer", "CASH harus masuk Kas Laci Kasir");
  assert.strictEqual(resolvePaymentAccountId("QRIS", null, accounts), "acc-bca", "QRIS masuk ke akun default non-tunai (BANK/E_WALLET)");
  assert.strictEqual(resolvePaymentAccountId("DEBIT", null, accounts), "acc-bca", "DEBIT EDC harus masuk BANK");
  assert.strictEqual(resolvePaymentAccountId("CREDIT", null, accounts), "acc-bca", "CREDIT CARD EDC harus masuk BANK");

  // Deteksi mutasi otomatis POS penjualan
  assert.strictEqual(
    isAutoPosSaleCashIn({ type: "CASH_IN", description: "Penjualan POS #ORD-001 (CASH)", category: "Penjualan Kasir" }),
    true,
    "Transaksi POS otomatis harus teridentifikasi agar tidak double counting"
  );
  assert.strictEqual(
    isAutoPosSaleCashIn({ type: "CASH_IN", description: "Beli kopi sachet di warung", category: "Operasional" }),
    false,
    "Transaksi operasional manual bukan auto POS"
  );
});

// -------------------------------------------------------------
// 13. KEAMANAN PIN SUPERVISOR, SHA-256 HASH & ROLE PERMISSIONS
// -------------------------------------------------------------
console.log("\n13. Pengujian Keamanan Autentikasi & Verifikasi PIN:");

test("Verifikasi PIN Supervisor dengan SHA-256 & Larangan Bypass", () => {
  const rawSupervisorPin = "889922";
  const supervisorSha256 = crypto.createHash("sha256").update(rawSupervisorPin).digest("hex");

  // Helper verifikasi lokal sama dengan backend server.ts
  const verifyPinHash = (candidate: string, storedHash: string) => {
    const candidateHash = crypto.createHash("sha256").update(candidate.trim()).digest("hex");
    return candidateHash === storedHash || candidate.trim() === storedHash;
  };

  assert.strictEqual(verifyPinHash("889922", supervisorSha256), true, "PIN valid harus berhasil");
  assert.strictEqual(verifyPinHash("1234", supervisorSha256), false, "Bypass 1234 harus ditolak keras");
  assert.strictEqual(verifyPinHash("123456", supervisorSha256), false, "Bypass 123456 harus ditolak keras");
  assert.strictEqual(verifyPinHash("999999", supervisorSha256), false, "PIN salah harus ditolak");

  // OWNER dilarang mengeksekusi aksi mutasi/approval kasir
  const isActionPermitted = (role: string) => {
    if (role === "OWNER") return false; // Strict View-Only
    return role === "MANAGER" || role === "SUPER_ADMIN";
  };

  assert.strictEqual(isActionPermitted("OWNER"), false, "Akun OWNER harus diblokir dari aksi approval/void/refund (View Only)");
  assert.strictEqual(isActionPermitted("MANAGER"), true, "Manager diizinkan approve");
  assert.strictEqual(isActionPermitted("SUPER_ADMIN"), true, "Super Admin diizinkan approve");
});

// -------------------------------------------------------------
// 14. THERMAL ESC/POS RECEIPT GENERATION & CASH DRAWER KICK
// -------------------------------------------------------------
console.log("\n14. Pengujian Thermal ESC/POS Byte Generator & Cash Drawer:");

test("ESC/POS Receipt Generator: Struktur Byte, Header ESC @, Baris Item, dan Cut Command", () => {
  const dummyOrder: any = {
    receiptNo: "ORD-20261030-9999",
    createdAt: "2026-10-30T10:00:00.000Z",
    orderType: "DINE_IN",
    tableNumber: "T-05",
    customerName: "Budi Santoso",
    items: [
      {
        menuName: "Caffe Latte",
        variantName: "Oat Milk Regular",
        quantity: 2,
        unitPrice: 35000,
        subtotal: 70000,
        notes: "Less sweet, extra hot",
      },
      {
        menuName: "Butter Croissant",
        quantity: 1,
        unitPrice: 25000,
        subtotal: 25000,
      },
    ],
    subtotal: 95000,
    discountAmount: 10000,
    taxAmount: 8500,
    totalAmount: 93500,
    paidAmount: 100000,
    changeAmount: 6500,
    paymentMethod: "CASH",
  };

  const dummySettings: any = {
    storeName: "Julia's Coffee Artisanal",
    storeAddress: "Jl. Boulevard No. 88, Jakarta Selatan",
    storePhone: "08123456789",
    receiptFooterText: "Terima kasih atas kunjungan Anda!",
  };

  // Generate bytes 58mm
  const bytes58 = buildEscPosReceipt(dummyOrder, dummySettings, { paperWidth: "58mm", kickDrawer: true });
  assert.ok(bytes58 instanceof Uint8Array, "Output harus Uint8Array");
  assert.ok(bytes58.length > 50, "Ukuran byte struk harus realistis (> 50 bytes)");

  // Byte awal harus ESC @ (0x1B, 0x40) untuk inisialisasi printer
  assert.strictEqual(bytes58[0], 0x1b, "Byte [0] harus ESC (0x1B)");
  assert.strictEqual(bytes58[1], 0x40, "Byte [1] harus @ (0x40)");

  // Konversi bytes ke string untuk verifikasi isi teks
  const textOutput = new TextDecoder("ascii").decode(bytes58);
  assert.ok(textOutput.toUpperCase().includes("JULIA'S COFFEE"), "Teks harus memuat nama toko");
  assert.ok(textOutput.includes("ORD-20261030-9999"), "Teks harus memuat nomor struk");
  assert.ok(textOutput.includes("Caffe Latte"), "Teks harus memuat nama item");
  assert.ok(textOutput.includes("93.500"), "Teks harus memuat total amount terformat");
  assert.ok(textOutput.includes("Kembalian:"), "Teks harus memuat baris kembalian");

  // Cash drawer kick command
  const kickBytes = buildCashDrawerKickCommand();
  assert.strictEqual(kickBytes[0], 0x1b, "Kick byte 0: ESC");
  assert.strictEqual(kickBytes[1], 0x40, "Kick byte 1: @ (Initialize)");
  assert.strictEqual(kickBytes[2], 0x1b, "Kick byte 2: ESC");
  assert.strictEqual(kickBytes[3], 0x70, "Kick byte 3: p (Drawer Kick)");
  assert.strictEqual(kickBytes[4], 0x00, "Kick byte 4: pin 2 (0x00)");
});

// -------------------------------------------------------------
// 15. WHATSAPP CRM & DIGITAL RECEIPT LINK GENERATOR
// -------------------------------------------------------------
console.log("\n15. Pengujian WhatsApp CRM & Generator Struk Digital:");

test("Format Nomor HP Indonesia & Generator URL WhatsApp Struk", () => {
  // Test normalisasi nomor HP lokal ke internasional
  assert.strictEqual(formatWhatsAppPhoneNumber("081234567890"), "6281234567890", "0812... dikonversi ke 62812...");
  assert.strictEqual(formatWhatsAppPhoneNumber("+62 812-3456-7890"), "6281234567890", "Nomor dengan spasi, +, dan strip dibersihkan");
  assert.strictEqual(formatWhatsAppPhoneNumber("81234567890"), "6281234567890", "812... diawali 62");

  const dummyOrder: any = {
    receiptNo: "ORD-WA-8888",
    createdAt: "2026-10-30T10:15:00.000Z",
    customerName: "Rina Kartika",
    tableNumber: "T-02",
    items: [
      {
        menuName: "Caramel Macchiato",
        variantName: "Iced Large",
        quantity: 2,
        unitPrice: 42000,
        subtotal: 84000,
      },
    ],
    subtotal: 84000,
    discountAmount: 4000,
    taxAmount: 8000,
    totalAmount: 88000,
    paidAmount: 88000,
    paymentMethod: "QRIS",
  };

  const dummySettings: any = {
    storeName: "Julia's Coffee Lab",
    storeAddress: "Pakuwon Mall Lt. 1",
  };

  const receiptText = buildWhatsAppReceiptText(dummyOrder, dummySettings, 8);
  assert.ok(receiptText.includes("No. Struk:"), "Teks WA harus memuat label No. Struk");
  assert.ok(receiptText.toUpperCase().includes("JULIA'S COFFEE LAB"), "Teks WA harus memuat nama coffee shop");
  assert.ok(receiptText.includes("Caramel Macchiato"), "Teks WA harus memuat item pesanan");
  assert.ok(receiptText.includes("88.000"), "Teks WA harus memuat total bayar terformat");
  assert.ok(receiptText.includes("+8 Poin"), "Teks WA harus memuat poin loyalitas yang didapatkan");

  const waUrl = buildWhatsAppReceiptUrl("081234567890", dummyOrder, dummySettings, 8);
  assert.ok(waUrl.startsWith("https://api.whatsapp.com/send?phone=6281234567890"), "URL harus mengarah ke API WhatsApp dengan nomor bersih");
  assert.ok(waUrl.includes("text="), "URL harus menyertakan query param text");
});

// -------------------------------------------------------------
// 16. GENERATOR SLIP GAJI VEKTOR PDF & REKAP KOMPONEN PAYROLL
// -------------------------------------------------------------
console.log("\n16. Pengujian Generator Slip Gaji Vektor PDF (Anti-Crash):");

test("Pembuatan Dokumen Vektor PDF Slip Gaji Karyawan Lengkap", () => {
  const dummyPayroll: any = {
    id: "PAY-2026-10-001",
    employeeId: "emp-budi",
    period: "2026-10",
    basicSalary: 2800000,
    mealAllowance: 390000,
    positionAllowance: 500000,
    transportAllowance: 200000,
    kpiBonus: 250000,
    targetBonus: 150000,
    overtimePay: 120000,
    overtimeHours: 6,
    alphaDeduction: 0,
    lateDeduction: 25000,
    lateHours: 1,
    lateDays: 1,
    otherDeductions: 0,
    grossPay: 4410000,
    netPay: 4385000,
    status: "PAID",
    paidDate: "2026-10-30",
    paidVia: "acc-main-cash",
    approvedBy: "Julia",
    approvedAt: "2026-10-30T10:00:00Z",
    notes: "Bonus KPI performa barista terbaik bulan ini.",
  };

  const dummyEmployee: any = {
    id: "emp-budi",
    name: "Budi Santoso",
    username: "budi",
    position: "Senior Barista",
    department: "BAR & KITCHEN",
  };

  const dummySettings: any = {
    brandName: "Julia's Coffee Lab",
    storeAddress: "Jl. Boulevard No. 128, Makassar",
    storePhone: "08123456789",
  };

  const doc = exportSinglePayslipPDF({
    payroll: dummyPayroll,
    employee: dummyEmployee,
    settings: dummySettings,
    attendanceBreakdown: {
      totalWorkingDays: 26,
      presentDays: 26,
      lateDays: 1,
      sickOrLeaveDays: 0,
      alphaDays: 0,
    },
    kpiDetails: {
      label: "Disiplin Checklist Barista 100%",
      ratio: 100,
      checklistDays: 26,
      expectedDays: 26,
      isLeader: false,
    },
    paidViaAccountName: "Kasir Utama (BCA)",
  });

  assert.ok(doc, "jsPDF instance harus berhasil di-generate tanpa error");
  assert.strictEqual(typeof doc.output, "function", "Objek harus memiliki method output jsPDF");
  const pdfBuffer = doc.output("arraybuffer");
  assert.ok(pdfBuffer.byteLength > 1000, "Ukuran file PDF harus valid dan berisi konten");
});

// -------------------------------------------------------------
// 17. INTEGRASI DROPDOWN BAHAN BAKU & SINKRONISASI BERANTAI HPP ARUS KAS
// -------------------------------------------------------------
console.log("\n17. Pengujian Integrasi Dropdown Bahan Baku & Sinkronisasi Berantai HPP di Arus Kas:");

const sampleIngredients: Ingredient[] = [
  {
    id: "ing-coffee-beans",
    name: "House Blend Espresso Beans",
    unit: "gr",
    currentStock: 4500,
    minStock: 1000,
    category: "Coffee",
    costPerUnit: 250,
    purchaseUnit: "Kg",
    conversionFactor: 1000,
    purchasePrice: 250000,
  },
  {
    id: "ing-fresh-milk",
    name: "Fresh Milk UHT Greenfields",
    unit: "ml",
    currentStock: 5000,
    minStock: 2000,
    category: "Dairy",
    costPerUnit: 18.5,
    purchaseUnit: "Liter",
    conversionFactor: 1000,
    purchasePrice: 18500,
  },
  {
    id: "ing-aren-padat",
    name: "Gula Aren Batok Organik",
    unit: "gr",
    currentStock: 8000,
    minStock: 2000,
    category: "Pemanis",
    costPerUnit: 35,
    purchaseUnit: "Kg",
    conversionFactor: 1000,
    purchasePrice: 35000,
  },
  {
    id: "ing-air",
    name: "Air Bersih Galon RO",
    unit: "ml",
    currentStock: 50000,
    minStock: 10000,
    category: "Air & Es",
    costPerUnit: 0.5,
    purchaseUnit: "Galon (19L)",
    conversionFactor: 19000,
    purchasePrice: 9500,
  },
  {
    id: "ing-aren-cair",
    name: "Gula Aren Cair Racikan",
    unit: "ml",
    currentStock: 2400,
    minStock: 800,
    category: "Kondimen Olahan",
    costPerUnit: 38,
    purchaseUnit: "Liter",
    conversionFactor: 1000,
    purchasePrice: 38000,
  },
  {
    id: "ing-ice-cube",
    name: "Es Batu Kristal Tube",
    unit: "gr",
    currentStock: 25000,
    minStock: 5000,
    category: "Air & Es",
    costPerUnit: 2,
    purchaseUnit: "Plastik (10Kg)",
    conversionFactor: 10000,
    purchasePrice: 20000,
  },
];

const sampleBatchPreps: BatchPreparation[] = [
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
  },
];

const sampleProducts: Product[] = [
  {
    id: "prod-kopsu-aren",
    name: "Kopi Susu Gula Aren",
    category: "COFFEE",
    division: "BAR",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    variants: [
      {
        id: "var-kopsu-iced",
        productId: "prod-kopsu-aren",
        name: "Iced 16oz",
        price: 22000,
        packagingCost: 1000,
        estimatedHpp: 8910,
        isAvailable: true,
        recipe: [
          { ingredientId: "ing-coffee-beans", quantity: 18 },
          { ingredientId: "ing-fresh-milk", quantity: 120 },
          { ingredientId: "ing-aren-cair", quantity: 25 },
          { ingredientId: "ing-ice-cube", quantity: 120 },
        ],
      },
    ],
  },
];

test("Konversi Satuan Beli & Metode Harga Beli Terakhir (LAST_PRICE) Tanpa Mengubah Stok Fisik", () => {
  const result = calculateCashFlowHppSync({
    itemRows: [
      {
        ingredientId: "ing-fresh-milk",
        unitMode: "PURCHASE",
        qty: "2",
        unitPrice: "20000",
        totalPrice: "40000",
      },
    ],
    ingredients: sampleIngredients,
    batchPreparations: sampleBatchPreps,
    products: sampleProducts,
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });

  assert.strictEqual(result.directUpdates.length, 1);
  assert.strictEqual(result.directUpdates[0].newCostPerUnit, 20, "40.000 / (2 * 1000 ml) = Rp 20/ml");
  assert.strictEqual(result.directUpdates[0].newPurchasePrice, 20000, "Harga satuan beli = Rp 20.000/Liter");
  assert.strictEqual(result.directUpdates[0].ingredient.currentStock, 5000, "Stok fisik gudang tidak boleh berubah");
  assert.strictEqual(result.productsToUpdate.length, 1);
  assert.strictEqual(
    result.productsToUpdate[0].variants[0].estimatedHpp,
    9090,
    "Kenaikan susu Rp 18,5 -> Rp 20 (+Rp 1,5 * 120ml = +Rp 180) menaikkan HPP 8.910 -> 9.090"
  );
});

test("Metode Rata-rata Tertimbang (WEIGHTED_AVERAGE) Menghitung Gabungan Nilai Stok Lama & Baru", () => {
  const result = calculateCashFlowHppSync({
    itemRows: [
      {
        ingredientId: "ing-fresh-milk",
        unitMode: "PURCHASE",
        qty: "5",
        unitPrice: "20500",
        totalPrice: "102500",
      },
    ],
    ingredients: sampleIngredients,
    batchPreparations: sampleBatchPreps,
    products: sampleProducts,
    recipes: [],
    priceSyncMethod: "WEIGHTED_AVERAGE",
  });

  // Nilai stok lama: 5000 ml * 18.5 = 92.500; Beli baru: 5000 ml total 102.500
  // Rata-rata: (92.500 + 102.500) / (5000 + 5000) = 195.000 / 10.000 = 19.5
  assert.strictEqual(result.directUpdates.length, 1);
  assert.strictEqual(result.directUpdates[0].newCostPerUnit, 19.5);
  assert.strictEqual(result.directUpdates[0].newPurchasePrice, 19500);
  assert.strictEqual(result.directUpdates[0].ingredient.currentStock, 5000);
});

test("Efek Berantai Bahan Mentah -> Kondimen Olahan (BatchPreparation) -> HPP Varian Menu", () => {
  const result = calculateCashFlowHppSync({
    itemRows: [
      {
        ingredientId: "ing-aren-padat",
        unitMode: "PURCHASE",
        qty: "2",
        unitPrice: "47000",
        totalPrice: "94000",
      },
    ],
    ingredients: sampleIngredients,
    batchPreparations: sampleBatchPreps,
    products: sampleProducts,
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });

  // 1. Gula Aren Batok naik dari Rp 35/gr -> Rp 47/gr
  assert.strictEqual(result.directUpdates[0].newCostPerUnit, 47);

  // 2. Kondimen Olahan Saus Gula Aren (1000 gr * 47 + 600 ml * 0.5) / 1200 ml = 47.300 / 1200 = 39.42
  assert.strictEqual(result.batchPrepUpdates.length, 1);
  assert.strictEqual(result.batchPrepUpdates[0].ingredient.id, "ing-aren-cair");
  assert.strictEqual(result.batchPrepUpdates[0].newCostPerUnit, 39.42);
  assert.strictEqual(result.batchPrepUpdates[0].newPurchasePrice, 39420);

  // 3. HPP Kopi Susu Gula Aren (18*250 + 120*18.5 + 25*39.42 + 120*2 + 1000) = 8945.5 -> 8946
  assert.strictEqual(result.productsToUpdate.length, 1);
  assert.strictEqual(result.productsToUpdate[0].variants[0].estimatedHpp, 8946);
});

test("Proteksi Self-Referential Batch Prep Tidak Menimpa Harga Bahan Input", () => {
  const result = calculateCashFlowHppSync({
    itemRows: [
      {
        ingredientId: "ing-coffee-beans",
        unitMode: "PURCHASE",
        qty: "1",
        unitPrice: "300000",
        totalPrice: "300000",
      },
    ],
    ingredients: sampleIngredients,
    batchPreparations: sampleBatchPreps,
    products: sampleProducts,
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });

  assert.strictEqual(result.directUpdates.length, 1);
  assert.strictEqual(result.directUpdates[0].newCostPerUnit, 300);
  assert.strictEqual(
    result.batchPrepUpdates.length,
    0,
    "bp-cold-brew yang targetIngredientId-nya sama dengan input tidak boleh menimpa ing-coffee-beans"
  );
  // HPP Kopi Susu Gula Aren: 18*300 + 120*18.5 + 25*38 + 120*2 + 1000 = 5400 + 2220 + 950 + 240 + 1000 = 9810
  assert.strictEqual(result.productsToUpdate[0].variants[0].estimatedHpp, 9810);
});

test("Multi-Kemasan Preset (Karton 12L untuk Bahan Master Liter) Menghitung Cost & Purchase Price Master Secara Proporsional", () => {
  const result = calculateCashFlowHppSync({
    itemRows: [
      {
        ingredientId: "ing-fresh-milk",
        unitMode: "PRESET",
        conversionFactor: "12000",
        qty: "2",
        unitPrice: "210000",
        totalPrice: "420000",
      },
    ],
    ingredients: sampleIngredients,
    batchPreparations: sampleBatchPreps,
    products: sampleProducts,
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });

  assert.strictEqual(result.directUpdates.length, 1);
  assert.strictEqual(result.directUpdates[0].totalBaseQty, 24000);
  assert.strictEqual(result.directUpdates[0].newCostPerUnit, 17.5, "420.000 / 24.000 ml = Rp 17,5/ml");
  assert.strictEqual(
    result.directUpdates[0].newPurchasePrice,
    17500,
    "Harga beli master per Liter harus proporsional Rp 17.500 (bukan harga 1 karton)"
  );
  // HPP Kopi Susu Gula Aren turun 120 ml * Rp 1 = Rp 120 -> 8910 - 120 = 8790
  assert.strictEqual(result.productsToUpdate[0].variants[0].estimatedHpp, 8790);
});

test("Kemasan Kustom dengan Konversi Fleksibel per Transaksi (mis. Dus 24x200ml = 4800ml)", () => {
  const result = calculateCashFlowHppSync({
    itemRows: [
      {
        ingredientId: "ing-fresh-milk",
        unitMode: "CUSTOM",
        conversionFactor: 4800,
        qty: 3,
        totalPrice: 216000,
      },
    ],
    ingredients: sampleIngredients,
    batchPreparations: sampleBatchPreps,
    products: sampleProducts,
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });

  assert.strictEqual(result.directUpdates.length, 1);
  assert.strictEqual(result.directUpdates[0].totalBaseQty, 14400);
  assert.strictEqual(result.directUpdates[0].newCostPerUnit, 15, "216.000 / 14.400 ml = Rp 15/ml");
  assert.strictEqual(result.directUpdates[0].newPurchasePrice, 15000);
  // HPP: 18*250 + 120*15 + 25*38 + 120*2 + 1000 = 8490
  assert.strictEqual(result.productsToUpdate[0].variants[0].estimatedHpp, 8490);
});

test("Helper Multi-Kemasan (getIngredientPackagingChoices & getPackagingSelectValue) Konsisten untuk Arus Kas & PO", () => {
  const milkIng = sampleIngredients.find((i) => i.id === "ing-fresh-milk")!;
  const choices = getIngredientPackagingChoices(milkIng);

  assert.ok(choices.some((c) => c.key === "PURCHASE" && c.factor === 1000 && c.unit === "Liter"));
  assert.ok(choices.some((c) => c.key === "BASE" && c.factor === 1 && c.unit === "ml"));
  assert.ok(choices.some((c) => c.key === "PRESET:Karton (12L)" && c.factor === 12000));
  assert.ok(choices.some((c) => c.key === "CUSTOM"));
  assert.strictEqual(
    choices.some((c) => c.key === "PRESET:Liter"),
    false,
    "Preset duplikat dengan satuan beli master harus disaring otomatis"
  );

  assert.strictEqual(getPackagingSelectValue({ unitMode: "PURCHASE", unit: "Liter" }, choices), "PURCHASE");
  assert.strictEqual(getPackagingSelectValue({ unitMode: "BASE", unit: "ml" }, choices), "BASE");
  assert.strictEqual(
    getPackagingSelectValue({ unitMode: "PRESET", unit: "Karton (12L)" }, choices),
    "PRESET:Karton (12L)"
  );
  assert.strictEqual(getPackagingSelectValue({ unitMode: "CUSTOM", unit: "Dus" }, choices), "CUSTOM");
});

test("AI NLP Parser Anti-Salah-Baca Kuantitas sebagai Harga (contoh: 6 liter 111rb & 3 gln 28.500)", () => {
  const res1 = parseSmartCoffeeTextEntry(
    "Beli susu Fresh Milk Greenfields 6 liter 111rb kas laci",
    { ingredients: sampleIngredients }
  );
  assert.strictEqual(res1.transactions.length, 1);
  assert.strictEqual(res1.transactions[0].amount, 111000);
  assert.strictEqual(res1.transactions[0].quantity, 6);
  assert.strictEqual(res1.transactions[0].ingredientId, "ing-fresh-milk");
  assert.strictEqual(res1.transactions[0].conversionFactor, 1000);
  assert.strictEqual(res1.transactions[0].accountName, "Laci Kasir");

  const res2 = parseSmartCoffeeTextEntry(
    "Beli air galon RO 3 gln 28.500 kas laci",
    { ingredients: sampleIngredients }
  );
  assert.strictEqual(res2.transactions.length, 1);
  assert.strictEqual(res2.transactions[0].amount, 28500);
  assert.strictEqual(res2.transactions[0].quantity, 3);
  assert.strictEqual(res2.transactions[0].ingredientId, "ing-air");
  assert.strictEqual(res2.transactions[0].conversionFactor, 19000);
});

test("AI NLP Parser Mengenali Typo, Singkatan Chat, Perkalian '@' & Koma Desimal", () => {
  const res = parseSmartCoffeeTextEntry(
    "tf bca beli ssu gf 2 krtn @210rb, kpi hb 2,5kg @ 180.000, sama token pln 500k",
    { ingredients: sampleIngredients }
  );

  assert.strictEqual(res.transactions.length, 3);

  // Item 1: 2 karton susu @ 210rb = 420.000 via Bank BCA
  assert.strictEqual(res.transactions[0].ingredientId, "ing-fresh-milk");
  assert.strictEqual(res.transactions[0].quantity, 2);
  assert.strictEqual(res.transactions[0].conversionFactor, 12000);
  assert.strictEqual(res.transactions[0].amount, 420000);
  assert.strictEqual(res.transactions[0].accountName, "Bank BCA");

  // Item 2: 2,5kg kopi @ 180.000 = 450.000 (koma desimal tidak terpotong & mewarisi Bank BCA)
  assert.strictEqual(res.transactions[1].ingredientId, "ing-coffee-beans");
  assert.strictEqual(res.transactions[1].quantity, 2.5);
  assert.strictEqual(res.transactions[1].conversionFactor, 1000);
  assert.strictEqual(res.transactions[1].amount, 450000);
  assert.strictEqual(res.transactions[1].accountName, "Bank BCA");

  // Item 3: token pln 500k -> Utilitas Rp 500.000
  assert.strictEqual(res.transactions[2].category, "Utilitas");
  assert.strictEqual(res.transactions[2].amount, 500000);
  assert.strictEqual(res.transactions[2].ingredientId, null);
});

// -------------------------------------------------------------
// 18. METRIK F&B: AUTO-OVERHEAD BASELINE, SIMULASI BEP HPP & PRIME COST P&L
// -------------------------------------------------------------
console.log("\n18. Pengujian Metrik F&B: Auto-Overhead Baseline, Simulasi BEP HPP & Prime Cost P&L:");

test("getPreviousPeriodString menangani bulan normal & rollover Januari ke Desember", () => {
  assert.strictEqual(getPreviousPeriodString("2026-11"), "2026-10");
  assert.strictEqual(getPreviousPeriodString("2026-01"), "2025-12");
});

test("computeAutoOverheadBaseline memprioritaskan bulan lalu & mengecualikan BAHAN_BAKU, ASET, TRANSFER", () => {
  const categories: any[] = [
    { id: "cat-bahan-baku", name: "Bahan Baku", type: "BAHAN_BAKU", parentId: null, color: "", icon: "", isActive: true, sortOrder: 1 },
    { id: "cat-hrd", name: "Gaji & SDM", type: "HRD", parentId: null, color: "", icon: "", isActive: true, sortOrder: 2 },
    { id: "cat-utilitas", name: "Listrik & Air", type: "UTILITAS", parentId: null, color: "", icon: "", isActive: true, sortOrder: 3 },
    { id: "cat-sewa", name: "Sewa Ruko", type: "PENGELUARAN", parentId: null, color: "", icon: "", isActive: true, sortOrder: 4 },
    { id: "cat-aset", name: "Pembelian Mesin", type: "ASET", parentId: null, color: "", icon: "", isActive: true, sortOrder: 5 },
  ];

  const cashTrx: any[] = [
    // Bulan lalu (2026-10)
    { id: "c1", accountId: "a1", type: "CASH_OUT", date: "2026-10-05", amount: 9000000, description: "Gaji Barista & Baker", category: "Gaji", categoryId: "cat-hrd" },
    { id: "c2", accountId: "a1", type: "CASH_OUT", date: "2026-10-10", amount: 2500000, description: "Listrik PLN & Air", category: "Utilitas", categoryId: "cat-utilitas" },
    { id: "c3", accountId: "a1", type: "CASH_OUT", date: "2026-10-12", amount: 3500000, description: "Sewa Tempat", category: "Sewa", categoryId: "cat-sewa" },
    // Harus dikecualikan:
    { id: "c4", accountId: "a1", type: "CASH_OUT", date: "2026-10-15", amount: 7000000, description: "Beli Biji Kopi & Susu", category: "Bahan Baku", categoryId: "cat-bahan-baku" },
    { id: "c5", accountId: "a1", type: "CASH_OUT", date: "2026-10-18", amount: 25000000, description: "Beli Mesin Espresso Baru", category: "Aset", categoryId: "cat-aset" },
    { id: "c6", accountId: "a1", type: "CASH_OUT", date: "2026-10-19", amount: 5000000, description: "Transfer Kas", category: "Transfer Antar Kas", referenceId: "TRANSFER:1" },
    // Bulan berjalan (2026-11) - tidak dipakai jika bulan lalu ada
    { id: "c7", accountId: "a1", type: "CASH_OUT", date: "2026-11-02", amount: 500000, description: "Token Listrik", category: "Utilitas", categoryId: "cat-utilitas" },
  ];

  const sales: any[] = [
    { id: "s1", date: "2026-10-15", menuName: "Latte", quantitySold: 1200, totalPrice: 30000000, importLogId: "i1" },
    { id: "s2", date: "2026-10-20", menuName: "Croissant", quantitySold: 800, totalPrice: 20000000, importLogId: "i1" },
  ];

  const baseline = computeAutoOverheadBaseline({
    cashTransactions: cashTrx,
    expenseCategories: categories,
    payrollRecords: [],
    salesTransactions: sales,
    currentPeriod: "2026-11",
  });

  assert.strictEqual(baseline.sourceType, "PREVIOUS_MONTH");
  assert.strictEqual(baseline.referencePeriod, "2026-10");
  assert.strictEqual(baseline.monthlyPayroll, 9000000);
  assert.strictEqual(baseline.monthlyOperational, 6000000);
  assert.strictEqual(baseline.monthlyTotalOpex, 15000000);
  assert.strictEqual(baseline.monthlyStorePortions, 2000);
  assert.strictEqual(baseline.hasActualPortions, true);
});

test("computeAutoOverheadBaseline fallback ke payrollRecords, current month, dan kontrak aktif", () => {
  const categories: any[] = [
    { id: "cat-utilitas", name: "Utilitas", type: "UTILITAS", parentId: null, color: "", icon: "", isActive: true, sortOrder: 1 },
  ];

  // Fallback ke payrollRecords (PAID/APPROVED) ketika tidak ada CASH_OUT HRD di bulan lalu
  const withPayrollRecs = computeAutoOverheadBaseline({
    cashTransactions: [
      { id: "u1", accountId: "a1", type: "CASH_OUT", date: "2026-10-08", amount: 1500000, description: "PLN", category: "Utilitas", categoryId: "cat-utilitas" },
    ],
    expenseCategories: categories,
    payrollRecords: [
      { id: "p1", employeeId: "e1", period: "2026-10", netPay: 4000000, status: "PAID" } as any,
      { id: "p2", employeeId: "e2", period: "2026-10", netPay: 3500000, status: "APPROVED" } as any,
      { id: "p3", employeeId: "e3", period: "2026-10", netPay: 3000000, status: "DRAFT" } as any,
    ],
    salesTransactions: [],
    currentPeriod: "2026-11",
  });
  assert.strictEqual(withPayrollRecs.sourceType, "PREVIOUS_MONTH");
  assert.strictEqual(withPayrollRecs.monthlyPayroll, 7500000);
  assert.strictEqual(withPayrollRecs.monthlyOperational, 1500000);
  assert.strictEqual(withPayrollRecs.hasActualPortions, false);
  assert.strictEqual(withPayrollRecs.monthlyStorePortions, 1500);

  // Fallback ke bulan berjalan jika bulan lalu kosong
  const currentMonthFallback = computeAutoOverheadBaseline({
    cashTransactions: [
      { id: "u2", accountId: "a1", type: "CASH_OUT", date: "2026-11-05", amount: 2000000, description: "Sewa", category: "Operasional" } as any,
    ],
    expenseCategories: categories,
    payrollRecords: [],
    salesTransactions: [],
    currentPeriod: "2026-11",
  });
  assert.strictEqual(currentMonthFallback.sourceType, "CURRENT_MONTH");
  assert.strictEqual(currentMonthFallback.referencePeriod, "2026-11");
  assert.strictEqual(currentMonthFallback.monthlyOperational, 2000000);

  // Fallback ke kontrak aktif jika semua kas & payroll kosong
  const contractFallback = computeAutoOverheadBaseline({
    cashTransactions: [],
    expenseCategories: categories,
    payrollRecords: [],
    employees: [
      { id: "e1", status: "AKTIF" } as any,
      { id: "e2", status: "RESIGN" } as any,
    ],
    contracts: [
      { id: "ct1", employeeId: "e1", status: "ACTIVE", basicSalary: 3000000, mealAllowance: 300000, positionAllowance: 200000, transportAllowance: 200000 } as any,
      { id: "ct2", employeeId: "e2", status: "ACTIVE", basicSalary: 2500000, mealAllowance: 0, positionAllowance: 0, transportAllowance: 0 } as any,
    ],
    salesTransactions: [],
    currentPeriod: "2026-11",
  });
  assert.strictEqual(contractFallback.sourceType, "CONTRACTS_FALLBACK");
  assert.strictEqual(contractFallback.monthlyPayroll, 3700000);
  assert.strictEqual(contractFallback.monthlyOperational, 0);
});

test("calculateHppOverheadSimulation menghitung alokasi overhead, Full Cost, BEP, dan edge case nol/rugi", () => {
  const sim = calculateHppOverheadSimulation({
    totalHpp: 7000,
    targetSellingPrice: 25000,
    monthlyPayroll: 10000000,
    monthlyOperational: 8000000,
    monthlyStorePortions: 3000,
    menuDailyVolume: 50,
  });

  // OPEX 18.000.000 / 3000 = 6.000; Full Cost = 13.000; Net Profit = 12.000 (48%)
  assert.strictEqual(sim.monthlyTotalOpex, 18000000);
  assert.strictEqual(sim.overheadPerPortion, 6000);
  assert.strictEqual(sim.fullCostPerPortion, 13000);
  assert.strictEqual(sim.estimatedNetProfitPerPortion, 12000);
  assert.strictEqual(sim.estimatedNetMarginPercent, 48);
  // Gross profit/cup = 18.000 -> BEP = 1.000 porsi/bulan = 34 porsi/hari
  assert.strictEqual(sim.bepMonthlyPortions, 1000);
  assert.strictEqual(sim.bepDailyPortions, 34);
  // 50 cup * 30 * 18.000 = 27.000.000 -> 150% OPEX
  assert.strictEqual(sim.menuMonthlyGrossProfit, 27000000);
  assert.strictEqual(sim.menuOpexCoveragePercent, 150);
  assert.strictEqual(sim.status, "HEALTHY");

  // Edge case: harga di bawah full cost & gross margin negatif
  const lossSim = calculateHppOverheadSimulation({
    totalHpp: 15000,
    targetSellingPrice: 12000,
    monthlyPayroll: 5000000,
    monthlyOperational: 5000000,
    monthlyStorePortions: 1000,
    menuDailyVolume: 10,
  });
  assert.strictEqual(lossSim.bepMonthlyPortions, null);
  assert.strictEqual(lossSim.bepDailyPortions, null);
  assert.strictEqual(lossSim.status, "LOSS");

  // Edge case: OPEX = 0 tidak menghasilkan NaN/Infinity
  const zeroOpex = calculateHppOverheadSimulation({
    totalHpp: 7000,
    targetSellingPrice: 22000,
    monthlyPayroll: 0,
    monthlyOperational: 0,
    monthlyStorePortions: 0,
    menuDailyVolume: 20,
  });
  assert.strictEqual(zeroOpex.overheadPerPortion, 0);
  assert.strictEqual(zeroOpex.bepMonthlyPortions, null);
  assert.strictEqual(zeroOpex.status, "NO_OPEX");
});

test("calculateFnbHealthMetrics menghitung Food/Labor/Prime Cost % dan BEP Omzet Bulanan", () => {
  // Omzet 60jt, HPP 18jt (30%), Gaji 15jt (25% -> Prime Cost 55%), Total OPEX 21jt
  // Gross Profit = 42jt (70%) -> BEP = ceil(21jt / 0.7) = 30.000.000 -> surplus +30.000.000
  const healthy = calculateFnbHealthMetrics({
    netSales: 60000000,
    effectiveCOGS: 18000000,
    totalHrdExpense: 15000000,
    totalOPEX: 21000000,
  });

  assert.strictEqual(healthy.foodCostPercent, 30);
  assert.strictEqual(healthy.foodCostStatus, "HEALTHY");
  assert.strictEqual(healthy.laborCostPercent, 25);
  assert.strictEqual(healthy.laborCostStatus, "HEALTHY");
  assert.strictEqual(healthy.primeCostAmount, 33000000);
  assert.strictEqual(healthy.primeCostPercent, 55);
  assert.strictEqual(healthy.primeCostStatus, "HEALTHY");
  assert.strictEqual(healthy.nonLaborOpexAmount, 6000000);
  assert.strictEqual(healthy.bepMonthlyRevenue, 30000000);
  assert.strictEqual(healthy.bepGapAmount, 30000000);
  assert.strictEqual(healthy.isAboveBep, true);

  // Omzet di bawah BEP & Prime Cost tinggi
  const shortfall = calculateFnbHealthMetrics({
    netSales: 20000000,
    effectiveCOGS: 8000000, // 40% DANGER
    totalHrdExpense: 6000000, // 30% WARNING -> Prime Cost 70% DANGER
    totalOPEX: 18000000, // Gross Margin 60% -> BEP 30jt -> kurang 10jt
  });
  assert.strictEqual(shortfall.foodCostStatus, "DANGER");
  assert.strictEqual(shortfall.laborCostStatus, "WARNING");
  assert.strictEqual(shortfall.primeCostStatus, "DANGER");
  assert.strictEqual(shortfall.bepMonthlyRevenue, 30000000);
  assert.strictEqual(shortfall.bepGapAmount, -10000000);
  assert.strictEqual(shortfall.isAboveBep, false);

  // Edge case: netSales = 0 dan gross margin <= 0
  const zeroSales = calculateFnbHealthMetrics({
    netSales: 0,
    effectiveCOGS: 5000000,
    totalHrdExpense: 3000000,
    totalOPEX: 6000000,
  });
  assert.strictEqual(zeroSales.foodCostStatus, "NEUTRAL");
  assert.strictEqual(zeroSales.bepMonthlyRevenue, null);
  assert.strictEqual(zeroSales.bepProgressPercent, 0);

  const negativeGross = calculateFnbHealthMetrics({
    netSales: 10000000,
    effectiveCOGS: 12000000,
    totalHrdExpense: 2000000,
    totalOPEX: 5000000,
  });
  assert.strictEqual(negativeGross.bepMonthlyRevenue, null);
  assert.strictEqual(negativeGross.isAboveBep, false);
});

// -------------------------------------------------------------
// 19. PENGUJIAN HPP DENGAN OVERHEAD PERSENTASE MASUK TOTAL HPP
// -------------------------------------------------------------
console.log("\n=========================================================");
console.log("MEMULAI PENGUJIAN OVERHEAD PERSENTASE MASUK TOTAL HPP");
console.log("=========================================================");

test("calculateHppWithOverheadPercentage: Overhead (%) dan Wastage (%) masuk ke Total HPP integer", async () => {
  const { calculateHppWithOverheadPercentage } = await import("../src/utils/financeMetrics");

  const res = calculateHppWithOverheadPercentage({
    rawMaterialCost: 8000,
    packagingCost: 2000,
    wastagePercent: 5,
    overheadPercent: 10,
  });

  assert.strictEqual(res.baseCostBeforePercentage, 10000);
  assert.strictEqual(res.wastageCost, 500);
  assert.strictEqual(res.overheadCost, 1000);
  assert.strictEqual(res.totalHpp, 11500);

  // Nol overhead -> hanya bahan + kemasan + wastage
  const zeroOh = calculateHppWithOverheadPercentage({
    rawMaterialCost: 7500,
    packagingCost: 1500,
    wastagePercent: 0,
    overheadPercent: 0,
  });
  assert.strictEqual(zeroOh.overheadCost, 0);
  assert.strictEqual(zeroOh.totalHpp, 9000);
});

test("calculateCashFlowHppSync: Mempertahankan wastagePercent dan overheadPercent varian saat sinkronisasi harga bahan", async () => {
  const { calculateCashFlowHppSync } = await import("../src/utils/posDomainLogic");

  const syncRes = calculateCashFlowHppSync({
    itemRows: [
      { ingredientId: "ing-bean", qty: 1, totalPrice: 300000, unitMode: "PURCHASE", conversionFactor: 1000 },
    ],
    ingredients: [
      { id: "ing-bean", name: "Espresso Beans", unit: "gr", currentStock: 2000, minStock: 500, category: "Biji Kopi", costPerUnit: 200, purchaseUnit: "Kg", conversionFactor: 1000, purchasePrice: 200000 },
    ],
    batchPreparations: [],
    products: [
      {
        id: "prod-1",
        name: "Americano",
        category: "COFFEE",
        division: "BAR",
        isActive: true,
        createdAt: "2026-11-01T00:00:00Z",
        variants: [
          {
            id: "var-1",
            productId: "prod-1",
            name: "Iced 16oz",
            price: 22000,
            packagingCost: 1500,
            wastagePercent: 5,
            overheadPercent: 10,
            estimatedHpp: 5500,
            isAvailable: true,
            recipe: [{ ingredientId: "ing-bean", quantity: 20 }],
          },
        ],
      },
    ],
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });

  // Harga baru bean = 300/gr -> raw = 20 * 300 = 6000, pack = 1500, base = 7500
  // wastage 5% = 375, overhead 10% = 750 -> total = 8625
  assert.strictEqual(syncRes.productsToUpdate.length, 1);
  assert.strictEqual(syncRes.productsToUpdate[0].variants[0].estimatedHpp, 8625);
});

// -------------------------------------------------------------
// 20. PENGUJIAN KONEKSI PENJUALAN, REKAP, & ARUS KAS TERPUSAT
// -------------------------------------------------------------
console.log("\n=========================================================");
console.log("MEMULAI PENGUJIAN KONEKSI PENJUALAN, REKAP & ARUS KAS");
console.log("=========================================================");

test("computePeriodFinancialSummary: Menggabungkan Sales, Rekap, dan Kas tanpa double-counting & mengecualikan TRANSFER/OPENING", async () => {
  const {
    computePeriodFinancialSummary,
    isNonOperationalCashTransaction,
    getSaleTransactionAmount,
  } = await import("../src/utils/financeMetrics");

  assert.strictEqual(
    isNonOperationalCashTransaction({ category: "Transfer", description: "TRANSFER: Laci -> BCA", referenceId: "TRF-1" }),
    true
  );
  assert.strictEqual(
    isNonOperationalCashTransaction({ category: "Penjualan", description: "OPENING: Modal awal kas", referenceId: "OPENING-1" }),
    true
  );
  assert.strictEqual(
    isNonOperationalCashTransaction({ category: "Penjualan Menu & Kasir", description: "Omzet Harian", referenceId: "recap-1" }),
    false
  );

  assert.strictEqual(
    getSaleTransactionAmount({ id: "s1", date: "2026-11-10", menuName: "Latte", quantitySold: 2, totalPrice: 56000, importLogId: "log1" }),
    56000
  );

  const summary = computePeriodFinancialSummary({
    period: "2026-11",
    dailySalesRecaps: [
      { id: "rec-1", date: "2026-11-01", cashAmount: 400000, qrisAmount: 600000, edcAmount: 0, transferAmount: 0, totalAmount: 1000000, recordedBy: "Kasir", createdAt: "2026-11-01T22:00:00Z" },
    ],
    salesTransactions: [
      // Hari 1 punya recap 1jt & salesTx 950rb -> diambil max 1jt (tanpa double count)
      { id: "s-1", date: "2026-11-01", menuName: "Latte", quantitySold: 19, totalPrice: 950000, importLogId: "log-1" },
      // Hari 2 hanya punya item sales 500rb (belum masuk recap/cash) -> tetap diakui di omzet!
      { id: "s-2", date: "2026-11-02", menuName: "Americano", quantitySold: 20, totalPrice: 500000, importLogId: "log-2" },
    ],
    cashTransactions: [
      // Kas masuk dari recap hari 1 = 1jt
      { id: "c-1", accountId: "acc-1", type: "CASH_IN", amount: 1000000, category: "Penjualan Menu & Kasir", categoryId: "cat-penjualan", description: "Omzet Harian", date: "2026-11-01", referenceId: "rec-1", createdBy: "Kasir" },
      // Transfer internal 2jt dan saldo awal 5jt harus DIABAIKAN
      { id: "c-trf", accountId: "acc-2", type: "CASH_IN", amount: 2000000, category: "Transfer", description: "TRANSFER: Setor Bank", date: "2026-11-01", referenceId: "TRF-123", createdBy: "Admin" },
      { id: "c-open", accountId: "acc-1", type: "CASH_IN", amount: 5000000, category: "Saldo Awal", description: "OPENING: Modal Kasir", date: "2026-11-01", referenceId: "OPENING-1", createdBy: "Admin" },
      // Pengeluaran operasional bahan baku & gaji
      { id: "c-out1", accountId: "acc-1", type: "CASH_OUT", amount: 300000, category: "Bahan Baku", categoryId: "cat-bahan-baku", description: "Beli susu", date: "2026-11-02", createdBy: "Purchasing" },
    ],
    expenseCategories: [
      { id: "cat-penjualan", name: "Penjualan Menu & Kasir", type: "PENDAPATAN", parentId: null, color: "#1b2cc0", icon: "Wallet", isActive: true, sortOrder: 1 },
      { id: "cat-bahan-baku", name: "Bahan Baku", type: "BAHAN_BAKU", parentId: null, color: "#059669", icon: "Package", isActive: true, sortOrder: 2 },
    ],
  });

  // Hari 1 (1.000.000) + Hari 2 (500.000) = 1.500.000
  assert.strictEqual(summary.recognizedRevenue, 1500000);
  // Kas masuk operasional hanya 1.000.000 (transfer & opening dikeluarkan)
  assert.strictEqual(summary.totalOperationalCashIn, 1000000);
  assert.strictEqual(summary.cashSalesInflow, 1000000);
  assert.strictEqual(summary.totalOperationalCashOut, 300000);
  assert.strictEqual(summary.effectiveCOGS, 300000);
  assert.strictEqual(summary.grossProfit, 1200000);
});

// -------------------------------------------------------------
// 21. PENGUJIAN KATEGORI BAHAN & BAHAN OLAHAN
// -------------------------------------------------------------
test("matchesIngredientCategory & normalizeIngredientCategoryName: Mendukung kategori Bahan Olahan & alias lama", async () => {
  const { matchesIngredientCategory, normalizeIngredientCategoryName } = await import("../src/utils/financeMetrics");

  assert.strictEqual(normalizeIngredientCategoryName("Kondimen Olahan"), "Bahan Olahan");
  assert.strictEqual(normalizeIngredientCategoryName("Coffee"), "Biji Kopi");
  assert.strictEqual(matchesIngredientCategory("Kondimen Olahan", "Bahan Olahan"), true);
  assert.strictEqual(matchesIngredientCategory("Bahan Olahan", "Bahan Olahan"), true);
  assert.strictEqual(matchesIngredientCategory("Dairy", "Susu & Dairy"), true);
  assert.strictEqual(matchesIngredientCategory("Biji Kopi", "Bahan Olahan"), false);
});

// -------------------------------------------------------------
// 22. PENGUJIAN PEMULIHAN POS KAS / KATEGORI & FORMAT NOMINAL TITIK
// -------------------------------------------------------------
test("recoverOrphanCashAccountsAndCategories: Memulihkan Pos Kas & Pos Kategori kustom dari transaksi yatim", async () => {
  const { recoverOrphanCashAccountsAndCategories } = await import("../src/utils/financeMetrics");

  const sampleTxs: CashTransaction[] = [
    {
      id: "tx-open-1",
      accountId: "acc-bca-cabang",
      type: "CASH_IN",
      date: "2026-11-20T08:00:00Z",
      amount: 5000000,
      description: "Saldo Awal Pembukaan Pos Kas (Rekening BCA Operasional)",
      category: "Saldo Awal",
      referenceId: "OPENING:acc-bca-cabang",
      paymentMethod: "Transfer Bank",
      createdBy: "Admin",
    },
    {
      id: "tx-out-1",
      accountId: "acc-bca-cabang",
      type: "CASH_OUT",
      date: "2026-11-21T10:00:00Z",
      amount: 350000,
      description: "Beli Gelas Cup Custom",
      category: "Packaging > Cup Sablon Khusus",
      categoryId: "cat-cup-sablon",
      paymentMethod: "Transfer Bank",
      createdBy: "Finance",
    },
  ];

  const recovery = recoverOrphanCashAccountsAndCategories({
    cashAccounts: [{ id: "cash-drawer-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true }],
    cashTransactions: sampleTxs,
    expenseCategories: [],
  });

  assert.strictEqual(recovery.addedAccountCount, 1);
  const restoredAcc = recovery.recoveredAccounts.find((a) => a.id === "acc-bca-cabang");
  assert.ok(restoredAcc, "Pos kas BCA yang terhapus harus dipulihkan kembali");
  assert.strictEqual(restoredAcc.name, "Rekening BCA Operasional");
  assert.strictEqual(restoredAcc.type, "BANK");

  assert.strictEqual(recovery.addedCategoryCount, 1);
  const restoredCat = recovery.recoveredCategories.find((c) => c.id === "cat-cup-sablon");
  assert.ok(restoredCat, "Pos kategori kustom harus dipulihkan dari transaksi");
  assert.strictEqual(restoredCat.name, "Cup Sablon Khusus");
});

test("formatThousandInput & parseThousandInput: Memformat pemisah ribuan titik & membaca desimal koma", async () => {
  const { formatThousandInput, parseThousandInput } = await import("../src/components/common/CurrencyInput");

  assert.strictEqual(formatThousandInput(1500000), "1.500.000");
  assert.strictEqual(formatThousandInput("25000"), "25.000");
  assert.strictEqual(formatThousandInput("18.5", true), "18,5");
  assert.strictEqual(formatThousandInput(12500.75, true), "12.500,75");
  assert.strictEqual(formatThousandInput(""), "");

  assert.strictEqual(parseThousandInput("1.500.000"), "1500000");
  assert.strictEqual(parseThousandInput("Rp 250.000"), "250000");
  assert.strictEqual(parseThousandInput("12.500,75", true), "12500.75");
  assert.strictEqual(parseThousandInput("18,", true), "18.");
  assert.strictEqual(parseThousandInput(",", true), "0.");
  assert.strictEqual(parseThousandInput(",5", true), "0.5");

  assert.strictEqual(formatThousandInput("0.", true, true), "0,");
  assert.strictEqual(formatThousandInput("0.0", true, true), "0,0");
  assert.strictEqual(formatThousandInput("1250.", true), "1.250,");
  assert.strictEqual(formatThousandInput(0, true, true), "");
});

// -------------------------------------------------------------
// 23. PENGUJIAN REKAP ABSENSI & KOREKSI KEHADIRAN MANAGER
// -------------------------------------------------------------
console.log("\n23. Pengujian Rekap Absensi Bulanan & Koreksi Kehadiran:");

test("Koreksi ALPHA/REJECTED -> HADIR/APPROVED langsung memperbarui rekap bulanan", () => {
  const employees: Pick<Employee, "id" | "username" | "name" | "position">[] = [
    { id: "emp-1", username: "rina", name: "Rina Barista", position: "Barista" },
  ];
  const initialLog: DailyAttendance = {
    id: "att-1",
    employeeId: "emp-1",
    date: "2026-11-10",
    clockInTime: null,
    clockOutTime: null,
    clockInLocation: null,
    clockOutLocation: null,
    clockInPhotoUrl: null,
    clockOutPhotoUrl: null,
    status: "ALPHA",
    approvalStatus: "REJECTED",
    notes: "Tidak clock in",
  };

  const before = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: [initialLog],
    employees,
  });
  assert.strictEqual(before.length, 1);
  assert.strictEqual(before[0].presentDays, 0);
  assert.strictEqual(before[0].alphaDays, 1);
  assert.strictEqual(before[0].correctedCount, 0);

  const correctedLog = buildAttendanceCorrectionUpdate(
    initialLog,
    {
      status: "HADIR",
      clockInTime: "07:00",
      clockOutTime: "15:00",
      overtimeApproved: false,
      reason: "Hadir di bar, HP mati saat clock in",
    },
    "Manager Budi"
  );

  const after = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: [correctedLog],
    employees,
  });
  assert.strictEqual(after[0].presentDays, 1);
  assert.strictEqual(after[0].alphaDays, 0);
  assert.strictEqual(after[0].totalWorkHours, 8);
  assert.strictEqual(after[0].correctedCount, 1);
  assert.strictEqual(correctedLog.approvalStatus, "APPROVED");
  assert.strictEqual(correctedLog.isCorrected, true);
  assert.strictEqual(correctedLog.correctedBy, "Manager Budi");
});

test("Koreksi TERLAMBAT -> HADIR menurunkan jumlah terlambat dan membersihkan tag terlambat pada notes", () => {
  const employees: Pick<Employee, "id" | "username" | "name" | "position">[] = [
    { id: "emp-2", username: "doni", name: "Doni Kitchen", position: "Cook" },
  ];
  const lateLog: DailyAttendance = {
    id: "att-2",
    employeeId: "emp-2",
    date: "2026-11-12",
    clockInTime: "2026-11-12T00:05:00.000Z",
    clockOutTime: "2026-11-12T08:05:00.000Z",
    clockInLocation: null,
    clockOutLocation: null,
    clockInPhotoUrl: null,
    clockOutPhotoUrl: null,
    status: "TERLAMBAT",
    approvalStatus: "PENDING",
    notes: "Bantu belanja es • [Terlambat 35 menit]",
  };

  const before = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: [lateLog],
    employees,
  });
  assert.strictEqual(before[0].presentDays, 1);
  assert.strictEqual(before[0].lateDays, 1);

  const corrected = buildAttendanceCorrectionUpdate(
    lateLog,
    {
      status: "HADIR",
      clockInTime: "07:00",
      clockOutTime: "15:00",
      overtimeApproved: false,
      reason: "Beli es batu darurat sebelum ke outlet",
    },
    "Manager Budi"
  );

  assert.strictEqual(/Terlambat\s+\d+\s+menit/i.test(corrected.notes), false);
  assert.ok(corrected.notes.includes("Bantu belanja es"));

  const after = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: [corrected],
    employees,
  });
  assert.strictEqual(after[0].presentDays, 1);
  assert.strictEqual(after[0].lateDays, 0);
  assert.strictEqual(after[0].correctedCount, 1);
});

test("Koreksi jam kerja lintas tengah malam & lembur disahkan memperbarui Total Jam & Lembur", () => {
  const employees: Pick<Employee, "id" | "username" | "name" | "position">[] = [
    { id: "emp-3", username: "sari", name: "Sari Kasir", position: "Kasir" },
  ];
  const baseLog: DailyAttendance = {
    id: "att-3",
    employeeId: "emp-3",
    date: "2026-11-14",
    clockInTime: null,
    clockOutTime: null,
    clockInLocation: null,
    clockOutLocation: null,
    clockInPhotoUrl: null,
    clockOutPhotoUrl: null,
    status: "HADIR",
    approvalStatus: "PENDING",
    notes: "Lupa clock out",
  };

  const corrected = buildAttendanceCorrectionUpdate(
    baseLog,
    {
      status: "HADIR",
      clockInTime: "15:00",
      clockOutTime: "00:30",
      overtimeApproved: true,
      reason: "Closing akhir pekan",
    },
    "Manager Budi"
  );

  assert.strictEqual(
    calculateWorkDurationHours(corrected.clockInTime, corrected.clockOutTime),
    9.5
  );
  assert.strictEqual(corrected.overtimeHours, 1.5);
  assert.strictEqual(corrected.overtimeApproved, true);

  const recap = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: [corrected],
    employees,
  });
  assert.strictEqual(recap[0].totalWorkHours, 9.5);
  assert.strictEqual(recap[0].approvedOvertimeHours, 1.5);
});

test("Koreksi HADIR -> SAKIT/IZIN/ALPHA mengosongkan jam kerja & lembur menjadi 0", () => {
  const employees: Pick<Employee, "id" | "username" | "name" | "position">[] = [
    { id: "emp-4", username: "eko", name: "Eko Baker", position: "Baker" },
  ];
  const presentLog: DailyAttendance = {
    id: "att-4",
    employeeId: "emp-4",
    date: "2026-11-15",
    clockInTime: "2026-11-15T00:00:00.000Z",
    clockOutTime: "2026-11-15T10:00:00.000Z",
    clockInLocation: null,
    clockOutLocation: null,
    clockInPhotoUrl: null,
    clockOutPhotoUrl: null,
    status: "HADIR",
    approvalStatus: "APPROVED",
    overtimeHours: 2,
    overtimeApproved: true,
    notes: "Clock in keliru akun",
  };

  const corrected = buildAttendanceCorrectionUpdate(
    presentLog,
    {
      status: "SAKIT",
      clockInTime: "07:00",
      clockOutTime: "17:00",
      overtimeApproved: true,
      reason: "Ternyata sakit, surat dokter terlampir",
    },
    "Manager Budi"
  );

  assert.strictEqual(corrected.clockInTime, null);
  assert.strictEqual(corrected.clockOutTime, null);
  assert.strictEqual(corrected.overtimeHours, 0);
  assert.strictEqual(corrected.overtimeApproved, false);

  const recap = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: [corrected],
    employees,
  });
  assert.strictEqual(recap[0].presentDays, 0);
  assert.strictEqual(recap[0].sickDays, 1);
  assert.strictEqual(recap[0].totalWorkHours, 0);
  assert.strictEqual(recap[0].approvedOvertimeHours, 0);
});

test("Pemisahan periode antar bulan & resolusi user.id -> employee.id menggabungkan rekap tanpa duplikasi", () => {
  const employees: Pick<Employee, "id" | "username" | "name" | "position">[] = [
    { id: "emp-10", username: "andi", name: "Andi Barista", position: "Barista" },
  ];
  const users: Pick<User, "id" | "username" | "name" | "role" | "employeeId">[] = [
    { id: "user-10", username: "andi", name: "Andi Barista", role: "BAR", employeeId: "emp-10" },
  ];

  assert.strictEqual(resolveCanonicalEmployeeId("user-10", employees, users), "emp-10");
  assert.strictEqual(
    classifyDailyAttendanceStatus({ status: "HADIR", approvalStatus: "REJECTED" }),
    "ALPHA"
  );

  const logs: DailyAttendance[] = [
    {
      id: "d-oct",
      employeeId: "emp-10",
      date: "2026-10-28",
      clockInTime: "2026-10-28T07:00:00",
      clockOutTime: "2026-10-28T15:00:00",
      clockInLocation: null,
      clockOutLocation: null,
      clockInPhotoUrl: null,
      clockOutPhotoUrl: null,
      status: "HADIR",
      approvalStatus: "APPROVED",
      notes: "",
    },
    {
      id: "d-nov-1",
      employeeId: "emp-10",
      date: "2026-11-02",
      clockInTime: "2026-11-02T07:00:00",
      clockOutTime: "2026-11-02T15:00:00",
      clockInLocation: null,
      clockOutLocation: null,
      clockInPhotoUrl: null,
      clockOutPhotoUrl: null,
      status: "HADIR",
      approvalStatus: "APPROVED",
      notes: "",
    },
    {
      id: "d-nov-2",
      employeeId: "user-10",
      date: "2026-11-03",
      clockInTime: "2026-11-03T07:00:00",
      clockOutTime: "2026-11-03T15:00:00",
      clockInLocation: null,
      clockOutLocation: null,
      clockInPhotoUrl: null,
      clockOutPhotoUrl: null,
      status: "TERLAMBAT",
      approvalStatus: "APPROVED",
      notes: "",
    },
  ];

  const octRecap = computeMonthlyAttendanceRecap({
    period: "2026-10",
    dailyAttendances: logs,
    employees,
    users,
  });
  const novRecap = computeMonthlyAttendanceRecap({
    period: "2026-11",
    dailyAttendances: logs,
    employees,
    users,
  });

  assert.strictEqual(octRecap.length, 1);
  assert.strictEqual(octRecap[0].presentDays, 1);
  assert.strictEqual(novRecap.length, 1);
  assert.strictEqual(novRecap[0].employeeId, "emp-10");
  assert.strictEqual(novRecap[0].presentDays, 2);
  assert.strictEqual(novRecap[0].lateDays, 1);
});

test("syncAttendanceRecordsWithDaily menyinkronkan record manual di attendances setelah koreksi harian", () => {
  const employees: Pick<Employee, "id" | "username" | "name" | "position">[] = [
    { id: "emp-20", username: "bima", name: "Bima Cook", position: "Cook" },
  ];
  const dailyLogs: DailyAttendance[] = [
    {
      id: "dl-1",
      employeeId: "emp-20",
      date: "2026-11-05",
      clockInTime: "2026-11-05T07:00:00",
      clockOutTime: "2026-11-05T15:00:00",
      clockInLocation: null,
      clockOutLocation: null,
      clockInPhotoUrl: null,
      clockOutPhotoUrl: null,
      status: "HADIR",
      approvalStatus: "APPROVED",
      isCorrected: true,
      notes: "",
    },
    {
      id: "dl-2",
      employeeId: "emp-20",
      date: "2026-11-06",
      clockInTime: null,
      clockOutTime: null,
      clockInLocation: null,
      clockOutLocation: null,
      clockInPhotoUrl: null,
      clockOutPhotoUrl: null,
      status: "SAKIT",
      approvalStatus: "APPROVED",
      notes: "",
    },
  ];
  const manualAttendances: AttendanceRecord[] = [
    {
      id: "man-1",
      employeeId: "emp-20",
      period: "2026-11",
      presentDays: 0,
      sickDays: 0,
      permissionDays: 0,
      alphaDays: 2,
      holidayDays: 0,
      workingDays: 26,
      notes: "",
      createdBy: "admin",
      createdAt: "2026-11-01T00:00:00Z",
    },
  ];

  const { updatedAttendances, changed } = syncAttendanceRecordsWithDaily({
    dailyAttendances: dailyLogs,
    existingAttendances: manualAttendances,
    affectedPairs: [{ employeeId: "emp-20", period: "2026-11" }],
    employees,
  });

  assert.strictEqual(changed, true);
  assert.strictEqual(updatedAttendances[0].presentDays, 1);
  assert.strictEqual(updatedAttendances[0].sickDays, 1);
  assert.strictEqual(updatedAttendances[0].alphaDays, 0);
});

// -------------------------------------------------------------
// 24. ALUR KEUANGAN TERINTEGRASI (HPP OPSI A, CAPEX, TABUNGAN & REKAP 5 KANAL)
// -------------------------------------------------------------
console.log("\n[SECTION 24] Testing HPP Opsi A (Periodik Opname), CapEx, Tabungan & Rekap 5 Kanal...");

const financeTestCategories: any[] = [
  { id: "cat-penjualan", name: "Penjualan", type: "PENDAPATAN", parentId: null, color: "#10b981", icon: "Wallet", isActive: true, sortOrder: 1 },
  { id: "cat-bahan-baku", name: "Bahan Baku", type: "BAHAN_BAKU", parentId: null, color: "#f59e0b", icon: "Package", isActive: true, sortOrder: 2 },
  { id: "cat-hrd", name: "Gaji Staf", type: "HRD", parentId: null, color: "#8b5cf6", icon: "Users", isActive: true, sortOrder: 3 },
  { id: "cat-utilitas", name: "Listrik & Air", type: "UTILITAS", parentId: null, color: "#3b82f6", icon: "Zap", isActive: true, sortOrder: 4 },
  { id: "cat-ops", name: "Operasional", type: "PENGELUARAN", parentId: null, color: "#64748b", icon: "Building2", isActive: true, sortOrder: 5 },
  { id: "cat-aset", name: "Pembelian Aset & Mesin", type: "ASET", parentId: null, color: "#1b2cc0", icon: "Layers", isActive: true, sortOrder: 6 },
  { id: "cat-admin-bank", name: "Biaya Admin Bank & MDR", type: "LAINNYA", parentId: null, color: "#f59e0b", icon: "CreditCard", isActive: true, sortOrder: 7 },
];

const financeTestAccounts: any[] = [
  { id: "acc-cash", name: "Kas Kasir", type: "CASH", isDefault: true },
  { id: "acc-bank", name: "BCA Operasional", type: "BANK", isDefault: false },
  { id: "acc-save", name: "Tabungan Dana Darurat", type: "SAVINGS", isDefault: false },
];

test("24a. computePeriodicOpnameCogs Opsi A menggabungkan opname parsial divisi & cegah double-count pelunasan PO", () => {
  const ingredients = [
    { id: "ing-bean", name: "Kopi Espresso", unit: "gr", currentStock: 1000, minStock: 500, category: "Kopi", costPerUnit: 300 },
    { id: "ing-flour", name: "Tepung Dapur", unit: "gr", currentStock: 2000, minStock: 500, category: "Dapur", costPerUnit: 20 },
  ];
  const stockOpnames: any[] = [
    { id: "op-oct", date: "2026-10-31", status: "FINAL", notes: null, createdBy: "u1", createdAt: "2026-10-31T20:00:00Z" },
    { id: "op-nov-bar", date: "2026-11-30", status: "FINAL", notes: "BAR", createdBy: "u1", createdAt: "2026-11-30T19:00:00Z" },
    { id: "op-nov-kitchen", date: "2026-11-30", status: "FINAL", notes: "KITCHEN", createdBy: "u1", createdAt: "2026-11-30T20:00:00Z" },
    { id: "op-nov-draft", date: "2026-11-30", status: "DRAFT", notes: "Abai", createdBy: "u1", createdAt: "2026-11-30T21:00:00Z" },
  ];
  // Opening (Okt): bean 1000 * 300 = 300.000 + flour 1000 * 20 = 20.000 => 320.000
  // Closing (Nov): bean 500 * 320 (historical snapshot) = 160.000 + flour 1500 * 20 = 30.000 => 190.000
  const stockOpnameItems: any[] = [
    { id: "oi-1", opnameId: "op-oct", ingredientId: "ing-bean", systemStock: 1000, physicalStock: 1000, difference: 0, unitCost: 300, notes: null },
    { id: "oi-2", opnameId: "op-oct", ingredientId: "ing-flour", systemStock: 1000, physicalStock: 1000, difference: 0, unitCost: 20, notes: null },
    { id: "oi-3", opnameId: "op-nov-bar", ingredientId: "ing-bean", systemStock: 500, physicalStock: 500, difference: 0, unitCost: 320, notes: null },
    { id: "oi-4", opnameId: "op-nov-kitchen", ingredientId: "ing-flour", systemStock: 1500, physicalStock: 1500, difference: 0, unitCost: 20, notes: null },
    { id: "oi-5", opnameId: "op-nov-draft", ingredientId: "ing-bean", systemStock: 500, physicalStock: 0, difference: -500, unitCost: 320, notes: null },
  ];
  const purchaseOrders: any[] = [
    { id: "po-nov-1", poNumber: "PO-01", supplierId: "sup-1", date: "2026-11-10", items: [], totalAmount: 400000, status: "PAID", deliveryStatus: "RECEIVED" },
    { id: "po-nov-pending", poNumber: "PO-02", supplierId: "sup-1", date: "2026-11-20", items: [], totalAmount: 250000, status: "UNPAID", deliveryStatus: "PENDING" },
  ];
  const cashTransactions: any[] = [
    // Pelunasan PO-01 -> tidak boleh dihitung ganda dengan PO RECEIVED!
    { id: "c-po-pay", accountId: "acc-bank", type: "CASH_OUT", date: "2026-11-15", amount: 400000, description: "Pelunasan PO-01", category: "Bahan Baku", categoryId: "cat-bahan-baku", referenceId: "po:po-nov-1" },
    // Belanja bahan tunai non-PO -> masuk directCashMaterialPurchases
    { id: "c-direct", accountId: "acc-cash", type: "CASH_OUT", date: "2026-11-18", amount: 80000, description: "Beli es batu & susu", category: "Bahan Baku", categoryId: "cat-bahan-baku", referenceId: null },
  ];

  const res = computePeriodicOpnameCogs({
    period: "2026-11",
    stockOpnames,
    stockOpnameItems,
    purchaseOrders,
    cashTransactions,
    expenseCategories: financeTestCategories,
    ingredients,
    theoreticalCOGS: 600000,
  });

  // Opening 320.000 + Pembelian (PO Received 400.000 + Non-PO 80.000 = 480.000) - Closing 190.000 = 610.000
  assert.strictEqual(res.cogsMethod, "OPNAME_PERIODIC");
  assert.strictEqual(res.openingInventoryValue, 320000);
  assert.strictEqual(res.poReceivedPurchases, 400000);
  assert.strictEqual(res.directCashMaterialPurchases, 80000);
  assert.strictEqual(res.periodMaterialPurchases, 480000);
  assert.strictEqual(res.closingInventoryValue, 190000);
  assert.strictEqual(res.effectiveCOGS, 610000);
  assert.strictEqual(res.cogsVariance, 10000); // 610.000 - 600.000 teoretis
  assert.strictEqual(res.opnameCoverageCount, 2);
});

test("24b. computePeriodicOpnameCogs fallback ke THEORETICAL_FALLBACK lalu PURCHASE_FALLBACK jika belum ada opname akhir", () => {
  const cashTransactions: any[] = [
    { id: "c-1", accountId: "acc-cash", type: "CASH_OUT", date: "2026-11-05", amount: 150000, description: "Beli susu", category: "Bahan Baku", categoryId: "cat-bahan-baku" },
  ];

  const resTheo = computePeriodicOpnameCogs({
    period: "2026-11",
    stockOpnames: [],
    stockOpnameItems: [],
    purchaseOrders: [],
    cashTransactions,
    expenseCategories: financeTestCategories,
    ingredients: [],
    theoreticalCOGS: 225000,
  });
  assert.strictEqual(resTheo.cogsMethod, "THEORETICAL_FALLBACK");
  assert.strictEqual(resTheo.effectiveCOGS, 225000);
  assert.strictEqual(resTheo.cogsVariance, null);

  const resPurch = computePeriodicOpnameCogs({
    period: "2026-11",
    stockOpnames: [],
    stockOpnameItems: [],
    purchaseOrders: [],
    cashTransactions,
    expenseCategories: financeTestCategories,
    ingredients: [],
    theoreticalCOGS: 0,
  });
  assert.strictEqual(resPurch.cogsMethod, "PURCHASE_FALLBACK");
  assert.strictEqual(resPurch.effectiveCOGS, 150000);
});

test("24c. CapEx (ASET) dipisah dari OPEX agar tidak mendistorsi Laba Bersih", () => {
  const recaps: any[] = [
    { id: "rec-1", date: "2026-11-10", shift: "ALL", cashAmount: 2000000, qrisAmount: 0, edcAmount: 0, transferAmount: 0, totalAmount: 2000000, recordedBy: "kasir" },
  ];
  const cashTransactions: any[] = [
    { id: "c-rev", accountId: "acc-cash", type: "CASH_IN", date: "2026-11-10", amount: 2000000, description: "Rekap Harian", category: "Penjualan", categoryId: "cat-penjualan", referenceId: "recap-cash:rec-1" },
    { id: "c-util", accountId: "acc-bank", type: "CASH_OUT", date: "2026-11-11", amount: 300000, description: "Bayar Listrik PLN", category: "Listrik & Air", categoryId: "cat-utilitas" },
    { id: "c-capex", accountId: "acc-bank", type: "CASH_OUT", date: "2026-11-12", amount: 15000000, description: "Beli Grinder Baru", category: "Pembelian Aset & Mesin", categoryId: "cat-aset" },
    { id: "c-bhn", accountId: "acc-cash", type: "CASH_OUT", date: "2026-11-12", amount: 500000, description: "Beli Kopi", category: "Bahan Baku", categoryId: "cat-bahan-baku" },
  ];

  assert.strictEqual(isCapexCashTransaction(cashTransactions[2], financeTestCategories), true);
  assert.strictEqual(isCapexCashTransaction(cashTransactions[1], financeTestCategories), false);

  const summary = computePeriodFinancialSummary({
    period: "2026-11",
    salesTransactions: [],
    dailySalesRecaps: recaps,
    cashTransactions,
    expenseCategories: financeTestCategories,
    cashAccounts: financeTestAccounts,
  });

  // Laba bersih = Omzet (2.000.000) - COGS (500.000) - OPEX (300.000) = 1.200.000; CapEx 15jt tidak mengurangi laba!
  assert.strictEqual(summary.totalOPEX, 300000);
  assert.strictEqual(summary.capexExpense, 15000000);
  assert.strictEqual(summary.netProfit, 1200000);
});

test("24d. Pemisahan Kas Operasional vs Tabungan (SAVINGS) dan transfer tabungan tidak kurangi Laba", () => {
  const cashTransactions: any[] = [
    { id: "t-open", accountId: "acc-bank", type: "CASH_IN", date: "2026-11-01", amount: 5000000, description: "OPENING: Modal", category: "Saldo Awal" },
    { id: "t-sale", accountId: "acc-cash", type: "CASH_IN", date: "2026-11-05", amount: 3000000, description: "Rekap Omzet", category: "Penjualan", categoryId: "cat-penjualan" },
    // Sisihkan Rp 1.000.000 dari Bank ke Tabungan
    { id: "t-tr-out", accountId: "acc-bank", type: "CASH_OUT", date: "2026-11-10", amount: 1000000, description: "Sisihkan ke Tabungan", category: "Mutasi Tabungan", referenceId: "TRF-SAVE-1" },
    { id: "t-tr-in", accountId: "acc-save", type: "CASH_IN", date: "2026-11-10", amount: 1000000, description: "Terima dari BCA Ops", category: "Mutasi Tabungan", referenceId: "TRF-SAVE-1" },
  ];

  const liq = computeCashLiquidityBreakdown(financeTestAccounts, cashTransactions);
  assert.strictEqual(liq.operationalBalance, 7000000); // Cash 3jt + Bank (5jt - 1jt = 4jt)
  assert.strictEqual(liq.savingsBalance, 1000000);
  assert.strictEqual(liq.totalLiquidity, 8000000);

  const flow = computePeriodSavingsFlow("2026-11", financeTestAccounts, cashTransactions);
  assert.strictEqual(flow.savingsDeposit, 1000000);
  assert.strictEqual(flow.savingsWithdrawal, 0);
  assert.strictEqual(flow.netSavingsAllocation, 1000000);

  const summary = computePeriodFinancialSummary({
    period: "2026-11",
    salesTransactions: [],
    dailySalesRecaps: [],
    cashTransactions,
    expenseCategories: financeTestCategories,
    cashAccounts: financeTestAccounts,
  });
  assert.strictEqual(summary.savingsDeposit, 1000000);
  assert.strictEqual(summary.netProfit, 3000000);
});

test("24e. Rekap 5 Kanal Bayar (termasuk Ojol ke Bank), Diskon, Refund, MDR & Settlement H+1 Pending", () => {
  const recaps: any[] = [
    {
      id: "rec-ojol",
      date: "2026-11-20",
      shift: "ALL",
      cashAmount: 500000,
      qrisAmount: 400000,
      edcAmount: 300000,
      transferAmount: 200000,
      onlineDeliveryAmount: 600000, // Ojol masuk Bank non-tunai
      discountAmount: 50000,
      refundAmount: 25000,
      mdrFeeAmount: 15000,
      totalAmount: 2000000, // Omzet bersih (net sales)
      nonCashSettlementStatus: "PENDING",
      recordedBy: "kasir",
    },
  ];
  const cashTransactions: any[] = [
    { id: "c-cash", accountId: "acc-cash", type: "CASH_IN", date: "2026-11-20", amount: 500000, description: "Rekap Tunai", category: "Penjualan", categoryId: "cat-penjualan", referenceId: "recap-cash:rec-ojol" },
    { id: "c-mdr", accountId: "acc-bank", type: "CASH_OUT", date: "2026-11-20", amount: 15000, description: "Potongan MDR QRIS & EDC", category: "Biaya Admin Bank & MDR", categoryId: "cat-admin-bank", referenceId: "recap-mdr:rec-ojol" },
  ];

  assert.strictEqual(isAdminBankOrMdrTransaction(cashTransactions[1], financeTestCategories), true);

  const summary = computePeriodFinancialSummary({
    period: "2026-11",
    salesTransactions: [],
    dailySalesRecaps: recaps,
    cashTransactions,
    expenseCategories: financeTestCategories,
    cashAccounts: financeTestAccounts,
  });

  assert.strictEqual(summary.paymentBreakdown.onlineDelivery, 600000);
  assert.strictEqual(summary.netSales, 2000000);
  assert.strictEqual(summary.grossSales, 2075000); // 2.000.000 + diskon 50.000 + refund 25.000
  assert.strictEqual(summary.totalMdrFee, 15000);
  assert.strictEqual(summary.totalAdminBankExpense, 15000);
  assert.strictEqual(summary.totalOPEX, 15000);
  assert.strictEqual(summary.pendingNonCashSettlement, 1500000); // 400k + 300k + 200k + 600k
  assert.strictEqual(summary.dailyBreakdown[0].pendingNonCash, 1500000);
  assert.strictEqual(summary.netProfit, 1985000); // 2.000.000 - MDR 15.000
});

// -------------------------------------------------------------
// 25. PENGUJIAN REKAP PENJUALAN PRODUK, VARIAN & CROSS-CHECK OMZET
// -------------------------------------------------------------
console.log("\n25. Pengujian Dashboard Penjualan Produk (PMIX) & Integrasi Katalog Menu:");

test("25a. Resolusi Produk, Varian Spesifik ('- Iced 16oz' vs '- Botol 1 Liter'), Resep & Kategori 3 Tingkat", () => {

  const testIngredients: any[] = [
    { id: "ing-bean", name: "Espresso Beans", unit: "gr", costPerUnit: 250, currentStock: 5000 },
    { id: "ing-milk", name: "Fresh Milk", unit: "ml", costPerUnit: 22, currentStock: 10000 },
    { id: "ing-chx", name: "Ayam Fillet", unit: "gr", costPerUnit: 65, currentStock: 3000 },
  ];

  const testProducts: any[] = [
    {
      id: "prod-kopsu",
      name: "Kopi Susu Gula Aren",
      category: "SIGNATURE COFFEE",
      productGroup: "MINUMAN",
      division: "BAR",
      isActive: true,
      variants: [
        {
          id: "var-iced",
          productId: "prod-kopsu",
          name: "Iced 16oz",
          price: 22000,
          packagingCost: 1000,
          estimatedHpp: 7000,
          isAvailable: true,
          recipe: [
            { ingredientId: "ing-bean", quantity: 18 },
            { ingredientId: "ing-milk", quantity: 120 },
          ],
        },
        {
          id: "var-1l",
          productId: "prod-kopsu",
          name: "Botol 1 Liter",
          price: 85000,
          packagingCost: 3000,
          estimatedHpp: 30000,
          isAvailable: true,
          recipe: [
            { ingredientId: "ing-bean", quantity: 90 },
            { ingredientId: "ing-milk", quantity: 650 },
          ],
        },
      ],
    },
    {
      id: "prod-ayam",
      name: "Nasi Ayam Sambal Matah",
      category: "MAIN COURSE",
      division: "KITCHEN",
      isActive: true,
      variants: [
        {
          id: "var-reg",
          productId: "prod-ayam",
          name: "Reguler",
          price: 35000,
          packagingCost: 1500,
          estimatedHpp: 12000,
          isAvailable: true,
          recipe: [{ ingredientId: "ing-chx", quantity: 120 }],
        },
      ],
    },
  ];

  assert.strictEqual(
    formatCatalogMenuVariantLabel("Kopi Susu Gula Aren", "Botol 1 Liter", 2),
    "Kopi Susu Gula Aren - Botol 1 Liter"
  );
  assert.strictEqual(
    formatCatalogMenuVariantLabel("Nasi Ayam Sambal Matah", "Reguler", 1),
    "Nasi Ayam Sambal Matah"
  );
  assert.strictEqual(inferProductGroup("BAR", "BOTOL 1 LITER", undefined, "Botol 1 Liter"), "KEMASAN & RETAIL");
  assert.strictEqual(inferProductGroup("KITCHEN", "MAIN COURSE"), "MAKANAN");

  // Resolusi varian spesifik Iced 16oz
  const resIced = resolveProductAndVariant(
    "Kopi Susu Gula Aren - Iced 16oz",
    22000,
    testProducts as any,
    [],
    testIngredients as any
  );
  assert.strictEqual(resIced.isMatched, true);
  assert.strictEqual(resIced.variantName, "Iced 16oz");
  assert.strictEqual(resIced.division, "BAR");
  // HPP: (18*250) + (120*22) + 1000 packaging = 4500 + 2640 + 1000 = 8140
  assert.strictEqual(resIced.unitHpp, 8140);

  // Resolusi varian spesifik Botol 1 Liter -> otomatis masuk KEMASAN & RETAIL bila productGroup produk tidak mengikat atau via inferensi
  const resBottle = resolveProductAndVariant(
    "Kopi Susu Gula Aren (Botol 1 Liter)",
    85000,
    testProducts as any,
    [],
    testIngredients as any
  );
  assert.strictEqual(resBottle.isMatched, true);
  assert.strictEqual(resBottle.variantName, "Botol 1 Liter");
  // HPP: (90*250) + (650*22) + 3000 = 22500 + 14300 + 3000 = 39800
  assert.strictEqual(resBottle.unitHpp, 39800);

  // resolveOrderItemIngredients juga memotong stok 90g beans untuk Botol 1L saat input penjualan
  const stockDeductBottle = resolveOrderItemIngredients(
    { menuName: "Kopi Susu Gula Aren - Botol 1 Liter", quantity: 2 },
    [],
    testProducts,
    testIngredients
  );
  const beanUsage = stockDeductBottle.find((u) => u.ingredientId === "ing-bean");
  assert.strictEqual(beanUsage?.totalQuantity, 180); // 2 * 90g
});

test("25b. computeProductSalesAnalytics: Filter Hari/Rentang, Kategori, Cross-Check Omzet, Menu 0 Terjual & Bahan Terpakai", () => {

  const testIngredients: any[] = [
    { id: "ing-bean", name: "Espresso Beans", unit: "gr", costPerUnit: 250, currentStock: 5000 },
    { id: "ing-milk", name: "Fresh Milk", unit: "ml", costPerUnit: 22, currentStock: 10000 },
    { id: "ing-crois", name: "Dough Croissant", unit: "pcs", costPerUnit: 7000, currentStock: 20 },
  ];

  const testProducts: any[] = [
    {
      id: "prod-kopsu",
      name: "Kopi Susu Gula Aren",
      category: "COFFEE",
      productGroup: "MINUMAN",
      division: "BAR",
      isActive: true,
      variants: [
        {
          id: "var-iced",
          productId: "prod-kopsu",
          name: "Iced 16oz",
          price: 22000,
          packagingCost: 1000,
          estimatedHpp: 8140,
          isAvailable: true,
          recipe: [
            { ingredientId: "ing-bean", quantity: 18 },
            { ingredientId: "ing-milk", quantity: 120 },
          ],
        },
        {
          id: "var-hot",
          productId: "prod-kopsu",
          name: "Hot 8oz",
          price: 20000,
          packagingCost: 850,
          estimatedHpp: 8000,
          isAvailable: true,
          recipe: [
            { ingredientId: "ing-bean", quantity: 18 },
            { ingredientId: "ing-milk", quantity: 140 },
          ],
        },
      ],
    },
    {
      id: "prod-crois",
      name: "Butter Croissant",
      category: "BAKERY",
      productGroup: "PASTRY & BAKERY",
      division: "BAKER",
      isActive: true,
      variants: [
        {
          id: "var-crois",
          productId: "prod-crois",
          name: "Single Piece",
          price: 24000,
          packagingCost: 500,
          estimatedHpp: 7500,
          isAvailable: true,
          recipe: [{ ingredientId: "ing-crois", quantity: 1 }],
        },
      ],
    },
  ];

  const salesTx: any[] = [
    { id: "s1", date: "2026-11-20", menuName: "Kopi Susu Gula Aren - Iced 16oz", quantitySold: 10, totalPrice: 220000, importLogId: "l1" },
    { id: "s2", date: "2026-11-21", menuName: "Kopi Susu Gula Aren - Hot 8oz", quantitySold: 5, totalPrice: 100000, importLogId: "l1" },
    { id: "s3", date: "2026-11-21", menuName: "Matcha Seasonal Baru", quantitySold: 2, totalPrice: 60000, importLogId: "l1" },
    { id: "s4", date: "2026-10-15", menuName: "Butter Croissant", quantitySold: 8, totalPrice: 192000, importLogId: "l0" },
  ];

  const recaps: any[] = [
    { id: "r1", date: "2026-11-20", totalAmount: 220000, cashAmount: 220000, qrisAmount: 0, edcAmount: 0, transferAmount: 0, recordedBy: "kasir" },
    { id: "r2", date: "2026-11-22", totalAmount: 350000, cashAmount: 350000, qrisAmount: 0, edcAmount: 0, transferAmount: 0, recordedBy: "kasir" },
  ];

  // Filter rentang 20-23 Nov + Divisi BAR -> hanya s1 & s2 masuk ke PMIX BAR, tapi crossCheck melihat seluruh toko di rentang tanggal tsb
  const barRange = computeProductSalesAnalytics({
    salesTransactions: salesTx,
    dailySalesRecaps: recaps,
    products: testProducts,
    recipes: [],
    ingredients: testIngredients,
    dateMode: "DATE_RANGE",
    singleDate: "2026-11-21",
    startDate: "2026-11-20",
    endDate: "2026-11-23",
    division: "BAR",
    productGroup: "ALL",
    menuCategory: "ALL",
  });

  assert.strictEqual(barRange.productMixRows.length, 1);
  assert.strictEqual(barRange.productMixRows[0].productName, "Kopi Susu Gula Aren");
  assert.strictEqual(barRange.productMixRows[0].totalQty, 15);
  assert.strictEqual(barRange.productMixRows[0].totalRevenue, 320000);
  assert.strictEqual(barRange.productMixRows[0].variantsBreakdown.length, 2);

  // Pemakaian bahan teoretis BAR: 15 * 18g bean = 270g, Milk = (10*120) + (5*140) = 1900ml
  const usedBeans = barRange.ingredientUsageSummary.find((u) => u.ingredientId === "ing-bean");
  const usedMilk = barRange.ingredientUsageSummary.find((u) => u.ingredientId === "ing-milk");
  assert.strictEqual(usedBeans?.totalUsedQty, 270);
  assert.strictEqual(usedMilk?.totalUsedQty, 1900);

  // Unmatched menus pada rentang tanggal tsb mendeteksi Matcha Seasonal Baru (untuk didaftarkan ke Katalog)
  assert.strictEqual(barRange.unmatchedMenuSummaries.length, 1);
  assert.strictEqual(barRange.unmatchedMenuSummaries[0].rawMenuName, "Matcha Seasonal Baru");
  assert.strictEqual(barRange.unmatchedMenuSummaries[0].avgUnitPrice, 30000);

  // Cross-check mendeteksi tanggal 2026-11-22 sudah ada Rekap Omzet Rp 350.000 tapi belum ada penjualan produknya
  assert.strictEqual(barRange.omzetCrossCheck.totalRecapOmzet, 570000);
  assert.strictEqual(barRange.omzetCrossCheck.totalAllProductSales, 380000);
  assert.strictEqual(barRange.omzetCrossCheck.datesWithRecapButNoProducts.length, 1);
  assert.strictEqual(barRange.omzetCrossCheck.datesWithRecapButNoProducts[0].date, "2026-11-22");

  // Filter ALL pada rentang 20-23 Nov -> Butter Croissant aktif namun 0 terjual (terjual hanya di Oktober)
  const allDivRange = computeProductSalesAnalytics({
    salesTransactions: salesTx,
    dailySalesRecaps: recaps,
    products: testProducts,
    recipes: [],
    ingredients: testIngredients,
    dateMode: "DATE_RANGE",
    singleDate: "2026-11-21",
    startDate: "2026-11-20",
    endDate: "2026-11-23",
    division: "ALL",
  });
  assert.strictEqual(allDivRange.zeroSalesProducts.length, 1);
  assert.strictEqual(allDivRange.zeroSalesProducts[0].productName, "Butter Croissant");
});

test("25c. Kemasan Stok (Packaging & Cup) di Resep Varian: Anti-Double-Count HPP & Ikut Terpotong Saat Penjualan", () => {

  const stockIngredients: any[] = [
    { id: "ing-bean", name: "Espresso Beans", category: "Biji Kopi", unit: "gr", costPerUnit: 250, currentStock: 5000 },
    { id: "ing-cup", name: "Cup Plastik 16oz", category: "Packaging & Cup", unit: "pcs", costPerUnit: 650, currentStock: 100 },
    { id: "ing-lid", name: "Flat Lid", category: "Packaging & Cup", unit: "pcs", costPerUnit: 200, currentStock: 100 },
  ];

  const prodList: any[] = [
    {
      id: "prod-latte",
      name: "Cafe Latte",
      category: "COFFEE",
      productGroup: "MINUMAN",
      division: "BAR",
      isActive: true,
      variants: [
        {
          id: "var-iced",
          productId: "prod-latte",
          name: "Iced 16oz",
          price: 25000,
          packagingCost: 850, // catatan biaya kemasan tetap 850 (sama dgn cup 650 + lid 200)
          estimatedHpp: 5350,
          isAvailable: true,
          recipe: [
            { ingredientId: "ing-bean", quantity: 18 },
            { ingredientId: "ing-cup", quantity: 1 },
            { ingredientId: "ing-lid", quantity: 1 },
          ],
        },
      ],
    },
  ];

  // 1. resolveProductAndVariant tidak boleh menggandakan packagingCost 850 + (cup 650 + lid 200)
  const resolved = resolveProductAndVariant("Cafe Latte - Iced 16oz", 25000, prodList as any, [], stockIngredients as any);
  // Beans (18 * 250 = 4500) + Packaging max(850, 850) = 5350 (bukan 6200)
  assert.strictEqual(resolved.unitHpp, 5350);

  // 2. Saat pembelian cup baru (harga naik 650 -> 750), HPP sync juga bebas double count
  const sync = calculateCashFlowHppSync({
    itemRows: [
      { ingredientId: "ing-cup", unitMode: "BASE", conversionFactor: 1, qty: 100, unitPrice: 850, totalPrice: 85000 },
    ],
    ingredients: stockIngredients,
    batchPreparations: [],
    products: prodList,
    recipes: [],
    priceSyncMethod: "LAST_PRICE",
  });
  // Cup baru 850 + Lid 200 = packagingCost baru 1050; Beans 4500 + 1050 = 5550
  assert.strictEqual(sync.productsToUpdate.length, 1);
  assert.strictEqual(sync.productsToUpdate[0].variants[0].packagingCost, 1050);
  assert.strictEqual(sync.productsToUpdate[0].variants[0].estimatedHpp, 5550);

  // 3. Penjualan Cafe Latte - Iced 16oz x 5 otomatis memotong stok cup & lid sebanyak 5 pcs
  const usages = resolveOrderItemIngredients(
    { menuName: "Cafe Latte - Iced 16oz", quantity: 5 },
    [],
    prodList,
    stockIngredients
  );
  assert.strictEqual(usages.find((u) => u.ingredientId === "ing-cup")?.totalQuantity, 5);
  assert.strictEqual(usages.find((u) => u.ingredientId === "ing-lid")?.totalQuantity, 5);
});

test("25d. Import Excel mapSalesRows: Kolom Varian Terpisah & Harga Satuan", () => {

  const rawRows = [
    {
      Date: "2026-11-23",
      "Product Name": "Kopi Susu Gula Aren",
      Variant: "Iced 16oz",
      Qty: 10,
      "Unit Price": 22000,
    },
    {
      Date: "2026-11-23",
      "Product Name": "Kopi Susu Gula Aren (Botol 1 Liter)",
      Variant: "",
      Qty: 2,
      "Net Sales": 170000,
    },
  ];

  const mapped = mapSalesRows(rawRows, [
    "Kopi Susu Gula Aren",
    "Kopi Susu Gula Aren - Iced 16oz",
    "Kopi Susu Gula Aren - Botol 1 Liter",
  ]);

  assert.strictEqual(mapped.rows.length, 2);
  assert.strictEqual(mapped.rows[0].menuName, "Kopi Susu Gula Aren - Iced 16oz");
  assert.strictEqual(mapped.rows[0].totalPrice, 220000);
  assert.strictEqual(mapped.rows[1].menuName, "Kopi Susu Gula Aren - Botol 1 Liter");
  assert.strictEqual(mapped.rows[1].totalPrice, 170000);
});

test("26a. Edit & Hapus Kategori Bahan Baku Memperbarui Alias Warisan & Tidak Hidup Kembali", () => {
  const ingList: Ingredient[] = [
    {
      id: "ing-coffee",
      name: "Espresso Beans",
      unit: "gr",
      currentStock: 1000,
      minStock: 200,
      category: "Coffee",
      costPerUnit: 250,
    },
    {
      id: "ing-syrup-house",
      name: "Simple Syrup Racikan",
      unit: "ml",
      currentStock: 500,
      minStock: 100,
      category: "Bahan Olahan",
      costPerUnit: 15,
    },
  ];

  const initialCats = buildIngredientCategoryList(undefined, ingList);
  assert.ok(initialCats.includes("Biji Kopi"));
  assert.ok(initialCats.includes("Bahan Olahan"));

  // Rename "Biji Kopi" -> "Kopi Pilihan" (wajib ikut memperbarui bahan berlabel warisan "Coffee")
  const renamed = applyRenameIngredientCategory({
    currentList: initialCats,
    oldName: "Biji Kopi",
    newName: "Kopi Pilihan",
    ingredients: ingList,
  });
  assert.ok(renamed.updatedCategories.includes("Kopi Pilihan"));
  assert.ok(!renamed.updatedCategories.includes("Biji Kopi"));
  assert.strictEqual(renamed.updatedIngredients.length, 1);
  assert.strictEqual(renamed.updatedIngredients[0].category, "Kopi Pilihan");

  const updatedIngsAfterRename = ingList.map(
    (ing) => renamed.updatedIngredients.find((u) => u.id === ing.id) || ing
  );
  const rebuiltAfterRename = buildIngredientCategoryList(
    renamed.updatedCategories,
    updatedIngsAfterRename
  );
  assert.ok(!rebuiltAfterRename.includes("Biji Kopi"));
  assert.ok(rebuiltAfterRename.includes("Kopi Pilihan"));

  // Delete "Bahan Olahan" -> bahan dipindah ke "Lainnya" & kategori tidak muncul kembali
  const deleted = applyDeleteIngredientCategory({
    currentList: renamed.updatedCategories,
    targetName: "Bahan Olahan",
    ingredients: updatedIngsAfterRename,
  });
  assert.ok(!deleted.updatedCategories.includes("Bahan Olahan"));
  assert.strictEqual(deleted.updatedIngredients.length, 1);
  assert.strictEqual(deleted.updatedIngredients[0].category, "Lainnya");

  const finalIngredients = updatedIngsAfterRename.map(
    (ing) => deleted.updatedIngredients.find((u) => u.id === ing.id) || ing
  );
  const rebuiltAfterDelete = buildIngredientCategoryList(
    deleted.updatedCategories,
    finalIngredients
  );
  assert.ok(!rebuiltAfterDelete.includes("Bahan Olahan"));
});

test("26b. Edit & Hapus Kategori Menu Per Divisi Menyinkronkan Produk & Filter Analitik", () => {
  const prods: Product[] = [
    {
      id: "prod-1",
      name: "Signature Espresso",
      category: "SIGNATURE COFFEE",
      productGroup: "MINUMAN",
      division: "BAR",
      isActive: true,
      createdAt: "2026-11-23T00:00:00.000Z",
      variants: [
        {
          id: "var-1",
          productId: "prod-1",
          name: "Iced 16oz",
          price: 28000,
          estimatedHpp: 8000,
          isAvailable: true,
        },
      ],
    },
  ];

  const barCats = getDivisionMenuCategories("BAR", undefined, prods);
  assert.ok(barCats.includes("SIGNATURE COFFEE"));

  // Rename "SIGNATURE COFFEE" -> "KOPI SPESIAL"
  const renamed = applyRenameMenuCategory({
    division: "BAR",
    currentCategories: barCats,
    oldName: "SIGNATURE COFFEE",
    newName: "KOPI SPESIAL",
    products: prods,
  });
  assert.ok(renamed.updatedCategories.includes("KOPI SPESIAL"));
  assert.ok(!renamed.updatedCategories.includes("SIGNATURE COFFEE"));
  assert.strictEqual(renamed.updatedProducts.length, 1);
  assert.strictEqual(renamed.updatedProducts[0].category, "KOPI SPESIAL");

  const updatedProducts = prods.map(
    (p) => renamed.updatedProducts.find((u) => u.id === p.id) || p
  );

  // Hapus "KOPI SPESIAL" -> produk dipindahkan ke "LAINNYA"
  const deleted = applyDeleteMenuCategory({
    division: "BAR",
    currentCategories: renamed.updatedCategories,
    targetName: "KOPI SPESIAL",
    products: updatedProducts,
  });
  assert.ok(!deleted.updatedCategories.includes("KOPI SPESIAL"));
  assert.ok(deleted.updatedCategories.includes("LAINNYA"));
  assert.strictEqual(deleted.updatedProducts.length, 1);
  assert.strictEqual(deleted.updatedProducts[0].category, "LAINNYA");

  // Analitik memuat kategori dari Settings
  const analytics = computeProductSalesAnalytics({
    salesTransactions: [],
    products: updatedProducts,
    recipes: [],
    ingredients: [],
    menuCategoriesByDivision: { BAR: ["KOPI SPESIAL", "MATCHA BAR"] },
    dateMode: "ALL",
    singleDate: "2026-11-23",
    startDate: "2026-11-01",
    endDate: "2026-11-23",
    division: "BAR",
  });
  assert.ok(analytics.availableMenuCategories.includes("MATCHA BAR"));
});

test("26c. Edit & Hapus Pos Kategori Keuangan Cascade ke Transaksi & Tidak Hidup Lagi", () => {
  const categories: ExpenseCategory[] = [
    {
      id: "cat-ops",
      name: "Operasional Lama",
      type: "PENGELUARAN",
      parentId: null,
      color: "#1b2cc0",
      icon: "tag",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "cat-ops-sub",
      name: "Transportasi Kurir",
      type: "PENGELUARAN",
      parentId: "cat-ops",
      color: "#1b2cc0",
      icon: "tag",
      isActive: true,
      sortOrder: 2,
    },
  ];
  const txs: CashTransaction[] = [
    {
      id: "tx-1",
      accountId: "cash-drawer-main",
      type: "CASH_OUT",
      date: "2026-11-23",
      amount: 25000,
      description: "Ongkir bahan",
      category: "Transportasi Kurir",
      categoryId: "cat-ops-sub",
    },
  ];
  const budgets: Budget[] = [
    {
      id: "bdg-1",
      categoryId: "cat-ops-sub",
      period: "2026-11",
      targetAmount: 500000,
      amount: 500000,
      notes: "Anggaran kurir",
      createdBy: "manager",
      createdAt: "2026-11-01",
    },
  ];

  // Edit nama sub-kategori
  const updatedSub: ExpenseCategory = {
    ...categories[1],
    name: "Biaya Kurir Harian",
  };
  const txAfterRename = cascadeExpenseCategoryUpdate({
    updatedCategory: updatedSub,
    previousCategory: categories[1],
    cashTransactions: txs,
  });
  assert.strictEqual(txAfterRename[0].category, "Biaya Kurir Harian");

  // Hapus sub-kategori -> transaksi naik ke induk "Operasional Lama" & budget sub dihapus
  const afterDeleteSub = cascadeExpenseCategoryDelete({
    categoryId: "cat-ops-sub",
    categories: categories.map((c) => (c.id === updatedSub.id ? updatedSub : c)),
    cashTransactions: txAfterRename,
    budgets,
  });
  assert.strictEqual(afterDeleteSub.updatedCategories.length, 1);
  assert.strictEqual(afterDeleteSub.updatedTransactions[0].categoryId, "cat-ops");
  assert.strictEqual(afterDeleteSub.updatedTransactions[0].category, "Operasional Lama");
  assert.strictEqual(afterDeleteSub.updatedBudgets.length, 0);

  // Hapus root "Operasional Lama" -> transaksi menjadi "Lainnya" & recovery tidak memunculkan kembali
  const afterDeleteRoot = cascadeExpenseCategoryDelete({
    categoryId: "cat-ops",
    categories: afterDeleteSub.updatedCategories,
    cashTransactions: afterDeleteSub.updatedTransactions,
    budgets: afterDeleteSub.updatedBudgets,
  });
  assert.strictEqual(afterDeleteRoot.updatedCategories.length, 0);
  assert.strictEqual(afterDeleteRoot.updatedTransactions[0].categoryId, null);
  assert.strictEqual(afterDeleteRoot.updatedTransactions[0].category, "Lainnya");

  const recovery = recoverOrphanCashAccountsAndCategories({
    cashAccounts: [
      { id: "cash-drawer-main", name: "Laci Kasir", type: "CASH", isDefault: true },
    ],
    cashTransactions: afterDeleteRoot.updatedTransactions,
    expenseCategories: afterDeleteRoot.updatedCategories,
  });
  assert.strictEqual(recovery.addedCategories.length, 0);
});

test("26d. Hapus Pos Kas Menghapus OPENING TX & Memindahkan Mutasi Tersisa Tanpa Menghidupkan Pos Terhapus", () => {
  const accounts: CashAccount[] = [
    { id: "cash-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true },
    { id: "ewallet-1", name: "Dompet GoPay", type: "E_WALLET", isDefault: false },
  ];
  const txs: CashTransaction[] = [
    {
      id: "tx-open",
      accountId: "ewallet-1",
      type: "CASH_IN",
      date: "2026-11-23",
      amount: 100000,
      description: "Saldo Awal (Dompet GoPay)",
      category: "Saldo Awal",
      categoryId: null,
      referenceId: "OPENING:ewallet-1",
    },
    {
      id: "tx-opex",
      accountId: "ewallet-1",
      type: "CASH_OUT",
      date: "2026-11-23",
      amount: 20000,
      description: "Beli es batu",
      category: "Bahan Baku",
      categoryId: "cat-bahan-baku",
    },
  ];

  const deleted = cascadeCashAccountDelete({
    accountId: "ewallet-1",
    cashAccounts: accounts,
    cashTransactions: txs,
  });
  assert.strictEqual(deleted.transactionsChanged, true);
  assert.strictEqual(deleted.updatedAccounts.length, 1);
  assert.strictEqual(deleted.updatedAccounts[0].id, "cash-main");
  assert.strictEqual(deleted.updatedTransactions.length, 1);
  assert.strictEqual(deleted.updatedTransactions[0].id, "tx-opex");
  assert.strictEqual(deleted.updatedTransactions[0].accountId, "cash-main");

  const recovery = recoverOrphanCashAccountsAndCategories({
    cashAccounts: deleted.updatedAccounts,
    cashTransactions: deleted.updatedTransactions,
    expenseCategories: [],
  });
  assert.strictEqual(recovery.addedAccounts.length, 0);
});

test("26e. Hapus Purchase Order Membalikkan Stok Bahan & Menghapus Mutasi Kas Terkait", () => {
  const po: PurchaseOrder = {
    id: "po-123",
    poNumber: "PO-202611-001",
    supplierId: "sup-1",
    supplierName: "PT Kopi Maju",
    date: "2026-11-23T08:00:00.000Z",
    items: [
      {
        productId: "ing-beans",
        quantity: 2000,
        unit: "gr",
        unitPrice: 250,
        subtotal: 500000,
      },
    ],
    totalAmount: 500000,
    status: "PAID",
    deliveryStatus: "RECEIVED",
  };
  const movements: StockMovement[] = [
    {
      id: "mv-po",
      ingredientId: "ing-beans",
      type: "IN",
      quantity: 2000,
      unitCost: 250,
      totalCost: 500000,
      date: "2026-11-23T08:00:00.000Z",
      note: "PO Masuk Stok: PO-202611-001",
      referenceId: "po-123",
      createdBy: "Manager",
    },
    {
      id: "mv-other",
      ingredientId: "ing-beans",
      type: "IN",
      quantity: 500,
      unitCost: 250,
      totalCost: 125000,
      date: "2026-11-22T08:00:00.000Z",
      note: "Stok Awal",
      createdBy: "Manager",
    },
  ];
  const ingredients: Ingredient[] = [
    {
      id: "ing-beans",
      name: "House Blend Beans",
      unit: "gr",
      currentStock: 2500,
      minStock: 500,
      category: "Biji Kopi",
      costPerUnit: 250,
    },
  ];
  const cashTransactions: CashTransaction[] = [
    {
      id: "trx-po",
      accountId: "cash-main",
      type: "CASH_OUT",
      date: "2026-11-23T08:00:00.000Z",
      amount: 500000,
      description: "Pembelian PO: PO-202611-001",
      category: "Pembelian Bahan",
      categoryId: "cat-bahan-baku",
      referenceId: "po-123",
    },
  ];

  const deleted = cascadePurchaseOrderDelete({
    poId: "po-123",
    purchaseOrders: [po],
    stockMovements: movements,
    ingredients,
    cashTransactions,
  });

  assert.strictEqual(deleted.updatedPurchaseOrders.length, 0);
  assert.strictEqual(deleted.movementsChanged, true);
  assert.strictEqual(deleted.updatedStockMovements.length, 1);
  assert.strictEqual(deleted.updatedStockMovements[0].id, "mv-other");
  assert.strictEqual(deleted.ingredientsChanged, true);
  assert.strictEqual(deleted.updatedIngredients[0].currentStock, 500);
  assert.strictEqual(deleted.cashChanged, true);
  assert.strictEqual(deleted.updatedCashTransactions.length, 0);
});

// -------------------------------------------------------------
// 27. DEEP AUDIT: DB SANITIZERS, RBAC SYNC, & BANK RECONCILIATION
// -------------------------------------------------------------
console.log("\n27. Pengujian Audit Sanitizers DB, RBAC Sync, & Rekonsiliasi Bank:");

test("27a. sanitizeIngredientRecord Mempertahankan Kemasan, Harga Beli, Lokasi, Kode SKU, & Catatan", () => {
  const ing = sanitizeIngredientRecord(
    {
      id: "ing-uht",
      code: "SKU-MILK-01",
      name: "Susu Full Cream UHT",
      unit: "ml",
      currentStock: 12000,
      minStock: 3000,
      category: "Susu & Dairy",
      costPerUnit: 19,
      purchaseUnit: "Karton 12L",
      conversionFactor: 12000,
      purchasePrice: 228000,
      storageLocation: "CHILLER",
      notes: "Simpan di chiller suhu 4C",
    },
    "fallback-id"
  );

  assert.strictEqual(ing.id, "ing-uht");
  assert.strictEqual(ing.code, "SKU-MILK-01");
  assert.strictEqual(ing.purchaseUnit, "Karton 12L");
  assert.strictEqual(ing.conversionFactor, 12000);
  assert.strictEqual(ing.purchasePrice, 228000);
  assert.strictEqual(ing.storageLocation, "CHILLER");
  assert.strictEqual(ing.notes, "Simpan di chiller suhu 4C");
});

test("27b. sanitizeEmployeeContractRecord & formatContractForClient Mempertahankan Field Kontrak Lengkap", () => {
  const saved = sanitizeEmployeeContractRecord(
    {
      id: "ctr-1",
      employeeId: "emp-1",
      basicSalary: 2500000,
      mealAllowance: 25000,
      positionAllowance: 300000,
      transportAllowance: 20000,
      alphaDeductionPerDay: 100000,
      kpiBonusTarget: 500000,
      workingDaysPerMonth: 26,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "INACTIVE",
      notes: "Kontrak Tahun 2026",
    },
    "fallback-ctr"
  );

  assert.strictEqual(saved.transportAllowance, 20000);
  assert.strictEqual(saved.alphaDeductionPerDay, 100000);
  assert.strictEqual(saved.kpiBonusTarget, 500000);
  assert.strictEqual(saved.startDate, "2026-01-01");
  assert.strictEqual(saved.effectiveDate, "2026-01-01");
  assert.strictEqual(saved.endDate, "2026-12-31");
  assert.strictEqual(saved.status, "INACTIVE");

  // Fallback legacy DB row without startDate/status
  const legacyHydrated = formatContractForClient({
    id: "ctr-old",
    employeeId: "emp-2",
    effectiveDate: "2025-06-01",
    basicSalary: 2200000,
    mealAllowance: 20000,
    positionAllowance: 0,
    workingDaysPerMonth: 26,
    notes: "",
  });
  assert.strictEqual(legacyHydrated.startDate, "2025-06-01");
  assert.strictEqual(legacyHydrated.status, "ACTIVE");

  const emp = sanitizeEmployeeRecord(
    {
      id: "emp-1",
      username: "bima",
      name: "Bima",
      position: "Barista",
      department: "BAR",
      employmentType: "TETAP",
      startDate: "2025-01-01",
      phone: "08123",
      email: "bima@julias.id",
      address: "Jakarta",
      status: "AKTIF",
    },
    "emp-fallback"
  );
  assert.strictEqual(emp.email, "bima@julias.id");
});

test("27c. sanitizePayrollRecordData Mempertahankan Tunjangan Transport, Bonus Target, Potongan Telat, & Tier Leader", () => {
  const pr = sanitizePayrollRecordData(
    {
      id: "pay-1",
      employeeId: "emp-1",
      period: "2026-11",
      basicSalary: 2600000,
      mealAllowance: 650000,
      positionAllowance: 400000,
      rawPositionAllowance: 500000,
      leaderJobdeskScore: 85,
      matchedLeaderTier: {
        id: "lar-2",
        grade: "Grade B",
        minScore: 80,
        maxScore: 89,
        payoutPercentage: 80,
        label: "Baik",
      },
      transportAllowance: 520000,
      kpiBonus: 250000,
      targetBonus: 150000,
      alphaDeduction: 0,
      lateDeduction: 45000,
      lateHours: 1.5,
      lateDays: 2,
      overtimePay: 75000,
      overtimeHours: 2,
      overtimeRate: 37500,
      overtimeApproved: true,
      otherDeductions: 0,
      grossPay: 4645000,
      netPay: 4600000,
      status: "APPROVED",
    },
    "pay-fallback"
  );

  assert.strictEqual(pr.transportAllowance, 520000);
  assert.strictEqual(pr.targetBonus, 150000);
  assert.strictEqual(pr.rawPositionAllowance, 500000);
  assert.strictEqual(pr.leaderJobdeskScore, 85);
  assert.strictEqual((pr.matchedLeaderTier as any)?.grade, "Grade B");
  assert.strictEqual(pr.overtimeApproved, true);
  assert.strictEqual(pr.lateDeduction, 45000);
  assert.strictEqual(pr.lateHours, 1.5);
  assert.strictEqual(pr.lateDays, 2);
});

test("27d. sanitizePurchaseOrderRecord, sanitizeKPIRecordData, & KpiTask/Rule Helpers", () => {
  const po = sanitizePurchaseOrderRecord(
    {
      id: "po-market-1",
      poNumber: "PO-PASAR-001",
      supplierId: "market-direct",
      supplierName: "Pasar Kebayoran",
      purchaseType: "MARKET",
      cashAccountId: "cash-drawer-main",
      notes: "Belanja buah & es batu",
      totalAmount: 185000,
      status: "PAID",
      deliveryStatus: "RECEIVED",
      items: [],
    },
    "po-fallback"
  );
  assert.strictEqual(po.supplierName, "Pasar Kebayoran");
  assert.strictEqual(po.purchaseType, "MARKET");
  assert.strictEqual(po.cashAccountId, "cash-drawer-main");
  assert.strictEqual(po.notes, "Belanja buah & es batu");

  const kpi = sanitizeKPIRecordData(
    {
      id: "kpi-1",
      employeeId: "emp-1",
      month: 11,
      year: 2026,
      targets: [{ id: "t1", description: "Speed", weight: 100, score: 92 }],
      totalScore: 92,
      kpiBonus: 300000,
    },
    "kpi-fallback"
  );
  assert.strictEqual(kpi.month, 11);
  assert.strictEqual(kpi.year, 2026);
  assert.strictEqual(kpi.quarter, 4);
  assert.strictEqual(kpi.period, "2026-11");

  const legacyKpi = formatKpiRecordForClient({
    id: "kpi-old",
    employeeId: "emp-1",
    quarter: 2,
    year: 2026,
    targets: [],
    totalScore: 80,
    kpiBonus: 100000,
  });
  assert.strictEqual(legacyKpi.month, 4);
  assert.strictEqual(legacyKpi.period, "2026-04");

  const task = sanitizeKpiTaskRecord(
    { id: "kt-1", employeeId: "emp-1", period: "2026-11", taskName: "Kalibrasi", weight: 20, target: 30, realization: 28, score: 18.6 },
    "kt-fb"
  );
  const rule = sanitizeKpiBonusRuleRecord(
    { id: "kr-1", minScore: 90, maxScore: 100, bonusAmount: 500000, isActive: true },
    "kr-fb"
  );
  assert.strictEqual(task.taskName, "Kalibrasi");
  assert.strictEqual(rule.bonusAmount, 500000);
});

test("27e. applyRoleSyncRestrictions Memblokir Role BAR Secara Ketat namun Mengizinkan LEADER Sync Belanja/Stok", () => {
  const samplePayload = {
    users: [{ id: "u1" }],
    settings: { brandName: "Hacked" },
    payroll_records: [{ id: "p1" }],
    suppliers: [{ id: "sup1" }],
    purchase_orders: [{ id: "po1" }],
    cash_transactions: [{ id: "tx1" }],
    ingredients: [{ id: "ing1" }],
    dailyAttendances: [{ id: "da1" }],
    dailyChecklists: [{ id: "dc1" }],
  };

  const barFiltered = applyRoleSyncRestrictions("BAR", samplePayload);
  assert.strictEqual(barFiltered.users, undefined);
  assert.strictEqual(barFiltered.settings, undefined);
  assert.strictEqual(barFiltered.payroll_records, undefined);
  assert.strictEqual(barFiltered.suppliers, undefined);
  assert.strictEqual(barFiltered.purchase_orders, undefined);
  assert.strictEqual(barFiltered.cash_transactions, undefined);
  assert.strictEqual(barFiltered.ingredients, undefined);
  assert.strictEqual(Array.isArray(barFiltered.dailyAttendances), true);
  assert.strictEqual(Array.isArray(barFiltered.dailyChecklists), true);

  const leaderFiltered = applyRoleSyncRestrictions("LEADER", samplePayload);
  assert.strictEqual(leaderFiltered.users, undefined);
  assert.strictEqual(leaderFiltered.settings, undefined);
  assert.strictEqual(leaderFiltered.payroll_records, undefined);
  assert.strictEqual(Array.isArray(leaderFiltered.suppliers), true);
  assert.strictEqual(Array.isArray(leaderFiltered.purchase_orders), true);
  assert.strictEqual(Array.isArray(leaderFiltered.cash_transactions), true);
  assert.strictEqual(Array.isArray(leaderFiltered.ingredients), true);
  assert.strictEqual(Array.isArray(leaderFiltered.dailyChecklists), true);
});

test("27f. Rekonsiliasi Bank: Klasifikasi DEBIT Nominal Positif & Matching 1-ke-1 Anti-Dobel", () => {
  assert.strictEqual(resolveBankStatementType("DEBIT", 150000), "DEBIT");
  assert.strictEqual(resolveBankStatementType("CREDIT", -50000), "CREDIT");
  assert.strictEqual(resolveBankStatementType("", -75000), "DEBIT");
  assert.strictEqual(resolveBankStatementType("", 75000), "CREDIT");

  const sysTxs: CashTransaction[] = [
    {
      id: "tx-qris-1",
      accountId: "bank-bca",
      type: "CASH_IN",
      date: "2026-11-20",
      amount: 100000,
      description: "Settlement QRIS 1",
      category: "Penjualan",
    },
    {
      id: "tx-fee-1",
      accountId: "bank-bca",
      type: "CASH_OUT",
      date: "2026-11-20",
      amount: 25000,
      description: "Biaya Admin Bank",
      category: "Biaya Bank",
    },
  ];

  let seq = 0;
  const matched = matchBankStatementLines(
    [
      { date: "2026-11-20", description: "QRIS MASUK A", amount: "100000", type: "CREDIT" },
      { date: "2026-11-20", description: "QRIS MASUK B (Kembar)", amount: "100000", type: "CREDIT" },
      { date: "2026-11-20", description: "ADM BANK", amount: "25000", type: "DEBIT" },
    ],
    sysTxs,
    "recon-1",
    () => `line-${++seq}`,
    "2026-11-20T12:00:00.000Z"
  );

  assert.strictEqual(matched.length, 3);
  assert.strictEqual(matched[0].transactionType, "CREDIT");
  assert.strictEqual(matched[0].isMatched, true);
  assert.strictEqual(matched[0].matchedTransactionId, "tx-qris-1");
  // Baris ke-2 nominal kembar Rp 100.000 tidak boleh ikut match ke tx-qris-1 yang sama!
  assert.strictEqual(matched[1].isMatched, false);
  assert.strictEqual(matched[1].matchedTransactionId, null);
  // Baris ke-3 DEBIT nominal positif tetap terbaca DEBIT & match ke CASH_OUT!
  assert.strictEqual(matched[2].transactionType, "DEBIT");
  assert.strictEqual(matched[2].isMatched, true);
  assert.strictEqual(matched[2].matchedTransactionId, "tx-fee-1");
});

// -------------------------------------------------------------
// 28. ZONA 1: AUTH, SESI PERANGKAT, RBAC & ISOLASI GEMINI KEY
// -------------------------------------------------------------
console.log("\n28. Pengujian Zona 1: Sesi Perangkat, RBAC & Keamanan Pengaturan:");

test("28a. filterVisibleSessionsForUser & canRevokeTargetSession Mengisolasi Sesi Non-Admin", () => {
  const sessions = [
    { id: "s-admin", userId: "admin-1", status: "ACTIVE" },
    { id: "s-kasir-1", userId: "kasir-1", status: "ACTIVE" },
    { id: "s-kasir-2", userId: "kasir-1", status: "ACTIVE" },
    { id: "s-fin-1", userId: "fin-1", status: "ACTIVE" },
  ];

  // Kasir hanya melihat sesinya sendiri
  const kasirVisible = filterVisibleSessionsForUser(sessions, { id: "kasir-1", role: "KASIR" });
  assert.deepStrictEqual(kasirVisible.map((s) => s.id), ["s-kasir-1", "s-kasir-2"]);

  // Manager & Super Admin melihat semua sesi
  const mgrVisible = filterVisibleSessionsForUser(sessions, { id: "mgr-1", role: "MANAGER" });
  assert.strictEqual(mgrVisible.length, 4);

  // Kasir tidak boleh mencabut sesi milik Finance, hanya boleh sesi miliknya
  assert.strictEqual(
    canRevokeTargetSession({ id: "kasir-1", role: "KASIR" }, { userId: "fin-1" }),
    false
  );
  assert.strictEqual(
    canRevokeTargetSession({ id: "kasir-1", role: "KASIR" }, { userId: "kasir-1" }),
    true
  );
  // Manager boleh mencabut sesi perangkat lain siapa pun
  assert.strictEqual(
    canRevokeTargetSession({ id: "mgr-1", role: "MANAGER" }, { userId: "fin-1" }),
    true
  );
});

test("28b. selectSessionsToRevokeOthers Menjaga Scope Per-User vs Privilege Manager/Admin", () => {
  const sessions = [
    { id: "s-admin", userId: "admin-1", status: "ACTIVE" },
    { id: "s-kasir", userId: "kasir-1", status: "ACTIVE" },
    { id: "s-fin-1", userId: "fin-1", status: "ACTIVE" },
    { id: "s-fin-2", userId: "fin-1", status: "ACTIVE" },
    { id: "s-revoked", userId: "fin-1", status: "REVOKED" },
  ];

  // Finance yang mengklik "Keluarkan Semua Perangkat Lain" hanya memutus sesi miliknya sendiri selain current
  const finTargets = selectSessionsToRevokeOthers(
    sessions,
    { id: "fin-1", role: "FINANCE" },
    "s-fin-1"
  );
  assert.deepStrictEqual(finTargets.map((s) => s.id), ["s-fin-2"]);

  // Manager / Super Admin memutus seluruh perangkat aktif lain yang tampil selain current
  const adminTargets = selectSessionsToRevokeOthers(
    sessions,
    { id: "admin-1", role: "SUPER_ADMIN" },
    "s-admin"
  );
  assert.deepStrictEqual(adminTargets.map((s) => s.id), ["s-kasir", "s-fin-1", "s-fin-2"]);
});

test("28c. resolveGeminiApiKeyForSave Mencegah Manager Menimpa API Key Super Admin", () => {
  // Manager menyimpan pengaturan dengan geminiApiKey kosong (karena server mem-mask dari UI Manager)
  const keptForManager = resolveGeminiApiKeyForSave({
    role: "MANAGER",
    incomingKey: "",
    existingKey: "AIzaSySecretProdKey123",
    envKey: null,
  });
  assert.strictEqual(keptForManager, "AIzaSySecretProdKey123");

  // Super Admin mengubah API key secara sah
  const updatedBySuperAdmin = resolveGeminiApiKeyForSave({
    role: "SUPER_ADMIN",
    incomingKey: "  AIzaSyNewKey999  ",
    existingKey: "AIzaSySecretProdKey123",
    envKey: null,
  });
  assert.strictEqual(updatedBySuperAdmin, "AIzaSyNewKey999");

  // Nilai masked ("••••...") tidak boleh menimpa key asli meski oleh Super Admin
  const maskedKept = resolveGeminiApiKeyForSave({
    role: "SUPER_ADMIN",
    incomingKey: "•••••••123",
    existingKey: "AIzaSySecretProdKey123",
    envKey: null,
  });
  assert.strictEqual(maskedKept, "AIzaSySecretProdKey123");
});

// -------------------------------------------------------------
// 29. ZONA 2: INVENTORI, STOK OPNAME, MUTASI & RESEP BOM
// -------------------------------------------------------------
console.log("\n29. Pengujian Zona 2: Inventori, Stok Opname, Mutasi & Resep:");

test("29a. dedupeRecipesByMenuName Menghapus Duplikat Case-Insensitive & Nama Kosong", () => {
  const input = [
    { id: "r1", menuName: "  Kopi Susu Gula Aren ", ingredients: [] },
    { id: "r2", menuName: "kopi susu gula aren", ingredients: [{ ingredientId: "ing-1", quantity: 18 }] },
    { id: "r3", menuName: "   ", ingredients: [] },
    { id: "r4", menuName: "Matcha Latte", ingredients: [{ ingredientId: "ing-2", quantity: 15 }] },
  ];
  const result = dedupeRecipesByMenuName(input);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].id, "r2");
  assert.strictEqual(result[1].id, "r4");
});

test("29b. recomputeOpnameItemsWithLiveStock Menghitung Ulang Selisih Draf Terhadap Stok Terkini", () => {
  const draftItems = [
    { ingredientId: "ing-1", physicalStock: 4200, difference: 0, notes: "Tumpah saat brew" },
    { ingredientId: "ing-2", physicalStock: 3500, difference: -500, notes: "" },
  ];
  // Stok live berubah karena ada PO / penjualan setelah draf dibuat
  const liveIngredients = [
    { id: "ing-1", currentStock: 4500, costPerUnit: 250 },
    { id: "ing-2", currentStock: 3000, costPerUnit: 20 },
  ];
  const recomputed = recomputeOpnameItemsWithLiveStock(draftItems, liveIngredients);
  assert.strictEqual(recomputed[0].systemStock, 4500);
  assert.strictEqual(recomputed[0].difference, -300);
  assert.strictEqual(recomputed[0].unitCost, 250);
  assert.strictEqual(recomputed[0].adjustmentTotalCost, 75000);
  assert.strictEqual(recomputed[1].systemStock, 3000);
  assert.strictEqual(recomputed[1].difference, 500);
  assert.strictEqual(recomputed[1].adjustmentTotalCost, 10000);
});

test("29c. computeMovementActualQuantityAndCost Menghitung Qty Aktual & Biaya Integer di Mode Kemasan vs Dasar", () => {
  const baseRes = computeMovementActualQuantityAndCost({
    quantity: 35,
    unitMode: "BASE",
    hasConversion: true,
    conversionFactor: 1000,
    costPerUnit: 220,
  });
  assert.strictEqual(baseRes.actualQuantity, 35);
  assert.strictEqual(baseRes.totalCost, 7700);

  // Jika dicatat dalam mode kemasan (mis. 2 Kg kopi = 2000 gr -> 2000 * 220 = Rp 440.000)
  const purchaseRes = computeMovementActualQuantityAndCost({
    quantity: 2,
    unitMode: "PURCHASE",
    hasConversion: true,
    conversionFactor: 1000,
    costPerUnit: 220,
  });
  assert.strictEqual(purchaseRes.actualQuantity, 2000);
  assert.strictEqual(purchaseRes.totalCost, 440000);
});

test("29d. convertStockInputOnUnitToggle Mengonversi Input Stok Dasar <-> Kemasan Tanpa Lonjakan 1000x", () => {
  const toPurchase = convertStockInputOnUnitToggle({
    currentValue: 5000,
    fromUnit: "BASE",
    toUnit: "PURCHASE",
    conversionFactor: 1000,
  });
  assert.strictEqual(toPurchase, 5);

  const toBase = convertStockInputOnUnitToggle({
    currentValue: 2.5,
    fromUnit: "PURCHASE",
    toUnit: "BASE",
    conversionFactor: 1000,
  });
  assert.strictEqual(toBase, 2500);

  // Toggle ulang ke unit yang sama tidak mengubah nilai
  assert.strictEqual(
    convertStockInputOnUnitToggle({
      currentValue: 1200,
      fromUnit: "BASE",
      toUnit: "BASE",
      conversionFactor: 1000,
    }),
    1200
  );
});

test("29e. validateRecipeSubmission & resolveDefaultTransferStation Memblokir Duplikat & Memetakan Divisi Baker", () => {
  const dupMenu = validateRecipeSubmission({
    menuName: "kopi susu gula aren",
    ingredients: [{ ingredientId: "ing-1", quantity: 18 }],
    existingRecipes: [{ id: "rec-1", menuName: "Kopi Susu Gula Aren" }],
    editingRecipeId: null,
  });
  assert.strictEqual(dupMenu.ok, false);

  // Edit diri sendiri diperbolehkan
  const selfEdit = validateRecipeSubmission({
    menuName: "Kopi Susu Gula Aren",
    ingredients: [{ ingredientId: "ing-1", quantity: 20 }],
    existingRecipes: [{ id: "rec-1", menuName: "Kopi Susu Gula Aren" }],
    editingRecipeId: "rec-1",
  });
  assert.strictEqual(selfEdit.ok, true);

  // Bahan baku duplikat dalam satu resep ditolak
  const dupIng = validateRecipeSubmission({
    menuName: "Menu Baru",
    ingredients: [
      { ingredientId: "ing-1", quantity: 10 },
      { ingredientId: "ing-1", quantity: 15 },
    ],
    existingRecipes: [],
  });
  assert.strictEqual(dupIng.ok, false);

  // Baker dipetakan ke BAKERY (bukan "BAKER" yang tidak ada di opsi stasiun)
  assert.strictEqual(
    resolveDefaultTransferStation({ ingredientStorageLocation: undefined, userDivision: "BAKER" }),
    "BAKERY"
  );
  // Jika bahan punya storageLocation valid, ikuti lokasi bahan
  assert.strictEqual(
    resolveDefaultTransferStation({ ingredientStorageLocation: "CHILLER", userDivision: "BAR" }),
    "CHILLER"
  );
});

// -------------------------------------------------------------
// 30. ZONA 3: KALKULATOR HPP, MANAJEMEN MENU & BATCH PREP
// -------------------------------------------------------------
console.log("\n30. Pengujian Zona 3: Kalkulator HPP, Manajemen Menu & Batch Prep:");

test("30a. splitRecipeItemsAndPackaging Memisahkan Kemasan & Menggabungkan Duplikat Agar HPP Tidak Ganda", () => {
  const mockIngs = [
    { id: "ing-bean", name: "Espresso Beans", unit: "gr", costPerUnit: 250, category: "Biji Kopi" },
    { id: "ing-cup", name: "Cup Plastic 16oz", unit: "pcs", costPerUnit: 700, category: "Packaging & Cup" },
  ];
  const rawRecipe = JSON.stringify([
    { ingredientId: "ing-bean", quantity: 10 },
    { ingredientId: "ing-bean", quantity: 8 },
    { ingredientId: "ing-cup", quantity: 1 },
  ]);
  const split = splitRecipeItemsAndPackaging({
    rawRecipe,
    ingredients: mockIngs,
    isPackagingCheck: (ing) => ing.category === "Packaging & Cup",
  });
  assert.strictEqual(split.materialItems.length, 1);
  assert.strictEqual(split.materialItems[0].quantity, 18);
  assert.deepStrictEqual(split.packagingIngredientIds, ["ing-cup"]);
});

test("30b. computeSignedMarginMetrics Mempertahankan Laba Rugi Negatif Saat HPP Melebihi Harga Jual", () => {
  const loss = computeSignedMarginMetrics(15000, 18500);
  assert.strictEqual(loss.grossProfit, -3500);
  assert.strictEqual(loss.isLoss, true);
  assert.ok(loss.grossMarginPercent < 0);

  const profit = computeSignedMarginMetrics(25000, 8000);
  assert.strictEqual(profit.grossProfit, 17000);
  assert.strictEqual(profit.isLoss, false);
  assert.strictEqual(profit.foodCostPercent, 32);
});

test("30c. recalculateVariantFromLiveIngredients Mengikuti Kenaikan Maupun Penurunan Harga Kemasan & Resep String JSON", () => {
  const mockIngs = [
    { id: "ing-bean", name: "Espresso Beans", costPerUnit: 250, category: "Biji Kopi" },
    { id: "ing-cup", name: "Cup Plastic 16oz", costPerUnit: 500, category: "Packaging & Cup" }, // turun dari 900 -> 500
  ];
  const variant = {
    id: "v1",
    price: 25000,
    packagingCost: 900,
    wastagePercent: 0,
    overheadPercent: 0,
    estimatedHpp: 5400,
    recipe: [],
  };
  const fallbackJson = JSON.stringify([
    { ingredientId: "ing-bean", quantity: 18 }, // 4500
    { ingredientId: "ing-cup", quantity: 1 }, // 500
  ]);
  const res = recalculateVariantFromLiveIngredients({
    variant,
    fallbackRecipe: fallbackJson,
    ingredients: mockIngs,
    isPackagingCheck: (ing) => ing.category === "Packaging & Cup",
  });
  assert.strictEqual(res.changed, true);
  assert.strictEqual(res.updatedVariant.packagingCost, 500);
  assert.strictEqual(res.updatedVariant.estimatedHpp, 5000);
  assert.strictEqual(res.updatedVariant.recipe.length, 2);
});

test("30d. validateBatchPrepSubmission Menolak Yield Nol, Kosong & Self-Reference Serta Menggabungkan Bahan Duplikat", () => {
  const zeroYield = validateBatchPrepSubmission({
    name: "Gula Aren Cair",
    targetIngredientName: "Gula Aren Cair",
    yieldQuantity: 0,
    ingredients: [{ ingredientId: "ing-1", quantity: 500 }],
  });
  assert.strictEqual(zeroYield.ok, false);

  const selfRef = validateBatchPrepSubmission({
    name: "Gula Aren Cair",
    targetIngredientId: "ing-aren-cair",
    targetIngredientName: "Gula Aren Cair",
    yieldQuantity: 1000,
    ingredients: [{ ingredientId: "ing-aren-cair", quantity: 200 }],
  });
  assert.strictEqual(selfRef.ok, false);

  const validDup = validateBatchPrepSubmission({
    name: "Gula Aren Cair",
    targetIngredientId: "ing-aren-cair",
    targetIngredientName: "Gula Aren Cair",
    yieldQuantity: 1000,
    ingredients: [
      { ingredientId: "ing-gula", quantity: 400 },
      { ingredientId: "ing-gula", quantity: 100 },
    ],
  });
  assert.strictEqual(validDup.ok, true);
  if (validDup.ok) {
    assert.deepStrictEqual(validDup.mergedIngredients, [{ ingredientId: "ing-gula", quantity: 500 }]);
  }
});

test("30e. resolveDivisionStorageLocation Memetakan Divisi BAR, KITCHEN & BAKER ke Lokasi Stok Tepat", () => {
  assert.strictEqual(resolveDivisionStorageLocation("BAR"), "BAR");
  assert.strictEqual(resolveDivisionStorageLocation("KITCHEN"), "KITCHEN");
  assert.strictEqual(resolveDivisionStorageLocation("BAKER"), "BAKERY");
});

// -------------------------------------------------------------
// 31. AUDIT ZONA 4 (SUPPLIER, PO, BELANJA PASAR & HUTANG DAGANG)
// -------------------------------------------------------------
console.log("\n31. Audit Zona 4 (Supplier, Purchase Order & Hutang Dagang):");

test("31a. getLocalPeriodFromTimestamp & addDaysToLocalDate Akurat di Batas Hari WITA & Pergantian Bulan", () => {
  assert.strictEqual(
    getLocalPeriodFromTimestamp("2026-10-31T22:30:00.000Z"),
    "2026-11",
    "22:30 UTC adalah 06:30 WITA tanggal 1 bulan berikutnya (2026-11)"
  );
  assert.strictEqual(getLocalPeriodFromTimestamp("2026-10-15"), "2026-10");
  assert.strictEqual(getLocalPeriodFromTimestamp("2026-10"), "2026-10");
  assert.strictEqual(addDaysToLocalDate("2026-10-28", 7), "2026-11-04");
  assert.strictEqual(addDaysToLocalDate("2026-12-25", 14), "2027-01-08");
});

test("31b. computeDueDateStatus Selaras dengan Filter <= 7 Hari, Jatuh Tempo Hari Ini & Lewat Tempo", () => {
  const overdue = computeDueDateStatus("2026-11-22", "2026-11-24");
  assert.strictEqual(overdue.variant, "overdue");
  assert.strictEqual(overdue.days, -2);

  const dueToday = computeDueDateStatus("2026-11-24", "2026-11-24");
  assert.strictEqual(dueToday.variant, "due_today");
  assert.strictEqual(dueToday.days, 0);

  const dueSoon5 = computeDueDateStatus("2026-11-29", "2026-11-24");
  assert.strictEqual(dueSoon5.variant, "due_soon");
  assert.strictEqual(dueSoon5.days, 5);

  const normal10 = computeDueDateStatus("2026-12-04", "2026-11-24");
  assert.strictEqual(normal10.variant, "normal");
  assert.strictEqual(normal10.days, 10);

  const empty = computeDueDateStatus(undefined, "2026-11-24");
  assert.strictEqual(empty.variant, "default");
});

test("31c. validateSupplierSubmission Menolak Kosong/Duplikat & Membersihkan Input Opsional", () => {
  const existing = [{ id: "sup-1", name: "PT Kopi Nusantara" }];

  const emptyName = validateSupplierSubmission({
    name: "   ",
    contact: "08123",
    existingSuppliers: existing,
  });
  assert.strictEqual(emptyName.ok, false);

  const missingContact = validateSupplierSubmission({
    name: "CV Susu Segar",
    contact: "  ",
    existingSuppliers: existing,
  });
  assert.strictEqual(missingContact.ok, false);

  const dupName = validateSupplierSubmission({
    name: " pt kopi nusantara ",
    contact: "0812999",
    existingSuppliers: existing,
  });
  assert.strictEqual(dupName.ok, false);

  const selfEdit = validateSupplierSubmission({
    name: "PT Kopi Nusantara",
    contact: "0812999888",
    picName: "  ",
    address: "",
    notes: " TOP 14 hari ",
    existingSuppliers: existing,
    editingId: "sup-1",
  });
  assert.strictEqual(selfEdit.ok, true);
  if ("data" in selfEdit) {
    assert.strictEqual(selfEdit.data.picName, "-");
    assert.strictEqual(selfEdit.data.address, "-");
    assert.strictEqual(selfEdit.data.notes, "TOP 14 hari");
  }
});

test("31d. validatePoCheckoutInput Memvalidasi Item, Total > 0, Supplier & Akun Kas Secara Ketat", () => {
  const baseItem = {
    productId: "ing-1",
    quantity: 2,
    unitPrice: 120000,
    conversionFactor: 1000,
    subtotal: 240000,
  };

  assert.strictEqual(
    validatePoCheckoutInput({
      mode: "DISTRIBUTOR",
      paymentMethod: "CASH",
      supplierId: "sup-1",
      cashAccountId: "acc-1",
      items: [],
    }).ok,
    false
  );

  assert.strictEqual(
    validatePoCheckoutInput({
      mode: "DISTRIBUTOR",
      paymentMethod: "CASH",
      supplierId: "sup-1",
      cashAccountId: "acc-1",
      items: [{ ...baseItem, conversionFactor: 0 }],
    }).ok,
    false
  );

  assert.strictEqual(
    validatePoCheckoutInput({
      mode: "DISTRIBUTOR",
      paymentMethod: "CASH",
      supplierId: "sup-1",
      cashAccountId: "acc-1",
      items: [{ ...baseItem, unitPrice: 0, subtotal: 0 }],
    }).ok,
    false
  );

  assert.strictEqual(
    validatePoCheckoutInput({
      mode: "DISTRIBUTOR",
      paymentMethod: "TEMPO",
      supplierId: "",
      items: [baseItem],
    }).ok,
    false
  );

  assert.strictEqual(
    validatePoCheckoutInput({
      mode: "MARKET",
      paymentMethod: "CASH",
      cashAccountId: "",
      items: [baseItem],
    }).ok,
    false
  );

  const validTempo = validatePoCheckoutInput({
    mode: "DISTRIBUTOR",
    paymentMethod: "TEMPO",
    supplierId: "sup-1",
    items: [{ ...baseItem, quantity: 1.5, unitPrice: 55001, subtotal: 82502 }],
  });
  assert.strictEqual(validTempo.ok, true);
  if ("totalAmount" in validTempo) {
    assert.strictEqual(validTempo.totalAmount, 82502);
  }
});

test("31e. validatePoPaymentInput Mencegah Overpay, Pembayaran Ulang Lunas & Periode Ditutup", () => {
  assert.strictEqual(
    validatePoPaymentInput({
      poStatus: "PAID",
      totalAmount: 500000,
      amountPaid: 500000,
      payAmount: 100000,
      cashAccountId: "acc-1",
    }).ok,
    false
  );

  assert.strictEqual(
    validatePoPaymentInput({
      poStatus: "UNPAID",
      totalAmount: 500000,
      amountPaid: 0,
      payAmount: 100000,
      cashAccountId: "acc-1",
      payDateYmd: "2026-10-15",
      isPeriodClosed: true,
    }).ok,
    false
  );

  const partial = validatePoPaymentInput({
    poStatus: "UNPAID",
    totalAmount: 500000,
    amountPaid: 0,
    payAmount: 200000,
    cashAccountId: "acc-1",
    payDateYmd: "2026-11-24",
    isPeriodClosed: false,
  });
  assert.strictEqual(partial.ok, true);
  if ("nextStatus" in partial) {
    assert.strictEqual(partial.effectiveAmount, 200000);
    assert.strictEqual(partial.newAmountPaid, 200000);
    assert.strictEqual(partial.nextStatus, "PARTIAL");
    assert.strictEqual(getLocalDateString(new Date(partial.payDateIso)), "2026-11-24");
  }

  const overpayClamped = validatePoPaymentInput({
    poStatus: "PARTIAL",
    totalAmount: 500000,
    amountPaid: 200000,
    payAmount: 900000,
    cashAccountId: "acc-1",
    payDateYmd: "2026-11-24",
  });
  assert.strictEqual(overpayClamped.ok, true);
  if ("nextStatus" in overpayClamped) {
    assert.strictEqual(overpayClamped.effectiveAmount, 300000);
    assert.strictEqual(overpayClamped.newAmountPaid, 500000);
    assert.strictEqual(overpayClamped.nextStatus, "PAID");
  }
});

// -------------------------------------------------------------
// 32. AUDIT ZONA 5 (PENJUALAN, REKAP HARIAN, ARSIP POS & PMIX)
// -------------------------------------------------------------
console.log("\n32. Audit Zona 5 (Penjualan, Rekap Harian, Arsip POS & Analitik Produk):");

test("32a. mapSalesRows & parseDateToIso Menolak Baris TOTAL/Qty Nol & Mendukung Serial Excel + DD/MM/YYYY", () => {
  assert.strictEqual(parseDateToIso(46349), "2026-11-23");
  assert.strictEqual(parseDateToIso("23/11/2026"), "2026-11-23");

  const mapped = mapSalesRows(
    [
      { Tanggal: "2026-11-23", "Nama Menu": "Cafe Latte", Quantity: 4, "Total Penjualan": 100000 },
      { Tanggal: "2026-11-23", "Nama Menu": "Kopi Void", Quantity: 0, "Total Penjualan": 25000 },
      { Tanggal: "2026-11-23", "Nama Menu": "Grand Total", Quantity: 4, "Total Penjualan": 100000 },
    ],
    ["Cafe Latte"]
  );

  assert.strictEqual(mapped.rows.length, 1);
  assert.strictEqual(mapped.rows[0].menuName, "Cafe Latte");
  assert.strictEqual(mapped.skippedRows, 2);
});

test("32b. calculateVariantUnitHpp Mengikuti Penurunan Harga Kemasan & computeProductSalesAnalytics Menormalisasi Rentang Terbalik", () => {
  const droppedIngs: any[] = [
    { id: "ing-bean", name: "Espresso Beans", category: "Biji Kopi", unit: "gr", costPerUnit: 250, currentStock: 5000 },
    { id: "ing-cup", name: "Cup Plastik 16oz", category: "Packaging & Cup", unit: "pcs", costPerUnit: 500, currentStock: 100 },
  ];
  const prodList: any[] = [
    {
      id: "prod-latte",
      name: "Cafe Latte",
      category: "COFFEE",
      division: "BAR",
      isActive: true,
      variants: [
        {
          id: "v1",
          productId: "prod-latte",
          name: "Iced 16oz",
          price: 25000,
          packagingCost: 900,
          estimatedHpp: 5400,
          isAvailable: true,
          recipe: [
            { ingredientId: "ing-bean", quantity: 18 }, // 4500
            { ingredientId: "ing-cup", quantity: 1 }, // 500
          ],
        },
      ],
    },
  ];
  const hppInfo = calculateVariantUnitHpp(prodList[0].variants[0], prodList[0], [], droppedIngs);
  assert.strictEqual(hppInfo.unitHpp, 5000);

  const swapped = computeProductSalesAnalytics({
    salesTransactions: [
      { id: "s1", date: "2026-11-20", menuName: "Cafe Latte - Iced 16oz", quantitySold: 2, totalPrice: 50000, importLogId: "l1" },
    ],
    dailySalesRecaps: [],
    products: prodList,
    recipes: [],
    ingredients: droppedIngs,
    dateMode: "DATE_RANGE",
    singleDate: "2026-11-20",
    startDate: "2026-11-24",
    endDate: "2026-11-18",
  });
  assert.strictEqual(swapped.filteredTransactions.length, 1);
  assert.strictEqual(swapped.kpiSummary.totalQty, 2);
});

test("32c. extractWitaHour & aggregatePosOrderTopItems Membaca Jam WITA & Menu Name Varian POS Secara Akurat", () => {
  assert.strictEqual(extractWitaHour("2026-11-24T01:30:00.000Z"), 9);

  const topItems = aggregatePosOrderTopItems([
    {
      status: "PAID",
      items: [
        { menuName: "Kopi Susu Gula Aren", variantName: "Iced 16oz", quantity: 3, subtotal: 66000 },
        { menuName: "Croissant Butter", variantName: "Regular", quantity: 2, subtotal: 48000 },
      ],
    },
    {
      status: "VOID",
      items: [{ menuName: "Kopi Susu Gula Aren", variantName: "Iced 16oz", quantity: 99, subtotal: 999999 }],
    },
  ]);

  assert.strictEqual(topItems.length, 2);
  assert.strictEqual(topItems[0].name, "Kopi Susu Gula Aren (Iced 16oz)");
  assert.strictEqual(topItems[0].quantity, 3);
  assert.strictEqual(topItems[1].name, "Croissant Butter");
});

test("32d. validateDailySalesRecapSubmission Menolak Nol, Tutup Buku & Duplikat Tanggal+Shift", () => {
  const existing = [{ id: "rec-1", date: "2026-11-24", shift: "PAGI" }];

  assert.strictEqual(
    validateDailySalesRecapSubmission({
      date: "2026-11-24",
      shift: "SORE",
      cashAmount: 0,
      qrisAmount: 0,
      edcAmount: 0,
      transferAmount: 0,
      onlineDeliveryAmount: 0,
      existingRecaps: existing,
    }).ok,
    false
  );

  assert.strictEqual(
    validateDailySalesRecapSubmission({
      date: "2026-10-15",
      shift: "ALL",
      cashAmount: 500000,
      qrisAmount: 0,
      edcAmount: 0,
      transferAmount: 0,
      onlineDeliveryAmount: 0,
      isPeriodClosed: true,
      existingRecaps: existing,
    }).ok,
    false
  );

  assert.strictEqual(
    validateDailySalesRecapSubmission({
      date: "2026-11-24",
      shift: "PAGI",
      cashAmount: 500000,
      qrisAmount: 0,
      edcAmount: 0,
      transferAmount: 0,
      onlineDeliveryAmount: 0,
      existingRecaps: existing,
    }).ok,
    false
  );

  const selfEdit = validateDailySalesRecapSubmission({
    date: "2026-11-24",
    shift: "PAGI",
    cashAmount: 500000.4,
    qrisAmount: 250000.6,
    edcAmount: 0,
    transferAmount: 100000,
    onlineDeliveryAmount: 0,
    existingRecaps: existing,
    editingId: "rec-1",
  });
  assert.strictEqual(selfEdit.ok, true);
  if ("totalAmount" in selfEdit) {
    assert.strictEqual(selfEdit.totalAmount, 850001);
    assert.strictEqual(selfEdit.nonCashTotal, 350001);
  }
});

test("32e. validateCashDepositSubmission Menolak Akun Kembar, Nominal <= 0 & Tutup Buku", () => {
  assert.strictEqual(
    validateCashDepositSubmission({
      fromAccountId: "acc-1",
      toAccountId: "acc-1",
      amount: 1000000,
      date: "2026-11-24",
    }).ok,
    false
  );

  assert.strictEqual(
    validateCashDepositSubmission({
      fromAccountId: "acc-kas",
      toAccountId: "acc-bca",
      amount: 0,
      date: "2026-11-24",
    }).ok,
    false
  );

  assert.strictEqual(
    validateCashDepositSubmission({
      fromAccountId: "acc-kas",
      toAccountId: "acc-bca",
      amount: 1000000,
      date: "2026-10-15",
      isPeriodClosed: true,
    }).ok,
    false
  );

  const valid = validateCashDepositSubmission({
    fromAccountId: "acc-kas",
    toAccountId: "acc-bca",
    amount: 1500000.4,
    date: "2026-11-24",
  });
  assert.strictEqual(valid.ok, true);
  if ("amount" in valid) {
    assert.strictEqual(valid.amount, 1500000);
  }
});

// -------------------------------------------------------------
// 33. ZONA 6: ARUS KAS, KATEGORI, REKONSILIASI BANK & LAPORAN
// -------------------------------------------------------------
console.log("\n33. Pengujian Zona 6: Arus Kas, Kategori, Rekonsiliasi Bank & Laporan Keuangan:");

test("33a. parseBankStatementAmount, parseBankStatementCsv & matchBankStatementLines Mendukung Format Bank Indonesia & Quotes", () => {
  assert.strictEqual(parseBankStatementAmount("Rp 150.000"), 150000);
  assert.strictEqual(parseBankStatementAmount("1.250.000,00"), 1250000);
  assert.strictEqual(parseBankStatementAmount("(25.000)"), -25000);
  assert.strictEqual(parseBankStatementAmount("150,000.00"), 150000);

  const csvWithBomAndSemicolon =
    "\uFEFFdate;description;amount;type\n" +
    '2026-11-20;"Transfer QRIS, Settlement Pagi";"Rp 150.000";CREDIT\n' +
    '2026-11-20;"Biaya Admin; Bulanan";"(25.000)";DEBIT\n';
  const parsed = parseBankStatementCsv(csvWithBomAndSemicolon);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].description, "Transfer QRIS, Settlement Pagi");
  assert.strictEqual(parsed[0].amount, "Rp 150.000");

  const sysTxs: CashTransaction[] = [
    {
      id: "tx-in-1",
      accountId: "bank-bca",
      type: "CASH_IN",
      date: "2026-11-20T10:00:00+08:00",
      amount: 150000,
      description: "Settlement QRIS",
      category: "Penjualan",
    },
    {
      id: "tx-out-1",
      accountId: "bank-bca",
      type: "CASH_OUT",
      date: "2026-11-20T12:00:00+08:00",
      amount: 25000,
      description: "Admin Bank",
      category: "Biaya Bank",
    },
    {
      id: "tx-legacy-in",
      accountId: "bank-bca",
      type: "IN" as any,
      date: "2026-11-21T09:00:00+08:00",
      amount: 50000,
      description: "Setoran Tunai",
      category: "Penjualan",
    },
  ];

  let idx = 0;
  const matched = matchBankStatementLines(
    [
      ...parsed,
      { date: "2026-11-21", description: "Setoran Tunai", amount: "Rp 50.000", type: "CREDIT" },
    ],
    sysTxs,
    "rec-33a",
    () => `ln-${++idx}`,
    "2026-11-21T12:00:00+08:00"
  );
  assert.strictEqual(matched.length, 3);
  assert.strictEqual(matched[0].amount, 150000);
  assert.strictEqual(matched[0].isMatched, true);
  assert.strictEqual(matched[0].matchedTransactionId, "tx-in-1");
  assert.strictEqual(matched[1].transactionType, "DEBIT");
  assert.strictEqual(matched[1].amount, 25000);
  assert.strictEqual(matched[1].isMatched, true);
  assert.strictEqual(matched[1].matchedTransactionId, "tx-out-1");
  assert.strictEqual(matched[2].isMatched, true);
  assert.strictEqual(matched[2].matchedTransactionId, "tx-legacy-in");
});

test("33b. filterExpenseCategoryTree & parseImportedExpenseCategories Menjaga Hirarki & Validasi Impor", () => {
  const categories: ExpenseCategory[] = [
    {
      id: "cat-ops",
      name: "Operasional",
      type: "PENGELUARAN",
      parentId: null,
      color: "#1b2cc0",
      icon: "wallet",
      isActive: true,
      sortOrder: 2,
    },
    {
      id: "cat-ops-listrik",
      name: "Listrik & Air",
      type: "UTILITAS",
      parentId: "cat-ops",
      color: "#0284c7",
      icon: "zap",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "cat-ops-sewa",
      name: "Sewa Tempat",
      type: "PENGELUARAN",
      parentId: "cat-ops",
      color: "#1b2cc0",
      icon: "home",
      isActive: true,
      sortOrder: 2,
    },
  ];

  const { tree, autoExpandIds } = filterExpenseCategoryTree(categories, "listrik", "ALL");
  assert.strictEqual(tree.length, 1);
  assert.strictEqual(tree[0].id, "cat-ops");
  assert.strictEqual(tree[0].children?.length, 1);
  assert.strictEqual(tree[0].children?.[0].id, "cat-ops-listrik");
  assert.strictEqual(autoExpandIds["cat-ops"], true);

  const parsed = parseImportedExpenseCategories(
    [
      { "Nama Kategori": "Operasional", Tipe: "PENGELUARAN", Warna: "#000000", Icon: "tag" },
      { "Nama Kategori": "Biaya Kemasan Baru", Tipe: "INVALID_TYPE", Warna: "bukan-hex", Icon: "bad-icon" },
      { "Nama Kategori": "  ", Tipe: "HRD", Warna: "#059669", Icon: "users" },
      { "ID_SISTEM (JANGAN DIUBAH)": "cat-ops-sewa", "Nama Kategori": "Sewa Ruko", Tipe: "PENGELUARAN", Warna: "#059669", Icon: "home" },
    ],
    categories,
    ["tag", "wallet", "zap", "home", "users"]
  );

  assert.strictEqual(parsed.toCreate.length, 1);
  assert.strictEqual(parsed.toCreate[0].name, "Biaya Kemasan Baru");
  assert.strictEqual(parsed.toCreate[0].type, "LAINNYA");
  assert.strictEqual(parsed.toCreate[0].color, "#1b2cc0");
  assert.strictEqual(parsed.toCreate[0].icon, "tag");
  assert.strictEqual(parsed.toUpdate.length, 1);
  assert.strictEqual(parsed.toUpdate[0].name, "Sewa Ruko");
  assert.strictEqual(parsed.skipped, 2);
});

test("33c. computeBudgetVsActual Menggulung Sub-Kategori ke Induk Tanpa Double-Count & Hormati WITA", () => {
  const categories: ExpenseCategory[] = [
    {
      id: "cat-ops",
      name: "Operasional",
      type: "PENGELUARAN",
      parentId: null,
      color: "#1b2cc0",
      icon: "wallet",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "cat-sub-kebersihan",
      name: "Kebersihan",
      type: "PENGELUARAN",
      parentId: "cat-ops",
      color: "#0284c7",
      icon: "tag",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "cat-sub-listrik",
      name: "Listrik PLN",
      type: "UTILITAS",
      parentId: "cat-ops",
      color: "#0284c7",
      icon: "zap",
      isActive: true,
      sortOrder: 2,
    },
  ];

  const budgets: Budget[] = [
    {
      id: "b-ops",
      categoryId: "cat-ops",
      period: "2026-11",
      amount: 1000000,
      notes: null,
      createdAt: "2026-11-01",
    },
    {
      id: "b-listrik",
      categoryId: "cat-sub-listrik",
      period: "2026-11",
      amount: 500000,
      notes: null,
      createdAt: "2026-11-01",
    },
  ];

  const txs: CashTransaction[] = [
    // Masuk ke 2026-11-01 01:00 WITA (masih Nov di WITA walau 2026-10-31T17:00:00Z di UTC)
    {
      id: "tx-1",
      accountId: "kas-1",
      type: "CASH_OUT",
      date: "2026-10-31T17:00:00.000Z",
      amount: 300000,
      description: "Sabun & Kebersihan",
      category: "Kebersihan",
      categoryId: null,
    },
    {
      id: "tx-2",
      accountId: "kas-1",
      type: "CASH_OUT",
      date: "2026-11-10T10:00:00+08:00",
      amount: 600000,
      description: "Token Listrik",
      category: "Listrik PLN",
      categoryId: "cat-sub-listrik",
    },
    {
      id: "tx-transfer",
      accountId: "kas-1",
      type: "CASH_OUT",
      date: "2026-11-10T11:00:00+08:00",
      amount: 500000,
      description: "Transfer Antar Kas",
      category: "Transfer Antar Kas",
      referenceId: "TRANSFER:1",
    },
  ];

  const rows = computeBudgetVsActual({
    period: "2026-11",
    budgets,
    cashTransactions: txs,
    expenseCategories: categories,
  });

  // Listrik punya anggaran sendiri (120% overbudget -> urutan teratas), Kebersihan menggulung ke Operasional
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].categoryId, "cat-sub-listrik");
  assert.strictEqual(rows[0].actualAmount, 600000);
  assert.strictEqual(rows[0].variance, -100000);
  assert.strictEqual(rows[1].categoryId, "cat-ops");
  assert.strictEqual(rows[1].actualAmount, 300000);
  assert.strictEqual(rows[1].variance, 700000);
});

test("33d. filterByDateRange Aman Zona Waktu WITA & Rentang Tanggal Terbalik", () => {
  const items = [
    { id: "before", date: "2026-10-31T15:30:00.000Z" }, // 2026-10-31 23:30 WITA
    { id: "inside-early", date: "2026-10-31T17:00:00.000Z" }, // 2026-11-01 01:00 WITA
    { id: "inside-late", date: "2026-11-15" },
    { id: "after", date: "2026-11-16T00:30:00+08:00" },
  ];

  const filtered = filterByDateRange(items, "2026-11-15", "2026-11-01");
  assert.deepStrictEqual(
    filtered.map((x) => x.id),
    ["inside-early", "inside-late"]
  );
});

test("33e. validateCashPeriodAccess Menjaga Periode Tutup Buku Tujuan & Asal", () => {
  const closed = [
    { id: "cp-1", period: "2026-10", closedAt: "2026-11-01", closedBy: "Finance" },
  ];

  const closedTarget = validateCashPeriodAccess({
    date: "2026-10-31T18:00:00+08:00",
    closedPeriods: closed,
  });
  assert.strictEqual(closedTarget.ok, false);

  const closedOrig = validateCashPeriodAccess({
    date: "2026-11-05",
    originalDate: "2026-10-20T09:00:00+08:00",
    closedPeriods: closed,
  });
  assert.strictEqual(closedOrig.ok, false);

  const allowed = validateCashPeriodAccess({
    date: "2026-10-31T17:00:00.000Z", // 2026-11-01 01:00 WITA!
    closedPeriods: closed,
  });
  assert.strictEqual(allowed.ok, true);
});

test("33f. resolveCategoryMatchForImport Mencocokkan Kategori Secara Case-Insensitive & Hierarki", () => {
  const categories: ExpenseCategory[] = [
    {
      id: "cat-bahan-baku",
      name: "Bahan Baku",
      type: "BAHAN_BAKU",
      parentId: null,
      color: "#d97706",
      icon: "package",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "cat-kopi",
      name: "Biji Kopi Espresso",
      type: "BAHAN_BAKU",
      parentId: "cat-bahan-baku",
      color: "#d97706",
      icon: "coffee",
      isActive: true,
      sortOrder: 2,
    },
  ];

  const m1 = resolveCategoryMatchForImport("bahan baku > biji kopi espresso", categories);
  assert.deepStrictEqual(m1, { categoryId: "cat-kopi", category: "Biji Kopi Espresso" });

  const m2 = resolveCategoryMatchForImport("Pos Baru Kustom", categories);
  assert.deepStrictEqual(m2, { categoryId: null, category: "Pos Baru Kustom" });
});

// -------------------------------------------------------------
// 34. PENGUJIAN MODUL HR, ABSENSI, SHIFT & PAYROLL (ZONA 7)
// -------------------------------------------------------------
console.log("\n34. Pengujian Modul HR, Absensi, Shift & Payroll (Zona 7):");

test("34a. evaluateClockInLateness & formatWitaTimeHm Menghormati WITA & Toleransi Shift", () => {
  const onTimeMorning = evaluateClockInLateness({
    now: new Date("2026-11-24T07:10:00+08:00"),
    shiftId: "PAGI",
  });
  assert.strictEqual(onTimeMorning.status, "HADIR");
  assert.strictEqual(onTimeMorning.lateMinutes, 0);

  const lateMorning = evaluateClockInLateness({
    now: new Date("2026-11-24T07:20:00+08:00"),
    shiftId: "PAGI",
  });
  assert.strictEqual(lateMorning.status, "TERLAMBAT");
  assert.strictEqual(lateMorning.lateMinutes, 20);

  const offShift = evaluateClockInLateness({
    now: new Date("2026-11-24T14:00:00+08:00"),
    shiftId: "OFF",
  });
  assert.strictEqual(offShift.status, "HADIR");
  assert.strictEqual(offShift.lateMinutes, 0);

  // Midnight WITA normalization (hindari bug "24:05" di Intl)
  const midnightIso = "2026-11-24T00:05:00+08:00";
  assert.strictEqual(formatWitaTimeHm(midnightIso), "00:05");
  assert.strictEqual(getWitaTimeMinutes(new Date(midnightIso)), 5);
});

test("34b. buildAttendanceCorrectionUpdate Parsing WITA & Shift Melewati Tengah Malam", () => {
  const existing: DailyAttendance = {
    id: "att-overnight-1",
    employeeId: "emp-1",
    date: "2026-11-24",
    status: "ALPHA",
    clockInTime: null,
    clockOutTime: null,
    clockInLocation: null,
    clockOutLocation: null,
    clockInPhotoUrl: null,
    clockOutPhotoUrl: null,
    notes: "",
    approvalStatus: "PENDING",
  };

  const updated = buildAttendanceCorrectionUpdate(
    existing,
    {
      status: "HADIR",
      clockInTime: "22:00",
      clockOutTime: "02:00",
      overtimeApproved: false,
      reason: "Lupa clock out shift malam event akhir pekan",
    },
    "Manager Test"
  );

  assert.strictEqual(formatWitaTimeHm(updated.clockInTime), "22:00");
  assert.strictEqual(formatWitaTimeHm(updated.clockOutTime), "02:00");
  assert.strictEqual(
    calculateWorkDurationHours(updated.clockInTime, updated.clockOutTime),
    4
  );
  assert.strictEqual(updated.approvalStatus, "APPROVED");
  assert.strictEqual(updated.isCorrected, true);
});

test("34c. computeShiftExpectedCash Tanpa Double-Count & Mengabaikan Akun Non-Kasir", () => {
  const cashTx: CashTransaction[] = [
    {
      id: "tx-before",
      accountId: "cash-1",
      date: "2026-11-24T07:55:00+08:00",
      type: "CASH_IN",
      category: "Penjualan",
      amount: 999000,
      description: "Sebelum shift",
    },
    {
      id: "tx-pos-cash",
      accountId: "cash-1",
      date: "2026-11-24T09:15:00+08:00",
      type: "CASH_IN",
      category: "Penjualan POS (Tunai)",
      amount: 150000,
      description: "Order #POS-001",
      referenceId: "order-1",
    },
    {
      id: "tx-pos-qris",
      accountId: "bank-1",
      date: "2026-11-24T09:20:00+08:00",
      type: "CASH_IN",
      category: "Penjualan POS (QRIS)",
      amount: 250000,
      description: "Order #POS-002",
      referenceId: "order-2",
    },
    {
      id: "tx-topup-laci",
      accountId: "cash-1",
      date: "2026-11-24T10:00:00+08:00",
      type: "CASH_IN",
      category: "Modal Tambahan",
      amount: 50000,
      description: "Tambah kembalian",
    },
    {
      id: "tx-out-laci",
      accountId: "cash-1",
      date: "2026-11-24T11:30:00+08:00",
      type: "CASH_OUT",
      category: "Operasional",
      amount: 75000,
      description: "Beli es batu darurat",
    },
  ];

  const summary = computeShiftExpectedCash({
    startingCash: 500000,
    shiftStartTime: "2026-11-24T08:00:00+08:00",
    cashAccountId: "cash-1",
    cashTransactions: cashTx,
  });

  assert.strictEqual(summary.totalSalesCashIn, 150000);
  assert.strictEqual(summary.totalOtherCashIn, 50000);
  assert.strictEqual(summary.totalCashOut, 75000);
  assert.strictEqual(summary.expectedEndingCash, 625000);
});

test("34d. computePayrollCategoryBreakdown Menjaga Jumlah Porsi Persis Sama Dengan netPay", () => {
  const slip: PayrollRecord = {
    id: "pay-34d",
    employeeId: "emp-1",
    period: "2026-11",
    basicSalary: 2000000,
    mealAllowance: 250000,
    transportAllowance: 0,
    positionAllowance: 300000,
    kpiBonus: 150000,
    targetBonus: 100000,
    overtimePay: 50000,
    alphaDeduction: 100000,
    lateDeduction: 25000,
    otherDeductions: 25000,
    grossPay: 2950000,
    netPay: 2800000, // termasuk residual Rp 100.000 (misal insentif harian/SOP)
    status: "APPROVED",
    paidDate: null,
    paidVia: null,
    notes: null,
    createdBy: "Manager",
    createdAt: "2026-11-24T00:00:00.000Z",
  };

  const breakdown = computePayrollCategoryBreakdown(slip);
  assert.strictEqual(
    breakdown.netBasicPortion + breakdown.netBonusAllowancePortion,
    2800000
  );
  assert.strictEqual(breakdown.netBasicPortion >= 0, true);
  assert.strictEqual(breakdown.netBonusAllowancePortion >= 0, true);
  assert.strictEqual(
    breakdown.combinedItems.reduce((sum, item) => sum + item.total, 0),
    2800000
  );
});

test("34e. validatePayrollMutation Menjaga Periode Tutup Buku, Immutabilitas PAID & Anti-Cair Ganda", () => {
  const closedPeriods = [{ period: "2026-10" }];

  // Periode tutup buku ditolak untuk CREATE / UPDATE / PAY
  const closedCreate = validatePayrollMutation({
    action: "CREATE",
    recordPeriod: "2026-10",
    closedPeriods,
  });
  assert.strictEqual(closedCreate.ok, false);

  const closedPayDate = validatePayrollMutation({
    action: "PAY",
    recordPeriod: "2026-11",
    existingStatus: "APPROVED",
    paymentDatePeriod: "2026-10",
    closedPeriods,
  });
  assert.strictEqual(closedPayDate.ok, false);

  // DRAFT belum boleh dicairkan
  const draftPay = validatePayrollMutation({
    action: "PAY",
    recordPeriod: "2026-11",
    existingStatus: "DRAFT",
    closedPeriods,
  });
  assert.strictEqual(draftPay.ok, false);

  // Pencairan ganda dicegah lewat existingCashRefIds
  const duplicatePay = validatePayrollMutation({
    action: "PAY",
    recordPeriod: "2026-11",
    existingStatus: "APPROVED",
    closedPeriods,
    existingCashRefIds: ["pay-123"],
    recordId: "pay-123",
  });
  assert.strictEqual(duplicatePay.ok, false);

  // PAID immutable terhadap UPDATE & DELETE
  assert.strictEqual(
    validatePayrollMutation({
      action: "UPDATE",
      recordPeriod: "2026-11",
      existingStatus: "PAID",
      closedPeriods,
    }).ok,
    false
  );
  assert.strictEqual(
    validatePayrollMutation({
      action: "DELETE",
      recordPeriod: "2026-11",
      existingStatus: "APPROVED",
      closedPeriods,
    }).ok,
    false
  );

  // APPROVED di periode terbuka & belum cair -> diizinkan
  const allowedPay = validatePayrollMutation({
    action: "PAY",
    recordPeriod: "2026-11",
    existingStatus: "APPROVED",
    paymentDatePeriod: "2026-11",
    closedPeriods,
    existingCashRefIds: [],
    recordId: "pay-123",
  });
  assert.strictEqual(allowedPay.ok, true);
});

test("34f. mergeOfflinePayrollPreservingPaid Melindungi Record PAID Saat Sync Offline", () => {
  const existing: PayrollRecord[] = [
    {
      id: "pay-paid",
      employeeId: "emp-1",
      period: "2026-11",
      basicSalary: 3000000,
      positionAllowance: 0,
      mealAllowance: 0,
      transportAllowance: 0,
      alphaDeduction: 0,
      kpiBonus: 0,
      overtimePay: 0,
      otherDeductions: 0,
      grossPay: 3000000,
      netPay: 3000000,
      status: "PAID",
      paidDate: "2026-11-24",
      paidVia: "cash-1",
      notes: null,
      createdBy: "Finance",
      createdAt: "2026-11-24T00:00:00.000Z",
    },
    {
      id: "pay-draft",
      employeeId: "emp-2",
      period: "2026-11",
      basicSalary: 2000000,
      positionAllowance: 0,
      mealAllowance: 0,
      transportAllowance: 0,
      alphaDeduction: 0,
      kpiBonus: 0,
      overtimePay: 0,
      otherDeductions: 0,
      grossPay: 2000000,
      netPay: 2000000,
      status: "DRAFT",
      paidDate: null,
      paidVia: null,
      notes: null,
      createdBy: "Finance",
      createdAt: "2026-11-24T00:00:00.000Z",
    },
  ];

  const incoming: PayrollRecord[] = [
    {
      ...existing[0],
      netPay: 100,
      status: "DRAFT",
    },
    {
      ...existing[1],
      netPay: 2250000,
    },
    {
      id: "pay-new",
      employeeId: "emp-3",
      period: "2026-11",
      basicSalary: 1800000,
      positionAllowance: 0,
      mealAllowance: 0,
      transportAllowance: 0,
      alphaDeduction: 0,
      kpiBonus: 0,
      overtimePay: 0,
      otherDeductions: 0,
      grossPay: 1800000,
      netPay: 1800000,
      status: "DRAFT",
      paidDate: null,
      paidVia: null,
      notes: null,
      createdBy: "Finance",
      createdAt: "2026-11-24T00:00:00.000Z",
    },
  ];

  const merged = mergeOfflinePayrollPreservingPaid(incoming, existing);
  assert.strictEqual(merged.length, 3);
  const keptPaid = merged.find((r) => r.id === "pay-paid");
  assert.strictEqual(keptPaid?.status, "PAID");
  assert.strictEqual(keptPaid?.netPay, 3000000);
  assert.strictEqual(merged.find((r) => r.id === "pay-draft")?.netPay, 2250000);
  assert.strictEqual(merged.find((r) => r.id === "pay-new")?.netPay, 1800000);
});

test("34g. sanitizePayrollRecordData & sanitizeEmployeeContractRecord Membulatkan Rupiah Integer", () => {
  const sanitizedPayroll = sanitizePayrollRecordData(
    {
      employeeId: "emp-1",
      period: "2026-11",
      basicSalary: 2500000.6,
      positionAllowance: 125000.4,
      mealAllowance: -5000,
      alphaDeduction: 100000.5,
      kpiBonus: 75000.2,
      grossPay: 2625001.2,
      netPay: 2525000.7,
      status: "DRAFT",
    },
    "pay-clean-1"
  );

  assert.strictEqual(sanitizedPayroll.basicSalary, 2500001);
  assert.strictEqual(sanitizedPayroll.positionAllowance, 125000);
  assert.strictEqual(sanitizedPayroll.mealAllowance, 0);
  assert.strictEqual(sanitizedPayroll.grossPay, 2625001);
  assert.strictEqual(sanitizedPayroll.netPay, 2525001);

  const sanitizedContract = sanitizeEmployeeContractRecord(
    {
      employeeId: "emp-1",
      basicSalary: 3200000.8,
      positionAllowance: 250000.3,
      mealAllowance: 15000.6,
      transportAllowance: 10000.2,
      alphaDeductionPerDay: 120000.5,
      kpiBonusTarget: 300000.4,
      startDate: "2026-11-01",
      status: "ACTIVE",
    },
    "ctr-clean-1"
  );

  assert.strictEqual(sanitizedContract.basicSalary, 3200001);
  assert.strictEqual(sanitizedContract.positionAllowance, 250000);
  assert.strictEqual(sanitizedContract.mealAllowance, 15001);
  assert.strictEqual(sanitizedContract.transportAllowance, 10000);
  assert.strictEqual(sanitizedContract.alphaDeductionPerDay, 120001);
  assert.strictEqual(sanitizedContract.kpiBonusTarget, 300000);
});

// =============================================================
// SUITE 35: ZONA 8 (PROMOTIONS, DASHBOARD HELPERS & WITA WEEK)
// =============================================================

test("35a. getPromotionRuntimeStatus Mengklasifikasikan Status Promo Sesuai Tanggal WITA", () => {
  assert.strictEqual(
    getPromotionRuntimeStatus({ isActive: false, startDate: "2026-11-01", endDate: "2026-11-30" }, "2026-11-15"),
    "INACTIVE"
  );
  assert.strictEqual(
    getPromotionRuntimeStatus({ isActive: true, startDate: "2026-11-01", endDate: "2026-11-14" }, "2026-11-15"),
    "EXPIRED"
  );
  assert.strictEqual(
    getPromotionRuntimeStatus({ isActive: true, startDate: "2026-11-16", endDate: "2026-11-30" }, "2026-11-15"),
    "UPCOMING"
  );
  assert.strictEqual(
    getPromotionRuntimeStatus({ isActive: true, startDate: "2026-11-15", endDate: "2026-11-15" }, "2026-11-15"),
    "ACTIVE"
  );
});

test("35b. validatePromotionInput Menolak Persen > 100, Tanggal Terbalik, & Kode Duplikat", () => {
  const existing: Promotion[] = [
    {
      id: "promo-1",
      name: "Promo Kopi Pagi",
      code: "PAGI10",
      type: "PERCENT",
      value: 10,
      isActive: true,
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  ];

  const tooHighPct = validatePromotionInput(
    { name: "Diskon Gila", type: "PERCENT", value: 120 },
    existing
  );
  assert.strictEqual("error" in tooHighPct, true);

  const reversedDates = validatePromotionInput(
    {
      name: "Weekend Promo",
      type: "NOMINAL",
      value: 10000,
      startDate: "2026-11-20",
      endDate: "2026-11-18",
    },
    existing
  );
  assert.strictEqual("error" in reversedDates, true);

  const dupCode = validatePromotionInput(
    { name: "Promo Pagi 2", code: " pagi10 ", type: "PERCENT", value: 15 },
    existing
  );
  assert.strictEqual("error" in dupCode, true);

  const valid = validatePromotionInput(
    {
      name: "  Member Sore ",
      code: " sore15 ",
      type: "PERCENT",
      value: 15.4,
      minSpend: 50000.6,
      maxDiscount: 20000.4,
      startDate: "2026-11-15",
      endDate: "2026-11-30",
    },
    existing,
    "promo-2"
  );
  assert.strictEqual(valid.ok, true);
  if (valid.ok) {
    assert.strictEqual(valid.normalized.name, "Member Sore");
    assert.strictEqual(valid.normalized.code, "SORE15");
    assert.strictEqual(valid.normalized.value, 15);
    assert.strictEqual(valid.normalized.minSpend, 50001);
    assert.strictEqual(valid.normalized.maxDiscount, 20000);
  }
});

test("35c. computePromotionDiscountPreview Menghitung Batas Min Spend, Cap Diskon, & Pembulatan Integer", () => {
  const notEligible = computePromotionDiscountPreview({
    type: "PERCENT",
    value: 20,
    minSpend: 150000,
    subtotal: 100000,
  });
  assert.strictEqual(notEligible.applied, false);
  assert.strictEqual(notEligible.discount, 0);
  assert.strictEqual(notEligible.finalTotal, 100000);

  const cappedPercent = computePromotionDiscountPreview({
    type: "PERCENT",
    value: 50,
    maxDiscount: 30000,
    subtotal: 100000,
  });
  assert.strictEqual(cappedPercent.applied, true);
  assert.strictEqual(cappedPercent.discount, 30000);
  assert.strictEqual(cappedPercent.finalTotal, 70000);

  const nominalCappedBySubtotal = computePromotionDiscountPreview({
    type: "NOMINAL",
    value: 75000,
    subtotal: 40000,
  });
  assert.strictEqual(nominalCappedBySubtotal.applied, true);
  assert.strictEqual(nominalCappedBySubtotal.discount, 40000);
  assert.strictEqual(nominalCappedBySubtotal.finalTotal, 0);
});

test("35d. computeOwnerCategoryContribution Menghitung Kontribusi Kategori Nyata & Fallback Rekap", () => {
  const products: Product[] = [
    {
      id: "p-1",
      name: "Kopi Susu Arena",
      category: "Coffee Beverages",
      division: "BAR",
      isActive: true,
      variants: [],
      createdAt: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "p-2",
      name: "Croissant Butter",
      category: "Pastry & Food",
      division: "BAKER",
      isActive: true,
      variants: [],
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  ];
  const sales: SalesTransaction[] = [
    {
      id: "s-1",
      date: "2026-11-20T08:00:00.000Z",
      menuName: "Kopi Susu Arena (Iced)",
      quantitySold: 2,
      totalPrice: 50000,
      importLogId: "imp-1",
    },
    {
      id: "s-2",
      date: "2026-11-20T09:00:00.000Z",
      menuName: "Croissant Butter",
      quantitySold: 1,
      totalPrice: 30000,
      importLogId: "imp-1",
    },
  ];

  const breakdown = computeOwnerCategoryContribution({
    filteredSales: sales,
    products,
    totalRevenue: 80000,
  });
  assert.strictEqual(breakdown.length, 2);
  assert.strictEqual(breakdown[0].name, "Coffee Beverages");
  assert.strictEqual(breakdown[0].value, 50000);
  assert.strictEqual(breakdown[1].name, "Pastry & Food");
  assert.strictEqual(breakdown[1].value, 30000);

  const recapOnly = computeOwnerCategoryContribution({
    filteredSales: [],
    products,
    totalRevenue: 125000,
  });
  assert.strictEqual(recapOnly.length, 1);
  assert.strictEqual(recapOnly[0].name, "Penjualan Rekap Harian");
  assert.strictEqual(recapOnly[0].value, 125000);
});

test("35e. computePeriodGrowthPercent Menghitung Pertumbuhan Periode Dengan Jujur", () => {
  assert.strictEqual(computePeriodGrowthPercent(500000, 0), null);
  assert.strictEqual(computePeriodGrowthPercent(1200000, 1000000), 20);
  assert.strictEqual(computePeriodGrowthPercent(875000, 1000000), -12.5);
});

test("35f. getWitaWeekStartDate Mengembalikan Senin WITA di Batas Hari UTC", () => {
  // Minggu 22 Nov 2026 23:30 WITA (15:30 UTC) -> masih pekan Senin 16 Nov 2026
  const sunNightWita = new Date("2026-11-22T15:30:00.000Z");
  const mondayForSunNight = getWitaWeekStartDate(sunNightWita);
  assert.strictEqual(mondayForSunNight.toISOString().slice(0, 10), "2026-11-16");

  // Senin 23 Nov 2026 00:30 WITA (22 Nov 16:30 UTC) -> sudah masuk pekan Senin 23 Nov 2026
  const monEarlyWita = new Date("2026-11-22T16:30:00.000Z");
  const mondayForMonEarly = getWitaWeekStartDate(monEarlyWita);
  assert.strictEqual(mondayForMonEarly.toISOString().slice(0, 10), "2026-11-23");
});

// -------------------------------------------------------------
// SUITE 36: KEAMANAN API BACKEND, VALIDASI KDS & RINGKASAN KAS
// -------------------------------------------------------------
test("36a. evaluateApiAccess Memblokir Unauthenticated, Suspended, dan Role Tidak Berizin", () => {
  const noUser = evaluateApiAccess(null);
  assert.strictEqual(noUser.ok, false);
  if (!noUser.ok) {
    assert.strictEqual(noUser.status, 401);
  }

  const suspended = evaluateApiAccess({ role: "MANAGER", isSuspended: true }, ["SUPER_ADMIN", "MANAGER"]);
  assert.strictEqual(suspended.ok, false);
  if (!suspended.ok) {
    assert.strictEqual(suspended.status, 403);
  }

  const forbiddenRole = evaluateApiAccess({ role: "KASIR", isSuspended: false }, ["SUPER_ADMIN", "OWNER", "MANAGER"]);
  assert.strictEqual(forbiddenRole.ok, false);
  if (!forbiddenRole.ok) {
    assert.strictEqual(forbiddenRole.status, 403);
  }

  const allowedSpecific = evaluateApiAccess({ role: "OWNER", isSuspended: false }, ["SUPER_ADMIN", "OWNER", "MANAGER"]);
  assert.deepStrictEqual(allowedSpecific, { ok: true });

  const allowedAny = evaluateApiAccess({ role: "KASIR", isSuspended: false });
  assert.deepStrictEqual(allowedAny, { ok: true });
});

test("36b. isValidKitchenStatus Menolak Status KDS Tidak Sah", () => {
  assert.strictEqual(isValidKitchenStatus("QUEUED"), true);
  assert.strictEqual(isValidKitchenStatus("PREPARING"), true);
  assert.strictEqual(isValidKitchenStatus("READY"), true);
  assert.strictEqual(isValidKitchenStatus("SERVED"), true);

  assert.strictEqual(isValidKitchenStatus(""), false);
  assert.strictEqual(isValidKitchenStatus("CANCELLED"), false);
  assert.strictEqual(isValidKitchenStatus("DONE"), false);
  assert.strictEqual(isValidKitchenStatus(null), false);
  assert.strictEqual(isValidKitchenStatus(123), false);
});

test("36c. Ringkasan Kas Dashboard Menyaring Saldo Awal, Transfer Kas, dan Prive Non-Operasional", () => {
  const txs = [
    { type: "CASH_IN", amount: 250000, category: "Penjualan", description: "Omzet Kopi Susu", referenceId: "ORD-1" },
    { type: "CASH_IN", amount: 5000000, category: "Saldo Awal", description: "OPENING: Modal awal kas", referenceId: "OPENING-1" },
    { type: "CASH_IN", amount: 1500000, category: "Transfer Kas", description: "TRANSFER: Laci -> BCA", referenceId: "TRF-1" },
    { type: "CASH_OUT", amount: 80000, category: "Bahan Baku", description: "Beli Susu Segar", referenceId: "PO-1" },
    { type: "CASH_OUT", amount: 2000000, category: "Prive Owner", description: "Penarikan modal owner", referenceId: "PRV-1" },
  ];

  const operational = txs.filter((t) => !isNonOperationalCashTransaction(t));
  const rev = operational.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
  const exp = operational.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);

  assert.strictEqual(operational.length, 2);
  assert.strictEqual(rev, 250000);
  assert.strictEqual(exp, 80000);
});

// -------------------------------------------------------------
// SUITE 37: ANTI SESSION-FORGERY, RBAC CRUD TABEL & WITA EXPORT
// -------------------------------------------------------------
test("37a. evaluateSessionHeartbeat Menolak Sesi Forged/Unknown, Revoked, Expired, Suspended & Idle > 1 Jam", () => {
  const nowMs = Date.UTC(2026, 10, 24, 12, 0, 0);
  const recentIso = new Date(nowMs - 5 * 60 * 1000).toISOString();
  const expiredIso = new Date(nowMs - 61 * 60 * 1000).toISOString();

  assert.deepStrictEqual(evaluateSessionHeartbeat(null, null, nowMs), {
    allow: false,
    revoked: true,
    status: "INVALID",
  });
  assert.deepStrictEqual(
    evaluateSessionHeartbeat({ status: "REVOKED", lastActive: recentIso }, { isSuspended: false }, nowMs),
    { allow: false, revoked: true, status: "REVOKED" }
  );
  assert.deepStrictEqual(
    evaluateSessionHeartbeat({ status: "EXPIRED", lastActive: recentIso }, { isSuspended: false }, nowMs),
    { allow: false, revoked: true, status: "EXPIRED" }
  );
  assert.deepStrictEqual(
    evaluateSessionHeartbeat({ status: "ACTIVE", lastActive: recentIso }, { isSuspended: true }, nowMs),
    { allow: false, revoked: true, status: "SUSPENDED" }
  );
  assert.deepStrictEqual(
    evaluateSessionHeartbeat({ status: "ACTIVE", lastActive: expiredIso }, { isSuspended: false }, nowMs),
    { allow: false, revoked: true, status: "EXPIRED" }
  );
  assert.deepStrictEqual(
    evaluateSessionHeartbeat({ status: "ACTIVE", lastActive: recentIso }, { isSuspended: false }, nowMs),
    { allow: true, revoked: false, status: "ACTIVE" }
  );
});

test("37b. evaluateGenericTableAccess Memblokir Tabel Keamanan & Membatasi Role", () => {
  const noAuth = evaluateGenericTableAccess(null, "ingredients");
  assert.strictEqual(noAuth.ok, false);
  if ("error" in noAuth) assert.strictEqual(noAuth.status, 401);

  const suspendedAdmin = evaluateGenericTableAccess({ role: "SUPER_ADMIN", isSuspended: true }, "ingredients");
  assert.strictEqual(suspendedAdmin.ok, false);
  if ("error" in suspendedAdmin) assert.strictEqual(suspendedAdmin.status, 403);

  for (const blocked of ["users", "device_sessions", "audit_logs"]) {
    const res = evaluateGenericTableAccess({ role: "SUPER_ADMIN", isSuspended: false }, blocked);
    assert.strictEqual(res.ok, false);
    if ("error" in res) assert.strictEqual(res.status, 403);
  }

  assert.deepStrictEqual(
    evaluateGenericTableAccess({ role: "SUPER_ADMIN", isSuspended: false }, "ingredients"),
    { ok: true }
  );

  const ownerCheck = evaluateGenericTableAccess({ role: "OWNER", isSuspended: false }, "cash_transactions");
  assert.strictEqual(ownerCheck.ok, false);
  if ("error" in ownerCheck) assert.strictEqual(ownerCheck.status, 403);

  const financeSettings = evaluateGenericTableAccess({ role: "FINANCE", isSuspended: false }, "settings");
  assert.strictEqual(financeSettings.ok, false);
  if ("error" in financeSettings) assert.strictEqual(financeSettings.status, 403);
  assert.deepStrictEqual(
    evaluateGenericTableAccess({ role: "FINANCE", isSuspended: false }, "cash_transactions"),
    { ok: true }
  );

  const managerPayroll = evaluateGenericTableAccess({ role: "MANAGER", isSuspended: false }, "payroll_records");
  assert.strictEqual(managerPayroll.ok, false);
  if ("error" in managerPayroll) assert.strictEqual(managerPayroll.status, 403);
  assert.deepStrictEqual(
    evaluateGenericTableAccess({ role: "MANAGER", isSuspended: false }, "purchase_orders"),
    { ok: true }
  );

  const kasirIngredients = evaluateGenericTableAccess({ role: "KASIR", isSuspended: false }, "ingredients");
  assert.strictEqual(kasirIngredients.ok, false);
  if ("error" in kasirIngredients) assert.strictEqual(kasirIngredients.status, 403);
});

test("37c. formatDateIndo Menggunakan Zona Waktu WITA (Asia/Makassar) di Batas Hari UTC", () => {
  // 2026-11-24T17:30:00Z = 25 Nov 2026 01:30 WITA
  const witaNextDay = formatDateIndo("2026-11-24T17:30:00.000Z");
  assert.ok(witaNextDay.includes("25") && witaNextDay.includes("2026"), `Expected 25 Nov 2026 WITA, got: ${witaNextDay}`);

  // Date-only string
  const dateOnly = formatDateIndo("2026-11-24");
  assert.ok(dateOnly.includes("24") && dateOnly.includes("2026"), `Expected 24 Nov 2026, got: ${dateOnly}`);
});

// -------------------------------------------------------------
// SUITE 38: BATCH COOK, PEMBULATAN HPP & BATAS REFUND POS
// -------------------------------------------------------------
test("38a. aggregateBatchRequiredQuantities Menjumlahkan Bahan Duplikat Sebelum Cek Stok Batch", () => {
  const totals = aggregateBatchRequiredQuantities(
    [
      { ingredientId: "ing-milk", quantity: 500 },
      { ingredientId: "ing-milk", quantity: 300 },
      { ingredientId: "ing-sugar", quantity: 100 },
    ],
    2
  );
  assert.strictEqual(totals.get("ing-milk"), 1600);
  assert.strictEqual(totals.get("ing-sugar"), 200);
});

test("38b. computeBatchWeightedUnitCost Kebal Terhadap Stok Negatif dan Menghasilkan Rupiah Integer", () => {
  const fromNegStock = computeBatchWeightedUnitCost(-200, 100, 1000, 50000);
  assert.strictEqual(fromNegStock, 50);

  const fromPosStock = computeBatchWeightedUnitCost(500, 40, 500, 30000);
  assert.strictEqual(fromPosStock, 50);
});

test("38c. resolveCappedRefundAmount Membatasi Refund Maksimal Sebesar Total Order (Rupiah Integer)", () => {
  assert.strictEqual(resolveCappedRefundAmount(55000, undefined), 55000);
  assert.strictEqual(resolveCappedRefundAmount(55000, 0), 55000);
  assert.strictEqual(resolveCappedRefundAmount(55000, 20000.6), 20001);
  assert.strictEqual(resolveCappedRefundAmount(55000, 999999), 55000);
});

// -------------------------------------------------------------
// SUITE 39: VALIDASI ORDER POS, SPLIT BILL & REMOTE APPROVAL
// -------------------------------------------------------------
test("39a. validatePosOrderPayload Menolak Keranjang Kosong, Status Ilegal & Nominal Negatif", () => {
  const emptyItems = validatePosOrderPayload({ items: [], status: "OPEN", totalAmount: 0 });
  assert.strictEqual(emptyItems.ok, false);

  const badStatus = validatePosOrderPayload({
    items: [{ menuName: "Espresso", quantity: 1 }],
    status: "VOID",
    totalAmount: 20000,
  });
  assert.strictEqual(badStatus.ok, false);

  const negTotal = validatePosOrderPayload({
    items: [{ menuName: "Espresso", quantity: 1 }],
    status: "PAID",
    subtotal: 20000,
    totalAmount: -100,
  });
  assert.strictEqual(negTotal.ok, false);

  assert.deepStrictEqual(
    validatePosOrderPayload({
      items: [{ menuName: "Espresso", quantity: 1 }],
      status: "PAID",
      subtotal: 20000,
      discountAmount: 0,
      taxAmount: 2000,
      totalAmount: 22000,
    }),
    { ok: true }
  );
});

test("39b. validateEvenlySplitAmount Menolak Nominal <= 0 atau Melebihi Sisa Tagihan Induk", () => {
  assert.strictEqual(validateEvenlySplitAmount(0, 10000).ok, false);
  assert.strictEqual(validateEvenlySplitAmount(100000, 0).ok, false);
  assert.strictEqual(validateEvenlySplitAmount(100000, -5000).ok, false);
  assert.strictEqual(validateEvenlySplitAmount(100000, 120000).ok, false);

  assert.deepStrictEqual(validateEvenlySplitAmount(100000, 40000), {
    ok: true,
    splitTotal: 40000,
    newParentTotal: 60000,
  });
  assert.deepStrictEqual(validateEvenlySplitAmount(60000, 60000), {
    ok: true,
    splitTotal: 60000,
    newParentTotal: 0,
  });
});

test("39c. validateApprovalRequestInput Memvalidasi Tipe, Status Order & Batas Nominal Refund", () => {
  assert.strictEqual(
    validateApprovalRequestInput({ type: "DISCOUNT", orderStatus: "PAID", orderTotalAmount: 50000 }).ok,
    false
  );
  assert.strictEqual(
    validateApprovalRequestInput({ type: "REFUND", orderStatus: "OPEN", orderTotalAmount: 50000 }).ok,
    false
  );
  assert.strictEqual(
    validateApprovalRequestInput({ type: "VOID", orderStatus: "REFUNDED", orderTotalAmount: 50000 }).ok,
    false
  );

  assert.deepStrictEqual(
    validateApprovalRequestInput({
      type: "REFUND",
      orderStatus: "PAID",
      orderTotalAmount: 50000,
      requestedAmount: 999999,
    }),
    { ok: true, type: "REFUND", normalizedAmount: 50000 }
  );
  assert.deepStrictEqual(
    validateApprovalRequestInput({
      type: "VOID",
      orderStatus: "OPEN",
      orderTotalAmount: 75000,
    }),
    { ok: true, type: "VOID", normalizedAmount: 75000 }
  );
});

// -------------------------------------------------------------
// SUITE 40: KEAMANAN SINKRONISASI, FAIL-CLOSED ROLE & SUPER ADMIN
// -------------------------------------------------------------
test("40a. applyRoleSyncRestrictions Memblokir device_sessions Untuk Semua Role & Fail-Closed Role Asing", () => {
  const payload = {
    device_sessions: [{ id: "sess-forged" }],
    users: [{ id: "u1" }],
    settings: { brandName: "Test" },
    payroll_records: [{ id: "pr1" }],
    cash_transactions: [{ id: "ct1" }],
    ingredients: [{ id: "ing1" }],
    dailyAttendances: [{ id: "da1" }],
  };

  for (const role of ["SUPER_ADMIN", "MANAGER", "KASIR", "FINANCE", "LEADER", "BAR"]) {
    const filtered = applyRoleSyncRestrictions(role, payload);
    assert.strictEqual(filtered.device_sessions, undefined, `device_sessions must be stripped for ${role}`);
  }

  const unknownRoleFiltered = applyRoleSyncRestrictions("GUEST", payload);
  assert.strictEqual(unknownRoleFiltered.device_sessions, undefined);
  assert.strictEqual(unknownRoleFiltered.users, undefined);
  assert.strictEqual(unknownRoleFiltered.settings, undefined);
  assert.strictEqual(unknownRoleFiltered.payroll_records, undefined);
  assert.strictEqual(unknownRoleFiltered.cash_transactions, undefined);
  assert.strictEqual(unknownRoleFiltered.ingredients, undefined);
});

test("40b. mergePreservingProtectedRows Menjamin Baris Terproteksi Server Selalu Menang Atas Payload Klien", () => {
  const incoming = [
    { id: "pos-1", amount: 1 },
    { id: "manual-1", amount: 25000 },
  ];
  const protectedRows = [{ id: "pos-1", amount: 50000 }];
  const merged = mergePreservingProtectedRows(incoming, protectedRows);

  assert.strictEqual(merged.length, 2);
  const posRow = merged.find((r) => r.id === "pos-1");
  const manualRow = merged.find((r) => r.id === "manual-1");
  assert.strictEqual(posRow?.amount, 50000);
  assert.strictEqual(manualRow?.amount, 25000);
});

test("40c. protectSuperAdminAccountsOnSync Mencegah Eskalasi & Penghapusan SUPER_ADMIN Oleh Manager", () => {
  const existingUsers = [
    { id: "u-sa", username: "superadmin", role: "SUPER_ADMIN", pin: "hash-sa" },
    { id: "u-mgr", username: "manager", role: "MANAGER", pin: "hash-mgr" },
    { id: "u-ksr", username: "kasir", role: "KASIR", pin: "hash-ksr" },
  ];

  // Empty incoming list preserves existing users
  assert.strictEqual(protectSuperAdminAccountsOnSync("MANAGER", [], existingUsers).length, 3);

  // Manager attempts privilege escalation + overwriting/deleting Super Admin
  const hostileManagerSync = [
    { id: "u-sa", username: "superadmin", role: "KASIR", pin: "1111" },
    { id: "u-mgr", username: "manager", role: "SUPER_ADMIN", pin: "hash-mgr" },
    { id: "u-ksr", username: "kasir", role: "KASIR", pin: "hash-ksr" },
  ];
  const guardedByMgr = protectSuperAdminAccountsOnSync("MANAGER", hostileManagerSync, existingUsers);
  const saAfterMgr = guardedByMgr.find((u) => u.id === "u-sa");
  const mgrAfterMgr = guardedByMgr.find((u) => u.id === "u-mgr");
  assert.strictEqual(saAfterMgr?.role, "SUPER_ADMIN");
  assert.strictEqual(saAfterMgr?.pin, "hash-sa");
  assert.strictEqual(mgrAfterMgr?.role, "MANAGER");

  // Manager omits Super Admin -> preserved
  const omitSaSync = [{ id: "u-mgr", username: "manager", role: "MANAGER", pin: "hash-mgr" }];
  const restoredSa = protectSuperAdminAccountsOnSync("MANAGER", omitSaSync, existingUsers);
  assert.ok(restoredSa.some((u) => u.id === "u-sa" && u.role === "SUPER_ADMIN"));

  // Super Admin updating a cashier role is allowed while Super Admin remains intact
  const adminSync = [
    { id: "u-sa", username: "superadmin", role: "SUPER_ADMIN", pin: "hash-sa" },
    { id: "u-ksr", username: "kasir", role: "LEADER", pin: "hash-ksr" },
  ];
  const guardedBySa = protectSuperAdminAccountsOnSync("SUPER_ADMIN", adminSync, existingUsers);
  assert.strictEqual(guardedBySa.find((u) => u.id === "u-ksr")?.role, "LEADER");
});

// -------------------------------------------------------------
// TEST SUITE 41: PROFIT SHARING, CLOSED PERIOD PROTECTION & RANGE LOCK
// -------------------------------------------------------------
console.log("\n--- SUITE 41: PROFIT SHARING & CLOSED PERIOD HARDENING ---");

test("41a. normalizeProfitSharePercentages memaksa total 100% & fallback default 70/30/0", () => {
  const def = normalizeProfitSharePercentages();
  assert.deepStrictEqual(def, { ownerPercent: 70, reservePercent: 30, investorPercent: 0 });

  const invalid = normalizeProfitSharePercentages({ ownerPercent: 50, reservePercent: 20, investorPercent: 10 });
  assert.deepStrictEqual(invalid, { ownerPercent: 70, reservePercent: 30, investorPercent: 0 });

  const valid = normalizeProfitSharePercentages({ ownerPercent: 60, reservePercent: 25, investorPercent: 15 });
  assert.deepStrictEqual(valid, { ownerPercent: 60, reservePercent: 25, investorPercent: 15 });
});

test("41b. computeOwnerProfitAllocation menghitung hak owner, prive, tabungan & capex dengan presisi integer", () => {
  const result = computeOwnerProfitAllocation({
    netProfit: 10000000,
    ownerPercent: 70,
    reservePercent: 30,
    investorPercent: 0,
    cashAccounts: [
      { id: "acc-ops", name: "Kas Operasional", type: "CASH", isDefault: true },
      { id: "acc-sav", name: "Tabungan Kedai", type: "SAVINGS", isDefault: false },
    ],
    cashTransactions: [
      {
        id: "tx-prive",
        date: "2026-11-10T10:00:00+08:00",
        type: "CASH_OUT",
        amount: 2000000,
        category: "Prive Owner",
        description: "Tarik profit owner November",
        accountId: "acc-ops",
      } as any,
      {
        id: "tx-sav",
        date: "2026-11-11T10:00:00+08:00",
        type: "CASH_IN",
        amount: 1500000,
        category: "Setoran Tabungan",
        description: "Transfer profit reserve",
        accountId: "acc-sav",
      } as any,
      {
        id: "tx-capex",
        date: "2026-11-12T10:00:00+08:00",
        type: "CASH_OUT",
        amount: 3500000,
        categoryId: "cat-aset",
        category: "CapEx Peralatan",
        description: "Beli grinder cadangan",
        accountId: "acc-ops",
      } as any,
    ],
  });

  assert.strictEqual(result.ownerShareAmount, 7000000);
  assert.strictEqual(result.ownerPriveTotal, 2000000);
  assert.strictEqual(result.ownerRemainingEntitlement, 5000000);
  assert.strictEqual(result.reserveShareAmount, 3000000);
  assert.strictEqual(result.netSavingsAllocation, 1500000);
  assert.strictEqual(result.reserveRemainingToTransfer, 1500000);
  assert.strictEqual(result.capexExpense, 3500000);
  assert.strictEqual(result.retainedProfitAfterPrive, 8000000);
});

test("41c. protectClosedPeriodsOnSync mencegah role non-Manager/non-SuperAdmin membuka kembali periode terkunci", () => {
  const existingClosed = [
    { id: "cp-1", period: "2026-10", status: "CLOSED", closedBy: "Manager" },
  ];

  // FINANCE atau KASIR tidak dapat menghapus/membuka kembali periode 2026-10 lewat sync
  const afterFinance = protectClosedPeriodsOnSync("FINANCE", [], existingClosed);
  assert.ok(afterFinance.some((p: any) => p.period === "2026-10" && p.status === "CLOSED"));

  // MANAGER dapat membuka kembali periode 2026-10 (mengirim array tanpa 2026-10)
  const afterManager = protectClosedPeriodsOnSync("MANAGER", [], existingClosed);
  assert.strictEqual(afterManager.length, 0);
});

test("41d. enforceClosedPeriodDataLock mempertahankan baris eksisting pada periode CLOSED dan memblokir sisipan baru ke periode terkunci", () => {
  const activeClosed = [{ period: "2026-10" }];
  const existingRows = [
    { id: "tx-locked", date: "2026-10-15T10:00:00+08:00", amount: 500000 },
    { id: "tx-open", date: "2026-11-15T10:00:00+08:00", amount: 100000 },
  ];
  const hostileIncoming = [
    { id: "tx-locked", date: "2026-10-15T10:00:00+08:00", amount: 9999999 }, // coba ubah nominal bulan tutup buku
    { id: "tx-new-in-closed", date: "2026-10-20T10:00:00+08:00", amount: 123456 }, // coba sisip ke bulan tutup buku
    { id: "tx-open", date: "2026-11-15T10:00:00+08:00", amount: 250000 }, // sah di bulan terbuka
  ];

  const lockedResult = enforceClosedPeriodDataLock(
    hostileIncoming,
    existingRows,
    activeClosed,
    (row: any) => getLocalPeriodFromTimestamp(row.date)
  );

  assert.strictEqual(lockedResult.find((r: any) => r.id === "tx-locked")?.amount, 500000);
  assert.strictEqual(lockedResult.some((r: any) => r.id === "tx-new-in-closed"), false);
  assert.strictEqual(lockedResult.find((r: any) => r.id === "tx-open")?.amount, 250000);
});

// -------------------------------------------------------------
// TEST SUITE 42: MODE PEMBANDING PENJUALAN (RESEP & HPP) VS MUTASI FISIK
// -------------------------------------------------------------
console.log("\n--- SUITE 42: ESTIMASI PEMAKAIAN BAHAN & HPP VS MUTASI FISIK ---");

test("42a. computePhysicalStockOutByIngredient mengagregasi mutasi keluar (OUT/USAGE/WASTE) WITA tanpa menghitung IN/TRANSFER", () => {
  const movements: StockMovement[] = [
    {
      id: "m-in",
      ingredientId: "ing-milk",
      type: "IN",
      quantity: 5000,
      totalCost: 100000,
      date: "2026-11-10T09:00:00+08:00",
    } as any,
    {
      id: "m-out",
      ingredientId: "ing-milk",
      type: "OUT",
      quantity: 1200,
      totalCost: 24000,
      date: "2026-11-11T10:00:00+08:00",
    } as any,
    {
      id: "m-waste",
      ingredientId: "ing-milk",
      type: "WASTE",
      quantity: 300,
      totalCost: 6000,
      date: "2026-11-12T23:30:00+08:00",
    } as any,
    {
      id: "m-transfer",
      ingredientId: "ing-milk",
      type: "TRANSFER",
      quantity: 1000,
      totalCost: 20000,
      date: "2026-11-11T15:00:00+08:00",
    } as any,
    {
      id: "m-out-range",
      ingredientId: "ing-milk",
      type: "OUT",
      quantity: 999,
      totalCost: 19980,
      date: "2026-11-20T09:00:00+08:00",
    } as any,
  ];

  // Reverse start/end order tetap dinormalisasi
  const agg = computePhysicalStockOutByIngredient({
    stockMovements: movements,
    startDate: "2026-11-12",
    endDate: "2026-11-10",
  });

  const milk = agg.get("ing-milk");
  assert.ok(milk);
  assert.strictEqual(milk!.totalOutQty, 1500);
  assert.strictEqual(milk!.totalOutCost, 30000);
  assert.strictEqual(milk!.wasteQty, 300);
});

test("42b. computeProductSalesAnalytics menghitung perkiraan bahan & HPP sebagai pembanding meski stok tidak dipotong", () => {
  const ingMilk: Ingredient = {
    id: "ing-susu",
    name: "Fresh Milk",
    category: "Dairy",
    unit: "ml",
    costPerUnit: 20,
    currentStock: 10000,
    minStock: 1000,
  };
  const recipeLatte: Recipe = {
    id: "rec-latte",
    menuName: "Iced Latte",
    ingredients: [{ ingredientId: "ing-susu", quantity: 150 }],
  };
  const prodLatte: Product = {
    id: "prod-latte",
    name: "Iced Latte",
    category: "BAR",
    division: "BAR",
    productGroup: "MINUMAN",
    menuCategory: "COFFEE",
    variants: [
      {
        id: "var-reg",
        name: "Regular",
        sellingPrice: 25000,
        estimatedHpp: 5000,
        recipeId: "rec-latte",
      },
    ],
    isActive: true,
    createdAt: "2026-11-01T00:00:00Z",
  } as any;
  const sales: SalesTransaction[] = [
    {
      id: "sale-1",
      date: "2026-11-11",
      menuName: "Iced Latte",
      quantitySold: 8,
      totalPrice: 200000,
      importLogId: "log-1",
    },
  ];

  const analytics = computeProductSalesAnalytics({
    salesTransactions: sales,
    products: [prodLatte],
    recipes: [recipeLatte],
    ingredients: [ingMilk],
    dateMode: "DATE_RANGE",
    singleDate: "2026-11-11",
    startDate: "2026-11-10",
    endDate: "2026-11-12",
  });

  // 8 cup * 150ml = 1200ml susu (Rp 24.000), HPP teoretis = 8 * 3000 (atau dari resep = 1200*20 = 24000)
  const milkUsage = analytics.ingredientUsageSummary.find((i) => i.ingredientId === "ing-susu");
  assert.ok(milkUsage);
  assert.strictEqual(milkUsage!.totalUsedQty, 1200);
  assert.strictEqual(milkUsage!.totalCost, 24000);
  // Stok bahan tetap utuh (tidak dipotong penjualan)
  assert.strictEqual(milkUsage!.currentStock, 10000);
  assert.ok(analytics.kpiSummary.totalHpp > 0);
});

// -------------------------------------------------------------
// TEST SUITE 43: KATEGORI DIVISI, 3-TIER SATUAN BAHAN & INPUT PINTAR
// -------------------------------------------------------------
console.log("\n--- SUITE 43: KATEGORI PER DIVISI, 3-TIER SATUAN & PARSER AI ---");

test("43a. filterIngredientCategoriesByDivision & resolveIngredientCategoryDivision mengisolasi kategori divisi dan menyertakan kategori umum", () => {
  const cats = ["Biji Kopi", "Susu & Dairy", "Bahan Kitchen", "Bahan Bakery", "Packaging & Cup", "Lainnya"];
  const customDivs = { "Sirup Custom": "BAR" as const, "Keju Pastry": "BAKER" as const };

  assert.strictEqual(resolveIngredientCategoryDivision("Sirup Custom", customDivs), "BAR");
  assert.strictEqual(resolveIngredientCategoryDivision("Keju Pastry", customDivs), "BAKER");

  const barOnly = filterIngredientCategoriesByDivision(cats, "BAR", customDivs);
  assert.ok(barOnly.includes("Biji Kopi"));
  assert.ok(barOnly.includes("Packaging & Cup"));
  assert.ok(!barOnly.includes("Bahan Kitchen"));
  assert.ok(!barOnly.includes("Bahan Bakery"));

  const kitchenOnly = filterIngredientCategoriesByDivision(cats, "KITCHEN", customDivs);
  assert.ok(kitchenOnly.includes("Bahan Kitchen"));
  assert.ok(kitchenOnly.includes("Lainnya"));
  assert.ok(!kitchenOnly.includes("Biji Kopi"));
});

test("43b. sanitizeIngredientRecord & getIngredientPackagingChoices mendukung hierarki 3 tingkat satuan (Grosir -> Menengah -> Terkecil)", () => {
  const sanitized = sanitizeIngredientRecord(
    {
      id: "ing-milk-3t",
      name: "Susu Fresh Milk",
      unit: "ml",
      currentStock: 12000,
      minStock: 2000,
      category: "Susu & Dairy",
      costPerUnit: 18,
      purchaseUnit: "Liter",
      conversionFactor: 1000,
      purchasePrice: 18500,
      bulkUnit: "Karton",
      bulkConversionFactor: 12000,
      bulkPrice: 210000,
    },
    "fallback-id"
  );

  assert.strictEqual(sanitized.bulkUnit, "Karton");
  assert.strictEqual(sanitized.bulkConversionFactor, 12000);
  assert.strictEqual(sanitized.bulkPrice, 210000);

  const choices = getIngredientPackagingChoices(sanitized as any);
  assert.strictEqual(choices[0].unit, "Karton");
  assert.strictEqual(choices[0].factor, 12000);
  assert.strictEqual(choices[1].key, "PURCHASE");
  assert.strictEqual(choices[1].factor, 1000);
  assert.strictEqual(choices[2].key, "BASE");
  assert.strictEqual(choices[2].factor, 1);
});

test("43c. resolveIngredientPackagingFromText memprioritaskan 3 tingkat satuan deklarasi bahan dan mengenali singkatan Indonesia", () => {
  const cupIng: Ingredient = {
    id: "ing-cup16",
    name: "Cup Oval 16oz",
    category: "Packaging & Cup",
    unit: "pcs",
    currentStock: 500,
    minStock: 100,
    costPerUnit: 500,
    purchaseUnit: "Slop",
    conversionFactor: 50,
    bulkUnit: "Dus",
    bulkConversionFactor: 1000,
  };

  const resDus = resolveIngredientPackagingFromText(cupIng, "dus", "beli 2 dus cup oval");
  assert.strictEqual(resDus.unit, "Dus");
  assert.strictEqual(resDus.conversionFactor, 1000);

  const resSlop = resolveIngredientPackagingFromText(cupIng, "slp", "beli 3slp cup oval");
  assert.strictEqual(resSlop.unit, "Slop");
  assert.strictEqual(resSlop.conversionFactor, 50);

  const resPcs = resolveIngredientPackagingFromText(cupIng, "bj", "ambil 15 bj cup");
  assert.strictEqual(resPcs.unit, "pcs");
  assert.strictEqual(resPcs.conversionFactor, 1);
});

test("43d. parseSmartCoffeeTextEntry mengenali satuan rapat (2krt, 3slp, 4btl) tanpa salah baca kuantitas sebagai harga", () => {
  const storeCtx = {
    ingredients: [
      {
        id: "ing-susu-3t",
        name: "Fresh Milk Diamond",
        unit: "ml",
        purchaseUnit: "Liter",
        conversionFactor: 1000,
        bulkUnit: "Karton",
        bulkConversionFactor: 12000,
      },
      {
        id: "ing-cup-3t",
        name: "Cup 16oz",
        unit: "pcs",
        purchaseUnit: "Slop",
        conversionFactor: 50,
        bulkUnit: "Karton",
        bulkConversionFactor: 1000,
      },
    ],
  };

  const parsed = parseSmartCoffeeTextEntry(
    "tf bca beli 2krt fresh milk diamond @210rb; 3slp cup 16oz @25rb",
    storeCtx
  );
  assert.strictEqual(parsed.transactions.length, 2);

  const milkTx = parsed.transactions[0];
  assert.strictEqual(milkTx.ingredientId, "ing-susu-3t");
  assert.strictEqual(milkTx.quantity, 2);
  assert.strictEqual(milkTx.unit, "Karton");
  assert.strictEqual(milkTx.conversionFactor, 12000);
  assert.strictEqual(milkTx.amount, 420000);

  const cupTx = parsed.transactions[1];
  assert.strictEqual(cupTx.ingredientId, "ing-cup-3t");
  assert.strictEqual(cupTx.quantity, 3);
  assert.strictEqual(cupTx.unit, "Slop");
  assert.strictEqual(cupTx.conversionFactor, 50);
  assert.strictEqual(cupTx.amount, 75000);
});

// =============================================================
// TEST SUITE 44: DATA CLEANING & ANTI AUTO-SEED DUMMY
// =============================================================
console.log("\n--- SUITE 44: DATA CLEANING & ANTI AUTO-SEED DUMMY ---");

test("44a. parseCleaningGroups default membersihkan transaksi & master namun mempertahankan KPI & kategori inti", () => {
  const defaults = parseCleaningGroups();
  assert.strictEqual(defaults.salesPos, true);
  assert.strictEqual(defaults.financeCash, true);
  assert.strictEqual(defaults.inventoryOps, true);
  assert.strictEqual(defaults.hrAudit, true);
  assert.strictEqual(defaults.catalogMenu, true);
  assert.strictEqual(defaults.catalogIngredients, true);
  assert.strictEqual(defaults.hrSuppliers, true);
  assert.strictEqual(defaults.promotions, true);
  assert.strictEqual(defaults.dummyUsers, true);
  assert.strictEqual(defaults.devicesPrinters, true);
  assert.strictEqual(defaults.kpiTemplates, false);
  assert.strictEqual(defaults.customExpenseCategories, false);

  const custom = parseCleaningGroups({ catalogIngredients: false, kpiTemplates: true });
  assert.strictEqual(custom.catalogIngredients, false);
  assert.strictEqual(custom.kpiTemplates, true);
  assert.strictEqual(custom.salesPos, true);
});

test("44b. shouldAutoSeedDummyData membaca flag __autoSeedDisabled secara akurat", () => {
  assert.strictEqual(shouldAutoSeedDummyData(undefined), true);
  assert.strictEqual(shouldAutoSeedDummyData({ divisionKpiBonusTarget: "{}" }), true);
  assert.strictEqual(
    shouldAutoSeedDummyData({ divisionKpiBonusTarget: JSON.stringify({ __autoSeedDisabled: true }) }),
    false
  );
  assert.strictEqual(shouldAutoSeedDummyData({ autoSeedDisabled: true }), false);
});

test("44c. CORE_EXPENSE_CATEGORY_IDS menjaga 32 ID kategori P&L/HPP/CapEx sistem", () => {
  assert.strictEqual(CORE_EXPENSE_CATEGORY_IDS.size, 32);
  for (const requiredId of [
    "cat-pendapatan",
    "cat-penjualan",
    "cat-bahan-baku",
    "cat-gaji",
    "cat-aset-mesin",
    "cat-admin-bank",
    "cat-lainnya",
  ]) {
    assert.strictEqual(CORE_EXPENSE_CATEGORY_IDS.has(requiredId), true);
  }
});

test("44d. validateClientSetupPayload memvalidasi Pos Kas, PIN 6 digit, dan username unik", () => {
  const invalidCash = validateClientSetupPayload({
    applyCashAccounts: true,
    cashAccounts: [{ name: "Tabungan Saja", type: "SAVINGS", isDefault: true }],
  });
  assert.strictEqual(invalidCash.valid, false);
  assert.ok(invalidCash.errors.some((e) => e.includes("CASH atau BANK")));

  const invalidUser = validateClientSetupPayload(
    {
      newUsers: [
        { name: "Kasir 1", username: "admin", role: "KASIR", pin: "123" },
      ],
    },
    ["admin"]
  );
  assert.strictEqual(invalidUser.valid, false);
  assert.ok(invalidUser.errors.some((e) => e.includes("duplikat")));
  assert.ok(invalidUser.errors.some((e) => e.includes("6 digit")));

  const valid = validateClientSetupPayload(
    {
      applyProfile: true,
      profile: {
        brandName: "Kopi Klien Baru",
        taxEnabled: true,
        taxRate: 10,
        taxMode: "EXCLUSIVE",
        monthlyRevenueTarget: 90000000,
        autoDeductStockOnSale: false,
      },
      applyCashAccounts: true,
      cashAccounts: [
        { name: "Tabungan Cadangan", type: "SAVINGS", isDefault: true },
        { name: "Laci Kasir Klien", type: "CASH", isDefault: false },
      ],
      newUsers: [
        { name: "Kasir Klien", username: "kasir.klien", role: "KASIR", department: "Bar", pin: "654321" },
      ],
    },
    ["admin"]
  );
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.sanitized.profile?.brandName, "Kopi Klien Baru");
  assert.strictEqual(valid.sanitized.cashAccounts[0].isDefault, false);
  assert.strictEqual(valid.sanitized.cashAccounts[1].isDefault, true);
  assert.strictEqual(valid.sanitized.newUsers.length, 1);
});

test("44e. buildCleaningSummary menghitung selisih baris yang dihapus dengan tepat", () => {
  const summary = buildCleaningSummary(
    { orders: 24, ingredients: 13, expense_categories: 34 },
    { orders: 0, ingredients: 0, expense_categories: 32 },
    parseCleaningGroups({ customExpenseCategories: true })
  );
  assert.strictEqual(summary.deletedTotal, 39);
  assert.strictEqual(summary.deletedByTable.orders, 24);
  assert.strictEqual(summary.deletedByTable.ingredients, 13);
  assert.strictEqual(summary.deletedByTable.expense_categories, 2);
});

test("44f. findUnlinkedStaffUsers & buildEmployeeDraftFromUser mendeteksi akun Finance/Manager untuk didaftarkan ke SDM", () => {
  const sampleUsers = [
    { id: "u-admin", username: "admin", name: "Super Admin", role: "SUPER_ADMIN", isSuspended: false },
    { id: "u-owner", username: "owner", name: "Owner Cafe", role: "OWNER", isSuspended: false },
    { id: "u-mgr", username: "manager", name: "Bu Manager", role: "MANAGER", department: "Operasional", isSuspended: false },
    { id: "u-fin", username: "finance", name: "Pak Finance", role: "FINANCE", department: "Finance", isSuspended: false },
    { id: "u-kasir", username: "kasir", name: "Kasir Lama", role: "KASIR", employeeId: "emp-1", isSuspended: false },
    { id: "u-susp", username: "resign1", name: "Suspended", role: "BAR", isSuspended: true },
  ];
  const sampleEmployees = [{ id: "emp-1", username: "kasir" }];

  const unlinked = findUnlinkedStaffUsers(sampleUsers, sampleEmployees);
  assert.strictEqual(unlinked.length, 2);
  assert.deepStrictEqual(
    unlinked.map((u) => u.username),
    ["manager", "finance"]
  );

  const mgrDraft = buildEmployeeDraftFromUser(unlinked[0], "2026-11-25");
  assert.strictEqual(mgrDraft.position, "Manager Operasional");
  assert.strictEqual(mgrDraft.department, "MANAGEMENT");
  assert.strictEqual(mgrDraft.status, "AKTIF");

  const finDraft = buildEmployeeDraftFromUser(unlinked[1], "2026-11-25");
  assert.strictEqual(finDraft.position, "Finance & Accounting");
  assert.strictEqual(finDraft.department, "Finance");
});

// -------------------------------------------------------------
// 45. PENGUJIAN ADAPTIVE BRAND LOGO SUITE (LIGHT / DARK / PRINT)
// -------------------------------------------------------------
test("45. brandLogo resolver memilih varian logo adaptif & menghormati logo kustom", () => {
  assert.strictEqual(isCustomBrandLogo(null), false);
  assert.strictEqual(isCustomBrandLogo(""), false);
  assert.strictEqual(isCustomBrandLogo(DEFAULT_BRAND_LOGO_SETTING), false);
  assert.strictEqual(isCustomBrandLogo("/logo-name-blue.png"), false);
  assert.strictEqual(isCustomBrandLogo(withBrandLogoVersion("/logo-name-white.png")), false);
  assert.strictEqual(isCustomBrandLogo("data:image/png;base64,iVBORw0KGgo="), true);
  assert.strictEqual(isCustomBrandLogo("https://cdn.example.com/custom.png"), true);

  // Built-in defaults route by context & theme (dengan cache-busting query version)
  assert.strictEqual(resolveBrandLogo(DEFAULT_BRAND_LOGO_SETTING, "icon-on-dark"), withBrandLogoVersion("/logo-icon-color.png"));
  assert.strictEqual(resolveBrandLogo(DEFAULT_BRAND_LOGO_SETTING, "icon-on-light"), withBrandLogoVersion("/logo-icon-blue.png"));
  assert.strictEqual(resolveBrandLogo(DEFAULT_BRAND_LOGO_SETTING, "name-on-dark"), withBrandLogoVersion("/logo-name-white.png"));
  assert.strictEqual(resolveBrandLogo(DEFAULT_BRAND_LOGO_SETTING, "name-on-light"), withBrandLogoVersion("/logo-name-blue.png"));
  assert.strictEqual(resolveBrandLogo(DEFAULT_BRAND_LOGO_SETTING, "mono-print"), withBrandLogoVersion("/logo-wordmark-mono.png"));
  assert.strictEqual(resolveThemeLogo(null, true, "name"), withBrandLogoVersion("/logo-name-white.png"));
  assert.strictEqual(resolveThemeLogo(null, false, "name"), withBrandLogoVersion("/logo-name-blue.png"));
  assert.strictEqual(resolveThemeLogo(DEFAULT_BRAND_LOGO_SETTING, true, "icon"), withBrandLogoVersion("/logo-icon-color.png"));
  assert.strictEqual(resolveThemeLogo(DEFAULT_BRAND_LOGO_SETTING, false, "icon"), withBrandLogoVersion("/logo-icon-blue.png"));

  // Custom uploaded logo overrides built-in contexts cleanly
  const customLogo = "data:image/png;base64,CUSTOMDATA";
  assert.strictEqual(resolveBrandLogo(customLogo, "icon-on-dark"), customLogo);
  assert.strictEqual(resolveBrandLogo(customLogo, "mono-print"), customLogo);
  assert.strictEqual(resolveThemeLogo(customLogo, false, "name"), customLogo);

  // Ensure every built-in logo & PWA icon exists on disk in public/
  const publicDir = path.resolve(process.cwd(), "public");
  for (const relPath of BUILTIN_DEFAULT_LOGOS) {
    const filePath = path.join(publicDir, relPath.replace(/^\//, ""));
    assert.ok(fs.existsSync(filePath), `File logo bawaan harus tersedia di public/: ${relPath}`);
  }
  for (const pwaFile of ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
    assert.ok(fs.existsSync(path.join(publicDir, pwaFile)), `Ikon PWA harus tersedia: ${pwaFile}`);
  }
});

// -------------------------------------------------------------
// 46. PENGUJIAN PROTEKSI KATEGORI TERINTEGRASI & POS KAS/TABUNGAN
// -------------------------------------------------------------
test("46a. 32 kategori keuangan inti dikunci hapus & tipe/induknya, namun bebas ubah nama/warna/ikon", () => {
  assert.strictEqual(isCoreExpenseCategory("cat-bahan-baku"), true);
  assert.strictEqual(isCoreExpenseCategory("cat-packaging"), true);
  assert.strictEqual(isCoreExpenseCategory("cat-custom-promo"), false);

  const existingCore: ExpenseCategory = {
    id: "cat-packaging",
    name: "Packaging & Kemasan",
    type: "BAHAN_BAKU",
    parentId: "cat-bahan-baku",
    color: "#FCD34D",
    icon: "box",
    isActive: true,
    sortOrder: 4,
  };
  const customCategory: ExpenseCategory = {
    id: "cat-custom-1",
    name: "Dekorasi Event",
    type: "PENGELUARAN",
    parentId: null,
    color: "#1b2cc0",
    icon: "tag",
    isActive: true,
    sortOrder: 99,
  };

  // Mencoba ubah tipe & induk pada kategori inti -> tetap dikunci, nama & warna berhasil berubah
  const sanitized = sanitizeCoreExpenseCategoryUpdate(
    {
      ...existingCore,
      name: "Gelas & Kemasan Toko",
      color: "#10B981",
      type: "PENDAPATAN",
      parentId: null,
    },
    existingCore
  );
  assert.strictEqual(sanitized.name, "Gelas & Kemasan Toko");
  assert.strictEqual(sanitized.color, "#10B981");
  assert.strictEqual(sanitized.type, "BAHAN_BAKU");
  assert.strictEqual(sanitized.parentId, "cat-bahan-baku");

  // Sync yang mencoba menghapus cat-packaging tetap mengembalikannya dari DB
  const synced = protectCoreExpenseCategoriesOnSync(
    [customCategory],
    [existingCore, customCategory]
  );
  assert.strictEqual(synced.some((c) => c.id === "cat-packaging"), true);
  assert.strictEqual(synced.some((c) => c.id === "cat-custom-1"), true);
});

test("46b. Opsi 2 melindungi kategori bahan kritis (Bahan Olahan, Packaging & Cup, Lainnya) & jaga kata kunci rename", async () => {
  const { matchesIngredientCategory } = await import("../src/utils/financeMetrics");

  assert.strictEqual(isProtectedIngredientCategory("Bahan Olahan"), true);
  assert.strictEqual(isProtectedIngredientCategory("Packaging & Cup"), true);
  assert.strictEqual(isProtectedIngredientCategory("Lainnya"), true);
  assert.strictEqual(isProtectedIngredientCategory("Biji Kopi"), false);
  assert.strictEqual(isProtectedIngredientCategory("Topping Khusus"), false);

  // Rename valid yang menjaga peran fungsional
  assert.strictEqual(validateIngredientCategoryRename("Bahan Olahan", "Bahan Olahan Bar").valid, true);
  assert.strictEqual(validateIngredientCategoryRename("Packaging & Cup", "Kemasan & Gelas").valid, true);
  // Pastikan filter HPP/Olahan tetap mengenali nama baru tersebut
  assert.strictEqual(matchesIngredientCategory("Bahan Olahan Bar", "Bahan Olahan"), true);
  assert.strictEqual(matchesIngredientCategory("Kemasan & Gelas", "Packaging & Cup"), true);

  // Rename yang memutus integrasi atau mengubah Lainnya harus ditolak
  assert.strictEqual(validateIngredientCategoryRename("Bahan Olahan", "Sirup").valid, false);
  assert.strictEqual(validateIngredientCategoryRename("Packaging & Cup", "Bumbu").valid, false);
  assert.strictEqual(validateIngredientCategoryRename("Lainnya", "Umum").valid, false);
});

test("46c. Pos Kas Utama, Rekening Bank terhubung rekap & Tabungan aktif dikunci hapus/jenisnya, akun kosong tambahan boleh dihapus", () => {
  const mainCash: CashAccount = { id: "cash-drawer-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true };
  const activeSavings: CashAccount = { id: "acc-sav-1", name: "Tabungan Cadangan", type: "SAVINGS", isDefault: false };
  const primaryBank: CashAccount = { id: "acc-bank-1", name: "Rekening BCA Outlet", type: "BANK", isDefault: false };
  const extraBankEmpty: CashAccount = { id: "acc-bank-2", name: "Rekening Mandiri Cadangan", type: "BANK", isDefault: false };
  const emptyWallet: CashAccount = { id: "acc-ewallet-empty", name: "Dompet QRIS Baru", type: "E_WALLET", isDefault: false };

  const txs: CashTransaction[] = [
    {
      id: "tx-sav-1",
      accountId: "acc-sav-1",
      type: "CASH_IN",
      date: "2026-11-25",
      amount: 1000000,
      description: "Setor dana cadangan",
      category: "Transfer",
    },
  ];
  const recaps = [{ bankAccountId: "acc-bank-1" }];

  // 1. Jika hanya ada 1 BANK (walau 0 transaksi & 0 rekap), tetap terkunci karena terhubung Rekap Penjualan
  const singleBankAccounts = [mainCash, activeSavings, primaryBank];
  const singleBankProt = evaluateCashAccountProtection(primaryBank, singleBankAccounts, txs, []);
  assert.strictEqual(singleBankProt.isOnlyBankAccount, true);
  assert.strictEqual(singleBankProt.canDelete, false);
  assert.strictEqual(singleBankProt.canChangeType, false);

  // 2. Jika ada 2 BANK: bank tertaut Rekap Penjualan tetap terkunci walau 0 cash_transactions; bank ke-2 kosong boleh dihapus
  const multiBankAccounts = [mainCash, activeSavings, primaryBank, extraBankEmpty, emptyWallet];
  const linkedBankProt = evaluateCashAccountProtection(primaryBank, multiBankAccounts, txs, recaps);
  assert.strictEqual(linkedBankProt.isOnlyBankAccount, false);
  assert.strictEqual(linkedBankProt.linkedRecapCount, 1);
  assert.strictEqual(linkedBankProt.canDelete, false);
  assert.strictEqual(linkedBankProt.canChangeType, false);

  const extraBankProt = evaluateCashAccountProtection(extraBankEmpty, multiBankAccounts, txs, recaps);
  assert.strictEqual(extraBankProt.canDelete, true);
  assert.strictEqual(extraBankProt.canChangeType, true);

  const mainProt = evaluateCashAccountProtection(mainCash, multiBankAccounts, txs, recaps);
  assert.strictEqual(mainProt.canDelete, false);
  assert.strictEqual(mainProt.canChangeType, false);

  const savProt = evaluateCashAccountProtection(activeSavings, multiBankAccounts, txs, recaps);
  assert.strictEqual(savProt.canDelete, false);
  assert.strictEqual(savProt.canChangeType, false);
  assert.strictEqual(savProt.balance, 1000000);

  const emptyWalletProt = evaluateCashAccountProtection(emptyWallet, multiBankAccounts, txs, recaps);
  assert.strictEqual(emptyWalletProt.canDelete, true);
  assert.strictEqual(emptyWalletProt.canChangeType, true);

  // 3. Sync guard menjaga kas utama, tabungan aktif, bank terakhir, & bank tertaut rekap sambil mengizinkan rename
  const synced = protectCashAccountsOnSync(
    [
      { id: "acc-sav-1", name: "Tabungan Toko BCA", type: "E_WALLET", isDefault: false },
      { id: "acc-bank-1", name: "BCA Kasir & QRIS", type: "CASH", isDefault: false },
    ],
    [mainCash, activeSavings, primaryBank],
    [{ accountId: "acc-sav-1" }],
    recaps
  );
  const syncedMain = synced.find((a) => a.id === "cash-drawer-main");
  const syncedSav = synced.find((a) => a.id === "acc-sav-1");
  const syncedBank = synced.find((a) => a.id === "acc-bank-1");
  assert.ok(syncedMain, "Pos Kas Utama tidak boleh terhapus oleh sync");
  assert.ok(syncedSav, "Tabungan aktif tidak boleh terhapus oleh sync");
  assert.strictEqual(syncedSav?.name, "Tabungan Toko BCA");
  assert.strictEqual(syncedSav?.type, "SAVINGS");
  assert.ok(syncedBank, "Rekening Bank terhubung Rekap Penjualan tidak boleh terhapus oleh sync");
  assert.strictEqual(syncedBank?.name, "BCA Kasir & QRIS");
  assert.strictEqual(syncedBank?.type, "BANK");
});

// -------------------------------------------------------------
// 47. PENGUJIAN MAPPING REKENING DEFAULT PER METODE PEMBAYARAN
// -------------------------------------------------------------
test("47a. resolveEffectivePaymentAccountMapping & resolveRecapChannelAllocations menggabung rekening sama & memecah rekening beda", () => {
  const accounts: CashAccount[] = [
    { id: "cash-main", name: "Laci Kasir", type: "CASH", isDefault: true },
    { id: "bank-bca", name: "Bank BCA", type: "BANK", isDefault: false },
    { id: "bank-mandiri", name: "Bank Mandiri", type: "BANK", isDefault: false },
  ];

  // Skenario 1: QRIS + Transfer ke BCA, EDC + Ojol ke Mandiri
  const splitMapping = {
    cash: "cash-main",
    qris: "bank-bca",
    transfer: "bank-bca",
    edc: "bank-mandiri",
    onlineDelivery: "bank-mandiri",
  };
  const effective = resolveEffectivePaymentAccountMapping(splitMapping, accounts);
  assert.strictEqual(effective.qris, "bank-bca");
  assert.strictEqual(effective.onlineDelivery, "bank-mandiri");

  const recap: DailySalesRecap = {
    id: "rec-split-1",
    date: "2026-11-25",
    cashAmount: 500000,
    qrisAmount: 300000,
    edcAmount: 200000,
    transferAmount: 150000,
    onlineDeliveryAmount: 250000,
    totalAmount: 1400000,
    recordedBy: "Finance",
    createdAt: "2026-11-25T10:00:00Z",
  };

  const splitAlloc = resolveRecapChannelAllocations({
    recap,
    mapping: splitMapping,
    cashAccounts: accounts,
  });
  assert.strictEqual(splitAlloc.cashAccountId, "cash-main");
  assert.strictEqual(splitAlloc.cashAmount, 500000);
  assert.strictEqual(splitAlloc.nonCashGroups.length, 2);
  const bcaGroup = splitAlloc.nonCashGroups.find((g) => g.accountId === "bank-bca");
  const mandiriGroup = splitAlloc.nonCashGroups.find((g) => g.accountId === "bank-mandiri");
  assert.strictEqual(bcaGroup?.amount, 450000);
  assert.strictEqual(mandiriGroup?.amount, 450000);

  // Skenario 2: Semua metode non-tunai diarahkan ke 1 bank -> digabung menjadi 1 mutasi bersih
  const singleBankMapping = {
    cash: "cash-main",
    qris: "bank-bca",
    edc: "bank-bca",
    transfer: "bank-bca",
    onlineDelivery: "bank-bca",
  };
  const mergedAlloc = resolveRecapChannelAllocations({
    recap,
    mapping: singleBankMapping,
    cashAccounts: accounts,
  });
  assert.strictEqual(mergedAlloc.nonCashGroups.length, 1);
  assert.strictEqual(mergedAlloc.nonCashGroups[0].accountId, "bank-bca");
  assert.strictEqual(mergedAlloc.nonCashGroups[0].amount, 900000);

  // Skenario 3: Rekap lama tanpa mapping tetap fallback ke recap.bankAccountId
  const legacyAlloc = resolveRecapChannelAllocations({
    recap: { ...recap, bankAccountId: "bank-mandiri" },
    mapping: null,
    cashAccounts: accounts,
  });
  assert.strictEqual(legacyAlloc.nonCashGroups.length, 1);
  assert.strictEqual(legacyAlloc.nonCashGroups[0].accountId, "bank-mandiri");
});

test("47b. resolvePaymentAccountId menghormati paymentAccountMapping POS sesuai metode bayar", () => {
  const accounts: CashAccount[] = [
    { id: "cash-main", name: "Laci Kasir", type: "CASH", isDefault: true },
    { id: "bank-bca", name: "Bank BCA", type: "BANK", isDefault: false },
    { id: "ewallet-qris", name: "Dompet QRIS", type: "E_WALLET", isDefault: false },
  ];
  const mapping = {
    cash: "cash-main",
    qris: "ewallet-qris",
    edc: "bank-bca",
    transfer: "bank-bca",
  };

  assert.strictEqual(resolvePaymentAccountId("QRIS", null, accounts, null, mapping), "ewallet-qris");
  assert.strictEqual(resolvePaymentAccountId("DEBIT", null, accounts, null, mapping), "bank-bca");
  assert.strictEqual(resolvePaymentAccountId("TRANSFER", null, accounts, null, mapping), "bank-bca");
  assert.strictEqual(resolvePaymentAccountId("CASH", null, accounts, null, mapping), "cash-main");
});

test("47c. Akun yang menjadi tujuan default paymentAccountMapping dilarang dihapus meski 0 transaksi", () => {
  const mainCash: CashAccount = { id: "cash-main", name: "Laci Kasir", type: "CASH", isDefault: true };
  const primaryBank: CashAccount = { id: "bank-bca", name: "Bank BCA", type: "BANK", isDefault: false };
  const walletQris: CashAccount = { id: "ewallet-qris", name: "Dompet QRIS", type: "E_WALLET", isDefault: false };
  const accounts = [mainCash, primaryBank, walletQris];
  const mapping = { qris: "ewallet-qris" };

  const mappedProt = evaluateCashAccountProtection(walletQris, accounts, [], [], mapping);
  assert.strictEqual(mappedProt.canDelete, false);
  assert.deepStrictEqual(mappedProt.mappedPaymentChannels, ["QRIS"]);

  // Setelah mapping dipindahkan dari ewallet-qris, akun kosong itu boleh dihapus lagi
  const unmappedProt = evaluateCashAccountProtection(walletQris, accounts, [], [], { qris: "bank-bca" });
  assert.strictEqual(unmappedProt.canDelete, true);

  // Sync guard juga melindungi akun yang masih terdaftar di paymentAccountMapping
  const synced = protectCashAccountsOnSync([mainCash, primaryBank], accounts, [], [], mapping);
  assert.ok(synced.some((a) => a.id === "ewallet-qris"));
});

// -------------------------------------------------------------
// TEST SUITE 48: EXPORT, IMPORT & TEMPLATE ENGINE HELPERS
// -------------------------------------------------------------
console.log("\n[Suite 48] Export, Import & Template Engine Helpers...");

test("48a. normalizeTextCode, parseLocalizedNumber, dan parseFlexibleDateYmd menangani variasi format Excel", () => {
  // Preserve leading zeroes & strip trailing .0 from numeric Excel exports
  assert.strictEqual(normalizeTextCode("08123456789"), "08123456789");
  assert.strictEqual(normalizeTextCode("12345.0"), "12345");
  assert.strictEqual(normalizeTextCode(12345), "12345");
  assert.strictEqual(normalizeTextCode("  SKU-001  "), "SKU-001");

  // Localized Rupiah / Indonesian & US numbers
  assert.strictEqual(parseLocalizedNumber("Rp 1.250.000"), 1250000);
  assert.strictEqual(parseLocalizedNumber("1.234,5"), 1234.5);
  assert.strictEqual(parseLocalizedNumber("1,234.75"), 1234.75);
  assert.strictEqual(parseLocalizedNumber("(25.000)"), -25000);

  // Flexible date parsing (ISO, DD/MM/YYYY, Excel serial date)
  assert.strictEqual(parseFlexibleDateYmd("2026-05-14"), "2026-05-14");
  assert.strictEqual(parseFlexibleDateYmd("14/05/2026"), "2026-05-14");
  assert.strictEqual(parseFlexibleDateYmd(46156), "2026-05-14");
  assert.strictEqual(parseFlexibleDateYmd("not-a-date"), null);
});

test("48b. matchAndNormalizeImportRows mencocokkan alias header, cek kolom wajib, dan deteksi baris contoh", () => {
  const result = matchAndNormalizeImportRows(
    [
      {
        "nama menu": "Kopi Susu Gula Aren",
        div: "BAR",
        harga: "25.000",
      },
      {
        "nama menu": "Matcha Latte",
        div: "BAR",
        harga: "28.000",
      },
    ],
    {
      expectedHeaders: ["Nama Menu", "Divisi", "Harga Jual"],
      requiredHeaders: ["Nama Menu", "Harga Jual"],
      headerAliases: {
        "Nama Menu": ["nama menu", "menu"],
        Divisi: ["div", "division"],
        "Harga Jual": ["harga", "price"],
      },
      exampleRowValues: ["Kopi Susu Gula Aren", "BAR", "25000"],
    }
  );

  assert.strictEqual(result.missingRequiredHeaders.length, 0);
  assert.strictEqual(result.exampleRowDetected, true);
  assert.strictEqual(result.rows.length, 2);
  assert.strictEqual(result.rows[1]["Nama Menu"], "Matcha Latte");
  assert.strictEqual(result.rows[1]["Divisi"], "BAR");

  const missingReq = matchAndNormalizeImportRows(
    [{ "Nama Menu": "Test" }],
    {
      expectedHeaders: ["Nama Menu", "Harga Jual"],
      requiredHeaders: ["Nama Menu", "Harga Jual"],
    }
  );
  assert.deepStrictEqual(missingReq.missingRequiredHeaders, ["Harga Jual"]);
  assert.ok(missingReq.warnings.some((w) => w.includes("Kolom wajib")));
});

test("48c. buildMenuImportPlan mengelompokkan multi-varian & update by productId::variantId", () => {
  const existing: Product[] = [
    {
      id: "prod-1",
      name: "Americano",
      category: "Coffee",
      productGroup: "COFFEE",
      division: "BAR",
      isActive: true,
      variants: [
        {
          id: "var-hot",
          productId: "prod-1",
          name: "Hot",
          price: 18000,
          packagingCost: 1000,
          isAvailable: true,
        },
      ],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  const plan = buildMenuImportPlan(
    [
      // Update varian existing lewat ID_SISTEM
      {
        "ID_SISTEM (JANGAN DIUBAH)": "prod-1::var-hot",
        "Nama Menu": "Americano",
        Divisi: "BAR",
        "Kategori Menu": "Coffee",
        "Nama Varian": "Hot",
        "Harga Jual": 20000,
        "Biaya Kemasan": 1200,
      },
      // Produk baru dengan 2 varian
      {
        "Nama Menu": "Butter Croissant",
        Divisi: "BAKER",
        "Kategori Menu": "Pastry",
        "Nama Varian": "Original",
        "Harga Jual": 26000,
      },
      {
        "Nama Menu": "Butter Croissant",
        Divisi: "BAKER",
        "Kategori Menu": "Pastry",
        "Nama Varian": "Almond",
        "Harga Jual": 32000,
      },
      // Baris tanpa nama -> skipped
      {
        "Nama Menu": "",
        "Harga Jual": 10000,
      },
    ],
    existing,
    "2026-05-01T00:00:00Z"
  );

  assert.strictEqual(plan.updatedVariants, 1);
  assert.strictEqual(plan.productsToUpdate.length, 1);
  assert.strictEqual(plan.productsToUpdate[0].variants[0].price, 20000);
  assert.strictEqual(plan.productsToCreate.length, 1);
  assert.strictEqual(plan.productsToCreate[0].variants.length, 2);
  assert.strictEqual(plan.addedVariants, 2);
  assert.strictEqual(plan.skipped, 1);
});

test("48d. parseOpnamePhysicalSheetRows, groupImportedPurchaseOrders, buildRecipeImportPlan, dan parseDailySalesRecapImportRows", () => {
  const ingredients: Ingredient[] = [
    {
      id: "ing-bean",
      code: "BHN-01",
      name: "Espresso Bean",
      category: "Kopi",
      unit: "gr",
      currentStock: 1000,
      minStock: 200,
      costPerUnit: 250,
    },
    {
      id: "ing-milk",
      code: "BHN-02",
      name: "Fresh Milk",
      category: "Dairy",
      unit: "ml",
      currentStock: 2000,
      minStock: 500,
      costPerUnit: 20,
    },
  ];

  // Opname: baris kosong tidak menimpa jadi 0; baris terisi menghitung selisih
  const opnameRes = parseOpnamePhysicalSheetRows(
    [
      { "ID_SISTEM (JANGAN DIUBAH)": "ing-bean", "Stok Fisik": "850", Catatan: "Susut giling" },
      { "ID_SISTEM (JANGAN DIUBAH)": "ing-milk", "Stok Fisik": "" },
    ],
    ingredients
  );
  assert.strictEqual(opnameRes.updates.length, 1);
  assert.strictEqual(opnameRes.updates[0].difference, -150);
  assert.strictEqual(opnameRes.skipped, 1);

  // Grouping PO import: skip closed period & duplicate PO
  const suppliers: Supplier[] = [
    { id: "sup-1", name: "PT Kopi Nusantara", contact: "08111", picName: "Budi", address: "Jakarta", notes: "" },
  ];
  const poPlan = groupImportedPurchaseOrders(
    [
      { "No. PO": "PO-001", Tanggal: "2026-05-10", Supplier: "PT Kopi Nusantara", "Nama Bahan": "Espresso Bean", "Jumlah Beli": 2, "Harga Satuan": 200000 },
      { "No. PO": "PO-001", Tanggal: "2026-05-10", Supplier: "PT Kopi Nusantara", "Nama Bahan": "Fresh Milk", "Jumlah Beli": 5, "Harga Satuan": 18000 },
      { "No. PO": "PO-OLD", Tanggal: "2026-04-05", Supplier: "PT Kopi Nusantara", "Nama Bahan": "Fresh Milk", "Jumlah Beli": 1, "Harga Satuan": 18000 },
      { "No. PO": "PO-DUP", Tanggal: "2026-05-11", Supplier: "PT Kopi Nusantara", "Nama Bahan": "Fresh Milk", "Jumlah Beli": 1, "Harga Satuan": 18000 },
    ],
    suppliers,
    ingredients,
    {
      existingPurchaseOrders: [{ id: "po-x", poNumber: "PO-DUP" } as PurchaseOrder],
      closedPeriods: [{ period: "2026-04" }],
    }
  );
  assert.strictEqual(poPlan.ordersToCreate.length, 1);
  assert.strictEqual(poPlan.ordersToCreate[0].items.length, 2);
  assert.strictEqual(poPlan.ordersToCreate[0].totalAmount, 490000);
  assert.strictEqual(poPlan.ordersToCreate[0].items[0].productId, "ing-bean");
  assert.strictEqual(poPlan.closedSkipped, 1);
  assert.strictEqual(poPlan.duplicatePoCount, 1);

  // Recipe import merge duplicate ingredients per menu
  const existingRecipes: Recipe[] = [
    { id: "rec-1", menuName: "Latte (Regular)", ingredients: [{ ingredientId: "ing-bean", quantity: 18 }] },
  ];
  const recPlan = buildRecipeImportPlan(
    [
      { "Nama Menu / Varian": "Latte (Regular)", "Nama Bahan Baku": "Espresso Bean", Takaran: 20 },
      { "Nama Menu / Varian": "Latte (Regular)", "Nama Bahan Baku": "Fresh Milk", Takaran: 150 },
      { "Nama Menu / Varian": "Espresso", "Nama Bahan Baku": "Espresso Bean", Takaran: 18 },
    ],
    ingredients,
    existingRecipes
  );
  assert.strictEqual(recPlan.toUpdate.length, 1);
  assert.strictEqual(recPlan.toUpdate[0].ingredients.length, 2);
  assert.strictEqual(recPlan.toCreate.length, 1);

  // Recap import respects closed periods & merges totalAmount
  const recapRes = parseDailySalesRecapImportRows(
    [
      { Tanggal: "2026-04-20", Shift: "PAGI", Tunai: 500000 },
      { Tanggal: "2026-05-12", Shift: "PAGI", Tunai: 300000, QRIS: 250000 },
    ],
    {
      existingRecaps: [],
      closedPeriods: [{ period: "2026-04" }],
      defaultCashAccountId: "cash-1",
      defaultBankAccountId: "bank-1",
    }
  );
  assert.strictEqual(recapRes.closedSkipped, 1);
  assert.strictEqual(recapRes.toCreate.length, 1);
  assert.strictEqual(recapRes.toCreate[0].totalAmount, 550000);
});

test("48e. formatStockMovementTypeLabel & parseImportedExpenseCategories Kategori Induk bekerja konsisten", () => {
  assert.strictEqual(formatStockMovementTypeLabel("PURCHASE"), "Pembelian");
  assert.strictEqual(formatStockMovementTypeLabel("ADJUSTMENT"), "Opname / Koreksi");
  assert.strictEqual(formatStockMovementTypeLabel("WASTE"), "Waste / Rusak");

  const existingCats: ExpenseCategory[] = [
    {
      id: "cat-ops",
      name: "Operasional",
      type: "PENGELUARAN",
      parentId: null,
      color: "#1b2cc0",
      icon: "wallet",
      isActive: true,
      sortOrder: 1,
    },
  ];
  const parsed = parseImportedExpenseCategories(
    [
      { "Nama Kategori": "Listrik & Air", Tipe: "UTILITAS", "Kategori Induk": "Operasional", Warna: "#1b2cc0", Icon: "zap" },
      { "Nama Kategori": "Listrik & Air", Tipe: "UTILITAS", "Kategori Induk": "Operasional", Warna: "#1b2cc0", Icon: "zap" },
    ],
    existingCats,
    ["zap", "wallet"]
  );
  assert.strictEqual(parsed.toCreate.length, 1);
  assert.strictEqual(parsed.toCreate[0].parentId, "cat-ops");
  assert.strictEqual(parsed.skipped, 1);
});

// -------------------------------------------------------------
// TEST SUITE 49: REGRESSION AUDIT (SPLIT TAX, ZERO QTY, CHANNEL ROUTING & CLOSED PERIOD)
// -------------------------------------------------------------
console.log("\n[Suite 49] Regression Bug Fixes...");

test("49a. resolveOrderItemIngredients mengembalikan [] untuk quantity 0 eksplisit dan default 1 jika undefined", () => {
  const recipes = [
    {
      id: "rec-esp",
      menuName: "Espresso",
      ingredients: [{ ingredientId: "ing-bean", quantity: 18 }],
    },
  ];
  const ingredients = [
    { id: "ing-bean", name: "Espresso Bean", unit: "gr", costPerUnit: 250 },
  ];

  const zeroRes = resolveOrderItemIngredients(
    { menuName: "Espresso", recipeId: "rec-esp", quantity: 0 },
    recipes,
    [],
    ingredients
  );
  assert.deepStrictEqual(zeroRes, []);

  const undefRes = resolveOrderItemIngredients(
    { menuName: "Espresso", recipeId: "rec-esp", quantity: undefined },
    recipes,
    [],
    ingredients
  );
  assert.strictEqual(undefRes.length, 1);
  assert.strictEqual(undefRes[0].totalQuantity, 18);
});

test("49b. computeSplitItemsTotals menghitung PB1 EXCLUSIVE & INCLUSIVE identik dengan server split bill", () => {
  const excl = computeSplitItemsTotals(100000, 10, "EXCLUSIVE");
  assert.strictEqual(excl.subtotal, 100000);
  assert.strictEqual(excl.taxAmount, 10000);
  assert.strictEqual(excl.totalAmount, 110000);

  const incl = computeSplitItemsTotals(110000, 10, "INCLUSIVE");
  assert.strictEqual(incl.subtotal, 110000);
  assert.strictEqual(incl.taxAmount, 10000);
  assert.strictEqual(incl.totalAmount, 110000);

  const noTax = computeSplitItemsTotals(75000, 0, "EXCLUSIVE");
  assert.strictEqual(noTax.subtotal, 75000);
  assert.strictEqual(noTax.taxAmount, 0);
  assert.strictEqual(noTax.totalAmount, 75000);
});

test("49c. resolveRecapChannelAllocations mempertahankan qrisAccountId/edcAccountId/transferAccountId/onlineDeliveryAccountId", () => {
  const accounts: CashAccount[] = [
    { id: "cash-main", name: "Laci Kasir", type: "CASH", isDefault: true },
    { id: "bank-qris", name: "BCA QRIS", type: "BANK", isDefault: false },
    { id: "bank-edc", name: "Mandiri EDC", type: "BANK", isDefault: false },
  ];
  const recap: DailySalesRecap = {
    id: "rcp-49c",
    date: "2026-05-15",
    shift: "PAGI",
    cashAmount: 200000,
    qrisAmount: 150000,
    edcAmount: 300000,
    transferAmount: 100000,
    onlineDeliveryAmount: 50000,
    discountAmount: 0,
    refundAmount: 0,
    mdrFeeAmount: 0,
    totalAmount: 800000,
    cashAccountId: "cash-main",
    bankAccountId: "bank-edc",
    qrisAccountId: "bank-qris",
    edcAccountId: "bank-edc",
    transferAccountId: "bank-qris",
    onlineDeliveryAccountId: "bank-edc",
    nonCashSettlementStatus: "SETTLED",
    createdAt: "2026-05-15T12:00:00Z",
    recordedBy: "Kasir",
  };
  const alloc = resolveRecapChannelAllocations({ recap, mapping: null, cashAccounts: accounts });
  assert.strictEqual(alloc.cashAccountId, "cash-main");
  const byAcc = new Map(alloc.nonCashGroups.map((g) => [g.accountId, g.amount]));
  assert.strictEqual(byAcc.get("bank-qris"), 250000);
  assert.strictEqual(byAcc.get("bank-edc"), 350000);
});

// -------------------------------------------------------------
// HASIL AKHIR
// -------------------------------------------------------------
console.log("\n=========================================================");
console.log(`HASIL TESTING: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
}
