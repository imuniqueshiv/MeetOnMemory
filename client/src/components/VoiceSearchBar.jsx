import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Search, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";

const VoiceSearchBar = ({ onResults }) => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const finalTranscriptRef = useRef(finalTranscript);
  const handleSearchRef = useRef(null);

  useEffect(() => {
    finalTranscriptRef.current = finalTranscript;
  }, [finalTranscript]);

  const handleSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 3) {
      toast.error("Please speak a longer query (minimum 3 characters)");
      return;
    }

    try {
      setIsSearching(true);
      const { data } = await axios.get("/api/search/voice", {
        params: { query: query.trim() },
        withCredentials: true,
      });

      if (data.success) {
        setResults(data.results || []);
        if (onResults) {
          onResults(data.results || []);
        }
        
        if (data.results.length === 0) {
          toast.info("No results found for your query");
        } else {
          toast.success(`Found ${data.results.length} result(s)`);
        }
      }
    } catch (error) {
      console.error("Voice search error:", error);
      toast.error(error.response?.data?.message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [onResults]);

  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  useEffect(() => {
    // Check if browser supports speech recognition
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscriptRef.current && handleSearchRef.current) {
        handleSearchRef.current(finalTranscriptRef.current);
      }
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);
      if (final) {
        setFinalTranscript(final);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Please allow microphone access.");
        toast.error("Microphone permission denied");
      } else if (event.error === "no-speech") {
        setError("No speech detected.Please try again.");
        toast.error("No speech detected");
      } else {
        setError("Speech recognition error. Please try again.");
        toast.error("Speech recognition error");
      }
    };

    // Store recognition instance
    window.recognitionInstance = recognition;

    return () => {
      if (window.recognitionInstance) {
        window.recognitionInstance.abort();
      }
    };
  }, []);

  const startListening = () => {
    if (window.recognitionInstance) {
      setInterimTranscript("");
      setFinalTranscript("");
      window.recognitionInstance.start();
    }
  };

  const stopListening = () => {
    if (window.recognitionInstance) {
      window.recognitionInstance.stop();
    }
  };

  const handleTextSearch = (e) => {
    if (e.key === "Enter" && finalTranscript.trim().length >= 3) {
      handleSearch(finalTranscript);
    }
  };

  const clearSearch = () => {
    setFinalTranscript("");
    setInterimTranscript("");
    setResults([]);
    setError(null);
    if (onResults) {
      onResults([]);
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Speak or type your search query..."
              value={finalTranscript || interimTranscript}
              onChange={(e) => setFinalTranscript(e.target.value)}
              onKeyDown={handleTextSearch}
              className="w-full pl-10 pr-24 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isSearching}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {finalTranscript && (
                <button
                  onClick={clearSearch}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isSearching || error !== null}
                className={`p-1 rounded transition-colors ${
                  isListening
                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                    : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isListening ? "Stop recording" : "Start voice search"}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Interim transcript indicator */}
        {isListening && interimTranscript && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <span className="font-medium">Listening:</span> {interimTranscript}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isSearching && (
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Searching...</span>
        </div>
      )}

      {/* Results preview */}
      {results.length > 0 && !isSearching && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Search Results ({results.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {results.slice(0, 3).map((result, index) => (
              <div
                key={index}
                className="p-2 bg-white border border-gray-200 rounded text-sm"
              >
                <p className="font-medium text-gray-900">{result.title}</p>
                <p className="text-gray-600 text-xs truncate">{result.summary}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Score: {result.score}
                </p>
              </div>
            ))}
            {results.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                +{results.length - 3} more results
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceSearchBar;
