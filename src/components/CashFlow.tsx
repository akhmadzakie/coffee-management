import React, { useState } from 'react';
import { formatCurrency } from '../utils/format';
import { useStore } from '../store/StoreContext';
import { TrendingUp, TrendingDown, Plus, Search, Trash2 } from 'lucide-react';

export const CashFlow = () => {
  const { cashTransactions, addCashTransaction, deleteCashTransaction, settings, isReadOnly } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trxType, setTrxType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');

  const filteredTransactions = cashTransactions.filter(f => 
    f.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.category.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCashIn = cashTransactions.filter(f => f.type === 'CASH_IN').reduce((sum, f) => sum + f.amount, 0);
  const totalCashOut = cashTransactions.filter(f => f.type === 'CASH_OUT').reduce((sum, f) => sum + f.amount, 0);
  const netProfit = totalCashIn - totalCashOut;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    addCashTransaction({
      type: trxType,
      date: new Date().toISOString(),
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      referenceId: null
    });
    
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Uang Masuk</h3>
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCashIn)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Pengeluaran</h3>
            <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCashOut)}</p>
        </div>

        <div className="bg-primary text-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-blue-100">Arus Kas Bersih</h3>
            <div className="p-3 bg-white/20 text-white rounded-lg">
              {netProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(netProfit)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">Riwayat Transaksi Arus Kas</h2>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent w-full sm:w-64"
              />
            </div>
            
            {!isReadOnly && (
              <button
                onClick={() => {
                  setTrxType('CASH_IN');
                  setIsModalOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Transaksi
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                <th className="p-4 font-semibold text-slate-600">Jenis</th>
                <th className="p-4 font-semibold text-slate-600">Kategori</th>
                <th className="p-4 font-semibold text-slate-600">Deskripsi</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Jumlah</th>
                <th className="p-4 font-semibold text-slate-600 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((trx) => (
                <tr key={trx.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-800">{new Date(trx.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      trx.type === 'CASH_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {trx.type === 'CASH_IN' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{trx.category}</td>
                  <td className="p-4 text-slate-600">{trx.description}</td>
                  <td className={`p-4 text-right font-medium ${trx.type === 'CASH_IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {trx.type === 'CASH_IN' ? '+' : '-'}{formatCurrency(trx.amount)}
                  </td>
                  <td className="p-4 text-center">
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
                            deleteCashTransaction(trx.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Tambah Transaksi</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="flex gap-4 p-1 bg-slate-100 rounded-lg mb-6">
                  <button
                    type="button"
                    onClick={() => setTrxType('CASH_IN')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      trxType === 'CASH_IN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Uang Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrxType('CASH_OUT')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      trxType === 'CASH_OUT' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Pengeluaran
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah (Rp)</label>
                  <input
                    type="number"
                    name="amount"
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    name="category"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Contoh: Operasional, Gaji, Bahan Baku"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Penjelasan detail transaksi..."
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
