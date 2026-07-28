import React from "react";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔", "👏"];

const ReactionBar = ({ sendReaction, onCooldown }) => {
  return (
    <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40">
      <div
        className={`bg-gray-800/80 backdrop-blur-md rounded-full shadow-lg border border-gray-700/50 p-2 flex items-center gap-2 transition-opacity duration-300 ${
          onCooldown
            ? "opacity-50 pointer-events-none grayscale"
            : "opacity-100"
        }`}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            disabled={onCooldown}
            className="w-10 h-10 flex items-center justify-center text-xl rounded-full hover:bg-gray-700/50 active:scale-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emoji}
          </button>
        ))}
      </div>
      {onCooldown && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-red-400 font-semibold bg-gray-900/80 px-2 py-1 rounded-md whitespace-nowrap">
          Cooldown...
        </div>
      )}
    </div>
  );
};

export default ReactionBar;
