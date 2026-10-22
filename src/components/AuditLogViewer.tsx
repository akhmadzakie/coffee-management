import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import {
  Search,
  Shield,
  PlusCircle,
  Edit3,
  Trash2,
  Calendar,
  CalendarDays,
  Database,
  User as UserIcon,
  Filter,
  X,
  Layers,
} from "lucide-react";
import { motion } from "motion/react";
import { getLocalDateString } from "../utils/dateUtils";
import { CustomDatePicker } from "./common/CustomDatePicker";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomSelect } from "./common/CustomSelect";

const TABLE_LABELS: Record<string, string> = {
  users: "Pengguna & PIN",
  employees: "Data Karyawan",
  contracts: "Kontrak Kerja",
  attendances: "Presensi",
  daily_attendances: "Presensi Harian",
  kpi_records: "Nilai KPI",
  cash_accounts: "Akun Kas / Bank",
  cash_transactions: "Buku Kas / Transaksi",
  ingredients: "Bahan Baku",
  recipes: "Resep Menu",
  products: "Katalog Produk",
  batch_preparations: "Batch Cook",
  batch_cook: "Batch Cook",
  suppliers: "Pemasok / Supplier",
  purchase_orders: "Pembelian (PO)",
  shifts: "Shift Kasir",
  sales_transactions: "Transaksi Penjualan",
  daily_checklists: "Checklist Supervisi",
};

type DateFilterType =
  | "ALL"
  | "TODAY"
  | "YESTERDAY"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "CUSTOM_DAY"
  | "CUSTOM_MONTH";

export const AuditLogViewer = () => {
  const { auditLogs, users } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedTable, setSelectedTable] = useState<string>("ALL");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("ALL");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Daftar tabel unik yang tercatat di audit logs
  const availableTables = useMemo(() => {
    const tableSet = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.tableName) tableSet.add(l.tableName);
    });
    return Array.from(tableSet);
  }, [auditLogs]);

  const moduleOptions = useMemo(() => {
    return [
      { value: "ALL", label: "Semua Modul / Tabel" },
      ...availableTables.map((tbl) => ({
        value: tbl,
        label: TABLE_LABELS[tbl] || tbl,
      })),
    ];
  }, [availableTables]);

  // Label periode saat ini untuk kejelasan konteks pengguna
  const activePeriodLabel = useMemo(() => {
    const now = new Date();

    if (dateFilterType === "ALL") return "Semua Waktu";
    if (dateFilterType === "TODAY") {
      return `Hari Ini (${now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`;
    }
    if (dateFilterType === "YESTERDAY") {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      return `Kemarin (${yest.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`;
    }
    if (dateFilterType === "THIS_MONTH") {
      return `Bulan Ini (${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })})`;
    }
    if (dateFilterType === "LAST_MONTH") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `Bulan Lalu (${lastMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })})`;
    }
    if (dateFilterType === "CUSTOM_DAY" && selectedDay) {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const dayDate = new Date(y, m - 1, d);
      return `Hari: ${dayDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
    }
    if (dateFilterType === "CUSTOM_MONTH" && selectedMonth) {
      const [y, m] = selectedMonth.split("-").map(Number);
      const monthDate = new Date(y, m - 1, 1);
      return `Bulan: ${monthDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;
    }
    return "Filter Kustom";
  }, [dateFilterType, selectedDay, selectedMonth]);

  // 1. Filter logs berdasarkan tanggal / hari / bulan
  const dateFilteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const yestDate = new Date(now);
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = getLocalDateString(yestDate);
    const thisMonthPrefix = todayStr.slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = getLocalDateString(lastMonthDate).slice(0, 7);

    return auditLogs.filter((log) => {
      if (dateFilterType === "ALL") return true;

      const logDate = new Date(log.timestamp);
      const logDateStr = getLocalDateString(logDate);
      const logMonthStr = logDateStr.slice(0, 7);

      if (dateFilterType === "TODAY") return logDateStr === todayStr;
      if (dateFilterType === "YESTERDAY") return logDateStr === yestStr;
      if (dateFilterType === "THIS_MONTH") return logMonthStr === thisMonthPrefix;
      if (dateFilterType === "LAST_MONTH") return logMonthStr === lastMonthPrefix;
      if (dateFilterType === "CUSTOM_DAY") return selectedDay ? logDateStr === selectedDay : true;
      if (dateFilterType === "CUSTOM_MONTH") return selectedMonth ? logMonthStr === selectedMonth : true;

      return true;
    });
  }, [auditLogs, dateFilterType, selectedDay, selectedMonth]);

  // 2. Summary Metrics (dihitung dinamis dari periode yang sedang dipilih)
  const stats = useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    dateFilteredLogs.forEach((log) => {
      if (log.action === "CREATE") creates++;
      else if (log.action === "UPDATE") updates++;
      else if (log.action === "DELETE") deletes++;
    });
    return {
      total: dateFilteredLogs.length,
      allTimeTotal: auditLogs.length,
      creates,
      updates,
      deletes,
    };
  }, [dateFilteredLogs, auditLogs.length]);

  // 3. Filter akhir (berdasarkan aksi, modul/tabel, dan pencarian kata kunci)
  const filteredLogs = useMemo(() => {
    return dateFilteredLogs
      .filter((log) => {
        const user = users.find((u) => u.id === log.userId);

        // Filter Aksi
        if (selectedAction !== "ALL" && log.action !== selectedAction) {
          return false;
        }

        // Filter Modul / Tabel
        if (selectedTable !== "ALL" && log.tableName !== selectedTable) {
          return false;
        }

        // Pencarian Kata Kunci
        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase();
        const friendlyTable = TABLE_LABELS[log.tableName] || log.tableName;

        return (
          log.tableName.toLowerCase().includes(term) ||
          friendlyTable.toLowerCase().includes(term) ||
          log.action.toLowerCase().includes(term) ||
          (log.recordId && log.recordId.toLowerCase().includes(term)) ||
          (user?.name && user.name.toLowerCase().includes(term)) ||
          (user?.username && user.username.toLowerCase().includes(term)) ||
          (user?.role && user.role.toLowerCase().includes(term))
        );
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [dateFilteredLogs, users, selectedAction, selectedTable, searchTerm]);

  const hasActiveFilters =
    dateFilterType !== "ALL" ||
    selectedTable !== "ALL" ||
    selectedAction !== "ALL" ||
    searchTerm !== "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 text-brand-700 rounded-2xl border border-brand-200/80 shadow-2xs">
            <Shield className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Audit Log Aktivitas
            </h1>
            <p className="text-xs text-slate-500">
              Catatan jejak aktivitas teknis & manajerial seluruh pengguna di sistem Julia's
            </p>
          </div>
        </div>

        {/* Periode Saat Ini Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700">
          <CalendarDays className="w-4 h-4 text-brand-600 shrink-0" />
          <span>Periode: <strong className="text-slate-900">{activePeriodLabel}</strong></span>
        </div>
      </div>

      {/* ─── FILTER PERIODE (HARI & BULAN) ─── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-brand-600" />
              Pilih Periode:
            </span>
            {[
              { id: "ALL", label: "Semua Waktu" },
              { id: "TODAY", label: "Hari Ini" },
              { id: "YESTERDAY", label: "Kemarin" },
              { id: "THIS_MONTH", label: "Bulan Ini" },
              { id: "LAST_MONTH", label: "Bulan Lalu" },
            ].map((p) => {
              const isActive = dateFilterType === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setDateFilterType(p.id as DateFilterType);
                    setSelectedDay("");
                    setSelectedMonth("");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-brand-600 text-white shadow-xs font-bold"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setDateFilterType("ALL");
                setSelectedDay("");
                setSelectedMonth("");
                setSelectedTable("ALL");
                setSelectedAction("ALL");
                setSearchTerm("");
              }}
              className="self-start lg:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>

        {/* Custom Day / Month Pickers & Module Filter Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
          {/* Filter Hari Spesifik */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-2xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold whitespace-nowrap pl-1">Hari:</span>
            <CustomDatePicker
              value={selectedDay}
              onChange={(val) => {
                setSelectedDay(val);
                if (val) {
                  setDateFilterType("CUSTOM_DAY");
                  setSelectedMonth("");
                } else {
                  setDateFilterType("ALL");
                }
              }}
              placeholder="Pilih Hari"
              buttonClassName="py-1 px-2.5 text-xs border-slate-200 shadow-none bg-white rounded-xl"
            />
          </div>

          {/* Filter Bulan Spesifik */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-2xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold whitespace-nowrap pl-1">Bulan & Tahun:</span>
            <CustomMonthPicker
              value={selectedMonth}
              onChange={(val) => {
                setSelectedMonth(val);
                if (val) {
                  setDateFilterType("CUSTOM_MONTH");
                  setSelectedDay("");
                } else {
                  setDateFilterType("ALL");
                }
              }}
              placeholder="Pilih Bulan"
              buttonClassName="py-1 px-2.5 text-xs border-slate-200 shadow-none bg-white rounded-xl"
            />
          </div>

          {/* Filter Modul / Tabel */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-2xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold whitespace-nowrap pl-1">Modul:</span>
            <CustomSelect
              value={selectedTable}
              onChange={setSelectedTable}
              options={moduleOptions}
              icon={<Layers className="w-3.5 h-3.5" />}
              placeholder="Pilih Modul"
              buttonClassName="py-1 px-2.5 text-xs border-slate-200 shadow-none bg-white rounded-xl max-w-[220px]"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards (Reaktif sesuai Hari/Bulan yang dipilih) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Log ({activePeriodLabel})</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Database className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-emerald-600">Data Ditambah (CREATE)</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{stats.creates}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <PlusCircle className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-amber-600">Data Diubah (UPDATE)</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">{stats.updates}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Edit3 className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-rose-600">Data Dihapus (DELETE)</p>
            <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-1">{stats.deletes}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Aksi:
            </span>
            {[
              { id: "ALL", label: `Semua (${stats.total})` },
              { id: "CREATE", label: `Tambah (${stats.creates})` },
              { id: "UPDATE", label: `Ubah (${stats.updates})` },
              { id: "DELETE", label: `Hapus (${stats.deletes})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedAction(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedAction === tab.id
                    ? "bg-brand-600 text-white shadow-xs font-bold"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pengguna, tabel, aksi, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 w-full bg-white shadow-2xs"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Waktu Kejadian</th>
                <th className="p-3.5">Pengguna / Pelaku</th>
                <th className="p-3.5">Jenis Aksi</th>
                <th className="p-3.5">Modul / Tabel</th>
                <th className="p-3.5">ID Referensi Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const user = users.find((u) => u.id === log.userId);
                const friendlyTable = TABLE_LABELS[log.tableName] || log.tableName;

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-3.5 text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {new Date(log.timestamp).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {user?.name ? user.name.slice(0, 1) : <UserIcon className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {user?.name || "Sistem / Otomatis"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {user?.role ? `@${user.username} (${user.role})` : "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          log.action === "CREATE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : log.action === "UPDATE"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : log.action === "DELETE"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {log.action === "CREATE" && <PlusCircle className="w-3 h-3" />}
                        {log.action === "UPDATE" && <Edit3 className="w-3 h-3" />}
                        {log.action === "DELETE" && <Trash2 className="w-3 h-3" />}
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800">{friendlyTable}</div>
                      <div className="text-[10px] font-mono text-slate-400">{log.tableName}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 select-all">
                        {log.recordId || "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-sm text-slate-700">Tidak ada catatan aktivitas ditemukan</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {hasActiveFilters
                        ? "Tidak ada data yang cocok dengan filter tanggal/modul/aksi yang dipilih. Coba reset filter."
                        : "Semua riwayat perubahan data akan tercatat otomatis di sini"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 px-4 gap-2">
          <span>Menampilkan <strong>{filteredLogs.length}</strong> log ({activePeriodLabel})</span>
          <span className="text-[11px] text-slate-400">Tersinkronisasi otomatis dengan PostgreSQL & Database Julia's</span>
        </div>
      </div>
    </div>
  );
};
