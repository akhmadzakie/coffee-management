import { RupiahSign } from './common/RupiahSign';
import { FEATURES } from "../config/features";
import React, { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "../utils/format";
import { authFetch } from "../utils/authHeaders";
import {
  DEFAULT_STORE_TIMEZONE,
  getLocalDateString,
  getLocalPeriodString,
} from "../utils/dateUtils";
import {
  computeCashLiquidityBreakdown,
  computeOwnerProfitAllocation,
  computePeriodFinancialSummary,
  getPreviousPeriodString,
  getSaleTransactionAmount,
  isNonOperationalCashTransaction,
} from "../utils/financeMetrics";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomDatePicker } from "./common/CustomDatePicker";
import {
  addDaysToLocalDate,
  computeOwnerCategoryContribution,
  computePeriodGrowthPercent,
  extractWitaHour,
  getLocalPeriodFromTimestamp,
} from "../utils/syncSanitizers";
import { classifyDailyAttendanceStatus } from "../utils/attendanceRecap";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ViewState, ManagerApprovalRequest } from "../types";
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
    Coffee,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  PiggyBank,
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
  Zap,
  Send,
  RotateCcw,
  Trash2,
  Lock,
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
    dailySalesRecaps,
    recipes,
    products,
    cashTransactions,
    cashAccounts,
    ingredients,
    stockMovements,
    stockOpnames = [],
    stockOpnameItems = [],
    purchaseOrders = [],
    shifts,
    settings,
    employees,
    currentUser,
    updateSettings,
  } = store;

  // Period Filter: 7 mode fleksibel + Bulan kustom + Rentang Hari kustom
  const [period, setPeriod] = useState<
    "today" | "7_days" | "this_month" | "last_month" | "this_year" | "month" | "custom"
  >("this_month");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalPeriodString());
  const [customStartDate, setCustomStartDate] = useState<string>(() =>
    addDaysToLocalDate(getLocalDateString(), -6)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    getLocalDateString()
  );
  
  // Target Omzet Bulanan (Tersimpan di database settings, hanya dapat diubah oleh Manager)
  const monthlyTarget = Number(settings.monthlyRevenueTarget) || 150000000;
  const userRole = currentUser?.role?.toUpperCase();
  const canSetTarget = userRole === "MANAGER" || userRole === "SUPER_ADMIN";
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(monthlyTarget.toString());

  // Data Pengawasan Loss Prevention & Fraud
  const [approvalHistory, setApprovalHistory] = useState<ManagerApprovalRequest[]>([]);
  const [posTodayStats, setPosTodayStats] = useState<{
    grossSales: number;
    totalRefund: number;
    netSales: number;
    paidCount: number;
    refundCount: number;
    voidCount: number;
  }>({
    grossSales: 0,
    totalRefund: 0,
    netSales: 0,
    paidCount: 0,
    refundCount: 0,
    voidCount: 0,
  });

  useEffect(() => {
    if (!FEATURES.POS) return;
    const fetchLossPreventionData = async () => {
      try {
        const [resHist, resToday] = await Promise.all([
          authFetch("/api/pos/approvals/history"),
          authFetch("/api/pos/orders/today"),
        ]);
        if (resHist.ok) {
          setApprovalHistory(await resHist.json());
        }
        if (resToday.ok) {
          const data = await resToday.json();
          if (data.summary) {
            setPosTodayStats(data.summary);
          }
        }
      } catch (e) {
        console.warn("Gagal mengambil data loss prevention:", e);
      }
    };
    fetchLossPreventionData();
  }, []);

  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === "OPEN");
  }, [shifts]);

  const cancellationMetrics = useMemo(() => {
    const totalTransactions = posTodayStats.paidCount + posTodayStats.refundCount + posTodayStats.voidCount;
    const cancelledCount = posTodayStats.refundCount + posTodayStats.voidCount;
    const ratio = totalTransactions > 0 ? (cancelledCount / totalTransactions) * 100 : 0;
    return {
      totalTransactions,
      cancelledCount,
      ratio,
    };
  }, [posTodayStats]);

  const handleOpenCopilot = (
    tab: "quick-input" | "receipt" | "insights",
    prompt?: string
  ) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-assistant", {
        detail: { tab, prompt },
      })
    );
  };

  useEffect(() => {
    if (settings.monthlyRevenueTarget) {
      setTargetInput(settings.monthlyRevenueTarget.toString());
    }
  }, [settings.monthlyRevenueTarget]);

  const handleSaveTarget = () => {
    if (!canSetTarget) return;
    const cleaned = String(targetInput).replace(/\D/g, "");
    const parsed = parseInt(cleaned, 10);
    const val = !isNaN(parsed) && parsed > 0 ? parsed : monthlyTarget;
    updateSettings({
      ...settings,
      monthlyRevenueTarget: val,
    });
    setTargetInput(val.toString());
    setIsEditingTarget(false);
    toast.success(`Target omzet bulanan berhasil disimpan: ${formatCurrency(val)}`);
  };

  const todayStr = getLocalDateString();
  const currentPeriodStr = getLocalPeriodString();
  const currentYear = Number(currentPeriodStr.slice(0, 4));
  const currentMonth = Number(currentPeriodStr.slice(5, 7)) - 1;

  // ─── Filter Data Penjualan, Rekap & Kas Operasional Berdasarkan Periode ─────
  const {
    filteredSales,
    filteredCashIn,
    filteredCashOut,
    filteredTransactions,
    periodCashAll,
    periodSummary,
    previousPeriodRevenue,
  } = useMemo(() => {
    const start7Str = addDaysToLocalDate(todayStr, -6);
    const lastMonthPeriodStr = getPreviousPeriodString(currentPeriodStr);
    const normCustomStart =
      customStartDate <= customEndDate ? customStartDate : customEndDate;
    const normCustomEnd =
      customStartDate <= customEndDate ? customEndDate : customStartDate;

    const matchesPeriodFilter = (dateStr: string) => {
      if (!dateStr) return false;
      const localDate = getLocalDateString(new Date(dateStr));
      if (period === "today") {
        return localDate === todayStr;
      }
      if (period === "7_days") {
        return localDate >= start7Str && localDate <= todayStr;
      }
      if (period === "this_month") {
        return getLocalPeriodFromTimestamp(dateStr) === currentPeriodStr;
      }
      if (period === "last_month") {
        return getLocalPeriodFromTimestamp(dateStr) === lastMonthPeriodStr;
      }
      if (period === "month") {
        return getLocalPeriodFromTimestamp(dateStr) === selectedMonth;
      }
      if (period === "custom") {
        return Boolean(
          localDate &&
            (!normCustomStart || localDate >= normCustomStart) &&
            (!normCustomEnd || localDate <= normCustomEnd)
        );
      }
      if (period === "this_year") {
        return getLocalPeriodFromTimestamp(dateStr).startsWith(`${currentYear}-`);
      }
      return true;
    };

    const sales = salesTransactions.filter((s) => matchesPeriodFilter(s.date));
    const recaps = (dailySalesRecaps || []).filter((r) => matchesPeriodFilter(r.date));
    const cashForPeriod = cashTransactions.filter((c) => matchesPeriodFilter(c.date));
    const cash = cashForPeriod.filter((c) => !isNonOperationalCashTransaction(c));
    const pos = purchaseOrders.filter((p) => matchesPeriodFilter(p.date));
    const periodKey =
      period === "this_month"
        ? currentPeriodStr
        : period === "last_month"
        ? lastMonthPeriodStr
        : period === "month"
        ? selectedMonth
        : "ALL";
    const rangeBounds =
      period === "today"
        ? { startDate: todayStr, endDate: todayStr }
        : period === "7_days"
        ? { startDate: start7Str, endDate: todayStr }
        : period === "custom"
        ? { startDate: normCustomStart, endDate: normCustomEnd }
        : {};

    const summary = computePeriodFinancialSummary({
      period: periodKey,
      ...rangeBounds,
      salesTransactions: sales,
      dailySalesRecaps: recaps,
      cashTransactions: cashForPeriod,
      expenseCategories: store.expenseCategories || [],
      recipes: recipes || [],
      ingredients,
      products: products || [],
      stockOpnames,
      stockOpnameItems,
      purchaseOrders: periodKey === "ALL" ? pos : purchaseOrders,
      cashAccounts,
    });

    // Hitung omzet periode pembanding sebelumnya (bulan lalu / kemarin / 7 hari lalu / tahun lalu / rentang sebelumnya)
    let prevSummary: ReturnType<typeof computePeriodFinancialSummary>;
    if (period === "this_month" || period === "last_month" || period === "month") {
      const basePeriod =
        period === "this_month"
          ? currentPeriodStr
          : period === "last_month"
          ? lastMonthPeriodStr
          : selectedMonth;
      const prevPeriodKey = getPreviousPeriodString(basePeriod);
      prevSummary = computePeriodFinancialSummary({
        period: prevPeriodKey,
        salesTransactions,
        dailySalesRecaps: dailySalesRecaps || [],
        cashTransactions,
        expenseCategories: store.expenseCategories || [],
        recipes: recipes || [],
        ingredients,
        products: products || [],
        stockOpnames,
        stockOpnameItems,
        purchaseOrders,
        cashAccounts,
      });
    } else {
      const prevStart7 = addDaysToLocalDate(todayStr, -13);
      const prevEnd7 = addDaysToLocalDate(todayStr, -7);
      const yesterdayStr = addDaysToLocalDate(todayStr, -1);
      const prevYearPrefix = `${currentYear - 1}-`;
      let prevCustomStart = "";
      let prevCustomEnd = "";
      if (period === "custom" && normCustomStart && normCustomEnd) {
        const diffDays = Math.max(
          1,
          Math.round(
            (new Date(`${normCustomEnd}T00:00:00`).getTime() -
              new Date(`${normCustomStart}T00:00:00`).getTime()) /
              86400000
          ) + 1
        );
        prevCustomEnd = addDaysToLocalDate(normCustomStart, -1);
        prevCustomStart = addDaysToLocalDate(normCustomStart, -diffDays);
      }
      const matchesPrevFilter = (dateStr: string) => {
        if (!dateStr) return false;
        const localDate = getLocalDateString(new Date(dateStr));
        if (period === "today") return localDate === yesterdayStr;
        if (period === "7_days") return localDate >= prevStart7 && localDate <= prevEnd7;
        if (period === "custom") return localDate >= prevCustomStart && localDate <= prevCustomEnd;
        if (period === "this_year") return getLocalPeriodFromTimestamp(dateStr).startsWith(prevYearPrefix);
        return false;
      };
      prevSummary = computePeriodFinancialSummary({
        period: "ALL",
        salesTransactions: salesTransactions.filter((s) => matchesPrevFilter(s.date)),
        dailySalesRecaps: (dailySalesRecaps || []).filter((r) => matchesPrevFilter(r.date)),
        cashTransactions: cashTransactions.filter((c) => matchesPrevFilter(c.date)),
        expenseCategories: store.expenseCategories || [],
        recipes: recipes || [],
        ingredients,
        products: products || [],
        stockOpnames,
        stockOpnameItems,
        purchaseOrders: purchaseOrders.filter((p) => matchesPrevFilter(p.date)),
        cashAccounts,
      });
    }
    const prevRev =
      prevSummary.netSales > 0
        ? prevSummary.netSales
        : prevSummary.recognizedRevenue > 0
        ? prevSummary.recognizedRevenue
        : prevSummary.totalOperationalCashIn;

    return {
      filteredSales: sales,
      filteredCashIn: summary.totalOperationalCashIn,
      filteredCashOut: summary.totalOperationalCashOut,
      filteredTransactions: cash,
      periodCashAll: cashForPeriod,
      periodSummary: summary,
      previousPeriodRevenue: prevRev,
    };
  }, [
    salesTransactions,
    dailySalesRecaps,
    cashTransactions,
    store.expenseCategories,
    recipes,
    ingredients,
    products,
    stockOpnames,
    stockOpnameItems,
    purchaseOrders,
    cashAccounts,
    period,
    selectedMonth,
    customStartDate,
    customEndDate,
    todayStr,
    currentPeriodStr,
    currentYear,
  ]);

  // ─── The Big 4 Executive KPIs ─────────────────────────────────────────────
  // 1. Total Omzet (Terkoneksi ke Rekap Harian, Sales/POS, & Kas Penjualan bebas duplikasi)
  const totalRevenue =
    periodSummary.netSales > 0
      ? periodSummary.netSales
      : periodSummary.recognizedRevenue > 0
      ? periodSummary.recognizedRevenue
      : filteredCashIn;
  const revenueGrowthPct = useMemo(
    () => computePeriodGrowthPercent(totalRevenue, previousPeriodRevenue),
    [totalRevenue, previousPeriodRevenue]
  );

  // 2. Laba Bersih & Profit Margin (Formula akrual terpusat bebas CapEx/Mutasi/Tabungan)
  const totalExpenses = periodSummary.effectiveCOGS + periodSummary.totalOPEX;
  const netProfit = periodSummary.netProfit;
  const netProfitMargin = periodSummary.netMarginPercent;

  // 2b. Rekap Pembagian Keuntungan Owner, Tabungan Kedai & Prive
  const profitAllocation = useMemo(
    () =>
      computeOwnerProfitAllocation({
        netProfit,
        cashTransactions: periodCashAll,
        cashAccounts,
        expenseCategories: store.expenseCategories || [],
        ownerPercent: settings.profitShareOwnerPercent,
        reservePercent: settings.profitShareReservePercent,
        investorPercent: settings.profitShareInvestorPercent,
      }),
    [
      netProfit,
      periodCashAll,
      cashAccounts,
      store.expenseCategories,
      settings.profitShareOwnerPercent,
      settings.profitShareReservePercent,
      settings.profitShareInvestorPercent,
    ]
  );

  // 3. Average Ticket Value (ATV / Basket Size) & Transaction Count
  const transactionCount = filteredSales.length > 0
    ? filteredSales.length
    : (filteredTransactions.filter((c) => (c.type as string) === "IN" || c.type === "CASH_IN").length || 1);
  const averageTicketValue = totalRevenue > 0 ? Math.round(totalRevenue / Math.max(1, transactionCount)) : 0;

  // 4. Total Volume Cup / Produk Terjual
  const totalCupsSold = useMemo(() => {
    let count = 0;
    filteredSales.forEach((s: any) => {
      if (Array.isArray(s.items) && s.items.length > 0) {
        s.items.forEach((item: any) => {
          count += item.quantity || 1;
        });
      } else {
        count += Number(s.quantitySold) || 1;
      }
    });
    return count > 0 ? count : Math.round(totalRevenue / 32000); // Estimasi jika baru input rekap omzet tanpa item
  }, [filteredSales, totalRevenue]);

  // Target Run Rate Progress
  const targetProgress = Math.min(100, Math.round((totalRevenue / monthlyTarget) * 100));
  
  // Total Likuiditas Kas Bersih (Memisahkan Kas Operasional vs Tabungan/Dana Cadangan)
  const liquidityBreakdown = useMemo(
    () => computeCashLiquidityBreakdown(cashAccounts, cashTransactions),
    [cashAccounts, cashTransactions]
  );
  const operationalLiquidity = liquidityBreakdown.operationalBalance;
  const savingsLiquidity = liquidityBreakdown.savingsBalance;
  const totalCashLiquidity = liquidityBreakdown.totalLiquidity;

  // Cash Runway (Menggunakan kas operasional siap pakai agar tabungan tidak tercampur modal kerja harian)
  const averageMonthlyBurn = Math.max(1, totalExpenses > 0 ? totalExpenses : 25000000);
  const rawMonths = operationalLiquidity > 0 ? operationalLiquidity / averageMonthlyBurn : 0;
  const cashRunwayMonths = isNaN(rawMonths) ? "0.0" : rawMonths.toFixed(1);

  // ─── Unit Economics: 3 Rasio Emas Kafe ─────────────────────────────────────
  // 1. HPP / COGS Ratio (Bahan Baku / Omzet) - Target Sehat: 28% - 35%
  const cogsExpenses = periodSummary.effectiveCOGS;
  const cogsRatio = totalRevenue > 0 ? (cogsExpenses / totalRevenue) * 100 : 0;

  // 2. Labor Cost Ratio (Gaji & Upah / Omzet) - Target Sehat: 15% - 22%
  const laborExpenses = periodSummary.totalHrdExpense;
  const laborRatio = totalRevenue > 0 ? (laborExpenses / totalRevenue) * 100 : 0;

  // 3. Operating Expense Ratio (Sewa, Utilitas, Listrik, Admin Bank/MDR / Omzet) - Target Sehat: 12% - 18%
  const opexExpenses =
    periodSummary.totalUtilityExpense +
    periodSummary.totalGeneralOpsExpense +
    periodSummary.totalAdminBankExpense;
  const opexRatio = totalRevenue > 0 ? (opexExpenses / totalRevenue) * 100 : 0;

  // ─── Early Warning & Loss Prevention (Deteksi Dini Kebocoran) ──────────────
  // Void / Pembatalan Kasir
  const voidSummary = useMemo(() => {
    const closedShifts = shifts.filter((s) => s.status === "CLOSED");
    const totalDiscrepancies = closedShifts.reduce((acc, s: any) => {
      const diff = Math.abs((s.actualCash ?? s.actualEndingCash ?? 0) - (s.expectedCash ?? s.expectedEndingCash ?? 0));
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
      .filter((m: any) => m.type === "WASTE" || (m.note || m.notes || "").toLowerCase().includes("waste") || (m.note || m.notes || "").toLowerCase().includes("rusak") || (m.note || m.notes || "").toLowerCase().includes("basi"))
      .reduce((sum, m: any) => {
        const ing = ingredients.find((i) => i.id === m.ingredientId);
        const costPerUnit = ing?.costPerUnit || 150;
        const qty = Math.abs(Number(m.quantity ?? m.amount ?? 0));
        return sum + (m.totalCost > 0 ? m.totalCost : qty * costPerUnit);
      }, 0);
  }, [stockMovements, ingredients]);

  // Total Diskon yang keluar
  const totalDiscounts = useMemo(() => {
    const fromSales = filteredSales.reduce((acc, s: any) => {
      const saleAmt = getSaleTransactionAmount(s);
      const subtotal = s.subtotal || saleAmt;
      const disc = Math.max(0, subtotal - saleAmt);
      return acc + disc;
    }, 0);
    return Math.max(periodSummary.totalDiscountAmount, fromSales);
  }, [filteredSales, periodSummary.totalDiscountAmount]);

  // ─── Tren 6 Bulan: Omzet vs Laba ──────────────────────────────────────────
  const trendData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      const mIdx = targetDate.getMonth();
      const yIdx = targetDate.getFullYear();
      const mPeriodStr = `${yIdx}-${String(mIdx + 1).padStart(2, "0")}`;

      const mSum = computePeriodFinancialSummary({
        period: mPeriodStr,
        salesTransactions,
        dailySalesRecaps: dailySalesRecaps || [],
        cashTransactions,
        expenseCategories: store.expenseCategories || [],
        recipes: recipes || [],
        ingredients,
        products: products || [],
        stockOpnames,
        stockOpnameItems,
        purchaseOrders,
        cashAccounts,
      });

      const rev =
        mSum.netSales > 0
          ? mSum.netSales
          : mSum.recognizedRevenue > 0
          ? mSum.recognizedRevenue
          : mSum.totalOperationalCashIn;
      const profit = Math.max(0, mSum.netProfit);

      months.push({
        month: monthNames[mIdx],
        revenue: rev,
        profit: profit,
        cogs: mSum.effectiveCOGS,
      });
    }

    return months;
  }, [
    salesTransactions,
    dailySalesRecaps,
    cashTransactions,
    store.expenseCategories,
    recipes,
    ingredients,
    products,
    stockOpnames,
    stockOpnameItems,
    purchaseOrders,
    cashAccounts,
    currentMonth,
    currentYear,
  ]);

  // ─── Peta Jam Sibuk (Peak Hours Analysis) ─────────────────────────────────
  const peakHourData = useMemo(() => {
    const hourSlots = [
      { slot: "07:00 - 10:00", label: "Pagi (Morning Coffee)", count: 0, revenue: 0 },
      { slot: "11:00 - 14:00", label: "Siang (Lunch Break)", count: 0, revenue: 0 },
      { slot: "15:00 - 18:00", label: "Sore (Afternoon Chillin')", count: 0, revenue: 0 },
      { slot: "19:00 - 22:00", label: "Malam (Prime Hanging)", count: 0, revenue: 0 },
    ];

    filteredSales.forEach((s) => {
      const amt = getSaleTransactionAmount(s);
      const h = extractWitaHour(s.date) ?? new Date(s.date).getHours();

      if (h >= 7 && h < 11) {
        hourSlots[0].count += 1;
        hourSlots[0].revenue += amt;
      } else if (h >= 11 && h < 15) {
        hourSlots[1].count += 1;
        hourSlots[1].revenue += amt;
      } else if (h >= 15 && h < 19) {
        hourSlots[2].count += 1;
        hourSlots[2].revenue += amt;
      } else {
        hourSlots[3].count += 1;
        hourSlots[3].revenue += amt;
      }
    });

    return hourSlots;
  }, [filteredSales]);

  // ─── Kategori Penjualan (Donut Chart) ─────────────────────────────────────
  const categoryContribution = useMemo(() => {
    return computeOwnerCategoryContribution({
      filteredSales,
      products: products || [],
      totalRevenue,
    });
  }, [filteredSales, products, totalRevenue]);

  // ─── Top 5 Star Products (Cash Cows) ──────────────────────────────────────
  const topProducts = useMemo(() => {
    const itemMap = new Map<string, { name: string; qty: number; rev: number }>();

    filteredSales.forEach((s: any) => {
      if (Array.isArray(s.items) && s.items.length > 0) {
        s.items.forEach((item: any) => {
          const existing = itemMap.get(item.name) || { name: item.name, qty: 0, rev: 0 };
          existing.qty += item.quantity || 1;
          existing.rev += (item.quantity || 1) * (item.price || 0);
          itemMap.set(item.name, existing);
        });
      } else if (s.menuName) {
        const existing = itemMap.get(s.menuName) || { name: s.menuName, qty: 0, rev: 0 };
        existing.qty += Number(s.quantitySold) || 1;
        existing.rev += getSaleTransactionAmount(s);
        itemMap.set(s.menuName, existing);
      }
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
    const activeStaff = employees.filter(
      (e) => e.status === "AKTIF" || (e.status as any) === "ACTIVE" || !e.status
    );

    // 1. Total Payroll bulan ini (atau periode terakhir)
    const periodPayrolls = payrollRecords.filter((p) => p.period === currentPeriodStr);
    const getPayrollVal = (p: any) =>
      Number(p.netPay) || Number(p.grossPay) || Number(p.netSalary) || Number(p.totalAmount) || 0;
    const totalPayrollAmount = periodPayrolls.length > 0
      ? periodPayrolls.reduce((sum, p) => sum + getPayrollVal(p), 0)
      : payrollRecords.length > 0
      ? payrollRecords
          .slice(-Math.max(1, employees.length))
          .reduce((sum, p) => sum + getPayrollVal(p), 0)
      : 0;

    // 2. Tingkat kehadiran presensi
    const periodAttendances = dailyAttendances.filter((a) => {
      const d = a.date || "";
      return d.startsWith(currentPeriodStr);
    });
    const presentCount = periodAttendances.filter((a) => {
      const cls = classifyDailyAttendanceStatus(a);
      return cls === "HADIR" || cls === "TERLAMBAT";
    }).length;
    const hasAttendanceData = periodAttendances.length > 0;
    const attendanceRate = hasAttendanceData
      ? Math.round((presentCount / periodAttendances.length) * 100)
      : 0;

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
          totalPossibleItems += chk.totalTasksCount || 15;
        } else {
          const cleanCount = Array.isArray(chk.cleaningDone) ? chk.cleaningDone.length : 0;
          const equipCount = Array.isArray(chk.equipmentChecked) ? chk.equipmentChecked.length : 0;
          const leaderCount = Array.isArray(chk.leaderTasks) ? chk.leaderTasks.length : 0;
          const checkedHere = cleanCount + equipCount + leaderCount;
          totalCheckedItems += checkedHere;
          totalPossibleItems += Math.max(checkedHere, chk.totalTasksCount || 10);
        }
      });
    }

    const hasChecklistData = periodChecklists.length > 0;
    const checklistCompliance =
      totalPossibleItems > 0
        ? Math.min(100, Math.round((totalCheckedItems / totalPossibleItems) * 100))
        : 0;

    return {
      activeStaffCount: activeStaff.length,
      totalPayrollAmount,
      attendanceRate,
      hasAttendanceData,
      checklistCompliance,
      hasChecklistData,
      checklistDaysCount: periodChecklists.length,
    };
  }, [employees, payrollRecords, dailyAttendances, dailyChecklists, currentYear, currentMonth]);

  const [isExporting, setIsExporting] = useState<"pdf" | "xlsx" | null>(null);

  const getPeriodLabelText = () => {
    switch (period) {
      case "today":
        return "Hari Ini";
      case "7_days":
        return "7 Hari Terakhir";
      case "this_month":
        return `Bulan Ini (${new Date().toLocaleDateString("id-ID", {
          timeZone: DEFAULT_STORE_TIMEZONE,
          month: "long",
          year: "numeric",
        })})`;
      case "last_month":
        return `Bulan Lalu (${getPreviousPeriodString(currentPeriodStr)})`;
      case "month":
        return `Bulan ${selectedMonth}`;
      case "custom": {
        const s = customStartDate <= customEndDate ? customStartDate : customEndDate;
        const e = customStartDate <= customEndDate ? customEndDate : customStartDate;
        return `Rentang ${s} s.d. ${e}`;
      }
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
        sales: filteredSales,
        finance: filteredTransactions,
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
      toast.error("Terjadi kendala saat menghasilkan PDF Eksekutif.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExecutiveXlsx = async () => {
    setIsExporting("xlsx");
    try {
      await exportMasterExecutiveReportXlsx({
        sales: filteredSales,
        finance: filteredTransactions,
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
      toast.error("Terjadi kendala saat menghasilkan Excel Eksekutif.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── Header & Strategic Filters ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-4">
        {/* Baris 1: Judul, Badge & Tombol Aksi Eksekutif */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/30 shadow-2xs whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                Executive Suite
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30 shadow-2xs whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {netProfitMargin >= 20 ? "Operasional Prima (Sehat)" : "Kondisi Stabil"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Executive Owner Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Kesehatan finansial, profitabilitas riil, efisiensi rasio biaya, dan laporan kinerja terpadu Julia's.
            </p>
          </div>

          {/* 1-Click Master Executive Report Exports & Jumps */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportExecutivePDF}
              disabled={isExporting !== null}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
              title="Unduh Laporan Eksekutif Lengkap Format PDF"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{isExporting === "pdf" ? "Memproses..." : "PDF Eksekutif"}</span>
            </button>
            <button
              onClick={handleExportExecutiveXlsx}
              disabled={isExporting !== null}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
              title="Unduh Laporan Eksekutif Lengkap Format Excel Multi-Sheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>{isExporting === "xlsx" ? "Memproses..." : "Excel Master"}</span>
            </button>

            <button
              onClick={() => onNavigate("finance_reports")}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Laporan P&amp;L</span>
            </button>

            <button
              onClick={() => handleOpenCopilot("insights")}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 border border-brand-200/80 dark:border-brand-500/30 hover:bg-brand-100 dark:hover:bg-brand-500/30 hover:text-brand-900 dark:hover:text-white shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
              title="Buka Audit & Rekomendasi Eksekutif Toko"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300 shrink-0" />
              <span>Ringkasan Eksekutif AI</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Toolbar Filter Periode Inset (Lapisan 3) */}
        <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Animated Sliding Pill Period Tabs */}
          <div className="max-w-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-xs p-1 rounded-xl flex items-center border border-slate-200/80 dark:border-slate-700 text-xs shadow-inner overflow-x-auto no-scrollbar">
            {[
              { id: "today", label: "Hari Ini" },
              { id: "7_days", label: "7 Hari" },
              { id: "this_month", label: "Bulan Ini" },
              { id: "last_month", label: "Bulan Lalu" },
              { id: "this_year", label: "Tahun Ini" },
              { id: "month", label: "Pilih Bulan" },
              { id: "custom", label: "Rentang Hari" },
            ].map((p) => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as any)}
                  className={`relative px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="ownerPeriodTab"
                      className="absolute inset-0 bg-brand-50 dark:bg-brand-500/20 rounded-lg shadow-2xs border border-brand-200/70 dark:border-brand-500/30"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{p.label}</span>
                </button>
              );
            })}
          </div>

          {period === "month" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">
                Bulan Terpilih:
              </span>
              <CustomMonthPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                allowClear={false}
                buttonClassName="py-1 px-3 text-xs rounded-xl"
              />
            </div>
          )}

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">
                Rentang Hari:
              </span>
              <CustomDatePicker
                value={customStartDate}
                onChange={setCustomStartDate}
                placeholder="Dari"
              />
              <span className="text-slate-400 font-semibold">–</span>
              <CustomDatePicker
                value={customEndDate}
                onChange={setCustomEndDate}
                placeholder="Sampai"
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Target Omzet Bulanan Run-Rate Bar ─────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50/90 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
              <Target className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
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
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                {isEditingTarget && canSetTarget ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-slate-400 font-semibold">Rp</span>
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
                      className="px-2.5 py-1 text-sm font-bold border border-slate-300 rounded-xl w-36 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveTarget}
                      className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-brand-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setIsEditingTarget(false)}
                      className="px-2 py-1 text-slate-500 text-xs hover:text-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {formatCurrency(totalRevenue)}{" "}
                    <span className="text-xs sm:text-sm font-normal text-slate-400 font-sans">
                      / {formatCurrency(monthlyTarget)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs bg-slate-50/80 p-2.5 sm:px-4 rounded-2xl border border-slate-200/60 self-start md:self-auto">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Capaian</span>
              <span className="font-extrabold text-slate-900 text-sm">{targetProgress}%</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Sisa Target</span>
              <span className="font-semibold text-slate-700">
                {formatCurrency(Math.max(0, monthlyTarget - totalRevenue))}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Kas Runway (Ops)</span>
              <span className="font-bold text-emerald-600 tabular-nums">
                {cashRunwayMonths} Bulan Aman
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar track */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${targetProgress}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className={`h-full rounded-full shadow-xs ${
              targetProgress >= 90
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : targetProgress >= 60
                ? "bg-gradient-to-r from-brand-600 to-brand-500"
                : "bg-gradient-to-r from-brand-600 to-brand-500"
            }`}
          />
        </div>
      </div>

      {/* ─── The Big 4 Executive KPI Cards ─────────────────────────────────── */}
      <motion.div
        key={`kpi-grid-${period}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* KPI 1: Total Omzet */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 340, delay: 0 }}
          className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Omzet</span>
            <div className="w-11 h-11 rounded-2xl bg-brand-50/80 text-brand-600 border border-brand-200/60 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-xs">
              {revenueGrowthPct === null ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 font-bold text-[11px]">
                  Periode Awal
                </span>
              ) : revenueGrowthPct >= 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-bold text-[11px] tabular-nums">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" /> +{revenueGrowthPct}%
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-rose-700 bg-rose-50 border border-rose-200/60 font-bold text-[11px] tabular-nums">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" /> {revenueGrowthPct}%
                </span>
              )}
              <span className="text-slate-400 text-[11px]">vs periode lalu</span>
            </div>
          </div>
        </motion.div>

        {/* KPI 2: Laba Bersih Riil & Margin */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 340, delay: 0.06 }}
          className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Laba Bersih Riil</span>
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform ${
                netProfit >= 0
                  ? "bg-emerald-50/80 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/30"
                  : "bg-rose-50/80 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/30"
              }`}
            >
              <RupiahSign className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                netProfit >= 0 ? "text-slate-900 dark:text-slate-100" : "text-rose-600 dark:text-rose-300"
              }`}
            >
              {formatCurrency(netProfit)}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-xs">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold border text-[11px] ${
                  netProfit >= 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                    : "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                }`}
              >
                {netProfitMargin.toFixed(1)}% Margin
              </span>
              <span className="text-slate-400 text-[11px]">setelah HPP &amp; opex</span>
            </div>
          </div>
        </motion.div>

        {/* KPI 3: Average Ticket Value (ATV / Basket Size) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 340, delay: 0.12 }}
          className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rata-rata Struk (ATV)</span>
            <div className="w-11 h-11 rounded-2xl bg-brand-50/80 text-brand-600 border border-brand-200/60 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {formatCurrency(averageTicketValue)}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{transactionCount}</span>
              <span className="text-slate-400 text-[11px]">total pesanan tamu</span>
            </div>
          </div>
        </motion.div>

        {/* KPI 4: Total Cup / Produk Terjual */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 340, delay: 0.18 }}
          className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Volume Terjual</span>
            <div className="w-11 h-11 rounded-2xl bg-amber-50/80 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Coffee className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {totalCupsSold.toLocaleString("id-ID")}{" "}
              <span className="text-sm font-semibold text-slate-400">Cup/Item</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-500">
              {totalCupsSold > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200/60 text-[11px]">
                  <Sparkles className="w-3 h-3 mr-1 text-amber-500 fill-amber-500" /> Aktif Berjalan
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200/60 text-[11px]">
                  Belum Ada Penjualan
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Unit Economics: 3 Rasio Emas Kafe ─────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Unit Economics & Rasio Beban Kafe
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tolak ukur efisiensi biaya terhadap omzet sesuai standar Specialty Coffee & Eatery.
              </p>
            </div>
          </div>
          {totalRevenue <= 0 ? (
            <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 shadow-2xs">
              Menunggu Data Omzet
            </span>
          ) : cogsRatio <= 35 && laborRatio <= 22 ? (
            <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
              ✓ Biaya Terkendali
            </span>
          ) : (
            <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60 shadow-2xs">
              ⚠ Rasio Biaya Tinggi
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ratio 1: COGS / HPP */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700">HPP / COGS (Bahan Baku)</span>
              <span className={`font-extrabold text-sm ${cogsRatio <= 35 && cogsRatio > 0 ? "text-emerald-700" : cogsRatio > 35 ? "text-rose-600" : "text-slate-500"}`}>
                {cogsRatio.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden my-2.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${cogsRatio <= 35 && cogsRatio > 0 ? "bg-emerald-500" : cogsRatio > 35 ? "bg-rose-500" : "bg-slate-300"}`}
                style={{ width: `${Math.min(100, cogsRatio)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Ideal: 28% - 35%</span>
              <span className="font-bold text-slate-800">{formatCurrency(cogsExpenses)}</span>
            </div>
          </div>

          {/* Ratio 2: Labor Cost */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700">Labor Cost (Gaji Staf)</span>
              <span className={`font-extrabold text-sm ${laborRatio <= 22 && laborRatio > 0 ? "text-emerald-700" : laborRatio > 22 ? "text-amber-600" : "text-slate-500"}`}>
                {laborRatio.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden my-2.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${laborRatio <= 22 && laborRatio > 0 ? "bg-emerald-500" : laborRatio > 22 ? "bg-amber-500" : "bg-slate-300"}`}
                style={{ width: `${Math.min(100, laborRatio)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Ideal: 15% - 22%</span>
              <span className="font-bold text-slate-800">{formatCurrency(laborExpenses)}</span>
            </div>
          </div>

          {/* Ratio 3: OpEx Ratio */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700">OpEx (Listrik, Sewa, Wifi)</span>
              <span className={`font-extrabold text-sm ${opexRatio <= 18 && opexRatio > 0 ? "text-emerald-700" : opexRatio > 18 ? "text-amber-600" : "text-slate-500"}`}>
                {opexRatio.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden my-2.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${opexRatio <= 18 && opexRatio > 0 ? "bg-emerald-500" : opexRatio > 18 ? "bg-amber-500" : "bg-slate-300"}`}
                style={{ width: `${Math.min(100, opexRatio)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Ideal: 12% - 18%</span>
              <span className="font-bold text-slate-800">{formatCurrency(opexExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Peringatan Dini & Deteksi Kebocoran (Loss Prevention) ─────────── */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${FEATURES.POS ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        {/* Kebocoran 1: Diskon & Promo */}
        <div className="bg-gradient-to-br from-amber-50/60 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 p-5 rounded-3xl border border-amber-200/70 dark:border-amber-500/30 shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Potongan Diskon</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100/80 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200/70 dark:border-amber-500/30 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Award className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
              {formatCurrency(totalDiscounts)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Margin terpotong promo periode ini
            </p>
          </div>
        </div>

        {/* Kebocoran 2: Selisih Laci & Void */}
{FEATURES.POS && (
<>
        <div className={`bg-gradient-to-br ${
          voidSummary.discrepancyTotal > 0
            ? "from-rose-50/60 via-white to-white border-rose-200/70 dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 dark:border-rose-500/30"
            : "from-emerald-50/60 via-white to-white border-emerald-200/70 dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 dark:border-emerald-500/30"
        } p-5 rounded-3xl border shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all duration-200 flex flex-col justify-between group`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Selisih Kasir / Void</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-100/80 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200/70 dark:border-rose-500/30 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className={`text-xl font-extrabold tracking-tight tabular-nums ${voidSummary.discrepancyTotal > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}>
              {voidSummary.discrepancyTotal > 0 ? formatCurrency(voidSummary.discrepancyTotal) : "Rp 0 (Klop)"}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {voidSummary.discrepancyTotal > 0 ? "Terdapat deviasi kasir" : "Semua shift terekonsiliasi"}
            </p>
          </div>
        </div>

        </>
)}
{/* Kebocoran 3: Waste Cost */}
        <div className="bg-gradient-to-br from-amber-50/60 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 p-5 rounded-3xl border border-amber-200/70 dark:border-amber-500/30 shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bahan Terbuang (Waste)</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100/80 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200/70 dark:border-amber-500/30 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
              {formatCurrency(wasteCost)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Kerugian susu basi & failed shot
            </p>
          </div>
        </div>

        {/* Kebocoran 4: Total Likuiditas Kas (Ops vs Tabungan) */}
        <div className="bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 p-5 rounded-3xl border border-emerald-200/70 dark:border-emerald-500/30 shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Likuiditas Kas</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 tracking-tight tabular-nums">
              {formatCurrency(totalCashLiquidity)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] tabular-nums">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-semibold">
                Ops: {formatCurrency(operationalLiquidity)}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold inline-flex items-center gap-1">
                <PiggyBank className="w-3 h-3" />
                {formatCurrency(savingsLiquidity)}
              </span>
            </div>
            {periodSummary.netSavingsAllocation !== 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
                Sisihan periode: {periodSummary.netSavingsAllocation > 0 ? "+" : ""}
                {formatCurrency(periodSummary.netSavingsAllocation)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Rekap Keuntungan & Bagi Hasil Owner ──────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-coffee-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Rekap Keuntungan &amp; Bagi Hasil Owner ({getPeriodLabelText()})</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Porsi hak owner dari laba bersih dikurangi Prive yang sudah ditarik, cadangan Tabungan Kedai, dan CapEx periode ini.
            </p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30">
            Owner {profitAllocation.ownerSharePercent}% • Tabungan {profitAllocation.reserveSharePercent}%
            {profitAllocation.investorSharePercent > 0 ? ` • Investor ${profitAllocation.investorSharePercent}%` : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 border border-brand-200/70 dark:border-brand-500/30 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sisa Hak Owner ({profitAllocation.ownerSharePercent}%)
            </span>
            <p className={`text-xl font-black font-mono tabular-nums ${profitAllocation.ownerRemainingEntitlement >= 0 ? "text-brand-700 dark:text-brand-300" : "text-rose-600 dark:text-rose-300"}`}>
              {formatCurrency(profitAllocation.ownerRemainingEntitlement)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Porsi: {formatCurrency(profitAllocation.ownerShareAmount)} − Prive: {formatCurrency(profitAllocation.ownerPriveTotal)}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-500/30 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cadangan Tabungan ({profitAllocation.reserveSharePercent}%)
            </span>
            <p className="text-xl font-black font-mono tabular-nums text-amber-700 dark:text-amber-300">
              {formatCurrency(profitAllocation.reserveShareAmount)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Tersetor: {formatCurrency(profitAllocation.netSavingsAllocation)} • Sisa: {formatCurrency(profitAllocation.reserveRemainingToTransfer)}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Laba Ditahan Bersih
            </span>
            <p className={`text-xl font-black font-mono tabular-nums ${profitAllocation.retainedProfitAfterPrive >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
              {formatCurrency(profitAllocation.retainedProfitAfterPrive)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Laba Bersih {formatCurrency(profitAllocation.netProfit)} − Prive
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {profitAllocation.investorSharePercent > 0
                ? `Investor (${profitAllocation.investorSharePercent}%) & CapEx`
                : "Belanja Aset / CapEx"}
            </span>
            <p className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatCurrency(
                profitAllocation.investorSharePercent > 0
                  ? profitAllocation.investorShareAmount
                  : profitAllocation.capexExpense
              )}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              CapEx periode: {formatCurrency(profitAllocation.capexExpense)}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Pilar 4: Kinerja SDM, Beban Payroll & Kepatuhan Supervisi ──── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Kinerja SDM, Payroll & Disiplin Supervisi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring staf aktif, beban gaji bulanan, dan kepatuhan checklist SOP lapangan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate("payroll")}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer bg-brand-50/70 hover:bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200/60 transition-all"
            >
              <span>Laporan Payroll</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tim Aktif */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tim Aktif</span>
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-200/60 flex items-center justify-center shadow-2xs">
                <Users className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {sdmMetrics.activeStaffCount} <span className="text-xs font-semibold text-slate-400">Orang</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Barista, Kitchen, Kasir & Leader
            </p>
          </div>

          {/* Card 2: Beban Payroll Bulanan */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Estimasi Payroll</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-2xs">
                <RupiahSign className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(sdmMetrics.totalPayrollAmount)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Gaji pokok, tunjangan & bonus KPI
            </p>
          </div>

          {/* Card 3: Kepatuhan Checklist Jobdesk */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Checklist SOP</span>
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-200/60 flex items-center justify-center shadow-2xs">
                <CheckSquare className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              {sdmMetrics.hasChecklistData ? (
                <>
                  <span className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    {sdmMetrics.checklistCompliance}%
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    sdmMetrics.checklistCompliance >= 85
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {sdmMetrics.checklistCompliance >= 85 ? "SOP Disiplin" : "Perlu Atensi"}
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-slate-400">Belum Ada Data</span>
              )}
            </div>
            <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden mt-2.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  sdmMetrics.checklistCompliance >= 85 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${sdmMetrics.checklistCompliance}%` }}
              />
            </div>
          </div>

          {/* Card 4: Rasio Kehadiran Tim */}
          <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Presensi Shift</span>
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/60 flex items-center justify-center shadow-2xs">
                <Clock className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {sdmMetrics.hasAttendanceData ? `${sdmMetrics.attendanceRate}%` : "Belum Ada Data"}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Disiplin kehadiran & ketepatan jam shift
            </p>
          </div>
        </div>
      </div>

      {/* ─── Tren Penjualan & Laba Bersih (Area Chart) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
                <BarChart3 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Tren Omzet vs Laba Bersih
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pertumbuhan bisnis dan margin bersih 6 bulan terakhir.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold bg-slate-50 px-3.5 py-1.5 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shadow-xs" />
                <span className="text-slate-700">Omzet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                <span className="text-slate-700">Laba Bersih</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ownerRevGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1b2cc0" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#1b2cc0" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ownerProfitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Omzet"
                  stroke="#1b2cc0"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#ownerRevGradient)"
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Laba Bersih"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#ownerProfitGradient)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Komposisi Omzet per Kategori */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                <PieIcon className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Kontributor Omzet
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribusi penjualan per lini produk kafe.
                </p>
              </div>
            </div>

            {categoryContribution.length === 0 ? (
              <div className="h-44 w-full my-3 flex flex-col items-center justify-center text-center">
                <PieIcon className="w-8 h-8 text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">Belum Ada Omzet Tercatat</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mt-0.5">
                  Distribusi lini produk akan otomatis terbentuk dari data penjualan yang diimpor.
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
                        borderRadius: "16px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontSize: "12px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
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
                <div key={c.name} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-600 font-medium">{c.name}</span>
                  </div>
                  <span className="font-extrabold text-slate-900">
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Peta Jam Sibuk (Traffic Velocity)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Waktu puncak pesanan untuk alokasi barista & promo happy hour.
                  </p>
                </div>
              </div>
              {peakHourData.some((slot) => slot.count > 0) && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60 shadow-2xs">
                  Terpantau Aktif
                </span>
              )}
            </div>

            {peakHourData.every((slot) => slot.count === 0) ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <Clock className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Belum Ada Transaksi Pada Periode Ini</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Peta jam sibuk (pagi, siang, sore, malam) akan terisi otomatis dari data rekap / impor penjualan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {peakHourData.map((slot) => {
                  const maxRev = Math.max(...peakHourData.map((p) => p.revenue));
                  const pct = maxRev > 0 ? Math.round((slot.revenue / maxRev) * 100) : 0;

                  return (
                    <div key={slot.slot} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60 hover:bg-white hover:shadow-xs transition-all">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{slot.slot}</span>
                          <span className="text-slate-500 text-[11px] hidden sm:inline">({slot.label})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-medium">{slot.count} Transaksi</span>
                          <span className="font-extrabold text-slate-900">{formatCurrency(slot.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-all duration-700"
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                  <Flame className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Menu Bintang (Cash Cows)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    5 produk penyumbang omzet terbesar dengan margin tertinggi.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate("import_sales")}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50/70 hover:bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200/60 transition-all cursor-pointer"
              >
                <span>Lihat Penjualan</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-2">
                  <Coffee className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Belum Ada Menu Terjual</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Impor rekap penjualan dari aplikasi POS akan otomatis menampilkan menu terlaris kafe di sini.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => onNavigate("import_sales")}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-xs shadow-brand-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    Impor Data POS
                  </button>
                  {FEATURES.POS && userRole !== "OWNER" && (
                  <button
                    onClick={() => onNavigate("shifts")}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                  >
                    Buka Kasir
                  </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((prod, idx) => (
                  <div key={prod.name} className="p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold shadow-2xs ${
                        idx === 0 ? "bg-brand-600 text-white" : idx === 1 ? "bg-slate-800 text-white" : idx === 2 ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
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
                      <span className="text-xs font-extrabold text-slate-900 block tracking-tight">
                        {formatCurrency(prod.rev)}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-[10px] text-emerald-700 font-bold border border-emerald-200/60">
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

      {/* ─── Pengawasan Fraud, Void & Refund (Loss Prevention) ───────────── */}
{FEATURES.POS && (
<>
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  Pengawasan Fraud, Void & Refund (Loss Prevention)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] text-emerald-700 font-bold border border-emerald-200/60">
                  Audit Terintegrasi POS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengawasan pembatalan pesanan kasir, refund dana fisik, dan akuntabilitas laci kas (SOP #10).
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate("audit_log")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Log Aktivitas Lengkap →</span>
          </button>
        </div>

        {/* 4 Loss Prevention KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Refund Hari Ini */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Refund
              </span>
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {formatCurrency(posTodayStats.totalRefund)}
            </p>
            <p className="text-[11px] text-slate-500">
              {posTodayStats.refundCount} transaksi dikembalikan
            </p>
          </div>

          {/* Card 2: Order Void (Dibatalkan) */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Order Void (Batal)
              </span>
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {posTodayStats.voidCount} Transaksi
            </p>
            <p className="text-[11px] text-slate-500">
              Open bill & tiket dibatalkan
            </p>
          </div>

          {/* Card 3: Rasio Pembatalan (Cancellation Ratio) */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Rasio Pembatalan
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                cancellationMetrics.ratio <= 2
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : cancellationMetrics.ratio <= 5
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {cancellationMetrics.ratio <= 2
                  ? "Normal (<2%)"
                  : cancellationMetrics.ratio <= 5
                  ? "Waspada"
                  : "Investigasi (>5%)"}
              </span>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {cancellationMetrics.ratio.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-500">
              {cancellationMetrics.cancelledCount} dari {cancellationMetrics.totalTransactions} total order
            </p>
          </div>

          {/* Card 4: Status Shift Kasir & PIC */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Shift Kasir Aktif
              </span>
              <div className="w-7 h-7 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xs font-black text-slate-900 truncate">
              {activeShift ? activeShift.picEmployeeName || "Kasir Bertugas" : "Tidak Ada Shift Aktif"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {activeShift
                ? `Modal Kas: ${formatCurrency(activeShift.startingCash || 0)}`
                : "Terminal kasir tertutup"}
            </p>
          </div>
        </div>

        {/* Tabel Log Otorisasi Terkini */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Log Otorisasi Manager Terkini (Void & Refund)
            </h4>
            <span className="text-[11px] text-slate-400">
              Menampilkan {approvalHistory.slice(0, 5).length} riwayat terbaru
            </span>
          </div>

          {approvalHistory.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-700">Belum Ada Riwayat Void / Refund</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Semua transaksi kasir berjalan normal tanpa insiden pembatalan.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Waktu & Struk</th>
                      <th className="py-2.5 px-3.5">Tipe</th>
                      <th className="py-2.5 px-3.5">Meja / Tamu</th>
                      <th className="py-2.5 px-3.5">Nominal</th>
                      <th className="py-2.5 px-3.5">Alasan Pemohon</th>
                      <th className="py-2.5 px-3.5">Penyetuju</th>
                      <th className="py-2.5 px-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {approvalHistory.slice(0, 5).map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                          <div>#{req.receiptNo}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {req.respondedAt
                              ? new Date(req.respondedAt).toLocaleTimeString("id-ID", {
                                  timeZone: DEFAULT_STORE_TIMEZONE,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                            req.type === "REFUND"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {req.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {req.tableNumber} ({req.customerName || "Tamu"})
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {req.amount > 0 ? formatCurrency(req.amount) : "-"}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-800 whitespace-nowrap font-semibold">
                          {req.respondedBy || "Manager"}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            req.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : req.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {req.status === "APPROVED" ? "Disetujui" : req.status === "REJECTED" ? "Ditolak" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      </>
)}
{/* ─── Navigasi Cepat Eksekutif (Bottom Actions) ──────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 sm:p-7 shadow-xl border border-brand-700/60 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1 text-center md:text-left">
          <h4 className="text-base sm:text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Ingin Analisis Finansial Lebih Mendalam?
          </h4>
          <p className="text-xs text-slate-300 max-w-xl">
            Akses langsung buku kas besar, laporan laba rugi bulanan, atau pantau kas & bank Julia's secara real-time.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => onNavigate("cash_flow")}
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 transition-all shadow-xs cursor-pointer"
          >
            Buku Kas Besar
          </button>
          <button
            onClick={() => onNavigate("finance_reports")}
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 transition-all shadow-xs cursor-pointer"
          >
            Laba Rugi (P&L)
          </button>
          <button
            onClick={() => onNavigate("dashboard_finance")}
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-brand-500 hover:bg-brand-400 active:scale-95 text-white transition-all shadow-md cursor-pointer"
          >
            Kas & Bank →
          </button>
        </div>
      </div>
    </div>
  );
};
