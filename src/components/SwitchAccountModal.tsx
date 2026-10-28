import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
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
  Keyboard,
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

  const targetPinLength = selectedUser?.pin?.length === 4 ? 4 : 6;

  const pinRef = useRef(pin);
  pinRef.current = pin;
  const selectedUserRef = useRef(selectedUser);
  selectedUserRef.current = selectedUser;
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    pinRef.current = "";
    setPin("");
    setError("");
  };

  const handleKeypadPress = (num: string) => {
    if (isSubmittingRef.current) return;
    const user = selectedUserRef.current;
    if (!user) {
      setError("Pilih operator yang ingin beralih.");
      return;
    }

    const maxLen = user.pin?.length === 4 ? 4 : 6;
    const currentPin = pinRef.current;
    if (currentPin.length < maxLen) {
      const nextPin = currentPin + num;
      pinRef.current = nextPin;
      setPin(nextPin);
      setError("");

      if (nextPin.length === maxLen) {
        setIsSubmitting(true);
        login(user.username, nextPin).then((success) => {
          setIsSubmitting(false);
          if (success) {
            setError("");
            pinRef.current = "";
            setPin("");
            setSelectedUser(null);
            onClose();
          } else {
            setError("PIN otorisasi tidak sesuai.");
            pinRef.current = "";
            setPin("");
          }
        }).catch(() => {
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

  const handleSwitchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const user = selectedUserRef.current;
    const currentPin = pinRef.current;
    if (!user) {
      setError("Pilih operator yang ingin beralih.");
      return;
    }
    if (!currentPin) {
      setError("Masukkan PIN operator.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(user.username, currentPin);
      if (success) {
        setError("");
        pinRef.current = "";
        setPin("");
        setSelectedUser(null);
        onClose();
      } else {
        setError("PIN otorisasi tidak sesuai.");
        pinRef.current = "";
        setPin("");
      }
    } catch (err: any) {
      setError("Gagal beralih akun: " + (err.message || "Kesalahan server"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Listener keyboard fisik saat modal aktif
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      if (isInput) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (pinRef.current) {
          handleKeypadClear();
        } else {
          onClose();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSwitchSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedUser(null);
      setPin("");
      setError("");
      setIsSubmitting(false);
      pinRef.current = "";
    }
  }, [isOpen]);

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case "SUPER_ADMIN":
      case "OWNER":
        return { label: "Owner", color: "text-brand-700 bg-brand-50 border-brand-200/80" };
      case "MANAGER":
        return { label: "Manager", color: "text-indigo-800 bg-indigo-50 border-indigo-200" };
      case "FINANCE":
        return { label: "Finance", color: "text-blue-800 bg-blue-50 border-blue-200" };
      case "KASIR":
        return { label: "Kasir", color: "text-emerald-800 bg-emerald-50 border-emerald-200" };
      case "LEADER":
        return { label: "Leader", color: "text-indigo-800 bg-indigo-50 border-indigo-200" };
      default:
        return { label: role || "Staff", color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="switch-account-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm overflow-y-auto"
        >
          <motion.div
            key="switch-account-card"
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col text-slate-900 my-auto max-h-[85vh] sm:max-h-[88vh]"
          >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFA] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/80 text-brand-600 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Ganti Akun Operator (Fast Switch)
              </h3>
              <p className="text-xs text-slate-500">
                Beralih sesi kerja kasir atau manajer tanpa logout penuh
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Current Active Operator */}
          {currentUser && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-500">Sedang Aktif:</span>
                <span className="font-bold text-slate-800">{currentUser.name}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadge(currentUser.role).color}`}>
                {getRoleBadge(currentUser.role).label}
              </span>
            </div>
          )}

          {/* Operator Grid Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
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
                        ? "border-brand-600 bg-brand-50 shadow-xs ring-1 ring-brand-500"
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                        isSelected
                          ? "bg-brand-600 text-white font-black"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {u.name?.charAt(0).toUpperCase() || "U"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? "text-brand-950" : "text-slate-800"}`}>
                        {u.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] text-slate-400 font-medium">(Aktif)</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN Input Section */}
          <div className="pt-3 border-t border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                2. Masukkan PIN ({targetPinLength} Digit) {selectedUser ? `(${selectedUser.name})` : ""}
              </label>
              {selectedUser && (
                <span className="text-[10px] text-brand-700 font-mono font-semibold bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
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

            {/* PIN Dots Display (Responsive 4 or 6 digit) */}
            <div className="flex flex-col items-center justify-center gap-1.5 py-2.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-center gap-3">
                {Array.from({ length: targetPinLength }).map((_, idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                        isFilled
                          ? "bg-brand-600 shadow-sm shadow-brand-500/40 scale-110"
                          : "bg-slate-200 border border-slate-300"
                      }`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Keyboard className="w-3 h-3 text-slate-400" />
                <span>Ketik di keyboard atau keypad layar</span>
              </div>
            </div>

            {/* Compact Numeric Keypad */}
            <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="py-3 rounded-xl bg-white hover:bg-slate-100 active:bg-brand-50 active:scale-95 text-slate-800 font-bold text-base transition-all border border-slate-200/90 shadow-xs"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors border border-slate-200"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="py-3 rounded-xl bg-white hover:bg-slate-100 active:bg-brand-50 active:scale-95 text-slate-800 font-bold text-base transition-all border border-slate-200/90 shadow-xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors border border-slate-200"
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
              className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-md shadow-brand-500/20 active:scale-[0.98]"
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

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
