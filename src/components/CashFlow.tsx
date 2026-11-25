import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { getLocalDateString } from "../utils/dateUtils";
import {
  addDaysToLocalDate,
  getLocalPeriodFromTimestamp,
  resolveCategoryMatchForImport,
  validateCashPeriodAccess,
} from "../utils/syncSanitizers";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ConfirmModal } from "./common/ConfirmModal";
import { CustomSelect } from "./common/CustomSelect";
import { motion, AnimatePresence } from "motion/react";
import { CustomDatePicker } from "./common/CustomDatePicker";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CurrencyInput } from "./common/CurrencyInput";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Edit3,
  Wallet,
  Building2,
  Landmark,
  Smartphone,
  CheckCircle,
  CheckCircle2,
  Tag,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Receipt,
  Layers,
  X,
  Calendar,
  Store,
  FileText,
  Package,
  Calculator,
  RotateCcw,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Info,
  Lock,
  Eye,
} from "lucide-react";
import {
  CashAccount,
  CashTransaction,
  CashTransactionItem,
  StockMovement,
} from "../types";
import {
  calculateCashFlowHppSync,
  getIngredientPackagingChoices,
  getPackagingSelectValue,
} from "../utils/posDomainLogic";
import {
  computeCashLiquidityBreakdown,
  computePeriodFinancialSummary,
  parseBankStatementAmount,
} from "../utils/financeMetrics";
import { CsvImportExport } from "./common/CsvImportExport";

interface CashFlowProps {
  onNavigate?: (view: any) => void;
}

interface DraftItemRow {
  id: string;
  ingredientId?: string;
  unitMode?: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM";
  conversionFactor?: string;
  name: string;
  qty: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
  lastEdited: "unit" | "total";
}

const UNIT_OPTIONS = [
  "pcs",
  "pack",
  "kg",
  "gr",
  "liter",
  "ml",
  "dus",
  "btl",
  "kaleng",
  "ikat",
  "tabung",
  "porsi",
  "set",
  "bulan",
];

const createEmptyItemRow = (): DraftItemRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  ingredientId: "",
  unitMode: "PURCHASE",
  conversionFactor: "1",
  name: "",
  qty: "1",
  unit: "pcs",
  unitPrice: "",
  totalPrice: "",
  lastEdited: "unit",
});

const formatUnitCost = (value: number): string => {
  const num = Number(value) || 0;
  return `Rp ${num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

export const CashFlow: React.FC<CashFlowProps> = ({ onNavigate }) => {
  const {
    currentUser,
    cashTransactions,
    addCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,
    cashAccounts,
    addCashAccount,
    updateCashAccount,
    deleteCashAccount,
    isReadOnly,
    expenseCategories,
    restoreDefaultExpenseCategories,
    restoreMissingCashPositions,
    salesTransactions,
    salesImportLogs,
    closedPeriods,
    ingredients,
    updateIngredient,
    products,
    updateProduct,
    recipes,
    batchPreparations,
    dailySalesRecaps,
    syncMissingSalesToCashFlow,
    purchaseOrders = [],
    addStockMovement,
  } = useStore();

  const unsyncedSalesStats = useMemo(() => {
    const summary = computePeriodFinancialSummary({
      period: "ALL",
      salesTransactions,
      dailySalesRecaps,
      cashTransactions,
      expenseCategories,
      recipes,
      ingredients,
      products,
    });
    const closedSet = new Set(closedPeriods.map((p: any) => p.period));
    let missingDays = 0;
    let missingAmount = 0;
    summary.dailyBreakdown.forEach((day) => {
      if (closedSet.has(day.date.slice(0, 7))) return;
      const gap = Math.round(
        day.recognizedRevenue - day.cashSalesInflow - day.pendingNonCash
      );
      if (gap > 0) {
        missingDays++;
        missingAmount += gap;
      }
    });
    return { missingDays, missingAmount };
  }, [
    salesTransactions,
    dailySalesRecaps,
    cashTransactions,
    expenseCategories,
    recipes,
    ingredients,
    products,
    closedPeriods,
  ]);

  // ─── Filter States ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CASH_IN" | "CASH_OUT" | "TRANSFER">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [periodMode, setPeriodMode] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getLocalDateString().slice(0, 7)
  );
  const [customStartDate, setCustomStartDate] = useState<string>(() => getLocalDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(() => getLocalDateString());

  // ─── Modal States ───────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrx, setEditingTrx] = useState<CashTransaction | null>(null);
  const [trxType, setTrxType] = useState<"CASH_IN" | "CASH_OUT" | "TRANSFER">("CASH_OUT");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Form fields for Add/Edit Transaction
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formToAccountId, setFormToAccountId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(() => getLocalDateString());
  const [formAmount, setFormAmount] = useState<string>("");
  const [formParentCategoryId, setFormParentCategoryId] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formCustomCategory, setFormCustomCategory] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formVendorName, setFormVendorName] = useState<string>("");
  const [formReceiptNo, setFormReceiptNo] = useState<string>("");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("Tunai");
  const [useItemBreakdown, setUseItemBreakdown] = useState<boolean>(true);
  const [itemRows, setItemRows] = useState<DraftItemRow[]>([createEmptyItemRow()]);
  const [syncIngredientPrices, setSyncIngredientPrices] = useState<boolean>(true);
  const [alsoAddToStock, setAlsoAddToStock] = useState<boolean>(true);
  const [priceSyncMethod, setPriceSyncMethod] = useState<"LAST_PRICE" | "WEIGHTED_AVERAGE">("LAST_PRICE");

  // Account Modal States (Add / Edit Pos Kas)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashAccount | null>(null);
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<"BANK" | "CASH" | "SAVINGS" | "E_WALLET">("CASH");
  const [accOpeningBalance, setAccOpeningBalance] = useState("");
  const [accOpeningDate, setAccOpeningDate] = useState(() => getLocalDateString());

  // Verification Modal State
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getNormalizedType = (type: any): "CASH_IN" | "CASH_OUT" | "TRANSFER" => {
    if (type === "TRANSFER") return "TRANSFER";
    if (type === "OUT" || type === "EXPENSE" || type === "CASH_OUT") return "CASH_OUT";
    return "CASH_IN";
  };

  const isInternalTransfer = (trx: CashTransaction): boolean => {
    if (trx.type === "TRANSFER") return true;
    const ref = String(trx.referenceId || "");
    if (ref.startsWith("TRANSFER:")) return true;
    return String(trx.category || "").toLowerCase() === "transfer antar kas";
  };

  const getLinkedModuleSource = (trx: CashTransaction): string | null => {
    const ref = String(trx.referenceId || "").trim();
    if (!ref) return null;
    if (
      ref.startsWith("recap-cash:") ||
      ref.startsWith("recap-noncash:") ||
      ref.startsWith("recap-mdr:") ||
      dailySalesRecaps.some((r) => r.id === ref)
    ) {
      return "Rekap Omzet";
    }
    const cleanPoRef = ref.startsWith("po:") ? ref.slice(3) : ref;
    if (purchaseOrders.some((po) => po.id === ref || po.id === cleanPoRef)) {
      return "Pembelian (PO)";
    }
    if (
      ref.startsWith("pay-") ||
      (trx.categoryId === "cat-hrd" && ref.toLowerCase().includes("payroll"))
    ) {
      return "Payroll";
    }
    return null;
  };

  const unverifiedSalesLogs = useMemo(() => {
    return salesImportLogs.filter((log) => {
      if (log.status !== "SUCCESS") return false;
      const isVerified = cashTransactions.some((c) => c.referenceId === log.id);
      return !isVerified;
    });
  }, [salesImportLogs, cashTransactions]);

  // ─── Calculate Current Balances & Chronological Running Balances ──────────
  const { accountBalances, runningBalanceByTrxId } = useMemo(() => {
    const balances: Record<string, number> = {};
    cashAccounts.forEach((acc) => {
      balances[acc.id] = 0;
    });

    // Sort all transactions oldest -> newest for accurate running balance
    const chronological = [...cashTransactions].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      return String(a.id).localeCompare(String(b.id));
    });

    const runningPerAccount: Record<string, number> = {};
    const runningAllMap: Record<string, number> = {};
    const runningAccountMap: Record<string, number> = {};
    let totalRunning = 0;

    chronological.forEach((trx) => {
      if (balances[trx.accountId] === undefined) balances[trx.accountId] = 0;
      if (runningPerAccount[trx.accountId] === undefined) runningPerAccount[trx.accountId] = 0;

      const norm = getNormalizedType(trx.type);
      const delta = norm === "CASH_IN" ? Number(trx.amount || 0) : norm === "CASH_OUT" ? -Number(trx.amount || 0) : 0;

      balances[trx.accountId] += delta;
      runningPerAccount[trx.accountId] += delta;
      totalRunning += delta;

      runningAccountMap[trx.id] = runningPerAccount[trx.accountId];
      runningAllMap[trx.id] = totalRunning;
    });

    return {
      accountBalances: balances,
      runningBalanceByTrxId: selectedAccountId === "all" ? runningAllMap : runningAccountMap,
    };
  }, [cashTransactions, cashAccounts, selectedAccountId]);

  const liquidityBreakdown = useMemo(() => {
    return computeCashLiquidityBreakdown(cashAccounts, cashTransactions);
  }, [cashAccounts, cashTransactions]);

  const totalBalance = liquidityBreakdown.totalLiquidity;

  // ─── Date Filter Matcher ────────────────────────────────────────────────────
  const matchesPeriod = (isoDate: string): boolean => {
    if (periodMode === "ALL") return true;
    const localDay = getLocalDateString(new Date(isoDate));
    const todayStr = getLocalDateString();

    if (periodMode === "TODAY") {
      return localDay === todayStr;
    }
    if (periodMode === "WEEK") {
      const minDay = addDaysToLocalDate(todayStr, -6);
      return localDay >= minDay && localDay <= todayStr;
    }
    if (periodMode === "MONTH") {
      return localDay.startsWith(selectedMonth);
    }
    if (periodMode === "CUSTOM") {
      let start = customStartDate;
      let end = customEndDate;
      if (start && end && start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      if (start && localDay < start) return false;
      if (end && localDay > end) return false;
      return true;
    }
    return true;
  };

  // ─── Scoped Transactions for KPI Cards (Respecting Account & Period) ──────
  const scopeTransactions = useMemo(() => {
    return cashTransactions.filter((trx) => {
      if (selectedAccountId !== "all" && trx.accountId !== selectedAccountId) return false;
      if (!matchesPeriod(trx.date)) return false;
      return true;
    });
  }, [cashTransactions, selectedAccountId, periodMode, selectedMonth, customStartDate, customEndDate]);

  const { totalCashIn, totalCashOut } = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;

    scopeTransactions.forEach((t) => {
      // Saat melihat "Semua Pos Kas", abaikan mutasi transfer internal agar tidak terhitung ganda sebagai pemasukan & pengeluaran
      if (selectedAccountId === "all" && isInternalTransfer(t)) return;
      const norm = getNormalizedType(t.type);
      if (norm === "CASH_IN") cashIn += Number(t.amount || 0);
      else if (norm === "CASH_OUT") cashOut += Number(t.amount || 0);
    });

    return { totalCashIn: cashIn, totalCashOut: cashOut };
  }, [scopeTransactions, selectedAccountId]);

  const netCashFlow = totalCashIn - totalCashOut;

  // ───Filtered Transactions for Table / Mobile List ─────────────────────────
  const filteredTransactions = useMemo(() => {
    // Jika filter kategori memilih Kategori Utama (Root), tampilkan juga seluruh transaksi pada sub-kategori turunannya
    const matchedFilterRoot = expenseCategories.find(
      (c: any) => !c.parentId && (c.name === categoryFilter || c.id === categoryFilter)
    );
    const childNamesOfRoot = matchedFilterRoot
      ? new Set(
          expenseCategories
            .filter((c: any) => c.parentId === matchedFilterRoot.id)
            .map((c: any) => c.name)
        )
      : null;
    const childIdsOfRoot = matchedFilterRoot
      ? new Set(
          expenseCategories
            .filter((c: any) => c.parentId === matchedFilterRoot.id)
            .map((c: any) => c.id)
        )
      : null;

    return scopeTransactions
      .filter((f) => {
        if (typeFilter === "TRANSFER") {
          if (!isInternalTransfer(f)) return false;
        } else if (typeFilter !== "ALL") {
          if (getNormalizedType(f.type) !== typeFilter) return false;
        }
        if (categoryFilter !== "ALL") {
          const directMatch = f.category === categoryFilter || f.categoryId === categoryFilter;
          const childMatch =
            Boolean(matchedFilterRoot) &&
            (f.categoryId === matchedFilterRoot!.id ||
              (f.categoryId && childIdsOfRoot?.has(f.categoryId)) ||
              childNamesOfRoot?.has(f.category));
          if (!directMatch && !childMatch) {
            return false;
          }
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchDesc = (f.description || "").toLowerCase().includes(q);
          const matchCat = (f.category || "").toLowerCase().includes(q);
          const matchVendor = (f.vendorName || "").toLowerCase().includes(q);
          const matchReceipt = (f.receiptNo || "").toLowerCase().includes(q);
          const matchItems = Array.isArray(f.items)
            ? f.items.some((it) => (it.name || "").toLowerCase().includes(q))
            : false;
          if (!matchDesc && !matchCat && !matchVendor && !matchReceipt && !matchItems) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (diff !== 0) return diff;
        return String(b.id).localeCompare(String(a.id));
      });
  }, [scopeTransactions, typeFilter, categoryFilter, searchTerm, expenseCategories]);

  // ─── Category Helpers for Two-Step Cascading Selection (Kategori Utama -> Sub-Kategori) ──
  const activeRootCategories = useMemo(() => {
    return expenseCategories
      .filter((c: any) => !c.parentId && c.isActive !== false)
      .filter((c: any) =>
        trxType === "CASH_IN" ? c.type === "PENDAPATAN" : c.type !== "PENDAPATAN"
      )
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [expenseCategories, trxType]);

  const activeSubCategories = useMemo(() => {
    if (!formParentCategoryId) return [];
    return expenseCategories
      .filter((c: any) => c.parentId === formParentCategoryId && c.isActive !== false)
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [expenseCategories, formParentCategoryId]);

  const getCategoryHierarchyInfo = (trx: CashTransaction) => {
    const matched =
      expenseCategories.find((c: any) => c.id === trx.categoryId) ||
      expenseCategories.find(
        (c: any) =>
          c.name.toLowerCase() === String(trx.category || "").toLowerCase() ||
          c.id === trx.category
      );
    if (!matched) {
      return { parentName: null, categoryName: trx.category || "Lainnya" };
    }
    if (matched.parentId) {
      const parent = expenseCategories.find((c: any) => c.id === matched.parentId);
      return {
        parentName: parent?.name || null,
        categoryName: matched.name,
      };
    }
    return {
      parentName: null,
      categoryName: matched.name,
    };
  };

  // Available extra categories recorded on transactions (e.g. Transfer Antar Kas, Saldo Awal, custom)
  const extraFilterCategories = useMemo(() => {
    const activeCatNames = new Set(
      expenseCategories
        .filter((c: any) => c.isActive !== false && c.name)
        .map((c: any) => c.name.trim().toLowerCase())
    );
    const extraSet = new Set<string>();
    cashTransactions.forEach((t) => {
      const catName = String(t.category || "").trim();
      if (catName && !activeCatNames.has(catName.toLowerCase())) {
        extraSet.add(catName);
      }
    });
    return Array.from(extraSet).sort((a, b) => a.localeCompare(b, "id"));
  }, [cashTransactions, expenseCategories]);

  const sortedIngredients = useMemo(() => {
    return [...ingredients].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [ingredients]);

  const isBahanBakuCategory = useMemo(() => {
    if (trxType !== "CASH_OUT") return false;
    const parentCat = expenseCategories.find((c: any) => c.id === formParentCategoryId);
    const subCat = expenseCategories.find((c: any) => c.id === formCategoryId);
    const catsToCheck = [subCat, parentCat].filter(Boolean);
    return catsToCheck.some(
      (c: any) =>
        c.type === "BAHAN_BAKU" ||
        c.id === "cat-bahan-baku" ||
        c.parentId === "cat-bahan-baku" ||
        String(c.name || "").toLowerCase().includes("bahan baku")
    );
  }, [trxType, expenseCategories, formParentCategoryId, formCategoryId]);

  // ─── Two-Way Item Calculation Handlers ─────────────────────────────────────
  const recalculateTotalFromItems = (rows: DraftItemRow[]) => {
    const sum = rows.reduce((acc, r) => acc + (Number(r.totalPrice) || 0), 0);
    if (sum > 0) {
      setFormAmount(String(Math.round(sum)));
    }
  };

  const handleSelectRowIngredient = (rowId: string, selectedIngId: string) => {
    setItemRows((prev) => {
      const next = prev.map((row) => {
        if (row.id !== rowId) return row;
        if (!selectedIngId) {
          return {
            ...row,
            ingredientId: "",
            unitMode: "PURCHASE" as const,
            conversionFactor: "1",
            name: "",
            unit: "pcs",
          };
        }
        const ing = ingredients.find((i) => i.id === selectedIngId);
        if (!ing) return row;

        const hasPurchaseUnit = Boolean(ing.purchaseUnit && Number(ing.conversionFactor) > 0);
        const unitMode: "PURCHASE" | "BASE" = hasPurchaseUnit ? "PURCHASE" : "BASE";
        const factor = hasPurchaseUnit ? Number(ing.conversionFactor) : 1;
        const nextUnit = hasPurchaseUnit ? ing.purchaseUnit! : ing.unit;
        const defaultPrice = hasPurchaseUnit
          ? Math.round(
              Number(ing.purchasePrice) > 0
                ? Number(ing.purchasePrice)
                : Number(ing.costPerUnit || 0) * factor
            )
          : Number(ing.costPerUnit || 0);

        const qtyNum = parseFloat(row.qty);
        const validQty = !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : 1;

        return {
          ...row,
          ingredientId: ing.id,
          unitMode,
          conversionFactor: String(factor),
          name: ing.name,
          qty: !isNaN(qtyNum) && qtyNum > 0 ? row.qty : "1",
          unit: nextUnit,
          unitPrice: defaultPrice > 0 ? String(defaultPrice) : "",
          totalPrice: defaultPrice > 0 ? String(Math.round(validQty * defaultPrice)) : "",
          lastEdited: "unit" as const,
        };
      });

      recalculateTotalFromItems(next);
      return next;
    });
  };

  const handleRowPackagingChoiceChange = (rowId: string, choiceKey: string) => {
    setItemRows((prev) => {
      const next = prev.map((row) => {
        if (row.id !== rowId || !row.ingredientId) return row;
        const ing = ingredients.find((i) => i.id === row.ingredientId);
        if (!ing) return row;

        const choices = getIngredientPackagingChoices(ing);
        const chosen = choices.find((c) => c.key === choiceKey);
        if (!chosen) return row;

        let nextUnit = chosen.unit;
        let factor = chosen.factor;
        let defaultPrice = 0;

        if (chosen.mode === "CUSTOM") {
          nextUnit = row.unitMode === "CUSTOM" && row.unit.trim() ? row.unit : "Karton";
          const curFactor = parseFloat(row.conversionFactor || "");
          factor =
            row.unitMode === "CUSTOM" && !isNaN(curFactor) && curFactor > 0
              ? curFactor
              : Number(ing.conversionFactor) > 0
                ? Number(ing.conversionFactor)
                : 1;
          defaultPrice =
            Number(ing.costPerUnit || 0) > 0
              ? Math.round(Number(ing.costPerUnit) * factor)
              : 0;
        } else if (chosen.mode === "PURCHASE") {
          defaultPrice = Math.round(
            Number(ing.purchasePrice) > 0
              ? Number(ing.purchasePrice)
              : Number(ing.costPerUnit || 0) * factor
          );
        } else if (chosen.mode === "BASE") {
          defaultPrice = Number(ing.costPerUnit || 0);
        } else {
          // PRESET
          defaultPrice =
            Number(ing.costPerUnit || 0) > 0
              ? Math.round(Number(ing.costPerUnit) * factor)
              : 0;
        }

        const qtyNum = parseFloat(row.qty);
        const validQty = !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : 1;

        return {
          ...row,
          unitMode: chosen.mode,
          conversionFactor: String(factor),
          unit: nextUnit,
          unitPrice: defaultPrice > 0 ? String(defaultPrice) : "",
          totalPrice: defaultPrice > 0 ? String(Math.round(validQty * defaultPrice)) : "",
          lastEdited: "unit" as const,
        };
      });

      recalculateTotalFromItems(next);
      return next;
    });
  };

  const handleRowConversionFactorChange = (rowId: string, nextFactorStr: string) => {
    setItemRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, conversionFactor: nextFactorStr } : row
      )
    );
  };

  const handleItemRowChange = (
    rowId: string,
    field: "name" | "qty" | "unit" | "unitPrice" | "totalPrice",
    value: string
  ) => {
    setItemRows((prev) => {
      const next = prev.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };

        const qtyNum = parseFloat(field === "qty" ? value : updated.qty);
        const validQty = !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : 0;

        if (field === "unitPrice") {
          updated.lastEdited = "unit";
          const unitNum = parseFloat(value);
          if (!isNaN(unitNum) && unitNum >= 0 && validQty > 0) {
            updated.totalPrice = String(Math.round(validQty * unitNum));
          } else if (value === "") {
            updated.totalPrice = "";
          }
        } else if (field === "totalPrice") {
          updated.lastEdited = "total";
          const totalNum = parseFloat(value);
          if (!isNaN(totalNum) && totalNum >= 0 && validQty > 0) {
            updated.unitPrice = String(Math.round(totalNum / validQty));
          } else if (value === "") {
            updated.unitPrice = "";
          }
        } else if (field === "qty") {
          if (validQty > 0) {
            if (updated.lastEdited === "unit" && updated.unitPrice !== "") {
              const unitNum = parseFloat(updated.unitPrice);
              if (!isNaN(unitNum)) {
                updated.totalPrice = String(Math.round(validQty * unitNum));
              }
            } else if (updated.lastEdited === "total" && updated.totalPrice !== "") {
              const totalNum = parseFloat(updated.totalPrice);
              if (!isNaN(totalNum)) {
                updated.unitPrice = String(Math.round(totalNum / validQty));
              }
            }
          }
        }

        return updated;
      });

      recalculateTotalFromItems(next);
      return next;
    });
  };

  const handleAddItemRow = () => {
    setItemRows((prev) => [...prev, createEmptyItemRow()]);
  };

  const handleRemoveItemRow = (rowId: string) => {
    setItemRows((prev) => {
      const next = prev.length > 1 ? prev.filter((r) => r.id !== rowId) : [createEmptyItemRow()];
      recalculateTotalFromItems(next);
      return next;
    });
  };

  // ─── Preview Kalkulasi Harga Bahan Baku, Kondimen Olahan & HPP Menu ────────
  const hppSyncPreview = useMemo(() => {
    if (trxType !== "CASH_OUT" || !useItemBreakdown) {
      return {
        directUpdates: [],
        batchPrepUpdates: [],
        productsToUpdate: [],
        affectedVariantPreviews: [],
      };
    }

    return calculateCashFlowHppSync({
      itemRows,
      ingredients,
      batchPreparations,
      products,
      recipes,
      priceSyncMethod,
    });
  }, [
    trxType,
    useItemBreakdown,
    itemRows,
    ingredients,
    priceSyncMethod,
    batchPreparations,
    products,
    recipes,
  ]);

  // ─── Open Transaction Modal (Create vs Edit) ────────────────────────────────
  const openCreateModal = (initialType: "CASH_IN" | "CASH_OUT" | "TRANSFER" = "CASH_OUT") => {
    if (isReadOnly) return;
    setEditingTrx(null);
    setTrxType(initialType);
    const defaultAccId =
      selectedAccountId !== "all" ? selectedAccountId : cashAccounts[0]?.id || "";
    const secondAccId =
      cashAccounts.find((a) => a.id !== defaultAccId)?.id || cashAccounts[0]?.id || "";
    setFormAccountId(defaultAccId);
    setFormToAccountId(secondAccId);
    setFormDate(getLocalDateString());
    setFormAmount("");
    const defaultRoot = expenseCategories
      .filter((c: any) => !c.parentId && c.isActive !== false)
      .find((c: any) =>
        initialType === "CASH_IN" ? c.type === "PENDAPATAN" : c.type !== "PENDAPATAN"
      );
    setFormParentCategoryId(defaultRoot?.id || "");
    setFormCategoryId("");
    setFormCustomCategory("");
    setFormDescription("");
    setFormVendorName("");
    setFormReceiptNo("");
    setFormPaymentMethod("Tunai");
    setUseItemBreakdown(initialType === "CASH_OUT");
    setItemRows([createEmptyItemRow()]);
    setSyncIngredientPrices(true);
    setAlsoAddToStock(true);
    setPriceSyncMethod("LAST_PRICE");
    setIsModalOpen(true);
  };

  const openSavingsDepositModal = () => {
    if (isReadOnly) return;
    const firstSavings = cashAccounts.find((a) => a.type === "SAVINGS");
    if (!firstSavings) return;
    const sourceAcc =
      cashAccounts.find((a) => a.id !== firstSavings.id && a.type === "BANK") ||
      cashAccounts.find((a) => a.id !== firstSavings.id) ||
      firstSavings;
    setEditingTrx(null);
    setTrxType("TRANSFER");
    setFormAccountId(sourceAcc.id);
    setFormToAccountId(firstSavings.id);
    setFormDate(getLocalDateString());
    setFormAmount("");
    setFormParentCategoryId("");
    setFormCategoryId("");
    setFormCustomCategory("");
    setFormDescription("Sisihkan Dana ke Tabungan");
    setFormVendorName("");
    setFormReceiptNo("");
    setFormPaymentMethod("Transfer Internal");
    setUseItemBreakdown(false);
    setItemRows([createEmptyItemRow()]);
    setSyncIngredientPrices(false);
    setAlsoAddToStock(false);
    setIsModalOpen(true);
  };

  const openEditModal = (trx: CashTransaction) => {
    if (isReadOnly) return;
    const periodCheck = validateCashPeriodAccess({ date: trx.date, closedPeriods });
    if ("error" in periodCheck) {
      toast.error(periodCheck.error);
      return;
    }
    if (isInternalTransfer(trx) || String(trx.referenceId || "").startsWith("TRANSFER:")) {
      toast.warning(
        "Mutasi Transfer Antar Kas dibuat berpasangan agar saldo kedua rekening seimbang. Hapus lalu catat ulang transfer jika nominal atau rekening perlu diubah."
      );
      return;
    }
    const linkedSource = getLinkedModuleSource(trx);
    if (linkedSource) {
      toast.warning(
        `Transaksi ini tercatat otomatis dari modul ${linkedSource}. Silakan ubah dari modul ${linkedSource} agar saldo & laporan tetap sinkron.`
      );
      return;
    }
    setEditingTrx(trx);
    const normType = getNormalizedType(trx.type);
    const effectiveType = normType === "TRANSFER" ? "CASH_OUT" : normType;
    setTrxType(effectiveType);
    setFormAccountId(trx.accountId);
    setFormToAccountId("");
    setFormDate(getLocalDateString(new Date(trx.date)));
    setFormAmount(String(Math.round(Number(trx.amount || 0))));

    // Lacak Kategori Utama (Parent) & Sub-Kategori dari categoryId atau nama category
    const matchedCat =
      expenseCategories.find((c: any) => c.id === trx.categoryId) ||
      expenseCategories.find(
        (c: any) =>
          c.name.toLowerCase() === String(trx.category || "").toLowerCase() ||
          c.id === trx.category
      );

    if (matchedCat) {
      if (matchedCat.parentId) {
        setFormParentCategoryId(matchedCat.parentId);
        setFormCategoryId(matchedCat.id);
      } else {
        setFormParentCategoryId(matchedCat.id);
        setFormCategoryId(matchedCat.id);
      }
      setFormCustomCategory("");
    } else {
      const defaultRoot = expenseCategories
        .filter((c: any) => !c.parentId && c.isActive !== false)
        .find((c: any) =>
          effectiveType === "CASH_IN" ? c.type === "PENDAPATAN" : c.type !== "PENDAPATAN"
        );
      setFormParentCategoryId(defaultRoot?.id || "");
      setFormCategoryId("");
      setFormCustomCategory(trx.category || "");
    }

    setFormDescription(trx.description || "");
    setFormVendorName(trx.vendorName || "");
    setFormReceiptNo(trx.receiptNo || "");
    setFormPaymentMethod(trx.paymentMethod || "Tunai");

    if (Array.isArray(trx.items) && trx.items.length > 0) {
      setUseItemBreakdown(true);
      setItemRows(
        trx.items.map((it, idx) => {
          const matchedIng =
            (it.ingredientId ? ingredients.find((i) => i.id === it.ingredientId) : undefined) ||
            ingredients.find(
              (i) => i.name.trim().toLowerCase() === String(it.name || "").trim().toLowerCase()
            );
          const inferredUnitMode: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM" = it.unitMode
            ? it.unitMode
            : matchedIng?.purchaseUnit &&
                String(it.unit || "").toLowerCase() === matchedIng.purchaseUnit.toLowerCase()
              ? "PURCHASE"
              : matchedIng
                ? "BASE"
                : "PURCHASE";

          const inferredFactor =
            it.conversionFactor && Number(it.conversionFactor) > 0
              ? Number(it.conversionFactor)
              : inferredUnitMode === "BASE"
                ? 1
                : matchedIng?.conversionFactor && Number(matchedIng.conversionFactor) > 0
                  ? Number(matchedIng.conversionFactor)
                  : 1;

          return {
            id: `${idx}-${Date.now()}`,
            ingredientId: it.ingredientId || matchedIng?.id || "",
            unitMode: inferredUnitMode,
            conversionFactor: String(inferredFactor),
            name: it.name || "",
            qty: String(it.qty ?? 1),
            unit: it.unit || "pcs",
            unitPrice: String(Math.round(Number(it.unitPrice || 0))),
            totalPrice: String(Math.round(Number(it.totalPrice || 0))),
            lastEdited: "unit",
          };
        })
      );
    } else {
      setUseItemBreakdown(false);
      setItemRows([createEmptyItemRow()]);
    }
    setSyncIngredientPrices(false);
    setAlsoAddToStock(false);
    setPriceSyncMethod("LAST_PRICE");
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleAiDraftEvent = (e: Event) => {
      if (isReadOnly) return;
      const drafts = (e as CustomEvent)?.detail?.drafts;
      if (!Array.isArray(drafts) || drafts.length === 0) return;

      const first = drafts[0];
      const effectiveType: "CASH_IN" | "CASH_OUT" =
        first.type === "CASH_IN" ? "CASH_IN" : "CASH_OUT";

      setEditingTrx(null);
      setTrxType(effectiveType);

      const matchedAcc = cashAccounts.find(
        (a) =>
          a.id === first.accountId ||
          (first.accountName &&
            a.name.toLowerCase().includes(String(first.accountName).toLowerCase()))
      );
      setFormAccountId(
        matchedAcc?.id ||
          (selectedAccountId !== "all" ? selectedAccountId : cashAccounts[0]?.id || "")
      );
      setFormToAccountId("");
      setFormDate(getLocalDateString());

      const totalAmount = drafts.reduce(
        (sum: number, d: any) => sum + Math.round(Number(d.amount || 0)),
        0
      );
      setFormAmount(totalAmount > 0 ? String(totalAmount) : "");

      const hasIngredientLink = drafts.some((d: any) => Boolean(d.ingredientId));
      const matchedCat =
        effectiveType === "CASH_OUT" && hasIngredientLink
          ? expenseCategories.find(
              (c: any) =>
                !c.parentId &&
                (c.id === "cat-bahan-baku" ||
                  c.type === "BAHAN_BAKU" ||
                  /bahan baku/i.test(c.name))
            ) ||
            expenseCategories.find(
              (c: any) =>
                c.id === "cat-bahan-baku" ||
                c.type === "BAHAN_BAKU" ||
                /bahan baku/i.test(c.name)
            )
          : expenseCategories.find((c: any) => c.id === first.categoryId) ||
            expenseCategories.find(
              (c: any) =>
                c.name.toLowerCase() === String(first.category || "").toLowerCase() ||
                c.id === first.category
            );

      if (matchedCat) {
        if (matchedCat.parentId) {
          setFormParentCategoryId(matchedCat.parentId);
          setFormCategoryId(matchedCat.id);
        } else {
          setFormParentCategoryId(matchedCat.id);
          setFormCategoryId(matchedCat.id);
        }
        setFormCustomCategory("");
      } else {
        const defaultRoot = expenseCategories
          .filter((c: any) => !c.parentId && c.isActive !== false)
          .find((c: any) =>
            effectiveType === "CASH_IN" ? c.type === "PENDAPATAN" : c.type !== "PENDAPATAN"
          );
        setFormParentCategoryId(defaultRoot?.id || "");
        setFormCategoryId("");
        setFormCustomCategory(first.category || "");
      }

      const firstVendor = drafts.find((d: any) => d.vendorName)?.vendorName || "";
      const firstReceipt = drafts.find((d: any) => d.receiptNo)?.receiptNo || "";
      const combinedDesc = drafts
        .map((d: any) => d.description)
        .filter(Boolean)
        .join("; ");

      setFormVendorName(firstVendor);
      setFormReceiptNo(firstReceipt);
      setFormDescription(combinedDesc);
      setFormPaymentMethod(
        matchedAcc?.type === "BANK" || matchedAcc?.type === "E_WALLET"
          ? "Transfer"
          : "Tunai"
      );

      setUseItemBreakdown(true);
      setItemRows(
        drafts.map((d: any, idx: number) => {
          const matchedIng =
            (d.ingredientId
              ? ingredients.find((i) => i.id === d.ingredientId)
              : undefined) ||
            ingredients.find(
              (i) =>
                d.ingredientName &&
                i.name.trim().toLowerCase() === String(d.ingredientName).trim().toLowerCase()
            );
          const qty = Number(d.quantity) > 0 ? Number(d.quantity) : 1;
          const rowTotal = Math.round(Number(d.amount || 0));
          const unitPrice = qty > 0 ? Math.round(rowTotal / qty) : rowTotal;
          const inferredMode: "PURCHASE" | "BASE" | "PRESET" | "CUSTOM" = d.unitMode
            ? d.unitMode
            : matchedIng?.purchaseUnit &&
                String(d.unit || "").toLowerCase() === matchedIng.purchaseUnit.toLowerCase()
              ? "PURCHASE"
              : matchedIng
                ? "BASE"
                : "PURCHASE";
          const factor =
            Number(d.conversionFactor) > 0
              ? Number(d.conversionFactor)
              : inferredMode === "BASE"
                ? 1
                : matchedIng?.conversionFactor && Number(matchedIng.conversionFactor) > 0
                  ? Number(matchedIng.conversionFactor)
                  : 1;

          return {
            id: `ai-${idx}-${Date.now()}`,
            ingredientId: d.ingredientId || matchedIng?.id || "",
            unitMode: inferredMode,
            conversionFactor: String(factor),
            name: d.ingredientName || matchedIng?.name || d.description || "",
            qty: String(qty),
            unit: d.unit || matchedIng?.purchaseUnit || matchedIng?.unit || "pcs",
            unitPrice: unitPrice > 0 ? String(unitPrice) : "",
            totalPrice: rowTotal > 0 ? String(rowTotal) : "",
            lastEdited: "total" as const,
          };
        })
      );

      setSyncIngredientPrices(true);
      setAlsoAddToStock(true);
      setPriceSyncMethod("LAST_PRICE");
      setIsModalOpen(true);
    };

    window.addEventListener("open-cashflow-with-ai-draft", handleAiDraftEvent);
    return () => {
      window.removeEventListener("open-cashflow-with-ai-draft", handleAiDraftEvent);
    };
  }, [cashAccounts, expenseCategories, ingredients, selectedAccountId, isReadOnly]);

  // ─── Submit Create / Edit / Transfer ────────────────────────────────────────
  const handleTrxSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isReadOnly) return;

    const periodCheck = validateCashPeriodAccess({
      date: formDate,
      originalDate: editingTrx?.date,
      closedPeriods,
    });
    if ("error" in periodCheck) {
      toast.error(periodCheck.error);
      return;
    }

    // Build ISO date preserving time if editing same day or current time if today
    const todayStr = getLocalDateString();
    let isoDate: string;
    if (editingTrx && getLocalDateString(new Date(editingTrx.date)) === formDate) {
      isoDate = editingTrx.date;
    } else if (formDate === todayStr) {
      isoDate = new Date().toISOString();
    } else {
      const nowTime = new Date().toTimeString().slice(0, 8);
      isoDate = new Date(`${formDate}T${nowTime}+08:00`).toISOString();
    }

    // 1. Handle Internal Transfer Between Cash Accounts
    if (!editingTrx && trxType === "TRANSFER") {
      if (!formAccountId || !formToAccountId) {
        toast.warning("Pilih Pos Kas Asal dan Pos Kas Tujuan.");
        return;
      }
      if (formAccountId === formToAccountId) {
        toast.warning("Pos Kas Asal dan Pos Kas Tujuan tidak boleh sama.");
        return;
      }
      const transferAmount = Math.round(Number(formAmount) || 0);
      if (transferAmount <= 0) {
        toast.warning("Masukkan nominal transfer yang valid.");
        return;
      }

      const fromAcc = cashAccounts.find((a) => a.id === formAccountId);
      const toAcc = cashAccounts.find((a) => a.id === formToAccountId);
      const pairRef = `TRANSFER:${Date.now()}`;
      const noteText = formDescription.trim() ? ` — ${formDescription.trim()}` : "";

      // Outgoing from source account
      addCashTransaction({
        accountId: formAccountId,
        type: "CASH_OUT",
        date: isoDate,
        amount: transferAmount,
        description: `Transfer keluar ke ${toAcc?.name || "Pos Tujuan"}${noteText}`,
        category: "Transfer Antar Kas",
        categoryId: null,
        referenceId: pairRef,
        vendorName: toAcc?.name || null,
        receiptNo: formReceiptNo.trim() || null,
        paymentMethod: "Transfer Internal",
      });

      // Incoming to destination account
      addCashTransaction({
        accountId: formToAccountId,
        type: "CASH_IN",
        date: isoDate,
        amount: transferAmount,
        description: `Transfer masuk dari ${fromAcc?.name || "Pos Asal"}${noteText}`,
        category: "Transfer Antar Kas",
        categoryId: null,
        referenceId: pairRef,
        vendorName: fromAcc?.name || null,
        receiptNo: formReceiptNo.trim() || null,
        paymentMethod: "Transfer Internal",
      });

      toast.success("Transfer kas berpasangan berhasil dicatat.");
      setIsModalOpen(false);
      return;
    }

    // 2. Parse Item Breakdown (if active)
    const validItems: CashTransactionItem[] = useItemBreakdown
      ? itemRows
          .map((r) => {
            const qty = parseFloat(r.qty) || 1;
            const rawUnitPrice = parseFloat(r.unitPrice) || 0;
            const rawTotalPrice = parseFloat(r.totalPrice) || qty * rawUnitPrice;
            const totalPrice = Math.round(rawTotalPrice);
            const unitPrice =
              rawUnitPrice > 0
                ? Math.round(rawUnitPrice)
                : qty > 0
                  ? Math.round(totalPrice / qty)
                  : 0;
            return {
              ...(r.ingredientId
                ? {
                    ingredientId: r.ingredientId,
                    unitMode: r.unitMode || "PURCHASE",
                    conversionFactor:
                      r.unitMode === "BASE"
                        ? 1
                        : Math.max(0.001, parseFloat(String(r.conversionFactor || "1")) || 1),
                  }
                : {}),
              name: r.name.trim(),
              qty,
              unit: r.unit || "pcs",
              unitPrice,
              totalPrice,
            };
          })
          .filter((it) => it.totalPrice > 0)
      : [];

    const itemsSum = validItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const finalAmount = Math.round(Number(formAmount) || itemsSum || 0);

    if (finalAmount <= 0) {
      toast.warning("Nominal transaksi harus lebih dari Rp 0.");
      return;
    }

    // Resolve category name & ID (Mendukung pilihan Kategori Utama -> Sub-Kategori)
    const effectiveCatId = formCategoryId || formParentCategoryId;
    const matchedCat = expenseCategories.find((c: any) => c.id === effectiveCatId);
    const finalCategoryName =
      matchedCat?.name ||
      formCustomCategory.trim() ||
      (trxType === "CASH_IN" ? "Pendapatan" : "Pengeluaran Operasional");

    // Auto-build description if left blank but items are filled
    let finalDescription = formDescription.trim();
    if (!finalDescription && validItems.length > 0) {
      finalDescription = validItems
        .map((it) => `${it.name || finalCategoryName} (${it.qty} ${it.unit})`)
        .join(", ");
    }
    if (!finalDescription) {
      finalDescription = finalCategoryName;
    }

    // Ensure single-item without name inherits description for clarity
    const normalizedItems = validItems.map((it) => ({
      ...it,
      name: it.name || (validItems.length === 1 ? finalDescription : "Item"),
    }));

    let createdTrxId: string | undefined;
    if (editingTrx) {
      updateCashTransaction({
        ...editingTrx,
        accountId: formAccountId,
        type: trxType === "CASH_IN" ? "CASH_IN" : "CASH_OUT",
        date: isoDate,
        amount: finalAmount,
        description: finalDescription,
        category: finalCategoryName,
        categoryId: matchedCat ? matchedCat.id : null,
        vendorName: formVendorName.trim() || null,
        receiptNo: formReceiptNo.trim() || null,
        paymentMethod: formPaymentMethod || null,
        items: normalizedItems.length > 0 ? normalizedItems : undefined,
      });
    } else {
      createdTrxId = addCashTransaction({
        accountId: formAccountId,
        type: trxType === "CASH_IN" ? "CASH_IN" : "CASH_OUT",
        date: isoDate,
        amount: finalAmount,
        description: finalDescription,
        category: finalCategoryName,
        categoryId: matchedCat ? matchedCat.id : null,
        referenceId: null,
        vendorName: formVendorName.trim() || null,
        receiptNo: formReceiptNo.trim() || null,
        paymentMethod: formPaymentMethod || null,
        items: normalizedItems.length > 0 ? normalizedItems : undefined,
      });
    }

    // 3. Sinkronisasi Harga Bahan Baku -> Kondimen Olahan -> HPP Menu (HARUS sebelum addStockMovement agar currentStock tidak tertimpa)
    const shouldSyncPrices =
      trxType === "CASH_OUT" &&
      useItemBreakdown &&
      (isBahanBakuCategory || hppSyncPreview.directUpdates.length > 0) &&
      syncIngredientPrices &&
      hppSyncPreview.directUpdates.length > 0;

    if (shouldSyncPrices) {
      hppSyncPreview.directUpdates.forEach((upd) => {
        updateIngredient({
          ...upd.ingredient,
          costPerUnit: upd.newCostPerUnit,
          ...(upd.ingredient.purchaseUnit
            ? { purchasePrice: upd.newPurchasePrice }
            : {}),
        });
      });

      hppSyncPreview.batchPrepUpdates.forEach((bpUpd) => {
        updateIngredient({
          ...bpUpd.ingredient,
          costPerUnit: bpUpd.newCostPerUnit,
          ...(bpUpd.ingredient.purchaseUnit
            ? { purchasePrice: bpUpd.newPurchasePrice }
            : {}),
        });
      });

      hppSyncPreview.productsToUpdate.forEach((prod) => {
        updateProduct(prod);
      });
    }

    // 4. Tambah Stok Fisik Gudang jika opsi dicentang (untuk belanja bahan langsung di Arus Kas)
    let addedStockCount = 0;
    if (
      !editingTrx &&
      trxType === "CASH_OUT" &&
      useItemBreakdown &&
      alsoAddToStock &&
      (isBahanBakuCategory || hppSyncPreview.directUpdates.length > 0)
    ) {
      normalizedItems.forEach((it) => {
        if (!it.ingredientId) return;
        const factor = Math.max(0.001, Number(it.conversionFactor) || 1);
        const baseQty = Number(((Number(it.qty) || 0) * factor).toFixed(4));
        if (baseQty <= 0) return;
        addedStockCount++;
        const targetIng = ingredients.find((i) => i.id === it.ingredientId);
        const rawLoc = String(targetIng?.storageLocation || "").toUpperCase();
        const validLocation: NonNullable<StockMovement["location"]> =
          rawLoc === "BAR" ||
          rawLoc === "KITCHEN" ||
          rawLoc === "BAKERY" ||
          rawLoc === "BAKER" ||
          rawLoc === "FINANCE"
            ? (rawLoc as NonNullable<StockMovement["location"]>)
            : "MAIN";
        addStockMovement({
          ingredientId: it.ingredientId,
          type: "IN",
          quantity: baseQty,
          unitCost:
            baseQty > 0
              ? Math.round((Number(it.totalPrice || 0) / baseQty) * 100) / 100
              : 0,
          totalCost: Math.round(Number(it.totalPrice) || 0),
          date: isoDate,
          note: `Belanja Kas: ${finalDescription} (${it.qty} ${it.unit})`,
          referenceId: createdTrxId || null,
          createdBy: currentUser?.name || "Finance",
          location: validLocation,
        });
      });
    }

    if (shouldSyncPrices || addedStockCount > 0) {
      const ingCount = hppSyncPreview.directUpdates.length + hppSyncPreview.batchPrepUpdates.length;
      const menuCount = hppSyncPreview.productsToUpdate.length;
      const msgParts: string[] = [];
      if (addedStockCount > 0) msgParts.push(`+${addedStockCount} item masuk stok gudang`);
      if (shouldSyncPrices) {
        msgParts.push(
          `harga modal ${ingCount} bahan${menuCount > 0 ? ` & HPP ${menuCount} menu` : ""} disinkronkan`
        );
      }
      toast.success(`Transaksi tersimpan! ${msgParts.join(", ")}.`, 5000);
    } else {
      toast.success(editingTrx ? "Perubahan transaksi berhasil disimpan." : "Transaksi kas berhasil dicatat.");
    }

    setIsModalOpen(false);
    setEditingTrx(null);
  };

  // ─── Delete Transaction (with Paired Transfer Detection) ───────────────────
  const handleDeleteTransaction = (trx: CashTransaction) => {
    if (isReadOnly) return;
    const periodCheck = validateCashPeriodAccess({ date: trx.date, closedPeriods });
    if ("error" in periodCheck) {
      toast.error(periodCheck.error);
      return;
    }
    const linkedSource = getLinkedModuleSource(trx);
    if (linkedSource) {
      toast.warning(
        `Transaksi ini tercatat otomatis dari modul ${linkedSource}. Silakan hapus dari modul ${linkedSource} agar saldo & laporan tetap sinkron.`
      );
      return;
    }
    const ref = String(trx.referenceId || "");
    if (ref.startsWith("TRANSFER:")) {
      const pair = cashTransactions.find((t) => t.id !== trx.id && t.referenceId === ref);
      if (pair) {
        const pairPeriodCheck = validateCashPeriodAccess({ date: pair.date, closedPeriods });
        if ("error" in pairPeriodCheck) {
          toast.error(pairPeriodCheck.error);
          return;
        }
        setConfirmAction({
          title: "Hapus Transfer Antar Kas?",
          message:
            "Transaksi ini adalah mutasi Transfer Antar Kas.\n\nHapus kedua sisi mutasi transfer (Pos Asal & Pos Tujuan) sekaligus agar saldo buku kas tetap seimbang?",
          confirmLabel: "Ya, Hapus Keduanya",
          onConfirm: () => {
            deleteCashTransaction(trx.id);
            deleteCashTransaction(pair.id);
            toast.success("Mutasi transfer kas kedua sisi berhasil dihapus.");
          },
        });
        return;
      }
    }

    setConfirmAction({
      title: "Hapus Transaksi Buku Kas?",
      message: "Apakah Anda yakin ingin menghapus transaksi ini dari Buku Kas?",
      confirmLabel: "Ya, Hapus",
      onConfirm: () => {
        deleteCashTransaction(trx.id);
        toast.success("Transaksi berhasil dihapus dari Buku Kas.");
      },
    });
  };

  // ─── Open / Submit Account Modal (Add & Edit Pos Kas) ──────────────────────
  const openAddAccountModal = () => {
    if (isReadOnly) return;
    setEditingAccount(null);
    setAccName("");
    setAccType("CASH");
    setAccOpeningBalance("");
    setAccOpeningDate(getLocalDateString());
    setIsAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: CashAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccOpeningBalance("");
    setIsAccountModalOpen(true);
  };

  const handleAccountSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isReadOnly) return;
    const trimmedName = accName.trim();
    if (!trimmedName) return;

    if (editingAccount) {
      updateCashAccount({
        ...editingAccount,
        name: trimmedName,
        type: accType,
      });
      toast.success(`Pos Kas "${trimmedName}" berhasil diperbarui.`);
    } else {
      const openingAmt = Math.round(Number(accOpeningBalance) || 0);
      if (openingAmt > 0) {
        const openingCheck = validateCashPeriodAccess({
          date: accOpeningDate,
          closedPeriods,
        });
        if ("error" in openingCheck) {
          toast.error(openingCheck.error);
          return;
        }
      }

      const newAccId = addCashAccount({
        name: trimmedName,
        type: accType,
        isDefault: cashAccounts.length === 0,
      });

      if (openingAmt > 0 && newAccId) {
        const isoDate =
          accOpeningDate === getLocalDateString()
            ? new Date().toISOString()
            : new Date(`${accOpeningDate}T08:00:00+08:00`).toISOString();

        addCashTransaction({
          accountId: newAccId,
          type: "CASH_IN",
          date: isoDate,
          amount: openingAmt,
          description: `Saldo Awal Pembukaan Pos Kas (${trimmedName})`,
          category: "Saldo Awal",
          categoryId: null,
          referenceId: `OPENING:${newAccId}`,
          paymentMethod: accType === "CASH" ? "Tunai" : "Transfer Bank",
        });
      }
      toast.success(`Pos Kas "${trimmedName}" berhasil ditambahkan.`);
    }

    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  // ─── Excel Import Handler ───────────────────────────────────────────────────
  const parseCashFlowImportDate = (rawCell: unknown): string | null => {
    if (rawCell instanceof Date && !Number.isNaN(rawCell.getTime())) {
      const ymd = getLocalDateString(rawCell);
      return new Date(`${ymd}T12:00:00+08:00`).toISOString();
    }
    const buildWitaIso = (yy: number, mm: number, dd: number): string | null => {
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1990 || yy > 2100) return null;
      const check = new Date(Date.UTC(yy, mm - 1, dd));
      if (
        check.getUTCFullYear() !== yy ||
        check.getUTCMonth() + 1 !== mm ||
        check.getUTCDate() !== dd
      ) {
        return null;
      }
      return new Date(
        `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T12:00:00+08:00`
      ).toISOString();
    };
    if (typeof rawCell === "number" && Number.isFinite(rawCell) && rawCell >= 25000 && rawCell <= 65000) {
      const dt = new Date(Math.round((rawCell - 25569) * 86400 * 1000));
      return buildWitaIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    const rawDate = String(rawCell || "").trim();
    if (!rawDate) return new Date().toISOString();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) {
      const [yy, mm, dd] = rawDate.split("-").map(Number);
      return buildWitaIso(yy, mm, dd);
    }
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(rawDate)) {
      const [dd, mm, yy] = rawDate.split(/[\/\-\.]/).map(Number);
      return buildWitaIso(yy, mm, dd);
    }
    if (/^\d{5}(\.\d+)?$/.test(rawDate)) {
      const serial = Number(rawDate);
      if (serial >= 25000 && serial <= 65000) {
        const dt = new Date(Math.round((serial - 25569) * 86400 * 1000));
        return buildWitaIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      }
    }
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const handleImport = (parsedData: any[]) => {
    if (isReadOnly) return;
    if (cashAccounts.length === 0) {
      toast.warning("Silakan buat Pos Kas terlebih dahulu sebelum mengimpor transaksi.");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let errors = 0;

    parsedData.forEach((row: any) => {
      try {
        const systemId = String(row["ID_SISTEM (JANGAN DIUBAH)"] || "").trim();
        const date = parseCashFlowImportDate(row["Tanggal"]);
        if (!date) {
          errors++;
          return;
        }
        const rawJenis = String(row["Jenis"] || "").toLowerCase();
        const type = rawJenis.includes("masuk") ? "CASH_IN" : "CASH_OUT";
        const matchedCat = resolveCategoryMatchForImport(row["Kategori"], expenseCategories);
        const description = String(row["Deskripsi"] || "Impor Excel").trim() || "Impor Excel";
        const vendorName = row["Toko / Vendor"] ? String(row["Toko / Vendor"]).trim() : null;
        const receiptNo = row["No. Nota / Ref"] ? String(row["No. Nota / Ref"]).trim() : null;

        const qty = parseFloat(String(row["Qty"] || "0").replace(",", ".")) || 0;
        const unit = String(row["Satuan"] || "pcs").trim();
        const unitPrice = Math.abs(parseBankStatementAmount(row["Harga Satuan"]));
        let amount = Math.abs(parseBankStatementAmount(row["Jumlah"]));
        if (amount <= 0 && qty > 0 && unitPrice > 0) {
          amount = Math.round(qty * unitPrice);
        }

        const items: CashTransactionItem[] | undefined =
          qty > 0 && amount > 0
            ? [
                {
                  name: description,
                  qty,
                  unit,
                  unitPrice: unitPrice > 0 ? unitPrice : Math.round(amount / qty),
                  totalPrice: amount,
                },
              ]
            : undefined;

        const accountName = row["Pos Kas"];
        const posKas =
          cashAccounts.find(
            (a) => a.name.toLowerCase() === String(accountName || "").toLowerCase()
          ) || cashAccounts[0];

        if (amount > 0 && posKas) {
          const rowPeriod = getLocalPeriodFromTimestamp(date);
          if (closedPeriods.some((p: any) => p.period === rowPeriod)) {
            errors++;
            return;
          }

          const existingTrx = systemId
            ? cashTransactions.find((t) => t.id === systemId)
            : undefined;
          if (existingTrx) {
            const origPeriod = getLocalPeriodFromTimestamp(existingTrx.date);
            if (
              closedPeriods.some((p: any) => p.period === origPeriod) ||
              getLinkedModuleSource(existingTrx) ||
              isInternalTransfer(existingTrx)
            ) {
              errors++;
              return;
            }
            updateCashTransaction({
              ...existingTrx,
              accountId: posKas.id,
              type,
              date,
              amount,
              description,
              category: matchedCat.category,
              categoryId: matchedCat.categoryId ?? existingTrx.categoryId ?? null,
              vendorName,
              receiptNo,
              items: items || existingTrx.items,
            });
            updatedCount++;
          } else {
            addCashTransaction({
              accountId: posKas.id,
              type,
              date,
              amount,
              description,
              category: matchedCat.category,
              categoryId: matchedCat.categoryId,
              referenceId: null,
              vendorName,
              receiptNo,
              items,
            });
            addedCount++;
          }
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    });

    toast.info(
      `Impor selesai. Ditambahkan: ${addedCount} baru, Diperbarui: ${updatedCount}, Dilewati: ${errors} baris.`,
      5500
    );
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <Building2 className="w-5 h-5" />;
      case "SAVINGS":
        return <Landmark className="w-5 h-5" />;
      case "E_WALLET":
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Wallet className="w-5 h-5" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "BANK":
        return "Rekening Bank";
      case "SAVINGS":
        return "Tabungan / Cadangan";
      case "E_WALLET":
        return "Dompet Digital / QRIS";
      default:
        return "Kas Tunai Toko";
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* ─── Header & Quick Actions ────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-coffee-sm">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/30 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                Buku Kas Besar
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                <Building2 className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                Manajemen Kas &amp; Rekening
              </span>
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  <Eye className="w-3 h-3" />
                  Mode Owner (Read-Only)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Buku Kas &amp; Arus Kas
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Pencatatan kas masuk, rincian item pengeluaran (Qty &amp; harga satuan), transfer antar rekening, dan saldo berjalan.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("open-ai-assistant", {
                      detail: { tab: "quick-input" },
                    })
                  );
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 text-brand-800 dark:text-brand-300 border border-brand-200/80 dark:border-brand-500/30 rounded-2xl text-xs font-bold shadow-2xs active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                title="Catat pengeluaran/pemasukan kas dengan kalimat bebas (AI Natural Input)"
              >
                <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-300 fill-brand-600/20 shrink-0" />
                <span>✨ Catat Cepat AI</span>
              </button>
            )}

            {!isReadOnly && cashAccounts.length >= 2 && (
              <button
                type="button"
                onClick={() => openCreateModal("TRANSFER")}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                title="Pindahkan saldo antar pos kas (mis. Setor Kas Tunai ke Bank)"
              >
                <ArrowLeftRight className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" />
                <span>Transfer Kas</span>
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => openCreateModal("CASH_OUT")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-sm shadow-brand-600/20 hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Catat Transaksi</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Banner Sinkronisasi Omzet Penjualan yang Belum Masuk Buku Kas ──── */}
        {unsyncedSalesStats.missingAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30 shadow-2xs"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ditemukan {formatCurrency(unsyncedSalesStats.missingAmount)} omzet penjualan ({unsyncedSalesStats.missingDays} hari) yang belum tercatat ke Buku Arus Kas
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Sinkronkan sekarang agar saldo kas &amp; pemasukan Arus Kas terhubung penuh dengan Penjualan.
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  const res = syncMissingSalesToCashFlow(
                    selectedAccountId !== "all" ? selectedAccountId : undefined
                  );
                  if (res.syncedCount > 0) {
                    const skippedNote =
                      res.skippedClosedCount && res.skippedClosedCount > 0
                        ? ` (${res.skippedClosedCount} hari di periode tutup buku dilewati)`
                        : "";
                    toast.success(
                      `${res.syncedCount} hari omzet (${formatCurrency(res.syncedAmount)}) berhasil disinkronkan ke Arus Kas!${skippedNote}`
                    );
                  } else if (res.skippedClosedCount && res.skippedClosedCount > 0) {
                    toast.warning(
                      `${res.skippedClosedCount} hari omzet berada pada periode yang sudah ditutup buku sehingga dilewati.`
                    );
                  } else {
                    toast.error("Tidak ada pos kas yang tersedia atau seluruh omzet sudah sinkron.");
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sinkronkan ke Arus Kas</span>
              </button>
            )}
          </motion.div>
        )}

        {/* ─── 4 Executive Bento KPI Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Saldo Kas Riil */}
          <div className="bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 p-5 rounded-3xl border border-brand-200/70 dark:border-brand-500/30 shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {selectedAccountId === "all" ? "Total Likuiditas Kas" : "Saldo Pos Aktif"}
              </span>
              <div className="w-10 h-10 rounded-2xl bg-brand-100/80 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30 flex items-center justify-center shadow-2xs">
                <Wallet className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {formatCurrency(
                  selectedAccountId === "all"
                    ? totalBalance
                    : accountBalances[selectedAccountId] || 0
                )}
              </div>
              {selectedAccountId === "all" ? (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800 border border-brand-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 tabular-nums">
                    Kas Ops: {formatCurrency(liquidityBreakdown.operationalBalance)}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 tabular-nums">
                    Tabungan: {formatCurrency(liquidityBreakdown.savingsBalance)}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  {`Pos: ${cashAccounts.find((a) => a.id === selectedAccountId)?.name || "-"}`}
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Pemasukan Kas (Cash In) */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 p-5 rounded-3xl border border-emerald-200/70 dark:border-emerald-500/30 shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pemasukan Kas (+)
              </span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center shadow-2xs">
                <TrendingUp className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-300 tabular-nums">
                {formatCurrency(totalCashIn)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {periodMode === "ALL" ? "Total dana masuk tercatat" : "Dana masuk pada periode dipilih"}
              </p>
            </div>
          </div>

          {/* Card 3: Pengeluaran Kas (Cash Out) */}
          <div className="bg-gradient-to-br from-rose-50/70 via-white to-white dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 p-5 rounded-3xl border border-rose-200/70 dark:border-rose-500/30 shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pengeluaran Kas (-)
              </span>
              <div className="w-10 h-10 rounded-2xl bg-rose-100/80 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200/70 dark:border-rose-500/30 flex items-center justify-center shadow-2xs">
                <TrendingDown className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-300 tabular-nums">
                {formatCurrency(totalCashOut)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Belanja bahan, utilitas & operasional
              </p>
            </div>
          </div>

          {/* Card 4: Net Cash Flow */}
          <div
            className={`bg-gradient-to-br ${
              netCashFlow >= 0
                ? "from-emerald-50/60 via-white to-white border-emerald-200/70 dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 dark:border-emerald-500/30"
                : "from-amber-50/70 via-white to-white border-amber-200/70 dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 dark:border-amber-500/30"
            } p-5 rounded-3xl border shadow-coffee-sm hover:-translate-y-0.5 hover:shadow-coffee transition-all flex flex-col justify-between group`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Selisih Arus Kas (Net)
              </span>
              <div
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-2xs ${
                  netCashFlow >= 0
                    ? "bg-emerald-100/80 text-emerald-600 border-emerald-200/70 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30"
                    : "bg-amber-100/80 text-amber-600 border-amber-200/70 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30"
                }`}
              >
                <Layers className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                  netCashFlow >= 0 ? "text-slate-900 dark:text-slate-100" : "text-amber-600 dark:text-amber-300"
                }`}
              >
                {formatCurrency(netCashFlow)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {netCashFlow >= 0 ? "Surplus arus kas" : "Defisit arus kas periode ini"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Pos Kas (Rekening / Dompet) Section ───────────────────────────── */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
                <Landmark className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Pos Kas & Rekening Toko
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik pos kas untuk melihat mutasi & saldo berjalan per rekening.
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {liquidityBreakdown.savingsAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={openSavingsDepositModal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 active:scale-95 text-emerald-800 transition-all cursor-pointer"
                    title="Transfer dana operasional ke rekening Tabungan / Dana Cadangan"
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Sisihkan ke Tabungan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const posRes = restoreMissingCashPositions();
                    const defaultCatCount = restoreDefaultExpenseCategories ? restoreDefaultExpenseCategories() : 0;
                    const totalRecoveredPos = posRes.addedAccountCount;
                    const totalRecoveredCats = posRes.addedCategoryCount + defaultCatCount;
                    if (totalRecoveredPos > 0 || totalRecoveredCats > 0) {
                      toast.success(
                        `Berhasil memulihkan ${totalRecoveredPos} Pos Kas dan ${totalRecoveredCats} Pos Kategori.`
                      );
                    } else {
                      toast.info("Semua Pos Kas & Pos Kategori yang tercatat di transaksi sudah lengkap.");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200/80 active:scale-95 text-amber-800 transition-all cursor-pointer"
                  title="Cek dan pulihkan pos kas atau pos kategori yang hilang dari riwayat transaksi"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan Pos</span>
                </button>
                <button
                  type="button"
                  onClick={openAddAccountModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pos Kas</span>
                </button>
              </div>
            )}
          </div>

          {cashAccounts.length === 0 ? (
            <div className="bg-amber-50/80 text-amber-900 p-5 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">Belum Ada Pos Kas Terdaftar</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Buat minimal satu pos kas (contoh: "Kas Tunai Operasional" atau "Bank BCA") atau pulihkan dari transaksi sebelumnya.
                </p>
              </div>
              {!isReadOnly && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const posRes = restoreMissingCashPositions();
                      const defaultCatCount = restoreDefaultExpenseCategories ? restoreDefaultExpenseCategories() : 0;
                      const totalPos = posRes.addedAccountCount;
                      const totalCats = posRes.addedCategoryCount + defaultCatCount;
                      if (totalPos > 0 || totalCats > 0) {
                        toast.success(`Berhasil memulihkan ${totalPos} Pos Kas dan ${totalCats} Pos Kategori.`);
                      } else {
                        toast.info("Semua Pos Kas & Pos Kategori sudah lengkap.");
                      }
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Pulihkan Pos Kas
                  </button>
                  <button
                    type="button"
                    onClick={openAddAccountModal}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Buat Pos Kas Baru
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {/* Account Card: Semua Pos Kas */}
              <div
                onClick={() => setSelectedAccountId("all")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  selectedAccountId === "all"
                    ? "bg-brand-gradient text-white border-brand-700 shadow-coffee scale-[1.01]"
                    : "bg-slate-50/80 text-slate-800 border-slate-200/80 hover:bg-white hover:border-brand-200 hover:shadow-xs"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
                      selectedAccountId === "all"
                        ? "bg-white/15 text-white"
                        : "bg-white text-slate-700 border border-slate-200/60"
                    }`}
                  >
                    <Landmark className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  {selectedAccountId === "all" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white">
                      Gabungan
                    </span>
                  )}
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold ${
                      selectedAccountId === "all" ? "text-brand-100" : "text-slate-500"
                    }`}
                  >
                    Semua Pos Kas
                  </p>
                  <p className="text-lg font-extrabold mt-0.5 tracking-tight tabular-nums">
                    {formatCurrency(totalBalance)}
                  </p>
                </div>
              </div>

              {/* Individual Account Cards */}
              {cashAccounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`relative group p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? "bg-brand-600 text-white border-brand-600 shadow-md scale-[1.01]"
                        : "bg-slate-50/80 text-slate-800 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-white text-brand-600 border border-slate-200/60"
                        }`}
                      >
                        {getAccountIcon(acc.type)}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isReadOnly && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => openEditAccountModal(acc, e)}
                              className={`p-1.5 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                                isSelected
                                  ? "hover:bg-white/20 text-white"
                                  : "hover:bg-slate-200/70 text-slate-400 hover:text-slate-700"
                              }`}
                              title="Edit Nama / Jenis Pos Kas"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const linkedTxCount = cashTransactions.filter(
                                  (t) => t.accountId === acc.id
                                ).length;
                                if (cashAccounts.length <= 1 && linkedTxCount > 0) {
                                  toast.warning(
                                    `Pos Kas terakhir tidak dapat dihapus karena masih memiliki ${linkedTxCount} transaksi terkait.`
                                  );
                                  return;
                                }
                                setConfirmAction({
                                  title: `Hapus Pos Kas "${acc.name}"?`,
                                  message:
                                    linkedTxCount > 0
                                      ? `Terdapat ${linkedTxCount} transaksi di pos ini. Mutasi Saldo Awal pos ini akan dihapus dan transaksi lainnya akan dipindahkan otomatis ke pos kas utama/berikutnya.`
                                      : "Pastikan tidak ada transaksi aktif yang masih bergantung pada pos ini.",
                                  confirmLabel: "Ya, Hapus",
                                  onConfirm: () => {
                                    deleteCashAccount(acc.id);
                                    if (selectedAccountId === acc.id) setSelectedAccountId("all");
                                    toast.success(`Pos kas "${acc.name}" berhasil dihapus.`);
                                  },
                                });
                              }}
                              className={`p-1.5 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                                isSelected
                                  ? "hover:bg-white/20 text-white"
                                  : "hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                              }`}
                              title="Hapus Pos Kas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <p
                          className={`text-xs font-bold truncate ${
                            isSelected ? "text-white" : "text-slate-800"
                          }`}
                        >
                          {acc.name}
                        </p>
                        {acc.type === "SAVINGS" && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            Tabungan
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[10px] font-medium ${
                          isSelected ? "text-brand-100" : "text-slate-400"
                        }`}
                      >
                        {getAccountTypeLabel(acc.type)}
                      </p>
                      <p className="text-lg font-extrabold mt-1 tracking-tight">
                        {formatCurrency(accountBalances[acc.id] || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Riwayat Mutasi Buku Kas (Filter + Table + Mobile Cards) ─────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-coffee-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          {/* Top Filter Bar */}
          <div className="p-5 sm:p-6 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Mutasi & Buku Kas</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                      {filteredTransactions.length} transaksi
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedAccountId !== "all"
                      ? `Rekening aktif: ${cashAccounts.find((a) => a.id === selectedAccountId)?.name}`
                      : "Menampilkan seluruh transaksi lintas pos kas"}
                  </p>
                </div>

                {/* Sliding Pill Filter Tabs */}
                <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center border border-slate-200/80 text-xs shadow-inner self-start sm:self-auto flex-wrap">
                  {[
                    { id: "ALL", label: "Semua" },
                    { id: "CASH_IN", label: "Uang Masuk (+)" },
                    { id: "CASH_OUT", label: "Pengeluaran (-)" },
                    { id: "TRANSFER", label: "Transfer (⇄)" },
                  ].map((tab) => {
                    const isActive = typeFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTypeFilter(tab.id as any)}
                        className={`relative px-3 py-1.5 rounded-xl font-semibold transition-colors duration-200 cursor-pointer ${
                          isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="cashflowFilterTab"
                            className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700"
                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons (Excel, Verifikasi, Kategori) */}
              <div className="flex flex-wrap items-center gap-2">
                {!isReadOnly && cashAccounts.length > 0 && (
                  <>
                    <CsvImportExport
                      onImport={handleImport}
                      templateHeaders={[
                        "Tanggal",
                        "Pos Kas",
                        "Jenis",
                        "Kategori",
                        "Deskripsi",
                        "Toko / Vendor",
                        "No. Nota / Ref",
                        "Qty",
                        "Satuan",
                        "Harga Satuan",
                        "Jumlah",
                      ]}
                      templateExampleRow={[
                        getLocalDateString(),
                        cashAccounts[0]?.name || "Kas Utama",
                        "Pengeluaran",
                        "Bahan Baku",
                        "Beli Susu Fresh Milk Diamond",
                        "Indogrosir",
                        "INV-001",
                        "5",
                        "liter",
                        "22000",
                        "110000",
                      ]}
                      templateFilename="Template_Buku_Kas_Julia.xlsx"
                      buttonLabel="Impor / Ekspor Excel"
                      currentData={filteredTransactions.map((trx) => {
                        const firstItem = trx.items?.[0];
                        return {
                          id: trx.id,
                          Tanggal: getLocalDateString(new Date(trx.date)),
                          "Pos Kas":
                            cashAccounts.find((a) => a.id === trx.accountId)?.name || "-",
                          Jenis:
                            getNormalizedType(trx.type) === "CASH_IN"
                              ? "Pemasukan"
                              : "Pengeluaran",
                          Kategori: trx.category,
                          Deskripsi: trx.description,
                          "Toko / Vendor": trx.vendorName || "-",
                          "No. Nota / Ref": trx.receiptNo || "-",
                          Qty: firstItem ? firstItem.qty : 1,
                          Satuan: firstItem ? firstItem.unit : "pcs",
                          "Harga Satuan": firstItem ? firstItem.unitPrice : trx.amount,
                          Jumlah: trx.amount,
                          "Saldo Berjalan": runningBalanceByTrxId[trx.id] ?? 0,
                        };
                      })}
                      templateDropdowns={{
                        "Pos Kas": cashAccounts.map((a) => a.name),
                        Jenis: ["Pemasukan", "Pengeluaran"],
                        Kategori: expenseCategories.map((c: any) => c.name),
                      }}
                      templateColumnTypes={{
                        Tanggal: "date",
                        Qty: "number",
                        "Harga Satuan": "number",
                        Jumlah: "number",
                      }}
                      templateHints={{
                        Tanggal: "Format: YYYY-MM-DD",
                        Qty: "Jumlah barang (opsional)",
                        "Harga Satuan": "Harga per item (opsional)",
                        Jumlah: "Total nominal (angka saja)",
                      }}
                    />

                    {unverifiedSalesLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsVerificationModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl transition-all shrink-0 text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Verifikasi Penjualan ({unverifiedSalesLogs.length})</span>
                      </button>
                    )}

                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate("expense_categories")}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-all shrink-0 text-xs font-semibold shadow-2xs cursor-pointer"
                        title="Kelola & Atur Kategori Kas & Biaya"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Atur Kategori</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Second Row Filter: Period Selector, Category Filter, and Search */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
                  {[
                    { id: "ALL", label: "Semua Waktu" },
                    { id: "TODAY", label: "Hari Ini" },
                    { id: "WEEK", label: "7 Hari" },
                    { id: "MONTH", label: "Per Bulan" },
                    { id: "CUSTOM", label: "Rentang Tanggal" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPeriodMode(p.id as any)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        periodMode === p.id
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {periodMode === "MONTH" && (
                  <CustomMonthPicker
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    allowClear={false}
                    buttonClassName="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white"
                  />
                )}

                {periodMode === "CUSTOM" && (
                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                    <CustomDatePicker
                      value={customStartDate}
                      onChange={(val) => {
                        setCustomStartDate(val);
                        if (customEndDate && val && val > customEndDate) {
                          setCustomEndDate(val);
                        }
                      }}
                      allowClear={false}
                      buttonClassName="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
                    />
                    <span className="text-slate-400 font-bold">s/d</span>
                    <CustomDatePicker
                      value={customEndDate}
                      onChange={(val) => {
                        setCustomEndDate(val);
                        if (customStartDate && val && val < customStartDate) {
                          setCustomStartDate(val);
                        }
                      }}
                      allowClear={false}
                      buttonClassName="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
                    />
                  </div>
                )}

                {/* Category Filter (Bertingkat: Kategori Utama & Sub-Kategori + Sistem) */}
                <CustomSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[
                    { value: "ALL", label: "Semua Kategori & Sub-Kategori" },
                    ...expenseCategories
                      .filter((c: any) => !c.parentId && c.isActive !== false)
                      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                      .flatMap((root: any) => {
                        const children = expenseCategories
                          .filter((c: any) => c.parentId === root.id && c.isActive !== false)
                          .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
                        return [
                          {
                            value: root.name,
                            label: `Semua di ${root.name}`,
                            group: root.name,
                          },
                          ...children.map((sub: any) => ({
                            value: sub.name,
                            label: sub.name,
                            group: root.name,
                          })),
                        ];
                      }),
                    ...extraFilterCategories.map((name) => ({
                      value: name,
                      label: name,
                      group: "Khusus / Sistem",
                    })),
                  ]}
                  placeholder="Semua Kategori & Sub-Kategori"
                  buttonClassName="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-900 hover:bg-white"
                />

                {(selectedAccountId !== "all" ||
                  typeFilter !== "ALL" ||
                  categoryFilter !== "ALL" ||
                  periodMode !== "ALL" ||
                  searchTerm.trim() !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId("all");
                      setTypeFilter("ALL");
                      setCategoryFilter("ALL");
                      setPeriodMode("ALL");
                      setSearchTerm("");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari deskripsi, nama barang, toko, nota..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 w-full bg-slate-50/50 focus:bg-white transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Desktop & Tablet View: Full Table with Item Details & Running Balance ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-5">Tanggal</th>
                  <th className="py-3.5 px-4">Pos Kas</th>
                  <th className="py-3.5 px-4">Jenis & Kategori</th>
                  <th className="py-3.5 px-5">Deskripsi & Rincian Barang (Qty × Harga)</th>
                  <th className="py-3.5 px-5 text-right">Mutasi (Rp)</th>
                  <th className="py-3.5 px-5 text-right">Saldo Berjalan</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.map((trx) => {
                  const normType = getNormalizedType(trx.type);
                  const isTransfer = isInternalTransfer(trx);
                  const trxPeriod = getLocalPeriodFromTimestamp(trx.date);
                  const isClosed = closedPeriods.some(
                    (p: any) => p.period === trxPeriod
                  );
                  const runningBal = runningBalanceByTrxId[trx.id];
                  const hasItems = Array.isArray(trx.items) && trx.items.length > 0;

                  return (
                    <tr
                      key={trx.id}
                      className="hover:bg-slate-50/70 transition-colors group align-top"
                    >
                      {/* Tanggal */}
                      <td className="py-3.5 px-5 text-slate-900 font-medium whitespace-nowrap">
                        <span className="block font-bold text-slate-800">
                          {new Date(trx.date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {new Date(trx.date).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Pos Kas */}
                      <td className="py-3.5 px-4 text-slate-700 font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs border border-slate-200/60">
                          <Wallet className="w-3 h-3 text-slate-400 shrink-0" />
                          {cashAccounts.find((a) => a.id === trx.accountId)?.name || "-"}
                        </span>
                      </td>

                      {/* Jenis & Kategori */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${
                              isTransfer
                                ? "bg-brand-50 text-brand-700 border-brand-200/60 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30"
                                : normType === "CASH_IN"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                                  : "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                            }`}
                          >
                            {isTransfer ? (
                              <>
                                <ArrowLeftRight className="w-3 h-3 text-brand-600 dark:text-brand-300 stroke-[2.3]" />
                                {normType === "CASH_IN" ? "Transfer Masuk" : "Transfer Keluar"}
                              </>
                            ) : normType === "CASH_IN" ? (
                              <>
                                <ArrowUpRight className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                                Pemasukan
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-3 h-3 text-rose-600 stroke-[2.5]" />
                                Pengeluaran
                              </>
                            )}
                          </span>
                          {(() => {
                            const { parentName, categoryName } = getCategoryHierarchyInfo(trx);
                            return parentName ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                <span className="text-slate-400 font-medium">{parentName}</span>
                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                <span>{categoryName}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[11px]">
                                {categoryName}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Deskripsi + Vendor/Nota + Rincian Item */}
                      <td className="py-3.5 px-5 text-slate-700 max-w-md">
                        <p className="font-bold text-slate-900 leading-snug">
                          {trx.description}
                        </p>

                        {/* Meta badges: Sumber Modul, Vendor & No Nota */}
                        {(() => {
                          const linkedSource = getLinkedModuleSource(trx);
                          if (!linkedSource && !trx.vendorName && !trx.receiptNo && !trx.paymentMethod) {
                            return null;
                          }
                          return (
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                              {linkedSource && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200/70 font-bold text-[10px]">
                                  Sumber: {linkedSource}
                                </span>
                              )}
                              {trx.vendorName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50/80 text-amber-800 border border-amber-200/60 font-medium">
                                  <Store className="w-3 h-3 text-amber-600" />
                                  {trx.vendorName}
                                </span>
                              )}
                              {trx.receiptNo && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                                  <FileText className="w-3 h-3 text-slate-400" />
                                  {trx.receiptNo}
                                </span>
                              )}
                              {trx.paymentMethod && (
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  • {trx.paymentMethod}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Item Breakdown Badges (Qty × Harga Satuan = Total) */}
                        {hasItems && (
                          <div className="mt-2 space-y-1 bg-slate-50/90 p-2 rounded-xl border border-slate-200/70">
                            {trx.items!.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                              >
                                <span className="flex items-center gap-1.5 font-medium truncate">
                                  <Package className="w-3 h-3 text-brand-600 shrink-0" />
                                  <span className="font-semibold text-slate-800">
                                    {it.name || trx.description}
                                  </span>
                                  {it.ingredientId && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/70 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                      Stok Master
                                    </span>
                                  )}
                                  <span className="text-slate-500">
                                    ({it.qty} {it.unit} × {formatCurrency(it.unitPrice)}/{it.unit})
                                  </span>
                                </span>
                                <span className="font-mono font-bold text-slate-900 shrink-0">
                                  {formatCurrency(it.totalPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Jumlah Mutasi */}
                      <td
                        className={`py-3.5 px-5 text-right font-extrabold text-sm tracking-tight whitespace-nowrap ${
                          normType === "CASH_IN" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {normType === "CASH_IN" ? "+" : "-"}
                        {formatCurrency(trx.amount)}
                      </td>

                      {/* Saldo Berjalan */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
                          {runningBal !== undefined ? formatCurrency(runningBal) : "-"}
                        </span>
                      </td>

                      {/* Aksi (Edit & Hapus) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {!isReadOnly && !isClosed ? (
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(trx)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                              title="Edit Transaksi"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(trx)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {isClosed ? "Tutup Buku" : "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                        <Receipt className="w-6 h-6 stroke-[1.8]" />
                      </div>
                      <p className="font-bold text-slate-700 text-xs">
                        Tidak Ada Transaksi Ditemukan
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Sesuaikan filter periode/pencarian atau klik "Catat Transaksi" di kanan atas.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ─── Mobile Smartphone View: Ergonomic Cards Feed ────────────────── */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredTransactions.map((trx) => {
              const normType = getNormalizedType(trx.type);
              const trxPeriod = getLocalPeriodFromTimestamp(trx.date);
              const isClosed = closedPeriods.some(
                (p: any) => p.period === trxPeriod
              );
              const runningBal = runningBalanceByTrxId[trx.id];
              const hasItems = Array.isArray(trx.items) && trx.items.length > 0;

              return (
                <div
                  key={trx.id}
                  className="p-4 space-y-2.5 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs shrink-0 mt-0.5 ${
                          normType === "CASH_IN"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                            : "bg-rose-50 text-rose-600 border border-rose-200/60"
                        }`}
                      >
                        {normType === "CASH_IN" ? (
                          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          {trx.description}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                          {new Date(trx.date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          •{" "}
                          {cashAccounts.find((a) => a.id === trx.accountId)?.name || "-"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-extrabold tracking-tight block ${
                          normType === "CASH_IN" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {normType === "CASH_IN" ? "+" : "-"}
                        {formatCurrency(trx.amount)}
                      </span>
                      {runningBal !== undefined && (
                        <span className="text-[10px] font-mono text-slate-500">
                          Saldo: {formatCurrency(runningBal)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Item Breakdown */}
                  {hasItems && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-1">
                      {trx.items!.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] text-slate-700"
                        >
                          <span className="truncate pr-2">
                            •{" "}
                            {it.ingredientId && (
                              <span className="inline-block mr-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                                Master
                              </span>
                            )}
                            <strong>{it.name || trx.description}</strong> ({it.qty} {it.unit} ×{" "}
                            {formatCurrency(it.unitPrice)})
                          </span>
                          <span className="font-mono font-bold text-slate-900 shrink-0">
                            {formatCurrency(it.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(() => {
                        const { parentName, categoryName } = getCategoryHierarchyInfo(trx);
                        return parentName ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            <span className="text-slate-400">{parentName}</span>
                            <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                            <span>{categoryName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {categoryName}
                          </span>
                        );
                      })()}
                      {trx.vendorName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60 text-[10px] font-medium">
                          <Store className="w-2.5 h-2.5" />
                          {trx.vendorName}
                        </span>
                      )}
                    </div>

                    {!isReadOnly && !isClosed && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(trx)}
                          className="text-slate-500 hover:text-brand-600 text-xs font-semibold flex items-center gap-1 p-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(trx)}
                          className="text-slate-400 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                  <Receipt className="w-6 h-6 stroke-[1.8]" />
                </div>
                <p className="font-bold text-slate-700 text-xs">Tidak Ada Transaksi</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sesuaikan filter atau gunakan tombol Catat Transaksi.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── CREATE / EDIT / TRANSFER TRANSACTION MODAL ────────────────────── */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {isModalOpen && (
                <motion.div
                  key="cashflow-trx-modal-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsModalOpen(false);
                      setEditingTrx(null);
                    }
                  }}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs p-2.5 sm:p-6 flex justify-center items-center z-[100] overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
                  >
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 ${
                        trxType === "CASH_IN"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                          : trxType === "TRANSFER"
                            ? "bg-brand-50 text-brand-600 border border-brand-200/60"
                            : "bg-rose-50 text-rose-600 border border-rose-200/60"
                      }`}
                    >
                      {trxType === "CASH_IN" ? (
                        <TrendingUp className="w-5 h-5 stroke-[2.2]" />
                      ) : trxType === "TRANSFER" ? (
                        <ArrowLeftRight className="w-5 h-5 stroke-[2.2]" />
                      ) : (
                        <TrendingDown className="w-5 h-5 stroke-[2.2]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                        {editingTrx
                          ? "Edit Transaksi Buku Kas"
                          : trxType === "TRANSFER"
                            ? "Transfer / Pindah Dana Antar Pos Kas"
                            : "Catat Transaksi Buku Kas"}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                        {trxType === "TRANSFER"
                          ? "Mutasi keluar & masuk antar rekening dibuat otomatis secara berpasangan"
                          : "Dilengkapi kalkulator otomatis Qty × Harga Satuan ↔ Harga Total"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingTrx(null);
                    }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                    aria-label="Tutup modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleTrxSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
                  {closedPeriods.some((p: any) => p.period === formDate.slice(0, 7)) && (
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        Periode ({formDate.slice(0, 7)}) sudah ditutup buku. Pilih tanggal pada periode terbuka untuk menyimpan transaksi.
                      </span>
                    </div>
                  )}
                  {/* Type Toggle Sliding Pill */}
                  <div className="flex gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setTrxType("CASH_OUT");
                        if (!editingTrx) setUseItemBreakdown(true);
                        const defaultExpenseRoot = expenseCategories
                          .filter((c: any) => !c.parentId && c.isActive !== false)
                          .find((c: any) => c.type !== "PENDAPATAN");
                        setFormParentCategoryId(defaultExpenseRoot?.id || "");
                        setFormCategoryId("");
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        trxType === "CASH_OUT"
                          ? "bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 shadow-xs border border-rose-200/60 dark:border-rose-500/30"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Pengeluaran (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrxType("CASH_IN");
                        if (!editingTrx) setUseItemBreakdown(false);
                        const defaultIncomeRoot = expenseCategories
                          .filter((c: any) => !c.parentId && c.isActive !== false)
                          .find((c: any) => c.type === "PENDAPATAN");
                        setFormParentCategoryId(defaultIncomeRoot?.id || "");
                        setFormCategoryId("");
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        trxType === "CASH_IN"
                          ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-200/60 dark:border-emerald-500/30"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Uang Masuk (+)
                    </button>
                    {!editingTrx && cashAccounts.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setTrxType("TRANSFER")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          trxType === "TRANSFER"
                            ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 shadow-xs border border-brand-200/60 dark:border-brand-500/30"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        Transfer Kas (⇄)
                      </button>
                    )}
                  </div>

                  {/* Row 1: Pos Kas & Tanggal Transaksi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {trxType === "TRANSFER" ? "Dari Pos Kas (Asal)" : "Pos Kas / Rekening"}
                      </label>
                      <CustomSelect
                        value={formAccountId}
                        onChange={setFormAccountId}
                        required
                        placeholder="Pilih Pos Kas..."
                        options={cashAccounts.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${formatCurrency(accountBalances[acc.id] || 0)})`,
                        }))}
                        buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white"
                      />
                    </div>

                    {trxType === "TRANSFER" ? (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Ke Pos Kas (Tujuan)
                        </label>
                        <CustomSelect
                          value={formToAccountId}
                          onChange={setFormToAccountId}
                          required
                          placeholder="Pilih Pos Kas Tujuan..."
                          options={cashAccounts.map((acc) => ({
                            value: acc.id,
                            label: `${acc.name} (${formatCurrency(accountBalances[acc.id] || 0)})`,
                          }))}
                          buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Tanggal Transaksi
                        </label>
                        <CustomDatePicker
                          value={formDate}
                          onChange={setFormDate}
                          allowClear={false}
                          required
                          buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* If TRANSFER mode: show Date & Nominal */}
                  {trxType === "TRANSFER" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Tanggal Transfer
                        </label>
                        <CustomDatePicker
                          value={formDate}
                          onChange={setFormDate}
                          allowClear={false}
                          required
                          buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Nominal Transfer (Rp)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                            Rp
                          </span>
                          <CurrencyInput
                            value={formAmount}
                            onValueChange={(raw) => setFormAmount(raw)}
                            required
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm font-extrabold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Row 2A: Pilihan Kategori Bertingkat (1. Kategori Utama -> 2. Sub-Kategori) */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-brand-600" />
                            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                              Klasifikasi Kategori {trxType === "CASH_IN" ? "Pemasukan" : "Pengeluaran"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {restoreDefaultExpenseCategories && (
                              <button
                                type="button"
                                onClick={() => {
                                  const restored = restoreDefaultExpenseCategories();
                                  const defaultRoot = expenseCategories
                                    .filter((c: any) => !c.parentId && c.isActive !== false)
                                    .find((c: any) =>
                                      trxType === "CASH_IN"
                                        ? c.type === "PENDAPATAN"
                                        : c.type !== "PENDAPATAN"
                                    );
                                  if (!formParentCategoryId && defaultRoot) {
                                    setFormParentCategoryId(defaultRoot.id);
                                  }
                                  toast[restored > 0 ? "success" : "info"](
                                    restored > 0
                                      ? `Berhasil memulihkan ${restored} kategori & sub-kategori standar.`
                                      : "Semua kategori & sub-kategori standar sudah lengkap."
                                  );
                                }}
                                className="text-[11px] text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 cursor-pointer"
                                title="Pulihkan kategori standar yang sempat terhapus"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Pulihkan Kategori
                              </button>
                            )}
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsModalOpen(false);
                                  onNavigate("expense_categories");
                                }}
                                className="text-[11px] text-brand-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              >
                                + Kelola Kategori
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Step 1: Kategori Utama (Parent) */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              1. Pilih Kategori Utama (Induk) *
                            </label>
                            <CustomSelect
                              value={formParentCategoryId}
                              onChange={(nextParentId) => {
                                setFormParentCategoryId(nextParentId);
                                setFormCategoryId("");
                                setFormCustomCategory("");
                              }}
                              required={!formCustomCategory}
                              placeholder="-- Pilih Kategori Utama --"
                              options={[
                                { value: "", label: "-- Pilih Kategori Utama --" },
                                ...activeRootCategories.map((root: any) => {
                                  const subCount = expenseCategories.filter(
                                    (c: any) => c.parentId === root.id && c.isActive !== false
                                  ).length;
                                  return {
                                    value: root.id,
                                    label: `${root.name}${subCount > 0 ? ` (${subCount} sub)` : ""}`,
                                  };
                                }),
                              ]}
                              buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-bold border border-slate-200 rounded-xl bg-white"
                            />
                          </div>

                          {/* Step 2: Sub-Kategori (Child) */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              2. Pilih Sub-Kategori (Rincian Pos)
                            </label>
                            <CustomSelect
                              value={
                                !formParentCategoryId
                                  ? ""
                                  : activeSubCategories.length === 0
                                  ? formCategoryId || formParentCategoryId
                                  : formCategoryId
                              }
                              onChange={(val) => {
                                setFormCategoryId(val);
                                setFormCustomCategory("");
                              }}
                              disabled={!formParentCategoryId}
                              placeholder="Pilih Kategori Utama terlebih dahulu..."
                              options={
                                !formParentCategoryId
                                  ? [{ value: "", label: "Pilih Kategori Utama terlebih dahulu..." }]
                                  : activeSubCategories.length === 0
                                  ? [
                                      {
                                        value: formParentCategoryId,
                                        label: "-- Gunakan Kategori Utama (Tidak ada sub-kategori) --",
                                      },
                                    ]
                                  : [
                                      {
                                        value: "",
                                        label: `-- Pilih Sub-Kategori (${activeSubCategories.length} tersedia) --`,
                                      },
                                      ...activeSubCategories.map((sub: any) => ({
                                        value: sub.id,
                                        label: sub.name,
                                      })),
                                      {
                                        value: formParentCategoryId,
                                        label: `Umum / Lainnya di ${
                                          activeRootCategories.find((r: any) => r.id === formParentCategoryId)?.name ||
                                          "Kategori Utama"
                                        }`,
                                      },
                                    ]
                              }
                              buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-xl bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        </div>

                        {/* Preview Breadcrumb Kategori Terpilih */}
                        {(formParentCategoryId || formCategoryId || formCustomCategory) && (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold">Pos Terpilih:</span>
                              {(() => {
                                const parentObj = expenseCategories.find(
                                  (c: any) => c.id === formParentCategoryId
                                );
                                const subObj = expenseCategories.find(
                                  (c: any) => c.id === formCategoryId && c.id !== formParentCategoryId
                                );
                                if (parentObj && subObj) {
                                  return (
                                    <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                                      <span>{parentObj.name}</span>
                                      <ChevronRight className="w-3 h-3 text-slate-400" />
                                      <span className="text-brand-700">{subObj.name}</span>
                                    </span>
                                  );
                                }
                                if (parentObj) {
                                  return (
                                    <span className="font-bold text-slate-800">
                                      {parentObj.name}{" "}
                                      <span className="text-slate-400 font-normal">(Pos Utama)</span>
                                    </span>
                                  );
                                }
                                return <span className="font-bold text-slate-800">{formCustomCategory}</span>;
                              })()}
                            </div>
                            {isBahanBakuCategory && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold">
                                <Package className="w-3 h-3 text-amber-600" />
                                Terhubung Dropdown Stok Bahan Baku
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ─── RINCIAN ITEM / QUANTITY & HARGA SATUAN ↔ TOTAL ────────── */}
                      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-brand-100/80 text-brand-700 flex items-center justify-center">
                              <Calculator className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-extrabold text-slate-800">
                                {isBahanBakuCategory
                                  ? "Rincian Bahan Baku (Ambil dari Master Stok)"
                                  : "Rincian Barang / Kuantitas & Harga Item"}
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                {isBahanBakuCategory
                                  ? "Pilih bahan dari stok agar nama & satuan seragam, atau pilih Ketik Manual"
                                  : <>Isi <strong>Qty + Harga Satuan</strong> atau <strong>Qty + Harga Total</strong> (otomatis menghitung dua arah)</>}
                              </p>
                            </div>
                          </div>

                          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={useItemBreakdown}
                              onChange={(e) => setUseItemBreakdown(e.target.checked)}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span>Gunakan Rincian Item</span>
                          </label>
                        </div>

                        {useItemBreakdown && (
                          <div className="space-y-2.5 pt-1">
                            {itemRows.map((row, idx) => {
                              const selectedIng = row.ingredientId
                                ? ingredients.find((i) => i.id === row.ingredientId)
                                : undefined;
                              const hasPurchaseUnit = Boolean(
                                selectedIng?.purchaseUnit && Number(selectedIng?.conversionFactor) > 0
                              );
                              const showIngredientDropdown =
                                isBahanBakuCategory || Boolean(row.ingredientId);

                              return (
                                <div
                                  key={row.id}
                                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Item #{idx + 1}
                                      </span>
                                      {selectedIng && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 text-[10px] font-bold">
                                          <Package className="w-2.5 h-2.5 text-amber-600" />
                                          {selectedIng.category}
                                        </span>
                                      )}
                                    </div>
                                    {itemRows.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItemRow(row.id)}
                                        className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Hapus Baris
                                      </button>
                                    )}
                                  </div>

                                  <div className="space-y-2.5">
                                    {/* Tier 1: Nama Item / Dropdown Stok Bahan Baku (Full Width) */}
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                        {showIngredientDropdown
                                          ? "Bahan Baku (Stok Master)"
                                          : `Nama Barang / Item ${itemRows.length === 1 ? "(Opsional)" : ""}`}
                                      </label>
                                      {showIngredientDropdown ? (
                                        <div className="space-y-1.5">
                                          <CustomSelect
                                            value={row.ingredientId || ""}
                                            onChange={(val) => handleSelectRowIngredient(row.id, val)}
                                            placeholder="-- Ketik Manual (Non-Stok) --"
                                            options={[
                                              { value: "", label: "-- Ketik Manual (Non-Stok) --" },
                                              ...sortedIngredients.map((ing) => ({
                                                value: ing.id,
                                                label: `${ing.name} (${ing.purchaseUnit || ing.unit})`,
                                              })),
                                            ]}
                                            buttonClassName="w-full px-3 py-2 text-sm sm:text-xs font-bold border border-slate-200 rounded-xl bg-white"
                                          />
                                          {!row.ingredientId && (
                                            <input
                                              type="text"
                                              value={row.name}
                                              onChange={(e) =>
                                                handleItemRowChange(row.id, "name", e.target.value)
                                              }
                                              placeholder="Ketik nama barang non-stok..."
                                              className="w-full px-3 py-2 text-sm sm:text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                            />
                                          )}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          value={row.name}
                                          onChange={(e) =>
                                            handleItemRowChange(row.id, "name", e.target.value)
                                          }
                                          placeholder="Mis: Susu Diamond / Cup 16oz"
                                          className="w-full px-3 py-2 text-sm sm:text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                      )}
                                    </div>

                                    {/* Tier 2: Qty, Satuan, Harga Satuan & Harga Total Item */}
                                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end">
                                      <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                                          Qty
                                        </label>
                                        <input
                                          type="number"
                                          step="any"
                                          min="0.01"
                                          value={row.qty}
                                          onChange={(e) =>
                                            handleItemRowChange(row.id, "qty", e.target.value)
                                          }
                                          placeholder="1"
                                          className="w-full px-2.5 py-2 text-sm sm:text-xs font-extrabold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-center"
                                        />
                                      </div>

                                      <div className="col-span-1 sm:col-span-3">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                                          Satuan
                                        </label>
                                        {selectedIng ? (
                                          (() => {
                                            const packagingChoices =
                                              getIngredientPackagingChoices(selectedIng);
                                            const currentSelectVal = getPackagingSelectValue(
                                              row,
                                              packagingChoices
                                            );
                                            return (
                                              <CustomSelect
                                                value={currentSelectVal}
                                                onChange={(val) =>
                                                  handleRowPackagingChoiceChange(row.id, val)
                                                }
                                                options={packagingChoices.map((ch) => ({
                                                  value: ch.key,
                                                  label: ch.label,
                                                }))}
                                                buttonClassName="w-full px-2.5 py-2 text-sm sm:text-xs font-bold border border-brand-200 rounded-xl bg-brand-50/40 text-brand-900"
                                              />
                                            );
                                          })()
                                        ) : (
                                          <CustomSelect
                                            value={row.unit}
                                            onChange={(val) =>
                                              handleItemRowChange(row.id, "unit", val)
                                            }
                                            options={UNIT_OPTIONS.map((u) => ({
                                              value: u,
                                              label: u,
                                            }))}
                                            buttonClassName="w-full px-2.5 py-2 text-sm sm:text-xs font-semibold border border-slate-200 rounded-xl bg-white"
                                          />
                                        )}
                                      </div>

                                      {/* Harga per Item / Satuan */}
                                      <div className="col-span-1 sm:col-span-3">
                                        <label
                                          className="block text-[10px] font-bold text-slate-500 mb-1 truncate"
                                          title={`Harga / ${row.unit} (Rp)`}
                                        >
                                          Harga / {row.unit} (Rp)
                                        </label>
                                        <CurrencyInput
                                          allowDecimals
                                          value={row.unitPrice}
                                          onValueChange={(raw) =>
                                            handleItemRowChange(row.id, "unitPrice", raw)
                                          }
                                          placeholder="0"
                                          className="w-full px-2.5 py-2 text-sm sm:text-xs font-bold font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                      </div>

                                      {/* Harga Total Item */}
                                      <div className="col-span-1 sm:col-span-4">
                                        <label className="block text-[10px] font-bold text-brand-700 mb-1 truncate">
                                          Harga Total Item (Rp)
                                        </label>
                                        <CurrencyInput
                                          value={row.totalPrice}
                                          onValueChange={(raw) =>
                                            handleItemRowChange(row.id, "totalPrice", raw)
                                          }
                                          placeholder="0"
                                          className="w-full px-2.5 py-2 text-sm sm:text-xs font-extrabold font-mono border border-brand-300 bg-brand-50/40 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {selectedIng && row.unitMode !== "BASE" && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700">
                                      {row.unitMode === "CUSTOM" && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-500 whitespace-nowrap">
                                            Nama Kemasan:
                                          </span>
                                          <input
                                            type="text"
                                            value={row.unit}
                                            onChange={(e) =>
                                              handleItemRowChange(row.id, "unit", e.target.value)
                                            }
                                            placeholder="Mis: Karton / Dus"
                                            className="w-28 px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                          />
                                        </div>
                                      )}

                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-semibold text-slate-500">
                                          Isi per 1 {row.unit || "kemasan"} =
                                        </span>
                                        <input
                                          type="number"
                                          step="any"
                                          min="0.001"
                                          value={row.conversionFactor || ""}
                                          onChange={(e) =>
                                            handleRowConversionFactorChange(
                                              row.id,
                                              e.target.value
                                            )
                                          }
                                          className="w-20 px-2 py-1 text-xs font-extrabold font-mono text-center border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                        <span className="font-bold text-slate-700">
                                          {selectedIng.unit}
                                        </span>
                                      </div>

                                      <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 border border-brand-200/70 font-bold text-[10px] font-mono">
                                        Total Takaran:{" "}
                                        {(
                                          (parseFloat(row.qty) || 0) *
                                          (parseFloat(row.conversionFactor || "1") || 0)
                                        ).toLocaleString("id-ID")}{" "}
                                        {selectedIng.unit}
                                      </span>
                                    </div>
                                  )}

                                  {selectedIng && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[10px] text-amber-900">
                                      <span>
                                        {hasPurchaseUnit
                                          ? `Konversi: 1 ${selectedIng.purchaseUnit} = ${Number(
                                              selectedIng.conversionFactor
                                            ).toLocaleString("id-ID")} ${selectedIng.unit} • `
                                          : ""}
                                        Stok saat ini:{" "}
                                        <strong>
                                          {selectedIng.currentStock.toLocaleString("id-ID")}{" "}
                                          {selectedIng.unit}
                                        </strong>
                                      </span>
                                      <span>
                                        Modal saat ini:{" "}
                                        <strong className="font-mono">
                                          {formatUnitCost(selectedIng.costPerUnit)}/
                                          {selectedIng.unit}
                                        </strong>
                                        {hasPurchaseUnit && (
                                          <>
                                            {" "}
                                            (
                                            {formatCurrency(
                                              Math.round(
                                                Number(selectedIng.purchasePrice) > 0
                                                  ? Number(selectedIng.purchasePrice)
                                                  : Number(selectedIng.costPerUnit || 0) *
                                                      Number(selectedIng.conversionFactor || 1)
                                              )
                                            )}
                                            /{selectedIng.purchaseUnit})
                                          </>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={handleAddItemRow}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-brand-700 border border-slate-200/90 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah Baris Barang</span>
                              </button>
                              <span className="text-[11px] text-slate-500">
                                Total dari {itemRows.length} baris:{" "}
                                <strong className="text-slate-900 font-mono">
                                  {formatCurrency(
                                    itemRows.reduce(
                                      (acc, r) => acc + (Number(r.totalPrice) || 0),
                                      0
                                    )
                                  )}
                                </strong>
                              </span>
                            </div>

                            {/* ─── PANEL SINKRONISASI STOK & HARGA BAHAN ───────── */}
                            {trxType === "CASH_OUT" &&
                              (isBahanBakuCategory || hppSyncPreview.directUpdates.length > 0) && (
                                <div className="mt-2 p-3.5 rounded-2xl bg-gradient-to-br from-brand-50/80 via-white to-amber-50/50 border border-brand-200/80 space-y-3">
                                  {!editingTrx && itemRows.some((r) => Boolean(r.ingredientId)) && (
                                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={alsoAddToStock}
                                        onChange={(e) => setAlsoAddToStock(e.target.checked)}
                                        className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <div>
                                        <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                                          <Package className="w-3.5 h-3.5 text-emerald-600" />
                                          Sekaligus tambah ke Stok Gudang (Mutasi IN)
                                        </span>
                                        <span className="block text-[11px] text-emerald-800 mt-0.5">
                                          Centang jika barang langsung diterima agar stok bahan bertambah otomatis tanpa input ulang di Pembelian.
                                        </span>
                                      </div>
                                    </label>
                                  )}

                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={syncIngredientPrices}
                                        onChange={(e) => setSyncIngredientPrices(e.target.checked)}
                                        className="mt-0.5 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
                                      />
                                      <div>
                                        <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                          <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
                                          Update Harga Modal Bahan Baku & Hitung Ulang HPP Menu
                                        </span>
                                        <span className="block text-[11px] text-slate-500 mt-0.5">
                                          Memperbarui harga modal master bahan, kondimen olahan, dan estimasi HPP menu terkait.
                                        </span>
                                      </div>
                                    </label>
                                    {!alsoAddToStock && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                                        <Info className="w-3 h-3 text-slate-500" />
                                        Stok fisik tetap (tidak diubah)
                                      </span>
                                    )}
                                  </div>

                                  {syncIngredientPrices && (
                                    <div className="space-y-3 pt-1 border-t border-brand-200/50">
                                      {/* Metode Hitung Harga Modal */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setPriceSyncMethod("LAST_PRICE")}
                                          className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            priceSyncMethod === "LAST_PRICE"
                                              ? "bg-white border-brand-500 ring-2 ring-brand-500/20 shadow-2xs"
                                              : "bg-white/60 border-slate-200 hover:bg-white"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-slate-900">
                                              Harga Beli Terakhir
                                            </span>
                                            <span
                                              className={`w-2.5 h-2.5 rounded-full border ${
                                                priceSyncMethod === "LAST_PRICE"
                                                  ? "bg-brand-600 border-brand-600"
                                                  : "border-slate-300"
                                              }`}
                                            />
                                          </div>
                                          <p className="text-[10px] text-slate-500 mt-0.5">
                                            Langsung mengikuti harga nota terbaru
                                          </p>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setPriceSyncMethod("WEIGHTED_AVERAGE")}
                                          className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            priceSyncMethod === "WEIGHTED_AVERAGE"
                                              ? "bg-white border-brand-500 ring-2 ring-brand-500/20 shadow-2xs"
                                              : "bg-white/60 border-slate-200 hover:bg-white"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-slate-900">
                                              Rata-rata Tertimbang
                                            </span>
                                            <span
                                              className={`w-2.5 h-2.5 rounded-full border ${
                                                priceSyncMethod === "WEIGHTED_AVERAGE"
                                                  ? "bg-brand-600 border-brand-600"
                                                  : "border-slate-300"
                                              }`}
                                            />
                                          </div>
                                          <p className="text-[10px] text-slate-500 mt-0.5">
                                            Gabungkan nilai stok saat ini + pembelian baru
                                          </p>
                                        </button>
                                      </div>

                                      {/* Live Preview Dampak */}
                                      {hppSyncPreview.directUpdates.length === 0 ? (
                                        <p className="text-[11px] text-slate-500 italic bg-white/80 px-3 py-2 rounded-xl border border-slate-200/70">
                                          Pilih bahan baku dari dropdown stok di atas dan isi Qty & Harga untuk melihat simulasi perubahan harga modal dan HPP menu.
                                        </p>
                                      ) : (
                                        <div className="bg-white rounded-xl border border-slate-200/90 p-3 space-y-2.5 text-[11px]">
                                          {/* 1. Perubahan Bahan Baku Langsung */}
                                          <div>
                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                                              Preview Harga Modal Bahan ({hppSyncPreview.directUpdates.length})
                                            </p>
                                            <div className="space-y-1">
                                              {hppSyncPreview.directUpdates.map((upd) => {
                                                const diffPct =
                                                  upd.oldCostPerUnit > 0
                                                    ? ((upd.newCostPerUnit - upd.oldCostPerUnit) /
                                                        upd.oldCostPerUnit) *
                                                      100
                                                    : 0;
                                                return (
                                                  <div
                                                    key={upd.ingredient.id}
                                                    className="flex flex-wrap items-center justify-between gap-1.5 py-1 border-b border-slate-100 last:border-0"
                                                  >
                                                    <span className="font-bold text-slate-800">
                                                      {upd.ingredient.name}{" "}
                                                      <span className="text-[10px] font-medium text-slate-400">
                                                        (Beli{" "}
                                                        {upd.totalBaseQty.toLocaleString("id-ID")}{" "}
                                                        {upd.ingredient.unit})
                                                      </span>
                                                    </span>
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                      <span className="text-slate-400 line-through">
                                                        {formatUnitCost(upd.oldCostPerUnit)}/
                                                        {upd.ingredient.unit}
                                                      </span>
                                                      <ArrowRight className="w-3 h-3 text-slate-400" />
                                                      <span className="font-extrabold text-slate-900">
                                                        {formatUnitCost(upd.newCostPerUnit)}/
                                                        {upd.ingredient.unit}
                                                      </span>
                                                      {Math.abs(diffPct) >= 0.1 && (
                                                        <span
                                                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                                            diffPct > 0
                                                              ? "bg-rose-50 text-rose-700"
                                                              : "bg-emerald-50 text-emerald-700"
                                                          }`}
                                                        >
                                                          {diffPct > 0 ? "+" : ""}
                                                          {diffPct.toFixed(1)}%
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>

                                          {/* 2. Efek Berantai Kondimen Olahan */}
                                          {hppSyncPreview.batchPrepUpdates.length > 0 && (
                                            <div className="pt-1.5 border-t border-slate-100">
                                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 mb-1.5">
                                                Efek ke Kondimen Olahan / Batch Prep (
                                                {hppSyncPreview.batchPrepUpdates.length})
                                              </p>
                                              <div className="space-y-1">
                                                {hppSyncPreview.batchPrepUpdates.map((bp) => (
                                                  <div
                                                    key={bp.ingredient.id}
                                                    className="flex flex-wrap items-center justify-between gap-1.5 py-0.5"
                                                  >
                                                    <span className="font-semibold text-slate-700">
                                                      {bp.batchPrepName} ({bp.ingredient.name})
                                                    </span>
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                      <span className="text-slate-400">
                                                        {formatUnitCost(bp.oldCostPerUnit)}/
                                                        {bp.ingredient.unit}
                                                      </span>
                                                      <ArrowRight className="w-3 h-3 text-slate-400" />
                                                      <span className="font-bold text-amber-800">
                                                        {formatUnitCost(bp.newCostPerUnit)}/
                                                        {bp.ingredient.unit}
                                                      </span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* 3. Dampak ke HPP Menu */}
                                          <div className="pt-1.5 border-t border-slate-100">
                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 mb-1.5">
                                              Dampak Estimasi HPP Menu (
                                              {hppSyncPreview.affectedVariantPreviews.length} varian
                                              terkait)
                                            </p>
                                            {hppSyncPreview.affectedVariantPreviews.length === 0 ? (
                                              <p className="text-[10px] text-slate-400">
                                                Belum ada resep menu yang menggunakan bahan baku ini.
                                              </p>
                                            ) : (
                                              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                {hppSyncPreview.affectedVariantPreviews.map(
                                                  (vp) => (
                                                    <div
                                                      key={`${vp.productId}-${vp.variantName}`}
                                                      className="flex items-center justify-between gap-2 py-0.5"
                                                    >
                                                      <span className="text-slate-700 truncate">
                                                        <strong className="text-slate-900">
                                                          {vp.productName}
                                                        </strong>{" "}
                                                        — {vp.variantName}
                                                      </span>
                                                      <div className="flex items-center gap-1.5 font-mono shrink-0">
                                                        <span className="text-slate-400">
                                                          {formatCurrency(vp.oldHpp)}
                                                        </span>
                                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                                        <span
                                                          className={`font-extrabold ${
                                                            vp.newHpp > vp.oldHpp
                                                              ? "text-rose-600"
                                                              : vp.newHpp < vp.oldHpp
                                                                ? "text-emerald-600"
                                                                : "text-slate-800"
                                                          }`}
                                                        >
                                                          {formatCurrency(vp.newHpp)}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Row 2: Total Nominal */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Total Nominal Transaksi (Rp)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                            Rp
                          </span>
                          <CurrencyInput
                            value={formAmount}
                            onValueChange={(raw) => setFormAmount(raw)}
                            required
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm font-extrabold font-mono border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      {/* Row 3: Nama Toko/Vendor, No. Nota, & Metode Bayar */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            {trxType === "CASH_IN"
                              ? "Sumber / Pelanggan (Opsional)"
                              : "Nama Toko / Vendor (Opsional)"}
                          </label>
                          <input
                            type="text"
                            value={formVendorName}
                            onChange={(e) => setFormVendorName(e.target.value)}
                            placeholder="Mis: Indogrosir / PLN / Supplier"
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            No. Nota / Referensi (Opsional)
                          </label>
                          <input
                            type="text"
                            value={formReceiptNo}
                            onChange={(e) => setFormReceiptNo(e.target.value)}
                            placeholder="Mis: INV-2026/001"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Metode Pembayaran
                          </label>
                          <CustomSelect
                            value={formPaymentMethod}
                            onChange={setFormPaymentMethod}
                            options={[
                              { value: "Tunai", label: "Tunai (Cash)" },
                              { value: "Transfer Bank", label: "Transfer Bank" },
                              { value: "QRIS / E-Wallet", label: "QRIS / E-Wallet" },
                              { value: "Kartu Debit / EDC", label: "Kartu Debit / EDC" },
                            ]}
                            buttonClassName="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Deskripsi / Catatan */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {trxType === "TRANSFER"
                        ? "Catatan Transfer (Opsional)"
                        : "Deskripsi / Keperluan"}
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      required={trxType !== "TRANSFER" && !useItemBreakdown}
                      rows={2}
                      className="w-full px-3.5 py-2 text-base sm:text-xs border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                      placeholder={
                        trxType === "TRANSFER"
                          ? "Contoh: Setor uang tunai penjualan ke rekening BCA..."
                          : "Contoh: Belanja susu segar, cup 16oz, dan sedotan bar (bisa dikosongkan jika nama barang di atas sudah diisi)..."
                      }
                    />
                  </div>
                </div>

                  {/* Modal Footer */}
                  <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                    <div className="flex items-center justify-between sm:justify-start gap-2 text-xs text-slate-500">
                      <span>Total Dicatat:</span>
                      <strong className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">
                        {formatCurrency(Number(formAmount) || 0)}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setEditingTrx(null);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 text-slate-600 bg-white sm:bg-transparent border border-slate-200 sm:border-0 hover:bg-slate-100 active:scale-95 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isReadOnly ||
                          closedPeriods.some((p: any) => p.period === formDate.slice(0, 7))
                        }
                        className="flex-[2] sm:flex-initial px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white rounded-2xl text-xs font-bold shadow-sm shadow-brand-600/20 hover:shadow-md transition-all cursor-pointer text-center"
                      >
                        {editingTrx
                          ? "Simpan Perubahan"
                          : trxType === "TRANSFER"
                            ? "Proses Transfer Kas"
                            : "Simpan Transaksi"}
                      </button>
                    </div>
                  </div>
                </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

        {/* ─── ADD / EDIT POS KAS MODAL ───────────────────────────────────── */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {isAccountModalOpen && (
                <motion.div
                  key="cashflow-account-modal-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsAccountModalOpen(false);
                      setEditingAccount(null);
                    }
                  }}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 flex justify-center items-center z-[100] overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90dvh] sm:max-h-[85vh]"
                  >
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
                      <Landmark className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                        {editingAccount ? "Edit Pos Kas / Rekening" : "Tambah Pos Kas Baru"}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                        Rekening bank, kas tunai operasional, atau dompet digital
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountModalOpen(false);
                      setEditingAccount(null);
                    }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                    aria-label="Tutup modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAccountSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Nama Pos Kas / Rekening
                      </label>
                      <input
                        type="text"
                        value={accName}
                        onChange={(e) => setAccName(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="Contoh: Kas Tunai Toko, Rekening BCA, Kas Kecil (Petty Cash)"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Jenis Pos Kas
                      </label>
                      <CustomSelect
                        value={accType}
                        onChange={(val) => setAccType(val as any)}
                        required
                        options={[
                          { value: "CASH", label: "Tunai (Kas Operasional / Petty Cash)" },
                          { value: "BANK", label: "Rekening Bank (BCA / Mandiri / BRI / BNI)" },
                          { value: "E_WALLET", label: "Dompet Digital (QRIS / GoPay / OVO / Dana)" },
                          { value: "SAVINGS", label: "Tabungan / Dana Cadangan Toko" },
                        ]}
                        buttonClassName="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white"
                      />
                    </div>

                    {!editingAccount && (
                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Saldo Awal Saat Ini (Opsional)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                              Rp
                            </span>
                            <CurrencyInput
                              value={accOpeningBalance}
                              onValueChange={(raw) => setAccOpeningBalance(raw)}
                              placeholder="0 (Kosongkan jika mulai dari Rp 0)"
                              className="w-full pl-9 pr-3.5 py-2.5 text-sm sm:text-xs font-extrabold font-mono border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Jika diisi, otomatis tercatat sebagai mutasi Saldo Awal tanpa memengaruhi laporan Laba Rugi.
                          </p>
                        </div>

                        {Number(accOpeningBalance) > 0 && (
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Tanggal Saldo Awal
                            </label>
                            <CustomDatePicker
                              value={accOpeningDate}
                              onChange={setAccOpeningDate}
                              allowClear={false}
                              buttonClassName="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountModalOpen(false);
                        setEditingAccount(null);
                      }}
                      className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      {editingAccount ? "Simpan Perubahan" : "Buat Pos Kas"}
                    </button>
                  </div>
                </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </div>

      {/* ─── SALES VERIFICATION MODAL ──────────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isVerificationModalOpen && (
              <motion.div
                key="cashflow-verification-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsVerificationModalOpen(false);
                }}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[100] p-3 sm:p-6 flex justify-center items-center overflow-hidden"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90dvh] sm:max-h-[85vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                >
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                      Verifikasi Penjualan ({unverifiedSalesLogs.length})
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                      Sinkronisasi data impor penjualan ke buku kas besar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVerificationModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                  aria-label="Tutup modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
                {unverifiedSalesLogs.length === 0 ? (
                  <p className="text-slate-500 text-center py-8 text-xs font-medium">
                    Semua data penjualan telah tervalidasi di buku arus kas.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {unverifiedSalesLogs.map((log) => {
                      const totalSales = salesTransactions
                        .filter((t) => t.importLogId === log.id)
                        .reduce((sum, t) => sum + t.totalPrice, 0);

                      return (
                        <div
                          key={log.id}
                          className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 shadow-2xs"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                Batch:{" "}
                                {new Date(log.importDate).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {log.rowCount} baris transaksi penjualan
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-extrabold font-mono tabular-nums text-sm text-emerald-600 dark:text-emerald-300">
                                {formatCurrency(totalSales)}
                              </p>
                            </div>
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (isReadOnly) return;
                              const formData = new FormData(e.currentTarget);
                              const accountId = formData.get("accountId") as string;
                              if (!accountId) return;

                              const safeTotalSales = Math.round(Number(totalSales) || 0);
                              if (safeTotalSales <= 0) {
                                toast.warning(
                                  "Nominal batch penjualan Rp 0 tidak dapat disinkronkan ke Buku Kas."
                                );
                                return;
                              }

                              const batchPeriod = getLocalPeriodFromTimestamp(log.importDate);
                              if (closedPeriods.some((p: any) => p.period === batchPeriod)) {
                                toast.error(
                                  `Gagal: Periode buku (${batchPeriod}) untuk batch ini sudah ditutup.`
                                );
                                return;
                              }

                              addCashTransaction({
                                accountId: accountId,
                                type: "CASH_IN",
                                amount: safeTotalSales,
                                date: new Date(log.importDate).toISOString(),
                                description: `Pemasukan Penjualan (${log.rowCount} transaksi)`,
                                category: "Penjualan Toko",
                                categoryId: "cat-penjualan",
                                referenceId: log.id,
                              });
                              toast.success("Omzet batch impor berhasil dicatat ke Buku Kas.");
                            }}
                            className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end"
                          >
                            <div className="flex-1">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                Simpan ke Pos Kas
                              </label>
                              <CustomSelect
                                name="accountId"
                                defaultValue=""
                                required
                                placeholder="-- Pilih Pos Kas Tujuan --"
                                options={cashAccounts.map((a) => ({
                                  value: a.id,
                                  label: a.name,
                                }))}
                                buttonClassName="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900"
                              />
                            </div>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer shrink-0"
                            >
                              Simpan ke Buku Kas
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50/70 dark:bg-slate-800/70">
                <button
                  type="button"
                  onClick={() => setIsVerificationModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        variant="danger"
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Ya, Hapus"}
        cancelLabel="Batal"
        onConfirm={() => {
          confirmAction?.onConfirm();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
};
