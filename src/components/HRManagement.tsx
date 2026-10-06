import React, { useState, useMemo, useRef } from "react";
import { useStore } from "../store/StoreContext";
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
  } = useStore();

  const isIndo = settings.language === "id";
  const [activeTab, setActiveTab] = useState<
    "overview" | "employees" | "contracts" | "kpi" | "attendance" | "payroll"
  >("overview");
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const payslipRef = useRef<HTMLDivElement>(null);

  // --- Modals State ---
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any | null>(null);

  // --- Modal Form State ---
  const [empForm, setEmpForm] = useState({ username: "", name: "", position: "", department: "", status: "AKTIF" as any, employmentType: "TETAP" as any });
  const [autoCreateUser, setAutoCreateUser] = useState(true);
  const [contractForm, setContractForm] = useState({ employeeId: "", basicSalary: 0, positionAllowance: 0, mealAllowance: 0, transportAllowance: 0, kpiBonusTarget: 0, alphaDeductionPerDay: 0, startDate: "", endDate: "", status: "ACTIVE" as any });

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
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
      setEmpForm({ username: emp.username, name: emp.name, position: emp.position, department: emp.department, status: emp.status, employmentType: emp.employmentType });
    } else {
      setEditingEmployee(null);
      setEmpForm({ username: "", name: "", position: "", department: "", status: "AKTIF", employmentType: "TETAP" });
      setAutoCreateUser(true);
    }
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = () => {
    if (!empForm.username || !empForm.name) return alert("Username dan Nama wajib diisi");
    if (editingEmployee) {
      updateEmployee({ ...editingEmployee, ...empForm });
    } else {
      const newEmpId = addEmployee(empForm);
      if (autoCreateUser && newEmpId) {
        // Auto create user account
        let defaultRole: any = "KASIR";
        const deptUpper = empForm.department.toUpperCase();
        if (deptUpper.includes("BAR")) defaultRole = "BAR";
        else if (deptUpper.includes("KITCHEN") || deptUpper.includes("DAPUR")) defaultRole = "KITCHEN";
        else if (deptUpper.includes("BAKER")) defaultRole = "BAKER";
        
        addUser({
          name: empForm.name,
          username: empForm.username.toLowerCase(),
          pin: "123456",
          role: defaultRole,
          employeeId: newEmpId
        });
        alert(`Karyawan berhasil ditambahkan.\nAkun login otomatis dibuat:\nUsername: ${empForm.username.toLowerCase()}\nPIN: 123456\nRole: ${defaultRole}`);
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
              username: nik || existing.username,
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
      const empId = employees.find(e => e.nik === row["Username"])?.id;
      if (empId) {
        addContract({
          employeeId: empId,
          basicSalary: Number(row["Gaji Pokok"]) || 0,
          positionAllowance: Number(row["Tunjangan Jabatan"]) || 0,
          mealAllowance: Number(row["Tunjangan Makan"]) || 0,
          transportAllowance: Number(row["Tunjangan Transport"]) || 0,
          kpiBonusTarget: Number(row["Target Bonus KPI"]) || 0,
          alphaDeductionPerDay: Number(row["Potongan Alpha/Hari"]) || 0,
          startDate: row["Mulai Kontrak"] || new Date().toISOString().split('T')[0],
          endDate: row["Selesai Kontrak"] || new Date().toISOString().split('T')[0],
          status: "ACTIVE"
        });
        imported++;
      }
    });
    if (imported > 0) alert(`Berhasil mengimport ${imported} kontrak.`);
    else alert("Tidak ada data valid yang diimport. Pastikan NIK karyawan sesuai.");
  };

  const handleImportAttendances = (data: any[]) => {
    let imported = 0;
    data.forEach(row => {
      const empId = employees.find(e => e.nik === row["Username"])?.id;
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
    else alert("Tidak ada data valid yang diimport. Pastikan NIK karyawan sesuai.");
  };

  const handleImportKPI = (data: any[]) => {
    let imported = 0;
    data.forEach(row => {
      const empId = employees.find(e => e.nik === row["Username"])?.id;
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
    else alert("Tidak ada data valid yang diimport. Pastikan NIK karyawan sesuai.");
  };

  const handleOpenContractModal = (contract?: any, employeeId?: string) => {
    if (contract && contract.id) {
      setEditingContract(contract);
      setContractForm({ ...contract });
    } else {
      setEditingContract(null);
      setContractForm({ employeeId: employeeId || "", basicSalary: 0, positionAllowance: 0, mealAllowance: 0, transportAllowance: 0, kpiBonusTarget: 0, alphaDeductionPerDay: 0, startDate: new Date().toISOString().split("T")[0], endDate: "", status: "ACTIVE" });
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
    setIsContractModalOpen(false);
  };


  const isHRD =
    currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";
  const isFinance =
    currentUser?.role === "FINANCE" || currentUser?.role === "SUPER_ADMIN";
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
        const alphaDeduction = contract.alphaDeductionPerDay * att.alphaDays;

        // Get KPI Bonus for this quarter if it falls in the attendance period
        // (Simple approximation: if attendance period month matches quarter end)
        const month = parseInt(att.period.split("-")[1]);
        const quarter = Math.ceil(month / 3);
        const year = parseInt(att.period.split("-")[0]);

        const kpi = kpiRecords.find(
          (k) =>
            k.employeeId === emp.id && k.quarter === quarter && k.year === year,
        );
        const kpiBonus = kpi ? kpi.kpiBonus : 0;

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
  }, [attendances, employees, contracts, kpiRecords]);

  // ─── TABS ──────────────────────────────────────────────────────────
  const tabs = [
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
    { id: "kpi", label: "KPI", icon: Target },
    {
      id: "attendance",
      label: isIndo ? "Absensi" : "Attendance",
      icon: Calendar,
    },
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
                      templateHeaders={["NIK", "Nama Karyawan", "Posisi", "Departemen", "Status", "Tipe"]}
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
                      <th className="py-3 px-4 font-semibold">NIK</th>
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
                              <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
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

              {/* Daily Attendances for Manager */}
              <div className="mt-12">
                <h3 className="text-lg font-bold text-slate-800 mb-6">
                  {isIndo ? "Log Kehadiran & Pengajuan Harian" : "Daily Attendance & Leave Log"}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                        <th className="py-3 px-4 font-semibold">Tanggal</th>
                        <th className="py-3 px-4 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Jam In/Out</th>
                        <th className="py-3 px-4 font-semibold">Catatan</th>
                        <th className="py-3 px-4 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyAttendances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                            Belum ada log kehadiran harian.
                          </td>
                        </tr>
                      ) : (
                        [...dailyAttendances].sort((a,b) => b.date.localeCompare(a.date)).map((d) => (
                          <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-600">{d.date}</td>
                            <td className="py-3 px-4 font-medium text-slate-800">{getEmployeeName(d.employeeId)}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                d.status === "HADIR" ? "bg-emerald-100 text-emerald-700" :
                                d.status === "TERLAMBAT" ? "bg-amber-100 text-amber-700" :
                                d.status === "IZIN" ? "bg-blue-100 text-blue-700" :
                                d.status === "SAKIT" ? "bg-rose-100 text-rose-700" :
                                "bg-slate-100 text-slate-700"
                              }`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {d.clockInTime ? new Date(d.clockInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'} 
                              {" - "}
                              {d.clockOutTime ? new Date(d.clockOutTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate" title={d.notes}>
                              {d.notes || "-"}
                            </td>
                            <td className="py-3 px-4">
                              {canEditHR && d.status !== "DITOLAK" && d.status !== "ALPHA" && (
                                <button
                                  onClick={() => {
                                    if(confirm("Tolak kehadiran/pengajuan ini dan ubah menjadi ALPHA?")) {
                                      updateDailyAttendance({...d, status: "ALPHA"});
                                    }
                                  }}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded"
                                >
                                  Tolak (Alpha)
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
                      templateHeaders={["NIK", "Gaji Pokok", "Tunjangan Jabatan", "Tunjangan Makan", "Tunjangan Transport", "Target Bonus KPI", "Potongan Alpha/Hari", "Mulai Kontrak", "Selesai Kontrak"]}
                      templateExampleRow={["EMP-001", "3500000", "500000", "20000", "20000", "500000", "100000", "2024-01-01", "2024-12-31"]}
                      templateFilename="template_kontrak"
                      buttonLabel={isIndo ? "Import" : "Import"}
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
                      <th className="py-3 px-4 font-semibold">
                        {isIndo ? "Potongan Alpha" : "Alpha Deduct"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
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
                            <td className="py-3 px-4 text-rose-600 font-mono">
                              {formatRupiah(c.alphaDeductionPerDay)}/hr
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Daily Attendances for Manager */}
              <div className="mt-12">
                <h3 className="text-lg font-bold text-slate-800 mb-6">
                  {isIndo ? "Log Kehadiran & Pengajuan Harian" : "Daily Attendance & Leave Log"}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                        <th className="py-3 px-4 font-semibold">Tanggal</th>
                        <th className="py-3 px-4 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Jam In/Out</th>
                        <th className="py-3 px-4 font-semibold">Catatan</th>
                        <th className="py-3 px-4 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyAttendances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                            Belum ada log kehadiran harian.
                          </td>
                        </tr>
                      ) : (
                        [...dailyAttendances].sort((a,b) => b.date.localeCompare(a.date)).map((d) => (
                          <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-600">{d.date}</td>
                            <td className="py-3 px-4 font-medium text-slate-800">{getEmployeeName(d.employeeId)}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                d.status === "HADIR" ? "bg-emerald-100 text-emerald-700" :
                                d.status === "TERLAMBAT" ? "bg-amber-100 text-amber-700" :
                                d.status === "IZIN" ? "bg-blue-100 text-blue-700" :
                                d.status === "SAKIT" ? "bg-rose-100 text-rose-700" :
                                "bg-slate-100 text-slate-700"
                              }`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {d.clockInTime ? new Date(d.clockInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'} 
                              {" - "}
                              {d.clockOutTime ? new Date(d.clockOutTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate" title={d.notes}>
                              {d.notes || "-"}
                            </td>
                            <td className="py-3 px-4">
                              {canEditHR && d.status !== "DITOLAK" && d.status !== "ALPHA" && (
                                <button
                                  onClick={() => {
                                    if(confirm("Tolak kehadiran/pengajuan ini dan ubah menjadi ALPHA?")) {
                                      updateDailyAttendance({...d, status: "ALPHA"});
                                    }
                                  }}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded"
                                >
                                  Tolak (Alpha)
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          
          {activeTab === "schedule" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo ? "Jadwal Shift Karyawan" : "Employee Shift Schedule"}
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      const prev = new Date(currentWeekStart);
                      prev.setDate(prev.getDate() - 7);
                      setCurrentWeekStart(prev);
                    }}
                    className="px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200"
                  >
                    &laquo; Prev Week
                  </button>
                  <span className="font-semibold text-slate-700">
                    {weekDays[0].toLocaleDateString("id-ID", { month: "short", day: "numeric" })} - {weekDays[6].toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
                  </span>
                  <button
                    onClick={() => {
                      const next = new Date(currentWeekStart);
                      next.setDate(next.getDate() + 7);
                      setCurrentWeekStart(next);
                    }}
                    className="px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200"
                  >
                    Next Week &raquo;
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                      <th className="py-3 px-4 font-semibold sticky left-0 bg-slate-50 z-10 w-48 shadow-[1px_0_0_0_#e2e8f0]">Karyawan</th>
                      {weekDays.map((d, idx) => (
                        <th key={idx} className="py-3 px-4 font-semibold text-center border-l border-slate-200">
                          <div className="text-xs">{d.toLocaleDateString("id-ID", { weekday: "short" })}</div>
                          <div>{d.getDate()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e => e.status === "AKTIF").map((emp) => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800 sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0]">
                          <div className="truncate">{emp.name}</div>
                          <div className="text-xs text-slate-500">{emp.position}</div>
                        </td>
                        {weekDays.map((d, idx) => {
                          const dateStr = d.toISOString().split("T")[0];
                          const shift = employeeShifts.find(s => s.employeeId === emp.id && s.date === dateStr)?.shiftType || "OFF";
                          return (
                            <td key={idx} className="p-2 border-l border-slate-200">
                              <select
                                disabled={!canEditHR}
                                value={shift}
                                onChange={(e) => handleShiftChange(emp.id, dateStr, e.target.value as any)}
                                className={`w-full text-xs font-semibold py-1.5 px-2 rounded-lg border-0 focus:ring-2 focus:ring-indigo-500 ${
                                  shift === "PAGI" ? "bg-emerald-100 text-emerald-700" :
                                  shift === "SORE" ? "bg-amber-100 text-amber-700" :
                                  shift === "MIDDLE" ? "bg-blue-100 text-blue-700" :
                                  "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <option value="OFF">OFF (Libur)</option>
                                <option value="PAGI">Pagi</option>
                                <option value="MIDDLE">Middle</option>
                                <option value="SORE">Sore</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "kpi" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  {isIndo ? "Penilaian KPI (Kuartal)" : "KPI Assessment (Quarterly)"}
                </h3>
                {canEditHR && (
                  <div className="flex items-center gap-3">
                    <CsvImportExport
                      onImport={handleImportKPI}
                      templateHeaders={["NIK", "Kuartal (1-4)", "Tahun", "Total Skor", "Bonus KPI", "Catatan Evaluator"]}
                      templateExampleRow={["EMP-001", "1", "2024", "85", "250000", "Kinerja sangat baik"]}
                      templateFilename="template_kpi"
                      buttonLabel={isIndo ? "Import" : "Import"}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Daily Attendances for Manager */}
              <div className="mt-12">
                <h3 className="text-lg font-bold text-slate-800 mb-6">
                  {isIndo ? "Log Kehadiran & Pengajuan Harian" : "Daily Attendance & Leave Log"}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                        <th className="py-3 px-4 font-semibold">Tanggal</th>
                        <th className="py-3 px-4 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Jam In/Out</th>
                        <th className="py-3 px-4 font-semibold">Catatan</th>
                        <th className="py-3 px-4 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyAttendances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                            Belum ada log kehadiran harian.
                          </td>
                        </tr>
                      ) : (
                        [...dailyAttendances].sort((a,b) => b.date.localeCompare(a.date)).map((d) => (
                          <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-600">{d.date}</td>
                            <td className="py-3 px-4 font-medium text-slate-800">{getEmployeeName(d.employeeId)}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                d.status === "HADIR" ? "bg-emerald-100 text-emerald-700" :
                                d.status === "TERLAMBAT" ? "bg-amber-100 text-amber-700" :
                                d.status === "IZIN" ? "bg-blue-100 text-blue-700" :
                                d.status === "SAKIT" ? "bg-rose-100 text-rose-700" :
                                "bg-slate-100 text-slate-700"
                              }`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {d.clockInTime ? new Date(d.clockInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'} 
                              {" - "}
                              {d.clockOutTime ? new Date(d.clockOutTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate" title={d.notes}>
                              {d.notes || "-"}
                            </td>
                            <td className="py-3 px-4">
                              {canEditHR && d.status !== "DITOLAK" && d.status !== "ALPHA" && (
                                <button
                                  onClick={() => {
                                    if(confirm("Tolak kehadiran/pengajuan ini dan ubah menjadi ALPHA?")) {
                                      updateDailyAttendance({...d, status: "ALPHA"});
                                    }
                                  }}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded"
                                >
                                  Tolak (Alpha)
                                </button>
                              )}
                            </td>
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
                      templateHeaders={["NIK", "Periode (YYYY-MM)", "Hadir", "Sakit", "Izin", "Alpha", "Catatan"]}
                      templateExampleRow={["EMP-001", "2024-01", "22", "1", "0", "0", "Rajin"]}
                      templateFilename="template_absensi"
                      buttonLabel={isIndo ? "Import" : "Import"}
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
                    {attendances.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-slate-500 italic"
                        >
                          {isIndo
                            ? "Belum ada data absensi."
                            : "No attendance data yet."}
                        </td>
                      </tr>
                    ) : (
                      attendances.map((a) => (
                        <tr
                          key={a.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {getEmployeeName(a.employeeId)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {a.period}
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-600">
                            {a.presentDays}
                          </td>
                          <td className="py-3 px-4 font-semibold text-amber-500">
                            {a.sickDays + a.permissionDays}
                          </td>
                          <td className="py-3 px-4 font-semibold text-rose-600">
                            {a.alphaDays}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Daily Attendances for Manager */}
              <div className="mt-12">
                <h3 className="text-lg font-bold text-slate-800 mb-6">
                  {isIndo ? "Log Kehadiran & Pengajuan Harian" : "Daily Attendance & Leave Log"}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                        <th className="py-3 px-4 font-semibold">Tanggal</th>
                        <th className="py-3 px-4 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Jam In/Out</th>
                        <th className="py-3 px-4 font-semibold">Catatan</th>
                        <th className="py-3 px-4 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyAttendances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                            Belum ada log kehadiran harian.
                          </td>
                        </tr>
                      ) : (
                        [...dailyAttendances].sort((a,b) => b.date.localeCompare(a.date)).map((d) => (
                          <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-600">{d.date}</td>
                            <td className="py-3 px-4 font-medium text-slate-800">{getEmployeeName(d.employeeId)}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                d.status === "HADIR" ? "bg-emerald-100 text-emerald-700" :
                                d.status === "TERLAMBAT" ? "bg-amber-100 text-amber-700" :
                                d.status === "IZIN" ? "bg-blue-100 text-blue-700" :
                                d.status === "SAKIT" ? "bg-rose-100 text-rose-700" :
                                "bg-slate-100 text-slate-700"
                              }`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {d.clockInTime ? new Date(d.clockInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'} 
                              {" - "}
                              {d.clockOutTime ? new Date(d.clockOutTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate" title={d.notes}>
                              {d.notes || "-"}
                            </td>
                            <td className="py-3 px-4">
                              {canEditHR && d.status !== "DITOLAK" && d.status !== "ALPHA" && (
                                <button
                                  onClick={() => {
                                    if(confirm("Tolak kehadiran/pengajuan ini dan ubah menjadi ALPHA?")) {
                                      updateDailyAttendance({...d, status: "ALPHA"});
                                    }
                                  }}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded"
                                >
                                  Tolak (Alpha)
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
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
                    <button
                      onClick={generatePDF}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
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
                          {selectedPayslip.employee.nik} —{" "}
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
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">
                      {isIndo ? "Summary Payroll" : "Payroll Summary"}
                    </h3>
                  </div>
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3 text-amber-900 shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div className="text-sm">
                      <p className="font-bold mb-1">
                        {isIndo
                          ? "Payroll Dihitung Otomatis"
                          : "Auto-Calculated Payroll"}
                      </p>
                      <p className="text-amber-700">
                        {isIndo
                          ? "Klik baris karyawan untuk melihat dan mencetak rincian Slip Gaji resmi."
                          : "Click an employee row to view and print the official Payslip."}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                          <th className="py-3 px-4 font-semibold">
                            {isIndo ? "Karyawan" : "Employee"}
                          </th>
                          <th className="py-3 px-4 font-semibold">Periode</th>
                          <th className="py-3 px-4 font-semibold">
                            Gaji Pokok
                          </th>
                          <th className="py-3 px-4 font-semibold">Tunjangan</th>
                          <th className="py-3 px-4 font-semibold">Potongan</th>
                          <th className="py-3 px-4 font-semibold text-right text-indigo-700">
                            Take Home Pay
                          </th>
                          <th className="py-3 px-4"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollData.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-12 text-center text-slate-500 italic"
                            >
                              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                              {isIndo
                                ? "Data payroll belum tersedia. Pastikan ada data absensi."
                                : "Payroll data not available. Ensure attendance data exists."}
                            </td>
                          </tr>
                        ) : (
                          payrollData.map((p) => (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedPayslip(p)}
                              className="border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                            >
                              <td className="py-4 px-4 font-bold text-slate-800">
                                {p.employee.name}
                              </td>
                              <td className="py-4 px-4 text-slate-600 font-medium">
                                {p.period}
                              </td>
                              <td className="py-4 px-4 text-slate-600 font-mono text-sm">
                                {formatRupiah(p.basic)}
                              </td>
                              <td className="py-4 px-4 text-emerald-600 font-mono text-sm">
                                +
                                {formatRupiah(p.meal + p.position + p.kpiBonus)}
                              </td>
                              <td className="py-4 px-4 text-rose-600 font-mono text-sm">
                                -{formatRupiah(p.alphaDeduction)}
                              </td>
                              <td className="py-4 px-4 font-bold text-right text-indigo-700 font-mono text-lg">
                                {formatRupiah(p.total)}
                              </td>
                              <td className="py-4 px-4 text-right">
                                <button className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                  Slip Gaji
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>

      {/* Modals */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingEmployee ? (isIndo ? "Edit Karyawan" : "Edit Employee") : (isIndo ? "Tambah Karyawan" : "Add Employee")}
              </h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username (Untuk Login)</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={empForm.username} onChange={e => setEmpForm({...empForm, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Departemen</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value})}>
                    <option value="">-- Pilih Departemen --</option>
                    <option value="MAIN">Utama (Main)</option>
                    <option value="BAR">Bar</option>
                    <option value="KITCHEN">Dapur (Kitchen)</option>
                    <option value="BAKER">Baker (Roti)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jabatan</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={empForm.position} onChange={e => setEmpForm({...empForm, position: e.target.value})}>
                    <option value="">-- Pilih Jabatan --</option>
                    <option value="Kasir">Kasir</option>
                    <option value="Karyawan">Karyawan (Staff)</option>
                    <option value="Leader">Leader</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={empForm.status} onChange={e => setEmpForm({...empForm, status: e.target.value as any})}>
                    <option value="AKTIF">Aktif</option>
                    <option value="TIDAK_AKTIF">Tidak Aktif</option>
                    <option value="RESIGN">Resign</option>
                    <option value="PHK">PHK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipe</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" value={empForm.employmentType} onChange={e => setEmpForm({...empForm, employmentType: e.target.value as any})}>
                    <option value="TETAP">Tetap</option>
                    <option value="KONTRAK">Kontrak</option>
                    <option value="PARUH_WAKTU">Paruh Waktu</option>
                    <option value="MAGANG">Magang</option>
                  </select>
                </div>
              </div>
              
              {!editingEmployee && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoCreateUser}
                      onChange={(e) => setAutoCreateUser(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">Buat Akun Login Otomatis</span>
                  </label>
                  {autoCreateUser && (
                    <p className="text-xs text-slate-500 mt-1 ml-6">
                      Username: <strong>[Username]</strong>, PIN default: <strong>123456</strong>. Role akan disesuaikan dengan Departemen.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setIsEmployeeModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleSaveEmployee} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Simpan</button>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gaji Pokok (Rp)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.basicSalary || ""} onChange={e => setContractForm({...contractForm, basicSalary: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Potongan Alpha/Hari (Rp)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={contractForm.alphaDeductionPerDay || ""} onChange={e => setContractForm({...contractForm, alphaDeductionPerDay: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
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
