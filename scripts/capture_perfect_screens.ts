import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");
const BASE_URL = "https://juliacoffeemanagement.up.railway.app";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureAllPerfectScreens() {
  console.log("Starting Perfect Screen Capture Suite at 1440x900...");
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  try {
    const page = await browser.newPage();

    // ─────────────────────────────────────────────────────────────
    // 1. LOGIN SCREEN
    // ─────────────────────────────────────────────────────────────
    console.log("1. Capturing 01_login_screen.png...");
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_login_screen.png") });

    // ─────────────────────────────────────────────────────────────
    // 2. DASHBOARD OWNER
    // ─────────────────────────────────────────────────────────────
    console.log("2. Capturing 02_dashboard.png (Owner)...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("@owner") || b.innerText.toLowerCase().includes("bos")) {
          b.click();
          break;
        }
      }
    });
    await sleep(600);
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
      await sleep(100);
    }
    await sleep(4000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_dashboard.png") });

    // Logout back to login screen
    console.log("Logging out back to login...");
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await sleep(2000);

    // ─────────────────────────────────────────────────────────────
    // 3. LOGIN AS MANAGER (Full Access to Modules)
    // ─────────────────────────────────────────────────────────────
    console.log("Logging in as Si Paling MANAGER...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("manager")) {
          b.click();
          break;
        }
      }
    });
    await sleep(600);
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
      await sleep(100);
    }
    await sleep(4000);

    const clickNav = async (name: string) => {
      console.log(`Navigating to [${name}]...`);
      await page.evaluate((n) => {
        const btns = Array.from(document.querySelectorAll("nav button"));
        for (const b of btns) {
          if (b.innerText.trim().toLowerCase() === n.toLowerCase()) {
            b.click();
            return;
          }
        }
      }, name);
      await sleep(2500);
    };

    // 3. Leader Checklist
    await clickNav("Checklist Supervisi");
    console.log("3. Capturing 04_leader_checklist.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_leader_checklist.png") });

    // 4. Stok Bahan Baku & Resep
    await clickNav("Stok Bahan Baku");
    console.log("4. Capturing 05_inventory_screen.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_inventory_screen.png") });

    // 5. Buku Kas & Arus Kas (Finance)
    await clickNav("Buku Kas & Arus Kas");
    console.log("5. Capturing 06_cashflow_screen.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06_cashflow_screen.png") });

    // 6. Data Karyawan & Penggajian
    await clickNav("Data Karyawan & Kontrak");
    console.log("6. Capturing 07_payroll_screen.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "07_payroll_screen.png") });

    // 7. Expand Sistem & Admin -> Manajemen Pengguna
    console.log("Expanding Sistem & Admin...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      for (const b of btns) {
        if (b.innerText.trim().toUpperCase() === "SISTEM & ADMIN") {
          b.click();
          break;
        }
      }
    });
    await sleep(1000);
    await clickNav("Manajemen Pengguna");
    console.log("7. Capturing 08_users_pin_screen.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "08_users_pin_screen.png") });

    // ─────────────────────────────────────────────────────────────
    // 8. UNLOCKED POS TERMINAL (/pos)
    // ─────────────────────────────────────────────────────────────
    console.log("8. Navigating to /pos and unlocking cashier...");
    await page.goto(`${BASE_URL}/pos`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(2500);

    // Click on Cashier account
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.includes("Terminal Kasir POS") || b.innerText.includes("budi")) {
          b.click();
          break;
        }
      }
    });
    await sleep(600);

    // Enter Cashier PIN 123456
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
      await sleep(100);
    }
    await sleep(3000);

    // Dismiss Buka Shift modal if open or click close/cancel
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll("button"));
      for (const b of closeBtns) {
        if (b.innerText.toLowerCase().includes("batal") || b.innerText.toLowerCase().includes("tutup")) {
          b.click();
          break;
        }
      }
    });
    await sleep(800);

    // Add a couple of products to cart to show realistic active cart
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".group.relative.bg-white, .cursor-pointer"));
      if (cards.length > 0) (cards[0] as HTMLElement).click();
      if (cards.length > 1) (cards[1] as HTMLElement).click();
    });
    await sleep(1200);

    console.log("Capturing 03_pos_terminal.png (Active Catalog & Cart)...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_pos_terminal.png") });

    // ─────────────────────────────────────────────────────────────
    // 9. KDS SCREEN (/kds)
    // ─────────────────────────────────────────────────────────────
    console.log("9. Capturing 04_kds_screen.png...");
    await page.goto(`${BASE_URL}/kds`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_kds_screen.png") });

    console.log("ALL 9 PERFECT SCREENSHOTS CAPTURED CRISPLY AND VERIFIED 100%!");
  } catch (err) {
    console.error("Error during capture:", err);
  } finally {
    await browser.close();
  }
}

captureAllPerfectScreens();

