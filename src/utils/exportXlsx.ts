import * as XLSX from "xlsx";
import {
  SalesTransaction,
  Ingredient,
  StockMovement,
  CashTransaction,
  Settings,
  ExpenseCategory,
  PayrollRecord,
  DailyAttendance,
  KPIRecord,
  Employee,
  DailySalesRecap,
} from "../types";
import {
  getSaleTransactionAmount,
  isNonOperationalCashTransaction,
  parseBankStatementAmount,
} from "./financeMetrics";
import { DEFAULT_STORE_TIMEZONE, getLocalDateString } from "./dateUtils";
import {
  calculateWorkDurationHours,
  classifyDailyAttendanceStatus,
} from "./attendanceRecap";
import {
  PRODUCT_GROUP_LABELS,
  type ProductSalesAnalyticsResult,
} from "./productSalesAnalytics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateIndo = (dateStr: string | Date): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DEFAULT_STORE_TIMEZONE,
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
  const operationalFinance = finance.filter((f) => !isNonOperationalCashTransaction(f));
  const isCashIn = (t: unknown) => {
    const up = String(t || "").toUpperCase();
    return up === "CASH_IN" || up === "IN" || up === "INCOME";
  };
  const totalIn = operationalFinance
    .filter((f) => isCashIn(f.type))
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalOut = operationalFinance
    .filter((f) => !isCashIn(f.type))
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
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
      new Date().toLocaleDateString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE }),
      "Pemasukan",
      expenseCategories[0]?.name || "Pendapatan Penjualan",
      "Pendapatan shift pagi",
      500000,
    ],
    [
      new Date().toLocaleDateString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE }),
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
          let rawDateCell: unknown = "";
          for (const k in row) {
            const normKey = k.replace(/\*/g, "").trim().toLowerCase();
            r[normKey] = String(row[k]).trim();
            if (normKey === "tanggal") rawDateCell = row[k];
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

          // Resolve date (aman zona waktu WITA, validasi kalender, serial Excel & DD/MM/YYYY)
          const dateRaw = r["tanggal"];
          let dateISO = "";
          const buildWitaIso = (yyyy: number, mm: number, dd: number): string => {
            if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1990 || yyyy > 2100) return "";
            const check = new Date(Date.UTC(yyyy, mm - 1, dd));
            if (
              check.getUTCFullYear() !== yyyy ||
              check.getUTCMonth() + 1 !== mm ||
              check.getUTCDate() !== dd
            ) {
              return "";
            }
            const yStr = String(yyyy);
            const mStr = String(mm).padStart(2, "0");
            const dStr = String(dd).padStart(2, "0");
            return new Date(`${yStr}-${mStr}-${dStr}T12:00:00+08:00`).toISOString();
          };

          if (rawDateCell instanceof Date && !Number.isNaN(rawDateCell.getTime())) {
            const ymd = getLocalDateString(rawDateCell);
            dateISO = new Date(`${ymd}T12:00:00+08:00`).toISOString();
          } else if (
            typeof rawDateCell === "number" &&
            Number.isFinite(rawDateCell) &&
            rawDateCell >= 25000 &&
            rawDateCell <= 65000
          ) {
            const utcMs = Math.round((rawDateCell - 25569) * 86400 * 1000);
            const dt = new Date(utcMs);
            dateISO = buildWitaIso(
              dt.getUTCFullYear(),
              dt.getUTCMonth() + 1,
              dt.getUTCDate()
            );
          } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateRaw)) {
            const [yy, mm, dd] = dateRaw.split("-").map(Number);
            dateISO = buildWitaIso(yy, mm, dd);
          } else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateRaw)) {
            const [dd, mm, yy] = dateRaw.split(/[\/\-\.]/).map(Number);
            dateISO = buildWitaIso(yy, mm, dd);
          } else if (/^\d{5}(\.\d+)?$/.test(dateRaw)) {
            const serial = Number(dateRaw);
            if (serial >= 25000 && serial <= 65000) {
              const utcMs = Math.round((serial - 25569) * 86400 * 1000);
              const dt = new Date(utcMs);
              dateISO = buildWitaIso(
                dt.getUTCFullYear(),
                dt.getUTCMonth() + 1,
                dt.getUTCDate()
              );
            }
          } else {
            const d1 = new Date(dateRaw);
            if (!Number.isNaN(d1.getTime())) {
              dateISO = d1.toISOString();
            }
          }

          if (!dateISO) {
            errors.push(`Baris ${rowNum}: Format tanggal "${dateRaw}" tidak dikenali.`);
            return;
          }

          // Resolve amount (aman pemisah ribuan Indonesia "Rp 150.000")
          const amountRaw = r["jumlah (rp)"] || r["jumlah"] || "0";
          const amount = Math.abs(parseBankStatementAmount(amountRaw));
          if (!Number.isFinite(amount) || amount <= 0) {
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

export const exportPayrollToXlsx = ({
  payroll,
  employees,
  settings,
  periodLabel,
}: {
  payroll: PayrollRecord[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const wb = XLSX.utils.book_new();

  const dataRows = payroll.map((p, idx) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || p.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: p.period,
      "Gaji Pokok (Rp)": p.basicSalary,
      "Tunj. Jabatan (Rp)": p.positionAllowance,
      "Uang Makan (Rp)": p.mealAllowance,
      "Transport (Rp)": p.transportAllowance || 0,
      "Bonus KPI (Rp)": p.kpiBonus,
      "Bonus Target (Rp)": p.targetBonus || 0,
      "Lembur (Rp)": p.overtimePay || 0,
      "Potongan Alpha (Rp)": p.alphaDeduction,
      "Potongan Lain (Rp)": p.otherDeductions || 0,
      "Take Home Pay (Rp)": p.netPay,
      Status: p.status,
      "Tgl Dibayar": p.paidDate ? toDateIndo(p.paidDate) : "-",
    };
  });

  const ws = XLSX.utils.json_to_sheet(dataRows);
  const cols = 16;
  boldFirstRow(ws, cols);
  styleDataRows(ws, 1, dataRows.length, cols);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 13 },
    { wch: 16 },
    { wch: 15 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Rekap Penggajian");
  XLSX.writeFile(wb, `Laporan_Penggajian_${periodLabel.replace(/\s+/g, "_")}.xlsx`);
};

export const exportAttendanceToXlsx = ({
  attendances,
  employees,
  settings,
  periodLabel,
}: {
  attendances: DailyAttendance[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const wb = XLSX.utils.book_new();

  const empMap = new Map<string, { present: number; late: number; sick: number; alpha: number; totalHours: number }>();
  attendances.forEach((att) => {
    const prev = empMap.get(att.employeeId) || { present: 0, late: 0, sick: 0, alpha: 0, totalHours: 0 };
    const cls = classifyDailyAttendanceStatus(att);
    if (cls === "HADIR") prev.present++;
    else if (cls === "TERLAMBAT") {
      prev.present++;
      prev.late++;
    } else if (cls === "IZIN" || cls === "SAKIT") prev.sick++;
    else prev.alpha++;

    if (cls === "HADIR" || cls === "TERLAMBAT") {
      prev.totalHours += calculateWorkDurationHours(att.clockInTime, att.clockOutTime);
    }
    empMap.set(att.employeeId, prev);
  });

  const dataRows = Array.from(empMap.entries()).map(([empId, stats], idx) => {
    const emp = employees.find((e) => e.id === empId);
    const totalDays = stats.present + stats.sick + stats.alpha;
    const rate = totalDays > 0 ? Math.round((stats.present / totalDays) * 100) : 0;
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || empId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      "Hadir (Hari)": stats.present,
      "Terlambat (Kali)": stats.late,
      "Izin / Sakit (Hari)": stats.sick,
      "Alpha (Hari)": stats.alpha,
      "Total Jam Kerja": parseFloat(stats.totalHours.toFixed(1)),
      "Persentase Kehadiran (%)": `${rate}%`,
    };
  });

  const ws = XLSX.utils.json_to_sheet(dataRows);
  const cols = 10;
  boldFirstRow(ws, cols);
  styleDataRows(ws, 1, dataRows.length, cols);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 15 },
    { wch: 12 },
    { wch: 13 },
    { wch: 15 },
    { wch: 16 },
    { wch: 13 },
    { wch: 16 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
  XLSX.writeFile(wb, `Laporan_Absensi_${periodLabel.replace(/\s+/g, "_")}.xlsx`);
};

export const exportKpiToXlsx = ({
  kpiRecords,
  employees,
  settings,
  periodLabel,
}: {
  kpiRecords: KPIRecord[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const wb = XLSX.utils.book_new();

  const dataRows = kpiRecords.map((k, idx) => {
    const emp = employees.find((e) => e.id === k.employeeId);
    const grade =
      k.totalScore >= 85 ? "Sangat Baik (A)" : k.totalScore >= 70 ? "Baik (B)" : k.totalScore >= 55 ? "Cukup (C)" : "Perlu Evaluasi (D)";
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || k.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: (k as any).period || `${k.year}-${String(k.month).padStart(2, "0")}`,
      "Total Skor (0-100)": k.totalScore,
      "Predikat Grade": grade,
      "Bonus KPI (Rp)": k.kpiBonus,
      "Catatan Evaluator": k.notes || "-",
    };
  });

  const ws = XLSX.utils.json_to_sheet(dataRows);
  const cols = 9;
  boldFirstRow(ws, cols);
  styleDataRows(ws, 1, dataRows.length, cols);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Capaian KPI");
  XLSX.writeFile(wb, `Laporan_KPI_${periodLabel.replace(/\s+/g, "_")}.xlsx`);
};

// ─── Export All-in-One Master Executive Report to XLSX ─────────────────────────

export interface ExportMasterExecutiveOptions {
  sales: SalesTransaction[];
  finance: CashTransaction[];
  ingredients: Ingredient[];
  movements?: StockMovement[];
  payroll: PayrollRecord[];
  attendances: DailyAttendance[];
  kpiRecords: KPIRecord[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
  expenseCategories?: ExpenseCategory[];
}

export const exportMasterExecutiveReportXlsx = ({
  sales,
  finance,
  ingredients,
  movements = [],
  payroll,
  attendances,
  kpiRecords,
  employees,
  settings,
  periodLabel,
  expenseCategories = [],
}: ExportMasterExecutiveOptions) => {
  const wb = XLSX.utils.book_new();

  // ─── 1. SHEET 1: RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY) ──────────────────────
  const totalGrossSales = sales.reduce((sum, s) => sum + ((s as any).subtotal || getSaleTransactionAmount(s)), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + ((s as any).discount || 0), 0);
  const totalNetSales = sales.reduce((sum, s) => sum + getSaleTransactionAmount(s), 0);
  const totalSalesTransactions = sales.length;
  const aov = totalSalesTransactions > 0 ? Math.round(totalNetSales / totalSalesTransactions) : 0;

  const operationalFinance = finance.filter((f) => !isNonOperationalCashTransaction(f));
  const totalCashIn = operationalFinance
    .filter((f) => (f.type as string) === "IN" || (f as any).type === "INCOME" || f.type === "CASH_IN")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalCashOut = operationalFinance
    .filter((f) => (f.type as string) === "OUT" || (f as any).type === "EXPENSE" || f.type === "CASH_OUT")
    .reduce((sum, f) => sum + (f.amount || 0), 0);

  const totalPayrollCost = payroll.reduce((sum, p) => sum + (p.netPay || p.grossPay || 0), 0);
  const estimatedOperatingProfit = totalNetSales - totalCashOut - totalPayrollCost;

  const totalInventoryAssetValue = ingredients.reduce((sum, ing) => {
    const cost = ing.costPerUnit || (ing as any).unitPrice || (ing as any).price || 0;
    const stockQty = ing.currentStock ?? (ing as any).stock ?? 0;
    return sum + (cost * stockQty);
  }, 0);
  const lowStockCount = ingredients.filter((ing) => (ing.currentStock ?? (ing as any).stock ?? 0) <= (ing.minStock || 0)).length;

  const totalPresentLogs = attendances.filter((a) => {
    const cls = classifyDailyAttendanceStatus(a);
    return cls === "HADIR" || cls === "TERLAMBAT";
  }).length;
  const attendanceRate = attendances.length > 0 ? Math.round((totalPresentLogs / attendances.length) * 100) : 100;

  const summaryRows = [
    { Kategori: "INFORMASI LAPORAN", Indikator: "Nama Usaha / Outlet", Nilai: settings.brandName || (settings as any).storeName || "Julia Coffee", Keterangan: "-" },
    { Kategori: "INFORMASI LAPORAN", Indikator: "Periode Laporan", Nilai: periodLabel, Keterangan: "-" },
    { Kategori: "INFORMASI LAPORAN", Indikator: "Tanggal Pembuatan Laporan", Nilai: toDateIndo(new Date()), Keterangan: "Diekspor otomatis dari sistem" },
    { Kategori: "INFORMASI LAPORAN", Indikator: "Mata Uang", Nilai: (settings as any).currency || "IDR", Keterangan: "Rupiah Indonesia" },

    { Kategori: "RINGKASAN PENJUALAN", Indikator: "Total Omzet Penjualan Kotor", Nilai: totalGrossSales, Keterangan: "Subtotal sebelum diskon" },
    { Kategori: "RINGKASAN PENJUALAN", Indikator: "Total Diskon & Promo", Nilai: totalDiscount, Keterangan: "Potongan harga yang diberikan" },
    { Kategori: "RINGKASAN PENJUALAN", Indikator: "Total Penjualan Bersih (Net Sales)", Nilai: totalNetSales, Keterangan: "Total penerimaan penjualan riil" },
    { Kategori: "RINGKASAN PENJUALAN", Indikator: "Total Struk / Transaksi", Nilai: totalSalesTransactions, Keterangan: "Jumlah transaksi berhasil" },
    { Kategori: "RINGKASAN PENJUALAN", Indikator: "Average Order Value (AOV)", Nilai: aov, Keterangan: "Rata-rata belanja per struk" },

    { Kategori: "RINGKASAN ARUS KAS", Indikator: "Total Kas Masuk Non-Sales", Nilai: totalCashIn, Keterangan: "Penerimaan kas di luar kasir" },
    { Kategori: "RINGKASAN ARUS KAS", Indikator: "Total Pengeluaran Kas Operasional", Nilai: totalCashOut, Keterangan: "Beban belanja operasional & utilitas" },

    { Kategori: "BEBAN SDM & PAYROLL", Indikator: "Total Beban Gaji & Upah (Payroll)", Nilai: totalPayrollCost, Keterangan: "Total take home pay karyawan" },
    { Kategori: "BEBAN SDM & PAYROLL", Indikator: "Jumlah Karyawan Terbayar", Nilai: payroll.length, Keterangan: "Slip gaji yang diproses" },

    { Kategori: "PROFITABILITAS OPERASIONAL", Indikator: "Estimasi Laba Bersih Operasional", Nilai: estimatedOperatingProfit, Keterangan: "Net Sales - Biaya Kas Keluar - Beban Payroll" },

    { Kategori: "INVENTARIS & STOK", Indikator: "Total Item Bahan Baku Aktif", Nilai: ingredients.length, Keterangan: "Jumlah varian bahan baku" },
    { Kategori: "INVENTARIS & STOK", Indikator: "Estimasi Nilai Aset Bahan Baku", Nilai: totalInventoryAssetValue, Keterangan: "Stok tersedia x Estimasi HPP" },
    { Kategori: "INVENTARIS & STOK", Indikator: "Item Bahan Perlu Restock", Nilai: lowStockCount, Keterangan: "Stok saat ini <= Batas Minimum" },

    { Kategori: "DISIPLIN KEHADIRAN", Indikator: "Total Catatan Presensi Shift", Nilai: attendances.length, Keterangan: "Catatan Clock In/Out" },
    { Kategori: "DISIPLIN KEHADIRAN", Indikator: "Total Kehadiran Kerja", Nilai: totalPresentLogs, Keterangan: "Shift berstatus Hadir/Terlambat" },
    { Kategori: "DISIPLIN KEHADIRAN", Indikator: "Tingkat Kehadiran (Disiplin)", Nilai: `${attendanceRate}%`, Keterangan: "Persentase kehadiran shift" },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  boldFirstRow(wsSummary, 4);
  styleDataRows(wsSummary, 1, summaryRows.length, 4);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 35 }, { wch: 22 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Eksekutif");

  // ─── 2. SHEET 2: PENJUALAN (SALES) ──────────────────────────────────────────
  const salesRows = sales.map((s, idx) => ({
    No: idx + 1,
    Tanggal: toDateIndo(s.date || (s as any).createdAt),
    "No. Receipt": (s as any).receiptNumber || (s as any).invoiceNumber || s.id,
    "Metode Pembayaran": (s as any).paymentMethod || "TUNAI",
    Kasir: (s as any).cashierName || (s as any).servedBy || "-",
    Subtotal: (s as any).subtotal || (s as any).total || s.totalPrice || 0,
    Diskon: (s as any).discount || 0,
    Pajak: (s as any).tax || 0,
    "Total Bayar (Rp)": (s as any).total || s.totalPrice || 0,
    Status: (s as any).status || "COMPLETED",
  }));
  const wsSales = XLSX.utils.json_to_sheet(salesRows);
  boldFirstRow(wsSales, 10);
  styleDataRows(wsSales, 1, salesRows.length, 10);
  wsSales["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSales, "Penjualan (Sales)");

  // ─── 3. SHEET 3: ARUS KAS (FINANCE) ─────────────────────────────────────────
  const financeRows = finance.map((f, idx) => ({
    No: idx + 1,
    Tanggal: toDateIndo(f.date || (f as any).createdAt),
    Tipe: (f.type as string) === "IN" || (f as any).type === "INCOME" || f.type === "CASH_IN" ? "Pemasukan (IN)" : "Pengeluaran (OUT)",
    Kategori: f.category || (f as any).categoryName || "-",
    Keterangan: f.description || (f as any).notes || "-",
    "Akun Kas/Bank": (f as any).accountId || (f as any).accountName || "Kas Utama",
    "Jumlah (Rp)": f.amount || 0,
    "Dicatat Oleh": (f as any).createdBy || "-",
  }));
  const wsFinance = XLSX.utils.json_to_sheet(financeRows);
  boldFirstRow(wsFinance, 8);
  styleDataRows(wsFinance, 1, financeRows.length, 8);
  wsFinance["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsFinance, "Arus Kas (Finance)");

  // ─── 4. SHEET 4: INVENTARIS & BAHAN (INVENTORY) ──────────────────────────────
  const inventoryRows = ingredients.map((ing, idx) => {
    const cost = ing.costPerUnit || (ing as any).unitPrice || (ing as any).price || 0;
    const stockQty = ing.currentStock ?? (ing as any).stock ?? 0;
    const assetVal = cost * stockQty;
    const isLow = stockQty <= (ing.minStock || 0);
    return {
      No: idx + 1,
      "Nama Bahan": ing.name,
      Kategori: ing.category || "Bahan Baku",
      "Stok Saat Ini": stockQty,
      Satuan: ing.unit,
      "Stok Minimum": ing.minStock || 0,
      "Biaya Satuan HPP (Rp)": cost,
      "Nilai Aset Stok (Rp)": assetVal,
      "Status Stok": isLow ? "MENIPIS / ORDER ULANG" : "AMAN",
    };
  });
  const wsInventory = XLSX.utils.json_to_sheet(inventoryRows);
  boldFirstRow(wsInventory, 9);
  styleDataRows(wsInventory, 1, inventoryRows.length, 9);
  wsInventory["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsInventory, "Stok Bahan (Inventory)");

  // ─── 5. SHEET 5: PENGGAJIAN (PAYROLL) ───────────────────────────────────────
  const payrollRows = payroll.map((p, idx) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || p.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: p.period,
      "Gaji Pokok": p.basicSalary || 0,
      Tunjangan: (p.positionAllowance || 0) + (p.mealAllowance || 0) + (p.transportAllowance || 0),
      "Bonus KPI": p.kpiBonus || 0,
      "Bonus Target Omzet": p.targetBonus || 0,
      "Potongan Alpha": p.alphaDeduction || 0,
      "Take Home Pay (Rp)": p.netPay || 0,
      Status: p.status || "DRAFT",
    };
  });
  const wsPayroll = XLSX.utils.json_to_sheet(payrollRows);
  boldFirstRow(wsPayroll, 12);
  styleDataRows(wsPayroll, 1, payrollRows.length, 12);
  wsPayroll["!cols"] = [{ wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsPayroll, "Penggajian (Payroll)");

  // ─── 6. SHEET 6: ABSENSI & KEHADIRAN (ATTENDANCE) ───────────────────────────
  const attendanceRows = attendances.map((a, idx) => {
    const emp = employees.find((e) => e.id === a.employeeId);
    const cls = classifyDailyAttendanceStatus(a);
    const durHours = (cls === "HADIR" || cls === "TERLAMBAT")
      ? calculateWorkDurationHours(a.clockInTime, a.clockOutTime)
      : 0;
    const dur = durHours > 0 ? `${durHours.toFixed(1)} Jam` : "-";
    return {
      No: idx + 1,
      Tanggal: a.date,
      "Nama Karyawan": emp?.name || a.employeeId,
      Jabatan: emp?.position || "-",
      "Jam Masuk": a.clockInTime ? new Date(a.clockInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_STORE_TIMEZONE }) : "-",
      "Jam Pulang": a.clockOutTime ? new Date(a.clockOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_STORE_TIMEZONE }) : "-",
      Durasi: dur,
      Status: a.status,
      "Verifikasi Manager": a.approvalStatus === "APPROVED" ? "Disahkan" : a.approvalStatus === "REJECTED" ? "Ditolak" : "Menunggu",
      Catatan: a.notes || "-",
    };
  });
  const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
  boldFirstRow(wsAttendance, 10);
  styleDataRows(wsAttendance, 1, attendanceRows.length, 10);
  wsAttendance["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsAttendance, "Kehadiran (Attendance)");

  // ─── 7. SHEET 7: CAPAIAN KPI & KINERJA (KPI) ────────────────────────────────
  const kpiRows = kpiRecords.map((k, idx) => {
    const emp = employees.find((e) => e.id === k.employeeId);
    const grade = k.totalScore >= 85 ? "Sangat Baik (A)" : k.totalScore >= 70 ? "Baik (B)" : k.totalScore >= 55 ? "Cukup (C)" : "Perlu Evaluasi (D)";
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || k.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: (k as any).period || `${k.year}-${String(k.month).padStart(2, "0")}`,
      "Skor KPI (0-100)": k.totalScore,
      Grade: grade,
      "Bonus KPI (Rp)": k.kpiBonus,
      "Catatan Evaluator": k.notes || "-",
    };
  });
  const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
  boldFirstRow(wsKpi, 9);
  styleDataRows(wsKpi, 1, kpiRows.length, 9);
  wsKpi["!cols"] = [{ wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "Kinerja KPI");

  // Simpan File Master Workbook Multi-Sheet
  const storeSlug = (settings.brandName || (settings as any).storeName || "Julia_Coffee").replace(/\s+/g, "_");
  const periodSlug = periodLabel.replace(/\s+/g, "_");
  XLSX.writeFile(wb, `Laporan_Komprehensif_${storeSlug}_${periodSlug}.xlsx`);
};

// ─── Export Daily Sales Recap to XLSX ──────────────────────────────────────────

export const exportDailySalesRecapToXlsx = ({
  recaps,
  settings,
  periodLabel = "Semua_Tanggal",
}: {
  recaps: DailySalesRecap[];
  settings: Settings;
  periodLabel?: string;
}) => {
  const wb = XLSX.utils.book_new();

  const totalCash = recaps.reduce((acc, r) => acc + (r.cashAmount || 0), 0);
  const totalQris = recaps.reduce((acc, r) => acc + (r.qrisAmount || 0), 0);
  const totalEdc = recaps.reduce((acc, r) => acc + (r.edcAmount || 0), 0);
  const totalTransfer = recaps.reduce((acc, r) => acc + (r.transferAmount || 0), 0);
  const totalOnline = recaps.reduce((acc, r) => acc + (r.onlineDeliveryAmount || 0), 0);
  const totalDiscount = recaps.reduce((acc, r) => acc + (r.discountAmount || 0), 0);
  const totalRefund = recaps.reduce((acc, r) => acc + (r.refundAmount || 0), 0);
  const totalMdr = recaps.reduce((acc, r) => acc + (r.mdrFeeAmount || 0), 0);
  const grandTotal = recaps.reduce((acc, r) => acc + (r.totalAmount || 0), 0);

  const summaryData = [
    ["LAPORAN REKAP PENJUALAN HARIAN", ""],
    ["Unit Usaha", settings.brandName || "Julia Coffee"],
    ["Periode / Filter", periodLabel],
    ["Tanggal Unduh", new Date().toLocaleString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE })],
    ["Total Catatan", recaps.length],
    ["Total Tunai (Cash)", totalCash],
    ["Total QRIS", totalQris],
    ["Total Mesin EDC", totalEdc],
    ["Total Transfer Bank", totalTransfer],
    ["Total Ojol / Delivery (Bank)", totalOnline],
    ["Total Diskon POS", totalDiscount],
    ["Total Refund", totalRefund],
    ["Total Potongan MDR", totalMdr],
    ["Grand Total Omzet", grandTotal],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 30 }];
  boldFirstRow(wsSummary, 2);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  const headers = [
    "No",
    "Tanggal",
    "Shift",
    "Tunai (Cash)",
    "QRIS",
    "Mesin EDC",
    "Transfer Bank",
    "Ojol / Delivery",
    "Diskon POS",
    "Refund",
    "Biaya MDR",
    "Status Non-Tunai",
    "Total Omzet",
    "Keterangan",
    "Dicatat Oleh",
  ];

  const rows: any[][] = recaps.map((r, i) => [
    i + 1,
    r.date,
    r.shift || "ALL",
    r.cashAmount || 0,
    r.qrisAmount || 0,
    r.edcAmount || 0,
    r.transferAmount || 0,
    r.onlineDeliveryAmount || 0,
    r.discountAmount || 0,
    r.refundAmount || 0,
    r.mdrFeeAmount || 0,
    r.nonCashSettlementStatus === "PENDING" ? "Menunggu Cair" : "Sudah Masuk Bank",
    r.totalAmount || 0,
    r.notes || "-",
    r.recordedBy || "Kasir",
  ]);

  // Baris Total di bagian akhir
  rows.push([
    "",
    "TOTAL KESELURUHAN",
    "",
    totalCash,
    totalQris,
    totalEdc,
    totalTransfer,
    totalOnline,
    totalDiscount,
    totalRefund,
    totalMdr,
    "",
    grandTotal,
    "",
    "",
  ]);

  const wsData = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  wsData["!cols"] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
  ];

  boldFirstRow(wsData, headers.length);
  styleDataRows(wsData, 1, rows.length, headers.length);
  XLSX.utils.book_append_sheet(wb, wsData, "Rekap Penjualan");

  downloadXlsx(wb, `Rekap_Penjualan_Harian_${periodLabel.replace(/\s+/g, "_")}`);
};

// ─── Export Dashboard Penjualan Produk (4 Sheet Analitik PMIX) ─────────────────

export const exportProductSalesAnalyticsToXlsx = ({
  analytics,
  settings,
  periodLabel,
}: {
  analytics: ProductSalesAnalyticsResult;
  settings: Settings;
  periodLabel: string;
}) => {
  const wb = XLSX.utils.book_new();
  const brandName = settings.brandName || "Julia's Management System";
  const { kpiSummary, omzetCrossCheck } = analytics;

  // Sheet 1: Ringkasan & Cross-Check
  const summaryRows: any[][] = [
    ["Laporan Penjualan Produk (PMIX)", brandName],
    ["Periode / Filter", periodLabel],
    ["Dicetak", toDateIndo(new Date())],
    [],
    ["RINGKASAN PERFORMA PRODUK", "Nilai"],
    ["Total Produk Terjual (Cup/Porsi)", kpiSummary.totalQty],
    ["Rata-rata Terjual per Hari", kpiSummary.avgDailyQty],
    ["Total Omzet Produk (Rp)", kpiSummary.totalRevenue],
    ["Estimasi Total HPP (Rp)", kpiSummary.totalHpp],
    ["Estimasi Laba Kotor (Rp)", kpiSummary.grossProfit],
    ["Rata-rata Gross Margin (%)", `${kpiSummary.marginPercent}%`],
    ["Food Cost (%)", `${kpiSummary.foodCostPercent}%`],
    [],
    ["CROSS-CHECK REKAP OMZET HARIAN", "Nilai"],
    ["Total Rekap Omzet Harian (Rp)", omzetCrossCheck.totalRecapOmzet],
    ["Total Penjualan Produk Toko (Rp)", omzetCrossCheck.totalAllProductSales],
    ["Selisih (Produk - Rekap Omzet) (Rp)", omzetCrossCheck.difference],
    ["Tingkat Kecocokan (%)", `${omzetCrossCheck.matchPercent}%`],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 36 }, { wch: 24 }];
  [8, 9, 10, 15, 16, 17].forEach((rowIdx) => {
    const addr = `B${rowIdx}`;
    if (wsSummary[addr]) wsSummary[addr].z = "#,##0";
  });
  boldFirstRow(wsSummary, 2);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan & Cross-Check");

  // Sheet 2: Rekap Produk & Varian (PMIX)
  const pmixHeaders = [
    "No",
    "Nama Produk",
    "Rincian Varian",
    "Divisi",
    "Kategori Produk",
    "Kategori Menu",
    "Qty Terjual",
    "% Share",
    "Total Omzet (Rp)",
    "Estimasi HPP (Rp)",
    "Laba Kotor (Rp)",
    "Margin (%)",
    "Status Menu Engineering",
  ];
  const quadLabels: Record<string, string> = {
    STAR: "Unggulan (Star)",
    PLOWHORSE: "Populer (Plowhorse)",
    PUZZLE: "Potensial (Puzzle)",
    DOG: "Evaluasi (Dog)",
  };
  const pmixRows = analytics.productMixRows.map((row, idx) => [
    idx + 1,
    row.productName,
    row.variantsBreakdown.map((v) => `${v.variantName} (${v.qtySold}x)`).join("; "),
    row.division,
    PRODUCT_GROUP_LABELS[row.productGroup] || row.productGroup,
    row.menuCategory,
    row.totalQty,
    `${row.revenueSharePercent}%`,
    row.totalRevenue,
    row.totalHpp,
    row.grossProfit,
    `${row.marginPercent}%`,
    quadLabels[row.quadrant] || row.quadrant,
  ]);
  const wsPmix = XLSX.utils.aoa_to_sheet([pmixHeaders, ...pmixRows]);
  wsPmix["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 34 },
    { wch: 12 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
  ];
  for (let i = 2; i <= pmixRows.length + 1; i++) {
    ["I", "J", "K"].forEach((col) => {
      if (wsPmix[`${col}${i}`]) wsPmix[`${col}${i}`].z = "#,##0";
    });
  }
  boldFirstRow(wsPmix, pmixHeaders.length);
  styleDataRows(wsPmix, 1, pmixRows.length, pmixHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsPmix, "Rekap Produk & Varian");

  // Sheet 3: Pemakaian Bahan & Kemasan Teoretis
  const ingHeaders = [
    "No",
    "Nama Bahan / Kemasan",
    "Total Terpakai",
    "Satuan",
    "Biaya / Satuan (Rp)",
    "Total Biaya (Rp)",
    "Sisa Stok Gudang",
    "Menu Pemakai",
  ];
  const ingRows = analytics.ingredientUsageSummary.map((ing, idx) => [
    idx + 1,
    ing.ingredientName,
    ing.totalUsedQty,
    ing.unit,
    ing.unitCost,
    ing.totalCost,
    ing.currentStock,
    ing.usedByMenus.join(", "),
  ]);
  const wsIng = XLSX.utils.aoa_to_sheet([ingHeaders, ...ingRows]);
  wsIng["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 15 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 40 },
  ];
  for (let i = 2; i <= ingRows.length + 1; i++) {
    ["E", "F"].forEach((col) => {
      if (wsIng[`${col}${i}`]) wsIng[`${col}${i}`].z = "#,##0";
    });
  }
  boldFirstRow(wsIng, ingHeaders.length);
  styleDataRows(wsIng, 1, ingRows.length, ingHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsIng, "Pemakaian Bahan & Kemasan");

  // Sheet 4: Rincian Transaksi Harian (tetap kompatibel untuk re-import)
  const logHeaders = [
    "Tanggal",
    "Nama Menu",
    "Varian",
    "Divisi",
    "Kategori Produk",
    "Kategori Menu",
    "Quantity",
    "Total Penjualan",
    "Est. HPP (Rp)",
    "Laba Kotor (Rp)",
  ];
  const logRows = analytics.filteredTransactions.map((item) => [
    item.localDate,
    item.resolved.isMatched ? item.resolved.productName : item.tx.menuName,
    item.resolved.variantName,
    item.resolved.division,
    PRODUCT_GROUP_LABELS[item.resolved.productGroup] || item.resolved.productGroup,
    item.resolved.menuCategory,
    item.quantity,
    item.revenue,
    item.totalHpp,
    item.grossProfit,
  ]);
  const wsLog = XLSX.utils.aoa_to_sheet([logHeaders, ...logRows]);
  wsLog["!cols"] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ];
  for (let i = 2; i <= logRows.length + 1; i++) {
    ["H", "I", "J"].forEach((col) => {
      if (wsLog[`${col}${i}`]) wsLog[`${col}${i}`].z = "#,##0";
    });
  }
  boldFirstRow(wsLog, logHeaders.length);
  styleDataRows(wsLog, 1, logRows.length, logHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsLog, "Rincian Transaksi Harian");

  downloadXlsx(wb, `Penjualan_Produk_${periodLabel.replace(/\s+/g, "_")}`);
};



