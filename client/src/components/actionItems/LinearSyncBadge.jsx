import React from "react";

const LinearSyncBadge = ({ issueId, issueUrl }) => {
  if (!issueId) return null;

  const url = issueUrl || `https://linear.app/issue/${issueId}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 dark:hover:bg-indigo-800/50 rounded-md transition-colors border border-indigo-200 dark:border-indigo-800/50"
      title="View issue on Linear"
    >
      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V11.5h-2.82v6.59h-2.83V5.91h2.83v5.09h2.82V5.91h2.82v12.18h-2.82z" />
      </svg>
      Linear {issueId}
    </a>
  );
};

export default LinearSyncBadge;
