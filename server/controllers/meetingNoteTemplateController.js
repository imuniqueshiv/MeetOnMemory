import MeetingNoteTemplate from "../models/meetingNoteTemplateModel.js";

// @desc    Get all note templates for an organization
// @route   GET /api/note-templates
// @access  Private
export const getNoteTemplates = async (req, res) => {
  try {
    const organizationId = req.user.organization;

    if (!organizationId) {
      return res.status(200).json({ success: true, templates: [] });
    }

    const templates = await MeetingNoteTemplate.find({
      $or: [
        { visibility: "public" },
        { organizationId, visibility: "organization" },
        { createdBy: req.user._id, visibility: "private" },
      ],
    })
      .populate("createdBy", "name email")
      .sort({ useCount: -1, createdAt: -1 });

    res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error("Error fetching note templates:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new note template
// @route   POST /api/note-templates
// @access  Private
export const createNoteTemplate = async (req, res) => {
  try {
    const { name, description, sections, visibility } = req.body;
    const organizationId = req.user.organization;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Template name is required",
      });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization ID is required" });
    }

    const template = await MeetingNoteTemplate.create({
      name,
      description: description || "",
      sections: Array.isArray(sections) ? sections : [],
      visibility: visibility || "private",
      organizationId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error("Error creating note template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get a single note template by ID
// @route   GET /api/note-templates/:id
// @access  Private
export const getNoteTemplateById = async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await MeetingNoteTemplate.findById(templateId).populate(
      "createdBy",
      "name email",
    );

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Check visibility
    const isOwner =
      template.createdBy._id.toString() === req.user._id.toString();
    const isSameOrg =
      template.organizationId.toString() === req.user.organization.toString();

    if (
      (template.visibility === "private" && !isOwner) ||
      (template.visibility === "organization" && !isSameOrg)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this template",
      });
    }

    res.status(200).json({ success: true, template });
  } catch (error) {
    console.error("Error fetching note template by ID:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Apply template (increment use count and generate markdown)
// @route   POST /api/note-templates/:id/apply
// @access  Private
export const applyNoteTemplate = async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await MeetingNoteTemplate.findById(templateId);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    const isOwner = template.createdBy.toString() === req.user._id.toString();
    const isSameOrg =
      template.organizationId.toString() === req.user.organization.toString();

    if (
      (template.visibility === "private" && !isOwner) ||
      (template.visibility === "organization" && !isSameOrg)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this template",
      });
    }

    // Increment use count
    template.useCount += 1;
    await template.save();

    // Generate Markdown
    let markdown = "";
    if (template.name) {
      markdown += `<h1>${template.name}</h1>\n\n`;
    }

    template.sections.forEach((section) => {
      markdown += `<h2>${section.heading}</h2>\n`;
      if (section.defaultContent) {
        if (section.type === "checklist") {
          const items = section.defaultContent
            .split("\n")
            .filter((i) => i.trim());
          items.forEach((item) => {
            markdown += `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>${item.trim()}</p></li></ul>`;
          });
        } else {
          markdown += `<p>${section.defaultContent}</p>\n\n`;
        }
      } else {
        if (section.type === "checklist") {
          markdown += `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`;
        } else {
          markdown += `<p></p>\n\n`;
        }
      }
    });

    res.status(200).json({ success: true, markdown });
  } catch (error) {
    console.error("Error applying note template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a note template
// @route   PUT /api/note-templates/:id
// @access  Private
export const updateNoteTemplate = async (req, res) => {
  try {
    const { name, description, sections, visibility } = req.body;
    const templateId = req.params.id;

    const template = await MeetingNoteTemplate.findById(templateId);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    if (template.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this template",
      });
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (Array.isArray(sections)) template.sections = sections;
    if (visibility) template.visibility = visibility;

    const updatedTemplate = await template.save();
    res.status(200).json({ success: true, template: updatedTemplate });
  } catch (error) {
    console.error("Error updating note template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a note template
// @route   DELETE /api/note-templates/:id
// @access  Private
export const deleteNoteTemplate = async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await MeetingNoteTemplate.findById(templateId);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    if (template.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this template",
      });
    }

    await template.deleteOne();
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    console.error("Error deleting note template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
