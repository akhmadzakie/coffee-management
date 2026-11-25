import React, { useState, useEffect, useRef } from "react";
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
  Keyboard,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme, ThemeToggleButton } from "../context/ThemeContext";
import { resolveBrandLogo, resolveThemeLogo } from "../utils/brandLogo";

export const Login = () => {
  const { login, settings, users, wasForceLoggedOut, dismissForceLogoutAlert, lastLoginError } = useStore();
  const { isDark } = useTheme();
  const { t } = useTranslation(settings.language || "id");
  const isIndo = (settings.language || "id") === "id";

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [useKeypad, setUseKeypad] = useState(true);
  const [isManualInput, setIsManualInput] = useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Sync server login error (including remaining PIN attempts / suspension alert)
  useEffect(() => {
    if (lastLoginError) {
      setError(lastLoginError);
    }
  }, [lastLoginError]);

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

  const selectedUserObj = users?.find((u) => u.username === username);

  const pinRef = useRef(pin);
  pinRef.current = pin;
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const selectedUserObjRef = useRef(selectedUserObj);
  selectedUserObjRef.current = selectedUserObj;
  const useKeypadRef = useRef(useKeypad);
  useKeypadRef.current = useKeypad;
  const isSubmittingRef = useRef(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current) return;
    const currentUsername = usernameRef.current;
    const currentPin = pinRef.current;
    if (!currentUsername.trim()) {
      setError(isIndo ? "Pilih akun atau masukkan username operator!" : "Please select or enter username!");
      return;
    }
    if (!currentPin) {
      setError(isIndo ? "Masukkan PIN otorisasi Anda!" : "Please enter your PIN / Password!");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const success = await login(currentUsername, currentPin);
      if (!success) {
        pinRef.current = "";
        setPin("");
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSelectQuickUser = (selectedUsername: string) => {
    setUsername(selectedUsername);
    pinRef.current = "";
    setPin("");
    setError("");
  };

  const handleKeypadPress = (num: string) => {
    if (isSubmittingRef.current) return;
    const targetUser = selectedUserObjRef.current;
    const currentUsername = usernameRef.current;
    const maxLen = targetUser?.pin?.length || 6;
    const currentPin = pinRef.current;

    if (currentPin.length < maxLen) {
      const nextPin = currentPin + num;
      pinRef.current = nextPin;
      setPin(nextPin);
      setError("");

      const targetExpectedLen = targetUser?.pin ? targetUser.pin.length : 6;
      if (nextPin.length === targetExpectedLen) {
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        login(currentUsername, nextPin)
          .then((success) => {
            if (!success) {
              pinRef.current = "";
              setPin("");
            }
          })
          .finally(() => {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
          });
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (isSubmittingRef.current) return;
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setError("");
  };

  const handleKeypadClear = () => {
    if (isSubmittingRef.current) return;
    pinRef.current = "";
    setPin("");
    setError("");
  };

  // Listener keyboard fisik (angka 0-9, backspace, escape, enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      if (isInput) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleLogin();
        }
        return;
      }

      if (useKeypadRef.current) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleKeypadPress(e.key);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          handleKeypadBackspace();
        } else if (e.key === "Escape" || e.key === "Delete") {
          e.preventDefault();
          handleKeypadClear();
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleLogin();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case "SUPER_ADMIN":
        return { label: "Super Admin", color: "text-sky-800 bg-sky-50 border-sky-200" };
      case "OWNER":
        return { label: "Owner (Investor)", color: "text-amber-800 bg-amber-50 border-amber-200" };
      case "MANAGER":
        return { label: "Manager", color: "text-brand-800 bg-brand-50 border-brand-200" };
      case "FINANCE":
        return { label: "Finance", color: "text-brand-800 bg-brand-50 border-brand-200" };
      case "KASIR":
        return { label: "Kasir", color: "text-emerald-800 bg-emerald-50 border-emerald-200" };
      case "LEADER":
        return { label: "Leader", color: "text-purple-800 bg-purple-50 border-purple-200" };
      default:
        return { label: role || "Staff", color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  return (
    <div className="min-h-screen bg-brand-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between items-center relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8 transition-colors">
      
      {/* Background Soft Brand Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-[100px] pointer-events-none" />

      {/* ─── TOP STATUS BAR ─── */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <img
            src={resolveThemeLogo(settings?.logoDataUrl, isDark, "name")}
            alt={settings?.brandName || "Julia's"}
            className="h-10 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = resolveBrandLogo(
                null,
                isDark ? "icon-on-dark" : "icon-on-light"
              );
            }}
          />
          <div className="border-l border-slate-200 dark:border-slate-800 pl-3 hidden sm:block">
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tracking-wider block">
              Specialty Room • Coffee • Eatery
            </span>
            <span className="text-[10px] text-brand-600 dark:text-brand-300 font-medium">POS &amp; Management System</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggleButton compact />
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 shadow-xs tabular-nums">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">
              {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] hidden sm:inline">
              • {currentTime.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </header>

      {/* ─── MAIN LOGIN CONTAINER ─── */}
      <main className="w-full max-w-4xl z-10 my-auto py-6">
        {/* Force Logout Alert */}
        <AnimatePresence>
          {wasForceLoggedOut && (
            <motion.div
              key="force-logout-banner"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mb-6 mx-auto max-w-md p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 flex items-start justify-between gap-3 text-xs shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-100">Sesi Telah Berakhir</p>
                  <p className="text-rose-700 dark:text-rose-200/90 mt-0.5 leading-relaxed">
                    Akun Anda telah dinonaktifkan dari perangkat lain atau sesi kedaluwarsa. Silakan masuk kembali.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissForceLogoutAlert}
                className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", damping: 28, stiffness: 360 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-brand-950/5 dark:shadow-black/40 overflow-hidden grid grid-cols-1 md:grid-cols-12"
        >
          
          {/* ─── LEFT: OPERATOR SELECTOR ─── */}
          <div className="md:col-span-5 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pilih Operator
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualInput(!isManualInput)}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 transition-colors cursor-pointer"
                >
                  {isManualInput ? "Pilih dari Daftar" : "Ketik Manual"}
                </button>
              </div>

              {isManualInput ? (
                <div className="space-y-3 my-4">
                  <label className="block text-xs text-slate-600 dark:text-slate-300 font-semibold">Username Operator</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      placeholder="Masukkan username..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {users && users.length > 0 ? (
                    users.map((u) => {
                      const isSelected = u.username === username;
                      const badge = getRoleBadge(u.role);
                      const isSuspended = Boolean(u.isSuspended);
                      const failedCount = Number(u.failedPinAttempts || 0);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectQuickUser(u.username)}
                          className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all text-left border cursor-pointer ${
                            isSuspended
                              ? isSelected
                                ? "bg-rose-50 dark:bg-rose-500/15 border-rose-500 shadow-xs ring-1 ring-rose-500"
                                : "bg-rose-50/40 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 hover:border-rose-300"
                              : isSelected
                              ? "bg-brand-50 dark:bg-brand-500/15 border-brand-500 shadow-xs ring-1 ring-brand-500"
                              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                                isSuspended
                                  ? "bg-rose-600 text-white font-black"
                                  : isSelected
                                  ? "bg-brand-600 text-white font-black"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {isSuspended ? "🔒" : u.name ? u.name.slice(0, 2) : u.username.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${isSuspended ? "text-rose-900 dark:text-rose-200" : isSelected ? "text-brand-950 dark:text-brand-100" : "text-slate-800 dark:text-slate-100"}`}>
                                {u.name || u.username}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                                {isSuspended && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                                    TER-SUSPEND
                                  </span>
                                )}
                                {!isSuspended && failedCount > 0 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                    Gagal PIN {failedCount}/3
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.color}`}>
                            {badge.label}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">Tidak ada data operator.</p>
                  )}
                </div>
              )}
            </div>

            {/* Selected Operator Indicator */}
            {selectedUserObj && !isManualInput && (
              <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Operator Terpilih:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{selectedUserObj.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT: PIN TERMINAL & AUTH ─── */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between items-center bg-white dark:bg-slate-900">
            <div className="w-full max-w-xs flex flex-col items-center">
              
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {selectedUserObj ? `Halo, ${selectedUserObj.name.split(" ")[0]}` : "Otorisasi Masuk"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {useKeypad
                    ? `Masukkan ${selectedUserObj?.pin?.length || 6} Digit PIN Keamanan`
                    : "Masukkan password / PIN akun Anda"}
                </p>
              </div>

              {/* PIN Indicator Dots (Support 6 digit default) */}
              {useKeypad ? (
                <div className="mb-6 flex flex-col items-center">
                  <div className="flex items-center gap-3.5 my-2">
                    {Array.from({ length: selectedUserObj?.pin?.length || 6 }).map((_, idx) => {
                      const isFilled = pin.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border transition-all duration-150 ${
                            isFilled
                              ? "bg-brand-600 border-brand-600 shadow-sm shadow-brand-600/40 scale-110"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                    <Keyboard className="w-3 h-3 text-slate-400" />
                    <span>{pin.length} / {selectedUserObj?.pin?.length || 6} digit • Bisa ketik keyboard</span>
                  </div>
                </div>
              ) : (
                <div className="w-full mb-6">
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setError("");
                      }}
                      placeholder="Masukkan PIN / Password"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-600 text-center tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Suspended Account Banner */}
              <AnimatePresence>
                {selectedUserObj?.isSuspended && (
                  <motion.div
                    key="suspended-banner"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="w-full mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border-2 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-100 text-xs shadow-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-rose-900 dark:text-rose-100 text-sm">
                          🔒 Akun Ter-suspend Otomatis
                        </p>
                        <p className="text-rose-700 dark:text-rose-200/90 mt-1 leading-relaxed">
                          {selectedUserObj.suspendedReason || "Salah memasukkan PIN sebanyak 3 kali berturut-turut."}
                        </p>
                        <p className="text-rose-800 dark:text-rose-200 font-bold mt-2 bg-white/80 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30">
                          Hubungi Manager atau Super Admin untuk membuka suspend akun ini.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="login-error-banner"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="w-full mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 text-xs text-center flex items-center justify-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Touch Numeric Keypad */}
              {useKeypad && (
                <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-[260px]">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleKeypadPress(num)}
                      className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-brand-50 active:scale-95 border border-slate-200/90 dark:border-slate-700 text-lg font-bold text-slate-800 dark:text-slate-100 transition-all flex items-center justify-center select-none shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleKeypadClear}
                    className="h-14 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-700 active:scale-95 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center select-none cursor-pointer disabled:opacity-50"
                    title="Hapus Semua"
                  >
                    C
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleKeypadPress("0")}
                    className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-brand-50 active:scale-95 border border-slate-200/90 dark:border-slate-700 text-lg font-bold text-slate-800 dark:text-slate-100 transition-all flex items-center justify-center select-none shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleKeypadBackspace}
                    className="h-14 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-700 active:scale-95 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center select-none cursor-pointer disabled:opacity-50"
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
                disabled={!pin || isSubmitting}
                className="w-full py-3.5 px-5 rounded-2xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-600 shadow-md shadow-brand-600/25 cursor-pointer"
              >
                <span>{isSubmitting ? "Memproses..." : "Masuk Sistem"}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Keypad / Keyboard Mode Toggle */}
              <button
                type="button"
                onClick={() => setUseKeypad(!useKeypad)}
                className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{useKeypad ? "Gunakan Input Keyboard" : "Gunakan Touch Keypad"}</span>
              </button>

            </div>
          </div>
        </motion.div>
      </main>

      {/* ─── BOTTOM MINIMALIST DEMO BAR ─── */}
      <footer className="w-full max-w-4xl z-10">
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowDemoDrawer(!showDemoDrawer)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center gap-1 py-1 font-medium cursor-pointer"
          >
            <span>Akun Pengujian Demo (Super Admin / Owner / Manager / Kasir / Leader)</span>
            {showDemoDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {showDemoDrawer && (
            <motion.div
              key="demo-drawer"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mt-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300"
            >
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  pinRef.current = "123456";
                  setPin("123456");
                  setError("");
                }}
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-500/15 hover:text-sky-800 dark:hover:text-sky-200 border border-slate-200 dark:border-slate-700 text-xs transition-colors font-medium cursor-pointer"
              >
                🛠️ Super Admin (IT): <span className="font-mono text-slate-800 dark:text-slate-200">admin / 123456</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("owner");
                  pinRef.current = "123456";
                  setPin("123456");
                  setError("");
                }}
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:text-amber-800 dark:hover:text-amber-200 border border-slate-200 dark:border-slate-700 text-xs transition-colors font-medium cursor-pointer"
              >
                👑 Owner (Investor): <span className="font-mono text-slate-800 dark:text-slate-200">owner / 123456</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("manager");
                  pinRef.current = "123456";
                  setPin("123456");
                  setError("");
                }}
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/15 hover:text-brand-800 dark:hover:text-brand-200 border border-slate-200 dark:border-slate-700 text-xs transition-colors font-medium cursor-pointer"
              >
                💼 Manager (Operasional): <span className="font-mono text-slate-800 dark:text-slate-200">manager / 123456</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("kasir");
                  pinRef.current = "123456";
                  setPin("123456");
                  setError("");
                }}
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:text-emerald-800 dark:hover:text-emerald-200 border border-slate-200 dark:border-slate-700 text-xs transition-colors font-medium cursor-pointer"
              >
                💳 Kasir: <span className="font-mono text-slate-800 dark:text-slate-200">kasir / 123456</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("leader");
                  pinRef.current = "123456";
                  setPin("123456");
                  setError("");
                }}
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-500/15 hover:text-purple-800 dark:hover:text-purple-200 border border-slate-200 dark:border-slate-700 text-xs transition-colors font-medium cursor-pointer"
              >
                ☕ Leader Bar: <span className="font-mono text-slate-800 dark:text-slate-200">leader / 123456</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

    </div>
  );
};
