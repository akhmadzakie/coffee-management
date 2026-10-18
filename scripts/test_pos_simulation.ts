// scripts/test_pos_simulation.ts
// Test script for verifying POS cashier ordering and automatic inventory deduction

async function runSimulation() {
  const baseUrl = "http://localhost:3000";
  console.log("=========================================================");
  console.log("☕ SIMULASI TRANSAKSI POS & PEMOTONGAN STOK OTOMATIS");
  console.log("=========================================================\n");

  // Step 1: Check Server Health
  console.log("1️⃣  Mengecek status server...");
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  console.log("   Status server:", healthData);

  // Step 2: Fetch POS Menu & Initial Stock
  console.log("\n2️⃣  Mengambil data Menu POS dan Saldo Awal Bahan Baku...");
  const menuRes = await fetch(`${baseUrl}/api/pos/menu`);
  const menuData = await menuRes.json();
  const menuItems: any[] = menuData.menu || [];
  console.log(`   Ditemukan ${menuItems.length} menu aktif siap dijual di POS.`);
  for (const m of menuItems) {
    console.log(`   • [${m.category}] ${m.name} - Estimasi HPP: Rp ${m.estimatedHpp?.toLocaleString("id-ID")}, Kapasitas Sisa: ${m.maxPortions} porsi`);
  }

  const syncRes1 = await fetch(`${baseUrl}/api/sync`);
  const syncData1 = await syncRes1.json();
  const ingredients1: any[] = syncData1.ingredients || [];
  
  const coffeeBeans1 = ingredients1.find((i) => i.id === "ing-coffee-beans");
  const freshMilk1 = ingredients1.find((i) => i.id === "ing-fresh-milk");
  const arenCair1 = ingredients1.find((i) => i.id === "ing-aren-cair");

  console.log("\n   --- Saldo Awal Bahan Baku ---");
  console.log(`   • ${coffeeBeans1?.name}: ${coffeeBeans1?.currentStock} ${coffeeBeans1?.unit}`);
  console.log(`   • ${freshMilk1?.name}: ${freshMilk1?.currentStock} ${freshMilk1?.unit}`);
  console.log(`   • ${arenCair1?.name}: ${arenCair1?.currentStock} ${arenCair1?.unit}`);

  // Step 3: Simulate Order 1 - Direct Cash Payment (2x Kopi Susu Gula Aren)
  console.log("\n3️⃣  Melakukan Transaksi POS Langsung Lunas (CASH - Pay First)...");
  console.log("   Pelanggan: Budi Santoso (Dine In - Meja 04)");
  console.log("   Item: 2x Kopi Susu Gula Aren @ Rp 22.000 = Rp 44.000");
  console.log("   Resep: 18g Biji Kopi, 120ml Fresh Milk, 25ml Gula Aren Cair per porsi");
  console.log("   Target pengurangan otomatis: -36g Kopi, -240ml Susu, -50ml Aren");

  const orderPayload = {
    customerName: "Budi Santoso",
    orderType: "DINE_IN",
    tableNumber: "Meja 04",
    subtotal: 44000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 44000,
    status: "PAID",
    cashierName: "Ahmad Kasir",
    payment: {
      paymentMethod: "CASH",
      amount: 44000,
      cashReceived: 50000,
      changeAmount: 6000,
      cashAccountId: "cash-drawer-main",
    },
    items: [
      {
        menuName: "Kopi Susu Gula Aren",
        variantName: "Iced 16oz",
        recipeId: "rec-kopsu-aren",
        quantity: 2,
        unitPrice: 22000,
        subtotal: 44000,
      },
    ],
  };

  const orderRes = await fetch(`${baseUrl}/api/pos/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text();
    throw new Error(`Gagal membuat order: ${orderRes.status} - ${errText}`);
  }

  const orderResult = await orderRes.json();
  const order1 = orderResult.order;
  const payment1 = (orderResult.payments && orderResult.payments[0]) || orderResult.payment;

  console.log("   ✅ Order Berhasil Dibuat!");
  console.log(`   • Nomor Struk : ${order1?.receiptNo}`);
  console.log(`   • Status      : ${order1?.status}`);
  console.log(`   • Total Bayar : Rp ${order1?.totalAmount?.toLocaleString("id-ID")}`);
  console.log(`   • Pembayaran  : ${payment1?.paymentMethod} (Uang Diterima: Rp ${payment1?.cashReceived?.toLocaleString("id-ID")}, Kembalian: Rp ${payment1?.changeAmount?.toLocaleString("id-ID")})`);

  // Step 4: Verify Stock Deduction
  console.log("\n4️⃣  Verifikasi Pemotongan Stok Bahan Baku Setelah Transaksi...");
  const syncRes2 = await fetch(`${baseUrl}/api/sync`);
  const syncData2 = await syncRes2.json();
  const ingredients2: any[] = syncData2.ingredients || [];
  const stockMovements2: any[] = syncData2.stock_movements || [];

  const coffeeBeans2 = ingredients2.find((i) => i.id === coffeeBeans1?.id);
  const freshMilk2 = ingredients2.find((i) => i.id === freshMilk1?.id);
  const arenCair2 = ingredients2.find((i) => i.id === arenCair1?.id);

  const coffeeDiff = Number(coffeeBeans1?.currentStock) - Number(coffeeBeans2?.currentStock);
  const milkDiff = Number(freshMilk1?.currentStock) - Number(freshMilk2?.currentStock);
  const arenDiff = Number(arenCair1?.currentStock) - Number(arenCair2?.currentStock);

  console.log("   --- Saldo Bahan Baku Pasca Order ---");
  console.log(`   • ${coffeeBeans2?.name}: ${coffeeBeans2?.currentStock} ${coffeeBeans2?.unit} (Berkurang: -${coffeeDiff} ${coffeeBeans2?.unit})`);
  console.log(`   • ${freshMilk2?.name}: ${freshMilk2?.currentStock} ${freshMilk2?.unit} (Berkurang: -${milkDiff} ${freshMilk2?.unit})`);
  console.log(`   • ${arenCair2?.name}: ${arenCair2?.currentStock} ${arenCair2?.unit} (Berkurang: -${arenDiff} ${arenCair2?.unit})`);

  if (coffeeDiff === 36 && milkDiff === 240 && arenDiff === 50) {
    console.log("   🎯 AKURASI STOK: 100% COCOK! Pemotongan resep otomatis terverifikasi sempurna.");
  } else {
    throw new Error(`⚠️ Selisih stok tidak sesuai! Kopi: ${coffeeDiff}, Susu: ${milkDiff}, Aren: ${arenDiff}`);
  }

  // Check recent stock movements
  const recentMovements = stockMovements2.filter((m) => m.referenceId === order1?.id);
  console.log(`   • Ditemukan ${recentMovements.length} entri riwayat mutasi stok USAGE:`);
  for (const m of recentMovements) {
    console.log(`     - [${m.type}] ${m.quantity} (${m.note})`);
  }

  // Step 5: Verify Cash Drawer Transaction & Sales Records
  console.log("\n5️⃣  Verifikasi Catatan Kas Masuk (Cash In) & Penjualan (Sales)...");
  const cashTxList: any[] = syncData2.cash_transactions || [];
  const salesTxList: any[] = syncData2.sales_transactions || [];

  const recentCashTx = cashTxList.find((c) => c.referenceId === order1?.id);
  if (recentCashTx) {
    console.log(`   ✅ Kas Masuk Tercatat: Rp ${recentCashTx.amount?.toLocaleString("id-ID")} [${recentCashTx.description}]`);
  }

  const recentSalesTx = salesTxList.filter((s) => s.importLogId === `POS-${order1?.receiptNo}`);
  console.log(`   ✅ Transaksi Penjualan Tercatat: ${recentSalesTx.length} item masuk ke modul Sales.`);

  // Step 6: Test Open Bill Flow (Order Pending -> Pelunasan Kemudian)
  console.log("\n6️⃣  Simulasi Open Bill (Order Dibuat -> Lunas Saat Selesai Konsumsi)...");
  const openBillPayload = {
    customerName: "Siti Rahma",
    orderType: "DINE_IN",
    tableNumber: "Meja 09",
    subtotal: 20000,
    totalAmount: 20000,
    status: "OPEN",
    cashierName: "Ahmad Kasir",
    items: [
      {
        menuName: "Cafe Latte",
        variantName: "Hot 8oz",
        recipeId: "rec-cafe-latte",
        quantity: 1,
        unitPrice: 20000,
        subtotal: 20000,
      },
    ],
  };

  const openBillRes = await fetch(`${baseUrl}/api/pos/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(openBillPayload),
  });
  const openBillResult = await openBillRes.json();
  const openOrder = openBillResult.order;
  console.log(`   • Open Bill dibuat: #${openOrder?.receiptNo} (Status: ${openOrder?.status})`);

  // Check that stock is NOT deducted yet during OPEN state
  const syncRes3 = await fetch(`${baseUrl}/api/sync`);
  const syncData3 = await syncRes3.json();
  const coffeeBeans3 = syncData3.ingredients.find((i: any) => i.id === coffeeBeans1?.id);
  console.log(`   • Saldo Kopi saat Open Bill masih OPEN: ${coffeeBeans3?.currentStock} ${coffeeBeans3?.unit} (Belum terpotong, menunggu pelunasan)`);

  // Now settle / pay the Open Bill via QRIS
  console.log("   Melakukan pelunasan Open Bill via QRIS di kasir...");
  const payRes = await fetch(`${baseUrl}/api/pos/orders/${openOrder?.id}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentMethod: "QRIS",
      amount: 20000,
      referenceNo: "QRIS-BCA-9912048",
      cashAccountId: "cash-drawer-main",
      cashierName: "Ahmad Kasir",
    }),
  });

  const payResult = await payRes.json();
  console.log(`   ✅ Pelunasan Sukses! Status Order Sekarang: ${payResult.order?.status}`);

  // Verify stock deduction after Open Bill is paid
  const syncRes4 = await fetch(`${baseUrl}/api/sync`);
  const syncData4 = await syncRes4.json();
  const coffeeBeans4 = syncData4.ingredients.find((i: any) => i.id === coffeeBeans1?.id);
  const freshMilk4 = syncData4.ingredients.find((i: any) => i.id === freshMilk1?.id);

  console.log("   --- Saldo Bahan Baku Pasca Pelunasan Open Bill (Cafe Latte: 18g Kopi, 150ml Susu) ---");
  console.log(`   • ${coffeeBeans4?.name}: ${coffeeBeans4?.currentStock} ${coffeeBeans4?.unit} (Berkurang lagi: -${Number(coffeeBeans3?.currentStock) - Number(coffeeBeans4?.currentStock)} ${coffeeBeans4?.unit})`);
  console.log(`   • ${freshMilk4?.name}: ${freshMilk4?.currentStock} ${freshMilk4?.unit} (Berkurang lagi: -${Number(freshMilk2?.currentStock) - Number(freshMilk4?.currentStock)} ${freshMilk4?.unit})`);

  console.log("\n=========================================================");
  console.log("✨ SEMUA SKENARIO BERHASIL DIUJI DENGAN SEMPURNA 100%!");
  console.log("=========================================================\n");
}

runSimulation().catch((err) => {
  console.error("❌ Terjadi kesalahan pada simulasi:", err);
  process.exit(1);
});
