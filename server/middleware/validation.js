/**
 * Input Validation Middleware for Meeting Creation
 * 
 * Provides comprehensive validation for meeting creation endpoints
 * using Joi schema validation.
 */

import Joi from "joi";
import { Types } from "mongoose";

// ============================================================================
// CUSTOM VALIDATORS
// ============================================================================

const objectId = (value, helpers) => {
  if (!Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const isDateInFuture = (value, helpers) => {
  const date = new Date(value);
  if (date < new Date()) {
    return helpers.error("date.future");
  }
  return value;
};

const isValidUrl = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch {
    return helpers.error("string.uri");
  }
};

// ============================================================================
// JOI SCHEMAS
// ============================================================================

// Meeting Creation Schema
const meetingSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .required()
    .trim()
    .messages({
      "string.empty": "Meeting title cannot be empty",
      "string.min": "Meeting title must be at least {#limit} characters",
      "string.max": "Meeting title cannot exceed {#limit} characters",
      "any.required": "Meeting title is required",
    }),

  description: Joi.string()
    .max(2000)
    .allow("")
    .trim()
    .messages({
      "string.max": "Meeting description cannot exceed {#limit} characters",
    }),

  organizationId: Joi.string()
    .custom(objectId, "ObjectId validation")
    .required()
    .messages({
      "any.invalid": "Invalid organization ID format",
      "any.required": "Organization ID is required",
    }),

  date: Joi.date()
    .required()
    .messages({
      "date.base": "Invalid date format",
      "any.required": "Meeting date is required",
    }),

  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      "string.pattern.base": "Start time must be in HH:MM format",
      "any.required": "Start time is required",
    }),

  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      "string.pattern.base": "End time must be in HH:MM format",
      "any.required": "End time is required",
    }),

  agenda: Joi.array()
    .items(
      Joi.string()
        .min(1)
        .max(500)
        .trim()
        .messages({
          "string.empty": "Agenda item cannot be empty",
          "string.max": "Agenda item cannot exceed {#limit} characters",
        })
    )
    .max(50)
    .default([])
    .messages({
      "array.max": "Cannot have more than {#limit} agenda items",
    }),

  participants: Joi.array()
    .items(
      Joi.string()
        .email()
        .messages({
          "string.email": "Invalid email format for participant",
        })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one participant is required",
      "any.required": "Participants are required",
    }),

  meetingLink: Joi.string()
    .custom(isValidUrl, "URL validation")
    .allow("")
    .messages({
      "string.uri": "Invalid meeting link URL",
    }),

  location: Joi.string()
    .max(200)
    .allow("")
    .trim()
    .messages({
      "string.max": "Location cannot exceed {#limit} characters",
    }),

  isVirtual: Joi.boolean().default(false),

  tags: Joi.array()
    .items(
      Joi.string()
        .min(1)
        .max(30)
        .trim()
        .pattern(/^[a-zA-Z0-9\-_]+$/)
        .messages({
          "string.pattern.base": "Tags can only contain letters, numbers, hyphens, and underscores",
          "string.max": "Tag cannot exceed {#limit} characters",
        })
    )
    .max(10)
    .default([]),

  priority: Joi.string()
    .valid("low", "medium", "high", "critical")
    .default("medium"),

  recurring: Joi.object({
    enabled: Joi.boolean().default(false),
    frequency: Joi.string()
      .valid("daily", "weekly", "monthly", "yearly")
      .when("enabled", { is: true, then: Joi.required() }),
    interval: Joi.number()
      .min(1)
      .max(100)
      .when("enabled", { is: true, then: Joi.required() }),
    endDate: Joi.date()
      .greater(Joi.ref("date"))
      .when("enabled", { is: true, then: Joi.required() }),
  }).default(),

  attachments: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().custom(isValidUrl, "URL validation").required(),
        type: Joi.string().valid("pdf", "doc", "docx", "image", "other"),
        size: Joi.number().max(10485760).messages({
          "number.max": "Attachment size cannot exceed 10MB",
        }),
      })
    )
    .max(10),

  timezone: Joi.string()
    .pattern(/^[A-Za-Z]+\/[A-Za-z_]+$/)
    .default("UTC")
    .messages({
      "string.pattern.base": "Invalid timezone format. Use format: Continent/City",
    }),

}).custom((value, helpers) => {
  // Validate that end time is after start time
  if (value.startTime && value.endTime) {
    const [startHour, startMin] = value.startTime.split(":").map(Number);
    const [endHour, endMin] = value.endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    if (endMinutes <= startMinutes) {
      return helpers.error("any.invalid", {
        message: "End time must be after start time",
      });
    }
  }
  return value;
});

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export const validateMeeting = (req, res, next) => {
  const { error, value } = meetingSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Replace req.body with validated and sanitized data
  req.body = value;
  next();
};

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

export const sanitizeInput = (input) => {
  if (typeof input === "string") {
    return input
      .trim()
      .replace(/[<>]/g, "") // Remove < and > to prevent XSS
      .replace(/\s+/g, " "); // Remove extra spaces
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }
  if (typeof input === "object" && input !== null) {
    const sanitized = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
};

// ============================================================================
// MEETING QUERY VALIDATION
// ============================================================================

export const validateMeetingQuery = (req, res, next) => {
  const querySchema = Joi.object({
    organizationId: Joi.string().custom(objectId, "ObjectId validation"),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref("startDate")),
    status: Joi.string().valid("scheduled", "ongoing", "completed", "cancelled"),
    limit: Joi.number().min(1).max(100).default(50),
    page: Joi.number().min(1).default(1),
    sortBy: Joi.string().valid("date", "title", "createdAt").default("date"),
    sortOrder: Joi.string().valid("asc", "desc").default("asc"),
    search: Joi.string().max(100).allow(""),
  });

  const { error, value } = querySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    });
  }

  req.query = value;
  next();
};

// ============================================================================
// MEETING UPDATE VALIDATION
// ============================================================================

export const validateMeetingUpdate = (req, res, next) => {
  const updateSchema = meetingSchema
    .fork(
      ["organizationId", "date", "startTime", "endTime", "participants"],
      (schema) => schema.optional()
    )
    .min(1)
    .messages({
      "object.min": "At least one field to update is required",
    });

  const { error, value } = updateSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    });
  }

  req.body = value;
  next();
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  validateMeeting,
  validateMeetingQuery,
  validateMeetingUpdate,
  sanitizeInput,
  meetingSchema,
};