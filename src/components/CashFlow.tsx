import React, { useState, useMemo, useRef } from "react";
import { getLocalDateString } from "../utils/dateUtils";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Wallet,
  Building2,
  Landmark,
  Settings2,
  Smartphone,
  Download,
  Upload,
  CheckCircle,
  CheckCircle2,
  Tag,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Layers,
  X,
  CreditCard,
} from "lucide-react";
import { CashAccount } from "../types";
import { CsvImportExport } from "./common/CsvImportExport";

interface CashFlowProps {
  onNavigate?: (view: any) => void;
}

export const CashFlow: React.FC<CashFlowProps> = ({ onNavigate }) => {
  const {
    cashTransactions,
    addCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,
    cashAccounts,
    addCashAccount,
    deleteCashAccount,
    isReadOnly,
    expenseCategories,
    salesTransactions,
    salesImportLogs,
    closedPeriods,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CASH_IN" | "CASH_OUT">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  const unverifiedSalesLogs = useMemo(() => {
    return salesImportLogs.filter((log) => {
      if (log.status !== "SUCCESS") return false;
      const isVerified = cashTransactions.some((c) => c.referenceId === log.id);
      return !isVerified;
    });
  }, [salesImportLogs, cashTransactions]);

  const [trxType, setTrxType] = useState<"CASH_IN" | "CASH_OUT" | "TRANSFER">(
    "CASH_IN",
  );

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = cashTransactions;
    if (selectedAccountId !== "all") {
      filtered = filtered.filter((f) => f.accountId === selectedAccountId);
    }
    if (typeFilter !== "ALL") {
      filtered = filtered.filter((f) => f.type === typeFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.category.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [cashTransactions, selectedAccountId, typeFilter, searchTerm]);

  // Calculate balances per account
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    cashAccounts.forEach((acc) => (balances[acc.id] = 0));

    cashTransactions.forEach((trx) => {
      if (balances[trx.accountId] === undefined) {
        balances[trx.accountId] = 0;
      }
      if (trx.type === "CASH_IN") {
        balances[trx.accountId] += trx.amount;
      } else if (trx.type === "CASH_OUT") {
        balances[trx.accountId] -= trx.amount;
      }
    });
    return balances;
  }, [cashTransactions, cashAccounts]);

  const totalBalance = (Object.values(accountBalances) as number[]).reduce(
    (sum, b) => sum + b,
    0,
  );

  // Scoped transactions for summary stats
  const scopeTransactions = useMemo(() => {
    if (selectedAccountId === "all") return cashTransactions;
    return cashTransactions.filter((f) => f.accountId === selectedAccountId);
  }, [cashTransactions, selectedAccountId]);

  const totalCashIn = useMemo(() => {
    return scopeTransactions
      .filter((t) => t.type === "CASH_IN")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [scopeTransactions]);

  const totalCashOut = useMemo(() => {
    return scopeTransactions
      .filter((t) => t.type === "CASH_OUT")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [scopeTransactions]);

  const netCashFlow = totalCashIn - totalCashOut;

  const handleTrxSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const accId = formData.get("accountId") as string;
    const catId = formData.get("categoryId") as string;
    const catName = expenseCategories.find((c: any) => c.id === catId)?.name || "Lainnya";

    const trxDate = new Date().toISOString();
    const period = trxDate.substring(0, 7);
    if (closedPeriods.some(p => p.period === period)) {
      alert('Gagal: Periode untuk tanggal ini sudah ditutup.');
      return;
    }

    addCashTransaction({
      accountId: accId,
      type: trxType,
      date: trxDate,
      amount: Number(formData.get("amount")),
      description: formData.get("description") as string,
      category: catName,
      categoryId: catId || null,
      referenceId: null,
    });

    setIsModalOpen(false);
  };

  const handleAccountSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    addCashAccount({
      name: formData.get("name") as string,
      type: formData.get("type") as "BANK" | "CASH" | "SAVINGS" | "E_WALLET",
      isDefault: cashAccounts.length === 0, // First account is default
    });

    setIsAccountModalOpen(false);
  };



  const handleImport = (parsedData: any[]) => {
    if (cashAccounts.length === 0) {
      alert("Silakan buat Pos Kas terlebih dahulu sebelum mengimport transaksi.");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let errors = 0;

    parsedData.forEach((row: any) => {
      try {
        const systemId = row["ID_SISTEM (JANGAN DIUBAH)"]?.trim();
        const date = row["Tanggal"] || new Date().toISOString();
        const rawJenis = String(row["Jenis"] || "").toLowerCase();
        const type = rawJenis.includes("masuk") ? "CASH_IN" : "CASH_OUT";
        const category = row["Kategori"] || "Lainnya";
        const description = row["Deskripsi"] || "Import Excel";
        const amount = parseFloat(row["Jumlah"]) || 0;
        const accountName = row["Pos Kas"];
        const posKas = cashAccounts.find((a) => a.name.toLowerCase() === (accountName || "").toLowerCase()) || cashAccounts[0];

        if (amount > 0 && posKas) {
          const rowPeriod = date.substring(0, 7);
          if (closedPeriods.some((p: any) => p.period === rowPeriod)) {
            errors++;
            return; // skip this row
          }

          const existingTrx = cashTransactions.find((t) => t.id === systemId);
          if (existingTrx) {
            updateCashTransaction({
              ...existingTrx,
              accountId: posKas.id,
              type: type,
              date: date,
              amount: amount,
              description: description,
              category: category,
            });
            updatedCount++;
          } else {
            addCashTransaction({
              accountId: posKas.id,
              type: type,
              date: date,
              amount: amount,
              description: description,
              category: category,
              categoryId: null,
              referenceId: null,
            });
            addedCount++;
          }
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
      }
    });

    alert(`Import selesai.\nDitambahkan: ${addedCount} data baru\nDiperbarui: ${updatedCount} data lama\nGagal/Dilewati: ${errors} baris`);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <Building2 className="w-5 h-5" />;
      case "SAVINGS":
        return <Landmark className="w-5 h-5" />;
      case "E_WALLET":
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Wallet className="w-5 h-5" />;
    }
  };

  return (
    <>
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── Header & Top Metrics ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200/60 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Buku Kas Besar
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/70 shadow-2xs">
              <Building2 className="w-3 h-3 text-slate-500" />
              Julia's Eatery & Coffee
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Arus Kas & Buku Rekening
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Pencatatan real-time likuiditas dompet toko, kas laci, dan mutasi pengeluaran harian.
          </p>
        </div>

        {/* Global Action on Header */}
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("open-ai-assistant", {
                  detail: { tab: "quick-input" },
                })
              );
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-brand-50 to-indigo-50 hover:from-brand-100 hover:to-indigo-100 text-brand-800 border border-brand-200/80 rounded-2xl text-xs font-bold shadow-2xs active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Catat pengeluaran/pemasukan kas dengan kalimat bebas (AI Natural Input)"
          >
            <Sparkles className="w-4 h-4 text-brand-600 fill-brand-600/20 shrink-0" />
            <span>✨ Catat Cepat AI</span>
          </button>
          {!isReadOnly && (
            <button
              onClick={() => {
                setTrxType("CASH_IN");
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Tambah Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 4 Executive Bento KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Saldo Kas Riil */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {selectedAccountId === "all" ? "Total Likuiditas Kas" : "Saldo Pos Ini"}
            </span>
            <div className="w-11 h-11 rounded-2xl bg-blue-50/80 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {formatCurrency(selectedAccountId === "all" ? totalBalance : (accountBalances[selectedAccountId] || 0))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {selectedAccountId === "all" ? `${cashAccounts.length} pos kas & rekening terdaftar` : "Saldo aktif siap pakai"}
            </p>
          </div>
        </div>

        {/* Card 2: Pemasukan Kas (Cash In) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pemasukan Kas (In)</span>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50/80 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600">
              {formatCurrency(totalCashIn)}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Total dana masuk tercatat
            </p>
          </div>
        </div>

        {/* Card 3: Pengeluaran Kas (Cash Out) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pengeluaran Kas (Out)</span>
            <div className="w-11 h-11 rounded-2xl bg-rose-50/80 text-rose-600 border border-rose-200/60 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <TrendingDown className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600">
              {formatCurrency(totalCashOut)}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Belanja bahan, opex & operasional
            </p>
          </div>
        </div>

        {/* Card 4: Net Cash Flow */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition-all duration-200 ease-out flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Arus Kas Bersih (Net)</span>
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform ${
              netCashFlow >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-amber-50 text-amber-600 border-amber-200/60"
            }`}>
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              netCashFlow >= 0 ? "text-slate-900" : "text-amber-600"
            }`}>
              {formatCurrency(netCashFlow)}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {netCashFlow >= 0 ? "Surplus kas operasional" : "Defisit kas sementara"}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Pos Kas (Rekening / Dompet) Section ───────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Landmark className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Pos Kas & Rekening Toko
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih pos kas untuk memfilter mutasi buku kas besar.
              </p>
            </div>
          </div>
          {!isReadOnly && (
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Pos Kas</span>
            </button>
          )}
        </div>

        {cashAccounts.length === 0 ? (
          <div className="bg-amber-50/80 text-amber-900 p-5 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm">Belum Ada Pos Kas Terdaftar</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Buat minimal satu pos kas (contoh: "Kas Utama Laci" atau "BCA Julia's") untuk mulai mencatat transaksi.
              </p>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                Buat Pos Kas Baru
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {/* Account Card: Semua Pos Kas */}
            <div
              onClick={() => setSelectedAccountId("all")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selectedAccountId === "all"
                  ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                  : "bg-slate-50/80 text-slate-800 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
                    selectedAccountId === "all" ? "bg-white/15 text-white" : "bg-white text-slate-700 border border-slate-200/60"
                  }`}
                >
                  <Landmark className="w-4 h-4 stroke-[2.2]" />
                </div>
                {selectedAccountId === "all" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-slate-200">
                    Aktif
                  </span>
                )}
              </div>
              <div>
                <p className={`text-xs font-semibold ${selectedAccountId === "all" ? "text-slate-300" : "text-slate-500"}`}>
                  Semua Pos Kas
                </p>
                <p className="text-lg font-extrabold mt-0.5 tracking-tight">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
            </div>

            {/* Individual Account Cards */}
            {cashAccounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`relative group p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? "bg-brand-600 text-white border-brand-600 shadow-md scale-[1.02]"
                      : "bg-slate-50/80 text-slate-800 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-xs"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
                        isSelected ? "bg-white/20 text-white" : "bg-white text-brand-600 border border-slate-200/60"
                      }`}
                    >
                      {getAccountIcon(acc.type)}
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                          Aktif
                        </span>
                      )}
                      {!isReadOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Hapus pos kas "${acc.name}"? Transaksi di dalamnya mungkin tidak memiliki referensi pos kas yang valid.`
                              )
                            ) {
                              deleteCashAccount(acc.id);
                            }
                          }}
                          className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                            isSelected
                              ? "hover:bg-white/20 text-white"
                              : "hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          }`}
                          title="Hapus Pos Kas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold truncate ${isSelected ? "text-brand-100" : "text-slate-500"}`}>
                      {acc.name}
                    </p>
                    <p className="text-lg font-extrabold mt-0.5 tracking-tight">
                      {formatCurrency(accountBalances[acc.id] || 0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Riwayat Transaksi Card (Desktop Table + Mobile Cards) ────────── */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Toolbar Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Riwayat Mutasi Transaksi</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                  {filteredTransactions.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedAccountId !== "all"
                  ? `Pos Kas: ${cashAccounts.find((a) => a.id === selectedAccountId)?.name}`
                  : "Menampilkan semua transaksi seluruh pos kas"}
              </p>
            </div>

            {/* Sliding Pill Filter Tabs */}
            <div className="bg-slate-100/90 backdrop-blur-xs p-1 rounded-2xl flex items-center border border-slate-200/80 text-xs shadow-inner self-start sm:self-auto">
              {[
                { id: "ALL", label: "Semua" },
                { id: "CASH_IN", label: "Pemasukan (+)" },
                { id: "CASH_OUT", label: "Pengeluaran (-)" },
              ].map((tab) => {
                const isActive = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTypeFilter(tab.id as any)}
                    className={`relative px-3 py-1.5 rounded-xl font-semibold transition-colors duration-200 cursor-pointer ${
                      isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="cashflowFilterTab"
                        className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Bar */}
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi / kategori..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3.5 py-2 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>

            {!isReadOnly && cashAccounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <CsvImportExport 
                  onImport={handleImport}
                  templateHeaders={["Tanggal", "Pos Kas", "Jenis", "Kategori", "Deskripsi", "Jumlah"]}
                  templateExampleRow={[getLocalDateString(), cashAccounts[0]?.name || "Kas Utama", "Pemasukan", "Pendapatan Lain", "Contoh transaksi", "50000"]}
                  templateFilename="Template_Import_Arus_Kas.xlsx"
                  buttonLabel="Excel"
                  currentData={filteredTransactions.map((trx) => ({
                    id: trx.id,
                    Tanggal: getLocalDateString(new Date(trx.date)),
                    "Pos Kas": cashAccounts.find((a) => a.id === trx.accountId)?.name || "-",
                    Jenis: trx.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
                    Kategori: trx.category,
                    Deskripsi: trx.description,
                    Jumlah: trx.amount,
                  }))}
                  templateDropdowns={{
                    "Pos Kas": cashAccounts.map((a) => a.name),
                    Jenis: ["Pemasukan", "Pengeluaran"],
                    Kategori: expenseCategories.map((c: any) => c.name),
                  }}
                  templateColumnTypes={{
                    Tanggal: "date",
                    Jumlah: "number",
                  }}
                  templateHints={{
                    Tanggal: "Format: YYYY-MM-DD",
                    Jumlah: "Angka saja, tanpa titik atau koma",
                  }}
                />

                {unverifiedSalesLogs.length > 0 && (
                  <button
                    onClick={() => setIsVerificationModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl transition-all shrink-0 text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Verifikasi ({unverifiedSalesLogs.length})</span>
                  </button>
                )}

                {onNavigate && (
                  <button
                    onClick={() => onNavigate("expense_categories")}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl transition-all shrink-0 text-xs font-semibold shadow-2xs cursor-pointer"
                    title="Kelola & Atur Kategori Kas & Biaya"
                  >
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span>Kategori</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Desktop & Tablet View: Clean Table ──────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">Tanggal & Waktu</th>
                <th className="py-3.5 px-5">Pos Kas</th>
                <th className="py-3.5 px-5">Jenis</th>
                <th className="py-3.5 px-5">Kategori</th>
                <th className="py-3.5 px-5">Deskripsi</th>
                <th className="py-3.5 px-5 text-right">Jumlah</th>
                <th className="py-3.5 px-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.map((trx) => (
                <tr
                  key={trx.id}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  <td className="py-3.5 px-5 text-slate-900 font-medium">
                    <span className="block font-semibold">
                      {new Date(trx.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {new Date(trx.date).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-700 font-semibold">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs border border-slate-200/60">
                      <Wallet className="w-3 h-3 text-slate-400" />
                      {cashAccounts.find((a) => a.id === trx.accountId)?.name || "-"}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                        trx.type === "CASH_IN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : "bg-rose-50 text-rose-700 border-rose-200/60"
                      }`}
                    >
                      {trx.type === "CASH_IN" ? (
                        <>
                          <ArrowUpRight className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                          Pemasukan
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="w-3 h-3 text-rose-600 stroke-[2.5]" />
                          Pengeluaran
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs">
                      {trx.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600 max-w-xs truncate">
                    {trx.description}
                  </td>
                  <td
                    className={`py-3.5 px-5 text-right font-extrabold text-sm tracking-tight ${
                      trx.type === "CASH_IN" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {trx.type === "CASH_IN" ? "+" : "-"}
                    {formatCurrency(trx.amount)}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    {!isReadOnly && !closedPeriods.some((p: any) => p.period === trx.date.substring(0, 7)) && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Apakah Anda yakin ingin menghapus transaksi ini?"
                            )
                          ) {
                            deleteCashTransaction(trx.id);
                          }
                        }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors mx-auto cursor-pointer"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                      <Receipt className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <p className="font-bold text-slate-700 text-xs">Tidak Ada Transaksi Ditemukan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Coba ganti filter atau catat transaksi pertama Anda dengan tombol di atas.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Mobile Smartphone View: Ergonomic Cards Feed ────────────────── */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredTransactions.map((trx) => (
            <div key={trx.id} className="p-4 space-y-2 hover:bg-slate-50/70 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shadow-2xs ${
                      trx.type === "CASH_IN"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                        : "bg-rose-50 text-rose-600 border border-rose-200/60"
                    }`}
                  >
                    {trx.type === "CASH_IN" ? (
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {trx.description}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(trx.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      • {new Date(trx.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-sm font-extrabold tracking-tight block ${
                      trx.type === "CASH_IN" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {trx.type === "CASH_IN" ? "+" : "-"}
                    {formatCurrency(trx.amount)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {cashAccounts.find((a) => a.id === trx.accountId)?.name || "-"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[10px]">
                  {trx.category}
                </span>

                {!isReadOnly && !closedPeriods.some((p: any) => p.period === trx.date.substring(0, 7)) && (
                  <button
                    onClick={() => {
                      if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
                        deleteCashTransaction(trx.id);
                      }
                    }}
                    className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                <Receipt className="w-6 h-6 stroke-[1.8]" />
              </div>
              <p className="font-bold text-slate-700 text-xs">Tidak Ada Transaksi</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Coba sesuaikan filter atau gunakan Catat Cepat AI.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── TRANSACTION MODAL ────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center z-50 animate-fade-in">
          <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 animate-scale-up flex flex-col max-h-[85vh] sm:max-h-[88vh]">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs ${
                  trxType === "CASH_IN" ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60" : "bg-rose-50 text-rose-600 border border-rose-200/60"
                }`}>
                  {trxType === "CASH_IN" ? <TrendingUp className="w-5 h-5 stroke-[2.2]" /> : <TrendingDown className="w-5 h-5 stroke-[2.2]" />}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Catat Transaksi Manual
                  </h2>
                  <p className="text-xs text-slate-400">
                    Buku kas besar Julia's Specialty Room
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTrxSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                {/* Type Toggle Sliding Pill */}
                <div className="flex gap-1.5 p-1 bg-slate-100/90 rounded-2xl mb-4 border border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => setTrxType("CASH_IN")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      trxType === "CASH_IN"
                        ? "bg-white text-emerald-700 shadow-xs border border-emerald-200/60"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Uang Masuk (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrxType("CASH_OUT")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      trxType === "CASH_OUT"
                        ? "bg-white text-rose-700 shadow-xs border border-rose-200/60"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Pengeluaran (-)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Pos Kas / Rekening
                  </label>
                  <select
                    name="accountId"
                    required
                    defaultValue={
                      selectedAccountId !== "all"
                        ? selectedAccountId
                        : cashAccounts[0]?.id || ""
                    }
                    className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                  >
                    <option value="" disabled>
                      Pilih Pos Kas...
                    </option>
                    {cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Nominal Transaksi (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      Rp
                    </span>
                    <input
                      type="number"
                      name="amount"
                      required
                      min="1"
                      placeholder="0"
                      className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm font-extrabold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Kategori Transaksi
                    </label>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          onNavigate("expense_categories");
                        }}
                        className="text-[11px] text-brand-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Tag className="w-3 h-3" />
                        + Atur Kategori
                      </button>
                    )}
                  </div>
                  <select
                    name="categoryId"
                    required
                    defaultValue=""
                    className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                  >
                    <option value="" disabled>Pilih Kategori...</option>
                    {expenseCategories
                      .filter((c: any) => c.isActive)
                      .map((cat: any) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.parentId ? "— " : ""}{cat.name} ({cat.type})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Deskripsi / Keperluan
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={2}
                    className="w-full px-3.5 py-2 text-base sm:text-xs border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                    placeholder="Contoh: Belanja bahan cup take-away & tissue meja..."
                  ></textarea>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ACCOUNT MODAL ─────────────────────────────────────────────── */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center z-50 animate-fade-in">
          <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 animate-scale-up flex flex-col max-h-[85vh] sm:max-h-[88vh]">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-2xs">
                  <Landmark className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Tambah Pos Kas Baru
                  </h2>
                  <p className="text-xs text-slate-400">
                    Rekening bank, kas laci, atau dompet digital
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Nama Pos Kas
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3.5 py-2.5 text-base sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                    placeholder="Contoh: Kas Laci Bar, Rekening BCA, Tabungan"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Jenis Pos Kas
                  </label>
                  <select
                    name="type"
                    required
                    className="w-full px-3.5 py-2.5 text-sm sm:text-xs font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 focus:bg-white transition-all"
                  >
                    <option value="CASH">Tunai (Kas Laci/Petty Cash)</option>
                    <option value="BANK">Rekening Bank (BCA / Mandiri / BRI)</option>
                    <option value="E_WALLET">Dompet Digital (QRIS / GoPay / OVO)</option>
                    <option value="SAVINGS">Tabungan / Investasi Toko</option>
                  </select>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  Buat Pos Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      {/* ─── SALES VERIFICATION MODAL ──────────────────────────────────── */}
      {isVerificationModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center animate-fade-in">
          <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[88vh] flex flex-col border border-slate-200/80 overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Verifikasi Penjualan ({unverifiedSalesLogs.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Sinkronisasi data penjualan POS ke buku kas besar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {unverifiedSalesLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-xs font-medium">
                  Semua data penjualan telah tervalidasi di buku arus kas.
                </p>
              ) : (
                <div className="space-y-4">
                  {unverifiedSalesLogs.map((log) => {
                    const totalSales = salesTransactions
                      .filter((t) => t.importLogId === log.id)
                      .reduce((sum, t) => sum + t.totalPrice, 0);

                    return (
                      <div key={log.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-xs text-slate-900">
                              Batch: {new Date(log.importDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {log.rowCount} transaksi tamu
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-sm text-emerald-600">
                              {formatCurrency(totalSales)}
                            </p>
                          </div>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const accountId = formData.get("accountId") as string;
                            if (!accountId) return;

                            addCashTransaction({
                              accountId: accountId,
                              type: "CASH_IN",
                              amount: totalSales,
                              date: new Date(log.importDate).toISOString(),
                              description: `Pemasukan Penjualan (${log.rowCount} transaksi)`,
                              category: "Penjualan",
                              categoryId: null,
                              referenceId: log.id,
                            });
                          }}
                          className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end"
                        >
                          <div className="flex-1">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Simpan ke Pos Kas
                            </label>
                            <select
                              name="accountId"
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                            >
                              <option value="">-- Pilih Pos Kas Tujuan --</option>
                              {cashAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer shrink-0"
                          >
                            Simpan ke Buku Kas
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 px-6 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/70">
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 active:scale-95 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
