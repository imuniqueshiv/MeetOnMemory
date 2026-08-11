import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import useTheme from "../context/useTheme.jsx";

/**
 * Reusable ThemeToggle component supporting Light, Dark, and System color scheme selection.
 * Persists selection in localStorage and updates root document dark class.
 */
const ThemeToggle = ({ showLabel = true, className = "" }) => {
  const { theme, setThemeMode, toggleTheme } = useTheme();

  return (
    <div
      className={`inline-flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {/* Light Theme Button */}
      <button
        type="button"
        onClick={() => (setThemeMode ? setThemeMode("light") : toggleTheme())}
        aria-label="Switch to light theme"
        title="Light theme"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          theme === "light"
            ? "bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-xs"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        }`}
      >
        <Sun size={15} />
        {showLabel && <span>Light</span>}
      </button>

      {/* Dark Theme Button */}
      <button
        type="button"
        onClick={() => (setThemeMode ? setThemeMode("dark") : toggleTheme())}
        aria-label="Switch to dark theme"
        title="Dark theme"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          theme === "dark"
            ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        }`}
      >
        <Moon size={15} />
        {showLabel && <span>Dark</span>}
      </button>

      {/* System Theme Button */}
      {setThemeMode && (
        <button
          type="button"
          onClick={() => setThemeMode("system")}
          aria-label="Switch to system color scheme"
          title="System preference"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            theme === "system"
              ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-xs"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Monitor size={15} />
          {showLabel && <span>System</span>}
        </button>
      )}
    </div>
  );
};

export default ThemeToggle;
