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
  PurchaseOrder,
  Supplier,
  Product,
  ShiftSession,
} from "../types";
import {
  computeRevenueCategoryBreakdown,
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
  inferProductGroup,
  PRODUCT_GROUP_LABELS,
  type ProductSalesAnalyticsResult,
} from "./productSalesAnalytics";
import { buildStyledWorkbook } from "./excelTemplate";
import { formatStockMovementTypeLabel } from "./export";

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

const toYmdSafe = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return "-";
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10) || "-";
  return getLocalDateString(d, DEFAULT_STORE_TIMEZONE);
};

// ─── Export Finance to XLSX ────────────────────────────────────────────────────

export interface ExportFinanceXlsxOptions {
  finance: CashTransaction[];
  settings: Settings;
  periodLabel: string;
  expenseCategories?: ExpenseCategory[];
}

export const exportFinanceToXlsx = async ({
  finance,
  settings,
  periodLabel,
  expenseCategories = [],
}: ExportFinanceXlsxOptions) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const operationalFinance = finance.filter((f) => !isNonOperationalCashTransaction(f));
  const isCashIn = (t: unknown) => {
    const up = String(t || "").toUpperCase();
    return up === "CASH_IN" || up === "IN" || up === "INCOME";
  };
  const totalIn = Math.round(
    operationalFinance
      .filter((f) => isCashIn(f.type))
      .reduce((a, b) => a + (Number(b.amount) || 0), 0)
  );
  const totalOut = Math.round(
    operationalFinance
      .filter((f) => !isCashIn(f.type))
      .reduce((a, b) => a + (Number(b.amount) || 0), 0)
  );
  const net = totalIn - totalOut;
  const revBreakdown = computeRevenueCategoryBreakdown({
    cashTransactions: finance,
    expenseCategories,
    period: "ALL",
  });

  await buildStyledWorkbook({
    filename: `Arus_Kas_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Ringkasan",
        title: "Laporan Arus Kas & Buku Besar",
        subtitle: `${brandName} • Periode: ${periodLabel}`,
        headers: ["Indikator Arus Kas", "Jumlah (Rp)"],
        rows: [
          ["Total Pemasukan Operasional", totalIn],
          ["Total Pengeluaran Operasional", totalOut],
          ["Arus Kas Bersih (Net Cashflow)", net],
        ],
        columnFormats: ["text", "currency"],
      },
      {
        name: "Rincian Pendapatan",
        title: "Rincian Pendapatan per Kategori",
        subtitle: `Periode: ${periodLabel}`,
        headers: ["Kategori Pendapatan", "Jenis", "Jumlah Transaksi", "Total Nominal (Rp)", "Kontribusi (%)"],
        rows: revBreakdown.rows.map((r) => [
          r.name,
          r.isSales ? "Penjualan" : "Pendapatan Lain",
          r.txCount,
          r.amount,
          `${r.sharePercent.toFixed(1)}%`,
        ]),
        columnFormats: ["text", "text", "integer", "currency", "text"],
        totalRow: [
          "TOTAL PEMASUKAN PENDAPATAN",
          "",
          revBreakdown.rows.reduce((s, r) => s + r.txCount, 0),
          revBreakdown.totalRevenueCashIn,
          revBreakdown.totalRevenueCashIn > 0 ? "100.0%" : "0.0%",
        ],
      },
      {
        name: "Transaksi",
        title: "Rincian Transaksi Buku Kas",
        subtitle: `Periode: ${periodLabel} • ${finance.length} transaksi`,
        headers: ["Tanggal", "Jenis", "Kategori", "Keterangan", "Vendor", "Jumlah (Rp)"],
        rows: finance.map((f) => [
          toYmdSafe(f.date),
          isCashIn(f.type) ? "Pemasukan" : "Pengeluaran",
          f.category || "-",
          f.description || "-",
          f.vendorName || "-",
          Math.round(Number(f.amount) || 0),
        ]),
        columnFormats: ["date", "text", "text", "text", "text", "currency"],
        totalRow: ["TOTAL OPS", "", "", "", "", net],
      },
    ],
  });
};

// ─── Export Sales to XLSX ──────────────────────────────────────────────────────

export const exportSalesToXlsx = async ({
  sales,
  settings,
  periodLabel,
}: {
  sales: SalesTransaction[];
  settings: Settings;
  periodLabel: string;
}) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const totalQty = sales.reduce((a, b) => a + (Number(b.quantitySold) || 0), 0);
  const totalRevenue = Math.round(
    sales.reduce((a, b) => a + getSaleTransactionAmount(b), 0)
  );

  await buildStyledWorkbook({
    filename: `Penjualan_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Ringkasan",
        title: "Laporan Penjualan Produk",
        subtitle: `${brandName} • Periode: ${periodLabel}`,
        headers: ["Indikator", "Nilai"],
        rows: [
          ["Total Baris Transaksi", sales.length],
          ["Total Cup / Porsi Terjual", totalQty],
          ["Total Omzet Penjualan (Rp)", totalRevenue],
        ],
        columnFormats: ["text", "integer"],
      },
      {
        name: "Penjualan",
        title: "Daftar Transaksi Penjualan",
        subtitle: `Periode: ${periodLabel} • ${sales.length} baris`,
        headers: ["Tanggal", "Nama Menu", "Qty Terjual", "Total (Rp)"],
        rows: sales.map((s) => [
          toYmdSafe(s.date),
          s.menuName,
          Math.round(Number(s.quantitySold) || 0),
          Math.round(getSaleTransactionAmount(s)),
        ]),
        columnFormats: ["date", "text", "integer", "currency"],
        totalRow: ["TOTAL", `${sales.length} Transaksi`, totalQty, totalRevenue],
      },
    ],
  });
};

// ─── Export Inventory to XLSX ──────────────────────────────────────────────────

export const exportInventoryToXlsx = async ({
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
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const totalValuation = Math.round(
    ingredients.reduce(
      (sum, i) => sum + Math.max(0, Number(i.currentStock) || 0) * (Number(i.costPerUnit) || 0),
      0
    )
  );

  await buildStyledWorkbook({
    filename: `Inventaris_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Stok Saat Ini",
        title: "Saldo & Valuasi Bahan Baku Gudang",
        subtitle: `${brandName} • ${ingredients.length} bahan terdaftar`,
        headers: [
          "Kode",
          "Nama Bahan",
          "Kategori",
          "Lokasi",
          "Stok Saat Ini",
          "Stok Minimum",
          "Satuan",
          "Modal / Unit (Rp)",
          "Nilai Stok (Rp)",
          "Status",
        ],
        rows: ingredients.map((i) => {
          const val = Math.round(
            Math.max(0, Number(i.currentStock) || 0) * (Number(i.costPerUnit) || 0)
          );
          return [
            i.code || "-",
            i.name,
            i.category,
            i.storageLocation || "BAR",
            Number(i.currentStock) || 0,
            Number(i.minStock) || 0,
            i.unit,
            Math.round(Number(i.costPerUnit) || 0),
            val,
            i.currentStock <= i.minStock ? "Stok Rendah" : "Aman",
          ];
        }),
        columnFormats: [
          "text",
          "text",
          "text",
          "text",
          "number",
          "number",
          "text",
          "currency",
          "currency",
          "text",
        ],
        totalRow: ["", "TOTAL VALUASI ASET STOK", "", "", "", "", "", "", totalValuation, ""],
      },
      {
        name: "Mutasi Stok",
        title: "Riwayat Mutasi Masuk & Keluar Stok",
        subtitle: `Periode: ${periodLabel} • ${movements.length} mutasi`,
        headers: ["Tanggal", "Bahan Baku", "Kategori", "Jenis Mutasi", "Jumlah", "Satuan", "Catatan", "Operator"],
        rows: movements.map((m) => {
          const ing = ingredients.find((i) => i.id === m.ingredientId);
          return [
            toYmdSafe(m.date),
            ing?.name || "-",
            ing?.category || "-",
            formatStockMovementTypeLabel(m.type),
            Number(m.quantity) || 0,
            ing?.unit || "-",
            (m as any).note || "-",
            (m as any).createdBy || "-",
          ];
        }),
        columnFormats: ["date", "text", "text", "text", "number", "text", "text", "text"],
      },
    ],
  });
};

// ─── Download blank import template ───────────────────────────────────────────

export const downloadFinanceImportTemplate = async (
  expenseCategories: ExpenseCategory[],
) => {
  const { buildTemplateWithDropdown } = await import("./excelTemplate");
  const today = getLocalDateString();
  const categoryNames = Array.from(
    new Set(expenseCategories.map((c) => c.name).filter(Boolean))
  );
  const firstCat = categoryNames[0] || "Pendapatan Penjualan";

  await buildTemplateWithDropdown({
    filename: "Template_Import_Keuangan",
    sheetName: "Data Keuangan",
    isExampleFirstRow: true,
    columns: [
      {
        header: "Tanggal",
        type: "date",
        format: "date",
        required: true,
        width: 16,
        hint: "Format YYYY-MM-DD (contoh: 2026-11-25)",
      },
      {
        header: "Jenis",
        options: ["Pemasukan", "Pengeluaran"],
        required: true,
        width: 16,
        hint: "Pilih Pemasukan atau Pengeluaran dari dropdown",
      },
      {
        header: "Kategori",
        options: categoryNames.length > 0 ? categoryNames : ["Operasional", "Bahan Baku"],
        required: true,
        width: 28,
        hint: "Pilih kategori kas dari dropdown",
      },
      {
        header: "Keterangan",
        type: "text",
        required: true,
        width: 38,
        hint: "Contoh: Pembelian Susu UHT / Omzet Harian",
      },
      {
        header: "Jumlah (Rp)",
        type: "integer",
        format: "currency",
        required: true,
        width: 20,
        hint: "Masukkan angka bulat tanpa 'Rp' atau titik (contoh: 150000)",
      },
    ],
    rows: [[today, "Pengeluaran", firstCat, "Contoh: Beli bahan baku kopi", 150000]],
    instructions: [
      "Kolom Jenis dan Kategori sudah dilengkapi dropdown Excel.",
      "Nominal Jumlah (Rp) diisi angka bulat saja (misal: 150000).",
    ],
  });
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
          const r: Record<string, string> = {};
          let rawDateCell: unknown = "";
          for (const k in row) {
            const normKey = k.replace(/\*/g, "").trim().toLowerCase();
            r[normKey] = String(row[k]).trim();
            if (normKey === "tanggal") rawDateCell = row[k];
          }

          if (!r["tanggal"] && !r["jumlah (rp)"] && !r["jumlah"]) return;
          if (r["tanggal"].toLowerCase().includes("petunjuk")) return;

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
            description: r["keterangan"] || r["deskripsi"] || "",
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

// ─── Export Payroll, Attendance & KPI to XLSX ─────────────────────────────────

export const exportPayrollToXlsx = async ({
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
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const totalNet = Math.round(payroll.reduce((s, p) => s + (Number(p.netPay) || 0), 0));
  const totalBasic = Math.round(payroll.reduce((s, p) => s + (Number(p.basicSalary) || 0), 0));
  const totalKpi = Math.round(payroll.reduce((s, p) => s + (Number(p.kpiBonus) || 0), 0));

  await buildStyledWorkbook({
    filename: `Laporan_Penggajian_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Rekap Penggajian",
        title: "Laporan Rekapitulasi Penggajian & Bonus",
        subtitle: `${brandName} • Periode: ${periodLabel} • ${payroll.length} slip`,
        headers: [
          "No",
          "Nama Karyawan",
          "Jabatan",
          "Divisi",
          "Periode",
          "Gaji Pokok (Rp)",
          "Tunj. Jabatan (Rp)",
          "Uang Makan (Rp)",
          "Transport (Rp)",
          "Bonus KPI (Rp)",
          "Bonus Target (Rp)",
          "Lembur (Rp)",
          "Potongan Alpha (Rp)",
          "Potongan Lain (Rp)",
          "Take Home Pay (Rp)",
          "Status",
          "Tgl Dibayar",
        ],
        rows: payroll.map((p, idx) => {
          const emp = employees.find((e) => e.id === p.employeeId);
          return [
            idx + 1,
            emp?.name || p.employeeId,
            emp?.position || "-",
            emp?.department || "-",
            p.period,
            Math.round(p.basicSalary || 0),
            Math.round(p.positionAllowance || 0),
            Math.round(p.mealAllowance || 0),
            Math.round(p.transportAllowance || 0),
            Math.round(p.kpiBonus || 0),
            Math.round(p.targetBonus || 0),
            Math.round(p.overtimePay || 0),
            Math.round(p.alphaDeduction || 0),
            Math.round(p.otherDeductions || 0),
            Math.round(p.netPay || 0),
            p.status,
            p.paidDate ? toDateIndo(p.paidDate) : "-",
          ];
        }),
        columnFormats: [
          "integer",
          "text",
          "text",
          "text",
          "text",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "text",
          "text",
        ],
        totalRow: [
          "",
          "TOTAL",
          "",
          "",
          "",
          totalBasic,
          "",
          "",
          "",
          totalKpi,
          "",
          "",
          "",
          "",
          totalNet,
          "",
          "",
        ],
      },
    ],
  });
};

export const exportAttendanceToXlsx = async ({
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
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
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

  const rows = Array.from(empMap.entries()).map(([empId, stats], idx) => {
    const emp = employees.find((e) => e.id === empId);
    const totalDays = stats.present + stats.sick + stats.alpha;
    const rate = totalDays > 0 ? stats.present / totalDays : 0;
    return [
      idx + 1,
      emp?.name || empId,
      emp?.position || "-",
      emp?.department || "-",
      stats.present,
      stats.late,
      stats.sick,
      stats.alpha,
      parseFloat(stats.totalHours.toFixed(1)),
      rate,
    ];
  });

  await buildStyledWorkbook({
    filename: `Laporan_Absensi_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Rekap Absensi",
        title: "Laporan Rekapitulasi Absensi & Jam Kerja",
        subtitle: `${brandName} • Periode: ${periodLabel} • ${attendances.length} log presensi`,
        headers: [
          "No",
          "Nama Karyawan",
          "Jabatan",
          "Divisi",
          "Hadir (Hari)",
          "Terlambat (Kali)",
          "Izin / Sakit (Hari)",
          "Alpha (Hari)",
          "Total Jam Kerja",
          "Persentase Hadir",
        ],
        rows,
        columnFormats: [
          "integer",
          "text",
          "text",
          "text",
          "integer",
          "integer",
          "integer",
          "integer",
          "number",
          "percent",
        ],
      },
    ],
  });
};

export const exportKpiToXlsx = async ({
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
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const totalBonus = Math.round(kpiRecords.reduce((s, k) => s + (Number(k.kpiBonus) || 0), 0));

  await buildStyledWorkbook({
    filename: `Laporan_KPI_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Capaian KPI",
        title: "Laporan Evaluasi Kinerja KPI Karyawan",
        subtitle: `${brandName} • Periode: ${periodLabel}`,
        headers: [
          "No",
          "Nama Karyawan",
          "Jabatan",
          "Divisi",
          "Periode",
          "Total Skor (0-100)",
          "Predikat Grade",
          "Bonus KPI (Rp)",
          "Catatan Evaluator",
        ],
        rows: kpiRecords.map((k, idx) => {
          const emp = employees.find((e) => e.id === k.employeeId);
          const grade =
            k.totalScore >= 85
              ? "Sangat Baik (A)"
              : k.totalScore >= 70
                ? "Baik (B)"
                : k.totalScore >= 55
                  ? "Cukup (C)"
                  : "Perlu Evaluasi (D)";
          return [
            idx + 1,
            emp?.name || k.employeeId,
            emp?.position || "-",
            emp?.department || "-",
            (k as any).period || `${k.year}-${String(k.month).padStart(2, "0")}`,
            Number(k.totalScore) || 0,
            grade,
            Math.round(Number(k.kpiBonus) || 0),
            k.notes || "-",
          ];
        }),
        columnFormats: ["integer", "text", "text", "text", "text", "number", "text", "currency", "text"],
        totalRow: ["", "TOTAL BONUS KPI", "", "", "", "", "", totalBonus, ""],
      },
    ],
  });
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

export const exportMasterExecutiveReportXlsx = async ({
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
}: ExportMasterExecutiveOptions) => {
  const brandName = settings.brandName || (settings as any).storeName || "Julia's • Specialty Room • Coffee • Eatery";
  const totalGrossSales = Math.round(
    sales.reduce((sum, s) => sum + ((s as any).subtotal || getSaleTransactionAmount(s)), 0)
  );
  const totalDiscount = Math.round(sales.reduce((sum, s) => sum + ((s as any).discount || 0), 0));
  const totalNetSales = Math.round(sales.reduce((sum, s) => sum + getSaleTransactionAmount(s), 0));
  const totalSalesTransactions = sales.length;
  const aov = totalSalesTransactions > 0 ? Math.round(totalNetSales / totalSalesTransactions) : 0;

  const operationalFinance = finance.filter((f) => !isNonOperationalCashTransaction(f));
  const totalCashIn = Math.round(
    operationalFinance
      .filter((f) => (f.type as string) === "IN" || (f as any).type === "INCOME" || f.type === "CASH_IN")
      .reduce((sum, f) => sum + (f.amount || 0), 0)
  );
  const totalCashOut = Math.round(
    operationalFinance
      .filter((f) => (f.type as string) === "OUT" || (f as any).type === "EXPENSE" || f.type === "CASH_OUT")
      .reduce((sum, f) => sum + (f.amount || 0), 0)
  );

  const totalPayrollCost = Math.round(payroll.reduce((sum, p) => sum + (p.netPay || p.grossPay || 0), 0));
  const estimatedOperatingProfit = totalNetSales - totalCashOut - totalPayrollCost;

  const totalInventoryAssetValue = Math.round(
    ingredients.reduce((sum, ing) => {
      const cost = ing.costPerUnit || (ing as any).unitPrice || (ing as any).price || 0;
      const stockQty = ing.currentStock ?? (ing as any).stock ?? 0;
      return sum + cost * stockQty;
    }, 0)
  );
  const lowStockCount = ingredients.filter(
    (ing) => (ing.currentStock ?? (ing as any).stock ?? 0) <= (ing.minStock || 0)
  ).length;

  const totalPresentLogs = attendances.filter((a) => {
    const cls = classifyDailyAttendanceStatus(a);
    return cls === "HADIR" || cls === "TERLAMBAT";
  }).length;
  const attendanceRate = attendances.length > 0 ? Math.round((totalPresentLogs / attendances.length) * 100) : 100;

  const storeSlug = brandName.replace(/[^a-zA-Z0-9]+/g, "_");
  const periodSlug = periodLabel.replace(/\s+/g, "_");

  await buildStyledWorkbook({
    filename: `Laporan_Komprehensif_${storeSlug}_${periodSlug}`,
    brandName,
    sheets: [
      {
        name: "Ringkasan Eksekutif",
        title: "Laporan Master Eksekutif (All-in-One)",
        subtitle: `${brandName} • Periode: ${periodLabel}`,
        headers: ["Kategori", "Indikator", "Nilai", "Keterangan"],
        rows: [
          ["INFORMASI", "Nama Usaha / Outlet", brandName, "-"],
          ["INFORMASI", "Periode Laporan", periodLabel, "-"],
          ["PENJUALAN", "Omzet Kotor (Gross Sales)", totalGrossSales, "Subtotal sebelum diskon"],
          ["PENJUALAN", "Total Diskon & Promo", totalDiscount, "Potongan harga"],
          ["PENJUALAN", "Penjualan Bersih (Net Sales)", totalNetSales, `${totalSalesTransactions} transaksi`],
          ["PENJUALAN", "Average Order Value (AOV)", aov, "Rata-rata per transaksi"],
          ["ARUS KAS", "Kas Masuk Operasional", totalCashIn, "Penerimaan kas tercatat"],
          ["ARUS KAS", "Pengeluaran Operasional", totalCashOut, "Beban belanja & utilitas"],
          ["PAYROLL", "Total Beban Gaji (THP)", totalPayrollCost, `${payroll.length} slip gaji`],
          ["PROFITABILITAS", "Estimasi Laba Bersih Ops", estimatedOperatingProfit, "Net Sales - Kas Keluar - Payroll"],
          ["INVENTARIS", "Jumlah Item Bahan Baku", ingredients.length, `${lowStockCount} stok menipis`],
          ["INVENTARIS", "Estimasi Valuasi Aset Stok", totalInventoryAssetValue, "Stok tersedia x HPP"],
          ["KEHADIRAN", "Catatan Presensi Shift", attendances.length, `${attendanceRate}% tingkat hadir`],
        ],
        columnFormats: ["text", "text", "text", "text"],
      },
      {
        name: "Penjualan (Sales)",
        title: "Rincian Penjualan Produk",
        subtitle: `Periode: ${periodLabel}`,
        headers: ["No", "Tanggal", "Nama Menu", "Qty", "Metode", "Total (Rp)"],
        rows: sales.map((s, idx) => [
          idx + 1,
          toYmdSafe(s.date),
          s.menuName,
          Math.round(Number(s.quantitySold) || 0),
          s.paymentMethod || "TUNAI",
          Math.round(getSaleTransactionAmount(s)),
        ]),
        columnFormats: ["integer", "date", "text", "integer", "text", "currency"],
        totalRow: ["", "TOTAL", `${sales.length} baris`, sales.reduce((a, b) => a + (b.quantitySold || 0), 0), "", totalNetSales],
      },
      {
        name: "Arus Kas (Finance)",
        title: "Rincian Arus Kas",
        subtitle: `Periode: ${periodLabel}`,
        headers: ["No", "Tanggal", "Tipe", "Kategori", "Keterangan", "Jumlah (Rp)"],
        rows: finance.map((f, idx) => [
          idx + 1,
          toYmdSafe(f.date),
          f.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
          f.category || "-",
          f.description || "-",
          Math.round(Number(f.amount) || 0),
        ]),
        columnFormats: ["integer", "date", "text", "text", "text", "currency"],
      },
      {
        name: "Stok Bahan (Inventory)",
        title: "Saldo Stok & Mutasi Bahan Baku",
        subtitle: `${ingredients.length} bahan • ${movements.length} mutasi`,
        headers: ["No", "Nama Bahan", "Kategori", "Stok Saat Ini", "Satuan", "Min Stok", "Modal/Unit (Rp)", "Nilai Aset (Rp)", "Status"],
        rows: ingredients.map((ing, idx) => {
          const cost = Math.round(Number(ing.costPerUnit) || 0);
          const stockQty = Number(ing.currentStock) || 0;
          return [
            idx + 1,
            ing.name,
            ing.category || "-",
            stockQty,
            ing.unit,
            Number(ing.minStock) || 0,
            cost,
            Math.round(cost * stockQty),
            stockQty <= (ing.minStock || 0) ? "MENIPIS" : "AMAN",
          ];
        }),
        columnFormats: ["integer", "text", "text", "number", "text", "number", "currency", "currency", "text"],
        totalRow: ["", "TOTAL VALUASI ASET", "", "", "", "", "", totalInventoryAssetValue, ""],
      },
      {
        name: "Penggajian (Payroll)",
        title: "Rekapitulasi Penggajian Karyawan",
        subtitle: `Periode: ${periodLabel}`,
        headers: ["No", "Nama Karyawan", "Jabatan", "Periode", "Gaji Pokok", "Tunjangan", "Bonus KPI", "Potongan", "Take Home Pay", "Status"],
        rows: payroll.map((p, idx) => {
          const emp = employees.find((e) => e.id === p.employeeId);
          return [
            idx + 1,
            emp?.name || p.employeeId,
            emp?.position || "-",
            p.period,
            Math.round(p.basicSalary || 0),
            Math.round((p.positionAllowance || 0) + (p.mealAllowance || 0) + (p.transportAllowance || 0)),
            Math.round(p.kpiBonus || 0),
            Math.round(p.alphaDeduction || 0),
            Math.round(p.netPay || 0),
            p.status || "DRAFT",
          ];
        }),
        columnFormats: ["integer", "text", "text", "text", "currency", "currency", "currency", "currency", "currency", "text"],
        totalRow: ["", "TOTAL PAYROLL", "", "", "", "", "", "", totalPayrollCost, ""],
      },
      {
        name: "Kehadiran (Attendance)",
        title: "Catatan Presensi Karyawan",
        subtitle: `Periode: ${periodLabel}`,
        headers: ["No", "Tanggal", "Nama Karyawan", "Jabatan", "Jam Masuk", "Jam Pulang", "Durasi (Jam)", "Status", "Verifikasi"],
        rows: attendances.map((a, idx) => {
          const emp = employees.find((e) => e.id === a.employeeId);
          const cls = classifyDailyAttendanceStatus(a);
          const durHours = cls === "HADIR" || cls === "TERLAMBAT" ? calculateWorkDurationHours(a.clockInTime, a.clockOutTime) : 0;
          return [
            idx + 1,
            a.date,
            emp?.name || a.employeeId,
            emp?.position || "-",
            a.clockInTime ? new Date(a.clockInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_STORE_TIMEZONE }) : "-",
            a.clockOutTime ? new Date(a.clockOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_STORE_TIMEZONE }) : "-",
            parseFloat(durHours.toFixed(1)),
            a.status,
            a.approvalStatus === "APPROVED" ? "Disahkan" : a.approvalStatus === "REJECTED" ? "Ditolak" : "Menunggu",
          ];
        }),
        columnFormats: ["integer", "date", "text", "text", "text", "text", "number", "text", "text"],
      },
      {
        name: "Kinerja KPI",
        title: "Evaluasi Kinerja KPI Karyawan",
        subtitle: `Periode: ${periodLabel}`,
        headers: ["No", "Nama Karyawan", "Jabatan", "Periode", "Skor (0-100)", "Bonus KPI (Rp)", "Catatan"],
        rows: kpiRecords.map((k, idx) => {
          const emp = employees.find((e) => e.id === k.employeeId);
          return [
            idx + 1,
            emp?.name || k.employeeId,
            emp?.position || "-",
            (k as any).period || `${k.year}-${String(k.month).padStart(2, "0")}`,
            Number(k.totalScore) || 0,
            Math.round(Number(k.kpiBonus) || 0),
            k.notes || "-",
          ];
        }),
        columnFormats: ["integer", "text", "text", "text", "number", "currency", "text"],
      },
    ],
  });
};

// ─── Export Daily Sales Recap to XLSX ──────────────────────────────────────────

export const exportDailySalesRecapToXlsx = async ({
  recaps,
  settings,
  periodLabel = "Semua_Tanggal",
}: {
  recaps: DailySalesRecap[];
  settings: Settings;
  periodLabel?: string;
}) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const totalCash = Math.round(recaps.reduce((acc, r) => acc + (r.cashAmount || 0), 0));
  const totalQris = Math.round(recaps.reduce((acc, r) => acc + (r.qrisAmount || 0), 0));
  const totalEdc = Math.round(recaps.reduce((acc, r) => acc + (r.edcAmount || 0), 0));
  const totalTransfer = Math.round(recaps.reduce((acc, r) => acc + (r.transferAmount || 0), 0));
  const totalOnline = Math.round(recaps.reduce((acc, r) => acc + (r.onlineDeliveryAmount || 0), 0));
  const totalDiscount = Math.round(recaps.reduce((acc, r) => acc + (r.discountAmount || 0), 0));
  const totalRefund = Math.round(recaps.reduce((acc, r) => acc + (r.refundAmount || 0), 0));
  const totalMdr = Math.round(recaps.reduce((acc, r) => acc + (r.mdrFeeAmount || 0), 0));
  const grandTotal = Math.round(recaps.reduce((acc, r) => acc + (r.totalAmount || 0), 0));

  await buildStyledWorkbook({
    filename: `Rekap_Penjualan_Harian_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Ringkasan",
        title: "Ringkasan Rekap Omzet Harian",
        subtitle: `${brandName} • Periode: ${periodLabel} • ${recaps.length} entri`,
        headers: ["Kanal Pembayaran / Indikator", "Total (Rp)"],
        rows: [
          ["Tunai (Cash)", totalCash],
          ["QRIS", totalQris],
          ["Mesin EDC", totalEdc],
          ["Transfer Bank", totalTransfer],
          ["Online Delivery (Ojol)", totalOnline],
          ["Total Diskon POS", totalDiscount],
          ["Total Refund", totalRefund],
          ["Total Biaya MDR", totalMdr],
          ["Grand Total Omzet", grandTotal],
        ],
        columnFormats: ["text", "currency"],
      },
      {
        name: "Rekap Penjualan",
        title: "Rincian Rekap Omzet Harian",
        subtitle: `Periode: ${periodLabel}`,
        headers: [
          "No",
          "Tanggal",
          "Shift",
          "Tunai (Rp)",
          "QRIS (Rp)",
          "EDC (Rp)",
          "Transfer (Rp)",
          "Ojol (Rp)",
          "Diskon (Rp)",
          "Refund (Rp)",
          "MDR (Rp)",
          "Status Non-Tunai",
          "Total Omzet (Rp)",
          "Keterangan",
          "Dicatat Oleh",
        ],
        rows: recaps.map((r, i) => [
          i + 1,
          toYmdSafe(r.date),
          r.shift || "ALL",
          Math.round(r.cashAmount || 0),
          Math.round(r.qrisAmount || 0),
          Math.round(r.edcAmount || 0),
          Math.round(r.transferAmount || 0),
          Math.round(r.onlineDeliveryAmount || 0),
          Math.round(r.discountAmount || 0),
          Math.round(r.refundAmount || 0),
          Math.round(r.mdrFeeAmount || 0),
          r.nonCashSettlementStatus === "PENDING" ? "Menunggu Cair" : "Sudah Masuk Bank",
          Math.round(r.totalAmount || 0),
          r.notes || "-",
          r.recordedBy || "Kasir",
        ]),
        columnFormats: [
          "integer",
          "date",
          "text",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "currency",
          "text",
          "currency",
          "text",
          "text",
        ],
        totalRow: [
          "",
          "TOTAL",
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
        ],
      },
    ],
  });
};

// ─── Export Dashboard Penjualan Produk (4 Sheet Analitik PMIX) ─────────────────

export const exportProductSalesAnalyticsToXlsx = async ({
  analytics,
  settings,
  periodLabel,
}: {
  analytics: ProductSalesAnalyticsResult;
  settings: Settings;
  periodLabel: string;
}) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const { kpiSummary, omzetCrossCheck } = analytics;
  const quadLabels: Record<string, string> = {
    STAR: "Unggulan (Star)",
    PLOWHORSE: "Populer (Plowhorse)",
    PUZZLE: "Potensial (Puzzle)",
    DOG: "Evaluasi (Dog)",
  };

  await buildStyledWorkbook({
    filename: `Penjualan_Produk_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Ringkasan & Cross-Check",
        title: "Analitik Penjualan Produk (PMIX) & Cross-Check Omzet",
        subtitle: `${brandName} • Periode: ${periodLabel}`,
        headers: ["Indikator Performa & Cross-Check", "Nilai"],
        rows: [
          ["Total Produk Terjual (Cup/Porsi)", kpiSummary.totalQty],
          ["Rata-rata Terjual per Hari", kpiSummary.avgDailyQty],
          ["Total Omzet Produk (Rp)", Math.round(kpiSummary.totalRevenue)],
          ["Estimasi Total HPP (Rp)", Math.round(kpiSummary.totalHpp)],
          ["Estimasi Laba Kotor (Rp)", Math.round(kpiSummary.grossProfit)],
          ["Rata-rata Gross Margin (%)", `${kpiSummary.marginPercent}%`],
          ["Food Cost (%)", `${kpiSummary.foodCostPercent}%`],
          ["Total Rekap Omzet Harian (Rp)", Math.round(omzetCrossCheck.totalRecapOmzet)],
          ["Total Penjualan Produk Toko (Rp)", Math.round(omzetCrossCheck.totalAllProductSales)],
          ["Selisih Produk vs Rekap (Rp)", Math.round(omzetCrossCheck.difference)],
          ["Tingkat Kecocokan (%)", `${omzetCrossCheck.matchPercent}%`],
        ],
        columnFormats: ["text", "text"],
      },
      {
        name: "Rekap Produk & Varian",
        title: "Rekapitulasi Menu Engineering & Varian",
        subtitle: `Periode: ${periodLabel}`,
        headers: [
          "No",
          "Nama Produk",
          "Rincian Varian",
          "Divisi",
          "Kategori Produk",
          "Kategori Menu",
          "Qty Terjual",
          "Share Omzet",
          "Total Omzet (Rp)",
          "Estimasi HPP (Rp)",
          "Laba Kotor (Rp)",
          "Margin",
          "Status Menu",
        ],
        rows: analytics.productMixRows.map((row, idx) => [
          idx + 1,
          row.productName,
          row.variantsBreakdown.map((v) => `${v.variantName} (${v.qtySold}x)`).join("; "),
          row.division,
          PRODUCT_GROUP_LABELS[row.productGroup] || row.productGroup,
          row.menuCategory,
          row.totalQty,
          (Number(row.revenueSharePercent) || 0) / 100,
          Math.round(row.totalRevenue),
          Math.round(row.totalHpp),
          Math.round(row.grossProfit),
          (Number(row.marginPercent) || 0) / 100,
          quadLabels[row.quadrant] || row.quadrant,
        ]),
        columnFormats: [
          "integer",
          "text",
          "text",
          "text",
          "text",
          "text",
          "integer",
          "percent",
          "currency",
          "currency",
          "currency",
          "percent",
          "text",
        ],
        totalRow: [
          "",
          "TOTAL",
          "",
          "",
          "",
          "",
          kpiSummary.totalQty,
          1,
          Math.round(kpiSummary.totalRevenue),
          Math.round(kpiSummary.totalHpp),
          Math.round(kpiSummary.grossProfit),
          (Number(kpiSummary.marginPercent) || 0) / 100,
          "",
        ],
      },
      {
        name: "Pemakaian Bahan",
        title: "Estimasi Pemakaian Bahan & Kemasan Teoretis",
        headers: [
          "No",
          "Nama Bahan / Kemasan",
          "Total Terpakai",
          "Satuan",
          "Biaya / Satuan (Rp)",
          "Total Biaya (Rp)",
          "Sisa Stok Gudang",
          "Menu Pemakai",
        ],
        rows: analytics.ingredientUsageSummary.map((ing, idx) => [
          idx + 1,
          ing.ingredientName,
          ing.totalUsedQty,
          ing.unit,
          Math.round(ing.unitCost),
          Math.round(ing.totalCost),
          ing.currentStock,
          ing.usedByMenus.join(", "),
        ]),
        columnFormats: ["integer", "text", "number", "text", "currency", "currency", "number", "text"],
      },
      {
        name: "Rincian Transaksi",
        title: "Log Transaksi Penjualan Produk",
        headers: [
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
        ],
        rows: analytics.filteredTransactions.map((item) => [
          item.localDate,
          item.resolved.isMatched ? item.resolved.productName : item.tx.menuName,
          item.resolved.variantName,
          item.resolved.division,
          PRODUCT_GROUP_LABELS[item.resolved.productGroup] || item.resolved.productGroup,
          item.resolved.menuCategory,
          item.quantity,
          Math.round(item.revenue),
          Math.round(item.totalHpp),
          Math.round(item.grossProfit),
        ]),
        columnFormats: [
          "date",
          "text",
          "text",
          "text",
          "text",
          "text",
          "integer",
          "currency",
          "currency",
          "currency",
        ],
      },
    ],
  });
};

// ─── 3 Exporter Modul Tambahan (PO, Katalog Menu, Shift Kasir) ────────────────

export const exportPurchaseOrdersToXlsx = async ({
  purchaseOrders,
  suppliers,
  ingredients = [],
  settings,
  periodLabel,
}: {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  ingredients?: Ingredient[];
  settings: Settings;
  periodLabel: string;
}) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  let totalAmountSum = 0;
  let totalPaidSum = 0;

  const summaryRows = purchaseOrders.map((po) => {
    const sup = suppliers.find((s) => s.id === po.supplierId);
    const total = Math.round(Number(po.totalAmount) || 0);
    const paid = Math.round(Number(po.amountPaid) || 0);
    totalAmountSum += total;
    totalPaidSum += paid;
    return [
      po.poNumber,
      toYmdSafe(po.date),
      sup?.name || po.supplierName || "-",
      po.purchaseType === "MARKET" ? "Belanja Pasar" : "PO Distributor",
      total,
      paid,
      Math.max(0, total - paid),
      po.status,
      po.deliveryStatus,
      po.dueDate ? toYmdSafe(po.dueDate) : "-",
    ];
  });

  const itemRows = purchaseOrders.flatMap((po) => {
    const sup = suppliers.find((s) => s.id === po.supplierId);
    return (po.items || []).map((item) => {
      const ingName =
        ingredients.find((i) => i.id === item.productId)?.name || item.productId;
      return [
        po.poNumber,
        toYmdSafe(po.date),
        sup?.name || po.supplierName || "-",
        ingName,
        Number(item.quantity) || 0,
        item.unit || "-",
        Math.round(Number(item.unitPrice) || 0),
        Math.round(Number(item.subtotal) || 0),
      ];
    });
  });

  await buildStyledWorkbook({
    filename: `Laporan_Pembelian_PO_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Ringkasan PO",
        title: "Laporan Purchase Order & Hutang Supplier",
        subtitle: `${brandName} • Periode: ${periodLabel}`,
        headers: [
          "No. PO",
          "Tanggal",
          "Supplier / Pasar",
          "Jenis",
          "Total Tagihan (Rp)",
          "Sudah Dibayar (Rp)",
          "Sisa Hutang (Rp)",
          "Status Bayar",
          "Status Terima",
          "Jatuh Tempo",
        ],
        rows: summaryRows,
        columnFormats: [
          "text",
          "date",
          "text",
          "text",
          "currency",
          "currency",
          "currency",
          "text",
          "text",
          "date",
        ],
        totalRow: [
          "TOTAL",
          "",
          `${purchaseOrders.length} PO`,
          "",
          totalAmountSum,
          totalPaidSum,
          Math.max(0, totalAmountSum - totalPaidSum),
          "",
          "",
          "",
        ],
      },
      {
        name: "Rincian Item PO",
        title: "Rincian Bahan per Purchase Order",
        headers: ["No. PO", "Tanggal", "Supplier", "Nama Bahan", "Qty", "Satuan", "Harga Satuan (Rp)", "Subtotal (Rp)"],
        rows: itemRows,
        columnFormats: ["text", "date", "text", "text", "number", "text", "currency", "currency"],
        totalRow: ["", "", "", "TOTAL", "", "", "", totalAmountSum],
      },
    ],
  });
};

export const exportMenuCatalogToXlsx = async ({
  products,
  settings,
  periodLabel,
}: {
  products: Product[];
  settings: Settings;
  periodLabel: string;
}) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  const rows = products.flatMap((p) => {
    const vars =
      Array.isArray(p.variants) && p.variants.length > 0
        ? p.variants
        : [{ id: "-", productId: p.id, name: "Reguler", sku: "", price: 0, estimatedHpp: 0, packagingCost: 0, isAvailable: p.isActive }];
    return vars.map((v) => {
      const price = Math.round(Number(v.price) || 0);
      const hpp = Math.round(Number(v.estimatedHpp) || 0);
      const marginPct = price > 0 ? Math.max(-1, Math.min(1, (price - hpp) / price)) : 0;
      return [
        p.division,
        p.productGroup || inferProductGroup(p.division, p.category, p.productGroup, v.name),
        p.category,
        p.name,
        v.name,
        v.sku || "-",
        price,
        hpp,
        marginPct,
        p.isActive && v.isAvailable !== false ? "AKTIF" : "NONAKTIF",
      ];
    });
  });

  await buildStyledWorkbook({
    filename: `Katalog_Menu_HPP_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Katalog Menu & HPP",
        title: "Katalog Menu Resmi, Varian & Analisis HPP",
        subtitle: `${brandName} • ${rows.length} varian menu`,
        headers: [
          "Divisi",
          "Grup Produk",
          "Kategori Menu",
          "Nama Menu",
          "Varian",
          "SKU",
          "Harga Jual (Rp)",
          "Estimasi HPP (Rp)",
          "Margin (%)",
          "Status",
        ],
        rows,
        columnFormats: [
          "text",
          "text",
          "text",
          "text",
          "text",
          "text",
          "currency",
          "currency",
          "percent",
          "text",
        ],
      },
    ],
  });
};

export const exportShiftsToXlsx = async ({
  shifts,
  settings,
  periodLabel,
}: {
  shifts: ShiftSession[];
  settings: Settings;
  periodLabel: string;
}) => {
  const brandName = settings.brandName || "Julia's • Specialty Room • Coffee • Eatery";
  let totalStart = 0;
  let totalExp = 0;
  let totalAct = 0;
  let totalDiff = 0;

  const rows = shifts.map((s) => {
    const startCash = Math.round(Number(s.startingCash) || 0);
    const expCash = Math.round(Number(s.expectedEndingCash) || 0);
    const actCash = Math.round(Number(s.actualEndingCash) || 0);
    const diff = Math.round(Number(s.difference) || 0);
    totalStart += startCash;
    totalExp += expCash;
    totalAct += actCash;
    totalDiff += diff;
    return [
      new Date(s.startTime).toLocaleString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE }),
      s.endTime
        ? new Date(s.endTime).toLocaleString("id-ID", { timeZone: DEFAULT_STORE_TIMEZONE })
        : "-",
      s.picEmployeeName || "-",
      startCash,
      expCash,
      actCash,
      diff,
      s.status,
    ];
  });

  await buildStyledWorkbook({
    filename: `Riwayat_Shift_Kasir_${periodLabel.replace(/\s+/g, "_")}`,
    brandName,
    sheets: [
      {
        name: "Riwayat Shift Kasir",
        title: "Laporan Riwayat & Rekonsiliasi Shift Kasir",
        subtitle: `${brandName} • Periode: ${periodLabel} • ${shifts.length} shift`,
        headers: [
          "Waktu Buka (WITA)",
          "Waktu Tutup (WITA)",
          "PIC Shift",
          "Modal Awal (Rp)",
          "Kas Diharapkan (Rp)",
          "Kas Aktual (Rp)",
          "Selisih (Rp)",
          "Status",
        ],
        rows,
        columnFormats: [
          "text",
          "text",
          "text",
          "currency",
          "currency",
          "currency",
          "currency",
          "text",
        ],
        totalRow: ["TOTAL", "", `${shifts.length} Shift`, totalStart, totalExp, totalAct, totalDiff, ""],
      },
    ],
  });
};
