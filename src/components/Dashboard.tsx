import React, { useState, useMemo } from "react";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ReceiptText,
  AlertTriangle,
  Download,
  Calendar,
  Wallet,
  Building2,
  Landmark,
  Smartphone,
  Users,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import { useTranslation } from "../utils/i18n";

export const Dashboard = ({ view }: { view: "FINANCE" | "INVENTORY" }) => {
  const {
    salesTransactions,
    ingredients,
    stockMovements,
    cashTransactions,
    cashAccounts,
    settings,
    shifts,
    currentUser,
    expenseCategories,
    contracts,
    employees,
  } = useStore();
  const { t } = useTranslation(settings.language || "id");
  const isIndo = settings.language === "id";

  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(
    new Date().getFullYear(),
  );

  const canViewFinance = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER" || currentUser?.role === "OWNER" || currentUser?.role === "FINANCE";
  
  const recentMovements = useMemo(() => {
    return [...stockMovements]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [stockMovements]);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <Building2 className="w-5 h-5 text-indigo-500" />;
      case "SAVINGS":
        return <Landmark className="w-5 h-5 text-purple-500" />;
      case "E_WALLET":
        return <Smartphone className="w-5 h-5 text-sky-500" />;
      default:
        return <Wallet className="w-5 h-5 text-blue-500" />;
    }
  };

  const isDateInFilter = (dateStr: string) => {
    if (filterMonth === -1) return true;
    const d = new Date(dateStr);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  };

  const filteredFinance = cashTransactions.filter((f) =>
    isDateInFilter(f.date),
  );
  const filteredSales = salesTransactions.filter((s) => isDateInFilter(s.date));

  // Low Stock
  const lowStockIngredients = ingredients.filter(
    (i) => i.currentStock <= i.minStock,
  );

  // Cashflow
  const totalCashIn = filteredFinance
    .filter((f) => f.type === "CASH_IN")
    .reduce((sum, f) => sum + f.amount, 0);
  const totalCashOut = filteredFinance
    .filter((f) => f.type === "CASH_OUT")
    .reduce((sum, f) => sum + f.amount, 0);
  const netProfit = totalCashIn - totalCashOut;
  const totalSalesRevenue = filteredSales.reduce(
    (sum, s) => sum + s.totalPrice,
    0,
  );

  // Account Balances
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

  // Best Sellers (from Sales)
  const productSalesCount: Record<string, number> = {};
  filteredSales.forEach((s) => {
    productSalesCount[s.menuName] =
      (productSalesCount[s.menuName] || 0) + s.quantitySold;
  });

  const bestSellers = Object.entries(productSalesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([menuName, quantity]) => ({ menuName, quantity }));

  // Chart Data (Last 7 days or based on month)
  // Simple monthly aggregation for the chart
  const getDaysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();
  const daysInMonth =
    filterMonth === -1 ? 30 : getDaysInMonth(filterMonth, filterYear);

  const chartData = useMemo(() => {
    if (filterMonth === -1) {
      // Aggregate by month for the whole year
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const monthSales = salesTransactions
          .filter((s) => {
            const d = new Date(s.date);
            return d.getMonth() === i && d.getFullYear() === filterYear;
          })
          .reduce((sum, s) => sum + s.totalPrice, 0);
          
        const monthExpense = cashTransactions
          .filter((c) => {
            if (c.type !== 'CASH_OUT') return false;
            const d = new Date(c.date);
            return d.getMonth() === i && d.getFullYear() === filterYear;
          })
          .reduce((sum, c) => sum + c.amount, 0);
          
        return {
          name: new Date(filterYear, i).toLocaleString("default", {
            month: "short",
          }),
          sales: monthSales,
          expense: monthExpense,
        };
      });
      return monthlyData;
    } else {
      // Aggregate by day for the selected month
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const daySales = filteredSales
          .filter((s) => new Date(s.date).getDate() === i + 1)
          .reduce((sum, s) => sum + s.totalPrice, 0);
          
        const dayExpense = filteredFinance
          .filter((c) => c.type === 'CASH_OUT' && new Date(c.date).getDate() === i + 1)
          .reduce((sum, c) => sum + c.amount, 0);
          
        return {
          name: `${i + 1}`,
          sales: daySales,
          expense: dayExpense,
        };
      });
      return dailyData;
    }
  }, [filterMonth, filterYear, filteredSales, salesTransactions, filteredFinance, cashTransactions, daysInMonth]);

  // Inventory Valuation
  const totalInventoryValue = ingredients.reduce((sum, ing) => sum + (ing.currentStock * (ing.costPerUnit || 0)), 0);

  // Expiring Contracts (within 30 days)
  const expiringContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    return contracts.filter(c => {
      // Check if the employee is still active, otherwise the contract doesn't matter
      const emp = employees.find(e => e.id === c.employeeId);
      if (!emp || emp.status !== "AKTIF") return false;
      
      if (c.status !== 'ACTIVE' || !c.endDate) return false;
      const end = new Date(c.endDate);
      return end >= today && end <= thirtyDaysFromNow;
    });
  }, [contracts, employees]);

  // Expired Contracts (Past end date but employee still active)
  const expiredContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today
    
    return contracts.filter(c => {
      const emp = employees.find(e => e.id === c.employeeId);
      if (!emp || emp.status !== "AKTIF") return false;
      
      if (c.status !== 'ACTIVE' || !c.endDate) return false;
      const end = new Date(c.endDate);
      return end < today;
    });
  }, [contracts, employees]);
  
  // Expense by Category (Donut Chart)
  const expenseByCategory = useMemo(() => {
    const expenses: Record<string, number> = {};
    filteredFinance.filter(f => f.type === 'CASH_OUT').forEach(f => {
      const catName = expenseCategories.find(c => c.id === f.categoryId)?.name || 'Lainnya';
      expenses[catName] = (expenses[catName] || 0) + f.amount;
    });
    
    // Sort and take top 5 + Others
    const sorted = Object.entries(expenses).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }));
    const others = sorted.slice(5).reduce((sum, [_, val]) => sum + val, 0);
    if (others > 0) {
      top.push({ name: 'Lainnya', value: others });
    }
    return top;
  }, [filteredFinance, expenseCategories]);
  
  const COLORS = ['#c27803', '#241813', '#d97706', '#059669', '#78350f', '#b45309'];

  // Dynamic year options: 5 years back to current
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Custom Recharts tooltip with Rupiah formatting
  const RupiahTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-stone-200 rounded-2xl shadow-coffee-lg px-3.5 py-3 text-xs">
        <p className="font-bold text-stone-800 mb-1.5">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-stone-600 font-medium">{entry.name === "sales" ? "Penjualan" : "Pengeluaran"}:</span>
            <span className="font-bold font-mono" style={{ color: entry.color }}>{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-stone-200 rounded-2xl shadow-coffee px-3.5 py-2.5 text-xs">
        <p className="font-semibold text-stone-800">{payload[0].name}</p>
        <p className="text-stone-600 font-bold font-mono mt-0.5">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Active Shift Banner */}
      {(() => {
        const activeShift = shifts.find((s) => s.status === "OPEN");
        if (!activeShift) return null;
        const shiftDuration = Math.floor(
          (Date.now() - new Date(activeShift.startTime).getTime()) / 60000,
        );
        const hours = Math.floor(shiftDuration / 60);
        const minutes = shiftDuration % 60;
        return (
          <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-5 py-3.5 shadow-coffee-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-900">
                Shift Kasir Aktif — Modal Awal: Rp
                {activeShift.startingCash.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Dimulai{" "}
                {new Date(activeShift.startTime).toLocaleString("id-ID")} ·
                Berjalan {hours > 0 ? `${hours} jam ` : ""}
                {minutes} menit
              </p>
            </div>
            <span className="shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-2xs">
              OPEN
            </span>
          </div>
        );
      })()}

      {/* HR Alerts */}
      {(currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN") && (
        <div className="space-y-3">
          {expiredContracts.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50/80 border border-rose-200/80 rounded-2xl px-5 py-3.5 shadow-coffee-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-rose-900">
                  {isIndo ? "Perhatian: Ada kontrak karyawan yang sudah KEDALUWARSA" : "Alert: Expired employee contracts detected"}
                </p>
                <p className="text-xs text-rose-700 mt-0.5">
                  {expiredContracts.length} {isIndo ? "karyawan masih berstatus AKTIF namun kontraknya telah melewati batas tanggal. Segera perbarui kontrak atau nonaktifkan karyawan." : "employees are still active past their contract end date. Please update or terminate."}
                </p>
              </div>
            </div>
          )}
          {expiringContracts.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl px-5 py-3.5 shadow-coffee-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900">
                  {isIndo ? "Pengingat: Ada kontrak yang akan segera habis" : "Reminder: Contracts expiring soon"}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {expiringContracts.length} {isIndo ? "kontrak karyawan akan habis dalam waktu 30 hari ke depan." : "employee contracts will expire in the next 30 days."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            {isIndo ? "Ringkasan Eksekutif" : "Executive Dashboard"}
          </h1>
          <p className="text-stone-500 text-xs mt-1">
            {isIndo
              ? "Pantau performa bisnis dan kesehatan finansial kafe secara real-time."
              : "Monitor your coffee shop performance and financial health in real-time."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          {view === "FINANCE" && (
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-2xl p-1.5 shadow-2xs w-full sm:w-auto">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="bg-transparent border-none text-xs font-semibold text-stone-700 focus:ring-0 cursor-pointer py-1 pl-2 pr-4"
              >
                <option value={-1}>{isIndo ? "Semua Bulan" : "All Months"}</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(0, i).toLocaleString(isIndo ? "id-ID" : "en-US", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="bg-transparent border-none text-xs font-semibold text-stone-700 focus:ring-0 cursor-pointer py-1 pl-2 pr-4"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {view === "FINANCE" && canViewFinance && (
        <motion.div
          key="finance-tab"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          {/* Cash Account Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {cashAccounts.map((acc, idx) => {
              const bal = accountBalances[acc.id] || 0;
              return (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", damping: 26, stiffness: 340, delay: idx * 0.04 }}
                  className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-coffee hover:shadow-coffee-lg transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider truncate mr-2">{acc.name}</span>
                    {getAccountIcon(acc.type)}
                  </div>
                  <p className={`text-xl font-bold font-mono ${bal < 0 ? "text-rose-600" : "text-stone-900"}`}>
                    {formatCurrency(bal)}
                  </p>
                  <p className="text-[10px] text-stone-400 font-semibold uppercase mt-1 tracking-wider">{acc.type}</p>
                </motion.div>
              );
            })}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: isIndo ? "Laba Bersih" : "Net Profit",
                value: netProfit,
                icon: <Activity className="w-5 h-5" />,
                color: netProfit >= 0 ? "text-emerald-800" : "text-rose-700",
                bg: netProfit >= 0 ? "bg-emerald-50/70 border-emerald-200/70" : "bg-rose-50/70 border-rose-200/70",
                iconBg: netProfit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800",
                trend: netProfit >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : <ArrowDownRight className="w-4 h-4 text-rose-600" />,
              },
              {
                label: isIndo ? "Total Penjualan" : "Total Sales",
                value: totalSalesRevenue,
                icon: <ReceiptText className="w-5 h-5" />,
                color: "text-amber-900",
                bg: "bg-amber-50/70 border-amber-200/70",
                iconBg: "bg-amber-100 text-amber-800",
                trend: <ArrowUpRight className="w-4 h-4 text-amber-600" />,
              },
              {
                label: isIndo ? "Total Arus Masuk" : "Cash In",
                value: totalCashIn,
                icon: <TrendingUp className="w-5 h-5" />,
                color: "text-emerald-800",
                bg: "bg-emerald-50/70 border-emerald-200/70",
                iconBg: "bg-emerald-100 text-emerald-800",
                trend: <ArrowUpRight className="w-4 h-4 text-emerald-600" />,
              },
              {
                label: isIndo ? "Total Arus Keluar" : "Cash Out",
                value: totalCashOut,
                icon: <TrendingDown className="w-5 h-5" />,
                color: "text-rose-800",
                bg: "bg-rose-50/70 border-rose-200/70",
                iconBg: "bg-rose-100 text-rose-800",
                trend: <ArrowDownRight className="w-4 h-4 text-rose-600" />,
              },
            ].map((kpi, idx) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 26, stiffness: 340, delay: (cashAccounts.length + idx) * 0.04 }}
                className={`bg-white p-5 rounded-3xl border shadow-coffee hover:shadow-coffee-lg transition-all ${kpi.bg}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${kpi.iconBg}`}>
                    {kpi.icon}
                  </div>
                  {kpi.trend}
                </div>
                <p className={`text-2xl font-bold font-mono tracking-tight ${kpi.color}`}>{formatCurrency(kpi.value)}</p>
                <p className="text-xs text-stone-600 mt-1 font-semibold">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
              <div className="mb-4">
                <h3 className="text-base font-bold text-stone-900 tracking-tight">
                  {isIndo ? "Tren Penjualan & Pengeluaran" : "Sales & Expense Trend"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {filterMonth === -1 ? (isIndo ? "Agregasi per bulan" : "Monthly aggregation") : (isIndo ? "Agregasi per hari" : "Daily aggregation")}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.20}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1ece6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<RupiahTooltip />} />
                  <Area type="monotone" dataKey="sales" name="sales" stroke="#d97706" strokeWidth={2.5} fill="url(#colorSales)" dot={false} />
                  <Area type="monotone" dataKey="expense" name="expense" stroke="#e11d48" strokeWidth={2.5} fill="url(#colorExpense)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-amber-600 rounded-full" />
                  <span className="text-xs font-semibold text-stone-600">{isIndo ? "Penjualan" : "Sales"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-rose-600 rounded-full" />
                  <span className="text-xs font-semibold text-stone-600">{isIndo ? "Pengeluaran" : "Expenses"}</span>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
              <div className="mb-4">
                <h3 className="text-base font-bold text-stone-900 tracking-tight">{isIndo ? "Pengeluaran per Kategori" : "Expenses by Category"}</h3>
                <p className="text-xs text-stone-500 mt-0.5">{isIndo ? "Distribusi pengeluaran periode" : "Selected period"}</p>
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
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
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
                  <p className="text-xs font-medium">{isIndo ? "Belum ada data pengeluaran" : "No expense data"}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {view === "INVENTORY" && (
        <motion.div key="inventory-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider">{isIndo ? "Valuasi Stok Bahan" : "Inventory Valuation"}</h3>
              <p className="text-2xl font-bold font-mono text-stone-900 mt-2">{canViewFinance ? formatCurrency(totalInventoryValue) : "---"}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider">{isIndo ? "Bahan Stok Kritis" : "Low Stock"}</h3>
              <p className="text-2xl font-bold font-mono text-rose-600 mt-2">{lowStockIngredients.length} item</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider">{isIndo ? "Pergerakan Bulan Ini" : "Monthly Movements"}</h3>
              <p className="text-2xl font-bold font-mono text-stone-900 mt-2">{stockMovements.filter(m => new Date(m.date).getMonth() === new Date().getMonth()).length} transaksi</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="font-bold text-base text-stone-900 mb-4">{isIndo ? "Bahan Baku Menipis" : "Low Stock Alerts"}</h3>
              <div className="space-y-3">
                {lowStockIngredients.slice(0, 5).map((ing) => (
                  <div key={ing.id} className="flex justify-between items-center p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/50">
                    <span className="text-sm font-semibold text-stone-800">{ing.name}</span>
                    <span className="font-bold font-mono text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      {ing.currentStock} {ing.unit}
                    </span>
                  </div>
                ))}
                {lowStockIngredients.length === 0 && (
                  <p className="text-xs text-stone-400 py-4 text-center">Semua stok bahan baku dalam batas aman.</p>
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="font-bold text-base text-stone-900 mb-4">{isIndo ? "Aktivitas Stok Terbaru" : "Recent Movements"}</h3>
              <div className="space-y-3">
                {recentMovements.map((m) => (
                  <div key={m.id} className="flex justify-between items-center p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/50 text-xs font-mono">
                    <span className="font-sans font-medium text-stone-800">{ingredients.find(i => i.id === m.ingredientId)?.name}</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full ${m.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                      {m.type === 'IN' ? '+' : '-'}{m.quantity}
                    </span>
                  </div>
                ))}
                {recentMovements.length === 0 && (
                  <p className="text-xs text-stone-400 py-4 text-center">Belum ada riwayat pergerakan stok.</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
