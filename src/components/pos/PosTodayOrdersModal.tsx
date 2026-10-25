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
  ShieldAlert,
  ArrowRight,
  PackageCheck,
  Trash2,
  MinusCircle,
} from "lucide-react";
import { PosReceiptModal } from "./PosReceiptModal";
import { PosManagerPinModal } from "./PosManagerPinModal";

interface PosTodayOrdersModalProps {
  onClose: () => void;
}

export const PosTodayOrdersModal: React.FC<PosTodayOrdersModalProps> = ({ onClose }) => {
  const [summaryData, setSummaryData] = useState<{
    totalRevenue: number;
    paidCount: number;
    openCount: number;
    voidCount: number;
    refundCount?: number;
    refundTotal?: number;
    netRevenue?: number;
    orders: any[];
  }>({
    totalRevenue: 0,
    paidCount: 0,
    openCount: 0,
    voidCount: 0,
    refundCount: 0,
    refundTotal: 0,
    netRevenue: 0,
    orders: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedReprintOrder, setSelectedReprintOrder] = useState<any | null>(null);

  // State untuk alur refund
  const [orderToRefund, setOrderToRefund] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [refundRestockOption, setRefundRestockOption] = useState<"RETURN_TO_STOCK" | "WASTE" | "NONE">("RETURN_TO_STOCK");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

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

  const handleStartRefund = (ord: any) => {
    setOrderToRefund(ord);
    setRefundReason("");
    setRefundMethod(ord.paymentMethod === "CASH" ? "CASH" : ord.paymentMethod === "QRIS" ? "QRIS" : "CASH");
    setRefundRestockOption("RETURN_TO_STOCK");
    setRefundAmount(ord.totalAmount || 0);
    setRefundError(null);
  };

  const handleProceedToPin = () => {
    if (!refundReason.trim()) {
      setRefundError("Alasan refund wajib diisi untuk SOP dan pelaporan audit kasir.");
      return;
    }
    setRefundError(null);
    setShowPinModal(true);
  };

  const handlePinSuccess = async (manager: any) => {
    if (!orderToRefund) return;
    setIsRefunding(true);
    setRefundError(null);

    try {
      const res = await fetch(`/api/pos/orders/${orderToRefund.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerPin: manager.pin,
          refundReason: refundReason.trim(),
          refundMethod,
          refundRestockOption,
          refundAmount,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setRefundError(result.error || "Gagal memproses refund");
        setShowPinModal(false);
        setIsRefunding(false);
        return;
      }

      setShowPinModal(false);
      const refundedOrderId = orderToRefund.id;
      setOrderToRefund(null);
      await fetchTodayOrders();

      // Langsung buka struk refund untuk dicetak kasir
      await handleOpenReceiptReprint(refundedOrderId);
    } catch (e: any) {
      setRefundError(e?.message || "Terjadi kesalahan jaringan saat memproses refund.");
      setShowPinModal(false);
    } finally {
      setIsRefunding(false);
    }
  };

  const filteredOrders = (summaryData.orders || []).filter((ord) => {
    const matchesQuery =
      (ord.receiptNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.tableNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.customerName || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === "ALL") {
      matchesStatus = true;
    } else if (statusFilter === "VOID") {
      matchesStatus = ord.status === "VOID" || ord.status === "CANCELLED";
    } else {
      matchesStatus = ord.status === statusFilter;
    }

    return matchesQuery && matchesStatus;
  });

  const quickRefundReasons = [
    "Salah Input Menu Kasir",
    "Komplain Kualitas / Basi / Dingin",
    "Pelanggan Membatalkan Pesanan",
    "Waktu Tunggu Terlalu Lama",
    "Kelebihan / Double Bayar",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
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
                Kelola transaksi lunas, refund terotorisasi PIN Manager, void, dan cetak ulang struk.
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

        {/* Ringkasan Angka Kasir Hari Ini (5 Kolom: Bruto, Refund, Net, Lunas, Void) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 bg-slate-50/70 border-b border-slate-200">
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Omzet Bruto</p>
            <p className="text-sm font-black text-brand-700 mt-0.5">
              {formatCurrency(summaryData.totalRevenue)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-rose-200 bg-rose-50/30 shadow-xs">
            <p className="text-[10px] font-semibold text-rose-600">Total Refund ({summaryData.refundCount || 0})</p>
            <p className="text-sm font-black text-rose-700 mt-0.5">
              {formatCurrency(summaryData.refundTotal || 0)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-emerald-200 bg-emerald-50/30 shadow-xs">
            <p className="text-[10px] font-semibold text-emerald-600">Omzet Bersih</p>
            <p className="text-sm font-black text-emerald-700 mt-0.5">
              {formatCurrency(summaryData.netRevenue ?? (summaryData.totalRevenue - (summaryData.refundTotal || 0)))}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Nota Selesai</p>
            <p className="text-sm font-black text-slate-800 mt-0.5">
              {summaryData.paidCount} Transaksi
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500">Void / Batal</p>
            <p className="text-sm font-black text-amber-700 mt-0.5">
              {summaryData.voidCount} Transaksi
            </p>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="p-3 px-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari no nota, meja, atau pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
            />
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
            {[
              { id: "ALL", label: "Semua" },
              { id: "PAID", label: "Lunas" },
              { id: "REFUNDED", label: "Refund" },
              { id: "OPEN", label: "Open Bill" },
              { id: "VOID", label: "Void" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
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

              const isPaid = ord.status === "PAID";
              const isRefunded = ord.status === "REFUNDED";
              const isOpen = ord.status === "OPEN";
              const isVoid = ord.status === "VOID" || ord.status === "CANCELLED";

              return (
                <div
                  key={ord.id}
                  className={`p-3 px-4 rounded-2xl bg-white border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRefunded
                      ? "border-rose-200 bg-rose-50/10"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        isPaid
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : isRefunded
                          ? "bg-rose-50 text-rose-800 border border-rose-300"
                          : isOpen
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-300"
                      }`}
                    >
                      {isPaid ? "LUNAS" : isRefunded ? "REFUND" : isOpen ? "OPEN" : "VOID"}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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
                        {ord.paymentMethod && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                            {ord.paymentMethod}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        Kasir: {ord.cashierName || "Kasir"}
                        {ord.voidReason && (
                          <span className="ml-2 text-slate-600 font-bold italic">
                            (Alasan Void: {ord.voidReason})
                          </span>
                        )}
                        {isRefunded && (
                          <span className="ml-2 text-rose-700 font-bold">
                            • Refund {formatCurrency(ord.refundAmount || ord.totalAmount)} ({ord.refundMethod || "CASH"}) disetujui {ord.refundApprovedBy || "Manager"}
                          </span>
                        )}
                      </p>

                      {isRefunded && ord.refundReason && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">
                          Alasan: "{ord.refundReason}" • Restock:{" "}
                          <span className="font-semibold text-slate-700">
                            {ord.refundRestockOption === "RETURN_TO_STOCK"
                              ? "Kembalikan ke Stok"
                              : ord.refundRestockOption === "WASTE"
                              ? "Catat Kerusakan (Waste)"
                              : "Tanpa Perubahan Stok"}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <p className={`text-xs font-black ${isRefunded ? "text-rose-600 line-through" : "text-brand-700"}`}>
                        {formatCurrency(ord.totalAmount)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {ord.orderType === "DINE_IN" ? "Dine In" : "Take Away"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPaid && (
                        <>
                          <button
                            onClick={() => handleStartRefund(ord)}
                            className="p-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition flex items-center gap-1.5 text-xs font-bold"
                            title="Proses Pengembalian Dana (Refund)"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            <span>Refund</span>
                          </button>

                          <button
                            onClick={() => handleOpenReceiptReprint(ord.id)}
                            className="p-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 text-xs font-bold"
                            title="Cetak Ulang Struk"
                          >
                            <Printer className="w-3.5 h-3.5 text-brand-600" />
                            <span>Cetak</span>
                          </button>
                        </>
                      )}

                      {isRefunded && (
                        <button
                          onClick={() => handleOpenReceiptReprint(ord.id)}
                          className="p-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition flex items-center gap-1.5 text-xs font-bold"
                          title="Cetak Bukti Refund"
                        >
                          <Printer className="w-3.5 h-3.5 text-rose-600" />
                          <span>Bukti Refund</span>
                        </button>
                      )}

                      {isVoid && (
                        <button
                          onClick={() => handleOpenReceiptReprint(ord.id)}
                          className="p-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition flex items-center gap-1.5 text-xs font-medium"
                          title="Cetak Bukti Void"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Struk Void</span>
                        </button>
                      )}
                    </div>
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

      {/* ── Dialog Form Pengajuan Refund ───────────────────────────── */}
      {orderToRefund && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-4 px-6 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-950">
                    Otorisasi Pengembalian Dana (Refund)
                  </h3>
                  <p className="text-[11px] text-rose-800">
                    Nota #{orderToRefund.receiptNo} • Total {formatCurrency(orderToRefund.totalAmount)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOrderToRefund(null)}
                className="p-1 rounded-xl bg-white/80 hover:bg-white text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Notice SOP */}
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-amber-800 mb-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  SOP Otorisasi Manager Julia's Coffee
                </p>
                Setiap pengembalian uang dari laci kasir wajib mendapatkan persetujuan langsung Manager/Owner melalui input PIN. Stok bahan dan mutasi kasir dicatat secara otomatis.
              </div>

              {refundError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 font-semibold text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{refundError}</span>
                </div>
              )}

              {/* Nominal Refund */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nominal Refund:
                </label>
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Dana yang dikembalikan ke pelanggan</span>
                  <span className="text-sm font-black text-rose-600">
                    {formatCurrency(refundAmount)}
                  </span>
                </div>
              </div>

              {/* Metode Refund */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Metode Pengembalian Dana:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod("CASH")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition ${
                      refundMethod === "CASH"
                        ? "bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span className="text-[11px]">Tunai / Laci</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod("TRANSFER")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition ${
                      refundMethod === "TRANSFER"
                        ? "bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[11px]">Transfer Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod("QRIS")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition ${
                      refundMethod === "QRIS"
                        ? "bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span className="text-[11px]">QRIS / E-Wallet</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {refundMethod === "CASH"
                    ? "Otomatis mencatat Kas Keluar (CASH_OUT) dari laci kasir shift aktif."
                    : "Dana dikembalikan non-tunai melalui rekening usaha atau e-wallet."}
                </p>
              </div>

              {/* Perlakuan Stok Bahan Baku */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Perlakuan Stok Bahan Baku:
                </label>
                <div className="space-y-1.5">
                  <label
                    onClick={() => setRefundRestockOption("RETURN_TO_STOCK")}
                    className={`p-2.5 px-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      refundRestockOption === "RETURN_TO_STOCK"
                        ? "bg-emerald-50/50 border-emerald-500 text-emerald-950 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <PackageCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs">Kembalikan ke Stok Gudang (Restock)</p>
                      <p className="text-[10px] text-slate-500 font-normal">
                        Bahan baku belum diproses atau produk masih layak & utuh.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setRefundRestockOption("WASTE")}
                    className={`p-2.5 px-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      refundRestockOption === "WASTE"
                        ? "bg-amber-50/50 border-amber-500 text-amber-950 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Trash2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs">Catat Kerusakan / Terbuang (Waste)</p>
                      <p className="text-[10px] text-slate-500 font-normal">
                        Minuman/makanan sudah dibuat & rusak/dibuang karena basi atau salah racik.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setRefundRestockOption("NONE")}
                    className={`p-2.5 px-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      refundRestockOption === "NONE"
                        ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <MinusCircle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs">Tanpa Perubahan Stok</p>
                      <p className="text-[10px] text-slate-500 font-normal">
                        Hanya rekonsiliasi pengembalian dana keuangan kasir.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Alasan Refund */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alasan Refund (Wajib):
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {quickRefundReasons.map((qr) => (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => setRefundReason(qr)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                        refundReason === qr
                          ? "bg-rose-100 border-rose-300 text-rose-800 font-bold"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Ketik keterangan rinci keluhan atau alasan pengembalian dana..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                />
              </div>
            </div>

            <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setOrderToRefund(null)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleProceedToPin}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition"
              >
                <span>Minta Otorisasi PIN Manager</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal PIN Manager untuk Otorisasi Refund ─────────────────── */}
      {showPinModal && orderToRefund && (
        <PosManagerPinModal
          title="Otorisasi Refund Kasir"
          description={`Masukkan PIN Manager/Owner untuk menyetujui pengembalian dana sebesar ${formatCurrency(refundAmount)} pada nota #${orderToRefund.receiptNo}.`}
          onClose={() => setShowPinModal(false)}
          onSuccess={handlePinSuccess}
        />
      )}

      {/* Modal Cetak Ulang Struk / Bukti Refund */}
      {selectedReprintOrder && (
        <PosReceiptModal
          orderData={selectedReprintOrder}
          onClose={() => setSelectedReprintOrder(null)}
        />
      )}
    </div>
  );
};
