import { z } from "zod";
import MeetingSeries from "../models/meetingSeriesModel.js";
import Meeting from "../models/meetingModel.js";
import { parseISO, addDays, addWeeks, addMonths } from "date-fns";
import { parsePagination } from "../utils/pagination.js";

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
  time: z.string().min(1, "Time is required"),
  duration: z.number().optional().default(60),
  location: z.string().optional(),
  venue: z.string().optional(),
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
      participants,
      agendaItems,
    } = validatedData;

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    const series = new MeetingSeries({
      title,
      organization: req.user.organization,
      createdBy: req.user._id,
      recurrencePattern,
      dayOfWeek,
      dayOfMonth,
      startDate: start,
      endDate: end,
      time,
      duration,
    });

    await series.save();

    // Generate occurrences
    let currentDate = start;
    let occurrence = 1;
    const meetingsToCreate = [];

    // Limit to max 50 occurrences to prevent infinite loops / memory issues
    const MAX_OCCURRENCES = 50;

    while (currentDate <= end && occurrence <= MAX_OCCURRENCES) {
      meetingsToCreate.push({
        uploadedBy: req.user._id,
        organization: req.user.organization,
        title,
        description,
        meetingType,
        date: currentDate,
        time,
        duration,
        location,
        venue,
        participants,
        agendaItems,
        series: series._id,
        seriesOccurrence: occurrence,
      });

      if (recurrencePattern === "daily") {
        currentDate = addDays(currentDate, 1);
      } else if (recurrencePattern === "weekly") {
        currentDate = addWeeks(currentDate, 1);
      } else if (recurrencePattern === "biweekly") {
        currentDate = addWeeks(currentDate, 2);
      } else if (recurrencePattern === "monthly") {
        currentDate = addMonths(currentDate, 1);
      }

      occurrence++;
    }

    const createdMeetings = await Meeting.insertMany(meetingsToCreate);

    res.status(201).json({
      success: true,
      series,
      meetingsCreated: createdMeetings.length,
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

    // Delete future un-started meetings in the series
    const result = await Meeting.deleteMany({
      series: series._id,
      date: { $gte: new Date() },
      status: "uploaded", // Only delete if they haven't been started/processed
    });

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
