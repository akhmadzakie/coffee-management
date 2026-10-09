import React, { useState, useMemo } from "react";
import { 
  Plus, Edit2, Trash2, Save, X, BookOpen, Target, Award, Sparkles, 
  CheckCircle2, TrendingUp, Info, HelpCircle, Users, Check, AlertCircle,
  Calendar, DollarSign
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";

export const KPI: React.FC = () => {
  const { 
    kpiTasks, 
    employees, 
    updateKpiTask, 
    kpiBonusRules, 
    updateKpiBonusRule, 
    currentUser, 
    user,
    settings,
    updateSettings,
    salesTransactions,
    contracts,
    dailyChecklists
  } = useStore() as any;

  const [activeSubTab, setActiveSubTab] = useState<"guide" | "target" | "tasks" | "rules">("guide");
  const isIndo = true;
  const loggedInUser = currentUser || user;
  const canEditHR = loggedInUser?.role === "OWNER" || loggedInUser?.role === "MANAGER" || loggedInUser?.role === "SUPER_ADMIN";

  // State for new/edit task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<any>({});

  // State for new/edit rule
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<any>({});

  // State for Store Target & Bonus
  const defaultTarget = settings?.monthlyRevenueTarget || 150000000;
  const defaultBonus = settings?.targetBonusAmount || 250000;
  const [targetInput, setTargetInput] = useState<string>(defaultTarget.toString());
  const [bonusInput, setBonusInput] = useState<string>(defaultBonus.toString());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Current month metrics
  const currentPeriod = useMemo(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  }, []);

  const currentMonthSales = useMemo(() => {
    return (salesTransactions || [])
      .filter((s: any) => s.date && s.date.startsWith(currentPeriod))
      .reduce((sum: number, s: any) => sum + (s.finalAmount || s.totalAmount || 0), 0);
  }, [salesTransactions, currentPeriod]);

  const activeEmployees = useMemo(() => {
    return (employees || []).filter((e: any) => e.status !== "INACTIVE");
  }, [employees]);

  const monthlyTarget = settings?.monthlyRevenueTarget || 150000000;
  const targetBonusAmount = settings?.targetBonusAmount || 0;
  const achievementRate = monthlyTarget > 0 ? (currentMonthSales / monthlyTarget) * 100 : 0;
  const isTargetAchieved = currentMonthSales >= monthlyTarget && monthlyTarget > 0;

  const handleEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setTaskForm({ ...task });
  };

  const handleSaveTask = () => {
    const id = editingTaskId || `kpi-task-${Date.now()}`;
    const realization = parseFloat(taskForm.realization) || 0;
    const target = parseFloat(taskForm.target) || 1;
    const weight = parseFloat(taskForm.weight) || 0;
    const score = Math.min((realization / target) * weight, weight);
    
    updateKpiTask(id, {
      ...taskForm,
      realization,
      target,
      weight,
      score,
      createdAt: taskForm.createdAt || new Date().toISOString(),
    });
    setEditingTaskId(null);
    setTaskForm({});
  };

  const handleEditRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleForm({ ...rule });
  };

  const handleSaveRule = () => {
    const id = editingRuleId || `kpi-rule-${Date.now()}`;
    updateKpiBonusRule(id, {
      ...ruleForm,
      minScore: parseFloat(ruleForm.minScore) || 0,
      maxScore: parseFloat(ruleForm.maxScore) || 0,
      bonusAmount: parseFloat(ruleForm.bonusAmount) || 0,
      isActive: ruleForm.isActive ?? true,
    });
    setEditingRuleId(null);
    setRuleForm({});
  };

  const handleSaveStoreTargetSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const newTarget = Math.max(0, parseInt(targetInput) || monthlyTarget);
    const newBonus = Math.max(0, parseInt(bonusInput) || 0);

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
                Pusat Skema Bonus, KPI & Target Toko
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Panduan transparansi dan konfigurasi besaran tunjangan jobdesk, evaluasi capaian KPI, dan bonus omzet toko.
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
            <CheckCircle2 className="w-4 h-4 text-slate-600" />
            📋 Daftar Task KPI Karyawan
          </button>

          <button
            onClick={() => setActiveSubTab("rules")}
            className={`pb-3 px-3 border-b-2 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors ${
              activeSubTab === "rules"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x border-slate-200"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-600" />
            📊 Aturan Bonus Bertingkat (Tiered)
          </button>
        </div>
      </div>

      <div className="p-6">
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
                    Sistem coffee management ini menghubungkan data dari <strong>Kontrak Kerja</strong>, <strong>Checklist Jobdesk Leader</strong>, <strong>Presensi & Evaluasi</strong>, dan <strong>Penjualan Kasir</strong> secara otomatis ke dalam slip gaji. Berikut rincian cara kerjanya:
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Cards Alur */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Leader Jobdesk */}
              <div className="p-5 rounded-2xl border border-indigo-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Untuk Leader / Supervisor
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Otomatisasi Harian</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  1. Tunjangan Jabatan & Bonus Jobdesk Leader
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Sumber Angka:</strong> Diatur di menu <em>Kontrak Kerja Karyawan</em> pada kolom <code>Tunjangan Jabatan</code> dan <code>Target Bonus KPI</code>.
                  </p>
                  <p>
                    <strong>Cara Kerja:</strong> Leader wajib mengisi checklist tugas harian (opening/closing bar & kasir) di menu <em>Leader Checklist</em>.
                  </p>
                  <div className="p-2 bg-indigo-50/70 rounded-lg font-mono text-[11px] text-indigo-900 border border-indigo-100">
                    Bonus = (Hari Checklist Diisi ÷ Hari Kerja) × Plafon Target
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    *Jika hadir 25 hari dan mengisi checklist 25 hari penuh, bonus cair 100%.
                  </p>
                </div>
              </div>

              {/* Card 2: Staff KPI & Disiplin */}
              <div className="p-5 rounded-2xl border border-sky-100 bg-white hover:border-sky-200 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    <Users className="w-3.5 h-3.5" /> Untuk Barista & Kasir
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Evaluasi & Presensi</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  2. Bonus Capaian KPI & Kedisiplinan Staf
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Sumber Angka:</strong> Diatur di menu <em>Kontrak Kerja Karyawan</em> pada kolom <code>Target Bonus KPI</code>.
                  </p>
                  <p>
                    <strong>Cara Kerja:</strong> Dinilai oleh Manager lewat skor bulanan di tab <em>Task KPI</em> atau dihitung dari <strong>Rasio Disiplin Presensi</strong> (bebas keterlambatan & mangkir).
                  </p>
                  <div className="p-2 bg-sky-50/70 rounded-lg font-mono text-[11px] text-sky-900 border border-sky-100">
                    Bonus = (Skor Evaluasi % atau Rasio Disiplin) × Plafon Target
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    *Keterlambatan mengurangi 5% dan mangkir (alpha) memotong 10% dari rasio disiplin.
                  </p>
                </div>
              </div>

              {/* Card 3: Tiered Rules */}
              <div className="p-5 rounded-2xl border border-amber-100 bg-white hover:border-amber-200 hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <TrendingUp className="w-3.5 h-3.5" /> Opsi Patokan Tetap
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Tiered Grade</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  3. Aturan Bonus Bertingkat (Tiered Skor)
                </h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    <strong>Alternatif Patokan:</strong> Diatur di tab <em>Aturan Bonus (Tiered)</em>. Manager dapat menetapkan tabel bonus tetap berdasarkan rentang skor:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                    <li>Skor 90 – 100 ➔ Bonus Rp 400.000 (Grade A)</li>
                    <li>Skor 80 – 89 ➔ Bonus Rp 250.000 (Grade B)</li>
                    <li>Skor &lt; 80 ➔ Bonus Rp 0 (Perlu bimbingan)</li>
                  </ul>
                  <p className="text-slate-500 text-[11px]">
                    *Jika aturan tier ini aktif, sistem otomatis memprioritaskan patokan ini di slip gaji.
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
                    Jika Realisasi Omzet ≥ Target Omzet ➔ Semua Staf Dapat Bonus Omzet
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
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Daftar Task & Indikator KPI Karyawan</h3>
                <p className="text-xs text-slate-500">Catat target bulanan spesifik per staf untuk dinilai realisasinya.</p>
              </div>
              {canEditHR && (
                <button 
                  onClick={() => { setEditingTaskId(""); setTaskForm({ period: currentPeriod }); }}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Tambah Task Baru
                </button>
              )}
            </div>
            
            {editingTaskId !== null && (
              <div className="bg-indigo-50/70 p-5 rounded-2xl mb-6 border border-indigo-100">
                <h4 className="font-bold text-indigo-900 text-sm mb-4">
                  {editingTaskId ? "Edit Task KPI" : "Tambah Task KPI Baru"}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Karyawan</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                      value={taskForm.employeeId || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, employeeId: e.target.value })}
                    >
                      <option value="">Pilih Karyawan</option>
                      {employees.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.position || "Staff"})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Periode (YYYY-MM)</label>
                    <input
                      type="month"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={taskForm.period || currentPeriod}
                      onChange={(e) => setTaskForm({ ...taskForm, period: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Indikator / Target</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                      value={taskForm.taskName || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, taskName: e.target.value })}
                      placeholder="Contoh: Ketepatan Dialing Espresso & Kebersihan Bar"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Target Angka</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={taskForm.target || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, target: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Realisasi</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={taskForm.realization || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, realization: e.target.value })}
                      placeholder="95"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bobot (%)</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={taskForm.weight || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, weight: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingTaskId(null)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 bg-white text-xs font-semibold">Batal</button>
                  <button onClick={handleSaveTask} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs"><Save className="w-4 h-4" /> Simpan Task</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4 font-semibold">Periode</th>
                    <th className="py-3 px-4 font-semibold">Karyawan</th>
                    <th className="py-3 px-4 font-semibold">Indikator KPI</th>
                    <th className="py-3 px-4 font-semibold text-center">Target</th>
                    <th className="py-3 px-4 font-semibold text-center">Realisasi</th>
                    <th className="py-3 px-4 font-semibold text-center">Bobot</th>
                    <th className="py-3 px-4 font-semibold text-center">Skor Capaian</th>
                    <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiTasks?.map((task: any) => (
                    <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono">{task.period}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{getEmployeeName(task.employeeId)}</td>
                      <td className="py-3 px-4 text-slate-700">{task.taskName}</td>
                      <td className="py-3 px-4 text-center font-mono">{task.target}</td>
                      <td className="py-3 px-4 text-center font-mono font-medium">{task.realization}</td>
                      <td className="py-3 px-4 text-center font-mono">{task.weight}%</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold font-mono">
                          {task.score?.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleEditTask(task)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {(!kpiTasks || kpiTasks.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">Belum ada data Task KPI karyawan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 4: ATURAN BONUS BERTINGKAT (TIERED) ─── */}
        {activeSubTab === "rules" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Aturan Bonus Berdasarkan Rentang Skor (Tiered)</h3>
                <p className="text-xs text-slate-500">Tentukan plafon bonus tetap berdasarkan rentang total nilai evaluasi.</p>
              </div>
              {canEditHR && (
                <button 
                  onClick={() => { setEditingRuleId(""); setRuleForm({ isActive: true }); }}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Tambah Rentang Nilai
                </button>
              )}
            </div>
            
            {editingRuleId !== null && (
              <div className="bg-indigo-50/70 p-5 rounded-2xl mb-6 border border-indigo-100">
                <h4 className="font-bold text-indigo-900 text-sm mb-4">{editingRuleId ? "Edit Rentang Nilai" : "Rentang Nilai Baru"}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Skor Minimal (0 - 100)</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={ruleForm.minScore || ""}
                      onChange={(e) => setRuleForm({ ...ruleForm, minScore: e.target.value })}
                      placeholder="85"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Skor Maksimal (0 - 100)</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={ruleForm.maxScore || ""}
                      onChange={(e) => setRuleForm({ ...ruleForm, maxScore: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal Bonus (Rp)</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
                      value={ruleForm.bonusAmount || ""}
                      onChange={(e) => setRuleForm({ ...ruleForm, bonusAmount: e.target.value })}
                      placeholder="350000"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingRuleId(null)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 bg-white text-xs font-semibold">Batal</button>
                  <button onClick={handleSaveRule} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs"><Save className="w-4 h-4" /> Simpan Aturan</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4 font-semibold">Skor Minimal</th>
                    <th className="py-3 px-4 font-semibold">Skor Maksimal</th>
                    <th className="py-3 px-4 font-semibold">Jumlah Bonus (Rp)</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiBonusRules?.map((rule: any) => (
                    <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{rule.minScore}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{rule.maxScore}</td>
                      <td className="py-3 px-4 text-emerald-600 font-mono font-bold">{formatCurrency(rule.bonusAmount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {rule.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleEditRule(rule)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {(!kpiBonusRules || kpiBonusRules.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">Belum ada aturan rentang skor bonus.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
