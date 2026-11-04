import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");
const BASE_URL = "http://localhost:3000";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureAllUniqueScreens() {
  console.log("=== STARTING FULL DISCRETE SCREENSHOT SUITE ===");
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

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

  try {
    const page = await browser.newPage();

    // ─────────────────────────────────────────────────────────────
    // 1. CAPTURE LOGIN SCREEN
    // ─────────────────────────────────────────────────────────────
    console.log("[1/18] Capturing 01_login_screen.png...");
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_login_screen.png") });

    // ─────────────────────────────────────────────────────────────
    // 2. LOGIN AS SUPER ADMIN (Full Access to Everything)
    // ─────────────────────────────────────────────────────────────
    console.log("Logging in as Super Admin...");
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
      await sleep(60);
    }
    await sleep(3500);

    // List of Hash views to capture
    const hashViews = [
      { hash: "#attendance_clock", filename: "02_clock_in_attendance.png", label: "Presensi Selfie & Clock In" },
      { hash: "#leader_checklist", filename: "04_leader_checklist.png", label: "Checklist Supervisi Leader" },
      { hash: "#inventory", filename: "05_inventory_screen.png", label: "Stok Bahan Baku & Opname" },
      { hash: "#purchases", filename: "07_purchases_screen.png", label: "Pembelian Bahan (PO)" },
      { hash: "#hpp_calculator", filename: "08_hpp_calculator_screen.png", label: "Kalkulator HPP & Resep" },
      { hash: "#promotions", filename: "09_promotions_screen.png", label: "Promo & Diskon Toko" },
      { hash: "#cash_flow", filename: "06_cashflow_screen.png", label: "Buku Kas & Arus Kas" },
      { hash: "#finance_reports", filename: "11_finance_reports_screen.png", label: "Laporan Laba Rugi Toko" },
      { hash: "#payroll", filename: "07_payroll_screen.png", label: "Penggajian (Payroll)" },
      { hash: "#users", filename: "08_users_pin_screen.png", label: "Manajemen Pengguna & PIN" },
      { hash: "#audit_log", filename: "14_audit_log_screen.png", label: "Audit Log Aktivitas" },
      { hash: "#settings", filename: "15_settings_screen.png", label: "Pengaturan Sistem & Pajak" },
      { hash: "#dashboard_owner", filename: "02_dashboard_owner.png", label: "Dasbor Eksekutif Owner" },
      { hash: "#dashboard_manager", filename: "16_dashboard_manager.png", label: "Dasbor Operasional Manager" },
      { hash: "#dashboard_finance", filename: "17_dashboard_finance.png", label: "Dasbor Keuangan Finance" },
    ];

    let count = 2;
    for (const item of hashViews) {
      console.log(`[${count}/18] Navigating to ${item.hash} (${item.label})...`);
      await page.evaluate((h) => {
        window.location.hash = h;
      }, item.hash);
      await sleep(2500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, item.filename) });
      count++;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. CAPTURE KDS SCREEN (/kds)
    // ─────────────────────────────────────────────────────────────
    console.log("[16/18] Capturing 04_kds_screen.png (/kds)...");
    await page.goto(`${BASE_URL}/kds`, { waitUntil: "networkidle2" });
    await sleep(2500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_kds_screen.png") });

    // ─────────────────────────────────────────────────────────────
    // 4. CAPTURE POS TERMINAL (/pos)
    // ─────────────────────────────────────────────────────────────
    console.log("[17/18] Navigating to /pos...");
    await page.goto(`${BASE_URL}/pos`, { waitUntil: "networkidle2" });
    await sleep(2000);

    // Login as cashier on POS
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
    await sleep(3000);

    // Dismiss Buka Shift modal if open
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll("button"));
      for (const b of closeBtns) {
        if (b.innerText.toLowerCase().includes("batal") || b.innerText.toLowerCase().includes("tutup")) {
          b.click();
          break;
        }
      }
    });
    await sleep(1000);

    // Click on 2 menu items to populate cart
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".group.relative.bg-white, .cursor-pointer"));
      if (cards.length > 0) (cards[0] as HTMLElement).click();
      if (cards.length > 1) (cards[1] as HTMLElement).click();
    });
    await sleep(1500);

    console.log("Capturing 03_pos_terminal.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_pos_terminal.png") });

    // Click "Bayar" to open payment modal
    console.log("[18/18] Opening Payment Modal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("bayar")) {
          b.click();
          break;
        }
      }
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "18_pos_payment_modal.png") });

    console.log("=== ALL UNIQUE SCREENSHOTS CAPTURED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Error during capture:", err);
  } finally {
    await browser.close();
  }
}

captureAllUniqueScreens();

