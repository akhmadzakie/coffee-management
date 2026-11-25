import { CORE_EXPENSE_CATEGORY_IDS } from "./dataCleaning";
import { normalizeIngredientCategoryName } from "./financeMetrics";
import { CashAccount, CashTransaction, ExpenseCategory } from "../types";

export type CriticalIngredientRole = "OLAHAN" | "PACKAGING" | "FALLBACK";

export interface CashAccountProtection {
  isDefaultCash: boolean;
  linkedTxCount: number;
  balance: number;
  canDelete: boolean;
  deleteBlockReason?: string;
  canChangeType: boolean;
  typeLockReason?: string;
}

/**
 * Mengecek apakah Pos Kategori Keuangan termasuk 32 kategori inti terintegrasi sistem.
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
 * - Mencegah penghapusan 32 kategori keuangan inti (`CORE_EXPENSE_CATEGORY_IDS`).
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
 * Mengevaluasi aturan proteksi Pos Kas & Rekening Tabungan (`SAVINGS`):
 * - Pos Kas Utama (`isDefault` / `cash-drawer-main`): dilarang dihapus & jenis dikunci `CASH`.
 * - Akun dengan saldo != 0 atau riwayat transaksi (termasuk Tabungan): dilarang dihapus & dikunci jenisnya,
 *   hanya boleh diubah namanya.
 * - Akun non-default yang masih kosong (0 transaksi & saldo Rp 0): boleh dihapus / diubah jenisnya.
 */
export function evaluateCashAccountProtection(
  account: CashAccount,
  allAccounts: CashAccount[],
  cashTransactions: CashTransaction[]
): CashAccountProtection {
  const isDefaultCash =
    Boolean(account.isDefault) || account.id === "cash-drawer-main";

  let linkedTxCount = 0;
  let balance = 0;
  for (const t of cashTransactions) {
    if (t.accountId !== account.id) continue;
    linkedTxCount += 1;
    const amt = Math.round(Number(t.amount) || 0);
    if (t.type === "CASH_IN") balance += amt;
    else if (t.type === "CASH_OUT") balance -= amt;
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
  } else if (linkedTxCount > 0 || balance !== 0) {
    canChangeType = false;
    typeLockReason =
      account.type === "SAVINGS"
        ? "Jenis rekening dikunci karena sudah memiliki riwayat mutasi tabungan. Nama rekening tetap dapat diubah."
        : "Jenis rekening dikunci karena sudah memiliki riwayat transaksi agar klasifikasi kas & tabungan tidak berubah.";
  }

  return {
    isDefaultCash,
    linkedTxCount,
    balance,
    canDelete,
    deleteBlockReason,
    canChangeType,
    typeLockReason,
  };
}

/**
 * Penjaga sisi server saat `/api/sync` untuk `cash_accounts`:
 * - Mencegah penghapusan Pos Kas Utama maupun akun yang sudah memiliki transaksi di DB.
 * - Mengunci `type` (dan `isDefault` kas utama) sesuai DB jika sudah ada transaksi, sambil mengizinkan rename `name`.
 */
export function protectCashAccountsOnSync<
  T extends { id?: string; type?: string; isDefault?: boolean }
>(
  incoming: T[],
  existingDb: T[],
  existingTxDb: Array<{ accountId?: string | null }>
): T[] {
  const txCountByAccount = new Map<string, number>();
  for (const tx of existingTxDb) {
    const accId = String(tx?.accountId || "");
    if (!accId) continue;
    txCountByAccount.set(accId, (txCountByAccount.get(accId) || 0) + 1);
  }

  const protectedExistingMap = new Map<string, T>();
  for (const acc of existingDb) {
    const id = String(acc?.id || "");
    if (!id) continue;
    const isDefaultCash = Boolean(acc.isDefault) || id === "cash-drawer-main";
    const hasTxs = (txCountByAccount.get(id) || 0) > 0;
    if (isDefaultCash || hasTxs) {
      protectedExistingMap.set(id, acc);
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
