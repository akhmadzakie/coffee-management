import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/format';
import { useStore } from '../store/StoreContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign, Package, ReceiptText, AlertTriangle, Download, Calendar, Wallet, Building2, Landmark, Smartphone } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export const Dashboard = () => {
  const { salesTransactions, ingredients, stockMovements, cashTransactions, cashAccounts, settings, shifts, currentUser } = useStore();
  const { t } = useTranslation(settings.language || 'id');
  const isIndo = settings.language === 'id';
  
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'BANK': return <Building2 className="w-5 h-5 text-indigo-500" />;
      case 'SAVINGS': return <Landmark className="w-5 h-5 text-purple-500" />;
      case 'E_WALLET': return <Smartphone className="w-5 h-5 text-sky-500" />;
      default: return <Wallet className="w-5 h-5 text-blue-500" />;
    }
  };

  const isDateInFilter = (dateStr: string) => {
    if (filterMonth === -1) return true;
    const d = new Date(dateStr);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  };

  const filteredFinance = cashTransactions.filter(f => isDateInFilter(f.date));
  const filteredSales = salesTransactions.filter(s => isDateInFilter(s.date));

  // Low Stock
  const lowStockIngredients = ingredients.filter(i => i.currentStock <= i.minStock);

  // Cashflow
  const totalCashIn = filteredFinance.filter(f => f.type === 'CASH_IN').reduce((sum, f) => sum + f.amount, 0);
  const totalCashOut = filteredFinance.filter(f => f.type === 'CASH_OUT').reduce((sum, f) => sum + f.amount, 0);
  const netProfit = totalCashIn - totalCashOut;
  const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);

  // Account Balances
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    cashAccounts.forEach(acc => balances[acc.id] = 0);
    
    cashTransactions.forEach(trx => {
      if (balances[trx.accountId] === undefined) balances[trx.accountId] = 0;
      if (trx.type === 'CASH_IN') balances[trx.accountId] += trx.amount;
      else if (trx.type === 'CASH_OUT') balances[trx.accountId] -= trx.amount;
    });
    return balances;
  }, [cashTransactions, cashAccounts]);

  // Best Sellers (from Sales)
  const productSalesCount: Record<string, number> = {};
  filteredSales.forEach(s => {
    productSalesCount[s.menuName] = (productSalesCount[s.menuName] || 0) + s.quantitySold;
  });

  const bestSellers = Object.entries(productSalesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([menuName, quantity]) => ({ menuName, quantity }));

  // Chart Data (Last 7 days or based on month)
  // Simple monthly aggregation for the chart
  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const daysInMonth = filterMonth === -1 ? 30 : getDaysInMonth(filterMonth, filterYear);
  
  const chartData = useMemo(() => {
    if (filterMonth === -1) {
      // Aggregate by month for the whole year
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const monthSales = salesTransactions.filter(s => {
          const d = new Date(s.date);
          return d.getMonth() === i && d.getFullYear() === filterYear;
        }).reduce((sum, s) => sum + s.totalPrice, 0);
        return {
          name: new Date(filterYear, i).toLocaleString('default', { month: 'short' }),
          sales: monthSales
        };
      });
      return monthlyData;
    } else {
      // Aggregate by day for the selected month
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const daySales = filteredSales.filter(s => new Date(s.date).getDate() === i + 1).reduce((sum, s) => sum + s.totalPrice, 0);
        return {
          name: `${i + 1}`,
          sales: daySales
        };
      });
      return dailyData;
    }
  }, [filterMonth, filterYear, filteredSales, salesTransactions, daysInMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Active Shift Banner */}
      {(() => {
        const activeShift = shifts.find(s => s.status === 'OPEN');
        if (!activeShift) return null;
        const shiftDuration = Math.floor((Date.now() - new Date(activeShift.startTime).getTime()) / 60000);
        const hours = Math.floor(shiftDuration / 60);
        const minutes = shiftDuration % 60;
        return (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">
                Shift Aktif — Modal Awal: Rp{activeShift.startingCash.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Dimulai {new Date(activeShift.startTime).toLocaleString('id-ID')} · Berjalan {hours > 0 ? `${hours} jam ` : ''}{minutes} menit
              </p>
            </div>
            <span className="shrink-0 px-2.5 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">OPEN</span>
          </div>
        );
      })()}
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{isIndo ? 'Ringkasan Eksekutif' : 'Executive Dashboard'}</h1>
          <p className="text-slate-500 text-sm mt-1">{isIndo ? 'Pantau performa bisnis kedai kopi Anda secara real-time.' : 'Monitor your coffee shop business performance in real-time.'}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 flex items-center shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1"
            >
              <option value={-1}>{isIndo ? 'Semua Waktu' : 'All Time'}</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString(isIndo ? 'id-ID' : 'en-US', { month: 'long' })}
                </option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-300 mx-2" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1 pr-4"
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
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
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {cashAccounts.map((acc, idx) => (
          <motion.div 
            key={acc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
            className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 text-sm font-medium">{acc.name}</h3>
              <div className="p-2.5 bg-slate-100 rounded-xl">
                {getAccountIcon(acc.type)}
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(accountBalances[acc.id] || 0)}</p>
            <p className="text-sm text-slate-400 mt-2">{acc.type === 'BANK' ? 'Bank' : acc.type === 'CASH' ? 'Cash' : acc.type === 'E_WALLET' ? 'E-Wallet' : 'Savings'}</p>
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
          whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">{isIndo ? 'Laba Bersih' : 'Net Profit'}</h3>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(netProfit)}</p>
          <div className="flex items-center gap-1.5 mt-2 text-sm">
            {netProfit >= 0 ? (
              <span className="flex items-center text-emerald-600 font-medium"><TrendingUp className="w-4 h-4 mr-1" />Positif</span>
            ) : (
              <span className="flex items-center text-rose-600 font-medium"><TrendingDown className="w-4 h-4 mr-1" />Negatif</span>
            )}
            <span className="text-slate-400">{isIndo ? 'Bulan Ini' : 'This Month'}</span>
          </div>
        </motion.div>

        {/* Total Sales */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">{isIndo ? 'Total Penjualan' : 'Total Sales'}</h3>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalSalesRevenue)}</p>
          <p className="text-sm text-slate-500 mt-2">{filteredSales.length} {isIndo ? 'Transaksi Terimpor' : 'Imported Transactions'}</p>
        </motion.div>

        {/* Cash In */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">{isIndo ? 'Uang Masuk' : 'Cash In'}</h3>
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCashIn)}</p>
          <p className="text-sm text-slate-500 mt-2">{isIndo ? 'Semua Kategori' : 'All Categories'}</p>
        </motion.div>

        {/* Cash Out */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-medium">{isIndo ? 'Uang Keluar' : 'Cash Out'}</h3>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCashOut)}</p>
          <p className="text-sm text-slate-500 mt-2">{isIndo ? 'Semua Kategori' : 'All Categories'}</p>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{isIndo ? 'Tren Penjualan' : 'Sales Trend'}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis tickFormatter={(value) => `Rp${(value / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          {/* Low Stock Alerts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{isIndo ? 'Stok Menipis' : 'Low Stock'}</h3>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            {lowStockIngredients.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{isIndo ? 'Semua stok aman.' : 'All stock is safe.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockIngredients.slice(0, 5).map(ing => (
                  <div key={ing.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{ing.name}</p>
                      <p className="text-xs text-slate-500">{isIndo ? 'Min:' : 'Min:'} {ing.minStock} {ing.unit}</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-700 rounded-lg">
                      {ing.currentStock} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{isIndo ? 'Menu Terlaris' : 'Top Menu Items'}</h3>
            {bestSellers.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                {isIndo ? 'Belum ada data penjualan.' : 'No sales data yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {bestSellers.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                        #{index + 1}
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{item.menuName}</p>
                    </div>
                    <p className="text-sm font-medium text-slate-600">{item.quantity} terjual</p>
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
