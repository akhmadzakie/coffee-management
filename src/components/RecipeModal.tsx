import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, X, Check, UtensilsCrossed } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Recipe, RecipeIngredient, Ingredient } from "../types";

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: Omit<Recipe, "id">) => void;
  editingRecipe: Recipe | null;
  ingredients: Ingredient[];
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRecipe,
  ingredients,
}) => {
  const [menuName, setMenuName] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<Omit<RecipeIngredient, "id">[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingRecipe) {
        setMenuName(editingRecipe.menuName || "");
        let ingList = editingRecipe.ingredients;
        if (typeof ingList === "string") {
          try {
            ingList = JSON.parse(ingList);
          } catch {
            ingList = [];
          }
        }
        setRecipeIngredients(Array.isArray(ingList) ? ingList : []);
      } else {
        setMenuName("");
        setRecipeIngredients([]);
      }
    }
  }, [isOpen, editingRecipe]);

  const handleAddIngredient = () => {
    setRecipeIngredients([
      ...recipeIngredients,
      { ingredientId: "", quantity: 1 },
    ]);
  };

  const handleIngredientChange = (index: number, field: keyof Omit<RecipeIngredient, "id">, value: any) => {
    const updated = [...recipeIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeIngredients(updated);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName.trim()) return alert("Nama menu tidak boleh kosong");
    if (recipeIngredients.length === 0) return alert("Minimal 1 bahan baku harus ditambahkan");
    if (recipeIngredients.some((ri) => !ri.ingredientId || ri.quantity <= 0)) {
      return alert("Harap lengkapi semua bahan baku dan takarannya (jumlah > 0)");
    }

    onSave({
      menuName: menuName.trim(),
      ingredients: recipeIngredients,
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="recipe-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center p-3 sm:p-6 z-50 overflow-y-auto"
        >
          <motion.div
            key="recipe-modal-card"
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-200/90"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    {editingRecipe ? "Edit Resep Menu" : "Tambah Resep Menu Baru"}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Tentukan takaran bahan yang otomatis dipotong setiap kali menu terjual di kasir.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Menu <span className="text-slate-400 font-normal">(Harus sama persis dengan nama menu di POS)</span>
                  </label>
                  <input
                    type="text"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    placeholder="e.g. Kopi Susu Gula Aren, Matcha Latte"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Daftar Bahan & Takaran (Bill of Materials)
                    </label>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={handleAddIngredient}
                      className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Bahan</span>
                    </motion.button>
                  </div>

                  {recipeIngredients.length === 0 && (
                    <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50 space-y-1">
                      <p className="font-semibold text-slate-600 text-xs">Belum ada bahan baku di resep ini.</p>
                      <p className="text-[11px] text-slate-400">Klik tombol "+ Tambah Bahan" di atas untuk memasukkan komposisi takaran.</p>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {recipeIngredients.map((ri, idx) => {
                      const selectedIng = ingredients.find((i) => i.id === ri.ingredientId);
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2.5 hover:border-brand-200 transition-colors"
                        >
                          {/* Ingredient selector */}
                          <div className="flex-1">
                            <select
                              value={ri.ingredientId}
                              onChange={(e) => handleIngredientChange(idx, "ingredientId", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-base sm:text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
                            >
                              <option value="">-- Pilih Bahan Baku --</option>
                              {ingredients.map((ing) => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name} ({ing.unit})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity & Unit & Delete row on mobile, inline on tablet/desktop */}
                          <div className="flex items-center gap-2">
                            <div className="w-28 sm:w-28">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={ri.quantity}
                                onChange={(e) => handleIngredientChange(idx, "quantity", Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-base sm:text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                placeholder="Takaran"
                              />
                            </div>

                            <div className="px-2.5 py-2 bg-white rounded-xl border border-slate-200 text-slate-600 font-bold text-[11px] text-center min-w-[50px]">
                              {selectedIng ? selectedIng.unit : "-"}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                              title="Hapus baris bahan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-200/60 rounded-2xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Resep</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
