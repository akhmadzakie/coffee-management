import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/format';

const FinanceReports: React.FC = () => {
  const { 
    cashTransactions,
    expenseCategories,
    budgets
  } = useStore();

  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );

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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Laporan Keuangan</h1>
        <div>
          <label className="mr-2 text-gray-700 font-medium">Periode:</label>
          <input 
            type="month" 
            className="border p-2 rounded"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          />
        </div>
      </div>

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
    </div>
  );
};

export default FinanceReports;
