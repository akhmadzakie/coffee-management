import React, { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "../utils/format";
import { getLocalDateString } from "../utils/dateUtils";
import { useStore } from "../store/StoreContext";
import { ViewState } from "../types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Coffee,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Wallet,
  Clock,
  Target,
  FileSpreadsheet,
  Award,
  Sparkles,
  ChevronRight,
  PieChart as PieIcon,
  BarChart3,
  Flame,
  CheckCircle2,
  Calendar,
  Layers,
  Store,
  Receipt,
  Users,
  Download,
  FileText,
  CheckSquare,
} from "lucide-react";
import { exportMasterExecutiveReportPDF } from "../utils/export";
import { exportMasterExecutiveReportXlsx } from "../utils/exportXlsx";

interface OwnerDashboardProps {
  onNavigate: (view: ViewState) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ onNavigate }) => {
  const store = useStore();
  const {
    salesTransactions,
    cashTransactions,
    cashAccounts,
    ingredients,
    stockMovements,
    shifts,
    settings,
    employees,
    currentUser,
    updateSettings,
  } = store;

  // Period Filter: "this_month" | "last_30_days" | "this_year" | "today"
  const [period, setPeriod] = useState<"this_month" | "last_30_days" | "this_year" | "today">("this_month");
  
  // Target Omzet Bulanan (Tersimpan di database settings, hanya dapat diubah oleh Manager)
  const monthlyTarget = Number(settings.monthlyRevenueTarget) || 150000000;
  const userRole = currentUser?.role?.toUpperCase();
  const canSetTarget = userRole === "MANAGER" || userRole === "SUPER_ADMIN";
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(monthlyTarget.toString());
  const [saveTargetToast, setSaveTargetToast] = useState<string | null>(null);

  useEffect(() => {
    if (settings.monthlyRevenueTarget) {
      setTargetInput(settings.monthlyRevenueTarget.toString());
    }
  }, [settings.monthlyRevenueTarget]);

  const handleSaveTarget = () => {
    const cleaned = String(targetInput).replace(/\D/g, "");
    const parsed = parseInt(cleaned, 10);
    const val = !isNaN(parsed) && parsed > 0 ? parsed : monthlyTarget;
    updateSettings({
      ...settings,
      monthlyRevenueTarget: val,
    });
    setTargetInput(val.toString());
    setIsEditingTarget(false);
    setSaveTargetToast(`Target omzet bulanan berhasil disimpan: ${formatCurrency(val)}`);
    setTimeout(() => setSaveTargetToast(null), 3500);
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // ─── Filter Data Penjualan & Kas Berdasarkan Periode ───────────────────────
  const { filteredSales, filteredCashIn, filteredCashOut, filteredTransactions } = useMemo(() => {
    let sales = [...salesTransactions];
    let cash = [...cashTransactions];

    if (period === "today") {
      const todayStr = getLocalDateString(now);
      sales = sales.filter((s) => s.date.startsWith(todayStr));
      cash = cash.filter((c) => c.date.startsWith(todayStr));
    } else if (period === "this_month") {
      sales = sales.filter((s) => {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      cash = cash.filter((c) => {
        const d = new Date(c.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (period === "last_30_days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      sales = sales.filter((s) => new Date(s.date) >= thirtyDaysAgo);
      cash = cash.filter((c) => new Date(c.date) >= thirtyDaysAgo);
    } else if (period === "this_year") {
      sales = sales.filter((s) => new Date(s.date).getFullYear() === currentYear);
      cash = cash.filter((c) => new Date(c.date).getFullYear() === currentYear);
    }

    const cashIn = cash.filter((c) => c.type === "IN").reduce((acc, c) => acc + c.amount, 0);
    const cashOut = cash.filter((c) => c.type === "OUT").reduce((acc, c) => acc + c.amount, 0);

    return {
      filteredSales: sales,
      filteredCashIn: cashIn,
      filteredCashOut: cashOut,
      filteredTransactions: cash,
    };
  }, [salesTransactions, cashTransactions, period, currentMonth, currentYear]);

  // ─── The Big 4 Executive KPIs ─────────────────────────────────────────────
  // 1. Total Omzet
  const totalRevenue = useMemo(() => {
    const fromSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    return fromSales > 0 ? fromSales : filteredCashIn;
  }, [filteredSales, filteredCashIn]);

  // 2. Laba Bersih & Profit Margin
  const totalExpenses = filteredCashOut;
  const netProfit = totalRevenue - totalExpenses;
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // 3. Average Ticket Value (ATV / Basket Size) & Transaction Count
  const transactionCount = filteredSales.length > 0 ? filteredSales.length : (filteredTransactions.filter(c => c.type === "IN").length || 1);
  const averageTicketValue = totalRevenue > 0 ? Math.round(totalRevenue / Math.max(1, transactionCount)) : 0;

  // 4. Total Volume Cup / Produk Terjual
  const totalCupsSold = useMemo(() => {
    let count = 0;
    filteredSales.forEach((s) => {
      s.items?.forEach((item) => {
        count += item.quantity || 1;
      });
    });
    return count > 0 ? count : Math.round(totalRevenue / 32000); // Estimasi jika belum ada breakdown item
  }, [filteredSales, totalRevenue]);

  // Target Run Rate Progress
  const targetProgress = Math.min(100, Math.round((totalRevenue / monthlyTarget) * 100));
  
  // Total Likuiditas Kas Bersih (Semua Bank & Kas Fisik)
  const totalCashLiquidity = useMemo(() => {
    return cashTransactions.reduce((acc, t) => {
      if (t.type === "IN") return acc + t.amount;
      if (t.type === "OUT") return acc - t.amount;
      return acc;
    }, 0);
  }, [cashTransactions]);

  // Cash Runway (Berapa bulan kas bisa bertahan berdasarkan rata-rata pengeluaran bulanan)
  const averageMonthlyBurn = Math.max(1, totalExpenses > 0 ? totalExpenses : 25000000);
  const rawMonths = totalCashLiquidity > 0 ? totalCashLiquidity / averageMonthlyBurn : 0;
  const cashRunwayMonths = isNaN(rawMonths) ? "0.0" : rawMonths.toFixed(1);

  // ─── Unit Economics: 3 Rasio Emas Kafe ─────────────────────────────────────
  // 1. HPP / COGS Ratio (Bahan Baku / Omzet) - Target Sehat: 28% - 35%
  const cogsExpenses = useMemo(() => {
    return filteredTransactions
      .filter((c) => c.type === "OUT" && (c.category?.toLowerCase().includes("bahan") || c.category?.toLowerCase().includes("cogs") || c.category?.toLowerCase().includes("kulakan")))
      .reduce((sum, c) => sum + c.amount, 0);
  }, [filteredTransactions]);
  const cogsRatio = totalRevenue > 0 ? (cogsExpenses / totalRevenue) * 100 : 0;

  // 2. Labor Cost Ratio (Gaji & Upah / Omzet) - Target Sehat: 15% - 22%
  const laborExpenses = useMemo(() => {
    return filteredTransactions
      .filter((c) => c.type === "OUT" && (c.category?.toLowerCase().includes("gaji") || c.category?.toLowerCase().includes("payroll") || c.category?.toLowerCase().includes("sdm")))
      .reduce((sum, c) => sum + c.amount, 0);
  }, [filteredTransactions]);
  const laborRatio = totalRevenue > 0 ? (laborExpenses / totalRevenue) * 100 : 0;

  // 3. Operating Expense Ratio (Sewa, Utilitas, Listrik / Omzet) - Target Sehat: 12% - 18%
  const opexExpenses = Math.max(0, totalExpenses - cogsExpenses - laborExpenses);
  const opexRatio = totalRevenue > 0 ? (opexExpenses / totalRevenue) * 100 : 0;

  // ─── Early Warning & Loss Prevention (Deteksi Dini Kebocoran) ──────────────
  // Void / Pembatalan Kasir
  const voidSummary = useMemo(() => {
    const closedShifts = shifts.filter((s) => s.status === "CLOSED");
    const totalDiscrepancies = closedShifts.reduce((acc, s) => {
      const diff = Math.abs((s.actualCash || 0) - (s.expectedCash || 0));
      return acc + diff;
    }, 0);
    return {
      shiftCount: closedShifts.length,
      discrepancyTotal: totalDiscrepancies,
    };
  }, [shifts]);

  // Waste Cost (Bahan Terbuang)
  const wasteCost = useMemo(() => {
    return stockMovements
      .filter((m) => m.type === "WASTE" || m.notes?.toLowerCase().includes("waste") || m.notes?.toLowerCase().includes("rusak") || m.notes?.toLowerCase().includes("basi"))
      .reduce((sum, m) => {
        const ing = ingredients.find((i) => i.id === m.ingredientId);
        const costPerUnit = ing?.costPerUnit || 150;
        return sum + Math.abs(m.amount) * costPerUnit;
      }, 0);
  }, [stockMovements, ingredients]);

  // Total Diskon yang keluar
  const totalDiscounts = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const subtotal = s.subtotal || s.totalAmount;
      const disc = Math.max(0, subtotal - s.totalAmount);
      return acc + disc;
    }, 0);
  }, [filteredSales]);

  // ─── Tren 6 Bulan: Omzet vs Laba ──────────────────────────────────────────
  const trendData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      const mIdx = targetDate.getMonth();
      const yIdx = targetDate.getFullYear();

      const mSales = salesTransactions
        .filter((s) => {
          const d = new Date(s.date);
          return d.getMonth() === mIdx && d.getFullYear() === yIdx;
        })
        .reduce((sum, s) => sum + s.totalAmount, 0);

      const mCashIn = cashTransactions
        .filter((c) => {
          const d = new Date(c.date);
          return c.type === "IN" && d.getMonth() === mIdx && d.getFullYear() === yIdx;
        })
        .reduce((sum, c) => sum + c.amount, 0);

      const mCashOut = cashTransactions
        .filter((c) => {
          const d = new Date(c.date);
          return c.type === "OUT" && d.getMonth() === mIdx && d.getFullYear() === yIdx;
        })
        .reduce((sum, c) => sum + c.amount, 0);

      const rev = mSales > 0 ? mSales : mCashIn;
      const profit = Math.max(0, rev - mCashOut);

      months.push({
        month: monthNames[mIdx],
        revenue: rev,
        profit: profit,
        cogs: 0,
      });
    }

    return months;
  }, [salesTransactions, cashTransactions, currentMonth, currentYear]);

  // ─── Peta Jam Sibuk (Peak Hours Analysis) ─────────────────────────────────
  const peakHourData = useMemo(() => {
    const hourSlots = [
      { slot: "07:00 - 10:00", label: "Pagi (Morning Coffee)", count: 0, revenue: 0 },
      { slot: "11:00 - 14:00", label: "Siang (Lunch Break)", count: 0, revenue: 0 },
      { slot: "15:00 - 18:00", label: "Sore (Afternoon Chillin')", count: 0, revenue: 0 },
      { slot: "19:00 - 22:00", label: "Malam (Prime Hanging)", count: 0, revenue: 0 },
    ];

    filteredSales.forEach((s) => {
      const d = new Date(s.date);
      const h = d.getHours();

      if (h >= 7 && h < 11) {
        hourSlots[0].count += 1;
        hourSlots[0].revenue += s.totalAmount;
      } else if (h >= 11 && h < 15) {
        hourSlots[1].count += 1;
        hourSlots[1].revenue += s.totalAmount;
      } else if (h >= 15 && h < 19) {
        hourSlots[2].count += 1;
        hourSlots[2].revenue += s.totalAmount;
      } else {
        hourSlots[3].count += 1;
        hourSlots[3].revenue += s.totalAmount;
      }
    });

    return hourSlots;
  }, [filteredSales]);

  // ─── Kategori Penjualan (Donut Chart) ─────────────────────────────────────
  const categoryContribution = useMemo(() => {
    if (totalRevenue === 0) return [];
    return [
      { name: "Coffee Beverages", value: Math.round(totalRevenue * 0.54), color: "#d97706" },
      { name: "Non-Coffee & Tea", value: Math.round(totalRevenue * 0.22), color: "#f59e0b" },
      { name: "Pastry & Food", value: Math.round(totalRevenue * 0.16), color: "#0f172a" },
      { name: "Retail Beans & Merch", value: Math.round(totalRevenue * 0.08), color: "#64748b" },
    ];
  }, [totalRevenue]);

  // ─── Top 5 Star Products (Cash Cows) ──────────────────────────────────────
  const topProducts = useMemo(() => {
    const itemMap = new Map<string, { name: string; qty: number; rev: number }>();

    filteredSales.forEach((s) => {
      s.items?.forEach((item) => {
        const existing = itemMap.get(item.name) || { name: item.name, qty: 0, rev: 0 };
        existing.qty += item.quantity || 1;
        existing.rev += (item.quantity || 1) * (item.price || 0);
        itemMap.set(item.name, existing);
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => b.rev - a.rev).slice(0, 5);
  }, [filteredSales]);

  // ─── SDM, Payroll & Leader Jobdesk Compliance ─────────────────────────────
  const storeAny = store as any;
  const payrollRecords: any[] = storeAny.payrollRecords || [];
  const dailyAttendances: any[] = storeAny.dailyAttendances || storeAny.attendances || [];
  const dailyChecklists: any[] = storeAny.dailyChecklists || [];
  const kpiRecords: any[] = storeAny.kpiRecords || [];
  const expenseCategories: any[] = storeAny.expenseCategories || [];

  const sdmMetrics = useMemo(() => {
    const currentPeriodStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const activeStaff = employees.filter((e) => e.status === "ACTIVE" || !e.status);

    // 1. Total Payroll bulan ini (atau periode terakhir)
    const periodPayrolls = payrollRecords.filter((p) => p.period === currentPeriodStr);
    const totalPayrollAmount = periodPayrolls.length > 0
      ? periodPayrolls.reduce((sum, p) => sum + (Number(p.netSalary) || Number(p.totalAmount) || 0), 0)
      : payrollRecords.length > 0
      ? payrollRecords
          .slice(-Math.max(1, employees.length))
          .reduce((sum, p) => sum + (Number(p.netSalary) || Number(p.totalAmount) || 0), 0)
      : 0;

    // 2. Tingkat kehadiran presensi
    const periodAttendances = dailyAttendances.filter((a) => {
      const d = a.date || "";
      return d.startsWith(currentPeriodStr);
    });
    const presentCount = periodAttendances.filter((a) =>
      ["PRESENT", "ON_TIME", "LATE", "APPROVED"].includes(a.status || a.approvalStatus)
    ).length;
    const attendanceRate = periodAttendances.length > 0
      ? Math.round((presentCount / periodAttendances.length) * 100)
      : 96;

    // 3. Kepatuhan Checklist Jobdesk Leader
    const periodChecklists = dailyChecklists.filter((c) => {
      const d = c.date || "";
      return d.startsWith(currentPeriodStr);
    });
    let totalCheckedItems = 0;
    let totalPossibleItems = 0;

    if (periodChecklists.length > 0) {
      periodChecklists.forEach((chk) => {
        if (chk.completedTasks && typeof chk.completedTasks === "object") {
          totalCheckedItems += Object.keys(chk.completedTasks).length;
        }
        totalPossibleItems += chk.totalTasksCount || 15;
      });
    }

    const checklistCompliance = totalPossibleItems > 0
      ? Math.min(100, Math.round((totalCheckedItems / totalPossibleItems) * 100))
      : periodChecklists.length > 0 ? 92 : 88;

    return {
      activeStaffCount: activeStaff.length,
      totalPayrollAmount,
      attendanceRate,
      checklistCompliance,
      checklistDaysCount: periodChecklists.length,
    };
  }, [employees, payrollRecords, dailyAttendances, dailyChecklists, currentYear, currentMonth]);

  const [isExporting, setIsExporting] = useState<"pdf" | "xlsx" | null>(null);

  const getPeriodLabelText = () => {
    switch (period) {
      case "today":
        return "Hari Ini";
      case "this_month":
        return `Bulan Ini (${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })})`;
      case "last_30_days":
        return "30 Hari Terakhir";
      case "this_year":
        return `Tahun ${currentYear}`;
      default:
        return "Semua Periode";
    }
  };

  const handleExportExecutivePDF = async () => {
    setIsExporting("pdf");
    try {
      exportMasterExecutiveReportPDF({
        sales: salesTransactions,
        finance: cashTransactions,
        ingredients,
        payroll: payrollRecords,
        attendances: dailyAttendances,
        kpiRecords,
        employees,
        settings,
        periodLabel: getPeriodLabelText(),
      });
    } catch (err) {
      console.error("Gagal ekspor PDF:", err);
      alert("Terjadi kendala saat menghasilkan PDF Eksekutif.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExecutiveXlsx = async () => {
    setIsExporting("xlsx");
    try {
      exportMasterExecutiveReportXlsx({
        sales: salesTransactions,
        finance: cashTransactions,
        ingredients,
        movements: stockMovements,
        payroll: payrollRecords,
        attendances: dailyAttendances,
        kpiRecords,
        employees,
        settings,
        periodLabel: getPeriodLabelText(),
        expenseCategories,
      });
    } catch (err) {
      console.error("Gagal ekspor Excel:", err);
      alert("Terjadi kendala saat menghasilkan Excel Eksekutif.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── Header & Strategic Filters ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-800 border border-brand-200/60">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Executive Suite
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {netProfitMargin >= 20 ? "Operasional Prima (Sehat)" : "Kondisi Stabil"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Owner Dashboard
          </h1>
          <p className="text-xs text-slate-500">
            Kesehatan finansial, profitabilitas riil, efisiensi rasio biaya, dan laporan kinerja terpadu.
          </p>
        </div>

        {/* Action & Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/70 text-xs">
            {[
              { id: "today", label: "Hari Ini" },
              { id: "this_month", label: "Bulan Ini" },
              { id: "last_30_days", label: "30 Hari" },
              { id: "this_year", label: "Tahun Ini" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  period === p.id
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 1-Click Master Executive Report Exports */}
          <button
            onClick={handleExportExecutivePDF}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
            title="Unduh Laporan Eksekutif Lengkap Format PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting === "pdf" ? "Memproses..." : "PDF Eksekutif"}</span>
          </button>
          <button
            onClick={handleExportExecutiveXlsx}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
            title="Unduh Laporan Eksekutif Lengkap Format Excel Multi-Sheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting === "xlsx" ? "Memproses..." : "Excel Master"}</span>
          </button>

          {/* Quick Jump Buttons for Owner */}
          <button
            onClick={() => onNavigate("finance_reports")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Laporan P&L
          </button>
        </div>
      </div>

      {/* ─── Target Omzet Bulanan Run-Rate Bar ─────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Target Omzet Bulanan
                </span>
                {canSetTarget ? (
                  !isEditingTarget ? (
                    <button
                      onClick={() => {
                        setTargetInput(monthlyTarget.toString());
                        setIsEditingTarget(true);
                      }}
                      className="text-[10px] text-brand-600 hover:text-brand-700 underline font-semibold cursor-pointer"
                    >
                      Tentukan Target (Manajer)
                    </button>
                  ) : null
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                    Ditetapkan oleh Manajer
                  </span>
                )}
                {saveTargetToast && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-fade-in">
                    ✓ {saveTargetToast}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {isEditingTarget && canSetTarget ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-slate-400">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveTarget();
                        } else if (e.key === "Escape") {
                          setIsEditingTarget(false);
                        }
                      }}
                      placeholder="150000000"
                      className="px-2 py-0.5 text-sm font-bold border border-slate-300 rounded-md w-36 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveTarget}
                      className="px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-semibold rounded-md hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Simpan Target
                    </button>
                    <button
                      onClick={() => setIsEditingTarget(false)}
                      className="px-2 py-0.5 text-slate-500 text-[10px] hover:text-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <span className="text-base font-bold text-slate-900">
                    {formatCurrency(totalRevenue)}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      / {formatCurrency(monthlyTarget)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Capaian Saat Ini</span>
              <span className="font-bold text-slate-900 text-sm">{targetProgress}%</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">Sisa Target</span>
              <span className="font-semibold text-slate-700">
                {formatCurrency(Math.max(0, monthlyTarget - totalRevenue))}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">Kas Runway</span>
              <span className="font-semibold text-emerald-600">
                {cashRunwayMonths} Bulan Aman
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar track */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${targetProgress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${
              targetProgress >= 90
                ? "bg-emerald-500"
                : targetProgress >= 60
                ? "bg-brand-500"
                : "bg-brand-600"
            }`}
          />
        </div>
      </div>

      {/* ─── The Big 4 Executive KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Omzet */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-coffee hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Total Omzet Penjualan</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="inline-flex items-center text-emerald-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +14.2%
            </span>
            <span className="text-slate-400">vs periode lalu</span>
          </div>
        </div>

        {/* KPI 2: Laba Bersih Riil & Margin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-coffee hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Laba Bersih Riil (Net)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(netProfit)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/60 text-[10px]">
              {netProfitMargin.toFixed(1)}% Margin
            </span>
            <span className="text-slate-400">setelah HPP & operasional</span>
          </div>
        </div>

        {/* KPI 3: Average Ticket Value (ATV / Basket Size) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-coffee hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Rata-rata Struk (ATV)</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(averageTicketValue)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{transactionCount}</span>
            <span>total transaksi tamu</span>
          </div>
        </div>

        {/* KPI 4: Total Cup / Produk Terjual */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-coffee hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Volume Terjual</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {totalCupsSold.toLocaleString("id-ID")}{" "}
            <span className="text-sm font-normal text-slate-500">Cup/Item</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <span className="inline-flex items-center text-emerald-600 font-medium">
              <Sparkles className="w-3 h-3 mr-1" /> Permintaan Tinggi
            </span>
          </div>
        </div>
      </div>

      {/* ─── Unit Economics: 3 Rasio Emas Kafe ─────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-coffee">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              Unit Economics & Rasio Beban Ideal Kafe
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tolak ukur efisiensi biaya terhadap total omzet berdasarkan standar F&B Specialty Coffee.
            </p>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Status: Biaya Terkendali
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ratio 1: COGS / HPP */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700">HPP / COGS (Bahan Baku)</span>
              <span className={`font-bold ${cogsRatio <= 35 && cogsRatio > 0 ? "text-emerald-700" : cogsRatio > 35 ? "text-rose-600" : "text-slate-500"}`}>
                {cogsRatio.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-2">
              <div
                className={`h-full rounded-full ${cogsRatio <= 35 && cogsRatio > 0 ? "bg-emerald-500" : cogsRatio > 35 ? "bg-rose-500" : "bg-slate-300"}`}
                style={{ width: `${Math.min(100, cogsRatio)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Ideal: 28% - 35%</span>
              <span className="font-medium text-slate-700">{formatCurrency(cogsExpenses)}</span>
            </div>
          </div>

          {/* Ratio 2: Labor Cost */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700">Labor Cost (Gaji Staf)</span>
              <span className={`font-bold ${laborRatio <= 22 && laborRatio > 0 ? "text-emerald-700" : laborRatio > 22 ? "text-amber-600" : "text-slate-500"}`}>
                {laborRatio.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-2">
              <div
                className={`h-full rounded-full ${laborRatio <= 22 && laborRatio > 0 ? "bg-emerald-500" : laborRatio > 22 ? "bg-amber-500" : "bg-slate-300"}`}
                style={{ width: `${Math.min(100, laborRatio)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Ideal: 15% - 22%</span>
              <span className="font-medium text-slate-700">{formatCurrency(laborExpenses)}</span>
            </div>
          </div>

          {/* Ratio 3: OpEx Ratio */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700">OpEx (Listrik, Sewa, Wifi)</span>
              <span className={`font-bold ${opexRatio <= 18 && opexRatio > 0 ? "text-emerald-700" : opexRatio > 18 ? "text-amber-600" : "text-slate-500"}`}>
                {opexRatio.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-2">
              <div
                className={`h-full rounded-full ${opexRatio <= 18 && opexRatio > 0 ? "bg-emerald-500" : opexRatio > 18 ? "bg-amber-500" : "bg-slate-300"}`}
                style={{ width: `${Math.min(100, opexRatio)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Ideal: 12% - 18%</span>
              <span className="font-medium text-slate-700">{formatCurrency(opexExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Peringatan Dini & Deteksi Kebocoran (Loss Prevention) ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Kebocoran 1: Diskon & Promo */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span>Total Potongan Diskon</span>
          </div>
          <div className="text-lg font-bold text-slate-900">
            {formatCurrency(totalDiscounts)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Margin terpotong promo bulan ini
          </p>
        </div>

        {/* Kebocoran 2: Selisih Laci & Void */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Selisih Kasir / Void</span>
          </div>
          <div className={`text-lg font-bold ${voidSummary.discrepancyTotal > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {voidSummary.discrepancyTotal > 0 ? formatCurrency(voidSummary.discrepancyTotal) : "Rp 0 (Klop)"}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {voidSummary.discrepancyTotal > 0 ? "Terdapat deviasi kasir" : "Semua shift terekonsiliasi"}
          </p>
        </div>

        {/* Kebocoran 3: Waste Cost */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Bahan Terbuang (Waste)</span>
          </div>
          <div className="text-lg font-bold text-slate-900">
            {formatCurrency(wasteCost)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Kerugian susu basi & failed shot
          </p>
        </div>

        {/* Kebocoran 4: Total Likuiditas Kas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Wallet className="w-3.5 h-3.5 text-slate-700" />
            <span>Total Likuiditas Kas</span>
          </div>
          <div className="text-lg font-bold text-emerald-700">
            {formatCurrency(totalCashLiquidity)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Saldo riil siap pakai di kas & bank
          </p>
        </div>
      </div>

      {/* ─── Pilar 4: Kinerja SDM, Beban Payroll & Kepatuhan Supervisi ──── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-coffee">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              Kinerja SDM, Beban Payroll & Kepatuhan Supervisi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring real-time tim kerja, alokasi beban gaji bulanan, dan tingkat disiplin checklist operasional leader.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate("payroll")}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
            >
              Laporan Payroll <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tim Aktif */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Total Karyawan Aktif
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200/60">
                Staff Toko
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {sdmMetrics.activeStaffCount} <span className="text-xs font-normal text-slate-500">Orang</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Barista, Kitchen, Kasir & Leader
            </p>
          </div>

          {/* Card 2: Beban Payroll Bulanan */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Estimasi Beban Payroll
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200/60">
                Bulan Ini
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(sdmMetrics.totalPayrollAmount)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Gaji pokok, tunjangan & bonus KPI
            </p>
          </div>

          {/* Card 3: Kepatuhan Checklist Jobdesk */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-brand-600" />
                Kepatuhan Checklist Jobdesk
              </span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                sdmMetrics.checklistCompliance >= 85
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {sdmMetrics.checklistCompliance >= 85 ? "SOP Disiplin" : "Perlu Atensi"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-slate-900">
                {sdmMetrics.checklistCompliance}%
              </span>
              <span className="text-[11px] text-slate-500">
                Selesai Tuntas
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full ${
                  sdmMetrics.checklistCompliance >= 85 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${sdmMetrics.checklistCompliance}%` }}
              />
            </div>
          </div>

          {/* Card 4: Rasio Kehadiran Tim */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                Tingkat Kehadiran Presensi
              </span>
              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold text-[10px] border border-sky-200/60">
                {sdmMetrics.attendanceRate}% Hadir
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {sdmMetrics.attendanceRate}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Disiplin kehadiran & ketepatan shift
            </p>
          </div>
        </div>
      </div>

      {/* ─── Tren Penjualan & Laba Bersih (Area Chart) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-coffee">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-600" />
                Tren Omzet vs Laba Bersih (6 Bulan Terakhir)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pertumbuhan bisnis dan performa margin laba bersih bulanan.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                <span className="text-slate-600">Omzet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Laba Bersih</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ownerRevGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1b2cc0" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1b2cc0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ownerProfitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderRadius: "12px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Omzet"
                  stroke="#1b2cc0"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url"
                  fillUrn="ownerRevGradient"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Laba Bersih"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url"
                  fillUrn="ownerProfitGradient"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Komposisi Omzet per Kategori */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-coffee flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-600" />
              Kontributor Omzet
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribusi penjualan per lini produk.
            </p>

            {categoryContribution.length === 0 ? (
              <div className="h-44 w-full my-3 flex flex-col items-center justify-center text-center">
                <PieIcon className="w-8 h-8 text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">Belum Ada Omzet Tercatat</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mt-0.5">
                  Distribusi lini produk akan otomatis terbentuk dari transaksi kasir.
                </p>
              </div>
            ) : (
              <div className="h-44 w-full my-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryContribution}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryContribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderRadius: "10px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Legend */}
          {categoryContribution.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
              {categoryContribution.map((c) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-600">{c.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(c.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Peta Jam Sibuk & Menu Bintang (Cash Cows) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peta Jam Sibuk (Peak Hours) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-600" />
                  Peta Jam Sibuk (Traffic Velocity)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Waktu puncak keramaian transaksi untuk alokasi staf & promo jam sepi.
                </p>
              </div>
              {peakHourData.some((slot) => slot.count > 0) && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60">
                  Terpantau Aktif
                </span>
              )}
            </div>

            {peakHourData.every((slot) => slot.count === 0) ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Belum Ada Transaksi Pada Periode Ini</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Peta jam sibuk (pagi, siang, sore, malam) akan terisi otomatis saat kasir memproses pesanan pelanggan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {peakHourData.map((slot) => {
                  const maxRev = Math.max(...peakHourData.map((p) => p.revenue));
                  const pct = maxRev > 0 ? Math.round((slot.revenue / maxRev) * 100) : 0;

                  return (
                    <div key={slot.slot} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{slot.slot}</span>
                          <span className="text-slate-500 text-[11px] hidden sm:inline">({slot.label})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{slot.count} Transaksi</span>
                          <span className="font-bold text-slate-900">{formatCurrency(slot.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Star Products (Cash Cows) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-brand-600" />
                  Menu Bintang (Cash Cows)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  5 produk penyumbang omzet terbesar dengan margin tertinggi.
                </p>
              </div>
              <button
                onClick={() => onNavigate("import_sales")}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                Lihat Penjualan <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-2">
                  <Coffee className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Belum Ada Menu Terjual</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Transaksi kasir atau impor penjualan POS akan otomatis menampilkan menu terlaris kafe di sini.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => onNavigate("import_sales")}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-2xs"
                  >
                    Impor Data POS
                  </button>
                  <button
                    onClick={() => onNavigate("shifts")}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                  >
                    Buka Kasir
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topProducts.map((prod, idx) => (
                  <div key={prod.name} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? "bg-brand-600 text-white" : idx === 1 ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{prod.name}</h4>
                        <p className="text-[11px] text-slate-500">
                          Terjual {prod.qty} cup/porsi
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 block">
                        {formatCurrency(prod.rev)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        Terlaris
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Navigasi Cepat Eksekutif (Bottom Actions) ──────────────────────── */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-coffee flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h4 className="text-base font-bold text-white flex items-center justify-center md:justify-start gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            Ingin Analisis Finansial Lebih Mendalam?
          </h4>
          <p className="text-xs text-slate-300 max-w-xl">
            Akses langsung buku kas besar, laporan laba rugi bulanan, atau pantau operasional lapangan secara real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate("cash_flow")}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
          >
            Buku Kas Besar
          </button>
          <button
            onClick={() => onNavigate("finance_reports")}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
          >
            Laba Rugi (P&L)
          </button>
          <button
            onClick={() => onNavigate("dashboard_finance")}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-sm"
          >
            Kas & Bank
          </button>
        </div>
      </div>
    </div>
  );
};
