import React, { useState } from "react";
import {
  Coffee,
  FastForward,
  HelpCircle,
  Compass,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

export default function PulseCheckWidget({ onSendSignal, onCooldown }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const signals = [
    {
      type: "weeds",
      label: "In the weeds",
      icon: Compass,
      color: "text-amber-500",
      bg: "hover:bg-amber-50 dark:hover:bg-amber-900/30",
    },
    {
      type: "move_on",
      label: "Move on",
      icon: FastForward,
      color: "text-blue-500",
      bg: "hover:bg-blue-50 dark:hover:bg-blue-900/30",
    },
    {
      type: "break",
      label: "Need break",
      icon: Coffee,
      color: "text-green-500",
      bg: "hover:bg-green-50 dark:hover:bg-green-900/30",
    },
    {
      type: "clarity",
      label: "Need clarity",
      icon: HelpCircle,
      color: "text-purple-500",
      bg: "hover:bg-purple-50 dark:hover:bg-purple-900/30",
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center shadow-lg rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all duration-300">
      {isExpanded && (
        <div className="flex items-center gap-1 px-2 py-1 animate-in slide-in-from-right-4 fade-in duration-200">
          {signals.map((signal) => {
            const Icon = signal.icon;
            return (
              <button
                key={signal.type}
                onClick={() => {
                  onSendSignal(signal.type);
                  setIsExpanded(false);
                }}
                disabled={onCooldown}
                title={signal.label}
                className={`p-2 rounded-full transition-colors ${signal.color} ${signal.bg} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors flex items-center justify-center shadow-md"
        title="Meeting Pulse Check"
      >
        {isExpanded ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
        {!isExpanded && (
          <span className="ml-1 text-xs font-semibold">Pulse</span>
        )}
      </button>
    </div>
  );
}
