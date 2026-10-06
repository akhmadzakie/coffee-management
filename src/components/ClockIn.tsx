import React, { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store/StoreContext";
import { Camera, MapPin, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion } from "motion/react";
import { DailyAttendance } from "../types";

export function ClockIn() {
  const { currentUser, dailyAttendances, addDailyAttendance, updateDailyAttendance } = useStore();
  
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check today's attendance for the current user
  const todayStr = new Date().toISOString().split("T")[0];
  const todayAttendance = dailyAttendances.find(
    (a) => a.employeeId === currentUser?.id && a.date === todayStr
  );
  
  const isClockedIn = !!todayAttendance?.clockInTime;
  const isClockedOut = !!todayAttendance?.clockOutTime;

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Tidak dapat mengakses kamera. Pastikan izin diberikan.");
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
    if (!navigator.geolocation) {
      setLocationError("Geolokasi tidak didukung oleh browser Anda");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError("");
      },
      (error) => {
        setLocationError("Gagal mendapatkan lokasi: " + error.message);
      },
      { enableHighAccuracy: true }
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Add Watermark
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px Arial";
    
    const now = new Date();
    const timeStr = now.toLocaleString("id-ID");
    const locStr = location ? `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}` : "Lokasi tidak diketahui";
    
    ctx.fillText(`Waktu: ${timeStr}`, 10, canvas.height - 35);
    ctx.fillText(`Lokasi: ${locStr}`, 10, canvas.height - 15);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (!photoDataUrl) {
      alert("Harap ambil foto selfie terlebih dahulu.");
      return;
    }
    if (!location) {
      alert("Lokasi belum didapatkan. Pastikan GPS aktif.");
      return;
    }
    if (!currentUser) return;

    setIsLoading(true);
    const now = new Date().toISOString();

    try {
      if (!isClockedIn) {
        // Clock In
        let status: "HADIR" | "TERLAMBAT" = "HADIR";
        const hour = new Date().getHours();
        if (hour >= 9) status = "TERLAMBAT"; // Example: Late after 9 AM
        
        addDailyAttendance({
          employeeId: currentUser.id,
          date: todayStr,
          clockInTime: now,
          clockOutTime: null,
          clockInLocation: location,
          clockOutLocation: null,
          clockInPhotoUrl: photoDataUrl,
          clockOutPhotoUrl: null,
          status,
          notes
        });
        alert("Berhasil Clock In!");
      } else if (!isClockedOut && todayAttendance) {
        // Clock Out
        updateDailyAttendance({
          ...todayAttendance,
          clockOutTime: now,
          clockOutLocation: location,
          clockOutPhotoUrl: photoDataUrl,
          notes: todayAttendance.notes ? `${todayAttendance.notes} | ${notes}` : notes
        });
        alert("Berhasil Clock Out!");
      }
      
      setPhotoDataUrl(null);
      setNotes("");
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) return <div>Silakan login.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Absensi Harian</h2>
        <p className="text-slate-500 mb-6">Ambil foto selfie beserta lokasi Anda untuk Clock In / Clock Out.</p>

        {isClockedOut ? (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex flex-col items-center justify-center text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-emerald-800">Anda sudah menyelesaikan shift hari ini.</h3>
            <p className="text-sm text-emerald-600 mt-1">Clock In: {new Date(todayAttendance.clockInTime!).toLocaleTimeString("id-ID")}</p>
            <p className="text-sm text-emerald-600">Clock Out: {new Date(todayAttendance.clockOutTime!).toLocaleTimeString("id-ID")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <MapPin className="text-blue-500 w-6 h-6" />
              <div className="flex-1">
                <p className="font-semibold text-slate-700">Status Lokasi</p>
                {location ? (
                  <p className="text-sm text-slate-500">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
                ) : (
                  <p className="text-sm text-rose-500">{locationError || "Sedang mencari lokasi..."}</p>
                )}
              </div>
              <button onClick={getLocation} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200">
                Refresh GPS
              </button>
            </div>

            <div className="bg-slate-100 rounded-2xl overflow-hidden relative aspect-video flex items-center justify-center border border-slate-200">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="Selfie" className="w-full h-full object-cover" />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                  />
                  {!isCameraActive && (
                    <div className="text-center p-6">
                      <Camera className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <button
                        onClick={startCamera}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                      >
                        Buka Kamera
                      </button>
                    </div>
                  )}
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {isCameraActive && !photoDataUrl && (
              <div className="flex justify-center">
                <button
                  onClick={capturePhoto}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                >
                  Ambil Foto
                </button>
              </div>
            )}

            {photoDataUrl && (
              <div className="flex justify-center">
                <button
                  onClick={handleRetake}
                  className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                >
                  Ulangi Foto
                </button>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">Catatan (Opsional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 min-h-[80px]"
                placeholder="Tambahkan catatan jika perlu..."
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || !photoDataUrl || !location}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all flex justify-center items-center gap-2 ${
                isLoading || !photoDataUrl || !location
                  ? "bg-slate-300 cursor-not-allowed"
                  : isClockedIn ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              <Clock className="w-5 h-5" />
              {isClockedIn ? "CLOCK OUT" : "CLOCK IN"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
