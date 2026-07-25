import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const PresentMode = ({ meeting, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Extract data
  const summary = meeting.summary || meeting.structuredMoM || {};
  const isStructured = typeof summary === "object";

  const slides = [];

  // Slide 1: Title & Meta
  slides.push({
    type: "title",
    title: meeting.title || "Untitled Meeting",
    date: meeting.date ? format(new Date(meeting.date), "MMMM d, yyyy") : "N/A",
    duration: meeting.duration ? `${meeting.duration} minutes` : "N/A",
    attendees: isStructured && summary.attendees ? summary.attendees : [],
  });

  // Slide 2: Summary
  const summaryText = isStructured ? summary.summary : summary;
  if (summaryText && typeof summaryText === "string") {
    slides.push({
      type: "summary",
      title: "Executive Summary",
      content: summaryText,
    });
  }

  // Slide 3: Decisions
  if (isStructured && summary.decisions && summary.decisions.length > 0) {
    slides.push({
      type: "decisions",
      title: "Key Decisions",
      items: summary.decisions,
    });
  }

  // Slide 4: Action Items
  if (isStructured && summary.action_items && summary.action_items.length > 0) {
    slides.push({
      type: "actions",
      title: "Action Items",
      items: summary.action_items,
    });
  }

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, onClose]);

  // Request fullscreen on mount
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

  const renderSlideContent = (slide) => {
    switch (slide.type) {
      case "title":
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 leading-tight pb-2">
              {slide.title}
            </h1>
            <div className="text-xl md:text-2xl text-gray-300 flex items-center space-x-4">
              <span>{slide.date}</span>
              <span>&bull;</span>
              <span>{slide.duration}</span>
            </div>
            {slide.attendees.length > 0 && (
              <div className="mt-8 max-w-3xl">
                <h3 className="text-lg text-gray-400 uppercase tracking-wider mb-4">
                  Attendees
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {slide.attendees.map((attendee, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-white/10 rounded-full text-white backdrop-blur-sm border border-white/20"
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
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-12 text-center">
              {slide.title}
            </h2>
            <div className="text-2xl leading-relaxed text-gray-200 bg-white/5 p-10 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl max-h-[60vh] overflow-y-auto">
              {slide.content}
            </div>
          </div>
        );
      case "decisions":
        return (
          <div className="flex flex-col h-full justify-center max-w-5xl mx-auto w-full">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-12 text-center">
              {slide.title}
            </h2>
            <div className="grid gap-6 max-h-[60vh] overflow-y-auto pr-4">
              {slide.items.map((decision, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-6 bg-gradient-to-r from-green-900/40 to-green-800/20 p-6 rounded-2xl border border-green-500/30 backdrop-blur-sm transform transition-all hover:scale-[1.02]"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xl font-bold border border-green-500/50">
                    {idx + 1}
                  </div>
                  <p className="text-2xl text-gray-200 mt-2">{decision}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "actions":
        return (
          <div className="flex flex-col h-full justify-center max-w-5xl mx-auto w-full">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-12 text-center">
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
                    className="flex flex-col gap-4 bg-gradient-to-r from-blue-900/40 to-blue-800/20 p-6 rounded-2xl border border-blue-500/30 backdrop-blur-sm transform transition-all hover:scale-[1.02]"
                  >
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xl font-bold border border-blue-500/50">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-2xl text-gray-200 mt-2">{task}</p>
                        <div className="flex gap-6 mt-4">
                          {owner && (
                            <span className="flex items-center gap-2 text-blue-300 text-lg">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              {owner}
                            </span>
                          )}
                          {dueDate && (
                            <span className="flex items-center gap-2 text-indigo-300 text-lg">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
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

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 text-white overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]" />
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all text-white/70 hover:text-white"
        title="Close (Esc)"
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

        {/* Controls and Progress */}
        <div className="h-24 px-12 flex items-center justify-between border-t border-white/10 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`p-3 rounded-full transition-all ${
                currentSlide === 0
                  ? "text-white/20 cursor-not-allowed"
                  : "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
              }`}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
              className={`p-3 rounded-full transition-all ${
                currentSlide === slides.length - 1
                  ? "text-white/20 cursor-not-allowed"
                  : "text-white hover:bg-white/10 hover:scale-110 active:scale-95"
              }`}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide
                    ? "w-8 bg-blue-500"
                    : "w-2 bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="text-white/50 font-medium">
            Slide {currentSlide + 1} of {slides.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentMode;
