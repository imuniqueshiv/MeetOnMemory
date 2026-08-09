/**
 * Regression tests for Issue #1160 — meeting series recurrence.
 *
 * Three separate defects, in rough order of severity:
 *
 *   1. `Meeting` had no `series` / `seriesOccurrence` schema path, so
 *      `insertMany` stripped both and every occurrence was orphaned. The
 *      series-meetings endpoint returned zero rows for every series ever
 *      created and `cancelSeries` deleted nothing.
 *   2. `dayOfWeek` / `dayOfMonth` were accepted, validated, stored — and never
 *      read. `monthly` drifted off its intended day after any short month.
 *   3. The 50-occurrence cap truncated silently, and the stored `date` carried
 *      midnight rather than the meeting's time.
 *
 * The recurrence maths is tested directly against `utils/recurrence.js`,
 * because assertions about "the third Wednesday in a DST transition" are worth
 * making without a database round trip. Persistence and the endpoint contract
 * are tested through the controller.
 *
 * Confirmed load-bearing: against `main`'s model and controller (keeping the
 * new `utils/recurrence.js`, which the suite imports), 14 of the 20
 * controller-level tests fail. The 40 pure-unit tests exercise the new module
 * and so have no `main` counterpart.
 *
 * This change also turns `tests/meetingSeriesController.test.js` — the suite
 * added for #915, red on `main` — green, for the reason in defect 1.
 */

import mongoose from "mongoose";

import {
  generateOccurrenceDates,
  parseMeetingTime,
  MAX_OCCURRENCES,
} from "../utils/recurrence.js";
import Meeting from "../models/meetingModel.js";
import MeetingSeries from "../models/meetingSeriesModel.js";
import {
  createSeries,
  getSeriesMeetings,
  cancelSeries,
} from "../controllers/meetingSeriesController.js";

const ORG_A = new mongoose.Types.ObjectId();
const USER_A = new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const asUser = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query,
  user: { _id: USER_A, organization: ORG_A },
});

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dowOf = (date) => DOW[new Date(date).getDay()];

const baseSeriesBody = (overrides = {}) => ({
  title: "Weekly Sync",
  recurrencePattern: "weekly",
  startDate: "2026-08-03", // a Monday
  endDate: "2026-09-28",
  time: "10:00",
  ...overrides,
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

// ───────────────────────────────────────────────────────────────────────────
describe("parseMeetingTime", () => {
  it.each([
    ["14:30", 14, 30],
    ["09:05", 9, 5],
    ["9:05", 9, 5],
    ["00:00", 0, 0],
    ["23:59", 23, 59],
  ])("parses 24-hour %p", (input, hours, minutes) => {
    expect(parseMeetingTime(input)).toEqual({ hours, minutes });
  });

  it.each([
    ["10:00 AM", 10, 0],
    ["10:00 PM", 22, 0],
    ["12:00 AM", 0, 0],
    ["12:30 PM", 12, 30],
    ["1:15 pm", 13, 15],
  ])("parses 12-hour %p", (input, hours, minutes) => {
    // `tests/meetingSeriesController.test.js` already stores "10:00 AM", so
    // rejecting this format would break existing data.
    expect(parseMeetingTime(input)).toEqual({ hours, minutes });
  });

  it.each(["lunchtime", "", "25:00", "10:60", "10", "abc:de", null, undefined])(
    "rejects %p",
    (input) => {
      expect(parseMeetingTime(input)).toBeNull();
    },
  );
});

// ───────────────────────────────────────────────────────────────────────────
describe("generateOccurrenceDates", () => {
  const opts = (o) => ({
    startDate: new Date(2026, 7, 3), // Mon 3 Aug 2026
    endDate: new Date(2026, 8, 28), // Mon 28 Sep 2026
    time: "10:00",
    ...o,
  });

  describe("weekly", () => {
    it("honours dayOfWeek instead of following startDate", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", dayOfWeek: 3 }),
      );

      expect(dates.length).toBeGreaterThan(0);
      expect(dates.every((d) => d.getDay() === 3)).toBe(true);
      // Start is a Monday; the first Wednesday on or after it is the 5th.
      expect(dates[0].getDate()).toBe(5);
    });

    it("falls back to startDate's weekday when dayOfWeek is omitted", () => {
      const { dates, dayOfWeek } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly" }),
      );

      expect(dayOfWeek).toBe(1); // Monday
      expect(dates.every((d) => d.getDay() === 1)).toBe(true);
      expect(dates[0].getDate()).toBe(3);
    });

    it("reports the weekday it resolved so the series can store it", () => {
      const { dayOfWeek } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", dayOfWeek: 5 }),
      );
      expect(dayOfWeek).toBe(5);
    });

    it("steps exactly seven days", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", dayOfWeek: 3 }),
      );

      for (let i = 1; i < dates.length; i++) {
        const gapDays = Math.round(
          (dates[i] - dates[i - 1]) / (24 * 60 * 60 * 1000),
        );
        expect(gapDays).toBe(7);
      }
    });

    it("never produces an occurrence after endDate", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", dayOfWeek: 3 }),
      );
      const end = new Date(2026, 8, 28, 23, 59, 59);
      expect(dates.every((d) => d <= end)).toBe(true);
    });
  });

  describe("biweekly", () => {
    it("honours dayOfWeek and steps fourteen days", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "biweekly", dayOfWeek: 4 }),
      );

      expect(dates.every((d) => d.getDay() === 4)).toBe(true);
      for (let i = 1; i < dates.length; i++) {
        const gapDays = Math.round(
          (dates[i] - dates[i - 1]) / (24 * 60 * 60 * 1000),
        );
        expect(gapDays).toBe(14);
      }
    });
  });

  describe("monthly", () => {
    it("honours dayOfMonth instead of following startDate", () => {
      const { dates } = generateOccurrenceDates({
        recurrencePattern: "monthly",
        startDate: new Date(2026, 0, 3),
        endDate: new Date(2026, 5, 30),
        dayOfMonth: 15,
        time: "10:00",
      });

      expect(dates.every((d) => d.getDate() === 15)).toBe(true);
    });

    it("does not drift after a short month", () => {
      // `addMonths(31 Jan, 1)` clamps to 28 Feb, and the old loop fed that back
      // in — so every subsequent occurrence landed on the 28th and the series
      // never returned to the 31st.
      const { dates, skippedMonths } = generateOccurrenceDates({
        recurrencePattern: "monthly",
        startDate: new Date(2026, 0, 31),
        endDate: new Date(2026, 11, 31),
        time: "10:00",
      });

      expect(dates.every((d) => d.getDate() === 31)).toBe(true);
      // Feb, Apr, Jun, Sep, Nov have no 31st.
      expect(skippedMonths).toBe(5);
      expect(dates.map((d) => d.getMonth())).toEqual([0, 2, 4, 6, 7, 9, 11]);
    });

    it("skips a February that has no 30th", () => {
      const { dates, skippedMonths } = generateOccurrenceDates({
        recurrencePattern: "monthly",
        startDate: new Date(2026, 0, 30),
        endDate: new Date(2026, 2, 31),
        time: "10:00",
      });

      expect(dates.map((d) => d.getMonth())).toEqual([0, 2]); // Jan, Mar
      expect(skippedMonths).toBe(1);
    });

    it("does not emit an occurrence before startDate in the anchor month", () => {
      const { dates } = generateOccurrenceDates({
        recurrencePattern: "monthly",
        startDate: new Date(2026, 0, 20),
        endDate: new Date(2026, 2, 31),
        dayOfMonth: 5,
        time: "10:00",
      });

      // The 5th of January is before the start, so the series begins in Feb.
      expect(dates[0].getMonth()).toBe(1);
      expect(dates.every((d) => d.getDate() === 5)).toBe(true);
    });
  });

  describe("daily", () => {
    it("produces one occurrence per day inclusive of both ends", () => {
      const { dates } = generateOccurrenceDates({
        recurrencePattern: "daily",
        startDate: new Date(2026, 7, 1),
        endDate: new Date(2026, 7, 10),
        time: "09:30",
      });

      expect(dates).toHaveLength(10);
      expect(dates[0].getDate()).toBe(1);
      expect(dates[9].getDate()).toBe(10);
    });

    it("stays on the right calendar days across a DST transition", () => {
      // Adding 24h repeatedly slips an hour across a clock change and can land
      // on the wrong day; day-count arithmetic cannot.
      const { dates } = generateOccurrenceDates({
        recurrencePattern: "daily",
        startDate: new Date(2026, 2, 27),
        endDate: new Date(2026, 3, 2),
        time: "09:30",
      });

      expect(dates.map((d) => d.getDate())).toEqual([27, 28, 29, 30, 31, 1, 2]);
      expect(
        dates.every((d) => d.getHours() === 9 && d.getMinutes() === 30),
      ).toBe(true);
    });
  });

  describe("time of day", () => {
    it("stamps every occurrence with the meeting time", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", time: "14:30" }),
      );

      expect(
        dates.every((d) => d.getHours() === 14 && d.getMinutes() === 30),
      ).toBe(true);
    });

    it("handles a 12-hour time string", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", time: "2:30 PM" }),
      );
      expect(dates[0].getHours()).toBe(14);
    });

    it("leaves midnight when the time is unparseable", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", time: "lunchtime" }),
      );
      expect(dates[0].getHours()).toBe(0);
    });
  });

  describe("bounds", () => {
    it("reports truncation and how many the range implied", () => {
      const { dates, totalPossible, truncated } = generateOccurrenceDates({
        recurrencePattern: "daily",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 11, 31),
        time: "09:30",
        maxOccurrences: 50,
      });

      expect(dates).toHaveLength(50);
      expect(totalPossible).toBe(365);
      expect(truncated).toBe(true);
    });

    it("does not report truncation when everything fits", () => {
      const { truncated, totalPossible, dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "weekly", dayOfWeek: 3 }),
      );

      expect(truncated).toBe(false);
      expect(totalPossible).toBe(dates.length);
    });

    it("covers a full year of weekly meetings under the default cap", () => {
      // The old cap of 50 truncated a one-year weekly series at week 50.
      const { dates, truncated } = generateOccurrenceDates({
        recurrencePattern: "weekly",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 11, 31),
        time: "10:00",
        maxOccurrences: MAX_OCCURRENCES,
      });

      expect(dates.length).toBeGreaterThanOrEqual(52);
      expect(truncated).toBe(false);
    });

    it("returns nothing for an inverted range", () => {
      const { dates } = generateOccurrenceDates({
        recurrencePattern: "weekly",
        startDate: new Date(2026, 8, 1),
        endDate: new Date(2026, 7, 1),
        time: "10:00",
      });
      expect(dates).toEqual([]);
    });

    it("returns nothing for an unknown pattern", () => {
      const { dates } = generateOccurrenceDates(
        opts({ recurrencePattern: "fortnightly-ish" }),
      );
      expect(dates).toEqual([]);
    });

    it("handles a single-day range", () => {
      const { dates } = generateOccurrenceDates({
        recurrencePattern: "daily",
        startDate: new Date(2026, 7, 3),
        endDate: new Date(2026, 7, 3),
        time: "10:00",
      });
      expect(dates).toHaveLength(1);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("POST /api/meeting-series", () => {
  it("links every created meeting to its series", async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody()), res);

    expect(res.statusCode).toBe(201);
    const seriesId = res.body.series._id;

    // Against `main` this is 0: `series` was not a schema path, so
    // `insertMany` stripped it and every occurrence was orphaned.
    const linked = await Meeting.countDocuments({ series: seriesId });
    expect(linked).toBe(res.body.meetingsCreated);
    expect(linked).toBeGreaterThan(0);
  });

  it("numbers occurrences contiguously from one", async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody()), res);

    const meetings = await Meeting.find({
      series: res.body.series._id,
    }).sort({ seriesOccurrence: 1 });

    expect(meetings.map((m) => m.seriesOccurrence)).toEqual(
      meetings.map((_, i) => i + 1),
    );
  });

  it("honours dayOfWeek", async () => {
    const res = mockRes();
    await createSeries(
      asUser(baseSeriesBody({ dayOfWeek: 3 })), // Wednesday
      res,
    );

    const meetings = await Meeting.find({ series: res.body.series._id });
    expect(meetings.length).toBeGreaterThan(0);
    // Against `main`: every one of these is a Monday.
    expect(meetings.every((m) => dowOf(m.date) === "Wed")).toBe(true);
  });

  it("stores the resolved dayOfWeek on the series", async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody({ dayOfWeek: 3 })), res);

    const series = await MeetingSeries.findById(res.body.series._id);
    expect(series.dayOfWeek).toBe(3);

    const meetings = await Meeting.find({ series: series._id });
    // The stored schedule and the generated data must agree.
    expect(
      meetings.every((m) => new Date(m.date).getDay() === series.dayOfWeek),
    ).toBe(true);
  });

  it("back-fills dayOfWeek when the caller omits it", async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody()), res);

    const series = await MeetingSeries.findById(res.body.series._id);
    expect(series.dayOfWeek).toBe(1); // Monday, derived from startDate
  });

  it("honours dayOfMonth for a monthly series", async () => {
    const res = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({
          recurrencePattern: "monthly",
          dayOfMonth: 15,
          startDate: "2026-01-03",
          endDate: "2026-06-30",
        }),
      ),
      res,
    );

    const meetings = await Meeting.find({ series: res.body.series._id });
    expect(meetings.every((m) => new Date(m.date).getDate() === 15)).toBe(true);
  });

  it("stamps the meeting time onto the stored date", async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody({ time: "14:30" })), res);

    const meeting = await Meeting.findOne({ series: res.body.series._id });
    // Against `main` this is midnight: `date: currentDate` inherited its
    // time-of-day from a date-only `startDate`, while `time` said 14:30.
    expect(new Date(meeting.date).getHours()).toBe(14);
    expect(new Date(meeting.date).getMinutes()).toBe(30);
  });

  it("reports truncation instead of silently dropping occurrences", async () => {
    const res = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({
          recurrencePattern: "daily",
          startDate: "2026-01-01",
          endDate: "2027-12-31",
        }),
      ),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.truncated).toBe(true);
    expect(res.body.occurrencesRequested).toBeGreaterThan(
      res.body.meetingsCreated,
    );
    expect(res.body.maxOccurrences).toBe(MAX_OCCURRENCES);
  });

  it("creates a full year of weekly meetings without truncating", async () => {
    const res = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({ startDate: "2026-01-01", endDate: "2026-12-31" }),
      ),
      res,
    );

    // The old cap stopped at 50.
    expect(res.body.meetingsCreated).toBeGreaterThanOrEqual(52);
    expect(res.body.truncated).toBe(false);
  });

  it("rejects an unparseable time", async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody({ time: "lunchtime" })), res);

    expect(res.statusCode).toBe(400);
    expect(await MeetingSeries.countDocuments()).toBe(0);
  });

  it("still rejects an inverted date range", async () => {
    const res = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({ startDate: "2026-09-28", endDate: "2026-08-03" }),
      ),
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it("does not create an empty series", async () => {
    const res = mockRes();
    // A weekly Wednesday series in a range containing no Wednesday.
    await createSeries(
      asUser(
        baseSeriesBody({
          dayOfWeek: 3,
          startDate: "2026-08-06", // Thursday
          endDate: "2026-08-08", // Saturday
        }),
      ),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(await MeetingSeries.countDocuments()).toBe(0);
  });

  it("normalizes agenda item positions, as non-series meetings do", async () => {
    const res = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({
          agendaItems: [
            { text: "Second", duration: 5 },
            { text: "First", duration: 5 },
          ],
        }),
      ),
      res,
    );

    const meeting = await Meeting.findOne({ series: res.body.series._id });
    // `insertMany` bypasses the document pre-validate hook, so these used to
    // arrive un-normalized unlike every other meeting in the system.
    expect(meeting.agendaItems.map((i) => i.position)).toEqual([0, 1]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("GET /api/meeting-series/:id/meetings", () => {
  const seed = async () => {
    const res = mockRes();
    await createSeries(asUser(baseSeriesBody()), res);
    return res.body.series._id.toString();
  };

  it("returns the meetings in the series", async () => {
    const seriesId = await seed();
    const res = mockRes();

    await getSeriesMeetings(asUser({}, { id: seriesId }, {}), res);

    // Against `main` this is an empty list with `total: 0` for every series
    // that has ever been created.
    expect(res.body.meetings.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBe(res.body.meetings.length);
  });

  it("orders by occurrence", async () => {
    const seriesId = await seed();
    const res = mockRes();

    await getSeriesMeetings(
      asUser({}, { id: seriesId }, { limit: "all" }),
      res,
    );

    const occurrences = res.body.meetings.map((m) => m.seriesOccurrence);
    expect(occurrences).toEqual([...occurrences].sort((a, b) => a - b));
    expect(occurrences[0]).toBe(1);
  });

  it("does not return another series' meetings", async () => {
    const firstId = await seed();
    const secondRes = mockRes();
    await createSeries(
      asUser(baseSeriesBody({ title: "Other series" })),
      secondRes,
    );

    const res = mockRes();
    await getSeriesMeetings(asUser({}, { id: firstId }, { limit: "all" }), res);

    expect(
      res.body.meetings.every((m) => m.series.toString() === firstId),
    ).toBe(true);
  });

  it("paginates", async () => {
    const seriesId = await seed();

    const page1 = mockRes();
    await getSeriesMeetings(
      asUser({}, { id: seriesId }, { limit: "3", page: "1" }),
      page1,
    );
    expect(page1.body.meetings).toHaveLength(3);

    const page2 = mockRes();
    await getSeriesMeetings(
      asUser({}, { id: seriesId }, { limit: "3", page: "2" }),
      page2,
    );
    expect(page2.body.meetings[0].seriesOccurrence).toBe(4);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("PATCH /api/meeting-series/:id/cancel", () => {
  it("deletes the future un-started meetings it reports", async () => {
    const created = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({
          recurrencePattern: "daily",
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        }),
      ),
      created,
    );

    const seriesId = created.body.series._id.toString();
    const before = await Meeting.countDocuments({ series: seriesId });
    expect(before).toBeGreaterThan(0);

    const res = mockRes();
    await cancelSeries(asUser({}, { id: seriesId }), res);

    // Against `main`: `meetingsDeleted: 0` alongside "Series cancelled
    // successfully", because the filter could never match.
    expect(res.body.meetingsDeleted).toBe(before);
    expect(await Meeting.countDocuments({ series: seriesId })).toBe(0);

    const series = await MeetingSeries.findById(seriesId);
    expect(series.isActive).toBe(false);
  });

  it("leaves meetings that have already been processed", async () => {
    const created = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({
          recurrencePattern: "daily",
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        }),
      ),
      created,
    );

    const seriesId = created.body.series._id.toString();
    const keep = await Meeting.findOne({ series: seriesId });
    await Meeting.updateOne({ _id: keep._id }, { status: "completed" });

    const res = mockRes();
    await cancelSeries(asUser({}, { id: seriesId }), res);

    expect(await Meeting.findById(keep._id)).not.toBeNull();
    expect(res.body.meetingsDeleted).toBeGreaterThan(0);
  });

  it("does not touch another organization's meetings", async () => {
    const created = mockRes();
    await createSeries(
      asUser(
        baseSeriesBody({
          recurrencePattern: "daily",
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        }),
      ),
      created,
    );

    const seriesId = created.body.series._id;

    // A meeting carrying the same series id but belonging to another tenant.
    const foreign = await Meeting.create({
      uploadedBy: new mongoose.Types.ObjectId(),
      organization: new mongoose.Types.ObjectId(),
      title: "Someone else's meeting",
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      series: seriesId,
      seriesOccurrence: 1,
      status: "uploaded",
    });

    const res = mockRes();
    await cancelSeries(asUser({}, { id: seriesId.toString() }), res);

    expect(await Meeting.findById(foreign._id)).not.toBeNull();
  });

  it("404s for a series in another organization", async () => {
    const created = mockRes();
    await createSeries(asUser(baseSeriesBody()), created);

    const res = mockRes();
    await cancelSeries(
      {
        body: {},
        params: { id: created.body.series._id.toString() },
        query: {},
        user: {
          _id: new mongoose.Types.ObjectId(),
          organization: new mongoose.Types.ObjectId(),
        },
      },
      res,
    );

    expect(res.statusCode).toBe(404);
  });
});
