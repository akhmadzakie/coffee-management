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
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
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
        t.accountId === currentShift.cashAccountId,
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
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex space-x-6 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab("current")}
          className={`font-semibold pb-3 -mb-[13px] transition-colors text-sm flex items-center gap-2 ${
            activeTab === "current"
              ? "border-b-2 border-amber-600 text-amber-800"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          {isIndo ? "Shift Kasir Saat Ini" : "Current Shift"}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`font-semibold pb-3 -mb-[13px] transition-colors text-sm flex items-center gap-2 ${
            activeTab === "history"
              ? "border-b-2 border-amber-600 text-amber-800"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <History className="w-4 h-4" />
          {isIndo ? "Riwayat Shift" : "Shift History"}
        </button>
      </div>

      {activeTab === "current" && (
        <div className="max-w-4xl">
          {!currentShift ? (
            <div className="bg-white rounded-3xl shadow-coffee border border-stone-200/80 p-8 sm:p-10">
              {isReadOnly ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-stone-800 mb-2">
                    Tidak Ada Shift Aktif
                  </h2>
                  <p className="text-stone-500 text-sm max-w-sm mx-auto">
                    Saat ini tidak ada sesi kasir yang sedang berjalan. Kasir bertugas dapat
                    membuka shift baru.
                  </p>
                </div>
              ) : isKasir && globalOpenShift ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-coffee-sm">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-stone-800 mb-2">
                    Ada Shift yang Sedang Berjalan
                  </h2>
                  <p className="text-stone-500 text-sm max-w-sm mx-auto">
                    Kasir lain sedang dalam shift aktif. Shift baru hanya bisa dibuka setelah shift sebelumnya ditutup.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-amber-100/80 text-amber-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-coffee-sm">
                      <Play className="w-8 h-8 ml-1" />
                    </div>
                    <h2 className="text-2xl font-bold text-stone-900 tracking-tight mb-2">
                      {isIndo ? "Buka Sesi Kasir (Mulai Shift)" : "Start Cashier Shift"}
                    </h2>
                    <p className="text-stone-500 text-sm max-w-md mx-auto">
                      {isIndo
                        ? "Pilih laci kas dan masukkan jumlah modal uang tunai awal untuk memulai transaksi penjualan."
                        : "Select cash drawer and input starting cash amount to begin transactions."}
                    </p>
                  </div>
                  <form
                    onSubmit={handleOpenShift}
                    className="max-w-md mx-auto space-y-5"
                  >
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        {isIndo
                          ? "Pilih Laci Kasir (Pos Kas)"
                          : "Select Cash Drawer"}
                      </label>
                      {cashOnlyAccounts.length === 0 ? (
                        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 text-sm">
                          {isIndo
                            ? "Anda belum memiliki Pos Kas berjenis Tunai. Buat di menu Keuangan > Arus Kas."
                            : "You do not have any Cash Accounts of type CASH. Create one in Finance > Cash Flow."}
                        </div>
                      ) : (
                        <select
                          required
                          value={selectedCashAccountId}
                          onChange={(e) =>
                            setSelectedCashAccountId(e.target.value)
                          }
                          className="w-full px-4 py-3 border border-stone-200 rounded-2xl focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all font-medium bg-stone-50/50"
                        >
                          <option value="" disabled>
                            {isIndo ? "Pilih Pos Kas..." : "Select account..."}
                          </option>
                          {cashOnlyAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        {isIndo ? "Modal Awal Tunai di Laci" : "Starting Cash"}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={startingCashInput}
                          onChange={(e) =>
                            setStartingCashInput(
                              formatNumberInput(e.target.value),
                            )
                          }
                          className="w-full pl-12 pr-4 py-3.5 border border-stone-200 rounded-2xl focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10 outline-none text-xl font-bold font-mono text-stone-900 transition-all bg-stone-50/50"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-[#241813] hover:bg-[#1b130f] text-white font-bold rounded-2xl shadow-coffee transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
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
                className="bg-white rounded-3xl shadow-coffee border border-stone-200/80 overflow-hidden"
              >
                <div className="p-6 border-b border-stone-200/70 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4 bg-stone-50/80 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </div>
                      <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                        {isIndo ? "Shift Kasir Sedang Berjalan" : "Active Shift"}
                      </h2>
                    </div>
                    <p className="text-xs text-stone-500 flex items-center gap-1.5 mt-1 font-medium mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      {isIndo ? "Dimulai pada" : "Started at"}{" "}
                      {new Date(currentShift.startTime).toLocaleTimeString(
                        "id-ID",
                        { hour: "2-digit", minute: "2-digit" },
                      )}{" "}
                      (
                      {new Date(currentShift.startTime).toLocaleDateString(
                        "id-ID",
                      )}
                      )
                    </p>
                    <p className="text-xs font-semibold text-stone-700 bg-white inline-block px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs">
                      Laci Kasir:{" "}
                      <span className="font-bold text-stone-900">
                        {cashAccounts.find(
                          (a) => a.id === currentShift.cashAccountId,
                        )?.name || "Unknown"}
                      </span>
                    </p>
                  </div>
                  <div className="relative z-10 px-3.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full shadow-2xs">
                    ACTIVE SHIFT
                  </div>
                </div>

                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 sm:p-5 bg-white shadow-coffee-sm rounded-2xl border border-stone-200/80 flex flex-col justify-between">
                    <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                      {isIndo ? "Modal Awal" : "Starting Cash"}
                    </p>
                    <p className="text-xl font-bold font-mono text-stone-900">
                      {formatCurrency(currentShift.startingCash)}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-amber-50/70 shadow-coffee-sm rounded-2xl border border-amber-200/70 flex flex-col justify-between group">
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-2">
                      {isIndo ? "Penjualan" : "Sales"}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-bold font-mono text-amber-950">
                        +{formatCurrency(totalSales)}
                      </p>
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 bg-emerald-50/70 shadow-coffee-sm rounded-2xl border border-emerald-200/70 flex flex-col justify-between group">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2">
                      {isIndo ? "Kas Masuk" : "Cash In"}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-bold font-mono text-emerald-950">
                        +{formatCurrency(totalCashIn)}
                      </p>
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 bg-rose-50/70 shadow-coffee-sm rounded-2xl border border-rose-200/70 flex flex-col justify-between group">
                    <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-2">
                      {isIndo ? "Kas Keluar" : "Cash Out"}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-bold font-mono text-rose-950">
                        -{formatCurrency(totalCashOut)}
                      </p>
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    </div>
                  </div>
                </div>

                {/* Hero Expected Cash Drawer in Deep Roast Espresso */}
                <div className="p-6 bg-gradient-to-r from-[#1c130e] via-[#241813] to-[#2c1d17] text-white flex justify-between items-center relative overflow-hidden rounded-b-3xl border-t border-[#3a281f]">
                  <div className="relative z-10">
                    <p className="text-amber-200/70 text-xs font-bold uppercase tracking-wider mb-1">
                      {isIndo
                        ? "Ekspektasi Uang Fisik di Laci Kasir"
                        : "Expected Cash in Drawer"}
                    </p>
                    <p className="text-3xl sm:text-4xl font-black font-mono text-amber-400 drop-shadow-sm">
                      {formatCurrency(expectedEndingCash)}
                    </p>
                  </div>
                  <DollarSign className="w-14 h-14 text-white/10 relative z-10" />
                </div>
              </motion.div>

              {/* Close Shift Form — only for staff who can modify */}
              {!isReadOnly && (
                <div className="bg-white rounded-3xl shadow-coffee border border-stone-200/80 p-6 sm:p-7">
                  <h3 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
                    <Square className="w-4 h-4 text-rose-600 fill-current" />
                    {isIndo ? "Tutup Shift & Rekonsiliasi Laci" : "Close Shift & Drawer Reconciliation"}
                  </h3>
                  <form
                    onSubmit={handleCloseShift}
                    className="space-y-4 max-w-md"
                  >
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        {isIndo
                          ? "Total Hitungan Fisik Uang di Laci"
                          : "Actual Cash Counted in Drawer"}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={endingCashInput}
                          onChange={(e) =>
                            setEndingCashInput(
                              formatNumberInput(e.target.value),
                            )
                          }
                          className="w-full pl-12 pr-4 py-3.5 border border-stone-200 rounded-2xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-xl font-bold font-mono text-stone-900 transition-all bg-stone-50/50"
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
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-coffee transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
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

      {activeTab === "history" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Chart Section */}
          {pastShifts.length > 0 && (
            <div className="bg-white rounded-3xl shadow-coffee border border-stone-200/80 p-6 sm:p-7">
              <h3 className="font-bold text-stone-900 mb-6 flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-amber-700" />
                {isIndo
                  ? "Tren Total Kas (7 Shift Terakhir)"
                  : "Cash Trend (Last 7 Shifts)"}
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={shiftChartData}
                    margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1ece6"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#78716c", fontSize: 11, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a8a29e", fontSize: 11 }}
                      tickFormatter={(value) => `Rp ${value / 1000}k`}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "#fbf9f5" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "1px solid #ede4d8",
                        boxShadow: "0 10px 25px -5px rgba(44, 29, 23, 0.08)",
                        backgroundColor: "#ffffff",
                      }}
                      formatter={(value: number) => [
                        formatCurrency(value),
                        "Total Kas",
                      ]}
                    />
                    <Bar dataKey="kas" radius={[8, 8, 0, 0]}>
                      {shiftChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isPagi ? "#c27803" : "#2c1d17"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="bg-white rounded-3xl shadow-coffee border border-stone-200/80 overflow-hidden">
            <div className="p-5 border-b border-stone-200/60 bg-stone-50/70 flex justify-between items-center">
              <h3 className="font-bold text-stone-900 text-sm">
                {isIndo
                  ? "Riwayat Rekonsiliasi Shift"
                  : "Shift Reconciliation History"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200/60">
                <thead className="bg-stone-50/40">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                      {isIndo ? "Waktu Buka" : "Started"}
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                      {isIndo ? "Waktu Tutup" : "Ended"}
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                      {isIndo ? "Modal Awal" : "Starting"}
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                      {isIndo ? "Ekspektasi" : "Expected"}
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                      {isIndo ? "Aktual" : "Actual"}
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                      {isIndo ? "Selisih" : "Difference"}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-100 font-mono">
                  {pastShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-stone-600 font-sans">
                        {new Date(shift.startTime).toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-stone-600 font-sans">
                        {shift.endTime
                          ? new Date(shift.endTime).toLocaleString("id-ID")
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-medium text-stone-700">
                        {formatCurrency(shift.startingCash)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-medium text-stone-700">
                        {shift.expectedEndingCash != null
                          ? formatCurrency(shift.expectedEndingCash)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-right font-bold text-stone-900">
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
                                  : "bg-stone-100 text-stone-700"
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
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-stone-400 text-xs font-sans"
                      >
                        {isIndo
                          ? "Belum ada riwayat shift"
                          : "No shift history"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
