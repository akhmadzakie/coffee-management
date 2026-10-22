import React, { useState, useEffect } from "react";
import { formatCurrency } from "../../utils/format";
import {
  Users,
  Search,
  X,
  RotateCcw,
  Clock,
  ArrowRight,
  Trash2,
  FileText,
  AlertCircle,
  Utensils,
  GitFork,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { motion } from "motion/react";
import { PosManagerPinModal } from "./PosManagerPinModal";

interface PosOpenBillsModalProps {
  onClose: () => void;
  onSelectOrder: (order: any) => void;
  onOrderVoided: () => void;
}

export const PosOpenBillsModal: React.FC<PosOpenBillsModalProps> = ({
  onClose,
  onSelectOrder,
  onOrderVoided,
}) => {
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVoidOrder, setSelectedVoidOrder] = useState<any | null>(null);

  // State Split Bill
  const [selectedSplitOrder, setSelectedSplitOrder] = useState<any | null>(null);
  const [splitMode, setSplitMode] = useState<"ITEMS" | "EVENLY">("ITEMS");
  const [splitItemQuantities, setSplitItemQuantities] = useState<Record<string, number>>({});
  const [splitPersonsCount, setSplitPersonsCount] = useState<number>(2);

  const fetchActiveOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pos/orders/active");
      if (res.ok) {
        const data = await res.json();
        setOpenBills(data);
      }
    } catch (e) {
      console.error("Gagal mengambil open bills:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveOrders();
  }, []);

  const filteredBills = openBills.filter((b) => {
    const tableMatch = (b.tableNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
    const nameMatch = (b.customerName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const receiptMatch = (b.receiptNo || "").toLowerCase().includes(searchQuery.toLowerCase());
    return tableMatch || nameMatch || receiptMatch;
  });

  const handleConfirmVoid = async (manager: any, reason: string) => {
    if (!selectedVoidOrder) return;
    try {
      const res = await fetch(`/api/pos/orders/${selectedVoidOrder.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerPin: manager.pin,
          voidReason: reason || "Dibatalkan oleh kasir/manager",
          cancelledBy: manager.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membatalkan order");
      }

      alert(`Order #${selectedVoidOrder.receiptNo} berhasil dibatalkan.`);
      setSelectedVoidOrder(null);
      fetchActiveOrders();
      onOrderVoided();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", damping: 28, stiffness: 360 }}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header Modal */}
        <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Daftar Open Bill / Meja Aktif
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                  {openBills.length} Bill Belum Lunas
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pilih meja untuk menambah pesanan atau melanjutkan ke pembayaran.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nomor meja, nama tamu, atau no order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
            />
          </div>
          <button
            onClick={fetchActiveOrders}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition"
            title="Refresh Daftar"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-brand-600" />
              <p className="text-xs">Memuat daftar open bill meja...</p>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Utensils className="w-10 h-10 stroke-1 text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Tidak ada Open Bill aktif</p>
              <p className="text-[11px] text-slate-400 text-center max-w-xs">
                Semua pesanan saat ini sudah lunas atau belum ada tagihan meja baru yang disimpan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredBills.map((bill) => {
                const itemCount = (bill.items || []).reduce(
                  (sum: number, it: any) => sum + (Number(it.quantity) || 1),
                  0
                );
                const orderTime = new Date(bill.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={bill.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div>
                      {/* Top row: Table badge & time */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                          <Utensils className="w-3.5 h-3.5 text-slate-600" />
                          {bill.tableNumber || "Meja -"}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {orderTime}
                        </span>
                      </div>

                      {/* Info & Items Preview */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {bill.customerName || "Tamu"}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {bill.receiptNo}
                        </p>

                        <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 line-clamp-2">
                          {(bill.items || []).map((it: any) => `${it.menuName} (x${it.quantity})`).join(", ")}
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Total & Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-500 font-medium">{itemCount} Menu</p>
                        <p className="text-sm font-black text-brand-700">
                          {formatCurrency(bill.totalAmount)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedSplitOrder(bill);
                            setSplitMode("ITEMS");
                            // Default: inisialisasi split quantities = 0
                            const initialQty: Record<string, number> = {};
                            (bill.items || []).forEach((it: any) => {
                              initialQty[it.id] = 0;
                            });
                            setSplitItemQuantities(initialQty);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          title="Pecah Tagihan (Split Bill)"
                        >
                          <GitFork className="w-3.5 h-3.5 text-brand-700" />
                          <span>Split Bill</span>
                        </button>
                        <button
                          onClick={() => setSelectedVoidOrder(bill)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition"
                          title="Batalkan / Void Bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectOrder(bill)}
                          className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                        >
                          <span>Proses</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Tutup
          </button>
        </div>
      </motion.div>

      {/* Modal Otorisasi PIN untuk Void Bill */}
      {selectedVoidOrder && (
        <PosManagerPinModal
          title={`Batalkan Open Bill #${selectedVoidOrder.receiptNo}`}
          description={`Anda akan membatalkan tagihan ${selectedVoidOrder.tableNumber} (${selectedVoidOrder.customerName || "Tamu"}). Masukkan PIN Manager untuk otorisasi.`}
          requireReason={true}
          onClose={() => setSelectedVoidOrder(null)}
          onSuccess={(manager, reason) => handleConfirmVoid(manager, reason || "")}
        />
      )}

      {/* ─── Modal Split Bill (Pecah Tagihan) ────────────────────────────── */}
      {selectedSplitOrder && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header Split Bill */}
            <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pecah Tagihan (Split Bill)
                  </h3>
                  <p className="text-xs text-slate-500">
                    #{selectedSplitOrder.receiptNo} • {selectedSplitOrder.tableNumber || "Meja"} ({selectedSplitOrder.customerName || "Tamu"})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSplitOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher: By Item vs By Person */}
            <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex gap-2">
              <button
                onClick={() => setSplitMode("ITEMS")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  splitMode === "ITEMS"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pilih Menu Tertentu (Per Item)
              </button>
              <button
                onClick={() => setSplitMode("EVENLY")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  splitMode === "EVENLY"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bagi Rata (Per Orang)
              </button>
            </div>

            {/* Content Area */}
            <div className="p-5 overflow-y-auto max-h-[55vh] space-y-4">
              {splitMode === "ITEMS" ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Pilih menu dan tentukan jumlah yang ingin dibayar pada bagian pembayaran ini:
                  </p>
                  {(selectedSplitOrder.items || []).map((it: any) => {
                    const currentSplitQty = splitItemQuantities[it.id] || 0;
                    const maxQty = Number(it.quantity) || 1;

                    return (
                      <div
                        key={it.id}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          currentSplitQty > 0
                            ? "bg-brand-50/60 border-brand-300 shadow-2xs"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {it.menuName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatCurrency(it.unitPrice)} • Total dipesan: {maxQty} porsi
                          </p>
                        </div>

                        {/* Stepper qty split */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSplitItemQuantities((prev) => ({
                                ...prev,
                                [it.id]: Math.max(0, (prev[it.id] || 0) - 1),
                              }));
                            }}
                            disabled={currentSplitQty <= 0}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-black text-brand-800">
                            {currentSplitQty}
                          </span>
                          <button
                            onClick={() => {
                              setSplitItemQuantities((prev) => ({
                                ...prev,
                                [it.id]: Math.min(maxQty, (prev[it.id] || 0) + 1),
                              }));
                            }}
                            disabled={currentSplitQty >= maxQty}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4 text-center py-2">
                  <p className="text-xs text-slate-500">
                    Bagi total tagihan secara proporsional sesuai jumlah orang:
                  </p>
                  <div className="flex justify-center gap-2">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setSplitPersonsCount(num)}
                        className={`w-12 h-12 rounded-2xl text-sm font-bold border transition ${
                          splitPersonsCount === num
                            ? "bg-brand-600 text-white border-brand-600 shadow-xs font-black"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {num}x
                      </button>
                    ))}
                  </div>

                  <div className="p-4 bg-brand-50/60 rounded-2xl border border-brand-200 mt-3 text-center">
                    <p className="text-xs font-semibold text-slate-600">Tagihan per Orang</p>
                    <p className="text-2xl font-black text-brand-700 mt-1">
                      {formatCurrency(Math.round(selectedSplitOrder.totalAmount / splitPersonsCount))}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Total: {formatCurrency(selectedSplitOrder.totalAmount)} dibagi {splitPersonsCount} orang
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Split Action */}
            <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Nominal Bagian Ini</p>
                <p className="text-base font-black text-brand-700">
                  {splitMode === "ITEMS"
                    ? formatCurrency(
                        (selectedSplitOrder.items || []).reduce((sum: number, it: any) => {
                          const qty = splitItemQuantities[it.id] || 0;
                          return sum + (it.unitPrice || 0) * qty;
                        }, 0)
                      )
                    : formatCurrency(Math.round(selectedSplitOrder.totalAmount / splitPersonsCount))}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSplitOrder(null)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (splitMode === "ITEMS") {
                      const selectedItemsToPay = (selectedSplitOrder.items || [])
                        .filter((it: any) => (splitItemQuantities[it.id] || 0) > 0)
                        .map((it: any) => ({
                          ...it,
                          quantity: splitItemQuantities[it.id],
                          subtotal: it.unitPrice * splitItemQuantities[it.id],
                        }));

                      if (selectedItemsToPay.length === 0) {
                        alert("Pilih minimal 1 porsi menu untuk dibayar!");
                        return;
                      }

                      const splitSubtotal = selectedItemsToPay.reduce((s: number, i: any) => s + i.subtotal, 0);
                      const splitOrder = {
                        ...selectedSplitOrder,
                        customerName: `${selectedSplitOrder.customerName || "Tamu"} (Split)`,
                        items: selectedItemsToPay,
                        totalAmount: splitSubtotal,
                        subtotal: splitSubtotal,
                      };

                      onSelectOrder(splitOrder);
                    } else {
                      const amountPerPerson = Math.round(selectedSplitOrder.totalAmount / splitPersonsCount);
                      const splitOrder = {
                        ...selectedSplitOrder,
                        customerName: `${selectedSplitOrder.customerName || "Tamu"} (1/${splitPersonsCount})`,
                        totalAmount: amountPerPerson,
                        subtotal: amountPerPerson,
                      };
                      onSelectOrder(splitOrder);
                    }
                    setSelectedSplitOrder(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <span>Bayar Bagian Ini</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
