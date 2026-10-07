import React, { useState, useEffect } from "react";
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
        setMenuName(editingRecipe.menuName);
        setRecipeIngredients(editingRecipe.ingredients);
      } else {
        setMenuName("");
        setRecipeIngredients([]);
      }
    }
  }, [isOpen, editingRecipe]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {editingRecipe ? "Edit Resep" : "Tambah Resep Baru"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Menu (Harus sama persis dengan nama menu di Kasir)
                </label>
                <input
                    type="text"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Kopi Susu Aren"
                />
            </div>
            
            <div className="mb-2 flex justify-between items-center mt-6">
                <label className="block text-sm font-medium text-slate-700">
                    Bahan Baku (Bill of Materials)
                </label>
                <button 
                    type="button" 
                    onClick={handleAddIngredient}
                    className="text-sm px-3 py-1 bg-primary text-white rounded hover:bg-slate-800"
                >
                    + Tambah Bahan
                </button>
            </div>

            {recipeIngredients.length === 0 && (
                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-sm">
                    Belum ada bahan baku. Klik "+ Tambah Bahan" untuk memulai.
                </div>
            )}

            <div className="space-y-3">
                {recipeIngredients.map((ri, idx) => {
                    const selectedIng = ingredients.find((i) => i.id === ri.ingredientId);
                    return (
                        <div key={idx} className="flex gap-3 items-start">
                            <div className="flex-1">
                                <select
                                    value={ri.ingredientId}
                                    onChange={(e) => handleIngredientChange(idx, "ingredientId", e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                >
                                    <option value="">-- Pilih Bahan Baku --</option>
                                    {ingredients.map((ing) => (
                                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-32">
                                <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={ri.quantity}
                                    onChange={(e) => handleIngredientChange(idx, "quantity", Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    placeholder="Takaran"
                                />
                            </div>
                            <div className="w-16 flex items-center h-10 text-slate-500 text-sm">
                                {selectedIng ? selectedIng.unit : "-"}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveIngredient(idx)}
                                className="text-rose-500 hover:text-rose-700 p-2 mt-1 text-xl leading-none"
                            >
                                &times;
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg"
            >
                Batal
            </button>
            <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-yellow-600"
            >
                Simpan Resep
            </button>
        </div>
      </div>
    </div>
  );
};
