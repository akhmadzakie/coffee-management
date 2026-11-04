import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");
const BASE_URL = "http://localhost:3000";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureAllScreens() {
  console.log("Starting Full Screen Capture Suite at 1440x900...");
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900", "--use-fake-ui-for-media-stream"],
  });

  try {
    const page = await browser.newPage();

    // 1. LOGIN SCREEN
    console.log("1. Capturing 01_login_screen.png...");
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_login_screen.png") });

    // Helper: Login as user
    const loginAs = async (roleName: string) => {
      console.log(`Logging in as [${roleName}]...`);
      await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
      await sleep(1500);

      // Click user button
      await page.evaluate((r) => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.toLowerCase().includes(r.toLowerCase())) {
            b.click();
            return;
          }
        }
      }, roleName);
      await sleep(500);

      // Enter PIN 123456
      for (const d of ["1", "2", "3", "4", "5", "6"]) {
        await page.evaluate((digit) => {
          const btns = Array.from(document.querySelectorAll("button"));
          for (const b of btns) {
            if (b.innerText.trim() === digit) {
              b.click();
              return;
            }
          }
        }, d);
        await sleep(80);
      }
      await sleep(3000);
    };

    // Helper: Click Nav Item
    const clickNav = async (name: string) => {
      console.log(`Navigating to [${name}]...`);
      await page.evaluate((n) => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.trim().toLowerCase().includes(n.toLowerCase())) {
            b.click();
            return;
          }
        }
      }, name);
      await sleep(2000);
    };

    // ─────────────────────────────────────────────────────────────
    // 2. LOGIN AS KASIR (Presensi / Clock In & POS)
    // ─────────────────────────────────────────────────────────────
    await loginAs("kasir");

    // Presensi / Clock In
    console.log("2. Capturing 02_clock_in_attendance.png...");
    await clickNav("Presensi");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_clock_in_attendance.png") });

    // POS Terminal
    console.log("3. Capturing 03_pos_terminal.png...");
    await clickNav("POS");
    await sleep(2500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_pos_terminal.png") });

    // KDS Screen
    console.log("4. Capturing 04_kds_screen.png...");
    await clickNav("KDS");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_kds_screen.png") });

    // ─────────────────────────────────────────────────────────────
    // 3. LOGIN AS SUPER ADMIN (Full System Access)
    // ─────────────────────────────────────────────────────────────
    await loginAs("super admin");

    // Leader Checklist
    console.log("5. Capturing 05_leader_checklist.png...");
    await clickNav("Checklist");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_leader_checklist.png") });

    // Stok Bahan Baku
    console.log("6. Capturing 06_inventory_screen.png...");
    await clickNav("Stok Bahan");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06_inventory_screen.png") });

    // Pembelian (PO)
    console.log("7. Capturing 07_purchases_screen.png...");
    await clickNav("Pembelian");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "07_purchases_screen.png") });

    // HPP Calculator
    console.log("8. Capturing 08_hpp_calculator_screen.png...");
    await clickNav("Kalkulator");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "08_hpp_calculator_screen.png") });

    // Promo & Diskon
    console.log("9. Capturing 09_promotions_screen.png...");
    await clickNav("Promo");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "09_promotions_screen.png") });

    // Buku Kas & Arus Kas
    console.log("10. Capturing 10_cashflow_screen.png...");
    await clickNav("Arus Kas");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "10_cashflow_screen.png") });

    // Laporan Laba Rugi
    console.log("11. Capturing 11_finance_reports_screen.png...");
    await clickNav("Laba Rugi");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "11_finance_reports_screen.png") });

    // Penggajian / Payroll
    console.log("12. Capturing 12_payroll_screen.png...");
    await clickNav("Penggajian");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "12_payroll_screen.png") });

    // Manajemen Pengguna
    console.log("13. Capturing 13_users_pin_screen.png...");
    await clickNav("Manajemen Pengguna");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "13_users_pin_screen.png") });

    // Audit Log Aktivitas
    console.log("14. Capturing 14_audit_log_screen.png...");
    await clickNav("Audit Log");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "14_audit_log_screen.png") });

    // Pengaturan Sistem
    console.log("15. Capturing 15_settings_screen.png...");
    await clickNav("Pengaturan");
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "15_settings_screen.png") });

    // ─────────────────────────────────────────────────────────────
    // 4. LOGIN AS OWNER (Dashboard Eksekutif)
    // ─────────────────────────────────────────────────────────────
    await loginAs("owner");
    console.log("16. Capturing 16_dashboard_owner.png...");
    await sleep(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "16_dashboard_owner.png") });

    console.log("SUCCESS: All screenshots captured!");
  } catch (err) {
    console.error("Error during screen capture:", err);
  } finally {
    await browser.close();
  }
}

captureAllScreens();

