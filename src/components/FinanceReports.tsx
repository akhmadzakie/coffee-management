import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import {
  Lock,
  Unlock,
  AlertTriangle,
  Download,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wallet,
  PieChart as PieChartIcon,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  DollarSign,
  Receipt,
  CreditCard,
  Building2,
  ShoppingBag,
  Users,
  Zap,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Activity,
  ShieldCheck,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Droplets,
  Coffee,
  Eye,
  Scale,
  Landmark,
  Smartphone,
  RefreshCw,
  AlertCircle,
  Info,
  ShieldAlert,
  Check,
  X,
} from "lucide-react";
import { ExportModal } from "./ExportModal";
import { motion, AnimatePresence } from "motion/react";
import { CustomMonthPicker } from "./common/CustomMonthPicker";

const FinanceReports: React.FC = () => {
  const {
    currentUser,
    isReadOnly,
    cashAccounts,
    cashTransactions,
    expenseCategories,
    purchaseOrders,
    suppliers,
    payrollRecords,
    dailySalesRecaps = [],
    salesTransactions,
    recipes,
    ingredients,
    bankReconciliations,
    bankStatementLines,
    budgets,
    closedPeriods,
    closePeriod,
    reopenPeriod,
  } = useStore();

  const isOwner = currentUser?.role === "OWNER" || isReadOnly;
  const canManagePeriod = Boolean(
    currentUser &&
      !isOwner &&
      ["FINANCE", "MANAGER", "SUPER_ADMIN"].includes(currentUser.role)
  );

  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [activeTab, setActiveTab] = useState<"pnl" | "budget" | "reconciliation">("pnl");
  const [isExportOpen, setIsExportOpen] = useState(false);

  const isPeriodClosed = useMemo(() => {
    return closedPeriods.some((p) => p.period === period);
  }, [closedPeriods, period]);

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

  const getCategoryName = (categoryId?: string | null, fallback = "Lainnya"): string => {
    if (!categoryId) return fallback;
    const cat = expenseCategories.find((c) => c.id === categoryId);
    return cat ? cat.name : fallback;
  };

  // ─── FILTER DATA BY PERIOD ────────────────────────────────────────────────
  const periodTransactions = useMemo(() => {
    return cashTransactions.filter((t) => t.date.startsWith(period));
  }, [cashTransactions, period]);

  const periodSales = useMemo(() => {
    return salesTransactions.filter((s) => s.date.startsWith(period));
  }, [salesTransactions, period]);

  const periodRecaps = useMemo(() => {
    return dailySalesRecaps.filter((r) => r.date.startsWith(period));
  }, [dailySalesRecaps, period]);

  const periodPayrolls = useMemo(() => {
    return payrollRecords.filter((p) => p.period === period);
  }, [payrollRecords, period]);

  const periodPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => po.date.startsWith(period));
  }, [purchaseOrders, period]);

  const periodBankRecon = useMemo(() => {
    return bankReconciliations.find((r) => r.period === period) || null;
  }, [bankReconciliations, period]);

  // ─── I. PENDAPATAN OPERASIONAL (REVENUE) ──────────────────────────────────
  const totalRecapAmount = useMemo(() => {
    return periodRecaps.reduce((sum, r) => sum + r.totalAmount, 0);
  }, [periodRecaps]);

  const totalSalesAmount = useMemo(() => {
    return periodSales.reduce((sum, s) => sum + s.totalPrice, 0);
  }, [periodSales]);

  const totalCashIn = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === "CASH_IN")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [periodTransactions]);

  // Penjualan Kotor (Gross Sales)
  const grossSales = useMemo(() => {
    if (totalRecapAmount > 0) return totalRecapAmount;
    if (totalSalesAmount > 0) return totalSalesAmount;
    return totalCashIn;
  }, [totalRecapAmount, totalSalesAmount, totalCashIn]);

  const totalDiscountAmount = 0; // Potongan diskon promo
  const totalRefundAmount = 0; // Pengembalian dana / void
  const netSales = Math.max(0, grossSales - totalDiscountAmount - totalRefundAmount);

  // Breakdown Metode Pembayaran Rekap Kasir
  const paymentMethodBreakdown = useMemo(() => {
    const cash = periodRecaps.reduce((sum, r) => sum + (r.cashAmount || 0), 0);
    const qris = periodRecaps.reduce((sum, r) => sum + (r.qrisAmount || 0), 0);
    const edc = periodRecaps.reduce((sum, r) => sum + (r.edcAmount || 0), 0);
    const transfer = periodRecaps.reduce((sum, r) => sum + (r.transferAmount || 0), 0);
    return { cash, qris, edc, transfer };
  }, [periodRecaps]);

  // ─── II. HARGA POKOK PENJUALAN (HPP / COGS) ───────────────────────────────
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

  // Rincian Pos HPP Bahan Baku
  const cogsBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    ingredientTransactions.forEach((t) => {
      const name = getCategoryName(t.categoryId, "Bahan Baku Umum");
      breakdown[name] = (breakdown[name] || 0) + t.amount;
    });
    return Object.entries(breakdown)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [ingredientTransactions, expenseCategories]);

  // HPP Teoretis Berdasarkan Resep (BOM) & Menu Terjual
  const theoreticalCOGS = useMemo(() => {
    let total = 0;
    periodSales.forEach((sale) => {
      const recipe = recipes.find(
        (r) => r.menuName.toLowerCase() === sale.menuName.toLowerCase()
      );
      if (recipe && recipe.ingredients) {
        const unitCost = recipe.ingredients.reduce((acc, item) => {
          const ing = ingredients.find((i) => i.id === item.ingredientId);
          return acc + (ing ? (ing.costPerUnit || 0) * item.quantity : 0);
        }, 0);
        total += unitCost * sale.quantitySold;
      }
    });
    return total;
  }, [periodSales, recipes, ingredients]);

  const effectiveCOGS = totalActualCOGS > 0 ? totalActualCOGS : theoreticalCOGS;
  const foodCostPercentage = netSales > 0 ? (effectiveCOGS / netSales) * 100 : 0;

  // ─── III. LABA KOTOR (GROSS PROFIT) ───────────────────────────────────────
  const grossProfit = netSales - effectiveCOGS;
  const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // ─── IV. BEBAN OPERASIONAL (OPERATING EXPENSES / OPEX) ─────────────────────
  // 1. Beban SDM / HRD / Payroll
  const hrdTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (t.type !== "CASH_OUT") return false;
      const catType = getCategoryType(t.categoryId);
      return (
        catType === "HRD" ||
        t.categoryId === "cat-hrd" ||
        (t.category && t.category.toLowerCase().includes("gaji"))
      );
    });
  }, [periodTransactions, expenseCategories]);

  const totalHrdExpense = useMemo(() => {
    return hrdTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [hrdTransactions]);

  // 2. Beban Utilitas
  const utilityTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (t.type !== "CASH_OUT") return false;
      const catType = getCategoryType(t.categoryId);
      return catType === "UTILITAS" || t.categoryId === "cat-utilitas";
    });
  }, [periodTransactions, expenseCategories]);

  const totalUtilityExpense = useMemo(() => {
    return utilityTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [utilityTransactions]);

  // 3. Beban Operasional Toko & Sewa
  const generalOpsTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (t.type !== "CASH_OUT") return false;
      const catType = getCategoryType(t.categoryId);
      return (
        catType === "PENGELUARAN" ||
        catType === "ASET" ||
        catType === "LAINNYA"
      );
    });
  }, [periodTransactions, expenseCategories]);

  const totalGeneralOpsExpense = useMemo(() => {
    return generalOpsTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [generalOpsTransactions]);

  const totalOPEX = totalHrdExpense + totalUtilityExpense + totalGeneralOpsExpense;

  // ─── V. LABA BERSIH OPERASIONAL (NET OPERATING PROFIT) ────────────────────
  const netOperatingProfit = grossProfit - totalOPEX;
  const netProfitMargin = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

  // ─── VI. REKONSILIASI KAS & POS AKUN ──────────────────────────────────────
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    cashAccounts.forEach((acc) => (balances[acc.id] = 0));
    cashTransactions.forEach((trx) => {
      if (balances[trx.accountId] === undefined) balances[trx.accountId] = 0;
      if (trx.type === "CASH_IN") balances[trx.accountId] += trx.amount;
      else if (trx.type === "CASH_OUT") balances[trx.accountId] -= trx.amount;
    });
    return balances;
  }, [cashTransactions, cashAccounts]);

  const totalLiquidity = useMemo(() => {
    return (Object.values(accountBalances) as number[]).reduce((sum, val) => sum + val, 0);
  }, [accountBalances]);

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

  // Rekonsiliasi Omzet
  const salesReconStats = useMemo(() => {
    const diff = totalCashIn - grossSales;
    return {
      grossSales,
      totalCashIn,
      diff,
      isMatch: Math.abs(diff) < 100,
    };
  }, [grossSales, totalCashIn]);

  // ─── VII. REALISASI VS ANGGARAN (BUDGET COMPARISON) ──────────────────────
  const budgetComparison = useMemo(() => {
    const periodBudgets = budgets.filter((b) => b.period === period);
    const expenseByCategory: Record<string, number> = {};
    periodTransactions
      .filter((t) => t.type === "CASH_OUT" && t.categoryId)
      .forEach((t) => {
        const catId = t.categoryId!;
        expenseByCategory[catId] = (expenseByCategory[catId] || 0) + t.amount;
      });

    return expenseCategories
      .map((cat) => {
        const budget = periodBudgets.find((b) => b.categoryId === cat.id);
        const budgetAmount = budget ? budget.amount : 0;
        const actualAmount = expenseByCategory[cat.id] || 0;
        const variance = budgetAmount - actualAmount;
        const usagePercentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

        return {
          category: cat.name,
          catType: cat.type,
          budgetAmount,
          actualAmount,
          variance,
          usagePercentage,
        };
      })
      .filter((item) => item.budgetAmount > 0 || item.actualAmount > 0);
  }, [budgets, periodTransactions, expenseCategories, period]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── HEADER BANNER ─────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">
              Financial Statement & Margin Audit
            </span>
            {isPeriodClosed ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <Lock className="w-3 h-3 mr-1" />
                Periode Terkunci (Tutup Buku)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Unlock className="w-3 h-3 mr-1" />
                Periode Terbuka
              </span>
            )}
            {isOwner && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                👑 Mode Pemantauan Owner (Read-Only)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Laporan Keuangan & Laba Rugi (P&L)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
            Analisis profitabilitas berjenjang, efisiensi HPP bahan baku (Food Cost), realisasi anggaran, dan rekonsiliasi kas kafe.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          <CustomMonthPicker
            value={period}
            onChange={setPeriod}
            allowClear={false}
          />

          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-white shrink-0" />
            <span>Ekspor Laporan</span>
          </button>
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
      {canManagePeriod && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isPeriodClosed
              ? "bg-rose-50/70 border-rose-200 text-rose-950"
              : "bg-white border-slate-200/90 shadow-2xs text-slate-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isPeriodClosed
                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {isPeriodClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>Manajemen Tutup Buku Periode ({period})</span>
                {isPeriodClosed && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPeriodClosed
                  ? "Periode ini telah dikunci resmi. Seluruh mutasi kas, transaksi penjualan, dan payroll tidak dapat diubah oleh staf."
                  : "Kunci periode ini jika seluruh pembukuan bulan ini sudah final untuk mengunci angka laporan dari modifikasi tidak disengaja."}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isPeriodClosed ? (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Buka kembali pembukuan periode ${period}? Aktivitas ini akan tercatat dalam audit log.`
                    )
                  ) {
                    reopenPeriod(period, "Permintaan koreksi/Buka buku");
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Kembali Buku</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Kunci dan tutup buku periode ${period}? Pastikan seluruh transaksi kas, payroll, dan inventori sudah selesai.`
                    )
                  ) {
                    closePeriod(
                      period,
                      currentUser?.name || currentUser?.role || "Finance",
                      "Tutup buku rutin"
                    );
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Kunci Periode Sekarang</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── TAB NAVIGATION BAR ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("pnl")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "pnl"
              ? "bg-brand-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Laporan Laba Rugi (P&L)</span>
        </button>

        <button
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "budget"
              ? "bg-brand-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          <span>Realisasi vs Anggaran ({budgetComparison.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "reconciliation"
              ? "bg-brand-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Audit & Rekonsiliasi Kas</span>
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
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Penjualan Bersih (Net Sales)
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                  {formatCurrency(netSales)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Kotor: {formatCurrency(grossSales)}
                </p>
              </div>
            </div>

            {/* 2. HPP / COGS Bahan Baku */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  HPP Bahan Baku (COGS)
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
                  {formatCurrency(effectiveCOGS)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      foodCostPercentage <= 35
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : foodCostPercentage <= 40
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    Food Cost: {foodCostPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Laba Kotor */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Laba Kotor (Gross Profit)
                </span>
                <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-brand-600 font-mono tracking-tight">
                  {formatCurrency(grossProfit)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Gross Margin: <strong className="text-slate-800">{grossProfitMargin.toFixed(1)}%</strong>
                </p>
              </div>
            </div>

            {/* 4. Total OPEX */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Beban Usaha (OPEX)
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-rose-600 font-mono tracking-tight">
                  {formatCurrency(totalOPEX)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Gaji: {formatCurrency(totalHrdExpense)}
                </p>
              </div>
            </div>

            {/* 5. Laba Bersih Operasional */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Laba Bersih (Net Profit)
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    netOperatingProfit >= 0
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-rose-50 text-rose-600 border border-rose-100"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p
                  className={`text-xl font-black font-mono tracking-tight ${
                    netOperatingProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(netOperatingProfit)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      netOperatingProfit >= 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    Net Margin: {netProfitMargin.toFixed(1)}%
                  </span>
                </div>
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
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700">
                      Penjualan Kasir / Omzet Kotor (Gross Sales)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {formatCurrency(grossSales)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400">100.0%</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 text-slate-500">
                    <td className="p-3 sm:px-6 pl-8">
                      Potongan Penjualan / Diskon Promo (-)
                    </td>
                    <td className="p-3 text-right font-mono text-rose-600">
                      {totalDiscountAmount > 0 ? `-${formatCurrency(totalDiscountAmount)}` : "Rp 0"}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-400">
                      {netSales > 0 ? ((totalDiscountAmount / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/40 font-bold text-emerald-950 border-t border-b border-emerald-100">
                    <td className="p-3.5 sm:px-6">
                      = Total Penjualan Bersih (Net Revenue)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 sm:px-6 text-right font-mono text-emerald-700 text-sm font-black">
                      {formatCurrency(netSales)}
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-700">100.0%</td>
                  </tr>

                  {/* ── BAGIAN II: HARGA POKOK PENJUALAN (HPP / COGS) ── */}
                  <tr className="bg-slate-50/60 font-bold text-slate-900">
                    <td colSpan={4} className="p-3 sm:px-6 text-amber-900 text-xs uppercase tracking-wider">
                      II. Harga Pokok Penjualan (HPP / COGS Bahan Baku & Kemasan)
                    </td>
                  </tr>
                  {cogsBreakdown.length > 0 ? (
                    cogsBreakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{item.name}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                        <td className="p-3 text-center text-slate-500">
                          {netSales > 0 ? ((item.amount / netSales) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 sm:px-6 pl-8 text-slate-500 italic">
                        Bahan Baku Terpakai (Estimasi Resep BOM)
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {formatCurrency(theoreticalCOGS)}
                      </td>
                      <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                      <td className="p-3 text-center text-slate-500">
                        {netSales > 0 ? ((theoreticalCOGS / netSales) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  )}
                  <tr className="bg-amber-50/40 font-bold text-amber-950 border-t border-b border-amber-100">
                    <td className="p-3.5 sm:px-6">
                      = Total Harga Pokok Penjualan (COGS)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 sm:px-6 text-right font-mono text-amber-700 text-sm font-black">
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
                    <td className="p-4 sm:px-6 text-right font-mono text-brand-700 text-base font-black">
                      {formatCurrency(grossProfit)}
                    </td>
                    <td className="p-4 text-center font-bold text-brand-700 text-xs">
                      {grossProfitMargin.toFixed(1)}%
                    </td>
                  </tr>

                  {/* ── BAGIAN IV: BEBAN USAHA / OPERASIONAL (OPEX) ── */}
                  <tr className="bg-slate-50/60 font-bold text-slate-900">
                    <td colSpan={4} className="p-3 sm:px-6 text-rose-900 text-xs uppercase tracking-wider">
                      IV. Beban Usaha / Operasional (Operating Expenses / OPEX)
                    </td>
                  </tr>
                  {/* Gaji / HRD */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Beban Gaji Karyawan, Upah Lembur & Tunjangan (HRD)</span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {formatCurrency(totalHrdExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalHrdExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  {/* Utilitas */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Beban Utilitas (Listrik PLN, Air PDAM, Gas LPG, Wifi)</span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {formatCurrency(totalUtilityExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalUtilityExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  {/* Operasional Toko */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 sm:px-6 pl-8 text-slate-700 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>Beban Operasional Toko (Sewa Tempat, Kebersihan, Pemasaran, Perawatan)</span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {formatCurrency(totalGeneralOpsExpense)}
                    </td>
                    <td className="p-3 sm:px-6 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-center text-slate-500">
                      {netSales > 0 ? ((totalGeneralOpsExpense / netSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  <tr className="bg-rose-50/40 font-bold text-rose-950 border-t border-b border-rose-100">
                    <td className="p-3.5 sm:px-6">
                      = Total Beban Usaha / Operasional (Total OPEX)
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 sm:px-6 text-right font-mono text-rose-600 text-sm font-black">
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
                      className={`p-4 sm:px-6 text-right font-mono text-lg font-black ${
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
                </tbody>
              </table>
            </div>

            {/* FOOD COST & RECIPE BOM ADVISORY NOTE */}
            <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="text-slate-600">
                  HPP Teoretis menurut resep menu terjual:{" "}
                  <strong className="font-mono text-slate-800">{formatCurrency(theoreticalCOGS)}</strong>.
                  {totalActualCOGS > 0 && theoreticalCOGS > 0 && (
                    <>
                      {" "}Selisih vs Pembelian Aktual:{" "}
                      <strong
                        className={`font-mono ${
                          totalActualCOGS > theoreticalCOGS ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {totalActualCOGS > theoreticalCOGS ? "+" : ""}
                        {formatCurrency(totalActualCOGS - theoreticalCOGS)}
                      </strong>{" "}
                      ({totalActualCOGS > theoreticalCOGS ? "Potensi Pemborosan / Over-portioning" : "Pemanfaatan Stok Lama"})
                    </>
                  )}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Target Rasio F&B Coffee Shop: 28% – 35%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: REALISASI VS ANGGARAN (BUDGET VS ACTUAL) ─────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "budget" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-brand-600" />
                <span>Realisasi Pengeluaran vs Anggaran (Budget vs Actual)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pantau plafon anggaran per pos biaya kafe dan deteksi potensi pemborosan sebelum overbudget.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              Periode: {period}
            </span>
          </div>

          {budgetComparison.length > 0 ? (
            <>
              {/* DESKTOP & TABLET VIEW: Structured Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="p-4 sm:px-6">Kategori Pengeluaran</th>
                      <th className="p-4 text-right">Plafon Anggaran</th>
                      <th className="p-4 text-right">Realisasi Kas</th>
                      <th className="p-4 text-right">Sisa Anggaran (Variance)</th>
                      <th className="p-4 text-center">Persentase Penggunaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {budgetComparison.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4 sm:px-6 font-bold text-slate-900">{item.category}</td>
                        <td className="p-4 text-right font-mono text-slate-600">
                          {item.budgetAmount > 0 ? formatCurrency(item.budgetAmount) : "-"}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.actualAmount)}
                        </td>
                        <td
                          className={`p-4 text-right font-mono font-bold ${
                            item.variance < 0 ? "text-rose-600" : "text-emerald-600"
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
                              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
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
                                className={`text-[11px] font-bold font-mono w-12 text-right ${
                                  item.usagePercentage > 100 ? "text-rose-600" : "text-slate-700"
                                }`}
                              >
                                {item.usagePercentage.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tanpa plafon</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW: Ergonomic Card Feed */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {budgetComparison.map((item, idx) => (
                  <div key={idx} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{item.category}</span>
                      <span className="font-mono text-xs font-black text-slate-900">
                        {formatCurrency(item.actualAmount)}
                      </span>
                    </div>

                    {item.budgetAmount > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            Anggaran:{" "}
                            <strong className="font-mono text-slate-700">
                              {formatCurrency(item.budgetAmount)}
                            </strong>
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              item.variance < 0 ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            Sisa:{" "}
                            {item.variance >= 0
                              ? `+${formatCurrency(item.variance)}`
                              : formatCurrency(item.variance)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
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
                            className={`text-[10px] font-mono font-bold ${
                              item.usagePercentage > 100 ? "text-rose-600" : "text-slate-700"
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
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <PieChartIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Belum ada data anggaran atau realisasi pengeluaran pada periode {period}.</p>
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
                    <h3 className="font-bold text-sm text-slate-900">Rekonsiliasi Omzet Kasir</h3>
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
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(salesReconStats.grossSales)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Kas Masuk Tercatat (Buku Kas):</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatCurrency(salesReconStats.totalCashIn)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                  <span className="font-bold text-slate-800">Selisih Penjualan vs Kas In:</span>
                  <span
                    className={`font-mono font-black ${
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

              {/* Rincian Kanal Bayar POS */}
              {periodRecaps.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Tunai / Cash</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(paymentMethodBreakdown.cash)}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">QRIS Statis/Dinamis</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(paymentMethodBreakdown.qris)}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Debit / EDC</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(paymentMethodBreakdown.edc)}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Transfer Bank</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(paymentMethodBreakdown.transfer)}</strong>
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
                  {payrollStats.isMatch ? "✓ Selaras (Match)" : "Perlu Pencairan"}
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
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Rekonsiliasi Bank</h3>
                    <p className="text-[11px] text-slate-500">Kesesuaian Catatan Kasir vs Rekening Koran</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    periodBankRecon && periodBankRecon.status === "FINAL"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {periodBankRecon ? `Status: ${periodBankRecon.status}` : "Belum Direkonsiliasi"}
                </span>
              </div>

              {periodBankRecon ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Rekening Bank:</span>
                    <strong className="text-slate-800">{periodBankRecon.bankName}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Saldo Awal:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrency(periodBankRecon.openingBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                    <span className="font-bold text-slate-800">Saldo Akhir:</span>
                    <span className="font-mono font-black text-brand-600 text-sm">
                      {formatCurrency(periodBankRecon.closingBalance)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50/70 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs">
                  <p>Belum ada data rekonsiliasi bank resmi yang tersimpan untuk periode {period}.</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan modul Rekonsiliasi Bank untuk mencocokkan mutasi rekening koran hasil import.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                Pencocokan rekening koran menjamin keabsahan bukti pembayaran non-tunai (QRIS & EDC).
              </p>
            </div>
          </div>

          {/* ── DISTRIBUSI SALDO POS KAS & REKENING TOKO ────────────────────── */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-brand-600" />
                  <span>Posisi Likuiditas Kas Toko Saat Ini</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Saldo riil di seluruh pos kas fisik (laci kasir) dan akun bank operasional kafe.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Likuiditas
                </span>
                <span className="text-lg sm:text-xl font-black font-mono text-brand-700">
                  {formatCurrency(totalLiquidity)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {cashAccounts.map((acc) => {
                const bal = accountBalances[acc.id] || 0;
                return (
                  <div
                    key={acc.id}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:border-brand-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 truncate mr-2">{acc.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-500">
                        {acc.type}
                      </span>
                    </div>
                    <p
                      className={`text-base sm:text-lg font-black font-mono ${
                        bal < 0 ? "text-rose-600" : "text-slate-900"
                      }`}
                    >
                      {formatCurrency(bal)}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
                      <span>Porsi Kas:</span>
                      <strong className="font-mono text-slate-700">
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
      />
    </div>
  );
};

export default FinanceReports;
