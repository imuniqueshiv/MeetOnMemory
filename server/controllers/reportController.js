import mongoose from "mongoose";
import { z } from "zod";
import ReportTemplate from "../models/reportTemplateModel.js";
import { generateReport } from "../services/reportGeneratorService.js";
import { isSameOrganization } from "../utils/organizationScope.js";
import { AppError } from "../utils/errors.js";

// Validation Schemas
const sectionSchema = z.object({
  type: z.enum([
    "ACTION_ITEMS",
    "ATTENDANCE_HEATMAP",
    "DECISION_LOG",
    "SENTIMENT_TIMELINE",
    "CUSTOM_TEXT",
  ]),
  title: z.string().min(1),
  order: z.number().int().min(0),
  config: z.any().optional(),
});

const reportTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sections: z.array(sectionSchema).optional(),
  defaultFilters: z
    .object({
      dateRangeDays: z.number().int().min(1).optional(),
      tags: z.array(z.string()).optional(),
      meetingTypes: z.array(z.string()).optional(),
    })
    .optional(),
  isShared: z.boolean().optional(),
});

/**
 * Organization context for the caller (Issue #1272).
 *
 * Every handler in this file used to read `req.user.currentOrganization`. No
 * middleware, model field or service ever wrote that property — `userModel`
 * calls it `organization`, and `requireOrgMembership` only asserts that
 * `req.user.organization` is truthy. So `orgId` was permanently `undefined`,
 * and the whole feature answered `400 Organization context required` on the two
 * routes that checked for it and 404 on the rest.
 *
 * The router now guarantees membership before any handler runs, so this is a
 * plain read rather than another place to re-check it.
 */
const callerOrganization = (req) => req.user?.organization;

/**
 * Rejects a `:id` that Mongoose would throw a `CastError` on.
 *
 * `ReportTemplate.findById("not-an-id")` rejects, and every handler funnels
 * rejections into a generic 500. A malformed id is a client mistake and belongs
 * in the 400 family.
 */
const invalidTemplateId = (res, id) => {
  if (mongoose.Types.ObjectId.isValid(id)) return false;

  res.status(400).json({ success: false, message: "Invalid template ID" });
  return true;
};

/**
 * Loads a template the caller is allowed to *see*.
 *
 * Returns `null` after responding, so callers can `if (!template) return;`.
 *
 * The organization check deliberately produces the same 404 as a missing
 * template: telling a caller "this exists, but not for you" confirms the id is
 * real. The creator check is a 403 because by that point the caller has already
 * been established as a member of the owning organization.
 */
const loadVisibleTemplate = async (req, res) => {
  const { id } = req.params;
  if (invalidTemplateId(res, id)) return null;

  const template = await ReportTemplate.findById(id);

  if (
    !template ||
    !isSameOrganization(template.organization, callerOrganization(req))
  ) {
    res.status(404).json({ success: false, message: "Template not found" });
    return null;
  }

  if (
    !template.isShared &&
    template.createdBy.toString() !== req.user._id.toString()
  ) {
    res.status(403).json({
      success: false,
      message: "Not authorized to view this template",
    });
    return null;
  }

  return template;
};

/**
 * Loads a template the caller is allowed to *modify*.
 *
 * Sharing a template grants read access, not write access — only the creator
 * may edit or delete, which is why this cannot reuse `loadVisibleTemplate`.
 */
const loadEditableTemplate = async (req, res, action) => {
  const { id } = req.params;
  if (invalidTemplateId(res, id)) return null;

  const template = await ReportTemplate.findById(id);

  if (
    !template ||
    !isSameOrganization(template.organization, callerOrganization(req))
  ) {
    res.status(404).json({ success: false, message: "Template not found" });
    return null;
  }

  if (template.createdBy.toString() !== req.user._id.toString()) {
    res.status(403).json({
      success: false,
      message: `Not authorized to ${action} this template`,
    });
    return null;
  }

  return template;
};

const sendValidationError = (res, error) =>
  res.status(400).json({
    success: false,
    message: "Validation error",
    errors: error.errors,
  });

// @desc    Get all report templates for the organization
// @route   GET /api/reports/templates
// @access  Private (reports:view)
export const getReportTemplates = async (req, res) => {
  try {
    const orgId = callerOrganization(req);

    // Fetch templates created by the user or shared within the org
    const templates = await ReportTemplate.find({
      organization: orgId,
      $or: [{ createdBy: req.user._id }, { isShared: true }],
    }).sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("Error fetching report templates:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get a single report template
// @route   GET /api/reports/templates/:id
// @access  Private (reports:view)
export const getReportTemplate = async (req, res) => {
  try {
    const template = await loadVisibleTemplate(req, res);
    if (!template) return;

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error("Error fetching report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new report template
// @route   POST /api/reports/templates
// @access  Private (reports:view)
export const createReportTemplate = async (req, res) => {
  try {
    const validatedData = reportTemplateSchema.parse(req.body);

    // `organization` and `createdBy` are applied last so a body carrying either
    // key cannot re-parent the template or forge its author.
    const template = await ReportTemplate.create({
      ...validatedData,
      organization: callerOrganization(req),
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendValidationError(res, error);
    }
    console.error("Error creating report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a report template
// @route   PUT /api/reports/templates/:id
// @access  Private (reports:view, creator only)
export const updateReportTemplate = async (req, res) => {
  try {
    const validatedData = reportTemplateSchema.parse(req.body);

    const template = await loadEditableTemplate(req, res, "edit");
    if (!template) return;

    // `validatedData` is the parsed schema output, not `req.body`, so keys the
    // schema does not declare — `organization`, `createdBy`, `generationCount` —
    // are dropped rather than assigned.
    Object.assign(template, validatedData);
    await template.save();

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendValidationError(res, error);
    }
    console.error("Error updating report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a report template
// @route   DELETE /api/reports/templates/:id
// @access  Private (reports:view, creator only)
export const deleteReportTemplate = async (req, res) => {
  try {
    const template = await loadEditableTemplate(req, res, "delete");
    if (!template) return;

    await template.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Generate report data based on template
// @route   POST /api/reports/generate/:id
// @access  Private (reports:view)
export const generateReportData = async (req, res) => {
  try {
    const templateId = req.params.id;
    if (invalidTemplateId(res, templateId)) return;

    const filterOverrides = req.body?.filterOverrides || {};

    const reportData = await generateReport(
      templateId,
      filterOverrides,
      req.user,
      callerOrganization(req),
    );

    res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    // Map on the error's own status, not on the wording of its message.
    //
    // This was a chain of `error.message.includes("permission" | "authorized" |
    // "not found")`. Two things were wrong with that. Rewording a message in
    // the service silently turned a deliberate 403 into a 500, with nothing to
    // connect the two edits. And the reverse held as well: any unrelated
    // failure whose message happened to contain "not found" — a driver error,
    // a populate on a missing ref — was reported to the client as a 404.
    //
    // The service now throws the typed errors from `utils/errors.js`, so the
    // status travels with the error instead of being re-derived from prose.
    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    console.error("Error generating report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
