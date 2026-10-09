import React, { useState, useEffect } from "react";
import { useStore } from "../store/StoreContext";
import { useTranslation } from "../utils/i18n";
import {
  Coffee,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  ShieldAlert,
  X,
  ArrowRight,
  Clock,
  CheckCircle2,
  Delete,
  KeyRound,
  Sparkles,
  ChevronDown,
  ChevronUp,
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
  const [isManualInput, setIsManualInput] = useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Realtime clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pre-select first user if available
  useEffect(() => {
    if (users && users.length > 0 && !username) {
      setUsername(users[0].username);
    }
  }, [users]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError(isIndo ? "Pilih akun atau masukkan username operator!" : "Please select or enter username!");
      return;
    }
    if (!pin) {
      setError(isIndo ? "Masukkan PIN otorisasi Anda!" : "Please enter your PIN / Password!");
      return;
    }

    const success = await login(username, pin);
    if (!success) {
      setError(isIndo ? "PIN otorisasi tidak sesuai. Silakan coba lagi." : "Invalid credentials. Please try again.");
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
        return { label: "Owner", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      case "MANAGER":
        return { label: "Manager", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" };
      case "FINANCE":
        return { label: "Finance", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
      case "KASIR":
        return { label: "Kasir", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
      case "LEADER":
        return { label: "Leader", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
      default:
        return { label: role || "Staff", color: "text-stone-300 bg-white/5 border-white/10" };
    }
  };

  return (
    <div className="min-h-screen bg-[#08090D] text-stone-100 flex flex-col justify-between items-center relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8">
      
      {/* Background Subtle Ambient Vignette */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* ─── TOP STATUS BAR ─── */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName}
              className="h-9 w-auto object-contain rounded-lg"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coffee className="w-5 h-5 stroke-[2]" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">
              {settings.brandName || "COFFEE MANAGEMENT"}
            </h1>
            <p className="text-[11px] text-stone-400 tracking-wider">
              Artisan POS & Management System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-stone-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-stone-500 text-[10px] hidden sm:inline">
            {currentTime.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>
      </header>

      {/* ─── MAIN LOGIN CONTAINER ─── */}
      <main className="w-full max-w-4xl z-10 my-auto py-6">
        {/* Force Logout Alert */}
        {wasForceLoggedOut && (
          <div className="mb-6 mx-auto max-w-md p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold text-rose-200">Sesi Telah Berakhir</p>
                <p className="text-rose-300/80 mt-0.5 leading-relaxed">
                  Akun Anda telah dinonaktifkan dari perangkat lain atau sesi kedaluwarsa. Silakan masuk kembali.
                </p>
              </div>
            </div>
            <button
              onClick={dismissForceLogoutAlert}
              className="text-rose-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-[#0F1118] border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 backdrop-blur-xl">
          
          {/* ─── LEFT: OPERATOR SELECTOR ─── */}
          <div className="md:col-span-5 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-white/[0.06] bg-[#0C0E14] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Pilih Operator
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualInput(!isManualInput)}
                  className="text-[11px] text-amber-400/90 hover:text-amber-300 transition-colors"
                >
                  {isManualInput ? "Pilih dari Daftar" : "Ketik Manual"}
                </button>
              </div>

              {isManualInput ? (
                <div className="space-y-3 my-4">
                  <label className="block text-xs text-stone-400 font-medium">Username Operator</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      placeholder="Masukkan username..."
                      className="w-full bg-[#141722] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {users && users.length > 0 ? (
                    users.map((u) => {
                      const isSelected = u.username === username;
                      const badge = getRoleBadge(u.role);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectQuickUser(u.username)}
                          className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all text-left border ${
                            isSelected
                              ? "bg-amber-500/[0.08] border-amber-500/40 shadow-sm"
                              : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                                isSelected
                                  ? "bg-amber-500 text-stone-950 font-black"
                                  : "bg-white/[0.06] text-stone-300"
                              }`}
                            >
                              {u.name ? u.name.slice(0, 2) : u.username.slice(0, 2)}
                            </div>
                            <div>
                              <p className={`text-xs font-semibold ${isSelected ? "text-white" : "text-stone-200"}`}>
                                {u.name || u.username}
                              </p>
                              <p className="text-[10px] text-stone-500 font-mono">@{u.username}</p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-stone-500 py-4 text-center">Tidak ada data pengguna.</p>
                  )}
                </div>
              )}
            </div>

            {/* Selected Operator Highlight */}
            {selectedUserObj && !isManualInput && (
              <div className="mt-6 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>Operator Terpilih:</span>
                  <span className="font-semibold text-stone-200">{selectedUserObj.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT: PIN TERMINAL & AUTH ─── */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between items-center bg-[#0F1118]">
            <div className="w-full max-w-xs flex flex-col items-center">
              
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {selectedUserObj ? `Halo, ${selectedUserObj.name.split(" ")[0]}` : "Otorisasi Akses"}
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  {useKeypad ? "Masukkan 4-digit PIN keamanan Anda" : "Ketik Password / PIN akun"}
                </p>
              </div>

              {/* PIN Indicator Dots */}
              {useKeypad ? (
                <div className="mb-6 flex flex-col items-center">
                  <div className="flex items-center gap-3.5 my-2">
                    {[0, 1, 2, 3].map((idx) => {
                      const isFilled = pin.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border transition-all duration-150 ${
                            isFilled
                              ? "bg-amber-400 border-amber-400 shadow-sm shadow-amber-400/50 scale-110"
                              : "bg-white/[0.04] border-white/[0.15]"
                          }`}
                        />
                      );
                    })}
                  </div>
                  {pin.length > 4 && (
                    <span className="text-[10px] text-stone-500 mt-1 font-mono">
                      {pin.length} digit
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-full mb-6">
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setError("");
                      }}
                      placeholder="Masukkan PIN / Password"
                      className="w-full bg-[#141722] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-400/50 text-center tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="w-full mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Numeric Touch Keypad */}
              {useKeypad && (
                <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-[260px]">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="h-14 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] active:bg-amber-500/20 active:scale-95 border border-white/[0.06] hover:border-white/[0.12] text-lg font-semibold text-stone-200 transition-all flex items-center justify-center select-none shadow-sm"
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-14 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] active:scale-95 border border-white/[0.05] text-xs font-semibold text-stone-400 transition-all flex items-center justify-center select-none"
                    title="Hapus Semua"
                  >
                    C
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="h-14 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] active:bg-amber-500/20 active:scale-95 border border-white/[0.06] hover:border-white/[0.12] text-lg font-semibold text-stone-200 transition-all flex items-center justify-center select-none shadow-sm"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-14 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] active:scale-95 border border-white/[0.05] text-stone-400 hover:text-stone-200 transition-all flex items-center justify-center select-none"
                    title="Backspace"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Login Action Button */}
              <button
                type="button"
                onClick={() => handleLogin()}
                disabled={!pin}
                className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-amber-500 shadow-lg shadow-amber-500/10"
              >
                <span>Masuk Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setUseKeypad(!useKeypad)}
                className="mt-4 text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{useKeypad ? "Gunakan Keyboard" : "Gunakan Touch Keypad"}</span>
              </button>

            </div>
          </div>
        </div>
      </main>

      {/* ─── BOTTOM MINIMALIST DEMO BAR ─── */}
      <footer className="w-full max-w-4xl z-10">
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowDemoDrawer(!showDemoDrawer)}
            className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors flex items-center gap-1 py-1"
          >
            <span>Akun Pengujian Demo (Owner / Kasir / Manager)</span>
            {showDemoDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showDemoDrawer && (
          <div className="mt-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-wrap items-center justify-center gap-2 text-xs text-stone-400 animate-in fade-in">
            <button
              onClick={() => {
                setUsername("admin");
                setPin("1234");
              }}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-amber-500/10 hover:text-amber-300 border border-white/[0.06] text-[11px] transition-colors"
            >
              👑 Owner: <span className="font-mono text-stone-300">admin / 1234</span>
            </button>
            <button
              onClick={() => {
                setUsername("manager");
                setPin("1234");
              }}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-indigo-500/10 hover:text-indigo-300 border border-white/[0.06] text-[11px] transition-colors"
            >
              💼 Manager: <span className="font-mono text-stone-300">manager / 1234</span>
            </button>
            <button
              onClick={() => {
                setUsername("kasir");
                setPin("1234");
              }}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-emerald-500/10 hover:text-emerald-300 border border-white/[0.06] text-[11px] transition-colors"
            >
              💳 Kasir: <span className="font-mono text-stone-300">kasir / 1234</span>
            </button>
            <button
              onClick={() => {
                setUsername("barista");
                setPin("1234");
              }}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-orange-500/10 hover:text-orange-300 border border-white/[0.06] text-[11px] transition-colors"
            >
              ☕ Leader: <span className="font-mono text-stone-300">barista / 1234</span>
            </button>
          </div>
        )}
      </footer>

    </div>
  );
};
