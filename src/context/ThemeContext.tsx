import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "julias_theme";

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Ignore storage read errors in restricted WebViews
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage write errors
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", mode === "dark" ? "#070b1e" : "#ffffff");
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  }
  return ctx;
};

interface ThemeToggleButtonProps {
  compact?: boolean;
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  compact = false,
  className = "",
}) => {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap";

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
        compact ? "p-2 text-xs font-semibold" : "px-3 py-2 text-xs font-bold"
      } ${
        isDark
          ? "bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-amber-300 shadow-2xs"
          : "bg-slate-50 hover:bg-brand-50 border-slate-200 text-slate-700 hover:text-brand-700 hover:border-brand-200 shadow-2xs"
      } ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ rotate: -45, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 45, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="inline-flex items-center justify-center"
          >
            <Sun className="w-4 h-4 text-amber-300" />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ rotate: 45, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -45, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="inline-flex items-center justify-center"
          >
            <Moon className="w-4 h-4 text-brand-600" />
          </motion.span>
        )}
      </AnimatePresence>
      {!compact && <span>{isDark ? "Mode Terang" : "Mode Gelap"}</span>}
    </motion.button>
  );
};
