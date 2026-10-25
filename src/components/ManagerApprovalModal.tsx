import React, { useState, useEffect } from "react";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import { ManagerApprovalRequest } from "../types";
import {
  ShieldAlert,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  PackageCheck,
  Trash2,
  MinusCircle,
  Banknote,
  CreditCard,
  QrCode,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";

interface ManagerApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessed?: () => void;
}

export const ManagerApprovalModal: React.FC<ManagerApprovalModalProps> = ({
  isOpen,
  onClose,
  onProcessed,
}) => {
  const { currentUser } = useStore();
  const [requests, setRequests] = useState<ManagerApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pos/approvals/pending");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (e) {
      console.error("Gagal memuat pending approvals:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPending();
    }
  }, [isOpen]);

  const handleRespond = async (
    reqId: string,
    action: "APPROVE" | "REJECT",
    receiptNo: string
  ) => {
    setProcessingId(reqId);
    setActionMessage(null);

    try {
      const token = localStorage.getItem("node_session_id");
      const res = await fetch(`/api/pos/approvals/${reqId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action,
          managerName: currentUser?.name || "Manager",
          responseNote: (noteMap[reqId] || "").trim(),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setActionMessage(
          action === "APPROVE"
            ? `Nota #${receiptNo} berhasil disetujui!`
            : `Nota #${receiptNo} berhasil ditolak.`
        );
        await fetchPending();
        onProcessed?.();
      } else {
        alert(result.error || "Gagal memproses otorisasi");
      }
    } catch (e: any) {
      alert(e?.message || "Terjadi kesalahan jaringan");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-gradient-to-r from-amber-500 to-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Otorisasi Remote Kasir (In-App Approval)
              </h2>
              <p className="text-xs text-white/90">
                Persetujuan pengembalian dana (refund) & pembatalan nota kasir langsung dari dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="p-3 px-6 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
          {isLoading && requests.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs">Memeriksa permintaan otorisasi kasir...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800">Semua Beres! Tidak Ada Permintaan Pending</p>
              <p className="text-xs text-slate-400 text-center max-w-sm">
                Saat kasir mengajukan refund atau void via remote approval, notifikasi akan langsung muncul di sini.
              </p>
            </div>
          ) : (
            requests.map((req) => {
              const reqTime = new Date(req.requestedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isProcessing = processingId === req.id;

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3"
                >
                  {/* Top info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          req.type === "REFUND"
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {req.type}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-900">
                        #{req.receiptNo}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {reqTime}
                      </span>
                    </div>

                    <span className="text-sm font-black text-rose-600 font-mono">
                      {formatCurrency(req.amount)}
                    </span>
                  </div>

                  {/* Metadata kasir & meja */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Kasir Pengaju:</p>
                      <p className="font-bold text-slate-800">{req.cashierName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Meja / Tamu:</p>
                      <p className="font-bold text-slate-800">{req.tableNumber || "-"} ({req.customerName || "Tamu"})</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Metode & Restok:</p>
                      <p className="font-semibold text-slate-700">
                        {req.refundMethod || "CASH"} •{" "}
                        <span className="text-[11px] text-emerald-700 font-bold">
                          {req.refundRestockOption === "RETURN_TO_STOCK"
                            ? "Restok"
                            : req.refundRestockOption === "WASTE"
                            ? "Waste"
                            : "Tanpa Stok"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Alasan Kasir */}
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                    <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider mb-0.5">
                      Alasan Pengajuan Kasir:
                    </p>
                    <p className="text-slate-800 italic">"{req.reason}"</p>
                  </div>

                  {/* Catatan Manager Input (Opsional) */}
                  <div>
                    <input
                      type="text"
                      placeholder="Tambahkan catatan untuk kasir (opsional)..."
                      value={noteMap[req.id] || ""}
                      onChange={(e) =>
                        setNoteMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRespond(req.id, "REJECT", req.receiptNo)}
                      className="px-4 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRespond(req.id, "APPROVE", req.receiptNo)}
                      className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-3" />
                          <span>Setujui (Approve)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={fetchPending}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Segarkan Daftar</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
