import React, { useEffect, useRef } from 'react';

export const AccessibleDialog = ({ isOpen, onClose, title, children }) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Store the element that triggered the modal (to restore focus later)
    previousFocusRef.current = document.activeElement;

    const dialogNode = dialogRef.current;
    if (!dialogNode) return;

    // Find all focusable elements inside the modal
    const focusableElements = dialogNode.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 2. Move initial focus into the dialog
    if (firstElement) {
      firstElement.focus();
    } else {
      dialogNode.focus(); // Fallback to dialog container if no focusable children
    }

    // 3. Handle Keyboard Events (Focus Trapping & Escape to close)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          // Shift + Tab: if on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // 4. Cleanup: Remove listener and restore focus to the trigger element
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog-content"
        tabIndex="-1" // Makes the div focusable programmatically if needed
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing it
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            className="close-button"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="dialog-body">
          {children}
        </div>
      </div>
    </div>
  );
};
