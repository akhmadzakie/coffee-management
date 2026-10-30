import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { Role, DEFAULT_LEADER_ALLOWANCE_RULES, DEFAULT_SHIFT_DEFINITIONS, ShiftDefinition } from "../types";
import { getLocalDateString } from "../utils/dateUtils";
import { KPI } from "./KPI";
import { Payroll } from "./Payroll";
import {
  Users,
  FileText,
  Target,
  Calendar,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  UserCheck,
  X,
  Mail,
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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { exportSinglePayslipPDF } from "../utils/export";
import {
  Employee,
  EmployeeContract,
  AttendanceRecord,
  KPIRecord,
  EmploymentType,
  EmployeeStatus,
} from "../types";
import { CsvImportExport } from "./common/CsvImportExport";

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
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const payslipRef = useRef<HTMLDivElement>(null);

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
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
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

  const handleSaveShiftDefinitions = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ...settings,
      shiftDefinitions: shiftDefsForm,
    });
    setShowShiftConfigModal(false);
    alert("Pengaturan master shift dan jam operasional berhasil disimpan!");
  };

  const handleAddCustomShift = () => {
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
    if (confirm("Hapus shift ini dari daftar konfigurasi?")) {
      setShiftDefsForm(shiftDefsForm.filter((s) => s.id !== id));
    }
  };

  const handleResetShiftDefinitions = () => {
    if (confirm("Reset seluruh master shift ke default bawaan sistem (Pagi, Middle, Sore)?")) {
      setShiftDefsForm(DEFAULT_SHIFT_DEFINITIONS);
    }
  };

  const handleBulkApprove = (targetIds?: string[]) => {
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedAttIds;
    if (!ids || ids.length === 0) {
      alert("Pilih minimal satu absensi untuk disetujui.");
      return;
    }
    if (!confirm(`Sahkan / Setujui ${ids.length} catatan kehadiran yang dipilih?`)) {
      return;
    }
    const idSet = new Set(ids);
    const updated = dailyAttendances.map(a => 
      idSet.has(a.id) ? { ...a, approvalStatus: "APPROVED" as const } : a
    );
    setDailyAttendances(updated);
    setSelectedAttIds([]);
    alert(`Berhasil menyetujui ${ids.length} catatan kehadiran!`);
  };

  const handleApproveAllPending = (pendingList: any[]) => {
    if (!pendingList || pendingList.length === 0) {
      alert("Tidak ada absensi yang menunggu persetujuan.");
      return;
    }
    if (!confirm(`Sahkan / Setujui SEKALIGUS seluruh ${pendingList.length} absensi yang berstatus 'Menunggu Verifikasi'?`)) {
      return;
    }
    const pendingIds = new Set(pendingList.map(a => a.id));
    const updated = dailyAttendances.map(a => 
      pendingIds.has(a.id) ? { ...a, approvalStatus: "APPROVED" as const } : a
    );
    setDailyAttendances(updated);
    setSelectedAttIds([]);
    alert(`Berhasil menyetujui seluruh ${pendingList.length} catatan kehadiran secara massal!`);
  };

  // Manager Attendance Correction Handler (Aturan #3 & Audit Log)
  const handleOpenCorrectionModal = (att: any) => {
    setCorrectingAttendance(att);
    let inStr = "07:00";
    let outStr = "15:00";
    if (att.clockInTime) {
      const inDate = new Date(att.clockInTime);
      const h = String(inDate.getHours()).padStart(2, "0");
      const m = String(inDate.getMinutes()).padStart(2, "0");
      inStr = `${h}:${m}`;
    }
    if (att.clockOutTime) {
      const outDate = new Date(att.clockOutTime);
      const h = String(outDate.getHours()).padStart(2, "0");
      const m = String(outDate.getMinutes()).padStart(2, "0");
      outStr = `${h}:${m}`;
    }
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
    if (!correctingAttendance) return;
    if (!correctionForm.reason.trim()) {
      alert("Alasan koreksi wajib diisi sebagai rekam jejak Audit Log.");
      return;
    }

    const dateStr = correctingAttendance.date; // YYYY-MM-DD
    const inIso = correctionForm.clockInTime ? `${dateStr}T${correctionForm.clockInTime}:00` : null;
    const outIso = correctionForm.clockOutTime ? `${dateStr}T${correctionForm.clockOutTime}:00` : null;

    let workHours = 0;
    if (inIso && outIso) {
      const diffMs = new Date(outIso).getTime() - new Date(inIso).getTime();
      workHours = Math.max(0, diffMs / 3600000);
    }
    const overtimeHours = workHours > 8 ? Math.round((workHours - 8) * 10) / 10 : 0;

    const managerName = currentUser?.name || currentUser?.username || "Manager";
    const updatedAtt = {
      ...correctingAttendance,
      status: correctionForm.status,
      clockInTime: inIso ? new Date(inIso).toISOString() : null,
      clockOutTime: outIso ? new Date(outIso).toISOString() : null,
      overtimeHours,
      overtimeApproved: correctionForm.overtimeApproved && overtimeHours > 0,
      approvalStatus: "APPROVED" as const,
      isCorrected: true,
      correctedBy: managerName,
      correctedAt: new Date().toISOString(),
      correctionReason: correctionForm.reason.trim(),
      notes: [
        correctingAttendance.notes,
        `[KOREKSI MANAGER oleh ${managerName}]: ${correctionForm.reason.trim()}`
      ].filter(Boolean).join(" • "),
    };

    updateDailyAttendance(updatedAtt);
    setIsCorrectionModalOpen(false);
    alert(`Berhasil mengoreksi dan mengesahkan absensi ${getEmployeeName(correctingAttendance.employeeId)}! Perubahan tercatat otomatis di Audit Log.`);
  };

  const [attendanceForm, setAttendanceForm] = useState({ employeeId: "", period: "", presentDays: 0, sickDays: 0, permissionDays: 0, alphaDays: 0, notes: "" });

  const handleOpenAttendanceModal = (att?: any, employeeId?: string) => {
    if (att && att.id) {
      setEditingAttendance(att);
      setAttendanceForm({ ...att });
    } else {
      setEditingAttendance(null);
      const currentPeriod = new Date().toISOString().substring(0, 7);
      setAttendanceForm({ employeeId: employeeId || "", period: currentPeriod, presentDays: 0, sickDays: 0, permissionDays: 0, alphaDays: 0, notes: "" });
    }
    setIsAttendanceModalOpen(true);
  };

  const handleSaveAttendance = () => {
    if (!attendanceForm.employeeId || !attendanceForm.period) return alert("Pilih Karyawan dan Periode");
    if (editingAttendance) {
      updateAttendance({ ...editingAttendance, ...attendanceForm });
    } else {
      addAttendance(attendanceForm);
    }
    setIsAttendanceModalOpen(false);
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
    if (!empForm.username || !empForm.name) return alert("Username dan Nama wajib diisi");
    
    const cleanUsername = empForm.username.toLowerCase().trim();
    if (!editingEmployee) {
      const dupEmp = employees.find(
        (e) => (e.username || "").toLowerCase().trim() === cleanUsername
      );
      if (dupEmp) {
        return alert(`Username "${empForm.username}" sudah digunakan oleh karyawan ${dupEmp.name}. Harap gunakan username unik.`);
      }
      const dupUser = users.find(
        (u) => (u.username || "").toLowerCase().trim() === cleanUsername
      );
      if (dupUser) {
        return alert(`Username "${empForm.username}" sudah terdaftar sebagai akun pengguna sistem.`);
      }
    } else {
      const dupEmp = employees.find(
        (e) => e.id !== editingEmployee.id && (e.username || "").toLowerCase().trim() === cleanUsername
      );
      if (dupEmp) {
        return alert(`Username "${empForm.username}" sudah digunakan oleh karyawan ${dupEmp.name}.`);
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
      updateEmployee({ ...editingEmployee, ...empForm });
      
      const relatedUser = users.find(
        (u) =>
          (u.employeeId && u.employeeId === editingEmployee.id) ||
          u.username.toLowerCase() === editingEmployee.username.toLowerCase() ||
          u.username.toLowerCase() === cleanUsername
      );

      if (relatedUser) {
        if (empForm.status !== "AKTIF") {
          deleteUser(relatedUser.id);
          alert("Akun login terkait telah dinonaktifkan/dihapus karena status karyawan menjadi " + empForm.status);
        } else {
          updateUser({
            ...relatedUser,
            username: cleanUsername,
            name: empForm.name.trim(),
            role: calculatedRole,
            department: calculatedRole === "LEADER" ? (empForm.department as any) : null,
            employeeId: editingEmployee.id,
          });
        }
      }
    } else {
      const newEmpId = addEmployee(empForm);
      if (autoCreateUser && newEmpId) {
        addUser({
          name: empForm.name.trim(),
          username: cleanUsername,
          pin: "123456",
          role: calculatedRole,
          department: calculatedRole === "LEADER" ? (empForm.department as any) : null,
          employeeId: newEmpId
        });
        alert(`Karyawan berhasil ditambahkan.\nAkun login otomatis dibuat:\nUsername: ${cleanUsername}\nPIN: 123456\nRole: ${calculatedRole}`);
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
    const confirmMsg = `Hapus data karyawan "${emp.name}" (@${emp.username})?\n\n` +
      `Perhatian:\n- Data kontrak dan penugasan shift terkait akan otomatis dibersihkan.\n` +
      (relatedUser ? `- Akun login sistem "${relatedUser.username}" akan dicabut.\n` : "") +
      `Tindakan ini tidak dapat dibatalkan. Lanjutkan?`;
    
    if (confirm(confirmMsg)) {
      deleteEmployee(emp.id);
      if (relatedUser) {
        deleteUser(relatedUser.id);
      }
      alert(`Data karyawan "${emp.name}" berhasil dihapus.`);
    }
  };

  const handleDeleteContract = (c: any) => {
    if (isReadOnly || !canEditHR) return;
    const empName = getEmployeeName(c.employeeId);
    if (confirm(`Hapus kontrak kerja karyawan "${empName}"?\n\nTindakan ini akan menghapus data gaji pokok dan tunjangan kontrak ini.`)) {
      deleteContract(c.id);
      alert(`Kontrak kerja berhasil dihapus.`);
    }
  };

  const handleImportEmployees = (data: any[]) => {
    let imported = 0;
    let updated = 0;
    data.forEach(row => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"];
      const username = row["Username"] || row.username;
      const name = row["Nama Karyawan"] || row.name;
      const position = row["Posisi"] || row.position;
      const department = row["Departemen"] || row.department;
      if (username && name) {
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
              employmentType: (row["Tipe"] || existing.employmentType) as EmploymentType
            });
            updated++;
          }
        } else {
          addEmployee({
            username, name, position, department,
            status: (row["Status"] || "AKTIF") as EmployeeStatus,
            employmentType: (row["Tipe"] || "TETAP") as EmploymentType
          });
          imported++;
        }
      }
    });
    if (imported > 0 || updated > 0) alert(`Berhasil menambahkan ${imported} data baru dan memperbarui ${updated} data karyawan.`);
    else alert("Tidak ada data valid yang diimport.");
  };

  const handleImportContracts = (data: any[]) => {
    let imported = 0;
    data.forEach(row => {
      const empId = employees.find(e => e.username === row["Username"])?.id;
      if (empId) {
        addContract({
          employeeId: empId,
          basicSalary: Number(row["Gaji Pokok"]) || 0,
          positionAllowance: Number(row["Tunjangan Jabatan"]) || 0,
          mealAllowance: Number(row["Tunjangan Makan"]) || 0,
          transportAllowance: Number(row["Tunjangan Transport"]) || 0,
          alphaDeductionPerDay: Number(row["Potongan Alpha"]) || 0,
          kpiBonusTarget: Number(row["Target Bonus KPI"]) || 0,
          
          startDate: row["Mulai Kontrak"] || getLocalDateString(),
          endDate: row["Selesai Kontrak"] || getLocalDateString(),
          status: "ACTIVE"
        });
        imported++;
      }
    });
    if (imported > 0) alert(`Berhasil mengimport ${imported} kontrak.`);
    else alert("Tidak ada data valid yang diimport. Pastikan Username karyawan sesuai.");
  };

  const handleImportAttendances = (data: any[]) => {
    let imported = 0;
    data.forEach(row => {
      const empId = employees.find(e => e.username === row["Username"])?.id;
      const period = row["Periode (YYYY-MM)"];
      if (empId && period) {
        addAttendance({
          employeeId: empId,
          period,
          presentDays: Number(row["Hadir"]) || 0,
          sickDays: Number(row["Sakit"]) || 0,
          permissionDays: Number(row["Izin"]) || 0,
          alphaDays: Number(row["Alpha"]) || 0,
          notes: row["Catatan"] || ""
        });
        imported++;
      }
    });
    if (imported > 0) alert(`Berhasil mengimport ${imported} absensi.`);
    else alert("Tidak ada data valid yang diimport. Pastikan Username karyawan sesuai.");
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
    if (!contractForm.employeeId) return alert("Pilih karyawan terlebih dahulu");
    if (editingContract) {
      if (contractForm.status === "ACTIVE") {
        contracts.forEach((c) => {
          if (c.id !== editingContract.id && c.employeeId === contractForm.employeeId && c.status === "ACTIVE") {
            updateContract({ ...c, status: "INACTIVE" });
          }
        });
      }
      updateContract({ ...editingContract, ...contractForm });
    } else {
      if (contractForm.status === "ACTIVE") {
        contracts.forEach((c) => {
          if (c.employeeId === contractForm.employeeId && c.status === "ACTIVE") {
            updateContract({ ...c, status: "INACTIVE" });
          }
        });
      }
      addContract(contractForm);
    }
    
    // Sync endDate ke Employee
    if (contractForm.status === "ACTIVE") {
      const emp = employees.find(e => e.id === contractForm.employeeId);
      if (emp) {
        updateEmployee({ ...emp, endDate: contractForm.endDate });
      }
    }
    
    setIsContractModalOpen(false);
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEmployeeName = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (emp) return emp.name;
    const user = users.find((u) => u.id === empId);
    return user ? user.name : "Unknown";
  };


  // --- Weekly Schedule Logic ---
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const day = today.getDay(); // 0 = Sunday, 1 = Monday
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today);
    monday.setDate(diff);
    return monday;
  });

  const generateWeekDays = (start: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setHours(12, 0, 0, 0);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };
  const weekDays = generateWeekDays(currentWeekStart);
  const weekKey = getLocalDateString(weekDays[0]);
  const currentWeekApproval = (settings?.scheduleApprovals as any)?.[weekKey] || { status: "DRAFT" };
  const isWeekApproved = currentWeekApproval.status === "APPROVED";
  const isWeekPending = currentWeekApproval.status === "PENDING";

  const handleSubmitSchedule = () => {
    if (isReadOnly) return;
    if (scheduleCollisions.length > 0) {
      const highSeverity = scheduleCollisions.filter(c => c.severity === "high");
      if (highSeverity.length > 0) {
        if (!confirm(`Peringatan: Terdeteksi ${highSeverity.length} potensi masalah pada jadwal (misal jeda istirahat < 8 jam / clopen). Tetap ajukan jadwal ini ke Manajer?`)) {
          return;
        }
      }
    }
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
    alert(`Jadwal shift minggu ini (${weekDays[0].toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${weekDays[6].toLocaleDateString("id-ID", { day: "numeric", month: "short" })}) berhasil diajukan ke Manajer untuk disahkan!`);
  };

  const handleOpenApproveModal = () => {
    if (!isHRD || isReadOnly) return;
    const existingNotes = currentWeekApproval.notes || "Semangat bertugas minggu ini! Jaga konsistensi rasa kopi & makanan, kebersihan area kerja divisi, dan senyum ramah ke pelanggan.";
    setBriefNotesInput(existingNotes);
    setIsBriefModalOpen(true);
  };

  const handleSaveApprovedBrief = () => {
    if (!isHRD || isReadOnly) return;
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
    alert("Jadwal mingguan resmi telah disahkan! Catatan brief otomatis terkirim dan tampil di Dashboard Karyawan.");
  };

  const handleToggleWeekApproval = () => {
    if (!isHRD || isReadOnly) return;
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
    if (!isHRD || isReadOnly) return;
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
    alert("Jadwal dikembalikan ke status Draft untuk direvisi oleh Leader.");
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
    if (isHRD) return true; // Manager, Owner, Super Admin memiliki akses penuh ke semua staf operasional
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
    if (isReadOnly) return;
    const prevWeekDays = generateWeekDays(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
    let copiedCount = 0;
    let newShifts = [...employeeShifts];

    filteredScheduleEmployees.forEach(emp => {
      if (!canEditShiftForEmployee(emp) && !isHRD) return;

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
      alert(`Berhasil menyalin ${copiedCount} penugasan shift dari minggu lalu.`);
    } else {
      alert("Tidak ada data jadwal shift dari minggu sebelumnya untuk disalin.");
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
    if (attendances && attendances.length > 0) {
      return attendances.map((a) => ({
        name: getEmployeeName(a.employeeId).substring(0, 10),
        Hadir: a.presentDays,
        Alpha: a.alphaDays,
        Izin: a.sickDays + a.permissionDays,
      }));
    }

    // Fallback dinamis dari presensi harian (dailyAttendances) bulan berjalan
    const currentMonthPrefix = todayStr.substring(0, 7);
    const currentMonthDaily = (dailyAttendances || []).filter((d) => (d.date || "").startsWith(currentMonthPrefix));

    const empMap: Record<string, { Hadir: number; Alpha: number; Izin: number }> = {};
    currentMonthDaily.forEach((d) => {
      if (!empMap[d.employeeId]) {
        empMap[d.employeeId] = { Hadir: 0, Alpha: 0, Izin: 0 };
      }
      if (d.status === "HADIR" || d.status === "TERLAMBAT") {
        empMap[d.employeeId].Hadir++;
      } else if (d.status === "ALPHA") {
        empMap[d.employeeId].Alpha++;
      } else if (d.status === "IZIN" || d.status === "SAKIT") {
        empMap[d.employeeId].Izin++;
      }
    });

    return Object.entries(empMap).map(([empId, stats]) => ({
      name: getEmployeeName(empId).substring(0, 10),
      Hadir: stats.Hadir,
      Alpha: stats.Alpha,
      Izin: stats.Izin,
    }));
  }, [attendances, dailyAttendances, employees, users, todayStr]);

  // Roster Staf Bertugas Hari Ini
  const todayShifts = useMemo(() => {
    const operationalList = employees.filter((e) => isEmpActive(e) && isOperationalStaff(e));
    return operationalList.map((emp) => {
      const shiftAssigned = employeeShifts.find((s) => s.employeeId === emp.id && s.date === todayStr)?.shiftType || "OFF";
      const att = dailyAttendances.find((a) => a.employeeId === emp.id && a.date === todayStr);
      return {
        emp,
        shift: shiftAssigned,
        attendance: att,
      };
    });
  }, [employees, employeeShifts, dailyAttendances, todayStr]);

  // Kontrak Mendekati Jatuh Tempo (< 30 hari atau overdue)
  const expiringContractsList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(today.getDate() + 30);

    return contracts
      .filter((c) => {
        if (c.status !== "ACTIVE" && !(c as any).isActive) return false;
        if (!c.endDate) return false;
        const end = new Date(c.endDate);
        return end <= thirtyDays;
      })
      .map((c) => {
        const end = new Date(c.endDate);
        const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...c,
          daysRemaining,
          isOverdue: daysRemaining < 0,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [contracts]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = empSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        (emp.username || "").toLowerCase().includes(q) ||
        (emp.position || "").toLowerCase().includes(q);
      const matchDept =
        empDeptFilter === "ALL" || (emp.department || "").toUpperCase() === empDeptFilter.toUpperCase();
      const matchStatus =
        empStatusFilter === "ALL" ||
        (empStatusFilter === "AKTIF" ? isEmpActive(emp) : !isEmpActive(emp));
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, empSearch, empDeptFilter, empStatusFilter]);

  const filteredContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(today.getDate() + 30);

    return contracts.filter((c) => {
      const empName = getEmployeeName(c.employeeId).toLowerCase();
      const q = contractSearch.toLowerCase().trim();
      const matchSearch = !q || empName.includes(q);
      if (!matchSearch) return false;

      if (contractStatusFilter === "ALL") return true;
      const isActive = c.status === "ACTIVE" || (c as any).isActive;
      const endDate = c.endDate ? new Date(c.endDate) : null;
      const isExpired = endDate ? endDate < today : false;
      const isExpiring = isActive && endDate ? endDate >= today && endDate <= thirtyDays : false;

      if (contractStatusFilter === "ACTIVE") return isActive && !isExpired;
      if (contractStatusFilter === "EXPIRING") return isExpiring;
      if (contractStatusFilter === "EXPIRED") return isExpired;
      if (contractStatusFilter === "INACTIVE") return !isActive;
      return true;
    });
  }, [contracts, contractSearch, contractStatusFilter, employees, users]);

  // --- PDF Generation ---
  const generatePDF = async () => {
    if (!selectedPayslip) return;
    try {
      const payrollRecord: any = {
        id: selectedPayslip.id || `PAY-${selectedPayslip.period}`,
        employeeId: selectedPayslip.employee?.id,
        period: selectedPayslip.period,
        basicSalary: selectedPayslip.basic || 0,
        positionAllowance: selectedPayslip.position || 0,
        mealAllowance: selectedPayslip.meal || 0,
        transportAllowance: selectedPayslip.transport || 0,
        kpiBonus: selectedPayslip.kpiBonus || 0,
        alphaDeduction: selectedPayslip.alphaDeduction || 0,
        grossPay:
          (selectedPayslip.basic || 0) +
          (selectedPayslip.position || 0) +
          (selectedPayslip.meal || 0) +
          (selectedPayslip.kpiBonus || 0),
        netPay: selectedPayslip.total || 0,
        status: "APPROVED",
        notes: null,
      };

      exportSinglePayslipPDF({
        payroll: payrollRecord,
        employee: selectedPayslip.employee,
        settings,
        attendanceBreakdown: {
          totalWorkingDays: selectedPayslip.attendance?.totalWorkingDays || 26,
          presentDays: selectedPayslip.attendance?.presentDays || 0,
          lateDays: selectedPayslip.attendance?.lateDays || 0,
          sickOrLeaveDays: selectedPayslip.attendance?.sickOrLeaveDays || 0,
          alphaDays: selectedPayslip.attendance?.alphaDays || 0,
        },
      });
    } catch (error) {
      console.warn("Vector PDF export fallback, trying raster canvas:", error);
      if (payslipRef.current) {
        try {
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
          });
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
          pdf.save(
            `Slip_Gaji_${selectedPayslip?.employee?.name?.replace(/\s+/g, "_")}_${selectedPayslip?.period}.pdf`,
          );
        } catch (canvasErr) {
          console.error("Canvas fallback error:", canvasErr);
          alert("Gagal memproses slip gaji ke PDF.");
        }
      }
    }
  };

  // ─── PAYROLL CALCULATION ──────────────────────────────────────────────────────────
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
        const dailyWage = Math.round(contract.basicSalary / 25);
        const alphaDeduction = isManagerOrExempt 
          ? 0 
          : ((contract.alphaDeductionPerDay !== undefined && contract.alphaDeductionPerDay !== 0) ? contract.alphaDeductionPerDay : dailyWage) * att.alphaDays;

        // Hitung Skor KPI Otomatis dari Checklist Shift & Presensi (0 - 100)
        const empChecklists = (dailyChecklists || []).filter(
          (c) => c.employeeId === emp.id && c.date.startsWith(att.period)
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

        const total = basic + meal + position + kpiBonus - alphaDeduction;

        return {
          id: `pr_${att.id}`,
          employee: emp,
          period: att.period,
          basic,
          meal,
          position,
          alphaDeduction,
          kpiBonus,
          total,
          attendance: att,
        };
      })
      .filter(Boolean) as any[];
  }, [attendances, employees, contracts, kpiBonusRules, settings, dailyChecklists]);

  const currentPeriod = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const avgKpiScore = useMemo(() => {
    if (!employees || employees.length === 0) return "0.0";
    const operational = employees.filter((e) => isEmpActive(e) && isOperationalStaff(e));
    if (operational.length === 0) return "0.0";
    const scores = operational.map((emp) => {
      const empChecklists = (dailyChecklists || []).filter(
        (c) => c.employeeId === emp.id && c.date.startsWith(currentPeriod)
      );
      return empChecklists.length > 0
        ? Math.min(100, Math.round((empChecklists.length / 22) * 100))
        : 0;
    });
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }, [employees, dailyChecklists, currentPeriod]);

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
    { id: "payroll", label: "Payroll", icon: DollarSign },
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
                  className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-indigo-900 text-sm font-semibold">
                      {isIndo ? "Total Gaji Pokok" : "Total Basic Salary"}
                    </h3>
                    <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900">
                    {formatRupiah(
                      contracts
                        .filter((c) => c.status === "ACTIVE" || (c as any).isActive)
                        .reduce((sum, c) => sum + (c.basicSalary || 0), 0),
                    )}
                  </p>
                  <p className="text-sm text-indigo-600 mt-2">
                    {isIndo ? "Kontrak Aktif" : "Active Contracts"}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-blue-900 text-sm font-semibold">
                      {isIndo ? "Proyeksi Payroll" : "Payroll Projection"}
                    </h3>
                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatRupiah(
                      (() => {
                        const calculated = payrollData.reduce((sum, p) => sum + (p ? p.total : 0), 0);
                        if (calculated > 0) return calculated;
                        return contracts
                          .filter((c) => c.status === "ACTIVE" || (c as any).isActive)
                          .reduce((sum, c) => sum + (c.basicSalary || 0) + (c.mealAllowance || 0) + (c.positionAllowance || 0) + (c.transportAllowance || 0), 0);
                      })()
                    )}
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
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
                        {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
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
                    { key: "MIDDLE", label: "Shift Middle", time: "11:00 – 19:00", bg: "bg-blue-50/50 border-blue-200/70", badge: "bg-blue-100 text-blue-800" },
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
                {canEditHR && (
                  <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
                    <CsvImportExport
                      onImport={handleImportEmployees}
                      templateHeaders={["Username", "Nama Karyawan", "Posisi", "Departemen", "Status", "Tipe"]}
                      templateExampleRow={["EMP-001", "Budi Santoso", "Barista", "Operasional", "AKTIF", "TETAP"]}
                      currentData={employees.map(e => ({
                        id: e.id,
                        "Username": e.username || "",
                        "Nama Karyawan": e.name,
                        "Posisi": e.position,
                        "Departemen": e.department,
                        "Status": e.status,
                        "Tipe": e.employmentType
                      }))}
                      templateFilename="template_karyawan"
                      buttonLabel={isIndo ? "Import" : "Import"}
                      templateDropdowns={{
                        "Posisi": ["Kasir", "Karyawan", "Leader", "Manager"],
                        "Departemen": ["MAIN", "BAR", "KITCHEN", "BAKER"],
                        "Status": ["AKTIF", "TIDAK_AKTIF", "RESIGN", "PHK"],
                        "Tipe": ["TETAP", "KONTRAK", "PARUH_WAKTU", "MAGANG"],
                      }}
                      templateHints={{
                        "Username": "ID / Username unik karyawan",
                        "Nama Karyawan": "Nama lengkap karyawan",
                        "Posisi": "Pilih jabatan",
                        "Departemen": "Pilih divisi/departemen",
                        "Status": "Status keaktifan",
                        "Tipe": "Tipe ikatan kerja",
                      }}
                    />
                    <button
                      onClick={() => handleOpenEmployeeModal()}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-xs whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4 shrink-0" />{" "}
                      {isIndo ? "Tambah Karyawan" : "Add Employee"}
                    </button>
                  </div>
                )}
              </div>

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
                  <select
                    value={empDeptFilter}
                    onChange={(e) => setEmpDeptFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="ALL">Semua Departemen</option>
                    <option value="BAR">Bar & Kasir</option>
                    <option value="KITCHEN">Kitchen</option>
                    <option value="BAKER">Baker</option>
                    <option value="MANAGEMENT">Manajemen</option>
                    <option value="FINANCE">Keuangan</option>
                  </select>

                  <select
                    value={empStatusFilter}
                    onChange={(e) => setEmpStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="AKTIF">Hanya Aktif</option>
                    <option value="NON-AKTIF">Non-Aktif / Resign</option>
                  </select>
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
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0">
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
                  className="px-4 py-2 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors shrink-0 flex items-center justify-center gap-1.5"
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
                {canEditHR && (
                  <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
                    <CsvImportExport
                      onImport={handleImportContracts}
                      templateHeaders={["Username", "Gaji Pokok", "Tunjangan Jabatan", "Tunjangan Makan", "Tunjangan Transport", "Target Bonus KPI", "Mulai Kontrak", "Selesai Kontrak"]}
                      templateExampleRow={["EMP-001", "3500000", "500000", "20000", "20000", "500000", "2024-01-01", "2024-12-31"]}
                      templateFilename="template_kontrak"
                      buttonLabel={isIndo ? "Import" : "Import"}
                      templateDropdowns={{
                        Username: employees.map(e => e.username).filter(Boolean),
                      }}
                      templateColumnTypes={{
                        "Gaji Pokok": "number",
                        "Tunjangan Jabatan": "number",
                        "Tunjangan Makan": "number",
                        "Tunjangan Transport": "number",
                        "Target Bonus KPI": "number",
                        "Mulai Kontrak": "date",
                        "Selesai Kontrak": "date",
                      }}
                      templateHints={{
                        Username: "Pilih username karyawan dari daftar dropdown",
                        "Mulai Kontrak": "Format YYYY-MM-DD",
                        "Selesai Kontrak": "Format YYYY-MM-DD",
                      }}
                    />
                    <button onClick={() => handleOpenContractModal()} className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-xs whitespace-nowrap shrink-0">
                      <Plus className="w-4 h-4 shrink-0" /> {isIndo ? "Tambah Kontrak" : "Add Contract"}
                    </button>
                  </div>
                )}
              </div>
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
                  <select
                    value={contractStatusFilter}
                    onChange={(e) => setContractStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="ALL">Semua Status Kontrak</option>
                    <option value="ACTIVE">Kontrak Aktif</option>
                    <option value="EXPIRING">Segera Berakhir (&lt; 30 Hari)</option>
                    <option value="EXPIRED">Sudah Berakhir (Lewat)</option>
                    <option value="INACTIVE">Non-Aktif / Diarsipkan</option>
                  </select>
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
                  <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-2">
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
                            className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors shadow-2xs"
                            title="Edit arahan brief yang tampil di Dashboard Karyawan"
                          >
                            <Megaphone className="w-3.5 h-3.5 text-blue-600" />
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
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
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
                        ? "bg-blue-500"
                        : def.color === "amber"
                        ? "bg-amber-500"
                        : def.color === "purple"
                        ? "bg-purple-500"
                        : "bg-indigo-500";
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
                      <th className="py-3.5 px-4 sticky left-0 bg-slate-50 z-10 w-52 shadow-[1px_0_0_0_#e2e8f0]">
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
                            <td className="py-3 px-4 sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0]">
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
                                        badgeColor = "bg-blue-50 text-blue-800 border-blue-300";
                                      } else if (activeDef.color === "amber" || shift === "SORE") {
                                        badgeColor = "bg-amber-50 text-amber-800 border-amber-300";
                                      } else if (activeDef.color === "purple") {
                                        badgeColor = "bg-purple-50 text-purple-800 border-purple-300";
                                      } else {
                                        badgeColor = "bg-indigo-50 text-indigo-800 border-indigo-300";
                                      }
                                    }
                                    return (
                                      <select
                                        disabled={!canEditThisEmp}
                                        value={shift}
                                        onChange={(e) => handleShiftChange(emp.id, dateStr, e.target.value)}
                                        title={
                                          !canEditThisEmp
                                            ? (isWeekApproved
                                                ? "Jadwal telah disetujui Manajer (Terkunci). Klik 'Buka Kunci (Revisi)' untuk mengedit."
                                                : isLeader
                                                  ? "Hanya dapat mengedit jadwal tim divisi Anda sendiri"
                                                  : "Hanya Baca")
                                            : "Pilih shift kerja"
                                        }
                                        className={`w-full text-xs font-bold py-1.5 px-2 rounded-xl border transition-all ${
                                          !canEditThisEmp ? "cursor-not-allowed opacity-80 bg-slate-50" : "cursor-pointer"
                                        } ${badgeColor}`}
                                      >
                                        <option value="OFF">OFF (Libur)</option>
                                        {activeShiftDefs.map((def) => (
                                          <option key={def.id} value={def.id}>
                                            {def.name} ({def.startTime.slice(0, 5)} - {def.endTime.slice(0, 5)})
                                          </option>
                                        ))}
                                      </select>
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
              <div className="flex justify-between items-center mb-6">
                
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo
                    ? "Rekap Absensi Bulanan"
                    : "Monthly Attendance Recap"}
                </h3>
                {canEditHR && (
                  <div className="flex items-center gap-3">
                    <CsvImportExport
                      onImport={handleImportAttendances}
                      templateHeaders={["Username", "Periode (YYYY-MM)", "Hadir", "Sakit", "Izin", "Alpha", "Catatan"]}
                      templateExampleRow={["EMP-001", "2024-01", "22", "1", "0", "0", "Rajin"]}
                      templateFilename="template_absensi"
                      buttonLabel={isIndo ? "Import" : "Import"}
                      templateDropdowns={{
                        Username: employees.map(e => e.username).filter(Boolean),
                      }}
                      templateColumnTypes={{
                        Hadir: "integer",
                        Sakit: "integer",
                        Izin: "integer",
                        Alpha: "integer",
                      }}
                      templateHints={{
                        Username: "Pilih username karyawan",
                        "Periode (YYYY-MM)": "Format: YYYY-MM (contoh: 2024-10)",
                      }}
                    />
                    <button onClick={() => handleOpenAttendanceModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                      <Plus className="w-4 h-4" /> {isIndo ? "Tambah Absensi" : "Add Attendance"}
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Karyawan" : "Employee"}
                      </th>
                      <th className="py-3 px-4 font-semibold">Periode</th>
                      <th className="py-3 px-4 font-semibold text-emerald-600">
                        Hadir
                      </th>
                      <th className="py-3 px-4 font-semibold text-amber-500">
                        Izin/Sakit
                      </th>
                      <th className="py-3 px-4 font-semibold text-rose-600">
                        Alpha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                                        {(() => {
                        // Auto-generate rekapan bulanan dari dailyAttendances
                        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
                        const uniqueEmpIds = Array.from(new Set([
                          ...employees.map(e => e.id),
                          ...dailyAttendances.filter(a => a.date.startsWith(currentMonth)).map(a => a.employeeId)
                        ]));
                        const recap = uniqueEmpIds.map(empId => {
                          const logs = dailyAttendances.filter(a => a.employeeId === empId && a.date.startsWith(currentMonth));
                          if (logs.length === 0) return null;
                          return {
                            id: empId,
                            employeeId: empId,
                            period: currentMonth,
                            presentDays: logs.filter(l => ["HADIR", "TERLAMBAT"].includes(l.status) && l.approvalStatus !== "REJECTED").length,
                            sickDays: logs.filter(l => l.status === "SAKIT" && l.approvalStatus !== "REJECTED").length,
                            permissionDays: logs.filter(l => l.status === "IZIN" && l.approvalStatus !== "REJECTED").length,
                            alphaDays: logs.filter(l => l.status === "ALPHA" || l.approvalStatus === "REJECTED").length,
                          };
                        }).filter(Boolean);

                        if (recap.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                                {isIndo ? "Belum ada data absensi untuk bulan ini." : "No attendance data yet."}
                              </td>
                            </tr>
                          );
                        }

                        return recap.map((a: any) => (
                          <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-800">{getEmployeeName(a.employeeId)}</td>
                            <td className="py-3 px-4 text-slate-600">{a.period}</td>
                            <td className="py-3 px-4 font-semibold text-emerald-600">{a.presentDays}</td>
                            <td className="py-3 px-4 font-semibold text-amber-500">{a.sickDays + a.permissionDays}</td>
                            <td className="py-3 px-4 font-semibold text-rose-600">{a.alphaDays}</td>
                          </tr>
                        ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Daily Attendances for Manager */}
              <div className="mt-12 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
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
                      onChange={setAttendanceDateFilter}
                      placeholder="Semua Tanggal"
                      allowClear={true}
                      buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200"
                    />

                    <select
                      value={attendanceEmpFilter}
                      onChange={(e) => setAttendanceEmpFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none"
                    >
                      <option value="ALL">Semua Karyawan</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.position})
                        </option>
                      ))}
                    </select>

                    <select
                      value={attendanceApprovalFilter}
                      onChange={(e) => setAttendanceApprovalFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none"
                    >
                      <option value="ALL">Semua Verifikasi</option>
                      <option value="PENDING">⏳ Menunggu Verifikasi</option>
                      <option value="APPROVED">✓ Disahkan (Approved)</option>
                      <option value="REJECTED">✕ Ditolak (Rejected)</option>
                      <option value="FORGOTTEN_CLOCKOUT">⚠️ Lupa Clock Out</option>
                      <option value="CORRECTED">✏️ Sudah Dikoreksi</option>
                    </select>

                    <button
                      onClick={() => setAttendanceDateFilter(new Date().toISOString().substring(0, 10))}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      Hari Ini
                    </button>
                  </div>
                </div>

                {/* Bulk Actions Bar if items selected */}
                {selectedAttIds.length > 0 && canEditHR && (
                  <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-indigo-900 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
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
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              title="Pilih Semua yang Ditampilkan"
                              onChange={(e) => {
                                const currentFiltered = [...dailyAttendances].filter((d) => {
                                  if (attendanceDateFilter && d.date !== attendanceDateFilter) return false;
                                  if (attendanceEmpFilter !== "ALL" && d.employeeId !== attendanceEmpFilter) return false;
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
                                });
                                if (e.target.checked) {
                                  setSelectedAttIds(currentFiltered.map((d) => d.id));
                                } else {
                                  setSelectedAttIds([]);
                                }
                              }}
                              checked={
                                selectedAttIds.length > 0 &&
                                [...dailyAttendances]
                                  .filter((d) => {
                                    if (attendanceDateFilter && d.date !== attendanceDateFilter) return false;
                                    if (attendanceEmpFilter !== "ALL" && d.employeeId !== attendanceEmpFilter) return false;
                                    if (attendanceApprovalFilter !== "ALL") {
                                      const appStatus = d.approvalStatus || "PENDING";
                                      if (appStatus !== attendanceApprovalFilter) return false;
                                    }
                                    return true;
                                  })
                                  .every((d) => selectedAttIds.includes(d.id))
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
                              const pendingItems = [...dailyAttendances].filter((d) => {
                                if (attendanceDateFilter && d.date !== attendanceDateFilter) return false;
                                if (attendanceEmpFilter !== "ALL" && d.employeeId !== attendanceEmpFilter) return false;
                                const appStatus = d.approvalStatus || "PENDING";
                                return appStatus === "PENDING" && d.status !== "ALPHA";
                              });
                              if (pendingItems.length > 0) {
                                return (
                                  <button
                                    onClick={() => handleApproveAllPending(pendingItems)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all"
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
                        const filtered = [...dailyAttendances]
                          .filter((d) => {
                            if (attendanceDateFilter && d.date !== attendanceDateFilter) return false;
                            if (attendanceEmpFilter !== "ALL" && d.employeeId !== attendanceEmpFilter) return false;
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
                            <tr key={d.id} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-xs ${isSelected ? "bg-indigo-50/40" : ""}`}>
                              {canEditHR && (
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
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
                                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
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
                                    d.status === "IZIN" ? "bg-blue-100 text-blue-800" :
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
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
                                      title={d.correctionReason ? `Alasan: ${d.correctionReason} (oleh ${d.correctedBy || "Manager"})` : "Telah dikoreksi Manager"}
                                    >
                                      <Sparkles className="w-3 h-3 text-indigo-600" /> Dikoreksi ({d.correctedBy || "Manager"})
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
                              <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                                {d.clockInTime ? new Date(d.clockInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'} 
                                {" - "}
                                {d.clockOutTime ? new Date(d.clockOutTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                              </td>
                              {/* Durasi */}
                              <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                                {d.clockInTime && d.clockOutTime 
                                  ? (((new Date(d.clockOutTime).getTime() - new Date(d.clockInTime).getTime()) / 3600000).toFixed(1) + " Jam")
                                  : "-"}
                              </td>
                              {/* Aksi & Verifikasi */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canEditHR && currentApproval !== "APPROVED" && d.status !== "ALPHA" && (
                                    <button
                                      onClick={() => {
                                        updateDailyAttendance({ ...d, approvalStatus: "APPROVED" });
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs transition-colors shadow-2xs"
                                      title="Langsung sahkan / setujui kehadiran ini dengan 1 klik"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Sahkan</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setVerifyingAttendance(d);
                                      setIsVerificationModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs"
                                    title="Lihat foto besar dan peta lokasi GPS lengkap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Bukti & Peta</span>
                                  </button>

                                  {canEditHR && (
                                    <button
                                      onClick={() => handleOpenCorrectionModal(d)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                                      title="Koreksi jam masuk/pulang atau status kehadiran (dicatat di Audit Log)"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Koreksi</span>
                                    </button>
                                  )}

                                  {canEditHR && d.status !== "DITOLAK" && d.status !== "ALPHA" && (
                                    <button
                                      onClick={() => {
                                        if(confirm(`Tolak kehadiran ${emp?.name || 'karyawan ini'} dan ubah status menjadi ALPHA?`)) {
                                          updateDailyAttendance({...d, status: "ALPHA", approvalStatus: "REJECTED"});
                                        }
                                      }}
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors"
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

          {/* PAYROLL TAB & PAYSLIP */}
          {activeTab === "payroll" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {selectedPayslip ? (
                /* --- SLIP GAJI VIEW --- */
                <div className="max-w-3xl mx-auto">
                  <div className="flex justify-between items-center mb-6">
                    <button
                      onClick={() => setSelectedPayslip(null)}
                      className="text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors"
                    >
                      ←{" "}
                      {isIndo
                        ? "Kembali ke Daftar Payroll"
                        : "Back to Payroll List"}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!selectedPayslip.employee.email) {
                            alert("Karyawan tidak memiliki data email. Harap lengkapi email karyawan di menu Edit Karyawan.");
                            return;
                          }
                          alert(`Slip Gaji berhasil dikirimkan ke email: ${selectedPayslip.employee.email}`);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Mail className="w-4 h-4" /> {isIndo ? "Kirim Email" : "Send Email"}
                      </button>
                      <button
                        onClick={generatePDF}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                    </div>
                  </div>

                  {/* Printable Area */}
                  <div
                    ref={payslipRef}
                    className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>

                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
                      <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                          {settings.brandName || "PERUSAHAAN"}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                          {settings.companyAddress ||
                            "Alamat Perusahaan Lengkap"}
                        </p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-indigo-900 tracking-tight">
                          SLIP GAJI
                        </h2>
                        <p className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-md inline-block mt-2">
                          Periode: {selectedPayslip.period}
                        </p>
                      </div>
                    </div>

                    {/* Employee Info */}
                    <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                          Data Karyawan
                        </p>
                        <p className="font-bold text-slate-800 text-lg">
                          {selectedPayslip.employee.name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {selectedPayslip.employee.username} —{" "}
                          {selectedPayslip.employee.position}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                          Status Kehadiran
                        </p>
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold text-emerald-600">
                            {selectedPayslip.attendance.presentDays}
                          </span>{" "}
                          Hari Hadir
                        </p>
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold text-rose-600">
                            {selectedPayslip.attendance.alphaDays}
                          </span>{" "}
                          Hari Alpha
                        </p>
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      {/* Pendapatan */}
                      <div>
                        <h3 className="font-bold text-slate-800 border-b-2 border-indigo-100 pb-2 mb-3">
                          PENDAPATAN
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Gaji Pokok</span>
                            <span className="font-mono text-slate-800 font-medium">
                              {formatRupiah(selectedPayslip.basic)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">
                              Tunjangan Jabatan
                            </span>
                            <span className="font-mono text-slate-800 font-medium">
                              {formatRupiah(selectedPayslip.position)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">
                              Tunjangan Makan (
                              {selectedPayslip.attendance.presentDays}x)
                            </span>
                            <span className="font-mono text-slate-800 font-medium">
                              {formatRupiah(selectedPayslip.meal)}
                            </span>
                          </div>
                          {selectedPayslip.kpiBonus > 0 && (
                            <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 p-1.5 rounded -mx-1.5 px-1.5">
                              <span>Bonus KPI</span>
                              <span className="font-mono font-medium">
                                +{formatRupiah(selectedPayslip.kpiBonus)}
                              </span>
                            </div>
                          )}
                          <div className="border-t border-slate-200 pt-3 flex justify-between items-center font-bold text-slate-800">
                            <span>Total Pendapatan</span>
                            <span className="font-mono">
                              {formatRupiah(
                                selectedPayslip.basic +
                                  selectedPayslip.position +
                                  selectedPayslip.meal +
                                  selectedPayslip.kpiBonus,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Potongan */}
                      <div>
                        <h3 className="font-bold text-slate-800 border-b-2 border-rose-100 pb-2 mb-3">
                          POTONGAN
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center text-rose-600">
                            <span>
                              Potongan Alpha (
                              {selectedPayslip.attendance.alphaDays}x)
                            </span>
                            <span className="font-mono font-medium">
                              -{formatRupiah(selectedPayslip.alphaDeduction)}
                            </span>
                          </div>
                          <div className="border-t border-slate-200 pt-3 flex justify-between items-center font-bold text-slate-800">
                            <span>Total Potongan</span>
                            <span className="font-mono text-rose-600">
                              {formatRupiah(selectedPayslip.alphaDeduction)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* THP */}
                    <div className="bg-indigo-600 text-white rounded-xl p-6 flex justify-between items-center shadow-lg shadow-indigo-200">
                      <div>
                        <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">
                          TAKE HOME PAY
                        </p>
                        <p className="text-3xl font-black font-mono">
                          {formatRupiah(selectedPayslip.total)}
                        </p>
                      </div>
                      <UserCheck className="w-12 h-12 text-indigo-400 opacity-50" />
                    </div>

                    {/* Footer / Signatures */}
                    <div className="mt-12 pt-8 border-t border-dashed border-slate-200 flex justify-between">
                      <div className="text-center">
                        <p className="text-sm text-slate-500 mb-12">
                          Penerima,
                        </p>
                        <p className="font-bold text-slate-800 underline decoration-slate-300 underline-offset-4">
                          {selectedPayslip.employee.name}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-500 mb-12">
                          Manajemen / Keuangan,
                        </p>
                        <p className="font-bold text-slate-800 underline decoration-slate-300 underline-offset-4">
                          {settings.brandName}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* --- PAYROLL TABLE --- */
                <Payroll />
              )}
            </motion.div>
          )}
        </div>

      {/* Modals */}
      {isEmployeeModalOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 flex justify-center items-start sm:items-center">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[88vh] my-auto">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
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
                      ? "bg-white text-indigo-700 shadow-xs"
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
                      ? "bg-white text-indigo-700 shadow-xs"
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
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
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
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.username} 
                        onChange={e => setEmpForm({...empForm, username: e.target.value})} 
                        placeholder="Contoh: budi"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Departemen</label>
                      <select 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.department} 
                        onChange={e => setEmpForm({...empForm, department: e.target.value})}
                      >
                        <option value="">-- Pilih --</option>
                        <option value="MAIN">Utama (Main)</option>
                        <option value="BAR">Bar</option>
                        <option value="KITCHEN">Dapur (Kitchen)</option>
                        <option value="BAKER">Baker (Roti)</option>
                        <option value="MANAGEMENT">Manajemen & Kantor</option>
                        <option value="FINANCE">Keuangan (Finance)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Jabatan</label>
                      <select 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.position} 
                        onChange={e => setEmpForm({...empForm, position: e.target.value})}
                      >
                        <option value="">-- Pilih --</option>
                        <option value="Kasir">Kasir</option>
                        <option value="Karyawan">Karyawan (Staff)</option>
                        <option value="Leader">Leader</option>
                        {currentUser?.role !== "MANAGER" && (
                          <option value="Finance">Finance / Staf Keuangan</option>
                        )}
                        {currentUser?.role !== "MANAGER" && (
                          <option value="Manager">Manager</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Status</label>
                      <select 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.status} 
                        onChange={e => setEmpForm({...empForm, status: e.target.value as any})}
                      >
                        <option value="AKTIF">Aktif</option>
                        <option value="TIDAK_AKTIF">Tidak Aktif</option>
                        <option value="RESIGN">Resign</option>
                        <option value="PHK">PHK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Tipe</label>
                      <select 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.employmentType} 
                        onChange={e => setEmpForm({...empForm, employmentType: e.target.value as any})}
                      >
                        <option value="TETAP">Tetap</option>
                        <option value="KONTRAK">Kontrak</option>
                        <option value="PARUH_WAKTU">Paruh Waktu</option>
                        <option value="MAGANG">Magang</option>
                      </select>
                    </div>
                  </div>

                  {!editingEmployee && (
                    <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={autoCreateUser}
                          onChange={(e) => setAutoCreateUser(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-indigo-950">Buat Akun Login Otomatis</span>
                      </label>
                      {autoCreateUser && (
                        <p className="text-[11px] text-indigo-700 mt-1 ml-6 leading-relaxed">
                          Username: <strong className="font-semibold text-indigo-900">{empForm.username || "[Username]"}</strong>, PIN default: <strong className="font-semibold text-indigo-900">123456</strong>
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
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.phone} 
                        onChange={e => setEmpForm({...empForm, phone: e.target.value})} 
                        placeholder="08123456789" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Email</label>
                      <input 
                        type="email" 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.email} 
                        onChange={e => setEmpForm({...empForm, email: e.target.value})} 
                        placeholder="email@contoh.com" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Alamat Domisili</label>
                    <textarea 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm resize-none h-20 transition-all" 
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
          </div>
        </div>,
        document.body
      )}

      {isContractModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-black/50 p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-200/80">
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
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={contractForm.employeeId} onChange={e => setContractForm({...contractForm, employeeId: e.target.value})}>
                  <option value="">Pilih Karyawan</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
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
          </div>
        </div>,
        document.body
      )}

      </div>

            {/* Verification Modal */}
      {isVerificationModalOpen && verifyingAttendance && (() => {
        const emp = employees.find((e) => e.id === verifyingAttendance.employeeId);
        return createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-slate-100 my-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {emp?.name ? emp.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {emp?.name || getEmployeeName(verifyingAttendance.employeeId)}
                    </h3>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
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
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {emp?.position || 'Staff'} • {emp?.department || 'Main'} | Tanggal: <span className="font-bold text-slate-700">{verifyingAttendance.date}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsVerificationModalOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 bg-slate-50/30">
              {/* Petunjuk Untuk Manager */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200/70 rounded-xl flex items-start gap-3 text-xs text-blue-900">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Validasi Kehadiran Fisik Lapangan</p>
                  <p className="text-blue-700/90 mt-0.5">
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
                        <span className="font-mono font-bold text-emerald-700 text-base">
                          {verifyingAttendance.clockInTime 
                            ? new Date(verifyingAttendance.clockInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
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
                          <a
                            href={verifyingAttendance.clockInPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            Buka Foto Penuh ↗
                          </a>
                        )}
                      </div>
                      {verifyingAttendance.clockInPhotoUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-inner">
                          <img 
                            src={verifyingAttendance.clockInPhotoUrl} 
                            alt="Foto Clock In" 
                            className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-102" 
                          />
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            Kamera Selfie
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
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
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
                        <span className="font-mono font-bold text-rose-700 text-base">
                          {verifyingAttendance.clockOutTime 
                            ? new Date(verifyingAttendance.clockOutTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
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
                          <a
                            href={verifyingAttendance.clockOutPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            Buka Foto Penuh ↗
                          </a>
                        )}
                      </div>
                      {verifyingAttendance.clockOutPhotoUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-inner">
                          <img 
                            src={verifyingAttendance.clockOutPhotoUrl} 
                            alt="Foto Clock Out" 
                            className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-102" 
                          />
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            Kamera Selfie
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
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
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
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-between gap-3 border-t border-slate-100 shrink-0">
              <button 
                type="button"
                onClick={() => setIsVerificationModalOpen(false)} 
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200/70 rounded-xl text-sm transition-colors"
              >
                Tutup
              </button>
              
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    if (confirm("Tolak kehadiran ini? Status karyawan akan diubah menjadi ALPHA dan tunjangan/gaji akan disesuaikan.")) {
                      updateDailyAttendance({
                        ...verifyingAttendance, 
                        approvalStatus: 'REJECTED', 
                        status: 'ALPHA'
                      });
                      setIsVerificationModalOpen(false);
                    }
                  }} 
                  className="px-5 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Tolak (Set Alpha)
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    updateDailyAttendance({
                      ...verifyingAttendance, 
                      approvalStatus: 'APPROVED'
                    });
                    setIsVerificationModalOpen(false);
                  }} 
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-200 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verifikasi Sah (Approve)</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
        );
      })()}

      {/* Attendance Modal */}
      {isAttendanceModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-black/50 p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-200/80">
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
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={attendanceForm.employeeId} onChange={e => setAttendanceForm({...attendanceForm, employeeId: e.target.value})}>
                  <option value="">Pilih Karyawan</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
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
              <button onClick={handleSaveAttendance} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Master Shift Configuration Modal */}
      {showShiftConfigModal && createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto border border-slate-100">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Pengaturan Master Shift & Jam Operasional</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
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
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-indigo-900">Petunjuk Konfigurasi Shift & Jam Kerja:</p>
                  <p className="leading-relaxed text-indigo-800">
                    • <strong>Jam Mulai & Selesai:</strong> Digunakan untuk acuan absensi (Clock-in/out) dan jadwal kerja tim operasional.
                  </p>
                  <p className="leading-relaxed text-indigo-800">
                    • <strong>Toleransi Keterlambatan:</strong> Waktu toleransi (menit). Jika toleransi 15 menit pada shift 07:00, maka kehadiran di atas 07:15 akan otomatis ditandai terlambat.
                  </p>
                  <p className="leading-relaxed text-indigo-800">
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
                      className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-xs"
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
                            ? "bg-white border-slate-200 shadow-2xs hover:border-indigo-300"
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
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
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
                            <select
                              value={s.color || "indigo"}
                              onChange={(e) => updateShiftField(idx, "color", e.target.value)}
                              className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-200 bg-white"
                            >
                              <option value="emerald">🟢 Emerald (Pagi)</option>
                              <option value="blue">🔵 Biru (Middle)</option>
                              <option value="amber">🟠 Amber (Sore)</option>
                              <option value="purple">🟣 Ungu (Khusus)</option>
                              <option value="indigo">🟦 Indigo (Malam)</option>
                            </select>

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
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
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
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
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
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
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
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowShiftConfigModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Pengaturan Shift</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Brief Mingguan & Pengesahan Jadwal Modal */}
      {isBriefModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[85vh] sm:max-h-[88vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                  <Megaphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Sahkan Jadwal & Kirim Brief Mingguan</h3>
                  <p className="text-xs text-emerald-100">
                    Periode: {weekDays[0].toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – {weekDays[6].toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
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
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: KOREKSI ABSENSI OLEH MANAGER (ATURAN #3 & AUDIT LOG) ── */}
      {isCorrectionModalOpen && correctingAttendance && (() => {
        const emp = employees.find((e) => e.id === correctingAttendance.employeeId);
        const inIso = correctionForm.clockInTime ? `${correctingAttendance.date}T${correctionForm.clockInTime}:00` : null;
        const outIso = correctionForm.clockOutTime ? `${correctingAttendance.date}T${correctionForm.clockOutTime}:00` : null;
        let previewHours = 0;
        if (inIso && outIso) {
          const diffMs = new Date(outIso).getTime() - new Date(inIso).getTime();
          previewHours = Math.max(0, diffMs / 3600000);
        }
        const previewOvertime = previewHours > 8 ? Math.round((previewHours - 8) * 10) / 10 : 0;

        return createPortal(
          <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/90 my-auto flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                  <select
                    value={correctionForm.status}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
                  >
                    <option value="HADIR">HADIR (Hadir Tepat Waktu)</option>
                    <option value="TERLAMBAT">TERLAMBAT (Hadir Melewati Toleransi)</option>
                    <option value="IZIN">IZIN (Izin Resmi dengan Surat)</option>
                    <option value="SAKIT">SAKIT (Sakit dengan Surat Dokter)</option>
                    <option value="ALPHA">ALPHA (Tanpa Keterangan)</option>
                  </select>
                </div>

                {/* Jam Masuk & Jam Pulang */}
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

                {/* Live Duration & Overtime Calculation */}
                <div className="p-3 bg-brand-50/60 rounded-2xl border border-brand-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-600 font-medium block">Total Durasi Kerja:</span>
                    <strong className="text-brand-950 font-mono font-extrabold text-sm">
                      {previewHours.toFixed(1)} Jam
                    </strong>
                  </div>
                  {previewOvertime > 0 ? (
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
                    <span className="text-[11px] text-slate-500 font-medium">Normal 8 Jam</span>
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
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan & Sahkan Koreksi</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        );
      })()}

    </div>
  );
}
