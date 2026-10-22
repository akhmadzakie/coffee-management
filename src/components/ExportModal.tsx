import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/StoreContext";
import {
  X,
  Download,
  FileText,
  Table,
  Calendar,
  ReceiptText,
  Warehouse,
  Wallet,
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  UserCheck,
  Award,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { getLocalDateString } from "../utils/dateUtils";
import { formatCurrency } from "../utils/format";
import {
  exportSalesToCSV,
  exportSalesToPDF,
  exportInventoryToCSV,
  exportInventoryToPDF,
  exportFinanceToCSV,
  exportFinanceToPDF,
  exportPayrollToPDF,
  exportPayrollToCSV,
  exportAttendanceToPDF,
  exportAttendanceToCSV,
  exportKpiToPDF,
  exportKpiToCSV,
  exportMasterExecutiveReportPDF,
  exportToCSV,
  filterByDateRange,
  formatDateIndo,
} from "../utils/export";
import {
  exportFinanceToXlsx,
  exportSalesToXlsx,
  exportInventoryToXlsx,
  exportPayrollToXlsx,
  exportAttendanceToXlsx,
  exportKpiToXlsx,
  exportMasterExecutiveReportXlsx,
} from "../utils/exportXlsx";
import { ImportFinanceModal } from "./ImportFinanceModal";
import { CustomDatePicker } from "./common/CustomDatePicker";

export type ExportModuleType =
  | "all_in_one"
  | "sales"
  | "inventory"
  | "finance"
  | "payroll"
  | "attendance"
  | "kpi";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: ExportModuleType | "executive";
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  defaultModule = "sales",
}) => {
  const {
    currentUser,
    salesTransactions,
    ingredients,
    stockMovements,
    cashTransactions,
    payrollRecords,
    dailyAttendances,
    kpiRecords,
    employees,
    settings,
    expenseCategories,
  } = useStore();
  const isIndo = settings.language === "id";

  const canAccessExport = Boolean(
    currentUser &&
      ["OWNER", "MANAGER", "FINANCE", "SUPER_ADMIN"].includes(currentUser.role)
  );

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ExportModuleType>(
    defaultModule === "executive" ? "all_in_one" : (defaultModule as ExportModuleType) || "all_in_one"
  );
  const [datePreset, setDatePreset] = useState<
    | "ALL"
    | "TODAY"
    | "LAST_7_DAYS"
    | "THIS_MONTH"
    | "LAST_MONTH"
    | "THIS_YEAR"
    | "CUSTOM"
  >("THIS_MONTH");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  React.useEffect(() => {
    if (isOpen && defaultModule) {
      setActiveModule(defaultModule === "executive" ? "all_in_one" : (defaultModule as ExportModuleType));
    }
  }, [isOpen, defaultModule]);

  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    if (datePreset === "TODAY") {
      const todayStr = getLocalDateString(now);
      return {
        startDate: todayStr,
        endDate: todayStr,
        periodLabel: isIndo
          ? `Hari Ini (${formatDateIndo(now)})`
          : `Today (${formatDateIndo(now)})`,
      };
    }
    if (datePreset === "LAST_7_DAYS") {
      const start = new Date();
      start.setDate(now.getDate() - 6);
      return {
        startDate: getLocalDateString(start),
        endDate: getLocalDateString(now),
        periodLabel: isIndo ? "7 Hari Terakhir" : "Last 7 Days",
      };
    }
    if (datePreset === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: getLocalDateString(start),
        endDate: getLocalDateString(end),
        periodLabel: isIndo ? `Bulan Ini` : `This Month`,
      };
    }
    if (datePreset === "LAST_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: getLocalDateString(start),
        endDate: getLocalDateString(end),
        periodLabel: isIndo ? `Bulan Lalu` : `Last Month`,
      };
    }
    if (datePreset === "THIS_YEAR") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return {
        startDate: getLocalDateString(start),
        endDate: getLocalDateString(end),
        periodLabel: isIndo ? `Tahun Ini` : `This Year`,
      };
    }
    if (datePreset === "CUSTOM") {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
        periodLabel:
          customStartDate && customEndDate
            ? `${formatDateIndo(customStartDate)} s/d ${formatDateIndo(customEndDate)}`
            : isIndo
              ? "Kustom"
              : "Custom",
      };
    }
    return {
      startDate: undefined,
      endDate: undefined,
      periodLabel: isIndo ? "Semua Waktu" : "All Time",
    };
  }, [datePreset, customStartDate, customEndDate, isIndo]);

  // ─── Filtered Data per Module ───────────────────────────────────────────────
  const filteredSales = useMemo(
    () => filterByDateRange(salesTransactions, startDate, endDate),
    [salesTransactions, startDate, endDate]
  );

  const filteredInventoryTrx = useMemo(
    () => filterByDateRange(stockMovements, startDate, endDate),
    [stockMovements, startDate, endDate]
  );

  const filteredFinance = useMemo(
    () => filterByDateRange(cashTransactions, startDate, endDate),
    [cashTransactions, startDate, endDate]
  );

  const filteredPayroll = useMemo(() => {
    return (payrollRecords || []).filter((p) => {
      if (!startDate && !endDate) return true;
      if (startDate && p.period < startDate.slice(0, 7)) return false;
      if (endDate && p.period > endDate.slice(0, 7)) return false;
      return true;
    });
  }, [payrollRecords, startDate, endDate]);

  const filteredAttendance = useMemo(() => {
    return filterByDateRange(dailyAttendances || [], startDate, endDate);
  }, [dailyAttendances, startDate, endDate]);

  const filteredKpi = useMemo(() => {
    return (kpiRecords || []).filter((k) => {
      const kPeriod = k.period || `${k.year}-${String(k.month).padStart(2, "0")}`;
      if (!startDate && !endDate) return true;
      if (startDate && kPeriod < startDate.slice(0, 7)) return false;
      if (endDate && kPeriod > endDate.slice(0, 7)) return false;
      return true;
    });
  }, [kpiRecords, startDate, endDate]);

  if (!canAccessExport) return null;

  // ─── Export Triggers ────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (activeModule === "all_in_one") {
      exportMasterExecutiveReportPDF({
        sales: filteredSales,
        finance: filteredFinance,
        ingredients,
        payroll: filteredPayroll,
        attendances: filteredAttendance,
        kpiRecords: filteredKpi,
        employees,
        settings,
        periodLabel,
      });
    } else if (activeModule === "sales") {
      exportSalesToPDF({ sales: filteredSales, settings, periodLabel });
    } else if (activeModule === "inventory") {
      exportInventoryToPDF({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
        periodLabel,
      });
    } else if (activeModule === "finance") {
      exportFinanceToPDF({ finance: filteredFinance, settings, periodLabel });
    } else if (activeModule === "payroll") {
      exportPayrollToPDF({
        payroll: filteredPayroll,
        employees,
        settings,
        periodLabel,
      });
    } else if (activeModule === "attendance") {
      exportAttendanceToPDF({
        attendances: filteredAttendance,
        employees,
        settings,
        periodLabel,
      });
    } else if (activeModule === "kpi") {
      exportKpiToPDF({
        kpiRecords: filteredKpi,
        employees,
        settings,
        periodLabel,
      });
    }
  };

  const handleExportCSV = () => {
    if (activeModule === "all_in_one") {
      const totalGrossSales = filteredSales.reduce((sum, s) => sum + (s.subtotal || s.total || 0), 0);
      const totalNetSales = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const totalCashIn = filteredFinance
        .filter((f) => f.type === "CASH_IN" || (f as any).type === "IN")
        .reduce((sum, f) => sum + (f.amount || 0), 0);
      const totalCashOut = filteredFinance
        .filter((f) => f.type === "CASH_OUT" || (f as any).type === "OUT")
        .reduce((sum, f) => sum + (f.amount || 0), 0);
      const totalPayroll = filteredPayroll.reduce((sum, p) => sum + (p.netPay || 0), 0);

      const summaryRows = [
        { "Indikator Eksekutif": "Periode Laporan", "Nilai / Jumlah": periodLabel },
        { "Indikator Eksekutif": "Total Penjualan Kotor (Gross Sales)", "Nilai / Jumlah": totalGrossSales },
        { "Indikator Eksekutif": "Total Penjualan Bersih (Net Sales)", "Nilai / Jumlah": totalNetSales },
        { "Indikator Eksekutif": "Total Transaksi Penjualan (Struk)", "Nilai / Jumlah": filteredSales.length },
        { "Indikator Eksekutif": "Total Kas Masuk Non-Kasir (In)", "Nilai / Jumlah": totalCashIn },
        { "Indikator Eksekutif": "Total Pengeluaran Kas (Out)", "Nilai / Jumlah": totalCashOut },
        { "Indikator Eksekutif": "Total Beban Gaji Karyawan (Payroll)", "Nilai / Jumlah": totalPayroll },
        { "Indikator Eksekutif": "Total Item Bahan Baku di Gudang", "Nilai / Jumlah": ingredients.length },
        { "Indikator Eksekutif": "Total Catatan Mutasi Stok", "Nilai / Jumlah": filteredInventoryTrx.length },
        { "Indikator Eksekutif": "Total Rekap Kehadiran Karyawan", "Nilai / Jumlah": filteredAttendance.length },
        { "Indikator Eksekutif": "Total Evaluasi Kinerja KPI", "Nilai / Jumlah": filteredKpi.length },
      ];
      exportToCSV(`Ringkasan_Eksekutif_${periodLabel.replace(/\s+/g, "_")}`, summaryRows);
    } else if (activeModule === "sales") {
      exportSalesToCSV({ sales: filteredSales, settings });
    } else if (activeModule === "inventory") {
      exportInventoryToCSV({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
      });
    } else if (activeModule === "finance") {
      exportFinanceToCSV({ finance: filteredFinance, settings });
    } else if (activeModule === "payroll") {
      exportPayrollToCSV({ payroll: filteredPayroll, employees });
    } else if (activeModule === "attendance") {
      exportAttendanceToCSV({ attendances: filteredAttendance, employees });
    } else if (activeModule === "kpi") {
      exportKpiToCSV({ kpiRecords: filteredKpi, employees });
    }
  };

  const handleExportXlsx = () => {
    if (activeModule === "all_in_one") {
      exportMasterExecutiveReportXlsx({
        sales: filteredSales,
        finance: filteredFinance,
        ingredients,
        movements: filteredInventoryTrx,
        payroll: filteredPayroll,
        attendances: filteredAttendance,
        kpiRecords: filteredKpi,
        employees,
        settings,
        periodLabel,
        expenseCategories,
      });
    } else if (activeModule === "sales") {
      exportSalesToXlsx({ sales: filteredSales, settings, periodLabel });
    } else if (activeModule === "inventory") {
      exportInventoryToXlsx({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
        periodLabel,
      });
    } else if (activeModule === "finance") {
      exportFinanceToXlsx({
        finance: filteredFinance,
        settings,
        periodLabel,
        expenseCategories,
      });
    } else if (activeModule === "payroll") {
      exportPayrollToXlsx({
        payroll: filteredPayroll,
        employees,
        settings,
        periodLabel,
      });
    } else if (activeModule === "attendance") {
      exportAttendanceToXlsx({
        attendances: filteredAttendance,
        employees,
        settings,
        periodLabel,
      });
    } else if (activeModule === "kpi") {
      exportKpiToXlsx({
        kpiRecords: filteredKpi,
        employees,
        settings,
        periodLabel,
      });
    }
  };

  return (
    <>
      <ImportFinanceModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="export-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
          >
            <motion.div
              key="export-modal-card"
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] my-auto"
            >
              {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  Pusat Ekspor & Laporan Bisnis
                </h3>
                <p className="text-xs text-slate-400">
                  Unduh data operasional, keuangan, SDM, dan performa kafe ke format Excel (.xlsx), CSV, atau PDF.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
            {/* 1. Pilih Modul Laporan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                1. Pilih Jenis Laporan
              </label>

              {/* Master All-in-One Option */}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setActiveModule("all_in_one")}
                  className={`w-full p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                    activeModule === "all_in_one"
                      ? "border-brand-600 bg-gradient-to-r from-brand-50 via-brand-100/40 to-indigo-50/50 ring-2 ring-brand-500/40 text-brand-950 shadow-md"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/20 text-slate-700"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                        activeModule === "all_in_one"
                          ? "bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-brand-500/25"
                          : "bg-brand-50 border border-brand-200/80 text-brand-600"
                      }`}
                    >
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                          Laporan Master Komprehensif (All-in-One)
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-600 text-white uppercase tracking-wider shadow-2xs">
                          👑 Rekomendasi Owner / Atasan
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Satukan seluruh 6 modul laporan dalam <strong>1 File Excel Multi-Sheet (7 Sheet Terpisah)</strong> atau <strong>1 Berkas PDF Eksekutif</strong> siap cetak.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {activeModule === "all_in_one" ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-200/60 px-3 py-1 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" /> Terpilih
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
                        Pilih Ini
                      </span>
                    )}
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2 my-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="h-px bg-slate-200 flex-1" />
                <span>Atau Pilih Laporan Spesifik Per Modul</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Penjualan */}
                <button
                  onClick={() => setActiveModule("sales")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    activeModule === "sales"
                      ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <ReceiptText
                      className={`w-5 h-5 ${activeModule === "sales" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    {activeModule === "sales" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-bold block">Penjualan (Sales)</span>
                  <span className="text-[10px] text-slate-500">
                    {filteredSales.length} transaksi kasir
                  </span>
                </button>

                {/* Inventaris */}
                <button
                  onClick={() => setActiveModule("inventory")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    activeModule === "inventory"
                      ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <Warehouse
                      className={`w-5 h-5 ${activeModule === "inventory" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    {activeModule === "inventory" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-bold block">Inventaris & Stok</span>
                  <span className="text-[10px] text-slate-500">
                    {filteredInventoryTrx.length} mutasi bahan
                  </span>
                </button>

                {/* Keuangan */}
                <button
                  onClick={() => setActiveModule("finance")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    activeModule === "finance"
                      ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <Wallet
                      className={`w-5 h-5 ${activeModule === "finance" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    {activeModule === "finance" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-bold block">Arus Kas & Buku Besar</span>
                  <span className="text-[10px] text-slate-500">
                    {filteredFinance.length} catatan kas
                  </span>
                </button>

                {/* Penggajian & Payroll */}
                <button
                  onClick={() => setActiveModule("payroll")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    activeModule === "payroll"
                      ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <CreditCard
                      className={`w-5 h-5 ${activeModule === "payroll" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    {activeModule === "payroll" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-bold block">Gaji & Bonus KPI</span>
                  <span className="text-[10px] text-slate-500">
                    {filteredPayroll.length} slip terbit
                  </span>
                </button>

                {/* Absensi */}
                <button
                  onClick={() => setActiveModule("attendance")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    activeModule === "attendance"
                      ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <UserCheck
                      className={`w-5 h-5 ${activeModule === "attendance" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    {activeModule === "attendance" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-bold block">Absensi & Jam Kerja</span>
                  <span className="text-[10px] text-slate-500">
                    {filteredAttendance.length} catatan hadir
                  </span>
                </button>

                {/* KPI & Kinerja */}
                <button
                  onClick={() => setActiveModule("kpi")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    activeModule === "kpi"
                      ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <Award
                      className={`w-5 h-5 ${activeModule === "kpi" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    {activeModule === "kpi" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-bold block">Capaian KPI & Skor</span>
                  <span className="text-[10px] text-slate-500">
                    {filteredKpi.length} evaluasi karyawan
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Filter Periode Tanggal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> 2. Rentang Periode Laporan
                </label>
                <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
                  {periodLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: "TODAY", label: "Hari Ini" },
                  { id: "LAST_7_DAYS", label: "7 Hari Terakhir" },
                  { id: "THIS_MONTH", label: "Bulan Ini" },
                  { id: "LAST_MONTH", label: "Bulan Lalu" },
                  { id: "THIS_YEAR", label: "Tahun Ini" },
                  { id: "ALL", label: "Semua Waktu" },
                  { id: "CUSTOM", label: "Pilih Kustom" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setDatePreset(preset.id as any)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors ${
                      datePreset === preset.id
                        ? "bg-slate-900 text-white border-slate-900 font-bold shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {datePreset === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                      Tanggal Mulai:
                    </label>
                    <CustomDatePicker
                      value={customStartDate}
                      onChange={setCustomStartDate}
                      placeholder="Mulai"
                      buttonClassName="w-full text-xs p-2 border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                      Tanggal Selesai:
                    </label>
                    <CustomDatePicker
                      value={customEndDate}
                      onChange={setCustomEndDate}
                      placeholder="Selesai"
                      buttonClassName="w-full text-xs p-2 border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Live Data Summary Banner */}
            <div className={`rounded-2xl p-4 flex items-start sm:items-center gap-3 text-xs leading-relaxed border transition-all ${
              activeModule === "all_in_one"
                ? "bg-gradient-to-r from-brand-50/90 via-slate-50 to-brand-50/90 border-brand-300 text-brand-950 shadow-2xs"
                : "bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border-blue-200/80 text-blue-950"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 ${
                activeModule === "all_in_one" ? "bg-brand-600 animate-pulse" : "bg-blue-600 animate-pulse"
              }`} />
              <div className="w-full">
                {activeModule === "all_in_one" && (
                  <div className="space-y-2">
                    <div className="font-extrabold text-brand-950 flex items-center justify-between flex-wrap gap-2">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                        Ringkasan Gabungan Seluruh Divisi ({periodLabel}):
                      </span>
                      <span className="text-[10px] font-bold text-brand-800 bg-brand-100 px-2.5 py-0.5 rounded-full border border-brand-200">
                        7 Sheet Siap Diunduh
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-white/80 border border-brand-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold block">Penjualan Bersih</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {formatCurrency(filteredSales.reduce((s, i) => s + (i.total || i.totalPrice || 0), 0))}
                        </span>
                        <span className="text-[9px] text-blue-600 block">({filteredSales.length} struk kasir)</span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/80 border border-brand-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold block">Kas Masuk (Non-Kasir)</span>
                        <span className="font-bold text-emerald-700 text-xs">
                          {formatCurrency(
                            filteredFinance
                              .filter((f) => f.type === "CASH_IN" || (f as any).type === "IN")
                              .reduce((s, f) => s + f.amount, 0)
                          )}
                        </span>
                        <span className="text-[9px] text-emerald-600 block">
                          ({filteredFinance.filter((f) => f.type === "CASH_IN" || (f as any).type === "IN").length} penerimaan)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/80 border border-brand-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold block">Pengeluaran Kas</span>
                        <span className="font-bold text-rose-700 text-xs">
                          {formatCurrency(
                            filteredFinance
                              .filter((f) => f.type === "CASH_OUT" || (f as any).type === "OUT")
                              .reduce((s, f) => s + f.amount, 0)
                          )}
                        </span>
                        <span className="text-[9px] text-rose-600 block">Biaya operasional & belanja</span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/80 border border-brand-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold block">Total Beban Gaji</span>
                        <span className="font-bold text-indigo-700 text-xs">
                          {formatCurrency(filteredPayroll.reduce((s, p) => s + (p.netPay || 0), 0))}
                        </span>
                        <span className="text-[9px] text-indigo-600 block">({filteredPayroll.length} slip gaji)</span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/80 border border-brand-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold block">Inventaris & Bahan</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {ingredients.length} Bahan Baku
                        </span>
                        <span className="text-[9px] text-brand-700 block">
                          ({filteredInventoryTrx.length} mutasi stok)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white/80 border border-amber-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold block">Kehadiran & Kinerja</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {filteredAttendance.length} Presensi
                        </span>
                        <span className="text-[9px] text-purple-700 block">
                          ({filteredKpi.length} penilaian KPI)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {activeModule === "sales" && (
                  <span>
                    Ditemukan <strong>{filteredSales.length} transaksi penjualan</strong> dengan total omzet{" "}
                    <strong>
                      {formatCurrency(filteredSales.reduce((s, i) => s + (i.total || i.totalPrice || 0), 0))}
                    </strong>{" "}
                    pada periode terpilih.
                  </span>
                )}
                {activeModule === "inventory" && (
                  <span>
                    Ditemukan <strong>{filteredInventoryTrx.length} mutasi keluar/masuk</strong> bahan baku dan{" "}
                    <strong>{ingredients.length} jenis bahan aktif</strong>.
                  </span>
                )}
                {activeModule === "finance" && (
                  <span>
                    Ditemukan <strong>{filteredFinance.length} transaksi kas</strong> (Pemasukan:{" "}
                    <strong>
                      {formatCurrency(
                        filteredFinance
                          .filter((f) => f.type === "CASH_IN" || (f as any).type === "IN")
                          .reduce((s, f) => s + f.amount, 0)
                      )}
                    </strong>
                    , Pengeluaran:{" "}
                    <strong>
                      {formatCurrency(
                        filteredFinance
                          .filter((f) => f.type === "CASH_OUT" || (f as any).type === "OUT")
                          .reduce((s, f) => s + f.amount, 0)
                      )}
                    </strong>
                    ).
                  </span>
                )}
                {activeModule === "payroll" && (
                  <span>
                    Ditemukan <strong>{filteredPayroll.length} catatan penggajian</strong> dengan total Take Home Pay (THP) sebesar{" "}
                    <strong>
                      {formatCurrency(filteredPayroll.reduce((s, p) => s + p.netPay, 0))}
                    </strong>{" "}
                    dan total Bonus KPI sebesar{" "}
                    <strong>
                      {formatCurrency(filteredPayroll.reduce((s, p) => s + p.kpiBonus, 0))}
                    </strong>
                    .
                  </span>
                )}
                {activeModule === "attendance" && (
                  <span>
                    Ditemukan <strong>{filteredAttendance.length} rekap absensi</strong> harian staf dengan foto selfie & titik koordinat GPS.
                  </span>
                )}
                {activeModule === "kpi" && (
                  <span>
                    Ditemukan <strong>{filteredKpi.length} catatan evaluasi KPI</strong> dengan rata-rata skor{" "}
                    <strong>
                      {filteredKpi.length > 0
                        ? (
                            filteredKpi.reduce((s, k) => s + k.totalScore, 0) /
                            filteredKpi.length
                          ).toFixed(1)
                        : 0}{" "}
                      / 100
                    </strong>
                    .
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {activeModule === "finance" && (
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Import transaksi dari file Excel/CSV"
                >
                  <Upload className="w-3.5 h-3.5" /> Import Excel Kas
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Table className="w-3.5 h-3.5 text-slate-500" />
                {activeModule === "all_in_one" ? "Unduh Ringkasan CSV" : "Unduh CSV"}
              </button>
              <button
                onClick={handleExportXlsx}
                className={`px-3.5 py-2 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all ${
                  activeModule === "all_in_one"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 ring-2 ring-emerald-400/50 shadow-md"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {activeModule === "all_in_one" ? "👑 Unduh Master Excel (7 Sheet)" : "Unduh Excel (.xlsx)"}
              </button>
              <button
                onClick={handleExportPDF}
                className={`px-4 py-2 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all ${
                  activeModule === "all_in_one"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 ring-2 ring-blue-400/50 shadow-md"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {activeModule === "all_in_one" ? "Unduh PDF Eksekutif" : "Unduh PDF"}
              </button>
            </div>
          </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
