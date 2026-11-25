import {
  DailySalesRecap,
  Ingredient,
  Product,
  ProductDivision,
  ProductVariant,
  PurchaseOrder,
  PurchaseOrderItem,
  Recipe,
  RecipeIngredient,
  Supplier,
} from "../types";
import { DEFAULT_STORE_TIMEZONE, getLocalDateString } from "./dateUtils";
import {
  normalizeTextCode,
  parseFlexibleDateYmd,
  parseLocalizedNumber,
} from "./genericImport";
import {
  getLocalPeriodFromTimestamp,
  addDaysToLocalDate,
  mergeDuplicateRecipeIngredients,
} from "./syncSanitizers";
import { inferProductGroup } from "./productSalesAnalytics";

const makeId = (prefix: string) =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}_${crypto.randomUUID().slice(0, 8)}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ─── 1. Katalog Menu & Varian ────────────────────────────────────────────────

export interface MenuImportPlan {
  productsToCreate: Omit<Product, "id" | "createdAt">[];
  productsToUpdate: Product[];
  addedVariants: number;
  updatedVariants: number;
  skipped: number;
}

const VALID_DIVISIONS = new Set<ProductDivision>(["BAR", "KITCHEN", "BAKER"]);

const parseActiveFlag = (raw: unknown, fallback = true): boolean => {
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const s = String(raw).trim().toUpperCase();
  if (["NONAKTIF", "TIDAK", "NO", "FALSE", "0", "OFF", "INACTIVE"].includes(s)) {
    return false;
  }
  return true;
};

export function buildMenuImportPlan(
  rows: Record<string, any>[],
  existingProducts: Product[],
  nowIso: string = new Date().toISOString()
): MenuImportPlan {
  let addedVariants = 0;
  let updatedVariants = 0;
  let skipped = 0;

  // Clone products to mutate safely
  const productById = new Map<string, Product>();
  const productByDivAndName = new Map<string, Product>();
  const dirtyProductIds = new Set<string>();

  for (const p of existingProducts || []) {
    const cloned: Product = {
      ...p,
      variants: (p.variants || []).map((v) => ({ ...v })),
    };
    productById.set(cloned.id, cloned);
    const key = `${cloned.division}::${cloned.name.trim().toLowerCase()}`;
    productByDivAndName.set(key, cloned);
  }

  const newProductsMap = new Map<string, Omit<Product, "id" | "createdAt">>();

  for (const row of rows || []) {
    const idSistem = normalizeTextCode(row["ID_SISTEM (JANGAN DIUBAH)"]);
    const rawName = String(row["Nama Menu"] ?? row.name ?? "").trim();
    if (!rawName) {
      skipped++;
      continue;
    }

    const rawDiv = String(row["Divisi"] ?? row.division ?? "BAR")
      .trim()
      .toUpperCase() as ProductDivision;
    const division: ProductDivision = VALID_DIVISIONS.has(rawDiv) ? rawDiv : "BAR";
    const category = String(row["Kategori Menu"] ?? row.category ?? "Umum").trim() || "Umum";
    const rawGroup = String(row["Grup Produk"] ?? row.productGroup ?? "").trim().toUpperCase();
    const productGroup =
      rawGroup || inferProductGroup(division, category);
    const variantName = String(row["Nama Varian"] ?? row.variantName ?? "Reguler").trim() || "Reguler";
    const sku = normalizeTextCode(row["SKU"] ?? row.sku) || undefined;
    const price = Math.max(0, Math.round(parseLocalizedNumber(row["Harga Jual"] ?? row.price)));
    const packagingCost = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Biaya Kemasan"] ?? row.packagingCost))
    );
    const isActive = parseActiveFlag(row["Status Aktif"] ?? row.isActive, true);
    const description = String(row["Deskripsi"] ?? row.description ?? "").trim() || undefined;

    // 1) Update by compound ID ("productId::variantId") or productId
    if (idSistem) {
      const [pid, vid] = idSistem.split("::");
      const existingProd = productById.get(pid);
      if (existingProd) {
        existingProd.name = rawName;
        existingProd.division = division;
        existingProd.category = category;
        existingProd.productGroup = productGroup;
        if (description !== undefined) existingProd.description = description;
        existingProd.updatedAt = nowIso;

        const targetVar =
          (vid ? existingProd.variants.find((v) => v.id === vid) : undefined) ||
          existingProd.variants.find(
            (v) => v.name.trim().toLowerCase() === variantName.toLowerCase()
          );

        if (targetVar) {
          targetVar.name = variantName;
          if (sku !== undefined) targetVar.sku = sku;
          targetVar.price = price;
          targetVar.packagingCost = packagingCost;
          targetVar.isAvailable = isActive;
          updatedVariants++;
        } else {
          const newVar: ProductVariant = {
            id: makeId("var"),
            productId: existingProd.id,
            name: variantName,
            sku,
            price,
            packagingCost,
            isAvailable: isActive,
          };
          existingProd.variants.push(newVar);
          addedVariants++;
        }
        dirtyProductIds.add(existingProd.id);
        continue;
      }
    }

    // 2) Match existing product by Division + Name
    const lookupKey = `${division}::${rawName.toLowerCase()}`;
    const matchedProd = productByDivAndName.get(lookupKey);
    if (matchedProd) {
      matchedProd.category = category || matchedProd.category;
      matchedProd.productGroup = productGroup || matchedProd.productGroup;
      if (description) matchedProd.description = description;
      matchedProd.updatedAt = nowIso;

      const existingVar = matchedProd.variants.find(
        (v) => v.name.trim().toLowerCase() === variantName.toLowerCase()
      );
      if (existingVar) {
        existingVar.price = price;
        existingVar.packagingCost = packagingCost;
        if (sku !== undefined) existingVar.sku = sku;
        existingVar.isAvailable = isActive;
        updatedVariants++;
      } else {
        matchedProd.variants.push({
          id: makeId("var"),
          productId: matchedProd.id,
          name: variantName,
          sku,
          price,
          packagingCost,
          isAvailable: isActive,
        });
        addedVariants++;
      }
      dirtyProductIds.add(matchedProd.id);
      continue;
    }

    // 3) Create new product (grouping multiple variants in the same import file)
    let draftProd = newProductsMap.get(lookupKey);
    if (!draftProd) {
      draftProd = {
        name: rawName,
        category,
        productGroup,
        division,
        description,
        isActive,
        variants: [],
        updatedAt: nowIso,
      };
      newProductsMap.set(lookupKey, draftProd);
    }

    const tempProdId = makeId("prod");
    const dupDraftVar = draftProd.variants.find(
      (v) => v.name.trim().toLowerCase() === variantName.toLowerCase()
    );
    if (dupDraftVar) {
      dupDraftVar.price = price;
      dupDraftVar.packagingCost = packagingCost;
      if (sku !== undefined) dupDraftVar.sku = sku;
      dupDraftVar.isAvailable = isActive;
    } else {
      draftProd.variants.push({
        id: makeId("var"),
        productId: tempProdId,
        name: variantName,
        sku,
        price,
        packagingCost,
        isAvailable: isActive,
      });
      addedVariants++;
    }
  }

  const productsToUpdate = Array.from(dirtyProductIds)
    .map((id) => productById.get(id)!)
    .filter(Boolean);

  return {
    productsToCreate: Array.from(newProductsMap.values()),
    productsToUpdate,
    addedVariants,
    updatedVariants,
    skipped,
  };
}

// ─── 2. Stok Opname (Lembar Hitung Fisik) ────────────────────────────────────

export interface OpnamePhysicalRowUpdate {
  ingredientId: string;
  physicalStock: number;
  difference: number;
  notes: string;
}

export function parseOpnamePhysicalSheetRows(
  rows: Record<string, any>[],
  ingredients: Ingredient[]
): { updates: OpnamePhysicalRowUpdate[]; skipped: number } {
  const ingById = new Map<string, Ingredient>();
  const ingByCode = new Map<string, Ingredient>();
  const ingByName = new Map<string, Ingredient>();

  for (const ing of ingredients || []) {
    ingById.set(ing.id, ing);
    if (ing.code) ingByCode.set(ing.code.trim().toLowerCase(), ing);
    if (ing.name) ingByName.set(ing.name.trim().toLowerCase(), ing);
  }

  const updatesByIngId = new Map<string, OpnamePhysicalRowUpdate>();
  let skipped = 0;

  for (const row of rows || []) {
    const idSistem = normalizeTextCode(row["ID_SISTEM (JANGAN DIUBAH)"] ?? row.id);
    const code = normalizeTextCode(row["Kode Bahan"] ?? row.code).toLowerCase();
    const name = String(row["Nama Bahan"] ?? row.name ?? "").trim().toLowerCase();

    const ing =
      (idSistem ? ingById.get(idSistem) : undefined) ||
      (code ? ingByCode.get(code) : undefined) ||
      (name ? ingByName.get(name) : undefined);

    if (!ing) {
      skipped++;
      continue;
    }

    const rawPhysical = row["Stok Fisik"] ?? row["Stok Fisik Nyata"] ?? row.physicalStock;
    if (rawPhysical === undefined || rawPhysical === null || String(rawPhysical).trim() === "") {
      // Baris yang tidak diisi angka fisiknya dilewati agar tidak menimpa stok jadi 0
      skipped++;
      continue;
    }

    const parsedQty = parseLocalizedNumber(rawPhysical);
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      skipped++;
      continue;
    }

    const physicalStock = Math.round(parsedQty * 1000) / 1000;
    const notes = String(row["Catatan"] ?? row.notes ?? "").trim();

    updatesByIngId.set(ing.id, {
      ingredientId: ing.id,
      physicalStock,
      difference: physicalStock - (Number(ing.currentStock) || 0),
      notes,
    });
  }

  return { updates: Array.from(updatesByIngId.values()), skipped };
}

// ─── 3. Rekap Omzet Harian ───────────────────────────────────────────────────

const VALID_RECAP_SHIFTS = new Set(["ALL", "PAGI", "SORE", "MALAM", "MIDDLE"]);

export function parseDailySalesRecapImportRows(
  rows: Record<string, any>[],
  options: {
    existingRecaps: DailySalesRecap[];
    closedPeriods: { period: string }[];
    defaultCashAccountId?: string | null;
    defaultBankAccountId?: string | null;
    recordedBy?: string;
  }
): {
  toCreate: Omit<DailySalesRecap, "id" | "createdAt">[];
  toUpdate: DailySalesRecap[];
  skipped: number;
  closedSkipped: number;
} {
  const closedSet = new Set((options.closedPeriods || []).map((p) => p.period));
  const recapById = new Map((options.existingRecaps || []).map((r) => [r.id, r]));
  const recapByDateShift = new Map<string, DailySalesRecap>();
  for (const r of options.existingRecaps || []) {
    const key = `${String(r.date).slice(0, 10)}::${(r.shift || "ALL").toUpperCase()}`;
    recapByDateShift.set(key, r);
  }

  const toCreate: Omit<DailySalesRecap, "id" | "createdAt">[] = [];
  const toUpdate: DailySalesRecap[] = [];
  let skipped = 0;
  let closedSkipped = 0;

  for (const row of rows || []) {
    const idSistem = normalizeTextCode(row["ID_SISTEM (JANGAN DIUBAH)"]);
    const date = parseFlexibleDateYmd(row["Tanggal"] ?? row.date);
    if (!date) {
      skipped++;
      continue;
    }

    const rowPeriod = getLocalPeriodFromTimestamp(date);
    if (rowPeriod && closedSet.has(rowPeriod)) {
      closedSkipped++;
      continue;
    }

    const rawShift = String(row["Shift"] ?? row.shift ?? "ALL")
      .trim()
      .toUpperCase();
    const shift = (VALID_RECAP_SHIFTS.has(rawShift) ? rawShift : "ALL") as NonNullable<
      DailySalesRecap["shift"]
    >;

    const cashAmount = Math.max(0, Math.round(parseLocalizedNumber(row["Tunai"] ?? row.cashAmount)));
    const qrisAmount = Math.max(0, Math.round(parseLocalizedNumber(row["QRIS"] ?? row.qrisAmount)));
    const edcAmount = Math.max(0, Math.round(parseLocalizedNumber(row["EDC / Kartu"] ?? row.edcAmount)));
    const transferAmount = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Transfer Bank"] ?? row.transferAmount))
    );
    const onlineDeliveryAmount = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Online Delivery"] ?? row.onlineDeliveryAmount))
    );
    const discountAmount = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Diskon"] ?? row.discountAmount))
    );
    const refundAmount = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Refund"] ?? row.refundAmount))
    );
    const mdrFeeAmount = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Biaya MDR"] ?? row.mdrFeeAmount))
    );

    const totalAmount =
      cashAmount + qrisAmount + edcAmount + transferAmount + onlineDeliveryAmount;
    if (totalAmount <= 0) {
      skipped++;
      continue;
    }

    const notes = String(row["Catatan"] ?? row.notes ?? "").trim() || undefined;
    const existing =
      (idSistem ? recapById.get(idSistem) : undefined) ||
      recapByDateShift.get(`${date}::${shift}`);

    if (existing) {
      const origPeriod = getLocalPeriodFromTimestamp(existing.date);
      if (origPeriod && closedSet.has(origPeriod)) {
        closedSkipped++;
        continue;
      }
      toUpdate.push({
        ...existing,
        date,
        shift,
        cashAmount,
        qrisAmount,
        edcAmount,
        transferAmount,
        onlineDeliveryAmount,
        discountAmount,
        refundAmount,
        mdrFeeAmount,
        totalAmount,
        notes: notes ?? existing.notes,
      });
    } else {
      toCreate.push({
        date,
        shift,
        cashAmount,
        qrisAmount,
        edcAmount,
        transferAmount,
        onlineDeliveryAmount,
        discountAmount,
        refundAmount,
        mdrFeeAmount,
        totalAmount,
        cashAccountId: options.defaultCashAccountId ?? null,
        bankAccountId: options.defaultBankAccountId ?? null,
        nonCashSettlementStatus: "SETTLED",
        nonCashSettledAt: date,
        notes,
        recordedBy: options.recordedBy || "Impor Excel",
      });
    }
  }

  return { toCreate, toUpdate, skipped, closedSkipped };
}

// ─── 4. Purchase Order (PO) Import Grouping ──────────────────────────────────

export function groupImportedPurchaseOrders(
  rows: Record<string, any>[],
  suppliers: Supplier[],
  ingredients: Ingredient[],
  options: {
    existingPurchaseOrders: PurchaseOrder[];
    closedPeriods: { period: string }[];
  }
): {
  ordersToCreate: Omit<PurchaseOrder, "id">[];
  skipped: number;
  duplicatePoCount: number;
  closedSkipped: number;
} {
  const closedSet = new Set((options.closedPeriods || []).map((p) => p.period));
  const existingPoNumbers = new Set(
    (options.existingPurchaseOrders || []).map((p) =>
      String(p.poNumber || "").trim().toUpperCase()
    )
  );

  const supplierByName = new Map<string, Supplier>();
  for (const s of suppliers || []) {
    if (s.name) supplierByName.set(s.name.trim().toLowerCase(), s);
  }

  const ingByName = new Map<string, Ingredient>();
  const ingByCode = new Map<string, Ingredient>();
  for (const ing of ingredients || []) {
    if (ing.name) ingByName.set(ing.name.trim().toLowerCase(), ing);
    if (ing.code) ingByCode.set(ing.code.trim().toLowerCase(), ing);
  }

  const grouped = new Map<
    string,
    {
      poNumber: string;
      dateYmd: string;
      supplier: Supplier;
      dueDate?: string;
      notes?: string;
      items: PurchaseOrderItem[];
    }
  >();

  let skipped = 0;
  let duplicatePoCount = 0;
  let closedSkipped = 0;
  let autoSeq = 1;

  for (const row of rows || []) {
    const dateYmd =
      parseFlexibleDateYmd(row["Tanggal"] ?? row.date) ||
      getLocalDateString(new Date(), DEFAULT_STORE_TIMEZONE);
    const period = dateYmd.slice(0, 7);
    if (closedSet.has(period)) {
      closedSkipped++;
      continue;
    }

    const rawSupplier = String(row["Supplier"] ?? row.supplier ?? "").trim();
    const supplier = supplierByName.get(rawSupplier.toLowerCase());
    if (!supplier) {
      skipped++;
      continue;
    }

    const rawIng = String(row["Nama Bahan"] ?? row.ingredientName ?? "").trim();
    const ing =
      ingByName.get(rawIng.toLowerCase()) || ingByCode.get(rawIng.toLowerCase());
    if (!ing) {
      skipped++;
      continue;
    }

    const qty = parseLocalizedNumber(row["Jumlah Beli"] ?? row.quantity);
    const unitPrice = Math.max(
      0,
      Math.round(parseLocalizedNumber(row["Harga Satuan"] ?? row.unitPrice))
    );
    if (!(qty > 0)) {
      skipped++;
      continue;
    }

    let poNumber = normalizeTextCode(row["No. PO"] ?? row.poNumber).toUpperCase();
    if (!poNumber) {
      poNumber = `PO-${period.replace("-", "")}-IMP${String(autoSeq++).padStart(3, "0")}`;
    }

    if (existingPoNumbers.has(poNumber)) {
      duplicatePoCount++;
      continue;
    }

    const dueDate =
      parseFlexibleDateYmd(row["Jatuh Tempo"] ?? row.dueDate) ||
      addDaysToLocalDate(dateYmd, 14);
    const unit =
      String(row["Satuan"] ?? row.unit ?? "").trim() ||
      ing.purchaseUnit ||
      ing.unit;
    const notes = String(row["Catatan"] ?? row.notes ?? "").trim() || undefined;
    const subtotal = Math.round(qty * unitPrice);

    const groupKey = poNumber;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        poNumber,
        dateYmd,
        supplier,
        dueDate,
        notes,
        items: [],
      });
    }

    grouped.get(groupKey)!.items.push({
      productId: ing.id,
      quantity: qty,
      unit,
      unitPrice,
      subtotal,
    });
  }

  const ordersToCreate: Omit<PurchaseOrder, "id">[] = [];
  for (const g of grouped.values()) {
    if (g.items.length === 0) continue;
    const totalAmount = Math.round(
      g.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)
    );
    ordersToCreate.push({
      poNumber: g.poNumber,
      supplierId: g.supplier.id,
      supplierName: g.supplier.name,
      purchaseType: "DISTRIBUTOR",
      date: new Date(`${g.dateYmd}T12:00:00+08:00`).toISOString(),
      items: g.items,
      totalAmount,
      status: "UNPAID",
      deliveryStatus: "PENDING",
      paymentMethod: "TEMPO",
      dueDate: g.dueDate,
      amountPaid: 0,
    });
  }

  return { ordersToCreate, skipped, duplicatePoCount, closedSkipped };
}

// ─── 5. Resep Produk (BOM) ───────────────────────────────────────────────────

export function buildRecipeImportPlan(
  rows: Record<string, any>[],
  ingredients: Ingredient[],
  existingRecipes: Recipe[]
): {
  toCreate: Omit<Recipe, "id">[];
  toUpdate: Recipe[];
  skipped: number;
} {
  const ingByName = new Map<string, Ingredient>();
  const ingByCode = new Map<string, Ingredient>();
  for (const ing of ingredients || []) {
    if (ing.name) ingByName.set(ing.name.trim().toLowerCase(), ing);
    if (ing.code) ingByCode.set(ing.code.trim().toLowerCase(), ing);
  }

  const existingByMenu = new Map<string, Recipe>();
  for (const r of existingRecipes || []) {
    if (r.menuName) existingByMenu.set(r.menuName.trim().toLowerCase(), r);
  }

  const grouped = new Map<string, { menuName: string; items: RecipeIngredient[] }>();
  let skipped = 0;

  for (const row of rows || []) {
    const menuName = String(
      row["Nama Menu / Varian"] ?? row["Nama Menu"] ?? row.menuName ?? ""
    ).trim();
    const rawIng = String(
      row["Nama Bahan Baku"] ?? row["Nama Bahan"] ?? row.ingredientName ?? ""
    ).trim();
    const qty = parseLocalizedNumber(row["Takaran"] ?? row.quantity);

    if (!menuName || !rawIng || !(qty > 0)) {
      skipped++;
      continue;
    }

    const ing =
      ingByName.get(rawIng.toLowerCase()) || ingByCode.get(rawIng.toLowerCase());
    if (!ing) {
      skipped++;
      continue;
    }

    const key = menuName.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, { menuName, items: [] });
    }
    grouped.get(key)!.items.push({
      ingredientId: ing.id,
      quantity: qty,
    });
  }

  const toCreate: Omit<Recipe, "id">[] = [];
  const toUpdate: Recipe[] = [];

  for (const [key, g] of grouped.entries()) {
    const merged = mergeDuplicateRecipeIngredients(g.items);
    if (merged.length === 0) continue;

    const existing = existingByMenu.get(key);
    if (existing) {
      toUpdate.push({
        ...existing,
        ingredients: merged,
      });
    } else {
      toCreate.push({
        menuName: g.menuName,
        ingredients: merged,
      });
    }
  }

  return { toCreate, toUpdate, skipped };
}
