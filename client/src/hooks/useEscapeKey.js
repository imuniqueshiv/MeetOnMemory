// client/src/hooks/useEscapeKey.js

import { useEffect } from "react";

/**
 * Custom hook to handle Escape key press events.
 * Improves accessibility by allowing users to close modals or dismiss
 * overlays using the keyboard.
 *
 * @param {boolean} isActive - Whether the hook should listen for the Escape key.
 * @param {Function} onEscape - The callback function to execute when Escape is pressed.
 */
export const useEscapeKey = (isActive, onEscape) => {
  useEffect(() => {
    if (!isActive || typeof onEscape !== "function") {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    };

    // Attach listener to the window object
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup listener on unmount or when dependencies change
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onEscape]);
};

export default useEscapeKey;
