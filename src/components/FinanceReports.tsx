import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/format';
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
  ArrowRight
} from 'lucide-react';
import { ExportModal } from './ExportModal';
import { motion } from 'motion/react';

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
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ── HEADER SECTION ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">
              Statement & Realisasi Anggaran
            </span>
            {isPeriodClosed && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <Lock className="w-3 h-3 mr-1" />
                Periode Terkunci
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Laporan Keuangan & Laba Rugi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
            Analisis arus kas masuk, realisasi biaya operasional vs anggaran, dan kunci pembukuan periode.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month selector with iOS zoom prevention */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200/90 shadow-2xs">
            <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
            <input 
              type="month" 
              className="border-none text-base sm:text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Ekspor Laporan</span>
          </button>
        </div>
      </div>

      {/* ── PERIOD MANAGEMENT BANNER (MANAGER / SUPER_ADMIN) ────────────── */}
      {canManagePeriod && (
        <div className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isPeriodClosed 
            ? "bg-rose-50/70 border-rose-200 text-rose-950" 
            : "bg-white border-slate-200/90 shadow-2xs text-slate-800"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isPeriodClosed 
                ? "bg-rose-100 text-rose-700 border border-rose-200" 
                : "bg-slate-100 text-slate-700 border border-slate-200"
            }`}>
              {isPeriodClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>Manajemen Tutup Buku Periode</span>
                {isPeriodClosed && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPeriodClosed 
                  ? "Periode ini telah dikunci resmi. Seluruh mutasi kas, transaksi, dan payroll tidak dapat diedit staf."
                  : "Kunci periode ini jika seluruh pembukuan sudah final untuk mencegah perubahan data tanpa izin."}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isPeriodClosed ? (
              <button 
                onClick={() => {
                  if (window.confirm("Buka kembali periode ini? (Aktivitas ini akan dicatat ke dalam audit log)")) {
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
                  if (window.confirm("Kunci periode ini? Pastikan seluruh transaksi dan pengeluaran sudah benar.")) {
                    closePeriod(period, "Tutup buku rutin");
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

      {/* ── 3 BENTO KPI CARDS: P&L SUMMARY ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Total Revenue */}
        <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Pemasukan Kas
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Penjualan kasir & pendapatan non-operasional
          </p>
        </div>

        {/* Total Expense */}
        <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Pengeluaran Kas
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
            {formatCurrency(totalExpense)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Bahan baku, gaji, operasional, & utilitas
          </p>
        </div>

        {/* Net Profit */}
        <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Laba Bersih (Net Profit)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${netProfit >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
            {formatCurrency(netProfit)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
              netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}>
              {netProfit >= 0 ? "Surplus Kas" : "Defisit Operasional"}
            </span>
          </div>
        </div>
      </div>

      {/* ── BUDGET VS ACTUAL SECTION (DUAL-VIEW MULTI-DEVICE) ───────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-brand-600" />
              <span>Realisasi Pengeluaran vs Anggaran (Budget vs Actual)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau batas plafon anggaran tiap pos biaya kafe dan deteksi potensi pemborosan sebelum overbudget.
            </p>
          </div>
        </div>
        
        {budgetComparison.length > 0 ? (
          <>
            {/* DESKTOP & TABLET VIEW: Structured Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-4">Kategori Pengeluaran</th>
                    <th className="p-4 text-right">Plafon Anggaran</th>
                    <th className="p-4 text-right">Realisasi Kas</th>
                    <th className="p-4 text-right">Sisa Anggaran (Variance)</th>
                    <th className="p-4 text-center">Persentase Penggunaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {budgetComparison.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{item.category}</td>
                      <td className="p-4 text-right font-mono text-slate-600">
                        {item.budgetAmount > 0 ? formatCurrency(item.budgetAmount) : "-"}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.actualAmount)}
                      </td>
                      <td className={`p-4 text-right font-mono font-bold ${item.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {item.budgetAmount > 0 ? (
                          item.variance >= 0 ? `+${formatCurrency(item.variance)}` : formatCurrency(item.variance)
                        ) : "-"}
                      </td>
                      <td className="p-4 text-center">
                        {item.budgetAmount > 0 ? (
                          <div className="flex items-center justify-center gap-2 max-w-[200px] mx-auto">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  item.usagePercentage > 100 
                                    ? 'bg-rose-500' 
                                    : item.usagePercentage > 85 
                                    ? 'bg-amber-500' 
                                    : 'bg-brand-600'
                                }`} 
                                style={{ width: `${Math.min(item.usagePercentage, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-bold font-mono w-12 text-right ${
                              item.usagePercentage > 100 ? 'text-rose-600' : 'text-slate-700'
                            }`}>
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
                        <span>Anggaran: <strong className="font-mono text-slate-700">{formatCurrency(item.budgetAmount)}</strong></span>
                        <span className={`font-mono font-bold ${item.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          Sisa: {item.variance >= 0 ? `+${formatCurrency(item.variance)}` : formatCurrency(item.variance)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                          <div 
                            className={`h-full rounded-full ${
                              item.usagePercentage > 100 
                                ? 'bg-rose-500' 
                                : item.usagePercentage > 85 
                                ? 'bg-amber-500' 
                                : 'bg-brand-600'
                            }`} 
                            style={{ width: `${Math.min(item.usagePercentage, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${
                          item.usagePercentage > 100 ? 'text-rose-600' : 'text-slate-700'
                        }`}>
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
          <div className="p-10 text-center text-slate-400 text-xs">
            Belum ada data anggaran dan pengeluaran pada periode {period}.
          </div>
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
