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
  LogOut,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PosPaymentModal } from "./PosPaymentModal";
import { PosOpenBillsModal } from "./PosOpenBillsModal";
import { PosManagerPinModal } from "./PosManagerPinModal";
import { PosReceiptModal } from "./PosReceiptModal";
import { PosPrinterSettingsModal } from "./PosPrinterSettingsModal";
import { PosTodayOrdersModal } from "./PosTodayOrdersModal";
import { PosShiftModal } from "./PosShiftModal";
import { PosCustomizeModal } from "./PosCustomizeModal";

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
  const { currentUser, settings, shifts, cashAccounts, recipes, logout } = useStore();

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
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

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

  // Offline PWA state & queue
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("coffee_pos_offline_orders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync offline orders to server when back online
  const syncOfflineOrders = async () => {
    if (offlineQueue.length === 0 || !navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;
    const remainingQueue: any[] = [];

    for (const offlineOrder of offlineQueue) {
      try {
        const res = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(offlineOrder),
        });
        if (res.ok) {
          successCount++;
        } else {
          remainingQueue.push(offlineOrder);
        }
      } catch {
        remainingQueue.push(offlineOrder);
      }
    }

    setOfflineQueue(remainingQueue);
    localStorage.setItem("coffee_pos_offline_orders", JSON.stringify(remainingQueue));
    setIsSyncing(false);
    if (successCount > 0) {
      alert(`Berhasil menyinkronkan ${successCount} pesanan offline ke server database!`);
      fetchActiveBillsCount();
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineOrders();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [offlineQueue]);

  // Fetch live menu with stock portions (with localStorage fallback)
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
        // Simpan ke cache lokal untuk mode offline
        localStorage.setItem("coffee_pos_cached_menu", JSON.stringify(itemsWithPrices));
      } else {
        throw new Error("Gagal mengambil menu dari server");
      }
    } catch (e) {
      console.warn("Menggunakan cache menu lokal POS (Mode Offline):", e);
      const cached = localStorage.getItem("coffee_pos_cached_menu");
      if (cached) {
        try {
          setMenuList(JSON.parse(cached));
        } catch {}
      }
    } finally {
      setIsLoadingMenu(false);
    }
  };

  // Fetch active open bills count
  const fetchActiveBillsCount = async () => {
    if (!navigator.onLine) return;
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

  const handleAddToCartWithCustomization = (customizedItem: {
    recipeId: string;
    menuName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    modifiers: OrderModifier[];
    notes?: string;
    printDestination: PrintDestination;
  }) => {
    setCart((prev) => [
      ...prev,
      {
        cartId: crypto.randomUUID(),
        ...customizedItem,
      },
    ]);
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

      // Offline fallback check
      if (!navigator.onLine) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const receiptNo = `ORD-OFFLINE-${dateStr}-${randomSuffix}`;
        const offlineOrder = { ...payload, id: crypto.randomUUID(), receiptNo, createdAt: new Date().toISOString() };
        const updated = [...offlineQueue, offlineOrder];
        setOfflineQueue(updated);
        localStorage.setItem("coffee_pos_offline_orders", JSON.stringify(updated));
        alert(`Mode Offline: Open Bill disimpan di memori tablet!\nNomor Pesanan: ${receiptNo} (${tableNumber || "Meja"})\nPesanan otomatis tersinkron saat internet online.`);
        setCart([]);
        setTableNumber("");
        setCustomerName("");
        return;
      }

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
    <div className="flex flex-col h-[calc(100vh-2rem)] w-full bg-slate-100 text-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-200 select-none">
      {/* ── Top Bar Kasir (Light) ─────────────────────────────────────────── */}
      <div className="h-14 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <img
            src="/logo-icon-color.png"
            alt="Julia's"
            className="w-9 h-9 rounded-xl object-contain shadow-xs border border-brand-200"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Julia's</span>
              <span className="text-[11px] font-normal text-slate-400">|</span>
              <span className="text-xs font-semibold text-slate-600">POS Kasir</span>
              {currentEditingOrderId && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  Mode Edit Open Bill
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-500">
              Kasir: <span className="text-slate-800 font-semibold">{currentUser?.name || "Staff"}</span>
              {activeShift ? (
                <button
                  onClick={() => setIsShiftModalOpen(true)}
                  className="ml-2 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1 transition text-[11px] font-bold"
                  title="Klik untuk melihat ringkasan shift atau tutup shift"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Shift Aktif • Tutup Shift</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsShiftModalOpen(true)}
                  className="ml-2 px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 inline-flex items-center gap-1 transition animate-bounce text-[11px] font-bold"
                  title="Klik untuk membuka modal awal laci kasir"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Buka Shift Kasir</span>
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons Top Bar */}
        <div className="flex items-center gap-2">
          {/* Status Koneksi Online / Offline & Sync Queue */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition shadow-2xs bg-slate-50 border-slate-200">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px]">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-800">
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[11px]">Offline</span>
              </span>
            )}

            {offlineQueue.length > 0 && (
              <button
                onClick={syncOfflineOrders}
                disabled={!isOnline || isSyncing}
                className="ml-1 px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-[10px] shadow-xs flex items-center gap-1 transition animate-pulse"
                title="Klik untuk menyinkronkan antrean pesanan offline ke server"
              >
                <RotateCcw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync {offlineQueue.length} Order</span>
              </button>
            )}
          </div>

          {/* Riwayat Transaksi Hari Ini */}
          <button
            onClick={() => setIsTodayOrdersOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition flex items-center gap-1.5"
            title="Riwayat Transaksi Hari Ini & Cetak Ulang"
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Hari Ini</span>
          </button>

          <button
            onClick={() => setIsOpenBillsModalOpen(true)}
            className="relative px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-amber-600" />
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
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
          >
            <Printer className="w-4 h-4 text-sky-600" />
          </button>

          <button
            onClick={fetchMenu}
            title="Refresh Stok Menu"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
          </button>

          {onNavigateBack ? (
            <button
              onClick={onNavigateBack}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition"
              title="Kembali ke Dashboard Manajemen"
            >
              Kembali ke Web
            </button>
          ) : (
            <button
              onClick={logout}
              title="Keluar dari akun kasir"
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Body Split Layout ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── SISI KIRI: Katalog Menu & Pencarian (Light) ──────────────────── */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50">
          {/* Search & Categories */}
          <div className="p-3 border-b border-slate-200 bg-white flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari menu minuman, kopi, bakery, atau makanan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                        : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
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
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <RotateCcw className="w-6 h-6 animate-spin text-amber-500" />
                <p className="text-xs">Memuat katalog menu & ketersediaan stok...</p>
              </div>
            ) : filteredMenu.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Coffee className="w-8 h-8 stroke-1 text-slate-300" />
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
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-xs ${
                        !item.isAvailable
                          ? "bg-slate-100/60 border-slate-200 opacity-60 grayscale"
                          : inCartQty > 0
                          ? "bg-amber-50/60 border-amber-500 shadow-md ring-1 ring-amber-400"
                          : "bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-md"
                      }`}
                    >
                      {inCartQty > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                          {inCartQty}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-semibold">
                            {item.category}
                          </span>
                          {item.isAvailable && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomizingItem(item);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 text-[9px] font-bold transition"
                              title="Kustomisasi suhu, gula, es, susu, dan add-on"
                            >
                              <Sliders className="w-3 h-3 text-amber-600" />
                              <span>Kustom</span>
                            </button>
                          )}
                        </div>

                        <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight mb-1">
                          {item.name}
                        </h3>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400">Harga</p>
                          <p className="text-xs font-bold text-amber-700">
                            {formatCurrency(item.price || 0)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400">Ketersediaan</p>
                          <p
                            className={`text-[10px] font-bold ${
                              !item.isAvailable
                                ? "text-rose-600"
                                : item.maxPortions < 10
                                ? "text-amber-600"
                                : "text-emerald-600"
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

        {/* ── SISI KANAN: Keranjang & Tagihan (Light) ───────────────────────── */}
        <div className="w-[380px] md:w-[420px] flex flex-col bg-white shrink-0 shadow-lg">
          <div className="p-3 border-b border-slate-200 flex flex-col gap-2 bg-slate-50">
            <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <button
                onClick={() => setOrderType("DINE_IN")}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  orderType === "DINE_IN"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-600 hover:text-slate-900"
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
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Take Away (Bungkus)</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-slate-600 mb-0.5 block">
                  Nomor Meja {orderType === "DINE_IN" && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meja 05"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-600 mb-0.5 block">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pak Dimas"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Receipt className="w-10 h-10 stroke-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Keranjang masih kosong</p>
                <p className="text-[11px] text-slate-400 text-center max-w-[200px]">
                  Sentuh menu di katalog untuk menambahkan pesanan pelanggan.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.cartId}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-1.5 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {item.menuName}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-amber-700 font-bold">
                          {formatCurrency(item.unitPrice)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 uppercase font-semibold">
                          {item.printDestination}
                        </span>
                      </div>
                      {item.variantName && item.variantName !== "Regular" && (
                        <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                          {item.variantName}
                        </p>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-[10px] text-slate-500">
                          {item.modifiers.map((m) => m.name).join(", ")}
                        </p>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Catatan pesanan..."
                    value={item.notes || ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCart((prev) =>
                        prev.map((ci) =>
                          ci.cartId === item.cartId ? { ...ci, notes: text } : ci
                        )
                      );
                    }}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleRemoveFromCart(item.cartId)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title="Hapus Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                      <button
                        onClick={() => handleUpdateQuantity(item.cartId, -1)}
                        className="text-slate-600 hover:text-slate-900 p-0.5"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-900 min-w-[16px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.cartId, 1)}
                        className="text-slate-600 hover:text-slate-900 p-0.5"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Bill Summary & Actions (Light) ──────────────────────────────── */}
          <div className="p-3 border-t border-slate-200 bg-white flex flex-col gap-2 shrink-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} item)</span>
                <span className="text-slate-800 font-semibold">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-500">
                <button
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="text-amber-700 hover:underline flex items-center gap-1 text-[11px] font-semibold"
                >
                  <Percent className="w-3 h-3" />
                  <span>
                    {discountAmount > 0
                      ? `Diskon (${discountType === "PERCENT" ? `${discountValue}%` : "Rp"})`
                      : "+ Tambah Diskon"}
                  </span>
                </button>
                <span className="text-rose-600 font-semibold">
                  {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : "Rp 0"}
                </span>
              </div>

              {taxEnabled && (
                <div className="flex justify-between text-slate-500">
                  <span>
                    PB1 / Pajak Resto ({taxRate}%) [{taxMode}]
                  </span>
                  <span className="text-sky-700 font-semibold">
                    {taxMode === "INCLUSIVE" ? `(Inc) ${formatCurrency(taxAmount)}` : formatCurrency(taxAmount)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Total Tagihan</span>
                <span className="text-xl font-black text-amber-700">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                disabled={cart.length === 0}
                onClick={handleSaveOpenBill}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:pointer-events-none text-slate-700 text-xs font-bold border border-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-amber-600" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-600" />
                Atur Diskon Pesanan
              </h3>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipe Diskon</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setDiscountType("PERCENT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                      discountType === "PERCENT"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Persentase (%)
                  </button>
                  <button
                    onClick={() => setDiscountType("NOMINAL")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                      discountType === "NOMINAL"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
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
                      className="py-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-xs font-bold text-slate-700 border border-slate-200 transition"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  {discountType === "PERCENT" ? "Persentase Diskon (%)" : "Jumlah Nominal Potongan (Rp)"}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  defaultValue={discountValue || ""}
                  id="customDiscountInput"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Alasan Diskon</label>
                <input
                  type="text"
                  placeholder="e.g. Promo Member, Teman Owner, Event"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setDiscountValue(0);
                    setDiscountReason("");
                    setIsDiscountModalOpen(false);
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
                >
                  Hapus Diskon
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("customDiscountInput") as HTMLInputElement;
                    const val = Number(el?.value) || 0;
                    handleApplyDiscount(val, discountType);
                  }}
                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white shadow-xs transition"
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

      {/* Modal Kustomisasi Pesanan (Varian Suhu, Gula, Es, Susu, Topping) */}
      <PosCustomizeModal
        isOpen={!!customizingItem}
        onClose={() => setCustomizingItem(null)}
        item={customizingItem}
        onAddToCartWithCustomization={handleAddToCartWithCustomization}
      />
    </div>
  );
};
