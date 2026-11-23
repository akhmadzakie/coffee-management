import type {
  DailySalesRecap,
  Ingredient,
  Product,
  ProductDivision,
  ProductVariant,
  Recipe,
  RecipeIngredient,
  SalesTransaction,
} from "../types";
import { getLocalDateString } from "./dateUtils";
import { getSaleTransactionAmount } from "./financeMetrics";
import { resolveOrderItemIngredients } from "./posDomainLogic";

export const PRODUCT_GROUP_OPTIONS = [
  "MINUMAN",
  "MAKANAN",
  "PASTRY & BAKERY",
  "KEMASAN & RETAIL",
] as const;

export type ProductGroupKey = (typeof PRODUCT_GROUP_OPTIONS)[number];

export const PRODUCT_GROUP_LABELS: Record<string, string> = {
  MINUMAN: "Minuman (Beverage)",
  MAKANAN: "Makanan (Kitchen)",
  "PASTRY & BAKERY": "Pastry & Bakery",
  "KEMASAN & RETAIL": "Kemasan / Retail",
};

export const MENU_CATEGORY_PRESETS: Record<ProductDivision, string[]> = {
  BAR: [
    "COFFEE",
    "SIGNATURE COFFEE",
    "MANUAL BREW",
    "NON-COFFEE",
    "TEA & MOCKTAIL",
    "BOTOL 1 LITER",
  ],
  KITCHEN: [
    "MAIN COURSE",
    "RICE BOWL",
    "PASTA & NOODLE",
    "SNACK & SHARING",
    "BREAKFAST",
    "FOOD",
  ],
  BAKER: [
    "CROISSANT & PASTRY",
    "CAKE & DESSERT",
    "BREAD & TOAST",
    "BAKERY",
  ],
};

export type DateFilterMode = "SINGLE_DAY" | "DATE_RANGE" | "ALL";
export type ProductSortBy =
  | "QTY_DESC"
  | "REVENUE_DESC"
  | "PROFIT_DESC"
  | "MARGIN_DESC"
  | "NAME_ASC";
export type MenuEngineeringQuadrant = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

const parseJsonArray = <T = any>(val: unknown): T[] => {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const toSaleLocalDateKey = (raw: string | null | undefined): string => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s.slice(0, 10) : getLocalDateString(parsed);
};

export function inferProductGroup(
  division?: ProductDivision | "UNMAPPED",
  category?: string,
  explicitGroup?: string,
  variantName?: string
): string {
  const exp = String(explicitGroup || "").trim().toUpperCase();
  if (exp) return exp;

  const cat = String(category || "").trim().toLowerCase();
  const varLower = String(variantName || "").trim().toLowerCase();

  if (
    varLower.includes("1 liter") ||
    varLower.includes("1l") ||
    varLower.includes("botol") ||
    cat.includes("1 liter") ||
    cat.includes("1l") ||
    cat.includes("botol") ||
    cat.includes("beans") ||
    cat.includes("retail") ||
    cat.includes("kemasan") ||
    cat.includes("merch")
  ) {
    return "KEMASAN & RETAIL";
  }

  if (
    division === "BAKER" ||
    cat.includes("bakery") ||
    cat.includes("pastry") ||
    cat.includes("cake") ||
    cat.includes("dessert") ||
    cat.includes("croissant") ||
    cat.includes("bread")
  ) {
    return "PASTRY & BAKERY";
  }

  if (
    division === "KITCHEN" ||
    cat.includes("food") ||
    cat.includes("main") ||
    cat.includes("snack") ||
    cat.includes("rice") ||
    cat.includes("pasta") ||
    cat.includes("noodle") ||
    cat.includes("breakfast") ||
    cat.includes("makanan")
  ) {
    return "MAKANAN";
  }

  return "MINUMAN";
}

export function formatCatalogMenuVariantLabel(
  productName: string,
  variantName?: string,
  variantCount = 1
): string {
  const cleanProd = String(productName || "").trim();
  const cleanVar = String(variantName || "").trim();
  if (!cleanVar) return cleanProd;
  const lowerVar = cleanVar.toLowerCase();
  if (
    variantCount <= 1 &&
    (lowerVar === "reguler" ||
      lowerVar === "regular" ||
      lowerVar === "single piece" ||
      lowerVar === "porsi reguler" ||
      lowerVar === "default")
  ) {
    return cleanProd;
  }
  return `${cleanProd} - ${cleanVar}`;
}

export function extractDetectedNameAndVariant(rawMenuName: string): {
  productName: string;
  variantName: string;
} {
  const clean = String(rawMenuName || "").trim();
  const dashMatch = clean.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    return {
      productName: dashMatch[1].trim(),
      variantName: dashMatch[2].trim(),
    };
  }
  const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      productName: parenMatch[1].trim(),
      variantName: parenMatch[2].trim(),
    };
  }
  return { productName: clean, variantName: "Reguler" };
}

export function calculateVariantUnitHpp(
  variant: ProductVariant | null | undefined,
  product: Product | null | undefined,
  recipes: Recipe[] = [],
  ingredients: Ingredient[] = []
): { unitHpp: number; recipeIngredients: RecipeIngredient[] } {
  const ingMap = new Map<string, Ingredient>();
  (ingredients || []).forEach((i) => ingMap.set(i.id, i));

  let recipeList = parseJsonArray<RecipeIngredient>(variant?.recipe);
  if (recipeList.length === 0 && variant?.recipeId) {
    const linked = (recipes || []).find((r) => r.id === variant.recipeId);
    if (linked) recipeList = parseJsonArray<RecipeIngredient>(linked.ingredients);
  }
  if (recipeList.length === 0 && product) {
    const prodLower = String(product.name || "").trim().toLowerCase();
    const varLower = String(variant?.name || "").trim().toLowerCase();
    const matchedRec =
      (varLower
        ? (recipes || []).find(
            (r) =>
              String(r.menuName || "").trim().toLowerCase() ===
              `${prodLower} - ${varLower}`
          )
        : undefined) ||
      (recipes || []).find(
        (r) => String(r.menuName || "").trim().toLowerCase() === prodLower
      );
    if (matchedRec) {
      recipeList = parseJsonArray<RecipeIngredient>(matchedRec.ingredients);
    }
  }

  let rawCost = 0;
  for (const ri of recipeList) {
    const ing = ingMap.get(ri.ingredientId);
    if (ing && Number(ing.costPerUnit) > 0 && Number(ri.quantity) > 0) {
      rawCost += Number(ri.quantity) * Number(ing.costPerUnit);
    }
  }

  if (rawCost > 0) {
    const baseCost = rawCost + (Number(variant?.packagingCost) || 0);
    const wastageCost = Math.round(
      baseCost * ((Number(variant?.wastagePercent) || 0) / 100)
    );
    const overheadCost = Math.round(
      baseCost * ((Number(variant?.overheadPercent) || 0) / 100)
    );
    return {
      unitHpp: Math.round(baseCost + wastageCost + overheadCost),
      recipeIngredients: recipeList,
    };
  }

  return {
    unitHpp: Math.round(Number(variant?.estimatedHpp) || 0),
    recipeIngredients: recipeList,
  };
}

export interface ResolvedProductVariantResult {
  isMatched: boolean;
  product: Product | null;
  variant: ProductVariant | null;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  division: ProductDivision | "UNMAPPED";
  productGroup: string;
  menuCategory: string;
  officialSellPrice: number;
  unitHpp: number;
  recipeIngredients: RecipeIngredient[];
}

export function resolveProductAndVariant(
  rawMenuName: string,
  unitPriceHint: number,
  products: Product[] = [],
  recipes: Recipe[] = [],
  ingredients: Ingredient[] = []
): ResolvedProductVariantResult {
  const cleanRaw = String(rawMenuName || "").trim();
  const normRaw = cleanRaw.toLowerCase().replace(/\s+/g, " ");

  let matchedProduct: Product | null = null;
  let matchedVariant: ProductVariant | null = null;

  // 1. Exact combination match: "Product - Variant", "Product (Variant)", "Product / Variant", "Variant Product"
  for (const p of products) {
    const pLower = String(p.name || "").trim().toLowerCase();
    if (!pLower) continue;
    const vars = parseJsonArray<ProductVariant>(p.variants);
    for (const v of vars) {
      const vLower = String(v.name || "").trim().toLowerCase();
      if (!vLower) continue;
      if (
        normRaw === `${pLower} - ${vLower}` ||
        normRaw === `${pLower}-${vLower}` ||
        normRaw === `${pLower} (${vLower})` ||
        normRaw === `${pLower} / ${vLower}` ||
        normRaw === `${vLower} ${pLower}`
      ) {
        matchedProduct = p;
        matchedVariant = v;
        break;
      }
    }
    if (matchedProduct) break;
  }

  // 2. Exact product name match -> pick closest variant by unitPriceHint (or first variant)
  if (!matchedProduct) {
    matchedProduct =
      products.find(
        (p) => String(p.name || "").trim().toLowerCase() === normRaw
      ) || null;
    if (matchedProduct) {
      const vars = parseJsonArray<ProductVariant>(matchedProduct.variants);
      if (vars.length > 0) {
        if (unitPriceHint > 0 && vars.length > 1) {
          matchedVariant = [...vars].sort(
            (a, b) =>
              Math.abs((Number(a.price) || 0) - unitPriceHint) -
              Math.abs((Number(b.price) || 0) - unitPriceHint)
          )[0];
        } else {
          matchedVariant = vars[0];
        }
      }
    }
  }

  // 3. Prefix product match ("Product - Custom Variant" / "Product (Hot)")
  if (!matchedProduct && normRaw) {
    const sortedByLen = [...products].sort(
      (a, b) => String(b.name || "").length - String(a.name || "").length
    );
    for (const p of sortedByLen) {
      const pLower = String(p.name || "").trim().toLowerCase();
      if (!pLower) continue;
      if (
        normRaw.startsWith(`${pLower} - `) ||
        normRaw.startsWith(`${pLower} (`) ||
        normRaw.startsWith(`${pLower} / `) ||
        normRaw.startsWith(`${pLower} • `)
      ) {
        matchedProduct = p;
        const remainder = normRaw
          .slice(pLower.length)
          .replace(/^[\s\-/•()]+/, "")
          .replace(/\)+$/, "")
          .trim();
        const vars = parseJsonArray<ProductVariant>(p.variants);
        if (vars.length > 0) {
          matchedVariant =
            vars.find((v) => {
              const vl = String(v.name || "").trim().toLowerCase();
              return vl === remainder || vl.includes(remainder) || remainder.includes(vl);
            }) ||
            (unitPriceHint > 0 && vars.length > 1
              ? [...vars].sort(
                  (a, b) =>
                    Math.abs((Number(a.price) || 0) - unitPriceHint) -
                    Math.abs((Number(b.price) || 0) - unitPriceHint)
                )[0]
              : vars[0]);
        }
        break;
      }
    }
  }

  if (matchedProduct) {
    const hppInfo = calculateVariantUnitHpp(
      matchedVariant,
      matchedProduct,
      recipes,
      ingredients
    );
    const variantName = matchedVariant?.name || "Reguler";
    return {
      isMatched: true,
      product: matchedProduct,
      variant: matchedVariant,
      productId: matchedProduct.id,
      productName: matchedProduct.name,
      variantId: matchedVariant?.id || `${matchedProduct.id}::default`,
      variantName,
      division: matchedProduct.division || "BAR",
      productGroup: inferProductGroup(
        matchedProduct.division,
        matchedProduct.category,
        matchedProduct.productGroup,
        variantName
      ),
      menuCategory: String(matchedProduct.category || "LAINNYA").trim().toUpperCase(),
      officialSellPrice: Math.round(Number(matchedVariant?.price) || 0),
      unitHpp: hppInfo.unitHpp,
      recipeIngredients: hppInfo.recipeIngredients,
    };
  }

  // Fallback Unmapped menu (belum ada di Katalog Menu)
  const detected = extractDetectedNameAndVariant(cleanRaw);
  const ingMap = new Map<string, Ingredient>();
  (ingredients || []).forEach((i) => ingMap.set(i.id, i));
  const fallbackRec = (recipes || []).find(
    (r) => String(r.menuName || "").trim().toLowerCase() === normRaw
  );
  const recItems = fallbackRec
    ? parseJsonArray<RecipeIngredient>(fallbackRec.ingredients)
    : [];
  const recUnitCost = recItems.reduce((sum, ri) => {
    const ing = ingMap.get(ri.ingredientId);
    return sum + (ing ? (Number(ing.costPerUnit) || 0) * (Number(ri.quantity) || 0) : 0);
  }, 0);

  return {
    isMatched: false,
    product: null,
    variant: null,
    productId: `unmapped::${detected.productName.toLowerCase()}`,
    productName: detected.productName || cleanRaw || "Menu Tanpa Nama",
    variantId: `unmapped::${normRaw}`,
    variantName: detected.variantName,
    division: "UNMAPPED",
    productGroup: "BELUM TERDAFTAR",
    menuCategory: "BELUM DIKATEGORIKAN",
    officialSellPrice: Math.round(unitPriceHint || 0),
    unitHpp: Math.round(recUnitCost),
    recipeIngredients: recItems,
  };
}

export interface ProductVariantMixRow {
  variantKey: string;
  variantName: string;
  officialSellPrice: number;
  unitHpp: number;
  qtySold: number;
  totalRevenue: number;
  totalHpp: number;
  grossProfit: number;
  marginPercent: number;
  hasRecipe: boolean;
}

export interface ProductDailyBreakdownRow {
  date: string;
  qtySold: number;
  totalRevenue: number;
  totalHpp: number;
}

export interface ProductMixRow {
  key: string;
  productId: string;
  productName: string;
  isMatched: boolean;
  division: ProductDivision | "UNMAPPED";
  productGroup: string;
  menuCategory: string;
  totalQty: number;
  totalRevenue: number;
  revenueSharePercent: number;
  totalHpp: number;
  grossProfit: number;
  marginPercent: number;
  foodCostPercent: number;
  avgUnitPrice: number;
  quadrant: MenuEngineeringQuadrant;
  variantsBreakdown: ProductVariantMixRow[];
  dailyBreakdown: ProductDailyBreakdownRow[];
}

export interface EnrichedSalesTransaction {
  tx: SalesTransaction;
  localDate: string;
  quantity: number;
  revenue: number;
  totalHpp: number;
  grossProfit: number;
  resolved: ResolvedProductVariantResult;
}

export interface UnmatchedMenuSummary {
  rawMenuName: string;
  detectedProductName: string;
  detectedVariantName: string;
  totalQty: number;
  totalRevenue: number;
  avgUnitPrice: number;
}

export interface IngredientUsageSummaryRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalUsedQty: number;
  unitCost: number;
  totalCost: number;
  currentStock: number;
  usedByMenus: string[];
}

export interface ZeroSalesProductRow {
  productId: string;
  productName: string;
  division: ProductDivision;
  productGroup: string;
  menuCategory: string;
  variantsCount: number;
  minPrice: number;
  maxPrice: number;
}

export interface CategoryDistributionRow {
  key: string;
  label: string;
  qtySold: number;
  totalRevenue: number;
  totalHpp: number;
  grossProfit: number;
  sharePercent: number;
}

export interface OmzetCrossCheckResult {
  totalRecapOmzet: number;
  totalAllProductSales: number;
  filteredProductSales: number;
  difference: number;
  matchPercent: number;
  datesWithRecapButNoProducts: Array<{ date: string; recapAmount: number }>;
  datesWithProductsButNoRecap: Array<{ date: string; productSalesAmount: number }>;
}

export interface ProductSalesAnalyticsResult {
  filteredTransactions: EnrichedSalesTransaction[];
  productMixRows: ProductMixRow[];
  omzetCrossCheck: OmzetCrossCheckResult;
  zeroSalesProducts: ZeroSalesProductRow[];
  ingredientUsageSummary: IngredientUsageSummaryRow[];
  unmatchedMenuSummaries: UnmatchedMenuSummary[];
  availableProductGroups: string[];
  availableMenuCategories: string[];
  divisionDistribution: CategoryDistributionRow[];
  menuCategoryDistribution: CategoryDistributionRow[];
  kpiSummary: {
    totalQty: number;
    activeDaysCount: number;
    avgDailyQty: number;
    totalRevenue: number;
    avgTicketPrice: number;
    totalHpp: number;
    grossProfit: number;
    marginPercent: number;
    foodCostPercent: number;
    topByVolume: ProductMixRow | null;
    topByProfit: ProductMixRow | null;
    matchedProductCount: number;
    unmatchedMenuCount: number;
  };
}

export interface ComputeProductSalesAnalyticsParams {
  salesTransactions: SalesTransaction[];
  dailySalesRecaps?: DailySalesRecap[];
  products: Product[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  dateMode: DateFilterMode;
  singleDate: string;
  startDate: string;
  endDate: string;
  division?: "ALL" | ProductDivision | "UNMAPPED";
  productGroup?: "ALL" | string;
  menuCategory?: "ALL" | string;
  searchQuery?: string;
  sortBy?: ProductSortBy;
}

export function computeProductSalesAnalytics(
  params: ComputeProductSalesAnalyticsParams
): ProductSalesAnalyticsResult {
  const {
    salesTransactions = [],
    dailySalesRecaps = [],
    products = [],
    recipes = [],
    ingredients = [],
    dateMode,
    singleDate,
    startDate,
    endDate,
    division = "ALL",
    productGroup = "ALL",
    menuCategory = "ALL",
    searchQuery = "",
    sortBy = "QTY_DESC",
  } = params;

  const isDateIncluded = (dateStr: string | undefined | null): boolean => {
    const key = toSaleLocalDateKey(dateStr);
    if (!key) return false;
    if (dateMode === "ALL") return true;
    if (dateMode === "SINGLE_DAY") return !singleDate || key === singleDate;
    if (startDate && key < startDate) return false;
    if (endDate && key > endDate) return false;
    return true;
  };

  // Cascading filter options from catalog + sales
  const groupSet = new Set<string>(PRODUCT_GROUP_OPTIONS);
  const categorySet = new Set<string>();

  products.forEach((p) => {
    if (division !== "ALL" && division !== "UNMAPPED" && p.division !== division) {
      return;
    }
    const vars = parseJsonArray<ProductVariant>(p.variants);
    const pGroups = new Set<string>();
    pGroups.add(inferProductGroup(p.division, p.category, p.productGroup, vars[0]?.name));
    vars.forEach((v) =>
      pGroups.add(inferProductGroup(p.division, p.category, p.productGroup, v.name))
    );
    pGroups.forEach((g) => groupSet.add(g));

    if (productGroup === "ALL" || pGroups.has(productGroup)) {
      const cat = String(p.category || "").trim().toUpperCase();
      if (cat) categorySet.add(cat);
    }
  });

  // Resolve transactions inside date window
  const dateScopedEnriched: EnrichedSalesTransaction[] = [];
  const allSalesByDate = new Map<string, number>();
  let totalAllProductSales = 0;

  for (const tx of salesTransactions) {
    if (!isDateIncluded(tx.date)) continue;
    const localDate = toSaleLocalDateKey(tx.date);
    const qty = Math.max(0, Number(tx.quantitySold) || 0);
    const rev = Math.max(0, getSaleTransactionAmount(tx));
    const unitPriceHint = qty > 0 ? Math.round(rev / qty) : rev;

    totalAllProductSales += rev;
    if (localDate) {
      allSalesByDate.set(localDate, (allSalesByDate.get(localDate) || 0) + rev);
    }

    const resolved = resolveProductAndVariant(
      tx.menuName,
      unitPriceHint,
      products,
      recipes,
      ingredients
    );
    if (resolved.productGroup) groupSet.add(resolved.productGroup);

    const totalHpp = Math.round(resolved.unitHpp * qty);
    dateScopedEnriched.push({
      tx,
      localDate,
      quantity: qty,
      revenue: rev,
      totalHpp,
      grossProfit: rev - totalHpp,
      resolved,
    });
  }

  // Cross-check dailySalesRecaps vs all store product sales in same date window
  let totalRecapOmzet = 0;
  const recapByDate = new Map<string, number>();
  for (const r of dailySalesRecaps) {
    if (!isDateIncluded(r.date)) continue;
    const dayKey = toSaleLocalDateKey(r.date);
    const amt = Math.max(0, Math.round(Number(r.totalAmount) || 0));
    totalRecapOmzet += amt;
    if (dayKey) {
      recapByDate.set(dayKey, (recapByDate.get(dayKey) || 0) + amt);
    }
  }

  const datesWithRecapButNoProducts: Array<{ date: string; recapAmount: number }> = [];
  recapByDate.forEach((recapAmount, date) => {
    if (recapAmount > 0 && (allSalesByDate.get(date) || 0) <= 0) {
      datesWithRecapButNoProducts.push({ date, recapAmount });
    }
  });
  datesWithRecapButNoProducts.sort((a, b) => b.date.localeCompare(a.date));

  const datesWithProductsButNoRecap: Array<{ date: string; productSalesAmount: number }> = [];
  allSalesByDate.forEach((productSalesAmount, date) => {
    if (productSalesAmount > 0 && (recapByDate.get(date) || 0) <= 0) {
      datesWithProductsButNoRecap.push({ date, productSalesAmount });
    }
  });
  datesWithProductsButNoRecap.sort((a, b) => b.date.localeCompare(a.date));

  // Unmatched menu summaries (across active date range so user sees everything missing from catalog)
  const unmatchedMap = new Map<string, UnmatchedMenuSummary>();
  dateScopedEnriched.forEach((item) => {
    if (item.resolved.isMatched) return;
    const key = String(item.tx.menuName || "").trim();
    if (!key) return;
    const cur = unmatchedMap.get(key) || {
      rawMenuName: key,
      detectedProductName: item.resolved.productName,
      detectedVariantName: item.resolved.variantName,
      totalQty: 0,
      totalRevenue: 0,
      avgUnitPrice: 0,
    };
    cur.totalQty += item.quantity;
    cur.totalRevenue += item.revenue;
    cur.avgUnitPrice =
      cur.totalQty > 0 ? Math.round(cur.totalRevenue / cur.totalQty) : 0;
    unmatchedMap.set(key, cur);
  });
  const unmatchedMenuSummaries = Array.from(unmatchedMap.values()).sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  // Filter by hierarchical 3 levels + search
  const normSearch = searchQuery.trim().toLowerCase();
  const filteredTransactions = dateScopedEnriched
    .filter(({ tx, resolved }) => {
      if (division !== "ALL" && resolved.division !== division) return false;
      if (productGroup !== "ALL" && resolved.productGroup !== productGroup) return false;
      if (menuCategory !== "ALL" && resolved.menuCategory !== menuCategory) return false;
      if (normSearch) {
        const hay = `${tx.menuName} ${resolved.productName} ${resolved.variantName} ${resolved.menuCategory} ${resolved.productGroup}`.toLowerCase();
        if (!hay.includes(normSearch)) return false;
      }
      return true;
    })
    .sort((a, b) => b.localDate.localeCompare(a.localDate));

  // Aggregate Product Mix (PMIX) grouped by parent product
  interface ProductAccumulator {
    key: string;
    productId: string;
    productName: string;
    isMatched: boolean;
    division: ProductDivision | "UNMAPPED";
    productGroup: string;
    menuCategory: string;
    totalQty: number;
    totalRevenue: number;
    totalHpp: number;
    variants: Map<string, ProductVariantMixRow>;
    days: Map<string, ProductDailyBreakdownRow>;
  }

  const productAccMap = new Map<string, ProductAccumulator>();
  const divisionAccMap = new Map<string, CategoryDistributionRow>();
  const categoryAccMap = new Map<string, CategoryDistributionRow>();
  const activeDaySet = new Set<string>();

  let totalQty = 0;
  let totalRevenue = 0;
  let totalHpp = 0;

  for (const item of filteredTransactions) {
    const { resolved, quantity, revenue, totalHpp: itemHpp, localDate } = item;
    if (localDate) activeDaySet.add(localDate);
    totalQty += quantity;
    totalRevenue += revenue;
    totalHpp += itemHpp;

    // Division breakdown
    const divKey = resolved.division;
    const divLabel =
      divKey === "BAR"
        ? "Divisi Bar & Beverage"
        : divKey === "KITCHEN"
          ? "Divisi Kitchen & Food"
          : divKey === "BAKER"
            ? "Divisi Bakery & Pastry"
            : "Belum Terdaftar";
    const curDiv = divisionAccMap.get(divKey) || {
      key: divKey,
      label: divLabel,
      qtySold: 0,
      totalRevenue: 0,
      totalHpp: 0,
      grossProfit: 0,
      sharePercent: 0,
    };
    curDiv.qtySold += quantity;
    curDiv.totalRevenue += revenue;
    curDiv.totalHpp += itemHpp;
    curDiv.grossProfit += revenue - itemHpp;
    divisionAccMap.set(divKey, curDiv);

    // Menu category breakdown
    const catKey = resolved.menuCategory || "LAINNYA";
    const curCat = categoryAccMap.get(catKey) || {
      key: catKey,
      label: catKey,
      qtySold: 0,
      totalRevenue: 0,
      totalHpp: 0,
      grossProfit: 0,
      sharePercent: 0,
    };
    curCat.qtySold += quantity;
    curCat.totalRevenue += revenue;
    curCat.totalHpp += itemHpp;
    curCat.grossProfit += revenue - itemHpp;
    categoryAccMap.set(catKey, curCat);

    // Product Mix parent row
    const acc = productAccMap.get(resolved.productId) || {
      key: resolved.productId,
      productId: resolved.productId,
      productName: resolved.productName,
      isMatched: resolved.isMatched,
      division: resolved.division,
      productGroup: resolved.productGroup,
      menuCategory: resolved.menuCategory,
      totalQty: 0,
      totalRevenue: 0,
      totalHpp: 0,
      variants: new Map<string, ProductVariantMixRow>(),
      days: new Map<string, ProductDailyBreakdownRow>(),
    };

    acc.totalQty += quantity;
    acc.totalRevenue += revenue;
    acc.totalHpp += itemHpp;

    // Variant sub-row
    const vKey = resolved.variantName || "Reguler";
    const vRow = acc.variants.get(vKey) || {
      variantKey: vKey,
      variantName: vKey,
      officialSellPrice: resolved.officialSellPrice,
      unitHpp: resolved.unitHpp,
      qtySold: 0,
      totalRevenue: 0,
      totalHpp: 0,
      grossProfit: 0,
      marginPercent: 0,
      hasRecipe: resolved.recipeIngredients.length > 0 || resolved.unitHpp > 0,
    };
    vRow.qtySold += quantity;
    vRow.totalRevenue += revenue;
    vRow.totalHpp += itemHpp;
    vRow.grossProfit = vRow.totalRevenue - vRow.totalHpp;
    vRow.marginPercent =
      vRow.totalRevenue > 0
        ? Math.round((vRow.grossProfit / vRow.totalRevenue) * 1000) / 10
        : 0;
    acc.variants.set(vKey, vRow);

    // Daily breakdown sub-row
    if (localDate) {
      const dRow = acc.days.get(localDate) || {
        date: localDate,
        qtySold: 0,
        totalRevenue: 0,
        totalHpp: 0,
      };
      dRow.qtySold += quantity;
      dRow.totalRevenue += revenue;
      dRow.totalHpp += itemHpp;
      acc.days.set(localDate, dRow);
    }

    productAccMap.set(resolved.productId, acc);
  }

  // Finalize PMIX rows & Menu Engineering Matrix
  const rawRows = Array.from(productAccMap.values());
  const avgQtyBenchmark =
    rawRows.length > 0 ? totalQty / rawRows.length : 0;
  const avgUnitProfitBenchmark =
    totalQty > 0 ? (totalRevenue - totalHpp) / totalQty : 0;

  const productMixRows: ProductMixRow[] = rawRows.map((acc) => {
    const grossProfit = acc.totalRevenue - acc.totalHpp;
    const marginPercent =
      acc.totalRevenue > 0
        ? Math.round((grossProfit / acc.totalRevenue) * 1000) / 10
        : 0;
    const foodCostPercent =
      acc.totalRevenue > 0
        ? Math.round((acc.totalHpp / acc.totalRevenue) * 1000) / 10
        : 0;
    const revenueSharePercent =
      totalRevenue > 0
        ? Math.round((acc.totalRevenue / totalRevenue) * 1000) / 10
        : 0;
    const avgUnitPrice =
      acc.totalQty > 0 ? Math.round(acc.totalRevenue / acc.totalQty) : 0;
    const unitProfit = acc.totalQty > 0 ? grossProfit / acc.totalQty : 0;

    let quadrant: MenuEngineeringQuadrant = "DOG";
    if (rawRows.length <= 1) {
      quadrant = grossProfit >= 0 ? "STAR" : "PLOWHORSE";
    } else {
      const isPopular = acc.totalQty >= avgQtyBenchmark * 0.7;
      const isProfitable =
        acc.totalHpp === 0
          ? marginPercent >= 50
          : unitProfit >= avgUnitProfitBenchmark;
      if (isPopular && isProfitable) quadrant = "STAR";
      else if (isPopular && !isProfitable) quadrant = "PLOWHORSE";
      else if (!isPopular && isProfitable) quadrant = "PUZZLE";
      else quadrant = "DOG";
    }

    return {
      key: acc.key,
      productId: acc.productId,
      productName: acc.productName,
      isMatched: acc.isMatched,
      division: acc.division,
      productGroup: acc.productGroup,
      menuCategory: acc.menuCategory,
      totalQty: acc.totalQty,
      totalRevenue: acc.totalRevenue,
      revenueSharePercent,
      totalHpp: acc.totalHpp,
      grossProfit,
      marginPercent,
      foodCostPercent,
      avgUnitPrice,
      quadrant,
      variantsBreakdown: Array.from(acc.variants.values()).sort(
        (a, b) => b.qtySold - a.qtySold
      ),
      dailyBreakdown: Array.from(acc.days.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
      ),
    };
  });

  productMixRows.sort((a, b) => {
    switch (sortBy) {
      case "REVENUE_DESC":
        return b.totalRevenue - a.totalRevenue || b.totalQty - a.totalQty;
      case "PROFIT_DESC":
        return b.grossProfit - a.grossProfit || b.totalRevenue - a.totalRevenue;
      case "MARGIN_DESC":
        return b.marginPercent - a.marginPercent || b.totalQty - a.totalQty;
      case "NAME_ASC":
        return a.productName.localeCompare(b.productName, "id-ID");
      case "QTY_DESC":
      default:
        return b.totalQty - a.totalQty || b.totalRevenue - a.totalRevenue;
    }
  });

  // Zero-sales active catalog products matching division/productGroup/menuCategory filter
  const soldProductIdsInDateWindow = new Set(
    dateScopedEnriched
      .filter((x) => x.resolved.isMatched && x.quantity > 0)
      .map((x) => x.resolved.productId)
  );

  const zeroSalesProducts: ZeroSalesProductRow[] =
    division === "UNMAPPED"
      ? []
      : products
          .filter((p) => {
            if (p.isActive === false) return false;
            if (soldProductIdsInDateWindow.has(p.id)) return false;
            if (division !== "ALL" && p.division !== division) return false;

            const vars = parseJsonArray<ProductVariant>(p.variants);
            const primaryGroup = inferProductGroup(
              p.division,
              p.category,
              p.productGroup,
              vars[0]?.name
            );
            const varGroups = vars.map((v) =>
              inferProductGroup(p.division, p.category, p.productGroup, v.name)
            );
            if (
              productGroup !== "ALL" &&
              primaryGroup !== productGroup &&
              !varGroups.includes(productGroup)
            ) {
              return false;
            }
            const cat = String(p.category || "").trim().toUpperCase();
            if (menuCategory !== "ALL" && cat !== menuCategory) return false;
            if (
              normSearch &&
              !`${p.name} ${cat} ${primaryGroup}`.toLowerCase().includes(normSearch)
            ) {
              return false;
            }
            return true;
          })
          .map((p) => {
            const vars = parseJsonArray<ProductVariant>(p.variants);
            const prices = vars
              .map((v) => Number(v.price) || 0)
              .filter((pr) => pr > 0);
            return {
              productId: p.id,
              productName: p.name,
              division: p.division,
              productGroup: inferProductGroup(
                p.division,
                p.category,
                p.productGroup,
                vars[0]?.name
              ),
              menuCategory: String(p.category || "LAINNYA").trim().toUpperCase(),
              variantsCount: vars.length,
              minPrice: prices.length > 0 ? Math.min(...prices) : 0,
              maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            };
          })
          .sort((a, b) => a.productName.localeCompare(b.productName, "id-ID"));

  // Theoretical ingredient usage summary for filtered transactions
  const ingMap = new Map<string, Ingredient>();
  ingredients.forEach((i) => ingMap.set(i.id, i));
  const ingUsageMap = new Map<
    string,
    { qty: number; menus: Set<string> }
  >();

  for (const item of filteredTransactions) {
    if (item.quantity <= 0) continue;
    const usages = resolveOrderItemIngredients(
      {
        menuName: item.resolved.isMatched ? item.resolved.productName : item.tx.menuName,
        variantName: item.resolved.variantName,
        recipeId: item.resolved.variant?.recipeId || undefined,
        quantity: item.quantity,
      },
      recipes,
      products,
      ingredients
    );
    usages.forEach((u) => {
      if (!u.ingredientId || u.totalQuantity <= 0) return;
      const cur = ingUsageMap.get(u.ingredientId) || {
        qty: 0,
        menus: new Set<string>(),
      };
      cur.qty += u.totalQuantity;
      cur.menus.add(
        formatCatalogMenuVariantLabel(
          item.resolved.productName,
          item.resolved.variantName,
          item.resolved.product?.variants?.length || 1
        )
      );
      ingUsageMap.set(u.ingredientId, cur);
    });
  }

  const ingredientUsageSummary: IngredientUsageSummaryRow[] = Array.from(
    ingUsageMap.entries()
  )
    .map(([ingId, info]) => {
      const ing = ingMap.get(ingId);
      const unitCost = Number(ing?.costPerUnit) || 0;
      const roundedQty = Math.round(info.qty * 100) / 100;
      return {
        ingredientId: ingId,
        ingredientName: ing?.name || ingId,
        unit: ing?.unit || "unit",
        totalUsedQty: roundedQty,
        unitCost,
        totalCost: Math.round(roundedQty * unitCost),
        currentStock: Number(ing?.currentStock) || 0,
        usedByMenus: Array.from(info.menus),
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || b.totalUsedQty - a.totalUsedQty);

  const finalizeDist = (map: Map<string, CategoryDistributionRow>) =>
    Array.from(map.values())
      .map((r) => ({
        ...r,
        sharePercent:
          totalRevenue > 0
            ? Math.round((r.totalRevenue / totalRevenue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const divisionDistribution = finalizeDist(divisionAccMap);
  const menuCategoryDistribution = finalizeDist(categoryAccMap);

  const grossProfit = totalRevenue - totalHpp;
  const marginPercent =
    totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 1000) / 10
      : 0;
  const foodCostPercent =
    totalRevenue > 0
      ? Math.round((totalHpp / totalRevenue) * 1000) / 10
      : 0;

  const topByVolume =
    productMixRows.length > 0
      ? [...productMixRows].sort(
          (a, b) => b.totalQty - a.totalQty || b.totalRevenue - a.totalRevenue
        )[0]
      : null;
  const topByProfit =
    productMixRows.length > 0
      ? [...productMixRows].sort(
          (a, b) => b.grossProfit - a.grossProfit || b.totalRevenue - a.totalRevenue
        )[0]
      : null;

  const diff = totalAllProductSales - totalRecapOmzet;
  const matchPercent =
    totalRecapOmzet > 0
      ? Math.round((totalAllProductSales / totalRecapOmzet) * 1000) / 10
      : totalAllProductSales > 0
        ? 100
        : 0;

  const activeDaysCount = Math.max(1, activeDaySet.size);

  return {
    filteredTransactions,
    productMixRows,
    omzetCrossCheck: {
      totalRecapOmzet,
      totalAllProductSales,
      filteredProductSales: totalRevenue,
      difference: diff,
      matchPercent,
      datesWithRecapButNoProducts,
      datesWithProductsButNoRecap,
    },
    zeroSalesProducts,
    ingredientUsageSummary,
    unmatchedMenuSummaries,
    availableProductGroups: Array.from(groupSet),
    availableMenuCategories: Array.from(categorySet).sort((a, b) =>
      a.localeCompare(b, "id-ID")
    ),
    divisionDistribution,
    menuCategoryDistribution,
    kpiSummary: {
      totalQty,
      activeDaysCount: activeDaySet.size,
      avgDailyQty: totalQty > 0 ? Math.round((totalQty / activeDaysCount) * 10) / 10 : 0,
      totalRevenue,
      avgTicketPrice: totalQty > 0 ? Math.round(totalRevenue / totalQty) : 0,
      totalHpp,
      grossProfit,
      marginPercent,
      foodCostPercent,
      topByVolume,
      topByProfit,
      matchedProductCount: productMixRows.filter((r) => r.isMatched).length,
      unmatchedMenuCount: unmatchedMenuSummaries.length,
    },
  };
}
