import {
  CashAccount,
  CashTransaction,
  DailySalesRecap,
  Employee,
  EmployeeContract,
  ExpenseCategory,
  Ingredient,
  PayrollRecord,
  Product,
  Recipe,
  SalesTransaction,
} from "../types";
import { getLocalDateString, getLocalPeriodString } from "./dateUtils";

const HRD_KEYWORDS = [
  "gaji",
  "upah",
  "bonus",
  "tunjangan",
  "kasbon",
  "lembur",
  "bpjs",
  "asuransi",
  "pelatihan",
  "seragam",
  "hrd",
  "sdm",
  "payroll",
];

export type OverheadBaselineSourceType =
  | "PREVIOUS_MONTH"
  | "CURRENT_MONTH"
  | "LATEST_MONTH"
  | "CONTRACTS_FALLBACK"
  | "DEFAULT";

export interface OverheadBaselineResult {
  referencePeriod: string | null;
  sourceType: OverheadBaselineSourceType;
  sourceLabel: string;
  monthlyPayroll: number;
  monthlyOperational: number;
  monthlyTotalOpex: number;
  monthlyStorePortions: number;
  hasActualPortions: boolean;
}

export interface ComputeAutoOverheadBaselineParams {
  cashTransactions: CashTransaction[];
  expenseCategories: ExpenseCategory[];
  payrollRecords: PayrollRecord[];
  employees?: Employee[];
  contracts?: EmployeeContract[];
  salesTransactions: SalesTransaction[];
  currentPeriod?: string;
  fallbackMonthlyPortions?: number;
}

export interface HppOverheadSimulationResult {
  monthlyTotalOpex: number;
  overheadPerPortion: number;
  fullCostPerPortion: number;
  estimatedNetProfitPerPortion: number;
  estimatedNetMarginPercent: number;
  bepMonthlyPortions: number | null;
  bepDailyPortions: number | null;
  menuMonthlyGrossProfit: number;
  menuOpexCoveragePercent: number;
  status: "NO_OPEX" | "LOSS" | "THIN" | "HEALTHY";
}

export interface CalculateHppOverheadSimulationParams {
  totalHpp: number;
  targetSellingPrice: number;
  monthlyPayroll: number;
  monthlyOperational: number;
  monthlyStorePortions: number;
  menuDailyVolume: number;
}

export type FnbCostStatus = "NEUTRAL" | "HEALTHY" | "WARNING" | "DANGER";

export interface FnbHealthMetricsResult {
  netSales: number;
  foodCostPercent: number;
  foodCostStatus: FnbCostStatus;
  laborCostPercent: number;
  laborCostStatus: FnbCostStatus;
  primeCostAmount: number;
  primeCostPercent: number;
  primeCostStatus: FnbCostStatus;
  nonLaborOpexAmount: number;
  nonLaborOpexPercent: number;
  grossProfit: number;
  grossMarginPercent: number;
  bepMonthlyRevenue: number | null;
  bepGapAmount: number | null;
  bepProgressPercent: number;
  isAboveBep: boolean;
}

export interface CalculateFnbHealthMetricsParams {
  netSales: number;
  effectiveCOGS: number;
  totalHrdExpense: number;
  totalOPEX: number;
}

/**
 * Mengembalikan periode bulan sebelumnya dalam format YYYY-MM,
 * termasuk rollover tahun dari Januari (YYYY-01) ke Desember tahun lalu.
 */
export function getPreviousPeriodString(currentPeriod: string): string {
  const trimmed = String(currentPeriod || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return getPreviousPeriodString(getLocalPeriodString());
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return getPreviousPeriodString(getLocalPeriodString());
  }

  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

function resolveCategoryType(
  expenseCategories: ExpenseCategory[],
  categoryId?: string | null
): string {
  if (!categoryId) return "PENGELUARAN";
  const cat = expenseCategories.find((c) => c.id === categoryId);
  if (!cat) return "PENGELUARAN";
  if (cat.type) return cat.type;
  if (cat.parentId) {
    const parent = expenseCategories.find((p) => p.id === cat.parentId);
    if (parent?.type) return parent.type;
  }
  return "PENGELUARAN";
}

function extractValidPeriod(dateOrPeriod: string | null | undefined): string | null {
  if (!dateOrPeriod) return null;
  const candidate = String(dateOrPeriod).trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(candidate) ? candidate : null;
}

function toPercent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.round(((numerator * 100) / denominator) * 100) / 100;
}

/**
 * Menghitung baseline otomatis beban Gaji/SDM, Operasional & Utilitas bulanan,
 * serta total porsi terjual toko untuk Simulasi Overhead & BEP di Kalkulator HPP.
 * Mengecualikan TRANSFER, OPENING, BAHAN_BAKU (COGS), dan ASET (CapEx).
 */
export function computeAutoOverheadBaseline(
  params: ComputeAutoOverheadBaselineParams
): OverheadBaselineResult {
  const {
    cashTransactions,
    expenseCategories,
    payrollRecords,
    employees = [],
    contracts = [],
    salesTransactions,
    currentPeriod,
    fallbackMonthlyPortions = 1500,
  } = params;

  const activeCurrentPeriod =
    extractValidPeriod(currentPeriod) || getLocalPeriodString();
  const prevPeriod = getPreviousPeriodString(activeCurrentPeriod);

  const hrdCashByPeriod: Record<string, number> = {};
  const operationalByPeriod: Record<string, number> = {};
  const payrollRecordsByPeriod: Record<string, number> = {};
  const salesPortionsByPeriod: Record<string, number> = {};

  for (const t of cashTransactions) {
    if (t.type !== "CASH_OUT") continue;
    const p = extractValidPeriod(t.date);
    if (!p) continue;

    const ref = String(t.referenceId || "");
    const catText = String(t.category || "").toLowerCase();
    if (
      ref.startsWith("TRANSFER:") ||
      ref.startsWith("OPENING:") ||
      catText === "transfer antar kas" ||
      catText === "saldo awal"
    ) {
      continue;
    }

    const catType = resolveCategoryType(expenseCategories, t.categoryId);
    if (
      catType === "BAHAN_BAKU" ||
      t.categoryId === "cat-bahan-baku" ||
      catText.includes("bahan")
    ) {
      continue;
    }

    // CapEx pembelian aset tidak boleh mendistorsi simulasi beban bulanan rutin
    if (catType === "ASET") {
      continue;
    }

    const amount = Number.isFinite(t.amount) ? Math.max(0, t.amount) : 0;
    if (amount <= 0) continue;

    const isHrd =
      catType === "HRD" ||
      t.categoryId === "cat-hrd" ||
      (!t.categoryId && HRD_KEYWORDS.some((kw) => catText.includes(kw)));

    if (isHrd) {
      hrdCashByPeriod[p] = (hrdCashByPeriod[p] || 0) + amount;
    } else if (
      catType === "UTILITAS" ||
      t.categoryId === "cat-utilitas" ||
      catType === "PENGELUARAN" ||
      catType === "LAINNYA"
    ) {
      operationalByPeriod[p] = (operationalByPeriod[p] || 0) + amount;
    }
  }

  for (const rec of payrollRecords) {
    if (rec.status !== "PAID" && rec.status !== "APPROVED") continue;
    const p = extractValidPeriod(rec.period);
    if (!p) continue;
    const netPay = Number.isFinite(rec.netPay) ? Math.max(0, rec.netPay) : 0;
    if (netPay <= 0) continue;
    payrollRecordsByPeriod[p] = (payrollRecordsByPeriod[p] || 0) + netPay;
  }

  for (const sale of salesTransactions) {
    const p = extractValidPeriod(sale.date);
    if (!p) continue;
    const qty = Number.isFinite(sale.quantitySold) ? Math.max(0, sale.quantitySold) : 0;
    if (qty <= 0) continue;
    salesPortionsByPeriod[p] = (salesPortionsByPeriod[p] || 0) + qty;
  }

  const getPeriodCosts = (p: string) => {
    const cashPayroll = Math.round(hrdCashByPeriod[p] || 0);
    const recordsPayroll = Math.round(payrollRecordsByPeriod[p] || 0);
    const periodPayroll = Math.round(cashPayroll > 0 ? cashPayroll : recordsPayroll);
    const periodOperational = Math.round(operationalByPeriod[p] || 0);
    return {
      periodPayroll,
      periodOperational,
      total: periodPayroll + periodOperational,
    };
  };

  let referencePeriod: string | null = null;
  let sourceType: OverheadBaselineSourceType = "DEFAULT";
  let sourceLabel = "Simulasi Default (Belum Ada Data)";
  let monthlyPayroll = 0;
  let monthlyOperational = 0;

  const prevCosts = getPeriodCosts(prevPeriod);
  const currentCosts = getPeriodCosts(activeCurrentPeriod);

  if (prevCosts.total > 0) {
    referencePeriod = prevPeriod;
    sourceType = "PREVIOUS_MONTH";
    sourceLabel = `Data Aktual ${prevPeriod} (Bulan Lalu)`;
    monthlyPayroll = prevCosts.periodPayroll;
    monthlyOperational = prevCosts.periodOperational;
  } else if (currentCosts.total > 0) {
    referencePeriod = activeCurrentPeriod;
    sourceType = "CURRENT_MONTH";
    sourceLabel = `Data Aktual ${activeCurrentPeriod} (Bulan Ini)`;
    monthlyPayroll = currentCosts.periodPayroll;
    monthlyOperational = currentCosts.periodOperational;
  } else {
    const historicalPeriods = Array.from(
      new Set([
        ...Object.keys(hrdCashByPeriod),
        ...Object.keys(operationalByPeriod),
        ...Object.keys(payrollRecordsByPeriod),
      ])
    )
      .filter((p) => p <= activeCurrentPeriod)
      .sort((a, b) => b.localeCompare(a));

    const latestWithCosts = historicalPeriods.find((p) => getPeriodCosts(p).total > 0);
    if (latestWithCosts) {
      const latestCosts = getPeriodCosts(latestWithCosts);
      referencePeriod = latestWithCosts;
      sourceType = "LATEST_MONTH";
      sourceLabel = `Data Aktual ${latestWithCosts}`;
      monthlyPayroll = latestCosts.periodPayroll;
      monthlyOperational = latestCosts.periodOperational;
    } else {
      const employeeMap = new Map(employees.map((e) => [e.id, e]));
      const activeContractsPayroll = contracts
        .filter((c) => {
          if (c.status !== "ACTIVE") return false;
          if (employees.length === 0) return true;
          const emp = employeeMap.get(c.employeeId);
          return emp ? emp.status === "AKTIF" : true;
        })
        .reduce((sum, c) => {
          const comp =
            (Number(c.basicSalary) || 0) +
            (Number(c.mealAllowance) || 0) +
            (Number(c.positionAllowance) || 0) +
            (Number(c.transportAllowance) || 0);
          return sum + Math.max(0, comp);
        }, 0);

      if (activeContractsPayroll > 0) {
        referencePeriod = null;
        sourceType = "CONTRACTS_FALLBACK";
        sourceLabel = "Estimasi Kontrak Karyawan Aktif";
        monthlyPayroll = Math.round(activeContractsPayroll);
        monthlyOperational = 0;
      }
    }
  }

  const candidatePortionPeriods = Array.from(
    new Set(
      [
        referencePeriod,
        prevPeriod,
        activeCurrentPeriod,
        ...Object.keys(salesPortionsByPeriod)
          .filter((p) => p <= activeCurrentPeriod)
          .sort((a, b) => b.localeCompare(a)),
      ].filter((p): p is string => Boolean(p))
    )
  );

  let monthlyStorePortions = Math.max(1, Math.round(fallbackMonthlyPortions));
  let hasActualPortions = false;

  for (const p of candidatePortionPeriods) {
    const qty = Math.round(salesPortionsByPeriod[p] || 0);
    if (qty > 0) {
      monthlyStorePortions = qty;
      hasActualPortions = true;
      break;
    }
  }

  return {
    referencePeriod,
    sourceType,
    sourceLabel,
    monthlyPayroll,
    monthlyOperational,
    monthlyTotalOpex: monthlyPayroll + monthlyOperational,
    monthlyStorePortions,
    hasActualPortions,
  };
}

/**
 * Menghitung simulasi alokasi overhead per porsi, Full Cost, estimasi laba bersih per porsi,
 * dan Break-Even Point (BEP) porsi untuk membantu penentuan harga jual menu tanpa mengubah HPP resmi.
 */
export function calculateHppOverheadSimulation(
  params: CalculateHppOverheadSimulationParams
): HppOverheadSimulationResult {
  const safeHpp = Number.isFinite(params.totalHpp) ? Math.max(0, params.totalHpp) : 0;
  const safePrice = Number.isFinite(params.targetSellingPrice)
    ? Math.max(0, params.targetSellingPrice)
    : 0;
  const safePayroll = Number.isFinite(params.monthlyPayroll)
    ? Math.max(0, Math.round(params.monthlyPayroll))
    : 0;
  const safeOps = Number.isFinite(params.monthlyOperational)
    ? Math.max(0, Math.round(params.monthlyOperational))
    : 0;
  const safeStorePortions = Number.isFinite(params.monthlyStorePortions)
    ? Math.max(0, Math.round(params.monthlyStorePortions))
    : 0;
  const safeDailyVolume = Number.isFinite(params.menuDailyVolume)
    ? Math.max(0, params.menuDailyVolume)
    : 0;

  const monthlyTotalOpex = Math.max(0, safePayroll + safeOps);
  const overheadPerPortion =
    monthlyTotalOpex > 0 && safeStorePortions > 0
      ? Math.round(monthlyTotalOpex / safeStorePortions)
      : 0;
  const fullCostPerPortion = Math.round(safeHpp + overheadPerPortion);
  const estimatedNetProfitPerPortion = Math.round(safePrice - fullCostPerPortion);
  const estimatedNetMarginPercent = toPercent(estimatedNetProfitPerPortion, safePrice);

  const grossProfitPerPortion = safePrice - safeHpp;
  const bepMonthlyPortions =
    monthlyTotalOpex > 0 && grossProfitPerPortion > 0
      ? Math.ceil(Number((monthlyTotalOpex / grossProfitPerPortion).toFixed(4)))
      : null;
  const bepDailyPortions =
    bepMonthlyPortions !== null ? Math.ceil(bepMonthlyPortions / 30) : null;

  const menuMonthlyGrossProfit = Math.round(
    Math.max(0, grossProfitPerPortion) * safeDailyVolume * 30
  );
  const menuOpexCoveragePercent = toPercent(menuMonthlyGrossProfit, monthlyTotalOpex);

  const status: HppOverheadSimulationResult["status"] =
    monthlyTotalOpex <= 0
      ? "NO_OPEX"
      : estimatedNetProfitPerPortion < 0
      ? "LOSS"
      : estimatedNetMarginPercent < 15
      ? "THIN"
      : "HEALTHY";

  return {
    monthlyTotalOpex,
    overheadPerPortion,
    fullCostPerPortion,
    estimatedNetProfitPerPortion,
    estimatedNetMarginPercent,
    bepMonthlyPortions,
    bepDailyPortions,
    menuMonthlyGrossProfit,
    menuOpexCoveragePercent,
    status,
  };
}

/**
 * Menghitung rasio kesehatan biaya standar F&B (Food Cost %, Labor Cost %, Prime Cost %)
 * serta Break-Even Point (BEP) Omzet Bulanan dari data Laba Rugi aktual.
 */
export function calculateFnbHealthMetrics(
  params: CalculateFnbHealthMetricsParams
): FnbHealthMetricsResult {
  const safeNetSales = Number.isFinite(params.netSales) ? Math.max(0, params.netSales) : 0;
  const safeCogs = Number.isFinite(params.effectiveCOGS)
    ? Math.max(0, params.effectiveCOGS)
    : 0;
  const safeHrd = Number.isFinite(params.totalHrdExpense)
    ? Math.max(0, params.totalHrdExpense)
    : 0;
  const safeOpex = Number.isFinite(params.totalOPEX) ? Math.max(0, params.totalOPEX) : 0;

  const primeCostAmount = Math.round(safeCogs + safeHrd);
  const nonLaborOpexAmount = Math.max(0, Math.round(safeOpex - safeHrd));
  const grossProfit = Math.round(safeNetSales - safeCogs);

  if (safeNetSales <= 0) {
    return {
      netSales: 0,
      foodCostPercent: 0,
      foodCostStatus: "NEUTRAL",
      laborCostPercent: 0,
      laborCostStatus: "NEUTRAL",
      primeCostAmount,
      primeCostPercent: 0,
      primeCostStatus: "NEUTRAL",
      nonLaborOpexAmount,
      nonLaborOpexPercent: 0,
      grossProfit,
      grossMarginPercent: 0,
      bepMonthlyRevenue: null,
      bepGapAmount: null,
      bepProgressPercent: 0,
      isAboveBep: false,
    };
  }

  const foodCostPercent = toPercent(safeCogs, safeNetSales);
  const foodCostStatus: FnbCostStatus =
    foodCostPercent <= 30 ? "HEALTHY" : foodCostPercent <= 35 ? "WARNING" : "DANGER";

  const laborCostPercent = toPercent(safeHrd, safeNetSales);
  const laborCostStatus: FnbCostStatus =
    laborCostPercent <= 25 ? "HEALTHY" : laborCostPercent <= 30 ? "WARNING" : "DANGER";

  const primeCostPercent = toPercent(primeCostAmount, safeNetSales);
  const primeCostStatus: FnbCostStatus =
    primeCostPercent <= 60 ? "HEALTHY" : primeCostPercent <= 65 ? "WARNING" : "DANGER";

  const nonLaborOpexPercent = toPercent(nonLaborOpexAmount, safeNetSales);
  const grossMarginPercent = toPercent(grossProfit, safeNetSales);

  let bepMonthlyRevenue: number | null = null;
  let bepGapAmount: number | null = null;
  let bepProgressPercent = 0;
  let isAboveBep = false;

  if (safeOpex <= 0) {
    bepMonthlyRevenue = 0;
    bepGapAmount = Math.round(safeNetSales);
    bepProgressPercent = 100;
    isAboveBep = true;
  } else if (grossProfit > 0) {
    const exactBep = (safeOpex * safeNetSales) / grossProfit;
    bepMonthlyRevenue = Math.ceil(Number(exactBep.toFixed(4)));
    bepGapAmount = Math.round(safeNetSales - bepMonthlyRevenue);
    bepProgressPercent = toPercent(safeNetSales, bepMonthlyRevenue);
    isAboveBep = safeNetSales >= bepMonthlyRevenue;
  }

  return {
    netSales: Math.round(safeNetSales),
    foodCostPercent,
    foodCostStatus,
    laborCostPercent,
    laborCostStatus,
    primeCostAmount,
    primeCostPercent,
    primeCostStatus,
    nonLaborOpexAmount,
    nonLaborOpexPercent,
    grossProfit,
    grossMarginPercent,
    bepMonthlyRevenue,
    bepGapAmount,
    bepProgressPercent,
    isAboveBep,
  };
}

// ─── Kategori Bahan Baku & Helper Normalisasi ────────────────────────────────

export const DEFAULT_INGREDIENT_CATEGORIES: string[] = [
  "Biji Kopi",
  "Susu & Dairy",
  "Sirup & Pemanis",
  "Bahan Olahan",
  "Bahan Kitchen",
  "Bahan Bakery",
  "Packaging & Cup",
  "Lainnya",
];

const INGREDIENT_CATEGORY_ALIASES: Record<string, string[]> = {
  "biji kopi": ["coffee", "biji kopi", "espresso", "bean"],
  "susu & dairy": ["dairy", "susu & dairy", "susu", "milk"],
  "sirup & pemanis": ["pemanis", "sirup & pemanis", "syrup", "sirup", "gula"],
  "bahan olahan": ["kondimen olahan", "bahan olahan", "olahan", "batch prep", "sub-recipe"],
  "bahan kitchen": ["kitchen", "bahan kitchen", "dapur"],
  "bahan bakery": ["bakery", "bahan bakery", "pastry", "roti"],
  "packaging & cup": ["packaging", "packaging & cup", "kemasan", "cup"],
};

/** Normalisasi nama kategori bahan baku lama ke label kategori kanonik. */
export function normalizeIngredientCategoryName(category?: string | null): string {
  const raw = String(category || "").trim();
  const lower = raw.toLowerCase();
  if (!lower) return "Lainnya";
  if (["coffee", "espresso", "bean"].includes(lower)) return "Biji Kopi";
  if (["dairy", "susu"].includes(lower)) return "Susu & Dairy";
  if (["pemanis", "sirup", "syrup"].includes(lower)) return "Sirup & Pemanis";
  if (["kondimen olahan", "bahan olahan", "olahan", "batch prep", "sub-recipe"].includes(lower)) {
    return "Bahan Olahan";
  }
  if (["kitchen", "dapur"].includes(lower)) return "Bahan Kitchen";
  if (["bakery", "pastry", "roti"].includes(lower)) return "Bahan Bakery";
  if (["packaging", "kemasan", "cup"].includes(lower)) return "Packaging & Cup";
  return raw;
}

/** Mengecek apakah kategori bahan cocok dengan filter kategori (mendukung alias lama). */
export function matchesIngredientCategory(
  ingredientCategory: string | undefined | null,
  selectedCategory: string
): boolean {
  if (!selectedCategory || selectedCategory === "ALL") return true;
  const normalizedTarget = selectedCategory.trim().toLowerCase();
  const normalizedIng = String(ingredientCategory || "").trim().toLowerCase();
  if (normalizedIng === normalizedTarget) return true;
  if (normalizeIngredientCategoryName(ingredientCategory).toLowerCase() === normalizedTarget) {
    return true;
  }
  const aliases = INGREDIENT_CATEGORY_ALIASES[normalizedTarget];
  return aliases ? aliases.includes(normalizedIng) : false;
}

// ─── Kalkulasi HPP + Overhead Persentase ─────────────────────────────────────

export interface HppWithOverheadParams {
  rawMaterialCost: number;
  packagingCost?: number;
  wastagePercent?: number;
  overheadPercent?: number;
}

export interface HppWithOverheadResult {
  rawMaterialCost: number;
  packagingCost: number;
  baseCostBeforePercentage: number;
  wastagePercent: number;
  wastageCost: number;
  overheadPercent: number;
  overheadCost: number;
  totalHpp: number;
}

/** Menghitung Total HPP per porsi dengan memasukkan Wastage (%) dan Overhead (%). */
export function calculateHppWithOverheadPercentage(
  params: HppWithOverheadParams
): HppWithOverheadResult {
  const rawMaterialCost = Number.isFinite(params.rawMaterialCost)
    ? Math.max(0, Math.round(params.rawMaterialCost))
    : 0;
  const packagingCost = Number.isFinite(params.packagingCost)
    ? Math.max(0, Math.round(params.packagingCost || 0))
    : 0;
  const baseCostBeforePercentage = rawMaterialCost + packagingCost;
  const wastagePercent = Number.isFinite(params.wastagePercent)
    ? Math.max(0, Number(params.wastagePercent || 0))
    : 0;
  const overheadPercent = Number.isFinite(params.overheadPercent)
    ? Math.max(0, Number(params.overheadPercent || 0))
    : 0;

  const wastageCost = Math.round(baseCostBeforePercentage * (wastagePercent / 100));
  const overheadCost = Math.round(baseCostBeforePercentage * (overheadPercent / 100));
  const totalHpp = Math.round(baseCostBeforePercentage + wastageCost + overheadCost);

  return {
    rawMaterialCost,
    packagingCost,
    baseCostBeforePercentage,
    wastagePercent,
    wastageCost,
    overheadPercent,
    overheadCost,
    totalHpp,
  };
}

// ─── Rekonsiliasi Penjualan, Omzet, & Arus Kas Terpusat ─────────────────────

/** Mengecek apakah transaksi kas adalah mutasi internal atau saldo awal (non-operasional). */
export function isNonOperationalCashTransaction(
  t: Pick<CashTransaction, "category" | "description" | "referenceId">
): boolean {
  const cat = String(t.category || "").trim().toLowerCase();
  const desc = String(t.description || "").trim().toUpperCase();
  const ref = String(t.referenceId || "").trim().toUpperCase();

  return (
    cat === "transfer" ||
    cat === "mutasi" ||
    cat === "mutasi kas" ||
    cat.includes("transfer kas") ||
    cat.includes("mutasi kas") ||
    cat === "saldo awal" ||
    desc.startsWith("TRANSFER:") ||
    desc.startsWith("OPENING:") ||
    ref.startsWith("TRF-") ||
    ref.startsWith("OPENING-")
  );
}

/** Mengecek apakah transaksi kas masuk berasal dari penjualan / omzet kasir. */
export function isSalesCashTransaction(
  t: Pick<CashTransaction, "type" | "category" | "categoryId" | "description" | "referenceId">,
  expenseCategories: ExpenseCategory[] = []
): boolean {
  if (t.type !== "CASH_IN") return false;
  if (isNonOperationalCashTransaction(t)) return false;

  const catId = String(t.categoryId || "").trim().toLowerCase();
  const catName = String(t.category || "").trim().toLowerCase();
  const desc = String(t.description || "").trim().toLowerCase();
  const ref = String(t.referenceId || "").trim().toLowerCase();

  if (catId === "cat-penjualan" || catName === "cat-penjualan") return true;
  if (ref.startsWith("pos-") || ref.startsWith("recap-") || ref.startsWith("sales-log-")) {
    return true;
  }

  const matchedCat = expenseCategories.find(
    (c) => c.id === t.categoryId || c.name === t.category
  );
  const resolvedName = (matchedCat?.name || t.category || "").toLowerCase();

  return (
    resolvedName.includes("penjualan") ||
    resolvedName.includes("omzet") ||
    resolvedName.includes("kasir") ||
    resolvedName.includes("pos") ||
    desc.includes("penjualan") ||
    desc.includes("rekap omzet")
  );
}

/** Mengambil nominal transaksi penjualan secara aman dari field kanonik totalPrice (plus fallback). */
export function getSaleTransactionAmount(s: SalesTransaction | Record<string, any>): number {
  const val =
    (s as any).totalPrice ??
    (s as any).finalAmount ??
    (s as any).totalAmount ??
    (s as any).total ??
    (s as any).subtotal ??
    0;
  const num = Number(val);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

export interface ComputePeriodFinancialSummaryParams {
  period: string; // "YYYY-MM" or "ALL"
  salesTransactions: SalesTransaction[];
  dailySalesRecaps?: DailySalesRecap[];
  cashTransactions: CashTransaction[];
  expenseCategories: ExpenseCategory[];
  payrollRecords?: PayrollRecord[];
  recipes?: Recipe[];
  ingredients?: Ingredient[];
  products?: Product[];
}

export interface DailyFinancialBreakdownRow {
  date: string;
  recapRevenue: number;
  salesTxRevenue: number;
  cashSalesInflow: number;
  recognizedRevenue: number;
  operationalCashIn: number;
  operationalCashOut: number;
}

export interface PeriodFinancialSummaryResult {
  period: string;
  recognizedRevenue: number;
  recapRevenue: number;
  salesTxRevenue: number;
  cashSalesInflow: number;
  otherCashInflow: number;
  totalOperationalCashIn: number;
  totalOperationalCashOut: number;
  netOperationalCashFlow: number;
  theoreticalCOGS: number;
  actualCogsExpense: number;
  effectiveCOGS: number;
  totalHrdExpense: number;
  totalUtilityExpense: number;
  totalGeneralOpsExpense: number;
  totalOPEX: number;
  grossProfit: number;
  netProfit: number;
  netMarginPercent: number;
  salesCogsMatchedCount: number;
  totalSalesQty: number;
  dailyBreakdown: DailyFinancialBreakdownRow[];
}

/**
 * Menghitung ringkasan penjualan, arus kas operasional, HPP/COGS, dan laba rugi periode
 * secara terpusat tanpa double-counting antar Rekap Harian, Import/POS Sales, dan Arus Kas.
 */
export function computePeriodFinancialSummary(
  params: ComputePeriodFinancialSummaryParams
): PeriodFinancialSummaryResult {
  const {
    period,
    salesTransactions,
    dailySalesRecaps = [],
    cashTransactions,
    expenseCategories,
    recipes = [],
    ingredients = [],
    products = [],
  } = params;

  const toLocalDateKey = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null;
    }
    return getLocalDateString(parsed);
  };

  const matchesPeriod = (rawDate: string | undefined | null) => {
    if (!period || period === "ALL") return true;
    const dayKey = toLocalDateKey(rawDate);
    if (dayKey) return dayKey.slice(0, 7) === period;
    return extractValidPeriod(rawDate) === period;
  };

  const dailyMap = new Map<
    string,
    {
      recapRevenue: number;
      salesTxRevenue: number;
      cashSalesInflow: number;
      operationalCashIn: number;
      operationalCashOut: number;
    }
  >();

  const getOrCreateDay = (dateStr: string) => {
    const existing = dailyMap.get(dateStr);
    if (existing) return existing;
    const blank = {
      recapRevenue: 0,
      salesTxRevenue: 0,
      cashSalesInflow: 0,
      operationalCashIn: 0,
      operationalCashOut: 0,
    };
    dailyMap.set(dateStr, blank);
    return blank;
  };

  let recapRevenue = 0;
  for (const r of dailySalesRecaps) {
    if (!matchesPeriod(r.date)) continue;
    const amt = Math.max(0, Math.round(Number(r.totalAmount) || 0));
    recapRevenue += amt;
    const dayKey = toLocalDateKey(r.date);
    if (dayKey) {
      getOrCreateDay(dayKey).recapRevenue += amt;
    }
  }

  let salesTxRevenue = 0;
  let theoreticalCOGS = 0;
  let salesCogsMatchedCount = 0;
  let totalSalesQty = 0;

  for (const s of salesTransactions) {
    if (!matchesPeriod(s.date)) continue;
    const amt = Math.max(0, getSaleTransactionAmount(s));
    const qty = Number(s.quantitySold) || 0;
    salesTxRevenue += amt;
    totalSalesQty += qty;

    const dayKey = toLocalDateKey(s.date);
    if (dayKey) {
      getOrCreateDay(dayKey).salesTxRevenue += amt;
    }

    if (qty > 0 && s.menuName) {
      const normalizedMenu = s.menuName.trim().toLowerCase();
      const recipe = recipes.find(
        (r) => r.menuName.trim().toLowerCase() === normalizedMenu
      );
      if (recipe && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        const unitCost = recipe.ingredients.reduce((sum, ri) => {
          const ing = ingredients.find((i) => i.id === ri.ingredientId);
          return sum + (ing ? (Number(ing.costPerUnit) || 0) * ri.quantity : 0);
        }, 0);
        theoreticalCOGS += unitCost * qty;
        salesCogsMatchedCount++;
      } else if (products.length > 0) {
        let matchedUnitHpp = 0;
        let foundVariant = false;
        for (const p of products) {
          for (const v of p.variants || []) {
            const fullName = `${p.name} - ${v.name}`.trim().toLowerCase();
            if (
              fullName === normalizedMenu ||
              p.name.trim().toLowerCase() === normalizedMenu
            ) {
              if (Number(v.estimatedHpp) > 0) {
                matchedUnitHpp = Number(v.estimatedHpp);
                foundVariant = true;
                break;
              }
            }
          }
          if (foundVariant) break;
        }
        if (foundVariant) {
          theoreticalCOGS += matchedUnitHpp * qty;
          salesCogsMatchedCount++;
        }
      }
    }
  }
  theoreticalCOGS = Math.round(theoreticalCOGS);

  let cashSalesInflow = 0;
  let otherCashInflow = 0;
  let totalOperationalCashIn = 0;
  let totalOperationalCashOut = 0;
  let actualCogsExpense = 0;
  let totalHrdExpense = 0;
  let totalUtilityExpense = 0;
  let totalGeneralOpsExpense = 0;

  for (const t of cashTransactions) {
    if (!matchesPeriod(t.date)) continue;
    if (isNonOperationalCashTransaction(t)) continue;

    const amt = Math.max(0, Math.round(Number(t.amount) || 0));
    const dayKey = toLocalDateKey(t.date);

    if (t.type === "CASH_IN") {
      totalOperationalCashIn += amt;
      if (isSalesCashTransaction(t, expenseCategories)) {
        cashSalesInflow += amt;
        if (dayKey) getOrCreateDay(dayKey).cashSalesInflow += amt;
      } else {
        otherCashInflow += amt;
      }
      if (dayKey) getOrCreateDay(dayKey).operationalCashIn += amt;
    } else if (t.type === "CASH_OUT") {
      totalOperationalCashOut += amt;
      if (dayKey) getOrCreateDay(dayKey).operationalCashOut += amt;

      const catType = resolveCategoryType(expenseCategories, t.categoryId);
      const catText = String(t.category || "").toLowerCase();
      if (
        catType === "BAHAN_BAKU" ||
        t.categoryId === "cat-bahan-baku" ||
        catText.includes("bahan") ||
        catText.includes("cogs")
      ) {
        actualCogsExpense += amt;
      } else if (
        catType === "HRD" ||
        t.categoryId === "cat-hrd" ||
        (!t.categoryId && HRD_KEYWORDS.some((kw) => catText.includes(kw)))
      ) {
        totalHrdExpense += amt;
      } else if (
        catType === "UTILITAS" ||
        t.categoryId === "cat-utilitas" ||
        catText.includes("listrik") ||
        catText.includes("air") ||
        catText.includes("internet") ||
        catText.includes("utilitas")
      ) {
        totalUtilityExpense += amt;
      } else {
        totalGeneralOpsExpense += amt;
      }
    }
  }

  const dailyBreakdown: DailyFinancialBreakdownRow[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      recapRevenue: d.recapRevenue,
      salesTxRevenue: d.salesTxRevenue,
      cashSalesInflow: d.cashSalesInflow,
      recognizedRevenue: Math.max(
        d.recapRevenue,
        d.salesTxRevenue,
        d.cashSalesInflow
      ),
      operationalCashIn: d.operationalCashIn,
      operationalCashOut: d.operationalCashOut,
    }));

  const recognizedRevenue = dailyBreakdown.reduce(
    (sum, d) => sum + d.recognizedRevenue,
    0
  );

  const netOperationalCashFlow = totalOperationalCashIn - totalOperationalCashOut;
  const effectiveCOGS = theoreticalCOGS > 0 ? theoreticalCOGS : actualCogsExpense;
  const totalOPEX = totalHrdExpense + totalUtilityExpense + totalGeneralOpsExpense;
  const grossProfit = Math.round(recognizedRevenue - effectiveCOGS);
  const netProfit = Math.round(recognizedRevenue - effectiveCOGS - totalOPEX);
  const netMarginPercent =
    recognizedRevenue > 0 ? (netProfit / recognizedRevenue) * 100 : 0;

  return {
    period,
    recognizedRevenue,
    recapRevenue,
    salesTxRevenue,
    cashSalesInflow,
    otherCashInflow,
    totalOperationalCashIn,
    totalOperationalCashOut,
    netOperationalCashFlow,
    theoreticalCOGS,
    actualCogsExpense,
    effectiveCOGS,
    totalHrdExpense,
    totalUtilityExpense,
    totalGeneralOpsExpense,
    totalOPEX,
    grossProfit,
    netProfit,
    netMarginPercent,
    salesCogsMatchedCount,
    totalSalesQty,
    dailyBreakdown,
  };
}

export interface RecoverCashPositionsParams {
  cashAccounts: CashAccount[];
  cashTransactions: CashTransaction[];
  expenseCategories: ExpenseCategory[];
}

export interface RecoverCashPositionsResult {
  recoveredAccounts: CashAccount[];
  recoveredCategories: ExpenseCategory[];
  addedAccounts: CashAccount[];
  addedCategories: ExpenseCategory[];
  addedAccountCount: number;
  addedCategoryCount: number;
}

const SYSTEM_TX_CATEGORY_SKIP = new Set([
  "",
  "-",
  "lainnya",
  "lain-lain",
  "penjualan",
  "penjualan toko",
  "penjualan menu & kasir",
  "saldo awal",
  "transfer",
  "transfer kas",
  "transfer internal",
  "transfer internal kas",
  "transfer antar kas",
  "mutasi saldo",
]);

function inferRecoveredAccountType(
  name: string,
  paymentMethod: string,
  accountId: string
): CashAccount["type"] {
  const combined = `${name} ${paymentMethod} ${accountId}`.toLowerCase();
  if (
    combined.includes("tabungan") ||
    combined.includes("cadangan") ||
    combined.includes("saving")
  ) {
    return "SAVINGS";
  }
  if (
    combined.includes("qris") ||
    combined.includes("gopay") ||
    combined.includes("ovo") ||
    combined.includes("dana") ||
    combined.includes("shopeepay") ||
    combined.includes("e-wallet") ||
    combined.includes("ewallet") ||
    combined.includes("dompet digital")
  ) {
    return "E_WALLET";
  }
  if (
    (combined.includes("tunai") ||
      combined.includes("petty") ||
      combined.includes("laci") ||
      combined.includes("drawer") ||
      combined.includes("cash") ||
      combined.includes("kas kecil") ||
      combined.includes("kas operasional")) &&
    !combined.includes("bank") &&
    !combined.includes("rekening") &&
    !combined.includes("bca") &&
    !combined.includes("mandiri") &&
    !combined.includes("bri") &&
    !combined.includes("bni")
  ) {
    return "CASH";
  }
  return "BANK";
}

function extractRecoveredAccountName(
  accountId: string,
  relatedTransactions: CashTransaction[]
): string | null {
  for (const tx of relatedTransactions) {
    const desc = String(tx.description || "").trim();
    const ref = String(tx.referenceId || "").trim();

    // Pola Saldo Awal Pembukaan Pos Kas (Nama Pos)
    const openMatch = /Saldo Awal(?: Pembukaan)? Pos Kas\s*\(([^)]+)\)/i.exec(desc);
    if (openMatch?.[1]?.trim()) {
      return openMatch[1].trim();
    }

    // Pola Rekap Penjualan / Deskripsi POS yang mencantumkan nama rekening
    if (ref.startsWith("OPENING:") && desc) {
      const paren = /\(([^)]+)\)/.exec(desc);
      if (paren?.[1]?.trim()) return paren[1].trim();
    }

    // Pola Transfer: "Transfer ke Rekening BCA (dari Laci Kasir)" atau "Transfer dari Kas -> Bank BCA"
    const arrowMatch = /Transfer[^:]*:\s*([^(\n]+?)\s*(?:->|→|ke)\s*([^(\n]+)/i.exec(desc);
    if (arrowMatch) {
      if (tx.type === "CASH_OUT" && arrowMatch[1]?.trim()) return arrowMatch[1].trim();
      if (tx.type === "CASH_IN" && arrowMatch[2]?.trim()) return arrowMatch[2].trim();
    }

    const transferTargetMatch = /Transfer\s+(?:ke|dari)\s+([^\(\[\-:]+?)(?:\s*[\(\[]|$)/i.exec(desc);
    if (transferTargetMatch?.[1]?.trim() && relatedTransactions.length === 1) {
      const candidate = transferTargetMatch[1].trim();
      // Jika transaksi tunggal keluar "Transfer ke Tujuan", nama rekening ini adalah pengirimnya bukan tujuan
      if (tx.type === "CASH_IN" && /Transfer dari/i.test(desc)) return candidate;
      if (tx.type === "CASH_OUT" && /Transfer ke/i.test(desc)) continue;
    }
  }

  // Fallback deskriptif berdasarkan paymentMethod atau ID rekening
  const firstPm = relatedTransactions
    .map((t) => String(t.paymentMethod || "").trim())
    .find(Boolean) || "";
  const pmLower = firstPm.toLowerCase();
  const idLower = accountId.toLowerCase();

  if (idLower === "cash-drawer-main" || idLower.includes("cash-drawer")) {
    return "Laci Kasir Utama";
  }
  if (idLower === "bank-bca-main") {
    return "Rekening Bank / QRIS Utama";
  }

  const shortTag = accountId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "POS";
  if (pmLower.includes("tunai") || pmLower.includes("cash") || idLower.includes("cash")) {
    return `Pos Kas Tunai (${shortTag})`;
  }
  if (pmLower.includes("qris") || pmLower.includes("wallet")) {
    return `Pos QRIS / Dompet (${shortTag})`;
  }
  if (firstPm) {
    return `Pos ${firstPm} (${shortTag})`;
  }
  return `Pos Kas Terpulihkan (${shortTag})`;
}

/**
 * Memulihkan secara otomatis Pos Kas (`cash_accounts`) dan Pos Kategori (`expense_categories`)
 * yang hilang/terhapus dari daftar master namun masih direferensikan oleh transaksi arus kas.
 */
export function recoverOrphanCashAccountsAndCategories(
  params: RecoverCashPositionsParams
): RecoverCashPositionsResult {
  const existingAccounts = Array.isArray(params.cashAccounts) ? params.cashAccounts : [];
  const transactions = Array.isArray(params.cashTransactions) ? params.cashTransactions : [];
  const existingCategories = Array.isArray(params.expenseCategories) ? params.expenseCategories : [];

  const recoveredAccounts: CashAccount[] = [];
  const accountIdSet = new Set<string>();
  const addedAccounts: CashAccount[] = [];

  for (const acc of existingAccounts) {
    if (!acc?.id || accountIdSet.has(acc.id)) continue;
    accountIdSet.add(acc.id);
    recoveredAccounts.push(acc);
  }

  // Kumpulkan transaksi per accountId yang hilang dari daftar master cashAccounts
  const orphanTxByAccount = new Map<string, CashTransaction[]>();
  for (const tx of transactions) {
    const accId = String(tx?.accountId || "").trim();
    if (!accId || accountIdSet.has(accId)) continue;
    const list = orphanTxByAccount.get(accId) || [];
    list.push(tx);
    orphanTxByAccount.set(accId, list);
  }

  for (const [accId, relatedTxs] of orphanTxByAccount.entries()) {
    const firstPm = relatedTxs.map((t) => String(t.paymentMethod || "")).find(Boolean) || "";
    const inferredName = extractRecoveredAccountName(accId, relatedTxs) || "Pos Kas Terpulihkan";
    const inferredType = inferRecoveredAccountType(inferredName, firstPm, accId);
    const restored: CashAccount = {
      id: accId,
      name: inferredName,
      type: inferredType,
      isDefault: accId === "cash-drawer-main" || recoveredAccounts.length === 0,
    };
    accountIdSet.add(accId);
    recoveredAccounts.push(restored);
    addedAccounts.push(restored);
  }

  // Pastikan selalu ada pos kas dasar bila database benar-benar kosong
  if (recoveredAccounts.length === 0) {
    const defaults: CashAccount[] = [
      { id: "cash-drawer-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true },
      { id: "bank-bca-main", name: "Rekening Bank / QRIS Utama", type: "BANK", isDefault: false },
    ];
    for (const def of defaults) {
      accountIdSet.add(def.id);
      recoveredAccounts.push(def);
      addedAccounts.push(def);
    }
  }

  // Pulihkan custom ExpenseCategory (Pos Pengeluaran / Pemasukan) yang hilang
  const recoveredCategories: ExpenseCategory[] = [];
  const catIdSet = new Set<string>();
  const catNameSet = new Set<string>();
  const addedCategories: ExpenseCategory[] = [];

  for (const cat of existingCategories) {
    if (!cat?.id || catIdSet.has(cat.id)) continue;
    catIdSet.add(cat.id);
    catNameSet.add(String(cat.name || "").trim().toLowerCase());
    recoveredCategories.push(cat);
  }

  for (const tx of transactions) {
    if (isNonOperationalCashTransaction(tx)) continue;
    const rawCatStr = String(tx.category || "").trim();
    const parts = rawCatStr.split(">").map((p) => p.trim()).filter(Boolean);
    const leafName = parts.length > 0 ? parts[parts.length - 1] : rawCatStr;
    const leafLower = leafName.toLowerCase();
    const txCatId = tx.categoryId ? String(tx.categoryId).trim() : "";

    if (txCatId && catIdSet.has(txCatId)) continue;
    if (leafName && catNameSet.has(leafLower)) continue;
    if (!txCatId && (!leafName || SYSTEM_TX_CATEGORY_SKIP.has(leafLower))) continue;
    if (leafName && SYSTEM_TX_CATEGORY_SKIP.has(leafLower) && !txCatId) continue;

    const newCatId =
      txCatId ||
      `cat-recovered-${leafLower.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "custom"}`;
    if (catIdSet.has(newCatId)) continue;

    const catName = leafName || "Pos Terpulihkan";
    const isIncome = tx.type === "CASH_IN";
    const restoredCat: ExpenseCategory = {
      id: newCatId,
      name: catName,
      type: isIncome ? "PENDAPATAN" : "PENGELUARAN",
      parentId: null,
      color: isIncome ? "#059669" : "#1b2cc0",
      icon: "tag",
      isActive: true,
      sortOrder: 90,
    };
    catIdSet.add(newCatId);
    catNameSet.add(catName.toLowerCase());
    recoveredCategories.push(restoredCat);
    addedCategories.push(restoredCat);
  }

  return {
    recoveredAccounts,
    recoveredCategories,
    addedAccounts,
    addedCategories,
    addedAccountCount: addedAccounts.length,
    addedCategoryCount: addedCategories.length,
  };
}
