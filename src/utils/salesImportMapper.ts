/**
 * Pemeta kolom fleksibel untuk impor rekap penjualan dari aplikasi POS eksternal.
 *
 * Aplikasi POS berbeda-beda menamai kolom ekspornya (mis. "Date", "Item", "Qty",
 * "Net Sales"). Modul ini menerjemahkannya ke format baku sistem:
 *   Tanggal | Nama Menu | Quantity | Total Penjualan
 * serta mencocokkan nama menu dengan katalog produk agar pemotongan stok/HPP akurat.
 */

export type CanonicalField = "Tanggal" | "Nama Menu" | "Quantity" | "Total Penjualan";

const ALIASES: Record<CanonicalField, string[]> = {
  Tanggal: [
    "tanggal", "tgl", "date", "tanggal transaksi", "tgl transaksi", "transaction date",
    "order date", "sales date", "tanggal penjualan", "waktu", "created at", "created date", "datetime",
  ],
  "Nama Menu": [
    "nama menu", "menu", "item", "item name", "nama item", "product", "product name",
    "nama produk", "produk", "nama barang", "barang", "menu item", "description", "deskripsi",
  ],
  Quantity: [
    "quantity", "qty", "jumlah", "jml", "terjual", "qty sold", "item sold", "items sold",
    "jumlah terjual", "total qty", "unit terjual", "kuantitas",
  ],
  "Total Penjualan": [
    "total penjualan", "total", "subtotal", "sub total", "net sales", "gross sales", "sales",
    "penjualan", "amount", "nominal", "total harga", "harga total", "omzet", "revenue",
    "total sales", "net amount", "jumlah harga", "total bayar",
  ],
};

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface HeaderMapping {
  /** kolom baku -> nama kolom asli di file */
  mapped: Partial<Record<CanonicalField, string>>;
  /** kolom baku yang tidak ditemukan */
  missing: CanonicalField[];
  /** semua header yang terbaca di file */
  detected: string[];
}

export const detectHeaderMapping = (rows: Record<string, any>[]): HeaderMapping => {
  const detected = rows.length > 0 ? Object.keys(rows[0]).map((h) => h.trim()) : [];
  const mapped: Partial<Record<CanonicalField, string>> = {};
  const used = new Set<string>();

  (Object.keys(ALIASES) as CanonicalField[]).forEach((field) => {
    // prioritas 1: kecocokan persis dengan nama baku, prioritas 2: alias berurutan
    const candidates = [field, ...ALIASES[field]].map(norm);
    for (const cand of candidates) {
      const hit = detected.find((h) => !used.has(h) && norm(h) === cand);
      if (hit) {
        mapped[field] = hit;
        used.add(hit);
        return;
      }
    }
  });

  const missing = (Object.keys(ALIASES) as CanonicalField[]).filter((f) => !mapped[f]);
  return { mapped, missing, detected };
};

/** Mengubah "Rp 12.500", "12,500.00", "12500" menjadi angka. */
export const parseMoney = (value: unknown): number => {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  let s = String(value ?? "").replace(/rp\.?/gi, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", "."); // format Indonesia 1.234.567,89
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, ""); // format internasional 1,234,567.89
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Menghasilkan YYYY-MM-DD dari berbagai format tanggal; null bila tidak terbaca. */
export const parseDateToIso = (value: unknown): string | null => {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // 2026-10-18 / 2026/10/18
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); // 18/10/2026 (format Indonesia: hari dulu)
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return null;
};

export interface MappedSalesRow {
  date: string;
  menuName: string;
  quantitySold: number;
  totalPrice: number;
}

export interface MapSalesResult {
  rows: MappedSalesRow[];
  mapping: HeaderMapping;
  /** baris dilewati karena tanggal/nama menu tidak terbaca */
  skippedRows: number;
  /** nama menu di file yang tidak ditemukan di katalog produk */
  unmatchedMenus: string[];
  /** jumlah nama menu yang otomatis disamakan dengan nama katalog */
  autoMatchedCount: number;
}

export const mapSalesRows = (
  rawRows: Record<string, any>[],
  productNames: string[]
): MapSalesResult => {
  const mapping = detectHeaderMapping(rawRows);
  const catalog = new Map<string, string>();
  productNames.forEach((n) => catalog.set(norm(n), n));

  const unmatched = new Set<string>();
  let autoMatched = 0;
  let skipped = 0;
  const rows: MappedSalesRow[] = [];

  const col = (row: Record<string, any>, field: CanonicalField) => {
    const key = mapping.mapped[field];
    if (!key) return undefined;
    // header di file bisa memiliki spasi di tepi; cari kunci aslinya
    const real = Object.keys(row).find((k) => k.trim() === key);
    return real !== undefined ? row[real] : undefined;
  };

  rawRows.forEach((row) => {
    const rawName = String(col(row, "Nama Menu") ?? "").trim();
    const date = parseDateToIso(col(row, "Tanggal")) ?? parseDateToIso(new Date());
    if (!rawName || !date) {
      skipped++;
      return;
    }

    let menuName = rawName;
    const hit = catalog.get(norm(rawName));
    if (hit) {
      if (hit !== rawName) autoMatched++;
      menuName = hit;
    } else if (productNames.length > 0) {
      unmatched.add(rawName);
    }

    const qtyRaw = col(row, "Quantity");
    const quantitySold = Math.max(1, Math.round(parseMoney(qtyRaw))) || 1;
    const totalPrice = Math.max(0, parseMoney(col(row, "Total Penjualan")));

    rows.push({ date, menuName, quantitySold, totalPrice });
  });

  return {
    rows,
    mapping,
    skippedRows: skipped,
    unmatchedMenus: Array.from(unmatched),
    autoMatchedCount: autoMatched,
  };
};
