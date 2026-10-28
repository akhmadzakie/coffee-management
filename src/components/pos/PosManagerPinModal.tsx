import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../../store/StoreContext";
import {
  Lock,
  X,
  CheckCircle2,
  AlertCircle,
  Delete,
  KeyRound,
  Keyboard,
  Smartphone,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface PosManagerPinModalProps {
  title: string;
  description: string;
  requireReason?: boolean;
  orderId?: string;
  receiptNo?: string;
  amount?: number;
  tableNumber?: string;
  customerName?: string;
  actionType?: "VOID" | "REFUND" | "DISCOUNT" | "GENERAL";
  onClose: () => void;
  onSuccess: (manager: any, reason?: string) => void;
}

export const PosManagerPinModal: React.FC<PosManagerPinModalProps> = ({
  title,
  description,
  requireReason = false,
  orderId,
  receiptNo,
  amount,
  tableNumber,
  customerName,
  actionType,
  onClose,
  onSuccess,
}) => {
  const { users, settings, currentUser } = useStore();
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Remote approval states
  const [remoteRequestId, setRemoteRequestId] = useState<string | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | null>(null);
  const [remoteApprover, setRemoteApprover] = useState<string | null>(null);
  const [remoteNote, setRemoteNote] = useState<string | null>(null);
  const [isSendingRemote, setIsSendingRemote] = useState(false);

  const pinRef = useRef(pin);
  pinRef.current = pin;
  const reasonRef = useRef(reason);
  reasonRef.current = reason;

  const handleKeyClick = (val: string) => {
    if (pinRef.current.length < 6) {
      const nextPin = pinRef.current + val;
      pinRef.current = nextPin;
      setPin(nextPin);
      setErrorMessage("");
    }
  };

  const handleBackspace = () => {
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setErrorMessage("");
  };

  const handleClear = () => {
    pinRef.current = "";
    setPin("");
    setErrorMessage("");
  };

  const handleSendRemoteRequest = async () => {
    if (requireReason && !reasonRef.current.trim()) {
      setErrorMessage("Alasan wajib diisi sebelum meminta otorisasi ke Manajer.");
      return;
    }

    setIsSendingRemote(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/pos/approvals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId || `ACTION-${Date.now()}`,
          receiptNo: receiptNo || "POS",
          type: actionType || "VOID",
          amount: amount || 0,
          reason: reasonRef.current.trim() || description,
          cashierName: currentUser?.name || "Kasir",
          tableNumber: tableNumber || "-",
          customerName: customerName || "Tamu",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengirim permintaan ke Manager");
      }

      const data = await res.json();
      setRemoteRequestId(data.request.id);
      setRemoteStatus("PENDING");
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menghubungi server");
    } finally {
      setIsSendingRemote(false);
    }
  };

  // Polling status remote approval
  useEffect(() => {
    if (!remoteRequestId || remoteStatus !== "PENDING") return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pos/approvals/${remoteRequestId}/status`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.status === "APPROVED") {
            setRemoteStatus("APPROVED");
            setRemoteApprover(data.respondedBy || "Manager");
            setRemoteNote(data.responseNote || null);
            clearInterval(interval);
            setTimeout(() => {
              if (isMounted) {
                onSuccess(
                  { id: "remote_manager", name: data.respondedBy || "Manager", role: "MANAGER" },
                  reasonRef.current.trim()
                );
              }
            }, 1200);
          } else if (data.status === "REJECTED") {
            setRemoteStatus("REJECTED");
            setRemoteApprover(data.respondedBy || "Manager");
            setRemoteNote(data.responseNote || null);
            clearInterval(interval);
          }
        }
      } catch {}
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [remoteRequestId, remoteStatus]);

  const handleVerify = () => {
    const currentPin = pinRef.current;
    if (!currentPin) {
      setErrorMessage("Silakan masukkan PIN.");
      return;
    }

    if (requireReason && !reasonRef.current.trim()) {
      setErrorMessage("Alasan pembatalan/otorisasi wajib diisi.");
      return;
    }

    const supervisorPin = settings?.posSupervisorPin || "1234";
    const isSupervisorMatch = currentPin === supervisorPin;

    // Cari user dengan PIN cocok dan role MANAGER, OWNER, atau SUPER_ADMIN
    const authorizedUser = users.find((u) => {
      const isManagerOrOwner =
        u.role === "MANAGER" || u.role === "OWNER" || u.role === "SUPER_ADMIN";
      if (!isManagerOrOwner) return false;
      if (u.pin) {
        return (
          u.pin === currentPin ||
          (currentPin === "123456" && (u.pin === "1234" || u.pin === "123456"))
        );
      }
      return currentPin === "123456" || currentPin === "1234";
    });

    if (isSupervisorMatch) {
      const supervisorObj = authorizedUser || {
        id: "supervisor_pos",
        name: "Supervisor POS",
        role: "MANAGER",
        pin: currentPin,
      };
      onSuccess(supervisorObj, reasonRef.current.trim());
      return;
    }

    if (!authorizedUser) {
      setErrorMessage("PIN salah atau Anda tidak memiliki wewenang Supervisor / Manager.");
      pinRef.current = "";
      setPin("");
      return;
    }

    onSuccess({ ...authorizedUser, pin: currentPin }, reasonRef.current.trim());
  };

  // Listener input keyboard fisik (angka 0-9, backspace, escape, enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      if (isInput) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleVerify();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (pinRef.current) {
          handleClear();
        } else {
          onClose();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleVerify();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
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
                disabled={remoteStatus === "PENDING"}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition disabled:opacity-50"
              />
            </div>
          )}

          {/* Status Remote Approval Radar */}
          {remoteRequestId ? (
            <div className="w-full py-4 px-3 rounded-2xl border border-amber-200 bg-amber-50/70 text-center space-y-3">
              {remoteStatus === "PENDING" && (
                <>
                  <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping" />
                    <span className="relative w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
                      <Smartphone className="w-5 h-5 animate-pulse" />
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      Menunggu Respon Manager di HP / Dashboard...
                    </h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Permintaan otorisasi telah dikirim. Polling status otomatis setiap 2 detik.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoteRequestId(null);
                      setRemoteStatus(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition shadow-2xs cursor-pointer"
                  >
                    Batal Menunggu (Gunakan PIN)
                  </button>
                </>
              )}

              {remoteStatus === "APPROVED" && (
                <div className="py-2 text-center text-emerald-800 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold">Otorisasi Disetujui!</p>
                  <p className="text-[11px] text-emerald-600">
                    Disetujui oleh: {remoteApprover || "Manager"}
                    {remoteNote ? ` (${remoteNote})` : ""}
                  </p>
                </div>
              )}

              {remoteStatus === "REJECTED" && (
                <div className="py-2 text-center text-rose-800 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
                  <p className="text-xs font-bold">Permintaan Ditolak oleh Manager</p>
                  <p className="text-[11px] text-rose-600">
                    Oleh: {remoteApprover || "Manager"}
                    {remoteNote ? ` — Alasan: "${remoteNote}"` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoteRequestId(null);
                      setRemoteStatus(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-[11px] font-bold hover:bg-rose-50 transition cursor-pointer"
                  >
                    Kembali ke Input PIN
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* PIN Dots Display (6 digit) */}
              <div className="flex flex-col items-center gap-1.5 py-1">
                <div className="flex items-center gap-3 py-1">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                        pin.length > idx
                          ? "bg-brand-600 border-brand-600 scale-110 shadow-sm shadow-brand-600/40"
                          : "border-slate-300 bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Ketik di keyboard atau keypad layar</span>
                </div>
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
                    className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base font-bold text-slate-900 border border-slate-200 shadow-xs transition flex items-center justify-center cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xs font-bold text-slate-600 border border-slate-200 transition flex items-center justify-center cursor-pointer"
                >
                  C
                </button>
                <button
                  onClick={() => handleKeyClick("0")}
                  className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base font-bold text-slate-900 border border-slate-200 shadow-xs transition flex items-center justify-center cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 border border-slate-200 transition flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              {/* Remote Approval Option Button */}
              <div className="w-full pt-1">
                <button
                  type="button"
                  onClick={handleSendRemoteRequest}
                  disabled={isSendingRemote}
                  className="w-full py-2.5 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  {isSendingRemote ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengirim ke HP Manajer...</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                      <span>Manajer Tidak di Tempat? Minta Jarak Jauh</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 bg-slate-50 border-t border-slate-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            Batal
          </button>
          {!remoteRequestId && (
            <button
              onClick={handleVerify}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              Verifikasi PIN
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
