import React, { useState } from "react";
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
} from "lucide-react";

export const Login = () => {
  const { login, settings, users, wasForceLoggedOut, dismissForceLogoutAlert } =
    useStore();
  const { t } = useTranslation(settings.language || "id");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(username, pin)) {
      setError(
        settings.language === "id"
          ? "Username atau PIN salah!"
          : "Invalid username or PIN!",
      );
    }
  };

  const handleSelectQuickUser = (selectedUsername: string) => {
    setUsername(selectedUsername);
    setPin("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col md:flex-row">
      {/* Branding Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-16 text-center">
        {settings.logoDataUrl ? (
          <img
            src={settings.logoDataUrl}
            alt={settings.brandName}
            className="w-full max-w-sm object-contain mb-8"
          />
        ) : (
          <div className="flex flex-col items-center mb-8">
            <Coffee className="w-20 h-20 text-accent mb-6" />
            <div className="text-left">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-2">
                PENGELOLAAN KEDAI
              </h2>
              <h2 className="text-4xl md:text-5xl font-extrabold text-accent leading-tight tracking-tight">
                MODERN & EFISIEN
              </h2>
            </div>
          </div>
        )}
      </div>

      {/* Login Panel */}
      <div className="w-full md:w-[480px] bg-white flex flex-col justify-center px-8 py-12 md:p-12 shadow-2xl z-10 md:rounded-l-3xl">
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {settings.language === "id" ? "Selamat Datang" : "Welcome Back"}
            </h1>
            <p className="text-slate-500 text-sm">
              {settings.language === "id"
                ? "Silakan masuk ke akun Anda"
                : "Please sign in to your account"}
            </p>
          </div>

          {wasForceLoggedOut && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 text-sm">
                    {settings.language === "id"
                      ? "Sesi Telah Diputus"
                      : "Session Terminated"}
                  </p>
                  <p className="text-amber-700 mt-1">
                    {settings.language === "id"
                      ? "Akun Anda telah dikeluarkan secara paksa dari perangkat lain demi keamanan."
                      : "Your account was force-logged out from another connected device."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissForceLogoutAlert}
                className="text-amber-500 hover:text-amber-700 p-1 rounded-md hover:bg-amber-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Account Chips */}
          {users && users.length > 0 && (
            <div className="mb-8">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Pilih Akun Tersimpan
              </label>
              <div className="flex flex-col gap-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectQuickUser(u.username)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      username === u.username
                        ? "bg-secondary border-accent ring-1 ring-accent"
                        : "bg-white border-slate-200 hover:border-accent hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary text-primary flex items-center justify-center font-bold border border-slate-200 flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-bold truncate ${username === u.username ? "text-primary" : "text-slate-900"}`}
                      >
                        {u.name}
                      </p>
                      <p
                        className={`text-xs truncate ${username === u.username ? "text-accent" : "text-slate-500"}`}
                      >
                        {u.role}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium rounded-xl text-center animate-in shake">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                PIN / Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPin ? "text" : "password"}
                  required
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all tracking-widest font-mono"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPin ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg mt-4 text-sm"
            >
              <ShieldCheck className="w-5 h-5" />
              {settings.language === "id" ? "Masuk ke Sistem" : "Sign In"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              {settings.brandName.toUpperCase()} &copy;{" "}
              {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
