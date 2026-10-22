import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { BankReconciliation } from "../types";
import {
  Landmark,
  Building2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Calendar,
  FileSpreadsheet,
  Check,
  AlertCircle,
  CreditCard,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "motion/react";
import { formatCurrency } from "../utils/format";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomSelect } from "./common/CustomSelect";

const generateId = () => {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

const formatDate = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
};

export const BankReconciliationComponent: React.FC = () => {
  const {
    cashAccounts,
    cashTransactions,
    bankReconciliations,
    bankStatementLines,
    addBankReconciliation,
    addBankStatementLine,
    updateBankReconciliation,
    currentUser,
  } = useStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadedLines, setUploadedLines] = useState<any[]>([]);

  const selectedAccount = cashAccounts.find((a) => a.id === selectedAccountId);

  // Retrieve existing reconciliation for selected account and period
  const existingReconciliation = useMemo(() => {
    return bankReconciliations.find(
      (r) => r.accountNumber === selectedAccountId && r.period === period
    );
  }, [bankReconciliations, selectedAccountId, period]);

  const existingLines = useMemo(() => {
    if (!existingReconciliation) return [];
    return bankStatementLines.filter((l) => l.reconciliationId === existingReconciliation.id);
  }, [bankStatementLines, existingReconciliation]);

  // Metrik ringkasan rekonsiliasi
  const reconMetrics = useMemo(() => {
    const totalLines = existingLines.length;
    const matchedCount = existingLines.filter((l) => l.isMatched).length;
    const unmatchedCount = totalLines - matchedCount;
    const matchPercentage = totalLines > 0 ? Math.round((matchedCount / totalLines) * 100) : 0;

    let totalCredit = 0;
    let totalDebit = 0;

    existingLines.forEach((l) => {
      if (l.transactionType === "CREDIT") {
        totalCredit += Number(l.amount) || 0;
      } else {
        totalDebit += Number(l.amount) || 0;
      }
    });

    return {
      totalLines,
      matchedCount,
      unmatchedCount,
      matchPercentage,
      totalCredit,
      totalDebit,
    };
  }, [existingLines]);

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim().length > 0);
        if (lines.length === 0) return;
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

        const parsed = lines.slice(1).map((line) => {
          const cols = line.split(",").map((c) => c.trim());
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = cols[i];
          });
          return obj;
        });
        setUploadedLines(parsed);
      };
      reader.readAsText(file);
    }
  };

  const processUpload = () => {
    if (!selectedAccount || uploadedLines.length === 0) return;

    // Create new draft reconciliation
    const reconciliationId = generateId();
    const newRecon: BankReconciliation = {
      id: reconciliationId,
      period,
      bankName: selectedAccount.name,
      accountNumber: selectedAccountId,
      openingBalance: 0,
      closingBalance: 0,
      status: "DRAFT",
      notes: "Uploaded from CSV",
      createdBy: currentUser?.name || "System",
      createdAt: new Date().toISOString(),
    };

    addBankReconciliation(newRecon);

    // Auto matching logic
    const sysTrx = cashTransactions.filter(
      (t) => t.accountId === selectedAccountId && t.date.startsWith(period)
    );

    uploadedLines.forEach((line) => {
      const date = line.date || line.tanggal || new Date().toISOString();
      const amount = parseFloat(line.amount || line.jumlah || "0");
      const desc = line.description || line.deskripsi || line.keterangan || "";
      const type =
        (line.type || line.tipe || "").toUpperCase() === "CREDIT" || amount > 0
          ? "CREDIT"
          : "DEBIT";

      const absAmount = Math.abs(amount);

      let matchedId = null;
      let isMatched = false;

      const potentialMatch = sysTrx.find(
        (t) =>
          t.amount === absAmount && (t.type === "CASH_IN" ? "CREDIT" : "DEBIT") === type
      );

      if (potentialMatch) {
        matchedId = potentialMatch.id;
        isMatched = true;
      }

      addBankStatementLine({
        id: generateId(),
        reconciliationId,
        date,
        description: desc,
        amount: absAmount,
        transactionType: type as "CREDIT" | "DEBIT",
        isMatched,
        matchedTransactionId: matchedId,
        createdAt: new Date().toISOString(),
      });
    });

    setCsvFile(null);
    setUploadedLines([]);
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ──────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Audit & Finance
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Julia's • Specialty Room • Coffee • Eatery
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            Rekonsiliasi Bank & Mutasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Cocokkan saldo rekening koran bank atau QRIS dengan mutasi buku kas sistem secara otomatis untuk memastikan tidak ada selisih audit.
          </p>
        </div>
      </div>

      {/* ── Account & Period Selector Bar ──────────────────────────────────────── */}
      <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-600" />
            Pilih Rekening Bank / Kas
          </label>
          <CustomSelect
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            options={[
              { value: "", label: "-- Pilih Akun Bank / Dompet --" },
              ...cashAccounts.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.type})`,
              })),
            ]}
            placeholder="Pilih Akun Bank / Dompet"
            buttonClassName="w-full py-2.5 px-3.5 rounded-xl border-slate-200"
          />
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            Periode Mutasi
          </label>
          <CustomMonthPicker
            value={period}
            onChange={setPeriod}
            allowClear={false}
            buttonClassName="w-full sm:w-auto py-2.5 px-3.5 rounded-xl border-slate-200"
          />
        </div>
      </div>

      {/* ── Main Content Area ──────────────────────────────────────────────────── */}
      {selectedAccountId && (
        <div className="space-y-6">
          {!existingReconciliation ? (
            /* Upload New Bank Statement Card */
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 border border-brand-100 shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Mulai Rekonsiliasi Bank Baru
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unggah mutasi rekening koran atau ekspor CSV transaksi bank untuk periode {period}.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                  Format File CSV yang Didukung:
                </p>
                <p>
                  Kolom wajib pada CSV: <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-brand-700 font-bold">date</code> (atau tanggal), <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-brand-700 font-bold">description</code> (keterangan), <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-brand-700 font-bold">amount</code> (nominal), dan <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-brand-700 font-bold">type</code> (DEBIT/CREDIT).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-700 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
                <button
                  onClick={processUpload}
                  disabled={!csvFile || uploadedLines.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Proses & Auto-Match ({uploadedLines.length} baris)</span>
                </button>
              </div>

              {uploadedLines.length > 0 && (
                <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  File siap diproses: terdeteksi {uploadedLines.length} baris mutasi bank.
                </p>
              )}
            </div>
          ) : (
            /* Existing Reconciliation View */
            <div className="space-y-6">
              {/* 4 Bento KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Mutasi */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-5 text-white border border-white/10 shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-300 border border-white/10 flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-brand-400" />
                        Total Mutasi
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-300">
                        <Landmark className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-white">
                        {reconMetrics.totalLines} Baris
                      </h3>
                      <p className="text-[11px] text-slate-300 mt-1 font-medium">
                        Rekening: {existingReconciliation.bankName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Matched Trx */}
                <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                      Sesuai (Matched)
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                    {reconMetrics.matchedCount} Baris ({reconMetrics.matchPercentage}%)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Cocok dengan catatan buku kas
                  </p>
                </div>

                {/* Card 3: Unmatched Trx */}
                <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-rose-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/70">
                      Selisih (Unmatched)
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                      <XCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                    {reconMetrics.unmatchedCount} Baris
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Belum ditemukan di buku kas
                  </p>
                </div>

                {/* Card 4: Status Rekonsiliasi */}
                <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs hover:border-brand-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      Status Audit
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-black ${
                        existingReconciliation.status === "FINAL"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {existingReconciliation.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Oleh: {existingReconciliation.createdBy || "System"}
                  </p>
                </div>
              </div>

              {/* Status Action Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Hasil Rekonsiliasi Rekening: {existingReconciliation.bankName} ({existingReconciliation.period})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total Kredit Masuk: {formatCurrency(reconMetrics.totalCredit)} • Total Debit Keluar: {formatCurrency(reconMetrics.totalDebit)}
                  </p>
                </div>

                {existingReconciliation.status === "DRAFT" && (
                  <button
                    onClick={() =>
                      updateBankReconciliation({ ...existingReconciliation, status: "FINAL" })
                    }
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finalisasi Rekonsiliasi (Kunci Audit)</span>
                  </button>
                )}
              </div>

              {/* Dual-View Data: Tabel Mutasi Bank */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Rincian Mutasi Rekening Koran
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {existingLines.length} transaksi
                  </span>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-3.5">Tanggal Bank</th>
                        <th className="p-3.5">Deskripsi Transaksi</th>
                        <th className="p-3.5 text-right">Nominal</th>
                        <th className="p-3.5 text-center">Tipe</th>
                        <th className="p-3.5 text-center">Status Pencocokan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {existingLines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-slate-400">
                            Tidak ada data mutasi yang tersimpan.
                          </td>
                        </tr>
                      ) : (
                        existingLines.map((line) => (
                          <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                              {formatDate(line.date)}
                            </td>
                            <td className="p-3.5 text-slate-700 font-medium">
                              {line.description}
                            </td>
                            <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                              {formatCurrency(line.amount)}
                            </td>
                            <td className="p-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  line.transactionType === "CREDIT"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {line.transactionType === "CREDIT" ? (
                                  <>
                                    <ArrowDownLeft className="w-3 h-3" />
                                    <span>CREDIT (Masuk)</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpRight className="w-3 h-3" />
                                    <span>DEBIT (Keluar)</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              {line.isMatched ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  <span>Cocok (Matched)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Belum Cocok</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Feed View */}
                <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
                  {existingLines.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      Tidak ada mutasi.
                    </div>
                  ) : (
                    existingLines.map((line) => (
                      <div
                        key={line.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-xs text-slate-900">
                              {formatDate(line.date)}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                              {line.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">
                              {formatCurrency(line.amount)}
                            </p>
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                line.transactionType === "CREDIT"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {line.transactionType}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="text-[11px] text-slate-400 font-medium">Status Match</span>
                          {line.isMatched ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                              <Check className="w-3 h-3" />
                              <span>Cocok (Matched)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              <span>Belum Cocok</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BankReconciliationComponent;
