import React, { useRef } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import { Printer, CheckCircle2, X, Download, Share2 } from "lucide-react";

interface PosReceiptModalProps {
  orderData: any;
  onClose: () => void;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({ orderData, onClose }) => {
  const { settings } = useStore();
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const receiptNo = orderData.receiptNo || "ORD-0000";
  const dateFormatted = new Date(orderData.createdAt || Date.now()).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const payment = orderData.payments?.[0] || orderData.payment || {};
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

        {/* Action Buttons */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Transaksi Baru
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk</span>
          </button>
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
