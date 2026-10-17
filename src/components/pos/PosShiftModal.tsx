import React, { useState, useMemo } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import { ShiftSession } from "../../types";
import {
  Clock,
  DollarSign,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Printer,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Calculator,
  User,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PosShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: ShiftSession | null;
  onShiftChanged?: () => void;
}

export const PosShiftModal: React.FC<PosShiftModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  onShiftChanged,
}) => {
  const {
    currentUser,
    cashAccounts,
    openShift,
    closeShift,
    salesTransactions,
    cashTransactions,
    settings,
  } = useStore();

  const [startingCashInput, setStartingCashInput] = useState<string>("200000");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [actualCashInput, setActualCashInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState<any | null>(null);

  const cashOnlyAccounts = useMemo(() => {
    return cashAccounts.filter((a) => a.type === "CASH");
  }, [cashAccounts]);

  // Set default account jika belum dipilih
  React.useEffect(() => {
    if (cashOnlyAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(cashOnlyAccounts[0].id);
    }
  }, [cashOnlyAccounts, selectedAccountId]);

  // Hitung transaksi selama shift aktif
  const shiftStats = useMemo(() => {
    if (!activeShift) {
      return {
        salesTotal: 0,
        cashSales: 0,
        qrisSales: 0,
        edcSales: 0,
        transactionCount: 0,
        cashIn: 0,
        cashOut: 0,
        expectedEndingCash: 0,
      };
    }

    const startTime = new Date(activeShift.startTime).getTime();

    // Penjualan POS / salesTransactions sejak shift dimulai
    const txList = salesTransactions.filter(
      (t) => new Date(t.date).getTime() >= startTime
    );

    let cashSales = 0;
    let qrisSales = 0;
    let edcSales = 0;
    let salesTotal = 0;

    txList.forEach((t) => {
      salesTotal += t.totalPrice;
      const method = (t.paymentMethod || "CASH").toUpperCase();
      if (method === "CASH") cashSales += t.totalPrice;
      else if (method.includes("QRIS")) qrisSales += t.totalPrice;
      else edcSales += t.totalPrice;
    });

    // Mutasi Kas Masuk / Keluar manual ke laci kasir
    const recentCashMovements = cashTransactions.filter(
      (t) =>
        new Date(t.date).getTime() >= startTime &&
        t.accountId === activeShift.cashAccountId
    );

    const cashIn = recentCashMovements
      .filter((t) => t.type === "CASH_IN")
      .reduce((s, t) => s + t.amount, 0);

    const cashOut = recentCashMovements
      .filter((t) => t.type === "CASH_OUT")
      .reduce((s, t) => s + t.amount, 0);

    const expectedEndingCash =
      activeShift.startingCash + cashSales + cashIn - cashOut;

    return {
      salesTotal,
      cashSales,
      qrisSales,
      edcSales,
      transactionCount: txList.length,
      cashIn,
      cashOut,
      expectedEndingCash,
    };
  }, [activeShift, salesTransactions, cashTransactions]);

  const parsedActualCash = useMemo(() => {
    return Number(actualCashInput.replace(/\D/g, "")) || 0;
  }, [actualCashInput]);

  const difference = useMemo(() => {
    return parsedActualCash - shiftStats.expectedEndingCash;
  }, [parsedActualCash, shiftStats.expectedEndingCash]);

  // Aksi Buka Shift
  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(startingCashInput.replace(/\D/g, ""));
    const accountId = selectedAccountId || cashOnlyAccounts[0]?.id || "default";

    openShift({
      userId: currentUser?.id || "unknown",
      cashAccountId: accountId,
      startTime: new Date().toISOString(),
      endTime: null,
      startingCash: amount,
      expectedEndingCash: null,
      actualEndingCash: null,
      difference: null,
      status: "OPEN",
    });

    onShiftChanged?.();
    onClose();
  };

  // Aksi Tutup Shift
  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    closeShift(
      activeShift.id,
      parsedActualCash,
      shiftStats.expectedEndingCash
    );

    // Siapkan data untuk Z-Report slip
    const zData = {
      shiftId: activeShift.id,
      cashierName: currentUser?.name || "Kasir",
      startTime: activeShift.startTime,
      endTime: new Date().toISOString(),
      startingCash: activeShift.startingCash,
      ...shiftStats,
      actualEndingCash: parsedActualCash,
      difference,
      notes,
    };

    setClosedShiftData(zData);
    setIsZReportOpen(true);
    onShiftChanged?.();
  };

  const handlePrintZReport = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      {/* ── Modal Z-Report Print Slip ─────────────────────────────────── */}
      {isZReportOpen && closedShiftData && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Shift Berhasil Ditutup (Z-Report)</span>
              </div>
              <button
                onClick={() => {
                  setIsZReportOpen(false);
                  onClose();
                }}
                className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Slip Preview untuk Printer Thermal */}
            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-100">
              <div
                id="thermal-z-report"
                className="w-full max-w-[320px] bg-white text-black p-4 rounded-xl font-mono text-[11px] leading-tight shadow-md border border-slate-200"
              >
                <div className="text-center pb-2 border-b border-dashed border-gray-400 mb-2">
                  <h3 className="font-bold text-sm uppercase">
                    {settings?.name || "COFFEE SHOP"}
                  </h3>
                  <p className="text-[10px] text-gray-600">
                    LAPORAN PENUTUPAN SHIFT (Z-REPORT)
                  </p>
                  <p className="text-[9px] text-gray-500">
                    {new Date().toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="space-y-1 pb-2 border-b border-dashed border-gray-400 text-[10px]">
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="font-bold">{closedShiftData.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mulai Shift:</span>
                    <span>
                      {new Date(closedShiftData.startTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Selesai:</span>
                    <span>
                      {new Date(closedShiftData.endTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Struk:</span>
                    <span>{closedShiftData.transactionCount} Transaksi</span>
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                  <p className="font-bold text-[10px] uppercase text-gray-700">
                    Ringkasan Pendapatan POS
                  </p>
                  <div className="flex justify-between">
                    <span>Tunai (Cash):</span>
                    <span>{formatCurrency(closedShiftData.cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>QRIS Bank:</span>
                    <span>{formatCurrency(closedShiftData.qrisSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>EDC / Kartu:</span>
                    <span>{formatCurrency(closedShiftData.edcSales)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-gray-200">
                    <span>TOTAL OMZET:</span>
                    <span>{formatCurrency(closedShiftData.salesTotal)}</span>
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                  <p className="font-bold text-[10px] uppercase text-gray-700">
                    Rekonsiliasi Laci Kasir (Cash)
                  </p>
                  <div className="flex justify-between">
                    <span>Modal Awal (Float):</span>
                    <span>{formatCurrency(closedShiftData.startingCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Penjualan Tunai:</span>
                    <span>{formatCurrency(closedShiftData.cashSales)}</span>
                  </div>
                  {closedShiftData.cashIn > 0 && (
                    <div className="flex justify-between">
                      <span>+ Kas Masuk Laci:</span>
                      <span>{formatCurrency(closedShiftData.cashIn)}</span>
                    </div>
                  )}
                  {closedShiftData.cashOut > 0 && (
                    <div className="flex justify-between">
                      <span>- Kas Keluar Laci:</span>
                      <span>({formatCurrency(closedShiftData.cashOut)})</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200">
                    <span>Estimasi Kas Laci:</span>
                    <span>{formatCurrency(closedShiftData.expectedEndingCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Uang Fisik Dihitung:</span>
                    <span>{formatCurrency(closedShiftData.actualEndingCash)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-bold text-[11px] pt-1 border-t ${
                      closedShiftData.difference === 0
                        ? "text-emerald-700"
                        : closedShiftData.difference > 0
                        ? "text-blue-700"
                        : "text-rose-700"
                    }`}
                  >
                    <span>SELISIH:</span>
                    <span>
                      {closedShiftData.difference === 0
                        ? "Rp 0 (PAS)"
                        : (closedShiftData.difference > 0 ? "+" : "") +
                          formatCurrency(closedShiftData.difference)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 text-center text-[9px] text-gray-500">
                  <div className="flex justify-between pt-6 px-2 text-center">
                    <div>
                      <p>Kasir,</p>
                      <br />
                      <p className="font-bold">({closedShiftData.cashierName})</p>
                    </div>
                    <div>
                      <p>Supervisor / SPV,</p>
                      <br />
                      <p className="font-bold">(...............)</p>
                    </div>
                  </div>
                  <p className="mt-4 italic">Simpan slip ini bersama setoran fisik.</p>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={handlePrintZReport}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Slip Z-Report</span>
              </button>
              <button
                onClick={() => {
                  setIsZReportOpen(false);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog Utama: Buka atau Tutup Shift ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-xl ${
                activeShift
                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              {activeShift ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {activeShift ? "Tutup Shift Kasir (Z-Report)" : "Buka Shift Kasir Baru"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Kasir: <span className="text-brand-700 font-bold">{currentUser?.name || "Kasir"}</span> • Peran: {currentUser?.role || "Staff"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[75vh]">
          {!activeShift ? (
            /* FORM BUKA SHIFT */
            <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <p>
                  Shift kasir belum aktif. Masukkan uang modal awal (float) untuk uang kembalian sebelum memulai transaksi kasir.
                </p>
              </div>

              {/* Pilihan Akun Kas Laci */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Laci Kasir / Akun Kas
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
                >
                  {cashOnlyAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(acc.balance)})
                    </option>
                  ))}
                  {cashOnlyAccounts.length === 0 && (
                    <option value="default">Kas Laci Utama (Default)</option>
                  )}
                </select>
              </div>

              {/* Input Modal Awal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Modal Awal Kasir (Starting Cash)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      startingCashInput
                        ? Number(startingCashInput.replace(/\D/g, "")).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setStartingCashInput(e.target.value)}
                    placeholder="200.000"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
                    required
                  />
                </div>

                {/* Quick nominal buttons */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[100000, 200000, 300000, 500000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => setStartingCashInput(nom.toString())}
                      className="py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-brand-50 hover:border-brand-300 text-[11px] font-bold text-slate-700 border border-slate-200 transition"
                    >
                      {formatCurrency(nom)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Buka Laci & Mulai Shift Kasir</span>
                </button>
              </div>
            </form>
          ) : (
            /* FORM TUTUP SHIFT & REKONSILIASI KAS */
            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              {/* Info Shift Berjalan */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-1 font-semibold">
                    <Clock className="w-3 h-3 text-brand-600" />
                    Waktu Mulai Shift
                  </p>
                  <p className="font-bold text-slate-800">
                    {new Date(activeShift.startTime).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-1 font-semibold">
                    <Banknote className="w-3 h-3 text-emerald-600" />
                    Modal Awal (Float)
                  </p>
                  <p className="font-bold text-emerald-700">
                    {formatCurrency(activeShift.startingCash)}
                  </p>
                </div>
              </div>

              {/* Rincian Penjualan POS */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-200">
                  <span>Rincian Pembayaran POS ({shiftStats.transactionCount} Order)</span>
                  <span className="text-brand-700 font-extrabold">
                    {formatCurrency(shiftStats.salesTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-emerald-600" /> Penjualan Tunai:
                  </span>
                  <span className="text-emerald-700 font-bold">
                    {formatCurrency(shiftStats.cashSales)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-violet-600" /> QRIS Bank:
                  </span>
                  <span className="font-semibold text-slate-800">{formatCurrency(shiftStats.qrisSales)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-sky-600" /> EDC / Kartu:
                  </span>
                  <span className="font-semibold text-slate-800">{formatCurrency(shiftStats.edcSales)}</span>
                </div>
              </div>

              {/* Kalkulasi Kas yang Seharusnya Ada di Laci */}
              <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-700">
                  <span>Modal Awal:</span>
                  <span className="font-semibold">{formatCurrency(activeShift.startingCash)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>+ Penjualan Tunai:</span>
                  <span className="font-semibold">{formatCurrency(shiftStats.cashSales)}</span>
                </div>
                {shiftStats.cashIn > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>+ Kas Masuk Manual:</span>
                    <span className="font-semibold">{formatCurrency(shiftStats.cashIn)}</span>
                  </div>
                )}
                {shiftStats.cashOut > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>- Kas Keluar Manual:</span>
                    <span className="font-semibold">({formatCurrency(shiftStats.cashOut)})</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-brand-800 pt-2 border-t border-brand-200 text-sm">
                  <span>Harus Ada di Laci (Expected):</span>
                  <span>{formatCurrency(shiftStats.expectedEndingCash)}</span>
                </div>
              </div>

              {/* Input Uang Fisik Dihitung Kasir */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Uang Fisik Dihitung Kasir (Actual Cash)</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Hitung lembaran fisik di laci
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      actualCashInput
                        ? Number(actualCashInput.replace(/\D/g, "")).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setActualCashInput(e.target.value)}
                    placeholder="Contoh: 1.250.000"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
                    required
                  />
                </div>

                {/* Selisih Indicator */}
                {actualCashInput && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      difference === 0
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : difference > 0
                        ? "bg-blue-50 border-blue-300 text-blue-800"
                        : "bg-rose-50 border-rose-300 text-rose-800"
                    }`}
                  >
                    <span>
                      {difference === 0
                        ? "Status: Uang Kas Pas (Seimbang)"
                        : difference > 0
                        ? "Status: Lebih Kas (Surplus)"
                        : "Status: Kurang Kas (Defisit)"}
                    </span>
                    <span>
                      {difference === 0
                        ? "Rp 0"
                        : (difference > 0 ? "+" : "") + formatCurrency(difference)}
                    </span>
                  </div>
                )}
              </div>

              {/* Catatan Kasir */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Rekonsiliasi (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keterangan bila ada selisih uang atau penyerahan laci..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!actualCashInput}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 transition"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Tutup Shift & Buat Laporan Z-Report</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
