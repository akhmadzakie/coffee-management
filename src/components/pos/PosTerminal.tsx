import React, { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import { getLocalDateString } from "../../utils/dateUtils";
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
  Tag,
  ShieldAlert,
  ShoppingBag,
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
import { PosQuickWasteModal } from "./PosQuickWasteModal";
import { getPendingOfflineOrders, flushOfflineOutbox, subscribeOfflineQueue } from "../../utils/posOfflineQueue";

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
  const { currentUser, settings, shifts, cashAccounts, recipes, logout, users, promotions, syncData } = useStore();

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
  const [appliedPromotionId, setAppliedPromotionId] = useState<string | null>(null);
  const [appliedPromotionName, setAppliedPromotionName] = useState<string | null>(null);
  const [appliedPromoMaxDiscount, setAppliedPromoMaxDiscount] = useState<number | undefined>(undefined);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountModalTab, setDiscountModalTab] = useState<"WHITELIST" | "MANUAL">("WHITELIST");
  const [manualDiscountType, setManualDiscountType] = useState<"PERCENT" | "NOMINAL">("PERCENT");
  const [manualDiscountValue, setManualDiscountValue] = useState<number>(0);
  const [manualDiscountReason, setManualDiscountReason] = useState<string>("");
  const [pendingDiscountType, setPendingDiscountType] = useState<"PERCENT" | "NOMINAL">("PERCENT");
  const [pendingDiscountReason, setPendingDiscountReason] = useState<string>("");

  const todayStr = useMemo(() => getLocalDateString(), []);
  const activeWhitelistPromos = useMemo(() => {
    return (promotions || []).filter((p) => {
      if (!p.isActive) return false;
      if (p.startDate && p.startDate.slice(0, 10) > todayStr) return false;
      if (p.endDate && p.endDate.slice(0, 10) < todayStr) return false;
      return true;
    });
  }, [promotions, todayStr]);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [splitBillConfig, setSplitBillConfig] = useState<{
    isSplit: boolean;
    parentOrderId: string;
    splitMode: "ITEMS" | "EVENLY";
    splitItems: any[];
    splitAmount: number;
  } | null>(null);
  const [isOpenBillsModalOpen, setIsOpenBillsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState<"DISCOUNT" | "VOID">("DISCOUNT");
  const [pendingDiscountValue, setPendingDiscountValue] = useState<number>(0);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isTodayOrdersOpen, setIsTodayOrdersOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isQuickWasteOpen, setIsQuickWasteOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

  // Terminal Lock & Exit Guard
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [lockPin, setLockPin] = useState("");
  const [lockPinError, setLockPinError] = useState("");
  const [isExitAlertOpen, setIsExitAlertOpen] = useState(false);
  const [isExitPinModalOpen, setIsExitPinModalOpen] = useState(false);

  // Active open bills count
  const [activeBillsCount, setActiveBillsCount] = useState<number>(0);
  const [currentEditingOrderId, setCurrentEditingOrderId] = useState<string | null>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen toggle handler for POS
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => { });
      } else {
        document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => { });
      }
    } catch { }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const totalCartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // Active shift (prioritas shift milik user yang sedang aktif atau shift status OPEN apa pun di kasir)
  const activeShift = useMemo(() => {
    return (
      shifts.find((s) => s.status === "OPEN" && (currentUser?.id ? s.userId === currentUser.id : true)) ||
      shifts.find((s) => s.status === "OPEN") ||
      null
    );
  }, [shifts, currentUser]);

  const isManagerOrAdmin = useMemo(() => {
    const r = currentUser?.role;
    return r === "MANAGER" || r === "OWNER" || r === "SUPER_ADMIN";
  }, [currentUser]);

  // Handler unlock terminal (aman dan diverifikasi server dengan rate limiting)
  const handleUnlockTerminal = async (inputPin?: string) => {
    const pinToVerify = inputPin !== undefined ? inputPin : lockPin;
    if (!pinToVerify) {
      setLockPinError("Silakan masukkan PIN.");
      return;
    }

    try {
      const res = await fetch("/api/pos/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinToVerify,
          purpose: "UNLOCK",
          currentUserId: currentUser?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setIsTerminalLocked(false);
        setLockPin("");
        setLockPinError("");
        return;
      }
      setLockPinError(data.error || "PIN tidak sesuai.");
      setLockPin("");
    } catch {
      // Offline fallback jika server/jaringan belum merespons
      const supervisorPin = settings?.posSupervisorPin || "1234";
      const isValid =
        (currentUser?.pin && currentUser.pin === pinToVerify) ||
        pinToVerify === supervisorPin ||
        users.some(
          (u) =>
            (u.role === "MANAGER" || u.role === "SUPER_ADMIN") &&
            u.pin === pinToVerify
        );

      if (isValid) {
        setIsTerminalLocked(false);
        setLockPin("");
        setLockPinError("");
      } else {
        setLockPinError("PIN tidak sesuai. Silakan hubungi Supervisor / Manager.");
        setLockPin("");
      }
    }
  };

  // Keyboard shortcut listener untuk Kunci Layar
  useEffect(() => {
    if (!isTerminalLocked) return;

    const handleLockKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        setLockPin((prev) => (prev.length < 6 ? prev + e.key : prev));
        setLockPinError("");
      } else if (e.key === "Backspace") {
        setLockPin((prev) => prev.slice(0, -1));
        setLockPinError("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleUnlockTerminal();
      }
    };

    window.addEventListener("keydown", handleLockKeyDown);
    return () => window.removeEventListener("keydown", handleLockKeyDown);
  }, [isTerminalLocked, lockPin]);

  const handleExitAttempt = () => {
    if (activeShift) {
      // Masih ada shift aktif, cegah keluar tanpa tutup shift
      setIsExitAlertOpen(true);
      return;
    }

    if (isManagerOrAdmin && onNavigateBack) {
      // Akun Manager/Owner yang sedang mencoba POS, langsung kembali ke dashboard manajemen
      onNavigateBack();
      return;
    }

    // Jika akun yang login adalah Kasir (atau tanpa onNavigateBack),
    // logout agar pengguna dapat login sebagai Owner/Manager di Web Management
    logout();
  };

  // Tax config from settings
  const taxEnabled = settings?.taxEnabled ?? false;
  const taxRate = settings?.taxRate ?? 10;
  const taxMode = settings?.taxMode ?? "EXCLUSIVE";
  const maxCashierDiscount = settings?.maxCashierDiscount ?? 10;

  // Offline PWA state & queue (IndexedDB + localStorage unified)
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

  // Subscribe to IndexedDB outbox queue changes
  useEffect(() => {
    const unsub = subscribeOfflineQueue(async (count) => {
      const pending = await getPendingOfflineOrders();
      setOfflineQueue(pending.map((p) => p.payload));
    });
    // Initial fetch
    getPendingOfflineOrders().then((pending) => {
      if (pending.length > 0) {
        setOfflineQueue(pending.map((p) => p.payload));
      }
    });
    return () => unsub();
  }, []);

  // Sync offline orders to server when back online
  const syncOfflineOrders = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;

    // 1. Flush IndexedDB Outbox
    try {
      const flushResult = await flushOfflineOutbox(async (payload) => {
        const res = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          return { success: true };
        }
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || "Gagal menyimpan pesanan" };
      });
      successCount += flushResult.syncedCount;
    } catch (e) {
      console.warn("Outbox flush warning:", e);
    }

    // 2. Flush legacy localStorage queue if any
    try {
      const saved = localStorage.getItem("coffee_pos_offline_orders");
      const legacyOrders: any[] = saved ? JSON.parse(saved) : [];
      const remainingLegacy: any[] = [];
      for (const offlineOrder of legacyOrders) {
        try {
          const res = await fetch("/api/pos/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(offlineOrder),
          });
          if (res.ok) {
            successCount++;
          } else {
            remainingLegacy.push(offlineOrder);
          }
        } catch {
          remainingLegacy.push(offlineOrder);
        }
      }
      localStorage.setItem("coffee_pos_offline_orders", JSON.stringify(remainingLegacy));
    } catch { }

    // Update remaining count
    const remaining = await getPendingOfflineOrders();
    setOfflineQueue(remaining.map((r) => r.payload));
    setIsSyncing(false);

    if (successCount > 0) {
      alert(`Berhasil menyinkronkan ${successCount} pesanan offline ke server database!`);
      fetchActiveBillsCount();
      syncData?.();
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
          let price = m.price;
          if (!price) {
            price = Math.max(18000, Math.round((m.estimatedHpp * 2.8) / 1000) * 1000);
            if (m.name.toLowerCase().includes("espresso")) price = 15000;
            if (m.name.toLowerCase().includes("croissant")) price = 28000;
          }
          return { ...m, price };
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
        } catch { }
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
      if (typeof document !== "undefined" && !document.hidden) {
        fetchActiveBillsCount();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Otomatis buka popup Buka Shift saat kasir membuka POS jika belum ada shift aktif
  useEffect(() => {
    if (!activeShift) {
      setIsShiftModalOpen(true);
    }
  }, [activeShift]);

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
      let calc = Math.round((subtotal * discountValue) / 100);
      if (appliedPromoMaxDiscount && appliedPromoMaxDiscount > 0 && calc > appliedPromoMaxDiscount) {
        calc = appliedPromoMaxDiscount;
      }
      return calc;
    }
    return Math.min(subtotal, discountValue);
  }, [subtotal, discountType, discountValue, appliedPromoMaxDiscount]);

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
      setAppliedPromotionId(null);
      setAppliedPromotionName(null);
      setAppliedPromoMaxDiscount(undefined);
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
    if (!activeShift) {
      alert("⚠️ Shift Kasir belum dibuka! Silakan buka shift kasir dan masukkan Modal Awal terlebih dahulu.");
      setIsShiftModalOpen(true);
      return;
    }
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
        appliedPromotionId: appliedPromotionId || null,
        appliedPromotionName: appliedPromotionName || null,
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
        setDiscountValue(0);
        setDiscountReason("");
        setAppliedPromotionId(null);
        setAppliedPromotionName(null);
        setAppliedPromoMaxDiscount(undefined);
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
      setAppliedPromotionId(null);
      setAppliedPromotionName(null);
      setAppliedPromoMaxDiscount(undefined);
      setCurrentEditingOrderId(null);
      fetchActiveBillsCount();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleSelectOpenBill = (billOrder: any) => {
    if (billOrder.isSplitBill) {
      setSplitBillConfig({
        isSplit: true,
        parentOrderId: billOrder.parentOrderId,
        splitMode: billOrder.splitMode,
        splitItems: billOrder.splitItems,
        splitAmount: billOrder.totalAmount,
      });
      setCurrentEditingOrderId(null);
      setTableNumber(billOrder.tableNumber || "");
      setCustomerName(billOrder.customerName || "");
      setOrderType(billOrder.orderType);

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
      setIsPaymentModalOpen(true);
      return;
    }

    setSplitBillConfig(null);
    setCurrentEditingOrderId(billOrder.id);
    setOrderType(billOrder.orderType);
    setTableNumber(billOrder.tableNumber || "");
    setCustomerName(billOrder.customerName || "");
    setDiscountValue(billOrder.discountPercent || 0);
    setDiscountType("PERCENT");
    setDiscountReason(billOrder.discountReason || "");
    setAppliedPromotionId(billOrder.appliedPromotionId || null);
    setAppliedPromotionName(billOrder.appliedPromotionName || null);

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

  const renderCartContent = (isDrawer = false) => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Mobile Drawer Header */}
      {isDrawer && (
        <div className="p-3.5 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                Keranjang Pesanan
              </h3>
              <p className="text-[11px] text-slate-500">{totalCartItemCount} item ditambahkan</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileCartOpen(false)}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Order Type & Table/Customer */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2 bg-slate-50 shrink-0">
        <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setOrderType("DINE_IN")}
            className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${orderType === "DINE_IN"
                ? "bg-brand-600 text-white shadow"
                : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Dine In (Makan Sini)</span>
          </button>
          <button
            onClick={() => setOrderType("TAKE_AWAY")}
            className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${orderType === "TAKE_AWAY"
                ? "bg-brand-600 text-white shadow"
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
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10"
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
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
        {cart.length === 0 ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-slate-400 gap-2 py-8">
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
                    <span className="text-[11px] text-brand-700 font-bold">
                      {formatCurrency(item.unitPrice)}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 uppercase font-semibold">
                      {item.printDestination}
                    </span>
                  </div>
                  {item.variantName && item.variantName !== "Regular" && (
                    <p className="text-[10px] text-brand-700 font-medium mt-0.5">
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
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:bg-white"
              />

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleRemoveFromCart(item.cartId)}
                  className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-1"
                  title="Hapus Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => handleUpdateQuantity(item.cartId, -1)}
                    className="text-slate-600 hover:text-slate-900 p-0.5 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-slate-900 min-w-[16px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleUpdateQuantity(item.cartId, 1)}
                    className="text-slate-600 hover:text-slate-900 p-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bill Summary & Actions */}
      <div className="p-3 border-t border-slate-200 bg-white flex flex-col gap-2 shrink-0">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal ({totalCartItemCount} item)</span>
            <span className="text-slate-800 font-semibold">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-500">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setIsDiscountModalOpen(true)}
                className="text-brand-600 hover:underline flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                <Percent className="w-3 h-3" />
                <span>
                  {discountAmount > 0
                    ? `${appliedPromotionName || discountReason || "Diskon"} (${discountType === "PERCENT" ? `${discountValue}%` : "Rp"})`
                    : "+ Tambah Diskon / Promo"}
                </span>
              </button>
              {discountAmount > 0 && (
                <button
                  onClick={() => {
                    setDiscountValue(0);
                    setDiscountReason("");
                    setAppliedPromotionId(null);
                    setAppliedPromotionName(null);
                    setAppliedPromoMaxDiscount(undefined);
                  }}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer"
                  title="Hapus Diskon"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
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
            <span className="text-xl font-black text-brand-700">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            disabled={cart.length === 0}
            onClick={() => {
              handleSaveOpenBill();
              if (isDrawer) setIsMobileCartOpen(false);
            }}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:pointer-events-none text-slate-700 text-xs font-bold border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-brand-600" />
            <span>Simpan Bill Meja</span>
          </button>

          <button
            disabled={cart.length === 0}
            onClick={() => {
              if (!activeShift) {
                alert("⚠️ Shift Kasir belum dibuka! Silakan masukkan Modal Awal Laci Kasir terlebih dahulu.");
                setIsShiftModalOpen(true);
                return;
              }
              setIsPaymentModalOpen(true);
              if (isDrawer) setIsMobileCartOpen(false);
            }}
            className={`py-2.5 px-3 rounded-xl ${
              activeShift
                ? "bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-lg shadow-brand-600/20"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            } disabled:opacity-50 disabled:pointer-events-none text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer`}
          >
            {activeShift ? (
              <>
                <Banknote className="w-4 h-4" />
                <span>Bayar Sekarang</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-200" />
                <span>Buka Shift Dahulu</span>
              </>
            )}
          </button>
        </div>

        {cart.length > 0 && (
          <button
            onClick={handleClearCart}
            className="w-full text-center text-[10px] text-slate-500 hover:text-rose-500 transition py-1 cursor-pointer"
          >
            Kosongkan Keranjang
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] md:h-[calc(100vh-1rem)] lg:h-[calc(100vh-2rem)] w-full bg-slate-100 text-slate-800 rounded-none md:rounded-2xl overflow-hidden shadow-xl border-0 md:border md:border-slate-200 select-none relative">
      {/* ── Top Bar Kasir (Light & Adaptive for Mobile, Tablet, & Monitor) ── */}
      <div className="min-h-14 py-2 px-3 sm:px-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 shadow-xs">
        {/* Top Bar Row 1: Logo, Title, Shift & Mobile Cart Trigger */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img
              src="/logo-icon-color.png"
              alt="Julia's"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-xs border border-brand-200 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2 truncate">
                <span>Julia's</span>
                <span className="text-[11px] font-normal text-slate-400">|</span>
                <span className="text-xs font-semibold text-slate-600">POS Kasir</span>
                {currentEditingOrderId && (
                  <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 border border-brand-200 font-bold shrink-0">
                    Edit Bill
                  </span>
                )}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span>Terminal: <strong className="text-slate-800">{currentUser?.name || "POS"}</strong></span>
                {activeShift ? (
                  <button
                    onClick={() => setIsShiftModalOpen(true)}
                    className="ml-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1 transition text-[10px] sm:text-[11px] font-bold cursor-pointer"
                    title="Ringkasan shift aktif / tutup shift"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Shift Aktif</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsShiftModalOpen(true)}
                    className="ml-1 px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 inline-flex items-center gap-1 transition animate-bounce text-[10px] sm:text-[11px] font-bold cursor-pointer"
                    title="Buka shift kasir"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Buka Shift</span>
                  </button>
                )}
              </p>
            </div>
          </div>

          {/* Mobile Cart Trigger Button (< lg) */}
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold text-xs shadow-md transition shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Pesanan ({totalCartItemCount})</span>
          </button>
        </div>

        {/* Action Buttons Top Bar (Swipeable on Mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar pb-0.5">
          {/* Status Koneksi Online / Offline & Sync Queue */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition shadow-2xs bg-slate-50 border-slate-200 shrink-0">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-700">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] whitespace-nowrap">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-800">
                <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] whitespace-nowrap">Offline</span>
              </span>
            )}

            {offlineQueue.length > 0 && (
              <button
                onClick={syncOfflineOrders}
                disabled={!isOnline || isSyncing}
                className="whitespace-nowrap shrink-0 ml-1 px-2 py-0.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-black text-[10px] shadow-xs flex items-center gap-1 transition animate-pulse cursor-pointer"
                title="Klik untuk menyinkronkan antrean pesanan offline ke server"
              >
                <RotateCcw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync {offlineQueue.length} Order</span>
              </button>
            )}
          </div>

          {/* Catat Kalibrasi / Waste Barista */}
          <button
            onClick={() => setIsQuickWasteOpen(true)}
            className="whitespace-nowrap shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 border border-amber-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Catat Kalibrasi Espresso, Susu Tumpah, atau Minuman Salah Buat"
          >
            <Coffee className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="hidden sm:inline">Kalibrasi & Waste</span>
          </button>

          {/* Riwayat Transaksi Hari Ini & Refund */}
          <button
            onClick={() => setIsTodayOrdersOpen(true)}
            className="whitespace-nowrap shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
            title="Riwayat Transaksi Hari Ini, Cetak Ulang & Refund"
          >
            <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="hidden sm:inline">Riwayat & Refund</span>
          </button>

          {/* Open Bill Meja */}
          <button
            onClick={() => setIsOpenBillsModalOpen(true)}
            className="whitespace-nowrap shrink-0 relative px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="hidden sm:inline">Open Bill</span>
            {activeBillsCount > 0 && (
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                {activeBillsCount}
              </span>
            )}
          </button>

          {/* Printer Settings */}
          <button
            onClick={() => setIsPrinterSettingsOpen(true)}
            title="Pengaturan Printer Thermal"
            className="whitespace-nowrap shrink-0 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-sky-600" />
          </button>

          {/* Refresh Menu */}
          <button
            onClick={fetchMenu}
            title="Refresh Stok Menu"
            className="whitespace-nowrap shrink-0 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="whitespace-nowrap shrink-0 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
            title={isFullscreen ? "Keluar Layar Penuh" : "Mode Layar Penuh"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Kunci Layar POS */}
          <button
            onClick={() => setIsTerminalLocked(true)}
            className="whitespace-nowrap shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Kunci Layar Kasir Sementara (Istirahat / Ganti Kasir)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="hidden sm:inline">Kunci</span>
          </button>

          {/* Keluar / Kembali / Ganti Akun */}
          <button
            onClick={handleExitAttempt}
            className="whitespace-nowrap shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-semibold text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
            title={isManagerOrAdmin && onNavigateBack ? "Kembali ke Dashboard Manajemen" : "Keluar dari Akun Kasir / Ganti Akun"}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>{isManagerOrAdmin && onNavigateBack ? "Kembali ke Web" : "Keluar / Ganti Akun"}</span>
          </button>
        </div>
      </div>

      {/* ── Main Body Split Layout ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── SISI KIRI: Katalog Menu & Pencarian (Light) ──────────────────── */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50 overflow-hidden pb-16 lg:pb-0">
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
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Pills with Sliding Indicator */}
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
                    className="relative px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {isSelected ? (
                      <motion.div
                        layoutId="posCategoryPill"
                        className="absolute inset-0 bg-brand-600 rounded-xl shadow-md shadow-brand-600/20 z-0"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl z-0 transition-colors" />
                    )}
                    <span
                      className={`relative z-10 flex items-center gap-1.5 transition-colors ${isSelected ? "text-white font-bold" : "text-slate-700"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Grid (Responsive 2 to 4 cols) */}
          <div className="flex-1 overflow-y-auto p-3">
            {!activeShift && (
              <div className="mb-3 p-3 sm:p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-950">Shift Kasir Belum Dibuka</p>
                    <p className="text-[11px] text-amber-800">
                      Harap masukkan <strong>Modal Awal Kasir</strong> untuk mengaktifkan proses transaksi dan pembayaran.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShiftModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Buka Shift Kasir Sekarang</span>
                </button>
              </div>
            )}

            {isLoadingMenu ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <RotateCcw className="w-6 h-6 animate-spin text-brand-600" />
                <p className="text-xs">Memuat katalog menu & ketersediaan stok...</p>
              </div>
            ) : filteredMenu.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Coffee className="w-8 h-8 stroke-1 text-slate-300" />
                <p className="text-xs">Tidak ada menu yang sesuai dengan filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredMenu.map((item) => {
                  const inCartQty = cart
                    .filter((ci) => ci.recipeId === item.id)
                    .reduce((sum, ci) => sum + ci.quantity, 0);

                  return (
                    <motion.div
                      key={item.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAddToCart(item)}
                      className={`relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-xs ${!item.isAvailable
                          ? "bg-slate-100/60 border-slate-200 opacity-60 grayscale"
                          : inCartQty > 0
                            ? "bg-brand-50/50 border-brand-500 shadow-md ring-1 ring-brand-400"
                            : "bg-white border-slate-200/80 hover:border-brand-300 hover:shadow-md"
                        }`}
                    >
                      {inCartQty > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center shadow-md">
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
                              className="px-2 py-0.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 flex items-center gap-1 text-[9px] font-bold transition cursor-pointer"
                              title="Kustomisasi suhu, gula, es, susu, dan add-on"
                            >
                              <Sliders className="w-3 h-3 text-brand-600" />
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
                          <p className="text-xs font-bold text-brand-700">
                            {formatCurrency(item.price || 0)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400">Ketersediaan</p>
                          <p
                            className={`text-[10px] font-bold ${!item.isAvailable
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

        {/* ── SISI KANAN: Keranjang Desktop / Layar Lebar ───────────────────── */}
        <div className="hidden lg:flex w-[360px] xl:w-[420px] flex-col bg-white shrink-0 shadow-lg border-l border-slate-200">
          {renderCartContent(false)}
        </div>
      </div>

      {/* ── Floating Bottom Bar for Mobile (< lg) ─────────────────────────── */}
      {cart.length > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {totalCartItemCount}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Total Tagihan ({cart.length} menu)
              </p>
              <p className="text-base font-black text-white font-mono truncate">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition shrink-0 cursor-pointer"
          >
            <span>Lihat Pesanan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Slide-up Mobile Cart Drawer / Bottom Sheet (< lg) ─────────────── */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileCartOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative w-full max-h-[92dvh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {renderCartContent(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modals & Popups ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <PosPaymentModal
            totalAmount={splitBillConfig?.isSplit ? splitBillConfig.splitAmount : totalAmount}
            subtotal={splitBillConfig?.isSplit ? splitBillConfig.splitAmount : subtotal}
            discountAmount={splitBillConfig?.isSplit ? 0 : discountAmount}
            taxAmount={splitBillConfig?.isSplit ? 0 : taxAmount}
            taxPercent={taxEnabled ? taxRate : 0}
            taxMode={taxMode}
            tableNumber={tableNumber}
            customerName={customerName}
            orderType={orderType}
            cart={cart}
            orderNotes={orderNotes}
            discountReason={discountReason}
            discountPercent={discountType === "PERCENT" ? discountValue : 0}
            appliedPromotionId={appliedPromotionId}
            appliedPromotionName={appliedPromotionName}
            editingOrderId={currentEditingOrderId}
            isSplitPayment={splitBillConfig?.isSplit}
            splitParentOrderId={splitBillConfig?.parentOrderId}
            splitMode={splitBillConfig?.splitMode}
            splitItems={splitBillConfig?.splitItems}
            onClose={() => {
              setIsPaymentModalOpen(false);
              setSplitBillConfig(null);
            }}
            onSuccess={(paidOrder) => {
              setIsPaymentModalOpen(false);
              setSplitBillConfig(null);
              setCompletedOrder(paidOrder);
              setIsReceiptModalOpen(true);
              setCart([]);
              setTableNumber("");
              setCustomerName("");
              setDiscountValue(0);
              setDiscountReason("");
              setAppliedPromotionId(null);
              setAppliedPromotionName(null);
              setAppliedPromoMaxDiscount(undefined);
              setCurrentEditingOrderId(null);
              fetchActiveBillsCount();
              syncData().catch(() => {});
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
      </AnimatePresence>

      {isPinModalOpen && (
        <PosManagerPinModal
          title={pinActionType === "DISCOUNT" ? "Otorisasi Diskon Khusus" : "Otorisasi Void Transaksi"}
          description={
            pinActionType === "DISCOUNT"
              ? `Diskon manual khusus (${pendingDiscountType === "PERCENT" ? `${pendingDiscountValue}%` : `Rp ${pendingDiscountValue.toLocaleString("id-ID")}`}) memerlukan otorisasi PIN Manager/Owner.`
              : "Pembatalan / VOID transaksi memerlukan otorisasi Manager."
          }
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={(manager) => {
            setIsPinModalOpen(false);
            if (pinActionType === "DISCOUNT") {
              setDiscountType(pendingDiscountType);
              setDiscountValue(pendingDiscountValue);
              setDiscountReason(pendingDiscountReason || `Diskon Manual (${manager.name})`);
              setAppliedPromotionId(null);
              setAppliedPromotionName(`Diskon Manual (${manager.name})`);
              setAppliedPromoMaxDiscount(undefined);
              setIsDiscountModalOpen(false);
              alert(`Diskon manual berhasil disetujui oleh: ${manager.name}`);
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

      {isQuickWasteOpen && (
        <PosQuickWasteModal
          isOpen={isQuickWasteOpen}
          onClose={() => setIsQuickWasteOpen(false)}
          defaultReason="KALIBRASI_PAGI"
        />
      )}

      {isPrinterSettingsOpen && (
        <PosPrinterSettingsModal onClose={() => setIsPrinterSettingsOpen(false)} />
      )}

      {isTodayOrdersOpen && (
        <PosTodayOrdersModal onClose={() => setIsTodayOrdersOpen(false)} />
      )}

      <AnimatePresence>
        {isDiscountModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDiscountModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 28, stiffness: 360 }}
              className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-brand-100 text-brand-700 rounded-xl">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Promo & Diskon Kasir
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih promo whitelist aktif atau otorisasi diskon manual
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Subtotal Indicator Banner */}
              <div className="mt-3 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-600 font-medium">Subtotal Belanja Saat Ini:</span>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>

              {/* Tab Navigation */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl my-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setDiscountModalTab("WHITELIST")}
                  className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${discountModalTab === "WHITELIST"
                      ? "bg-white text-brand-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Promo Whitelist ({activeWhitelistPromos.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountModalTab("MANUAL")}
                  className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${discountModalTab === "MANUAL"
                      ? "bg-white text-amber-800 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Diskon Manual (PIN)</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="overflow-y-auto space-y-3 pr-1 flex-1">
                {discountModalTab === "WHITELIST" ? (
                  /* ── TAB 1: WHITELIST PROMOTIONS ── */
                  activeWhitelistPromos.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                      <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">Tidak Ada Promo Aktif</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        Manager belum mengaktifkan promo whitelist atau semua masa berlaku promo telah lewat di menu Promo & Diskon.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeWhitelistPromos.map((promo) => {
                        const isEligible = !promo.minSpend || subtotal >= promo.minSpend;
                        const isSelected = appliedPromotionId === promo.id;

                        return (
                          <div
                            key={promo.id}
                            className={`p-3.5 rounded-2xl border transition-all ${isSelected
                                ? "bg-brand-50/70 border-brand-400 shadow-xs ring-1 ring-brand-300"
                                : isEligible
                                  ? "bg-white border-slate-200 hover:border-brand-200 hover:bg-slate-50/80"
                                  : "bg-slate-50 border-slate-200/60 opacity-60"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{promo.name}</span>
                                  {promo.code && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded border border-slate-200">
                                      {promo.code}
                                    </span>
                                  )}
                                </div>
                                {promo.description && (
                                  <p className="text-xs text-slate-500">{promo.description}</p>
                                )}
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap pt-0.5">
                                  {promo.minSpend && promo.minSpend > 0 ? (
                                    <span>Min. Belanja: <strong>Rp {promo.minSpend.toLocaleString("id-ID")}</strong></span>
                                  ) : (
                                    <span className="text-emerald-700 font-semibold">Tanpa Min. Belanja</span>
                                  )}
                                  {promo.type === "PERCENT" && promo.maxDiscount && promo.maxDiscount > 0 && (
                                    <span>• Maks: <strong>Rp {promo.maxDiscount.toLocaleString("id-ID")}</strong></span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${promo.type === "PERCENT"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-blue-100 text-blue-800"
                                    }`}
                                >
                                  {promo.type === "PERCENT" ? `${promo.value}% OFF` : `-Rp ${promo.value.toLocaleString("id-ID")}`}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                              {!isEligible ? (
                                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Kurang Rp {((promo.minSpend || 0) - subtotal).toLocaleString("id-ID")} lagi</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Memenuhi syarat promo</span>
                                </span>
                              )}

                              {isSelected ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDiscountValue(0);
                                    setDiscountReason("");
                                    setAppliedPromotionId(null);
                                    setAppliedPromotionName(null);
                                    setAppliedPromoMaxDiscount(undefined);
                                    setIsDiscountModalOpen(false);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Lepas Promo</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!isEligible}
                                  onClick={() => {
                                    setDiscountType(promo.type);
                                    setDiscountValue(promo.value);
                                    setDiscountReason(promo.name);
                                    setAppliedPromotionId(promo.id);
                                    setAppliedPromotionName(promo.name);
                                    setAppliedPromoMaxDiscount(promo.maxDiscount);
                                    setIsDiscountModalOpen(false);
                                  }}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${isEligible
                                      ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    }`}
                                >
                                  Pilih Promo
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* ── TAB 2: MANUAL DISCOUNT WITH MANAGER PIN ── */
                  <div className="space-y-4 pt-1">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800 leading-relaxed">
                        <strong className="text-amber-900 block mb-0.5">Wajib Otorisasi PIN Manager:</strong>
                        Kasir dilarang menginput diskon manual secara bebas. Pastikan Manager atau Supervisor telah menyetujui nominal & alasan diskon ini.
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block">Tipe Diskon Manual</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setManualDiscountType("PERCENT")}
                          className={`py-1.5 text-xs font-bold rounded-lg transition ${manualDiscountType === "PERCENT"
                              ? "bg-white text-slate-900 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          Persentase (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualDiscountType("NOMINAL")}
                          className={`py-1.5 text-xs font-bold rounded-lg transition ${manualDiscountType === "NOMINAL"
                              ? "bg-white text-slate-900 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          Nominal (Rp)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                        {manualDiscountType === "PERCENT" ? "Persentase Diskon (%)" : "Jumlah Potongan (Rp)"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={manualDiscountType === "PERCENT" ? 100 : undefined}
                        placeholder={manualDiscountType === "PERCENT" ? "e.g. 15" : "e.g. 25000"}
                        value={manualDiscountValue || ""}
                        onChange={(e) => setManualDiscountValue(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                        Alasan Diskon Khusus <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Komplain Pesanan, Kerabat Owner, Event Khusus"
                        value={manualDiscountReason}
                        onChange={(e) => setManualDiscountReason(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Alasan wajib dicantumkan dalam audit log transaksi.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!manualDiscountValue || manualDiscountValue <= 0) {
                          alert("Masukkan nilai diskon yang valid.");
                          return;
                        }
                        if (!manualDiscountReason.trim()) {
                          alert("Alasan diskon wajib diisi untuk otorisasi Manager.");
                          return;
                        }
                        setPendingDiscountValue(manualDiscountValue);
                        setPendingDiscountType(manualDiscountType);
                        setPendingDiscountReason(manualDiscountReason.trim());
                        setPinActionType("DISCOUNT");
                        setIsPinModalOpen(true);
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Minta Otorisasi PIN Manager</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                {discountAmount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountValue(0);
                      setDiscountReason("");
                      setAppliedPromotionId(null);
                      setAppliedPromotionName(null);
                      setAppliedPromoMaxDiscount(undefined);
                      setIsDiscountModalOpen(false);
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Semua Diskon</span>
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ── Dialog Konfirmasi Tutup Shift Sebelum Keluar (Exit Guard) ─── */}
      <AnimatePresence>
        {isExitAlertOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">
                  Shift Kasir Masih Aktif!
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Terminal kasir masih memiliki sesi shift berjalan atas penanggung jawab{" "}
                  <strong className="text-slate-900">{activeShift?.picEmployeeName || "Kasir"}</strong>.
                  Untuk mencegah selisih fisik laci dan uang kas hilang tanpa jejak, harap lakukan Tutup Shift (Z-Report) terlebih dahulu sebelum meninggalkan POS.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    setIsExitAlertOpen(false);
                    setIsShiftModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tutup Shift Sekarang (Hitung Kas & Z-Report)</span>
                </button>

                <button
                  onClick={() => {
                    setIsExitAlertOpen(false);
                    setIsExitPinModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Otorisasi Manager untuk Keluar Darurat</span>
                </button>

                <button
                  onClick={() => setIsExitAlertOpen(false)}
                  className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-600 font-medium transition cursor-pointer"
                >
                  Batal, Tetap di POS
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Otorisasi PIN Manager untuk Keluar POS ─────────────── */}
      {isExitPinModalOpen && (
        <PosManagerPinModal
          title="Otorisasi Keluar Terminal POS"
          description="Masukkan PIN Manager / Owner untuk mengizinkan keluar dari layar kasir POS."
          onClose={() => setIsExitPinModalOpen(false)}
          onSuccess={() => {
            setIsExitPinModalOpen(false);
            if (onNavigateBack) onNavigateBack();
            else logout();
          }}
        />
      )}

      {/* ── Modal Otorisasi PIN Manager untuk Diskon Khusus Manual ─── */}
      {isPinModalOpen && (
        <PosManagerPinModal
          title={`Otorisasi Diskon Khusus (${pendingDiscountType === "PERCENT" ? `${pendingDiscountValue}%` : formatCurrency(pendingDiscountValue)})`}
          description={`Kasir mengajukan diskon manual dengan alasan: "${pendingDiscountReason || 'Diskon Khusus'}". Masukkan PIN Manager untuk menyetujui.`}
          requireReason={false}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={(manager) => {
            setIsPinModalOpen(false);
            setDiscountType(pendingDiscountType);
            setDiscountValue(pendingDiscountValue);
            setDiscountReason(pendingDiscountReason || `Diskon Khusus (Disetujui ${manager.name})`);
            setAppliedPromotionId(null);
            setAppliedPromotionName(null);
            setAppliedPromoMaxDiscount(undefined);
            setIsDiscountModalOpen(false);
            alert(`Diskon khusus berhasil disetujui oleh Manager (${manager.name}).`);
          }}
        />
      )}

      {/* ── Overlay Kunci Layar POS (Terminal Lock Screen) ────────────── */}
      <AnimatePresence>
        {isTerminalLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-70 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
            >
              {/* Logo / Badge */}
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-inner">
                  <Lock className="w-8 h-8 text-amber-600 animate-pulse" />
                </div>
              </div>

              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Terminal Kasir Terkunci
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan PIN Kasir / Manager untuk membuka kembali
              </p>

              {/* Status Shift & PIC */}
              <div className="mt-3 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>PIC: <strong>{activeShift?.picEmployeeName || currentUser?.name || "Staff"}</strong></span>
              </div>

              {/* PIN Indicator Dots */}
              <div className="flex items-center justify-center gap-3 my-5">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${lockPin.length > idx
                        ? "bg-brand-600 scale-110 shadow-xs shadow-brand-500/50"
                        : "bg-slate-200"
                      }`}
                  />
                ))}
              </div>

              {/* Error Message */}
              {lockPinError && (
                <div className="mb-3 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{lockPinError}</span>
                </div>
              )}

              {/* Tactile Keypad (3x4 Grid) */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (lockPin.length < 6) {
                        const next = lockPin + num;
                        setLockPin(next);
                        setLockPinError("");
                      }
                    }}
                    className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold text-lg border border-slate-200 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setLockPin("");
                    setLockPinError("");
                  }}
                  className="h-13 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lockPin.length < 6) {
                      setLockPin((prev) => prev + "0");
                      setLockPinError("");
                    }
                  }}
                  className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold text-lg border border-slate-200 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLockPin((prev) => prev.slice(0, -1));
                    setLockPinError("");
                  }}
                  className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              {/* Tombol Buka Kunci */}
              <button
                type="button"
                onClick={() => handleUnlockTerminal()}
                disabled={lockPin.length < 4}
                className="w-full max-w-[260px] mt-4 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Buka Kunci Layar</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
