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

  // Realtime clock ticker
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
      setPin((prev) => prev + num);
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
        return { label: "Owner", color: "text-amber-800 bg-amber-50 border-amber-200" };
      case "MANAGER":
        return { label: "Manager", color: "text-indigo-800 bg-indigo-50 border-indigo-200" };
      case "FINANCE":
        return { label: "Finance", color: "text-blue-800 bg-blue-50 border-blue-200" };
      case "KASIR":
        return { label: "Kasir", color: "text-emerald-800 bg-emerald-50 border-emerald-200" };
      case "LEADER":
        return { label: "Leader", color: "text-orange-800 bg-orange-50 border-orange-200" };
      default:
        return { label: role || "Staff", color: "text-stone-700 bg-stone-100 border-stone-200" };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col justify-between items-center relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8">
      
      {/* Background Soft Coffee Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-amber-100/40 rounded-full blur-[100px] pointer-events-none" />

      {/* ─── TOP STATUS BAR ─── */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName}
              className="h-10 w-auto object-contain rounded-xl shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/20">
              <Coffee className="w-5 h-5 stroke-[2.2]" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold tracking-tight text-stone-900 uppercase">
              {settings.brandName || "COFFEE MANAGEMENT"}
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              Artisan POS & Management System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-stone-200/90 text-xs font-mono text-stone-700 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">
            {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-stone-400 text-[11px] hidden sm:inline">
            • {currentTime.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>
      </header>

      {/* ─── MAIN LOGIN CONTAINER ─── */}
      <main className="w-full max-w-4xl z-10 my-auto py-6">
        {/* Force Logout Alert */}
        {wasForceLoggedOut && (
          <div className="mb-6 mx-auto max-w-md p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 text-xs shadow-sm animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold text-rose-900">Sesi Telah Berakhir</p>
                <p className="text-rose-700 mt-0.5 leading-relaxed">
                  Akun Anda telah dinonaktifkan dari perangkat lain atau sesi kedaluwarsa. Silakan masuk kembali.
                </p>
              </div>
            </div>
            <button
              onClick={dismissForceLogoutAlert}
              className="text-rose-500 hover:text-rose-800 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white border border-stone-200/90 rounded-3xl shadow-xl shadow-stone-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* ─── LEFT: OPERATOR SELECTOR ─── */}
          <div className="md:col-span-5 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-stone-100 bg-[#FAFAFA] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Pilih Operator
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualInput(!isManualInput)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                >
                  {isManualInput ? "Pilih dari Daftar" : "Ketik Manual"}
                </button>
              </div>

              {isManualInput ? (
                <div className="space-y-3 my-4">
                  <label className="block text-xs text-stone-600 font-semibold">Username Operator</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      placeholder="Masukkan username..."
                      className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
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
                              ? "bg-amber-50 border-amber-400 shadow-xs ring-1 ring-amber-400"
                              : "bg-white border-stone-200/80 hover:border-stone-300 hover:bg-stone-50/70"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                                isSelected
                                  ? "bg-amber-500 text-white font-black"
                                  : "bg-stone-100 text-stone-700 border border-stone-200"
                              }`}
                            >
                              {u.name ? u.name.slice(0, 2) : u.username.slice(0, 2)}
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${isSelected ? "text-amber-950" : "text-stone-800"}`}>
                                {u.name || u.username}
                              </p>
                              <p className="text-[11px] text-stone-400 font-mono">@{u.username}</p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-stone-400 py-4 text-center">Tidak ada data operator.</p>
                  )}
                </div>
              )}
            </div>

            {/* Selected Operator Indicator */}
            {selectedUserObj && !isManualInput && (
              <div className="mt-6 pt-4 border-t border-stone-200/80">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Operator Terpilih:</span>
                  <span className="font-bold text-stone-800">{selectedUserObj.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT: PIN TERMINAL & AUTH ─── */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between items-center bg-white">
            <div className="w-full max-w-xs flex flex-col items-center">
              
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                  {selectedUserObj ? `Halo, ${selectedUserObj.name.split(" ")[0]}` : "Otorisasi Masuk"}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  {useKeypad ? "Masukkan 4-digit PIN keamanan kasir" : "Masukkan password akun Anda"}
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
                              ? "bg-amber-500 border-amber-500 shadow-sm shadow-amber-500/40 scale-110"
                              : "bg-stone-100 border-stone-300"
                          }`}
                        />
                      );
                    })}
                  </div>
                  {pin.length > 4 && (
                    <span className="text-[10px] text-stone-400 mt-1 font-mono">
                      {pin.length} digit
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-full mb-6">
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setError("");
                      }}
                      placeholder="Masukkan PIN / Password"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-10 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 text-center tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="w-full mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Touch Numeric Keypad */}
              {useKeypad && (
                <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-[260px]">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="h-14 rounded-2xl bg-[#F8F9FA] hover:bg-stone-100 active:bg-amber-100 active:scale-95 border border-stone-200/90 text-lg font-bold text-stone-800 transition-all flex items-center justify-center select-none shadow-xs"
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-14 rounded-2xl bg-stone-100/70 hover:bg-stone-200/70 active:scale-95 border border-stone-200 text-xs font-bold text-stone-600 transition-all flex items-center justify-center select-none"
                    title="Hapus Semua"
                  >
                    C
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="h-14 rounded-2xl bg-[#F8F9FA] hover:bg-stone-100 active:bg-amber-100 active:scale-95 border border-stone-200/90 text-lg font-bold text-stone-800 transition-all flex items-center justify-center select-none shadow-xs"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-14 rounded-2xl bg-stone-100/70 hover:bg-stone-200/70 active:scale-95 border border-stone-200 text-stone-600 hover:text-stone-900 transition-all flex items-center justify-center select-none"
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
                className="w-full py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-amber-500 shadow-md shadow-amber-500/20"
              >
                <span>Masuk Sistem</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Keypad / Keyboard Mode Toggle */}
              <button
                type="button"
                onClick={() => setUseKeypad(!useKeypad)}
                className="mt-4 text-xs font-medium text-stone-500 hover:text-stone-800 flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{useKeypad ? "Gunakan Input Keyboard" : "Gunakan Touch Keypad"}</span>
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
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1 py-1 font-medium"
          >
            <span>Akun Pengujian Demo (Owner / Kasir / Manager)</span>
            {showDemoDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showDemoDrawer && (
          <div className="mt-2 p-3 rounded-2xl bg-white border border-stone-200/90 shadow-sm flex flex-wrap items-center justify-center gap-2 text-xs text-stone-600 animate-in fade-in">
            <button
              onClick={() => {
                setUsername("admin");
                setPin("1234");
              }}
              className="px-3 py-1 rounded-lg bg-stone-50 hover:bg-amber-50 hover:text-amber-800 border border-stone-200 text-xs transition-colors font-medium"
            >
              👑 Owner: <span className="font-mono text-stone-800">admin / 1234</span>
            </button>
            <button
              onClick={() => {
                setUsername("manager");
                setPin("1234");
              }}
              className="px-3 py-1 rounded-lg bg-stone-50 hover:bg-indigo-50 hover:text-indigo-800 border border-stone-200 text-xs transition-colors font-medium"
            >
              💼 Manager: <span className="font-mono text-stone-800">manager / 1234</span>
            </button>
            <button
              onClick={() => {
                setUsername("kasir");
                setPin("1234");
              }}
              className="px-3 py-1 rounded-lg bg-stone-50 hover:bg-emerald-50 hover:text-emerald-800 border border-stone-200 text-xs transition-colors font-medium"
            >
              💳 Kasir: <span className="font-mono text-stone-800">kasir / 1234</span>
            </button>
            <button
              onClick={() => {
                setUsername("barista");
                setPin("1234");
              }}
              className="px-3 py-1 rounded-lg bg-stone-50 hover:bg-orange-50 hover:text-orange-800 border border-stone-200 text-xs transition-colors font-medium"
            >
              ☕ Leader: <span className="font-mono text-stone-800">barista / 1234</span>
            </button>
          </div>
        )}
      </footer>

    </div>
  );
};
