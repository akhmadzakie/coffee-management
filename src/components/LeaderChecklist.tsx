import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { 
  CheckSquare, Square, Save, AlertCircle, Calendar, 
  CheckCircle2, Clock, XCircle, Plus, Trash2, RotateCcw, 
  Coffee, Utensils, Croissant, Users, ClipboardList, 
  Sliders, TrendingUp, Check, Layers, ChevronDown, ChevronUp
} from "lucide-react";
import { motion } from "framer-motion";
import { getLocalDateString } from "../utils/dateUtils";
import { TaskCategoryGroup } from "../types";

export const DEFAULT_BAR_CATEGORIES: TaskCategoryGroup[] = [
  {
    id: "bar-cat-1",
    category: "Kebersihan & Sanitasi Area",
    items: [
      "Lap dan sanitasi seluruh meja bar & undercounter",
      "Backflush mesin espresso dengan chemical & cuci portafilter",
      "Bersihkan hopper grinder & meja kasir/bar",
      "Sapu & pel lantai area bar serta buang ampas kopi (knockbox)",
      "Bersihkan sink bar, drain tray, dan kosongkan tempat sampah",
    ],
  },
  {
    id: "bar-cat-2",
    category: "Pengecekan Alat & Mesin",
    items: [
      "Kalibrasi timbangan digital & dial-in espresso (rasio/ekstraksi)",
      "Cek tekanan pompa & temperatur steam wand mesin espresso",
      "Cek temperatur chiller susu (standar 2°C - 4°C) & ice maker",
      "Cek fungsi tablet POS kasir, jaringan internet, & printer struk",
    ],
  },
  {
    id: "bar-cat-3",
    category: "Bahan Baku & FIFO Gudang",
    items: [
      "Cek tanggal kedaluwarsa & rotasi stok susu segar (FIFO)",
      "Cek ketersediaan biji kopi (beans), sirup, sauce, & powder",
      "Restock paper cup, sedotan, tutup cup, sendok, & tissue",
      "Catat bahan yang menipis untuk pengajuan restock",
    ],
  },
  {
    id: "bar-cat-4",
    category: "Kontroling Tim & Pelayanan",
    items: [
      "Briefing standar serving, keramahan kasir, & kebersihan seragam",
      "Cek absensi staf bar dan kesiapan opening/closing shift",
    ],
  },
];

export const DEFAULT_KITCHEN_CATEGORIES: TaskCategoryGroup[] = [
  {
    id: "kitchen-cat-1",
    category: "Kebersihan Dapur & Stewarding",
    items: [
      "Bersihkan kompor, fryer, grill, & permukaan stainless steel",
      "Cuci grease trap & saringan saluran pembuangan air",
      "Sanitasi talenan, pisau, & wadah persiapan bahan (food-grade)",
      "Sapu & pel lantai dapur dengan cairan desinfektan",
      "Pastikan area cuci piring & rak pengering bersih dan tertata",
    ],
  },
  {
    id: "kitchen-cat-2",
    category: "Pengecekan Alat & Pendingin",
    items: [
      "Cek temperatur chiller (1°C - 4°C) & deep freezer (-18°C)",
      "Cek instalasi tabung gas, regulator, & cerobong exhaust hood",
      "Cek kelayakan wajan, panci, fry basket, & penjepit makanan",
    ],
  },
  {
    id: "kitchen-cat-3",
    category: "Penyimpanan Bahan & Food Safety",
    items: [
      "Cek label tanggal (prep date) & masa simpan bahan marinasi (FIFO)",
      "Pastikan pemisahan bahan mentah (daging/ayam) dan bahan matang",
      "Cek kualitas sayuran segar & persediaan bumbu utama",
    ],
  },
  {
    id: "kitchen-cat-4",
    category: "Standar Porsi & Serving",
    items: [
      "Cek standar gramasi porsi & resep makanan sesuai SOP",
      "Cek waktu saji makanan (ticket time standar)",
      "Evaluasi presentasi & kebersihan piring saji (plating)",
    ],
  },
];

export const DEFAULT_BAKER_CATEGORIES: TaskCategoryGroup[] = [
  {
    id: "baker-cat-1",
    category: "Kebersihan Area Pastry & Alat",
    items: [
      "Sanitasi meja kerja marmer/stainless untuk adonan",
      "Bersihkan loyang baking, rolling pin, scraper, & kuas pastry",
      "Bersihkan remah roti dan tetesan butter di area oven & proofer",
      "Pel lantai dan buang sisa plastik/bungkus bahan adonan",
    ],
  },
  {
    id: "baker-cat-2",
    category: "Kontroling Alat Baking",
    items: [
      "Cek kalibrasi temperatur oven & fungsi timer pemanggang",
      "Cek kebersihan bowl spiral mixer & hook pengaduk adonan",
      "Cek kelembapan dan kontrol temperatur lemari proofer adonan",
    ],
  },
  {
    id: "baker-cat-3",
    category: "Kualitas Bahan Baku & Adonan",
    items: [
      "Cek keaktifan ragi (yeast), kualitas butter, & kelembapan tepung",
      "Pastikan wadah bahan kering tertutup rapat & terlabel tanggal",
      "Cek persediaan topping, glaze, cokelat, dan filling pastry",
    ],
  },
  {
    id: "baker-cat-4",
    category: "Display & Kualitas Produk Jadi",
    items: [
      "Cek tekstur, kerapuhan (flakiness), & warna kematangan pastry",
      "Pastikan etalase display pastry bersih dan lampu display menyala",
      "Pastikan label nama produk dan tag harga terpasang rapi",
    ],
  },
];

type Division = "BAR" | "KITCHEN" | "BAKER";

// Helper parser to support new TaskCategoryGroup[] and convert legacy string[]
const ensureCategoryArray = (raw: any, fallback: TaskCategoryGroup[]): TaskCategoryGroup[] => {
  if (!raw) return fallback;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

  // If already TaskCategoryGroup[]
  if (
    typeof parsed[0] === "object" &&
    parsed[0] !== null &&
    "category" in parsed[0] &&
    Array.isArray(parsed[0].items)
  ) {
    return parsed;
  }

  // If legacy string[], convert to structured category groups
  if (typeof parsed[0] === "string") {
    return parsed.map((str: string, idx: number) => {
      const match = str.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        const catName = match[1].replace(/^Pekerjaan\s*/i, "").trim() || "Tugas Operasional";
        const subItems = match[2].split(",").map((s) => s.trim()).filter(Boolean);
        return {
          id: `legacy-${idx}`,
          category: catName,
          items: subItems.length > 0 ? subItems : [str],
        };
      }
      return {
        id: `legacy-${idx}`,
        category: "Tugas Umum",
        items: [str],
      };
    });
  }

  return fallback;
};

// Unique task identifier helper (category + item)
const getTaskKey = (catName: string, item: string) => `${catName}:::${item}`;

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
  const [barCategories, setBarCategories] = useState<TaskCategoryGroup[]>(() =>
    ensureCategoryArray(settings?.leaderBarTasks, DEFAULT_BAR_CATEGORIES)
  );
  const [kitchenCategories, setKitchenCategories] = useState<TaskCategoryGroup[]>(() =>
    ensureCategoryArray(settings?.leaderKitchenTasks, DEFAULT_KITCHEN_CATEGORIES)
  );
  const [bakerCategories, setBakerCategories] = useState<TaskCategoryGroup[]>(() =>
    ensureCategoryArray(settings?.leaderBakerTasks, DEFAULT_BAKER_CATEGORIES)
  );
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Leader role selection if current user is a leader
  const initialLeaderRole: Division = 
    currentUser?.role === "KITCHEN" || currentUser?.department === "KITCHEN" ? "KITCHEN" :
    currentUser?.role === "BAKER" ? "BAKER" : "BAR";
  const [leaderActiveDivision, setLeaderActiveDivision] = useState<Division>(initialLeaderRole);

  // Synchronize tasks when settings change
  React.useEffect(() => {
    setBarCategories(ensureCategoryArray(settings?.leaderBarTasks, DEFAULT_BAR_CATEGORIES));
    setKitchenCategories(ensureCategoryArray(settings?.leaderKitchenTasks, DEFAULT_KITCHEN_CATEGORIES));
    setBakerCategories(ensureCategoryArray(settings?.leaderBakerTasks, DEFAULT_BAKER_CATEGORIES));
  }, [settings]);

  // Master categories getter by division
  const getCategoriesForDivision = (div: Division): TaskCategoryGroup[] => {
    if (div === "BAR") return ensureCategoryArray(barCategories, DEFAULT_BAR_CATEGORIES);
    if (div === "KITCHEN") return ensureCategoryArray(kitchenCategories, DEFAULT_KITCHEN_CATEGORIES);
    return ensureCategoryArray(bakerCategories, DEFAULT_BAKER_CATEGORIES);
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

    return "BAR";
  };

  // ─── LEADER FILLING STATE ────────────────────────────────────────────────
  const activeLeaderCategories = getCategoriesForDivision(leaderActiveDivision);

  // Find existing checklist for currently logged in leader for TODAY
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

  // Check if a task is completed (handles both full key and item name)
  const isTaskChecked = (completedList: string[], catName: string, item: string) => {
    const key = getTaskKey(catName, item);
    return completedList.includes(key) || completedList.includes(item);
  };

  const toggleLeaderTask = (catName: string, item: string) => {
    if (isReadOnly) return;
    setLeaderSaved(false);
    const key = getTaskKey(catName, item);

    setLeaderCompletedTasks((prev) => {
      const checked = prev.includes(key) || prev.includes(item);
      if (checked) {
        return prev.filter((t) => t !== key && t !== item);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSaveLeaderChecklist = () => {
    if (isReadOnly || !currentUser) return;

    const formattedNotes = `[${leaderActiveDivision}] ${leaderNotes.trim()}`;
    const newChecklist = {
      id: leaderExistingChecklist?.id || crypto.randomUUID(),
      employeeId: currentUser.id,
      date: today,
      cleaningDone: true,
      equipmentChecked: true,
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

  // Calculate Leader counts
  const totalSubTasksLeader = useMemo(() => {
    return activeLeaderCategories.reduce((acc, cat) => acc + (cat.items?.length || 0), 0);
  }, [activeLeaderCategories]);

  const completedSubTasksLeader = useMemo(() => {
    let count = 0;
    activeLeaderCategories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        if (isTaskChecked(leaderCompletedTasks, cat.category, item)) {
          count++;
        }
      });
    });
    return count;
  }, [activeLeaderCategories, leaderCompletedTasks]);

  const leaderPercentage = totalSubTasksLeader > 0 
    ? Math.round((completedSubTasksLeader / totalSubTasksLeader) * 100) 
    : 0;

  // ─── SUPERVISOR MONITORING COMPUTATION ────────────────────────────────────
  const divisionStats = useMemo(() => {
    const targetDateChecklists = dailyChecklists.filter((c) => c.date.startsWith(selectedDate));
    
    const divisions: { key: Division; label: string; icon: any; color: string }[] = [
      { key: "BAR", label: "Head Bar", icon: Coffee, color: "amber" },
      { key: "KITCHEN", label: "Head Kitchen", icon: Utensils, color: "orange" },
      { key: "BAKER", label: "Head Baker", icon: Croissant, color: "emerald" },
    ];

    return divisions.map((div) => {
      const categories = getCategoriesForDivision(div.key);
      const totalTasks = categories.reduce((acc, cat) => acc + (cat.items?.length || 0), 0);
      
      const found = targetDateChecklists.find((c) => getDivisionForChecklist(c) === div.key);
      const completedList = found?.leaderTasks || [];

      // Category breakdown calculation
      const categoryBreakdown = categories.map((cat) => {
        const catTotal = cat.items?.length || 0;
        let catCompleted = 0;
        (cat.items || []).forEach((item) => {
          if (isTaskChecked(completedList, cat.category, item)) {
            catCompleted++;
          }
        });
        const catPct = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0;
        return {
          ...cat,
          catTotal,
          catCompleted,
          catPct,
        };
      });

      const completedCount = categoryBreakdown.reduce((acc, c) => acc + c.catCompleted, 0);
      const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
      
      const leaderUser = found ? users.find((u) => u.id === found.employeeId) : null;
      const leaderName = leaderUser ? leaderUser.name : found ? "Leader Terdaftar" : null;
      const cleanNotes = found?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || "";

      return {
        ...div,
        categories: categoryBreakdown,
        totalTasks,
        completedCount,
        percentage,
        isSubmitted: !!found,
        leaderName,
        checklist: found,
        cleanNotes,
      };
    });
  }, [dailyChecklists, selectedDate, barCategories, kitchenCategories, bakerCategories, users]);

  // Overall average percentage for today
  const overallPercentage = useMemo(() => {
    const total = divisionStats.reduce((acc, d) => acc + d.percentage, 0);
    return Math.round(total / divisionStats.length);
  }, [divisionStats]);

  // ─── SUPERVISOR TASK CONFIGURATION HANDLERS ───────────────────────────────
  const currentEditingCategories = 
    editingDivision === "BAR" ? barCategories : 
    editingDivision === "KITCHEN" ? kitchenCategories : bakerCategories;

  const setCurrentEditingCategories = (newCats: TaskCategoryGroup[]) => {
    if (editingDivision === "BAR") setBarCategories(newCats);
    else if (editingDivision === "KITCHEN") setKitchenCategories(newCats);
    else setBakerCategories(newCats);
  };

  const handleAddCategory = () => {
    const newCat: TaskCategoryGroup = {
      id: `cat-${Date.now()}`,
      category: "Kategori Baru",
      items: ["Contoh rincian tugas baru"],
    };
    setCurrentEditingCategories([...currentEditingCategories, newCat]);
  };

  const handleUpdateCategoryName = (catIdx: number, newName: string) => {
    const updated = [...currentEditingCategories];
    updated[catIdx] = { ...updated[catIdx], category: newName };
    setCurrentEditingCategories(updated);
  };

  const handleRemoveCategory = (catIdx: number) => {
    const updated = currentEditingCategories.filter((_, i) => i !== catIdx);
    setCurrentEditingCategories(updated);
  };

  const handleAddSubTask = (catIdx: number) => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    cat.items = [...(cat.items || []), "Sub-tugas baru"];
    setCurrentEditingCategories(updated);
  };

  const handleUpdateSubTask = (catIdx: number, itemIdx: number, text: string) => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    const items = [...cat.items];
    items[itemIdx] = text;
    cat.items = items;
    setCurrentEditingCategories(updated);
  };

  const handleRemoveSubTask = (catIdx: number, itemIdx: number) => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    cat.items = cat.items.filter((_, i) => i !== itemIdx);
    setCurrentEditingCategories(updated);
  };

  const handleResetToDefault = () => {
    if (!window.confirm("Kembalikan daftar kategori & sub-tugas divisi ini ke standar sistem?")) return;
    if (editingDivision === "BAR") setBarCategories(DEFAULT_BAR_CATEGORIES);
    else if (editingDivision === "KITCHEN") setKitchenCategories(DEFAULT_KITCHEN_CATEGORIES);
    else setBakerCategories(DEFAULT_BAKER_CATEGORIES);
  };

  const handleSaveSettings = () => {
    updateSettings({
      ...settings,
      leaderBarTasks: barCategories,
      leaderKitchenTasks: kitchenCategories,
      leaderBakerTasks: bakerCategories,
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
              Pantau laporan terperinci per kategori tugas (Kebersihan, Alat, Bahan, dll) & atur SOP rincian jobdesk.
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
              Atur Kategori & Rincian Tugas
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
                    className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white flex flex-col justify-between ${
                      inspectedDivision === div.key
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div>
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
                              {div.leaderName ? `Diisi oleh: ${div.leaderName}` : "Belum ada laporan"}
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
                      <div className="mt-3">
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-xs font-medium text-slate-500">
                            {div.completedCount} dari {div.totalTasks} Sub-Tugas
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

                      {/* Mini Category Badges */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                        {div.categories.map((c, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-slate-600 truncate max-w-[170px]" title={c.category}>
                              {c.category}
                            </span>
                            <span className={`font-bold ${
                              c.catPct === 100 ? "text-emerald-600" : c.catPct > 0 ? "text-amber-600" : "text-slate-400"
                            }`}>
                              {c.catCompleted}/{c.catTotal} ({c.catPct}%)
                            </span>
                          </div>
                        ))}
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

            {/* Rincian Terperinci per Kategori Tugas untuk Divisi Terpilih */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    Rincian Kategori Tugas: {selectedDivisionStat.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ceklis detail tugas harian per kategori per tanggal {selectedDate}
                  </p>
                </div>

                <div className="bg-slate-100 px-3.5 py-1.5 rounded-xl text-sm font-bold text-slate-700">
                  Total Terlaksana: {selectedDivisionStat.completedCount} / {selectedDivisionStat.totalTasks} ({selectedDivisionStat.percentage}%)
                </div>
              </div>

              {/* Loop Kategori Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {selectedDivisionStat.categories.map((cat, catIdx) => {
                  const isCatFull = cat.catPct === 100;

                  return (
                    <div 
                      key={catIdx}
                      className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-3"
                    >
                      {/* Header Kategori */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Kategori {catIdx + 1}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm">{cat.category}</h4>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          isCatFull 
                            ? "bg-emerald-100 text-emerald-700" 
                            : cat.catCompleted > 0 
                            ? "bg-amber-100 text-amber-700" 
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {cat.catCompleted}/{cat.catTotal} ({cat.catPct}%)
                        </span>
                      </div>

                      {/* Mini Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isCatFull ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${cat.catPct}%` }}
                        />
                      </div>

                      {/* Sub-tugas Items */}
                      <div className="space-y-2 pt-2">
                        {cat.items.map((item, itemIdx) => {
                          const isDone = isTaskChecked(
                            selectedDivisionStat.checklist?.leaderTasks || [],
                            cat.category,
                            item
                          );

                          return (
                            <div
                              key={itemIdx}
                              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                isDone
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-950 font-medium"
                                  : "bg-white border-slate-200 text-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                                )}
                                <span>{item}</span>
                              </div>
                              <span className={`font-bold ml-2 shrink-0 ${isDone ? "text-emerald-700" : "text-slate-400"}`}>
                                {isDone ? "Selesai" : "Belum"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PENGATURAN KATEGORI & RINCIAN TUGAS JOBDESK */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Kelola Kategori & Rincian Tugas Jobdesk
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur struktur kelompok kerja (Kebersihan, Pengecekan Alat, Gudang) beserta butir-butir sub-tugasnya.
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
                  Head Bar ({barCategories.length} Kategori)
                </button>
                <button
                  onClick={() => setEditingDivision("KITCHEN")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editingDivision === "KITCHEN"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Kitchen ({kitchenCategories.length} Kategori)
                </button>
                <button
                  onClick={() => setEditingDivision("BAKER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editingDivision === "BAKER"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Baker ({bakerCategories.length} Kategori)
                </button>
              </div>
            </div>

            {/* List Kategori Groups */}
            <div className="space-y-6">
              {currentEditingCategories.map((cat, catIdx) => (
                <div 
                  key={cat.id || catIdx}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4"
                >
                  {/* Category Header with Title input & Delete button */}
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {catIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={cat.category}
                      onChange={(e) => handleUpdateCategoryName(catIdx, e.target.value)}
                      className="flex-1 font-bold text-slate-800 bg-white px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nama Kategori (contoh: Kebersihan & Sanitasi Area)..."
                    />
                    <button
                      onClick={() => handleRemoveCategory(catIdx)}
                      className="p-2 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors shrink-0"
                      title="Hapus seluruh kategori ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sub-tugas Items inside this category */}
                  <div className="space-y-2 pl-9">
                    <p className="text-xs font-semibold text-slate-500">
                      Rincian Sub-Tugas Checklist:
                    </p>
                    {cat.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold w-5 text-right">
                          {itemIdx + 1}.
                        </span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleUpdateSubTask(catIdx, itemIdx, e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Rincian sub-tugas yang perlu diselesaikan..."
                        />
                        <button
                          onClick={() => handleRemoveSubTask(catIdx, itemIdx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus sub-tugas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => handleAddSubTask(catIdx)}
                      className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Tambah Sub-Tugas ke Kategori Ini
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddCategory}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors border border-blue-200"
                >
                  <Plus className="w-4 h-4" />
                  + Tambah Kategori Baru
                </button>
                <button
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset ke Standar Sistem
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
            Centang rincian tugas per kategori yang sudah Anda selesaikan untuk divisi Anda hari ini.
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
            <span className="text-2xl font-black text-slate-800">{leaderPercentage}%</span>
            <p className="text-xs font-semibold text-slate-500">
              {completedSubTasksLeader} dari {totalSubTasksLeader} Sub-Tugas
            </p>
          </div>
        </div>

        {/* Progress Bar Visual Utama */}
        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-300 ${
              leaderPercentage === 100 ? "bg-emerald-500" : completedSubTasksLeader > 0 ? "bg-amber-500" : "bg-slate-300"
            }`}
            style={{ width: `${leaderPercentage}%` }}
          />
        </div>

        {/* Grouped Categories Checklist */}
        <div className="space-y-6">
          {activeLeaderCategories.map((cat, catIdx) => {
            const catTotal = cat.items?.length || 0;
            let catDone = 0;
            (cat.items || []).forEach((item) => {
              if (isTaskChecked(leaderCompletedTasks, cat.category, item)) catDone++;
            });
            const catPct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0;
            const isCatComplete = catPct === 100;

            return (
              <div 
                key={catIdx}
                className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4"
              >
                {/* Category Header */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {catIdx + 1}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">{cat.category}</h4>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    isCatComplete ? "bg-emerald-100 text-emerald-700" : catDone > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {catDone}/{catTotal} Selesai ({catPct}%)
                  </span>
                </div>

                {/* Sub-tugas Checkbox Items */}
                <div className="space-y-2.5">
                  {cat.items.map((item, itemIdx) => {
                    const isChecked = isTaskChecked(leaderCompletedTasks, cat.category, item);

                    return (
                      <div
                        key={itemIdx}
                        onClick={() => toggleLeaderTask(cat.category, item)}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all select-none ${
                          isChecked
                            ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs sm:text-sm font-semibold ${
                            isChecked ? "text-emerald-900 line-through opacity-80" : "text-slate-800"
                          }`}>
                            {item}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
