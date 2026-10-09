import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/format';

import { Lock, Unlock, AlertTriangle, Download } from 'lucide-react';
import { ExportModal } from './ExportModal';

const FinanceReports: React.FC = () => {
  const { 
    currentUser,
    cashTransactions,
    expenseCategories,
    budgets,
    closedPeriods,
    closePeriod,
    reopenPeriod
  } = useStore();

  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [isExportOpen, setIsExportOpen] = useState(false);

  const isPeriodClosed = useMemo(() => {
    return closedPeriods.some(p => p.period === period);
  }, [closedPeriods, period]);

  const canManagePeriod = currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN';

  // Filter transactions by period
  const periodTransactions = useMemo(() => {
    return cashTransactions.filter(t => t.date.startsWith(period));
  }, [cashTransactions, period]);

  // Calculate totals
  const totalRevenue = periodTransactions
    .filter(t => t.type === 'CASH_IN')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = periodTransactions
    .filter(t => t.type === 'CASH_OUT')
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalRevenue - totalExpense;

  // Budget vs Actual calculation
  const budgetComparison = useMemo(() => {
    const periodBudgets = budgets.filter(b => b.period === period);
    
    // Group expenses by category
    const expenseByCategory: Record<string, number> = {};
    periodTransactions
      .filter(t => t.type === 'CASH_OUT' && t.categoryId)
      .forEach(t => {
        const catId = t.categoryId!;
        expenseByCategory[catId] = (expenseByCategory[catId] || 0) + t.amount;
      });
    
    return expenseCategories.map(cat => {
      const budget = periodBudgets.find(b => b.categoryId === cat.id);
      const budgetAmount = budget ? budget.amount : 0;
      const actualAmount = expenseByCategory[cat.id] || 0;
      const variance = budgetAmount - actualAmount;
      const usagePercentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

      return {
        category: cat.name,
        budgetAmount,
        actualAmount,
        variance,
        usagePercentage
      };
    }).filter(item => item.budgetAmount > 0 || item.actualAmount > 0); // Only show relevant cats
  }, [budgets, periodTransactions, expenseCategories, period]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Laporan Keuangan & Laba Rugi</h1>
          <p className="text-xs text-slate-500 mt-0.5">Analisis arus kas masuk, pengeluaran, realisasi anggaran, dan penutupan buku periode.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Periode:</span>
            <input 
              type="month" 
              className="border border-slate-300 p-2 rounded-xl text-xs font-semibold bg-white"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            />
          </div>
          {isPeriodClosed && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              <Lock className="w-3.5 h-3.5 mr-1" />
              Terkunci
            </span>
          )}
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Ekspor Laporan</span>
          </button>
        </div>
      </div>

      {canManagePeriod && (
        <div className="mb-6 p-4 rounded bg-gray-50 border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center">
              Manajemen Periode
              {isPeriodClosed && <AlertTriangle className="w-4 h-4 ml-2 text-amber-500" />}
            </h3>
            <p className="text-sm text-gray-600">
              {isPeriodClosed 
                ? "Periode ini telah dikunci. Data (Cash Flow, Payroll, dll) tidak dapat diubah."
                : "Tutup periode ini jika semua laporan sudah final. Data tidak akan bisa diubah."}
            </p>
          </div>
          <div>
            {isPeriodClosed ? (
              <button 
                onClick={() => {
                  if (window.confirm("Buka kembali periode ini? (Audit akan mencatat aksi ini)")) {
                    reopenPeriod(period, "Permintaan koreksi/Buka buku");
                  }
                }}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded font-medium transition"
              >
                <Unlock className="w-4 h-4" /> Buka Kembali
              </button>
            ) : (
              <button 
                onClick={() => {
                  if (window.confirm("Tutup periode ini? Pastikan semua transaksi sudah benar.")) {
                    closePeriod(period, "Tutup buku rutin");
                  }
                }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition"
              >
                <Lock className="w-4 h-4" /> Tutup Periode
              </button>
            )}
          </div>
        </div>
      )}

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm font-semibold mb-1">Total Pemasukan</h3>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded shadow border-l-4 border-red-500">
          <h3 className="text-gray-500 text-sm font-semibold mb-1">Total Pengeluaran</h3>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-semibold mb-1">Laba Bersih (Net Profit)</h3>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Anggaran vs Realisasi (Budget vs Actual)</h2>
        
        {budgetComparison.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border-b font-medium text-gray-600">Kategori</th>
                <th className="p-3 border-b font-medium text-gray-600 text-right">Anggaran</th>
                <th className="p-3 border-b font-medium text-gray-600 text-right">Realisasi</th>
                <th className="p-3 border-b font-medium text-gray-600 text-right">Sisa / Lebih (Variance)</th>
                <th className="p-3 border-b font-medium text-gray-600 text-center">Penggunaan</th>
              </tr>
            </thead>
            <tbody>
              {budgetComparison.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-3">{item.category}</td>
                  <td className="p-3 text-right">{formatCurrency(item.budgetAmount)}</td>
                  <td className="p-3 text-right">{formatCurrency(item.actualAmount)}</td>
                  <td className={`p-3 text-right font-medium ${item.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(item.variance)}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${item.usagePercentage > 100 ? 'bg-red-600' : 'bg-blue-600'}`} 
                          style={{ width: `${Math.min(item.usagePercentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{item.usagePercentage.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-center py-8">Belum ada data anggaran dan pengeluaran pada periode ini.</p>
        )}
      </div>

      <ExportModal 
        isOpen={isExportOpen} 
        onClose={() => setIsExportOpen(false)} 
        defaultModule="finance" 
      />
    </div>
  );
};

export default FinanceReports;
