import * as XLSX from "xlsx";
import {
  SalesTransaction,
  Ingredient,
  StockMovement,
  CashTransaction,
  Settings,
  ExpenseCategory,
} from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateIndo = (dateStr: string | Date): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/** Bold the first row of a worksheet with dark blue header */
const boldFirstRow = (ws: XLSX.WorkSheet, cols: number) => {
  for (let C = 0; C < cols; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "1E3A5F" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        bottom: { style: "thin", color: { rgb: "334155" } },
        right: { style: "thin", color: { rgb: "334155" } },
      },
    };
  }
};

/** Style alternating data rows */
const styleDataRows = (
  ws: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  cols: number,
) => {
  for (let R = startRow; R <= endRow; R++) {
    const isOdd = (R - startRow) % 2 === 0;
    const fillColor = isOdd ? "F8FAFC" : "FFFFFF";
    for (let C = 0; C < cols; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr]) {
        ws[addr].s = {
          ...(ws[addr].s || {}),
          fill: { fgColor: { rgb: fillColor } },
          border: {
            bottom: { style: "hair", color: { rgb: "E2E8F0" } },
            right: { style: "hair", color: { rgb: "E2E8F0" } },
          },
          alignment: { vertical: "center" },
        };
      }
    }
  }
};

/** Download an XLSX workbook */
const downloadXlsx = (wb: XLSX.WorkBook, filename: string) => {
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ─── Export Finance to XLSX ────────────────────────────────────────────────────

export interface ExportFinanceXlsxOptions {
  finance: CashTransaction[];
  settings: Settings;
  periodLabel: string;
  expenseCategories?: ExpenseCategory[];
}

export const exportFinanceToXlsx = ({
  finance,
  settings,
  periodLabel,
  expenseCategories = [],
}: ExportFinanceXlsxOptions) => {
  const wb = XLSX.utils.book_new();
  const brandName = settings.brandName || "Julia's Management System";

  // ─── Sheet 1: Ringkasan ───────────────────────────────────────────────────
  const totalIn = finance
    .filter((f) => f.type === "CASH_IN")
    .reduce((a, b) => a + b.amount, 0);
  const totalOut = finance
    .filter((f) => f.type === "CASH_OUT")
    .reduce((a, b) => a + b.amount, 0);
  const net = totalIn - totalOut;

  const summaryData = [
    ["Laporan Arus Kas", brandName],
    ["Periode", periodLabel],
    ["Dicetak", toDateIndo(new Date())],
    [],
    ["Keterangan", "Jumlah"],
    ["Total Pemasukan", totalIn],
    ["Total Pengeluaran", totalOut],
    ["Arus Kas Bersih", net],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 22 }];
  ["B6", "B7", "B8"].forEach((addr) => {
    if (wsSummary[addr]) wsSummary[addr].z = '#,##0';
  });
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  // ─── Sheet 2: Data Transaksi ──────────────────────────────────────────────
  const headers = ["Tanggal", "Jenis", "Kategori", "Keterangan", "Jumlah (Rp)"];
  const rows = finance.map((f) => [
    toDateIndo(f.date),
    f.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
    f.category,
    f.description,
    f.amount,
  ]);

  const wsData = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  wsData["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 18 },
  ];
  for (let i = 2; i <= rows.length + 1; i++) {
    const addr = `E${i}`;
    if (wsData[addr]) wsData[addr].z = '#,##0';
  }
  boldFirstRow(wsData, headers.length);
  styleDataRows(wsData, 1, rows.length, headers.length);
  XLSX.utils.book_append_sheet(wb, wsData, "Transaksi");

  // ─── Sheet 3: Template Input ──────────────────────────────────────────────
  const templateHeaders = ["Tanggal*", "Jenis*", "Kategori*", "Keterangan*", "Jumlah (Rp)*"];
  const exampleRows = [
    [
      toDateIndo(new Date()),
      "Pemasukan",
      expenseCategories[0]?.name || "Pendapatan Penjualan",
      "Contoh: pendapatan shift pagi",
      500000,
    ],
    [
      toDateIndo(new Date()),
      "Pengeluaran",
      expenseCategories[1]?.name || "Operasional",
      "Contoh: beli bahan baku",
      150000,
    ],
  ];

  const wsTemplate = XLSX.utils.aoa_to_sheet([templateHeaders, ...exampleRows]);
  wsTemplate["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 18 },
  ];
  wsTemplate["!dataValidations"] = [
    {
      sqref: "B2:B1000",
      type: "list",
      formula1: '"Pemasukan,Pengeluaran"',
      showDropDown: false,
      showErrorMessage: true,
      error: "Pilih: Pemasukan atau Pengeluaran",
      errorTitle: "Nilai tidak valid",
    },
  ] as any;

  for (let i = 2; i <= 3; i++) {
    const addr = `E${i}`;
    if (wsTemplate[addr]) wsTemplate[addr].z = '#,##0';
  }
  // Orange header for template sheet
  for (let C = 0; C < templateHeaders.length; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!wsTemplate[addr]) wsTemplate[addr] = { v: "", t: "s" };
    wsTemplate[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "D97706" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
  }
  XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Input");

  downloadXlsx(wb, `Arus_Kas_${periodLabel}`);
};

// ─── Export Sales to XLSX ──────────────────────────────────────────────────────

export const exportSalesToXlsx = ({
  sales,
  settings,
  periodLabel,
}: {
  sales: SalesTransaction[];
  settings: Settings;
  periodLabel: string;
}) => {
  const wb = XLSX.utils.book_new();
  const brandName = settings.brandName || "Julia's Management System";

  const totalQty = sales.reduce((a, b) => a + b.quantitySold, 0);
  const totalRevenue = sales.reduce((a, b) => a + b.totalPrice, 0);
  const summaryData = [
    ["Laporan Penjualan", brandName],
    ["Periode", periodLabel],
    ["Total Transaksi", sales.length],
    ["Total Qty Terjual", totalQty],
    ["Total Omset (Rp)", totalRevenue],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 22 }, { wch: 22 }];
  if (wsSummary["B5"]) wsSummary["B5"].z = '#,##0';
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  const headers = ["Tanggal", "Nama Menu", "Qty Terjual", "Total (Rp)"];
  const rows = sales.map((s) => [
    toDateIndo(s.date),
    s.menuName,
    s.quantitySold,
    s.totalPrice,
  ]);
  const wsData = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  wsData["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 }];
  for (let i = 2; i <= rows.length + 1; i++) {
    const addr = `D${i}`;
    if (wsData[addr]) wsData[addr].z = '#,##0';
  }
  boldFirstRow(wsData, headers.length);
  styleDataRows(wsData, 1, rows.length, headers.length);
  XLSX.utils.book_append_sheet(wb, wsData, "Penjualan");

  downloadXlsx(wb, `Penjualan_${periodLabel}`);
};

// ─── Export Inventory to XLSX ──────────────────────────────────────────────────

export const exportInventoryToXlsx = ({
  ingredients,
  movements,
  settings,
  periodLabel,
}: {
  ingredients: Ingredient[];
  movements: StockMovement[];
  settings: Settings;
  periodLabel: string;
}) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Stok Saat Ini
  const stockHeaders = [
    "Nama Bahan", "Kategori", "Stok Saat Ini", "Stok Minimum",
    "Satuan", "Biaya/Unit (Rp)", "Nilai Stok (Rp)", "Status",
  ];
  const stockRows = ingredients.map((i) => [
    i.name, i.category, i.currentStock, i.minStock, i.unit,
    i.costPerUnit || 0,
    (i.currentStock || 0) * (i.costPerUnit || 0),
    i.currentStock <= i.minStock ? "⚠ Stok Rendah" : "✓ Aman",
  ]);
  const wsStock = XLSX.utils.aoa_to_sheet([stockHeaders, ...stockRows]);
  wsStock["!cols"] = [
    { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
  ];
  for (let i = 2; i <= stockRows.length + 1; i++) {
    if (wsStock[`F${i}`]) wsStock[`F${i}`].z = '#,##0';
    if (wsStock[`G${i}`]) wsStock[`G${i}`].z = '#,##0';
  }
  boldFirstRow(wsStock, stockHeaders.length);
  styleDataRows(wsStock, 1, stockRows.length, stockHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsStock, "Stok Saat Ini");

  // Sheet 2: Mutasi Stok
  const mutHeaders = [
    "Tanggal", "Bahan Baku", "Kategori", "Jenis Mutasi",
    "Jumlah", "Satuan", "Catatan", "Operator",
  ];
  const mutRows = movements.map((m) => {
    const ing = ingredients.find((i) => i.id === m.ingredientId);
    return [
      toDateIndo(m.date),
      ing?.name || "-",
      ing?.category || "-",
      m.type === "IN" ? "Masuk" : m.type,
      m.quantity,
      ing?.unit || "-",
      (m as any).note || "-",
      (m as any).createdBy || "-",
    ];
  });
  const wsMut = XLSX.utils.aoa_to_sheet([mutHeaders, ...mutRows]);
  wsMut["!cols"] = [
    { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 14 },
    { wch: 10 }, { wch: 8 }, { wch: 30 }, { wch: 16 },
  ];
  boldFirstRow(wsMut, mutHeaders.length);
  styleDataRows(wsMut, 1, mutRows.length, mutHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsMut, "Mutasi Stok");

  downloadXlsx(wb, `Inventaris_${periodLabel}`);
};

// ─── Download blank import template ───────────────────────────────────────────

export const downloadFinanceImportTemplate = (
  expenseCategories: ExpenseCategory[],
) => {
  const wb = XLSX.utils.book_new();
  const categoryNames = expenseCategories.map((c) => c.name).join(", ");

  const petunjuk: (string | number)[][] = [
    ["PETUNJUK PENGISIAN — TEMPLATE IMPORT KEUANGAN"],
    ["Tanggal: format DD/MM/YYYY atau YYYY-MM-DD"],
    [`Jenis: isi "Pemasukan" atau "Pengeluaran"`],
    [`Kategori: ${categoryNames || "sesuai daftar Kategori Keuangan"}`],
    ["Jumlah: angka saja tanpa titik/koma (contoh: 50000)"],
    ["Kolom bertanda * wajib diisi. Hapus baris petunjuk ini sebelum import."],
    [],
  ];

  const headers = ["Tanggal*", "Jenis*", "Kategori*", "Keterangan*", "Jumlah (Rp)*"];
  const exampleData = [
    [
      new Date().toLocaleDateString("id-ID"),
      "Pemasukan",
      expenseCategories[0]?.name || "Pendapatan Penjualan",
      "Pendapatan shift pagi",
      500000,
    ],
    [
      new Date().toLocaleDateString("id-ID"),
      "Pengeluaran",
      expenseCategories[1]?.name || "Operasional",
      "Pembelian bahan baku",
      150000,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...petunjuk, headers, ...exampleData]);
  ws["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 40 }, { wch: 18 },
  ];

  const headerRowIdx = petunjuk.length; // 0-indexed
  ws["!dataValidations"] = [
    {
      sqref: `B${headerRowIdx + 2}:B1000`,
      type: "list",
      formula1: '"Pemasukan,Pengeluaran"',
      showDropDown: false,
      showErrorMessage: true,
      error: "Pilih: Pemasukan atau Pengeluaran",
      errorTitle: "Nilai tidak valid",
    },
  ] as any;

  XLSX.utils.book_append_sheet(wb, ws, "Template Import");
  downloadXlsx(wb, "Template_Import_Keuangan");
};

// ─── Parse imported finance XLSX/CSV ─────────────────────────────────────────

export interface ParsedFinanceRow {
  date: string;
  type: "CASH_IN" | "CASH_OUT";
  category: string;
  description: string;
  amount: number;
}

export const parseFinanceImportFile = (
  file: File,
): Promise<{ rows: ParsedFinanceRow[]; errors: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });

        let ws: XLSX.WorkSheet | null = null;
        let headerRowIdx = 0;

        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          const raw = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: "",
          });
          for (let i = 0; i < raw.length; i++) {
            const row = raw[i] as string[];
            const hasDate = row.some((c) =>
              String(c).toLowerCase().includes("tanggal"),
            );
            const hasAmount = row.some((c) =>
              String(c).toLowerCase().includes("jumlah"),
            );
            if (hasDate && hasAmount) {
              ws = sheet;
              headerRowIdx = i;
              break;
            }
          }
          if (ws) break;
        }

        if (!ws) {
          reject(
            new Error(
              "Format file tidak dikenali. Pastikan menggunakan template yang disediakan.",
            ),
          );
          return;
        }

        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
          range: headerRowIdx,
          defval: "",
        });

        const rows: ParsedFinanceRow[] = [];
        const errors: string[] = [];

        raw.forEach((row, idx) => {
          const rowNum = idx + headerRowIdx + 2;
          // Normalize keys: strip * and lowercase
          const r: Record<string, string> = {};
          for (const k in row) {
            r[k.replace(/\*/g, "").trim().toLowerCase()] = String(row[k]).trim();
          }

          // Skip empty rows
          if (!r["tanggal"] && !r["jumlah (rp)"] && !r["jumlah"]) return;
          // Skip petunjuk rows
          if (r["tanggal"].toLowerCase().includes("petunjuk")) return;

          // Resolve type
          const jenisRaw = r["jenis"] || "";
          let type: "CASH_IN" | "CASH_OUT" | null = null;
          if (jenisRaw.toLowerCase().includes("masuk") || jenisRaw.toLowerCase() === "pemasukan")
            type = "CASH_IN";
          else if (jenisRaw.toLowerCase().includes("keluar") || jenisRaw.toLowerCase() === "pengeluaran")
            type = "CASH_OUT";

          if (!type) {
            errors.push(
              `Baris ${rowNum}: Jenis "${jenisRaw}" tidak valid. Gunakan "Pemasukan" atau "Pengeluaran".`,
            );
            return;
          }

          // Resolve date
          const dateRaw = r["tanggal"];
          let dateISO = "";
          // Try direct parsing
          const d1 = new Date(dateRaw);
          if (!isNaN(d1.getTime())) {
            dateISO = d1.toISOString();
          } else {
            // Try DD/MM/YYYY
            const parts = dateRaw.split(/[/\-\.]/);
            if (parts.length === 3) {
              const [dd, mm, yy] = parts;
              const d2 = new Date(
                `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`,
              );
              if (!isNaN(d2.getTime())) dateISO = d2.toISOString();
            }
          }
          if (!dateISO) {
            errors.push(`Baris ${rowNum}: Format tanggal "${dateRaw}" tidak dikenali.`);
            return;
          }

          // Resolve amount
          const amountRaw = r["jumlah (rp)"] || r["jumlah"] || "0";
          const amount = parseFloat(String(amountRaw).replace(/[^\d.-]/g, ""));
          if (isNaN(amount) || amount <= 0) {
            errors.push(`Baris ${rowNum}: Jumlah "${amountRaw}" tidak valid.`);
            return;
          }

          rows.push({
            date: dateISO,
            type,
            category: r["kategori"] || "Lainnya",
            description: r["keterangan"] || "",
            amount,
          });
        });

        resolve({ rows, errors });
      } catch (err: any) {
        reject(new Error(`Gagal membaca file: ${err.message}`));
      }
    };
    reader.readAsArrayBuffer(file);
  });
};
