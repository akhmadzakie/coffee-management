import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import {
  Plus,
  Search,
  Trash2,
  Package,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Edit2,
  Coffee,
  Droplets,
  Sparkles,
  Flame,
  UtensilsCrossed,
  Cake,
  ShoppingBag,
  Layers,
  ArrowRight,
  Calculator,
  MapPin,
  Check,
  X,
  RefreshCw,
  Coins,
  Sliders,
  Info,
  Building2,
  ChevronRight,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CsvImportExport } from "./common/CsvImportExport";
import { RecipeModal } from "./RecipeModal";
import { Recipe, Ingredient, ViewState, StockOpname } from "../types";

interface InventoryProps {
  onNavigate?: (view: ViewState) => void;
}

export const PRESET_CATEGORIES = [
  { id: "ALL", name: "Semua Kategori", icon: Package },
  { id: "Biji Kopi", name: "Biji Kopi & Espresso", icon: Coffee },
  { id: "Susu & Dairy", name: "Susu & Plant-Based", icon: Droplets },
  { id: "Sirup & Saus", name: "Sirup & Saus", icon: Sparkles },
  { id: "Powder & Teh", name: "Powder & Teh", icon: Flame },
  { id: "Kitchen & Makanan", name: "Kitchen & Makanan", icon: UtensilsCrossed },
  { id: "Bakery & Pastry", name: "Bakery & Pastry", icon: Cake },
  { id: "Kemasan & Cup", name: "Kemasan & Cup", icon: ShoppingBag },
  { id: "Kebersihan & Operasional", name: "Kebersihan & Operasional", icon: Sparkles },
  { id: "Lainnya", name: "Lainnya", icon: Layers },
];

export const PRESET_LOCATIONS = [
  { id: "ALL", label: "Semua Lokasi Simpan" },
  { id: "BAR", label: "Bar Station (Meja Bar)" },
  { id: "CHILLER", label: "Chiller / Kulkas Pendingin" },
  { id: "DRY_STORAGE", label: "Gudang Kering (Dry Storage)" },
  { id: "KITCHEN", label: "Kitchen / Dapur Makanan" },
  { id: "BAKERY", label: "Bakery & Pastry Station" },
  { id: "OPERATIONAL", label: "Gudang Operasional & Kebersihan" },
];

export const PURCHASE_UNIT_PRESETS = [
  { unit: "Kg", base: "gr", defaultFactor: 1000, label: "Kilogram (1 Kg = 1.000 gram)" },
  { unit: "Liter", base: "ml", defaultFactor: 1000, label: "Liter (1 Liter = 1.000 ml)" },
  { unit: "Karton (12L)", base: "ml", defaultFactor: 12000, label: "Karton Susu (1 Karton = 12.000 ml / 12 Liter)" },
  { unit: "Dus Cup (500pcs)", base: "pcs", defaultFactor: 500, label: "Dus Cup (1 Dus = 500 pcs)" },
  { unit: "Pack Sedotan (100pcs)", base: "pcs", defaultFactor: 100, label: "Pack Sedotan (1 Pack = 100 pcs)" },
  { unit: "Botol Sirup (700ml)", base: "ml", defaultFactor: 700, label: "Botol Sirup (1 Botol = 700 ml)" },
  { unit: "Jerigen (5L)", base: "ml", defaultFactor: 5000, label: "Jerigen (1 Jerigen = 5.000 ml / 5 Liter)" },
  { unit: "Pouch Powder (1Kg)", base: "gr", defaultFactor: 1000, label: "Pouch Powder (1 Pouch = 1.000 gram)" },
  { unit: "Kustom / Lainnya", base: "pcs", defaultFactor: 1, label: "Satuan Lainnya (Kustom)" },
];

export const WASTE_REASONS = [
  "Kalibrasi Grinder Pagi (Dialing Espresso)",
  "Susu Tumpah / Overheat Steaming",
  "Basi / Melewati Masa Expired",
  "Salah Buat Pesanan (Barista Mistake)",
  "Kemasan Rusak / Bocor",
  "Bahan Menggumpal / Lembab",
];

export const Inventory: React.FC<InventoryProps> = ({ onNavigate }) => {
  const {
    ingredients,
    stockMovements,
    stockOpnames,
    stockOpnameItems,
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
  const [selectedDivision, setSelectedDivision] = useState<"ALL" | "BAR" | "KITCHEN" | "BAKERY" | "OPERATIONAL">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [selectedStockStatus, setSelectedStockStatus] = useState<"ALL" | "LOW_STOCK" | "SAFE">("ALL");

  // Modals state
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedIngredientForMove, setSelectedIngredientForMove] = useState<string>("");
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "WASTE" | "RETURN" | "TRANSFER" | "USAGE">("OUT");
  const [movementNote, setMovementNote] = useState<string>("");
  const [movementQuantity, setMovementQuantity] = useState<number>(0);

  // Form State for Add / Edit Ingredient
  const [ingredientForm, setIngredientForm] = useState({
    code: "",
    name: "",
    category: "Biji Kopi",
    storageLocation: "BAR",
    unit: "gr",
    usePurchaseUnit: true,
    purchaseUnit: "Kg",
    conversionFactor: 1000,
    purchasePrice: 220000,
    costPerUnit: 220,
    initialStockUnit: "BASE" as "BASE" | "PURCHASE",
    stockInput: 0,
    minStock: 500,
    notes: "",
  });

  // OPNAME STATE
  const [isOpnameMode, setIsOpnameMode] = useState(false);
  const [opnameId, setOpnameId] = useState("");
  const [opnameItems, setOpnameItems] = useState<{ ingredientId: string; physicalStock: number; difference: number; notes: string }[]>([]);
  const [opnameSearch, setOpnameSearch] = useState("");
  const [opnameDivisionFilter, setOpnameDivisionFilter] = useState<"ALL" | "BAR" | "KITCHEN" | "BAKERY" | "OPERATIONAL">("ALL");
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState("ALL");
  const [opnameInputMode, setOpnameInputMode] = useState<"BASE" | "PURCHASE">("PURCHASE");
  const [selectedOpnameForView, setSelectedOpnameForView] = useState<StockOpname | null>(null);

  // Open Modal for New Ingredient
  const handleOpenAddIngredient = () => {
    setEditingIngredient(null);
    setIngredientForm({
      code: `BB-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      category: "Biji Kopi",
      storageLocation: "BAR",
      unit: "gr",
      usePurchaseUnit: true,
      purchaseUnit: "Kg",
      conversionFactor: 1000,
      purchasePrice: 220000,
      costPerUnit: 220,
      initialStockUnit: "BASE",
      stockInput: 1000,
      minStock: 500,
      notes: "",
    });
    setIsIngredientModalOpen(true);
  };

  // Open Modal for Editing Ingredient
  const handleOpenEditIngredient = (ing: Ingredient) => {
    setEditingIngredient(ing);
    const hasPurchase = !!ing.purchaseUnit;
    const factor = ing.conversionFactor || 1000;
    const pPrice = ing.purchasePrice || (ing.costPerUnit * factor);

    setIngredientForm({
      code: ing.code || "",
      name: ing.name,
      category: ing.category,
      storageLocation: (ing.storageLocation as any) || "BAR",
      unit: ing.unit,
      usePurchaseUnit: hasPurchase,
      purchaseUnit: ing.purchaseUnit || "Kg",
      conversionFactor: factor,
      purchasePrice: pPrice,
      costPerUnit: ing.costPerUnit || 0,
      initialStockUnit: "BASE",
      stockInput: ing.currentStock,
      minStock: ing.minStock,
      notes: ing.notes || "",
    });
    setIsIngredientModalOpen(true);
  };

  // Auto calculate costPerUnit when purchasePrice or conversionFactor changes
  const computedCostPerUnit = useMemo(() => {
    if (!ingredientForm.usePurchaseUnit) {
      return Number(ingredientForm.costPerUnit) || 0;
    }
    if (ingredientForm.conversionFactor > 0 && ingredientForm.purchasePrice > 0) {
      return Math.round(ingredientForm.purchasePrice / ingredientForm.conversionFactor);
    }
    return 0;
  }, [ingredientForm.usePurchaseUnit, ingredientForm.purchasePrice, ingredientForm.conversionFactor, ingredientForm.costPerUnit]);

  // Handle Preset Purchase Unit Change
  const handlePurchasePresetSelect = (presetUnit: string) => {
    const found = PURCHASE_UNIT_PRESETS.find((p) => p.unit === presetUnit);
    if (found) {
      setIngredientForm((prev) => ({
        ...prev,
        purchaseUnit: found.unit,
        unit: found.base,
        conversionFactor: found.defaultFactor,
      }));
    }
  };

  // Submit Add / Edit Ingredient
  const handleSubmitIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientForm.name.trim()) {
      alert("Nama bahan baku tidak boleh kosong.");
      return;
    }

    const calculatedStock = ingredientForm.initialStockUnit === "PURCHASE" && ingredientForm.usePurchaseUnit
      ? Number(ingredientForm.stockInput) * Number(ingredientForm.conversionFactor)
      : Number(ingredientForm.stockInput);

    const payload: Omit<Ingredient, "id"> = {
      code: ingredientForm.code.trim() || undefined,
      name: ingredientForm.name.trim(),
      category: ingredientForm.category,
      unit: ingredientForm.unit.trim().toLowerCase(),
      currentStock: Math.max(0, calculatedStock),
      minStock: Math.max(0, Number(ingredientForm.minStock) || 0),
      costPerUnit: computedCostPerUnit,
      purchaseUnit: ingredientForm.usePurchaseUnit ? ingredientForm.purchaseUnit : undefined,
      conversionFactor: ingredientForm.usePurchaseUnit ? Number(ingredientForm.conversionFactor) : undefined,
      purchasePrice: ingredientForm.usePurchaseUnit ? Number(ingredientForm.purchasePrice) : undefined,
      storageLocation: ingredientForm.storageLocation,
      notes: ingredientForm.notes.trim() || undefined,
    };

    if (editingIngredient) {
      updateIngredient({
        ...editingIngredient,
        ...payload,
      });
    } else {
      addIngredient(payload);
    }

    setIsIngredientModalOpen(false);
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((i) => {
      const matchSearch =
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchDivision = true;
      if (selectedDivision === "BAR") {
        matchDivision =
          i.storageLocation === "BAR" ||
          i.storageLocation === "CHILLER" ||
          ["coffee", "dairy", "pemanis", "air & es", "kondimen", "sirup", "powder", "kemasan", "biji kopi", "susu"].some((c) =>
            i.category.toLowerCase().includes(c)
          );
      } else if (selectedDivision === "KITCHEN") {
        matchDivision =
          i.storageLocation === "KITCHEN" ||
          ["kitchen", "makanan", "bumbu", "daging", "beras", "ayam", "sambal"].some((c) =>
            i.category.toLowerCase().includes(c)
          );
      } else if (selectedDivision === "BAKERY") {
        matchDivision =
          i.storageLocation === "BAKERY" ||
          ["bakery", "pastry", "roti", "dough", "butter", "tepung", "croissant"].some((c) =>
            i.category.toLowerCase().includes(c)
          );
      } else if (selectedDivision === "OPERATIONAL") {
        matchDivision =
          i.storageLocation === "OPERATIONAL" ||
          ["kebersihan", "operasional", "supplies", "sabun", "plastik"].some((c) =>
            i.category.toLowerCase().includes(c)
          );
      }

      const matchCategory =
        selectedCategory === "ALL" ||
        i.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        (selectedCategory === "Kemasan & Cup" && (i.category.includes("Kemasan") || i.category.includes("Gelas") || i.category.includes("Cup")));

      const matchLocation =
        selectedLocation === "ALL" ||
        (i.storageLocation || "BAR") === selectedLocation;

      const isLow = i.currentStock <= i.minStock;
      const matchStatus =
        selectedStockStatus === "ALL" ||
        (selectedStockStatus === "LOW_STOCK" && isLow) ||
        (selectedStockStatus === "SAFE" && !isLow);

      return matchSearch && matchDivision && matchCategory && matchLocation && matchStatus;
    });
  }, [ingredients, searchTerm, selectedDivision, selectedCategory, selectedLocation, selectedStockStatus]);

  // Overall statistics
  const totalValuation = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + (ing.currentStock * (ing.costPerUnit || 0)), 0);
  }, [ingredients]);

  const lowStockCount = useMemo(() => {
    return ingredients.filter((i) => i.currentStock <= i.minStock).length;
  }, [ingredients]);

  const outOfStockCount = useMemo(() => {
    return ingredients.filter((i) => i.currentStock <= 0).length;
  }, [ingredients]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => r.menuName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [recipes, searchTerm]);

  const filteredMovements = useMemo(() => {
    return stockMovements
      .filter((m) => {
        const ingredient = ingredients.find((i) => i.id === m.ingredientId);
        if (!ingredient) return false;
        return ingredient.name.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stockMovements, ingredients, searchTerm]);

  // Import CSV / Excel
  const handleImportIngredients = (data: any[]) => {
    let imported = 0;
    let updated = 0;

    data.forEach((row) => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"] || row.id;
      const code = row["Kode Bahan"] || row["Kode"] || row.code;
      const name = row["Nama Bahan"] || row.name;
      const category = row["Kategori"] || row.category || "Lainnya";
      const storageLocation = row["Lokasi Simpan"] || row.storageLocation || "BAR";
      const unit = (row["Satuan Resep (Terkecil)"] || row["Satuan"] || row.unit || "gr").toString().trim().toLowerCase();
      const currentStock = Number(row["Stok Fisik Saat Ini"] ?? row["Stok Saat Ini"] ?? row.currentStock) || 0;
      const minStock = Number(row["Batas Minimum (Alert)"] ?? row["Stok Minimum"] ?? row.minStock) || 0;

      const purchaseUnit = row["Satuan Beli Supplier"] || row.purchaseUnit || undefined;
      const conversionFactor = Number(row["Isi per Kemasan Beli"] || row.conversionFactor) || (purchaseUnit ? 1000 : undefined);
      const purchasePrice = Number(row["Harga Beli per Kemasan"] || row.purchasePrice) || undefined;

      let costPerUnit = Number(row["Harga per Satuan Resep (HPP)"] ?? row["Harga per Satuan"] ?? row.costPerUnit) || 0;
      if (!costPerUnit && purchasePrice && conversionFactor && conversionFactor > 0) {
        costPerUnit = Math.round(purchasePrice / conversionFactor);
      }

      const notes = row["Catatan Tambahan"] || row["Catatan"] || row.notes || undefined;

      if (name && unit) {
        const payload: Omit<Ingredient, "id"> = {
          code: code ? String(code).trim() : undefined,
          name: String(name).trim(),
          category: String(category).trim(),
          storageLocation: String(storageLocation).trim(),
          unit,
          currentStock: Math.max(0, currentStock),
          minStock: Math.max(0, minStock),
          costPerUnit: Math.max(0, costPerUnit),
          purchaseUnit: purchaseUnit ? String(purchaseUnit).trim() : undefined,
          conversionFactor: conversionFactor && conversionFactor > 0 ? conversionFactor : undefined,
          purchasePrice: purchasePrice && purchasePrice > 0 ? purchasePrice : undefined,
          notes: notes ? String(notes).trim() : undefined,
        };

        if (idSistem) {
          const existing = ingredients.find((i) => i.id === idSistem);
          if (existing) {
            updateIngredient({
              ...existing,
              ...payload,
            });
            updated++;
          } else {
            addIngredient(payload);
            imported++;
          }
        } else {
          addIngredient(payload);
          imported++;
        }
      }
    });

    if (imported > 0 || updated > 0) {
      alert(`Berhasil menambahkan ${imported} data bahan baru dan memperbarui ${updated} data.`);
    } else {
      alert("Tidak ada data valid yang diimpor. Pastikan file Excel/CSV berisi kolom 'Nama Bahan' dan 'Satuan Resep'.");
    }
  };

  // Handle Add Movement
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientForMove || movementQuantity <= 0) {
      alert("Pilih bahan baku dan masukkan jumlah yang valid.");
      return;
    }

    const ing = ingredients.find((i) => i.id === selectedIngredientForMove);
    const cost = (ing?.costPerUnit || 0) * movementQuantity;

    addStockMovement({
      ingredientId: selectedIngredientForMove,
      type: movementType,
      quantity: movementQuantity,
      date: new Date().toISOString(),
      note: movementNote.trim() || (movementType === "WASTE" ? "Bahan Rusak / Terbuang" : "Mutasi Operasional"),
      unitCost: ing?.costPerUnit || 0,
      totalCost: cost,
      createdBy: currentUser?.name || "System",
      location: (ing?.storageLocation as any) || currentUser?.department || "MAIN",
    } as any);

    // Auto update currentStock
    if (ing) {
      let newStock = ing.currentStock;
      if (movementType === "IN" || movementType === "RETURN") {
        newStock += movementQuantity;
      } else {
        newStock = Math.max(0, newStock - movementQuantity);
      }
      updateIngredient({
        ...ing,
        currentStock: newStock,
      });
    }

    setIsAddMovementOpen(false);
    setMovementQuantity(0);
    setMovementNote("");
  };

  // Stock Opname
  const startOpname = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "op_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    setOpnameId(newId);
    setOpnameItems(
      ingredients.map((ing) => ({
        ingredientId: ing.id,
        physicalStock: ing.currentStock,
        difference: 0,
        notes: "",
      }))
    );
    setOpnameSearch("");
    setOpnameCategoryFilter("ALL");
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

  const handleOpnameNoteChange = (ingredientId: string, notes: string) => {
    setOpnameItems((prev) =>
      prev.map((item) =>
        item.ingredientId === ingredientId ? { ...item, notes } : item
      )
    );
  };

  const saveOpname = (status: "DRAFT" | "FINAL") => {
    const opname: StockOpname = {
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
      const itemId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "opi_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      addStockOpnameItem({
        id: itemId,
        opnameId: opname.id,
        ingredientId: item.ingredientId,
        systemStock: ing ? ing.currentStock : 0,
        physicalStock: item.physicalStock,
        difference: item.difference,
        notes: item.notes || null,
      });

      if (status === "FINAL" && item.difference !== 0) {
        addStockMovement({
          ingredientId: item.ingredientId,
          type: item.difference > 0 ? ("IN" as any) : ("OUT" as any),
          quantity: Math.abs(item.difference),
          date: new Date().toISOString(),
          note: `Koreksi Hasil Opname (Sistem: ${ing?.currentStock}, Fisik: ${item.physicalStock})${item.notes ? ` - ${item.notes}` : ""}`,
          createdBy: currentUser?.name || "System",
        });

        if (ing) {
          updateIngredient({
            ...ing,
            currentStock: item.physicalStock,
          });
        }
      }
    });

    setIsOpnameMode(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP EXECUTIVE KPI STATS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Valuasi Aset */}
        <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Total Valuasi Aset
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-stone-900 tracking-tight font-mono">
              {formatCurrency(totalValuation)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              Dari <strong>{ingredients.length}</strong> bahan baku terdaftar
            </p>
          </div>
        </div>

        {/* Bahan Menipis / Perlu Reorder */}
        <div className={`p-5 rounded-3xl bg-white border shadow-coffee flex flex-col justify-between ${
          lowStockCount > 0 ? "border-amber-300 bg-amber-50/20" : "border-stone-200/80"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Perlu Reorder
            </span>
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border ${
              lowStockCount > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-stone-100 text-stone-600 border-stone-200"
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-black tracking-tight font-mono ${
                lowStockCount > 0 ? "text-amber-800" : "text-stone-900"
              }`}>
                {lowStockCount}
              </p>
              <span className="text-xs text-stone-500">bahan baku</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {lowStockCount > 0 ? "Stok di bawah batas minimum aman" : "Semua bahan di atas batas aman"}
            </p>
          </div>
        </div>

        {/* Bahan Habis / Kritis */}
        <div className={`p-5 rounded-3xl bg-white border shadow-coffee flex flex-col justify-between ${
          outOfStockCount > 0 ? "border-rose-300 bg-rose-50/20" : "border-stone-200/80"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Stok Habis (0)
            </span>
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border ${
              outOfStockCount > 0 ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-stone-100 text-stone-600 border-stone-200"
            }`}>
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-black tracking-tight font-mono ${
                outOfStockCount > 0 ? "text-rose-700" : "text-stone-900"
              }`}>
                {outOfStockCount}
              </p>
              <span className="text-xs text-stone-500">bahan kosong</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {outOfStockCount > 0 ? "Mengunci menu terkait di POS" : "Tidak ada bahan yang habis total"}
            </p>
          </div>
        </div>

        {/* Hubungan ke HPP & Resep */}
        <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Integrasi HPP
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-stone-900 tracking-tight font-mono">
                {recipes.length}
              </p>
              <span className="text-xs text-stone-500">resep terdaftar</span>
            </div>
            {onNavigate ? (
              <button
                onClick={() => onNavigate("hpp_calculator")}
                className="mt-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                Buka Kalkulator HPP <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <p className="text-[11px] text-stone-500 mt-1">Tersinkron dengan menu POS</p>
            )}
          </div>
        </div>
      </div>

      {/* ── NAVIGATION & TOOLBAR ─────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-3xl border border-stone-200/80 shadow-coffee-sm">
        {/* Tab Switcher */}
        <div className="flex p-1 bg-stone-100 rounded-2xl w-full xl:w-auto">
          <button
            onClick={() => setActiveTab("ingredients")}
            className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "ingredients"
                ? "bg-white text-stone-900 shadow-coffee-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Daftar Bahan Baku ({ingredients.length})
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "movements"
                ? "bg-white text-stone-900 shadow-coffee-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Mutasi & Pemakaian
          </button>
          <button
            onClick={() => setActiveTab("opnames")}
            className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "opnames"
                ? "bg-white text-stone-900 shadow-coffee-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Stok Opname
          </button>
          <button
            onClick={() => setActiveTab("recipes")}
            className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "recipes"
                ? "bg-white text-stone-900 shadow-coffee-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Resep Baku ({recipes.length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end">
          {activeTab === "ingredients" && !isReadOnly && currentUser?.role !== "LEADER" && (
            <>
              <CsvImportExport
                onImport={handleImportIngredients}
                templateFilename="Template_Master_Bahan_Baku.xlsx"
                buttonLabel="Impor/Ekspor"
                templateHeaders={[
                  "Kode Bahan",
                  "Nama Bahan",
                  "Kategori",
                  "Lokasi Simpan",
                  "Satuan Resep (Terkecil)",
                  "Stok Fisik Saat Ini",
                  "Batas Minimum (Alert)",
                  "Satuan Beli Supplier",
                  "Isi per Kemasan Beli",
                  "Harga Beli per Kemasan",
                  "Harga per Satuan Resep (HPP)",
                  "Catatan Tambahan",
                ]}
                templateExampleRow={[
                  "BB-001",
                  "Kopi Arabika Gayo House Blend",
                  "Biji Kopi",
                  "BAR",
                  "gr",
                  "5000",
                  "1000",
                  "Kg",
                  "1000",
                  "220000",
                  "220",
                  "Supplier: Toko Kopi Mandiri (Kemasan 1 Kg = 1000 gr)",
                ]}
                templateInstructions={[
                  "1. 'Satuan Resep (Terkecil)' adalah takaran cangkir/porsi: gr, ml, atau pcs.",
                  "2. 'Satuan Beli Supplier' adalah kemasan saat Anda belanja: Kg, Liter, Karton, Dus, Botol.",
                  "3. 'Isi per Kemasan Beli' adalah rasio isi: 1 Kg = 1000 gr, 1 Karton Susu = 12000 ml, 1 Dus Cup = 500 pcs.",
                  "4. 'Harga per Satuan Resep (HPP)' adalah modal per gr/ml/pcs. Jika kosong, sistem otomatis menghitung: Harga Beli Kemasan ÷ Isi Kemasan.",
                  "5. 'Lokasi Simpan' pilih antara: BAR, CHILLER, DRY_STORAGE, KITCHEN, atau BAKERY.",
                ]}
                templateDropdowns={{
                  Kategori: PRESET_CATEGORIES.filter((c) => c.id !== "ALL").map((c) => c.id),
                  "Lokasi Simpan": ["BAR", "CHILLER", "DRY_STORAGE", "KITCHEN", "BAKERY"],
                  "Satuan Resep (Terkecil)": ["gr", "ml", "pcs", "portion"],
                  "Satuan Beli Supplier": [
                    "Kg",
                    "Liter",
                    "Karton (12L)",
                    "Dus Cup (500pcs)",
                    "Pack Sedotan (100pcs)",
                    "Botol Sirup (700ml)",
                    "Jerigen (5L)",
                    "Pouch Powder (1Kg)",
                    "Pcs / Ecer",
                  ],
                }}
                templateColumnTypes={{
                  "Stok Fisik Saat Ini": "number",
                  "Batas Minimum (Alert)": "number",
                  "Isi per Kemasan Beli": "number",
                  "Harga Beli per Kemasan": "number",
                  "Harga per Satuan Resep (HPP)": "number",
                }}
                templateHints={{
                  "Kode Bahan": "Kode SKU atau barcode unik (opsional, contoh: BB-001)",
                  "Nama Bahan": "Nama lengkap bahan baku",
                  "Kategori": "Pilih dari dropdown kategori",
                  "Lokasi Simpan": "Pilih BAR, CHILLER, DRY_STORAGE, KITCHEN, atau BAKERY",
                  "Satuan Resep (Terkecil)": "gr (gram), ml (mililiter), pcs (gelas/sedotan), portion (porsi)",
                  "Stok Fisik Saat Ini": "Saldo fisik bahan dalam satuan resep (contoh: 5000 gr, bukan 5 kg)",
                  "Batas Minimum (Alert)": "Batas peringatan stok menipis (contoh: 1000 gr)",
                  "Satuan Beli Supplier": "Kemasan pengadaan dari supplier (Kg, Liter, Dus, Karton, Botol)",
                  "Isi per Kemasan Beli": "Jumlah isi per kemasan dalam satuan resep (contoh: 1000 untuk 1 Kg -> 1000 gr)",
                  "Harga Beli per Kemasan": "Harga beli per 1 kemasan supplier (contoh: 220000)",
                  "Harga per Satuan Resep (HPP)": "Harga modal per gr/ml/pcs untuk integrasi HPP (contoh: 220)",
                  "Catatan Tambahan": "Nama supplier langganan, merek dagang, atau masa simpan",
                }}
                currentData={ingredients.map((i) => ({
                  id: i.id,
                  "Kode Bahan": i.code || "",
                  "Nama Bahan": i.name,
                  "Kategori": i.category,
                  "Lokasi Simpan": (i.storageLocation as any) || "BAR",
                  "Satuan Resep (Terkecil)": i.unit,
                  "Stok Fisik Saat Ini": i.currentStock,
                  "Batas Minimum (Alert)": i.minStock,
                  "Satuan Beli Supplier": i.purchaseUnit || "",
                  "Isi per Kemasan Beli": i.conversionFactor || "",
                  "Harga Beli per Kemasan": i.purchasePrice || (i.purchaseUnit && i.conversionFactor ? (i.costPerUnit * i.conversionFactor) : ""),
                  "Harga per Satuan Resep (HPP)": i.costPerUnit || 0,
                  "Catatan Tambahan": i.notes || "",
                }))}
              />
              <button
                onClick={handleOpenAddIngredient}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-2xl text-xs font-bold transition-all shadow-coffee-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Bahan Baku</span>
              </button>
            </>
          )}

          {activeTab === "movements" && !isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (ingredients.length === 0) return alert("Tambahkan bahan baku terlebih dahulu.");
                  setSelectedIngredientForMove(ingredients[0].id);
                  setMovementType("WASTE");
                  setMovementNote("Kalibrasi Grinder Pagi");
                  setIsAddMovementOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Catat Bahan Rusak / Waste</span>
              </button>

              <button
                onClick={() => {
                  if (ingredients.length === 0) return alert("Tambahkan bahan baku terlebih dahulu.");
                  setSelectedIngredientForMove(ingredients[0].id);
                  setMovementType(currentUser?.role === "LEADER" ? "USAGE" : "OUT");
                  setMovementNote("");
                  setIsAddMovementOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-coffee-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Pemakaian Harian</span>
              </button>
            </div>
          )}

          {activeTab === "opnames" && !isReadOnly && !isOpnameMode && (
            <button
              onClick={startOpname}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-2xl text-xs font-bold transition-all shadow-coffee-sm cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Mulai Sesi Opname Fisik</span>
            </button>
          )}

          {activeTab === "recipes" && !isReadOnly && currentUser?.role !== "LEADER" && (
            <button
              onClick={() => {
                setEditingRecipe(null);
                setIsAddRecipeOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-2xl text-xs font-bold transition-all shadow-coffee-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Resep Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* ── TAB 1: INGREDIENTS CATALOG ───────────────────────────────────── */}
      {activeTab === "ingredients" && (
        <div className="space-y-4">
          {/* Filter Bar: Search, Category Pills, Location, Status */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 shadow-coffee-sm space-y-4">
            {/* Division Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-stone-100 scrollbar-none">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">
                Divisi:
              </span>
              {[
                { id: "ALL", label: "Semua Divisi", icon: Package },
                { id: "BAR", label: "Divisi Bar", icon: Coffee },
                { id: "KITCHEN", label: "Divisi Kitchen", icon: UtensilsCrossed },
                { id: "BAKERY", label: "Divisi Bakery & Pastry", icon: Cake },
                { id: "OPERATIONAL", label: "Kebersihan & Operasional", icon: Sparkles },
              ].map((div) => {
                const Icon = div.icon;
                const isSelected = selectedDivision === div.id;
                return (
                  <button
                    key={div.id}
                    onClick={() => setSelectedDivision(div.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-amber-800 text-white shadow-coffee-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{div.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 1: Search & Dropdowns */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari nama bahan, kode SKU, atau kategori..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800"
                />
              </div>

              {/* Filter Lokasi Simpan */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-3 py-2.5 rounded-2xl border border-stone-200 text-xs bg-white text-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                >
                  {PRESET_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Status Stok */}
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-2xl text-xs font-semibold w-full sm:w-auto">
                <button
                  onClick={() => setSelectedStockStatus("ALL")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedStockStatus === "ALL" ? "bg-white text-stone-900 shadow-coffee-sm" : "text-stone-500"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setSelectedStockStatus("LOW_STOCK")}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                    selectedStockStatus === "LOW_STOCK" ? "bg-white text-amber-800 shadow-coffee-sm" : "text-stone-500"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Kritis / Menipis ({lowStockCount})</span>
                </button>
                <button
                  onClick={() => setSelectedStockStatus("SAFE")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedStockStatus === "SAFE" ? "bg-white text-emerald-800 shadow-coffee-sm" : "text-stone-500"
                  }`}
                >
                  Aman
                </button>
              </div>
            </div>

            {/* Row 2: Category Horizontal Scrolling Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESET_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.id;
                const count = cat.id === "ALL"
                  ? ingredients.length
                  : ingredients.filter((i) => i.category.toLowerCase().includes(cat.id.toLowerCase())).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? "bg-stone-900 text-white border-stone-900 shadow-coffee-sm"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isSelected ? "text-amber-400" : "text-stone-500"}`} />
                    <span>{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? "bg-stone-800 text-amber-300" : "bg-stone-200 text-stone-600"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filteredIngredients.map((item, index) => {
                const isOutOfStock = item.currentStock <= 0;
                const isLow = item.currentStock <= item.minStock && !isOutOfStock;
                const hasPurchaseConversion = !!item.purchaseUnit && !!item.conversionFactor;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    className={`relative bg-white rounded-3xl p-5 border shadow-coffee transition-all flex flex-col justify-between overflow-hidden group ${
                      isOutOfStock
                        ? "border-rose-300 ring-1 ring-rose-300"
                        : isLow
                        ? "border-amber-300 ring-1 ring-amber-300"
                        : "border-stone-200/80 hover:border-amber-700/40"
                    }`}
                  >
                    {/* Top Alert Bar */}
                    {isOutOfStock && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />}
                    {isLow && <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />}

                    <div>
                      {/* Category & Action Buttons */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100/70 text-amber-900 border border-amber-200/60">
                            {item.category}
                          </span>
                          {item.storageLocation && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold text-stone-500 bg-stone-100 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {item.storageLocation}
                            </span>
                          )}
                        </div>

                        {!isReadOnly && currentUser?.role !== "LEADER" && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEditIngredient(item)}
                              className="p-1.5 text-stone-400 hover:text-amber-800 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                              title="Edit Bahan Baku"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Hapus bahan baku "${item.name}"? Pastikan bahan tidak sedang dipakai di resep aktif.`)) {
                                  deleteIngredient(item.id);
                                }
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Hapus Bahan Baku"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Name & SKU */}
                      <div>
                        {item.code && (
                          <span className="text-[10px] font-mono font-bold text-stone-400">
                            {item.code}
                          </span>
                        )}
                        <h3 className="font-bold text-stone-900 text-base leading-tight mt-0.5">
                          {item.name}
                        </h3>
                      </div>

                      {/* Kemasan Pembelian Badge jika ada */}
                      {hasPurchaseConversion && (
                        <div className="mt-2.5 p-2 rounded-xl bg-stone-50 border border-stone-200/60 text-[11px] text-stone-600">
                          <span className="font-semibold text-stone-800">Kemasan Beli:</span>{" "}
                          1 {item.purchaseUnit} = {item.conversionFactor?.toLocaleString("id-ID")} {item.unit}
                          {item.purchasePrice ? ` (@ ${formatCurrency(item.purchasePrice)})` : ""}
                        </div>
                      )}
                    </div>

                    {/* Bottom Stock & Valuation */}
                    <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[11px] text-stone-500 font-medium">Sisa Stok Fisik</p>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span
                              className={`text-2xl font-black font-mono tracking-tight ${
                                isOutOfStock ? "text-rose-600" : isLow ? "text-amber-700" : "text-stone-900"
                              }`}
                            >
                              {item.currentStock.toLocaleString("id-ID")}
                            </span>
                            <span className="text-xs text-stone-500 font-semibold">{item.unit}</span>
                          </div>
                          {hasPurchaseConversion && item.conversionFactor && item.conversionFactor > 1 && (
                            <div className="text-[11px] font-bold text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-md mt-1 border border-amber-200/50 inline-block">
                              ≈ {(item.currentStock / item.conversionFactor).toLocaleString("id-ID", { maximumFractionDigits: 1 })} {item.purchaseUnit}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-stone-400">Harga Modal Resep</p>
                          <p className="text-xs font-mono font-bold text-stone-700 mt-0.5">
                            {formatCurrency(item.costPerUnit || 0)} <span className="text-[10px] font-normal text-stone-400">/{item.unit}</span>
                          </p>
                          <p className="text-[10px] font-mono text-emerald-700 font-medium">
                            Aset: {formatCurrency(item.currentStock * (item.costPerUnit || 0))}
                          </p>
                        </div>
                      </div>

                      {/* Status & Quick Reorder Button */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {isOutOfStock ? (
                          <div className="flex items-center gap-1 text-rose-700 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Stok Habis!</span>
                          </div>
                        ) : isLow ? (
                          <div className="flex items-center gap-1 text-amber-800 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Menipis (Min: {item.minStock} {item.unit})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Stok Aman</span>
                          </div>
                        )}

                        {(isLow || isOutOfStock) && onNavigate && (
                          <button
                            onClick={() => onNavigate("purchases")}
                            className="px-2.5 py-1 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-coffee-sm"
                            title="Buka Pembelian untuk order bahan ini"
                          >
                            <span>+ Order PO</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredIngredients.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-stone-200">
                <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-stone-700">Tidak ada bahan baku yang cocok</h4>
                <p className="text-xs text-stone-400 mt-1">
                  Coba ubah kata kunci pencarian, kategori, atau filter status stok.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: STOCK MOVEMENTS & USAGE ──────────────────────────────── */}
      {activeTab === "movements" && (
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-coffee overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Riwayat Mutasi & Pemakaian Bahan</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Audit otomatis setiap bahan yang keluar untuk order kasir, terbuang (waste), atau masuk dari PO.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200/80 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Waktu</th>
                  <th className="p-4">Bahan Baku</th>
                  <th className="p-4">Jenis Mutasi</th>
                  <th className="p-4">Lokasi</th>
                  <th className="p-4 text-right">Jumlah</th>
                  <th className="p-4 text-right">Nilai Rupiah</th>
                  <th className="p-4">Catatan / Alasan</th>
                  <th className="p-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredMovements.map((mov) => {
                  const ingredient = ingredients.find((i) => i.id === mov.ingredientId);
                  const isPositive = mov.type === "IN" || mov.type === "RETURN";
                  const isWaste = mov.type === "WASTE";

                  return (
                    <tr key={mov.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="p-4 text-stone-500 whitespace-nowrap">
                        {new Date(mov.date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4 font-bold text-stone-900">
                        {ingredient?.name || "Bahan Terhapus"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            mov.type === "IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : mov.type === "USAGE"
                              ? "bg-blue-100 text-blue-800"
                              : mov.type === "WASTE"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {mov.type === "USAGE" ? "Kasir (Order)" : mov.type === "WASTE" ? "Terbuang / Rusak" : mov.type}
                        </span>
                      </td>
                      <td className="p-4 text-stone-600">{(mov as any).location || "BAR"}</td>
                      <td className={`p-4 font-mono font-bold text-right ${isPositive ? "text-emerald-700" : isWaste ? "text-rose-600" : "text-stone-800"}`}>
                        {isPositive ? "+" : "-"}{mov.quantity.toLocaleString("id-ID")} {ingredient?.unit}
                      </td>
                      <td className="p-4 font-mono text-stone-600 text-right">
                        {mov.totalCost ? formatCurrency(mov.totalCost) : "-"}
                      </td>
                      <td className="p-4 text-stone-600 max-w-xs truncate">{mov.note || "-"}</td>
                      <td className="p-4 text-stone-500">{mov.createdBy}</td>
                    </tr>
                  );
                })}

                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400">
                      Belum ada catatan mutasi pergerakan stok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: STOCK OPNAME ─────────────────────────────────────────── */}
      {activeTab === "opnames" && (
        <div className="space-y-6">
          {isOpnameMode ? (
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-coffee p-6 space-y-6">
              {/* Header Sesi Aktif */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50/80 p-4 rounded-2xl border border-amber-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
                    </span>
                    <h3 className="font-bold text-amber-900 text-sm">Sesi Stok Opname Fisik Sedang Berlangsung</h3>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    Auditor: <strong className="font-semibold">{currentUser?.name || "Staff"}</strong> ({currentUser?.role || "LEADER"}) • Masukkan jumlah fisik nyata hasil hitungan di bar / gudang.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-stone-700 text-[11px] font-bold border border-amber-200">
                      Total: {opnameItems.length} Bahan
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                      Sesuai: {opnameItems.filter((i) => i.difference === 0).length}
                    </span>
                    {opnameItems.filter((i) => i.difference !== 0).length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200">
                        Selisih: {opnameItems.filter((i) => i.difference !== 0).length} Bahan
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (confirm("Batalkan sesi opname ini? Angka yang belum disimpan akan hilang.")) {
                        setIsOpnameMode(false);
                      }
                    }}
                    className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-xs font-bold hover:bg-stone-50 cursor-pointer transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => saveOpname("DRAFT")}
                    className="px-4 py-2 bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-200 cursor-pointer transition-all"
                  >
                    Simpan Draft
                  </button>
                  <button
                    onClick={() => {
                      const diffCount = opnameItems.filter((i) => i.difference !== 0).length;
                      const msg =
                        diffCount > 0
                          ? `Terdapat ${diffCount} bahan dengan selisih stok. Sistem akan otomatis memperbarui stok riil dan mencatat mutasi koreksi. Lanjutkan finalisasi?`
                          : "Semua stok fisik sesuai dengan sistem kasir. Lanjutkan finalisasi?";
                      if (confirm(msg)) {
                        saveOpname("FINAL");
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-coffee-sm transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Finalisasi & Sesuaikan Stok</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="space-y-3">
                {/* Division Filter for Opname */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider shrink-0 mr-1">
                    Filter Divisi Opname:
                  </span>
                  {[
                    { id: "ALL", label: "Semua Divisi", icon: Package },
                    { id: "BAR", label: "Divisi Bar", icon: Coffee },
                    { id: "KITCHEN", label: "Divisi Kitchen", icon: UtensilsCrossed },
                    { id: "BAKERY", label: "Divisi Bakery & Pastry", icon: Cake },
                    { id: "OPERATIONAL", label: "Operasional & Kebersihan", icon: Sparkles },
                  ].map((div) => {
                    const Icon = div.icon;
                    const isSelected = opnameDivisionFilter === div.id;
                    return (
                      <button
                        key={div.id}
                        onClick={() => setOpnameDivisionFilter(div.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? "bg-amber-800 text-white shadow-coffee-sm"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{div.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari bahan baku opname..."
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-800 focus:bg-white transition-all"
                      value={opnameSearch}
                      onChange={(e) => setOpnameSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    <button
                      onClick={() => setOpnameCategoryFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        opnameCategoryFilter === "ALL"
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      Semua Kategori
                    </button>
                    {Array.from(new Set(ingredients.map((i) => i.category))).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setOpnameCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          opnameCategoryFilter === cat
                            ? "bg-stone-900 text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table Opname Items */}
              <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px]">
                      <th className="p-3">Bahan Baku</th>
                      <th className="p-3">Kategori & Lokasi</th>
                      <th className="p-3 text-center">Stok Sistem</th>
                      <th className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>Stok Fisik Nyata</span>
                          <button
                            type="button"
                            onClick={() => setOpnameInputMode((prev) => (prev === "PURCHASE" ? "BASE" : "PURCHASE"))}
                            className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-all cursor-pointer whitespace-nowrap"
                            title="Klik untuk beralih antara hitung per Kemasan (Kotak/Kg/Dus) atau Satuan Resep (gr/ml)"
                          >
                            Mode: {opnameInputMode === "PURCHASE" ? "📦 Kemasan (Kotak/Kg)" : "⚖️ Satuan (gr/ml)"} ⇄
                          </button>
                        </div>
                      </th>
                      <th className="p-3 text-center">Selisih</th>
                      <th className="p-3">Keterangan / Alasan Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {opnameItems
                      .filter((item) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        if (!ing) return false;
                        const matchSearch =
                          ing.name.toLowerCase().includes(opnameSearch.toLowerCase()) ||
                          (ing.code && ing.code.toLowerCase().includes(opnameSearch.toLowerCase()));
                        const matchCategory =
                          opnameCategoryFilter === "ALL" || ing.category === opnameCategoryFilter;

                        let matchDivision = true;
                        if (opnameDivisionFilter === "BAR") {
                          matchDivision =
                            ing.storageLocation === "BAR" ||
                            ing.storageLocation === "CHILLER" ||
                            ["coffee", "dairy", "pemanis", "air & es", "kondimen", "sirup", "powder", "kemasan", "biji kopi", "susu"].some((c) =>
                              ing.category.toLowerCase().includes(c)
                            );
                        } else if (opnameDivisionFilter === "KITCHEN") {
                          matchDivision =
                            ing.storageLocation === "KITCHEN" ||
                            ["kitchen", "makanan", "bumbu", "daging", "beras", "ayam", "sambal"].some((c) =>
                              ing.category.toLowerCase().includes(c)
                            );
                        } else if (opnameDivisionFilter === "BAKERY") {
                          matchDivision =
                            ing.storageLocation === "BAKERY" ||
                            ["bakery", "pastry", "roti", "dough", "butter", "tepung", "croissant"].some((c) =>
                              ing.category.toLowerCase().includes(c)
                            );
                        } else if (opnameDivisionFilter === "OPERATIONAL") {
                          matchDivision =
                            ing.storageLocation === "OPERATIONAL" ||
                            ["kebersihan", "operasional", "supplies", "sabun", "plastik"].some((c) =>
                              ing.category.toLowerCase().includes(c)
                            );
                        }

                        return matchSearch && matchCategory && matchDivision;
                      })
                      .map((item) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        if (!ing) return null;
                        return (
                          <tr key={item.ingredientId} className="hover:bg-stone-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-stone-900">{ing.name}</div>
                              <div className="text-[10px] text-stone-400 font-mono">
                                Satuan: {ing.unit} {ing.code ? `• ${ing.code}` : ""}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold">
                                {ing.category}
                              </span>
                              {ing.storageLocation && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-medium border border-amber-200/60">
                                  {ing.storageLocation}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-stone-700">
                              <div>{ing.currentStock.toLocaleString("id-ID")} {ing.unit}</div>
                              {ing.purchaseUnit && ing.conversionFactor && ing.conversionFactor > 1 && (
                                <div className="text-[10px] text-stone-400 font-sans font-medium">
                                  ≈ {(ing.currentStock / ing.conversionFactor).toLocaleString("id-ID", { maximumFractionDigits: 1 })} {ing.purchaseUnit}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {(() => {
                                const hasConversion = !!ing.purchaseUnit && !!ing.conversionFactor && ing.conversionFactor > 1;
                                const isPurchaseMode = opnameInputMode === "PURCHASE" && hasConversion;
                                const factor = ing.conversionFactor || 1;
                                const displayValue = isPurchaseMode
                                  ? parseFloat((item.physicalStock / factor).toFixed(3))
                                  : item.physicalStock;

                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="inline-flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={0}
                                        step="any"
                                        className="w-24 px-2.5 py-1.5 border border-stone-300 rounded-xl text-center text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-800 bg-white shadow-inner"
                                        value={displayValue}
                                        onChange={(e) => {
                                          const num = Number(e.target.value);
                                          const finalBaseQty = isPurchaseMode ? Math.round(num * factor) : num;
                                          handleOpnameChange(item.ingredientId, finalBaseQty);
                                        }}
                                      />
                                      <span className="text-stone-700 text-[11px] font-bold font-mono">
                                        {isPurchaseMode ? ing.purchaseUnit : ing.unit}
                                      </span>
                                    </div>
                                    {hasConversion && (
                                      <span className="text-[10px] text-stone-400 font-mono">
                                        {isPurchaseMode
                                          ? `= ${(displayValue * factor).toLocaleString("id-ID")} ${ing.unit}`
                                          : `≈ ${(item.physicalStock / factor).toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${ing.purchaseUnit}`}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className={`p-3 text-center font-mono font-bold text-xs ${
                              item.difference < 0
                                ? "text-rose-600 bg-rose-50/50"
                                : item.difference > 0
                                ? "text-emerald-600 bg-emerald-50/50"
                                : "text-stone-500"
                            }`}>
                              {item.difference > 0 ? `+${item.difference.toLocaleString("id-ID")}` : item.difference.toLocaleString("id-ID")} {ing.unit}
                              {item.difference < 0 && (
                                <div className="text-[10px] font-sans font-medium text-rose-500">Defisit</div>
                              )}
                              {item.difference > 0 && (
                                <div className="text-[10px] font-sans font-medium text-emerald-600">Surplus</div>
                              )}
                              {item.difference === 0 && (
                                <div className="text-[10px] font-sans font-medium text-stone-400">Cocok</div>
                              )}
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder={item.difference !== 0 ? "Catatan selisih (misal: tumpah, susut)..." : "Catatan opsional..."}
                                className={`w-full px-2.5 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-800 ${
                                  item.difference !== 0 ? "border-amber-300 bg-amber-50/30" : "border-stone-200"
                                }`}
                                value={item.notes}
                                onChange={(e) => handleOpnameNoteChange(item.ingredientId, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Card Utama Stok Opname */}
              <div className="bg-white rounded-3xl border border-stone-200/80 shadow-coffee p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-gradient-to-r from-stone-50 via-amber-50/30 to-stone-50 rounded-2xl border border-amber-100">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-800 text-white rounded-2xl shadow-coffee-sm shrink-0">
                      <ClipboardList className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-stone-900">Audit Fisik Stok (Stok Opname)</h4>
                      <p className="text-xs text-stone-600 mt-1 max-w-xl leading-relaxed">
                        Lakukan perhitungan fisik secara rutin untuk membandingkan jumlah riil bahan baku di bar dengan catatan sistem kasir. Leader Bar, Leader Kitchen, dan Supervisor dapat langsung memulai audit fisik.
                      </p>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={startOpname}
                      className="px-6 py-3 bg-amber-800 hover:bg-amber-900 text-white rounded-2xl text-xs font-bold cursor-pointer shadow-coffee transition-all flex items-center gap-2 shrink-0 hover:scale-[1.02]"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Mulai Stok Opname Sekarang</span>
                    </button>
                  )}
                </div>

                {/* 3 Langkah Alur Opname */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70">
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center mb-2.5">
                      1
                    </div>
                    <div className="text-xs font-bold text-stone-800">Hitung Riil Bahan Baku</div>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                      Barista / Leader menimbang biji kopi, volume susu, atau bahan di bar dan masukkan jumlah fisik ke sistem.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70">
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center mb-2.5">
                      2
                    </div>
                    <div className="text-xs font-bold text-stone-800">Cek Selisih Real-Time</div>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                      Sistem menghitung otomatis selisih minus (defisit/waste) atau plus (surplus) terhadap transaksi kasir.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center mb-2.5">
                      3
                    </div>
                    <div className="text-xs font-bold text-stone-800">Finalisasi & Koreksi Otomatis</div>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                      Sistem memperbarui saldo stok riil dan otomatis mencatat mutasi koreksi tanpa repot input manual.
                    </p>
                  </div>
                </div>
              </div>

              {/* Riwayat Sesi Opname Lampau */}
              {stockOpnames && stockOpnames.length > 0 && (
                <div className="bg-white rounded-3xl border border-stone-200/80 shadow-coffee overflow-hidden">
                  <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">Riwayat Sesi Stok Opname</h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Daftar seluruh audit fisik berkala yang pernah dilakukan tim bar & supervisor.
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-stone-100 rounded-full text-stone-700 text-xs font-bold">
                      {stockOpnames.length} Sesi Tercatat
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-stone-50/80 border-b border-stone-100 text-stone-500 font-bold uppercase text-[10px]">
                          <th className="p-3.5">Tanggal & Waktu</th>
                          <th className="p-3.5">Auditor / Petugas</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5">Catatan</th>
                          <th className="p-3.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {stockOpnames
                          .slice()
                          .reverse()
                          .map((op) => {
                            const relatedItems = stockOpnameItems.filter((i) => i.opnameId === op.id);
                            const discrepancyCount = relatedItems.filter((i) => i.difference !== 0).length;
                            return (
                              <tr key={op.id} className="hover:bg-stone-50/60 transition-colors">
                                <td className="p-3.5">
                                  <div className="font-bold text-stone-900">
                                    {new Date(op.date).toLocaleDateString("id-ID", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </div>
                                  <div className="text-[10px] text-stone-400 font-mono">
                                    {new Date(op.date).toLocaleTimeString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })} WIB
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <span className="font-bold text-stone-800">{op.createdBy}</span>
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    op.status === "FINAL"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-amber-100 text-amber-800 border border-amber-200"
                                  }`}>
                                    {op.status === "FINAL" ? "FINAL (Tersinkron)" : "DRAFT"}
                                  </span>
                                </td>
                                <td className="p-3.5 text-stone-600">
                                  <div>{op.notes || "Audit periodik"}</div>
                                  {discrepancyCount > 0 ? (
                                    <span className="text-[10px] text-rose-600 font-medium">
                                      {discrepancyCount} bahan ditemukan selisih
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-600 font-medium">
                                      Semua bahan akurat (0 selisih)
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center">
                                  <button
                                    onClick={() => setSelectedOpnameForView(op)}
                                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Lihat Rincian</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: RECIPES (BOM) ─────────────────────────────────────────── */}
      {activeTab === "recipes" && (
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-coffee overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Resep Takaran Menu (Bill of Materials)</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Setiap resep menentukan bahan apa saja yang otomatis dipotong saat pesanan dibuat di kasir POS.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px]">
                  <th className="p-4">Nama Menu</th>
                  <th className="p-4">Komposisi Bahan & Takaran</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRecipes.map((recipe) => (
                  <tr key={recipe.id} className="hover:bg-stone-50">
                    <td className="p-4 font-bold text-stone-900">{recipe.menuName}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.ingredients.map((ri, idx) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          return (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-xl bg-stone-100 text-stone-700 text-[11px] font-medium border border-stone-200"
                            >
                              <strong>{ing?.name || "Bahan"}</strong>: {ri.quantity} {ing?.unit || "unit"}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {!isReadOnly && currentUser?.role !== "LEADER" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingRecipe(recipe);
                              setIsAddRecipeOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl"
                            title="Edit Resep"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Hapus resep untuk menu "${recipe.menuName}"?`)) {
                                deleteRecipe(recipe.id);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl"
                            title="Hapus Resep"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredRecipes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-stone-400">
                      Belum ada data resep terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: TAMBAH & EDIT BAHAN BAKU ───────────────────────────────── */}
      {isIngredientModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-coffee-lg w-full max-w-xl overflow-hidden max-h-[92vh] overflow-y-auto my-auto border border-stone-200"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-stone-100 bg-stone-50/80">
              <div>
                <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-800" />
                  {editingIngredient ? "Edit Bahan Baku" : "Tambah Bahan Baku Baru"}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Lengkapi satuan pakai resep dan satuan beli supplier untuk integrasi HPP otomatis.
                </p>
              </div>
              <button
                onClick={() => setIsIngredientModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitIngredient} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* Row 1: Kode & Nama Bahan */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-bold text-stone-700 mb-1">
                    Kode SKU / Barcode
                  </label>
                  <input
                    type="text"
                    value={ingredientForm.code}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, code: e.target.value })}
                    placeholder="BB-001"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-mono focus:outline-none focus:ring-2 focus:ring-amber-800"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-stone-700 mb-1">
                    Nama Bahan Baku <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ingredientForm.name}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                    placeholder="e.g. Biji Kopi Arabika Gayo, Susu Fresh Milk"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-medium focus:outline-none focus:ring-2 focus:ring-amber-800"
                  />
                </div>
              </div>

              {/* Row 2: Kategori & Lokasi Simpan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Kategori</label>
                  <select
                    value={ingredientForm.category}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-800"
                  >
                    {PRESET_CATEGORIES.filter((c) => c.id !== "ALL").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Lokasi Simpan</label>
                  <select
                    value={ingredientForm.storageLocation}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, storageLocation: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-800"
                  >
                    {PRESET_LOCATIONS.filter((l) => l.id !== "ALL").map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── SECTION KONVERSI BELI KE RESEP (SMART FEATURE) ─────────── */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-amber-800" />
                    <span className="font-bold text-amber-950 text-xs">
                      Konversi Satuan Kemasan Supplier & Harga Modal HPP
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={ingredientForm.usePurchaseUnit}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, usePurchaseUnit: e.target.checked })}
                      className="rounded text-amber-800 focus:ring-amber-800"
                    />
                    <span>Beli dalam Kemasan (Dus/Kg/Liter)</span>
                  </label>
                </div>

                {ingredientForm.usePurchaseUnit ? (
                  <div className="space-y-3 pt-2 border-t border-amber-200/60">
                    {/* Preset selection buttons */}
                    <div>
                      <span className="text-[10px] text-amber-900 font-semibold block mb-1">
                        Pilih Cepat Tipe Kemasan:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PURCHASE_UNIT_PRESETS.slice(0, 5).map((p) => (
                          <button
                            type="button"
                            key={p.unit}
                            onClick={() => handlePurchasePresetSelect(p.unit)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              ingredientForm.purchaseUnit === p.unit
                                ? "bg-amber-800 text-white border-amber-800"
                                : "bg-white text-stone-700 border-amber-200 hover:bg-amber-100/50"
                            }`}
                          >
                            {p.unit}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          Satuan Beli Supplier
                        </label>
                        <input
                          type="text"
                          required
                          value={ingredientForm.purchaseUnit}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, purchaseUnit: e.target.value })}
                          placeholder="e.g. Kg, Karton, Dus"
                          className="w-full px-3 py-2 bg-white rounded-xl border border-amber-300 font-bold text-stone-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          Isi per Kemasan
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            required
                            min="1"
                            value={ingredientForm.conversionFactor}
                            onChange={(e) => setIngredientForm({ ...ingredientForm, conversionFactor: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-amber-300 font-bold font-mono text-stone-800"
                          />
                          <span className="text-xs font-bold text-amber-900 shrink-0">
                            {ingredientForm.unit}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          Harga Beli Kemasan
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                            Rp
                          </span>
                          <input
                            type="number"
                            required
                            min="0"
                            value={ingredientForm.purchasePrice}
                            onChange={(e) => setIngredientForm({ ...ingredientForm, purchasePrice: Number(e.target.value) })}
                            className="w-full pl-8 pr-2 py-2 bg-white rounded-xl border border-amber-300 font-bold font-mono text-stone-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live Formula Preview Box */}
                    <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-stone-500">Harga Modal Resep (HPP):</span>
                        <p className="font-bold text-stone-800 mt-0.5">
                          {formatCurrency(ingredientForm.purchasePrice)} ÷ {ingredientForm.conversionFactor.toLocaleString("id-ID")} {ingredientForm.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-stone-400 text-[10px]">Otomatis ke HPP:</span>
                        <p className="font-mono font-black text-amber-900 text-sm">
                          {formatCurrency(computedCostPerUnit)} <span className="text-[10px] font-normal text-stone-500">/{ingredientForm.unit}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-950 mb-1">
                        Satuan Resep Dasar
                      </label>
                      <input
                        type="text"
                        required
                        value={ingredientForm.unit}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                        placeholder="gr, ml, pcs, portion"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-amber-300 font-bold text-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-950 mb-1">
                        Harga Modal Satuan (Rp/{ingredientForm.unit})
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={ingredientForm.costPerUnit}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, costPerUnit: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-amber-300 font-bold font-mono text-stone-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Row 3: Stok Fisik & Batas Minimum */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-stone-700">
                      {editingIngredient ? "Stok Saat Ini" : "Stok Awal Fisik"}
                    </label>
                    {ingredientForm.usePurchaseUnit && (
                      <div className="flex gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setIngredientForm({ ...ingredientForm, initialStockUnit: "BASE" })}
                          className={`px-1.5 py-0.5 rounded ${
                            ingredientForm.initialStockUnit === "BASE" ? "bg-stone-800 text-white font-bold" : "text-stone-500"
                          }`}
                        >
                          {ingredientForm.unit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIngredientForm({ ...ingredientForm, initialStockUnit: "PURCHASE" })}
                          className={`px-1.5 py-0.5 rounded ${
                            ingredientForm.initialStockUnit === "PURCHASE" ? "bg-stone-800 text-white font-bold" : "text-stone-500"
                          }`}
                        >
                          {ingredientForm.purchaseUnit}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={ingredientForm.stockInput}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, stockInput: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-800"
                    />
                    <span className="font-bold text-stone-500 shrink-0 text-xs">
                      {ingredientForm.initialStockUnit === "PURCHASE" ? ingredientForm.purchaseUnit : ingredientForm.unit}
                    </span>
                  </div>
                  {ingredientForm.initialStockUnit === "PURCHASE" && ingredientForm.usePurchaseUnit && (
                    <p className="text-[10px] text-stone-500 mt-1">
                      Setara dengan <strong>{(Number(ingredientForm.stockInput) * Number(ingredientForm.conversionFactor)).toLocaleString("id-ID")} {ingredientForm.unit}</strong>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Batas Minimum Aman (Alert Reorder)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={ingredientForm.minStock}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, minStock: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-800"
                    />
                    <span className="font-bold text-stone-500 shrink-0 text-xs">
                      {ingredientForm.unit}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Notifikasi muncul jika stok &le; batas ini.
                  </p>
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Catatan Tambahan (Merek, Supplier, dsb)
                </label>
                <input
                  type="text"
                  value={ingredientForm.notes}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, notes: e.target.value })}
                  placeholder="e.g. Beli di Toko Kopi Mandiri, kadaluwarsa 6 bulan"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800"
                />
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 hover:bg-stone-100 rounded-2xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-2xl font-bold shadow-coffee-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingIngredient ? "Simpan Perubahan" : "Simpan Bahan Baku"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ── MODAL: CATAT PEMAKAIAN & WASTE ───────────────────────────────── */}
      {isAddMovementOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-coffee-lg w-full max-w-md overflow-hidden border border-stone-200"
          >
            <div className="flex justify-between items-center p-5 border-b border-stone-100 bg-stone-50/80">
              <div>
                <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                  {movementType === "WASTE" ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Plus className="w-5 h-5 text-amber-800" />
                  )}
                  {movementType === "WASTE" ? "Catat Bahan Rusak / Terbuang (Waste)" : "Catat Pemakaian Harian"}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Setiap mutasi akan mengurangi saldo stok dan tercatat dalam audit log.
                </p>
              </div>
              <button
                onClick={() => setIsAddMovementOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMovement} className="p-5 space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="flex gap-1.5 p-1 bg-stone-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setMovementType("USAGE")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    movementType === "USAGE" ? "bg-white text-stone-900 shadow-coffee-sm" : "text-stone-500"
                  }`}
                >
                  Pemakaian
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType("WASTE")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    movementType === "WASTE" ? "bg-white text-rose-700 shadow-coffee-sm" : "text-stone-500"
                  }`}
                >
                  Waste (Rusak)
                </button>
                {currentUser?.role !== "LEADER" && (
                  <button
                    type="button"
                    onClick={() => setMovementType("IN")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      movementType === "IN" ? "bg-white text-emerald-700 shadow-coffee-sm" : "text-stone-500"
                    }`}
                  >
                    Masuk Manual
                  </button>
                )}
              </div>

              {/* Select Ingredient */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Pilih Bahan Baku</label>
                <select
                  required
                  value={selectedIngredientForMove}
                  onChange={(e) => setSelectedIngredientForMove(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-800"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Sisa: {ing.currentStock.toLocaleString("id-ID")} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Jumlah {movementType === "IN" ? "Masuk" : "Keluar / Terbuang"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={movementQuantity || ""}
                    onChange={(e) => setMovementQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-800"
                    placeholder="0"
                  />
                  <span className="font-bold text-stone-500 shrink-0 text-xs">
                    {ingredients.find((i) => i.id === selectedIngredientForMove)?.unit || "unit"}
                  </span>
                </div>
              </div>

              {/* Waste Reason Quick Select */}
              {movementType === "WASTE" && (
                <div>
                  <span className="block font-bold text-rose-900 mb-1 text-[11px]">
                    Pilih Alasan Bahan Terbuang:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {WASTE_REASONS.map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setMovementNote(r)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer border ${
                          movementNote === r
                            ? "bg-rose-100 text-rose-900 border-rose-300"
                            : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Estimated Loss Display */}
                  {movementQuantity > 0 && selectedIngredientForMove && (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex justify-between items-center text-[11px]">
                      <span className="text-rose-800 font-semibold">Taksiran Nilai Kerugian:</span>
                      <span className="font-mono font-black text-rose-700">
                        {formatCurrency(
                          movementQuantity * (ingredients.find((i) => i.id === selectedIngredientForMove)?.costPerUnit || 0)
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Note input */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder="Keterangan mutasi (opsional)..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddMovementOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer shadow-coffee-sm ${
                    movementType === "WASTE" ? "bg-rose-600 hover:bg-rose-700" : "bg-stone-900 hover:bg-black"
                  }`}
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Recipe Modal */}
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

      {/* ── MODAL RINCIAN OPNAME DETAIL ───────────────────────────────────── */}
      {selectedOpnameForView && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Rincian Hasil Stok Opname</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Audit oleh {selectedOpnameForView.createdBy} •{" "}
                  {new Date(selectedOpnameForView.date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedOpnameForView(null)}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px]">
                      <th className="p-3">Bahan Baku</th>
                      <th className="p-3 text-center">Stok Sistem</th>
                      <th className="p-3 text-center">Stok Fisik Nyata</th>
                      <th className="p-3 text-center">Selisih</th>
                      <th className="p-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {stockOpnameItems
                      .filter((i) => i.opnameId === selectedOpnameForView.id)
                      .map((item) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        return (
                          <tr key={item.id} className="hover:bg-stone-50">
                            <td className="p-3 font-bold text-stone-900">
                              {ing ? ing.name : "Bahan Terhapus"}{" "}
                              {ing && <span className="text-stone-400 font-normal">({ing.unit})</span>}
                            </td>
                            <td className="p-3 text-center font-mono text-stone-600">
                              {item.systemStock.toLocaleString("id-ID")}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-stone-900">
                              {item.physicalStock.toLocaleString("id-ID")}
                            </td>
                            <td className={`p-3 text-center font-mono font-bold ${
                              item.difference < 0 ? "text-rose-600" : item.difference > 0 ? "text-emerald-600" : "text-stone-500"
                            }`}>
                              {item.difference > 0 ? `+${item.difference.toLocaleString("id-ID")}` : item.difference.toLocaleString("id-ID")}
                            </td>
                            <td className="p-3 text-stone-500">
                              {item.notes || "-"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex justify-end">
              <button
                onClick={() => setSelectedOpnameForView(null)}
                className="px-5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
