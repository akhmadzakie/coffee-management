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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 px-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">Otorisasi Supervisor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col items-center gap-4">
          <p className="text-xs text-slate-300 text-center leading-relaxed">
            {description}
          </p>

          {/* Reason input if required */}
          {requireReason && (
            <div className="w-full">
              <label className="text-[10px] font-medium text-slate-400 mb-1 block">
                Alasan Tindakan <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Tamu ganti menu / salah input kasir"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
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
                    ? "bg-amber-400 border-amber-400 scale-110 shadow-lg shadow-amber-500/40"
                    : "border-slate-700 bg-slate-950"
                }`}
              />
            ))}
          </div>

          {errorMessage && (
            <div className="text-[11px] text-rose-400 text-center flex items-center gap-1.5 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
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
                className="h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-base font-bold text-white border border-slate-700/60 shadow transition flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-12 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-xs font-semibold text-slate-400 border border-slate-800 transition flex items-center justify-center"
            >
              C
            </button>
            <button
              onClick={() => handleKeyClick("0")}
              className="h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-base font-bold text-white border border-slate-700/60 shadow transition flex items-center justify-center"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-12 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-400 border border-slate-800 transition flex items-center justify-center"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 bg-slate-950 border-t border-slate-800 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Batal
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20"
          >
            Verifikasi PIN
          </button>
        </div>
      </div>
    </div>
  );
};
