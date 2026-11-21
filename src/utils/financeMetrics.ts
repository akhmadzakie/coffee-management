import {
  CashTransaction,
  Employee,
  EmployeeContract,
  ExpenseCategory,
  PayrollRecord,
  SalesTransaction,
} from "../types";
import { getLocalPeriodString } from "./dateUtils";

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
