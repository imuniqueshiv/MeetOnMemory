import React, { useEffect, useState } from "react";

// Minimal CSS for floating animations
const style = document.createElement("style");
style.textContent = `
  @keyframes floatUpAndFade {
    0% {
      transform: translateY(0) scale(1) rotate(-10deg);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    100% {
      transform: translateY(-250px) scale(1.5) rotate(15deg);
      opacity: 0;
    }
  }
  .animate-reaction {
    animation: floatUpAndFade 2.5s ease-out forwards;
  }
`;
document.head.appendChild(style);

const ReactionOverlay = ({ reactions }) => {
  const [offsets, setOffsets] = useState({});

  useEffect(() => {
    setOffsets((prev) => {
      let changed = false;
      const newOffsets = { ...prev };
      reactions.forEach((r) => {
        if (newOffsets[r.id] === undefined) {
          newOffsets[r.id] = Math.floor(Math.random() * 160) - 80;
          changed = true;
        }
      });
      return changed ? newOffsets : prev;
    });
  }, [reactions]);

  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden flex items-end justify-center">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute text-4xl animate-reaction pointer-events-none"
          style={{
            bottom: "120px",
            left: `calc(50% + ${offsets[r.id] || 0}px)`,
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
};

export default ReactionOverlay;
