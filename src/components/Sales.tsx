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
} from "lucide-react";
import { formatCurrency } from "../utils/format";

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
  const { salesTransactions, salesImportLogs, syncData, currentUser, settings } =
    useStore();
  const [activeTab, setActiveTab] = useState<"pos_orders" | "sales" | "logs">("pos_orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Tab Transaksi Kasir POS
  const [posOrders, setPosOrders] = useState<PosOrderDetail[]>([]);
  const [isLoadingPosOrders, setIsLoadingPosOrders] = useState(false);
  const [posStatusFilter, setPosStatusFilter] = useState<string>("ALL");
  const [posStartDate, setPosStartDate] = useState<string>("");
  const [posEndDate, setPosEndDate] = useState<string>("");
  const [posSearchQuery, setPosSearchQuery] = useState<string>("");
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<PosOrderDetail | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", currentUser?.id || "");

    try {
      const response = await fetch("/api/import/sales", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("node_session_id")}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: "success",
          message: `Berhasil import ${data.insertedCount} baris data penjualan.`,
        });
        await syncData();
      } else {
        setUploadStatus({
          type: "error",
          message: data.error || "Gagal import data.",
        });
      }
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: "Terjadi kesalahan jaringan.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar & Tab Navigasi ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("pos_orders")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "pos_orders"
                ? "bg-brand-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Transaksi Kasir POS</span>
            {posOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900/10 text-[11px] font-bold">
                {posOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "sales"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Data Item Penjualan
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "logs"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Riwayat Import CSV
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeTab === "sales" && (
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent w-full text-sm"
              />
            </div>
          )}

          {activeTab !== "pos_orders" && (
            <div>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shrink-0 disabled:opacity-50 text-sm font-medium"
              >
                {isUploading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import CSV Kasir
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            uploadStatus.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {uploadStatus.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium text-sm">{uploadStatus.message}</span>
        </div>
      )}

      {/* ── TAB 1: TRANSAKSI KASIR POS ───────────────────────────────────── */}
      {activeTab === "pos_orders" && (
        <div className="space-y-4">
          {/* 4 Kartu Metrik Ringkasan POS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Total Omzet POS
              </p>
              <h3 className="text-xl font-bold text-slate-900">
                {formatCurrency(posSummary.totalRevenue)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {posSummary.paidCount} Transaksi Sukses
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <Receipt className="w-4 h-4 text-sky-600" />
                Pajak Resto (PB1)
              </p>
              <h3 className="text-xl font-bold text-sky-600">
                {formatCurrency(posSummary.totalTax)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kewajiban Pajak Daerah
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Total Diskon Promo
              </p>
              <h3 className="text-xl font-bold text-rose-600">
                {formatCurrency(posSummary.totalDiscount)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Potongan Harga Kasir
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <Store className="w-4 h-4 text-amber-600" />
                Status Pesanan
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                <span className="text-emerald-600">{posSummary.paidCount} Lunas</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-600">{posSummary.openCount} Open Bill</span>
                <span className="text-slate-300">•</span>
                <span className="text-rose-600">{posSummary.voidCount} Void</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total {posOrders.length} Pesanan Terdaftar
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari No. Struk, Kasir, atau Meja..."
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>

              {/* Status Filter */}
              <select
                value={posStatusFilter}
                onChange={(e) => setPosStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="PAID">Lunas (PAID)</option>
                <option value="OPEN">Open Bill</option>
                <option value="VOID">Batal / Void</option>
              </select>

              {/* Date Filters */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <input
                  type="date"
                  value={posStartDate}
                  onChange={(e) => setPosStartDate(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
                />
                <span>s/d</span>
                <input
                  type="date"
                  value={posEndDate}
                  onChange={(e) => setPosEndDate(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={fetchPosOrders}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoadingPosOrders ? "animate-spin" : ""}`} />
              <span>Refresh Data</span>
            </button>
          </div>

          {/* Tabel Transaksi POS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">No. Struk</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Tipe / Meja</th>
                    <th className="p-3">Kasir</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">Diskon</th>
                    <th className="p-3 text-right">Pajak PB1</th>
                    <th className="p-3 text-right">Total Akhir</th>
                    <th className="p-3">Metode</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingPosOrders ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RotateCcw className="w-5 h-5 animate-spin text-amber-500" />
                          <span>Memuat daftar transaksi POS...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPosOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        Tidak ada transaksi POS yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPosOrders.map((ord) => {
                      const pay = ord.payments?.[0];
                      const payMethod = pay?.paymentMethod || "CASH";

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-800">
                            #{ord.receiptNo}
                          </td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3 text-slate-700">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                ord.orderType === "DINE_IN"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {ord.orderType === "DINE_IN"
                                ? `Dine In ${ord.tableNumber ? `(Meja ${ord.tableNumber})` : ""}`
                                : "Takeaway"}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {ord.cashierName || "-"}
                          </td>
                          <td className="p-3 text-right text-slate-600">
                            {formatCurrency(ord.subtotal)}
                          </td>
                          <td className="p-3 text-right text-rose-600">
                            {ord.discountAmount ? `-${formatCurrency(ord.discountAmount)}` : "-"}
                          </td>
                          <td className="p-3 text-right text-sky-600">
                            {ord.taxAmount ? `+${formatCurrency(ord.taxAmount)}` : "-"}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {formatCurrency(ord.totalAmount)}
                          </td>
                          <td className="p-3 text-slate-700">
                            <span className="font-semibold text-[11px]">
                              {payMethod}
                            </span>
                          </td>
                          <td className="p-3 text-center">
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
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedOrderForDetail(ord)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Detail Struk</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: DATA ITEM PENJUALAN (LEGACY/IMPORT) ────────────────────── */}
      {activeTab === "sales" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                  <th className="p-4 font-semibold text-slate-600">Nama Menu</th>
                  <th className="p-4 font-semibold text-slate-600 text-right">
                    Quantity
                  </th>
                  <th className="p-4 font-semibold text-slate-600 text-right">
                    Total Penjualan
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-4 text-slate-800">
                      {new Date(sale.date).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="p-4 font-medium text-slate-800">
                      {sale.menuName}
                    </td>
                    <td className="p-4 text-slate-800 text-right">
                      {sale.quantitySold}
                    </td>
                    <td className="p-4 text-slate-800 text-right font-medium">
                      {formatCurrency(sale.totalPrice)}
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Tidak ada data penjualan. Silakan gunakan Terminal POS atau import CSV kasir.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: RIWAYAT IMPORT CSV ─────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">Tanggal Import</th>
                  <th className="p-4 font-semibold text-slate-600">Nama File</th>
                  <th className="p-4 font-semibold text-slate-600 text-center">
                    Jumlah Baris
                  </th>
                  <th className="p-4 font-semibold text-slate-600">Status</th>
                  <th className="p-4 font-semibold text-slate-600">Diimport Oleh</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-slate-800">
                      {new Date(log.importDate).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 text-slate-800 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                      {log.fileName}
                    </td>
                    <td className="p-4 text-slate-800 text-center">{log.rowCount}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{log.createdBy}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Belum ada riwayat import CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL DETAIL STRUK TRANSAKSI POS ─────────────────────────────── */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Detail Nota POS #{selectedOrderForDetail.receiptNo}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kasir: {selectedOrderForDetail.cashierName || "Kasir"} •{" "}
                    {new Date(selectedOrderForDetail.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Status & Meja */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-500">Tipe Pesanan</p>
                  <p className="font-bold text-slate-800">
                    {selectedOrderForDetail.orderType === "DINE_IN"
                      ? `Dine In ${selectedOrderForDetail.tableNumber ? `(Meja ${selectedOrderForDetail.tableNumber})` : ""}`
                      : "Takeaway"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Status Pembayaran</p>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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

              {/* Info VOID jika dibatalkan */}
              {selectedOrderForDetail.status === "VOID" && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
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
                <p className="font-bold text-slate-700 mb-2">Item Pesanan</p>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {selectedOrderForDetail.items?.map((it) => {
                    let mods: any[] = [];
                    try {
                      mods = typeof it.modifiers === "string" ? JSON.parse(it.modifiers) : it.modifiers || [];
                    } catch {}

                    return (
                      <div key={it.id} className="p-3 flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800">
                            {it.menuName}{" "}
                            <span className="text-slate-500 font-normal">
                              x{it.quantity}
                            </span>
                          </p>
                          {it.variantName && it.variantName !== "Regular" && (
                            <p className="text-[10px] text-amber-600 font-medium">
                              Varian: {it.variantName}
                            </p>
                          )}
                          {mods.length > 0 && (
                            <p className="text-[10px] text-slate-500">
                              {mods.map((m: any) => m.name).join(", ")}
                            </p>
                          )}
                          {it.notes && (
                            <p className="text-[10px] text-slate-400 italic">
                              Catatan: {it.notes}
                            </p>
                          )}
                        </div>
                        <p className="font-bold text-slate-800">
                          {formatCurrency(it.subtotal)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ringkasan Biaya */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrderForDetail.subtotal)}</span>
                </div>
                {Number(selectedOrderForDetail.discountAmount) > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Diskon:</span>
                    <span>-{formatCurrency(selectedOrderForDetail.discountAmount || 0)}</span>
                  </div>
                )}
                {Number(selectedOrderForDetail.taxAmount) > 0 && (
                  <div className="flex justify-between text-sky-600">
                    <span>Pajak Resto (PB1):</span>
                    <span>+{formatCurrency(selectedOrderForDetail.taxAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 text-sm">
                  <span>Total Pembayaran:</span>
                  <span>{formatCurrency(selectedOrderForDetail.totalAmount)}</span>
                </div>
              </div>

              {/* Rincian Pembayaran */}
              {selectedOrderForDetail.payments && selectedOrderForDetail.payments.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-700 mb-1">Rincian Pembayaran</p>
                  {selectedOrderForDetail.payments.map((p) => (
                    <div key={p.id} className="space-y-0.5 text-slate-600 text-[11px]">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Metode: {p.paymentMethod}</span>
                        <span>{formatCurrency(p.amount)}</span>
                      </div>
                      {p.paymentMethod === "CASH" && (
                        <>
                          <div className="flex justify-between text-slate-500">
                            <span>Uang Diterima:</span>
                            <span>{formatCurrency(p.cashReceived || 0)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Kembalian:</span>
                            <span>{formatCurrency(p.changeAmount || 0)}</span>
                          </div>
                        </>
                      )}
                      {p.referenceNo && (
                        <div className="flex justify-between text-slate-500">
                          <span>No. Referensi / Auth:</span>
                          <span className="font-mono">{p.referenceNo}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
