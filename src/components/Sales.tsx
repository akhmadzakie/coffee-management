import React, { useState, useRef, useEffect, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import {
  Upload,
  Search,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Store,
  Calendar,
  Receipt,
  Eye,
  Filter,
  DollarSign,
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
  X,
  Printer,
  ChevronDown,
  Plus,
  Trash2,
  Smartphone,
  Building2,
  TrendingUp,
  Sparkles,
  Clock,
  User,
  Coffee,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "../utils/format";
import { CsvImportExport } from "./common/CsvImportExport";
import { exportDailySalesRecapToXlsx, exportSalesToXlsx } from "../utils/exportXlsx";

interface PosOrderDetail {
  id: string;
  receiptNo: string;
  orderType: string;
  tableNumber?: string | null;
  customerName?: string | null;
  status: string;
  subtotal: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  taxMode?: string | null;
  totalAmount: number;
  notes?: string | null;
  cashierName?: string | null;
  voidReason?: string | null;
  voidApprovedBy?: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    menuName: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    modifiers?: any;
    notes?: string | null;
  }>;
  payments?: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    cashReceived?: number | null;
    changeAmount?: number | null;
    referenceNo?: string | null;
  }>;
}

export const Sales = () => {
  const {
    salesTransactions,
    salesImportLogs,
    dailySalesRecaps = [],
    addDailySalesRecap,
    deleteDailySalesRecap,
    syncData,
    currentUser,
    settings,
    products,
    addSalesTransactions,
    isReadOnly,
  } = useStore();

  const isOwner = currentUser?.role === "OWNER" || isReadOnly;
  const [activeTab, setActiveTab] = useState<"daily_recap" | "pos_orders" | "sales" | "logs">("daily_recap");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Input Omzet Harian
  const [isAddRecapOpen, setIsAddRecapOpen] = useState(false);
  const [recapForm, setRecapForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    shift: "ALL" as "ALL" | "PAGI" | "SORE" | "MALAM",
    cashAmount: "",
    qrisAmount: "",
    edcAmount: "",
    transferAmount: "",
    notes: "",
  });
  const [recapDateFilter, setRecapDateFilter] = useState<string>("");

  // State untuk Tab Transaksi Kasir POS
  const [posOrders, setPosOrders] = useState<PosOrderDetail[]>([]);
  const [isLoadingPosOrders, setIsLoadingPosOrders] = useState(false);
  const [posStatusFilter, setPosStatusFilter] = useState<string>("ALL");
  const [posStartDate, setPosStartDate] = useState<string>("");
  const [posEndDate, setPosEndDate] = useState<string>("");
  const [posSearchQuery, setPosSearchQuery] = useState<string>("");
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<PosOrderDetail | null>(null);

  // Perhitungan Rekap Omzet Harian
  const filteredRecaps = useMemo(() => {
    let list = [...dailySalesRecaps];
    if (recapDateFilter) {
      list = list.filter((r) => r.date.startsWith(recapDateFilter));
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailySalesRecaps, recapDateFilter]);

  const recapSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCash = 0;
    let totalQris = 0;
    let totalEdc = 0;
    let totalTransfer = 0;

    dailySalesRecaps.forEach((r) => {
      totalRevenue += Number(r.totalAmount) || 0;
      totalCash += Number(r.cashAmount) || 0;
      totalQris += Number(r.qrisAmount) || 0;
      totalEdc += Number(r.edcAmount) || 0;
      totalTransfer += Number(r.transferAmount) || 0;
    });

    return {
      totalRevenue,
      totalCash,
      totalQris,
      totalEdc,
      totalTransfer,
      count: dailySalesRecaps.length,
    };
  }, [dailySalesRecaps]);

  const currentFormTotal =
    (Number(recapForm.cashAmount) || 0) +
    (Number(recapForm.qrisAmount) || 0) +
    (Number(recapForm.edcAmount) || 0) +
    (Number(recapForm.transferAmount) || 0);

  const handleSaveRecap = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentFormTotal <= 0) {
      alert("Total omzet harus lebih besar dari Rp 0.");
      return;
    }

    addDailySalesRecap({
      date: recapForm.date,
      shift: recapForm.shift,
      cashAmount: Number(recapForm.cashAmount) || 0,
      qrisAmount: Number(recapForm.qrisAmount) || 0,
      edcAmount: Number(recapForm.edcAmount) || 0,
      transferAmount: Number(recapForm.transferAmount) || 0,
      totalAmount: currentFormTotal,
      notes: recapForm.notes.trim() || undefined,
      recordedBy: currentUser?.name || "Kasir / Finance",
    });

    setIsAddRecapOpen(false);
    setRecapForm({
      date: new Date().toISOString().slice(0, 10),
      shift: "ALL",
      cashAmount: "",
      qrisAmount: "",
      edcAmount: "",
      transferAmount: "",
      notes: "",
    });

    setUploadStatus({
      type: "success",
      message: `Omzet harian tanggal ${recapForm.date} sebesar ${formatCurrency(currentFormTotal)} berhasil dicatat & otomatis masuk ke Buku Kas!`,
    });
  };

  const handleDeleteRecap = (id: string, date: string, amount: number) => {
    if (window.confirm(`Yakin ingin menghapus rekap omzet tanggal ${date} (${formatCurrency(amount)})?`)) {
      deleteDailySalesRecap(id);
    }
  };

  // Fetch POS orders dari API backend
  const fetchPosOrders = async () => {
    setIsLoadingPosOrders(true);
    try {
      const params = new URLSearchParams();
      if (posStartDate) params.append("startDate", posStartDate);
      if (posEndDate) params.append("endDate", posEndDate);
      if (posStatusFilter && posStatusFilter !== "ALL") params.append("status", posStatusFilter);

      const res = await fetch(`/api/pos/orders/all?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data pesanan POS:", err);
    } finally {
      setIsLoadingPosOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pos_orders") {
      fetchPosOrders();
    }
  }, [activeTab, posStatusFilter, posStartDate, posEndDate]);

  // Hitung metrik ringkasan POS
  const posSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let paidCount = 0;
    let openCount = 0;
    let voidCount = 0;

    posOrders.forEach((ord) => {
      if (ord.status === "PAID") {
        totalRevenue += Number(ord.totalAmount) || 0;
        totalTax += Number(ord.taxAmount) || 0;
        totalDiscount += Number(ord.discountAmount) || 0;
        paidCount++;
      } else if (ord.status === "OPEN") {
        openCount++;
      } else if (ord.status === "VOID" || ord.status === "CANCELLED") {
        voidCount++;
      }
    });

    return {
      totalRevenue,
      totalTax,
      totalDiscount,
      paidCount,
      openCount,
      voidCount,
    };
  }, [posOrders]);

  // Filtered POS orders untuk pencarian lokal
  const filteredPosOrders = useMemo(() => {
    if (!posSearchQuery) return posOrders;
    const q = posSearchQuery.toLowerCase();
    return posOrders.filter(
      (ord) =>
        ord.receiptNo?.toLowerCase().includes(q) ||
        ord.cashierName?.toLowerCase().includes(q) ||
        ord.customerName?.toLowerCase().includes(q) ||
        ord.tableNumber?.toLowerCase().includes(q)
    );
  }, [posOrders, posSearchQuery]);

  const filteredSales = salesTransactions
    .filter((s) => s.menuName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredLogs = salesImportLogs.sort(
    (a, b) =>
      new Date(b.importDate).getTime() - new Date(a.importDate).getTime()
  );

  const handleSalesImport = (parsedData: any[]) => {
    if (!parsedData || parsedData.length === 0) return;

    const newTransactions = parsedData
      .map((row) => {
        const rawDate = row["Tanggal"] || new Date().toISOString().slice(0, 10);
        let dateStr = "";
        if (typeof rawDate === "object" && rawDate instanceof Date) {
          dateStr = rawDate.toISOString().slice(0, 10);
        } else {
          dateStr = String(rawDate).trim();
        }

        const menuName = String(row["Nama Menu"] || "").trim();
        const quantitySold = parseInt(row["Quantity"], 10) || 1;
        const totalPrice = parseFloat(row["Total Penjualan"]) || 0;

        return {
          date: dateStr,
          menuName,
          quantitySold,
          totalPrice,
          importLogId: "",
        };
      })
      .filter((t) => t.menuName.length > 0 && t.totalPrice >= 0);

    if (newTransactions.length === 0) {
      alert("Tidak ada baris data penjualan yang valid untuk diimpor. Pastikan kolom 'Nama Menu' terisi.");
      return;
    }

    addSalesTransactions(newTransactions, `Import Penjualan Excel (${newTransactions.length} baris)`);
    setUploadStatus({
      type: "success",
      message: `Berhasil mengimpor ${newTransactions.length} baris penjualan menu ke sistem.`,
    });
  };

  const handleExportDailyRecap = () => {
    exportDailySalesRecapToXlsx({
      recaps: filteredRecaps,
      settings,
      periodLabel: recapDateFilter || "Semua_Tanggal",
    });
  };

  const handleExportSales = () => {
    exportSalesToXlsx({
      sales: filteredSales,
      settings,
      periodLabel: "Item_Penjualan",
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Banner & Tab Navigation ──────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Top Info Header */}
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Revenue & POS Archives
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Julia's • Specialty Room • Coffee • Eatery
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            Penjualan & Omzet Kasir
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
            Rekapitulasi penerimaan kasir, arsip struk transaksi POS lengkap dengan item & pembayaran, serta riwayat mutasi penjualan.
          </p>
        </div>

        {/* Dedicated Tab Navigation Strip */}
        <div className="px-4 sm:px-7 py-3 bg-slate-50/70 border-t border-slate-200/80 flex items-center overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setActiveTab("daily_recap")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "daily_recap" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "daily_recap" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <DollarSign className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Rekap Harian</span>
              {dailySalesRecaps.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/70">
                  {dailySalesRecaps.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("pos_orders")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "pos_orders" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "pos_orders" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Receipt className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Arsip Struk POS</span>
              {posOrders.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/70">
                  {posOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("sales")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "sales" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "sales" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <FileSpreadsheet className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Item Terjual</span>
              {salesTransactions.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {salesTransactions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "logs" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "logs" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <RotateCcw className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Riwayat Import</span>
              {salesImportLogs.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {salesImportLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Notification Toast ────────────────────────────────────── */}
      <AnimatePresence>
        {uploadStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs ${
              uploadStatus.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200/80"
                : "bg-rose-50 text-rose-900 border border-rose-200/80"
            }`}
          >
            <div className="flex items-center gap-3">
              {uploadStatus.type === "success" ? (
                <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 rounded-xl bg-rose-600 text-white shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <span className="font-semibold text-xs sm:text-sm">{uploadStatus.message}</span>
            </div>
            <button
              onClick={() => setUploadStatus(null)}
              className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAB 1: REKAP OMZET HARIAN ─────────────────────────────────────── */}
      {activeTab === "daily_recap" && (
        <div className="space-y-6">
          {/* Top Actions for Daily Recap */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Filter Bulan / Periode:
              </span>
              <input
                type="month"
                value={recapDateFilter}
                onChange={(e) => setRecapDateFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-base sm:text-xs focus:outline-none focus:border-brand-500 focus:bg-white transition"
              />
              {recapDateFilter && (
                <button
                  onClick={() => setRecapDateFilter("")}
                  className="px-2 py-1 text-slate-500 hover:text-slate-900 text-xs font-semibold underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportDailyRecap}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                title="Unduh Rekap Omzet ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel (.xlsx)</span>
              </button>

              {!isReadOnly && (
                <button
                  onClick={() => setIsAddRecapOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat Omzet Harian</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Bento KPI Cards for Daily Recap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Omzet (Dark Royal Slate Hero) */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 text-white border border-white/10 shadow-xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-300 border border-white/10 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-brand-400" />
                    Total Omzet
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-300">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {formatCurrency(recapSummary.totalRevenue)}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 font-medium">
                    {recapSummary.count} Hari Entri Rekap Terdata
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Cash Tunai */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  Kas Fisik Toko
                </span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                {formatCurrency(recapSummary.totalCash)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Penerimaan Uang Tunai Kasir
              </p>
            </div>

            {/* Card 3: QRIS */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-sky-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70">
                  Non-Tunai QRIS
                </span>
                <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                  <QrCode className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-sky-600 tracking-tight">
                {formatCurrency(recapSummary.totalQris)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Langsung Masuk Rekening Bank
              </p>
            </div>

            {/* Card 4: EDC & Transfer */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-indigo-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  Mesin EDC & Transfer
                </span>
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-indigo-600 tracking-tight">
                {formatCurrency(recapSummary.totalEdc + recapSummary.totalTransfer)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                EDC: {formatCurrency(recapSummary.totalEdc)} • TF: {formatCurrency(recapSummary.totalTransfer)}
              </p>
            </div>
          </div>

          {/* Banner Sinkronisasi Otomatis */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-brand-50 via-indigo-50 to-amber-50 border border-brand-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-600 text-white shadow-xs shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Sinkronisasi Otomatis Buku Kas & Laporan Laba Rugi
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Setiap rekapitulasi harian yang dicatat langsung memperbarui saldo <strong>Buku Kas Fisik</strong> untuk tunai, dan <strong>Rekening Bank</strong> untuk QRIS/EDC, sehingga laporan laba rugi bulanan langsung mutakhir tanpa input manual berulang.
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setIsAddRecapOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white text-xs font-bold transition shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Omzet Baru</span>
              </button>
            )}
          </div>

          {/* Dual-View Data: Rekap Omzet Harian */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Rekapitulasi Omzet Harian
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Menampilkan <strong>{filteredRecaps.length}</strong> entri
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Shift</th>
                    <th className="p-3.5 text-right">Tunai (Cash)</th>
                    <th className="p-3.5 text-right">QRIS</th>
                    <th className="p-3.5 text-right">Mesin EDC</th>
                    <th className="p-3.5 text-right">Transfer</th>
                    <th className="p-3.5 text-right">Total Omzet</th>
                    <th className="p-3.5">Keterangan & Dicatat Oleh</th>
                    {!isReadOnly && <th className="p-3.5 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecaps.length === 0 ? (
                    <tr>
                      <td colSpan={isReadOnly ? 8 : 9} className="p-10 text-center text-slate-400">
                        <div className="max-w-md mx-auto space-y-2">
                          <DollarSign className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="font-bold text-slate-700 text-sm">Belum Ada Rekapitulasi Omzet</p>
                          <p className="text-xs text-slate-400">
                            {isOwner
                              ? "Belum ada catatan omzet yang dimasukkan kasir untuk periode yang dipilih."
                              : 'Klik tombol "Catat Omzet Harian" di atas untuk mulai memasukkan omzet kasir harian Anda.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecaps.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              item.shift === "PAGI"
                                ? "bg-amber-100 text-amber-800"
                                : item.shift === "SORE"
                                ? "bg-orange-100 text-orange-800"
                                : item.shift === "MALAM"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.shift || "ALL"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-emerald-600">
                          {formatCurrency(item.cashAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-sky-600">
                          {formatCurrency(item.qrisAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-indigo-600">
                          {formatCurrency(item.edcAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-purple-600">
                          {formatCurrency(item.transferAmount)}
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(item.totalAmount)}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          <div className="truncate max-w-[220px] font-medium" title={item.notes || "-"}>
                            {item.notes || "-"}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Oleh: {item.recordedBy || "Kasir"}
                          </span>
                        </td>
                        {!isReadOnly && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleDeleteRecap(item.id, item.date, item.totalAmount)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Hapus Rekap Omzet"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredRecaps.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <DollarSign className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700 text-sm">Belum Ada Rekapitulasi</p>
                  <p className="text-xs text-slate-400">
                    Belum ada data omzet harian yang tersimpan.
                  </p>
                </div>
              ) : (
                filteredRecaps.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {new Date(item.date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.shift === "PAGI"
                              ? "bg-amber-100 text-amber-800"
                              : item.shift === "SORE"
                              ? "bg-orange-100 text-orange-800"
                              : item.shift === "MALAM"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          Shift {item.shift || "ALL"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Omzet</p>
                        <p className="text-base font-black text-slate-900">
                          {formatCurrency(item.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Breakdown 2x2 Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 font-bold block">Cash (Tunai)</span>
                        <span className="font-black text-emerald-600">{formatCurrency(item.cashAmount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                        <span className="text-[10px] text-sky-800 font-bold block">QRIS</span>
                        <span className="font-black text-sky-600">{formatCurrency(item.qrisAmount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100">
                        <span className="text-[10px] text-indigo-800 font-bold block">Mesin EDC</span>
                        <span className="font-black text-indigo-600">{formatCurrency(item.edcAmount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-purple-50/60 border border-purple-100">
                        <span className="text-[10px] text-purple-800 font-bold block">Transfer</span>
                        <span className="font-black text-purple-600">{formatCurrency(item.transferAmount)}</span>
                      </div>
                    </div>

                    {/* Footer Info & Delete */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div className="truncate mr-2">
                        {item.notes ? (
                          <span className="italic font-medium text-slate-600">{item.notes}</span>
                        ) : (
                          <span className="text-slate-400">Tanpa catatan</span>
                        )}
                        <span className="block text-[10px] text-slate-400">Dicatat: {item.recordedBy || "Kasir"}</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDeleteRecap(item.id, item.date, item.totalAmount)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ARSIP STRUK POS ────────────────────────────────────────── */}
      {activeTab === "pos_orders" && (
        <div className="space-y-6">
          {/* 4 Bento KPI Cards for POS Orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Omzet POS */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 text-white border border-white/10 shadow-xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-300 border border-white/10 flex items-center gap-1.5">
                    <Receipt className="w-3 h-3 text-brand-400" />
                    Total Omzet POS
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-300">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {formatCurrency(posSummary.totalRevenue)}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 font-medium">
                    {posSummary.paidCount} Transaksi Sukses Lunas
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Pajak Resto PB1 */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-sky-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70">
                  Pajak Resto (PB1)
                </span>
                <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-sky-600 tracking-tight">
                {formatCurrency(posSummary.totalTax)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Kewajiban Pajak Daerah
              </p>
            </div>

            {/* Card 3: Total Diskon Promo */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-rose-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/70">
                  Total Diskon Promo
                </span>
                <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                {formatCurrency(posSummary.totalDiscount)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Potongan Kupon & Diskon Kasir
              </p>
            </div>

            {/* Card 4: Status Pesanan */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/70">
                  Status Pesanan
                </span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Store className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold mt-1">
                <span className="text-emerald-600">{posSummary.paidCount} Lunas</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-600">{posSummary.openCount} Open</span>
                <span className="text-slate-300">•</span>
                <span className="text-rose-600">{posSummary.voidCount} Void</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Total {posOrders.length} Pesanan Kasir
              </p>
            </div>
          </div>

          {/* Filter Bar POS */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 sm:flex-none">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari No. Struk, Kasir, atau Meja..."
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white transition"
                />
              </div>

              {/* Status Filter */}
              <select
                value={posStatusFilter}
                onChange={(e) => setPosStatusFilter(e.target.value)}
                className="px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="PAID">Lunas (PAID)</option>
                <option value="OPEN">Open Bill</option>
                <option value="VOID">Batal / Void</option>
              </select>

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={posStartDate}
                  onChange={(e) => setPosStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-700 focus:outline-none focus:border-brand-500"
                />
                <span>s/d</span>
                <input
                  type="date"
                  value={posEndDate}
                  onChange={(e) => setPosEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-700 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              onClick={fetchPosOrders}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-brand-600 ${isLoadingPosOrders ? "animate-spin" : ""}`} />
              <span>Refresh Arsip</span>
            </button>
          </div>

          {/* Dual-View Data: Tabel & Card Feed Struk POS */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Arsip Struk Transaksi Kasir POS
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Total <strong>{filteredPosOrders.length}</strong> transaksi
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">No. Struk</th>
                    <th className="p-3.5">Waktu</th>
                    <th className="p-3.5">Tipe / Meja</th>
                    <th className="p-3.5">Kasir</th>
                    <th className="p-3.5 text-right">Subtotal</th>
                    <th className="p-3.5 text-right">Diskon</th>
                    <th className="p-3.5 text-right">Pajak PB1</th>
                    <th className="p-3.5 text-right">Total Akhir</th>
                    <th className="p-3.5">Metode</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingPosOrders ? (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2.5">
                          <RotateCcw className="w-5 h-5 animate-spin text-brand-600" />
                          <span className="font-semibold text-sm">Memuat daftar transaksi POS...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPosOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700">Tidak ada arsip transaksi POS yang cocok</p>
                        <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter status atau rentang tanggal.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPosOrders.map((ord) => {
                      const pay = ord.payments?.[0];
                      const payMethod = pay?.paymentMethod || "CASH";

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-slate-900">
                            #{ord.receiptNo}
                          </td>
                          <td className="p-3.5 text-slate-600 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                ord.orderType === "DINE_IN"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {ord.orderType === "DINE_IN"
                                ? `Dine In ${ord.tableNumber ? `(M-${ord.tableNumber})` : ""}`
                                : "Takeaway"}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            {ord.cashierName || "-"}
                          </td>
                          <td className="p-3.5 text-right font-medium text-slate-600">
                            {formatCurrency(ord.subtotal)}
                          </td>
                          <td className="p-3.5 text-right font-medium text-rose-600">
                            {ord.discountAmount ? `-${formatCurrency(ord.discountAmount)}` : "-"}
                          </td>
                          <td className="p-3.5 text-right font-medium text-sky-600">
                            {ord.taxAmount ? `+${formatCurrency(ord.taxAmount)}` : "-"}
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                            {formatCurrency(ord.totalAmount)}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <span className="font-bold text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                              {payMethod}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                ord.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ord.status === "OPEN"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setSelectedOrderForDetail(ord)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {isLoadingPosOrders ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5 animate-spin text-brand-600" />
                  <span className="font-semibold text-xs">Memuat struk POS...</span>
                </div>
              ) : filteredPosOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="font-bold text-slate-700 text-xs">Tidak ada struk ditemukan</p>
                </div>
              ) : (
                filteredPosOrders.map((ord) => {
                  const pay = ord.payments?.[0];
                  const payMethod = pay?.paymentMethod || "CASH";

                  return (
                    <div
                      key={ord.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono font-black text-sm text-slate-900">
                            #{ord.receiptNo}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.orderType === "DINE_IN"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {ord.orderType === "DINE_IN"
                                ? `Dine In ${ord.tableNumber ? `(M-${ord.tableNumber})` : ""}`
                                : "Takeaway"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ord.status === "OPEN"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Akhir</p>
                          <p className="text-base font-black text-slate-900">
                            {formatCurrency(ord.totalAmount)}
                          </p>
                          <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            {payMethod}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <div>
                          <span className="block font-medium text-slate-700">
                            Kasir: {ord.cashierName || "-"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedOrderForDetail(ord)}
                          className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail Struk</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: DATA ITEM PENJUALAN ───────────────────────────────────── */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          {/* Top Actions for Sales Item Tab */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Menu Terjual..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSales}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                title="Unduh Data Penjualan Menu ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel (.xlsx)</span>
              </button>

              {!isReadOnly && (
                <div className="flex items-center">
                  <CsvImportExport
                    onImport={handleSalesImport}
                    templateHeaders={["Tanggal", "Nama Menu", "Quantity", "Total Penjualan"]}
                    templateExampleRow={[
                      new Date().toISOString().slice(0, 10),
                      products && products.length > 0 ? products[0].name : "Kopi Susu Gula Aren",
                      "45",
                      "990000",
                    ]}
                    templateFilename="Template_Import_Penjualan_Menu.xlsx"
                    buttonLabel="Import Excel / CSV Penjualan"
                    currentData={salesTransactions.slice(0, 50).map((s) => ({
                      id: s.id,
                      Tanggal: s.date.slice(0, 10),
                      "Nama Menu": s.menuName,
                      Quantity: s.quantitySold,
                      "Total Penjualan": s.totalPrice,
                    }))}
                    templateDropdowns={{
                      "Nama Menu":
                        products && products.length > 0
                          ? Array.from(new Set(products.map((p) => p.name)))
                          : ["Kopi Susu Gula Aren", "Cafe Latte", "Iced Americano", "Butter Croissant"],
                    }}
                    templateColumnTypes={{
                      Tanggal: "date",
                      Quantity: "integer",
                      "Total Penjualan": "number",
                    }}
                    templateHints={{
                      Tanggal: "Format tanggal penjualan: YYYY-MM-DD (contoh: 2026-10-18)",
                      "Nama Menu": "Pilih menu kopi atau makanan dari dropdown produk",
                      Quantity: "Jumlah cup / porsi yang terjual",
                      "Total Penjualan": "Total nominal uang penjualan (angka bulat tanpa titik/koma)",
                    }}
                    templateInstructions={[
                      "Gunakan template ini untuk merekap penjualan jika coffee shop menggunakan POS eksternal atau catatan harian.",
                      "Kolom 'Nama Menu' sudah dilengkapi dropdown pilihan produk kafe.",
                      "Kolom 'Total Penjualan' diisi total omzet rupiah dari menu tersebut.",
                      "Setelah disimpan, data akan otomatis masuk ke Laporan Penjualan dan Laba Rugi Finance.",
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dual-View Data: Item Penjualan */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Mutasi Item Penjualan
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Total <strong>{filteredSales.length}</strong> baris penjualan
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Nama Menu</th>
                    <th className="p-3.5 text-right">Quantity Terjual</th>
                    <th className="p-3.5 text-right">Total Penjualan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-400">
                        <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700">Tidak ada data penjualan menu</p>
                        <p className="text-xs text-slate-400 mt-1">Silakan gunakan Terminal POS atau import file Excel penjualan.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                          {new Date(sale.date).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {sale.menuName}
                        </td>
                        <td className="p-3.5 text-right font-bold text-brand-700">
                          <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70">
                            {sale.quantitySold} porsi
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(sale.totalPrice)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredSales.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="font-bold text-slate-700 text-xs">Belum ada item terjual</p>
                </div>
              ) : (
                filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {sale.menuName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(sale.date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-slate-900">
                          {formatCurrency(sale.totalPrice)}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/70">
                          {sale.quantitySold} porsi
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: RIWAYAT IMPORT CSV ─────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Log Riwayat Import Excel / CSV
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total <strong>{filteredLogs.length}</strong> riwayat
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Tanggal Import</th>
                  <th className="p-3.5">Nama File</th>
                  <th className="p-3.5 text-center">Jumlah Baris</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Diimport Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">
                      <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Belum ada riwayat import file</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                        {new Date(log.importDate).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                        <span>{log.fileName}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-800">
                        {log.rowCount} baris
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">
                        {log.createdBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Feed View */}
          <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                <p className="font-bold text-slate-700 text-xs">Belum ada riwayat import</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />
                        {log.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.importDate).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <span>Jumlah: {log.rowCount} baris</span>
                    <span>Oleh: {log.createdBy}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DETAIL STRUK TRANSAKSI POS ─────────────────────────────── */}
      <AnimatePresence>
        {selectedOrderForDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="my-auto bg-white rounded-3xl border border-slate-200/80 w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh]"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 shadow-2xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      Detail Nota POS #{selectedOrderForDetail.receiptNo}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Kasir: {selectedOrderForDetail.cashierName || "Kasir"} •{" "}
                      {new Date(selectedOrderForDetail.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1 text-xs">
                {/* Status & Meja */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Tipe Pesanan</p>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {selectedOrderForDetail.orderType === "DINE_IN"
                        ? `Dine In ${selectedOrderForDetail.tableNumber ? `(Meja ${selectedOrderForDetail.tableNumber})` : ""}`
                        : "Takeaway"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Status Bayar</p>
                    <span
                      className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedOrderForDetail.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedOrderForDetail.status === "OPEN"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {selectedOrderForDetail.status}
                    </span>
                  </div>
                </div>

                {/* Info VOID jika pesanan dibatalkan */}
                {selectedOrderForDetail.status === "VOID" && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-xs text-rose-700">
                      <AlertCircle className="w-4 h-4" />
                      <span>Transaksi Dibatalkan (VOID)</span>
                    </p>
                    <p className="text-[11px]">
                      Alasan: {selectedOrderForDetail.voidReason || "-"}
                    </p>
                    <p className="text-[11px]">
                      Disetujui oleh: {selectedOrderForDetail.voidApprovedBy || "Manager"}
                    </p>
                  </div>
                )}

                {/* Rincian Item Pesanan */}
                <div>
                  <p className="font-bold text-slate-700 text-xs mb-2">Item Pesanan</p>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {selectedOrderForDetail.items?.map((it) => {
                      let mods: any[] = [];
                      try {
                        mods = typeof it.modifiers === "string" ? JSON.parse(it.modifiers) : it.modifiers || [];
                      } catch {}

                      return (
                        <div key={it.id} className="p-3.5 flex justify-between items-start bg-white">
                          <div>
                            <p className="font-bold text-slate-900 text-xs">
                              {it.menuName}{" "}
                              <span className="text-slate-500 font-normal">
                                x{it.quantity}
                              </span>
                            </p>
                            {it.variantName && it.variantName !== "Regular" && (
                              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                Varian: {it.variantName}
                              </p>
                            )}
                            {mods.length > 0 && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Modifier: {mods.map((m: any) => m.name).join(", ")}
                              </p>
                            )}
                            {it.notes && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5">
                                Catatan: {it.notes}
                              </p>
                            )}
                          </div>
                          <p className="font-black text-slate-900 text-xs">
                            {formatCurrency(it.subtotal)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ringkasan Biaya Subtotal, Diskon, PB1, Total */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Menu:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedOrderForDetail.subtotal)}</span>
                  </div>
                  {Number(selectedOrderForDetail.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Diskon Promosi:</span>
                      <span>-{formatCurrency(selectedOrderForDetail.discountAmount || 0)}</span>
                    </div>
                  )}
                  {Number(selectedOrderForDetail.taxAmount) > 0 && (
                    <div className="flex justify-between text-sky-600 font-semibold">
                      <span>Pajak Restoran (PB1):</span>
                      <span>+{formatCurrency(selectedOrderForDetail.taxAmount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-slate-900 pt-2.5 border-t border-slate-200 text-sm">
                    <span>Total Pembayaran:</span>
                    <span className="text-base text-brand-700">{formatCurrency(selectedOrderForDetail.totalAmount)}</span>
                  </div>
                </div>

                {/* Rincian Pembayaran Kasir */}
                {selectedOrderForDetail.payments && selectedOrderForDetail.payments.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <p className="font-bold text-slate-700 text-xs mb-1">Rincian Pembayaran</p>
                    {selectedOrderForDetail.payments.map((p) => (
                      <div key={p.id} className="space-y-1 text-slate-600 text-[11px]">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>Metode: {p.paymentMethod}</span>
                          <span>{formatCurrency(p.amount)}</span>
                        </div>
                        {p.paymentMethod === "CASH" && (
                          <>
                            <div className="flex justify-between text-slate-500">
                              <span>Uang Diterima:</span>
                              <span>{formatCurrency(p.cashReceived || 0)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-600 font-bold">
                              <span>Kembalian:</span>
                              <span>{formatCurrency(p.changeAmount || 0)}</span>
                            </div>
                          </>
                        )}
                        {p.referenceNo && (
                          <div className="flex justify-between text-slate-500">
                            <span>No. Ref / Auth:</span>
                            <span className="font-mono">{p.referenceNo}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <button
                  onClick={handlePrintReceipt}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Nota</span>
                </button>

                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL CATAT OMZET HARIAN ────────────────────────────────────── */}
      <AnimatePresence>
        {isAddRecapOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="my-auto bg-white rounded-3xl border border-slate-200/80 w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-brand-600 text-white shadow-xs">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Catat Omzet Harian Toko
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Input total penerimaan kasir per metode pembayaran
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddRecapOpen(false)}
                  className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRecap} className="flex flex-col flex-1 overflow-hidden text-xs">
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Tanggal Penjualan
                    </label>
                    <input
                      type="date"
                      required
                      value={recapForm.date}
                      onChange={(e) => setRecapForm({ ...recapForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-medium text-base sm:text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Shift Operasional
                    </label>
                    <select
                      value={recapForm.shift}
                      onChange={(e) => setRecapForm({ ...recapForm, shift: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-medium text-base sm:text-xs cursor-pointer"
                    >
                      <option value="ALL">Semua Shift (Full Day)</option>
                      <option value="PAGI">Shift Pagi</option>
                      <option value="SORE">Shift Sore</option>
                      <option value="MALAM">Shift Malam</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">
                    Rincian Nominal per Metode Pembayaran
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Uang Tunai (Cash Fisik)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={recapForm.cashAmount}
                          onChange={(e) => setRecapForm({ ...recapForm, cashAmount: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
                        <QrCode className="w-3.5 h-3.5 text-sky-600" />
                        <span>QRIS (Statis / Dinamis)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={recapForm.qrisAmount}
                          onChange={(e) => setRecapForm({ ...recapForm, qrisAmount: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Mesin EDC (Debit / Kredit)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={recapForm.edcAmount}
                          onChange={(e) => setRecapForm({ ...recapForm, edcAmount: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Transfer Bank Langsung</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={recapForm.transferAmount}
                          onChange={(e) => setRecapForm({ ...recapForm, transferAmount: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Calculated Total */}
                <div className="p-4 rounded-2xl bg-brand-50/80 border border-brand-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-600 font-bold">Total Omzet Masuk:</span>
                    <p className="text-[11px] text-brand-700 font-medium">Otomatis dicatat ke Buku Kas & Bank</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-brand-700">
                      {formatCurrency(currentFormTotal)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Catatan / Keterangan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Ramai promo weekend, ada selisih kas fisik +Rp 2.000"
                    value={recapForm.notes}
                    onChange={(e) => setRecapForm({ ...recapForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 text-base sm:text-xs"
                  />
                </div>

                </div>

                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddRecapOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={currentFormTotal <= 0}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Simpan & Masukkan ke Kas</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
