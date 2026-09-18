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
} from "lucide-react";
import { formatCurrency } from "../utils/format";
import {
  exportSalesToCSV,
  exportSalesToPDF,
  exportInventoryToCSV,
  exportInventoryToPDF,
  exportFinanceToCSV,
  exportFinanceToPDF,
  filterByDateRange,
  formatDateIndo,
} from "../utils/export";
import {
  exportFinanceToXlsx,
  exportSalesToXlsx,
  exportInventoryToXlsx,
} from "../utils/exportXlsx";
import { ImportFinanceModal } from "./ImportFinanceModal";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: "sales" | "inventory" | "finance" | "executive";
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  defaultModule = "sales",
}) => {
  const {
    salesTransactions,
    ingredients,
    stockMovements,
    cashTransactions,
    settings,
    expenseCategories,
  } = useStore();
  const isIndo = settings.language === "id";

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<
    "sales" | "inventory" | "finance"
  >(defaultModule === "executive" ? "finance" : (defaultModule || "finance"));
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
    if (isOpen && defaultModule) setActiveModule(defaultModule);
  }, [isOpen, defaultModule]);

  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    if (datePreset === "TODAY") {
      const todayStr = now.toISOString().split("T")[0];
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
        startDate: start.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
        periodLabel: isIndo ? "7 Hari Terakhir" : "Last 7 Days",
      };
    }
    if (datePreset === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        periodLabel: isIndo ? `Bulan Ini` : `This Month`,
      };
    }
    if (datePreset === "LAST_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        periodLabel: isIndo ? `Bulan Lalu` : `Last Month`,
      };
    }
    if (datePreset === "THIS_YEAR") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
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

  const filteredSales = useMemo(
    () => filterByDateRange(salesTransactions, startDate, endDate),
    [salesTransactions, startDate, endDate],
  );
  const filteredInventoryTrx = useMemo(
    () => filterByDateRange(stockMovements, startDate, endDate),
    [stockMovements, startDate, endDate],
  );
  const filteredFinance = useMemo(
    () => filterByDateRange(cashTransactions, startDate, endDate),
    [cashTransactions, startDate, endDate],
  );

  if (!isOpen) return null;

  const handleExportPDF = () => {
    if (activeModule === "sales")
      exportSalesToPDF({ sales: filteredSales, settings, periodLabel });
    else if (activeModule === "inventory")
      exportInventoryToPDF({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
        periodLabel,
      });
    else if (activeModule === "finance")
      exportFinanceToPDF({ finance: filteredFinance, settings, periodLabel });
  };

  const handleExportCSV = () => {
    if (activeModule === "sales")
      exportSalesToCSV({ sales: filteredSales, settings });
    else if (activeModule === "inventory")
      exportInventoryToCSV({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
      });
    else if (activeModule === "finance")
      exportFinanceToCSV({ finance: filteredFinance, settings });
  };

  const handleExportXlsx = () => {
    if (activeModule === "sales")
      exportSalesToXlsx({ sales: filteredSales, settings, periodLabel });
    else if (activeModule === "inventory")
      exportInventoryToXlsx({
        ingredients,
        movements: filteredInventoryTrx,
        settings,
        periodLabel,
      });
    else if (activeModule === "finance")
      exportFinanceToXlsx({
        finance: filteredFinance,
        settings,
        periodLabel,
        expenseCategories,
      });
  };

  return (
    <>
    <ImportFinanceModal
      isOpen={isImportOpen}
      onClose={() => setIsImportOpen(false)}
    />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                Pusat Ekspor & Laporan Bisnis
              </h3>
              <p className="text-xs text-slate-400">
                Unduh data ke format CSV / PDF.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              1. Pilih Modul
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => setActiveModule("sales")}
                className={`p-3 rounded-xl border text-left transition-all ${activeModule === "sales" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 text-blue-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
              >
                <div className="flex justify-between mb-2">
                  <ReceiptText
                    className={`w-5 h-5 ${activeModule === "sales" ? "text-blue-600" : "text-slate-400"}`}
                  />
                  {activeModule === "sales" && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <span className="text-xs font-bold block">Penjualan</span>
                <span className="text-[10px] text-slate-500">
                  {filteredSales.length} transaksi
                </span>
              </button>
              <button
                onClick={() => setActiveModule("inventory")}
                className={`p-3 rounded-xl border text-left transition-all ${activeModule === "inventory" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 text-blue-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
              >
                <div className="flex justify-between mb-2">
                  <Warehouse
                    className={`w-5 h-5 ${activeModule === "inventory" ? "text-blue-600" : "text-slate-400"}`}
                  />
                  {activeModule === "inventory" && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <span className="text-xs font-bold block">Inventaris</span>
                <span className="text-[10px] text-slate-500">
                  {filteredInventoryTrx.length} mutasi
                </span>
              </button>
              <button
                onClick={() => setActiveModule("finance")}
                className={`p-3 rounded-xl border text-left transition-all ${activeModule === "finance" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 text-blue-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
              >
                <div className="flex justify-between mb-2">
                  <Wallet
                    className={`w-5 h-5 ${activeModule === "finance" ? "text-blue-600" : "text-slate-400"}`}
                  />
                  {activeModule === "finance" && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <span className="text-xs font-bold block">Keuangan</span>
                <span className="text-[10px] text-slate-500">
                  {filteredFinance.length} catatan
                </span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> 2. Filter
                Tanggal
              </label>
              <span className="text-xs text-blue-600 font-semibold">
                {periodLabel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "TODAY", label: "Hari Ini" },
                { id: "THIS_MONTH", label: "Bulan Ini" },
                { id: "LAST_MONTH", label: "Bulan Lalu" },
                { id: "ALL", label: "Semua" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setDatePreset(preset.id as any)}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border transition-colors ${datePreset === preset.id ? "bg-slate-900 text-white border-slate-900 font-bold" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-blue-950 font-medium">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>
              {activeModule === "sales" &&
                `Ditemukan ${filteredSales.length} transaksi penjualan dengan total ${formatCurrency(filteredSales.reduce((s, i) => s + i.totalPrice, 0))}.`}
              {activeModule === "inventory" &&
                `Ditemukan ${filteredInventoryTrx.length} mutasi stok untuk diekspor.`}
              {activeModule === "finance" &&
                `Ditemukan ${filteredFinance.length} catatan keuangan.`}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            {activeModule === "finance" && (
              <button
                onClick={() => setIsImportOpen(true)}
                className="px-3 py-2 bg-green-50 border border-green-300 hover:bg-green-100 text-green-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                title="Import transaksi dari file Excel/CSV"
              >
                <Upload className="w-3.5 h-3.5" /> Import Excel
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Table className="w-3.5 h-3.5 text-slate-500" /> CSV
            </button>
            <button
              onClick={handleExportXlsx}
              className="px-3 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel (.xlsx)
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
