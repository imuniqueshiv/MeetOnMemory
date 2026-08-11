import React, { useEffect, useRef, useState, useContext } from "react";
import {
  Send,
  RefreshCw,
  MessageSquare,
  Minus,
  Maximize2,
  Minimize2,
  X,
  GripHorizontal,
  Pin,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from "lucide-react";
import useAssistant from "../context/useAssistant";
import AppContent from "../context/AppContent";
import ChatSessionSidebar from "./ChatSessionSidebar";
import SourceCitation from "./SourceCitation";

/**
 * FloatingAssistant - Fully responsive AI Assistant workspace
 * Features:
 * - Mobile-first responsive design
 * - Adaptive layouts for phone, tablet, and desktop
 * - Touch-friendly controls
 * - Prevents horizontal scrolling
 * - Stacks panels on smaller screens
 */
const FloatingAssistant = () => {
  const { isLoggedin } = useContext(AppContent);
  const {
    sessions,
    currentSessionId,
    messages,
    inputValue,
    setInputValue,
    isStreaming,
    error,
    isSocketConnected,
    isRateLimited,
    pinnedContext,
    ui,
    openAssistant,
    closeAssistant,
    minimizeAssistant,
    restoreAssistant,
    maximizeAssistant,
    setPosition,
    handleSelectSession,
    handleNewSession,
    handleDeleteSession,
    handleSendMessage,
    handleUnpinContext,
  } = useAssistant();

  const messagesEndRef = useRef(null);
  const dragRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ui.isOpen, ui.isMinimized]);

  // Detect screen size and adjust layout
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // Mobile: < 768px
      setIsTablet(width >= 768 && width < 1024); // Tablet: 768px - 1024px
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Auto-hide sidebar on mobile when chat is active
  useEffect(() => {
    if (isMobile && showSidebar && currentSessionId) {
      setShowSidebar(false);
    }
  }, [isMobile, currentSessionId, showSidebar]);

  // Handle window resize to keep panel within viewport
  useEffect(() => {
    const onResize = () => {
      if (!ui.isOpen || ui.isMaximized || ui.isMinimized) return;

      const maxX = Math.max(8, window.innerWidth - ui.size.width - 8);
      const maxY = Math.max(8, window.innerHeight - ui.size.height - 8);

      setPosition({
        x: Math.min(Math.max(8, ui.position.x), maxX),
        y: Math.min(Math.max(8, ui.position.y), maxY),
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [
    ui.isOpen,
    ui.isMaximized,
    ui.isMinimized,
    ui.position.x,
    ui.position.y,
    ui.size.width,
    ui.size.height,
    setPosition,
  ]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = document.getElementById("assistant-input");
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [inputValue]);

  if (!isLoggedin) return null;

  /**
   * Handle drag functionality for floating panel positioning
   */
  const startDrag = (event) => {
    if (ui.isMaximized || event.button !== 0 || isMobile) return; // Disable drag on mobile

    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = ui.position.x;
    const originY = ui.position.y;

    const onMove = (moveEvent) => {
      const width = ui.size.width;
      const height = ui.size.height;

      const nextX = originX + (moveEvent.clientX - startX);
      const nextY = originY + (moveEvent.clientY - startY);

      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);

      setPosition({
        x: Math.min(Math.max(8, nextX), maxX),
        y: Math.min(Math.max(8, nextY), maxY),
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /**
   * Handle form submission with Enter key (Shift+Enter for newline)
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      // Only on desktop/tablet
      e.preventDefault();
      if (inputValue.trim() && !isStreaming && isSocketConnected) {
        handleSendMessage(e);
      }
    }
  };

  // Collapsed FAB button when assistant is closed
  if (!ui.isOpen) {
    return (
      <button
        type="button"
        onClick={openAssistant}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[960] flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        aria-label="Open AI Assistant"
      >
        <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="hidden sm:inline text-sm sm:text-base font-semibold">
          Assistant
        </span>
      </button>
    );
  }

  // Minimized state with compact restore button
  if (ui.isMinimized) {
    return (
      <button
        type="button"
        onClick={restoreAssistant}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[960] flex items-center gap-3 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-left shadow-xl transition hover:shadow-2xl dark:bg-gray-900 dark:border-indigo-500/40"
        aria-label="Restore AI Assistant"
        style={{
          left: isMobile ? "auto" : ui.position.x,
          top: "auto",
          right: isMobile ? "1rem" : "auto",
          bottom: isMobile
            ? "1rem"
            : Math.min(ui.position.y, window.innerHeight - 72),
        }}
      >
        <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <span>
          <span className="block text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
            AI Assistant
          </span>
          <span className="block text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Click to restore
          </span>
        </span>
      </button>
    );
  }

  // Mobile/Tablet: Full-screen overlay
  if (isMobile || isTablet) {
    return (
      <div
        className="fixed inset-0 z-[960] flex flex-col overflow-hidden bg-white dark:bg-gray-900"
        role="dialog"
        aria-label="AI Assistant workspace"
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4 py-3 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center gap-2.5 text-gray-700 dark:text-gray-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
              <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-base font-semibold">AI Assistant</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-200/70 dark:hover:bg-gray-700"
              aria-label={
                showSidebar ? "Hide conversations" : "Show conversations"
              }
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={closeAssistant}
              className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Mobile Sidebar Overlay */}
          {showSidebar && (
            <div className="absolute inset-0 z-10 flex">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowSidebar(false)}
              />
              <div className="relative w-4/5 max-w-xs">
                <ChatSessionSidebar
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onSelectSession={(id) => {
                    handleSelectSession(id);
                    setShowSidebar(false);
                  }}
                  onNewSession={() => {
                    handleNewSession();
                    setShowSidebar(false);
                  }}
                  onDeleteSession={handleDeleteSession}
                />
              </div>
            </div>
          )}

          {/* Mobile Chat Area */}
          <div className="flex flex-1 flex-col bg-gray-50/40 dark:bg-gray-950/40">
            {/* Connection status */}
            {!isSocketConnected && (
              <div className="flex items-center justify-center gap-2 border-b border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/40 dark:text-yellow-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Connecting...
              </div>
            )}

            {/* Pinned context */}
            {pinnedContext && (
              <div className="flex items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-indigo-900 dark:text-indigo-200">
                  <Pin className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  <span className="truncate">
                    <span className="mr-1 uppercase text-[10px] font-bold tracking-wide text-indigo-500">
                      {pinnedContext.type}
                    </span>
                    {pinnedContext.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleUnpinContext}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
              {!currentSessionId && messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center text-center px-4">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600 dark:from-indigo-950 dark:to-indigo-900 dark:text-indigo-300">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                    How can I help?
                  </h2>
                  <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
                    Ask about meetings, decisions, and policies.
                  </p>
                  <div className="grid w-full gap-2">
                    {[
                      "What were the main decisions in the last engineering meeting?",
                      "Summarize the remote work policy updates.",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setInputValue(suggestion)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-xs sm:text-sm text-gray-700 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4 pb-2">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm shadow-sm ${
                          msg.role === "user"
                            ? "rounded-br-none bg-indigo-600 text-white"
                            : "rounded-bl-none border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                        {msg.role === "assistant" &&
                          msg.sources &&
                          msg.sources.length > 0 && (
                            <div className="mt-2 sm:mt-3 flex flex-wrap border-t border-gray-100 pt-2 sm:pt-2.5 dark:border-gray-800">
                              {msg.sources.map((src, i) => (
                                <SourceCitation
                                  key={i}
                                  source={src}
                                  index={i}
                                />
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}

                  {isStreaming &&
                    messages[messages.length - 1]?.role === "user" && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-none border border-gray-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
                          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" />
                          <span
                            className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                          <span className="ml-1 text-xs font-medium">
                            Thinking...
                          </span>
                        </div>
                      </div>
                    )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Mobile Input Area */}
            <div className="border-t border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900">
              {error && (
                <div className="mb-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {isRateLimited && (
                <div className="mb-2 rounded-lg border border-orange-100 bg-orange-50 p-2 text-xs text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
                  Too many messages. Please wait.
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  id="assistant-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about meetings..."
                  disabled={isStreaming || !isSocketConnected}
                  className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 pr-12 text-sm shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={
                    !inputValue.trim() || isStreaming || !isSocketConnected
                  }
                  className="absolute right-1.5 rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Floating panel with drag functionality
  const panelStyle = ui.isMaximized
    ? {
        left: 12,
        top: 12,
        width: "calc(100vw - 24px)",
        height: "calc(100vh - 24px)",
      }
    : {
        left: ui.position.x,
        top: ui.position.y,
        width: ui.size.width,
        height: ui.size.height,
      };

  return (
    <div
      className="fixed z-[960] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      style={panelStyle}
      role="dialog"
      aria-label="AI Assistant workspace"
    >
      {/* Desktop Header */}
      <div
        ref={dragRef}
        onPointerDown={startDrag}
        className={`flex items-center justify-between gap-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4 py-2.5 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900 ${
          ui.isMaximized
            ? "cursor-default"
            : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5 text-gray-700 dark:text-gray-200">
          {!ui.isMaximized && (
            <GripHorizontal className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
            <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="truncate text-sm font-semibold">AI Assistant</span>
        </div>

        <div
          className="flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowSidebar((v) => !v)}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200/70 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-pressed={showSidebar}
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            {showSidebar ? (
              <>
                <PanelLeftClose className="h-3.5 w-3.5" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-3.5 w-3.5" />
                <span>Chats</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={minimizeAssistant}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200/70 dark:hover:bg-gray-700"
            aria-label="Minimize assistant"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              ui.isMaximized ? restoreAssistant() : maximizeAssistant()
            }
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200/70 dark:hover:bg-gray-700"
            aria-label={
              ui.isMaximized ? "Restore assistant" : "Maximize assistant"
            }
            title={ui.isMaximized ? "Restore" : "Maximize"}
          >
            {ui.isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={closeAssistant}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            aria-label="Close assistant"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showSidebar && (
          <div className="hidden h-full w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 sm:block">
            <ChatSessionSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col bg-gray-50/40 dark:bg-gray-950/40">
          {!isSocketConnected && (
            <div className="flex items-center justify-center gap-2 border-b border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/40 dark:text-yellow-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Connecting to real-time service...
            </div>
          )}

          {pinnedContext && (
            <div className="flex items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/30">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-indigo-900 dark:text-indigo-200">
                <Pin className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                <span className="font-medium shrink-0">Pinned:</span>
                <span className="truncate">
                  <span className="mr-1 uppercase text-[10px] font-bold tracking-wide text-indigo-500">
                    {pinnedContext.type}
                  </span>
                  {pinnedContext.title}
                </span>
              </div>
              <button
                type="button"
                onClick={handleUnpinContext}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                aria-label="Remove pinned context"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            </div>
          )}

          <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {!currentSessionId && messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600 dark:from-indigo-950 dark:to-indigo-900 dark:text-indigo-300">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                  How can I help?
                </h2>
                <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
                  Ask about meetings, decisions, and policies without leaving
                  this page.
                </p>
                <div className="grid w-full max-w-lg gap-2.5">
                  {[
                    "What were the main decisions in the last engineering meeting?",
                    "Summarize the remote work policy updates.",
                    "Show me action items from the quarterly review.",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInputValue(suggestion)}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      "{suggestion}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5 pb-2">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "rounded-br-none bg-indigo-600 text-white"
                          : "rounded-bl-none border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                      {msg.role === "assistant" &&
                        msg.sources &&
                        msg.sources.length > 0 && (
                          <div className="mt-3 flex flex-wrap border-t border-gray-100 pt-2.5 dark:border-gray-800">
                            {msg.sources.map((src, i) => (
                              <SourceCitation key={i} source={src} index={i} />
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                ))}

                {isStreaming &&
                  messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-none border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
                        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" />
                        <span
                          className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                        <span className="ml-1 text-xs font-medium">
                          Thinking...
                        </span>
                      </div>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
            {error && (
              <div className="mb-2 rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            {isRateLimited && (
              <div className="mb-2 rounded-lg border border-orange-100 bg-orange-50 p-2.5 text-xs text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
                Too many messages sent recently. Please wait a moment before
                trying again.
              </div>
            )}

            <form onSubmit={handleSendMessage} className="relative">
              <textarea
                id="assistant-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about meetings, decisions, or policies..."
                disabled={isStreaming || !isSocketConnected}
                rows={1}
                className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 pr-12 text-sm shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
              <button
                type="submit"
                disabled={
                  !inputValue.trim() || isStreaming || !isSocketConnected
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-1.5 text-center text-xs text-gray-400 dark:text-gray-500">
              Press{" "}
              <kbd className="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-semibold dark:bg-gray-800">
                Enter
              </kbd>{" "}
              to send,{" "}
              <kbd className="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-semibold dark:bg-gray-800">
                Shift+Enter
              </kbd>{" "}
              for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingAssistant;
