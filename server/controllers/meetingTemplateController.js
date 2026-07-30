import MeetingTemplate from "../models/meetingTemplateModel.js";

// @desc    Create a new meeting template
// @route   POST /api/templates
// @access  Private (Org Admin)
export const createTemplate = async (req, res) => {
  try {
    const {
      name,
      title,
      description,
      category,
      defaultDuration,
      agendaBlocks,
      defaultParticipants,
    } = req.body;
    const organizationId = req.user.organization;

    const templateName = name || title;
    if (!templateName) {
      return res.status(400).json({
        success: false,
        message: "Template name or title is required",
      });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization ID is required" });
    }

    const template = await MeetingTemplate.create({
      name: templateName,
      title: title || templateName,
      description: description || "",
      category: category || "General",
      defaultDuration: Number(defaultDuration) || 30,
      agendaBlocks: Array.isArray(agendaBlocks) ? agendaBlocks : [],
      defaultParticipants: Array.isArray(defaultParticipants)
        ? defaultParticipants
        : [],
      organizationId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error("Error creating meeting template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all templates for an organization
// @route   GET /api/templates
// @access  Private
export const getTemplates = async (req, res) => {
  try {
    const organizationId = req.user.organization;

    if (!organizationId) {
      return res.status(200).json({ success: true, templates: [] });
    }

    const templates = await MeetingTemplate.find({ organizationId })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get a single template by ID
// @route   GET /api/templates/:id
// @access  Private
export const getTemplateById = async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await MeetingTemplate.findById(templateId).populate(
      "createdBy",
      "name email",
    );

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    if (
      template.organizationId.toString() !== req.user.organization.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this template",
      });
    }

    res.status(200).json({ success: true, template });
  } catch (error) {
    console.error("Error fetching template by ID:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a template
// @route   PUT /api/templates/:id
// @access  Private (Org Admin)
export const updateTemplate = async (req, res) => {
  try {
    const {
      name,
      title,
      description,
      category,
      defaultDuration,
      agendaBlocks,
      defaultParticipants,
    } = req.body;
    const templateId = req.params.id;

    const template = await MeetingTemplate.findById(templateId);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    if (
      template.organizationId.toString() !== req.user.organization.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this template",
      });
    }

    if (name) template.name = name;
    if (title) template.title = title;
    if (description !== undefined) template.description = description;
    if (category) template.category = category;
    if (defaultDuration !== undefined)
      template.defaultDuration = Number(defaultDuration);
    if (Array.isArray(agendaBlocks)) template.agendaBlocks = agendaBlocks;
    if (Array.isArray(defaultParticipants))
      template.defaultParticipants = defaultParticipants;

    const updatedTemplate = await template.save();
    res.status(200).json({ success: true, template: updatedTemplate });
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a template
// @route   DELETE /api/templates/:id
// @access  Private (Org Admin)
export const deleteTemplate = async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await MeetingTemplate.findById(templateId);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    if (
      template.organizationId.toString() !== req.user.organization.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this template",
      });
    }

    await template.deleteOne();
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
