import React, { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Lock, X, CheckCircle2, AlertCircle, Delete, KeyRound } from "lucide-react";

interface PosManagerPinModalProps {
  title: string;
  description: string;
  requireReason?: boolean;
  onClose: () => void;
  onSuccess: (manager: any, reason?: string) => void;
}

export const PosManagerPinModal: React.FC<PosManagerPinModalProps> = ({
  title,
  description,
  requireReason = false,
  onClose,
  onSuccess,
}) => {
  const { users } = useStore();
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleKeyClick = (val: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + val);
      setErrorMessage("");
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage("");
  };

  const handleClear = () => {
    setPin("");
    setErrorMessage("");
  };

  const handleVerify = () => {
    if (!pin) {
      setErrorMessage("Silakan masukkan PIN.");
      return;
    }

    if (requireReason && !reason.trim()) {
      setErrorMessage("Alasan pembatalan/otorisasi wajib diisi.");
      return;
    }

    // Cari user dengan PIN cocok dan role MANAGER, OWNER, atau SUPER_ADMIN
    const authorizedUser = users.find(
      (u) =>
        u.pin === pin &&
        (u.role === "MANAGER" || u.role === "OWNER" || u.role === "SUPER_ADMIN")
    );

    if (!authorizedUser) {
      setErrorMessage("PIN salah atau Anda tidak memiliki wewenang Manager/Owner.");
      setPin("");
      return;
    }

    onSuccess(authorizedUser, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500 font-medium">Otorisasi Supervisor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col items-center gap-4">
          <p className="text-xs text-slate-600 text-center leading-relaxed font-medium">
            {description}
          </p>

          {/* Reason input if required */}
          {requireReason && (
            <div className="w-full">
              <label className="text-[10px] font-bold text-slate-600 mb-1 block">
                Alasan Tindakan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Tamu ganti menu / salah input kasir"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>
          )}

          {/* PIN Dots Display */}
          <div className="flex items-center gap-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  pin.length > idx
                    ? "bg-amber-500 border-amber-500 scale-110 shadow-sm shadow-amber-500/40"
                    : "border-slate-300 bg-slate-100"
                }`}
              />
            ))}
          </div>

          {errorMessage && (
            <div className="text-[11px] text-rose-700 text-center flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Numeric Keypad Grid */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyClick(num)}
                className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base font-bold text-slate-900 border border-slate-200 shadow-xs transition flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xs font-bold text-slate-600 border border-slate-200 transition flex items-center justify-center"
            >
              C
            </button>
            <button
              onClick={() => handleKeyClick("0")}
              className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base font-bold text-slate-900 border border-slate-200 shadow-xs transition flex items-center justify-center"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 border border-slate-200 transition flex items-center justify-center"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 bg-slate-50 border-t border-slate-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Batal
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white shadow-xs transition"
          >
            Verifikasi PIN
          </button>
        </div>
      </div>
    </div>
  );
};
