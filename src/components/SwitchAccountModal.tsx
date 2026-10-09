import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { User } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ShieldCheck,
  KeyRound,
  UserCheck,
  Eye,
  EyeOff,
  Lock,
  Delete,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
} from "lucide-react";

interface SwitchAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SwitchAccountModal: React.FC<SwitchAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { users, currentUser, login, settings } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setPin("");
    setError("");
  };

  const handleKeypadPress = (num: string) => {
    if (pin.length < 8) {
      const nextPin = pin + num;
      setPin(nextPin);
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

  const handleSwitchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError("Pilih operator yang ingin beralih");
      return;
    }
    if (!pin) {
      setError("Masukkan PIN operator");
      return;
    }

    const success = login(selectedUser.username, pin);
    if (success) {
      setError("");
      setPin("");
      setSelectedUser(null);
      onClose();
    } else {
      setError("PIN salah. Silakan coba lagi.");
      setPin("");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case "SUPER_ADMIN":
      case "OWNER":
        return { label: "Owner", bg: "bg-amber-100 text-amber-800 border-amber-300", icon: "👑" };
      case "MANAGER":
        return { label: "Manager", bg: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: "💼" };
      case "FINANCE":
        return { label: "Finance", bg: "bg-blue-100 text-blue-800 border-blue-300", icon: "📊" };
      case "KASIR":
        return { label: "Kasir POS", bg: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "💳" };
      case "LEADER":
        return { label: "Leader Bar", bg: "bg-orange-100 text-orange-800 border-orange-300", icon: "☕" };
      default:
        return { label: role || "Staff", bg: "bg-slate-100 text-slate-700 border-slate-300", icon: "👤" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-amber-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold border border-amber-500/20 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Ganti Akun Operator (Fast Switch)
              </h3>
              <p className="text-xs text-slate-500">
                Beralih sesi kerja kasir atau otoritas manajer dengan cepat.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh] custom-scrollbar">
          {/* Current Operator Card */}
          {currentUser && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-500">Operator Aktif Saat Ini:</span>
                <strong className="text-slate-800 font-bold">{currentUser.name}</strong>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadge(currentUser.role).bg}`}>
                {getRoleBadge(currentUser.role).icon} {currentUser.role}
              </span>
            </div>
          )}

          {/* Grid Operator Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              1. Pilih Operator Tujuan
            </label>

            <div className="grid grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
              {users.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const isCurrent = currentUser?.id === u.id;
                const badge = getRoleBadge(u.role);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected
                          ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {u.name?.charAt(0).toUpperCase() || "U"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold truncate ${isSelected ? "text-amber-950" : "text-slate-800"}`}>
                          {u.name}
                        </p>
                        {isCurrent && (
                          <span className="text-[9px] text-slate-400 font-semibold">(Aktif)</span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${badge.bg}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN Input & Keypad */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Masukkan PIN {selectedUser ? `(${selectedUser.name})` : ""}
              </label>
              {selectedUser && (
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Target: {selectedUser.username}
                </span>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl text-center"
              >
                {error}
              </motion.div>
            )}

            {/* PIN Display Dots */}
            <div className="flex items-center justify-center gap-3 py-3 bg-slate-50 rounded-2xl border border-slate-200">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      isFilled
                        ? "bg-amber-500 scale-110 shadow-sm shadow-amber-500/50 ring-4 ring-amber-500/20"
                        : "bg-slate-200 border border-slate-300"
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad for fast tablet touch */}
            <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="py-3 rounded-xl bg-white hover:bg-slate-100 active:bg-amber-500 active:text-slate-950 text-slate-800 font-mono font-bold text-base transition-all border border-slate-200 shadow-xs cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-colors border border-slate-200 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="py-3 rounded-xl bg-white hover:bg-slate-100 active:bg-amber-500 active:text-slate-950 text-slate-800 font-mono font-bold text-base transition-all border border-slate-200 shadow-xs cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                  title="Hapus"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="button"
              onClick={() => handleSwitchSubmit()}
              disabled={!selectedUser}
              className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                selectedUser
                  ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-[0.99]"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span>Konfirmasi & Beralih Akun</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
