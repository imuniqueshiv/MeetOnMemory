import React from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";

const ChatSessionSidebar = ({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewSession, 
  onDeleteSession 
}) => {
  return (
    <div className="w-72 border-r border-gray-200 bg-gray-50/50 flex flex-col h-full shadow-[inset_-1px_0_0_rgba(0,0,0,0.05)]">
      <div className="p-4 border-b border-gray-200/60 bg-white">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow active:scale-[0.98] font-medium"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {sessions.map((session) => (
          <div
            key={session._id}
            className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
              currentSessionId === session._id 
                ? "bg-indigo-50 text-indigo-900 shadow-sm border border-indigo-100/50 ring-1 ring-indigo-500/20" 
                : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900 border border-transparent hover:border-gray-200/60"
            }`}
            onClick={() => onSelectSession(session._id)}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare className={`w-5 h-5 flex-shrink-0 transition-colors ${
                currentSessionId === session._id ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-500"
              }`} />
              <span className="truncate font-medium text-sm">{session.title || "New Chat"}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session._id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 transition-all rounded-lg hover:bg-red-50 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-200"
              title="Delete Chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-1">
              <MessageSquare className="w-6 h-6 text-indigo-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No recent chats</p>
            <p className="text-xs text-gray-400">Start a new conversation to search your organization's memory.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSessionSidebar;
