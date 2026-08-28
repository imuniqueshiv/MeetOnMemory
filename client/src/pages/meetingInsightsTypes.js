/**
 * Data models and constants for the Meeting Insights Dashboard.
 */

export const InsightCategory = {
  ATTENDANCE: "attendance",
  ENGAGEMENT: "engagement",
  DECISIONS: "decisions",
  ACTION_ITEMS: "action_items",
  SENTIMENT: "sentiment",
  COST: "cost",
  FOLLOW_UP: "follow_up",
  PRODUCTIVITY: "productivity",
};

export const TrendDirection = {
  IMPROVING: "improving",
  STABLE: "stable",
  DECLINING: "declining",
};

export const InsightSeverity = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  WARNING: "warning",
  CRITICAL: "critical",
};

export const TimeRange = {
  WEEK: "week",
  MONTH: "month",
  QUARTER: "quarter",
  YEAR: "year",
};

export const CATEGORY_CONFIG = {
  [InsightCategory.ATTENDANCE]: {
    label: "Attendance",
    icon: "Users",
    color: "#22c55e",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    tagColor:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800",
  },
  [InsightCategory.ENGAGEMENT]: {
    label: "Engagement",
    icon: "MessageSquare",
    color: "#8b5cf6",
    bgColor: "bg-violet-50 dark:bg-violet-900/30",
    textColor: "text-violet-600 dark:text-violet-400",
    borderColor: "border-violet-200 dark:border-violet-800",
    tagColor:
      "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800",
  },
  [InsightCategory.DECISIONS]: {
    label: "Decisions",
    icon: "CheckCircle",
    color: "#0ea5e9",
    bgColor: "bg-sky-50 dark:bg-sky-900/30",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-200 dark:border-sky-800",
    tagColor:
      "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-100 dark:border-sky-800",
  },
  [InsightCategory.ACTION_ITEMS]: {
    label: "Action Items",
    icon: "ListTodo",
    color: "#f59e0b",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
    tagColor:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800",
  },
  [InsightCategory.SENTIMENT]: {
    label: "Sentiment",
    icon: "Heart",
    color: "#ec4899",
    bgColor: "bg-pink-50 dark:bg-pink-900/30",
    textColor: "text-pink-600 dark:text-pink-400",
    borderColor: "border-pink-200 dark:border-pink-800",
    tagColor:
      "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-100 dark:border-pink-800",
  },
  [InsightCategory.COST]: {
    label: "Cost",
    icon: "DollarSign",
    color: "#6366f1",
    bgColor: "bg-indigo-50 dark:bg-indigo-900/30",
    textColor: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    tagColor:
      "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800",
  },
  [InsightCategory.FOLLOW_UP]: {
    label: "Follow-up",
    icon: "ArrowRight",
    color: "#14b8a6",
    bgColor: "bg-teal-50 dark:bg-teal-900/30",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-200 dark:border-teal-800",
    tagColor:
      "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-800",
  },
  [InsightCategory.PRODUCTIVITY]: {
    label: "Productivity",
    icon: "Zap",
    color: "#f97316",
    bgColor: "bg-orange-50 dark:bg-orange-900/30",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
    tagColor:
      "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800",
  },
};

export const SEVERITY_CONFIG = {
  [InsightSeverity.POSITIVE]: {
    label: "Positive",
    icon: "TrendingUp",
    color: "#22c55e",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
  },
  [InsightSeverity.NEUTRAL]: {
    label: "Neutral",
    icon: "Minus",
    color: "#6b7280",
    bgColor: "bg-gray-50 dark:bg-gray-800",
    textColor: "text-gray-600 dark:text-gray-400",
  },
  [InsightSeverity.WARNING]: {
    label: "Warning",
    icon: "AlertTriangle",
    color: "#f59e0b",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  [InsightSeverity.CRITICAL]: {
    label: "Critical",
    icon: "AlertOctagon",
    color: "#ef4444",
    bgColor: "bg-red-50 dark:bg-red-900/30",
    textColor: "text-red-600 dark:text-red-400",
  },
};
