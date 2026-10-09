import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SalesTransaction,
  Ingredient,
  StockMovement,
  CashTransaction,
  Settings,
  PayrollRecord,
  DailyAttendance,
  KPIRecord,
  Employee,
} from "../types";
import { formatCurrency } from "./format";

export const formatDateIndo = (dateStr: string | Date): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const exportToCSV = (filename: string, rows: any[]) => {
  if (!rows || !rows.length) return;
  const separator = ",";
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    "\n" +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? "" : row[k];
            cell =
              cell instanceof Date
                ? cell.toLocaleString("id-ID")
                : cell.toString().replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator);
      })
      .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const downloadCsvTemplate = (filename: string, headers: string[], exampleRow?: string[]) => {
  const separator = ",";
  let csvContent = headers.map(h => `"${h}"`).join(separator);
  
  if (exampleRow && exampleRow.length > 0) {
    csvContent += "\n" + exampleRow.map(cell => `"${cell}"`).join(separator);
  }

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const filterByDateRange = <
  T extends { date?: string; importDate?: string; timestamp?: string },
>(
  items: T[],
  startDate?: string,
  endDate?: string,
): T[] => {
  if (!startDate && !endDate) return items;
  return items.filter((item) => {
    const dStr = item.date || item.importDate || item.timestamp;
    if (!dStr) return true;
    const itemTime = new Date(dStr).getTime();
    if (isNaN(itemTime)) return true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (itemTime < start.getTime()) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (itemTime > end.getTime()) return false;
    }
    return true;
  });
};

const setupPdfHeader = (
  doc: jsPDF,
  settings: Settings,
  title: string,
  periodLabel: string,
) => {
  // Brand Header Background
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(0, 0, 210, 40, "F");

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(settings.brandName || "JULIA'S MANAGEMENT SYSTEM", 14, 20);

  // Address
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 212, 233);
  if (settings.companyAddress) {
    const addrLines = doc.splitTextToSize(settings.companyAddress, 100);
    doc.text(addrLines, 14, 28);
  }

  // Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 210 - 14, 20, { align: "right" });

  // Report Meta
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 212, 233);
  doc.text(`Periode: ${periodLabel}`, 210 - 14, 28, { align: "right" });
  doc.text(`Dicetak: ${formatDateIndo(new Date())}`, 210 - 14, 34, {
    align: "right",
  });

  // Reset text color for body
  doc.setTextColor(15, 23, 42); // slate-900
};

export const exportSalesToPDF = ({
  sales,
  settings,
  periodLabel,
}: {
  sales: SalesTransaction[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, "Laporan Penjualan", periodLabel);

  const tableData =
    sales.length > 0
      ? sales.map((s) => [
          formatDateIndo(s.date),
          s.menuName,
          s.quantitySold.toString(),
          formatCurrency(s.totalPrice),
        ])
      : [["-", "Tidak ada data transaksi di periode ini", "-", "-"]];

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Nama Menu", "Quantity", "Total (Rp)"]],
    body: tableData,
    foot:
      sales.length > 0
        ? [
            [
              "",
              "TOTAL",
              sales.reduce((a, b) => a + b.quantitySold, 0).toString(),
              formatCurrency(sales.reduce((a, b) => a + b.totalPrice, 0)),
            ],
          ]
        : [],
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
    },
  });
  doc.save(`Laporan_Penjualan_${periodLabel}.pdf`);
};

export const exportInventoryToPDF = ({
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
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, "Laporan Mutasi Stok", periodLabel);

  const tableData =
    movements.length > 0
      ? movements.map((m) => {
          const ing = ingredients.find((i) => i.id === m.ingredientId);
          return [
            formatDateIndo(m.date),
            ing?.name || "-",
            m.type === "IN" ? "Masuk" : "Keluar",
            `${m.quantity} ${ing?.unit || ""}`,
            m.createdBy,
          ];
        })
      : [["-", "Tidak ada mutasi stok di periode ini", "-", "-", "-"]];

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Bahan Baku", "Jenis", "Jumlah", "Operator"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        if (data.cell.raw === "Masuk") {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fontStyle = "bold";
        } else if (data.cell.raw === "Keluar") {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  doc.save(`Laporan_Stok_${periodLabel}.pdf`);
};

export const exportFinanceToPDF = ({
  finance,
  settings,
  periodLabel,
}: {
  finance: CashTransaction[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, "Laporan Arus Kas", periodLabel);

  const tableData =
    finance.length > 0
      ? finance.map((f) => [
          formatDateIndo(f.date),
          f.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
          f.category,
          f.description,
          (f.type === "CASH_IN" ? "+" : "-") + formatCurrency(f.amount),
        ])
      : [["-", "-", "Tidak ada data arus kas di periode ini", "-", "-"]];

  const totalIn = finance
    .filter((f) => f.type === "CASH_IN")
    .reduce((a, b) => a + b.amount, 0);
  const totalOut = finance
    .filter((f) => f.type === "CASH_OUT")
    .reduce((a, b) => a + b.amount, 0);
  const netCash = totalIn - totalOut;

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Jenis", "Kategori", "Keterangan", "Jumlah (Rp)"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: {
      4: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        if (data.row.raw[1] === "Pemasukan") {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (data.row.raw[1] === "Pengeluaran") {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 50;

  // Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY + 10, 182, 35, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("RINGKASAN KEUANGAN", 20, finalY + 18);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Total Pemasukan:", 20, finalY + 26);
  doc.setTextColor(5, 150, 105);
  doc.text(formatCurrency(totalIn), 70, finalY + 26, { align: "right" });

  doc.setTextColor(71, 85, 105);
  doc.text("Total Pengeluaran:", 100, finalY + 26);
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrency(totalOut), 155, finalY + 26, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(20, finalY + 31, 190, finalY + 31);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Arus Kas Bersih:", 20, finalY + 38);

  doc.setFontSize(14);
  doc.setTextColor(
    netCash >= 0 ? 5 : 225,
    netCash >= 0 ? 150 : 29,
    netCash >= 0 ? 105 : 72,
  );
  doc.text(formatCurrency(netCash), 190, finalY + 38, { align: "right" });

  doc.save(`Laporan_Keuangan_${periodLabel}.pdf`);
};

export const exportSalesToCSV = ({
  sales,
  settings,
}: {
  sales: SalesTransaction[];
  settings: Settings;
}) => {
  const rows = sales.map((s) => ({
    Tanggal: formatDateIndo(s.date),
    "Nama Menu": s.menuName,
    Quantity: s.quantitySold,
    "Total Penjualan": s.totalPrice,
  }));
  exportToCSV(`Penjualan_${formatDateIndo(new Date())}`, rows);
};

export const exportInventoryToCSV = ({
  ingredients,
  movements,
  settings,
}: {
  ingredients: Ingredient[];
  movements: StockMovement[];
  settings: Settings;
}) => {
  const rows = movements.map((m) => {
    const ing = ingredients.find((i) => i.id === m.ingredientId);
    return {
      Tanggal: formatDateIndo(m.date),
      "Bahan Baku": ing?.name || "-",
      Kategori: ing?.category || "-",
      "Jenis Mutasi": m.type === "IN" ? "Masuk" : "Keluar",
      Jumlah: m.quantity,
      Satuan: ing?.unit || "-",
      Catatan: m.note || "-",
      Operator: m.createdBy,
    };
  });
  exportToCSV(`Mutasi_Stok_${formatDateIndo(new Date())}`, rows);
};

export const exportFinanceToCSV = ({
  finance,
  settings,
}: {
  finance: CashTransaction[];
  settings: Settings;
}) => {
  const rows = finance.map((f) => ({
    Tanggal: formatDateIndo(f.date),
    "Jenis Transaksi": f.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
    Kategori: f.category,
    Keterangan: f.description,
    "Jumlah (Rp)": f.amount,
  }));
  exportToCSV(`Arus_Kas_${formatDateIndo(new Date())}`, rows);
};

export const exportPayrollToPDF = ({
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
  const doc = new jsPDF("l", "mm", "a4");
  setupPdfHeader(doc, settings, "Laporan Rekapitulasi Penggajian & Bonus", periodLabel);

  const tableData =
    payroll.length > 0
      ? payroll.map((p, idx) => {
          const emp = employees.find((e) => e.id === p.employeeId);
          return [
            String(idx + 1),
            emp?.name || p.employeeId,
            emp?.position || "-",
            emp?.department || "-",
            formatCurrency(p.basicSalary),
            formatCurrency(p.positionAllowance),
            formatCurrency((p.mealAllowance || 0) + (p.transportAllowance || 0)),
            formatCurrency(p.kpiBonus + (p.targetBonus || 0)),
            formatCurrency(p.alphaDeduction),
            formatCurrency(p.netPay),
            p.status,
          ];
        })
      : [["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "Tidak ada data penggajian"]];

  const totalBasic = payroll.reduce((s, p) => s + p.basicSalary, 0);
  const totalKpiBonus = payroll.reduce((s, p) => s + p.kpiBonus + (p.targetBonus || 0), 0);
  const totalDeductions = payroll.reduce((s, p) => s + p.alphaDeduction + (p.otherDeductions || 0), 0);
  const totalNet = payroll.reduce((s, p) => s + p.netPay, 0);

  autoTable(doc, {
    startY: 50,
    head: [
      [
        "No",
        "Nama Karyawan",
        "Jabatan",
        "Divisi",
        "Gaji Pokok",
        "Tunj. Jabatan",
        "Makan & Trp",
        "Bonus KPI",
        "Potongan",
        "Total THP",
        "Status",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold", textColor: [5, 150, 105] },
      8: { halign: "right", textColor: [225, 29, 72] },
      9: { halign: "right", fontStyle: "bold", textColor: [30, 58, 138] },
      10: { halign: "center" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  if (finalY < 165) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY + 8, 269, 22, 3, 3, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("TOTAL BEBAN PENGGAJIAN & BONUS OUTLET:", 20, finalY + 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Gaji Pokok: ${formatCurrency(totalBasic)}`, 20, finalY + 23);
    doc.text(`Bonus KPI: ${formatCurrency(totalKpiBonus)}`, 95, finalY + 23);
    doc.text(`Potongan: -${formatCurrency(totalDeductions)}`, 165, finalY + 23);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(`Take Home Pay (THP): ${formatCurrency(totalNet)}`, 225, finalY + 23);
  }

  doc.save(`Laporan_Penggajian_${periodLabel.replace(/\s+/g, "_")}.pdf`);
};

export const exportPayrollToCSV = ({
  payroll,
  employees,
}: {
  payroll: PayrollRecord[];
  employees: Employee[];
}) => {
  const rows = payroll.map((p, idx) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || p.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: p.period,
      "Gaji Pokok": p.basicSalary,
      "Tunjangan Jabatan": p.positionAllowance,
      "Uang Makan": p.mealAllowance,
      "Uang Transport": p.transportAllowance || 0,
      "Bonus KPI": p.kpiBonus,
      "Bonus Target Omzet": p.targetBonus || 0,
      "Lembur / Insentif": p.overtimePay || 0,
      "Potongan Alpha": p.alphaDeduction,
      "Potongan Lain": p.otherDeductions || 0,
      "Take Home Pay (THP)": p.netPay,
      Status: p.status,
      "Tanggal Dibayar": p.paidDate || "-",
    };
  });
  exportToCSV(`Rekap_Payroll_${formatDateIndo(new Date())}`, rows);
};

export const exportAttendanceToPDF = ({
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
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, "Laporan Rekapitulasi Absensi & Jam Kerja", periodLabel);

  const empMap = new Map<string, { present: number; late: number; sick: number; alpha: number; totalHours: number }>();
  attendances.forEach((att) => {
    const prev = empMap.get(att.employeeId) || { present: 0, late: 0, sick: 0, alpha: 0, totalHours: 0 };
    if (att.status === "HADIR") prev.present++;
    else if (att.status === "TERLAMBAT") {
      prev.present++;
      prev.late++;
    } else if (["IZIN", "SAKIT"].includes(att.status)) prev.sick++;
    else if (["ALPHA", "DITOLAK"].includes(att.status)) prev.alpha++;

    if (att.clockInTime && att.clockOutTime) {
      const dur = (new Date(att.clockOutTime).getTime() - new Date(att.clockInTime).getTime()) / 3600000;
      if (dur > 0 && dur < 24) prev.totalHours += dur;
    }
    empMap.set(att.employeeId, prev);
  });

  const tableData = Array.from(empMap.entries()).map(([empId, stats], idx) => {
    const emp = employees.find((e) => e.id === empId);
    const totalDays = stats.present + stats.sick + stats.alpha;
    const rate = totalDays > 0 ? Math.round((stats.present / totalDays) * 100) : 0;
    return [
      String(idx + 1),
      emp?.name || empId,
      emp?.position || "-",
      `${stats.present} Hari`,
      `${stats.late}x`,
      `${stats.sick} Hari`,
      `${stats.alpha} Hari`,
      `${stats.totalHours.toFixed(1)} Jam`,
      `${rate}%`,
    ];
  });

  autoTable(doc, {
    startY: 50,
    head: [["No", "Nama Karyawan", "Jabatan", "Hadir", "Terlambat", "Izin/Sakit", "Alpha", "Total Jam", "% Hadir"]],
    body: tableData.length > 0 ? tableData : [["-", "-", "-", "-", "-", "-", "-", "-", "Tidak ada log absensi"]],
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center" },
      3: { halign: "center", fontStyle: "bold", textColor: [5, 150, 105] },
      4: { halign: "center", textColor: [217, 119, 6] },
      5: { halign: "center" },
      6: { halign: "center", textColor: [225, 29, 72] },
      7: { halign: "right" },
      8: { halign: "center", fontStyle: "bold" },
    },
  });

  doc.save(`Laporan_Absensi_${periodLabel.replace(/\s+/g, "_")}.pdf`);
};

export const exportAttendanceToCSV = ({
  attendances,
  employees,
}: {
  attendances: DailyAttendance[];
  employees: Employee[];
}) => {
  const rows = attendances.map((a, idx) => {
    const emp = employees.find((e) => e.id === a.employeeId);
    return {
      No: idx + 1,
      Tanggal: a.date,
      "Nama Karyawan": emp?.name || a.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Status: a.status,
      "Jam Masuk": a.clockInTime ? new Date(a.clockInTime).toLocaleTimeString("id-ID") : "-",
      "Jam Pulang": a.clockOutTime ? new Date(a.clockOutTime).toLocaleTimeString("id-ID") : "-",
      "Status Verifikasi": a.approvalStatus,
    };
  });
  exportToCSV(`Rekap_Absensi_${formatDateIndo(new Date())}`, rows);
};

export const exportKpiToPDF = ({
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
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, "Laporan Capaian KPI & Kinerja Karyawan", periodLabel);

  const tableData =
    kpiRecords.length > 0
      ? kpiRecords.map((k, idx) => {
          const emp = employees.find((e) => e.id === k.employeeId);
          const grade =
            k.totalScore >= 85 ? "Sangat Baik (A)" : k.totalScore >= 70 ? "Baik (B)" : k.totalScore >= 55 ? "Cukup (C)" : "Perlu Evaluasi (D)";
          return [
            String(idx + 1),
            emp?.name || k.employeeId,
            emp?.position || "-",
            k.period || `Bulan ${k.month}/${k.year}`,
            `${k.totalScore.toFixed(1)} / 100`,
            grade,
            formatCurrency(k.kpiBonus),
            k.notes || "-",
          ];
        })
      : [["-", "-", "-", "-", "-", "-", "-", "Belum ada evaluasi KPI tercatat"]];

  autoTable(doc, {
    startY: 50,
    head: [["No", "Nama Karyawan", "Jabatan", "Periode", "Skor KPI", "Grade", "Bonus KPI", "Catatan Evaluasi"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center" },
      4: { halign: "center", fontStyle: "bold", textColor: [30, 58, 138] },
      5: { halign: "center", fontStyle: "bold" },
      6: { halign: "right", fontStyle: "bold", textColor: [5, 150, 105] },
    },
  });

  doc.save(`Laporan_KPI_${periodLabel.replace(/\s+/g, "_")}.pdf`);
};

export const exportKpiToCSV = ({
  kpiRecords,
  employees,
}: {
  kpiRecords: KPIRecord[];
  employees: Employee[];
}) => {
  const rows = kpiRecords.map((k, idx) => {
    const emp = employees.find((e) => e.id === k.employeeId);
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || k.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: k.period || `${k.year}-${String(k.month).padStart(2, "0")}`,
      "Total Skor (0-100)": k.totalScore,
      "Bonus KPI (Rp)": k.kpiBonus,
      "Catatan Evaluator": k.notes || "-",
    };
  });
  exportToCSV(`Rekap_KPI_${formatDateIndo(new Date())}`, rows);
};

