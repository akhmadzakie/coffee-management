import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");

async function capture() {
  console.log("Launching Chrome against Railway production...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,850"],
    defaultViewport: { width: 1280, height: 850 },
  });

  try {
    const page = await browser.newPage();
    const BASE_URL = "https://juliacoffeemanagement.up.railway.app";

    // 1. Screenshot Login Screen
    console.log("1. Capturing Login Screen...");
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 45000 });
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01_login_screen.png") });

    // Login as Admin
    console.log("Selecting admin account...");
    const clickedAdmin = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes("admin")) {
          b.click();
          return true;
        }
      }
      return false;
    });

    await new Promise((r) => setTimeout(r, 800));

    // Input PIN 123456
    console.log("Entering PIN...");
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.evaluate((d) => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.textContent?.trim() === d) {
            b.click();
            break;
          }
        }
      }, digit);
      await new Promise((r) => setTimeout(r, 120));
    }

    console.log("Waiting for dashboard to load...");
    await new Promise((r) => setTimeout(r, 4500));

    // 2. Screenshot Dashboard Owner/Manager
    console.log("2. Capturing Dashboard Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02_dashboard.png") });

    // Function to click an accordion group then click the item
    const openGroupAndClickItem = async (groupName: string, itemName: string) => {
      console.log(`Navigating to [${groupName}] -> [${itemName}]...`);
      await page.evaluate((g, itm) => {
        const btns = Array.from(document.querySelectorAll("button"));
        // First click group header to expand
        for (const b of btns) {
          if (b.textContent?.toLowerCase().includes(g.toLowerCase())) {
            b.click();
            break;
          }
        }
      }, groupName, itemName);

      await new Promise((r) => setTimeout(r, 800));

      await page.evaluate((itm) => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.textContent?.toLowerCase().includes(itm.toLowerCase())) {
            b.click();
            break;
          }
        }
      }, itemName);

      await new Promise((r) => setTimeout(r, 2500));
    };

    // 3. Leader Checklist
    await openGroupAndClickItem("SDM & Tim", "Checklist Supervisi");
    console.log("3. Capturing Leader Checklist Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_leader_checklist.png") });

    // 4. Inventori & Resep HPP
    await openGroupAndClickItem("Stok & Pengadaan", "Stok Bahan Baku");
    console.log("4. Capturing Inventory Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05_inventory_screen.png") });

    // 5. Buku Kas & Arus Kas (Finance)
    await openGroupAndClickItem("Keuangan & Kas", "Buku Kas & Arus Kas");
    console.log("5. Capturing Cash Flow Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06_cashflow_screen.png") });

    // 6. Payroll (Penggajian)
    await openGroupAndClickItem("SDM & Tim", "Penggajian");
    console.log("6. Capturing Payroll Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "07_payroll_screen.png") });

    // 7. Users Management & Reset PIN (Admin & Manager)
    await openGroupAndClickItem("Sistem & Admin", "Manajemen Pengguna");
    console.log("7. Capturing Users / PIN Management Screen...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "08_users_pin_screen.png") });

    // 8. POS Terminal
    console.log("8. Capturing POS Terminal Screen...");
    await page.goto(`${BASE_URL}/pos`, { waitUntil: "networkidle2", timeout: 35000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_pos_terminal.png") });

    // 9. KDS Screen
    console.log("9. Capturing KDS Screen...");
    await page.goto(`${BASE_URL}/kds`, { waitUntil: "networkidle2", timeout: 35000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04_kds_screen.png") });

    console.log("ALL MODULE SCREENSHOTS CAPTURED SUCCESSFULY!");
  } catch (err) {
    console.error("Capture error:", err);
  } finally {
    await browser.close();
  }
}

capture();
