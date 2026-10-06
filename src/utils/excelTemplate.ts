// ─── Excel Template Builder dengan Dropdown (exceljs) ────────────────────────
// SheetJS versi gratis tidak bisa menulis Data Validation (dropdown),
// jadi khusus untuk TEMPLATE kita pakai exceljs. Proses impor tetap memakai xlsx.

export type TemplateColumnType = "text" | "number" | "date" | "integer";

export interface TemplateColumn {
  header: string;
  /** Daftar pilihan dropdown. Jika diisi, kolom akan menjadi dropdown. */
  options?: string[];
  /** Validasi tipe data untuk kolom non-dropdown */
  type?: TemplateColumnType;
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

export const buildTemplateWithDropdown = async ({
  filename,
  sheetName = "Data",
  columns,
  rows = [],
  instructions = [],
  maxRows = 1000,
}: TemplateOptions) => {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Julia's Management System";
  wb.created = new Date();

  // Sheet data HARUS menjadi sheet pertama (parser impor membaca sheet pertama)
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // ── Header ──
  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? Math.max(c.header.length + 6, 16),
  }));

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: c.locked ? "FF94A3B8" : c.options ? "FF2563EB" : "FF10B981" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF0F172A" } },
    };
    if (c.options) {
      cell.note = "Kolom ini berupa dropdown — klik sel lalu pilih dari daftar.";
    }
  });

  // ── Data rows ──
  rows.forEach((r) => ws.addRow(r.map((v) => (v === undefined || v === null ? "" : v))));

  // ── Sheet tersembunyi untuk daftar dropdown ──
  const listSheet = wb.addWorksheet("_Lists", { state: "veryHidden" });
  let listCol = 0;

  const lastRow = Math.max(maxRows, rows.length + 50);

  columns.forEach((c, i) => {
    const letter = colLetter(i);

    // Format kolom
    if (c.type === "number" || c.type === "integer") {
      ws.getColumn(i + 1).numFmt = c.type === "integer" ? "0" : "#,##0";
    }

    for (let r = 2; r <= lastRow; r++) {
      const cell = ws.getCell(`${letter}${r}`);

      if (c.options && c.options.length > 0) {
        const opts = uniqueClean(c.options);
        if (opts.length === 0) continue;
        // Simpan ke sheet _Lists sekali saja
        if (r === 2) {
          const lc = colLetter(listCol);
          opts.forEach((o, idx) => {
            listSheet.getCell(`${lc}${idx + 1}`).value = o;
          });
          (c as any)._ref = `'_Lists'!$${lc}$1:$${lc}$${opts.length}`;
          listCol++;
        }
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [(c as any)._ref],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: "Pilihan tidak valid",
          error: `Silakan pilih "${c.header}" dari daftar dropdown.`,
          showInputMessage: !!c.hint,
          promptTitle: c.hint ? c.header : undefined,
          prompt: c.hint,
        };
      } else if (c.type === "number" || c.type === "integer") {
        cell.dataValidation = {
          type: c.type === "integer" ? "whole" : "decimal",
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
      } else if (c.type === "date") {
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
  guide.getColumn(1).width = 110;
  const allInstructions = [
    `PETUNJUK PENGISIAN — ${filename.replace(/_/g, " ")}`,
    "",
    "• Isi data pada sheet pertama (\"" + sheetName + "\"). Jangan mengubah nama/urutan header.",
    "• Kolom berwarna BIRU adalah dropdown — klik sel lalu pilih dari daftar (panah ▼).",
    "• Kolom berwarna HIJAU diisi manual. Kolom ABU-ABU jangan diubah.",
    "• Angka diisi tanpa titik/koma pemisah ribuan (contoh: 50000).",
    ...instructions.map((t) => `• ${t}`),
    "",
    "Daftar pilihan dropdown:",
    ...columns
      .filter((c) => c.options && c.options.length)
      .map((c) => `  - ${c.header}: ${uniqueClean(c.options!).slice(0, 30).join(", ")}${c.options!.length > 30 ? ", ..." : ""}`),
  ];
  allInstructions.forEach((t, i) => {
    const cell = guide.getCell(`A${i + 1}`);
    cell.value = t;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) cell.font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
  });

  // ── Download ──
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
