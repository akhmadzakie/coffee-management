import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { ViewState } from "../types";
import {
  Wallet,
  Building2,
  Landmark,
  Smartphone,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ReceiptText,
  AlertCircle,
  CreditCard,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Activity,
  ArrowRight,
  Sparkles,
  Send,
  Zap,
  Receipt,
  Upload,
  Lock,
  Unlock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { motion } from "motion/react";

interface FinanceDashboardProps {
  onNavigate: (view: ViewState) => void;
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ onNavigate }) => {
  const {
    cashAccounts,
    cashTransactions,
    salesTransactions,
    expenseCategories,
    purchaseOrders,
    suppliers,
    employees,
    contracts,
    bankReconciliations,
    closedPeriods,
  } = useStore();

  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [financeAiInput, setFinanceAiInput] = useState("");

  const selectedPeriodStr =
    filterMonth !== -1
      ? `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}`
      : null;
  const isSelectedPeriodClosed = selectedPeriodStr
    ? closedPeriods.some((p) => p.period === selectedPeriodStr)
    : false;

  const handleOpenCopilot = (
    tab: "quick-input" | "receipt" | "consultant" | "insights",
    prompt?: string
  ) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-assistant", {
        detail: { tab, prompt: prompt || financeAiInput },
      })
    );
    if (prompt || financeAiInput) setFinanceAiInput("");
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Helper date filter
  const isDateInFilter = (dateStr: string) => {
    if (filterMonth === -1) return true;
    const d = new Date(dateStr);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  };

  const filteredFinance = cashTransactions.filter((f) => isDateInFilter(f.date));
  const filteredSales = salesTransactions.filter((s) => isDateInFilter(s.date));

  // Hitung Saldo Tiap Akun Kas & Bank
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

  // Total Likuiditas Kas
  const totalLiquidity = useMemo(() => {
    return (Object.values(accountBalances) as number[]).reduce((sum, val) => sum + val, 0);
  }, [accountBalances]);

  // Arus Kas Periode Ini
  const totalCashIn = useMemo(() => {
    return filteredFinance
      .filter((f) => f.type === "CASH_IN")
      .reduce((sum, f) => sum + f.amount, 0);
  }, [filteredFinance]);

  const totalCashOut = useMemo(() => {
    return filteredFinance
      .filter((f) => f.type === "CASH_OUT")
      .reduce((sum, f) => sum + f.amount, 0);
  }, [filteredFinance]);

  const netProfit = totalCashIn - totalCashOut;
  const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);

  // Margin Laba Operasional
  const profitMarginPercent = totalCashIn > 0 ? ((netProfit / totalCashIn) * 100).toFixed(1) : "0.0";

  // Data Grafik Arus Masuk vs Arus Keluar
  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const daysInMonth = filterMonth === -1 ? 30 : getDaysInMonth(filterMonth, filterYear);

  const chartData = useMemo(() => {
    if (filterMonth === -1) {
      return Array.from({ length: 12 }, (_, i) => {
        const monthCashIn = cashTransactions
          .filter((c) => {
            if (c.type !== "CASH_IN") return false;
            const d = new Date(c.date);
            return d.getMonth() === i && d.getFullYear() === filterYear;
          })
          .reduce((sum, c) => sum + c.amount, 0);

        const monthExpense = cashTransactions
          .filter((c) => {
            if (c.type !== "CASH_OUT") return false;
            const d = new Date(c.date);
            return d.getMonth() === i && d.getFullYear() === filterYear;
          })
          .reduce((sum, c) => sum + c.amount, 0);

        return {
          name: new Date(0, i).toLocaleString("id-ID", { month: "short" }),
          masuk: monthCashIn,
          keluar: monthExpense,
        };
      });
    } else {
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dayStr = `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const dayCashIn = filteredFinance
          .filter((c) => c.type === "CASH_IN" && c.date.startsWith(dayStr))
          .reduce((sum, c) => sum + c.amount, 0);

        const dayExpense = filteredFinance
          .filter((c) => c.type === "CASH_OUT" && c.date.startsWith(dayStr))
          .reduce((sum, c) => sum + c.amount, 0);

        return {
          name: `${day}`,
          masuk: dayCashIn,
          keluar: dayExpense,
        };
      });
    }
  }, [filterMonth, filterYear, filteredFinance, cashTransactions, daysInMonth]);

  // Donut Chart: Pengeluaran per Kategori
  const expenseByCategory = useMemo(() => {
    const expenses: Record<string, number> = {};
    filteredFinance
      .filter((f) => f.type === "CASH_OUT")
      .forEach((f) => {
        const catName = expenseCategories.find((c) => c.id === f.categoryId)?.name || "Operasional";
        expenses[catName] = (expenses[catName] || 0) + f.amount;
      });

    const sorted = Object.entries(expenses).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }));
    const others = sorted.slice(5).reduce((sum, [_, val]) => sum + val, 0);
    if (others > 0) {
      top.push({ name: "Lainnya", value: others });
    }
    return top;
  }, [filteredFinance, expenseCategories]);

  const PIE_COLORS = ["#1b2cc0", "#4a5ff0", "#059669", "#d97706", "#7c3aed", "#e11d48"];

  // Kewajiban Pembayaran PO Belum Lunas (Accounts Payable)
  const unpaidPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === "UNPAID" || po.status === "PARTIAL");
  }, [purchaseOrders]);

  const totalUnpaidPOAmount = useMemo(() => {
    return unpaidPurchaseOrders.reduce((sum, po) => {
      const remaining = po.totalAmount - (po.amountPaid || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
  }, [unpaidPurchaseOrders]);

  // Estimasi Beban Gaji Karyawan Aktif
  const activeContracts = useMemo(() => {
    return contracts.filter((c) => {
      const emp = employees.find((e) => e.id === c.employeeId);
      return emp && emp.status === "AKTIF" && c.status === "ACTIVE";
    });
  }, [contracts, employees]);

  const estimatedMonthlyPayroll = useMemo(() => {
    return activeContracts.reduce((sum, c) => sum + (c.baseSalary || 0), 0);
  }, [activeContracts]);

  // Status Rekonsiliasi Bank Terakhir
  const latestRecon = useMemo(() => {
    if (bankReconciliations.length === 0) return null;
    return [...bankReconciliations].sort((a, b) => b.period.localeCompare(a.period))[0];
  }, [bankReconciliations]);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <Building2 className="w-5 h-5 text-brand-600" />;
      case "SAVINGS":
        return <Landmark className="w-5 h-5 text-purple-600" />;
      case "E_WALLET":
        return <Smartphone className="w-5 h-5 text-emerald-600" />;
      default:
        return <Wallet className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── HEADER & FILTER BAR ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/60">
              Finance Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Dashboard Keuangan & Arus Kas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola likuiditas kas, rekonsiliasi bank, beban pengeluaran, dan kewajiban pembayaran kafe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {selectedPeriodStr && (
            <button
              onClick={() => onNavigate("finance_reports")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition shadow-2xs border cursor-pointer ${
                isSelectedPeriodClosed
                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50"
              }`}
              title={
                isSelectedPeriodClosed
                  ? `Periode ${selectedPeriodStr} telah Tutup Buku. Klik untuk melihat Laporan Laba Rugi.`
                  : `Periode ${selectedPeriodStr} masih terbuka. Klik untuk mengelola atau menutup buku.`
              }
            >
              {isSelectedPeriodClosed ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Tutup Buku: Terkunci</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tutup Buku: Terbuka</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5 shadow-2xs">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-transparent border-none text-base sm:text-xs font-bold text-slate-800 focus:ring-0 cursor-pointer py-1.5 pl-2.5 pr-4"
            >
              <option value={-1}>Semua Bulan</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString("id-ID", { month: "long" })}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-transparent border-none text-base sm:text-xs font-bold text-slate-800 focus:ring-0 cursor-pointer py-1.5 pl-2.5 pr-4"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Finance AI Copilot Hub (Bookkeeping & Smart OCR) ─────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c163b] via-[#101e52] to-[#1a2d75] text-white p-5 sm:p-6 shadow-xl border border-indigo-950/40">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner">
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>Julia AI Copilot</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-brand-200 border border-white/15">
                      Finance & Cash Flow Hub
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Data entry kas secepat kalimat narasi kasir, ekstraksi struk/invoice otomatis (OCR), & audit saldo bank.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenCopilot("quick-input")}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white text-brand-900 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Buka Copilot Penuh →</span>
            </button>
          </div>

          {/* Quick Ask / Data Entry Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (financeAiInput.trim()) {
                handleOpenCopilot("quick-input", financeAiInput);
              }
            }}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 pl-4 focus-within:bg-white/15 focus-within:border-white/40 transition-all shadow-inner"
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <input
              type="text"
              value={financeAiInput}
              onChange={(e) => setFinanceAiInput(e.target.value)}
              placeholder="Ketik catatan pengeluaran cepat (misal: Beli susu 6L 111rb kas laci, es kristal 2 bal 30rb)..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-300 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!financeAiInput.trim()}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>Proses</span>
              <Send className="w-3 h-3" />
            </button>
          </form>

          {/* Finance Action Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mr-1">
              Aksi Cepat Finance:
            </span>
            <button
              onClick={() => handleOpenCopilot("quick-input")}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>⚡ Catat Pengeluaran Cepat</span>
            </button>
            <button
              onClick={() => handleOpenCopilot("receipt")}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-brand-200" />
              <span>📸 Pindai Nota / Dokumen (OCR)</span>
            </button>
            <button
              onClick={() => handleOpenCopilot("insights")}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>📊 Audit Margin & Laba Toko</span>
            </button>
            <button
              onClick={() =>
                handleOpenCopilot(
                  "consultant",
                  "Bagaimana analisis pengeluaran terbesar toko bulan ini dan cara menghemat biaya operasional?"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-200" />
              <span>💡 Konsultasi Penghematan Biaya</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── HERO FINANCIAL KPI CARDS ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Likuiditas Kas */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-gradient p-5 rounded-3xl border border-brand-800 text-white shadow-sm flex flex-col justify-between relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-brand-200">
              Total Likuiditas Kas
            </span>
            <div className="w-9 h-9 rounded-2xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              {formatCurrency(totalLiquidity)}
            </p>
            <p className="text-[11px] text-brand-100/70 mt-1">
              Dari {cashAccounts.length} pos kas & rekening aktif
            </p>
          </div>
        </motion.div>

        {/* Laba Bersih & Margin */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Laba Bersih Operasional
            </span>
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${netProfit >= 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"}`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className={`text-2xl font-bold font-mono tracking-tight ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(netProfit)}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-full ${netProfit >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                Margin: {profitMarginPercent}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Total Arus Masuk */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Arus Masuk (In)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {formatCurrency(totalCashIn)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Omzet kasir: {formatCurrency(totalSalesRevenue)}
            </p>
          </div>
        </motion.div>

        {/* Total Arus Keluar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Beban Keluar (Out)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-rose-600">
              {formatCurrency(totalCashOut)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Bahan baku, utilitas & operasional
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── SALDO POS KAS & AKUN BANK ────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Rincian Pos Kas & Rekening Bank
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribusi saldo riil di laci kasir, rekening bank operasional, dan e-wallet.
            </p>
          </div>
          <button
            onClick={() => onNavigate("cash_flow")}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 group cursor-pointer"
          >
            <span>Buka Mutasi Kas</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
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
                  <span className="text-xs font-bold text-slate-800 truncate mr-2">
                    {acc.name}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
                    {getAccountIcon(acc.type)}
                  </div>
                </div>
                <p className={`text-lg font-bold font-mono ${bal < 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {formatCurrency(bal)}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px]">
                  <span className="text-slate-400 font-semibold uppercase">{acc.type}</span>
                  <span className="text-emerald-700 font-bold">Aktif</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CHARTS SECTION ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tren Arus Kas Area Chart */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Tren Arus Masuk vs Arus Keluar
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filterMonth === -1 ? "Agregasi per bulan sepanjang tahun" : "Pergerakan kas harian bulan ini"}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1b2cc0" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1b2cc0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-3.5 py-3 text-xs">
                      <p className="font-bold text-slate-800 mb-1.5">{label}</p>
                      {payload.map((entry: any) => (
                        <div key={entry.dataKey} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                          <span className="text-slate-600 font-medium">{entry.name === "masuk" ? "Arus Masuk" : "Arus Keluar"}:</span>
                          <span className="font-bold font-mono" style={{ color: entry.color }}>
                            {formatCurrency(entry.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="masuk" name="masuk" stroke="#1b2cc0" strokeWidth={2.5} fill="url(#colorCashIn)" dot={false} />
              <Area type="monotone" dataKey="keluar" name="keluar" stroke="#e11d48" strokeWidth={2.5} fill="url(#colorCashOut)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-brand-600 rounded-full" />
              <span className="text-xs font-semibold text-slate-600">Arus Masuk (In)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-rose-600 rounded-full" />
              <span className="text-xs font-semibold text-slate-600">Arus Keluar (Out)</span>
            </div>
          </div>
        </div>

        {/* Donut Chart: Pengeluaran per Kategori */}
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Struktur Beban Biaya
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Pengeluaran berdasarkan kategori</p>
          </div>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-3.5 py-2.5 text-xs">
                        <p className="font-semibold text-slate-800">{payload[0].name}</p>
                        <p className="text-slate-600 font-bold font-mono mt-0.5">
                          {formatCurrency(payload[0].value)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => <span className="text-xs font-medium text-slate-700">{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] text-slate-400">
              <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs font-medium">Belum ada data pengeluaran</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FINANCE TASK & LIABILITIES RADAR ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Hutang PO Bahan Baku Belum Lunas */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Hutang Pembelian (PO)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                {unpaidPurchaseOrders.length} Pending
              </span>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">
              {formatCurrency(totalUnpaidPOAmount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Total tagihan supplier yang belum lunas.
            </p>

            <div className="mt-4 space-y-2 max-h-36 overflow-y-auto no-scrollbar">
              {unpaidPurchaseOrders.slice(0, 3).map((po) => {
                const supp = suppliers.find((s) => s.id === po.supplierId)?.name || "Supplier";
                const rem = po.totalAmount - (po.amountPaid || 0);
                return (
                  <div key={po.id} className="p-2.5 rounded-xl bg-slate-50 text-xs flex justify-between items-center border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">{po.poNumber}</p>
                      <p className="text-[10px] text-slate-500">{supp}</p>
                    </div>
                    <span className="font-bold font-mono text-rose-600">{formatCurrency(rem)}</span>
                  </div>
                );
              })}
              {unpaidPurchaseOrders.length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">Tidak ada hutang tagihan PO.</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onNavigate("purchases")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Lihat Daftar Pembelian</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Rekonsiliasi Bank */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rekonsiliasi Bank
              </span>
              <div className="w-7 h-7 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            {latestRecon ? (
              <div>
                <p className="text-base font-bold text-slate-900">
                  Periode: {latestRecon.period}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${latestRecon.status === "RECONCILED" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                    Status: {latestRecon.status}
                  </span>
                </div>
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/50 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo Awal:</span>
                    <span className="font-bold font-mono text-slate-800">{formatCurrency(latestRecon.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo Akhir:</span>
                    <span className="font-bold font-mono text-slate-800">{formatCurrency(latestRecon.closingBalance)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Belum ada rekonsiliasi yang dicatat bulan ini.</p>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate("bank_reconciliation")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Buka Rekonsiliasi Bank</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Beban Gaji & Payroll Liability */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Estimasi Beban Payroll
              </span>
              <div className="w-7 h-7 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">
              {formatCurrency(estimatedMonthlyPayroll)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Estimasi total gaji pokok {activeContracts.length} karyawan aktif bulan ini.
            </p>

            <div className="mt-4 p-3.5 bg-brand-50/50 border border-brand-100 rounded-2xl">
              <p className="text-xs font-semibold text-brand-900">
                Pencairan Penggajian
              </p>
              <p className="text-[11px] text-brand-700 mt-0.5">
                Pastikan saldo rekening operasional mencukupi sebelum tanggal cut-off gaji.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("payroll")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Kelola Payroll & Gaji</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── FINANCE QUICK ACTIONS GRID ───────────────────────────────────── */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Aksi Cepat Tim Keuangan
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate("cash_flow")}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-500 hover:shadow-xs transition-all text-left group cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-900">Catat Arus Kas</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Input kas masuk / keluar</p>
          </button>

          <button
            onClick={() => onNavigate("bank_reconciliation")}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-500 hover:shadow-xs transition-all text-left group cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-900">Rekonsiliasi Bank</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Cocokkan rekening koran</p>
          </button>

          <button
            onClick={() => onNavigate("finance_reports")}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-500 hover:shadow-xs transition-all text-left group cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-900">Laporan Laba Rugi</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Evaluasi performa berkala</p>
          </button>

          <button
            onClick={() => onNavigate("expense_categories")}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-500 hover:shadow-xs transition-all text-left group cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-900">Kategori Biaya</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Atur pos pengeluaran</p>
          </button>
        </div>
      </div>
    </div>
  );
};
