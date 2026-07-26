import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  formatTimeSlot,
  isSameDay,
  getDaysInMonth,
  getWeekDays,
  getStatusStyle,
} from "./calendarUtils";
import { CheckCircle, Loader2, AlertCircle, HelpCircle } from "lucide-react";

describe("calendarUtils", () => {
  describe("parseTimeToMinutes", () => {
    it("should parse HH:MM to total minutes", () => {
      expect(parseTimeToMinutes("09:00")).toBe(540);
      expect(parseTimeToMinutes("14:30")).toBe(870);
      expect(parseTimeToMinutes("00:00")).toBe(0);
    });

    it("should fallback to 9 AM (540 mins) if time string is invalid or empty", () => {
      expect(parseTimeToMinutes("")).toBe(540);
      expect(parseTimeToMinutes("invalid")).toBe(540);
    });
  });

  describe("formatTimeSlot", () => {
    it("should format HH:MM into 12-hour AM/PM format", () => {
      expect(formatTimeSlot("09:30")).toBe("9:30 AM");
      expect(formatTimeSlot("14:00")).toBe("2:00 PM");
      expect(formatTimeSlot("00:15")).toBe("12:15 AM");
      expect(formatTimeSlot("12:45")).toBe("12:45 PM");
    });

    it("should handle missing or invalid time string", () => {
      expect(formatTimeSlot("")).toBe("09:00 AM");
      expect(formatTimeSlot("invalid")).toBe("invalid"); // it returns timeStr if split fails
    });
  });

  describe("isSameDay", () => {
    it("should return true for the same dates", () => {
      const d1 = new Date(2023, 5, 15, 10, 0); // June 15, 2023, 10:00
      const d2 = new Date(2023, 5, 15, 18, 30); // June 15, 2023, 18:30
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it("should return false for different days", () => {
      const d1 = new Date(2023, 5, 15);
      const d2 = new Date(2023, 5, 16);
      expect(isSameDay(d1, d2)).toBe(false);
    });
  });

  describe("getDaysInMonth", () => {
    it("should return correct number of days in month", () => {
      expect(getDaysInMonth(new Date(2023, 0, 15))).toBe(31); // Jan
      expect(getDaysInMonth(new Date(2023, 1, 15))).toBe(28); // Feb (non-leap)
      expect(getDaysInMonth(new Date(2024, 1, 15))).toBe(29); // Feb (leap)
      expect(getDaysInMonth(new Date(2023, 3, 15))).toBe(30); // Apr
    });
  });

  describe("getWeekDays", () => {
    it("should return an array of 7 dates representing the week from Sunday to Saturday", () => {
      const date = new Date("2023-06-14T12:00:00"); // Wednesday
      const weekDays = getWeekDays(date);

      expect(weekDays).toHaveLength(7);
      expect(weekDays[0].getDay()).toBe(0); // Sunday
      expect(weekDays[0].getDate()).toBe(11);

      expect(weekDays[6].getDay()).toBe(6); // Saturday
      expect(weekDays[6].getDate()).toBe(17);
    });
  });

  describe("getStatusStyle", () => {
    it("should return styles for completed status", () => {
      const style = getStatusStyle("completed");
      expect(style.icon).toBe(CheckCircle);
      expect(style.badge).toContain("bg-emerald-50");
    });

    it("should return styles for processing status", () => {
      const style = getStatusStyle("processing");
      expect(style.icon).toBe(Loader2);
      expect(style.badge).toContain("bg-amber-50");
    });

    it("should return styles for failed status", () => {
      const style = getStatusStyle("failed");
      expect(style.icon).toBe(AlertCircle);
      expect(style.badge).toContain("bg-rose-50");
    });

    it("should return default styles for unknown status", () => {
      const style = getStatusStyle("unknown");
      expect(style.icon).toBe(HelpCircle);
      expect(style.badge).toContain("bg-blue-50");
    });
  });
});
