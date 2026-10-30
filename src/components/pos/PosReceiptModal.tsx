import React, { useRef, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import {
  buildEscPosReceipt,
  printViaWebBluetooth,
  printViaWebUsb,
  triggerRawBtPrint,
  buildCashDrawerKickCommand,
} from "../../utils/escpos";
import { buildWhatsAppReceiptUrl } from "../../utils/whatsappReceipt";
import {
  Printer,
  CheckCircle2,
  X,
  Share2,
  Send,
  MessageSquare,
  Sparkles,
  Zap,
  Smartphone,
  ChevronDown,
} from "lucide-react";

interface PosReceiptModalProps {
  orderData: any;
  onClose: () => void;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({ orderData, onClose }) => {
  const { settings } = useStore();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);
  const [printStatus, setPrintStatus] = useState<string>("");

  const payment = orderData.payments?.[0] || orderData.payment || {};
  const isCash = (payment.paymentMethod || orderData.paymentMethod || "CASH") === "CASH";

  // Estimasi Poin Loyalitas (1 poin per Rp 10.000)
  const loyaltyPointsEarned = Math.floor((Number(orderData.totalAmount) || 0) / 10000);

  // Fallback dialog browser standar
  const handleBrowserPrint = () => {
    window.print();
  };

  // Cetak Thermal ESC/POS Instan (Bluetooth / USB / RawBT)
  const handleThermalPrint = async () => {
    setIsPrintingThermal(true);
    setPrintStatus("Menyiapkan data ESC/POS...");
    try {
      const bytes = buildEscPosReceipt(orderData, settings, {
        paperWidth: "80mm",
        kickDrawer: isCash,
      });

      // 1. Coba Web Bluetooth jika didukung
      if (typeof navigator !== "undefined" && (navigator as any).bluetooth) {
        setPrintStatus("Menghubungkan printer Bluetooth...");
        try {
          await printViaWebBluetooth(bytes);
          setPrintStatus("Struk thermal berhasil dicetak via Bluetooth!");
          setTimeout(() => setPrintStatus(""), 3000);
          return;
        } catch (btErr: any) {
          console.warn("Bluetooth dibatalkan / gagal, mencoba metode alternatif:", btErr.message);
        }
      }

      // 2. Coba WebUSB jika didukung
      if (typeof navigator !== "undefined" && (navigator as any).usb) {
        setPrintStatus("Mencoba koneksi printer USB...");
        try {
          await printViaWebUsb(bytes);
          setPrintStatus("Struk berhasil dicetak via USB!");
          setTimeout(() => setPrintStatus(""), 3000);
          return;
        } catch (usbErr: any) {
          console.warn("USB gagal:", usbErr.message);
        }
      }

      // 3. Fallback RawBT / download binary ESC/POS untuk tablet kasir
      triggerRawBtPrint(bytes, `receipt-${orderData.receiptNo || "pos"}.bin`);
      setPrintStatus("Meneruskan ke driver printer / RawBT...");
      setTimeout(() => setPrintStatus(""), 3000);
    } catch (err: any) {
      alert(`Pencetakan ESC/POS: ${err.message}. Membuka dialog cetak browser sebagai cadangan.`);
      handleBrowserPrint();
    } finally {
      setIsPrintingThermal(false);
    }
  };

  // Tendang Laci Kasir Manual (Cash Drawer Kick)
  const handleKickDrawer = async () => {
    try {
      const kickBytes = buildCashDrawerKickCommand();
      if (typeof navigator !== "undefined" && (navigator as any).bluetooth) {
        await printViaWebBluetooth(kickBytes);
      } else {
        triggerRawBtPrint(kickBytes, "drawer-kick.bin");
      }
      alert("Perintah buka laci uang terkirim ke printer!");
    } catch (e: any) {
      alert(`Buka laci: ${e.message}`);
    }
  };

  // Kirim Struk Digital via WhatsApp
  const handleSendWhatsApp = () => {
    let phone = orderData.customerPhone || "";
    if (!phone) {
      const input = prompt("Masukkan nomor WhatsApp pelanggan (misal 08123456789):", "");
      if (!input) return;
      phone = input;
    }
    const url = buildWhatsAppReceiptUrl(phone, orderData, settings, loyaltyPointsEarned);
    window.open(url, "_blank");
  };

  const receiptNo = orderData.receiptNo || orderData.orderNumber || "ORD-0000";
  const dateFormatted = new Date(orderData.createdAt || Date.now()).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const items = orderData.items || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Transaksi Berhasil Dilunasi</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          {/* Paper Struk */}
          <div
            ref={receiptRef}
            id="thermal-receipt"
            className="w-full max-w-[320px] bg-white text-slate-900 font-mono text-[11px] p-5 rounded-lg shadow-xl leading-relaxed border border-slate-200"
          >
            {/* Header Struk */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400">
              <h2 className="text-sm font-black uppercase tracking-wider">
                {settings?.brandName || "Julia's"}
              </h2>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {settings?.companyAddress || "Specialty Room • Coffee • Eatery"}
              </p>
              <p className="text-[10px] text-slate-600">
                {settings?.bankDetails || ""}
              </p>

              {orderData.status === "REFUNDED" && (
                <div className="mt-2 p-2 bg-rose-50 border border-dashed border-rose-300 rounded text-center text-rose-800">
                  <span className="font-black text-xs block tracking-wider">*** BUKTI PENGEMBALIAN DANA (REFUND) ***</span>
                  <span className="text-[9px] block mt-0.5 font-bold">
                    Dana Dikembalikan: {formatCurrency(orderData.refundAmount || orderData.totalAmount)} ({orderData.refundMethod || "CASH"})
                  </span>
                  <span className="text-[9px] block">
                    Disetujui: {orderData.refundApprovedBy || "Manager"}
                  </span>
                  {orderData.refundReason && (
                    <span className="text-[9px] block italic text-rose-600">
                      Alasan: {orderData.refundReason}
                    </span>
                  )}
                </div>
              )}

              {orderData.status === "VOID" && (
                <div className="mt-2 p-2 bg-rose-50 border border-dashed border-rose-300 rounded text-center text-rose-800">
                  <span className="font-black text-xs block tracking-wider">*** TRANSAKSI DI-VOID (BATAL) ***</span>
                  {orderData.voidReason && (
                    <span className="text-[9px] block italic text-rose-600">
                      Alasan: {orderData.voidReason}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Meta Order */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>No. Struk:</span>
                <span className="font-bold">{receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{dateFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{orderData.cashierName || "Kasir"}</span>
              </div>
              <div className="flex justify-between">
                <span>Tipe / Meja:</span>
                <span className="font-bold">
                  {orderData.orderType === "DINE_IN" ? "Dine In" : "Take Away"}{" "}
                  {orderData.tableNumber ? `(${orderData.tableNumber})` : ""}
                </span>
              </div>
              {orderData.customerName && (
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span>{orderData.customerName}</span>
                </div>
              )}
            </div>

            {/* Item List */}
            <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5">
              {items.map((item: any, idx: number) => (
                <div key={idx}>
                  <div className="flex justify-between font-bold">
                    <span className="flex-1 pr-2">
                      {item.menuName} {item.variantName ? `(${item.variantName})` : ""}
                    </span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-[9px] text-slate-500 italic">
                      * {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Summary & Totals */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(orderData.subtotal)}</span>
              </div>

              {orderData.discountAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>
                    Diskon{" "}
                    {orderData.appliedPromotionName
                      ? `(${orderData.appliedPromotionName})`
                      : orderData.discountReason
                      ? `(${orderData.discountReason})`
                      : ""}
                    :
                  </span>
                  <span>-{formatCurrency(orderData.discountAmount)}</span>
                </div>
              )}

              {orderData.taxAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>PB1 ({orderData.taxPercent}%):</span>
                  <span>{formatCurrency(orderData.taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>{formatCurrency(orderData.totalAmount)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="font-bold">{payment.paymentMethod || "CASH"}</span>
              </div>

              {payment.paymentMethod === "CASH" && (
                <>
                  <div className="flex justify-between">
                    <span>Tunai Diterima:</span>
                    <span>{formatCurrency(payment.cashReceived || orderData.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Kembalian:</span>
                    <span>{formatCurrency(payment.changeAmount || 0)}</span>
                  </div>
                </>
              )}

              {payment.referenceNo && (
                <div className="flex justify-between">
                  <span>No. Referensi:</span>
                  <span>{payment.referenceNo}</span>
                </div>
              )}
            </div>

            {/* Footer Struk */}
            <div className="text-center pt-3 text-[10px] text-slate-600">
              <p>{settings?.footerMessage || "Terima kasih atas kunjungannya!"}</p>
              <p className="mt-0.5 text-[8px] text-slate-400">Julia's POS System • Specialty Room • Coffee • Eatery</p>
            </div>
          </div>
        </div>

        {/* Print Status Feedback */}
        {printStatus && (
          <div className="px-6 py-2 bg-emerald-50 border-t border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between no-print animate-fade-in">
            <span>{printStatus}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 space-y-2.5 no-print">
          <div className="flex items-center gap-2">
            {/* 1. Tombol Utama: Cetak Thermal ESC/POS Instan */}
            <button
              type="button"
              onClick={handleThermalPrint}
              disabled={isPrintingThermal}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-brand-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title="Cetak langsung ke printer thermal Bluetooth / USB tanpa dialog print browser"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>{isPrintingThermal ? "Mencetak..." : "Cetak Thermal ESC/POS"}</span>
            </button>

            {/* 2. Tombol Kirim WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title="Kirim struk digital nota pesanan ke nomor WhatsApp pelanggan"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Kirim WA</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 3. Buka Laci Kasir (Khusus Cash / Drawer) */}
            {isCash && (
              <button
                type="button"
                onClick={handleKickDrawer}
                className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Buka laci kasir manual via perintah ESC p"
              >
                <span>Buka Laci</span>
              </button>
            )}

            {/* 4. Cetak Cadangan Browser */}
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Gunakan dialog cetak browser biasa"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Browser Print</span>
            </button>

            {/* 5. Transaksi Baru / Tutup */}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer text-center"
            >
              Transaksi Baru →
            </button>
          </div>
        </div>
      </div>

      {/* Print Styles for Thermal Paper */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt, #thermal-receipt * {
            visibility: visible;
          }
          #thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
