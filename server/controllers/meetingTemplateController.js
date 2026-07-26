import MeetingTemplate from "../models/meetingTemplateModel.js";

// @desc    Create a new meeting template
// @route   POST /api/templates
// @access  Private (Org Admin)
export const createTemplate = async (req, res) => {
  try {
    const { title, agendaBlocks } = req.body;
    const organizationId = req.user.organization; // Assuming user has organization ref

    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization ID is required" });
    }

    const template = await MeetingTemplate.create({
      title,
      organizationId,
      agendaBlocks: agendaBlocks || [],
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
      return res.status(200).json({ success: true, templates: [] }); // User without org
    }

    const templates = await MeetingTemplate.find({ organizationId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a template
// @route   PUT /api/templates/:id
// @access  Private (Org Admin)
export const updateTemplate = async (req, res) => {
  try {
    const { title, agendaBlocks } = req.body;
    const templateId = req.params.id;

    const template = await MeetingTemplate.findById(templateId);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Ensure user's org matches template's org
    if (
      template.organizationId.toString() !== req.user.organization.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this template",
      });
    }

    if (title) template.title = title;
    if (agendaBlocks) template.agendaBlocks = agendaBlocks;

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
