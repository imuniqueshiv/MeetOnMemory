import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Send, RefreshCw } from "lucide-react";
import ChatSessionSidebar from "../components/ChatSessionSidebar";
import SourceCitation from "../components/SourceCitation";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AiAssistant = () => {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [isSocketConnected, setIsSocketConnected] = useState(true);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const tokenRef = useRef(localStorage.getItem("token"));

  useEffect(() => {
    fetchSessions();

    // Initialize socket connection
    const backendUrl = API_URL.replace(/\/api$/, "");
    socketRef.current = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 10000,
    });

    socketRef.current.on("connect", () => {
      setIsSocketConnected(true);
    });

    socketRef.current.on("disconnect", () => {
      setIsSocketConnected(false);
    });

    socketRef.current.on("assistant_message_chunk", (data) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant" && newMessages[lastIndex].isStreaming) {
            newMessages[lastIndex].content += data.chunk;
          } else {
            newMessages.push({ role: "assistant", content: data.chunk, isStreaming: true, sources: [] });
          }
          return newMessages;
        });
      }
    });

    socketRef.current.on("assistant_message_done", (data) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
            newMessages[lastIndex] = {
              ...data.message,
              isStreaming: false,
            };
          }
          return newMessages;
        });
        setIsStreaming(false);
        // Refresh sessions to get new title if updated
        if (data.title) {
          fetchSessions();
        }
      }
    });

    socketRef.current.on("assistant_error", (data) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setError(data.error);
        setIsStreaming(false);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Use a ref for currentSessionId so socket listeners have the latest value
  const currentSessionIdRef = useRef(currentSessionId);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/assistant/sessions`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectSession = async (id) => {
    setCurrentSessionId(id);
    setError("");
    setIsRateLimited(false);
    try {
      const res = await fetch(`${API_URL}/api/assistant/sessions/${id}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
      setError("Could not load the selected conversation.");
    }
  };

  const handleNewSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/assistant/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setSessions([data, ...sessions]);
      setCurrentSessionId(data._id);
      setMessages([]);
      setError("");
      setIsRateLimited(false);
    } catch (err) {
      console.error(err);
      setError("Could not create a new conversation.");
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      await fetch(`${API_URL}/api/assistant/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      setSessions(sessions.filter((s) => s._id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      // Auto-create session if none active
      try {
        const res = await fetch(`${API_URL}/api/assistant/sessions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        const data = await res.json();
        setSessions([data, ...sessions]);
        activeSessionId = data._id;
        setCurrentSessionId(data._id);
      } catch (err) {
        console.error(err);
        setError("Failed to initialize conversation.");
        return;
      }
    }

    const messageText = inputValue;
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setIsStreaming(true);
    setError("");
    setIsRateLimited(false);

    try {
      const res = await fetch(`${API_URL}/api/assistant/sessions/${activeSessionId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ content: messageText }),
      });

      if (res.status === 429) {
        setIsRateLimited(true);
        setIsStreaming(false);
        // Remove the user message optimistically added
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!res.ok) throw new Error("Message failed to send");
    } catch (err) {
      console.error(err);
      setError("Failed to send message. Please try again.");
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
      <ChatSessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30">
        {!isSocketConnected && (
          <div className="bg-yellow-50 text-yellow-800 px-4 py-2 text-sm font-medium border-b border-yellow-200 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Connecting to real-time service...
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {!currentSessionId && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">How can I help you today?</h2>
              <p className="text-gray-500 mb-8">
                Ask questions about your organization's meetings, decisions, and policies. I'll search your memory and provide cited answers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {["What were the main decisions in the last engineering meeting?", "Summarize the remote work policy updates."].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(suggestion)}
                    className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-sm text-gray-700"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap">
                        {msg.sources.map((src, i) => (
                          <SourceCitation key={i} source={src} index={i} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center gap-2 text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    <span className="ml-2 text-sm font-medium">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}
            {isRateLimited && (
              <div className="mb-3 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Too many messages sent recently. Please wait a moment before trying again.
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about meetings, decisions, or policies..."
                disabled={isStreaming || !isSocketConnected}
                className="w-full pl-5 pr-14 py-3.5 bg-gray-50 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 transition-all shadow-sm"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isStreaming || !isSocketConnected}
                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <div className="text-center mt-2">
              <span className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">AI Assistant can make mistakes. Verify important information.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
