import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "public", "screenshots");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureStaffAttendance() {
  console.log("=== CAPTURING REAL STAFF ATTENDANCE SCREEN ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });

  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle2" });
  await sleep(2000);

  // Click on "Kasir" or "Leader" (staff that needs attendance)
  console.log("Selecting Staff account...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const staffBtn = btns.find((b) => b.innerText.toLowerCase().includes("kasir") || b.innerText.toLowerCase().includes("leader"));
    if (staffBtn) staffBtn.click();
  });
  await sleep(500);

  // Enter PIN 123456
  for (const digit of ["1", "2", "3", "4", "5", "6"]) {
    await page.evaluate((d) => {
      const btns = Array.from(document.querySelectorAll("button"));
      for (const b of btns) {
        if (b.innerText.trim() === d) {
          b.click();
          break;
        }
      }
    }, digit);
    await sleep(60);
  }
  await sleep(3000);

  // Navigate to #attendance_clock
  console.log("Navigating to #attendance_clock...");
  await page.evaluate(() => {
    window.location.hash = "#attendance_clock";
  });
  await sleep(2500);

  // Trigger camera start button if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const camBtn = btns.find((b) => b.innerText.toLowerCase().includes("kamera") || b.innerText.toLowerCase().includes("buka kamera") || b.querySelector("svg"));
    if (camBtn) camBtn.click();
  });
  await sleep(2000);

  const outPath = path.join(OUTPUT_DIR, "02_clock_in_attendance.png");
  await page.screenshot({ path: outPath });
  console.log("Successfully captured 02_clock_in_attendance.png as Staff!");

  await browser.close();
}

captureStaffAttendance();

