export const CLEANING_CONFIRM_PHRASE = "BERSIHKAN DATA KLIEN";

export const LOCAL_STORAGE_DATA_CACHE_KEYS = [
  "app_settings_cache",
  "app_cash_accounts_cache",
  "app_cash_transactions_cache",
  "app_ingredients_cache",
  "app_recipes_cache",
  "app_products_cache",
  "app_batch_preparations_cache",
  "coffee_promotions",
  "app_daily_sales_recaps",
  "kpi_tasks",
  "kpi_bonus_rules",
  "app_expense_categories_cache",
] as const;

/**
 * Seluruh 32 ID kategori keuangan bawaan (defaultCategories di server.ts).
 * ID-ID ini dirujuk langsung oleh mesin P&L, HPP, CapEx, dan auto-overhead
 * sehingga wajib dipertahankan agar laporan keuangan klien tidak rusak.
 */
export const CORE_EXPENSE_CATEGORY_IDS = new Set<string>([
  "cat-pendapatan",
  "cat-pengeluaran",
  "cat-bahan-baku",
  "cat-utilitas",
  "cat-hrd",
  "cat-aset",
  "cat-lainnya",
  "cat-penjualan",
  "cat-penjualan-makanan",
  "cat-pendapatan-lain",
  "cat-sewa",
  "cat-kebersihan",
  "cat-marketing-ops",
  "cat-opex-lain",
  "cat-kopi",
  "cat-susu",
  "cat-minuman",
  "cat-packaging",
  "cat-bahan-lain",
  "cat-listrik",
  "cat-air",
  "cat-internet",
  "cat-gas",
  "cat-gaji",
  "cat-bpjs",
  "cat-tunjangan",
  "cat-pelatihan",
  "cat-aset-mesin",
  "cat-aset-furnitur",
  "cat-aset-renovasi",
  "cat-admin-bank",
  "cat-lain-rupa",
]);

export type CleaningGroupKey =
  | "salesPos"
  | "financeCash"
  | "inventoryOps"
  | "hrAudit"
  | "catalogMenu"
  | "catalogIngredients"
  | "hrSuppliers"
  | "promotions"
  | "dummyUsers"
  | "devicesPrinters"
  | "kpiTemplates"
  | "customExpenseCategories";

export type CleaningSection = "TRANSACTIONS" | "MASTER_DATA" | "ACCOUNTS_SYSTEM";

export interface CleaningGroupDefinition {
  key: CleaningGroupKey;
  section: CleaningSection;
  label: string;
  description: string;
  tables: string[];
  defaultSelected: boolean;
}

export const CLEANING_GROUP_DEFINITIONS: CleaningGroupDefinition[] = [
  // A. Transaksi & Riwayat
  {
    key: "salesPos",
    section: "TRANSACTIONS",
    label: "Penjualan, POS Orders, Pembayaran & Shift Kasir",
    description:
      "Menghapus pesanan POS, item order, pembayaran, penjualan, rekap harian, log impor, shift kasir, dan request persetujuan supervisor.",
    tables: [
      "payments",
      "order_items",
      "orders",
      "sales_transactions",
      "daily_sales_recaps",
      "sales_import_logs",
      "shifts",
      "manager_approval_requests",
    ],
    defaultSelected: true,
  },
  {
    key: "financeCash",
    section: "TRANSACTIONS",
    label: "Arus Kas, Budget, Rekonsiliasi Bank & Tutup Buku",
    description:
      "Menghapus transaksi kas masuk/keluar/transfer, anggaran bulanan, rekonsiliasi bank, baris mutasi rekening, dan periode tutup buku.",
    tables: [
      "bank_statement_lines",
      "bank_reconciliations",
      "cash_transactions",
      "budgets",
      "closed_periods",
    ],
    defaultSelected: true,
  },
  {
    key: "inventoryOps",
    section: "TRANSACTIONS",
    label: "Mutasi Stok, Stok Opname & Purchase Order (PO)",
    description:
      "Menghapus kartu stok masuk/keluar, berita acara opname, dan daftar PO. Jika bahan baku dipertahankan, stok bahan otomatis dinolkan.",
    tables: [
      "stock_opname_items",
      "stock_opnames",
      "stock_movements",
      "purchase_orders",
    ],
    defaultSelected: true,
  },
  {
    key: "hrAudit",
    section: "TRANSACTIONS",
    label: "Absensi, Checklist Harian, Payroll, KPI Record & Audit Log",
    description:
      "Menghapus absensi harian/bulanan, checklist leader, slip gaji/payroll, catatan KPI karyawan, dan riwayat audit log uji coba.",
    tables: [
      "daily_attendances",
      "daily_checklists",
      "attendance_records",
      "payroll_records",
      "kpi_records",
      "audit_logs",
    ],
    defaultSelected: true,
  },

  // B. Master Data & Katalog
  {
    key: "catalogMenu",
    section: "MASTER_DATA",
    label: "Produk Menu, Resep & Batch Prep",
    description:
      "Mengosongkan katalog menu POS, varian produk, resep standar (BOM), dan template produksi batch.",
    tables: ["batch_preparations", "recipes", "products"],
    defaultSelected: true,
  },
  {
    key: "catalogIngredients",
    section: "MASTER_DATA",
    label: "Bahan Baku (Ingredients)",
    description:
      "Mengosongkan seluruh daftar bahan baku dummy agar siap diisi katalog & satuan khusus klien.",
    tables: ["ingredients"],
    defaultSelected: true,
  },
  {
    key: "hrSuppliers",
    section: "MASTER_DATA",
    label: "Supplier & Data Karyawan (Kontrak & Jadwal Shift)",
    description:
      "Menghapus master supplier uji coba, profil karyawan, kontrak kerja, dan jadwal shift.",
    tables: ["employee_shifts", "employee_contracts", "employees", "suppliers"],
    defaultSelected: true,
  },
  {
    key: "promotions",
    section: "MASTER_DATA",
    label: "Promo & Diskon Bawaan (MEMBER10, BERKAH5K)",
    description:
      "Menghapus promo bawaan/dummy agar klien dapat membuat program promo sendiri.",
    tables: ["promotions"],
    defaultSelected: true,
  },

  // C. Akun, Perangkat & Template
  {
    key: "dummyUsers",
    section: "ACCOUNTS_SYSTEM",
    label: "Akun Pengguna Dummy / Lama (Kecuali Super Admin Aktif)",
    description:
      "Menghapus akun uji coba (Budi, Rama, dll.). Super Admin yang sedang login selalu dilindungi dan Anda bisa memilih akun lain untuk dipertahankan.",
    tables: ["users"],
    defaultSelected: true,
  },
  {
    key: "devicesPrinters",
    section: "ACCOUNTS_SYSTEM",
    label: "Sesi Perangkat Lama & Konfigurasi Printer POS",
    description:
      "Membersihkan sesi device lama (kecuali browser Anda saat ini) dan konfigurasi printer thermal uji coba.",
    tables: ["pos_printers", "device_sessions"],
    defaultSelected: true,
  },
  {
    key: "kpiTemplates",
    section: "ACCOUNTS_SYSTEM",
    label: "Template Tugas KPI & Aturan Bonus KPI",
    description:
      "Secara default dipertahankan sebagai template siap pakai. Centang hanya jika ingin merancang KPI dari kosong.",
    tables: ["kpi_tasks", "kpi_bonus_rules"],
    defaultSelected: false,
  },
  {
    key: "customExpenseCategories",
    section: "ACCOUNTS_SYSTEM",
    label: "Kategori Keuangan Kustom (Kategori Inti Tetap Aman)",
    description:
      "Menghapus hanya kategori tambahan buatan uji coba. Seluruh 32 kategori keuangan inti sistem tetap dipertahankan.",
    tables: ["expense_categories"],
    defaultSelected: false,
  },
];

export const CLEANING_GROUP_KEYS = CLEANING_GROUP_DEFINITIONS.map((g) => g.key);

export function parseCleaningGroups(
  raw?: Partial<Record<CleaningGroupKey, unknown>> | null
): Record<CleaningGroupKey, boolean> {
  const result = {} as Record<CleaningGroupKey, boolean>;
  const hasExplicitInput = Boolean(raw && typeof raw === "object");
  for (const def of CLEANING_GROUP_DEFINITIONS) {
    if (!hasExplicitInput) {
      result[def.key] = def.defaultSelected;
    } else if (raw && Object.prototype.hasOwnProperty.call(raw, def.key)) {
      result[def.key] = Boolean((raw as Record<string, unknown>)[def.key]);
    } else {
      result[def.key] = def.defaultSelected;
    }
  }
  return result;
}

function parseJsonObjectSafe(val: unknown): Record<string, any> {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) return { ...(val as Record<string, any>) };
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function extractCleaningMetaFromSettings(settingsRow?: any): {
  autoSeedDisabled: boolean;
  lastCleanedAt: string | null;
} {
  if (!settingsRow || typeof settingsRow !== "object") {
    return { autoSeedDisabled: false, lastCleanedAt: null };
  }
  const divTarget = parseJsonObjectSafe(settingsRow.divisionKpiBonusTarget);
  const autoSeedDisabled = Boolean(
    settingsRow.autoSeedDisabled === true || divTarget.__autoSeedDisabled === true
  );
  const rawCleanedAt = settingsRow.lastCleanedAt ?? divTarget.__lastCleanedAt ?? null;
  const lastCleanedAt =
    typeof rawCleanedAt === "string" && rawCleanedAt.trim() ? rawCleanedAt.trim() : null;
  return { autoSeedDisabled, lastCleanedAt };
}

export function shouldAutoSeedDummyData(settingsRow?: any): boolean {
  return !extractCleaningMetaFromSettings(settingsRow).autoSeedDisabled;
}

export const VALID_CLIENT_USER_ROLES = [
  "OWNER",
  "MANAGER",
  "FINANCE",
  "KASIR",
  "LEADER",
  "BAR",
  "KITCHEN",
  "BAKER",
  "SUPER_ADMIN",
] as const;

export const VALID_CASH_ACCOUNT_TYPES = ["CASH", "BANK", "SAVINGS", "E_WALLET"] as const;

export interface ClientSetupProfileInput {
  brandName: string;
  companyAddress?: string;
  bankDetails?: string;
  footerMessage?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  taxMode?: "INCLUSIVE" | "EXCLUSIVE";
  monthlyRevenueTarget?: number;
  autoDeductStockOnSale?: boolean;
}

export interface ClientSetupCashAccountInput {
  id?: string;
  name: string;
  type: "CASH" | "BANK" | "SAVINGS" | "E_WALLET";
  isDefault?: boolean;
}

export interface ClientSetupNewUserInput {
  name: string;
  username: string;
  role: (typeof VALID_CLIENT_USER_ROLES)[number];
  department?: string;
  pin: string;
}

export interface ClientSetupPayload {
  applyProfile?: boolean;
  profile?: ClientSetupProfileInput;
  applyCashAccounts?: boolean;
  cashAccounts?: ClientSetupCashAccountInput[];
  newUsers?: ClientSetupNewUserInput[];
}

export interface SanitizedClientSetup {
  applyProfile: boolean;
  profile?: {
    brandName: string;
    companyAddress: string;
    bankDetails: string;
    footerMessage: string;
    taxEnabled: boolean;
    taxRate: number;
    taxMode: "INCLUSIVE" | "EXCLUSIVE";
    monthlyRevenueTarget: number;
    autoDeductStockOnSale: boolean;
  };
  applyCashAccounts: boolean;
  cashAccounts: Array<{
    id: string;
    name: string;
    type: "CASH" | "BANK" | "SAVINGS" | "E_WALLET";
    isDefault: boolean;
  }>;
  newUsers: Array<{
    name: string;
    username: string;
    role: (typeof VALID_CLIENT_USER_ROLES)[number];
    department: string;
    pin: string;
  }>;
}

export function validateClientSetupPayload(
  payload: any,
  existingKeepUsernames: string[] = []
): {
  valid: boolean;
  errors: string[];
  sanitized: SanitizedClientSetup;
} {
  const errors: string[] = [];
  const raw = payload && typeof payload === "object" ? payload : {};

  const applyProfile = Boolean(raw.applyProfile);
  let sanitizedProfile: SanitizedClientSetup["profile"];

  if (applyProfile) {
    const p = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
    const brandName = String(p.brandName || "").trim();
    if (!brandName) {
      errors.push("Nama usaha / brand klien wajib diisi jika Profil Klien diaktifkan.");
    }
    const taxRateNum = Number(p.taxRate ?? 10);
    if (!Number.isFinite(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      errors.push("Tarif pajak PB1 harus berada di antara 0% sampai 100%.");
    }
    const taxMode: "INCLUSIVE" | "EXCLUSIVE" =
      p.taxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE";
    const monthlyTargetNum = Number(p.monthlyRevenueTarget ?? 0);
    if (!Number.isFinite(monthlyTargetNum) || monthlyTargetNum < 0) {
      errors.push("Target omzet bulanan tidak boleh negatif.");
    }
    sanitizedProfile = {
      brandName: brandName || "Kafe Klien",
      companyAddress: String(p.companyAddress || "").trim(),
      bankDetails: String(p.bankDetails || "").trim(),
      footerMessage: String(p.footerMessage || "").trim(),
      taxEnabled: Boolean(p.taxEnabled),
      taxRate: Math.min(100, Math.max(0, Number.isFinite(taxRateNum) ? taxRateNum : 10)),
      taxMode,
      monthlyRevenueTarget: Math.round(
        Math.max(0, Number.isFinite(monthlyTargetNum) ? monthlyTargetNum : 0)
      ),
      autoDeductStockOnSale: p.autoDeductStockOnSale === true,
    };
  }

  const applyCashAccounts = Boolean(raw.applyCashAccounts);
  const sanitizedAccounts: SanitizedClientSetup["cashAccounts"] = [];

  if (applyCashAccounts) {
    const rawList = Array.isArray(raw.cashAccounts) ? raw.cashAccounts : [];
    if (rawList.length === 0) {
      errors.push("Daftar Pos Kas minimal berisi 1 akun operasional (Kas / Bank).");
    } else {
      rawList.forEach((acc: any, idx: number) => {
        const name = String(acc?.name || "").trim();
        const typeRaw = String(acc?.type || "CASH").toUpperCase();
        const type = (VALID_CASH_ACCOUNT_TYPES as readonly string[]).includes(typeRaw)
          ? (typeRaw as "CASH" | "BANK" | "SAVINGS" | "E_WALLET")
          : "CASH";
        if (!name) {
          errors.push(`Nama Pos Kas baris ke-${idx + 1} tidak boleh kosong.`);
        }
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 32);
        const fallbackId = `${type.toLowerCase()}-${slug || "pos"}-${idx + 1}`;
        sanitizedAccounts.push({
          id: String(acc?.id || fallbackId).trim() || fallbackId,
          name,
          type,
          isDefault: Boolean(acc?.isDefault),
        });
      });

      const operationalAccounts = sanitizedAccounts.filter(
        (a) => a.type === "CASH" || a.type === "BANK"
      );
      if (operationalAccounts.length === 0) {
        errors.push(
          "Minimal harus ada 1 Pos Kas operasional bertipe CASH atau BANK untuk menerima pembayaran."
        );
      } else {
        let defaultIdx = sanitizedAccounts.findIndex(
          (a) => a.isDefault && (a.type === "CASH" || a.type === "BANK")
        );
        if (defaultIdx === -1) {
          defaultIdx = sanitizedAccounts.findIndex(
            (a) => a.type === "CASH" || a.type === "BANK"
          );
        }
        sanitizedAccounts.forEach((a, i) => {
          a.isDefault = i === defaultIdx;
        });
      }
    }
  }

  const rawNewUsers = Array.isArray(raw.newUsers) ? raw.newUsers : [];
  const sanitizedUsers: SanitizedClientSetup["newUsers"] = [];
  const seenUsernames = new Set(
    existingKeepUsernames.map((u) => String(u || "").trim().toLowerCase()).filter(Boolean)
  );

  rawNewUsers.forEach((u: any, idx: number) => {
    const name = String(u?.name || "").trim();
    const username = String(u?.username || "")
      .trim()
      .toLowerCase();
    const roleRaw = String(u?.role || "KASIR").toUpperCase();
    const pin = String(u?.pin || "").trim();
    const department = String(u?.department || "").trim();

    if (!name) {
      errors.push(`Nama lengkap akun baru ke-${idx + 1} wajib diisi.`);
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      errors.push(
        `Username akun ke-${idx + 1} ("${username || "-"}") harus 3–32 karakter huruf kecil, angka, titik, garis bawah, atau tanda hubung.`
      );
    } else if (seenUsernames.has(username)) {
      errors.push(`Username "${username}" duplikat atau sudah dipakai akun yang dipertahankan.`);
    } else {
      seenUsernames.add(username);
    }

    if (!(VALID_CLIENT_USER_ROLES as readonly string[]).includes(roleRaw)) {
      errors.push(`Role "${roleRaw}" pada akun ke-${idx + 1} tidak valid.`);
    }
    if (!/^\d{6}$/.test(pin)) {
      errors.push(`PIN akun "${username || `#${idx + 1}`}" harus tepat 6 digit angka.`);
    }

    sanitizedUsers.push({
      name,
      username,
      role: ((VALID_CLIENT_USER_ROLES as readonly string[]).includes(roleRaw)
        ? roleRaw
        : "KASIR") as (typeof VALID_CLIENT_USER_ROLES)[number],
      department,
      pin,
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      applyProfile,
      ...(sanitizedProfile ? { profile: sanitizedProfile } : {}),
      applyCashAccounts,
      cashAccounts: sanitizedAccounts,
      newUsers: sanitizedUsers,
    },
  };
}

export interface CleaningSummary {
  deletedByTable: Record<string, number>;
  deletedTotal: number;
  selectedGroupKeys: CleaningGroupKey[];
}

export function buildCleaningSummary(
  beforeCounts: Record<string, number>,
  afterCounts: Record<string, number>,
  selectedGroups: Record<CleaningGroupKey, boolean>
): CleaningSummary {
  const deletedByTable: Record<string, number> = {};
  let deletedTotal = 0;

  const allTables = new Set([
    ...Object.keys(beforeCounts || {}),
    ...Object.keys(afterCounts || {}),
  ]);

  for (const table of allTables) {
    const before = Math.max(0, Number(beforeCounts?.[table] ?? 0));
    const after = Math.max(0, Number(afterCounts?.[table] ?? 0));
    const delta = Math.max(0, before - after);
    if (delta > 0) {
      deletedByTable[table] = delta;
      deletedTotal += delta;
    }
  }

  const selectedGroupKeys = CLEANING_GROUP_KEYS.filter((k) => Boolean(selectedGroups[k]));

  return {
    deletedByTable,
    deletedTotal,
    selectedGroupKeys,
  };
}
