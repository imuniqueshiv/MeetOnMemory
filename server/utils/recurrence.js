/**
 * Occurrence generation for meeting series (Issue #1160).
 *
 * `createSeries` used to generate dates inline by repeatedly adding an interval
 * to `startDate`:
 *
 *   while (currentDate <= end && occurrence <= 50) {
 *     ...
 *     if (pattern === "weekly") currentDate = addWeeks(currentDate, 1);
 *     else if (pattern === "monthly") currentDate = addMonths(currentDate, 1);
 *   }
 *
 * Three things were wrong with that, and all three are why this is a separate,
 * directly testable module rather than a loop inside a controller:
 *
 *   1. **`dayOfWeek` and `dayOfMonth` were ignored.** They were accepted,
 *      range-checked by Zod and stored on the series document — then never
 *      read. "Every Wednesday" produced whatever weekday `startDate` happened
 *      to fall on, and the stored series disagreed with the data it generated.
 *
 *   2. **`monthly` drifted.** `addMonths` clamps to the end of a short month
 *      and the loop fed the clamped value back in, so 31 Jan -> 28 Feb ->
 *      28 Mar and never the 31st again. One short month permanently shifted the
 *      rest of the series. Every occurrence here is computed from the series
 *      *anchor* instead of from its predecessor, which makes drift structurally
 *      impossible rather than merely unlikely.
 *
 *   3. **Truncation was silent.** The 50-occurrence cap is a reasonable guard;
 *      returning `201 { meetingsCreated: 50 }` for a request that implied 365
 *      is not. This reports what the range implied so the caller can say so.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Default ceiling on generated occurrences.
 *
 * The previous 50 was low for the patterns this endpoint supports: daily
 * covered seven weeks, and weekly truncated a one-year series — the single most
 * common recurring meeting there is — at week 50. 520 is weekly for ten years
 * or daily for about seventeen months, and is still far below anything that
 * could exhaust memory (each occurrence is one small document).
 */
export const MAX_OCCURRENCES = 520;

/**
 * Absolute bound on the counting loop, so a pathological range (a hand-crafted
 * `endDate` centuries out) cannot spin. Occurrences beyond this are not counted
 * individually; `totalPossible` is reported as at-least this many.
 */
const COUNT_CEILING = 10_000;

/**
 * Parses a meeting time into `{hours, minutes}`.
 *
 * Both formats already in the data are accepted: 24-hour `"14:30"`, and the
 * 12-hour `"10:00 AM"` that `tests/meetingSeriesController.test.js` uses. The
 * field was `z.string().min(1)`, so `"lunchtime"` was accepted and stored;
 * anything unparseable is now rejected rather than silently ignored.
 *
 * @param {string} time
 * @returns {{hours: number, minutes: number}|null} null if unparseable
 */
export const parseMeetingTime = (time) => {
  if (typeof time !== "string") return null;

  const match = time
    .trim()
    .match(/^(\d{1,2}):([0-5]\d)(?:\s*([AaPp])\.?[Mm]\.?)?$/);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const meridiem = match[3]?.toLowerCase();

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "a") hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
  } else if (hours > 23) {
    return null;
  }

  return { hours, minutes };
};

/** A date at midnight local time, so day arithmetic is not perturbed by DST. */
const atMidnight = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Applies a parsed time to a date, or leaves midnight if there is no time. */
const withTime = (date, parsedTime) => {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (parsedTime) out.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
  return out;
};

/** Days from `date` forward to the next occurrence of `targetDow` (0 if same). */
const daysUntilWeekday = (date, targetDow) =>
  (targetDow - date.getDay() + 7) % 7;

/** Number of days in a given month, so an invalid `dayOfMonth` is detectable. */
const daysInMonth = (year, monthIndex) =>
  new Date(year, monthIndex + 1, 0).getDate();

/**
 * Generates the dates for a meeting series.
 *
 * `dayOfWeek` applies to `weekly` and `biweekly`; `dayOfMonth` applies to
 * `monthly`. Either being absent means "derive it from `startDate`", which is
 * the previous behaviour and stays the documented default — the derived value
 * is returned so the caller can write it back and keep the stored series
 * consistent with the data it produced.
 *
 * Months that do not contain `dayOfMonth` (the 31st in February) are **skipped**
 * rather than clamped. Clamping is the alternative and is what `addMonths` did
 * accidentally; skipping is chosen deliberately because "the 31st" has no
 * February instance, and because a skipped month cannot shift the rest of the
 * series the way a clamped one did.
 *
 * @param {object} options
 * @param {"daily"|"weekly"|"biweekly"|"monthly"} options.recurrencePattern
 * @param {Date} options.startDate
 * @param {Date} options.endDate
 * @param {number} [options.dayOfWeek]  0 (Sunday) – 6 (Saturday)
 * @param {number} [options.dayOfMonth] 1 – 31
 * @param {string} [options.time]       "HH:MM" or "h:MM AM"
 * @param {number} [options.maxOccurrences]
 * @returns {{
 *   dates: Date[],
 *   totalPossible: number,
 *   truncated: boolean,
 *   skippedMonths: number,
 *   dayOfWeek: number|null,
 *   dayOfMonth: number|null,
 * }}
 */
export const generateOccurrenceDates = ({
  recurrencePattern,
  startDate,
  endDate,
  dayOfWeek,
  dayOfMonth,
  time,
  maxOccurrences = MAX_OCCURRENCES,
} = {}) => {
  const empty = {
    dates: [],
    totalPossible: 0,
    truncated: false,
    skippedMonths: 0,
    dayOfWeek: null,
    dayOfMonth: null,
  };

  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    return empty;
  }
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    return empty;
  }

  const parsedTime = parseMeetingTime(time);
  const start = atMidnight(startDate);
  // Compared at end-of-day so an `endDate` given as a date-only string still
  // includes an occurrence falling on that day.
  const lastDay = atMidnight(endDate);
  if (lastDay < start) return empty;

  const dates = [];
  let totalPossible = 0;
  let skippedMonths = 0;

  const push = (date) => {
    totalPossible++;
    if (dates.length < maxOccurrences) dates.push(withTime(date, parsedTime));
  };

  if (recurrencePattern === "daily") {
    // Iterating by day count rather than by mutating a Date avoids the DST
    // hazard of repeatedly adding 24h across a clock change.
    const span = Math.floor((lastDay - start) / MS_PER_DAY);
    for (let i = 0; i <= span && totalPossible < COUNT_CEILING; i++) {
      push(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
      );
    }
    return {
      dates,
      totalPossible,
      truncated: totalPossible > dates.length,
      skippedMonths,
      dayOfWeek: null,
      dayOfMonth: null,
    };
  }

  if (recurrencePattern === "weekly" || recurrencePattern === "biweekly") {
    const step = recurrencePattern === "weekly" ? 7 : 14;

    const targetDow =
      Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6
        ? dayOfWeek
        : start.getDay();

    // The anchor is the first occurrence of the requested weekday on or after
    // `startDate`. Starting a "every Wednesday" series on a Monday now yields
    // Wednesdays, not Mondays.
    const anchor = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + daysUntilWeekday(start, targetDow),
    );

    for (let i = 0; totalPossible < COUNT_CEILING; i++) {
      const occurrence = new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        anchor.getDate() + i * step,
      );
      if (occurrence > lastDay) break;
      push(occurrence);
    }

    return {
      dates,
      totalPossible,
      truncated: totalPossible > dates.length,
      skippedMonths,
      dayOfWeek: targetDow,
      dayOfMonth: null,
    };
  }

  if (recurrencePattern === "monthly") {
    const targetDom =
      Number.isInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31
        ? dayOfMonth
        : start.getDate();

    for (let i = 0; totalPossible < COUNT_CEILING; i++) {
      const year = start.getFullYear();
      const monthIndex = start.getMonth() + i;

      // Normalized so the month/year rollover is handled by Date itself.
      const probe = new Date(year, monthIndex, 1);
      if (probe > lastDay) break;

      if (targetDom > daysInMonth(probe.getFullYear(), probe.getMonth())) {
        skippedMonths++;
        continue;
      }

      const occurrence = new Date(
        probe.getFullYear(),
        probe.getMonth(),
        targetDom,
      );
      if (occurrence > lastDay) break;
      if (occurrence < start) continue; // the anchor month, before startDate

      push(occurrence);
    }

    return {
      dates,
      totalPossible,
      truncated: totalPossible > dates.length,
      skippedMonths,
      dayOfWeek: null,
      dayOfMonth: targetDom,
    };
  }

  return empty;
};

export default { generateOccurrenceDates, parseMeetingTime, MAX_OCCURRENCES };
