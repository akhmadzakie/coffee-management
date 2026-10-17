import React, { useState, useMemo, useRef } from "react";
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
  Award,
  Sparkles,
  CheckSquare,
  TrendingUp,
  Calendar,
  UserCheck
} from "lucide-react";
import { PayslipModal } from "./PayslipModal";

export function Payroll() {
  const {
    employees,
    contracts,
    attendances,
    kpiRecords,
    payrollRecords,
    addPayrollRecord,
    updatePayrollRecord,
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
        // If they don't have attendance records, they still get full allowance assuming 26 days if they are manager/finance
        const totalMealAllowance = isManagerOrFinance ? (26 * mealAllowanceRate) : (presentDays * mealAllowanceRate);
        const totalTransportAllowance = isManagerOrFinance ? (26 * transportAllowanceRate) : (presentDays * transportAllowanceRate);
        const totalDailyBonus = isManagerOrFinance ? (26 * dailyBonusRate) : (presentDays * dailyBonusRate);
        
        // ─── Otomatisasi Perhitungan Bonus KPI Berdasarkan Jobdesk & Disiplin ───
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
        
        const alphaDeduction = alphaDays * (contract?.alphaDeductionPerDay !== undefined && contract?.alphaDeductionPerDay !== 0 ? contract.alphaDeductionPerDay : dailyWage); // Penalty for alpha
        
        // ─── Potongan Keterlambatan Proporsional Jam Kerja (Upah Harian / 8 Jam Kerja) ───
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

        // ─── Otomatisasi Tunjangan Jabatan Leader Berbasis Capaian Jobdesk ───
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

        // ─── Skor KPI Otomatis: Leader dari Checklist Shift, Staf dari Presensi & Disiplin ───
        const autoScore = isLeader
          ? (checklistDays > 0 
              ? Math.max(0, Math.min(100, Math.round((checklistDays / expectedDays) * 100) - (lateDays * 5) - (alphaDays * 10)))
              : 0)
          : (presentDays > 0
              ? Math.max(0, 100 - (lateDays * 5) - (alphaDays * 10))
              : 0);

        // ─── Cek Aturan Bonus Bertingkat (Tiered) Masuk Otomatis ───
        const isKpiScoreBonusActive = settings?.enableKpiScoreBonus !== false;
        const activeRules = (kpiBonusRules || []).filter((r: any) => r.isActive !== false);
        const applicableRule = autoScore > 0 ? activeRules.find((r: any) => autoScore >= r.minScore && autoScore <= r.maxScore) : undefined;

        // Jika ada aturan tiered yang aktif dan skor karyawan masuk rentang, gunakan nominal tiered otomatis!
        // Jika tidak, gunakan perhitungan proporsional dari plafon kontrak/divisi (% skor × target)
        const kpiBonus = (!isKpiScoreBonusActive || autoScore === 0)
          ? 0
          : (applicableRule 
              ? applicableRule.bonusAmount 
              : (targetKpiBonus > 0 ? Math.round(targetKpiBonus * (autoScore / 100)) : 0));

        const targetBonus = targetBonusPerEmployee;
        const overtimePay = 0; // Default no overtime
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
            basicSalary: totalBasicSalary, // Fix undefined variable basicSalary
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
  }, [employees, contracts, attendances, kpiRecords, period, payrollRecords, dailyAttendances, dailyChecklists, users, kpiTasks, kpiBonusRules, targetBonusPerEmployee]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Penggajian (Payroll)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kalkulasi otomatis take-home pay berdasarkan kehadiran dan kontrak
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent"
          />
          {!isReadOnly && isHRD && (
            <button
              onClick={() => setActiveTab(activeTab === "generate" ? "list" : "generate")}
              className="flex items-center gap-2 bg-primary hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {activeTab === "generate" ? "Lihat Riwayat" : <><Calculator size={16} /> Generate Payroll</>}
            </button>
          )}
        </div>
      </div>

      {activeTab === "generate" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
          {/* Target Omzet Store Status Banner */}
          {monthlyTarget > 0 && (
            <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isTargetAchieved 
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" 
                : "bg-indigo-50/70 border-indigo-200 text-indigo-950"
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl text-white shadow-xs ${isTargetAchieved ? "bg-emerald-600" : "bg-indigo-600"}`}>
                  <Target className="w-4 h-4" />
                </span>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    Target Omzet Toko ({period}): 
                    <span className="font-mono">{formatCurrency(periodSales)}</span> / <span className="font-mono">{formatCurrency(monthlyTarget)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isTargetAchieved ? "bg-emerald-200 text-emerald-900" : "bg-indigo-200 text-indigo-900"
                    }`}>
                      {achievementRate.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {!isStoreBonusActive 
                      ? "⚠️ Pencairan Bonus Omzet Toko saat ini DINONAKTIFKAN oleh kebijakan Manajer (tidak akan masuk ke slip gaji)."
                      : isTargetAchieved 
                        ? `🎉 TEMBUS TARGET! Seluruh staf otomatis menerima bonus omzet +${formatCurrency(targetBonusPerEmployee)}.` 
                        : `Belum tembus target. Kurang ${formatCurrency(Math.max(0, monthlyTarget - periodSales))} lagi untuk mencairkan bonus omzet.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                {/* Quick Toggle for Store Bonus */}
                <div className="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-600">Bonus Omzet:</span>
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
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
                <div className="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-600">Tunj. Leader:</span>
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
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

          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-slate-800">Preview Kalkulasi Gaji ({period})</h2>
            <button 
              onClick={handleGenerateAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Simpan & Generate Semua Draft
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="p-4 font-medium border-b border-slate-200">Karyawan</th>
                  <th className="p-4 font-medium border-b border-slate-200">Kehadiran (Shift)</th>
                  <th className="p-4 font-medium border-b border-slate-200">Jobdesk & KPI</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Gaji Pokok</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Tunjangan</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Bonus KPI & Omzet</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Potongan Alpha</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right text-emerald-700">Take Home Pay</th>
                  <th className="p-4 font-medium border-b border-slate-200">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {generatedCalculations.map(({ emp, calculation, existingRecord, performanceSummary }) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{emp.name}</div>
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
                    <td className="p-4">
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-indigo-700">{performanceSummary.completionPercentage}%</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {performanceSummary.isLeader 
                              ? `${performanceSummary.checklistDays}/${performanceSummary.expectedDays} Shift` 
                              : `${performanceSummary.presentDays}/${performanceSummary.expectedDays} Hadir`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              performanceSummary.completionPercentage >= 90 ? "bg-emerald-500" :
                              performanceSummary.completionPercentage >= 70 ? "bg-indigo-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${performanceSummary.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">{formatCurrency(calculation.basicSalary)}</td>
                    <td className="p-4 text-right">
                      <div>{formatCurrency(calculation.positionAllowance + calculation.mealAllowance + (calculation.transportAllowance || 0))}</div>
                      {Boolean(calculation.rawPositionAllowance && calculation.rawPositionAllowance > 0 && calculation.matchedLeaderTier) && (
                        <div className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          👑 {calculation.matchedLeaderTier?.grade} ({calculation.matchedLeaderTier?.payoutPercentage}%)
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right text-emerald-600">
                      <div>+{formatCurrency(calculation.kpiBonus)}</div>
                      {(calculation.targetBonus || 0) > 0 && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          🎯 +{formatCurrency(calculation.targetBonus)} (Omzet)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right text-rose-600">
                      <div>-{formatCurrency(calculation.alphaDeduction + (calculation.lateDeduction || 0))}</div>
                      {(calculation.lateDeduction || 0) > 0 && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 block mt-0.5">
                          Telat: -{formatCurrency(calculation.lateDeduction || 0)} ({calculation.lateHours || 0}j)
                        </span>
                      )}
                      {calculation.alphaDeduction > 0 && (
                        <span className="text-[10px] text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 block mt-0.5">
                          Alpha: -{formatCurrency(calculation.alphaDeduction)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800">{formatCurrency(calculation.netPay)}</td>
                    <td className="p-4">
                      {existingRecord ? (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">Sudah Digenerate</span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium border border-amber-200">Baru (Draft)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
            <h2 className="font-semibold text-slate-800">Daftar Slip Gaji ({period})</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="p-4 font-medium border-b border-slate-200">Karyawan</th>
                  <th className="p-4 font-medium border-b border-slate-200">Kehadiran (Bulan Ini)</th>
                  <th className="p-4 font-medium border-b border-slate-200">Capaian Jobdesk & KPI</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Gaji Pokok</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right text-emerald-700">Take Home Pay</th>
                  <th className="p-4 font-medium border-b border-slate-200">Status</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {currentPeriodRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p>Belum ada data penggajian untuk periode ini.</p>
                      {isHRD && (
                        <button 
                          onClick={() => setActiveTab("generate")}
                          className="mt-3 text-primary hover:underline text-sm font-medium"
                        >
                          Generate sekarang
                        </button>
                      )}
                    </td>
                  </tr>
                ) : currentPeriodRecords.map((record: PayrollRecord) => {
                  const empObj = employees.find((e: any) => e.id === record.employeeId) || users.find((u: any) => u.id === record.employeeId);
                  const empName = empObj?.name || "Unknown";
                  const perf = getEmpPerformanceSummary(record.employeeId);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{empName}</div>
                        <div className="text-[11px] text-slate-400">
                          {empObj?.position || "Staff"} • {empObj?.department || "Main"}
                          {record.matchedLeaderTier && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
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
                        <div className="flex flex-col gap-1 w-32">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-indigo-700">{perf.completionPercentage}%</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {perf.isLeader 
                                ? `${perf.checklistDays}/${perf.expectedDays} Shift` 
                                : `${perf.presentDays}/${perf.expectedDays} Hadir`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                perf.completionPercentage >= 90 ? "bg-emerald-500" :
                                perf.completionPercentage >= 70 ? "bg-indigo-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${perf.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">{formatCurrency(record.basicSalary)}</td>
                      <td className="p-4 text-right font-bold text-slate-800">{formatCurrency(record.netPay)}</td>
                      <td className="p-4">
                        {record.status === "DRAFT" && (
                          <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200">
                            <Clock size={12} /> Draft
                          </span>
                        )}
                        {record.status === "APPROVED" && (
                          <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
                            <CheckCircle size={12} /> Disetujui
                          </span>
                        )}
                        {record.status === "PAID" && (
                          <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium border border-emerald-200">
                            <Wallet size={12} /> Dibayar
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPayroll(record)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                            title="Lihat Detail & Slip Gaji"
                          >
                            <FileText size={16} />
                          </button>

                          {record.status === "DRAFT" && !isReadOnly && isHRD && !closedPeriods.some((p: any) => p.period === record.period) && (
                            <button
                              onClick={() => setEditingPayroll(record)}
                              className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                              title="Edit Manual (Lembur / Potongan)"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          
                          {record.status === "DRAFT" && canApprove && !isReadOnly && !closedPeriods.some((p: any) => p.period === record.period) && (
                            <button
                              onClick={() => handleUpdateStatus(record, "APPROVED")}
                              className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded font-medium transition-colors"
                            >
                              Setujui
                            </button>
                          )}
                          
                          {record.status === "APPROVED" && canPay && !isReadOnly && !closedPeriods.some((p: any) => p.period === record.period) && (
                            <button
                              onClick={() => handleUpdateStatus(record, "PAID")}
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs rounded font-medium transition-colors"
                            >
                              Tandai Dibayar
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
        </div>
      )}

      {/* Slip Gaji Modal */}
      {editingPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Edit Tambahan Manual</h2>
              <button
                onClick={() => setEditingPayroll(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tambahan Lain (Misal: Lembur)
                </label>
                <input
                  type="number"
                  value={editingPayroll.overtimePay || 0}
                  onChange={(e) => {
                    const overtimePay = parseFloat(e.target.value) || 0;
                    setEditingPayroll(prev => {
                      if (!prev) return null;
                      const grossPay = prev.basicSalary + prev.positionAllowance + prev.mealAllowance + (prev.transportAllowance || 0) + prev.kpiBonus + overtimePay;
                      const netPay = grossPay - prev.alphaDeduction - prev.otherDeductions;
                      return { ...prev, overtimePay, grossPay, netPay: netPay > 0 ? netPay : 0 };
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Potongan Manual (Cth: Terlambat, Hukuman)
                </label>
                <input
                  type="number"
                  value={editingPayroll.otherDeductions || 0}
                  onChange={(e) => {
                    const otherDeductions = parseFloat(e.target.value) || 0;
                    setEditingPayroll(prev => {
                      if (!prev) return null;
                      const netPay = prev.grossPay - prev.alphaDeduction - otherDeductions;
                      return { ...prev, otherDeductions, netPay: netPay > 0 ? netPay : 0 };
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl mt-4 border border-slate-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Gaji Pokok & Tunjangan Dasar:</span>
                  <span className="font-medium text-slate-800">{formatCurrency(editingPayroll.basicSalary + editingPayroll.positionAllowance + editingPayroll.mealAllowance + (editingPayroll.transportAllowance || 0) + editingPayroll.kpiBonus)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-emerald-600">Lembur/Tambahan Manual:</span>
                  <span className="font-medium text-emerald-600">+{formatCurrency(editingPayroll.overtimePay || 0)}</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-rose-600">Total Potongan (Alpha + Manual):</span>
                  <span className="font-medium text-rose-600">-{formatCurrency((editingPayroll.alphaDeduction || 0) + (editingPayroll.otherDeductions || 0))}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-3">
                  <span className="text-slate-800">Total Take Home Pay:</span>
                  <span className="text-emerald-600">{formatCurrency(editingPayroll.netPay)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingPayroll(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  updatePayrollRecord(editingPayroll);
                  setEditingPayroll(null);
                }}
                className="px-4 py-2 bg-primary text-white font-medium hover:bg-slate-800 rounded-lg"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPayroll && (
        <PayslipModal
          payroll={selectedPayroll}
          onClose={() => setSelectedPayroll(null)}
        />
      )}
      {/* Payment Modal */}
      {paymentModalOpen && payrollToPay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-emerald-600" />
                Bayar Gaji Karyawan
              </h2>
              <button
                onClick={() => {
                  setPaymentModalOpen(false);
                  setPayrollToPay(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">Penerima</p>
                <p className="font-semibold text-slate-800">
                  {employees.find((e: any) => e.id === payrollToPay.employeeId)?.name}
                </p>
                <div className="mt-4 flex justify-between items-end">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total Dibayarkan</p>
                    <p className="text-2xl font-bold text-emerald-600">
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
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gunakan Pos Kas / Rekening:
                  </label>
                  <select
                    name="accountId"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  >
                    <option value="">-- Pilih Pos Kas --</option>
                    {cashAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
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
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center"
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
