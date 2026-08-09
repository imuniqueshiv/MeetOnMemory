import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

const ThemeContext = createContext(undefined);

const getStoredThemeMode = () => {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem("theme") || "system";
};

const getSystemPreference = () => {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState(() => getStoredThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const mode = getStoredThemeMode();
    return mode === "system" ? getSystemPreference() : mode;
  });
  const [mounted, setMounted] = useState(false);

  // Synchronize document dark class and system listener
  useEffect(() => {
    setMounted(true);
    const applyTheme = (mode) => {
      const actualTheme = mode === "system" ? getSystemPreference() : mode;
      setResolvedTheme(actualTheme);
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle(
          "dark",
          actualTheme === "dark",
        );
      }
    };

    applyTheme(themeMode);

    if (
      themeMode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia
    ) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e) => {
        const newSystemTheme = e.matches ? "dark" : "light";
        setResolvedTheme(newSystemTheme);
        document.documentElement.classList.toggle(
          "dark",
          newSystemTheme === "dark",
        );
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
    }
  }, [themeMode]);

  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    if (mode === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", mode);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextMode = resolvedTheme === "light" ? "dark" : "light";
    setThemeMode(nextMode);
  }, [resolvedTheme, setThemeMode]);

  const value = useMemo(
    () => ({
      theme: themeMode,
      resolvedTheme,
      setThemeMode,
      toggleTheme,
      mounted,
    }),
    [themeMode, resolvedTheme, setThemeMode, toggleTheme, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export { ThemeContext };
