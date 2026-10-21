import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import {
  ViewState,
  Recipe,
  Ingredient,
  ProductDivision,
  DEFAULT_DIVISION_PACKAGING,
} from "../types";
import {
  Calculator,
  TrendingUp,
  Sparkles,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Package,
  Coffee,
  ArrowRight,
  Sliders,
  Coins,
  Percent,
  Scale,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  UtensilsCrossed,
  Cake,
  Flame,
  Info,
  DollarSign,
  Layers,
  ChefHat,
  ArrowUpRight,
  ShieldCheck,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HppCalculatorProps {
  onNavigate?: (view: ViewState) => void;
}

interface RecipeIngredientItem {
  id: string;
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
}

interface PackagingOption {
  id: string;
  name: string;
  cost: number;
  isIncluded: boolean;
}

const PRICE_PRESETS = [15000, 18000, 20000, 22000, 25000, 28000, 32000, 35000];

interface StandardRecipePreset {
  id: string;
  name: string;
  division: ProductDivision;
  category: string;
  servingNote: string;
  targetPrice: number;
  targetFoodCost: number;
  icon: string;
  ingredients: {
    matchKeywords: string[];
    fallbackName: string;
    quantity: number;
    unit: string;
    defaultCost: number;
  }[];
  includedPackagingKeywords: string[];
}

const STANDARD_RECIPE_PRESETS: StandardRecipePreset[] = [
  {
    id: "preset-kopsus-aren",
    name: "Kopi Susu Gula Aren",
    division: "BAR",
    category: "COFFEE",
    servingNote: "Cup 16oz Dingin (Ice)",
    targetPrice: 22000,
    targetFoodCost: 28,
    icon: "☕",
    ingredients: [
      {
        matchKeywords: ["beans", "espresso", "biji", "kopi"],
        fallbackName: "Espresso Beans House Blend",
        quantity: 18,
        unit: "gr",
        defaultCost: 250,
      },
      {
        matchKeywords: ["milk", "susu", "fresh milk", "uht"],
        fallbackName: "Fresh Milk UHT",
        quantity: 120,
        unit: "ml",
        defaultCost: 18.5,
      },
      {
        matchKeywords: ["aren", "gula aren", "brown sugar"],
        fallbackName: "Saus Gula Aren Racikan",
        quantity: 25,
        unit: "ml",
        defaultCost: 38,
      },
      {
        matchKeywords: ["es", "ice", "kristal"],
        fallbackName: "Es Batu Kristal Tube",
        quantity: 150,
        unit: "gr",
        defaultCost: 2,
      },
    ],
    includedPackagingKeywords: ["cup", "sedotan", "seal"],
  },
  {
    id: "preset-caffe-latte",
    name: "Caffe Latte",
    division: "BAR",
    category: "COFFEE",
    servingNote: "Hot 8oz / Iced 12oz",
    targetPrice: 28000,
    targetFoodCost: 25,
    icon: "🥛",
    ingredients: [
      {
        matchKeywords: ["beans", "espresso", "biji", "kopi"],
        fallbackName: "Espresso Beans House Blend",
        quantity: 18,
        unit: "gr",
        defaultCost: 250,
      },
      {
        matchKeywords: ["milk", "susu", "fresh milk", "uht"],
        fallbackName: "Fresh Milk UHT",
        quantity: 160,
        unit: "ml",
        defaultCost: 18.5,
      },
    ],
    includedPackagingKeywords: ["cup", "lid"],
  },
  {
    id: "preset-americano",
    name: "Iced Americano",
    division: "BAR",
    category: "COFFEE",
    servingNote: "Cup 12oz Dingin",
    targetPrice: 18000,
    targetFoodCost: 18,
    icon: "🧊",
    ingredients: [
      {
        matchKeywords: ["beans", "espresso", "biji", "kopi"],
        fallbackName: "Espresso Beans House Blend",
        quantity: 18,
        unit: "gr",
        defaultCost: 250,
      },
      {
        matchKeywords: ["air", "water", "galon", "ro"],
        fallbackName: "Air Bersih RO",
        quantity: 180,
        unit: "ml",
        defaultCost: 0.5,
      },
      {
        matchKeywords: ["es", "ice", "kristal"],
        fallbackName: "Es Batu Kristal Tube",
        quantity: 120,
        unit: "gr",
        defaultCost: 2,
      },
    ],
    includedPackagingKeywords: ["cup", "sedotan", "seal"],
  },
  {
    id: "preset-matcha-latte",
    name: "Kyoto Matcha Latte",
    division: "BAR",
    category: "NON-COFFEE",
    servingNote: "Cup 16oz Dingin",
    targetPrice: 30000,
    targetFoodCost: 28,
    icon: "🍵",
    ingredients: [
      {
        matchKeywords: ["matcha", "powder", "teh"],
        fallbackName: "Powder Pure Matcha",
        quantity: 15,
        unit: "gr",
        defaultCost: 450,
      },
      {
        matchKeywords: ["milk", "susu", "fresh milk", "uht"],
        fallbackName: "Fresh Milk UHT",
        quantity: 140,
        unit: "ml",
        defaultCost: 18.5,
      },
      {
        matchKeywords: ["simple", "syrup", "gula", "pemanis"],
        fallbackName: "Simple Syrup (1:1)",
        quantity: 20,
        unit: "ml",
        defaultCost: 12,
      },
      {
        matchKeywords: ["es", "ice", "kristal"],
        fallbackName: "Es Batu Kristal Tube",
        quantity: 120,
        unit: "gr",
        defaultCost: 2,
      },
    ],
    includedPackagingKeywords: ["cup", "sedotan", "seal"],
  },
  {
    id: "preset-croissant",
    name: "Butter Croissant Artisanal",
    division: "BAKER",
    category: "BAKERY",
    servingNote: "Pcs Panggang Hangat",
    targetPrice: 25000,
    targetFoodCost: 32,
    icon: "🥐",
    ingredients: [
      {
        matchKeywords: ["croissant", "adonan", "dough"],
        fallbackName: "Dough Croissant Butter 70g",
        quantity: 1,
        unit: "pcs",
        defaultCost: 6500,
      },
      {
        matchKeywords: ["butter", "mentega"],
        fallbackName: "French Pure Butter",
        quantity: 15,
        unit: "gr",
        defaultCost: 140,
      },
    ],
    includedPackagingKeywords: ["paper bag", "bag", "plastik"],
  },
  {
    id: "preset-rice-bowl-ayam",
    name: "Rice Bowl Ayam Sambal Matah",
    division: "KITCHEN",
    category: "FOOD",
    servingNote: "Porsi Bowl Dine-In / Takeaway",
    targetPrice: 35000,
    targetFoodCost: 32,
    icon: "🍳",
    ingredients: [
      {
        matchKeywords: ["beras", "nasi", "rice"],
        fallbackName: "Beras Pulen Pandan Wangi",
        quantity: 100,
        unit: "gr",
        defaultCost: 16,
      },
      {
        matchKeywords: ["ayam", "chicken", "daging"],
        fallbackName: "Daging Ayam Fillet Paha",
        quantity: 120,
        unit: "gr",
        defaultCost: 58,
      },
      {
        matchKeywords: ["sambal", "matah"],
        fallbackName: "Sambal Matah Matang",
        quantity: 30,
        unit: "gr",
        defaultCost: 48,
      },
      {
        matchKeywords: ["minyak", "oil"],
        fallbackName: "Minyak Kelapa Asli",
        quantity: 10,
        unit: "ml",
        defaultCost: 32,
      },
    ],
    includedPackagingKeywords: ["paper box", "box", "lunch box", "sendok"],
  },
];

export const HppCalculator: React.FC<HppCalculatorProps> = ({ onNavigate }) => {
  const {
    ingredients,
    recipes,
    addRecipe,
    updateRecipe,
    products,
    addProduct,
    updateProduct,
    batchPreparations,
    addBatchPreparation,
    currentUser,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"simulator" | "catalog">("simulator");

  // Division & Form State
  const [selectedDivision, setSelectedDivision] = useState<ProductDivision>("BAR");
  const [menuName, setMenuName] = useState("Kopi Susu Gula Aren");
  const [servingNote, setServingNote] = useState("Cup 16oz Dingin (Ice)");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");

  // Publish & Batch Modals
  const [isPublishProductModalOpen, setIsPublishProductModalOpen] = useState(false);
  const [publishCategory, setPublishCategory] = useState("COFFEE");
  const [isBatchPrepModalOpen, setIsBatchPrepModalOpen] = useState(false);
  const [batchYieldQty, setBatchYieldQty] = useState(1200);
  const [batchYieldUnit, setBatchYieldUnit] = useState("ml");

  // Recipe Items
  const [items, setItems] = useState<RecipeIngredientItem[]>([
    {
      id: "item-1",
      ingredientId: "ing-coffee-beans",
      name: "House Blend Espresso Beans",
      quantity: 18,
      unit: "gr",
      costPerUnit: 250,
    },
    {
      id: "item-2",
      ingredientId: "ing-fresh-milk",
      name: "Fresh Milk UHT Greenfields",
      quantity: 120,
      unit: "ml",
      costPerUnit: 18.5,
    },
    {
      id: "item-3",
      ingredientId: "ing-aren-cair",
      name: "Gula Aren Cair Racikan",
      quantity: 25,
      unit: "ml",
      costPerUnit: 38,
    },
    {
      id: "item-4",
      ingredientId: "ing-ice-cube",
      name: "Es Batu Kristal Tube",
      quantity: 150,
      unit: "gr",
      costPerUnit: 2,
    },
  ]);

  // Packaging & Disposables
  const [packagingList, setPackagingList] = useState<PackagingOption[]>(() =>
    DEFAULT_DIVISION_PACKAGING["BAR"].map((p) => ({ ...p, isIncluded: Boolean(p.isIncluded) }))
  );

  const handleDivisionChange = (div: ProductDivision) => {
    setSelectedDivision(div);
    if (DEFAULT_DIVISION_PACKAGING[div]) {
      setPackagingList(
        DEFAULT_DIVISION_PACKAGING[div].map((p) => ({ ...p, isIncluded: Boolean(p.isIncluded) }))
      );
    }
  };

  // Grouped ingredients by category for clean dropdown selection
  const groupedIngredients = useMemo(() => {
    const groups: Record<string, Ingredient[]> = {};
    ingredients.forEach((ing) => {
      const cat = ing.category?.trim() || "Lainnya";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ing);
    });
    return groups;
  }, [ingredients]);

  // Terapkan preset resep standar kafe
  const handleApplyPreset = (preset: StandardRecipePreset) => {
    setSelectedDivision(preset.division);
    setMenuName(preset.name);
    setServingNote(preset.servingNote);
    setPublishCategory(preset.category);
    setTargetSellingPrice(preset.targetPrice);
    setTargetFoodCostPercent(preset.targetFoodCost);
    setSelectedRecipeId("");

    // Setup packaging options for this division
    const defaultPacks = DEFAULT_DIVISION_PACKAGING[preset.division] || [];
    setPackagingList(
      defaultPacks.map((p) => {
        const isMatched = preset.includedPackagingKeywords.some((kw) =>
          p.name.toLowerCase().includes(kw.toLowerCase())
        );
        return {
          ...p,
          isIncluded: isMatched,
        };
      })
    );

    // Map ingredients from store matching keywords
    const mappedItems: RecipeIngredientItem[] = preset.ingredients.map((item, idx) => {
      const matchedIng = ingredients.find((ing) => {
        const lowerName = ing.name.toLowerCase();
        const lowerCat = (ing.category || "").toLowerCase();
        return item.matchKeywords.some(
          (kw) => lowerName.includes(kw.toLowerCase()) || lowerCat.includes(kw.toLowerCase())
        );
      });

      if (matchedIng) {
        return {
          id: `item-${Date.now()}-${idx}`,
          ingredientId: matchedIng.id,
          name: matchedIng.name,
          quantity: item.quantity,
          unit: matchedIng.unit,
          costPerUnit: Number(matchedIng.costPerUnit || item.defaultCost),
        };
      }

      return {
        id: `item-${Date.now()}-${idx}`,
        ingredientId: "",
        name: item.fallbackName,
        quantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.defaultCost,
      };
    });

    setItems(mappedItems);
    setSaveSuccessMessage(`Preset resep "${preset.name}" berhasil diterapkan!`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Buffer Wastage & Purge (%)
  const [wastagePercent, setWastagePercent] = useState<number>(5);

  // Pricing & Margin Simulation
  const [targetSellingPrice, setTargetSellingPrice] = useState<number>(22000);
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState<number>(30);
  const [dailyVolume, setDailyVolume] = useState<number>(65);

  // Search filter for catalog tab
  const [catalogSearch, setCatalogSearch] = useState("");

  // Feedback & AI States
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Sinkronisasi saat memilih resep eksisting toko
  const handleLoadExistingRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    if (!recipeId) return;

    const r = recipes.find((rec) => rec.id === recipeId);
    if (!r) return;

    setMenuName(r.menuName);

    // Map ingredients from store
    const mappedItems: RecipeIngredientItem[] = r.ingredients.map((ri, idx) => {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      return {
        id: `item-${Date.now()}-${idx}`,
        ingredientId: ri.ingredientId,
        name: ing ? ing.name : "Bahan Terhapus",
        quantity: ri.quantity,
        unit: ing ? ing.unit : "satuan",
        costPerUnit: ing ? Number(ing.costPerUnit || 0) : 0,
      };
    });

    if (mappedItems.length > 0) {
      setItems(mappedItems);
    }
    setSaveSuccessMessage(`Berhasil memuat resep "${r.menuName}"`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Tambah baris bahan baru
  const handleAddItem = () => {
    const firstUnused = ingredients.find((i) => !items.some((it) => it.ingredientId === i.id)) || ingredients[0];
    const newItem: RecipeIngredientItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ingredientId: firstUnused ? firstUnused.id : "",
      name: firstUnused ? firstUnused.name : "Bahan Baru",
      quantity: 1,
      unit: firstUnused ? firstUnused.unit : "satuan",
      costPerUnit: firstUnused ? Number(firstUnused.costPerUnit || 0) : 0,
    };
    setItems([...items, newItem]);
  };

  // Update item baris
  const handleUpdateItem = (id: string, updates: Partial<RecipeIngredientItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (updates.ingredientId !== undefined && updates.ingredientId !== item.ingredientId) {
          const ing = ingredients.find((i) => i.id === updates.ingredientId);
          return {
            ...item,
            ...updates,
            name: ing ? ing.name : item.name,
            unit: ing ? ing.unit : item.unit,
            costPerUnit: ing ? Number(ing.costPerUnit || 0) : item.costPerUnit,
          };
        }

        return { ...item, ...updates };
      })
    );
  };

  // Hapus baris bahan
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Toggle Packaging
  const handleTogglePackaging = (id: string) => {
    setPackagingList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isIncluded: !p.isIncluded } : p))
    );
  };

  const handleUpdatePackagingCost = (id: string, cost: number) => {
    setPackagingList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, cost: Math.max(0, cost) } : p))
    );
  };

  // ─── Kalkulasi Finansial & HPP ───────────────────────────────────────────
  const rawMaterialCost = useMemo(() => {
    return items.reduce((sum, it) => sum + it.quantity * it.costPerUnit, 0);
  }, [items]);

  const packagingCost = useMemo(() => {
    return packagingList
      .filter((p) => p.isIncluded)
      .reduce((sum, p) => sum + p.cost, 0);
  }, [packagingList]);

  const baseHppBeforeWastage = rawMaterialCost + packagingCost;

  const wastageCost = useMemo(() => {
    return Math.round(baseHppBeforeWastage * (wastagePercent / 100));
  }, [baseHppBeforeWastage, wastagePercent]);

  const totalHpp = useMemo(() => {
    return Math.round(baseHppBeforeWastage + wastageCost);
  }, [baseHppBeforeWastage, wastageCost]);

  // Margin & Food Cost
  const grossProfit = Math.max(0, targetSellingPrice - totalHpp);
  const grossMarginPercent = targetSellingPrice > 0 ? (grossProfit / targetSellingPrice) * 100 : 0;
  const foodCostPercent = targetSellingPrice > 0 ? (totalHpp / targetSellingPrice) * 100 : 0;

  // Rekomendasi Harga dari Target Food Cost (dibulatkan ke kelipatan Rp 500)
  const recommendedSellingPrice = useMemo(() => {
    if (targetFoodCostPercent <= 0 || totalHpp <= 0) return 0;
    const rawPrice = totalHpp / (targetFoodCostPercent / 100);
    return Math.ceil(rawPrice / 500) * 500;
  }, [totalHpp, targetFoodCostPercent]);

  // Proyeksi Volume
  const dailyGrossProfit = grossProfit * dailyVolume;
  const monthlyGrossProfit = dailyGrossProfit * 30;

  // Status Kesehatan Food Cost
  const healthStatus = useMemo(() => {
    if (foodCostPercent <= 0) {
      return {
        level: "neutral",
        badge: "Belum Dihitung",
        colorText: "text-slate-500",
        colorBg: "bg-slate-100",
        colorBorder: "border-slate-200",
        barColor: "bg-slate-300",
        note: "Masukkan harga jual untuk melihat persentase food cost.",
      };
    }
    if (foodCostPercent <= 30) {
      return {
        level: "healthy",
        badge: "Sangat Sehat & Prima (Ideal)",
        colorText: "text-emerald-700",
        colorBg: "bg-emerald-50/80",
        colorBorder: "border-emerald-200",
        barColor: "bg-emerald-500",
        note: "Persentase food cost <= 30% sangat ideal untuk kafe. Menyisakan margin yang luas untuk menutup biaya operasional dan menghasilkan laba bersih.",
      };
    }
    if (foodCostPercent <= 38) {
      return {
        level: "warning",
        badge: "Waspada / Sedang (Moderat)",
        colorText: "text-amber-800",
        colorBg: "bg-amber-50/80",
        colorBorder: "border-amber-200",
        barColor: "bg-amber-500",
        note: "Food cost berada di rentang 31% - 38%. Wajar untuk menu signature premium atau menu promo, namun perlu diawasi agar tidak melambung saat harga bahan baku naik.",
      };
    }
    return {
      level: "danger",
      badge: "Kritis (Margin Terlalu Tipis)",
      colorText: "text-rose-700",
      colorBg: "bg-rose-50/80",
      colorBorder: "border-rose-200",
      barColor: "bg-rose-500",
      note: "Peringatan! Food cost di atas 38% terlalu berisiko. Margin tersisa sangat rentan tergerus oleh biaya operasional, sewa ruko, dan upah tim.",
    };
  }, [foodCostPercent]);

  // Simpan ke Master Resep Toko
  const handleSaveToStoreRecipes = () => {
    if (!menuName.trim()) {
      alert("Nama menu tidak boleh kosong.");
      return;
    }
    if (items.length === 0) {
      alert("Harap masukkan minimal 1 bahan baku.");
      return;
    }

    const validIngredients = items
      .filter((it) => it.ingredientId && it.quantity > 0)
      .map((it) => ({
        ingredientId: it.ingredientId,
        quantity: it.quantity,
      }));

    if (validIngredients.length === 0) {
      alert("Pilih bahan baku dari master inventori agar resep terhubung dengan stok otomatis!");
      return;
    }

    const existing = recipes.find(
      (r) => r.menuName.trim().toLowerCase() === menuName.trim().toLowerCase()
    );

    if (existing) {
      updateRecipe({
        id: existing.id,
        menuName: menuName.trim(),
        ingredients: validIngredients,
      });
      setSaveSuccessMessage(`Resep "${menuName}" berhasil diperbarui di Master Resep Toko!`);
    } else {
      addRecipe({
        menuName: menuName.trim(),
        ingredients: validIngredients,
      });
      setSaveSuccessMessage(`Resep baru "${menuName}" berhasil disimpan ke Master Resep Toko!`);
    }

    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Terbitkan Langsung ke Katalog Produk Toko
  const handlePublishToProductCatalog = () => {
    if (!menuName.trim()) {
      alert("Nama menu tidak boleh kosong.");
      return;
    }
    const validIngredients = items
      .filter((it) => it.ingredientId && it.quantity > 0)
      .map((it) => ({
        ingredientId: it.ingredientId,
        quantity: it.quantity,
      }));

    const existingProd = products.find(
      (p) => p.name.trim().toLowerCase() === menuName.trim().toLowerCase()
    );

    const variantName = servingNote.trim() || (selectedDivision === "BAR" ? "Iced 16oz" : "Reguler");
    const packagingNotes = packagingList
      .filter((p) => p.isIncluded)
      .map((p) => p.name)
      .join(" + ") || "Tanpa Kemasan (Dine-In)";

    if (existingProd) {
      const existingVarIdx = (existingProd.variants || []).findIndex(
        (v) => v.name.trim().toLowerCase() === variantName.toLowerCase()
      );
      let updatedVariants = [...(existingProd.variants || [])];
      if (existingVarIdx >= 0) {
        updatedVariants[existingVarIdx] = {
          ...updatedVariants[existingVarIdx],
          price: targetSellingPrice,
          estimatedHpp: totalHpp,
          packagingCost: packagingCost,
          packagingNotes,
          recipe: validIngredients,
        };
      } else {
        updatedVariants.push({
          id: `var-${Date.now()}`,
          productId: existingProd.id,
          name: variantName,
          price: targetSellingPrice,
          estimatedHpp: totalHpp,
          packagingCost: packagingCost,
          packagingNotes,
          recipe: validIngredients,
          isAvailable: true,
        });
      }
      updateProduct({
        ...existingProd,
        division: selectedDivision,
        category: publishCategory,
        variants: updatedVariants,
      });
      setSaveSuccessMessage(`Varian "${variantName}" untuk produk "${menuName}" berhasil diterbitkan ke Katalog Toko!`);
    } else {
      addProduct({
        name: menuName.trim(),
        category: publishCategory,
        division: selectedDivision,
        description: `Produk racikan resmi Julia's (${selectedDivision}).`,
        isActive: true,
        variants: [
          {
            id: `var-${Date.now()}`,
            productId: "",
            name: variantName,
            price: targetSellingPrice,
            estimatedHpp: totalHpp,
            packagingCost: packagingCost,
            packagingNotes,
            recipe: validIngredients,
            isAvailable: true,
          },
        ],
      });
      setSaveSuccessMessage(`Produk baru "${menuName}" berhasil diterbitkan ke Katalog Menu Toko!`);
    }

    if (validIngredients.length > 0) {
      const existingRec = recipes.find(
        (r) => r.menuName.trim().toLowerCase() === menuName.trim().toLowerCase()
      );
      if (existingRec) {
        updateRecipe({
          id: existingRec.id,
          menuName: menuName.trim(),
          ingredients: validIngredients,
        });
      } else {
        addRecipe({
          menuName: menuName.trim(),
          ingredients: validIngredients,
        });
      }
    }

    setIsPublishProductModalOpen(false);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Simpan Sebagai Resep Kondimen Olahan (Batch Prep)
  const handleSaveAsBatchPrep = () => {
    if (!menuName.trim()) {
      alert("Nama olahan tidak boleh kosong.");
      return;
    }
    const validIngredients = items
      .filter((it) => it.ingredientId && it.quantity > 0)
      .map((it) => ({
        ingredientId: it.ingredientId,
        quantity: it.quantity,
      }));

    if (validIngredients.length === 0) {
      alert("Minimal 1 bahan baku harus dipilih dari master inventori.");
      return;
    }

    addBatchPreparation({
      name: menuName.trim(),
      division: selectedDivision,
      targetIngredientId: `ing-prep-${Date.now()}`,
      targetIngredientName: menuName.trim(),
      yieldQuantity: Number(batchYieldQty),
      yieldUnit: batchYieldUnit.trim(),
      ingredients: validIngredients,
      notes: `Resep kondimen batch dari formulasi HPP. Catatan: ${servingNote}`,
    });

    setSaveSuccessMessage(`Resep olahan batch "${menuName}" berhasil disimpan ke Dapur Olahan!`);
    setIsBatchPrepModalOpen(false);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Minta Konsultasi AI Gemini 3.8 Flash
  const handleAskGeminiAi = async () => {
    setIsAiLoading(true);
    setAiAnalysisResult(null);

    try {
      const itemsDetail = items
        .map((it) => `- ${it.name}: ${it.quantity} ${it.unit} @ Rp ${it.costPerUnit}/${it.unit} = Rp ${Math.round(it.quantity * it.costPerUnit)}`)
        .join("\n");

      const packDetail = packagingList
        .filter((p) => p.isIncluded)
        .map((p) => `- ${p.name}: Rp ${p.cost}`)
        .join("\n");

      const prompt = `Halo Julia AI Copilot! Saya sedang membuat simulasi HPP & harga jual menu kopi di kafe kami dengan rincian berikut:

Nama Menu: ${menuName} (${servingNote})
Bahan Baku:
${itemsDetail}
Subtotal Bahan: Rp ${Math.round(rawMaterialCost).toLocaleString("id-ID")}

Biaya Kemasan & Disposables:
${packDetail || "- Tanpa kemasan khusus"}
Subtotal Kemasan: Rp ${Math.round(packagingCost).toLocaleString("id-ID")}

Buffer Wastage/Penyusutan: ${wastagePercent}% (Rp ${Math.round(wastageCost).toLocaleString("id-ID")})
TOTAL HPP RIIL PER CUP: Rp ${Math.round(totalHpp).toLocaleString("id-ID")}

Rencana Harga Jual: Rp ${Math.round(targetSellingPrice).toLocaleString("id-ID")}
Food Cost: ${foodCostPercent.toFixed(1)}%
Gross Margin: ${grossMarginPercent.toFixed(1)}% (Laba Kotor Rp ${Math.round(grossProfit).toLocaleString("id-ID")})

Tolong berikan analisis singkat dan tajam (3-4 poin padat):
1. Evaluasi apakah proporsi HPP & margin ini sudah ideal untuk standar coffee shop Indonesia?
2. Komponen bahan mana yang paling menyerap biaya dan bagaimana saran efisiensi porsi/takarannya tanpa menurunkan kualitas rasa?
3. Rekomendasi pricing kompetitif dan strategi upselling atau bundling (misal pairing pastry) agar omset kafe maksimal.
Format jawaban dengan markdown rapi dan angka-angka yang jelas.`;

      const response = await fetch("/api/ai/ask-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          storeContext: {
            role: "MANAGER",
            feature: "HPP_CALCULATOR",
            menuName,
            totalHpp,
            targetSellingPrice,
            foodCostPercent,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal menghubungi AI Advisor");
      }

      const data = await response.json();
      setAiAnalysisResult(data.reply || "Tidak ada respon dari asisten AI.");
    } catch (err: any) {
      setAiAnalysisResult(
        `### ⚠️ Analisis Heuristik Internal (Offline):\n` +
        `1. **Rasio Food Cost (${foodCostPercent.toFixed(1)}%):** ${
          foodCostPercent <= 32
            ? "Sangat sehat! Kafe Anda memiliki margin tebal yang aman dari fluktuasi harga bahan."
            : "Cukup tinggi. Disarankan menaikkan harga jual atau mencari opsi supplier susu/sirup dengan harga grosir."
        }\n` +
        `2. **Laba Kotor (Rp ${Math.round(grossProfit).toLocaleString("id-ID")}):** Tiap cup menghasilkan margin bersih yang signifikan jika penjualan harian mencapai target.\n` +
        `3. **Tips Bundling:** Pasangkan menu ini dengan roti/croissant dengan diskon paket hemat untuk menaikkan nilai rata-rata transaksi kasir.`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyAiResult = () => {
    if (!aiAnalysisResult) return;
    navigator.clipboard.writeText(aiAnalysisResult);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Filtered recipes for catalog audit
  const filteredRecipes = useMemo(() => {
    if (!catalogSearch.trim()) return recipes;
    const q = catalogSearch.toLowerCase();
    return recipes.filter((r) => r.menuName.toLowerCase().includes(q));
  }, [recipes, catalogSearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─── Header Banner ────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Operational & Profitability Tool
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Manager Exclusive
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            Simulasi & Kalkulator HPP Menu
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Hitung biaya bahan baku riil, kemasan takeaway, buffer penyusutan barista, serta simulasi margin laba & target harga jual menu.
          </p>
        </div>

        {/* Tab Selector & Navigation */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("simulator")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer ${
                activeTab === "simulator" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "simulator" && (
                <motion.div
                  layoutId="hppMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Sliders className="w-3.5 h-3.5 text-brand-600 relative z-10" />
              <span className="relative z-10">Simulator HPP & Laba</span>
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer ${
                activeTab === "catalog" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "catalog" && (
                <motion.div
                  layoutId="hppMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Coffee className="w-3.5 h-3.5 text-brand-600 relative z-10" />
              <span className="relative z-10">Katalog Resep ({recipes.length})</span>
            </button>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate("menu_management")}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs w-full sm:w-auto"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-brand-300" />
              <span>Katalog Menu & Dapur Olahan</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Save Success Alert */}
      <AnimatePresence>
        {saveSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
            <button
              onClick={() => setSaveSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5 rounded cursor-pointer"
            >
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── VIEW 1: SIMULATOR UTAMA ──────────────────────────────────────────────── */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI (7/12): INPUT FORM BAHAN & KEMASAN */}
          <div className="lg:col-span-7 space-y-6">
            {/* Integrated Supply Chain Strip */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-950 text-white rounded-2xl shadow-sm border border-brand-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                </span>
                <div>
                  <span className="font-extrabold text-brand-200 block text-[11px] uppercase tracking-wider">
                    Alur Terintegrasi Supply Chain
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Bahan Baku (Inventori) ➜ Formulasi HPP ➜ Katalog Menu POS ➜ Pengurangan Otomatis
                  </span>
                </div>
              </div>

              {onNavigate && (
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => onNavigate("inventory")}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white rounded-xl text-[11px] font-bold transition-all border border-white/10 cursor-pointer"
                  >
                    Bahan Baku ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("menu_management")}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Katalog Menu ↗
                  </button>
                </div>
              )}
            </div>

            {/* Card 1: Identitas Menu & Muat Resep Eksisting */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 text-xs font-black flex items-center justify-center border border-brand-100">
                      1
                    </span>
                    Identitas Menu & Varian
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih preset kopi standar kafe, muat dari resep toko, atau racik menu baru.
                  </p>
                </div>

                {/* Dropdown Muat Resep */}
                {recipes.length > 0 && (
                  <div className="relative w-full sm:w-auto sm:min-w-[220px]">
                    <select
                      value={selectedRecipeId}
                      onChange={(e) => handleLoadExistingRecipe(e.target.value)}
                      className="w-full text-base sm:text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="">-- Muat Resep Toko --</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.menuName} ({r.ingredients.length} bahan)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Quick Presets Standard Coffee Shop Recipes */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-brand-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  Preset Cepat Menu Standar Kafe:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                  {STANDARD_RECIPE_PRESETS.map((preset) => {
                    const isSelected = menuName === preset.name;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? "bg-brand-600 text-white border-brand-600 shadow-xs font-black"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
                        }`}
                      >
                        <span className="text-sm">{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Menu / Minuman
                  </label>
                  <input
                    type="text"
                    value={menuName}
                    onChange={(e) => {
                      setMenuName(e.target.value);
                      setSelectedRecipeId("");
                    }}
                    placeholder="e.g. Spanish Latte, Butterscotch Coffee"
                    className="w-full px-3.5 py-2.5 text-base sm:text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Keterangan Porsi / Serving / Varian
                  </label>
                  <input
                    type="text"
                    value={servingNote}
                    onChange={(e) => setServingNote(e.target.value)}
                    placeholder="e.g. Cup 16oz Dingin / Botol 250ml"
                    className="w-full px-3.5 py-2.5 text-base sm:text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              {/* Division Selector */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Divisi Operasional & Paket Kemasan Khusus
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDivisionChange("BAR")}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer active:scale-[0.98] ${
                      selectedDivision === "BAR"
                        ? "bg-brand-50 border-brand-300 text-brand-900 ring-2 ring-brand-500/20 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5 text-brand-600" />
                    Divisi Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDivisionChange("KITCHEN")}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer active:scale-[0.98] ${
                      selectedDivision === "KITCHEN"
                        ? "bg-brand-50 border-brand-300 text-brand-900 ring-2 ring-brand-500/20 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-brand-600" />
                    Divisi Kitchen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDivisionChange("BAKER")}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer active:scale-[0.98] ${
                      selectedDivision === "BAKER"
                        ? "bg-brand-50 border-brand-300 text-brand-900 ring-2 ring-brand-500/20 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Cake className="w-3.5 h-3.5 text-brand-600" />
                    Divisi Bakery
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Mengubah divisi akan otomatis menyesuaikan opsi kemasan (packaging cost) di formulir bawah.
                </p>
              </div>
            </div>

            {/* Card 2: Bahan Baku (Bill of Materials) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 text-xs font-black flex items-center justify-center border border-brand-100">
                      2
                    </span>
                    Komposisi Bahan Baku (Gramasi / Porsi)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bahan baku yang dipakai per 1 porsi saji.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Bahan
                </button>
              </div>

              {/* Tabel / List Bahan Baku */}
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const subtotal = Math.round(item.quantity * item.costPerUnit);
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 hover:border-brand-200 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          Bahan #{idx + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold font-mono text-brand-950">
                            Subtotal: {formatCurrency(subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                            title="Hapus Bahan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        {/* Pilih dari Master Inventori atau Kustom */}
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Pilih Bahan Master
                          </label>
                          <select
                            value={item.ingredientId}
                            onChange={(e) => handleUpdateItem(item.id, { ingredientId: e.target.value })}
                            className="w-full text-base sm:text-xs font-medium px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">-- Input Bahan Kustom --</option>
                            {(Object.entries(groupedIngredients) as [string, Ingredient[]][]).map(([cat, list]) => (
                              <optgroup key={cat} label={`📂 ${cat}`}>
                                {list.map((ing) => {
                                  const isLow = ing.currentStock <= ing.minStock;
                                  const isZeroCost = !ing.costPerUnit || Number(ing.costPerUnit) <= 0;
                                  return (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.unit}) · @{formatCurrency(Number(ing.costPerUnit || 0))} · Stok: {ing.currentStock} {ing.unit} {isLow ? "⚠️" : ""} {isZeroCost ? "[Biaya 0]" : ""}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        {/* Nama Display / Kustom */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Nama Bahan
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                            placeholder="Nama bahan"
                            className="w-full text-base sm:text-xs font-medium px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>

                        {/* Takaran / Porsi */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Takaran ({item.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: Number(e.target.value) })}
                            className="w-full text-base sm:text-xs font-bold font-mono px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>

                        {/* Biaya per unit */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Biaya/{item.unit} (Rp)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.costPerUnit}
                            onChange={(e) => handleUpdateItem(item.id, { costPerUnit: Number(e.target.value) })}
                            className="w-full text-base sm:text-xs font-semibold font-mono px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    Belum ada bahan baku ditambahkan. Klik "+ Tambah Bahan" di atas.
                  </div>
                )}
              </div>

              {/* Zero Cost Alert */}
              {items.some((it) => it.costPerUnit <= 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Perhatian: Ada bahan baku dengan biaya modal Rp 0. Perhitungan HPP mungkin belum mencerminkan biaya riil.
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate("inventory")}
                      className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 active:scale-[0.98] text-amber-950 font-bold rounded-lg text-[10px] shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      Isi Harga di Inventori ↗
                    </button>
                  )}
                </div>
              )}

              {/* Subtotal Bahan Baku Pokok */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">
                  Subtotal Biaya Bahan Baku ({items.length} jenis):
                </span>
                <span className="font-bold font-mono text-sm text-slate-900">
                  {formatCurrency(rawMaterialCost)}
                </span>
              </div>
            </div>

            {/* Card 3: Kemasan & Disposables (Packaging) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 text-xs font-black flex items-center justify-center border border-brand-100">
                    3
                  </span>
                  Kemasan & Alat Sekali Pakai (Packaging)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Biaya kemasan sering luput dari hitungan HPP kafe, padahal menyumbang 10-15% biaya riil per cup/porsi.
                </p>
              </div>

              <div className="space-y-2.5">
                {packagingList.map((pack) => (
                  <div
                    key={pack.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                      pack.isIncluded
                        ? "bg-brand-50/40 border-brand-200/80 text-slate-900"
                        : "bg-slate-50/60 border-slate-200 text-slate-400"
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={pack.isIncluded}
                        onChange={() => handleTogglePackaging(pack.id)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500/20"
                      />
                      <span className={`font-semibold ${pack.isIncluded ? "text-slate-900" : "text-slate-500"}`}>
                        {pack.name}
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Biaya: Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={pack.cost}
                        disabled={!pack.isIncluded}
                        onChange={(e) => handleUpdatePackagingCost(pack.id, Number(e.target.value))}
                        className={`w-20 px-2 py-1 text-base sm:text-xs font-bold font-mono rounded-lg border text-right focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                          pack.isIncluded
                            ? "bg-white border-brand-300 text-brand-950"
                            : "bg-slate-100 border-slate-200 text-slate-400"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">Subtotal Biaya Kemasan:</span>
                <span className="font-bold font-mono text-sm text-slate-900">
                  {formatCurrency(packagingCost)}
                </span>
              </div>
            </div>

            {/* Card 4: Buffer Penyusutan (Wastage & Purge Barista) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 text-xs font-black flex items-center justify-center border border-brand-100">
                      4
                    </span>
                    Buffer Penyusutan & Purge (Wastage)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kompensasi kalibrasi grinder, sisa susu di steam pitcher, dan es mencair.
                  </p>
                </div>
                <span className="px-3 py-1 bg-brand-50 text-brand-900 text-xs font-black rounded-xl font-mono border border-brand-200/70">
                  {wastagePercent}%
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={wastagePercent}
                  onChange={(e) => setWastagePercent(Number(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                  <span>0% (Ideal / Tanpa rugi)</span>
                  <span className="text-brand-700 font-bold">5% (Standar Kafe)</span>
                  <span>10% (Tinggi)</span>
                  <span>15% (Maksimal)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">
                  Alokasi Nilai Penyusutan (+{wastagePercent}%):
                </span>
                <span className="font-bold font-mono text-sm text-brand-900">
                  +{formatCurrency(wastageCost)}
                </span>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN (5/12): EXECUTIVE SUMMARY & SIMULATOR MARGIN */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Card Ringkasan HPP Pokok (Bento Hero Dark Royal) */}
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200/80">
                  Total Biaya Pokok Produksi
                </span>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mt-2">
                  HPP Riil Per Porsi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bahan baku + kemasan + cadangan penyusutan.
                </p>
              </div>

              {/* Angka Total HPP Besar Hero Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 text-white space-y-3.5 shadow-md border border-slate-800">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-300 font-medium">Total HPP Riil:</span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
                    {formatCurrency(totalHpp)}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">• Bahan Baku:</span>
                    <span className="font-mono font-medium">{formatCurrency(rawMaterialCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">• Kemasan:</span>
                    <span className="font-mono font-medium">{formatCurrency(packagingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">• Wastage ({wastagePercent}%):</span>
                    <span className="font-mono font-medium text-amber-200">+{formatCurrency(wastageCost)}</span>
                  </div>
                </div>
              </div>

              {/* Simulator Harga Jual & Margin */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-900">
                      Rencana Harga Jual Toko (Rp)
                    </label>
                    <span className="text-[11px] text-slate-500">Harga Nett Kasir</span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      Rp
                    </span>
                    <input
                      type="number"
                      step="500"
                      min="1000"
                      value={targetSellingPrice}
                      onChange={(e) => setTargetSellingPrice(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-11 pr-4 py-3 text-base sm:text-lg font-black font-mono bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  {/* Preset Chips Cepat */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PRICE_PRESETS.map((price) => (
                      <button
                        key={price}
                        type="button"
                        onClick={() => setTargetSellingPrice(price)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                          targetSellingPrice === price
                            ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {(price / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metric Grid: Food Cost % & Gross Profit */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-4 rounded-2xl border ${healthStatus.colorBg} ${healthStatus.colorBorder}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      Food Cost Ratio
                    </p>
                    <p className={`text-2xl font-black font-mono ${healthStatus.colorText}`}>
                      {foodCostPercent.toFixed(1)}%
                    </p>
                    <p className="text-[10px] font-semibold text-slate-600 mt-1">
                      Target ideal: 28% - 32%
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      Laba Kotor (Margin)
                    </p>
                    <p className="text-xl font-black font-mono text-emerald-700">
                      +{formatCurrency(grossProfit)}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600 mt-1">
                      {grossMarginPercent.toFixed(1)}% dari omset
                    </p>
                  </div>
                </div>

                {/* Health Meter Bar */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Indikator Kelayakan:</span>
                    <span className={`font-bold ${healthStatus.colorText}`}>
                      {healthStatus.badge}
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${healthStatus.barColor}`}
                      style={{ width: `${Math.min(100, Math.max(10, foodCostPercent))}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {healthStatus.note}
                  </p>
                </div>

                {/* Reverse Simulator: Rekomendasi Harga dari Target Food Cost */}
                <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-200/70 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-brand-900">
                      Rekomendasi Harga (Food Cost {targetFoodCostPercent}%):
                    </span>
                    <div className="flex items-center gap-1">
                      {[25, 28, 30, 32].map((fc) => (
                        <button
                          key={fc}
                          onClick={() => setTargetFoodCostPercent(fc)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg cursor-pointer ${
                            targetFoodCostPercent === fc
                              ? "bg-brand-600 text-white"
                              : "bg-white text-slate-700 border border-brand-200"
                          }`}
                        >
                          {fc}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Harga Ideal Dibulatkan:</span>
                    <span className="font-black font-mono text-base text-brand-950">
                      {formatCurrency(recommendedSellingPrice)}
                    </span>
                  </div>
                  <button
                    onClick={() => setTargetSellingPrice(recommendedSellingPrice)}
                    className="w-full py-2 bg-white hover:bg-brand-100/60 active:scale-[0.98] text-brand-900 border border-brand-300 rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    Gunakan Harga Rekomendasi Ini
                  </button>
                </div>

                {/* Proyeksi Penjualan Harian & Bulanan */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">
                      Estimasi Penjualan Harian:
                    </span>
                    <span className="font-mono font-bold text-brand-900">
                      {dailyVolume} cup / hari
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="300"
                    step="5"
                    value={dailyVolume}
                    onChange={(e) => setDailyVolume(Number(e.target.value))}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <p className="text-[10px] text-slate-500">Laba Kotor/Hari:</p>
                      <p className="font-bold font-mono text-slate-900">
                        {formatCurrency(dailyGrossProfit)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <p className="text-[10px] text-slate-500">Laba Kotor/Bulan (30h):</p>
                      <p className="font-bold font-mono text-emerald-700">
                        {formatCurrency(monthlyGrossProfit)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Terbitkan Produk, Kondimen Olahan, Simpan Resep & Konsultasi AI */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPublishProductModalOpen(true)}
                      className="w-full py-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <UtensilsCrossed className="w-4 h-4 text-brand-200" />
                      Terbitkan ke Katalog
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBatchPrepModalOpen(true)}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Flame className="w-4 h-4 text-amber-400" />
                      Simpan sbg Kondimen
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveToStoreRecipes}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> Simpan Sebagai Resep Pokok Toko
                  </button>

                  <button
                    type="button"
                    onClick={handleAskGeminiAi}
                    disabled={isAiLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-indigo-700 hover:from-brand-700 hover:to-indigo-800 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    {isAiLoading ? "Menganalisis Komposisi Resep..." : "Analisis Resep & Rekomendasi AI Gemini"}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Advisor Response Card if available */}
            <AnimatePresence>
              {(isAiLoading || aiAnalysisResult) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-white p-5 sm:p-6 rounded-3xl border border-brand-200/80 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-brand-950 font-bold text-sm">
                      <Sparkles className="w-4 h-4 text-brand-600" />
                      <h3>Rekomendasi AI Konsultan Coffee Shop</h3>
                    </div>
                    {aiAnalysisResult && (
                      <button
                        onClick={handleCopyAiResult}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 text-xs flex items-center gap-1 cursor-pointer"
                        title="Salin Catatan AI"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="text-[11px]">{isCopied ? "Tersalin" : "Salin"}</span>
                      </button>
                    )}
                  </div>

                  {isAiLoading ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-7 h-7 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-slate-500 font-medium">
                        Gemini AI sedang menganalisis proporsi bahan dan struktur margin...
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line space-y-2 max-h-96 overflow-y-auto no-scrollbar pr-1">
                      {aiAnalysisResult}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ─── VIEW 2: KATALOG AUDIT HPP RESEP TOKO ─────────────────────────────────── */}
      {activeTab === "catalog" && (
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Katalog Resep & Estimasi HPP Toko
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar semua resep yang terhubung ke sistem kasir dan pengurangan stok otomatis.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Cari resep menu..."
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button
                onClick={() => {
                  setMenuName("Menu Baru Racikan");
                  setItems([]);
                  setSelectedRecipeId("");
                  setActiveTab("simulator");
                }}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Buat Simulasi Baru
              </button>
            </div>
          </div>

          {/* DESKTOP/TABLET TABLE VIEW (hidden on phone) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                  <th className="py-3 px-4 rounded-l-xl">Nama Menu</th>
                  <th className="py-3 px-4">Komposisi Bahan</th>
                  <th className="py-3 px-4 text-right">Estimasi HPP Bahan</th>
                  <th className="py-3 px-4 text-center">Status Data</th>
                  <th className="py-3 px-4 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecipes.map((r) => {
                  const recipeHpp = r.ingredients.reduce((sum, ri) => {
                    const ing = ingredients.find((i) => i.id === ri.ingredientId);
                    const cost = ing ? Number(ing.costPerUnit || 0) : 0;
                    return sum + ri.quantity * cost;
                  }, 0);

                  const hasMissingCost = r.ingredients.some((ri) => {
                    const ing = ingredients.find((i) => i.id === ri.ingredientId);
                    return !ing || !ing.costPerUnit || Number(ing.costPerUnit) <= 0;
                  });

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {r.menuName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {r.ingredients.map((ri, idx) => {
                            const ing = ingredients.find((i) => i.id === ri.ingredientId);
                            return (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]"
                              >
                                {ing?.name || "Bahan"} ({ri.quantity} {ing?.unit})
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-950">
                        {formatCurrency(Math.round(recipeHpp))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {hasMissingCost ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Harga Bahan Belum Lengkap
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Siap Dihitung
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            handleLoadExistingRecipe(r.id);
                            setActiveTab("simulator");
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-800 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          Muat ke Simulator <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredRecipes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {recipes.length === 0 ? "Belum ada data resep terdaftar di sistem." : "Tidak ada resep yang sesuai pencarian."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD VIEW (Phone 360-480px) */}
          <div className="block md:hidden space-y-3">
            {filteredRecipes.map((r) => {
              const recipeHpp = r.ingredients.reduce((sum, ri) => {
                const ing = ingredients.find((i) => i.id === ri.ingredientId);
                const cost = ing ? Number(ing.costPerUnit || 0) : 0;
                return sum + ri.quantity * cost;
              }, 0);

              const hasMissingCost = r.ingredients.some((ri) => {
                const ing = ingredients.find((i) => i.id === ri.ingredientId);
                return !ing || !ing.costPerUnit || Number(ing.costPerUnit) <= 0;
              });

              return (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{r.menuName}</h3>
                      <p className="text-[11px] text-slate-500">{r.ingredients.length} bahan baku</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">HPP Pokok:</span>
                      <span className="font-black font-mono text-sm text-brand-950">
                        {formatCurrency(Math.round(recipeHpp))}
                      </span>
                    </div>
                  </div>

                  {/* Ingredients Tags */}
                  <div className="flex flex-wrap gap-1">
                    {r.ingredients.map((ri, idx) => {
                      const ing = ingredients.find((i) => i.id === ri.ingredientId);
                      return (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px]"
                        >
                          {ing?.name || "Bahan"} ({ri.quantity} {ing?.unit})
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    {hasMissingCost ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Biaya Belum Lengkap
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Siap Dihitung
                      </span>
                    )}

                    <button
                      onClick={() => {
                        handleLoadExistingRecipe(r.id);
                        setActiveTab("simulator");
                      }}
                      className="px-3 py-1.5 bg-brand-600 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      Buka di Simulator <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredRecipes.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                {recipes.length === 0 ? "Belum ada data resep terdaftar di sistem." : "Tidak ada resep yang sesuai pencarian."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Terbitkan ke Katalog Produk Toko ──────────────────────────────── */}
      {isPublishProductModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Terbitkan ke Katalog Produk</h3>
              </div>
              <button
                onClick={() => setIsPublishProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Nama Produk:</span>
                  <span className="font-bold text-slate-900 text-sm">{menuName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Divisi Operasional:</span>
                  <span className="font-bold px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 border border-brand-200 text-[11px]">
                    {selectedDivision}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Nama Varian:</span>
                  <span className="font-bold text-slate-900">
                    {servingNote || (selectedDivision === "BAR" ? "Iced 16oz" : "Reguler")}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Kategori Menu Toko
                </label>
                <select
                  value={publishCategory}
                  onChange={(e) => setPublishCategory(e.target.value)}
                  className="w-full text-base sm:text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="COFFEE">☕ COFFEE (Espresso-based, Cold Brew)</option>
                  <option value="NON_COFFEE">🍵 NON_COFFEE (Matcha, Tea, Chocolate)</option>
                  <option value="FOOD">🍳 FOOD (Makanan Berat, Rice Bowl)</option>
                  <option value="SNACK">🍟 SNACK (Camilan, Finger Food)</option>
                  <option value="PASTRY">🥐 PASTRY (Croissant, Cake, Bakery)</option>
                </select>
              </div>

              {/* Rincian Finansial yang Diterbitkan */}
              <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/70 space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>HPP Terkalkulasi (Bahan + Kemasan):</span>
                  <span className="font-bold font-mono text-brand-950">{formatCurrency(totalHpp)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Harga Jual Resmi Kasir:</span>
                  <span className="font-extrabold font-mono text-slate-900">{formatCurrency(targetSellingPrice)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-brand-200">
                  <span>Proyeksi Gross Margin:</span>
                  <span className="font-mono">
                    {formatCurrency(grossProfit)} ({grossMarginPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Produk ini akan terdaftar di <b>Katalog Menu Toko</b>. Kasir dan tim bar/kitchen akan langsung dapat melihat harga jual resmi, estimasi laba, dan live ketersediaan porsi berdasarkan stok bahan baku.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPublishProductModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePublishToProductCatalog}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Terbitkan Sekarang
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL: Simpan Sebagai Kondimen Olahan (Batch Prep) ───────────────────── */}
      {isBatchPrepModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Flame className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Simpan Resep Kondimen Olahan</h3>
              </div>
              <button
                onClick={() => setIsBatchPrepModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed">
                Resep ini akan disimpan sebagai formula <b>Dapur Olahan (Batch Prep)</b>. Tim barista/kitchen dapat memasak batch ini kapan saja untuk menghasilkan kondimen siap pakai (seperti Sirup Gula Aren Racikan, Sambal Matah, Cold Brew Concentrate) dengan HPP unit otomatis.
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nama Kondimen / Olahan
                </label>
                <input
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder="e.g. Sirup Gula Aren Racikan Toko"
                  className="w-full text-base sm:text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Hasil Jadi (Yield Qty)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchYieldQty}
                    onChange={(e) => setBatchYieldQty(Math.max(1, Number(e.target.value)))}
                    className="w-full text-base sm:text-xs font-bold font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Satuan Hasil (Unit)
                  </label>
                  <select
                    value={batchYieldUnit}
                    onChange={(e) => setBatchYieldUnit(e.target.value)}
                    className="w-full text-base sm:text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="ml">ml (Mililiter)</option>
                    <option value="gr">gr (Gram)</option>
                    <option value="porsi">porsi (Porsi/Pcs)</option>
                  </select>
                </div>
              </div>

              {/* Rincian Modal Bahan Baku Batch */}
              <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/70 space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Total Biaya Bahan Baku Pokok:</span>
                  <span className="font-bold font-mono text-brand-950">{formatCurrency(rawMaterialCost)}</span>
                </div>
                <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-brand-200">
                  <span>Estimasi HPP per {batchYieldUnit}:</span>
                  <span className="font-extrabold font-mono text-emerald-800">
                    {formatCurrency(Math.round(batchYieldQty > 0 ? rawMaterialCost / batchYieldQty : 0))} / {batchYieldUnit}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBatchPrepModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAsBatchPrep}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Simpan ke Dapur Olahan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
