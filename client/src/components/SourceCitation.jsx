import React from "react";
import { Link } from "react-router-dom";

const SourceCitation = ({ source, index }) => {
  const { refType, refId, title } = source;
  
  const linkUrl = refType === "meeting" 
    ? `/meetings/${refId}` 
    : `/policies`; // or another policy route if specific policy view exists

  return (
    <Link
      to={linkUrl}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50/50 text-blue-700 hover:bg-blue-100/80 rounded-md border border-blue-200/60 transition-colors mr-2 mb-2 shadow-sm"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="font-bold text-blue-800 opacity-90">[Source {index + 1}]</span>
      <span className="truncate max-w-[180px] font-medium" title={title}>
        {title}
      </span>
    </Link>
  );
};

export default SourceCitation;
