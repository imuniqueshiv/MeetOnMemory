import { z } from "zod";
import mongoose from "mongoose";

const textField = (max, label) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const objectId = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Invalid user ID",
  });

const participantSchema = z
  .object({
    user: objectId.optional(),
    name: textField(200, "Participant name").min(
      1,
      "Participant name is required",
    ),
    email: z
      .string()
      .trim()
      .email("Invalid participant email")
      .max(320)
      .optional()
      .default(""),
    role: textField(100, "Participant role").optional().default(""),
  })
  .strict();

const agendaItemSchema = z
  .object({
    text: textField(500, "Agenda item text").min(
      1,
      "Agenda item text is required",
    ),
    description: textField(2000, "Agenda item description")
      .optional()
      .default(""),
    duration: z
      .number()
      .finite()
      .int()
      .min(0, "Agenda duration cannot be negative")
      .max(1440, "Agenda duration cannot exceed 1440 minutes")
      .nullable()
      .optional()
      .default(null),
    position: z.number().int().min(0).max(10000).optional(),
  })
  .strict();

export const createMeetingSchema = z
  .object({
    title: textField(200, "Meeting title").min(1, "Meeting title is required"),
    description: textField(5000, "Meeting description").optional().default(""),
    meetingType: z
      .enum(["conference", "policy", "event", "internal", "external", "board"])
      .optional()
      .default("conference"),
    date: z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Meeting date must be a valid ISO-compatible date",
      })
      .optional(),
    time: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
        message: "Meeting time must use HH:mm format",
      })
      .optional()
      .default(""),
    duration: z
      .number()
      .finite()
      .int()
      .min(1, "Meeting duration must be at least 1 minute")
      .max(1440, "Meeting duration cannot exceed 1440 minutes")
      .nullable()
      .optional()
      .default(null),
    location: textField(500, "Meeting location").optional().default(""),
    venue: textField(1000, "Meeting venue").optional().default(""),
    venueCoordinates: z
      .object({
        lat: z.number().finite().nullable().optional(),
        lng: z.number().finite().nullable().optional(),
      })
      .nullable()
      .optional()
      .default(null),
    participants: z
      .array(participantSchema)
      .max(500, "A meeting cannot have more than 500 participants")
      .optional()
      .default([]),
    agendaItems: z
      .array(agendaItemSchema)
      .max(200, "A meeting cannot have more than 200 agenda items")
      .optional()
      .default([]),
    policyDetails: z
      .object({
        policyName: textField(200, "Policy name").optional(),
        policyVersion: textField(100, "Policy version").optional(),
        effectiveDate: z
          .string()
          .refine((value) => !Number.isNaN(Date.parse(value)), {
            message: "Policy effective date must be valid",
          })
          .nullable()
          .optional(),
        approvalRequired: z.boolean().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    recordingType: z.enum(["upload", "live"]).optional().default("upload"),
    syncToCalendar: z.boolean().optional().default(false),
    auditNote: z.string().optional().default(""),
    tags: z.array(z.string().trim().max(100)).optional().default([]),
  })
  .strict();

export const validateCreateMeeting = (req, res, next) => {
  const result = createMeetingSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid meeting data",
      errors: result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
  }

  req.body = result.data;
  return next();
};
