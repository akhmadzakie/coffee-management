import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");

const BOOK_DIRS = [
  path.join(process.cwd(), "docs", "buku-1-kasir-barista", "screenshots"),
  path.join(process.cwd(), "docs", "buku-2-manager-leader", "screenshots"),
  path.join(process.cwd(), "docs", "buku-3-finance", "screenshots"),
  path.join(process.cwd(), "docs", "buku-4-owner", "screenshots"),
  path.join(process.cwd(), "docs", "buku-5-super-admin", "screenshots"),
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CapturedScreen {
  id: string;
  filename: string;
  title: string;
  category: string;
  sizeBytes: number;
  status: "OK" | "WARNING" | "ERROR";
  notes: string;
}

async function runFullSystemSimulation() {
  console.log("================================================================================");
  console.log("🚀 MEMULAI SIMULASI SISTEM LENGKAP & PENGUJIAN SCREENSHOT - JULIA'S COFFEE ERP/POS");
  console.log("================================================================================\n");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const dir of BOOK_DIRS) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const results: CapturedScreen[] = [];
  const detectedBugs: { step: string; message: string; severity: "LOW" | "MEDIUM" | "HIGH" }[] = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1440,900",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });

  const page = await browser.newPage();

  // Listen to browser console and errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error] ${msg.text()}`);
      if (!msg.text().includes("favicon") && !msg.text().includes("404")) {
        detectedBugs.push({
          step: "Browser Runtime",
          message: msg.text(),
          severity: "MEDIUM",
        });
      }
    }
  });

  page.on("pageerror", (err) => {
    console.log(`[Browser Unhandled Exception] ${err.message}`);
    detectedBugs.push({
      step: "Page Exception",
      message: err.message,
      severity: "HIGH",
    });
  });

  try {
    // =========================================================================
    // TAHAP 1: SCREENSHOT HALAMAN LOGIN UTAMA (01_login_screen.png)
    // =========================================================================
    console.log("📌 [TAHAP 1] Pengujian Halaman Login Utama...");
    await page.goto(`${BASE_URL}`, { waitUntil: "networkidle2" });
    await sleep(2000);

    const loginPath = path.join(OUTPUT_DIR, "01_login_screen.png");
    await page.screenshot({ path: loginPath });
    const loginStat = fs.statSync(loginPath);
    results.push({
      id: "LOGIN",
      filename: "01_login_screen.png",
      title: "Halaman Login Keypad PIN",
      category: "Auth",
      sizeBytes: loginStat.size,
      status: loginStat.size > 20000 ? "OK" : "WARNING",
      notes: "Menampilkan pemilihan akun staf & keypad PIN 6-digit",
    });

    // =========================================================================
    // TAHAP 2: LOGIN SEBAGAI SUPER ADMIN UNTUK MEMBUKA SEMUA HAK AKSES
    // =========================================================================
    console.log("📌 [TAHAP 2] Simulasi Login Super Admin (PIN 123456)...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("super admin") || b.innerText.toLowerCase().includes("admin")) {
          b.click();
          break;
        }
      }
    });
    await sleep(500);

    for (const d of ["1", "2", "3", "4", "5", "6"]) {
      await page.evaluate((digit) => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.trim() === digit) {
            b.click();
            break;
          }
        }
      }, d);
      await sleep(50);
    }
    await sleep(3000);

    // =========================================================================
    // TAHAP 3: PRESENSI SELFIE & CLOCK IN (02_clock_in_attendance.png)
    // =========================================================================
    console.log("📌 [TAHAP 3] Simulasi Presensi Wajah & GPS (#attendance_clock)...");
    await page.evaluate(() => {
      window.location.hash = "#attendance_clock";
    });
    await sleep(2500);

    // Click camera activation or simulate camera stream
    await page.evaluate(() => {
      const cameraBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.innerText.toLowerCase().includes("kamera") || b.innerText.toLowerCase().includes("buka kamera")
      );
      if (cameraBtn) cameraBtn.click();
    });
    await sleep(1500);

    const attendPath = path.join(OUTPUT_DIR, "02_clock_in_attendance.png");
    await page.screenshot({ path: attendPath });
    const attendStat = fs.statSync(attendPath);
    results.push({
      id: "ATTENDANCE",
      filename: "02_clock_in_attendance.png",
      title: "Presensi Selfie Kamera & GPS",
      category: "Karyawan / Kasir",
      sizeBytes: attendStat.size,
      status: attendStat.size > 30000 ? "OK" : "WARNING",
      notes: "Menampilkan jendela selfie, koordinat GPS, shift kerja & tombol Clock In",
    });

    // =========================================================================
    // TAHAP 4: SIMULASI ALUR KASIR DI ROUTE /pos
    // =========================================================================
    console.log("📌 [TAHAP 4] Navigasi ke Layar Kasir Mandiri (/pos)...");
    await page.goto(`${BASE_URL}/pos`, { waitUntil: "networkidle2" });
    await sleep(2500);

    // Check if cashier login required
    const isPosLoginNeeded = await page.evaluate(() => {
      return document.body.innerText.toLowerCase().includes("pilih akun kasir") ||
             document.body.innerText.toLowerCase().includes("masukkan pin kasir");
    });

    if (isPosLoginNeeded) {
      console.log("   -> Memilih kasir & memasukkan PIN...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.toLowerCase().includes("kasir") || b.innerText.toLowerCase().includes("terminal")) {
            b.click();
            break;
          }
        }
      });
      await sleep(500);
      for (const d of ["1", "2", "3", "4", "5", "6"]) {
        await page.evaluate((digit) => {
          const btns = Array.from(document.querySelectorAll("button"));
          for (const b of btns) {
            if (b.innerText.trim() === digit) {
              b.click();
              break;
            }
          }
        }, d);
        await sleep(50);
      }
      await sleep(2500);
    }

    // =========================================================================
    // SUB-TAHAP 4A: BUKA SHIFT KASIR (pos_buka_shift_modal.png)
    // =========================================================================
    console.log("📌 [TAHAP 4A] Membuka Dialog Buka Shift Kasir & Modal Awal...");
    // Check if shift is already open, if not modal should be open or we click Buka Shift
    let shiftModalVisible = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("h2, h3, div")).some((el) =>
        el.textContent?.toLowerCase().includes("buka shift kasir baru")
      );
    });

    if (!shiftModalVisible) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.toLowerCase().includes("buka shift") || b.title?.toLowerCase().includes("buka shift")) {
            b.click();
            break;
          }
        }
      });
      await sleep(1500);
    }

    // In Buka Shift Modal: Select PIC
    console.log("   -> Memilih Penanggung Jawab Shift (PIC Kasir)...");
    await page.evaluate(() => {
      const select = document.querySelector("select") as HTMLSelectElement;
      if (select && select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const input = document.querySelector("input[type='text'], input[placeholder*='0'], input") as HTMLInputElement;
      if (input) {
        input.value = "300.000";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await sleep(1000);

    const bukaShiftPath = path.join(OUTPUT_DIR, "pos_buka_shift_modal.png");
    await page.screenshot({ path: bukaShiftPath });
    const bukaShiftStat = fs.statSync(bukaShiftPath);
    results.push({
      id: "BUKA_SHIFT",
      filename: "pos_buka_shift_modal.png",
      title: "Modal Form Buka Shift Kasir",
      category: "Kasir (POS)",
      sizeBytes: bukaShiftStat.size,
      status: bukaShiftStat.size > 30000 ? "OK" : "WARNING",
      notes: "Menampilkan form input Modal Awal Rp 300.000 dan pemilihan PIC Kasir",
    });

    // Submit Buka Shift
    console.log("   -> Menekan tombol konfirmasi Buka Shift...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const submitBtn = btns.find(
        (b) => b.innerText.toLowerCase().includes("buka shift") && !b.innerText.toLowerCase().includes("tutup")
      );
      if (submitBtn) submitBtn.click();
    });
    await sleep(3000);

    // =========================================================================
    // SUB-TAHAP 4B: MODAL CUSTOMIZE MODIFIER (pos_customize_modal.png)
    // =========================================================================
    console.log("📌 [TAHAP 4B] Membuka Modal Kustomisasi Minuman / Modifier...");
    await page.evaluate(() => {
      const customizeBtns = Array.from(document.querySelectorAll("button")).filter(
        (b) => b.title?.toLowerCase().includes("kustomisasi") || b.innerText.toLowerCase().includes("custom")
      );
      if (customizeBtns.length > 0) {
        (customizeBtns[0] as HTMLElement).click();
      } else {
        // Fallback: click any product card
        const card = document.querySelector(".group.relative.bg-white") as HTMLElement;
        if (card) card.click();
      }
    });
    await sleep(2000);

    const custModalPath = path.join(OUTPUT_DIR, "pos_customize_modal.png");
    await page.screenshot({ path: custModalPath });
    const custModalStat = fs.statSync(custModalPath);
    results.push({
      id: "CUSTOMIZE_MODIFIER",
      filename: "pos_customize_modal.png",
      title: "Modal Kustomisasi Menu & Modifier",
      category: "Kasir (POS)",
      sizeBytes: custModalStat.size,
      status: custModalStat.size > 30000 ? "OK" : "WARNING",
      notes: "Menampilkan opsi Level Gula (Sweetness), Es, Varian Susu (Oatmilk), dan Extra Shot",
    });

    // Add customized item to cart
    await page.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.innerText.toLowerCase().includes("tambahkan") || b.innerText.toLowerCase().includes("simpan")
      );
      if (addBtn) addBtn.click();
    });
    await sleep(1500);

    // =========================================================================
    // SUB-TAHAP 4C: TERMINAL KASIR AKTIF DENGAN KERANJANG (03_pos_terminal.png)
    // =========================================================================
    console.log("📌 [TAHAP 4C] Menyiapkan Keranjang Belanja & Nomor Meja...");
    // Add one more item
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".group.relative.bg-white, .cursor-pointer"));
      if (cards.length > 1) (cards[1] as HTMLElement).click();

      // Set Table Number & Customer Name
      const inputs = Array.from(document.querySelectorAll("input"));
      const mejaInput = inputs.find((i) => i.placeholder?.toLowerCase().includes("meja"));
      if (mejaInput) {
        mejaInput.value = "Meja 05";
        mejaInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const custInput = inputs.find((i) => i.placeholder?.toLowerCase().includes("nama") || i.placeholder?.toLowerCase().includes("pelanggan"));
      if (custInput) {
        custInput.value = "Kak Budi";
        custInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await sleep(1500);

    const posTermPath = path.join(OUTPUT_DIR, "03_pos_terminal.png");
    await page.screenshot({ path: posTermPath });
    const posTermStat = fs.statSync(posTermPath);
    results.push({
      id: "POS_TERMINAL",
      filename: "03_pos_terminal.png",
      title: "Layar Kerja POS Kasir Aktif",
      category: "Kasir (POS)",
      sizeBytes: posTermStat.size,
      status: posTermStat.size > 40000 ? "OK" : "WARNING",
      notes: "Menampilkan katalog produk aktif, keranjang belanja terisi, Meja 05, dan kalkulasi subtotal",
    });

    // =========================================================================
    // SUB-TAHAP 4D: MODAL PEMBAYARAN (18_pos_payment_modal.png)
    // =========================================================================
    console.log("📌 [TAHAP 4D] Membuka Jendela Pembayaran Kasir (Pay Modal)...");
    await page.evaluate(() => {
      const bayarBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.innerText.toLowerCase().includes("bayar")
      );
      if (bayarBtn) bayarBtn.click();
    });
    await sleep(2500);

    const payModalPath = path.join(OUTPUT_DIR, "18_pos_payment_modal.png");
    await page.screenshot({ path: payModalPath });
    const payModalStat = fs.statSync(payModalPath);
    results.push({
      id: "PAYMENT_MODAL",
      filename: "18_pos_payment_modal.png",
      title: "Jendela Pembayaran Kasir Lengkap",
      category: "Kasir (POS)",
      sizeBytes: payModalStat.size,
      status: payModalStat.size > 30000 ? "OK" : "WARNING",
      notes: "Menampilkan tab Tunai, QRIS Dinamis, Split Bill, pecahan cepat dan kembalian",
    });

    // Close payment modal
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll("button"));
      for (const b of closeBtns) {
        if (b.innerText.toLowerCase().includes("kembali") || b.innerText.toLowerCase().includes("batal") || b.querySelector("svg")) {
          b.click();
          break;
        }
      }
    });
    await sleep(1500);

    // =========================================================================
    // SUB-TAHAP 4E: OTORISASI MANAGER PIN (pos_manager_pin_modal.png)
    // =========================================================================
    console.log("📌 [TAHAP 4E] Membuka Pop-up Otorisasi PIN Manager...");
    // Click Diskon button
    await page.evaluate(() => {
      const diskonBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.innerText.toLowerCase().includes("diskon")
      );
      if (diskonBtn) diskonBtn.click();
    });
    await sleep(1000);

    // Select Manual Discount and trigger manager PIN
    await page.evaluate(() => {
      const manualBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.innerText.toLowerCase().includes("manual") || b.innerText.toLowerCase().includes("khusus")
      );
      if (manualBtn) manualBtn.click();
    });
    await sleep(500);

    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const valInput = inputs.find((i) => i.type === "number" || i.placeholder?.includes("%"));
      if (valInput) {
        valInput.value = "20";
        valInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const reasonInput = inputs.find((i) => i.placeholder?.toLowerCase().includes("alasan"));
      if (reasonInput) {
        reasonInput.value = "Diskon Khusus Mitra VIP Julia's";
        reasonInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const reqBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.innerText.toLowerCase().includes("pin") || b.innerText.toLowerCase().includes("otorisasi") || b.innerText.toLowerCase().includes("terapkan")
      );
      if (reqBtn) reqBtn.click();
    });
    await sleep(2000);

    const pinModalPath = path.join(OUTPUT_DIR, "pos_manager_pin_modal.png");
    await page.screenshot({ path: pinModalPath });
    const pinModalStat = fs.statSync(pinModalPath);
    results.push({
      id: "MANAGER_PIN",
      filename: "pos_manager_pin_modal.png",
      title: "Pop-up Otorisasi PIN Manager",
      category: "Kasir (POS)",
      sizeBytes: pinModalStat.size,
      status: pinModalStat.size > 25000 ? "OK" : "WARNING",
      notes: "Menampilkan keypad PIN keamanan 4-6 digit untuk approval diskon > 10% dan void pesanan",
    });

    // Close PIN modal with escape
    await page.keyboard.press("Escape");
    await sleep(1500);

    // =========================================================================
    // SUB-TAHAP 4F: TUTUP SHIFT KASIR & Z-REPORT (pos_tutup_shift_modal.png)
    // =========================================================================
    console.log("📌 [TAHAP 4F] Membuka Form Tutup Shift Kasir (Shift Closing)...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (
          b.innerText.toLowerCase().includes("tutup shift") ||
          b.title?.toLowerCase().includes("tutup shift") ||
          b.title?.toLowerCase().includes("ringkasan shift")
        ) {
          b.click();
          break;
        }
      }
    });
    await sleep(2000);

    // Input Actual Ending Cash Rp 350.000 to show difference calculation
    await page.evaluate(() => {
      const input = document.querySelector("input[placeholder*='0'], input[type='text']") as HTMLInputElement;
      if (input) {
        input.value = "350.000";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await sleep(1000);

    const tutupShiftPath = path.join(OUTPUT_DIR, "pos_tutup_shift_modal.png");
    await page.screenshot({ path: tutupShiftPath });
    const tutupShiftStat = fs.statSync(tutupShiftPath);
    results.push({
      id: "TUTUP_SHIFT",
      filename: "pos_tutup_shift_modal.png",
      title: "Form Tutup Shift & Rekonsiliasi Kas",
      category: "Kasir (POS)",
      sizeBytes: tutupShiftStat.size,
      status: tutupShiftStat.size > 30000 ? "OK" : "WARNING",
      notes: "Menampilkan total penerimaan kas, input fisik laci kas, perhitungan selisih, dan cetak Z-Report",
    });

    // =========================================================================
    // TAHAP 5: KITCHEN DISPLAY SYSTEM (/kds) (04_kds_screen.png)
    // =========================================================================
    console.log("📌 [TAHAP 5] Pengujian Layar Dapur & Barista KDS (/kds)...");
    await page.goto(`${BASE_URL}/kds`, { waitUntil: "networkidle2" });
    await sleep(2500);

    const kdsPath = path.join(OUTPUT_DIR, "04_kds_screen.png");
    await page.screenshot({ path: kdsPath });
    const kdsStat = fs.statSync(kdsPath);
    results.push({
      id: "KDS",
      filename: "04_kds_screen.png",
      title: "Layar Antrean Pesanan KDS Barista & Kitchen",
      category: "Operasional Bar / Kitchen",
      sizeBytes: kdsStat.size,
      status: kdsStat.size > 30000 ? "OK" : "WARNING",
      notes: "Menampilkan kartu pesanan masuk, stasiun BAR & KITCHEN, status Menunggu -> Diproses -> Selesai",
    });

    // =========================================================================
    // TAHAP 6: WEB MANAGEMENT BACK-OFFICE - MODUL MANAJEMEN, FINANCE, OWNER & ADMIN
    // =========================================================================
    console.log("📌 [TAHAP 6] Pengujian Modul Web Manajemen Back-Office...");
    await page.goto(`${BASE_URL}`, { waitUntil: "networkidle2" });
    await sleep(2000);

    // If logged out or on cashier, login as Super Admin
    const isLoginAgain = await page.evaluate(() => {
      return !document.querySelector("header") && !document.querySelector("nav");
    });
    if (isLoginAgain) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.toLowerCase().includes("super admin")) {
            b.click();
            break;
          }
        }
      });
      await sleep(500);
      for (const d of ["1", "2", "3", "4", "5", "6"]) {
        await page.evaluate((digit) => {
          const btns = Array.from(document.querySelectorAll("button"));
          for (const b of btns) {
            if (b.innerText.trim() === digit) {
              b.click();
              break;
            }
          }
        }, d);
        await sleep(50);
      }
      await sleep(2500);
    }

    const managementModules = [
      {
        hash: "#leader_checklist",
        filename: "04_leader_checklist.png",
        title: "Checklist Supervisi Shift Leader",
        category: "Leader & Manager",
        notes: "Daftar cek opening, kebersihan bar, suhu chiller, kelayakan mesin kopi, dan closing",
      },
      {
        hash: "#inventory",
        filename: "05_inventory_screen.png",
        title: "Manajemen Stok Bahan Baku & Opname",
        category: "Leader & Manager",
        notes: "Monitoring stok bahan baku (biji kopi, susu, sirup), batas minimum, waste tracking & opname",
      },
      {
        hash: "#purchases",
        filename: "07_purchases_screen.png",
        title: "Pengadaan & Pembelian Bahan (PO)",
        category: "Leader & Manager",
        notes: "Pencatatan Purchase Order ke supplier, penerimaan barang, dan status pelunasan invoice",
      },
      {
        hash: "#hpp_calculator",
        filename: "08_hpp_calculator_screen.png",
        title: "Kalkulator HPP & Simulasi Resep Menu",
        category: "Leader & Manager",
        notes: "Rincian gramatur resep per porsi, kalkulasi HPP otomatis, margin laba kotor & penetapan harga",
      },
      {
        hash: "#promotions",
        filename: "09_promotions_screen.png",
        title: "Manajemen Promo & Diskon Toko",
        category: "Leader & Manager",
        notes: "Pengaturan promo diskon persentase, nominal potongan, promo jam happy hour, dan batas tanggal",
      },
      {
        hash: "#dashboard_manager",
        filename: "16_dashboard_manager.png",
        title: "Dasbor Operasional Shift Manager",
        category: "Leader & Manager",
        notes: "Ringkasan penjualan real-time, status staf bertugas, bahan baku menipis & peringatan operasional",
      },
      {
        hash: "#cash_flow",
        filename: "06_cashflow_screen.png",
        title: "Buku Kas & Arus Kas Operasional",
        category: "Finance & Accounting",
        notes: "Pencatatan kas masuk / keluar operasional, kategori biaya (Beban Listrik, Kebersihan), upload bukti struk",
      },
      {
        hash: "#finance_reports",
        filename: "11_finance_reports_screen.png",
        title: "Laporan Laba Rugi Toko & Kunci Periode",
        category: "Finance & Accounting",
        notes: "Laporan Pendapatan, HPP bahan baku, Beban Operasional, Laba Bersih (Net Profit) & fitur Lock Periode",
      },
      {
        hash: "#payroll",
        filename: "07_payroll_screen.png",
        title: "Penggajian Karyawan & Slip Gaji",
        category: "Finance & HR",
        notes: "Rekap kehadiran, perhitungan gaji pokok, tunjangan shift, lembur, potongan & pratinjau slip gaji PDF",
      },
      {
        hash: "#dashboard_finance",
        filename: "17_dashboard_finance.png",
        title: "Dasbor Keuangan & Likuiditas Kas",
        category: "Finance & Accounting",
        notes: "Saldo kas di laci & rekening bank, grafik perputaran kas, tagihan jatuh tempo & rasio kesehatan kas",
      },
      {
        hash: "#dashboard_owner",
        filename: "02_dashboard_owner.png",
        title: "Dasbor Eksekutif Bisnis Owner",
        category: "Owner & Direksi",
        notes: "Total omzet bulanan, margin keuntungan bersih, top 5 menu terlaris, dan tren pertumbuhan tahunan",
      },
      {
        hash: "#users",
        filename: "08_users_pin_screen.png",
        title: "Manajemen Karyawan, Hak Akses & PIN",
        category: "Super Admin",
        notes: "Daftar pengguna terdaftar, hierarki role (KASIR, BAR, LEADER, MANAGER, FINANCE, OWNER), reset PIN",
      },
      {
        hash: "#audit_log",
        filename: "14_audit_log_screen.png",
        title: "Audit Log Aktivitas & Jejak Forensik",
        category: "Super Admin",
        notes: "Rekaman jejak aktivitas sistem secara kronologis (login, buka shift, persetujuan PIN, void, mutasi kas)",
      },
      {
        hash: "#settings",
        filename: "15_settings_screen.png",
        title: "Pengaturan Sistem, Pajak PB1 & Printer",
        category: "Super Admin",
        notes: "Konfigurasi identitas Julia's Coffee, tarif pajak PB1 10%, printer thermal ESC/POS, dan PIN Supervisor",
      },
    ];

    for (const mod of managementModules) {
      console.log(`   -> Mengakses ${mod.hash} (${mod.title})...`);
      await page.evaluate((h) => {
        window.location.hash = h;
      }, mod.hash);
      await sleep(2500);

      const filePath = path.join(OUTPUT_DIR, mod.filename);
      await page.screenshot({ path: filePath });
      const stat = fs.statSync(filePath);
      results.push({
        id: mod.hash.replace("#", "").toUpperCase(),
        filename: mod.filename,
        title: mod.title,
        category: mod.category,
        sizeBytes: stat.size,
        status: stat.size > 30000 ? "OK" : "WARNING",
        notes: mod.notes,
      });
    }

    // =========================================================================
    // TAHAP 7: SINKRONISASI FILE KE SELURUH DIREKTORI DOKUMENTASI (BUKU 1 - 5)
    // =========================================================================
    console.log("\n📌 [TAHAP 7] Menyinkronkan file screenshot ke semua buku dokumentasi...");
    for (const bookDir of BOOK_DIRS) {
      for (const item of results) {
        const src = path.join(OUTPUT_DIR, item.filename);
        const dest = path.join(bookDir, item.filename);
        fs.copyFileSync(src, dest);
      }
    }
    console.log("   ✅ Berhasil disalin ke 5 folder buku dokumentasi.");

    // =========================================================================
    // TAHAP 8: LAPORAN HASIL PENGUJIAN & VERIFIKASI
    // =========================================================================
    console.log("\n================================================================================");
    console.log("📊 HASIL SIMULASI SISTEM & VERIFIKASI SCREENSHOT");
    console.log("================================================================================");
    console.log(`Total Halaman / Modal Teruji: ${results.length}`);
    console.log(`Bug / Exception Terdeteksi: ${detectedBugs.length}`);
    console.log("--------------------------------------------------------------------------------");

    // Check for duplicate sizes (suspected duplicate screen bug)
    const sizeMap = new Map<number, string[]>();
    for (const r of results) {
      const existing = sizeMap.get(r.sizeBytes) || [];
      existing.push(r.filename);
      sizeMap.set(r.sizeBytes, existing);
    }

    let duplicateFound = false;
    for (const [size, files] of sizeMap.entries()) {
      if (files.length > 1) {
        console.log(`⚠️ PERINGATAN UKURAN KEMBAR (${size} bytes): ${files.join(", ")}`);
        duplicateFound = true;
      }
    }
    if (!duplicateFound) {
      console.log("✅ VERIFIKASI SUKSES: Semua screenshot memiliki ukuran unik (tidak ada gambar identik / duplikat)!");
    }

    // Save test report JSON for auditing
    const reportPath = path.join(process.cwd(), "docs", "simulation_verification_report.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          totalScreens: results.length,
          detectedBugs,
          results,
        },
        null,
        2
      )
    );
    console.log(`Laporan verifikasi disimpan ke: ${reportPath}`);

  } catch (err: any) {
    console.error("❌ Terjadi kesalahan selama simulasi:", err);
  } finally {
    await browser.close();
  }
}

runFullSystemSimulation();

