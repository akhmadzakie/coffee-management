import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import {
  Play,
  Square,
  History,
  AlertCircle,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ShiftSession } from "../types";

export const ShiftManagement = () => {
  const {
    shifts,
    openShift,
    closeShift,
    settings,
    salesTransactions,
    cashTransactions,
    cashAccounts,
    currentUser,
    users,
    isReadOnly,
  } = useStore();
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [startingCashInput, setStartingCashInput] = useState("");
  const [endingCashInput, setEndingCashInput] = useState("");
  const [selectedCashAccountId, setSelectedCashAccountId] = useState("");

  const cashOnlyAccounts = cashAccounts.filter((a) => a.type === "CASH");

  const isIndo = settings.language === "id";

  // KASIR hanya bisa lihat/kelola shift miliknya sendiri
  // Supervisor (MANAGER, SUPER_ADMIN, LEADER) bisa lihat semua shift
  const isKasir = currentUser?.role === "KASIR";
  const visibleShifts = isKasir
    ? shifts.filter((s) => s.userId === currentUser?.id)
    : shifts;

  // Shift aktif saat ini — KASIR hanya bisa close shift miliknya
  const currentShift = visibleShifts.find((s) => s.status === "OPEN");
  // Supervisor bisa lihat shift orang lain yang OPEN juga
  const globalOpenShift = shifts.find((s) => s.status === "OPEN");

  const pastShifts = visibleShifts
    .filter((s) => s.status === "CLOSED")
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

  // Calculate expected cash for current shift
  let totalSales = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;

  if (currentShift) {
    const shiftStartTime = new Date(currentShift.startTime).getTime();

    // Sum sales after shift started
    totalSales = salesTransactions
      .filter((t) => new Date(t.date).getTime() >= shiftStartTime)
      .reduce((sum, t) => sum + t.totalPrice, 0);

    // Sum cash transactions after shift started, ONLY for the specific cashAccountId
    const recentCashTxs = cashTransactions.filter(
      (t) =>
        new Date(t.date).getTime() >= shiftStartTime &&
        t.accountId === currentShift.cashAccountId
    );

    totalCashIn = recentCashTxs
      .filter((t) => t.type === "CASH_IN")
      .reduce((sum, t) => sum + t.amount, 0);

    totalCashOut = recentCashTxs
      .filter((t) => t.type === "CASH_OUT")
      .reduce((sum, t) => sum + t.amount, 0);
  }

  const expectedEndingCash = currentShift
    ? currentShift.startingCash + totalSales + totalCashIn - totalCashOut
    : 0;

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(startingCashInput.replace(/\D/g, ""));
    if (amount >= 0 && selectedCashAccountId) {
      openShift({
        userId: currentUser?.id || "unknown",
        cashAccountId: selectedCashAccountId,
        startTime: new Date().toISOString(),
        endTime: null,
        startingCash: amount,
        expectedEndingCash: null,
        actualEndingCash: null,
        difference: null,
        status: "OPEN",
      });
      setStartingCashInput("");
    }
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    const actual = Number(endingCashInput.replace(/\D/g, ""));
    if (actual >= 0) {
      closeShift(currentShift.id, actual, expectedEndingCash);
      setEndingCashInput("");
    }
  };

  const formatNumberInput = (value: string) => {
    const num = value.replace(/\D/g, "");
    return num ? parseInt(num).toLocaleString("id-ID") : "";
  };

  // Prepare data for shift history chart
  const shiftChartData = pastShifts
    .slice(0, 7)
    .reverse()
    .map((shift) => {
      const isMorning = new Date(shift.startTime).getHours() < 14;
      return {
        name:
          new Date(shift.startTime).toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
          }) + (isMorning ? " (Pagi)" : " (Mlm)"),
        kas: shift.actualEndingCash || 0,
        selisih: shift.difference || 0,
        isPagi: isMorning,
      };
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─── Header Banner ────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Cash Drawer & Session
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Shift Kasir
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            {isIndo ? "Sesi & Rekonsiliasi Shift Kasir" : "Cashier Shift & Drawer Session"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Catat modal uang tunai awal laci kasir, monitor pergerakan kas selama jam kerja, dan rekonsiliasi selisih fisik saat serah terima shift.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 w-full xl:w-auto shrink-0 overflow-hidden">
          <button
            onClick={() => setActiveTab("current")}
            className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 xl:flex-none cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "current" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {activeTab === "current" && (
              <motion.div
                layoutId="shiftSessionTab"
                className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <Clock className="w-3.5 h-3.5 text-brand-600 relative z-10 shrink-0" />
            <span className="relative z-10">
              {isIndo ? "Shift Saat Ini" : "Current Shift"}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 xl:flex-none cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "history" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {activeTab === "history" && (
              <motion.div
                layoutId="shiftSessionTab"
                className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <History className="w-3.5 h-3.5 text-brand-600 relative z-10 shrink-0" />
            <span className="relative z-10">
              {isIndo ? "Riwayat Shift" : "Shift History"} ({pastShifts.length})
            </span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CURRENT ACTIVE SHIFT ─────────────────────────────────────────── */}
      {activeTab === "current" && (
        <div className="max-w-4xl mx-auto space-y-6">
          {!currentShift ? (
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 sm:p-10">
              {isReadOnly ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">
                    Tidak Ada Shift Aktif
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                    Saat ini tidak ada sesi kasir yang sedang berjalan. Kasir bertugas dapat membuka shift baru.
                  </p>
                </div>
              ) : isKasir && globalOpenShift ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-2xs">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Ada Shift yang Sedang Berjalan
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                    Kasir lain sedang dalam shift aktif. Shift baru hanya bisa dibuka setelah shift sebelumnya ditutup.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xs border border-brand-100">
                      <Play className="w-8 h-8 ml-1" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                      {isIndo ? "Buka Sesi Kasir (Mulai Shift)" : "Start Cashier Shift"}
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                      {isIndo
                        ? "Pilih laci kas dan masukkan jumlah modal uang tunai awal untuk memulai transaksi kasir."
                        : "Select cash drawer and input starting cash amount to begin transactions."}
                    </p>
                  </div>
                  <form onSubmit={handleOpenShift} className="max-w-md mx-auto space-y-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {isIndo ? "Pilih Laci Kasir (Pos Kas)" : "Select Cash Drawer"}
                      </label>
                      {cashOnlyAccounts.length === 0 ? (
                        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 text-xs">
                          {isIndo
                            ? "Anda belum memiliki Pos Kas berjenis Tunai. Buat di menu Keuangan > Arus Kas."
                            : "You do not have any Cash Accounts of type CASH. Create one in Finance > Cash Flow."}
                        </div>
                      ) : (
                        <select
                          required
                          value={selectedCashAccountId}
                          onChange={(e) => setSelectedCashAccountId(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 outline-none text-slate-800 transition-all font-semibold text-base sm:text-xs bg-slate-50/50"
                        >
                          <option value="" disabled>
                            {isIndo ? "-- Pilih Pos Kas Tunai --" : "Select account..."}
                          </option>
                          {cashOnlyAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({formatCurrency(acc.balance || 0)})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {isIndo ? "Modal Awal Uang Tunai di Laci" : "Starting Cash"}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={startingCashInput}
                          onChange={(e) =>
                            setStartingCashInput(formatNumberInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 outline-none text-xl font-bold font-mono text-slate-900 transition-all bg-slate-50/50"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isIndo ? "Buka Shift Sekarang" : "Open Shift Now"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shift Dashboard */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4 bg-slate-50/70 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        {isIndo ? "Shift Kasir Sedang Berjalan" : "Active Shift"}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      {isIndo ? "Dimulai pada" : "Started at"}{" "}
                      {new Date(currentShift.startTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({new Date(currentShift.startTime).toLocaleDateString("id-ID")})
                    </p>
                    <p className="text-xs font-semibold text-slate-700 bg-white inline-block px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                      Laci Kasir:{" "}
                      <span className="font-bold text-slate-900">
                        {cashAccounts.find((a) => a.id === currentShift.cashAccountId)?.name || "Unknown"}
                      </span>
                    </p>
                  </div>
                  <div className="relative z-10 px-3.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full shadow-2xs">
                    ACTIVE SHIFT
                  </div>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-4 sm:p-5 bg-white shadow-2xs rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isIndo ? "Modal Awal" : "Starting Cash"}
                    </p>
                    <p className="text-lg sm:text-xl font-black font-mono text-slate-900">
                      {formatCurrency(currentShift.startingCash)}
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 bg-brand-50/40 shadow-2xs rounded-2xl border border-brand-200/80 flex flex-col justify-between group">
                    <p className="text-[11px] font-bold text-brand-800 uppercase tracking-wider mb-2">
                      {isIndo ? "Penjualan" : "Sales"}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-lg sm:text-xl font-black font-mono text-brand-950">
                        +{formatCurrency(totalSales)}
                      </p>
                      <TrendingUp className="w-4 h-4 text-brand-600" />
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-emerald-50/70 shadow-2xs rounded-2xl border border-emerald-200/70 flex flex-col justify-between group">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2">
                      {isIndo ? "Kas Masuk" : "Cash In"}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-lg sm:text-xl font-black font-mono text-emerald-950">
                        +{formatCurrency(totalCashIn)}
                      </p>
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-rose-50/70 shadow-2xs rounded-2xl border border-rose-200/70 flex flex-col justify-between group">
                    <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-2">
                      {isIndo ? "Kas Keluar" : "Cash Out"}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-lg sm:text-xl font-black font-mono text-rose-950">
                        -{formatCurrency(totalCashOut)}
                      </p>
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    </div>
                  </div>
                </div>

                {/* Hero Expected Cash Drawer in Royal Cobalt Dark */}
                <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-950 text-white flex justify-between items-center relative overflow-hidden rounded-b-3xl border-t border-slate-800">
                  <div className="relative z-10">
                    <p className="text-brand-300 text-xs font-bold uppercase tracking-wider mb-1">
                      {isIndo ? "Ekspektasi Uang Fisik di Laci Kasir" : "Expected Cash in Drawer"}
                    </p>
                    <p className="text-3xl sm:text-4xl font-black font-mono text-amber-300 drop-shadow-sm">
                      {formatCurrency(expectedEndingCash)}
                    </p>
                  </div>
                  <DollarSign className="w-14 h-14 text-white/10 relative z-10" />
                </div>
              </motion.div>

              {/* Close Shift Form */}
              {!isReadOnly && (
                <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 sm:p-7">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Square className="w-4 h-4 text-rose-600 fill-current" />
                    {isIndo ? "Tutup Shift & Rekonsiliasi Laci" : "Close Shift & Drawer Reconciliation"}
                  </h3>
                  <form onSubmit={handleCloseShift} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {isIndo ? "Total Hitungan Fisik Uang di Laci" : "Actual Cash Counted in Drawer"}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={endingCashInput}
                          onChange={(e) => setEndingCashInput(formatNumberInput(e.target.value))}
                          className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-xl font-bold font-mono text-slate-900 transition-all bg-slate-50/50"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {isIndo
                          ? "Pastikan uang dihitung cermat. Perbedaan antara ekspektasi dan aktual akan otomatis tercatat sebagai selisih (surplus/minus) shift."
                          : "Ensure cash is counted carefully. Differences will be recorded in the shift reconciliation log."}
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      {isIndo ? "Akhiri Shift Sekarang" : "End Shift Now"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: SHIFT HISTORY ─────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Chart Section */}
          {pastShifts.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 sm:p-7">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-brand-600" />
                {isIndo ? "Tren Total Kas (7 Shift Terakhir)" : "Cash Trend (Last 7 Shifts)"}
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shiftChartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(value) => `Rp ${value / 1000}k`}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08)",
                        backgroundColor: "#ffffff",
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Total Kas"]}
                    />
                    <Bar dataKey="kas" radius={[8, 8, 0, 0]}>
                      {shiftChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isPagi ? "#1b2cc0" : "#0f172a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table Section (Desktop / Tablet) */}
          <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">
                {isIndo ? "Riwayat Rekonsiliasi Shift" : "Shift Reconciliation History"}
              </h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/60 text-slate-500 font-bold">
                  <tr>
                    <th className="px-6 py-3.5 text-left uppercase tracking-wider">
                      {isIndo ? "Waktu Buka" : "Started"}
                    </th>
                    <th className="px-6 py-3.5 text-left uppercase tracking-wider">
                      {isIndo ? "Waktu Tutup" : "Ended"}
                    </th>
                    <th className="px-6 py-3.5 text-right uppercase tracking-wider">
                      {isIndo ? "Modal Awal" : "Starting"}
                    </th>
                    <th className="px-6 py-3.5 text-right uppercase tracking-wider">
                      {isIndo ? "Ekspektasi" : "Expected"}
                    </th>
                    <th className="px-6 py-3.5 text-right uppercase tracking-wider">
                      {isIndo ? "Aktual" : "Actual"}
                    </th>
                    <th className="px-6 py-3.5 text-right uppercase tracking-wider">
                      {isIndo ? "Selisih" : "Difference"}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono">
                  {pastShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-sans">
                        {new Date(shift.startTime).toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-sans">
                        {shift.endTime ? new Date(shift.endTime).toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-medium text-slate-700">
                        {formatCurrency(shift.startingCash)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-medium text-slate-700">
                        {shift.expectedEndingCash != null
                          ? formatCurrency(shift.expectedEndingCash)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-bold text-slate-900">
                        {shift.actualEndingCash != null
                          ? formatCurrency(shift.actualEndingCash)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-sans">
                        {shift.difference != null ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              shift.difference > 0
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : shift.difference < 0
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {shift.difference > 0 ? "+" : ""}
                            {formatCurrency(shift.difference)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                  {pastShifts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-xs font-sans">
                        {isIndo ? "Belum ada riwayat shift" : "No shift history"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed (Phones 360-480px) */}
            <div className="block md:hidden p-4 space-y-3">
              {pastShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {new Date(shift.startTime).toLocaleDateString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(shift.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {shift.endTime ? new Date(shift.endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </span>
                    </div>

                    {shift.difference != null && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          shift.difference > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : shift.difference < 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {shift.difference > 0 ? "+" : ""}
                        {formatCurrency(shift.difference)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Modal:</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(shift.startingCash)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Ekspektasi:</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(shift.expectedEndingCash || 0)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Aktual:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(shift.actualEndingCash || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {pastShifts.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada riwayat shift tersimpan.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
