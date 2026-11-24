import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { BankReconciliation, BankStatementLine } from "../types";
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
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  RefreshCw,
  Search,
  Link2,
  Unlink,
  Lock,
  Eye,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "../utils/format";
import { getLocalPeriodString } from "../utils/dateUtils";
import { getLocalPeriodFromTimestamp } from "../utils/syncSanitizers";
import {
  matchBankStatementLines,
  parseBankStatementCsv,
} from "../utils/financeMetrics";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomSelect } from "./common/CustomSelect";
import { ConfirmModal } from "./common/ConfirmModal";
import { CurrencyInput } from "./common/CurrencyInput";

const generateId = () => {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
};

const formatDate = (dateStr: string) => {
  try {
    const trimmed = String(dateStr || "").trim();
    if (!trimmed) return "-";
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T12:00:00+08:00`
      : trimmed;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(d);
  } catch {
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
    bulkAddBankStatementLines,
    updateBankReconciliation,
    deleteBankReconciliation,
    replaceBankReconLines,
    updateBankStatementLine,
    closedPeriods,
    currentUser,
    isReadOnly,
  } = useStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [period, setPeriod] = useState<string>(() => getLocalPeriodString());

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadedLines, setUploadedLines] = useState<Record<string, string>[]>([]);
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>("0");

  const [lineFilter, setLineFilter] = useState<"ALL" | "MATCHED" | "UNMATCHED">("ALL");
  const [lineSearch, setLineSearch] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<"finalize" | "delete_draft" | null>(null);
  const [manualMatchLine, setManualMatchLine] = useState<BankStatementLine | null>(null);

  const selectedAccount = cashAccounts.find((a) => a.id === selectedAccountId);
  const isPeriodClosed = useMemo(
    () => closedPeriods.some((p) => p.period === period),
    [closedPeriods, period],
  );
  const canMutate = !isReadOnly && !isPeriodClosed;

  // Hitung saldo buku kas sebelum periode berjalan sebagai bantuan saldo awal
  const priorLedgerBalance = useMemo(() => {
    if (!selectedAccountId) return 0;
    let bal = 0;
    for (const t of cashTransactions) {
      if (t.accountId !== selectedAccountId) continue;
      const txPeriod = getLocalPeriodFromTimestamp(t.date);
      if (!txPeriod || txPeriod >= period) continue;
      const rawType = String(t.type || "").toUpperCase();
      const amt = Math.round(Number(t.amount) || 0);
      if (rawType === "CASH_IN" || rawType === "IN" || rawType === "INCOME") {
        bal += amt;
      } else if (rawType === "CASH_OUT" || rawType === "OUT" || rawType === "EXPENSE") {
        bal -= amt;
      }
    }
    return Math.round(bal);
  }, [cashTransactions, selectedAccountId, period]);

  // Retrieve existing reconciliation for selected account and period
  const existingReconciliation = useMemo(() => {
    return bankReconciliations.find(
      (r) => r.accountNumber === selectedAccountId && r.period === period,
    );
  }, [bankReconciliations, selectedAccountId, period]);

  const existingLines = useMemo(() => {
    if (!existingReconciliation) return [];
    return bankStatementLines.filter((l) => l.reconciliationId === existingReconciliation.id);
  }, [bankStatementLines, existingReconciliation]);

  const periodAccountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return cashTransactions.filter(
      (t) =>
        t.accountId === selectedAccountId &&
        getLocalPeriodFromTimestamp(t.date) === period &&
        String(t.type || "").toUpperCase() !== "TRANSFER",
    );
  }, [cashTransactions, selectedAccountId, period]);

  // Kandidat transaksi sistem yang belum dipasangkan di rekonsiliasi ini
  const availableManualCandidates = useMemo(() => {
    if (!manualMatchLine) return [];
    const usedIds = new Set(
      existingLines
        .filter((l) => l.isMatched && l.matchedTransactionId)
        .map((l) => l.matchedTransactionId!),
    );
    return periodAccountTransactions.filter((t) => !usedIds.has(t.id));
  }, [manualMatchLine, existingLines, periodAccountTransactions]);

  const filteredLines = useMemo(() => {
    const q = lineSearch.trim().toLowerCase();
    return existingLines.filter((l) => {
      if (lineFilter === "MATCHED" && !l.isMatched) return false;
      if (lineFilter === "UNMATCHED" && l.isMatched) return false;
      if (q) {
        const matchDesc = (l.description || "").toLowerCase().includes(q);
        const matchDate = (l.date || "").toLowerCase().includes(q);
        const matchAmount = String(l.amount || "").includes(q);
        if (!matchDesc && !matchDate && !matchAmount) return false;
      }
      return true;
    });
  }, [existingLines, lineFilter, lineSearch]);

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
        totalCredit += Math.round(Number(l.amount) || 0);
      } else {
        totalDebit += Math.round(Number(l.amount) || 0);
      }
    });

    const openingBal = Math.round(Number(existingReconciliation?.openingBalance) || 0);
    const computedClosingBalance = Math.round(openingBal + totalCredit - totalDebit);

    return {
      totalLines,
      matchedCount,
      unmatchedCount,
      matchPercentage,
      totalCredit,
      totalDebit,
      computedClosingBalance,
    };
  }, [existingLines, existingReconciliation]);

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      const parsed = parseBankStatementCsv(text);
      if (parsed.length === 0) {
        setCsvFile(null);
        setUploadedLines([]);
        toast.error("File CSV kosong atau tidak memiliki baris mutasi yang valid.");
        return;
      }
      setCsvFile(file);
      setUploadedLines(parsed);
      toast.success(`Terdeteksi ${parsed.length} baris mutasi bank siap diproses.`);
    };
    reader.onerror = () => {
      toast.error("Gagal membaca file CSV mutasi bank.");
    };
    reader.readAsText(file);
  };

  const processUpload = () => {
    if (!canMutate) {
      toast.error(
        isPeriodClosed
          ? `Periode ${period} sudah ditutup buku.`
          : "Mode Owner bersifat Read-Only.",
      );
      return;
    }
    if (!selectedAccount || uploadedLines.length === 0) return;

    const openingBal = Math.round(Number(openingBalanceInput) || 0);
    const reconciliationId = generateId();
    const matchedLines = matchBankStatementLines(
      uploadedLines,
      periodAccountTransactions,
      reconciliationId,
      generateId,
    );

    let totalCredit = 0;
    let totalDebit = 0;
    matchedLines.forEach((l) => {
      if (l.transactionType === "CREDIT") totalCredit += Math.round(Number(l.amount) || 0);
      else totalDebit += Math.round(Number(l.amount) || 0);
    });
    const closingBal = Math.round(openingBal + totalCredit - totalDebit);

    const newRecon: BankReconciliation = {
      id: reconciliationId,
      period,
      bankName: selectedAccount.name,
      accountNumber: selectedAccountId,
      openingBalance: openingBal,
      closingBalance: closingBal,
      status: "DRAFT",
      notes: "Uploaded from CSV",
      createdBy: currentUser?.name || "System",
      createdAt: new Date().toISOString(),
    };

    addBankReconciliation(newRecon);
    bulkAddBankStatementLines(matchedLines);

    setCsvFile(null);
    setUploadedLines([]);
    setLineFilter("ALL");
    setLineSearch("");

    const matchedCnt = matchedLines.filter((l) => l.isMatched).length;
    toast.success(
      `Rekonsiliasi dibuat: ${matchedCnt}/${matchedLines.length} baris langsung cocok dengan buku kas.`,
    );
  };

  const handleRerunAutoMatch = () => {
    if (!canMutate || !existingReconciliation || existingReconciliation.status !== "DRAFT") return;
    const rawInputs = existingLines.map((l) => ({
      date: l.date,
      description: l.description,
      amount: l.amount,
      type: l.transactionType,
    }));
    const reMatched = matchBankStatementLines(
      rawInputs,
      periodAccountTransactions,
      existingReconciliation.id,
      generateId,
    ).map((line, idx) => ({
      ...line,
      id: existingLines[idx]?.id || line.id,
      createdAt: existingLines[idx]?.createdAt || line.createdAt,
    }));

    replaceBankReconLines(existingReconciliation.id, reMatched);
    updateBankReconciliation({
      ...existingReconciliation,
      closingBalance: reconMetrics.computedClosingBalance,
    });
    const matchedCnt = reMatched.filter((l) => l.isMatched).length;
    toast.success(`Pencocokan ulang selesai: ${matchedCnt}/${reMatched.length} baris cocok.`);
  };

  const handleLinkLineToTransaction = (line: BankStatementLine, txId: string | null) => {
    if (!canMutate || !existingReconciliation || existingReconciliation.status !== "DRAFT") return;
    updateBankStatementLine({
      ...line,
      isMatched: true,
      matchedTransactionId: txId,
    });
    setManualMatchLine(null);
    toast.success("Baris mutasi berhasil ditandai cocok.");
  };

  const handleUnlinkLine = (line: BankStatementLine) => {
    if (!canMutate || !existingReconciliation || existingReconciliation.status !== "DRAFT") return;
    updateBankStatementLine({
      ...line,
      isMatched: false,
      matchedTransactionId: null,
    });
    toast.info("Tautan pencocokan baris dilepas.");
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 uppercase border border-brand-200/70 dark:border-brand-500/30">
              Audit & Finance
            </span>
            {isPeriodClosed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                <Lock className="w-3 h-3" />
                Periode Tutup Buku ({period})
              </span>
            )}
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                <Eye className="w-3 h-3" />
                Mode Owner (Read-Only)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shadow-2xs shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            Rekonsiliasi Bank & Mutasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Cocokkan saldo rekening koran bank atau QRIS dengan mutasi buku kas sistem secara otomatis untuk memastikan tidak ada selisih audit.
          </p>
        </div>
      </div>

      {/* ── Account & Period Selector Bar ──────────────────────────────────────── */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
            Pilih Rekening Bank / Kas
          </label>
          <CustomSelect
            value={selectedAccountId}
            onChange={(val) => {
              setSelectedAccountId(val);
              setCsvFile(null);
              setUploadedLines([]);
            }}
            options={[
              { value: "", label: "-- Pilih Akun Bank / Dompet --" },
              ...cashAccounts.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.type})`,
              })),
            ]}
            placeholder="Pilih Akun Bank / Dompet"
            buttonClassName="w-full py-2.5 px-3.5 rounded-xl border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
            Periode Mutasi
          </label>
          <CustomMonthPicker
            value={period}
            onChange={(nextPeriod) => {
              setPeriod(nextPeriod);
              setCsvFile(null);
              setUploadedLines([]);
            }}
            allowClear={false}
            buttonClassName="w-full sm:w-auto py-2.5 px-3.5 rounded-xl border-slate-200 dark:border-slate-700"
          />
        </div>
      </div>

      {!selectedAccountId && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400 shadow-coffee-sm">
          <Landmark className="w-10 h-10 mx-auto mb-2.5 text-brand-400 dark:text-brand-300 opacity-70" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Pilih Rekening Bank atau Dompet Digital
          </p>
          <p className="text-xs mt-1 max-w-md mx-auto">
            Pilih salah satu pos rekening di atas untuk mulai mengunggah CSV rekening koran atau meninjau hasil rekonsiliasi periode {period}.
          </p>
        </div>
      )}

      {/* ── Main Content Area ──────────────────────────────────────────────────── */}
      {selectedAccountId && (
        <div className="space-y-6">
          {!existingReconciliation ? (
            /* Upload New Bank Statement Card */
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 border border-brand-100 dark:border-brand-500/30 shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                    Mulai Rekonsiliasi Bank Baru
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Unggah mutasi rekening koran atau ekspor CSV transaksi bank untuk periode {period}.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                  Format File CSV yang Didukung:
                </p>
                <p>
                  Kolom pada CSV: <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-brand-700 dark:text-brand-300 font-bold">date</code> (atau tanggal), <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-brand-700 dark:text-brand-300 font-bold">description</code> (keterangan), <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-brand-700 dark:text-brand-300 font-bold">amount</code> (nominal), dan <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-brand-700 dark:text-brand-300 font-bold">type</code> (DEBIT/CREDIT). Mendukung pemisah <code className="font-mono">,</code> atau <code className="font-mono">;</code> serta format Rp.
                </p>
              </div>

              {!canMutate ? (
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    {isPeriodClosed
                      ? `Periode ${period} sudah ditutup buku. Unggah mutasi rekonsiliasi baru dinonaktifkan.`
                      : "Mode Pemantauan Owner (Read-Only): Anda tidak dapat mengunggah atau membuat rekonsiliasi baru."}
                  </span>
                </div>
              ) : (
                <>
                  {/* Opening Balance Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Saldo Awal Rekening Koran (Rp)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          Rp
                        </span>
                        <CurrencyInput
                          value={openingBalanceInput}
                          onValueChange={setOpeningBalanceInput}
                          placeholder="0"
                          className="w-full pl-9 pr-3.5 py-2.5 text-xs font-bold font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="p-2.5 rounded-xl bg-brand-50/50 dark:bg-brand-500/10 border border-brand-200/60 dark:border-brand-500/30 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          Saldo buku kas sebelum {period}:{" "}
                          <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {formatCurrency(priorLedgerBalance)}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpeningBalanceInput(String(Math.max(0, priorLedgerBalance)))}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 font-bold text-[11px] hover:bg-brand-50 cursor-pointer shrink-0"
                        >
                          Isi dari Kas
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={processUpload}
                      disabled={!csvFile || uploadedLines.length === 0}
                      className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm shadow-brand-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Proses & Auto-Match ({uploadedLines.length} baris)</span>
                    </button>
                  </div>

                  {uploadedLines.length > 0 && (
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      File siap diproses: {csvFile?.name} ({uploadedLines.length} baris mutasi bank).
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Existing Reconciliation View */
            <div className="space-y-6">
              {/* 4 Bento KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Hero Brand Card - Total Mutasi */}
                <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white border border-brand-600 shadow-coffee">
                  <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-white border border-white/20 flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-brand-sky" />
                        Total Mutasi
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white">
                        <Landmark className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-white tabular-nums">
                        {reconMetrics.totalLines} Baris
                      </h3>
                      <p className="text-[11px] text-brand-200 mt-1 font-medium">
                        {existingReconciliation.bankName} • Saldo Akhir:{" "}
                        <strong className="text-white font-mono tabular-nums">
                          {formatCurrency(reconMetrics.computedClosingBalance)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Matched Trx */}
                <div className="rounded-3xl bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/70 dark:border-emerald-500/30 p-5 shadow-coffee-sm hover:shadow-coffee transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-500/30">
                      Sesuai (Matched)
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-300 tracking-tight tabular-nums">
                    {reconMetrics.matchedCount} Baris ({reconMetrics.matchPercentage}%)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                    Cocok dengan catatan buku kas
                  </p>
                </div>

                {/* Card 3: Unmatched Trx */}
                <div className="rounded-3xl bg-gradient-to-br from-rose-50/60 via-white to-white dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 border border-rose-200/70 dark:border-rose-500/30 p-5 shadow-coffee-sm hover:shadow-coffee transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-500/30">
                      Selisih (Unmatched)
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-rose-100/80 dark:bg-rose-500/20 border border-rose-200/70 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-300 shadow-2xs">
                      <XCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-300 tracking-tight tabular-nums">
                    {reconMetrics.unmatchedCount} Baris
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                    Belum ditemukan di buku kas
                  </p>
                </div>

                {/* Card 4: Status Rekonsiliasi */}
                <div className="rounded-3xl bg-gradient-to-br from-brand-50/60 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 border border-brand-200/70 dark:border-brand-500/30 p-5 shadow-coffee-sm hover:shadow-coffee transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      Status Audit
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-brand-100/80 dark:bg-brand-500/20 border border-brand-200/70 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shadow-2xs">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-black border ${
                        existingReconciliation.status === "FINAL"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                          : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                      }`}
                    >
                      {existingReconciliation.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 font-medium">
                    Oleh: {existingReconciliation.createdBy || "System"}
                  </p>
                </div>
              </div>

              {/* Status Action Banner */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Hasil Rekonsiliasi Rekening: {existingReconciliation.bankName} ({existingReconciliation.period})
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                    Saldo Awal: {formatCurrency(existingReconciliation.openingBalance)} • Kredit Masuk: {formatCurrency(reconMetrics.totalCredit)} • Debit Keluar: {formatCurrency(reconMetrics.totalDebit)} • Saldo Akhir: {formatCurrency(reconMetrics.computedClosingBalance)}
                  </p>
                </div>

                {existingReconciliation.status === "DRAFT" && canMutate && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRerunAutoMatch}
                      className="px-3.5 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Cocokkan Ulang</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmAction("delete_draft")}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmAction("finalize")}
                      className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-brand-600/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finalisasi Rekonsiliasi</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dual-View Data: Tabel Mutasi Bank */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/70">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Rincian Mutasi Rekening Koran
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      ({filteredLines.length}/{existingLines.length} transaksi)
                    </span>
                  </div>

                  {/* Filter & Search Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-[11px] font-bold">
                      {[
                        { id: "ALL", label: "Semua" },
                        { id: "MATCHED", label: `Cocok (${reconMetrics.matchedCount})` },
                        { id: "UNMATCHED", label: `Selisih (${reconMetrics.unmatchedCount})` },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setLineFilter(f.id as any)}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            lineFilter === f.id
                              ? "bg-brand-600 text-white"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={lineSearch}
                        onChange={(e) => setLineSearch(e.target.value)}
                        placeholder="Cari mutasi bank..."
                        className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      {lineSearch && (
                        <button
                          type="button"
                          onClick={() => setLineSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          aria-label="Hapus pencarian"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-3.5">Tanggal Bank</th>
                        <th className="p-3.5">Deskripsi Transaksi</th>
                        <th className="p-3.5 text-right">Nominal</th>
                        <th className="p-3.5 text-center">Tipe</th>
                        <th className="p-3.5 text-center">Status Pencocokan</th>
                        {existingReconciliation.status === "DRAFT" && canMutate && (
                          <th className="p-3.5 text-center">Aksi</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredLines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={existingReconciliation.status === "DRAFT" && canMutate ? 6 : 5}
                            className="p-10 text-center text-slate-400"
                          >
                            Tidak ada data mutasi yang cocok dengan filter saat ini.
                          </td>
                        </tr>
                      ) : (
                        filteredLines.map((line) => (
                          <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {formatDate(line.date)}
                            </td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                              {line.description}
                            </td>
                            <td className="p-3.5 text-right font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 text-sm">
                              {formatCurrency(line.amount)}
                            </td>
                            <td className="p-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                  line.transactionType === "CREDIT"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                                    : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
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
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-500/30">
                                  <Check className="w-3 h-3" />
                                  <span>{line.matchedTransactionId ? "Cocok (Buku Kas)" : "Cocok (Manual)"}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-200 dark:border-rose-500/30">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Belum Cocok</span>
                                </span>
                              )}
                            </td>
                            {existingReconciliation.status === "DRAFT" && canMutate && (
                              <td className="p-3.5 text-center whitespace-nowrap">
                                {line.isMatched ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUnlinkLine(line)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-[11px] font-bold transition cursor-pointer"
                                    title="Lepas tautan pencocokan"
                                  >
                                    <Unlink className="w-3 h-3" />
                                    <span>Lepas</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setManualMatchLine(line)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 text-[11px] font-bold transition cursor-pointer"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span>Cocokkan</span>
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Feed View */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
                  {filteredLines.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      Tidak ada mutasi yang sesuai.
                    </div>
                  ) : (
                    filteredLines.map((line) => (
                      <div
                        key={line.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {formatDate(line.date)}
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                              {line.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {formatCurrency(line.amount)}
                            </p>
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                line.transactionType === "CREDIT"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
                              }`}
                            >
                              {line.transactionType}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          {line.isMatched ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-500/30">
                              <Check className="w-3 h-3" />
                              <span>Cocok</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-200 dark:border-rose-500/30">
                              <AlertCircle className="w-3 h-3" />
                              <span>Belum Cocok</span>
                            </span>
                          )}
                          {existingReconciliation.status === "DRAFT" && canMutate && (
                            line.isMatched ? (
                              <button
                                type="button"
                                onClick={() => handleUnlinkLine(line)}
                                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                              >
                                <Unlink className="w-3 h-3" /> Lepas
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setManualMatchLine(line)}
                                className="text-[11px] font-bold text-brand-600 dark:text-brand-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Link2 className="w-3 h-3" /> Cocokkan
                              </button>
                            )
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

      {/* ── Manual Line Match Modal ──────────────────────────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {manualMatchLine && (
              <motion.div
                key="bank-manual-match-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setManualMatchLine(null);
                }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/70 shrink-0">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Cocokkan Mutasi Rekening Koran
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {formatDate(manualMatchLine.date)} • {manualMatchLine.description} ({formatCurrency(manualMatchLine.amount)})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualMatchLine(null)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                    {availableManualCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                        Tidak ada transaksi buku kas lain yang belum dipasangkan pada periode {period}.
                      </p>
                    ) : (
                      availableManualCandidates.map((tx) => (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => handleLinkLineToTransaction(manualMatchLine, tx.id)}
                          className="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 text-left flex items-center justify-between gap-3 transition cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {tx.description}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {formatDate(tx.date)} • {tx.category}
                            </p>
                          </div>
                          <span className="font-mono font-black text-xs tabular-nums text-brand-700 dark:text-brand-300 shrink-0">
                            {formatCurrency(tx.amount)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70 flex flex-wrap justify-between gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLinkLineToTransaction(manualMatchLine, null)}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-bold cursor-pointer"
                    >
                      Tandai Cocok (Penyesuaian Manual)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualMatchLine(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* ── Confirm Modal Finalisasi / Hapus Draft ────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        variant={confirmAction === "delete_draft" ? "danger" : "warning"}
        title={
          confirmAction === "delete_draft"
            ? "Hapus Draft Rekonsiliasi Bank?"
            : "Finalisasi & Kunci Rekonsiliasi Bank?"
        }
        message={
          confirmAction === "delete_draft"
            ? `Draft rekonsiliasi ${existingReconciliation?.bankName || ""} periode ${period} beserta ${existingLines.length} baris mutasinya akan dihapus. Anda dapat mengunggah ulang file CSV setelahnya.`
            : reconMetrics.unmatchedCount > 0
              ? `Masih terdapat ${reconMetrics.unmatchedCount} baris mutasi yang belum cocok dengan buku kas. Setelah difinalisasi, rekonsiliasi tidak dapat diubah lagi. Lanjutkan finalisasi?`
              : `Seluruh ${reconMetrics.totalLines} baris mutasi sudah cocok. Kunci status rekonsiliasi ini menjadi FINAL?`
        }
        confirmLabel={confirmAction === "delete_draft" ? "Ya, Hapus Draft" : "Ya, Finalisasi (FINAL)"}
        cancelLabel="Batal"
        onConfirm={() => {
          if (!canMutate || !existingReconciliation) {
            setConfirmAction(null);
            return;
          }
          if (confirmAction === "delete_draft") {
            deleteBankReconciliation(existingReconciliation.id);
            toast.info("Draft rekonsiliasi bank berhasil dihapus.");
          } else if (confirmAction === "finalize") {
            updateBankReconciliation({
              ...existingReconciliation,
              closingBalance: reconMetrics.computedClosingBalance,
              status: "FINAL",
            });
            toast.success("Rekonsiliasi bank berhasil difinalisasi (FINAL).");
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default BankReconciliationComponent;
