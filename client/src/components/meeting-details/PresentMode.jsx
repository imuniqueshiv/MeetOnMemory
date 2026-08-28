import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListOrdered,
  Presentation,
  BarChart2,
  CheckSquare,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import useTheme from "../../context/useTheme.jsx";

const formatCountdown = (totalSeconds) => {
  const safe = Math.max(0, totalSeconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const PresentMode = ({ meeting = {}, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // ── Dialog accessibility (WAI-ARIA dialog pattern) ─────────────────────────
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  const agendaItems = useMemo(
    () =>
      Array.isArray(meeting?.agendaItems)
        ? meeting.agendaItems.filter((item) => item?.text?.trim())
        : [],
    [meeting?.agendaItems],
  );
  const hasAgenda = agendaItems.length > 0;

  const [activeTab, setActiveTab] = useState(hasAgenda ? "agenda" : "slides");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);

  // Facilitator Timer State
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [sectionEnded, setSectionEnded] = useState(false);

  // Facilitator Live Actions State
  const initialActions = useMemo(() => {
    const fromSummary =
      meeting?.summary?.action_items ||
      meeting?.structuredMoM?.action_items ||
      [];
    const fromMeeting = meeting?.actionItems || [];
    const combined = [...fromMeeting, ...fromSummary];
    return combined.map((act, i) =>
      typeof act === "string"
        ? { id: `act-${i}`, task: act, completed: false }
        : {
            id: act._id || act.id || `act-${i}`,
            task: act.task || act.description || act.text || "Untitled Action",
            owner: act.owner || act.assignee?.name || act.assignee || null,
            dueDate: act.due_date || act.dueDate || null,
            completed: Boolean(act.completed || act.status === "completed"),
          },
    );
  }, [meeting?.actionItems, meeting?.summary, meeting?.structuredMoM]);

  const [actionItems, setActionItems] = useState(initialActions);
  const [newActionText, setNewActionText] = useState("");
  const [newActionOwner, setNewActionOwner] = useState("");

  // Facilitator Live Polls State
  const initialPolls = useMemo(() => {
    return Array.isArray(meeting?.polls) && meeting.polls.length > 0
      ? meeting.polls.map((p, i) => ({
          id: p._id || p.id || `poll-${i}`,
          question: p.question || "Poll Question",
          options: (p.options || []).map((opt, optIdx) => ({
            id: opt._id || opt.id || `opt-${optIdx}`,
            text:
              typeof opt === "string"
                ? opt
                : opt.text || `Option ${optIdx + 1}`,
            votes:
              typeof opt === "object"
                ? opt.votes?.length || opt.voteCount || 0
                : 0,
          })),
        }))
      : [
          {
            id: "default-poll-1",
            question: "Do we have consensus on the current decision?",
            options: [
              { id: "opt-1", text: "Yes, agree", votes: 4 },
              { id: "opt-2", text: "Need more discussion", votes: 1 },
              { id: "opt-3", text: "Disagree", votes: 0 },
            ],
          },
        ];
  }, [meeting?.polls]);

  const [polls, setPolls] = useState(initialPolls);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOption1, setNewPollOption1] = useState("");
  const [newPollOption2, setNewPollOption2] = useState("");

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

  const addTimeSeconds = useCallback((sec) => {
    setSecondsLeft((prev) => (prev === null ? sec : prev + sec));
    setSectionEnded(false);
  }, []);

  const resetTimer = useCallback(() => {
    if (agendaDuration) {
      setSecondsLeft(Math.round(agendaDuration * 60));
    } else {
      setSecondsLeft(null);
    }
    setSectionEnded(false);
    setIsTimerRunning(true);
  }, [agendaDuration]);

  const toggleTimer = useCallback(() => {
    setIsTimerRunning((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

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

      // Allow space to toggle timer only when not typing in input
      if (
        e.key === " " &&
        e.target.tagName !== "INPUT" &&
        e.target.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        toggleTimer();
        return;
      }

      if (activeTab === "agenda" && hasAgenda) {
        if (e.key === "ArrowRight") nextSection();
        if (e.key === "ArrowLeft") prevSection();
      } else if (activeTab === "slides") {
        if (e.key === "ArrowRight") nextSlide();
        if (e.key === "ArrowLeft") prevSlide();
      }
    },
    [
      activeTab,
      hasAgenda,
      nextSection,
      prevSection,
      nextSlide,
      prevSlide,
      toggleTimer,
      onClose,
      getFocusableElements,
    ],
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [handleKeyDown]);

  // Reset countdown whenever agenda section changes
  useEffect(() => {
    if (!hasAgenda) return;
    setSectionEnded(false);
    if (agendaDuration) {
      setSecondsLeft(Math.round(agendaDuration * 60));
    } else {
      setSecondsLeft(null);
    }
    setIsTimerRunning(true);
  }, [hasAgenda, currentSection, agendaDuration]);

  // Countdown timer tick
  useEffect(() => {
    if (!hasAgenda || secondsLeft === null || sectionEnded || !isTimerRunning)
      return;
    if (secondsLeft <= 0) {
      setSectionEnded(true);
      return;
    }
    const timer = setTimeout(() => {
      setSecondsLeft((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [hasAgenda, secondsLeft, sectionEnded, isTimerRunning]);

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

  const handleAddActionItem = (e) => {
    e.preventDefault();
    if (!newActionText.trim()) return;
    const item = {
      id: `act-${Date.now()}`,
      task: newActionText.trim(),
      owner: newActionOwner.trim() || null,
      completed: false,
    };
    setActionItems((prev) => [item, ...prev]);
    setNewActionText("");
    setNewActionOwner("");
  };

  const toggleActionItem = (id) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const handleVotePollOption = (pollId, optionId) => {
    setPolls((prev) =>
      prev.map((poll) => {
        if (poll.id !== pollId) return poll;
        return {
          ...poll,
          options: poll.options.map((opt) =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt,
          ),
        };
      }),
    );
  };

  const handleCreatePoll = (e) => {
    e.preventDefault();
    if (!newPollQuestion.trim()) return;
    const options = [];
    if (newPollOption1.trim()) {
      options.push({
        id: `opt-1-${Date.now()}`,
        text: newPollOption1.trim(),
        votes: 0,
      });
    }
    if (newPollOption2.trim()) {
      options.push({
        id: `opt-2-${Date.now()}`,
        text: newPollOption2.trim(),
        votes: 0,
      });
    }
    if (options.length === 0) {
      options.push({ id: `opt-1-${Date.now()}`, text: "Yes", votes: 0 });
      options.push({ id: `opt-2-${Date.now()}`, text: "No", votes: 0 });
    }

    const poll = {
      id: `poll-${Date.now()}`,
      question: newPollQuestion.trim(),
      options,
    };

    setPolls((prev) => [poll, ...prev]);
    setNewPollQuestion("");
    setNewPollOption1("");
    setNewPollOption2("");
  };

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

  const timerUrgent =
    secondsLeft !== null && secondsLeft <= 60 && !sectionEnded;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="present-mode-title"
      className={`fixed inset-0 z-50 overflow-hidden font-sans ${shellClass}`}
    >
      {/* Background Ambience */}
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

      {/* Close button */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className={`absolute top-6 right-6 z-30 p-3 rounded-full backdrop-blur-md transition-all ${panelClass}`}
        title="Close (Esc)"
        aria-label="Close present mode"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Facilitator Bar */}
        <div className="px-6 md:px-12 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200/10 backdrop-blur-md">
          {/* Left Title & Status */}
          <div className="min-w-0 flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Facilitator Mode
                </span>
                <span className={`text-xs ${mutedText}`}>
                  {meeting.date
                    ? format(new Date(meeting.date), "MMM d, yyyy")
                    : "Live"}
                </span>
              </div>
              <h1
                id="present-mode-title"
                className={`text-xl md:text-2xl font-bold truncate max-w-md ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {meeting.title || "Untitled Meeting"}
              </h1>
            </div>
          </div>

          {/* Facilitator Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10">
            {hasAgenda && (
              <button
                type="button"
                onClick={() => setActiveTab("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "agenda"
                    ? "bg-blue-600 text-white shadow-md"
                    : isDark
                      ? "text-gray-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                Agenda ({agendaItems.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("slides")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "slides"
                  ? "bg-blue-600 text-white shadow-md"
                  : isDark
                    ? "text-gray-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              Slides ({slides.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("polls")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "polls"
                  ? "bg-blue-600 text-white shadow-md"
                  : isDark
                    ? "text-gray-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Polls ({polls.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("actions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "actions"
                  ? "bg-blue-600 text-white shadow-md"
                  : isDark
                    ? "text-gray-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Actions ({actionItems.length})
            </button>
          </div>

          {/* Facilitator Timer Controls */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md ${
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
              <span className="font-mono text-base font-bold tabular-nums">
                {secondsLeft === null
                  ? "Untimed"
                  : formatCountdown(secondsLeft)}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTimer}
              title={isTimerRunning ? "Pause (Space)" : "Resume (Space)"}
              aria-label={isTimerRunning ? "Pause timer" : "Resume timer"}
              className={`p-2 rounded-xl border transition-all ${panelClass}`}
            >
              {isTimerRunning ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={resetTimer}
              title="Reset Timer"
              aria-label="Reset timer"
              className={`p-2 rounded-xl border transition-all ${panelClass}`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => addTimeSeconds(60)}
              className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all ${panelClass}`}
              title="Add 1 minute"
            >
              +1m
            </button>
            <button
              type="button"
              onClick={() => addTimeSeconds(300)}
              className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all ${panelClass}`}
              title="Add 5 minutes"
            >
              +5m
            </button>
          </div>
        </div>

        {/* Overtime Alert */}
        {sectionEnded && (
          <div
            className={`mx-8 md:mx-12 mt-3 px-4 py-2 rounded-xl text-xs font-medium border ${
              isDark
                ? "bg-amber-500/10 border-amber-400/30 text-amber-200"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
            role="status"
          >
            ⏱️ Section time is up — advance to next section or extend time with
            +1m / +5m controls.
          </div>
        )}

        {/* Center Surface */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-6 md:p-12">
          {/* TAB 1: AGENDA MODE */}
          {activeTab === "agenda" && hasAgenda && (
            <div className="w-full max-w-4xl rounded-3xl border p-8 md:p-12 backdrop-blur-md shadow-2xl animate-fade-in flex flex-col justify-between min-h-[400px]">
              <div>
                <div
                  className={`inline-flex items-center gap-2 text-sm font-semibold mb-4 ${
                    isDark ? "text-blue-300" : "text-blue-700"
                  }`}
                >
                  <ListOrdered className="w-4 h-4" />
                  Agenda Section {currentSection + 1} of {agendaItems.length}
                </div>
                <h2
                  id="present-mode-description"
                  className={`text-4xl md:text-5xl font-bold leading-tight ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {activeAgenda?.text}
                </h2>
                {activeAgenda?.description && (
                  <p
                    className={`mt-6 text-xl leading-relaxed ${
                      isDark ? "text-gray-300" : "text-slate-600"
                    }`}
                  >
                    {activeAgenda.description}
                  </p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200/10 flex items-center justify-between">
                <div className={`text-sm ${mutedText}`}>
                  {agendaDuration
                    ? `Allocated: ${agendaDuration} minutes`
                    : "Flexible duration"}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={prevSection}
                    disabled={currentSection === 0}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      currentSection === 0
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:scale-105 active:scale-95"
                    } ${panelClass}`}
                  >
                    Previous Section
                  </button>
                  <button
                    type="button"
                    onClick={nextSection}
                    disabled={currentSection === agendaItems.length - 1}
                    className={`px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all ${
                      currentSection === agendaItems.length - 1
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-105 active:scale-95"
                    }`}
                  >
                    Next Section &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SLIDES MODE */}
          {activeTab === "slides" && (
            <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 p-8 md:p-16 transition-all duration-500 ease-in-out transform flex items-center justify-center ${
                    index === currentSlide
                      ? "opacity-100 translate-x-0 scale-100"
                      : index < currentSlide
                        ? "opacity-0 -translate-x-full scale-95 pointer-events-none"
                        : "opacity-0 translate-x-full scale-95 pointer-events-none"
                  }`}
                >
                  {renderSlideContent(slide)}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: LIVE POLLS MODE */}
          {activeTab === "polls" && (
            <div className="w-full max-w-4xl h-full flex flex-col max-h-[70vh] overflow-y-auto pr-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2
                    className={`text-2xl font-bold ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Live Facilitator Polls
                  </h2>
                  <p className={`text-sm ${mutedText}`}>
                    Conduct real-time votes and view live tallies with
                    attendees.
                  </p>
                </div>
              </div>

              {/* Create Quick Poll */}
              <form
                onSubmit={handleCreatePoll}
                className={`p-4 rounded-2xl border mb-6 backdrop-blur-md ${cardClass}`}
              >
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-blue-400">
                  <Plus className="w-4 h-4" /> Launch Quick Poll
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Poll Question..."
                    value={newPollQuestion}
                    onChange={(e) => setNewPollQuestion(e.target.value)}
                    className="md:col-span-3 px-3 py-2 text-sm rounded-xl bg-black/20 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Option 1 (e.g. Agree)"
                    value={newPollOption1}
                    onChange={(e) => setNewPollOption1(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-black/20 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Option 2 (e.g. Disagree)"
                    value={newPollOption2}
                    onChange={(e) => setNewPollOption2(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-black/20 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
                  >
                    Launch Poll
                  </button>
                </div>
              </form>

              {/* Polls List */}
              <div className="space-y-4">
                {polls.map((poll) => {
                  const totalVotes = poll.options.reduce(
                    (acc, curr) => acc + curr.votes,
                    0,
                  );
                  return (
                    <div
                      key={poll.id}
                      className={`p-6 rounded-2xl border backdrop-blur-md ${cardClass}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold">{poll.question}</h4>
                        <span className={`text-xs ${mutedText}`}>
                          {totalVotes} total votes
                        </span>
                      </div>
                      <div className="space-y-3">
                        {poll.options.map((opt) => {
                          const pct =
                            totalVotes > 0
                              ? Math.round((opt.votes / totalVotes) * 100)
                              : 0;
                          return (
                            <div key={opt.id} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>{opt.text}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-xs text-blue-400">
                                    {opt.votes} votes ({pct}%)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleVotePollOption(poll.id, opt.id)
                                    }
                                    className="px-2.5 py-1 text-xs rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all"
                                  >
                                    +1 Vote
                                  </button>
                                </div>
                              </div>
                              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: LIVE ACTIONS CAPTURE */}
          {activeTab === "actions" && (
            <div className="w-full max-w-4xl h-full flex flex-col max-h-[70vh] overflow-y-auto pr-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2
                    className={`text-2xl font-bold ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Facilitator Action Items
                  </h2>
                  <p className={`text-sm ${mutedText}`}>
                    Capture action items live and track assignees in real time.
                  </p>
                </div>
              </div>

              {/* Add Action Input */}
              <form
                onSubmit={handleAddActionItem}
                className={`p-4 rounded-2xl border mb-6 backdrop-blur-md flex flex-wrap items-center gap-3 ${cardClass}`}
              >
                <input
                  type="text"
                  placeholder="Action Item description..."
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-xl bg-black/20 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Assignee (e.g. @Alex)"
                  value={newActionOwner}
                  onChange={(e) => setNewActionOwner(e.target.value)}
                  className="w-44 px-3 py-2 text-sm rounded-xl bg-black/20 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Action
                </button>
              </form>

              {/* Actions List */}
              <div className="space-y-3">
                {actionItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No action items captured yet.
                  </div>
                ) : (
                  actionItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleActionItem(item.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-sm cursor-pointer transition-all ${
                        item.completed
                          ? "opacity-60 bg-emerald-950/20 border-emerald-500/30"
                          : cardClass
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
                        <div
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                            item.completed
                              ? "bg-emerald-500 border-emerald-400 text-white"
                              : "border-white/30"
                          }`}
                        >
                          {item.completed && <Check className="w-4 h-4" />}
                        </div>
                        <p
                          className={`text-base font-medium truncate ${
                            item.completed
                              ? "line-through text-gray-400"
                              : isDark
                                ? "text-gray-100"
                                : "text-slate-800"
                          }`}
                        >
                          {item.task}
                        </p>
                      </div>

                      {item.owner && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {item.owner}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation Controls (for Slides Mode) */}
        {activeTab === "slides" && (
          <div
            className={`h-20 px-8 md:px-12 flex items-center justify-between border-t backdrop-blur-md ${footerClass}`}
          >
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={prevSlide}
                disabled={currentSlide === 0}
                aria-label="Previous slide"
                className={`p-2.5 rounded-full transition-all ${
                  currentSlide === 0
                    ? isDark
                      ? "text-white/20 cursor-not-allowed"
                      : "text-slate-300 cursor-not-allowed"
                    : isDark
                      ? "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
                      : "text-slate-800 hover:bg-slate-900/5 hover:scale-110 active:scale-95"
                }`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                disabled={currentSlide === slides.length - 1}
                aria-label="Next slide"
                className={`p-2.5 rounded-full transition-all ${
                  currentSlide === slides.length - 1
                    ? isDark
                      ? "text-white/20 cursor-not-allowed"
                      : "text-slate-300 cursor-not-allowed"
                    : isDark
                      ? "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
                      : "text-slate-800 hover:bg-slate-900/5 hover:scale-110 active:scale-95"
                }`}
              >
                <ChevronRight className="w-6 h-6" />
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

            <div className={`font-medium text-xs ${mutedText}`}>
              Slide {currentSlide + 1} of {slides.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PresentMode;
