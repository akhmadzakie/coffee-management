import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function capture() {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,850"],
    defaultViewport: { width: 1280, height: 850 },
  });

  try {
    const page = await browser.newPage();
    console.log("Navigating to app...");
    await page.goto("https://juliacoffeemanagement.up.railway.app", { waitUntil: "networkidle2", timeout: 45000 });

    // 1. Screenshot Login Page
    console.log("1. Screenshot Login Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_login_screen.png") });

    // Click on Admin button (or any user button)
    console.log("Logging in as admin...");
    const userButtons = await page.$$("button");
    for (const b of userButtons) {
      const txt = await b.evaluate((el: any) => el.textContent || "");
      if (txt.includes("Admin") || txt.includes("Super Admin")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // Press keypad 1, 2, 3, 4, 5, 6
    const pins = ["1", "2", "3", "4", "5", "6"];
    for (const p of pins) {
      const allButtons = await page.$$("button");
      for (const btn of allButtons) {
        const txt = await btn.evaluate((el: any) => el.textContent?.trim());
        if (txt === p) {
          await btn.click();
          await new Promise((r) => setTimeout(r, 150));
          break;
        }
      }
    }

    console.log("Waiting for navigation / dashboard load...");
    await new Promise((r) => setTimeout(r, 3500));

    // 2. Screenshot Dashboard (Owner / Manager view)
    console.log("2. Screenshot Dashboard...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_dashboard.png") });

    // 3. Navigate to POS
    console.log("3. Navigating to POS...");
    await page.goto("https://juliacoffeemanagement.up.railway.app/pos", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_pos_terminal.png") });

    // 4. Navigate to KDS
    console.log("4. Navigating to KDS...");
    await page.goto("https://juliacoffeemanagement.up.railway.app/kds", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_kds_screen.png") });

    // 5. Navigate to Inventory
    console.log("5. Navigating to Inventory...");
    await page.goto("https://juliacoffeemanagement.up.railway.app/inventory", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_inventory_screen.png") });

    // 6. Navigate to Shift / Kas
    console.log("6. Navigating to Shift Management...");
    await page.goto("https://juliacoffeemanagement.up.railway.app/shifts", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06_shifts_screen.png") });

    // 7. Navigate to Payroll
    console.log("7. Navigating to Payroll...");
    await page.goto("https://juliacoffeemanagement.up.railway.app/payroll", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "07_payroll_screen.png") });

    // 8. Navigate to Settings
    console.log("8. Navigating to Settings...");
    await page.goto("https://juliacoffeemanagement.up.railway.app/settings", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "08_settings_screen.png") });

    console.log("All screenshots captured successfully!");
  } catch (err) {
    console.error("Error during capture:", err);
  } finally {
    await browser.close();
  }
}

capture();
