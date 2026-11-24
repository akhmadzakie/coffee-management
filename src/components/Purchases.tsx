import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Trash2,
  ShoppingBag,
  Printer,
  Download,
  CheckCircle,
  PackageCheck,
  Search,
  Package,
  AlertTriangle,
  Clock,
  Store,
  Building2,
  Coins,
  Receipt,
  Sparkles,
  CheckCircle2,
  X,
  CreditCard,
  Lock,
} from "lucide-react";
import { PurchaseOrder, PurchaseOrderItem } from "../types";
import { CustomSelect } from "./common/CustomSelect";
import { CustomDatePicker } from "./common/CustomDatePicker";
import { CurrencyInput } from "./common/CurrencyInput";
import { toast } from "../context/ToastContext";
import { exportToCSV } from "../utils/export";
import { computeCashAccountBalances } from "../utils/financeMetrics";
import { getLocalDateString, getLocalPeriodString } from "../utils/dateUtils";
import {
  getLocalPeriodFromTimestamp,
  addDaysToLocalDate,
  computeDueDateStatus,
  validatePoCheckoutInput,
  validatePoPaymentInput,
} from "../utils/syncSanitizers";
import {
  calculateCashFlowHppSync,
  getIngredientPackagingChoices,
  getPackagingSelectValue,
} from "../utils/posDomainLogic";
import { motion, AnimatePresence } from "motion/react";

export const Purchases = () => {
  const {
    ingredients,
    suppliers,
    purchaseOrders,
    addPurchaseOrder,
    addDirectMarketPurchase,
    payPurchaseOrder,
    cashAccounts,
    cashTransactions,
    products,
    recipes,
    batchPreparations,
    markPOAsReceived,
    deletePurchaseOrder,
    closedPeriods = [],
    settings,
    isReadOnly,
    currentUser,
  } = useStore();

  const isPeriodClosed = (dateStr: string) => {
    if (!dateStr) return false;
    const period = getLocalPeriodFromTimestamp(dateStr);
    return Boolean(period) && closedPeriods.some((p) => p.period === period);
  };

  const isFinance =
    currentUser?.role === "FINANCE" ||
    currentUser?.role === "SUPER_ADMIN";

  const accountBalances = useMemo(
    () => computeCashAccountBalances(cashAccounts, cashTransactions),
    [cashAccounts, cashTransactions]
  );

  const canProcessPayment = !isReadOnly && isFinance;

  const [activeTab, setActiveTab] = useState<"new_po" | "history" | "payables">(
    isReadOnly ? "payables" : "new_po"
  );
  const [payableFilter, setPayableFilter] = useState<
    "ALL" | "OVERDUE" | "DUE_SOON" | "PARTIAL" | "UNPAID"
  >("ALL");
  const [payableSupplierFilter, setPayableSupplierFilter] = useState<string>("");
  const [historyFilter, setHistoryFilter] = useState<
    "ALL" | "PENDING_DELIVERY" | "UNPAID" | "PAID" | "MARKET"
  >("ALL");

  // Purchase Mode: Formal Distributor PO vs Direct Market/Cash Purchase
  const [purchaseMode, setPurchaseMode] = useState<"DISTRIBUTOR" | "MARKET">("DISTRIBUTOR");
  const [marketName, setMarketName] = useState("Pasar Tradisional");
  const [marketNotes, setMarketNotes] = useState("");
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>("");

  // PO State
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [deliveryOption, setDeliveryOption] = useState<"RECEIVED" | "PENDING">("RECEIVED");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [payableSearch, setPayableSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TEMPO">("CASH");
  const [dueDate, setDueDate] = useState<string>("");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [payDate, setPayDate] = useState<string>(() => getLocalDateString());
  const [selectedPOForPay, setSelectedPOForPay] = useState<PurchaseOrder | null>(null);
  const [currentInvoiceData, setCurrentInvoiceData] = useState<PurchaseOrder | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseOrder | null>(null);
  const [poToReceive, setPoToReceive] = useState<PurchaseOrder | null>(null);

  const isIndo = settings.language === "id";

  const getDueStatus = (dueDateStr?: string) => computeDueDateStatus(dueDateStr);

  const openPayModal = (po: PurchaseOrder) => {
    if (!canProcessPayment) return;
    const remaining = Math.max(0, Math.round(po.totalAmount - (po.amountPaid || 0)));
    if (remaining <= 0) {
      toast.info("Tagihan PO ini sudah lunas.");
      return;
    }
    setSelectedPOForPay(po);
    setPayAmount(remaining);
    setPayNotes("");
    setPayDate(getLocalDateString());
    const validCurrent = cashAccounts.some((a) => a.id === payAccountId)
      ? payAccountId
      : "";
    setPayAccountId(validCurrent || selectedCashAccountId || cashAccounts[0]?.id || "");
    setPayModalOpen(true);
  };

  // AP / Debt KPI calculations
  const unpaidPOs = purchaseOrders.filter(
    (po) => po.status === "UNPAID" || po.status === "PARTIAL"
  );
  const totalUnpaidDebt = unpaidPOs.reduce(
    (sum, po) => sum + Math.max(0, Math.round(po.totalAmount - (po.amountPaid || 0))),
    0
  );

  const overduePOs = unpaidPOs.filter((po) => {
    const status = getDueStatus(po.dueDate);
    return status.variant === "overdue";
  });
  const overdueDebt = overduePOs.reduce(
    (sum, po) => sum + Math.max(0, Math.round(po.totalAmount - (po.amountPaid || 0))),
    0
  );

  const dueSoonPOs = unpaidPOs.filter((po) => {
    const status = getDueStatus(po.dueDate);
    return status.variant === "due_today" || status.variant === "due_soon";
  });

  const pendingDeliveryCount = purchaseOrders.filter(
    (po) => po.deliveryStatus !== "RECEIVED"
  ).length;

  const currentMonthStr = getLocalPeriodString();
  const currentMonthPOs = purchaseOrders.filter(
    (po) => getLocalPeriodFromTimestamp(po.date) === currentMonthStr
  );
  const currentMonthPurchasesTotal = currentMonthPOs.reduce(
    (sum, po) => sum + Math.round(po.totalAmount || 0),
    0
  );

  const filteredPayables = unpaidPOs.filter((po) => {
    const supplier = suppliers.find((s) => s.id === po.supplierId);
    const supName = supplier?.name || po.supplierName || "";
    const q = payableSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      po.poNumber.toLowerCase().includes(q) ||
      supName.toLowerCase().includes(q);
    const matchesSupplier =
      !payableSupplierFilter || po.supplierId === payableSupplierFilter;

    const dueStatus = getDueStatus(po.dueDate);
    let matchesStatus = true;
    if (payableFilter === "OVERDUE") matchesStatus = dueStatus.variant === "overdue";
    else if (payableFilter === "DUE_SOON")
      matchesStatus =
        dueStatus.variant === "due_today" || dueStatus.variant === "due_soon";
    else if (payableFilter === "PARTIAL") matchesStatus = po.status === "PARTIAL";
    else if (payableFilter === "UNPAID") matchesStatus = po.status === "UNPAID";

    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const filteredHistoryPOs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return purchaseOrders
      .filter((po) => {
        if (historyFilter === "PENDING_DELIVERY" && po.deliveryStatus === "RECEIVED") {
          return false;
        }
        if (
          historyFilter === "UNPAID" &&
          po.status !== "UNPAID" &&
          po.status !== "PARTIAL"
        ) {
          return false;
        }
        if (historyFilter === "PAID" && po.status !== "PAID") {
          return false;
        }
        if (historyFilter === "MARKET" && po.purchaseType !== "MARKET") {
          return false;
        }
        if (!q) return true;
        const supplier = suppliers.find((s) => s.id === po.supplierId);
        const supName = supplier?.name || po.supplierName || "";
        return (
          po.poNumber.toLowerCase().includes(q) ||
          supName.toLowerCase().includes(q) ||
          (po.notes || "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseOrders, suppliers, historySearch, historyFilter]);

  useEffect(() => {
    if (cashAccounts.length > 0 && !selectedCashAccountId) {
      const defaultAcc =
        cashAccounts.find(
          (a) =>
            a.name.toLowerCase().includes("kasir") ||
            a.name.toLowerCase().includes("drawer") ||
            a.name.toLowerCase().includes("petty")
        ) || cashAccounts[0];
      if (defaultAcc) setSelectedCashAccountId(defaultAcc.id);
    }
  }, [cashAccounts, selectedCashAccountId]);

  // Categories
  const categories = [
    "ALL",
    ...Array.from(new Set(ingredients.map((p) => p.category).filter(Boolean))),
  ];

  const filteredProducts = ingredients.filter((product) => {
    const q = catalogSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      product.name.toLowerCase().includes(q) ||
      (product.category || "").toLowerCase().includes(q);
    const matchesCategory =
      selectedCategory === "ALL" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (productId: string) => {
    const product = ingredients.find((p) => p.id === productId);
    if (!product) return;

    const existingItem = cart.find((item) => item.productId === productId);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unitPrice,
              }
            : item
        )
      );
    } else {
      const hasMaster = Boolean(
        product.purchaseUnit && Number(product.conversionFactor) > 0
      );
      const factor = hasMaster ? Number(product.conversionFactor) : 1;
      const unit = hasMaster ? product.purchaseUnit! : product.unit;
      const unitMode = hasMaster ? ("PURCHASE" as const) : ("BASE" as const);
      const defaultPrice = hasMaster
        ? Math.round(
            Number(product.purchasePrice) > 0
              ? Number(product.purchasePrice)
              : Number(product.costPerUnit || 0) * factor
          )
        : Math.round(Number(product.costPerUnit || 0));

      setCart([
        ...cart,
        {
          productId,
          quantity: 1,
          unitPrice: defaultPrice,
          subtotal: defaultPrice,
          unit,
          unitMode,
          conversionFactor: factor,
        },
      ]);
    }
  };

  const handleCartPackagingChange = (productId: string, choiceKey: string) => {
    const ing = ingredients.find((i) => i.id === productId);
    if (!ing) return;
    const choices = getIngredientPackagingChoices(ing);
    const chosen = choices.find((c) => c.key === choiceKey);
    if (!chosen) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        let nextUnit = chosen.unit;
        let factor = chosen.factor;
        let defaultPrice = 0;

        if (chosen.mode === "CUSTOM") {
          nextUnit =
            item.unitMode === "CUSTOM" && item.unit?.trim() ? item.unit : "Karton";
          const curFactor = Number(item.conversionFactor || 0);
          factor =
            item.unitMode === "CUSTOM" && curFactor > 0
              ? curFactor
              : Number(ing.conversionFactor) > 0
                ? Number(ing.conversionFactor)
                : 1;
          defaultPrice =
            Number(ing.costPerUnit || 0) > 0
              ? Math.round(Number(ing.costPerUnit) * factor)
              : item.unitPrice;
        } else if (chosen.mode === "PURCHASE") {
          defaultPrice = Math.round(
            Number(ing.purchasePrice) > 0
              ? Number(ing.purchasePrice)
              : Number(ing.costPerUnit || 0) * factor
          );
        } else if (chosen.mode === "BASE") {
          defaultPrice = Math.round(Number(ing.costPerUnit || 0));
        } else {
          defaultPrice =
            Number(ing.costPerUnit || 0) > 0
              ? Math.round(Number(ing.costPerUnit) * factor)
              : item.unitPrice;
        }

        const qty = Math.max(1, item.quantity);
        return {
          ...item,
          unitMode: chosen.mode,
          unit: nextUnit,
          conversionFactor: factor,
          unitPrice: defaultPrice,
          subtotal: qty * defaultPrice,
        };
      })
    );
  };

  const updateCartItem = (
    productId: string,
    updates: Partial<PurchaseOrderItem>
  ) => {
    setCart(
      cart.map((item) => {
        if (item.productId === productId) {
          const updated = { ...item, ...updates };
          updated.subtotal = Math.round(
            Math.max(0, updated.quantity) * Math.max(0, updated.unitPrice)
          );
          return updated;
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const poHppPreview = useMemo(() => {
    const validRows = cart
      .filter((it) => it.productId && it.subtotal > 0)
      .map((it) => ({
        ingredientId: it.productId,
        unitMode: it.unitMode || "BASE",
        conversionFactor: it.conversionFactor || 1,
        qty: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.subtotal,
      }));
    if (validRows.length === 0) {
      return {
        directUpdates: [],
        batchPrepUpdates: [],
        productsToUpdate: [],
        affectedVariantPreviews: [],
      };
    }
    return calculateCashFlowHppSync({
      itemRows: validRows,
      ingredients,
      batchPreparations,
      products,
      recipes,
      priceSyncMethod: "WEIGHTED_AVERAGE",
    });
  }, [cart, ingredients, batchPreparations, products, recipes]);

  const handleCheckout = (status: "PAID" | "UNPAID") => {
    if (isReadOnly) return;
    const effectiveCashAccountId = selectedCashAccountId || cashAccounts[0]?.id || "";
    const validation = validatePoCheckoutInput({
      mode: purchaseMode,
      paymentMethod: purchaseMode === "MARKET" ? "CASH" : paymentMethod,
      supplierId: selectedSupplier,
      cashAccountId: effectiveCashAccountId,
      items: cart,
    });
    if ("error" in validation) {
      toast.error(validation.error);
      return;
    }

    const currentPeriod = getLocalPeriodString();
    if (isPeriodClosed(currentPeriod)) {
      toast.error(
        `Periode ${currentPeriod} telah ditutup buku resmi. Pembuatan Purchase Order / Belanja Pasar baru untuk periode ini dikunci.`
      );
      return;
    }

    // Mode Belanja Pasar / Eceran (Langsung Lunas & Masuk Stok)
    if (purchaseMode === "MARKET") {
      const newPO = addDirectMarketPurchase({
        marketName: marketName.trim() || "Pasar Tradisional / Belanja Harian",
        items: cart,
        totalAmount: validation.totalAmount,
        cashAccountId: effectiveCashAccountId,
        notes: marketNotes.trim() || undefined,
      });
      if (!newPO) return;

      setCurrentInvoiceData(newPO);
      setIsInvoiceModalOpen(true);
      setCart([]);
      setMarketNotes("");
      toast.success(
        `Belanja pasar ${newPO.poNumber} berhasil disimpan & stok masuk.`
      );
      return;
    }

    // Mode PO Distributor Formal
    const isPaid = status === "PAID";
    const periodCompact = currentPeriod.replace("-", "");
    const poNumber = `PO-${periodCompact}-${Math.floor(1000 + Math.random() * 9000)}`;

    const calculatedDueDate = isPaid
      ? undefined
      : dueDate || addDaysToLocalDate(getLocalDateString(), 14);

    const supplierObj = suppliers.find((s) => s.id === selectedSupplier);
    const newPO: Omit<PurchaseOrder, "id"> = {
      poNumber,
      supplierId: selectedSupplier,
      supplierName: supplierObj?.name,
      purchaseType: "DISTRIBUTOR",
      date: new Date().toISOString(),
      items: cart,
      totalAmount: validation.totalAmount,
      status: isPaid ? "PAID" : "UNPAID",
      deliveryStatus: deliveryOption,
      paymentMethod: isPaid ? "CASH" : "TEMPO",
      dueDate: calculatedDueDate,
      amountPaid: isPaid ? validation.totalAmount : 0,
      cashAccountId: isPaid ? effectiveCashAccountId : undefined,
    };

    addPurchaseOrder(newPO);
    setCurrentInvoiceData({ ...newPO, id: poNumber });
    setIsInvoiceModalOpen(true);
    setCart([]);
    setSelectedSupplier("");
    setDueDate("");
    toast.success(`PO ${poNumber} berhasil dibuat.`);
  };

  const handleExportHistory = () => {
    if (filteredHistoryPOs.length === 0) {
      toast.warning("Tidak ada data Purchase Order yang cocok untuk diekspor.");
      return;
    }
    const dataToExport = filteredHistoryPOs.map((po) => {
      const supplier = suppliers.find((s) => s.id === po.supplierId);
      return {
        PONumber: po.poNumber,
        Date: new Date(po.date).toLocaleDateString("id-ID"),
        Supplier: supplier?.name || po.supplierName || "Unknown",
        TotalAmount: po.totalAmount,
        AmountPaid: po.amountPaid || 0,
        Status: po.status,
        DeliveryStatus: po.deliveryStatus,
        ItemsCount: po.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
    exportToCSV("Node_Supply_Purchase_Orders", dataToExport);
    toast.success(
      `${filteredHistoryPOs.length} riwayat PO berhasil diekspor ke CSV.`
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─── Header Banner ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 uppercase border border-brand-200/70 dark:border-brand-500/30">
              Supply Chain & Restock
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Procurement Center
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shadow-2xs shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span>{isIndo ? "Pembelian Bahan & Purchase Order" : "Procurement & Purchase Orders"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Kelola PO resmi distributor, belanja pasar darurat kasir, penerimaan stok gudang, dan rekonsiliasi hutang dagang.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 w-full xl:w-auto shrink-0 max-w-full overflow-hidden">
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setActiveTab("new_po")}
              className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer truncate ${
                activeTab === "new_po"
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {activeTab === "new_po" && (
                <motion.div
                  layoutId="purchasesMainTab"
                  className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 relative z-10 shrink-0" />
              <span className="relative z-10 truncate">
                {isIndo ? (
                  <>
                    <span className="hidden sm:inline">Restock / </span>Kulakan Baru
                  </>
                ) : (
                  "New Purchase"
                )}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("payables")}
            className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer truncate ${
              activeTab === "payables"
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {activeTab === "payables" && (
              <motion.div
                layoutId="purchasesMainTab"
                className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <CreditCard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 relative z-10 shrink-0" />
            <span className="relative z-10 truncate flex items-center gap-1.5">
              <span>{isIndo ? "Hutang Supplier" : "Accounts Payable"}</span>
              {unpaidPOs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white leading-none">
                  {unpaidPOs.length}
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer truncate ${
              activeTab === "history"
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {activeTab === "history" && (
              <motion.div
                layoutId="purchasesMainTab"
                className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <Receipt className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 relative z-10 shrink-0" />
            <span className="relative z-10 truncate">
              {isIndo ? (
                <>
                  Riwayat PO<span className="hidden sm:inline"> & Belanja</span>
                </>
              ) : (
                "PO History"
              )}{" "}
              <span className="text-[11px] font-bold opacity-75">({purchaseOrders.length})</span>
            </span>
          </button>
        </div>
      </div>

      {/* ─── 4 BENTO KPI SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Hutang Supplier */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          onClick={() => {
            setActiveTab("payables");
            setPayableFilter("ALL");
          }}
          className="text-left bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-500/40 transition-colors relative overflow-hidden cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Hutang Dagang (AP)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums tracking-tight">
            {formatCurrency(totalUnpaidDebt)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="font-bold text-amber-700 dark:text-amber-300">{unpaidPOs.length} tagihan</span>
            <span>belum lunas</span>
          </p>
        </motion.button>

        {/* Card 2: Tagihan Lewat Tempo */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          onClick={() => {
            setActiveTab("payables");
            setPayableFilter("OVERDUE");
          }}
          className="text-left bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-rose-300 dark:hover:border-rose-500/40 transition-colors relative overflow-hidden cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lewat Jatuh Tempo
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              overduePOs.length > 0
                ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-500/30"
                : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200/80 dark:border-slate-700"
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-lg sm:text-2xl font-black font-mono tabular-nums tracking-tight ${
            overduePOs.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
          }`}>
            {formatCurrency(overdueDebt)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {overduePOs.length > 0 ? (
              <span className="font-bold text-rose-600 dark:text-rose-400">{overduePOs.length} faktur mendesak dibayar</span>
            ) : (
              "Semua tagihan tempo aman"
            )}
          </p>
        </motion.button>

        {/* Card 3: Penerimaan Stok Menunggu */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          onClick={() => {
            setActiveTab("history");
            setHistoryFilter("PENDING_DELIVERY");
          }}
          className="text-left bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-sky-300 dark:hover:border-sky-500/40 transition-colors relative overflow-hidden cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tunggu Terima Stok
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/30 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums tracking-tight">
            {pendingDeliveryCount} <span className="text-xs font-medium text-slate-400">PO</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {pendingDeliveryCount > 0 ? "Menunggu verifikasi barang di outlet" : "Semua PO telah diterima"}
          </p>
        </motion.button>

        {/* Card 4: Total Belanja Bulan Ini */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          onClick={() => {
            setActiveTab("history");
            setHistoryFilter("ALL");
          }}
          className="text-left bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors relative overflow-hidden cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Belanja Bulan Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums tracking-tight">
            {formatCurrency(currentMonthPurchasesTotal)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {currentMonthPOs.length} transaksi restock bahan
          </p>
        </motion.button>
      </div>

      {/* ─── TAB 1: NEW PURCHASE (RESTOCK) ────────────────────────────────────────── */}
      {!isReadOnly && activeTab === "new_po" ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Products Catalog for Restock (Left Column) */}
          <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
            {/* Search & Category Filter Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder={
                    isIndo
                      ? "Cari nama bahan baku, kemasan, atau kategori..."
                      : "Search ingredients for restock..."
                  }
                  className="w-full pl-10 pr-9 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-base sm:text-xs font-medium focus:ring-2 focus:ring-brand-500/20 bg-white dark:bg-slate-900 dark:text-slate-100 outline-none"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch("")}
                    aria-label="Hapus pencarian bahan"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 -mx-1 px-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer active:scale-95 ${
                      selectedCategory === cat
                        ? "bg-brand-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {cat === "ALL" ? (isIndo ? "Semua" : "All") : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid with Live Stock Badges */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[700px] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 flex-1">
              {filteredProducts.map((product) => {
                const currentStock = product.currentStock;
                const inCartItem = cart.find((item) => item.productId === product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product.id)}
                    className={`bg-white border rounded-2xl p-4 cursor-pointer hover:border-brand-500 hover:shadow-md transition-all flex flex-col justify-between group active:scale-[0.98] ${
                      inCartItem
                        ? "border-brand-500 ring-2 ring-brand-500/10 bg-brand-50/20"
                        : "border-slate-200/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                          {product.category || "Ingredient"}
                        </span>

                        {/* Stock Badge */}
                        {currentStock <= 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            Stok Habis (0)
                          </span>
                        ) : currentStock <= product.minStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                            Menipis ({currentStock} {product.unit})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                            Stok: {currentStock} {product.unit}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm leading-snug mb-1 group-hover:text-brand-600 transition-colors line-clamp-2">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {product.purchaseUnit && Number(product.conversionFactor) > 0 ? (
                          <>
                            Beli:{" "}
                            <strong className="text-slate-700">
                              {formatCurrency(
                                Number(product.purchasePrice) > 0
                                  ? Number(product.purchasePrice)
                                  : Math.round(
                                      Number(product.costPerUnit || 0) *
                                        Number(product.conversionFactor)
                                    )
                              )}
                            </strong>{" "}
                            / {product.purchaseUnit}
                            <span className="block text-[10px] text-slate-400">
                              Modal resep: {formatCurrency(Number(product.costPerUnit || 0))} / {product.unit}
                            </span>
                          </>
                        ) : (
                          <>
                            Biaya Master: {formatCurrency(Number(product.costPerUnit || 0))} / {product.unit}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">
                        Klik untuk tambah
                      </span>

                      {inCartItem ? (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-brand-600 text-white shadow-2xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {inCartItem.quantity}x
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-brand-50 group-hover:text-brand-600 text-slate-400 flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                  Tidak ada bahan baku yang cocok dengan pencarian.
                </div>
              )}
            </div>
          </div>

          {/* Cart / Purchase Order Summary Sidebar (Desktop/Tablet) */}
          <div className="w-full lg:w-96 shrink-0 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-24">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-600" />
                {isIndo ? "Daftar Restock (PO)" : "Purchase List"}
              </h3>
              <span className="text-xs font-black bg-brand-50 text-brand-700 border border-brand-200/70 px-2.5 py-0.5 rounded-full">
                {cart.length} item
              </span>
            </div>

            {/* Mode Switcher: Distributor vs Belanja Pasar */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/40">
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setPurchaseMode("DISTRIBUTOR")}
                  className={`relative py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    purchaseMode === "DISTRIBUTOR" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {purchaseMode === "DISTRIBUTOR" && (
                    <motion.div
                      layoutId="purchaseModeTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <Building2 className="w-3.5 h-3.5 text-brand-600 relative z-10" />
                  <span className="relative z-10">PO Distributor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseMode("MARKET")}
                  className={`relative py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    purchaseMode === "MARKET" ? "text-emerald-950" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {purchaseMode === "MARKET" && (
                    <motion.div
                      layoutId="purchaseModeTab"
                      className="absolute inset-0 bg-emerald-50 rounded-xl shadow-xs border border-emerald-200"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <Store className="w-3.5 h-3.5 text-emerald-600 relative z-10" />
                  <span className="relative z-10">Belanja Pasar</span>
                </button>
              </div>
            </div>

            {/* Mode Details Form */}
            {purchaseMode === "MARKET" ? (
              <div className="p-4 border-b border-slate-100 bg-emerald-50/30 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-emerald-600" />
                    Nama Toko / Pasar / Warung
                  </label>
                  <input
                    type="text"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    placeholder="Misal: Pasar Pagi, Toko Plastik, Indomaret..."
                    className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-base sm:text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium"
                  />
                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      "Pasar Tradisional",
                      "Warung Terdekat",
                      "Minimarket",
                      "Toko Plastik",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setMarketName(chip)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                          marketName === chip
                            ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    Sumber Kas Pembayaran Tunai
                  </label>
                  <CustomSelect
                    value={selectedCashAccountId}
                    onChange={setSelectedCashAccountId}
                    options={cashAccounts.map((acc) => ({
                      value: acc.id,
                      label: `${acc.name} (${formatCurrency(accountBalances[acc.id] || 0)})`,
                    }))}
                    buttonClassName="w-full border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Catatan Belanja (Opsional)
                  </label>
                  <input
                    type="text"
                    value={marketNotes}
                    onChange={(e) => setMarketNotes(e.target.value)}
                    placeholder="Misal: Beli lemon segar & susu darurat..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-base sm:text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-emerald-100/70 border border-emerald-200 text-[11px] text-emerald-950 leading-tight">
                  <div className="font-bold flex items-center gap-1 mb-0.5 text-emerald-900">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Otomatis Masuk Stok & Kas Terpotong:
                  </div>
                  Bahan yang dibeli langsung masuk stok aktif dan saldo kas kasir otomatis terpotong saat disimpan.
                </div>
              </div>
            ) : (
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isIndo ? "Pilih Supplier Rekanan" : "Select Supplier"}{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={selectedSupplier}
                    onChange={setSelectedSupplier}
                    placeholder={isIndo ? "-- Pilih Supplier --" : "-- Choose Supplier --"}
                    options={[
                      {
                        value: "",
                        label: isIndo ? "-- Pilih Supplier --" : "-- Choose Supplier --",
                      },
                      ...suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.picName})`,
                      })),
                    ]}
                    buttonClassName="w-full border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs bg-white font-medium"
                  />
                </div>

                {/* Payment Method: Tunai vs Tempo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("CASH")}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === "CASH"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px]">Tunai Langsung</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("TEMPO");
                        if (!dueDate) {
                          setDueDate(
                            addDaysToLocalDate(getLocalDateString(), 14)
                          );
                        }
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === "TEMPO"
                          ? "bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/20"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[11px]">Hutang / Tempo</span>
                    </button>
                  </div>

                  {paymentMethod === "CASH" ? (
                    <div className="space-y-1.5 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs">
                      <label className="block text-[11px] font-bold text-emerald-900">
                        Pilih Pos Kas / Rekening Pengeluaran:
                      </label>
                      <CustomSelect
                        value={selectedCashAccountId}
                        onChange={setSelectedCashAccountId}
                        options={cashAccounts.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${formatCurrency(accountBalances[acc.id] || 0)})`,
                        }))}
                        buttonClassName="w-full border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                      />
                      <p className="text-[10px] text-emerald-700 leading-tight">
                        Kas keluar otomatis tercatat saat PO disimpan.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-bold text-amber-900">
                          Jatuh Tempo Pembayaran:
                        </label>
                        <div className="flex gap-1">
                          {[
                            { label: "+7H", days: 7 },
                            { label: "+14H", days: 14 },
                            { label: "+30H", days: 30 },
                          ].map((p) => (
                            <button
                              key={p.days}
                              type="button"
                              onClick={() => {
                                setDueDate(
                                  addDaysToLocalDate(getLocalDateString(), p.days)
                                );
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <CustomDatePicker
                        value={dueDate}
                        onChange={setDueDate}
                        allowClear={false}
                        buttonClassName="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                      />
                      <p className="text-[10px] text-amber-800 leading-tight">
                        Kas TIDAK dipotong sekarang. Tagihan masuk ke daftar Hutang Supplier (AP).
                      </p>
                    </div>
                  )}
                </div>

                {/* Delivery Option */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isIndo ? "Status Penerimaan Barang" : "Delivery Reception"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryOption("RECEIVED")}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        deliveryOption === "RECEIVED"
                          ? "bg-brand-50 border-brand-300 text-brand-900 ring-2 ring-brand-500/20"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <PackageCheck className="w-3.5 h-3.5 text-brand-600" />
                      <span className="text-[11px]">Langsung Diterima</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryOption("PENDING")}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        deliveryOption === "PENDING"
                          ? "bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-400/20"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span className="text-[11px]">Tunggu Kirim</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cart Item Rows */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[380px] bg-slate-50/20">
              {cart.length === 0 ? (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                  <ShoppingBag className="w-10 h-10 mb-2 opacity-30 text-slate-400" />
                  <p className="text-xs font-bold text-slate-600">
                    {isIndo ? "Daftar restock masih kosong" : "Cart is empty"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isIndo
                      ? "Pilih produk dari katalog di sebelah kiri."
                      : "Select products from catalog."}
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const product = ingredients.find((p) => p.id === item.productId);
                  const currentStock = product?.currentStock || 0;
                  const pkgChoices = product ? getIngredientPackagingChoices(product) : [];
                  const selectValue = getPackagingSelectValue(item, pkgChoices);
                  const factor =
                    Number(item.conversionFactor) > 0 ? Number(item.conversionFactor) : 1;
                  const baseQty = item.quantity * factor;
                  const costPerBase = baseQty > 0 ? item.subtotal / baseQty : 0;

                  return (
                    <div
                      key={item.productId}
                      className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">
                            {product?.name}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Stok saat ini: {currentStock.toLocaleString("id-ID")} {product?.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {product && (
                        <div className="space-y-1.5">
                          <CustomSelect
                            value={selectValue}
                            onChange={(val) => handleCartPackagingChange(item.productId, val)}
                            options={pkgChoices.map((choice) => ({
                              value: choice.key,
                              label: `Satuan Beli: ${choice.label}`,
                            }))}
                            buttonClassName="w-full border border-indigo-200 bg-indigo-50/50 text-indigo-950 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold"
                          />

                          {item.unitMode === "CUSTOM" && (
                            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                              <input
                                type="text"
                                value={item.unit || ""}
                                onChange={(e) =>
                                  updateCartItem(item.productId, { unit: e.target.value })
                                }
                                placeholder="Nama kemasan (Karton/Dus)"
                                className="border border-slate-200 rounded-xl px-2 py-1 text-[11px] bg-slate-50 focus:bg-white outline-none font-medium"
                              />
                              <div className="flex items-center gap-1 border border-slate-200 rounded-xl px-2 py-1 bg-slate-50 focus-within:bg-white">
                                <span className="text-[10px] text-slate-400 shrink-0">Isi:</span>
                                <CurrencyInput
                                  allowDecimals
                                  emptyWhenZero
                                  value={item.conversionFactor || 0}
                                  onValueChange={(_, num) =>
                                    updateCartItem(item.productId, {
                                      conversionFactor: Math.max(0, num),
                                    })
                                  }
                                  onBlur={() => {
                                    if (!item.conversionFactor || item.conversionFactor <= 0) {
                                      updateCartItem(item.productId, { conversionFactor: 1 });
                                    }
                                  }}
                                  className="w-full text-right font-mono text-[11px] font-bold bg-transparent outline-none"
                                />
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {product.unit}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <CurrencyInput
                            allowDecimals
                            emptyWhenZero
                            value={item.quantity}
                            onValueChange={(_, num) =>
                              updateCartItem(item.productId, {
                                quantity: Math.max(0, num),
                              })
                            }
                            onBlur={() => {
                              if (!item.quantity || item.quantity <= 0) {
                                updateCartItem(item.productId, { quantity: 1 });
                              }
                            }}
                            className="w-20 border border-slate-200 rounded-xl px-2 py-1 text-center font-bold font-mono text-base sm:text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                          <span className="text-slate-500 text-[11px] font-semibold max-w-[64px] truncate">
                            {item.unit || product?.unit}
                          </span>
                          <span className="text-slate-400 text-xs">× Rp</span>
                          <CurrencyInput
                            value={item.unitPrice}
                            onValueChange={(_, num) =>
                              updateCartItem(item.productId, {
                                unitPrice: Math.max(0, Math.round(num)),
                              })
                            }
                            className="w-28 border border-slate-200 rounded-xl px-2 py-1 text-right font-mono text-base sm:text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                        <span className="font-bold font-mono text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>

                      {product && (
                        <div className="text-[10px] text-emerald-700 bg-emerald-50/70 border border-emerald-200/70 rounded-lg px-2 py-1 flex items-center justify-between font-mono">
                          <span>
                            Masuk stok: +{baseQty.toLocaleString("id-ID")} {product.unit}
                          </span>
                          <span>
                            Modal baru: Rp{" "}
                            {costPerBase.toLocaleString("id-ID", { maximumFractionDigits: 2 })}/
                            {product.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Checkout Controls */}
            <div className="p-4 bg-white border-t border-slate-100 space-y-3">
              {cart.length > 0 &&
                (purchaseMode === "MARKET" || deliveryOption === "RECEIVED") &&
                (poHppPreview.directUpdates.length > 0 ||
                  poHppPreview.affectedVariantPreviews.length > 0) && (
                  <div className="p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1 text-[11px]">
                    <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Sinkron HPP Otomatis (Weighted Avg):</span>
                    </div>
                    <p className="text-[10px] text-indigo-800 leading-snug">
                      {poHppPreview.directUpdates.length} bahan modal diperbarui
                      {poHppPreview.batchPrepUpdates.length > 0
                        ? ` • ${poHppPreview.batchPrepUpdates.length} batch olahan`
                        : ""}
                      {poHppPreview.affectedVariantPreviews.length > 0
                        ? ` • ${poHppPreview.affectedVariantPreviews.length} varian menu ikut disesuaikan`
                        : ""}
                      .
                    </p>
                  </div>
                )}

              {cart.length > 0 &&
                purchaseMode === "DISTRIBUTOR" &&
                deliveryOption === "PENDING" && (
                  <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 leading-snug">
                    Stok masuk & pembaruan HPP menu akan otomatis dijalankan saat barang diklik{" "}
                    <strong>Terima Barang</strong> di tab Riwayat.
                  </p>
                )}

              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">
                  {isIndo ? "Total Pembelian:" : "Total Amount:"}
                </span>
                <span className="font-black font-mono text-lg text-brand-950">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              {purchaseMode === "MARKET" ? (
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => handleCheckout("PAID")}
                  className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Store className="w-4 h-4" />
                  <span>Simpan Belanja & Potong Kas Tunai</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!selectedSupplier || cart.length === 0}
                  onClick={() =>
                    handleCheckout(paymentMethod === "CASH" ? "PAID" : "UNPAID")
                  }
                  className={`w-full py-3 px-3 font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === "CASH"
                      ? "bg-brand-600 hover:bg-brand-700 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }`}
                >
                  {paymentMethod === "CASH" ? (
                    <>
                      <Coins className="w-4 h-4" />
                      <span>Buat PO & Bayar Kas ({formatCurrency(totalAmount)})</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Simpan PO Hutang / Tempo (Catat ke AP)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "payables" ? (
        /* ─── TAB 2: HUTANG SUPPLIER (ACCOUNTS PAYABLE) ────────────────────────── */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col space-y-4 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  Accounts Payable
                </span>
                <span className="text-xs text-slate-400 font-bold">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {unpaidPOs.length} Tagihan Aktif
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {isIndo ? "Hutang Supplier & Tempo Pengadaan" : "Supplier Payables & Credit Terms"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring jatuh tempo faktur tempo, realisasi cicilan bertahap, dan pelunasan kas pengadaan bahan baku.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (filteredPayables.length === 0) {
                    toast.warning("Tidak ada data hutang supplier yang cocok untuk diekspor.");
                    return;
                  }
                  const dataToExport = filteredPayables.map((po) => {
                    const supplier = suppliers.find((s) => s.id === po.supplierId);
                    const remaining = Math.max(0, Math.round(po.totalAmount - (po.amountPaid || 0)));
                    const dueStatus = getDueStatus(po.dueDate);
                    return {
                      PONumber: po.poNumber,
                      Date: new Date(po.date).toLocaleDateString("id-ID"),
                      DueDate: po.dueDate || "-",
                      DueStatus: dueStatus.label,
                      Supplier: supplier?.name || po.supplierName || "Unknown",
                      TotalAmount: po.totalAmount,
                      AmountPaid: po.amountPaid || 0,
                      RemainingDebt: remaining,
                      Status: po.status,
                    };
                  });
                  exportToCSV("Hutang_Supplier_AP", dataToExport);
                  toast.success(`${filteredPayables.length} tagihan hutang berhasil diekspor.`);
                }}
                className="whitespace-nowrap shrink-0 flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all shadow-xs text-xs font-bold cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
                <span>Ekspor Hutang (CSV)</span>
              </button>
            </div>
          </div>

          {/* Filter Bar: Status Pill & Search */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/80">
            {/* Filter Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {[
                { id: "ALL", label: `Semua (${unpaidPOs.length})` },
                { id: "OVERDUE", label: `Lewat Tempo (${overduePOs.length})`, alert: overduePOs.length > 0 },
                { id: "DUE_SOON", label: `≤ 7 Hari (${dueSoonPOs.length})` },
                { id: "PARTIAL", label: `Dicicil (${unpaidPOs.filter(p => p.status === "PARTIAL").length})` },
                { id: "UNPAID", label: `Belum Dicicil (${unpaidPOs.filter(p => p.status === "UNPAID").length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setPayableFilter(pill.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    payableFilter === pill.id
                      ? "bg-brand-600 text-white shadow-xs"
                      : pill.alert
                      ? "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Supplier Select & Search */}
            <div className="flex items-center gap-2">
              <CustomSelect
                value={payableSupplierFilter}
                onChange={setPayableSupplierFilter}
                options={[
                  { value: "", label: "Semua Supplier" },
                  ...suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
                buttonClassName="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium"
              />

              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={payableSearch}
                  onChange={(e) => setPayableSearch(e.target.value)}
                  placeholder="Cari PO / Supplier..."
                  className="w-full pl-9 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                {payableSearch && (
                  <button
                    type="button"
                    onClick={() => setPayableSearch("")}
                    aria-label="Hapus pencarian hutang"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TABLE VIEW (Desktop / Tablet) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-xs text-left">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 rounded-l-xl">No PO</th>
                  <th className="px-4 py-3">Tanggal PO</th>
                  <th className="px-4 py-3">Supplier Rekanan</th>
                  <th className="px-4 py-3">Jatuh Tempo</th>
                  <th className="px-4 py-3">Penerimaan Stok</th>
                  <th className="px-4 py-3 text-right">Total Tagihan</th>
                  <th className="px-4 py-3 text-right">Terbayar</th>
                  <th className="px-4 py-3 text-right">Sisa Hutang</th>
                  <th className="px-4 py-3 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPayables.map((po) => {
                  const supplier = suppliers.find((s) => s.id === po.supplierId);
                  const remaining = Math.max(0, Math.round(po.totalAmount - (po.amountPaid || 0)));
                  const dueStatus = getDueStatus(po.dueDate);
                  const pctPaid = Math.min(100, Math.round(((po.amountPaid || 0) / (po.totalAmount || 1)) * 100));

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
                            <Building2 className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-brand-700 dark:text-brand-300 font-mono font-bold">
                            {po.poNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {new Date(po.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">
                            {supplier?.name || po.supplierName || "Unknown"}
                          </p>
                          {supplier?.picName && (
                            <p className="text-[10px] text-slate-400">
                              PIC: {supplier.picName} {supplier.contact ? `(${supplier.contact})` : ""}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            dueStatus.variant === "overdue"
                              ? "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30"
                              : dueStatus.variant === "due_today" || dueStatus.variant === "due_soon"
                              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {dueStatus.variant === "overdue" && <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                          {dueStatus.variant === "due_today" && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                          {dueStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            po.deliveryStatus === "RECEIVED"
                              ? "bg-brand-50 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {po.deliveryStatus === "RECEIVED" ? "Masuk Stok" : "Menunggu"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        <div>
                          <span>{formatCurrency(po.amountPaid || 0)}</span>
                          {pctPaid > 0 && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {pctPaid}% terbayar
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canProcessPayment && (
                            <button
                              type="button"
                              onClick={() => openPayModal(po)}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Bayar / Cicil</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentInvoiceData(po);
                              setIsInvoiceModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/15 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer"
                            title="Lihat Faktur PO"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredPayables.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      Tidak ada hutang supplier yang cocok dengan filter saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* CARD FEED VIEW (Mobile Phone) */}
          <div className="block md:hidden space-y-3">
            {filteredPayables.map((po) => {
              const supplier = suppliers.find((s) => s.id === po.supplierId);
              const remaining = Math.max(0, Math.round(po.totalAmount - (po.amountPaid || 0)));
              const dueStatus = getDueStatus(po.dueDate);
              const pctPaid = Math.min(100, Math.round(((po.amountPaid || 0) / (po.totalAmount || 1)) * 100));

              return (
                <div
                  key={po.id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-brand-600" />
                        <span className="font-bold font-mono text-xs text-slate-900">
                          {po.poNumber}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">
                        {supplier?.name || po.supplierName || "Supplier"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Tgl PO: {new Date(po.date).toLocaleDateString("id-ID")}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Sisa Hutang:</span>
                      <span className="font-black font-mono text-sm text-rose-600 block">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Total: {formatCurrency(po.totalAmount)}</span>
                      <span>Terbayar: {formatCurrency(po.amountPaid || 0)} ({pctPaid}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pctPaid}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        dueStatus.variant === "overdue"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : dueStatus.variant === "due_today" || dueStatus.variant === "due_soon"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {dueStatus.variant === "overdue" && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                      {dueStatus.label}
                    </span>

                    <div className="flex items-center gap-2">
                      {canProcessPayment && (
                        <button
                          type="button"
                          onClick={() => openPayModal(po)}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Bayar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentInvoiceData(po);
                          setIsInvoiceModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPayables.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Tidak ada hutang supplier yang cocok dengan filter saat ini.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── TAB 3: PURCHASE ORDERS HISTORY ───────────────────────────────────────── */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col space-y-4 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {isIndo ? "Riwayat Purchase Order (PO)" : "Purchase Order History"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar semua faktur pembelian dari distributor rekanan dan belanja eceran kafe.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportHistory}
              className="whitespace-nowrap shrink-0 flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all shadow-xs text-xs font-bold cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
              <span>{isIndo ? "Ekspor CSV" : "Export CSV"}</span>
            </button>
          </div>

          {/* Filter Bar: Status Pills & History Search */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/80">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {[
                { id: "ALL", label: `Semua (${purchaseOrders.length})` },
                { id: "PENDING_DELIVERY", label: `Tunggu Terima (${pendingDeliveryCount})` },
                { id: "UNPAID", label: `Hutang (${unpaidPOs.length})` },
                { id: "PAID", label: `Lunas (${purchaseOrders.filter((p) => p.status === "PAID").length})` },
                { id: "MARKET", label: `Belanja Pasar (${purchaseOrders.filter((p) => p.purchaseType === "MARKET").length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setHistoryFilter(pill.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    historyFilter === pill.id
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 md:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari No PO, supplier, atau catatan..."
                className="w-full pl-9 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  aria-label="Hapus pencarian riwayat"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TABLE VIEW (Desktop / Tablet) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-xs text-left">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 rounded-l-xl">No PO</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Supplier / Toko</th>
                  <th className="px-4 py-3">Status Bayar</th>
                  <th className="px-4 py-3">Penerimaan Stok</th>
                  <th className="px-4 py-3 text-right">Total Tagihan</th>
                  <th className="px-4 py-3 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistoryPOs.map((po) => {
                  const supplier = suppliers.find((s) => s.id === po.supplierId);
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold">
                        <div className="flex items-center gap-2">
                          {po.purchaseType === "MARKET" ? (
                            <span
                              className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              title="Belanja Pasar Langsung"
                            >
                              <Store className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className="p-1 rounded-md bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300"
                              title="PO Distributor"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span
                            className={
                              po.purchaseType === "MARKET"
                                ? "text-emerald-700 dark:text-emerald-300 font-mono"
                                : "text-brand-700 dark:text-brand-300 font-mono"
                            }
                          >
                            {po.poNumber}
                          </span>
                          {isPeriodClosed(po.date) && (
                            <span
                              title={`Periode ${getLocalPeriodFromTimestamp(po.date)} telah ditutup buku`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-1.5 py-0.5 rounded"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span>Terkunci</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {new Date(po.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {po.purchaseType === "MARKET" ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 text-[11px]">
                            <Store className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            {po.supplierName || "Pasar Tradisional"}
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {supplier?.name || po.supplierName || "Unknown Supplier"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.status === "PAID"
                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                                : po.status === "PARTIAL"
                                ? "bg-sky-50 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30"
                                : "bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                            }`}
                          >
                            {po.status === "PAID" ? "Lunas" : po.status === "PARTIAL" ? "Dicicil" : "Belum Lunas"}
                          </span>
                          {(po.status === "UNPAID" || po.status === "PARTIAL") && canProcessPayment && (
                            <button
                              type="button"
                              onClick={() => openPayModal(po)}
                              className="text-brand-600 dark:text-brand-400 hover:text-brand-800 font-bold underline cursor-pointer"
                            >
                              {po.status === "PARTIAL" ? "Bayar/Cicil" : "Lunasi"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.deliveryStatus === "RECEIVED"
                                ? "bg-brand-50 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {po.deliveryStatus === "RECEIVED" ? "Diterima (Stok Masuk)" : "Menunggu"}
                          </span>
                          {!isReadOnly && po.deliveryStatus !== "RECEIVED" && (
                            isPeriodClosed(po.date) ? (
                              <span className="text-[11px] text-slate-400 italic">Periode Ditutup</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPoToReceive(po)}
                                className="text-brand-600 dark:text-brand-400 hover:text-brand-800 font-bold underline cursor-pointer"
                              >
                                Terima Barang
                              </button>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentInvoiceData(po);
                              setIsInvoiceModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/15 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer"
                            title="Cetak Faktur PO"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {!isReadOnly && (
                            isPeriodClosed(po.date) ? (
                              <span
                                className="p-1.5 text-slate-300 cursor-not-allowed"
                                title={`Periode ${getLocalPeriodFromTimestamp(po.date)} telah ditutup buku dan terkunci dari perubahan.`}
                              >
                                <Lock className="w-4 h-4 text-slate-400" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setInvoiceToDelete(po)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-500 transition-colors cursor-pointer"
                                title="Hapus PO"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredHistoryPOs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      {purchaseOrders.length === 0
                        ? "Belum ada data Purchase Order terdaftar."
                        : "Tidak ada Purchase Order yang cocok dengan filter saat ini."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* CARD FEED VIEW (Mobile Phone 360-480px) */}
          <div className="block md:hidden space-y-3">
            {filteredHistoryPOs.map((po) => {
              const supplier = suppliers.find((s) => s.id === po.supplierId);
              return (
                <div
                  key={po.id}
                  className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {po.purchaseType === "MARKET" ? (
                          <Store className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-brand-600" />
                        )}
                        <span className="font-bold font-mono text-xs text-slate-900 dark:text-slate-100">
                          {po.poNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(po.date).toLocaleDateString("id-ID")} ·{" "}
                        {po.purchaseType === "MARKET"
                          ? po.supplierName || "Pasar Tradisional"
                          : supplier?.name || po.supplierName || "Distributor"}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black font-mono tabular-nums text-sm text-brand-950 dark:text-brand-300 block">
                        {formatCurrency(po.totalAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {po.items.length} items
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/80">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        po.status === "PAID"
                          ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                          : po.status === "PARTIAL"
                          ? "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300"
                          : "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {po.status === "PAID" ? "Lunas" : po.status === "PARTIAL" ? "Dicicil" : "Hutang"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        po.deliveryStatus === "RECEIVED"
                          ? "bg-brand-50 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {po.deliveryStatus === "RECEIVED" ? "Masuk Stok" : "Tunggu Kirim"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      {(po.status === "UNPAID" || po.status === "PARTIAL") && canProcessPayment && (
                        <button
                          type="button"
                          onClick={() => openPayModal(po)}
                          className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          {po.status === "PARTIAL" ? "Bayar Cicilan" : "Lunasi"}
                        </button>
                      )}
                      {!isReadOnly && po.deliveryStatus !== "RECEIVED" && (
                        isPeriodClosed(po.date) ? (
                          <span className="text-[10px] text-slate-400 italic">Periode Ditutup</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPoToReceive(po)}
                            className="px-2.5 py-1 bg-brand-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Terima Stok
                          </button>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentInvoiceData(po);
                          setIsInvoiceModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Faktur</span>
                      </button>
                      {!isReadOnly && (
                        isPeriodClosed(po.date) ? (
                          <span
                            className="p-1.5 text-slate-300 cursor-not-allowed"
                            title={`Periode ${getLocalPeriodFromTimestamp(po.date)} telah ditutup buku.`}
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setInvoiceToDelete(po)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredHistoryPOs.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                {purchaseOrders.length === 0
                  ? "Belum ada data Purchase Order terdaftar."
                  : "Tidak ada Purchase Order yang cocok dengan filter saat ini."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PORTAL MODALS ─────────────────────────────────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {/* ─── MODAL: Receive PO (Goods Arrival) ──────────────────────────────── */}
            <AnimatePresence>
              {poToReceive && (
                <motion.div
                  key="po-receive-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => setPoToReceive(null)}
                  className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    onClick={(e) => e.stopPropagation()}
                    className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6 space-y-4"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 text-brand-600 dark:text-brand-300 flex items-center justify-center">
                      <PackageCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Konfirmasi Penerimaan Barang?
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                        Barang untuk PO <strong className="text-slate-800 dark:text-slate-200">{poToReceive.poNumber}</strong> sudah sampai di outlet/gudang? Sistem akan secara otomatis menambahkan stok masuk ke inventori.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPoToReceive(null)}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isReadOnly || !poToReceive) {
                            setPoToReceive(null);
                            return;
                          }
                          if (isPeriodClosed(poToReceive.date) || isPeriodClosed(getLocalPeriodString())) {
                            toast.error(
                              `PO ${poToReceive.poNumber} atau bulan aktif berada pada periode yang telah ditutup buku.`
                            );
                            setPoToReceive(null);
                            return;
                          }
                          markPOAsReceived(poToReceive.id);
                          toast.success(
                            `Barang PO ${poToReceive.poNumber} diterima & stok masuk inventori.`
                          );
                          setPoToReceive(null);
                        }}
                        className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Ya, Terima & Masuk Stok
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── MODAL: View PO Invoice ─────────────────────────────────────────── */}
            <AnimatePresence>
              {isInvoiceModalOpen && currentInvoiceData && (
                <motion.div
                  key="po-invoice-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => {
                    setIsInvoiceModalOpen(false);
                    setCurrentInvoiceData(null);
                  }}
                  className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    onClick={(e) => e.stopPropagation()}
                    className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar p-6 sm:p-8"
                  >
                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-5">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                          {currentInvoiceData.purchaseType === "MARKET" ? (
                            <>
                              <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              <span>BUKTI BELANJA PASAR / ECERAN</span>
                            </>
                          ) : (
                            <span>PURCHASE ORDER</span>
                          )}
                        </h2>
                        <p className="text-slate-400 text-xs font-mono font-bold">
                          {currentInvoiceData.poNumber}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              currentInvoiceData.status === "PAID"
                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                                : currentInvoiceData.status === "PARTIAL"
                                ? "bg-sky-50 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30"
                                : "bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                            }`}
                          >
                            {currentInvoiceData.status === "PAID"
                              ? "LUNAS (CASH)"
                              : currentInvoiceData.status === "PARTIAL"
                                ? "DICICIL (PARTIAL)"
                                : "HUTANG (TEMPO)"}
                          </span>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              currentInvoiceData.deliveryStatus === "RECEIVED"
                                ? "bg-brand-50 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {currentInvoiceData.deliveryStatus === "RECEIVED"
                              ? "MASUK STOK (RECEIVED)"
                              : "MENUNGGU PENGIRIMAN"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                          {settings.brandName || "Julia's Coffee & Eatery"}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs ml-auto mt-0.5">
                          {settings.companyAddress || "Specialty Room"}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {currentInvoiceData.purchaseType === "MARKET"
                          ? "Tempat Belanja / Toko"
                          : "Order To (Supplier)"}
                      </p>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {currentInvoiceData.purchaseType === "MARKET"
                          ? currentInvoiceData.supplierName || "Pasar Tradisional / Belanja Harian"
                          : suppliers.find((s) => s.id === currentInvoiceData.supplierId)?.name ||
                            currentInvoiceData.supplierName ||
                            "Unknown Supplier"}
                      </h4>
                      {currentInvoiceData.notes && (
                        <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 italic">
                          Catatan: {currentInvoiceData.notes}
                        </p>
                      )}
                    </div>

                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/70">
                            <th className="py-2.5 px-3 text-left rounded-l-lg">Deskripsi Bahan</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                            <th className="py-2.5 px-3 text-right rounded-r-lg">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {currentInvoiceData.items.map((item: PurchaseOrderItem, idx: number) => {
                            const product = ingredients.find((p) => p.id === item.productId);
                            return (
                              <tr key={idx}>
                                <td className="py-3 px-3 text-slate-900 dark:text-slate-100 font-medium">
                                  {product?.name || "Unknown Product"}
                                </td>
                                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 text-center font-mono tabular-nums">
                                  <span>
                                    {item.quantity} {item.unit || product?.unit}
                                  </span>
                                  {Number(item.conversionFactor || 1) > 1 && (
                                    <span className="block text-[10px] text-slate-400">
                                      (= {(item.quantity * Number(item.conversionFactor)).toLocaleString("id-ID")}{" "}
                                      {product?.unit})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 text-right font-mono tabular-nums">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="py-3 px-3 text-slate-900 dark:text-slate-100 font-bold font-mono tabular-nums text-right">
                                  {formatCurrency(item.subtotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mb-6">
                      <div className="w-72 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-base font-black text-slate-900 dark:text-slate-100 pt-1">
                          <span>Total Tagihan:</span>
                          <span className="text-brand-950 dark:text-brand-300 font-mono tabular-nums">
                            {formatCurrency(currentInvoiceData.totalAmount)}
                          </span>
                        </div>
                        {(currentInvoiceData.status !== "PAID" ||
                          ((currentInvoiceData.amountPaid || 0) > 0 &&
                            (currentInvoiceData.amountPaid || 0) < currentInvoiceData.totalAmount)) && (
                          <>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                              <span>Sudah Dibayar:</span>
                              <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(currentInvoiceData.amountPaid || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold">
                              <span>Sisa Hutang:</span>
                              <span className="font-mono tabular-nums">
                                {formatCurrency(
                                  Math.max(
                                    0,
                                    Math.round(
                                      currentInvoiceData.totalAmount -
                                        (currentInvoiceData.amountPaid || 0)
                                    )
                                  )
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-5">
                      <p className="text-[11px] text-slate-400">
                        Tanggal: {new Date(currentInvoiceData.date).toLocaleString("id-ID")}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsInvoiceModalOpen(false);
                            setCurrentInvoiceData(null);
                          }}
                          className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Tutup
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 active:scale-95 font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak Faktur
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── MODAL: Delete Confirmation ─────────────────────────────────────── */}
            <AnimatePresence>
              {invoiceToDelete && (
                <motion.div
                  key="po-delete-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => setInvoiceToDelete(null)}
                  className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    onClick={(e) => e.stopPropagation()}
                    className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6 space-y-4"
                  >
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Hapus Purchase Order?
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                      Apakah Anda yakin ingin menghapus PO <strong className="text-slate-800 dark:text-slate-200">{invoiceToDelete.poNumber}</strong>? Catatan inventaris dan transaksi keuangan terkait PO ini juga akan disesuaikan.
                    </p>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setInvoiceToDelete(null)}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isReadOnly || !invoiceToDelete) {
                            setInvoiceToDelete(null);
                            return;
                          }
                          if (isPeriodClosed(invoiceToDelete.date)) {
                            toast.error(
                              `PO ${invoiceToDelete.poNumber} berada pada periode ${getLocalPeriodFromTimestamp(invoiceToDelete.date)} yang telah ditutup buku dan tidak dapat dihapus.`
                            );
                            setInvoiceToDelete(null);
                            return;
                          }
                          deletePurchaseOrder(invoiceToDelete.id);
                          toast.success(`PO ${invoiceToDelete.poNumber} berhasil dihapus.`);
                          setInvoiceToDelete(null);
                        }}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Ya, Hapus PO
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── MODAL: Pay PO (Hutang Dagang) ──────────────────────────────────── */}
            <AnimatePresence>
              {payModalOpen && selectedPOForPay && (() => {
                const remaining = Math.max(
                  0,
                  Math.round(selectedPOForPay.totalAmount - (selectedPOForPay.amountPaid || 0))
                );
                const supplier = suppliers.find((s) => s.id === selectedPOForPay.supplierId);
                return (
                  <motion.div
                    key="po-pay-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onClick={() => setPayModalOpen(false)}
                    className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 8 }}
                      transition={{ type: "spring", damping: 28, stiffness: 360 }}
                      onClick={(e) => e.stopPropagation()}
                      className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar p-6 space-y-4"
                    >
                      <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            <span>Pembayaran Hutang Supplier</span>
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            {selectedPOForPay.poNumber} • {supplier?.name || selectedPOForPay.supplierName || "Supplier"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPayModalOpen(false)}
                          aria-label="Tutup modal pembayaran"
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Tagihan Summary Card */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs space-y-2">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Total Tagihan PO:</span>
                          <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(selectedPOForPay.totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Sudah Dibayar:</span>
                          <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(selectedPOForPay.amountPaid || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700 items-center">
                          <span className="font-bold text-slate-700 dark:text-slate-200">Sisa Hutang:</span>
                          <span className="text-lg font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                            {formatCurrency(remaining)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        {/* Nominal Bayar + Presets */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block font-bold text-slate-700 dark:text-slate-200">Jumlah Dibayar (Rp)</label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setPayAmount(remaining)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 hover:bg-brand-100 cursor-pointer"
                              >
                                Lunas (100%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPayAmount(Math.round(remaining / 2))}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                50%
                              </button>
                              <button
                                type="button"
                                onClick={() => setPayAmount(Math.round(remaining / 4))}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                25%
                              </button>
                            </div>
                          </div>
                          <CurrencyInput
                            emptyWhenZero
                            value={payAmount}
                            onValueChange={(_, num) =>
                              setPayAmount(Math.min(remaining, Math.max(0, Math.round(num))))
                            }
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-bold font-mono focus:bg-white dark:focus:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            placeholder="Masukkan jumlah pembayaran..."
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Terbilang: {formatCurrency(payAmount || 0)}
                          </p>
                        </div>

                        {/* Pilih Sumber Kas / Bank */}
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Dari Akun Kas / Bank</label>
                          <CustomSelect
                            value={payAccountId}
                            onChange={setPayAccountId}
                            placeholder="-- Pilih Akun Kas/Bank --"
                            options={[
                              { value: "", label: "-- Pilih Akun Kas/Bank --" },
                              ...cashAccounts.map((a) => ({
                                value: a.id,
                                label: `${a.name} (${formatCurrency(accountBalances[a.id] || 0)})`,
                              })),
                            ]}
                            buttonClassName="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-medium hover:bg-white dark:hover:bg-slate-800 dark:text-slate-100"
                          />
                        </div>

                        {/* Tanggal Bayar */}
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Tanggal Pembayaran</label>
                          <CustomDatePicker
                            value={payDate}
                            onChange={setPayDate}
                            allowClear={false}
                            buttonClassName="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-medium hover:bg-white dark:hover:bg-slate-800 dark:text-slate-100"
                          />
                        </div>

                        {/* Catatan / No Referensi Transfer */}
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Catatan / Bukti Transfer (Opsional)</label>
                          <input
                            type="text"
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            placeholder="Misal: Transfer BCA Ref #88910, Cicilan ke-1..."
                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs focus:bg-white dark:focus:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setPayModalOpen(false)}
                          className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canProcessPayment || !selectedPOForPay) return;
                            const activePayYmd = payDate || getLocalDateString();
                            const payPeriod = getLocalPeriodFromTimestamp(activePayYmd);
                            const validation = validatePoPaymentInput({
                              poStatus: selectedPOForPay.status,
                              totalAmount: selectedPOForPay.totalAmount,
                              amountPaid: selectedPOForPay.amountPaid,
                              payAmount,
                              cashAccountId: payAccountId,
                              payDateYmd: activePayYmd,
                              isPeriodClosed: isPeriodClosed(payPeriod),
                            });
                            if ("error" in validation) {
                              toast.error(validation.error);
                              return;
                            }
                            payPurchaseOrder(
                              selectedPOForPay.id,
                              validation.effectiveAmount,
                              payAccountId,
                              payNotes.trim() || undefined,
                              validation.payDateIso
                            );
                            toast.success(
                              validation.nextStatus === "PAID"
                                ? `PO ${selectedPOForPay.poNumber} berhasil dilunasi.`
                                : `Cicilan ${formatCurrency(validation.effectiveAmount)} untuk PO ${selectedPOForPay.poNumber} berhasil dicatat.`
                            );
                            setPayModalOpen(false);
                            setPayNotes("");
                          }}
                          disabled={!payAccountId || payAmount <= 0}
                          className="px-5 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 active:scale-95 transition-all text-xs disabled:opacity-40 shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Konfirmasi Pembayaran ({formatCurrency(payAmount || 0)})</span>
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </>,
          document.body
        )}
    </div>
  );
};
