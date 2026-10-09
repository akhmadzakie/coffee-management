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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyAttendance } from "../types";
import { getLocalDateString } from "../utils/dateUtils";

export function ClockIn() {
  const { currentUser, employees, dailyAttendances, addDailyAttendance, updateDailyAttendance, employeeShifts } = useStore();
  
  const [activeMode, setActiveMode] = useState<"ATTENDANCE" | "LEAVE">("ATTENDANCE");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check today's attendance for the current user
  const todayStr = getLocalDateString();
  const activeEmployee = employees.find(e => e.username === currentUser?.username);
  const activeEmployeeId = currentUser?.employeeId || activeEmployee?.id || currentUser?.id;

  const todayShift = (employeeShifts || []).find(
    (s: any) => s.employeeId === activeEmployeeId && s.date === todayStr
  );
  const scheduledShift = todayShift?.shiftType || "PAGI";

  const todayAttendance = dailyAttendances.find(
    (a) => a.employeeId === activeEmployeeId && a.date === todayStr
  );
  
  const isClockedIn = !!todayAttendance?.clockInTime;
  const isClockedOut = !!todayAttendance?.clockOutTime;

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
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false 
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
      streamRef.current.getTracks().forEach(track => track.stop());
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
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Add Watermark
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fillRect(0, canvas.height - 55, canvas.width, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px 'Plus Jakarta Sans', Arial, sans-serif";
    
    const now = new Date();
    const timeStr = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const locStr = location ? `GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "GPS: Tidak diketahui";
    
    ctx.fillText(`${activeEmployee?.name || currentUser?.name || "Karyawan"} • Shift ${scheduledShift} • ${timeStr}`, 14, canvas.height - 30);
    ctx.fillText(`${locStr} • Julia Coffee`, 14, canvas.height - 12);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (!photoDataUrl) {
      setFeedback({ type: "error", message: "Harap ambil foto selfie kamera terlebih dahulu." });
      return;
    }
    if (!location) {
      setFeedback({ type: "error", message: "Koordinat GPS belum didapatkan. Pastikan izin lokasi aktif." });
      return;
    }
    if (!currentUser) return;

    setIsLoading(true);
    const now = new Date().toISOString();

    try {
      if (!isClockedIn) {
        // Clock In
        let status: "HADIR" | "TERLAMBAT" = "HADIR";
        const nowDecimalHour = new Date().getHours() + new Date().getMinutes() / 60;
        
        // Toleransi 15 menit dari jam mulai shift
        if (scheduledShift === "PAGI" && nowDecimalHour > 7.25) status = "TERLAMBAT";
        else if (scheduledShift === "MIDDLE" && nowDecimalHour > 11.25) status = "TERLAMBAT";
        else if (scheduledShift === "SORE" && nowDecimalHour > 15.25) status = "TERLAMBAT";
        
        addDailyAttendance({
          employeeId: activeEmployeeId as string,
          date: todayStr,
          clockInTime: now,
          clockOutTime: null,
          clockInLocation: location,
          clockOutLocation: null,
          clockInPhotoUrl: photoDataUrl,
          clockOutPhotoUrl: null,
          status,
          notes: notes.trim()
        });
        setFeedback({ type: "success", message: `Clock In berhasil dicatat untuk Shift ${scheduledShift}! Selamat bertugas.` });
      } else if (!isClockedOut && todayAttendance) {
        // Clock Out
        updateDailyAttendance({
          ...todayAttendance,
          clockOutTime: now,
          clockOutLocation: location,
          clockOutPhotoUrl: photoDataUrl,
          notes: todayAttendance.notes ? `${todayAttendance.notes} | ${notes.trim()}` : notes.trim()
        });
        setFeedback({ type: "success", message: "Clock Out berhasil dicatat! Terima kasih atas dedikasi Anda." });
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
    if (!notes.trim()) {
      setFeedback({ type: "error", message: "Harap isi keterangan alasan pengajuan izin/sakit." });
      return;
    }
    if (!currentUser || !activeEmployeeId) return;

    setIsLoading(true);
    const now = new Date().toISOString();
    
    try {
      addDailyAttendance({
        employeeId: activeEmployeeId,
        date: todayStr,
        clockInTime: now,
        clockOutTime: now,
        clockInLocation: location || { lat: 0, lng: 0 },
        clockOutLocation: location || { lat: 0, lng: 0 },
        clockInPhotoUrl: photoDataUrl || "",
        clockOutPhotoUrl: photoDataUrl || "",
        status: leaveStatus,
        notes: notes.trim()
      });
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

  if (!currentUser) return <div className="p-8 text-center text-slate-500">Silakan login terlebih dahulu.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold shadow-lg border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
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
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/80">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                Absensi Kehadiran
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Selfie & GPS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {currentUser.name} • {currentUser.role} {activeEmployee?.department ? `(${activeEmployee.department})` : ""}
            </p>
          </div>

          {/* Mode Switcher */}
          {!isClockedOut && (
            <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveMode("ATTENDANCE")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeMode === "ATTENDANCE"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Hadir Shift
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("LEAVE")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeMode === "LEAVE"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Izin / Sakit
              </button>
            </div>
          )}
        </div>

        {/* Jadwal Shift Banner */}
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 p-4 rounded-2xl border border-slate-200/80 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
              scheduledShift === "PAGI" ? "bg-emerald-100 text-emerald-800" :
              scheduledShift === "MIDDLE" ? "bg-blue-100 text-blue-800" :
              scheduledShift === "SORE" ? "bg-amber-100 text-amber-800" :
              "bg-slate-200 text-slate-700"
            }`}>
              {scheduledShift === "PAGI" ? "PGI" : scheduledShift === "MIDDLE" ? "MID" : scheduledShift === "SORE" ? "SRE" : "OFF"}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Jadwal Shift Anda Hari Ini
              </p>
              <p className="text-sm font-bold text-slate-800">
                {scheduledShift === "PAGI" ? "Shift Pagi (07:00 – 15:00 WIB)" :
                 scheduledShift === "MIDDLE" ? "Shift Middle (11:00 – 19:00 WIB)" :
                 scheduledShift === "SORE" ? "Shift Sore (15:00 – 23:00 WIB)" :
                 "Hari Libur (OFF)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Toleransi keterlambatan 15 mnt</span>
          </div>
        </div>

        {/* ─── STATE 1: ALREADY COMPLETED SHIFT TODAY ─── */}
        {isClockedOut ? (
          <div className="bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/50 border border-emerald-200/80 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Shift Anda Hari Ini Telah Selesai
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md">
              Data kehadiran Anda telah tercatat dengan aman dan siap diverifikasi oleh Manager.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-6">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-left">
                <span className="text-[11px] text-slate-400 block">Jam Masuk (IN)</span>
                <span className="text-base font-black text-emerald-700 font-mono">
                  {new Date(todayAttendance.clockInTime!).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-left">
                <span className="text-[11px] text-slate-400 block">Jam Pulang (OUT)</span>
                <span className="text-base font-black text-rose-700 font-mono">
                  {new Date(todayAttendance.clockOutTime!).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {todayAttendance.clockInTime && todayAttendance.clockOutTime && (
              <div className="mt-4 p-4 bg-white rounded-xl border border-emerald-100 w-full max-w-sm shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Durasi Kerja Total:</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">
                    {((new Date(todayAttendance.clockOutTime).getTime() - new Date(todayAttendance.clockInTime).getTime()) / 3600000).toFixed(1)} Jam
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : activeMode === "ATTENDANCE" ? (
          /* ─── STATE 2: ATTENDANCE (CLOCK IN / CLOCK OUT) ─── */
          <div className="space-y-6">
            {/* Status Shift Badge */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-blue-900 font-semibold">
                  {isClockedIn ? "Langkah Berikutnya: Absen Pulang (Clock Out)" : "Langkah Berikutnya: Absen Masuk (Clock In)"}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isClockedIn ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {isClockedIn ? "SEDANG BERTUGAS" : "BELUM ABSEN"}
              </span>
            </div>

            {/* GPS Location Box */}
            <div className="flex items-center gap-3 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80">
              <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-xs">Titik Lokasi GPS</p>
                {location ? (
                  <p className="text-[11px] text-slate-600 font-mono truncate">
                    Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-[11px] text-rose-500 font-medium">
                    {locationError || "Sedang mengunci sinyal GPS presisi..."}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={getLocation}
                disabled={isRefreshingLocation}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLocation ? "animate-spin text-blue-600" : ""}`} />
                <span>Refresh GPS</span>
              </button>
            </div>

            {/* Camera Viewfinder */}
            <div className="bg-slate-900 rounded-3xl overflow-hidden relative aspect-video flex items-center justify-center border-2 border-slate-200 shadow-inner group">
              {photoDataUrl ? (
                <div className="relative w-full h-full">
                  <img src={photoDataUrl} alt="Selfie" className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
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
                    className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                  />

                  {/* Face Guide Overlay when Camera Active */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-60 sm:w-56 sm:h-64 border-2 border-dashed border-white/60 rounded-full flex items-center justify-center">
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
                          Verifikasi kehadiran fisik di lokasi outlet
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all"
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
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full font-bold text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
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
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
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
                className="w-full rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 p-3 text-xs text-slate-700 min-h-[70px] outline-none transition-all placeholder:text-slate-400"
                placeholder="Misal: Tukar shift dengan Rian, atau alasan keterlambatan..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !photoDataUrl || !location}
              className={`w-full py-4 rounded-2xl font-black text-white text-sm transition-all shadow-lg flex justify-center items-center gap-2 ${
                isLoading || !photoDataUrl || !location
                  ? "bg-slate-300 cursor-not-allowed shadow-none"
                  : isClockedIn
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 active:scale-[0.99]"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 active:scale-[0.99]"
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
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Pengajuan Izin atau Sakit</p>
                <p className="text-amber-800/90 mt-0.5">
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
                className="w-full rounded-2xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 p-3.5 text-xs text-slate-700 min-h-[100px] outline-none transition-all placeholder:text-slate-400"
                placeholder="Tuliskan alasan izin / sakit secara rinci (misal: Sakit demam dengan surat dokter, atau keperluan mendesak)..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleLeaveSubmit("IZIN")}
                disabled={isLoading}
                className="py-3.5 rounded-2xl font-bold text-white text-xs bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Ajukan Izin</span>
              </button>
              <button
                type="button"
                onClick={() => handleLeaveSubmit("SAKIT")}
                disabled={isLoading}
                className="py-3.5 rounded-2xl font-bold text-white text-xs bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
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
