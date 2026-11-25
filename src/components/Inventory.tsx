import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ConfirmModal } from "./common/ConfirmModal";
import { formatCurrency } from "../utils/format";
import { getLocalDateString } from "../utils/dateUtils";
import { CustomDatePicker } from "./common/CustomDatePicker";
import {
  applyDeleteIngredientCategory,
  applyRenameIngredientCategory,
  buildIngredientCategoryList,
  DEFAULT_INGREDIENT_CATEGORIES,
  filterIngredientCategoriesByDivision,
  matchesIngredientCategory,
  normalizeIngredientCategoryName,
  resolveIngredientCategoryDivision,
} from "../utils/financeMetrics";
import {
  addDaysToLocalDate,
  recomputeOpnameItemsWithLiveStock,
  computeMovementActualQuantityAndCost,
  convertStockInputOnUnitToggle,
  resolveDefaultTransferStation,
} from "../utils/syncSanitizers";
import {
  computePhysicalStockOutByIngredient,
  computeProductSalesAnalytics,
} from "../utils/productSalesAnalytics";
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
  Clock,
  TrendingDown,
  Filter,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CsvImportExport } from "./common/CsvImportExport";
import { RecipeModal } from "./RecipeModal";
import { CustomSelect } from "./common/CustomSelect";
import { CurrencyInput } from "./common/CurrencyInput";
import {
  Recipe,
  RecipeIngredient,
  Ingredient,
  IngredientCategoryDivision,
  ViewState,
  StockOpname,
  StockOpnameItem,
} from "../types";

interface InventoryProps {
  onNavigate?: (view: ViewState) => void;
  initialTab?: "ingredients" | "categories" | "movements" | "opnames" | "recipes" | "waste";
}

export const getIngredientCategoryIcon = (categoryName: string) => {
  const lower = categoryName.trim().toLowerCase();
  if (lower.includes("kopi") || lower.includes("coffee") || lower.includes("espresso")) return Coffee;
  if (lower.includes("susu") || lower.includes("dairy") || lower.includes("milk")) return Droplets;
  if (lower.includes("sirup") || lower.includes("pemanis") || lower.includes("saus")) return Sparkles;
  if (lower.includes("olahan") || lower.includes("kondimen") || lower.includes("batch")) return Flame;
  if (lower.includes("kitchen") || lower.includes("makanan") || lower.includes("dapur")) return UtensilsCrossed;
  if (lower.includes("bakery") || lower.includes("pastry") || lower.includes("roti")) return Cake;
  if (lower.includes("kemasan") || lower.includes("packaging") || lower.includes("cup")) return ShoppingBag;
  if (lower.includes("kebersihan") || lower.includes("operasional")) return Sparkles;
  return Layers;
};

export const PRESET_CATEGORIES = [
  { id: "ALL", name: "Semua Kategori", icon: Package },
  { id: "Biji Kopi", name: "Biji Kopi & Espresso", icon: Coffee },
  { id: "Susu & Dairy", name: "Susu & Plant-Based", icon: Droplets },
  { id: "Sirup & Pemanis", name: "Sirup & Pemanis", icon: Sparkles },
  { id: "Bahan Olahan", name: "Bahan Olahan", icon: Flame },
  { id: "Powder & Teh", name: "Powder & Teh", icon: Flame },
  { id: "Bahan Kitchen", name: "Bahan Kitchen", icon: UtensilsCrossed },
  { id: "Bahan Bakery", name: "Bahan Bakery", icon: Cake },
  { id: "Packaging & Cup", name: "Packaging & Cup", icon: ShoppingBag },
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

export interface WasteReasonInfo {
  id: "KALIBRASI" | "SALAH_BUAT" | "TUMPAH" | "KEDALUWARSA" | "RUSAK" | "LAINNYA";
  label: string;
  badge: string;
  desc: string;
}

export const WASTE_REASONS_DETAIL: WasteReasonInfo[] = [
  { id: "KALIBRASI", label: "Kalibrasi / Dialing Espresso", badge: "bg-brand-50 text-brand-700 border-brand-200", desc: "Setting grind size & yield ekstraksi pagi" },
  { id: "SALAH_BUAT", label: "Salah Buat Pesanan (Human Error)", badge: "bg-amber-50 text-amber-700 border-amber-200", desc: "Salah takaran, salah sirup, atau salah varian menu" },
  { id: "TUMPAH", label: "Tumpah / Overheat Steaming", badge: "bg-orange-50 text-orange-700 border-orange-200", desc: "Susu atau sirup tumpah saat operasional bar sibuk" },
  { id: "KEDALUWARSA", label: "Kedaluwarsa / Basi (Expired)", badge: "bg-rose-50 text-rose-700 border-rose-200", desc: "Melewati shelf-life atau basi di chiller" },
  { id: "RUSAK", label: "Kemasan Rusak / Bocor", badge: "bg-rose-50 text-rose-700 border-rose-200", desc: "Bocor kemasan supplier, pecah, atau cacat fisik" },
  { id: "LAINNYA", label: "Lainnya / Kontaminasi", badge: "bg-slate-100 text-slate-700 border-slate-300", desc: "Bahan menggumpal, terkena air, atau insiden lain" },
];

export interface UnitConversionInfo {
  hasConversion: boolean;
  purchaseUnit: string;
  conversionFactor: number;
  baseUnit: string;
  displayLabel: string;
}

export function getIngredientUnitConversion(ing: Ingredient): UnitConversionInfo {
  // If explicitly configured with a purchaseUnit and conversionFactor > 1
  if (ing.purchaseUnit && ing.conversionFactor && ing.conversionFactor > 1) {
    return {
      hasConversion: true,
      purchaseUnit: ing.purchaseUnit,
      conversionFactor: ing.conversionFactor,
      baseUnit: ing.unit,
      displayLabel: `1 ${ing.purchaseUnit} = ${ing.conversionFactor.toLocaleString("id-ID")} ${ing.unit}`,
    };
  }

  // Automatic smart fallback for common coffee shop units
  const baseLower = (ing.unit || "").toLowerCase().trim();
  if (baseLower === "gr" || baseLower === "g" || baseLower === "gram") {
    const factor = ing.conversionFactor && ing.conversionFactor > 1 ? ing.conversionFactor : 1000;
    const pUnit = ing.purchaseUnit || "Kg";
    return {
      hasConversion: true,
      purchaseUnit: pUnit,
      conversionFactor: factor,
      baseUnit: ing.unit,
      displayLabel: `1 ${pUnit} = ${factor.toLocaleString("id-ID")} ${ing.unit}`,
    };
  }

  if (baseLower === "ml" || baseLower === "mili" || baseLower === "mililiter") {
    const factor = ing.conversionFactor && ing.conversionFactor > 1 ? ing.conversionFactor : 1000;
    const pUnit = ing.purchaseUnit || "Liter";
    return {
      hasConversion: true,
      purchaseUnit: pUnit,
      conversionFactor: factor,
      baseUnit: ing.unit,
      displayLabel: `1 ${pUnit} = ${factor.toLocaleString("id-ID")} ${ing.unit}`,
    };
  }

  if (ing.purchaseUnit && ing.purchaseUnit !== ing.unit && ing.conversionFactor && ing.conversionFactor > 0) {
    return {
      hasConversion: true,
      purchaseUnit: ing.purchaseUnit,
      conversionFactor: ing.conversionFactor,
      baseUnit: ing.unit,
      displayLabel: `1 ${ing.purchaseUnit} = ${ing.conversionFactor.toLocaleString("id-ID")} ${ing.unit}`,
    };
  }

  return {
    hasConversion: false,
    purchaseUnit: ing.purchaseUnit || ing.unit,
    conversionFactor: 1,
    baseUnit: ing.unit,
    displayLabel: `1 ${ing.unit}`,
  };
}

export const getRecipeIngredients = (recipe?: Recipe | null): RecipeIngredient[] => {
  if (!recipe) return [];
  if (Array.isArray(recipe.ingredients)) return recipe.ingredients;
  if (typeof recipe.ingredients === "string") {
    try {
      const parsed = JSON.parse(recipe.ingredients);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

const getMovementDisplayMeta = (mov: { type: string; referenceId?: string | null }) => {
  switch (mov.type) {
    case "IN":
      return {
        label: "Stok Masuk",
        mobileLabel: "Masuk",
        prefix: "+",
        isPositive: true,
        isWaste: false,
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        qtyClass: "text-emerald-700",
      };
    case "RETURN":
      return {
        label: "Retur Masuk",
        mobileLabel: "Retur",
        prefix: "+",
        isPositive: true,
        isWaste: false,
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        qtyClass: "text-emerald-700",
      };
    case "WASTE":
      return {
        label: "Terbuang / Rusak",
        mobileLabel: "Waste",
        prefix: "-",
        isPositive: false,
        isWaste: true,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        qtyClass: "text-rose-600",
      };
    case "TRANSFER":
      return {
        label: "Transfer Stasiun",
        mobileLabel: "Transfer",
        prefix: "⇄ ",
        isPositive: false,
        isWaste: false,
        badgeClass: "bg-brand-50 text-brand-700 border-brand-200",
        qtyClass: "text-brand-700",
      };
    case "USAGE":
      return {
        label: mov.referenceId ? "Penjualan (Order)" : "Pemakaian Harian",
        mobileLabel: mov.referenceId ? "Penjualan" : "Pemakaian",
        prefix: "-",
        isPositive: false,
        isWaste: false,
        badgeClass: "bg-brand-50 text-brand-700 border-brand-200",
        qtyClass: "text-slate-800",
      };
    case "ADJUSTMENT":
      return {
        label: "Penyesuaian",
        mobileLabel: "Penyesuaian",
        prefix: "",
        isPositive: false,
        isWaste: false,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        qtyClass: "text-slate-800",
      };
    default:
      return {
        label: mov.type === "OUT" ? "Stok Keluar" : mov.type,
        mobileLabel: mov.type === "OUT" ? "Keluar" : mov.type,
        prefix: "-",
        isPositive: false,
        isWaste: false,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        qtyClass: "text-slate-800",
      };
  }
};

export const Inventory: React.FC<InventoryProps> = ({ onNavigate, initialTab }) => {
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
    updateStockOpname,
    deleteStockOpname,
    addStockOpnameItem,
    bulkAddStockOpnameItems,
    currentUser,
    isReadOnly,
    recipes,
    salesTransactions = [],
    products = [],
    addRecipe,
    updateRecipe,
    deleteRecipe,
    employees,
    settings,
    updateSettings,
    closedPeriods = [],
  } = useStore();

  // User division resolution
  const userRole = (currentUser?.role || "").toUpperCase();
  const isManagerOrAdmin =
    userRole === "SUPER_ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "OWNER" ||
    userRole === "FINANCE";
  const canManageCategories = !isReadOnly && userRole !== "LEADER";
  const canNavigateToHpp =
    Boolean(onNavigate) &&
    (userRole === "SUPER_ADMIN" || userRole === "OWNER" || userRole === "MANAGER");
  const canNavigateToPurchases =
    Boolean(onNavigate) &&
    !isReadOnly &&
    (userRole === "SUPER_ADMIN" ||
      userRole === "MANAGER" ||
      userRole === "FINANCE" ||
      userRole === "LEADER");

  const userEmployee = useMemo(() => {
    if (!currentUser) return null;
    return (
      employees.find(
        (e) =>
          e.username?.toLowerCase() === currentUser.username?.toLowerCase() ||
          (currentUser.employeeId && e.id === currentUser.employeeId) ||
          e.id === currentUser.id
      ) || null
    );
  }, [currentUser, employees]);

  // Determine user's assigned station division:
  // "ALL" (for Manager/Admin/Finance/Owner) or "BAR" | "KITCHEN" | "BAKER"
  const userDivision = useMemo<"ALL" | "BAR" | "KITCHEN" | "BAKER">(() => {
    if (isManagerOrAdmin) return "ALL";

    // 1. Check user.department
    const userDept = (currentUser?.department || "").toUpperCase();
    if (userDept.includes("KITCHEN") || userDept.includes("DAPUR") || userDept.includes("COOK")) return "KITCHEN";
    if (userDept.includes("BAKER") || userDept.includes("PASTRY") || userDept.includes("ROTI")) return "BAKER";
    if (userDept.includes("BAR")) return "BAR";

    // 2. Check user.role
    if (userRole === "KITCHEN") return "KITCHEN";
    if (userRole === "BAKER") return "BAKER";
    if (userRole === "BAR" || userRole === "KASIR") return "BAR";

    // 3. Check matched employee department & position
    if (userEmployee) {
      const empDept = (userEmployee.department || "").toUpperCase();
      const empPos = (userEmployee.position || "").toUpperCase();
      if (empDept.includes("KITCHEN") || empPos.includes("KITCHEN") || empPos.includes("DAPUR") || empPos.includes("COOK")) return "KITCHEN";
      if (empDept.includes("BAKER") || empPos.includes("BAKER") || empPos.includes("PASTRY") || empPos.includes("ROTI")) return "BAKER";
      if (empDept.includes("BAR") || empPos.includes("BAR") || empPos.includes("BARISTA")) return "BAR";
    }

    // 4. Check name / username
    const nameOrUser = `${currentUser?.name || ""} ${currentUser?.username || ""}`.toUpperCase();
    if (nameOrUser.includes("KITCHEN") || nameOrUser.includes("DAPUR") || nameOrUser.includes("COOK")) return "KITCHEN";
    if (nameOrUser.includes("BAKER") || nameOrUser.includes("PASTRY") || nameOrUser.includes("ROTI")) return "BAKER";

    return "BAR";
  }, [currentUser, userEmployee, userRole, isManagerOrAdmin]);

  // Division classification helpers
  const isBarItem = (ing: Ingredient) =>
    ing.storageLocation === "BAR" ||
    ing.storageLocation === "CHILLER" ||
    ["coffee", "dairy", "pemanis", "air & es", "kondimen", "bahan olahan", "olahan", "sirup", "powder", "kemasan", "biji kopi", "susu", "cup"].some((c) =>
      ing.category.toLowerCase().includes(c)
    );

  const isKitchenItem = (ing: Ingredient) =>
    ing.storageLocation === "KITCHEN" ||
    ["kitchen", "makanan", "bumbu", "daging", "beras", "ayam", "sambal", "sayur", "minyak", "telur"].some((c) =>
      ing.category.toLowerCase().includes(c)
    );

  const isBakeryItem = (ing: Ingredient) =>
    ing.storageLocation === "BAKERY" ||
    ["bakery", "pastry", "roti", "dough", "butter", "tepung", "croissant", "keju", "yeast", "ragi"].some((c) =>
      ing.category.toLowerCase().includes(c)
    );

  const isOperationalItem = (ing: Ingredient) =>
    ing.storageLocation === "OPERATIONAL" ||
    ["kebersihan", "operasional", "supplies", "sabun", "plastik", "tissue", "tisu", "cleaner", "sanitizer", "sponge"].some((c) =>
      ing.category.toLowerCase().includes(c)
    );

  // Checks whether a given user division is permitted to view/audit this item
  // Kebersihan & Operasional is shared across all stations so each division can clean their own station
  const isIngredientAllowedForUser = (ing: Ingredient, div: "ALL" | "BAR" | "KITCHEN" | "BAKER") => {
    if (div === "ALL") return true;
    if (isOperationalItem(ing)) return true; // Shared supplies
    if (div === "BAR") return isBarItem(ing);
    if (div === "KITCHEN") return isKitchenItem(ing);
    if (div === "BAKER") return isBakeryItem(ing);
    return false;
  };

  // Division tabs allowed for current user
  const allowedDivisionTabs = useMemo(() => {
    if (isManagerOrAdmin) {
      return [
        { id: "ALL", label: "Semua Divisi", icon: Package },
        { id: "BAR", label: "Divisi Bar", icon: Coffee },
        { id: "KITCHEN", label: "Divisi Kitchen", icon: UtensilsCrossed },
        { id: "BAKERY", label: "Divisi Bakery & Pastry", icon: Cake },
        { id: "OPERATIONAL", label: "Kebersihan & Operasional", icon: Sparkles },
      ];
    }
    if (userDivision === "BAR") {
      return [
        { id: "BAR", label: "Divisi Bar", icon: Coffee },
        { id: "OPERATIONAL", label: "Kebersihan & Operasional (Shared)", icon: Sparkles },
      ];
    }
    if (userDivision === "KITCHEN") {
      return [
        { id: "KITCHEN", label: "Divisi Kitchen", icon: UtensilsCrossed },
        { id: "OPERATIONAL", label: "Kebersihan & Operasional (Shared)", icon: Sparkles },
      ];
    }
    if (userDivision === "BAKER") {
      return [
        { id: "BAKERY", label: "Divisi Bakery & Pastry", icon: Cake },
        { id: "OPERATIONAL", label: "Kebersihan & Operasional (Shared)", icon: Sparkles },
      ];
    }
    return [
      { id: "BAR", label: "Divisi Bar", icon: Coffee },
      { id: "OPERATIONAL", label: "Kebersihan & Operasional (Shared)", icon: Sparkles },
    ];
  }, [isManagerOrAdmin, userDivision]);

  const defaultDivisionFilter = useMemo<"ALL" | "BAR" | "KITCHEN" | "BAKERY" | "OPERATIONAL">(() => {
    if (userDivision === "BAR") return "BAR";
    if (userDivision === "KITCHEN") return "KITCHEN";
    if (userDivision === "BAKER") return "BAKERY";
    return "ALL";
  }, [userDivision]);

  const [activeTab, setActiveTab] = useState<"ingredients" | "categories" | "movements" | "opnames" | "recipes" | "waste">(
    initialTab || "ingredients"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<"ALL" | "BAR" | "KITCHEN" | "BAKERY" | "OPERATIONAL">(defaultDivisionFilter);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [selectedStockStatus, setSelectedStockStatus] = useState<"ALL" | "LOW_STOCK" | "SAFE">("ALL");

  // Quick Waste Modal State (F&B Spoilage & Dial-in Tracking)
  const [isQuickWasteOpen, setIsQuickWasteOpen] = useState(false);
  const [wasteIngredientId, setWasteIngredientId] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState<number>(1);
  const [wasteUnitMode, setWasteUnitMode] = useState<"BASE" | "PURCHASE">("BASE");
  const [wasteReason, setWasteReason] = useState<string>("KALIBRASI");
  const [wasteCustomNote, setWasteCustomNote] = useState("");
  const [wasteFilterReason, setWasteFilterReason] = useState<string>("ALL");
  const [wasteFilterPeriod, setWasteFilterPeriod] = useState<"ALL" | "THIS_MONTH" | "LAST_7_DAYS" | "TODAY">("THIS_MONTH");
  const [wasteSearch, setWasteSearch] = useState("");

  const handleOpenQuickWaste = (targetId?: string) => {
    if (isReadOnly) return;
    if (!targetId && accessibleIngredients.length === 0) {
      toast.warning("Belum ada bahan baku terdaftar untuk stasiun Anda.");
      return;
    }
    const id = targetId || (accessibleIngredients.length > 0 ? accessibleIngredients[0].id : "");
    setWasteIngredientId(id);
    setWasteUnitMode("BASE");
    setWasteQuantity(1);
    setWasteReason("KALIBRASI");
    setWasteCustomNote("");
    setIsQuickWasteOpen(true);
  };

  const handleSaveQuickWaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!wasteIngredientId || wasteQuantity <= 0) {
      toast.error("Pilih bahan baku dan masukkan jumlah yang valid (> 0).");
      return;
    }

    const ing = ingredients.find((i) => i.id === wasteIngredientId);
    if (!ing) return;

    const conv = getIngredientUnitConversion(ing);
    const { actualQuantity: actualQty, unitCost, totalCost: totalLoss } =
      computeMovementActualQuantityAndCost({
        quantity: Number(wasteQuantity),
        unitMode: wasteUnitMode,
        hasConversion: conv.hasConversion,
        conversionFactor: conv.conversionFactor,
        costPerUnit: ing.costPerUnit || 0,
      });

    const reasonObj = WASTE_REASONS_DETAIL.find((r) => r.id === wasteReason) || { label: wasteReason };
    const fullNote = `[${wasteReason}] ${reasonObj.label}${wasteCustomNote.trim() ? ` • ${wasteCustomNote.trim()}` : ""}`;

    addStockMovement({
      ingredientId: ing.id,
      type: "WASTE",
      quantity: actualQty,
      date: new Date().toISOString(),
      note: fullNote,
      unitCost,
      totalCost: totalLoss,
      createdBy: currentUser?.name || "Staff Barista",
      location: (ing.storageLocation as any) || "BAR",
    } as any);

    toast.success(`Waste "${ing.name}" (${actualQty.toLocaleString("id-ID")} ${ing.unit}) berhasil dicatat.`);
    setIsQuickWasteOpen(false);
    setWasteQuantity(1);
    setWasteCustomNote("");
  };

  // Keep division filters synchronized with user station on mount/login change
  useEffect(() => {
    setSelectedDivision(defaultDivisionFilter);
    setOpnameDivisionFilter(defaultDivisionFilter);
  }, [defaultDivisionFilter]);

  // Modals state
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedIngredientForMove, setSelectedIngredientForMove] = useState<string>("");
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "WASTE" | "RETURN" | "TRANSFER" | "USAGE">("TRANSFER");
  const [movementNote, setMovementNote] = useState<string>("");
  const [movementQuantity, setMovementQuantity] = useState<number>(1);
  const [movementUnitMode, setMovementUnitMode] = useState<"PURCHASE" | "BASE">("PURCHASE");
  const [movementTargetStation, setMovementTargetStation] = useState<string>("BAR");
  const [isDirectUsage, setIsDirectUsage] = useState<boolean>(true);

  // Quick Open Transfer Modal (Ambil dari Gudang ke Bar / Dapur)
  const handleOpenTransferModal = (ingredientId?: string) => {
    if (isReadOnly) return;
    if (!ingredientId && accessibleIngredients.length === 0) {
      toast.warning("Belum ada bahan baku terdaftar untuk stasiun Anda.");
      return;
    }
    const targetId = ingredientId || (accessibleIngredients.length > 0 ? accessibleIngredients[0].id : "");
    setSelectedIngredientForMove(targetId);
    setMovementType("TRANSFER");
    const ing = ingredients.find((i) => i.id === targetId);
    setMovementTargetStation(
      resolveDefaultTransferStation({
        ingredientStorageLocation: ing?.storageLocation,
        userDivision,
      })
    );
    const conv = ing ? getIngredientUnitConversion(ing) : null;
    setMovementUnitMode(conv?.hasConversion ? "PURCHASE" : "BASE");
    setMovementQuantity(1);
    setMovementNote("Ambil pemakaian harian");
    setIsDirectUsage(true);
    setIsAddMovementOpen(true);
  };

  // Kategori Bahan Dinamis (dari Settings + kategori aktual pada daftar bahan)
  const ingredientCategoriesList = useMemo(
    () => buildIngredientCategoryList(settings?.ingredientCategories, ingredients),
    [settings?.ingredientCategories, ingredients]
  );

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCatOld, setEditingCatOld] = useState<string | null>(null);
  const [editingCatNew, setEditingCatNew] = useState("");
  const [catToDelete, setCatToDelete] = useState<string | null>(null);

  const [ingredientEntryMode, setIngredientEntryMode] = useState<"MENTAH" | "OLAHAN">("MENTAH");
  const [batchTotalCost, setBatchTotalCost] = useState<number>(38000);
  const [batchYieldOutput, setBatchYieldOutput] = useState<number>(1000);
  const [isInlineNewCatOpen, setIsInlineNewCatOpen] = useState(false);
  const [inlineNewCatInput, setInlineNewCatInput] = useState("");
  const [newCategoryDivision, setNewCategoryDivision] = useState<IngredientCategoryDivision>("BAR");

  const CATEGORY_DIVISION_OPTIONS: { value: IngredientCategoryDivision; label: string }[] = [
    { value: "BAR", label: "Bar / Minuman" },
    { value: "KITCHEN", label: "Kitchen / Dapur" },
    { value: "BAKER", label: "Bakery & Pastry" },
    { value: "OPERATIONAL", label: "Operasional / Bersama" },
  ];

  const getCategoryDivisionLabel = (catName: string) => {
    const div = resolveIngredientCategoryDivision(catName, settings?.ingredientCategoryDivisions);
    return (
      CATEGORY_DIVISION_OPTIONS.find((o) => o.value === div)?.label || "Operasional / Bersama"
    );
  };

  const toCategoryDivisionScope = (
    rawDiv: "ALL" | "BAR" | "KITCHEN" | "BAKER" | "BAKERY" | "OPERATIONAL"
  ): "ALL" | IngredientCategoryDivision => {
    if (rawDiv === "BAKERY") return "BAKER";
    return rawDiv;
  };

  const visibleCategoriesForDaftar = useMemo(() => {
    const scope = isManagerOrAdmin
      ? toCategoryDivisionScope(selectedDivision)
      : userDivision;
    return filterIngredientCategoriesByDivision(
      ingredientCategoriesList,
      scope,
      settings?.ingredientCategoryDivisions
    );
  }, [
    ingredientCategoriesList,
    isManagerOrAdmin,
    selectedDivision,
    userDivision,
    settings?.ingredientCategoryDivisions,
  ]);

  const visibleCategoriesForManage = useMemo(() => {
    if (isManagerOrAdmin) return ingredientCategoriesList;
    return filterIngredientCategoriesByDivision(
      ingredientCategoriesList,
      userDivision,
      settings?.ingredientCategoryDivisions
    );
  }, [
    ingredientCategoriesList,
    isManagerOrAdmin,
    userDivision,
    settings?.ingredientCategoryDivisions,
  ]);

  const persistCategories = (
    nextCategories: string[],
    nextDivisions?: Record<string, IngredientCategoryDivision>
  ) => {
    updateSettings({
      ...settings,
      ingredientCategories: nextCategories,
      ingredientCategoryDivisions:
        nextDivisions ?? settings?.ingredientCategoryDivisions,
    });
  };

  const handleChangeCategoryDivision = (
    catName: string,
    division: IngredientCategoryDivision
  ) => {
    if (!canManageCategories) return;
    const nextDivisions: Record<string, IngredientCategoryDivision> = {
      ...(settings?.ingredientCategoryDivisions || {}),
      [catName]: division,
    };
    persistCategories(ingredientCategoriesList, nextDivisions);
    toast.success(`Kategori "${catName}" ditetapkan untuk divisi ${CATEGORY_DIVISION_OPTIONS.find((o) => o.value === division)?.label || division}.`);
  };

  const handleAddCategory = (
    rawName: string,
    divisionOverride?: IngredientCategoryDivision
  ): string | null => {
    if (!canManageCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori bahan.");
      return null;
    }
    const clean = rawName.trim();
    if (!clean) {
      toast.error("Nama kategori tidak boleh kosong.");
      return null;
    }
    const existing = ingredientCategoriesList.find(
      (c) => c.toLowerCase() === clean.toLowerCase()
    );
    if (existing) {
      toast.error(`Kategori "${existing}" sudah ada.`);
      return existing;
    }
    const baseWithoutLainnya = ingredientCategoriesList.filter(
      (c) => c.toLowerCase() !== "lainnya"
    );
    const hasLainnya = ingredientCategoriesList.some(
      (c) => c.toLowerCase() === "lainnya"
    );
    const next = hasLainnya
      ? [...baseWithoutLainnya, clean, "Lainnya"]
      : [...baseWithoutLainnya, clean];
    const targetDiv = divisionOverride || newCategoryDivision;
    const nextDivisions: Record<string, IngredientCategoryDivision> = {
      ...(settings?.ingredientCategoryDivisions || {}),
      [clean]: targetDiv,
    };
    persistCategories(next, nextDivisions);
    toast.success(`Kategori "${clean}" (${CATEGORY_DIVISION_OPTIONS.find((o) => o.value === targetDiv)?.label || targetDiv}) ditambahkan.`);
    return clean;
  };

  const handleSaveRenameCategory = (oldName: string) => {
    if (!canManageCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori bahan.");
      return;
    }
    const cleanNew = editingCatNew.trim();
    if (!cleanNew) {
      toast.error("Nama kategori baru tidak boleh kosong.");
      return;
    }
    if (
      cleanNew.toLowerCase() !== oldName.toLowerCase() &&
      ingredientCategoriesList.some((c) => c.toLowerCase() === cleanNew.toLowerCase())
    ) {
      toast.error(`Kategori "${cleanNew}" sudah digunakan.`);
      return;
    }
    const { updatedCategories, updatedIngredients } = applyRenameIngredientCategory({
      currentList: ingredientCategoriesList,
      oldName,
      newName: cleanNew,
      ingredients,
    });
    const currentDivMap = { ...(settings?.ingredientCategoryDivisions || {}) };
    const prevOwner = resolveIngredientCategoryDivision(oldName, currentDivMap);
    delete currentDivMap[oldName];
    currentDivMap[cleanNew] = prevOwner;
    persistCategories(updatedCategories, currentDivMap);
    updatedIngredients.forEach((updatedIng) => updateIngredient(updatedIng));
    if (selectedCategory === oldName) setSelectedCategory(cleanNew);
    setEditingCatOld(null);
    setEditingCatNew("");
    toast.success(`Kategori "${oldName}" diperbarui menjadi "${cleanNew}".`);
  };

  const handleConfirmDeleteCategory = () => {
    if (!canManageCategories) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengelola kategori bahan.");
      setCatToDelete(null);
      return;
    }
    if (!catToDelete) return;
    if (catToDelete.toLowerCase() === "lainnya") {
      toast.error('Kategori "Lainnya" adalah cadangan bawaan dan tidak dapat dihapus.');
      setCatToDelete(null);
      return;
    }
    const { updatedCategories, updatedIngredients, fallbackCategory } =
      applyDeleteIngredientCategory({
        currentList: ingredientCategoriesList,
        targetName: catToDelete,
        ingredients,
      });
    const currentDivMap = { ...(settings?.ingredientCategoryDivisions || {}) };
    delete currentDivMap[catToDelete];
    persistCategories(updatedCategories, currentDivMap);
    updatedIngredients.forEach((updatedIng) => updateIngredient(updatedIng));
    if (selectedCategory === catToDelete) setSelectedCategory("ALL");
    toast.success(
      `Kategori "${catToDelete}" dihapus. Bahan terkait dipindahkan ke "${fallbackCategory}".`
    );
    setCatToDelete(null);
  };

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
    useBulkUnit: false,
    bulkUnit: "Karton",
    bulkPerPurchase: 12,
    bulkPrice: 0,
    costPerUnit: 220,
    initialStockUnit: "BASE" as "BASE" | "PURCHASE",
    stockInput: 0,
    minStock: 500,
    notes: "",
  });

  // OPNAME STATE
  const [isOpnameMode, setIsOpnameMode] = useState(false);
  const [opnameId, setOpnameId] = useState("");
  const [opnameDate, setOpnameDate] = useState<string>(() => getLocalDateString());
  const [opnameItems, setOpnameItems] = useState<{ ingredientId: string; physicalStock: number; difference: number; notes: string }[]>([]);
  const [opnameSearch, setOpnameSearch] = useState("");
  const [opnameDivisionFilter, setOpnameDivisionFilter] = useState<"ALL" | "BAR" | "KITCHEN" | "BAKERY" | "OPERATIONAL">(defaultDivisionFilter);
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState("ALL");
  const [opnameInputMode, setOpnameInputMode] = useState<"BASE" | "PURCHASE">("PURCHASE");
  const [rowUnitModes, setRowUnitModes] = useState<Record<string, "PURCHASE" | "BASE">>({});
  const [opnameInputDrafts, setOpnameInputDrafts] = useState<Record<string, string>>({});
  const [selectedOpnameForView, setSelectedOpnameForView] = useState<StockOpname | null>(null);
  const [draftToDeleteId, setDraftToDeleteId] = useState<string | null>(null);
  const [isCancelOpnameConfirmOpen, setIsCancelOpnameConfirmOpen] = useState(false);
  const [isFinalizeOpnameConfirmOpen, setIsFinalizeOpnameConfirmOpen] = useState(false);

  // Accessible ingredients according to user's station
  const accessibleIngredients = useMemo(() => {
    if (isManagerOrAdmin) return ingredients;
    return ingredients.filter((i) => isIngredientAllowedForUser(i, userDivision));
  }, [ingredients, isManagerOrAdmin, userDivision]);

  const opnameBenchmark = useMemo(() => {
    const endDate = (isOpnameMode && opnameDate ? opnameDate : getLocalDateString()).slice(0, 10);
    const prevFinalDates = stockOpnames
      .filter((op) => op.status === "FINAL" && op.date && op.date.slice(0, 10) < endDate)
      .map((op) => op.date.slice(0, 10))
      .sort((a, b) => b.localeCompare(a));
    const startDate =
      prevFinalDates.length > 0
        ? addDaysToLocalDate(prevFinalDates[0], 1)
        : addDaysToLocalDate(endDate, -6);

    const salesAnalytics = computeProductSalesAnalytics({
      salesTransactions,
      products,
      recipes,
      ingredients,
      menuCategoriesByDivision: settings?.menuCategories,
      dateMode: "DATE_RANGE",
      singleDate: endDate,
      startDate,
      endDate,
    });
    const physicalOutMap = computePhysicalStockOutByIngredient({
      stockMovements,
      startDate,
      endDate,
    });

    const recipeUsageByIngId = new Map(
      salesAnalytics.ingredientUsageSummary.map((row) => [row.ingredientId, row])
    );

    let recipeCost = 0;
    for (const row of salesAnalytics.ingredientUsageSummary) {
      recipeCost += row.totalCost;
    }
    let physicalOutCost = 0;
    for (const row of physicalOutMap.values()) {
      physicalOutCost += row.totalOutCost;
    }

    return {
      startDate,
      endDate,
      totalHpp: salesAnalytics.kpiSummary.totalHpp,
      foodCostPercent: salesAnalytics.kpiSummary.foodCostPercent,
      totalQtySold: salesAnalytics.kpiSummary.totalQty,
      recipeCost: Math.round(recipeCost),
      physicalOutCost: Math.round(physicalOutCost),
      recipeUsageByIngId,
      physicalOutMap,
    };
  }, [
    isOpnameMode,
    opnameDate,
    stockOpnames,
    salesTransactions,
    products,
    recipes,
    ingredients,
    settings?.menuCategories,
    stockMovements,
  ]);

  const activeDrafts = useMemo(() => {
    return stockOpnames.filter((op) => op.status === "DRAFT");
  }, [stockOpnames]);

  const latestDraft = activeDrafts.length > 0 ? activeDrafts[activeDrafts.length - 1] : null;

  // Open Modal for New Ingredient (Bahan Baku Mentah atau Bahan Olahan)
  const handleOpenAddIngredient = (mode: "MENTAH" | "OLAHAN" = "MENTAH", presetCat?: string) => {
    setEditingIngredient(null);
    setIngredientEntryMode(mode);
    setIsInlineNewCatOpen(false);
    setInlineNewCatInput("");
    const defaultLoc = userDivision === "KITCHEN" ? "KITCHEN" : userDivision === "BAKER" ? "BAKERY" : "BAR";
    if (mode === "OLAHAN") {
      setBatchTotalCost(38000);
      setBatchYieldOutput(1000);
      setIngredientForm({
        code: `OLH-${Math.floor(100 + Math.random() * 900)}`,
        name: "",
        category: presetCat || "Bahan Olahan",
        storageLocation: defaultLoc,
        unit: "ml",
        usePurchaseUnit: false,
        purchaseUnit: "Liter",
        conversionFactor: 1000,
        purchasePrice: 38000,
        useBulkUnit: false,
        bulkUnit: "Karton",
        bulkPerPurchase: 12,
        bulkPrice: 0,
        costPerUnit: 38,
        initialStockUnit: "BASE",
        stockInput: 1000,
        minStock: 300,
        notes: "Bahan olahan / racikan internal toko",
      });
    } else {
      setIngredientForm({
        code: `BB-${Math.floor(100 + Math.random() * 900)}`,
        name: "",
        category: presetCat || (selectedCategory !== "ALL" ? selectedCategory : (visibleCategoriesForDaftar[0] || "Biji Kopi")),
        storageLocation: defaultLoc,
        unit: "gr",
        usePurchaseUnit: true,
        purchaseUnit: "Kg",
        conversionFactor: 1000,
        purchasePrice: 220000,
        useBulkUnit: false,
        bulkUnit: "Karton",
        bulkPerPurchase: 12,
        bulkPrice: 0,
        costPerUnit: 220,
        initialStockUnit: "BASE",
        stockInput: 1000,
        minStock: 500,
        notes: "",
      });
    }
    setIsIngredientModalOpen(true);
  };

  // Open Modal for Editing Ingredient
  const handleOpenEditIngredient = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setIsInlineNewCatOpen(false);
    setInlineNewCatInput("");
    const canonicalCat = normalizeIngredientCategoryName(ing.category);
    const matchedListCat =
      ingredientCategoriesList.find((c) => c.toLowerCase() === ing.category.trim().toLowerCase()) ||
      ingredientCategoriesList.find((c) => c.toLowerCase() === canonicalCat.toLowerCase()) ||
      ing.category;
    const isOlahan = matchesIngredientCategory(ing.category, "Bahan Olahan") && !ing.purchaseUnit;
    setIngredientEntryMode(isOlahan ? "OLAHAN" : "MENTAH");

    const hasPurchase = !!ing.purchaseUnit;
    const factor = ing.conversionFactor || 1000;
    const pPrice = ing.purchasePrice || (ing.costPerUnit * factor);
    const hasBulk = Boolean(ing.bulkUnit && Number(ing.bulkConversionFactor) > 0);
    const bulkTotalBase = Number(ing.bulkConversionFactor) || (hasPurchase ? factor * 12 : 12);
    const computedBulkPerPurchase = hasPurchase && factor > 0
      ? Math.max(1, Math.round((bulkTotalBase / factor) * 1000) / 1000)
      : bulkTotalBase;

    setBatchYieldOutput(1000);
    setBatchTotalCost(Math.round((ing.costPerUnit || 0) * 1000));

    setIngredientForm({
      code: ing.code || "",
      name: ing.name,
      category: matchedListCat,
      storageLocation: (ing.storageLocation as any) || "BAR",
      unit: ing.unit,
      usePurchaseUnit: hasPurchase,
      purchaseUnit: ing.purchaseUnit || "Kg",
      conversionFactor: factor,
      purchasePrice: pPrice,
      useBulkUnit: hasBulk,
      bulkUnit: ing.bulkUnit || "Karton",
      bulkPerPurchase: computedBulkPerPurchase,
      bulkPrice: ing.bulkPrice || 0,
      costPerUnit: ing.costPerUnit || 0,
      initialStockUnit: "BASE",
      stockInput: ing.currentStock,
      minStock: ing.minStock,
      notes: ing.notes || "",
    });
    setIsIngredientModalOpen(true);
  };

  // Auto calculate costPerUnit when purchasePrice / conversionFactor or OLAHAN batch changes
  const computedCostPerUnit = useMemo(() => {
    if (ingredientEntryMode === "OLAHAN") {
      if (batchYieldOutput > 0) {
        return Math.round(Math.max(0, batchTotalCost) / batchYieldOutput);
      }
      return 0;
    }
    if (!ingredientForm.usePurchaseUnit) {
      return Number(ingredientForm.costPerUnit) || 0;
    }
    if (ingredientForm.conversionFactor > 0 && ingredientForm.purchasePrice > 0) {
      return Math.round(ingredientForm.purchasePrice / ingredientForm.conversionFactor);
    }
    return 0;
  }, [
    ingredientEntryMode,
    batchTotalCost,
    batchYieldOutput,
    ingredientForm.usePurchaseUnit,
    ingredientForm.purchasePrice,
    ingredientForm.conversionFactor,
    ingredientForm.costPerUnit,
  ]);

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
    if (isReadOnly) return;
    if (!ingredientForm.name.trim()) {
      toast.error("Nama bahan baku tidak boleh kosong.");
      return;
    }

    const usePurchase = ingredientEntryMode === "MENTAH" && ingredientForm.usePurchaseUnit;
    if (ingredientEntryMode === "OLAHAN" && !(batchYieldOutput > 0)) {
      toast.error("Total hasil jadi (yield) harus lebih dari 0.");
      return;
    }
    if (usePurchase && !(Number(ingredientForm.conversionFactor) > 0)) {
      toast.error("Isi per kemasan harus lebih dari 0.");
      return;
    }
    const calculatedStock =
      ingredientForm.initialStockUnit === "PURCHASE" && usePurchase
        ? Number(ingredientForm.stockInput) * Number(ingredientForm.conversionFactor)
        : Number(ingredientForm.stockInput);

    const hasBulk =
      ingredientEntryMode === "MENTAH" &&
      ingredientForm.useBulkUnit &&
      ingredientForm.bulkUnit.trim().length > 0 &&
      Number(ingredientForm.bulkPerPurchase) > 0;
    const bulkTotalBase = hasBulk
      ? Number(
          (
            Number(ingredientForm.bulkPerPurchase) *
            (usePurchase ? Number(ingredientForm.conversionFactor) || 1 : 1)
          ).toFixed(4)
        )
      : undefined;

    const payload: Omit<Ingredient, "id"> = {
      code: ingredientForm.code.trim() || undefined,
      name: ingredientForm.name.trim(),
      category: ingredientForm.category,
      unit: ingredientForm.unit.trim().toLowerCase(),
      currentStock: Math.max(0, calculatedStock),
      minStock: Math.max(0, Number(ingredientForm.minStock) || 0),
      costPerUnit: computedCostPerUnit,
      purchaseUnit: usePurchase ? ingredientForm.purchaseUnit : undefined,
      conversionFactor: usePurchase ? Number(ingredientForm.conversionFactor) : undefined,
      purchasePrice: usePurchase ? Number(ingredientForm.purchasePrice) : undefined,
      bulkUnit: hasBulk ? ingredientForm.bulkUnit.trim() : undefined,
      bulkConversionFactor: bulkTotalBase,
      bulkPrice: hasBulk && Number(ingredientForm.bulkPrice) > 0 ? Math.round(Number(ingredientForm.bulkPrice)) : undefined,
      storageLocation: ingredientForm.storageLocation,
      notes: ingredientForm.notes.trim() || undefined,
    };

    if (editingIngredient) {
      updateIngredient({
        ...editingIngredient,
        ...payload,
      });
      toast.success(`Bahan "${payload.name}" berhasil diperbarui.`);
    } else {
      addIngredient(payload);
      toast.success(
        `${ingredientEntryMode === "OLAHAN" ? "Bahan olahan" : "Bahan baku"} "${payload.name}" berhasil ditambahkan.`
      );
    }

    setIsIngredientModalOpen(false);
  };

  const visibleCategoriesForOpname = useMemo(() => {
    const scope = isManagerOrAdmin
      ? toCategoryDivisionScope(opnameDivisionFilter)
      : userDivision;
    return filterIngredientCategoriesByDivision(
      ingredientCategoriesList,
      scope,
      settings?.ingredientCategoryDivisions
    );
  }, [
    ingredientCategoriesList,
    isManagerOrAdmin,
    opnameDivisionFilter,
    userDivision,
    settings?.ingredientCategoryDivisions,
  ]);

  useEffect(() => {
    if (
      selectedCategory !== "ALL" &&
      !visibleCategoriesForDaftar.some((c) => matchesIngredientCategory(c, selectedCategory))
    ) {
      setSelectedCategory("ALL");
    }
  }, [visibleCategoriesForDaftar, selectedCategory]);

  useEffect(() => {
    if (
      opnameCategoryFilter !== "ALL" &&
      !visibleCategoriesForOpname.some((c) => matchesIngredientCategory(c, opnameCategoryFilter))
    ) {
      setOpnameCategoryFilter("ALL");
    }
  }, [visibleCategoriesForOpname, opnameCategoryFilter]);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((i) => {
      // Station division isolation for non-manager/admin
      if (!isIngredientAllowedForUser(i, userDivision)) {
        return false;
      }

      const matchSearch =
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchDivision = true;
      if (selectedDivision === "BAR") {
        matchDivision = isBarItem(i);
      } else if (selectedDivision === "KITCHEN") {
        matchDivision = isKitchenItem(i);
      } else if (selectedDivision === "BAKERY") {
        matchDivision = isBakeryItem(i);
      } else if (selectedDivision === "OPERATIONAL") {
        matchDivision = isOperationalItem(i);
      }

      const matchCategory =
        selectedCategory === "ALL" ||
        matchesIngredientCategory(i.category, selectedCategory);

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
  }, [ingredients, searchTerm, selectedDivision, selectedCategory, selectedLocation, selectedStockStatus, userDivision]);

  // Overall statistics (scoped to accessible ingredients for station staff)
  const totalValuation = useMemo(() => {
    return accessibleIngredients.reduce((sum, ing) => sum + (ing.currentStock * (ing.costPerUnit || 0)), 0);
  }, [accessibleIngredients]);

  const lowStockCount = useMemo(() => {
    return accessibleIngredients.filter((i) => i.currentStock <= i.minStock).length;
  }, [accessibleIngredients]);

  const outOfStockCount = useMemo(() => {
    return accessibleIngredients.filter((i) => i.currentStock <= 0).length;
  }, [accessibleIngredients]);

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.menuName.toLowerCase().includes(q));
  }, [recipes, recipeSearch]);

  const filteredMovements = useMemo(() => {
    const q = movementSearch.trim().toLowerCase();
    return stockMovements
      .filter((m) => {
        const ingredient = ingredients.find((i) => i.id === m.ingredientId);
        if (!ingredient) return false;
        if (!isIngredientAllowedForUser(ingredient, userDivision)) return false;
        if (!q) return true;
        return (
          ingredient.name.toLowerCase().includes(q) ||
          (m.note && m.note.toLowerCase().includes(q)) ||
          (m.createdBy && m.createdBy.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stockMovements, ingredients, movementSearch, userDivision]);

  // Waste Analytics & Incident Logs (scoped to user division)
  const wasteMovements = useMemo(() => {
    return stockMovements
      .filter((m) => {
        if (m.type !== "WASTE") return false;
        const ing = ingredients.find((i) => i.id === m.ingredientId);
        return ing ? isIngredientAllowedForUser(ing, userDivision) : isManagerOrAdmin;
      })
      .map((m) => {
        const ing = ingredients.find((i) => i.id === m.ingredientId);
        const qty = Math.abs(Number(m.quantity) || 0);
        const unitCost = m.unitCost || (ing ? ing.costPerUnit : 0) || 0;
        const totalCost = m.totalCost !== undefined && m.totalCost !== null ? m.totalCost : Math.round(qty * unitCost);

        let reasonKey = "LAINNYA";
        let cleanNote = m.note || "";
        const match = m.note?.match(/^\[([A-Z_]+)\]\s*(.*)$/);
        if (match) {
          reasonKey = match[1];
          cleanNote = match[2];
        } else if (m.note?.toLowerCase().includes("kalibrasi") || m.note?.toLowerCase().includes("dialing")) {
          reasonKey = "KALIBRASI";
        } else if (m.note?.toLowerCase().includes("salah") || m.note?.toLowerCase().includes("mistake")) {
          reasonKey = "SALAH_BUAT";
        } else if (m.note?.toLowerCase().includes("tumpah") || m.note?.toLowerCase().includes("spill") || m.note?.toLowerCase().includes("steaming")) {
          reasonKey = "TUMPAH";
        } else if (m.note?.toLowerCase().includes("expired") || m.note?.toLowerCase().includes("basi") || m.note?.toLowerCase().includes("kedaluwarsa")) {
          reasonKey = "KEDALUWARSA";
        } else if (m.note?.toLowerCase().includes("rusak") || m.note?.toLowerCase().includes("bocor") || m.note?.toLowerCase().includes("refund")) {
          reasonKey = "RUSAK";
        }

        return {
          ...m,
          ingredient: ing,
          actualQty: qty,
          unitCost,
          totalCost,
          reasonKey,
          cleanNote,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stockMovements, ingredients, userDivision, isManagerOrAdmin]);

  // Scoped & Filtered Waste Movements
  const filteredWasteMovements = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return wasteMovements.filter((m) => {
      if (m.ingredient && !isIngredientAllowedForUser(m.ingredient, userDivision)) {
        return false;
      }
      if (wasteFilterReason !== "ALL" && m.reasonKey !== wasteFilterReason) {
        return false;
      }
      const mTime = new Date(m.date).getTime();
      if (wasteFilterPeriod === "TODAY" && mTime < startOfToday) return false;
      if (wasteFilterPeriod === "LAST_7_DAYS" && mTime < sevenDaysAgo) return false;
      if (wasteFilterPeriod === "THIS_MONTH" && mTime < startOfMonth) return false;

      if (wasteSearch.trim()) {
        const q = wasteSearch.toLowerCase();
        const matchIng = m.ingredient?.name.toLowerCase().includes(q) || false;
        const matchNote = m.note?.toLowerCase().includes(q) || false;
        const matchUser = m.createdBy?.toLowerCase().includes(q) || false;
        if (!matchIng && !matchNote && !matchUser) return false;
      }

      return true;
    });
  }, [wasteMovements, userDivision, wasteFilterReason, wasteFilterPeriod, wasteSearch]);

  // Waste KPI Statistics
  const wasteKpis = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthRecords = wasteMovements.filter((m) => new Date(m.date).getTime() >= startOfMonth);
    const totalLossMonth = monthRecords.reduce((sum, m) => sum + (m.totalCost || 0), 0);
    const totalIncidentsMonth = monthRecords.length;

    // Reason breakdown for month
    const reasonMap: Record<string, number> = {};
    monthRecords.forEach((m) => {
      reasonMap[m.reasonKey] = (reasonMap[m.reasonKey] || 0) + (m.totalCost || 0);
    });
    const sortedReasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
    const topReasonKey = sortedReasons[0]?.[0];
    const topReasonLoss = sortedReasons[0]?.[1] || 0;
    const topReasonObj = WASTE_REASONS_DETAIL.find((r) => r.id === topReasonKey);
    const topReasonPercent = totalLossMonth > 0 ? Math.round((topReasonLoss / totalLossMonth) * 100) : 0;

    // Ratio vs Total Valuation
    const ratio = totalValuation > 0 ? (totalLossMonth / totalValuation) * 100 : 0;

    // Top wasted ingredient
    const ingMap: Record<string, { name: string; cost: number; qty: number; unit: string }> = {};
    monthRecords.forEach((m) => {
      if (!m.ingredient) return;
      if (!ingMap[m.ingredientId]) {
        ingMap[m.ingredientId] = { name: m.ingredient.name, cost: 0, qty: 0, unit: m.ingredient.unit };
      }
      ingMap[m.ingredientId].cost += m.totalCost || 0;
      ingMap[m.ingredientId].qty += m.actualQty;
    });
    const topIng = Object.values(ingMap).sort((a, b) => b.cost - a.cost)[0] || null;

    return {
      totalLossMonth,
      totalIncidentsMonth,
      topReasonLabel: topReasonObj ? topReasonObj.label : topReasonKey || "-",
      topReasonPercent,
      ratio,
      topIng,
    };
  }, [wasteMovements, totalValuation]);

  // Anomaly warnings: ingredients wasted >= 3 times or >= Rp 50.000 in past 7 days
  const wasteAnomalies = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentWaste = wasteMovements.filter((m) => new Date(m.date).getTime() >= sevenDaysAgo);
    const countByIng: Record<string, { count: number; totalCost: number; name: string; unit: string; totalQty: number; reasons: Set<string> }> = {};

    recentWaste.forEach((m) => {
      if (!m.ingredient) return;
      if (!countByIng[m.ingredientId]) {
        countByIng[m.ingredientId] = {
          count: 0,
          totalCost: 0,
          name: m.ingredient.name,
          unit: m.ingredient.unit,
          totalQty: 0,
          reasons: new Set(),
        };
      }
      countByIng[m.ingredientId].count += 1;
      countByIng[m.ingredientId].totalCost += m.totalCost || 0;
      countByIng[m.ingredientId].totalQty += m.actualQty;
      countByIng[m.ingredientId].reasons.add(m.reasonKey);
    });

    return Object.values(countByIng)
      .filter((item) => item.count >= 3 || item.totalCost >= 50000)
      .map((item) => ({
        ...item,
        reasonList: Array.from(item.reasons)
          .map((rKey) => WASTE_REASONS_DETAIL.find((r) => r.id === rKey)?.label || rKey)
          .join(", "),
      }));
  }, [wasteMovements]);

  // Export Waste Logs to CSV
  const handleExportWasteCsv = () => {
    if (filteredWasteMovements.length === 0) {
      toast.warning("Tidak ada catatan waste untuk diekspor.");
      return;
    }

    const headers = [
      "Tanggal",
      "Waktu",
      "Kode Bahan",
      "Nama Bahan",
      "Kategori",
      "Lokasi Simpan",
      "Alasan Terstandar",
      "Jumlah Terbuang",
      "Satuan",
      "Biaya Modal Satuan (Rp)",
      "Total Nilai Kerugian (Rp)",
      "Operator",
      "Catatan",
    ];

    const rows = filteredWasteMovements.map((m) => {
      const d = new Date(m.date);
      const reasonObj = WASTE_REASONS_DETAIL.find((r) => r.id === m.reasonKey);
      return [
        d.toLocaleDateString("id-ID"),
        d.toLocaleTimeString("id-ID"),
        m.ingredient?.code || "-",
        m.ingredient?.name || "Bahan Terhapus",
        m.ingredient?.category || "-",
        m.ingredient?.storageLocation || "-",
        reasonObj?.label || m.reasonKey,
        m.actualQty,
        m.ingredient?.unit || "unit",
        m.unitCost,
        m.totalCost,
        m.createdBy || "-",
        m.cleanNote || "-",
      ];
    });

    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_waste_kerusakan_${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${filteredWasteMovements.length} catatan waste berhasil diekspor ke CSV.`);
  };

  // Import CSV / Excel
  const handleImportIngredients = (data: any[]) => {
    if (isReadOnly || userRole === "LEADER") return;
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
      toast.success(`Berhasil menambahkan ${imported} data bahan baru dan memperbarui ${updated} data.`);
    } else {
      toast.warning("Tidak ada data valid yang diimpor. Pastikan file Excel/CSV berisi kolom 'Nama Bahan' dan 'Satuan Resep'.");
    }
  };

  // Handle Add Movement
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedIngredientForMove || movementQuantity <= 0) {
      toast.error("Pilih bahan baku dan masukkan jumlah yang valid (> 0).");
      return;
    }

    const ing = ingredients.find((i) => i.id === selectedIngredientForMove);
    const conv = ing ? getIngredientUnitConversion(ing) : null;
    const { actualQuantity, unitCost, totalCost: cost } =
      computeMovementActualQuantityAndCost({
        quantity: movementQuantity,
        unitMode: movementUnitMode,
        hasConversion: Boolean(conv?.hasConversion),
        conversionFactor: conv?.conversionFactor,
        costPerUnit: ing?.costPerUnit || 0,
      });

    let defaultNote = "Mutasi Operasional";
    if (movementType === "TRANSFER") {
      defaultNote = `Ambil dari Gudang ke ${movementTargetStation}${conv?.hasConversion && movementUnitMode === "PURCHASE" ? ` (${movementQuantity} ${conv.purchaseUnit} = ${actualQuantity.toLocaleString("id-ID")} ${ing?.unit})` : ""}`;
    } else if (movementType === "WASTE") {
      defaultNote = "Bahan Rusak / Kalibrasi Barista";
    }

    const finalType = (movementType === "TRANSFER" && isDirectUsage) ? "USAGE" : movementType;

    addStockMovement({
      ingredientId: selectedIngredientForMove,
      type: finalType,
      quantity: actualQuantity,
      date: new Date().toISOString(),
      note: movementNote.trim() || defaultNote,
      unitCost,
      totalCost: cost,
      createdBy: currentUser?.name || "Barista / Cook",
      location: (movementTargetStation as any) || (ing?.storageLocation as any) || "BAR",
    } as any);

    toast.success(`Mutasi "${ing?.name || "Bahan"}" (${actualQuantity.toLocaleString("id-ID")} ${ing?.unit || "unit"}) berhasil dicatat.`);
    setIsAddMovementOpen(false);
    setMovementQuantity(1);
    setMovementNote("");
  };

  // Stock Opname
  const startOpname = () => {
    if (isReadOnly) return;
    // Filter relevant ingredients according to user's division permissions
    const relevantIngredients = isManagerOrAdmin
      ? ingredients
      : ingredients.filter((ing) => isIngredientAllowedForUser(ing, userDivision));

    if (relevantIngredients.length === 0) {
      toast.warning("Belum ada bahan baku terdaftar untuk stasiun Anda.");
      return;
    }

    const newId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "op_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    setOpnameId(newId);
    setOpnameDate(getLocalDateString());

    setOpnameItems(
      relevantIngredients.map((ing) => ({
        ingredientId: ing.id,
        physicalStock: ing.currentStock,
        difference: 0,
        notes: "",
      }))
    );

    const initialDrafts: Record<string, string> = {};
    relevantIngredients.forEach((ing) => {
      const conv = getIngredientUnitConversion(ing);
      const isPurchase = opnameInputMode === "PURCHASE" && conv.hasConversion;
      const displayVal = isPurchase
        ? (Math.round((ing.currentStock / conv.conversionFactor) * 1000) / 1000).toString()
        : ing.currentStock.toString();
      initialDrafts[ing.id] = displayVal;
    });

    setOpnameInputDrafts(initialDrafts);
    setRowUnitModes({});
    setOpnameSearch("");
    setOpnameCategoryFilter("ALL");
    setOpnameDivisionFilter(defaultDivisionFilter);
    setIsOpnameMode(true);
  };

  const handleResumeDraft = (draft: StockOpname) => {
    if (isReadOnly) return;
    setOpnameId(draft.id);
    setOpnameDate((draft.date || "").slice(0, 10) || getLocalDateString());
    const draftItems = stockOpnameItems.filter((i) => i.opnameId === draft.id);

    const relevantIngredients = isManagerOrAdmin
      ? ingredients
      : ingredients.filter((ing) => isIngredientAllowedForUser(ing, userDivision));

    const populatedItems = relevantIngredients.map((ing) => {
      const foundDraftItem = draftItems.find((di) => di.ingredientId === ing.id);
      if (foundDraftItem) {
        const physicalStock = Math.max(0, Number(foundDraftItem.physicalStock) || 0);
        return {
          ingredientId: ing.id,
          physicalStock,
          difference: physicalStock - ing.currentStock,
          notes: foundDraftItem.notes || "",
        };
      }
      return {
        ingredientId: ing.id,
        physicalStock: ing.currentStock,
        difference: 0,
        notes: "",
      };
    });

    setOpnameItems(populatedItems);

    const populatedDrafts: Record<string, string> = {};
    populatedItems.forEach((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (!ing) return;
      const conv = getIngredientUnitConversion(ing);
      const isPurchase = opnameInputMode === "PURCHASE" && conv.hasConversion;
      const displayVal = isPurchase
        ? (Math.round((item.physicalStock / conv.conversionFactor) * 1000) / 1000).toString()
        : item.physicalStock.toString();
      populatedDrafts[item.ingredientId] = displayVal;
    });

    setOpnameInputDrafts(populatedDrafts);
    setRowUnitModes({});
    setOpnameSearch("");
    setOpnameCategoryFilter("ALL");
    setOpnameDivisionFilter(defaultDivisionFilter);
    setIsOpnameMode(true);
    setSelectedOpnameForView(null);
  };

  const handleDeleteDraft = (draftId: string) => {
    if (isReadOnly) return;
    setDraftToDeleteId(draftId);
  };

  const handleToggleGlobalOpnameMode = () => {
    const nextMode: "BASE" | "PURCHASE" = opnameInputMode === "PURCHASE" ? "BASE" : "PURCHASE";
    setOpnameInputMode(nextMode);
    setRowUnitModes({});
    setOpnameInputDrafts(() => {
      const nextDrafts: Record<string, string> = {};
      opnameItems.forEach((item) => {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        if (!ing) return;
        const conv = getIngredientUnitConversion(ing);
        const isPurchase = nextMode === "PURCHASE" && conv.hasConversion;
        const val = isPurchase
          ? (Math.round((item.physicalStock / conv.conversionFactor) * 1000) / 1000).toString()
          : item.physicalStock.toString();
        nextDrafts[item.ingredientId] = val;
      });
      return nextDrafts;
    });
  };

  const handleToggleRowUnit = (ingredientId: string) => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing) return;
    const conv = getIngredientUnitConversion(ing);
    if (!conv.hasConversion) return;

    const currentMode = rowUnitModes[ingredientId] || opnameInputMode;
    const nextRowMode: "BASE" | "PURCHASE" = currentMode === "PURCHASE" ? "BASE" : "PURCHASE";

    setRowUnitModes((prev) => ({
      ...prev,
      [ingredientId]: nextRowMode,
    }));

    const item = opnameItems.find((i) => i.ingredientId === ingredientId);
    if (item) {
      const isPurchase = nextRowMode === "PURCHASE";
      const val = isPurchase
        ? (Math.round((item.physicalStock / conv.conversionFactor) * 1000) / 1000).toString()
        : item.physicalStock.toString();
      setOpnameInputDrafts((prev) => ({
        ...prev,
        [ingredientId]: val,
      }));
    }
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

  const handleOpnameInputChange = (ingredientId: string, typedText: string, isPurchase: boolean, factor: number) => {
    setOpnameInputDrafts((prev) => ({
      ...prev,
      [ingredientId]: typedText,
    }));

    const clean = typedText.trim().replace(",", ".");
    if (clean === "") {
      handleOpnameChange(ingredientId, 0);
      return;
    }

    const num = parseFloat(clean);
    if (!isNaN(num) && num >= 0) {
      const finalBaseQty = isPurchase ? Math.round(num * factor) : Math.round(num);
      handleOpnameChange(ingredientId, finalBaseQty);
    }
  };

  const handleOpnameNoteChange = (ingredientId: string, notes: string) => {
    setOpnameItems((prev) =>
      prev.map((item) =>
        item.ingredientId === ingredientId ? { ...item, notes } : item
      )
    );
  };

  const saveOpname = (status: "DRAFT" | "FINAL") => {
    if (isReadOnly) return;
    const chosenDate = (opnameDate || getLocalDateString()).slice(0, 10);
    if (
      status === "FINAL" &&
      closedPeriods.some((p) => p.period === chosenDate.slice(0, 7))
    ) {
      toast.error(
        `Periode ${chosenDate.slice(0, 7)} sudah ditutup buku. Finalisasi stok opname pada periode terkunci tidak diizinkan.`
      );
      return;
    }

    const existingOp = stockOpnames.find((op) => op.id === opnameId);
    const currentTimestamp = new Date().toISOString();
    const opnameTimestamp =
      chosenDate === getLocalDateString()
        ? currentTimestamp
        : new Date(`${chosenDate}T12:00:00`).toISOString();

    const opname: StockOpname = {
      id: opnameId,
      date: opnameTimestamp,
      status,
      notes: existingOp?.notes || (status === "DRAFT" ? "Draf Stok Opname" : "Stock Opname Periodik"),
      createdBy: existingOp?.createdBy || currentUser?.name || "System",
      createdAt: existingOp?.createdAt || currentTimestamp,
    };

    if (existingOp) {
      updateStockOpname(opname);
    } else {
      addStockOpname(opname);
    }

    const liveItems = recomputeOpnameItemsWithLiveStock(opnameItems, ingredients);

    const itemsToSave: StockOpnameItem[] = liveItems.map((item) => {
      const existingItem = stockOpnameItems.find(
        (oi) => oi.opnameId === opnameId && oi.ingredientId === item.ingredientId
      );
      const itemId = existingItem
        ? existingItem.id
        : typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "opi_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

      return {
        id: itemId,
        opnameId: opname.id,
        ingredientId: item.ingredientId,
        systemStock: item.systemStock,
        physicalStock: item.physicalStock,
        difference: item.difference,
        unitCost: item.unitCost,
        notes: item.notes || null,
      };
    });

    bulkAddStockOpnameItems(itemsToSave);

    if (status === "FINAL") {
      liveItems.forEach((item) => {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        if (item.difference !== 0) {
          addStockMovement({
            ingredientId: item.ingredientId,
            type: item.difference > 0 ? ("IN" as any) : ("OUT" as any),
            quantity: Math.abs(item.difference),
            date: opnameTimestamp,
            note: `Koreksi Hasil Opname (Sistem: ${item.systemStock}, Fisik: ${item.physicalStock})${item.notes ? ` - ${item.notes}` : ""}`,
            unitCost: item.unitCost,
            totalCost: item.adjustmentTotalCost,
            referenceId: opname.id,
            createdBy: currentUser?.name || "System",
            location: (ing?.storageLocation as any) || "BAR",
          });

          if (ing) {
            updateIngredient({
              ...ing,
              currentStock: item.physicalStock,
            });
          }
        }
      });
      toast.success("Stok opname berhasil difinalisasi! Snapshot nilai persediaan dan koreksi stok tercatat.");
    } else {
      toast.info("Draf stok opname berhasil disimpan! Anda dapat melanjutkannya kapan saja.");
    }

    setIsOpnameMode(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP EXECUTIVE KPI STATS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Valuasi Aset */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Valuasi Aset
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              {formatCurrency(totalValuation)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Dari <strong>{accessibleIngredients.length}</strong> bahan baku {!isManagerOrAdmin ? "stasiun Anda" : "terdaftar"}
            </p>
          </div>
        </div>

        {/* Bahan Menipis / Perlu Reorder */}
        <div className={`p-5 rounded-3xl bg-white border shadow-xs flex flex-col justify-between ${
          lowStockCount > 0 ? "border-amber-300 bg-amber-50/20" : "border-slate-200/80"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Perlu Reorder
            </span>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs ${
              lowStockCount > 0 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${
                lowStockCount > 0 ? "text-amber-800" : "text-slate-900"
              }`}>
                {lowStockCount}
              </p>
              <span className="text-xs text-slate-500">bahan baku</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {lowStockCount > 0 ? "Stok di bawah batas minimum aman" : "Semua bahan di atas batas aman"}
            </p>
          </div>
        </div>

        {/* Bahan Habis / Kritis */}
        <div className={`p-5 rounded-3xl bg-white border shadow-xs flex flex-col justify-between ${
          outOfStockCount > 0 ? "border-rose-300 bg-rose-50/20" : "border-slate-200/80"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stok Habis (0)
            </span>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs ${
              outOfStockCount > 0 ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-50 text-slate-500 border-slate-200"
            }`}>
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${
                outOfStockCount > 0 ? "text-rose-600" : "text-slate-900"
              }`}>
                {outOfStockCount}
              </p>
              <span className="text-xs text-slate-500">bahan kosong</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {outOfStockCount > 0 ? "Mengunci menu terkait di POS" : "Tidak ada bahan yang habis total"}
            </p>
          </div>
        </div>

        {/* Hubungan ke HPP & Resep */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Integrasi HPP
            </span>
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-2xs">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {recipes.length}
              </p>
              <span className="text-xs text-slate-500">resep terdaftar</span>
            </div>
            {canNavigateToHpp ? (
              <button
                type="button"
                onClick={() => onNavigate?.("hpp_calculator")}
                className="mt-1 text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                Buka Kalkulator HPP <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">Tersinkron dengan menu POS</p>
            )}
          </div>
        </div>
      </div>

      {/* ── NAVIGATION & TOOLBAR ─────────────────────────────────────────── */}
      <div className="flex flex-col 2xl:flex-row justify-between items-stretch 2xl:items-center gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        {/* Animated Sliding Pill Tab Switcher */}
        <div className="flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner overflow-x-auto no-scrollbar max-w-full w-full 2xl:w-auto">
          {[
            { id: "ingredients", label: `Daftar Bahan Baku (${accessibleIngredients.length})` },
            { id: "categories", label: `Kategori Bahan (${visibleCategoriesForManage.length})` },
            { id: "movements", label: "Mutasi & Pemakaian" },
            { id: "opnames", label: "Stok Opname" },
            { id: "recipes", label: `Resep Baku (${recipes.length})` },
            { id: "waste", label: `Waste & Kerusakan (${wasteMovements.length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex-1 2xl:flex-none text-center ${
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="inventoryMainTab"
                    className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full 2xl:w-auto 2xl:justify-end shrink-0">
          {activeTab === "ingredients" && !isReadOnly && (
            <>
              {currentUser?.role !== "LEADER" && (
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
                  "5. 'Lokasi Simpan' pilih antara: BAR, CHILLER, DRY_STORAGE, KITCHEN, BAKERY, atau OPERATIONAL.",
                ]}
                templateDropdowns={{
                  Kategori: ingredientCategoriesList,
                  "Lokasi Simpan": ["BAR", "CHILLER", "DRY_STORAGE", "KITCHEN", "BAKERY", "OPERATIONAL"],
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
                  "Lokasi Simpan": "Pilih BAR, CHILLER, DRY_STORAGE, KITCHEN, BAKERY, atau OPERATIONAL",
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
              )}
              {canManageCategories && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                  title="Tambah, ubah nama, atau hapus kategori bahan baku & olahan"
                >
                  <Sliders className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>Atur Kategori</span>
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => handleOpenAddIngredient("OLAHAN")}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                title="Tambah bahan olahan/racikan internal dengan kalkulator modal batch"
              >
                <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>+ Bahan Olahan</span>
              </motion.button>
              {currentUser?.role !== "LEADER" && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => handleOpenTransferModal()}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200/80 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                title="Keluarkan bahan dus/karton dari gudang ke stasiun Bar/Dapur"
              >
                <ArrowRight className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Ambil ke Bar / Dapur</span>
              </motion.button>
              )}
              {currentUser?.role !== "LEADER" && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => handleOpenAddIngredient("MENTAH")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Tambah Bahan Baku</span>
              </motion.button>
              )}
            </>
          )}

          {activeTab === "categories" && !isReadOnly && (
            <div className="flex items-center gap-2 shrink-0 flex-nowrap">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => handleOpenAddIngredient("OLAHAN", "Bahan Olahan")}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>+ Bahan Olahan</span>
              </motion.button>
              {currentUser?.role !== "LEADER" && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => handleOpenAddIngredient("MENTAH")}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Tambah Bahan Baku</span>
                </motion.button>
              )}
            </div>
          )}

          {activeTab === "movements" && !isReadOnly && (
            <div className="flex items-center gap-2 shrink-0 flex-nowrap">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  if (accessibleIngredients.length === 0) {
                    toast.warning("Belum ada bahan baku terdaftar untuk stasiun Anda.");
                    return;
                  }
                  const firstIng = accessibleIngredients[0];
                  setSelectedIngredientForMove(firstIng.id);
                  setMovementType("WASTE");
                  setMovementUnitMode("BASE");
                  setMovementQuantity(1);
                  setMovementTargetStation(
                    resolveDefaultTransferStation({
                      ingredientStorageLocation: firstIng.storageLocation,
                      userDivision,
                    })
                  );
                  setMovementNote("Kalibrasi Grinder Pagi");
                  setIsAddMovementOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Catat Bahan Rusak / Waste</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  if (accessibleIngredients.length === 0) {
                    toast.warning("Belum ada bahan baku terdaftar untuk stasiun Anda.");
                    return;
                  }
                  const firstIng = accessibleIngredients[0];
                  setSelectedIngredientForMove(firstIng.id);
                  setMovementType("USAGE");
                  setMovementUnitMode("BASE");
                  setMovementQuantity(1);
                  setMovementTargetStation(
                    resolveDefaultTransferStation({
                      ingredientStorageLocation: firstIng.storageLocation,
                      userDivision,
                    })
                  );
                  setMovementNote("");
                  setIsAddMovementOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Catat Pemakaian Harian</span>
              </motion.button>
            </div>
          )}

          {activeTab === "opnames" && !isReadOnly && !isOpnameMode && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={startOpname}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Mulai Sesi Opname Fisik</span>
            </motion.button>
          )}

          {activeTab === "recipes" && !isReadOnly && currentUser?.role !== "LEADER" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => {
                setEditingRecipe(null);
                setIsAddRecipeOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Resep Baru</span>
            </motion.button>
          )}

          {activeTab === "waste" && (
            isReadOnly || currentUser?.role === "OWNER" ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 border border-amber-200/80 rounded-2xl text-[11px] font-bold text-amber-800 shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Mode Pantau & Audit Waste (Owner)</span>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => handleOpenQuickWaste()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>+ Catat Waste / Rusak</span>
              </motion.button>
            )
          )}
        </div>
      </div>

      {/* ── TAB 1: INGREDIENTS CATALOG ───────────────────────────────────── */}
      {activeTab === "ingredients" && (
        <div className="space-y-4">
          {/* Filter Bar: Search, Category Pills, Location, Status */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            {/* Division Tabs */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Divisi:
                </span>
                {allowedDivisionTabs.map((div) => {
                  const Icon = div.icon;
                  const isSelected = selectedDivision === div.id;
                  return (
                    <button
                      key={div.id}
                      onClick={() => setSelectedDivision(div.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-brand-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{div.label}</span>
                    </button>
                  );
                })}
              </div>
              {!isManagerOrAdmin && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-brand-50 border border-brand-200/80 rounded-xl text-[11px] font-bold text-brand-900 shrink-0">
                  <Sparkles className="w-3 h-3 text-brand-600" />
                  <span>Stasiun: {userDivision === "BAR" ? "Bar" : userDivision === "KITCHEN" ? "Kitchen" : "Bakery"} & Kebersihan Bersama</span>
                </div>
              )}
            </div>

            {/* Row 1: Search & Dropdowns */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama bahan, kode SKU, atau kategori..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-base sm:text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-all"
                />
              </div>

              {/* Filter Lokasi Simpan */}
              <CustomSelect
                value={selectedLocation}
                onChange={setSelectedLocation}
                options={PRESET_LOCATIONS.map((loc) => ({
                  value: loc.id,
                  label: loc.label,
                }))}
                icon={<MapPin className="w-4 h-4 text-slate-400" />}
                placeholder="Pilih Lokasi"
                buttonClassName="py-2.5 px-3.5 rounded-2xl border-slate-200"
              />

              {/* Filter Status Stok */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl text-xs font-semibold w-full sm:w-auto">
                <button
                  onClick={() => setSelectedStockStatus("ALL")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedStockStatus === "ALL" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setSelectedStockStatus("LOW_STOCK")}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                    selectedStockStatus === "LOW_STOCK" ? "bg-white text-amber-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Kritis / Menipis ({lowStockCount})</span>
                </button>
                <button
                  onClick={() => setSelectedStockStatus("SAFE")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedStockStatus === "SAFE" ? "bg-white text-emerald-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Aman
                </button>
              </div>
            </div>

            {/* Row 2: Category Horizontal Scrolling Pills (Atur Kategori selalu terlihat di kiri) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {canManageCategories && (
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/25 shadow-2xs"
                  title="Buka pengaturan kategori bahan baku & olahan"
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span>Atur Kategori</span>
                </button>
              )}
              {[{ id: "ALL", name: "Semua Kategori" }, ...visibleCategoriesForDaftar.map((c) => ({ id: c, name: c }))].map((cat) => {
                const IconComponent = cat.id === "ALL" ? Package : getIngredientCategoryIcon(cat.id);
                const isSelected = selectedCategory === cat.id;
                const count = cat.id === "ALL"
                  ? accessibleIngredients.length
                  : accessibleIngredients.filter((i) => matchesIngredientCategory(i.category, cat.id)).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isSelected ? "text-amber-300" : "text-slate-500"}`} />
                    <span>{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                      isSelected ? "bg-brand-700 text-brand-100" : "bg-slate-200 text-slate-600"
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
                const conv = getIngredientUnitConversion(item);
                const hasPurchaseConversion = conv.hasConversion;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    className={`relative bg-white rounded-3xl p-5 border shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group ${
                      isOutOfStock
                        ? "border-rose-300 ring-1 ring-rose-200"
                        : isLow
                        ? "border-amber-300 ring-1 ring-amber-200"
                        : "border-slate-200/80 hover:border-brand-300"
                    }`}
                  >
                    {/* Top Alert Bar */}
                    {isOutOfStock && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />}
                    {isLow && <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />}

                    <div>
                      {/* Category & Action Buttons */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-900 border border-brand-200/60">
                            {item.category}
                          </span>
                          {item.storageLocation && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 flex items-center gap-0.5 border border-slate-200/60">
                              <MapPin className="w-2.5 h-2.5" />
                              {item.storageLocation}
                            </span>
                          )}
                        </div>

                        {!isReadOnly && currentUser?.role !== "LEADER" && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEditIngredient(item)}
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                              title="Edit Bahan Baku"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIngredientToDelete(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {item.code}
                          </span>
                        )}
                        <h3 className="font-bold text-slate-900 text-base leading-tight mt-0.5">
                          {item.name}
                        </h3>
                      </div>

                      {/* Kemasan Pembelian / 3-Tier Unit Badge */}
                      {(hasPurchaseConversion || (item.bulkUnit && Number(item.bulkConversionFactor) > 0)) && (
                        <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-600 space-y-0.5">
                          {item.bulkUnit && Number(item.bulkConversionFactor) > 0 && (
                            <div>
                              <span className="font-semibold text-brand-700">Grosir:</span>{" "}
                              1 {item.bulkUnit} ={" "}
                              {hasPurchaseConversion && conv.conversionFactor > 0
                                ? `${(Number(item.bulkConversionFactor) / conv.conversionFactor).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${conv.purchaseUnit} = `
                                : ""}
                              {Number(item.bulkConversionFactor).toLocaleString("id-ID")} {item.unit}
                              {item.bulkPrice ? ` (@ ${formatCurrency(item.bulkPrice)})` : ""}
                            </div>
                          )}
                          {hasPurchaseConversion && (
                            <div>
                              <span className="font-semibold text-slate-800">Beli / Keluar:</span>{" "}
                              1 {conv.purchaseUnit} = {conv.conversionFactor.toLocaleString("id-ID")} {item.unit}
                              {item.purchasePrice ? ` (@ ${formatCurrency(item.purchasePrice)})` : ""}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Stock & Valuation */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[11px] text-slate-500 font-medium">Sisa Stok Fisik</p>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span
                              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                                isOutOfStock ? "text-rose-600" : isLow ? "text-amber-700" : "text-slate-900"
                              }`}
                            >
                              {item.currentStock.toLocaleString("id-ID")}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold">{item.unit}</span>
                          </div>
                          {hasPurchaseConversion && conv.conversionFactor > 1 && (
                            <div className="text-[11px] font-bold text-brand-700 bg-brand-50/80 px-2 py-0.5 rounded-md mt-1 border border-brand-200/50 inline-block">
                              ≈ {(item.currentStock / conv.conversionFactor).toLocaleString("id-ID", { maximumFractionDigits: 1 })} {conv.purchaseUnit}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">Harga Modal Resep</p>
                          <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                            {formatCurrency(item.costPerUnit || 0)} <span className="text-[10px] font-normal text-slate-400">/{item.unit}</span>
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

                        <div className="flex items-center gap-1.5">
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleOpenTransferModal(item.id)}
                              className="px-2 py-1 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-[0.98]"
                              title="Keluarkan bahan ini ke stasiun operasional"
                            >
                              <ArrowRight className="w-3 h-3 text-brand-600" />
                              <span>Ambil Stok</span>
                            </button>
                          )}

                          {(isLow || isOutOfStock) && canNavigateToPurchases && (
                            <button
                              type="button"
                              onClick={() => onNavigate?.("purchases")}
                              className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-[0.98]"
                              title="Buka Pembelian untuk order bahan ini"
                            >
                              <span>+ Order PO</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredIngredients.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">Tidak ada bahan baku yang cocok</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Coba ubah kata kunci pencarian, kategori, atau filter status stok.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 1B: PENGATURAN KATEGORI BAHAN BAKU & BAHAN OLAHAN ────────── */}
      {activeTab === "categories" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-200/70 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    Pengaturan Kategori Bahan Baku &amp; Bahan Olahan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelola pengelompokan stok seperti <strong className="text-slate-700 dark:text-slate-200">Bahan Olahan</strong>, <strong className="text-slate-700 dark:text-slate-200">Biji Kopi</strong>, <strong className="text-slate-700 dark:text-slate-200">Topping</strong>, dan kategori khusus lainnya agar tertata rapi.
                  </p>
                </div>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleOpenAddIngredient("OLAHAN", "Bahan Olahan")}
                  className="self-start lg:self-auto flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Input Bahan Olahan Baru</span>
                </button>
              )}
            </div>

            {canManageCategories && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const added = handleAddCategory(newCategoryName);
                  if (added) setNewCategoryName("");
                }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700"
              >
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Tambah kategori baru (mis. Topping & Jelly, Sauce Racikan, Frozen Food)..."
                  className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <div className="w-full sm:w-52">
                  <CustomSelect
                    value={newCategoryDivision}
                    onChange={(val) => setNewCategoryDivision(val as IngredientCategoryDivision)}
                    options={CATEGORY_DIVISION_OPTIONS}
                    buttonClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kategori</span>
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {visibleCategoriesForManage.map((catName) => {
                const CatIcon = getIngredientCategoryIcon(catName);
                const itemCount = accessibleIngredients.filter((i) =>
                  matchesIngredientCategory(i.category, catName)
                ).length;
                const isEditing = editingCatOld === catName;
                const isProtected = catName.toLowerCase() === "lainnya";
                const isOlahan = catName.toLowerCase().includes("olahan");

                return (
                  <div
                    key={catName}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isOlahan
                        ? "bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 border-amber-200/80 dark:border-amber-500/30"
                        : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/90 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          Ubah Nama Kategori
                        </label>
                        <input
                          type="text"
                          value={editingCatNew}
                          onChange={(e) => setEditingCatNew(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-brand-300 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatOld(null);
                              setEditingCatNew("");
                            }}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveRenameCategory(catName)}
                            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                isOlahan
                                  ? "bg-amber-100/80 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300"
                                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-brand-600 dark:text-brand-300"
                              }`}
                            >
                              <CatIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {catName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30">
                                  {getCategoryDivisionLabel(catName)}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                                  {itemCount} bahan
                                </span>
                              </div>
                            </div>
                          </div>
                          {canManageCategories && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatOld(catName);
                                  setEditingCatNew(catName);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Ubah nama kategori"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isProtected && (
                                <button
                                  type="button"
                                  onClick={() => setCatToDelete(catName)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
                                  title="Hapus kategori"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70">
                          {canManageCategories ? (
                            <div className="w-44">
                              <CustomSelect
                                value={resolveIngredientCategoryDivision(
                                  catName,
                                  settings?.ingredientCategoryDivisions
                                )}
                                onChange={(val) =>
                                  handleChangeCategoryDivision(
                                    catName,
                                    val as IngredientCategoryDivision
                                  )
                                }
                                options={CATEGORY_DIVISION_OPTIONS}
                                buttonClassName="w-full px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold"
                              />
                            </div>
                          ) : <span />}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory(catName);
                              setActiveTab("ingredients");
                            }}
                            className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-300 transition-colors cursor-pointer"
                          >
                            Lihat Bahan &rarr;
                          </button>
                          {!isReadOnly && (isOlahan || currentUser?.role !== "LEADER") && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenAddIngredient(
                                  isOlahan ? "OLAHAN" : "MENTAH",
                                  catName
                                )
                              }
                              className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-300 text-[11px] font-bold text-brand-700 dark:text-brand-300 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{isOlahan ? "Buat Olahan" : "Tambah Bahan"}</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: STOCK MOVEMENTS & USAGE ──────────────────────────────── */}
      {activeTab === "movements" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Riwayat Mutasi & Pemakaian Bahan</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit otomatis setiap bahan yang keluar untuk penjualan/order, terbuang (waste), atau masuk dari PO.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari bahan, catatan, operator..."
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-all"
                />
                {movementSearch && (
                  <button
                    type="button"
                    onClick={() => setMovementSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap tabular-nums">
                {filteredMovements.length} Transaksi Tercatat
              </span>
            </div>
          </div>

          {/* DESKTOP & TABLET VIEW: Structured Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((mov) => {
                  const ingredient = ingredients.find((i) => i.id === mov.ingredientId);
                  const meta = getMovementDisplayMeta(mov);

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 text-slate-500 whitespace-nowrap">
                        {new Date(mov.date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        {ingredient?.name || "Bahan Terhapus"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{(mov as any).location || "BAR"}</td>
                      <td className={`p-4 font-mono font-bold text-right tabular-nums ${meta.qtyClass}`}>
                        {meta.prefix}{mov.quantity.toLocaleString("id-ID")} {ingredient?.unit}
                      </td>
                      <td className="p-4 font-mono text-slate-600 text-right tabular-nums">
                        {mov.totalCost ? formatCurrency(mov.totalCost) : "-"}
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate">{mov.note || "-"}</td>
                      <td className="p-4 text-slate-500">{mov.createdBy}</td>
                    </tr>
                  );
                })}

                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Belum ada catatan mutasi pergerakan stok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE SMARTPHONE VIEW: Ergonomic Card Feed */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredMovements.map((mov) => {
              const ingredient = ingredients.find((i) => i.id === mov.ingredientId);
              const meta = getMovementDisplayMeta(mov);

              return (
                <div key={mov.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${
                          meta.isPositive
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : meta.isWaste
                            ? "bg-rose-50 text-rose-600 border-rose-100"
                            : "bg-brand-50 text-brand-600 border-brand-100"
                        }`}
                      >
                        {meta.isPositive ? (
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        ) : meta.isWaste ? (
                          <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                        ) : (
                          <Layers className="w-4 h-4 stroke-[2.2]" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">
                          {ingredient?.name || "Bahan Terhapus"}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-2 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider border ${meta.badgeClass}`}
                          >
                            {meta.mobileLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            • {(mov as any).location || "BAR"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-sm font-extrabold font-mono tabular-nums ${meta.qtyClass}`}>
                        {meta.prefix}{mov.quantity.toLocaleString("id-ID")} {ingredient?.unit}
                      </p>
                      {mov.totalCost ? (
                        <p className="text-[10px] font-mono text-slate-500 tabular-nums">
                          {formatCurrency(mov.totalCost)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {mov.note && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/50">
                      {mov.note}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>Opr: {mov.createdBy}</span>
                    <span>
                      {new Date(mov.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredMovements.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada catatan mutasi pergerakan stok.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: STOCK OPNAME ─────────────────────────────────────────── */}
      {activeTab === "opnames" && (
        <div className="space-y-6">
          {isOpnameMode ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-6">
              {/* Header Sesi Aktif */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-50/90 p-4 rounded-2xl border border-brand-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-600"></span>
                    </span>
                    <h3 className="font-bold text-brand-950 text-sm">Sesi Stok Opname Fisik Sedang Berlangsung</h3>
                  </div>
                  <p className="text-xs text-brand-800 mt-1">
                    Auditor: <strong className="font-semibold">{currentUser?.name || "Staff"}</strong> ({currentUser?.role || "LEADER"}) • Masukkan jumlah fisik nyata hasil hitungan di bar / gudang.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-brand-900">Tgl Opname:</span>
                      <CustomDatePicker
                        value={opnameDate}
                        onChange={(val) => {
                          if (val) setOpnameDate(val);
                        }}
                        allowClear={false}
                        placeholder="Pilih Tanggal"
                        buttonClassName="py-1 px-2.5 text-[11px] bg-white border-brand-200"
                      />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-700 text-[11px] font-bold border border-brand-200 tabular-nums">
                      Total: {opnameItems.length} Bahan
                    </span>
                    {(() => {
                      const totalPhysicalValuation = opnameItems.reduce((acc, item) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        return acc + Math.max(0, item.physicalStock) * (Number(ing?.costPerUnit) || 0);
                      }, 0);
                      return (
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-600 text-white text-[11px] font-bold tabular-nums">
                          Nilai Stok Fisik: {formatCurrency(Math.round(totalPhysicalValuation))}
                        </span>
                      );
                    })()}
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                      Sesuai: {opnameItems.filter((i) => i.difference === 0).length}
                    </span>
                    {opnameItems.filter((i) => i.difference !== 0).length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                        Selisih: {opnameItems.filter((i) => i.difference !== 0).length} Bahan
                      </span>
                    )}

                    {/* Estimasi Nominal Kerugian HPP Selisih */}
                    {(() => {
                      const totalDiffLoss = opnameItems.reduce((acc, item) => {
                        if (item.difference < 0) {
                          const ing = ingredients.find((i) => i.id === item.ingredientId);
                          const unitCost = ing?.costPerUnit || 0;
                          return acc + Math.abs(item.difference) * unitCost;
                        }
                        return acc;
                      }, 0);

                      if (totalDiffLoss > 0) {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-extrabold border border-amber-300 font-mono">
                            Estimasi Defisit HPP: -{formatCurrency(totalDiffLoss)}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsCancelOpnameConfirmOpen(true)}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => saveOpname("DRAFT")}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-brand-100 text-brand-900 border border-brand-200 rounded-xl text-xs font-bold hover:bg-brand-200 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    Simpan Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFinalizeOpnameConfirmOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Finalisasi & Sesuaikan Stok</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="space-y-3">
                {/* Division Filter for Opname */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                    Filter Divisi Opname:
                  </span>
                  {allowedDivisionTabs.map((div) => {
                    const Icon = div.icon;
                    const isSelected = opnameDivisionFilter === div.id;
                    return (
                      <button
                        key={div.id}
                        onClick={() => setOpnameDivisionFilter(div.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari bahan baku opname..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all"
                      value={opnameSearch}
                      onChange={(e) => setOpnameSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setOpnameCategoryFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        opnameCategoryFilter === "ALL"
                          ? "bg-brand-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Semua Kategori
                    </button>
                    {visibleCategoriesForOpname.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setOpnameCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          opnameCategoryFilter === cat
                            ? "bg-brand-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pembanding Penjualan Produk (Perkiraan Resep & HPP) vs Keluar Fisik */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      Pembanding Penjualan ({opnameBenchmark.startDate} s.d. {opnameBenchmark.endDate})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        settings?.autoDeductStockOnSale === true
                          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                      }`}
                    >
                      {settings?.autoDeductStockOnSale === true
                        ? "Auto-Potong Stok Aktif"
                        : "Stok Tidak Dipotong Penjualan (Mode Pembanding)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bandingkan perkiraan pemakaian resep ({opnameBenchmark.totalQtySold.toLocaleString("id-ID")} porsi terjual) dengan catatan mutasi keluar penyimpanan.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs shrink-0">
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Estimasi HPP</span>
                    <strong className="font-mono tabular-nums text-brand-700 dark:text-brand-300">
                      {formatCurrency(opnameBenchmark.totalHpp)}
                    </strong>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Est. Bahan Resep</span>
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(opnameBenchmark.recipeCost)}
                    </strong>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Mutasi Keluar</span>
                    <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                      {formatCurrency(opnameBenchmark.physicalOutCost)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DESKTOP & TABLET VIEW: Structured Opname Table */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="p-3">Bahan Baku</th>
                      <th className="p-3">Kategori & Lokasi</th>
                      <th className="p-3 text-center">Stok Sistem</th>
                      <th className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>Stok Fisik Nyata</span>
                          <button
                            type="button"
                            onClick={handleToggleGlobalOpnameMode}
                            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1 ${
                              opnameInputMode === "PURCHASE"
                                ? "bg-brand-600 text-white border-brand-700 shadow-2xs hover:bg-brand-700"
                                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                            }`}
                            title="Klik untuk beralih mode hitung: Kemasan Beli (Kg/Liter/Dus) vs Satuan Resep (gr/ml/pcs)"
                          >
                            <span>Mode: {opnameInputMode === "PURCHASE" ? "📦 Kemasan" : "⚖️ Satuan Resep"}</span>
                            <span className={opnameInputMode === "PURCHASE" ? "text-brand-200" : "text-slate-500"}>⇄</span>
                          </button>
                        </div>
                      </th>
                      <th className="p-3 text-center">Pembanding (Resep / Keluar)</th>
                      <th className="p-3 text-center">Selisih</th>
                      <th className="p-3">Keterangan / Alasan Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {opnameItems
                      .filter((item) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        if (!ing) return false;

                        // Strict station isolation: non-managers cannot view or touch other stations
                        if (!isIngredientAllowedForUser(ing, userDivision)) return false;

                        const matchSearch =
                          ing.name.toLowerCase().includes(opnameSearch.toLowerCase()) ||
                          (ing.code && ing.code.toLowerCase().includes(opnameSearch.toLowerCase()));
                        const matchCategory =
                          opnameCategoryFilter === "ALL" || matchesIngredientCategory(ing.category, opnameCategoryFilter);

                        let matchDivision = true;
                        if (opnameDivisionFilter === "BAR") {
                          matchDivision = isBarItem(ing);
                        } else if (opnameDivisionFilter === "KITCHEN") {
                          matchDivision = isKitchenItem(ing);
                        } else if (opnameDivisionFilter === "BAKERY") {
                          matchDivision = isBakeryItem(ing);
                        } else if (opnameDivisionFilter === "OPERATIONAL") {
                          matchDivision = isOperationalItem(ing);
                        }

                        return matchSearch && matchCategory && matchDivision;
                      })
                      .map((item) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        if (!ing) return null;
                        const conv = getIngredientUnitConversion(ing);
                        return (
                          <tr key={item.ingredientId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{ing.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Satuan: {ing.unit} {ing.code ? `• ${ing.code}` : ""}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {ing.category}
                              </span>
                              {ing.storageLocation && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-800 text-[10px] font-medium border border-brand-200/60">
                                  {ing.storageLocation}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-slate-700">
                              <div className="font-bold text-slate-900">{ing.currentStock.toLocaleString("id-ID")} {ing.unit}</div>
                              {conv.hasConversion && (
                                <div className="text-[10px] text-brand-700 font-sans font-bold bg-brand-50/80 px-1.5 py-0.5 rounded-md border border-brand-200/60 inline-block mt-0.5">
                                  ≈ {(ing.currentStock / conv.conversionFactor).toLocaleString("id-ID", { maximumFractionDigits: 2 })} {conv.purchaseUnit}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {(() => {
                                const isRowPurchase = (rowUnitModes[item.ingredientId] || opnameInputMode) === "PURCHASE" && conv.hasConversion;
                                const factor = conv.conversionFactor || 1;
                                const currentDraft = opnameInputDrafts[item.ingredientId] !== undefined
                                  ? opnameInputDrafts[item.ingredientId]
                                  : (isRowPurchase
                                      ? (Math.round((item.physicalStock / factor) * 1000) / 1000).toString()
                                      : item.physicalStock.toString());

                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-inner">
                                      <CurrencyInput
                                        allowDecimals
                                        placeholder="0"
                                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
                                        value={currentDraft}
                                        onValueChange={(raw) => handleOpnameInputChange(item.ingredientId, raw, isRowPurchase, factor)}
                                      />
                                      {conv.hasConversion ? (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRowUnit(item.ingredientId)}
                                          title={`Klik untuk ubah satuan baris ini ke ${isRowPurchase ? ing.unit : conv.purchaseUnit}`}
                                          className="px-2 py-1 rounded-lg text-[10px] font-bold font-mono bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200/80 flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                        >
                                          <span>{isRowPurchase ? conv.purchaseUnit : ing.unit}</span>
                                          <span className="text-[9px] text-brand-600">⇄</span>
                                        </button>
                                      ) : (
                                        <span className="px-2 py-1 text-slate-700 text-[11px] font-bold font-mono shrink-0">
                                          {ing.unit}
                                        </span>
                                      )}
                                    </div>
                                    {conv.hasConversion && (
                                      <span className="text-[10px] font-mono">
                                        {isRowPurchase ? (
                                          <span className="text-slate-500 font-medium">
                                            = <strong className="text-slate-800 font-bold">{item.physicalStock.toLocaleString("id-ID")}</strong> {ing.unit}
                                          </span>
                                        ) : (
                                          <span className="text-brand-700 font-medium">
                                            ≈ <strong className="text-brand-900 font-bold">{(item.physicalStock / factor).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</strong> {conv.purchaseUnit}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3 text-center font-mono text-[11px] tabular-nums">
                              {(() => {
                                const est = opnameBenchmark.recipeUsageByIngId.get(ing.id);
                                const phys = opnameBenchmark.physicalOutMap.get(ing.id);
                                const estQty = est?.totalUsedQty || 0;
                                const physQty = phys?.totalOutQty || 0;
                                return (
                                  <div className="space-y-0.5">
                                    <div className="text-brand-700 font-bold">
                                      Est: {estQty.toLocaleString("id-ID")} {ing.unit}
                                    </div>
                                    <div className="text-slate-500">
                                      Keluar: {physQty.toLocaleString("id-ID")} {ing.unit}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className={`p-3 text-center font-mono font-bold text-xs ${
                              item.difference < 0
                                ? "text-rose-600 bg-rose-50/50"
                                : item.difference > 0
                                ? "text-emerald-600 bg-emerald-50/50"
                                : "text-slate-500"
                            }`}>
                              <div>
                                {item.difference > 0 ? `+${item.difference.toLocaleString("id-ID")}` : item.difference.toLocaleString("id-ID")} {ing.unit}
                              </div>
                              {conv.hasConversion && item.difference !== 0 && (
                                <div className="text-[10px] font-sans font-medium opacity-80">
                                  ({(item.difference / conv.conversionFactor) > 0 ? "+" : ""}{(item.difference / conv.conversionFactor).toLocaleString("id-ID", { maximumFractionDigits: 2 })} {conv.purchaseUnit})
                                </div>
                              )}
                              {item.difference < 0 && (
                                <div className="text-[10px] font-sans font-medium text-rose-500">Defisit</div>
                              )}
                              {item.difference > 0 && (
                                <div className="text-[10px] font-sans font-medium text-emerald-600">Surplus</div>
                              )}
                              {item.difference === 0 && (
                                <div className="text-[10px] font-sans font-medium text-slate-400">Cocok</div>
                              )}
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder={item.difference !== 0 ? "Catatan selisih (misal: tumpah, susut)..." : "Catatan opsional..."}
                                className={`w-full px-2.5 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                                  item.difference !== 0 ? "border-amber-300 bg-amber-50/30" : "border-slate-200"
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

              {/* MOBILE SMARTPHONE VIEW: Ergonomic Opname Cards */}
              <div className="block md:hidden space-y-3">
                {opnameItems
                  .filter((item) => {
                    const ing = ingredients.find((i) => i.id === item.ingredientId);
                    if (!ing) return false;
                    if (!isIngredientAllowedForUser(ing, userDivision)) return false;
                    const matchSearch =
                      ing.name.toLowerCase().includes(opnameSearch.toLowerCase()) ||
                      (ing.code && ing.code.toLowerCase().includes(opnameSearch.toLowerCase()));
                    const matchCategory =
                      opnameCategoryFilter === "ALL" || matchesIngredientCategory(ing.category, opnameCategoryFilter);
                    let matchDivision = true;
                    if (opnameDivisionFilter === "BAR") matchDivision = isBarItem(ing);
                    else if (opnameDivisionFilter === "KITCHEN") matchDivision = isKitchenItem(ing);
                    else if (opnameDivisionFilter === "BAKERY") matchDivision = isBakeryItem(ing);
                    else if (opnameDivisionFilter === "OPERATIONAL") matchDivision = isOperationalItem(ing);
                    return matchSearch && matchCategory && matchDivision;
                  })
                  .map((item) => {
                    const ing = ingredients.find((i) => i.id === item.ingredientId);
                    if (!ing) return null;
                    const conv = getIngredientUnitConversion(ing);
                    const isRowPurchase = (rowUnitModes[item.ingredientId] || opnameInputMode) === "PURCHASE" && conv.hasConversion;
                    const factor = conv.conversionFactor || 1;
                    const currentDraft = opnameInputDrafts[item.ingredientId] !== undefined
                      ? opnameInputDrafts[item.ingredientId]
                      : (isRowPurchase
                          ? (Math.round((item.physicalStock / factor) * 1000) / 1000).toString()
                          : item.physicalStock.toString());

                    return (
                      <div key={item.ingredientId} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{ing.name}</h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {ing.category}
                              </span>
                              {ing.storageLocation && (
                                <span className="px-1.5 py-0.2 rounded-md bg-brand-50 text-brand-800 text-[10px] font-medium border border-brand-200/60">
                                  {ing.storageLocation}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Stok Sistem</span>
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {ing.currentStock.toLocaleString("id-ID")} {ing.unit}
                            </span>
                          </div>
                        </div>

                        {/* Mobile Counting Input */}
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <div className="flex-1 flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold px-1.5">Fisik:</span>
                            <CurrencyInput
                              allowDecimals
                              placeholder="0"
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
                              value={currentDraft}
                              onValueChange={(raw) => handleOpnameInputChange(item.ingredientId, raw, isRowPurchase, factor)}
                            />
                            {conv.hasConversion ? (
                              <button
                                type="button"
                                onClick={() => handleToggleRowUnit(item.ingredientId)}
                                className="ml-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200/80 flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <span>{isRowPurchase ? conv.purchaseUnit : ing.unit}</span>
                                <span className="text-brand-600">⇄</span>
                              </button>
                            ) : (
                              <span className="px-2 text-slate-600 text-xs font-bold font-mono">
                                {ing.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pembanding Penjualan Resep & Keluar Fisik Mobile */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70">
                          <span className="text-brand-700 font-bold">
                            Est. Resep: {(opnameBenchmark.recipeUsageByIngId.get(ing.id)?.totalUsedQty || 0).toLocaleString("id-ID")} {ing.unit}
                          </span>
                          <span className="text-slate-600">
                            Keluar Fisik: {(opnameBenchmark.physicalOutMap.get(ing.id)?.totalOutQty || 0).toLocaleString("id-ID")} {ing.unit}
                          </span>
                        </div>

                        {/* Difference & Note in Mobile */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
                              item.difference === 0
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : item.difference < 0
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {item.difference === 0
                              ? "✓ Cocok"
                              : `${item.difference > 0 ? "+" : ""}${item.difference.toLocaleString("id-ID")} ${ing.unit}`}
                          </div>
                          <input
                            type="text"
                            placeholder="Catatan selisih..."
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={item.notes}
                            onChange={(e) => handleOpnameNoteChange(item.ingredientId, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ringkasan Pembanding Penjualan Mingguan (Resep & HPP) */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      Pembanding Penjualan Sejak Opname Terakhir ({opnameBenchmark.startDate} s.d. {opnameBenchmark.endDate})
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        settings?.autoDeductStockOnSale === true
                          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                      }`}
                    >
                      {settings?.autoDeductStockOnSale === true
                        ? "Auto-Potong Stok Aktif"
                        : "Stok Tidak Dipotong Penjualan"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Patokan cek mingguan: bandingkan estimasi bahan &amp; HPP dari {opnameBenchmark.totalQtySold.toLocaleString("id-ID")} menu terjual terhadap mutasi keluar gudang sebelum/saat melakukan Stok Opname.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs shrink-0">
                  <div className="px-3 py-2 rounded-xl bg-brand-50/70 dark:bg-brand-500/15 border border-brand-200/70 dark:border-brand-500/30">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Estimasi HPP</span>
                    <strong className="font-mono tabular-nums text-brand-700 dark:text-brand-300">
                      {formatCurrency(opnameBenchmark.totalHpp)}
                    </strong>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Est. Bahan Resep</span>
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(opnameBenchmark.recipeCost)}
                    </strong>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-500/15 border border-amber-200/70 dark:border-amber-500/30">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Mutasi Keluar</span>
                    <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                      {formatCurrency(opnameBenchmark.physicalOutCost)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Active Draft Alert Banner */}
              {activeDrafts.length > 0 && latestDraft && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 bg-amber-200/90 px-2.5 py-0.5 rounded-md">
                          Draf Aktif Tersimpan
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {activeDrafts.length} sesi belum difinalisasi
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        Draf terakhir oleh <strong className="text-amber-900 font-extrabold">{latestDraft.createdBy}</strong> ({new Date(latestDraft.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB)
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Hitungan fisik sebelumnya telah tersimpan di sistem. Anda dapat langsung melanjutkan pengisian tanpa harus mengulang dari nol.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                    {!isReadOnly ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResumeDraft(latestDraft)}
                          className="flex-1 md:flex-initial px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Lanjutkan Draf Terakhir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(latestDraft.id)}
                          className="p-2.5 bg-white border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                          title="Hapus draf ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedOpnameForView(latestDraft)}
                        className="flex-1 md:flex-initial px-5 py-2.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Rincian Draf</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Card Utama Stok Opname */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-brand-600 text-white rounded-2xl shadow-xs shrink-0">
                      <ClipboardList className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Audit Fisik Stok (Stok Opname)</h4>
                      <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                        Lakukan perhitungan fisik secara rutin untuk membandingkan jumlah riil bahan baku di stasiun dengan catatan sistem inventori. Leader Bar, Leader Kitchen, dan Supervisor dapat langsung memulai audit fisik.
                      </p>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={startOpname}
                      className="w-full md:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold cursor-pointer shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Mulai Stok Opname Sekarang</span>
                    </button>
                  )}
                </div>

                {/* 3 Langkah Alur Opname */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-900 font-bold text-xs flex items-center justify-center mb-2.5">
                      1
                    </div>
                    <div className="text-xs font-bold text-slate-800">Hitung Riil Bahan Baku</div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Barista / Leader menimbang biji kopi, volume susu, atau bahan di stasiun dan masukkan jumlah fisik ke sistem.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-900 font-bold text-xs flex items-center justify-center mb-2.5">
                      2
                    </div>
                    <div className="text-xs font-bold text-slate-800">Cek Selisih Real-Time</div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Sistem menghitung otomatis selisih minus (defisit/waste) atau plus (surplus) terhadap transaksi penjualan.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center mb-2.5">
                      3
                    </div>
                    <div className="text-xs font-bold text-slate-800">Finalisasi & Koreksi Otomatis</div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Sistem memperbarui saldo stok riil dan otomatis mencatat mutasi koreksi tanpa repot input manual.
                    </p>
                  </div>
                </div>
              </div>

              {/* Riwayat Sesi Opname Lampau */}
              {stockOpnames && stockOpnames.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Riwayat Sesi Stok Opname</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Daftar seluruh audit fisik berkala yang pernah dilakukan tim stasiun & supervisor.
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-700 text-xs font-bold border border-slate-200/60">
                      {stockOpnames.length} Sesi Tercatat
                    </span>
                  </div>

                  {/* DESKTOP & TABLET VIEW: Structured Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="p-3.5">Tanggal & Waktu</th>
                          <th className="p-3.5">Auditor / Petugas</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-right">Nilai Stok Fisik</th>
                          <th className="p-3.5">Catatan</th>
                          <th className="p-3.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockOpnames
                          .slice()
                          .reverse()
                          .map((op) => {
                            const relatedItems = stockOpnameItems.filter((i) => i.opnameId === op.id);
                            const discrepancyCount = relatedItems.filter((i) => i.difference !== 0).length;
                            const totalOpnameValue = Math.round(
                              relatedItems.reduce((sum, item) => {
                                const ing = ingredients.find((i) => i.id === item.ingredientId);
                                const cost =
                                  Number(item.unitCost) > 0
                                    ? Number(item.unitCost)
                                    : Number(ing?.costPerUnit) || 0;
                                return sum + Math.max(0, Number(item.physicalStock) || 0) * cost;
                              }, 0)
                            );
                            return (
                              <tr key={op.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="p-3.5">
                                  <div className="font-bold text-slate-900">
                                    {new Date(op.date).toLocaleDateString("id-ID", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {new Date(op.date).toLocaleTimeString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })} WIB
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <span className="font-bold text-slate-800">{op.createdBy}</span>
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                    op.status === "FINAL"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    {op.status === "FINAL" ? "FINAL (Tersinkron)" : "DRAFT"}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                                  {formatCurrency(totalOpnameValue)}
                                  <span className="block text-[10px] font-sans font-normal text-slate-400">
                                    {relatedItems.length} item dihitung
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-600">
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
                                  <div className="flex items-center justify-center gap-1.5">
                                    {op.status === "DRAFT" && !isReadOnly && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleResumeDraft(op)}
                                          className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98]"
                                          title="Lanjutkan pengisian draf ini"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                          <span>Lanjutkan</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteDraft(op.id)}
                                          className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                                          title="Hapus draf ini"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => setSelectedOpnameForView(op)}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>{op.status === "DRAFT" ? "Rincian" : "Lihat Rincian"}</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE SMARTPHONE VIEW: Ergonomic Opname History Cards */}
                  <div className="block md:hidden divide-y divide-slate-100">
                    {stockOpnames
                      .slice()
                      .reverse()
                      .map((op) => {
                        const relatedItems = stockOpnameItems.filter((i) => i.opnameId === op.id);
                        const discrepancyCount = relatedItems.filter((i) => i.difference !== 0).length;
                        const totalOpnameValue = Math.round(
                          relatedItems.reduce((sum, item) => {
                            const ing = ingredients.find((i) => i.id === item.ingredientId);
                            const cost =
                              Number(item.unitCost) > 0
                                ? Number(item.unitCost)
                                : Number(ing?.costPerUnit) || 0;
                            return sum + Math.max(0, Number(item.physicalStock) || 0) * cost;
                          }, 0)
                        );
                        return (
                          <div key={op.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">
                                  {new Date(op.date).toLocaleDateString("id-ID", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  Opr: {op.createdBy} • {new Date(op.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB • Nilai: <strong className="text-slate-700">{formatCurrency(totalOpnameValue)}</strong>
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                op.status === "FINAL"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                {op.status === "FINAL" ? "FINAL" : "DRAFT"}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/50 flex justify-between items-center">
                              <span>{op.notes || "Audit berkala"}</span>
                              {discrepancyCount > 0 ? (
                                <span className="text-rose-600 font-bold text-[10px]">
                                  {discrepancyCount} selisih
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[10px]">
                                  ✓ Akurat
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              {op.status === "DRAFT" && !isReadOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResumeDraft(op)}
                                    className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-[0.98]"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Lanjutkan</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDraft(op.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedOpnameForView(op)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Rincian</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: RECIPES (BOM) ─────────────────────────────────────────── */}
      {activeTab === "recipes" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Resep Takaran Menu (Bill of Materials)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap resep menentukan bahan apa saja yang otomatis dipotong saat pesanan penjualan dicatat atau diimpor.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama menu resep..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-all"
              />
              {recipeSearch && (
                <button
                  type="button"
                  onClick={() => setRecipeSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* DESKTOP & TABLET VIEW: Structured Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-4">Nama Menu</th>
                  <th className="p-4">Komposisi Bahan & Takaran</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecipes.map((recipe) => (
                  <tr key={recipe.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{recipe.menuName}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {getRecipeIngredients(recipe).map((ri, idx) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          return (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/60"
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
                            className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                            title="Edit Resep"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecipeToDelete(recipe)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
                    <td colSpan={3} className="p-8 text-center text-slate-400">
                      Belum ada data resep terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE SMARTPHONE VIEW: Ergonomic Recipe Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredRecipes.map((recipe) => (
              <div key={recipe.id} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{recipe.menuName}</h4>
                  {!isReadOnly && currentUser?.role !== "LEADER" && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingRecipe(recipe);
                          setIsAddRecipeOpen(true);
                        }}
                        className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-xl transition-colors"
                        title="Edit Resep"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipeToDelete(recipe)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Hapus Resep"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {getRecipeIngredients(recipe).map((ri, idx) => {
                    const ing = ingredients.find((i) => i.id === ri.ingredientId);
                    return (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200/60"
                      >
                        <strong>{ing?.name || "Bahan"}</strong>: {ri.quantity} {ing?.unit || "unit"}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredRecipes.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada data resep terdaftar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: WASTE & KERUSAKAN BAHAN BAKU ─────────────────────────── */}
      {activeTab === "waste" && (
        <div className="space-y-6">
          {/* Bento KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Loss Month */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Kerugian Waste Bulan Ini
                </span>
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight font-mono">
                  {formatCurrency(wasteKpis.totalLossMonth)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Dari <strong>{wasteKpis.totalIncidentsMonth}</strong> catatan insiden bulan ini
                </p>
              </div>
            </div>

            {/* Card 2: Top Reason */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Penyebab Terbesar
                </span>
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  {wasteKpis.topReasonLabel}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Menyumbang <strong>{wasteKpis.topReasonPercent}%</strong> dari seluruh kerugian
                </p>
              </div>
            </div>

            {/* Card 3: Ratio vs Inventory */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Rasio Waste vs Inventori
                </span>
                <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-2xs">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                    {wasteKpis.ratio.toFixed(2)}%
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    wasteKpis.ratio <= 1
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : wasteKpis.ratio <= 2.5
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    {wasteKpis.ratio <= 1 ? "Sangat Terkendali" : wasteKpis.ratio <= 2.5 ? "Wajar F&B" : "Evaluasi SOP"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tolok ukur F&B kafe: aman di bawah 2.0% - 2.5%
                </p>
              </div>
            </div>

            {/* Card 4: Top Wasted Ingredient */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Bahan Terbanyak Terbuang
                </span>
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shadow-2xs">
                  <Flame className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  {wasteKpis.topIng ? wasteKpis.topIng.name : "Belum Ada"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {wasteKpis.topIng ? (
                    <>
                      {wasteKpis.topIng.qty.toLocaleString("id-ID")} {wasteKpis.topIng.unit} •{" "}
                      <span className="font-mono font-bold text-rose-600">
                        {formatCurrency(wasteKpis.topIng.cost)}
                      </span>
                    </>
                  ) : (
                    "Tidak ada bahan terbuang"
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Operational Anomaly Warning (skill requirement: peringatan pola tak biasa sebagai informasi) */}
          {wasteAnomalies.length > 0 && (
            <div className="p-5 rounded-3xl bg-amber-50/80 border border-amber-200/90 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      Catatan Evaluasi Operasional (Pola Waste Berulang 7 Hari Terakhir)
                    </h4>
                    <p className="text-xs text-amber-800/90 mt-0.5">
                      Berikut bahan dengan frekuensi waste &ge; 3 kali atau nilai akumulasi &ge; Rp 50.000. Jadikan bahan tinjauan kalibrasi grinder, suhu chiller, atau rotasi stok FIFO:
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {wasteAnomalies.map((anom, idx) => (
                      <div key={idx} className="p-3 bg-white/90 rounded-2xl border border-amber-200/70 text-xs shadow-2xs">
                        <div className="flex justify-between items-start gap-1">
                          <strong className="text-slate-900 font-bold">{anom.name}</strong>
                          <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            {anom.count}x Catatan
                          </span>
                        </div>
                        <div className="mt-1.5 flex justify-between items-center text-[11px] text-slate-500 font-mono">
                          <span>Vol: {anom.totalQty.toLocaleString("id-ID")} {anom.unit}</span>
                          <span className="font-bold text-slate-800">{formatCurrency(anom.totalCost)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-amber-800/80 truncate">
                          Alasan: {anom.reasonList}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar & Export Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari bahan, barista, atau catatan waste..."
                  value={wasteSearch}
                  onChange={(e) => setWasteSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all"
                />
              </div>

              {/* Period Filters */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 shrink-0">
                {[
                  { id: "THIS_MONTH", label: "Bulan Ini" },
                  { id: "LAST_7_DAYS", label: "7 Hari Terakhir" },
                  { id: "TODAY", label: "Hari Ini" },
                  { id: "ALL", label: "Semua Waktu" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setWasteFilterPeriod(p.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      wasteFilterPeriod === p.id
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={handleExportWasteCsv}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Ekspor CSV ({filteredWasteMovements.length})</span>
              </button>
            </div>

            {/* Standard Reason Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                Filter Alasan:
              </span>
              <button
                type="button"
                onClick={() => setWasteFilterReason("ALL")}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  wasteFilterReason === "ALL"
                    ? "bg-brand-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua Alasan
              </button>
              {WASTE_REASONS_DETAIL.map((r) => {
                const isSelected = wasteFilterReason === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setWasteFilterReason(r.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      isSelected
                        ? "bg-rose-600 text-white border-rose-700 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table (Desktop & Tablet) & Cards (Mobile) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Riwayat & Log Waste Bahan Baku</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap catatan memotong stok riil dan merekam snapshot nilai kerugian saat kejadian.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                {filteredWasteMovements.length} Catatan
              </span>
            </div>

            {/* DESKTOP & TABLET VIEW: Structured Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-3.5">Waktu Kejadian</th>
                    <th className="p-3.5">Bahan Baku</th>
                    <th className="p-3.5">Alasan Terstandar</th>
                    <th className="p-3.5 text-center">Jumlah Terbuang</th>
                    <th className="p-3.5 text-right">Nilai Kerugian (HPP)</th>
                    <th className="p-3.5">Operator</th>
                    <th className="p-3.5">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWasteMovements.map((m) => {
                    const reasonObj = WASTE_REASONS_DETAIL.find((r) => r.id === m.reasonKey);
                    const d = new Date(m.date);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{m.ingredient?.name || "Bahan Terhapus"}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{m.ingredient?.category || "Umum"}</span>
                            {m.ingredient?.storageLocation && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                                {m.ingredient.storageLocation}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                            reasonObj?.badge || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {reasonObj?.label || m.reasonKey}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-slate-900">
                          {m.actualQty.toLocaleString("id-ID")} {m.ingredient?.unit || "unit"}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-rose-600">
                          {formatCurrency(m.totalCost)}
                        </td>
                        <td className="p-3.5 text-slate-700 font-medium">
                          {m.createdBy || "Barista"}
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                          {m.cleanNote || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE VIEW: Touch-Friendly Cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredWasteMovements.map((m) => {
                const reasonObj = WASTE_REASONS_DETAIL.find((r) => r.id === m.reasonKey);
                const d = new Date(m.date);
                return (
                  <div key={m.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {m.ingredient?.name || "Bahan Terhapus"}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} • {d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-black text-rose-600 text-sm">
                          {formatCurrency(m.totalCost)}
                        </p>
                        <p className="font-mono text-xs font-bold text-slate-700">
                          {m.actualQty.toLocaleString("id-ID")} {m.ingredient?.unit || "unit"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        reasonObj?.badge || "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {reasonObj?.label || m.reasonKey}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Opr: {m.createdBy || "Barista"}
                      </span>
                    </div>

                    {m.cleanNote && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/50">
                        {m.cleanNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredWasteMovements.length === 0 && (
              <div className="p-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-800 text-sm">Tidak Ada Catatan Waste</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tidak ditemukan catatan waste atau bahan rusak untuk periode dan filter yang dipilih.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: TAMBAH & EDIT BAHAN BAKU ───────────────────────────────── */}
      <AnimatePresence>
        {isIngredientModalOpen && (
          <motion.div
            key="ingredient-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center p-3 sm:p-6 z-50 overflow-y-auto"
          >
            <motion.div
              key="ingredient-modal-card"
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90dvh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-200/90 dark:border-slate-800"
            >
            {/* Modal Header */}
            <div className="shrink-0 flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    {editingIngredient
                      ? "Edit Bahan Baku"
                      : ingredientEntryMode === "OLAHAN"
                      ? "Tambah Bahan Olahan (Racikan)"
                      : "Tambah Bahan Baku Baru"}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {ingredientEntryMode === "OLAHAN"
                      ? "Hitung modal per satuan dari total biaya racikan & hasil batch."
                      : "Lengkapi satuan pakai resep dan satuan beli supplier untuk integrasi HPP otomatis."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIngredientModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitIngredient} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
              {/* Toggle Mode Bahan Baku vs Bahan Olahan */}
              <div className="p-1 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1 border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setIngredientEntryMode("MENTAH");
                    setIngredientForm((prev) => ({
                      ...prev,
                      category: prev.category === "Bahan Olahan" ? "Biji Kopi" : prev.category,
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    ingredientEntryMode === "MENTAH"
                      ? "bg-white text-brand-700 shadow-2xs border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Bahan Mentah (Supplier)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIngredientEntryMode("OLAHAN");
                    setIngredientForm((prev) => ({
                      ...prev,
                      category: "Bahan Olahan",
                      usePurchaseUnit: false,
                      unit: prev.unit === "gr" && !prev.name ? "ml" : prev.unit,
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    ingredientEntryMode === "OLAHAN"
                      ? "bg-brand-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Bahan Olahan (Racikan)</span>
                </button>
              </div>

              {/* Row 1: Kode & Nama Bahan (Responsive stack on mobile, 3 cols on tablet/desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode SKU / Barcode
                  </label>
                  <input
                    type="text"
                    value={ingredientForm.code}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, code: e.target.value })}
                    placeholder="BB-001"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    {ingredientEntryMode === "OLAHAN" ? "Nama Bahan Olahan" : "Nama Bahan Baku"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ingredientForm.name}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                    placeholder={
                      ingredientEntryMode === "OLAHAN"
                        ? "e.g. Gula Aren Cair Racikan, Sambal Matah Matang"
                        : "e.g. Biji Kopi Arabika Gayo, Susu Fresh Milk"
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Kategori (+ Inline Buat Baru) & Lokasi Simpan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Kategori</label>
                    {canManageCategories && (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="text-[11px] font-bold text-slate-500 hover:text-brand-700 cursor-pointer"
                        >
                          Atur Kategori
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsInlineNewCatOpen((v) => !v)}
                          className="text-[11px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
                        >
                          {isInlineNewCatOpen ? "Tutup" : "+ Kategori Baru"}
                        </button>
                      </div>
                    )}
                  </div>
                  <CustomSelect
                    value={ingredientForm.category}
                    onChange={(val) => setIngredientForm({ ...ingredientForm, category: val })}
                    options={visibleCategoriesForManage.map((c) => ({
                      value: c,
                      label: isManagerOrAdmin ? `${c} (${getCategoryDivisionLabel(c)})` : c,
                    }))}
                    buttonClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-base sm:text-xs text-slate-800"
                  />
                  <AnimatePresence>
                    {isInlineNewCatOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={inlineNewCatInput}
                            onChange={(e) => setInlineNewCatInput(e.target.value)}
                            placeholder="Nama kategori baru..."
                            className="flex-1 px-2.5 py-1.5 rounded-xl border border-brand-200 bg-brand-50/30 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const created = handleAddCategory(inlineNewCatInput);
                              if (created) {
                                setIngredientForm((prev) => ({ ...prev, category: created }));
                                setInlineNewCatInput("");
                                setIsInlineNewCatOpen(false);
                              }
                            }}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0"
                          >
                            Tambah
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Simpan</label>
                  <CustomSelect
                    value={ingredientForm.storageLocation}
                    onChange={(val) =>
                      setIngredientForm({ ...ingredientForm, storageLocation: val })
                    }
                    options={PRESET_LOCATIONS.filter((l) => l.id !== "ALL").map((l) => ({
                      value: l.id,
                      label: l.label,
                    }))}
                    buttonClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-base sm:text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* ── KALKULATOR BAHAN OLAHAN ATAU KONVERSI KEMASAN ────────── */}
              {ingredientEntryMode === "OLAHAN" ? (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-xs">
                      Kalkulator Harga Modal Batch Bahan Olahan
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Total Biaya 1 Batch (Rp)
                      </label>
                      <CurrencyInput
                        value={batchTotalCost}
                        onValueChange={(_, num) => setBatchTotalCost(Math.max(0, num))}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold font-mono text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Total Hasil Jadi (Yield)
                      </label>
                      <CurrencyInput
                        allowDecimals
                        emptyWhenZero
                        value={batchYieldOutput}
                        onValueChange={(_, num) => {
                          const qty = Math.max(0, num);
                          setBatchYieldOutput(qty);
                          if (!editingIngredient) {
                            setIngredientForm((prev) => ({ ...prev, stockInput: qty }));
                          }
                        }}
                        onBlur={() => {
                          if (batchYieldOutput <= 0) {
                            setBatchYieldOutput(1);
                            if (!editingIngredient) {
                              setIngredientForm((prev) => ({ ...prev, stockInput: 1 }));
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold font-mono text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Satuan Pakai Resep
                      </label>
                      <input
                        type="text"
                        required
                        value={ingredientForm.unit}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                        placeholder="ml, gr, pcs"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-medium">Estimasi Modal Racikan:</span>
                      <p className="font-bold text-slate-800 mt-0.5 tabular-nums">
                        {formatCurrency(batchTotalCost)} ÷ {batchYieldOutput.toLocaleString("id-ID")} {ingredientForm.unit}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-slate-400 text-[10px]">Modal per Satuan Resep (HPP):</span>
                      <p className="font-mono font-black text-brand-700 text-sm tabular-nums">
                        {formatCurrency(computedCostPerUnit)} <span className="text-[10px] font-normal text-slate-500">/{ingredientForm.unit}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── SECTION KONVERSI BELI KE RESEP (SMART FEATURE) ─────────── */
                <div className="p-4 rounded-2xl bg-brand-50/40 border border-brand-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-brand-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-xs">
                      Konversi Satuan Kemasan Supplier & Harga Modal HPP
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-brand-900">
                    <input
                      type="checkbox"
                      checked={ingredientForm.usePurchaseUnit}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, usePurchaseUnit: e.target.checked })}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span>Beli dalam Kemasan (Dus/Kg/Liter)</span>
                  </label>
                </div>

                {ingredientForm.usePurchaseUnit ? (
                  <div className="space-y-3 pt-2 border-t border-brand-100">
                    {/* Preset selection buttons */}
                    <div>
                      <span className="text-[10px] text-slate-600 font-semibold block mb-1.5">
                        Pilih Cepat Tipe Kemasan:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PURCHASE_UNIT_PRESETS.slice(0, 5).map((p) => (
                          <button
                            type="button"
                            key={p.unit}
                            onClick={() => handlePurchasePresetSelect(p.unit)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer active:scale-95 ${
                              ingredientForm.purchaseUnit === p.unit
                                ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-brand-50/60"
                            }`}
                          >
                            {p.unit}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">
                          Satuan Beli Supplier
                        </label>
                        <input
                          type="text"
                          required
                          value={ingredientForm.purchaseUnit}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, purchaseUnit: e.target.value })}
                          placeholder="e.g. Kg, Karton, Dus"
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">
                          Isi per Kemasan
                        </label>
                        <div className="flex items-center gap-1.5">
                          <CurrencyInput
                            allowDecimals
                            emptyWhenZero
                            required
                            value={ingredientForm.conversionFactor}
                            onValueChange={(_, num) => setIngredientForm({ ...ingredientForm, conversionFactor: Math.max(0, num) })}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold font-mono text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                          <span className="text-xs font-bold text-brand-700 shrink-0">
                            {ingredientForm.unit}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">
                          Harga Beli Kemasan
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                            Rp
                          </span>
                          <CurrencyInput
                            required
                            value={ingredientForm.purchasePrice}
                            onValueChange={(_, num) => setIngredientForm({ ...ingredientForm, purchasePrice: num })}
                            className="w-full pl-8 pr-2 py-2 bg-white rounded-xl border border-slate-200 font-bold font-mono text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live Formula Preview Box */}
                    <div className="p-3 rounded-2xl bg-white border border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-500 font-medium">Harga Modal Resep (HPP):</span>
                        <p className="font-bold text-slate-800 mt-0.5">
                          {formatCurrency(ingredientForm.purchasePrice)} ÷ {ingredientForm.conversionFactor.toLocaleString("id-ID")} {ingredientForm.unit}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-slate-400 text-[10px]">Otomatis ke HPP:</span>
                        <p className="font-mono font-black text-brand-600 text-sm">
                          {formatCurrency(computedCostPerUnit)} <span className="text-[10px] font-normal text-slate-500">/{ingredientForm.unit}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-brand-100">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Satuan Resep Dasar
                      </label>
                      <input
                        type="text"
                        required
                        value={ingredientForm.unit}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                        placeholder="gr, ml, pcs, portion"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Harga Modal Satuan (Rp/{ingredientForm.unit})
                      </label>
                      <CurrencyInput
                        allowDecimals
                        required
                        value={ingredientForm.costPerUnit}
                        onValueChange={(_, num) => setIngredientForm({ ...ingredientForm, costPerUnit: num })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold font-mono text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                  </div>
                )}

                {/* Tingkat 3 (Opsional): Satuan Terbesar / Grosir */}
                <div className="pt-3 border-t border-brand-100 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">
                        Tingkat 3 — Satuan Terbesar / Grosir (Opsional)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Contoh: 1 Karton = 12 Liter = 12.000 ml (agar AI Input Pintar & PO langsung mengenali pembelian grosir).
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-brand-900 shrink-0">
                      <input
                        type="checkbox"
                        checked={ingredientForm.useBulkUnit}
                        onChange={(e) =>
                          setIngredientForm({ ...ingredientForm, useBulkUnit: e.target.checked })
                        }
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>Aktifkan Satuan Grosir</span>
                    </label>
                  </div>

                  {ingredientForm.useBulkUnit && (
                    <div className="space-y-2.5 p-3 rounded-2xl bg-white border border-brand-200/70">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Nama Satuan Terbesar
                          </label>
                          <input
                            type="text"
                            value={ingredientForm.bulkUnit}
                            onChange={(e) =>
                              setIngredientForm({ ...ingredientForm, bulkUnit: e.target.value })
                            }
                            placeholder="Karton, Karung, Dus"
                            className="w-full px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Isi per 1 {ingredientForm.bulkUnit || "Grosir"}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <CurrencyInput
                              allowDecimals
                              emptyWhenZero
                              value={ingredientForm.bulkPerPurchase}
                              onValueChange={(_, num) =>
                                setIngredientForm({
                                  ...ingredientForm,
                                  bulkPerPurchase: Math.max(0, num),
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 font-bold font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                            <span className="text-[11px] font-bold text-brand-700 shrink-0">
                              {ingredientForm.usePurchaseUnit
                                ? ingredientForm.purchaseUnit || ingredientForm.unit
                                : ingredientForm.unit}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Harga Grosir (Opsional)
                          </label>
                          <CurrencyInput
                            value={ingredientForm.bulkPrice}
                            onValueChange={(_, num) =>
                              setIngredientForm({ ...ingredientForm, bulkPrice: Math.max(0, num) })
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 font-bold font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-brand-800 bg-brand-50/70 px-3 py-1.5 rounded-xl border border-brand-200/60 tabular-nums">
                        Hierarki Satuan:{" "}
                        <strong>1 {ingredientForm.bulkUnit || "Grosir"}</strong> ={" "}
                        {ingredientForm.usePurchaseUnit ? (
                          <>
                            {ingredientForm.bulkPerPurchase.toLocaleString("id-ID")}{" "}
                            {ingredientForm.purchaseUnit} ={" "}
                            {(
                              ingredientForm.bulkPerPurchase *
                              (Number(ingredientForm.conversionFactor) || 1)
                            ).toLocaleString("id-ID")}{" "}
                            {ingredientForm.unit}
                          </>
                        ) : (
                          <>
                            {ingredientForm.bulkPerPurchase.toLocaleString("id-ID")}{" "}
                            {ingredientForm.unit}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Row 3: Stok Fisik & Batas Minimum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">
                      {editingIngredient ? "Stok Saat Ini" : "Stok Awal Fisik"}
                    </label>
                    {ingredientEntryMode === "MENTAH" && ingredientForm.usePurchaseUnit && (
                      <div className="flex gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() =>
                            setIngredientForm((prev) => ({
                              ...prev,
                              initialStockUnit: "BASE",
                              stockInput: convertStockInputOnUnitToggle({
                                currentValue: prev.stockInput,
                                fromUnit: prev.initialStockUnit,
                                toUnit: "BASE",
                                conversionFactor: prev.conversionFactor,
                              }),
                            }))
                          }
                          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                            ingredientForm.initialStockUnit === "BASE" ? "bg-brand-600 text-white font-bold" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {ingredientForm.unit}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setIngredientForm((prev) => ({
                              ...prev,
                              initialStockUnit: "PURCHASE",
                              stockInput: convertStockInputOnUnitToggle({
                                currentValue: prev.stockInput,
                                fromUnit: prev.initialStockUnit,
                                toUnit: "PURCHASE",
                                conversionFactor: prev.conversionFactor,
                              }),
                            }))
                          }
                          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                            ingredientForm.initialStockUnit === "PURCHASE" ? "bg-brand-600 text-white font-bold" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {ingredientForm.purchaseUnit}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CurrencyInput
                      allowDecimals
                      required
                      value={ingredientForm.stockInput}
                      onValueChange={(_, num) => setIngredientForm({ ...ingredientForm, stockInput: Math.max(0, num) })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                    <span className="font-bold text-slate-500 shrink-0 text-xs">
                      {ingredientForm.initialStockUnit === "PURCHASE" ? ingredientForm.purchaseUnit : ingredientForm.unit}
                    </span>
                  </div>
                  {ingredientForm.initialStockUnit === "PURCHASE" && ingredientForm.usePurchaseUnit && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Setara dengan <strong>{(Number(ingredientForm.stockInput) * Number(ingredientForm.conversionFactor)).toLocaleString("id-ID")} {ingredientForm.unit}</strong>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Batas Minimum Aman (Alert Reorder)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <CurrencyInput
                      allowDecimals
                      required
                      value={ingredientForm.minStock}
                      onValueChange={(_, num) => setIngredientForm({ ...ingredientForm, minStock: Math.max(0, num) })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                    <span className="font-bold text-slate-500 shrink-0 text-xs">
                      {ingredientForm.unit}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Notifikasi muncul jika stok &le; batas ini.
                  </p>
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Merek, Supplier, dsb)
                </label>
                <input
                  type="text"
                  value={ingredientForm.notes}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, notes: e.target.value })}
                  placeholder="e.g. Beli di Toko Kopi Mandiri, kadaluwarsa 6 bulan"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 px-4 sm:px-6 py-3.5 bg-slate-50/95 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingIngredient ? "Simpan Perubahan" : "Simpan Bahan Baku"}</span>
                </button>
              </div>
            </form>
            </motion.div>
          </motion.div>

        )}
      </AnimatePresence>

      {/* ── MODAL: CATAT PEMAKAIAN & WASTE ───────────────────────────────── */}
      <AnimatePresence>
        {isAddMovementOpen && (
          <motion.div
            key="movement-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center p-3 sm:p-6 z-50 overflow-y-auto"
          >
            <motion.div
              key="movement-modal-card"
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/90 dark:border-slate-800 my-auto max-h-[90dvh] sm:max-h-[88vh] flex flex-col"
            >
            <div className="shrink-0 flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    movementType === "WASTE"
                      ? "bg-rose-50 text-rose-600 border border-rose-100"
                      : movementType === "TRANSFER"
                      ? "bg-brand-50 text-brand-600 border border-brand-100"
                      : movementType === "IN"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {movementType === "WASTE" ? (
                    <AlertTriangle className="w-4.5 h-4.5" />
                  ) : movementType === "TRANSFER" ? (
                    <ArrowRight className="w-4.5 h-4.5" />
                  ) : movementType === "IN" ? (
                    <Plus className="w-4.5 h-4.5" />
                  ) : (
                    <Droplets className="w-4.5 h-4.5" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    {movementType === "TRANSFER"
                      ? "Keluarkan Bahan ke Bar / Dapur"
                      : movementType === "WASTE"
                      ? "Catat Bahan Rusak / Kalibrasi (Waste)"
                      : movementType === "IN"
                      ? "Tambah Stok Masuk Manual"
                      : "Catat Pemakaian Harian"}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {movementType === "TRANSFER"
                      ? "Ambil bahan kemasan dari gudang ke stasiun operasional kafe."
                      : "Setiap mutasi tercatat otomatis dalam riwayat stok."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMovementOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMovement} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
              {/* Type Switcher Pills */}
              <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("TRANSFER");
                    const ing = ingredients.find((i) => i.id === selectedIngredientForMove);
                    const conv = ing ? getIngredientUnitConversion(ing) : null;
                    setMovementUnitMode(conv?.hasConversion ? "PURCHASE" : "BASE");
                    setMovementTargetStation(
                      resolveDefaultTransferStation({
                        ingredientStorageLocation: ing?.storageLocation,
                        userDivision,
                      })
                    );
                  }}
                  className={`flex-1 min-w-[90px] py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    movementType === "TRANSFER" ? "bg-brand-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Ambil ke Bar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("WASTE");
                    setMovementUnitMode("BASE");
                  }}
                  className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    movementType === "WASTE" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Waste (Rusak)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("USAGE");
                    setMovementUnitMode("BASE");
                  }}
                  className={`flex-1 min-w-[70px] py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    movementType === "USAGE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pakai
                </button>
                {currentUser?.role !== "LEADER" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMovementType("IN");
                      setMovementUnitMode("BASE");
                    }}
                    className={`flex-1 min-w-[70px] py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      movementType === "IN" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Masuk
                  </button>
                )}
              </div>

              {/* Select Ingredient */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Bahan Baku</label>
                <CustomSelect
                  required
                  value={selectedIngredientForMove}
                  onChange={(newId) => {
                    setSelectedIngredientForMove(newId);
                    const ing = ingredients.find((i) => i.id === newId);
                    const conv = ing ? getIngredientUnitConversion(ing) : null;
                    setMovementUnitMode(conv?.hasConversion && movementType === "TRANSFER" ? "PURCHASE" : "BASE");
                    if (movementType === "TRANSFER") {
                      setMovementTargetStation(
                        resolveDefaultTransferStation({
                          ingredientStorageLocation: ing?.storageLocation,
                          userDivision,
                        })
                      );
                    }
                  }}
                  options={accessibleIngredients.map((ing) => ({
                    value: ing.id,
                    label: `${ing.name} (Sisa: ${ing.currentStock.toLocaleString("id-ID")} ${ing.unit})`,
                  }))}
                  buttonClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-base sm:text-xs text-slate-900"
                />
              </div>

              {/* Destination Station (if TRANSFER) */}
              {movementType === "TRANSFER" && (
                <div className="p-3 bg-brand-50/50 rounded-2xl border border-brand-100 space-y-2.5">
                  <div>
                    <label className="block font-bold text-brand-950 mb-1">
                      Stasiun Tujuan Pengeluaran
                    </label>
                    <CustomSelect
                      value={movementTargetStation}
                      onChange={setMovementTargetStation}
                      options={[
                        { value: "BAR", label: "Meja Bar (Barista & Minuman)" },
                        { value: "CHILLER", label: "Kulkas / Chiller Bar" },
                        { value: "KITCHEN", label: "Kitchen / Dapur Makanan" },
                        { value: "BAKERY", label: "Bakery & Pastry Station" },
                        { value: "OPERATIONAL", label: "Operasional & Kebersihan" },
                      ]}
                      buttonClassName="w-full px-3 py-2 rounded-xl border border-brand-200 bg-white font-bold text-base sm:text-xs text-brand-950"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={isDirectUsage}
                      onChange={(e) => setIsDirectUsage(e.target.checked)}
                      className="rounded border-brand-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-brand-900">
                      Otomatis kurangi stok gudang sebagai bahan aktif di stasiun
                    </span>
                  </label>
                </div>
              )}

              {/* Quantity & Unit Selection */}
              {(() => {
                const currentIng = ingredients.find((i) => i.id === selectedIngredientForMove);
                const conv = currentIng ? getIngredientUnitConversion(currentIng) : null;
                const hasConv = conv?.hasConversion;

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-700">
                        {movementType === "TRANSFER"
                          ? "Jumlah yang Dikeluarkan dari Gudang"
                          : movementType === "IN"
                          ? "Jumlah Masuk"
                          : "Jumlah Keluar / Terbuang"}
                      </label>

                      {/* Unit mode toggle if purchase conversion exists */}
                      {hasConv && (
                        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg text-[10px] font-bold border border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => setMovementUnitMode("PURCHASE")}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              movementUnitMode === "PURCHASE"
                                ? "bg-brand-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {conv.purchaseUnit}
                          </button>
                          <button
                            type="button"
                            onClick={() => setMovementUnitMode("BASE")}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              movementUnitMode === "BASE"
                                ? "bg-brand-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {currentIng?.unit}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <CurrencyInput
                        allowDecimals
                        emptyWhenZero
                        required
                        value={movementQuantity}
                        onValueChange={(_, num) => setMovementQuantity(Math.max(0, num))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        placeholder="0"
                      />
                      <span className="font-bold text-slate-700 shrink-0 text-xs px-2.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200/80">
                        {hasConv && movementUnitMode === "PURCHASE" ? conv.purchaseUnit : currentIng?.unit || "unit"}
                      </span>
                    </div>

                    {/* Live Calculation Preview */}
                    {hasConv && movementUnitMode === "PURCHASE" && movementQuantity > 0 && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex justify-between items-center">
                        <span>Konversi Satuan:</span>
                        <span className="font-mono font-bold text-brand-700">
                          {movementQuantity.toLocaleString("id-ID")} {conv.purchaseUnit} = {(movementQuantity * conv.conversionFactor).toLocaleString("id-ID")} {currentIng?.unit}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Waste Reason Quick Select */}
              {movementType === "WASTE" && (
                <div>
                  <span className="block font-bold text-rose-900 mb-1.5 text-[11px]">
                    Pilih Alasan Bahan Terbuang:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {WASTE_REASONS.map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setMovementNote(r)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer border active:scale-95 ${
                          movementNote === r
                            ? "bg-rose-50 text-rose-700 border-rose-300 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Estimated Loss Display */}
                  {movementQuantity > 0 && selectedIngredientForMove && (() => {
                    const targetIng = ingredients.find((i) => i.id === selectedIngredientForMove);
                    const targetConv = targetIng ? getIngredientUnitConversion(targetIng) : null;
                    const { totalCost: estimatedLoss } = computeMovementActualQuantityAndCost({
                      quantity: movementQuantity,
                      unitMode: movementUnitMode,
                      hasConversion: Boolean(targetConv?.hasConversion),
                      conversionFactor: targetConv?.conversionFactor,
                      costPerUnit: targetIng?.costPerUnit || 0,
                    });
                    return (
                      <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex justify-between items-center text-[11px]">
                        <span className="text-rose-800 font-semibold">Taksiran Nilai Kerugian:</span>
                        <span className="font-mono font-black text-rose-700 text-sm tabular-nums">
                          {formatCurrency(estimatedLoss)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Note input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder="Keterangan mutasi (opsional)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 px-4 sm:px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMovementOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`min-h-[44px] px-4.5 py-2 rounded-xl text-white font-bold cursor-pointer shadow-xs active:scale-[0.98] transition-all ${
                    movementType === "TRANSFER"
                      ? "bg-brand-600 hover:bg-brand-700"
                      : movementType === "WASTE"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : movementType === "IN"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-brand-600 hover:bg-brand-700"
                  }`}
                >
                  {movementType === "TRANSFER"
                    ? "Konfirmasi Pengeluaran"
                    : movementType === "WASTE"
                    ? "Simpan Catatan Waste"
                    : movementType === "IN"
                    ? "Simpan Stok Masuk"
                    : "Simpan Transaksi"}
                </button>
              </div>
            </form>
            </motion.div>
          </motion.div>

        )}
      </AnimatePresence>

      {/* Recipe Modal */}
      <RecipeModal
        isOpen={isAddRecipeOpen}
        onClose={() => setIsAddRecipeOpen(false)}
        editingRecipe={editingRecipe}
        ingredients={ingredients}
        existingRecipes={recipes}
        onSave={(recipeData) => {
          if (editingRecipe) {
            updateRecipe({ ...editingRecipe, ...recipeData });
            toast.success(`Resep "${recipeData.menuName}" berhasil diperbarui.`);
          } else {
            addRecipe(recipeData);
            toast.success(`Resep "${recipeData.menuName}" berhasil ditambahkan.`);
          }
        }}
      />

      {/* ── MODAL RINCIAN OPNAME DETAIL ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedOpnameForView && (
          <motion.div
            key="opname-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
          >
            <motion.div
              key="opname-detail-card"
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="my-auto bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col"
            >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Rincian Hasil Stok Opname</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
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
              </div>
              <button
                onClick={() => setSelectedOpnameForView(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {/* DESKTOP/TABLET VIEW: Structured Table */}
              <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="p-3">Bahan Baku</th>
                      <th className="p-3 text-center">Stok Sistem</th>
                      <th className="p-3 text-center">Stok Fisik Nyata</th>
                      <th className="p-3 text-center">Selisih</th>
                      <th className="p-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockOpnameItems.filter((i) => i.opnameId === selectedOpnameForView.id).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          <ClipboardList className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-xs text-slate-600">Belum ada rincian item tercatat pada sesi ini.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Sesi ini mungkin disimpan sebagai draf awal tanpa item.</p>
                        </td>
                      </tr>
                    ) : (
                      stockOpnameItems
                        .filter((i) => i.opnameId === selectedOpnameForView.id)
                        .map((item) => {
                          const ing = ingredients.find((i) => i.id === item.ingredientId);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="p-3 font-bold text-slate-900">
                                {ing ? ing.name : "Bahan Terhapus"}{" "}
                                {ing && <span className="text-slate-400 font-normal">({ing.unit})</span>}
                              </td>
                              <td className="p-3 text-center font-mono text-slate-600">
                                {item.systemStock.toLocaleString("id-ID")}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-900">
                                {item.physicalStock.toLocaleString("id-ID")}
                              </td>
                              <td className={`p-3 text-center font-mono font-bold ${
                                item.difference < 0 ? "text-rose-600" : item.difference > 0 ? "text-emerald-600" : "text-slate-500"
                              }`}>
                                {item.difference > 0 ? `+${item.difference.toLocaleString("id-ID")}` : item.difference.toLocaleString("id-ID")}
                              </td>
                              <td className="p-3 text-slate-500">
                                {item.notes || "-"}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW: Cards Feed */}
              <div className="block sm:hidden divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {stockOpnameItems.filter((i) => i.opnameId === selectedOpnameForView.id).length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <ClipboardList className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-semibold text-xs text-slate-600">Belum ada rincian item tercatat.</p>
                  </div>
                ) : (
                  stockOpnameItems
                    .filter((i) => i.opnameId === selectedOpnameForView.id)
                    .map((item) => {
                    const ing = ingredients.find((i) => i.id === item.ingredientId);
                    return (
                      <div key={item.id} className="p-3.5 space-y-1.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">
                            {ing ? ing.name : "Bahan Terhapus"}
                          </span>
                          <span className={`font-mono text-xs font-bold ${
                            item.difference < 0 ? "text-rose-600" : item.difference > 0 ? "text-emerald-600" : "text-slate-500"
                          }`}>
                            Selisih: {item.difference > 0 ? `+${item.difference.toLocaleString("id-ID")}` : item.difference.toLocaleString("id-ID")} {ing?.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Sistem: <strong className="font-mono text-slate-700">{item.systemStock.toLocaleString("id-ID")}</strong></span>
                          <span>Fisik Nyata: <strong className="font-mono text-slate-900">{item.physicalStock.toLocaleString("id-ID")} {ing?.unit}</strong></span>
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>
                    );
                  }))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div>
                {selectedOpnameForView.status === "DRAFT" && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(selectedOpnameForView.id)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 border border-rose-200 transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Draf</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedOpnameForView.status === "DRAFT" && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleResumeDraft(selectedOpnameForView)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Lanjutkan Draf Ini</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOpnameForView(null)}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors active:scale-95"
                >
                  Tutup
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>

      )}
    </AnimatePresence>

    {/* ── MODAL: CATAT CEPAT WASTE & SPOILAGE ─────────────────────────── */}
    <AnimatePresence>
      {isQuickWasteOpen && (
        <motion.div
          key="quick-waste-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center p-3 sm:p-6 z-50 overflow-y-auto"
        >
          <motion.div
            key="quick-waste-card"
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/90 dark:border-slate-800 my-auto max-h-[90dvh] sm:max-h-[88vh] flex flex-col"
          >
            <div className="shrink-0 flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-500/15">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200 shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Catat Waste / Bahan Rusak
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pencatatan cepat kalibrasi, racikan salah, atau bahan kedaluwarsa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickWasteOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickWaste} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
              {/* Select Ingredient */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Pilih Bahan Baku <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  required
                  value={wasteIngredientId}
                  onChange={(val) => {
                    setWasteIngredientId(val);
                    setWasteUnitMode("BASE");
                  }}
                  options={accessibleIngredients.map((ing) => ({
                    value: ing.id,
                    label: `${ing.name} (Stok: ${ing.currentStock.toLocaleString("id-ID")} ${ing.unit})`,
                  }))}
                  buttonClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-base sm:text-xs text-slate-900"
                />
              </div>

              {/* Quantity & Unit Selection */}
              {(() => {
                const currentIng = ingredients.find((i) => i.id === wasteIngredientId);
                const conv = currentIng ? getIngredientUnitConversion(currentIng) : null;
                const hasConv = conv?.hasConversion;

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-800">
                        Jumlah Bahan Terbuang <span className="text-rose-500">*</span>
                      </label>

                      {hasConv && (
                        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg text-[10px] font-bold border border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => setWasteUnitMode("BASE")}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              wasteUnitMode === "BASE"
                                ? "bg-brand-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {currentIng?.unit} (Resep)
                          </button>
                          <button
                            type="button"
                            onClick={() => setWasteUnitMode("PURCHASE")}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              wasteUnitMode === "PURCHASE"
                                ? "bg-brand-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {conv.purchaseUnit} (Kemasan)
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <CurrencyInput
                        allowDecimals
                        emptyWhenZero
                        required
                        value={wasteQuantity}
                        onValueChange={(_, num) => setWasteQuantity(Math.max(0, num))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        placeholder="0"
                      />
                      <span className="font-bold text-slate-700 shrink-0 text-xs px-2.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200/80">
                        {hasConv && wasteUnitMode === "PURCHASE" ? conv.purchaseUnit : currentIng?.unit || "unit"}
                      </span>
                    </div>

                    {hasConv && wasteUnitMode === "PURCHASE" && wasteQuantity > 0 && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex justify-between items-center">
                        <span>Konversi Satuan:</span>
                        <span className="font-mono font-bold text-brand-700">
                          {wasteQuantity.toLocaleString("id-ID")} {conv.purchaseUnit} = {(wasteQuantity * conv.conversionFactor).toLocaleString("id-ID")} {currentIng?.unit}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Standard Reason Selection */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Alasan Terstandar <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WASTE_REASONS_DETAIL.map((r) => {
                    const isSelected = wasteReason === r.id;
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setWasteReason(r.id)}
                        className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer active:scale-95 ${
                          isSelected
                            ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold shadow-2xs"
                            : "bg-slate-50 border-slate-200/80 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="font-bold text-[11px] leading-tight">{r.label}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 truncate">{r.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estimated Loss Live Calculation */}
              {(() => {
                const currentIng = ingredients.find((i) => i.id === wasteIngredientId);
                const conv = currentIng ? getIngredientUnitConversion(currentIng) : null;
                let actualQty = Number(wasteQuantity) || 0;
                if (wasteUnitMode === "PURCHASE" && conv?.hasConversion) {
                  actualQty = actualQty * conv.conversionFactor;
                }
                const unitCost = currentIng?.costPerUnit || 0;
                const estimatedLoss = Math.round(actualQty * unitCost);

                return (
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-900 block">
                        Taksiran Nilai Kerugian (Rp)
                      </span>
                      <span className="text-[10px] text-rose-700 font-mono">
                        {actualQty.toLocaleString("id-ID")} {currentIng?.unit} &times; {formatCurrency(unitCost)}
                      </span>
                    </div>
                    <span className="text-base sm:text-lg font-black font-mono text-rose-700">
                      {formatCurrency(estimatedLoss)}
                    </span>
                  </div>
                );
              })()}

              {/* Custom Note */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={wasteCustomNote}
                  onChange={(e) => setWasteCustomNote(e.target.value)}
                  placeholder="e.g. Kalibrasi beans gayo pagi, susu overheat saat rush..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 px-4 sm:px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickWasteOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan & Potong Stok</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>

      )}
    </AnimatePresence>

      {/* ── MODAL: ATUR KATEGORI BAHAN BAKU & OLAHAN ──────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isCategoryModalOpen && (
              <motion.div
                key="category-mgmt-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto"
              >
                <motion.div
                  key="category-mgmt-card"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="my-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden border border-slate-200/90 dark:border-slate-700"
                >
                  <div className="shrink-0 flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/20 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shrink-0">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          Pengaturan Kategori Bahan
                        </h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Tambah, ubah nama, atau hapus pengelompokan bahan baku &amp; bahan olahan.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryModalOpen(false);
                        setEditingCatOld(null);
                        setEditingCatNew("");
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 text-xs">
                    {/* Form Tambah Kategori Baru */}
                    {canManageCategories && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const added = handleAddCategory(newCategoryName);
                          if (added) setNewCategoryName("");
                        }}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-2xl bg-brand-50/50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/30"
                      >
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nama kategori baru (mis. Topping, Frozen Food)..."
                          className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                        <div className="w-full sm:w-44">
                          <CustomSelect
                            value={newCategoryDivision}
                            onChange={(val) => setNewCategoryDivision(val as IngredientCategoryDivision)}
                            options={CATEGORY_DIVISION_OPTIONS}
                            buttonClassName="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </form>
                    )}

                    {/* Daftar Kategori Eksisting */}
                    <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                      {visibleCategoriesForManage.map((catName) => {
                        const CatIcon = getIngredientCategoryIcon(catName);
                        const itemCount = accessibleIngredients.filter((i) =>
                          matchesIngredientCategory(i.category, catName)
                        ).length;
                        const isEditing = editingCatOld === catName;
                        const isProtected = catName.toLowerCase() === "lainnya";

                        return (
                          <div
                            key={catName}
                            className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700"
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingCatNew}
                                  onChange={(e) => setEditingCatNew(e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-brand-300 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRenameCategory(catName)}
                                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatOld(null);
                                    setEditingCatNew("");
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-brand-600 dark:text-brand-300 shrink-0">
                                    <CatIcon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {catName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                      {getCategoryDivisionLabel(catName)} • {itemCount} bahan terdaftar
                                    </p>
                                  </div>
                                </div>
                                {canManageCategories && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCatOld(catName);
                                        setEditingCatNew(catName);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                      title="Ubah nama kategori"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {!isProtected && (
                                      <button
                                        type="button"
                                        onClick={() => setCatToDelete(catName)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
                                        title="Hapus kategori"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="shrink-0 px-4 sm:px-6 py-3 bg-slate-50/95 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryModalOpen(false);
                        setEditingCatOld(null);
                        setEditingCatNew("");
                      }}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Selesai
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ConfirmModal
        isOpen={Boolean(catToDelete)}
        title="Hapus Kategori Bahan?"
        message={`Kategori "${catToDelete || ""}" akan dihapus dari daftar. Bahan yang memakai kategori ini akan otomatis dipindahkan ke kategori "Lainnya".`}
        confirmLabel="Hapus Kategori"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setCatToDelete(null)}
      />

      <ConfirmModal
        isOpen={Boolean(ingredientToDelete)}
        title="Hapus Bahan Baku?"
        message={`Hapus bahan baku "${ingredientToDelete?.name || ""}" dari daftar stok? Pastikan bahan tidak sedang digunakan dalam resep menu aktif.`}
        confirmLabel="Ya, Hapus Bahan"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (ingredientToDelete) {
            deleteIngredient(ingredientToDelete.id);
            toast.success(`Bahan "${ingredientToDelete.name}" berhasil dihapus.`);
            setIngredientToDelete(null);
          }
        }}
        onCancel={() => setIngredientToDelete(null)}
      />

      <ConfirmModal
        isOpen={Boolean(recipeToDelete)}
        title="Hapus Resep Menu?"
        message={`Hapus resep takaran untuk menu "${recipeToDelete?.menuName || ""}"?`}
        confirmLabel="Ya, Hapus Resep"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (recipeToDelete) {
            deleteRecipe(recipeToDelete.id);
            toast.success(`Resep "${recipeToDelete.menuName}" berhasil dihapus.`);
            setRecipeToDelete(null);
          }
        }}
        onCancel={() => setRecipeToDelete(null)}
      />

      <ConfirmModal
        isOpen={Boolean(draftToDeleteId)}
        title="Hapus Draf Stok Opname?"
        message="Apakah Anda yakin ingin menghapus draf stok opname ini? Data draf yang belum difinalisasi akan dihapus permanen."
        confirmLabel="Ya, Hapus Draf"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (draftToDeleteId) {
            deleteStockOpname(draftToDeleteId);
            if (selectedOpnameForView?.id === draftToDeleteId) {
              setSelectedOpnameForView(null);
            }
            toast.success("Draf stok opname berhasil dihapus.");
            setDraftToDeleteId(null);
          }
        }}
        onCancel={() => setDraftToDeleteId(null)}
      />

      <ConfirmModal
        isOpen={isCancelOpnameConfirmOpen}
        title="Batalkan Sesi Opname?"
        message="Batalkan sesi opname ini? Angka hitungan fisik yang belum disimpan sebagai draf akan hilang."
        confirmLabel="Ya, Batalkan Sesi"
        cancelLabel="Kembali Menghitung"
        variant="warning"
        onConfirm={() => {
          setIsCancelOpnameConfirmOpen(false);
          setIsOpnameMode(false);
        }}
        onCancel={() => setIsCancelOpnameConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isFinalizeOpnameConfirmOpen}
        title="Finalisasi & Sesuaikan Stok?"
        message={(() => {
          const liveDiffCount = recomputeOpnameItemsWithLiveStock(opnameItems, ingredients).filter(
            (i) => i.difference !== 0
          ).length;
          return liveDiffCount > 0
            ? `Terdapat ${liveDiffCount} bahan dengan selisih stok terhadap saldo terkini. Sistem akan otomatis memperbarui stok riil dan mencatat mutasi koreksi. Lanjutkan finalisasi?`
            : "Semua stok fisik sesuai dengan saldo sistem terkini. Lanjutkan finalisasi sesi opname ini?";
        })()}
        confirmLabel="Ya, Finalisasi Sekarang"
        cancelLabel="Periksa Kembali"
        variant="info"
        onConfirm={() => {
          setIsFinalizeOpnameConfirmOpen(false);
          saveOpname("FINAL");
        }}
        onCancel={() => setIsFinalizeOpnameConfirmOpen(false)}
      />
    </div>
  );
};
