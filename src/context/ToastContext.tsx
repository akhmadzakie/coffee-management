import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

type ToastListener = (item: ToastItem) => void;

const toastListeners = new Set<ToastListener>();
let toastSequence = 0;

const emitToast = (variant: ToastVariant, message: string, duration = 4000) => {
  const item: ToastItem = {
    id: `toast-${Date.now()}-${++toastSequence}`,
    variant,
    message,
    duration,
  };
  toastListeners.forEach((listener) => listener(item));
  return item.id;
};

/** Global toast API for triggering notifications from anywhere in the app. */
export const toast = {
  success: (message: string, duration?: number) => emitToast("success", message, duration),
  error: (message: string, duration?: number) => emitToast("error", message, duration),
  warning: (message: string, duration?: number) => emitToast("warning", message, duration),
  info: (message: string, duration?: number) => emitToast("info", message, duration),
};

interface ToastContextValue {
  showToast: (variant: ToastVariant, message: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_STYLES: Record<
  ToastVariant,
  {
    container: string;
    iconWrap: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  success: {
    container:
      "bg-white/95 dark:bg-slate-900/95 border-emerald-200/90 dark:border-emerald-500/40 text-slate-900 dark:text-slate-100",
    iconWrap:
      "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-500/30",
    Icon: CheckCircle2,
  },
  error: {
    container:
      "bg-white/95 dark:bg-slate-900/95 border-rose-200/90 dark:border-rose-500/40 text-slate-900 dark:text-slate-100",
    iconWrap:
      "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200/70 dark:border-rose-500/30",
    Icon: AlertCircle,
  },
  warning: {
    container:
      "bg-white/95 dark:bg-slate-900/95 border-amber-200/90 dark:border-amber-500/40 text-slate-900 dark:text-slate-100",
    iconWrap:
      "bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-200/70 dark:border-amber-500/30",
    Icon: AlertTriangle,
  },
  info: {
    container:
      "bg-white/95 dark:bg-slate-900/95 border-brand-200/90 dark:border-brand-500/40 text-slate-900 dark:text-slate-100",
    iconWrap:
      "bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30",
    Icon: Info,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const onEmit: ToastListener = (next) => {
      setItems((prev) => [next, ...prev].slice(0, 4));
      const ms = next.duration ?? 4000;
      if (ms > 0) {
        window.setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== next.id));
        }, ms);
      }
    };
    toastListeners.add(onEmit);
    return () => {
      toastListeners.delete(onEmit);
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast: emitToast,
      dismissToast,
      success: toast.success,
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
    }),
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2.5 sm:w-[380px] pointer-events-none"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => {
                const style = TOAST_STYLES[item.variant];
                const Icon = style.Icon;
                return (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, y: -12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.96 }}
                    transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    className={`pointer-events-auto rounded-2xl border px-3.5 py-3 shadow-coffee-lg backdrop-blur-md flex items-start gap-3 ${style.container}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${style.iconWrap}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold leading-relaxed flex-1 whitespace-pre-line break-words pt-0.5">
                      {item.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => dismissToast(item.id)}
                      aria-label="Tutup notifikasi"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast harus dipakai di dalam ToastProvider");
  }
  return ctx;
};
