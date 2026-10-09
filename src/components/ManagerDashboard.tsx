import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { ViewState, DailyAttendance } from "../types";
import {
  Users,
  Clock,
  Coffee,
  ClipboardCheck,
  AlertTriangle,
  Package,
  TrendingUp,
  MapPin,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  UserCheck,
  Eye,
  X,
  ExternalLink,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ManagerDashboardProps {
  onNavigate: (view: ViewState) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ onNavigate }) => {
  const {
    shifts,
    users,
    employees,
    contracts,
    dailyAttendances,
    dailyChecklists,
    ingredients,
    salesTransactions,
    purchaseOrders,
    updateDailyAttendance,
  } = useStore();

  const [selectedAttendancePhoto, setSelectedAttendancePhoto] = useState<DailyAttendance | null>(null);

  // Tanggal hari ini YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Shift Kasir Hari Ini
  const activeShift = shifts.find((s) => s.status === "OPEN");
  const cashierUser = activeShift ? users.find((u) => u.id === activeShift.userId) : null;

  // Total penjualan shift aktif
  const activeShiftSales = useMemo(() => {
    if (!activeShift) return 0;
    const start = new Date(activeShift.startTime).getTime();
    return salesTransactions
      .filter((t) => new Date(t.date).getTime() >= start)
      .reduce((sum, t) => sum + t.totalPrice, 0);
  }, [activeShift, salesTransactions]);

  // Absensi Hari Ini
  const todayAttendances = useMemo(() => {
    return dailyAttendances.filter((a) => a.date === todayStr);
  }, [dailyAttendances, todayStr]);

  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === "AKTIF");
  }, [employees]);

  // Statistik Kehadiran Hari Ini
  const attendanceStats = useMemo(() => {
    const hadir = todayAttendances.filter((a) => a.status === "HADIR").length;
    const terlambat = todayAttendances.filter((a) => a.status === "TERLAMBAT").length;
    const izinSakit = todayAttendances.filter((a) => a.status === "IZIN" || a.status === "SAKIT").length;
    const belumHadir = Math.max(0, activeEmployees.length - (hadir + terlambat + izinSakit));

    return { hadir, terlambat, izinSakit, belumHadir, total: activeEmployees.length };
  }, [todayAttendances, activeEmployees]);

  // Checklist Jobdesk Divisi Hari Ini
  const divisionChecklists = useMemo(() => {
    const todayChecklists = dailyChecklists.filter((c) => c.date === todayStr);

    const divisions = [
      { id: "BAR", name: "Barista (Bar Station)", dept: "BAR" },
      { id: "KITCHEN", name: "Kitchen (Dapur)", dept: "KITCHEN" },
      { id: "BAKER", name: "Baker & Pastry", dept: "MAIN" },
      { id: "KASIR", name: "Kasir & Kas Depan", dept: "MAIN" },
    ];

    return divisions.map((div) => {
      // Cari checklist staf di divisi ini
      const empInDiv = activeEmployees.filter((e) => {
        if (div.id === "BAR") return e.position.toLowerCase().includes("bar") || e.department === "BAR";
        if (div.id === "KITCHEN") return e.position.toLowerCase().includes("kitchen") || e.department === "KITCHEN";
        if (div.id === "BAKER") return e.position.toLowerCase().includes("bake") || e.position.toLowerCase().includes("pastry");
        return e.position.toLowerCase().includes("kasir");
      });

      const checklists = todayChecklists.filter((c) => empInDiv.some((e) => e.id === c.employeeId));

      const totalItems = checklists.reduce((acc, c) => {
        let count = 2; // cleaningDone + equipmentChecked
        if (c.leaderTasks) count += c.leaderTasks.length;
        return acc + count;
      }, 0);

      const completedItems = checklists.reduce((acc, c) => {
        let count = 0;
        if (c.cleaningDone) count++;
        if (c.equipmentChecked) count++;
        if (c.leaderTasks) count += c.leaderTasks.length;
        return acc + count;
      }, 0);

      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : checklists.length > 0 ? 100 : 0;

      return {
        ...div,
        staffCount: empInDiv.length,
        submittedCount: checklists.length,
        progress,
      };
    });
  }, [dailyChecklists, todayStr, activeEmployees]);

  // Stok Kritis / Menipis
  const lowStockIngredients = useMemo(() => {
    return ingredients
      .filter((i) => i.currentStock <= i.minStock)
      .sort((a, b) => a.currentStock / (a.minStock || 1) - b.currentStock / (b.minStock || 1));
  }, [ingredients]);

  // Kontrak Karyawan yang Hampir Habis / Kedaluwarsa
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(todayDate.getDate() + 30);

  const expiringContracts = useMemo(() => {
    return contracts.filter((c) => {
      const emp = employees.find((e) => e.id === c.employeeId);
      if (!emp || emp.status !== "AKTIF" || c.status !== "ACTIVE" || !c.endDate) return false;
      const end = new Date(c.endDate);
      return end >= todayDate && end <= thirtyDaysLater;
    });
  }, [contracts, employees]);

  const expiredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const emp = employees.find((e) => e.id === c.employeeId);
      if (!emp || emp.status !== "AKTIF" || c.status !== "ACTIVE" || !c.endDate) return false;
      const end = new Date(c.endDate);
      return end < todayDate;
    });
  }, [contracts, employees]);

  // Top 5 Produk Terlaris Hari Ini
  const bestSellersToday = useMemo(() => {
    const todaySales = salesTransactions.filter((s) => s.date.startsWith(todayStr));
    const counts: Record<string, number> = {};
    todaySales.forEach((s) => {
      counts[s.menuName] = (counts[s.menuName] || 0) + s.quantitySold;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
  }, [salesTransactions, todayStr]);

  // Purchase Orders Pending Delivery
  const pendingDeliveries = useMemo(() => {
    return purchaseOrders.filter((po) => po.deliveryStatus === "PENDING");
  }, [purchaseOrders]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 uppercase border border-amber-200">
              Operational Command Center
            </span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Dashboard Operasional Manajer
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Pantau sesi kasir, kehadiran selfie staf, progres checklist jobdesk divisi, dan stok bahan baku toko.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2 text-xs font-semibold text-stone-700 shadow-2xs">
          <Clock className="w-4 h-4 text-amber-700" />
          <span>
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* HR Alert Banners if any */}
      {(expiredContracts.length > 0 || expiringContracts.length > 0) && (
        <div className="space-y-2">
          {expiredContracts.length > 0 && (
            <div className="p-4 bg-rose-50/80 border border-rose-200/80 rounded-2xl flex items-center justify-between text-xs text-rose-900 shadow-coffee-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Perhatian Manajer:</strong> {expiredContracts.length} karyawan kontraknya telah kedaluwarsa namun masih berstatus aktif.
                </span>
              </div>
              <button
                onClick={() => onNavigate("hr")}
                className="font-bold underline hover:text-rose-700 shrink-0 ml-2"
              >
                Perbarui Kontrak
              </button>
            </div>
          )}
          {expiringContracts.length > 0 && (
            <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-coffee-sm">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Pengingat:</strong> {expiringContracts.length} kontrak karyawan akan habis dalam 30 hari ke depan.
                </span>
              </div>
              <button
                onClick={() => onNavigate("hr")}
                className="font-bold underline hover:text-amber-700 shrink-0 ml-2"
              >
                Lihat HR
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Operational Section: Kasir & Absensi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sesi Kasir & Shift Hari Ini */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-700" />
                Status Shift Kasir Toko
              </h2>
              {activeShift ? (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  KASIR BUKA
                </span>
              ) : (
                <span className="px-3 py-1 bg-stone-100 text-stone-600 border border-stone-200 text-xs font-bold rounded-full">
                  SHIFT DITUTUP
                </span>
              )}
            </div>

            {activeShift ? (
              <div className="space-y-4">
                <div className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/60">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-stone-500">Kasir Bertugas:</span>
                    <span className="font-bold text-stone-900 text-sm">
                      {cashierUser?.name || "Kasir"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500">Waktu Mulai Shift:</span>
                    <span className="font-semibold text-stone-700">
                      {new Date(activeShift.startTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
                    <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      Modal Awal Laci
                    </p>
                    <p className="text-lg font-bold font-mono text-stone-900">
                      {formatCurrency(activeShift.startingCash)}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/70 shadow-2xs">
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                      Penjualan Shift Ini
                    </p>
                    <p className="text-lg font-bold font-mono text-amber-950">
                      +{formatCurrency(activeShiftSales)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                <Clock className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-700">Belum Ada Shift Kasir Berjalan</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Laci kasir belum dibuka oleh kasir bertugas hari ini.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate("shifts")}
            className="w-full mt-5 py-3 rounded-2xl bg-[#241813] hover:bg-[#1b130f] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-coffee-sm"
          >
            Kelola Shift & Laci Kasir <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Kehadiran Staf Hari Ini (Live Attendance) */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-700" />
                Kehadiran Staf Hari Ini
              </h2>
              <span className="text-xs font-semibold text-stone-500">
                Total: {attendanceStats.total} Karyawan
              </span>
            </div>

            {/* Metric Bars */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/70 text-center">
                <p className="text-lg font-black font-mono text-emerald-800">{attendanceStats.hadir}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Hadir</p>
              </div>
              <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/70 text-center">
                <p className="text-lg font-black font-mono text-amber-800">{attendanceStats.terlambat}</p>
                <p className="text-[10px] font-bold text-amber-700 uppercase">Telat</p>
              </div>
              <div className="p-3 bg-sky-50/80 rounded-2xl border border-sky-200/70 text-center">
                <p className="text-lg font-black font-mono text-sky-800">{attendanceStats.izinSakit}</p>
                <p className="text-[10px] font-bold text-sky-700 uppercase">Izin/Sakit</p>
              </div>
              <div className="p-3 bg-stone-100/80 rounded-2xl border border-stone-200 text-center">
                <p className="text-lg font-black font-mono text-stone-700">{attendanceStats.belumHadir}</p>
                <p className="text-[10px] font-bold text-stone-500 uppercase">Belum</p>
              </div>
            </div>

            {/* List Absensi Terbaru dengan Tombol Preview Foto Selfie */}
            <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
              {todayAttendances.map((att) => {
                const emp = employees.find((e) => e.id === att.employeeId);
                const hasPhoto = Boolean(att.clockInPhotoUrl || att.clockOutPhotoUrl);
                const hasLocation = Boolean(att.clockInLocation);

                return (
                  <div
                    key={att.id}
                    className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                        {emp?.name.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{emp?.name}</p>
                        <p className="text-[10px] text-stone-500">
                          {att.clockInTime
                            ? `Clock in: ${new Date(att.clockInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                            : att.notes || "Tidak hadir"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          att.status === "HADIR"
                            ? "bg-emerald-100 text-emerald-800"
                            : att.status === "TERLAMBAT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {att.status}
                      </span>

                      {hasPhoto && (
                        <button
                          onClick={() => setSelectedAttendancePhoto(att)}
                          title="Lihat Foto Selfie & GPS Staf"
                          className="p-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 shadow-2xs transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-800" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {todayAttendances.length === 0 && (
                <div className="py-6 text-center text-xs text-stone-400">
                  Belum ada catatan absensi yang masuk hari ini.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate("hr")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            Buka Rekap Absensi Seluruh Karyawan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progres Checklist Jobdesk Divisi & Peringatan Bahan Menipis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checklist Jobdesk Divisi Hari Ini */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-700" />
                Progres Checklist Jobdesk Divisi
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Evaluasi penyelesaian tugas operasional harian tiap tim.
              </p>
            </div>
            <button
              onClick={() => onNavigate("leader_checklist")}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1"
            >
              Buka Checklist <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {divisionChecklists.map((div) => (
              <div key={div.id} className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/60">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-xs font-bold text-stone-800">{div.name}</p>
                    <p className="text-[10px] text-stone-500">
                      {div.submittedCount} checklist tercatat ({div.staffCount} personil)
                    </p>
                  </div>
                  <span className="text-xs font-black font-mono text-stone-900">
                    {div.progress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      div.progress === 100
                        ? "bg-emerald-600"
                        : div.progress > 50
                          ? "bg-amber-600"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${div.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peringatan Stok Kritis & PO Bahan Baku */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Peringatan Bahan Baku Menipis
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Bahan baku di bawah batas aman yang perlu segera dipesan ulang.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                {lowStockIngredients.length} Kritis
              </span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {lowStockIngredients.slice(0, 5).map((ing) => (
                <div
                  key={ing.id}
                  className="p-3 rounded-2xl bg-rose-50/50 border border-rose-200/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-stone-900">{ing.name}</p>
                    <p className="text-[10px] text-stone-500">
                      Batas Aman: {ing.minStock} {ing.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold font-mono text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-lg">
                      Sisa: {ing.currentStock} {ing.unit}
                    </span>
                  </div>
                </div>
              ))}

              {lowStockIngredients.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  Semua stok bahan baku saat ini berada di atas batas minimum aman.
                </div>
              )}
            </div>

            {pendingDeliveries.length > 0 && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-900 flex items-center justify-between">
                <span>Ada <strong>{pendingDeliveries.length} Purchase Order</strong> menunggu penerimaan barang.</span>
                <button
                  onClick={() => onNavigate("purchases")}
                  className="font-bold underline hover:text-amber-950 shrink-0 ml-2"
                >
                  Cek PO
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate("inventory")}
            className="w-full mt-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            Buka Inventori & Order Bahan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Snapshot Menu Terlaris Hari Ini */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-700" />
              Menu Terlaris Hari Ini (Best Sellers)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Menu yang paling banyak terjual oleh kasir hari ini.
            </p>
          </div>
          <button
            onClick={() => onNavigate("import_sales")}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1"
          >
            Lihat Semua Penjualan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {bestSellersToday.map((item, idx) => (
            <div
              key={item.name}
              className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                  #{idx + 1}
                </span>
                <p className="text-xs font-bold text-stone-900 mt-2 truncate">{item.name}</p>
              </div>
              <p className="text-lg font-black font-mono text-amber-950 mt-2">
                {item.qty} <span className="text-xs font-normal text-stone-500">cup/porsi</span>
              </p>
            </div>
          ))}

          {bestSellersToday.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-stone-400">
              Belum ada data transaksi penjualan yang tercatat hari ini.
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview Foto Selfie & Verifikasi Lokasi GPS Absensi */}
      <AnimatePresence>
        {selectedAttendancePhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-coffee-lg border border-stone-200"
            >
              <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-700" />
                  <h3 className="font-bold text-stone-900 text-sm">
                    Verifikasi Bukti Kehadiran Staf
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAttendancePhoto(null)}
                  className="p-1.5 rounded-full hover:bg-stone-200/60 text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Employee Details */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-900">
                      {employees.find((e) => e.id === selectedAttendancePhoto.employeeId)?.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      Tanggal: {selectedAttendancePhoto.date} · Status:{" "}
                      <span className="font-bold text-amber-800">{selectedAttendancePhoto.status}</span>
                    </p>
                  </div>
                </div>

                {/* Selfie Photo Preview */}
                <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 aspect-4/3 relative flex items-center justify-center">
                  {selectedAttendancePhoto.clockInPhotoUrl ? (
                    <img
                      src={selectedAttendancePhoto.clockInPhotoUrl}
                      alt="Selfie Kehadiran"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-stone-400 text-xs">
                      <Camera className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      Tidak ada foto selfie tersimpan
                    </div>
                  )}
                </div>

                {/* GPS Location & Coordinate Info */}
                {selectedAttendancePhoto.clockInLocation ? (
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-stone-700">
                      <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <p className="font-bold">Koordinat GPS:</p>
                        <p className="font-mono text-[11px] text-stone-500">
                          {selectedAttendancePhoto.clockInLocation.lat.toFixed(6)},{" "}
                          {selectedAttendancePhoto.clockInLocation.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedAttendancePhoto.clockInLocation.lat},${selectedAttendancePhoto.clockInLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-900 underline"
                    >
                      Buka Peta <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 text-center italic">
                    Koordinat GPS tidak terekam pada sesi absensi ini.
                  </p>
                )}

                {/* Approval Action */}
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      updateDailyAttendance({
                        ...selectedAttendancePhoto,
                        approvalStatus: "APPROVED",
                      });
                      setSelectedAttendancePhoto(null);
                    }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-coffee-sm"
                  >
                    Verifikasi Hadir (Sah)
                  </button>
                  <button
                    onClick={() => {
                      updateDailyAttendance({
                        ...selectedAttendancePhoto,
                        approvalStatus: "REJECTED",
                      });
                      setSelectedAttendancePhoto(null);
                    }}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl text-xs transition-colors border border-rose-200"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
