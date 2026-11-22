import { RupiahSign } from './common/RupiahSign';
import { FEATURES } from "../config/features";
import { mapSalesRows } from "../utils/salesImportMapper";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { getLocalDateString } from "../utils/dateUtils";
import { DailySalesRecap } from "../types";
import {
  Upload,
  Search,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Store,
  Calendar,
  Receipt,
  Eye,
  Filter,
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
  X,
  Printer,
  ChevronDown,
  Plus,
  Trash2,
  Smartphone,
  Building2,
  TrendingUp,
  Sparkles,
  Clock,
  User,
  Coffee,
  Lock,
  Utensils,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  Users,
  ShieldAlert,
  Edit2,
  ArrowLeftRight,
  Landmark,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "../utils/format";
import { CsvImportExport } from "./common/CsvImportExport";
import { ConfirmModal } from "./common/ConfirmModal";
import { exportDailySalesRecapToXlsx, exportSalesToXlsx } from "../utils/exportXlsx";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CurrencyInput } from "./common/CurrencyInput";
import { CustomDatePicker } from "./common/CustomDatePicker";
import { CustomSelect } from "./common/CustomSelect";
import { PosManagerPinModal } from "./pos/PosManagerPinModal";

interface PosOrderDetail {
  id: string;
  receiptNo: string;
  orderType: string;
  tableNumber?: string | null;
  customerName?: string | null;
  status: string;
  subtotal: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  taxMode?: string | null;
  totalAmount: number;
  notes?: string | null;
  cashierName?: string | null;
  voidReason?: string | null;
  voidApprovedBy?: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    menuName: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    modifiers?: any;
    notes?: string | null;
  }>;
  payments?: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    cashReceived?: number | null;
    changeAmount?: number | null;
    referenceNo?: string | null;
  }>;
}

export const Sales = () => {
  const {
    salesTransactions,
    salesImportLogs,
    dailySalesRecaps = [],
    addDailySalesRecap,
    updateDailySalesRecap,
    settleDailySalesRecapNonCash,
    deleteDailySalesRecap,
    cashAccounts = [],
    addCashTransaction,
    syncData,
    currentUser,
    settings,
    products,
    addSalesTransactions,
    isReadOnly,
    closedPeriods = [],
    shifts = [],
  } = useStore();

  const isPeriodClosed = (dateStr: string) => {
    if (!dateStr) return false;
    const period = dateStr.slice(0, 7);
    return closedPeriods.some((p) => p.period === period);
  };

  const isOwner = currentUser?.role === "OWNER" || isReadOnly;
  const [activeTab, setActiveTab] = useState<"cashier_analytics" | "daily_recap" | "pos_orders" | "sales" | "logs">(FEATURES.POS ? "cashier_analytics" : "daily_recap");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCashAccountId =
    cashAccounts.find((a) => a.type === "CASH")?.id || cashAccounts[0]?.id || "";
  const defaultBankAccountId =
    cashAccounts.find((a) => a.type === "BANK")?.id || cashAccounts[0]?.id || "";

  // State untuk Input / Edit Omzet Harian
  const [isAddRecapOpen, setIsAddRecapOpen] = useState(false);
  const [editingRecapId, setEditingRecapId] = useState<string | null>(null);
  const [showOptionalRecapFields, setShowOptionalRecapFields] = useState(false);
  const [recapForm, setRecapForm] = useState({
    date: getLocalDateString(),
    shift: "ALL" as "ALL" | "PAGI" | "MIDDLE" | "SORE" | "MALAM",
    cashAmount: "",
    qrisAmount: "",
    edcAmount: "",
    transferAmount: "",
    onlineDeliveryAmount: "",
    discountAmount: "",
    refundAmount: "",
    mdrFeeAmount: "",
    cashAccountId: "",
    bankAccountId: "",
    nonCashSettlementStatus: "SETTLED" as "SETTLED" | "PENDING",
    notes: "",
  });
  const [recapDateFilter, setRecapDateFilter] = useState<string>("");
  const [confirmDeleteRecap, setConfirmDeleteRecap] = useState<{
    id: string;
    date: string;
    amount: number;
  } | null>(null);
  const [settlingRecap, setSettlingRecap] = useState<DailySalesRecap | null>(null);
  const [settleForm, setSettleForm] = useState({
    bankAccountId: "",
    mdrFeeAmount: "",
    settledDate: getLocalDateString(),
  });
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    date: getLocalDateString(),
    amount: "",
    notes: "",
  });

  // State untuk Tab Transaksi Kasir POS
  const [posOrders, setPosOrders] = useState<PosOrderDetail[]>([]);
  const [isLoadingPosOrders, setIsLoadingPosOrders] = useState(false);
  const [posStatusFilter, setPosStatusFilter] = useState<string>("ALL");
  const [posStartDate, setPosStartDate] = useState<string>("");
  const [posEndDate, setPosEndDate] = useState<string>("");
  const [posSearchQuery, setPosSearchQuery] = useState<string>("");
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<PosOrderDetail | null>(null);
  const [isRefundPinModalOpen, setIsRefundPinModalOpen] = useState(false);

  // Perhitungan Rekap Omzet Harian
  const filteredRecaps = useMemo(() => {
    let list = [...dailySalesRecaps];
    if (recapDateFilter) {
      list = list.filter((r) => r.date.startsWith(recapDateFilter));
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailySalesRecaps, recapDateFilter]);

  const recapSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCash = 0;
    let totalQris = 0;
    let totalEdc = 0;
    let totalTransfer = 0;
    let totalOnlineDelivery = 0;
    let totalPendingNonCash = 0;
    let pendingCount = 0;

    filteredRecaps.forEach((r) => {
      totalRevenue += Number(r.totalAmount) || 0;
      totalCash += Number(r.cashAmount) || 0;
      const qris = Number(r.qrisAmount) || 0;
      const edc = Number(r.edcAmount) || 0;
      const tf = Number(r.transferAmount) || 0;
      const online = Number(r.onlineDeliveryAmount) || 0;
      totalQris += qris;
      totalEdc += edc;
      totalTransfer += tf;
      totalOnlineDelivery += online;
      if (r.nonCashSettlementStatus === "PENDING") {
        totalPendingNonCash += qris + edc + tf + online;
        pendingCount++;
      }
    });

    return {
      totalRevenue,
      totalCash,
      totalQris,
      totalEdc,
      totalTransfer,
      totalOnlineDelivery,
      totalPendingNonCash,
      pendingCount,
      count: filteredRecaps.length,
    };
  }, [filteredRecaps]);

  const currentFormTotal =
    (Number(recapForm.cashAmount) || 0) +
    (Number(recapForm.qrisAmount) || 0) +
    (Number(recapForm.edcAmount) || 0) +
    (Number(recapForm.transferAmount) || 0) +
    (Number(recapForm.onlineDeliveryAmount) || 0);

  const currentNonCashTotal =
    (Number(recapForm.qrisAmount) || 0) +
    (Number(recapForm.edcAmount) || 0) +
    (Number(recapForm.transferAmount) || 0) +
    (Number(recapForm.onlineDeliveryAmount) || 0);

  const openNewRecapModal = () => {
    setEditingRecapId(null);
    setShowOptionalRecapFields(false);
    setRecapForm({
      date: getLocalDateString(),
      shift: "ALL",
      cashAmount: "",
      qrisAmount: "",
      edcAmount: "",
      transferAmount: "",
      onlineDeliveryAmount: "",
      discountAmount: "",
      refundAmount: "",
      mdrFeeAmount: "",
      cashAccountId: defaultCashAccountId,
      bankAccountId: defaultBankAccountId,
      nonCashSettlementStatus: "SETTLED",
      notes: "",
    });
    setIsAddRecapOpen(true);
  };

  const openEditRecapModal = (item: DailySalesRecap) => {
    setEditingRecapId(item.id);
    const hasOptional =
      Boolean(item.discountAmount) ||
      Boolean(item.refundAmount) ||
      Boolean(item.mdrFeeAmount) ||
      item.nonCashSettlementStatus === "PENDING";
    setShowOptionalRecapFields(hasOptional);
    setRecapForm({
      date: item.date,
      shift: (item.shift as any) || "ALL",
      cashAmount: item.cashAmount ? String(item.cashAmount) : "",
      qrisAmount: item.qrisAmount ? String(item.qrisAmount) : "",
      edcAmount: item.edcAmount ? String(item.edcAmount) : "",
      transferAmount: item.transferAmount ? String(item.transferAmount) : "",
      onlineDeliveryAmount: item.onlineDeliveryAmount ? String(item.onlineDeliveryAmount) : "",
      discountAmount: item.discountAmount ? String(item.discountAmount) : "",
      refundAmount: item.refundAmount ? String(item.refundAmount) : "",
      mdrFeeAmount: item.mdrFeeAmount ? String(item.mdrFeeAmount) : "",
      cashAccountId: item.cashAccountId || defaultCashAccountId,
      bankAccountId: item.bankAccountId || defaultBankAccountId,
      nonCashSettlementStatus: item.nonCashSettlementStatus || "SETTLED",
      notes: item.notes || "",
    });
    setIsAddRecapOpen(true);
  };

  const openSettleModal = (item: DailySalesRecap) => {
    setSettlingRecap(item);
    setSettleForm({
      bankAccountId: item.bankAccountId || defaultBankAccountId,
      mdrFeeAmount: item.mdrFeeAmount ? String(item.mdrFeeAmount) : "",
      settledDate: getLocalDateString(),
    });
  };

  const openDepositModal = () => {
    const firstCash = cashAccounts.find((a) => a.type === "CASH")?.id || cashAccounts[0]?.id || "";
    const firstBank =
      cashAccounts.find((a) => a.type === "BANK" && a.id !== firstCash)?.id ||
      cashAccounts.find((a) => a.id !== firstCash)?.id ||
      firstCash;
    setDepositForm({
      fromAccountId: firstCash,
      toAccountId: firstBank,
      date: getLocalDateString(),
      amount: "",
      notes: "Setoran uang tunai kasir ke rekening bank",
    });
    setIsDepositModalOpen(true);
  };

  const handleSaveRecap = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentFormTotal <= 0) {
      toast.warning("Total omzet harus lebih besar dari Rp 0.");
      return;
    }

    if (isPeriodClosed(recapForm.date)) {
      toast.error(
        `Periode bulan ${recapForm.date.slice(0, 7)} sudah ditutup buku. Pencatatan omzet pada periode terkunci tidak diizinkan.`
      );
      return;
    }

    const existingRecap = dailySalesRecaps.find(
      (r) => r.id !== editingRecapId && r.date === recapForm.date && r.shift === recapForm.shift
    );
    if (existingRecap) {
      toast.warning(
        `Rekap omzet tanggal ${recapForm.date} untuk shift "${recapForm.shift}" sudah tercatat (${formatCurrency(existingRecap.totalAmount)}). Edit entri tersebut untuk mencegah duplikasi.`
      );
      return;
    }

    const posPaidOnDate = posOrders.filter(
      (o) => o.createdAt.startsWith(recapForm.date) && o.status === "PAID"
    );
    if (!editingRecapId && posPaidOnDate.length > 0) {
      const posTotalRevenue = posPaidOnDate.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const proceed = window.confirm(
        `⚠️ Peringatan Risiko Double Count:\n\n` +
        `Sistem mendeteksi ada transaksi kasir POS langsung senilai ${formatCurrency(posTotalRevenue)} (${posPaidOnDate.length} order lunas) pada tanggal ${recapForm.date}.\n\n` +
        `Tetap simpan rekap omzet manual ini?`
      );
      if (!proceed) return;
    }

    const payload = {
      date: recapForm.date,
      shift: recapForm.shift,
      cashAmount: Math.round(Number(recapForm.cashAmount) || 0),
      qrisAmount: Math.round(Number(recapForm.qrisAmount) || 0),
      edcAmount: Math.round(Number(recapForm.edcAmount) || 0),
      transferAmount: Math.round(Number(recapForm.transferAmount) || 0),
      onlineDeliveryAmount: Math.round(Number(recapForm.onlineDeliveryAmount) || 0),
      discountAmount: Math.round(Number(recapForm.discountAmount) || 0),
      refundAmount: Math.round(Number(recapForm.refundAmount) || 0),
      mdrFeeAmount: Math.round(Number(recapForm.mdrFeeAmount) || 0),
      totalAmount: Math.round(currentFormTotal),
      cashAccountId: recapForm.cashAccountId || defaultCashAccountId || null,
      bankAccountId: recapForm.bankAccountId || defaultBankAccountId || null,
      nonCashSettlementStatus:
        currentNonCashTotal > 0 ? recapForm.nonCashSettlementStatus : ("SETTLED" as const),
      notes: recapForm.notes.trim() || undefined,
      recordedBy: currentUser?.name || "Kasir / Finance",
    };

    if (editingRecapId) {
      const prevRec = dailySalesRecaps.find((r) => r.id === editingRecapId);
      if (prevRec) {
        updateDailySalesRecap({
          ...prevRec,
          ...payload,
          nonCashSettledAt:
            payload.nonCashSettlementStatus === "SETTLED"
              ? prevRec.nonCashSettledAt || recapForm.date
              : null,
        });
        toast.success(`Rekap omzet tanggal ${recapForm.date} berhasil diperbarui & Buku Kas ikut tersinkron.`);
      }
    } else {
      addDailySalesRecap({
        ...payload,
        nonCashSettledAt: payload.nonCashSettlementStatus === "SETTLED" ? recapForm.date : null,
      });
      toast.success(
        payload.nonCashSettlementStatus === "PENDING" && currentNonCashTotal > 0
          ? `Omzet ${formatCurrency(currentFormTotal)} tercatat. Tunai masuk Kas, Non-Tunai menunggu cair ke Bank.`
          : `Omzet harian tanggal ${recapForm.date} sebesar ${formatCurrency(currentFormTotal)} berhasil masuk ke Buku Kas & Bank!`
      );
    }

    setIsAddRecapOpen(false);
    setEditingRecapId(null);
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingRecap) return;
    if (isPeriodClosed(settleForm.settledDate)) {
      toast.error(`Periode ${settleForm.settledDate.slice(0, 7)} sudah ditutup buku.`);
      return;
    }
    settleDailySalesRecapNonCash(settlingRecap.id, {
      bankAccountId: settleForm.bankAccountId || defaultBankAccountId,
      mdrFeeAmount: Math.round(Number(settleForm.mdrFeeAmount) || 0),
      settledDate: settleForm.settledDate || getLocalDateString(),
    });
    toast.success("Dana Non-Tunai berhasil ditandai cair dan masuk ke rekening Bank!");
    setSettlingRecap(null);
  };

  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(Number(depositForm.amount) || 0);
    if (!depositForm.fromAccountId || !depositForm.toAccountId) {
      toast.warning("Pilih pos Kas Asal dan Rekening Bank Tujuan.");
      return;
    }
    if (depositForm.fromAccountId === depositForm.toAccountId) {
      toast.warning("Pos Kas Asal dan Bank Tujuan tidak boleh sama.");
      return;
    }
    if (amt <= 0) {
      toast.warning("Nominal setoran harus lebih dari Rp 0.");
      return;
    }
    if (isPeriodClosed(depositForm.date)) {
      toast.error(`Periode ${depositForm.date.slice(0, 7)} sudah ditutup buku.`);
      return;
    }

    const fromAcc = cashAccounts.find((a) => a.id === depositForm.fromAccountId);
    const toAcc = cashAccounts.find((a) => a.id === depositForm.toAccountId);
    const pairRef = `TRANSFER:${Date.now()}`;
    const noteSuffix = depositForm.notes.trim() ? ` — ${depositForm.notes.trim()}` : "";

    addCashTransaction({
      accountId: depositForm.fromAccountId,
      type: "CASH_OUT",
      date: depositForm.date,
      amount: amt,
      description: `Setor Tunai ke ${toAcc?.name || "Bank"}${noteSuffix}`,
      category: "Transfer Antar Kas",
      categoryId: null,
      referenceId: pairRef,
      vendorName: toAcc?.name || null,
      paymentMethod: "Setoran Tunai",
      createdBy: currentUser?.name || "Finance",
    });

    addCashTransaction({
      accountId: depositForm.toAccountId,
      type: "CASH_IN",
      date: depositForm.date,
      amount: amt,
      description: `Setoran Tunai dari ${fromAcc?.name || "Kas Toko"}${noteSuffix}`,
      category: "Transfer Antar Kas",
      categoryId: null,
      referenceId: pairRef,
      vendorName: fromAcc?.name || null,
      paymentMethod: "Setoran Tunai",
      createdBy: currentUser?.name || "Finance",
    });

    toast.success(`Setoran tunai ${formatCurrency(amt)} ke ${toAcc?.name || "Bank"} berhasil dicatat!`);
    setIsDepositModalOpen(false);
  };

  const handleDeleteRecap = (id: string, date: string, amount: number) => {
    if (isPeriodClosed(date)) {
      toast.error(`Periode ${date.slice(0, 7)} sudah ditutup buku. Rekap omzet tidak dapat dihapus.`);
      return;
    }
    setConfirmDeleteRecap({ id, date, amount });
  };

  // Fetch POS orders dari API backend
  const fetchPosOrders = async () => {
    setIsLoadingPosOrders(true);
    try {
      const params = new URLSearchParams();
      if (posStartDate) params.append("startDate", posStartDate);
      if (posEndDate) params.append("endDate", posEndDate);
      if (posStatusFilter && posStatusFilter !== "ALL") params.append("status", posStatusFilter);

      const res = await fetch(`/api/pos/orders/all?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data pesanan POS:", err);
    } finally {
      setIsLoadingPosOrders(false);
    }
  };

  useEffect(() => {
    if (FEATURES.POS && (activeTab === "pos_orders" || activeTab === "cashier_analytics")) {
      fetchPosOrders();
    }
  }, [activeTab, posStatusFilter, posStartDate, posEndDate]);

  // Hitung metrik ringkasan POS
  const posSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let paidCount = 0;
    let openCount = 0;
    let voidCount = 0;

    posOrders.forEach((ord) => {
      if (ord.status === "PAID") {
        totalRevenue += Number(ord.totalAmount) || 0;
        totalTax += Number(ord.taxAmount) || 0;
        totalDiscount += Number(ord.discountAmount) || 0;
        paidCount++;
      } else if (ord.status === "OPEN") {
        openCount++;
      } else if (ord.status === "VOID" || ord.status === "CANCELLED") {
        voidCount++;
      }
    });

    return {
      totalRevenue,
      totalTax,
      totalDiscount,
      paidCount,
      openCount,
      voidCount,
    };
  }, [posOrders]);

  // Hitung metrik analitik mendalam kasir & shift
  const cashierAnalytics = useMemo(() => {
    let dineInCount = 0;
    let dineInRevenue = 0;
    let takeAwayCount = 0;
    let takeAwayRevenue = 0;
    let deliveryCount = 0;
    let deliveryRevenue = 0;

    let cashRevenue = 0;
    let qrisRevenue = 0;
    let edcRevenue = 0;
    let transferRevenue = 0;

    let voidCount = 0;
    let voidTotal = 0;
    let refundCount = 0;
    let refundTotal = 0;

    const hourlyMap: Record<number, { count: number; revenue: number }> = {};
    for (let h = 7; h <= 23; h++) {
      hourlyMap[h] = { count: 0, revenue: 0 };
    }

    const itemSalesMap: Record<string, { name: string; quantity: number; total: number }> = {};

    posOrders.forEach((ord) => {
      const isPaid = ord.status === "PAID";
      const isVoid = ord.status === "VOID" || ord.status === "CANCELLED";
      const isRefund = ord.status === "REFUNDED" || (ord.notes && ord.notes.toLowerCase().includes("refund"));

      if (isVoid) {
        voidCount++;
        voidTotal += Number(ord.totalAmount) || Number(ord.subtotal) || 0;
      }

      if (isRefund) {
        refundCount++;
        refundTotal += Number(ord.totalAmount) || 0;
      }

      if (isPaid) {
        const orderType = (ord.orderType || "").toUpperCase();
        const amt = Number(ord.totalAmount) || 0;

        if (orderType === "DINE_IN") {
          dineInCount++;
          dineInRevenue += amt;
        } else if (orderType === "TAKE_AWAY") {
          takeAwayCount++;
          takeAwayRevenue += amt;
        } else if (orderType === "DELIVERY") {
          deliveryCount++;
          deliveryRevenue += amt;
        } else {
          dineInCount++;
          dineInRevenue += amt;
        }

        // Breakdown payments
        if (Array.isArray(ord.payments) && ord.payments.length > 0) {
          ord.payments.forEach((p) => {
            const method = (p.paymentMethod || "").toUpperCase();
            const pAmt = Number(p.amount) || 0;
            if (method === "CASH" || method === "TUNAI") cashRevenue += pAmt;
            else if (method.includes("QRIS")) qrisRevenue += pAmt;
            else if (method.includes("DEBIT") || method.includes("EDC") || method.includes("CREDIT")) edcRevenue += pAmt;
            else if (method.includes("TRANSFER")) transferRevenue += pAmt;
            else cashRevenue += pAmt;
          });
        }

        // Hourly distribution
        const dateObj = new Date(ord.createdAt);
        const hour = dateObj.getHours();
        if (hourlyMap[hour]) {
          hourlyMap[hour].count++;
          hourlyMap[hour].revenue += amt;
        }

        // Items sold
        if (Array.isArray(ord.items)) {
          ord.items.forEach((item) => {
            const key = item.productName || "Produk";
            if (!itemSalesMap[key]) {
              itemSalesMap[key] = { name: key, quantity: 0, total: 0 };
            }
            itemSalesMap[key].quantity += Number(item.quantity) || 1;
            itemSalesMap[key].total += Number(item.subtotal) || 0;
          });
        }
      }
    });

    const topItems = Object.values(itemSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const totalPaidOrders = dineInCount + takeAwayCount + deliveryCount;
    const totalOrderRevenue = dineInRevenue + takeAwayRevenue + deliveryRevenue;
    const maxHourlyCount = Math.max(1, ...Object.values(hourlyMap).map((h) => h.count));

    return {
      dineInCount,
      dineInRevenue,
      dineInPercent: totalOrderRevenue > 0 ? Math.round((dineInRevenue / totalOrderRevenue) * 100) : 0,
      takeAwayCount,
      takeAwayRevenue,
      takeAwayPercent: totalOrderRevenue > 0 ? Math.round((takeAwayRevenue / totalOrderRevenue) * 100) : 0,
      deliveryCount,
      deliveryRevenue,
      cashRevenue,
      qrisRevenue,
      edcRevenue,
      transferRevenue,
      voidCount,
      voidTotal,
      refundCount,
      refundTotal,
      hourlyMap,
      maxHourlyCount,
      topItems,
      totalPaidOrders,
      totalOrderRevenue,
    };
  }, [posOrders]);

  // Filtered POS orders untuk pencarian lokal
  const filteredPosOrders = useMemo(() => {
    if (!posSearchQuery) return posOrders;
    const q = posSearchQuery.toLowerCase();
    return posOrders.filter(
      (ord) =>
        ord.receiptNo?.toLowerCase().includes(q) ||
        ord.cashierName?.toLowerCase().includes(q) ||
        ord.customerName?.toLowerCase().includes(q) ||
        ord.tableNumber?.toLowerCase().includes(q)
    );
  }, [posOrders, posSearchQuery]);

  const filteredSales = salesTransactions
    .filter((s) => s.menuName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredLogs = salesImportLogs.sort(
    (a, b) =>
      new Date(b.importDate).getTime() - new Date(a.importDate).getTime()
  );

  const handleSalesImport = (parsedData: any[], fileName?: string) => {
    if (!parsedData || parsedData.length === 0) return;

    const actualFileName = fileName || `Import Penjualan Excel (${parsedData.length} baris)`;

    // ── ATURAN ANTI DOUBLE COUNT (Import Arsip vs Data Berulang) ───────────
    const alreadyImported = salesImportLogs.some(
      (l) => l.fileName === actualFileName && l.status === "SUCCESS"
    );
    if (alreadyImported) {
      alert(
        `Peringatan Anti-Double Count:\n\nFile "${actualFileName}" sudah pernah diimpor ke sistem sebelumnya.\n\nImpor dibatalkan demi menjaga konsistensi pembukuan dan mencegah pemotongan stok bahan baku berulang.`
      );
      return;
    }

    // Pemetaan kolom fleksibel: mendukung ekspor dari aplikasi POS lain
    // (mis. "Date/Item/Qty/Net Sales") dan menyamakan nama menu dengan katalog.
    const mapped = mapSalesRows(
      parsedData,
      (products || []).map((p: any) => p.name)
    );
    if (!mapped.mapping.mapped["Nama Menu"] || !mapped.mapping.mapped["Total Penjualan"]) {
      alert(
        "Kolom wajib tidak ditemukan di file.\n\n" +
          "Dibutuhkan minimal kolom nama menu dan total penjualan.\n" +
          "Kolom terbaca di file: " + (mapped.mapping.detected.join(", ") || "-") + "\n\n" +
          "Contoh nama kolom yang dikenali: Nama Menu / Item / Produk, dan Total Penjualan / Net Sales / Subtotal / Omzet.\n" +
          "Atau gunakan template resmi dari tombol unduh template."
      );
      return;
    }
    const newTransactions = mapped.rows.map((r) => ({ ...r, importLogId: "" }));

    if (newTransactions.length === 0) {
      alert("Tidak ada baris data penjualan yang valid untuk diimpor. Pastikan kolom 'Nama Menu' terisi.");
      return;
    }

    // ── ATURAN #6: CEK PERIODE TUTUP BUKU (Closed Periods) ────────────────
    const closedDates = Array.from(new Set(newTransactions.map((t) => t.date))).filter((d) => isPeriodClosed(d));
    if (closedDates.length > 0) {
      alert(
        `⛔ Periode Telah Ditutup (Aturan #6):\n\n` +
        `File impor memuat transaksi pada periode yang telah ditutup buku:\n` +
        `${closedDates.slice(0, 5).join(", ")}${closedDates.length > 5 ? ` (+${closedDates.length - 5} lainnya)` : ""}\n\n` +
        `Impor dibatalkan demi menjaga integritas data keuangan yang telah terkunci.`
      );
      return;
    }

    // ── ATURAN #7: ANTI-DUPLIKASI BARIS TRANSAKSI (Compound Key Deduplication) ──
    const existingSignatures = new Set(
      salesTransactions.map(
        (s) => `${s.date.slice(0, 10)}_${s.menuName.toLowerCase().trim()}_${s.quantitySold}_${Math.round(s.totalPrice)}`
      )
    );

    const batchSignatures = new Set<string>();
    const uniqueTransactions: typeof newTransactions = [];
    let duplicateRowsCount = 0;

    for (const trx of newTransactions) {
      const sig = `${trx.date.slice(0, 10)}_${trx.menuName.toLowerCase().trim()}_${trx.quantitySold}_${Math.round(trx.totalPrice)}`;
      if (existingSignatures.has(sig) || batchSignatures.has(sig)) {
        duplicateRowsCount++;
      } else {
        batchSignatures.add(sig);
        uniqueTransactions.push(trx);
      }
    }

    if (uniqueTransactions.length === 0) {
      alert(
        `⚠️ Seluruh Baris Terdeteksi Duplikat (Aturan #7):\n\n` +
        `Semua ${newTransactions.length} baris penjualan pada file "${actualFileName}" sudah ada di database atau duplikat di dalam batch file impor.\n\n` +
        `Impor dibatalkan 100% untuk mencegah duplikasi pendapatan dan pemotongan stok bahan baku berulang.`
      );
      return;
    }

    // Cek jika tanggal di file impor bertabrakan dengan transaksi POS kasir langsung
    const importDates = Array.from(new Set(uniqueTransactions.map((t) => t.date)));
    const overlappingWithPos = importDates.filter((d) =>
      posOrders.some((po) => po.createdAt.startsWith(d) && po.status === "PAID")
    );
    if (overlappingWithPos.length > 0) {
      const confirmOverlap = window.confirm(
        `⚠️ Peringatan Overlapping Data:\n\nTanggal [${overlappingWithPos.join(", ")}] yang ada di file impor sudah memiliki transaksi kasir POS langsung.\n\nPastikan file ini adalah data arsip historis dan bukan transaksi harian yang sudah di-input lewat tablet kasir.\n\nLanjutkan impor?`
      );
      if (!confirmOverlap) return;
    }

    addSalesTransactions(uniqueTransactions, actualFileName);
    const recapDates = new Set(dailySalesRecaps.map((r) => r.date.slice(0, 10)));
    const hasRecapOverlap = importDates.some((d) => recapDates.has(d.slice(0, 10)));
    const notes: string[] = [];
    if (hasRecapOverlap) notes.push("Tanggal yang sudah ada Rekap Omzet tetap mengikuti Buku Kas Rekap Harian (data menu dipakai untuk analitik & HPP teoretis)");
    if (duplicateRowsCount > 0) notes.push(`${duplicateRowsCount} baris duplikat dilewati otomatis (Aturan #7)`);
    if (mapped.skippedRows > 0) notes.push(`${mapped.skippedRows} baris dilewati karena nama menu kosong`);
    if (mapped.autoMatchedCount > 0) notes.push(`${mapped.autoMatchedCount} nama menu disamakan otomatis dengan katalog`);
    if (mapped.unmatchedMenus.length > 0) {
      const sample = mapped.unmatchedMenus.slice(0, 5).join(", ");
      notes.push(
        `${mapped.unmatchedMenus.length} nama menu belum ada di katalog (${sample}${mapped.unmatchedMenus.length > 5 ? ", ..." : ""}) sehingga stok/HPP-nya belum terhitung. Tambahkan menu tersebut di Katalog & Menu atau samakan namanya`
      );
    }
    setUploadStatus({
      type: mapped.unmatchedMenus.length > 0 ? "error" : "success",
      message:
        `Berhasil mengimpor ${uniqueTransactions.length} baris penjualan (${actualFileName}).` +
        (notes.length > 0 ? " Catatan: " + notes.join("; ") + "." : ""),
    });
  };

  const handleExportDailyRecap = () => {
    exportDailySalesRecapToXlsx({
      recaps: filteredRecaps,
      settings,
      periodLabel: recapDateFilter || "Semua_Tanggal",
    });
  };

  const handleExportSales = () => {
    exportSalesToXlsx({
      sales: filteredSales,
      settings,
      periodLabel: "Item_Penjualan",
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Banner & Tab Navigation ──────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Top Info Header */}
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Revenue & POS Archives
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Julia's • Specialty Room • Coffee • Eatery
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <RupiahSign className="w-5 h-5" />
            </div>
            Rekap Penjualan & Omzet
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
            {FEATURES.POS ? "Rekapitulasi penerimaan kasir, arsip struk transaksi POS lengkap dengan item & pembayaran, serta riwayat mutasi penjualan." : "Rekapitulasi omzet penjualan harian, impor data dari aplikasi POS eksternal, dan riwayat mutasi transaksi."}
          </p>
        </div>

        {/* Dedicated Tab Navigation Strip */}
        <div className="px-4 sm:px-7 py-3 bg-slate-50/70 border-t border-slate-200/80 flex items-center overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl border border-slate-200/80 shrink-0">
            {FEATURES.POS && (
            <button
              onClick={() => setActiveTab("cashier_analytics")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "cashier_analytics" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "cashier_analytics" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <TrendingUp className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Dasbor & Audit Kasir</span>
            </button>
            )}
            <button
              onClick={() => setActiveTab("daily_recap")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "daily_recap" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "daily_recap" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <RupiahSign className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Rekap Harian</span>
              {dailySalesRecaps.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/70">
                  {dailySalesRecaps.length}
                </span>
              )}
            </button>

            {FEATURES.POS && (
            <button
              onClick={() => setActiveTab("pos_orders")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "pos_orders" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "pos_orders" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Receipt className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Arsip Struk POS</span>
              {posOrders.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/70">
                  {posOrders.length}
                </span>
              )}
            </button>
            )}

            <button
              onClick={() => setActiveTab("sales")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "sales" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "sales" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <FileSpreadsheet className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Item Terjual</span>
              {salesTransactions.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {salesTransactions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "logs" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "logs" && (
                <motion.div
                  layoutId="salesMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <RotateCcw className="w-4 h-4 text-brand-600 relative z-10" />
              <span className="relative z-10">Riwayat Import</span>
              {salesImportLogs.length > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {salesImportLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Notification Toast ────────────────────────────────────── */}
      <AnimatePresence>
        {uploadStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs ${
              uploadStatus.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200/80"
                : "bg-rose-50 text-rose-900 border border-rose-200/80"
            }`}
          >
            <div className="flex items-center gap-3">
              {uploadStatus.type === "success" ? (
                <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 rounded-xl bg-rose-600 text-white shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <span className="font-semibold text-xs sm:text-sm">{uploadStatus.message}</span>
            </div>
            <button
              onClick={() => setUploadStatus(null)}
              className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAB 0: DASBOR & AUDIT KASIR ─────────────────────────────────────── */}
      {activeTab === "cashier_analytics" && (
        <div className="space-y-6">
          {/* Top Actions & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Periode Transaksi:
              </span>
              <div className="flex items-center gap-1.5">
                <CustomDatePicker
                  value={posStartDate}
                  onChange={setPosStartDate}
                  placeholder="Mulai"
                  buttonClassName="py-1 px-3 text-xs bg-slate-50 border-slate-200 rounded-xl"
                />
                <span className="text-slate-400 font-semibold">s/d</span>
                <CustomDatePicker
                  value={posEndDate}
                  onChange={setPosEndDate}
                  placeholder="Sampai"
                  buttonClassName="py-1 px-3 text-xs bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchPosOrders}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-brand-600 ${isLoadingPosOrders ? "animate-spin" : ""}`} />
                <span>Segarkan Data</span>
              </button>
            </div>
          </div>

          {/* 4 Bento KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Omzet Kasir */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 text-white border border-white/10 shadow-xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-300 border border-white/10 flex items-center gap-1.5">
                    <Receipt className="w-3 h-3 text-brand-400" />
                    Omzet Kasir
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-300">
                    <RupiahSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {formatCurrency(cashierAnalytics.totalOrderRevenue)}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 font-medium">
                    {cashierAnalytics.totalPaidOrders} Transaksi Sukses Lunas
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Saluran Dine In vs Take Away */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200/70">
                    Saluran Pesanan
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs">
                    <Utensils className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Utensils className="w-3 h-3 text-brand-600" /> Dine In
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {cashierAnalytics.dineInPercent}% ({formatCurrency(cashierAnalytics.dineInRevenue)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-brand-600 h-full transition-all"
                      style={{ width: `${cashierAnalytics.dineInPercent}%` }}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{ width: `${cashierAnalytics.takeAwayPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <ShoppingBag className="w-3 h-3 text-amber-600" /> Take Away
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {cashierAnalytics.takeAwayPercent}% ({formatCurrency(cashierAnalytics.takeAwayRevenue)})
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Dine In: {cashierAnalytics.dineInCount} meja • Take Away: {cashierAnalytics.takeAwayCount} bungkus
              </p>
            </div>

            {/* Card 3: Audit Kebocoran (Void & Pembatalan) */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/70 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                    Audit Void & Batal
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                  {formatCurrency(cashierAnalytics.voidTotal)}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {cashierAnalytics.voidCount} Pesanan Dibatalkan
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Refund: {cashierAnalytics.refundCount} trx</span>
                <span className="font-mono font-bold text-slate-700">{formatCurrency(cashierAnalytics.refundTotal)}</span>
              </div>
            </div>

            {/* Card 4: Pecahan Kas vs Non-Tunai */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    Penerimaan Kas
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tunai Laci:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatCurrency(cashierAnalytics.cashRevenue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">QRIS / EDC / Trf:</span>
                    <span className="font-mono font-bold text-sky-600">
                      {formatCurrency(cashierAnalytics.qrisRevenue + cashierAnalytics.edcRevenue + cashierAnalytics.transferRevenue)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Rasio Tunai: {cashierAnalytics.totalOrderRevenue > 0 ? Math.round((cashierAnalytics.cashRevenue / cashierAnalytics.totalOrderRevenue) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Dual Column: Tren Jam Sibuk & Top Produk */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Tren Jam Sibuk Kasir (2 Cols) */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Tren Jam Sibuk Kasir (Hourly Peak Hours)</h3>
                    <p className="text-[11px] text-slate-500">Distribusi jumlah transaksi kasir berdasarkan jam buka toko</p>
                  </div>
                </div>
              </div>

              {/* Hourly Histogram Chart */}
              <div className="pt-4 pb-2">
                <div className="flex items-end justify-between gap-1.5 h-36 px-2">
                  {(Object.entries(cashierAnalytics.hourlyMap) as [string, { count: number; revenue: number }][]).map(([hourStr, data]) => {
                    const h = Number(hourStr);
                    const heightPercent = cashierAnalytics.maxHourlyCount > 0 ? Math.max(8, (data.count / cashierAnalytics.maxHourlyCount) * 100) : 8;
                    const isPeak = data.count === cashierAnalytics.maxHourlyCount && data.count > 0;

                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-md">
                          Jam {String(h).padStart(2, "0")}:00 • {data.count} trx ({formatCurrency(data.revenue)})
                        </div>
                        <div className="w-full h-28 flex items-end">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`w-full rounded-t-lg transition-colors cursor-pointer ${
                              isPeak
                                ? "bg-gradient-to-t from-brand-600 to-rose-500"
                                : data.count > 0
                                ? "bg-brand-500 hover:bg-brand-600"
                                : "bg-slate-100"
                            }`}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-800">
                          {String(h).padStart(2, "0")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top 5 Menu Terlaris di Kasir (1 Col) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Top 5 Menu Kasir</h3>
                    <p className="text-[11px] text-slate-500">Menu paling banyak terjual</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {cashierAnalytics.topItems.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Belum ada item transaksi tercatat</p>
                  ) : (
                    cashierAnalytics.topItems.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            idx === 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 truncate">{item.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-slate-900">{item.quantity} cup</span>
                          <span className="text-[10px] text-slate-400 block">{formatCurrency(item.total)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Pecahan Pembayaran:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Tunai</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(cashierAnalytics.cashRevenue)}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">QRIS</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(cashierAnalytics.qrisRevenue)}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Debit / EDC</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(cashierAnalytics.edcRevenue)}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Transfer</span>
                    <strong className="font-mono text-slate-800">{formatCurrency(cashierAnalytics.transferRevenue)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log Void & Pembatalan Transaksi */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Audit Riwayat Void & Pembatalan Kasir</h3>
                  <p className="text-[11px] text-slate-500">Deteksi alasan pembatalan dan supervisor yang mengotorisasi via PIN</p>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {posOrders.filter(o => o.status === "VOID" || o.status === "CANCELLED").length} Transaksi Void
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="p-3.5">Waktu & Tanggal</th>
                    <th className="p-3.5">No. Struk</th>
                    <th className="p-3.5">Kasir Pelaksana</th>
                    <th className="p-3.5">Alasan Pembatalan (Void)</th>
                    <th className="p-3.5">Otorisasi Supervisor</th>
                    <th className="p-3.5 text-right">Nilai Void</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {posOrders.filter(o => o.status === "VOID" || o.status === "CANCELLED").length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <CheckCircle2 className="w-7 h-7 mx-auto mb-1.5 text-emerald-500" />
                        <p className="font-semibold text-xs text-slate-700">Tidak ada transaksi void / dibatalkan.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Semua pesanan kasir diproses lunas dengan integritas tinggi.</p>
                      </td>
                    </tr>
                  ) : (
                    posOrders
                      .filter(o => o.status === "VOID" || o.status === "CANCELLED")
                      .map((ord) => (
                        <tr key={ord.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-900">{ord.receiptNo}</td>
                          <td className="p-3.5 text-slate-800 font-medium">{ord.cashierName || "Kasir"}</td>
                          <td className="p-3.5 text-rose-700 font-semibold max-w-xs truncate">
                            {ord.voidReason || ord.notes || "Salah ketik / Batal pesan"}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono">
                              <Lock className="w-2.5 h-2.5" />
                              {ord.voidApprovedBy || "Manager PIN"}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-right text-rose-600">
                            {formatCurrency(Number(ord.totalAmount) || Number(ord.subtotal) || 0)}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setSelectedOrderForDetail(ord)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Struk</span>
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: REKAP OMZET HARIAN ─────────────────────────────────────── */}
      {activeTab === "daily_recap" && (
        <div className="space-y-6">
          {/* Top Actions for Daily Recap */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Filter Bulan / Periode:
              </span>
              <CustomMonthPicker
                value={recapDateFilter}
                onChange={setRecapDateFilter}
                allowClear={true}
                placeholder="Semua Bulan"
                buttonClassName="py-1 px-3 text-xs rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleExportDailyRecap}
                className="whitespace-nowrap shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                title="Unduh Rekap Omzet ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>Ekspor Excel (.xlsx)</span>
              </button>

              {!isReadOnly && (
                <>
                  <button
                    type="button"
                    onClick={openDepositModal}
                    className="whitespace-nowrap shrink-0 flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                    title="Catat setoran uang tunai kasir ke rekening Bank (Transfer Internal)"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300 shrink-0" />
                    <span>Setor Tunai ke Bank</span>
                  </button>
                  <button
                    onClick={openNewRecapModal}
                    className="whitespace-nowrap shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Catat Omzet Harian</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 4 Bento KPI Cards for Daily Recap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Omzet (Dark Royal Slate Hero) */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 text-white border border-white/10 shadow-xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-300 border border-white/10 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-brand-400" />
                    Total Omzet
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-300">
                    <RupiahSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums">
                    {formatCurrency(recapSummary.totalRevenue)}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 font-medium">
                    {recapSummary.count} Hari Entri Rekap Terdata
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Cash Tunai */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  Kas Fisik Toko
                </span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight tabular-nums">
                {formatCurrency(recapSummary.totalCash)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Penerimaan Uang Tunai Kasir
              </p>
            </div>

            {/* Card 3: QRIS */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-sky-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70">
                  Non-Tunai QRIS &amp; Ojol
                </span>
                <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                  <QrCode className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-sky-600 tracking-tight tabular-nums">
                {formatCurrency(recapSummary.totalQris + recapSummary.totalOnlineDelivery)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium tabular-nums">
                QRIS: {formatCurrency(recapSummary.totalQris)} • Ojol: {formatCurrency(recapSummary.totalOnlineDelivery)}
              </p>
            </div>

            {/* Card 4: EDC & Transfer */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-brand-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200/70">
                  EDC, Transfer &amp; Pending
                </span>
                <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-brand-700 tracking-tight tabular-nums">
                {formatCurrency(recapSummary.totalEdc + recapSummary.totalTransfer)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium tabular-nums">
                {recapSummary.totalPendingNonCash > 0
                  ? `Menunggu Cair: ${formatCurrency(recapSummary.totalPendingNonCash)}`
                  : `EDC: ${formatCurrency(recapSummary.totalEdc)} • TF: ${formatCurrency(recapSummary.totalTransfer)}`}
              </p>
            </div>
          </div>

          {/* Banner Sinkronisasi Otomatis */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-brand-50 via-sky-50/60 to-amber-50/50 dark:from-brand-500/15 dark:via-slate-900 dark:to-amber-500/10 border border-brand-200/80 dark:border-brand-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-600 text-white shadow-xs shrink-0">
                <RupiahSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Sinkronisasi Otomatis Buku Kas, Bank &amp; Laporan Laba Rugi
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Tunai masuk ke <strong>Kas Fisik</strong>, sedangkan QRIS, EDC, Transfer, dan <strong>Ojol</strong> masuk ke <strong>Rekening Bank</strong> (langsung atau setelah diklik <em>Tandai Cair</em> untuk H+1).
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <button
                onClick={openNewRecapModal}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white text-xs font-bold transition shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Omzet Baru</span>
              </button>
            )}
          </div>

          {/* Dual-View Data: Rekap Omzet Harian */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Rekapitulasi Omzet Harian
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Menampilkan <strong>{filteredRecaps.length}</strong> entri
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Shift</th>
                    <th className="p-3.5 text-right">Tunai (Cash)</th>
                    <th className="p-3.5 text-right">QRIS</th>
                    <th className="p-3.5 text-right">Mesin EDC</th>
                    <th className="p-3.5 text-right">Transfer</th>
                    <th className="p-3.5 text-right">Ojol (Bank)</th>
                    <th className="p-3.5 text-right">Total Omzet</th>
                    <th className="p-3.5">Keterangan &amp; Settlement</th>
                    {!isReadOnly && <th className="p-3.5 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecaps.length === 0 ? (
                    <tr>
                      <td colSpan={isReadOnly ? 9 : 10} className="p-10 text-center text-slate-400">
                        <div className="max-w-md mx-auto space-y-2">
                          <RupiahSign className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="font-bold text-slate-700 text-sm">Belum Ada Rekapitulasi Omzet</p>
                          <p className="text-xs text-slate-400">
                            {isOwner
                              ? "Belum ada catatan omzet yang dimasukkan kasir untuk periode yang dipilih."
                              : 'Klik tombol "Catat Omzet Harian" di atas untuk mulai memasukkan omzet kasir harian Anda.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecaps.map((item) => {
                      const locked = isPeriodClosed(item.date);
                      const isPendingNonCash = item.nonCashSettlementStatus === "PENDING";
                      return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>
                              {new Date(item.date).toLocaleDateString("id-ID", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {locked && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Lock className="w-3 h-3 text-amber-600" />
                                <span>Terkunci</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              item.shift === "PAGI"
                                ? "bg-amber-100 text-amber-800"
                                : item.shift === "SORE"
                                ? "bg-orange-100 text-orange-800"
                                : item.shift === "MALAM"
                                ? "bg-brand-100 text-brand-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.shift || "ALL"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-emerald-600 tabular-nums">
                          {formatCurrency(item.cashAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-sky-600 tabular-nums">
                          {formatCurrency(item.qrisAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-brand-700 tabular-nums">
                          {formatCurrency(item.edcAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-slate-700 tabular-nums">
                          {formatCurrency(item.transferAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-sky-700 tabular-nums">
                          {formatCurrency(item.onlineDeliveryAmount || 0)}
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 text-sm tabular-nums">
                          {formatCurrency(item.totalAmount)}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          <div className="truncate max-w-[220px] font-medium" title={item.notes || "-"}>
                            {item.notes || "-"}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-normal">
                              Oleh: {item.recordedBy || "Kasir"}
                            </span>
                            {isPendingNonCash && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-2.5 h-2.5" />
                                Menunggu Cair
                              </span>
                            )}
                            {Number(item.mdrFeeAmount || 0) > 0 && (
                              <span className="text-[10px] font-semibold text-rose-600 tabular-nums">
                                • MDR {formatCurrency(item.mdrFeeAmount || 0)}
                              </span>
                            )}
                          </div>
                        </td>
                        {!isReadOnly && (
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {locked ? (
                              <span
                                className="inline-block p-1.5 text-slate-300 cursor-not-allowed"
                                title="Periode Telah Ditutup (Aturan #6)"
                              >
                                <Lock className="w-4 h-4 mx-auto text-slate-300" />
                              </span>
                            ) : (
                              <div className="inline-flex items-center justify-center gap-1">
                                {isPendingNonCash && (
                                  <button
                                    type="button"
                                    onClick={() => openSettleModal(item)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition cursor-pointer"
                                    title="Tandai dana non-tunai sudah cair masuk Bank"
                                  >
                                    Tandai Cair
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditRecapModal(item)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition cursor-pointer"
                                  title="Edit Rekap Omzet"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecap(item.id, item.date, item.totalAmount)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Hapus Rekap Omzet"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredRecaps.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <RupiahSign className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700 text-sm">Belum Ada Rekapitulasi</p>
                  <p className="text-xs text-slate-400">
                    Belum ada data omzet harian yang tersimpan.
                  </p>
                </div>
              ) : (
                filteredRecaps.map((item) => {
                  const locked = isPeriodClosed(item.date);
                  return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900">
                            {new Date(item.date).toLocaleDateString("id-ID", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          {locked && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                              <Lock className="w-2.5 h-2.5 text-amber-600" />
                              <span>Terkunci</span>
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.shift === "PAGI"
                              ? "bg-amber-100 text-amber-800"
                              : item.shift === "SORE"
                              ? "bg-orange-100 text-orange-800"
                              : item.shift === "MALAM"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          Shift {item.shift || "ALL"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Omzet</p>
                        <p className="text-base font-black text-slate-900">
                          {formatCurrency(item.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 tabular-nums">
                      <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 font-bold block">Cash (Tunai)</span>
                        <span className="font-black text-emerald-600">{formatCurrency(item.cashAmount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                        <span className="text-[10px] text-sky-800 font-bold block">QRIS</span>
                        <span className="font-black text-sky-600">{formatCurrency(item.qrisAmount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-brand-50/60 border border-brand-100">
                        <span className="text-[10px] text-brand-800 font-bold block">Mesin EDC</span>
                        <span className="font-black text-brand-700">{formatCurrency(item.edcAmount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] text-slate-700 font-bold block">Transfer Bank</span>
                        <span className="font-black text-slate-800">{formatCurrency(item.transferAmount)}</span>
                      </div>
                      {(item.onlineDeliveryAmount || 0) > 0 && (
                        <div className="col-span-2 p-2 rounded-xl bg-sky-50/80 border border-sky-200/70 flex items-center justify-between">
                          <span className="text-[10px] text-sky-800 font-bold">Ojol / Delivery (Bank)</span>
                          <span className="font-black text-sky-700">{formatCurrency(item.onlineDeliveryAmount || 0)}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div className="truncate mr-2">
                        {item.notes ? (
                          <span className="italic font-medium text-slate-600">{item.notes}</span>
                        ) : (
                          <span className="text-slate-400">Tanpa catatan</span>
                        )}
                        <span className="block text-[10px] text-slate-400">
                          Dicatat: {item.recordedBy || "Kasir"}
                          {item.nonCashSettlementStatus === "PENDING" ? " • Menunggu Cair" : ""}
                        </span>
                      </div>
                      {!isReadOnly && (
                        locked ? (
                          <span
                            className="p-1.5 text-slate-300 cursor-not-allowed shrink-0"
                            title="Periode Telah Ditutup (Aturan #6)"
                          >
                            <Lock className="w-4 h-4 text-slate-300" />
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            {item.nonCashSettlementStatus === "PENDING" && (
                              <button
                                type="button"
                                onClick={() => openSettleModal(item)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                              >
                                Cairkan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditRecapModal(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecap(item.id, item.date, item.totalAmount)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ARSIP STRUK POS ────────────────────────────────────────── */}
      {activeTab === "pos_orders" && (
        <div className="space-y-6">
          {/* 4 Bento KPI Cards for POS Orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Omzet POS */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 text-white border border-white/10 shadow-xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-300 border border-white/10 flex items-center gap-1.5">
                    <Receipt className="w-3 h-3 text-brand-400" />
                    Total Omzet POS
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-300">
                    <RupiahSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {formatCurrency(posSummary.totalRevenue)}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 font-medium">
                    {posSummary.paidCount} Transaksi Sukses Lunas
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Pajak Resto PB1 */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-sky-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70">
                  Pajak Resto (PB1)
                </span>
                <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-sky-600 tracking-tight">
                {formatCurrency(posSummary.totalTax)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Kewajiban Pajak Daerah
              </p>
            </div>

            {/* Card 3: Total Diskon Promo */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-rose-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/70">
                  Total Diskon Promo
                </span>
                <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                {formatCurrency(posSummary.totalDiscount)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Potongan Kupon & Diskon Kasir
              </p>
            </div>

            {/* Card 4: Status Pesanan */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/70">
                  Status Pesanan
                </span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Store className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold mt-1">
                <span className="text-emerald-600">{posSummary.paidCount} Lunas</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-600">{posSummary.openCount} Open</span>
                <span className="text-slate-300">•</span>
                <span className="text-rose-600">{posSummary.voidCount} Void</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Total {posOrders.length} Pesanan Kasir
              </p>
            </div>
          </div>

          {/* Filter Bar POS */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 sm:flex-none">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari No. Struk, Kasir, atau Meja..."
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white transition"
                />
              </div>

              {/* Status Filter */}
              <CustomSelect
                value={posStatusFilter}
                onChange={setPosStatusFilter}
                options={[
                  { value: "ALL", label: "Semua Status" },
                  { value: "PAID", label: "Lunas (PAID)" },
                  { value: "OPEN", label: "Open Bill" },
                  { value: "VOID", label: "Batal / Void" },
                ]}
                placeholder="Pilih Status"
                buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200"
              />

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <CustomDatePicker
                  value={posStartDate}
                  onChange={setPosStartDate}
                  placeholder="Mulai"
                  buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200 shadow-none rounded-xl"
                />
                <span className="font-semibold text-slate-400">s/d</span>
                <CustomDatePicker
                  value={posEndDate}
                  onChange={setPosEndDate}
                  placeholder="Sampai"
                  buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200 shadow-none rounded-xl"
                />
              </div>
            </div>

            <button
              onClick={fetchPosOrders}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-brand-600 ${isLoadingPosOrders ? "animate-spin" : ""}`} />
              <span>Refresh Arsip</span>
            </button>
          </div>

          {/* Dual-View Data: Tabel & Card Feed Struk POS */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Arsip Struk Transaksi Kasir POS
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Total <strong>{filteredPosOrders.length}</strong> transaksi
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">No. Struk</th>
                    <th className="p-3.5">Waktu</th>
                    <th className="p-3.5">Tipe / Meja</th>
                    <th className="p-3.5">Kasir</th>
                    <th className="p-3.5 text-right">Subtotal</th>
                    <th className="p-3.5 text-right">Diskon</th>
                    <th className="p-3.5 text-right">Pajak PB1</th>
                    <th className="p-3.5 text-right">Total Akhir</th>
                    <th className="p-3.5">Metode</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingPosOrders ? (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2.5">
                          <RotateCcw className="w-5 h-5 animate-spin text-brand-600" />
                          <span className="font-semibold text-sm">Memuat daftar transaksi POS...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPosOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700">Tidak ada arsip transaksi POS yang cocok</p>
                        <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter status atau rentang tanggal.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPosOrders.map((ord) => {
                      const pay = ord.payments?.[0];
                      const payMethod = pay?.paymentMethod || "CASH";

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-slate-900">
                            #{ord.receiptNo}
                          </td>
                          <td className="p-3.5 text-slate-600 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                ord.orderType === "DINE_IN"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {ord.orderType === "DINE_IN"
                                ? `Dine In ${ord.tableNumber ? `(M-${ord.tableNumber})` : ""}`
                                : "Takeaway"}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            {ord.cashierName || "-"}
                          </td>
                          <td className="p-3.5 text-right font-medium text-slate-600">
                            {formatCurrency(ord.subtotal)}
                          </td>
                          <td className="p-3.5 text-right font-medium text-rose-600">
                            {ord.discountAmount ? `-${formatCurrency(ord.discountAmount)}` : "-"}
                          </td>
                          <td className="p-3.5 text-right font-medium text-sky-600">
                            {ord.taxAmount ? `+${formatCurrency(ord.taxAmount)}` : "-"}
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                            {formatCurrency(ord.totalAmount)}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <span className="font-bold text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                              {payMethod}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                ord.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ord.status === "OPEN"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setSelectedOrderForDetail(ord)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {isLoadingPosOrders ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5 animate-spin text-brand-600" />
                  <span className="font-semibold text-xs">Memuat struk POS...</span>
                </div>
              ) : filteredPosOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="font-bold text-slate-700 text-xs">Tidak ada struk ditemukan</p>
                </div>
              ) : (
                filteredPosOrders.map((ord) => {
                  const pay = ord.payments?.[0];
                  const payMethod = pay?.paymentMethod || "CASH";

                  return (
                    <div
                      key={ord.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono font-black text-sm text-slate-900">
                            #{ord.receiptNo}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.orderType === "DINE_IN"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {ord.orderType === "DINE_IN"
                                ? `Dine In ${ord.tableNumber ? `(M-${ord.tableNumber})` : ""}`
                                : "Takeaway"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ord.status === "OPEN"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Akhir</p>
                          <p className="text-base font-black text-slate-900">
                            {formatCurrency(ord.totalAmount)}
                          </p>
                          <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            {payMethod}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <div>
                          <span className="block font-medium text-slate-700">
                            Kasir: {ord.cashierName || "-"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedOrderForDetail(ord)}
                          className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail Struk</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: DATA ITEM PENJUALAN ───────────────────────────────────── */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          {/* Top Actions for Sales Item Tab */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Menu Terjual..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
              <button
                onClick={handleExportSales}
                className="whitespace-nowrap shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                title="Unduh Data Penjualan Menu ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>Ekspor Excel (.xlsx)</span>
              </button>

              {!isReadOnly && (
                <div className="flex items-center shrink-0">
                  <CsvImportExport
                    onImport={handleSalesImport}
                    templateHeaders={["Tanggal", "Nama Menu", "Quantity", "Total Penjualan"]}
                    templateExampleRow={[
                      new Date().toISOString().slice(0, 10),
                      products && products.length > 0 ? products[0].name : "Kopi Susu Gula Aren",
                      "45",
                      "990000",
                    ]}
                    templateFilename="Template_Import_Penjualan_Menu.xlsx"
                    buttonLabel="Import Excel / CSV Penjualan"
                    currentData={salesTransactions.slice(0, 50).map((s) => ({
                      id: s.id,
                      Tanggal: s.date.slice(0, 10),
                      "Nama Menu": s.menuName,
                      Quantity: s.quantitySold,
                      "Total Penjualan": s.totalPrice,
                    }))}
                    templateDropdowns={{
                      "Nama Menu":
                        products && products.length > 0
                          ? Array.from(new Set(products.map((p) => p.name)))
                          : ["Kopi Susu Gula Aren", "Cafe Latte", "Iced Americano", "Butter Croissant"],
                    }}
                    templateColumnTypes={{
                      Tanggal: "date",
                      Quantity: "integer",
                      "Total Penjualan": "number",
                    }}
                    templateHints={{
                      Tanggal: "Format tanggal penjualan: YYYY-MM-DD (contoh: 2026-10-18)",
                      "Nama Menu": "Pilih menu kopi atau makanan dari dropdown produk",
                      Quantity: "Jumlah cup / porsi yang terjual",
                      "Total Penjualan": "Total nominal uang penjualan (angka bulat tanpa titik/koma)",
                    }}
                    templateInstructions={[
                      "Gunakan template ini untuk merekap penjualan jika coffee shop menggunakan POS eksternal atau catatan harian.",
                      "Kolom 'Nama Menu' sudah dilengkapi dropdown pilihan produk kafe.",
                      "Kolom 'Total Penjualan' diisi total omzet rupiah dari menu tersebut.",
                      "Setelah disimpan, data akan otomatis masuk ke Laporan Penjualan dan Laba Rugi Finance.",
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dual-View Data: Item Penjualan */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Mutasi Item Penjualan
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Total <strong>{filteredSales.length}</strong> baris penjualan
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Nama Menu</th>
                    <th className="p-3.5 text-right">Quantity Terjual</th>
                    <th className="p-3.5 text-right">Total Penjualan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-400">
                        <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700">Tidak ada data penjualan menu</p>
                        <p className="text-xs text-slate-400 mt-1">Silakan gunakan Terminal POS atau import file Excel penjualan.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                          {new Date(sale.date).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {sale.menuName}
                        </td>
                        <td className="p-3.5 text-right font-bold text-brand-700">
                          <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70">
                            {sale.quantitySold} porsi
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(sale.totalPrice)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredSales.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="font-bold text-slate-700 text-xs">Belum ada item terjual</p>
                </div>
              ) : (
                filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {sale.menuName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(sale.date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-slate-900">
                          {formatCurrency(sale.totalPrice)}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/70">
                          {sale.quantitySold} porsi
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: RIWAYAT IMPORT CSV ─────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Log Riwayat Import Excel / CSV
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total <strong>{filteredLogs.length}</strong> riwayat
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Tanggal Import</th>
                  <th className="p-3.5">Nama File</th>
                  <th className="p-3.5 text-center">Jumlah Baris</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Diimport Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">
                      <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Belum ada riwayat import file</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                        {new Date(log.importDate).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                        <span>{log.fileName}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-800">
                        {log.rowCount} baris
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">
                        {log.createdBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Feed View */}
          <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                <p className="font-bold text-slate-700 text-xs">Belum ada riwayat import</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />
                        {log.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.importDate).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <span>Jumlah: {log.rowCount} baris</span>
                    <span>Oleh: {log.createdBy}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DETAIL STRUK TRANSAKSI POS ─────────────────────────────── */}
      <AnimatePresence>
        {selectedOrderForDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="my-auto bg-white rounded-3xl border border-slate-200/80 w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh]"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 shadow-2xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      Detail Nota POS #{selectedOrderForDetail.receiptNo}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Kasir: {selectedOrderForDetail.cashierName || "Kasir"} •{" "}
                      {new Date(selectedOrderForDetail.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1 text-xs">
                {/* Status & Meja */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Tipe Pesanan</p>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {selectedOrderForDetail.orderType === "DINE_IN"
                        ? `Dine In ${selectedOrderForDetail.tableNumber ? `(Meja ${selectedOrderForDetail.tableNumber})` : ""}`
                        : "Takeaway"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Status Bayar</p>
                    <span
                      className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedOrderForDetail.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedOrderForDetail.status === "OPEN"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {selectedOrderForDetail.status}
                    </span>
                  </div>
                </div>

                {/* Info VOID jika pesanan dibatalkan */}
                {selectedOrderForDetail.status === "VOID" && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-xs text-rose-700">
                      <AlertCircle className="w-4 h-4" />
                      <span>Transaksi Dibatalkan (VOID)</span>
                    </p>
                    <p className="text-[11px]">
                      Alasan: {selectedOrderForDetail.voidReason || "-"}
                    </p>
                    <p className="text-[11px]">
                      Disetujui oleh: {selectedOrderForDetail.voidApprovedBy || "Manager"}
                    </p>
                  </div>
                )}

                {/* Rincian Item Pesanan */}
                <div>
                  <p className="font-bold text-slate-700 text-xs mb-2">Item Pesanan</p>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {selectedOrderForDetail.items?.map((it) => {
                      let mods: any[] = [];
                      try {
                        mods = typeof it.modifiers === "string" ? JSON.parse(it.modifiers) : it.modifiers || [];
                      } catch {}

                      return (
                        <div key={it.id} className="p-3.5 flex justify-between items-start bg-white">
                          <div>
                            <p className="font-bold text-slate-900 text-xs">
                              {it.menuName}{" "}
                              <span className="text-slate-500 font-normal">
                                x{it.quantity}
                              </span>
                            </p>
                            {it.variantName && it.variantName !== "Regular" && (
                              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                Varian: {it.variantName}
                              </p>
                            )}
                            {mods.length > 0 && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Modifier: {mods.map((m: any) => m.name).join(", ")}
                              </p>
                            )}
                            {it.notes && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5">
                                Catatan: {it.notes}
                              </p>
                            )}
                          </div>
                          <p className="font-black text-slate-900 text-xs">
                            {formatCurrency(it.subtotal)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ringkasan Biaya Subtotal, Diskon, PB1, Total */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Menu:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedOrderForDetail.subtotal)}</span>
                  </div>
                  {Number(selectedOrderForDetail.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Diskon Promosi:</span>
                      <span>-{formatCurrency(selectedOrderForDetail.discountAmount || 0)}</span>
                    </div>
                  )}
                  {Number(selectedOrderForDetail.taxAmount) > 0 && (
                    <div className="flex justify-between text-sky-600 font-semibold">
                      <span>Pajak Restoran (PB1):</span>
                      <span>+{formatCurrency(selectedOrderForDetail.taxAmount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-slate-900 pt-2.5 border-t border-slate-200 text-sm">
                    <span>Total Pembayaran:</span>
                    <span className="text-base text-brand-700">{formatCurrency(selectedOrderForDetail.totalAmount)}</span>
                  </div>
                </div>

                {/* Rincian Pembayaran Kasir */}
                {selectedOrderForDetail.payments && selectedOrderForDetail.payments.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <p className="font-bold text-slate-700 text-xs mb-1">Rincian Pembayaran</p>
                    {selectedOrderForDetail.payments.map((p) => (
                      <div key={p.id} className="space-y-1 text-slate-600 text-[11px]">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>Metode: {p.paymentMethod}</span>
                          <span>{formatCurrency(p.amount)}</span>
                        </div>
                        {p.paymentMethod === "CASH" && (
                          <>
                            <div className="flex justify-between text-slate-500">
                              <span>Uang Diterima:</span>
                              <span>{formatCurrency(p.cashReceived || 0)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-600 font-bold">
                              <span>Kembalian:</span>
                              <span>{formatCurrency(p.changeAmount || 0)}</span>
                            </div>
                          </>
                        )}
                        {p.referenceNo && (
                          <div className="flex justify-between text-slate-500">
                            <span>No. Ref / Auth:</span>
                            <span className="font-mono">{p.referenceNo}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintReceipt}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Nota</span>
                  </button>

                  {selectedOrderForDetail.status === "PAID" && (
                    <button
                      onClick={() => setIsRefundPinModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition border border-rose-200 cursor-pointer"
                      title="Proses Pengembalian Dana (Refund) dengan PIN Manager"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>Refund Pesanan</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL OTORISASI REFUND DENGAN PIN MANAGER ── */}
      <AnimatePresence>
        {isRefundPinModalOpen && selectedOrderForDetail && (
          <PosManagerPinModal
            title="Otorisasi Refund Pesanan"
            description={`Masukkan PIN Manager / Super Admin untuk menyetujui pengembalian dana sebesar ${formatCurrency(selectedOrderForDetail.totalAmount)} pada nota #${selectedOrderForDetail.receiptNo}.`}
            requireReason={true}
            onClose={() => setIsRefundPinModalOpen(false)}
            onSuccess={async (manager, reason) => {
              try {
                const res = await fetch(`/api/pos/orders/${selectedOrderForDetail.id}/refund`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    managerPin: manager.pin,
                    refundReason: reason || "Refund dari Rekap Penjualan",
                    refundMethod: "CASH",
                    refundRestockOption: "RETURN_TO_STOCK",
                    refundAmount: selectedOrderForDetail.totalAmount,
                  }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Gagal memproses refund");
                alert("Pesanan berhasil di-refund dan audit kas telah diperbarui!");
                setIsRefundPinModalOpen(false);
                setSelectedOrderForDetail(null);
                fetchPosOrders();
              } catch (err: any) {
                alert("Gagal refund: " + err.message);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL CATAT / EDIT OMZET HARIAN ────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isAddRecapOpen && (
              <motion.div
                key="sales-recap-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-2xl bg-brand-600 text-white shadow-xs">
                        <RupiahSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                          {editingRecapId ? "Edit Rekap Omzet Harian" : "Catat Omzet Harian Toko"}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Input total penerimaan dari POS kasir &amp; pilih pos kas/bank tujuan
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddRecapOpen(false);
                        setEditingRecapId(null);
                      }}
                      className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveRecap} className="flex flex-col flex-1 overflow-hidden text-xs">
                    <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Tanggal Penjualan
                          </label>
                          <CustomDatePicker
                            value={recapForm.date}
                            onChange={(val) => setRecapForm({ ...recapForm, date: val })}
                            placeholder="Pilih Tanggal"
                            allowClear={false}
                            buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                          />
                          {isPeriodClosed(recapForm.date) && (
                            <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-1.5 text-amber-800 text-[11px] font-semibold">
                              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Periode bulan {recapForm.date.slice(0, 7)} sudah ditutup buku (Aturan #6).</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Shift Operasional
                          </label>
                          <CustomSelect
                            value={recapForm.shift}
                            onChange={(val) => setRecapForm({ ...recapForm, shift: val as any })}
                            options={[
                              { value: "ALL", label: "Semua Shift (Full Day)" },
                              { value: "PAGI", label: "Shift Pagi (Opening)" },
                              { value: "MIDDLE", label: "Shift Middle" },
                              { value: "SORE", label: "Shift Sore (Closing)" },
                            ]}
                            placeholder="Pilih Shift"
                            buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <p className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
                          Rincian Nominal per Metode Pembayaran (5 Pintu)
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold mb-1">
                              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Uang Tunai (Masuk Kas)</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                              <CurrencyInput
                                placeholder="0"
                                value={recapForm.cashAmount}
                                onValueChange={(raw) => setRecapForm({ ...recapForm, cashAmount: raw })}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs tabular-nums"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold mb-1">
                              <QrCode className="w-3.5 h-3.5 text-sky-600" />
                              <span>QRIS (Masuk Bank)</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                              <CurrencyInput
                                placeholder="0"
                                value={recapForm.qrisAmount}
                                onValueChange={(raw) => setRecapForm({ ...recapForm, qrisAmount: raw })}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs tabular-nums"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold mb-1">
                              <CreditCard className="w-3.5 h-3.5 text-brand-600" />
                              <span>Mesin EDC (Masuk Bank)</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                              <CurrencyInput
                                placeholder="0"
                                value={recapForm.edcAmount}
                                onValueChange={(raw) => setRecapForm({ ...recapForm, edcAmount: raw })}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs tabular-nums"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold mb-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-600" />
                              <span>Transfer Bank Langsung</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                              <CurrencyInput
                                placeholder="0"
                                value={recapForm.transferAmount}
                                onValueChange={(raw) => setRecapForm({ ...recapForm, transferAmount: raw })}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs tabular-nums"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold mb-1">
                              <ShoppingBag className="w-3.5 h-3.5 text-sky-600" />
                              <span>Ojol / Online Delivery (GoFood, GrabFood, ShopeeFood → Masuk Bank)</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                              <CurrencyInput
                                placeholder="0"
                                value={recapForm.onlineDeliveryAmount}
                                onValueChange={(raw) => setRecapForm({ ...recapForm, onlineDeliveryAmount: raw })}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-bold text-slate-900 text-base sm:text-xs tabular-nums"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pilihan Pos Kas & Rekening Bank Tujuan */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Pos Kas Tujuan (Tunai)
                          </label>
                          <CustomSelect
                            value={recapForm.cashAccountId || defaultCashAccountId}
                            onChange={(val) => setRecapForm({ ...recapForm, cashAccountId: val })}
                            options={cashAccounts.map((acc) => ({
                              value: acc.id,
                              label: `${acc.name} (${acc.type})`,
                            }))}
                            placeholder="Pilih Pos Kas"
                            buttonClassName="w-full py-2 px-3 text-xs bg-white border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Rekening Bank Tujuan (Non-Tunai &amp; Ojol)
                          </label>
                          <CustomSelect
                            value={recapForm.bankAccountId || defaultBankAccountId}
                            onChange={(val) => setRecapForm({ ...recapForm, bankAccountId: val })}
                            options={cashAccounts.map((acc) => ({
                              value: acc.id,
                              label: `${acc.name} (${acc.type})`,
                            }))}
                            placeholder="Pilih Rekening Bank"
                            buttonClassName="w-full py-2 px-3 text-xs bg-white border-slate-200"
                          />
                        </div>
                      </div>

                      {/* Bagian Opsional: Diskon, Refund, MDR & Settlement H+1 */}
                      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowOptionalRecapFields((prev) => !prev)}
                          className="w-full px-4 py-2.5 bg-slate-50/90 dark:bg-slate-800/70 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 transition cursor-pointer"
                        >
                          <span>Opsi Lanjutan (Diskon, Refund, Biaya MDR, &amp; Settlement H+1)</span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${showOptionalRecapFields ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {showOptionalRecapFields && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: "easeOut" }}
                              className="p-4 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                                    Diskon POS (Info)
                                  </label>
                                  <CurrencyInput
                                    placeholder="0"
                                    value={recapForm.discountAmount}
                                    onValueChange={(raw) => setRecapForm({ ...recapForm, discountAmount: raw })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs tabular-nums"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                                    Refund / Void (Info)
                                  </label>
                                  <CurrencyInput
                                    placeholder="0"
                                    value={recapForm.refundAmount}
                                    onValueChange={(raw) => setRecapForm({ ...recapForm, refundAmount: raw })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs tabular-nums"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                                    Potongan MDR / Admin
                                  </label>
                                  <CurrencyInput
                                    placeholder="0"
                                    value={recapForm.mdrFeeAmount}
                                    onValueChange={(raw) => setRecapForm({ ...recapForm, mdrFeeAmount: raw })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-rose-700 text-xs tabular-nums"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1.5">
                                  Status Pencairan Non-Tunai (QRIS / EDC / Ojol)
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecapForm({ ...recapForm, nonCashSettlementStatus: "SETTLED" })
                                    }
                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                      recapForm.nonCashSettlementStatus === "SETTLED"
                                        ? "bg-brand-50 border-brand-500 text-brand-900"
                                        : "bg-slate-50 border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    <span className="font-bold block">Langsung Masuk Bank</span>
                                    <span className="text-[10px] opacity-80">Saldo bank bertambah sekarang</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecapForm({ ...recapForm, nonCashSettlementStatus: "PENDING" })
                                    }
                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                      recapForm.nonCashSettlementStatus === "PENDING"
                                        ? "bg-amber-50 border-amber-500 text-amber-900"
                                        : "bg-slate-50 border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    <span className="font-bold block">Menunggu Cair (H+1)</span>
                                    <span className="text-[10px] opacity-80">Omzet tercatat, bank tunggu cair</span>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Live Calculated Total */}
                      <div className="p-4 rounded-2xl bg-brand-50/80 border border-brand-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-slate-600 font-bold">Total Omzet Masuk:</span>
                          <p className="text-[11px] text-brand-700 font-medium">
                            {recapForm.nonCashSettlementStatus === "PENDING" && currentNonCashTotal > 0
                              ? "Tunai langsung masuk Kas; Non-Tunai tunggu pencairan Bank"
                              : "Otomatis dicatat ke Kas & Rekening Bank terpilih"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-brand-700 tabular-nums">
                            {formatCurrency(currentFormTotal)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Catatan / Keterangan (Opsional)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Contoh: Ramai promo weekend, ada selisih kas fisik +Rp 2.000"
                          value={recapForm.notes}
                          onChange={(e) => setRecapForm({ ...recapForm, notes: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddRecapOpen(false);
                          setEditingRecapId(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={currentFormTotal <= 0 || isPeriodClosed(recapForm.date)}
                        className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{editingRecapId ? "Simpan Perubahan" : "Simpan & Masukkan ke Kas"}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── MODAL TANDAI CAIR NON-TUNAI (SETTLEMENT H+1) ───────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {settlingRecap && (
              <motion.div
                key="sales-settle-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-500/10">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                        Cairkan Dana Non-Tunai (Settlement)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Rekap tanggal {settlingRecap.date}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettlingRecap(null)}
                      className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200/70 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleConfirmSettle} className="p-5 space-y-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        Total QRIS / EDC / TF / Ojol:
                      </span>
                      <span className="text-base font-black text-brand-700 dark:text-brand-300 tabular-nums">
                        {formatCurrency(
                          (settlingRecap.qrisAmount || 0) +
                            (settlingRecap.edcAmount || 0) +
                            (settlingRecap.transferAmount || 0) +
                            (settlingRecap.onlineDeliveryAmount || 0)
                        )}
                      </span>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tanggal Masuk Rekening Bank
                      </label>
                      <CustomDatePicker
                        value={settleForm.settledDate}
                        onChange={(val) => setSettleForm({ ...settleForm, settledDate: val })}
                        allowClear={false}
                        buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Rekening Bank Tujuan
                      </label>
                      <CustomSelect
                        value={settleForm.bankAccountId || defaultBankAccountId}
                        onChange={(val) => setSettleForm({ ...settleForm, bankAccountId: val })}
                        options={cashAccounts.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${acc.type})`,
                        }))}
                        buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Potongan Biaya MDR / Admin (Opsional)
                      </label>
                      <CurrencyInput
                        placeholder="0"
                        value={settleForm.mdrFeeAmount}
                        onValueChange={(raw) => setSettleForm({ ...settleForm, mdrFeeAmount: raw })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-rose-700 text-xs tabular-nums"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSettlingRecap(null)}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-xs cursor-pointer"
                      >
                        Konfirmasi Cair ke Bank
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── MODAL SETOR TUNAI KE BANK (CASH DROP) ──────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isDepositModalOpen && (
              <motion.div
                key="sales-deposit-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-brand-50/70 dark:bg-brand-500/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                          Setor Tunai Kasir ke Bank
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Transfer internal (tidak memengaruhi omzet maupun Laba Rugi)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDepositModalOpen(false)}
                      className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200/70 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveDeposit} className="p-5 space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tanggal Setor
                      </label>
                      <CustomDatePicker
                        value={depositForm.date}
                        onChange={(val) => setDepositForm({ ...depositForm, date: val })}
                        allowClear={false}
                        buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Dari Pos Kas Tunai
                      </label>
                      <CustomSelect
                        value={depositForm.fromAccountId}
                        onChange={(val) => setDepositForm({ ...depositForm, fromAccountId: val })}
                        options={cashAccounts.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${acc.type})`,
                        }))}
                        buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Ke Rekening Bank / Tujuan
                      </label>
                      <CustomSelect
                        value={depositForm.toAccountId}
                        onChange={(val) => setDepositForm({ ...depositForm, toAccountId: val })}
                        options={cashAccounts.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${acc.type})`,
                        }))}
                        buttonClassName="w-full py-2 px-3 text-xs bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nominal Setoran (Rp)
                      </label>
                      <CurrencyInput
                        placeholder="0"
                        value={depositForm.amount}
                        onValueChange={(raw) => setDepositForm({ ...depositForm, amount: raw })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Keterangan
                      </label>
                      <input
                        type="text"
                        value={depositForm.notes}
                        onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsDepositModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-xs cursor-pointer"
                      >
                        Catat Setoran
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── CONFIRM MODAL HAPUS REKAP OMZET ─────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmDeleteRecap !== null}
        variant="danger"
        title="Hapus Rekap Omzet Harian?"
        message={
          confirmDeleteRecap
            ? `Rekap omzet tanggal ${confirmDeleteRecap.date} senilai ${formatCurrency(confirmDeleteRecap.amount)} beserta entri Buku Kas & Bank terkait akan ikut dihapus.`
            : ""
        }
        confirmLabel="Ya, Hapus Rekap"
        cancelLabel="Batal"
        onConfirm={() => {
          if (confirmDeleteRecap) {
            deleteDailySalesRecap(confirmDeleteRecap.id);
            toast.success("Rekap omzet & mutasi kas terkait berhasil dihapus.");
            setConfirmDeleteRecap(null);
          }
        }}
        onCancel={() => setConfirmDeleteRecap(null)}
      />
    </div>
  );
};
