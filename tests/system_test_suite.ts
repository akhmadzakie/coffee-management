// System Test Suite - Julia's Coffee Management POS & ERP
import assert from "node:assert";
import crypto from "node:crypto";
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
  parseSmartCoffeeTextEntry,
} from "../src/utils/posDomainLogic";
import {
  getPreviousPeriodString,
  computeAutoOverheadBaseline,
  calculateHppOverheadSimulation,
  calculateFnbHealthMetrics,
  computePeriodicOpnameCogs,
  computeCashLiquidityBreakdown,
  computePeriodSavingsFlow,
  computePeriodFinancialSummary,
  isCapexCashTransaction,
  isAdminBankOrMdrTransaction,
} from "../src/utils/financeMetrics";
import {
  buildEscPosReceipt,
  buildCashDrawerKickCommand,
} from "../src/utils/escpos";
import {
  formatWhatsAppPhoneNumber,
  buildWhatsAppReceiptText,
  buildWhatsAppReceiptUrl,
} from "../src/utils/whatsappReceipt";
import { exportSinglePayslipPDF } from "../src/utils/export";
import {
  AttendanceRecord,
  CashTransaction,
  CashAccount,
  DailyAttendance,
  Employee,
  Recipe,
  Ingredient,
  BatchPreparation,
  Product,
  User,
} from "../src/types";
import {
  buildAttendanceCorrectionUpdate,
  calculateWorkDurationHours,
  classifyDailyAttendanceStatus,
  computeMonthlyAttendanceRecap,
  resolveCanonicalEmployeeId,
  syncAttendanceRecordsWithDaily,
} from "../src/utils/attendanceRecap";

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
    autoDeductStockOnSale: true,
    allowNegativeStockSale: true,
  };

  assert.strictEqual(defaultSettings.posSupervisorPin, "1234");
  assert.strictEqual(defaultSettings.autoDeductStockOnSale, true);
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
// HASIL AKHIR
// -------------------------------------------------------------
console.log("\n=========================================================");
console.log(`HASIL TESTING: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
}
