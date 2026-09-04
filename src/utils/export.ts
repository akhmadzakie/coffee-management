import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalesTransaction, Ingredient, StockMovement, CashTransaction, Settings } from '../types';
import { formatCurrency } from './format';

export const formatDateIndo = (dateStr: string | Date): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const exportToCSV = (filename: string, rows: any[]) => {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent = keys.join(separator) + '\n' + rows.map(row => {
    return keys.map(k => {
      let cell = row[k] === null || row[k] === undefined ? '' : row[k];
      cell = cell instanceof Date ? cell.toLocaleString('id-ID') : cell.toString().replace(/"/g, '""');
      if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
      return cell;
    }).join(separator);
  }).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const filterByDateRange = <T extends { date?: string, importDate?: string, timestamp?: string }>(
  items: T[], startDate?: string, endDate?: string
): T[] => {
  if (!startDate && !endDate) return items;
  return items.filter(item => {
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

const setupPdfHeader = (doc: jsPDF, settings: Settings, title: string, periodLabel: string) => {
  // Brand Header Background
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(0, 0, 210, 40, 'F');
  
  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.brandName || 'KEDAI KOPI', 14, 20);
  
  // Address
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 212, 233);
  if (settings.companyAddress) {
    const addrLines = doc.splitTextToSize(settings.companyAddress, 100);
    doc.text(addrLines, 14, 28);
  }
  
  // Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 210 - 14, 20, { align: 'right' });
  
  // Report Meta
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 212, 233);
  doc.text(`Periode: ${periodLabel}`, 210 - 14, 28, { align: 'right' });
  doc.text(`Dicetak: ${formatDateIndo(new Date())}`, 210 - 14, 34, { align: 'right' });
  
  // Reset text color for body
  doc.setTextColor(15, 23, 42); // slate-900
};

export const exportSalesToPDF = ({ sales, settings, periodLabel }: { sales: SalesTransaction[], settings: Settings, periodLabel: string }) => {
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, 'Laporan Penjualan', periodLabel);
  
  const tableData = sales.length > 0 ? sales.map(s => [
    formatDateIndo(s.date),
    s.menuName,
    s.quantitySold.toString(),
    formatCurrency(s.totalPrice)
  ]) : [['-', 'Tidak ada data transaksi di periode ini', '-', '-']];

  autoTable(doc, {
    startY: 50,
    head: [['Tanggal', 'Nama Menu', 'Quantity', 'Total (Rp)']],
    body: tableData,
    foot: sales.length > 0 ? [['', 'TOTAL', sales.reduce((a, b) => a + b.quantitySold, 0).toString(), formatCurrency(sales.reduce((a, b) => a + b.totalPrice, 0))]] : [],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.1 },
    footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.1 },
    bodyStyles: { textColor: [71, 85, 105], lineColor: [226, 232, 240], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: { 
      2: { halign: 'center' }, 
      3: { halign: 'right' } 
    }
  });
  doc.save(`Laporan_Penjualan_${periodLabel}.pdf`);
};

export const exportInventoryToPDF = ({ ingredients, movements, settings, periodLabel }: { ingredients: Ingredient[], movements: StockMovement[], settings: Settings, periodLabel: string }) => {
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, 'Laporan Mutasi Stok', periodLabel);
  
  const tableData = movements.length > 0 ? movements.map(m => {
    const ing = ingredients.find(i => i.id === m.ingredientId);
    return [
      formatDateIndo(m.date),
      ing?.name || '-',
      m.type === 'IN' ? 'Masuk' : 'Keluar',
      `${m.quantity} ${ing?.unit || ''}`,
      m.createdBy
    ];
  }) : [['-', 'Tidak ada mutasi stok di periode ini', '-', '-', '-']];

  autoTable(doc, {
    startY: 50,
    head: [['Tanggal', 'Bahan Baku', 'Jenis', 'Jumlah', 'Operator']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.1 },
    bodyStyles: { textColor: [71, 85, 105], lineColor: [226, 232, 240], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: { 
      2: { halign: 'center' }, 
      3: { halign: 'right' } 
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        if (data.cell.raw === 'Masuk') {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'Keluar') {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });
  doc.save(`Laporan_Stok_${periodLabel}.pdf`);
};

export const exportFinanceToPDF = ({ finance, settings, periodLabel }: { finance: CashTransaction[], settings: Settings, periodLabel: string }) => {
  const doc = new jsPDF();
  setupPdfHeader(doc, settings, 'Laporan Arus Kas', periodLabel);
  
  const tableData = finance.length > 0 ? finance.map(f => [
    formatDateIndo(f.date),
    f.type === 'CASH_IN' ? 'Pemasukan' : 'Pengeluaran',
    f.category,
    f.description,
    (f.type === 'CASH_IN' ? '+' : '-') + formatCurrency(f.amount)
  ]) : [['-', '-', 'Tidak ada data arus kas di periode ini', '-', '-']];
  
  const totalIn = finance.filter(f => f.type === 'CASH_IN').reduce((a, b) => a + b.amount, 0);
  const totalOut = finance.filter(f => f.type === 'CASH_OUT').reduce((a, b) => a + b.amount, 0);
  const netCash = totalIn - totalOut;

  autoTable(doc, {
    startY: 50,
    head: [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah (Rp)']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.1 },
    bodyStyles: { textColor: [71, 85, 105], lineColor: [226, 232, 240], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: { 
      4: { halign: 'right', fontStyle: 'bold' } 
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.row.raw[1] === 'Pemasukan') {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (data.row.raw[1] === 'Pengeluaran') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 50;
  
  // Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY + 10, 182, 35, 3, 3, 'FD');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('RINGKASAN KEUANGAN', 20, finalY + 18);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Pemasukan:', 20, finalY + 26);
  doc.setTextColor(5, 150, 105);
  doc.text(formatCurrency(totalIn), 70, finalY + 26, { align: 'right' });
  
  doc.setTextColor(71, 85, 105);
  doc.text('Total Pengeluaran:', 100, finalY + 26);
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrency(totalOut), 155, finalY + 26, { align: 'right' });
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, finalY + 31, 190, finalY + 31);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Arus Kas Bersih:', 20, finalY + 38);
  
  doc.setFontSize(14);
  doc.setTextColor(netCash >= 0 ? 5 : 225, netCash >= 0 ? 150 : 29, netCash >= 0 ? 105 : 72);
  doc.text(formatCurrency(netCash), 190, finalY + 38, { align: 'right' });

  doc.save(`Laporan_Keuangan_${periodLabel}.pdf`);
};

export const exportSalesToCSV = ({ sales, settings }: { sales: SalesTransaction[], settings: Settings }) => {
  const rows = sales.map(s => ({
    'Tanggal': formatDateIndo(s.date),
    'Nama Menu': s.menuName,
    'Quantity': s.quantitySold,
    'Total Penjualan': s.totalPrice
  }));
  exportToCSV(`Penjualan_${formatDateIndo(new Date())}`, rows);
};

export const exportInventoryToCSV = ({ ingredients, movements, settings }: { ingredients: Ingredient[], movements: StockMovement[], settings: Settings }) => {
  const rows = movements.map(m => {
    const ing = ingredients.find(i => i.id === m.ingredientId);
    return {
      'Tanggal': formatDateIndo(m.date),
      'Bahan Baku': ing?.name || '-',
      'Kategori': ing?.category || '-',
      'Jenis Mutasi': m.type === 'IN' ? 'Masuk' : 'Keluar',
      'Jumlah': m.quantity,
      'Satuan': ing?.unit || '-',
      'Catatan': m.note || '-',
      'Operator': m.createdBy
    };
  });
  exportToCSV(`Mutasi_Stok_${formatDateIndo(new Date())}`, rows);
};

export const exportFinanceToCSV = ({ finance, settings }: { finance: CashTransaction[], settings: Settings }) => {
  const rows = finance.map(f => ({
    'Tanggal': formatDateIndo(f.date),
    'Jenis Transaksi': f.type === 'CASH_IN' ? 'Pemasukan' : 'Pengeluaran',
    'Kategori': f.category,
    'Keterangan': f.description,
    'Jumlah (Rp)': f.amount
  }));
  exportToCSV(`Arus_Kas_${formatDateIndo(new Date())}`, rows);
};
