import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { 
  CheckSquare, Square, Save, AlertCircle, Calendar, 
  CheckCircle2, Clock, XCircle, Plus, Trash2, RotateCcw, 
  Coffee, Utensils, Croissant, Users, ClipboardList, 
  Sliders, TrendingUp, Check, Layers, ChevronDown, ChevronUp,
  Sun, Moon, Sunset, DollarSign, Award, Sparkles, Filter,
  Lock, Edit2, ShieldCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { getLocalDateString } from "../utils/dateUtils";
import { TaskCategoryGroup, TaskItemDetail, LeaderAllowanceRule, DEFAULT_LEADER_ALLOWANCE_RULES } from "../types";
import { formatCurrency } from "../utils/format";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomDatePicker } from "./common/CustomDatePicker";

export const DEFAULT_BAR_CATEGORIES: TaskCategoryGroup[] = [
  {
    id: "bar-cat-1",
    category: "Kebersihan & Sanitasi Area",
    items: [
      { text: "Inspeksi kebersihan & sanitasi seluruh meja bar serta undercounter", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Verifikasi backflush mesin espresso & sanitasi portafilter", shift: "SORE", targetRole: "LEADER", isActive: true },
      { text: "Inspeksi kebersihan hopper grinder kopi & area POS kasir", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Pemeriksaan kebersihan lantai bar & ampas kopi di knockbox", shift: "SORE", targetRole: "LEADER", isActive: true },
      { text: "Cek kebersihan sink bar, drain tray, & pembuangan sampah", shift: "SORE", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "bar-cat-2",
    category: "Pengecekan Alat & Mesin",
    items: [
      { text: "Kalibrasi timbangan digital & dial-in espresso (rasio/ekstraksi)", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Cek tekanan pompa & temperatur steam wand mesin espresso", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Cek temperatur chiller susu (standar 2°C - 4°C) & ice maker", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Cek fungsi tablet POS kasir, jaringan internet, & printer struk", shift: "PAGI", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "bar-cat-3",
    category: "Bahan Baku & FIFO Gudang",
    items: [
      { text: "Cek tanggal kedaluwarsa & rotasi stok susu segar (FIFO)", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Cek ketersediaan biji kopi (beans), sirup, sauce, & powder", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Supervisi stok paper cup, sedotan, tutup cup, sendok, & tissue", shift: "MIDDLE", targetRole: "LEADER", isActive: true },
      { text: "Catat bahan yang menipis untuk pengajuan restock", shift: "SORE", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "bar-cat-4",
    category: "Kontroling Tim & Pelayanan",
    items: [
      { text: "Briefing standar serving, keramahan kasir, & kebersihan seragam", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Cek absensi staf bar dan kesiapan opening/closing shift", shift: "ALL", targetRole: "LEADER", isActive: true },
    ],
  },
];

export const DEFAULT_KITCHEN_CATEGORIES: TaskCategoryGroup[] = [
  {
    id: "kitchen-cat-1",
    category: "Kebersihan Dapur & Stewarding",
    items: [
      { text: "Inspeksi kebersihan kompor, fryer, grill, & permukaan stainless steel", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Verifikasi pembersihan grease trap & saringan saluran air", shift: "SORE", targetRole: "LEADER", isActive: true },
      { text: "Kontrol sanitasi talenan, pisau, & wadah persiapan (food-grade)", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Inspeksi kebersihan & sanitasi lantai dapur", shift: "SORE", targetRole: "LEADER", isActive: true },
      { text: "Supervisi area cuci piring (stewarding) & kerapian rak pengering", shift: "SORE", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "kitchen-cat-2",
    category: "Pengecekan Alat & Pendingin",
    items: [
      { text: "Cek temperatur chiller (1°C - 4°C) & deep freezer (-18°C)", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Cek instalasi tabung gas, regulator, & cerobong exhaust hood", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Cek kelayakan wajan, panci, fry basket, & penjepit makanan", shift: "ALL", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "kitchen-cat-3",
    category: "Penyimpanan Bahan & Food Safety",
    items: [
      { text: "Cek label tanggal (prep date) & masa simpan bahan marinasi (FIFO)", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Pastikan pemisahan bahan mentah (daging/ayam) dan bahan matang", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Cek kualitas sayuran segar & persediaan bumbu utama", shift: "PAGI", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "kitchen-cat-4",
    category: "Standar Porsi & Serving",
    items: [
      { text: "Cek standar gramasi porsi & resep makanan sesuai SOP", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Cek waktu saji makanan (ticket time standar dapur)", shift: "MIDDLE", targetRole: "LEADER", isActive: true },
      { text: "Evaluasi presentasi & kebersihan piring saji (plating)", shift: "ALL", targetRole: "LEADER", isActive: true },
    ],
  },
];

export const DEFAULT_BAKER_CATEGORIES: TaskCategoryGroup[] = [
  {
    id: "baker-cat-1",
    category: "Kebersihan Area Pastry & Alat",
    items: [
      { text: "Supervisi sanitasi meja kerja adonan & kebersihan loyang baking", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Verifikasi sanitasi rolling pin, scraper, & kuas pastry", shift: "SORE", targetRole: "LEADER", isActive: true },
      { text: "Inspeksi kebersihan oven, proofer, & area pemanggangan", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Cek kebersihan lantai pastry & pembuangan sisa bahan adonan", shift: "SORE", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "baker-cat-2",
    category: "Kontroling Alat Baking",
    items: [
      { text: "Cek kalibrasi temperatur oven & fungsi timer pemanggang", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Inspeksi kebersihan bowl spiral mixer & hook pengaduk adonan", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Cek kelembapan dan kontrol temperatur lemari proofer adonan", shift: "PAGI", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "baker-cat-3",
    category: "Kualitas Bahan Baku & Adonan",
    items: [
      { text: "Cek keaktifan ragi (yeast), kualitas butter, & kelembapan tepung", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Pastikan wadah bahan kering tertutup rapat & terlabel tanggal", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Supervisi persediaan topping, glaze, cokelat, dan filling pastry", shift: "MIDDLE", targetRole: "LEADER", isActive: true },
    ],
  },
  {
    id: "baker-cat-4",
    category: "Display & Kualitas Produk Jadi",
    items: [
      { text: "Cek tekstur, kerapuhan (flakiness), & warna kematangan pastry", shift: "ALL", targetRole: "LEADER", isActive: true },
      { text: "Inspeksi kebersihan etalase display pastry & lampu display", shift: "PAGI", targetRole: "LEADER", isActive: true },
      { text: "Pastikan label nama produk dan tag harga terpasang rapi", shift: "PAGI", targetRole: "LEADER", isActive: true },
    ],
  },
];

type Division = "BAR" | "KITCHEN" | "BAKER";

// Helper to normalize task item to TaskItemDetail
export const normalizeTaskItem = (item: any): TaskItemDetail => {
  if (!item) return { text: "", shift: "ALL", targetRole: "ALL", isActive: true };
  if (typeof item === "string") {
    return {
      text: item,
      shift: "ALL",
      targetRole: "ALL",
      isActive: true,
    };
  }
  return {
    id: item.id,
    text: item.text || "",
    shift: item.shift || "ALL",
    targetRole: item.targetRole || "ALL",
    isActive: item.isActive !== false,
  };
};

export const getTaskText = (item: string | TaskItemDetail): string => {
  return typeof item === "string" ? item : item.text;
};

export const matchesShift = (
  item: string | TaskItemDetail,
  shift: "PAGI" | "MIDDLE" | "SORE" | "ALL" | "OFF"
): boolean => {
  if (shift === "OFF") return false;
  const detail = normalizeTaskItem(item);
  if (!detail.isActive) return false;
  if (shift === "ALL") return true;
  return detail.shift === "ALL" || detail.shift === shift;
};

export const matchesRole = (
  item: string | TaskItemDetail,
  roleTarget: "LEADER" | "STAFF" | "ALL"
): boolean => {
  const detail = normalizeTaskItem(item);
  if (!detail.isActive) return false;
  if (roleTarget === "ALL") return true;
  if (!detail.targetRole || detail.targetRole === "ALL") return true;
  return detail.targetRole === roleTarget;
};

// Helper parser to support TaskCategoryGroup[] and convert legacy string[]
export const ensureCategoryArray = (raw: any, fallback: TaskCategoryGroup[]): TaskCategoryGroup[] => {
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
    return parsed.map((cat: any) => ({
      ...cat,
      items: (cat.items || []).map((it: any) => normalizeTaskItem(it)),
    }));
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
          items: (subItems.length > 0 ? subItems : [str]).map((s) => ({
            text: s,
            shift: "ALL" as const,
            isActive: true,
          })),
        };
      }
      return {
        id: `legacy-${idx}`,
        category: "Tugas Umum",
        items: [{ text: str, shift: "ALL" as const, isActive: true }],
      };
    });
  }

  return fallback;
};

// Unique task identifier helper (category + item)
export const getTaskKey = (catName: string, item: string | TaskItemDetail) => {
  const text = getTaskText(item);
  return `${catName}:::${text}`;
};

export const isTaskChecked = (
  completedList: string[],
  catName: string,
  item: string | TaskItemDetail
) => {
  const text = getTaskText(item);
  const key = `${catName}:::${text}`;
  return completedList.includes(key) || completedList.includes(text);
};

export const LeaderChecklist: React.FC = () => {
  const { 
    currentUser, 
    users, 
    employees,
    dailyChecklists, 
    setDailyChecklists, 
    settings, 
    updateSettings, 
    isReadOnly,
    employeeShifts 
  } = useStore();

  const isSupervisor = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "OWNER";
  const [activeTab, setActiveTab] = useState<"monitoring" | "monthly" | "settings">("monitoring");

  // Selected date for monitoring (defaults to today)
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Active division filter in supervisor detail view
  const [inspectedDivision, setInspectedDivision] = useState<Division>("BAR");
  // Setting template state for supervisor
  const [editingDivision, setEditingDivision] = useState<Division>("BAR");
  const [isTasksDirty, setIsTasksDirty] = useState(false);
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

  // Sub-tab di pengaturan Manager: Tasks vs Allowance Rules
  const [settingsSubTab, setSettingsSubTab] = useState<"TASKS" | "ALLOWANCE_RULES">("TASKS");

  // Allowance Rules state
  const [allowanceRules, setAllowanceRules] = useState<LeaderAllowanceRule[]>(() => {
    return settings?.leaderJobdeskAllowanceRules && settings.leaderJobdeskAllowanceRules.length > 0
      ? settings.leaderJobdeskAllowanceRules
      : DEFAULT_LEADER_ALLOWANCE_RULES;
  });
  const [editingRule, setEditingRule] = useState<LeaderAllowanceRule | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<{
    id?: string;
    grade: string;
    minScore: number;
    maxScore: number;
    payoutPercentage: number;
    label: string;
  }>({
    grade: "Grade A",
    minScore: 90,
    maxScore: 100,
    payoutPercentage: 100,
    label: "Sangat Baik (Cair Penuh 100%)",
  });

  const handleSaveAllowanceRules = (newRules: LeaderAllowanceRule[]) => {
    setAllowanceRules(newRules);
    updateSettings({
      ...settings,
      leaderJobdeskAllowanceRules: newRules,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleToggleRuleStatus = (ruleId: string) => {
    const updated = allowanceRules.map((r) =>
      r.id === ruleId ? { ...r, isActive: r.isActive === false ? true : false } : r
    );
    handleSaveAllowanceRules(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!window.confirm("Hapus aturan rentang grade ini?")) return;
    const updated = allowanceRules.filter((r) => r.id !== ruleId);
    handleSaveAllowanceRules(updated);
  };

  const handleResetRulesToDefault = () => {
    if (!window.confirm("Kembalikan aturan batas persenan ke standar sistem (Grade A/B/C/D)?")) return;
    handleSaveAllowanceRules(DEFAULT_LEADER_ALLOWANCE_RULES);
  };

  const handleOpenAddRule = () => {
    setEditingRule(null);
    setRuleForm({
      grade: "Grade Baru",
      minScore: 60,
      maxScore: 69,
      payoutPercentage: 30,
      label: "Cair 30%",
    });
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: LeaderAllowanceRule) => {
    setEditingRule(rule);
    setRuleForm({
      id: rule.id,
      grade: rule.grade,
      minScore: rule.minScore,
      maxScore: rule.maxScore,
      payoutPercentage: rule.payoutPercentage,
      label: rule.label,
    });
    setIsRuleModalOpen(true);
  };

  const handleSaveRuleForm = () => {
    if (Number(ruleForm.minScore) > Number(ruleForm.maxScore)) {
      alert("Skor minimal tidak boleh lebih besar dari skor maksimal!");
      return;
    }
    let updated: LeaderAllowanceRule[];
    if (editingRule) {
      updated = allowanceRules.map((r) =>
        r.id === editingRule.id
          ? {
              ...r,
              grade: ruleForm.grade,
              minScore: Number(ruleForm.minScore),
              maxScore: Number(ruleForm.maxScore),
              payoutPercentage: Number(ruleForm.payoutPercentage),
              label: ruleForm.label,
            }
          : r
      );
    } else {
      const newRule: LeaderAllowanceRule = {
        id: "lar_" + Date.now().toString(36),
        grade: ruleForm.grade,
        minScore: Number(ruleForm.minScore),
        maxScore: Number(ruleForm.maxScore),
        payoutPercentage: Number(ruleForm.payoutPercentage),
        label: ruleForm.label,
        isActive: true,
      };
      updated = [...allowanceRules, newRule];
    }
    updated.sort((a, b) => b.minScore - a.minScore);
    handleSaveAllowanceRules(updated);
    setIsRuleModalOpen(false);
  };

  // Deteksi divisi spesifik & status Leader vs Staf
  const userEmployee = employees?.find(
    (e) => e.id === currentUser?.employeeId || e.username?.toLowerCase() === currentUser?.username?.toLowerCase()
  );
  const deptStr = (currentUser?.department || userEmployee?.department || "").toUpperCase();
  const posStr = (userEmployee?.position || "").toUpperCase();
  const roleStr = (currentUser?.role || "").toUpperCase();

  const isLeaderRole = useMemo(() => {
    if (roleStr === "LEADER") return true;
    if (posStr.includes("LEADER") || posStr.includes("HEAD") || posStr.includes("SPV") || posStr.includes("SUPERVISOR")) return true;
    if (deptStr.includes("LEADER")) return true;
    return false;
  }, [roleStr, posStr, deptStr]);

  const assignedLeaderDivision: Division = useMemo(() => {
    if (deptStr.includes("KITCHEN") || posStr.includes("KITCHEN") || roleStr === "KITCHEN") return "KITCHEN";
    if (deptStr.includes("BAKER") || posStr.includes("BAKER") || posStr.includes("PASTRY") || roleStr === "BAKER") return "BAKER";
    if (deptStr.includes("BAR") || posStr.includes("BAR") || roleStr === "BAR" || roleStr === "KASIR" || posStr.includes("KASIR")) return "BAR";
    return "BAR";
  }, [deptStr, posStr, roleStr]);

  // Kunci divisi leader HANYA ke divisi miliknya — tidak boleh mengakses divisi lain
  const leaderActiveDivision: Division = assignedLeaderDivision;

  // Filter mode untuk pengisian checklist harian (Leader QC vs Staf Operasional vs Semua)
  const [operationalRoleFilter, setOperationalRoleFilter] = useState<"LEADER" | "STAFF" | "ALL">(
    isLeaderRole ? "LEADER" : "STAFF"
  );

  React.useEffect(() => {
    setOperationalRoleFilter(isLeaderRole ? "LEADER" : "STAFF");
  }, [isLeaderRole]);

  // Synchronize tasks when settings change, but never overwrite while user is editing
  React.useEffect(() => {
    if (isTasksDirty) return;
    if (settings?.leaderBarTasks) {
      setBarCategories(ensureCategoryArray(settings.leaderBarTasks, DEFAULT_BAR_CATEGORIES));
    }
    if (settings?.leaderKitchenTasks) {
      setKitchenCategories(ensureCategoryArray(settings.leaderKitchenTasks, DEFAULT_KITCHEN_CATEGORIES));
    }
    if (settings?.leaderBakerTasks) {
      setBakerCategories(ensureCategoryArray(settings.leaderBakerTasks, DEFAULT_BAKER_CATEGORIES));
    }
    if (settings?.leaderJobdeskAllowanceRules && settings.leaderJobdeskAllowanceRules.length > 0) {
      setAllowanceRules(settings.leaderJobdeskAllowanceRules);
    }
  }, [settings, isTasksDirty]);


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

  // ─── USER ACTIVE SHIFT FOR TODAY ─────────────────────────────────────────
  const userEmpId = currentUser?.employeeId || userEmployee?.id || currentUser?.id;
  const todayShiftRecord = (employeeShifts || []).find(
    (s: any) => s.employeeId === userEmpId && s.date === today
  );
  // Auto-detect based on current time if employee is not explicitly scheduled in roster
  const currentHour = new Date().getHours();
  const defaultShiftByTime: "PAGI" | "MIDDLE" | "SORE" = 
    currentHour >= 15 ? "SORE" : currentHour >= 11 ? "MIDDLE" : "PAGI";
  const userScheduledShift: "PAGI" | "MIDDLE" | "SORE" | "OFF" = todayShiftRecord?.shiftType || defaultShiftByTime;

  const [shiftFilter, setShiftFilter] = useState<"MY_SHIFT" | "ALL">(
    userScheduledShift === "OFF" ? "ALL" : "MY_SHIFT"
  );

  // ─── LEADER & STAFF FILLING STATE ────────────────────────────────────────
  const activeLeaderCategories = getCategoriesForDivision(leaderActiveDivision);

  // Find existing checklist for currently logged in user for TODAY (strictly per employee)
  const userExistingChecklist = useMemo(() => {
    return dailyChecklists.find(
      (c) => c.date.startsWith(today) && (c.employeeId === currentUser?.id || (userEmpId && c.employeeId === userEmpId))
    );
  }, [dailyChecklists, today, currentUser, userEmpId]);

  const [leaderCompletedTasks, setLeaderCompletedTasks] = useState<string[]>(
    userExistingChecklist?.leaderTasks || []
  );
  const [leaderNotes, setLeaderNotes] = useState<string>(
    userExistingChecklist?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || ""
  );
  const [leaderSaved, setLeaderSaved] = useState(false);

  // Sync state when checklist changes
  React.useEffect(() => {
    setLeaderCompletedTasks(userExistingChecklist?.leaderTasks || []);
    setLeaderNotes(userExistingChecklist?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || "");
  }, [userExistingChecklist, leaderActiveDivision]);

  const toggleLeaderTask = (catName: string, item: string | TaskItemDetail) => {
    if (isReadOnly) return;
    setLeaderSaved(false);
    const key = getTaskKey(catName, item);
    const itemText = getTaskText(item);

    setLeaderCompletedTasks((prev) => {
      const checked = prev.includes(key) || prev.includes(itemText);
      if (checked) {
        return prev.filter((t) => t !== key && t !== itemText);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSaveLeaderChecklist = () => {
    if (isReadOnly || !currentUser) return;

    const formattedNotes = `[${leaderActiveDivision}] ${leaderNotes.trim()}`;
    const newChecklist = {
      id: userExistingChecklist?.id || crypto.randomUUID(),
      employeeId: userEmpId || currentUser.id,
      date: today,
      cleaningDone: true,
      equipmentChecked: true,
      leaderTasks: leaderCompletedTasks,
      notes: formattedNotes,
    };

    if (userExistingChecklist) {
      setDailyChecklists(
        dailyChecklists.map((c) => (c.id === newChecklist.id ? newChecklist : c))
      );
    } else {
      setDailyChecklists([...dailyChecklists, newChecklist]);
    }

    setLeaderSaved(true);
    setTimeout(() => setLeaderSaved(false), 3000);
  };

  // Filter categories displayed based on shiftFilter & roleFilter (STAFF tasks hidden)
  const displayCategories = useMemo(() => {
    return activeLeaderCategories.map((cat) => {
      const filteredItems = (cat.items || []).filter((item) => {
        const norm = normalizeTaskItem(item);
        if (!norm.isActive) return false;

        // Shift filter
        if (shiftFilter !== "ALL" && !matchesShift(item, userScheduledShift)) {
          return false;
        }

        // Jobdesk staf dikunci dan disembunyikan agar tidak rancu (hanya tugas Leader/QC yang tampil)
        if (norm.targetRole === "STAFF") return false;

        return true;
      });
      return {
        ...cat,
        items: filteredItems,
      };
    }).filter((cat) => cat.items.length > 0);
  }, [activeLeaderCategories, shiftFilter, userScheduledShift]);

  // Calculate counts based on displayCategories
  const totalSubTasksLeader = useMemo(() => {
    return displayCategories.reduce((acc, cat) => acc + (cat.items?.length || 0), 0);
  }, [displayCategories]);

  const completedSubTasksLeader = useMemo(() => {
    let count = 0;
    displayCategories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        if (isTaskChecked(leaderCompletedTasks, cat.category, item)) {
          count++;
        }
      });
    });
    return count;
  }, [displayCategories, leaderCompletedTasks]);

  const leaderPercentage = totalSubTasksLeader > 0 
    ? Math.round((completedSubTasksLeader / totalSubTasksLeader) * 100) 
    : 0;

  // Tier tunjangan jabatan hari ini untuk leader
  const matchedTodayTier = useMemo(() => {
    const activeRules = allowanceRules.filter((r) => r.isActive !== false);
    return activeRules.find((r) => leaderPercentage >= r.minScore && leaderPercentage <= r.maxScore) || 
           activeRules[activeRules.length - 1];
  }, [allowanceRules, leaderPercentage]);

  // ─── SUPERVISOR MONITORING COMPUTATION (FOKUS 100% LEADER & QC) ──────────
  const divisionStats = useMemo(() => {
    const targetDateChecklists = dailyChecklists.filter((c) => c.date.startsWith(selectedDate));
    
    const divisions: { key: Division; label: string; icon: any; color: string }[] = [
      { key: "BAR", label: "Head Bar & Kasir", icon: Coffee, color: "amber" },
      { key: "KITCHEN", label: "Head Kitchen", icon: Utensils, color: "orange" },
      { key: "BAKER", label: "Head Baker", icon: Croissant, color: "emerald" },
    ];

    return divisions.map((div) => {
      const categories = getCategoriesForDivision(div.key);
      const activeCategories = categories.map((cat) => ({
        ...cat,
        items: (cat.items || []).filter((it) => {
          const norm = normalizeTaskItem(it);
          if (!norm.isActive) return false;
          // Sembunyikan jobdesk staf di role manager agar 100% fokus ke pengawasan leader
          if (norm.targetRole === "STAFF") return false;
          return true;
        }),
      })).filter((cat) => cat.items.length > 0);

      const totalTasks = activeCategories.reduce((acc, cat) => acc + cat.items.length, 0);
      const divChecklists = targetDateChecklists.filter((c) => getDivisionForChecklist(c) === div.key);

      // Cari checklist khusus Leader divisi ini
      const leaderChecklist = divChecklists.find((c) => {
        const u = users.find((user) => user.id === c.employeeId);
        const emp = employees.find((e) => e.id === c.employeeId || e.username === u?.username);
        const pos = (emp?.position || "").toUpperCase();
        return u?.role === "LEADER" || pos.includes("LEADER") || pos.includes("HEAD") || pos.includes("SPV");
      }) || divChecklists[0];

      // Daftar tugas yang dicentang oleh Leader
      const leaderCheckedTasks = leaderChecklist?.leaderTasks || [];

      // Category breakdown calculation khusus tugas supervisi & QC Leader
      const categoryBreakdown = activeCategories.map((cat) => {
        const catTotal = cat.items.length;
        let catCompleted = 0;
        cat.items.forEach((item) => {
          if (isTaskChecked(leaderCheckedTasks, cat.category, item)) {
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
      
      const leaderUser = leaderChecklist ? users.find((u) => u.id === leaderChecklist.employeeId) : null;
      const leaderEmp = leaderChecklist ? employees.find((e) => e.id === leaderChecklist.employeeId || e.username === leaderUser?.username) : null;
      const leaderName = leaderUser ? leaderUser.name : leaderEmp ? leaderEmp.name : leaderChecklist ? "Leader Divisi" : null;
      const cleanNotes = leaderChecklist?.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || "";

      // Tier tunjangan jabatan berdasarkan capaian persentase tugas pengawasan
      const activeRules = allowanceRules.filter((r) => r.isActive !== false);
      const matchedGrade = activeRules.find((r) => percentage >= r.minScore && percentage <= r.maxScore) || 
                           activeRules[activeRules.length - 1] || 
                           { grade: "Grade D", payoutPercentage: 0, label: "Hangus" };

      return {
        ...div,
        categories: categoryBreakdown,
        totalTasks,
        completedCount,
        percentage,
        isSubmitted: !!leaderChecklist,
        leaderName,
        checklist: leaderChecklist,
        cleanNotes,
        matchedGrade,
        leaderCheckedTasks,
      };
    });
  }, [dailyChecklists, selectedDate, barCategories, kitchenCategories, bakerCategories, users, employees, allowanceRules]);

  // Overall average percentage for today
  const overallPercentage = useMemo(() => {
    const total = divisionStats.reduce((acc, d) => acc + d.percentage, 0);
    return Math.round(total / divisionStats.length);
  }, [divisionStats]);

  // ─── STATE & COMPUTATION UNTUK REKAP PROGRESS BULANAN ────────────────────
  const currentYearMonth = today.slice(0, 7); // e.g. "2026-10"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [monthlyDivisionFilter, setMonthlyDivisionFilter] = useState<Division | "ALL">("ALL");

  const daysInSelectedMonth = useMemo(() => {
    const parts = selectedMonth.split("-").map(Number);
    const year = parts[0] || new Date().getFullYear();
    const month = parts[1] || new Date().getMonth() + 1;
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInSelectedMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${selectedMonth}-${String(dayNum).padStart(2, "0")}`;
      return {
        dayNum,
        dateStr,
        isFuture: dateStr > today,
        isToday: dateStr === today,
      };
    });
  }, [selectedMonth, daysInSelectedMonth, today]);

  const monthlyDivisionStats = useMemo(() => {
    const divisions: {
      key: Division;
      label: string;
      icon: any;
      color: string;
      badgeBg: string;
      badgeText: string;
    }[] = [
      { key: "BAR", label: "Head Bar & Kasir", icon: Coffee, color: "amber", badgeBg: "bg-amber-100", badgeText: "text-amber-800" },
      { key: "KITCHEN", label: "Head Kitchen", icon: Utensils, color: "orange", badgeBg: "bg-orange-100", badgeText: "text-orange-800" },
      { key: "BAKER", label: "Head Baker", icon: Croissant, color: "emerald", badgeBg: "bg-emerald-100", badgeText: "text-emerald-800" },
    ];

    const activeRules = allowanceRules.filter((r) => r.isActive !== false);

    return divisions.map((div) => {
      const categories = getCategoriesForDivision(div.key);
      const activeCategories = categories
        .map((cat) => ({
          ...cat,
          items: (cat.items || []).filter((it) => {
            const norm = normalizeTaskItem(it);
            if (!norm.isActive) return false;
            if (norm.targetRole === "STAFF") return false;
            return true;
          }),
        }))
        .filter((cat) => cat.items.length > 0);

      const totalTasksPerDay = activeCategories.reduce((acc, cat) => acc + cat.items.length, 0);

      // Checklists untuk divisi ini di bulan terpilih
      const monthChecklists = dailyChecklists.filter(
        (c) => c.date.startsWith(selectedMonth) && getDivisionForChecklist(c) === div.key
      );

      // Map per tanggal: YYYY-MM-DD -> { checklist, completedCount, percentage, submitterName, notes }
      const dayRecordsMap: Record<
        string,
        { checklist: any; completedCount: number; percentage: number; submitterName?: string; notes?: string }
      > = {};

      monthChecklists.forEach((c) => {
        const dateKey = c.date.slice(0, 10);
        const leaderTasks = c.leaderTasks || [];
        let completed = 0;
        activeCategories.forEach((cat) => {
          (cat.items || []).forEach((item) => {
            if (isTaskChecked(leaderTasks, cat.category, item)) {
              completed++;
            }
          });
        });
        const pct = totalTasksPerDay > 0 ? Math.round((completed / totalTasksPerDay) * 100) : 0;

        const u = users.find((user) => user.id === c.employeeId);
        const emp = employees.find((e) => e.id === c.employeeId || e.username === u?.username);
        const submitterName = u?.name || emp?.name;
        const cleanNotes = c.notes?.replace(/^\[(BAR|KITCHEN|BAKER)\]\s*/, "") || "";

        if (!dayRecordsMap[dateKey] || pct > dayRecordsMap[dateKey].percentage) {
          dayRecordsMap[dateKey] = { checklist: c, completedCount: completed, percentage: pct, submitterName, notes: cleanNotes };
        }
      });

      const submittedDaysCount = Object.keys(dayRecordsMap).length;
      const pastOrTodayDays = daysArray.filter((d) => !d.isFuture);
      const elapsedDaysCount = Math.max(1, pastOrTodayDays.length);

      // Rata-rata skor saat checklist diserahkan
      const totalScoreSubmitted = Object.values(dayRecordsMap).reduce((sum, r) => sum + r.percentage, 0);
      const avgScoreOnSubmittedDays =
        submittedDaysCount > 0 ? Math.round(totalScoreSubmitted / submittedDaysCount) : 0;

      // Skor Kepatuhan Efektif Bulanan
      const monthlyEffectiveScore = Math.min(
        100,
        Math.round((submittedDaysCount / elapsedDaysCount) * avgScoreOnSubmittedDays)
      );

      // Grade dan batas pencairan tunjangan
      const matchedGrade =
        activeRules.find(
          (r) => monthlyEffectiveScore >= r.minScore && monthlyEffectiveScore <= r.maxScore
        ) ||
        activeRules[activeRules.length - 1] || {
          grade: "Grade D",
          payoutPercentage: 0,
          label: "Kurang (0%)",
        };

      // Identifikasi nama Leader
      const sampleChecklist = monthChecklists[0];
      const leaderUser = sampleChecklist ? users.find((u) => u.id === sampleChecklist.employeeId) : null;
      const leaderEmpFromChecklist = sampleChecklist ? employees.find((e) => e.id === sampleChecklist.employeeId || e.username === leaderUser?.username) : null;

      const officialLeaderEmp = employees.find((e) => {
        const dept = (e.department || "").toUpperCase();
        const pos = (e.position || "").toUpperCase();
        const matchesDiv =
          div.key === "BAR"
            ? dept.includes("BAR") || pos.includes("BAR") || pos.includes("KASIR")
            : div.key === "KITCHEN"
            ? dept.includes("KITCHEN") || pos.includes("KITCHEN") || pos.includes("COOK")
            : dept.includes("BAKER") || pos.includes("BAKER") || pos.includes("PASTRY");
        const isLead =
          pos.includes("LEADER") || pos.includes("HEAD") || pos.includes("SPV") || pos.includes("SUPERVISOR");
        return matchesDiv && isLead && e.status === "AKTIF";
      });

      const leaderName = officialLeaderEmp?.name || leaderEmpFromChecklist?.name || leaderUser?.name || `Leader ${div.label}`;

      return {
        ...div,
        totalTasksPerDay,
        submittedDaysCount,
        elapsedDaysCount,
        daysInMonth: daysInSelectedMonth,
        submissionRate: Math.min(100, Math.round((submittedDaysCount / elapsedDaysCount) * 100)),
        avgScoreOnSubmittedDays,
        monthlyEffectiveScore,
        matchedGrade,
        leaderName,
        dayRecordsMap,
      };
    });
  }, [
    selectedMonth,
    daysArray,
    daysInSelectedMonth,
    dailyChecklists,
    allowanceRules,
    barCategories,
    kitchenCategories,
    bakerCategories,
    users,
    employees,
  ]);

  const overallMonthlyScore = useMemo(() => {
    if (monthlyDivisionStats.length === 0) return 0;
    const total = monthlyDivisionStats.reduce((acc, d) => acc + d.monthlyEffectiveScore, 0);
    return Math.round(total / monthlyDivisionStats.length);
  }, [monthlyDivisionStats]);

  const totalMonthlySubmissions = useMemo(() => {
    return monthlyDivisionStats.reduce((acc, d) => acc + d.submittedDaysCount, 0);
  }, [monthlyDivisionStats]);

  // Monthly progress untuk Leader yang sedang login
  const leaderPersonalMonthly = useMemo(() => {
    if (!isLeaderRole) return null;
    return monthlyDivisionStats.find((d) => d.key === leaderActiveDivision) || null;
  }, [isLeaderRole, monthlyDivisionStats, leaderActiveDivision]);

  // ─── SUPERVISOR TASK CONFIGURATION HANDLERS ───────────────────────────────
  const currentEditingCategories = 
    editingDivision === "BAR" ? barCategories : 
    editingDivision === "KITCHEN" ? kitchenCategories : bakerCategories;

  const setCurrentEditingCategories = (newCats: TaskCategoryGroup[]) => {
    setIsTasksDirty(true);
    if (editingDivision === "BAR") setBarCategories(newCats);
    else if (editingDivision === "KITCHEN") setKitchenCategories(newCats);
    else setBakerCategories(newCats);
  };

  // Breakdown statistik tugas supervisi Leader untuk divisi yang sedang diedit
  const statsEditingDivision = useMemo(() => {
    let totalCount = 0;
    let activeCount = 0;

    currentEditingCategories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        const norm = normalizeTaskItem(item);
        if (norm.targetRole === "STAFF") return; // abaikan staf
        totalCount++;
        if (norm.isActive) activeCount++;
      });
    });

    return { totalCount, activeCount };
  }, [currentEditingCategories]);

  const handleAddCategory = () => {
    const newCat: TaskCategoryGroup = {
      id: `cat-${Date.now()}`,
      category: "Kategori Pengawasan Baru",
      items: [{ text: "Inspeksi / supervisi stasiun kerja baru", shift: "ALL", targetRole: "LEADER", isActive: true }],
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

  const handleAddSubTask = (catIdx: number, defaultRole: "LEADER" = "LEADER") => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    const defaultText = "Tugas supervisi / inspeksi stasiun kerja (Leader)";

    cat.items = [
      ...(cat.items || []), 
      { 
        text: defaultText, 
        shift: "ALL", 
        targetRole: "LEADER",
        isActive: true 
      }
    ];
    setCurrentEditingCategories(updated);
  };

  const handleUpdateSubTaskText = (catIdx: number, itemIdx: number, text: string) => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    const items = [...cat.items];
    const norm = normalizeTaskItem(items[itemIdx]);
    items[itemIdx] = { ...norm, text };
    cat.items = items;
    setCurrentEditingCategories(updated);
  };

  const handleUpdateSubTaskShift = (catIdx: number, itemIdx: number, shift: "PAGI" | "MIDDLE" | "SORE" | "ALL") => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    const items = [...cat.items];
    const norm = normalizeTaskItem(items[itemIdx]);
    items[itemIdx] = { ...norm, shift };
    cat.items = items;
    setCurrentEditingCategories(updated);
  };

  const handleUpdateSubTaskRole = (catIdx: number, itemIdx: number, targetRole: "STAFF" | "LEADER" | "ALL") => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    const items = [...cat.items];
    const norm = normalizeTaskItem(items[itemIdx]);
    items[itemIdx] = { ...norm, targetRole };
    cat.items = items;
    setCurrentEditingCategories(updated);
  };

  const handleToggleSubTaskActive = (catIdx: number, itemIdx: number) => {
    const updated = [...currentEditingCategories];
    const cat = updated[catIdx];
    const items = [...cat.items];
    const norm = normalizeTaskItem(items[itemIdx]);
    items[itemIdx] = { ...norm, isActive: !norm.isActive };
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
    setIsTasksDirty(true);
    if (editingDivision === "BAR") setBarCategories(DEFAULT_BAR_CATEGORIES);
    else if (editingDivision === "KITCHEN") setKitchenCategories(DEFAULT_KITCHEN_CATEGORIES);
    else setBakerCategories(DEFAULT_BAKER_CATEGORIES);
  };

  const handleSaveSettings = () => {
    setIsTasksDirty(false);
    updateSettings({
      ...settings,
      leaderBarTasks: barCategories,
      leaderKitchenTasks: kitchenCategories,
      leaderBakerTasks: bakerCategories,
      leaderJobdeskAllowanceRules: allowanceRules,
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
      <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
        {/* Header Manager */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                Supervisor Dashboard
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                Monitoring & Pengaturan Jobdesk Leader
              </h2>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Pantau laporan terperinci per kategori tugas (Kebersihan, Alat, Bahan, dll) & atur SOP rincian jobdesk.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="w-full md:w-auto flex items-center gap-1 bg-slate-100 p-1 sm:p-1.5 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth">
            <button
              onClick={() => setActiveTab("monitoring")}
              className={`whitespace-nowrap shrink-0 flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "monitoring"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
              <span>Pantau Harian</span>
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`whitespace-nowrap shrink-0 flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
              <span>Rekap Bulanan</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`whitespace-nowrap shrink-0 flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span>Atur SOP & Grade</span>
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
                  <div className="flex items-center gap-2 mt-0.5 shrink-0 flex-nowrap">
                    <CustomDatePicker
                      value={selectedDate}
                      onChange={setSelectedDate}
                      allowClear={false}
                      placeholder="Pilih Tanggal"
                      buttonClassName="bg-slate-800 border-slate-700 text-white hover:bg-slate-700/80 rounded-xl py-1.5 px-3"
                    />
                    <button
                      onClick={() => {
                        const ym = selectedDate.slice(0, 7);
                        setSelectedMonth(ym);
                        setActiveTab("monthly");
                      }}
                      className="whitespace-nowrap shrink-0 text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-blue-400 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Beralih ke tampilan rekapitulasi satu bulan penuh"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Rekap 1 Bulan</span>
                    </button>
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
                              {div.leaderName 
                                ? `Leader: ${div.leaderName}` 
                                : div.isSubmitted 
                                ? `${div.submittersCount} checklist staf terkirim` 
                                : "Belum ada laporan"}
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

                      {/* Total Progress Bar & Percentage */}
                      <div className="mt-3">
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-xs font-medium text-slate-500">
                            Total {div.completedCount} dari {div.totalTasks} Tugas
                          </span>
                          <span className="text-lg font-black text-slate-800">
                            {div.percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isFull ? "bg-emerald-500" : isStarted ? "bg-amber-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${div.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Status Capaian & Tunjangan Jabatan Leader */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                              👑 Capaian Jobdesk Leader
                            </span>
                            <p className="text-xs font-bold text-amber-950">
                              {div.matchedGrade.grade} • Cair {div.matchedGrade.payoutPercentage}%
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            div.percentage >= 90
                              ? "bg-emerald-500 text-white"
                              : div.percentage >= 80
                              ? "bg-amber-500 text-white"
                              : div.percentage >= 70
                              ? "bg-blue-600 text-white"
                              : "bg-slate-400 text-white"
                          }`}>
                            {div.percentage}% Selesai
                          </span>
                        </div>
                      </div>

                      {/* Mini Category Badges */}
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
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
                    Rincian Tugas Pengawasan: {selectedDivisionStat.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Daftar tugas pengawasan & kontrol kualitas (QC) per tanggal {selectedDate}
                  </p>
                </div>

                {/* Status Fokus Leader */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-1.5 shadow-2xs">
                    👑 Khusus Pengawasan Leader ({selectedDivisionStat.totalTasks} Tugas)
                  </div>
                  <div className="bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hidden lg:block">
                    Capaian: {selectedDivisionStat.completedCount} / {selectedDivisionStat.totalTasks} ({selectedDivisionStat.percentage}%)
                  </div>
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
                          const itemDetail = normalizeTaskItem(item);
                          if (itemDetail.targetRole === "STAFF") return null;

                          const isDone = isTaskChecked(
                            selectedDivisionStat.leaderCheckedTasks || [],
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
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                                )}
                                <span className="truncate">{itemDetail.text}</span>

                                {/* Role Badge */}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                  👑 Leader QC
                                </span>

                                {/* Shift Badge */}
                                {itemDetail.shift && itemDetail.shift !== "ALL" && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase shrink-0">
                                    {itemDetail.shift}
                                  </span>
                                )}
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

        {/* TAB 2: REKAP & PROGRESS BULANAN */}
        {activeTab === "monthly" && (
          <div className="space-y-6">
            {/* Filter Bulan & Overview Kartu Atas */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Bulan Periode Evaluasi</p>
                    <CustomMonthPicker
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                      allowClear={false}
                      placeholder="Pilih Bulan Evaluasi"
                      buttonClassName="bg-slate-800 border-slate-700 text-white hover:bg-slate-700/80 hover:border-slate-600 rounded-xl"
                    />
                  </div>
                </div>

                {/* Filter Divisi */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 sm:ml-4 mt-2 sm:mt-0 text-xs shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setMonthlyDivisionFilter("ALL")}
                    className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      monthlyDivisionFilter === "ALL"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Semua Divisi
                  </button>
                  <button
                    onClick={() => setMonthlyDivisionFilter("BAR")}
                    className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      monthlyDivisionFilter === "BAR"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Bar
                  </button>
                  <button
                    onClick={() => setMonthlyDivisionFilter("KITCHEN")}
                    className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      monthlyDivisionFilter === "KITCHEN"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Kitchen
                  </button>
                  <button
                    onClick={() => setMonthlyDivisionFilter("BAKER")}
                    className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      monthlyDivisionFilter === "BAKER"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Baker
                  </button>
                </div>
              </div>

              {/* Stat Ringkasan Rata-rata Bulanan */}
              <div className="flex items-center gap-6 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-6 w-full lg:w-auto justify-between lg:justify-start">
                <div>
                  <p className="text-xs text-slate-400">Total Checklist Masuk</p>
                  <p className="text-xl font-black text-white font-mono">
                    {totalMonthlySubmissions} <span className="text-xs font-normal text-slate-400">checklist</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Rata-rata Skor Efektif</p>
                  <p className="text-2xl font-black text-amber-400 font-mono">{overallMonthlyScore}%</p>
                </div>
              </div>
            </div>

            {/* 3 Kartu Progress Bulanan Per Divisi */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {monthlyDivisionStats
                .filter((d) => monthlyDivisionFilter === "ALL" || monthlyDivisionFilter === d.key)
                .map((div) => {
                  const Icon = div.icon;
                  const isHigh = div.monthlyEffectiveScore >= 85;
                  const isMedium = div.monthlyEffectiveScore >= 70;

                  return (
                    <div
                      key={div.key}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
                    >
                      <div>
                        {/* Header Divisi */}
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${
                              div.key === "BAR" ? "bg-amber-100 text-amber-700" :
                              div.key === "KITCHEN" ? "bg-orange-100 text-orange-700" :
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 text-base">{div.label}</h3>
                              <p className="text-xs text-slate-500 font-medium">
                                Leader: <span className="font-semibold text-slate-700">{div.leaderName}</span>
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                            div.monthlyEffectiveScore >= 90
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : div.monthlyEffectiveScore >= 80
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : div.monthlyEffectiveScore >= 70
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-rose-50 text-rose-700 border-rose-300"
                          }`}>
                            {div.matchedGrade.grade}
                          </span>
                        </div>

                        {/* Metrik Utama 1 Bulan */}
                        <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Hari Terisi</span>
                            <p className="text-sm font-black text-slate-800 font-mono">
                              {div.submittedDaysCount} <span className="text-xs text-slate-500 font-normal">/ {div.elapsedDaysCount} hari</span>
                            </p>
                            <span className="text-[11px] text-slate-500">
                              Disiplin: {div.submissionRate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Rata-rata Skor</span>
                            <p className="text-sm font-black text-amber-600 font-mono">
                              {div.avgScoreOnSubmittedDays}%
                            </p>
                            <span className="text-[11px] text-slate-500">
                              Kualitas checklist
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Skor Efektif Bulanan */}
                        <div className="mt-4">
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-xs font-semibold text-slate-600">
                              Skor Kepatuhan Efektif
                            </span>
                            <span className="text-lg font-black font-mono text-slate-900">
                              {div.monthlyEffectiveScore}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isHigh ? "bg-emerald-500" : isMedium ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${div.monthlyEffectiveScore}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Estimasi Tunjangan Jabatan */}
                      <div className="pt-3 border-t border-slate-100">
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase text-amber-800">
                              👑 Proyeksi Payroll
                            </span>
                            <p className="text-xs font-bold text-amber-950">
                              Tunjangan Cair: {div.matchedGrade.payoutPercentage}%
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold text-amber-800 bg-white px-2 py-1 rounded-md border border-amber-300">
                            {div.matchedGrade.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Kalender Matriks Kepatuhan Harian Sepanjang Bulan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    Matriks Pengisian Checklist Harian ({new Date(selectedMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Klik kotak tanggal mana pun untuk langsung memeriksa rincian tugas yang diselesaikan pada tanggal tersebut.
                  </p>
                </div>

                {/* Legenda Warna */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    ≥90% (Lengkap)
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    50–89% (Sebagian)
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    &lt;50% / Belum
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    Masa Depan
                  </div>
                </div>
              </div>

              {/* Baris per Divisi */}
              <div className="space-y-4 overflow-x-auto pb-2">
                {monthlyDivisionStats
                  .filter((d) => monthlyDivisionFilter === "ALL" || monthlyDivisionFilter === d.key)
                  .map((div) => {
                    const Icon = div.icon;

                    return (
                      <div key={div.key} className="space-y-2 min-w-[700px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded-lg ${div.badgeBg} ${div.badgeText}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs font-bold text-slate-800">{div.label}</span>
                            <span className="text-[11px] text-slate-400">({div.leaderName})</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-600">
                            {div.submittedDaysCount} dari {div.elapsedDaysCount} hari ({div.submissionRate}%) • Skor {div.monthlyEffectiveScore}%
                          </span>
                        </div>

                        {/* Grid Tanggal 1 s/d 31 */}
                        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${daysInSelectedMonth}, minmax(0, 1fr))` }}>
                          {daysArray.map((day) => {
                            const record = div.dayRecordsMap[day.dateStr];
                            const isSubmitted = !!record;
                            const pct = record?.percentage ?? 0;

                            let bgClass = "bg-slate-100 border-slate-200 text-slate-400";
                            if (day.isFuture) {
                              bgClass = "bg-slate-50 border-slate-100 text-slate-300 opacity-60";
                            } else if (isSubmitted) {
                              if (pct >= 90) {
                                bgClass = "bg-emerald-500 border-emerald-600 text-white font-bold shadow-2xs hover:bg-emerald-600";
                              } else if (pct >= 50) {
                                bgClass = "bg-amber-400 border-amber-500 text-amber-950 font-bold shadow-2xs hover:bg-amber-500";
                              } else {
                                bgClass = "bg-rose-400 border-rose-500 text-white font-bold shadow-2xs hover:bg-rose-500";
                              }
                            } else {
                              bgClass = "bg-rose-50 border-rose-200 text-rose-400 hover:bg-rose-100";
                            }

                            return (
                              <button
                                key={day.dayNum}
                                type="button"
                                disabled={day.isFuture}
                                onClick={() => {
                                  setSelectedDate(day.dateStr);
                                  setInspectedDivision(div.key);
                                  setActiveTab("monitoring");
                                }}
                                title={
                                  day.isFuture
                                    ? `Tgl ${day.dayNum}: Belum berjalan`
                                    : isSubmitted
                                    ? `Tgl ${day.dayNum}: Selesai ${pct}% (${record.completedCount}/${div.totalTasksPerDay} tugas)${record.notes ? `\nCatatan: ${record.notes}` : ""}\nKlik untuk lihat detail`
                                    : `Tgl ${day.dayNum}: Belum diisi oleh Leader`
                                }
                                className={`h-9 rounded-lg border text-[11px] flex flex-col items-center justify-center transition-all ${bgClass} ${
                                  !day.isFuture ? "cursor-pointer hover:scale-105" : "cursor-default"
                                } ${day.isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                              >
                                <span>{day.dayNum}</span>
                                {isSubmitted && (
                                  <span className="text-[8px] leading-none opacity-90">
                                    {pct}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Tabel Rangkuman Dampak Evaluasi & Payroll */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Award className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-slate-800 text-sm">
                  Rekapitulasi Evaluasi & Integrasi Payroll (Bulan {selectedMonth})
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Divisi & Stasiun</th>
                      <th className="py-3 px-4">Leader Bertanggung Jawab</th>
                      <th className="py-3 px-4 text-center">Hari Terisi</th>
                      <th className="py-3 px-4 text-center">Tingkat Disiplin</th>
                      <th className="py-3 px-4 text-center">Rata-rata Skor</th>
                      <th className="py-3 px-4 text-center">Skor Efektif</th>
                      <th className="py-3 px-4 text-center">Grade Jobdesk</th>
                      <th className="py-3 px-4 text-center">Pencairan Tunjangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyDivisionStats.map((div) => (
                      <tr key={div.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">{div.label}</td>
                        <td className="py-3 px-4 text-slate-600">{div.leaderName}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                          {div.submittedDaysCount} / {div.elapsedDaysCount} hari
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">
                          {div.submissionRate}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-amber-600 font-bold">
                          {div.avgScoreOnSubmittedDays}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-sm">
                          {div.monthlyEffectiveScore}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                            div.monthlyEffectiveScore >= 90
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : div.monthlyEffectiveScore >= 80
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : div.monthlyEffectiveScore >= 70
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-rose-50 text-rose-700 border-rose-300"
                          }`}>
                            {div.matchedGrade.grade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">
                          Cair {div.matchedGrade.payoutPercentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Otomatis Terkoneksi ke Modul Payroll:</strong> Persentase pencairan tunjangan di atas langsung digunakan saat Anda meng-generate penggajian bulanan di menu <strong>HR &amp; Payroll</strong>. Tidak perlu lagi menghitung manual satu per satu!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PENGATURAN KATEGORI, RINCIAN TUGAS & TARGET BONUS JOBDESK */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-6 overflow-hidden min-w-0 max-w-full">
            {/* Sub-Navigasi Pengaturan Manager: SOP Tugas vs Aturan Tunjangan Jabatan */}
            <div className="flex bg-slate-100 p-1 sm:p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto self-start overflow-x-auto no-scrollbar flex-nowrap gap-1">
              <button
                type="button"
                onClick={() => setSettingsSubTab("TASKS")}
                className={`whitespace-nowrap shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  settingsSubTab === "TASKS"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardList className="w-4 h-4 text-amber-600 shrink-0" />
                <span>📋 Master SOP & Tugas Jobdesk</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab("ALLOWANCE_RULES")}
                className={`whitespace-nowrap shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  settingsSubTab === "ALLOWANCE_RULES"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>🎯 Batas Persenan Tunjangan Jabatan ({allowanceRules.length})</span>
              </button>
            </div>

            {settingsSubTab === "ALLOWANCE_RULES" ? (
              <div className="space-y-6 min-w-0">
                {/* Penjelasan Sistem Batas Persenan */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 p-4 sm:p-5 rounded-2xl">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-emerald-950">
                        Penetapan Batas Persenan Tunjangan Jabatan Leader (Berdasarkan Capaian Jobdesk)
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        Leader (Head Bar, Head Kitchen, Head Baker, Supervisor) memegang tanggung jawab supervisi operasional dan kontrol kualitas (QC). Tunjangan Jabatan di kontrak kerja Leader akan dicairkan di modul <strong>Payroll (Penggajian)</strong> secara bertingkat berdasarkan persentase kepatuhan checklist harian yang mereka selesaikan selama bulan berjalan.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-900">
                        <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-300">
                          Contoh Tunjangan di Kontrak: Rp 500.000
                        </span>
                        <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-300">
                          Grade A (90–100%) ➔ Cair 100% (Rp 500.000)
                        </span>
                        <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-300">
                          Grade B (80–89%) ➔ Cair 80% (Rp 400.000)
                        </span>
                        <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-300">
                          Grade C (70–79%) ➔ Cair 50% (Rp 250.000)
                        </span>
                        <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-300">
                          Grade D (&lt;70%) ➔ 0% (Hangus)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toolbar Aksi Aturan */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Daftar Grade & Batas Persenan Pencairan</h4>
                    <p className="text-xs text-slate-500">
                      Ubah batas skor minimal, maksimal, serta persentase tunjangan yang dicairkan.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={handleResetRulesToDefault}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Kembalikan ke standar sistem (Grade A/B/C/D)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Standar (A/B/C/D)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAddRule}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Grade Baru</span>
                    </button>
                  </div>
                </div>

                {/* Dual-View Tabel & Kartu Aturan */}
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Grade / Tingkat</th>
                        <th className="py-3 px-4 text-center">Skor Min (%)</th>
                        <th className="py-3 px-4 text-center">Skor Max (%)</th>
                        <th className="py-3 px-4 text-center">Tunjangan Cair (%)</th>
                        <th className="py-3 px-4">Keterangan</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allowanceRules.map((rule) => {
                        const isGradeA = rule.minScore >= 90;
                        const isGradeB = rule.minScore >= 80 && rule.minScore < 90;
                        const isGradeC = rule.minScore >= 70 && rule.minScore < 80;

                        return (
                          <tr key={rule.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className={`font-black px-2.5 py-1 rounded-lg text-xs ${
                                isGradeA
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isGradeB
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : isGradeC
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}>
                                {rule.grade}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {rule.minScore}%
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {rule.maxScore}%
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-black text-emerald-700 text-sm">
                              {rule.payoutPercentage}%
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {rule.label}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleRuleStatus(rule.id)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                                  rule.isActive !== false
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                                }`}
                              >
                                {rule.isActive !== false ? "✓ Aktif" : "✕ Nonaktif"}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRule(rule)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit aturan ini"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus aturan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Feed */}
                <div className="block md:hidden space-y-3">
                  {allowanceRules.map((rule) => {
                    const isGradeA = rule.minScore >= 90;
                    const isGradeB = rule.minScore >= 80 && rule.minScore < 90;
                    const isGradeC = rule.minScore >= 70 && rule.minScore < 80;

                    return (
                      <div
                        key={rule.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-black px-2.5 py-1 rounded-lg text-xs ${
                              isGradeA
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : isGradeB
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : isGradeC
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-rose-100 text-rose-800 border border-rose-300"
                            }`}
                          >
                            {rule.grade}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleRuleStatus(rule.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                                rule.isActive !== false
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                              }`}
                            >
                              {rule.isActive !== false ? "✓ Aktif" : "✕ Nonaktif"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditRule(rule)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit aturan ini"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus aturan ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Rentang Skor</span>
                            <span className="font-mono font-bold text-slate-800">
                              {rule.minScore}% – {rule.maxScore}%
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                            <span className="text-[10px] text-emerald-700 font-bold block uppercase">Tunjangan Cair</span>
                            <span className="font-mono font-black text-emerald-700 text-sm">
                              {rule.payoutPercentage}%
                            </span>
                          </div>
                        </div>

                        {rule.label && (
                          <div className="text-[11px] text-slate-600 font-medium bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-slate-400 font-semibold mr-1">Keterangan:</span>
                            {rule.label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      Kelola SOP & Master Jobdesk Supervisi Leader
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Atur tugas dan sub-tugas pengawasan stasiun kerja, standar sanitasi, kalibrasi alat, dan kontrol kualitas (QC) per divisi.
                    </p>
                  </div>

                  {/* Pilihan Divisi */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar flex-nowrap max-w-full gap-1">
                <button
                  onClick={() => setEditingDivision("BAR")}
                  className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    editingDivision === "BAR"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Bar & Kasir ({barCategories.length})
                </button>
                <button
                  onClick={() => setEditingDivision("KITCHEN")}
                  className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    editingDivision === "KITCHEN"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Kitchen ({kitchenCategories.length})
                </button>
                <button
                  onClick={() => setEditingDivision("BAKER")}
                  className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    editingDivision === "BAKER"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head Baker ({bakerCategories.length})
                </button>
              </div>
            </div>

            {/* Header Pengawasan Jobdesk Leader */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    Master Jobdesk & SOP Leader ({editingDivision === "BAR" ? "Head Bar & Kasir" : editingDivision === "KITCHEN" ? "Head Kitchen" : "Head Baker"})
                  </h4>
                  <p className="text-xs text-amber-800">
                    Tugas dan sub-tugas supervisi, inspeksi stasiun kerja, dan kontrol kualitas (QC) agar Leader mengawasi operasional divisinya secara maksimal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 shadow-2xs">
                👑 Total {statsEditingDivision.totalCount} Tugas Supervisi Leader
              </div>
            </div>

            {/* List Kategori Groups */}
            <div className="space-y-6">
              {currentEditingCategories.map((cat, catIdx) => {
                // Saring item: sembunyikan tugas staf agar fokus penuh ke tugas supervisi Leader
                const visibleItemsWithIndex = cat.items
                  .map((item, originalIdx) => ({
                    item,
                    originalIdx,
                    detail: normalizeTaskItem(item),
                  }))
                  .filter(({ detail }) => {
                    if (detail.targetRole === "STAFF") return false;
                    return true;
                  });

                return (
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
                        className="flex-1 font-bold text-slate-800 bg-white px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div className="space-y-2.5 pl-0 sm:pl-9">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold text-slate-500">
                          Rincian Sub-Tugas Checklist Supervisi & Jadwal Shift:
                        </p>
                        <span className="text-[11px] text-slate-400">
                          Menampilkan {visibleItemsWithIndex.length} tugas pengawasan
                        </span>
                      </div>

                      {visibleItemsWithIndex.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center bg-white/60 text-xs text-slate-500">
                          Belum ada tugas supervisi di kategori ini. Klik tombol tambah di bawah untuk membuat tugas pengawasan baru.
                        </div>
                      ) : (
                        visibleItemsWithIndex.map(({ originalIdx, detail }, displayIdx) => {
                          return (
                            <div 
                              key={originalIdx} 
                              className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border transition-all ${
                                !detail.isActive
                                  ? "bg-slate-100 border-slate-200/80 opacity-60"
                                  : "bg-amber-50/50 border-amber-200 shadow-2xs"
                              }`}
                            >
                              <span className="text-xs text-slate-400 font-bold w-5 text-right hidden sm:block">
                                {displayIdx + 1}.
                              </span>

                              <input
                                type="text"
                                value={detail.text}
                                onChange={(e) => handleUpdateSubTaskText(catIdx, originalIdx, e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-transparent border-0 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-lg"
                                placeholder="Rincian sub-tugas supervisi yang perlu diawasi Leader..."
                              />

                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                {/* Pilihan Shift Tag */}
                                <select
                                  value={detail.shift || "ALL"}
                                  onChange={(e) => handleUpdateSubTaskShift(catIdx, originalIdx, e.target.value as any)}
                                  className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                                    detail.shift === "PAGI"
                                      ? "bg-amber-50 border-amber-300 text-amber-900"
                                      : detail.shift === "MIDDLE"
                                      ? "bg-orange-50 border-orange-300 text-orange-900"
                                      : detail.shift === "SORE"
                                      ? "bg-purple-50 border-purple-300 text-purple-900"
                                      : "bg-blue-50 border-blue-300 text-blue-900"
                                  }`}
                                  title="Tentukan jadwal shift untuk sub-tugas ini"
                                >
                                  <option value="ALL">🌐 Semua Shift</option>
                                  <option value="PAGI">☀️ Pagi (Opening)</option>
                                  <option value="MIDDLE">⛅ Middle</option>
                                  <option value="SORE">🌙 Sore (Closing)</option>
                                </select>

                                {/* Badge Peran Khusus Leader */}
                                <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border bg-amber-100 border-amber-300 text-amber-950 shrink-0 flex items-center gap-1">
                                  👑 Leader QC
                                </span>

                                {/* Tombol Toggle Aktif / Nonaktif */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubTaskActive(catIdx, originalIdx)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors border ${
                                    detail.isActive
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-slate-200 border-slate-300 text-slate-500 hover:bg-slate-300"
                                  }`}
                                  title={detail.isActive ? "Klik untuk Nonaktifkan Tugas" : "Klik untuk Aktifkan Tugas"}
                                >
                                  <span className={`w-2 h-2 rounded-full ${detail.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                                  {detail.isActive ? "Aktif" : "Nonaktif"}
                                </button>

                                {/* Hapus Sub-tugas */}
                                <button
                                  onClick={() => handleRemoveSubTask(catIdx, originalIdx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Hapus sub-tugas"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Tombol Tambah Sub-Tugas Supervisi Leader */}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleAddSubTask(catIdx, "LEADER")}
                          className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Tambah Sub-Tugas Supervisi / QC (Leader)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  Simpan Master Jobdesk Leader
                </button>
              </div>
            </div>
            </>
          )}

          {/* Modal Tambah / Edit Aturan Tunjangan */}
          {isRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-black/50 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
              <div className="my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[85vh] sm:max-h-[88vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-base">
                      {editingRule ? "Edit Aturan Grade Tunjangan" : "Tambah Grade Tunjangan Baru"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsRuleModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nama Grade / Tingkat:
                    </label>
                    <input
                      type="text"
                      value={ruleForm.grade}
                      onChange={(e) => setRuleForm({ ...ruleForm, grade: e.target.value })}
                      placeholder="Contoh: Grade A, Grade B..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Skor Minimal (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ruleForm.minScore}
                        onChange={(e) => setRuleForm({ ...ruleForm, minScore: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Skor Maksimal (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ruleForm.maxScore}
                        onChange={(e) => setRuleForm({ ...ruleForm, maxScore: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Persentase Tunjangan Jabatan Cair (%):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ruleForm.payoutPercentage}
                        onChange={(e) => setRuleForm({ ...ruleForm, payoutPercentage: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Tunjangan Jabatan di kontrak kerja Leader akan dikalikan persentase ini saat payroll digenerate.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Label / Keterangan:
                    </label>
                    <input
                      type="text"
                      value={ruleForm.label}
                      onChange={(e) => setRuleForm({ ...ruleForm, label: e.target.value })}
                      placeholder="Contoh: Sangat Baik (Cair Penuh 100%)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRuleForm}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                  >
                    Simpan Aturan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. RENDER UNTUK LEADER (HEAD BAR, KASIR, KITCHEN, BAKER)
  // ─────────────────────────────────────────────────────────────────────────
  if (!isSupervisor && !isLeaderRole) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Checklist Jobdesk Khusus Leader</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Fitur checklist harian saat ini dikhususkan sebagai instrumen supervisi, kontrol kualitas (QC), dan penentuan tunjangan jabatan Leader.
        </p>
        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
          Staf operasional berfokus penuh pada pelayanan pelanggan dan kelancaran operasional station.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Pengisian Tugas Harian & Status Shift */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              👑 Leader Divisi (Supervisor & QC)
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
              userScheduledShift === "PAGI"
                ? "bg-amber-500 text-white"
                : userScheduledShift === "MIDDLE"
                ? "bg-orange-500 text-white"
                : userScheduledShift === "SORE"
                ? "bg-purple-600 text-white"
                : "bg-slate-500 text-white"
            }`}>
              {userScheduledShift === "PAGI" && <Sun className="w-3.5 h-3.5" />}
              {userScheduledShift === "MIDDLE" && <Sunset className="w-3.5 h-3.5" />}
              {userScheduledShift === "SORE" && <Moon className="w-3.5 h-3.5" />}
              Jadwal Hari Ini: {userScheduledShift === "OFF" ? "LIBUR (OFF)" : `Shift ${userScheduledShift}`}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-2">
            Checklist Supervisi & QC Divisi {leaderActiveDivision === "BAR" ? "Bar & Kasir" : leaderActiveDivision === "KITCHEN" ? "Kitchen" : "Baker"}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Kelola tugas supervisi mandiri, kontrol kalibrasi & standar kualitas station harian Anda.
          </p>
        </div>

        {/* Filter Tab: Shift Saya vs Semua Shift */}
        <div className="flex flex-col sm:flex-row items-end gap-2 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setShiftFilter("MY_SHIFT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                shiftFilter === "MY_SHIFT"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              Tugas Shift Saya ({userScheduledShift})
            </button>
            <button
              onClick={() => setShiftFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                shiftFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Shift
            </button>
          </div>
        </div>
      </div>

      {/* Banner Khusus jika Hari Ini Libur (OFF) */}
      {userScheduledShift === "OFF" && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center gap-3">
          <span className="text-2xl">🏖️</span>
          <div className="text-xs text-indigo-900">
            <p className="font-bold">Hari Ini Anda Dijadwalkan Libur (OFF)</p>
            <p className="text-indigo-700 mt-0.5">
              Anda tidak dibebani kewajiban checklist tugas shift hari ini, sehingga persentase KPI dan bonus Anda tetap aman terlindungi.
            </p>
          </div>
        </div>
      )}

      {/* Kartu Rangkuman Akumulasi 1 Bulan untuk Leader */}
      {leaderPersonalMonthly && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500 text-white shadow-2xs">
                <Award className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-bold text-slate-800">
                Akumulasi Jobdesk Anda Bulan Ini ({new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })})
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Disiplin pengisian checklist harian Anda langsung menentukan pencairan Tunjangan Jabatan di slip gaji bulanan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-white px-3 py-2 rounded-xl border border-amber-200 text-center shadow-2xs">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Hari Terisi</p>
              <p className="text-sm font-black text-slate-800 font-mono">
                {leaderPersonalMonthly.submittedDaysCount} / {leaderPersonalMonthly.elapsedDaysCount} hari
              </p>
            </div>
            <div className="bg-white px-3 py-2 rounded-xl border border-amber-200 text-center shadow-2xs">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Rata-rata Skor</p>
              <p className="text-sm font-black text-amber-600 font-mono">
                {leaderPersonalMonthly.avgScoreOnSubmittedDays}%
              </p>
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl border border-amber-300 text-center shadow-2xs">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Proyeksi Grade</p>
              <p className="text-sm font-black text-emerald-700">
                {leaderPersonalMonthly.matchedGrade.grade} ({leaderPersonalMonthly.matchedGrade.payoutPercentage}%)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Kartu Checklist Utama */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {shiftFilter === "MY_SHIFT" 
                ? `Tugas Khusus Shift ${userScheduledShift}`
                : "Seluruh SOP Operasional Divisi"}
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  Supervisi Leader & QC
                </span>
            </h3>
            <span className="text-xs text-slate-500">
              {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-2xl font-black text-slate-800 font-mono">{leaderPercentage}%</span>
              <p className="text-xs font-semibold text-slate-500">
                {completedSubTasksLeader} dari {totalSubTasksLeader} Tugas Selesai
              </p>
            </div>
            {isLeaderRole && (
              <div className="text-right pl-4 border-l border-slate-200 hidden sm:block">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-sm font-black text-amber-600 font-mono">
                    {matchedTodayTier ? matchedTodayTier.grade : "Grade A"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    ({matchedTodayTier ? matchedTodayTier.payoutPercentage : 100}% Tunjangan)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Capaian Tunjangan Jabatan
                </p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    (matchedTodayTier?.payoutPercentage ?? 100) === 100 
                      ? "text-emerald-700 bg-emerald-50 border-emerald-300" 
                      : (matchedTodayTier?.payoutPercentage ?? 0) > 0
                      ? "text-amber-700 bg-amber-50 border-amber-300"
                      : "text-rose-700 bg-rose-50 border-rose-300"
                  }`}>
                    {matchedTodayTier?.label || "100% Cair Penuh"}
                  </span>
                </div>
              </div>
            )}
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
          {displayCategories.map((cat, catIdx) => {
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
                    const itemDetail = normalizeTaskItem(item);
                    const isChecked = isTaskChecked(leaderCompletedTasks, cat.category, item);
                    const isShiftLocked = (userScheduledShift as string) !== "ALL" && 
                                          itemDetail.shift !== "ALL" && 
                                          itemDetail.shift !== userScheduledShift;

                    return (
                      <div
                        key={itemIdx}
                        onClick={() => {
                          if (isShiftLocked) {
                            alert(`🔒 Tugas ini khusus untuk Shift ${itemDetail.shift}. Anda dijadwalkan pada Shift ${userScheduledShift}, sehingga tugas ini terkunci.`);
                            return;
                          }
                          toggleLeaderTask(cat.category, item);
                        }}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all select-none ${
                          isShiftLocked
                            ? "bg-slate-100/70 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                            : isChecked
                            ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs cursor-pointer"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="mt-0.5 shrink-0">
                            {isShiftLocked ? (
                              <Lock className="w-5 h-5 text-slate-400" />
                            ) : isChecked ? (
                              <CheckSquare className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-xs sm:text-sm font-semibold ${
                              isShiftLocked
                                ? "text-slate-500"
                                : isChecked
                                ? "text-emerald-900 line-through opacity-80"
                                : "text-slate-800"
                            }`}>
                              {itemDetail.text}
                            </p>
                            {isShiftLocked && (
                              <p className="text-[10px] text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                                🔒 Terkunci: Khusus diselesaikan pada Shift {itemDetail.shift}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Role Badge on Item */}
                          {itemDetail.targetRole === "LEADER" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              👑 Leader QC
                            </span>
                          )}
                          {itemDetail.targetRole === "STAFF" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                              🧑‍🍳 Staf
                            </span>
                          )}
                          {(!itemDetail.targetRole || itemDetail.targetRole === "ALL") && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              👥 Umum
                            </span>
                          )}

                          {/* Shift Badge on Item */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                            isShiftLocked
                              ? "bg-slate-200 text-slate-600 border border-slate-300"
                              : itemDetail.shift === "PAGI"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : itemDetail.shift === "MIDDLE"
                              ? "bg-orange-100 text-orange-800 border border-orange-200"
                              : itemDetail.shift === "SORE"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {isShiftLocked && <Lock className="w-2.5 h-2.5 text-slate-500" />}
                            {itemDetail.shift === "PAGI" && "☀️ Opening"}
                            {itemDetail.shift === "MIDDLE" && "⛅ Middle"}
                            {itemDetail.shift === "SORE" && "🌙 Closing"}
                            {(!itemDetail.shift || itemDetail.shift === "ALL") && "🌐 Semua Shift"}
                          </span>
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
            Catatan Harian / Laporan Kendala Shift (Opsional untuk Manager):
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
              Simpan Checklist Shift Hari Ini
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

      {/* Info Edukasi KPI & Bonus */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900">
          <p className="font-bold mb-0.5">Transparansi Penilaian KPI & Bonus</p>
          <p>
            Checklist tugas yang Anda selesaikan sesuai shift otomatis dihitung ke dalam capaian KPI bulanan Anda. Semakin tinggi persentase penyelesaian tugas shift, semakin besar bonus yang Anda bawa pulang saat penggajian!
          </p>
        </div>
      </div>
    </div>
  );
};
