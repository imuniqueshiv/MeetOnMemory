import React, { useState, useEffect, useRef } from "react";
import { User } from "lucide-react";

export default function MentionPicker({
  isOpen = false,
  query = "",
  members = [],
  onSelect,
  onClose,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);

  // Filter members by query (match name or email)
  const filteredMembers = members.filter((m) => {
    if (!query) return true;
    const name = m.name || m.username || "";
    const email = m.email || "";
    const q = query.toLowerCase();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (filteredMembers.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) =>
            (prev - 1 + filteredMembers.length) % filteredMembers.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredMembers[selectedIndex]) {
          onSelect(filteredMembers[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, filteredMembers, selectedIndex, onSelect, onClose]);

  if (!isOpen || filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 mt-1 w-64 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 divide-y divide-slate-100 dark:divide-slate-700/50 text-xs"
    >
      <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/80">
        Mention Team Member
      </div>
      <div className="py-1">
        {filteredMembers.map((member, index) => {
          const isSelected = index === selectedIndex;
          const name = member.name || member.username || "Team Member";
          const email = member.email || "";

          return (
            <div
              key={member._id || member.id || index}
              onClick={() => onSelect(member)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
            >
              {member.avatar || member.profilePicture ? (
                <img
                  src={member.avatar || member.profilePicture}
                  alt={name}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {name.charAt(0).toUpperCase() || <User className="w-3 h-3" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{name}</div>
                {email && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {email}
                  </div>
                )}
              </div>
              {member.role && (
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {member.role}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
