import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import ReportTemplate from "../models/reportTemplateModel.js";

export const generateReport = async (
  templateId,
  filterOverrides,
  user,
  orgId,
) => {
  const template = await ReportTemplate.findById(templateId);
  if (!template) {
    throw new Error("Report Template not found");
  }

  // Check RBAC
  if (
    !template.isShared &&
    template.createdBy.toString() !== user._id.toString()
  ) {
    throw new Error("You do not have permission to view this report template.");
  }
  if (template.organization.toString() !== orgId) {
    throw new Error("Report Template not found in your organization.");
  }

  // Increment generation count
  template.generationCount += 1;
  await template.save();

  // 1. Resolve Filters
  const dateRangeDays =
    filterOverrides?.dateRangeDays || template.defaultFilters.dateRangeDays;
  const tags = filterOverrides?.tags?.length
    ? filterOverrides.tags
    : template.defaultFilters.tags;
  const meetingTypes = filterOverrides?.meetingTypes?.length
    ? filterOverrides.meetingTypes
    : template.defaultFilters.meetingTypes;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRangeDays);

  const meetingQuery = {
    organization: orgId,
    date: { $gte: startDate },
  };

  if (tags && tags.length > 0) {
    meetingQuery.tags = { $in: tags };
  }

  if (meetingTypes && meetingTypes.length > 0) {
    meetingQuery.meetingType = { $in: meetingTypes };
  }

  // 2. Fetch Base Meetings
  const meetings = await Meeting.find(meetingQuery).sort({ date: -1 }).lean();

  const meetingIds = meetings.map((m) => m._id);

  // 3. Aggregate Data per Section
  const reportData = {
    templateName: template.name,
    description: template.description,
    generatedAt: new Date(),
    meetingCount: meetings.length,
    sections: [],
  };

  for (const section of template.sections) {
    const sectionResult = {
      id: section._id,
      type: section.type,
      title: section.title,
      order: section.order,
      data: null,
    };

    switch (section.type) {
      case "ACTION_ITEMS":
        const actionItems = await ActionItem.find({
          sourceMeetingId: { $in: meetingIds },
        })
          .populate("sourceMeetingId", "title date")
          .lean();
        sectionResult.data = actionItems.map((item) => ({
          text: item.text,
          owner: item.owner,
          status: item.status,
          dueDate: item.dueDate,
          meetingTitle: item.sourceMeetingId?.title,
          meetingDate: item.sourceMeetingId?.date,
        }));
        break;

      case "DECISION_LOG":
        const decisions = await Decision.find({
          sourceMeetingId: { $in: meetingIds },
        })
          .populate("sourceMeetingId", "title date")
          .lean();
        sectionResult.data = decisions.map((dec) => ({
          text: dec.text,
          status: dec.status,
          approver: dec.approver,
          meetingTitle: dec.sourceMeetingId?.title,
          meetingDate: dec.sourceMeetingId?.date,
        }));
        break;

      case "ATTENDANCE_HEATMAP":
        // Aggregate participants across meetings
        const participantCounts = {};
        meetings.forEach((m) => {
          m.participants?.forEach((p) => {
            if (p.name) {
              if (!participantCounts[p.name]) {
                participantCounts[p.name] = {
                  name: p.name,
                  meetingsAttended: 0,
                };
              }
              participantCounts[p.name].meetingsAttended += 1;
            }
          });
        });
        // Convert to array and sort by attendance
        sectionResult.data = Object.values(participantCounts).sort(
          (a, b) => b.meetingsAttended - a.meetingsAttended,
        );
        break;

      case "SENTIMENT_TIMELINE":
        // Since sentiment is not standard, we'll mock a timeline based on meeting dates or health scores if present
        // We'll just group by date and count meetings for now as a simple fallback
        const timeline = {};
        meetings.forEach((m) => {
          const dateStr = m.date.toISOString().split("T")[0];
          timeline[dateStr] = (timeline[dateStr] || 0) + 1;
        });
        sectionResult.data = Object.keys(timeline).map((date) => ({
          date,
          value: timeline[date], // Mocking some value
        }));
        break;

      case "CUSTOM_TEXT":
        sectionResult.data = {
          text: section.config?.text || "No custom text provided.",
        };
        break;

      default:
        sectionResult.data = { message: "Unknown section type" };
    }

    reportData.sections.push(sectionResult);
  }

  // Sort sections by order
  reportData.sections.sort((a, b) => a.order - b.order);

  return reportData;
};
