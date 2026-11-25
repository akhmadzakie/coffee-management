import { CORE_EXPENSE_CATEGORY_IDS } from "./dataCleaning";
import { normalizeIngredientCategoryName } from "./financeMetrics";
import { getMappedChannelsForAccount } from "./paymentRouting";
import {
  CashAccount,
  CashTransaction,
  DailySalesRecap,
  ExpenseCategory,
  PaymentAccountMapping,
} from "../types";

export type CriticalIngredientRole = "OLAHAN" | "PACKAGING" | "FALLBACK";

export interface CashAccountProtection {
  isDefaultCash: boolean;
  isOnlyBankAccount: boolean;
  linkedTxCount: number;
  linkedRecapCount: number;
  mappedPaymentChannels: string[];
  balance: number;
  canDelete: boolean;
  deleteBlockReason?: string;
  canChangeType: boolean;
  typeLockReason?: string;
}

/**
 * Mengecek apakah Pos Kategori Keuangan termasuk 33 kategori inti terintegrasi sistem.
 */
export function isCoreExpenseCategory(
  categoryOrId: string | Pick<ExpenseCategory, "id"> | null | undefined
): boolean {
  if (!categoryOrId) return false;
  const id = typeof categoryOrId === "string" ? categoryOrId : categoryOrId.id;
  return CORE_EXPENSE_CATEGORY_IDS.has(String(id || "").trim());
}

/**
 * Menjaga integritas struktur (type & parentId) kategori bawaan sistem saat diedit.
 * Pengguna tetap bebas mengganti nama, warna, ikon, status aktif, dan urutan tampil.
 */
export function sanitizeCoreExpenseCategoryUpdate<
  T extends Pick<ExpenseCategory, "id" | "type" | "parentId">
>(incoming: T, existing?: T | null): T {
  if (!existing || !isCoreExpenseCategory(existing.id)) {
    return incoming;
  }
  return {
    ...incoming,
    type: existing.type,
    parentId: existing.parentId ?? null,
  };
}

/**
 * Penjaga sisi server saat `/api/sync`:
 * - Mencegah penghapusan 33 kategori keuangan inti (`CORE_EXPENSE_CATEGORY_IDS`).
 * - Mengunci `type` dan `parentId` kategori inti sesuai DB, namun tetap mengizinkan perubahan nama/ikon/warna.
 */
export function protectCoreExpenseCategoriesOnSync<
  T extends { id?: string; type?: string; parentId?: string | null }
>(incoming: T[], existingDb: T[]): T[] {
  const existingCoreMap = new Map<string, T>();
  for (const row of existingDb) {
    if (row?.id && CORE_EXPENSE_CATEGORY_IDS.has(String(row.id))) {
      existingCoreMap.set(String(row.id), row);
    }
  }

  const seenIds = new Set<string>();
  const guarded: T[] = incoming.map((row) => {
    const id = String(row?.id || "");
    if (id) seenIds.add(id);
    const existingCore = existingCoreMap.get(id);
    if (!existingCore) return row;
    return {
      ...row,
      type: existingCore.type,
      parentId: existingCore.parentId ?? null,
    };
  });

  for (const [coreId, existingCore] of existingCoreMap.entries()) {
    if (!seenIds.has(coreId)) {
      guarded.push(existingCore);
    }
  }

  return guarded;
}

/**
 * Mengidentifikasi apakah nama kategori bahan memiliki peran fungsional kritis (Opsi 2):
 * - OLAHAN: terintegrasi dengan tombol "+ Bahan Olahan" & Kalkulator Batch Prep
 * - PACKAGING: terintegrasi dengan pemisahan biaya kemasan di Kalkulator HPP
 * - FALLBACK: cadangan bawaan "Lainnya"
 */
export function getCriticalIngredientCategoryRole(
  catName?: string | null
): CriticalIngredientRole | null {
  const clean = String(catName || "").trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const normalized = normalizeIngredientCategoryName(clean).toLowerCase();

  if (lower === "lainnya" || normalized === "lainnya") {
    return "FALLBACK";
  }

  if (
    normalized === "bahan olahan" ||
    ["olahan", "racikan", "batch prep", "sub-recipe"].some((kw) => lower.includes(kw))
  ) {
    return "OLAHAN";
  }

  if (
    normalized === "packaging & cup" ||
    ["packaging", "kemasan", "cup"].some((kw) => lower.includes(kw))
  ) {
    return "PACKAGING";
  }

  return null;
}

/**
 * Opsi 2: Kategori bahan terintegrasi kritis (Bahan Olahan, Packaging & Cup, Lainnya) dilarang dihapus.
 */
export function isProtectedIngredientCategory(catName?: string | null): boolean {
  return getCriticalIngredientCategoryRole(catName) !== null;
}

export function getProtectedIngredientCategoryReason(catName?: string | null): string | null {
  const role = getCriticalIngredientCategoryRole(catName);
  if (role === "OLAHAN") {
    return 'Kategori "Bahan Olahan" terintegrasi otomatis dengan tombol + Bahan Olahan & Kalkulator Batch Prep sehingga tidak dapat dihapus (hanya boleh diubah namanya).';
  }
  if (role === "PACKAGING") {
    return 'Kategori "Packaging & Cup" terintegrasi otomatis dengan pemisahan biaya kemasan di Kalkulator HPP sehingga tidak dapat dihapus (hanya boleh diubah namanya).';
  }
  if (role === "FALLBACK") {
    return 'Kategori "Lainnya" adalah cadangan bawaan sistem sehingga tidak dapat dihapus.';
  }
  return null;
}

/**
 * Memvalidasi rename kategori bahan agar kategori terintegrasi tetap dikenali modul HPP & Batch Prep.
 */
export function validateIngredientCategoryRename(
  oldName: string,
  newName: string
): { valid: boolean; reason?: string } {
  const cleanNew = String(newName || "").trim();
  if (!cleanNew) {
    return { valid: false, reason: "Nama kategori baru tidak boleh kosong." };
  }
  const role = getCriticalIngredientCategoryRole(oldName);
  if (!role) return { valid: true };

  if (role === "FALLBACK" && cleanNew.toLowerCase() !== "lainnya") {
    return {
      valid: false,
      reason: 'Kategori cadangan "Lainnya" tidak dapat diubah namanya.',
    };
  }
  if (role === "OLAHAN" && getCriticalIngredientCategoryRole(cleanNew) !== "OLAHAN") {
    return {
      valid: false,
      reason:
        'Nama kategori ini harus tetap mengandung kata "Olahan" atau "Racikan" agar integrasi Batch Prep & HPP tetap aktif.',
    };
  }
  if (role === "PACKAGING" && getCriticalIngredientCategoryRole(cleanNew) !== "PACKAGING") {
    return {
      valid: false,
      reason:
        'Nama kategori kemasan harus tetap mengandung kata "Packaging", "Kemasan", atau "Cup" agar pemisahan biaya kemasan HPP tetap aktif.',
    };
  }
  return { valid: true };
}

/**
 * Mengevaluasi aturan proteksi Pos Kas, Rekening Bank, & Rekening Tabungan (`SAVINGS`):
 * - Pos Kas Utama (`isDefault` / `cash-drawer-main`): dilarang dihapus & jenis dikunci `CASH`.
 * - Satu-satunya Rekening Bank (`BANK`) yang aktif: dilarang dihapus & dikunci `BANK` karena terhubung ke Rekap Penjualan / Setor Kas.
 * - Akun dengan saldo != 0, riwayat transaksi, atau tertaut ke Rekap Penjualan (`bankAccountId`): dilarang dihapus & dikunci jenisnya,
 *   hanya boleh diubah namanya.
 * - Akun non-default tambahan yang masih kosong (0 transaksi, saldo Rp 0, 0 tautan rekap, dan bukan BANK terakhir): boleh dihapus / diubah jenisnya.
 */
export function evaluateCashAccountProtection(
  account: CashAccount,
  allAccounts: CashAccount[],
  cashTransactions: CashTransaction[],
  dailySalesRecaps: Pick<DailySalesRecap, "bankAccountId">[] = [],
  paymentAccountMapping?: PaymentAccountMapping | null
): CashAccountProtection {
  const isDefaultCash =
    Boolean(account.isDefault) || account.id === "cash-drawer-main";
  const bankCount = allAccounts.filter((a) => a.type === "BANK").length;
  const isOnlyBankAccount = account.type === "BANK" && bankCount <= 1;
  const mappedPaymentChannels = getMappedChannelsForAccount(
    account.id,
    paymentAccountMapping
  );

  let linkedTxCount = 0;
  let balance = 0;
  for (const t of cashTransactions) {
    if (t.accountId !== account.id) continue;
    linkedTxCount += 1;
    const amt = Math.round(Number(t.amount) || 0);
    if (t.type === "CASH_IN") balance += amt;
    else if (t.type === "CASH_OUT") balance -= amt;
  }

  let linkedRecapCount = 0;
  for (const r of dailySalesRecaps) {
    if (r?.bankAccountId === account.id) linkedRecapCount += 1;
  }

  let canDelete = true;
  let deleteBlockReason: string | undefined;

  if (isDefaultCash) {
    canDelete = false;
    deleteBlockReason =
      "Pos Kas Utama terhubung otomatis ke POS Kasir & Tutup Shift sehingga tidak dapat dihapus (hanya boleh diubah namanya).";
  } else if (allAccounts.length <= 1) {
    canDelete = false;
    deleteBlockReason = "Minimal harus ada 1 Pos Kas aktif di sistem.";
  } else if (isOnlyBankAccount) {
    canDelete = false;
    deleteBlockReason =
      "Minimal harus ada 1 Rekening Bank aktif karena terhubung otomatis ke Rekap Penjualan (QRIS/EDC/Ojol) & Setor Kas. Anda tetap dapat mengubah namanya.";
  } else if (mappedPaymentChannels.length > 0) {
    canDelete = false;
    deleteBlockReason = `Rekening ini sedang dipasang sebagai tujuan default metode pembayaran (${mappedPaymentChannels.join(", ")}). Pindahkan dulu default-nya di Pengaturan jika ingin menghapus (tetap boleh ubah nama).`;
  } else if (linkedRecapCount > 0) {
    canDelete = false;
    deleteBlockReason = `Rekening ini terhubung ke ${linkedRecapCount} Rekap Penjualan (termasuk pencairan non-tunai) sehingga tidak dapat dihapus. Anda tetap dapat mengubah namanya.`;
  } else if (linkedTxCount > 0 || balance !== 0) {
    canDelete = false;
    deleteBlockReason =
      account.type === "SAVINGS"
        ? `Rekening Tabungan ini sudah memiliki ${linkedTxCount} mutasi atau saldo aktif sehingga tidak dapat dihapus agar laporan Dana Cadangan tetap akurat. Anda tetap dapat mengubah namanya.`
        : `Pos Kas ini sudah memiliki ${linkedTxCount} riwayat transaksi atau saldo aktif sehingga tidak dapat dihapus. Anda tetap dapat mengubah namanya.`;
  }

  let canChangeType = true;
  let typeLockReason: string | undefined;

  if (isDefaultCash) {
    canChangeType = false;
    typeLockReason =
      "Jenis Pos Kas Utama dikunci sebagai Tunai (CASH) untuk integrasi laci kasir POS.";
  } else if (isOnlyBankAccount) {
    canChangeType = false;
    typeLockReason =
      "Jenis Rekening Bank utama dikunci sebagai BANK agar Rekap Penjualan & pencairan non-tunai selalu memiliki rekening tujuan.";
  } else if (mappedPaymentChannels.length > 0) {
    canChangeType = false;
    typeLockReason = `Jenis rekening dikunci karena menjadi tujuan default (${mappedPaymentChannels.join(", ")}). Nama rekening tetap dapat diubah.`;
  } else if (linkedRecapCount > 0) {
    canChangeType = false;
    typeLockReason =
      "Jenis rekening dikunci karena sudah tertaut ke Rekap Penjualan / pencairan non-tunai. Nama rekening tetap dapat diubah.";
  } else if (linkedTxCount > 0 || balance !== 0) {
    canChangeType = false;
    typeLockReason =
      account.type === "SAVINGS"
        ? "Jenis rekening dikunci karena sudah memiliki riwayat mutasi tabungan. Nama rekening tetap dapat diubah."
        : "Jenis rekening dikunci karena sudah memiliki riwayat transaksi agar klasifikasi kas & tabungan tidak berubah.";
  }

  return {
    isDefaultCash,
    isOnlyBankAccount,
    linkedTxCount,
    linkedRecapCount,
    mappedPaymentChannels,
    balance,
    canDelete,
    deleteBlockReason,
    canChangeType,
    typeLockReason,
  };
}

/**
 * Penjaga sisi server saat `/api/sync` untuk `cash_accounts`:
 * - Mencegah penghapusan Pos Kas Utama, rekening bank terakhir, rekening tujuan default metode bayar, rekening yang tertaut Rekap Penjualan, maupun akun dengan transaksi di DB.
 * - Mengunci `type` (dan `isDefault` kas utama) sesuai DB jika terproteksi, sambil mengizinkan rename `name`.
 */
export function protectCashAccountsOnSync<
  T extends { id?: string; type?: string; isDefault?: boolean }
>(
  incoming: T[],
  existingDb: T[],
  existingTxDb: Array<{ accountId?: string | null }>,
  existingRecapsDb: Array<{ bankAccountId?: string | null }> = [],
  paymentAccountMapping?: PaymentAccountMapping | null
): T[] {
  const txCountByAccount = new Map<string, number>();
  for (const tx of existingTxDb) {
    const accId = String(tx?.accountId || "");
    if (!accId) continue;
    txCountByAccount.set(accId, (txCountByAccount.get(accId) || 0) + 1);
  }

  const recapCountByAccount = new Map<string, number>();
  for (const recap of existingRecapsDb) {
    const bankId = String(recap?.bankAccountId || "");
    if (!bankId) continue;
    recapCountByAccount.set(bankId, (recapCountByAccount.get(bankId) || 0) + 1);
  }

  const mappedAccountIds = new Set<string>();
  if (paymentAccountMapping) {
    for (const val of Object.values(paymentAccountMapping)) {
      if (typeof val === "string" && val.trim()) mappedAccountIds.add(val.trim());
    }
  }

  const protectedExistingMap = new Map<string, T>();
  for (const acc of existingDb) {
    const id = String(acc?.id || "");
    if (!id) continue;
    const isDefaultCash = Boolean(acc.isDefault) || id === "cash-drawer-main";
    const hasTxs = (txCountByAccount.get(id) || 0) > 0;
    const hasRecaps = (recapCountByAccount.get(id) || 0) > 0;
    const isMapped = mappedAccountIds.has(id);
    if (isDefaultCash || hasTxs || hasRecaps || isMapped) {
      protectedExistingMap.set(id, acc);
    }
  }

  // Ensure at least 1 BANK account survives if existingDb had any BANK account
  const existingBanks = existingDb.filter((a) => a?.type === "BANK" && a?.id);
  const incomingHasBankAfterLock = incoming.some((row) => {
    const id = String(row?.id || "");
    const locked = protectedExistingMap.get(id);
    const effectiveType = locked ? locked.type : row?.type;
    return effectiveType === "BANK";
  });
  if (existingBanks.length > 0 && !incomingHasBankAfterLock) {
    // Prefer an existing BANK account already present in incoming so its name edit is honored; else fallback to first existing BANK
    const preferredExistingBank =
      existingBanks.find((eb) => incoming.some((row) => String(row?.id || "") === String(eb.id))) ||
      existingBanks[0];
    if (preferredExistingBank?.id) {
      protectedExistingMap.set(String(preferredExistingBank.id), preferredExistingBank);
    }
  }

  const seenIds = new Set<string>();
  const guarded: T[] = incoming.map((row) => {
    const id = String(row?.id || "");
    if (id) seenIds.add(id);
    const locked = protectedExistingMap.get(id);
    if (!locked) return row;
    const isDefaultCash = Boolean(locked.isDefault) || id === "cash-drawer-main";
    return {
      ...row,
      type: locked.type,
      isDefault: isDefaultCash ? true : row.isDefault,
    };
  });

  for (const [accId, locked] of protectedExistingMap.entries()) {
    if (!seenIds.has(accId)) {
      guarded.push(locked);
    }
  }

  return guarded;
}
