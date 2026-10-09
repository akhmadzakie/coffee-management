import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { User } from "../types";
import {
  X,
  ShieldCheck,
  KeyRound,
  Delete,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface SwitchAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SwitchAccountModal: React.FC<SwitchAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { users, currentUser, login } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
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

  const handleSwitchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError("Pilih operator yang ingin beralih.");
      return;
    }
    if (!pin) {
      setError("Masukkan PIN operator.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(selectedUser.username, pin);
      if (success) {
        setError("");
        setPin("");
        setSelectedUser(null);
        onClose();
      } else {
        setError("PIN otorisasi tidak sesuai.");
        setPin("");
      }
    } catch (err: any) {
      setError("Gagal beralih akun: " + (err.message || "Kesalahan server"));
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0E1017] rounded-3xl shadow-2xl border border-white/[0.08] w-full max-w-md overflow-hidden flex flex-col text-stone-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-[#12151E]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Ganti Akun Operator (Fast Switch)
              </h3>
              <p className="text-[11px] text-stone-400">
                Beralih sesi kerja kasir atau manajer tanpa logout penuh
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Current Active Operator */}
          {currentUser && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-stone-400">Sedang Aktif:</span>
                <span className="font-semibold text-stone-200">{currentUser.name}</span>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadge(currentUser.role).color}`}>
                {getRoleBadge(currentUser.role).label}
              </span>
            </div>
          )}

          {/* Operator Grid Selection */}
          <div>
            <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">
              1. Pilih Operator Tujuan
            </label>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {users.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const isCurrent = currentUser?.id === u.id;
                const badge = getRoleBadge(u.role);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/[0.08] shadow-sm"
                        : "border-white/[0.05] hover:border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                        isSelected
                          ? "bg-amber-500 text-stone-950 font-black"
                          : "bg-white/[0.06] text-stone-300"
                      }`}
                    >
                      {u.name?.charAt(0).toUpperCase() || "U"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${isSelected ? "text-white" : "text-stone-300"}`}>
                        {u.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] text-stone-500">(Aktif)</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN Input Section */}
          <div className="pt-3 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                2. Masukkan PIN {selectedUser ? `(${selectedUser.name})` : ""}
              </label>
              {selectedUser && (
                <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  @{selectedUser.username}
                </span>
              )}
            </div>

            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* PIN Dots Display */}
            <div className="flex items-center justify-center gap-3 py-3 bg-[#090A0E] rounded-xl border border-white/[0.06]">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      isFilled
                        ? "bg-amber-400 shadow-sm shadow-amber-400/50 scale-110"
                        : "bg-white/[0.05] border border-white/[0.12]"
                    }`}
                  />
                );
              })}
            </div>

            {/* Compact Numeric Keypad */}
            <div className="bg-[#090A0E] p-2.5 rounded-2xl border border-white/[0.06]">
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] active:bg-amber-500/20 active:scale-95 text-stone-200 font-semibold text-base transition-all border border-white/[0.05]"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] text-stone-400 font-semibold text-xs transition-colors border border-white/[0.04]"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] active:bg-amber-500/20 active:scale-95 text-stone-200 font-semibold text-base transition-all border border-white/[0.05]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] text-stone-400 hover:text-stone-200 flex items-center justify-center transition-colors border border-white/[0.04]"
                  title="Hapus"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => handleSwitchSubmit()}
              disabled={!selectedUser || !pin || isSubmitting}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-amber-500/10 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Konfirmasi & Beralih Akun</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
