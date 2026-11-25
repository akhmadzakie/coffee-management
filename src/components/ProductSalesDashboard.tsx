import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Edit2,
  FileSpreadsheet,
  Info,
  Layers,
  Package,
  PieChart,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "../context/ToastContext";
import type {
  CashAccount,
  DailySalesRecap,
  Ingredient,
  Product,
  ProductDivision,
  Recipe,
  SalesTransaction,
  Settings,
  StockMovement,
} from "../types";
import { getLocalDateString, getLocalPeriodString } from "../utils/dateUtils";
import { addDaysToLocalDate } from "../utils/syncSanitizers";
import { exportProductSalesAnalyticsToXlsx } from "../utils/exportXlsx";
import { formatCurrency } from "../utils/format";
import {
  computePhysicalStockOutByIngredient,
  computeProductSalesAnalytics,
  formatCatalogMenuVariantLabel,
  PRODUCT_GROUP_LABELS,
  toSaleLocalDateKey,
  type DateFilterMode,
  type MenuEngineeringQuadrant,
  type ProductSortBy,
} from "../utils/productSalesAnalytics";
import { CurrencyInput } from "./common/CurrencyInput";
import { CsvImportExport } from "./common/CsvImportExport";
import { CustomDatePicker } from "./common/CustomDatePicker";
import { CustomSelect } from "./common/CustomSelect";
import { RupiahSign } from "./common/RupiahSign";
import {
  ProductFormModal,
  type ProductFormInitialDraft,
} from "./MenuManagement";

export interface ProductSalesDashboardProps {
  salesTransactions: SalesTransaction[];
  dailySalesRecaps: DailySalesRecap[];
  products: Product[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  stockMovements?: StockMovement[];
  settings: Settings;
  cashAccounts: CashAccount[];
  isReadOnly: boolean;
  onImportSales: (parsedData: any[], fileName?: string) => void;
  onAddManualSales: (
    transactions: Omit<SalesTransaction, "id">[],
    fileName?: string,
    targetCashAccountId?: string
  ) => { count: number; cashSyncedAmount: number; stockDeductedCount: number };
  onSaveProduct: (
    productData: Omit<Product, "id" | "createdAt">,
    existingProduct?: Product | null
  ) => void;
  onSaveRecipe: (recipe: Omit<Recipe, "id">) => void;
  onUpdateRecipe?: (recipe: Recipe) => void;
  isPeriodClosed: (dateStr: string) => boolean;
}

const CHART_COLORS = [
  "#1b2cc0",
  "#7692ff",
  "#059669",
  "#0f1860",
  "#a2c5fb",
  "#e11d48",
];

const QUADRANT_BADGES: Record<
  MenuEngineeringQuadrant,
  { label: string; hint: string; className: string }
> = {
  STAR: {
    label: "⭐ Unggulan",
    hint: "Laku keras & margin tinggi (Star)",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  PLOWHORSE: {
    label: "🐴 Populer",
    hint: "Volume tinggi tapi margin di bawah rata-rata (Plowhorse)",
    className:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  PUZZLE: {
    label: "🧩 Potensial",
    hint: "Margin tebal tapi volume masih rendah (Puzzle)",
    className:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  },
  DOG: {
    label: "⚠️ Evaluasi",
    hint: "Volume & margin di bawah rata-rata (Perlu evaluasi)",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  },
};

const DIVISION_BADGES: Record<
  string,
  { label: string; shortLabel: string; className: string }
> = {
  BAR: {
    label: "☕ Bar",
    shortLabel: "Bar",
    className:
      "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
  },
  KITCHEN: {
    label: "🍳 Kitchen",
    shortLabel: "Kitchen",
    className:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  BAKER: {
    label: "🥐 Bakery",
    shortLabel: "Bakery",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  UNMAPPED: {
    label: "Belum Terdaftar",
    shortLabel: "Non-Katalog",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  },
};

interface ManualSaleDraftRow {
  rowId: string;
  catalogKey: string;
  menuName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export const ProductSalesDashboard: React.FC<ProductSalesDashboardProps> = ({
  salesTransactions,
  dailySalesRecaps,
  products,
  recipes,
  ingredients,
  stockMovements = [],
  settings,
  isReadOnly,
  onImportSales,
  onAddManualSales,
  onSaveProduct,
  onSaveRecipe,
  onUpdateRecipe,
  isPeriodClosed,
}) => {
  const todayYmd = getLocalDateString();
  const monthStartYmd = `${getLocalPeriodString()}-01`;

  // Time Filters
  const [dateMode, setDateMode] = useState<DateFilterMode>("DATE_RANGE");
  const [singleDate, setSingleDate] = useState<string>(todayYmd);
  const [startDate, setStartDate] = useState<string>(monthStartYmd);
  const [endDate, setEndDate] = useState<string>(todayYmd);

  // 3-Tier Cascading Taxonomy Filters
  const [divisionFilter, setDivisionFilter] = useState<
    "ALL" | ProductDivision | "UNMAPPED"
  >("ALL");
  const [productGroupFilter, setProductGroupFilter] = useState<string>("ALL");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<ProductSortBy>("QTY_DESC");

  // Sub-views & Expandable rows
  const [subView, setSubView] = useState<
    "pmix" | "ingredients" | "zero_sales" | "daily_log"
  >("pmix");
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(
    () => new Set()
  );

  // Quick Register / Edit Product Modal
  const [productModalState, setProductModalState] = useState<{
    isOpen: boolean;
    product: Product | null;
    initialDraft: ProductFormInitialDraft | null;
  }>({
    isOpen: false,
    product: null,
    initialDraft: null,
  });

  // Manual Sales Entry Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>(todayYmd);
  const [manualRows, setManualRows] = useState<ManualSaleDraftRow[]>([]);

  const analytics = useMemo(
    () =>
      computeProductSalesAnalytics({
        salesTransactions,
        dailySalesRecaps,
        products,
        recipes,
        ingredients,
        menuCategoriesByDivision: settings?.menuCategories,
        dateMode,
        singleDate,
        startDate,
        endDate,
        division: divisionFilter,
        productGroup: productGroupFilter,
        menuCategory: menuCategoryFilter,
        searchQuery,
        sortBy,
      }),
    [
      salesTransactions,
      dailySalesRecaps,
      products,
      recipes,
      ingredients,
      settings?.menuCategories,
      dateMode,
      singleDate,
      startDate,
      endDate,
      divisionFilter,
      productGroupFilter,
      menuCategoryFilter,
      searchQuery,
      sortBy,
    ]
  );

  const physicalOutMap = useMemo(() => {
    if (dateMode === "SINGLE_DAY") {
      return computePhysicalStockOutByIngredient({
        stockMovements,
        startDate: singleDate,
        endDate: singleDate,
      });
    }
    if (dateMode === "DATE_RANGE") {
      return computePhysicalStockOutByIngredient({
        stockMovements,
        startDate,
        endDate,
      });
    }
    return computePhysicalStockOutByIngredient({ stockMovements });
  }, [stockMovements, dateMode, singleDate, startDate, endDate]);

  const benchmarkTotals = useMemo(() => {
    let recipeCost = 0;
    for (const row of analytics.ingredientUsageSummary) {
      recipeCost += row.totalCost;
    }
    let physicalCost = 0;
    for (const row of physicalOutMap.values()) {
      physicalCost += row.totalOutCost;
    }
    return {
      recipeCost: Math.round(recipeCost),
      physicalCost: Math.round(physicalCost),
    };
  }, [analytics.ingredientUsageSummary, physicalOutMap]);

  // Catalog variant options for Import template & Manual Input modal
  const catalogVariantChoices = useMemo(() => {
    const list: Array<{
      key: string;
      menuName: string;
      product: Product;
      variantPrice: number;
      variantHpp: number;
      division: ProductDivision;
      category: string;
      label: string;
    }> = [];

    products
      .filter((p) => p.isActive !== false)
      .forEach((p) => {
        const vars = Array.isArray(p.variants) ? p.variants : [];
        if (vars.length === 0) {
          list.push({
            key: `${p.id}::default`,
            menuName: p.name,
            product: p,
            variantPrice: 0,
            variantHpp: 0,
            division: p.division,
            category: p.category,
            label: `[${p.division} • ${p.category}] ${p.name}`,
          });
          return;
        }
        vars.forEach((v) => {
          const fullLabel = formatCatalogMenuVariantLabel(
            p.name,
            v.name,
            vars.length
          );
          list.push({
            key: `${p.id}::${v.id}`,
            menuName: fullLabel,
            product: p,
            variantPrice: Math.round(Number(v.price) || 0),
            variantHpp: Math.round(Number(v.estimatedHpp) || 0),
            division: p.division,
            category: p.category,
            label: `[${p.division} • ${p.category}] ${fullLabel} (${formatCurrency(v.price)})`,
          });
        });
      });

    return list;
  }, [products]);

  const latestAvailableSaleDate = useMemo(() => {
    let latest = "";
    salesTransactions.forEach((s) => {
      const d = toSaleLocalDateKey(s.date);
      if (d > latest) latest = d;
    });
    return latest;
  }, [salesTransactions]);

  const toggleExpandProduct = (key: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyTimePreset = (
    preset: "TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "ALL"
  ) => {
    if (preset === "TODAY") {
      setDateMode("SINGLE_DAY");
      setSingleDate(todayYmd);
    } else if (preset === "YESTERDAY") {
      setDateMode("SINGLE_DAY");
      setSingleDate(addDaysToLocalDate(todayYmd, -1));
    } else if (preset === "LAST_7") {
      setDateMode("DATE_RANGE");
      setStartDate(addDaysToLocalDate(todayYmd, -6));
      setEndDate(todayYmd);
    } else if (preset === "THIS_MONTH") {
      setDateMode("DATE_RANGE");
      setStartDate(monthStartYmd);
      setEndDate(todayYmd);
    } else {
      setDateMode("ALL");
    }
  };

  const activePeriodLabel = useMemo(() => {
    if (dateMode === "ALL") return "Semua_Waktu";
    if (dateMode === "SINGLE_DAY") return singleDate || todayYmd;
    return `${startDate || "Awal"}_sd_${endDate || "Akhir"}`;
  }, [dateMode, singleDate, startDate, endDate, todayYmd]);

  const handleOpenManualModal = (prefillDate?: string) => {
    if (isReadOnly) return;
    const first = catalogVariantChoices[0];
    setManualDate(
      prefillDate || (dateMode === "SINGLE_DAY" ? singleDate : todayYmd)
    );
    setManualRows([
      {
        rowId: `row-${Date.now()}`,
        catalogKey: first?.key || "",
        menuName: first?.menuName || "",
        unitPrice: first?.variantPrice || 0,
        quantity: 1,
        totalPrice: first?.variantPrice || 0,
      },
    ]);
    setIsManualModalOpen(true);
  };

  const handleAddManualRow = () => {
    const first = catalogVariantChoices[0];
    setManualRows((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        catalogKey: first?.key || "",
        menuName: first?.menuName || "",
        unitPrice: first?.variantPrice || 0,
        quantity: 1,
        totalPrice: first?.variantPrice || 0,
      },
    ]);
  };

  const handleUpdateManualRow = (
    rowId: string,
    patch: Partial<ManualSaleDraftRow>
  ) => {
    setManualRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  };

  const handleSelectCatalogItemForRow = (rowId: string, catalogKey: string) => {
    const picked = catalogVariantChoices.find((c) => c.key === catalogKey);
    if (!picked) return;
    setManualRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const qty = Math.max(1, row.quantity || 1);
        return {
          ...row,
          catalogKey,
          menuName: picked.menuName,
          unitPrice: picked.variantPrice,
          totalPrice: Math.round(qty * picked.variantPrice),
        };
      })
    );
  };

  const handleSubmitManualSales = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!manualDate) {
      toast.error("Pilih tanggal penjualan terlebih dahulu.");
      return;
    }
    if (isPeriodClosed(manualDate)) {
      toast.error(
        `Periode ${manualDate.slice(0, 7)} telah tutup buku. Penjualan pada tanggal ini dikunci.`
      );
      return;
    }

    const validRows = manualRows.filter(
      (r) => r.menuName.trim() && Math.round(Number(r.quantity) || 0) > 0
    );
    if (validRows.length === 0) {
      toast.error("Tambahkan minimal 1 item menu dengan jumlah terjual > 0.");
      return;
    }

    const payload: Omit<SalesTransaction, "id">[] = validRows.map((r) => ({
      date: manualDate,
      menuName: r.menuName.trim(),
      quantitySold: Math.round(Number(r.quantity) || 1),
      totalPrice: Math.round(Number(r.totalPrice) || 0),
      importLogId: "",
    }));

    const res = onAddManualSales(
      payload,
      `Input Manual Produk (${manualDate})`
    );
    setIsManualModalOpen(false);
    toast.success(
      `Berhasil mencatat ${res.count} baris penjualan produk` +
        (res.stockDeductedCount > 0
          ? ` & memotong stok ${res.stockDeductedCount} bahan baku sesuai resep.`
          : ".")
    );
  };

  const handleExportFiltered = async () => {
    if (
      analytics.productMixRows.length === 0 &&
      analytics.filteredTransactions.length === 0
    ) {
      toast.warning(
        "Tidak ada data penjualan produk pada filter aktif untuk diekspor."
      );
      return;
    }
    try {
      await exportProductSalesAnalyticsToXlsx({
        analytics,
        settings,
        periodLabel: activePeriodLabel,
      });
      toast.success(
        "Laporan Penjualan Produk (4 sheet analitik) berhasil diekspor ke Excel."
      );
    } catch (err: any) {
      toast.error("Gagal mengekspor laporan penjualan produk: " + (err?.message || err));
    }
  };

  // Charts Data
  const topChartData = useMemo(() => {
    return [...analytics.productMixRows]
      .sort((a, b) => b.totalRevenue - a.totalRevenue || b.totalQty - a.totalQty)
      .slice(0, 7)
      .map((r) => ({
        name:
          r.productName.length > 20
            ? `${r.productName.slice(0, 18)}…`
            : r.productName,
        fullName: r.productName,
        omzet: r.totalRevenue,
        laba: Math.max(0, r.grossProfit),
        qty: r.totalQty,
      }));
  }, [analytics.productMixRows]);

  const { kpiSummary, omzetCrossCheck } = analytics;
  const totalManualDraftQty = manualRows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0),
    0
  );
  const totalManualDraftRevenue = manualRows.reduce(
    (sum, r) => sum + Math.round(Number(r.totalPrice) || 0),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-5"
    >
      {/* ── 1. HEADER TOOLBAR & AKSI UTAMA ─────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30">
                <BarChart3 className="w-3 h-3" />
                Product Mix &amp; Menu Engineering
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Terintegrasi langsung dengan{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {products.length} menu
                </strong>{" "}
                di Katalog Menu
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-1 tracking-tight">
              Dashboard Rekap Penjualan Produk &amp; Varian
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleOpenManualModal()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-sm shadow-brand-600/20 flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Input Penjualan Produk</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportFiltered}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
              title="Ekspor data penjualan produk sesuai filter aktif"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Ekspor Excel</span>
            </button>

            <div className="shrink-0">
              <CsvImportExport
                onImport={onImportSales}
                canImport={!isReadOnly}
                allowBulkEdit={false}
                requiredHeaders={["Nama Menu", "Quantity", "Total Penjualan"]}
                exportFilename={`Data_Penjualan_Produk_${todayYmd}`}
                exportTitle="Data Transaksi Penjualan Produk"
                templateHeaders={[
                  "Tanggal",
                  "Nama Menu",
                  "Quantity",
                  "Total Penjualan",
                ]}
                templateExampleRow={[
                  todayYmd,
                  catalogVariantChoices[0]?.menuName ||
                    "Kopi Susu Gula Aren - Iced 16oz",
                  "45",
                  "990000",
                ]}
                templateFilename="Template_Import_Penjualan_Produk.xlsx"
                buttonLabel={isReadOnly ? "Ekspor Data" : "Impor POS Excel / CSV"}
                currentData={analytics.filteredTransactions.map((s) => ({
                  id: s.id,
                  Tanggal: String(s.date).slice(0, 10),
                  "Nama Menu": s.menuName,
                  Quantity: s.quantitySold,
                  "Total Penjualan": s.totalPrice,
                }))}
                templateDropdowns={{
                  "Nama Menu":
                    catalogVariantChoices.length > 0
                      ? Array.from(
                          new Set(
                            catalogVariantChoices.map((c) => c.menuName)
                          )
                        )
                      : [
                          "Kopi Susu Gula Aren - Iced 16oz",
                          "Cafe Latte - Hot 8oz",
                          "Nasi Ayam Sambal Matah",
                        ],
                }}
                templateColumnTypes={{
                  Tanggal: "date",
                  Quantity: "integer",
                  "Total Penjualan": "number",
                }}
                templateFormats={{
                  Tanggal: "date",
                  Quantity: "integer",
                  "Total Penjualan": "currency",
                }}
                templateHints={{
                  Tanggal:
                    "Format tanggal penjualan: YYYY-MM-DD (contoh: 2026-11-23)",
                  "Nama Menu":
                    "Pilih produk & varian dari Katalog Menu agar HPP & pemotongan stok akurat",
                  Quantity: "Jumlah cup / porsi terjual",
                  "Total Penjualan":
                    "Total nominal penjualan dalam Rupiah (bilangan bulat)",
                }}
                templateInstructions={[
                  "Template otomatis terhubung dengan daftar Produk & Varian di modul Katalog Menu.",
                  "Mendukung ekspor dari Moka, Majoo, Pawoon, Qasir, maupun Square POS.",
                  "Setelah diimpor, sistem menghitung HPP, laba kotor, dan memotong stok bahan sesuai resep varian.",
                ]}
              />
            </div>
          </div>
        </div>

        {/* ── FILTER WAKTU (PER HARI / RENTANG TANGGAL + PRESET CEPAT) ──────── */}
        <div className="p-3.5 bg-slate-50/90 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700/70 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Mode Switcher + Date Picker */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                {(
                  [
                    { id: "SINGLE_DAY", label: "Per Hari" },
                    { id: "DATE_RANGE", label: "Rentang Tanggal" },
                    { id: "ALL", label: "Semua Waktu" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDateMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateMode === m.id
                        ? "bg-brand-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {dateMode === "SINGLE_DAY" && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSingleDate(addDaysToLocalDate(singleDate, -1))}
                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-brand-300 cursor-pointer"
                    title="Hari sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-40">
                    <CustomDatePicker
                      value={singleDate}
                      onChange={(val) => setSingleDate(val || todayYmd)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSingleDate(addDaysToLocalDate(singleDate, 1))}
                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-brand-300 cursor-pointer"
                    title="Hari berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {dateMode === "DATE_RANGE" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-38">
                    <CustomDatePicker
                      value={startDate}
                      onChange={(val) => {
                        setStartDate(val);
                        if (val && endDate && val > endDate) {
                          setEndDate(val);
                        }
                      }}
                      placeholder="Dari tanggal"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-400">s/d</span>
                  <div className="w-38">
                    <CustomDatePicker
                      value={endDate}
                      onChange={(val) => {
                        setEndDate(val);
                        if (val && startDate && val < startDate) {
                          setStartDate(val);
                        }
                      }}
                      placeholder="Sampai tanggal"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Cepat:
              </span>
              {[
                {
                  id: "TODAY" as const,
                  label: "Hari Ini",
                  active: dateMode === "SINGLE_DAY" && singleDate === todayYmd,
                },
                {
                  id: "YESTERDAY" as const,
                  label: "Kemarin",
                  active:
                    dateMode === "SINGLE_DAY" &&
                    singleDate === addDaysToLocalDate(todayYmd, -1),
                },
                {
                  id: "LAST_7" as const,
                  label: "7 Hari",
                  active:
                    dateMode === "DATE_RANGE" &&
                    startDate === addDaysToLocalDate(todayYmd, -6) &&
                    endDate === todayYmd,
                },
                {
                  id: "THIS_MONTH" as const,
                  label: "Bulan Ini",
                  active:
                    dateMode === "DATE_RANGE" &&
                    startDate === monthStartYmd &&
                    endDate === todayYmd,
                },
                {
                  id: "ALL" as const,
                  label: "Semua",
                  active: dateMode === "ALL",
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyTimePreset(p.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    p.active
                      ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── FILTER HIRARKI 3 TINGKAT (DIVISI -> KATEGORI PRODUK -> KATEGORI MENU) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
            {/* Level 1: Divisi */}
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                1. Kategori Divisi
              </label>
              <CustomSelect
                value={divisionFilter}
                onChange={(val) => {
                  setDivisionFilter(val as any);
                  setProductGroupFilter("ALL");
                  setMenuCategoryFilter("ALL");
                }}
                options={[
                  { value: "ALL", label: "Semua Divisi" },
                  { value: "BAR", label: "☕ Divisi Bar & Minuman" },
                  { value: "KITCHEN", label: "🍳 Divisi Kitchen & Makanan" },
                  { value: "BAKER", label: "🥐 Divisi Bakery & Pastry" },
                  { value: "UNMAPPED", label: "Belum Terdaftar di Menu" },
                ]}
                buttonClassName="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Level 2: Kategori Produk */}
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                2. Kategori Produk
              </label>
              <CustomSelect
                value={productGroupFilter}
                onChange={(val) => {
                  setProductGroupFilter(val);
                  setMenuCategoryFilter("ALL");
                }}
                options={[
                  { value: "ALL", label: "Semua Kategori Produk" },
                  ...analytics.availableProductGroups.map((grp) => ({
                    value: grp,
                    label: PRODUCT_GROUP_LABELS[grp] || grp,
                  })),
                ]}
                buttonClassName="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Level 3: Kategori Menu */}
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                3. Kategori Menu
              </label>
              <CustomSelect
                searchable
                value={menuCategoryFilter}
                onChange={setMenuCategoryFilter}
                options={[
                  { value: "ALL", label: "Semua Kategori Menu" },
                  ...analytics.availableMenuCategories.map((cat) => ({
                    value: cat,
                    label: cat,
                  })),
                ]}
                buttonClassName="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Pencarian & Urutan */}
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Cari Produk / Urutkan
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama produk..."
                    className="w-full pl-8 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Hapus pencarian produk"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="w-32 shrink-0">
                  <CustomSelect
                    value={sortBy}
                    onChange={(val) => setSortBy(val as ProductSortBy)}
                    options={[
                      { value: "QTY_DESC", label: "Terlaris (Qty)" },
                      { value: "REVENUE_DESC", label: "Omzet Tertinggi" },
                      { value: "PROFIT_DESC", label: "Laba Tertinggi" },
                      { value: "MARGIN_DESC", label: "Margin %" },
                      { value: "NAME_ASC", label: "Nama A-Z" },
                    ]}
                    buttonClassName="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. CROSS-CHECK PANEL (OMZET HARIAN VS RINCIAN PENJUALAN PRODUK) ── */}
      {(omzetCrossCheck.totalRecapOmzet > 0 ||
        omzetCrossCheck.totalAllProductSales > 0) && (
        <div
          className={`p-4 rounded-2xl border shadow-2xs space-y-2.5 ${
            omzetCrossCheck.datesWithRecapButNoProducts.length === 0 &&
            Math.abs(omzetCrossCheck.difference) <= 1000
              ? "bg-gradient-to-r from-emerald-50/80 via-white to-white dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-500/30"
              : "bg-gradient-to-r from-amber-50/80 via-white to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 border-amber-200/80 dark:border-amber-500/30"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  omzetCrossCheck.datesWithRecapButNoProducts.length === 0 &&
                  Math.abs(omzetCrossCheck.difference) <= 1000
                    ? "bg-emerald-100/80 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100/80 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300"
                }`}
              >
                {omzetCrossCheck.datesWithRecapButNoProducts.length === 0 &&
                Math.abs(omzetCrossCheck.difference) <= 1000 ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Cek Silang: Rekap Omzet Harian vs Total Penjualan Produk
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums ${
                      omzetCrossCheck.matchPercent >= 98 &&
                      omzetCrossCheck.matchPercent <= 102
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
                    }`}
                  >
                    Kecocokan {omzetCrossCheck.matchPercent}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                  Rekap Omzet Harian:{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatCurrency(omzetCrossCheck.totalRecapOmzet)}
                  </strong>{" "}
                  • Total Penjualan Produk (Seluruh Divisi):{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatCurrency(omzetCrossCheck.totalAllProductSales)}
                  </strong>{" "}
                  • Selisih:{" "}
                  <strong
                    className={
                      omzetCrossCheck.difference === 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    }
                  >
                    {omzetCrossCheck.difference > 0 ? "+" : ""}
                    {formatCurrency(omzetCrossCheck.difference)}
                  </strong>
                </p>
              </div>
            </div>

            {omzetCrossCheck.datesWithRecapButNoProducts.length > 0 &&
              !isReadOnly && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenManualModal(
                      omzetCrossCheck.datesWithRecapButNoProducts[0].date
                    )
                  }
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[11px] font-bold shrink-0 cursor-pointer transition-all self-start md:self-center"
                >
                  + Lengkapi Produk tgl{" "}
                  {omzetCrossCheck.datesWithRecapButNoProducts[0].date}
                </button>
              )}
          </div>

          {omzetCrossCheck.datesWithRecapButNoProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-200/60 dark:border-amber-500/20 text-[11px]">
              <span className="font-bold text-amber-800 dark:text-amber-300">
                Sudah ada Rekap Omzet tapi belum ada rincian Produk:
              </span>
              {omzetCrossCheck.datesWithRecapButNoProducts
                .slice(0, 6)
                .map((d) =>
                  isReadOnly ? (
                    <span
                      key={d.date}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 font-semibold tabular-nums"
                    >
                      {d.date} ({formatCurrency(d.recapAmount)})
                    </span>
                  ) : (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => handleOpenManualModal(d.date)}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 font-semibold hover:border-brand-400 cursor-pointer tabular-nums"
                      title="Klik untuk input penjualan produk di tanggal ini"
                    >
                      {d.date} ({formatCurrency(d.recapAmount)})
                    </button>
                  )
                )}
            </div>
          )}
        </div>
      )}

      {/* ── 3. UNMATCHED MENUS BANNER (1-KLIK DAFTARKAN KE KATALOG MENU) ───── */}
      <AnimatePresence>
        {analytics.unmatchedMenuSummaries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/80 via-white to-white dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 border border-rose-200/80 dark:border-rose-500/30 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  {analytics.unmatchedMenuSummaries.length} nama menu terjual belum terdaftar di Katalog Menu (HPP &amp; stok resep belum terhitung otomatis):
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analytics.unmatchedMenuSummaries.map((u) => (
                    <div
                      key={u.rawMenuName}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-500/30 text-xs shadow-2xs"
                    >
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {u.rawMenuName}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {u.totalQty.toLocaleString("id-ID")}x •{" "}
                        {formatCurrency(u.avgUnitPrice)}
                      </span>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setProductModalState({
                              isOpen: true,
                              product: null,
                              initialDraft: {
                                name: u.detectedProductName,
                                variantName: u.detectedVariantName,
                                price: u.avgUnitPrice,
                                division: "BAR",
                              },
                            })
                          }
                          className="px-2 py-0.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          + Daftarkan ke Menu
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. 4 KARTU KPI SOFT-TINTED ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 border border-brand-200/70 dark:border-brand-500/30 shadow-coffee-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
              Total Produk Terjual
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-100/80 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-300">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {kpiSummary.totalQty.toLocaleString("id-ID")}{" "}
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              cup/porsi
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
            <span>
              Rata-rata{" "}
              <strong>{kpiSummary.avgDailyQty.toLocaleString("id-ID")}</strong>
              /hari ({kpiSummary.activeDaysCount} hari)
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/70 dark:border-emerald-500/30 shadow-coffee-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Total Omzet Produk
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100/80 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
              <RupiahSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {formatCurrency(kpiSummary.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
            Rata-rata harga:{" "}
            <strong className="text-emerald-700 dark:text-emerald-300">
              {formatCurrency(kpiSummary.avgTicketPrice)}
            </strong>
            /item
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-50/70 via-white to-white dark:from-sky-500/15 dark:via-slate-900 dark:to-slate-900 border border-sky-200/70 dark:border-sky-500/30 shadow-coffee-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Estimasi Laba Kotor &amp; HPP
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-100/80 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
              {formatCurrency(kpiSummary.grossProfit)}
            </span>
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 tabular-nums">
              ({kpiSummary.marginPercent}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
            HPP Resep:{" "}
            <strong className="text-slate-800 dark:text-slate-200">
              {formatCurrency(kpiSummary.totalHpp)}
            </strong>{" "}
            (Food Cost {kpiSummary.foodCostPercent}%)
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-500/30 shadow-coffee-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Produk Juara Periode Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100/80 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          {kpiSummary.topByVolume ? (
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                🥇 {kpiSummary.topByVolume.productName}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                Terjual{" "}
                <strong>
                  {kpiSummary.topByVolume.totalQty.toLocaleString("id-ID")} porsi
                </strong>{" "}
                ({formatCurrency(kpiSummary.topByVolume.totalRevenue)})
              </p>
              {kpiSummary.topByProfit && (
                <p
                  className={`text-[10px] font-semibold truncate tabular-nums ${
                    kpiSummary.topByProfit.grossProfit >= 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  Laba tertinggi: {kpiSummary.topByProfit.productName} (
                  {kpiSummary.topByProfit.grossProfit >= 0 ? "+" : ""}
                  {formatCurrency(kpiSummary.topByProfit.grossProfit)})
                </p>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 pt-1">
              Belum ada penjualan pada filter ini
            </div>
          )}
        </div>
      </div>

      {/* ── 5. GRAFIK & BREAKDOWN KATEGORI ─────────────────────────────────── */}
      {analytics.productMixRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Top Produk Chart */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Top 7 Kontributor Omzet &amp; Laba Kotor Produk
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Perbandingan omzet kotor terhadap estimasi laba bersih resep (Rp)
                </p>
              </div>
              <PieChart className="w-4 h-4 text-brand-600 dark:text-brand-300" />
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      formatCurrency(Number(val) || 0),
                      name === "omzet" ? "Omzet" : "Laba Kotor",
                    ]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.fullName || label
                    }
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="omzet"
                    name="omzet"
                    fill="#1b2cc0"
                    radius={[0, 6, 6, 0]}
                    barSize={12}
                  />
                  <Bar
                    dataKey="laba"
                    name="laba"
                    fill="#059669"
                    radius={[0, 6, 6, 0]}
                    barSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribusi Divisi & Kategori Menu */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Komposisi Divisi &amp; Kategori Menu
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Klik kategori untuk menyaring langsung
                </p>
              </div>
              <Layers className="w-4 h-4 text-brand-600 dark:text-brand-300" />
            </div>

            {/* Divisi Bars */}
            <div className="space-y-2">
              {analytics.divisionDistribution.map((d, idx) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() =>
                    setDivisionFilter(
                      divisionFilter === d.key ? "ALL" : (d.key as any)
                    )
                  }
                  className="w-full text-left p-2 rounded-xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 hover:border-brand-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {d.label}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatCurrency(d.totalRevenue)} ({d.sharePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, d.sharePercent)}%`,
                        backgroundColor:
                          CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>

            {/* Kategori Menu Chips */}
            {analytics.menuCategoryDistribution.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Per Kategori Menu
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.menuCategoryDistribution.map((c) => {
                    const isSelected = menuCategoryFilter === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() =>
                          setMenuCategoryFilter(isSelected ? "ALL" : c.key)
                        }
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer tabular-nums ${
                          isSelected
                            ? "bg-brand-600 text-white border-brand-600"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-brand-300"
                        }`}
                      >
                        {c.label}: {c.qtySold.toLocaleString("id-ID")} (
                        {c.sharePercent}%)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 6. SUB-NAVIGASI ANALITIK & TABEL UTAMA ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            {[
              {
                id: "pmix" as const,
                label: "Rekap Produk & Varian",
                count: analytics.productMixRows.length,
              },
              {
                id: "ingredients" as const,
                label: "Pemakaian Bahan Resep",
                count: analytics.ingredientUsageSummary.length,
              },
              {
                id: "zero_sales" as const,
                label: "Menu Aktif 0 Terjual",
                count: analytics.zeroSalesProducts.length,
              },
              {
                id: "daily_log" as const,
                label: "Log Rincian Harian",
                count: analytics.filteredTransactions.length,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubView(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
                  subView === t.id
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                    subView === t.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-300/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Klik baris produk pada Rekap Produk untuk melihat rincian{" "}
            <strong className="text-slate-800 dark:text-slate-200">
              Varian &amp; Harian
            </strong>
            .
          </span>
        </div>

        {/* ── SUB-TAB 1: REKAP PRODUK & VARIAN (PMIX) ─────────────────────── */}
        {subView === "pmix" && (
          <>
            {analytics.productMixRows.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Belum ada penjualan produk pada filter waktu / kategori ini
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Silakan ubah rentang tanggal, reset filter kategori, import dari POS, atau catat penjualan manual.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(divisionFilter !== "ALL" ||
                    productGroupFilter !== "ALL" ||
                    menuCategoryFilter !== "ALL" ||
                    searchQuery !== "") && (
                    <button
                      type="button"
                      onClick={() => {
                        setDivisionFilter("ALL");
                        setProductGroupFilter("ALL");
                        setMenuCategoryFilter("ALL");
                        setSearchQuery("");
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Reset Filter Kategori
                    </button>
                  )}
                  {dateMode !== "ALL" && latestAvailableSaleDate && (
                    <button
                      type="button"
                      onClick={() => setDateMode("ALL")}
                      className="px-3.5 py-2 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 text-xs font-bold cursor-pointer"
                    >
                      Tampilkan Semua Periode (Terakhir: {latestAvailableSaleDate})
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3.5 w-10">#</th>
                        <th className="p-3.5">Produk &amp; Taksonomi Menu</th>
                        <th className="p-3.5 text-right">Terjual</th>
                        <th className="p-3.5 text-right">Omzet (% Share)</th>
                        <th className="p-3.5 text-right">Estimasi HPP</th>
                        <th className="p-3.5 text-right">Laba Kotor (Margin)</th>
                        <th className="p-3.5 text-center">Performa</th>
                        <th className="p-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analytics.productMixRows.map((row, idx) => {
                        const isExpanded = expandedProductIds.has(row.key);
                        const divBadge =
                          DIVISION_BADGES[row.division] ||
                          DIVISION_BADGES.UNMAPPED;
                        const quadBadge = QUADRANT_BADGES[row.quadrant];
                        const matchedCatalogProduct = row.isMatched
                          ? products.find((p) => p.id === row.productId) || null
                          : null;

                        return (
                          <React.Fragment key={row.key}>
                            <tr
                              onClick={() => toggleExpandProduct(row.key)}
                              className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                            >
                              <td className="p-3.5 font-mono font-bold text-slate-400 tabular-nums">
                                <div className="flex items-center gap-1">
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${
                                      isExpanded ? "rotate-180 text-brand-600" : ""
                                    }`}
                                  />
                                  <span>{idx + 1}</span>
                                </div>
                              </td>
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {row.productName}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span
                                    className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${divBadge.className}`}
                                  >
                                    {divBadge.label}
                                  </span>
                                  <span className="px-2 py-0.2 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                                    {PRODUCT_GROUP_LABELS[row.productGroup] ||
                                      row.productGroup}
                                  </span>
                                  <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-brand-50/60 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/30">
                                    {row.menuCategory}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    • {row.variantsBreakdown.length} varian
                                  </span>
                                </div>
                              </td>
                              <td className="p-3.5 text-right tabular-nums">
                                <span className="px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-bold border border-brand-200/70 dark:border-brand-500/30">
                                  {row.totalQty.toLocaleString("id-ID")} porsi
                                </span>
                              </td>
                              <td className="p-3.5 text-right tabular-nums">
                                <div className="font-black text-slate-900 dark:text-slate-100 text-sm">
                                  {formatCurrency(row.totalRevenue)}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {row.revenueSharePercent}% kontribusi
                                </div>
                              </td>
                              <td className="p-3.5 text-right tabular-nums">
                                <div className="font-bold text-slate-700 dark:text-slate-300">
                                  {formatCurrency(row.totalHpp)}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  FC {row.foodCostPercent}%
                                </div>
                              </td>
                              <td className="p-3.5 text-right tabular-nums">
                                <div
                                  className={`font-black ${
                                    row.grossProfit >= 0
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : "text-rose-700 dark:text-rose-300"
                                  }`}
                                >
                                  {formatCurrency(row.grossProfit)}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  Margin {row.marginPercent}%
                                </div>
                              </td>
                              <td
                                className="p-3.5 text-center"
                                title={quadBadge.hint}
                              >
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${quadBadge.className}`}
                                >
                                  {quadBadge.label}
                                </span>
                              </td>
                              <td
                                className="p-3.5 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {!isReadOnly && (
                                  matchedCatalogProduct ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setProductModalState({
                                          isOpen: true,
                                          product: matchedCatalogProduct,
                                          initialDraft: null,
                                        })
                                      }
                                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 dark:bg-slate-800 dark:hover:bg-brand-500/20 text-slate-700 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit Menu</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setProductModalState({
                                          isOpen: true,
                                          product: null,
                                          initialDraft: {
                                            name: row.productName,
                                            variantName:
                                              row.variantsBreakdown[0]
                                                ?.variantName || "Reguler",
                                            price: row.avgUnitPrice,
                                            division: "BAR",
                                          },
                                        })
                                      }
                                      className="px-2.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Daftarkan</span>
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>

                            {/* Expandable Variants & Daily Breakdown */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90 dark:bg-slate-800/50">
                                <td colSpan={8} className="p-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-8 space-y-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                        Rincian Per Varian ({row.productName})
                                      </span>
                                      <div className="space-y-1.5">
                                        {row.variantsBreakdown.map((vb) => (
                                          <div
                                            key={vb.variantKey}
                                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                                {vb.variantName}
                                              </span>
                                              {vb.officialSellPrice > 0 && (
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                  (Harga Menu:{" "}
                                                  {formatCurrency(
                                                    vb.officialSellPrice
                                                  )}
                                                  )
                                                </span>
                                              )}
                                              {!vb.hasRecipe && (
                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold">
                                                  Resep belum diisi
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <span className="font-bold text-brand-700 dark:text-brand-300">
                                                {vb.qtySold.toLocaleString(
                                                  "id-ID"
                                                )}{" "}
                                                qty
                                              </span>
                                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                                {formatCurrency(vb.totalRevenue)}
                                              </span>
                                              <span className="text-slate-500 dark:text-slate-400">
                                                HPP {formatCurrency(vb.totalHpp)}
                                              </span>
                                              <span
                                                className={`font-bold ${
                                                  vb.grossProfit >= 0
                                                    ? "text-emerald-700 dark:text-emerald-300"
                                                    : "text-rose-600 dark:text-rose-400"
                                                }`}
                                              >
                                                {vb.grossProfit >= 0 ? "+" : ""}
                                                {formatCurrency(vb.grossProfit)}{" "}
                                                ({vb.marginPercent}%)
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="lg:col-span-4 space-y-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                        Histori Per Tanggal ({row.dailyBreakdown.length}{" "}
                                        hari)
                                      </span>
                                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                        {row.dailyBreakdown.map((db) => (
                                          <div
                                            key={db.date}
                                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between text-[11px] tabular-nums"
                                          >
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                              {db.date}
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                              {db.qtySold.toLocaleString("id-ID")}x •{" "}
                                              {formatCurrency(db.totalRevenue)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
                  {analytics.productMixRows.map((row, idx) => {
                    const isExpanded = expandedProductIds.has(row.key);
                    const divBadge =
                      DIVISION_BADGES[row.division] || DIVISION_BADGES.UNMAPPED;
                    const quadBadge = QUADRANT_BADGES[row.quadrant];
                    const matchedCatalogProduct = row.isMatched
                      ? products.find((p) => p.id === row.productId) || null
                      : null;

                    return (
                      <div
                        key={row.key}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5"
                      >
                        <div
                          onClick={() => toggleExpandProduct(row.key)}
                          className="flex items-start justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                #{idx + 1}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${divBadge.className}`}
                              >
                                {divBadge.shortLabel}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {row.menuCategory}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${quadBadge.className}`}
                              >
                                {quadBadge.label}
                              </span>
                            </div>
                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {row.productName}
                            </p>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <p className="font-black text-sm text-slate-900 dark:text-slate-100">
                              {formatCurrency(row.totalRevenue)}
                            </p>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 text-[10px] font-bold">
                              {row.totalQty.toLocaleString("id-ID")} porsi
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                          <span className="text-slate-500 dark:text-slate-400">
                            HPP {formatCurrency(row.totalHpp)} • Laba{" "}
                            <strong
                              className={
                                row.grossProfit >= 0
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {formatCurrency(row.grossProfit)} ({row.marginPercent}%)
                            </strong>
                          </span>
                          <div className="flex items-center gap-2">
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() =>
                                  setProductModalState({
                                    isOpen: true,
                                    product: matchedCatalogProduct,
                                    initialDraft: matchedCatalogProduct
                                      ? null
                                      : {
                                          name: row.productName,
                                          variantName:
                                            row.variantsBreakdown[0]
                                              ?.variantName || "Reguler",
                                          price: row.avgUnitPrice,
                                        },
                                  })
                                }
                                className="text-[11px] font-bold text-brand-600 dark:text-brand-300 cursor-pointer"
                              >
                                {matchedCatalogProduct ? "Edit" : "+ Daftar"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleExpandProduct(row.key)}
                              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Varian ({row.variantsBreakdown.length})</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {row.variantsBreakdown.map((vb) => (
                              <div
                                key={vb.variantKey}
                                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between text-[11px] tabular-nums"
                              >
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {vb.variantName} ({vb.qtySold}x)
                                </span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {formatCurrency(vb.totalRevenue)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── SUB-TAB 2: PEMAKAIAN BAHAN BAKU TEORETIS & PEMBANDING ──────── */}
        {subView === "ingredients" && (
          <div className="p-4 space-y-4">
            <div className="p-3 rounded-xl bg-brand-50/60 dark:bg-brand-500/10 border border-brand-200/70 dark:border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-brand-900 dark:text-brand-200">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0 mt-0.5" />
                <p>
                  Ringkasan di bawah menghitung <strong>perkiraan pemakaian bahan &amp; estimasi HPP</strong> dari resep produk terjual untuk dibandingkan langsung dengan <strong>mutasi keluar fisik penyimpanan</strong> dan <strong>stok opname mingguan</strong>.
                </p>
              </div>
              <span
                className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                  settings?.autoDeductStockOnSale === true
                    ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                }`}
              >
                {settings?.autoDeductStockOnSale === true
                  ? "Auto-Potong Stok Aktif"
                  : "Mode Pembanding (Stok Tidak Dipotong)"}
              </span>
            </div>

            {/* 3-Card Ringkasan Pembanding Bahan & Estimasi HPP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 border border-brand-200/70 dark:border-brand-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estimasi HPP Penjualan
                </span>
                <p className="text-lg font-black font-mono tabular-nums text-brand-700 dark:text-brand-300">
                  {formatCurrency(analytics.kpiSummary.totalHpp)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Food Cost: {analytics.kpiSummary.foodCostPercent.toFixed(1)}% dari omzet produk
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estimasi Biaya Bahan (Resep)
                </span>
                <p className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(benchmarkTotals.recipeCost)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Berdasarkan {analytics.ingredientUsageSummary.length} bahan resep terjual
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Mutasi Keluar Fisik (Periode Sama)
                </span>
                <p className="text-lg font-black font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {formatCurrency(benchmarkTotals.physicalCost)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Selisih biaya:{" "}
                  {benchmarkTotals.physicalCost - benchmarkTotals.recipeCost >= 0 ? "+" : ""}
                  {formatCurrency(benchmarkTotals.physicalCost - benchmarkTotals.recipeCost)}
                </p>
              </div>
            </div>

            {analytics.ingredientUsageSummary.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada pemakaian bahan baku yang terhitung pada filter ini. Pastikan resep bahan baku sudah diisi pada varian di Katalog Menu.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3">Nama Bahan Baku</th>
                      <th className="p-3 text-right">Perkiraan Resep</th>
                      <th className="p-3 text-right">Keluar Fisik (Mutasi)</th>
                      <th className="p-3 text-right">Selisih (Fisik − Resep)</th>
                      <th className="p-3 text-right">Sisa Stok Gudang</th>
                      <th className="p-3 text-right">Estimasi Biaya (HPP)</th>
                      <th className="p-3">Dipakai Oleh Menu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.ingredientUsageSummary.map((ing) => {
                      const physical = physicalOutMap.get(ing.ingredientId);
                      const physicalQty = physical?.totalOutQty || 0;
                      const diffQty = Number((physicalQty - ing.totalUsedQty).toFixed(2));
                      return (
                        <tr
                          key={ing.ingredientId}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                            {ing.ingredientName}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                            {ing.totalUsedQty.toLocaleString("id-ID")} {ing.unit}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                            {physicalQty.toLocaleString("id-ID")} {ing.unit}
                          </td>
                          <td className="p-3 text-right font-mono font-bold tabular-nums">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] border ${
                                Math.abs(diffQty) <= 0.01
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                                  : diffQty > 0
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                                  : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30"
                              }`}
                            >
                              {diffQty > 0 ? `+${diffQty.toLocaleString("id-ID")}` : diffQty.toLocaleString("id-ID")} {ing.unit}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                            {ing.currentStock.toLocaleString("id-ID")} {ing.unit}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatCurrency(ing.totalCost)}
                          </td>
                          <td className="p-3 text-[11px] text-slate-600 dark:text-slate-300">
                            {ing.usedByMenus.slice(0, 3).join(", ")}
                            {ing.usedByMenus.length > 3
                              ? ` (+${ing.usedByMenus.length - 3} menu lainnya)`
                              : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB 3: MENU AKTIF 0 TERJUAL ────────────────────────────── */}
        {subView === "zero_sales" && (
          <div className="p-4 space-y-3">
            {analytics.zeroSalesProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                🎉 Luar biasa! Seluruh menu aktif di Katalog pada kategori ini sudah memiliki penjualan pada periode terpilih.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analytics.zeroSalesProducts.map((zp) => {
                  const divBadge =
                    DIVISION_BADGES[zp.division] || DIVISION_BADGES.BAR;
                  const catalogProd =
                    products.find((p) => p.id === zp.productId) || null;
                  return (
                    <div
                      key={zp.productId}
                      className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${divBadge.className}`}
                          >
                            {divBadge.shortLabel}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            {zp.menuCategory}
                          </span>
                        </div>
                        <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {zp.productName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          0 terjual • {zp.variantsCount} varian (
                          {zp.minPrice === zp.maxPrice
                            ? formatCurrency(zp.minPrice)
                            : `${formatCurrency(zp.minPrice)} - ${formatCurrency(zp.maxPrice)}`}
                          )
                        </p>
                      </div>
                      {!isReadOnly && catalogProd && (
                        <button
                          type="button"
                          onClick={() =>
                            setProductModalState({
                              isOpen: true,
                              product: catalogProd,
                              initialDraft: null,
                            })
                          }
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-600 cursor-pointer shrink-0"
                          title="Edit Status / Harga Menu"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB 4: LOG RINCIAN HARIAN ────────────────────────────────── */}
        {subView === "daily_log" && (
          <div className="overflow-x-auto">
            {analytics.filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Tidak ada transaksi produk pada filter ini.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Nama Menu / Varian</th>
                    <th className="p-3.5">Divisi &amp; Kategori</th>
                    <th className="p-3.5 text-right">Qty</th>
                    <th className="p-3.5 text-right">Total Penjualan</th>
                    <th className="p-3.5 text-right">Est. HPP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {analytics.filteredTransactions.map((item) => {
                    const divBadge =
                      DIVISION_BADGES[item.resolved.division] ||
                      DIVISION_BADGES.UNMAPPED;
                    return (
                      <tr
                        key={item.tx.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                          {item.localDate}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {item.tx.menuName}
                          </div>
                          {item.resolved.isMatched && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Katalog: {item.resolved.productName} • Varian:{" "}
                              {item.resolved.variantName}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${divBadge.className}`}
                            >
                              {divBadge.shortLabel}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.resolved.menuCategory}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                          {item.quantity.toLocaleString("id-ID")} porsi
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {formatCurrency(item.totalHpp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL INPUT MANUAL PENJUALAN PRODUK (TERINTEGRASI KATALOG MENU) ── */}
      <ManualProductSalesModal
        isOpen={isManualModalOpen}
        manualDate={manualDate}
        onChangeDate={setManualDate}
        isClosed={isPeriodClosed(manualDate)}
        rows={manualRows}
        catalogChoices={catalogVariantChoices}
        totalQty={totalManualDraftQty}
        totalRevenue={totalManualDraftRevenue}
        onAddRow={handleAddManualRow}
        onRemoveRow={(rowId) =>
          setManualRows((prev) =>
            prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev
          )
        }
        onSelectCatalog={handleSelectCatalogItemForRow}
        onUpdateRow={handleUpdateManualRow}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleSubmitManualSales}
      />

      {/* ── MODAL DAFTARKAN / EDIT MENU + VARIAN + BAHAN RESEP ─────────────── */}
      <ProductFormModal
        isOpen={productModalState.isOpen}
        product={productModalState.product}
        defaultDivision={
          productModalState.product?.division ||
          productModalState.initialDraft?.division ||
          "BAR"
        }
        ingredients={ingredients}
        recipes={recipes}
        menuCategoriesMap={settings?.menuCategories}
        initialDraft={productModalState.initialDraft}
        onSaveRecipe={onSaveRecipe}
        onUpdateRecipe={onUpdateRecipe}
        onClose={() =>
          setProductModalState({
            isOpen: false,
            product: null,
            initialDraft: null,
          })
        }
        onSave={(prodData) => {
          onSaveProduct(prodData, productModalState.product);
          setProductModalState({
            isOpen: false,
            product: null,
            initialDraft: null,
          });
          toast.success(
            productModalState.product
              ? `Menu "${prodData.name}" diperbarui & disinkronkan ke rekap produk.`
              : `Menu "${prodData.name}" didaftarkan ke Katalog Menu & langsung terhubung ke analitik.`
          );
        }}
      />
    </motion.div>
  );
};

interface ManualProductSalesModalProps {
  isOpen: boolean;
  manualDate: string;
  onChangeDate: (d: string) => void;
  isClosed: boolean;
  rows: ManualSaleDraftRow[];
  catalogChoices: Array<{
    key: string;
    menuName: string;
    variantPrice: number;
    label: string;
  }>;
  totalQty: number;
  totalRevenue: number;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onSelectCatalog: (rowId: string, catalogKey: string) => void;
  onUpdateRow: (rowId: string, patch: Partial<ManualSaleDraftRow>) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ManualProductSalesModal: React.FC<ManualProductSalesModalProps> = ({
  isOpen,
  manualDate,
  onChangeDate,
  isClosed,
  rows,
  catalogChoices,
  totalQty,
  totalRevenue,
  onAddRow,
  onRemoveRow,
  onSelectCatalog,
  onUpdateRow,
  onClose,
  onSubmit,
}) => {
  if (typeof document === "undefined") return null;
  const hasValidRow = rows.some(
    (r) => r.menuName.trim() && Math.round(Number(r.quantity) || 0) > 0
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="manual-product-sales-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            className="my-auto bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[88vh] overflow-y-auto custom-scrollbar space-y-4 shadow-2xl border border-slate-200/90 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  Input Penjualan Produk (Dari Katalog Menu)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih menu &amp; varian dari Katalog, lalu isi jumlah terjual. Harga &amp; pemotongan stok bahan otomatis mengikuti resep varian.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup modal input penjualan"
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catalogChoices.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 font-semibold">
                Belum ada produk aktif di Katalog Menu. Daftarkan produk terlebih dahulu di modul Katalog &amp; Menu untuk mencatat penjualan produk.
              </div>
            )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal Penjualan
              </label>
              <CustomDatePicker value={manualDate} onChange={onChangeDate} />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onAddRow}
                className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris Produk</span>
              </button>
            </div>
          </div>

          {isClosed && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 font-semibold">
              Tanggal berada pada periode yang sudah ditutup buku resmi.
            </div>
          )}

          <div className="space-y-2.5">
            {rows.map((row, idx) => (
              <div
                key={row.rowId}
                className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end text-xs"
              >
                <div className="md:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Produk &amp; Varian #{idx + 1}
                  </label>
                  <CustomSelect
                    searchable
                    value={row.catalogKey}
                    onChange={(val) => onSelectCatalog(row.rowId, val)}
                    placeholder="-- Pilih Menu dari Katalog --"
                    options={catalogChoices.map((c) => ({
                      value: c.key,
                      label: c.label,
                    }))}
                    buttonClassName="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Qty Terjual
                  </label>
                  <CurrencyInput
                    emptyWhenZero
                    value={row.quantity}
                    onValueChange={(_, num) => {
                      const nextQty = Math.max(0, Math.round(num));
                      onUpdateRow(row.rowId, {
                        quantity: nextQty,
                        totalPrice: Math.round(nextQty * (row.unitPrice || 0)),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-center text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Total Penjualan (Rp)
                  </label>
                  <CurrencyInput
                    value={row.totalPrice}
                    onValueChange={(_, num) =>
                      onUpdateRow(row.rowId, {
                        totalPrice: Math.max(0, Math.round(num)),
                      })
                    }
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-right text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.rowId)}
                    disabled={rows.length <= 1}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                    title="Hapus baris"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-2xl bg-brand-50/70 dark:bg-brand-500/10 border border-brand-200/70 dark:border-brand-500/30 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Total:{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {totalQty.toLocaleString("id-ID")} cup/porsi
              </strong>
            </span>
            <span className="font-black text-sm text-brand-700 dark:text-brand-300">
              Total Nilai: {formatCurrency(totalRevenue)}
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isClosed || !hasValidRow}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-brand-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Penjualan Produk</span>
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
