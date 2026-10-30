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
  const itemQty = Math.max(0, Number(item.quantity) || 1);
  if (itemQty <= 0) return [];

  const menuLower = String(item.menuName || "").trim().toLowerCase();
  const variantRaw = String(item.variantName || "").trim().toLowerCase();
  // Bersihkan info susu dalam kurung seperti "Iced (Oat Milk)" -> "iced" untuk pencocokan nama varian dasar
  const variantClean = variantRaw.replace(/\s*\([^)]*\)\s*/g, "").trim();

  const matchedProduct = (allProducts || []).find(
    (p: any) => String(p?.name || "").trim().toLowerCase() === menuLower
  );

  let baseRecipeList: RecipeIngredientRef[] = [];

  // 1. Cek resep spesifik pada Variant produk
  if (matchedProduct) {
    const variants = parseJsonArray(matchedProduct.variants);
    if (variants.length > 0 && variantRaw && variantRaw !== "regular") {
      const exactVar =
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
    const matchedRec =
      (item.recipeId ? (allRecipes || []).find((r: any) => r.id === item.recipeId) : null) ||
      (matchedProduct
        ? (allRecipes || []).find(
            (r: any) =>
              r?.menuItemId === matchedProduct.id ||
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
  activeShiftCashAccountId?: string | null
): string | null {
  const method = String(paymentMethod || "CASH").toUpperCase();
  const reqAcc = requestedAccountId
    ? cashAccounts.find((a) => a.id === requestedAccountId)
    : undefined;

  if (method === "CASH") {
    if (reqAcc && reqAcc.type === "CASH") return reqAcc.id;
    if (activeShiftCashAccountId) {
      const shiftAcc = cashAccounts.find((a) => a.id === activeShiftCashAccountId);
      if (shiftAcc) return shiftAcc.id;
      return activeShiftCashAccountId;
    }
    const defaultCash =
      cashAccounts.find((a) => a.type === "CASH" && a.isDefault) ||
      cashAccounts.find((a) => a.type === "CASH");
    return defaultCash?.id || requestedAccountId || null;
  }

  // Non-tunai (QRIS / DEBIT / CREDIT): utamakan akun BANK atau E_WALLET
  if (reqAcc && reqAcc.type !== "CASH") {
    return reqAcc.id;
  }
  const nonCashAcc =
    cashAccounts.find((a) => (a.type === "BANK" || a.type === "E_WALLET") && a.isDefault) ||
    cashAccounts.find((a) => a.type === "BANK" || a.type === "E_WALLET");

  // Jika toko belum membuat akun BANK sama sekali, kembalikan null agar uang non-tunai
  // TIDAK masuk ke saldo fisik Laci Kasir (server dapat mengarahkannya ke rekening non-tunai default)
  return nonCashAcc?.id || null;
}
