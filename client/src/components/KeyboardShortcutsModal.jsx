import React, { useEffect, useRef, useId } from "react";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { key: "Ctrl + K", description: "Quick search meetings & notes" },
  { key: "Ctrl + N", description: "Create new meeting note" },
  { key: "Esc", description: "Close active modal / dialog" },
  { key: "?", description: "Open keyboard shortcuts help" },
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const prevFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    prevFocusedRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = [
        ...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ];
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      prevFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <h2
            id={titleId}
            className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
          >
            <Keyboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => onClose()}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Close keyboard shortcuts dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50"
            >
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {s.description}
              </span>
              <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xs text-slate-900 dark:text-slate-100">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
