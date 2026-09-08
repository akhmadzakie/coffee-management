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

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          {canViewFinance ? (
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("FINANCE")}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "FINANCE"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {isIndo ? "Keuangan" : "Finance"}
              </button>
              <button
                onClick={() => setActiveTab("INVENTORY")}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "INVENTORY"
                    ? "bg-white text-amber-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {isIndo ? "Inventori" : "Inventory"}
              </button>
            </div>
          ) : (
             <div className="text-sm font-bold text-slate-600 px-4 py-2">
               {isIndo ? "Ringkasan Inventori" : "Inventory Summary"}
             </div>
          )}
          
          {activeTab === "FINANCE" && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 shadow-xs w-full sm:w-auto">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1"
              >
                <option value={-1}>{isIndo ? "Semua" : "All"}</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(0, i).toLocaleString(isIndo ? "id-ID" : "en-US", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1"
              >
                {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {activeTab === "FINANCE" && canViewFinance && (
        <motion.div
          key="finance-tab"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {cashAccounts.map((acc, idx) => (
              <motion.div key={acc.id} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <h3 className="text-slate-500 text-sm font-medium mb-2">{acc.name}</h3>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(accountBalances[acc.id] || 0)}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Laba Bersih" : "Net Profit"}</h3>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(netProfit)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Total Penjualan" : "Total Sales"}</h3>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalSalesRevenue)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Uang Masuk" : "Cash In"}</h3>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCashIn)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Uang Keluar" : "Cash Out"}</h3>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCashOut)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="sales" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="expense" stroke="#F43F5E" fill="#F43F5E" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-lg font-bold mb-4">{isIndo ? "Pengeluaran per Kategori" : "Expenses by Category"}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8">
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "INVENTORY" && (
        <motion.div key="inventory-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Valuasi Stok" : "Inventory Valuation"}</h3>
              <p className="text-2xl font-bold text-slate-800">{canViewFinance ? formatCurrency(totalInventoryValue) : "---"}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Stok Kritis" : "Low Stock"}</h3>
              <p className="text-2xl font-bold text-rose-600">{lowStockIngredients.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium">{isIndo ? "Aktivitas Bulan Ini" : "Monthly Activity"}</h3>
              <p className="text-2xl font-bold text-slate-800">{stockMovements.filter(m => new Date(m.date).getMonth() === new Date().getMonth()).length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="font-bold text-lg mb-4">{isIndo ? "Stok Menipis" : "Low Stock Alerts"}</h3>
              <div className="space-y-3">
                {lowStockIngredients.slice(0, 5).map((ing) => (
                  <div key={ing.id} className="flex justify-between p-3 bg-slate-50 rounded-xl">
                    <span>{ing.name}</span>
                    <span className="font-bold text-rose-600">{ing.currentStock} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <h3 className="font-bold text-lg mb-4">{isIndo ? "Aktivitas Terbaru" : "Recent Activities"}</h3>
              <div className="space-y-3">
                {recentMovements.map((m) => (
                  <div key={m.id} className="flex justify-between p-3 bg-slate-50 rounded-xl text-sm">
                    <span>{ingredients.find(i => i.id === m.ingredientId)?.name}</span>
                    <span className={m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                      {m.type === 'IN' ? '+' : '-'}{m.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
