import React, { useState, useMemo, useRef } from "react";
import { useStore } from "../store/StoreContext";
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
  RotateCcw,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
    employeeShifts,
    setEmployeeShifts,
    updateDailyAttendance,
    dailyChecklists,
    setDailyChecklists,
    kpiRecords,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addContract,
    updateContract,
    addAttendance,
    updateAttendance,
    addKPI,
    updateKPI,
    addUser,
    updateUser,
    deleteUser,
  } = useStore();

  const isIndo = settings.language === "id";
  const isLeader = currentUser?.role === "LEADER";
  const leaderDivision = currentUser?.department || 
    (currentUser?.role === "KITCHEN" ? "KITCHEN" : 
     currentUser?.role === "BAKER" ? "BAKER" : "BAR");
  const [scheduleDivisionFilter, setScheduleDivisionFilter] = useState<string>(
    currentUser?.role === "LEADER" ? (currentUser?.department || "BAR") : "ALL"
  );
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
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<any | null>(null);

  const [attendanceForm, setAttendanceForm] = useState({ employeeId: "", period: "", presentDays: 0, sickDays: 0, permissionDays: 0, alphaDays: 0, notes: "" });
  const [kpiForm, setKpiForm] = useState({ employeeId: "", period: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), totalScore: 0, evaluatorNotes: "", kpiBonus: 0, targets: [{ id: "1", description: "", weight: 100, score: 0 }] });

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

  const handleOpenKpiModal = (kpi?: any, employeeId?: string) => {
    if (kpi && kpi.id) {
      setEditingKpi(kpi);
      setKpiForm({ ...kpi, targets: kpi.targets || [{ id: "1", description: "", weight: 100, score: 0 }] });
    } else {
      setEditingKpi(null);
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      setKpiForm({ employeeId: employeeId || "", period: `${currentYear}-${currentMonth.toString().padStart(2, '0')}`, month: currentMonth, year: currentYear, totalScore: 0, evaluatorNotes: "", kpiBonus: 0, targets: [{ id: "1", description: "Target 1", weight: 100, score: 0 }] });
    }
    setIsKpiModalOpen(true);
  };

  const handleSaveKpi = () => {
    if (!kpiForm.employeeId) return alert("Pilih Karyawan");
    
    // Auto calculate bonus based on target from contract
    const contract = contracts.find(c => c.employeeId === kpiForm.employeeId && c.status === "ACTIVE") || contracts.find(c => c.employeeId === kpiForm.employeeId);
    const kpiBonusTarget = contract?.kpiBonusTarget || 0;
    
    // Calculate total score from targets
    let calculatedScore = 0;
    if (kpiForm.targets && kpiForm.targets.length > 0) {
      calculatedScore = kpiForm.targets.reduce((sum: number, t: any) => sum + (t.score * (t.weight / 100)), 0);
    } else {
      calculatedScore = kpiForm.totalScore;
    }
    
    const kpiBonus = (calculatedScore / 100) * kpiBonusTarget;
    
    const kpiToSave = { ...kpiForm, period: `${kpiForm.year}-${kpiForm.month.toString().padStart(2, '0')}`, totalScore: calculatedScore, kpiBonus };
    if (editingKpi) {
      updateKPI({ ...editingKpi, ...kpiToSave });
    } else {
      addKPI(kpiToSave);
    }
    setIsKpiModalOpen(false);
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
    if (!empForm.username || !empForm.name) return alert("Username dan Nama wajib diisi");
    
    const posUpper = (empForm.position || "").toUpperCase();
    const deptUpper = (empForm.department || "").toUpperCase();

    // Mapping peran sistem yang presisi berdasarkan Jabatan & Departemen
    let calculatedRole: Role = "KASIR";
    if (posUpper.includes("MANAGER") || posUpper.includes("MANAJER")) {
      calculatedRole = "MANAGER";
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
          u.username.toLowerCase() === empForm.username.toLowerCase()
      );

      if (relatedUser) {
        if (empForm.status !== "AKTIF") {
          deleteUser(relatedUser.id);
          alert("Akun login terkait telah dinonaktifkan/dihapus karena status karyawan menjadi " + empForm.status);
        } else {
          updateUser({
            ...relatedUser,
            username: empForm.username.toLowerCase().trim(),
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
          username: empForm.username.toLowerCase().trim(),
          pin: "123456",
          role: calculatedRole,
          department: calculatedRole === "LEADER" ? (empForm.department as any) : null,
          employeeId: newEmpId
        });
        alert(`Karyawan berhasil ditambahkan.\nAkun login otomatis dibuat:\nUsername: ${empForm.username.toLowerCase().trim()}\nPIN: 123456\nRole: ${calculatedRole}`);
      }
    }
    setIsEmployeeModalOpen(false);
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

  const handleImportKPI = (data: any[]) => {
    let imported = 0;
    data.forEach(row => {
      const empId = employees.find(e => e.username === row["Username"])?.id;
      const quarter = Number(row["Kuartal (1-4)"]);
      const year = Number(row["Tahun"]);
      if (empId && quarter && year) {
        addKPI({
          employeeId: empId,
          period: `Q${quarter}-${year}`,
          quarter, year,
          totalScore: Number(row["Total Skor"]) || 0,
          kpiBonus: Number(row["Bonus KPI"]) || 0,
          evaluatorNotes: row["Catatan Evaluator"] || ""
        });
        imported++;
      }
    });
    if (imported > 0) alert(`Berhasil mengimport ${imported} KPI.`);
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
    if (!contractForm.employeeId) return alert("Pilih karyawan terlebih dahulu");
    if (editingContract) {
      updateContract({ ...editingContract, ...contractForm });
    } else {
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


  const isHRD =
    currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "OWNER";
  const isFinance =
    currentUser?.role === "FINANCE" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "OWNER";
  const canEditHR = isHRD && !isReadOnly;

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
    const day = today.getDay(); // 0 = Sunday, 1 = Monday
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(today.setDate(diff));
  });

  const generateWeekDays = (start: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };
  const weekDays = generateWeekDays(currentWeekStart);
  const weekKey = weekDays[0].toISOString().split("T")[0];
  const currentWeekApproval = (settings?.scheduleApprovals as any)?.[weekKey] || { status: "DRAFT" };
  const isWeekApproved = currentWeekApproval.status === "APPROVED";

  const handleToggleWeekApproval = () => {
    if (!isHRD || isReadOnly) return;
    const newStatus = isWeekApproved ? "DRAFT" : "APPROVED";
    const newApprovals = {
      ...((settings?.scheduleApprovals as any) || {}),
      [weekKey]: {
        status: newStatus,
        approvedBy: currentUser?.name || "Manager",
        approvedAt: new Date().toISOString(),
      }
    };
    updateSettings({
      ...settings,
      scheduleApprovals: newApprovals,
    });
  };

  const canEditShiftForEmployee = (emp: any) => {
    if (isReadOnly) return false;
    if (isHRD) return true; // Manager, Owner, Super Admin can always edit
    if (isLeader) {
      if (isWeekApproved) return false; // Locked once approved!
      const empDiv = emp.department || (emp.position?.toUpperCase().includes("KITCHEN") ? "KITCHEN" : emp.position?.toUpperCase().includes("BAKER") ? "BAKER" : "BAR");
      return !leaderDivision || empDiv === leaderDivision;
    }
    return false;
  };

  const filteredScheduleEmployees = useMemo(() => {
    let list = employees.filter(e => e.status === "AKTIF");
    if (isLeader && leaderDivision) {
      list = list.filter(e => e.department === leaderDivision || (!e.department && leaderDivision === "BAR"));
    } else if (scheduleDivisionFilter !== "ALL") {
      list = list.filter(e => e.department === scheduleDivisionFilter || (!e.department && scheduleDivisionFilter === "MAIN"));
    }
    return list;
  }, [employees, isLeader, leaderDivision, scheduleDivisionFilter]);

  // Smart Collision Detection
  const scheduleCollisions = useMemo(() => {
    const warnings: { id: string; type: "clopen" | "understaffed" | "overwork"; message: string; severity: "high" | "medium" }[] = [];
    
    // 1. Clopen Check (Shift Sore jam 15-23 lalu besoknya Shift Pagi jam 07-15)
    const activeEmps = isLeader && leaderDivision 
      ? employees.filter(e => e.status === "AKTIF" && (e.department === leaderDivision || (!e.department && leaderDivision === "BAR")))
      : employees.filter(e => e.status === "AKTIF");

    activeEmps.forEach(emp => {
      for (let i = 0; i < 6; i++) {
        const dayA = weekDays[i].toISOString().split("T")[0];
        const dayB = weekDays[i + 1].toISOString().split("T")[0];
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
        const dStr = d.toISOString().split("T")[0];
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
    const divisionsToCheck = isLeader && leaderDivision ? [leaderDivision] : ["BAR", "KITCHEN", "BAKER", "MAIN"];
    weekDays.forEach((d) => {
      const dStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
      
      divisionsToCheck.forEach(div => {
        const divEmps = employees.filter(e => e.status === "AKTIF" && (e.department === div || (!e.department && div === "MAIN")));
        if (divEmps.length >= 2) {
          const morningCount = divEmps.filter(e => {
            const s = employeeShifts.find(sh => sh.employeeId === e.id && sh.date === dStr)?.shiftType;
            return s === "PAGI";
          }).length;
          const afternoonCount = divEmps.filter(e => {
            const s = employeeShifts.find(sh => sh.employeeId === e.id && sh.date === dStr)?.shiftType;
            return s === "SORE";
          }).length;
          
          if (morningCount === 0 && afternoonCount > 0) {
            warnings.push({
              id: `understaffed-pagi-${div}-${dStr}`,
              type: "understaffed",
              severity: "medium",
              message: `Shift Pagi Kosong: Divisi ${div} tidak memiliki staf bertugas di Shift Pagi pada ${dayName}.`
            });
          } else if (afternoonCount === 0 && morningCount > 0) {
            warnings.push({
              id: `understaffed-sore-${div}-${dStr}`,
              type: "understaffed",
              severity: "medium",
              message: `Shift Sore Kosong: Divisi ${div} tidak memiliki staf bertugas di Shift Sore pada ${dayName}.`
            });
          }
        }
      });
    });

    return warnings;
  }, [employees, employeeShifts, weekDays, isLeader, leaderDivision]);

  const handleShiftChange = (empId: string, dateStr: string, shiftType: "PAGI" | "SORE" | "MIDDLE" | "OFF") => {
    const existing = employeeShifts.find(s => s.employeeId === empId && s.date === dateStr);
    let newShifts = [...employeeShifts];
    if (existing) {
      existing.shiftType = shiftType;
    } else {
      newShifts.push({
        id: crypto.randomUUID(),
        employeeId: empId,
        date: dateStr,
        shiftType: shiftType
      });
    }
    setEmployeeShifts(newShifts);
  };

  // --- Chart Data ---
  const attendanceChartData = useMemo(() => {
    return attendances.map((a) => ({
      name: getEmployeeName(a.employeeId).substring(0, 10),
      Hadir: a.presentDays,
      Alpha: a.alphaDays,
      Izin: a.sickDays + a.permissionDays,
    }));
  }, [attendances]);

  // --- PDF Generation ---
  const generatePDF = async () => {
    if (!payslipRef.current) return;
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
        `Slip_Gaji_${selectedPayslip?.employee?.name?.replace(/\\s+/g, "_")}_${selectedPayslip?.period}.pdf`,
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  // ─── PAYROLL CALCULATION ──────────────────────────────────────────────────────────
  const payrollData = useMemo(() => {
    // Generate payroll based on attendance records
    return attendances
      .map((att) => {
        const emp = employees.find((e) => e.id === att.employeeId);
        const contract = contracts.find((c) => c.employeeId === att.employeeId);

        if (!emp || !contract) return null;

        const basic = contract.basicSalary;
        const meal = contract.mealAllowance * att.presentDays;
        const position = contract.positionAllowance;
        const dailyWage = Math.round(contract.basicSalary / 25);
        const alphaDeduction = ((contract.alphaDeductionPerDay !== undefined && contract.alphaDeductionPerDay !== 0) ? contract.alphaDeductionPerDay : dailyWage) * att.alphaDays;

        // Get KPI Bonus for this quarter if it falls in the attendance period
        // (Simple approximation: if attendance period month matches quarter end)
        const month = parseInt(att.period.split("-")[1]);
        const quarter = Math.ceil(month / 3);
        const year = parseInt(att.period.split("-")[0]);

        const kpi = kpiRecords.find(
          (k) =>
            k.employeeId === emp.id && k.quarter === quarter && k.year === year,
        );
        const targetKpi = contract.kpiBonusTarget || 0;
        const empChecklists = (dailyChecklists || []).filter(
          (c) => c.employeeId === emp.id && c.date.startsWith(att.period)
        );
        const isLeader = emp.position?.toUpperCase().includes("LEADER") || emp.position?.toUpperCase().includes("HEAD");
        const kpiBonus = kpi 
          ? kpi.kpiBonus 
          : (targetKpi > 0 
              ? (isLeader 
                  ? Math.round(targetKpi * Math.min(1, empChecklists.length / Math.max(1, att.presentDays || 25))) 
                  : targetKpi) 
              : 0);

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
  }, [attendances, employees, contracts, kpiRecords, dailyChecklists]);

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[150px] py-4 px-6 flex items-center justify-center gap-2 text-sm font-semibold transition-colors
                ${
                  activeTab === tab.id
                    ? "border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-indigo-900 text-sm font-semibold">
                      {isIndo ? "Total Karyawan" : "Total Employees"}
                    </h3>
                    <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-indigo-900">
                    {employees.filter((e) => e.status === "ACTIVE").length}
                  </p>
                  <p className="text-sm text-indigo-600 mt-2">
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
                    {kpiRecords.length > 0
                      ? (
                          kpiRecords.reduce((sum, k) => sum + k.score, 0) /
                          kpiRecords.length
                        ).toFixed(1)
                      : "0.0"}
                  </p>
                  <p className="text-sm text-emerald-600 mt-2">
                    {isIndo ? "Dari skala 100" : "Out of 100"}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-2xl border border-amber-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-amber-900 text-sm font-semibold">
                      {isIndo ? "Total Gaji Pokok" : "Total Basic Salary"}
                    </h3>
                    <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">
                    {formatRupiah(
                      contracts
                        .filter((c) => c.isActive)
                        .reduce((sum, c) => sum + c.basicSalary, 0),
                    )}
                  </p>
                  <p className="text-sm text-amber-600 mt-2">
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
                      payrollData.reduce((sum, p) => sum + p.total, 0),
                    )}
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
                    {isIndo ? "Periode Berjalan" : "Current Period"}
                  </p>
                </motion.div>
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
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo ? "Data Karyawan" : "Employee Data"}
                </h3>
                {canEditHR && (
                  <div className="flex items-center gap-3">
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
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />{" "}
                      {isIndo ? "Tambah Karyawan" : "Add Employee"}
                    </button>
                  </div>
                )}
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
                    {employees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-500 italic"
                        >
                          {isIndo
                            ? "Belum ada data karyawan."
                            : "No employees data yet."}
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
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
                              ${emp.status === "AKTIF" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          {canEditHR && (
                            <td className="py-3 px-4 flex justify-end gap-2">
                              <button 
                                onClick={() => handleOpenEmployeeModal(emp)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
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
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo ? "Struktur Gaji & Kontrak" : "Salary & Contracts"}
                </h3>
                {canEditHR && (
                  <div className="flex items-center gap-3">
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
                    <button onClick={() => handleOpenContractModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                      <Plus className="w-4 h-4" /> {isIndo ? "Tambah Kontrak" : "Add Contract"}
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
                    {contracts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canEditHR ? 6 : 5}
                          className="py-8 text-center text-slate-500 italic"
                        >
                          {isIndo
                            ? "Belum ada data kontrak."
                            : "No contract data yet."}
                        </td>
                      </tr>
                    ) : (
                      contracts.map((c) => {
                        const isExpiring = (() => {
                          if (!c.endDate || c.status !== 'ACTIVE') return false;
                          const end = new Date(c.endDate);
                          const thirtyDays = new Date();
                          thirtyDays.setDate(new Date().getDate() + 30);
                          return end >= new Date() && end <= thirtyDays;
                        })();
                        
                        return (
                          <tr
                            key={c.id}
                            className={`border-b border-slate-100 hover:bg-slate-50 ${isExpiring ? 'bg-amber-50/50' : ''}`}
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
                                  {isExpiring && (
                                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full inline-block w-max">
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
                              <td className="py-3 px-4 flex justify-end gap-2">
                                <button 
                                  onClick={() => handleOpenContractModal(c)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
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
                      {isLeader ? (isIndo ? `Jadwal Shift Tim ${leaderDivision || ""}` : `Team Shift Schedule`) : (isIndo ? "Jadwal Shift & Evaluasi" : "Shift Schedule & Review")}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isWeekApproved 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {isWeekApproved ? "● APPROVED (Disetujui Manajer)" : "● DRAFT (Penyusunan Leader)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isLeader 
                      ? "Susun giliran shift tim Anda. Pastikan tidak ada jam shift kosong sebelum disetujui Manajer."
                      : "Tinjau jadwal yang disusun Leader divisi. Periksa deteksi bentrok sebelum menyetujui jadwal."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                  {/* Week Navigator */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => {
                        const prev = new Date(currentWeekStart);
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
                        next.setDate(next.getDate() + 7);
                        setCurrentWeekStart(next);
                      }}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                    >
                      Minggu Depan &raquo;
                    </button>
                  </div>

                  {/* Manager Approval Button */}
                  {isHRD && (
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
                          <span>Setujui Jadwal (Approve)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Division Filter Tabs for Manager */}
              {!isLeader && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Divisi:
                  </span>
                  {[
                    { id: "ALL", label: "Semua Divisi" },
                    { id: "BAR", label: "☕ Bar" },
                    { id: "KITCHEN", label: "🍳 Kitchen" },
                    { id: "BAKER", label: "🥐 Baker" },
                    { id: "MAIN", label: "🛎️ Utama & Kasir" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setScheduleDivisionFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scheduleDivisionFilter === tab.id
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

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
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <strong>Pagi:</strong> 07:00 – 15:00
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    <strong>Middle:</strong> 11:00 – 19:00
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <strong>Sore:</strong> 15:00 – 23:00
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                    <strong>OFF:</strong> Libur
                  </span>
                </div>
                {isLeader && isWeekApproved && (
                  <span className="text-emerald-700 font-semibold italic text-[11px]">
                    🔒 Jadwal minggu ini telah dikunci/disetujui oleh Manajer.
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
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600">
                                  {emp.department || "MAIN"}
                                </span>
                                <span className="text-[11px] text-slate-400 truncate">{emp.position}</span>
                              </div>
                            </td>
                            {weekDays.map((d, idx) => {
                              const dateStr = d.toISOString().split("T")[0];
                              const shift = employeeShifts.find(s => s.employeeId === emp.id && s.date === dateStr)?.shiftType || "OFF";
                              return (
                                <td key={idx} className="p-2 border-l border-slate-100 text-center">
                                  <select
                                    disabled={!canEditThisEmp}
                                    value={shift}
                                    onChange={(e) => handleShiftChange(emp.id, dateStr, e.target.value as any)}
                                    className={`w-full text-xs font-bold py-1.5 px-2 rounded-xl border transition-all ${
                                      !canEditThisEmp ? "cursor-not-allowed opacity-90" : "cursor-pointer"
                                    } ${
                                      shift === "PAGI" ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                                      shift === "SORE" ? "bg-amber-50 text-amber-800 border-amber-300" :
                                      shift === "MIDDLE" ? "bg-blue-50 text-blue-800 border-blue-300" :
                                      "bg-slate-100 text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    <option value="OFF">OFF (Libur)</option>
                                    <option value="PAGI">Pagi (07-15)</option>
                                    <option value="MIDDLE">Middle (11-19)</option>
                                    <option value="SORE">Sore (15-23)</option>
                                  </select>
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
            <div className="space-y-8">
              <KPI />
              <div className="pt-6 border-t border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800">
                    {isIndo ? "Riwayat Penilaian KPI (Kuartal)" : "KPI Assessment (Quarterly)"}
                  </h3>
                {canEditHR && (
                  <div className="flex items-center gap-3">
                    <CsvImportExport
                      onImport={handleImportKPI}
                      templateHeaders={["Username", "Kuartal (1-4)", "Tahun", "Total Skor", "Bonus KPI", "Catatan Evaluator"]}
                      templateExampleRow={["EMP-001", "1", "2024", "85", "250000", "Kinerja sangat baik"]}
                      templateFilename="template_kpi"
                      buttonLabel={isIndo ? "Import" : "Import"}
                      templateDropdowns={{
                        Username: employees.map(e => e.username).filter(Boolean),
                        "Kuartal (1-4)": ["1", "2", "3", "4"],
                      }}
                      templateColumnTypes={{
                        "Kuartal (1-4)": "integer",
                        "Tahun": "integer",
                        "Total Skor": "number",
                        "Bonus KPI": "number",
                      }}
                      templateHints={{
                        Username: "Pilih username karyawan",
                        "Kuartal (1-4)": "Pilih 1, 2, 3, atau 4",
                        "Total Skor": "Nilai 0–100",
                      }}
                    />
                    <button onClick={() => handleOpenKpiModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                      <Plus className="w-4 h-4" /> {isIndo ? "Tambah KPI" : "Add KPI"}
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
                      <th className="py-3 px-4 font-semibold">Qtr/Tahun</th>
                      <th className="py-3 px-4 font-semibold">Skor Total</th>
                      <th className="py-3 px-4 font-semibold">Bonus KPI</th>
                      {canEditHR && (
                        <th className="py-3 px-4 font-semibold text-right">
                          Aksi
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-slate-500 italic"
                        >
                          {isIndo ? "Belum ada data KPI." : "No KPI data yet."}
                        </td>
                      </tr>
                    ) : (
                      kpiRecords.map((k) => (
                        <tr
                          key={k.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {getEmployeeName(k.employeeId)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            Q{k.quarter} {k.year}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full 
                              ${k.totalScore >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {k.totalScore.toFixed(1)} / 100
                            </span>
                          </td>
                          <td className="py-3 px-4 text-emerald-600 font-mono font-medium">
                            {formatRupiah(k.kpiBonus)}
                          </td>
                          {canEditHR && (
                            <td className="py-3 px-4 flex justify-end gap-2">
                              <button 
                                onClick={() => handleOpenKpiModal(k)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                            presentDays: logs.filter(l => ["HADIR", "TERLAMBAT"].includes(l.status)).length,
                            sickDays: logs.filter(l => l.status === "SAKIT").length,
                            permissionDays: logs.filter(l => l.status === "IZIN").length,
                            alphaDays: logs.filter(l => l.status === "ALPHA").length,
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
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={attendanceDateFilter}
                        onChange={(e) => setAttendanceDateFilter(e.target.value)}
                        className="bg-transparent border-0 outline-none text-xs text-slate-700 cursor-pointer font-medium"
                      />
                      {attendanceDateFilter && (
                        <button
                          onClick={() => setAttendanceDateFilter("")}
                          className="text-[11px] text-blue-600 hover:text-blue-700 font-bold ml-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>

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

                    <button
                      onClick={() => setAttendanceDateFilter(new Date().toISOString().substring(0, 10))}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      Hari Ini
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4 font-bold">Tanggal</th>
                        <th className="py-3 px-4 font-bold">Karyawan</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Foto Selfie (In / Out)</th>
                        <th className="py-3 px-4 font-bold">Lokasi GPS</th>
                        <th className="py-3 px-4 font-bold">Jam In / Out</th>
                        <th className="py-3 px-4 font-bold">Durasi</th>
                        <th className="py-3 px-4 font-bold text-right">Verifikasi Manager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = [...dailyAttendances]
                          .filter((d) => {
                            if (attendanceDateFilter && d.date !== attendanceDateFilter) return false;
                            if (attendanceEmpFilter !== "ALL" && d.employeeId !== attendanceEmpFilter) return false;
                            return true;
                          })
                          .sort((a, b) => b.date.localeCompare(a.date) || (b.clockInTime || "").localeCompare(a.clockInTime || ""));

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400 italic text-sm">
                                Tidak ada catatan kehadiran sesuai filter yang dipilih.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((d) => {
                          const emp = employees.find((e) => e.id === d.employeeId);
                          return (
                            <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-xs">
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
                                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${
                                  d.status === "HADIR" ? "bg-emerald-100 text-emerald-800" :
                                  d.status === "TERLAMBAT" ? "bg-amber-100 text-amber-800" :
                                  d.status === "IZIN" ? "bg-blue-100 text-blue-800" :
                                  d.status === "SAKIT" ? "bg-rose-100 text-rose-800" :
                                  "bg-slate-200 text-slate-700"
                                }`}>
                                  {d.status}
                                </span>
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
                                <div className="flex items-center justify-end gap-2">
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
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 flex min-h-full items-start sm:items-center justify-center py-6 sm:py-8">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200/80 flex flex-col max-h-[calc(100vh-3.5rem)] my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                {editingEmployee ? (isIndo ? "Edit Karyawan" : "Edit Employee") : (isIndo ? "Tambah Karyawan" : "Add Employee")}
              </h3>
              <button 
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-200/60"
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
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {empModalTab === "basic" ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Nama Lengkap <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                      value={empForm.name} 
                      onChange={e => setEmpForm({...empForm, name: e.target.value})} 
                      placeholder="Contoh: Budi Santoso"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Username (Login) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                      value={empForm.username} 
                      onChange={e => setEmpForm({...empForm, username: e.target.value})} 
                      placeholder="Contoh: budi"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Departemen</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.department} 
                        onChange={e => setEmpForm({...empForm, department: e.target.value})}
                      >
                        <option value="">-- Pilih --</option>
                        <option value="MAIN">Utama (Main)</option>
                        <option value="BAR">Bar</option>
                        <option value="KITCHEN">Dapur (Kitchen)</option>
                        <option value="BAKER">Baker (Roti)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Jabatan</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                        value={empForm.position} 
                        onChange={e => setEmpForm({...empForm, position: e.target.value})}
                      >
                        <option value="">-- Pilih --</option>
                        <option value="Kasir">Kasir</option>
                        <option value="Karyawan">Karyawan (Staff)</option>
                        <option value="Leader">Leader</option>
                        {currentUser?.role !== "MANAGER" && (
                          <option value="Manager">Manager</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
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
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tipe</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
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
                    <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
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
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">No. HP / WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                      value={empForm.phone} 
                      onChange={e => setEmpForm({...empForm, phone: e.target.value})} 
                      placeholder="08123456789" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                    <input 
                      type="email" 
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all" 
                      value={empForm.email} 
                      onChange={e => setEmpForm({...empForm, email: e.target.value})} 
                      placeholder="email@contoh.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Domisili</label>
                    <textarea 
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm resize-none h-24 transition-all" 
                      value={empForm.address} 
                      onChange={e => setEmpForm({...empForm, address: e.target.value})} 
                      placeholder="Alamat domisili lengkap..." 
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3 shrink-0">
              <button 
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)} 
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSaveEmployee} 
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-xs transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingContract ? "Edit Kontrak" : "Tambah Kontrak"}
              </h3>
              <button onClick={() => setIsContractModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
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
                  <input type="date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.startDate} onChange={e => setContractForm({...contractForm, startDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tgl Berakhir (Kosongkan jika tetap)</label>
                  <input type="date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.endDate || ""} onChange={e => setContractForm({...contractForm, endDate: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0">
              <button onClick={() => setIsContractModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleSaveContract} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      </div>

            {/* Verification Modal */}
      {isVerificationModalOpen && verifyingAttendance && (() => {
        const emp = employees.find((e) => e.id === verifyingAttendance.employeeId);
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
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
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
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
        </div>
        );
      })()}

      {/* Attendance Modal */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingAttendance ? (isIndo ? "Edit Absensi" : "Edit Attendance") : (isIndo ? "Tambah Absensi" : "Add Attendance")}
              </h3>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Periode (YYYY-MM)</label>
                <input type="month" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={attendanceForm.period} onChange={e => setAttendanceForm({...attendanceForm, period: e.target.value})} />
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
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0">
              <button onClick={() => setIsAttendanceModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleSaveAttendance} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Modal */}
      {isKpiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingKpi ? (isIndo ? "Edit KPI" : "Edit KPI") : (isIndo ? "Tambah KPI" : "Add KPI")}
              </h3>
              <button onClick={() => setIsKpiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Karyawan</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={kpiForm.employeeId} onChange={e => setKpiForm({...kpiForm, employeeId: e.target.value})}>
                  <option value="">Pilih Karyawan</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={kpiForm.month || 1} onChange={e => setKpiForm({...kpiForm, month: Number(e.target.value)})}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={kpiForm.year} onChange={e => setKpiForm({...kpiForm, year: Number(e.target.value)})} />
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-slate-700">Target KPI & Pencapaian</h4>
                  <button type="button" onClick={() => setKpiForm({...kpiForm, targets: [...(kpiForm.targets || []), { id: Date.now().toString(), description: "", weight: 0, score: 0 }]})} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100">
                    + Tambah Target
                  </button>
                </div>
                <div className="space-y-3">
                  {(kpiForm.targets || []).map((target: any, index: number) => (
                    <div key={target.id || index} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <input type="text" placeholder="Deskripsi Tugas/Target" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" value={target.description} onChange={e => {
                          const newT = [...kpiForm.targets];
                          newT[index].description = e.target.value;
                          setKpiForm({...kpiForm, targets: newT});
                        }} />
                      </div>
                      <div className="w-20">
                        <input type="number" placeholder="Bobot %" title="Bobot %" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" value={target.weight} onChange={e => {
                          const newT = [...kpiForm.targets];
                          newT[index].weight = Number(e.target.value);
                          setKpiForm({...kpiForm, targets: newT});
                        }} />
                      </div>
                      <div className="w-20 flex items-center gap-1">
                        <input type="number" placeholder="Skor" title="Skor (0-100)" max="100" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" value={target.score} onChange={e => {
                          const newT = [...kpiForm.targets];
                          newT[index].score = Number(e.target.value);
                          setKpiForm({...kpiForm, targets: newT});
                        }} />
                      </div>
                      <button type="button" onClick={() => {
                        const newT = kpiForm.targets.filter((_, i) => i !== index);
                        setKpiForm({...kpiForm, targets: newT});
                      }} className="text-red-500 p-1 hover:bg-red-50 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!kpiForm.targets || kpiForm.targets.length === 0) && (
                    <div className="text-sm text-slate-500 text-center py-2">Belum ada target. (Total skor akan diambil dari Skor Total manual jika kosong)</div>
                  )}
                  {(!kpiForm.targets || kpiForm.targets.length === 0) && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Skor Total (0-100)</label>
                        <input type="number" step="0.1" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={kpiForm.totalScore || 0} onChange={e => setKpiForm({...kpiForm, totalScore: Number(e.target.value)})} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Evaluator</label>
                <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={kpiForm.evaluatorNotes || ""} onChange={e => setKpiForm({...kpiForm, evaluatorNotes: e.target.value})} rows={2}></textarea>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0">
              <button onClick={() => setIsKpiModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleSaveKpi} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
