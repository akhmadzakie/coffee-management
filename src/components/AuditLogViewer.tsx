import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import {
  Search,
  Shield,
  PlusCircle,
  Edit3,
  Trash2,
  Calendar,
  Database,
  User as UserIcon,
  Filter,
} from "lucide-react";
import { motion } from "motion/react";

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

export const AuditLogViewer = () => {
  const { auditLogs, users } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");

  // Summary Metrics
  const stats = useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    auditLogs.forEach((log) => {
      if (log.action === "CREATE") creates++;
      else if (log.action === "UPDATE") updates++;
      else if (log.action === "DELETE") deletes++;
    });
    return {
      total: auditLogs.length,
      creates,
      updates,
      deletes,
    };
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter((log) => {
        const user = users.find((u) => u.id === log.userId);
        const matchesAction =
          selectedAction === "ALL" || log.action === selectedAction;

        if (!matchesAction) return false;

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
  }, [auditLogs, users, searchTerm, selectedAction]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 text-brand-700 rounded-xl border border-brand-100 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Audit Log Aktivitas
            </h1>
            <p className="text-xs text-slate-500">
              Catatan jejak aktivitas teknis & manajerial seluruh pengguna di sistem Julia's
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Total Log Aktivitas</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Database className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-emerald-600">Data Ditambah (CREATE)</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.creates}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <PlusCircle className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-amber-600">Data Diubah (UPDATE)</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{stats.updates}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Edit3 className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-rose-600">Data Dihapus (DELETE)</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{stats.deletes}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Trash2 className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Filter:
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  selectedAction === tab.id
                    ? "bg-brand-600 text-white shadow-sm font-semibold"
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
              placeholder="Cari pengguna, tabel, aksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 w-full bg-white shadow-xs"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
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
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                    <p className="font-medium text-sm text-slate-600">Tidak ada catatan aktivitas ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchTerm ? "Coba ubah kata kunci pencarian Anda" : "Semua riwayat perubahan data akan tercatat otomatis di sini"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 px-4">
          <span>Menampilkan {filteredLogs.length} dari total {stats.total} catatan</span>
          <span className="text-[11px] text-slate-400">Tersinkronisasi otomatis dengan PostgreSQL</span>
        </div>
      </div>
    </div>
  );
};
