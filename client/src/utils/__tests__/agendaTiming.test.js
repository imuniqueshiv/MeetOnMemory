import { describe, it, expect } from "vitest";
import {
  formatClock,
  getItemTiming,
  summarizeAgendaTiming,
} from "../agendaTiming.js";

const MINUTE = 60 * 1000;

describe("formatClock", () => {
  it("formats milliseconds as mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65 * 1000)).toBe("01:05");
    expect(formatClock(75 * MINUTE)).toBe("75:00");
  });

  it("treats missing or negative values as zero", () => {
    expect(formatClock(undefined)).toBe("00:00");
    expect(formatClock(-5000)).toBe("00:00");
  });
});

describe("getItemTiming", () => {
  it("uses the live elapsed time for the active item", () => {
    const timing = getItemTiming(
      { status: "active", duration: 5, actualDuration: 0 },
      3 * MINUTE,
    );

    expect(timing.actualMs).toBe(3 * MINUTE);
    expect(timing.remainingMs).toBe(2 * MINUTE);
    expect(timing.progressPercent).toBe(60);
    expect(timing.isOverrun).toBe(false);
    expect(timing.isNearLimit).toBe(false);
  });

  it("uses the recorded duration for items that are not active", () => {
    const timing = getItemTiming(
      { status: "completed", duration: 5, actualDuration: 4 * MINUTE },
      99 * MINUTE,
    );

    expect(timing.actualMs).toBe(4 * MINUTE);
    expect(timing.progressPercent).toBe(80);
  });

  it("flags an item as nearing its limit at 80% of planned time", () => {
    const timing = getItemTiming(
      { status: "active", duration: 10 },
      8 * MINUTE,
    );

    expect(timing.isNearLimit).toBe(true);
    expect(timing.isOverrun).toBe(false);
  });

  it("reports the overrun amount and caps progress at 100%", () => {
    const timing = getItemTiming({ status: "active", duration: 5 }, 8 * MINUTE);

    expect(timing.isOverrun).toBe(true);
    expect(timing.isNearLimit).toBe(false);
    expect(timing.overrunMs).toBe(3 * MINUTE);
    expect(timing.remainingMs).toBe(0);
    expect(timing.progressPercent).toBe(100);
  });

  it("never reports an overrun for items without a planned duration", () => {
    const timing = getItemTiming({ status: "active" }, 20 * MINUTE);

    expect(timing.hasPlan).toBe(false);
    expect(timing.isOverrun).toBe(false);
    expect(timing.progressPercent).toBe(0);
  });
});

describe("summarizeAgendaTiming", () => {
  it("totals planned and actual time across the agenda", () => {
    const items = [
      { status: "completed", duration: 5, actualDuration: 7 * MINUTE },
      { status: "active", duration: 10 },
      { status: "pending", duration: 5 },
    ];

    const summary = summarizeAgendaTiming(items, 4 * MINUTE);

    expect(summary.plannedMs).toBe(20 * MINUTE);
    expect(summary.actualMs).toBe(11 * MINUTE);
    expect(summary.itemsOverrun).toBe(1);
    expect(summary.isOverrun).toBe(false);
  });

  it("reports how far the whole agenda has run over", () => {
    const items = [
      { status: "completed", duration: 5, actualDuration: 9 * MINUTE },
      { status: "completed", duration: 5, actualDuration: 6 * MINUTE },
    ];

    const summary = summarizeAgendaTiming(items);

    expect(summary.isOverrun).toBe(true);
    expect(summary.overrunMs).toBe(5 * MINUTE);
    expect(summary.itemsOverrun).toBe(2);
  });

  it("handles an empty agenda", () => {
    expect(summarizeAgendaTiming([])).toEqual({
      plannedMs: 0,
      actualMs: 0,
      itemsOverrun: 0,
      isOverrun: false,
      overrunMs: 0,
    });
  });
});
