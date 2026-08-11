import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import ReportTemplate from "../models/reportTemplateModel.js";
import { isSameOrganization } from "../utils/organizationScope.js";
import { ForbiddenError, NotFoundError } from "../utils/errors.js";

/** Fallback window when neither the override nor the template supplies one. */
const DEFAULT_DATE_RANGE_DAYS = 30;

/**
 * The single message used for "there is no such template *for you*".
 *
 * #1272 moved the organization check ahead of the sharing check so a
 * cross-tenant caller could not tell "exists elsewhere" from "does not exist" —
 * but it left the two branches with *different* messages, which gives the
 * distinction straight back. `Report Template not found in your organization.`
 * confirms the id names a real template; the generic message does not.
 *
 * One constant rather than two literals, so the two paths cannot drift apart
 * again.
 */
const TEMPLATE_NOT_FOUND = "Report Template not found";

export const generateReport = async (
  templateId,
  filterOverrides,
  user,
  orgId,
) => {
  const template = await ReportTemplate.findById(templateId);
  if (!template) {
    throw new NotFoundError(TEMPLATE_NOT_FOUND);
  }

  // Check RBAC.
  //
  // The organization check runs before the sharing check (Issue #1272), and
  // both "no such template" and "not your organization" answer identically.
  //
  // The comparison itself was `template.organization.toString() !== orgId`.
  // `orgId` arrives from the controller as an `ObjectId`, so that compared a
  // string against an `ObjectId` and was true for *every* template, including
  // the caller's own. The only reason the existing suite did not catch it is
  // that it passes `mockOrgId.toString()` by hand.
  if (!isSameOrganization(template.organization, orgId)) {
    throw new NotFoundError(TEMPLATE_NOT_FOUND);
  }

  // Reached only by a caller who is already a member of the owning
  // organization, so a 403 here reveals nothing they could not already infer.
  if (
    !template.isShared &&
    template.createdBy.toString() !== user._id.toString()
  ) {
    throw new ForbiddenError(
      "You do not have permission to view this report template.",
    );
  }

  // Increment generation count
  template.generationCount += 1;
  await template.save();

  // 1. Resolve Filters.
  //
  // `defaultFilters` is optional on documents written before it was added to
  // the schema, so each read is guarded — `template.defaultFilters.tags` on
  // such a document threw a TypeError that the controller reported as a 500.
  const defaultFilters = template.defaultFilters || {};

  const dateRangeDays =
    filterOverrides?.dateRangeDays ||
    defaultFilters.dateRangeDays ||
    DEFAULT_DATE_RANGE_DAYS;
  // `Array.isArray`, not `?.length`. With the truthiness test an override of
  // `tags: []` fell through to the template's saved tags, so a caller could add
  // filters for one run but never *clear* them — "show me everything in the
  // last 30 days" was unreachable from a template that saves a tag filter.
  // Supplying an array at all is the override; whether it is empty is the
  // caller's business.
  const tags = Array.isArray(filterOverrides?.tags)
    ? filterOverrides.tags
    : defaultFilters.tags;
  const meetingTypes = Array.isArray(filterOverrides?.meetingTypes)
    ? filterOverrides.meetingTypes
    : defaultFilters.meetingTypes;

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
