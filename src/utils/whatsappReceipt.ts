/**
 * WhatsApp Digital Receipt Generator & CRM Loyalty
 * Julia's Coffee Management & POS System
 */

import { formatCurrency } from "./format";

export function formatWhatsAppPhoneNumber(rawPhone: string): string {
  let cleaned = String(rawPhone || "").replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

export function buildWhatsAppReceiptText(
  order: any,
  settings: any,
  loyaltyEarned: number = 0
): string {
  const brand = settings?.brandName || settings?.storeName || settings?.companyName || "Julia's Coffee";
  const address = settings?.companyAddress || settings?.storeAddress || "Specialty Room • Coffee • Eatery";
  const receiptNo = order.receiptNo || order.orderNumber || "ORD-0000";
  const dateFormatted = new Date(order.createdAt || Date.now()).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const payment = order.payments?.[0] || order.payment || {};
  const items = order.items || [];

  let text = `☕ *${brand.toUpperCase()}*\n`;
  text += `📍 _${address}_\n`;
  text += `--------------------------------\n`;
  text += `🧾 *No. Struk:* ${receiptNo}\n`;
  text += `📅 *Waktu:* ${dateFormatted}\n`;
  text += `👤 *Kasir:* ${order.cashierName || "Kasir"}\n`;
  text += `🏷️ *Tipe:* ${order.orderType === "DINE_IN" ? "Dine In" : "Take Away"}${
    order.tableNumber ? ` (Meja ${order.tableNumber})` : ""
  }\n`;

  if (order.customerName) {
    text += `🧑 *Pelanggan:* ${order.customerName}\n`;
  }
  text += `--------------------------------\n\n`;

  text += `*DETAIL PESANAN:*\n`;
  for (const it of items) {
    const itemName = it.menuName || it.name || "Menu";
    const variantStr = it.variantName ? ` (${it.variantName})` : "";
    const lineTotal = formatCurrency(it.subtotal || (it.quantity || 1) * (it.unitPrice || 0));
    text += `▪️ *${itemName}${variantStr}*\n`;
    text += `   ${it.quantity || 1}x @ ${formatCurrency(it.unitPrice || 0)} = ${lineTotal}\n`;
    if (it.notes) {
      text += `   _(Catatan: ${it.notes})_\n`;
    }
  }

  text += `\n--------------------------------\n`;
  text += `Subtotal: ${formatCurrency(order.subtotal || 0)}\n`;

  if (Number(order.discountAmount) > 0) {
    text += `Diskon: -${formatCurrency(order.discountAmount)}\n`;
  }

  if (Number(order.taxAmount) > 0) {
    text += `Pajak PB1 (${order.taxPercent || 10}%): ${formatCurrency(order.taxAmount)}\n`;
  }

  text += `*TOTAL BAYAR: ${formatCurrency(order.totalAmount || 0)}*\n`;
  text += `Metode: ${payment.paymentMethod || order.paymentMethod || "CASH"}\n`;

  if ((payment.paymentMethod || order.paymentMethod) === "CASH") {
    text += `Tunai: ${formatCurrency(payment.cashReceived || order.cashReceived || order.totalAmount)}\n`;
    text += `Kembalian: ${formatCurrency(payment.changeAmount || order.changeAmount || 0)}\n`;
  }
  text += `--------------------------------\n`;

  if (loyaltyEarned > 0) {
    text += `⭐ *POIN LOYALITAS:* +${loyaltyEarned} Poin!\n`;
    text += `Kumpulkan poin untuk diskon & reward menarik berikutnya.\n`;
    text += `--------------------------------\n`;
  }

  text += `✨ _${settings?.footerMessage || "Terima kasih atas kunjungan Anda di Julia's!"}_\n`;
  text += `🌐 _Specialty Room • Coffee • Eatery_\n`;

  return text;
}

export function buildWhatsAppReceiptUrl(
  rawPhone: string,
  order: any,
  settings: any,
  loyaltyEarned: number = 0
): string {
  const formattedPhone = formatWhatsAppPhoneNumber(rawPhone);
  const text = buildWhatsAppReceiptText(order, settings, loyaltyEarned);
  const encoded = encodeURIComponent(text);
  if (formattedPhone) {
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

