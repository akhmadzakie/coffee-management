import React, { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store/StoreContext";
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  User,
  Coffee,
  Check,
  ShieldCheck,
  Layers,
  FlipHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DailyAttendance, DEFAULT_SHIFT_DEFINITIONS } from "../types";
import {
  DEFAULT_STORE_TIMEZONE,
  getLocalDateString,
} from "../utils/dateUtils";
import {
  calculateWorkDurationHours,
  evaluateClockInLateness,
  resolveCanonicalEmployeeId,
} from "../utils/attendanceRecap";

export function ClockIn() {
  const {
    currentUser,
    users,
    employees,
    dailyAttendances,
    addDailyAttendance,
    updateDailyAttendance,
    employeeShifts,
    isReadOnly,
    settings,
  } = useStore();

  const [activeMode, setActiveMode] = useState<"ATTENDANCE" | "LEAVE">("ATTENDANCE");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check today's attendance for the current user
  const todayStr = getLocalDateString();
  const activeEmployee = employees.find(
    (e) =>
      e.id === currentUser?.employeeId ||
      (e.username || "").toLowerCase() === (currentUser?.username || "").toLowerCase()
  );
  const activeEmployeeId = resolveCanonicalEmployeeId(
    currentUser?.employeeId || activeEmployee?.id || currentUser?.id || "",
    employees,
    users
  );

  const todayShift = (employeeShifts || []).find(
    (s: any) =>
      resolveCanonicalEmployeeId(s.employeeId, employees, users) === activeEmployeeId &&
      s.date === todayStr
  );
  const scheduledShift = todayShift?.shiftType || "PAGI";
  const shiftDefs =
    settings?.shiftDefinitions && settings.shiftDefinitions.length > 0
      ? settings.shiftDefinitions
      : DEFAULT_SHIFT_DEFINITIONS;
  const scheduledShiftDef =
    shiftDefs.find((s: any) => s.id === scheduledShift) ||
    DEFAULT_SHIFT_DEFINITIONS.find((s: any) => s.id === scheduledShift) ||
    null;

  const todayAttendance = dailyAttendances.find(
    (a) =>
      resolveCanonicalEmployeeId(a.employeeId, employees, users) === activeEmployeeId &&
      a.date === todayStr
  );

  const isLeaveSubmitted =
    todayAttendance?.status === "IZIN" ||
    todayAttendance?.status === "SAKIT" ||
    todayAttendance?.status === "ALPHA";
  const isClockedIn = !!todayAttendance?.clockInTime && !isLeaveSubmitted;
  const isClockedOut = !!todayAttendance?.clockOutTime && !isLeaveSubmitted;

  // Auto clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setFeedback({
        type: "error",
        message: "Tidak dapat mengakses kamera. Pastikan izin kamera aktif pada browser Anda.",
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const getLocation = () => {
    setIsRefreshingLocation(true);
    if (!navigator.geolocation) {
      setLocationError("Geolokasi tidak didukung oleh browser Anda");
      setIsRefreshingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError("");
        setIsRefreshingLocation(false);
      },
      (error) => {
        setLocationError("Gagal mengambil titik GPS: " + error.message);
        setIsRefreshingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    getLocation();
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    // Crop center square (1:1) persis seperti yang terlihat di kotak viewfinder
    const squareSize = Math.min(vWidth, vHeight);
    const startX = (vWidth - squareSize) / 2;
    const startY = (vHeight - squareSize) / 2;

    canvas.width = squareSize;
    canvas.height = squareSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (isMirrored) {
      // Flip horizontal (mirror) agar hasil jepretan sesuai dengan tampilan cermin di layar
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, startX, startY, squareSize, squareSize, 0, 0, squareSize, squareSize);
      ctx.restore();
    } else {
      ctx.drawImage(video, startX, startY, squareSize, squareSize, 0, 0, squareSize, squareSize);
    }

    // Add Watermark (digambar dengan orientasi normal/tidak terbalik)
    const barHeight = Math.max(50, Math.round(canvas.height * 0.085));
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    const fontSize = Math.max(12, Math.round(canvas.width * 0.026));
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px 'Plus Jakarta Sans', Arial, sans-serif`;

    const now = new Date();
    const timeStr = now.toLocaleDateString("id-ID", {
      timeZone: DEFAULT_STORE_TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const locStr = location
      ? `GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
      : "GPS: Tidak diketahui";

    ctx.fillText(
      `${activeEmployee?.name || currentUser?.name || "Karyawan"} • Shift ${scheduledShift} • ${timeStr}`,
      Math.round(canvas.width * 0.035),
      canvas.height - Math.round(barHeight * 0.55)
    );
    ctx.fillText(
      `${locStr} • Julia's Coffee & Eatery`,
      Math.round(canvas.width * 0.035),
      canvas.height - Math.round(barHeight * 0.2)
    );

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      setFeedback({ type: "error", message: "Akun Read-Only tidak diizinkan mencatat presensi." });
      return;
    }
    if (!photoDataUrl) {
      setFeedback({ type: "error", message: "Harap ambil foto selfie kamera terlebih dahulu." });
      return;
    }
    if (!location) {
      setFeedback({ type: "error", message: "Koordinat GPS belum didapatkan. Pastikan izin lokasi aktif." });
      return;
    }
    if (!currentUser || !activeEmployeeId) return;

    setIsLoading(true);
    const nowDate = new Date();
    const now = nowDate.toISOString();

    try {
      if (!isClockedIn) {
        // Clock In
        const { status, lateMinutes } = evaluateClockInLateness({
          now: nowDate,
          shiftId: scheduledShift,
          shiftDefinitions: shiftDefs,
          timeZone: DEFAULT_STORE_TIMEZONE,
        });

        const lateNote = lateMinutes > 0 ? `[Terlambat ${lateMinutes} menit]` : "";
        const offNote = scheduledShift === "OFF" ? "[Shift Libur / Pengganti]" : "";
        const combinedNotes = [notes.trim(), lateNote, offNote].filter(Boolean).join(" • ");

        addDailyAttendance({
          employeeId: activeEmployeeId,
          date: todayStr,
          clockInTime: now,
          clockOutTime: null,
          clockInLocation: location,
          clockOutLocation: null,
          clockInPhotoUrl: photoDataUrl,
          clockOutPhotoUrl: null,
          status,
          approvalStatus: "PENDING",
          notes: combinedNotes,
        });
        setFeedback({
          type: "success",
          message: `Clock In berhasil dicatat untuk Shift ${scheduledShift}! Selamat bertugas.`,
        });
      } else if (!isClockedOut && todayAttendance) {
        // Clock Out
        const mergedNotes = [todayAttendance.notes, notes.trim()].filter(Boolean).join(" | ");
        updateDailyAttendance({
          ...todayAttendance,
          clockOutTime: now,
          clockOutLocation: location,
          clockOutPhotoUrl: photoDataUrl,
          notes: mergedNotes,
        });
        setFeedback({
          type: "success",
          message: "Clock Out berhasil dicatat! Terima kasih atas dedikasi Anda.",
        });
      }

      setPhotoDataUrl(null);
      setNotes("");
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Terjadi kesalahan saat menyimpan data absensi." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveSubmit = async (leaveStatus: "IZIN" | "SAKIT") => {
    if (isReadOnly) {
      setFeedback({ type: "error", message: "Akun Read-Only tidak diizinkan mengajukan izin." });
      return;
    }
    if (isClockedIn) {
      setFeedback({ type: "error", message: "Anda sudah melakukan Clock In hari ini." });
      return;
    }
    if (!notes.trim()) {
      setFeedback({ type: "error", message: "Harap isi keterangan alasan pengajuan izin/sakit." });
      return;
    }
    if (!currentUser || !activeEmployeeId) return;

    setIsLoading(true);
    try {
      if (todayAttendance) {
        updateDailyAttendance({
          ...todayAttendance,
          clockInTime: null,
          clockOutTime: null,
          clockInLocation: null,
          clockOutLocation: null,
          clockInPhotoUrl: null,
          clockOutPhotoUrl: null,
          status: leaveStatus,
          approvalStatus: "PENDING",
          notes: notes.trim(),
        });
      } else {
        addDailyAttendance({
          employeeId: activeEmployeeId,
          date: todayStr,
          clockInTime: null,
          clockOutTime: null,
          clockInLocation: null,
          clockOutLocation: null,
          clockInPhotoUrl: null,
          clockOutPhotoUrl: null,
          status: leaveStatus,
          approvalStatus: "PENDING",
          notes: notes.trim(),
        });
      }
      setFeedback({ type: "success", message: `Pengajuan ${leaveStatus} berhasil dikirim ke Manager!` });
      setPhotoDataUrl(null);
      setNotes("");
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Terjadi kesalahan saat pengajuan." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser)
    return <div className="p-8 text-center text-slate-500">Silakan login terlebih dahulu.</div>;

  const userPos = (activeEmployee?.position || "").toUpperCase();
  const userDept = (activeEmployee?.department || currentUser?.department || "").toUpperCase();
  const userRole = (currentUser?.role || "").toUpperCase();
  const isManagerOrExempt =
    userRole === "MANAGER" ||
    userRole === "FINANCE" ||
    userRole === "OWNER" ||
    userRole === "SUPER_ADMIN" ||
    userPos.includes("MANAGER") ||
    userPos.includes("MANAJER") ||
    userPos.includes("FINANCE") ||
    userPos.includes("KEUANGAN") ||
    userPos.includes("ACCOUNTING") ||
    userPos.includes("AKUNTAN") ||
    userPos.includes("OWNER") ||
    userDept.includes("FINANCE") ||
    userDept.includes("KEUANGAN");

  if (isManagerOrExempt) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 text-brand-600 dark:text-brand-300 flex items-center justify-center mx-auto mb-4 shadow-2xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Bebas Kewajiban Presensi &amp; Absen
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Sebagai <strong className="text-slate-800 dark:text-slate-200">{currentUser.name} ({currentUser.role})</strong>, Anda dibebaskan dari kewajiban absensi foto selfie, GPS, dan clock in/out harian. Fokus utama Anda adalah penyelesaian jobdesk manajerial, pengelolaan keuangan, dan pengawasan operasional kafe.
          </p>
          <div className="mt-6 p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-500/15 border border-brand-200/70 dark:border-brand-500/30 text-left">
            <p className="text-xs font-bold text-brand-900 dark:text-brand-200 mb-1">Kebijakan Back-Office &amp; Manajerial:</p>
            <p className="text-[11px] text-brand-800 dark:text-brand-300 leading-relaxed">
              Manager dan Finance fokus pada pencapaian target jobdesk operasional serta laporan keuangan tanpa perlu mengisi absen shift harian, dengan hak gaji penuh bulanan sesuai kontrak.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 safe-area-bottom">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold shadow-xs border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-950 border-emerald-200"
                : "bg-rose-50 text-rose-950 border-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Card */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Absensi Kehadiran
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30">
                Selfie & GPS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {currentUser.name} • {currentUser.role}{" "}
              {activeEmployee?.department ? `(${activeEmployee.department})` : ""}
            </p>
          </div>

          {/* Mode Switcher */}
          {!isClockedOut && !isLeaveSubmitted && (
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold self-start sm:self-auto gap-1">
              <button
                type="button"
                onClick={() => setActiveMode("ATTENDANCE")}
                className={`relative min-h-[44px] px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                  activeMode === "ATTENDANCE"
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {activeMode === "ATTENDANCE" && (
                  <motion.div
                    layoutId="clockInModeTab"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-600"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10">Hadir Shift</span>
              </button>
              {!isClockedIn && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setActiveMode("LEAVE");
                  }}
                  className={`relative min-h-[44px] px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                    activeMode === "LEAVE"
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {activeMode === "LEAVE" && (
                    <motion.div
                      layoutId="clockInModeTab"
                      className="absolute inset-0 bg-white dark:bg-slate-700 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-600"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">Izin / Sakit</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Jadwal Shift Banner */}
        <div
          className={`p-4 rounded-2xl border mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            scheduledShift === "OFF"
              ? "bg-amber-50/80 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30"
              : "bg-gradient-to-r from-slate-50 to-brand-50/40 dark:from-slate-800/80 dark:to-brand-500/10 border-slate-200/80 dark:border-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                scheduledShift === "PAGI"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : scheduledShift === "MIDDLE"
                  ? "bg-brand-100 text-brand-800 border border-brand-200"
                  : scheduledShift === "SORE"
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : scheduledShift === "OFF"
                  ? "bg-slate-200 text-slate-800"
                  : "bg-purple-100 text-purple-800 border border-purple-200"
              }`}
            >
              {scheduledShift === "OFF"
                ? "OFF"
                : scheduledShift === "PAGI"
                ? "PGI"
                : scheduledShift === "MIDDLE"
                ? "MID"
                : scheduledShift === "SORE"
                ? "SRE"
                : scheduledShift.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Jadwal Shift Anda Hari Ini
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {scheduledShift === "OFF"
                  ? "Hari Libur (OFF)"
                  : scheduledShiftDef
                  ? `Shift ${scheduledShiftDef.name} (${scheduledShiftDef.startTime} – ${scheduledShiftDef.endTime} WITA)`
                  : `Shift ${scheduledShift}`}
              </p>
            </div>
          </div>
          {scheduledShift === "OFF" ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 bg-white/90 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-500/40 self-start sm:self-auto">
              <span>Jadwal Libur: Presensi akan dicatat sebagai lembur / shift pengganti</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 self-start sm:self-auto tabular-nums">
              <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Toleransi keterlambatan {scheduledShiftDef?.lateToleranceMinutes ?? 15} mnt</span>
            </div>
          )}
        </div>

        {/* ─── STATE 0: LEAVE / ABSENCE RECORDED TODAY ─── */}
        {isLeaveSubmitted && todayAttendance ? (
          <div className="bg-gradient-to-br from-amber-50/80 via-white to-brand-50/40 dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-500/30 p-6 sm:p-8 rounded-3xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-4 shadow-2xs">
              <Info className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Status Hari Ini: {todayAttendance.status}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-md">
              {todayAttendance.notes || "Pengajuan ketidakhadiran telah tercatat di sistem."}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
              <span>Verifikasi Manager:</span>
              <span
                className={
                  todayAttendance.approvalStatus === "APPROVED"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : todayAttendance.approvalStatus === "REJECTED"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {todayAttendance.approvalStatus === "APPROVED"
                  ? "Disetujui"
                  : todayAttendance.approvalStatus === "REJECTED"
                  ? "Ditolak"
                  : "Menunggu Verifikasi"}
              </span>
            </div>
          </div>
        ) : isClockedOut ? (
          /* ─── STATE 1: ALREADY COMPLETED SHIFT TODAY ─── */
          <div className="bg-gradient-to-br from-emerald-50/80 via-white to-brand-50/50 dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-500/30 p-6 sm:p-8 rounded-3xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-2xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Shift Anda Hari Ini Telah Selesai
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              Data kehadiran Anda telah tercatat dengan aman dan siap diverifikasi oleh Manager.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-6">
              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs text-left">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                  Jam Masuk (IN)
                </span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  {new Date(todayAttendance.clockInTime!).toLocaleTimeString("id-ID", {
                    timeZone: DEFAULT_STORE_TIMEZONE,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs text-left">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                  Jam Pulang (OUT)
                </span>
                <span className="text-base font-black text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                  {new Date(todayAttendance.clockOutTime!).toLocaleTimeString("id-ID", {
                    timeZone: DEFAULT_STORE_TIMEZONE,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {todayAttendance.clockInTime && todayAttendance.clockOutTime && (
              <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-emerald-500/30 w-full max-w-sm shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Durasi Kerja Total:</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                    {calculateWorkDurationHours(todayAttendance.clockInTime, todayAttendance.clockOutTime).toFixed(1)} Jam
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : activeMode === "ATTENDANCE" ? (
          /* ─── STATE 2: ATTENDANCE (CLOCK IN / CLOCK OUT) ─── */
          <div className="space-y-5">
            {/* Status Shift Badge */}
            <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="text-brand-950 font-semibold">
                  {isClockedIn
                    ? "Langkah Berikutnya: Absen Pulang (Clock Out)"
                    : "Langkah Berikutnya: Absen Masuk (Clock In)"}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isClockedIn ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {isClockedIn ? "SEDANG BERTUGAS" : "BELUM ABSEN"}
              </span>
            </div>

            {/* GPS Location Box */}
            <div className="flex items-center gap-3 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80">
              <div className="p-2.5 bg-brand-50 border border-brand-100 text-brand-600 rounded-xl shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-xs">Titik Lokasi GPS Presisi</p>
                {location ? (
                  <p className="text-[11px] text-slate-600 font-mono truncate">
                    Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-[11px] text-rose-500 font-medium">
                    {locationError || "Sedang mengunci sinyal GPS..."}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={getLocation}
                disabled={isRefreshingLocation}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshingLocation ? "animate-spin text-brand-600" : ""}`}
                />
                <span>Refresh GPS</span>
              </button>
            </div>

            {/* Camera Viewfinder */}
            <div className="bg-slate-950 rounded-3xl overflow-hidden relative w-full max-w-sm aspect-square mx-auto flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 shadow-inner group">
              {/* Tombol Toggle Mirror Cermin & Tutup Kamera saat kamera aktif */}
              {isCameraActive && !photoDataUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMirrored((prev) => !prev)}
                    className="absolute top-3 left-3 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-md border border-white/20 transition-all active:scale-95 cursor-pointer"
                    title="Klik untuk membalik cermin horizontal"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5 text-brand-300" />
                    <span>{isMirrored ? "Cermin: Aktif" : "Cermin: Mati"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-md border border-white/20 transition-all active:scale-95 cursor-pointer"
                    title="Matikan kamera"
                  >
                    <span>Tutup</span>
                  </button>
                </>
              )}

              {photoDataUrl ? (
                <div className="relative w-full h-full">
                  <img src={photoDataUrl} alt="Selfie" className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Check className="w-3 h-3" /> Foto Siap
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}
                    className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                  />

                  {/* Face Guide Overlay when Camera Active */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-44 h-56 sm:w-48 sm:h-60 border-2 border-dashed border-white/70 rounded-full flex items-center justify-center">
                        <span className="text-[11px] text-white/80 bg-black/40 backdrop-blur-xs px-3 py-1 rounded-full font-semibold">
                          Posisikan Wajah di Sini
                        </span>
                      </div>
                    </div>
                  )}

                  {!isCameraActive && (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto border border-white/20">
                        <Camera className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm">Ambil Foto Selfie</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Verifikasi kehadiran fisik di lokasi outlet Julia's
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        Buka Kamera Depan
                      </button>
                    </div>
                  )}
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Shutter / Retake Controls */}
            {isCameraActive && !photoDataUrl && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-8 py-3.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-95 text-white rounded-full font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto Selfie</span>
                </button>
              </div>
            )}

            {photoDataUrl && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulangi Ambil Foto</span>
                </button>
              </div>
            )}

            {/* Notes Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catatan Shift (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 p-3.5 text-base sm:text-xs text-slate-800 min-h-[70px] outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                placeholder="Misal: Tukar shift dengan Rian, atau alasan keterlambatan..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !photoDataUrl || !location}
              className={`w-full min-h-[48px] py-4 rounded-2xl font-black text-white text-xs sm:text-sm transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer ${
                isLoading || !photoDataUrl || !location
                  ? "bg-slate-300 cursor-not-allowed shadow-none"
                  : isClockedIn
                  ? "bg-rose-600 hover:bg-rose-700 active:scale-[0.98]"
                  : "bg-brand-600 hover:bg-brand-700 active:scale-[0.98]"
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>
                {isLoading
                  ? "Menyimpan Data..."
                  : isClockedIn
                  ? "KONFIRMASI ABSEN PULANG (CLOCK OUT)"
                  : "KONFIRMASI ABSEN MASUK (CLOCK IN)"}
              </span>
            </button>
          </div>
        ) : (
          /* ─── STATE 3: LEAVE / PERMISSION REQUEST ─── */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Pengajuan Izin atau Sakit</p>
                <p className="text-amber-800/90 mt-0.5 leading-relaxed">
                  Tuliskan keterangan lengkap alasan Anda tidak dapat hadir bertugas hari ini. Manager akan menerima notifikasi untuk verifikasi.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Alasan / Keterangan Tidak Hadir <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 p-3.5 text-base sm:text-xs text-slate-800 min-h-[100px] outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                placeholder="Tuliskan alasan izin / sakit secara rinci (misal: Sakit demam dengan surat dokter, atau keperluan mendesak)..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleLeaveSubmit("IZIN")}
                disabled={isLoading}
                className="min-h-[48px] py-3.5 rounded-2xl font-bold text-white text-xs bg-brand-600 hover:bg-brand-700 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ajukan Izin</span>
              </button>
              <button
                type="button"
                onClick={() => handleLeaveSubmit("SAKIT")}
                disabled={isLoading}
                className="min-h-[48px] py-3.5 rounded-2xl font-bold text-white text-xs bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ajukan Sakit</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
