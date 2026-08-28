import express from "express";
import ExportTemplate from "../models/ExportTemplate.js";
import DataExtractor from "../services/dataExtractor.js";
import DocumentGenerator from "../services/documentGenerator.js";
import userAuth from "../middleware/userAuth.js";
import { resolveAccessibleMeeting } from "../utils/resolveAccessibleMeeting.js";

const router = express.Router();
router.use(userAuth);

const VALID_FORMATS = ["pdf", "docx", "html", "md"];

/**
 * Helper to get active user organization ID
 */
const getUserOrgId = (user) => {
  if (!user) return null;
  const org =
    user.organization?._id || user.organization || user.organizationId;
  return org ? org.toString() : null;
};

/**
 * Helper to verify template access for an authenticated user
 */
const verifyTemplateAccess = (template, user) => {
  if (!template || !user) return false;

  const userOrgId = getUserOrgId(user);
  const templateOrgId = (
    template.organization || template.organizationId
  )?.toString();

  // Enforce organization scoping: if template has an org set, caller must belong to same org
  if (templateOrgId && userOrgId && templateOrgId !== userOrgId) {
    return false;
  }

  // System admin / owner bypass
  if (user.role === "admin" || user.role === "owner") return true;

  // Creator access
  const userIdStr = user._id
    ? user._id.toString()
    : user.id
      ? user.id.toString()
      : null;
  if (
    template.createdBy &&
    userIdStr &&
    template.createdBy.toString() === userIdStr
  ) {
    return true;
  }

  // Public in same org
  if (template.isPublic) return true;

  // Team-scoped templates
  if (
    template.teamId &&
    user.teamId &&
    template.teamId.toString() === user.teamId.toString()
  ) {
    return true;
  }

  return false;
};

// GET / and GET /templates - List accessible export templates
const listTemplates = async (req, res) => {
  try {
    const userOrgId = getUserOrgId(req.user);
    const userId = req.user._id || req.user.id;

    const orgFilter = userOrgId
      ? [{ organization: userOrgId }, { organizationId: userOrgId }]
      : [];

    const templates = await ExportTemplate.find({
      $and: [
        orgFilter.length > 0 ? { $or: orgFilter } : {},
        {
          $or: [
            { isPublic: true },
            { createdBy: userId },
            ...(req.user.teamId ? [{ teamId: req.user.teamId }] : []),
          ],
        },
      ],
    }).sort({ usageCount: -1 });

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("Error listing export templates:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// POST / and POST /templates - Create a new custom export template
const createTemplate = async (req, res) => {
  try {
    const userOrgId = getUserOrgId(req.user);
    const userId = req.user._id || req.user.id;

    if (!req.body.name || !req.body.templateContent) {
      return res.status(400).json({
        success: false,
        error: "Template name and templateContent are required.",
      });
    }

    const template = await ExportTemplate.create({
      ...req.body,
      createdBy: userId,
      organization: userOrgId,
      organizationId: userOrgId,
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// GET /:id and GET /templates/:id - Get template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await ExportTemplate.findById(id);

    if (!template || !verifyTemplateAccess(template, req.user)) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to template" });
    }

    res.status(200).json({ success: true, data: template });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// PUT /:id and PUT /templates/:id - Update template by ID
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await ExportTemplate.findById(id);

    if (!template || !verifyTemplateAccess(template, req.user)) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to template" });
    }

    const updated = await ExportTemplate.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// DELETE /:id and DELETE /templates/:id - Delete template by ID
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await ExportTemplate.findById(id);

    if (!template || !verifyTemplateAccess(template, req.user)) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to template" });
    }

    await ExportTemplate.findByIdAndDelete(id);
    res.status(200).json({ success: true, data: {} });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// POST /meeting/:meetingId - Generate meeting export with template
const exportMeetingWithTemplate = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { templateId, format, sectionOverrides } = req.body;

    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({
        success: false,
        error: "Invalid export format. Must be pdf, docx, html, or md.",
      });
    }

    // 1. AuthZ Meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, error: access.error.message });
    }

    // 2. AuthZ Template
    const template = await ExportTemplate.findById(templateId);
    if (!template || !verifyTemplateAccess(template, req.user)) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to template" });
    }

    // 3. Extract & Filter
    let data = await DataExtractor.extractMeetingData(meetingId);
    const activeSections = { ...template.sections, ...sectionOverrides };
    data = DataExtractor.applySectionFilters(data, activeSections);

    // 4. Render
    const htmlContent = DocumentGenerator.renderHTML(
      template.templateContent,
      data,
    );
    const fullHTML = `<!DOCTYPE html><html><head><style>${template.styles || ""}</style></head><body>${htmlContent}</body></html>`;

    let buffer, contentType, extension;

    if (format === "pdf") {
      buffer = await DocumentGenerator.generatePDF(fullHTML, template.branding);
      contentType = "application/pdf";
      extension = "pdf";
    } else if (format === "docx") {
      buffer = await DocumentGenerator.generateDOCX(
        fullHTML,
        template.branding,
      );
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    } else if (format === "md") {
      // Convert rendered HTML to plain Markdown text
      const mdContent = htmlContent
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      buffer = Buffer.from(mdContent, 'utf-8');
      contentType = "text/markdown";
      extension = "md";
    } else {
      buffer = Buffer.from(fullHTML);
      contentType = "text/html";
      extension = "html";
    }

    await ExportTemplate.updateOne(
      { _id: templateId },
      { $inc: { usageCount: 1 } },
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="meeting-minutes-${meetingId}.${extension}"`,
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate export",
    });
  }
};

// POST /preview and POST /templates/preview - Preview rendered template HTML
const previewTemplate = async (req, res) => {
  try {
    const { templateContent, meetingData } = req.body;
    if (!templateContent) {
      return res
        .status(400)
        .json({ success: false, error: "templateContent is required." });
    }
    const rawHtml = DocumentGenerator.renderHTML(
      templateContent,
      meetingData || {},
    );
    const safeHtml = DocumentGenerator.sanitizeHTML(rawHtml);
    res.status(200).json({ success: true, data: { html: safeHtml } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Register Routes
router.get("/templates", listTemplates);
router.get("/", listTemplates);

router.post("/templates", createTemplate);
router.post("/", createTemplate);

router.get("/templates/:id", getTemplateById);
router.get("/:id", getTemplateById);

router.put("/templates/:id", updateTemplate);
router.put("/:id", updateTemplate);

router.delete("/templates/:id", deleteTemplate);
router.delete("/:id", deleteTemplate);

router.post("/meeting/:meetingId", exportMeetingWithTemplate);

router.post("/templates/preview", previewTemplate);
router.post("/preview", previewTemplate);

export default router;
