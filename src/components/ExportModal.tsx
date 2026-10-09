import React, { useState, useMemo } from "react";
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
} from "../utils/exportXlsx";
import { ImportFinanceModal } from "./ImportFinanceModal";

export type ExportModuleType =
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
    defaultModule === "executive" ? "finance" : (defaultModule as ExportModuleType) || "sales"
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
      setActiveModule(defaultModule === "executive" ? "finance" : (defaultModule as ExportModuleType));
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

  if (!isOpen || !canAccessExport) return null;

  // ─── Export Triggers ────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (activeModule === "sales") {
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
    if (activeModule === "sales") {
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
    if (activeModule === "sales") {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col my-8">
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
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

          <div className="p-6 space-y-6">
            {/* 1. Pilih Modul (6 Modul Lengkap) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                1. Pilih Modul Laporan
              </label>
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
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                      Tanggal Selesai:
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Live Data Summary Banner */}
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-blue-950 font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <div className="leading-relaxed">
                {activeModule === "sales" && (
                  <span>
                    Ditemukan <strong>{filteredSales.length} transaksi penjualan</strong> dengan total omzet{" "}
                    <strong>
                      {formatCurrency(filteredSales.reduce((s, i) => s + i.totalPrice, 0))}
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
                          .filter((f) => f.type === "CASH_IN")
                          .reduce((s, f) => s + f.amount, 0)
                      )}
                    </strong>
                    , Pengeluaran:{" "}
                    <strong>
                      {formatCurrency(
                        filteredFinance
                          .filter((f) => f.type === "CASH_OUT")
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
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
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
                <Table className="w-3.5 h-3.5 text-slate-500" /> Unduh CSV
              </button>
              <button
                onClick={handleExportXlsx}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh Excel (.xlsx)
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Unduh PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
