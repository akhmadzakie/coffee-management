/**
 * ESC/POS Thermal Receipt Generator & Hardware Driver
 * Julia's Coffee Management & POS System
 *
 * Mendukung pencetakan struk instan tanpa dialog browser ke printer Bluetooth/USB/RawBT
 * serta penendang laci kasir (Cash Drawer Kick via ESC p).
 */

export interface EscPosOptions {
  paperWidth?: "58mm" | "80mm";
  kickDrawer?: boolean;
}

// Byte Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export const ESCPOS_COMMANDS = {
  INIT: [ESC, 0x40], // ESC @
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  FEED_3_LINES: [ESC, 0x64, 0x03],
  CUT_FULL: [GS, 0x56, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x01],
  FEED_AND_CUT: [GS, 0x56, 0x41, 0x03], // Feed 3 lines & Partial Cut
  KICK_DRAWER_PIN2: [ESC, 0x70, 0x00, 0x19, 0xfa], // ESC p 0 25 250 (Pin 2 RJ11)
  KICK_DRAWER_PIN5: [ESC, 0x70, 0x01, 0x19, 0xfa], // ESC p 1 25 250 (Pin 5 RJ11)
};

/**
 * Helper untuk format mata uang Rupiah integer
 */
const formatIdr = (num: number): string => {
  return "Rp " + Math.round(num || 0).toLocaleString("id-ID");
};

/**
 * Format teks dua kolom kiri & kanan rata tepi sesuai lebar kertas
 */
export function justifyColumns(left: string, right: string, width: number): string {
  const l = String(left || "");
  const r = String(right || "");
  const totalLen = l.length + r.length;
  if (totalLen >= width) {
    const maxLeft = Math.max(1, width - r.length - 1);
    return l.slice(0, maxLeft) + " " + r;
  }
  const spaces = " ".repeat(width - totalLen);
  return l + spaces + r;
}

/**
 * Generator byte buffer ESC/POS terstruktur dari snapshot pesanan kasir
 */
export function buildEscPosReceipt(
  order: any,
  settings: any,
  options: EscPosOptions = {}
): Uint8Array {
  const width = options.paperWidth === "80mm" ? 48 : 32;
  const bytes: number[] = [];

  const pushBytes = (...cmd: number[][]) => {
    for (const c of cmd) {
      for (const b of c) bytes.push(b);
    }
  };

  const pushText = (text: string) => {
    // Normalisasi teks ke ASCII / Windows-1252
    const clean = String(text || "")
      .replace(/[^\x20-\x7E\n]/g, "")
      .replace(/\r/g, "");
    for (let i = 0; i < clean.length; i++) {
      bytes.push(clean.charCodeAt(i));
    }
  };

  const pushLine = (text: string = "") => {
    pushText(text + "\n");
  };

  const pushDivider = (char: string = "-") => {
    pushLine(char.repeat(width));
  };

  // 1. Inisialisasi printer
  pushBytes(ESCPOS_COMMANDS.INIT);

  // 2. Buka laci kasir jika diminta (misal transaksi tunai)
  if (options.kickDrawer || (options as any).kickCashDrawer) {
    pushBytes(ESCPOS_COMMANDS.KICK_DRAWER_PIN2);
    pushBytes(ESCPOS_COMMANDS.KICK_DRAWER_PIN5);
  }

  // 3. Header Outlet (Center, Bold, Double Size)
  pushBytes(ESCPOS_COMMANDS.ALIGN_CENTER);
  pushBytes(ESCPOS_COMMANDS.BOLD_ON);
  pushBytes(ESCPOS_COMMANDS.DOUBLE_HEIGHT);
  pushLine(settings?.brandName || settings?.storeName || settings?.companyName || "JULIA'S COFFEE");
  pushBytes(ESCPOS_COMMANDS.NORMAL_SIZE);
  pushBytes(ESCPOS_COMMANDS.BOLD_OFF);

  pushLine(settings?.companyAddress || settings?.storeAddress || "Specialty Room * Coffee * Eatery");
  if (settings?.phone) pushLine(`Telp: ${settings.phone}`);
  if (settings?.bankDetails) pushLine(settings.bankDetails);

  // Status khusus (REFUND / VOID)
  if (order?.status === "REFUNDED") {
    pushDivider("=");
    pushBytes(ESCPOS_COMMANDS.BOLD_ON);
    pushLine("*** NOTA REFUND / RETUR ***");
    pushBytes(ESCPOS_COMMANDS.BOLD_OFF);
    pushLine(`Dana: ${formatIdr(order.refundAmount || order.totalAmount)}`);
    if (order.refundReason) pushLine(`Alasan: ${order.refundReason}`);
    pushDivider("=");
  } else if (order?.status === "VOID") {
    pushDivider("=");
    pushBytes(ESCPOS_COMMANDS.BOLD_ON);
    pushLine("*** TRANSAKSI DIBATALKAN (VOID) ***");
    pushBytes(ESCPOS_COMMANDS.BOLD_OFF);
    if (order.voidReason) pushLine(`Alasan: ${order.voidReason}`);
    pushDivider("=");
  } else {
    pushDivider("-");
  }

  // 4. Meta Informasi Order (Align Left)
  pushBytes(ESCPOS_COMMANDS.ALIGN_LEFT);
  const receiptNo = order?.receiptNo || order?.orderNumber || "ORD-0000";
  const dateStr = new Date(order?.createdAt || Date.now()).toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
  pushLine(justifyColumns("No. Struk:", receiptNo, width));
  pushLine(justifyColumns("Waktu:", dateStr, width));
  pushLine(justifyColumns("Kasir:", String(order?.cashierName || "Kasir"), width));

  const orderTypeStr = order?.orderType === "DINE_IN" ? "Dine In" : "Take Away";
  const tableStr = order?.tableNumber ? ` (Meja ${order.tableNumber})` : "";
  pushLine(justifyColumns("Tipe:", `${orderTypeStr}${tableStr}`, width));

  if (order?.customerName) {
    pushLine(justifyColumns("Pelanggan:", String(order.customerName), width));
  }
  pushDivider("-");

  // 5. Daftar Item Menu
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const it of items) {
    const itemName = it.menuName || it.name || "Menu";
    const variantStr = it.variantName ? ` (${it.variantName})` : "";
    const fullName = `${itemName}${variantStr}`;
    const subtotalStr = formatIdr(it.subtotal || (it.quantity || 1) * (it.unitPrice || 0));

    pushBytes(ESCPOS_COMMANDS.BOLD_ON);
    pushLine(justifyColumns(fullName, subtotalStr, width));
    pushBytes(ESCPOS_COMMANDS.BOLD_OFF);

    const qtyPrice = `  ${it.quantity || 1} x ${formatIdr(it.unitPrice || 0)}`;
    pushLine(qtyPrice);

    if (it.notes) {
      pushLine(`  * ${it.notes}`);
    }
  }
  pushDivider("-");

  // 6. Ringkasan Total
  const subtotal = Number(order?.subtotal) || 0;
  const discount = Number(order?.discountAmount) || 0;
  const tax = Number(order?.taxAmount) || 0;
  const total = Number(order?.totalAmount) || 0;

  pushLine(justifyColumns("Subtotal:", formatIdr(subtotal), width));

  if (discount > 0) {
    const discLabel = order?.appliedPromotionName
      ? `Diskon (${order.appliedPromotionName}):`
      : order?.discountReason
      ? `Diskon (${order.discountReason}):`
      : "Diskon:";
    pushLine(justifyColumns(discLabel, `-${formatIdr(discount)}`, width));
  }

  if (tax > 0) {
    pushLine(justifyColumns(`Pajak PB1 (${order?.taxPercent || 10}%):`, formatIdr(tax), width));
  }

  pushDivider("=");
  pushBytes(ESCPOS_COMMANDS.BOLD_ON);
  pushBytes(ESCPOS_COMMANDS.DOUBLE_HEIGHT);
  pushLine(justifyColumns("TOTAL:", formatIdr(total), width));
  pushBytes(ESCPOS_COMMANDS.NORMAL_SIZE);
  pushBytes(ESCPOS_COMMANDS.BOLD_OFF);
  pushDivider("=");

  // 7. Info Pembayaran
  const payment = order?.payments?.[0] || order?.payment || {};
  const method = String(payment?.paymentMethod || order?.paymentMethod || "CASH").toUpperCase();
  pushLine(justifyColumns("Metode Bayar:", method, width));

  if (method === "CASH") {
    const cashRec = Number(payment?.cashReceived || order?.cashReceived || order?.paidAmount || total);
    const change = Number(payment?.changeAmount || order?.changeAmount || 0);
    pushLine(justifyColumns("Tunai Diterima:", formatIdr(cashRec), width));
    pushBytes(ESCPOS_COMMANDS.BOLD_ON);
    pushLine(justifyColumns("Kembalian:", formatIdr(change), width));
    pushBytes(ESCPOS_COMMANDS.BOLD_OFF);
  }

  if (payment?.referenceNo) {
    pushLine(justifyColumns("No. Ref:", String(payment.referenceNo), width));
  }

  // 8. Footer Nota & Cut
  pushDivider("-");
  pushBytes(ESCPOS_COMMANDS.ALIGN_CENTER);
  pushLine(settings?.footerMessage || "Terima kasih atas kunjungan Anda!");
  pushLine("WiFi Password: " + (settings?.wifiPassword || "-"));
  pushLine("Julia's Specialty Room * Coffee * Eatery");
  pushLine("");
  pushLine("");
  pushBytes(ESCPOS_COMMANDS.FEED_AND_CUT);

  return new Uint8Array(bytes);
}

/**
 * Driver Web Bluetooth (Chromium/Android/Chrome/Edge)
 */
export async function printViaWebBluetooth(data: Uint8Array): Promise<boolean> {
  if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
    throw new Error("Web Bluetooth tidak didukung pada browser ini. Gunakan Chrome di Android/Desktop.");
  }
  const device = await (navigator as any).bluetooth.requestDevice({
    filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
    optionalServices: [
      "000018f0-0000-1000-8000-00805f9b34fb",
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
      "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    ],
  });

  const server = await device.gatt.connect();
  let service: any;
  try {
    service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
  } catch {
    const services = await server.getPrimaryServices();
    if (services.length > 0) service = services[0];
  }

  if (!service) throw new Error("Layanan Bluetooth thermal printer tidak ditemukan");

  const characteristics = await service.getCharacteristics();
  const writeChar = characteristics.find(
    (c: any) => c.properties.write || c.properties.writeWithoutResponse
  );
  if (!writeChar) throw new Error("Karakteristik cetak Bluetooth tidak dapat ditulis");

  // Kirim dalam chunk 512 bytes untuk menjaga stabilitas buffer Bluetooth
  const chunkSize = 512;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (writeChar.writeValueWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
  }

  device.gatt.disconnect();
  return true;
}

/**
 * Driver WebUSB untuk printer kabel POS
 */
export async function printViaWebUsb(data: Uint8Array): Promise<boolean> {
  if (typeof navigator === "undefined" || !(navigator as any).usb) {
    throw new Error("WebUSB tidak didukung pada browser ini.");
  }
  const device = await (navigator as any).usb.requestDevice({ filters: [] });
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  await device.claimInterface(0);

  // Cari out-endpoint
  const endpoint = device.configuration.interfaces[0].alternate.endpoints.find(
    (e: any) => e.direction === "out"
  );
  const endpointNumber = endpoint ? endpoint.endpointNumber : 1;

  await device.transferOut(endpointNumber, data);
  await device.close();
  return true;
}

/**
 * Driver RawBT / Intent download untuk tablet kasir Android
 */
export function triggerRawBtPrint(data: Uint8Array, filename: string = "receipt.bin"): void {
  // 1. Coba panggil RawBT Android scheme
  const b64 = btoa(String.fromCharCode(...data));
  const rawBtUrl = `rawbt:data:application/octet-stream;base64,${b64}`;

  // Menggunakan iframe/anchor
  const link = document.createElement("a");
  link.href = rawBtUrl;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 1000);
}

/**
 * Eksekusi Cash Drawer Kick instan (Buka Laci Uang Manual)
 */
export function buildCashDrawerKickCommand(): Uint8Array {
  return new Uint8Array([
    ESC, 0x40,
    ...ESCPOS_COMMANDS.KICK_DRAWER_PIN2,
    ...ESCPOS_COMMANDS.KICK_DRAWER_PIN5,
  ]);
}

