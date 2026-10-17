import React, { useState, useEffect } from "react";
import { formatCurrency } from "../../utils/format";
import {
  Receipt,
  Search,
  X,
  RotateCcw,
  Clock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  QrCode,
  CreditCard,
  FileText,
} from "lucide-react";
import { PosReceiptModal } from "./PosReceiptModal";

interface PosTodayOrdersModalProps {
  onClose: () => void;
}

export const PosTodayOrdersModal: React.FC<PosTodayOrdersModalProps> = ({ onClose }) => {
  const [summaryData, setSummaryData] = useState<{
    totalRevenue: number;
    paidCount: number;
    openCount: number;
    voidCount: number;
    orders: any[];
  }>({
    totalRevenue: 0,
    paidCount: 0,
    openCount: 0,
    voidCount: 0,
    orders: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedReprintOrder, setSelectedReprintOrder] = useState<any | null>(null);

  const fetchTodayOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pos/orders/today");
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (e) {
      console.error("Gagal mengambil riwayat transaksi hari ini:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayOrders();
  }, []);

  const handleOpenReceiptReprint = async (orderId: string) => {
    try {
      const res = await fetch(`/api/pos/orders/${orderId}`);
      if (res.ok) {
        const fullData = await res.json();
        setSelectedReprintOrder({
          ...fullData.order,
          items: fullData.items,
          payments: fullData.payments,
        });
      }
    } catch (e) {
      alert("Gagal memuat detail transaksi");
    }
  };

  const filteredOrders = (summaryData.orders || []).filter((ord) => {
    const matchesQuery =
      (ord.receiptNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.tableNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.customerName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || ord.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Riwayat Transaksi POS Hari Ini
              </h2>
              <p className="text-xs text-slate-500">
                Lihat transaksi selesai, status void, dan cetak ulang struk (*reprint*).
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

        {/* Ringkasan Angka Kasir Hari Ini */}
        <div className="grid grid-cols-4 gap-2.5 p-4 bg-slate-50/70 border-b border-slate-200">
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Total Omzet Lunas</p>
            <p className="text-sm font-black text-brand-700 mt-0.5">
              {formatCurrency(summaryData.totalRevenue)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Nota Selesai</p>
            <p className="text-sm font-black text-emerald-700 mt-0.5">
              {summaryData.paidCount} Transaksi
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Open Bill Meja</p>
            <p className="text-sm font-black text-sky-700 mt-0.5">
              {summaryData.openCount} Meja
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Void / Batal</p>
            <p className="text-sm font-black text-rose-700 mt-0.5">
              {summaryData.voidCount} Transaksi
            </p>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="p-3 px-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari no nota, meja, atau pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
            />
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: "ALL", label: "Semua" },
              { id: "PAID", label: "Lunas" },
              { id: "OPEN", label: "Open Bill" },
              { id: "VOID", label: "Void" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  statusFilter === f.id
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchTodayOrders}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
          </button>
        </div>

        {/* Order Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/20">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-brand-600" />
              <p className="text-xs">Memuat transaksi kasir hari ini...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Receipt className="w-10 h-10 stroke-1 text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Tidak ada transaksi yang cocok</p>
            </div>
          ) : (
            filteredOrders.map((ord) => {
              const timeStr = new Date(ord.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={ord.id}
                  className="p-3 px-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs ${
                        ord.status === "PAID"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : ord.status === "OPEN"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {ord.status === "PAID" ? "LUNAS" : ord.status === "OPEN" ? "OPEN" : "VOID"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {ord.receiptNo}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {timeStr}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                          {ord.tableNumber || "Meja -"} • {ord.customerName || "Tamu"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Kasir: {ord.cashierName || "Kasir"}
                        {ord.voidReason && (
                          <span className="ml-2 text-rose-600 font-bold italic">
                            (Alasan: {ord.voidReason})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-black text-brand-700">
                        {formatCurrency(ord.totalAmount)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {ord.orderType === "DINE_IN" ? "Dine In" : "Take Away"}
                      </p>
                    </div>

                    {ord.status === "PAID" && (
                      <button
                        onClick={() => handleOpenReceiptReprint(ord.id)}
                        className="p-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 text-xs font-bold"
                        title="Cetak Ulang Struk"
                      >
                        <Printer className="w-4 h-4 text-brand-600" />
                        <span>Cetak Ulang</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
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
      </div>

      {/* Modal Cetak Ulang Struk */}
      {selectedReprintOrder && (
        <PosReceiptModal
          orderData={selectedReprintOrder}
          onClose={() => setSelectedReprintOrder(null)}
        />
      )}
    </div>
  );
};
