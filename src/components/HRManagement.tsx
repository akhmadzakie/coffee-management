import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ConfirmModal, useConfirm } from "./common/ConfirmModal";
import { formatCurrency } from "../utils/format";
import { Role, DEFAULT_LEADER_ALLOWANCE_RULES, DEFAULT_SHIFT_DEFINITIONS, ShiftDefinition } from "../types";
import { DEFAULT_STORE_TIMEZONE, getLocalDateString, getLocalPeriodString } from "../utils/dateUtils";
import {
  buildAttendanceCorrectionUpdate,
  calculateWorkDurationHours,
  classifyDailyAttendanceStatus,
  computeMonthlyAttendanceRecap,
  formatWitaTimeHm,
  resolveCanonicalEmployeeId,
} from "../utils/attendanceRecap";
import { addDaysToLocalDate, validatePayrollMutation } from "../utils/syncSanitizers";
import { findUnlinkedStaffUsers, buildEmployeeDraftFromUser } from "../utils/dataCleaning";
import { KPI } from "./KPI";
import { Payroll } from "./Payroll";
import { RupiahSign } from "./common/RupiahSign";
import { CustomSelect } from "./common/CustomSelect";
import {
  Users,
  FileText,
  Target,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  UserCheck,
  UserPlus,
  X,
  MapPin,
  Camera,
  ExternalLink,
  Eye,
  ShieldCheck,
  Clock,
  CheckCircle2,
  CheckCheck,
  CheckSquare,
  Square,
  RotateCcw,
  Filter,
  Copy,
  Info,
  Send,
  Search,
  AlertTriangle,
  UserX,
  Settings as SettingsIcon,
  Megaphone,
  Edit3,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CustomMonthPicker } from "./common/CustomMonthPicker";
import { CustomDatePicker } from "./common/CustomDatePicker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Employee,
  EmployeeContract,
  AttendanceRecord,
  KPIRecord,
  EmploymentType,
  EmployeeStatus,
} from "../types";
import { CsvImportExport } from "./common/CsvImportExport";
import { normalizeTextCode, parseFlexibleDateYmd, parseLocalizedNumber } from "../utils/genericImport";

export function HRManagement() {
  const {
    currentUser,
    users,
    settings,
    updateSettings,
    isReadOnly,
    employees,
    contracts,
    attendances,
    dailyAttendances,
    setDailyAttendances,
    employeeShifts,
    setEmployeeShifts,
    updateDailyAttendance,
    dailyChecklists,
    setDailyChecklists,
    kpiBonusRules,
    closedPeriods,
    payrollRecords,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addContract,
    updateContract,
    deleteContract,
    addAttendance,
    updateAttendance,
    addUser,
    updateUser,
    deleteUser,
  } = useStore();
  const confirmModal = useConfirm();

  const isIndo = settings.language === "id";
  const isLeader = currentUser?.role === "LEADER";
  const leaderEmp = employees.find(
    (e) =>
      (currentUser?.employeeId && e.id === currentUser.employeeId) ||
      e.username?.toLowerCase() === currentUser?.username?.toLowerCase()
  );

  const isHRD =
    currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "OWNER";
  const isFinance =
    currentUser?.role === "FINANCE" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "OWNER";
  const canEditHR = isHRD && !isReadOnly;

  // Klasifikasi staf: hanya staf operasional (Bar, Kasir, Kitchen, Baker) yang masuk jadwal shift mingguan
  const isOperationalStaff = (emp?: { department?: string | null; position?: string | null } | null): boolean => {
    if (!emp) return false;
    const dept = (emp.department || "").toUpperCase();
    const pos = (emp.position || "").toUpperCase();

    // Posisi atau departemen eksekutif, manajerial & back-office bukan pekerja shift
    if (
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
    ) {
      return false;
    }
    return true;
  };

  // Aturan pembagian divisi standar:
  // - KITCHEN: Kitchen, Dapur, Cook
  // - BAKER: Baker, Pastry, Roti
  // - BAR: Barista, Kasir, Beverage, Main (Kasir digabung ke Divisi Bar)
  // - OFFICE: Manager, Finance, Accounting, Admin, HRD (Non-shift / jam reguler)
  const getEmployeeDivision = (emp?: { department?: string | null; position?: string | null } | null): "BAR" | "KITCHEN" | "BAKER" | "OFFICE" => {
    if (!emp) return "OFFICE";
    const dept = (emp.department || "").toUpperCase();
    const pos = (emp.position || "").toUpperCase();

    if (!isOperationalStaff(emp)) {
      return "OFFICE";
    }

    if (dept.includes("KITCHEN") || pos.includes("KITCHEN") || pos.includes("DAPUR") || pos.includes("COOK")) {
      return "KITCHEN";
    }
    if (dept.includes("BAKER") || pos.includes("BAKER") || pos.includes("PASTRY") || pos.includes("ROTI")) {
      return "BAKER";
    }
    // Kasir dan seluruh operasional bar masuk ke BAR
    return "BAR";
  };

  const leaderDivision = useMemo<"BAR" | "KITCHEN" | "BAKER">(() => {
    if (currentUser?.department) {
      const d = currentUser.department.toUpperCase();
      if (d.includes("KITCHEN") || d.includes("DAPUR") || d.includes("COOK")) return "KITCHEN";
      if (d.includes("BAKER") || d.includes("PASTRY") || d.includes("ROTI")) return "BAKER";
      if (d.includes("BAR") || d.includes("KASIR") || d.includes("BEVERAGE")) return "BAR";
    }
    if (leaderEmp) {
      const div = getEmployeeDivision(leaderEmp);
      if (div !== "OFFICE") return div;
    }
    const nameOrUser = `${currentUser?.name || ""} ${currentUser?.username || ""}`.toUpperCase();
    if (nameOrUser.includes("KITCHEN") || nameOrUser.includes("DAPUR") || nameOrUser.includes("COOK")) return "KITCHEN";
    if (nameOrUser.includes("BAKER") || nameOrUser.includes("PASTRY") || nameOrUser.includes("ROTI")) return "BAKER";
    return "BAR";
  }, [currentUser, leaderEmp]);

  const [scheduleDivisionFilter, setScheduleDivisionFilter] = useState<string>("ALL");

  useEffect(() => {
    if (isLeader && leaderDivision) {
      setScheduleDivisionFilter(leaderDivision);
    }
  }, [isLeader, leaderDivision]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "employees" | "contracts" | "schedule" | "attendance" | "kpi" | "payroll"
  >(() => {
    const target = sessionStorage.getItem("hr_target_tab");
    if (target) {
      sessionStorage.removeItem("hr_target_tab");
      return target as any;
    }
    return currentUser?.role === "LEADER" ? "schedule" : "overview";
  });

  // --- Modals State ---
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [empModalTab, setEmpModalTab] = useState<"basic" | "contact">("basic");
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any | null>(null);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [briefNotesInput, setBriefNotesInput] = useState("");

  // --- Modal Form State ---
  const [empForm, setEmpForm] = useState({ username: "", name: "", position: "", department: "", status: "AKTIF" as any, employmentType: "TETAP" as any, phone: "", email: "", address: "" });
  const [autoCreateUser, setAutoCreateUser] = useState(true);
  const [contractForm, setContractForm] = useState({ employeeId: "", basicSalary: 0, positionAllowance: 0, mealAllowance: 0, transportAllowance: 0, alphaDeductionPerDay: 0, kpiBonusTarget: 0,  startDate: "", endDate: "", status: "ACTIVE" as any });

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verifyingAttendance, setVerifyingAttendance] = useState<any | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const handleDownloadPhoto = (dataUrl: string, filename: string) => {
    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Gagal mendownload foto:", e);
    }
  };
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [attendanceRecapPeriod, setAttendanceRecapPeriod] = useState<string>(() => getLocalPeriodString());
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>("");
  const [attendanceEmpFilter, setAttendanceEmpFilter] = useState<string>("ALL");
  const [attendanceApprovalFilter, setAttendanceApprovalFilter] = useState<string>("ALL");
  const [selectedAttIds, setSelectedAttIds] = useState<string[]>([]);

  // Attendance Correction by Manager State (Aturan #3 & Audit Log)
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctingAttendance, setCorrectingAttendance] = useState<any | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    status: "HADIR" as "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "ALPHA",
    clockInTime: "07:00",
    clockOutTime: "15:00",
    overtimeApproved: false,
    reason: "",
  });

  // --- Employee & Contract Search / Filter State ---
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("ALL");
  const [empStatusFilter, setEmpStatusFilter] = useState("ALL");

  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("ALL");

  // --- Shift Configuration State & Handlers ---
  const [showShiftConfigModal, setShowShiftConfigModal] = useState(false);
  const [shiftDefsForm, setShiftDefsForm] = useState<ShiftDefinition[]>(() => {
    return settings?.shiftDefinitions && settings.shiftDefinitions.length > 0
      ? settings.shiftDefinitions
      : DEFAULT_SHIFT_DEFINITIONS;
  });

  useEffect(() => {
    // Jangan overwrite draft saat modal konfigurasi sedang dibuka oleh user
    if (showShiftConfigModal) return;
    if (settings?.shiftDefinitions && settings.shiftDefinitions.length > 0) {
      setShiftDefsForm(settings.shiftDefinitions);
    }
  }, [settings?.shiftDefinitions, showShiftConfigModal]);

  const activeShiftDefs = useMemo(() => {
    const list = settings?.shiftDefinitions && settings.shiftDefinitions.length > 0
      ? settings.shiftDefinitions
      : DEFAULT_SHIFT_DEFINITIONS;
    return list.filter((s) => s.isActive !== false);
  }, [settings?.shiftDefinitions]);

  const updateShiftField = (index: number, field: keyof ShiftDefinition, value: any) => {
    const updated = [...shiftDefsForm];
    updated[index] = { ...updated[index], [field]: value };
    setShiftDefsForm(updated);
  };

  const computeShiftDurationHours = (startTime: string, endTime: string): number => {
    const parseHm = (hm: string) => {
      const [h, m] = (hm || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
      return h * 60 + m;
    };
    const startMin = parseHm(startTime);
    let endMin = parseHm(endTime);
    if (endMin <= startMin) endMin += 24 * 60;
    return Math.round(((endMin - startMin) / 60) * 10) / 10;
  };

  const handleSaveShiftDefinitions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditHR) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengubah master shift.");
      return;
    }
    if (shiftDefsForm.length === 0) {
      toast.error("Minimal harus tersedia satu shift operasional.");
      return;
    }
    const normalizedDefs = shiftDefsForm.map((s) => ({
      ...s,
      name: s.name.trim() || s.id,
      workHours: computeShiftDurationHours(s.startTime, s.endTime),
      lateToleranceMinutes: Math.max(0, Math.round(Number(s.lateToleranceMinutes) || 0)),
    }));
    updateSettings({
      ...settings,
      shiftDefinitions: normalizedDefs,
    });
    setShiftDefsForm(normalizedDefs);
    setShowShiftConfigModal(false);
    toast.success("Pengaturan master shift dan jam operasional berhasil disimpan.");
  };

  const handleAddCustomShift = () => {
    if (!canEditHR) return;
    const count = shiftDefsForm.length + 1;
    const newId = `SHIFT_${Date.now()}`;
    const newShift: ShiftDefinition = {
      id: newId,
      name: `Shift Khusus ${count}`,
      startTime: "09:00",
      endTime: "17:00",
      workHours: 8,
      lateToleranceMinutes: 15,
      color: "purple",
      isActive: true,
    };
    setShiftDefsForm([...shiftDefsForm, newShift]);
  };

  const handleRemoveCustomShift = (id: string) => {
    if (!canEditHR) return;
    confirmModal.open({
      title: "Hapus Konfigurasi Shift",
      message: "Hapus shift ini dari daftar konfigurasi operasional?",
      variant: "danger",
      confirmLabel: "Ya, Hapus Shift",
      onConfirm: () => {
        setShiftDefsForm((prev) => prev.filter((s) => s.id !== id));
      },
    });
  };

  const handleResetShiftDefinitions = () => {
    if (!canEditHR) return;
    confirmModal.open({
      title: "Reset Master Shift",
      message: "Reset seluruh master shift ke default bawaan sistem (Pagi, Middle, Sore)?",
      variant: "warning",
      confirmLabel: "Ya, Reset Default",
      onConfirm: () => {
        setShiftDefsForm(DEFAULT_SHIFT_DEFINITIONS);
        toast.info("Daftar shift dikembalikan ke pengaturan default. Klik Simpan untuk menerapkan.");
      },
    });
  };

  const getClosedAttendanceError = (dateList: string[]): string | null => {
    for (const d of dateList) {
      const p = (d || "").substring(0, 7);
      if (!p) continue;
      const check = validatePayrollMutation({
        action: "UPDATE",
        recordPeriod: p,
        closedPeriods: closedPeriods || [],
      });
      if ("error" in check) {
        return `Absensi periode ${p} sudah tutup buku dan tidak dapat dimodifikasi.`;
      }
    }
    return null;
  };

  const handleBulkApprove = (targetIds?: string[]) => {
    if (!canEditHR) {
      toast.error("Akses ditolak: hanya Manager atau Super Admin yang dapat mengesahkan absensi.");
      return;
    }
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedAttIds;
    if (!ids || ids.length === 0) {
      toast.warning("Pilih minimal satu absensi untuk disetujui.");
      return;
    }
    const idSet = new Set(ids);
    const affectedDates = dailyAttendances.filter((a) => idSet.has(a.id)).map((a) => a.date);
    const closedErr = getClosedAttendanceError(affectedDates);
    if (closedErr) {
      toast.error(closedErr);
      return;
    }
    confirmModal.open({
      title: "Sahkan Absensi Terpilih",
      message: `Sahkan / Setujui ${ids.length} catatan kehadiran yang dipilih?`,
      variant: "info",
      confirmLabel: `Sahkan (${ids.length})`,
      onConfirm: () => {
        const updated = dailyAttendances.map((a) =>
          idSet.has(a.id) ? { ...a, approvalStatus: "APPROVED" as const } : a
        );
        setDailyAttendances(updated);
        setSelectedAttIds([]);
        toast.success(`Berhasil menyetujui ${ids.length} catatan kehadiran!`);
      },
    });
  };

  const handleApproveAllPending = (pendingList: any[]) => {
    if (!canEditHR) {
      toast.error("Akses ditolak: hanya Manager atau Super Admin yang dapat mengesahkan absensi.");
      return;
    }
    if (!pendingList || pendingList.length === 0) {
      toast.info("Tidak ada absensi yang menunggu persetujuan.");
      return;
    }
    const closedErr = getClosedAttendanceError(pendingList.map((a) => a.date));
    if (closedErr) {
      toast.error(closedErr);
      return;
    }
    confirmModal.open({
      title: "Sahkan Semua Absensi Pending",
      message: `Sahkan / Setujui SEKALIGUS seluruh ${pendingList.length} absensi yang berstatus 'Menunggu Verifikasi'?`,
      variant: "info",
      confirmLabel: `Setujui Semua (${pendingList.length})`,
      onConfirm: () => {
        const pendingIds = new Set(pendingList.map((a) => a.id));
        const updated = dailyAttendances.map((a) =>
          pendingIds.has(a.id) ? { ...a, approvalStatus: "APPROVED" as const } : a
        );
        setDailyAttendances(updated);
        setSelectedAttIds([]);
        toast.success(`Berhasil menyetujui seluruh ${pendingList.length} catatan kehadiran secara massal!`);
      },
    });
  };

  // Manager Attendance Correction Handler (Aturan #3 & Audit Log)
  const handleOpenCorrectionModal = (att: any) => {
    if (!canEditHR) return;
    setCorrectingAttendance(att);
    const inStr = formatWitaTimeHm(att.clockInTime, DEFAULT_STORE_TIMEZONE) || "07:00";
    const outStr = formatWitaTimeHm(att.clockOutTime, DEFAULT_STORE_TIMEZONE) || "15:00";
    setCorrectionForm({
      status: att.status || "HADIR",
      clockInTime: inStr,
      clockOutTime: outStr,
      overtimeApproved: !!att.overtimeApproved,
      reason: att.correctionReason || "",
    });
    setIsCorrectionModalOpen(true);
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditHR) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengoreksi absensi.");
      return;
    }
    if (!correctingAttendance) return;
    const closedErr = getClosedAttendanceError([correctingAttendance.date]);
    if (closedErr) {
      toast.error(closedErr);
      return;
    }
    if (!correctionForm.reason.trim()) {
      toast.warning("Alasan koreksi wajib diisi sebagai rekam jejak Audit Log.");
      return;
    }

    const managerName = currentUser?.name || currentUser?.username || "Manager";
    const updatedAtt = buildAttendanceCorrectionUpdate(
      correctingAttendance,
      correctionForm,
      managerName
    );

    updateDailyAttendance(updatedAtt);
    if (correctingAttendance.date && correctingAttendance.date.length >= 7) {
      setAttendanceRecapPeriod(correctingAttendance.date.substring(0, 7));
    }
    setIsCorrectionModalOpen(false);
    toast.success(
      `Berhasil mengoreksi dan mengesahkan absensi ${getEmployeeName(correctingAttendance.employeeId)}! Rekap absensi otomatis diperbarui.`
    );
  };

  const [attendanceForm, setAttendanceForm] = useState({ employeeId: "", period: "", presentDays: 0, sickDays: 0, permissionDays: 0, alphaDays: 0, notes: "" });

  const handleOpenAttendanceModal = (att?: any, employeeId?: string) => {
    if (att && att.id) {
      setEditingAttendance(att);
      setAttendanceForm({ ...att });
    } else {
      setEditingAttendance(null);
      const currentPeriod = attendanceRecapPeriod || getLocalPeriodString();
      setAttendanceForm({ employeeId: employeeId || "", period: currentPeriod, presentDays: 0, sickDays: 0, permissionDays: 0, alphaDays: 0, notes: "" });
    }
    setIsAttendanceModalOpen(true);
  };

  const handleSaveAttendance = () => {
    if (!canEditHR) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengubah rekap absensi.");
      return;
    }
    if (!attendanceForm.employeeId || !attendanceForm.period) {
      toast.warning("Pilih Karyawan dan Periode terlebih dahulu.");
      return;
    }
    const check = validatePayrollMutation({
      action: editingAttendance ? "UPDATE" : "CREATE",
      recordPeriod: attendanceForm.period,
      closedPeriods: closedPeriods || [],
    });
    if ("error" in check) {
      toast.error(`Periode ${attendanceForm.period} sudah tutup buku dan tidak dapat diubah.`);
      return;
    }
    const sanitizedForm = {
      ...attendanceForm,
      presentDays: Math.max(0, Math.round(Number(attendanceForm.presentDays) || 0)),
      sickDays: Math.max(0, Math.round(Number(attendanceForm.sickDays) || 0)),
      permissionDays: Math.max(0, Math.round(Number(attendanceForm.permissionDays) || 0)),
      alphaDays: Math.max(0, Math.round(Number(attendanceForm.alphaDays) || 0)),
    };
    if (editingAttendance) {
      updateAttendance({ ...editingAttendance, ...sanitizedForm });
    } else {
      addAttendance(sanitizedForm);
    }
    setAttendanceRecapPeriod(sanitizedForm.period);
    setIsAttendanceModalOpen(false);
    toast.success("Rekap absensi manual berhasil disimpan.");
  };

  const unlinkedStaffUsers = useMemo(
    () => findUnlinkedStaffUsers(users || [], employees || []),
    [users, employees]
  );

  const handleRegisterUserToHR = (targetUser: any) => {
    if (isReadOnly || !canEditHR || !targetUser) return;
    const draft = buildEmployeeDraftFromUser(targetUser, getLocalDateString());
    const dupEmp = employees.find(
      (e) => (e.username || "").toLowerCase().trim() === draft.username
    );
    if (dupEmp) {
      toast.info(`${targetUser.name} sudah terdaftar di SDM.`);
      return;
    }
    const newEmpId = addEmployee(draft);
    if (newEmpId) {
      updateUser({ ...targetUser, employeeId: newEmpId });
      toast.success(
        `${draft.name} (@${draft.username}) berhasil didaftarkan ke SDM sebagai ${draft.position}. Silakan buat kontrak gajinya.`
      );
    }
  };

  const handleRegisterAllUsersToHR = () => {
    if (isReadOnly || !canEditHR || unlinkedStaffUsers.length === 0) return;
    let addedCount = 0;
    for (const targetUser of unlinkedStaffUsers) {
      const draft = buildEmployeeDraftFromUser(targetUser, getLocalDateString());
      const alreadyExists = employees.some(
        (e) => (e.username || "").toLowerCase().trim() === draft.username
      );
      if (alreadyExists) continue;
      const newEmpId = addEmployee(draft);
      if (newEmpId) {
        updateUser({ ...targetUser, employeeId: newEmpId });
        addedCount += 1;
      }
    }
    if (addedCount > 0) {
      toast.success(
        `${addedCount} akun login (Manager/Finance/Staf) berhasil didaftarkan ke SDM & siap dibuatkan kontrak gaji.`
      );
    }
  };

  const handleOpenEmployeeModal = (emp?: any) => {
    if (emp && emp.id) {
      setEditingEmployee(emp);
      setEmpForm({ username: emp.username, name: emp.name, position: emp.position, department: emp.department, status: emp.status, employmentType: emp.employmentType, phone: emp.phone || "", email: emp.email || "", address: emp.address || "" });
    } else {
      setEditingEmployee(null);
      setEmpForm({ username: "", name: "", position: "", department: "", status: "AKTIF", employmentType: "TETAP", phone: "", email: "", address: "" });
      setAutoCreateUser(true);
    }
    setEmpModalTab("basic");
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = () => {
    if (isReadOnly || !canEditHR) return;
    if (!empForm.username.trim() || !empForm.name.trim()) {
      toast.error("Username dan Nama wajib diisi.");
      return;
    }
    
    const cleanUsername = empForm.username.toLowerCase().trim();
    const existingAccountForNewEmp = !editingEmployee
      ? users.find((u) => (u.username || "").toLowerCase().trim() === cleanUsername)
      : undefined;
    if (!editingEmployee) {
      const dupEmp = employees.find(
        (e) => (e.username || "").toLowerCase().trim() === cleanUsername
      );
      if (dupEmp) {
        toast.error(`Username "${empForm.username}" sudah digunakan oleh karyawan ${dupEmp.name}. Harap gunakan username unik.`);
        return;
      }
    } else {
      const dupEmp = employees.find(
        (e) => e.id !== editingEmployee.id && (e.username || "").toLowerCase().trim() === cleanUsername
      );
      if (dupEmp) {
        toast.error(`Username "${empForm.username}" sudah digunakan oleh karyawan ${dupEmp.name}.`);
        return;
      }
    }

    const posUpper = (empForm.position || "").toUpperCase();
    const deptUpper = (empForm.department || "").toUpperCase();

    // Mapping peran sistem yang presisi berdasarkan Jabatan & Departemen
    let calculatedRole: Role = "KASIR";
    if (posUpper.includes("MANAGER") || posUpper.includes("MANAJER")) {
      calculatedRole = "MANAGER";
    } else if (posUpper.includes("FINANCE") || posUpper.includes("KEUANGAN") || posUpper.includes("AKUNTAN") || deptUpper.includes("FINANCE") || deptUpper.includes("KEUANGAN")) {
      calculatedRole = "FINANCE";
    } else if (posUpper.includes("LEADER")) {
      calculatedRole = "LEADER";
    } else if (posUpper.includes("KASIR")) {
      calculatedRole = "KASIR";
    } else if (deptUpper.includes("BAR") || posUpper.includes("BAR")) {
      calculatedRole = "BAR";
    } else if (
      deptUpper.includes("KITCHEN") ||
      deptUpper.includes("DAPUR") ||
      posUpper.includes("KITCHEN")
    ) {
      calculatedRole = "KITCHEN";
    } else if (deptUpper.includes("BAKER") || posUpper.includes("BAKER")) {
      calculatedRole = "BAKER";
    }

    if (editingEmployee) {
      const relatedUser = users.find(
        (u) =>
          (u.employeeId && u.employeeId === editingEmployee.id) ||
          u.username.toLowerCase() === (editingEmployee.username || "").toLowerCase() ||
          u.username.toLowerCase() === cleanUsername
      );

      if (relatedUser && relatedUser.id === currentUser?.id && empForm.status !== "AKTIF") {
        toast.error("Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang login.");
        return;
      }
      if (relatedUser && (relatedUser.role === "SUPER_ADMIN" || relatedUser.role === "OWNER") && currentUser?.role !== "SUPER_ADMIN") {
        toast.error(`Hanya Super Admin yang dapat mengubah data akun ${relatedUser.role}.`);
        return;
      }

      updateEmployee({ ...editingEmployee, ...empForm, username: cleanUsername, name: empForm.name.trim() });

      if (relatedUser) {
        if (empForm.status !== "AKTIF") {
          deleteUser(relatedUser.id);
          toast.info("Data diperbarui & akun login terkait dinonaktifkan karena status karyawan menjadi " + empForm.status);
        } else {
          const isProtectedRole = relatedUser.role === "SUPER_ADMIN" || relatedUser.role === "OWNER";
          updateUser({
            ...relatedUser,
            username: cleanUsername,
            name: empForm.name.trim(),
            role: isProtectedRole ? relatedUser.role : calculatedRole,
            department: !isProtectedRole && calculatedRole === "LEADER" ? (empForm.department as any) : relatedUser.department ?? null,
            employeeId: editingEmployee.id,
          });
          toast.success(`Data karyawan "${empForm.name.trim()}" berhasil diperbarui.`);
        }
      } else {
        toast.success(`Data karyawan "${empForm.name.trim()}" berhasil diperbarui.`);
      }
    } else {
      const newEmpId = addEmployee({ ...empForm, username: cleanUsername, name: empForm.name.trim() });
      if (existingAccountForNewEmp && newEmpId) {
        updateUser({
          ...existingAccountForNewEmp,
          employeeId: newEmpId,
        });
        toast.success(`Karyawan "${empForm.name.trim()}" ditambahkan & ditautkan ke akun login eksisting (@${existingAccountForNewEmp.username}).`);
      } else if (autoCreateUser && newEmpId) {
        addUser({
          name: empForm.name.trim(),
          username: cleanUsername,
          pin: "123456",
          role: calculatedRole,
          department: calculatedRole === "LEADER" ? (empForm.department as any) : null,
          employeeId: newEmpId
        });
        toast.success(`Karyawan & akun login otomatis dibuat (${cleanUsername} • PIN default: 123456 • Role: ${calculatedRole}).`);
      } else {
        toast.success(`Karyawan "${empForm.name.trim()}" berhasil ditambahkan.`);
      }
    }
    setIsEmployeeModalOpen(false);
  };

  const handleDeleteEmployee = (emp: any) => {
    if (isReadOnly || !canEditHR) return;
    const relatedUser = users.find(
      (u) =>
        (u.employeeId && u.employeeId === emp.id) ||
        u.username.toLowerCase() === (emp.username || "").toLowerCase()
    );
    if (relatedUser && relatedUser.id === currentUser?.id) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.");
      return;
    }
    if (relatedUser && (relatedUser.role === "SUPER_ADMIN" || relatedUser.role === "OWNER") && currentUser?.role !== "SUPER_ADMIN") {
      toast.error(`Hanya Super Admin yang dapat menghapus data akun ${relatedUser.role}.`);
      return;
    }
    const confirmMsg = `Hapus data karyawan "${emp.name}" (@${emp.username})? Data kontrak dan penugasan shift terkait akan otomatis dibersihkan` +
      (relatedUser ? ` serta akun login sistem "${relatedUser.username}" akan dicabut.` : ".") +
      ` Tindakan ini tidak dapat dibatalkan.`;

    confirmModal.open({
      title: "Hapus Data Karyawan",
      message: confirmMsg,
      variant: "danger",
      confirmLabel: "Ya, Hapus Karyawan",
      onConfirm: () => {
        deleteEmployee(emp.id);
        if (relatedUser) {
          deleteUser(relatedUser.id);
        }
        toast.success(`Data karyawan "${emp.name}" berhasil dihapus.`);
      },
    });
  };

  const handleDeleteContract = (c: any) => {
    if (isReadOnly || !canEditHR) return;
    const empName = getEmployeeName(c.employeeId);
    confirmModal.open({
      title: "Hapus Kontrak Kerja",
      message: `Hapus kontrak kerja karyawan "${empName}"? Data gaji pokok dan tunjangan pada kontrak ini akan dihapus.`,
      variant: "danger",
      confirmLabel: "Ya, Hapus Kontrak",
      onConfirm: () => {
        deleteContract(c.id);
        toast.success(`Kontrak kerja "${empName}" berhasil dihapus.`);
      },
    });
  };

  const handleImportEmployees = (data: any[]) => {
    if (!canEditHR) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengimport data karyawan.");
      return { added: 0, updated: 0, skipped: data.length };
    }
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    data.forEach(row => {
      const idSistem = String(row["ID_SISTEM (JANGAN DIUBAH)"] || "").trim();
      const username = normalizeTextCode(row["Username"] || row.username).toLowerCase();
      const name = String(row["Nama Karyawan"] || row.name || "").trim();
      const position = String(row["Posisi"] || row.position || "Barista").trim() || "Barista";
      const department = String(row["Departemen"] || row.department || "BAR").trim() || "BAR";
      const parsedStartDate = parseFlexibleDateYmd(row["Tanggal Masuk"]) || getLocalDateString();
      const phone = normalizeTextCode(row["Telepon"] ?? row.phone) || "-";
      const address = String(row["Alamat"] ?? row.address ?? "").trim() || "-";

      if (!username || !name) {
        skipped++;
        return;
      }

      if (idSistem) {
        const existing = employees.find(e => e.id === idSistem);
        if (existing) {
          updateEmployee({
            ...existing,
            username: username || existing.username,
            name,
            position,
            department,
            status: (row["Status"] || existing.status) as EmployeeStatus,
            employmentType: (row["Tipe"] || existing.employmentType) as EmploymentType,
            startDate: parseFlexibleDateYmd(row["Tanggal Masuk"]) || existing.startDate,
            phone: row["Telepon"] !== undefined && row["Telepon"] !== "" ? phone : existing.phone,
            address: row["Alamat"] !== undefined && row["Alamat"] !== "" ? address : existing.address,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        const dup = employees.some((e) => (e.username || "").toLowerCase().trim() === username);
        if (!dup) {
          addEmployee({
            username,
            name,
            position,
            department,
            status: (row["Status"] || "AKTIF") as EmployeeStatus,
            employmentType: (row["Tipe"] || "TETAP") as EmploymentType,
            startDate: parsedStartDate,
            endDate: null,
            phone,
            address,
          });
          imported++;
        } else {
          skipped++;
        }
      }
    });
    if (imported > 0 || updated > 0) {
      toast.success(`Berhasil menambahkan ${imported} data baru dan memperbarui ${updated} data karyawan.`);
    } else {
      toast.warning("Tidak ada data valid yang diimport.");
    }
    return { added: imported, updated, skipped };
  };

  const handleImportContracts = (data: any[]) => {
    if (!canEditHR) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengimport kontrak kerja.");
      return { added: 0, updated: 0, skipped: data.length };
    }
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    data.forEach(row => {
      const idSistem = String(row["ID_SISTEM (JANGAN DIUBAH)"] || "").trim();
      const uname = normalizeTextCode(row["Username"]).toLowerCase();
      const empId = employees.find(e => (e.username || "").toLowerCase().trim() === uname)?.id;
      const basicSalary = Math.max(0, Math.round(parseLocalizedNumber(row["Gaji Pokok"])));
      const positionAllowance = Math.max(0, Math.round(parseLocalizedNumber(row["Tunjangan Jabatan"])));
      const mealAllowance = Math.max(0, Math.round(parseLocalizedNumber(row["Tunjangan Makan"])));
      const transportAllowance = Math.max(0, Math.round(parseLocalizedNumber(row["Tunjangan Transport"])));
      const alphaDeductionPerDay = Math.max(0, Math.round(parseLocalizedNumber(row["Potongan Alpha"])));
      const kpiBonusTarget = Math.max(0, Math.round(parseLocalizedNumber(row["Target Bonus KPI"])));
      const startDate = parseFlexibleDateYmd(row["Mulai Kontrak"]) || getLocalDateString();
      const endDate = parseFlexibleDateYmd(row["Selesai Kontrak"]) || null;
      const status = String(row["Status"] || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

      if (idSistem) {
        const existing = contracts.find(c => c.id === idSistem);
        if (existing) {
          updateContract({
            ...existing,
            employeeId: empId || existing.employeeId,
            basicSalary,
            positionAllowance,
            mealAllowance,
            transportAllowance,
            alphaDeductionPerDay,
            kpiBonusTarget,
            startDate: parseFlexibleDateYmd(row["Mulai Kontrak"]) || existing.startDate,
            endDate: row["Selesai Kontrak"] ? endDate : existing.endDate,
            status,
          });
          updated++;
          return;
        }
      }

      if (empId) {
        addContract({
          employeeId: empId,
          basicSalary,
          positionAllowance,
          mealAllowance,
          transportAllowance,
          alphaDeductionPerDay,
          kpiBonusTarget,
          startDate,
          endDate: endDate || getLocalDateString(),
          status,
        });
        imported++;
      } else {
        skipped++;
      }
    });
    if (imported > 0 || updated > 0) {
      toast.success(`Berhasil menambahkan ${imported} kontrak baru dan memperbarui ${updated} kontrak.`);
    } else {
      toast.warning("Tidak ada data valid yang diimport. Pastikan Username karyawan sesuai.");
    }
    return { added: imported, updated, skipped };
  };

  const handleImportAttendances = (data: any[]) => {
    if (!canEditHR) {
      toast.error("Hanya Manager atau Super Admin yang dapat mengimport rekap absensi.");
      return { added: 0, updated: 0, skipped: data.length };
    }
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    data.forEach(row => {
      const idSistem = String(row["ID_SISTEM (JANGAN DIUBAH)"] || "").trim();
      const uname = normalizeTextCode(row["Username"]).toLowerCase();
      const empId = employees.find(e => (e.username || "").toLowerCase().trim() === uname)?.id;
      const period = normalizeTextCode(row["Periode (YYYY-MM)"]).slice(0, 7);
      if (!empId || !/^\d{4}-\d{2}$/.test(period)) {
        skipped++;
        return;
      }
      const check = validatePayrollMutation({
        action: "CREATE",
        recordPeriod: period,
        closedPeriods: closedPeriods || [],
      });
      if ("error" in check) {
        skipped++;
        return;
      }

      const payload = {
        presentDays: Math.max(0, Math.round(parseLocalizedNumber(row["Hadir"]))),
        sickDays: Math.max(0, Math.round(parseLocalizedNumber(row["Sakit"]))),
        permissionDays: Math.max(0, Math.round(parseLocalizedNumber(row["Izin"]))),
        alphaDays: Math.max(0, Math.round(parseLocalizedNumber(row["Alpha"]))),
        holidayDays: Math.max(0, Math.round(parseLocalizedNumber(row["Libur"]))),
        workingDays: Math.max(1, Math.round(parseLocalizedNumber(row["Hari Kerja"]) || 26)),
        notes: String(row["Catatan"] || "").trim(),
      };

      const existing =
        (idSistem ? attendances.find(a => a.id === idSistem) : undefined) ||
        attendances.find(a => a.employeeId === empId && a.period === period);

      if (existing) {
        updateAttendance({
          ...existing,
          ...payload,
          period,
        });
        updated++;
      } else {
        addAttendance({
          employeeId: empId,
          period,
          ...payload,
        });
        imported++;
      }
    });
    if (imported > 0 || updated > 0) {
      toast.success(`Berhasil menambahkan ${imported} rekap baru dan memperbarui ${updated} absensi.`);
    } else {
      toast.warning("Tidak ada data valid yang diimport. Pastikan Username & Periode sesuai dan belum tutup buku.");
    }
    return { added: imported, updated, skipped };
  };

  const handleOpenContractModal = (contract?: any, employeeId?: string) => {
    if (contract && contract.id) {
      setEditingContract(contract);
      setContractForm({ ...contract });
    } else {
      setEditingContract(null);
      setContractForm({ employeeId: employeeId || "", basicSalary: 0, positionAllowance: 0, mealAllowance: 0, transportAllowance: 0, alphaDeductionPerDay: 0, kpiBonusTarget: 0,  startDate: getLocalDateString(), endDate: "", status: "ACTIVE" });
    }
    setIsContractModalOpen(true);
  };

  const handleSaveContract = () => {
    if (isReadOnly || !canEditHR) return;
    if (!contractForm.employeeId) {
      toast.warning("Pilih karyawan terlebih dahulu.");
      return;
    }
    if (contractForm.endDate && contractForm.startDate && contractForm.endDate < contractForm.startDate) {
      toast.error("Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai.");
      return;
    }
    const sanitizedContract = {
      ...contractForm,
      basicSalary: Math.max(0, Math.round(Number(contractForm.basicSalary) || 0)),
      positionAllowance: Math.max(0, Math.round(Number(contractForm.positionAllowance) || 0)),
      mealAllowance: Math.max(0, Math.round(Number(contractForm.mealAllowance) || 0)),
      transportAllowance: Math.max(0, Math.round(Number(contractForm.transportAllowance) || 0)),
      alphaDeductionPerDay: Math.max(0, Math.round(Number(contractForm.alphaDeductionPerDay) || 0)),
      kpiBonusTarget: Math.max(0, Math.round(Number(contractForm.kpiBonusTarget) || 0)),
    };
    if (editingContract) {
      if (sanitizedContract.status === "ACTIVE") {
        contracts.forEach((c) => {
          if (c.id !== editingContract.id && c.employeeId === sanitizedContract.employeeId && c.status === "ACTIVE") {
            updateContract({ ...c, status: "INACTIVE" });
          }
        });
      }
      updateContract({ ...editingContract, ...sanitizedContract });
    } else {
      if (sanitizedContract.status === "ACTIVE") {
        contracts.forEach((c) => {
          if (c.employeeId === sanitizedContract.employeeId && c.status === "ACTIVE") {
            updateContract({ ...c, status: "INACTIVE" });
          }
        });
      }
      addContract(sanitizedContract);
    }
    
    // Sync endDate ke Employee
    if (sanitizedContract.status === "ACTIVE") {
      const emp = employees.find(e => e.id === sanitizedContract.employeeId);
      if (emp) {
        updateEmployee({ ...emp, endDate: sanitizedContract.endDate });
      }
    }
    
    setIsContractModalOpen(false);
    toast.success(`Kontrak kerja "${getEmployeeName(sanitizedContract.employeeId)}" berhasil disimpan.`);
  };

  const formatRupiah = (amount: number) => formatCurrency(Math.round(amount || 0));

  const getEmployeeName = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (emp) return emp.name;
    const user = users.find((u) => u.id === empId);
    return user ? user.name : "Unknown";
  };


  // --- Weekly Schedule Logic (WITA-locked) ---
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const todayWitaNoon = new Date(`${getLocalDateString()}T12:00:00+08:00`);
    const witaWeekday = new Date(todayWitaNoon.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
    const diffDays = witaWeekday === 0 ? -6 : 1 - witaWeekday;
    return new Date(todayWitaNoon.getTime() + diffDays * 24 * 60 * 60 * 1000);
  });

  const generateWeekDays = (start: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return days;
  };
  const weekDays = generateWeekDays(currentWeekStart);
  const weekKey = getLocalDateString(weekDays[0]);
  const currentWeekApproval = (settings?.scheduleApprovals as any)?.[weekKey] || { status: "DRAFT" };
  const isWeekApproved = currentWeekApproval.status === "APPROVED";
  const isWeekPending = currentWeekApproval.status === "PENDING";

  const submitScheduleToManager = () => {
    const newApprovals = {
      ...((settings?.scheduleApprovals as any) || {}),
      [weekKey]: {
        status: "PENDING",
        submittedBy: currentUser?.name || "Leader",
        submittedAt: new Date().toISOString(),
        leaderDivision,
      }
    };
    updateSettings({
      ...settings,
      scheduleApprovals: newApprovals,
    });
    toast.success(`Jadwal shift minggu (${weekDays[0].toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: DEFAULT_STORE_TIMEZONE })} - ${weekDays[6].toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: DEFAULT_STORE_TIMEZONE })}) berhasil diajukan ke Manajer.`);
  };

  const handleSubmitSchedule = () => {
    if (isReadOnly) return;
    if (scheduleCollisions.length > 0) {
      const highSeverity = scheduleCollisions.filter(c => c.severity === "high");
      if (highSeverity.length > 0) {
        confirmModal.open({
          title: "Peringatan Benturan Jadwal",
          message: `Terdeteksi ${highSeverity.length} potensi masalah pada jadwal (misal jeda istirahat < 8 jam / clopen). Tetap ajukan jadwal ini ke Manajer?`,
          variant: "warning",
          confirmLabel: "Ya, Tetap Ajukan",
          onConfirm: submitScheduleToManager,
        });
        return;
      }
    }
    submitScheduleToManager();
  };

  const handleOpenApproveModal = () => {
    if (!canEditHR) return;
    const existingNotes = currentWeekApproval.notes || "Semangat bertugas minggu ini! Jaga konsistensi rasa kopi & makanan, kebersihan area kerja divisi, dan senyum ramah ke pelanggan.";
    setBriefNotesInput(existingNotes);
    setIsBriefModalOpen(true);
  };

  const handleSaveApprovedBrief = () => {
    if (!canEditHR) return;
    const newApprovals = {
      ...((settings?.scheduleApprovals as any) || {}),
      [weekKey]: {
        status: "APPROVED",
        approvedBy: currentUser?.name || "Manager",
        approvedAt: new Date().toISOString(),
        notes: briefNotesInput.trim() || undefined,
      }
    };
    updateSettings({
      ...settings,
      scheduleApprovals: newApprovals,
    });
    setIsBriefModalOpen(false);
    toast.success("Jadwal mingguan resmi telah disahkan! Catatan brief otomatis tampil di Dashboard Karyawan.");
  };

  const handleToggleWeekApproval = () => {
    if (!canEditHR) return;
    if (!isWeekApproved) {
      handleOpenApproveModal();
    } else {
      const newApprovals = {
        ...((settings?.scheduleApprovals as any) || {}),
        [weekKey]: {
          status: "DRAFT",
          revisedBy: currentUser?.name || "Manager",
          revisedAt: new Date().toISOString(),
        }
      };
      updateSettings({
        ...settings,
        scheduleApprovals: newApprovals,
      });
    }
  };

  const handleRejectToDraft = () => {
    if (!canEditHR) return;
    const newApprovals = {
      ...((settings?.scheduleApprovals as any) || {}),
      [weekKey]: {
        status: "DRAFT",
        revisedBy: currentUser?.name || "Manager",
        revisedAt: new Date().toISOString(),
      }
    };
    updateSettings({
      ...settings,
      scheduleApprovals: newApprovals,
    });
    toast.info("Jadwal dikembalikan ke status Draft untuk direvisi oleh Leader.");
  };

  const handleUnlockForRevision = () => {
    if (isReadOnly) return;
    const newApprovals = {
      ...((settings?.scheduleApprovals as any) || {}),
      [weekKey]: {
        status: "DRAFT",
        revisedBy: currentUser?.name || "Leader",
        revisedAt: new Date().toISOString(),
      }
    };
    updateSettings({
      ...settings,
      scheduleApprovals: newApprovals,
    });
  };

  const isEmpActive = (e: any) => e.status === "AKTIF" || e.status === "ACTIVE" || !e.status;

  const canEditShiftForEmployee = (emp: any) => {
    if (isReadOnly) return false;
    if (!isOperationalStaff(emp)) return false;
    if (canEditHR) return true;
    if (isLeader) {
      // Leader dapat menyusun dan mengedit jadwal staf di divisinya sendiri (Kasir ikut ke Bar)
      const empDiv = getEmployeeDivision(emp);
      return empDiv === leaderDivision;
    }
    return false;
  };

  const filteredScheduleEmployees = useMemo(() => {
    const operationalList = employees.filter(e => isEmpActive(e) && isOperationalStaff(e));
    if (scheduleDivisionFilter === "ALL") return operationalList;
    return operationalList.filter(e => getEmployeeDivision(e) === scheduleDivisionFilter);
  }, [employees, scheduleDivisionFilter]);

  const handleCopyLastWeekSchedule = () => {
    if (isReadOnly || (!canEditHR && !isLeader)) return;
    const prevWeekDays = generateWeekDays(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
    let copiedCount = 0;
    let newShifts = [...employeeShifts];

    filteredScheduleEmployees.forEach(emp => {
      if (!canEditShiftForEmployee(emp)) return;

      for (let i = 0; i < 7; i++) {
        const prevDateStr = getLocalDateString(prevWeekDays[i]);
        const curDateStr = getLocalDateString(weekDays[i]);
        const prevShift = employeeShifts.find(s => s.employeeId === emp.id && s.date === prevDateStr)?.shiftType;
        
        if (prevShift) {
          const curIndex = newShifts.findIndex(s => s.employeeId === emp.id && s.date === curDateStr);
          if (curIndex >= 0) {
            newShifts[curIndex] = { ...newShifts[curIndex], shiftType: prevShift };
          } else {
            newShifts.push({
              id: crypto.randomUUID(),
              employeeId: emp.id,
              date: curDateStr,
              shiftType: prevShift,
            });
          }
          copiedCount++;
        }
      }
    });

    if (copiedCount > 0) {
      setEmployeeShifts(newShifts);
      if (isWeekApproved && isLeader) {
        handleUnlockForRevision();
      }
      toast.success(`Berhasil menyalin ${copiedCount} penugasan shift dari minggu lalu.`);
    } else {
      toast.warning("Tidak ada data jadwal shift dari minggu sebelumnya untuk disalin.");
    }
  };

  // Smart Collision Detection
  const scheduleCollisions = useMemo(() => {
    const warnings: { id: string; type: "clopen" | "understaffed" | "overwork"; message: string; severity: "high" | "medium" }[] = [];
    
    // 1. Clopen Check (Shift Sore jam 15-23 lalu besoknya Shift Pagi jam 07-15)
    const activeEmps = isLeader && leaderDivision 
      ? employees.filter(e => isEmpActive(e) && isOperationalStaff(e) && getEmployeeDivision(e) === leaderDivision)
      : employees.filter(e => isEmpActive(e) && isOperationalStaff(e));

    activeEmps.forEach(emp => {
      for (let i = 0; i < 6; i++) {
        const dayA = getLocalDateString(weekDays[i]);
        const dayB = getLocalDateString(weekDays[i + 1]);
        const shiftA = employeeShifts.find(s => s.employeeId === emp.id && s.date === dayA)?.shiftType;
        const shiftB = employeeShifts.find(s => s.employeeId === emp.id && s.date === dayB)?.shiftType;
        
        if (shiftA === "SORE" && shiftB === "PAGI") {
          const dayNameA = weekDays[i].toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
          const dayNameB = weekDays[i + 1].toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
          warnings.push({
            id: `clopen-${emp.id}-${dayA}`,
            type: "clopen",
            severity: "high",
            message: `Jeda Istirahat Kurang: ${emp.name} (${emp.department || emp.position}) Shift Sore pada ${dayNameA} lalu Shift Pagi pada ${dayNameB} (hanya jeda 8 jam).`
          });
        }
      }
      
      // 2. Overwork Check (7 hari berturut-turut tanpa libur OFF)
      const shiftsThisWeek = weekDays.map(d => {
        const dStr = getLocalDateString(d);
        return employeeShifts.find(s => s.employeeId === emp.id && s.date === dStr)?.shiftType || "OFF";
      });
      const workedDaysCount = shiftsThisWeek.filter(s => s !== "OFF").length;
      if (workedDaysCount === 7) {
        warnings.push({
          id: `overwork-${emp.id}`,
          type: "overwork",
          severity: "medium",
          message: `Tanpa Libur: ${emp.name} dijadwalkan masuk 7 hari berturut-turut tanpa hari OFF.`
        });
      }
    });

    // 3. Understaffed Check (Shift kosong di divisi yang ada stafnya)
    const divisionsToCheck: ("BAR" | "KITCHEN" | "BAKER")[] = isLeader && leaderDivision ? [leaderDivision] : ["BAR", "KITCHEN", "BAKER"];
    weekDays.forEach((d) => {
      const dStr = getLocalDateString(d);
      const dayName = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
      
      divisionsToCheck.forEach(div => {
        const divEmps = employees.filter(e => isEmpActive(e) && isOperationalStaff(e) && getEmployeeDivision(e) === div);
        if (divEmps.length >= 2) {
          const morningCount = divEmps.filter(e => {
            const s = employeeShifts.find(sh => sh.employeeId === e.id && sh.date === dStr)?.shiftType;
            return s === "PAGI";
          }).length;
          const afternoonCount = divEmps.filter(e => {
            const s = employeeShifts.find(sh => sh.employeeId === e.id && sh.date === dStr)?.shiftType;
            return s === "SORE";
          }).length;
          
          const divLabel = div === "BAR" ? "Bar & Kasir" : div;
          if (morningCount === 0 && afternoonCount > 0) {
            warnings.push({
              id: `understaffed-pagi-${div}-${dStr}`,
              type: "understaffed",
              severity: "medium",
              message: `Shift Pagi Kosong: Divisi ${divLabel} tidak memiliki staf bertugas di Shift Pagi pada ${dayName}.`
            });
          } else if (afternoonCount === 0 && morningCount > 0) {
            warnings.push({
              id: `understaffed-sore-${div}-${dStr}`,
              type: "understaffed",
              severity: "medium",
              message: `Shift Sore Kosong: Divisi ${divLabel} tidak memiliki staf bertugas di Shift Sore pada ${dayName}.`
            });
          }
        }
      });
    });

    return warnings;
  }, [employees, employeeShifts, weekDays, isLeader, leaderDivision]);

  const handleShiftChange = (empId: string, dateStr: string, shiftType: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp || !canEditShiftForEmployee(emp)) return;

    const exists = employeeShifts.some(s => s.employeeId === empId && s.date === dateStr);
    let newShifts: any[];
    if (exists) {
      newShifts = employeeShifts.map(s => 
        s.employeeId === empId && s.date === dateStr ? { ...s, shiftType } : s
      );
    } else {
      newShifts = [
        ...employeeShifts,
        {
          id: crypto.randomUUID(),
          employeeId: empId,
          date: dateStr,
          shiftType: shiftType
        }
      ];
    }
    setEmployeeShifts(newShifts);

    // Jika jadwal sebelumnya APPROVED dan diubah oleh Leader, buka status ke DRAFT agar Manajer mengetahui revisi
    if (isWeekApproved && isLeader) {
      const newApprovals = {
        ...((settings?.scheduleApprovals as any) || {}),
        [weekKey]: {
          status: "DRAFT",
          revisedBy: currentUser?.name || "Leader",
          revisedAt: new Date().toISOString(),
        }
      };
      updateSettings({
        ...settings,
        scheduleApprovals: newApprovals,
      });
    }
  };

  // --- Chart Data & Overview Computations ---
  const todayStr = getLocalDateString();

  const attendanceChartData = useMemo(() => {
    const recap = computeMonthlyAttendanceRecap({
      period: todayStr.substring(0, 7),
      dailyAttendances,
      manualAttendances: attendances,
      employees,
      users,
    });

    return recap.map((r) => ({
      name: r.employeeName.substring(0, 10),
      Hadir: r.presentDays,
      Alpha: r.alphaDays,
      Izin: r.sickDays + r.permissionDays,
    }));
  }, [attendances, dailyAttendances, employees, users, todayStr]);

  const monthlyRecapRows = useMemo(() => {
    return computeMonthlyAttendanceRecap({
      period: attendanceRecapPeriod,
      dailyAttendances,
      manualAttendances: attendances,
      employees,
      users,
    });
  }, [attendanceRecapPeriod, dailyAttendances, attendances, employees, users]);

  // Roster Staf Bertugas Hari Ini
  const todayShifts = useMemo(() => {
    const operationalList = employees.filter((e) => isEmpActive(e) && isOperationalStaff(e));
    return operationalList.map((emp) => {
      const shiftAssigned = employeeShifts.find((s) => s.employeeId === emp.id && s.date === todayStr)?.shiftType || "OFF";
      const att = dailyAttendances.find(
        (a) => resolveCanonicalEmployeeId(a.employeeId, employees, users) === emp.id && a.date === todayStr
      );
      return {
        emp,
        shift: shiftAssigned,
        attendance: att,
      };
    });
  }, [employees, users, employeeShifts, dailyAttendances, todayStr]);

  const filteredDailyAttendances = useMemo(() => {
    return [...dailyAttendances]
      .filter((d) => {
        if (attendanceDateFilter && d.date !== attendanceDateFilter) return false;
        if (
          attendanceEmpFilter !== "ALL" &&
          resolveCanonicalEmployeeId(d.employeeId, employees, users) !== attendanceEmpFilter
        ) {
          return false;
        }
        if (attendanceApprovalFilter !== "ALL") {
          if (attendanceApprovalFilter === "FORGOTTEN_CLOCKOUT") {
            if (!(!d.clockOutTime && d.clockInTime && d.date < todayStr)) return false;
          } else if (attendanceApprovalFilter === "CORRECTED") {
            if (!d.isCorrected) return false;
          } else {
            const appStatus = d.approvalStatus || "PENDING";
            if (appStatus !== attendanceApprovalFilter) return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.clockInTime || "").localeCompare(a.clockInTime || ""));
  }, [dailyAttendances, attendanceDateFilter, attendanceEmpFilter, attendanceApprovalFilter, todayStr, employees, users]);

  // Kontrak Mendekati Jatuh Tempo (< 30 hari atau overdue, WITA date comparison)
  const expiringContractsList = useMemo(() => {
    const thirtyDaysStr = addDaysToLocalDate(todayStr, 30);
    const todayMidnightMs = new Date(`${todayStr}T00:00:00+08:00`).getTime();

    return contracts
      .filter((c) => {
        if (c.status !== "ACTIVE" && !(c as any).isActive) return false;
        if (!c.endDate) return false;
        return c.endDate <= thirtyDaysStr;
      })
      .map((c) => {
        const endMs = new Date(`${c.endDate}T00:00:00+08:00`).getTime();
        const daysRemaining = Math.round((endMs - todayMidnightMs) / (1000 * 60 * 60 * 24));
        return {
          ...c,
          daysRemaining,
          isOverdue: daysRemaining < 0,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [contracts, todayStr]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = empSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        (emp.username || "").toLowerCase().includes(q) ||
        (emp.position || "").toLowerCase().includes(q);
      const matchDept =
        empDeptFilter === "ALL" ||
        (() => {
          const div = getEmployeeDivision(emp);
          const dept = (emp.department || "").toUpperCase();
          const pos = (emp.position || "").toUpperCase();
          if (empDeptFilter === "BAR" || empDeptFilter === "KITCHEN" || empDeptFilter === "BAKER") {
            return div === empDeptFilter;
          }
          if (empDeptFilter === "FINANCE") {
            return (
              dept.includes("FINANCE") ||
              dept.includes("KEUANGAN") ||
              dept.includes("ACCOUNT") ||
              pos.includes("FINANCE") ||
              pos.includes("KEUANGAN")
            );
          }
          if (empDeptFilter === "MANAGEMENT") {
            return (
              div === "OFFICE" &&
              !(dept.includes("FINANCE") || dept.includes("KEUANGAN") || pos.includes("FINANCE") || pos.includes("KEUANGAN"))
            );
          }
          return dept === empDeptFilter.toUpperCase();
        })();
      const matchStatus =
        empStatusFilter === "ALL" ||
        (empStatusFilter === "AKTIF" ? isEmpActive(emp) : !isEmpActive(emp));
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, empSearch, empDeptFilter, empStatusFilter]);

  const filteredContracts = useMemo(() => {
    const thirtyDaysStr = addDaysToLocalDate(todayStr, 30);

    return contracts.filter((c) => {
      const empName = getEmployeeName(c.employeeId).toLowerCase();
      const q = contractSearch.toLowerCase().trim();
      const matchSearch = !q || empName.includes(q);
      if (!matchSearch) return false;

      if (contractStatusFilter === "ALL") return true;
      const isActive = c.status === "ACTIVE" || (c as any).isActive;
      const endDateStr = c.endDate || "";
      const isExpired = Boolean(endDateStr && endDateStr < todayStr);
      const isExpiring = Boolean(isActive && endDateStr && endDateStr >= todayStr && endDateStr <= thirtyDaysStr);

      if (contractStatusFilter === "ACTIVE") return isActive && !isExpired;
      if (contractStatusFilter === "EXPIRING") return isExpiring;
      if (contractStatusFilter === "EXPIRED") return isExpired;
      if (contractStatusFilter === "INACTIVE") return !isActive;
      return true;
    });
  }, [contracts, contractSearch, contractStatusFilter, employees, users, todayStr]);

  // ─── PAYROLL PROJECTION HELPER ──────────────────────────────────────────
  const payrollData = useMemo(() => {
    // Generate payroll based on attendance records
    return attendances
      .map((att) => {
        const emp = employees.find((e) => e.id === att.employeeId);
        const contract = contracts.find((c) => c.employeeId === att.employeeId && (c.status === "ACTIVE" || (c as any).isActive)) 
          || contracts.find((c) => c.employeeId === att.employeeId);

        if (!emp || !contract) return null;

        const isManagerOrExempt = emp.position?.toUpperCase().includes("MANAGER") ||
                                  emp.position?.toUpperCase().includes("MANAJER") ||
                                  emp.department?.toUpperCase().includes("MANAGEMENT") ||
                                  emp.position?.toUpperCase().includes("OWNER");

        const basic = contract.basicSalary;
        const meal = isManagerOrExempt 
          ? contract.mealAllowance * (att.presentDays > 0 ? att.presentDays : 25) 
          : contract.mealAllowance * att.presentDays;
        const transportRate = contract.transportAllowance || 0;
        const transport = isManagerOrExempt
          ? transportRate * (att.presentDays > 0 ? att.presentDays : 25)
          : transportRate * att.presentDays;
        const dailyWage = Math.round(contract.basicSalary / 25);
        const alphaDeduction = isManagerOrExempt 
          ? 0 
          : ((contract.alphaDeductionPerDay !== undefined && contract.alphaDeductionPerDay !== 0) ? contract.alphaDeductionPerDay : dailyWage) * att.alphaDays;

        // Hitung Skor KPI Otomatis dari Checklist Shift & Presensi (0 - 100)
        const empChecklists = (dailyChecklists || []).filter(
          (c) => resolveCanonicalEmployeeId(c.employeeId, employees, users) === emp.id && c.date.startsWith(att.period)
        );
        const checklistDays = empChecklists.length;
        const expectedDays = Math.max(1, att.presentDays || 22);
        const autoScore = checklistDays > 0
          ? Math.max(0, Math.min(100, Math.round((checklistDays / expectedDays) * 100) - (att.alphaDays * 10)))
          : 0;

        // Tunjangan Jabatan Leader Berbasis Capaian Jobdesk
        const rawPosition = contract.positionAllowance || 0;
        const isLeaderEmp = emp.position?.toUpperCase().includes("LEADER") || 
                            emp.position?.toUpperCase().includes("HEAD") ||
                            emp.position?.toUpperCase().includes("SPV") ||
                            emp.position?.toUpperCase().includes("SUPERVISOR");
        let position = rawPosition;
        if (rawPosition > 0 && isLeaderEmp) {
          const leaderJobdeskScore = checklistDays > 0 ? Math.min(100, Math.round((checklistDays / expectedDays) * 100)) : 0;
          const leaderRules = (settings as any)?.leaderJobdeskAllowanceRules && (settings as any).leaderJobdeskAllowanceRules.length > 0
            ? (settings as any).leaderJobdeskAllowanceRules
            : DEFAULT_LEADER_ALLOWANCE_RULES;
          const activeLeaderRules = leaderRules.filter((r: any) => r.isActive !== false);
          const matchedLeaderTier = activeLeaderRules.find(
            (r: any) => leaderJobdeskScore >= r.minScore && leaderJobdeskScore <= r.maxScore
          );
          const payoutPct = matchedLeaderTier ? matchedLeaderTier.payoutPercentage : leaderJobdeskScore;
          position = Math.round((rawPosition * payoutPct) / 100);
        }

        // Cek Aturan Bonus Bertingkat (Tiered) Masuk Otomatis
        const activeRules = (kpiBonusRules || []).filter((r: any) => r.isActive !== false);
        const applicableRule = autoScore > 0 ? activeRules.find((r: any) => autoScore >= r.minScore && autoScore <= r.maxScore) : undefined;

        const divisionBonusPlafon = (settings as any)?.divisionKpiBonusTarget?.[emp.department?.toUpperCase() || ""] || 0;
        const targetKpi = contract.kpiBonusTarget || divisionBonusPlafon || 0;

        const kpiBonus = (autoScore === 0 || checklistDays === 0)
          ? 0
          : (applicableRule
              ? applicableRule.bonusAmount
              : (targetKpi > 0 ? Math.round(targetKpi * (autoScore / 100)) : 0));

        const total = Math.round(basic + meal + transport + position + kpiBonus - alphaDeduction);

        return {
          id: `pr_${att.id}`,
          employee: emp,
          period: att.period,
          basic,
          meal,
          transport,
          position,
          alphaDeduction,
          kpiBonus,
          total,
          attendance: att,
        };
      })
      .filter(Boolean) as any[];
  }, [attendances, employees, users, contracts, kpiBonusRules, settings, dailyChecklists]);

  const currentPeriod = useMemo(() => getLocalPeriodString(), []);
  const avgKpiScore = useMemo(() => {
    if (!employees || employees.length === 0) return "0.0";
    const operational = employees.filter((e) => isEmpActive(e) && isOperationalStaff(e));
    if (operational.length === 0) return "0.0";
    const recapList = computeMonthlyAttendanceRecap({
      period: currentPeriod,
      dailyAttendances,
      manualAttendances: attendances,
      employees,
      users,
    });
    const scores = operational.map((emp) => {
      const empChecklists = (dailyChecklists || []).filter(
        (c) => resolveCanonicalEmployeeId(c.employeeId, employees, users) === emp.id && c.date.startsWith(currentPeriod)
      );
      if (empChecklists.length > 0) {
        return Math.min(100, Math.round((empChecklists.length / 22) * 100));
      }
      const attRecap = recapList.find((r) => r.employeeId === emp.id);
      if (!attRecap || attRecap.presentDays === 0) return 0;
      return Math.max(0, Math.min(100, Math.round((attRecap.presentDays / 22) * 100) - attRecap.lateDays * 2 - attRecap.alphaDays * 10));
    });
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }, [employees, users, dailyChecklists, dailyAttendances, attendances, currentPeriod]);

  // ─── TABS ──────────────────────────────────────────────────────────
  const tabs = isLeader ? [
    {
      id: "schedule",
      label: isIndo ? "Jadwal Shift Tim" : "Team Schedule",
      icon: Clock,
    }
  ] : [
    { id: "overview", label: isIndo ? "Overview" : "Overview", icon: Target },
    {
      id: "employees",
      label: isIndo ? "Data Karyawan" : "Employees",
      icon: Users,
    },
    {
      id: "contracts",
      label: isIndo ? "Kontrak & Gaji" : "Contracts & Salary",
      icon: FileText,
    },
    {
      id: "schedule",
      label: isIndo ? "Jadwal Shift" : "Shift Schedule",
      icon: Clock,
    },
    {
      id: "attendance",
      label: isIndo ? "Absensi" : "Attendance",
      icon: Calendar,
    },
    { id: "kpi", label: "KPI", icon: Target },
    { id: "payroll", label: "Payroll", icon: RupiahSign },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {isIndo ? "SDM & Payroll" : "HR & Payroll"}
          </h2>
          <p className="text-slate-500">
            {isIndo
              ? "Kelola karyawan, absensi, dan gaji."
              : "Manage employees, attendance, and salary."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="p-2 sm:p-2.5 bg-slate-50/80 border-b border-slate-200/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors duration-150 shrink-0 cursor-pointer ${
                    isActive
                      ? "text-brand-900"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hrManagementMainTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/80"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <tab.icon className={`relative z-10 w-4 h-4 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Expiring Contracts Warning Banner */}
              {expiringContractsList.length > 0 && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-amber-950">
                        Perhatian: {expiringContractsList.length} Kontrak Karyawan Mendekati Jatuh Tempo
                      </p>
                      <p className="text-amber-800/90 mt-0.5">
                        {expiringContractsList.slice(0, 3).map((c) => {
                          const empName = getEmployeeName(c.employeeId);
                          return c.isOverdue
                            ? `${empName} (Lewat ${Math.abs(c.daysRemaining)} hari)`
                            : `${empName} (Sisa ${c.daysRemaining} hari)`;
                        }).join(", ")}
                        {expiringContractsList.length > 3 ? ` dan ${expiringContractsList.length - 3} lainnya` : ""}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("contracts")}
                    className="px-3.5 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl shadow-2xs shrink-0 transition-colors cursor-pointer"
                  >
                    Tinjau Kontrak →
                  </button>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-2xl border border-brand-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-brand-900 text-sm font-semibold">
                      {isIndo ? "Total Karyawan" : "Total Employees"}
                    </h3>
                    <div className="p-2.5 bg-brand-100 text-brand-600 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-brand-900">
                    {employees.filter(isEmpActive).length}
                  </p>
                  <p className="text-sm text-brand-600 mt-2">
                    {isIndo ? "Karyawan Aktif" : "Active Employees"}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-emerald-900 text-sm font-semibold">
                      {isIndo ? "Rata-rata KPI" : "Avg KPI Score"}
                    </h3>
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                      <Target className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-emerald-900">
                    {avgKpiScore}
                  </p>
                  <p className="text-sm text-emerald-600 mt-2">
                    {isIndo ? "Otomatis dari Shift (Skala 100)" : "Automated from Shifts (Out of 100)"}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-2xl border border-brand-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-brand-900 text-sm font-semibold">
                      {isIndo ? "Total Gaji Pokok" : "Total Basic Salary"}
                    </h3>
                    <div className="p-2.5 bg-brand-100 text-brand-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-brand-900">
                    {formatRupiah(
                      contracts
                        .filter((c) => c.status === "ACTIVE" || (c as any).isActive)
                        .reduce((sum, c) => sum + (c.basicSalary || 0), 0),
                    )}
                  </p>
                  <p className="text-sm text-brand-600 mt-2">
                    {isIndo ? "Kontrak Aktif" : "Active Contracts"}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-2xl border border-brand-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-brand-900 text-sm font-semibold">
                      {isIndo ? "Proyeksi Payroll" : "Payroll Projection"}
                    </h3>
                    <div className="p-2.5 bg-brand-100 text-brand-600 rounded-xl">
                      <RupiahSign className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-brand-900 tabular-nums">
                    {formatRupiah(
                      (() => {
                        const existingPeriodSlips = (payrollRecords || []).filter((p: any) => p.period === currentPeriod);
                        if (existingPeriodSlips.length > 0) {
                          return existingPeriodSlips.reduce((sum: number, p: any) => sum + (p.netPay || 0), 0);
                        }
                        const calculated = payrollData.reduce((sum, p) => sum + (p ? p.total : 0), 0);
                        if (calculated > 0) return calculated;
                        return contracts
                          .filter((c) => c.status === "ACTIVE" || (c as any).isActive)
                          .reduce((sum, c) => sum + Math.round((c.basicSalary || 0) + (c.mealAllowance || 0) + (c.positionAllowance || 0) + (c.transportAllowance || 0)), 0);
                      })()
                    )}
                  </p>
                  <p className="text-sm text-brand-600 mt-2">
                    {isIndo ? "Periode Berjalan" : "Current Period"}
                  </p>
                </motion.div>
              </div>

              {/* Today's Shift Roster Widget */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        {isIndo ? "Roster Staf Bertugas Hari Ini" : "Today's On-Duty Staff"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: DEFAULT_STORE_TIMEZONE })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("schedule")}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    Buka Matriks Shift Mingguan →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { key: "PAGI", label: "Shift Pagi", time: "07:00 – 15:00", bg: "bg-emerald-50/50 border-emerald-200/70", badge: "bg-emerald-100 text-emerald-800" },
                    { key: "MIDDLE", label: "Shift Middle", time: "11:00 – 19:00", bg: "bg-brand-50/50 border-brand-200/70", badge: "bg-brand-100 text-brand-800" },
                    { key: "SORE", label: "Shift Sore", time: "15:00 – 23:00", bg: "bg-amber-50/50 border-amber-200/70", badge: "bg-amber-100 text-amber-800" },
                    { key: "OFF", label: "Libur (OFF)", time: "Jadwal Istirahat", bg: "bg-slate-50/70 border-slate-200/70", badge: "bg-slate-200 text-slate-700" },
                  ].map((group) => {
                    const staffInShift = todayShifts.filter((s) => s.shift === group.key);
                    return (
                      <div key={group.key} className={`p-4 rounded-xl border ${group.bg} flex flex-col justify-between`}>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-800">{group.label}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${group.badge}`}>
                              {staffInShift.length} Staf
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-3">{group.time}</p>
                          
                          {staffInShift.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">Tidak ada staf</p>
                          ) : (
                            <div className="space-y-2">
                              {staffInShift.map(({ emp, attendance }) => {
                                const hasClockIn = !!attendance?.clockInTime;
                                const isLate = attendance?.status === "TERLAMBAT";
                                return (
                                  <div key={emp.id} className="bg-white/90 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 shadow-2xs">
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">{emp.name}</p>
                                      <span className="text-[10px] text-slate-500">{emp.department || emp.position}</span>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      {hasClockIn ? (
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          isLate ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${isLate ? "bg-amber-500" : "bg-emerald-500"}`} />
                                          {isLate ? "Terlambat" : "Hadir"}
                                        </span>
                                      ) : group.key === "OFF" ? (
                                        <span className="text-[10px] text-slate-400 font-medium">Libur</span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-medium">Belum Hadir</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attendance Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm mt-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">
                  {isIndo
                    ? "Statistik Kehadiran (Periode Terakhir)"
                    : "Attendance Stats"}
                </h3>
                <div className="h-[300px] w-full">
                  {attendanceChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E2E8F0"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                          dx={-10}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Bar
                          dataKey="Hadir"
                          stackId="a"
                          fill="#10B981"
                          radius={[0, 0, 4, 4]}
                        />
                        <Bar dataKey="Izin" stackId="a" fill="#F59E0B" />
                        <Bar
                          dataKey="Alpha"
                          stackId="a"
                          fill="#EF4444"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 italic">
                      Belum ada data absensi untuk ditampilkan.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "employees" && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo ? "Data Karyawan" : "Employee Data"}
                </h3>
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <CsvImportExport
                    onImport={handleImportEmployees}
                    canImport={canEditHR}
                    requiredHeaders={["Username", "Nama Karyawan"]}
                    exportFilename="Data_Karyawan"
                    exportTitle="Daftar Karyawan Aktif & Non-Aktif"
                    templateHeaders={["Username", "Nama Karyawan", "Posisi", "Departemen", "Status", "Tipe", "Tanggal Masuk", "Telepon", "Alamat"]}
                    templateExampleRow={["EMP-001", "Budi Santoso", "Barista", "BAR", "AKTIF", "TETAP", getLocalDateString(), "081234567890", "Jl. Merdeka No. 10"]}
                    currentData={employees.map(e => ({
                      id: e.id,
                      "Username": e.username || "",
                      "Nama Karyawan": e.name,
                      "Posisi": e.position,
                      "Departemen": e.department,
                      "Status": e.status,
                      "Tipe": e.employmentType,
                      "Tanggal Masuk": String(e.startDate || "").slice(0, 10),
                      "Telepon": e.phone || "",
                      "Alamat": e.address || "",
                    }))}
                    templateFilename="template_karyawan"
                    buttonLabel={canEditHR ? (isIndo ? "Impor / Ekspor" : "Import / Export") : (isIndo ? "Ekspor Data" : "Export Data")}
                    templateDropdowns={{
                      "Posisi": ["Kasir", "Barista", "Chef", "Baker", "Leader", "Manager", "Finance"],
                      "Departemen": ["BAR", "KITCHEN", "BAKER", "MANAGEMENT", "FINANCE"],
                      "Status": ["AKTIF", "TIDAK_AKTIF", "RESIGN", "PHK"],
                      "Tipe": ["TETAP", "KONTRAK", "PARUH_WAKTU", "MAGANG"],
                    }}
                    templateColumnTypes={{
                      "Tanggal Masuk": "date",
                    }}
                    templateFormats={{
                      "Username": "text",
                      "Telepon": "text",
                      "Tanggal Masuk": "date",
                    }}
                    templateHints={{
                      "Username": "ID / Username unik karyawan",
                      "Nama Karyawan": "Nama lengkap karyawan",
                      "Posisi": "Pilih jabatan",
                      "Departemen": "Pilih divisi/departemen",
                      "Status": "Status keaktifan",
                      "Tipe": "Tipe ikatan kerja",
                      "Tanggal Masuk": "Format YYYY-MM-DD",
                      "Telepon": "No. HP/WA (format teks agar angka 0 terjaga)",
                    }}
                  />
                  {canEditHR && (
                    <button
                      onClick={() => handleOpenEmployeeModal()}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-xs whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4 shrink-0" />{" "}
                      {isIndo ? "Tambah Karyawan" : "Add Employee"}
                    </button>
                  )}
                </div>
              </div>

              {/* Banner Sinkronisasi Akun Login Eksisting ke SDM */}
              <AnimatePresence>
                {canEditHR && unlinkedStaffUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="mb-4 rounded-2xl border border-brand-200/80 dark:border-brand-500/30 bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                          <UserPlus className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {unlinkedStaffUsers.length} Akun Pengguna Belum Terdaftar di SDM &amp; Kontrak Gaji
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                            Akun yang dipertahankan saat cleaning (seperti Manager/Finance/Kasir) perlu didaftarkan ke SDM agar muncul di daftar Kontrak Gaji &amp; Payroll.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-10">
                        {unlinkedStaffUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleRegisterUserToHR(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-slate-800 text-[11px] font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/20 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{u.name}</span>
                            <span className="opacity-70">(@{u.username} • {u.role})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegisterAllUsersToHR}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Daftarkan Semua ke SDM
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Cari nama, username, atau posisi..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                  />
                  {empSearch && (
                    <button
                      onClick={() => setEmpSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={empDeptFilter}
                    onChange={setEmpDeptFilter}
                    options={[
                      { value: "ALL", label: "Semua Departemen" },
                      { value: "BAR", label: "Bar & Kasir" },
                      { value: "KITCHEN", label: "Kitchen" },
                      { value: "BAKER", label: "Baker" },
                      { value: "MANAGEMENT", label: "Manajemen" },
                      { value: "FINANCE", label: "Keuangan" },
                    ]}
                    buttonClassName="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-white"
                  />

                  <CustomSelect
                    value={empStatusFilter}
                    onChange={setEmpStatusFilter}
                    options={[
                      { value: "ALL", label: "Semua Status" },
                      { value: "AKTIF", label: "Hanya Aktif" },
                      { value: "NON-AKTIF", label: "Non-Aktif / Resign" },
                    ]}
                    buttonClassName="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                      <th className="py-3 px-4 font-semibold">Username</th>
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Nama" : "Name"}
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Jabatan" : "Position"}
                      </th>
                      <th className="py-3 px-4 font-semibold">Departemen</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      {canEditHR && (
                        <th className="py-3 px-4 font-semibold text-right">
                          Aksi
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canEditHR ? 6 : 5}
                          className="py-8 text-center text-slate-500 italic"
                        >
                          {employees.length === 0
                            ? (isIndo ? "Belum ada data karyawan." : "No employees data yet.")
                            : (isIndo ? "Tidak ditemukan karyawan yang sesuai pencarian/filter." : "No matching employees found.")}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-600 font-mono text-sm">
                            {emp.username}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {emp.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {emp.position}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {emp.department}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full 
                              ${isEmpActive(emp) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          {canEditHR && (
                            <td className="py-3 px-4 flex justify-end gap-1.5">
                              <button 
                                onClick={() => handleOpenEmployeeModal(emp)}
                                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Data Karyawan"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteEmployee(emp)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Karyawan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Callout Pemantauan Kehadiran */}
              <div className="mt-8 p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-100 text-brand-700 rounded-xl shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Pemantauan Kehadiran Lapangan & Foto GPS
                    </h4>
                    <p className="text-xs text-slate-500">
                      Lihat foto selfie kamera, peta lokasi GPS interaktif, dan verifikasi kehadiran karyawan secara real-time di tab Absensi.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  className="px-4 py-2 bg-white border border-slate-300 hover:border-brand-500 hover:text-brand-600 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors shrink-0 flex items-center justify-center gap-1.5"
                >
                  Buka Tab Absensi →
                </button>
              </div>
            </div>
          )}

          {activeTab === "contracts" && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo ? "Struktur Gaji & Kontrak" : "Salary & Contracts"}
                </h3>
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <CsvImportExport
                    onImport={handleImportContracts}
                    canImport={canEditHR}
                    requiredHeaders={["Username", "Gaji Pokok"]}
                    exportFilename="Data_Kontrak_Gaji_Karyawan"
                    exportTitle="Daftar Struktur Gaji & Kontrak Kerja"
                    templateHeaders={["Username", "Gaji Pokok", "Tunjangan Jabatan", "Tunjangan Makan", "Tunjangan Transport", "Potongan Alpha", "Target Bonus KPI", "Mulai Kontrak", "Selesai Kontrak", "Status"]}
                    templateExampleRow={[employees[0]?.username || "EMP-001", "3500000", "500000", "20000", "20000", "100000", "500000", getLocalDateString(), "", "ACTIVE"]}
                    currentData={contracts.map(c => {
                      const emp = employees.find(e => e.id === c.employeeId);
                      return {
                        id: c.id,
                        "Username": emp?.username || "",
                        "Gaji Pokok": c.basicSalary,
                        "Tunjangan Jabatan": c.positionAllowance,
                        "Tunjangan Makan": c.mealAllowance,
                        "Tunjangan Transport": c.transportAllowance,
                        "Potongan Alpha": c.alphaDeductionPerDay ?? 0,
                        "Target Bonus KPI": c.kpiBonusTarget,
                        "Mulai Kontrak": String(c.startDate || "").slice(0, 10),
                        "Selesai Kontrak": c.endDate ? String(c.endDate).slice(0, 10) : "",
                        "Status": c.status,
                      };
                    })}
                    templateFilename="template_kontrak"
                    buttonLabel={canEditHR ? (isIndo ? "Impor / Ekspor" : "Import / Export") : (isIndo ? "Ekspor Data" : "Export Data")}
                    templateDropdowns={{
                      Username: employees.map(e => e.username).filter(Boolean),
                      Status: ["ACTIVE", "INACTIVE"],
                    }}
                    templateColumnTypes={{
                      "Gaji Pokok": "integer",
                      "Tunjangan Jabatan": "integer",
                      "Tunjangan Makan": "integer",
                      "Tunjangan Transport": "integer",
                      "Potongan Alpha": "integer",
                      "Target Bonus KPI": "integer",
                      "Mulai Kontrak": "date",
                      "Selesai Kontrak": "date",
                    }}
                    templateFormats={{
                      Username: "text",
                      "Gaji Pokok": "currency",
                      "Tunjangan Jabatan": "currency",
                      "Tunjangan Makan": "currency",
                      "Tunjangan Transport": "currency",
                      "Potongan Alpha": "currency",
                      "Target Bonus KPI": "currency",
                      "Mulai Kontrak": "date",
                      "Selesai Kontrak": "date",
                    }}
                    templateHints={{
                      Username: "Pilih username karyawan dari daftar dropdown",
                      "Mulai Kontrak": "Format YYYY-MM-DD",
                      "Selesai Kontrak": "Format YYYY-MM-DD (kosongkan jika permanen)",
                    }}
                  />
                  {canEditHR && (
                    <button onClick={() => handleOpenContractModal()} className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-xs whitespace-nowrap shrink-0">
                      <Plus className="w-4 h-4 shrink-0" /> {isIndo ? "Tambah Kontrak" : "Add Contract"}
                    </button>
                  )}
                </div>
              </div>

              {/* Pengingat jika ada akun login eksisting belum masuk SDM untuk dibuatkan kontrak */}
              <AnimatePresence>
                {canEditHR && unlinkedStaffUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="mb-4 rounded-2xl border border-brand-200/80 dark:border-brand-500/30 bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 text-xs">
                      <UserPlus className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0 mt-0.5" />
                      <p className="text-slate-700 dark:text-slate-200">
                        <strong className="text-slate-900 dark:text-slate-100">
                          {unlinkedStaffUsers.length} akun aktif
                        </strong>{" "}
                        ({unlinkedStaffUsers.map((u) => `@${u.username} [${u.role}]`).join(", ")}) belum masuk daftar karyawan SDM sehingga belum muncul di pilihan Kontrak Gaji.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegisterAllUsersToHR}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Daftarkan ke SDM Sekarang
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    placeholder="Cari nama karyawan..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                  />
                  {contractSearch && (
                    <button
                      onClick={() => setContractSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={contractStatusFilter}
                    onChange={setContractStatusFilter}
                    options={[
                      { value: "ALL", label: "Semua Status Kontrak" },
                      { value: "ACTIVE", label: "Kontrak Aktif" },
                      { value: "EXPIRING", label: "Segera Berakhir (< 30 Hari)" },
                      { value: "EXPIRED", label: "Sudah Berakhir (Lewat)" },
                      { value: "INACTIVE", label: "Non-Aktif / Diarsipkan" },
                    ]}
                    buttonClassName="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Karyawan" : "Employee"}
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Batas Kontrak" : "End Date"}
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Gaji Pokok" : "Basic Salary"}
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Tnjgn Makan" : "Meal Allow."}
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Tnjgn Jabatan" : "Position Allow."}
                      </th>
                      {canEditHR && (
                        <th className="py-3 px-4 font-semibold text-right">
                          Aksi
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canEditHR ? 6 : 5}
                          className="py-8 text-center text-slate-500 italic"
                        >
                          {contracts.length === 0
                            ? (isIndo ? "Belum ada data kontrak." : "No contract data yet.")
                            : (isIndo ? "Tidak ditemukan kontrak yang sesuai pencarian/filter." : "No matching contracts found.")}
                        </td>
                      </tr>
                    ) : (
                      filteredContracts.map((c) => {
                        const isExpired = (() => {
                          if (!c.endDate) return false;
                          const end = new Date(c.endDate);
                          end.setHours(23, 59, 59, 999);
                          return end < new Date();
                        })();

                        const isExpiring = (() => {
                          if (!c.endDate || isExpired || (c.status !== 'ACTIVE' && !(c as any).isActive)) return false;
                          const end = new Date(c.endDate);
                          const thirtyDays = new Date();
                          thirtyDays.setDate(new Date().getDate() + 30);
                          return end >= new Date() && end <= thirtyDays;
                        })();
                        
                        return (
                          <tr
                            key={c.id}
                            className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                              isExpired ? 'bg-rose-50/40' : isExpiring ? 'bg-amber-50/50' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-medium text-slate-800">
                              {getEmployeeName(c.employeeId)}
                            </td>
                            <td className="py-3 px-4">
                              {c.endDate ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-slate-600 font-medium">
                                    {new Date(c.endDate).toLocaleDateString("id-ID")}
                                  </span>
                                  {isExpired && (
                                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full inline-block w-max">
                                      {isIndo ? "Sudah Berakhir" : "Expired"}
                                    </span>
                                  )}
                                  {isExpiring && !isExpired && (
                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full inline-block w-max">
                                      {isIndo ? "Segera Berakhir" : "Expiring Soon"}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">
                                  {isIndo ? "Tetap" : "Permanent"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {formatRupiah(c.basicSalary)}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {formatRupiah(c.mealAllowance)}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {formatRupiah(c.positionAllowance)}
                            </td>
                            {canEditHR && (
                              <td className="py-3 px-4 flex justify-end gap-1.5">
                                <button 
                                  onClick={() => handleOpenContractModal(c)}
                                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Kontrak"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteContract(c)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Kontrak"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          
          {activeTab === "schedule" && (
            <div className="space-y-6">
              {/* Header: Title, Week Navigator, Division Filter, & Status/Approval */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-800">
                      {isLeader 
                        ? (isIndo ? `Jadwal Shift Tim ${leaderDivision === "BAR" ? "Bar & Kasir" : leaderDivision || ""}` : `Team Shift Schedule`) 
                        : (isIndo ? "Jadwal Shift & Evaluasi (Semua Divisi)" : "Shift Schedule & Review (All Divisions)")}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isWeekApproved 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : isWeekPending
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {isWeekApproved 
                        ? `● APPROVED (Disetujui: ${currentWeekApproval.approvedBy || "Manajer"})` 
                        : isWeekPending
                        ? `● MENUNGGU PERSETUJUAN (Diajukan: ${currentWeekApproval.submittedBy || "Leader"})`
                        : "● DRAFT (Penyusunan Leader)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isLeader 
                      ? "Susun giliran shift tim Anda. Pastikan tidak ada jam shift kosong sebelum klik 'Ajukan ke Manajer'."
                      : "Tinjau jadwal yang disusun Leader divisi. Periksa deteksi bentrok sebelum menyetujui jadwal."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                  {/* Week Navigator */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => {
                        const prev = new Date(currentWeekStart);
                        prev.setHours(12, 0, 0, 0);
                        prev.setDate(prev.getDate() - 7);
                        setCurrentWeekStart(prev);
                      }}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                    >
                      &laquo; Minggu Lalu
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-800">
                      {weekDays[0].toLocaleDateString("id-ID", { month: "short", day: "numeric" })} - {weekDays[6].toLocaleDateString("id-ID", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => {
                        const next = new Date(currentWeekStart);
                        next.setHours(12, 0, 0, 0);
                        next.setDate(next.getDate() + 7);
                        setCurrentWeekStart(next);
                      }}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                    >
                      Minggu Depan &raquo;
                    </button>
                  </div>

                  {/* Copy Schedule & Approval / Revision Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Master Shift Configuration Button for HRD / Manager */}
                    {isHRD && (
                      <button
                        type="button"
                        onClick={() => {
                          setShiftDefsForm(
                            settings?.shiftDefinitions && settings.shiftDefinitions.length > 0
                              ? settings.shiftDefinitions
                              : DEFAULT_SHIFT_DEFINITIONS
                          );
                          setShowShiftConfigModal(true);
                        }}
                        disabled={isReadOnly}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors shadow-2xs border border-brand-200"
                        title="Atur jam operasional, toleransi keterlambatan, dan daftar shift kedai"
                      >
                        <SettingsIcon className="w-3.5 h-3.5 text-brand-600" />
                        <span>Atur Jam Shift</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCopyLastWeekSchedule}
                      disabled={isReadOnly}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs border border-slate-200"
                      title="Salin jadwal shift dari minggu lalu ke minggu yang sedang aktif"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Minggu Lalu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs border border-slate-200"
                      title="Cetak jadwal shift mingguan tim untuk ditempel di area barista/dapur"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Cetak Roster</span>
                    </button>

                    {/* Leader Submit Button when not approved */}
                    {isLeader && !isWeekApproved && (
                      <button
                        type="button"
                        onClick={handleSubmitSchedule}
                        disabled={isReadOnly}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
                          isWeekPending
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : "bg-brand-600 hover:bg-brand-700 text-white"
                        }`}
                        title="Ajukan jadwal shift tim minggu ini kepada Manajer untuk disahkan"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isWeekPending ? "Perbarui Pengajuan" : "Ajukan ke Manajer"}</span>
                      </button>
                    )}

                    {/* Manager Approval & Revision Buttons */}
                    {isHRD && (
                      <div className="flex flex-wrap items-center gap-2">
                        {isWeekPending && !isWeekApproved && (
                          <button
                            type="button"
                            onClick={handleRejectToDraft}
                            disabled={isReadOnly}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                            title="Kembalikan jadwal ke Leader untuk direvisi"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Minta Revisi</span>
                          </button>
                        )}
                        {isWeekApproved && (
                          <button
                            type="button"
                            onClick={handleOpenApproveModal}
                            disabled={isReadOnly}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors shadow-2xs"
                            title="Edit arahan brief yang tampil di Dashboard Karyawan"
                          >
                            <Megaphone className="w-3.5 h-3.5 text-brand-600" />
                            <span>Edit Brief Mingguan</span>
                          </button>
                        )}
                        <button
                          onClick={handleToggleWeekApproval}
                          disabled={isReadOnly}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
                            isWeekApproved
                              ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          {isWeekApproved ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Buka Kunci (Revisi Draft)</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isWeekPending ? "Sahkan & Setujui Jadwal" : "Setujui Jadwal (Approve)"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Leader: Tombol Buka Kunci jika Jadwal APPROVED */}
                    {isLeader && isWeekApproved && (
                      <button
                        type="button"
                        onClick={handleUnlockForRevision}
                        disabled={isReadOnly}
                        className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-xs"
                        title="Buka status kunci untuk menyusun revisi shift tim"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Buka Kunci (Revisi)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Division Filter Tabs for Leader & Manager */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Divisi:
                </span>
                {isLeader ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleDivisionFilter(leaderDivision)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scheduleDivisionFilter === leaderDivision
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {leaderDivision === "BAR" ? "☕ Tim Bar & Kasir (Bisa Diedit)" : leaderDivision === "KITCHEN" ? "🍳 Tim Kitchen (Bisa Diedit)" : "🥐 Tim Baker (Bisa Diedit)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleDivisionFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scheduleDivisionFilter === "ALL"
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      👁️ Semua Tim (Tinjau / Hanya Baca)
                    </button>
                  </div>
                ) : (
                  [
                    { id: "ALL", label: "Semua Divisi" },
                    { id: "BAR", label: "☕ Bar & Kasir" },
                    { id: "KITCHEN", label: "🍳 Kitchen" },
                    { id: "BAKER", label: "🥐 Baker" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setScheduleDivisionFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scheduleDivisionFilter === tab.id
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))
                )}
              </div>

              {/* Scope Notice */}
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
                <Info className="w-4 h-4 text-brand-500 shrink-0" />
                <span>
                  Jadwal shift mingguan berlaku untuk tim operasional (<strong>Bar, Kasir, Kitchen, Baker</strong>). Staf manajemen dan kantor (Manager, Finance, HRD, Admin) bertugas dengan jam kantor reguler.
                </span>
              </div>

              {/* ─── SMART COLLISION DETECTION PANEL ─── */}
              {scheduleCollisions.length > 0 ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold mb-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Perhatian Evaluasi Jadwal: Terdeteksi {scheduleCollisions.length} Potensi Bentrok / Jam Kosong</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {scheduleCollisions.map((col) => (
                      <div
                        key={col.id}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                          col.severity === "high"
                            ? "bg-rose-50/80 border-rose-200 text-rose-900"
                            : "bg-amber-50 border-amber-200 text-amber-900"
                        }`}
                      >
                        <span className="shrink-0 mt-0.5">
                          {col.type === "clopen" ? "⏱️" : col.type === "understaffed" ? "👥" : "🛌"}
                        </span>
                        <div className="leading-relaxed">
                          <p className="font-semibold">{col.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Jadwal Terstruktur Rapi: Tidak terdeteksi tabrakan shift (clopen), shift kosong, atau staf kurang libur.</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Siap Operasional</span>
                </div>
              )}

              {/* Legend & Guide */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-bold text-slate-700">Keterangan Shift:</span>
                  {activeShiftDefs.map((def) => {
                    const dotClass =
                      def.color === "emerald"
                        ? "bg-emerald-500"
                        : def.color === "blue"
                        ? "bg-brand-500"
                        : def.color === "amber"
                        ? "bg-amber-500"
                        : def.color === "purple"
                        ? "bg-purple-500"
                        : "bg-brand-500";
                    return (
                      <span key={def.id} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${dotClass} inline-block`} />
                        <strong>{def.name}:</strong> {def.startTime} – {def.endTime}
                      </span>
                    );
                  })}
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                    <strong>OFF:</strong> Libur
                  </span>
                </div>
                {isLeader && isWeekApproved && (
                  <span className="text-amber-700 font-medium text-[11px] flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <span>🔒 Status telah disetujui Manajer. Anda tetap dapat mengubah shift tim; perubahan akan otomatis memindahkan status ke DRAFT agar dapat ditinjau ulang oleh Manajer.</span>
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                      <th className="py-3.5 px-4 sticky left-0 bg-slate-50 z-10 w-52 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]">
                        Karyawan & Divisi
                      </th>
                      {weekDays.map((d, idx) => (
                        <th key={idx} className="py-3 px-3 text-center border-l border-slate-200">
                          <div className="text-[11px] text-slate-500">{d.toLocaleDateString("id-ID", { weekday: "short" })}</div>
                          <div className="text-sm font-black text-slate-800">{d.getDate()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredScheduleEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                          Tidak ada karyawan aktif pada divisi ini.
                        </td>
                      </tr>
                    ) : (
                      filteredScheduleEmployees.map((emp) => {
                        const canEditThisEmp = canEditShiftForEmployee(emp);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]">
                              <p className="font-bold text-slate-800 truncate">{emp.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                                  {getEmployeeDivision(emp) === "BAR" ? "BAR & KASIR" : getEmployeeDivision(emp)}
                                </span>
                                {!canEditThisEmp && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-slate-200/80 text-slate-600">
                                    Hanya Baca
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400 truncate">{emp.position}</span>
                              </div>
                            </td>
                            {weekDays.map((d, idx) => {
                              const dateStr = getLocalDateString(d);
                              const shift = employeeShifts.find(s => s.employeeId === emp.id && s.date === dateStr)?.shiftType || "OFF";
                              return (
                                <td key={idx} className="p-2 border-l border-slate-100 text-center">
                                  {(() => {
                                    const activeDef = activeShiftDefs.find((d) => d.id === shift);
                                    let badgeColor = "bg-slate-100 text-slate-500 border-slate-200";
                                    if (activeDef) {
                                      if (activeDef.color === "emerald" || shift === "PAGI") {
                                        badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";
                                      } else if (activeDef.color === "blue" || shift === "MIDDLE") {
                                        badgeColor = "bg-brand-50 text-brand-800 border-brand-300";
                                      } else if (activeDef.color === "amber" || shift === "SORE") {
                                        badgeColor = "bg-amber-50 text-amber-800 border-amber-300";
                                      } else if (activeDef.color === "purple") {
                                        badgeColor = "bg-purple-50 text-purple-800 border-purple-300";
                                      } else {
                                        badgeColor = "bg-brand-50 text-brand-800 border-brand-300";
                                      }
                                    }
                                    return (
                                      <CustomSelect
                                        disabled={!canEditThisEmp}
                                        value={shift}
                                        onChange={(val) => handleShiftChange(emp.id, dateStr, val)}
                                        title={
                                          !canEditThisEmp
                                            ? (isWeekApproved
                                                ? "Jadwal telah disetujui Manajer (Terkunci). Klik 'Buka Kunci (Revisi)' untuk mengedit."
                                                : isLeader
                                                  ? "Hanya dapat mengedit jadwal tim divisi Anda sendiri"
                                                  : "Hanya Baca")
                                            : "Pilih shift kerja"
                                        }
                                        options={[
                                          { value: "OFF", label: "OFF (Libur)" },
                                          ...activeShiftDefs.map((def) => ({
                                            value: def.id,
                                            label: `${def.name} (${def.startTime.slice(0, 5)} - ${def.endTime.slice(0, 5)})`,
                                          })),
                                        ]}
                                        buttonClassName={`w-full text-xs font-bold py-1.5 px-2 rounded-xl border ${
                                          !canEditThisEmp ? "opacity-80 bg-slate-50" : ""
                                        } ${badgeColor}`}
                                      />
                                    );
                                  })()}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "kpi" && (
            <div>
              <KPI />
            </div>
          )}

          {activeTab === "attendance" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {isIndo
                      ? "Rekap Absensi Bulanan"
                      : "Monthly Attendance Recap"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isIndo
                      ? `Otomatis terhitung dari presensi harian periode ${attendanceRecapPeriod} (termasuk koreksi Manager).`
                      : `Automatically aggregated from daily attendance for ${attendanceRecapPeriod}.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <CustomMonthPicker
                    value={attendanceRecapPeriod}
                    onChange={(val) => {
                      if (val) setAttendanceRecapPeriod(val);
                    }}
                    allowClear={false}
                    placeholder="Pilih Periode Rekap"
                    buttonClassName="py-2 px-3 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                  <CsvImportExport
                    onImport={handleImportAttendances}
                    canImport={canEditHR}
                    requiredHeaders={["Username", "Periode (YYYY-MM)"]}
                    exportFilename={`Rekap_Absensi_${attendanceRecapPeriod || getLocalPeriodString()}`}
                    exportTitle={`Rekap Absensi Bulanan (${attendanceRecapPeriod || getLocalPeriodString()})`}
                    templateHeaders={["Username", "Periode (YYYY-MM)", "Hadir", "Sakit", "Izin", "Alpha", "Libur", "Hari Kerja", "Catatan"]}
                    templateExampleRow={[employees[0]?.username || "EMP-001", getLocalPeriodString(), "24", "1", "0", "0", "4", "26", "Disiplin baik"]}
                    currentData={attendances
                      .filter(a => !attendanceRecapPeriod || a.period === attendanceRecapPeriod)
                      .map(a => {
                        const emp = employees.find(e => e.id === a.employeeId);
                        return {
                          id: a.id,
                          "Username": emp?.username || "",
                          "Periode (YYYY-MM)": a.period,
                          "Hadir": a.presentDays,
                          "Sakit": a.sickDays,
                          "Izin": a.permissionDays,
                          "Alpha": a.alphaDays,
                          "Libur": a.holidayDays,
                          "Hari Kerja": a.workingDays,
                          "Catatan": a.notes || "",
                        };
                      })}
                    templateFilename="template_absensi"
                    buttonLabel={canEditHR ? (isIndo ? "Impor / Ekspor" : "Import / Export") : (isIndo ? "Ekspor Data" : "Export Data")}
                    templateDropdowns={{
                      Username: employees.map(e => e.username).filter(Boolean),
                    }}
                    templateColumnTypes={{
                      Hadir: "integer",
                      Sakit: "integer",
                      Izin: "integer",
                      Alpha: "integer",
                      Libur: "integer",
                      "Hari Kerja": "integer",
                    }}
                    templateFormats={{
                      Username: "text",
                      "Periode (YYYY-MM)": "text",
                    }}
                    templateHints={{
                      Username: "Pilih username karyawan",
                      "Periode (YYYY-MM)": `Format: YYYY-MM (contoh: ${getLocalPeriodString()})`,
                    }}
                  />
                  {canEditHR && (
                    <button
                      onClick={() => handleOpenAttendanceModal()}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-brand-600/20 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> {isIndo ? "Tambah Absensi" : "Add Attendance"}
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-coffee-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4 font-bold">
                        {isIndo ? "Karyawan" : "Employee"}
                      </th>
                      <th className="py-3 px-4 font-bold">Periode</th>
                      <th className="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-300 text-center">
                        Hadir
                      </th>
                      <th className="py-3 px-4 font-bold text-amber-700 dark:text-amber-300 text-center">
                        Terlambat
                      </th>
                      <th className="py-3 px-4 font-bold text-sky-700 dark:text-sky-300 text-center">
                        Izin/Sakit
                      </th>
                      <th className="py-3 px-4 font-bold text-rose-700 dark:text-rose-300 text-center">
                        Alpha
                      </th>
                      <th className="py-3 px-4 font-bold text-right">
                        Total Jam &amp; Lembur
                      </th>
                      <th className="py-3 px-4 font-bold text-right">
                        Koreksi / Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRecapRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400 italic text-xs">
                          {isIndo
                            ? `Belum ada data absensi untuk periode ${attendanceRecapPeriod}.`
                            : `No attendance data for ${attendanceRecapPeriod}.`}
                        </td>
                      </tr>
                    ) : (
                      monthlyRecapRows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs"
                        >
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                              {row.employeeName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {row.employeePosition}
                            </p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {row.period}
                            </span>
                            {row.source === "MANUAL" && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Manual
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {row.presentDays}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            {row.lateDays}x
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                            {row.sickDays + row.permissionDays}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                            {row.alphaDays}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                            {row.source === "MANUAL" ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                  {row.totalWorkHours.toFixed(1)} Jam
                                </span>
                                {row.approvedOvertimeHours > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-500/30">
                                    +{row.approvedOvertimeHours.toFixed(1)}j Lembur
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {row.correctedCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30 tabular-nums">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {row.correctedCount} dikoreksi
                                </span>
                              )}
                              {row.pendingCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 tabular-nums">
                                  <Clock className="w-3 h-3" />
                                  {row.pendingCount} menunggu
                                </span>
                              )}
                              {row.source === "MANUAL" && canEditHR && row.manualRecordId && (() => {
                                const targetManual = attendances.find((rec) => rec.id === row.manualRecordId);
                                if (!targetManual) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAttendanceModal(targetManual)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" /> Edit
                                  </button>
                                );
                              })()}
                              {row.correctedCount === 0 && row.pendingCount === 0 && row.source === "DAILY" && (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Daily Attendances for Manager */}
              <div className="mt-12 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                        {isIndo ? "Pemantauan Kehadiran Lapangan & Foto GPS" : "Field Attendance Log & GPS Photo Verification"}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {isIndo
                        ? "Verifikasi foto selfie dan lokasi GPS saat karyawan melakukan Clock In & Out untuk memastikan kehadiran fisik di outlet."
                        : "Verify employee selfie photos and GPS coordinates on Clock In & Out to confirm physical presence on site."}
                    </p>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <CustomDatePicker
                      value={attendanceDateFilter}
                      onChange={(val) => {
                        setAttendanceDateFilter(val);
                        if (val && val.length >= 7) {
                          setAttendanceRecapPeriod(val.substring(0, 7));
                        }
                      }}
                      placeholder="Semua Tanggal"
                      allowClear={true}
                      buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200"
                    />

                    <CustomSelect
                      value={attendanceEmpFilter}
                      onChange={setAttendanceEmpFilter}
                      options={[
                        { value: "ALL", label: "Semua Karyawan" },
                        ...employees.map((emp) => ({
                          value: emp.id,
                          label: `${emp.name} (${emp.position})`,
                        })),
                      ]}
                      buttonClassName="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"
                    />

                    <CustomSelect
                      value={attendanceApprovalFilter}
                      onChange={setAttendanceApprovalFilter}
                      options={[
                        { value: "ALL", label: "Semua Verifikasi" },
                        { value: "PENDING", label: "⏳ Menunggu Verifikasi" },
                        { value: "APPROVED", label: "✓ Disahkan (Approved)" },
                        { value: "REJECTED", label: "✕ Ditolak (Rejected)" },
                        { value: "FORGOTTEN_CLOCKOUT", label: "⚠️ Lupa Clock Out" },
                        { value: "CORRECTED", label: "✏️ Sudah Dikoreksi" },
                      ]}
                      buttonClassName="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"
                    />

                    <button
                      onClick={() => {
                        const today = getLocalDateString();
                        setAttendanceDateFilter(today);
                        setAttendanceRecapPeriod(today.substring(0, 7));
                      }}
                      className="px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hari Ini
                    </button>
                  </div>
                </div>

                {/* Bulk Actions Bar if items selected */}
                {selectedAttIds.length > 0 && canEditHR && (
                  <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-brand-900 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-brand-600" />
                      <strong>{selectedAttIds.length}</strong> catatan kehadiran dipilih
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBulkApprove()}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Sahkan Terpilih ({selectedAttIds.length})
                      </button>
                      <button
                        onClick={() => setSelectedAttIds([])}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                        {canEditHR && (
                          <th className="py-3 px-3 text-center w-10">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                              title="Pilih Semua yang Ditampilkan"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttIds(filteredDailyAttendances.map((d) => d.id));
                                } else {
                                  setSelectedAttIds([]);
                                }
                              }}
                              checked={
                                filteredDailyAttendances.length > 0 &&
                                filteredDailyAttendances.every((d) => selectedAttIds.includes(d.id))
                              }
                            />
                          </th>
                        )}
                        <th className="py-3 px-4 font-bold">Tanggal</th>
                        <th className="py-3 px-4 font-bold">Karyawan</th>
                        <th className="py-3 px-4 font-bold">Status & Verifikasi</th>
                        <th className="py-3 px-4 font-bold">Foto Selfie (In / Out)</th>
                        <th className="py-3 px-4 font-bold">Lokasi GPS</th>
                        <th className="py-3 px-4 font-bold">Jam In / Out</th>
                        <th className="py-3 px-4 font-bold">Durasi</th>
                        <th className="py-3 px-4 font-bold text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>Verifikasi Manager</span>
                            {canEditHR && (() => {
                              const pendingItems = filteredDailyAttendances.filter((d) => {
                                const appStatus = d.approvalStatus || "PENDING";
                                return appStatus === "PENDING" && d.status !== "ALPHA";
                              });
                              if (pendingItems.length > 0) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAllPending(pendingItems)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                                    title="Setujui sekaligus semua absensi pending yang tampil"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Setujui Semua ({pendingItems.length})</span>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = filteredDailyAttendances;

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={canEditHR ? 9 : 8} className="py-12 text-center text-slate-400 italic text-sm">
                                Tidak ada catatan kehadiran sesuai filter yang dipilih.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((d) => {
                          const emp = employees.find((e) => e.id === d.employeeId);
                          const isSelected = selectedAttIds.includes(d.id);
                          const currentApproval = d.approvalStatus || "PENDING";

                          return (
                            <tr key={d.id} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-xs ${isSelected ? "bg-brand-50/40" : ""}`}>
                              {canEditHR && (
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedAttIds([...selectedAttIds, d.id]);
                                      } else {
                                        setSelectedAttIds(selectedAttIds.filter((id) => id !== d.id));
                                      }
                                    }}
                                  />
                                </td>
                              )}
                              <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
                                {d.date}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs shrink-0">
                                    {emp?.name ? emp.name.charAt(0).toUpperCase() : "U"}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 leading-tight">
                                      {emp?.name || getEmployeeName(d.employeeId)}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-medium">
                                      {emp?.position || "Staff"} • {emp?.department || "-"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                                    d.status === "HADIR" ? "bg-emerald-100 text-emerald-800" :
                                    d.status === "TERLAMBAT" ? "bg-amber-100 text-amber-800" :
                                    d.status === "IZIN" ? "bg-brand-100 text-brand-800" :
                                    d.status === "SAKIT" ? "bg-rose-100 text-rose-800" :
                                    "bg-slate-200 text-slate-700"
                                  }`}>
                                    {d.status}
                                  </span>
                                  {currentApproval === "APPROVED" ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Disahkan
                                    </span>
                                  ) : currentApproval === "REJECTED" ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-full">
                                      <X className="w-3 h-3 text-rose-600" /> Ditolak
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3 text-amber-600" /> Menunggu
                                    </span>
                                  )}
                                  {!d.clockOutTime && d.date < todayStr && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Lupa Clock Out
                                    </span>
                                  )}
                                  {d.isCorrected && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full"
                                      title={d.correctionReason ? `Alasan: ${d.correctionReason} (oleh ${d.correctedBy || "Manager"})` : "Telah dikoreksi Manager"}
                                    >
                                      <Sparkles className="w-3 h-3 text-brand-600" /> Dikoreksi ({d.correctedBy || "Manager"})
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* Foto Bukti In & Out */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {d.clockInPhotoUrl ? (
                                    <div
                                      onClick={() => { setVerifyingAttendance(d); setIsVerificationModalOpen(true); }}
                                      className="relative group cursor-pointer"
                                      title="Klik untuk zoom foto Clock In"
                                    >
                                      <img
                                        src={d.clockInPhotoUrl}
                                        alt="Clock In"
                                        className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-400 shadow-2xs group-hover:scale-105 transition-transform"
                                      />
                                      <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold px-1 rounded-sm">
                                        IN
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-[10px] text-slate-400">
                                      <Camera className="w-3.5 h-3.5 text-slate-300" />
                                      <span>In</span>
                                    </div>
                                  )}

                                  {d.clockOutPhotoUrl ? (
                                    <div
                                      onClick={() => { setVerifyingAttendance(d); setIsVerificationModalOpen(true); }}
                                      className="relative group cursor-pointer"
                                      title="Klik untuk zoom foto Clock Out"
                                    >
                                      <img
                                        src={d.clockOutPhotoUrl}
                                        alt="Clock Out"
                                        className="w-10 h-10 rounded-lg object-cover border-2 border-rose-400 shadow-2xs group-hover:scale-105 transition-transform"
                                      />
                                      <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[9px] font-bold px-1 rounded-sm">
                                        OUT
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-[10px] text-slate-400">
                                      <Camera className="w-3.5 h-3.5 text-slate-300" />
                                      <span>Out</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              {/* Lokasi GPS */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  {d.clockInLocation ? (
                                    <a
                                      href={`https://maps.google.com/?q=${d.clockInLocation.lat},${d.clockInLocation.lng}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200/60 w-fit"
                                      title={`Koordinat: ${d.clockInLocation.lat.toFixed(5)}, ${d.clockInLocation.lng.toFixed(5)}`}
                                    >
                                      <MapPin className="w-3 h-3 text-emerald-600" />
                                      GPS Masuk ↗
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">GPS Masuk: Tidak ada</span>
                                  )}

                                  {d.clockOutLocation ? (
                                    <a
                                      href={`https://maps.google.com/?q=${d.clockOutLocation.lat},${d.clockOutLocation.lng}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200/60 w-fit"
                                      title={`Koordinat: ${d.clockOutLocation.lat.toFixed(5)}, ${d.clockOutLocation.lng.toFixed(5)}`}
                                    >
                                      <MapPin className="w-3 h-3 text-rose-600" />
                                      GPS Pulang ↗
                                    </a>
                                  ) : null}
                                </div>
                              </td>
                              {/* Jam In / Out */}
                              <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-700">
                                {d.clockInTime ? formatWitaTimeHm(d.clockInTime, DEFAULT_STORE_TIMEZONE) : "-"}
                                {" - "}
                                {d.clockOutTime ? formatWitaTimeHm(d.clockOutTime, DEFAULT_STORE_TIMEZONE) : "-"}
                              </td>
                                {/* Durasi */}
                                <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap tabular-nums">
                                  {(() => {
                                    const cls = classifyDailyAttendanceStatus(d);
                                    if (cls !== "HADIR" && cls !== "TERLAMBAT") return "-";
                                    const dur = calculateWorkDurationHours(d.clockInTime, d.clockOutTime);
                                    return dur > 0 ? `${dur.toFixed(1)} Jam` : "-";
                                  })()}
                                </td>
                              {/* Aksi & Verifikasi */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canEditHR && currentApproval !== "APPROVED" && d.status !== "ALPHA" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const closedErr = getClosedAttendanceError([d.date]);
                                        if (closedErr) {
                                          toast.error(closedErr);
                                          return;
                                        }
                                        updateDailyAttendance({ ...d, approvalStatus: "APPROVED" });
                                        toast.success(`Kehadiran ${emp?.name || getEmployeeName(d.employeeId)} disahkan.`);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                                      title="Langsung sahkan / setujui kehadiran ini dengan 1 klik"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Sahkan</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVerifyingAttendance(d);
                                      setIsVerificationModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                                    title="Lihat foto besar dan peta lokasi GPS lengkap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Bukti & Peta</span>
                                  </button>

                                  {canEditHR && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const closedErr = getClosedAttendanceError([d.date]);
                                        if (closedErr) {
                                          toast.error(closedErr);
                                          return;
                                        }
                                        handleOpenCorrectionModal(d);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                                      title="Koreksi jam masuk/pulang atau status kehadiran (dicatat di Audit Log)"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Koreksi</span>
                                    </button>
                                  )}

                                  {canEditHR && d.approvalStatus !== "REJECTED" && d.status !== "ALPHA" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const closedErr = getClosedAttendanceError([d.date]);
                                        if (closedErr) {
                                          toast.error(closedErr);
                                          return;
                                        }
                                        confirmModal.open({
                                          title: "Tolak Kehadiran (Set ALPHA)",
                                          message: `Tolak kehadiran ${emp?.name || getEmployeeName(d.employeeId)} dan ubah status menjadi ALPHA?`,
                                          variant: "danger",
                                          confirmLabel: "Ya, Tolak & Set ALPHA",
                                          onConfirm: () => {
                                            updateDailyAttendance({ ...d, status: "ALPHA", approvalStatus: "REJECTED" });
                                            toast.warning(`Kehadiran ${emp?.name || getEmployeeName(d.employeeId)} ditolak (ALPHA).`);
                                          },
                                        });
                                      }}
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                      title="Tolak kehadiran jika terbukti tidak hadir di lapangan"
                                    >
                                      Tolak
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAYROLL TAB */}
          {activeTab === "payroll" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Payroll />
            </motion.div>
          )}
        </div>

      {/* Modals */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isEmployeeModalOpen && (
              <motion.div
                key="hr-emp-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() => setIsEmployeeModalOpen(false)}
                className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 flex justify-center items-start sm:items-center"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/80 flex flex-col max-h-[85vh] sm:max-h-[88vh] my-auto"
                >
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-brand-600" />
                {editingEmployee ? (isIndo ? "Edit Karyawan" : "Edit Employee") : (isIndo ? "Tambah Karyawan" : "Add Employee")}
              </h3>
              <button 
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-200/60"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Tab Bar */}
            <div className="px-5 pt-3 pb-1 bg-white shrink-0">
              <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setEmpModalTab("basic")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    empModalTab === "basic"
                      ? "bg-white text-brand-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Data Utama
                </button>
                <button
                  type="button"
                  onClick={() => setEmpModalTab("contact")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    empModalTab === "contact"
                      ? "bg-white text-brand-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Kontak & Domisili
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
              {empModalTab === "basic" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                        Nama Lengkap <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.name} 
                        onChange={e => setEmpForm({...empForm, name: e.target.value})} 
                        placeholder="Contoh: Budi"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                        Username <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.username} 
                        onChange={e => setEmpForm({...empForm, username: e.target.value})} 
                        placeholder="Contoh: budi"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Departemen</label>
                      <CustomSelect
                        value={empForm.department}
                        onChange={(val) => setEmpForm({ ...empForm, department: val })}
                        placeholder="-- Pilih --"
                        options={[
                          { value: "", label: "-- Pilih --" },
                          { value: "MAIN", label: "Utama (Main)" },
                          { value: "BAR", label: "Bar" },
                          { value: "KITCHEN", label: "Dapur (Kitchen)" },
                          { value: "BAKER", label: "Baker (Roti)" },
                          { value: "MANAGEMENT", label: "Manajemen & Kantor" },
                          { value: "FINANCE", label: "Keuangan (Finance)" },
                        ]}
                        buttonClassName="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Jabatan</label>
                      <CustomSelect
                        value={empForm.position}
                        onChange={(val) => setEmpForm({ ...empForm, position: val })}
                        placeholder="-- Pilih --"
                        options={[
                          { value: "", label: "-- Pilih --" },
                          { value: "Kasir", label: "Kasir" },
                          { value: "Karyawan", label: "Karyawan (Staff)" },
                          { value: "Leader", label: "Leader" },
                          ...(currentUser?.role !== "MANAGER"
                            ? [
                                { value: "Finance", label: "Finance / Staf Keuangan" },
                                { value: "Manager", label: "Manager" },
                              ]
                            : []),
                        ]}
                        buttonClassName="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Status</label>
                      <CustomSelect
                        value={empForm.status}
                        onChange={(val) => setEmpForm({ ...empForm, status: val as any })}
                        options={[
                          { value: "AKTIF", label: "Aktif" },
                          { value: "TIDAK_AKTIF", label: "Tidak Aktif" },
                          { value: "RESIGN", label: "Resign" },
                          { value: "PHK", label: "PHK" },
                        ]}
                        buttonClassName="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Tipe</label>
                      <CustomSelect
                        value={empForm.employmentType}
                        onChange={(val) => setEmpForm({ ...empForm, employmentType: val as any })}
                        options={[
                          { value: "TETAP", label: "Tetap" },
                          { value: "KONTRAK", label: "Kontrak" },
                          { value: "PARUH_WAKTU", label: "Paruh Waktu" },
                          { value: "MAGANG", label: "Magang" },
                        ]}
                        buttonClassName="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:bg-white"
                      />
                    </div>
                  </div>

                  {!editingEmployee && (
                    <div className="p-2.5 bg-brand-50/70 rounded-xl border border-brand-100">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={autoCreateUser}
                          onChange={(e) => setAutoCreateUser(e.target.checked)}
                          className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                        />
                        <span className="text-xs font-bold text-brand-950">Buat Akun Login Otomatis</span>
                      </label>
                      {autoCreateUser && (
                        <p className="text-[11px] text-brand-700 mt-1 ml-6 leading-relaxed">
                          Username: <strong className="font-semibold text-brand-900">{empForm.username || "[Username]"}</strong>, PIN default: <strong className="font-semibold text-brand-900">123456</strong>
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">No. HP / WhatsApp</label>
                      <input 
                        type="text" 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.phone} 
                        onChange={e => setEmpForm({...empForm, phone: e.target.value})} 
                        placeholder="08123456789" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Email</label>
                      <input 
                        type="email" 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.email} 
                        onChange={e => setEmpForm({...empForm, email: e.target.value})} 
                        placeholder="email@contoh.com" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Alamat Domisili</label>
                    <textarea 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none text-sm resize-none h-20 transition-all" 
                      value={empForm.address} 
                      onChange={e => setEmpForm({...empForm, address: e.target.value})} 
                      placeholder="Alamat domisili lengkap..." 
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2.5 shrink-0">
              <button 
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)} 
                className="px-4 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSaveEmployee} 
                className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm shadow-xs transition-colors cursor-pointer"
              >
                Simpan
              </button>
            </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isContractModalOpen && (
              <motion.div
                key="hr-contract-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() => setIsContractModalOpen(false)}
                className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-200/80 dark:border-slate-700/80"
                >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                {editingContract ? "Edit Kontrak" : "Tambah Kontrak"}
              </h3>
              <button onClick={() => setIsContractModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Karyawan</label>
                <CustomSelect
                  value={contractForm.employeeId}
                  onChange={(val) => setContractForm({ ...contractForm, employeeId: val })}
                  placeholder="Pilih Karyawan"
                  options={[
                    { value: "", label: "Pilih Karyawan" },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: emp.name,
                    })),
                  ]}
                  buttonClassName="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gaji Pokok (Rp)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.basicSalary || ""} onChange={e => setContractForm({...contractForm, basicSalary: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tnj. Jabatan</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.positionAllowance || ""} onChange={e => setContractForm({...contractForm, positionAllowance: Number(e.target.value)})} />
                  <p className="text-[11px] text-brand-600 font-medium mt-1">
                    👑 Khusus Leader: Dicairkan otomatis bertingkat (Grade A-D) berbasis capaian jobdesk & supervisi shift.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tnj. Makan</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.mealAllowance || ""} onChange={e => setContractForm({...contractForm, mealAllowance: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tnj. Transport</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.transportAllowance || ""} onChange={e => setContractForm({...contractForm, transportAllowance: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tgl Mulai</label>
                  <CustomDatePicker
                    value={contractForm.startDate}
                    onChange={(val) => setContractForm({ ...contractForm, startDate: val })}
                    placeholder="Pilih Tanggal Mulai"
                    allowClear={false}
                    buttonClassName="w-full px-3 py-2 border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tgl Berakhir (Kosongkan jika tetap)</label>
                  <CustomDatePicker
                    value={contractForm.endDate || ""}
                    onChange={(val) => setContractForm({ ...contractForm, endDate: val })}
                    placeholder="Pilih Tanggal Selesai"
                    allowClear={true}
                    buttonClassName="w-full px-3 py-2 border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 shrink-0">
              <button onClick={() => setIsContractModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Batal</button>
              <button onClick={handleSaveContract} className="px-5 py-2 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-xs cursor-pointer">Simpan</button>
            </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      </div>

      {/* Verification Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isVerificationModalOpen && verifyingAttendance && (() => {
              const emp = employees.find((e) => e.id === verifyingAttendance.employeeId);
              return (
                <motion.div
                  key="hr-verification-modal-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => setIsVerificationModalOpen(false)}
                  className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col border border-slate-100 dark:border-slate-700/80 my-auto"
                  >
            {/* Header */}
            <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-start sm:items-center bg-slate-50/80 z-10 shrink-0 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                  {emp?.name ? emp.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                      {emp?.name || getEmployeeName(verifyingAttendance.employeeId)}
                    </h3>
                    <span className={`px-2 py-0.5 text-[11px] sm:text-xs font-bold rounded-full ${
                      verifyingAttendance.status === 'HADIR' ? 'bg-emerald-100 text-emerald-800' :
                      verifyingAttendance.status === 'TERLAMBAT' ? 'bg-amber-100 text-amber-800' :
                      verifyingAttendance.status === 'ALPHA' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {verifyingAttendance.status}
                    </span>
                    {verifyingAttendance.approvalStatus && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                        verifyingAttendance.approvalStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        verifyingAttendance.approvalStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {verifyingAttendance.approvalStatus === 'APPROVED' ? 'Terverifikasi Sah' :
                         verifyingAttendance.approvalStatus === 'REJECTED' ? 'Ditolak' : 'Menunggu Review'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {emp?.position || 'Staff'} • {emp?.department || 'Main'} | Tanggal: <span className="font-bold text-slate-700">{verifyingAttendance.date}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsVerificationModalOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 bg-slate-50/30">
              {/* Petunjuk Untuk Manager */}
              <div className="p-3.5 bg-brand-50/80 border border-brand-200/70 rounded-xl flex items-start gap-3 text-xs text-brand-900">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Validasi Kehadiran Fisik Lapangan</p>
                  <p className="text-brand-700/90 mt-0.5">
                    Pastikan foto selfie diambil langsung di lokasi outlet coffee shop dan titik lokasi GPS peta sesuai dengan area operasional sebelum melakukan persetujuan.
                  </p>
                </div>
              </div>

              {/* Grid 2 Kolom: Clock In vs Clock Out */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Clock In Card */}
                <div className="border border-slate-200/80 rounded-2xl p-5 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          IN
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Clock In (Masuk)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono tabular-nums font-bold text-emerald-700 text-base">
                          {verifyingAttendance.clockInTime
                            ? new Date(verifyingAttendance.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: DEFAULT_STORE_TIMEZONE })
                            : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Foto Selfie In */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-slate-400" /> Foto Selfie Masuk
                        </span>
                        {verifyingAttendance.clockInPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxPhoto({
                              url: verifyingAttendance.clockInPhotoUrl,
                              title: `Foto Selfie Masuk - ${emp?.name || getEmployeeName(verifyingAttendance.employeeId)}`,
                              subtitle: `${verifyingAttendance.date} • Pukul ${verifyingAttendance.clockInTime ? formatWitaTimeHm(verifyingAttendance.clockInTime, DEFAULT_STORE_TIMEZONE) : '-'} WITA`
                            })}
                            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Buka Foto Penuh ↗</span>
                          </button>
                        )}
                      </div>
                      {verifyingAttendance.clockInPhotoUrl ? (
                        <div 
                          onClick={() => setLightboxPhoto({
                            url: verifyingAttendance.clockInPhotoUrl,
                            title: `Foto Selfie Masuk - ${emp?.name || getEmployeeName(verifyingAttendance.employeeId)}`,
                            subtitle: `${verifyingAttendance.date} • Pukul ${verifyingAttendance.clockInTime ? formatWitaTimeHm(verifyingAttendance.clockInTime, DEFAULT_STORE_TIMEZONE) : '-'} WITA`
                          })}
                          className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 group shadow-inner cursor-pointer"
                          title="Klik untuk melihat foto ukuran penuh"
                        >
                          <img 
                            src={verifyingAttendance.clockInPhotoUrl} 
                            alt="Foto Clock In" 
                            className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-102" 
                          />
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Camera className="w-3 h-3" />
                            <span>Kamera Selfie • Tap untuk Perbesar</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-52 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                          <Camera className="w-8 h-8 text-slate-300" />
                          <span>Tidak ada foto selfie tersimpan</span>
                        </div>
                      )}
                    </div>

                    {/* Peta GPS In */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> Lokasi Titik GPS Masuk
                        </span>
                        {verifyingAttendance.clockInLocation && (
                          <a 
                            href={`https://maps.google.com/?q=${verifyingAttendance.clockInLocation.lat},${verifyingAttendance.clockInLocation.lng}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline"
                          >
                            Buka Google Maps ↗
                          </a>
                        )}
                      </div>

                      {verifyingAttendance.clockInLocation ? (
                        <div>
                          <div className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 mb-2 flex items-center justify-between">
                            <span>Lat: {verifyingAttendance.clockInLocation.lat.toFixed(5)}</span>
                            <span>Lng: {verifyingAttendance.clockInLocation.lng.toFixed(5)}</span>
                          </div>
                          <iframe
                            title="Peta Lokasi Clock In"
                            width="100%"
                            height="160"
                            className="rounded-xl border border-slate-200 shadow-inner"
                            loading="lazy"
                            src={`https://maps.google.com/maps?q=${verifyingAttendance.clockInLocation.lat},${verifyingAttendance.clockInLocation.lng}&hl=id&z=16&output=embed`}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                          Koordinat GPS tidak terekam
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clock Out Card */}
                <div className="border border-slate-200/80 rounded-2xl p-5 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                          OUT
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Clock Out (Pulang)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono tabular-nums font-bold text-rose-700 text-base">
                          {verifyingAttendance.clockOutTime
                            ? new Date(verifyingAttendance.clockOutTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: DEFAULT_STORE_TIMEZONE })
                            : 'Belum Pulang'}
                        </span>
                      </div>
                    </div>

                    {/* Foto Selfie Out */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-slate-400" /> Foto Selfie Pulang
                        </span>
                        {verifyingAttendance.clockOutPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxPhoto({
                              url: verifyingAttendance.clockOutPhotoUrl,
                              title: `Foto Selfie Pulang - ${emp?.name || getEmployeeName(verifyingAttendance.employeeId)}`,
                              subtitle: `${verifyingAttendance.date} • Pukul ${verifyingAttendance.clockOutTime ? formatWitaTimeHm(verifyingAttendance.clockOutTime, DEFAULT_STORE_TIMEZONE) : '-'} WITA`
                            })}
                            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Buka Foto Penuh ↗</span>
                          </button>
                        )}
                      </div>
                      {verifyingAttendance.clockOutPhotoUrl ? (
                        <div 
                          onClick={() => setLightboxPhoto({
                            url: verifyingAttendance.clockOutPhotoUrl,
                            title: `Foto Selfie Pulang - ${emp?.name || getEmployeeName(verifyingAttendance.employeeId)}`,
                            subtitle: `${verifyingAttendance.date} • Pukul ${verifyingAttendance.clockOutTime ? formatWitaTimeHm(verifyingAttendance.clockOutTime, DEFAULT_STORE_TIMEZONE) : '-'} WITA`
                          })}
                          className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 group shadow-inner cursor-pointer"
                          title="Klik untuk melihat foto ukuran penuh"
                        >
                          <img 
                            src={verifyingAttendance.clockOutPhotoUrl} 
                            alt="Foto Clock Out" 
                            className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-102" 
                          />
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Camera className="w-3 h-3" />
                            <span>Kamera Selfie • Tap untuk Perbesar</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-52 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                          <Camera className="w-8 h-8 text-slate-300" />
                          <span>{verifyingAttendance.clockOutTime ? 'Tidak ada foto selfie pulang' : 'Belum melakukan Clock Out'}</span>
                        </div>
                      )}
                    </div>

                    {/* Peta GPS Out */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> Lokasi Titik GPS Pulang
                        </span>
                        {verifyingAttendance.clockOutLocation && (
                          <a 
                            href={`https://maps.google.com/?q=${verifyingAttendance.clockOutLocation.lat},${verifyingAttendance.clockOutLocation.lng}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline"
                          >
                            Buka Google Maps ↗
                          </a>
                        )}
                      </div>

                      {verifyingAttendance.clockOutLocation ? (
                        <div>
                          <div className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 mb-2 flex items-center justify-between">
                            <span>Lat: {verifyingAttendance.clockOutLocation.lat.toFixed(5)}</span>
                            <span>Lng: {verifyingAttendance.clockOutLocation.lng.toFixed(5)}</span>
                          </div>
                          <iframe
                            title="Peta Lokasi Clock Out"
                            width="100%"
                            height="160"
                            className="rounded-xl border border-slate-200 shadow-inner"
                            loading="lazy"
                            src={`https://maps.google.com/maps?q=${verifyingAttendance.clockOutLocation.lat},${verifyingAttendance.clockOutLocation.lng}&hl=id&z=16&output=embed`}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                          {verifyingAttendance.clockOutTime ? 'Koordinat GPS pulang tidak terekam' : 'Belum ada data GPS pulang'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan Karyawan */}
              {verifyingAttendance.notes && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Catatan dari Karyawan:</h5>
                  <p className="text-sm text-slate-600 italic">"{verifyingAttendance.notes}"</p>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-800/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                type="button"
                onClick={() => setIsVerificationModalOpen(false)} 
                className="w-full sm:w-auto px-5 py-2.5 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-xl text-sm transition-colors text-center cursor-pointer"
              >
                Tutup
              </button>
              
              {canEditHR && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <button 
                    type="button"
                    onClick={() => {
                      const closedErr = getClosedAttendanceError([verifyingAttendance.date]);
                      if (closedErr) {
                        toast.error(closedErr);
                        return;
                      }
                      confirmModal.open({
                        title: "Tolak Kehadiran (Set ALPHA)",
                        message: "Tolak kehadiran ini? Status karyawan akan diubah menjadi ALPHA dan tunjangan/gaji akan disesuaikan.",
                        variant: "danger",
                        confirmLabel: "Ya, Tolak & Set ALPHA",
                        onConfirm: () => {
                          updateDailyAttendance({
                            ...verifyingAttendance,
                            approvalStatus: "REJECTED",
                            status: "ALPHA",
                          });
                          setIsVerificationModalOpen(false);
                          toast.warning("Kehadiran ditolak dan status diubah ke ALPHA.");
                        },
                      });
                    }} 
                    className="w-full sm:w-auto px-5 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl text-sm transition-colors text-center cursor-pointer"
                  >
                    Tolak (Set Alpha)
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const closedErr = getClosedAttendanceError([verifyingAttendance.date]);
                      if (closedErr) {
                        toast.error(closedErr);
                        return;
                      }
                      const isRejectedAlpha =
                        verifyingAttendance.approvalStatus === "REJECTED" &&
                        verifyingAttendance.status === "ALPHA";
                      updateDailyAttendance({
                        ...verifyingAttendance,
                        status: isRejectedAlpha ? "HADIR" : verifyingAttendance.status,
                        approvalStatus: "APPROVED",
                      });
                      setIsVerificationModalOpen(false);
                      toast.success("Kehadiran berhasil disahkan.");
                    }} 
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verifikasi Sah (Approve)</span>
                  </button>
                </div>
              )}
            </div>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>,
          document.body
        )}

      {/* Attendance Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isAttendanceModalOpen && (
              <motion.div
                key="hr-attendance-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() => setIsAttendanceModalOpen(false)}
                className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-200/80 dark:border-slate-700/80"
                >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                {editingAttendance ? (isIndo ? "Edit Absensi" : "Edit Attendance") : (isIndo ? "Tambah Absensi" : "Add Attendance")}
              </h3>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Karyawan</label>
                <CustomSelect
                  value={attendanceForm.employeeId}
                  onChange={(val) => setAttendanceForm({ ...attendanceForm, employeeId: val })}
                  placeholder="Pilih Karyawan"
                  options={[
                    { value: "", label: "Pilih Karyawan" },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: emp.name,
                    })),
                  ]}
                  buttonClassName="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Periode (Bulan & Tahun)</label>
                <CustomMonthPicker
                  value={attendanceForm.period}
                  onChange={(val) => setAttendanceForm({ ...attendanceForm, period: val })}
                  allowClear={false}
                  placeholder="Pilih Bulan & Tahun"
                  buttonClassName="w-full py-2 px-3 rounded-lg border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hadir (Hari)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={attendanceForm.presentDays || 0} onChange={e => setAttendanceForm({...attendanceForm, presentDays: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sakit (Hari)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={attendanceForm.sickDays || 0} onChange={e => setAttendanceForm({...attendanceForm, sickDays: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Izin (Hari)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={attendanceForm.permissionDays || 0} onChange={e => setAttendanceForm({...attendanceForm, permissionDays: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alpha (Hari)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={attendanceForm.alphaDays || 0} onChange={e => setAttendanceForm({...attendanceForm, alphaDays: Number(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={attendanceForm.notes || ""} onChange={e => setAttendanceForm({...attendanceForm, notes: e.target.value})} rows={2}></textarea>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 shrink-0">
              <button onClick={() => setIsAttendanceModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleSaveAttendance} className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700">Simpan</button>
            </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Master Shift Configuration Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showShiftConfigModal && (
              <motion.div
                key="hr-shift-config-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() => setShowShiftConfigModal(false)}
                className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-100 dark:border-slate-700/80"
                >
            {/* Header */}
            <div className="px-6 py-5 bg-brand-gradient text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/15 text-white border border-white/25">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Pengaturan Master Shift & Jam Operasional</h3>
                  <p className="text-xs text-brand-100 mt-0.5">
                    Sesuaikan jam mulai/selesai, toleransi keterlambatan, dan buat shift baru untuk kedai kopi Anda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftConfigModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveShiftDefinitions} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Guidance Info Banner */}
              <div className="bg-brand-50/70 border border-brand-100 rounded-2xl p-4 text-xs text-brand-950 flex items-start gap-3">
                <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-brand-900">Petunjuk Konfigurasi Shift & Jam Kerja:</p>
                  <p className="leading-relaxed text-brand-800">
                    • <strong>Jam Mulai & Selesai:</strong> Digunakan untuk acuan absensi (Clock-in/out) dan jadwal kerja tim operasional.
                  </p>
                  <p className="leading-relaxed text-brand-800">
                    • <strong>Toleransi Keterlambatan:</strong> Waktu toleransi (menit). Jika toleransi 15 menit pada shift 07:00, maka kehadiran di atas 07:15 akan otomatis ditandai terlambat.
                  </p>
                  <p className="leading-relaxed text-brand-800">
                    • <strong>Jam Kerja Flat (8 Jam):</strong> Standar kerja harian tanpa hitung lembur otomatis. Lembur diinput manual di slip gaji jika disetujui Manajer.
                  </p>
                </div>
              </div>

              {/* Shift List Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Daftar Shift Kerja Aktif ({shiftDefsForm.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetShiftDefinitions}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Default</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomShift}
                      className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Shift</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {shiftDefsForm.map((s, idx) => {
                    const isCore = s.id === "PAGI" || s.id === "MIDDLE" || s.id === "SORE";
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          s.isActive !== false
                            ? "bg-white border-slate-200 shadow-2xs hover:border-brand-300"
                            : "bg-slate-50/70 border-slate-200 opacity-60"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={s.isActive !== false}
                                onChange={(e) => updateShiftField(idx, "isActive", e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                              />
                              <span className="text-xs font-bold text-slate-700">
                                {s.isActive !== false ? "Aktif di Jadwal" : "Dinonaktifkan"}
                              </span>
                            </label>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-600">
                              ID: {s.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Color Tag Selector */}
                            <CustomSelect
                              value={s.color || "indigo"}
                              onChange={(val) => updateShiftField(idx, "color", val)}
                              options={[
                                { value: "emerald", label: "🟢 Emerald (Pagi)" },
                                { value: "blue", label: "🔵 Biru (Middle)" },
                                { value: "amber", label: "🟠 Amber (Sore)" },
                                { value: "purple", label: "🟣 Ungu (Khusus)" },
                                { value: "indigo", label: "🟦 Indigo (Malam)" },
                              ]}
                              buttonClassName="text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-200 bg-white"
                            />

                            {!isCore && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomShift(s.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus Shift Kustom"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Nama Label Shift
                            </label>
                            <input
                              type="text"
                              value={s.name}
                              onChange={(e) => updateShiftField(idx, "name", e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
                              placeholder="cth: Shift Pagi"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Jam Mulai
                            </label>
                            <input
                              type="time"
                              value={s.startTime}
                              onChange={(e) => updateShiftField(idx, "startTime", e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Jam Selesai
                            </label>
                            <input
                              type="time"
                              value={s.endTime}
                              onChange={(e) => updateShiftField(idx, "endTime", e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Toleransi Telat (Menit)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="120"
                              value={s.lateToleranceMinutes ?? 15}
                              onChange={(e) => updateShiftField(idx, "lateToleranceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowShiftConfigModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Pengaturan Shift</span>
                </button>
              </div>
            </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Brief Mingguan & Pengesahan Jadwal Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isBriefModalOpen && (
              <motion.div
                key="hr-brief-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() => setIsBriefModalOpen(false)}
                className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 dark:border-slate-700/80 overflow-hidden my-auto max-h-[85vh] sm:max-h-[88vh] flex flex-col"
                >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                  <Megaphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Sahkan Jadwal & Kirim Brief Mingguan</h3>
                  <p className="text-xs text-emerald-100">
                    Periode: {weekDays[0].toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: DEFAULT_STORE_TIMEZONE })} – {weekDays[6].toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: DEFAULT_STORE_TIMEZONE })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBriefModalOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Setelah disahkan, status jadwal minggu ini resmi menjadi <strong className="text-emerald-700">APPROVED</strong>. Catatan brief manajer di bawah ini akan <strong>langsung terkirim & muncul di Dashboard Karyawan</strong> beserta rincian jadwal shift 7 hari mereka.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Pesan Brief / Catatan Operasional Manajer:</span>
                  <span className="text-[11px] text-slate-400 font-normal">Maks. 300 karakter disarankan</span>
                </label>
                <textarea
                  rows={4}
                  value={briefNotesInput}
                  onChange={(e) => setBriefNotesInput(e.target.value)}
                  placeholder="Contoh: Semangat tim! Fokus minggu ini upsell pastry dan pertahankan keramahan senyum di kasir & bar. Jangan lupa checklist closing divisi tepat waktu."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-xs text-slate-800 leading-relaxed resize-none shadow-sm placeholder:text-slate-400"
                />
              </div>

              {/* Template Cepat */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-2">Pilih template cepat catatan:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Semangat bertugas minggu ini! Jaga kebersihan divisi & senyum ramah ke pelanggan ☕",
                    "Fokus upsell menu seasonal & promo mingguan untuk capai target omset toko 🎯",
                    "Weekend diperkirakan ramai. Bar & Kitchen harap siapkan bahan olahan & mise en place lebih awal 🚀",
                    "Pastikan checklist SOP opening & closing diisi rapi setiap shift ✨",
                  ].map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBriefNotesInput(tpl)}
                      className="text-[11px] px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-lg text-slate-600 text-left transition-colors"
                    >
                      {tpl.slice(0, 40)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsBriefModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveApprovedBrief}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sahkan & Kirim ke Dashboard</span>
              </button>
            </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── MODAL: KOREKSI ABSENSI OLEH MANAGER (ATURAN #3 & AUDIT LOG) ── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isCorrectionModalOpen && correctingAttendance && (() => {
              const emp = employees.find((e) => e.id === correctingAttendance.employeeId);
              const isPresentStatus =
                correctionForm.status === "HADIR" || correctionForm.status === "TERLAMBAT";
              let previewHours = 0;
              if (isPresentStatus && correctionForm.clockInTime && correctionForm.clockOutTime) {
                const inDate = new Date(`${correctingAttendance.date}T${correctionForm.clockInTime}:00+08:00`);
                let outDate = new Date(`${correctingAttendance.date}T${correctionForm.clockOutTime}:00+08:00`);
                if (!Number.isNaN(inDate.getTime()) && !Number.isNaN(outDate.getTime())) {
                  if (outDate.getTime() < inDate.getTime()) {
                    outDate = new Date(outDate.getTime() + 24 * 60 * 60 * 1000);
                  }
                  previewHours = calculateWorkDurationHours(
                    inDate.toISOString(),
                    outDate.toISOString()
                  );
                }
              }
              const previewOvertime = previewHours > 8 ? Math.round((previewHours - 8) * 10) / 10 : 0;

              return (
                <motion.div
                  key="hr-correction-modal-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/90 dark:border-slate-700/80 my-auto flex flex-col"
                  >
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex justify-between items-center bg-amber-50/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      Koreksi Kehadiran Karyawan
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Perbaikan jam masuk / pulang lupa clock out dengan catatan Audit Log.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveCorrection} className="p-6 space-y-4 text-xs">
                {/* Employee Info Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{emp?.name || getEmployeeName(correctingAttendance.employeeId)}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {emp?.position || "Staff"} • Tanggal: <strong className="text-slate-800">{correctingAttendance.date}</strong>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-700 text-[11px]">
                    {correctingAttendance.status}
                  </span>
                </div>

                {/* Status Kehadiran */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Kehadiran <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={correctionForm.status}
                    onChange={(val) => setCorrectionForm({ ...correctionForm, status: val as any })}
                    options={[
                      { value: "HADIR", label: "HADIR (Hadir Tepat Waktu)" },
                      { value: "TERLAMBAT", label: "TERLAMBAT (Hadir Melewati Toleransi)" },
                      { value: "IZIN", label: "IZIN (Izin Resmi dengan Surat)" },
                      { value: "SAKIT", label: "SAKIT (Sakit dengan Surat Dokter)" },
                      { value: "ALPHA", label: "ALPHA (Tanpa Keterangan)" },
                    ]}
                    buttonClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                  />
                </div>

                {/* Jam Masuk & Jam Pulang */}
                {isPresentStatus ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Jam Masuk (Clock In)
                      </label>
                      <input
                        type="time"
                        value={correctionForm.clockInTime}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, clockInTime: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Jam Pulang (Clock Out)
                      </label>
                      <input
                        type="time"
                        value={correctionForm.clockOutTime}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, clockOutTime: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-800 text-[11px] font-medium flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Status non-hadir ({correctionForm.status}) tidak menghitung jam kerja &amp; lembur.</span>
                  </div>
                )}

                {/* Live Duration & Overtime Calculation */}
                <div className="p-3 bg-brand-50/60 rounded-2xl border border-brand-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-600 font-medium block">Total Durasi Kerja:</span>
                    <strong className="text-brand-950 font-mono font-extrabold text-sm tabular-nums">
                      {previewHours.toFixed(1)} Jam
                    </strong>
                  </div>
                  {isPresentStatus && previewOvertime > 0 ? (
                    <div className="text-right">
                      <span className="text-amber-800 font-bold block text-[11px]">
                        Kelebihan Kerja: +{previewOvertime} Jam
                      </span>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={correctionForm.overtimeApproved}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, overtimeApproved: e.target.checked })}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold text-slate-800">Sahkan Lembur</span>
                      </label>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isPresentStatus ? "Normal 8 Jam" : "Non-Hadir (0 Jam)"}
                    </span>
                  )}
                </div>

                {/* Alasan Koreksi (Mandatory for Audit Trail) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Alasan / Justifikasi Koreksi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    placeholder="e.g. Lupa clock out saat closing, dikonfirmasi shift leader..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Wajib diisi sebagai bukti audit akuntabilitas bagi Owner dan Auditor.
                  </p>
                </div>

                {/* Audit Information Callout */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Koreksi ini otomatis mengesahkan absensi (Status: Disahkan) dan merekam aksi penyuntingan ke dalam <strong>Audit Log</strong> dengan nama akun Anda (<strong>{currentUser?.name || "Manager"}</strong>).
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCorrectionModalOpen(false)}
                    className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold cursor-pointer shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan & Sahkan Koreksi</span>
                  </button>
                </div>
              </form>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>,
          document.body
        )}

      {/* Photo Lightbox Modal Portal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {lightboxPhoto && (
              <motion.div
                key="hr-lightbox-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed inset-0 z-99999 bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6"
                onClick={() => setLightboxPhoto(null)}
              >
          {/* Lightbox Top Bar */}
          <div 
            className="flex items-center justify-between gap-4 text-white p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 max-w-4xl mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-1">
              <h4 className="text-sm sm:text-base font-bold text-white truncate">
                {lightboxPhoto.title}
              </h4>
              {lightboxPhoto.subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-300 truncate mt-0.5">
                  {lightboxPhoto.subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadPhoto(lightboxPhoto.url, `${lightboxPhoto.title.replace(/\s+/g, "_")}.jpg`)}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download foto ke perangkat"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Simpan Foto</span>
              </button>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Stage */}
          <div 
            className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0"
            onClick={() => setLightboxPhoto(null)}
          >
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[70vh] sm:max-h-[78vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-white/10 select-none transition-transform"
            />
          </div>

          {/* Lightbox Bottom Mobile Close Bar */}
          <div 
            className="flex items-center justify-center py-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="px-6 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold tracking-wide transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <X className="w-4 h-4" />
              <span>Tutup Tampilan Penuh</span>
            </button>
          </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ConfirmModal {...confirmModal.modalProps} />
    </div>
  );
}
