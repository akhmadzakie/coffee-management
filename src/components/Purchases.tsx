import React, { useState, useEffect } from "react";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Minus,
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
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  X,
  CreditCard,
  Layers,
} from "lucide-react";
import { PurchaseOrderItem } from "../types";
import { exportToCSV } from "../utils/export";
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
    updatePOStatus,
    markPOAsReceived,
    deletePurchaseOrder,
    settings,
    isReadOnly,
    currentUser,
  } = useStore();

  const isFinance =
    currentUser?.role === "FINANCE" ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "OWNER";

  const [activeTab, setActiveTab] = useState<"new_po" | "history">("new_po");

  // Purchase Mode: Formal Distributor PO vs Direct Market/Cash Purchase
  const [purchaseMode, setPurchaseMode] = useState<"DISTRIBUTOR" | "MARKET">("DISTRIBUTOR");
  const [marketName, setMarketName] = useState("Pasar Tradisional");
  const [marketNotes, setMarketNotes] = useState("");
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>("");

  // PO State
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [deliveryOption, setDeliveryOption] = useState<"RECEIVED" | "PENDING">("RECEIVED");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TEMPO">("CASH");
  const [dueDate, setDueDate] = useState<string>("");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState<string>("");
  const [selectedPOForPay, setSelectedPOForPay] = useState<any>(null);
  const [currentInvoiceData, setCurrentInvoiceData] = useState<any>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [poToReceive, setPoToReceive] = useState<any>(null);

  // Mobile drawer toggle for cart on small phones
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const isIndo = settings.language === "id";

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
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category || "").toLowerCase().includes(searchTerm.toLowerCase());
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
      setCart([
        ...cart,
        {
          productId,
          quantity: 1,
          unitPrice: Number(product.costPerUnit || 0),
          subtotal: Number(product.costPerUnit || 0),
        },
      ]);
    }
  };

  const updateCartItem = (
    productId: string,
    updates: Partial<PurchaseOrderItem>
  ) => {
    setCart(
      cart.map((item) => {
        if (item.productId === productId) {
          const updated = { ...item, ...updates };
          updated.subtotal =
            Math.max(1, updated.quantity) * Math.max(0, updated.unitPrice);
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

  const handleCheckout = (status: "PAID" | "UNPAID") => {
    if (cart.length === 0) return;

    // Mode Belanja Pasar / Eceran (Langsung Lunas & Masuk Stok)
    if (purchaseMode === "MARKET") {
      const newPO = addDirectMarketPurchase({
        marketName: marketName.trim() || "Pasar Tradisional / Belanja Harian",
        items: cart,
        totalAmount,
        cashAccountId: selectedCashAccountId || cashAccounts[0]?.id,
        notes: marketNotes.trim() || undefined,
      });

      setCurrentInvoiceData(newPO);
      setIsInvoiceModalOpen(true);
      setCart([]);
      setMarketNotes("");
      setIsMobileCartOpen(false);
      return;
    }

    // Mode PO Distributor Formal
    if (!selectedSupplier) return;
    const isPaid = status === "PAID";
    const poNumber = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPO = {
      poNumber,
      supplierId: selectedSupplier,
      supplierName: suppliers.find((s) => s.id === selectedSupplier)?.name,
      purchaseType: "DISTRIBUTOR" as const,
      date: new Date().toISOString(),
      items: cart,
      totalAmount,
      status: isPaid ? ("PAID" as const) : ("UNPAID" as const),
      deliveryStatus: deliveryOption,
      paymentMethod: isPaid ? ("CASH" as const) : ("TEMPO" as const),
      dueDate: isPaid ? undefined : dueDate,
      amountPaid: isPaid ? totalAmount : 0,
      cashAccountId: isPaid ? (selectedCashAccountId || cashAccounts[0]?.id) : undefined,
    };

    addPurchaseOrder(newPO);
    setCurrentInvoiceData(newPO);
    setIsInvoiceModalOpen(true);
    setCart([]);
    setSelectedSupplier("");
    setIsMobileCartOpen(false);
  };

  const handleExportHistory = () => {
    const dataToExport = purchaseOrders.map((po) => {
      const supplier = suppliers.find((s) => s.id === po.supplierId);
      return {
        PONumber: po.poNumber,
        Date: new Date(po.date).toLocaleDateString(),
        Supplier: supplier?.name || po.supplierName || "Unknown",
        TotalAmount: po.totalAmount,
        Status: po.status,
        DeliveryStatus: po.deliveryStatus,
        ItemsCount: po.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
    exportToCSV("Node_Supply_Purchase_Orders", dataToExport);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─── Header Banner ────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Supply Chain & Restock
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Procurement Center
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span>{isIndo ? "Pembelian Bahan & Purchase Order" : "Procurement & Purchase Orders"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            Kelola PO resmi distributor, belanja pasar darurat kasir, penerimaan stok gudang, dan rekonsiliasi hutang dagang.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 w-full xl:w-auto shrink-0 max-w-full overflow-hidden">
          {!isReadOnly && (
            <button
              onClick={() => setActiveTab("new_po")}
              className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer truncate ${
                activeTab === "new_po" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "new_po" && (
                <motion.div
                  layoutId="purchasesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Plus className="w-3.5 h-3.5 text-brand-600 relative z-10 shrink-0" />
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
            onClick={() => setActiveTab("history")}
            className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer truncate ${
              activeTab === "history" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {activeTab === "history" && (
              <motion.div
                layoutId="purchasesMainTab"
                className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <Receipt className="w-3.5 h-3.5 text-brand-600 relative z-10 shrink-0" />
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

      {/* ─── TAB 1: NEW PURCHASE (RESTOCK) ────────────────────────────────────────── */}
      {!isReadOnly && activeTab === "new_po" ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Products Catalog for Restock (Left Column) */}
          <div className="flex-1 w-full bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            {/* Search & Category Filter Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    isIndo
                      ? "Cari nama bahan baku, kemasan, atau kategori..."
                      : "Search ingredients for restock..."
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-base sm:text-xs font-medium focus:ring-2 focus:ring-brand-500/20 bg-white outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 -mx-1 px-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer active:scale-95 ${
                      selectedCategory === cat
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
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
                      <p className="text-[11px] text-slate-400">
                        Biaya Master: {formatCurrency(Number(product.costPerUnit || 0))} / {product.unit}
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
                  <select
                    value={selectedCashAccountId}
                    onChange={(e) => setSelectedCashAccountId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium"
                  >
                    {cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance || 0)})
                      </option>
                    ))}
                  </select>
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
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/20 text-base sm:text-xs bg-white font-medium"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                  >
                    <option value="">
                      {isIndo ? "-- Pilih Supplier --" : "-- Choose Supplier --"}
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.picName})
                      </option>
                    ))}
                  </select>
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

                  return (
                    <div
                      key={item.productId}
                      className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">
                            {product?.name}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Stok saat ini: {currentStock} {product?.unit}
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

                      <div className="flex items-center justify-between text-xs gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCartItem(item.productId, {
                                quantity: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className="w-14 border border-slate-200 rounded-xl px-2 py-1 text-center font-bold text-base sm:text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                          <span className="text-slate-400 text-xs">× Rp</span>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateCartItem(item.productId, {
                                unitPrice: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="w-20 border border-slate-200 rounded-xl px-2 py-1 text-right font-mono text-base sm:text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                        <span className="font-bold font-mono text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Checkout Controls */}
            <div className="p-4 bg-white border-t border-slate-100 space-y-3">
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!selectedSupplier || cart.length === 0}
                    onClick={() => handleCheckout("UNPAID")}
                    className="py-3 px-2 bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-2xl hover:bg-slate-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs cursor-pointer"
                  >
                    Simpan Belum Lunas
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSupplier || cart.length === 0}
                    onClick={() => handleCheckout("PAID")}
                    className="py-3 px-2 bg-brand-600 text-white font-bold rounded-2xl hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs shadow-xs cursor-pointer"
                  >
                    Bayar Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── TAB 2: PURCHASE ORDERS HISTORY ───────────────────────────────────────── */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col space-y-4 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {isIndo ? "Riwayat Purchase Order (PO)" : "Purchase Order History"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar semua faktur pembelian dari distributor rekanan dan belanja eceran kafe.
              </p>
            </div>
            <button
              onClick={handleExportHistory}
              className="whitespace-nowrap shrink-0 flex items-center px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 active:scale-95 transition-all shadow-xs text-xs font-bold cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
              <span>{isIndo ? "Ekspor CSV" : "Export CSV"}</span>
            </button>
          </div>

          {/* TABLE VIEW (Desktop / Tablet) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 font-bold border-b border-slate-200">
                  <th className="px-4 py-3 rounded-l-xl">No PO</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Supplier / Toko</th>
                  <th className="px-4 py-3">Status Bayar</th>
                  <th className="px-4 py-3">Penerimaan Stok</th>
                  <th className="px-4 py-3 text-right">Total Tagihan</th>
                  <th className="px-4 py-3 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders
                  .slice()
                  .reverse()
                  .map((po) => {
                    const supplier = suppliers.find((s) => s.id === po.supplierId);
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap font-bold">
                          <div className="flex items-center gap-2">
                            {po.purchaseType === "MARKET" ? (
                              <span
                                className="p-1 rounded-md bg-emerald-100 text-emerald-700"
                                title="Belanja Pasar Langsung"
                              >
                                <Store className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span
                                className="p-1 rounded-md bg-brand-50 text-brand-700"
                                title="PO Distributor"
                              >
                                <Building2 className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span
                              className={
                                po.purchaseType === "MARKET"
                                  ? "text-emerald-700 font-mono"
                                  : "text-brand-700 font-mono"
                              }
                            >
                              {po.poNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                          {new Date(po.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {po.purchaseType === "MARKET" ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                              <Store className="w-3 h-3 text-emerald-600" />
                              {po.supplierName || "Pasar Tradisional"}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-800">
                              {supplier?.name || po.supplierName || "Unknown Supplier"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                po.status === "PAID"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {po.status === "PAID" ? "Lunas" : "Belum Lunas"}
                            </span>
                            {po.status === "UNPAID" && isFinance && (
                              <button
                                onClick={() => {
                                  setSelectedPOForPay(po);
                                  setPayAmount(po.totalAmount - (po.amountPaid || 0));
                                  setPayModalOpen(true);
                                }}
                                className="text-brand-600 hover:text-brand-800 font-bold underline cursor-pointer"
                              >
                                Lunasi
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                po.deliveryStatus === "RECEIVED"
                                  ? "bg-brand-50 text-brand-800 border border-brand-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {po.deliveryStatus === "RECEIVED" ? "Diterima (Stok Masuk)" : "Menunggu"}
                            </span>
                            {po.deliveryStatus !== "RECEIVED" && (
                              <button
                                onClick={() => setPoToReceive(po)}
                                className="text-brand-600 hover:text-brand-800 font-bold underline cursor-pointer"
                              >
                                Terima Barang
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right font-black font-mono text-slate-900">
                          {formatCurrency(po.totalAmount)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setCurrentInvoiceData(po);
                                setIsInvoiceModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors cursor-pointer"
                              title="Cetak Faktur PO"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setInvoiceToDelete(po)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors cursor-pointer"
                              title="Hapus PO"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {purchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      Belum ada data Purchase Order terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* CARD FEED VIEW (Mobile Phone 360-480px) */}
          <div className="block md:hidden space-y-3">
            {purchaseOrders
              .slice()
              .reverse()
              .map((po) => {
                const supplier = suppliers.find((s) => s.id === po.supplierId);
                return (
                  <div
                    key={po.id}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {po.purchaseType === "MARKET" ? (
                            <Store className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-brand-600" />
                          )}
                          <span className="font-bold font-mono text-xs text-slate-900">
                            {po.poNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(po.date).toLocaleDateString()} ·{" "}
                          {po.purchaseType === "MARKET"
                            ? po.supplierName || "Pasar Tradisional"
                            : supplier?.name || po.supplierName || "Distributor"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-black font-mono text-sm text-brand-950 block">
                          {formatCurrency(po.totalAmount)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {po.items.length} items
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          po.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {po.status === "PAID" ? "Lunas" : "Hutang"}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          po.deliveryStatus === "RECEIVED"
                            ? "bg-brand-50 text-brand-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {po.deliveryStatus === "RECEIVED" ? "Masuk Stok" : "Tunggu Kirim"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {po.status === "UNPAID" && isFinance && (
                          <button
                            onClick={() => {
                              setSelectedPOForPay(po);
                              setPayAmount(po.totalAmount - (po.amountPaid || 0));
                              setPayModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Lunasi
                          </button>
                        )}
                        {po.deliveryStatus !== "RECEIVED" && (
                          <button
                            onClick={() => setPoToReceive(po)}
                            className="px-2.5 py-1 bg-brand-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Terima Stok
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCurrentInvoiceData(po);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Faktur</span>
                        </button>
                        <button
                          onClick={() => setInvoiceToDelete(po)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {purchaseOrders.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Belum ada data Purchase Order terdaftar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Receive PO (Goods Arrival) ─────────────────────────────────────── */}
      {poToReceive && (
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Konfirmasi Penerimaan Barang?
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Barang untuk PO <strong className="text-slate-800">{poToReceive.poNumber}</strong> sudah sampai di outlet/gudang? Sistem akan secara otomatis menambahkan stok masuk ke inventori.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPoToReceive(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  markPOAsReceived(poToReceive.id);
                  setPoToReceive(null);
                }}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Ya, Terima & Masuk Stok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: View PO Invoice ────────────────────────────────────────────────── */}
      {isInvoiceModalOpen && currentInvoiceData && (
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
                  {currentInvoiceData.purchaseType === "MARKET" ? (
                    <>
                      <Store className="w-5 h-5 text-emerald-600" />
                      <span>BUKTI BELANJA PASAR / ECERAN</span>
                    </>
                  ) : (
                    <span>PURCHASE ORDER</span>
                  )}
                </h2>
                <p className="text-slate-400 text-xs font-mono font-bold">
                  {currentInvoiceData.poNumber}
                </p>
                <div className="flex gap-2 mt-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      currentInvoiceData.status === "PAID"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {currentInvoiceData.status === "PAID" ? "LUNAS (CASH)" : "HUTANG (TEMPO)"}
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      currentInvoiceData.deliveryStatus === "RECEIVED"
                        ? "bg-brand-50 text-brand-800 border border-brand-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {currentInvoiceData.deliveryStatus === "RECEIVED"
                      ? "MASUK STOK (RECEIVED)"
                      : "MENUNGGU PENGIRIMAN"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <h3 className="font-black text-slate-900 text-base">
                  {settings.brandName || "Julia's Coffee & Eatery"}
                </h3>
                <p className="text-slate-500 text-xs max-w-xs ml-auto mt-0.5">
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
              <h4 className="font-bold text-slate-900 text-base">
                {currentInvoiceData.purchaseType === "MARKET"
                  ? currentInvoiceData.supplierName || "Pasar Tradisional / Belanja Harian"
                  : suppliers.find((s) => s.id === currentInvoiceData.supplierId)?.name ||
                    currentInvoiceData.supplierName ||
                    "Unknown Supplier"}
              </h4>
              {currentInvoiceData.notes && (
                <p className="text-slate-600 text-xs mt-1 italic">
                  Catatan: {currentInvoiceData.notes}
                </p>
              )}
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
                    <th className="py-2.5 px-3 text-left rounded-l-lg">Deskripsi Bahan</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentInvoiceData.items.map((item: any, idx: number) => {
                    const product = ingredients.find((p) => p.id === item.productId);
                    return (
                      <tr key={idx}>
                        <td className="py-3 px-3 text-slate-900 font-medium">
                          {product?.name || "Unknown Product"}
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-center font-mono">
                          {item.quantity} {product?.unit}
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-right font-mono">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-bold font-mono text-right">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 mb-6">
              <div className="w-64 space-y-1 text-xs">
                <div className="flex justify-between items-center text-base font-black text-slate-900 pt-1">
                  <span>Total Tagihan:</span>
                  <span className="text-brand-950 font-mono">
                    {formatCurrency(currentInvoiceData.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 pt-5">
              <p className="text-[11px] text-slate-400">
                Tanggal: {new Date(currentInvoiceData.date).toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsInvoiceModalOpen(false);
                    setCurrentInvoiceData(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 active:scale-95 font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Faktur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Delete Confirmation ────────────────────────────────────────────── */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              Hapus Purchase Order?
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Apakah Anda yakin ingin menghapus PO <strong className="text-slate-800">{invoiceToDelete.poNumber}</strong>? Catatan inventaris dan transaksi keuangan terkait PO ini juga akan disesuaikan.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  deletePurchaseOrder(invoiceToDelete.id);
                  setInvoiceToDelete(null);
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Ya, Hapus PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Pay PO (Hutang Dagang) ─────────────────────────────────────────── */}
      {payModalOpen && selectedPOForPay && (
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Bayar Hutang PO</h3>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <span className="text-slate-500">Sisa Tagihan:</span>
              <div className="text-lg font-black font-mono text-rose-600">
                {formatCurrency(selectedPOForPay.totalAmount - (selectedPOForPay.amountPaid || 0))}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jumlah Dibayar (Rp)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-bold font-mono focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dari Akun Kas / Bank</label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-medium focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none"
                >
                  <option value="">-- Pilih Akun Kas/Bank --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balance || 0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (payAmount > 0 && payAccountId) {
                    payPurchaseOrder(selectedPOForPay.id, payAmount, payAccountId);
                    setPayModalOpen(false);
                  }
                }}
                disabled={!payAccountId || payAmount <= 0}
                className="px-5 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 active:scale-95 transition-all text-xs disabled:opacity-40 shadow-xs cursor-pointer"
              >
                Konfirmasi Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
