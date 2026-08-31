import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
} from "react";
import { Mic, Loader2, Volume2, X } from "lucide-react";
import apiClient from "../services/apiClient";
import AppContent from "../context/AppContent";

const WAKE_WORD = "hey memory";

const GlobalVoiceAssistant = () => {
  const { isLoggedin } = useContext(AppContent);
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showUI, setShowUI] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const speakResponse = useCallback(
    (text) => {
      if (!synthRef.current) return;

      setIsSpeaking(true);
      setShowUI(true);
      setFeedback("Speaking...");

      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setIsSpeaking(false);
        setShowUI(false);
        setFeedback("");
        if (isActive && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // ignore
          }
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setShowUI(false);
        if (isActive && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // ignore
          }
        }
      };

      synthRef.current.speak(utterance);
    },
    [isActive],
  );

  const handleQuery = useCallback(
    async (queryText) => {
      setIsProcessing(true);
      setShowUI(true);
      setFeedback(`Processing: "${queryText}"`);

      try {
        const response = await apiClient.post("/voice-search/query", {
          queryText,
        });
        if (response.data?.success && response.data?.response) {
          speakResponse(response.data.response);
        } else {
          speakResponse("I couldn't find an answer to that.");
        }
      } catch (error) {
        console.error("Voice search error:", error);
        speakResponse("Sorry, I encountered an error while searching.");
      } finally {
        setIsProcessing(false);
      }
    },
    [speakResponse],
  );

  useEffect(() => {
    if (!isLoggedin) return;

    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsActive(true);
    };

    recognition.onresult = async (event) => {
      if (isProcessing || isSpeaking) return;

      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase().trim();
      const wakeWordIndex = transcript.indexOf(WAKE_WORD);

      if (wakeWordIndex !== -1) {
        recognition.stop();
        let query = transcript
          .substring(wakeWordIndex + WAKE_WORD.length)
          .trim();
        if (query.length > 3) {
          handleQuery(query);
        } else {
          speakResponse("How can I help you?");
          setTimeout(() => {
            if (isActive) {
              try {
                recognition.start();
              } catch {
                // ignore
              }
            }
          }, 2000);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        console.error("Voice Assistant Error:", event.error);
      }
    };

    recognition.onend = () => {
      if (isActive && !isSpeaking && !isProcessing) {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [
    isLoggedin,
    isProcessing,
    isSpeaking,
    isActive,
    handleQuery,
    speakResponse,
  ]);

  const toggleAssistant = () => {
    if (isActive) {
      setIsActive(false);
      setShowUI(false);
      if (recognitionRef.current) recognitionRef.current.stop();
    } else {
      setIsActive(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // ignore
        }
      }
    }
  };

  if (!isLoggedin) return null;

  return (
    <>
      <button
        onClick={toggleAssistant}
        className={`fixed bottom-4 left-4 z-50 p-3 rounded-full shadow-lg transition-colors ${
          isActive
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400"
        }`}
        title={
          isActive
            ? "Disable Voice Assistant"
            : "Enable Voice Assistant ('Hey Memory')"
        }
      >
        <Mic className="w-5 h-5" />
      </button>

      {showUI && (
        <div className="fixed top-20 right-4 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 w-72 transform transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Memory Voice Assistant
            </h3>
            <button
              onClick={() => {
                setShowUI(false);
                if (isSpeaking) synthRef.current?.cancel();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
            ) : isSpeaking ? (
              <Volume2 className="w-4 h-4 text-blue-500 shrink-0 animate-pulse" />
            ) : null}
            <p className="truncate">{feedback}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalVoiceAssistant;
