import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
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
  ShoppingBag,
  Coffee,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { getLocalDateString, getLocalPeriodString } from "../utils/dateUtils";
import { addDaysToLocalDate } from "../utils/syncSanitizers";
import { formatCurrency } from "../utils/format";
import {
  getPreviousPeriodString,
  getSaleTransactionAmount,
  isNonOperationalCashTransaction,
} from "../utils/financeMetrics";
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
  exportPurchaseOrdersToCSV,
  exportPurchaseOrdersToPDF,
  exportMenuCatalogToCSV,
  exportMenuCatalogToPDF,
  exportDailySalesRecapToCSV,
  exportDailySalesRecapToPDF,
  exportShiftsToCSV,
  exportShiftsToPDF,
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
  exportPurchaseOrdersToXlsx,
  exportMenuCatalogToXlsx,
  exportDailySalesRecapToXlsx,
  exportShiftsToXlsx,
} from "../utils/exportXlsx";
import { ImportFinanceModal } from "./ImportFinanceModal";
import { CustomDatePicker } from "./common/CustomDatePicker";

export type ExportModuleType =
  | "all_in_one"
  | "sales"
  | "daily_recap"
  | "inventory"
  | "purchases"
  | "menu_catalog"
  | "finance"
  | "payroll"
  | "attendance"
  | "kpi"
  | "shifts";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: ExportModuleType | "executive";
  defaultPeriod?: string;
}

function getMonthBoundsYmd(periodYm: string): { start: string; end: string } {
  const [yStr, mStr] = periodYm.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${periodYm}-01`,
    end: `${periodYm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  defaultModule = "sales",
  defaultPeriod,
}) => {
  const {
    currentUser,
    isReadOnly,
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
    purchaseOrders = [],
    suppliers = [],
    products = [],
    dailySalesRecaps = [],
    shifts = [],
  } = useStore();
  const isIndo = settings.language === "id";

  const canAccessExport = Boolean(
    currentUser &&
      ["OWNER", "MANAGER", "FINANCE", "SUPER_ADMIN"].includes(currentUser.role)
  );

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
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
    if (!isOpen) return;
    if (defaultModule) {
      setActiveModule(defaultModule === "executive" ? "all_in_one" : (defaultModule as ExportModuleType));
    }
    if (defaultPeriod && /^\d{4}-\d{2}$/.test(defaultPeriod)) {
      const currentMonth = getLocalPeriodString();
      const lastMonth = getPreviousPeriodString(currentMonth);
      if (defaultPeriod === currentMonth) {
        setDatePreset("THIS_MONTH");
      } else if (defaultPeriod === lastMonth) {
        setDatePreset("LAST_MONTH");
      } else {
        const bounds = getMonthBoundsYmd(defaultPeriod);
        setCustomStartDate(bounds.start);
        setCustomEndDate(bounds.end);
        setDatePreset("CUSTOM");
      }
    }
  }, [isOpen, defaultModule, defaultPeriod]);

  const { startDate, endDate, periodLabel } = useMemo(() => {
    const todayStr = getLocalDateString();
    const currentPeriod = todayStr.slice(0, 7);

    if (datePreset === "TODAY") {
      return {
        startDate: todayStr,
        endDate: todayStr,
        periodLabel: isIndo
          ? `Hari Ini (${formatDateIndo(todayStr)})`
          : `Today (${formatDateIndo(todayStr)})`,
      };
    }
    if (datePreset === "LAST_7_DAYS") {
      return {
        startDate: addDaysToLocalDate(todayStr, -6),
        endDate: todayStr,
        periodLabel: isIndo ? "7 Hari Terakhir" : "Last 7 Days",
      };
    }
    if (datePreset === "THIS_MONTH") {
      const bounds = getMonthBoundsYmd(currentPeriod);
      return {
        startDate: bounds.start,
        endDate: bounds.end,
        periodLabel: isIndo ? `Bulan Ini (${currentPeriod})` : `This Month (${currentPeriod})`,
      };
    }
    if (datePreset === "LAST_MONTH") {
      const prevPeriod = getPreviousPeriodString(currentPeriod);
      const bounds = getMonthBoundsYmd(prevPeriod);
      return {
        startDate: bounds.start,
        endDate: bounds.end,
        periodLabel: isIndo ? `Bulan Lalu (${prevPeriod})` : `Last Month (${prevPeriod})`,
      };
    }
    if (datePreset === "THIS_YEAR") {
      const yr = todayStr.slice(0, 4);
      return {
        startDate: `${yr}-01-01`,
        endDate: `${yr}-12-31`,
        periodLabel: isIndo ? `Tahun Ini (${yr})` : `This Year (${yr})`,
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

  const operationalFilteredFinance = useMemo(
    () => filteredFinance.filter((f) => !isNonOperationalCashTransaction(f)),
    [filteredFinance]
  );

  const filteredRecaps = useMemo(
    () => filterByDateRange(dailySalesRecaps || [], startDate, endDate),
    [dailySalesRecaps, startDate, endDate]
  );

  const filteredPurchases = useMemo(
    () => filterByDateRange(purchaseOrders || [], startDate, endDate),
    [purchaseOrders, startDate, endDate]
  );

  const filteredShifts = useMemo(() => {
    return (shifts || []).filter((s) => {
      const ymd = s.startTime ? getLocalDateString(new Date(s.startTime)) : "";
      if (!ymd) return true;
      if (startDate && ymd < startDate) return false;
      if (endDate && ymd > endDate) return false;
      return true;
    });
  }, [shifts, startDate, endDate]);

  if (!canAccessExport || typeof document === "undefined") return null;

  const isSelectedModuleEmpty = (): boolean => {
    if (activeModule === "sales") return filteredSales.length === 0;
    if (activeModule === "daily_recap") return filteredRecaps.length === 0;
    if (activeModule === "inventory") return ingredients.length === 0 && filteredInventoryTrx.length === 0;
    if (activeModule === "purchases") return filteredPurchases.length === 0;
    if (activeModule === "menu_catalog") return products.length === 0;
    if (activeModule === "finance") return filteredFinance.length === 0;
    if (activeModule === "payroll") return filteredPayroll.length === 0;
    if (activeModule === "attendance") return filteredAttendance.length === 0;
    if (activeModule === "kpi") return filteredKpi.length === 0;
    if (activeModule === "shifts") return filteredShifts.length === 0;
    return (
      filteredSales.length === 0 &&
      filteredFinance.length === 0 &&
      ingredients.length === 0 &&
      filteredPayroll.length === 0 &&
      filteredAttendance.length === 0 &&
      filteredKpi.length === 0
    );
  };

  // ─── Export Triggers ────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (isSelectedModuleEmpty()) {
      toast.warning("Tidak ada data pada periode terpilih untuk diekspor ke PDF.");
      return;
    }
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
    } else if (activeModule === "daily_recap") {
      exportDailySalesRecapToPDF({ recaps: filteredRecaps, settings, periodLabel });
    } else if (activeModule === "inventory") {
      exportInventoryToPDF({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
        periodLabel,
      });
    } else if (activeModule === "purchases") {
      exportPurchaseOrdersToPDF({
        purchaseOrders: filteredPurchases,
        suppliers,
        settings,
        periodLabel,
      });
    } else if (activeModule === "menu_catalog") {
      exportMenuCatalogToPDF({ products, settings, periodLabel });
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
    } else if (activeModule === "shifts") {
      exportShiftsToPDF({ shifts: filteredShifts, settings, periodLabel });
    }
    toast.success("Berkas PDF berhasil dibuat.");
  };

  const handleExportCSV = () => {
    if (isSelectedModuleEmpty()) {
      toast.warning("Tidak ada data pada periode terpilih untuk diekspor ke CSV.");
      return;
    }
    if (activeModule === "all_in_one") {
      const totalGrossSales = filteredSales.reduce((sum, s) => sum + getSaleTransactionAmount(s), 0);
      const totalNetSales = totalGrossSales;
      const totalCashIn = operationalFilteredFinance
        .filter((f) => f.type === "CASH_IN" || (f as any).type === "IN")
        .reduce((sum, f) => sum + (f.amount || 0), 0);
      const totalCashOut = operationalFilteredFinance
        .filter((f) => f.type === "CASH_OUT" || (f as any).type === "OUT")
        .reduce((sum, f) => sum + (f.amount || 0), 0);
      const totalPayroll = filteredPayroll.reduce((sum, p) => sum + (p.netPay || 0), 0);

      const summaryRows = [
        { "Indikator Eksekutif": "Periode Laporan", "Nilai / Jumlah": periodLabel },
        { "Indikator Eksekutif": "Total Penjualan Kotor (Gross Sales)", "Nilai / Jumlah": totalGrossSales },
        { "Indikator Eksekutif": "Total Penjualan Bersih (Net Sales)", "Nilai / Jumlah": totalNetSales },
        { "Indikator Eksekutif": "Total Transaksi Penjualan (Struk)", "Nilai / Jumlah": filteredSales.length },
        { "Indikator Eksekutif": "Total Kas Masuk Operasional (In)", "Nilai / Jumlah": totalCashIn },
        { "Indikator Eksekutif": "Total Pengeluaran Kas Operasional (Out)", "Nilai / Jumlah": totalCashOut },
        { "Indikator Eksekutif": "Total Beban Gaji Karyawan (Payroll)", "Nilai / Jumlah": totalPayroll },
        { "Indikator Eksekutif": "Total Item Bahan Baku di Gudang", "Nilai / Jumlah": ingredients.length },
        { "Indikator Eksekutif": "Total Catatan Mutasi Stok", "Nilai / Jumlah": filteredInventoryTrx.length },
        { "Indikator Eksekutif": "Total Rekap Kehadiran Karyawan", "Nilai / Jumlah": filteredAttendance.length },
        { "Indikator Eksekutif": "Total Evaluasi Kinerja KPI", "Nilai / Jumlah": filteredKpi.length },
      ];
      exportToCSV(`Ringkasan_Eksekutif_${periodLabel.replace(/\s+/g, "_")}`, summaryRows);
    } else if (activeModule === "sales") {
      exportSalesToCSV({ sales: filteredSales, settings });
    } else if (activeModule === "daily_recap") {
      exportDailySalesRecapToCSV({ recaps: filteredRecaps });
    } else if (activeModule === "inventory") {
      exportInventoryToCSV({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
      });
    } else if (activeModule === "purchases") {
      exportPurchaseOrdersToCSV({ purchaseOrders: filteredPurchases, suppliers });
    } else if (activeModule === "menu_catalog") {
      exportMenuCatalogToCSV({ products });
    } else if (activeModule === "finance") {
      exportFinanceToCSV({ finance: filteredFinance, settings });
    } else if (activeModule === "payroll") {
      exportPayrollToCSV({ payroll: filteredPayroll, employees });
    } else if (activeModule === "attendance") {
      exportAttendanceToCSV({ attendances: filteredAttendance, employees });
    } else if (activeModule === "kpi") {
      exportKpiToCSV({ kpiRecords: filteredKpi, employees });
    } else if (activeModule === "shifts") {
      exportShiftsToCSV({ shifts: filteredShifts });
    }
    toast.success("Berkas CSV berhasil diunduh.");
  };

  const handleExportXlsx = async () => {
    if (isSelectedModuleEmpty()) {
      toast.warning("Tidak ada data pada periode terpilih untuk diekspor ke Excel.");
      return;
    }
    setIsExportingXlsx(true);
    try {
      if (activeModule === "all_in_one") {
        await exportMasterExecutiveReportXlsx({
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
        await exportSalesToXlsx({ sales: filteredSales, settings, periodLabel });
      } else if (activeModule === "daily_recap") {
        await exportDailySalesRecapToXlsx({ recaps: filteredRecaps, settings, periodLabel });
      } else if (activeModule === "inventory") {
        await exportInventoryToXlsx({
          ingredients,
          movements: filteredInventoryTrx,
          settings,
          periodLabel,
        });
      } else if (activeModule === "purchases") {
        await exportPurchaseOrdersToXlsx({
          purchaseOrders: filteredPurchases,
          suppliers,
          ingredients,
          settings,
          periodLabel,
        });
      } else if (activeModule === "menu_catalog") {
        await exportMenuCatalogToXlsx({ products, settings, periodLabel });
      } else if (activeModule === "finance") {
        await exportFinanceToXlsx({
          finance: filteredFinance,
          settings,
          periodLabel,
          expenseCategories,
        });
      } else if (activeModule === "payroll") {
        await exportPayrollToXlsx({
          payroll: filteredPayroll,
          employees,
          settings,
          periodLabel,
        });
      } else if (activeModule === "attendance") {
        await exportAttendanceToXlsx({
          attendances: filteredAttendance,
          employees,
          settings,
          periodLabel,
        });
      } else if (activeModule === "kpi") {
        await exportKpiToXlsx({
          kpiRecords: filteredKpi,
          employees,
          settings,
          periodLabel,
        });
      } else if (activeModule === "shifts") {
        await exportShiftsToXlsx({ shifts: filteredShifts, settings, periodLabel });
      }
      toast.success("Berkas Excel (.xlsx) berhasil diunduh.");
    } catch (err: any) {
      toast.error("Gagal membuat berkas Excel: " + (err?.message || err));
    } finally {
      setIsExportingXlsx(false);
    }
  };

  return (
    <>
      {!isReadOnly && (
        <ImportFinanceModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
        />
      )}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="export-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
              }}
              className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
            >
              <motion.div
                key="export-modal-card"
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 8 }}
                transition={{ type: "spring", damping: 28, stiffness: 360 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] my-auto"
              >
                {/* Header */}
                <div className="px-6 py-4 bg-brand-gradient text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-xs">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">
                        Pusat Ekspor &amp; Laporan Bisnis
                      </h3>
                      <p className="text-xs text-brand-200">
                        Unduh data operasional, keuangan, SDM, dan performa kafe ke format Excel (.xlsx), CSV, atau PDF.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-brand-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Tutup modal ekspor"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                  {/* 1. Pilih Modul Laporan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                      1. Pilih Jenis Laporan
                    </label>

                    {/* Master All-in-One Option */}
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => setActiveModule("all_in_one")}
                        className={`w-full p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs cursor-pointer ${
                          activeModule === "all_in_one"
                            ? "border-brand-600 bg-gradient-to-r from-brand-50 via-brand-100/40 to-brand-50/50 dark:from-brand-500/20 dark:via-brand-500/10 dark:to-slate-900 ring-2 ring-brand-500/40 text-brand-950 dark:text-slate-100 shadow-md"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300 hover:bg-brand-50/20 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                              activeModule === "all_in_one"
                                ? "bg-brand-600 text-white shadow-brand-600/25"
                                : "bg-brand-50 dark:bg-brand-500/15 border border-brand-200/80 dark:border-brand-500/30 text-brand-600 dark:text-brand-300"
                            }`}
                          >
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                                Laporan Master Komprehensif (All-in-One)
                              </span>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-600 text-white uppercase tracking-wider shadow-2xs">
                                👑 Rekomendasi Owner / Atasan
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Satukan seluruh 6 modul laporan dalam <strong>1 File Excel Multi-Sheet (7 Sheet Terpisah)</strong> atau <strong>1 Berkas PDF Eksekutif</strong> siap cetak.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {activeModule === "all_in_one" ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-3 py-1 rounded-xl">
                              <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-300" /> Terpilih
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                              Pilih Ini
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 my-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                      <span>Atau Pilih Laporan Spesifik Per Modul</span>
                      <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                      {[
                        { id: "sales", icon: ReceiptText, title: "Penjualan Produk", countText: `${filteredSales.length} transaksi` },
                        { id: "daily_recap", icon: TrendingUp, title: "Rekap Omzet Harian", countText: `${filteredRecaps.length} entri rekap` },
                        { id: "inventory", icon: Warehouse, title: "Inventaris & Stok", countText: `${filteredInventoryTrx.length} mutasi bahan` },
                        { id: "purchases", icon: ShoppingBag, title: "Pembelian (PO)", countText: `${filteredPurchases.length} faktur PO` },
                        { id: "menu_catalog", icon: Coffee, title: "Katalog Menu & HPP", countText: `${products.length} produk` },
                        { id: "finance", icon: Wallet, title: "Arus Kas & Buku", countText: `${filteredFinance.length} catatan kas` },
                        { id: "payroll", icon: CreditCard, title: "Gaji & Bonus KPI", countText: `${filteredPayroll.length} slip terbit` },
                        { id: "attendance", icon: UserCheck, title: "Absensi & Jam", countText: `${filteredAttendance.length} presensi` },
                        { id: "kpi", icon: Award, title: "Capaian KPI", countText: `${filteredKpi.length} evaluasi` },
                        { id: "shifts", icon: Clock, title: "Shift Kasir", countText: `${filteredShifts.length} sesi shift` },
                      ].map((mod) => {
                        const IconMod = mod.icon;
                        const active = activeModule === mod.id;
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => setActiveModule(mod.id as ExportModuleType)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              active
                                ? "border-brand-600 bg-brand-50/80 dark:bg-brand-500/15 ring-2 ring-brand-500/30 text-brand-950 dark:text-slate-100 shadow-xs"
                                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <div className="flex justify-between mb-2">
                              <IconMod
                                className={`w-5 h-5 ${active ? "text-brand-600 dark:text-brand-300" : "text-slate-400"}`}
                              />
                              {active && <CheckCircle2 className="w-4 h-4 text-brand-600 dark:text-brand-300" />}
                            </div>
                            <span className="text-xs font-bold block">{mod.title}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {mod.countText}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Filter Periode Tanggal */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> 2. Rentang Periode Laporan
                      </label>
                      <span className="text-xs text-brand-700 dark:text-brand-300 font-bold bg-brand-50 dark:bg-brand-500/15 px-2.5 py-0.5 rounded-md border border-brand-200/70 dark:border-brand-500/30">
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
                          type="button"
                          onClick={() => setDatePreset(preset.id as any)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                            datePreset === preset.id
                              ? "bg-brand-600 text-white border-brand-600 font-bold shadow-xs"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {datePreset === "CUSTOM" && (
                      <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                            Tanggal Mulai:
                          </label>
                          <CustomDatePicker
                            value={customStartDate}
                            onChange={(val) => {
                              setCustomStartDate(val);
                              if (customEndDate && val && val > customEndDate) {
                                setCustomEndDate(val);
                              }
                            }}
                            placeholder="Mulai"
                            buttonClassName="w-full text-xs p-2 border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                            Tanggal Selesai:
                          </label>
                          <CustomDatePicker
                            value={customEndDate}
                            onChange={(val) => {
                              setCustomEndDate(val);
                              if (customStartDate && val && val < customStartDate) {
                                setCustomStartDate(val);
                              }
                            }}
                            placeholder="Selesai"
                            buttonClassName="w-full text-xs p-2 border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live Data Summary Banner */}
                  <div className="rounded-2xl p-4 flex items-start sm:items-center gap-3 text-xs leading-relaxed border bg-gradient-to-r from-brand-50/90 via-slate-50 to-brand-50/90 dark:from-brand-500/15 dark:via-slate-800/60 dark:to-brand-500/15 border-brand-200 dark:border-brand-500/30 text-brand-950 dark:text-slate-100 shadow-2xs transition-all">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 bg-brand-600 dark:bg-brand-300" />
                    <div className="w-full">
                      {activeModule === "all_in_one" && (
                        <div className="space-y-2">
                          <div className="font-extrabold text-brand-950 dark:text-slate-100 flex items-center justify-between flex-wrap gap-2">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" />
                              Ringkasan Gabungan Seluruh Divisi ({periodLabel}):
                            </span>
                            <span className="text-[10px] font-bold text-brand-800 dark:text-brand-300 bg-brand-100 dark:bg-brand-500/20 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-500/30">
                              7 Sheet Siap Diunduh
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                            <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-brand-200/80 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Penjualan Bersih</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs tabular-nums">
                                {formatCurrency(filteredSales.reduce((s, i) => s + getSaleTransactionAmount(i), 0))}
                              </span>
                              <span className="text-[9px] text-brand-600 dark:text-brand-300 block">({filteredSales.length} struk kasir)</span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-brand-200/80 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Kas Masuk Operasional</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xs tabular-nums">
                                {formatCurrency(
                                  operationalFilteredFinance
                                    .filter((f) => f.type === "CASH_IN" || (f as any).type === "IN")
                                    .reduce((s, f) => s + f.amount, 0)
                                )}
                              </span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block">
                                ({operationalFilteredFinance.filter((f) => f.type === "CASH_IN" || (f as any).type === "IN").length} penerimaan)
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-brand-200/80 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Pengeluaran Kas</span>
                              <span className="font-bold text-rose-700 dark:text-rose-300 text-xs tabular-nums">
                                {formatCurrency(
                                  operationalFilteredFinance
                                    .filter((f) => f.type === "CASH_OUT" || (f as any).type === "OUT")
                                    .reduce((s, f) => s + f.amount, 0)
                                )}
                              </span>
                              <span className="text-[9px] text-rose-600 dark:text-rose-400 block">Biaya operasional &amp; belanja</span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-brand-200/80 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Total Beban Gaji</span>
                              <span className="font-bold text-brand-700 dark:text-brand-300 text-xs tabular-nums">
                                {formatCurrency(filteredPayroll.reduce((s, p) => s + (p.netPay || 0), 0))}
                              </span>
                              <span className="text-[9px] text-brand-600 dark:text-brand-400 block">({filteredPayroll.length} slip gaji)</span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-brand-200/80 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Inventaris &amp; Bahan</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs tabular-nums">
                                {ingredients.length} Bahan Baku
                              </span>
                              <span className="text-[9px] text-brand-700 dark:text-brand-300 block">
                                ({filteredInventoryTrx.length} mutasi stok)
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-amber-200/80 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Kehadiran &amp; Kinerja</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs tabular-nums">
                                {filteredAttendance.length} Presensi
                              </span>
                              <span className="text-[9px] text-violet-700 dark:text-violet-300 block">
                                ({filteredKpi.length} penilaian KPI)
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {activeModule === "sales" && (
                        <span>
                          Ditemukan <strong>{filteredSales.length} transaksi penjualan</strong> dengan total omzet{" "}
                          <strong className="tabular-nums">
                            {formatCurrency(filteredSales.reduce((s, i) => s + getSaleTransactionAmount(i), 0))}
                          </strong>{" "}
                          pada periode terpilih.
                        </span>
                      )}
                      {activeModule === "daily_recap" && (
                        <span>
                          Ditemukan <strong>{filteredRecaps.length} entri rekap omzet harian</strong> dengan total penerimaan{" "}
                          <strong className="tabular-nums">
                            {formatCurrency(filteredRecaps.reduce((s, r) => s + (r.totalAmount || 0), 0))}
                          </strong>
                          .
                        </span>
                      )}
                      {activeModule === "purchases" && (
                        <span>
                          Ditemukan <strong>{filteredPurchases.length} Purchase Order</strong> dengan total nilai{" "}
                          <strong className="tabular-nums">
                            {formatCurrency(filteredPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0))}
                          </strong>
                          .
                        </span>
                      )}
                      {activeModule === "menu_catalog" && (
                        <span>
                          Terdapat <strong>{products.length} produk resmi</strong> di katalog siap diekspor lengkap dengan rincian varian, harga jual, &amp; estimasi HPP.
                        </span>
                      )}
                      {activeModule === "shifts" && (
                        <span>
                          Ditemukan <strong>{filteredShifts.length} riwayat sesi shift kasir</strong> pada periode terpilih.
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
                          Ditemukan <strong>{filteredFinance.length} transaksi kas</strong> (Pemasukan Ops:{" "}
                          <strong className="tabular-nums">
                            {formatCurrency(
                              operationalFilteredFinance
                                .filter((f) => f.type === "CASH_IN" || (f as any).type === "IN")
                                .reduce((s, f) => s + f.amount, 0)
                            )}
                          </strong>
                          , Pengeluaran Ops:{" "}
                          <strong className="tabular-nums">
                            {formatCurrency(
                              operationalFilteredFinance
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
                          <strong className="tabular-nums">
                            {formatCurrency(filteredPayroll.reduce((s, p) => s + p.netPay, 0))}
                          </strong>{" "}
                          dan total Bonus KPI sebesar{" "}
                          <strong className="tabular-nums">
                            {formatCurrency(filteredPayroll.reduce((s, p) => s + p.kpiBonus, 0))}
                          </strong>
                          .
                        </span>
                      )}
                      {activeModule === "attendance" && (
                        <span>
                          Ditemukan <strong>{filteredAttendance.length} rekap absensi</strong> harian staf dengan foto selfie &amp; titik koordinat GPS.
                        </span>
                      )}
                      {activeModule === "kpi" && (
                        <span>
                          Ditemukan <strong>{filteredKpi.length} catatan evaluasi KPI</strong> dengan rata-rata skor{" "}
                          <strong className="tabular-nums">
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
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    {activeModule === "finance" && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setIsImportOpen(true)}
                        className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        title="Import transaksi dari file Excel/CSV"
                      >
                        <Upload className="w-3.5 h-3.5" /> Import Excel Kas
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Table className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      {activeModule === "all_in_one" ? "Unduh Ringkasan CSV" : "Unduh CSV"}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportXlsx}
                      disabled={isExportingXlsx}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      {isExportingXlsx ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      )}
                      {activeModule === "all_in_one" ? "👑 Unduh Master Excel (7 Sheet)" : "Unduh Excel (.xlsx)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-brand-600/20 transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {activeModule === "all_in_one" ? "Unduh PDF Eksekutif" : "Unduh PDF"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
