import { z } from "zod";
import mongoose from "mongoose";
import MeetingSeries from "../models/meetingSeriesModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import { parseISO } from "date-fns";
import { parsePagination } from "../utils/pagination.js";
import { normalizeAgendaItems } from "../utils/agendaOrdering.js";
import {
  generateOccurrenceDates,
  parseMeetingTime,
  MAX_OCCURRENCES,
} from "../utils/recurrence.js";

/**
 * Hard ceiling for the `limit=0` / `limit=all` whole-series response
 * (Issue #1071). Weekly for ~19 years — comfortably above any real recurrence
 * schedule, and low enough that a corrupt or malicious series cannot exhaust
 * the heap.
 */
const SERIES_MAX_UNPAGINATED = 1000;

const createSeriesSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  meetingType: z
    .enum(["conference", "policy", "event", "internal"])
    .default("conference"),
  recurrencePattern: z.enum(["daily", "weekly", "biweekly", "monthly"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  startDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  // Was `z.string().min(1)`, so `"lunchtime"` was accepted and stored
  // (Issue #1160). Both formats already present in the codebase are allowed:
  // 24-hour `"14:30"` and 12-hour `"10:00 AM"`.
  time: z
    .string()
    .min(1, "Time is required")
    .refine(
      (val) => parseMeetingTime(val) !== null,
      "Time must be HH:MM (e.g. 14:30) or h:MM AM/PM (e.g. 2:30 PM)",
    ),
  duration: z.number().optional().default(60),
  location: z.string().optional(),
  venue: z.string().optional(),
  venueCoordinates: z
    .object({
      lat: z.number().finite().nullable().optional(),
      lng: z.number().finite().nullable().optional(),
    })
    .nullable()
    .optional(),
  participants: z
    .array(
      z.object({
        name: z.string().min(1, "Participant name is required"),
        email: z.string().email("Invalid email format").optional(),
        role: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  agendaItems: z
    .array(
      z.object({
        text: z.string().min(1, "Agenda item text is required"),
        description: z.string().optional(),
        duration: z.number().optional(),
      }),
    )
    .optional()
    .default([]),
  auditNote: z.string().optional().default(""),
});

export const createSeries = async (req, res) => {
  try {
    const validatedData = createSeriesSchema.parse(req.body);
    const {
      title,
      description,
      meetingType,
      recurrencePattern,
      dayOfWeek,
      dayOfMonth,
      startDate,
      endDate,
      time,
      duration,
      location,
      venue,
      venueCoordinates,
      participants,
      agendaItems,
      auditNote,
    } = validatedData;

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    // Generate the occurrence dates *before* saving the series, so the values
    // actually used for `dayOfWeek` / `dayOfMonth` can be written onto the
    // series document. Previously the request's values were stored and then
    // ignored, leaving the stored series describing a schedule its own meetings
    // did not follow (Issue #1160).
    const {
      dates,
      totalPossible,
      truncated,
      skippedMonths,
      dayOfWeek: resolvedDayOfWeek,
      dayOfMonth: resolvedDayOfMonth,
    } = generateOccurrenceDates({
      recurrencePattern,
      startDate: start,
      endDate: end,
      dayOfWeek,
      dayOfMonth,
      time,
      maxOccurrences: MAX_OCCURRENCES,
    });

    if (dates.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "The requested schedule produces no meetings in the given date range.",
      });
    }

    const series = new MeetingSeries({
      title,
      organization: req.user.organization,
      createdBy: req.user._id,
      recurrencePattern,
      dayOfWeek: resolvedDayOfWeek,
      dayOfMonth: resolvedDayOfMonth,
      startDate: start,
      endDate: end,
      time,
      duration,
      auditNote,
    });

    await series.save();

    const meetingsToCreate = dates.map((date, index) => ({
      uploadedBy: req.user._id,
      organization: req.user.organization,
      title,
      description,
      meetingType,
      date,
      time,
      duration,
      location,
      venue,
      venueCoordinates: venueCoordinates || { lat: null, lng: null },
      participants,
      // `insertMany` bypasses the document `pre("validate")` hook that
      // normally runs `normalizeAgendaItems`, so series-created meetings had
      // un-normalized `position` values unlike every other meeting. Applying it
      // here restores the invariant.
      agendaItems: normalizeAgendaItems(agendaItems),
      series: series._id,
      seriesOccurrence: index + 1,
      auditNote,
    }));

    const createdMeetings = await Meeting.insertMany(meetingsToCreate);

    if (truncated) {
      console.warn(
        `⚠️ Series ${series._id} implied ${totalPossible} occurrences; created ${createdMeetings.length} (cap ${MAX_OCCURRENCES}).`,
      );
    }

    res.status(201).json({
      success: true,
      series,
      meetingsCreated: createdMeetings.length,
      // A 201 that quietly drops occurrences is the wrong answer. The caller
      // now gets enough to say "we scheduled 520 of the 730 you asked for".
      occurrencesRequested: totalPossible,
      truncated,
      maxOccurrences: MAX_OCCURRENCES,
      // Non-zero only for a monthly series on a day some months lack (the 31st
      // in February), which is skipped rather than clamped.
      skippedMonths,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("Error creating meeting series:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating meeting series",
    });
  }
};

export const getSeriesById = async (req, res) => {
  try {
    const series = await MeetingSeries.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!series) {
      return res
        .status(404)
        .json({ success: false, message: "Series not found" });
    }

    res.json({ success: true, series });
  } catch (error) {
    console.error("Error fetching meeting series:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching meeting series",
    });
  }
};

/**
 * List org meeting series for the manage page (Issue #2036).
 */
export const listSeries = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.user?.organizationId;
    if (!orgId) {
      return res.status(403).json({
        success: false,
        message: "Organization membership required",
      });
    }

    const seriesList = await MeetingSeries.find({ organization: orgId })
      .sort({ updatedAt: -1 })
      .lean();

    const now = new Date();
    const enriched = await Promise.all(
      seriesList.map(async (series) => {
        const [nextMeeting, occurrenceCount] = await Promise.all([
          Meeting.findOne({
            series: series._id,
            organization: orgId,
            date: { $gte: now },
          })
            .sort({ date: 1 })
            .select("date time title seriesOccurrence")
            .lean(),
          Meeting.countDocuments({ series: series._id, organization: orgId }),
        ]);

        return {
          ...series,
          status: series.isActive ? "active" : "paused",
          occurrenceCount,
          nextOccurrence: nextMeeting
            ? {
                date: nextMeeting.date,
                time: nextMeeting.time,
                title: nextMeeting.title,
                seriesOccurrence: nextMeeting.seriesOccurrence,
              }
            : null,
        };
      }),
    );

    res.json({ success: true, series: enriched });
  } catch (error) {
    console.error("Error listing meeting series:", error);
    res.status(500).json({
      success: false,
      message: "Server error listing meeting series",
    });
  }
};

/**
 * Pause a series without deleting future meetings (Issue #2036).
 */
export const pauseSeries = async (req, res) => {
  try {
    const series = await MeetingSeries.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
        isActive: true,
      },
      { isActive: false },
      { new: true },
    );

    if (!series) {
      return res.status(404).json({
        success: false,
        message: "Active series not found",
      });
    }

    res.json({
      success: true,
      message: "Series paused successfully",
      series,
    });
  } catch (error) {
    console.error("Error pausing meeting series:", error);
    res.status(500).json({
      success: false,
      message: "Server error pausing meeting series",
    });
  }
};

/**
 * Resume a paused series (Issue #2036).
 */
export const resumeSeries = async (req, res) => {
  try {
    const series = await MeetingSeries.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
        isActive: false,
      },
      { isActive: true },
      { new: true },
    );

    if (!series) {
      return res.status(404).json({
        success: false,
        message: "Paused series not found",
      });
    }

    res.json({
      success: true,
      message: "Series resumed successfully",
      series,
    });
  } catch (error) {
    console.error("Error resuming meeting series:", error);
    res.status(500).json({
      success: false,
      message: "Server error resuming meeting series",
    });
  }
};

export const getSeriesMeetings = async (req, res) => {
  try {
    // `limit=0` / `limit=all` is the deliberate "give me the whole series"
    // escape hatch added for #915 — a series timeline is not useful a page at a
    // time. It is kept, but it is no longer *unbounded*: a series with a
    // runaway occurrence count would otherwise stream every document into
    // memory. SERIES_MAX_UNPAGINATED is far above any real recurrence schedule
    // (weekly for ~19 years), so nothing legitimate is truncated.
    const wantsWholeSeries =
      req.query.limit === "0" || req.query.limit === "all";

    const orgId = req.user?.organization || req.user?.organizationId || null;
    const query = { series: req.params.id };
    if (orgId) {
      query.organization = orgId;
    }

    const total = await Meeting.countDocuments(query);

    let meetings;
    let page = 1;
    let limit = 0;

    if (wantsWholeSeries) {
      meetings = await Meeting.find(query)
        .sort({ seriesOccurrence: 1 })
        .limit(SERIES_MAX_UNPAGINATED);

      if (total > SERIES_MAX_UNPAGINATED) {
        console.warn(
          `⚠️ Series ${req.params.id} has ${total} meetings; truncating the unpaginated response at ${SERIES_MAX_UNPAGINATED}.`,
        );
      }
    } else {
      // `parseInt(req.query.limit)` used to be passed straight to `.limit()`,
      // so `?limit=10000000` was honoured verbatim, and `?page=0` produced a
      // negative skip that MongoDB rejected as a 500.
      ({ page, limit } = parsePagination(req.query, { defaultLimit: 20 }));
      meetings = await Meeting.find(query)
        .sort({ seriesOccurrence: 1 })
        .skip((page - 1) * limit)
        .limit(limit);
    }

    res.json({
      success: true,
      meetings,
      pagination: {
        total,
        page,
        pages: limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  } catch (error) {
    console.error("Error fetching series meetings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching series meetings",
    });
  }
};

export const cancelSeries = async (req, res) => {
  try {
    const series = await MeetingSeries.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true },
    );

    if (!series) {
      return res
        .status(404)
        .json({ success: false, message: "Series not found" });
    }

    // Delete future un-started meetings in the series.
    //
    // Scoped to the caller's organization (Issue #1160). `series._id` is
    // already confirmed to belong to them by the `findOneAndUpdate` above, so
    // this is defence in depth rather than a live hole — but every other
    // destructive query in this controller is org-scoped, and a `deleteMany`
    // is the last place to rely on an inference from two statements earlier.
    const deletionFilter = {
      series: series._id,
      date: { $gte: new Date() },
      status: "uploaded", // Only delete if they haven't been started/processed
    };
    if (req.user.organization) {
      deletionFilter.organization = req.user.organization;
    }

    const result = await Meeting.deleteMany(deletionFilter);

    res.json({
      success: true,
      message: "Series cancelled successfully",
      meetingsDeleted: result.deletedCount,
    });
  } catch (error) {
    console.error("Error cancelling meeting series:", error);
    res.status(500).json({
      success: false,
      message: "Server error cancelling meeting series",
    });
  }
};

export const getSeriesDrift = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.user?.organizationId || null;
    const seriesId = req.params.id;

    if (!mongoose.isValidObjectId(seriesId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid series ID" });
    }

    const query = { _id: seriesId };
    if (orgId) {
      query.organization = orgId;
    }

    const series = await MeetingSeries.findOne(query);
    if (!series) {
      return res
        .status(404)
        .json({ success: false, message: "Series not found" });
    }

    const meetingQuery = { series: seriesId, status: "completed" };
    if (orgId) {
      meetingQuery.organization = orgId;
    }

    const meetings = await Meeting.find(meetingQuery)
      .sort({ seriesOccurrence: 1, date: 1 })
      .select("_id seriesOccurrence date duration participants");

    if (meetings.length === 0) {
      return res.json({ success: true, drift: [], summary: null });
    }

    const meetingIds = meetings.map((m) => m._id);

    // Aggregate Action Items
    const actionItemMatch = { sourceMeetingId: { $in: meetingIds } };
    if (orgId) actionItemMatch.organization = orgId;

    const actionItemsCount = await ActionItem.aggregate([
      { $match: actionItemMatch },
      { $group: { _id: "$sourceMeetingId", count: { $sum: 1 } } },
    ]);

    // Aggregate Decisions
    const decisionMatch = { sourceMeetingId: { $in: meetingIds } };
    if (orgId) decisionMatch.organization = orgId;

    const decisionsCount = await Decision.aggregate([
      { $match: decisionMatch },
      { $group: { _id: "$sourceMeetingId", count: { $sum: 1 } } },
    ]);

    const actionItemMap = {};
    actionItemsCount.forEach((item) => {
      actionItemMap[item._id.toString()] = item.count;
    });

    const decisionMap = {};
    decisionsCount.forEach((item) => {
      decisionMap[item._id.toString()] = item.count;
    });

    const driftData = meetings.map((m) => ({
      meetingId: m._id,
      occurrence: m.seriesOccurrence,
      date: m.date,
      duration: m.duration || 0,
      attendanceCount: m.participants ? m.participants.length : 0,
      actionItemCount: actionItemMap[m._id.toString()] || 0,
      decisionCount: decisionMap[m._id.toString()] || 0,
    }));

    let summary = null;
    if (driftData.length > 1) {
      const first = driftData[0];
      const last = driftData[driftData.length - 1];
      summary = {
        durationChange: last.duration - first.duration,
        attendanceChange: last.attendanceCount - first.attendanceCount,
        actionItemChange: last.actionItemCount - first.actionItemCount,
        decisionChange: last.decisionCount - first.decisionCount,
      };
    }

    res.json({ success: true, drift: driftData, summary });
  } catch (error) {
    console.error("Error calculating meeting series drift:", error);
    res.status(500).json({
      success: false,
      message: "Server error calculating meeting series drift",
    });
  }
};
