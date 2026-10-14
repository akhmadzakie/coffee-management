import React, { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import { Order, OrderItem, OrderType, OrderModifier, PrintDestination } from "../../types";
import {
  Store,
  Search,
  Coffee,
  Utensils,
  Cake,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  DollarSign,
  Percent,
  X,
  FileText,
  Lock,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PosPaymentModal } from "./PosPaymentModal";
import { PosOpenBillsModal } from "./PosOpenBillsModal";
import { PosManagerPinModal } from "./PosManagerPinModal";
import { PosReceiptModal } from "./PosReceiptModal";
import { PosPrinterSettingsModal } from "./PosPrinterSettingsModal";
import { PosTodayOrdersModal } from "./PosTodayOrdersModal";
import { PosShiftModal } from "./PosShiftModal";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  defaultStation: PrintDestination;
  recipe: { ingredientId: string; quantity: number }[];
  estimatedHpp: number;
  maxPortions: number;
  isAvailable: boolean;
  price?: number;
}

interface CartItem {
  cartId: string;
  recipeId?: string;
  menuName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  modifiers: OrderModifier[];
  notes?: string;
  printDestination: PrintDestination;
}

export const PosTerminal: React.FC<{ onNavigateBack?: () => void }> = ({ onNavigateBack }) => {
  const { currentUser, settings, shifts, cashAccounts, recipes } = useStore();

  // State menu & catalog
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // State cart / order
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");

  // Diskon & Pajak
  const [discountType, setDiscountType] = useState<"PERCENT" | "NOMINAL">("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState("");
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOpenBillsModalOpen, setIsOpenBillsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState<"DISCOUNT" | "VOID">("DISCOUNT");
  const [pendingDiscountValue, setPendingDiscountValue] = useState<number>(0);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isTodayOrdersOpen, setIsTodayOrdersOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Active open bills count
  const [activeBillsCount, setActiveBillsCount] = useState<number>(0);
  const [currentEditingOrderId, setCurrentEditingOrderId] = useState<string | null>(null);

  // Active shift
  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === "OPEN" && (currentUser?.id ? s.userId === currentUser.id : true)) || null;
  }, [shifts, currentUser]);

  // Tax config from settings
  const taxEnabled = settings?.taxEnabled ?? false;
  const taxRate = settings?.taxRate ?? 10;
  const taxMode = settings?.taxMode ?? "EXCLUSIVE";
  const maxCashierDiscount = settings?.maxCashierDiscount ?? 10;

  // Fetch live menu with stock portions
  const fetchMenu = async () => {
    setIsLoadingMenu(true);
    try {
      const res = await fetch("/api/pos/menu");
      if (res.ok) {
        const data = await res.json();
        const itemsWithPrices = (data.menu || []).map((m: MenuItem) => {
          let estimatedPrice = Math.max(18000, Math.round((m.estimatedHpp * 2.8) / 1000) * 1000);
          if (m.name.toLowerCase().includes("espresso")) estimatedPrice = 15000;
          if (m.name.toLowerCase().includes("croissant")) estimatedPrice = 28000;
          return { ...m, price: estimatedPrice };
        });
        setMenuList(itemsWithPrices);
      }
    } catch (e) {
      console.error("Gagal mengambil menu POS:", e);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  // Fetch active open bills count
  const fetchActiveBillsCount = async () => {
    try {
      const res = await fetch("/api/pos/orders/active");
      if (res.ok) {
        const orders = await res.json();
        setActiveBillsCount(orders.length);
      }
    } catch (e) {
      console.error("Gagal mengambil open bills:", e);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchActiveBillsCount();
    const interval = setInterval(() => {
      fetchActiveBillsCount();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menuList.filter((item) => {
      const matchesCat =
        selectedCategory === "ALL" ||
        item.category.toUpperCase() === selectedCategory.toUpperCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuList, selectedCategory, searchQuery]);

  // Perhitungan Subtotal, Diskon, Pajak, dan Total
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === "PERCENT") {
      return Math.round((subtotal * discountValue) / 100);
    }
    return Math.min(subtotal, discountValue);
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const taxAmount = useMemo(() => {
    if (!taxEnabled || taxRate <= 0) return 0;
    if (taxMode === "INCLUSIVE") {
      return Math.round(afterDiscount - afterDiscount / (1 + taxRate / 100));
    }
    return Math.round((afterDiscount * taxRate) / 100);
  }, [taxEnabled, taxRate, taxMode, afterDiscount]);

  const totalAmount = useMemo(() => {
    if (taxMode === "INCLUSIVE") {
      return afterDiscount;
    }
    return afterDiscount + taxAmount;
  }, [afterDiscount, taxAmount, taxMode]);

  // Handler tambah ke keranjang
  const handleAddToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      alert(`Stok bahan baku untuk menu "${item.name}" saat ini habis.`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.recipeId === item.id && ci.modifiers.length === 0
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + 1;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          subtotal: newQty * existing.unitPrice,
        };
        return updated;
      }

      const unitPrice = item.price || 20000;
      return [
        ...prev,
        {
          cartId: crypto.randomUUID(),
          recipeId: item.id,
          menuName: item.name,
          variantName: "Regular",
          quantity: 1,
          unitPrice,
          subtotal: unitPrice,
          modifiers: [],
          notes: "",
          printDestination: item.defaultStation || "BAR",
        },
      ];
    });
  };

  const handleUpdateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.cartId === cartId) {
            const newQty = ci.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...ci,
              quantity: newQty,
              subtotal: newQty * ci.unitPrice,
            };
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((ci) => ci.cartId !== cartId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Kosongkan keranjang pesanan saat ini?")) {
      setCart([]);
      setTableNumber("");
      setCustomerName("");
      setDiscountValue(0);
      setDiscountReason("");
      setCurrentEditingOrderId(null);
    }
  };

  // Verifikasi Plafon Diskon Kasir
  const handleApplyDiscount = (val: number, type: "PERCENT" | "NOMINAL") => {
    const percentEquivalent =
      type === "PERCENT" ? val : subtotal > 0 ? (val / subtotal) * 100 : 0;

    if (percentEquivalent > maxCashierDiscount) {
      setPendingDiscountValue(val);
      setDiscountType(type);
      setPinActionType("DISCOUNT");
      setIsPinModalOpen(true);
    } else {
      setDiscountType(type);
      setDiscountValue(val);
      setIsDiscountModalOpen(false);
    }
  };

  // Simpan Open Bill (Dine-in Tab)
  const handleSaveOpenBill = async () => {
    if (cart.length === 0) {
      alert("Keranjang masih kosong.");
      return;
    }
    if (orderType === "DINE_IN" && !tableNumber.trim()) {
      alert("Silakan masukkan Nomor Meja untuk pesanan Dine-In (Open Bill).");
      return;
    }

    try {
      const payload = {
        idempotencyKey: crypto.randomUUID(),
        orderType,
        tableNumber: tableNumber.trim() || "Takeaway",
        customerName: customerName.trim() || "Tamu",
        items: cart.map((ci) => ({
          menuName: ci.menuName,
          recipeId: ci.recipeId,
          variantName: ci.variantName,
          quantity: ci.quantity,
          unitPrice: ci.unitPrice,
          subtotal: ci.subtotal,
          modifiers: ci.modifiers,
          notes: ci.notes,
          printDestination: ci.printDestination,
        })),
        subtotal,
        discountPercent: discountType === "PERCENT" ? discountValue : 0,
        discountAmount,
        discountReason: discountReason || null,
        taxPercent: taxEnabled ? taxRate : 0,
        taxAmount,
        taxMode,
        totalAmount,
        notes: orderNotes || null,
        cashierId: currentUser?.id || "cashier",
        cashierName: currentUser?.name || "Kasir",
        shiftId: activeShift?.id || null,
        status: "OPEN",
      };

      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan Open Bill");
      }

      const result = await res.json();
      alert(`Open Bill berhasil disimpan!\nNomor Pesanan: ${result.order.receiptNo} (${tableNumber || "Meja"})`);

      setCart([]);
      setTableNumber("");
      setCustomerName("");
      setDiscountValue(0);
      setDiscountReason("");
      setCurrentEditingOrderId(null);
      fetchActiveBillsCount();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleSelectOpenBill = (billOrder: any) => {
    setCurrentEditingOrderId(billOrder.id);
    setOrderType(billOrder.orderType);
    setTableNumber(billOrder.tableNumber || "");
    setCustomerName(billOrder.customerName || "");
    setDiscountValue(billOrder.discountPercent || 0);
    setDiscountType("PERCENT");
    setDiscountReason(billOrder.discountReason || "");

    const mappedCart: CartItem[] = (billOrder.items || []).map((it: any) => ({
      cartId: crypto.randomUUID(),
      recipeId: it.recipeId,
      menuName: it.menuName,
      variantName: it.variantName || "Regular",
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      subtotal: Number(it.subtotal) || 0,
      modifiers: it.modifiers || [],
      notes: it.notes || "",
      printDestination: it.printDestination || "BAR",
    }));

    setCart(mappedCart);
    setIsOpenBillsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] w-full bg-slate-950 text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 select-none">
      {/* ── Top Bar Kasir ─────────────────────────────────────────────────── */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              POS Terminal Kasir
              {currentEditingOrderId && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Mode Edit Open Bill
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-400">
              Kasir: <span className="text-slate-200 font-semibold">{currentUser?.name || "Staff"}</span>
              {activeShift ? (
                <button
                  onClick={() => setIsShiftModalOpen(true)}
                  className="ml-2 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1 transition"
                  title="Klik untuk melihat ringkasan shift atau tutup shift"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Shift Aktif • Tutup Shift</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsShiftModalOpen(true)}
                  className="ml-2 px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1 transition animate-bounce"
                  title="Klik untuk membuka modal awal laci kasir"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span className="font-bold">Buka Shift Kasir</span>
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons Top Bar */}
        <div className="flex items-center gap-2">
          {/* Riwayat Transaksi Hari Ini */}
          <button
            onClick={() => setIsTodayOrdersOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            title="Riwayat Transaksi Hari Ini & Cetak Ulang"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Riwayat Hari Ini</span>
          </button>

          <button
            onClick={() => setIsOpenBillsModalOpen(true)}
            className="relative px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Open Bill Meja</span>
            {activeBillsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center animate-pulse">
                {activeBillsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsPrinterSettingsOpen(true)}
            title="Pengaturan Printer Thermal"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-sky-400" />
          </button>

          <button
            onClick={fetchMenu}
            title="Refresh Stok Menu"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
          </button>

          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition"
            >
              Kembali ke Web
            </button>
          )}
        </div>
      </div>

      {/* ── Main Body Split Layout ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── SISI KIRI: Katalog Menu & Pencarian ───────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900/40">
          {/* Search & Categories */}
          <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari menu minuman, kopi, bakery, atau makanan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "ALL", label: "Semua Menu", icon: Sparkles },
                { id: "COFFEE", label: "Kopi (Coffee)", icon: Coffee },
                { id: "NON-COFFEE", label: "Non-Coffee", icon: Coffee },
                { id: "BAKERY", label: "Pastry & Bakery", icon: Cake },
                { id: "FOOD", label: "Makanan (Food)", icon: Utensils },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                        : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoadingMenu ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <RotateCcw className="w-6 h-6 animate-spin text-amber-500" />
                <p className="text-xs">Memuat katalog menu & ketersediaan stok...</p>
              </div>
            ) : filteredMenu.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <Coffee className="w-8 h-8 stroke-1 text-slate-600" />
                <p className="text-xs">Tidak ada menu yang sesuai dengan filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filteredMenu.map((item) => {
                  const inCartQty = cart
                    .filter((ci) => ci.recipeId === item.id)
                    .reduce((sum, ci) => sum + ci.quantity, 0);

                  return (
                    <motion.div
                      key={item.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAddToCart(item)}
                      className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                        !item.isAvailable
                          ? "bg-slate-900/30 border-slate-800/40 opacity-50 grayscale"
                          : inCartQty > 0
                          ? "bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                      }`}
                    >
                      {inCartQty > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-lg">
                          {inCartQty}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-semibold">
                            {item.category}
                          </span>
                          <span className="text-slate-500">
                            → {item.defaultStation}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight mb-1">
                          {item.name}
                        </h3>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500">Harga</p>
                          <p className="text-xs font-bold text-amber-400">
                            {formatCurrency(item.price || 0)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500">Ketersediaan</p>
                          <p
                            className={`text-[10px] font-bold ${
                              !item.isAvailable
                                ? "text-rose-400"
                                : item.maxPortions < 10
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {!item.isAvailable ? "Habis" : `${item.maxPortions} porsi`}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── SISI KANAN: Keranjang & Tagihan ───────────────────────────────── */}
        <div className="w-[380px] md:w-[420px] flex flex-col bg-slate-900 shrink-0">
          <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setOrderType("DINE_IN")}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  orderType === "DINE_IN"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Dine In (Makan Sini)</span>
              </button>
              <button
                onClick={() => setOrderType("TAKE_AWAY")}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  orderType === "TAKE_AWAY"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Take Away (Bungkus)</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                  Nomor Meja {orderType === "DINE_IN" && <span className="text-rose-400">*</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meja 05"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pak Dimas"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <Receipt className="w-10 h-10 stroke-1 text-slate-700" />
                <p className="text-xs font-medium text-slate-400">Keranjang masih kosong</p>
                <p className="text-[11px] text-slate-500 text-center max-w-[200px]">
                  Sentuh menu di katalog untuk menambahkan pesanan pelanggan.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.cartId}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <h4 className="text-xs font-bold text-white leading-tight">
                        {item.menuName}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-amber-400 font-medium">
                          {formatCurrency(item.unitPrice)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                          {item.printDestination}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white">
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Catatan (e.g. Less ice, no sugar)..."
                    value={item.notes || ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCart((prev) =>
                        prev.map((ci) =>
                          ci.cartId === item.cartId ? { ...ci, notes: text } : ci
                        )
                      );
                    }}
                    className="w-full px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                  />

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40">
                    <button
                      onClick={() => handleRemoveFromCart(item.cartId)}
                      className="text-slate-500 hover:text-rose-400 transition"
                      title="Hapus Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => handleUpdateQuantity(item.cartId, -1)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-white min-w-[16px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.cartId, 1)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Bill Summary & Actions ──────────────────────────────────────── */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-col gap-2 shrink-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} item)</span>
                <span className="text-slate-200 font-medium">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <button
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="text-amber-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Percent className="w-3 h-3" />
                  <span>
                    {discountAmount > 0
                      ? `Diskon (${discountType === "PERCENT" ? `${discountValue}%` : "Rp"})`
                      : "+ Tambah Diskon"}
                  </span>
                </button>
                <span className="text-amber-400 font-medium">
                  {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : "Rp 0"}
                </span>
              </div>

              {taxEnabled && (
                <div className="flex justify-between text-slate-400">
                  <span>
                    PB1 / Pajak Resto ({taxRate}%) [{taxMode}]
                  </span>
                  <span className="text-slate-200 font-medium">
                    {taxMode === "INCLUSIVE" ? `(Inc) ${formatCurrency(taxAmount)}` : formatCurrency(taxAmount)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Total Tagihan</span>
                <span className="text-lg font-black text-amber-400">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                disabled={cart.length === 0}
                onClick={handleSaveOpenBill}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Simpan Bill Meja</span>
              </button>

              <button
                disabled={cart.length === 0}
                onClick={() => setIsPaymentModalOpen(true)}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:pointer-events-none text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
              >
                <Banknote className="w-4 h-4" />
                <span>Bayar Sekarang</span>
              </button>
            </div>

            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="w-full text-center text-[10px] text-slate-500 hover:text-rose-400 transition"
              >
                Kosongkan Keranjang
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals & Popups ───────────────────────────────────────────────── */}

      {isPaymentModalOpen && (
        <PosPaymentModal
          totalAmount={totalAmount}
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          taxPercent={taxEnabled ? taxRate : 0}
          taxMode={taxMode}
          tableNumber={tableNumber}
          customerName={customerName}
          orderType={orderType}
          cart={cart}
          orderNotes={orderNotes}
          discountReason={discountReason}
          discountPercent={discountType === "PERCENT" ? discountValue : 0}
          editingOrderId={currentEditingOrderId}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={(paidOrder) => {
            setIsPaymentModalOpen(false);
            setCompletedOrder(paidOrder);
            setIsReceiptModalOpen(true);
            setCart([]);
            setTableNumber("");
            setCustomerName("");
            setDiscountValue(0);
            setDiscountReason("");
            setCurrentEditingOrderId(null);
            fetchActiveBillsCount();
          }}
        />
      )}

      {isOpenBillsModalOpen && (
        <PosOpenBillsModal
          onClose={() => setIsOpenBillsModalOpen(false)}
          onSelectOrder={handleSelectOpenBill}
          onOrderVoided={() => fetchActiveBillsCount()}
        />
      )}

      {isPinModalOpen && (
        <PosManagerPinModal
          title={pinActionType === "DISCOUNT" ? "Otorisasi Diskon Khusus" : "Otorisasi Void Transaksi"}
          description={
            pinActionType === "DISCOUNT"
              ? `Diskon yang diberikan melebihi batas plafon kasir (${maxCashierDiscount}%). Masukkan PIN Manager/Owner.`
              : "Pembatalan / VOID transaksi memerlukan otorisasi Manager."
          }
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={(manager) => {
            setIsPinModalOpen(false);
            if (pinActionType === "DISCOUNT") {
              setDiscountValue(pendingDiscountValue);
              setIsDiscountModalOpen(false);
              alert(`Diskon disetujui oleh: ${manager.name}`);
            }
          }}
        />
      )}

      {isReceiptModalOpen && completedOrder && (
        <PosReceiptModal
          orderData={completedOrder}
          onClose={() => setIsReceiptModalOpen(false)}
        />
      )}

      {isPrinterSettingsOpen && (
        <PosPrinterSettingsModal onClose={() => setIsPrinterSettingsOpen(false)} />
      )}

      {isTodayOrdersOpen && (
        <PosTodayOrdersModal onClose={() => setIsTodayOrdersOpen(false)} />
      )}

      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                Atur Diskon Pesanan
              </h3>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipe Diskon</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setDiscountType("PERCENT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg ${
                      discountType === "PERCENT"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400"
                    }`}
                  >
                    Persentase (%)
                  </button>
                  <button
                    onClick={() => setDiscountType("NOMINAL")}
                    className={`py-1.5 text-xs font-semibold rounded-lg ${
                      discountType === "NOMINAL"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400"
                    }`}
                  >
                    Nominal (Rp)
                  </button>
                </div>
              </div>

              {discountType === "PERCENT" && (
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleApplyDiscount(p, "PERCENT")}
                      className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  {discountType === "PERCENT" ? "Persentase Diskon (%)" : "Jumlah Nominal Potongan (Rp)"}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  defaultValue={discountValue || ""}
                  id="customDiscountInput"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Alasan Diskon</label>
                <input
                  type="text"
                  placeholder="e.g. Promo Member, Teman Owner, Event"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setDiscountValue(0);
                    setDiscountReason("");
                    setIsDiscountModalOpen(false);
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Hapus Diskon
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("customDiscountInput") as HTMLInputElement;
                    const val = Number(el?.value) || 0;
                    handleApplyDiscount(val, discountType);
                  }}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Shift Kasir (Buka/Tutup & Rekonsiliasi Z-Report) */}
      <PosShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        activeShift={activeShift}
      />
    </div>
  );
};
