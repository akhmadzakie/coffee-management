import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { getLocalDateString } from "../utils/dateUtils";
import { ViewState, DailyAttendance } from "../types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
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
  Calculator,
  Sparkles,
  Sliders,
  Calendar,
  CheckCheck,
  Check,
  DollarSign,
  Wallet,
  Activity,
  ShoppingBag,
  Truck,
  BarChart3,
  Receipt,
  Flame,
  Layers,
  CreditCard,
  QrCode,
  Banknote,
  ArrowUpRight,
  Send,
  Zap,
  Radio,
  Tag,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ManagerApprovalModal } from "./ManagerApprovalModal";
import { ManagerApprovalRequest } from "../types";

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
    recipes,
    settings,
    updateSettings,
    employeeShifts,
    currentUser,
    updateDailyAttendance,
    promotions,
  } = useStore();

  const [selectedAttendancePhoto, setSelectedAttendancePhoto] = useState<DailyAttendance | null>(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState<
    "overview" | "sales" | "inventory" | "team"
  >("overview");
  const [managerAiInput, setManagerAiInput] = useState("");
  const [pendingApprovals, setPendingApprovals] = useState<ManagerApprovalRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ManagerApprovalRequest[]>([]);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const fetchApprovalsData = async () => {
    try {
      const [resPending, resHistory] = await Promise.all([
        fetch("/api/pos/approvals/pending"),
        fetch("/api/pos/approvals/history"),
      ]);
      if (resPending.ok) {
        setPendingApprovals(await resPending.json());
      }
      if (resHistory.ok) {
        setApprovalHistory(await resHistory.json());
      }
    } catch (e) {
      console.warn("Gagal memuat remote approvals:", e);
    }
  };

  useEffect(() => {
    fetchApprovalsData();
    const interval = setInterval(fetchApprovalsData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCopilot = (
    tab: "quick-input" | "receipt" | "consultant" | "insights",
    prompt?: string
  ) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-assistant", {
        detail: { tab, prompt: prompt || managerAiInput },
      })
    );
    if (prompt || managerAiInput) setManagerAiInput("");
  };

  // Metrik Ringkas HPP untuk Manager
  const hppStats = useMemo(() => {
    let totalEstimatedHpp = 0;
    let validRecipeCount = 0;

    recipes.forEach((r) => {
      let cost = 0;
      let ingList = r?.ingredients;
      if (typeof ingList === "string") {
        try {
          ingList = JSON.parse(ingList);
        } catch {
          ingList = [];
        }
      }
      if (Array.isArray(ingList)) {
        ingList.forEach((ri: any) => {
          const ing = ingredients.find((i) => i.id === ri.ingredientId);
          if (ing && ing.costPerUnit) {
            cost += Number(ri.quantity || 0) * Number(ing.costPerUnit);
          }
        });
      }
      if (cost > 0) {
        totalEstimatedHpp += cost;
        validRecipeCount++;
      }
    });

    const avgHpp = validRecipeCount > 0 ? Math.round(totalEstimatedHpp / validRecipeCount) : 0;
    return {
      totalRecipes: recipes.length,
      avgHpp,
      calculatedCount: validRecipeCount,
    };
  }, [recipes, ingredients]);

  // Deteksi Jadwal Shift yang Menunggu ACC Manajer
  const scheduleApprovalAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const day = today.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);

    // Minggu Ini
    const thisMonday = new Date(today);
    thisMonday.setDate(diffToMonday);

    // Minggu Depan
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    const weeks = [
      { key: getLocalDateString(thisMonday), label: "Minggu Ini", start: thisMonday },
      { key: getLocalDateString(nextMonday), label: "Minggu Depan", start: nextMonday },
    ];

    const alerts: {
      weekKey: string;
      weekLabel: string;
      dateRangeStr: string;
      shiftCount: number;
      divisions: string[];
      status: "DRAFT" | "PENDING";
      submittedBy?: string;
    }[] = [];

    weeks.forEach((w) => {
      const endSunday = new Date(w.start);
      endSunday.setDate(endSunday.getDate() + 6);

      const approval = (settings?.scheduleApprovals as any)?.[w.key];
      const isApproved = approval?.status === "APPROVED";

      const startDateStr = w.key;
      const endDateStr = getLocalDateString(endSunday);

      const weekShifts = employeeShifts.filter((s) => {
        if (s.date < startDateStr || s.date > endDateStr || s.shiftType === "OFF") return false;
        const emp = employees.find((e) => e.id === s.employeeId);
        if (!emp) return false;
        const pos = (emp.position || "").toUpperCase();
        const dept = (emp.department || "").toUpperCase();
        const isOffice =
          pos.includes("MANAGER") || pos.includes("MANAJER") ||
          dept.includes("MANAGEMENT") || dept.includes("MANAJEMEN") ||
          pos.includes("OWNER") || pos.includes("FINANCE") ||
          dept.includes("FINANCE") || pos.includes("KEUANGAN") ||
          pos.includes("ACCOUNTING") || pos.includes("ADMIN") ||
          pos.includes("HR");
        return !isOffice;
      });

      if (weekShifts.length > 0 && !isApproved) {
        const divSet = new Set<string>();
        weekShifts.forEach((s) => {
          const emp = employees.find((e) => e.id === s.employeeId);
          if (emp) {
            const pos = (emp.position || "").toUpperCase();
            const dept = (emp.department || "").toUpperCase();
            const div = (dept.includes("KITCHEN") || pos.includes("KITCHEN") || pos.includes("COOK"))
              ? "KITCHEN"
              : (dept.includes("BAKER") || pos.includes("BAKER") || pos.includes("PASTRY"))
              ? "BAKER"
              : "BAR & KASIR";
            divSet.add(div);
          }
        });

        const dateRangeStr = `${w.start.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${endSunday.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

        alerts.push({
          weekKey: w.key,
          weekLabel: w.label,
          dateRangeStr,
          shiftCount: weekShifts.length,
          divisions: Array.from(divSet),
          status: approval?.status === "PENDING" ? "PENDING" : "DRAFT",
          submittedBy: approval?.submittedBy,
        });
      }
    });

    return alerts;
  }, [settings?.scheduleApprovals, employeeShifts, employees]);

  const [approvedToast, setApprovedToast] = useState<string | null>(null);

  const handleQuickApproveSchedule = (weekKey: string, weekLabel: string) => {
    const existing = (settings?.scheduleApprovals as any)?.[weekKey] || {};
    const newApprovals = {
      ...((settings?.scheduleApprovals as any) || {}),
      [weekKey]: {
        ...existing,
        status: "APPROVED",
        approvedBy: currentUser?.name || "Manager",
        approvedAt: new Date().toISOString(),
        notes: existing.notes || "Jadwal mingguan resmi telah disahkan oleh Manajer. Selamat bertugas, jaga kebersihan area kerja divisi, dan konsistensi pelayanan prima!",
      },
    };
    updateSettings({
      ...settings,
      scheduleApprovals: newApprovals,
    });
    setApprovedToast(`Jadwal ${weekLabel} berhasil disahkan & brief terkirim ke karyawan!`);
    setTimeout(() => setApprovedToast(null), 4000);
  };

  const handleNavigateToSchedule = () => {
    sessionStorage.setItem("hr_target_tab", "schedule");
    onNavigate("hr");
  };

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
    return employees.filter((e) => {
      const isAktif = e.status === "AKTIF" || (e.status as any) === "ACTIVE" || !e.status;
      if (!isAktif) return false;
      const pos = (e.position || "").toUpperCase();
      const dept = (e.department || "").toUpperCase();
      const isOfficeOrManager =
        pos.includes("MANAGER") ||
        pos.includes("MANAJER") ||
        dept.includes("MANAGEMENT") ||
        dept.includes("MANAJEMEN") ||
        pos.includes("OWNER") ||
        pos.includes("DIREKTUR") ||
        pos.includes("KEPALA TOKO");
      return !isOfficeOrManager;
    });
  }, [employees]);

  // Statistik Kehadiran Hari Ini
  const attendanceStats = useMemo(() => {
    const hadir = todayAttendances.filter((a) => a.status === "HADIR").length;
    const terlambat = todayAttendances.filter((a) => a.status === "TERLAMBAT").length;
    const izinSakit = todayAttendances.filter((a) => a.status === "IZIN" || a.status === "SAKIT").length;
    const belumHadir = Math.max(0, activeEmployees.length - (hadir + terlambat + izinSakit));

    return { hadir, terlambat, izinSakit, belumHadir, total: activeEmployees.length };
  }, [todayAttendances, activeEmployees]);

  const pendingToday = useMemo(() => {
    return todayAttendances.filter(
      (a) => (a.approvalStatus || "PENDING") === "PENDING" && a.status !== "ALPHA"
    );
  }, [todayAttendances]);

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

      const latestNotes = checklists
        .map((c) => c.notes?.replace(/^\[(BAR|KITCHEN|BAKER|KASIR)\]\s*/, "").trim())
        .filter(Boolean);

      return {
        ...div,
        staffCount: empInDiv.length,
        submittedCount: checklists.length,
        progress,
        notes: latestNotes,
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

  // Bulan ini YYYY-MM
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, []);

  // Transaksi & Omzet Hari Ini
  const todaySalesList = useMemo(() => {
    return salesTransactions.filter((s) => s.date.startsWith(todayStr));
  }, [salesTransactions, todayStr]);

  const todayRevenue = useMemo(() => {
    return todaySalesList.reduce((sum, s) => sum + s.totalPrice, 0);
  }, [todaySalesList]);

  // Transaksi & Omzet Bulan Ini
  const thisMonthSalesList = useMemo(() => {
    return salesTransactions.filter((s) => s.date.startsWith(currentMonthStr));
  }, [salesTransactions, currentMonthStr]);

  const thisMonthRevenue = useMemo(() => {
    return thisMonthSalesList.reduce((sum, s) => sum + s.totalPrice, 0);
  }, [thisMonthSalesList]);

  // Breakdown Metode Pembayaran Hari Ini
  const paymentStats = useMemo(() => {
    let cash = 0;
    let qris = 0;
    let transfer = 0;
    todaySalesList.forEach((s) => {
      const m = (s.paymentMethod || "CASH").toUpperCase();
      if (m.includes("QRIS")) qris += s.totalPrice;
      else if (m.includes("TRANSFER") || m.includes("EDC") || m.includes("DEBIT")) transfer += s.totalPrice;
      else cash += s.totalPrice;
    });
    return { cash, qris, transfer, total: todayRevenue };
  }, [todaySalesList, todayRevenue]);

  // Tren Omzet 7 Hari Terakhir
  const last7DaysChartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      const dayLabel = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
      const daySales = salesTransactions.filter((s) => s.date.startsWith(dateStr));
      const omzet = daySales.reduce((sum, s) => sum + s.totalPrice, 0);
      data.push({
        name: dayLabel,
        omzet,
        transaksi: daySales.length,
      });
    }
    return data;
  }, [salesTransactions]);

  // Jam Ramai Toko Hari Ini (Hourly Traffic 08:00 - 22:00)
  const hourlyTrafficData = useMemo(() => {
    const hoursMap: Record<number, { omzet: number; transaksi: number }> = {};
    for (let h = 8; h <= 22; h++) {
      hoursMap[h] = { omzet: 0, transaksi: 0 };
    }
    todaySalesList.forEach((s) => {
      try {
        const timePart = s.time || (s.date.includes("T") ? s.date.split("T")[1] : "");
        const hour = timePart ? parseInt(timePart.split(":")[0], 10) : new Date(s.date).getHours();
        if (hour >= 8 && hour <= 22) {
          hoursMap[hour].omzet += s.totalPrice;
          hoursMap[hour].transaksi += 1;
        }
      } catch {}
    });
    return Object.entries(hoursMap).map(([hour, val]) => ({
      hour: `${hour}:00`,
      omzet: val.omzet,
      transaksi: val.transaksi,
    }));
  }, [todaySalesList]);

  // Valuasi Total Stok Bahan Baku di Toko
  const stockValuation = useMemo(() => {
    let totalValue = 0;
    ingredients.forEach((ing) => {
      const cost = Number(ing.costPerUnit || 0);
      totalValue += ing.currentStock * cost;
    });
    const criticalCount = ingredients.filter((i) => i.currentStock <= i.minStock).length;
    const safeCount = Math.max(0, ingredients.length - criticalCount);
    return { totalValue, criticalCount, safeCount, totalIngredients: ingredients.length };
  }, [ingredients]);

  // Top 10 Produk Terlaris Hari Ini dengan Omzet
  const bestSellersTodayFull = useMemo(() => {
    const stats: Record<string, { qty: number; revenue: number }> = {};
    todaySalesList.forEach((s) => {
      if (!stats[s.menuName]) {
        stats[s.menuName] = { qty: 0, revenue: 0 };
      }
      stats[s.menuName].qty += s.quantitySold;
      stats[s.menuName].revenue += s.totalPrice;
    });
    return Object.entries(stats)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
  }, [todaySalesList]);

  // Skor Kesehatan Operasional Toko (0 - 100%)
  const storeHealthScore = useMemo(() => {
    const attRatio = activeEmployees.length > 0 ? attendanceStats.hadir / activeEmployees.length : 1;
    const attScore = attRatio * 30;

    const stockRatio = stockValuation.totalIngredients > 0 ? stockValuation.safeCount / stockValuation.totalIngredients : 1;
    const stockScore = stockRatio * 30;

    const avgProgress = divisionChecklists.length > 0
      ? divisionChecklists.reduce((acc, d) => acc + d.progress, 0) / divisionChecklists.length
      : 100;
    const checklistScore = (avgProgress / 100) * 25;

    const shiftScore = activeShift ? 15 : 8;

    return Math.min(100, Math.round(attScore + stockScore + checklistScore + shiftScore));
  }, [activeEmployees, attendanceStats, stockValuation, divisionChecklists, activeShift]);

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

      {/* Remote Approval Alert Banner */}
      {pendingApprovals.length > 0 && (
        <div className="p-4 px-6 bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold text-sm flex items-center gap-2">
                <span>Ada {pendingApprovals.length} Permintaan Otorisasi Kasir (Remote In-App)</span>
                <span className="px-2 py-0.5 rounded-full bg-white text-rose-700 text-[10px] font-black uppercase">
                  Perlu Tindakan
                </span>
              </p>
              <p className="text-xs text-white/90">
                Kasir mengajukan refund atau void nota yang memerlukan persetujuan Manager.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsApprovalModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 font-extrabold text-xs shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Buka & Putuskan Otorisasi</span>
          </button>
        </div>
      )}

      {/* 4 Smart Executive Management Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Penjualan Hari Ini */}
        <div
          onClick={() => setActiveDashboardTab("sales")}
          className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Omzet Hari Ini
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-stone-900 tracking-tight">
            {formatCurrency(todayRevenue)}
          </p>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-2">
            <span>{todaySalesList.length} pesanan kasir</span>
            <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              Lihat Tren <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Valuasi Stok Toko */}
        <div
          onClick={() => setActiveDashboardTab("inventory")}
          className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Aset Bahan Baku
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-stone-900 tracking-tight">
            {formatCurrency(stockValuation.totalValue)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2">
            <span className={stockValuation.criticalCount > 0 ? "text-rose-600 font-bold" : "text-stone-500"}>
              {stockValuation.criticalCount > 0
                ? `⚠️ ${stockValuation.criticalCount} bahan menipis!`
                : "Semua stok aman"}
            </span>
            <span className="text-amber-800 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              Cek Stok <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Disiplin Kehadiran Staf */}
        <div
          onClick={() => setActiveDashboardTab("team")}
          className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Kehadiran Staf
            </span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-stone-900 tracking-tight">
            {attendanceStats.hadir} <span className="text-sm font-normal text-stone-500">/ {attendanceStats.total} Hadir</span>
          </p>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-2">
            <span>
              {attendanceStats.terlambat > 0 ? `${attendanceStats.terlambat} telat` : "Tepat waktu"}
              {pendingToday.length > 0 && ` · ${pendingToday.length} perlu ACC`}
            </span>
            <span className="text-indigo-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              Verifikasi <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Store Health Score */}
        <div className="p-5 bg-gradient-to-br from-[#241813] to-[#3a2820] text-white rounded-3xl border border-stone-700 shadow-coffee flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
                Skor Operasional Toko
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Smart AI
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {storeHealthScore}%
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {storeHealthScore >= 85 ? "Optimal" : storeHealthScore >= 70 ? "Baik" : "Perhatian"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-stone-300 mt-2">
            {storeHealthScore >= 85
              ? "Semua divisi berjalan lancar sesuai SOP."
              : "Periksa bahan menipis dan tugas checklist yang tertunda."}
          </p>
        </div>
      </div>

      {/* ─── Manager AI Copilot Hub (Operational & Inventory Intelligence) ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c1917] via-[#292524] to-[#44403c] text-white p-5 sm:p-6 shadow-xl border border-stone-800">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-orange-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-amber-400 shadow-inner">
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>Julia AI Copilot</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Manager Operations Hub
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-stone-300">
                  Audit stok bahan kritis, simulasi resep & optimasi HPP, serta konsultasi manajemen shift & SOP kafe.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenCopilot("insights")}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white text-stone-900 hover:bg-stone-100 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Buka Copilot Penuh →</span>
            </button>
          </div>

          {/* Quick Ask / Consultant Query Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (managerAiInput.trim()) {
                handleOpenCopilot("consultant", managerAiInput);
              }
            }}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 pl-4 focus-within:bg-white/15 focus-within:border-white/40 transition-all shadow-inner"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={managerAiInput}
              onChange={(e) => setManagerAiInput(e.target.value)}
              placeholder="Tanya SOP shift, cara cegah susu basi, atau strategi margin HPP kopi..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-stone-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!managerAiInput.trim()}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>Tanya AI</span>
              <Send className="w-3 h-3" />
            </button>
          </form>

          {/* Manager Action Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mr-1">
              Aksi Manajer:
            </span>
            <button
              onClick={() => handleOpenCopilot("insights")}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              <span>🚨 Audit Bahan Menipis ({stockValuation.criticalCount})</span>
            </button>
            <button
              onClick={() =>
                handleOpenCopilot(
                  "consultant",
                  "Bagaimana cara hitung rincian HPP dan margin optimal kopi susu gula aren 12oz?"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-300" />
              <span>☕ Optimasi Margin & HPP Resep</span>
            </button>
            <button
              onClick={() =>
                handleOpenCopilot(
                  "consultant",
                  "Bagaimana pembagian tugas dan workflow 2 barista saat rush hour ramai?"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>⚡ Workflow Rush Hour Ramai</span>
            </button>
            <button
              onClick={() =>
                handleOpenCopilot(
                  "consultant",
                  "Bagaimana SOP mencegah susu basi dan meminimalkan waste biji kopi di bar?"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>📋 SOP Cegah Waste Bahan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Smart Dashboard Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-stone-100 rounded-2xl border border-stone-200">
        <button
          onClick={() => setActiveDashboardTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeDashboardTab === "overview"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
          }`}
        >
          <Activity className="w-4 h-4 text-amber-700" />
          <span>Command Center</span>
        </button>
        <button
          onClick={() => setActiveDashboardTab("sales")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeDashboardTab === "sales"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>Tracking Penjualan & Omzet</span>
        </button>
        <button
          onClick={() => setActiveDashboardTab("inventory")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeDashboardTab === "inventory"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
          }`}
        >
          <Package className="w-4 h-4 text-brand-600" />
          <span>Tracking Stok & Bahan Baku</span>
          {lowStockIngredients.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {lowStockIngredients.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveDashboardTab("team")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeDashboardTab === "team"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Tracking Tim & SOP</span>
          {scheduleApprovalAlerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
              {scheduleApprovalAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: TRACKING PENJUALAN & OMZET PINTAR ─────────────────────────── */}
      {activeDashboardTab === "sales" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Ringkasan Angka Penjualan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                Omzet Hari Ini
              </span>
              <p className="text-2xl font-black font-mono text-emerald-800">
                {formatCurrency(todayRevenue)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Dari {todaySalesList.length} transaksi di kasir toko
              </p>
            </div>
            <div className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                Omzet Bulan Ini ({new Date().toLocaleDateString("id-ID", { month: "long" })})
              </span>
              <p className="text-2xl font-black font-mono text-stone-900">
                {formatCurrency(thisMonthRevenue)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Total {thisMonthSalesList.length} pesanan bulan ini
              </p>
            </div>
            <div className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                Rata-rata Nilai Pesanan (AOV)
              </span>
              <p className="text-2xl font-black font-mono text-amber-900">
                {formatCurrency(todaySalesList.length > 0 ? Math.round(todayRevenue / todaySalesList.length) : 0)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Rata-rata belanja per struk kasir
              </p>
            </div>
          </div>

          {/* Grafik Tren 7 Hari Terakhir & Jam Ramai */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grafik Tren Omzet 7 Hari */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Tren Penjualan 7 Hari Terakhir
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">Grafik dinamika omzet harian toko</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last7DaysChartData}>
                    <defs>
                      <linearGradient id="managerOmzetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${val / 1000}k`}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), "Omzet"]}
                      labelStyle={{ fontWeight: "bold" }}
                      contentStyle={{ borderRadius: "1rem", border: "1px solid #e2e8f0" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="omzet"
                      stroke="#059669"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#managerOmzetGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Jam Ramai Toko (Peak Hours Traffic) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700" />
                    Jam Ramai Toko (Peak Hours)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">Jumlah transaksi per jam hari ini</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyTrafficData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [
                        name === "omzet" ? formatCurrency(Number(val)) : `${val} pesanan`,
                        name === "omzet" ? "Omzet" : "Transaksi",
                      ]}
                      contentStyle={{ borderRadius: "1rem", border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="transaksi" fill="#d97706" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Metode Pembayaran & Top 10 Menu */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metode Pembayaran */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-700" />
                Metode Pembayaran
              </h3>
              <p className="text-xs text-stone-500 mb-4">Porsi kas masuk berdasarkan jenis channel</p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="flex items-center gap-1.5 text-stone-700">
                      <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Tunai / Cash
                    </span>
                    <span className="font-mono text-stone-900">{formatCurrency(paymentStats.cash)}</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${paymentStats.total > 0 ? (paymentStats.cash / paymentStats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="flex items-center gap-1.5 text-stone-700">
                      <QrCode className="w-3.5 h-3.5 text-sky-600" /> QRIS / Statis / Dinamis
                    </span>
                    <span className="font-mono text-stone-900">{formatCurrency(paymentStats.qris)}</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{
                        width: `${paymentStats.total > 0 ? (paymentStats.qris / paymentStats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="flex items-center gap-1.5 text-stone-700">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Transfer / EDC / Debit
                    </span>
                    <span className="font-mono text-stone-900">{formatCurrency(paymentStats.transfer)}</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{
                        width: `${paymentStats.total > 0 ? (paymentStats.transfer / paymentStats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top 10 Menu Terlaris Hari Ini */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-stone-200/80 shadow-coffee">
              <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600" />
                10 Menu Paling Laris Hari Ini
              </h3>
              <p className="text-xs text-stone-500 mb-4">Peringkat menu dengan volume penjualan tertinggi</p>

              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {bestSellersTodayFull.map((item, idx) => (
                  <div
                    key={item.name}
                    className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 flex items-center justify-between text-xs hover:bg-stone-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-stone-900">{item.name}</p>
                        <p className="text-[10px] text-stone-500">{item.qty} cup/porsi terjual</p>
                      </div>
                    </div>
                    <span className="font-bold font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                ))}

                {bestSellersTodayFull.length === 0 && (
                  <div className="py-8 text-center text-xs text-stone-400">
                    Belum ada menu yang terjual hari ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: TRACKING STOK & INVENTORI PINTAR ─────────────────────────── */}
      {activeDashboardTab === "inventory" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                Total Nilai Aset Bahan Baku
              </span>
              <p className="text-2xl font-black font-mono text-stone-900">
                {formatCurrency(stockValuation.totalValue)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Dari total {stockValuation.totalIngredients} item bahan terdaftar
              </p>
            </div>
            <div className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                Status Stok Bahan
              </span>
              <p className="text-2xl font-black font-mono text-emerald-800">
                {stockValuation.safeCount} <span className="text-sm font-normal text-stone-500">Aman</span>
              </p>
              <p className="text-xs text-rose-600 font-bold mt-1">
                {stockValuation.criticalCount} item di bawah batas minimum
              </p>
            </div>
            <div className="p-5 bg-white rounded-3xl border border-stone-200/80 shadow-coffee">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                Purchase Order Berjalan
              </span>
              <p className="text-2xl font-black font-mono text-amber-900">
                {pendingDeliveries.length} PO
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Menunggu pengiriman & serah terima barang dari supplier
              </p>
            </div>
          </div>

          {/* Tabel Bahan Kritis */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Daftar Bahan Baku Kritis (Perlu Restock Segera)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Bahan baku yang sisa stoknya sudah di bawah batas minimum operasional
                </p>
              </div>
              <button
                onClick={() => onNavigate("purchases")}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buat PO Pembelian Bahan</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {lowStockIngredients.map((ing) => (
                <div
                  key={ing.id}
                  className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{ing.name}</p>
                    <p className="text-stone-500 mt-0.5">
                      Batas Aman: {ing.minStock} {ing.unit} · Harga Satuan: ~{formatCurrency(Number(ing.costPerUnit || 0))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-rose-800 bg-rose-100/90 px-3 py-1 rounded-xl text-sm border border-rose-200">
                      Sisa: {ing.currentStock} {ing.unit}
                    </span>
                    <button
                      onClick={() => onNavigate("purchases")}
                      className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 font-bold text-xs transition"
                    >
                      Pesan ke Supplier
                    </button>
                  </div>
                </div>
              ))}

              {lowStockIngredients.length === 0 && (
                <div className="py-12 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200/60">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-stone-700 text-sm">Semua Stok Bahan Aman</p>
                  <p className="text-stone-400 mt-0.5">Tidak ada bahan baku yang berada di bawah batas minimum.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: TRACKING TIM & SOP PINTAR ─────────────────────────────────── */}
      {activeDashboardTab === "team" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Schedule Approval Banner */}
          {scheduleApprovalAlerts.length > 0 && (
            <div className="space-y-3">
              {scheduleApprovalAlerts.map((alert) => (
                <div
                  key={alert.weekKey}
                  className="p-5 bg-gradient-to-r from-brand-50/70 via-slate-50 to-brand-50/40 border border-brand-200/80 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          alert.status === "PENDING"
                            ? "bg-brand-100 text-brand-800 border border-brand-200"
                            : "bg-slate-200/80 text-slate-700"
                        }`}>
                          {alert.status === "PENDING" ? "🔵 Diajukan Leader (Menunggu ACC)" : "⚪ Draft Jadwal Belum Disahkan"}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {alert.weekLabel} ({alert.dateRangeStr})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {alert.submittedBy 
                          ? <>Leader <strong>{alert.submittedBy}</strong> (Divisi {alert.divisions.join(", ") || "Tim"}) telah mengajukan <strong>{alert.shiftCount} penugasan shift</strong> dan menunggu pengesahan resmi dari Anda.</>
                          : <>Divisi <strong>{alert.divisions.join(", ") || "Tim"}</strong> memiliki <strong>{alert.shiftCount} penugasan shift</strong> yang belum disahkan secara resmi.</>
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={handleNavigateToSchedule}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <span>Tinjau di Jadwal SDM</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleQuickApproveSchedule(alert.weekKey, alert.weekLabel)}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ACC Sekarang (Sah)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid Absensi & Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kehadiran Staf */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-700" />
                  Presensi & Selfie Karyawan
                </h3>
                <button
                  onClick={() => onNavigate("hr")}
                  className="text-xs font-bold text-amber-800 hover:text-amber-900"
                >
                  Buka HR Management →
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {todayAttendances.map((att) => {
                  const emp = employees.find((e) => e.id === att.employeeId);
                  const hasPhoto = Boolean(att.clockInPhotoUrl || att.clockOutPhotoUrl);
                  return (
                    <div
                      key={att.id}
                      className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                          {emp?.name.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{emp?.name}</p>
                          <p className="text-[10px] text-stone-500">
                            {att.clockInTime ? `Masuk: ${new Date(att.clockInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Tidak hadir"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          att.status === "HADIR" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {att.status}
                        </span>
                        <button
                          onClick={() => setSelectedAttendancePhoto(att)}
                          className="p-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700"
                          title="Lihat Foto Selfie & GPS"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-800" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kepatuhan Checklist Jobdesk Divisi */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-amber-700" />
                  Kepatuhan Checklist Jobdesk Divisi
                </h3>
                <button
                  onClick={() => onNavigate("leader_checklist")}
                  className="text-xs font-bold text-amber-800 hover:text-amber-900"
                >
                  Buka Checklist →
                </button>
              </div>

              <div className="space-y-4">
                {divisionChecklists.map((div) => (
                  <div key={div.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-xs text-stone-900">{div.name}</span>
                      <span className="font-mono font-bold text-xs text-stone-900">{div.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          div.progress === 100 ? "bg-emerald-600" : div.progress > 50 ? "bg-amber-600" : "bg-rose-500"
                        }`}
                        style={{ width: `${div.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: OVERVIEW / COMMAND CENTER (DEFAULT VIEW) ────────────────── */}
      {activeDashboardTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-200">
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

          {/* Toast Notifikasi ACC Cepat */}
          <AnimatePresence>
            {approvedToast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{approvedToast}</span>
                </div>
                <button
                  onClick={() => setApprovedToast(null)}
                  className="font-bold text-emerald-700 hover:text-emerald-900"
                >
                  Tutup
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Schedule Approval Banner for Manager */}
          {scheduleApprovalAlerts.length > 0 && (
            <div className="space-y-3">
              {scheduleApprovalAlerts.map((alert) => (
                <div
                  key={alert.weekKey}
                  className="p-5 bg-gradient-to-r from-brand-50/70 via-slate-50 to-brand-50/40 border border-brand-200/80 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          alert.status === "PENDING"
                            ? "bg-brand-100 text-brand-800 border border-brand-200"
                            : "bg-slate-200/80 text-slate-700"
                        }`}>
                          {alert.status === "PENDING" ? "🔵 Diajukan Leader (Menunggu ACC)" : "⚪ Draft Jadwal Belum Disahkan"}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {alert.weekLabel} ({alert.dateRangeStr})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {alert.submittedBy 
                          ? <>Leader <strong>{alert.submittedBy}</strong> (Divisi {alert.divisions.join(", ") || "Tim"}) telah mengajukan <strong>{alert.shiftCount} penugasan shift</strong> dan menunggu pengesahan resmi dari Anda.</>
                          : <>Divisi <strong>{alert.divisions.join(", ") || "Tim"}</strong> memiliki <strong>{alert.shiftCount} penugasan shift</strong> yang belum disahkan secara resmi.</>
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={handleNavigateToSchedule}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <span>Tinjau di Jadwal SDM</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleQuickApproveSchedule(alert.weekKey, alert.weekLabel)}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ACC Sekarang (Sah)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HPP & Margin Simulator Banner / Quick Command */}
          <div className="bg-gradient-to-r from-brand-950 via-slate-900 to-brand-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border border-brand-800/40 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-full bg-radial from-brand-500/15 via-transparent to-transparent pointer-events-none" />
            <div className="space-y-2 relative z-10 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-brand-500/20 text-brand-300 uppercase border border-brand-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-brand-400" /> Fitur Baru Manajer
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Menu Engineering & Profitability
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Calculator className="w-6 h-6 text-brand-400" />
                Simulasi & Kalkulator HPP Menu
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Hitung biaya bahan baku riil, kemasan takeaway, buffer penyusutan barista (5%), serta simulasi target harga jual & margin laba ideal (food cost 28% - 32%) didukung AI Gemini.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center gap-1.5">
                  <span className="text-slate-300">Resep Terdaftar:</span>
                  <span className="font-bold font-mono text-brand-300">{hppStats.totalRecipes} Menu</span>
                </div>
                {hppStats.avgHpp > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center gap-1.5">
                    <span className="text-slate-300">Rata-rata HPP Bahan:</span>
                    <span className="font-bold font-mono text-emerald-300">~{formatCurrency(hppStats.avgHpp)}</span>
                  </div>
                )}
                <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center gap-1.5">
                  <span className="text-slate-300">Target Food Cost:</span>
                  <span className="font-bold text-brand-200">28% - 32%</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 w-full sm:w-auto shrink-0">
              <button
                onClick={() => onNavigate("hpp_calculator")}
                className="w-full sm:w-auto px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-md shadow-brand-600/30 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Buka Kalkulator HPP</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

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
                    <div className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500 font-semibold">Penanggung Jawab (PIC):</span>
                        <span className="font-bold text-stone-900 text-sm">
                          {activeShift.picEmployeeName || cashierUser?.name || "Kasir"}
                        </span>
                      </div>
                      {activeShift.teamMembers && activeShift.teamMembers.length > 0 && (
                        <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                          <span className="text-stone-500 text-[11px]">Kru Bertugas:</span>
                          <span className="font-semibold text-stone-700 text-[11px] truncate max-w-[200px]" title={activeShift.teamMembers.join(", ")}>
                            {activeShift.teamMembers.join(", ")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-stone-200/40">
                        <span className="text-stone-500">Mulai Shift:</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
                <a
                  href="/pos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-2xl bg-[#241813] hover:bg-[#1b130f] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-coffee-sm cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  <span>Terminal POS Kasir</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
                <a
                  href="/kds"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-2xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-coffee-sm cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-300" />
                  <span>Layar Dapur (KDS)</span>
                  <ExternalLink className="w-3 h-3 text-amber-200" />
                </a>
              </div>
            </div>

            {/* Kehadiran Staf Hari Ini (Live Attendance) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-700" />
                    Kehadiran Staf Hari Ini
                  </h2>
                  <div className="flex items-center gap-2">
                    {pendingToday.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm(`Sahkan / Setujui SEKALIGUS seluruh ${pendingToday.length} absensi yang menunggu verifikasi hari ini?`)) {
                            pendingToday.forEach((att) => {
                              updateDailyAttendance({
                                ...att,
                                approvalStatus: "APPROVED",
                              });
                            });
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        title="Sahkan seluruh absensi yang masih berstatus menunggu verifikasi hari ini"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Sahkan Semua ({pendingToday.length})</span>
                      </button>
                    )}
                    <span className="text-xs font-semibold text-stone-500">
                      Total: {attendanceStats.total} Karyawan
                    </span>
                  </div>
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

                {/* List Absensi Terbaru dengan Tombol Preview Foto Selfie & Verifikasi */}
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {todayAttendances.map((att) => {
                    const emp = employees.find((e) => e.id === att.employeeId);
                    const hasPhoto = Boolean(att.clockInPhotoUrl || att.clockOutPhotoUrl);
                    const appStatus = att.approvalStatus || "PENDING";

                    return (
                      <div
                        key={att.id}
                        className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 flex items-center justify-between text-xs hover:bg-stone-100/70 transition-colors"
                      >
                        <div
                          className="flex items-center gap-2.5 min-w-0 flex-1 mr-2 cursor-pointer"
                          onClick={() => setSelectedAttendancePhoto(att)}
                          title="Klik untuk membuka bukti foto & verifikasi"
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                            {emp?.name.charAt(0) || "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900 truncate">{emp?.name}</p>
                            <p className="text-[10px] text-stone-500 truncate">
                              {att.clockInTime
                                ? `Clock in: ${new Date(att.clockInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                                : att.notes || "Tidak hadir"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Badge Kehadiran */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              att.status === "HADIR"
                                ? "bg-emerald-100 text-emerald-800"
                                : att.status === "TERLAMBAT"
                                  ? "bg-amber-100 text-amber-800"
                                  : att.status === "ALPHA"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-stone-200 text-stone-700"
                            }`}
                          >
                            {att.status}
                          </span>

                          {/* Badge Pengesahan Manager */}
                          {appStatus === "APPROVED" ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5" title="Telah Disahkan oleh Manager">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sah</span>
                            </span>
                          ) : appStatus === "REJECTED" ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5" title="Ditolak oleh Manager (Set Alpha)">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Ditolak</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5" title="Menunggu Verifikasi Manager">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Review</span>
                            </span>
                          )}

                          {/* Quick Sahkan Button if not yet approved and not alpha */}
                          {appStatus !== "APPROVED" && att.status !== "ALPHA" && (
                            <button
                              onClick={() => updateDailyAttendance({ ...att, approvalStatus: "APPROVED" })}
                              title="Sahkan langsung dengan 1-klik"
                              className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Detail Button (Eye / Camera) */}
                          <button
                            onClick={() => setSelectedAttendancePhoto(att)}
                            title="Lihat Bukti Foto, GPS, & Detail Verifikasi"
                            className="p-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 shadow-2xs transition-colors"
                          >
                            {hasPhoto ? (
                              <Camera className="w-3.5 h-3.5 text-amber-800" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-stone-600" />
                            )}
                          </button>
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
                className="w-full mt-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                  className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
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

                    {div.notes && div.notes.length > 0 && (
                      <div className="mt-2.5 p-2 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[11px] text-amber-950 flex items-start gap-1.5">
                        <span className="font-bold shrink-0 text-amber-800">Catatan:</span>
                        <span className="italic truncate" title={div.notes.join("; ")}>
                          "{div.notes.join("; ")}"
                        </span>
                      </div>
                    )}
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
                      className="font-bold underline hover:text-amber-950 shrink-0 ml-2 cursor-pointer"
                    >
                      Cek PO
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => onNavigate("inventory")}
                className="w-full mt-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Buka Inventori & Order Bahan <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bagian Pengawasan Otorisasi & Promo Kasir (Fase 4) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Log Otorisasi Terkini (Void & Refund) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      Log Otorisasi Terkini (Void & Refund)
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Persetujuan pembatalan transaksi & pengembalian dana kasir.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1 border border-amber-200 cursor-pointer"
                  >
                    <span>Pusat Otorisasi</span>
                    {pendingApprovals.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-black">
                        {pendingApprovals.length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {approvalHistory.slice(0, 5).map((item) => {
                    const isApproved = item.status === "APPROVED";
                    const timeStr = item.respondedAt
                      ? new Date(item.respondedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "-";

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-center justify-between text-xs gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                              item.type === "REFUND"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {item.type}
                          </span>
                          <div className="truncate">
                            <p className="font-bold text-stone-900 truncate">
                              #{item.receiptNo} • {formatCurrency(item.amount)}
                            </p>
                            <p className="text-[11px] text-stone-500 truncate">
                              Kasir: {item.cashierName} · {item.reason}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isApproved
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {isApproved ? `Disetujui (${timeStr})` : `Ditolak (${timeStr})`}
                          </span>
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            Oleh: {item.respondedBy || "Manager"}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {approvalHistory.length === 0 && (
                    <div className="py-8 text-center text-xs text-stone-400">
                      <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      Belum ada riwayat otorisasi void atau refund yang tercatat hari ini.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 mt-4 flex justify-between items-center text-xs">
                <span className="text-stone-500">
                  Total Log: <strong>{approvalHistory.length} Otorisasi</strong>
                </span>
                <button
                  onClick={() => setIsApprovalModalOpen(true)}
                  className="font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka Dialog Otorisasi</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 2: Efektivitas Promo & Diskon POS */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 shadow-coffee flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      Promo & Diskon Kasir Aktif
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Promosi resmi yang dapat dipilih staf di terminal POS.
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate("promotions")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition flex items-center gap-1 border border-emerald-200 cursor-pointer"
                  >
                    <span>Kelola Promo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {(promotions || []).filter((p) => p.isActive).map((promo) => (
                    <div
                      key={promo.id}
                      className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200/60 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 truncate">{promo.name}</span>
                          {promo.code && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                              {promo.code}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Potongan:{" "}
                          <strong className="text-emerald-700">
                            {promo.type === "PERCENT" ? `${promo.value}%` : formatCurrency(promo.value)}
                          </strong>
                          {promo.minSpend ? ` · Min Belanja ${formatCurrency(promo.minSpend)}` : ""}
                        </p>
                      </div>

                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase shrink-0">
                        AKTIF DI KASIR
                      </span>
                    </div>
                  ))}

                  {(promotions || []).filter((p) => p.isActive).length === 0 && (
                    <div className="py-8 text-center text-xs text-stone-400">
                      <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      Tidak ada promo yang sedang aktif di terminal kasir saat ini.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 mt-4 flex justify-between items-center text-xs">
                <span className="text-stone-500">
                  Total Promo Aktif:{" "}
                  <strong>{(promotions || []).filter((p) => p.isActive).length} Promo</strong>
                </span>
                <button
                  onClick={() => onNavigate("promotions")}
                  className="font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Atur Promo & Diskon</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
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
                onClick={() => setActiveDashboardTab("sales")}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
              >
                Lihat Analisis Penjualan Lengkap <ArrowRight className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* Modal Preview Foto Selfie & Verifikasi Lokasi GPS Absensi */}
      <AnimatePresence>
        {selectedAttendancePhoto && createPortal(
          <motion.div
            key="attendance-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              key="attendance-card"
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="my-auto bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-coffee-lg border border-stone-200 max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar"
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
                {/* Employee Details & Status */}
                <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-100">
                  <div>
                    <p className="font-bold text-stone-900 text-sm">
                      {employees.find((e) => e.id === selectedAttendancePhoto.employeeId)?.name}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {employees.find((e) => e.id === selectedAttendancePhoto.employeeId)?.position || "Staff"} · Tanggal: {selectedAttendancePhoto.date}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      {selectedAttendancePhoto.status}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      selectedAttendancePhoto.approvalStatus === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedAttendancePhoto.approvalStatus === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                    }`}>
                      {selectedAttendancePhoto.approvalStatus === "APPROVED"
                        ? "Disahkan"
                        : selectedAttendancePhoto.approvalStatus === "REJECTED"
                          ? "Ditolak (Alpha)"
                          : "Menunggu Review"}
                    </span>
                  </div>
                </div>

                {/* Selfie Photo Preview (Clock In & Out) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 aspect-4/3 relative flex items-center justify-center">
                    {selectedAttendancePhoto.clockInPhotoUrl ? (
                      <>
                        <img
                          src={selectedAttendancePhoto.clockInPhotoUrl}
                          alt="Selfie Clock In"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-2 left-2 bg-emerald-600/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-2xs">
                          IN: {selectedAttendancePhoto.clockInTime ? new Date(selectedAttendancePhoto.clockInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </span>
                      </>
                    ) : (
                      <div className="text-center p-3 text-stone-400 text-xs">
                        <Camera className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        Tanpa foto Masuk
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 aspect-4/3 relative flex items-center justify-center">
                    {selectedAttendancePhoto.clockOutPhotoUrl ? (
                      <>
                        <img
                          src={selectedAttendancePhoto.clockOutPhotoUrl}
                          alt="Selfie Clock Out"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-2 left-2 bg-rose-600/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-2xs">
                          OUT: {selectedAttendancePhoto.clockOutTime ? new Date(selectedAttendancePhoto.clockOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </span>
                      </>
                    ) : (
                      <div className="text-center p-3 text-stone-400 text-xs">
                        <Camera className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        {selectedAttendancePhoto.clockOutTime ? "Tanpa foto Pulang" : "Belum Clock Out"}
                      </div>
                    )}
                  </div>
                </div>

                {/* GPS Location & Coordinate Info */}
                {selectedAttendancePhoto.clockInLocation ? (
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-stone-700">
                      <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <p className="font-bold">Koordinat GPS Masuk:</p>
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
                  <p className="text-xs text-stone-400 text-center italic py-1">
                    Koordinat GPS tidak terekam pada sesi absensi ini.
                  </p>
                )}

                {/* Notes / Reason if any */}
                {selectedAttendancePhoto.notes && (
                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/70 text-xs">
                    <p className="font-bold text-amber-900 mb-0.5">Catatan / Alasan:</p>
                    <p className="text-stone-700 leading-relaxed">{selectedAttendancePhoto.notes}</p>
                  </div>
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
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-coffee-sm flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verifikasi Hadir (Sah)</span>
                  </button>
                  <button
                    onClick={() => {
                      const empName = employees.find((e) => e.id === selectedAttendancePhoto.employeeId)?.name || "karyawan ini";
                      if (confirm(`Tolak kehadiran ${empName}? Status kehadiran akan diubah menjadi ALPHA (tidak mendapat tunjangan/gaji hari ini).`)) {
                        updateDailyAttendance({
                          ...selectedAttendancePhoto,
                          status: "ALPHA",
                          approvalStatus: "REJECTED",
                        });
                        setSelectedAttendancePhoto(null);
                      }
                    }}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl text-xs transition-colors border border-rose-200 flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Tolak (Set Alpha)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* Modal Pusat Otorisasi Remote (Remote In-App Approval) */}
      <ManagerApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onProcessed={fetchApprovalsData}
      />
    </div>
  );
};
