import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ConfirmModal } from "./common/ConfirmModal";
import { CustomSelect } from "./common/CustomSelect";
import { CurrencyInput } from "./common/CurrencyInput";
import { formatCurrency } from "../utils/format";
import {
  applyDeleteMenuCategory,
  applyRenameMenuCategory,
  buildMenuCategoriesSettingsMap,
  getDivisionMenuCategories,
  PRODUCT_GROUP_OPTIONS,
  PRODUCT_GROUP_LABELS,
  inferProductGroup,
  isPackagingIngredient,
} from "../utils/productSalesAnalytics";
import {
  parseRecipeIngredientsSafe,
  mergeDuplicateRecipeIngredients,
  computeSignedMarginMetrics,
  recalculateVariantFromLiveIngredients,
  validateBatchPrepSubmission,
} from "../utils/syncSanitizers";
import {
  ViewState,
  Product,
  ProductVariant,
  ProductModifier,
  ProductModifierGroup,
  ProductDivision,
  BatchPreparation,
  RecipeIngredient,
  Recipe,
  Ingredient,
  DEFAULT_DIVISION_PACKAGING,
} from "../types";
import {
  Coffee,
  UtensilsCrossed,
  Cake,
  Flame,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Calculator,
  Tag,
  Coins,
  Percent,
  Check,
  X,
  Clock,
  ChevronDown,
  Info,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MenuManagementProps {
  onNavigate?: (view: ViewState) => void;
}

export const MenuManagement: React.FC<MenuManagementProps> = ({ onNavigate }) => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    batchPreparations,
    addBatchPreparation,
    updateBatchPreparation,
    deleteBatchPreparation,
    executeBatchCook,
    ingredients,
    recipes,
    addRecipe,
    updateRecipe,
    settings,
    updateSettings,
    currentUser,
    isReadOnly,
  } = useStore();

  const userRole = (currentUser?.role || "").toUpperCase();
  const canManageMenuCategories = !isReadOnly && userRole !== "LEADER";
  const canNavigateToHpp =
    Boolean(onNavigate) &&
    (userRole === "SUPER_ADMIN" || userRole === "OWNER" || userRole === "MANAGER");

  const [activeTab, setActiveTab] = useState<ProductDivision | "BATCH_PREP">("BAR");
  const [searchTerm, setSearchTerm] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [onlyHighFoodCost, setOnlyHighFoodCost] = useState<boolean>(false);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isBatchPrepModalOpen, setIsBatchPrepModalOpen] = useState(false);
  const [editingBatchPrep, setEditingBatchPrep] = useState<BatchPreparation | null>(null);
  const [batchPrepDivisionFilter, setBatchPrepDivisionFilter] = useState<"ALL" | ProductDivision>("ALL");

  const [isBatchCookModalOpen, setIsBatchCookModalOpen] = useState(false);
  const [cookingBatchPrep, setCookingBatchPrep] = useState<BatchPreparation | null>(null);
  const [cookMultiplier, setCookMultiplier] = useState<number>(1);
  const [cookNotes, setCookNotes] = useState<string>("");

  // Kategori Menu Manager state
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryManagerDivision, setCategoryManagerDivision] = useState<ProductDivision>("BAR");
  const [newMenuCatName, setNewMenuCatName] = useState("");
  const [editingMenuCatOld, setEditingMenuCatOld] = useState<string | null>(null);
  const [editingMenuCatNew, setEditingMenuCatNew] = useState("");
  const [menuCatToDelete, setMenuCatToDelete] = useState<{
    division: ProductDivision;
    name: string;
  } | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [batchPrepToDelete, setBatchPrepToDelete] = useState<BatchPreparation | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    if (type === "success") {
      toast.success(text);
    } else {
      toast.error(text);
    }
  };

  // ─── Filtered Products ─────────────────────────────────────────────────────
  const currentDivisionProducts = useMemo(() => {
    if (activeTab === "BATCH_PREP") return [];
    return products.filter((p) => p.division === activeTab);
  }, [products, activeTab]);

  const categories = useMemo(() => {
    if (activeTab === "BATCH_PREP") return [];
    return getDivisionMenuCategories(activeTab, settings?.menuCategories, products);
  }, [activeTab, settings?.menuCategories, products]);

  const modalDivisionCategories = useMemo(
    () =>
      getDivisionMenuCategories(
        categoryManagerDivision,
        settings?.menuCategories,
        products
      ),
    [categoryManagerDivision, settings?.menuCategories, products]
  );

  const persistMenuCategories = (division: ProductDivision, nextList: string[]) => {
    const baseMap = buildMenuCategoriesSettingsMap(settings?.menuCategories);
    updateSettings({
      ...settings,
      menuCategories: {
        ...baseMap,
        [division]: nextList,
      },
    });
  };

  const handleOpenCategoryManager = (div?: ProductDivision) => {
    if (!canManageMenuCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori menu.");
      return;
    }
    const targetDiv =
      div || (activeTab === "BATCH_PREP" ? "BAR" : activeTab);
    setCategoryManagerDivision(targetDiv);
    setEditingMenuCatOld(null);
    setEditingMenuCatNew("");
    setNewMenuCatName("");
    setIsCategoryManagerOpen(true);
  };

  const handleAddMenuCategory = (rawName: string) => {
    if (!canManageMenuCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori menu.");
      return;
    }
    const clean = rawName.trim().toUpperCase();
    if (!clean) {
      toast.error("Nama kategori menu tidak boleh kosong.");
      return;
    }
    if (modalDivisionCategories.some((c) => c === clean)) {
      toast.error(`Kategori "${clean}" sudah ada di divisi ${categoryManagerDivision}.`);
      return;
    }
    const next = [...modalDivisionCategories, clean];
    persistMenuCategories(categoryManagerDivision, next);
    setNewMenuCatName("");
    toast.success(`Kategori menu "${clean}" ditambahkan.`);
  };

  const handleSaveRenameMenuCategory = (oldName: string) => {
    if (!canManageMenuCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori menu.");
      return;
    }
    const cleanNew = editingMenuCatNew.trim().toUpperCase();
    if (!cleanNew) {
      toast.error("Nama kategori baru tidak boleh kosong.");
      return;
    }
    if (
      cleanNew !== oldName.trim().toUpperCase() &&
      modalDivisionCategories.some((c) => c === cleanNew)
    ) {
      toast.error(`Kategori "${cleanNew}" sudah digunakan.`);
      return;
    }
    const { updatedCategories, updatedProducts } = applyRenameMenuCategory({
      division: categoryManagerDivision,
      currentCategories: modalDivisionCategories,
      oldName,
      newName: cleanNew,
      products,
    });
    persistMenuCategories(categoryManagerDivision, updatedCategories);
    updatedProducts.forEach((prod) => updateProduct(prod));
    if (activeTab === categoryManagerDivision && selectedCategory === oldName) {
      setSelectedCategory(cleanNew);
    }
    setEditingMenuCatOld(null);
    setEditingMenuCatNew("");
    toast.success(`Kategori menu "${oldName}" diubah menjadi "${cleanNew}".`);
  };

  const handleConfirmDeleteMenuCategory = () => {
    if (!canManageMenuCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori menu.");
      setMenuCatToDelete(null);
      return;
    }
    if (!menuCatToDelete) return;
    const { division: targetDiv, name: targetName } = menuCatToDelete;
    const divCats = getDivisionMenuCategories(targetDiv, settings?.menuCategories, products);
    const { updatedCategories, updatedProducts, fallbackCategory } = applyDeleteMenuCategory({
      division: targetDiv,
      currentCategories: divCats,
      targetName,
      products,
    });
    persistMenuCategories(targetDiv, updatedCategories);
    updatedProducts.forEach((prod) => updateProduct(prod));
    if (activeTab === targetDiv && selectedCategory === targetName) {
      setSelectedCategory("ALL");
    }
    toast.success(
      updatedProducts.length > 0
        ? `Kategori "${targetName}" dihapus. ${updatedProducts.length} produk dipindahkan ke "${fallbackCategory}".`
        : `Kategori menu "${targetName}" berhasil dihapus.`
    );
    setMenuCatToDelete(null);
  };

  const filteredProducts = useMemo(() => {
    return currentDivisionProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = selectedCategory === "ALL" || p.category === selectedCategory;
      const matchFoodCost =
        !onlyHighFoodCost ||
        (p.variants || []).some(
          (v) =>
            v.price > 0 &&
            (v.estimatedHpp || 0) > 0 &&
            ((v.estimatedHpp || 0) / v.price) * 100 > 35
        );
      return matchSearch && matchCategory && matchFoodCost;
    });
  }, [currentDivisionProducts, searchTerm, selectedCategory, onlyHighFoodCost]);

  const filteredBatchPreparations = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    return batchPreparations.filter((bp) => {
      if (batchPrepDivisionFilter !== "ALL" && bp.division !== batchPrepDivisionFilter) return false;
      if (q) {
        const matchName = bp.name.toLowerCase().includes(q);
        const matchTarget = (bp.targetIngredientName || "").toLowerCase().includes(q);
        if (!matchName && !matchTarget) return false;
      }
      return true;
    });
  }, [batchPreparations, batchPrepDivisionFilter, batchSearch]);

  // ─── Metrics Strip ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const allVariants = currentDivisionProducts.flatMap((p) => p.variants || []);
    const validVariants = allVariants.filter((v) => v.price > 0 && (v.estimatedHpp || 0) > 0);

    const avgMargin =
      validVariants.length > 0
        ? validVariants.reduce((sum, v) => sum + ((v.price - (v.estimatedHpp || 0)) / v.price) * 100, 0) /
          validVariants.length
        : 0;

    const avgFoodCost =
      validVariants.length > 0
        ? validVariants.reduce((sum, v) => sum + ((v.estimatedHpp || 0) / v.price) * 100, 0) /
          validVariants.length
        : 0;

    const highFoodCostCount = validVariants.filter(
      (v) => ((v.estimatedHpp || 0) / v.price) * 100 > 35
    ).length;

    return {
      totalProducts: currentDivisionProducts.length,
      totalVariants: allVariants.length,
      avgMargin: Math.round(avgMargin * 10) / 10,
      avgFoodCost: Math.round(avgFoodCost * 10) / 10,
      highFoodCostCount,
    };
  }, [currentDivisionProducts]);

  // ─── Live Stock Availability Helper ────────────────────────────────────────
  const calculateVariantStockAvailability = (variant: ProductVariant, productName?: string) => {
    let effectiveRecipe = parseRecipeIngredientsSafe(variant.recipe);
    if (effectiveRecipe.length === 0 && productName) {
      const fallbackRec = recipes.find(
        (r) => r.menuName.trim().toLowerCase() === productName.trim().toLowerCase()
      );
      if (fallbackRec) {
        effectiveRecipe = parseRecipeIngredientsSafe(fallbackRec.ingredients);
      }
    }

    if (effectiveRecipe.length === 0) {
      return { status: "ready" as const, portions: null, bottleneck: null };
    }

    let minPortions = Infinity;
    let bottleneckIng: string | null = null;

    for (const ri of effectiveRecipe) {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      if (!ing || ing.currentStock <= 0 || ri.quantity <= 0) {
        return {
          status: "empty" as const,
          portions: 0,
          bottleneck: ing ? ing.name : "Bahan belum terdaftar",
        };
      }
      const portions = Math.floor(ing.currentStock / ri.quantity);
      if (portions < minPortions) {
        minPortions = portions;
        bottleneckIng = ing.name;
      }
    }

    if (minPortions === 0) {
      return { status: "empty" as const, portions: 0, bottleneck: bottleneckIng };
    }
    if (minPortions <= 5) {
      return { status: "low" as const, portions: minPortions, bottleneck: bottleneckIng };
    }
    return { status: "ready" as const, portions: minPortions, bottleneck: null };
  };

  // ─── Batch Prep Readiness Helper ───────────────────────────────────────────
  const calculateBatchPrepReadiness = (bp: BatchPreparation) => {
    const ingList = Array.isArray(bp.ingredients) ? bp.ingredients : [];
    if (ingList.length === 0) {
      return { canCook: false, maxBatches: 0, bottleneck: "Resep belum memiliki bahan" };
    }
    let maxBatches = Infinity;
    let bottleneckIng: string | null = null;

    for (const ri of ingList) {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      if (!ing || ing.currentStock <= 0 || ri.quantity <= 0) {
        return { canCook: false, maxBatches: 0, bottleneck: ing ? ing.name : "Bahan kosong" };
      }
      const batches = Math.floor(ing.currentStock / ri.quantity);
      if (batches < maxBatches) {
        maxBatches = batches;
        bottleneckIng = ing.name;
      }
    }

    return {
      canCook: maxBatches >= 1,
      maxBatches: maxBatches === Infinity ? 0 : maxBatches,
      bottleneck: maxBatches < 1 ? bottleneckIng : null,
    };
  };

  // ─── Batch Cook Execution ──────────────────────────────────────────────────
  const handleConfirmBatchCook = () => {
    if (isReadOnly) {
      showToast("error", "Akun Owner berstatus Read-Only.");
      return;
    }
    if (!cookingBatchPrep) return;
    const res = executeBatchCook(cookingBatchPrep.id, cookMultiplier, cookNotes);
    if (res.success) {
      showToast("success", res.message);
      setIsBatchCookModalOpen(false);
      setCookingBatchPrep(null);
      setCookMultiplier(1);
      setCookNotes("");
    } else {
      showToast("error", res.message);
    }
  };

  // ─── Bulk Recalculate HPP from latest ingredients & packaging ───────────────
  const handleBulkRecalculateHpp = () => {
    if (isReadOnly) {
      showToast("error", "Akun Owner berstatus Read-Only dan tidak dapat mengubah harga HPP produk.");
      return;
    }
    let updatedProductsCount = 0;
    let updatedVariantsCount = 0;

    products.forEach((p) => {
      let isProductChanged = false;
      const fallbackRec = recipes.find(
        (r) => r.menuName.trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      const updatedVariants = (p.variants || []).map((v) => {
        const res = recalculateVariantFromLiveIngredients({
          variant: v,
          fallbackRecipe: fallbackRec?.ingredients,
          ingredients,
          isPackagingCheck: isPackagingIngredient,
        });
        if (res.changed) {
          isProductChanged = true;
          updatedVariantsCount++;
          return res.updatedVariant;
        }
        return v;
      });

      if (isProductChanged) {
        updateProduct({ ...p, variants: updatedVariants });
        updatedProductsCount++;
      }
    });

    if (updatedProductsCount > 0) {
      showToast(
        "success",
        `Berhasil menyinkronkan HPP untuk ${updatedProductsCount} menu (${updatedVariantsCount} varian) dengan harga bahan baku terbaru!`
      );
    } else {
      showToast(
        "success",
        "Seluruh HPP produk sudah akurat dengan harga bahan baku & kemasan terkini di inventori."
      );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* HEADER SECTION */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">
              Supply Chain & Menu Engineering
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Katalog Menu & Dapur Olahan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
            Kelola produk resmi, varian takaran, HPP riil, dan jadwal masak kondimen olahan (batch prep) per divisi toko.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleBulkRecalculateHpp}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs transition-all flex items-center gap-2 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              title="Hitung ulang estimasi HPP seluruh produk berdasarkan harga bahan baku dan kemasan terbaru di inventori"
            >
              <RefreshCw className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>Sinkronkan HPP</span>
            </button>
          )}

          {canNavigateToHpp && (
            <button
              type="button"
              onClick={() => onNavigate?.("hpp_calculator")}
              className="px-3.5 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-2xl text-xs transition-all flex items-center gap-2 border border-brand-200/70 shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Calculator className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>Kalkulator HPP</span>
            </button>
          )}

          {isReadOnly ? (
            <div className="px-3.5 py-2 bg-amber-50 border border-amber-200/80 text-amber-800 rounded-2xl text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Mode Pantau (Owner Read-Only)</span>
            </div>
          ) : activeTab === "BATCH_PREP" ? (
            <button
              type="button"
              onClick={() => {
                setEditingBatchPrep(null);
                setIsBatchPrepModalOpen(true);
              }}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              <span>Resep Batch Baru</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              <span>Produk {activeTab} Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SLIDING PILL TABS: DIVISION SELECTION ─────────────────────────── */}
      <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 gap-1 overflow-x-auto no-scrollbar max-w-full">
        <button
          onClick={() => {
            setActiveTab("BAR");
            setSelectedCategory("ALL");
          }}
          className={`relative px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
            activeTab === "BAR" ? "text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {activeTab === "BAR" && (
            <motion.div
              layoutId="menuDivisionTab"
              className="absolute inset-0 bg-brand-600 rounded-xl shadow-xs"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <Coffee className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Divisi Bar & Kopi</span>
          <span
            className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeTab === "BAR" ? "bg-white/20 text-white font-bold" : "bg-slate-200/80 text-slate-700"
            }`}
          >
            {products.filter((p) => p.division === "BAR").length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("KITCHEN");
            setSelectedCategory("ALL");
          }}
          className={`relative px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
            activeTab === "KITCHEN" ? "text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {activeTab === "KITCHEN" && (
            <motion.div
              layoutId="menuDivisionTab"
              className="absolute inset-0 bg-brand-600 rounded-xl shadow-xs"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <UtensilsCrossed className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Divisi Kitchen & Makanan</span>
          <span
            className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeTab === "KITCHEN" ? "bg-white/20 text-white font-bold" : "bg-slate-200/80 text-slate-700"
            }`}
          >
            {products.filter((p) => p.division === "KITCHEN").length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("BAKER");
            setSelectedCategory("ALL");
          }}
          className={`relative px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
            activeTab === "BAKER" ? "text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {activeTab === "BAKER" && (
            <motion.div
              layoutId="menuDivisionTab"
              className="absolute inset-0 bg-brand-600 rounded-xl shadow-xs"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <Cake className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Divisi Bakery & Pastry</span>
          <span
            className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeTab === "BAKER" ? "bg-white/20 text-white font-bold" : "bg-slate-200/80 text-slate-700"
            }`}
          >
            {products.filter((p) => p.division === "BAKER").length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("BATCH_PREP");
            setSelectedCategory("ALL");
          }}
          className={`relative px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
            activeTab === "BATCH_PREP" ? "text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {activeTab === "BATCH_PREP" && (
            <motion.div
              layoutId="menuDivisionTab"
              className="absolute inset-0 bg-brand-600 rounded-xl shadow-xs"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <Flame className="w-3.5 h-3.5 relative z-10 text-amber-300" />
          <span className="relative z-10">Dapur Olahan (Batch Cook)</span>
          <span
            className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              activeTab === "BATCH_PREP" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
            }`}
          >
            {batchPreparations.length}
          </span>
        </button>
      </div>

      {/* ── BENTO METRIC STRIP (For Products) ─────────────────────────────── */}
      {activeTab !== "BATCH_PREP" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Menu
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.totalProducts} <span className="text-xs font-normal text-slate-500">menu</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Varian
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.totalVariants} <span className="text-xs font-normal text-slate-500">sku</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rata-rata Margin
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              {metrics.avgMargin}%
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rata-rata Food Cost
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
              {metrics.avgFoodCost}%
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: PRODUCTS (BAR / KITCHEN / BAKER) ─────────────────── */}
      {activeTab !== "BATCH_PREP" && (
        <div className="space-y-4">
          {/* SEARCH & CATEGORY FILTER */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 sm:p-3.5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari menu, rasa, kategori..."
                className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {(metrics.highFoodCostCount > 0 || onlyHighFoodCost) && (
                <button
                  type="button"
                  onClick={() => setOnlyHighFoodCost((prev) => !prev)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 active:scale-95 ${
                    onlyHighFoodCost
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Food Cost &gt;35% ({metrics.highFoodCostCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  selectedCategory === "ALL"
                    ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Semua
              </button>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                    selectedCategory === cat
                      ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
              {canManageMenuCategories && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenCategoryManager(
                      activeTab === "BATCH_PREP" ? "BAR" : activeTab
                    )
                  }
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/80 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0"
                  title="Tambah, ubah nama, atau hapus kategori menu"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Kelola Kategori</span>
                </button>
              )}
            </div>
          </div>

          {/* PRODUCT CARDS LIST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-brand-50 text-brand-700 uppercase tracking-wide border border-brand-200/70">
                          {PRODUCT_GROUP_LABELS[inferProductGroup(product.division, product.category, product.productGroup)] || inferProductGroup(product.division, product.category, product.productGroup)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 uppercase tracking-wide border border-slate-200/60">
                          {product.category}
                        </span>
                        {!product.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1.5">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setIsProductModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                          title="Edit Produk & Varian"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductToDelete(product)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Hapus Produk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* VARIAN LIST */}
                  <div className="mt-3.5 space-y-2.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Varian & Harga Jual ({product.variants?.length || 0})
                    </span>

                    {product.variants?.map((variant) => {
                      const avail = calculateVariantStockAvailability(variant, product.name);
                      const hpp = variant.estimatedHpp || 0;
                      const {
                        grossProfit: profit,
                        grossMarginPercent: marginPct,
                        foodCostPercent: foodCostPct,
                        isLoss,
                      } = computeSignedMarginMetrics(variant.price, hpp);
                      const isHighFoodCost = isLoss || foodCostPct > 35;
                      const idealPrice = hpp > 0 ? Math.ceil(hpp / 0.32 / 500) * 500 : variant.price;

                      return (
                        <div
                          key={variant.id}
                          className={`p-3 rounded-2xl border space-y-2 text-xs transition-colors ${
                            isHighFoodCost
                              ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
                              : "bg-slate-50/80 border-slate-200/70 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                <span>{variant.name}</span>
                                {variant.sku && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                    {variant.sku}
                                  </span>
                                )}
                                {foodCostPct > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border font-mono ${
                                      isHighFoodCost
                                        ? "bg-rose-100 text-rose-800 border-rose-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                                  >
                                    Food Cost {foodCostPct.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                              {variant.packagingNotes && (
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Kemasan: {variant.packagingNotes} (Rp {variant.packagingCost || 0})
                                </span>
                              )}
                              {isHighFoodCost && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-0.5 mt-1 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>Margin terkikis! Saran harga ≥ {formatCurrency(idealPrice)}</span>
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-black text-sm text-slate-900 font-mono">
                                {formatCurrency(variant.price)}
                              </span>
                              <div
                                className={`text-[10px] font-bold tabular-nums ${
                                  isHighFoodCost ? "text-rose-700" : "text-emerald-700"
                                }`}
                              >
                                {isLoss
                                  ? `Rugi: ${formatCurrency(profit)} (${marginPct.toFixed(0)}%)`
                                  : `Margin: ${marginPct.toFixed(0)}% (+${formatCurrency(profit)})`}
                              </div>
                            </div>
                          </div>

                          {/* Live Availability Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1.5 border-t border-slate-200/60 text-[11px] gap-1">
                            <div className="flex items-center gap-1.5">
                              {avail.status === "ready" && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-slate-600 font-medium">
                                    Siap Saji {avail.portions !== null ? `(~${avail.portions} porsi)` : ""}
                                  </span>
                                </>
                              )}
                              {avail.status === "low" && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span className="text-amber-800 font-bold">
                                    Stok Menipis (~{avail.portions} porsi, terbatas di {avail.bottleneck})
                                  </span>
                                </>
                              )}
                              {avail.status === "empty" && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                                  <span className="text-rose-700 font-bold">
                                    Stok Habis: {avail.bottleneck}
                                  </span>
                                </>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-500 font-mono">
                              HPP: {formatCurrency(hpp)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* MODIFIERS PREVIEW IF ANY */}
                  {product.modifierGroups && product.modifierGroups.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-bold text-slate-400">Modifier:</span>
                      {product.modifierGroups.map((g) => (
                        <span
                          key={g.id}
                          className="text-[10px] font-medium bg-brand-50 text-brand-900 border border-brand-200/60 px-2 py-0.5 rounded-lg"
                        >
                          {g.name} ({g.options.length} opsi)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
                <Coffee className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">Belum ada produk di divisi {activeTab}</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {isReadOnly
                    ? "Belum ada daftar produk yang cocok dengan filter saat ini."
                    : `Tambahkan produk baru dengan mengklik tombol "+ Produk ${activeTab} Baru" di atas.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: BATCH PREP (DAPUR OLAHAN / KONDIMEN) ─────────────── */}
      {activeTab === "BATCH_PREP" && (
        <div className="space-y-6">
          {/* BANNER PENJELASAN */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl border border-slate-800 shadow-md space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Batch Preparation & Sub-Recipes Kitchen/Bar</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Sistem Otomatisasi Masak Kondimen & Potong Stok Bahan Mentah
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Kondimen seperti <b>Saus Gula Aren Racikan, Simple Syrup, Cold Brew Concentrate,</b> dan <b>Sambal Matah</b> dimasak dari kombinasi bahan baku mentah. Saat staf menekan <i>"Masak Batch Sekarang"</i>, sistem otomatis memotong stok bahan mentah dan menambah stok kondimen dengan harga HPP tertimbang yang akurat.
            </p>
          </div>

          {/* SEARCH & DIVISION SUB-TABS FILTER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                placeholder="Cari resep batch atau target bahan..."
                className="w-full pl-9 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-base sm:text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
              {batchSearch && (
                <button
                  type="button"
                  onClick={() => setBatchSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setBatchPrepDivisionFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 whitespace-nowrap ${
                batchPrepDivisionFilter === "ALL"
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Semua Olahan ({batchPreparations.length})
            </button>
            <button
              type="button"
              onClick={() => setBatchPrepDivisionFilter("BAR")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap ${
                batchPrepDivisionFilter === "BAR"
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              Olahan Bar ({batchPreparations.filter((b) => b.division === "BAR").length})
            </button>
            <button
              type="button"
              onClick={() => setBatchPrepDivisionFilter("KITCHEN")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap ${
                batchPrepDivisionFilter === "KITCHEN"
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              Olahan Kitchen ({batchPreparations.filter((b) => b.division === "KITCHEN").length})
            </button>
            <button
              type="button"
              onClick={() => setBatchPrepDivisionFilter("BAKER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap ${
                batchPrepDivisionFilter === "BAKER"
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Cake className="w-3.5 h-3.5" />
              Olahan Bakery ({batchPreparations.filter((b) => b.division === "BAKER").length})
            </button>
            </div>
          </div>

          {/* BATCH PREP CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {filteredBatchPreparations.map((bp) => {
              const target = ingredients.find((i) => i.id === bp.targetIngredientId);
              const readiness = calculateBatchPrepReadiness(bp);
              const bpIngredients = Array.isArray(bp.ingredients) ? bp.ingredients : [];

              // Hitung total cost bahan baku per 1 batch
              const totalCostPerBatch = bpIngredients.reduce((sum, ri) => {
                const ing = ingredients.find((i) => i.id === ri.ingredientId);
                return sum + ri.quantity * (ing?.costPerUnit || 0);
              }, 0);

              const costPerUnit = bp.yieldQuantity > 0 ? Math.round(totalCostPerBatch / bp.yieldQuantity) : 0;

              return (
                <div
                  key={bp.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                              bp.division === "BAR"
                                ? "bg-brand-50 text-brand-800 border-brand-200"
                                : bp.division === "KITCHEN"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-purple-50 text-purple-800 border-purple-200"
                            }`}
                          >
                            {bp.division === "BAR" ? "☕ Bar" : bp.division === "KITCHEN" ? "🍳 Kitchen" : "🥐 Bakery"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono border border-slate-200/60">
                            1 BATCH = {bp.yieldQuantity.toLocaleString("id-ID")} {bp.yieldUnit}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1.5">{bp.name}</h3>
                        <p className="text-xs text-slate-500">
                          Target Stok: <b className="text-slate-800">{target ? target.name : bp.targetIngredientName}</b>
                        </p>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBatchPrep(bp);
                              setIsBatchPrepModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                            title="Edit Resep Batch"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setBatchPrepToDelete(bp)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Hapus Resep Batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* STATUS STOK KONDIMEN SIAP PAKAI */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Stok Kondimen di Chiller / Bar:
                        </span>
                        <span className="font-bold text-slate-900 text-sm font-mono">
                          {target ? `${target.currentStock.toLocaleString("id-ID")} ${target.unit}` : "0"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Estimasi HPP Olahan:
                        </span>
                        <span className="font-bold text-brand-700 font-mono text-sm">
                          Rp {costPerUnit.toLocaleString("id-ID")} / {bp.yieldUnit}
                        </span>
                      </div>
                    </div>

                    {/* KOMPOSISI BAHAN MENTAH */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Komposisi Bahan Mentah per 1 Batch:
                      </span>
                      <div className="space-y-1">
                        {bpIngredients.map((ri, idx) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          const isShortage = ing && ing.currentStock < ri.quantity;

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-xl border flex justify-between items-center ${
                                isShortage ? "bg-rose-50/70 border-rose-200" : "bg-white border-slate-200/70"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">
                                  {ing ? ing.name : "Bahan Terhapus"}
                                </span>
                                <span className="font-mono text-slate-500 text-[11px]">
                                  {ri.quantity} {ing?.unit}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold ${
                                  isShortage ? "text-rose-700 font-mono" : "text-slate-400 font-mono"
                                }`}
                              >
                                Stok: {ing ? `${ing.currentStock} ${ing.unit}` : "0"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {bp.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-brand-50/50 p-2.5 rounded-xl border border-brand-100">
                        Catatan: {bp.notes}
                      </p>
                    )}
                  </div>

                  {/* ACTION COOK BUTTON */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[11px]">
                      {readiness.canCook ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Siap masak ({readiness.maxBatches}x batch tersedia)</span>
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Bahan kurang ({readiness.bottleneck})</span>
                        </span>
                      )}
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          setCookingBatchPrep(bp);
                          setCookMultiplier(1);
                          setCookNotes("");
                          setIsBatchCookModalOpen(true);
                        }}
                        disabled={!readiness.canCook}
                        className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-300" />
                        <span>Masak Batch Sekarang</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredBatchPreparations.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
                <Flame className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">
                  {batchPrepDivisionFilter === "ALL"
                    ? "Belum ada resep batch kondimen"
                    : `Belum ada resep batch kondimen di divisi ${batchPrepDivisionFilter}`}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {isReadOnly
                    ? "Belum ada resep batch yang sesuai filter saat ini."
                    : 'Tambahkan formula resep olahan batch baru dengan mengklik tombol "+ Resep Batch Baru" di atas.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: COOK BATCH MODAL (MASAK KONDIMEN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isBatchCookModalOpen && cookingBatchPrep && (() => {
              const cookIngredients = Array.isArray(cookingBatchPrep.ingredients)
                ? cookingBatchPrep.ingredients
                : [];
              const hasCookShortage = cookIngredients.some((ri) => {
                const ing = ingredients.find((i) => i.id === ri.ingredientId);
                return !ing || ing.currentStock < ri.quantity * cookMultiplier;
              });
              return (
                <motion.div
                  key="batch-cook-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setIsBatchCookModalOpen(false);
                  }}
                  className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
                >
                  <motion.div
                    key="batch-cook-card"
                    initial={{ scale: 0.96, opacity: 0, y: 12 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.96, opacity: 0, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    className="my-auto bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200/90 dark:border-slate-700 max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3.5">
                      <div>
                        <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider bg-brand-50 dark:bg-brand-500/15 px-2 py-0.5 rounded-md border border-brand-200/60 dark:border-brand-500/30">
                          Eksekusi Produksi Kondimen
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                          Masak: {cookingBatchPrep.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBatchCookModalOpen(false)}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* MULTIPLIER SLIDER & INPUT */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-800 dark:text-slate-200">Jumlah Batch yang Dimasak:</label>
                        <span className="font-mono font-black text-base text-brand-700 dark:text-brand-300 tabular-nums">
                          {cookMultiplier}x Batch
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={cookMultiplier}
                        onChange={(e) => setCookMultiplier(Number(e.target.value))}
                        className="w-full accent-brand-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span>Hasil Olahan:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                          +{(cookingBatchPrep.yieldQuantity * cookMultiplier).toLocaleString("id-ID")}{" "}
                          {cookingBatchPrep.yieldUnit}
                        </span>
                      </div>
                    </div>

                    {/* PREVIEW BAHAN YANG AKAN DIPOTONG */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Bahan Mentah yang Akan Dipotong Otomatis (USAGE):
                      </span>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
                        {cookIngredients.map((ri, idx) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          const needed = ri.quantity * cookMultiplier;
                          const isShortage = !ing || ing.currentStock < needed;

                          return (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                                isShortage
                                  ? "bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40"
                                  : "bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                  {ing ? ing.name : "Bahan Terhapus"}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  Stok Saat Ini: {ing ? `${ing.currentStock} ${ing.unit}` : 0}
                                </span>
                              </div>
                              <span className={`font-mono font-bold tabular-nums ${isShortage ? "text-rose-700 dark:text-rose-300" : "text-brand-700 dark:text-brand-300"}`}>
                                -{needed} {ing?.unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {hasCookShortage && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Stok bahan mentah belum cukup untuk {cookMultiplier}x batch. Turunkan pengali atau beli stok terlebih dahulu.</span>
                        </div>
                      )}
                    </div>

                    {/* CATATAN BATCH */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Catatan Masak / Shift (Opsional)
                      </label>
                      <input
                        type="text"
                        value={cookNotes}
                        onChange={(e) => setCookNotes(e.target.value)}
                        placeholder="e.g. Masak shift pagi, panci 5L, aroma wangi sempurna"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      />
                    </div>

                    {/* BUTTONS */}
                    <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsBatchCookModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={hasCookShortage || isReadOnly}
                        onClick={handleConfirmBatchCook}
                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        <Flame className="w-4 h-4 text-amber-300" />
                        <span>Konfirmasi & Potong Stok Sekarang</span>
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>,
          document.body
        )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: PRODUK MODAL (TAMBAH / EDIT PRODUK & VARIAN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        product={editingProduct}
        defaultDivision={activeTab === "BATCH_PREP" ? "BAR" : activeTab}
        ingredients={ingredients}
        recipes={recipes}
        menuCategoriesMap={settings?.menuCategories}
        onOpenCategoryManager={
          canManageMenuCategories ? (div) => handleOpenCategoryManager(div) : undefined
        }
        onSaveRecipe={addRecipe}
        onUpdateRecipe={updateRecipe}
        onNavigateHpp={canNavigateToHpp ? () => onNavigate?.("hpp_calculator") : undefined}
        onClose={() => setIsProductModalOpen(false)}
        onSave={(prodData) => {
          if (isReadOnly) return;
          if (editingProduct) {
            updateProduct({ ...editingProduct, ...prodData });
            showToast("success", `Produk "${prodData.name}" berhasil diperbarui.`);
          } else {
            addProduct(prodData);
            showToast("success", `Produk "${prodData.name}" berhasil dibuat.`);
          }
          setIsProductModalOpen(false);
        }}
      />

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: BATCH PREPARATION FORM MODAL (RESEP KONDIMEN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <BatchPrepFormModal
        isOpen={isBatchPrepModalOpen}
        batchPrep={editingBatchPrep}
        ingredients={ingredients}
        onClose={() => setIsBatchPrepModalOpen(false)}
        onSave={(bpData) => {
          if (isReadOnly) return;
          if (editingBatchPrep) {
            updateBatchPreparation({ ...editingBatchPrep, ...bpData });
            showToast("success", `Resep batch "${bpData.name}" diperbarui.`);
          } else {
            addBatchPreparation(bpData);
            showToast("success", `Resep batch "${bpData.name}" berhasil dibuat.`);
          }
          setIsBatchPrepModalOpen(false);
        }}
      />

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: KELOLA KATEGORI MENU (TAMBAH, EDIT, HAPUS PER DIVISI) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isCategoryManagerOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setIsCategoryManagerOpen(false);
                    setEditingMenuCatOld(null);
                    setEditingMenuCatNew("");
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="my-auto bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800"
                >
                  <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shrink-0">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                          Kelola Kategori Menu
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Tambah, ubah nama, atau hapus kategori menu per divisi. Perubahan otomatis menyinkronkan produk terkait.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryManagerOpen(false);
                        setEditingMenuCatOld(null);
                        setEditingMenuCatNew("");
                      }}
                      className="p-1.5 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-400 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs">
                    {/* Selector Divisi */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 gap-1">
                      {(
                        [
                          { id: "BAR", label: "Bar & Kopi" },
                          { id: "KITCHEN", label: "Kitchen" },
                          { id: "BAKER", label: "Bakery & Pastry" },
                        ] as const
                      ).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setCategoryManagerDivision(d.id);
                            setEditingMenuCatOld(null);
                            setEditingMenuCatNew("");
                          }}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            categoryManagerDivision === d.id
                              ? "bg-brand-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {/* Form Tambah Kategori */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddMenuCategory(newMenuCatName);
                      }}
                      className="flex items-center gap-2 p-3 rounded-2xl bg-brand-50/50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/30"
                    >
                      <input
                        type="text"
                        value={newMenuCatName}
                        onChange={(e) => setNewMenuCatName(e.target.value)}
                        placeholder={`Kategori baru divisi ${categoryManagerDivision} (mis. MATCHA, BENTO)...`}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 uppercase"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    </form>

                    {/* Daftar Kategori Menu */}
                    <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                      {modalDivisionCategories.length === 0 ? (
                        <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          Belum ada kategori menu di divisi ini. Tambahkan kategori baru di atas.
                        </div>
                      ) : (
                        modalDivisionCategories.map((catName) => {
                          const prodCount = products.filter(
                            (p) =>
                              p.division === categoryManagerDivision &&
                              String(p.category || "").trim().toUpperCase() === catName
                          ).length;
                          const isEditing = editingMenuCatOld === catName;
                          const isProtectedFallback = catName === "LAINNYA" && prodCount > 0;

                          return (
                            <div
                              key={catName}
                              className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700"
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={editingMenuCatNew}
                                    onChange={(e) => setEditingMenuCatNew(e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-brand-300 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveRenameMenuCategory(catName)}
                                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMenuCatOld(null);
                                      setEditingMenuCatNew("");
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="min-w-0">
                                    <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                      {catName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                      {prodCount} produk terdaftar
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMenuCatOld(catName);
                                        setEditingMenuCatNew(catName);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                      title="Ubah nama kategori"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {!isProtectedFallback && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMenuCatToDelete({
                                            division: categoryManagerDivision,
                                            name: catName,
                                          })
                                        }
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
                                        title="Hapus kategori"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ConfirmModal
        isOpen={Boolean(menuCatToDelete)}
        title="Hapus Kategori Menu?"
        message={`Kategori menu "${menuCatToDelete?.name || ""}" akan dihapus dari divisi ${menuCatToDelete?.division || ""}. Produk yang memakai kategori ini akan otomatis dipindahkan ke kategori "LAINNYA".`}
        confirmLabel="Hapus Kategori"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmDeleteMenuCategory}
        onCancel={() => setMenuCatToDelete(null)}
      />

      <ConfirmModal
        isOpen={Boolean(productToDelete)}
        title="Hapus Produk & Varian?"
        message={`Hapus produk "${productToDelete?.name || ""}" beserta seluruh varian dan resepnya dari Katalog Menu?`}
        confirmLabel="Ya, Hapus Produk"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (isReadOnly) return;
          if (productToDelete) {
            deleteProduct(productToDelete.id);
            showToast("success", `Produk "${productToDelete.name}" berhasil dihapus.`);
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />

      <ConfirmModal
        isOpen={Boolean(batchPrepToDelete)}
        title="Hapus Resep Batch?"
        message={`Hapus resep kondimen olahan "${batchPrepToDelete?.name || ""}"? Stok bahan jadi di inventori tidak akan ikut terhapus.`}
        confirmLabel="Ya, Hapus Resep"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (isReadOnly) return;
          if (batchPrepToDelete) {
            deleteBatchPreparation(batchPrepToDelete.id);
            showToast("success", `Resep batch "${batchPrepToDelete.name}" dihapus.`);
            setBatchPrepToDelete(null);
          }
        }}
        onCancel={() => setBatchPrepToDelete(null)}
      />
    </div>
  );
};

// ─── SUBCOMPONENT: PRODUCT FORM MODAL ────────────────────────────────────────
export interface ProductFormInitialDraft {
  name?: string;
  variantName?: string;
  price?: number;
  division?: ProductDivision;
  category?: string;
  productGroup?: string;
}

interface ProductFormModalProps {
  isOpen?: boolean;
  product: Product | null;
  defaultDivision: ProductDivision;
  ingredients: Ingredient[];
  recipes: Recipe[];
  menuCategoriesMap?: Partial<Record<ProductDivision, string[]>>;
  initialDraft?: ProductFormInitialDraft | null;
  onOpenCategoryManager?: (division: ProductDivision) => void;
  onSaveRecipe?: (recipe: Omit<Recipe, "id">) => void;
  onUpdateRecipe?: (recipe: Recipe) => void;
  onNavigateHpp?: () => void;
  onClose: () => void;
  onSave: (data: Omit<Product, "id" | "createdAt">) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen = true,
  product,
  defaultDivision,
  ingredients,
  recipes,
  menuCategoriesMap,
  initialDraft,
  onOpenCategoryManager,
  onSaveRecipe,
  onUpdateRecipe,
  onNavigateHpp,
  onClose,
  onSave,
}) => {
  const buildDefaultVariant = (div: ProductDivision): ProductVariant => ({
    id: `var-${Date.now()}-1`,
    productId: product?.id || "",
    name:
      initialDraft?.variantName ||
      (div === "BAR" ? "Iced 16oz" : "Reguler"),
    sku: "",
    price:
      initialDraft?.price && initialDraft.price > 0
        ? Math.round(initialDraft.price)
        : 22000,
    packagingCost: DEFAULT_DIVISION_PACKAGING[div][0]?.cost || 0,
    packagingNotes: DEFAULT_DIVISION_PACKAGING[div][0]?.name || "",
    estimatedHpp: initialDraft ? 0 : 7000,
    isAvailable: true,
    recipe: [],
  });

  const initialDivision: ProductDivision =
    product?.division || initialDraft?.division || defaultDivision;
  const initialCategory =
    product?.category ||
    initialDraft?.category ||
    (initialDivision === "BAR"
      ? "COFFEE"
      : initialDivision === "KITCHEN"
        ? "FOOD"
        : "BAKERY");

  const [name, setName] = useState(product?.name || initialDraft?.name || "");
  const [category, setCategory] = useState(initialCategory);
  const [division, setDivision] = useState<ProductDivision>(initialDivision);
  const [productGroup, setProductGroup] = useState<string>(
    inferProductGroup(
      initialDivision,
      initialCategory,
      product?.productGroup || initialDraft?.productGroup,
      initialDraft?.variantName
    )
  );
  const [description, setDescription] = useState(product?.description || "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (product?.variants && product.variants.length > 0) {
      return product.variants.map((v) => ({
        ...v,
        recipe: Array.isArray(v.recipe) ? v.recipe : [],
      }));
    }
    return [buildDefaultVariant(initialDivision)];
  });

  useEffect(() => {
    if (!isOpen) return;
    const nextDiv: ProductDivision =
      product?.division || initialDraft?.division || defaultDivision;
    const nextCat =
      product?.category ||
      initialDraft?.category ||
      getDivisionMenuCategories(nextDiv, menuCategoriesMap, [])[0] ||
      (nextDiv === "BAR" ? "COFFEE" : nextDiv === "KITCHEN" ? "FOOD" : "BAKERY");

    setName(product?.name || initialDraft?.name || "");
    setDivision(nextDiv);
    setCategory(nextCat);
    setProductGroup(
      inferProductGroup(
        nextDiv,
        nextCat,
        product?.productGroup || initialDraft?.productGroup,
        initialDraft?.variantName
      )
    );
    setDescription(product?.description || "");
    setIsActive(product?.isActive ?? true);
    if (product?.variants && product.variants.length > 0) {
      setVariants(
        product.variants.map((v) => ({
          ...v,
          recipe: Array.isArray(v.recipe) ? v.recipe : [],
        }))
      );
    } else {
      setVariants([buildDefaultVariant(nextDiv)]);
    }
  }, [isOpen, product, defaultDivision, initialDraft]);

  const stockPackagingIngredients = useMemo(
    () => ingredients.filter((ing) => isPackagingIngredient(ing)),
    [ingredients]
  );

  const recalculateVariantHpp = (v: ProductVariant): number => {
    const recList = Array.isArray(v.recipe) ? v.recipe : [];
    let rawCost = 0;
    let stockPackCost = 0;
    recList.forEach((ri) => {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      if (ing && ing.costPerUnit) {
        const lineCost = Number(ri.quantity || 0) * Number(ing.costPerUnit);
        if (isPackagingIngredient(ing)) {
          stockPackCost += lineCost;
        } else {
          rawCost += lineCost;
        }
      }
    });
    const effectivePackCost =
      stockPackCost > 0
        ? Math.max(stockPackCost, Number(v.packagingCost || 0))
        : Number(v.packagingCost || 0);
    if (rawCost <= 0 && effectivePackCost <= 0) {
      return Math.round(Number(v.estimatedHpp) || 0);
    }
    const baseCost = rawCost + effectivePackCost;
    const wastageCost = Math.round(baseCost * (Number(v.wastagePercent || 0) / 100));
    const overheadCost = Math.round(baseCost * (Number(v.overheadPercent || 0) / 100));
    return Math.round(baseCost + wastageCost + overheadCost);
  };

  const handleToggleVariantStockPackaging = (varIdx: number, packIng: Ingredient) => {
    const curVar = variants[varIdx];
    const currentRecipe = Array.isArray(curVar?.recipe) ? curVar.recipe : [];
    const exists = currentRecipe.some((ri) => ri.ingredientId === packIng.id);
    const nextRecipe = exists
      ? currentRecipe.filter((ri) => ri.ingredientId !== packIng.id)
      : [...currentRecipe, { ingredientId: packIng.id, quantity: 1 }];

    const linkedPacks = nextRecipe
      .map((ri) => ({
        ri,
        ing: ingredients.find((i) => i.id === ri.ingredientId),
      }))
      .filter((x): x is { ri: RecipeIngredient; ing: Ingredient } =>
        Boolean(x.ing && isPackagingIngredient(x.ing))
      );

    const stockPackCost = Math.round(
      linkedPacks.reduce(
        (sum, x) => sum + Number(x.ri.quantity || 1) * Number(x.ing.costPerUnit || 0),
        0
      )
    );
    const stockPackNotes = linkedPacks.map((x) => x.ing.name).join(" + ");

    handleUpdateVariant(
      varIdx,
      {
        recipe: nextRecipe,
        packagingCost: stockPackCost,
        packagingNotes: stockPackNotes,
      },
      true
    );
  };

  const handleAddVariant = () => {
    const newVar: ProductVariant = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product?.id || "",
      name: `Varian Baru ${variants.length + 1}`,
      sku: "",
      price: variants[0]?.price || 20000,
      packagingCost: 0,
      estimatedHpp: 0,
      isAvailable: true,
      recipe: [],
    };
    setVariants([...variants, newVar]);
  };

  const handleUpdateVariant = (idx: number, updates: Partial<ProductVariant>, autoHpp = false) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        const merged = { ...v, ...updates };
        if (autoHpp) {
          merged.estimatedHpp = recalculateVariantHpp(merged);
        }
        return merged;
      })
    );
  };

  const handleAddVariantIngredient = (varIdx: number) => {
    const curVar = variants[varIdx];
    const currentRecipe = Array.isArray(curVar?.recipe) ? curVar.recipe : [];
    const nextRecipe: RecipeIngredient[] = [
      ...currentRecipe,
      { ingredientId: "", quantity: 10 },
    ];
    handleUpdateVariant(varIdx, { recipe: nextRecipe }, true);
  };

  const handleUpdateVariantIngredient = (
    varIdx: number,
    ingIdx: number,
    patch: Partial<RecipeIngredient>
  ) => {
    const curVar = variants[varIdx];
    const currentRecipe = Array.isArray(curVar?.recipe) ? curVar.recipe : [];
    const nextRecipe = currentRecipe.map((ri, rIdx) =>
      rIdx === ingIdx ? { ...ri, ...patch } : ri
    );
    handleUpdateVariant(varIdx, { recipe: nextRecipe }, true);
  };

  const handleRemoveVariantIngredient = (varIdx: number, ingIdx: number) => {
    const curVar = variants[varIdx];
    const currentRecipe = Array.isArray(curVar?.recipe) ? curVar.recipe : [];
    const nextRecipe = currentRecipe.filter((_, rIdx) => rIdx !== ingIdx);
    handleUpdateVariant(varIdx, { recipe: nextRecipe }, true);
  };

  const handleRemoveVariant = (idx: number) => {
    if (variants.length <= 1) {
      toast.error("Produk harus memiliki minimal 1 varian.");
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama produk tidak boleh kosong.");
      return;
    }

    const cleanName = name.trim();
    const cleanedVariants = variants.map((v) => ({
      ...v,
      name: v.name.trim() || "Reguler",
      recipe: mergeDuplicateRecipeIngredients(v.recipe || []),
    }));

    const variantNames = cleanedVariants.map((v) => v.name.toLowerCase());
    if (new Set(variantNames).size !== variantNames.length) {
      toast.error("Nama varian dalam satu produk tidak boleh sama.");
      return;
    }

    if (onSaveRecipe || onUpdateRecipe) {
      cleanedVariants.forEach((v) => {
        if (!v.recipe || v.recipe.length === 0) return;
        const targetRecName =
          cleanedVariants.length === 1 && v.name.toLowerCase() === "reguler"
            ? cleanName
            : `${cleanName} - ${v.name}`;
        const existingRecipe = recipes.find(
          (r) =>
            r.menuName.trim().toLowerCase() === targetRecName.toLowerCase() ||
            (cleanedVariants.length === 1 &&
              r.menuName.trim().toLowerCase() === cleanName.toLowerCase())
        );
        if (existingRecipe) {
          onUpdateRecipe?.({
            ...existingRecipe,
            menuName: targetRecName,
            ingredients: v.recipe,
          });
        } else {
          onSaveRecipe?.({
            menuName: targetRecName,
            ingredients: v.recipe,
          });
        }
      });
    }

    onSave({
      name: cleanName,
      category: category.trim().toUpperCase(),
      productGroup: productGroup.trim().toUpperCase() || inferProductGroup(division, category),
      division,
      description: description.trim(),
      isActive,
      variants: cleanedVariants,
      modifierGroups: product?.modifierGroups || [],
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="product-form-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
        >
          <motion.div
            key="product-form-card"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            className="my-auto bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-3xl w-full max-h-[88vh] overflow-y-auto custom-scrollbar space-y-5 shadow-2xl border border-slate-200/90 dark:border-slate-800"
          >
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {product ? `Edit Produk: ${product.name}` : `Tambah Produk Baru (${division})`}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Atur divisi, kategori produk, kategori menu, daftar varian, harga jual, dan komposisi bahan resep.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Produk
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kopi Susu Gula Aren"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Divisi Dapur / Bar
              </label>
              <CustomSelect
                value={division}
                onChange={(val) => {
                  const nextDiv = val as ProductDivision;
                  setDivision(nextDiv);
                  const nextCats = getDivisionMenuCategories(nextDiv, menuCategoriesMap, []);
                  let nextCat = category;
                  if (
                    !product &&
                    nextCats.length > 0 &&
                    !nextCats.includes(category.trim().toUpperCase())
                  ) {
                    nextCat = nextCats[0];
                    setCategory(nextCat);
                  }
                  if (!product?.productGroup) {
                    setProductGroup(inferProductGroup(nextDiv, nextCat));
                  }
                }}
                options={[
                  { value: "BAR", label: "☕ Divisi Bar & Minuman" },
                  { value: "KITCHEN", label: "🍳 Divisi Kitchen & Makanan" },
                  { value: "BAKER", label: "🥐 Divisi Bakery & Pastry" },
                ]}
                buttonClassName="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kategori Produk
              </label>
              <CustomSelect
                value={productGroup}
                onChange={setProductGroup}
                options={PRODUCT_GROUP_OPTIONS.map((grp) => ({
                  value: grp,
                  label: PRODUCT_GROUP_LABELS[grp] || grp,
                }))}
                buttonClassName="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kategori Menu
              </label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. COFFEE, SIGNATURE, FOOD"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status Publikasi
              </label>
              <CustomSelect
                value={isActive ? "true" : "false"}
                onChange={(val) => setIsActive(val === "true")}
                options={[
                  { value: "true", label: "Aktif (Tampil di Katalog Menu)" },
                  { value: "false", label: "Nonaktif (Draft / Sembunyikan)" },
                ]}
                buttonClassName="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-white"
              />
            </div>
          </div>

          {/* Preset Cepat Kategori Menu */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-1">
              Saran Kategori Menu:
            </span>
            {getDivisionMenuCategories(division, menuCategoriesMap, []).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setCategory(preset);
                  if (!product?.productGroup) {
                    setProductGroup(inferProductGroup(division, preset));
                  }
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  category.trim().toUpperCase() === preset
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300"
                }`}
              >
                {preset}
              </button>
            ))}
            {onOpenCategoryManager && (
              <button
                type="button"
                onClick={() => onOpenCategoryManager(division)}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Edit2 className="w-2.5 h-2.5" />
                <span>Kelola Kategori</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan aroma, cita rasa, atau keistimewaan sajian..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>

          {/* VARIAN BUILDER + INLINE RESEP BAHAN BAKU */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Daftar Varian, Harga Jual &amp; Bahan Resep
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Setiap varian (Hot / Iced / Size / Kemasan) punya harga jual, kemasan, dan takaran bahan sendiri.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Varian</span>
              </button>
            </div>

            <div className="space-y-3">
              {variants.map((v, idx) => {
                const variantRecipes = Array.isArray(v.recipe) ? v.recipe : [];
                let rawMaterialCost = 0;
                let stockPackCostInRecipe = 0;
                variantRecipes.forEach((ri) => {
                  const ing = ingredients.find((i) => i.id === ri.ingredientId);
                  if (ing && ing.costPerUnit) {
                    const line = Number(ri.quantity || 0) * Number(ing.costPerUnit);
                    if (isPackagingIngredient(ing)) {
                      stockPackCostInRecipe += line;
                    } else {
                      rawMaterialCost += line;
                    }
                  }
                });
                const displayPackCost =
                  stockPackCostInRecipe > 0
                    ? Math.max(stockPackCostInRecipe, Number(v.packagingCost || 0))
                    : Number(v.packagingCost || 0);
                const estHpp = Math.round(Number(v.estimatedHpp) || 0);
                const grossProfit = Math.round((Number(v.price) || 0) - estHpp);
                const marginPct =
                  Number(v.price) > 0 ? (grossProfit / Number(v.price)) * 100 : 0;

                return (
                  <div
                    key={v.id || idx}
                    className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Varian #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${
                            marginPct >= 60
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                              : marginPct >= 35
                                ? "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                          }`}
                        >
                          Laba: {formatCurrency(grossProfit)} ({marginPct.toFixed(1)}%)
                        </span>
                        {variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Hapus Varian"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Nama Varian
                        </label>
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => handleUpdateVariant(idx, { name: e.target.value })}
                          placeholder="e.g. Iced 16oz, Hot 8oz"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Harga Jual Resmi (Rp)
                        </label>
                        <CurrencyInput
                          value={v.price}
                          onValueChange={(_, num) => handleUpdateVariant(idx, { price: num })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Estimasi Total HPP (Rp)
                        </label>
                        <CurrencyInput
                          value={v.estimatedHpp || 0}
                          onValueChange={(_, num) =>
                            handleUpdateVariant(idx, { estimatedHpp: num })
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-bold font-mono text-brand-700 dark:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Catatan Kemasan / Disposables
                        </label>
                        <input
                          type="text"
                          value={v.packagingNotes || ""}
                          onChange={(e) =>
                            handleUpdateVariant(idx, { packagingNotes: e.target.value })
                          }
                          placeholder="e.g. Cup 16oz + Lid + Sedotan"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Biaya Kemasan (Rp)
                        </label>
                        <CurrencyInput
                          value={v.packagingCost || 0}
                          onValueChange={(_, newPackCost) =>
                            handleUpdateVariant(idx, { packagingCost: newPackCost }, true)
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Pilih Kemasan langsung dari Stok Gudang (Packaging & Cup) */}
                    {stockPackagingIngredients.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-brand-50/40 dark:bg-brand-500/10 border border-brand-200/60 dark:border-brand-500/30 space-y-1.5">
                        <span className="text-[10px] font-bold text-brand-800 dark:text-brand-300 block">
                          Pilih Kemasan dari Stok Gudang (Packaging &amp; Cup — ikut terpotong saat terjual):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {stockPackagingIngredients.map((packIng) => {
                            const isSelected = variantRecipes.some(
                              (ri) => ri.ingredientId === packIng.id
                            );
                            return (
                              <button
                                key={packIng.id}
                                type="button"
                                onClick={() =>
                                  handleToggleVariantStockPackaging(idx, packIng)
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer tabular-nums ${
                                  isSelected
                                    ? "bg-brand-600 text-white border-brand-600"
                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-brand-300"
                                }`}
                              >
                                {isSelected ? "✓ " : "+ "}
                                {packIng.name} ({formatCurrency(packIng.costPerUnit)} • Sisa{" "}
                                {Number(packIng.currentStock || 0).toLocaleString("id-ID")}{" "}
                                {packIng.unit})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Penyusutan / Wastage (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={v.wastagePercent ?? 0}
                          onChange={(e) =>
                            handleUpdateVariant(
                              idx,
                              { wastagePercent: Math.max(0, Number(e.target.value) || 0) },
                              true
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Overhead Operasional (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={v.overheadPercent ?? 0}
                          onChange={(e) =>
                            handleUpdateVariant(
                              idx,
                              { overheadPercent: Math.max(0, Number(e.target.value) || 0) },
                              true
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-mono font-bold text-brand-700 dark:text-brand-300"
                        />
                      </div>
                    </div>

                    {/* Komposisi Bahan Baku Langsung untuk Varian Ini */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block">
                            Komposisi Bahan Baku &amp; Takaran Resep
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            HPP Bahan:{" "}
                            <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                              {formatCurrency(Math.round(rawMaterialCost))}
                            </strong>{" "}
                            + Kemasan:{" "}
                            <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                              {formatCurrency(displayPackCost)}
                            </strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddVariantIngredient(idx)}
                          className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Tambah Bahan</span>
                        </button>
                      </div>

                      {variantRecipes.length === 0 ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                          Belum ada bahan dipilih. Klik "+ Tambah Bahan" atau tautkan master resep di bawah.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {variantRecipes.map((ri, ingIdx) => {
                            const selectedIng = ingredients.find(
                              (i) => i.id === ri.ingredientId
                            );
                            const lineCost = selectedIng
                              ? Math.round(
                                  Number(ri.quantity || 0) *
                                    Number(selectedIng.costPerUnit || 0)
                                )
                              : 0;
                            return (
                              <div
                                key={`${v.id}-ing-${ingIdx}`}
                                className="flex flex-col sm:flex-row sm:items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700"
                              >
                                <div className="flex-1 min-w-0">
                                  <CustomSelect
                                    searchable
                                    value={ri.ingredientId}
                                    onChange={(val) =>
                                      handleUpdateVariantIngredient(idx, ingIdx, {
                                        ingredientId: val,
                                      })
                                    }
                                    placeholder="-- Pilih Bahan Baku --"
                                    options={[
                                      { value: "", label: "-- Pilih Bahan Baku --" },
                                      ...ingredients.map((ing) => ({
                                        value: ing.id,
                                        label: `${ing.name} (${formatCurrency(ing.costPerUnit)}/${ing.unit})`,
                                      })),
                                    ]}
                                    buttonClassName="w-full text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <CurrencyInput
                                    allowDecimals
                                    emptyWhenZero
                                    value={ri.quantity}
                                    onValueChange={(_, num) =>
                                      handleUpdateVariantIngredient(idx, ingIdx, {
                                        quantity: Math.max(0, num),
                                      })
                                    }
                                    className="w-20 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-xs text-slate-900 dark:text-slate-100"
                                  />
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[34px]">
                                    {selectedIng?.unit || "unit"}
                                  </span>
                                  <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 min-w-[70px] text-right tabular-nums">
                                    {formatCurrency(lineCost)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveVariantIngredient(idx, ingIdx)
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="Hapus Bahan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Tautkan ke Master Resep Toko */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-slate-200/60">
                      <div className="flex-1 w-full sm:w-auto">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                          Atau Salin Dari Master Resep Toko (Opsional):
                        </label>
                        <CustomSelect
                          searchable
                          value={
                            recipes.find(
                              (r) =>
                                JSON.stringify(r.ingredients) ===
                                  JSON.stringify(v.recipe) ||
                                r.menuName.toLowerCase() === v.name.toLowerCase()
                            )?.id || ""
                          }
                          onChange={(val) => {
                            const picked = recipes.find((r) => r.id === val);
                            if (picked) {
                              const validList = mergeDuplicateRecipeIngredients(
                                parseRecipeIngredientsSafe(picked.ingredients)
                              );
                              const linkedPacks = validList
                                .map((ri) => ({
                                  ri,
                                  ing: ingredients.find((i) => i.id === ri.ingredientId),
                                }))
                                .filter((x): x is { ri: RecipeIngredient; ing: Ingredient } =>
                                  Boolean(x.ing && isPackagingIngredient(x.ing))
                                );
                              if (linkedPacks.length > 0) {
                                const packCost = Math.round(
                                  linkedPacks.reduce(
                                    (sum, x) =>
                                      sum +
                                      Number(x.ri.quantity || 1) * Number(x.ing.costPerUnit || 0),
                                    0
                                  )
                                );
                                handleUpdateVariant(
                                  idx,
                                  {
                                    recipe: validList,
                                    packagingCost: packCost,
                                    packagingNotes: linkedPacks.map((x) => x.ing.name).join(" + "),
                                  },
                                  true
                                );
                              } else {
                                handleUpdateVariant(idx, { recipe: validList }, true);
                              }
                            }
                          }}
                          placeholder="-- Pilih Resep Toko (Opsional) --"
                          options={[
                            { value: "", label: "-- Pilih Resep Toko (Opsional) --" },
                            ...recipes.map((r) => {
                              const rIngCount = parseRecipeIngredientsSafe(r.ingredients).length;
                              return {
                                value: r.id,
                                label: `${r.menuName} (${rIngCount} bahan baku)`,
                              };
                            }),
                          ]}
                          buttonClassName="w-full text-base sm:text-xs font-semibold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 hover:bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-[11px] pt-1 sm:pt-0">
                        {v.recipe && v.recipe.length > 0 ? (
                          <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-lg font-bold border border-emerald-200 dark:border-emerald-500/30 text-[10px]">
                            ✅ {v.recipe.length} bahan terhubung
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg font-medium text-[10px]">
                            Resep belum ditautkan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-brand-600/20 cursor-pointer active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Produk, Varian &amp; Resep</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ─── SUBCOMPONENT: BATCH PREP FORM MODAL ──────────────────────────────────────
interface BatchPrepFormModalProps {
  isOpen: boolean;
  batchPrep: BatchPreparation | null;
  ingredients: any[];
  onClose: () => void;
  onSave: (data: Omit<BatchPreparation, "id">) => void;
}

const BatchPrepFormModal: React.FC<BatchPrepFormModalProps> = ({
  isOpen,
  batchPrep,
  ingredients,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(batchPrep?.name || "");
  const [division, setDivision] = useState<ProductDivision>(batchPrep?.division || "BAR");
  const [targetIngredientId, setTargetIngredientId] = useState(batchPrep?.targetIngredientId || "");
  const [targetIngredientName, setTargetIngredientName] = useState(batchPrep?.targetIngredientName || "");
  const [yieldQuantity, setYieldQuantity] = useState(batchPrep?.yieldQuantity || 1200);
  const [yieldUnit, setYieldUnit] = useState(batchPrep?.yieldUnit || "ml");
  const [notes, setNotes] = useState(batchPrep?.notes || "");
  const [recipeItems, setRecipeItems] = useState<RecipeIngredient[]>(
    batchPrep?.ingredients || [{ ingredientId: ingredients[0]?.id || "", quantity: 1000 }]
  );

  useEffect(() => {
    if (!isOpen) return;
    setName(batchPrep?.name || "");
    setDivision(batchPrep?.division || "BAR");
    setTargetIngredientId(batchPrep?.targetIngredientId || "");
    setTargetIngredientName(batchPrep?.targetIngredientName || "");
    setYieldQuantity(batchPrep?.yieldQuantity || 1200);
    setYieldUnit(batchPrep?.yieldUnit || "ml");
    setNotes(batchPrep?.notes || "");
    setRecipeItems(
      Array.isArray(batchPrep?.ingredients) && batchPrep.ingredients.length > 0
        ? batchPrep.ingredients
        : [{ ingredientId: ingredients[0]?.id || "", quantity: 1000 }]
    );
  }, [isOpen, batchPrep]);

  const handleAddIngredient = () => {
    setRecipeItems([...recipeItems, { ingredientId: ingredients[0]?.id || "", quantity: 100 }]);
  };

  const handleUpdateIngredient = (idx: number, updates: Partial<RecipeIngredient>) => {
    setRecipeItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  };

  const handleRemoveIngredient = (idx: number) => {
    if (recipeItems.length <= 1) {
      toast.error("Minimal harus ada 1 bahan baku.");
      return;
    }
    setRecipeItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBatchPrepSubmission({
      name,
      targetIngredientId,
      targetIngredientName,
      yieldQuantity,
      ingredients: recipeItems,
    });
    if ("error" in validation) {
      toast.error(validation.error);
      return;
    }

    onSave({
      name: name.trim(),
      division,
      targetIngredientId: targetIngredientId || `ing-custom-${Date.now()}`,
      targetIngredientName: targetIngredientName.trim() || name.trim(),
      yieldQuantity: Number(yieldQuantity),
      yieldUnit: yieldUnit.trim() || "ml",
      ingredients: validation.mergedIngredients,
      notes: notes.trim(),
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="batch-prep-form-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
        >
          <motion.div
            key="batch-prep-form-card"
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            className="my-auto bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-xl w-full max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar space-y-5 shadow-2xl border border-slate-200/90 dark:border-slate-700"
          >
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                    {batchPrep ? `Edit Resep Batch: ${batchPrep.name}` : "Resep Batch Kondimen Baru"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                    Formula pengolahan bahan mentah menjadi kondimen olahan (Saus Aren, Sirup, dll).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Divisi Penanggung Jawab Olahan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDivision("BAR")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      division === "BAR"
                        ? "bg-brand-50 dark:bg-brand-500/20 border-brand-300 dark:border-brand-500/40 text-brand-800 dark:text-brand-200 font-black shadow-2xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                    <span>Bar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDivision("KITCHEN")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      division === "KITCHEN"
                        ? "bg-brand-50 dark:bg-brand-500/20 border-brand-300 dark:border-brand-500/40 text-brand-800 dark:text-brand-200 font-black shadow-2xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                    <span>Kitchen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDivision("BAKER")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      division === "BAKER"
                        ? "bg-brand-50 dark:bg-brand-500/20 border-brand-300 dark:border-brand-500/40 text-brand-800 dark:text-brand-200 font-black shadow-2xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Cake className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                    <span>Bakery</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Resep Olahan
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!targetIngredientName) setTargetIngredientName(e.target.value);
                  }}
                  placeholder="e.g. Saus Gula Aren Racikan, Simple Syrup Bar"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Bahan di Inventori
                  </label>
                  <CustomSelect
                    value={targetIngredientId}
                    onChange={(val) => {
                      setTargetIngredientId(val);
                      const sel = ingredients.find((i) => i.id === val);
                      if (sel) {
                        setTargetIngredientName(sel.name);
                        setYieldUnit(sel.unit);
                      }
                    }}
                    placeholder="-- Buat Bahan Jadi Baru --"
                    options={[
                      { value: "", label: "-- Buat Bahan Jadi Baru --" },
                      ...ingredients.map((ing) => ({
                        value: ing.id,
                        label: `${ing.name} (${ing.unit}) - Stok: ${ing.currentStock}`,
                      })),
                    ]}
                    buttonClassName="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Bahan Jadi Jika Baru
                  </label>
                  <input
                    type="text"
                    value={targetIngredientName}
                    onChange={(e) => setTargetIngredientName(e.target.value)}
                    placeholder="e.g. Gula Aren Cair Racikan"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Yield Hasil Olahan per 1 Batch
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-bold font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Satuan Hasil
                  </label>
                  <input
                    type="text"
                    required
                    value={yieldUnit}
                    onChange={(e) => setYieldUnit(e.target.value)}
                    placeholder="ml / gr / porsi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              {/* BAHAN MENTAH ROWS */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Bahan Mentah yang Dimasak
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                    <span>Tambah Bahan</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeItems.map((item, idx) => {
                    const selectedIng = ingredients.find((i) => i.id === item.ingredientId);

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-2 text-xs"
                      >
                        <div className="flex-1 w-full">
                          <CustomSelect
                            value={item.ingredientId}
                            onChange={(val) => handleUpdateIngredient(idx, { ingredientId: val })}
                            options={ingredients.map((ing) => ({
                              value: ing.id,
                              label: `${ing.name} (${ing.unit}) - Rp ${ing.costPerUnit || 0}/${ing.unit}`,
                            }))}
                            buttonClassName="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="flex items-center gap-2 justify-between sm:justify-end">
                          <div className="w-28 flex items-center gap-1">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateIngredient(idx, { quantity: Number(e.target.value) })
                              }
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base sm:text-xs font-bold font-mono text-right text-slate-900 dark:text-slate-100 tabular-nums"
                            />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold shrink-0">
                              {selectedIng?.unit || "satuan"}
                            </span>
                          </div>

                          {recipeItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Panduan Memasak / Suhu / Waktu Simpan
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Masak api kecil 25 menit, saring halus, simpan di chiller 4°C maksimal 14 hari."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>Simpan Resep Batch</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
