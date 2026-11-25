import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ConfirmModal } from "./common/ConfirmModal";
import { formatCurrency } from "../utils/format";
import { getLocalDateString, getLocalPeriodString } from "../utils/dateUtils";
import { authFetch } from "../utils/authHeaders";
import { ClosedPeriodSnapshot } from "../types";
import {
  addDaysToLocalDate,
  computeBudgetVsActual,
  getLocalPeriodFromTimestamp,
} from "../utils/syncSanitizers";
import {
  calculateFnbHealthMetrics,
  computeCashLiquidityBreakdown,
  computeOwnerProfitAllocation,
  computePeriodFinancialSummary,
  getPreviousPeriodString,
  isCapexCashTransaction,
  isNonOperationalCashTransaction,
} from "../utils/financeMetrics";
import {
  Lock,
  Unlock,
  AlertTriangle,
  Download,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wallet,
  PiggyBank,
  Clock,
  PieChart as PieChartIcon,
  CheckCircle2,
  Layers,
  Receipt,
  CreditCard,
  Building2,
  ShoppingBag,
  Package,
  Users,
  Zap,
  FileText,
  BarChart3,
  Eye,
  Scale,
  AlertCircle,
  Info,
  Target,
  Plus,
  Edit2,
  Trash2,
  X,
  Calendar,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { ExportModal } from "./ExportModal";
import { motion, AnimatePresence } from "motion/react";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomDatePicker } from "./common/CustomDatePicker";
import { CustomSelect } from "./common/CustomSelect";
import { CurrencyInput } from "./common/CurrencyInput";

const FinanceReports: React.FC = () => {
  const {
    currentUser,
    isReadOnly,
    cashAccounts,
    cashTransactions,
    expenseCategories,
    purchaseOrders,
    payrollRecords,
    dailySalesRecaps = [],
    salesTransactions,
    recipes,
    ingredients,
    products,
    stockOpnames = [],
    stockOpnameItems = [],
    bankReconciliations,
    bankStatementLines,
    budgets,
    addBudget,
    updateBudget,
    deleteBudget,
    closedPeriods,
    closePeriod,
    reopenPeriod,
    settings,
  } = useStore();

  const isOwner = currentUser?.role === "OWNER" || isReadOnly;
  const canManagePeriod = Boolean(
    currentUser &&
      !isOwner &&
      ["FINANCE", "MANAGER", "SUPER_ADMIN"].includes(currentUser.role)
  );
  const canReopenPeriod = Boolean(
    currentUser &&
      !isOwner &&
      ["MANAGER", "SUPER_ADMIN"].includes(currentUser.role)
  );

  const [filterMode, setFilterMode] = useState<"monthly" | "range">("monthly");
  const [period, setPeriod] = useState<string>(() => getLocalPeriodString());
  const [rangeStartDate, setRangeStartDate] = useState<string>(() =>
    addDaysToLocalDate(getLocalDateString(), -6)
  );
  const [rangeEndDate, setRangeEndDate] = useState<string>(() =>
    getLocalDateString()
  );
  const [activeTab, setActiveTab] = useState<"pnl" | "budget" | "reconciliation">("pnl");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [periodConfirmAction, setPeriodConfirmAction] = useState<"close" | "reopen" | null>(null);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [reopenReason, setReopenReason] = useState<string>("");
  const [reopenPin, setReopenPin] = useState<string>("");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [isVerifyingReopen, setIsVerifyingReopen] = useState(false);

  // Budget CRUD modal & confirmation state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>("");
  const [budgetAmountInput, setBudgetAmountInput] = useState<string>("");
  const [budgetNotes, setBudgetNotes] = useState<string>("");
  const [budgetToDeleteId, setBudgetToDeleteId] = useState<string | null>(null);

  const activeClosedRecord = useMemo(() => {
    return closedPeriods.find((p) => p.period === period) || null;
  }, [closedPeriods, period]);

  const isPeriodClosed = Boolean(activeClosedRecord);

  const canEditBudget = !isOwner && !isPeriodClosed;

  // ─── CATEGORY MAPPING HELPERS ─────────────────────────────────────────────
  const getCategoryType = (categoryId?: string | null): string => {
    if (!categoryId) return "PENGELUARAN";
    const cat = expenseCategories.find((c) => c.id === categoryId);
    if (!cat) return "PENGELUARAN";
    if (cat.type) return cat.type;
    if (cat.parentId) {
      const parent = expenseCategories.find((p) => p.id === cat.parentId);
      if (parent?.type) return parent.type;
    }
    return "PENGELUARAN";
  };

  // ─── FILTER DATA BY PERIOD OR DATE RANGE (ZONA WAKTU WITA) ───────────────
  const normalizedRangeStart =
    rangeStartDate <= rangeEndDate ? rangeStartDate : rangeEndDate;
  const normalizedRangeEnd =
    rangeStartDate <= rangeEndDate ? rangeEndDate : rangeStartDate;

  const matchesFilterDate = (rawDate: string | undefined | null): boolean => {
    if (!rawDate) return false;
    if (filterMode === "range") {
      const day = getLocalDateString(new Date(rawDate));
      return Boolean(
        day &&
          (!normalizedRangeStart || day >= normalizedRangeStart) &&
          (!normalizedRangeEnd || day <= normalizedRangeEnd)
      );
    }
    return getLocalPeriodFromTimestamp(rawDate) === period;
  };

  const activeFilterLabel =
    filterMode === "monthly"
      ? period
      : `${normalizedRangeStart} s.d. ${normalizedRangeEnd}`;

  const periodAllCashTransactions = useMemo(() => {
    return cashTransactions.filter((t) => matchesFilterDate(t.date));
  }, [cashTransactions, filterMode, period, normalizedRangeStart, normalizedRangeEnd]);

  const periodTransactions = useMemo(() => {
    return periodAllCashTransactions.filter((t) => !isNonOperationalCashTransaction(t));
  }, [periodAllCashTransactions]);

  const periodRecaps = useMemo(() => {
    return dailySalesRecaps.filter((r) => matchesFilterDate(r.date));
  }, [dailySalesRecaps, filterMode, period, normalizedRangeStart, normalizedRangeEnd]);

  const periodPayrolls = useMemo(() => {
    if (filterMode === "range") {
      const startPeriod = normalizedRangeStart.slice(0, 7);
      const endPeriod = normalizedRangeEnd.slice(0, 7);
      return payrollRecords.filter(
        (p) => p.period >= startPeriod && p.period <= endPeriod
      );
    }
    return payrollRecords.filter((p) => p.period === period);
  }, [payrollRecords, filterMode, period, normalizedRangeStart, normalizedRangeEnd]);

  const periodPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => matchesFilterDate(po.date));
  }, [purchaseOrders, filterMode, period, normalizedRangeStart, normalizedRangeEnd]);

  const periodBankRecons = useMemo(() => {
    if (filterMode === "range") {
      const startPeriod = normalizedRangeStart.slice(0, 7);
      const endPeriod = normalizedRangeEnd.slice(0, 7);
      return bankReconciliations.filter(
        (r) => r.period >= startPeriod && r.period <= endPeriod
      );
    }
    return bankReconciliations.filter((r) => r.period === period);
  }, [bankReconciliations, filterMode, period, normalizedRangeStart, normalizedRangeEnd]);

  // ─── I. PENDAPATAN OPERASIONAL (REVENUE) TERPUSAT ───────────────────────────
  const unifiedPeriodSummary = useMemo(() => {
    return computePeriodFinancialSummary({
      period: filterMode === "monthly" ? period : "ALL",
      ...(filterMode === "range"
        ? { startDate: normalizedRangeStart, endDate: normalizedRangeEnd }
        : {}),
      salesTransactions,
      dailySalesRecaps,
      cashTransactions,
      expenseCategories,
      payrollRecords,
      recipes,
      ingredients,
      products,
      stockOpnames,
      stockOpnameItems,
      purchaseOrders,
      cashAccounts,
    });
  }, [
    filterMode,
    period,
    normalizedRangeStart,
    normalizedRangeEnd,
    salesTransactions,
    dailySalesRecaps,
    cashTransactions,
    expenseCategories,
    payrollRecords,
    recipes,
    ingredients,
    products,
    stockOpnames,
    stockOpnameItems,
    purchaseOrders,
    cashAccounts,
  ]);

  const totalCashIn = unifiedPeriodSummary.totalOperationalCashIn;

  // Penjualan Kotor, Diskon, Refund & Penjualan Bersih (dari engine akuntansi terpusat)
  const grossSales = unifiedPeriodSummary.grossSales;
  const totalDiscountAmount = unifiedPeriodSummary.totalDiscountAmount;
  const totalRefundAmount = unifiedPeriodSummary.totalRefundAmount;
  const netSales = unifiedPeriodSummary.netSales;

  // Breakdown Metode Pembayaran Rekap Kasir (Tunai, QRIS, EDC, Transfer, Ojol/Delivery)
  const paymentMethodBreakdown = unifiedPeriodSummary.paymentBreakdown;

  // ─── II. HARGA POKOK PENJUALAN (HPP / COGS — OPSI A PERIODIK OPNAME) ─────
  const ingredientTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (t.type !== "CASH_OUT") return false;
      const catType = getCategoryType(t.categoryId);
      return (
        catType === "BAHAN_BAKU" ||
        t.categoryId === "cat-bahan-baku" ||
        (t.category && t.category.toLowerCase().includes("bahan"))
      );
    });
  }, [periodTransactions, expenseCategories]);

  const totalActualCOGS = useMemo(() => {
    return ingredientTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [ingredientTransactions]);

  // Komponen HPP Periodik Opsi A: Persediaan Awal + Pembelian Bahan − Persediaan Akhir Opname
  const openingInventoryValue = unifiedPeriodSummary.openingInventoryValue;
  const periodMaterialPurchases = unifiedPeriodSummary.periodMaterialPurchases;
  const poReceivedPurchases = unifiedPeriodSummary.poReceivedPurchases;
  const directCashMaterialPurchases = unifiedPeriodSummary.directCashMaterialPurchases;
  const closingInventoryValue = unifiedPeriodSummary.closingInventoryValue;
  const theoreticalCOGS = unifiedPeriodSummary.theoreticalCOGS;
  const effectiveCOGS = unifiedPeriodSummary.effectiveCOGS;
  const cogsMethod = unifiedPeriodSummary.cogsMethod;
  const cogsVariance = unifiedPeriodSummary.cogsVariance;
  const opnameCoverageCount = unifiedPeriodSummary.opnameCoverageCount;
  const opnameTotalIngredients = unifiedPeriodSummary.opnameTotalIngredients;
  const hasOpeningOpname = unifiedPeriodSummary.hasOpeningOpname;
  const hasClosingOpname = unifiedPeriodSummary.hasClosingOpname;
  const foodCostPercentage = netSales > 0 ? (effectiveCOGS / netSales) * 100 : 0;

  // ─── III. LABA KOTOR (GROSS PROFIT) ───────────────────────────────────────
  const grossProfit = unifiedPeriodSummary.grossProfit;
  const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // ─── IV. BEBAN OPERASIONAL (OPERATING EXPENSES / OPEX — BEBAS CAPEX) ────
  // 1. Beban SDM / HRD / Payroll (sub-breakdown per kategori untuk rincian P&L)
  const hrdTransactions = useMemo(() => {
    const hrdKeywords = [
      "gaji",
      "upah",
      "bonus",
      "tunjangan",
      "kasbon",
      "lembur",
      "bpjs",
      "asuransi",
      "pelatihan",
      "seragam",
      "hrd",
      "sdm",
      "payroll",
    ];
    return periodTransactions.filter((t) => {
      if (t.type !== "CASH_OUT") return false;
      if (isCapexCashTransaction(t, expenseCategories)) return false;
      const catType = getCategoryType(t.categoryId);
      const catText = (t.category || "").toLowerCase();
      const isBahan =
        catType === "BAHAN_BAKU" ||
        t.categoryId === "cat-bahan-baku" ||
        catText.includes("bahan") ||
        catText.includes("cogs");
      if (isBahan) return false;
      return (
        catType === "HRD" ||
        t.categoryId === "cat-hrd" ||
        (!t.categoryId && hrdKeywords.some((kw) => catText.includes(kw)))
      );
    });
  }, [periodTransactions, expenseCategories]);

  const totalHrdExpense = unifiedPeriodSummary.totalHrdExpense;

  // Rincian Beban HRD per Sub-Kategori (Gaji, Bonus/Tunjangan, BPJS, Seragam/Pelatihan)
  const hrdBreakdown = useMemo(() => {
    const map: Record<string, { name: string; amount: number }> = {};
    hrdTransactions.forEach((t) => {
      const cat = expenseCategories.find((c) => c.id === t.categoryId);
      const label = cat ? cat.name : t.category || "Gaji & Biaya SDM Lainnya";
      if (!map[label]) {
        map[label] = { name: label, amount: 0 };
      }
      map[label].amount += t.amount;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [hrdTransactions, expenseCategories]);

  const totalUtilityExpense = unifiedPeriodSummary.totalUtilityExpense;
  const totalGeneralOpsExpense = unifiedPeriodSummary.totalGeneralOpsExpense;
  const totalAdminBankExpense = unifiedPeriodSummary.totalAdminBankExpense;
  const totalOPEX = unifiedPeriodSummary.totalOPEX;

  // Pos Non-Laba/Rugi & Arus Cadangan (Bagian VI)
  const capexExpense = unifiedPeriodSummary.capexExpense;
  const savingsDeposit = unifiedPeriodSummary.savingsDeposit;
  const savingsWithdrawal = unifiedPeriodSummary.savingsWithdrawal;
  const netSavingsAllocation = unifiedPeriodSummary.netSavingsAllocation;
  const pendingNonCashSettlement = unifiedPeriodSummary.pendingNonCashSettlement;

  // ─── V. LABA BERSIH OPERASIONAL (NET OPERATING PROFIT) ────────────────────
  const netOperatingProfit = unifiedPeriodSummary.netProfit;
  const netProfitMargin = unifiedPeriodSummary.netMarginPercent;

  // ─── V-A. ALOKASI KEUNTUNGAN & BAGI HASIL OWNER ──────────────────────────
  const profitAllocation = useMemo(() => {
    return computeOwnerProfitAllocation({
      netProfit: netOperatingProfit,
      cashTransactions: periodAllCashTransactions,
      cashAccounts,
      expenseCategories,
      ownerPercent: settings.profitShareOwnerPercent,
      reservePercent: settings.profitShareReservePercent,
      investorPercent: settings.profitShareInvestorPercent,
    });
  }, [
    netOperatingProfit,
    periodAllCashTransactions,
    cashAccounts,
    expenseCategories,
    settings.profitShareOwnerPercent,
    settings.profitShareReservePercent,
    settings.profitShareInvestorPercent,
  ]);

  // ─── V-B. INDIKATOR KESEHATAN BIAYA F&B & BEP OMZET ───────────────────────
  const fnbHealth = useMemo(() => {
    return calculateFnbHealthMetrics({
      netSales,
      effectiveCOGS,
      totalHrdExpense,
      totalOPEX,
    });
  }, [netSales, effectiveCOGS, totalHrdExpense, totalOPEX]);

  // ─── VI. REKONSILIASI KAS & POS AKUN (OPERASIONAL VS TABUNGAN) ───────────
  const liquidityBreakdown = useMemo(
    () => computeCashLiquidityBreakdown(cashAccounts, cashTransactions),
    [cashAccounts, cashTransactions]
  );
  const accountBalances = liquidityBreakdown.accountBalances;
  const operationalBalance = liquidityBreakdown.operationalBalance;
  const savingsBalance = liquidityBreakdown.savingsBalance;
  const totalLiquidity = liquidityBreakdown.totalLiquidity;

  // Rekonsiliasi Payroll
  const payrollStats = useMemo(() => {
    const draft = periodPayrolls.filter((p) => p.status === "DRAFT");
    const approved = periodPayrolls.filter((p) => p.status === "APPROVED");
    const paid = periodPayrolls.filter((p) => p.status === "PAID");
    const paidTotal = paid.reduce((sum, p) => sum + p.netPay, 0);
    const diff = totalHrdExpense - paidTotal;
    return {
      totalSlips: periodPayrolls.length,
      draftCount: draft.length,
      approvedCount: approved.length,
      paidCount: paid.length,
      paidTotal,
      diff,
      isMatch: Math.abs(diff) < 100, // toleransi pembulatan < Rp100
    };
  }, [periodPayrolls, totalHrdExpense]);

  // Rekonsiliasi Hutang Supplier (Accounts Payable / AP)
  const poStats = useMemo(() => {
    const total = periodPurchaseOrders.length;
    const totalAmount = periodPurchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const paid = periodPurchaseOrders.filter((po) => po.status === "PAID");
    const unpaid = periodPurchaseOrders.filter(
      (po) => po.status === "UNPAID" || po.status === "PARTIAL"
    );
    const unpaidDebt = unpaid.reduce((sum, po) => {
      const rem = po.totalAmount - (po.amountPaid || 0);
      return sum + (rem > 0 ? rem : 0);
    }, 0);
    return {
      total,
      totalAmount,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      unpaidDebt,
    };
  }, [periodPurchaseOrders]);

  // Rekonsiliasi Omzet (memperhitungkan non-tunai yang belum cair H+1)
  const salesReconStats = useMemo(() => {
    const expectedSettledSales = Math.max(0, netSales - pendingNonCashSettlement);
    const diff = totalCashIn - expectedSettledSales;
    return {
      grossSales: netSales,
      totalCashIn,
      pendingNonCashSettlement,
      diff,
      isMatch: Math.abs(diff) < 100,
    };
  }, [netSales, pendingNonCashSettlement, totalCashIn]);

  // Kesiapan Tutup Buku Periode (Closing Checklist — Informatif)
  const closingChecklist = useMemo(() => {
    const unpaidPayrolls = periodPayrolls.filter((p) => p.status !== "PAID").length;
    return [
      {
        label: hasClosingOpname
          ? `Opname FINAL (${opnameCoverageCount}/${opnameTotalIngredients} bahan)`
          : "Opname FINAL belum ada",
        done: hasClosingOpname,
      },
      {
        label:
          pendingNonCashSettlement === 0
            ? "Non-tunai QRIS/EDC/Ojol cair"
            : `Belum cair: ${formatCurrency(pendingNonCashSettlement)}`,
        done: pendingNonCashSettlement === 0,
      },
      {
        label:
          periodPayrolls.length === 0 || unpaidPayrolls === 0
            ? "Payroll periode lunas"
            : `${unpaidPayrolls} slip gaji belum lunas`,
        done: unpaidPayrolls === 0,
      },
      {
        label:
          poStats.unpaidCount === 0
            ? "PO bahan periode lunas"
            : `${poStats.unpaidCount} PO bahan belum lunas`,
        done: poStats.unpaidCount === 0,
      },
    ];
  }, [
    hasClosingOpname,
    opnameCoverageCount,
    opnameTotalIngredients,
    pendingNonCashSettlement,
    periodPayrolls,
    poStats.unpaidCount,
  ]);

  // ─── VII. REALISASI VS ANGGARAN (BUDGET COMPARISON) ──────────────────────
  const budgetComparison = useMemo(() => {
    return computeBudgetVsActual({
      period,
      budgets,
      cashTransactions,
      expenseCategories,
    });
  }, [period, budgets, cashTransactions, expenseCategories]);

  const eligibleBudgetCategories = useMemo(() => {
    const existingBudgetCatIds = new Set(
      budgets
        .filter((b) => b.period === period && b.id !== editingBudgetId)
        .map((b) => b.categoryId)
        .filter(Boolean) as string[],
    );
    const byId = new Map(expenseCategories.map((c) => [c.id, c]));
    return expenseCategories
      .filter(
        (c) =>
          c.type !== "PENDAPATAN" &&
          c.isActive !== false &&
          !existingBudgetCatIds.has(c.id),
      )
      .map((c) => {
        const parent = c.parentId ? byId.get(c.parentId) : undefined;
        return {
          value: c.id,
          label: parent ? `${parent.name} ▸ ${c.name}` : c.name,
        };
      });
  }, [expenseCategories, budgets, period, editingBudgetId]);

  const openBudgetModal = (opts?: {
    budgetId?: string | null;
    categoryId?: string;
    amount?: number;
  }) => {
    if (!canEditBudget) return;
    if (opts?.budgetId) {
      const existing = budgets.find((b) => b.id === opts.budgetId);
      setEditingBudgetId(opts.budgetId);
      setBudgetCategoryId(existing?.categoryId || opts.categoryId || "");
      setBudgetAmountInput(String(Math.round(existing?.amount ?? opts.amount ?? 0)));
      setBudgetNotes(existing?.notes || "");
    } else {
      setEditingBudgetId(null);
      setBudgetCategoryId(opts?.categoryId || eligibleBudgetCategories[0]?.value || "");
      setBudgetAmountInput(opts?.amount && opts.amount > 0 ? String(Math.round(opts.amount)) : "");
      setBudgetNotes("");
    }
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditBudget) return;
    const amt = Math.round(Number(budgetAmountInput) || 0);
    if (!budgetCategoryId) {
      toast.warning("Pilih kategori biaya terlebih dahulu.");
      return;
    }
    if (amt <= 0) {
      toast.warning("Plafon anggaran harus lebih dari Rp 0.");
      return;
    }
    if (editingBudgetId) {
      const prev = budgets.find((b) => b.id === editingBudgetId);
      updateBudget({
        id: editingBudgetId,
        categoryId: budgetCategoryId,
        period,
        amount: amt,
        notes: budgetNotes.trim() || null,
        createdAt: prev?.createdAt || new Date().toISOString(),
        createdBy: prev?.createdBy || currentUser?.name || "Finance",
      });
      toast.success("Plafon anggaran periode berhasil diperbarui.");
    } else {
      addBudget({
        id: `bdg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        categoryId: budgetCategoryId,
        period,
        amount: amt,
        notes: budgetNotes.trim() || null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || "Finance",
      });
      toast.success("Plafon anggaran baru berhasil ditambahkan.");
    }
    setIsBudgetModalOpen(false);
    setEditingBudgetId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── HEADER BANNER ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-4">
        {/* Baris 1: Judul, Status Periode & Tombol Aksi Utama */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15 px-2.5 py-0.5 rounded-full border border-brand-200/60 dark:border-brand-500/30 whitespace-nowrap">
                Financial Statement &amp; Margin Audit
              </span>
              {isPeriodClosed ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 whitespace-nowrap">
                  <Lock className="w-3 h-3 mr-1" />
                  Periode Terkunci (Tutup Buku)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap">
                  <Unlock className="w-3 h-3 mr-1" />
                  Periode Terbuka
                </span>
              )}
              {isOwner && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 whitespace-nowrap">
                  Mode Pemantauan Owner (Read-Only)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Laporan Keuangan &amp; Laba Rugi (P&amp;L)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mt-1">
              Analisis profitabilitas berjenjang, efisiensi HPP bahan baku (Food Cost), realisasi anggaran, dan rekonsiliasi kas kafe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isOwner && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("open-ai-assistant", {
                      detail: { tab: "quick-input" },
                    })
                  );
                }}
                className="px-3.5 py-2.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                title="Catat pemasukan atau pengeluaran kas secara cepat via AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300 shrink-0" />
                <span>Catat Cepat AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-ai-assistant", {
                    detail: {
                      tab: "insights",
                      prompt: `Analisa kondisi Laba Rugi (P&L) bulan ${period}, komposisi pengeluaran per kategori, food cost (${fnbHealth.foodCostPercent.toFixed(1)}%), labor cost (${fnbHealth.laborCostPercent.toFixed(1)}%), prime cost (${fnbHealth.primeCostPercent.toFixed(1)}%), BEP omzet (${fnbHealth.bepMonthlyRevenue !== null ? formatCurrency(fnbHealth.bepMonthlyRevenue) : "belum terhitung"}), serta tagihan PO belum lunas dan saran efisiensinya.`,
                    },
                  })
                );
              }}
              className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              title="Audit kinerja Laba Rugi & biaya operasional dengan AI"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" />
              <span>Audit AI P&amp;L</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-sm shadow-brand-600/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Ekspor Laporan</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Toolbar Filter Periode Inset (Lapisan 3) */}
        <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("monthly")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === "monthly"
                    ? "bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Bulan
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("range")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === "range"
                    ? "bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Rentang Hari
              </button>
            </div>

            {filterMode === "monthly" ? (
              <CustomMonthPicker
                value={period}
                onChange={setPeriod}
                allowClear={false}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <CustomDatePicker
                  value={rangeStartDate}
                  onChange={setRangeStartDate}
                  placeholder="Dari"
                />
                <span className="text-slate-400 font-semibold">–</span>
                <CustomDatePicker
                  value={rangeEndDate}
                  onChange={setRangeEndDate}
                  placeholder="Sampai"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {[
              {
                label: "Hari Ini",
                active:
                  filterMode === "range" &&
                  normalizedRangeStart === getLocalDateString() &&
                  normalizedRangeEnd === getLocalDateString(),
                onClick: () => {
                  const today = getLocalDateString();
                  setFilterMode("range");
                  setRangeStartDate(today);
                  setRangeEndDate(today);
                },
              },
              {
                label: "7 Hari",
                active:
                  filterMode === "range" &&
                  normalizedRangeStart === addDaysToLocalDate(getLocalDateString(), -6) &&
                  normalizedRangeEnd === getLocalDateString(),
                onClick: () => {
                  const today = getLocalDateString();
                  setFilterMode("range");
                  setRangeStartDate(addDaysToLocalDate(today, -6));
                  setRangeEndDate(today);
                },
              },
              {
                label: "Bulan Ini",
                active:
                  filterMode === "monthly" && period === getLocalPeriodString(),
                onClick: () => {
                  setFilterMode("monthly");
                  setPeriod(getLocalPeriodString());
                },
              },
              {
                label: "Bulan Lalu",
                active:
                  filterMode === "monthly" &&
                  period === getPreviousPeriodString(getLocalPeriodString()),
                onClick: () => {
                  setFilterMode("monthly");
                  setPeriod(getPreviousPeriodString(getLocalPeriodString()));
                },
              },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={preset.onClick}
                className={`px-2.5 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  preset.active
                    ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── OWNER MONITORING ADVISORY BANNER (Aturan #5b) ───────────────── */}
      {isOwner && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 flex items-center justify-between gap-3 text-amber-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Pengawasan Finansial Eksekutif Owner</p>
              <p className="text-[11px] text-amber-800">
                Anda dapat meninjau seluruh data margin, laporan laba rugi, dan rekonsiliasi kas. Otorisasi tutup periode diserahkan kepada Tim Keuangan & Manajer.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-amber-200 text-amber-800 shrink-0">
            Read-Only Guard
          </span>
        </div>
      )}

      {/* ── PERIOD MANAGEMENT BANNER (FINANCE / MANAGER / SUPER_ADMIN) ─── */}
      {canManagePeriod && filterMode === "range" && (
        <div className="p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-500/10 border border-brand-200/80 dark:border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
            <Calendar className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" />
            <span>
              Sedang meninjau rentang <strong>{activeFilterLabel}</strong>. Aksi Tutup Buku hanya berlaku pada mode <strong>Bulan</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilterMode("monthly")}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer shrink-0"
          >
            Buka Mode Bulanan ({period})
          </button>
        </div>
      )}

      {canManagePeriod && filterMode === "monthly" && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border transition-all space-y-3 ${
            isPeriodClosed
              ? "bg-rose-50/70 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-950 dark:text-rose-100"
              : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-2xs text-slate-800 dark:text-slate-100"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isPeriodClosed
                    ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {isPeriodClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span>Manajemen Tutup Buku Periode ({period})</span>
                  {isPeriodClosed && <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPeriodClosed
                    ? `Dikunci oleh ${activeClosedRecord?.closedBy || "Admin"} — mutasi kas, penjualan, opname, dan payroll bulan ini terkunci (absensi staf harian tetap berjalan).`
                    : "Kunci periode ini jika pembukuan bulan ini sudah final untuk membekukan angka laporan dan mencegah perubahan data masa lalu."}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {isPeriodClosed ? (
                canReopenPeriod ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReopenReason("");
                      setReopenPin("");
                      setReopenError(null);
                      setPeriodConfirmAction("reopen");
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Buka Buku (PIN Manager)</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-100/80 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 text-[11px] font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    Buka Buku Khusus Manager
                  </span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCloseNotes("");
                    setPeriodConfirmAction("close");
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs shadow-brand-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kunci Periode Sekarang</span>
                </button>
              )}
            </div>
          </div>

          {isPeriodClosed && activeClosedRecord?.snapshot && (
            <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-500/30 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Arsip Snapshot Terkunci
                </span>
                {activeClosedRecord.notes && (
                  <span className="text-slate-500 dark:text-slate-400">
                    Catatan: {activeClosedRecord.notes}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Omzet Bersih</span>
                  <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatCurrency(activeClosedRecord.snapshot.netSales)}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Laba Bersih</span>
                  <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(activeClosedRecord.snapshot.netProfit)}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    Hak Owner ({activeClosedRecord.snapshot.ownerSharePercent}%)
                  </span>
                  <strong className="font-mono tabular-nums text-brand-700 dark:text-brand-300">
                    {formatCurrency(activeClosedRecord.snapshot.ownerShareAmount)}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    Tabungan ({activeClosedRecord.snapshot.reserveSharePercent}%)
                  </span>
                  <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                    {formatCurrency(activeClosedRecord.snapshot.reserveShareAmount)}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Prive Owner</span>
                  <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatCurrency(activeClosedRecord.snapshot.ownerPriveTotal)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Kesiapan Tutup Buku (Soft Warning) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
            {closingChecklist.map((chk) => (
              <div
                key={chk.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold ${
                  chk.done
                    ? "bg-emerald-50/70 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-500/30"
                    : "bg-amber-50/70 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200/70 dark:border-amber-500/30"
                }`}
              >
                {chk.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{chk.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB NAVIGATION BAR ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("pnl")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "pnl"
              ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Laporan Laba Rugi (P&amp;L)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "budget"
              ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          <span>Realisasi vs Anggaran ({budgetComparison.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "reconciliation"
              ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Audit &amp; Rekonsiliasi Kas</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: LAPORAN LABA RUGI (P&L STATEMENT) ────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "pnl" && (
        <div className="space-y-6">
          {/* ── 5 BENTO KPI CARDS ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* 1. Penjualan Bersih */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 rounded-3xl border border-emerald-200/70 dark:border-emerald-500/30 shadow-coffee-sm hover:shadow-coffee transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Penjualan Bersih (Net Sales)
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-300 font-mono tracking-tight">
                  {formatCurrency(netSales)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Kotor: {formatCurrency(grossSales)}
                </p>
              </div>
            </div>

            {/* 2. HPP / COGS Bahan Baku */}
            <div className="p-4 bg-gradient-to-br from-amber-50/60 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 rounded-3xl border border-amber-200/70 dark:border-amber-500/30 shadow-coffee-sm hover:shadow-coffee transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  HPP Bahan Baku (COGS)
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-100/80 dark:bg-amber-500/20 border border-amber-200/70 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums tracking-tight">
                  {formatCurrency(effectiveCOGS)}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      foodCostPercentage <= 35
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                        : foodCostPercentage <= 40
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                    }`}
                  >
                    Food Cost: {foodCostPercentage.toFixed(1)}%
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      cogsMethod === "OPNAME_PERIODIC"
                        ? "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30"
                        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {cogsMethod === "OPNAME_PERIODIC"
                      ? "Opname Periodik"
                      : cogsMethod === "THEORETICAL_FALLBACK"
                      ? "Estimasi BOM"
                      : "Belanja Kas"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Laba Kotor */}
            <div className="p-4 bg-gradient-to-br from-brand-50/60 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 rounded-3xl border border-brand-200/70 dark:border-brand-500/30 shadow-coffee-sm hover:shadow-coffee transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Laba Kotor (Gross Profit)
                </span>
                <div className="w-8 h-8 rounded-xl bg-brand-100/80 dark:bg-brand-500/20 border border-brand-200/70 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-brand-600 dark:text-brand-300 font-mono tabular-nums tracking-tight">
                  {formatCurrency(grossProfit)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Gross Margin: <strong className="text-slate-800 dark:text-slate-200">{grossProfitMargin.toFixed(1)}%</strong>
                </p>
              </div>
            </div>

            {/* 4. Total OPEX */}
            <div className="p-4 bg-gradient-to-br from-rose-50/60 via-white to-white dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 rounded-3xl border border-rose-200/70 dark:border-rose-500/30 shadow-coffee-sm hover:shadow-coffee transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Beban Usaha (OPEX)
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-100/80 dark:bg-rose-500/20 border border-rose-200/70 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-300">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-rose-600 dark:text-rose-300 font-mono tabular-nums tracking-tight">
                  {formatCurrency(totalOPEX)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  Gaji: {formatCurrency(totalHrdExpense)}
                </p>
                {capexExpense > 0 && (
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    CapEx dipisah: {formatCurrency(capexExpense)}
                  </p>
                )}
              </div>
            </div>

            {/* 5. Laba Bersih Operasional */}
            <div
              className={`p-4 bg-gradient-to-br ${
                netOperatingProfit >= 0
                  ? "from-emerald-50/60 via-white to-white border-emerald-200/70 dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 dark:border-emerald-500/30"
                  : "from-rose-50/60 via-white to-white border-rose-200/70 dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 dark:border-rose-500/30"
              } rounded-3xl border shadow-coffee-sm hover:shadow-coffee transition-all flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Laba Bersih (Net Profit)
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    netOperatingProfit >= 0
                      ? "bg-emerald-100/80 text-emerald-600 border border-emerald-200/70 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30"
                      : "bg-rose-100/80 text-rose-600 border border-rose-200/70 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p
                  className={`text-xl font-black font-mono tracking-tight ${
                    netOperatingProfit >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
                  }`}
                >
                  {formatCurrency(netOperatingProfit)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      netOperatingProfit >= 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                    }`}
                  >
                    Net Margin: {netProfitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── REKAP KEUNTUNGAN & BAGI HASIL OWNER ───────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span>Rekap Keuntungan &amp; Bagi Hasil Owner ({activeFilterLabel})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Laba bersih dikurangi penarikan Prive Owner, beserta alokasi cadangan Tabungan Kedai &amp; CapEx periode ini.
                </p>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30">
                Owner {profitAllocation.ownerSharePercent}% • Tabungan {profitAllocation.reserveSharePercent}%
                {profitAllocation.investorSharePercent > 0 ? ` • Investor ${profitAllocation.investorSharePercent}%` : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Porsi Owner & Sisa Hak */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 border border-brand-200/70 dark:border-brand-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>Sisa Hak Owner ({profitAllocation.ownerSharePercent}%)</span>
                  <Wallet className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                </div>
                <p className={`text-xl font-black font-mono tabular-nums ${profitAllocation.ownerRemainingEntitlement >= 0 ? "text-brand-700 dark:text-brand-300" : "text-rose-600 dark:text-rose-300"}`}>
                  {formatCurrency(profitAllocation.ownerRemainingEntitlement)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Porsi: {formatCurrency(profitAllocation.ownerShareAmount)} − Prive: {formatCurrency(profitAllocation.ownerPriveTotal)}
                </p>
              </div>

              {/* 2. Cadangan Tabungan Kedai */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>Tabungan Kedai ({profitAllocation.reserveSharePercent}%)</span>
                  <PiggyBank className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                </div>
                <p className="text-xl font-black font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {formatCurrency(profitAllocation.reserveShareAmount)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Tersetor: {formatCurrency(profitAllocation.netSavingsAllocation)} • Sisa target: {formatCurrency(profitAllocation.reserveRemainingToTransfer)}
                </p>
              </div>

              {/* 3. Laba Ditahan Setelah Prive */}
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>Laba Ditahan Bersih</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <p className={`text-xl font-black font-mono tabular-nums ${profitAllocation.retainedProfitAfterPrive >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                  {formatCurrency(profitAllocation.retainedProfitAfterPrive)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Laba Bersih {formatCurrency(profitAllocation.netProfit)} − Prive
                </p>
              </div>

              {/* 4. CapEx / Investor */}
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>
                    {profitAllocation.investorSharePercent > 0
                      ? `Porsi Investor (${profitAllocation.investorSharePercent}%) & CapEx`
                      : "Pengeluaran CapEx Terpisah"}
                  </span>
                  <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                </div>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(
                    profitAllocation.investorSharePercent > 0
                      ? profitAllocation.investorShareAmount
                      : profitAllocation.capexExpense
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {profitAllocation.investorSharePercent > 0
                    ? `CapEx periode: ${formatCurrency(profitAllocation.capexExpense)}`
                    : "Pembelian alat/aset tidak memotong Net Profit"}
                </p>
              </div>
            </div>
          </div>

          {/* ── INDIKATOR KESEHATAN BIAYA F&B & TITIK IMPAS (BEP) ──────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Target className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>Indikator Kesehatan Biaya F&amp;B &amp; Titik Impas (BEP)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rasio kontrol HPP, seluruh gaji tim (Bar, Kitchen, Bakery, Kasir), Prime Cost, dan target omzet impas periode {period}.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-full self-start sm:self-auto">
                Benchmark Prime Cost F&amp;B ≤ 60%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Food Cost % */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Food Cost % (HPP / Omzet)
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      fnbHealth.foodCostStatus === "HEALTHY"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : fnbHealth.foodCostStatus === "WARNING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : fnbHealth.foodCostStatus === "DANGER"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {fnbHealth.foodCostStatus === "HEALTHY"
                      ? "Sehat"
                      : fnbHealth.foodCostStatus === "WARNING"
                      ? "Waspada"
                      : fnbHealth.foodCostStatus === "DANGER"
                      ? "Tinggi"
                      : "Belum Ada Omzet"}
                  </span>
                </div>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {fnbHealth.foodCostPercent.toFixed(1)}%
                </p>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      fnbHealth.foodCostStatus === "HEALTHY"
                        ? "bg-emerald-500"
                        : fnbHealth.foodCostStatus === "WARNING"
                        ? "bg-amber-500"
                        : fnbHealth.foodCostStatus === "DANGER"
                        ? "bg-rose-500"
                        : "bg-slate-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, fnbHealth.foodCostPercent))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  HPP: <span className="font-mono tabular-nums font-semibold text-slate-700">{formatCurrency(effectiveCOGS)}</span> • Target ≤ 30%
                </p>
              </div>

              {/* 2. Labor Cost % */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Labor Cost % (Gaji / Omzet)
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      fnbHealth.laborCostStatus === "HEALTHY"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : fnbHealth.laborCostStatus === "WARNING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : fnbHealth.laborCostStatus === "DANGER"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {fnbHealth.laborCostStatus === "HEALTHY"
                      ? "Sehat"
                      : fnbHealth.laborCostStatus === "WARNING"
                      ? "Waspada"
                      : fnbHealth.laborCostStatus === "DANGER"
                      ? "Tinggi"
                      : "Belum Ada Omzet"}
                  </span>
                </div>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {fnbHealth.laborCostPercent.toFixed(1)}%
                </p>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      fnbHealth.laborCostStatus === "HEALTHY"
                        ? "bg-emerald-500"
                        : fnbHealth.laborCostStatus === "WARNING"
                        ? "bg-amber-500"
                        : fnbHealth.laborCostStatus === "DANGER"
                        ? "bg-rose-500"
                        : "bg-slate-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, fnbHealth.laborCostPercent))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Gaji/SDM: <span className="font-mono tabular-nums font-semibold text-slate-700">{formatCurrency(totalHrdExpense)}</span> • Target ≤ 25%
                </p>
                {totalHrdExpense === 0 && payrollStats.paidTotal > 0 && (
                  <p className="text-[10px] text-amber-700 font-medium">
                    Catatan: Slip gaji PAID ({formatCurrency(payrollStats.paidTotal)}) belum tercatat di mutasi kas HRD.
                  </p>
                )}
              </div>

              {/* 3. Prime Cost % */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Prime Cost % (HPP + Gaji)
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      fnbHealth.primeCostStatus === "HEALTHY"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : fnbHealth.primeCostStatus === "WARNING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : fnbHealth.primeCostStatus === "DANGER"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {fnbHealth.primeCostStatus === "HEALTHY"
                      ? "Sehat"
                      : fnbHealth.primeCostStatus === "WARNING"
                      ? "Waspada"
                      : fnbHealth.primeCostStatus === "DANGER"
                      ? "Kritis"
                      : "Belum Ada Omzet"}
                  </span>
                </div>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {fnbHealth.primeCostPercent.toFixed(1)}%
                </p>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      fnbHealth.primeCostStatus === "HEALTHY"
                        ? "bg-emerald-500"
                        : fnbHealth.primeCostStatus === "WARNING"
                        ? "bg-amber-500"
                        : fnbHealth.primeCostStatus === "DANGER"
                        ? "bg-rose-500"
                        : "bg-slate-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, fnbHealth.primeCostPercent))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Nominal: <span className="font-mono tabular-nums font-semibold text-slate-700">{formatCurrency(fnbHealth.primeCostAmount)}</span> • Target ≤ 60%
                </p>
              </div>

              {/* 4. BEP Omzet Bulanan */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    BEP Omzet Bulanan
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      netSales <= 0 || fnbHealth.bepMonthlyRevenue === null
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : fnbHealth.isAboveBep
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {netSales <= 0
                      ? "Belum Ada Omzet"
                      : fnbHealth.bepMonthlyRevenue === null
                      ? "Margin Negatif"
                      : fnbHealth.isAboveBep
                      ? "Melampaui BEP"
                      : "Menuju BEP"}
                  </span>
                </div>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900">
                  {fnbHealth.bepMonthlyRevenue !== null
                    ? formatCurrency(fnbHealth.bepMonthlyRevenue)
                    : "Belum Terhitung"}
                </p>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      fnbHealth.isAboveBep ? "bg-emerald-500" : "bg-brand-600"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, fnbHealth.bepProgressPercent))}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  {netSales <= 0
                    ? "Belum ada omzet tercatat di periode ini."
                    : fnbHealth.bepMonthlyRevenue === null
                    ? "Laba kotor ≤ 0% — BEP belum bisa dicapai."
                    : fnbHealth.isAboveBep
                    ? `Sudah melampaui BEP (+${formatCurrency(fnbHealth.bepGapAmount ?? 0)})`
                    : `Kurang ${formatCurrency(Math.abs(fnbHealth.bepGapAmount ?? 0))} lagi untuk impas`}
                </p>
              </div>
            </div>
          </div>

          {/* ── MULTI-STEP P&L STATEMENT (STRUCTURED ACCRUAL WATERFALL) ────── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <span>Laporan Laba Rugi Berjenjang (Statement of Profit & Loss)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standar akuntansi F&B: Pendapatan Operasional ➔ HPP Bahan Baku ➔ Laba Kotor ➔ Beban Usaha ➔ Laba Bersih.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Periode:</span>
                <strong className="font-mono text-slate-800">{period}</strong>
              </div>
            </div>

            {/* STATEMENT TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-4 sm:px-6">Akun / Pos Keuangan</th>
                    <th className="p-4 text-right">Rincian Pos</th>
                    <th className="p-4 sm:px-6 text-right">Total Akun</th>
                    <th className="p-4 text-center">% Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* ── BAGIAN I: PENDAPATAN OPERASIONAL ── */}
                  <tr className="bg-slate-50/60 font-bold text-slate-900">
                    <td colSpan={4} className="p-3 sm:px-6 text-brand-900 text-xs uppercase tracking-wider">
                      I. Pendapatan Operasional (Revenue)
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 dark:text-slate-300">
                      Penjualan Toko / Omzet Kotor (Gross Sales)
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {formatCurrency(grossSales)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500 dark:text-slate-400 tabular-nums">
                      {netSales > 0 ? `${((grossSales / netSales) * 100).toFixed(1)}%` : "0.0%"}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                    <td className="p-3 sm:px-6 pl-8">
                      Potongan Penjualan / Diskon Promo (-)
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {totalDiscountAmount > 0 ? `-${formatCurrency(totalDiscountAmount)}` : "Rp 0"}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400 tabular-nums">
                      {netSales > 0 ? `${((totalDiscountAmount / netSales) * 100).toFixed(1)}%` : "0.0%"}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                    <td className="p-3 sm:px-6 pl-8">
                      Pengembalian Dana / Refund / Void POS (-)
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {totalRefundAmount > 0 ? `-${formatCurrency(totalRefundAmount)}` : "Rp 0"}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400 tabular-nums">
                      {netSales > 0 ? `${((totalRefundAmount / netSales) * 100).toFixed(1)}%` : "0.0%"}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/40 dark:bg-emerald-500/10 font-bold text-emerald-950 dark:text-emerald-200 border-t border-b border-emerald-100 dark:border-emerald-500/30">
                    <td className="p-3.5 sm:px-6">
                      = Total Penjualan Bersih (Net Revenue)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 sm:px-6 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-300 text-sm font-black">
                      {formatCurrency(netSales)}
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {netSales > 0 ? "100.0%" : "0.0%"}
                    </td>
                  </tr>

                  {/* ── BAGIAN II: HARGA POKOK PENJUALAN (HPP / COGS — OPSI A PERIODIK) ── */}
                  <tr className="bg-slate-50/60 font-bold text-slate-900">
                    <td colSpan={4} className="p-3 sm:px-6 text-amber-900 text-xs uppercase tracking-wider">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>II. Harga Pokok Penjualan (HPP / COGS Periodik Opname)</span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border normal-case tracking-normal ${
                            cogsMethod === "OPNAME_PERIODIC"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                          }`}
                        >
                          {cogsMethod === "OPNAME_PERIODIC"
                            ? `Opname Periodik (${opnameCoverageCount}/${opnameTotalIngredients} bahan)`
                            : cogsMethod === "THEORETICAL_FALLBACK"
                            ? "Fallback: Estimasi Resep BOM (Belum ada Opname Akhir)"
                            : "Fallback: Belanja Bahan Periode (Belum ada Opname Akhir)"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {cogsMethod === "OPNAME_PERIODIC" ? (
                    <>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            (+) Persediaan Awal Bahan Baku{" "}
                            <span className="text-[11px] text-slate-400">
                              {hasOpeningOpname ? "(Opname FINAL bulan lalu)" : "(Belum ada opname bulan lalu)"}
                            </span>
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCurrency(openingInventoryValue)}
                        </td>
                        <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                        <td className="p-3 text-center text-slate-500">
                          {netSales > 0 ? ((openingInventoryValue / netSales) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 sm:px-6 pl-8 text-slate-700">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>(+) Pembelian Bahan Baku Periode Berjalan</span>
                          </div>
                          <p className="text-[10px] text-slate-400 pl-5 mt-0.5 tabular-nums">
                            PO Diterima: {formatCurrency(poReceivedPurchases)} · Belanja Bahan Non-PO: {formatCurrency(directCashMaterialPurchases)}
                          </p>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCurrency(periodMaterialPurchases)}
                        </td>
                        <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                        <td className="p-3 text-center text-slate-500">
                          {netSales > 0 ? ((periodMaterialPurchases / netSales) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 text-emerald-700">
                        <td className="p-3 sm:px-6 pl-8 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>(-) Persediaan Akhir Bahan Baku (Opname FINAL Bulan Ini)</span>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums font-semibold">
                          -{formatCurrency(closingInventoryValue)}
                        </td>
                        <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                        <td className="p-3 text-center text-emerald-600">
                          {netSales > 0 ? ((closingInventoryValue / netSales) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 sm:px-6 pl-8 text-slate-600">
                          <span className="italic">
                            {cogsMethod === "THEORETICAL_FALLBACK"
                              ? "Pemakaian Bahan Terpakai (Estimasi Resep BOM — selesaikan Opname FINAL untuk HPP periodik)"
                              : "Belanja Bahan Periode Berjalan (PO Diterima + Belanja Non-PO — belum ada Opname FINAL)"}
                          </span>
                          {periodMaterialPurchases > 0 && (
                            <p className="text-[10px] text-slate-400 not-italic mt-0.5 tabular-nums">
                              Pembelian bahan tercatat periode ini: {formatCurrency(periodMaterialPurchases)} (PO: {formatCurrency(poReceivedPurchases)} · Kas Non-PO: {formatCurrency(directCashMaterialPurchases)})
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                          {formatCurrency(effectiveCOGS)}
                        </td>
                        <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                        <td className="p-3 text-center text-slate-500">
                          {foodCostPercentage.toFixed(1)}%
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-amber-50/40 font-bold text-amber-950 border-t border-b border-amber-100">
                    <td className="p-3.5 sm:px-6">
                      = Total Harga Pokok Penjualan (COGS)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 sm:px-6 text-right font-mono tabular-nums text-amber-700 text-sm font-black">
                      {formatCurrency(effectiveCOGS)}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-700">
                      {foodCostPercentage.toFixed(1)}%
                    </td>
                  </tr>

                  {/* ── BAGIAN III: LABA KOTOR (GROSS PROFIT) ── */}
                  <tr className="bg-brand-50/70 font-black text-brand-950 border-t-2 border-b-2 border-brand-200">
                    <td className="p-4 sm:px-6 text-sm">
                      III. LABA KOTOR (GROSS PROFIT)
                    </td>
                    <td className="p-4 text-right font-mono text-slate-400">-</td>
                    <td className="p-4 sm:px-6 text-right font-mono tabular-nums text-brand-700 text-base font-black">
                      {formatCurrency(grossProfit)}
                    </td>
                    <td className="p-4 text-center font-bold text-brand-700 text-xs">
                      {grossProfitMargin.toFixed(1)}%
                    </td>
                  </tr>

                  {/* ── BAGIAN IV: BEBAN USAHA / OPERASIONAL (OPEX) ── */}
                  <tr className="bg-slate-50/60 font-bold text-slate-900">
                    <td colSpan={4} className="p-3 sm:px-6 text-rose-900 text-xs uppercase tracking-wider">
                      IV. Beban Usaha / Operasional (Operating Expenses / OPEX — Tanpa Belanja Aset CapEx)
                    </td>
                  </tr>
                  {/* Gaji / HRD & Sub-Kategori SDM */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2 font-semibold">
                      <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Beban SDM, Payroll, Bonus &amp; Tunjangan (HRD &amp; Personalia)</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-700 font-bold">
                      {formatCurrency(totalHrdExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalHrdExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  {hrdBreakdown.map((item, idx) => (
                    <tr key={`hrd-sub-${idx}`} className="bg-purple-50/20 hover:bg-purple-50/40 text-[11px]">
                      <td className="py-2 px-4 sm:px-6 pl-14 text-slate-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span>Sub: {item.name}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-2 px-4 sm:px-6 text-right font-mono text-slate-300">-</td>
                      <td className="py-2 px-3 text-center text-slate-400">
                        {netSales > 0 ? ((item.amount / netSales) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                  {/* Utilitas */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>Beban Utilitas (Listrik PLN, Air PDAM, Gas LPG, Wifi)</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrency(totalUtilityExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalUtilityExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  {/* Operasional Toko Non-CapEx */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>Beban Operasional Toko &amp; Sewa (Non-CapEx)</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrency(totalGeneralOpsExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalGeneralOpsExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  {/* Biaya Admin Bank & MDR */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Biaya Admin Bank, MDR QRIS/EDC &amp; Komisi Delivery</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrency(totalAdminBankExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalAdminBankExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  <tr className="bg-rose-50/40 font-bold text-rose-950 border-t border-b border-rose-100">
                    <td className="p-3.5 sm:px-6">
                      = Total Beban Usaha / Operasional (Total OPEX)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 sm:px-6 text-right font-mono tabular-nums text-rose-600 text-sm font-black">
                      {formatCurrency(totalOPEX)}
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600">
                      {netSales > 0 ? ((totalOPEX / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>

                  {/* ── BAGIAN V: LABA BERSIH OPERASIONAL (NET PROFIT) ── */}
                  <tr
                    className={`font-black border-t-2 border-b-2 ${
                      netOperatingProfit >= 0
                        ? "bg-emerald-500/10 text-emerald-950 border-emerald-300"
                        : "bg-rose-500/10 text-rose-950 border-rose-300"
                    }`}
                  >
                    <td className="p-4 sm:px-6 text-sm sm:text-base">
                      V. LABA BERSIH OPERASIONAL (NET OPERATING PROFIT)
                    </td>
                    <td className="p-4 text-right font-mono text-slate-400">-</td>
                    <td
                      className={`p-4 sm:px-6 text-right font-mono tabular-nums text-lg font-black ${
                        netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(netOperatingProfit)}
                    </td>
                    <td
                      className={`p-4 text-center font-bold text-sm ${
                        netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {netProfitMargin.toFixed(1)}%
                    </td>
                  </tr>

                  {/* ── BAGIAN VI: ARUS NON-LABA/RUGI (CAPEX, TABUNGAN & NERACA KAS) ── */}
                  <tr className="bg-slate-100/80 font-bold text-slate-700">
                    <td colSpan={4} className="p-3 sm:px-6 text-xs uppercase tracking-wider">
                      VI. Pos Non-Operasional, Investasi Aset &amp; Neraca Kas Periode (Di Luar Laba Bersih)
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>Belanja Modal / Pembelian Aset &amp; Mesin (CapEx — Dipisah dari OPEX)</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(capexExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400">Non-P&amp;L</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Alokasi Bersih ke Tabungan / Dana Cadangan (SAVINGS)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pl-5 mt-0.5 tabular-nums">
                        Disisihkan: +{formatCurrency(savingsDeposit)} · Dicairkan ke Ops: -{formatCurrency(savingsWithdrawal)}
                      </p>
                    </td>
                    <td className={`p-3 text-right font-mono tabular-nums font-semibold ${netSavingsAllocation >= 0 ? "text-amber-700" : "text-rose-600"}`}>
                      {netSavingsAllocation >= 0 ? "+" : ""}
                      {formatCurrency(netSavingsAllocation)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400">Neraca Kas</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Piutang Settlement Non-Tunai Belum Cair (QRIS / EDC / Ojol H+1)</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                      {formatCurrency(pendingNonCashSettlement)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400">Piutang</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Sisa Hutang Purchase Order Bahan Periode (Unpaid PO)</span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-rose-600 font-semibold">
                      {formatCurrency(poStats.unpaidDebt)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400">Hutang</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* FOOD COST & RECIPE BOM ADVISORY NOTE */}
            <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="text-slate-600">
                  HPP Teoretis menurut resep menu terjual:{" "}
                  <strong className="font-mono tabular-nums text-slate-800">{formatCurrency(theoreticalCOGS)}</strong>.
                  {cogsVariance !== null && theoreticalCOGS > 0 && (
                    <>
                      {" "}Selisih HPP Periodik Opname vs Resep BOM:{" "}
                      <strong
                        className={`font-mono tabular-nums ${
                          cogsVariance > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {cogsVariance > 0 ? "+" : ""}
                        {formatCurrency(cogsVariance)}
                      </strong>{" "}
                      ({cogsVariance > 0 ? "Potensi Waste / Over-portioning" : "Efisiensi / Penggunaan Stok"})
                    </>
                  )}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Target Rasio F&amp;B Coffee Shop: 28% – 35%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: REALISASI VS ANGGARAN (BUDGET VS ACTUAL) ─────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "budget" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-brand-600 dark:text-brand-300" />
                <span>Realisasi Pengeluaran vs Anggaran (Budget vs Actual)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pantau plafon anggaran per pos biaya kafe dan deteksi potensi pemborosan sebelum overbudget.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700">
                Periode: {period}
              </span>
              {canEditBudget && (
                <button
                  type="button"
                  onClick={() => openBudgetModal()}
                  disabled={eligibleBudgetCategories.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-sm shadow-brand-600/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Atur Plafon Anggaran</span>
                </button>
              )}
            </div>
          </div>

          {budgetComparison.length > 0 ? (
            <>
              {/* DESKTOP & TABLET VIEW: Structured Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                      <th className="p-4 sm:px-6">Kategori Pengeluaran</th>
                      <th className="p-4 text-right">Plafon Anggaran</th>
                      <th className="p-4 text-right">Realisasi Kas</th>
                      <th className="p-4 text-right">Sisa Anggaran (Variance)</th>
                      <th className="p-4 text-center">Persentase Penggunaan</th>
                      {canEditBudget && <th className="p-4 text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {budgetComparison.map((item) => (
                      <tr key={item.categoryId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 sm:px-6 font-bold text-slate-900 dark:text-slate-100">
                          <span>{item.category}</span>
                          {item.parentName && (
                            <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700">
                              {item.parentName}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {item.budgetAmount > 0 ? formatCurrency(item.budgetAmount) : "-"}
                        </td>
                        <td className="p-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.actualAmount)}
                        </td>
                        <td
                          className={`p-4 text-right font-mono tabular-nums font-bold ${
                            item.budgetAmount === 0
                              ? "text-slate-400"
                              : item.variance < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {item.budgetAmount > 0 ? (
                            item.variance >= 0
                              ? `+${formatCurrency(item.variance)}`
                              : formatCurrency(item.variance)
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {item.budgetAmount > 0 ? (
                            <div className="flex items-center justify-center gap-2 max-w-[200px] mx-auto">
                              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    item.usagePercentage > 100
                                      ? "bg-rose-500"
                                      : item.usagePercentage > 85
                                        ? "bg-amber-500"
                                        : "bg-brand-600"
                                  }`}
                                  style={{ width: `${Math.min(item.usagePercentage, 100)}%` }}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-bold font-mono tabular-nums w-12 text-right ${
                                  item.usagePercentage > 100
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {item.usagePercentage.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tanpa plafon</span>
                          )}
                        </td>
                        {canEditBudget && (
                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  openBudgetModal({
                                    budgetId: item.budgetId,
                                    categoryId: item.categoryId,
                                    amount: item.budgetAmount,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 hover:bg-brand-100 text-[11px] font-bold transition cursor-pointer"
                                title={item.budgetId ? "Edit Plafon Anggaran" : "Tetapkan Plafon"}
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>{item.budgetId ? "Edit" : "+ Plafon"}</span>
                              </button>
                              {item.budgetId && (
                                <button
                                  type="button"
                                  onClick={() => setBudgetToDeleteId(item.budgetId)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition cursor-pointer"
                                  title="Hapus Plafon Anggaran"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW: Ergonomic Card Feed */}
              <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {budgetComparison.map((item) => (
                  <div key={item.categoryId} className="p-4 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block truncate">
                          {item.category}
                        </span>
                        {item.parentName && (
                          <span className="text-[10px] text-slate-400">{item.parentName}</span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-xs font-black text-slate-900 dark:text-slate-100 shrink-0">
                        {formatCurrency(item.actualAmount)}
                      </span>
                    </div>

                    {item.budgetAmount > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            Anggaran:{" "}
                            <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                              {formatCurrency(item.budgetAmount)}
                            </strong>
                          </span>
                          <span
                            className={`font-mono tabular-nums font-bold ${
                              item.variance < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            Sisa:{" "}
                            {item.variance >= 0
                              ? `+${formatCurrency(item.variance)}`
                              : formatCurrency(item.variance)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                            <div
                              className={`h-full rounded-full ${
                                item.usagePercentage > 100
                                  ? "bg-rose-500"
                                  : item.usagePercentage > 85
                                    ? "bg-amber-500"
                                    : "bg-brand-600"
                              }`}
                              style={{ width: `${Math.min(item.usagePercentage, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-mono tabular-nums font-bold ${
                              item.usagePercentage > 100
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {item.usagePercentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic block">
                        Kategori ini belum memiliki plafon anggaran tetap.
                      </span>
                    )}

                    {canEditBudget && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            openBudgetModal({
                              budgetId: item.budgetId,
                              categoryId: item.categoryId,
                              amount: item.budgetAmount,
                            })
                          }
                          className="text-[11px] font-bold text-brand-600 dark:text-brand-300 cursor-pointer"
                        >
                          {item.budgetId ? "Edit Plafon" : "+ Atur Plafon"}
                        </button>
                        {item.budgetId && (
                          <button
                            type="button"
                            onClick={() => setBudgetToDeleteId(item.budgetId)}
                            className="text-[11px] font-bold text-rose-500 cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs space-y-3">
              <PieChartIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Belum ada data anggaran atau realisasi pengeluaran pada periode {period}.</p>
              {canEditBudget && (
                <button
                  type="button"
                  onClick={() => openBudgetModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-sm shadow-brand-600/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Atur Plafon Anggaran Pertama</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: AUDIT & REKONSILIASI KAS (CASH & LIABILITIES AUDIT) ──── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          {/* 4 AUDIT PILLARS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* 1. REKONSILIASI OMZET KASIR VS KAS MASUK BUKU KAS */}
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Rekonsiliasi Omzet Penjualan</h3>
                    <p className="text-[11px] text-slate-500">Penjualan POS vs Kas Masuk (Cash In)</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    salesReconStats.isMatch
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {salesReconStats.isMatch ? "✓ Selaras (Match)" : "Periksa Selisih"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Omzet Penjualan POS / Rekap Harian:</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatCurrency(salesReconStats.grossSales)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Kas Masuk Tercatat (Buku Kas):</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600">
                    {formatCurrency(salesReconStats.totalCashIn)}
                  </span>
                </div>
                {salesReconStats.pendingNonCashSettlement > 0 && (
                  <div className="flex justify-between items-center text-amber-700">
                    <span>Piutang Non-Tunai Belum Cair (H+1):</span>
                    <span className="font-mono tabular-nums font-bold">
                      {formatCurrency(salesReconStats.pendingNonCashSettlement)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                  <span className="font-bold text-slate-800">Selisih Penjualan vs Kas In:</span>
                  <span
                    className={`font-mono tabular-nums font-black ${
                      salesReconStats.diff === 0
                        ? "text-slate-700"
                        : salesReconStats.diff > 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {salesReconStats.diff >= 0 ? `+${formatCurrency(salesReconStats.diff)}` : formatCurrency(salesReconStats.diff)}
                  </span>
                </div>
              </div>

              {/* Rincian Kanal Bayar POS (5 Kanal: Tunai, QRIS, EDC, Transfer, Ojol) */}
              {periodRecaps.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1">
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Tunai / Cash</span>
                    <strong className="font-mono tabular-nums text-slate-800">{formatCurrency(paymentMethodBreakdown.cash)}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">QRIS Statis/Dinamis</span>
                    <strong className="font-mono tabular-nums text-slate-800">{formatCurrency(paymentMethodBreakdown.qris)}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Debit / EDC</span>
                    <strong className="font-mono tabular-nums text-slate-800">{formatCurrency(paymentMethodBreakdown.edc)}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Transfer Bank</span>
                    <strong className="font-mono tabular-nums text-slate-800">{formatCurrency(paymentMethodBreakdown.transfer)}</strong>
                  </div>
                  <div className="p-2.5 bg-brand-50/60 rounded-xl border border-brand-100">
                    <span className="text-brand-700 block text-[10px] font-semibold">Ojol / Delivery</span>
                    <strong className="font-mono tabular-nums text-brand-900">{formatCurrency(paymentMethodBreakdown.onlineDelivery)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* 2. REKONSILIASI PAYROLL (BEBAN GAJI STAF) */}
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Rekonsiliasi Beban Payroll</h3>
                    <p className="text-[11px] text-slate-500">Slip Gaji Final vs Mutasi Kas Keluar Gaji</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    payrollStats.isMatch
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {payrollStats.isMatch
                    ? "✓ Selaras (Match)"
                    : payrollStats.diff < 0
                      ? "Belum Tercatat di Kas"
                      : "Ada Biaya SDM Non-Slip"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">
                    Gaji Dicairkan (Slip Status PAID - {payrollStats.paidCount} slip):
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(payrollStats.paidTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Kas Keluar Kategori Gaji (Buku Kas):</span>
                  <span className="font-mono font-bold text-rose-600">
                    {formatCurrency(totalHrdExpense)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                  <span className="font-bold text-slate-800">Selisih Realisasi Kas vs Slip:</span>
                  <span
                    className={`font-mono font-black ${
                      payrollStats.diff === 0
                        ? "text-slate-700"
                        : payrollStats.diff > 0
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {payrollStats.diff >= 0 ? `+${formatCurrency(payrollStats.diff)}` : formatCurrency(payrollStats.diff)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-700">
                  {payrollStats.draftCount} Draft
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 font-bold text-amber-700">
                  {payrollStats.approvedCount} Disetujui (Siap Bayar)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 font-bold text-emerald-700">
                  {payrollStats.paidCount} Lunas
                </span>
              </div>
            </div>

            {/* 3. REKONSILIASI PEMBELIAN & HUTANG SUPPLIER (AP) */}
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Pembelian & Hutang Supplier</h3>
                    <p className="text-[11px] text-slate-500">Status Bayar PO & Kewajiban Tempo</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    poStats.unpaidDebt === 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {poStats.unpaidDebt === 0 ? "✓ Lunas Tanpa Hutang" : `${poStats.unpaidCount} Tagihan Tempo`}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Nilai PO Diterbitkan ({poStats.total} PO):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(poStats.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">PO Sudah Lunas Tunai ({poStats.paidCount} PO):</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatCurrency(poStats.totalAmount - poStats.unpaidDebt)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                  <span className="font-bold text-rose-700">Sisa Hutang Supplier (AP Tempo):</span>
                  <span className="font-mono font-black text-rose-600 text-sm">
                    {formatCurrency(poStats.unpaidDebt)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Total kas keluar riil untuk belanja bahan baku bulan ini tercatat sebesar{" "}
                <strong className="font-mono text-slate-800">{formatCurrency(totalActualCOGS)}</strong>.
              </p>
            </div>

            {/* 4. REKONSILIASI BANK & MUTASI IMPORT */}
            <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Rekonsiliasi Bank</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Kesesuaian Catatan Penjualan vs Rekening Koran ({periodBankRecons.length} akun)
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    periodBankRecons.length > 0 && periodBankRecons.every((r) => r.status === "FINAL")
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                  }`}
                >
                  {periodBankRecons.length === 0
                    ? "Belum Direkonsiliasi"
                    : `${periodBankRecons.filter((r) => r.status === "FINAL").length}/${periodBankRecons.length} FINAL`}
                </span>
              </div>

              {periodBankRecons.length > 0 ? (
                <div className="space-y-2.5">
                  {periodBankRecons.map((recon) => {
                    const lines = bankStatementLines.filter((l) => l.reconciliationId === recon.id);
                    const matchedCnt = lines.filter((l) => l.isMatched).length;
                    return (
                      <div
                        key={recon.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-slate-800 dark:text-slate-100 truncate">
                            {recon.bankName}
                          </strong>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              recon.status === "FINAL"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                            }`}
                          >
                            {recon.status} ({matchedCnt}/{lines.length} cocok)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Saldo Awal:</span>
                          <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(recon.openingBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70 dark:border-slate-700">
                          <span className="font-bold text-slate-800 dark:text-slate-200">Saldo Akhir:</span>
                          <span className="font-mono tabular-nums font-black text-brand-600 dark:text-brand-300 text-sm">
                            {formatCurrency(recon.closingBalance)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center text-slate-400 text-xs">
                  <p>Belum ada data rekonsiliasi bank resmi yang tersimpan untuk periode {period}.</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan modul Rekonsiliasi Bank untuk mencocokkan mutasi rekening koran hasil import.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pencocokan rekening koran menjamin keabsahan bukti pembayaran non-tunai (QRIS &amp; EDC).
              </p>
            </div>
          </div>

          {/* ── DISTRIBUSI SALDO POS KAS & REKENING TOKO ────────────────────── */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                  <span>Posisi Likuiditas Kas Toko Saat Ini</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pemisahan kas kerja operasional (siap pakai) dan rekening tabungan / dana cadangan kafe.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <div className="px-3 py-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Kas Operasional
                  </span>
                  <span className="text-sm font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatCurrency(operationalBalance)}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-2xl bg-amber-50/90 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center justify-end gap-1">
                    <PiggyBank className="w-3 h-3" />
                    Tabungan
                  </span>
                  <span className="text-sm font-black font-mono tabular-nums text-amber-800 dark:text-amber-200">
                    {formatCurrency(savingsBalance)}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-2xl bg-brand-50/90 dark:bg-brand-500/15 border border-brand-200/80 dark:border-brand-500/30 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300 block">
                    Total Likuiditas
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono tabular-nums text-brand-700 dark:text-brand-200">
                    {formatCurrency(totalLiquidity)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {cashAccounts.map((acc) => {
                const bal = accountBalances[acc.id] || 0;
                const isSavings = acc.type === "SAVINGS";
                return (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSavings
                        ? "bg-amber-50/40 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/30 hover:border-amber-300"
                        : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/80 hover:border-brand-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mr-2">{acc.name}</span>
                      {isSavings ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 font-bold text-amber-800 dark:text-amber-300 shrink-0">
                          Tabungan
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-500 dark:text-slate-300 shrink-0">
                          {acc.type}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-base sm:text-lg font-black font-mono tabular-nums ${
                        bal < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {formatCurrency(bal)}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-400">
                      <span>{isSavings ? "Dana Cadangan:" : "Porsi Kas:"}</span>
                      <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {totalLiquidity > 0 ? `${((bal / totalLiquidity) * 100).toFixed(1)}%` : "0%"}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ─────────────────────────────────────────────────── */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultModule="finance"
        defaultPeriod={period}
      />

      {/* ── BUDGET ADD/EDIT MODAL ────────────────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isBudgetModalOpen && (
              <motion.div
                key="budget-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setIsBudgetModalOpen(false);
                    setEditingBudgetId(null);
                  }
                }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/70">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {editingBudgetId ? "Edit Plafon Anggaran" : "Atur Plafon Anggaran Baru"}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Periode Pembukuan: {period}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBudgetModalOpen(false);
                        setEditingBudgetId(null);
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="Tutup modal anggaran"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveBudget} className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Kategori Pengeluaran
                      </label>
                      <CustomSelect
                        value={budgetCategoryId}
                        onChange={setBudgetCategoryId}
                        disabled={Boolean(editingBudgetId)}
                        options={
                          editingBudgetId
                            ? expenseCategories
                                .filter((c) => c.id === budgetCategoryId)
                                .map((c) => ({ value: c.id, label: c.name }))
                            : [
                                { value: "", label: "-- Pilih Kategori Pengeluaran --" },
                                ...eligibleBudgetCategories,
                              ]
                        }
                        placeholder="Pilih Kategori Pengeluaran"
                        buttonClassName="w-full px-3.5 py-2.5 rounded-xl border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Plafon Anggaran Bulanan (Rp)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          Rp
                        </span>
                        <CurrencyInput
                          value={budgetAmountInput}
                          onValueChange={setBudgetAmountInput}
                          placeholder="0"
                          required
                          className="w-full pl-9 pr-3.5 py-2.5 text-sm font-extrabold font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Catatan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={budgetNotes}
                        onChange={(e) => setBudgetNotes(e.target.value)}
                        placeholder="Contoh: Batas maksimal belanja listrik & gas..."
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsBudgetModalOpen(false);
                          setEditingBudgetId(null);
                        }}
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/20 cursor-pointer"
                      >
                        {editingBudgetId ? "Simpan Perubahan" : "Simpan Anggaran"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── CONFIRM DELETE BUDGET ─────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(budgetToDeleteId)}
        variant="danger"
        title="Hapus Plafon Anggaran?"
        message={`Plafon anggaran untuk periode ${period} pada kategori ini akan dihapus. Realisasi transaksi kas tetap aman dan tidak ikut terhapus.`}
        confirmLabel="Ya, Hapus Plafon"
        cancelLabel="Batal"
        onConfirm={() => {
          if (canEditBudget && budgetToDeleteId) {
            deleteBudget(budgetToDeleteId);
            toast.success("Plafon anggaran berhasil dihapus.");
          }
          setBudgetToDeleteId(null);
        }}
        onCancel={() => setBudgetToDeleteId(null)}
      />

      {/* ── MODAL TUTUP BUKU (SNAPSHOT) & BUKA BUKU (PIN MANAGER) ────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {periodConfirmAction !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
                onClick={() => {
                  if (!isVerifyingReopen) setPeriodConfirmAction(null);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                >
                  <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          periodConfirmAction === "close"
                            ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {periodConfirmAction === "close" ? (
                          <Lock className="w-5 h-5" />
                        ) : (
                          <KeyRound className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                          {periodConfirmAction === "close"
                            ? `Kunci & Tutup Buku Periode ${period}`
                            : `Buka Kembali Pembukuan ${period}`}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {periodConfirmAction === "close"
                            ? "Snapshot angka akhir akan dibekukan sebagai arsip resmi."
                            : "Khusus Manager / Super Admin — wajib isi alasan dan verifikasi PIN."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isVerifyingReopen}
                      onClick={() => setPeriodConfirmAction(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {periodConfirmAction === "close" ? (
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Soft-warning checklist status */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Status Kesiapan (Soft Warning)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {closingChecklist.map((chk) => (
                            <div
                              key={chk.label}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                                chk.done
                                  ? "bg-emerald-50/70 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30"
                                  : "bg-amber-50/70 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30"
                              }`}
                            >
                              {chk.done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="truncate">{chk.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ringkasan Snapshot yang akan dibekukan */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Omzet Bersih</span>
                          <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {formatCurrency(netSales)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Laba Bersih</span>
                          <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                            {formatCurrency(netOperatingProfit)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Hak Owner ({profitAllocation.ownerSharePercent}%)
                          </span>
                          <strong className="font-mono tabular-nums text-brand-700 dark:text-brand-300">
                            {formatCurrency(profitAllocation.ownerShareAmount)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Tabungan Kedai ({profitAllocation.reserveSharePercent}%)
                          </span>
                          <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                            {formatCurrency(profitAllocation.reserveShareAmount)}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Catatan Penutupan (Opsional)
                        </label>
                        <input
                          type="text"
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          placeholder="Contoh: Tutup buku November final setelah opname & payroll lunas"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setPeriodConfirmAction(null)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canManagePeriod) {
                              setPeriodConfirmAction(null);
                              return;
                            }
                            const snapshot: ClosedPeriodSnapshot = {
                              netSales,
                              effectiveCOGS,
                              grossProfit,
                              totalOPEX,
                              netProfit: netOperatingProfit,
                              ownerPriveTotal: profitAllocation.ownerPriveTotal,
                              savingsDepositTotal: profitAllocation.savingsDepositTotal,
                              capexExpense: profitAllocation.capexExpense,
                              ownerSharePercent: profitAllocation.ownerSharePercent,
                              reserveSharePercent: profitAllocation.reserveSharePercent,
                              investorSharePercent: profitAllocation.investorSharePercent,
                              ownerShareAmount: profitAllocation.ownerShareAmount,
                              reserveShareAmount: profitAllocation.reserveShareAmount,
                              investorShareAmount: profitAllocation.investorShareAmount,
                              ownerRemainingEntitlement: profitAllocation.ownerRemainingEntitlement,
                              endingOperationalBalance: operationalBalance,
                              endingSavingsBalance: savingsBalance,
                              capturedAt: new Date().toISOString(),
                            };
                            closePeriod(
                              period,
                              currentUser?.name || currentUser?.role || "Finance",
                              closeNotes.trim() || "Penutupan buku akhir bulan resmi",
                              snapshot
                            );
                            toast.success(`Pembukuan periode ${period} berhasil dikunci & snapshot tersimpan.`);
                            setPeriodConfirmAction(null);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Ya, Kunci &amp; Simpan Snapshot
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!canReopenPeriod) {
                          setReopenError("Hanya Manager atau Super Admin yang berwenang membuka kembali buku.");
                          return;
                        }
                        if (reopenReason.trim().length < 5) {
                          setReopenError("Alasan buka buku wajib diisi minimal 5 karakter.");
                          return;
                        }
                        if (!/^\d{4,8}$/.test(reopenPin.trim())) {
                          setReopenError("Masukkan PIN Manager/Super Admin (4–8 digit angka).");
                          return;
                        }
                        setIsVerifyingReopen(true);
                        setReopenError(null);
                        try {
                          const res = await authFetch("/api/closed-periods/verify-reopen-pin", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              pin: reopenPin.trim(),
                              reason: reopenReason.trim(),
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok || data?.valid !== true) {
                            setReopenError(data?.error || "Verifikasi PIN buka buku gagal.");
                            return;
                          }
                          reopenPeriod(period, reopenReason.trim());
                          toast.info(`Pembukuan periode ${period} dibuka kembali.`);
                          setPeriodConfirmAction(null);
                        } catch {
                          setReopenError("Gagal menghubungi server untuk verifikasi PIN.");
                        } finally {
                          setIsVerifyingReopen(false);
                        }
                      }}
                      className="p-5 sm:p-6 space-y-4"
                    >
                      <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          Pembukaan kembali buku mengizinkan modifikasi transaksi periode <strong>{period}</strong> dan seluruh aktivitas dicatat di Audit Log.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Alasan Buka Kembali Buku (Wajib, min. 5 karakter)
                        </label>
                        <input
                          type="text"
                          required
                          minLength={5}
                          value={reopenReason}
                          onChange={(e) => {
                            setReopenReason(e.target.value);
                            setReopenError(null);
                          }}
                          placeholder="Contoh: Koreksi faktur supplier susu tertinggal tgl 29"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          PIN Otorisasi Manager / Super Admin
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          required
                          value={reopenPin}
                          onChange={(e) => {
                            setReopenPin(e.target.value.replace(/\D/g, "").slice(0, 8));
                            setReopenError(null);
                          }}
                          placeholder="••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                      </div>

                      {reopenError && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{reopenError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          disabled={isVerifyingReopen}
                          onClick={() => setPeriodConfirmAction(null)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isVerifyingReopen || !canReopenPeriod}
                          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
                        >
                          {isVerifyingReopen ? "Memverifikasi PIN..." : "Verifikasi & Buka Buku"}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

export default FinanceReports;
