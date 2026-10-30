import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");

async function captureModals() {
  console.log("Capturing critical modal pop-ups via Puppeteer...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,850"],
    defaultViewport: { width: 1280, height: 850 },
  });

  try {
    const page = await browser.newPage();
    const BASE_URL = "https://juliacoffeemanagement.up.railway.app";

    // Navigate to POS
    console.log("Navigating to POS...");
    await page.goto(`${BASE_URL}/pos`, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));

    // 1. Capture Modal Quick Waste
    console.log("1. Triggering Quick Waste Modal...");
    const clickedWaste = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes("kalibrasi") || b.textContent?.toLowerCase().includes("waste")) {
          b.click();
          return true;
        }
      }
      return false;
    });

    if (clickedWaste) {
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "11_modal_quick_waste.png") });
      console.log("Captured 11_modal_quick_waste.png!");

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector("button[aria-label='Close'], button.text-slate-400");
        (closeBtn as HTMLElement)?.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    // 2. Add an item to cart and open Split Bill or Payment Modal
    console.log("2. Adding item to cart...");
    await page.evaluate(() => {
      // Click first product card
      const productCard = document.querySelector(".group.relative.bg-white, .cursor-pointer");
      (productCard as HTMLElement)?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Click on Split Bill button if visible
    console.log("Triggering Split Bill Modal...");
    const clickedSplit = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes("split")) {
          b.click();
          return true;
        }
      }
      return false;
    });

    if (clickedSplit) {
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "10_modal_split_bill.png") });
      console.log("Captured 10_modal_split_bill.png!");

      // Close split modal
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 800));
    }

    // 3. Trigger Shift Close Modal
    console.log("3. Triggering Shift Close Modal...");
    const clickedShift = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes("tutup shift")) {
          b.click();
          return true;
        }
      }
      return false;
    });

    if (clickedShift) {
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "12_modal_tutup_shift.png") });
      console.log("Captured 12_modal_tutup_shift.png!");
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 800));
    }

    // 4. Trigger Supervisor PIN Modal
    console.log("4. Triggering Supervisor PIN Modal...");
    const clickedHistory = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes("riwayat") || b.textContent?.toLowerCase().includes("refund")) {
          b.click();
          return true;
        }
      }
      return false;
    });

    if (clickedHistory) {
      await new Promise((r) => setTimeout(r, 1500));
      // Click Void on first order in history
      await page.evaluate(() => {
        const voidBtn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.toLowerCase().includes("void") || b.textContent?.toLowerCase().includes("batalkan")
        );
        voidBtn?.click();
      });
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "09_modal_pin_supervisor.png") });
      console.log("Captured 09_modal_pin_supervisor.png!");
    }

    console.log("All pop-up modals captured successfully!");
  } catch (err) {
    console.error("Error capturing modals:", err);
  } finally {
    await browser.close();
  }
}

captureModals();

