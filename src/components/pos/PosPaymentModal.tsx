import React, { useState, useMemo } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import { OrderType, PaymentMethod, PrintDestination, OrderModifier } from "../../types";
import {
  Banknote,
  QrCode,
  CreditCard,
  CheckCircle2,
  X,
  AlertCircle,
  RotateCcw,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface CartItem {
  cartId: string;
  recipeId?: string;
  menuName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  modifiers: OrderModifier[];
  notes?: string;
  printDestination: PrintDestination;
}

interface PosPaymentModalProps {
  totalAmount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxPercent: number;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  tableNumber: string;
  customerName: string;
  orderType: OrderType;
  cart: CartItem[];
  orderNotes?: string;
  discountReason?: string;
  discountPercent?: number;
  editingOrderId?: string | null;
  onClose: () => void;
  onSuccess: (orderData: any) => void;
}

export const PosPaymentModal: React.FC<PosPaymentModalProps> = ({
  totalAmount,
  subtotal,
  discountAmount,
  taxAmount,
  taxPercent,
  taxMode,
  tableNumber,
  customerName,
  orderType,
  cart,
  orderNotes,
  discountReason,
  discountPercent,
  editingOrderId,
  onClose,
  onSuccess,
}) => {
  const { cashAccounts, currentUser, shifts } = useStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<number>(totalAmount);
  const [referenceNo, setReferenceNo] = useState("");
  const [selectedBank, setSelectedBank] = useState("BCA");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Default cash drawer account
  const defaultCashAccount = useMemo(() => {
    return (
      cashAccounts.find((a) => a.type === "CASH" && a.isDefault) ||
      cashAccounts.find((a) => a.type === "CASH") ||
      cashAccounts[0]
    );
  }, [cashAccounts]);

  const [selectedAccountId, setSelectedAccountId] = useState(defaultCashAccount?.id || "");

  // Active shift
  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === "OPEN" && (currentUser?.id ? s.userId === currentUser.id : true)) || null;
  }, [shifts, currentUser]);

  // Kembalian
  const changeAmount = useMemo(() => {
    if (paymentMethod !== "CASH") return 0;
    return Math.max(0, (cashReceived || 0) - totalAmount);
  }, [cashReceived, totalAmount, paymentMethod]);

  const isCashSufficient = paymentMethod !== "CASH" || (cashReceived || 0) >= totalAmount;

  // Preset pecahan uang tunai
  const quickCashPresets = useMemo(() => {
    const presets = [totalAmount];
    const rounded50 = Math.ceil(totalAmount / 50000) * 50000;
    const rounded100 = Math.ceil(totalAmount / 100000) * 100000;

    if (totalAmount <= 20000) presets.push(20000);
    if (totalAmount <= 50000 && !presets.includes(50000)) presets.push(50000);
    if (rounded50 > totalAmount && !presets.includes(rounded50)) presets.push(rounded50);
    if (rounded100 > totalAmount && !presets.includes(rounded100)) presets.push(rounded100);
    if (!presets.includes(100000) && totalAmount < 100000) presets.push(100000);

    return Array.from(new Set(presets)).sort((a, b) => a - b);
  }, [totalAmount]);

  const handleProcessPayment = async () => {
    if (!isCashSufficient) {
      setErrorMessage("Nominal uang yang diterima kurang dari total tagihan.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (editingOrderId) {
        // Pelunasan Open Bill yang sudah ada di database
        const res = await fetch(`/api/pos/orders/${editingOrderId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethod,
            amount: totalAmount,
            cashReceived: paymentMethod === "CASH" ? cashReceived : totalAmount,
            changeAmount,
            referenceNo: referenceNo.trim() ? `${selectedBank} - ${referenceNo.trim()}` : null,
            cashAccountId: selectedAccountId || defaultCashAccount?.id,
            shiftId: activeShift?.id || null,
            cashierName: currentUser?.name || "Kasir",
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal melunasi pesanan");
        }

        const data = await res.json();
        onSuccess({
          ...data.order,
          items: cart,
          payments: data.payments,
        });
      } else {
        // Pembayaran Langsung (Pay First) order baru
        const payload = {
          idempotencyKey: crypto.randomUUID(),
          orderType,
          tableNumber: tableNumber.trim() || (orderType === "TAKE_AWAY" ? "Takeaway" : "Meja"),
          customerName: customerName.trim() || "Tamu",
          items: cart.map((ci) => ({
            menuName: ci.menuName,
            recipeId: ci.recipeId,
            variantName: ci.variantName,
            quantity: ci.quantity,
            unitPrice: ci.unitPrice,
            subtotal: ci.subtotal,
            modifiers: ci.modifiers,
            notes: ci.notes,
            printDestination: ci.printDestination,
          })),
          subtotal,
          discountPercent: discountPercent || 0,
          discountAmount,
          discountReason: discountReason || null,
          taxPercent,
          taxAmount,
          taxMode,
          totalAmount,
          notes: orderNotes || null,
          cashierId: currentUser?.id || "cashier",
          cashierName: currentUser?.name || "Kasir",
          shiftId: activeShift?.id || null,
          status: "PAID",
          payment: {
            paymentMethod,
            amount: totalAmount,
            cashReceived: paymentMethod === "CASH" ? cashReceived : totalAmount,
            changeAmount,
            referenceNo: referenceNo.trim() ? `${selectedBank} - ${referenceNo.trim()}` : null,
            cashAccountId: selectedAccountId || defaultCashAccount?.id,
          },
        };

        const res = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal memproses pembayaran");
        }

        const data = await res.json();
        onSuccess({
          ...data.order,
          items: data.items,
          payments: data.payments,
        });
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Terjadi kesalahan saat menyimpan transaksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header Modal */}
        <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-600" />
              Pembayaran Pesanan Kasir
            </h2>
            <p className="text-xs text-slate-500">
              {orderType === "DINE_IN" ? `Dine In • ${tableNumber || "Meja"}` : "Take Away"}{" "}
              {customerName ? `• ${customerName}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Display */}
        <div className="p-5 bg-gradient-to-b from-amber-50/70 to-amber-50/30 border-b border-amber-100/80 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Total yang Harus Dibayar
          </p>
          <h1 className="text-3xl font-black text-amber-700 mt-1">
            {formatCurrency(totalAmount)}
          </h1>
          {discountAmount > 0 && (
            <p className="text-xs font-semibold text-emerald-700 mt-0.5">
              Hemat {formatCurrency(discountAmount)} ({discountReason || "Diskon"})
            </p>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Metode Pembayaran Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              Pilih Metode Pembayaran
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "CASH", label: "Tunai (Cash)", icon: Banknote },
                { id: "QRIS", label: "QRIS Bank", icon: QrCode },
                { id: "DEBIT", label: "Kartu Debit", icon: CreditCard },
                { id: "CREDIT", label: "Kartu Kredit", icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setPaymentMethod(m.id as PaymentMethod);
                      if (m.id !== "CASH") setCashReceived(totalAmount);
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? "bg-amber-600 border-amber-600 text-white shadow-md font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form sesuai metode pembayaran */}
          {paymentMethod === "CASH" ? (
            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {/* Presets uang pas & pecahan */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">
                  Pilihan Cepat Nominal Uang
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {quickCashPresets.map((val) => (
                    <button
                      key={val}
                      onClick={() => setCashReceived(val)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                        cashReceived === val
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300"
                      }`}
                    >
                      {val === totalAmount ? "Uang Pas" : formatCurrency(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input nominal uang diterima */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Uang Diterima dari Pelanggan (Rp)
                </label>
                <input
                  type="number"
                  value={cashReceived || ""}
                  onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>

              {/* Kembalian Display */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center bg-white p-3 rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Kembalian Pelanggan</p>
                  <p
                    className={`text-2xl font-black ${
                      !isCashSufficient
                        ? "text-rose-600"
                        : changeAmount > 0
                        ? "text-emerald-600"
                        : "text-slate-700"
                    }`}
                  >
                    {!isCashSufficient
                      ? `Kurang ${formatCurrency(totalAmount - (cashReceived || 0))}`
                      : formatCurrency(changeAmount)}
                  </p>
                </div>
                {isCashSufficient && changeAmount === 0 && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Uang Pas
                  </span>
                )}
              </div>
            </div>
          ) : paymentMethod === "QRIS" ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs">
                <QrCode className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">QRIS Dinamis / Statis</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                  Arahkan pelanggan scan kode QR pada mesin EDC bank atau akrilik QRIS meja kasir.
                </p>
              </div>

              <div className="w-full text-left">
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Nomor Referensi / Approval QRIS (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RRN-99201928"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {["BCA", "Mandiri", "BRI", "BNI"].map((b) => (
                  <button
                    key={b}
                    onClick={() => setSelectedBank(b)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      selectedBank === b
                        ? "bg-sky-600 border-sky-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Nomor Approval EDC / Trace Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 129482 (dari kertas slip EDC)"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
            </div>
          )}

          {/* Akun Kas Penyimpanan */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
              <span>Akun Kas / Laci Penyimpanan</span>
              <span className="text-[10px] text-slate-400">Otomatis catat jurnal kas</span>
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            >
              {cashAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Batal
          </button>

          <button
            onClick={handleProcessPayment}
            disabled={isSubmitting || !isCashSufficient}
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold shadow-md shadow-amber-600/20 transition flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesaikan Pembayaran</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
