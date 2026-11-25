// ─── Excel Template & Styled Report Builder (exceljs) ─────────────────────────
// SheetJS versi gratis tidak bisa menulis Data Validation (dropdown) atau style,
// jadi untuk TEMPLATE & LAPORAN EXCEL RAPI kita pakai exceljs (dynamic import).

import { DEFAULT_STORE_TIMEZONE, getLocalDateString } from "./dateUtils";

export type TemplateColumnType = "text" | "number" | "date" | "integer";
export type TemplateColumnFormat =
  | "text"
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "date";

export interface TemplateColumn {
  header: string;
  /** Daftar pilihan dropdown. Jika diisi, kolom akan menjadi dropdown. */
  options?: string[];
  /** Validasi tipe data untuk kolom non-dropdown */
  type?: TemplateColumnType;
  /** Format tampilan Excel (termasuk "text" "@" agar angka 0 di depan tidak terpotong) */
  format?: TemplateColumnFormat;
  /** Tandai kolom wajib diisi (warna header navy + legenda di sheet Petunjuk) */
  required?: boolean;
  /** Nilai minimum untuk kolom angka (default 0) */
  min?: number;
  /** Lebar kolom (karakter) */
  width?: number;
  /** Teks bantuan yang muncul saat sel dipilih */
  hint?: string;
  /** Kolom hanya-baca (contoh: ID sistem) */
  locked?: boolean;
}

export interface TemplateOptions {
  filename: string;
  sheetName?: string;
  columns: TemplateColumn[];
  /** Baris data (array sesuai urutan kolom) */
  rows?: (string | number | null | undefined)[][];
  /** Petunjuk pengisian (ditaruh di sheet terpisah agar tidak mengganggu impor) */
  instructions?: string[];
  /** Jumlah baris yang diberi validasi */
  maxRows?: number;
  /** Tandai baris data pertama (baris ke-2 Excel) secara visual sebagai baris contoh */
  isExampleFirstRow?: boolean;
  /** Nama brand untuk metadata & petunjuk */
  brandName?: string;
}

export interface StyledSheetSpec {
  name: string;
  title?: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  columnFormats?: (TemplateColumnFormat | undefined)[];
  columnWidths?: number[];
  totalRow?: (string | number | null | undefined)[];
}

const colLetter = (n: number): string => {
  let s = "";
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const uniqueClean = (arr: string[]) =>
  Array.from(new Set(arr.map((v) => String(v ?? "").trim()).filter(Boolean)));

const sanitizeSheetName = (name: string): string => {
  const cleaned = String(name || "Sheet")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim();
  return (cleaned || "Sheet").slice(0, 31);
};

const getExcelNumFmt = (format?: TemplateColumnFormat): string | undefined => {
  if (format === "text") return "@";
  if (format === "currency") return '"Rp "#,##0';
  if (format === "integer") return "#,##0";
  if (format === "number") return "#,##0.##";
  if (format === "percent") return "0.0%";
  if (format === "date") return "yyyy-mm-dd";
  return undefined;
};

const coerceCellValue = (
  raw: string | number | null | undefined,
  col?: Pick<TemplateColumn, "type" | "format">
): string | number => {
  if (raw === undefined || raw === null || raw === "") return "";
  const effectiveFmt = col?.format ?? col?.type;
  if (effectiveFmt === "text") {
    return String(raw);
  }
  if (
    effectiveFmt === "number" ||
    effectiveFmt === "integer" ||
    effectiveFmt === "currency" ||
    effectiveFmt === "percent"
  ) {
    if (typeof raw === "number") {
      return Number.isFinite(raw) ? raw : "";
    }
    const trimmed = String(raw).trim();
    if (!trimmed) return "";
    // Hanya konversi jika string numerik murni agar tidak merusak teks
    const cleaned = trimmed.replace(/\s+/g, "");
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return raw;
};

const triggerWorkbookDownload = async (wb: any, filename: string) => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.(csv|xlsx)$/i, "")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildTemplateWithDropdown = async ({
  filename,
  sheetName = "Data",
  columns,
  rows = [],
  instructions = [],
  maxRows = 1000,
  isExampleFirstRow = false,
  brandName = "Julia's Management System",
}: TemplateOptions) => {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = brandName;
  wb.created = new Date();

  // Sheet data HARUS menjadi sheet pertama (parser impor membaca sheet pertama)
  const ws = wb.addWorksheet(sanitizeSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // ── Header ──
  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? Math.max(c.header.length + 6, 16),
  }));

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    const hasDropdown = Boolean(c.options && c.options.length > 0);
    const headerColor = c.locked
      ? "FF64748B" // Slate (ID sistem / terkunci)
      : hasDropdown
        ? "FF1B2CC0" // Julia's Brand Blue (dropdown)
        : c.required
          ? "FF0F1860" // Julia's Deep Navy (wajib manual)
          : "FF059669"; // Emerald (opsional manual)

    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerColor },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FF1E293B" } },
    };
    if (hasDropdown) {
      cell.note = "Kolom ini berupa dropdown — klik sel lalu pilih dari daftar.";
    } else if (c.required) {
      cell.note = "Kolom wajib diisi.";
    }
  });

  // ── Data rows ──
  rows.forEach((r, rowIdx) => {
    const formattedRow = columns.map((col, colIdx) => coerceCellValue(r[colIdx], col));
    const addedRow = ws.addRow(formattedRow);
    if (isExampleFirstRow && rowIdx === 0) {
      addedRow.height = 20;
      columns.forEach((col, colIdx) => {
        const cell = addedRow.getCell(colIdx + 1);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEFCE8" },
        };
        cell.font = {
          italic: true,
          color: { argb: col.locked ? "FF64748B" : "FF475569" },
        };
      });
    }
  });

  // ── Sheet tersembunyi untuk daftar dropdown ──
  const listSheet = wb.addWorksheet("_Lists", { state: "veryHidden" });
  let listCol = 0;

  const lastRow = Math.min(maxRows, Math.max(300, rows.length + 150));

  columns.forEach((c, i) => {
    const letter = colLetter(i);
    const effectiveFormat = c.format ?? c.type;
    const numFmt = getExcelNumFmt(effectiveFormat);

    if (numFmt) {
      ws.getColumn(i + 1).numFmt = numFmt;
    }

    const cleanOpts = c.options && c.options.length > 0 ? uniqueClean(c.options) : [];
    let listRef: string | null = null;
    if (cleanOpts.length > 0) {
      const lc = colLetter(listCol);
      cleanOpts.forEach((o, idx) => {
        listSheet.getCell(`${lc}${idx + 1}`).value = o;
      });
      listRef = `'_Lists'!$${lc}$1:$${lc}$${cleanOpts.length}`;
      listCol++;
    }

    for (let r = 2; r <= lastRow; r++) {
      const cell = ws.getCell(`${letter}${r}`);
      if (numFmt) {
        cell.numFmt = numFmt;
      }

      if (listRef) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [listRef],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: "Pilihan tidak valid",
          error: `Silakan pilih "${c.header}" dari daftar dropdown.`,
          showInputMessage: !!c.hint,
          promptTitle: c.hint ? c.header : undefined,
          prompt: c.hint,
        };
      } else if (c.type === "number" || c.type === "integer" || c.format === "currency") {
        const isWhole = c.type === "integer" || c.format === "integer";
        cell.dataValidation = {
          type: isWhole ? "whole" : "decimal",
          operator: "greaterThanOrEqual",
          allowBlank: true,
          formulae: [c.min ?? 0],
          showErrorMessage: true,
          errorTitle: "Angka tidak valid",
          error: `Kolom "${c.header}" harus berupa angka ≥ ${c.min ?? 0}.`,
          showInputMessage: !!c.hint,
          promptTitle: c.hint ? c.header : undefined,
          prompt: c.hint,
        };
      } else if (c.type === "date" || c.format === "date") {
        cell.numFmt = "yyyy-mm-dd";
        cell.dataValidation = {
          type: "date",
          operator: "greaterThan",
          allowBlank: true,
          formulae: [new Date(2000, 0, 1)],
          showErrorMessage: true,
          errorTitle: "Tanggal tidak valid",
          error: `Kolom "${c.header}" harus berupa tanggal (contoh: 2026-10-06).`,
          showInputMessage: true,
          promptTitle: c.header,
          prompt: c.hint || "Format tanggal: YYYY-MM-DD",
        };
      } else if (c.hint) {
        cell.dataValidation = {
          type: "any" as any,
          allowBlank: true,
          showInputMessage: true,
          promptTitle: c.header,
          prompt: c.hint,
        } as any;
      }

      if (c.locked) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cell.font = { color: { argb: "FF64748B" } };
      }
    }
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  // ── Sheet petunjuk (setelah sheet data) ──
  const guide = wb.addWorksheet("Petunjuk");
  guide.getColumn(1).width = 112;
  const dropdownCols = columns.filter((c) => c.options && c.options.length > 0);
  const allInstructions = [
    `PETUNJUK PENGISIAN — ${filename.replace(/_/g, " ")}`,
    `Sumber: ${brandName} • Diunduh: ${getLocalDateString(new Date(), DEFAULT_STORE_TIMEZONE)}`,
    "",
    `• Isi data pada sheet pertama ("${sanitizeSheetName(sheetName)}"). Jangan mengubah nama atau urutan header.`,
    "• Legenda Warna Header:",
    "    - BIRU BRAND: Kolom Dropdown — klik sel lalu pilih dari daftar panah (▼).",
    "    - BIRU TUA (NAVY): Kolom Wajib diisi manual.",
    "    - HIJAU: Kolom Opsional / Tambahan.",
    "    - ABU-ABU: ID Sistem — kosongkan untuk data baru, jangan diubah saat Edit Massal.",
    ...(isExampleFirstRow
      ? [
          "• Baris ke-2 (berlatar kuning lembut & teks miring) adalah CONTOH pengisian — ganti atau hapus sebelum diimpor (atau centang opsi lewati contoh saat upload).",
        ]
      : []),
    "• Kolom angka & harga diisi tanpa huruf 'Rp' atau pemisah ribuan (contoh: 50000).",
    "• Kolom kode/PIN/No. HP sudah diformat sebagai Teks (@) agar angka 0 di depan tidak terpotong.",
    ...instructions.map((t) => `• ${t}`),
    ...(dropdownCols.length > 0
      ? [
          "",
          "Daftar Pilihan Dropdown:",
          ...dropdownCols.map(
            (c) =>
              `  - ${c.header}: ${uniqueClean(c.options!).slice(0, 40).join(", ")}${
                c.options!.length > 40 ? `, ... (${c.options!.length} total)` : ""
              }`
          ),
        ]
      : []),
  ];

  allInstructions.forEach((t, i) => {
    const cell = guide.getCell(`A${i + 1}`);
    cell.value = t;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) {
      cell.font = { bold: true, size: 13, color: { argb: "FF1B2CC0" } };
    } else if (i === 1) {
      cell.font = { size: 10, color: { argb: "FF64748B" } };
    }
  });

  await triggerWorkbookDownload(wb, filename);
};

// ─── Styled Multi-Sheet Report Generator (exceljs) ────────────────────────────

export const buildStyledWorkbook = async ({
  filename,
  sheets,
  brandName = "Julia's • Specialty Room • Coffee • Eatery",
}: {
  filename: string;
  sheets: StyledSheetSpec[];
  brandName?: string;
}): Promise<void> => {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = brandName;
  wb.created = new Date();

  const usedSheetNames = new Set<string>();

  sheets.forEach((spec, sheetIdx) => {
    let baseName = sanitizeSheetName(spec.name || `Sheet ${sheetIdx + 1}`);
    let uniqueName = baseName;
    let suffix = 2;
    while (usedSheetNames.has(uniqueName.toLowerCase())) {
      const tail = ` (${suffix++})`;
      uniqueName = `${baseName.slice(0, 31 - tail.length)}${tail}`;
    }
    usedSheetNames.add(uniqueName.toLowerCase());

    const hasTitle = Boolean(spec.title || spec.subtitle);
    const headerRowNum = hasTitle ? 4 : 1;

    const ws = wb.addWorksheet(uniqueName, {
      views: [{ state: "frozen", ySplit: headerRowNum }],
    });

    const colCount = Math.max(1, spec.headers.length);
    const lastColLetter = colLetter(colCount - 1);

    if (hasTitle) {
      ws.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = ws.getCell("A1");
      titleCell.value = spec.title || brandName;
      titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1B2CC0" },
      };
      ws.getRow(1).height = 26;

      ws.mergeCells(`A2:${lastColLetter}2`);
      const subCell = ws.getCell("A2");
      subCell.value =
        spec.subtitle ||
        `${brandName} • Diekspor: ${getLocalDateString(new Date(), DEFAULT_STORE_TIMEZONE)}`;
      subCell.font = { size: 9.5, color: { argb: "FF1E293B" }, italic: true };
      subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      subCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEF2FF" },
      };
      ws.getRow(2).height = 19;
      ws.getRow(3).height = 8;
    }

    // Header Row
    const headerRow = ws.getRow(headerRowNum);
    headerRow.height = 24;
    spec.headers.forEach((h, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F1860" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1B2CC0" } },
        bottom: { style: "medium", color: { argb: "FF1B2CC0" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });

    // Track max char widths for auto-fit
    const maxLengths = spec.headers.map((h) => String(h || "").length);

    // Data Rows
    const dataStartRow = headerRowNum + 1;
    spec.rows.forEach((rawRow, rIdx) => {
      const excelRowNum = dataStartRow + rIdx;
      const row = ws.getRow(excelRowNum);
      const isEven = rIdx % 2 === 0;
      const fillArgb = isEven ? "FFF8FAFC" : "FFFFFFFF";

      spec.headers.forEach((_, colIdx) => {
        const fmt = spec.columnFormats?.[colIdx];
        const val = coerceCellValue(rawRow[colIdx], { format: fmt });
        const cell = row.getCell(colIdx + 1);
        cell.value = val;

        const numFmt = getExcelNumFmt(fmt);
        if (numFmt) cell.numFmt = numFmt;

        const isNumericFmt =
          fmt === "currency" || fmt === "integer" || fmt === "number" || fmt === "percent";
        cell.alignment = {
          vertical: "middle",
          horizontal: isNumericFmt ? "right" : "left",
        };
        cell.font = { size: 10, color: { argb: "FF0F172A" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fillArgb },
        };
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
          right: { style: "hair", color: { argb: "FFE2E8F0" } },
        };

        const displayLen =
          fmt === "currency" && typeof val === "number"
            ? `Rp ${val.toLocaleString("id-ID")}`.length
            : String(val ?? "").length;
        if (displayLen > maxLengths[colIdx]) {
          maxLengths[colIdx] = displayLen;
        }
      });
    });

    // Optional Total Row
    if (spec.totalRow && spec.totalRow.length > 0) {
      const totalRowNum = dataStartRow + spec.rows.length;
      const totalRow = ws.getRow(totalRowNum);
      totalRow.height = 22;
      spec.headers.forEach((_, colIdx) => {
        const fmt = spec.columnFormats?.[colIdx];
        const val = coerceCellValue(spec.totalRow?.[colIdx], { format: fmt });
        const cell = totalRow.getCell(colIdx + 1);
        cell.value = val;

        const numFmt = getExcelNumFmt(fmt);
        if (numFmt) cell.numFmt = numFmt;

        const isNumericFmt =
          fmt === "currency" || fmt === "integer" || fmt === "number" || fmt === "percent";
        cell.alignment = {
          vertical: "middle",
          horizontal: isNumericFmt ? "right" : "left",
        };
        cell.font = { bold: true, size: 10.5, color: { argb: "FF0F1860" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEEF2FF" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF1B2CC0" } },
          bottom: { style: "double", color: { argb: "FF1B2CC0" } },
          right: { style: "hair", color: { argb: "FFC3CFFF" } },
        };

        const displayLen = String(val ?? "").length + 2;
        if (displayLen > maxLengths[colIdx]) {
          maxLengths[colIdx] = displayLen;
        }
      });
    }

    // Apply Column Formats & Auto-Fit Widths
    spec.headers.forEach((_, colIdx) => {
      const col = ws.getColumn(colIdx + 1);
      const explicitW = spec.columnWidths?.[colIdx];
      col.width = explicitW ?? Math.min(48, Math.max(12, maxLengths[colIdx] + 4));
      const numFmt = getExcelNumFmt(spec.columnFormats?.[colIdx]);
      if (numFmt && spec.columnFormats?.[colIdx] === "text") {
        col.numFmt = numFmt;
      }
    });

    if (spec.rows.length > 0) {
      ws.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: colCount },
      };
    }
  });

  await triggerWorkbookDownload(wb, filename);
};
