import { CheckCircle, Loader2, AlertCircle, HelpCircle } from "lucide-react";

export const getStatusStyle = (status) => {
  switch (status) {
    case "completed":
      return {
        bg: "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-800",
        dot: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
        icon: CheckCircle,
      };
    case "processing":
      return {
        bg: "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-800 animate-pulse",
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-100",
        icon: Loader2,
      };
    case "failed":
      return {
        bg: "bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-800",
        dot: "bg-rose-500",
        badge: "bg-rose-50 text-rose-700 border-rose-100",
        icon: AlertCircle,
      };
    default: // uploaded / upcoming
      return {
        bg: "bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-800",
        dot: "bg-blue-500",
        badge: "bg-blue-50 text-blue-700 border-blue-100",
        icon: HelpCircle,
      };
  }
};

export const formatTimeSlot = (timeStr) => {
  if (!timeStr) return "09:00 AM";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
};

export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 9 * 60; // default 09:00 AM (540 mins)
  const parts = timeStr.split(":");
  if (parts.length < 2) return 9 * 60;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

export const isSameDay = (d1, d2) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const getDaysInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
};

export const getWeekDays = (date) => {
  const startOfWeek = new Date(date);
  const day = date.getDay();
  const diff = date.getDate() - day; // adjust to Sunday
  startOfWeek.setDate(diff);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const wDay = new Date(startOfWeek);
    wDay.setDate(startOfWeek.getDate() + i);
    week.push(wDay);
  }
  return week;
};

export const buildMonthGrid = (currentDate) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const totalDays = getDaysInMonth(currentDate);
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...

  const prevMonthDate = new Date(year, month, 0);
  const prevMonthDays = prevMonthDate.getDate();

  const cells = [];

  // Prepend previous month's trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Append next month's leading days to complete grid rows
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    cells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  return cells;
};
