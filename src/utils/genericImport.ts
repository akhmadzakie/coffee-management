import * as XLSX from "xlsx";
import { DEFAULT_STORE_TIMEZONE, getLocalDateString } from "./dateUtils";

export interface ParsedGenericRow {
  [key: string]: any;
}

export interface NormalizeImportOptions {
  expectedHeaders: string[];
  requiredHeaders?: string[];
  headerAliases?: Record<string, string[]>;
  exampleRowValues?: string[];
}

export interface NormalizeImportResult {
  rows: ParsedGenericRow[];
  warnings: string[];
  missingHeaders: string[];
  missingRequiredHeaders: string[];
  matchedHeaders: string[];
  exampleRowDetected: boolean;
}

export const normalizeHeaderKey = (key: string): string =>
  String(key ?? "")
    .replace(/\*/g, "")
    .toLowerCase()
    .replace(/[_\-./()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeTextCode = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "";
    return Number.isInteger(val) ? String(val) : String(val);
  }
  const s = String(val).trim();
  if (!s) return "";
  // Jika Excel mengekspor kode numerik sebagai "1234.0", hapus ".0" saja tanpa membuang nol di depan
  if (/^\d+\.0+$/.test(s)) {
    return s.replace(/\.0+$/, "");
  }
  return s;
};

export const parseLocalizedNumber = (val: unknown): number => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  let s = String(val ?? "")
    .replace(/rp\.?/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // Format Indonesia: 1.234.567,89
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // Format Internasional: 1,234,567.89
    s = s.replace(/,/g, "");
  } else if (/^\d+\.\d{3}$/.test(s)) {
    // Kasus ambigu 3 digit di belakang titik pada angka ribuan (mis. "50.000" -> 50000)
    // Catatan: 1.500 -> 1500; untuk takaran desimal gunakan koma atau < 3 digit desimal.
    s = s.replace(/\./g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const isValidCalendarDate = (y: number, m: number, d: number): boolean => {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
};

export const parseFlexibleDateYmd = (val: unknown): string | null => {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    // Tambahkan 12 jam bila tepat tengah malam UTC agar aman dari pergeseran menit SheetJS
    const rounded = new Date(Math.round(val.getTime() / 60000) * 60000);
    return getLocalDateString(rounded, DEFAULT_STORE_TIMEZONE);
  }
  if (typeof val === "number" && Number.isFinite(val) && val >= 25000 && val <= 65000) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(val) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s) return null;

  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 25000 && serial <= 65000) {
      const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isValidCalendarDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (isValidCalendarDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return getLocalDateString(parsed, DEFAULT_STORE_TIMEZONE);
  }
  return null;
};

const normalizeCellVal = (val: unknown): any => {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const d = new Date(Math.round(val.getTime() / 60000) * 60000);
    return getLocalDateString(d, DEFAULT_STORE_TIMEZONE);
  }
  return val;
};

export const matchAndNormalizeImportRows = (
  rawRows: Record<string, any>[],
  options: NormalizeImportOptions
): NormalizeImportResult => {
  const {
    expectedHeaders = [],
    requiredHeaders = [],
    headerAliases = {},
    exampleRowValues,
  } = options;

  const rawHeadersSet = new Set<string>();
  rawRows.forEach((row) => {
    if (row && typeof row === "object") {
      Object.keys(row).forEach((k) => {
        const trimmed = k.trim();
        if (trimmed && !trimmed.startsWith("__EMPTY")) rawHeadersSet.add(trimmed);
      });
    }
  });
  const actualHeaders = Array.from(rawHeadersSet);

  // Bangun peta normalisasi: rawKey -> canonicalHeader
  const rawToCanonical = new Map<string, string>();
  const matchedHeaders: string[] = [];
  const usedRawHeaders = new Set<string>();

  expectedHeaders.forEach((expected) => {
    const aliasList = [expected, ...(headerAliases[expected] || [])];
    const normCandidates = aliasList.map(normalizeHeaderKey);

    // Prioritas 1: exact trim match, Prioritas 2: normalized alias match
    let hit = actualHeaders.find(
      (h) => !usedRawHeaders.has(h) && h.trim() === expected.trim()
    );
    if (!hit) {
      hit = actualHeaders.find(
        (h) => !usedRawHeaders.has(h) && normCandidates.includes(normalizeHeaderKey(h))
      );
    }
    if (hit) {
      rawToCanonical.set(hit, expected);
      usedRawHeaders.add(hit);
      matchedHeaders.push(expected);
    }
  });

  const missingHeaders = expectedHeaders.filter((h) => !matchedHeaders.includes(h));
  const missingRequiredHeaders = requiredHeaders.filter(
    (h) => !matchedHeaders.includes(h)
  );

  const warnings: string[] = [];
  if (missingRequiredHeaders.length > 0) {
    warnings.push(
      `Kolom wajib tidak ditemukan: ${missingRequiredHeaders.join(", ")}. Pastikan memakai template resmi.`
    );
  } else if (missingHeaders.length > 0 && expectedHeaders.length > 0) {
    const optionalMissing = missingHeaders.filter(
      (h) => !h.startsWith("ID_SISTEM")
    );
    if (optionalMissing.length > 0 && matchedHeaders.length > 0) {
      warnings.push(
        `Beberapa kolom opsional tidak ada di file: ${optionalMissing.join(", ")}.`
      );
    }
  }

  const rows: ParsedGenericRow[] = [];
  rawRows.forEach((rawRow) => {
    const cleanRow: ParsedGenericRow = {};
    for (const rawKey in rawRow) {
      const trimmedKey = rawKey.trim();
      if (!trimmedKey || trimmedKey.startsWith("__EMPTY")) continue;
      const canonical = rawToCanonical.get(trimmedKey) ?? trimmedKey;
      const val = normalizeCellVal(rawRow[rawKey]);
      if (cleanRow[canonical] === undefined || cleanRow[canonical] === "") {
        cleanRow[canonical] = val;
      }
    }

    const hasValue = Object.values(cleanRow).some(
      (v) => v !== "" && v !== null && v !== undefined
    );
    if (!hasValue) return;
    rows.push(cleanRow);
  });

  // Deteksi apakah baris pertama sama dengan baris contoh template (toleran format angka/tanggal Excel)
  let exampleRowDetected = false;
  if (rows.length > 0 && exampleRowValues && exampleRowValues.length > 0) {
    const nonIdHeaders = expectedHeaders.filter((h) => !h.startsWith("ID_SISTEM"));
    const firstRow = rows[0];
    const comparableCols = Math.min(nonIdHeaders.length, exampleRowValues.length);
    const looksNumeric = (s: string) => /^(?:rp\.?\s*)?\(?-?[\d.,]+\)?$/i.test(s);
    if (comparableCols > 0) {
      let matches = 0;
      let checked = 0;
      for (let i = 0; i < comparableCols; i++) {
        const expectedRaw = String(exampleRowValues[i] ?? "").trim();
        const expectedVal = expectedRaw.toLowerCase();
        if (!expectedVal) continue;
        checked++;
        const actualRaw = String(firstRow[nonIdHeaders[i]] ?? "").trim();
        const actualVal = actualRaw.toLowerCase();
        if (actualVal === expectedVal) {
          matches++;
        } else if (
          looksNumeric(actualRaw) &&
          looksNumeric(expectedRaw) &&
          parseLocalizedNumber(actualRaw) === parseLocalizedNumber(expectedRaw)
        ) {
          matches++;
        } else {
          const dActual = parseFlexibleDateYmd(firstRow[nonIdHeaders[i]]);
          const dExpected = parseFlexibleDateYmd(expectedRaw);
          if (dActual && dExpected && dActual === dExpected) {
            matches++;
          }
        }
      }
      if (checked >= 2 && matches === checked) {
        exampleRowDetected = true;
      }
    }
  }

  return {
    rows,
    warnings,
    missingHeaders,
    missingRequiredHeaders,
    matchedHeaders,
    exampleRowDetected,
  };
};

export const parseSpreadsheetToRawRows = async (
  file: File
): Promise<Record<string, any>[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: "array",
    cellDates: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("File tidak memiliki sheet/halaman.");
  }

  // Abaikan sheet tersembunyi/petunjuk jika ada di urutan depan secara tidak sengaja
  const targetSheetName =
    workbook.SheetNames.find(
      (name) => !name.startsWith("_") && name.toLowerCase() !== "petunjuk"
    ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: "",
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("File kosong atau tidak memiliki baris data yang dapat dibaca.");
  }

  return rawRows;
};

export const parseGenericImportFile = async (
  file: File,
  expectedHeaders: string[],
  options?: {
    requiredHeaders?: string[];
    headerAliases?: Record<string, string[]>;
    exampleRowValues?: string[];
  }
): Promise<{
  rows: ParsedGenericRow[];
  errors: string[];
  exampleRowDetected?: boolean;
  missingRequiredHeaders?: string[];
}> => {
  const rawRows = await parseSpreadsheetToRawRows(file);
  const normalized = matchAndNormalizeImportRows(rawRows, {
    expectedHeaders,
    requiredHeaders: options?.requiredHeaders,
    headerAliases: options?.headerAliases,
    exampleRowValues: options?.exampleRowValues,
  });

  return {
    rows: normalized.rows,
    errors: normalized.warnings,
    exampleRowDetected: normalized.exampleRowDetected,
    missingRequiredHeaders: normalized.missingRequiredHeaders,
  };
};

export const downloadInteractiveTemplate = (
  filename: string,
  headers: string[],
  currentData: any[] = [],
  exampleRow?: string[]
) => {
  const wb = XLSX.utils.book_new();
  const finalHeaders = ["ID_SISTEM (JANGAN DIUBAH)", ...headers];
  const wsData: any[][] = [finalHeaders];

  if (currentData.length > 0) {
    currentData.forEach((row) => {
      const mappedRow = finalHeaders.map((h) => {
        if (h === "ID_SISTEM (JANGAN DIUBAH)") return row.id || "";
        return row[h] !== undefined ? row[h] : "";
      });
      wsData.push(mappedRow);
    });
  } else if (exampleRow) {
    wsData.push(["", ...exampleRow]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = finalHeaders.map((h) => ({ wch: Math.max(h.length + 5, 15) }));
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
