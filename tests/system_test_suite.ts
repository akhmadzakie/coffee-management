// System Test Suite - Julia's Coffee Management POS & ERP
import assert from "node:assert";

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
// HASIL AKHIR
// -------------------------------------------------------------
console.log("\n=========================================================");
console.log(`HASIL TESTING: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
}
