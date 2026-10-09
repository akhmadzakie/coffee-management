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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200/90 w-full max-w-md overflow-hidden flex flex-col text-stone-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 tracking-tight">
                Ganti Akun Operator (Fast Switch)
              </h3>
              <p className="text-xs text-stone-500">
                Beralih sesi kerja kasir atau manajer tanpa logout penuh
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Current Active Operator */}
          {currentUser && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-stone-500">Sedang Aktif:</span>
                <span className="font-bold text-stone-800">{currentUser.name}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadge(currentUser.role).color}`}>
                {getRoleBadge(currentUser.role).label}
              </span>
            </div>
          )}

          {/* Operator Grid Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5">
              1. Pilih Operator Tujuan
            </label>

            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {users.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const isCurrent = currentUser?.id === u.id;
                const badge = getRoleBadge(u.role);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-50 shadow-xs ring-1 ring-amber-400"
                        : "border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                        isSelected
                          ? "bg-amber-500 text-white font-black"
                          : "bg-stone-100 text-stone-700 border border-stone-200"
                      }`}
                    >
                      {u.name?.charAt(0).toUpperCase() || "U"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? "text-amber-950" : "text-stone-800"}`}>
                        {u.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] text-stone-400 font-medium">(Aktif)</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN Input Section */}
          <div className="pt-3 border-t border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                2. Masukkan PIN {selectedUser ? `(${selectedUser.name})` : ""}
              </label>
              {selectedUser && (
                <span className="text-[10px] text-amber-800 font-mono font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  @{selectedUser.username}
                </span>
              )}
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* PIN Dots Display */}
            <div className="flex items-center justify-center gap-3 py-3 bg-stone-50 rounded-2xl border border-stone-200">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      isFilled
                        ? "bg-amber-500 shadow-sm shadow-amber-500/40 scale-110"
                        : "bg-stone-200 border border-stone-300"
                    }`}
                  />
                );
              })}
            </div>

            {/* Compact Numeric Keypad */}
            <div className="bg-stone-50/70 p-2.5 rounded-2xl border border-stone-200">
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="py-3 rounded-xl bg-white hover:bg-stone-100 active:bg-amber-100 active:scale-95 text-stone-800 font-bold text-base transition-all border border-stone-200/90 shadow-xs"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs transition-colors border border-stone-200"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="py-3 rounded-xl bg-white hover:bg-stone-100 active:bg-amber-100 active:scale-95 text-stone-800 font-bold text-base transition-all border border-stone-200/90 shadow-xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors border border-stone-200"
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
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-md shadow-amber-500/20 active:scale-[0.98]"
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
