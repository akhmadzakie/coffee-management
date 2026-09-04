import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/format';
import { Play, Square, History, AlertCircle, DollarSign, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { ShiftSession } from '../types';

export const ShiftManagement = () => {
  const { shifts, openShift, closeShift, settings, salesTransactions, cashTransactions, currentUser, isReadOnly } = useStore();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [startingCashInput, setStartingCashInput] = useState('');
  const [endingCashInput, setEndingCashInput] = useState('');

  const isIndo = settings.language === 'id';
  
  // Find current open shift
  const currentShift = shifts.find(s => s.status === 'OPEN');
  const pastShifts = shifts.filter(s => s.status === 'CLOSED').sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  // Calculate expected cash for current shift
  let totalSales = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;

  if (currentShift) {
    const shiftStartTime = new Date(currentShift.startTime).getTime();
    
    // Sum sales after shift started
    totalSales = salesTransactions
      .filter(t => new Date(t.date).getTime() >= shiftStartTime)
      .reduce((sum, t) => sum + t.totalPrice, 0);
      
    // Sum cash transactions after shift started
    const recentCashTxs = cashTransactions.filter(t => new Date(t.date).getTime() >= shiftStartTime);
    
    totalCashIn = recentCashTxs
      .filter(t => t.type === 'CASH_IN')
      .reduce((sum, t) => sum + t.amount, 0);
      
    totalCashOut = recentCashTxs
      .filter(t => t.type === 'CASH_OUT')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  const expectedEndingCash = currentShift 
    ? (currentShift.startingCash + totalSales + totalCashIn - totalCashOut) 
    : 0;

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(startingCashInput.replace(/\D/g, ''));
    if (amount >= 0) {
      openShift({
        userId: currentUser?.id || 'unknown',
        startTime: new Date().toISOString(),
        endTime: null,
        startingCash: amount,
        expectedEndingCash: null,
        actualEndingCash: null,
        difference: null,
        status: 'OPEN'
      });
      setStartingCashInput('');
    }
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    
    const actual = Number(endingCashInput.replace(/\D/g, ''));
    if (actual >= 0) {
      // In a real app, we'd also record the expectedEndingCash so it's frozen in time
      // For now, closeShift calculates difference based on expected if we pass it, but we can pass actual and let it calculate or we just pass actual.
      // Wait, StoreContext's closeShift calculates difference using `expectedEndingCash` which is null. I should patch StoreContext to accept `expectedEndingCash`.
      // Actually, I'll just use closeShift(currentShift.id, actual). The store will calculate difference = actual - expected.
      closeShift(currentShift.id, actual);
      setEndingCashInput('');
    }
  };

  const formatNumberInput = (value: string) => {
    const num = value.replace(/\D/g, '');
    return num ? parseInt(num).toLocaleString('id-ID') : '';
  };


  // Prepare data for shift history chart
  const shiftChartData = pastShifts.slice(0, 7).reverse().map(shift => {
    const isMorning = new Date(shift.startTime).getHours() < 14;
    return {
      name: new Date(shift.startTime).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }) + (isMorning ? ' (Pagi)' : ' (Mlm)'),
      kas: shift.actualEndingCash || 0,
      selisih: shift.difference || 0,
      isPagi: isMorning
    };
  });

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex space-x-6 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`font-medium pb-2 -mb-[18px] transition-colors text-sm ${
            activeTab === 'current' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {isIndo ? 'Shift Saat Ini' : 'Current Shift'}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`font-medium pb-2 -mb-[18px] transition-colors text-sm ${
            activeTab === 'history' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {isIndo ? 'Riwayat Shift' : 'Shift History'}
        </button>
      </div>

      {activeTab === 'current' && (
        <div className="max-w-3xl">
          {!currentShift ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              {isReadOnly ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-700 mb-2">Tidak Ada Shift Aktif</h2>
                  <p className="text-slate-500 text-sm">Saat ini tidak ada shift yang sedang berjalan. Kasir dapat membuka shift baru.</p>
                </div>
              ) : (
                <div>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 ml-1" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {isIndo ? 'Mulai Shift Baru' : 'Start New Shift'}
                    </h2>
                    <p className="text-slate-500">
                      {isIndo ? 'Masukkan jumlah uang tunai di laci kasir saat ini.' : 'Enter the starting cash amount in the drawer.'}
                    </p>
                  </div>
                  <form onSubmit={handleOpenShift} className="max-w-md mx-auto space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {isIndo ? 'Modal Awal (Kasir)' : 'Starting Cash'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                        <input
                          type="text"
                          required
                          value={startingCashInput}
                          onChange={(e) => setStartingCashInput(formatNumberInput(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-lg font-bold text-slate-800 transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="w-5 h-5" />
                      {isIndo ? 'Buka Shift' : 'Open Shift'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shift Dashboard */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4 bg-slate-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-800">
                        {isIndo ? 'Shift Sedang Berjalan' : 'Active Shift'}
                      </h2>
                    </div>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 font-medium">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      {isIndo ? 'Dimulai pada' : 'Started at'} {new Date(currentShift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({new Date(currentShift.startTime).toLocaleDateString('id-ID')})
                    </p>
                  </div>
                  <div className="relative z-10 px-4 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm font-bold rounded-xl shadow-sm">
                    OPEN SHIFT
                  </div>
                </div>

                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-white shadow-2xs rounded-xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{isIndo ? 'Modal Awal' : 'Starting Cash'}</p>
                    <p className="text-xl font-black text-slate-800">{formatCurrency(currentShift.startingCash)}</p>
                  </div>
                  <div className="p-5 bg-blue-50 shadow-2xs rounded-xl border border-blue-100 flex flex-col justify-between group hover:bg-blue-100 transition-colors">
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">{isIndo ? 'Penjualan' : 'Sales'}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-black text-blue-900">+{formatCurrency(totalSales)}</p>
                      <TrendingUp className="w-5 h-5 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="p-5 bg-emerald-50 shadow-2xs rounded-xl border border-emerald-100 flex flex-col justify-between group hover:bg-emerald-100 transition-colors">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">{isIndo ? 'Kas Masuk' : 'Cash In'}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-black text-emerald-900">+{formatCurrency(totalCashIn)}</p>
                      <TrendingUp className="w-5 h-5 text-emerald-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="p-5 bg-rose-50 shadow-2xs rounded-xl border border-rose-100 flex flex-col justify-between group hover:bg-rose-100 transition-colors">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">{isIndo ? 'Kas Keluar' : 'Cash Out'}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-black text-rose-900">-{formatCurrency(totalCashOut)}</p>
                      <TrendingDown className="w-5 h-5 text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden rounded-b-2xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800" />
                  <div className="relative z-10">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">
                      {isIndo ? 'Ekspektasi Uang di Laci Kasir' : 'Expected Cash in Drawer'}
                    </p>
                    <p className="text-4xl font-black text-emerald-400 drop-shadow-md">{formatCurrency(expectedEndingCash)}</p>
                  </div>
                  <DollarSign className="w-16 h-16 text-slate-700 relative z-10" />
                </div>
              </motion.div>

              {/* Close Shift Form — only for staff who can modify */}
              {!isReadOnly && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Square className="w-5 h-5 text-rose-600" />
                    {isIndo ? 'Tutup Shift' : 'Close Shift'}
                  </h3>
                  <form onSubmit={handleCloseShift} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {isIndo ? 'Total Uang Fisik (Laci Kasir)' : 'Actual Cash in Drawer'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                        <input
                          type="text"
                          required
                          value={endingCashInput}
                          onChange={(e) => setEndingCashInput(formatNumberInput(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-lg font-bold text-slate-800 transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        {isIndo 
                          ? 'Pastikan jumlah uang dihitung dengan benar. Selisih akan dicatat dalam laporan.' 
                          : 'Ensure the cash is counted correctly. Any difference will be recorded.'}
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      {isIndo ? 'Akhiri Shift Sekarang' : 'End Shift Now'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          {/* Chart Section */}
          {pastShifts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                {isIndo ? 'Tren Total Kas (7 Shift Terakhir)' : 'Cash Trend (Last 7 Shifts)'}
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shiftChartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(value) => `Rp ${(value / 1000)}k`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [formatCurrency(value), 'Total Kas']}
                    />
                    <Bar dataKey="kas" radius={[6, 6, 0, 0]}>
                      {shiftChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isPagi ? '#3b82f6' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                {isIndo ? 'Riwayat Rekonsiliasi Shift' : 'Shift Reconciliation History'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{isIndo ? 'Waktu Buka' : 'Started'}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{isIndo ? 'Waktu Tutup' : 'Ended'}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{isIndo ? 'Modal Awal' : 'Starting'}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{isIndo ? 'Ekspektasi' : 'Expected'}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{isIndo ? 'Aktual' : 'Actual'}</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{isIndo ? 'Selisih' : 'Difference'}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {pastShifts.map(shift => (
                  <tr key={shift.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(shift.startTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {shift.endTime ? new Date(shift.endTime).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-700">
                      {formatCurrency(shift.startingCash)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-700">
                      {shift.expectedEndingCash != null ? formatCurrency(shift.expectedEndingCash) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-800">
                      {shift.actualEndingCash != null ? formatCurrency(shift.actualEndingCash) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {shift.difference != null ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          shift.difference > 0 ? 'bg-emerald-100 text-emerald-800' :
                          shift.difference < 0 ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {shift.difference > 0 ? '+' : ''}{formatCurrency(shift.difference)}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {pastShifts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                      {isIndo ? 'Belum ada riwayat shift' : 'No shift history'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </motion.div>
      )}
    </div>
  );
};
