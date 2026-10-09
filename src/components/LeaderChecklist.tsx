import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { 
  CheckSquare, Square, Save, AlertCircle, Calendar, 
  CheckCircle2, Clock, XCircle, Plus, Trash2, RotateCcw, 
  Coffee, Utensils, Croissant, Users, ClipboardList, 
  Sliders, TrendingUp, Check
} from "lucide-react";
import { motion } from "framer-motion";
import { getLocalDateString } from "../utils/dateUtils";

export const DEFAULT_LEADER_BAR_TASKS = [
  "Pekerjaan Kebersihan (Area Bar, Outdoor, WC, Smoking Area, Mushala, Gudang, dll)",
  "Pekerjaan Kontroling Alat (Mesin Espresso, Grinder, AC, Tablet, dll)",
  "Pekerjaan Kontroling Konstruksi (Cek atap bocor, kaca pecah, dll)",
  "Pekerjaan Gudang (Cek EXP semua bahan, FIFO, dll)",
  "Pekerjaan Kontroling Serving (Kelengkapan serving minuman)",
  "Pekerjaan Kontroling Karyawan (Kasir, Bar Belakang, Absensi)"
];

export const DEFAULT_LEADER_KITCHEN_TASKS = [
  "Pekerjaan Kebersihan (Area Kitchen, Lantai, Exhaust, dll)",
  "Pekerjaan Kontroling Alat (Kompor, Chiller, Freezer, Fryer, dll)",
  "Pekerjaan Gudang (Cek EXP bahan makanan, FIFO, stok, dll)",
  "Pekerjaan Kontroling Serving (Plating, Standar Resep)",
  "Pekerjaan Kontroling Karyawan (Koki, Helper, Cuci Piring)"
];

export const DEFAULT_LEADER_BAKER_TASKS = [
  "Pekerjaan Kebersihan (Area Pastry, Oven, dll)",
  "Pekerjaan Kontroling Alat (Mixer, Oven, Proofer, dll)",
  "Pekerjaan Gudang (Cek EXP ragi, tepung, butter, dll)",
  "Pekerjaan Kontroling Serving (Display Pastry)",
  "Pekerjaan Kontroling Karyawan (Asisten Baker)"
];

type Division = "BAR" | "KITCHEN" | "BAKER";

const ensureArray = (v: any, fallback: string[]): string[] => {
  if (Array.isArray(v) && v.length > 0) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return fallback;
};

export const LeaderChecklist: React.FC = () => {
  const { 
    currentUser, 
    users, 
    dailyChecklists, 
    setDailyChecklists, 
    settings, 
    updateSettings, 
    isReadOnly 
  } = useStore();

  const isSupervisor = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";
  const [activeTab, setActiveTab] = useState<"monitoring" | "settings">("monitoring");

  // Selected date for monitoring (defaults to today)
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Active division filter in supervisor detail view
  const [inspectedDivision, setInspectedDivision] = useState<Division>("BAR");

  // Setting template state for supervisor
  const [editingDivision, setEditingDivision] = useState<Division>("BAR");
  const [barTasks, setBarTasks] = useState<string[]>(() =>
    ensureArray(settings?.leaderBarTasks, DEFAULT_LEADER_BAR_TASKS)
  );
  const [kitchenTasks, setKitchenTasks] = useState<string[]>(() =>
    ensureArray(settings?.leaderKitchenTasks, DEFAULT_LEADER_KITCHEN_TASKS)
  );
  const [bakerTasks, setBakerTasks] = useState<string[]>(() =>
    ensureArray(settings?.leaderBakerTasks, DEFAULT_LEADER_BAKER_TASKS)
  );
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Leader role selection if current user is a leader
  const initialLeaderRole: Division = 
    currentUser?.role === "KITCHEN" || currentUser?.department === "KITCHEN" ? "KITCHEN" :
    currentUser?.role === "BAKER" ? "BAKER" : "BAR";
  const [leaderActiveDivision, setLeaderActiveDivision] = useState<Division>(initialLeaderRole);

  // Synchronize tasks when settings change
  React.useEffect(() => {
    setBarTasks(ensureArray(settings?.leaderBarTasks, DEFAULT_LEADER_BAR_TASKS));
    setKitchenTasks(ensureArray(settings?.leaderKitchenTasks, DEFAULT_LEADER_KITCHEN_TASKS));
    setBakerTasks(ensureArray(settings?.leaderBakerTasks, DEFAULT_LEADER_BAKER_TASKS));
  }, [settings]);

  // Master tasks getter by division
  const getTasksForDivision = (div: Division): string[] => {
    if (div === "BAR") return ensureArray(barTasks, DEFAULT_LEADER_BAR_TASKS);
    if (div === "KITCHEN") return ensureArray(kitchenTasks, DEFAULT_LEADER_KITCHEN_TASKS);
    return ensureArray(bakerTasks, DEFAULT_LEADER_BAKER_TASKS);
  };

  // Helper to detect division from checklist record
  const getDivisionForChecklist = (c: any): Division => {
    const user = users.find((u) => u.id === c.employeeId);
    if (user?.role === "KITCHEN" || user?.department === "KITCHEN") return "KITCHEN";
    if (user?.role === "BAKER") return "BAKER";
    if (user?.role === "BAR" || user?.department === "BAR") return "BAR";

    if (c.notes?.includes("[KITCHEN]")) return "KITCHEN";
    if (c.notes?.includes("[BAKER]")) return "BAKER";
    if (c.notes?.includes("[BAR]")) return "BAR";

    const kTasks = kitchenTasks;
    const bTasks = bakerTasks;
    const completed = c.leaderTasks || [];
    const kMatch = completed.filter((t: string) => kTasks.includes(t)).length;
    const bMatch = completed.filter((t: string) => bTasks.includes(t)).length;
    if (kMatch > 0 && kMatch >= bMatch) return "KITCHEN";
    if (bMatch > 0) return "BAKER";
    return "BAR";
  };

  // ─── LEADER FILLING STATE ────────────────────────────────────────────────
  // Existing checklist for currently logged in leader for TODAY
  const leaderExistingChecklist = useMemo(() => {
    return dailyChecklists.find(
      (c) => c.date.startsWith(today) && getDivisionForChecklist(c) === leaderActiveDivision
    );
  }, [dailyChecklists, today, leaderActiveDivision, users]);

  const [leaderCompletedTasks, setLeaderCompletedTasks] = useState<string[]>(
    leaderExistingChecklist?.leaderTasks || []
  );
  const [leaderNotes, setLeaderNotes] = useState<string>(
    leaderExistingChecklist?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || ""
  );
  const [leaderSaved, setLeaderSaved] = useState(false);

  // Sync leader state when division changes
  React.useEffect(() => {
    setLeaderCompletedTasks(leaderExistingChecklist?.leaderTasks || []);
    setLeaderNotes(leaderExistingChecklist?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || "");
  }, [leaderExistingChecklist, leaderActiveDivision]);

  const toggleLeaderTask = (task: string) => {
    if (isReadOnly) return;
    setLeaderSaved(false);
    setLeaderCompletedTasks((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  const handleSaveLeaderChecklist = () => {
    if (isReadOnly || !currentUser) return;

    const formattedNotes = `[${leaderActiveDivision}] ${leaderNotes.trim()}`;
    const newChecklist = {
      id: leaderExistingChecklist?.id || crypto.randomUUID(),
      employeeId: currentUser.id,
      date: today,
      cleaningDone: leaderExistingChecklist?.cleaningDone || true,
      equipmentChecked: leaderExistingChecklist?.equipmentChecked || true,
      leaderTasks: leaderCompletedTasks,
      notes: formattedNotes,
    };

    if (leaderExistingChecklist) {
      setDailyChecklists(
        dailyChecklists.map((c) => (c.id === newChecklist.id ? newChecklist : c))
      );
    } else {
      setDailyChecklists([...dailyChecklists, newChecklist]);
    }

    setLeaderSaved(true);
    setTimeout(() => setLeaderSaved(false), 3000);
  };

  // ─── SUPERVISOR MONITORING COMPUTATION ────────────────────────────────────
  const divisionStats = useMemo(() => {
    const targetDateChecklists = dailyChecklists.filter((c) => c.date.startsWith(selectedDate));
    
    const divisions: { key: Division; label: string; icon: any; color: string }[] = [
      { key: "BAR", label: "Head Bar", icon: Coffee, color: "amber" },
      { key: "KITCHEN", label: "Head Kitchen", icon: Utensils, color: "orange" },
      { key: "BAKER", label: "Head Baker", icon: Croissant, color: "emerald" },
    ];

    return divisions.map((div) => {
      const tasks = getTasksForDivision(div.key);
      const totalTasks = tasks.length;
      
      const found = targetDateChecklists.find((c) => getDivisionForChecklist(c) === div.key);
      const completedTasks = found?.leaderTasks || [];
      const completedCount = completedTasks.length;
      const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
      
      const leaderUser = found ? users.find((u) => u.id === found.employeeId) : null;
      const leaderName = leaderUser ? leaderUser.name : found ? "Leader Terdaftar" : null;
      const cleanNotes = found?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || "";

      return {
        ...div,
        totalTasks,
        completedCount,
        percentage,
        isSubmitted: !!found,
        leaderName,
        checklist: found,
        cleanNotes,
        tasks,
      };
    });
  }, [dailyChecklists, selectedDate, barTasks, kitchenTasks, bakerTasks, users]);

  // Overall average percentage for today
  const overallPercentage = useMemo(() => {
    const total = divisionStats.reduce((acc, d) => acc + d.percentage, 0);
    return Math.round(total / divisionStats.length);
  }, [divisionStats]);

  // ─── SUPERVISOR TASK CONFIGURATION HANDLERS ───────────────────────────────
  const currentEditingTasks = 
    editingDivision === "BAR" ? barTasks : 
    editingDivision === "KITCHEN" ? kitchenTasks : bakerTasks;

  const setCurrentEditingTasks = (newTasks: string[]) => {
    if (editingDivision === "BAR") setBarTasks(newTasks);
    else if (editingDivision === "KITCHEN") setKitchenTasks(newTasks);
    else setBakerTasks(newTasks);
  };

  const handleAddTask = () => {
    const updated = [...currentEditingTasks, "Tugas Baru"];
    setCurrentEditingTasks(updated);
  };

  const handleUpdateTask = (idx: number, text: string) => {
    const updated = [...currentEditingTasks];
    updated[idx] = text;
    setCurrentEditingTasks(updated);
  };

  const handleRemoveTask = (idx: number) => {
    const updated = currentEditingTasks.filter((_, i) => i !== idx);
    setCurrentEditingTasks(updated);
  };

  const handleResetToDefault = () => {
    if (!window.confirm("Kembalikan tugas divisi ini ke daftar standar sistem?")) return;
    if (editingDivision === "BAR") setBarTasks(DEFAULT_LEADER_BAR_TASKS);
    else if (editingDivision === "KITCHEN") setKitchenTasks(DEFAULT_LEADER_KITCHEN_TASKS);
    else setBakerTasks(DEFAULT_LEADER_BAKER_TASKS);
  };

  const handleSaveSettings = () => {
    updateSettings({
      ...settings,
      leaderBarTasks: barTasks,
      leaderKitchenTasks: kitchenTasks,
      leaderBakerTasks: bakerTasks,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. RENDER UNTUK MANAGER & SUPER ADMIN (MONITORING & PENGATUR JOBDESK)
  // ─────────────────────────────────────────────────────────────────────────
  if (isSupervisor) {
    const selectedDivisionStat = divisionStats.find((d) => d.key === inspectedDivision) || divisionStats[0];

    return (
      <div className="space-y-6">
        {/* Header Manager */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                Supervisor Dashboard
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                Monitoring & Pengaturan Jobdesk Leader
              </h2>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Pantau laporan penyelesaian tugas harian Head Bar, Kitchen, & Baker serta atur daftar jobdesk mereka.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("monitoring")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "monitoring"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Laporan & Pantau Progress
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sliders className="w-4 h-4 text-emerald-600" />
              Atur Daftar Tugas Jobdesk
            </button>
          </div>
        </div>

        {/* TAB 1: MONITORING & LAPORAN */}
        {activeTab === "monitoring" && (
          <div className="space-y-6">
            {/* Filter Tanggal & Ringkasan Rata-rata */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Tanggal Pantauan Laporan</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    {selectedDate !== today && (
                      <button
                        onClick={() => setSelectedDate(today)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-amber-400 border border-slate-700 transition-colors"
                      >
                        Hari Ini
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-between sm:justify-start">
                <div>
                  <p className="text-xs text-slate-400">Rata-rata Terlaksana</p>
                  <p className="text-2xl font-black text-amber-400">{overallPercentage}%</p>
                </div>
                <div className="w-28 bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-500 ${
                      overallPercentage === 100 ? "bg-emerald-500" : overallPercentage > 50 ? "bg-amber-400" : "bg-blue-400"
                    }`}
                    style={{ width: `${overallPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3 Kartu Progress Leader (Bar, Kitchen, Baker) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {divisionStats.map((div) => {
                const Icon = div.icon;
                const isFull = div.percentage === 100;
                const isStarted = div.isSubmitted && div.completedCount > 0;

                return (
                  <div
                    key={div.key}
                    onClick={() => setInspectedDivision(div.key)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white ${
                      inspectedDivision === div.key
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                          div.key === "BAR" ? "bg-amber-100 text-amber-700" :
                          div.key === "KITCHEN" ? "bg-orange-100 text-orange-700" :
                          "bg-emerald-100 text-emerald-700"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">{div.label}</h3>
                          <p className="text-xs text-slate-500">
                            {div.leaderName ? `Diisi oleh: ${div.leaderName}` : "Belum ada laporan masuk"}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isFull
                          ? "bg-emerald-100 text-emerald-700"
                          : isStarted
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {isFull ? "Selesai 100%" : isStarted ? "Sedang Berjalan" : "Belum Diisi"}
                      </span>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="mt-4">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-xs font-medium text-slate-500">
                          {div.completedCount} dari {div.totalTasks} Tugas
                        </span>
                        <span className="text-lg font-black text-slate-800">
                          {div.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isFull ? "bg-emerald-500" : isStarted ? "bg-amber-500" : "bg-slate-300"
                          }`}
                          style={{ width: `${div.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Catatan Kendala jika ada */}
                    {div.cleanNotes && (
                      <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-900">
                        <span className="font-semibold">Catatan Leader:</span> {div.cleanNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detail Checklist Terpilih */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    Rincian Tugas: {selectedDivisionStat.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Status checklist tugas per tanggal {selectedDate}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Penyelesaian: {selectedDivisionStat.completedCount} / {selectedDivisionStat.totalTasks} ({selectedDivisionStat.percentage}%)
                  </span>
                </div>
              </div>

              {!Array.isArray(selectedDivisionStat?.tasks) || selectedDivisionStat.tasks.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  Belum ada daftar tugas yang dikonfigurasi untuk divisi ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDivisionStat.tasks.map((task, idx) => {
                    const isDone = (selectedDivisionStat.checklist?.leaderTasks || []).includes(task);

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                          isDone
                            ? "bg-emerald-50/70 border-emerald-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300 shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${isDone ? "text-emerald-950 font-semibold" : "text-slate-600"}`}>
                            {task}
                          </span>
                        </div>

                        <span className={`text-xs px-2.5 py-1 rounded-md font-bold shrink-0 ml-4 ${
                          isDone ? "bg-emerald-200/60 text-emerald-800" : "bg-slate-200 text-slate-600"
                        }`}>
                          {isDone ? "Terlaksana" : "Belum"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PENGATURAN DAFTAR TUGAS JOBDESK */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Kelola Template Tugas Harian Leader
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan item tugas checklist harian yang wajib dijalankan oleh masing-masing Leader.
                </p>
              </div>

              {/* Pilihan Divisi */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setEditingDivision("BAR")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editingDivision === "BAR"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Bar ({barTasks.length})
                </button>
                <button
                  onClick={() => setEditingDivision("KITCHEN")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editingDivision === "KITCHEN"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Kitchen ({kitchenTasks.length})
                </button>
                <button
                  onClick={() => setEditingDivision("BAKER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editingDivision === "BAKER"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Baker ({bakerTasks.length})
                </button>
              </div>
            </div>

            {/* List Tugas Editable */}
            <div className="space-y-3">
              {(Array.isArray(currentEditingTasks) ? currentEditingTasks : []).map((task, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-7 text-xs font-bold text-slate-400 text-center shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={task}
                    onChange={(e) => handleUpdateTask(idx, e.target.value)}
                    className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nama rincian tugas..."
                  />
                  <button
                    onClick={() => handleRemoveTask(idx)}
                    className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors shrink-0"
                    title="Hapus tugas ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Tombol Aksi Tambah & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  + Tambah Tugas Baru
                </button>
                <button
                  onClick={handleResetToDefault}
                  className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset ke Standar
                </button>
              </div>

              <div className="flex items-center gap-3">
                {settingsSaved && (
                  <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <Check className="w-4 h-4" /> Pengaturan Tersimpan!
                  </span>
                )}
                <button
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Simpan Pengaturan Jobdesk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. RENDER UNTUK LEADER (HEAD BAR, HEAD KITCHEN, HEAD BAKER)
  // ─────────────────────────────────────────────────────────────────────────
  const activeLeaderTasks = getTasksForDivision(leaderActiveDivision);
  const totalTasks = activeLeaderTasks.length;
  const completedCount = leaderCompletedTasks.length;
  const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const isFull = percentage === 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Pengisian Tugas Harian */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Pelaksana Harian
            </span>
            <h2 className="text-xl font-bold text-slate-800">
              Checklist Jobdesk Harian Leader
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Centang tugas-tugas harian yang sudah Anda selesaikan untuk divisi Anda hari ini.
          </p>
        </div>

        {/* Jika akun Leader umum, berikan toggle divisi */}
        {currentUser?.role === "LEADER" && (
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setLeaderActiveDivision("BAR")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                leaderActiveDivision === "BAR" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setLeaderActiveDivision("KITCHEN")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                leaderActiveDivision === "KITCHEN" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Kitchen
            </button>
            <button
              onClick={() => setLeaderActiveDivision("BAKER")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                leaderActiveDivision === "BAKER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Baker
            </button>
          </div>
        )}
      </div>

      {/* Kartu Checklist Utama */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Tugas Harian - Head {leaderActiveDivision === "BAR" ? "Bar" : leaderActiveDivision === "KITCHEN" ? "Kitchen" : "Baker"}
            </h3>
            <span className="text-xs text-slate-500">
              {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-slate-800">{percentage}%</span>
            <p className="text-xs font-semibold text-slate-500">{completedCount} dari {totalTasks} Tugas</p>
          </div>
        </div>

        {/* Progress Bar Visual */}
        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-300 ${
              isFull ? "bg-emerald-500" : completedCount > 0 ? "bg-amber-500" : "bg-slate-300"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* List Checkbox Tugas */}
        <div className="space-y-3">
          {(Array.isArray(activeLeaderTasks) ? activeLeaderTasks : []).map((task, index) => {
            const isCompleted = leaderCompletedTasks.includes(task);

            return (
              <div
                key={index}
                onClick={() => toggleLeaderTask(task)}
                className={`p-4 rounded-xl border flex items-start gap-4 cursor-pointer transition-all select-none ${
                  isCompleted
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${isCompleted ? "text-emerald-900 line-through opacity-80" : "text-slate-800"}`}>
                    {task.split(" (")[0]}
                  </p>
                  {task.includes("(") && (
                    <p className={`text-xs mt-1 ${isCompleted ? "text-emerald-700" : "text-slate-500"}`}>
                      {task.substring(task.indexOf("("))}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Catatan Harian / Kendala */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Catatan Harian / Laporan Kendala (Opsional untuk Manager):
          </label>
          <textarea
            value={leaderNotes}
            onChange={(e) => setLeaderNotes(e.target.value)}
            placeholder="Tuliskan kendala alat, bahan menipis, atau catatan kebersihan di sini..."
            rows={3}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Tombol Simpan Checklist */}
        {!isReadOnly && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={handleSaveLeaderChecklist}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm"
            >
              <Save className="w-5 h-5" />
              Simpan Checklist Hari Ini
            </button>

            {leaderSaved && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-emerald-600 text-sm font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4" /> Checklist Berhasil Disimpan!
              </motion.span>
            )}
          </div>
        )}
      </div>

      {/* Info Edukasi KPI */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900">
          <p className="font-bold mb-0.5">Informasi Evaluasi Kinerja (KPI)</p>
          <p>
            Checklist tugas ini otomatis tercatat dan dapat dipantau langsung oleh Manager sebagai dasar evaluasi kedisiplinan dan bonus operasional.
          </p>
        </div>
      </div>
    </div>
  );
};
