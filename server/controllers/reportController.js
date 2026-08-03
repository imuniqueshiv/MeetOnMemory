import { z } from "zod";
import ReportTemplate from "../models/reportTemplateModel.js";
import { generateReport } from "../services/reportGeneratorService.js";

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

// @desc    Get all report templates for the organization
// @route   GET /api/reports/templates
// @access  Private
export const getReportTemplates = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization context required" });
    }

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
// @access  Private
export const getReportTemplate = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    const template = await ReportTemplate.findById(req.params.id);

    if (!template || template.organization.toString() !== orgId) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    if (
      !template.isShared &&
      template.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this template",
      });
    }

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error("Error fetching report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new report template
// @route   POST /api/reports/templates
// @access  Private
export const createReportTemplate = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization context required" });
    }

    const validatedData = reportTemplateSchema.parse(req.body);

    const template = await ReportTemplate.create({
      ...validatedData,
      organization: orgId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }
    console.error("Error creating report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a report template
// @route   PUT /api/reports/templates/:id
// @access  Private
export const updateReportTemplate = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    const validatedData = reportTemplateSchema.parse(req.body);

    const template = await ReportTemplate.findById(req.params.id);

    if (!template || template.organization.toString() !== orgId) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Only creator can update
    if (template.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this template",
      });
    }

    Object.assign(template, validatedData);
    await template.save();

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }
    console.error("Error updating report template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a report template
// @route   DELETE /api/reports/templates/:id
// @access  Private
export const deleteReportTemplate = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    const template = await ReportTemplate.findById(req.params.id);

    if (!template || template.organization.toString() !== orgId) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Only creator can delete
    if (template.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this template",
      });
    }

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
// @access  Private
export const generateReportData = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    const templateId = req.params.id;
    const filterOverrides = req.body.filterOverrides || {};

    const reportData = await generateReport(
      templateId,
      filterOverrides,
      req.user,
      orgId,
    );

    res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    console.error("Error generating report:", error);
    if (
      error.message.includes("permission") ||
      error.message.includes("authorized")
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};
