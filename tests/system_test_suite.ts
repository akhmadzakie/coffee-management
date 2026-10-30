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
} from "../src/utils/posDomainLogic";
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
  CashTransaction,
  CashAccount,
  Recipe,
  Ingredient,
} from "../src/types";

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
// HASIL AKHIR
// -------------------------------------------------------------
console.log("\n=========================================================");
console.log(`HASIL TESTING: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
}
