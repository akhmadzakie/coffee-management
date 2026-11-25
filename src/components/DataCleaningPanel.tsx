import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { authFetch } from "../utils/authHeaders";
import { toast } from "../context/ToastContext";
import { formatCurrency } from "../utils/format";
import { CustomSelect } from "./common/CustomSelect";
import {
  CLEANING_CONFIRM_PHRASE,
  CLEANING_GROUP_DEFINITIONS,
  CleaningGroupKey,
  parseCleaningGroups,
  VALID_CLIENT_USER_ROLES,
} from "../utils/dataCleaning";

interface InventoryResponse {
  isDbConnected: boolean;
  tableCounts: Record<string, number>;
  groupCounts: Record<string, number>;
  protectedSummary: {
    users: Array<{
      id: string;
      username: string;
      name: string;
      role: string;
      department?: string | null;
      isSuspended?: boolean;
    }>;
    cashAccounts: Array<{
      id: string;
      name: string;
      type: "CASH" | "BANK" | "SAVINGS" | "E_WALLET";
      isDefault: boolean;
    }>;
    settings: {
      brandName: string;
      companyAddress: string;
      bankDetails: string;
      footerMessage: string;
      taxEnabled: boolean;
      taxRate: number;
      taxMode: "INCLUSIVE" | "EXCLUSIVE";
      monthlyRevenueTarget: number;
      autoDeductStockOnSale: boolean;
      autoSeedDisabled: boolean;
      lastCleanedAt: string | null;
    };
    expenseCategories: {
      total: number;
      coreCount: number;
      customCount: number;
    };
  };
}

interface EditableCashAccountRow {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "SAVINGS" | "E_WALLET";
  isDefault: boolean;
}

interface NewClientUserRow {
  localId: string;
  name: string;
  username: string;
  role: (typeof VALID_CLIENT_USER_ROLES)[number];
  department: string;
  pin: string;
  showPin: boolean;
}

interface CleanResultState {
  deletedTotal: number;
  deletedByTable: Record<string, number>;
  autoSeedDisabled: boolean;
  createdUsersCount: number;
  updatedCashAccountsCount: number;
}

const ROLE_OPTIONS = VALID_CLIENT_USER_ROLES.map((r) => ({
  value: r,
  label:
    r === "KASIR"
      ? "KASIR (POS Tablet)"
      : r === "BAR"
      ? "BAR (Barista / KDS)"
      : r === "KITCHEN"
      ? "KITCHEN (Dapur / KDS)"
      : r === "BAKER"
      ? "BAKER (Pastry / KDS)"
      : r === "SUPER_ADMIN"
      ? "SUPER_ADMIN (IT & Sistem)"
      : r,
}));

const CASH_TYPE_OPTIONS = [
  { value: "CASH", label: "Tunai / Laci Kasir (CASH)" },
  { value: "BANK", label: "Rekening Bank / QRIS (BANK)" },
  { value: "E_WALLET", label: "Dompet Digital (E_WALLET)" },
  { value: "SAVINGS", label: "Tabungan / Cadangan (SAVINGS)" },
];

const TAX_MODE_OPTIONS = [
  { value: "EXCLUSIVE", label: "Exclusive (Ditambahkan di atas harga menu)" },
  { value: "INCLUSIVE", label: "Inclusive (Sudah termasuk dalam harga menu)" },
];

export const DataCleaningPanel: React.FC = () => {
  const { currentUser, clearLocalCachesAndReload } = useStore();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groups, setGroups] = useState<Record<CleaningGroupKey, boolean>>(() =>
    parseCleaningGroups()
  );
  const [keepUserIds, setKeepUserIds] = useState<string[]>([]);
  const [disableAutoSeed, setDisableAutoSeed] = useState(true);

  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  // Client setup switches & state
  const [applyProfile, setApplyProfile] = useState(false);
  const [clientBrandName, setClientBrandName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientBankDetails, setClientBankDetails] = useState("");
  const [clientFooter, setClientFooter] = useState("");
  const [clientTaxEnabled, setClientTaxEnabled] = useState(false);
  const [clientTaxRate, setClientTaxRate] = useState(10);
  const [clientTaxMode, setClientTaxMode] = useState<"INCLUSIVE" | "EXCLUSIVE">("EXCLUSIVE");
  const [clientMonthlyTarget, setClientMonthlyTarget] = useState(0);
  const [clientAutoDeductStock, setClientAutoDeductStock] = useState(false);

  const [applyCashAccounts, setApplyCashAccounts] = useState(false);
  const [clientCashAccounts, setClientCashAccounts] = useState<EditableCashAccountRow[]>([
    { id: "cash-drawer-main", name: "Laci Kasir Utama", type: "CASH", isDefault: true },
    { id: "bank-main", name: "Rekening Bank / QRIS Utama", type: "BANK", isDefault: false },
    { id: "savings-reserve", name: "Tabungan Cadangan Kedai", type: "SAVINGS", isDefault: false },
  ]);

  const [newUsers, setNewUsers] = useState<NewClientUserRow[]>([]);

  // Modal & Execution
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [confirmPhraseInput, setConfirmPhraseInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [cleanResult, setCleanResult] = useState<CleanResultState | null>(null);

  const fetchInventory = useCallback(async () => {
    if (!isSuperAdmin) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch("/api/admin/data-inventory");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Gagal membaca inventaris database.");
      }
      setInventory(data);
      const st = data?.protectedSummary?.settings;
      if (st) {
        setClientBrandName(st.brandName || "");
        setClientAddress(st.companyAddress || "");
        setClientBankDetails(st.bankDetails || "");
        setClientFooter(st.footerMessage || "");
        setClientTaxEnabled(Boolean(st.taxEnabled));
        setClientTaxRate(Number(st.taxRate ?? 10));
        setClientTaxMode(st.taxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE");
        setClientMonthlyTarget(Number(st.monthlyRevenueTarget ?? 0));
        setClientAutoDeductStock(Boolean(st.autoDeductStockOnSale));
      }
      const existingAccounts = data?.protectedSummary?.cashAccounts;
      if (Array.isArray(existingAccounts) && existingAccounts.length > 0) {
        setClientCashAccounts(
          existingAccounts.map((a: any) => ({
            id: String(a.id),
            name: String(a.name || ""),
            type: a.type || "CASH",
            isDefault: Boolean(a.isDefault),
          }))
        );
      }
      if (currentUser?.id) {
        setKeepUserIds((prev) =>
          prev.includes(currentUser.id) ? prev : [currentUser.id, ...prev]
        );
      }
    } catch (err: any) {
      setLoadError(err?.message || "Gagal terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, currentUser?.id]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const sectionTotals = useMemo(() => {
    const gc = inventory?.groupCounts || {};
    const sumSection = (sec: "TRANSACTIONS" | "MASTER_DATA" | "ACCOUNTS_SYSTEM") =>
      CLEANING_GROUP_DEFINITIONS.filter((g) => g.section === sec).reduce(
        (acc, g) => acc + Number(gc[g.key] || 0),
        0
      );
    const selectedToDelete = CLEANING_GROUP_DEFINITIONS.reduce(
      (acc, g) => acc + (groups[g.key] ? Number(gc[g.key] || 0) : 0),
      0
    );
    return {
      transactions: sumSection("TRANSACTIONS"),
      masterData: sumSection("MASTER_DATA"),
      accountsSystem: sumSection("ACCOUNTS_SYSTEM"),
      selectedToDelete,
    };
  }, [inventory, groups]);

  if (!isSuperAdmin) return null;

  const toggleGroup = (key: CleaningGroupKey) => {
    setGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setSectionChecked = (
    section: "TRANSACTIONS" | "MASTER_DATA",
    checked: boolean
  ) => {
    setGroups((prev) => {
      const next = { ...prev };
      for (const def of CLEANING_GROUP_DEFINITIONS) {
        if (def.section === section) next[def.key] = checked;
      }
      return next;
    });
  };

  const toggleKeepUser = (userId: string) => {
    if (userId === currentUser?.id) return;
    setKeepUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const res = await authFetch("/api/admin/data-backup");
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Gagal mengunduh backup JSON.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `backup-erp-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setHasDownloadedBackup(true);
      toast.success(`Backup JSON berhasil diunduh (${filename}).`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengunduh backup database.");
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleAddCashRow = () => {
    setClientCashAccounts((prev) => [
      ...prev,
      {
        id: `pos-${Date.now().toString(36)}`,
        name: "",
        type: "BANK",
        isDefault: false,
      },
    ]);
  };

  const handleRemoveCashRow = (idx: number) => {
    setClientCashAccounts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSetDefaultCash = (idx: number) => {
    setClientCashAccounts((prev) =>
      prev.map((row, i) => ({
        ...row,
        isDefault: i === idx,
      }))
    );
  };

  const handleAddNewUserRow = () => {
    setNewUsers((prev) => [
      ...prev,
      {
        localId: `nu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: "",
        username: "",
        role: "KASIR",
        department: "Bar & Kasir",
        pin: "",
        showPin: false,
      },
    ]);
  };

  const handleRemoveNewUserRow = (localId: string) => {
    setNewUsers((prev) => prev.filter((u) => u.localId !== localId));
  };

  const handleExecuteClean = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPhraseInput.trim() !== CLEANING_CONFIRM_PHRASE) {
      toast.error(`Ketik persis kalimat konfirmasi: ${CLEANING_CONFIRM_PHRASE}`);
      return;
    }
    if (!adminPin.trim()) {
      toast.error("Masukkan PIN Super Admin Anda terlebih dahulu.");
      return;
    }

    setIsExecuting(true);
    try {
      const payload = {
        pin: adminPin.trim(),
        confirmText: confirmPhraseInput.trim(),
        groups,
        keepUserIds,
        disableAutoSeed,
        clientSetup: {
          applyProfile,
          profile: applyProfile
            ? {
                brandName: clientBrandName,
                companyAddress: clientAddress,
                bankDetails: clientBankDetails,
                footerMessage: clientFooter,
                taxEnabled: clientTaxEnabled,
                taxRate: Number(clientTaxRate) || 0,
                taxMode: clientTaxMode,
                monthlyRevenueTarget: Number(clientMonthlyTarget) || 0,
                autoDeductStockOnSale: clientAutoDeductStock,
              }
            : undefined,
          applyCashAccounts,
          cashAccounts: applyCashAccounts ? clientCashAccounts : undefined,
          newUsers: newUsers.map((u) => ({
            name: u.name,
            username: u.username,
            role: u.role,
            department: u.department,
            pin: u.pin,
          })),
        },
      };

      const res = await authFetch("/api/admin/clean-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Pembersihan data gagal dijalankan.");
      }

      setCleanResult({
        deletedTotal: Number(data?.summary?.deletedTotal || 0),
        deletedByTable: data?.summary?.deletedByTable || {},
        autoSeedDisabled: Boolean(data?.autoSeedDisabled),
        createdUsersCount: Number(data?.createdUsersCount || 0),
        updatedCashAccountsCount: Number(data?.updatedCashAccountsCount || 0),
      });

      setIsConfirmOpen(false);
      setAdminPin("");
      setConfirmPhraseInput("");
      setNewUsers([]);

      await clearLocalCachesAndReload();
      await fetchInventory();
      toast.success(
        `Cleaning selesai! ${Number(data?.summary?.deletedTotal || 0).toLocaleString("id-ID")} baris dibersihkan.`
      );
    } catch (err: any) {
      toast.error(err?.message || "Gagal membersihkan data.");
    } finally {
      setIsExecuting(false);
    }
  };

  const protectedUsers = inventory?.protectedSummary?.users || [];
  const autoSeedDisabledNow = Boolean(
    inventory?.protectedSummary?.settings?.autoSeedDisabled
  );
  const lastCleanedAt = inventory?.protectedSummary?.settings?.lastCleanedAt;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-coffee-sm border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Database className="w-5 h-5 text-brand-600 dark:text-brand-300" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              Cleaning Data &amp; Persiapan Klien Baru
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                autoSeedDisabledNow
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                  : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
              }`}
            >
              {autoSeedDisabledNow ? (
                <>
                  <ShieldCheck className="w-3 h-3" /> Auto-Seed Dummy Nonaktif
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" /> Auto-Seed Dummy Aktif
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sortir jumlah baris aktual di database, unduh backup JSON, bersihkan data uji coba secara aman, dan langsung sesuaikan profil untuk klien.
            {lastCleanedAt && (
              <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">
                (Terakhir dibersihkan: {new Date(lastCleanedAt).toLocaleString("id-ID")})
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchInventory}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/70 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Muat Ulang Data DB
          </button>
        </div>
      </div>

      {/* Error State */}
      {loadError && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal memuat inventaris database</p>
              <p className="mt-0.5 opacity-90">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchInventory}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 4 Soft-Tinted Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-rose-200/70 dark:border-rose-500/30 bg-gradient-to-br from-rose-50/60 via-white to-white dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Data Transaksi
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {isLoading && !inventory ? "..." : sectionTotals.transactions.toLocaleString("id-ID")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Baris penjualan, kas, stok &amp; HR
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/70 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/60 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Master Katalog &amp; SDM
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {isLoading && !inventory ? "..." : sectionTotals.masterData.toLocaleString("id-ID")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Produk, resep, bahan, supplier &amp; promo
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200/70 dark:border-brand-500/30 bg-gradient-to-br from-brand-50/60 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Terpilih Dihapus
          </p>
          <p className="text-xl font-black text-brand-700 dark:text-brand-300 mt-1 tabular-nums">
            {isLoading && !inventory ? "..." : sectionTotals.selectedToDelete.toLocaleString("id-ID")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Estimasi total baris sesuai centang
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Sistem Dilindungi
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {inventory?.protectedSummary?.expenseCategories?.coreCount ?? 32} Kategori
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            + Akun Super Admin &amp; mesin Laba Rugi
          </p>
        </div>
      </div>

      {/* Post-Clean Result Banner */}
      <AnimatePresence>
        {cleanResult && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/15 p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-100">
                  <p className="font-bold text-sm">
                    Pembersihan Data Berhasil ({cleanResult.deletedTotal.toLocaleString("id-ID")} baris dihapus)
                  </p>
                  <p className="mt-0.5 text-emerald-800 dark:text-emerald-200">
                    Cache lokal browser ini sudah disegarkan. Pastikan tablet POS / browser perangkat lain{" "}
                    <span className="font-bold underline">Logout &amp; Refresh</span> agar cache lama tidak ikut tersinkronisasi.
                  </p>
                  {(cleanResult.createdUsersCount > 0 || cleanResult.updatedCashAccountsCount > 0) && (
                    <p className="mt-1 font-semibold">
                      Setup klien diterapkan:{" "}
                      {cleanResult.updatedCashAccountsCount > 0 &&
                        `${cleanResult.updatedCashAccountsCount} Pos Kas`}
                      {cleanResult.updatedCashAccountsCount > 0 &&
                        cleanResult.createdUsersCount > 0 &&
                        " • "}
                      {cleanResult.createdUsersCount > 0 &&
                        `${cleanResult.createdUsersCount} Akun Baru`}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCleanResult(null)}
                className="p-1 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer"
                aria-label="Tutup ringkasan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 1: Backup JSON */}
      <div className="rounded-2xl border border-brand-200/70 dark:border-brand-500/30 bg-brand-50/40 dark:bg-brand-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
              Langkah 1 (Disarankan) — Cadangkan Snapshot JSON
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Unduh salinan lengkap seluruh tabel database (tanpa PIN &amp; API Key) sebelum menghapus data uji coba.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasDownloadedBackup && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1.5 rounded-xl">
              <Check className="w-3.5 h-3.5" /> Backup Tersimpan
            </span>
          )}
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={isDownloadingBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isDownloadingBackup ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Unduh Backup JSON Lengkap
          </button>
        </div>
      </div>

      {/* Step 2: Sortir Kelompok Data */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600 dark:text-brand-300" />
              Langkah 2 — Sortir Data yang Dihapus vs Dipertahankan
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Centang kelompok data yang ingin dibersihkan. Hapus centang bila ingin mempertahankan data tersebut.
            </p>
          </div>
        </div>

        {/* Bucket A: Transaksi */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/90 dark:bg-slate-800/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              A. Data Transaksi &amp; Riwayat
            </span>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setSectionChecked("TRANSACTIONS", true)}
                className="text-brand-600 dark:text-brand-300 hover:underline cursor-pointer"
              >
                Pilih Semua
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <button
                type="button"
                onClick={() => setSectionChecked("TRANSACTIONS", false)}
                className="text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Kosongkan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {CLEANING_GROUP_DEFINITIONS.filter((g) => g.section === "TRANSACTIONS").map((item) => {
              const count = Number(inventory?.groupCounts?.[item.key] || 0);
              const checked = groups[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    checked
                      ? "bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-500/40 shadow-2xs"
                      : "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-700/60 opacity-80"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGroup(item.key)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </span>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {count.toLocaleString("id-ID")} baris
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {groups.inventoryOps && !groups.catalogIngredients && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
              Catatan: Karena Mutasi Stok dihapus tetapi Bahan Baku dipertahankan, nilai{" "}
              <code className="font-mono">currentStock</code> seluruh bahan baku otomatis direset ke 0.
            </p>
          )}
        </div>

        {/* Bucket B: Master Data */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/90 dark:bg-slate-800/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              B. Master Data &amp; Katalog Dummy
            </span>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setSectionChecked("MASTER_DATA", true)}
                className="text-brand-600 dark:text-brand-300 hover:underline cursor-pointer"
              >
                Pilih Semua
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <button
                type="button"
                onClick={() => setSectionChecked("MASTER_DATA", false)}
                className="text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Pertahankan Semua
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {CLEANING_GROUP_DEFINITIONS.filter((g) => g.section === "MASTER_DATA").map((item) => {
              const count = Number(inventory?.groupCounts?.[item.key] || 0);
              const checked = groups[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    checked
                      ? "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-500/40 shadow-2xs"
                      : "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-700/60 opacity-80"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGroup(item.key)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </span>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {count.toLocaleString("id-ID")} baris
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Bucket C: Akun, Perangkat & Template */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/90 dark:bg-slate-800/70 p-4 space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            C. Akun Uji Coba, Perangkat &amp; Template KPI/Kategori
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {CLEANING_GROUP_DEFINITIONS.filter((g) => g.section === "ACCOUNTS_SYSTEM").map(
              (item) => {
                const count = Number(inventory?.groupCounts?.[item.key] || 0);
                const checked = groups[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      checked
                        ? "bg-white dark:bg-slate-900 border-brand-200 dark:border-brand-500/40 shadow-2xs"
                        : "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-700/60 opacity-80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(item.key)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {item.label}
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {count.toLocaleString("id-ID")} baris
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </label>
                );
              }
            )}
          </div>

          {/* Sortir User yang dipertahankan saat dummyUsers dicentang */}
          <AnimatePresence>
            {groups.dummyUsers && protectedUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                      Pilih Akun Eksisting yang Ingin Dipertahankan (Klik untuk toggle):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {protectedUsers.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      const isKept = isSelf || keepUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={isSelf}
                          onClick={() => toggleKeepUser(u.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                            isSelf
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 cursor-not-allowed"
                              : isKept
                              ? "bg-brand-50 text-brand-800 border-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:border-brand-500/40 cursor-pointer"
                              : "bg-rose-50/70 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30 line-through opacity-80 cursor-pointer"
                          }`}
                        >
                          {isSelf ? (
                            <Lock className="w-3 h-3" />
                          ) : isKept ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>@{u.username}</span>
                          <span className="opacity-70">({u.role})</span>
                          {isSelf && (
                            <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px]">
                              Dilindungi
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle Matikan Auto-Seed */}
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Matikan Auto-Seed Data Dummy setelah cleaning
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Wajib aktif agar 13 bahan, 2 produk, promo MEMBER10, dan 9 user PIN 123456 tidak otomatis dibuat ulang saat server/aplikasi dimuat.
              </p>
            </div>
            <input
              type="checkbox"
              checked={disableAutoSeed}
              onChange={(e) => setDisableAutoSeed(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
            />
          </label>
        </div>

        {/* Protected Data Notice */}
        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Data Inti yang TIDAK PERNAH Dihapus:</p>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              Struktur tabel PostgreSQL, <strong>32 Kategori Keuangan Bawaan</strong> (Pendapatan, Bahan Baku, Gaji, CapEx/Aset, Admin Bank) agar mesin Laba Rugi &amp; HPP tetap akurat, baris <strong>Pengaturan Sistem</strong>, <strong>Akun Super Admin Anda</strong>, dan minimal <strong>Pos Kas aktif</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Step 3: Penyesuaian Klien Baru (Opsional) */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-300" />
            Langkah 3 — Penyesuaian Awal Untuk Klien (Opsional)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aktifkan bagian yang ingin langsung disesuaikan bersamaan dengan proses cleaning.
          </p>
        </div>

        {/* 3A: Profil Kafe Klien */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-brand-600 dark:text-brand-300" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Terapkan Profil Kafe, Pajak PB1 &amp; Target Omzet Klien
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ubah nama usaha, alamat struk, rekening transfer, pajak PB1, dan mode stok kasir.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyProfile}
              onChange={(e) => setApplyProfile(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
          </label>

          <AnimatePresence>
            {applyProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Nama Brand / Kafe Klien *
                    </label>
                    <input
                      type="text"
                      value={clientBrandName}
                      onChange={(e) => setClientBrandName(e.target.value)}
                      placeholder="Contoh: Kopi Senja Nusantara"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Target Omzet Bulanan (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500000}
                      value={clientMonthlyTarget}
                      onChange={(e) => setClientMonthlyTarget(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:border-brand-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      Preview: {formatCurrency(Math.round(Number(clientMonthlyTarget) || 0))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Alamat / Tagline Struk
                    </label>
                    <input
                      type="text"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Jl. Contoh No. 10, Kota"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Info Rekening Bank Utama
                    </label>
                    <input
                      type="text"
                      value={clientBankDetails}
                      onChange={(e) => setClientBankDetails(e.target.value)}
                      placeholder="Bank BCA 12345678 a.n PT Klien"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Pesan Footer Struk
                    </label>
                    <input
                      type="text"
                      value={clientFooter}
                      onChange={(e) => setClientFooter(e.target.value)}
                      placeholder="Terima kasih telah berkunjung!"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clientTaxEnabled}
                        onChange={(e) => setClientTaxEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600"
                      />
                      Aktifkan Pajak PB1
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      disabled={!clientTaxEnabled}
                      value={clientTaxRate}
                      onChange={(e) => setClientTaxRate(Number(e.target.value) || 0)}
                      className="w-20 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular-nums disabled:opacity-50"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <div>
                    <CustomSelect
                      value={clientTaxMode}
                      disabled={!clientTaxEnabled}
                      onChange={(val) =>
                        setClientTaxMode(val === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE")
                      }
                      options={TAX_MODE_OPTIONS}
                      searchable={false}
                      buttonClassName="text-xs py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clientAutoDeductStock}
                        onChange={(e) => setClientAutoDeductStock(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600"
                      />
                      Potong stok otomatis saat penjualan (disarankan nonaktif agar mutasi fisik &amp; opname mingguan tetap terpisah)
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3B: Daftar Pos Kas / Rekening Klien */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-300" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Sesuaikan Pos Kas &amp; Rekening Bank Klien
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Atur nama laci kasir, rekening bank/QRIS, dan akun tabungan cadangan klien (saldo awal dicatat via mutasi Saldo Awal).
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyCashAccounts}
              onChange={(e) => setApplyCashAccounts(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
          </label>

          <AnimatePresence>
            {applyCashAccounts && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 space-y-2.5">
                  {clientCashAccounts.map((acc, idx) => (
                    <div
                      key={acc.id + "-" + idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) =>
                            setClientCashAccounts((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, name: e.target.value } : row
                              )
                            )
                          }
                          placeholder="Nama Pos Kas / Bank"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <CustomSelect
                          value={acc.type}
                          onChange={(val) =>
                            setClientCashAccounts((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      type: val as EditableCashAccountRow["type"],
                                      isDefault:
                                        val === "SAVINGS" || val === "E_WALLET"
                                          ? false
                                          : row.isDefault,
                                    }
                                  : row
                              )
                            )
                          }
                          options={CASH_TYPE_OPTIONS}
                          searchable={false}
                          buttonClassName="text-xs py-2"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                        {(acc.type === "CASH" || acc.type === "BANK") && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultCash(idx)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                              acc.isDefault
                                ? "bg-brand-600 text-white border-brand-600"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {acc.isDefault ? "Default" : "Set Default"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={clientCashAccounts.length <= 1}
                          onClick={() => handleRemoveCashRow(idx)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 disabled:opacity-40 cursor-pointer"
                          aria-label="Hapus Pos Kas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddCashRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-slate-900 text-xs font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/15 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Pos Kas / Rekening
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3C: Buat Akun Baru Klien */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-4 h-4 text-brand-600 dark:text-brand-300" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Buat Akun Staff / Owner / Kasir Klien Sekaligus ({newUsers.length})
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Opsional — langsung siapkan akun login dengan PIN 6 digit unik selain PIN default 123456.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddNewUserRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Akun Klien
            </button>
          </div>

          <AnimatePresence>
            {newUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-700"
              >
                {newUsers.map((nu) => (
                  <div
                    key={nu.localId}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={nu.name}
                        onChange={(e) =>
                          setNewUsers((prev) =>
                            prev.map((row) =>
                              row.localId === nu.localId ? { ...row, name: e.target.value } : row
                            )
                          )
                        }
                        placeholder="Nama Lengkap"
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={nu.username}
                        onChange={(e) =>
                          setNewUsers((prev) =>
                            prev.map((row) =>
                              row.localId === nu.localId
                                ? { ...row, username: e.target.value.toLowerCase().replace(/\s+/g, "") }
                                : row
                            )
                          )
                        }
                        placeholder="username"
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs font-mono outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <CustomSelect
                        value={nu.role}
                        onChange={(val) =>
                          setNewUsers((prev) =>
                            prev.map((row) =>
                              row.localId === nu.localId
                                ? {
                                    ...row,
                                    role: val as NewClientUserRow["role"],
                                  }
                                : row
                            )
                          )
                        }
                        options={ROLE_OPTIONS}
                        searchable={false}
                        buttonClassName="text-xs py-2"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={nu.department}
                        onChange={(e) =>
                          setNewUsers((prev) =>
                            prev.map((row) =>
                              row.localId === nu.localId
                                ? { ...row, department: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="Divisi"
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-1">
                      <div className="relative flex-1">
                        <input
                          type={nu.showPin ? "text" : "password"}
                          maxLength={6}
                          inputMode="numeric"
                          value={nu.pin}
                          onChange={(e) =>
                            setNewUsers((prev) =>
                              prev.map((row) =>
                                row.localId === nu.localId
                                  ? { ...row, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }
                                  : row
                              )
                            )
                          }
                          placeholder="PIN 6 digit"
                          className="w-full pl-2.5 pr-7 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs font-mono tabular-nums outline-none focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNewUsers((prev) =>
                              prev.map((row) =>
                                row.localId === nu.localId
                                  ? { ...row, showPin: !row.showPin }
                                  : row
                              )
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          aria-label="Lihat PIN"
                        >
                          {nu.showPin ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewUserRow(nu.localId)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 cursor-pointer"
                        aria-label="Hapus baris akun"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Step 4: Action Trigger */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Total target dibersihkan:{" "}
          <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
            {sectionTotals.selectedToDelete.toLocaleString("id-ID")} baris
          </span>{" "}
          (diperlukan PIN Super Admin &amp; ketik ulang kalimat konfirmasi).
        </p>
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Bersihkan Data Terpilih...
        </button>
      </div>

      {/* Portal Confirmation Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isConfirmOpen && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => !isExecuting && setIsConfirmOpen(false)}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="relative z-10 w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-coffee-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                          Konfirmasi Pembersihan Database
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Tindakan ini permanen untuk kelompok yang Anda centang.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isExecuting}
                      onClick={() => setIsConfirmOpen(false)}
                      className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {!hasDownloadedBackup && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Anda belum mengunduh <strong>Backup JSON</strong> di sesi ini. Disarankan mengunduh backup terlebih dahulu sebelum lanjut.
                      </span>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/90 dark:bg-slate-800/70 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Ringkasan Kelompok Terpilih:
                    </p>
                    {CLEANING_GROUP_DEFINITIONS.filter((g) => groups[g.key]).map((g) => (
                      <div
                        key={g.key}
                        className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200"
                      >
                        <span className="truncate pr-2">• {g.label}</span>
                        <span className="font-bold tabular-nums shrink-0 text-rose-600 dark:text-rose-400">
                          {Number(inventory?.groupCounts?.[g.key] || 0).toLocaleString("id-ID")} baris
                        </span>
                      </div>
                    ))}
                    {Object.values(groups).every((v) => !v) && (
                      <p className="text-xs text-slate-500">
                        Tidak ada data yang dihapus (hanya menjalankan setup klien / nonaktifkan auto-seed).
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleExecuteClean} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                        PIN Super Admin (@{currentUser?.username})
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showAdminPin ? "text" : "password"}
                          inputMode="numeric"
                          value={adminPin}
                          onChange={(e) => setAdminPin(e.target.value)}
                          placeholder="Masukkan PIN Super Admin..."
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono outline-none focus:border-brand-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPin((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showAdminPin ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                        Ketik persis kalimat berikut untuk konfirmasi:{" "}
                        <code className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono">
                          {CLEANING_CONFIRM_PHRASE}
                        </code>
                      </label>
                      <input
                        type="text"
                        value={confirmPhraseInput}
                        onChange={(e) => setConfirmPhraseInput(e.target.value)}
                        placeholder={CLEANING_CONFIRM_PHRASE}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono outline-none focus:border-rose-500"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        disabled={isExecuting}
                        onClick={() => setIsConfirmOpen(false)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isExecuting ||
                          confirmPhraseInput.trim() !== CLEANING_CONFIRM_PHRASE ||
                          !adminPin.trim()
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExecuting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Ya, Bersihkan Data Sekarang
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
