import React, { useState, useMemo } from "react";
import { getLocalDateString } from "../utils/dateUtils";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import { motion } from "motion/react";
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
} from "lucide-react";
import { CashAccount, CashTransaction, CashTransactionItem } from "../types";
import { CsvImportExport } from "./common/CsvImportExport";

interface CashFlowProps {
  onNavigate?: (view: any) => void;
}

interface DraftItemRow {
  id: string;
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
  name: "",
  qty: "1",
  unit: "pcs",
  unitPrice: "",
  totalPrice: "",
  lastEdited: "unit",
});

export const CashFlow: React.FC<CashFlowProps> = ({ onNavigate }) => {
  const {
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
    salesTransactions,
    salesImportLogs,
    closedPeriods,
  } = useStore();

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

  // Form fields for Add/Edit Transaction
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formToAccountId, setFormToAccountId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(() => getLocalDateString());
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formCustomCategory, setFormCustomCategory] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formVendorName, setFormVendorName] = useState<string>("");
  const [formReceiptNo, setFormReceiptNo] = useState<string>("");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("Tunai");
  const [useItemBreakdown, setUseItemBreakdown] = useState<boolean>(true);
  const [itemRows, setItemRows] = useState<DraftItemRow[]>([createEmptyItemRow()]);

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

  const totalBalance = useMemo(() => {
    return (Object.values(accountBalances) as number[]).reduce((sum, b) => sum + b, 0);
  }, [accountBalances]);

  // ─── Date Filter Matcher ────────────────────────────────────────────────────
  const matchesPeriod = (isoDate: string): boolean => {
    if (periodMode === "ALL") return true;
    const localDay = getLocalDateString(new Date(isoDate));
    const todayStr = getLocalDateString();

    if (periodMode === "TODAY") {
      return localDay === todayStr;
    }
    if (periodMode === "WEEK") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const minDay = getLocalDateString(sevenDaysAgo);
      return localDay >= minDay && localDay <= todayStr;
    }
    if (periodMode === "MONTH") {
      return localDay.startsWith(selectedMonth);
    }
    if (periodMode === "CUSTOM") {
      if (customStartDate && localDay < customStartDate) return false;
      if (customEndDate && localDay > customEndDate) return false;
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

  // ─── Filtered Transactions for Table / Mobile List ─────────────────────────
  const filteredTransactions = useMemo(() => {
    return scopeTransactions
      .filter((f) => {
        if (typeFilter === "TRANSFER") {
          if (!isInternalTransfer(f)) return false;
        } else if (typeFilter !== "ALL") {
          if (getNormalizedType(f.type) !== typeFilter) return false;
        }
        if (categoryFilter !== "ALL" && f.category !== categoryFilter) {
          return false;
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
  }, [scopeTransactions, typeFilter, categoryFilter, searchTerm]);

  // Available categories for filter dropdown
  const availableCategoriesInScope = useMemo(() => {
    const set = new Set<string>();
    cashTransactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    expenseCategories.forEach((c: any) => {
      if (c.isActive && c.name) set.add(c.name);
    });
    return Array.from(set).sort();
  }, [cashTransactions, expenseCategories]);

  // ─── Two-Way Item Calculation Handlers ─────────────────────────────────────
  const recalculateTotalFromItems = (rows: DraftItemRow[]) => {
    const sum = rows.reduce((acc, r) => acc + (Number(r.totalPrice) || 0), 0);
    if (sum > 0) {
      setFormAmount(String(Math.round(sum)));
    }
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

  // ─── Open Transaction Modal (Create vs Edit) ────────────────────────────────
  const openCreateModal = (initialType: "CASH_IN" | "CASH_OUT" | "TRANSFER" = "CASH_OUT") => {
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
    setFormCategoryId("");
    setFormCustomCategory(initialType === "CASH_IN" ? "Penjualan Toko" : "");
    setFormDescription("");
    setFormVendorName("");
    setFormReceiptNo("");
    setFormPaymentMethod("Tunai");
    setUseItemBreakdown(initialType === "CASH_OUT");
    setItemRows([createEmptyItemRow()]);
    setIsModalOpen(true);
  };

  const openEditModal = (trx: CashTransaction) => {
    setEditingTrx(trx);
    const normType = getNormalizedType(trx.type);
    setTrxType(normType === "TRANSFER" ? "CASH_OUT" : normType);
    setFormAccountId(trx.accountId);
    setFormToAccountId("");
    setFormDate(getLocalDateString(new Date(trx.date)));
    setFormAmount(String(Math.round(Number(trx.amount || 0))));
    setFormCategoryId(trx.categoryId || "");
    setFormCustomCategory(trx.category || "");
    setFormDescription(trx.description || "");
    setFormVendorName(trx.vendorName || "");
    setFormReceiptNo(trx.receiptNo || "");
    setFormPaymentMethod(trx.paymentMethod || "Tunai");

    if (Array.isArray(trx.items) && trx.items.length > 0) {
      setUseItemBreakdown(true);
      setItemRows(
        trx.items.map((it, idx) => ({
          id: `${idx}-${Date.now()}`,
          name: it.name || "",
          qty: String(it.qty ?? 1),
          unit: it.unit || "pcs",
          unitPrice: String(Math.round(Number(it.unitPrice || 0))),
          totalPrice: String(Math.round(Number(it.totalPrice || 0))),
          lastEdited: "unit",
        }))
      );
    } else {
      setUseItemBreakdown(false);
      setItemRows([createEmptyItemRow()]);
    }
    setIsModalOpen(true);
  };

  // ─── Submit Create / Edit / Transfer ────────────────────────────────────────
  const handleTrxSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const period = formDate.slice(0, 7);
    if (closedPeriods.some((p: any) => p.period === period)) {
      alert(`Gagal: Periode buku (${period}) untuk tanggal ini sudah ditutup.`);
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
      isoDate = new Date(`${formDate}T${nowTime}`).toISOString();
    }

    // 1. Handle Internal Transfer Between Cash Accounts
    if (!editingTrx && trxType === "TRANSFER") {
      if (!formAccountId || !formToAccountId) {
        alert("Pilih Pos Kas Asal dan Pos Kas Tujuan.");
        return;
      }
      if (formAccountId === formToAccountId) {
        alert("Pos Kas Asal dan Pos Kas Tujuan tidak boleh sama.");
        return;
      }
      const transferAmount = Math.round(Number(formAmount) || 0);
      if (transferAmount <= 0) {
        alert("Masukkan nominal transfer yang valid.");
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

      setIsModalOpen(false);
      return;
    }

    // 2. Parse Item Breakdown (if active)
    const validItems: CashTransactionItem[] = useItemBreakdown
      ? itemRows
          .map((r) => {
            const qty = parseFloat(r.qty) || 1;
            const unitPrice = Math.round(parseFloat(r.unitPrice) || 0);
            const totalPrice = Math.round(parseFloat(r.totalPrice) || qty * unitPrice);
            return {
              name: r.name.trim(),
              qty,
              unit: r.unit || "pcs",
              unitPrice: unitPrice > 0 ? unitPrice : qty > 0 ? Math.round(totalPrice / qty) : 0,
              totalPrice,
            };
          })
          .filter((it) => it.totalPrice > 0)
      : [];

    const itemsSum = validItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const finalAmount = Math.round(Number(formAmount) || itemsSum || 0);

    if (finalAmount <= 0) {
      alert("Nominal transaksi harus lebih dari Rp 0.");
      return;
    }

    // Resolve category name & ID
    const matchedCat = expenseCategories.find((c: any) => c.id === formCategoryId);
    const finalCategoryName =
      matchedCat?.name ||
      formCustomCategory.trim() ||
      (trxType === "CASH_IN" ? "Pendapatan Lainnya" : "Pengeluaran Operasional");

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
      addCashTransaction({
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

    setIsModalOpen(false);
    setEditingTrx(null);
  };

  // ─── Delete Transaction (with Paired Transfer Detection) ───────────────────
  const handleDeleteTransaction = (trx: CashTransaction) => {
    const ref = String(trx.referenceId || "");
    if (ref.startsWith("TRANSFER:")) {
      const pair = cashTransactions.find((t) => t.id !== trx.id && t.referenceId === ref);
      if (pair) {
        if (
          confirm(
            "Transaksi ini adalah mutasi Transfer Antar Kas.\n\nHapus kedua sisi mutasi transfer (Pos Asal & Pos Tujuan) sekaligus agar saldo buku kas tetap seimbang?"
          )
        ) {
          deleteCashTransaction(trx.id);
          deleteCashTransaction(pair.id);
        }
        return;
      }
    }

    if (confirm("Apakah Anda yakin ingin menghapus transaksi ini dari Buku Kas?")) {
      deleteCashTransaction(trx.id);
    }
  };

  // ─── Open / Submit Account Modal (Add & Edit Pos Kas) ──────────────────────
  const openAddAccountModal = () => {
    setEditingAccount(null);
    setAccName("");
    setAccType("CASH");
    setAccOpeningBalance("");
    setAccOpeningDate(getLocalDateString());
    setIsAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: CashAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccOpeningBalance("");
    setIsAccountModalOpen(true);
  };

  const handleAccountSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = accName.trim();
    if (!trimmedName) return;

    if (editingAccount) {
      updateCashAccount({
        ...editingAccount,
        name: trimmedName,
        type: accType,
      });
    } else {
      const newAccId = addCashAccount({
        name: trimmedName,
        type: accType,
        isDefault: cashAccounts.length === 0,
      });

      const openingAmt = Math.round(Number(accOpeningBalance) || 0);
      if (openingAmt > 0 && newAccId) {
        const isoDate =
          accOpeningDate === getLocalDateString()
            ? new Date().toISOString()
            : new Date(`${accOpeningDate}T08:00:00`).toISOString();

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
    }

    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  // ─── Excel Import Handler ───────────────────────────────────────────────────
  const handleImport = (parsedData: any[]) => {
    if (cashAccounts.length === 0) {
      alert("Silakan buat Pos Kas terlebih dahulu sebelum mengimpor transaksi.");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let errors = 0;

    parsedData.forEach((row: any) => {
      try {
        const systemId = row["ID_SISTEM (JANGAN DIUBAH)"]?.trim();
        const rawDate = String(row["Tanggal"] || "").trim();
        const date = rawDate
          ? rawDate.includes("T")
            ? rawDate
            : new Date(`${rawDate}T12:00:00`).toISOString()
          : new Date().toISOString();
        const rawJenis = String(row["Jenis"] || "").toLowerCase();
        const type = rawJenis.includes("masuk") ? "CASH_IN" : "CASH_OUT";
        const category = row["Kategori"] || "Lainnya";
        const description = row["Deskripsi"] || "Impor Excel";
        const vendorName = row["Toko / Vendor"] ? String(row["Toko / Vendor"]).trim() : null;
        const receiptNo = row["No. Nota / Ref"] ? String(row["No. Nota / Ref"]).trim() : null;

        const qty = parseFloat(row["Qty"]) || 0;
        const unit = String(row["Satuan"] || "pcs").trim();
        const unitPrice = Math.round(parseFloat(row["Harga Satuan"]) || 0);
        let amount = Math.round(parseFloat(row["Jumlah"]) || 0);
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
          const rowPeriod = date.substring(0, 7);
          if (closedPeriods.some((p: any) => p.period === rowPeriod)) {
            errors++;
            return;
          }

          const existingTrx = cashTransactions.find((t) => t.id === systemId);
          if (existingTrx) {
            updateCashTransaction({
              ...existingTrx,
              accountId: posKas.id,
              type,
              date,
              amount,
              description,
              category,
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
              category,
              categoryId: null,
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

    alert(
      `Impor selesai.\nDitambahkan: ${addedCount} transaksi baru\nDiperbarui: ${updatedCount} transaksi\nDilewati: ${errors} baris`
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200/60 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Buku Kas Besar
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/70 shadow-2xs">
                <Building2 className="w-3 h-3 text-slate-500" />
                Manajemen Kas & Rekening
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Buku Kas & Arus Kas
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Pencatatan kas masuk, rincian item pengeluaran (Qty & harga satuan), transfer antar rekening, dan saldo berjalan.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-ai-assistant", {
                    detail: { tab: "quick-input" },
                  })
                );
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-brand-50 to-indigo-50 hover:from-brand-100 hover:to-indigo-100 text-brand-800 border border-brand-200/80 rounded-2xl text-xs font-bold shadow-2xs active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              title="Catat pengeluaran/pemasukan kas dengan kalimat bebas (AI Natural Input)"
            >
              <Sparkles className="w-4 h-4 text-brand-600 fill-brand-600/20 shrink-0" />
              <span>✨ Catat Cepat AI</span>
            </button>

            {!isReadOnly && cashAccounts.length >= 2 && (
              <button
                onClick={() => openCreateModal("TRANSFER")}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                title="Pindahkan saldo antar pos kas (mis. Setor Kas Tunai ke Bank)"
              >
                <ArrowLeftRight className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Transfer Kas</span>
              </button>
            )}

            {!isReadOnly && (
              <button
                onClick={() => openCreateModal("CASH_OUT")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Catat Transaksi</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── 4 Executive Bento KPI Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Saldo Kas Riil */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {selectedAccountId === "all" ? "Total Likuiditas Kas" : "Saldo Pos Aktif"}
              </span>
              <div className="w-10 h-10 rounded-2xl bg-blue-50/80 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-2xs">
                <Wallet className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {formatCurrency(
                  selectedAccountId === "all"
                    ? totalBalance
                    : accountBalances[selectedAccountId] || 0
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {selectedAccountId === "all"
                  ? `${cashAccounts.length} pos kas & rekening terdaftar`
                  : `Pos: ${cashAccounts.find((a) => a.id === selectedAccountId)?.name || "-"}`}
              </p>
            </div>
          </div>

          {/* Card 2: Pemasukan Kas (Cash In) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pemasukan Kas (+)
              </span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50/80 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-2xs">
                <TrendingUp className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600">
                {formatCurrency(totalCashIn)}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {periodMode === "ALL" ? "Total dana masuk tercatat" : "Dana masuk pada periode dipilih"}
              </p>
            </div>
          </div>

          {/* Card 3: Pengeluaran Kas (Cash Out) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pengeluaran Kas (-)
              </span>
              <div className="w-10 h-10 rounded-2xl bg-rose-50/80 text-rose-600 border border-rose-200/60 flex items-center justify-center shadow-2xs">
                <TrendingDown className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600">
                {formatCurrency(totalCashOut)}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Belanja bahan, utilitas & operasional
              </p>
            </div>
          </div>

          {/* Card 4: Net Cash Flow */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Selisih Arus Kas (Net)
              </span>
              <div
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-2xs ${
                  netCashFlow >= 0
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                    : "bg-amber-50 text-amber-600 border-amber-200/60"
                }`}
              >
                <Layers className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  netCashFlow >= 0 ? "text-slate-900" : "text-amber-600"
                }`}
              >
                {formatCurrency(netCashFlow)}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
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
              <button
                onClick={openAddAccountModal}
                className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pos Kas</span>
              </button>
            )}
          </div>

          {cashAccounts.length === 0 ? (
            <div className="bg-amber-50/80 text-amber-900 p-5 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">Belum Ada Pos Kas Terdaftar</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Buat minimal satu pos kas (contoh: "Kas Tunai Operasional" atau "Bank BCA") untuk mulai mencatat buku kas.
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={openAddAccountModal}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                >
                  Buat Pos Kas Baru
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {/* Account Card: Semua Pos Kas */}
              <div
                onClick={() => setSelectedAccountId("all")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  selectedAccountId === "all"
                    ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]"
                    : "bg-slate-50/80 text-slate-800 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-xs"
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
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-slate-200">
                      Gabungan
                    </span>
                  )}
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold ${
                      selectedAccountId === "all" ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Semua Pos Kas
                  </p>
                  <p className="text-lg font-extrabold mt-0.5 tracking-tight">
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Hapus pos kas "${acc.name}"? Pastikan tidak ada transaksi aktif yang masih bergantung pada pos ini.`
                                  )
                                ) {
                                  deleteCashAccount(acc.id);
                                  if (selectedAccountId === acc.id) setSelectedAccountId("all");
                                }
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
                      <p
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-white" : "text-slate-800"
                        }`}
                      >
                        {acc.name}
                      </p>
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
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
          {/* Top Filter Bar */}
          <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
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
                        onClick={() => setTypeFilter(tab.id as any)}
                        className={`relative px-3 py-1.5 rounded-xl font-semibold transition-colors duration-200 cursor-pointer ${
                          isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="cashflowFilterTab"
                            className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
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
                        onClick={() => setIsVerificationModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl transition-all shrink-0 text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Verifikasi Penjualan ({unverifiedSalesLogs.length})</span>
                      </button>
                    )}

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate("expense_categories")}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl transition-all shrink-0 text-xs font-semibold shadow-2xs cursor-pointer"
                        title="Kelola & Atur Kategori Kas & Biaya"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-500" />
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
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}

                {periodMode === "CUSTOM" && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white"
                    />
                    <span className="text-slate-400 font-bold">s/d</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white"
                    />
                  </div>
                )}

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50/70 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">Semua Kategori</option>
                  {availableCategoriesInScope.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
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
                  const isClosed = closedPeriods.some(
                    (p: any) => p.period === trx.date.substring(0, 7)
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
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200/60"
                                : normType === "CASH_IN"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                                  : "bg-rose-50 text-rose-700 border-rose-200/60"
                            }`}
                          >
                            {isTransfer ? (
                              <>
                                <ArrowLeftRight className="w-3 h-3 text-indigo-600 stroke-[2.3]" />
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            {trx.category}
                          </span>
                        </div>
                      </td>

                      {/* Deskripsi + Vendor/Nota + Rincian Item */}
                      <td className="py-3.5 px-5 text-slate-700 max-w-md">
                        <p className="font-bold text-slate-900 leading-snug">
                          {trx.description}
                        </p>

                        {/* Meta badges: Vendor & No Nota */}
                        {(trx.vendorName || trx.receiptNo || trx.paymentMethod) && (
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
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
                        )}

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
                              onClick={() => openEditModal(trx)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                              title="Edit Transaksi"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
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
              const isClosed = closedPeriods.some(
                (p: any) => p.period === trx.date.substring(0, 7)
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
                            • <strong>{it.name || trx.description}</strong> ({it.qty} {it.unit} ×{" "}
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {trx.category}
                      </span>
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
                          onClick={() => openEditModal(trx)}
                          className="text-slate-500 hover:text-brand-600 text-xs font-semibold flex items-center gap-1 p-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
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
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center z-50 animate-fade-in">
            <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/80 animate-scale-up flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs ${
                      trxType === "CASH_IN"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                        : trxType === "TRANSFER"
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-200/60"
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
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      {editingTrx
                        ? "Edit Transaksi Buku Kas"
                        : trxType === "TRANSFER"
                          ? "Transfer / Pindah Dana Antar Pos Kas"
                          : "Catat Transaksi Buku Kas"}
                    </h2>
                    <p className="text-xs text-slate-400">
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
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTrxSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                  {/* Type Toggle Sliding Pill */}
                  <div className="flex gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => {
                        setTrxType("CASH_OUT");
                        if (!editingTrx) setUseItemBreakdown(true);
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        trxType === "CASH_OUT"
                          ? "bg-white text-rose-700 shadow-xs border border-rose-200/60"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Pengeluaran (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrxType("CASH_IN");
                        if (!editingTrx) setUseItemBreakdown(false);
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        trxType === "CASH_IN"
                          ? "bg-white text-emerald-700 shadow-xs border border-emerald-200/60"
                          : "text-slate-500 hover:text-slate-800"
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
                            ? "bg-white text-indigo-700 shadow-xs border border-indigo-200/60"
                            : "text-slate-500 hover:text-slate-800"
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
                      <select
                        value={formAccountId}
                        onChange={(e) => setFormAccountId(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                      >
                        <option value="" disabled>
                          Pilih Pos Kas...
                        </option>
                        {cashAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(accountBalances[acc.id] || 0)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {trxType === "TRANSFER" ? (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Ke Pos Kas (Tujuan)
                        </label>
                        <select
                          value={formToAccountId}
                          onChange={(e) => setFormToAccountId(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                        >
                          <option value="" disabled>
                            Pilih Pos Kas Tujuan...
                          </option>
                          {cashAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({formatCurrency(accountBalances[acc.id] || 0)})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Tanggal Transaksi
                        </label>
                        <input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
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
                        <input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
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
                          <input
                            type="number"
                            value={formAmount}
                            onChange={(e) => setFormAmount(e.target.value)}
                            required
                            min="1"
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm font-extrabold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ─── RINCIAN ITEM / QUANTITY & HARGA SATUAN ↔ TOTAL ────────── */}
                      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-brand-100/80 text-brand-700 flex items-center justify-center">
                              <Calculator className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-extrabold text-slate-800">
                                Rincian Barang / Kuantitas & Harga Item
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Isi <strong>Qty + Harga Satuan</strong> atau <strong>Qty + Harga Total</strong> (otomatis menghitung dua arah)
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
                            {itemRows.map((row, idx) => (
                              <div
                                key={row.id}
                                className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Item #{idx + 1}
                                  </span>
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

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                  {/* Nama Item */}
                                  <div className="sm:col-span-4">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                      Nama Barang / Item {itemRows.length === 1 ? "(Opsional)" : ""}
                                    </label>
                                    <input
                                      type="text"
                                      value={row.name}
                                      onChange={(e) =>
                                        handleItemRowChange(row.id, "name", e.target.value)
                                      }
                                      placeholder="Mis: Susu Diamond / Cup 16oz"
                                      className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                  </div>

                                  {/* Qty */}
                                  <div className="grid grid-cols-2 sm:col-span-3 gap-1.5">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
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
                                        className="w-full px-2.5 py-2 text-xs font-extrabold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-center"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                        Satuan
                                      </label>
                                      <select
                                        value={row.unit}
                                        onChange={(e) =>
                                          handleItemRowChange(row.id, "unit", e.target.value)
                                        }
                                        className="w-full px-2 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                      >
                                        {UNIT_OPTIONS.map((u) => (
                                          <option key={u} value={u}>
                                            {u}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Harga per Item / Satuan */}
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                      Harga / {row.unit} (Rp)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.unitPrice}
                                      onChange={(e) =>
                                        handleItemRowChange(row.id, "unitPrice", e.target.value)
                                      }
                                      placeholder="0"
                                      className="w-full px-2.5 py-2 text-xs font-bold font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                  </div>

                                  {/* Harga Total Item */}
                                  <div className="sm:col-span-3">
                                    <label className="block text-[10px] font-bold text-brand-700 mb-1">
                                      Harga Total Item (Rp)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.totalPrice}
                                      onChange={(e) =>
                                        handleItemRowChange(row.id, "totalPrice", e.target.value)
                                      }
                                      placeholder="0"
                                      className="w-full px-2.5 py-2 text-xs font-extrabold font-mono border border-brand-300 bg-brand-50/40 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

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
                          </div>
                        )}
                      </div>

                      {/* Row 2: Total Nominal & Kategori */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Total Nominal Transaksi (Rp)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                              Rp
                            </span>
                            <input
                              type="number"
                              value={formAmount}
                              onChange={(e) => setFormAmount(e.target.value)}
                              required
                              min="1"
                              placeholder="0"
                              className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm font-extrabold font-mono border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                              Kategori {trxType === "CASH_IN" ? "Pemasukan" : "Pengeluaran"}
                            </label>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsModalOpen(false);
                                  onNavigate("expense_categories");
                                }}
                                className="text-[11px] text-brand-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Tag className="w-3 h-3" />+ Atur Kategori
                              </button>
                            )}
                          </div>

                          {trxType === "CASH_IN" ? (
                            <select
                              value={formCustomCategory}
                              onChange={(e) => {
                                setFormCustomCategory(e.target.value);
                                setFormCategoryId("");
                              }}
                              required
                              className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                            >
                              <option value="Penjualan Toko">Penjualan Toko / Omzet</option>
                              <option value="Setoran Modal / Top Up Kas">
                                Setoran Modal / Top Up Kas
                              </option>
                              <option value="Pendapatan Catering / Event">
                                Pendapatan Catering / Event
                              </option>
                              <option value="Pengembalian Dana / Refund Supplier">
                                Pengembalian Dana / Refund Supplier
                              </option>
                              <option value="Pendapatan Lainnya">Pendapatan Lainnya</option>
                            </select>
                          ) : (
                            <select
                              value={formCategoryId}
                              onChange={(e) => setFormCategoryId(e.target.value)}
                              required={!formCustomCategory}
                              className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                            >
                              <option value="">-- Pilih Kategori Biaya --</option>
                              {expenseCategories
                                .filter((c: any) => c.isActive)
                                .map((cat: any) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.parentId ? "— " : ""}
                                    {cat.name} ({cat.type})
                                  </option>
                                ))}
                            </select>
                          )}
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
                          <select
                            value={formPaymentMethod}
                            onChange={(e) => setFormPaymentMethod(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white"
                          >
                            <option value="Tunai">Tunai (Cash)</option>
                            <option value="Transfer Bank">Transfer Bank</option>
                            <option value="QRIS / E-Wallet">QRIS / E-Wallet</option>
                            <option value="Kartu Debit / EDC">Kartu Debit / EDC</option>
                          </select>
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
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2.5 shrink-0">
                  <div className="text-xs text-slate-500">
                    Total Dicatat:{" "}
                    <strong className="text-sm font-extrabold text-slate-900 font-mono">
                      {formatCurrency(Number(formAmount) || 0)}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingTrx(null);
                      }}
                      className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
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
            </div>
          </div>
        )}

        {/* ─── ADD / EDIT POS KAS MODAL ───────────────────────────────────── */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center z-50 animate-fade-in">
            <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 animate-scale-up flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs">
                    <Landmark className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      {editingAccount ? "Edit Pos Kas / Rekening" : "Tambah Pos Kas Baru"}
                    </h2>
                    <p className="text-xs text-slate-400">
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
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAccountSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
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
                    <select
                      value={accType}
                      onChange={(e) => setAccType(e.target.value as any)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                    >
                      <option value="CASH">Tunai (Kas Operasional / Petty Cash)</option>
                      <option value="BANK">Rekening Bank (BCA / Mandiri / BRI / BNI)</option>
                      <option value="E_WALLET">Dompet Digital (QRIS / GoPay / OVO / Dana)</option>
                      <option value="SAVINGS">Tabungan / Dana Cadangan Toko</option>
                    </select>
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
                          <input
                            type="number"
                            min="0"
                            value={accOpeningBalance}
                            onChange={(e) => setAccOpeningBalance(e.target.value)}
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
                          <input
                            type="date"
                            value={accOpeningDate}
                            onChange={(e) => setAccOpeningDate(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50/50"
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
            </div>
          </div>
        )}
      </div>

      {/* ─── SALES VERIFICATION MODAL ──────────────────────────────────── */}
      {isVerificationModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center animate-fade-in">
          <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-200/80 overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Verifikasi Penjualan ({unverifiedSalesLogs.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Sinkronisasi data impor penjualan ke buku kas besar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
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
                        className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-xs text-slate-900">
                              Batch:{" "}
                              {new Date(log.importDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {log.rowCount} baris transaksi penjualan
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-sm text-emerald-600">
                              {formatCurrency(totalSales)}
                            </p>
                          </div>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const accountId = formData.get("accountId") as string;
                            if (!accountId) return;

                            addCashTransaction({
                              accountId: accountId,
                              type: "CASH_IN",
                              amount: totalSales,
                              date: new Date(log.importDate).toISOString(),
                              description: `Pemasukan Penjualan (${log.rowCount} transaksi)`,
                              category: "Penjualan Toko",
                              categoryId: null,
                              referenceId: log.id,
                            });
                          }}
                          className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end"
                        >
                          <div className="flex-1">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Simpan ke Pos Kas
                            </label>
                            <select
                              name="accountId"
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                            >
                              <option value="">-- Pilih Pos Kas Tujuan --</option>
                              {cashAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
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

            <div className="p-4 px-6 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/70">
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 active:scale-95 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
