import React, { useState, useEffect } from "react";

const CustomCursor = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  // Respect the user's OS-level motion preference — WCAG 2.1 SC 2.3.3
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Listen for dynamic changes (user toggles accessibility setting while page is open)
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    setIsMobile(!mediaQuery.matches);
    if (!mediaQuery.matches) return;

    // Keep track of real mouse coordinates and rendering coordinates
    const mouse = { x: 0, y: 0 };
    const dot = { x: 0, y: 0 };
    const ring = { x: 0, y: 0 };

    // DOM references obtained directly for maximum frames-per-second performance
    let dotEl = null;
    let ringEl = null;
    let animationFrameId = null;

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!dotEl) dotEl = document.querySelector(".custom-cursor");
      if (!ringEl) ringEl = document.querySelector(".custom-cursor-ring");
      if (dotEl && ringEl) {
        dotEl.style.opacity = "1";
        ringEl.style.opacity = "1";
      }
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest("a") ||
        target.getAttribute("role") === "button"
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    const handleMouseLeave = () => {
      if (dotEl && ringEl) {
        dotEl.style.opacity = "0";
        ringEl.style.opacity = "0";
      }
    };

    const handleMouseEnter = () => {
      if (dotEl && ringEl) {
        dotEl.style.opacity = "1";
        ringEl.style.opacity = "1";
      }
    };

    // The Tick function handles the fluid physics loop
    const tick = () => {
      if (!dotEl) dotEl = document.querySelector(".custom-cursor");
      if (!ringEl) ringEl = document.querySelector(".custom-cursor-ring");

      if (dotEl && ringEl) {
        // Inner dot follows instantly (1:1 ratio)
        dot.x = mouse.x;
        dot.y = mouse.y;
        dotEl.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%)`;

        // Outer circle glides smoothly lagging behind (using 15% interpolation speed)
        ring.x += (mouse.x - ring.x) * 0.15;
        ring.y += (mouse.y - ring.y) * 0.15;
        ringEl.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Do not render the custom cursor if the user prefers reduced motion.
  // This prevents motion-triggered discomfort for users with vestibular disorders
  // and ensures the native OS cursor (including high-contrast accessibility cursors) is shown.
  if (prefersReducedMotion) return null;

  if (isMobile) return null;

  return (
    <>
      <div className={`custom-cursor ${isHovered ? "hovered" : ""}`} />
      <div className={`custom-cursor-ring ${isHovered ? "hovered" : ""}`} />
    </>
  );
};

export default CustomCursor;
