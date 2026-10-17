import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
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
    currentUser,
    isReadOnly,
  } = useStore();

  const [activeTab, setActiveTab] = useState<ProductDivision | "BATCH_PREP">("BAR");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

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
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // ─── Filtered Products ─────────────────────────────────────────────────────
  const currentDivisionProducts = useMemo(() => {
    if (activeTab === "BATCH_PREP") return [];
    return products.filter((p) => p.division === activeTab);
  }, [products, activeTab]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    currentDivisionProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [currentDivisionProducts]);

  const filteredProducts = useMemo(() => {
    return currentDivisionProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = selectedCategory === "ALL" || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [currentDivisionProducts, searchTerm, selectedCategory]);

  const filteredBatchPreparations = useMemo(() => {
    return batchPreparations.filter((bp) => {
      if (batchPrepDivisionFilter !== "ALL" && bp.division !== batchPrepDivisionFilter) return false;
      if (searchTerm) {
        const matchName = bp.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchTarget = (bp.targetIngredientName || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchName && !matchTarget) return false;
      }
      return true;
    });
  }, [batchPreparations, batchPrepDivisionFilter, searchTerm]);

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

    return {
      totalProducts: currentDivisionProducts.length,
      totalVariants: allVariants.length,
      avgMargin: Math.round(avgMargin * 10) / 10,
      avgFoodCost: Math.round(avgFoodCost * 10) / 10,
    };
  }, [currentDivisionProducts]);

  // ─── Live Stock Availability Helper ────────────────────────────────────────
  const calculateVariantStockAvailability = (variant: ProductVariant, productName?: string) => {
    let effectiveRecipe = variant.recipe;
    if (!effectiveRecipe || effectiveRecipe.length === 0) {
      if (productName) {
        const fallbackRec = recipes.find(
          (r) => r.menuName.trim().toLowerCase() === productName.trim().toLowerCase()
        );
        if (fallbackRec) {
          effectiveRecipe = fallbackRec.ingredients;
        }
      }
    }

    if (!effectiveRecipe || effectiveRecipe.length === 0) {
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
    let maxBatches = Infinity;
    let bottleneckIng: string | null = null;

    for (const ri of bp.ingredients) {
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
    let updatedProductsCount = 0;
    let updatedVariantsCount = 0;

    products.forEach((p) => {
      let isProductChanged = false;
      const updatedVariants = (p.variants || []).map((v) => {
        let effectiveRecipe = v.recipe;
        if (!effectiveRecipe || effectiveRecipe.length === 0) {
          const rec = recipes.find(
            (r) => r.menuName.trim().toLowerCase() === p.name.trim().toLowerCase()
          );
          if (rec) effectiveRecipe = rec.ingredients;
        }

        if (!effectiveRecipe || effectiveRecipe.length === 0) return v;

        let rawCost = 0;
        for (const ri of effectiveRecipe) {
          const ing = ingredients.find((i) => i.id === ri.ingredientId);
          if (ing && ing.costPerUnit) {
            rawCost += ri.quantity * Number(ing.costPerUnit);
          }
        }

        const newEstimatedHpp = Math.round(rawCost + Number(v.packagingCost || 0));
        if (newEstimatedHpp !== v.estimatedHpp || (!v.recipe?.length && effectiveRecipe.length > 0)) {
          isProductChanged = true;
          updatedVariantsCount++;
          return {
            ...v,
            recipe: v.recipe?.length ? v.recipe : effectiveRecipe,
            estimatedHpp: newEstimatedHpp,
          };
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold border ${
              feedbackMessage.type === "success"
                ? "bg-emerald-950 text-emerald-100 border-emerald-700"
                : "bg-red-950 text-red-100 border-red-700"
            }`}
          >
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <span className="whitespace-pre-line">{feedbackMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
              Supply Chain & Menu Engineering
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Katalog Menu & Dapur Olahan
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 max-w-2xl mt-1">
            Kelola produk resmi, varian takaran, HPP riil, dan jadwal masak kondimen olahan (batch prep) per divisi toko.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleBulkRecalculateHpp}
            className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-2xl text-xs transition-colors flex items-center gap-2 border border-amber-300 shadow-2xs"
            title="Hitung ulang estimasi HPP seluruh produk berdasarkan harga bahan baku dan kemasan terbaru di inventori"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
            Sinkronkan HPP Terkini
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate("hpp_calculator")}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs transition-colors flex items-center gap-2 border border-stone-200"
            >
              <Calculator className="w-4 h-4 text-amber-700" />
              Kalkulator HPP
            </button>
          )}

          {activeTab === "BATCH_PREP" ? (
            <button
              onClick={() => {
                setEditingBatchPrep(null);
                setIsBatchPrepModalOpen(true);
              }}
              className="px-4 py-2.5 bg-[#241813] hover:bg-[#38261e] text-white font-bold rounded-2xl text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              + Resep Batch Kondimen
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-2xl text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              + Produk {activeTab} Baru
            </button>
          )}
        </div>
      </div>

      {/* DIVISION TABS */}
      <div className="flex border-b border-stone-200 gap-2 sm:gap-4 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => {
            setActiveTab("BAR");
            setSelectedCategory("ALL");
          }}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "BAR"
              ? "border-amber-700 text-amber-800"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Coffee className="w-4 h-4" />
          Divisi Bar & Kopi
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
            {products.filter((p) => p.division === "BAR").length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("KITCHEN");
            setSelectedCategory("ALL");
          }}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "KITCHEN"
              ? "border-amber-700 text-amber-800"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          Divisi Kitchen & Makanan
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
            {products.filter((p) => p.division === "KITCHEN").length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("BAKER");
            setSelectedCategory("ALL");
          }}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "BAKER"
              ? "border-amber-700 text-amber-800"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Cake className="w-4 h-4" />
          Divisi Bakery & Pastry
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
            {products.filter((p) => p.division === "BAKER").length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("BATCH_PREP");
            setSelectedCategory("ALL");
          }}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "BATCH_PREP"
              ? "border-[#241813] text-[#241813]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Flame className="w-4 h-4 text-amber-600" />
          Dapur Olahan (Batch Cook / Sub-Recipes)
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono font-bold">
            {batchPreparations.length}
          </span>
        </button>
      </div>

      {/* METRIC STRIP (For Products) */}
      {activeTab !== "BATCH_PREP" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Total Menu Produk
            </span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
              {metrics.totalProducts} <span className="text-xs font-normal text-stone-500">menu</span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Total Varian Jual
            </span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 mt-1 font-mono">
              {metrics.totalVariants} <span className="text-xs font-normal text-stone-500">sku</span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Rata-rata Margin
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 font-mono">
              {metrics.avgMargin}%
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Rata-rata Food Cost
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-800 mt-1 font-mono">
              {metrics.avgFoodCost}%
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PRODUCTS (BAR / KITCHEN / BAKER) */}
      {activeTab !== "BATCH_PREP" && (
        <div className="space-y-4">
          {/* SEARCH & CATEGORY FILTER */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari menu, rasa, kategori..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                  selectedCategory === "ALL"
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                Semua
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-amber-700 text-white border-amber-700"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* PRODUCT CARDS LIST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-coffee-sm hover:shadow-coffee transition-shadow space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 uppercase tracking-wide">
                          {product.category}
                        </span>
                        {!product.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-stone-900 mt-1">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setIsProductModalOpen(true);
                        }}
                        className="p-1.5 text-stone-400 hover:text-amber-800 hover:bg-stone-100 rounded-lg transition-colors"
                        title="Edit Produk & Varian"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus produk "${product.name}" beserta variannya?`)) {
                            deleteProduct(product.id);
                            showToast("success", `Produk "${product.name}" berhasil dihapus.`);
                          }
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus Produk"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* VARIAN LIST */}
                  <div className="mt-3.5 space-y-2.5">
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                      Varian & Harga Jual ({product.variants?.length || 0})
                    </span>

                    {product.variants?.map((variant) => {
                      const avail = calculateVariantStockAvailability(variant, product.name);
                      const hpp = variant.estimatedHpp || 0;
                      const profit = Math.max(0, variant.price - hpp);
                      const marginPct = variant.price > 0 ? (profit / variant.price) * 100 : 0;

                      return (
                        <div
                          key={variant.id}
                          className="p-3 rounded-2xl bg-stone-50/70 border border-stone-200/70 space-y-2 text-xs"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-stone-900 flex items-center gap-2">
                                <span>{variant.name}</span>
                                {variant.sku && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200 text-stone-600">
                                    {variant.sku}
                                  </span>
                                )}
                              </div>
                              {variant.packagingNotes && (
                                <span className="text-[10px] text-stone-400 block mt-0.5">
                                  Kemasan: {variant.packagingNotes} (Rp {variant.packagingCost || 0})
                                </span>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="font-black text-sm text-stone-900 font-mono">
                                {formatCurrency(variant.price)}
                              </span>
                              <div className="text-[10px] font-bold text-emerald-700">
                                Margin: {marginPct.toFixed(0)}% (+{formatCurrency(profit)})
                              </div>
                            </div>
                          </div>

                          {/* Live Availability Badge */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/60 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              {avail.status === "ready" && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-stone-600 font-medium">
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
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className="text-red-700 font-bold">
                                    Stok Habis: {avail.bottleneck}
                                  </span>
                                </>
                              )}
                            </div>

                            <span className="text-[10px] text-stone-400 font-mono">
                              HPP: {formatCurrency(hpp)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* MODIFIERS PREVIEW IF ANY */}
                  {product.modifierGroups && product.modifierGroups.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-bold text-stone-400">Modifier:</span>
                      {product.modifierGroups.map((g) => (
                        <span
                          key={g.id}
                          className="text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg"
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
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
                <Coffee className="w-10 h-10 text-stone-300 mx-auto" />
                <h4 className="text-sm font-bold text-stone-700">Belum ada produk di divisi {activeTab}</h4>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  Tambahkan produk baru dengan mengklik tombol "+ Produk {activeTab} Baru" di atas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: BATCH PREP (DAPUR OLAHAN / KONDIMEN) */}
      {activeTab === "BATCH_PREP" && (
        <div className="space-y-6">
          {/* BANNER PENJELASAN */}
          <div className="p-5 sm:p-6 bg-[#241813] text-white rounded-3xl border border-stone-800 shadow-coffee space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Flame className="w-4 h-4" />
              Batch Preparation & Sub-Recipes Kitchen/Bar
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Sistem Otomatisasi Masak Kondimen & Potong Stok Bahan Mentah
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 max-w-3xl leading-relaxed">
              Kondimen seperti <b>Saus Gula Aren Racikan, Simple Syrup, Cold Brew Concentrate,</b> dan <b>Sambal Matah</b> dimasak dari kombinasi bahan baku mentah. Saat staf menekan <i>"Masak Batch Sekarang"</i>, sistem otomatis memotong stok bahan mentah dan menambah stok kondimen dengan harga HPP tertimbang yang akurat.
            </p>
          </div>

          {/* DIVISION SUB-TABS FILTER */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setBatchPrepDivisionFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                batchPrepDivisionFilter === "ALL"
                  ? "bg-stone-900 text-white border-stone-900 shadow-2xs"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              Semua Olahan ({batchPreparations.length})
            </button>
            <button
              onClick={() => setBatchPrepDivisionFilter("BAR")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                batchPrepDivisionFilter === "BAR"
                  ? "bg-amber-800 text-white border-amber-800 shadow-2xs font-extrabold"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              Olahan Bar ({batchPreparations.filter((b) => b.division === "BAR").length})
            </button>
            <button
              onClick={() => setBatchPrepDivisionFilter("KITCHEN")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                batchPrepDivisionFilter === "KITCHEN"
                  ? "bg-orange-800 text-white border-orange-800 shadow-2xs font-extrabold"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              Olahan Kitchen ({batchPreparations.filter((b) => b.division === "KITCHEN").length})
            </button>
            <button
              onClick={() => setBatchPrepDivisionFilter("BAKER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                batchPrepDivisionFilter === "BAKER"
                  ? "bg-yellow-800 text-white border-yellow-800 shadow-2xs font-extrabold"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <Cake className="w-3.5 h-3.5" />
              Olahan Bakery ({batchPreparations.filter((b) => b.division === "BAKER").length})
            </button>
          </div>

          {/* BATCH PREP CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredBatchPreparations.map((bp) => {
              const target = ingredients.find((i) => i.id === bp.targetIngredientId);
              const readiness = calculateBatchPrepReadiness(bp);

              // Hitung total cost bahan baku per 1 batch
              const totalCostPerBatch = bp.ingredients.reduce((sum, ri) => {
                const ing = ingredients.find((i) => i.id === ri.ingredientId);
                return sum + ri.quantity * (ing?.costPerUnit || 0);
              }, 0);

              const costPerUnit = bp.yieldQuantity > 0 ? Math.round(totalCostPerBatch / bp.yieldQuantity) : 0;

              return (
                <div
                  key={bp.id}
                  className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-coffee-sm hover:shadow-coffee transition-shadow space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              bp.division === "BAR"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : bp.division === "KITCHEN"
                                ? "bg-orange-100 text-orange-900 border-orange-300"
                                : "bg-yellow-100 text-yellow-900 border-yellow-300"
                            }`}
                          >
                            {bp.division === "BAR" ? "☕ Bar" : bp.division === "KITCHEN" ? "🍳 Kitchen" : "🥐 Bakery"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-mono border border-stone-200">
                            1 BATCH = {bp.yieldQuantity.toLocaleString("id-ID")} {bp.yieldUnit}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-stone-900 mt-1">{bp.name}</h3>
                        <p className="text-xs text-stone-500">
                          Target Stok: <b className="text-stone-800">{target ? target.name : bp.targetIngredientName}</b>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingBatchPrep(bp);
                            setIsBatchPrepModalOpen(true);
                          }}
                          className="p-1.5 text-stone-400 hover:text-amber-800 hover:bg-stone-100 rounded-lg transition-colors"
                          title="Edit Resep Batch"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Hapus resep batch "${bp.name}"?`)) {
                              deleteBatchPreparation(bp.id);
                              showToast("success", `Resep batch "${bp.name}" dihapus.`);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Resep Batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* STATUS STOK KONDIMEN SIAP PAKAI */}
                    <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                          Stok Kondimen di Chiller / Bar:
                        </span>
                        <span className="font-bold text-stone-900 text-sm font-mono">
                          {target ? `${target.currentStock.toLocaleString("id-ID")} ${target.unit}` : "0"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                          Estimasi HPP Olahan:
                        </span>
                        <span className="font-bold text-amber-900 font-mono text-sm">
                          Rp {costPerUnit.toLocaleString("id-ID")} / {bp.yieldUnit}
                        </span>
                      </div>
                    </div>

                    {/* KOMPOSISI BAHAN MENTAH */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                        Komposisi Bahan Mentah per 1 Batch:
                      </span>
                      <div className="space-y-1">
                        {bp.ingredients.map((ri, idx) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          const isShortage = ing && ing.currentStock < ri.quantity;

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-xl border flex justify-between items-center ${
                                isShortage ? "bg-red-50/50 border-red-200" : "bg-white border-stone-100"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-stone-800">
                                  {ing ? ing.name : "Bahan Terhapus"}
                                </span>
                                <span className="font-mono text-stone-500 text-[11px]">
                                  {ri.quantity} {ing?.unit}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold ${
                                  isShortage ? "text-red-700" : "text-stone-400"
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
                      <p className="text-[11px] text-stone-500 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50">
                        Catatan: {bp.notes}
                      </p>
                    )}
                  </div>

                  {/* ACTION COOK BUTTON */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                    <div className="text-[11px]">
                      {readiness.canCook ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Siap masak (Bahan cukup untuk {readiness.maxBatches}x batch)
                        </span>
                      ) : (
                        <span className="text-red-700 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          Bahan mentah kurang ({readiness.bottleneck})
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setCookingBatchPrep(bp);
                        setCookMultiplier(1);
                        setCookNotes("");
                        setIsBatchCookModalOpen(true);
                      }}
                      disabled={!readiness.canCook}
                      className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-300" />
                      Masak Batch Sekarang
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredBatchPreparations.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
                <Flame className="w-10 h-10 text-stone-300 mx-auto" />
                <h4 className="text-sm font-bold text-stone-700">
                  {batchPrepDivisionFilter === "ALL"
                    ? "Belum ada resep batch kondimen"
                    : `Belum ada resep batch kondimen di divisi ${batchPrepDivisionFilter}`}
                </h4>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  Tambahkan formula resep olahan batch baru dengan mengklik tombol "+ Resep Batch Baru" di atas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: COOK BATCH MODAL (MASAK KONDIMEN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isBatchCookModalOpen && cookingBatchPrep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl border border-stone-200"
            >
              <div className="flex justify-between items-start border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-md">
                    Eksekusi Produksi Kondimen
                  </span>
                  <h3 className="text-lg font-black text-stone-900 mt-1">
                    Masak: {cookingBatchPrep.name}
                  </h3>
                </div>
                <button
                  onClick={() => setIsBatchCookModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MULTIPLIER SLIDER & INPUT */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-stone-800">Jumlah Batch yang Dimasak:</label>
                  <span className="font-mono font-black text-base text-amber-900">
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
                  className="w-full accent-amber-700"
                />
                <div className="flex justify-between text-[11px] text-stone-500 font-medium">
                  <span>Hasil Olahan:</span>
                  <span className="font-bold text-stone-900 font-mono">
                    +{(cookingBatchPrep.yieldQuantity * cookMultiplier).toLocaleString("id-ID")}{" "}
                    {cookingBatchPrep.yieldUnit}
                  </span>
                </div>
              </div>

              {/* PREVIEW BAHAN YANG AKAN DIPOTONG */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Bahan Mentah yang Akan Dipotong Otomatis (USAGE):
                </span>
                <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {cookingBatchPrep.ingredients.map((ri, idx) => {
                    const ing = ingredients.find((i) => i.id === ri.ingredientId);
                    const needed = ri.quantity * cookMultiplier;
                    const isShortage = ing && ing.currentStock < needed;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                          isShortage ? "bg-red-50 border-red-300" : "bg-stone-50/70 border-stone-200"
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-stone-900 block">
                            {ing ? ing.name : "Bahan Terhapus"}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            Stok Saat Ini: {ing ? `${ing.currentStock} ${ing.unit}` : 0}
                          </span>
                        </div>
                        <span className={`font-mono font-bold ${isShortage ? "text-red-700" : "text-amber-900"}`}>
                          -{needed} {ing?.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CATATAN BATCH */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Catatan Masak / Shift (Opsional)
                </label>
                <input
                  type="text"
                  value={cookNotes}
                  onChange={(e) => setCookNotes(e.target.value)}
                  placeholder="e.g. Masak shift pagi, panci 5L, aroma wangi sempurna"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsBatchCookModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchCook}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  Konfirmasi & Potong Stok Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: PRODUK MODAL (TAMBAH / EDIT PRODUK & VARIAN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isProductModalOpen && (
          <ProductFormModal
            product={editingProduct}
            defaultDivision={activeTab === "BATCH_PREP" ? "BAR" : activeTab}
            ingredients={ingredients}
            recipes={recipes}
            onNavigateHpp={onNavigate ? () => onNavigate("hpp_calculator") : undefined}
            onClose={() => setIsProductModalOpen(false)}
            onSave={(prodData) => {
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
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: BATCH PREPARATION FORM MODAL (RESEP KONDIMEN) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isBatchPrepModalOpen && (
          <BatchPrepFormModal
            batchPrep={editingBatchPrep}
            ingredients={ingredients}
            onClose={() => setIsBatchPrepModalOpen(false)}
            onSave={(bpData) => {
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
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── SUBCOMPONENT: PRODUCT FORM MODAL ────────────────────────────────────────
interface ProductFormModalProps {
  product: Product | null;
  defaultDivision: ProductDivision;
  ingredients: any[];
  recipes: Recipe[];
  onNavigateHpp?: () => void;
  onClose: () => void;
  onSave: (data: Omit<Product, "id" | "createdAt">) => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  defaultDivision,
  ingredients,
  recipes,
  onNavigateHpp,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || (defaultDivision === "BAR" ? "COFFEE" : defaultDivision === "KITCHEN" ? "FOOD" : "BAKERY"));
  const [division, setDivision] = useState<ProductDivision>(product?.division || defaultDivision);
  const [description, setDescription] = useState(product?.description || "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (product?.variants && product.variants.length > 0) {
      return product.variants;
    }
    return [
      {
        id: `var-${Date.now()}-1`,
        productId: product?.id || "",
        name: division === "BAR" ? "Iced 16oz" : "Reguler",
        sku: "",
        price: 22000,
        packagingCost: DEFAULT_DIVISION_PACKAGING[division][0]?.cost || 0,
        packagingNotes: DEFAULT_DIVISION_PACKAGING[division][0]?.name || "",
        estimatedHpp: 7000,
        isAvailable: true,
        recipe: [],
      },
    ];
  });

  const handleAddVariant = () => {
    const newVar: ProductVariant = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product?.id || "",
      name: `Varian Baru ${variants.length + 1}`,
      sku: "",
      price: 20000,
      packagingCost: 0,
      estimatedHpp: 6000,
      isAvailable: true,
      recipe: [],
    };
    setVariants([...variants, newVar]);
  };

  const handleUpdateVariant = (idx: number, updates: Partial<ProductVariant>) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...updates } : v)));
  };

  const handleRemoveVariant = (idx: number) => {
    if (variants.length <= 1) {
      alert("Produk harus memiliki minimal 1 varian.");
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Nama produk tidak boleh kosong.");
      return;
    }

    onSave({
      name: name.trim(),
      category: category.trim().toUpperCase(),
      division,
      description: description.trim(),
      isActive,
      variants,
      modifierGroups: product?.modifierGroups || [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar space-y-5 shadow-2xl border border-stone-200"
      >
        <div className="flex justify-between items-start border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-black text-stone-900">
              {product ? `Edit Produk: ${product.name}` : `Tambah Produk Baru (${division})`}
            </h3>
            <p className="text-xs text-stone-500">
              Atur nama, divisi, kategori, dan daftar varian harga jual resmi toko.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Nama Produk</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kopi Susu Gula Aren"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Kategori Menu</label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. COFFEE, NON-COFFEE, FOOD"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Divisi Dapur/Bar</label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as ProductDivision)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              >
                <option value="BAR">☕ Divisi Bar & Minuman</option>
                <option value="KITCHEN">🍳 Divisi Kitchen & Makanan</option>
                <option value="BAKER">🥐 Divisi Bakery & Pastry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Status Publikasi</label>
              <select
                value={isActive ? "true" : "false"}
                onChange={(e) => setIsActive(e.target.value === "true")}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              >
                <option value="true">Aktif (Tampil di Menu Kasir)</option>
                <option value="false">Nonaktif (Draft / Sembunyikan)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Deskripsi Singkat</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan aroma, cita rasa, atau keistimewaan sajian..."
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
            />
          </div>

          {/* VARIAN BUILDER */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Daftar Varian & Harga Jual
                </h4>
                <p className="text-[11px] text-stone-500">
                  Setiap varian (Hot/Ice/Size/Portion) memiliki harga dan packaging sendiri.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-amber-700" />
                Tambah Varian
              </button>
            </div>

            <div className="space-y-2.5">
              {variants.map((v, idx) => (
                <div
                  key={v.id || idx}
                  className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-700">Varian #{idx + 1}</span>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="text-stone-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                        Nama Varian
                      </label>
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => handleUpdateVariant(idx, { name: e.target.value })}
                        placeholder="e.g. Iced 16oz, Hot 8oz"
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                        Harga Jual Resmi (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={v.price}
                        onChange={(e) => handleUpdateVariant(idx, { price: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold font-mono text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                        Estimasi Total HPP (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={v.estimatedHpp || 0}
                        onChange={(e) =>
                          handleUpdateVariant(idx, { estimatedHpp: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold font-mono text-amber-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                        Catatan Kemasan / Disposables
                      </label>
                      <input
                        type="text"
                        value={v.packagingNotes || ""}
                        onChange={(e) => handleUpdateVariant(idx, { packagingNotes: e.target.value })}
                        placeholder="e.g. Cup 16oz + Lid + Sedotan"
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                        Biaya Kemasan (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={v.packagingCost || 0}
                        onChange={(e) => {
                          const newPackCost = Number(e.target.value);
                          // Recalculate HPP if recipe exists
                          let rawCost = 0;
                          if (v.recipe && v.recipe.length > 0) {
                            v.recipe.forEach((ri) => {
                              const ing = ingredients.find((i) => i.id === ri.ingredientId);
                              if (ing && ing.costPerUnit) rawCost += ri.quantity * Number(ing.costPerUnit);
                            });
                          }
                          handleUpdateVariant(idx, {
                            packagingCost: newPackCost,
                            estimatedHpp: rawCost > 0 ? Math.round(rawCost + newPackCost) : v.estimatedHpp,
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Tautkan ke Master Resep Toko */}
                  <div className="pt-2 border-t border-stone-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/70 p-2 rounded-xl">
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                        Tautkan Resep Master (Pengurangan Stok Otomatis):
                      </label>
                      <select
                        value={
                          recipes.find(
                            (r) =>
                              JSON.stringify(r.ingredients) === JSON.stringify(v.recipe) ||
                              r.menuName.toLowerCase() === v.name.toLowerCase()
                          )?.id || ""
                        }
                        onChange={(e) => {
                          const picked = recipes.find((r) => r.id === e.target.value);
                          if (picked) {
                            let rawCost = 0;
                            picked.ingredients.forEach((ri) => {
                              const ing = ingredients.find((i) => i.id === ri.ingredientId);
                              if (ing && ing.costPerUnit) rawCost += ri.quantity * Number(ing.costPerUnit);
                            });
                            handleUpdateVariant(idx, {
                              recipe: picked.ingredients,
                              estimatedHpp: Math.round(rawCost + Number(v.packagingCost || 0)),
                            });
                          }
                        }}
                        className="w-full text-xs font-semibold px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:bg-white"
                      >
                        <option value="">-- Pilih Resep Toko (Opsional) --</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.menuName} ({r.ingredients.length} bahan baku)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-[11px] pt-1 sm:pt-0">
                      {v.recipe && v.recipe.length > 0 ? (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-bold border border-emerald-200 text-[10px]">
                          ✅ {v.recipe.length} bahan terhubung
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-stone-100 text-stone-500 rounded-lg font-medium text-[10px]">
                          Resep belum ditautkan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Simpan Produk & Varian
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── SUBCOMPONENT: BATCH PREP FORM MODAL ──────────────────────────────────────
interface BatchPrepFormModalProps {
  batchPrep: BatchPreparation | null;
  ingredients: any[];
  onClose: () => void;
  onSave: (data: Omit<BatchPreparation, "id">) => void;
}

const BatchPrepFormModal: React.FC<BatchPrepFormModalProps> = ({
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

  const handleAddIngredient = () => {
    setRecipeItems([...recipeItems, { ingredientId: ingredients[0]?.id || "", quantity: 100 }]);
  };

  const handleUpdateIngredient = (idx: number, updates: Partial<RecipeIngredient>) => {
    setRecipeItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  };

  const handleRemoveIngredient = (idx: number) => {
    if (recipeItems.length <= 1) {
      alert("Minimal harus ada 1 bahan baku.");
      return;
    }
    setRecipeItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Nama resep batch tidak boleh kosong.");
      return;
    }
    if (!targetIngredientId && !targetIngredientName.trim()) {
      alert("Pilih atau masukkan nama target bahan hasil olahan.");
      return;
    }

    onSave({
      name: name.trim(),
      division,
      targetIngredientId: targetIngredientId || `ing-custom-${Date.now()}`,
      targetIngredientName: targetIngredientName.trim() || name.trim(),
      yieldQuantity: Number(yieldQuantity),
      yieldUnit: yieldUnit.trim(),
      ingredients: recipeItems.filter((ri) => ri.ingredientId && ri.quantity > 0),
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar space-y-5 shadow-2xl border border-stone-200"
      >
        <div className="flex justify-between items-start border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-black text-stone-900">
              {batchPrep ? `Edit Resep Batch: ${batchPrep.name}` : "Resep Batch Kondimen Baru"}
            </h3>
            <p className="text-xs text-stone-500">
              Formula pengolahan bahan mentah menjadi kondimen olahan (Saus Aren, Sirup, dll).
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Divisi Penanggung Jawab Olahan
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDivision("BAR")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  division === "BAR"
                    ? "bg-amber-100 border-amber-400 text-amber-950 font-black shadow-2xs"
                    : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Coffee className="w-3.5 h-3.5 text-amber-700" />
                Divisi Bar
              </button>
              <button
                type="button"
                onClick={() => setDivision("KITCHEN")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  division === "KITCHEN"
                    ? "bg-amber-100 border-amber-400 text-amber-950 font-black shadow-2xs"
                    : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" />
                Divisi Kitchen
              </button>
              <button
                type="button"
                onClick={() => setDivision("BAKER")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  division === "BAKER"
                    ? "bg-amber-100 border-amber-400 text-amber-950 font-black shadow-2xs"
                    : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Cake className="w-3.5 h-3.5 text-amber-700" />
                Divisi Bakery
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
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
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Target Bahan di Inventori
              </label>
              <select
                value={targetIngredientId}
                onChange={(e) => {
                  setTargetIngredientId(e.target.value);
                  const sel = ingredients.find((i) => i.id === e.target.value);
                  if (sel) {
                    setTargetIngredientName(sel.name);
                    setYieldUnit(sel.unit);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              >
                <option value="">-- Buat Bahan Jadi Baru --</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit}) - Stok: {ing.currentStock}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Nama Bahan Jadi Jika Baru
              </label>
              <input
                type="text"
                value={targetIngredientName}
                onChange={(e) => setTargetIngredientName(e.target.value)}
                placeholder="e.g. Gula Aren Cair Racikan"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Yield Hasil Olahan per 1 Batch
              </label>
              <input
                type="number"
                required
                min="1"
                value={yieldQuantity}
                onChange={(e) => setYieldQuantity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Satuan Hasil
              </label>
              <input
                type="text"
                required
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                placeholder="ml / gr / porsi"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
              />
            </div>
          </div>

          {/* BAHAN MENTAH ROWS */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Bahan Mentah yang Dimasak
              </span>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-amber-700" />
                Tambah Bahan
              </button>
            </div>

            <div className="space-y-2">
              {recipeItems.map((item, idx) => {
                const selectedIng = ingredients.find((i) => i.id === item.ingredientId);

                return (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center gap-2 text-xs"
                  >
                    <div className="flex-1">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => handleUpdateIngredient(idx, { ingredientId: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit}) - Rp {ing.costPerUnit || 0}/{ing.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28 flex items-center gap-1">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateIngredient(idx, { quantity: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold font-mono text-right"
                      />
                      <span className="text-[10px] text-stone-500 font-bold">
                        {selectedIng?.unit || "satuan"}
                      </span>
                    </div>

                    {recipeItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(idx)}
                        className="p-1 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Panduan Memasak / Suhu / Waktu Simpan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Masak api kecil 25 menit, saring halus, simpan di chiller 4°C maksimal 14 hari."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#241813] hover:bg-[#38261e] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4 text-amber-400" />
              Simpan Resep Batch
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
