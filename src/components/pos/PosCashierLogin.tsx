import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../../store/StoreContext";
import {
  Coffee,
  Lock,
  User as UserIcon,
  Delete,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertCircle,
  Store,
  Keyboard,
} from "lucide-react";

interface PosCashierLoginProps {
  onLoginSuccess?: () => void;
}

export const PosCashierLogin: React.FC<PosCashierLoginProps> = ({ onLoginSuccess }) => {
  const { login, settings, users } = useStore();

  // Filter staf yang memiliki akses ke operasional kasir
  const cashierUsers = (users || []).filter((u) =>
    ["KASIR", "BAR", "LEADER", "MANAGER", "OWNER", "SUPER_ADMIN"].includes(u.role)
  );

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const pinRef = useRef(pin);
  pinRef.current = pin;
  const selectedUserRef = useRef(selectedUser);
  selectedUserRef.current = selectedUser;
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pre-select kasir pertama jika ada
  useEffect(() => {
    if (cashierUsers.length > 0 && !selectedUser) {
      // Prioritaskan role KASIR jika ada
      const firstKasir = cashierUsers.find((u) => u.role === "KASIR") || cashierUsers[0];
      setSelectedUser(firstKasir);
    }
  }, [cashierUsers, selectedUser]);

  const handleKeypadPress = async (num: string) => {
    const user = selectedUserRef.current;
    if (!user) {
      setError("Silakan pilih kasir yang bertugas terlebih dahulu!");
      return;
    }
    if (isSubmittingRef.current) return;

    const currentPin = pinRef.current;
    const maxLen = user.pin ? user.pin.length : 6;
    if (currentPin.length < maxLen) {
      const nextPin = currentPin + num;
      pinRef.current = nextPin;
      setPin(nextPin);
      setError("");

      if (nextPin.length === maxLen) {
        isSubmittingRef.current = true;
        try {
          const success = await login(user.username, nextPin);
          if (success) {
            onLoginSuccess?.();
          } else {
            setError("PIN otorisasi tidak sesuai. Silakan coba lagi!");
            pinRef.current = "";
            setPin("");
          }
        } finally {
          isSubmittingRef.current = false;
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isSubmittingRef.current) return;
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setError("");
  };

  const handleClear = () => {
    if (isSubmittingRef.current) return;
    pinRef.current = "";
    setPin("");
    setError("");
  };

  // Listener input keyboard fisik (angka 0-9, backspace, escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between items-center relative overflow-hidden select-none font-sans p-4 sm:p-6 lg:p-8">
      {/* Background Soft Coffee Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-100/50 rounded-full blur-[120px] pointer-events-none" />

      {/* ─── TOP STATUS BAR ─── */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10 py-2 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName}
              className="h-11 w-auto object-contain rounded-2xl shadow-xs"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-600/30">
              <Coffee className="w-6 h-6 stroke-[2.2]" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                {settings.brandName || "COFFEE MANAGEMENT"}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                <Store className="w-3 h-3 text-amber-600" />
                TERMINAL KASIR
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Sistem Kasir Layar Sentuh Tablet Standalone
            </p>
          </div>
        </div>

        {/* Jam Realtime & Status Toko */}
        <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs">
          <Clock className="w-4 h-4 text-amber-600" />
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900 font-mono leading-none">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </header>

      {/* ─── MAIN LOGIN CONTAINER ─── */}
      <main className="w-full max-w-4xl z-10 grid grid-cols-1 md:grid-cols-12 gap-6 my-auto py-4">
        {/* Kolom Kiri: Pilih Kasir Bertugas */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Pilih Kasir Bertugas</h2>
                <p className="text-[11px] text-slate-500">Ketuk nama Anda untuk memulai shift</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {cashierUsers.length} Kasir
              </span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {cashierUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setPin("");
                      setError("");
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500/30"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isSelected
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {u.name?.charAt(0)?.toUpperCase() || "K"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{u.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {u.department ? `${u.department} • ` : ""}
                          <span className="font-semibold text-amber-700">{u.role}</span>
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Setiap transaksi tercatat otomatis atas nama kasir terpilih.</span>
          </div>
        </div>

        {/* Kolom Kanan: Keypad PIN Kasir */}
        <div className="md:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center">
          <div className="text-center mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Masukkan PIN Otorisasi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kasir aktif: <span className="font-bold text-slate-900">{selectedUser?.name || "Pilih Kasir"}</span>
            </p>
          </div>

          {/* PIN Indicator Dots (Support 6 digit default) */}
          <div className="flex flex-col items-center gap-1.5 mb-3">
            <div className="flex items-center gap-3 py-1">
              {Array.from({ length: selectedUser?.pin ? selectedUser.pin.length : 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    pin.length > idx
                      ? "bg-amber-600 border-amber-600 scale-110 shadow-sm shadow-amber-600/30"
                      : "border-slate-300 bg-slate-100"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Ketik via keyboard fisik atau keypad layar</span>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-medium mb-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad Grid (Ergonomis Tablet) */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-lg font-bold text-slate-900 border border-slate-200 shadow-xs transition flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xs font-bold text-slate-600 border border-slate-200 transition flex items-center justify-center"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-lg font-bold text-slate-900 border border-slate-200 shadow-xs transition flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 border border-slate-200 transition flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="w-full max-w-4xl text-center py-2 text-[11px] text-slate-500 z-10 flex items-center justify-between border-t border-slate-200/80 pt-3">
        <p>© {new Date().getFullYear()} {settings.brandName || "Coffee Shop Management"} • Dedicated POS Terminal</p>
        <p className="font-medium text-slate-600">Mode Operasional Kasir Terisolasi</p>
      </footer>
    </div>
  );
};
