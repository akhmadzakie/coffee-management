import React, { useState, useMemo } from "react";
import { 
  Save, X, BookOpen, Target, Award, Sparkles, 
  Users, Sliders, TrendingUp, CheckCircle2, AlertCircle, DollarSign, Check
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { DEFAULT_LEADER_ALLOWANCE_RULES } from "../types";

export const KPI: React.FC = () => {
  const { 
    employees, 
    isReadOnly,
    currentUser, 
    user,
    settings,
    updateSettings,
    salesTransactions,
    contracts,
    dailyChecklists,
    users
  } = useStore() as any;

  const [activeSubTab, setActiveSubTab] = useState<"guide" | "target" | "tasks">("guide");
  const loggedInUser = currentUser || user;
  const canEditHR = (loggedInUser?.role === "OWNER" || loggedInUser?.role === "MANAGER" || loggedInUser?.role === "SUPER_ADMIN") && !isReadOnly;

  // State for Store Target & Bonus
  const defaultTarget = settings?.monthlyRevenueTarget || 150000000;
  const defaultBonus = settings?.targetBonusAmount || 250000;
  const [targetInput, setTargetInput] = useState<string>(defaultTarget.toString());
  const [bonusInput, setBonusInput] = useState<string>(defaultBonus.toString());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [policyToast, setPolicyToast] = useState<string | null>(null);

  // Current month metrics
  const currentPeriod = useMemo(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  }, []);

  const currentMonthSales = useMemo(() => {
    return (salesTransactions || [])
      .filter((s: any) => s.date && s.date.startsWith(currentPeriod))
      .reduce((sum: number, s: any) => sum + (s.finalAmount || s.totalAmount || 0), 0);
  }, [salesTransactions, currentPeriod]);

  const isOperationalStaff = (emp: any): boolean => {
    const dept = (emp.department || "").toUpperCase();
    const pos = (emp.position || "").toUpperCase();
    return !(
      pos.includes("MANAGER") || pos.includes("MANAJER") ||
      dept.includes("MANAGEMENT") || dept.includes("MANAJEMEN") ||
      pos.includes("OWNER") || dept.includes("OWNER") ||
      pos.includes("FINANCE") || dept.includes("FINANCE") ||
      pos.includes("KEUANGAN") || dept.includes("KEUANGAN") ||
      pos.includes("ACCOUNTING") || dept.includes("ACCOUNTING") ||
      pos.includes("AKUNTAN") || dept.includes("AKUNTAN") ||
      pos.includes("ADMIN") || dept.includes("ADMIN") ||
      pos.includes("HRD") || dept.includes("HRD") ||
      pos.includes("HR")
    );
  };

  const activeEmployees = useMemo(() => {
    return (employees || []).filter((e: any) => e.status !== "INACTIVE" && isOperationalStaff(e));
  }, [employees]);

  // Rekapitulasi Capaian KPI Jobdesk Seluruh Karyawan (Leader vs Staf)
  const employeeKpiSummary = useMemo(() => {
    return activeEmployees.map((emp: any) => {
      const userObj = (users || []).find((u: any) => u.id === emp.id || u.username === emp.username);
      const isLeader = emp.position?.toUpperCase().includes("LEADER") || 
                       emp.position?.toUpperCase().includes("HEAD") ||
                       userObj?.role === "LEADER";

      const deptStr = (emp.department || emp.position || "").toUpperCase();
      let divKey: "BAR" | "KITCHEN" | "BAKER" = "BAR";
      if (deptStr.includes("KITCHEN")) divKey = "KITCHEN";
      else if (deptStr.includes("BAKE") || deptStr.includes("PASTRY")) divKey = "BAKER";
      else divKey = "BAR";

      const contract = (contracts || []).find((c: any) => c.employeeId === emp.id && c.status === "ACTIVE") ||
                       (contracts || []).find((c: any) => c.employeeId === emp.id);

      const rawPositionAllowance = contract?.positionAllowance || (isLeader ? 500000 : 0);

      // Checklists count this month
      const empChecklists = (dailyChecklists || []).filter(
        (c: any) => (c.employeeId === emp.id || (userObj && c.employeeId === userObj.id)) && c.date.startsWith(currentPeriod)
      );

      const checklistDays = empChecklists.length;
      const score = isLeader 
        ? (checklistDays > 0 ? Math.min(100, Math.round((checklistDays / 22) * 100)) : 0)
        : 100; // Staf operasional tidak dibebani checklist, KPI otomatis penuh standar kehadiran

      // Evaluasi Tunjangan Jabatan Leader (Grade A-D)
      const leaderRules = settings?.leaderJobdeskAllowanceRules && settings.leaderJobdeskAllowanceRules.length > 0
        ? settings.leaderJobdeskAllowanceRules
        : DEFAULT_LEADER_ALLOWANCE_RULES;
      const activeLeaderRules = leaderRules.filter((r: any) => r.isActive !== false);
      const matchedLeaderTier = isLeader && checklistDays > 0
        ? activeLeaderRules.find((r: any) => score >= r.minScore && score <= r.maxScore)
        : null;

      const isLeaderAllowanceActive = settings?.enableLeaderAllowanceBonus !== false;
      const payoutPct = matchedLeaderTier ? matchedLeaderTier.payoutPercentage : (isLeader ? (score > 0 ? score : 0) : 100);
      const estimatedAllowance = isLeader && isLeaderAllowanceActive ? Math.round((rawPositionAllowance * payoutPct) / 100) : 0;

      const tierBadge = isLeader
        ? (!isLeaderAllowanceActive
            ? "Tunjangan Dinonaktifkan"
            : (checklistDays === 0
                ? "Belum Ada Supervisi" 
                : (matchedLeaderTier ? `${matchedLeaderTier.grade} (${matchedLeaderTier.payoutPercentage}%)` : `${score}%`)))
        : "Operasional Shift (Bebas Checklist)";

      return {
        emp,
        userObj,
        isLeader,
        divKey,
        rawPositionAllowance,
        estimatedAllowance,
        matchedLeaderTier,
        payoutPct,
        checklistDays,
        score,
        tierBadge,
      };
    });
  }, [activeEmployees, users, settings, contracts, dailyChecklists, currentPeriod]);

  const monthlyTarget = settings?.monthlyRevenueTarget || 150000000;
  const targetBonusAmount = settings?.targetBonusAmount || 0;
  const achievementRate = monthlyTarget > 0 ? (currentMonthSales / monthlyTarget) * 100 : 0;
  const isTargetAchieved = currentMonthSales >= monthlyTarget && monthlyTarget > 0;

  const handleToggleBonusPolicy = (key: "enableStoreSalesBonus" | "enableLeaderAllowanceBonus") => {
    if (!canEditHR) return;
    const currentVal = settings?.[key] !== false;
    const nextVal = !currentVal;
    updateSettings({
      ...settings,
      [key]: nextVal,
    });
    const label = key === "enableStoreSalesBonus" ? "Bonus Omzet Toko" : "Tunjangan Leader";
    setPolicyToast(`Kebijakan ${label} berhasil diubah ke: ${nextVal ? "AKTIF" : "NONAKTIF"}`);
    setTimeout(() => setPolicyToast(null), 3000);
  };

  const handleSaveStoreTargetSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = String(targetInput).replace(/\D/g, "");
    const parsedTarget = parseInt(cleanTarget, 10);
    const newTarget = !isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : monthlyTarget;

    const cleanBonus = String(bonusInput).replace(/\D/g, "");
    const parsedBonus = parseInt(cleanBonus, 10);
    const newBonus = !isNaN(parsedBonus) && parsedBonus >= 0 ? parsedBonus : 0;

    updateSettings({
      ...settings,
      monthlyRevenueTarget: newTarget,
      targetBonusAmount: newBonus,
    });

    setSaveSuccessMsg("Pengaturan Target Omzet & Bonus Staf berhasil disimpan!");
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const getEmployeeName = (id: string) => {
    return employees.find((e: any) => e.id === id)?.name || id;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header & Sub-Tabs */}
      <div className="border-b border-slate-200 bg-slate-50/70 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <Award className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                Pusat Skema Bonus & Target Toko
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Panduan transparansi dan konfigurasi besaran target omzet toko serta tunjangan supervisi leader.
            </p>
          </div>

          {/* Quick Status Pill */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-xs">
            <span className="text-slate-500 font-medium">Bulan Ini ({currentPeriod}):</span>
            <span className={`font-bold px-2 py-0.5 rounded-md ${
              isTargetAchieved ? "bg-emerald-100 text-emerald-800" : "bg-indigo-50 text-indigo-700"
            }`}>
              {achievementRate.toFixed(1)}% Omzet
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-5 border-b border-slate-200">
          <button
            onClick={() => setActiveSubTab("guide")}
            className={`pb-3 px-3 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors ${
              activeSubTab === "guide"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x border-slate-200"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            📖 Panduan & Alur Bonus Otomatis
          </button>

          <button
            onClick={() => setActiveSubTab("target")}
            className={`pb-3 px-3 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors ${
              activeSubTab === "target"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x border-slate-200"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Target className="w-4 h-4 text-emerald-600" />
            🎯 Bonus Tembus Target Toko
            {targetBonusAmount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold rounded-full">
                Aktif
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("tasks")}
            className={`pb-3 px-3 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors ${
              activeSubTab === "tasks"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x border-slate-200"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4 text-indigo-600" />
            👥 Rekapitulasi Insentif Tim
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* ─── MASTER SWITCH: KEBIJAKAN AKTIF / NONAKTIFKAN BONUS ─── */}
        <div className="mb-6 p-4 rounded-2xl border bg-slate-50/80 border-slate-200/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <Sliders className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Saklar Kebijakan Pencairan Bonus Sistem</h3>
                <p className="text-[11px] text-slate-500">
                  Atur aktif atau nonaktifnya pencairan bonus pada slip gaji & penggajian bulan ini sesuai kebijakan Manajer/Owner.
                </p>
              </div>
            </div>
            {!canEditHR && (
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-semibold self-start sm:self-auto">
                Hanya Manajer / Owner
              </span>
            )}
          </div>

          {policyToast && (
            <div className="mb-3 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl flex items-center justify-between shadow-xs animate-fade-in">
              <span>{policyToast}</span>
              <button type="button" onClick={() => setPolicyToast(null)} className="text-white/80 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Bonus Omzet Toko */}
            <div className={`p-4 rounded-xl border transition-all ${
              settings?.enableStoreSalesBonus !== false
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                : "bg-white border-slate-200 text-slate-500 opacity-80"
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                  <span>🎯</span> Bonus Omzet Toko
                </span>
                <button
                  type="button"
                  disabled={!canEditHR}
                  onClick={() => handleToggleBonusPolicy("enableStoreSalesBonus")}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    settings?.enableStoreSalesBonus !== false
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  } ${!canEditHR ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {settings?.enableStoreSalesBonus !== false ? "✓ AKTIF" : "✕ NONAKTIF"}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed">
                {settings?.enableStoreSalesBonus !== false
                  ? `Bonus ${formatCurrency(targetBonusAmount)}/staf otomatis dicairkan jika omzet tembus target.`
                  : "Dinonaktifkan: Bonus omzet tidak akan dicairkan ke slip gaji meskipun target omzet tercapai."}
              </p>
            </div>

            {/* 2. Tunjangan Jabatan Leader (Grade A-D) */}
            <div className={`p-4 rounded-xl border transition-all ${
              settings?.enableLeaderAllowanceBonus !== false
                ? "bg-indigo-50/80 border-indigo-200 text-indigo-950"
                : "bg-white border-slate-200 text-slate-500 opacity-80"
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                  <span>👑</span> Tunjangan Leader (A–D)
                </span>
                <button
                  type="button"
                  disabled={!canEditHR}
                  onClick={() => handleToggleBonusPolicy("enableLeaderAllowanceBonus")}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    settings?.enableLeaderAllowanceBonus !== false
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  } ${!canEditHR ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {settings?.enableLeaderAllowanceBonus !== false ? "✓ AKTIF" : "✕ NONAKTIF"}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed">
                {settings?.enableLeaderAllowanceBonus !== false
                  ? "Tunjangan evaluasi checklist Leader (25% - 100%) aktif dicairkan pada payroll."
                  : "Dinonaktifkan: Tunjangan evaluasi Leader ditangguhkan dan bernilai Rp 0 pada penggajian."}
              </p>
            </div>
          </div>
        </div>

        {/* ─── TAB 1: PANDUAN LENGKAP CARA KERJA BONUS OTOMATIS ─── */}
        {activeSubTab === "guide" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 p-5 rounded-2xl border border-indigo-100">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Transparansi Perhitungan Bonus di Modul Penggajian (Payroll)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Sistem Julia's ini menghubungkan data dari <strong>Kontrak Kerja</strong>, <strong>Checklist Jobdesk Leader</strong>, <strong>Presensi & Evaluasi</strong>, dan <strong>Penjualan Kasir</strong> secara otomatis ke dalam slip gaji. Berikut rincian cara kerjanya:
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Cards Alur */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Leader Jobdesk */}
              <div className="p-5 rounded-2xl border border-amber-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <Award className="w-3.5 h-3.5 text-amber-600" /> Khusus Leader (Supervisi & QC)
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Head Bar, Kitchen, Baker</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  1. Jobdesk Leader: Supervisi Stasiun Kerja & QC
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Tugas Utama:</strong> Kalibrasi grinder & espresso, cek suhu kulkas/chiller susu, kontrol absensi & briefing tim, rotasi FIFO bahan baku, dan inspeksi kebersihan station.
                  </p>
                  <p>
                    <strong>Penentu Tunjangan Jabatan:</strong> Persentase pemenuhan checklist supervisi menentukan pencairan Tunjangan Jabatan Leader sesuai tabel Grade (Grade A 100%, Grade B 80%, dst.).
                  </p>
                  <div className="p-2 bg-amber-50/80 rounded-lg font-mono text-[11px] text-amber-950 border border-amber-200">
                    Tunjangan Cair = (% Payout Sesuai Grade) × Tunjangan Jabatan Kontrak
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    *Diatur oleh Manager di menu Checklist Supervisi Leader.
                  </p>
                </div>
              </div>

              {/* Card 2: Staff KPI & Jobdesk */}
              <div className="p-5 rounded-2xl border border-sky-100 bg-white hover:border-sky-200 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    <Users className="w-3.5 h-3.5" /> Khusus Staf Pelaksana Shift
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Barista, Cook, Kasir</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  2. Staf Pelaksana: Fokus Operasional & Pelayanan
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Tugas Utama:</strong> Pembuatan pesanan minuman/makanan, pelayanan kasir yang ramah, sanitasi meja & alat, dan prep bahan baku harian sesuai jadwal shift.
                  </p>
                  <p>
                    <strong>Bebas Beban Checklist:</strong> Staf tidak dibebani kewajiban mengisi checklist aplikasi agar operasional gesit dan fokus melayani pelanggan.
                  </p>
                  <div className="p-2 bg-sky-50/70 rounded-lg font-mono text-[11px] text-sky-900 border border-sky-100">
                    Kedisiplinan: Hadir Shift 8 Jam (Potongan Keterlambatan Proporsional Jika Telat)
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    *Staf tetap berhak menerima Bonus Tembus Target Omzet Kedai jika penjualan toko tercapai.
                  </p>
                </div>
              </div>

              {/* Card 3: Tiered Rules */}
              <div className="p-5 rounded-2xl border border-amber-100 bg-white hover:border-amber-200 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <TrendingUp className="w-3.5 h-3.5" /> Patokan Grade Leader
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Tiered Grade</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  3. Aturan Grade Pencairan Tunjangan Leader
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Tabel Grade Standar:</strong> Diatur Manager pada tab Aturan Tunjangan Jabatan di menu Checklist Leader:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                    <li>Skor 90% – 100% ➔ <strong>Grade A (Cair 100%)</strong></li>
                    <li>Skor 80% – 89% ➔ <strong>Grade B (Cair 80%)</strong></li>
                    <li>Skor 70% – 79% ➔ <strong>Grade C (Cair 50%)</strong></li>
                    <li>Skor &lt; 70% ➔ <strong>Grade D (Hangus 0%)</strong></li>
                  </ul>
                  <p className="text-slate-500 text-[11px]">
                    *Memastikan Leader aktif membimbing tim dan mengontrol kualitas setiap hari kerja.
                  </p>
                </div>
              </div>

              {/* Card 4: Store Sales Target */}
              <div className="p-5 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-200 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Target className="w-3.5 h-3.5" /> Tim Bersama (Bagi Hasil)
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Omzet Bulanan</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  4. Bonus Tembus Target Omzet Kedai
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Sumber Angka:</strong> Diatur di tab <em>Bonus Tembus Target Toko</em> (Target Omzet Bulanan & Bonus Per Staf).
                  </p>
                  <p>
                    <strong>Cara Kerja:</strong> Sistem membandingkan total penjualan kasir pada bulan tersebut dengan target toko.
                  </p>
                  <div className="p-2 bg-emerald-50/70 rounded-lg font-mono text-[11px] text-emerald-900 border border-emerald-100">
                    Jika Realisasi Omzet ≥ Target Omzet ➔ Semua Staf & Leader Dapat Bonus Sama Rata
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    *Otomatis dicairkan sebagai baris tersendiri di tabel penggajian dan slip gaji karyawan.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Button to Configure Target */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveSubTab("target")}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <Target className="w-4 h-4" /> Atur Target Omzet & Bonus Staf Sekarang
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 2: BONUS TEMBUS TARGET OMZET TOKO ─── */}
        {activeSubTab === "target" && (
          <div className="space-y-6">
            {/* Live Progress Card */}
            <div className={`p-6 rounded-2xl border ${
              isTargetAchieved 
                ? "bg-gradient-to-br from-emerald-500/10 via-emerald-50 to-white border-emerald-200" 
                : "bg-gradient-to-br from-indigo-500/10 via-indigo-50 to-white border-indigo-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`p-2 rounded-xl text-white ${isTargetAchieved ? "bg-emerald-600" : "bg-indigo-600"}`}>
                      <Target className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        Target Omzet Bulanan Kedai: Periode {currentPeriod}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Pantau realisasi transaksi penjualan kasir terhadap target omzet toko.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                    isTargetAchieved 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                      : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                  }`}>
                    {isTargetAchieved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {isTargetAchieved ? "🎉 TARGET TERPENUHI (BONUS AKTIF)" : "⏳ TARGET BELUM TERCAPAI"}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-end text-xs font-bold">
                  <span className="text-slate-600">
                    Realisasi: <strong className="text-slate-900 text-sm font-mono">{formatCurrency(currentMonthSales)}</strong>
                  </span>
                  <span className="text-slate-600">
                    Target: <strong className="text-slate-900 text-sm font-mono">{formatCurrency(monthlyTarget)}</strong>
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isTargetAchieved ? "bg-emerald-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${Math.min(achievementRate, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>Pencapaian: <strong>{achievementRate.toFixed(1)}%</strong></span>
                  <span>
                    {isTargetAchieved 
                      ? `Surplus Omzet: +${formatCurrency(currentMonthSales - monthlyTarget)}` 
                      : `Kurang: ${formatCurrency(Math.max(0, monthlyTarget - currentMonthSales))} lagi`}
                  </span>
                </div>
              </div>

              {/* Impact Banner */}
              <div className="mt-5 p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">Status Insentif Staf:</span>
                  <span className="text-slate-500">
                    {isTargetAchieved 
                      ? `Setiap staf aktif otomatis menerima bonus omzet ${formatCurrency(targetBonusAmount)} pada penggajian bulan ini.`
                      : `Bonus sebesar ${formatCurrency(targetBonusAmount)} / staf akan otomatis aktif saat omzet mencapai target.`}
                  </span>
                </div>
                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-mono text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block font-sans">Beban Bonus Toko ({activeEmployees.length} Staf):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(activeEmployees.length * targetBonusAmount)}</span>
                </div>
              </div>
            </div>

            {/* Form Settings Target & Bonus */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-600" />
                    Konfigurasi Besaran Target & Bonus Toko
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hanya Manager atau Owner yang dapat memperbarui pengaturan target ini.
                  </p>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  {saveSuccessMsg}
                </div>
              )}

              <form onSubmit={handleSaveStoreTargetSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target Omzet Toko Bulanan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">Rp</span>
                    <input 
                      type="number"
                      step="1000000"
                      disabled={!canEditHR}
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder="Contoh: 150000000"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Patokan penjualan bersih kotor/netto yang ingin diraih kedai dalam sebulan.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nominal Bonus Per Karyawan Saat Tembus Target (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">Rp</span>
                    <input 
                      type="number"
                      step="50000"
                      disabled={!canEditHR}
                      value={bonusInput}
                      onChange={(e) => setBonusInput(e.target.value)}
                      placeholder="Contoh: 250000"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Nominal bonus yang langsung masuk ke slip gaji masing-masing karyawan.
                  </span>
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  {canEditHR && (
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Simpan Pengaturan Target & Bonus
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── TAB 3: DAFTAR TASK KPI KARYAWAN ─── */}
        {activeSubTab === "tasks" && (
          <div className="space-y-6">
            {/* Live Rekap Capaian KPI Jobdesk Karyawan */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    Rekapitulasi Kinerja & Hak Tunjangan Tim ({currentPeriod})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Leader dinilai dari konsistensi supervisi stasiun kerja (penentu Tunjangan Jabatan). Staf pelaksana fokus operasional shift (berhak atas Bonus Omzet Toko).
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                  {employeeKpiSummary.length} Karyawan Aktif
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-3 px-4 font-semibold">Karyawan</th>
                      <th className="py-3 px-4 font-semibold">Jabatan & Divisi</th>
                      <th className="py-3 px-4 font-semibold text-center">Peran Tim</th>
                      <th className="py-3 px-4 font-semibold">Fokus & Indikator Kerja</th>
                      <th className="py-3 px-4 font-semibold text-center">Capaian / Skor</th>
                      <th className="py-3 px-4 font-semibold text-right">Status Hak Insentif & Tunjangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeKpiSummary.map((item: any) => (
                      <tr key={item.emp.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {item.emp.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.emp.position || "Staff"} ({item.divKey === "BAR" ? "Bar & Kasir" : item.divKey === "KITCHEN" ? "Kitchen" : "Baker"})
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.isLeader ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              👑 Leader QC
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              🧑‍🍳 Staf Pelaksana
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {item.isLeader ? (
                            <span className="font-medium text-slate-800">
                              Supervisi Stasiun Kerja ({item.checklistDays} hari aktif)
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              Operasional Shift • Bebas Checklist
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.isLeader ? (
                            <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                              item.score >= 90 ? "bg-emerald-100 text-emerald-800" : item.score >= 70 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                            }`}>
                              {item.score}%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ Disiplin Hadir
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.isLeader ? (
                            <div>
                              <p className="font-mono font-bold text-amber-700">
                                {item.tierBadge}
                              </p>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {settings?.enableLeaderAllowanceBonus === false
                                  ? "Tunj. Jabatan: Rp 0 (Dinonaktifkan)"
                                  : `Tunj. Jabatan: ${formatCurrency(item.estimatedAllowance)} (${item.payoutPct}%)`}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <p className="font-bold text-slate-800 text-[11px]">
                                {settings?.enableStoreSalesBonus === false ? (
                                  <span className="text-slate-400 font-semibold italic">Dinonaktifkan</span>
                                ) : isTargetAchieved ? (
                                  <span className="text-emerald-700 font-bold">🎉 Siap Cair: +{formatCurrency(targetBonusAmount)}</span>
                                ) : (
                                  <span className="text-slate-500">Menunggu Target Toko</span>
                                )}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                Bonus Omzet Kedai
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {employeeKpiSummary.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Belum ada data staf aktif.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

