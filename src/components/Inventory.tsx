import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Search,
  Trash2,
  Package,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Edit2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CsvImportExport } from "./common/CsvImportExport";
import { RecipeModal } from "./RecipeModal";
import { Recipe } from "../types";

export const Inventory = () => {
  const {
    ingredients,
    stockMovements,
    stockOpnames,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStockMovement,
    addStockOpname,
    addStockOpnameItem,
    currentUser,
    isReadOnly,
    recipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  } = useStore();
  const [activeTab, setActiveTab] = useState<"ingredients" | "movements" | "opnames" | "recipes">("ingredients");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedIngredientForMove, setSelectedIngredientForMove] = useState<string>("");
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "WASTE" | "RETURN" | "TRANSFER" | "USAGE">("OUT");

  const filteredIngredients = ingredients.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredRecipes = recipes.filter(
    (r) => r.menuName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMovements = stockMovements
    .filter((m) => {
      const ingredient = ingredients.find((i) => i.id === m.ingredientId);
      if (!ingredient) return false;
      return ingredient.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // OPNAME STATE
  const [isOpnameMode, setIsOpnameMode] = useState(false);
  const [opnameId, setOpnameId] = useState("");
  const [opnameItems, setOpnameItems] = useState<{ ingredientId: string; physicalStock: number; difference: number; notes: string }[]>([]);

  const totalValuation = ingredients.reduce((sum, ing) => sum + (ing.currentStock * (ing.costPerUnit || 0)), 0);

  const handleAddIngredient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addIngredient({
      name: formData.get("name") as string,
      unit: formData.get("unit") as string,
      currentStock: Number(formData.get("currentStock")),
      minStock: Number(formData.get("minStock")),
      category: formData.get("category") as string,
      costPerUnit: Number(formData.get("costPerUnit")),
    });
    setIsAddIngredientOpen(false);
  };

  const handleImportIngredients = (data: any[]) => {
    let imported = 0;
    let updated = 0;
    data.forEach(row => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"];
      const code = row["Kode"] || row.code;
      const name = row["Nama Bahan"] || row.name;
      const unit = row["Satuan"] || row.unit;
      const currentStock = Number(row["Stok Saat Ini"]) || 0;
      const minStock = Number(row["Stok Minimum"]) || 0;
      const category = row["Kategori"] || row.category || "General";
      const costPerUnit = Number(row["Harga per Satuan"]) || 0;

      if (name && unit) {
        if (idSistem) {
          // Edit
          const existing = ingredients.find(i => i.id === idSistem);
          if (existing) {
            updateIngredient({
              ...existing,
              code: code || existing.code,
              name,
              unit,
              currentStock,
              minStock,
              category,
              costPerUnit
            });
            updated++;
          }
        } else {
          // Insert
          addIngredient({ code, name, unit, currentStock, minStock, category, costPerUnit });
          imported++;
        }
      }
    });
    if (imported > 0 || updated > 0) alert(`Berhasil menambahkan ${imported} data baru dan memperbarui ${updated} data.`);
    else alert("Tidak ada data valid yang diimport. Pastikan format kolom sesuai template.");
  };

  const handleAddMovement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    addStockMovement({
      ingredientId: formData.get("ingredientId") as string,
      type: movementType as any,
      quantity: Number(formData.get("quantity")),
      date: new Date().toISOString(),
      note: formData.get("note") as string,
      createdBy: currentUser?.name || "System",
      location: currentUser?.department || "MAIN",
    } as any);

    setIsAddMovementOpen(false);
  };

  const startOpname = () => {
    setOpnameId(crypto.randomUUID());
    setOpnameItems(
      ingredients.map((ing) => ({
        ingredientId: ing.id,
        physicalStock: ing.currentStock,
        difference: 0,
        notes: "",
      }))
    );
    setIsOpnameMode(true);
  };

  const handleOpnameChange = (ingredientId: string, physicalStock: number) => {
    setOpnameItems((prev) =>
      prev.map((item) => {
        if (item.ingredientId === ingredientId) {
          const ing = ingredients.find((i) => i.id === ingredientId);
          const systemStock = ing ? ing.currentStock : 0;
          return {
            ...item,
            physicalStock,
            difference: physicalStock - systemStock,
          };
        }
        return item;
      })
    );
  };

  const saveOpname = (status: "DRAFT" | "FINAL") => {
    const opname = {
      id: opnameId,
      date: new Date().toISOString(),
      status,
      notes: "Stock Opname Periodik",
      createdBy: currentUser?.name || "System",
      createdAt: new Date().toISOString(),
    };
    addStockOpname(opname);

    opnameItems.forEach((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      addStockOpnameItem({
        id: crypto.randomUUID(),
        opnameId: opname.id,
        ingredientId: item.ingredientId,
        systemStock: ing ? ing.currentStock : 0,
        physicalStock: item.physicalStock,
        difference: item.difference,
        notes: item.notes,
      });

      // Jika final, kita catat selisih
      if (status === "FINAL" && item.difference !== 0) {
        addStockMovement({
          ingredientId: item.ingredientId,
          type: item.difference > 0 ? ("IN" as any) : ("OUT" as any),
          quantity: Math.abs(item.difference),
          date: new Date().toISOString(),
          note: `Opname Diff (Sys: ${ing?.currentStock}, Phys: ${item.physicalStock})`,
          createdBy: currentUser?.name || "System",
        });
      }
    });

    setIsOpnameMode(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-lg w-full xl:w-auto">
          <button
            onClick={() => setActiveTab("ingredients")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "ingredients"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Daftar Bahan Baku
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "movements"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Pemakaian Harian
          </button>
          <button
            onClick={() => setActiveTab("opnames")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "opnames"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Opname Stok
          </button>
          <button
            onClick={() => setActiveTab("recipes")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "recipes"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Resep (BOM)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto xl:justify-end mt-2 sm:mt-0">
          <div className="relative w-full sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent w-full shadow-sm"
            />
          </div>

          {activeTab === "ingredients" ? (
            !isReadOnly && currentUser?.role !== "LEADER" ? (
              <>
                <CsvImportExport
                  onImport={handleImportIngredients}
                  templateHeaders={[
                    "Kode",
                    "Nama Bahan",
                    "Kategori",
                    "Stok Saat Ini",
                    "Satuan",
                    "Stok Minimum",
                    "Harga per Satuan",
                  ]}
                  templateExampleRow={[
                    "BB-001",
                    "Kopi Arabica",
                    "Biji Kopi",
                    "100",
                    "Kg",
                    "10",
                    "150000",
                  ]}
                  currentData={ingredients.map(i => ({
                    id: i.id,
                    "Kode": i.code || "",
                    "Nama Bahan": i.name,
                    "Kategori": i.category,
                    "Stok Saat Ini": i.currentStock,
                    "Satuan": i.unit,
                    "Stok Minimum": i.minStock,
                    "Harga per Satuan": i.costPerUnit || 0
                  }))}
                  templateFilename="Template_Import_Bahan_Baku.csv"
                  buttonLabel="Bahan Baku"
                  templateDropdowns={{
                    Kategori: Array.from(
                      new Set([
                        ...ingredients.map((i) => i.category).filter(Boolean),
                        "Biji Kopi", "Susu & Dairy", "Sirup & Saus", "Teh", "Bubuk",
                        "Makanan", "Kemasan", "Lainnya",
                      ])
                    ),
                    Satuan: Array.from(
                      new Set([
                        ...ingredients.map((i) => i.unit).filter(Boolean),
                        "Kg", "gram", "Liter", "ml", "pcs", "pack", "botol", "dus",
                      ])
                    ),
                  }}
                  templateColumnTypes={{
                    "Stok Saat Ini": "number",
                    "Stok Minimum": "number",
                    "Harga per Satuan": "number",
                  }}
                />
                <button
                  onClick={() => setIsAddIngredientOpen(true)}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 shadow-sm"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Tambah Bahan</span>
                </button>
              </>
            ) : null
          ) : activeTab === "movements" ? (
            !isReadOnly ? (
              <button
                onClick={() => {
                  if (ingredients.length === 0) {
                    alert("Tambahkan bahan baku terlebih dahulu");
                    return;
                  }
                  setSelectedIngredientForMove(ingredients[0].id);
                  setMovementType(currentUser?.role === "LEADER" ? "USAGE" : "OUT");
                  setIsAddMovementOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-yellow-600 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Catat Pemakaian
              </button>
            ) : null
          ) : activeTab === "opnames" ? (
             !isReadOnly && !isOpnameMode && currentUser?.role !== "LEADER" ? (
              <button
                onClick={startOpname}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Mulai Opname
              </button>
             ) : null
          ) : activeTab === "recipes" ? (
            !isReadOnly && currentUser?.role !== "LEADER" ? (
              <button
                onClick={() => {
                  setEditingRecipe(null);
                  setIsAddRecipeOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Resep
              </button>
            ) : null
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {activeTab === "ingredients" ? (
          <div>
            <div className="p-4 bg-slate-50 border-b border-slate-200 rounded-t-xl flex justify-between items-center">
                <h3 className="font-semibold text-slate-700">Total Nilai Persediaan (Valuation)</h3>
                <span className="text-xl font-black text-emerald-600">
                    Rp {totalValuation.toLocaleString("id-ID")}
                </span>
            </div>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                <AnimatePresence>
                  {filteredIngredients.map((item, index) => {
                    const isLow = item.currentStock <= item.minStock;

                    const categoryColors: Record<string, string> = {
                      "Biji Kopi": "bg-amber-100 text-amber-800 border-amber-200",
                      Susu: "bg-blue-100 text-blue-800 border-blue-200",
                      Sirup: "bg-pink-100 text-pink-800 border-pink-200",
                      Gelas: "bg-slate-100 text-slate-800 border-slate-200",
                    };

                    const catColor =
                      categoryColors[item.category] ||
                      "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        whileHover={{
                          y: -4,
                          boxShadow:
                            "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                        }}
                        className={`relative bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col justify-between overflow-hidden group ${isLow ? "border-rose-200" : "border-slate-200"}`}
                      >
                        {isLow && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                        )}

                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${catColor} mb-2`}
                            >
                              {item.category}
                            </span>
                            <h3 className="font-bold text-slate-800 text-lg leading-tight">
                              {item.name}
                            </h3>
                          </div>
                          {!isReadOnly && currentUser?.role !== "LEADER" && (
                            <button
                              onClick={() => {
                                if (
                                  confirm("Yakin ingin menghapus bahan baku ini?")
                                ) {
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
                            <p className="text-xs text-slate-500 mb-1 font-medium">
                              Sisa Stok
                            </p>
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`text-2xl font-black tracking-tight ${isLow ? "text-rose-600" : "text-slate-800"}`}
                              >
                                {item.currentStock}
                              </span>
                              <span className="text-sm text-slate-500 font-medium">
                                {item.unit}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">@ Rp {(item.costPerUnit || 0).toLocaleString('id-ID')}</p>
                          </div>

                          {isLow ? (
                            <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="text-xs font-bold">
                                Stok Menipis!
                              </span>
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
                    <p className="font-medium text-slate-500">
                      Tidak ada bahan baku ditemukan.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "movements" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                  <th className="p-4 font-semibold text-slate-600">Bahan Baku</th>
                  <th className="p-4 font-semibold text-slate-600">Jenis</th>
                  <th className="p-4 font-semibold text-slate-600">Lokasi</th>
                  <th className="p-4 font-semibold text-slate-600">Jumlah</th>
                  <th className="p-4 font-semibold text-slate-600">Catatan</th>
                  <th className="p-4 font-semibold text-slate-600">Operator</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((mov) => {
                  const ingredient = ingredients.find((i) => i.id === mov.ingredientId);
                  return (
                    <tr key={mov.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 text-slate-800">
                        {new Date(mov.date).toLocaleDateString("id-ID", {
                          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4 font-medium text-slate-800">{ingredient?.name || "Unknown"}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            mov.type === "IN" ? "bg-emerald-100 text-emerald-800"
                              : mov.type === "RETURN" ? "bg-blue-100 text-blue-800"
                              : mov.type === "WASTE" ? "bg-rose-100 text-rose-800"
                              : mov.type === "USAGE" ? "bg-indigo-100 text-indigo-800"
                              : mov.type === "TRANSFER" ? "bg-purple-100 text-purple-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {mov.type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">{(mov as any).location || "MAIN"}</td>
                      <td className={`p-4 font-medium ${mov.type === "IN" || mov.type === "RETURN" || mov.type === "TRANSFER" ? "text-emerald-600" : "text-rose-600"}`}>
                        {mov.type === "IN" || mov.type === "RETURN" ? "+" : "-"}{mov.quantity} {ingredient?.unit}
                      </td>
                      <td className="p-4 text-slate-600">{mov.note || "-"}</td>
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
        ) : activeTab === "opnames" ? (
          <div className="p-6">
            {isOpnameMode ? (
              <div className="space-y-6">
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                        <h3 className="font-bold text-slate-800">Sesi Opname Baru</h3>
                        <p className="text-sm text-slate-500">Sesuaikan stok fisik dengan stok sistem.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsOpnameMode(false)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Batal</button>
                        <button onClick={() => saveOpname("DRAFT")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Simpan Draft</button>
                        <button onClick={() => saveOpname("FINAL")} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Finalisasi
                        </button>
                    </div>
                 </div>

                 <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-3 font-semibold text-slate-600">Bahan Baku</th>
                                <th className="p-3 font-semibold text-slate-600 text-center">Stok Sistem</th>
                                <th className="p-3 font-semibold text-slate-600 text-center">Stok Fisik</th>
                                <th className="p-3 font-semibold text-slate-600 text-center">Selisih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {opnameItems.map((item) => {
                                const ing = ingredients.find(i => i.id === item.ingredientId);
                                if (!ing) return null;
                                return (
                                    <tr key={item.ingredientId} className="border-b border-slate-100">
                                        <td className="p-3 font-medium">{ing.name} <span className="text-xs text-slate-400">({ing.unit})</span></td>
                                        <td className="p-3 text-center text-slate-600">{ing.currentStock}</td>
                                        <td className="p-3 text-center">
                                            <input 
                                                type="number" 
                                                className="w-24 px-2 py-1 border border-slate-300 rounded text-center mx-auto"
                                                value={item.physicalStock}
                                                onChange={(e) => handleOpnameChange(ing.id, Number(e.target.value))}
                                                min="0"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-sm font-bold ${item.difference > 0 ? "bg-emerald-100 text-emerald-700" : item.difference < 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                                                {item.difference > 0 ? "+" : ""}{item.difference}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                 </div>
              </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                        <th className="p-4 font-semibold text-slate-600">Status</th>
                        <th className="p-4 font-semibold text-slate-600">Catatan</th>
                        <th className="p-4 font-semibold text-slate-600">Dibuat Oleh</th>
                        <th className="p-4 font-semibold text-slate-600">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stockOpnames.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((opname) => (
                            <tr key={opname.id} className="border-b border-slate-100">
                                <td className="p-4 text-slate-800">{new Date(opname.date).toLocaleDateString('id-ID')}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${opname.status === 'FINAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {opname.status}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-600">{opname.notes}</td>
                                <td className="p-4 text-slate-600">{opname.createdBy}</td>
                                <td className="p-4">
                                    <button className="text-primary hover:underline text-sm font-medium">Lihat Detail</button>
                                </td>
                            </tr>
                        ))}
                        {stockOpnames.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada riwayat Opname Stok.</td></tr>
                        )}
                    </tbody>
                    </table>
                </div>
            )}
          </div>
            ) : activeTab === "recipes" ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 font-semibold text-slate-600">Nama Menu</th>
                                <th className="p-4 font-semibold text-slate-600">Bahan & Takaran</th>
                                <th className="p-4 font-semibold text-slate-600">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecipes.map((recipe) => (
                                <tr key={recipe.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-4 text-slate-800 font-medium">{recipe.menuName}</td>
                                    <td className="p-4">
                                        <ul className="list-disc list-inside text-slate-600 text-sm">
                                            {recipe.ingredients.map((ri, idx) => {
                                                const ing = ingredients.find(i => i.id === ri.ingredientId);
                                                return (
                                                    <li key={idx}>
                                                        {ing ? ing.name : "Bahan tidak ditemukan"} - {ri.quantity} {ing ? ing.unit : ""}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {!isReadOnly && currentUser?.role !== "LEADER" && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditingRecipe(recipe);
                                                            setIsAddRecipeOpen(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Edit Resep"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if(confirm(`Hapus resep untuk ${recipe.menuName}?`)) {
                                                                deleteRecipe(recipe.id);
                                                            }
                                                        }}
                                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                                        title="Hapus Resep"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRecipes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-slate-500">
                                        Belum ada data resep.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : null}
      </div>

      <RecipeModal 
        isOpen={isAddRecipeOpen}
        onClose={() => setIsAddRecipeOpen(false)}
        editingRecipe={editingRecipe}
        ingredients={ingredients}
        onSave={(recipeData) => {
            if (editingRecipe) {
                updateRecipe(editingRecipe.id, recipeData);
            } else {
                addRecipe(recipeData);
            }
        }}
      />

      {isAddIngredientOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                Tambah Bahan Baku
              </h2>
              <button
                onClick={() => setIsAddIngredientOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddIngredient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nama Bahan
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Kopi Arabika Gayo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <input
                    type="text"
                    name="category"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Biji Kopi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Satuan (Unit)
                  </label>
                  <input
                    type="text"
                    name="unit"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Kg, Gr, Liter"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    name="currentStock"
                    required
                    min="0"
                    step="any"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Batas Minimum (Alert)
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    required
                    min="0"
                    step="any"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Harga per Satuan (Cost / Unit)
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">Rp</span>
                    <input
                        type="number"
                        name="costPerUnit"
                        required
                        min="0"
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg"
                        placeholder="0"
                    />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddIngredientOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isAddMovementOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Catat Pemakaian Harian</h2>
              <button
                onClick={() => setIsAddMovementOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddMovement} className="p-6 space-y-4">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg flex-wrap">
                {currentUser?.role !== "LEADER" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMovementType("OUT")}
                      className={`flex-1 min-w-[80px] py-2 text-sm font-medium rounded-md transition-colors ${
                        movementType === "OUT"
                          ? "bg-white text-orange-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Keluar
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType("WASTE")}
                      className={`flex-1 min-w-[80px] py-2 text-sm font-medium rounded-md transition-colors ${
                        movementType === "WASTE"
                          ? "bg-white text-rose-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Terbuang
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType("IN")}
                      className={`flex-1 min-w-[80px] py-2 text-sm font-medium rounded-md transition-colors ${
                        movementType === "IN"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Masuk/PO
                    </button>
                  </>
                )}
                {currentUser?.role === "LEADER" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMovementType("USAGE")}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                        movementType === "USAGE"
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Pemakaian {currentUser?.department ? `(${currentUser.department})` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType("TRANSFER")}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                        movementType === "TRANSFER"
                          ? "bg-white text-purple-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Minta/Mutasi
                    </button>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pilih Bahan Baku
                </label>
                <select
                  name="ingredientId"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  value={selectedIngredientForMove}
                  onChange={(e) => setSelectedIngredientForMove(e.target.value)}
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Stok: {ing.currentStock} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Jumlah
                </label>
                <input
                  type="number"
                  name="quantity"
                  required
                  min="0.01"
                  step="any"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Catatan
                </label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Opsional (misal: Tumpah, Kadaluarsa)"
                ></textarea>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMovementOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
