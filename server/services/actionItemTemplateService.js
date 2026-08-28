import ActionItemTemplate from "../models/actionItemTemplateModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";

/**
 * Fetch all templates for an organization
 */
export const getTemplates = async (organizationId) => {
  return ActionItemTemplate.find({ organization: organizationId }).sort({
    createdAt: -1,
  });
};

/**
 * Fetch a specific template
 */
export const getTemplateById = async (id, organizationId) => {
  return ActionItemTemplate.findOne({ _id: id, organization: organizationId });
};

/**
 * Create a new template
 */
export const createTemplate = async (templateData, organizationId, userId) => {
  const template = new ActionItemTemplate({
    ...templateData,
    organization: organizationId,
    createdBy: userId,
  });
  return template.save();
};

/**
 * Update a template
 */
export const updateTemplate = async (id, templateData, organizationId) => {
  return ActionItemTemplate.findOneAndUpdate(
    { _id: id, organization: organizationId },
    { $set: templateData },
    { new: true },
  );
};

/**
 * Delete a template
 */
export const deleteTemplate = async (id, organizationId) => {
  return ActionItemTemplate.findOneAndDelete({
    _id: id,
    organization: organizationId,
  });
};

/**
 * Apply a specific template to a meeting
 * Generates ActionItems from the template items
 */
export const applyTemplateToMeeting = async (
  templateId,
  meetingId,
  assignedByUserId,
) => {
  const template = await ActionItemTemplate.findById(templateId);
  const meeting =
    await Meeting.findById(meetingId).populate("participants.user");

  if (!template || !meeting) {
    throw new Error("Template or Meeting not found");
  }

  const actionItemsToCreate = template.items.map((item) => {
    // Resolve default owner by role
    let assigneeId = null;
    let assigneeName = "Unassigned";

    if (item.defaultOwnerRole && item.defaultOwnerRole !== "Unassigned") {
      const matchedParticipant = meeting.participants.find(
        (p) =>
          p.role &&
          p.role.toLowerCase() === item.defaultOwnerRole.toLowerCase(),
      );
      if (matchedParticipant && matchedParticipant.user) {
        assigneeId = matchedParticipant.user._id || matchedParticipant.user;
        assigneeName = matchedParticipant.name || "Unassigned";
      }
    }

    // Calculate due date
    const dueDate = new Date(meeting.date);
    dueDate.setDate(dueDate.getDate() + (item.daysToComplete || 7));

    return {
      text: item.text,
      description: item.description,
      owner: assigneeName,
      assignee: assigneeId,
      assignedBy: assignedByUserId,
      sourceMeetingId: meeting._id,
      organization: meeting.organization,
      dueDate: dueDate,
      status: "pending",
    };
  });

  if (actionItemsToCreate.length > 0) {
    await ActionItem.insertMany(actionItemsToCreate);
  }

  return actionItemsToCreate.length;
};

/**
 * Automatically apply matching templates for a newly created meeting
 */
export const applyAutomaticTemplates = async (meetingId, createdByUserId) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return 0;

  const templates = await ActionItemTemplate.find({
    organization: meeting.organization,
    $or: [
      { applicableMeetingTypes: meeting.meetingType },
      { applicableSeriesIds: meeting.series },
    ],
  });

  let totalItemsCreated = 0;
  for (const template of templates) {
    try {
      const createdCount = await applyTemplateToMeeting(
        template._id,
        meeting._id,
        createdByUserId,
      );
      totalItemsCreated += createdCount;
    } catch (error) {
      console.error(
        `Error applying template ${template._id} to meeting ${meeting._id}:`,
        error,
      );
    }
  }

  return totalItemsCreated;
};
