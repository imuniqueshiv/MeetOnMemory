import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import AppContent from "./AppContent.js";
import { getBackendUrl } from "../config/backendConfig.js";
import apiClient, { createClerkSocketOptions } from "../services/apiClient.js";

const API_URL = getBackendUrl();
const UI_STORAGE_KEY = "meetonmemory-assistant-ui";

const AssistantContext = createContext(null);

const defaultUiState = () => {
  const width = 420;
  const height = 620;
  const margin = 24;
  return {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: {
      x: Math.max(margin, window.innerWidth - width - margin),
      y: Math.max(margin, window.innerHeight - height - margin),
    },
    size: { width, height },
    restoreSize: { width, height },
    restorePosition: null,
  };
};

const readStoredUi = () => {
  try {
    const raw = sessionStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return defaultUiState();
    const parsed = JSON.parse(raw);
    return { ...defaultUiState(), ...parsed };
  } catch {
    return defaultUiState();
  }
};

export const AssistantProvider = ({ children }) => {
  const { isLoggedin } = useContext(AppContent);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [pinnedContext, setPinnedContext] = useState(null);
  const [ui, setUi] = useState(readStoredUi);

  const socketRef = useRef(null);
  const currentSessionIdRef = useRef(currentSessionId);
  const sessionsBootstrapped = useRef(false);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(UI_STORAGE_KEY, JSON.stringify(ui));
    } catch {
      // ignore quota / private mode errors
    }
  }, [ui]);

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/api/assistant/sessions");
      setSessions(Array.isArray(data) ? data : data.sessions || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedin) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsSocketConnected(false);
      sessionsBootstrapped.current = false;
      return;
    }

    if (!sessionsBootstrapped.current) {
      sessionsBootstrapped.current = true;
      fetchSessions();
    }

    const backendUrl = API_URL.replace(/\/api$/, "");
    let socket;
    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions({
        reconnectionDelayMax: 10000,
      });
      if (cancelled) return;
      socket = io(backendUrl, opts);
      socketRef.current = socket;

      socket.on("connect", () => setIsSocketConnected(true));
      socket.on("disconnect", () => setIsSocketConnected(false));

      socket.on("assistant_message_chunk", (data) => {
        if (data.sessionId !== currentSessionIdRef.current) return;
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (
            lastIndex >= 0 &&
            next[lastIndex].role === "assistant" &&
            next[lastIndex].isStreaming
          ) {
            next[lastIndex] = {
              ...next[lastIndex],
              content: next[lastIndex].content + data.chunk,
            };
          } else {
            next.push({
              role: "assistant",
              content: data.chunk,
              isStreaming: true,
              sources: [],
            });
          }
          return next;
        });
      });

      socket.on("assistant_message_done", (data) => {
        if (data.sessionId !== currentSessionIdRef.current) return;
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].role === "assistant") {
            next[lastIndex] = { ...data.message, isStreaming: false };
          }
          return next;
        });
        setIsStreaming(false);
        if (data.title) fetchSessions();
      });

      socket.on("assistant_error", (data) => {
        if (data.sessionId !== currentSessionIdRef.current) return;
        setError(data.error);
        setIsStreaming(false);
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [isLoggedin, fetchSessions]);

  const openAssistant = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
    }));
  }, []);

  const closeAssistant = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
    }));
  }, []);

  const minimizeAssistant = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: true,
      isMaximized: false,
    }));
  }, []);

  const restoreAssistant = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      size: prev.restoreSize || prev.size,
      position: prev.restorePosition || prev.position,
    }));
  }, []);

  const maximizeAssistant = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      isMaximized: true,
      restoreSize: prev.size,
      restorePosition: prev.position,
    }));
  }, []);

  const setPosition = useCallback((position) => {
    setUi((prev) => ({ ...prev, position }));
  }, []);

  const handleSelectSession = useCallback(async (id) => {
    setCurrentSessionId(id);
    setError("");
    setIsRateLimited(false);
    try {
      const { data } = await apiClient.get(`/api/assistant/sessions/${id}`);
      setMessages(data.messages || []);
      setPinnedContext(data.pinnedContext || null);
    } catch (err) {
      console.error(err);
      setError("Could not load the selected conversation.");
    }
  }, []);

  const handleNewSession = useCallback(async () => {
    try {
      const { data } = await apiClient.post("/api/assistant/sessions");
      setSessions((prev) => [data, ...prev]);
      setCurrentSessionId(data._id);
      setMessages([]);
      setPinnedContext(null);
      setError("");
      setIsRateLimited(false);
    } catch (err) {
      console.error(err);
      setError("Could not create a new conversation.");
    }
  }, []);

  const handleDeleteSession = useCallback(async (id) => {
    try {
      await apiClient.delete(`/api/assistant/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s._id !== id));
      if (currentSessionIdRef.current === id) {
        setCurrentSessionId(null);
        setMessages([]);
        setPinnedContext(null);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const pinContextToSession = useCallback(async (sessionId, pin) => {
    if (!sessionId || !pin?.type || !pin?.refId) return null;
    const { data } = await apiClient.put(
      `/api/assistant/sessions/${sessionId}/pinned-context`,
      {
        type: pin.type,
        refId: pin.refId,
        title: pin.title,
      },
    );
    setPinnedContext(data.pinnedContext || null);
    return data.pinnedContext;
  }, []);

  const ensureSessionAndPin = useCallback(
    async (pin) => {
      let sessionId = currentSessionIdRef.current;
      if (!sessionId) {
        const { data } = await apiClient.post("/api/assistant/sessions");
        setSessions((prev) => [data, ...prev]);
        sessionId = data._id;
        setCurrentSessionId(sessionId);
        setMessages([]);
      }
      await pinContextToSession(sessionId, pin);
      if (pin?.title) {
        setInputValue(`Tell me about: ${pin.title}`);
      }
    },
    [pinContextToSession],
  );

  const handleUnpinContext = useCallback(async () => {
    if (!currentSessionIdRef.current) {
      setPinnedContext(null);
      return;
    }
    try {
      await apiClient.delete(
        `/api/assistant/sessions/${currentSessionIdRef.current}/pinned-context`,
      );
      setPinnedContext(null);
    } catch (err) {
      console.error(err);
      setError("Could not remove pinned context.");
    }
  }, []);

  const handleSendMessage = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!inputValue.trim() || isStreaming) return;

      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        try {
          const { data } = await apiClient.post("/api/assistant/sessions");
          setSessions((prev) => [data, ...prev]);
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
        await apiClient.post(
          `/api/assistant/sessions/${activeSessionId}/message`,
          { content: messageText },
        );
      } catch (err) {
        if (err.response?.status === 429) {
          setIsRateLimited(true);
          setIsStreaming(false);
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        console.error(err);
        setError("Failed to send message. Please try again.");
        setIsStreaming(false);
      }
    },
    [inputValue, isStreaming, currentSessionId],
  );

  const value = useMemo(
    () => ({
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
      ensureSessionAndPin,
      handleUnpinContext,
    }),
    [
      sessions,
      currentSessionId,
      messages,
      inputValue,
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
      ensureSessionAndPin,
      handleUnpinContext,
    ],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
};

export default AssistantContext;
