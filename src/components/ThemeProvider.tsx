"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldDark = mode === "dark" || (mode === "system" && prefersDark);
  if (shouldDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as ThemeMode) || "system";
    setThemeState(saved);
    applyTheme(saved);

    if (saved === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      mq.addEventListener?.("change", listener);
      return () => mq.removeEventListener?.("change", listener);
    }
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("theme", mode);
    applyTheme(mode);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}



