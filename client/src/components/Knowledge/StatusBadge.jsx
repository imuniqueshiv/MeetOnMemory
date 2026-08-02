// client/src/components/Knowledge/StatusBadge.jsx

import React from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

/**
 * StatusBadge Component
 * Renders consistent, accessible badges for different knowledge states.
 * Supports both light and dark modes via Tailwind CSS.
 *
 * @param {string} status - The status string (e.g., "approved", "rejected", "pending")
 */
const StatusBadge = ({ status }) => {
  const normalizedStatus = (status || "pending").toLowerCase();

  switch (normalizedStatus) {
    case "approved":
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {status}
        </span>
      );
    case "rejected":
    case "expired":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold">
          <XCircle className="w-3.5 h-3.5" />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          {status || "Pending"}
        </span>
      );
  }
};

export default StatusBadge;
