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
} from "lucide-react";
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header Modal */}
        <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Daftar Open Bill / Meja Aktif
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {openBills.length} Bill Belum Lunas
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pilih meja untuk menambah pesanan atau melanjutkan ke pembayaran.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nomor meja, nama tamu, atau no order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={fetchActiveOrders}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh Daftar"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-xs">Memuat daftar open bill meja...</p>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Utensils className="w-10 h-10 stroke-1 text-slate-700" />
              <p className="text-xs font-medium text-slate-400">Tidak ada Open Bill aktif</p>
              <p className="text-[11px] text-slate-500 text-center max-w-xs">
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
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div>
                      {/* Top row: Table badge & time */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
                          <Utensils className="w-3.5 h-3.5" />
                          {bill.tableNumber || "Meja -"}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {orderTime}
                        </span>
                      </div>

                      {/* Info & Items Preview */}
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {bill.customerName || "Tamu"}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {bill.receiptNo}
                        </p>

                        <div className="mt-2 pt-2 border-t border-slate-900 text-xs text-slate-400 line-clamp-2">
                          {(bill.items || []).map((it: any) => `${it.menuName} (x${it.quantity})`).join(", ")}
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Total & Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-500">{itemCount} Menu</p>
                        <p className="text-sm font-black text-amber-400">
                          {formatCurrency(bill.totalAmount)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedVoidOrder(bill)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 transition"
                          title="Batalkan / Void Bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectOrder(bill)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
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
        <div className="p-3 px-6 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Tutup
          </button>
        </div>
      </div>

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
    </div>
  );
};
