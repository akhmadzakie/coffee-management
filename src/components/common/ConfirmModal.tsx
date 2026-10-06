import React, { useState, useEffect } from "react";
import { AlertTriangle, Trash2, X, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Jika diisi, user harus mengetik kata ini sebelum bisa konfirmasi */
  verifyKeyword?: string;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    btnClass: "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500",
    borderClass: "border-rose-200",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    btnClass: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400",
    borderClass: "border-amber-200",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    btnClass: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    borderClass: "border-blue-200",
  },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  verifyKeyword,
}) => {
  const [typedKeyword, setTypedKeyword] = useState("");
  const config = variantConfig[variant];
  const Icon = config.icon;

  useEffect(() => {
    if (!isOpen) setTypedKeyword("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  const canConfirm = !verifyKeyword || typedKeyword === verifyKeyword;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-slate-900/60  flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${config.borderClass}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-11 h-11 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mt-1 -mr-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verify keyword input */}
            {verifyKeyword && (
              <div className="px-6 pb-4">
                <p className="text-xs text-slate-500 mb-2">
                  Ketik{" "}
                  <span className="font-bold font-mono text-rose-600">
                    {verifyKeyword}
                  </span>{" "}
                  untuk melanjutkan:
                </p>
                <input
                  autoFocus
                  type="text"
                  value={typedKeyword}
                  onChange={(e) => setTypedKeyword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  placeholder={verifyKeyword}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  if (canConfirm) onConfirm();
                }}
                disabled={!canConfirm}
                className={`flex-1 py-2.5 px-4 text-white rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.btnClass} ${
                  !canConfirm ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── useConfirm hook ──────────────────────────────────────────────────────────
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  verifyKeyword?: string;
  onConfirm: () => void;
}

/**
 * Hook untuk mengelola state ConfirmModal dengan mudah.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   <ConfirmModal {...confirm.modalProps} />
 *   confirm.open({ title: "Hapus?", message: "...", onConfirm: () => deleteItem() });
 */
export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const open = (opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    options?.onConfirm();
    setIsOpen(false);
    setOptions(null);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setOptions(null);
  };

  const modalProps: ConfirmModalProps = {
    isOpen,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    title: options?.title || "",
    message: options?.message || "",
    confirmLabel: options?.confirmLabel,
    cancelLabel: options?.cancelLabel,
    variant: options?.variant,
    verifyKeyword: options?.verifyKeyword,
  };

  return { open, modalProps };
};
