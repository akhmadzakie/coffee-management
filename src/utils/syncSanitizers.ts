/**
 * Pure data sanitizers and RBAC payload filters shared between server sync
 * endpoints and automated tests so DB persistence and client formatting stay aligned.
 */
import {
  DEFAULT_STORE_TIMEZONE,
  getLocalDateString,
  getLocalPeriodString,
} from "./dateUtils";
import {
  isNonOperationalCashTransaction,
  isSalesCashTransaction,
} from "./financeMetrics";
import type {
  Budget,
  CashTransaction,
  ClosedPeriod,
  ExpenseCategory,
  ExpenseCategoryType,
  PayrollRecord,
  Product,
  Promotion,
  PromotionType,
  SalesTransaction,
} from "../types";

export function sanitizeIngredientRecord(i: any, fallbackId: string) {
  const convRaw = i?.conversionFactor;
  const convNum = convRaw !== null && convRaw !== undefined && convRaw !== "" ? Number(convRaw) : NaN;
  const purchasePriceRaw = i?.purchasePrice;
  const purchasePriceNum =
    purchasePriceRaw !== null && purchasePriceRaw !== undefined && purchasePriceRaw !== ""
      ? Number(purchasePriceRaw)
      : NaN;
  const bulkConvRaw = i?.bulkConversionFactor;
  const bulkConvNum =
    bulkConvRaw !== null && bulkConvRaw !== undefined && bulkConvRaw !== "" ? Number(bulkConvRaw) : NaN;
  const bulkPriceRaw = i?.bulkPrice;
  const bulkPriceNum =
    bulkPriceRaw !== null && bulkPriceRaw !== undefined && bulkPriceRaw !== "" ? Number(bulkPriceRaw) : NaN;

  return {
    id: String(i?.id || fallbackId),
    code: i?.code ? String(i.code).trim() : null,
    name: String(i?.name || ""),
    unit: String(i?.unit || "pcs"),
    currentStock: Number(i?.currentStock) || 0,
    minStock: Number(i?.minStock) || 0,
    category: String(i?.category || ""),
    costPerUnit: Number(i?.costPerUnit) || 0,
    purchaseUnit: i?.purchaseUnit ? String(i.purchaseUnit).trim() : null,
    conversionFactor: Number.isFinite(convNum) && convNum > 0 ? convNum : null,
    purchasePrice: Number.isFinite(purchasePriceNum) && purchasePriceNum >= 0 ? purchasePriceNum : null,
    bulkUnit: i?.bulkUnit ? String(i.bulkUnit).trim() : null,
    bulkConversionFactor: Number.isFinite(bulkConvNum) && bulkConvNum > 0 ? bulkConvNum : null,
    bulkPrice: Number.isFinite(bulkPriceNum) && bulkPriceNum >= 0 ? bulkPriceNum : null,
    storageLocation: i?.storageLocation ? String(i.storageLocation).trim() : null,
    notes: i?.notes ? String(i.notes) : null,
  };
}

export function sanitizeEmployeeRecord(e: any, fallbackId: string) {
  return {
    id: String(e?.id || fallbackId),
    username: String(e?.username || ""),
    name: String(e?.name || ""),
    position: String(e?.position || ""),
    department: String(e?.department || ""),
    employmentType: String(e?.employmentType || ""),
    startDate: String(e?.startDate || ""),
    endDate: e?.endDate ? String(e.endDate) : null,
    phone: String(e?.phone || ""),
    email: e?.email ? String(e.email).trim() : null,
    address: String(e?.address || ""),
    status: String(e?.status || ""),
    createdAt: String(e?.createdAt || new Date().toISOString()),
  };
}

export function sanitizeEmployeeContractRecord(c: any, fallbackId: string) {
  const startDate = String(c?.startDate || c?.effectiveDate || "");
  const effectiveDate = String(c?.effectiveDate || c?.startDate || "");
  return {
    id: String(c?.id || fallbackId),
    employeeId: String(c?.employeeId || ""),
    effectiveDate,
    startDate,
    endDate: c?.endDate ? String(c.endDate) : null,
    status: c?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    basicSalary: Math.round(Math.max(0, Number(c?.basicSalary) || 0)),
    mealAllowance: Math.round(Math.max(0, Number(c?.mealAllowance) || 0)),
    positionAllowance: Math.round(Math.max(0, Number(c?.positionAllowance) || 0)),
    transportAllowance: Math.round(Math.max(0, Number(c?.transportAllowance) || 0)),
    alphaDeductionPerDay: Math.round(Math.max(0, Number(c?.alphaDeductionPerDay) || 0)),
    kpiBonusTarget: Math.round(Math.max(0, Number(c?.kpiBonusTarget) || 0)),
    workingDaysPerMonth: Math.round(Math.max(0, Number(c?.workingDaysPerMonth) || 0)),
    notes: String(c?.notes || ""),
  };
}

export function formatContractForClient(c: any) {
  const startDate = String(c?.startDate || c?.effectiveDate || "");
  const effectiveDate = String(c?.effectiveDate || c?.startDate || "");
  return {
    ...c,
    startDate,
    effectiveDate,
    endDate: c?.endDate ? String(c.endDate) : null,
    status: c?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    transportAllowance: Math.round(Math.max(0, Number(c?.transportAllowance) || 0)),
    alphaDeductionPerDay: Math.round(Math.max(0, Number(c?.alphaDeductionPerDay) || 0)),
    kpiBonusTarget: Math.round(Math.max(0, Number(c?.kpiBonusTarget) || 0)),
  };
}

export function sanitizePayrollRecordData(p: any, fallbackId: string) {
  let matchedTier = null;
  if (p?.matchedLeaderTier && typeof p.matchedLeaderTier === "object") {
    matchedTier = p.matchedLeaderTier;
  } else if (typeof p?.matchedLeaderTier === "string" && p.matchedLeaderTier.trim()) {
    try {
      const parsed = JSON.parse(p.matchedLeaderTier);
      if (parsed && typeof parsed === "object") matchedTier = parsed;
    } catch {
      matchedTier = null;
    }
  }

  return {
    id: String(p?.id || fallbackId),
    employeeId: String(p?.employeeId || ""),
    period: String(p?.period || ""),
    basicSalary: Math.round(Math.max(0, Number(p?.basicSalary) || 0)),
    mealAllowance: Math.round(Math.max(0, Number(p?.mealAllowance) || 0)),
    positionAllowance: Math.round(Math.max(0, Number(p?.positionAllowance) || 0)),
    rawPositionAllowance:
      p?.rawPositionAllowance != null ? Math.round(Math.max(0, Number(p.rawPositionAllowance) || 0)) : 0,
    leaderJobdeskScore:
      p?.leaderJobdeskScore != null ? Math.max(0, Number(p.leaderJobdeskScore) || 0) : 0,
    matchedLeaderTier: matchedTier,
    transportAllowance: Math.round(Math.max(0, Number(p?.transportAllowance) || 0)),
    kpiBonus: Math.round(Math.max(0, Number(p?.kpiBonus) || 0)),
    targetBonus: Math.round(Math.max(0, Number(p?.targetBonus) || 0)),
    alphaDeduction: Math.round(Math.max(0, Number(p?.alphaDeduction) || 0)),
    lateDeduction: Math.round(Math.max(0, Number(p?.lateDeduction) || 0)),
    lateHours: Math.round(Math.max(0, Number(p?.lateHours) || 0) * 10) / 10,
    lateDays: Math.round(Math.max(0, Number(p?.lateDays) || 0)),
    overtimePay: Math.round(Math.max(0, Number(p?.overtimePay) || 0)),
    overtimeHours: Math.round(Math.max(0, Number(p?.overtimeHours) || 0) * 10) / 10,
    overtimeRate: Math.round(Math.max(0, Number(p?.overtimeRate) || 0)),
    overtimeApproved: Boolean(p?.overtimeApproved),
    otherDeductions: Math.round(Math.max(0, Number(p?.otherDeductions) || 0)),
    grossPay: Math.round(Math.max(0, Number(p?.grossPay) || 0)),
    netPay: Math.round(Math.max(0, Number(p?.netPay) || 0)),
    status: String(p?.status || "DRAFT"),
    approvedBy: p?.approvedBy ? String(p.approvedBy) : null,
    approvedAt: p?.approvedAt ? String(p.approvedAt) : null,
    paidDate: p?.paidDate ? String(p.paidDate) : null,
    paidVia: p?.paidVia ? String(p.paidVia) : null,
    notes: p?.notes ? String(p.notes) : null,
    createdBy: String(p?.createdBy || "System"),
    createdAt: String(p?.createdAt || new Date().toISOString()),
  };
}

export function sanitizePurchaseOrderRecord(p: any, fallbackId: string) {
  return {
    id: String(p?.id || fallbackId),
    poNumber: String(p?.poNumber || ""),
    supplierId: String(p?.supplierId || ""),
    supplierName: p?.supplierName ? String(p.supplierName) : null,
    purchaseType: p?.purchaseType === "MARKET" ? "MARKET" : "DISTRIBUTOR",
    cashAccountId: p?.cashAccountId ? String(p.cashAccountId) : null,
    notes: p?.notes ? String(p.notes) : null,
    date: String(p?.date || new Date().toISOString()),
    items: Array.isArray(p?.items) ? p.items : [],
    totalAmount: Number(p?.totalAmount) || 0,
    status: String(p?.status || "UNPAID"),
    deliveryStatus: String(p?.deliveryStatus || "PENDING"),
    paymentMethod: String(p?.paymentMethod || "CASH"),
    dueDate: p?.dueDate ? String(p.dueDate) : null,
    amountPaid: Number(p?.amountPaid) || 0,
  };
}

function parseKpiTargets(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function sanitizeKPIRecordData(k: any, fallbackId: string) {
  const now = new Date();
  let parsedYear = Number(k?.year);
  let parsedMonth = Number(k?.month);

  if (typeof k?.period === "string" && /^\d{4}-\d{2}/.test(k.period.trim())) {
    const [yStr, mStr] = k.period.trim().split("-");
    if (!Number.isFinite(parsedYear) || parsedYear <= 0) parsedYear = Number(yStr);
    if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      parsedMonth = Number(mStr);
    }
  }

  const rawQuarter = Number(k?.quarter);
  if (
    (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) &&
    Number.isFinite(rawQuarter) &&
    rawQuarter >= 1 &&
    rawQuarter <= 4
  ) {
    parsedMonth = (rawQuarter - 1) * 3 + 1;
  }

  if (!Number.isFinite(parsedYear) || parsedYear <= 0) parsedYear = now.getFullYear();
  if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    parsedMonth = now.getMonth() + 1;
  }

  const month = Math.round(parsedMonth);
  const year = Math.round(parsedYear);
  const quarter =
    Number.isFinite(rawQuarter) && rawQuarter >= 1 && rawQuarter <= 4
      ? Math.round(rawQuarter)
      : Math.ceil(month / 3);
  const period = k?.period
    ? String(k.period)
    : `${year}-${String(month).padStart(2, "0")}`;

  return {
    id: String(k?.id || fallbackId),
    employeeId: String(k?.employeeId || ""),
    quarter,
    month,
    year,
    period,
    targets: parseKpiTargets(k?.targets),
    totalScore: Number(k?.totalScore ?? k?.score) || 0,
    kpiBonus: Number(k?.kpiBonus) || 0,
    notes: String(k?.notes || ""),
    evaluatedBy: String(k?.evaluatedBy || ""),
    createdAt: String(k?.createdAt || new Date().toISOString()),
  };
}

export function formatKpiRecordForClient(k: any) {
  const normalized = sanitizeKPIRecordData(k, String(k?.id || ""));
  return {
    ...k,
    ...normalized,
  };
}

export function sanitizeKpiTaskRecord(t: any, fallbackId: string) {
  return {
    id: String(t?.id || fallbackId),
    employeeId: String(t?.employeeId || ""),
    period: String(t?.period || ""),
    taskName: String(t?.taskName || t?.name || ""),
    weight: Number(t?.weight) || 0,
    target: Number(t?.target) || 0,
    realization: Number(t?.realization) || 0,
    score: Number(t?.score) || 0,
    notes: t?.notes ? String(t.notes) : null,
    createdAt: String(t?.createdAt || new Date().toISOString()),
  };
}

export function sanitizeKpiBonusRuleRecord(r: any, fallbackId: string) {
  return {
    id: String(r?.id || fallbackId),
    minScore: Number(r?.minScore) || 0,
    maxScore: Number(r?.maxScore) || 0,
    bonusAmount: Number(r?.bonusAmount) || 0,
    isActive: r?.isActive !== undefined ? Boolean(r.isActive) : true,
  };
}

const KASIR_STRIP_KEYS = [
  "users",
  "settings",
  "daily_sales_recaps",
  "payroll_records",
  "budgets",
  "bank_reconciliations",
  "bank_statement_lines",
  "closed_periods",
  "expense_categories",
  "cash_accounts",
  "cash_transactions",
  "promotions",
  "employees",
  "contracts",
  "kpiRecords",
  "kpiTasks",
  "kpiBonusRules",
  "suppliers",
  "purchase_orders",
  "ingredients",
  "recipes",
  "products",
  "batch_preparations",
  "stock_opnames",
  "stock_opname_items",
] as const;

const FINANCE_STRIP_KEYS = [
  "users",
  "recipes",
  "products",
  "batch_preparations",
  "promotions",
] as const;

const LEADER_STRIP_KEYS = [
  "users",
  "settings",
  "daily_sales_recaps",
  "payroll_records",
  "budgets",
  "bank_reconciliations",
  "bank_statement_lines",
  "closed_periods",
  "expense_categories",
  "cash_accounts",
  "promotions",
  "employees",
  "contracts",
  "kpiRecords",
  "kpiTasks",
  "kpiBonusRules",
] as const;

const FLOOR_STAFF_STRIP_KEYS = [
  "users",
  "settings",
  "daily_sales_recaps",
  "payroll_records",
  "budgets",
  "bank_reconciliations",
  "bank_statement_lines",
  "closed_periods",
  "expense_categories",
  "cash_accounts",
  "cash_transactions",
  "promotions",
  "employees",
  "contracts",
  "suppliers",
  "purchase_orders",
  "kpiRecords",
  "kpiTasks",
  "kpiBonusRules",
  "ingredients",
  "recipes",
  "products",
  "batch_preparations",
  "stock_opnames",
  "stock_opname_items",
] as const;

/** Filters incoming `/api/sync` table keys according to caller role. */
export function applyRoleSyncRestrictions(
  role: string,
  body: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = { ...(body || {}) };
  const normalizedRole = String(role || "").toUpperCase();

  // Sesi perangkat tidak pernah boleh dibuat atau ditimpa lewat payload /api/sync
  result.device_sessions = undefined;

  let stripKeys: readonly string[] = FLOOR_STAFF_STRIP_KEYS;
  if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "MANAGER") {
    stripKeys = [];
  } else if (normalizedRole === "KASIR") {
    stripKeys = KASIR_STRIP_KEYS;
  } else if (normalizedRole === "FINANCE") {
    stripKeys = FINANCE_STRIP_KEYS;
  } else if (normalizedRole === "LEADER") {
    stripKeys = LEADER_STRIP_KEYS;
  } else if (["BAR", "BARISTA", "KITCHEN", "BAKER"].includes(normalizedRole)) {
    stripKeys = FLOOR_STAFF_STRIP_KEYS;
  }

  for (const key of stripKeys) {
    result[key] = undefined;
  }
  return result;
}

/** Memfilter daftar device sessions sesuai role login agar staf biasa hanya melihat sesinya sendiri. */
export function filterVisibleSessionsForUser(
  sessions: any[],
  authUser: { id: string; role: string }
): any[] {
  const role = String(authUser?.role || "").toUpperCase();
  if (role === "SUPER_ADMIN" || role === "MANAGER") {
    return sessions || [];
  }
  const userId = String(authUser?.id || "");
  return (sessions || []).filter((s) => String(s?.userId || "") === userId);
}

/** Menentukan apakah caller berhak memutus sesi target (Super Admin/Manager bebas; role lain hanya sesi miliknya). */
export function canRevokeTargetSession(
  authUser: { id: string; role: string },
  targetSession: { userId?: string | null }
): boolean {
  const role = String(authUser?.role || "").toUpperCase();
  if (role === "SUPER_ADMIN" || role === "MANAGER") {
    return true;
  }
  return Boolean(
    authUser?.id &&
      targetSession?.userId &&
      String(targetSession.userId) === String(authUser.id)
  );
}

/** Memilih sesi aktif selain currentSessionId untuk aksi "Keluarkan Semua Perangkat Lain" sesuai otoritas caller. */
export function selectSessionsToRevokeOthers(
  sessions: any[],
  authUser: { id: string; role: string },
  currentSessionId: string
): any[] {
  const role = String(authUser?.role || "").toUpperCase();
  const isPrivileged = role === "SUPER_ADMIN" || role === "MANAGER";
  const curId = String(currentSessionId || "");
  const uid = String(authUser?.id || "");

  return (sessions || []).filter((s) => {
    if (!s || s.status !== "ACTIVE") return false;
    if (curId && String(s.id) === curId) return false;
    if (isPrivileged) return true;
    return String(s.userId || "") === uid;
  });
}

/** Mengamankan penyimpanan Gemini API Key: hanya SUPER_ADMIN yang boleh mengubah nilai key (non-masked). */
export function resolveGeminiApiKeyForSave(params: {
  role: string;
  incomingKey: unknown;
  existingKey?: string | null;
  envKey?: string | null;
}): string | null {
  const { role, incomingKey, existingKey, envKey } = params;
  const fallback = existingKey ?? envKey ?? null;
  if (String(role || "").toUpperCase() !== "SUPER_ADMIN") {
    return fallback;
  }
  const isMasked = typeof incomingKey === "string" && incomingKey.startsWith("••");
  if (incomingKey !== undefined && !isMasked) {
    const trimmed = typeof incomingKey === "string" ? incomingKey.trim() : incomingKey;
    return trimmed ? String(trimmed) : envKey ?? null;
  }
  return fallback;
}

/** Menghapus duplikat resep berdasarkan nama menu (case-insensitive) dengan menyimpan entri terbaru. */
export function dedupeRecipesByMenuName<T extends { menuName?: string | null }>(recipes: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of recipes || []) {
    const key = String(r?.menuName || "").trim().toLowerCase();
    if (!key) continue;
    if (map.has(key)) {
      map.delete(key);
    }
    map.set(key, r);
  }
  return Array.from(map.values());
}

/** Menghitung ulang selisih opname dan nilai penyesuaian terhadap stok sistem terkini. */
export function recomputeOpnameItemsWithLiveStock(
  items: { ingredientId: string; physicalStock: number; difference?: number; notes?: string | null }[],
  liveIngredients: { id: string; currentStock: number; costPerUnit?: number }[]
): {
  ingredientId: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  unitCost: number;
  adjustmentTotalCost: number;
  notes: string;
}[] {
  return (items || []).map((item) => {
    const ing = (liveIngredients || []).find((i) => i.id === item.ingredientId);
    const systemStock = ing ? Number(ing.currentStock) || 0 : 0;
    const physicalStock = Math.max(0, Number(item.physicalStock) || 0);
    const difference = physicalStock - systemStock;
    const unitCost = Number(ing?.costPerUnit) || 0;
    const adjustmentTotalCost = Math.round(Math.abs(difference) * unitCost);
    return {
      ingredientId: item.ingredientId,
      systemStock,
      physicalStock,
      difference,
      unitCost,
      adjustmentTotalCost,
      notes: item.notes || "",
    };
  });
}

/** Menghitung kuantitas aktual dalam satuan resep dan total biaya integer Rupiah untuk mutasi stok. */
export function computeMovementActualQuantityAndCost(params: {
  quantity: number;
  unitMode: "BASE" | "PURCHASE";
  hasConversion: boolean;
  conversionFactor?: number;
  costPerUnit?: number;
}): { actualQuantity: number; factor: number; unitCost: number; totalCost: number } {
  const qty = Math.max(0, Number(params.quantity) || 0);
  const rawFactor = Number(params.conversionFactor);
  const factor =
    params.hasConversion && params.unitMode === "PURCHASE" && rawFactor > 0 ? rawFactor : 1;
  const actualQuantity = qty * factor;
  const unitCost = Math.max(0, Number(params.costPerUnit) || 0);
  const totalCost = Math.round(actualQuantity * unitCost);
  return { actualQuantity, factor, unitCost, totalCost };
}

/** Mengonversi nilai input stok ketika pengguna mengganti toggle satuan Dasar <-> Kemasan Beli. */
export function convertStockInputOnUnitToggle(params: {
  currentValue: number;
  fromUnit: "BASE" | "PURCHASE";
  toUnit: "BASE" | "PURCHASE";
  conversionFactor: number;
}): number {
  const safeVal = Math.max(0, Number(params.currentValue) || 0);
  if (params.fromUnit === params.toUnit || !(params.conversionFactor > 0)) {
    return safeVal;
  }
  if (params.fromUnit === "BASE" && params.toUnit === "PURCHASE") {
    return Math.round((safeVal / params.conversionFactor) * 1000) / 1000;
  }
  return Math.round(safeVal * params.conversionFactor);
}

/** Memvalidasi data resep sebelum simpan agar nama menu dan komposisi bahan tidak duplikat. */
export function validateRecipeSubmission(params: {
  menuName: string;
  ingredients: { ingredientId: string; quantity: number }[];
  existingRecipes?: { id: string; menuName: string }[];
  editingRecipeId?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const trimmedName = String(params.menuName || "").trim();
  if (!trimmedName) {
    return { ok: false, error: "Nama menu tidak boleh kosong." };
  }
  const hasDuplicateMenu = (params.existingRecipes || []).some(
    (r) =>
      r.id !== params.editingRecipeId &&
      String(r.menuName || "").trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (hasDuplicateMenu) {
    return {
      ok: false,
      error: `Resep untuk menu "${trimmedName}" sudah terdaftar. Edit resep yang ada agar tidak duplikat.`,
    };
  }
  if (!params.ingredients || params.ingredients.length === 0) {
    return { ok: false, error: "Minimal 1 bahan baku harus ditambahkan." };
  }
  if (params.ingredients.some((ri) => !ri.ingredientId || !(Number(ri.quantity) > 0))) {
    return {
      ok: false,
      error: "Harap lengkapi semua bahan baku dan takarannya (jumlah > 0).",
    };
  }
  const seenIngredients = new Set<string>();
  for (const ri of params.ingredients) {
    if (seenIngredients.has(ri.ingredientId)) {
      return {
        ok: false,
        error:
          "Bahan baku yang sama dipilih lebih dari sekali dalam satu resep. Gabungkan takarannya menjadi satu baris.",
      };
    }
    seenIngredients.add(ri.ingredientId);
  }
  return { ok: true };
}

/** Menentukan stasiun transfer default yang cocok dengan dropdown stasiun tujuan. */
export function resolveDefaultTransferStation(params: {
  ingredientStorageLocation?: string | null;
  userDivision: "ALL" | "BAR" | "KITCHEN" | "BAKER";
}): "BAR" | "CHILLER" | "KITCHEN" | "BAKERY" | "OPERATIONAL" {
  const validStations = ["BAR", "CHILLER", "KITCHEN", "BAKERY", "OPERATIONAL"] as const;
  const upperLoc = String(params.ingredientStorageLocation || "").trim().toUpperCase();
  if ((validStations as readonly string[]).includes(upperLoc)) {
    return upperLoc as "BAR" | "CHILLER" | "KITCHEN" | "BAKERY" | "OPERATIONAL";
  }
  if (params.userDivision === "BAKER") return "BAKERY";
  if (params.userDivision === "KITCHEN") return "KITCHEN";
  return "BAR";
}

/** Memetakan divisi produk/batch prep ke kode storageLocation inventori yang sesuai. */
export function resolveDivisionStorageLocation(
  division?: string | null
): "BAR" | "KITCHEN" | "BAKERY" {
  const upper = String(division || "").trim().toUpperCase();
  if (upper === "KITCHEN") return "KITCHEN";
  if (upper === "BAKER" || upper === "BAKERY") return "BAKERY";
  return "BAR";
}

/** Menggabungkan baris bahan baku dengan ingredientId yang sama agar tidak terhitung ganda. */
export function mergeDuplicateRecipeIngredients(
  items: { ingredientId: string; quantity: number }[]
): { ingredientId: string; quantity: number }[] {
  const map = new Map<string, number>();
  for (const item of items || []) {
    const id = String(item?.ingredientId || "").trim();
    const qty = Number(item?.quantity) || 0;
    if (!id || !(qty > 0)) continue;
    const prev = map.get(id) || 0;
    map.set(id, Number((prev + qty).toFixed(4)));
  }
  return Array.from(map.entries()).map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity,
  }));
}

/** Mengurai daftar bahan resep secara aman dari array atau string JSON. */
export function parseRecipeIngredientsSafe(
  raw: unknown
): { ingredientId: string; quantity: number }[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map((x: any) => ({
    ingredientId: String(x?.ingredientId || ""),
    quantity: Number(x?.quantity) || 0,
  }));
}

/** Memisahkan bahan baku resep (non-kemasan) dari item kemasan stok agar tidak dihitung 2x di Kalkulator HPP. */
export function splitRecipeItemsAndPackaging<
  T extends { id: string; name: string; unit: string; costPerUnit?: number; category: string }
>(params: {
  rawRecipe: unknown;
  ingredients: T[];
  isPackagingCheck: (ing: T) => boolean;
}): {
  materialItems: {
    ingredientId: string;
    name: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
  }[];
  packagingIngredientIds: string[];
} {
  const parsed = mergeDuplicateRecipeIngredients(
    parseRecipeIngredientsSafe(params.rawRecipe)
  );
  const materialItems: {
    ingredientId: string;
    name: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
  }[] = [];
  const packagingIngredientIds: string[] = [];

  for (const ri of parsed) {
    const ing = (params.ingredients || []).find((i) => i.id === ri.ingredientId);
    if (ing && params.isPackagingCheck(ing)) {
      if (!packagingIngredientIds.includes(ing.id)) {
        packagingIngredientIds.push(ing.id);
      }
    } else {
      materialItems.push({
        ingredientId: ri.ingredientId,
        name: ing ? ing.name : "Bahan Terhapus",
        quantity: ri.quantity,
        unit: ing ? ing.unit : "satuan",
        costPerUnit: ing ? Number(ing.costPerUnit || 0) : 0,
      });
    }
  }

  return { materialItems, packagingIngredientIds };
}

/** Menghitung laba kotor & margin bertanda (signed) agar kondisi rugi saat HPP > harga jual tetap terlihat. */
export function computeSignedMarginMetrics(
  sellingPrice: number,
  totalHpp: number
): {
  grossProfit: number;
  grossMarginPercent: number;
  foodCostPercent: number;
  isLoss: boolean;
} {
  const price = Math.max(0, Number(sellingPrice) || 0);
  const hpp = Math.max(0, Number(totalHpp) || 0);
  const grossProfit = Math.round(price - hpp);
  const grossMarginPercent = price > 0 ? (grossProfit / price) * 100 : 0;
  const foodCostPercent = price > 0 && hpp > 0 ? (hpp / price) * 100 : 0;
  const isLoss = price > 0 && grossProfit < 0;
  return { grossProfit, grossMarginPercent, foodCostPercent, isLoss };
}

/** Menghitung ulang HPP & biaya kemasan varian dari daftar bahan baku serta kemasan stok terbaru. */
export function recalculateVariantFromLiveIngredients<
  T extends { id: string; costPerUnit?: number; category: string; name: string }
>(params: {
  variant: any;
  fallbackRecipe?: unknown;
  ingredients: T[];
  isPackagingCheck: (ing: T) => boolean;
}): { changed: boolean; updatedVariant: any } {
  const { variant, fallbackRecipe, ingredients, isPackagingCheck } = params;
  const parsedOwn = parseRecipeIngredientsSafe(variant?.recipe);
  const effectiveRecipe =
    parsedOwn.length > 0 ? parsedOwn : parseRecipeIngredientsSafe(fallbackRecipe);

  if (effectiveRecipe.length === 0) {
    return { changed: false, updatedVariant: variant };
  }

  let rawCost = 0;
  let stockPackCost = 0;
  for (const ri of effectiveRecipe) {
    const ing = (ingredients || []).find((i) => i.id === ri.ingredientId);
    if (ing && ing.costPerUnit) {
      const lineCost = Number(ri.quantity || 0) * Number(ing.costPerUnit);
      if (isPackagingCheck(ing)) {
        stockPackCost += lineCost;
      } else {
        rawCost += lineCost;
      }
    }
  }

  const effectivePackCost =
    stockPackCost > 0
      ? Math.round(stockPackCost)
      : Math.round(Number(variant?.packagingCost || 0));
  const baseCost = rawCost + effectivePackCost;
  const wastageCost = Math.round(baseCost * (Number(variant?.wastagePercent || 0) / 100));
  const overheadCost = Math.round(baseCost * (Number(variant?.overheadPercent || 0) / 100));
  const newEstimatedHpp = Math.round(baseCost + wastageCost + overheadCost);

  const hadValidOwnRecipe = Array.isArray(variant?.recipe) && variant.recipe.length > 0;
  const changed =
    newEstimatedHpp !== Math.round(Number(variant?.estimatedHpp || 0)) ||
    effectivePackCost !== Math.round(Number(variant?.packagingCost || 0)) ||
    !hadValidOwnRecipe;

  return {
    changed,
    updatedVariant: {
      ...variant,
      recipe: hadValidOwnRecipe ? variant.recipe : effectiveRecipe,
      packagingCost: effectivePackCost,
      estimatedHpp: newEstimatedHpp,
    },
  };
}

/** Memvalidasi resep batch olahan agar yield > 0, bahan tidak kosong, dan target tidak mereferensikan diri sendiri. */
export function validateBatchPrepSubmission(params: {
  name: string;
  targetIngredientId?: string;
  targetIngredientName?: string;
  yieldQuantity: number;
  ingredients: { ingredientId: string; quantity: number }[];
}):
  | { ok: true; mergedIngredients: { ingredientId: string; quantity: number }[] }
  | { ok: false; error: string } {
  const cleanName = String(params.name || "").trim();
  if (!cleanName) {
    return { ok: false, error: "Nama resep batch tidak boleh kosong." };
  }
  const targetId = String(params.targetIngredientId || "").trim();
  const targetName = String(params.targetIngredientName || "").trim();
  if (!targetId && !targetName) {
    return {
      ok: false,
      error: "Pilih atau masukkan nama target bahan hasil olahan.",
    };
  }
  if (!(Number(params.yieldQuantity) > 0)) {
    return {
      ok: false,
      error: "Hasil jadi (yield) per batch harus lebih dari 0.",
    };
  }
  const merged = mergeDuplicateRecipeIngredients(params.ingredients || []);
  if (merged.length === 0) {
    return {
      ok: false,
      error: "Minimal 1 bahan baku dengan takaran > 0 harus dipilih.",
    };
  }
  if (targetId && merged.some((ri) => ri.ingredientId === targetId)) {
    return {
      ok: false,
      error:
        "Target bahan hasil olahan tidak boleh digunakan sebagai bahan mentahnya sendiri.",
    };
  }
  return { ok: true, mergedIngredients: merged };
}

/** Mengurai periode YYYY-MM lokal toko secara aman dari string ISO, tanggal YYYY-MM-DD, atau YYYY-MM. */
export function getLocalPeriodFromTimestamp(
  dateStr?: string | null,
  timeZone: string = DEFAULT_STORE_TIMEZONE
): string {
  if (!dateStr) return "";
  const raw = String(dateStr).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return getLocalPeriodString(parsed, timeZone);
  }
  return raw.slice(0, 7);
}

/** Menambahkan sejumlah hari kalender ke string tanggal YYYY-MM-DD tanpa pergeseran zona waktu. */
export function addDaysToLocalDate(baseYmd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(baseYmd || "").trim());
  const normalizedBase = match
    ? `${match[1]}-${match[2]}-${match[3]}`
    : getLocalDateString();
  const baseParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedBase)!;
  const dt = new Date(
    Date.UTC(
      Number(baseParts[1]),
      Number(baseParts[2]) - 1,
      Number(baseParts[3]) + Math.trunc(days)
    )
  );
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Menghitung status jatuh tempo faktur PO relatif terhadap tanggal lokal toko (zona waktu aman). */
export function computeDueDateStatus(
  dueDateStr?: string | null,
  todayYmd?: string,
  timeZone: string = DEFAULT_STORE_TIMEZONE
): {
  label: string;
  variant: "default" | "overdue" | "due_today" | "due_soon" | "normal";
  days: number;
} {
  if (!dueDateStr) {
    return { label: "Tanpa Tempo", variant: "default", days: 0 };
  }
  const rawDue = String(dueDateStr).trim();
  if (!rawDue) {
    return { label: "Tanpa Tempo", variant: "default", days: 0 };
  }
  let dueYmd = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDue)) {
    dueYmd = rawDue;
  } else {
    const parsedDue = new Date(rawDue);
    if (Number.isNaN(parsedDue.getTime())) {
      return { label: "Tanpa Tempo", variant: "default", days: 0 };
    }
    dueYmd = getLocalDateString(parsedDue, timeZone);
  }

  const baseTodayYmd =
    todayYmd && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd.trim())
      ? todayYmd.trim()
      : getLocalDateString(new Date(), timeZone);

  const dueMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueYmd);
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseTodayYmd);
  if (!dueMatch || !todayMatch) {
    return { label: "Tanpa Tempo", variant: "default", days: 0 };
  }

  const dueMs = Date.UTC(
    Number(dueMatch[1]),
    Number(dueMatch[2]) - 1,
    Number(dueMatch[3])
  );
  const todayMs = Date.UTC(
    Number(todayMatch[1]),
    Number(todayMatch[2]) - 1,
    Number(todayMatch[3])
  );
  const diffDays = Math.round((dueMs - todayMs) / 86400000);

  if (diffDays < 0) {
    return {
      label: `Lewat ${Math.abs(diffDays)} Hari`,
      variant: "overdue",
      days: diffDays,
    };
  }
  if (diffDays === 0) {
    return {
      label: "Jatuh Tempo Hari Ini",
      variant: "due_today",
      days: 0,
    };
  }
  if (diffDays <= 7) {
    return {
      label: `Jatuh Tempo dlm ${diffDays} Hari`,
      variant: "due_soon",
      days: diffDays,
    };
  }
  const formatted = new Date(`${dueYmd}T12:00:00+08:00`).toLocaleDateString(
    "id-ID",
    { day: "numeric", month: "short" }
  );
  return {
    label: `Tempo: ${formatted}`,
    variant: "normal",
    days: diffDays,
  };
}

/** Memvalidasi data form supplier (nama & kontak wajib, anti duplikat nama case-insensitive). */
export function validateSupplierSubmission(params: {
  name: string;
  contact: string;
  picName?: string;
  address?: string;
  notes?: string;
  existingSuppliers: { id: string; name: string }[];
  editingId?: string | null;
}):
  | {
      ok: true;
      data: {
        name: string;
        picName: string;
        contact: string;
        address: string;
        notes: string;
      };
    }
  | { ok: false; error: string } {
  const name = String(params.name || "").trim();
  const contact = String(params.contact || "").trim();
  const picName = String(params.picName || "").trim();
  const address = String(params.address || "").trim();
  const notes = String(params.notes || "").trim();

  if (!name) {
    return { ok: false, error: "Nama perusahaan / supplier tidak boleh kosong." };
  }
  if (!contact) {
    return { ok: false, error: "Nomor kontak / WhatsApp supplier wajib diisi." };
  }
  const normalizedName = name.toLowerCase();
  const duplicate = (params.existingSuppliers || []).find(
    (s) =>
      s.id !== params.editingId &&
      String(s.name || "").trim().toLowerCase() === normalizedName
  );
  if (duplicate) {
    return { ok: false, error: `Supplier "${name}" sudah terdaftar.` };
  }
  return {
    ok: true,
    data: {
      name,
      picName: picName || "-",
      contact,
      address: address || "-",
      notes,
    },
  };
}

/** Memvalidasi keranjang & metode checkout PO / Belanja Pasar sebelum menyimpan transaksi. */
export function validatePoCheckoutInput(params: {
  mode: "DISTRIBUTOR" | "MARKET";
  paymentMethod: "CASH" | "TEMPO";
  supplierId?: string;
  cashAccountId?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    conversionFactor?: number;
    subtotal: number;
  }[];
}): { ok: true; totalAmount: number } | { ok: false; error: string } {
  if (!Array.isArray(params.items) || params.items.length === 0) {
    return { ok: false, error: "Keranjang pembelian masih kosong." };
  }
  for (const it of params.items) {
    if (!(Number(it.quantity) > 0)) {
      return {
        ok: false,
        error: "Pastikan jumlah seluruh item pembelian lebih dari 0.",
      };
    }
    if (
      it.conversionFactor !== undefined &&
      !(Number(it.conversionFactor) > 0)
    ) {
      return {
        ok: false,
        error: "Faktor isi/konversi kemasan setiap item harus lebih dari 0.",
      };
    }
    if (Number(it.unitPrice) < 0) {
      return { ok: false, error: "Harga satuan item tidak boleh negatif." };
    }
  }

  const totalAmount = Math.round(
    params.items.reduce(
      (sum, it) => sum + Math.round(Number(it.quantity) * Number(it.unitPrice)),
      0
    )
  );
  if (!(totalAmount > 0)) {
    return {
      ok: false,
      error:
        "Total pembelian harus lebih dari Rp 0. Periksa harga satuan bahan di keranjang.",
    };
  }
  if (params.mode === "DISTRIBUTOR" && !String(params.supplierId || "").trim()) {
    return { ok: false, error: "Pilih supplier rekanan terlebih dahulu." };
  }
  const needsCashAccount =
    params.mode === "MARKET" || params.paymentMethod === "CASH";
  if (needsCashAccount && !String(params.cashAccountId || "").trim()) {
    return {
      ok: false,
      error: "Pilih akun kas/bank sumber pembayaran terlebih dahulu.",
    };
  }
  return { ok: true, totalAmount };
}

/** Memvalidasi pembayaran/cicilan hutang PO agar bebas overpay, periode tertutup, dan pergeseran hari UTC. */
export function validatePoPaymentInput(params: {
  poStatus: string;
  totalAmount: number;
  amountPaid?: number;
  payAmount: number;
  cashAccountId?: string;
  payDateYmd?: string;
  isPeriodClosed?: boolean;
}):
  | {
      ok: true;
      effectiveAmount: number;
      newAmountPaid: number;
      nextStatus: "PAID" | "PARTIAL";
      payDateIso: string;
    }
  | { ok: false; error: string } {
  const roundedTotal = Math.max(0, Math.round(Number(params.totalAmount) || 0));
  const prevPaid = Math.max(0, Math.round(Number(params.amountPaid) || 0));
  const remaining = Math.max(0, roundedTotal - prevPaid);

  if (params.poStatus === "PAID" || remaining <= 0) {
    return { ok: false, error: "Tagihan PO ini sudah lunas." };
  }
  if (!String(params.cashAccountId || "").trim()) {
    return {
      ok: false,
      error: "Pilih akun kas atau bank sumber pembayaran terlebih dahulu.",
    };
  }
  if (params.isPeriodClosed) {
    return {
      ok: false,
      error:
        "Tanggal pembayaran berada pada periode yang telah ditutup buku. Pilih tanggal pada periode buku aktif.",
    };
  }
  const requested = Math.round(Number(params.payAmount) || 0);
  if (!(requested > 0)) {
    return { ok: false, error: "Nominal pembayaran harus lebih dari Rp 0." };
  }

  const effectiveAmount = Math.min(remaining, requested);
  const newAmountPaid = prevPaid + effectiveAmount;
  const nextStatus: "PAID" | "PARTIAL" =
    newAmountPaid >= roundedTotal ? "PAID" : "PARTIAL";

  const rawYmd = String(params.payDateYmd || "").trim();
  const cleanYmd = /^\d{4}-\d{2}-\d{2}$/.test(rawYmd)
    ? rawYmd
    : getLocalDateString();
  const payDateIso = new Date(`${cleanYmd}T12:00:00+08:00`).toISOString();

  return {
    ok: true,
    effectiveAmount,
    newAmountPaid,
    nextStatus,
    payDateIso,
  };
}

/** Mengambil jam lokal toko (0-23) di zona waktu WITA dari timestamp ISO. */
export function extractWitaHour(
  isoTimestamp?: string | null,
  timeZone: string = DEFAULT_STORE_TIMEZONE
): number | null {
  if (!isoTimestamp) return null;
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  const rawHour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(parsed);
  const h = Number(rawHour);
  if (!Number.isFinite(h)) return null;
  return h === 24 ? 0 : h % 24;
}

/** Mengagregasi item menu terlaris dari transaksi POS lunas dengan membaca menuName + varian. */
export function aggregatePosOrderTopItems(
  orders: Array<{
    status?: string;
    items?: Array<{
      menuName?: string;
      productName?: string;
      variantName?: string | null;
      quantity?: number;
      subtotal?: number;
    }>;
  }>,
  limit: number = 5
): Array<{ name: string; quantity: number; total: number }> {
  const map: Record<string, { name: string; quantity: number; total: number }> = {};
  (orders || []).forEach((ord) => {
    if (ord?.status !== "PAID" || !Array.isArray(ord.items)) return;
    ord.items.forEach((item) => {
      const base =
        String(item.menuName || item.productName || "Produk").trim() || "Produk";
      const v = String(item.variantName || "").trim();
      const label =
        v &&
        !/^(regular|reguler|default)$/i.test(v) &&
        !base.toLowerCase().includes(v.toLowerCase())
          ? `${base} (${v})`
          : base;
      if (!map[label]) {
        map[label] = { name: label, quantity: 0, total: 0 };
      }
      map[label].quantity += Math.max(0, Number(item.quantity) || 0);
      map[label].total += Math.round(Number(item.subtotal) || 0);
    });
  });

  return Object.values(map)
    .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
    .slice(0, Math.max(1, limit));
}

/** Memvalidasi form rekap omzet harian (anti total <= 0, nilai negatif, periode terkunci & duplikat tanggal+shift). */
export function validateDailySalesRecapSubmission(params: {
  date: string;
  shift: string;
  cashAmount: number;
  qrisAmount: number;
  edcAmount: number;
  transferAmount: number;
  onlineDeliveryAmount: number;
  discountAmount?: number;
  refundAmount?: number;
  mdrFeeAmount?: number;
  isPeriodClosed?: boolean;
  existingRecaps: { id: string; date: string; shift?: string }[];
  editingId?: string | null;
}):
  | {
      ok: true;
      totalAmount: number;
      nonCashTotal: number;
      cashAmount: number;
      qrisAmount: number;
      edcAmount: number;
      transferAmount: number;
      onlineDeliveryAmount: number;
      discountAmount: number;
      refundAmount: number;
      mdrFeeAmount: number;
    }
  | { ok: false; error: string } {
  const cleanDate = String(params.date || "").trim();
  if (!cleanDate) {
    return { ok: false, error: "Pilih tanggal rekap omzet terlebih dahulu." };
  }
  if (params.isPeriodClosed) {
    return {
      ok: false,
      error: `Periode bulan ${cleanDate.slice(0, 7)} sudah ditutup buku. Pencatatan omzet pada periode terkunci tidak diizinkan.`,
    };
  }

  const cashAmount = Math.round(Number(params.cashAmount) || 0);
  const qrisAmount = Math.round(Number(params.qrisAmount) || 0);
  const edcAmount = Math.round(Number(params.edcAmount) || 0);
  const transferAmount = Math.round(Number(params.transferAmount) || 0);
  const onlineDeliveryAmount = Math.round(Number(params.onlineDeliveryAmount) || 0);
  const discountAmount = Math.max(0, Math.round(Number(params.discountAmount) || 0));
  const refundAmount = Math.max(0, Math.round(Number(params.refundAmount) || 0));
  const mdrFeeAmount = Math.max(0, Math.round(Number(params.mdrFeeAmount) || 0));

  if (
    cashAmount < 0 ||
    qrisAmount < 0 ||
    edcAmount < 0 ||
    transferAmount < 0 ||
    onlineDeliveryAmount < 0
  ) {
    return {
      ok: false,
      error: "Nominal masing-masing kanal pembayaran tidak boleh bernilai negatif.",
    };
  }

  const nonCashTotal =
    qrisAmount + edcAmount + transferAmount + onlineDeliveryAmount;
  const totalAmount = cashAmount + nonCashTotal;
  if (!(totalAmount > 0)) {
    return { ok: false, error: "Total omzet harus lebih besar dari Rp 0." };
  }

  const targetShift = String(params.shift || "ALL").trim() || "ALL";
  const duplicate = (params.existingRecaps || []).find(
    (r) =>
      r.id !== params.editingId &&
      String(r.date || "").slice(0, 10) === cleanDate.slice(0, 10) &&
      (String(r.shift || "ALL").trim() || "ALL") === targetShift
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Rekap omzet tanggal ${cleanDate} untuk shift "${targetShift}" sudah tercatat. Edit entri tersebut untuk mencegah duplikasi.`,
    };
  }

  return {
    ok: true,
    totalAmount,
    nonCashTotal,
    cashAmount,
    qrisAmount,
    edcAmount,
    transferAmount,
    onlineDeliveryAmount,
    discountAmount,
    refundAmount,
    mdrFeeAmount,
  };
}

/** Memvalidasi setoran uang tunai kasir ke rekening bank (transfer internal). */
export function validateCashDepositSubmission(params: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  isPeriodClosed?: boolean;
}): { ok: true; amount: number } | { ok: false; error: string } {
  const fromId = String(params.fromAccountId || "").trim();
  const toId = String(params.toAccountId || "").trim();
  const cleanDate = String(params.date || "").trim();

  if (!fromId || !toId) {
    return {
      ok: false,
      error: "Pilih pos Kas Asal dan Rekening Bank Tujuan terlebih dahulu.",
    };
  }
  if (fromId === toId) {
    return {
      ok: false,
      error: "Pos Kas Asal dan Bank Tujuan tidak boleh sama.",
    };
  }
  if (!cleanDate) {
    return { ok: false, error: "Pilih tanggal setoran terlebih dahulu." };
  }
  if (params.isPeriodClosed) {
    return {
      ok: false,
      error: `Periode ${cleanDate.slice(0, 7)} sudah ditutup buku.`,
    };
  }
  const rounded = Math.round(Number(params.amount) || 0);
  if (!(rounded > 0)) {
    return { ok: false, error: "Nominal setoran harus lebih dari Rp 0." };
  }
  return { ok: true, amount: rounded };
}

// ─── ZONA 6 HELPERS: KATEGORI KAS, ANGGARAN & TUTUP BUKU ────────────────────

export const VALID_EXPENSE_CATEGORY_TYPES = [
  "PENDAPATAN",
  "PENGELUARAN",
  "BAHAN_BAKU",
  "UTILITAS",
  "HRD",
  "ASET",
  "LAINNYA",
] as const;

export interface FilterExpenseCategoryTreeResult {
  tree: ExpenseCategory[];
  autoExpandIds: Record<string, boolean>;
}

/** Menyusun pohon kategori 2 tingkat tanpa memutasi state dan mempertahankan root induk saat mencari sub-kategori. */
export function filterExpenseCategoryTree(
  categories: ExpenseCategory[],
  search: string,
  filterType: ExpenseCategoryType | "ALL"
): FilterExpenseCategoryTreeResult {
  const list = Array.isArray(categories) ? categories : [];
  const q = String(search || "").trim().toLowerCase();
  const hasQuery = q.length > 0;
  const hasTypeFilter = filterType !== "ALL";

  const idSet = new Set(list.map((c) => c.id));
  const roots: ExpenseCategory[] = [];
  const childrenByParent = new Map<string, ExpenseCategory[]>();

  for (const cat of list) {
    if (cat.parentId && idSet.has(cat.parentId)) {
      const bucket = childrenByParent.get(cat.parentId) || [];
      bucket.push(cat);
      childrenByParent.set(cat.parentId, bucket);
    } else {
      roots.push(cat);
    }
  }

  const sortCats = (a: ExpenseCategory, b: ExpenseCategory) => {
    const diff = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    if (diff !== 0) return diff;
    return String(a.name || "").localeCompare(String(b.name || ""), "id");
  };

  const sortedRoots = [...roots].sort(sortCats);
  const tree: ExpenseCategory[] = [];
  const autoExpandIds: Record<string, boolean> = {};

  const matchesItem = (c: ExpenseCategory) => {
    const matchType = !hasTypeFilter || c.type === filterType;
    const matchSearch = !hasQuery || String(c.name || "").toLowerCase().includes(q);
    return matchType && matchSearch;
  };

  for (const root of sortedRoots) {
    const rawChildren = [...(childrenByParent.get(root.id) || [])].sort(sortCats);
    const rootMatches = matchesItem(root);
    const matchingChildren = rawChildren.filter(matchesItem);

    if (!hasQuery && !hasTypeFilter) {
      tree.push({
        ...root,
        children: rawChildren.map((c) => ({ ...c })),
      });
      continue;
    }

    if (!rootMatches && matchingChildren.length === 0) {
      continue;
    }

    const visibleChildren =
      hasQuery || matchingChildren.length > 0
        ? matchingChildren
        : rootMatches && !hasQuery
          ? rawChildren.filter((c) => !hasTypeFilter || c.type === filterType)
          : [];

    if (matchingChildren.length > 0) {
      autoExpandIds[root.id] = true;
    }

    tree.push({
      ...root,
      children: visibleChildren.map((c) => ({ ...c })),
    });
  }

  return { tree, autoExpandIds };
}

/** Memvalidasi dan mengurai baris impor Excel kategori kas agar enum tipe, kode hex, ikon, dan duplikasi terjaga. */
export function parseImportedExpenseCategories(
  rows: Record<string, any>[],
  existingCategories: ExpenseCategory[],
  allowedIcons: string[]
): {
  toCreate: Omit<ExpenseCategory, "id" | "children">[];
  toUpdate: ExpenseCategory[];
  skipped: number;
} {
  const validTypeSet = new Set<string>(VALID_EXPENSE_CATEGORY_TYPES);
  const allowedIconSet = new Set(allowedIcons);
  const existingById = new Map((existingCategories || []).map((c) => [c.id, c]));
  const rootByNameLower = new Map<string, ExpenseCategory>();
  const seenKeys = new Set<string>();

  for (const c of existingCategories || []) {
    const lower = String(c.name || "").trim().toLowerCase();
    if (!lower) continue;
    if (!c.parentId && !rootByNameLower.has(lower)) {
      rootByNameLower.set(lower, c);
    }
    seenKeys.add(`${c.parentId || "ROOT"}::${lower}`);
  }

  const toCreate: Omit<ExpenseCategory, "id" | "children">[] = [];
  const toUpdate: ExpenseCategory[] = [];
  let skipped = 0;

  for (const row of rows || []) {
    const idSistem = String(row?.["ID_SISTEM (JANGAN DIUBAH)"] || "").trim();
    const rawName = String(row?.["Nama Kategori"] ?? row?.name ?? "").trim();
    if (!rawName) {
      skipped++;
      continue;
    }

    const rawParentName = String(row?.["Kategori Induk"] ?? row?.parentName ?? "").trim();
    const matchedParent = rawParentName
      ? rootByNameLower.get(rawParentName.toLowerCase())
      : undefined;

    const rawType = String(
      row?.["Tipe"] ?? row?.type ?? matchedParent?.type ?? "LAINNYA"
    )
      .trim()
      .toUpperCase();
    const type: ExpenseCategoryType = validTypeSet.has(rawType)
      ? (rawType as ExpenseCategoryType)
      : matchedParent?.type || "LAINNYA";

    const rawColor = String(row?.["Warna"] ?? row?.color ?? "").trim();
    const color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : "#1b2cc0";

    const rawIcon = String(row?.["Icon"] ?? row?.icon ?? "").trim().toLowerCase();
    const icon = allowedIconSet.has(rawIcon) ? rawIcon : "tag";

    if (idSistem) {
      const existing = existingById.get(idSistem);
      if (existing) {
        toUpdate.push({
          ...existing,
          name: rawName,
          type,
          color,
          icon,
          parentId: rawParentName ? matchedParent?.id ?? existing.parentId ?? null : existing.parentId ?? null,
        });
      } else {
        skipped++;
      }
      continue;
    }

    const parentId = matchedParent?.id ?? null;
    const dupKey = `${parentId || "ROOT"}::${rawName.toLowerCase()}`;
    if (seenKeys.has(dupKey)) {
      skipped++;
      continue;
    }
    seenKeys.add(dupKey);
    toCreate.push({
      name: rawName,
      type,
      color,
      icon,
      parentId,
      isActive: true,
      sortOrder: 0,
    });
  }

  return { toCreate, toUpdate, skipped };
}

export interface BudgetComparisonRow {
  categoryId: string;
  category: string;
  catType: ExpenseCategoryType;
  parentName: string | null;
  budgetId: string | null;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  usagePercentage: number;
}

/** Menghitung realisasi pengeluaran vs plafon anggaran periode (aman zona waktu WITA & tanpa double-count induk/sub). */
export function computeBudgetVsActual(params: {
  period: string;
  budgets: Budget[];
  cashTransactions: CashTransaction[];
  expenseCategories: ExpenseCategory[];
}): BudgetComparisonRow[] {
  const { period, budgets = [], cashTransactions = [], expenseCategories = [] } = params;

  const catById = new Map<string, ExpenseCategory>();
  const catByNameLower = new Map<string, ExpenseCategory>();
  for (const cat of expenseCategories) {
    if (!cat?.id) continue;
    catById.set(cat.id, cat);
    const lower = String(cat.name || "").trim().toLowerCase();
    if (lower && (!catByNameLower.has(lower) || cat.isActive)) {
      catByNameLower.set(lower, cat);
    }
  }

  const periodBudgetMap = new Map<string, { budgetId: string; amount: number }>();
  for (const b of budgets) {
    if (b?.period !== period || !b.categoryId) continue;
    const prev = periodBudgetMap.get(b.categoryId);
    const amt = Math.max(0, Math.round(Number(b.amount) || 0));
    if (prev) {
      periodBudgetMap.set(b.categoryId, { budgetId: b.id, amount: prev.amount + amt });
    } else {
      periodBudgetMap.set(b.categoryId, { budgetId: b.id, amount: amt });
    }
  }

  const actualByCatId = new Map<string, number>();
  for (const tx of cashTransactions) {
    const rawType = String(tx?.type || "").toUpperCase();
    if (rawType !== "CASH_OUT" && rawType !== "OUT" && rawType !== "EXPENSE") continue;
    if (getLocalPeriodFromTimestamp(tx.date) !== period) continue;
    if (isNonOperationalCashTransaction(tx)) continue;

    let resolvedCat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
    if (!resolvedCat && tx.category) {
      resolvedCat = catByNameLower.get(String(tx.category).trim().toLowerCase());
    }
    if (!resolvedCat) continue;

    // Jika sub-kategori tidak punya anggaran sendiri namun induknya punya anggaran, gulung ke induk agar sesuai plafon grup
    let targetCatId = resolvedCat.id;
    if (
      resolvedCat.parentId &&
      !periodBudgetMap.has(resolvedCat.id) &&
      periodBudgetMap.has(resolvedCat.parentId)
    ) {
      targetCatId = resolvedCat.parentId;
    }

    const amt = Math.max(0, Math.round(Number(tx.amount) || 0));
    actualByCatId.set(targetCatId, (actualByCatId.get(targetCatId) || 0) + amt);
  }

  const rows: BudgetComparisonRow[] = [];
  for (const cat of expenseCategories) {
    const budgetInfo = periodBudgetMap.get(cat.id);
    const budgetAmount = budgetInfo ? budgetInfo.amount : 0;
    const actualAmount = actualByCatId.get(cat.id) || 0;
    if (budgetAmount <= 0 && actualAmount <= 0) continue;

    const parent = cat.parentId ? catById.get(cat.parentId) : undefined;
    const variance = budgetAmount - actualAmount;
    const usagePercentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

    rows.push({
      categoryId: cat.id,
      category: cat.name,
      catType: cat.type,
      parentName: parent ? parent.name : null,
      budgetId: budgetInfo ? budgetInfo.budgetId : null,
      budgetAmount,
      actualAmount,
      variance,
      usagePercentage,
    });
  }

  return rows.sort((a, b) => {
    const aScore = a.budgetAmount > 0 ? a.usagePercentage : -1;
    const bScore = b.budgetAmount > 0 ? b.usagePercentage : -1;
    if (aScore !== bScore) return bScore - aScore;
    if (a.actualAmount !== b.actualAmount) return b.actualAmount - a.actualAmount;
    if (a.budgetAmount !== b.budgetAmount) return b.budgetAmount - a.budgetAmount;
    return a.category.localeCompare(b.category, "id");
  });
}

/** Memvalidasi apakah transaksi kas boleh disimpan/diubah/dihapus pada periode tanggal tujuan dan tanggal asalnya. */
export function validateCashPeriodAccess(params: {
  date?: string | null;
  originalDate?: string | null;
  closedPeriods: ClosedPeriod[];
}): { ok: true } | { ok: false; error: string } {
  const closedSet = new Set((params.closedPeriods || []).map((p) => p.period));

  if (params.originalDate) {
    const origPeriod = getLocalPeriodFromTimestamp(params.originalDate);
    if (origPeriod && closedSet.has(origPeriod)) {
      return {
        ok: false,
        error: `Gagal: Periode buku (${origPeriod}) untuk transaksi asal sudah ditutup.`,
      };
    }
  }

  const targetPeriod = getLocalPeriodFromTimestamp(params.date);
  if (!targetPeriod) {
    return { ok: false, error: "Tanggal transaksi tidak valid." };
  }
  if (closedSet.has(targetPeriod)) {
    return {
      ok: false,
      error: `Gagal: Periode buku (${targetPeriod}) untuk tanggal ini sudah ditutup.`,
    };
  }

  return { ok: true };
}

/** Mencocokkan nama kategori dari file impor Excel ke ID & nama master kategori kas. */
export function resolveCategoryMatchForImport(
  categoryName: string | undefined | null,
  expenseCategories: ExpenseCategory[]
): { categoryId: string | null; category: string } {
  const raw = String(categoryName || "").trim();
  if (!raw) {
    return { categoryId: null, category: "Lainnya" };
  }

  const parts = raw.split(">").map((p) => p.trim()).filter(Boolean);
  const candidate = parts.length > 0 ? parts[parts.length - 1] : raw;
  const candidateLower = candidate.toLowerCase();
  const rawLower = raw.toLowerCase();

  const sorted = [...(expenseCategories || [])].sort((a, b) =>
    a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1
  );

  const matched = sorted.find((c) => {
    const cName = String(c.name || "").trim().toLowerCase();
    return c.id === raw || cName === rawLower || cName === candidateLower;
  });

  if (matched) {
    return { categoryId: matched.id, category: matched.name };
  }

  return { categoryId: null, category: candidate };
}

function fmtIdrShort(val: number): string {
  return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
}

export interface PayrollLineItemBreakdown {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

/**
 * Memecah slip gaji ke porsi Gaji Pokok vs Tunjangan/Bonus sehingga jumlah keduanya
 * selalu persis sama dengan `Math.round(record.netPay)` (termasuk selisih insentif harian/SOP).
 */
export function computePayrollCategoryBreakdown(record: PayrollRecord): {
  netBasicPortion: number;
  netBonusAllowancePortion: number;
  totalDeductions: number;
  salaryItems: PayrollLineItemBreakdown[];
  bonusItems: PayrollLineItemBreakdown[];
  combinedItems: PayrollLineItemBreakdown[];
} {
  const basicGross = Math.round(Math.max(0, Number(record.basicSalary) || 0));
  const mealAllowance = Math.round(Math.max(0, Number(record.mealAllowance) || 0));
  const transportAllowance = Math.round(Math.max(0, Number(record.transportAllowance) || 0));
  const positionAllowance = Math.round(Math.max(0, Number(record.positionAllowance) || 0));
  const kpiBonus = Math.round(Math.max(0, Number(record.kpiBonus) || 0));
  const targetBonus = Math.round(Math.max(0, Number(record.targetBonus) || 0));
  const overtimePay = Math.round(Math.max(0, Number(record.overtimePay) || 0));

  const totalDeductions = Math.round(
    Math.max(0, Number(record.alphaDeduction) || 0) +
      Math.max(0, Number(record.lateDeduction) || 0) +
      Math.max(0, Number(record.otherDeductions) || 0)
  );

  const rawBonusAndAllowance =
    mealAllowance +
    transportAllowance +
    positionAllowance +
    kpiBonus +
    targetBonus +
    overtimePay;

  const deductionFromBasic = Math.min(basicGross, totalDeductions);
  const remainingDeduction = Math.max(0, totalDeductions - deductionFromBasic);

  let netBasicPortion = Math.max(0, basicGross - deductionFromBasic);
  const baseBonusPortion = Math.max(0, rawBonusAndAllowance - remainingDeduction);

  const targetNet = Math.round(Math.max(0, Number(record.netPay) || 0));
  const baseSum = netBasicPortion + baseBonusPortion;
  let residual = Math.max(0, targetNet - baseSum);
  let netBonusAllowancePortion = baseBonusPortion + residual;

  if (targetNet < baseSum) {
    if (netBasicPortion >= targetNet) {
      netBasicPortion = targetNet;
      netBonusAllowancePortion = 0;
    } else {
      netBonusAllowancePortion = Math.max(0, targetNet - netBasicPortion);
    }
    residual = 0;
  }

  const bonusItems: PayrollLineItemBreakdown[] = [];
  if (mealAllowance > 0) {
    bonusItems.push({
      name: "Uang Makan Kehadiran",
      qty: 1,
      unit: "periode",
      unitPrice: mealAllowance,
      total: mealAllowance,
    });
  }
  if (transportAllowance > 0) {
    bonusItems.push({
      name: "Tunjangan Transport",
      qty: 1,
      unit: "periode",
      unitPrice: transportAllowance,
      total: transportAllowance,
    });
  }
  if (positionAllowance > 0) {
    bonusItems.push({
      name: "Tunjangan Jabatan Leader",
      qty: 1,
      unit: "periode",
      unitPrice: positionAllowance,
      total: positionAllowance,
    });
  }
  if (kpiBonus > 0) {
    bonusItems.push({
      name: "Bonus KPI & Capaian Divisi",
      qty: 1,
      unit: "periode",
      unitPrice: kpiBonus,
      total: kpiBonus,
    });
  }
  if (targetBonus > 0) {
    bonusItems.push({
      name: "Bonus Target Omzet Toko",
      qty: 1,
      unit: "periode",
      unitPrice: targetBonus,
      total: targetBonus,
    });
  }
  if (overtimePay > 0) {
    bonusItems.push({
      name: `Upah Lembur Shift${record.overtimeHours ? ` (${record.overtimeHours} Jam)` : ""}`,
      qty: 1,
      unit: "periode",
      unitPrice: overtimePay,
      total: overtimePay,
    });
  }
  if (residual > 0) {
    bonusItems.push({
      name: "Insentif Tambahan / Penyesuaian",
      qty: 1,
      unit: "periode",
      unitPrice: residual,
      total: residual,
    });
  }

  const salaryItems: PayrollLineItemBreakdown[] = [];
  if (netBasicPortion > 0) {
    salaryItems.push({
      name:
        deductionFromBasic > 0
          ? `Gaji Pokok Kehadiran (${fmtIdrShort(basicGross)} - Potongan ${fmtIdrShort(deductionFromBasic)})`
          : "Gaji Pokok Kehadiran",
      qty: 1,
      unit: "periode",
      unitPrice: netBasicPortion,
      total: netBasicPortion,
    });
  }

  const combinedItems = [...salaryItems, ...bonusItems];

  return {
    netBasicPortion,
    netBonusAllowancePortion,
    totalDeductions,
    salaryItems,
    bonusItems,
    combinedItems,
  };
}

/** Validasi aturan bisnis & periode tutup buku untuk mutasi Payroll. */
export function validatePayrollMutation(params: {
  action: "CREATE" | "UPDATE" | "DELETE" | "PAY";
  recordPeriod: string;
  existingStatus?: string | null;
  closedPeriods: Pick<ClosedPeriod, "period">[];
  paymentDatePeriod?: string;
  existingCashRefIds?: string[];
  recordId?: string;
}): { ok: true } | { ok: false; error: string } {
  const {
    action,
    recordPeriod,
    existingStatus,
    closedPeriods = [],
    paymentDatePeriod,
    existingCashRefIds = [],
    recordId,
  } = params;

  const isPeriodClosed = closedPeriods.some((p) => p?.period === recordPeriod);
  if (isPeriodClosed) {
    return {
      ok: false,
      error: `Periode ${recordPeriod} telah ditutup buku. Slip gaji tidak dapat diubah atau dicairkan.`,
    };
  }

  if (action === "PAY") {
    if (paymentDatePeriod && closedPeriods.some((p) => p?.period === paymentDatePeriod)) {
      return {
        ok: false,
        error: `Periode pencairan kas (${paymentDatePeriod}) telah ditutup buku.`,
      };
    }
    if (existingStatus !== "APPROVED") {
      return {
        ok: false,
        error: "Slip gaji harus berstatus FINAL (Disetujui oleh Manager) terlebih dahulu sebelum dicairkan.",
      };
    }
    if (recordId && existingCashRefIds.some((ref) => ref === recordId)) {
      return {
        ok: false,
        error: "Slip gaji ini sudah tercatat dicairkan di Buku Kas (dicegah agar tidak cair ganda).",
      };
    }
  }

  if (action === "UPDATE" || action === "DELETE") {
    if (existingStatus === "PAID") {
      return {
        ok: false,
        error: "Slip gaji yang sudah DIBAYAR (PAID) bersifat mutlak immutable dan tidak bisa diubah atau dihapus.",
      };
    }
  }

  if (action === "DELETE" && existingStatus === "APPROVED") {
    return {
      ok: false,
      error: "Slip gaji berstatus FINAL harus dikembalikan ke Draft terlebih dahulu sebelum dihapus.",
    };
  }

  return { ok: true };
}

/** Menghitung ekspektasi kas laci shift hanya dari cashTransactions akun laci terkait (tanpa double-count). */
export function computeShiftExpectedCash(params: {
  startingCash: number;
  shiftStartTime: string;
  cashAccountId: string;
  cashTransactions: CashTransaction[];
}): {
  totalSalesCashIn: number;
  totalOtherCashIn: number;
  totalCashOut: number;
  expectedEndingCash: number;
} {
  const startMs = new Date(params.shiftStartTime).getTime();
  const safeStartMs = Number.isFinite(startMs) ? startMs : 0;

  let totalSalesCashIn = 0;
  let totalOtherCashIn = 0;
  let totalCashOut = 0;

  for (const t of params.cashTransactions || []) {
    if (!t || t.accountId !== params.cashAccountId) continue;
    const txMs = new Date(t.date).getTime();
    if (!Number.isFinite(txMs) || txMs < safeStartMs) continue;

    const amt = Math.round(Math.max(0, Number(t.amount) || 0));
    if (t.type === "CASH_IN") {
      if (isSalesCashTransaction(t)) {
        totalSalesCashIn += amt;
      } else {
        totalOtherCashIn += amt;
      }
    } else if (t.type === "CASH_OUT") {
      totalCashOut += amt;
    }
  }

  const roundedStart = Math.round(Math.max(0, Number(params.startingCash) || 0));
  return {
    totalSalesCashIn,
    totalOtherCashIn,
    totalCashOut,
    expectedEndingCash: Math.round(roundedStart + totalSalesCashIn + totalOtherCashIn - totalCashOut),
  };
}

/** Mempertahankan record payroll berstatus PAID agar tidak tertimpa/terhapus saat sync offline. */
export function mergeOfflinePayrollPreservingPaid<T extends { id?: string; status?: string }>(
  incoming: T[],
  existing: T[]
): T[] {
  const existingPaid = (existing || []).filter(
    (r) => String(r?.status || "").toUpperCase() === "PAID" && r?.id
  );
  const existingPaidIds = new Set(existingPaid.map((r) => String(r.id)));
  const safeIncoming = (incoming || []).filter((r) => r?.id && !existingPaidIds.has(String(r.id)));
  return [...existingPaid, ...safeIncoming];
}

/** Menentukan status runtime promo berdasarkan switch aktif serta tanggal mulai/akhir (WITA). */
export function getPromotionRuntimeStatus(
  promo: Pick<Promotion, "isActive" | "startDate" | "endDate">,
  todayStr: string = getLocalDateString()
): "ACTIVE" | "UPCOMING" | "EXPIRED" | "INACTIVE" {
  if (!promo.isActive) return "INACTIVE";
  if (promo.endDate && promo.endDate.slice(0, 10) < todayStr) return "EXPIRED";
  if (promo.startDate && promo.startDate.slice(0, 10) > todayStr) return "UPCOMING";
  return "ACTIVE";
}

/** Validasi & normalisasi input promo (diskon persen <=100%, tanggal valid, kode unik, integer Rupiah). */
export function validatePromotionInput(
  input: {
    name: string;
    code?: string;
    type: PromotionType;
    value: number;
    minSpend?: number;
    maxDiscount?: number;
    startDate?: string;
    endDate?: string;
  },
  existingPromotions: Promotion[] = [],
  editingId?: string | null
):
  | {
      ok: true;
      normalized: {
        name: string;
        code?: string;
        value: number;
        minSpend: number;
        maxDiscount?: number;
        startDate?: string;
        endDate?: string;
      };
    }
  | { ok: false; error: string } {
  const trimmedName = String(input.name || "").trim();
  if (!trimmedName) {
    return { ok: false, error: "Nama promo wajib diisi." };
  }

  const val = Math.round(Number(input.value) || 0);
  if (val <= 0) {
    return { ok: false, error: "Besaran diskon harus lebih besar dari 0." };
  }
  if (input.type === "PERCENT" && val > 100) {
    return { ok: false, error: "Diskon persen tidak boleh melebihi 100%." };
  }

  const minSpend = Math.max(0, Math.round(Number(input.minSpend) || 0));
  const maxDiscount =
    input.type === "PERCENT"
      ? Math.max(0, Math.round(Number(input.maxDiscount) || 0)) || undefined
      : undefined;

  const startDate = input.startDate ? String(input.startDate).slice(0, 10) : undefined;
  const endDate = input.endDate ? String(input.endDate).slice(0, 10) : undefined;
  if (startDate && endDate && endDate < startDate) {
    return {
      ok: false,
      error: "Tanggal berakhir promo tidak boleh lebih awal dari tanggal mulai.",
    };
  }

  const code = input.code ? String(input.code).trim().toUpperCase() || undefined : undefined;
  if (code) {
    const duplicate = (existingPromotions || []).find(
      (p) => p.id !== editingId && (p.code || "").trim().toUpperCase() === code
    );
    if (duplicate) {
      return {
        ok: false,
        error: `Kode promo "${code}" sudah digunakan oleh promo lain.`,
      };
    }
  }

  return {
    ok: true,
    normalized: {
      name: trimmedName,
      code,
      value: val,
      minSpend,
      maxDiscount,
      startDate,
      endDate,
    },
  };
}

/** Menghitung simulasi potongan diskon promo (integer Rupiah). */
export function computePromotionDiscountPreview(params: {
  type: PromotionType;
  value: number;
  minSpend?: number;
  maxDiscount?: number;
  subtotal: number;
}): {
  applied: boolean;
  reason: string | null;
  discount: number;
  finalTotal: number;
} {
  const subtotal = Math.max(0, Math.round(Number(params.subtotal) || 0));
  const minSpend = Math.max(0, Math.round(Number(params.minSpend) || 0));
  const val = Math.max(0, Math.round(Number(params.value) || 0));
  const maxDiscount = Math.max(0, Math.round(Number(params.maxDiscount) || 0));

  if (minSpend > 0 && subtotal < minSpend) {
    return {
      applied: false,
      reason: `Subtotal Rp ${subtotal.toLocaleString("id-ID")} kurang dari min. belanja Rp ${minSpend.toLocaleString("id-ID")}`,
      discount: 0,
      finalTotal: subtotal,
    };
  }

  let discount = 0;
  if (params.type === "PERCENT") {
    discount = Math.round((subtotal * val) / 100);
    if (maxDiscount > 0 && discount > maxDiscount) {
      discount = maxDiscount;
    }
  } else {
    discount = val;
  }

  discount = Math.min(subtotal, Math.max(0, Math.round(discount)));
  return {
    applied: true,
    reason: null,
    discount,
    finalTotal: Math.max(0, subtotal - discount),
  };
}

const OWNER_CATEGORY_COLORS = [
  "#1b2cc0",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0284c7",
  "#64748b",
];

/** Menghitung kontribusi omzet nyata per kategori menu pada OwnerDashboard. */
export function computeOwnerCategoryContribution(params: {
  filteredSales: SalesTransaction[];
  products: Product[];
  totalRevenue: number;
}): Array<{ name: string; value: number; color: string }> {
  const { filteredSales = [], products = [], totalRevenue } = params;
  const roundedTotal = Math.max(0, Math.round(Number(totalRevenue) || 0));
  if (roundedTotal <= 0) return [];

  const productCategoryLookup = new Map<string, string>();
  products.forEach((p) => {
    const key = String(p.name || "").trim().toLowerCase();
    if (key) {
      productCategoryLookup.set(key, String(p.category || "Lainnya").trim() || "Lainnya");
    }
  });

  const resolveCategory = (rawMenuName?: string | null): string => {
    const clean = String(rawMenuName || "").trim().toLowerCase();
    if (!clean) return "Lainnya";
    const direct = productCategoryLookup.get(clean);
    if (direct) return direct;
    const baseName = clean.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (baseName && productCategoryLookup.has(baseName)) {
      return productCategoryLookup.get(baseName)!;
    }
    for (const [pName, cat] of productCategoryLookup.entries()) {
      if (clean.startsWith(`${pName} (`)) {
        return cat;
      }
    }
    return "Lainnya";
  };

  const categoryTotals = new Map<string, number>();
  let totalItemRev = 0;

  filteredSales.forEach((s: any) => {
    if (Array.isArray(s?.items) && s.items.length > 0) {
      s.items.forEach((item: any) => {
        const rev = Math.max(
          0,
          Math.round((Number(item?.quantity) || 1) * (Number(item?.price) || 0))
        );
        if (rev > 0) {
          const cat = resolveCategory(item?.name || s?.menuName);
          categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + rev);
          totalItemRev += rev;
        }
      });
    } else {
      const rev = Math.max(0, Math.round(Number(s?.totalPrice) || 0));
      if (rev > 0) {
        const cat = resolveCategory(s?.menuName);
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + rev);
        totalItemRev += rev;
      }
    }
  });

  if (totalItemRev === 0) {
    return [
      {
        name: "Penjualan Rekap Harian",
        value: roundedTotal,
        color: OWNER_CATEGORY_COLORS[0],
      },
    ];
  }

  const sorted = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);
  const restSum = sorted.slice(5).reduce((sum, [, val]) => sum + val, 0);
  if (restSum > 0) {
    const existingOther = top5.find(([name]) => name === "Lainnya");
    if (existingOther) {
      existingOther[1] += restSum;
    } else {
      top5.push(["Lainnya", restSum]);
    }
  }

  return top5.map(([name, value], idx) => ({
    name,
    value: Math.round(value),
    color: OWNER_CATEGORY_COLORS[idx % OWNER_CATEGORY_COLORS.length],
  }));
}

/** Menghitung persentase pertumbuhan antar periode secara jujur (null jika periode sebelumnya <= 0). */
export function computePeriodGrowthPercent(
  currentValue: number,
  previousValue: number
): number | null {
  if (!Number.isFinite(previousValue) || previousValue <= 0) return null;
  const cur = Number.isFinite(currentValue) ? currentValue : 0;
  return Math.round(((cur - previousValue) / previousValue) * 1000) / 10;
}

/** Mengembalikan tanggal hari Senin minggu berjalan sesuai zona waktu WITA tanpa drift UTC/DST. */
export function getWitaWeekStartDate(now: Date = new Date()): Date {
  const todayStr = getLocalDateString(now);
  const noonWita = new Date(`${todayStr}T12:00:00+08:00`);
  const witaWeekday = new Date(noonWita.getTime() + 8 * 3600000).getUTCDay();
  const diffDays = witaWeekday === 0 ? -6 : 1 - witaWeekday;
  return new Date(noonWita.getTime() + diffDays * 86400000);
}

export const VALID_KITCHEN_STATUSES = ["QUEUED", "PREPARING", "READY", "SERVED"] as const;
export type ValidKitchenStatus = (typeof VALID_KITCHEN_STATUSES)[number];

/** Memastikan status KDS hanya menerima nilai transisi dapur resmi. */
export function isValidKitchenStatus(status: unknown): status is ValidKitchenStatus {
  return typeof status === "string" && (VALID_KITCHEN_STATUSES as readonly string[]).includes(status);
}

export type ApiAccessCheck =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/** Validasi sesi & hak akses role API backend secara terpusat (401/403). */
export function evaluateApiAccess(
  authUser: { role?: string | null; isSuspended?: boolean | null } | null | undefined,
  allowedRoles?: readonly string[]
): ApiAccessCheck {
  if (!authUser) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Sesi login diperlukan untuk mengakses endpoint ini.",
    };
  }
  if (authUser.isSuspended) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: Akun Anda sedang ditangguhkan (suspended).",
    };
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(String(authUser.role || ""))) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: Hak akses role Anda tidak mencukupi untuk tindakan ini.",
    };
  }
  return { ok: true };
}

export type SessionHeartbeatEvaluation =
  | { allow: true; revoked: false; status: "ACTIVE" }
  | { allow: false; revoked: true; status: "INVALID" | "REVOKED" | "EXPIRED" | "SUSPENDED" };

/** Mengevaluasi apakah heartbeat sesi boleh memperpanjang masa aktif sesi (anti session-forgery). */
export function evaluateSessionHeartbeat(
  existingSession: { status?: string | null; lastActive?: string | null } | null | undefined,
  sessionUser: { isSuspended?: boolean | null } | null | undefined,
  nowMs: number = Date.now(),
  idleTimeoutMs: number = 60 * 60 * 1000
): SessionHeartbeatEvaluation {
  if (!existingSession) {
    return { allow: false, revoked: true, status: "INVALID" };
  }
  if (existingSession.status === "REVOKED") {
    return { allow: false, revoked: true, status: "REVOKED" };
  }
  if (existingSession.status === "EXPIRED") {
    return { allow: false, revoked: true, status: "EXPIRED" };
  }
  if (sessionUser?.isSuspended) {
    return { allow: false, revoked: true, status: "SUSPENDED" };
  }
  if (existingSession.lastActive) {
    const lastActiveMs = new Date(existingSession.lastActive).getTime();
    if (!Number.isNaN(lastActiveMs) && nowMs - lastActiveMs > idleTimeoutMs) {
      return { allow: false, revoked: true, status: "EXPIRED" };
    }
  }
  return { allow: true, revoked: false, status: "ACTIVE" };
}

export const GENERIC_CRUD_BLOCKED_TABLES = [
  "audit_logs",
  "device_sessions",
  "users",
] as const;

/** Menegakkan pembatasan tabel dan RBAC pada endpoint CRUD generik `/api/:table`. */
export function evaluateGenericTableAccess(
  authUser: { role?: string | null; isSuspended?: boolean | null } | null | undefined,
  tableName: string
): ApiAccessCheck {
  const baseCheck = evaluateApiAccess(authUser);
  if ("error" in baseCheck) {
    return baseCheck;
  }

  const normalizedTable = String(tableName || "").trim();
  if ((GENERIC_CRUD_BLOCKED_TABLES as readonly string[]).includes(normalizedTable)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: Tabel keamanan/audit tidak boleh diubah lewat endpoint CRUD generik.",
    };
  }

  const role = String(authUser?.role || "");
  if (role === "SUPER_ADMIN") return { ok: true };
  if (role === "OWNER") {
    return { ok: false, status: 403, error: "Owner is read-only" };
  }
  if (role === "FINANCE") {
    if (normalizedTable !== "cash_transactions") {
      return { ok: false, status: 403, error: "Finance only has access to Cash Flow" };
    }
    return { ok: true };
  }
  if (role === "MANAGER") {
    const managerTables = [
      "ingredients",
      "stock_movements",
      "sales_transactions",
      "sales_import_logs",
      "purchase_orders",
      "suppliers",
    ];
    if (!managerTables.includes(normalizedTable)) {
      return {
        ok: false,
        status: 403,
        error: "Manager only has access to Inventory, Sales, and Purchases",
      };
    }
    return { ok: true };
  }
  return { ok: false, status: 403, error: "Unauthorized role" };
}

/** Mengagregasi total kebutuhan bahan baku per ingredientId untuk produksi batch (mencegah celah baris duplikat). */
export function aggregateBatchRequiredQuantities(
  items: ReadonlyArray<{ ingredientId: string; quantity: number }>,
  multiplier: number
): Map<string, number> {
  const safeMult = Number(multiplier) > 0 ? Number(multiplier) : 0;
  const totals = new Map<string, number>();
  for (const item of items || []) {
    if (!item?.ingredientId) continue;
    const qty = Math.max(0, Number(item.quantity) || 0) * safeMult;
    if (qty <= 0) continue;
    const prev = totals.get(item.ingredientId) || 0;
    totals.set(item.ingredientId, Number((prev + qty).toFixed(4)));
  }
  return totals;
}

/** Menghitung HPP rata-rata tertimbang hasil produksi batch (kebal terhadap stok awal negatif). */
export function computeBatchWeightedUnitCost(
  existingStock: number,
  existingUnitCost: number,
  yieldedQty: number,
  batchTotalCost: number
): number {
  const safeExistingStock = Math.max(0, Number(existingStock) || 0);
  const safeExistingCost = Math.max(0, Number(existingUnitCost) || 0);
  const safeYield = Math.max(0, Number(yieldedQty) || 0);
  const safeBatchTotal = Math.max(0, Number(batchTotalCost) || 0);

  const batchUnitCost = safeYield > 0 ? Math.round(safeBatchTotal / safeYield) : 0;
  const totalQty = safeExistingStock + safeYield;
  if (totalQty <= 0) return batchUnitCost;
  const totalValuation = safeExistingStock * safeExistingCost + safeBatchTotal;
  return Math.max(0, Math.round(totalValuation / totalQty));
}

/** Memastikan nominal refund POS selalu bilangan bulat Rupiah dan tidak melebihi total transaksi order. */
export function resolveCappedRefundAmount(
  orderTotalAmount: number,
  customRefundAmount?: number | null
): number {
  const maxRefund = Math.max(0, Math.round(Number(orderTotalAmount) || 0));
  const requested = Math.round(Number(customRefundAmount) || 0);
  if (requested <= 0) return maxRefund;
  return Math.min(maxRefund, requested);
}

/** Validasi dasar payload pembuatan order POS (anti keranjang kosong, status ilegal, atau nominal negatif). */
export function validatePosOrderPayload(input: {
  items?: unknown;
  status?: unknown;
  subtotal?: unknown;
  discountAmount?: unknown;
  taxAmount?: unknown;
  totalAmount?: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Daftar item pesanan tidak boleh kosong." };
  }
  const st = String(input.status || "OPEN");
  if (st !== "OPEN" && st !== "PAID") {
    return { ok: false, error: `Status awal pesanan tidak valid: ${st}` };
  }
  const fields: Array<[string, unknown]> = [
    ["Subtotal", input.subtotal ?? 0],
    ["Diskon", input.discountAmount ?? 0],
    ["Pajak", input.taxAmount ?? 0],
    ["Total tagihan", input.totalAmount ?? 0],
  ];
  for (const [label, raw] of fields) {
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 0) {
      return { ok: false, error: `${label} tidak boleh negatif atau tidak valid.` };
    }
  }
  return { ok: true };
}

/** Validasi nominal pecahan tagihan (split bill bagi rata) agar > 0 dan tidak melebihi sisa tagihan induk. */
export function validateEvenlySplitAmount(
  parentRemainingTotal: number,
  requestedSplitAmount: number
):
  | { ok: true; splitTotal: number; newParentTotal: number }
  | { ok: false; error: string } {
  const remaining = Math.max(0, Math.round(Number(parentRemainingTotal) || 0));
  const requested = Math.round(Number(requestedSplitAmount) || 0);
  if (remaining <= 0) {
    return { ok: false, error: "Tagihan induk sudah tidak memiliki sisa saldo untuk dipecah." };
  }
  if (requested <= 0) {
    return { ok: false, error: "Nominal pecahan tagihan harus lebih dari Rp 0." };
  }
  if (requested > remaining) {
    return {
      ok: false,
      error: `Nominal pecahan (Rp ${requested.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${remaining.toLocaleString("id-ID")}).`,
    };
  }
  return {
    ok: true,
    splitTotal: requested,
    newParentTotal: Math.max(0, remaining - requested),
  };
}

/** Validasi permintaan remote approval kasir (tipe VOID/REFUND, kelayakan status order, dan batas nominal refund). */
export function validateApprovalRequestInput(input: {
  type?: unknown;
  orderStatus?: unknown;
  orderTotalAmount?: unknown;
  requestedAmount?: unknown;
}):
  | { ok: true; type: "VOID" | "REFUND"; normalizedAmount: number }
  | { ok: false; error: string } {
  const type = String(input.type || "").toUpperCase();
  if (type !== "VOID" && type !== "REFUND") {
    return { ok: false, error: "Tipe otorisasi harus VOID atau REFUND." };
  }
  const status = String(input.orderStatus || "").toUpperCase();
  if (type === "REFUND") {
    if (status !== "PAID") {
      return {
        ok: false,
        error: `Permintaan refund hanya berlaku untuk order berstatus PAID (saat ini: ${status || "UNKNOWN"}).`,
      };
    }
    return {
      ok: true,
      type: "REFUND",
      normalizedAmount: resolveCappedRefundAmount(
        Number(input.orderTotalAmount) || 0,
        Number(input.requestedAmount) || 0
      ),
    };
  }
  if (status === "VOID" || status === "CANCELLED" || status === "REFUNDED") {
    return {
      ok: false,
      error: `Order sudah dalam status final (${status}) dan tidak dapat diajukan VOID.`,
    };
  }
  return {
    ok: true,
    type: "VOID",
    normalizedAmount: Math.max(0, Math.round(Number(input.orderTotalAmount) || 0)),
  };
}

/** Menggabungkan daftar sinkronisasi dengan menjamin baris terproteksi server selalu menang atas payload klien. */
export function mergePreservingProtectedRows<T extends { id?: any }>(
  incomingList: T[],
  protectedRows: T[]
): T[] {
  const map = new Map<string, T>();
  for (const item of incomingList || []) {
    if (item?.id) map.set(String(item.id), item);
  }
  for (const row of protectedRows || []) {
    if (row?.id) map.set(String(row.id), row);
  }
  return Array.from(map.values());
}

/** Mencegah penghapusan atau eskalasi hak akses akun SUPER_ADMIN saat sinkronisasi tabel users. */
export function protectSuperAdminAccountsOnSync(
  callerRole: string,
  incomingUsers: any[],
  existingUsers: any[]
): any[] {
  const existing = Array.isArray(existingUsers) ? existingUsers : [];
  if (!Array.isArray(incomingUsers) || incomingUsers.length === 0) {
    return existing;
  }

  const existingSuperAdmins = existing.filter(
    (u) => String(u?.role || "").toUpperCase() === "SUPER_ADMIN"
  );
  const existingSuperAdminMap = new Map<string, any>(
    existingSuperAdmins.map((u) => [String(u.id), u])
  );
  const existingById = new Map<string, any>(
    existing.map((u) => [String(u.id), u])
  );

  const isCallerSuperAdmin = String(callerRole || "").toUpperCase() === "SUPER_ADMIN";
  if (isCallerSuperAdmin) {
    const hasSuperAdmin = incomingUsers.some(
      (u) => String(u?.role || "").toUpperCase() === "SUPER_ADMIN"
    );
    if (hasSuperAdmin || existingSuperAdmins.length === 0) {
      return incomingUsers;
    }
    const seen = new Set(incomingUsers.map((u) => String(u?.id || "")));
    return [
      ...incomingUsers,
      ...existingSuperAdmins.filter((sa) => !seen.has(String(sa.id))),
    ];
  }

  const sanitized = incomingUsers.map((u) => {
    const uid = String(u?.id || "");
    if (existingSuperAdminMap.has(uid)) {
      return existingSuperAdminMap.get(uid);
    }
    if (String(u?.role || "").toUpperCase() === "SUPER_ADMIN") {
      const prev = existingById.get(uid);
      const safeRole =
        prev && String(prev.role || "").toUpperCase() !== "SUPER_ADMIN"
          ? prev.role
          : "MANAGER";
      return { ...u, role: safeRole };
    }
    return u;
  });

  const presentIds = new Set(sanitized.map((u) => String(u?.id || "")));
  for (const sa of existingSuperAdmins) {
    if (!presentIds.has(String(sa.id))) {
      sanitized.push(sa);
    }
  }
  return sanitized;
}

/** Melindungi daftar periode tutup buku agar FINANCE hanya dapat menambah tutup buku tanpa membuka kembali periode yang sudah terkunci. */
export function protectClosedPeriodsOnSync(
  callerRole: string,
  incomingClosedPeriods: any[],
  existingClosedPeriods: any[]
): any[] {
  const role = String(callerRole || "").toUpperCase();
  const existing = Array.isArray(existingClosedPeriods) ? existingClosedPeriods : [];
  const incoming = Array.isArray(incomingClosedPeriods) ? incomingClosedPeriods : [];

  if (role === "SUPER_ADMIN" || role === "MANAGER") {
    return Array.isArray(incomingClosedPeriods) ? incoming : existing;
  }

  if (role === "FINANCE") {
    const mergedMap = new Map<string, any>();
    for (const row of incoming) {
      if (row?.period) mergedMap.set(String(row.period), row);
    }
    // Periode yang sudah ditutup tidak dapat dihapus atau ditimpa kembali oleh Finance
    for (const row of existing) {
      if (row?.period) mergedMap.set(String(row.period), row);
    }
    return Array.from(mergedMap.values());
  }

  return existing;
}

/** Mengunci mutasi transaksi/rekap/payroll pada periode yang sudah ditutup buku saat sinkronisasi ke server. */
export function enforceClosedPeriodDataLock<T>(
  incomingRows: T[],
  existingRows: T[],
  activeClosedPeriods: ReadonlyArray<{ period?: string | null }>,
  getRowPeriod: (row: T) => string
): T[] {
  const closedSet = new Set(
    (activeClosedPeriods || []).map((p) => String(p?.period || "").trim()).filter(Boolean)
  );
  if (closedSet.size === 0) {
    return Array.isArray(incomingRows) ? incomingRows : [];
  }

  const preservedLocked = (existingRows || []).filter((row) =>
    closedSet.has(String(getRowPeriod(row) || "").trim())
  );
  const editableIncoming = (incomingRows || []).filter(
    (row) => !closedSet.has(String(getRowPeriod(row) || "").trim())
  );
  return [...preservedLocked, ...editableIncoming];
}
