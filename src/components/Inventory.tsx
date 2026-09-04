import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Plus, Search, Trash2, ArrowDownToLine, ArrowUpFromLine, Package, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Ingredient } from '../types';

export const Inventory = () => {
  const { ingredients, stockMovements, addIngredient, deleteIngredient, addStockMovement, currentUser, isReadOnly } = useStore();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'movements'>('ingredients');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [selectedIngredientForMove, setSelectedIngredientForMove] = useState<string>('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');

  const filteredIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMovements = stockMovements.filter(m => {
    const ingredient = ingredients.find(i => i.id === m.ingredientId);
    if (!ingredient) return false;
    return ingredient.name.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAddIngredient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addIngredient({
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      currentStock: Number(formData.get('currentStock')),
      minStock: Number(formData.get('minStock')),
      category: formData.get('category') as string,
    });
    setIsAddIngredientOpen(false);
  };

  const handleAddMovement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    addStockMovement({
      ingredientId: formData.get('ingredientId') as string,
      type: movementType,
      quantity: Number(formData.get('quantity')),
      date: new Date().toISOString(),
      note: formData.get('note') as string,
      createdBy: currentUser?.name || 'System'
    });
    
    setIsAddMovementOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'ingredients' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Daftar Bahan Baku
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'movements' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Riwayat Stok
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent w-full"
            />
          </div>
          
          {activeTab === 'ingredients' ? (
            !isReadOnly ? (
              <button
                onClick={() => setIsAddIngredientOpen(true)}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Bahan
              </button>
            ) : null
          ) : (
            !isReadOnly ? (
              <button
                onClick={() => {
                  if (ingredients.length === 0) {
                    alert("Tambahkan bahan baku terlebih dahulu");
                    return;
                  }
                  setSelectedIngredientForMove(ingredients[0].id);
                  setMovementType('IN');
                  setIsAddMovementOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-yellow-600 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Input Stok
              </button>
            ) : null
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {activeTab === 'ingredients' ? (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              <AnimatePresence>
                {filteredIngredients.map((item, index) => {
                  const isLow = item.currentStock <= item.minStock;
                  
                  // Generate color based on category
                  const categoryColors: Record<string, string> = {
                    'Biji Kopi': 'bg-amber-100 text-amber-800 border-amber-200',
                    'Susu': 'bg-blue-100 text-blue-800 border-blue-200',
                    'Sirup': 'bg-pink-100 text-pink-800 border-pink-200',
                    'Gelas': 'bg-slate-100 text-slate-800 border-slate-200',
                  };
                  
                  const catColor = categoryColors[item.category] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                      className={`relative bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col justify-between overflow-hidden group ${isLow ? 'border-rose-200' : 'border-slate-200'}`}
                    >
                      {/* Danger indicator strip */}
                      {isLow && <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />}

                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${catColor} mb-2`}>
                            {item.category}
                          </span>
                          <h3 className="font-bold text-slate-800 text-lg leading-tight">{item.name}</h3>
                        </div>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              if (confirm('Yakin ingin menghapus bahan baku ini?')) {
                                deleteIngredient(item.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-2 pt-4 border-t border-slate-100 flex justify-between items-end">
                        <div>
                          <p className="text-xs text-slate-500 mb-1 font-medium">Sisa Stok</p>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-black tracking-tight ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                              {item.currentStock}
                            </span>
                            <span className="text-sm text-slate-500 font-medium">{item.unit}</span>
                          </div>
                        </div>
                        
                        {isLow ? (
                          <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">Stok Menipis!</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold">Aman</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {filteredIngredients.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="font-medium text-slate-500">Tidak ada bahan baku ditemukan.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                  <th className="p-4 font-semibold text-slate-600">Bahan Baku</th>
                  <th className="p-4 font-semibold text-slate-600">Jenis</th>
                  <th className="p-4 font-semibold text-slate-600">Jumlah</th>
                  <th className="p-4 font-semibold text-slate-600">Catatan</th>
                  <th className="p-4 font-semibold text-slate-600">Operator</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((mov) => {
                  const ingredient = ingredients.find(i => i.id === mov.ingredientId);
                  return (
                    <tr key={mov.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 text-slate-800">
                        {new Date(mov.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 font-medium text-slate-800">{ingredient?.name || 'Unknown'}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          mov.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {mov.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}
                        </span>
                      </td>
                      <td className={`p-4 font-medium ${mov.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {mov.type === 'IN' ? '+' : '-'}{mov.quantity} {ingredient?.unit}
                      </td>
                      <td className="p-4 text-slate-600">{mov.note || '-'}</td>
                      <td className="p-4 text-slate-600">{mov.createdBy}</td>
                    </tr>
                  );
                })}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Tidak ada riwayat pergerakan stok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddIngredientOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Tambah Bahan Baku</h2>
              <button onClick={() => setIsAddIngredientOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddIngredient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Bahan</label>
                <input type="text" name="name" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="e.g. Kopi Arabika Gayo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                  <input type="text" name="category" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="e.g. Biji Kopi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Satuan (Unit)</label>
                  <input type="text" name="unit" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="e.g. Kg, Gr, Liter" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stok Awal</label>
                  <input type="number" name="currentStock" required min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batas Minimum (Alert)</label>
                  <input type="number" name="minStock" required min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddIngredientOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddMovementOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Input Stok</h2>
              <button onClick={() => setIsAddMovementOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddMovement} className="p-6 space-y-4">
              <div className="flex gap-4 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMovementType('IN')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    movementType === 'IN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Barang Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('OUT')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    movementType === 'OUT' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Barang Keluar / Retur
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Bahan Baku</label>
                <select 
                  name="ingredientId" 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  value={selectedIngredientForMove}
                  onChange={(e) => setSelectedIngredientForMove(e.target.value)}
                >
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} (Stok: {ing.currentStock} {ing.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah</label>
                <input type="number" name="quantity" required min="1" step="any" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea name="note" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Opsional (misal: Pembelian Supplier A)"></textarea>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddMovementOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800">Simpan Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
