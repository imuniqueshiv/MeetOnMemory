import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, MessageSquare, ChevronRight } from "lucide-react";
import { debriefQAApi } from "../../api/debriefQAApi.js";

const DebriefQAPanel = ({ meetingId, onCitationClick }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const session = await debriefQAApi.getSession(meetingId);
        if (session && session.messages) {
          setMessages(session.messages);
        }
      } catch (error) {
        console.error("Failed to fetch debrief session:", error);
      }
    };
    if (meetingId) {
      fetchSession();
    }
  }, [meetingId]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: "user", content: inputValue, citations: [] };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const assistantMessage = await debriefQAApi.askQuestion(
        meetingId,
        userMessage.content,
      );
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send question:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
          citations: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (message) => {
    // If there are citations, we want to highlight the markers in the text
    let content = message.content;
    const renderCitations = () => {
      if (!message.citations || message.citations.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          {message.citations.map((citation, idx) => (
            <button
              key={idx}
              onClick={() => onCitationClick && onCitationClick(citation)}
              className="inline-flex items-center text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition-colors border border-indigo-200"
              title={citation.excerpt}
            >
              <ChevronRight className="w-3 h-3 mr-1" />
              {citation.marker}{" "}
              {citation.type === "transcript" ? "Transcript" : "Decision"}
            </button>
          ))}
        </div>
      );
    };

    return (
      <div>
        <p className="whitespace-pre-wrap text-sm">{content}</p>
        {renderCitations()}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center">
        <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" />
        <h3 className="text-sm font-semibold text-gray-800">Debrief Q&A</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <p>Ask a question about this meeting.</p>
            <p className="mt-2 text-xs">
              Answers are strictly grounded in the meeting's transcript and
              decisions.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
              }`}
            >
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-500 rounded-lg rounded-tl-none px-4 py-2 shadow-sm flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analyzing context...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-200 bg-white">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about specific decisions, action items..."
            className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DebriefQAPanel;
