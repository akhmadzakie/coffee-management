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
  } = useStore();

  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

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
    return Object.values(accountBalances).reduce((sum, val) => sum + val, 0);
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

  const PIE_COLORS = ["#c27803", "#241813", "#d97706", "#059669", "#78350f", "#ea580c"];

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
        return <Building2 className="w-5 h-5 text-amber-800" />;
      case "SAVINGS":
        return <Landmark className="w-5 h-5 text-stone-700" />;
      case "E_WALLET":
        return <Smartphone className="w-5 h-5 text-amber-700" />;
      default:
        return <Wallet className="w-5 h-5 text-amber-900" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 uppercase border border-amber-200">
              Finance Command Center
            </span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Dashboard Keuangan & Arus Kas
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola likuiditas kas, rekonsiliasi bank, beban pengeluaran, dan kewajiban pembayaran kafe.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-2xl p-1.5 shadow-2xs w-full sm:w-auto">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="bg-transparent border-none text-xs font-semibold text-stone-700 focus:ring-0 cursor-pointer py-1 pl-2 pr-4"
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
            className="bg-transparent border-none text-xs font-semibold text-stone-700 focus:ring-0 cursor-pointer py-1 pl-2 pr-4"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Likuiditas Kas */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1c130e] via-[#241813] to-[#2c1d17] p-5 rounded-3xl border border-[#3e2a20] text-white shadow-coffee flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-xs font-bold text-amber-200/80 uppercase tracking-wider">
              Total Likuiditas Kas
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tracking-tight">
              {formatCurrency(totalLiquidity)}
            </p>
            <p className="text-[11px] text-stone-400 mt-1">
              Dari {cashAccounts.length} pos kas & rekening aktif
            </p>
          </div>
        </motion.div>

        {/* Laba Bersih & Margin */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-coffee hover:shadow-coffee-lg transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Laba Bersih Operasional
            </span>
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${netProfit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className={`text-2xl font-bold font-mono tracking-tight ${netProfit >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
              {formatCurrency(netProfit)}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${netProfit >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
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
          className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-coffee hover:shadow-coffee-lg transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Total Arus Masuk (In)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-stone-900">
              {formatCurrency(totalCashIn)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              Omzet kasir: {formatCurrency(totalSalesRevenue)}
            </p>
          </div>
        </motion.div>

        {/* Total Arus Keluar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-coffee hover:shadow-coffee-lg transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Total Beban Keluar (Out)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tracking-tight text-rose-800">
              {formatCurrency(totalCashOut)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              Bahan baku, utilitas & operasional
            </p>
          </div>
        </motion.div>
      </div>

      {/* Saldo Pos Kas & Akun Bank */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">
              Rincian Pos Kas & Rekening Bank
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Distribusi saldo riil di laci kasir, rekening bank operasional, dan e-wallet.
            </p>
          </div>
          <button
            onClick={() => onNavigate("cash_flow")}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 group"
          >
            Buka Mutasi Kas <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cashAccounts.map((acc) => {
            const bal = accountBalances[acc.id] || 0;
            return (
              <div
                key={acc.id}
                className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/70 hover:border-amber-400 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-700 truncate mr-2">
                    {acc.name}
                  </span>
                  {getAccountIcon(acc.type)}
                </div>
                <p className={`text-lg font-bold font-mono ${bal < 0 ? "text-rose-600" : "text-stone-900"}`}>
                  {formatCurrency(bal)}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-200/50 text-[10px]">
                  <span className="text-stone-400 font-semibold uppercase">{acc.type}</span>
                  <span className="text-amber-700 font-semibold">Aktif</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tren Arus Kas Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
          <div className="mb-4">
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Tren Arus Masuk vs Arus Keluar
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {filterMonth === -1 ? "Agregasi per bulan sepanjang tahun" : "Pergerakan kas harian bulan ini"}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1ece6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#a8a29e" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border border-stone-200 rounded-2xl shadow-coffee-lg px-3.5 py-3 text-xs">
                      <p className="font-bold text-stone-800 mb-1.5">{label}</p>
                      {payload.map((entry: any) => (
                        <div key={entry.dataKey} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                          <span className="text-stone-600 font-medium">{entry.name === "masuk" ? "Arus Masuk" : "Arus Keluar"}:</span>
                          <span className="font-bold font-mono" style={{ color: entry.color }}>
                            {formatCurrency(entry.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="masuk" name="masuk" stroke="#d97706" strokeWidth={2.5} fill="url(#colorCashIn)" dot={false} />
              <Area type="monotone" dataKey="keluar" name="keluar" stroke="#e11d48" strokeWidth={2.5} fill="url(#colorCashOut)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-amber-600 rounded-full" />
              <span className="text-xs font-semibold text-stone-600">Arus Masuk (In)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-rose-600 rounded-full" />
              <span className="text-xs font-semibold text-stone-600">Arus Keluar (Out)</span>
            </div>
          </div>
        </div>

        {/* Donut Chart: Pengeluaran per Kategori */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
          <div className="mb-4">
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Struktur Beban Biaya
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">Pengeluaran berdasarkan kategori</p>
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
                      <div className="bg-white border border-stone-200 rounded-2xl shadow-coffee px-3.5 py-2.5 text-xs">
                        <p className="font-semibold text-stone-800">{payload[0].name}</p>
                        <p className="text-stone-600 font-bold font-mono mt-0.5">
                          {formatCurrency(payload[0].value)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => <span className="text-xs font-medium text-stone-700">{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] text-stone-400">
              <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs font-medium">Belum ada data pengeluaran</p>
            </div>
          )}
        </div>
      </div>

      {/* Finance Task & Liabilities Radar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Hutang PO Bahan Baku Belum Lunas */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Hutang Pembelian (PO)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                {unpaidPurchaseOrders.length} Pending
              </span>
            </div>
            <p className="text-xl font-bold font-mono text-stone-900">
              {formatCurrency(totalUnpaidPOAmount)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Total tagihan supplier yang belum lunas.
            </p>

            <div className="mt-4 space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
              {unpaidPurchaseOrders.slice(0, 3).map((po) => {
                const supp = suppliers.find((s) => s.id === po.supplierId)?.name || "Supplier";
                const rem = po.totalAmount - (po.amountPaid || 0);
                return (
                  <div key={po.id} className="p-2.5 rounded-xl bg-stone-50 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-stone-800">{po.poNumber}</p>
                      <p className="text-[10px] text-stone-500">{supp}</p>
                    </div>
                    <span className="font-bold font-mono text-rose-700">{formatCurrency(rem)}</span>
                  </div>
                );
              })}
              {unpaidPurchaseOrders.length === 0 && (
                <p className="text-xs text-stone-400 py-3 text-center">Tidak ada hutang tagihan PO.</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onNavigate("purchases")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            Lihat Daftar Pembelian <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Rekonsiliasi Bank */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Rekonsiliasi Bank
              </span>
              <CreditCard className="w-4 h-4 text-amber-700" />
            </div>
            {latestRecon ? (
              <div>
                <p className="text-base font-bold text-stone-900">
                  Periode: {latestRecon.period}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${latestRecon.status === "RECONCILED" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                    Status: {latestRecon.status}
                  </span>
                </div>
                <div className="mt-4 p-3 bg-stone-50 rounded-2xl border border-stone-200/50 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Saldo Awal:</span>
                    <span className="font-bold font-mono">{formatCurrency(latestRecon.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Saldo Akhir:</span>
                    <span className="font-bold font-mono">{formatCurrency(latestRecon.closingBalance)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <Clock className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs text-stone-500">Belum ada rekonsiliasi yang dicatat bulan ini.</p>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate("bank_reconciliation")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            Buka Rekonsiliasi Bank <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Beban Gaji & Payroll Liability */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Estimasi Beban Payroll
              </span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-xl font-bold font-mono text-stone-900">
              {formatCurrency(estimatedMonthlyPayroll)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Estimasi total gaji pokok {activeContracts.length} karyawan aktif bulan ini.
            </p>

            <div className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl">
              <p className="text-xs font-semibold text-emerald-900">
                Pencairan Penggajian
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Pastikan saldo rekening operasional mencukupi sebelum tanggal jatuh tempo cut-off gaji.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("payroll")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            Kelola Payroll & Gaji <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Finance Quick Actions Grid */}
      <div className="bg-stone-50/80 border border-stone-200/80 rounded-3xl p-6 shadow-coffee-sm">
        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">
          Aksi Cepat Tim Keuangan
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate("cash_flow")}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-amber-500 hover:shadow-coffee transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-stone-900">Catat Arus Kas</p>
            <p className="text-[10px] text-stone-500 mt-0.5">Input kas masuk / keluar</p>
          </button>

          <button
            onClick={() => onNavigate("bank_reconciliation")}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-amber-500 hover:shadow-coffee transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-stone-900">Rekonsiliasi Bank</p>
            <p className="text-[10px] text-stone-500 mt-0.5">Cocokkan rekening koran</p>
          </button>

          <button
            onClick={() => onNavigate("finance_reports")}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-amber-500 hover:shadow-coffee transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-stone-900">Laporan Laba Rugi</p>
            <p className="text-[10px] text-stone-500 mt-0.5">Evaluasi performa berkala</p>
          </button>

          <button
            onClick={() => onNavigate("expense_categories")}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-amber-500 hover:shadow-coffee transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-stone-200 text-stone-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-stone-900">Kategori Biaya</p>
            <p className="text-[10px] text-stone-500 mt-0.5">Atur pos pengeluaran</p>
          </button>
        </div>
      </div>
    </div>
  );
};
