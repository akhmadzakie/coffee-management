import React, { useMemo, useState } from "react";
import { useStore } from "../store/StoreContext";
import { ViewState } from "../types";
import { getLocalDateString } from "../utils/dateUtils";
const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
};
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award,
  TrendingUp,
  CheckSquare,
  Camera,
  MapPin,
  Users,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Star,
  Coffee,
  ShieldCheck,
  ClipboardList,
  Info,
  FileText,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { DEFAULT_BAR_CATEGORIES, DEFAULT_KITCHEN_CATEGORIES, DEFAULT_BAKER_CATEGORIES, ensureCategoryArray, normalizeTaskItem } from "./LeaderChecklist";
import { PayrollRecord } from "../types";
import { formatCurrency } from "../utils/format";
import { PayslipModal } from "./PayslipModal";

interface EmployeeDashboardProps {
  onNavigate: (view: ViewState) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigate }) => {
  const {
    currentUser,
    employees,
    dailyAttendances,
    kpiRecords,
    dailyChecklists,
    settings,
    users,
    contracts,
    payrollRecords,
    employeeShifts,
  } = useStore();

  const [showKpiDetails, setShowKpiDetails] = useState(false);
  const [selectedPayslipForEmployee, setSelectedPayslipForEmployee] = useState<PayrollRecord | null>(null);

  // 1. Identify the active employee record matching currentUser
  const activeEmployee = useMemo(() => {
    if (!currentUser) return null;
    return employees.find((e) => e.username === currentUser.username) ||
      employees.find((e) => e.id === currentUser.employeeId) ||
      null;
  }, [employees, currentUser]);

  const activeEmployeeId = currentUser?.employeeId || activeEmployee?.id || currentUser?.id;

  // 2. Dates & Period
  const todayStr = getLocalDateString();
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1; // 1 - 12
  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;

  // Time-based Indonesian greeting
  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  }, [now]);

  // 3. Today's Attendance
  const todayAttendance = useMemo(() => {
    return dailyAttendances.find(
      (a) => a.employeeId === activeEmployeeId && a.date === todayStr
    );
  }, [dailyAttendances, activeEmployeeId, todayStr]);

  const isClockedIn = !!todayAttendance?.clockInTime;
  const isClockedOut = !!todayAttendance?.clockOutTime;

  // 4. Monthly Attendance Stats
  const monthlyLogs = useMemo(() => {
    return dailyAttendances.filter(
      (a) => a.employeeId === activeEmployeeId && a.date.startsWith(currentMonthStr)
    );
  }, [dailyAttendances, activeEmployeeId, currentMonthStr]);

  const monthlyStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let sickLeave = 0;
    let alpha = 0;

    monthlyLogs.forEach((l) => {
      if (l.approvalStatus === "REJECTED" || l.status === "ALPHA" || l.status === "DITOLAK") {
        alpha++;
      } else if (l.status === "HADIR") {
        present++;
      } else if (l.status === "TERLAMBAT") {
        present++;
        late++;
      } else if (l.status === "IZIN" || l.status === "SAKIT") {
        sickLeave++;
      }
    });

    return { present, late, sickLeave, alpha, totalDays: monthlyLogs.length };
  }, [monthlyLogs]);

  // 5. Recent 7 Attendance History
  const recentAttendances = useMemo(() => {
    return [...dailyAttendances]
      .filter((a) => a.employeeId === activeEmployeeId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  }, [dailyAttendances, activeEmployeeId]);

  // 6. Monthly KPI for Current Employee
  const currentKpi = useMemo(() => {
    return kpiRecords.find(
      (k) =>
        k.employeeId === activeEmployeeId &&
        k.month === currentMonthNum &&
        k.year === currentYear
    ) || null;
  }, [kpiRecords, activeEmployeeId, currentMonthNum, currentYear]);

  // 7. LEADER SPECIFIC DATA
  const isLeader = currentUser?.role === "LEADER";

  // Aturan pembagian divisi standar:
  // - KITCHEN: Kitchen, Dapur, Cook
  // - BAKER: Baker, Pastry, Roti
  // - BAR: Barista, Kasir, Beverage, Main (Kasir digabung ke Divisi Bar)
  const getEmployeeDivision = (emp: { department?: string | null; position?: string | null }): "BAR" | "KITCHEN" | "BAKER" => {
    const dept = (emp.department || "").toUpperCase();
    const pos = (emp.position || "").toUpperCase();

    if (dept.includes("KITCHEN") || pos.includes("KITCHEN") || pos.includes("DAPUR") || pos.includes("COOK")) {
      return "KITCHEN";
    }
    if (dept.includes("BAKER") || pos.includes("BAKER") || pos.includes("PASTRY") || pos.includes("ROTI")) {
      return "BAKER";
    }
    return "BAR";
  };

  // Determine Leader Division
  const leaderDivision = useMemo<"BAR" | "KITCHEN" | "BAKER">(() => {
    if (currentUser?.department) {
      const d = currentUser.department.toUpperCase();
      if (d.includes("KITCHEN") || d.includes("DAPUR")) return "KITCHEN";
      if (d.includes("BAKER") || d.includes("PASTRY")) return "BAKER";
      return "BAR";
    }
    if (activeEmployee) {
      return getEmployeeDivision(activeEmployee);
    }
    return "BAR";
  }, [currentUser, activeEmployee]);

  // User division & shift today
  const myDivision = isLeader ? leaderDivision : getEmployeeDivision(activeEmployee);
  const todayShiftRecord = (employeeShifts || []).find(
    (s: any) => s.employeeId === activeEmployeeId && s.date === todayStr
  );
  const currentHour = new Date().getHours();
  const defaultShiftByTime: "PAGI" | "MIDDLE" | "SORE" = 
    currentHour >= 15 ? "SORE" : currentHour >= 11 ? "MIDDLE" : "PAGI";
  const scheduledShift: "PAGI" | "MIDDLE" | "SORE" | "OFF" = todayShiftRecord?.shiftType || defaultShiftByTime;

  // Checklist progress today for this employee
  const checklistProgress = useMemo(() => {
    let rawCats = settings.leaderBarTasks;
    if (myDivision === "KITCHEN") rawCats = settings.leaderKitchenTasks || DEFAULT_KITCHEN_CATEGORIES;
    else if (myDivision === "BAKER") rawCats = settings.leaderBakerTasks || DEFAULT_BAKER_CATEGORIES;
    else rawCats = settings.leaderBarTasks || DEFAULT_BAR_CATEGORIES;

    const categories = ensureCategoryArray(rawCats, DEFAULT_BAR_CATEGORIES);

    if (scheduledShift === "OFF") {
      return {
        totalTasks: 0,
        completedCount: 0,
        percentage: 100,
        isFinished: true,
        isOff: true,
        scheduledShift: "OFF" as const,
      };
    }

    // Filter tasks matching scheduledShift, isActive, and targetRole (LEADER vs STAFF)
    const activeShiftTasks: { catName: string; text: string }[] = [];
    categories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        const norm = normalizeTaskItem(item);
        const roleMatches = isLeader
          ? (!norm.targetRole || norm.targetRole === "ALL" || norm.targetRole === "LEADER")
          : (!norm.targetRole || norm.targetRole === "ALL" || norm.targetRole === "STAFF");

        if (norm.isActive && (norm.shift === "ALL" || norm.shift === scheduledShift) && roleMatches) {
          activeShiftTasks.push({ catName: cat.category, text: norm.text });
        }
      });
    });

    const totalTasks = activeShiftTasks.length;

    // Find checklist submitted for today
    const todayChecklist = dailyChecklists.find(
      (c) =>
        c.date.startsWith(todayStr) &&
        (c.employeeId === activeEmployeeId ||
          c.employeeId === currentUser?.id ||
          (isLeader && c.notes?.includes(`[${leaderDivision}]`)))
    );

    const completedList = todayChecklist?.leaderTasks || [];
    let completedCount = 0;
    activeShiftTasks.forEach((t) => {
      const key = `${t.catName}:::${t.text}`;
      if (completedList.includes(key) || completedList.includes(t.text)) {
        completedCount++;
      }
    });

    const percentage = totalTasks > 0 ? Math.min(100, Math.round((completedCount / totalTasks) * 100)) : 100;

    return {
      totalTasks,
      completedCount,
      percentage,
      isFinished: percentage === 100,
      isOff: false,
      scheduledShift,
    };
  }, [myDivision, scheduledShift, settings, dailyChecklists, todayStr, activeEmployeeId, currentUser, isLeader, leaderDivision]);

  // Team members in leader's division (Kasir otomatis tergabung ke Divisi Bar)
  const divisionTeam = useMemo(() => {
    if (!isLeader) return [];
    return employees
      .filter((e) => getEmployeeDivision(e) === leaderDivision && e.status === "AKTIF")
      .map((e) => {
        const att = dailyAttendances.find((a) => a.employeeId === e.id && a.date === todayStr);
        const userObj = users?.find((u) => u.id === e.id || u.username === e.username);
        const chk = dailyChecklists.find(
          (c) => (c.employeeId === e.id || (userObj && c.employeeId === userObj.id)) && c.date === todayStr
        );
        const taskCount = chk?.leaderTasks?.length || 0;
        return {
          employee: e,
          attendance: att,
          isClockedIn: !!att?.clockInTime,
          isClockedOut: !!att?.clockOutTime,
          hasChecklist: !!chk,
          checklistCount: taskCount,
        };
      });
  }, [isLeader, employees, leaderDivision, dailyAttendances, dailyChecklists, users, todayStr]);

  // 8. Active Contract & Target KPI Bonus
  const activeContract = useMemo(() => {
    return (
      (contracts || []).find(
        (c) => c.employeeId === activeEmployeeId && c.status === "ACTIVE"
      ) ||
      (contracts || []).find((c) => c.employeeId === activeEmployeeId) ||
      null
    );
  }, [contracts, activeEmployeeId]);

  const divisionPlafon = settings?.divisionKpiBonusTarget?.[myDivision] || 0;
  const targetKpiBonus = activeContract?.kpiBonusTarget || divisionPlafon || 0;

  // 9. Live Realtime Performance & Estimated KPI
  const livePerformance = useMemo(() => {
    const presentDays = monthlyStats.present;
    const lateDays = monthlyStats.late;
    const alphaDays = monthlyStats.alpha;
    const expectedDays = Math.max(1, presentDays || 22);

    // Checklist bulan ini
    const empChecklists = (dailyChecklists || []).filter(
      (c) =>
        (c.employeeId === activeEmployeeId ||
          c.employeeId === currentUser?.id ||
          (isLeader && c.notes?.includes(`[${leaderDivision}]`))) &&
        c.date.startsWith(currentMonthStr)
    );
    const checklistDays = empChecklists.length;

    if (checklistDays > 0) {
      // Dihitung proporsional dari penyelesaian Daily Jobdesk Checklist shift bulan ini
      const ratio = Math.min(1, checklistDays / expectedDays);
      const score = Math.round(ratio * 100);
      const estimatedBonus = targetKpiBonus > 0 ? Math.round(targetKpiBonus * ratio) : 0;

      return {
        score,
        ratio,
        targetBonus: targetKpiBonus,
        estimatedBonus,
        metricTitle: isLeader ? "Capaian Jobdesk Divisi" : "Capaian Jobdesk Shift",
        metricSubtitle: `${checklistDays} dari ${expectedDays} hari kerja terisi (${score}%)`,
        isLeader,
      };
    } else {
      // Fallback kedisiplinan jika belum ada checklist
      let score = 100;
      score -= lateDays * 5;
      score -= alphaDays * 15;
      const finalScore = Math.max(0, Math.min(100, Math.round(score)));
      const ratio = finalScore / 100;
      const estimatedBonus = targetKpiBonus > 0 ? Math.round(targetKpiBonus * ratio) : 0;

      return {
        score: finalScore,
        ratio,
        targetBonus: targetKpiBonus,
        estimatedBonus,
        metricTitle: "Kedisiplinan & Ketepatan Waktu",
        metricSubtitle: `${presentDays} Hadir (${lateDays} Terlambat, ${alphaDays} Alpha)`,
        isLeader,
      };
    }
  }, [monthlyStats, isLeader, dailyChecklists, activeEmployeeId, currentUser, leaderDivision, currentMonthStr, targetKpiBonus]);

  // 10. My Payslips (Self-Service)
  const myPayslips = useMemo(() => {
    return (payrollRecords || [])
      .filter((p) => p.employeeId === activeEmployeeId)
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [payrollRecords, activeEmployeeId]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* ─── 1. GREETING & IDENTITY BANNER ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-20 -mb-16 w-64 h-64 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-blue-500/25 shrink-0 border border-white/20">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-blue-300 font-semibold text-xs tracking-wider uppercase">
                  {greeting},
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 backdrop-blur-md border border-white/15 text-blue-200">
                  {currentUser?.role || "Staff"}
                </span>
                {activeEmployee?.department && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/20">
                    Divisi {activeEmployee.department}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                {currentUser?.name || "Karyawan"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                {now.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate("attendance_clock")}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center gap-2 shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>{isClockedIn && !isClockedOut ? "Absen Pulang (Clock Out)" : "Absen Masuk (Clock In)"}</span>
            </button>
            {isLeader && (
              <button
                onClick={() => onNavigate("leader_checklist")}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0"
              >
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>Checklist Supervisi Leader</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. STATUS KEHADIRAN HARI INI ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isClockedIn ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Status Kehadiran Anda Hari Ini
              </h3>
              <p className="text-xs text-slate-500">
                {isClockedOut
                  ? "Selesai kerja untuk hari ini. Terima kasih atas dedikasi Anda!"
                  : isClockedIn
                  ? "Anda sudah absen masuk dan aktif bertugas di outlet."
                  : "Anda belum melakukan Clock In untuk shift hari ini."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isClockedOut
                ? "bg-slate-100 text-slate-700"
                : isClockedIn
                ? "bg-emerald-100 text-emerald-800 animate-pulse"
                : "bg-rose-100 text-rose-700"
            }`}>
              {isClockedOut
                ? "SUDAH CLOCK OUT"
                : isClockedIn
                ? "SEDANG BERTUGAS"
                : "BELUM CLOCK IN"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Jam Masuk */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Jam Masuk (Clock In)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-lg font-black text-slate-800 font-mono">
              {todayAttendance?.clockInTime
                ? new Date(todayAttendance.clockInTime).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-- : --"}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {todayAttendance?.status || "Belum Absen"}
            </p>
          </div>

          {/* Jam Pulang */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Jam Pulang (Clock Out)</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="text-lg font-black text-slate-800 font-mono">
              {todayAttendance?.clockOutTime
                ? new Date(todayAttendance.clockOutTime).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-- : --"}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isClockedOut ? "Pulang Tepat Waktu" : "Belum Clock Out"}
            </p>
          </div>

          {/* Durasi Kerja */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Total Jam Kerja</span>
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-black text-blue-700 font-mono">
              {todayAttendance?.clockInTime && todayAttendance?.clockOutTime
                ? `${(
                    (new Date(todayAttendance.clockOutTime).getTime() -
                      new Date(todayAttendance.clockInTime).getTime()) /
                    3600000
                  ).toFixed(1)} Jam`
                : isClockedIn
                ? "Berjalan..."
                : "0 Jam"}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Hari ini</p>
          </div>

          {/* Lokasi & Foto */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 mb-1">Bukti Selfie & GPS</div>
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                {todayAttendance?.clockInLocation ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> GPS Terverifikasi
                  </span>
                ) : (
                  <span className="text-slate-400">Tidak ada GPS</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {todayAttendance?.approvalStatus === "APPROVED"
                  ? "Disahkan Manager"
                  : todayAttendance?.approvalStatus === "REJECTED"
                  ? "Ditolak Manager"
                  : "Menunggu Verifikasi"}
              </p>
            </div>
            {todayAttendance?.clockInPhotoUrl && (
              <img
                src={todayAttendance.clockInPhotoUrl}
                alt="Selfie"
                className="w-12 h-12 rounded-lg object-cover border border-emerald-400 shadow-2xs"
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. KHUSUS LEADER: MONITORING DIVISI & JOBDESK TIM ─── */}
      {isLeader && checklistProgress && (
        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 rounded-2xl p-6 border border-indigo-100 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Monitoring Operasional Tim Divisi {leaderDivision === "BAR" ? "Bar & Kasir" : leaderDivision}
                  </h3>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-md uppercase">
                    Portal Leader
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pantau kesiapan checklist harian dan kehadiran anggota tim Anda hari ini.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => onNavigate("hr")}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Atur Jadwal Shift Tim →</span>
              </button>
              <button
                onClick={() => onNavigate("leader_checklist")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Kelola Checklist Divisi →</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Progress Jobdesk Hari Ini */}
            <div className="lg:col-span-1 bg-white rounded-xl p-5 border border-indigo-100 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Progres Jobdesk Hari Ini
                </span>
                <div className="flex items-baseline justify-between mt-2 mb-2">
                  <span className="text-3xl font-black text-indigo-900 font-mono">
                    {checklistProgress.percentage}%
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {checklistProgress.completedCount} dari {checklistProgress.totalTasks} Selesai
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/60 mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      checklistProgress.percentage === 100
                        ? "bg-emerald-500"
                        : checklistProgress.percentage >= 50
                        ? "bg-indigo-600"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${checklistProgress.percentage}%` }}
                  />
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {checklistProgress.percentage === 100
                    ? "Semua standar operasional dan kebersihan tim sudah lengkap!"
                    : checklistProgress.percentage > 0
                    ? "Sebagian tugas sudah diceklis. Pastikan seluruh poin closing/opening terselesaikan."
                    : "Belum ada checklist yang disimpan untuk shift hari ini."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Status Target:</span>
                <span className={`font-bold ${checklistProgress.percentage === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                  {checklistProgress.percentage === 100 ? "Lengkap 100%" : "Sedang Berjalan"}
                </span>
              </div>
            </div>

            {/* Rekap Absensi Anggota Tim Divisi Hari Ini */}
            <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-indigo-100 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Kehadiran Tim {leaderDivision === "BAR" ? "Bar & Kasir" : leaderDivision} ({divisionTeam.length} Staf)
                </span>
                <span className="text-[11px] text-slate-400">Hari ini</span>
              </div>

              {divisionTeam.length === 0 ? (
                <div className="py-8 text-center text-slate-400 italic text-xs">
                  Tidak ada staf lain di divisi ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {divisionTeam.map((member) => (
                    <div
                      key={member.employee.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/80 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                          {member.employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{member.employee.name}</p>
                          <p className="text-[10px] text-slate-400">{member.employee.position}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-slate-600 text-[11px]">
                          {member.attendance?.clockInTime
                            ? new Date(member.attendance.clockInTime).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            member.isClockedOut
                              ? "bg-slate-100 text-slate-700"
                              : member.isClockedIn
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {member.isClockedOut ? "Pulang" : member.isClockedIn ? "Hadir" : "Belum Masuk"}
                        </span>
                        {member.isClockedIn && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              member.hasChecklist
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {member.hasChecklist ? `✓ ${member.checklistCount} Task` : "Belum Checklist"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* ─── 4. STATISTIK BULAN BERJALAN & KPI ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ringkasan Kehadiran Bulan Ini (Col 1-2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ringkasan Kehadiran Bulan Ini
              </h3>
              <p className="text-xs text-slate-500">
                Periode: {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
              </p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg">
              {monthlyStats.totalDays} Catatan
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
              <div className="text-2xl font-black text-emerald-900 font-mono">
                {monthlyStats.present}
              </div>
              <span className="text-xs font-semibold text-emerald-700">Hari Hadir</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
              <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
              <div className="text-2xl font-black text-amber-900 font-mono">
                {monthlyStats.late}
              </div>
              <span className="text-xs font-semibold text-amber-700">Terlambat</span>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
              <Info className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
              <div className="text-2xl font-black text-blue-900 font-mono">
                {monthlyStats.sickLeave}
              </div>
              <span className="text-xs font-semibold text-blue-700">Izin / Sakit</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100 text-center">
              <AlertCircle className="w-5 h-5 text-rose-600 mx-auto mb-1.5" />
              <div className="text-2xl font-black text-rose-900 font-mono">
                {monthlyStats.alpha}
              </div>
              <span className="text-xs font-semibold text-rose-700">Alpha</span>
            </div>
          </div>

          {/* Riwayat Absensi Terakhir */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Riwayat 7 Kehadiran Terakhir
            </h4>
            {recentAttendances.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Belum ada riwayat kehadiran tercatat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Jam In/Out</th>
                      <th className="py-2 px-3">Durasi</th>
                      <th className="py-2 px-3 text-right">Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendances.map((att) => (
                      <tr key={att.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{att.date}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              att.status === "HADIR"
                                ? "bg-emerald-100 text-emerald-800"
                                : att.status === "TERLAMBAT"
                                ? "bg-amber-100 text-amber-800"
                                : att.status === "ALPHA"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {att.clockInTime
                            ? new Date(att.clockInTime).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                          {" - "}
                          {att.clockOutTime
                            ? new Date(att.clockOutTime).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">
                          {att.clockInTime && att.clockOutTime
                            ? `${(
                                (new Date(att.clockOutTime).getTime() -
                                  new Date(att.clockInTime).getTime()) /
                                3600000
                              ).toFixed(1)} Jam`
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`text-[10px] font-bold ${
                              att.approvalStatus === "APPROVED"
                                ? "text-emerald-600"
                                : att.approvalStatus === "REJECTED"
                                ? "text-rose-600"
                                : "text-amber-600"
                            }`}
                          >
                            {att.approvalStatus === "APPROVED"
                              ? "Sah ✓"
                              : att.approvalStatus === "REJECTED"
                              ? "Ditolak ✗"
                              : "Review"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Skor & Evaluasi KPI Bulan Ini (Col 3) */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">KPI Kinerja</h3>
                  <p className="text-[11px] text-slate-500">Bulan Berjalan</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {now.toLocaleDateString("id-ID", { month: "short" })}
              </span>
            </div>

            {currentKpi ? (
              <div className="space-y-4">
                {/* Total Score Display (Official) */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/80 text-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
                      Skor Resmi Manager
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      Disahkan ✓
                    </span>
                  </div>
                  <div className="text-4xl font-black text-indigo-950 font-mono mt-1">
                    {currentKpi.totalScore}
                    <span className="text-base font-medium text-slate-400"> / 100</span>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                        currentKpi.totalScore >= 85
                          ? "bg-emerald-100 text-emerald-800"
                          : currentKpi.totalScore >= 70
                          ? "bg-blue-100 text-blue-800"
                          : currentKpi.totalScore >= 55
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {currentKpi.totalScore >= 85
                        ? "Sangat Baik (A)"
                        : currentKpi.totalScore >= 70
                        ? "Baik (B)"
                        : currentKpi.totalScore >= 55
                        ? "Cukup (C)"
                        : "Perlu Evaluasi (D)"}
                    </span>
                  </div>
                </div>

                {/* KPI Bonus jika ada */}
                {currentKpi.kpiBonus > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Bonus KPI Cair
                    </span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {formatRupiah(currentKpi.kpiBonus)}
                    </span>
                  </div>
                )}

                {/* Catatan Evaluator */}
                {currentKpi.notes && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl text-xs">
                    <span className="font-bold text-slate-700 block mb-1">Catatan Evaluator:</span>
                    <p className="text-slate-600 italic">"{currentKpi.notes}"</p>
                  </div>
                )}

                {/* Rincian Target Button */}
                {currentKpi.targets && currentKpi.targets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowKpiDetails(!showKpiDetails)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <span>{showKpiDetails ? "Tutup Rincian Target" : "Lihat Rincian Target KPI"}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showKpiDetails ? "rotate-90" : ""}`} />
                  </button>
                )}

                {showKpiDetails && currentKpi.targets && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    {currentKpi.targets.map((t, idx) => (
                      <div key={t.id || idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex justify-between font-bold text-slate-800 mb-0.5">
                          <span>{t.description}</span>
                          <span className="font-mono text-indigo-700">{t.score} pt</span>
                        </div>
                        <div className="text-[10px] text-slate-500">Bobot: {t.weight}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Live Realtime Tracking Display */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-blue-50/40 to-slate-50 border border-indigo-100/90 text-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
                      Estimasi Berjalan
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                      Live Tracking
                    </span>
                  </div>
                  <div className="text-4xl font-black text-indigo-950 font-mono mt-1">
                    {livePerformance.score}
                    <span className="text-base font-medium text-slate-400"> / 100</span>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                        livePerformance.score >= 85
                          ? "bg-emerald-100 text-emerald-800"
                          : livePerformance.score >= 70
                          ? "bg-blue-100 text-blue-800"
                          : livePerformance.score >= 55
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {livePerformance.score >= 85
                        ? "Sangat Baik (A)"
                        : livePerformance.score >= 70
                        ? "Baik (B)"
                        : livePerformance.score >= 55
                        ? "Cukup (C)"
                        : "Perlu Ditingkatkan (D)"}
                    </span>
                  </div>

                  {/* Progress Metric bar */}
                  <div className="mt-3.5 pt-3 border-t border-indigo-100/60 text-left">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                      <span className="font-semibold text-slate-700">{livePerformance.metricTitle}</span>
                      <span className="font-bold text-indigo-600">{livePerformance.score}%</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${livePerformance.score}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{livePerformance.metricSubtitle}</p>
                  </div>
                </div>

                {/* Target & Estimasi Bonus KPI */}
                {livePerformance.targetBonus > 0 ? (
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Target Bonus Kontrak:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatRupiah(livePerformance.targetBonus)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-200/60">
                      <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Estimasi Bonus Saat Ini:
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {formatRupiah(livePerformance.estimatedBonus)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Target bonus KPI belum diset di kontrak kerja karyawan.</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed px-1 italic">
                  💡 Nilai di atas adalah estimasi otomatis berdasarkan capaian {livePerformance.isLeader ? "jobdesk harian divisi" : "kehadiran & disiplin"} Anda bulan ini sebelum disahkan oleh Manager.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Sistem KPI Outlet</span>
            <span className="text-brand-600 font-semibold">Julia's</span>
          </div>
        </div>
      </div>

      {/* ─── 5. SLIP GAJI SAYA (SELF-SERVICE PAYSLIP) ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Riwayat Slip Gaji Saya
              </h3>
              <p className="text-xs text-slate-500">
                Akses mandiri untuk melihat dan mengunduh slip gaji resmi Anda kapan saja.
              </p>
            </div>
          </div>

          {myPayslips.length > 0 && (
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/60 self-start sm:self-auto">
              {myPayslips.length} Periode Tersedia
            </span>
          )}
        </div>

        {myPayslips.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-medium text-slate-600">
              Belum Ada Slip Gaji Diterbitkan
            </p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Slip gaji resmi Anda akan otomatis muncul di sini setelah diproses dan disahkan oleh Tim Keuangan / Manajemen kafe pada jadwal penggajian bulanan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myPayslips.map((pay) => {
              const [y, m] = pay.period.split("-");
              const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
              const formattedPeriod = dateObj.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

              return (
                <div
                  key={pay.id}
                  className="p-5 rounded-2xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/60 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium block">
                          Periode Gaji
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                          {formattedPeriod}
                        </h4>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          pay.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : pay.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {pay.status === "PAID" ? "Lunas Diterima" : pay.status === "APPROVED" ? "Disahkan" : "Draft"}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-100/80 rounded-xl mb-4">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                        Take Home Pay (THP)
                      </span>
                      <span className="text-xl font-black text-slate-900 font-mono block mt-0.5">
                        {formatCurrency(pay.netPay)}
                      </span>
                      {pay.paidDate && (
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Dibayar tgl {new Date(pay.paidDate).toLocaleDateString("id-ID")}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPayslipForEmployee(pay)}
                    className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lihat & Unduh Slip Gaji</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payslip Modal */}
      {selectedPayslipForEmployee && (
        <PayslipModal
          payroll={selectedPayslipForEmployee}
          onClose={() => setSelectedPayslipForEmployee(null)}
        />
      )}
    </div>
  );
};
