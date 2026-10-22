import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { PayrollRecord, LeaderAllowanceRule, DEFAULT_LEADER_ALLOWANCE_RULES } from "../types";
import {
  Calculator,
  CheckCircle,
  Clock,
  Download,
  Search,
  Wallet,
  AlertCircle,
  Edit2,
  FileText,
  X,
  Target,
  UserCheck,
  FileSpreadsheet,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  CheckCircle2,
  Users,
  TrendingUp,
  DollarSign,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { PayslipModal } from "./PayslipModal";
import { ExportModal } from "./ExportModal";
import { exportPayrollToXlsx } from "../utils/exportXlsx";
import { motion, AnimatePresence } from "motion/react";
import { CustomMonthPicker } from "./common/CustomMonthPicker";

export function Payroll() {
  const {
    employees,
    contracts,
    attendances,
    kpiRecords,
    payrollRecords,
    addPayrollRecord,
    updatePayrollRecord,
    deletePayrollRecord,
    bulkAddPayrollRecords,
    cashAccounts,
    addCashTransaction,
    expenseCategories,
    currentUser,
    users,
    isReadOnly,
    dailyAttendances,
    dailyChecklists,
    kpiTasks,
    kpiBonusRules,
    closedPeriods,
    settings,
    updateSettings,
    salesTransactions,
  } = (useStore() as any);

  const [period, setPeriod] = useState(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "generate">("list");
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payrollToPay, setPayrollToPay] = useState<PayrollRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: "",
    basicSalary: 0,
    mealAllowance: 0,
    positionAllowance: 0,
    transportAllowance: 0,
    kpiBonus: 0,
    targetBonus: 0,
    overtimePay: 0,
    alphaDeduction: 0,
    otherDeductions: 0,
    notes: "",
  });

  const isFinance = currentUser?.role === "FINANCE" || currentUser?.role === "SUPER_ADMIN";
  const isHRD = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";
  const canApprove = isHRD || currentUser?.role === "OWNER";
  const canPay = isFinance || currentUser?.role === "OWNER";
  const canEdit = !isReadOnly && (isHRD || currentUser?.role === "OWNER" || currentUser?.role === "SUPER_ADMIN");

  // Filter records based on period
  const currentPeriodRecords = useMemo(() => {
    let filtered = (payrollRecords || []).filter((r: PayrollRecord) => r.period === period);
    if (searchTerm) {
      filtered = filtered.filter((r: PayrollRecord) => {
        const empName = employees.find((e: any) => e.id === r.employeeId)?.name || "";
        return empName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    return filtered;
  }, [payrollRecords, period, searchTerm, employees]);

  // Store Revenue Target & Target Bonus Calculation
  const periodSales = useMemo(() => {
    return (salesTransactions || [])
      .filter((s: any) => s.date && s.date.startsWith(period))
      .reduce((sum: number, s: any) => sum + (s.finalAmount || s.totalAmount || 0), 0);
  }, [salesTransactions, period]);

  const monthlyTarget = settings?.monthlyRevenueTarget || 0;
  const isTargetAchieved = monthlyTarget > 0 && periodSales >= monthlyTarget;
  const isStoreBonusActive = settings?.enableStoreSalesBonus !== false;
  const targetBonusPerEmployee = (isTargetAchieved && isStoreBonusActive) ? (settings?.targetBonusAmount || 0) : 0;
  const achievementRate = monthlyTarget > 0 ? (periodSales / monthlyTarget) * 100 : 0;

  // Generate calculations for employees
  const generatedCalculations = useMemo(() => {
    const uniqueEmpIds = Array.from(new Set([
      ...employees.filter((e: any) => e.status === "AKTIF").map((e: any) => e.id),
      ...dailyAttendances.filter((a: any) => a.date.startsWith(period)).map((a: any) => a.employeeId)
    ]));

    return uniqueEmpIds.map((empId: any) => {
        const emp = employees.find((e: any) => e.id === empId) || users.find((u: any) => u.id === empId) || { id: empId, name: "Unknown Karyawan" };
        const contract = contracts.find((c: any) => c.employeeId === empId && (c.status === "ACTIVE" || c.isActive))
          || contracts.find((c: any) => c.employeeId === empId);
        
        // Auto-calculate from daily attendances (Opsi B: dihitung hadir kecuali ditolak Manager atau berstatus Alpha)
        const dailyLogs = dailyAttendances.filter((a: any) => a.employeeId === emp.id && a.date.startsWith(period));
        const presentDays = dailyLogs.filter((a: any) => ["HADIR", "TERLAMBAT"].includes(a.status) && a.approvalStatus !== "REJECTED").length;
        const alphaDays = dailyLogs.filter((a: any) => a.status === "ALPHA" || a.approvalStatus === "REJECTED").length;
        const kpi = kpiRecords.find((k: any) => k.employeeId === emp.id && k.period === period);

        const rawBasicSalary = contract?.basicSalary || contract?.baseSalary || 0;
        const dailyWage = Math.round(rawBasicSalary / 26);
        const rawPositionAllowance = contract?.positionAllowance || 0;
        const mealAllowanceRate = contract?.mealAllowance || 0;
        const transportAllowanceRate = contract?.transportAllowance || 0;
        const dailyBonusRate = contract?.dailyBonusRate || 0;
        const sopBonusRate = contract?.sopBonusRate || 0;
        
        const isManagerOrFinance = emp.position?.toUpperCase() === "MANAGER" || emp.position?.toUpperCase() === "FINANCE" || emp.role?.toUpperCase() === "MANAGER" || emp.role?.toUpperCase() === "FINANCE" || emp.department?.toUpperCase() === "FINANCE" || emp.department?.toUpperCase() === "MANAGEMENT";
        
        const totalBasicSalary = isManagerOrFinance ? rawBasicSalary : (presentDays * dailyWage);
        const totalMealAllowance = isManagerOrFinance ? (26 * mealAllowanceRate) : (presentDays * mealAllowanceRate);
        const totalTransportAllowance = isManagerOrFinance ? (26 * transportAllowanceRate) : (presentDays * transportAllowanceRate);
        const totalDailyBonus = isManagerOrFinance ? (26 * dailyBonusRate) : (presentDays * dailyBonusRate);
        
        // Otomatisasi Perhitungan Bonus KPI Berdasarkan Jobdesk & Disiplin
        const userObj = (users || []).find((u: any) => u.id === emp.id || u.username === emp.username);
        const isLeader = emp.position?.toUpperCase().includes("LEADER") || 
                         emp.position?.toUpperCase().includes("HEAD") ||
                         emp.position?.toUpperCase().includes("SPV") ||
                         emp.position?.toUpperCase().includes("SUPERVISOR") ||
                         userObj?.role === "LEADER" || 
                         dailyChecklists.some((c: any) => c.employeeId === emp.id || c.employeeId === userObj?.id);

        const empChecklists = (dailyChecklists || []).filter(
          (c: any) => (c.employeeId === emp.id || (userObj && c.employeeId === userObj.id)) && c.date.startsWith(period)
        );
        const checklistDays = empChecklists.length;
        const sopBonus = checklistDays >= 20 ? sopBonusRate : 0;
        
        const alphaDeduction = alphaDays * (contract?.alphaDeductionPerDay !== undefined && contract?.alphaDeductionPerDay !== 0 ? contract.alphaDeductionPerDay : dailyWage);
        
        // Potongan Keterlambatan Proporsional Jam Kerja
        const lateLogs = dailyLogs.filter((a: any) => a.status === "TERLAMBAT" && a.approvalStatus !== "REJECTED");
        const lateDays = lateLogs.length;
        let totalLateHours = 0;
        lateLogs.forEach((l: any) => {
          const match = l.notes?.match(/Terlambat\s+(\d+)\s+menit/i);
          if (match && match[1]) {
            totalLateHours += parseFloat(match[1]) / 60;
          } else if (l.clockInTime) {
            try {
              const clockIn = new Date(l.clockInTime);
              const dec = clockIn.getHours() + clockIn.getMinutes() / 60;
              let targetStart = 7;
              if (dec > 13) targetStart = 15;
              else if (dec > 9) targetStart = 11;
              const diff = Math.max(0, dec - targetStart);
              totalLateHours += diff > 0 ? diff : 0.5;
            } catch {
              totalLateHours += 0.5;
            }
          } else {
            totalLateHours += 0.5;
          }
        });
        const roundedLateHours = Math.round(totalLateHours * 10) / 10;
        const hourlyWage = Math.round(dailyWage / 8);
        const lateDeduction = Math.round(hourlyWage * roundedLateHours);

        const divisionBonusPlafon = settings?.divisionKpiBonusTarget?.[emp.department?.toUpperCase() || ""] || 0;
        const targetKpiBonus = contract?.kpiBonusTarget || divisionBonusPlafon || 0;
        const expectedDays = Math.max(1, presentDays || 22);

        // Otomatisasi Tunjangan Jabatan Leader Berbasis Capaian Jobdesk
        let positionAllowance = rawPositionAllowance;
        let leaderJobdeskScore = 0;
        let matchedLeaderTier: any = null;

        if (rawPositionAllowance > 0 && isLeader) {
          leaderJobdeskScore = checklistDays > 0 ? Math.min(100, Math.round((checklistDays / expectedDays) * 100)) : 0;
          const leaderRules: LeaderAllowanceRule[] = settings?.leaderJobdeskAllowanceRules && settings.leaderJobdeskAllowanceRules.length > 0
            ? settings.leaderJobdeskAllowanceRules
            : DEFAULT_LEADER_ALLOWANCE_RULES;
          const activeLeaderRules = leaderRules.filter((r) => r.isActive !== false);
          matchedLeaderTier = activeLeaderRules.find(
            (r) => leaderJobdeskScore >= r.minScore && leaderJobdeskScore <= r.maxScore
          );
          const isLeaderAllowanceActive = settings?.enableLeaderAllowanceBonus !== false;
          if (!isLeaderAllowanceActive) {
            positionAllowance = 0;
          } else {
            const payoutPct = matchedLeaderTier ? matchedLeaderTier.payoutPercentage : leaderJobdeskScore;
            positionAllowance = Math.round((rawPositionAllowance * payoutPct) / 100);
          }
        }

        // Skor KPI Otomatis: Leader dari Checklist Shift, Staf dari Presensi & Disiplin
        const autoScore = isLeader
          ? (checklistDays > 0 
              ? Math.max(0, Math.min(100, Math.round((checklistDays / expectedDays) * 100) - (lateDays * 5) - (alphaDays * 10)))
              : 0)
          : (presentDays > 0
              ? Math.max(0, 100 - (lateDays * 5) - (alphaDays * 10))
              : 0);

        // Cek Aturan Bonus Bertingkat (Tiered) Masuk Otomatis
        const isKpiScoreBonusActive = Boolean(settings?.enableKpiScoreBonus);
        const activeRules = (kpiBonusRules || []).filter((r: any) => r.isActive !== false);
        const applicableRule = autoScore > 0 ? activeRules.find((r: any) => autoScore >= r.minScore && autoScore <= r.maxScore) : undefined;

        const kpiBonus = (!isKpiScoreBonusActive || autoScore === 0)
          ? 0
          : (applicableRule 
              ? applicableRule.bonusAmount 
              : (targetKpiBonus > 0 ? Math.round(targetKpiBonus * (autoScore / 100)) : 0));

        const targetBonus = targetBonusPerEmployee;
        const overtimePay = 0;
        const otherDeductions = 0;
        
        const grossPay = totalBasicSalary + positionAllowance + totalMealAllowance + totalTransportAllowance + totalDailyBonus + sopBonus + kpiBonus + targetBonus + overtimePay;
        const netPay = grossPay - alphaDeduction - lateDeduction - otherDeductions;

        const completionPercentage = autoScore;

        const existingRecord = (payrollRecords || []).find(
          (r: PayrollRecord) => r.employeeId === emp.id && r.period === period
        );

        return {
          emp,
          existingRecord,
          performanceSummary: {
            presentDays,
            lateDays,
            lateHours: roundedLateHours,
            lateDeduction,
            alphaDays,
            checklistDays: isLeader ? checklistDays : presentDays,
            expectedDays: Math.max(1, presentDays || 22),
            completionPercentage,
            targetKpiBonus,
            isLeader,
          },
          calculation: {
            employeeId: emp.id,
            period,
            basicSalary: totalBasicSalary,
            mealAllowance: totalMealAllowance,
            positionAllowance,
            rawPositionAllowance,
            leaderJobdeskScore,
            matchedLeaderTier,
            transportAllowance: totalTransportAllowance,
            kpiBonus,
            targetBonus,
            overtimePay,
            alphaDeduction,
            lateDeduction,
            lateHours: roundedLateHours,
            lateDays,
            otherDeductions,
            grossPay,
            netPay: netPay > 0 ? netPay : 0,
            status: "DRAFT" as const,
          }
        };
      });
  }, [employees, contracts, attendances, kpiRecords, period, payrollRecords, dailyAttendances, dailyChecklists, users, kpiTasks, kpiBonusRules, targetBonusPerEmployee, settings]);

  const getEmpPerformanceSummary = (employeeId: string) => {
    const dailyLogs = (dailyAttendances || []).filter(
      (a: any) => a.employeeId === employeeId && a.date.startsWith(period)
    );
    const presentDays = dailyLogs.filter((a: any) => ["HADIR", "TERLAMBAT"].includes(a.status) && a.approvalStatus !== "REJECTED").length;
    const lateDays = dailyLogs.filter((a: any) => a.status === "TERLAMBAT" && a.approvalStatus !== "REJECTED").length;
    const alphaDays = dailyLogs.filter((a: any) => a.status === "ALPHA" || a.approvalStatus === "REJECTED").length;
    const sickOrLeaveDays = dailyLogs.filter((a: any) => ["IZIN", "SAKIT"].includes(a.status) && a.approvalStatus !== "REJECTED").length;

    const empObj = employees.find((e: any) => e.id === employeeId);
    const userObj = (users || []).find(
      (u: any) => u.id === employeeId || (empObj && u.username === empObj.username)
    );
    const empChecklists = (dailyChecklists || []).filter(
      (c: any) => (c.employeeId === employeeId || (userObj && c.employeeId === userObj.id)) && c.date.startsWith(period)
    );
    const checklistDays = empChecklists.length;
    const expectedDays = Math.max(1, presentDays || 22);

    const pos = (empObj?.position || "").toUpperCase();
    const isLeader = pos.includes("LEADER") || pos.includes("HEAD") || userObj?.role === "LEADER";

    const completionPercentage = isLeader
      ? Math.min(100, Math.round((checklistDays / expectedDays) * 100))
      : (presentDays > 0 ? Math.max(0, 100 - (lateDays * 5) - (alphaDays * 10)) : 0);

    return {
      presentDays,
      lateDays,
      alphaDays,
      sickOrLeaveDays,
      checklistDays: isLeader ? checklistDays : presentDays,
      expectedDays,
      completionPercentage,
      isLeader,
    };
  };

  const handleGenerateAll = () => {
    if (closedPeriods.some((p: any) => p.period === period)) {
      alert("Periode ini telah ditutup. Tidak dapat membuat slip gaji.");
      return;
    }

    const newRecords = generatedCalculations
      .filter(item => !item.existingRecord)
      .map(item => {
        const noteParts: string[] = [];
        if (isTargetAchieved && targetBonusPerEmployee > 0) {
          noteParts.push(`Termasuk Bonus Tembus Target Omzet (${formatCurrency(targetBonusPerEmployee)})`);
        }
        if (item.calculation.matchedLeaderTier && (item.calculation.rawPositionAllowance || 0) > 0) {
          noteParts.push(`Tunj. Jabatan Leader: ${item.calculation.matchedLeaderTier.grade} (${item.calculation.matchedLeaderTier.payoutPercentage}%)`);
        }
        return {
          id: `pay-${Date.now()}-${item.emp.id}`,
          ...item.calculation,
          notes: noteParts.length > 0 ? noteParts.join(" • ") : null,
          createdAt: new Date().toISOString()
        };
      });

    if (newRecords.length > 0) {
      if (confirm(`Generate ${newRecords.length} slip gaji untuk periode ${period}?`)) {
        bulkAddPayrollRecords(newRecords);
        setActiveTab("list");
      }
    } else {
      alert("Semua slip gaji untuk periode ini sudah tergenerate.");
      setActiveTab("list");
    }
  };

  const handleUpdateStatus = (record: PayrollRecord, newStatus: "APPROVED" | "PAID") => {
    if (closedPeriods.some((p: any) => p.period === record.period)) {
      alert("Periode ini telah ditutup.");
      return;
    }

    if (newStatus === "PAID") {
      setPayrollToPay(record);
      setPaymentModalOpen(true);
    } else {
      updatePayrollRecord({
        ...record,
        status: newStatus
      });
    }
  };

  const handleQuickExportXlsx = () => {
    if (currentPeriodRecords.length === 0) {
      alert(`Tidak ada data penggajian untuk periode ${period} yang dapat diekspor.`);
      return;
    }
    exportPayrollToXlsx({
      payroll: currentPeriodRecords,
      employees,
      settings,
      periodLabel: `Bulan_${period}`,
    });
  };

  const handleSelectManualEmployee = (empId: string) => {
    const contract =
      contracts.find((c: any) => c.employeeId === empId && c.status === "ACTIVE") ||
      contracts.find((c: any) => c.employeeId === empId);

    setManualForm((prev) => ({
      ...prev,
      employeeId: empId,
      basicSalary: contract?.basicSalary || 0,
      mealAllowance: contract?.mealAllowance || 0,
      positionAllowance: contract?.positionAllowance || 0,
      transportAllowance: contract?.transportAllowance || 0,
    }));
  };

  const handleSaveManualPayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.employeeId) {
      alert("Silakan pilih karyawan terlebih dahulu.");
      return;
    }

    const existing = (payrollRecords || []).find(
      (r: any) => r.employeeId === manualForm.employeeId && r.period === period
    );
    if (existing) {
      if (
        !confirm(
          `Karyawan ini sudah memiliki slip gaji pada periode ${period}. Apakah Anda ingin memperbarui (menimpa) slip gaji tersebut?`
        )
      ) {
        return;
      }
    }

    const bSal = Number(manualForm.basicSalary) || 0;
    const mAll = Number(manualForm.mealAllowance) || 0;
    const pAll = Number(manualForm.positionAllowance) || 0;
    const tAll = Number(manualForm.transportAllowance) || 0;
    const kBon = Number(manualForm.kpiBonus) || 0;
    const tBon = Number(manualForm.targetBonus) || 0;
    const oPay = Number(manualForm.overtimePay) || 0;
    const aDed = Number(manualForm.alphaDeduction) || 0;
    const oDed = Number(manualForm.otherDeductions) || 0;

    const gross = bSal + mAll + pAll + tAll + kBon + tBon + oPay;
    const net = Math.max(0, gross - aDed - oDed);

    const recordToSave: PayrollRecord = {
      id: existing ? existing.id : `pay-manual-${Date.now()}-${manualForm.employeeId}`,
      employeeId: manualForm.employeeId,
      period,
      basicSalary: bSal,
      mealAllowance: mAll,
      positionAllowance: pAll,
      transportAllowance: tAll,
      kpiBonus: kBon,
      targetBonus: tBon,
      overtimePay: oPay,
      alphaDeduction: aDed,
      otherDeductions: oDed,
      grossPay: gross,
      netPay: net,
      status: existing ? existing.status : ("DRAFT" as const),
      paidDate: existing ? existing.paidDate : null,
      paidVia: existing ? existing.paidVia : null,
      notes: manualForm.notes ? `[Manual] ${manualForm.notes}` : "[Manual Entry]",
      createdBy: currentUser?.name || "Admin",
      createdAt: new Date().toISOString(),
    };

    if (existing) {
      updatePayrollRecord(recordToSave);
    } else {
      addPayrollRecord(recordToSave);
    }

    setManualModalOpen(false);
    setManualForm({
      employeeId: "",
      basicSalary: 0,
      mealAllowance: 0,
      positionAllowance: 0,
      transportAllowance: 0,
      kpiBonus: 0,
      targetBonus: 0,
      overtimePay: 0,
      alphaDeduction: 0,
      otherDeductions: 0,
      notes: "",
    });
  };

  // KPI Summary Calculations
  const totalPayrollAmount = useMemo(() => {
    return currentPeriodRecords.reduce((sum: number, r: any) => sum + (r.netPay || 0), 0);
  }, [currentPeriodRecords]);

  const paidCount = useMemo(() => {
    return currentPeriodRecords.filter((r: any) => r.status === "PAID").length;
  }, [currentPeriodRecords]);

  const approvedCount = useMemo(() => {
    return currentPeriodRecords.filter((r: any) => r.status === "APPROVED").length;
  }, [currentPeriodRecords]);

  const draftCount = useMemo(() => {
    return currentPeriodRecords.filter((r: any) => r.status === "DRAFT").length;
  }, [currentPeriodRecords]);

  const avgNetPay = useMemo(() => {
    return currentPeriodRecords.length > 0 ? Math.round(totalPayrollAmount / currentPeriodRecords.length) : 0;
  }, [totalPayrollAmount, currentPeriodRecords]);

  return (
    <div className="space-y-6">
      {/* ─── BRAND HERO & TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200/80">
              <Sparkles className="w-3 h-3 text-brand-600" />
              Julia's • Payroll & Insentif Karyawan
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Penggajian & Slip Gaji
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kalkulasi otomatis take-home pay berdasarkan kehadiran shift, KPI checklist & target omset.
          </p>
        </div>

        {/* Month Selector Pill */}
        <div className="shrink-0">
          <CustomMonthPicker
            value={period}
            onChange={setPeriod}
            allowClear={false}
            placeholder="Pilih Periode Penggajian"
          />
        </div>
      </div>

      {/* ─── 4 BENTO KPI CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Penggajian */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Penggajian
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-200/80 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatCurrency(totalPayrollAmount)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{currentPeriodRecords.length} slip terdaftar</span>
          </p>
        </motion.div>

        {/* Card 2: Target Omzet Toko */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Target Omzet Toko
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              isTargetAchieved 
                ? "bg-emerald-50 text-emerald-600 border-emerald-200/80" 
                : "bg-indigo-50 text-indigo-600 border-indigo-200/80"
            }`}>
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-lg sm:text-2xl font-black font-mono tracking-tight ${
            isTargetAchieved ? "text-emerald-700" : "text-indigo-900"
          }`}>
            {monthlyTarget > 0 ? `${achievementRate.toFixed(1)}%` : "Belum Diatur"}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {isTargetAchieved ? "🎉 Tembus Target! Bonus Aktif" : `Omzet: ${formatCurrency(periodSales)}`}
          </p>
        </motion.div>

        {/* Card 3: Status Pencairan */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Status Pencairan
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            {paidCount} <span className="text-sm font-medium text-slate-400">/ {currentPeriodRecords.length}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-700 font-bold">{paidCount} Dibayar</span>
            <span>•</span>
            <span className="text-blue-700 font-bold">{approvedCount} Sah</span>
            <span>•</span>
            <span className="text-amber-700 font-bold">{draftCount} Draft</span>
          </p>
        </motion.div>

        {/* Card 4: Rata-rata Take Home Pay */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Rata-rata THP
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatCurrency(avgNetPay)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Per staf aktif periode berjalan
          </p>
        </motion.div>
      </div>

      {/* ─── FORMULA PENGGAJIAN COFFEE SHOP (TRANSPARAN & SEDERHANA) ─── */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-brand-500/20 text-brand-300 rounded-2xl border border-brand-400/30 shrink-0">
                <Calculator className="w-5 h-5 text-brand-300" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  Alur & Formula Payroll Coffee Shop Julia's
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-200 border border-brand-400/30 font-semibold">
                    SOP Terpadu
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Penggajian difokuskan pada kehadiran nyata, tunjangan penanggung jawab shift (Leader), dan bonus omset toko.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 block mb-1">1. Gaji Pokok Harian</span>
              <div className="font-black text-white text-sm">Hari Hadir × Upah Harian</div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Dihitung riil dari jumlah shift masuk aktif (Upah = Gaji Pokok / 26).
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 block mb-1">2. Makan & Transport</span>
              <div className="font-black text-white text-sm">Fasilitas Kehadiran</div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Uang makan & transport per hari hadir untuk operasional shift kerja.
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block mb-1">3. Tunjangan Leader</span>
              <div className="font-black text-amber-200 text-sm">Tanggung Jawab Shift</div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Khusus Head Bar/Kitchen/Baker yang mengawal SOP & checklist divisi.
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block mb-1">4. Bonus Omset Toko</span>
              <div className="font-black text-emerald-200 text-sm">Target Bersama Outlet</div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Jika penjualan toko tembus target bulanan, seluruh tim kecipratan bonus.
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 block mb-1">5. Potongan Disiplin</span>
              <div className="font-black text-rose-200 text-sm">Telat & Alpha</div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Hanya memotong jika staf terlambat jam kerja atau tidak masuk tanpa izin (Alpha).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TARGET OMZET STORE BANNER & POLICIES ─── */}
      {monthlyTarget > 0 && (
        <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs transition-all shadow-xs ${
          isTargetAchieved 
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" 
            : "bg-indigo-50/70 border-indigo-200 text-indigo-950"
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            <span className={`p-2.5 rounded-2xl text-white shadow-xs shrink-0 ${isTargetAchieved ? "bg-emerald-600" : "bg-indigo-600"}`}>
              <Target className="w-5 h-5" />
            </span>
            <div>
              <div className="font-bold flex items-center gap-2 text-sm flex-wrap">
                <span>Target Omzet Toko ({period}):</span>
                <span className="font-mono text-base font-black">{formatCurrency(periodSales)}</span>
                <span className="text-slate-400">/</span>
                <span className="font-mono font-bold text-slate-700">{formatCurrency(monthlyTarget)}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                  isTargetAchieved ? "bg-emerald-200 text-emerald-900 border border-emerald-300" : "bg-indigo-200 text-indigo-900 border border-indigo-300"
                }`}>
                  {achievementRate.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {!isStoreBonusActive 
                  ? "⚠️ Pencairan Bonus Omzet Toko saat ini DINONAKTIFKAN oleh kebijakan Manajer (tidak akan masuk ke slip gaji)."
                  : isTargetAchieved 
                    ? `🎉 TEMBUS TARGET! Seluruh staf otomatis menerima bonus omzet +${formatCurrency(targetBonusPerEmployee)}.` 
                    : `Belum tembus target. Kurang ${formatCurrency(Math.max(0, monthlyTarget - periodSales))} lagi untuk mencairkan bonus omzet.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            {/* Quick Toggle for Store Bonus */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <span className="text-xs font-semibold text-slate-700">Bonus Omzet:</span>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  updateSettings({
                    ...settings,
                    enableStoreSalesBonus: settings?.enableStoreSalesBonus === false,
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  settings?.enableStoreSalesBonus !== false
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300"
                } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                title="Klik untuk aktifkan / nonaktifkan pencairan bonus omzet toko"
              >
                {settings?.enableStoreSalesBonus !== false ? "✓ AKTIF" : "✕ NONAKTIF"}
              </button>
            </div>

            {/* Quick Toggle for Leader Allowance */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <span className="text-xs font-semibold text-slate-700">Tunj. Leader:</span>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  updateSettings({
                    ...settings,
                    enableLeaderAllowanceBonus: settings?.enableLeaderAllowanceBonus === false,
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  settings?.enableLeaderAllowanceBonus !== false
                    ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-300"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300"
                } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                title="Klik untuk aktifkan / nonaktifkan pencairan tunjangan jabatan leader"
              >
                {settings?.enableLeaderAllowanceBonus !== false ? "✓ AKTIF" : "✕ NONAKTIF"}
              </button>
            </div>

            {isTargetAchieved && targetBonusPerEmployee > 0 && (
              <div className="bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-xs font-mono text-emerald-800 font-bold shrink-0 text-xs">
                +{formatCurrency(targetBonusPerEmployee)} / Staf
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB NAVIGATION & ACTION TOOLBAR ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-3xl border border-slate-200/80 shadow-2xs">
        {/* Spring Sliding Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl relative">
          <button
            onClick={() => setActiveTab("list")}
            className={`relative z-10 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeTab === "list" ? "text-brand-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {activeTab === "list" && (
              <motion.div
                layoutId="payrollMainTab"
                className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/80"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Daftar Slip Gaji</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "list" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600"
              }`}>
                {currentPeriodRecords.length}
              </span>
            </span>
          </button>

          {!isReadOnly && isHRD && (
            <button
              onClick={() => setActiveTab("generate")}
              className={`relative z-10 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                activeTab === "generate" ? "text-brand-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {activeTab === "generate" && (
                <motion.div
                  layoutId="payrollMainTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/80"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>Generate & Preview</span>
                {generatedCalculations.some(c => !c.existingRecord) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </span>
            </button>
          )}
        </div>

        {/* Toolbar Buttons */}
        {activeTab === "list" && (
          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            {canEdit && (
              <button
                onClick={() => setManualModalOpen(true)}
                className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-2 bg-brand-50 border border-brand-200/80 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Buat slip gaji manual jika ada kekhususan data"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>+ Slip Manual</span>
              </button>
            )}

            <button
              onClick={handleQuickExportXlsx}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Unduh detail slip gaji periode ini dalam format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Buka opsi ekspor lengkap (PDF Rekap, CSV)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Laporan</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── TAB 1: DAFTAR SLIP GAJI ─── */}
      {activeTab === "list" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
          {/* Search bar & count */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/60">
            <div>
              <h2 className="font-black text-slate-800 text-base">Daftar Slip Gaji ({period})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {currentPeriodRecords.length} slip gaji pada periode ini
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Cari nama karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-base sm:text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none shadow-2xs transition-all"
              />
            </div>
          </div>

          {currentPeriodRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3 border border-slate-200">
                <Calculator className="w-8 h-8" />
              </div>
              <p className="font-bold text-slate-700">Belum ada slip gaji pada periode {period}.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Anda dapat membuat slip gaji otomatis dari presensi shift atau menambahkannya secara manual.
              </p>
              {isHRD && !isReadOnly && (
                <button 
                  onClick={() => setActiveTab("generate")}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Generate Slip Gaji Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Table View (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200/80">
                      <th className="p-4 font-bold">Karyawan</th>
                      <th className="p-4 font-bold">Kehadiran Shift</th>
                      <th className="p-4 font-bold">Tunjangan & Bonus</th>
                      <th className="p-4 font-bold text-right">Gaji Pokok</th>
                      <th className="p-4 font-bold text-right text-emerald-700">Take Home Pay</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {currentPeriodRecords.map((record: PayrollRecord) => {
                      const empObj = employees.find((e: any) => e.id === record.employeeId) || users.find((u: any) => u.id === record.employeeId);
                      const empName = empObj?.name || "Unknown";
                      const perf = getEmpPerformanceSummary(record.employeeId);
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{empName}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>{empObj?.position || "Staff"} • {empObj?.department || "Main"}</span>
                              {record.matchedLeaderTier && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  👑 {record.matchedLeaderTier.grade} ({record.matchedLeaderTier.payoutPercentage}%)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                {perf.presentDays} Hari Hadir
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                {perf.lateDays > 0 ? (
                                  <span className="text-amber-700 font-medium">({perf.lateDays} Terlambat)</span>
                                ) : (
                                  <span className="text-emerald-700 font-medium">(Tepat Waktu)</span>
                                )}
                                {perf.alphaDays > 0 && (
                                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded border border-rose-200">
                                    {perf.alphaDays} Alpha
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 text-xs">
                              {record.positionAllowance > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                  👑 Tunj. Leader +{formatCurrency(record.positionAllowance)}
                                </span>
                              )}
                              {(record.targetBonus || 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                                  🎯 Bonus Omset +{formatCurrency(record.targetBonus)}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 font-medium">
                                Makan/Transport: +{formatCurrency(record.mealAllowance + (record.transportAllowance || 0))}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-800">{formatCurrency(record.basicSalary)}</td>
                          <td className="p-4 text-right font-mono font-black text-emerald-700 text-base">{formatCurrency(record.netPay)}</td>
                          <td className="p-4">
                            {record.status === "DRAFT" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                                <Clock size={12} className="text-slate-500" /> Draft
                              </span>
                            )}
                            {record.status === "APPROVED" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                                <CheckCircle size={12} className="text-blue-600" /> Disetujui
                              </span>
                            )}
                            {record.status === "PAID" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                                <Wallet size={12} className="text-emerald-600" /> Dibayar
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedPayroll(record)}
                                className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-brand-200"
                                title="Lihat Detail & Slip Gaji"
                              >
                                <FileText size={16} />
                              </button>

                              {record.status === "DRAFT" && !isReadOnly && isHRD && !closedPeriods.some((p: any) => p.period === record.period) && (
                                <button
                                  onClick={() => setEditingPayroll(record)}
                                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-amber-200"
                                  title="Edit / Koreksi Slip Gaji"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}

                              {record.status === "DRAFT" && !isReadOnly && isHRD && !closedPeriods.some((p: any) => p.period === record.period) && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Hapus slip gaji untuk ${empName}?`)) {
                                      deletePayrollRecord(record.id);
                                    }
                                  }}
                                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200"
                                  title="Hapus Slip Gaji (Draft)"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              
                              {record.status === "DRAFT" && canApprove && !isReadOnly && !closedPeriods.some((p: any) => p.period === record.period) && (
                                <button
                                  onClick={() => handleUpdateStatus(record, "APPROVED")}
                                  className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded-xl font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                                >
                                  Setujui
                                </button>
                              )}
                              
                              {record.status === "APPROVED" && canPay && !isReadOnly && !closedPeriods.some((p: any) => p.period === record.period) && (
                                <button
                                  onClick={() => handleUpdateStatus(record, "PAID")}
                                  className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs rounded-xl font-bold transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1"
                                >
                                  <Wallet size={13} />
                                  <span>Bayar</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Feed View (block md:hidden) */}
              <div className="block md:hidden space-y-3 p-3 sm:p-4">
                {currentPeriodRecords.map((record) => {
                  const empObj = employees.find((e: any) => e.id === record.employeeId) || users.find((u: any) => u.id === record.employeeId);
                  const empName = empObj?.name || "Unknown";
                  const perf = getEmpPerformanceSummary(record.employeeId);
                  return (
                    <div
                      key={record.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2.5 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 border border-brand-200/80 font-black flex items-center justify-center text-sm shrink-0 shadow-2xs">
                            {empName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-slate-900 text-sm truncate flex items-center gap-1.5">
                              <span>{empName}</span>
                              {record.matchedLeaderTier && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                  👑 {record.matchedLeaderTier.grade}
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">
                              {empObj?.position || "Staff"} • {empObj?.department || "Main"}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {record.status === "DRAFT" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-500" /> Draft
                            </span>
                          )}
                          {record.status === "APPROVED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                              <CheckCircle className="w-3 h-3 text-blue-600" /> Disetujui
                            </span>
                          )}
                          {record.status === "PAID" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                              <Wallet className="w-3 h-3 text-emerald-600" /> Dibayar
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attendance Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {perf.presentDays} Hadir
                        </span>
                        <span className="text-slate-300">•</span>
                        {perf.lateDays > 0 ? (
                          <span className="text-amber-700 font-semibold">{perf.lateDays} Terlambat</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Tepat Waktu</span>
                        )}
                        {perf.alphaDays > 0 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {perf.alphaDays} Alpha
                            </span>
                          </>
                        )}
                      </div>

                      {/* Mini Bento Breakdown */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Gaji Pokok</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {formatCurrency(record.basicSalary)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Tunj. & Fasilitas</span>
                          <span className="font-mono font-bold text-blue-700 text-xs">
                            +{formatCurrency(record.mealAllowance + (record.transportAllowance || 0) + (record.positionAllowance || 0) + (record.targetBonus || 0) + (record.kpiBonus || 0) + (record.overtimePay || 0))}
                          </span>
                        </div>
                        {(record.alphaDeduction > 0 || (record.lateDeduction || 0) > 0 || record.otherDeductions > 0) && (
                          <div className="col-span-2 pt-1 border-t border-slate-200/60 flex justify-between items-center text-rose-600 font-medium">
                            <span className="text-[10px] uppercase font-bold tracking-wider">Total Potongan</span>
                            <span className="font-mono font-bold">
                              -{formatCurrency(record.alphaDeduction + (record.lateDeduction || 0) + record.otherDeductions)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer: Take Home Pay + Actions */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Take Home Pay</span>
                          <span className="font-mono font-black text-emerald-700 text-base">
                            {formatCurrency(record.netPay)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedPayroll(record)}
                            className="p-2 bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-700 rounded-xl transition-colors cursor-pointer border border-slate-200/60 active:scale-95"
                            title="Lihat Slip Gaji"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {record.status === "DRAFT" && !isReadOnly && isHRD && !closedPeriods.some((p: any) => p.period === record.period) && (
                            <>
                              <button
                                onClick={() => setEditingPayroll(record)}
                                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-colors cursor-pointer border border-amber-200/80 active:scale-95"
                                title="Edit Slip"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Hapus slip gaji untuk ${empName}?`)) {
                                    deletePayrollRecord(record.id);
                                  }
                                }}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors cursor-pointer border border-rose-200/80 active:scale-95"
                                title="Hapus Slip"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {record.status === "DRAFT" && canApprove && !isReadOnly && !closedPeriods.some((p: any) => p.period === record.period) && (
                            <button
                              onClick={() => handleUpdateStatus(record, "APPROVED")}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs cursor-pointer active:scale-95"
                            >
                              Setujui
                            </button>
                          )}

                          {record.status === "APPROVED" && canPay && !isReadOnly && !closedPeriods.some((p: any) => p.period === record.period) && (
                            <button
                              onClick={() => handleUpdateStatus(record, "PAID")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Bayar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 2: GENERATE & PREVIEW GAJI ─── */}
      {activeTab === "generate" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs space-y-0">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/60">
            <div>
              <h2 className="font-black text-slate-800 text-base">Preview Kalkulasi Gaji ({period})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hitungan estimasi otomatis dari seluruh presensi dan SOP shift tim aktif
              </p>
            </div>
            <button 
              onClick={handleGenerateAll}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan & Generate Semua Draft</span>
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200/80">
                  <th className="p-4 font-bold">Karyawan</th>
                  <th className="p-4 font-bold">Presensi Shift</th>
                  <th className="p-4 font-bold text-right">Gaji Pokok</th>
                  <th className="p-4 font-bold text-right">Makan & Transport</th>
                  <th className="p-4 font-bold text-right">Tunj. Leader</th>
                  <th className="p-4 font-bold text-right">Bonus Omset</th>
                  <th className="p-4 font-bold text-right">Potongan</th>
                  <th className="p-4 font-bold text-right text-emerald-700">Take Home Pay</th>
                  <th className="p-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {generatedCalculations.map(({ emp, calculation, existingRecord, performanceSummary }) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{emp.name}</div>
                      <div className="text-[11px] text-slate-400">{emp.position || "Staff"} • {emp.department || "Main"}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {performanceSummary.presentDays} Hari Hadir
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {performanceSummary.lateDays > 0 ? (
                            <span className="text-amber-700 font-medium">({performanceSummary.lateDays} Terlambat)</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">(Tepat Waktu)</span>
                          )}
                          {performanceSummary.alphaDays > 0 && (
                            <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded border border-rose-200">
                              {performanceSummary.alphaDays} Alpha
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(calculation.basicSalary)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-mono font-semibold">{formatCurrency(calculation.mealAllowance + (calculation.transportAllowance || 0))}</div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Kehadiran aktif</span>
                    </td>
                    <td className="p-4 text-right">
                      {calculation.positionAllowance > 0 ? (
                        <div>
                          <div className="font-mono font-bold text-amber-700">{formatCurrency(calculation.positionAllowance)}</div>
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            👑 {calculation.matchedLeaderTier?.grade || "Leader"} ({calculation.matchedLeaderTier?.payoutPercentage || 100}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {(calculation.targetBonus || 0) > 0 ? (
                        <div>
                          <div className="font-mono font-bold text-emerald-700">+{formatCurrency(calculation.targetBonus)}</div>
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            🎯 Tembus Target
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Belum capai</span>
                      )}
                    </td>
                    <td className="p-4 text-right text-rose-600">
                      <div className="font-mono font-semibold">-{formatCurrency(calculation.alphaDeduction + (calculation.lateDeduction || 0))}</div>
                      {(calculation.lateDeduction || 0) > 0 && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 block mt-0.5">
                          Telat: -{formatCurrency(calculation.lateDeduction || 0)}
                        </span>
                      )}
                      {calculation.alphaDeduction > 0 && (
                        <span className="text-[10px] text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 block mt-0.5">
                          Alpha: -{formatCurrency(calculation.alphaDeduction)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-black text-emerald-700 font-mono text-base">{formatCurrency(calculation.netPay)}</td>
                    <td className="p-4">
                      {existingRecord ? (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">Sudah Digenerate</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-300">Baru (Draft)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Feed View for Generated Calculations */}
          <div className="block md:hidden space-y-3 p-3 sm:p-4">
            {generatedCalculations.map(({ emp, calculation, existingRecord, performanceSummary }) => (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{emp.name}</h4>
                    <p className="text-xs text-slate-500">{emp.position || "Staff"} • {emp.department || "Main"}</p>
                  </div>
                  <div>
                    {existingRecord ? (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold border border-slate-200">Sudah Digenerate</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[11px] font-bold border border-amber-300">Baru (Draft)</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
                  <span className="font-bold text-slate-800">{performanceSummary.presentDays} Hari Hadir</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{performanceSummary.lateDays} Terlambat</span>
                  {performanceSummary.alphaDays > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-rose-600 font-bold">{performanceSummary.alphaDays} Alpha</span>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Gaji Pokok</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(calculation.basicSalary)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Makan & Transport</span>
                    <span className="font-mono font-bold text-blue-700">+{formatCurrency(calculation.mealAllowance + (calculation.transportAllowance || 0))}</span>
                  </div>
                  {calculation.positionAllowance > 0 && (
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex justify-between items-center text-amber-800">
                      <span className="text-[10px] uppercase font-bold">Tunjangan Leader:</span>
                      <span className="font-mono font-bold">+{formatCurrency(calculation.positionAllowance)}</span>
                    </div>
                  )}
                  {(calculation.targetBonus || 0) > 0 && (
                    <div className="col-span-2 flex justify-between items-center text-emerald-700">
                      <span className="text-[10px] uppercase font-bold">Bonus Target Omzet:</span>
                      <span className="font-mono font-bold">+{formatCurrency(calculation.targetBonus)}</span>
                    </div>
                  )}
                  {(calculation.alphaDeduction > 0 || (calculation.lateDeduction || 0) > 0) && (
                    <div className="col-span-2 flex justify-between items-center text-rose-600 font-medium pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] uppercase font-bold">Potongan Disiplin:</span>
                      <span className="font-mono font-bold">-{formatCurrency(calculation.alphaDeduction + (calculation.lateDeduction || 0))}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-600">Take Home Pay:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">{formatCurrency(calculation.netPay)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL EDIT / KOREKSI SLIP GAJI ─── */}
      {editingPayroll && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 flex justify-center items-start sm:items-center">
          <div className="my-auto bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh] border border-slate-200/80 overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">Edit & Koreksi Slip Gaji</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Karyawan: {employees.find((e: any) => e.id === editingPayroll.employeeId)?.name || editingPayroll.employeeId} • Periode: {editingPayroll.period}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPayroll(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar text-xs flex-1">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-amber-900 text-xs leading-relaxed">
                💡 <strong>Koreksi Fleksibel:</strong> Anda dapat menyesuaikan angka jika terdapat ketidaksesuaian absensi atau kesepakatan khusus. Total Take Home Pay akan dihitung otomatis secara live.
              </div>

              {/* Komponen Penghasilan */}
              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider block mb-2 pb-1 border-b border-slate-100">
                  A. Komponen Penghasilan / Tunjangan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Gaji Pokok (Upah Kehadiran)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.basicSalary || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const gross = val + (prev.positionAllowance || 0) + (prev.mealAllowance || 0) + (prev.transportAllowance || 0) + (prev.kpiBonus || 0) + (prev.targetBonus || 0) + (prev.overtimePay || 0);
                            const net = Math.max(0, gross - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, basicSalary: val, grossPay: gross, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Tunjangan Jabatan (Leader)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.positionAllowance || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const gross = (prev.basicSalary || 0) + val + (prev.mealAllowance || 0) + (prev.transportAllowance || 0) + (prev.kpiBonus || 0) + (prev.targetBonus || 0) + (prev.overtimePay || 0);
                            const net = Math.max(0, gross - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, positionAllowance: val, grossPay: gross, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Uang Makan</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.mealAllowance || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const gross = (prev.basicSalary || 0) + (prev.positionAllowance || 0) + val + (prev.transportAllowance || 0) + (prev.kpiBonus || 0) + (prev.targetBonus || 0) + (prev.overtimePay || 0);
                            const net = Math.max(0, gross - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, mealAllowance: val, grossPay: gross, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Uang Transport</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.transportAllowance || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const gross = (prev.basicSalary || 0) + (prev.positionAllowance || 0) + (prev.mealAllowance || 0) + val + (prev.kpiBonus || 0) + (prev.targetBonus || 0) + (prev.overtimePay || 0);
                            const net = Math.max(0, gross - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, transportAllowance: val, grossPay: gross, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Bonus KPI / Capaian</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.kpiBonus || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const gross = (prev.basicSalary || 0) + (prev.positionAllowance || 0) + (prev.mealAllowance || 0) + (prev.transportAllowance || 0) + val + (prev.targetBonus || 0) + (prev.overtimePay || 0);
                            const net = Math.max(0, gross - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, kpiBonus: val, grossPay: gross, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Tambahan Lembur / Bonus Khusus</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.overtimePay || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const gross = (prev.basicSalary || 0) + (prev.positionAllowance || 0) + (prev.mealAllowance || 0) + (prev.transportAllowance || 0) + (prev.kpiBonus || 0) + (prev.targetBonus || 0) + val;
                            const net = Math.max(0, gross - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, overtimePay: val, grossPay: gross, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Komponen Potongan */}
              <div>
                <span className="font-bold text-rose-700 uppercase tracking-wider block mb-2 pb-1 border-b border-rose-100">
                  B. Komponen Potongan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Potongan Alpha</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.alphaDeduction || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const net = Math.max(0, prev.grossPay - val - (prev.lateDeduction || 0) - (prev.otherDeductions || 0));
                            return { ...prev, alphaDeduction: val, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Potongan Telat</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.lateDeduction || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const net = Math.max(0, prev.grossPay - (prev.alphaDeduction || 0) - val - (prev.otherDeductions || 0));
                            return { ...prev, lateDeduction: val, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Potongan Lainnya</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingPayroll.otherDeductions || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditingPayroll((prev: any) => {
                            if (!prev) return null;
                            const net = Math.max(0, prev.grossPay - (prev.alphaDeduction || 0) - (prev.lateDeduction || 0) - val);
                            return { ...prev, otherDeductions: val, netPay: net };
                          });
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan Koreksi */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Catatan Slip Gaji / Alasan Koreksi</label>
                <input
                  type="text"
                  placeholder="Misal: Penyesuaian lembur event akhir pekan..."
                  value={editingPayroll.notes || ""}
                  onChange={(e) => setEditingPayroll((prev: any) => prev ? { ...prev, notes: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs"
                />
              </div>
              
              {/* Ringkasan Akhir */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Total Penghasilan Kotor (Gross):</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(editingPayroll.grossPay)}</span>
                </div>
                <div className="flex justify-between text-xs text-rose-300 mb-2">
                  <span>Total Seluruh Potongan:</span>
                  <span className="font-mono font-bold text-rose-300">
                    -{formatCurrency((editingPayroll.alphaDeduction || 0) + (editingPayroll.lateDeduction || 0) + (editingPayroll.otherDeductions || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-slate-700 pt-2 text-emerald-400">
                  <span>Take Home Pay (Diterima):</span>
                  <span className="font-mono text-lg">{formatCurrency(editingPayroll.netPay)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/90 shrink-0">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Take Home Pay</div>
                <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                  {formatCurrency(editingPayroll.netPay)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPayroll(null)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updatePayrollRecord(editingPayroll);
                    setEditingPayroll(null);
                  }}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer active:scale-95"
                >
                  Simpan Hasil Koreksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL BUAT SLIP GAJI MANUAL ─── */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 flex justify-center items-start sm:items-center">
          <div className="my-auto bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh] border border-slate-200/80 overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">Buat Slip Gaji Manual</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periode: {period} • Buat slip gaji kustom jika terdapat staf baru atau kondisi khusus
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveManualPayroll} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar text-xs flex-1">
                {/* Pilih Karyawan */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Pilih Karyawan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={manualForm.employeeId}
                    onChange={(e) => handleSelectManualEmployee(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-base sm:text-xs font-semibold bg-white"
                  >
                    <option value="">-- Pilih Staf Karyawan --</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position || "Staff"} • {emp.department || "Main"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Penghasilan */}
                <div>
                  <span className="font-bold text-slate-700 uppercase tracking-wider block mb-2 pb-1 border-b border-slate-100">
                    A. Komponen Penghasilan
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Gaji Pokok (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.basicSalary || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, basicSalary: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Tunjangan Jabatan (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.positionAllowance || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, positionAllowance: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Uang Makan (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.mealAllowance || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, mealAllowance: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Uang Transport (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.transportAllowance || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, transportAllowance: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Bonus KPI / Capaian (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.kpiBonus || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, kpiBonus: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Lembur / Insentif (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.overtimePay || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, overtimePay: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div>
                  <span className="font-bold text-rose-700 uppercase tracking-wider block mb-2 pb-1 border-b border-rose-100">
                    B. Potongan
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Potongan Alpha (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.alphaDeduction || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, alphaDeduction: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Potongan Terlambat / Lainnya (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-semibold text-xs pointer-events-none select-none">Rp</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={manualForm.otherDeductions || ""}
                          onChange={(e) => setManualForm(prev => ({ ...prev, otherDeductions: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono text-base sm:text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catatan */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Catatan Khusus</label>
                  <input
                    type="text"
                    placeholder="Alasan pembuatan manual / catatan untuk karyawan..."
                    value={manualForm.notes}
                    onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 text-base sm:text-xs"
                  />
                </div>

                {/* Live Preview Take Home Pay */}
                {(() => {
                  const gross = (manualForm.basicSalary || 0) + (manualForm.mealAllowance || 0) + (manualForm.positionAllowance || 0) + (manualForm.transportAllowance || 0) + (manualForm.kpiBonus || 0) + (manualForm.targetBonus || 0) + (manualForm.overtimePay || 0);
                  const deductions = (manualForm.alphaDeduction || 0) + (manualForm.otherDeductions || 0);
                  const net = Math.max(0, gross - deductions);
                  return (
                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span>Penghasilan Kotor:</span>
                        <span className="font-mono font-bold text-white">{formatCurrency(gross)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-rose-300 mb-2">
                        <span>Total Potongan:</span>
                        <span className="font-mono font-bold text-rose-300">-{formatCurrency(deductions)}</span>
                      </div>
                      <div className="flex justify-between text-base font-black border-t border-slate-700 pt-2 text-emerald-400">
                        <span>Take Home Pay Diterima:</span>
                        <span className="font-mono text-lg">{formatCurrency(net)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {(() => {
                const gross = (manualForm.basicSalary || 0) + (manualForm.mealAllowance || 0) + (manualForm.positionAllowance || 0) + (manualForm.transportAllowance || 0) + (manualForm.kpiBonus || 0) + (manualForm.targetBonus || 0) + (manualForm.overtimePay || 0);
                const deductions = (manualForm.alphaDeduction || 0) + (manualForm.otherDeductions || 0);
                const net = Math.max(0, gross - deductions);
                return (
                  <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/90 shrink-0">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Take Home Pay</div>
                      <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                        {formatCurrency(net)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setManualModalOpen(false)}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer active:scale-95"
                      >
                        Simpan Slip Gaji Manual
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL EXPORT LAPORAN ─── */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultModule="payroll"
      />

      {/* ─── MODAL LIHAT SLIP GAJI ─── */}
      {selectedPayroll && (
        <PayslipModal
          payroll={selectedPayroll}
          onClose={() => setSelectedPayroll(null)}
        />
      )}

      {/* ─── MODAL BAYAR GAJI KARYAWAN ─── */}
      {paymentModalOpen && payrollToPay && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-6 flex justify-center items-start sm:items-center">
          <div className="my-auto bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200/80 overflow-hidden max-h-[85vh] sm:max-h-[88vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <h2 className="text-lg font-black text-slate-800 flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-emerald-600" />
                Bayar Gaji Karyawan
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setPayrollToPay(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Penerima</p>
                <p className="font-bold text-slate-900 text-base">
                  {employees.find((e: any) => e.id === payrollToPay.employeeId)?.name}
                </p>
                <div className="mt-3 flex justify-between items-end border-t border-slate-200/60 pt-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Total Dibayarkan (THP)</p>
                    <p className="text-2xl font-black font-mono text-emerald-700">
                      {formatCurrency(payrollToPay.netPay)}
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const accountId = formData.get("accountId") as string;
                  if (!accountId) return;
                  
                  const account = cashAccounts.find((a: any) => a.id === accountId);
                  const salaryCat = expenseCategories?.find((c: any) => c.name.toLowerCase().includes("gaji"));

                  addCashTransaction({
                    accountId: account.id,
                    type: "CASH_OUT",
                    date: new Date().toISOString(),
                    amount: payrollToPay.netPay,
                    description: `Pembayaran Gaji - ${employees.find((e: any) => e.id === payrollToPay.employeeId)?.name} (${payrollToPay.period})`,
                    category: salaryCat ? salaryCat.name : "Gaji Karyawan",
                    categoryId: salaryCat ? salaryCat.id : null,
                    referenceId: payrollToPay.id,
                  });

                  updatePayrollRecord({
                    ...payrollToPay,
                    status: "PAID",
                    paidDate: new Date().toISOString(),
                    paidVia: account.id
                  });

                  setPaymentModalOpen(false);
                  setPayrollToPay(null);
                }}
              >
                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Gunakan Pos Kas / Rekening:
                  </label>
                  <select
                    name="accountId"
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-base sm:text-xs font-semibold bg-white"
                  >
                    <option value="">-- Pilih Pos Kas Pembayaran --</option>
                    {cashAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalOpen(false);
                      setPayrollToPay(null);
                    }}
                    className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold text-xs flex items-center shadow-xs cursor-pointer active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Konfirmasi Bayar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
