import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { X, ChevronLeft, ChevronRight, Clock, ListOrdered } from "lucide-react";
import { format } from "date-fns";
import useTheme from "../../context/useTheme.jsx";

const formatCountdown = (totalSeconds) => {
  const safe = Math.max(0, totalSeconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const PresentMode = ({ meeting, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // ── Dialog accessibility (WAI-ARIA dialog pattern) ─────────────────────────
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");
    return Array.from(dialogRef.current.querySelectorAll(focusableSelectors));
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Trap focus inside the dialog with Tab / Shift+Tab cycling
      if (e.key === "Tab") {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
          return;
        }
        if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }

      if (hasAgenda) {
        if (e.key === "ArrowRight") nextSection();
        if (e.key === "ArrowLeft") prevSection();
      } else {
        if (e.key === "ArrowRight") nextSlide();
        if (e.key === "ArrowLeft") prevSlide();
      }
    },
    [
      hasAgenda,
      nextSection,
      prevSection,
      nextSlide,
      prevSlide,
      onClose,
      getFocusableElements,
    ],
  );

  useEffect(() => {
    // Save the triggering element so focus can be restored on close
    previousFocusRef.current = document.activeElement;

    // Move focus into the dialog
    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the triggering element
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [handleKeyDown]);

  const agendaItems = useMemo(
    () =>
      Array.isArray(meeting?.agendaItems)
        ? meeting.agendaItems.filter((item) => item?.text?.trim())
        : [],
    [meeting?.agendaItems],
  );
  const hasAgenda = agendaItems.length > 0;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [sectionEnded, setSectionEnded] = useState(false);

  const slides = useMemo(() => {
    const summarySource = meeting.summary || meeting.structuredMoM;
    const isStructured =
      summarySource !== null &&
      summarySource !== undefined &&
      typeof summarySource === "object";
    const summary = isStructured ? summarySource : {};
    const next = [];

    next.push({
      type: "title",
      title: meeting.title || "Untitled Meeting",
      date: meeting.date
        ? format(new Date(meeting.date), "MMMM d, yyyy")
        : "N/A",
      duration: meeting.duration ? `${meeting.duration} minutes` : "N/A",
      attendees: isStructured && summary.attendees ? summary.attendees : [],
    });

    const summaryText = isStructured ? summary.summary : summarySource;
    if (summaryText && typeof summaryText === "string") {
      next.push({
        type: "summary",
        title: "Executive Summary",
        content: summaryText,
      });
    }

    if (isStructured && summary.decisions?.length > 0) {
      next.push({
        type: "decisions",
        title: "Key Decisions",
        items: summary.decisions,
      });
    }

    if (isStructured && summary.action_items?.length > 0) {
      next.push({
        type: "actions",
        title: "Action Items",
        items: summary.action_items,
      });
    }

    return next;
  }, [
    meeting.title,
    meeting.date,
    meeting.duration,
    meeting.summary,
    meeting.structuredMoM,
  ]);

  const activeAgenda = hasAgenda ? agendaItems[currentSection] : null;
  const agendaDuration =
    typeof activeAgenda?.duration === "number" && activeAgenda.duration > 0
      ? activeAgenda.duration
      : null;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const nextSection = useCallback(() => {
    setCurrentSection((prev) => Math.min(prev + 1, agendaItems.length - 1));
  }, [agendaItems.length]);

  const prevSection = useCallback(() => {
    setCurrentSection((prev) => Math.max(prev - 1, 0));
  }, []);

  // Reset countdown whenever the agenda section changes
  useEffect(() => {
    if (!hasAgenda) return;
    setSectionEnded(false);
    if (agendaDuration) {
      setSecondsLeft(Math.round(agendaDuration * 60));
    } else {
      setSecondsLeft(null);
    }
  }, [hasAgenda, currentSection, agendaDuration]);

  useEffect(() => {
    if (!hasAgenda || secondsLeft === null || sectionEnded) return;
    if (secondsLeft <= 0) {
      setSectionEnded(true);
      return;
    }
    const timer = setTimeout(() => {
      setSecondsLeft((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [hasAgenda, secondsLeft, sectionEnded]);

  useEffect(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    }

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const shellClass = isDark
    ? "bg-gray-950 text-white"
    : "bg-slate-50 text-slate-900";
  const panelClass = isDark
    ? "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
    : "bg-slate-900/5 hover:bg-slate-900/10 text-slate-600 hover:text-slate-900";
  const footerClass = isDark
    ? "border-white/10 bg-black/20"
    : "border-slate-200 bg-white/80";
  const mutedText = isDark ? "text-white/50" : "text-slate-500";
  const cardClass = isDark
    ? "bg-white/5 border-white/10 text-gray-200"
    : "bg-white border-slate-200 text-slate-700 shadow-sm";

  const renderSlideContent = (slide) => {
    switch (slide.type) {
      case "title":
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <h1
              id="present-mode-title"
              className={`text-5xl md:text-7xl font-bold leading-tight pb-2 bg-clip-text text-transparent bg-gradient-to-r ${
                isDark
                  ? "from-blue-400 to-indigo-500"
                  : "from-blue-600 to-indigo-700"
              }`}
            >
              {slide.title}
            </h1>
            <div
              className={`text-xl md:text-2xl flex items-center space-x-4 ${
                isDark ? "text-gray-300" : "text-slate-600"
              }`}
            >
              <span>{slide.date}</span>
              <span>&bull;</span>
              <span>{slide.duration}</span>
            </div>
            {slide.attendees.length > 0 && (
              <div className="mt-8 max-w-3xl">
                <h3
                  className={`text-lg uppercase tracking-wider mb-4 ${
                    isDark ? "text-gray-400" : "text-slate-500"
                  }`}
                >
                  Attendees
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {slide.attendees.map((attendee, idx) => (
                    <span
                      key={idx}
                      className={`px-4 py-2 rounded-full backdrop-blur-sm border ${
                        isDark
                          ? "bg-white/10 text-white border-white/20"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      {attendee}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "summary":
        return (
          <div className="flex flex-col h-full justify-center max-w-5xl mx-auto w-full">
            <h2
              className={`text-4xl md:text-5xl font-bold mb-12 text-center ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {slide.title}
            </h2>
            <div
              className={`text-2xl leading-relaxed p-10 rounded-3xl backdrop-blur-md border shadow-2xl max-h-[60vh] overflow-y-auto ${cardClass}`}
            >
              {slide.content}
            </div>
          </div>
        );
      case "decisions":
        return (
          <div className="flex flex-col h-full justify-center max-w-5xl mx-auto w-full">
            <h2
              className={`text-4xl md:text-5xl font-bold mb-12 text-center ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {slide.title}
            </h2>
            <div className="grid gap-6 max-h-[60vh] overflow-y-auto pr-4">
              {slide.items.map((decision, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-6 p-6 rounded-2xl border backdrop-blur-sm ${
                    isDark
                      ? "bg-gradient-to-r from-green-900/40 to-green-800/20 border-green-500/30"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border ${
                      isDark
                        ? "bg-green-500/20 text-green-400 border-green-500/50"
                        : "bg-emerald-100 text-emerald-700 border-emerald-300"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <p
                    className={`text-2xl mt-2 ${
                      isDark ? "text-gray-200" : "text-slate-800"
                    }`}
                  >
                    {decision}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      case "actions":
        return (
          <div className="flex flex-col h-full justify-center max-w-5xl mx-auto w-full">
            <h2
              className={`text-4xl md:text-5xl font-bold mb-12 text-center ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {slide.title}
            </h2>
            <div className="grid gap-6 max-h-[60vh] overflow-y-auto pr-4">
              {slide.items.map((item, idx) => {
                const task = typeof item === "string" ? item : item.task;
                const owner = typeof item === "string" ? null : item.owner;
                const dueDate = typeof item === "string" ? null : item.due_date;
                return (
                  <div
                    key={idx}
                    className={`flex flex-col gap-4 p-6 rounded-2xl border backdrop-blur-sm ${
                      isDark
                        ? "bg-gradient-to-r from-blue-900/40 to-blue-800/20 border-blue-500/30"
                        : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex items-start gap-6">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border ${
                          isDark
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                            : "bg-blue-100 text-blue-700 border-blue-300"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-2xl mt-2 ${
                            isDark ? "text-gray-200" : "text-slate-800"
                          }`}
                        >
                          {task}
                        </p>
                        <div className="flex gap-6 mt-4">
                          {owner && (
                            <span
                              className={`text-lg ${
                                isDark ? "text-blue-300" : "text-blue-700"
                              }`}
                            >
                              {owner}
                            </span>
                          )}
                          {dueDate && (
                            <span
                              className={`text-lg ${
                                isDark ? "text-indigo-300" : "text-indigo-700"
                              }`}
                            >
                              {dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (hasAgenda) {
    const timerUrgent =
      secondsLeft !== null && secondsLeft <= 60 && !sectionEnded;

    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="present-mode-title"
        aria-describedby="present-mode-description"
        className={`fixed inset-0 z-50 overflow-hidden font-sans ${shellClass}`}
      >
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div
            className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] ${
              isDark ? "bg-blue-900/20" : "bg-blue-200/40"
            }`}
          />
          <div
            className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] ${
              isDark ? "bg-indigo-900/20" : "bg-indigo-200/40"
            }`}
          />
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className={`absolute top-6 right-6 z-20 p-3 rounded-full backdrop-blur-md transition-all ${panelClass}`}
          title="Close (Esc)"
          aria-label="Close present mode"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative z-10 w-full h-full flex flex-col">
          <div className="px-8 md:px-16 pt-8 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p
                className={`text-xs uppercase tracking-[0.2em] font-semibold mb-2 ${mutedText}`}
              >
                Agenda · Section {currentSection + 1} of {agendaItems.length}
              </p>
              <h1
                id="present-mode-title"
                className={`text-3xl md:text-5xl font-bold truncate ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {meeting.title || "Untitled Meeting"}
              </h1>
            </div>

            <div
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl border backdrop-blur-md ${
                sectionEnded
                  ? isDark
                    ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                  : timerUrgent
                    ? isDark
                      ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                      : "border-rose-300 bg-rose-50 text-rose-700"
                    : isDark
                      ? "border-white/10 bg-white/5 text-white/80"
                      : "border-slate-200 bg-white text-slate-700"
              }`}
              aria-live="polite"
            >
              <Clock className="w-4 h-4 opacity-80" />
              <span className="font-mono text-lg tabular-nums">
                {secondsLeft === null
                  ? "Untimed"
                  : formatCountdown(secondsLeft)}
              </span>
            </div>
          </div>

          {sectionEnded && (
            <div
              className={`mx-8 md:mx-16 mt-4 px-4 py-3 rounded-xl text-sm font-medium border ${
                isDark
                  ? "bg-amber-500/10 border-amber-400/30 text-amber-100"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
              role="status"
            >
              Section time is up — advance when you are ready.
            </div>
          )}

          <div className="flex-1 flex items-center justify-center px-8 md:px-16 py-10">
            <div
              className={`w-full max-w-4xl rounded-3xl border p-8 md:p-12 backdrop-blur-md ${cardClass}`}
            >
              <div
                className={`inline-flex items-center gap-2 text-sm font-semibold mb-6 ${
                  isDark ? "text-blue-300" : "text-blue-700"
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                Current section
              </div>
              <h2
                id="present-mode-description"
                className={`text-4xl md:text-5xl font-bold leading-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {activeAgenda?.text}
              </h2>
              {activeAgenda?.description ? (
                <p
                  className={`mt-6 text-xl leading-relaxed ${
                    isDark ? "text-gray-300" : "text-slate-600"
                  }`}
                >
                  {activeAgenda.description}
                </p>
              ) : null}
              {agendaDuration ? (
                <p className={`mt-8 text-sm ${mutedText}`}>
                  Planned for {agendaDuration} minute
                  {agendaDuration === 1 ? "" : "s"}
                </p>
              ) : (
                <p className={`mt-8 text-sm ${mutedText}`}>
                  No duration set for this section
                </p>
              )}
            </div>
          </div>

          <div
            className={`h-24 px-8 md:px-12 flex items-center justify-between border-t backdrop-blur-md ${footerClass}`}
          >
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={prevSection}
                disabled={currentSection === 0}
                aria-label="Previous agenda section"
                className={`p-3 rounded-full transition-all ${
                  currentSection === 0
                    ? isDark
                      ? "text-white/20 cursor-not-allowed"
                      : "text-slate-300 cursor-not-allowed"
                    : isDark
                      ? "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
                      : "text-slate-800 hover:bg-slate-900/5 hover:scale-110 active:scale-95"
                }`}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                type="button"
                onClick={nextSection}
                disabled={currentSection === agendaItems.length - 1}
                aria-label="Next agenda section"
                className={`p-3 rounded-full transition-all ${
                  currentSection === agendaItems.length - 1
                    ? isDark
                      ? "text-white/20 cursor-not-allowed"
                      : "text-slate-300 cursor-not-allowed"
                    : isDark
                      ? "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
                      : "text-slate-800 hover:bg-slate-900/5 hover:scale-110 active:scale-95"
                }`}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {agendaItems.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSection(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSection
                      ? "w-8 bg-blue-500"
                      : isDark
                        ? "w-2 bg-white/30 hover:bg-white/50"
                        : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to agenda section ${idx + 1}`}
                />
              ))}
            </div>

            <div className={`font-medium ${mutedText}`}>
              Section {currentSection + 1} of {agendaItems.length}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="present-mode-title"
      className={`fixed inset-0 z-50 overflow-hidden font-sans ${shellClass}`}
    >
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] ${
            isDark ? "bg-blue-900/20" : "bg-blue-200/40"
          }`}
        />
        <div
          className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] ${
            isDark ? "bg-indigo-900/20" : "bg-indigo-200/40"
          }`}
        />
      </div>

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className={`absolute top-6 right-6 z-20 p-3 rounded-full backdrop-blur-md transition-all ${panelClass}`}
        title="Close (Esc)"
        aria-label="Close present mode"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative z-10 w-full h-full flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 p-12 md:p-24 transition-all duration-700 ease-in-out transform flex items-center justify-center ${
                index === currentSlide
                  ? "opacity-100 translate-x-0 scale-100"
                  : index < currentSlide
                    ? "opacity-0 -translate-x-full scale-95"
                    : "opacity-0 translate-x-full scale-95"
              }`}
            >
              {renderSlideContent(slide)}
            </div>
          ))}
        </div>

        <div
          className={`h-24 px-12 flex items-center justify-between border-t backdrop-blur-md ${footerClass}`}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              aria-label="Previous slide"
              className={`p-3 rounded-full transition-all ${
                currentSlide === 0
                  ? isDark
                    ? "text-white/20 cursor-not-allowed"
                    : "text-slate-300 cursor-not-allowed"
                  : isDark
                    ? "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
                    : "text-slate-800 hover:bg-slate-900/5 hover:scale-110 active:scale-95"
              }`}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
              aria-label="Next slide"
              className={`p-3 rounded-full transition-all ${
                currentSlide === slides.length - 1
                  ? isDark
                    ? "text-white/20 cursor-not-allowed"
                    : "text-slate-300 cursor-not-allowed"
                  : isDark
                    ? "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
                    : "text-slate-800 hover:bg-slate-900/5 hover:scale-110 active:scale-95"
              }`}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide
                    ? "w-8 bg-blue-500"
                    : isDark
                      ? "w-2 bg-white/30 hover:bg-white/50"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className={`font-medium ${mutedText}`}>
            Slide {currentSlide + 1} of {slides.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentMode;
