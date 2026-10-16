import React, { useRef, useState, useMemo } from "react";
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Wallet,
  X,
  Sparkles,
  AlertCircle,
  Building,
  Target,
  Award,
} from "lucide-react";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import { PayrollRecord } from "../types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface PayslipModalProps {
  payroll: PayrollRecord;
  onClose: () => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({ payroll, onClose }) => {
  const {
    employees,
    settings,
    dailyAttendances,
    dailyChecklists,
    kpiRecords,
    cashAccounts,
    users,
  } = useStore();

  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [printMode, setPrintMode] = useState<"standard" | "thermal">("standard");

  // 1. Identify Employee Data
  const employee = useMemo(() => {
    return (
      employees.find((e) => e.id === payroll.employeeId) ||
      users.find((u) => u.id === payroll.employeeId) || {
        id: payroll.employeeId,
        name: "Karyawan",
        position: "Staff",
        department: "MAIN",
        username: "EMP",
      }
    );
  }, [employees, users, payroll.employeeId]);

  // 2. Identify Attendance Breakdown for this employee & period
  const attendanceBreakdown = useMemo(() => {
    const periodLogs = (dailyAttendances || []).filter(
      (a) => a.employeeId === payroll.employeeId && a.date.startsWith(payroll.period)
    );

    const presentDays = periodLogs.filter((a) =>
      ["HADIR", "TERLAMBAT"].includes(a.status)
    ).length;
    const lateDays = periodLogs.filter((a) => a.status === "TERLAMBAT").length;
    const sickOrLeaveDays = periodLogs.filter((a) =>
      ["IZIN", "SAKIT"].includes(a.status)
    ).length;
    const alphaDays = periodLogs.filter((a) => a.status === "ALPHA").length;

    // Working days baseline (standard 25/26 days)
    const totalWorkingDays = Math.max(25, presentDays + sickOrLeaveDays + alphaDays);

    return {
      presentDays,
      lateDays,
      sickOrLeaveDays,
      alphaDays,
      totalWorkingDays,
    };
  }, [dailyAttendances, payroll.employeeId, payroll.period]);

  // 3. Identify KPI / Checklist details
  const kpiDetails = useMemo(() => {
    const isLeader =
      (employee.position || "").toUpperCase().includes("LEADER") ||
      (employee.position || "").toUpperCase().includes("HEAD");

    const kpi = (kpiRecords || []).find(
      (k) => k.employeeId === payroll.employeeId && k.period === payroll.period
    );

    const empChecklists = (dailyChecklists || []).filter(
      (c) =>
        (c.employeeId === payroll.employeeId ||
          c.notes?.includes(`[${employee.department}]`)) &&
        c.date.startsWith(payroll.period)
    );
    const checklistDays = empChecklists.length;
    const expectedDays = Math.max(1, attendanceBreakdown.presentDays || 22);
    const ratio = isLeader
      ? (checklistDays > 0 ? Math.min(100, Math.round((checklistDays / expectedDays) * 100)) : 0)
      : Math.min(100, Math.round(((attendanceBreakdown.presentDays - attendanceBreakdown.lateDays) / expectedDays) * 100));

    return {
      ratio,
      checklistDays: isLeader ? checklistDays : attendanceBreakdown.presentDays,
      expectedDays,
      kpiScore: kpi?.totalScore || ratio,
      kpiBonus: payroll.kpiBonus || 0,
      label: isLeader 
        ? `Supervisi & Jobdesk Leader (${ratio}% - ${checklistDays}/${expectedDays} Shift)`
        : `Kedisiplinan Presensi Kerja (${ratio}% - ${attendanceBreakdown.presentDays}/${expectedDays} Hari)`,
      isLeader,
    };
  }, [employee, kpiRecords, dailyChecklists, payroll.employeeId, payroll.period, payroll.kpiBonus, attendanceBreakdown]);

  // 4. Formatted Period String (e.g. Oktober 2026)
  const periodFormatted = useMemo(() => {
    try {
      const [y, m] = payroll.period.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    } catch {
      return payroll.period;
    }
  }, [payroll.period]);

  // 5. Account Name if Paid
  const paidViaAccountName = useMemo(() => {
    if (!payroll.paidVia) return null;
    return cashAccounts.find((a) => a.id === payroll.paidVia)?.name || null;
  }, [cashAccounts, payroll.paidVia]);

  // 6. Generate PDF A4
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2.5,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `Slip_Gaji_${employee.name.replace(/\s+/g, "_")}_${payroll.period}.pdf`
      );
    } catch (err) {
      console.error("Gagal membuat PDF slip gaji:", err);
      alert("Terjadi kesalahan saat memproses PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  // 7. Thermal / Direct Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200">
        {/* Top Action Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">Slip Gaji Karyawan</h3>
              <p className="text-[11px] text-slate-300">
                {employee.name} • {periodFormatted}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrintMode(printMode === "standard" ? "thermal" : "standard")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition-colors hidden sm:inline-flex items-center gap-1.5"
              title="Ganti tampilan A4 / Struk Kasir Thermal"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{printMode === "standard" ? "Mode Thermal" : "Mode Standar"}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Menyimpan..." : "Unduh PDF"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100/70 flex justify-center">
          {/* Printable Document Box */}
          <div
            ref={printRef}
            className={`bg-white shadow-md border border-slate-200/90 rounded-2xl p-6 sm:p-8 text-slate-900 transition-all ${
              printMode === "thermal" ? "w-[360px] text-xs font-mono" : "w-full max-w-xl text-sm"
            }`}
          >
            {/* Header: Brand & Outlet */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900 tracking-tight">
                    {settings.brandName || "COFFEE SHOP MANAGEMENT"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {settings.storeAddress || "Outlet Utama & Operasional Kafe"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {settings.storePhone ? `Telp: ${settings.storePhone}` : "Sistem Manajemen Terpadu"}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="inline-block px-3 py-1 rounded-md bg-slate-900 text-white font-black text-xs uppercase tracking-wider mb-1">
                  SLIP GAJI RESMI
                </span>
                <p className="text-xs font-bold text-slate-800">
                  Periode: {periodFormatted}
                </p>
                <div className="flex sm:justify-end items-center gap-1.5 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      payroll.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : payroll.status === "APPROVED"
                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {payroll.status === "PAID"
                      ? "LUNAS / DITRANSFER"
                      : payroll.status === "APPROVED"
                      ? "DISETUJUI MANAJER"
                      : "DRAFT"}
                  </span>
                </div>
              </div>
            </div>

            {/* Employee Information Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 mb-5 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Nama Karyawan
                </span>
                <span className="font-bold text-slate-800 truncate block">
                  {employee.name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  ID / Username
                </span>
                <span className="font-mono text-slate-700 truncate block">
                  {employee.username || employee.id.slice(0, 8)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Jabatan
                </span>
                <span className="font-semibold text-slate-800 truncate block">
                  {employee.position || "Staff"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Divisi / Bagian
                </span>
                <span className="font-semibold text-indigo-700 truncate block">
                  {employee.department || "MAIN"}
                </span>
              </div>
            </div>

            {/* Grid 2 Kartu: Rincian Kehadiran & Capaian Jobdesk / KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {/* Kartu 1: Rekap Kehadiran */}
              <div className="bg-gradient-to-r from-slate-50 via-indigo-50/20 to-blue-50/20 p-3.5 rounded-xl border border-indigo-100/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Kehadiran Bulan Ini
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {attendanceBreakdown.totalWorkingDays} Hari Kerja
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="text-[9px] text-slate-500 font-medium block">Hadir</span>
                    <span className="text-xs font-black text-emerald-700 font-mono">
                      {attendanceBreakdown.presentDays}
                    </span>
                    <span className="text-[8px] text-slate-400 block">Hari</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="text-[9px] text-slate-500 font-medium block">Telat</span>
                    <span className="text-xs font-black text-amber-600 font-mono">
                      {attendanceBreakdown.lateDays}
                    </span>
                    <span className="text-[8px] text-slate-400 block">Kali</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="text-[9px] text-slate-500 font-medium block">Izin</span>
                    <span className="text-xs font-black text-blue-600 font-mono">
                      {attendanceBreakdown.sickOrLeaveDays}
                    </span>
                    <span className="text-[8px] text-slate-400 block">Hari</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="text-[9px] text-slate-500 font-medium block">Alpha</span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {attendanceBreakdown.alphaDays}
                    </span>
                    <span className="text-[8px] text-slate-400 block">Hari</span>
                  </div>
                </div>
              </div>

              {/* Kartu 2: Capaian Jobdesk & KPI */}
              <div className="bg-gradient-to-r from-slate-50 via-emerald-50/20 to-teal-50/20 p-3.5 rounded-xl border border-emerald-100/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-emerald-600" />
                      Capaian Jobdesk & KPI
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                      {kpiDetails.ratio}% Capaian
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 font-medium line-clamp-1 mb-2">
                    {kpiDetails.label}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        kpiDetails.ratio >= 90 ? "bg-emerald-500" :
                        kpiDetails.ratio >= 70 ? "bg-indigo-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${kpiDetails.ratio}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                    <span>Bonus KPI: <strong className="text-emerald-700 font-mono">+{formatCurrency(payroll.kpiBonus)}</strong></span>
                    <span className="font-mono">{kpiDetails.checklistDays} / {kpiDetails.expectedDays} {kpiDetails.isLeader ? "Shift" : "Hari"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Breakdown: Dua Kolom (Pendapatan vs Potongan) */}
            <div className="space-y-4 mb-5">
              {/* 1. Komponen Pendapatan */}
              <div>
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1 mb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    A. Penerimaan / Penghasilan
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">Nominal (IDR)</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <div>
                      <span className="font-medium text-slate-700">Gaji Pokok</span>
                      <span className="text-[10px] text-slate-400 block">
                        Upah pokok kehadiran kerja
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-800 self-center">
                      {formatCurrency(payroll.basicSalary)}
                    </span>
                  </div>

                  {payroll.positionAllowance > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="font-medium text-slate-700">Tunjangan Jabatan</span>
                        <span className="text-[10px] text-slate-400 block">
                          {payroll.matchedLeaderTier ? (
                            <span className="text-amber-700 font-medium">
                              👑 Penyesuaian Jobdesk: {payroll.matchedLeaderTier.grade} ({payroll.matchedLeaderTier.payoutPercentage}%) dari normal {formatCurrency(payroll.rawPositionAllowance || payroll.positionAllowance)}
                            </span>
                          ) : (
                            "Tunjangan tanggung jawab posisi"
                          )}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-800 self-center">
                        {formatCurrency(payroll.positionAllowance)}
                      </span>
                    </div>
                  )}

                  {payroll.mealAllowance > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="font-medium text-slate-700">Uang Makan</span>
                        <span className="text-[10px] text-slate-400 block">
                          Dihitung per hari masuk aktif ({attendanceBreakdown.presentDays} hari)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-800 self-center">
                        {formatCurrency(payroll.mealAllowance)}
                      </span>
                    </div>
                  )}

                  {(payroll.transportAllowance || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="font-medium text-slate-700">Uang Transport</span>
                        <span className="text-[10px] text-slate-400 block">
                          Dukungan operasional perjalanan
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-800 self-center">
                        {formatCurrency(payroll.transportAllowance)}
                      </span>
                    </div>
                  )}

                  {payroll.kpiBonus > 0 && (
                    <div className="flex justify-between py-1.5 bg-emerald-50/70 px-2 rounded-lg border border-emerald-100">
                      <div>
                        <span className="font-bold text-emerald-800 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          Bonus KPI & Capaian
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium block">
                          {kpiDetails.label}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 self-center">
                        +{formatCurrency(payroll.kpiBonus)}
                      </span>
                    </div>
                  )}

                  {(payroll.targetBonus || 0) > 0 && (
                    <div className="flex justify-between py-1.5 bg-amber-50/70 px-2 rounded-lg border border-amber-100">
                      <div>
                        <span className="font-bold text-amber-800 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-amber-600" />
                          Bonus Tembus Target Omzet Kedai
                        </span>
                        <span className="text-[10px] text-amber-600 font-medium block">
                          Insentif pencapaian omzet penjualan toko
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-700 self-center">
                        +{formatCurrency(payroll.targetBonus || 0)}
                      </span>
                    </div>
                  )}

                  {(payroll.overtimePay || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="font-medium text-slate-700">Lembur / Insentif Tambahan</span>
                        <span className="text-[10px] text-slate-400 block">
                          Jam lembur atau penugasan khusus
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 self-center">
                        +{formatCurrency(payroll.overtimePay)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 pt-2 font-bold text-slate-900 border-t border-slate-200">
                    <span>Total Penghasilan Kotor (Gross)</span>
                    <span className="font-mono">{formatCurrency(payroll.grossPay)}</span>
                  </div>
                </div>
              </div>

              {/* 2. Komponen Potongan */}
              <div>
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1 mb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-rose-800">
                    B. Potongan
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">Nominal (IDR)</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <div>
                      <span className="font-medium text-slate-700">Potongan Ketidakhadiran (Alpha)</span>
                      <span className="text-[10px] text-slate-400 block">
                        {attendanceBreakdown.alphaDays > 0
                          ? `Penalti ${attendanceBreakdown.alphaDays} hari tanpa keterangan`
                          : "Tidak ada potongan ketidakhadiran"}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-rose-600 self-center">
                      {payroll.alphaDeduction > 0
                        ? `-${formatCurrency(payroll.alphaDeduction)}`
                        : "Rp 0"}
                    </span>
                  </div>

                  {(payroll.lateDeduction || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="font-medium text-slate-700">Potongan Keterlambatan</span>
                        <span className="text-[10px] text-slate-400 block">
                          {payroll.lateHours
                            ? `Akumulasi ${payroll.lateHours} jam terlambat (${payroll.lateDays || 0}x kejadian)`
                            : `Terlambat ${payroll.lateDays || 0}x shift`}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 self-center">
                        -{formatCurrency(payroll.lateDeduction)}
                      </span>
                    </div>
                  )}

                  {(payroll.otherDeductions || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <div>
                        <span className="font-medium text-slate-700">Potongan Lainnya / Kasbon</span>
                        <span className="text-[10px] text-slate-400 block">
                          Potongan inventaris atau kewajiban lain
                        </span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 self-center">
                        -{formatCurrency(payroll.otherDeductions)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 pt-2 font-bold text-rose-700 border-t border-slate-200">
                    <span>Total Potongan</span>
                    <span className="font-mono">
                      -{formatCurrency((payroll.alphaDeduction || 0) + (payroll.lateDeduction || 0) + (payroll.otherDeductions || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Take Home Pay (Gaji Bersih Diterima) */}
            <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 mb-6 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  TAKE HOME PAY (TOTAL DITERIMA)
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white block mt-0.5">
                  {formatCurrency(payroll.netPay)}
                </span>
                {paidViaAccountName && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Dibayarkan via: {paidViaAccountName}{" "}
                    {payroll.paidDate && `pada ${new Date(payroll.paidDate).toLocaleDateString("id-ID")}`}
                  </span>
                )}
              </div>
              <div className="text-right">
                <CheckCircle2 className="w-9 h-9 text-emerald-400 inline-block opacity-90" />
              </div>
            </div>

            {/* Catatan / Keterangan Tambahan */}
            {payroll.notes && (
              <div className="mb-5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 italic">
                <strong>Catatan Manajemen:</strong> "{payroll.notes}"
              </div>
            )}

            {/* Tanda Tangan Resmi Pengesahan */}
            <div className="pt-4 border-t border-dashed border-slate-300 grid grid-cols-2 text-center text-xs">
              <div>
                <p className="text-slate-400 text-[11px] mb-12">Penerima (Karyawan),</p>
                <p className="font-bold text-slate-900 underline underline-offset-4">
                  {employee.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{employee.position || "Staff"}</p>
              </div>

              <div>
                <p className="text-slate-400 text-[11px] mb-12">Manajemen / Keuangan,</p>
                <p className="font-bold text-slate-900 underline underline-offset-4">
                  {settings.brandName || "Coffee Management"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Otorisasi Resmi Outlet</p>
              </div>
            </div>

            {/* Footer small note */}
            <div className="mt-6 pt-2 border-t border-slate-100 text-[9px] text-slate-400 text-center">
              Dokumen ini dicetak otomatis oleh sistem Coffee Management. Disimpan secara elektronik dan sah tanpa tanda tangan basah bila berstatus LUNAS.
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Format: {printMode === "standard" ? "A4 Standar" : "Thermal 80mm"}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
