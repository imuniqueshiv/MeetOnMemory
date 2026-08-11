import { describe, it, expect } from "vitest";
import {
  formatClock,
  getItemTiming,
  readAgendaElapsedMs,
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

describe("readAgendaElapsedMs (Issue #1159)", () => {
  const T0 = new Date("2026-08-04T10:00:00.000Z").getTime();

  it("returns zero for a missing item", () => {
    expect(readAgendaElapsedMs(null, T0)).toBe(0);
    expect(readAgendaElapsedMs(undefined, T0)).toBe(0);
  });

  it("returns only the banked total for a stopped item", () => {
    const item = {
      status: "completed",
      actualDuration: 7 * MINUTE,
      startedAt: new Date(T0 - 99 * MINUTE).toISOString(),
    };

    // `startedAt` is stale bookkeeping once the item is no longer running; it
    // must not be added a second time.
    expect(readAgendaElapsedMs(item, T0)).toBe(7 * MINUTE);
  });

  it("adds the time on the clock for a running item", () => {
    const item = {
      status: "active",
      actualDuration: 4 * MINUTE,
      startedAt: new Date(T0 - 3 * MINUTE).toISOString(),
    };

    // Banked plus live — the server only folds the current interval into
    // `actualDuration` on stop, skip, or a switch to another item.
    expect(readAgendaElapsedMs(item, T0)).toBe(7 * MINUTE);
  });

  it("does not drift when ticks are dropped", () => {
    // This is the whole point of deriving rather than counting. A backgrounded
    // tab is clamped to roughly one tick a minute, so a counter would be four
    // minutes behind after four minutes hidden; a derived value is exact
    // whenever it next runs.
    const item = {
      status: "active",
      actualDuration: 0,
      startedAt: new Date(T0).toISOString(),
    };

    expect(readAgendaElapsedMs(item, T0 + 1000)).toBe(1000);
    // ...no ticks at all for the next four minutes...
    expect(readAgendaElapsedMs(item, T0 + 4 * MINUTE)).toBe(4 * MINUTE);
  });

  it("treats an active item with no start marker as banked-only", () => {
    expect(
      readAgendaElapsedMs({ status: "active", actualDuration: 2 * MINUTE }, T0),
    ).toBe(2 * MINUTE);
  });

  it("ignores an unparseable startedAt rather than reporting NaN", () => {
    const elapsed = readAgendaElapsedMs(
      { status: "active", actualDuration: 60_000, startedAt: "not a date" },
      T0,
    );

    expect(elapsed).toBe(60_000);
  });

  it("never goes negative on a future startedAt", () => {
    const item = {
      status: "active",
      actualDuration: 0,
      startedAt: new Date(T0 + 5 * MINUTE).toISOString(),
    };

    // Clock skew between instances must not produce a negative clock.
    expect(readAgendaElapsedMs(item, T0)).toBe(0);
  });
});
