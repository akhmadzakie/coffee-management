import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");
const BASE_URL = "http://localhost:3000";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capturePosModals() {
  console.log("=== CAPTURING SPECIFIC POS MODALS & TERMINAL ===");
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
    // 1. GOTO /pos & LOGIN AS CASHIER
    // ─────────────────────────────────────────────────────────────
    console.log("1. Navigating to /pos...");
    await page.goto(`${BASE_URL}/pos`, { waitUntil: "networkidle2" });
    await sleep(2000);

    // Select cashier
    console.log("Selecting cashier...");
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

    // Enter PIN 123456
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
    await sleep(3000);

    // ─────────────────────────────────────────────────────────────
    // 2. CAPTURE BUKA SHIFT MODAL
    // ─────────────────────────────────────────────────────────────
    console.log("2. Capturing pos_buka_shift_modal.png...");
    // Check if shift modal is open (if not, click buka shift button)
    const isShiftOpen = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("h2, h3, div")).some(
        (el) => el.textContent?.toLowerCase().includes("buka shift kasir") || el.textContent?.toLowerCase().includes("modal awal")
      );
    });
    console.log("Is Buka Shift modal already visible?", isShiftOpen);

    if (!isShiftOpen) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        for (const b of btns) {
          if (b.innerText.toLowerCase().includes("buka shift") || b.innerText.toLowerCase().includes("shift")) {
            b.click();
            break;
          }
        }
      });
      await sleep(1500);
    }

    await page.screenshot({ path: path.join(OUTPUT_DIR, "pos_buka_shift_modal.png") });

    // Fill in Starting Cash Rp 300.000 & click Buka Shift
    console.log("Opening shift with Rp 300.000...");
    await page.evaluate(() => {
      const input = document.querySelector("input[type='number'], input[placeholder*='0'], input") as HTMLInputElement;
      if (input) {
        input.value = "300000";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const submitBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.innerText.toLowerCase().includes("buka shift")
      );
      if (submitBtn) submitBtn.click();
    });
    await sleep(2500);

    // ─────────────────────────────────────────────────────────────
    // 3. CAPTURE ACTIVE POS TERMINAL
    // ─────────────────────────────────────────────────────────────
    console.log("3. Populating cart with items...");
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".group.relative.bg-white, .cursor-pointer"));
      if (cards.length > 0) (cards[0] as HTMLElement).click();
      if (cards.length > 1) (cards[1] as HTMLElement).click();
    });
    await sleep(1500);

    console.log("Capturing 03_pos_terminal.png (Active Catalog & Cart)...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03_pos_terminal.png") });

    // ─────────────────────────────────────────────────────────────
    // 4. CAPTURE PAYMENT MODAL
    // ─────────────────────────────────────────────────────────────
    console.log("4. Opening Payment Modal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("bayar")) {
          b.click();
          break;
        }
      }
    });
    await sleep(2000);
    console.log("Capturing 18_pos_payment_modal.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "18_pos_payment_modal.png") });

    // Close Payment Modal
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

    // ─────────────────────────────────────────────────────────────
    // 5. CAPTURE MANAGER PIN MODAL
    // ─────────────────────────────────────────────────────────────
    console.log("5. Triggering Manager PIN Modal (Diskon / Void)...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("diskon") || b.innerText.toLowerCase().includes("voucher")) {
          b.click();
          break;
        }
      }
    });
    await sleep(1000);

    // Click custom discount to trigger PIN
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("khusus") || b.innerText.toLowerCase().includes("manual") || b.innerText.toLowerCase().includes("pin")) {
          b.click();
          break;
        }
      }
    });
    await sleep(1500);
    console.log("Capturing pos_manager_pin_modal.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "pos_manager_pin_modal.png") });

    // Press Escape or close PIN modal
    await page.keyboard.press("Escape");
    await sleep(1000);

    // ─────────────────────────────────────────────────────────────
    // 6. CAPTURE TUTUP SHIFT MODAL
    // ─────────────────────────────────────────────────────────────
    console.log("6. Opening Tutup Shift Modal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes("tutup shift") || (b.title && b.title.toLowerCase().includes("tutup shift")) || b.innerText.toLowerCase().includes("ringkasan shift")) {
          b.click();
          break;
        }
      }
    });
    await sleep(2000);
    console.log("Capturing pos_tutup_shift_modal.png...");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "pos_tutup_shift_modal.png") });

    console.log("=== FINISHED CAPTURING ALL POS MODALS! ===");
  } catch (err) {
    console.error("Error capturing POS modals:", err);
  } finally {
    await browser.close();
  }
}

capturePosModals();

