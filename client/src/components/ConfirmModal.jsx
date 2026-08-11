import React, { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";

/**
 * ConfirmModal - Accessible confirmation dialog with full keyboard focus trapping
 *
 * Features:
 * - Complete focus trap (Tab and Shift+Tab cycling)
 * - Focus restoration to triggering element on close
 * - Escape key to close
 * - Backdrop click to close
 * - ARIA attributes for screen readers
 * - Dark mode support
 * - Loading state support
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {Function} onClose - Callback when modal closes
 * @param {Function} onConfirm - Callback when confirm button clicked
 * @param {string} title - Modal title
 * @param {string} message - Modal description
 * @param {string} confirmText - Confirm button text
 * @param {string} cancelText - Cancel button text
 * @param {boolean} isLoading - Loading state
 * @param {string} loadingText - Text to display when loading
 * @param {string} variant - "danger" or "warning"
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  isLoading = false,
  loadingText = "Processing...",
  variant = "danger",
}) => {
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  /**
   * Get all focusable elements within the modal
   * @returns {Array<HTMLElement>} Array of focusable elements
   */
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];

    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    return Array.from(modalRef.current.querySelectorAll(focusableSelectors));
  }, []);

  /**
   * Handle keyboard navigation within modal
   * Implements focus trap with Tab and Shift+Tab cycling
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      // Handle Escape key
      if (e.key === "Escape" && !isLoading) {
        e.preventDefault();
        onClose();
        return;
      }

      // Handle Tab key for focus trapping
      if (e.key === "Tab") {
        const focusableElements = getFocusableElements();

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab on first element -> wrap to last
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab on last element -> wrap to first
        if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
          return;
        }
      }
    },
    [isOpen, isLoading, onClose, getFocusableElements],
  );

  /**
   * Save previous focus and focus modal on open
   * Restore previous focus on close
   */
  useEffect(() => {
    if (isOpen) {
      // Save the element that had focus before modal opened
      previousFocusRef.current = document.activeElement;

      // Focus the confirm button after a brief delay to ensure DOM is ready
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 0);

      // Add global keydown listener
      document.addEventListener("keydown", handleKeyDown);

      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    } else {
      // Restore focus to previous element when modal closes
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        setTimeout(() => {
          previousFocusRef.current?.focus();
        }, 0);
      }

      // Remove global keydown listener
      document.removeEventListener("keydown", handleKeyDown);

      // Restore body scroll
      document.body.style.overflow = "";
    }

    // Cleanup on unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all p-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close modal"
          tabIndex={0}
        >
          <X size={18} />
        </button>

        {/* Modal Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${
              variant === "danger"
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
            }`}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3
              id="confirm-modal-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              {title}
            </h3>
          </div>
        </div>

        {/* Modal Body */}
        <p
          id="confirm-modal-description"
          className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed"
        >
          {message}
        </p>

        {/* Modal Footer Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-650 rounded-xl transition-colors disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            tabIndex={0}
          >
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
            tabIndex={0}
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            <span>{isLoading ? loadingText : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
