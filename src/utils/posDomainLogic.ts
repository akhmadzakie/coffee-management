import type {
  BatchPreparation,
  Ingredient,
  PaymentAccountChannel,
  PaymentAccountMapping,
  Product,
  Recipe,
} from "../types";
import { matchesIngredientCategory } from "./financeMetrics";

export interface RecipeIngredientRef {
  ingredientId: string;
  quantity: number;
}

export interface ResolvedIngredientUsage {
  ingredientId: string;
  quantityPerUnit: number;
  totalQuantity: number;
}

const parseJsonArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeModifierLabel = (rawName: string): string => {
  return String(rawName || "")
    .replace(/^\+\s*/, "")
    .replace(/^susu:\s*/i, "")
    .trim()
    .toLowerCase();
};

/**
 * Menghitung pemakaian bahan baku akurat per item order dengan memperhitungkan:
 * 1. Resep spesifik Variant (misal "Iced 16oz", "Hot 8oz", "Botol 1 Liter") jika tersedia di Products.
 * 2. Fallback ke tabel Recipes utama jika variant tidak memiliki resep khusus.
 * 3. Resep tambahan dari Modifier (misal "Extra Shot Espresso" -> +beans) dan substitusi susu alternatif
 *    (misal "Ganti Oat Milk" / "Susu: Oat Milk" -> mengganti susu sapi segar).
 */
export function resolveOrderItemIngredients(
  item: {
    menuName?: string | null;
    recipeId?: string | null;
    variantName?: string | null;
    quantity?: number | null;
    modifiers?: any[] | string | null;
  },
  allRecipes: any[] = [],
  allProducts: any[] = [],
  allIngredients: any[] = []
): ResolvedIngredientUsage[] {
  const rawQty =
    item.quantity === undefined || item.quantity === null
      ? 1
      : Number(item.quantity);
  const itemQty = Number.isFinite(rawQty) ? Math.max(0, rawQty) : 0;
  if (itemQty <= 0) return [];

  const menuLower = String(item.menuName || "").trim().toLowerCase();
  const explicitVariantRaw = String(item.variantName || "").trim().toLowerCase();

  let matchedProduct = (allProducts || []).find(
    (p: any) => String(p?.name || "").trim().toLowerCase() === menuLower
  );
  let matchedVariantFromMenu: any = null;

  if (!matchedProduct && menuLower) {
    for (const p of allProducts || []) {
      const pName = String(p?.name || "").trim().toLowerCase();
      if (!pName) continue;
      const pVariants = parseJsonArray(p?.variants);
      for (const v of pVariants) {
        const vName = String(v?.name || "").trim().toLowerCase();
        if (!vName) continue;
        if (
          menuLower === `${pName} - ${vName}` ||
          menuLower === `${pName} (${vName})` ||
          menuLower === `${pName} / ${vName}` ||
          menuLower === `${vName} ${pName}`
        ) {
          matchedProduct = p;
          matchedVariantFromMenu = v;
          break;
        }
      }
      if (matchedProduct) break;

      if (
        menuLower.startsWith(`${pName} - `) ||
        menuLower.startsWith(`${pName} (`) ||
        menuLower.startsWith(`${pName} / `)
      ) {
        matchedProduct = p;
        break;
      }
    }
  }

  const variantRaw =
    explicitVariantRaw ||
    String(matchedVariantFromMenu?.name || "").trim().toLowerCase();
  // Bersihkan info susu dalam kurung seperti "Iced (Oat Milk)" -> "iced" untuk pencocokan nama varian dasar
  const variantClean = variantRaw.replace(/\s*\([^)]*\)\s*/g, "").trim();

  let baseRecipeList: RecipeIngredientRef[] = [];

  // 1. Cek resep spesifik pada Variant produk
  if (matchedProduct) {
    const variants = parseJsonArray(matchedProduct.variants);
    if (matchedVariantFromMenu && parseJsonArray(matchedVariantFromMenu.recipe).length > 0) {
      baseRecipeList = parseJsonArray(matchedVariantFromMenu.recipe).map((r: any) => ({
        ingredientId: String(r.ingredientId),
        quantity: Number(r.quantity) || Number(r.amount) || 0,
      }));
    } else if (variants.length > 0 && variantRaw && variantRaw !== "regular") {
      const exactVar =
        matchedVariantFromMenu ||
        variants.find((v: any) => String(v?.name || "").trim().toLowerCase() === variantRaw) ||
        variants.find((v: any) => String(v?.name || "").trim().toLowerCase() === variantClean) ||
        variants.find((v: any) => {
          const vn = String(v?.name || "").trim().toLowerCase();
          return (
            (variantClean === "iced" && vn.includes("iced")) ||
            (variantClean === "hot" && vn.includes("hot")) ||
            (variantClean.includes("1 liter") && (vn.includes("1 liter") || vn.includes("1l"))) ||
            (variantClean.length >= 3 && vn.startsWith(variantClean))
          );
        });

      const varRecipe = parseJsonArray(exactVar?.recipe);
      if (varRecipe.length > 0) {
        baseRecipeList = varRecipe.map((r: any) => ({
          ingredientId: String(r.ingredientId),
          quantity: Number(r.quantity) || Number(r.amount) || 0,
        }));
      } else if (exactVar?.recipeId) {
        const linkedRec = (allRecipes || []).find((r: any) => r.id === exactVar.recipeId);
        if (linkedRec) {
          baseRecipeList = parseJsonArray(linkedRec.ingredients).map((r: any) => ({
            ingredientId: String(r.ingredientId),
            quantity: Number(r.quantity) || Number(r.amount) || 0,
          }));
        }
      }
    }

    // Jika variantName kosong/"Regular", gunakan varian pertama jika punya resep dan tabel recipes kosong
    if (baseRecipeList.length === 0 && variants.length > 0) {
      const defaultVarRecipe = parseJsonArray(variants[0]?.recipe);
      if (defaultVarRecipe.length > 0 && (!item.recipeId || !(allRecipes || []).some((r: any) => r.id === item.recipeId))) {
        baseRecipeList = defaultVarRecipe.map((r: any) => ({
          ingredientId: String(r.ingredientId),
          quantity: Number(r.quantity) || Number(r.amount) || 0,
        }));
      }
    }
  }

  // 2. Fallback ke tabel Recipes utama jika belum ketemu dari Variant
  if (baseRecipeList.length === 0) {
    const productNameLower = String(matchedProduct?.name || "").trim().toLowerCase();
    const matchedRec =
      (item.recipeId ? (allRecipes || []).find((r: any) => r.id === item.recipeId) : null) ||
      (matchedProduct
        ? (allRecipes || []).find(
            (r: any) =>
              r?.menuItemId === matchedProduct.id ||
              String(r?.menuName || "").trim().toLowerCase() === productNameLower ||
              String(r?.menuName || "").trim().toLowerCase() === menuLower
          )
        : null) ||
      (menuLower
        ? (allRecipes || []).find(
            (r: any) => String(r?.menuName || "").trim().toLowerCase() === menuLower
          )
        : null);

    if (matchedRec) {
      baseRecipeList = parseJsonArray(matchedRec.ingredients).map((r: any) => ({
        ingredientId: String(r.ingredientId),
        quantity: Number(r.quantity) || Number(r.amount) || 0,
      }));
    }
  }

  // Map akumulasi per 1 porsi menu
  const perUnitMap = new Map<string, number>();
  for (const r of baseRecipeList) {
    if (r.ingredientId && r.quantity > 0) {
      perUnitMap.set(r.ingredientId, (perUnitMap.get(r.ingredientId) || 0) + r.quantity);
    }
  }

  // 3. Evaluasi Modifiers (Resep Modifier Group, Extra Shot, dan Substitusi Susu)
  const modifiers = parseJsonArray(item.modifiers);
  const modifierGroups = matchedProduct ? parseJsonArray(matchedProduct.modifierGroups) : [];
  const allDefinedModOptions: any[] = [];
  for (const grp of modifierGroups) {
    for (const opt of parseJsonArray(grp?.options)) {
      allDefinedModOptions.push(opt);
    }
  }

  for (const mod of modifiers) {
    const rawModName = String(mod?.name || "");
    const cleanMod = normalizeModifierLabel(rawModName);
    if (!cleanMod) continue;
    const modCount = Math.max(1, Number(mod?.quantity) || 1);

    // Cek apakah modifier terdefinisi di ProductModifierGroup
    const matchedOpt = allDefinedModOptions.find((opt: any) => {
      const optLower = normalizeModifierLabel(opt?.name || "");
      return (
        optLower === cleanMod ||
        (cleanMod.includes("extra") && cleanMod.includes("shot") && optLower.includes("extra") && optLower.includes("shot")) ||
        (cleanMod.includes("oat") && optLower.includes("oat")) ||
        (cleanMod.includes("soy") && optLower.includes("soy")) ||
        (cleanMod.includes("almond") && optLower.includes("almond"))
      );
    });

    const optRecipe = parseJsonArray(matchedOpt?.recipe);
    if (optRecipe.length > 0) {
      for (const mr of optRecipe) {
        const qty = (Number(mr.quantity) || 0) * modCount;
        if (mr.ingredientId && qty > 0) {
          perUnitMap.set(mr.ingredientId, (perUnitMap.get(mr.ingredientId) || 0) + qty);
        }
      }
    } else if (cleanMod.includes("extra") && (cleanMod.includes("shot") || cleanMod.includes("espresso"))) {
      // Fallback standar coffee shop: Extra Shot = +9g kopi (atau biji kopi utama pada resep)
      const beanIdFromBase = Array.from(perUnitMap.keys()).find((id) => {
        if (id.includes("bean") || id.includes("coffee") || id.includes("kopi")) return true;
        const ing = (allIngredients || []).find((i: any) => i.id === id);
        return String(ing?.category || "").toLowerCase() === "coffee" || String(ing?.name || "").toLowerCase().includes("beans");
      });
      const fallbackBean =
        beanIdFromBase ||
        (allIngredients || []).find(
          (i: any) =>
            i.id === "ing-coffee-beans" ||
            String(i?.name || "").toLowerCase().includes("espresso") ||
            String(i?.name || "").toLowerCase().includes("beans")
        )?.id;

      if (fallbackBean) {
        perUnitMap.set(fallbackBean, (perUnitMap.get(fallbackBean) || 0) + 9 * modCount);
      }
    }

    // Substitusi Susu Alternatif (Oat / Soy / Almond): ganti pemakaian Fresh Milk sapi
    const isAltMilk =
      !cleanMod.includes("fresh milk") &&
      (cleanMod.includes("oat milk") ||
        cleanMod.includes("oatmilk") ||
        cleanMod.includes("soy milk") ||
        cleanMod.includes("soymilk") ||
        cleanMod.includes("almond milk"));

    if (isAltMilk) {
      const dairyMilkId = Array.from(perUnitMap.keys()).find((id) => {
        if (id === "ing-fresh-milk" || id.includes("fresh-milk")) return true;
        const ing = (allIngredients || []).find((i: any) => i.id === id);
        const nm = String(ing?.name || "").toLowerCase();
        return nm.includes("fresh milk") || nm.includes("susu uht") || nm.includes("susu segar");
      });

      if (dairyMilkId) {
        const dairyQty = perUnitMap.get(dairyMilkId) || 0;
        perUnitMap.delete(dairyMilkId);

        // Jika di gudang terdaftar stok Oat / Soy / Almond Milk dan belum ditambahkan via optRecipe, pindahkan takaran ml-nya
        if (optRecipe.length === 0 && dairyQty > 0) {
          const altKeyword = cleanMod.includes("oat")
            ? "oat"
            : cleanMod.includes("soy")
              ? "soy"
              : "almond";
          const altMilkIng = (allIngredients || []).find((i: any) => {
            const nm = String(i?.name || "").toLowerCase();
            return nm.includes(altKeyword) && (nm.includes("milk") || nm.includes("susu") || nm.includes("oatside"));
          });
          if (altMilkIng) {
            perUnitMap.set(altMilkIng.id, (perUnitMap.get(altMilkIng.id) || 0) + dairyQty);
          }
        }
      }
    }
  }

  return Array.from(perUnitMap.entries())
    .filter(([, qty]) => qty > 0)
    .map(([ingredientId, quantityPerUnit]) => ({
      ingredientId,
      quantityPerUnit,
      totalQuantity: Number((quantityPerUnit * itemQty).toFixed(4)),
    }));
}

/**
 * Deteksi apakah mutasi kas merupakan jurnal otomatis dari transaksi penjualan POS
 * (sehingga tidak boleh dijumlahkan dua kali bersama cashSales pada perhitungan Tutup Shift).
 */
export function isAutoPosSaleCashIn(tx: {
  type?: string;
  description?: string | null;
  category?: string | null;
}): boolean {
  if (tx.type !== "CASH_IN") return false;
  const desc = String(tx.description || "").trim();
  return (
    desc.startsWith("Penjualan POS #") ||
    desc.startsWith("Pelunasan POS #") ||
    desc.startsWith("Split POS #")
  );
}

/**
 * Menghitung ringkasan kas shift kasir tanpa double-counting antara salesTransactions & cashTransactions,
 * serta memisahkan metode pembayaran CASH vs QRIS vs EDC secara akurat.
 */
export function calculateShiftStats(
  activeShift: {
    startTime: string;
    startingCash: number;
    cashAccountId: string;
  } | null,
  salesTransactions: any[] = [],
  cashTransactions: any[] = []
) {
  if (!activeShift) {
    return {
      salesTotal: 0,
      cashSales: 0,
      qrisSales: 0,
      edcSales: 0,
      transactionCount: 0,
      cashIn: 0,
      posCashIn: 0,
      cashOut: 0,
      refundCash: 0,
      otherCashOut: 0,
      expectedEndingCash: 0,
    };
  }

  const startTime = new Date(activeShift.startTime).getTime();

  // Indeks metode bayar dari jurnal kas POS sebagai fallback data historis yang belum punya kolom paymentMethod
  const inferredMethodByReceipt = new Map<string, string>();
  for (const ct of cashTransactions || []) {
    const desc = String(ct?.description || "");
    const m = desc.match(/#(ORD-[A-Za-z0-9-]+)\s*\(([A-Za-z_]+)\)/i);
    if (m) {
      inferredMethodByReceipt.set(`POS-${m[1]}`, m[2].toUpperCase());
    }
  }

  const txList = (salesTransactions || []).filter(
    (t) => new Date(t.date).getTime() >= startTime
  );

  let cashSales = 0;
  let qrisSales = 0;
  let edcSales = 0;
  let salesTotal = 0;

  for (const t of txList) {
    const price = Math.round(Number(t.totalPrice) || 0);
    salesTotal += price;
    const rawMethod =
      t.paymentMethod ||
      inferredMethodByReceipt.get(String(t.importLogId || "")) ||
      "CASH";
    const method = String(rawMethod).toUpperCase();
    if (method === "CASH") cashSales += price;
    else if (method.includes("QRIS")) qrisSales += price;
    else edcSales += price;
  }

  const recentCashMovements = (cashTransactions || []).filter(
    (t) =>
      new Date(t.date).getTime() >= startTime &&
      t.accountId === activeShift.cashAccountId
  );

  // Pisahkan kas masuk manual (misal tambah uang kembalian) dari kas masuk otomatis penjualan POS
  const manualCashIn = recentCashMovements
    .filter((t) => t.type === "CASH_IN" && !isAutoPosSaleCashIn(t))
    .reduce((s, t) => s + Math.round(Number(t.amount) || 0), 0);

  const posCashIn = recentCashMovements
    .filter(
      (t) =>
        isAutoPosSaleCashIn(t) &&
        !/\((QRIS|DEBIT|CREDIT|TRANSFER|EDC)\)/i.test(String(t.description || ""))
    )
    .reduce((s, t) => s + Math.round(Number(t.amount) || 0), 0);

  // Utamakan jurnal kas aktual laci (posCashIn) karena sudah memperhitungkan pajak PB1, diskon promo, & split bill secara presisi;
  // fallback ke cashSales hanya bila jurnal kas belum terbentuk (mis. input manual / mode offline lama).
  const effectiveCashSalesForDrawer =
    posCashIn > 0 ? posCashIn : cashSales;

  const cashOut = recentCashMovements
    .filter((t) => t.type === "CASH_OUT")
    .reduce((s, t) => s + Math.round(Number(t.amount) || 0), 0);

  const refundCash = recentCashMovements
    .filter(
      (t) =>
        t.type === "CASH_OUT" &&
        (String(t.description || "").toLowerCase().includes("refund") ||
          String(t.description || "").toLowerCase().includes("void"))
    )
    .reduce((s, t) => s + Math.round(Number(t.amount) || 0), 0);

  const otherCashOut = Math.max(0, cashOut - refundCash);

  const expectedEndingCash = Math.round(
    (Number(activeShift.startingCash) || 0) +
      effectiveCashSalesForDrawer +
      manualCashIn -
      cashOut
  );

  return {
    salesTotal,
    cashSales: effectiveCashSalesForDrawer,
    qrisSales,
    edcSales,
    transactionCount: txList.length,
    cashIn: manualCashIn,
    posCashIn,
    cashOut,
    refundCash,
    otherCashOut,
    expectedEndingCash,
  };
}

/**
 * Menghitung ringkasan transaksi POS harian secara akuntansi benar:
 * - totalRevenue (Omzet Bruto) mencakup seluruh order selesai (PAID + yang kemudian di-REFUNDED).
 * - refundTotal menjumlah nominal yang dikembalikan pada order REFUNDED.
 * - netRevenue (Omzet Bersih) = totalRevenue - refundTotal (tidak terpotong 2x!).
 */
export function calculateTodayOrderSummary(todayOrders: any[] = []) {
  let totalRevenue = 0;
  let paidCount = 0;
  let openCount = 0;
  let voidCount = 0;
  let refundCount = 0;
  let refundTotal = 0;

  for (const ord of todayOrders) {
    const ordTotal = Math.round(Number(ord?.totalAmount) || 0);
    if (ord?.status === "PAID") {
      totalRevenue += ordTotal;
      paidCount++;
    } else if (ord?.status === "OPEN") {
      openCount++;
    } else if (ord?.status === "VOID" || ord?.status === "CANCELLED") {
      voidCount++;
    } else if (ord?.status === "REFUNDED") {
      totalRevenue += ordTotal;
      refundCount++;
      refundTotal += Math.round(Number(ord?.refundAmount) || ordTotal);
    }
  }

  const netRevenue = Math.max(0, totalRevenue - refundTotal);

  return {
    totalRevenue,
    refundTotal,
    netRevenue,
    paidCount,
    openCount,
    voidCount,
    refundCount,
  };
}

/**
 * Memilih akun penyimpanan kas yang tepat berdasarkan metode pembayaran:
 * - CASH -> wajib masuk ke Laci Kasir (CASH) milik shift aktif atau default CASH.
 * - QRIS / DEBIT / CREDIT -> masuk ke akun BANK / E_WALLET, tidak mencemari uang fisik laci kasir.
 */
export function resolvePaymentAccountId(
  paymentMethod: string,
  requestedAccountId: string | null | undefined,
  cashAccounts: { id: string; name: string; type: string; isDefault?: boolean }[] = [],
  activeShiftCashAccountId?: string | null,
  paymentAccountMapping?: PaymentAccountMapping | null
): string | null {
  const method = String(paymentMethod || "CASH").toUpperCase();
  const reqAcc = requestedAccountId
    ? cashAccounts.find((a) => a.id === requestedAccountId)
    : undefined;

  const mapChannel: PaymentAccountChannel =
    method === "CASH"
      ? "cash"
      : method === "QRIS"
      ? "qris"
      : method === "TRANSFER"
      ? "transfer"
      : method === "ONLINE" || method === "OJOL" || method === "ONLINE_DELIVERY"
      ? "onlineDelivery"
      : "edc";
  const mappedId = paymentAccountMapping?.[mapChannel];
  const mappedAcc = mappedId ? cashAccounts.find((a) => a.id === mappedId) : undefined;

  if (method === "CASH") {
    if (reqAcc && reqAcc.type === "CASH") return reqAcc.id;
    if (activeShiftCashAccountId) {
      const shiftAcc = cashAccounts.find((a) => a.id === activeShiftCashAccountId);
      if (shiftAcc) return shiftAcc.id;
      return activeShiftCashAccountId;
    }
    if (mappedAcc && mappedAcc.type === "CASH") return mappedAcc.id;
    const defaultCash =
      cashAccounts.find((a) => a.type === "CASH" && a.isDefault) ||
      cashAccounts.find((a) => a.type === "CASH");
    return defaultCash?.id || mappedAcc?.id || requestedAccountId || null;
  }

  // Non-tunai (QRIS / DEBIT / CREDIT / TRANSFER / OJOL): utamakan requested non-cash, lalu default mapping, lalu BANK/E_WALLET
  if (reqAcc && reqAcc.type !== "CASH") {
    return reqAcc.id;
  }
  if (mappedAcc) {
    return mappedAcc.id;
  }
  const nonCashAcc =
    cashAccounts.find((a) => (a.type === "BANK" || a.type === "E_WALLET") && a.isDefault) ||
    cashAccounts.find((a) => a.type === "BANK" || a.type === "E_WALLET");

  // Jika toko belum membuat akun BANK sama sekali, kembalikan null agar uang non-tunai
  // TIDAK masuk ke saldo fisik Laci Kasir (server dapat mengarahkannya ke rekening non-tunai default)
  return nonCashAcc?.id || null;
}

export interface CashFlowSyncItemInput {
  ingredientId?: string;
  unitMode?: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM";
  conversionFactor?: number | string;
  qty: number | string;
  unitPrice?: number | string;
  totalPrice?: number | string;
}

export interface CashFlowDirectIngredientUpdate {
  ingredient: Ingredient;
  oldCostPerUnit: number;
  newCostPerUnit: number;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  totalBaseQty: number;
  totalSpent: number;
}

export interface CashFlowBatchPrepUpdate {
  batchPrepName: string;
  ingredient: Ingredient;
  oldCostPerUnit: number;
  newCostPerUnit: number;
  newPurchasePrice: number;
}

export interface CashFlowVariantHppPreview {
  productId: string;
  productName: string;
  variantName: string;
  oldHpp: number;
  newHpp: number;
}

export interface CashFlowHppSyncResult {
  directUpdates: CashFlowDirectIngredientUpdate[];
  batchPrepUpdates: CashFlowBatchPrepUpdate[];
  productsToUpdate: Product[];
  affectedVariantPreviews: CashFlowVariantHppPreview[];
}

/**
 * Menghitung pembaruan harga modal bahan baku, efek berantai ke kondimen olahan
 * (BatchPreparation), serta estimasi HPP varian menu (Product) dari rincian belanja
 * Arus Kas tanpa mengubah jumlah stok fisik (`currentStock`) di inventori.
 */
export function calculateCashFlowHppSync(params: {
  itemRows: CashFlowSyncItemInput[];
  ingredients: Ingredient[];
  batchPreparations: BatchPreparation[];
  products: Product[];
  recipes: Recipe[];
  priceSyncMethod: "LAST_PRICE" | "WEIGHTED_AVERAGE";
}): CashFlowHppSyncResult {
  const {
    itemRows,
    ingredients,
    batchPreparations,
    products,
    recipes,
    priceSyncMethod,
  } = params;

  const empty: CashFlowHppSyncResult = {
    directUpdates: [],
    batchPrepUpdates: [],
    productsToUpdate: [],
    affectedVariantPreviews: [],
  };

  const aggregatedByIng = new Map<
    string,
    { ingredient: Ingredient; totalBaseQty: number; totalSpent: number }
  >();

  for (const row of itemRows) {
    if (!row.ingredientId) continue;
    const ing = ingredients.find((i) => i.id === row.ingredientId);
    if (!ing) continue;

    const qtyNum = typeof row.qty === "number" ? row.qty : parseFloat(String(row.qty));
    if (isNaN(qtyNum) || qtyNum <= 0) continue;

    let effectiveTotal =
      typeof row.totalPrice === "number"
        ? row.totalPrice
        : parseFloat(String(row.totalPrice ?? ""));
    if (isNaN(effectiveTotal) || effectiveTotal <= 0) {
      const unitNum =
        typeof row.unitPrice === "number"
          ? row.unitPrice
          : parseFloat(String(row.unitPrice ?? ""));
      if (!isNaN(unitNum) && unitNum > 0) {
        effectiveTotal = qtyNum * unitNum;
      }
    }
    if (isNaN(effectiveTotal) || effectiveTotal <= 0) continue;

    const parsedRowFactor =
      row.conversionFactor !== undefined && row.conversionFactor !== ""
        ? Number(row.conversionFactor)
        : NaN;
    const hasPurchaseUnit = Boolean(ing.purchaseUnit && Number(ing.conversionFactor) > 0);
    let factor = 1;
    if (row.unitMode === "BASE") {
      factor = 1;
    } else if (!isNaN(parsedRowFactor) && parsedRowFactor > 0) {
      factor = parsedRowFactor;
    } else if (hasPurchaseUnit) {
      factor = Number(ing.conversionFactor);
    }
    const baseQty = qtyNum * factor;

    const existing = aggregatedByIng.get(ing.id);
    if (existing) {
      existing.totalBaseQty += baseQty;
      existing.totalSpent += effectiveTotal;
    } else {
      aggregatedByIng.set(ing.id, {
        ingredient: ing,
        totalBaseQty: baseQty,
        totalSpent: effectiveTotal,
      });
    }
  }

  if (aggregatedByIng.size === 0) return empty;

  const effectiveCostMap = new Map<string, number>();
  ingredients.forEach((ing) => {
    effectiveCostMap.set(ing.id, Number(ing.costPerUnit) || 0);
  });

  const directIngredientIds = new Set<string>();
  const changedIngredientIds = new Set<string>();
  const directUpdates: CashFlowDirectIngredientUpdate[] = [];

  aggregatedByIng.forEach(({ ingredient, totalBaseQty, totalSpent }) => {
    const oldCostPerUnit = Number(ingredient.costPerUnit) || 0;
    const hasPurchaseUnit = Boolean(
      ingredient.purchaseUnit && Number(ingredient.conversionFactor) > 0
    );
    const factor = hasPurchaseUnit ? Number(ingredient.conversionFactor) : 1;
    const oldPurchasePrice = hasPurchaseUnit
      ? Math.round(
          Number(ingredient.purchasePrice) > 0
            ? Number(ingredient.purchasePrice)
            : oldCostPerUnit * factor
        )
      : Math.round(oldCostPerUnit);

    let newCostPerUnit: number;
    if (priceSyncMethod === "LAST_PRICE" || ingredient.currentStock <= 0) {
      newCostPerUnit = Math.round((totalSpent / totalBaseQty) * 100) / 100;
    } else {
      const existingVal = ingredient.currentStock * oldCostPerUnit;
      newCostPerUnit =
        Math.round(
          ((existingVal + totalSpent) / (ingredient.currentStock + totalBaseQty)) * 100
        ) / 100;
    }

    const newPurchasePrice = hasPurchaseUnit
      ? Math.round(newCostPerUnit * factor)
      : Math.round(newCostPerUnit);

    directIngredientIds.add(ingredient.id);
    changedIngredientIds.add(ingredient.id);
    effectiveCostMap.set(ingredient.id, newCostPerUnit);

    directUpdates.push({
      ingredient,
      oldCostPerUnit,
      newCostPerUnit,
      oldPurchasePrice,
      newPurchasePrice,
      totalBaseQty,
      totalSpent,
    });
  });

  // Efek berantai ke Kondimen Olahan (BatchPreparation)
  const batchPrepUpdates: CashFlowBatchPrepUpdate[] = [];
  const seenBatchTargetIds = new Set<string>();

  batchPreparations.forEach((bp) => {
    if (!bp.targetIngredientId || bp.yieldQuantity <= 0) return;
    if (directIngredientIds.has(bp.targetIngredientId)) return;
    if (seenBatchTargetIds.has(bp.targetIngredientId)) return;
    // Hindari batch prep yang menimpa bahan baku inputnya sendiri
    if (bp.ingredients.some((ri) => ri.ingredientId === bp.targetIngredientId)) return;

    const usesChangedRaw = bp.ingredients.some((ri) =>
      changedIngredientIds.has(ri.ingredientId)
    );
    if (!usesChangedRaw) return;

    const targetIng = ingredients.find((i) => i.id === bp.targetIngredientId);
    if (!targetIng) return;

    const totalBatchCost = bp.ingredients.reduce(
      (sum, ri) => sum + ri.quantity * (effectiveCostMap.get(ri.ingredientId) ?? 0),
      0
    );
    const newBatchUnitCost = Math.round((totalBatchCost / bp.yieldQuantity) * 100) / 100;
    const oldCostPerUnit = Number(targetIng.costPerUnit) || 0;
    const hasPurchaseUnit = Boolean(
      targetIng.purchaseUnit && Number(targetIng.conversionFactor) > 0
    );
    const newPurchasePrice = hasPurchaseUnit
      ? Math.round(newBatchUnitCost * Number(targetIng.conversionFactor))
      : Math.round(newBatchUnitCost);

    seenBatchTargetIds.add(targetIng.id);
    effectiveCostMap.set(targetIng.id, newBatchUnitCost);
    changedIngredientIds.add(targetIng.id);

    batchPrepUpdates.push({
      batchPrepName: bp.name,
      ingredient: targetIng,
      oldCostPerUnit,
      newCostPerUnit: newBatchUnitCost,
      newPurchasePrice,
    });
  });

  // Efek berantai ke Varian Produk / Menu
  const productsToUpdate: Product[] = [];
  const affectedVariantPreviews: CashFlowVariantHppPreview[] = [];

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

      const usesChanged = effectiveRecipe.some((ri) =>
        changedIngredientIds.has(ri.ingredientId)
      );
      if (!usesChanged) return v;

      const ingById = new Map(ingredients.map((i) => [i.id, i]));
      let rawCost = 0;
      let stockPackagingCost = 0;
      effectiveRecipe.forEach((ri) => {
        const lineCost = ri.quantity * (effectiveCostMap.get(ri.ingredientId) ?? 0);
        const ingObj = ingById.get(ri.ingredientId);
        if (ingObj && matchesIngredientCategory(ingObj.category, "Packaging & Cup")) {
          stockPackagingCost += lineCost;
        } else {
          rawCost += lineCost;
        }
      });

      const manualPackCost = Number(v.packagingCost || 0);
      const effectivePackagingCost =
        stockPackagingCost > 0
          ? Math.max(stockPackagingCost, manualPackCost)
          : manualPackCost;
      const baseCost = rawCost + effectivePackagingCost;
      const wastageCost = Math.round(baseCost * (Number(v.wastagePercent || 0) / 100));
      const overheadCost = Math.round(baseCost * (Number(v.overheadPercent || 0) / 100));
      const newEstimatedHpp = Math.round(baseCost + wastageCost + overheadCost);
      const oldHpp = Math.round(Number(v.estimatedHpp || 0));
      const nextPackagingCost =
        stockPackagingCost > manualPackCost ? Math.round(stockPackagingCost) : v.packagingCost;

      affectedVariantPreviews.push({
        productId: p.id,
        productName: p.name,
        variantName: v.name,
        oldHpp,
        newHpp: newEstimatedHpp,
      });

      if (
        newEstimatedHpp !== v.estimatedHpp ||
        nextPackagingCost !== v.packagingCost ||
        (!v.recipe?.length && effectiveRecipe.length > 0)
      ) {
        isProductChanged = true;
        return {
          ...v,
          recipe: v.recipe?.length ? v.recipe : effectiveRecipe,
          packagingCost: nextPackagingCost,
          estimatedHpp: newEstimatedHpp,
        };
      }
      return v;
    });

    if (isProductChanged) {
      productsToUpdate.push({
        ...p,
        variants: updatedVariants,
      });
    }
  });

  return {
    directUpdates,
    batchPrepUpdates,
    productsToUpdate,
    affectedVariantPreviews,
  };
}

export interface PackagingChoice {
  key: string;
  mode: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM";
  unit: string;
  factor: number;
  label: string;
}

export function getIngredientPackagingChoices(ing: Ingredient): PackagingChoice[] {
  const choices: PackagingChoice[] = [];
  const baseUnit = ing.unit || "pcs";
  const baseLower = baseUnit.trim().toLowerCase();
  const masterUnit = (ing.purchaseUnit || "").trim();
  const masterFactor = Number(ing.conversionFactor) || 0;
  const hasMaster = Boolean(masterUnit && masterFactor > 0);
  const bulkUnit = (ing.bulkUnit || "").trim();
  const bulkFactor = Number(ing.bulkConversionFactor) || 0;
  const hasBulk = Boolean(bulkUnit && bulkFactor > 0);

  if (hasBulk) {
    const subRatio =
      hasMaster && masterFactor > 0
        ? Math.round((bulkFactor / masterFactor) * 1000) / 1000
        : null;
    const bulkSummary = subRatio
      ? `1 = ${subRatio.toLocaleString("id-ID")} ${masterUnit} = ${bulkFactor.toLocaleString("id-ID")} ${baseUnit}`
      : `1 = ${bulkFactor.toLocaleString("id-ID")} ${baseUnit}`;
    choices.push({
      key: `PRESET:${bulkUnit}`,
      mode: "PRESET",
      unit: bulkUnit,
      factor: bulkFactor,
      label: `${bulkUnit} (Grosir • ${bulkSummary})`,
    });
  }

  if (hasMaster) {
    choices.push({
      key: "PURCHASE",
      mode: "PURCHASE",
      unit: masterUnit,
      factor: masterFactor,
      label: `${masterUnit} (Beli • 1 = ${masterFactor.toLocaleString("id-ID")} ${baseUnit})`,
    });
  }

  choices.push({
    key: "BASE",
    mode: "BASE",
    unit: baseUnit,
    factor: 1,
    label: `${baseUnit} (Satuan Resep)`,
  });

  const isVolume = ["ml", "cc", "mililiter"].includes(baseLower);
  const isWeight = ["gr", "g", "gram"].includes(baseLower);

  const presets: { unit: string; factor: number; label: string }[] = isVolume
    ? [
        { unit: "Liter", factor: 1000, label: `Liter (1.000 ${baseUnit})` },
        { unit: "Botol (700ml)", factor: 700, label: `Botol (700 ${baseUnit})` },
        { unit: "Jerigen (5L)", factor: 5000, label: `Jerigen 5L (5.000 ${baseUnit})` },
        { unit: "Karton (12L)", factor: 12000, label: `Karton 12L (12.000 ${baseUnit})` },
        { unit: "Galon (19L)", factor: 19000, label: `Galon 19L (19.000 ${baseUnit})` },
      ]
    : isWeight
      ? [
          { unit: "Kg", factor: 1000, label: `Kg (1.000 ${baseUnit})` },
          { unit: "Pack (250g)", factor: 250, label: `Pack 250g (250 ${baseUnit})` },
          { unit: "Pack (500g)", factor: 500, label: `Pack 500g (500 ${baseUnit})` },
          { unit: "Dus (5Kg)", factor: 5000, label: `Dus 5Kg (5.000 ${baseUnit})` },
          { unit: "Dus (10Kg)", factor: 10000, label: `Dus 10Kg (10.000 ${baseUnit})` },
          { unit: "Karung (25Kg)", factor: 25000, label: `Karung 25Kg (25.000 ${baseUnit})` },
        ]
      : [
          { unit: `Lusin (12${baseUnit})`, factor: 12, label: `Lusin (12 ${baseUnit})` },
          { unit: `Pack (50${baseUnit})`, factor: 50, label: `Pack (50 ${baseUnit})` },
          { unit: `Pack (100${baseUnit})`, factor: 100, label: `Pack (100 ${baseUnit})` },
          { unit: `Dus (500${baseUnit})`, factor: 500, label: `Dus (500 ${baseUnit})` },
          { unit: `Karton (1000${baseUnit})`, factor: 1000, label: `Karton (1.000 ${baseUnit})` },
        ];

  const masterLower = masterUnit.toLowerCase();
  const bulkLower = bulkUnit.toLowerCase();
  presets.forEach((p) => {
    const pLower = p.unit.toLowerCase();
    if (pLower === masterLower || pLower === baseLower || (bulkLower && pLower === bulkLower)) return;
    choices.push({
      key: `PRESET:${p.unit}`,
      mode: "PRESET",
      unit: p.unit,
      factor: p.factor,
      label: p.label,
    });
  });

  choices.push({
    key: "CUSTOM",
    mode: "CUSTOM",
    unit: "Karton",
    factor: hasMaster ? masterFactor : 1,
    label: "Kemasan Lain / Kustom (Karton, Dus, Pack...)",
  });

  return choices;
}

export function getPackagingSelectValue(
  row: { unitMode?: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM"; unit?: string },
  choices: PackagingChoice[]
): string {
  if (row.unitMode === "CUSTOM") return "CUSTOM";
  if (row.unitMode === "BASE") return "BASE";
  if (row.unitMode === "PURCHASE" && choices.some((c) => c.key === "PURCHASE")) {
    return "PURCHASE";
  }
  if (row.unitMode === "PRESET") {
    const rowUnitLower = String(row.unit || "").toLowerCase();
    const matchedPreset = choices.find(
      (c) => c.mode === "PRESET" && c.unit.toLowerCase() === rowUnitLower
    );
    if (matchedPreset) return matchedPreset.key;
  }
  return "CUSTOM";
}

// ─── AI Smart NLP Entry, Typo/Abbreviation & Store Ingredient Matcher ────────

const UNIT_REGEX_PART =
  "(?:karton|krtn|krt|ctn|kotak|ktk|karung|krg|sak|galon|gln|jerigen|jrgn|jrg|dirigen|botol|btl|kaleng|klg|sachet|sch|sct|bungkus|bks|slop|slp|pouch|pch|tabung|tbg|pack|pak|pck|krat|tray|papan|bal|ball|dus|dos|box|lusin|lsn|dz|liter|ltr|lt|l|ml|cc|mililiter|kg|kilo|kilogram|ons|gr|grm|gram|g|butir|btr|buah|bh|pcs|pc|bj|biji|roll|ikat|iket|portion|porsi)";

const UNIT_CANONICAL_GROUPS: string[][] = [
  ["karton", "krtn", "krt", "ctn"],
  ["kotak", "ktk"],
  ["dus", "dos", "box"],
  ["pack", "pak", "pck"],
  ["slop", "slp"],
  ["bungkus", "bks"],
  ["kaleng", "klg"],
  ["sachet", "sch", "sct"],
  ["botol", "btl"],
  ["jerigen", "jrgn", "jrg", "dirigen"],
  ["galon", "gln"],
  ["karung", "krg", "sak"],
  ["bal", "ball"],
  ["krat", "tray", "papan"],
  ["lusin", "lsn", "dz"],
  ["liter", "ltr", "lt", "l"],
  ["ml", "cc", "mililiter"],
  ["kg", "kilo", "kilogram"],
  ["gr", "g", "grm", "gram"],
  ["pcs", "pc", "bj", "biji", "bh", "buah", "btr", "butir"],
  ["roll"],
  ["ikat", "iket"],
  ["pouch", "pch"],
  ["tabung", "tbg"],
];

function canonicalizeUnitToken(token: string): string {
  const clean = token.trim().toLowerCase();
  if (!clean) return "";
  const firstWord = clean.split(/[\s(/]/)[0];
  for (const grp of UNIT_CANONICAL_GROUPS) {
    if (grp.includes(clean) || (firstWord && grp.includes(firstWord))) {
      return grp[0];
    }
  }
  return firstWord || clean;
}

function unitTokenMatchesDeclaredUnit(declaredUnit: string, spokenUnit: string, combinedText: string): boolean {
  const declTrim = declaredUnit.trim().toLowerCase();
  if (!declTrim) return false;
  const declFirstWord = declTrim.split(/[\s(/]/)[0];
  const declCanon = canonicalizeUnitToken(declTrim);
  const spokenTrim = spokenUnit.trim().toLowerCase();
  const spokenCanon = canonicalizeUnitToken(spokenTrim);

  if (spokenTrim) {
    if (
      declTrim === spokenTrim ||
      declFirstWord === spokenTrim ||
      (declCanon && spokenCanon && declCanon === spokenCanon)
    ) {
      return true;
    }
  }

  // Cek kemunculan alias satuan yang dideklarasikan langsung di kalimat (misal "2krt", "3 slop", "5 liter")
  const matchedGroup = UNIT_CANONICAL_GROUPS.find(
    (g) => g.includes(declTrim) || g.includes(declFirstWord) || g[0] === declCanon
  );
  const tokensToCheck = matchedGroup ? matchedGroup : [declFirstWord];
  return tokensToCheck.some((tok) => {
    if (!tok) return false;
    const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\d|\\s)${esc}\\b`, "i").test(combinedText);
  });
}

export function resolveIngredientPackagingFromText(
  ing: any,
  rawUnit?: string | null,
  rawText?: string | null
): {
  unit: string;
  unitMode: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM";
  conversionFactor: number;
} {
  const baseUnit = String(ing?.unit || "pcs");
  const baseLower = baseUnit.trim().toLowerCase();
  const masterUnit = String(ing?.purchaseUnit || "").trim();
  const masterFactor = Number(ing?.conversionFactor) || 0;
  const bulkUnit = String(ing?.bulkUnit || "").trim();
  const bulkFactor = Number(ing?.bulkConversionFactor) || 0;
  const unitLower = String(rawUnit || "").trim().toLowerCase();
  const textLower = String(rawText || "").trim().toLowerCase();
  const combined = `${unitLower} ${textLower}`;

  const isVolume = ["ml", "cc", "mililiter"].includes(baseLower);
  const isWeight = ["gr", "g", "gram"].includes(baseLower);

  // Prioritas 1: Cocokkan ke Satuan Terbesar / Grosir milik bahan itu sendiri (Tingkat 3)
  if (bulkUnit && bulkFactor > 0 && unitTokenMatchesDeclaredUnit(bulkUnit, unitLower, combined)) {
    return { unit: bulkUnit, unitMode: "PRESET", conversionFactor: bulkFactor };
  }

  // Prioritas 2: Cocokkan ke Satuan Beli / Menengah milik bahan itu sendiri (Tingkat 2)
  if (masterUnit && masterFactor > 0 && unitTokenMatchesDeclaredUnit(masterUnit, unitLower, combined)) {
    return { unit: masterUnit, unitMode: "PURCHASE", conversionFactor: masterFactor };
  }

  // Prioritas 3: Cocokkan ke Satuan Resep / Terkecil milik bahan itu sendiri (Tingkat 1)
  if (
    unitLower === baseLower ||
    (isWeight && ["g", "gr", "grm", "gram"].includes(unitLower)) ||
    (isVolume && ["ml", "cc", "mililiter"].includes(unitLower)) ||
    (!isWeight && !isVolume && unitTokenMatchesDeclaredUnit(baseUnit, unitLower, ""))
  ) {
    return { unit: baseUnit, unitMode: "BASE", conversionFactor: 1 };
  }

  // Prioritas 4: Ukuran kemasan eksplisit di teks (mis. 500gr, 250g, 12x1L)
  if (isVolume) {
    if (/\b(karton|krtn|krt|ctn)\b/.test(combined)) {
      return { unit: "Karton (12L)", unitMode: "PRESET", conversionFactor: 12000 };
    }
    if (/\b(galon|gln)\b/.test(combined)) {
      return { unit: "Galon (19L)", unitMode: "PRESET", conversionFactor: 19000 };
    }
    if (/\b(jerigen|dirigen|jerrycan|jrgn|jrg)\b/.test(combined)) {
      return { unit: "Jerigen (5L)", unitMode: "PRESET", conversionFactor: 5000 };
    }
    if (/\b(botol|btl)\b/.test(combined)) {
      return { unit: "Botol (700ml)", unitMode: "PRESET", conversionFactor: 700 };
    }
    if (
      /\b(liter|ltr|lt|l|kotak|ktk)\b/.test(unitLower) ||
      /\b\d+(?:[.,]\d+)?\s*(liter|ltr|lt|l)\b/i.test(textLower)
    ) {
      return { unit: "Liter", unitMode: "PRESET", conversionFactor: 1000 };
    }
  } else if (isWeight) {
    if (/\b(karung|krg|sak)\b/.test(combined)) {
      return { unit: "Karung (25Kg)", unitMode: "PRESET", conversionFactor: 25000 };
    }
    if (/\b(bal|ball)\b/.test(combined)) {
      return { unit: "Plastik (10Kg)", unitMode: "PRESET", conversionFactor: 10000 };
    }
    if (/\b(dus|dos|karton|krtn|krt|ctn|box)\b/.test(combined)) {
      return { unit: "Dus (10Kg)", unitMode: "PRESET", conversionFactor: 10000 };
    }
    if (/500\s*g/.test(combined)) {
      return { unit: "Pack (500g)", unitMode: "PRESET", conversionFactor: 500 };
    }
    if (/250\s*g/.test(combined)) {
      return { unit: "Pack (250g)", unitMode: "PRESET", conversionFactor: 250 };
    }
    if (/\b(kg|kilo|kilogram)\b/.test(combined)) {
      return { unit: "Kg", unitMode: "PRESET", conversionFactor: 1000 };
    }
  } else {
    if (/\b(lusin|lsn|dz)\b/.test(combined)) {
      return { unit: `Lusin (12${baseUnit})`, unitMode: "PRESET", conversionFactor: 12 };
    }
    if (/\b(dus|dos|box)\b/.test(combined)) {
      return { unit: `Dus (500${baseUnit})`, unitMode: "PRESET", conversionFactor: 500 };
    }
    if (/\b(karton|krtn|krt|ctn)\b/.test(combined)) {
      return { unit: `Karton (1000${baseUnit})`, unitMode: "PRESET", conversionFactor: 1000 };
    }
    if (/\b(pack|pak|pck|slop|slp)\b/.test(combined)) {
      return { unit: `Pack (100${baseUnit})`, unitMode: "PRESET", conversionFactor: 100 };
    }
  }

  if (masterUnit && masterFactor > 0) {
    return { unit: masterUnit, unitMode: "PURCHASE", conversionFactor: masterFactor };
  }
  if (bulkUnit && bulkFactor > 0) {
    return { unit: bulkUnit, unitMode: "PRESET", conversionFactor: bulkFactor };
  }
  return { unit: baseUnit, unitMode: "BASE", conversionFactor: 1 };
}

export function matchIngredientFromStore(ingredientsList: any[], text: string) {
  if (!Array.isArray(ingredientsList) || ingredientsList.length === 0) return null;
  const textLower = String(text || "").toLowerCase();

  // Prioritaskan kecocokan nama persis terlebih dahulu
  const exactMatch = ingredientsList.find((ing: any) => {
    const nameLower = String(ing?.name || "").trim().toLowerCase();
    return Boolean(nameLower && textLower.includes(nameLower));
  });
  if (exactMatch) return exactMatch;

  // Prioritaskan jenis spesifik (Oat Milk vs Fresh Milk, Gula Aren vs Gula Pasir)
  const isOatText = /\b(oat|oatmilk|oatside)\b/.test(textLower);
  const isArenText = /\b(aren|ga|brownsugar|brown sugar)\b/.test(textLower);

  return (
    ingredientsList.find((ing: any) => {
      const nameLower = String(ing?.name || "").toLowerCase();
      if (!nameLower) return false;

      if (nameLower.includes("oat") && isOatText) return true;
      if (
        (nameLower.includes("susu") || nameLower.includes("milk")) &&
        !nameLower.includes("oat") &&
        !isOatText &&
        /\b(susu|ssu|milk|fm|freshmilk|uht|gf|greenfield|greenfields|dmd|diamond|brookfarm|cimory)\b/.test(
          textLower
        )
      ) {
        return true;
      }
      if (nameLower.includes("aren") && isArenText) return true;
      if (
        nameLower.includes("gula pasir") &&
        !isArenText &&
        /\b(gula pasir|gp|gla pasir|gla)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("beans") || nameLower.includes("kopi") || nameLower.includes("espresso")) &&
        /\b(kopi|kpi|bean|beans|espresso|esp|hb|houseblend|house blend|arabika|arabica|robusta)\b/.test(
          textLower
        )
      ) {
        return true;
      }
      if (
        (nameLower.includes("es batu") || nameLower.includes("es kristal")) &&
        /\b(es batu|es kristal|esbatu|ice cube|ice)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("galon") || nameLower.includes("air bersih")) &&
        /\b(galon|gln|air bers|air ro|ro|aqua)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("sirup") || nameLower.includes("syrup")) &&
        /\b(sirup|srp|syrup|vnl|vanila|vanilla|crml|caramel|karamel|hzl|hazelnut)\b/.test(
          textLower
        )
      ) {
        return true;
      }
      if (
        nameLower.includes("matcha") &&
        /\b(matcha|mtcha|macha|greentea|green tea)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("coklat") || nameLower.includes("choco") || nameLower.includes("cocoa")) &&
        /\b(coklat|cokelat|choco|cocoa|kakao)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("creamer") || nameLower.includes("krimer") || nameLower.includes("evap")) &&
        /\b(creamer|krimer|evap|evaporasi|skm)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        nameLower.includes("beras") &&
        /\b(beras|brs|rice)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        nameLower.includes("ayam") &&
        /\b(ayam|aym|chicken|fillet)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("butter") || nameLower.includes("mentega")) &&
        /\b(butter|btr|mentega|anchor)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        nameLower.includes("croissant") &&
        /\b(croissant|crsnt|croisant|dough|pastry)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        nameLower.includes("minyak") &&
        /\b(minyak|mnyk|bimoli)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("telur") || nameLower.includes("telor")) &&
        /\b(telur|telor|tlr|egg)\b/.test(textLower)
      ) {
        return true;
      }
      if (
        (nameLower.includes("tepung") || nameLower.includes("terigu")) &&
        /\b(tepung|tpg|terigu)\b/.test(textLower)
      ) {
        return true;
      }
      return false;
    }) || null
  );
}

export function enrichParsedTransactionWithStore(
  tx: any,
  storeContext: any,
  fallbackText?: string
) {
  const ingredientsList = Array.isArray(storeContext?.ingredients)
    ? storeContext.ingredients
    : [];
  const matchedIng =
    (tx.ingredientId
      ? ingredientsList.find((i: any) => i.id === tx.ingredientId)
      : null) ||
    matchIngredientFromStore(
      ingredientsList,
      `${tx.ingredientName || ""} ${tx.description || ""} ${fallbackText || ""}`
    );

  if (!matchedIng) {
    return {
      ...tx,
      ingredientId: null,
      ingredientName: null,
      quantity: tx.quantity ? Number(tx.quantity) : null,
      unit: tx.unit || null,
      unitMode: null,
      conversionFactor: null,
    };
  }

  const qty = Number(tx.quantity) > 0 ? Number(tx.quantity) : 1;
  const resolvedPack = resolveIngredientPackagingFromText(
    matchedIng,
    tx.unit,
    `${tx.description || ""} ${fallbackText || ""}`
  );
  const providedFactor = Number(tx.conversionFactor);
  const effectiveFactor =
    providedFactor > 0 ? providedFactor : resolvedPack.conversionFactor;
  const effectiveMode: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM" =
    effectiveFactor === 1
      ? "BASE"
      : matchedIng.purchaseUnit &&
          Number(matchedIng.conversionFactor) === effectiveFactor &&
          resolvedPack.unitMode === "PURCHASE"
        ? "PURCHASE"
        : resolvedPack.unitMode;

  return {
    ...tx,
    ingredientId: matchedIng.id,
    ingredientName: matchedIng.name,
    quantity: qty,
    unit: tx.unit && providedFactor > 0 ? tx.unit : resolvedPack.unit,
    unitMode: effectiveMode,
    conversionFactor: effectiveFactor,
  };
}

function parseIndonesianMoneyValue(rawNum: string, rawSuffix?: string): number {
  const suffix = (rawSuffix || "").trim().toLowerCase();
  const trimmed = rawNum.trim();
  let val = 0;

  if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed) && !suffix) {
    val = parseFloat(trimmed.replace(/\./g, ""));
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(trimmed) && !suffix) {
    val = parseFloat(trimmed.replace(/,/g, ""));
  } else if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(trimmed)) {
    val = parseFloat(trimmed.replace(/\./g, "").replace(",", "."));
  } else {
    val = parseFloat(trimmed.replace(",", "."));
  }

  if (isNaN(val) || val <= 0) return 0;

  if (suffix === "rb" || suffix === "ribu" || suffix === "rbu" || suffix === "k") {
    val *= 1000;
  } else if (suffix === "jt" || suffix === "juta") {
    val *= 1000000;
  } else if (val < 1000 && !suffix) {
    val *= 1000;
  }

  return Math.round(val);
}

/**
 * Parser kalimat bebas Bahasa Indonesia (tahan typo, singkatan chat, satuan kemasan,
 * perkalian harga satuan `@` / `per`, dan format ribuan bertitik) untuk Finance & Manager.
 */
export function parseSmartCoffeeTextEntry(text: string, storeContext?: any) {
  const clean = String(text || "").trim();
  if (!clean) {
    return {
      summary: "Catatan kosong.",
      transactions: [],
      source: "local-nlp" as const,
    };
  }

  // Pecah klausa tanpa memotong angka desimal berkoma (mis. 1,5jt atau 2,5kg)
  // Koma hanya dianggap desimal jika diapit angka di kiri DAN kanan (`\d,\d`).
  const sentences = clean
    .split(/(?<!\d),|,(?!\d)|;|\n|\b(?:lalu|dan kemudian|serta|sama beli|terus beli)\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const transactions: any[] = [];
  let inheritedAccountName: string | null = null;
  let inheritedVendorName: string | null = null;

  const detectAccountFromSentence = (s: string): string | null => {
    if (
      /\b(bca|bank|tf|trf|transfer|rek|rekening|mandiri|mdr|bri|bni|bsi|debit|qris|edc)\b/i.test(
        s
      )
    ) {
      return "Bank BCA";
    }
    if (/\b(utama|brankas|owner|tabungan|kas besar)\b/i.test(s)) {
      return "Kas Utama";
    }
    if (/\b(laci|kasir|drawer|petty|pc|tunai|cash)\b/i.test(s)) {
      return "Laci Kasir";
    }
    return null;
  };

  for (const sentence of sentences) {
    // 1. Bersihkan dimensi barang (80x100) & ukuran cup (12oz/16oz) agar tidak terbaca sebagai harga
    let workStr = sentence
      .replace(/\b\d+\s*[*xX]\s*\d+\b/g, " ")
      .replace(/\b\d+\s*oz\b/gi, " ");

    // 2. Ekstrak kuantitas + satuan kemasan LEBIH DULU dan hapus dari string kerja harga
    let quantity = 1;
    let rawUnit: string | null = null;
    const qtyRegex = new RegExp(
      `(?:^|[\\s,(])(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_REGEX_PART})\\b`,
      "i"
    );
    const qtyMatch = workStr.match(qtyRegex);
    if (qtyMatch) {
      const parsedQty = parseFloat(qtyMatch[1].replace(",", "."));
      if (!isNaN(parsedQty) && parsedQty > 0) {
        quantity = parsedQty;
      }
      rawUnit = qtyMatch[2];
      // Hapus bagian angka+satuan agar "6" di "6 liter 111rb" tidak tertukar menjadi nominal uang!
      workStr = workStr.replace(qtyMatch[0], " ");
    }

    // 3. Ekstrak nominal uang (prioritaskan `@` per unit, lalu prefix Rp/total, lalu suffix rb/k/jt, lalu ribuan bertitik)
    let amount = 0;
    const perUnitRegex = new RegExp(
      `(?:@|per\\s*(?:${UNIT_REGEX_PART})?\\s*:?)\\s*(?:rp\\.?\\s*)?(\\d+(?:[.,]\\d+)*)\\s*(rb|ribu|rbu|k|jt|juta)?\\b`,
      "i"
    );
    const perUnitMatch = workStr.match(perUnitRegex);

    if (perUnitMatch) {
      const unitMoney = parseIndonesianMoneyValue(perUnitMatch[1], perUnitMatch[2]);
      if (unitMoney > 0) {
        amount = Math.round(quantity * unitMoney);
      }
    } else {
      const rpMatch = workStr.match(
        /(?:rp\.?|seharga|total|harga|biaya|nilai|senilai|bayar)\s*(\d+(?:[.,]\d+)*)\s*(rb|ribu|rbu|k|jt|juta)?\b/i
      );
      const suffixMatch = workStr.match(
        /\b(\d+(?:[.,]\d+)*)\s*(rb|ribu|rbu|k|jt|juta)\b/i
      );
      const formattedThousandsMatch = workStr.match(
        /\b(\d{1,3}(?:\.\d{3})+)(?:,\d+)?\b/
      );
      const fallbackMatch = workStr.match(/\b(\d+(?:[.,]\d+)?)\b/);

      const chosen =
        rpMatch || suffixMatch || formattedThousandsMatch || fallbackMatch;
      if (chosen) {
        amount = parseIndonesianMoneyValue(chosen[1], chosen[2]);
      }
    }

    if (amount <= 0) continue;

    // 4. Deteksi tipe & kategori transaksi (termasuk typo/singkatan)
    const isIncome =
      /\b(terima|masuk|omset|omzet|pendapatan|setor|income|pelunasan|pemasukan)\b/i.test(
        sentence
      );
    const type = isIncome ? "CASH_IN" : "CASH_OUT";

    const matchedIngredient = matchIngredientFromStore(
      storeContext?.ingredients || [],
      sentence
    );

    let category = "Operasional";
    if (
      matchedIngredient ||
      /\b(susu|ssu|fm|uht|gf|dmd|oat|oatside|kopi|kpi|bean|beans|espresso|hb|sirup|srp|syrup|teh|matcha|mtcha|aren|creamer|butter|btr|mentega|croissant|crsnt|daging|ayam|aym|beras|brs|minyak|mnyk|telur|tlr|tepung|tpg|keju|saus|esbatu|galon|gln|air|gula|gp)\b/i.test(
        sentence
      )
    ) {
      category = "Bahan Baku";
    } else if (
      /\b(cup|lid|sedotan|sdtn|straw|paper|paperbag|seal|plastik|kresek|kotak|box)\b/i.test(
        sentence
      )
    ) {
      category = "Packaging & Kemasan";
    } else if (
      /\b(sabun|sunlight|wipol|sampah|trashbag|tissue|tisu|pel|sapu|lap|kebersihan|kantong)\b/i.test(
        sentence
      )
    ) {
      category = "Kebersihan & Sanitasi";
    } else if (
      /\b(listrik|pln|token|wifi|inet|indihome|pdam|pam|gas|lpg|elpiji)\b/i.test(
        sentence
      )
    ) {
      category = "Utilitas";
    } else if (
      /\b(gaji|gj|upah|lembur|kasbon|thr|bonus|bpjs)\b/i.test(sentence)
    ) {
      category = "Gaji & SDM";
    } else if (isIncome) {
      category = "Pendapatan Lain";
    }

    const explicitAccount = detectAccountFromSentence(sentence);
    if (explicitAccount) {
      inheritedAccountName = explicitAccount;
    }
    const accountName = explicitAccount || inheritedAccountName || "Laci Kasir";

    const vendorMatch = sentence.match(
      /\b(?:di|dari|toko|supplier|sup)\s+([A-Z0-9][A-Za-z0-9\s.&'-]{2,25}?)(?=\s+(?:rp|\d|@|kas|laci|tf|bca|bank|mandiri|bri|bni)|$)/i
    );
    const rawVendor = vendorMatch ? vendorMatch[1].trim() : null;
    const explicitVendor =
      rawVendor && !/^(?:laci|kas|kasir|bank|bca|utama|mandiri|bri|bni|qris|edc)\b/i.test(rawVendor)
        ? rawVendor
        : null;
    if (explicitVendor) {
      inheritedVendorName = explicitVendor;
    }
    const vendorName = explicitVendor || inheritedVendorName || null;

    transactions.push(
      enrichParsedTransactionWithStore(
        {
          type,
          amount,
          category,
          description: sentence.trim(),
          accountName,
          vendorName,
          ingredientId: matchedIngredient?.id || null,
          ingredientName: matchedIngredient?.name || null,
          quantity,
          unit: rawUnit,
        },
        storeContext,
        sentence
      )
    );
  }

  return {
    summary:
      transactions.length > 0
        ? `${transactions.length} transaksi berhasil diekstrak dari catatan narasi.`
        : "Belum ada nominal transaksi yang terbaca dari catatan tersebut.",
    transactions,
    source: "local-nlp" as const,
  };
}

/** Hitung subtotal, pajak PB1, dan total akhir pecahan Split Bill per item selaras dengan server. */
export function computeSplitItemsTotals(
  itemsSubtotal: number,
  taxPercent: number = 0,
  taxMode: string = "EXCLUSIVE"
): { subtotal: number; taxAmount: number; totalAmount: number; taxMode: "EXCLUSIVE" | "INCLUSIVE" } {
  const cleanSubtotal = Math.max(0, Math.round(Number(itemsSubtotal) || 0));
  const rate = Math.max(0, Number(taxPercent) || 0);
  const normalizedMode: "EXCLUSIVE" | "INCLUSIVE" =
    String(taxMode || "EXCLUSIVE").toUpperCase() === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE";

  let taxAmount = 0;
  if (rate > 0 && cleanSubtotal > 0) {
    taxAmount =
      normalizedMode === "INCLUSIVE"
        ? Math.round((cleanSubtotal * rate) / (100 + rate))
        : Math.round((cleanSubtotal * rate) / 100);
  }
  const totalAmount = normalizedMode === "EXCLUSIVE" ? cleanSubtotal + taxAmount : cleanSubtotal;
  return {
    subtotal: cleanSubtotal,
    taxAmount,
    totalAmount,
    taxMode: normalizedMode,
  };
}
