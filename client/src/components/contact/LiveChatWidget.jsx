import React from "react";
import { Sparkles, Send } from "lucide-react";

export default function LiveChatWidget({
  chatMessages,
  botTyping,
  chatEndRef,
  chatInput,
  setChatInput,
  handleSendMessage,
}) {
  return (
    <div className="live-chat-widget bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col max-h-[460px]">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <h3 className="font-bold text-sm text-gray-950 dark:text-white">
              Live Support Assistant
            </h3>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">
              Automated Bot Reply System
            </p>
          </div>
        </div>
        <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      {/* Chat Log container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 max-h-[260px] min-h-[220px]">
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`p-3 rounded-xl max-w-[85%] text-xs ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-100 dark:bg-slate-700/60 text-gray-800 dark:text-slate-200 rounded-bl-none"
              }`}
            >
              <p className="leading-relaxed">{msg.text}</p>
            </div>
            <span className="text-[9px] text-gray-400 mt-1 px-1">
              {msg.time}
            </span>
          </div>
        ))}

        {botTyping && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-700/60 text-gray-800 dark:text-slate-200 rounded-bl-none">
              <div className="flex gap-1.5 py-0.5 items-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-200" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-400" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input form */}
      <form
        onSubmit={handleSendMessage}
        className="pt-3 border-t border-gray-100 dark:border-slate-700/60 flex gap-2"
      >
        <input
          type="text"
          placeholder="Ask a quick question..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
        />
        <button
          type="submit"
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
