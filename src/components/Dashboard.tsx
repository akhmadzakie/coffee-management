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
  AlertCircle
} from "lucide-react";
import { useTranslation } from "../utils/i18n";

export const Dashboard = () => {
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
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    return contracts.filter(c => {
      if (c.status !== 'ACTIVE' || !c.endDate) return false;
      const end = new Date(c.endDate);
      return end >= today && end <= thirtyDaysFromNow;
    });
  }, [contracts]);
  
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
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#ff7300'];

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
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">
                Shift Aktif — Modal Awal: Rp
                {activeShift.startingCash.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Dimulai{" "}
                {new Date(activeShift.startTime).toLocaleString("id-ID")} ·
                Berjalan {hours > 0 ? `${hours} jam ` : ""}
                {minutes} menit
              </p>
            </div>
            <span className="shrink-0 px-2.5 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
              OPEN
            </span>
          </div>
        );
      })()}
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {isIndo ? "Ringkasan Eksekutif" : "Executive Dashboard"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isIndo
              ? "Pantau performa bisnis kedai kopi Anda secara real-time."
              : "Monitor your coffee shop business performance in real-time."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 flex items-center shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1"
            >
              <option value={-1}>{isIndo ? "Semua Waktu" : "All Time"}</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString(isIndo ? "id-ID" : "en-US", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-300 mx-2" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1 pr-4"
            >
              {[2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, staggerChildren: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6"
      >
        {cashAccounts.map((acc, idx) => (
          <motion.div
            key={acc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{
              y: -4,
              shadow:
                "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
            className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 text-sm font-medium">{acc.name}</h3>
              <div className="p-2.5 bg-slate-100 rounded-xl">
                {getAccountIcon(acc.type)}
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {formatCurrency(accountBalances[acc.id] || 0)}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              {acc.type === "BANK"
                ? "Bank"
                : acc.type === "CASH"
                  ? "Cash"
                  : acc.type === "E_WALLET"
                    ? "E-Wallet"
                    : "Savings"}
            </p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, staggerChildren: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Net Profit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{
            y: -4,
            shadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">
              {isIndo ? "Laba Bersih" : "Net Profit"}
            </h3>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatCurrency(netProfit)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-sm">
            {netProfit >= 0 ? (
              <span className="flex items-center text-emerald-600 font-medium">
                <TrendingUp className="w-4 h-4 mr-1" />
                Positif
              </span>
            ) : (
              <span className="flex items-center text-rose-600 font-medium">
                <TrendingDown className="w-4 h-4 mr-1" />
                Negatif
              </span>
            )}
            <span className="text-slate-400">
              {isIndo ? "Bulan Ini" : "This Month"}
            </span>
          </div>
        </motion.div>

        {/* Total Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{
            y: -4,
            shadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">
              {isIndo ? "Total Penjualan" : "Total Sales"}
            </h3>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatCurrency(totalSalesRevenue)}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {filteredSales.length}{" "}
            {isIndo ? "Transaksi Terimpor" : "Imported Transactions"}
          </p>
        </motion.div>

        {/* Cash In */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{
            y: -4,
            shadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">
              {isIndo ? "Uang Masuk" : "Cash In"}
            </h3>
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatCurrency(totalCashIn)}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {isIndo ? "Semua Kategori" : "All Categories"}
          </p>
        </motion.div>

        {/* Cash Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{
            y: -4,
            shadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">
              {isIndo ? "Uang Keluar" : "Cash Out"}
            </h3>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatCurrency(totalCashOut)}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {isIndo ? "Semua Kategori" : "All Categories"}
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, staggerChildren: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-6"
      >
        {/* HRD KPI */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Status SDM & Kontrak" : "HR & Contracts"}</h3>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {employees.filter(e => e.status === 'ACTIVE').length} <span className="text-sm font-normal text-slate-500">{isIndo ? "Aktif" : "Active"}</span>
          </p>
          {expiringContracts.length > 0 ? (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-amber-600 font-medium">
              <AlertCircle className="w-4 h-4 mr-1" />
              {expiringContracts.length} {isIndo ? "Kontrak segera berakhir" : "Contracts expiring soon"}
            </div>
          ) : (
             <div className="flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium">
               <Clock className="w-4 h-4 mr-1" />
               {isIndo ? "Semua kontrak aman" : "All contracts safe"}
             </div>
          )}
        </motion.div>

        {/* Inventory KPI */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Valuasi Stok" : "Inventory Valuation"}</h3>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatCurrency(totalInventoryValue)}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {ingredients.length} {isIndo ? "Bahan Baku" : "Ingredients"}
          </p>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">
            {isIndo ? "Tren Pendapatan vs Pengeluaran" : "Revenue vs Expense Trend"}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dy={10} />
                <YAxis tickFormatter={(value) => `Rp${(value / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dx={-10} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'sales' ? (isIndo ? 'Pendapatan' : 'Revenue') : (isIndo ? 'Pengeluaran' : 'Expense')]}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area type="monotone" dataKey="sales" name="sales" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="expense" name="expense" stroke="#F43F5E" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          {/* Expense Category Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {isIndo ? "Pengeluaran Berdasarkan Kategori" : "Expense by Category"}
            </h3>
            {expenseByCategory.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                {isIndo ? "Belum ada data pengeluaran." : "No expense data yet."}
              </div>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
          {/* Low Stock Alerts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {isIndo ? "Stok Menipis" : "Low Stock"}
              </h3>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            {lowStockIngredients.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {isIndo ? "Semua stok aman." : "All stock is safe."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockIngredients.slice(0, 5).map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {ing.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isIndo ? "Min:" : "Min:"} {ing.minStock} {ing.unit}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-700 rounded-lg">
                      {ing.currentStock} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
