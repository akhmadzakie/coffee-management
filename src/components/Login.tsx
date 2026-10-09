import React, { useState, useEffect } from "react";
import { useStore } from "../store/StoreContext";
import { useTranslation } from "../utils/i18n";
import { motion, AnimatePresence } from "motion/react";
import {
  Coffee,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  ShieldAlert,
  X,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Delete,
  KeyRound,
  Store,
  Layers,
  ChevronRight,
} from "lucide-react";

export const Login = () => {
  const { login, settings, users, wasForceLoggedOut, dismissForceLogoutAlert } = useStore();
  const { t } = useTranslation(settings.language || "id");
  const isIndo = (settings.language || "id") === "id";

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [useKeypad, setUseKeypad] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Realtime clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError(isIndo ? "Pilih akun atau masukkan username terlebih dahulu!" : "Please select or enter username!");
      return;
    }
    if (!pin) {
      setError(isIndo ? "Masukkan PIN / Password Anda!" : "Please enter your PIN / Password!");
      return;
    }

    const success = await login(username, pin);
    if (!success) {
      setError(isIndo ? "Username atau PIN salah! Silakan coba lagi." : "Invalid username or PIN!");
      setPin("");
    }
  };

  const handleSelectQuickUser = (selectedUsername: string) => {
    setUsername(selectedUsername);
    setPin("");
    setError("");
  };

  const handleKeypadPress = (num: string) => {
    if (pin.length < 8) {
      const newPin = pin + num;
      setPin(newPin);
      setError("");
    }
  };

  const handleKeypadBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handleKeypadClear = () => {
    setPin("");
    setError("");
  };

  const selectedUserObj = users?.find((u) => u.username === username);

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case "SUPER_ADMIN":
      case "OWNER":
        return { label: "Owner", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: "👑" };
      case "MANAGER":
        return { label: "Manager", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30", icon: "💼" };
      case "FINANCE":
        return { label: "Finance", bg: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: "📊" };
      case "KASIR":
        return { label: "Kasir POS", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: "💳" };
      case "LEADER":
        return { label: "Leader Bar", bg: "bg-orange-500/10 text-orange-400 border-orange-500/30", icon: "☕" };
      default:
        return { label: role || "Staff", bg: "bg-slate-500/10 text-slate-300 border-slate-500/30", icon: "👤" };
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col lg:flex-row relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-amber-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ─── LEFT BRANDING & ATMOSPHERE PANEL ─── */}
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative z-10 border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-gradient-to-br from-[#0B0F17]/90 via-[#0E131F]/80 to-[#070A0F]/90 backdrop-blur-xl">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logoDataUrl ? (
              <img
                src={settings.logoDataUrl}
                alt={settings.brandName}
                className="h-10 w-auto object-contain rounded-xl shadow-md"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                <Coffee className="w-6 h-6 text-slate-950 stroke-[2.5]" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-black tracking-tight text-white leading-none">
                {settings.brandName || "COFFEE MANAGEMENT"}
              </h2>
              <span className="text-[11px] font-semibold text-amber-400/90 tracking-wide uppercase">
                Artisan Coffee POS & Management
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/80 text-xs font-mono text-slate-300 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Center Hero Text */}
        <div className="my-10 lg:my-0 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sistem Operasional Terintegrasi & Cepat</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.15] tracking-tight mb-4">
            Pengelolaan Kedai Modern, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">Presisi & Efisien.</span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
            Kendali penuh atas kasir POS, resep bahan baku, jadwal shift barista, evaluasi KPI, dan laporan laba rugi dalam satu sentuhan.
          </p>

          {/* Quick Value Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                <Store className="w-4 h-4" /> POS Kasir
              </div>
              <p className="text-[11px] text-slate-400">Order cepat, split bill & struk thermal instan.</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1">
                <Layers className="w-4 h-4" /> Bahan & HPP
              </div>
              <p className="text-[11px] text-slate-400">Pengurangan stok resep otomatis & audit opname.</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                <ShieldCheck className="w-4 h-4" /> Hak Akses
              </div>
              <p className="text-[11px] text-slate-400">Aman dengan role Owner, Manager, dan Kasir.</p>
            </div>
          </div>
        </div>

        {/* Bottom Footer Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-slate-800/60 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sistem Operasional Cloud Siap Melayani</span>
          </div>
          <div>
            <span>{settings.companyName || settings.brandName} &copy; {currentTime.getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT LOGIN & QUICK SWITCH PANEL ─── */}
      <div className="w-full lg:w-[520px] xl:w-[560px] bg-[#0B0F17]/95 flex flex-col justify-center p-6 sm:p-10 lg:p-12 relative z-20 backdrop-blur-2xl">
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Header Card */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isIndo ? "Masuk ke Sistem" : "Sign In"}
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 font-semibold border border-slate-700/60">
                Pilih Akun & PIN
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pilih profil pengguna di bawah atau ketik username untuk mulai bertugas.
            </p>
          </div>

          {/* Force Logout Alert if any */}
          {wasForceLoggedOut && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-200">
                    {isIndo ? "Sesi Sebelumnya Diputus" : "Previous Session Terminated"}
                  </p>
                  <p className="text-amber-300/80 text-[11px] mt-0.5">
                    {isIndo
                      ? "Akun Anda telah dikeluarkan dari perangkat lain demi keamanan."
                      : "Account was safely logged out from other active devices."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissForceLogoutAlert}
                className="text-amber-400 hover:text-amber-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ─── QUICK PROFILE SELECTOR ─── */}
          {users && users.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                  Pilih Cepat Akun Operator:
                </span>
                <span className="text-slate-500 text-[11px]">{users.length} akun terdaftar</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {users.map((u) => {
                  const isSelected = username.toLowerCase() === u.username.toLowerCase();
                  const badge = getRoleBadge(u.role);

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectQuickUser(u.username)}
                      className={`group relative flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-amber-500/15 to-indigo-500/15 border-amber-500/60 ring-2 ring-amber-500/20 shadow-md"
                          : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-hover:scale-105 ${
                        isSelected 
                          ? "bg-amber-500 text-slate-950 font-black shadow-sm shadow-amber-500/30" 
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}>
                        {u.name?.charAt(0).toUpperCase() || "U"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isSelected ? "text-amber-300" : "text-slate-200"}`}>
                          {u.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border ${badge.bg}`}>
                            {badge.icon} {badge.label}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="absolute right-2 top-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── LOGIN FORM & PIN INPUT ─── */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-medium rounded-xl text-center"
              >
                {error}
              </motion.div>
            )}

            {/* Username Input Field */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                Username Operator
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  placeholder="Ketik atau pilih username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 focus:bg-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            {/* PIN / Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  PIN Masuk
                </label>
                <button
                  type="button"
                  onClick={() => setUseKeypad(!useKeypad)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  {useKeypad ? "Gunakan Keyboard Biasa" : "Gunakan Layar Sentuh PIN"}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPin ? "text" : "password"}
                  required
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError("");
                  }}
                  placeholder="••••"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 focus:bg-slate-900 outline-none transition-all tracking-widest font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ─── TOUCH NUMERIC KEYPAD (IDEAL FOR POS TABLETS) ─── */}
            {useKeypad && (
              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-amber-500 active:text-slate-950 text-white font-mono font-bold text-sm transition-all border border-slate-700/60 shadow-xs"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="py-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-semibold text-xs transition-colors border border-slate-800"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-amber-500 active:text-slate-950 text-white font-mono font-bold text-sm transition-all border border-slate-700/60 shadow-xs"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="py-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors border border-slate-800"
                    title="Hapus Digit"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] text-slate-950 font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-xs sm:text-sm tracking-wide uppercase cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span>{isIndo ? "Masuk ke Sistem Kedai" : "Sign In to Coffee POS"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Notice info */}
          <div className="text-center pt-2">
            <span className="text-[11px] text-slate-500">
              Butuh bantuan akses atau reset PIN? Hubungi Manager / Owner.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
