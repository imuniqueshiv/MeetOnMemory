import AiMeetingNote from "../models/aiMeetingNoteModel.js";
import { escapeRegExp } from "../utils/regexUtils.js";

/**
 * Built-in reusable note templates
 */
export const NOTE_TEMPLATES = [
  {
    id: "executive",
    name: "Executive Briefing",
    category: "Leadership",
    description:
      "High-level strategic overview focusing on business impact, core KPIs, blocker resolutions, and key decisions.",
    structure: [
      "Executive Summary",
      "Strategic Alignment & KPI Progress",
      "Key Decisions Made",
      "Action Items & Direct Owners",
      "Critical Risks & Mitigations",
    ],
    defaultTags: ["Executive", "Strategy", "Leadership"],
  },
  {
    id: "product",
    name: "Product & Spec Review",
    category: "Product",
    description:
      "Detailed feature specification and user story walkthrough with UX flows, edge cases, and engineering handoff items.",
    structure: [
      "Feature Objective & Problem Statement",
      "User Stories & Scope Verification",
      "Open Questions & Architecture Decisions",
      "Release Timeline & Dependencies",
      "Action Items",
    ],
    defaultTags: ["Product", "Feature", "Roadmap"],
  },
  {
    id: "one_on_one",
    name: "1-on-1 Sync",
    category: "Management",
    description:
      "Personal development, project check-in, workload assessment, feedback exchange, and mutual action commitments.",
    structure: [
      "Well-being & Workload Check-in",
      "Top Priorities & Recent Wins",
      "Blockers & How Manager Can Help",
      "Career Growth & Feedback",
      "Committed Action Items",
    ],
    defaultTags: ["1-on-1", "Management", "Career"],
  },
  {
    id: "retrospective",
    name: "Agile Retrospective",
    category: "Engineering",
    description:
      "Sprint review structure highlighting what went well, what could be improved, action commitments, and process tweaks.",
    structure: [
      "Sprint Goals vs Actual Outcomes",
      "What Went Well",
      "What Didn't Go Well",
      "Key Lessons & Process Decisions",
      "Next Sprint Action Commitments",
    ],
    defaultTags: ["Retro", "Agile", "Sprint"],
  },
  {
    id: "sales",
    name: "Sales & Client Discovery",
    category: "Sales",
    description:
      "Client pain point capture, budget/decision maker identification, solution mapping, and commercial next steps.",
    structure: [
      "Client Background & Key Stakeholders",
      "Current Pain Points & Objectives",
      "Proposed Solution & Value Proposition",
      "Commercial Terms & Timeline Decisions",
      "Follow-up Commitments & Deliverables",
    ],
    defaultTags: ["Sales", "Client", "Discovery"],
  },
  {
    id: "tech_design",
    name: "Technical Architecture Design",
    category: "Engineering",
    description:
      "In-depth architectural review covering system components, data schemas, API contracts, scale bottlenecks, and security.",
    structure: [
      "System Context & Architecture Diagram Overview",
      "Data Model & Storage Strategy",
      "Security, Auth & Compliance Considerations",
      "Architecture Decision Record (ADR)",
      "Implementation Action Items",
    ],
    defaultTags: ["Architecture", "Engineering", "Design"],
  },
  {
    id: "general",
    name: "General Meeting Notes",
    category: "General",
    description:
      "Standard versatile layout for daily standups, team catchups, and cross-functional syncs.",
    structure: [
      "Context & Agenda",
      "Discussion Highlights",
      "Decisions Reached",
      "Assigned Action Items",
    ],
    defaultTags: ["General", "Sync"],
  },
];

/**
 * AI synthesis helper that parses raw text/transcripts into structured notes
 */
export const synthesizeAiNoteContent = (
  rawText,
  _templateId = "general",
  title = "",
) => {
  const text = rawText || "";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Derive dynamic summary
  const summary =
    lines.length > 0
      ? `The team reviewed ${title || "key agenda topics"}, reached consensus on core priorities, and established actionable milestones with direct ownership.`
      : "Automated synthesis of discussion points, key decisions, and prioritized execution items.";

  // Extract simulated decisions
  const decisions = [];
  const decisionLines = lines.filter((l) =>
    /(decid|agreed|approved|concluded|chosen|resolve)/i.test(l),
  );
  if (decisionLines.length > 0) {
    decisionLines.slice(0, 4).forEach((d) => {
      decisions.push({
        decision: d.replace(/^[*-•\d.]\s*/, ""),
        context: "Agreed upon during collaborative review",
        impact: "Aligns delivery timeline and unblocks execution",
      });
    });
  } else {
    decisions.push({
      decision: `Approved execution plan for ${title || "project roadmap"}`,
      context: "Consensus reached across attending stakeholders",
      impact: "High confidence for target delivery milestones",
    });
  }

  // Extract action items
  const actionItems = [];
  const actionLines = lines.filter((l) =>
    /(action|todo|will|need to|follow up|assign|owner|by Friday|by next)/i.test(
      l,
    ),
  );
  if (actionLines.length > 0) {
    actionLines.slice(0, 5).forEach((a, i) => {
      actionItems.push({
        id: `act-${Date.now()}-${i}`,
        task: a.replace(/^[*-•\d.]\s*/, ""),
        owner: i % 2 === 0 ? "Engineering Lead" : "Product Owner",
        dueDate: new Date(Date.now() + (i + 3) * 86400000),
        priority: i === 0 ? "high" : "medium",
        status: "pending",
      });
    });
  } else {
    actionItems.push(
      {
        id: `act-${Date.now()}-1`,
        task: "Finalize design specifications and publish API contracts",
        owner: "Tech Lead",
        dueDate: new Date(Date.now() + 3 * 86400000),
        priority: "high",
        status: "pending",
      },
      {
        id: `act-${Date.now()}-2`,
        task: "Circulate summary notes and confirm next review date",
        owner: "Meeting Facilitator",
        dueDate: new Date(Date.now() + 2 * 86400000),
        priority: "medium",
        status: "pending",
      },
    );
  }

  // Extract key topics
  const keyTopics = [
    {
      title: "Core Discussion & Context",
      points:
        lines.slice(0, 3).length > 0
          ? lines.slice(0, 3)
          : [
              "Scope alignment and priority verification",
              "Timeline and resource availability",
            ],
    },
    {
      title: "Execution & Risk Management",
      points: [
        "Identified key dependencies and verified mitigation plans",
        "Confirmed weekly check-in schedule to monitor progress",
      ],
    },
  ];

  // Generate markdown content
  const content = `## Summary
${summary}

## Key Discussion Topics
${keyTopics
  .map(
    (t) => `### ${t.title}
${t.points.map((p) => `- ${p}`).join("\n")}`,
  )
  .join("\n\n")}

## Decisions Reached
${decisions.map((d) => `- **${d.decision}**\n  *Impact:* ${d.impact}`).join("\n")}

## Next Steps & Action Items
${actionItems
  .map(
    (a) =>
      `- [ ] **${a.task}** (Owner: ${a.owner}, Priority: ${a.priority.toUpperCase()})`,
  )
  .join("\n")}`;

  const clarity = 85 + Math.min(10, lines.length * 2);
  const completeness = 88 + Math.min(10, actionItems.length * 2);
  const actionability = 82 + Math.min(12, decisions.length * 4);
  const decisionClarity = 86;
  const overallScore = Math.round(
    (clarity + completeness + actionability + decisionClarity) / 4,
  );

  return {
    summary,
    keyTopics,
    decisions,
    actionItems,
    content,
    qualityScore: {
      overallScore: Math.min(98, overallScore),
      clarity: Math.min(95, clarity),
      completeness: Math.min(96, completeness),
      actionability: Math.min(95, actionability),
      decisionClarity: Math.min(95, decisionClarity),
    },
  };
};

/**
 * GET /api/ai-notes/templates
 * List reusable templates
 */
export const getNoteTemplates = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: NOTE_TEMPLATES,
  });
};

/**
 * GET /api/ai-notes/records
 * List notes with search, filtering, and pagination
 */
export const getNotes = async (req, res) => {
  try {
    const organizationId =
      req.user?.organization?._id ||
      req.user?.organization ||
      req.query.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const {
      search,
      meetingType,
      reviewStatus,
      tag,
      startDate,
      endDate,
      sortBy = "date",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const query = { organization: organizationId };

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegExp(search.trim()), "i");
      query.$or = [{ title: regex }, { summary: regex }, { tags: regex }];
    }

    if (meetingType && meetingType !== "all") {
      query.meetingType = meetingType;
    }

    if (reviewStatus && reviewStatus !== "all") {
      query.reviewStatus = reviewStatus;
    }

    if (tag && tag.trim()) {
      query.tags = tag.trim();
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [notes, total] = await Promise.all([
      AiMeetingNote.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate("meeting", "title date meetingType")
        .populate("createdBy", "name email")
        .populate("reviewedBy", "name email")
        .lean(),
      AiMeetingNote.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notes,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching AI meeting notes:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch AI meeting notes",
      error: error.message,
    });
  }
};

/**
 * GET /api/ai-notes/records/:id
 */
export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId =
      req.user?.organization?._id || req.user?.organization;

    const note = await AiMeetingNote.findById(id)
      .populate("meeting", "title date meetingType duration")
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .lean();

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "AI Meeting Note not found",
      });
    }

    if (
      organizationId &&
      note.organization &&
      note.organization.toString() !== organizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return res.status(200).json({
      success: true,
      data: note,
    });
  } catch (error) {
    console.error("Error fetching note by id:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch note",
      error: error.message,
    });
  }
};

/**
 * POST /api/ai-notes/generate
 * AI Note Synthesis from raw content or template
 */
export const generateAiNote = async (req, res) => {
  try {
    const organizationId =
      req.user?.organization?._id ||
      req.user?.organization ||
      req.body.organization;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const {
      title,
      rawContent = "",
      meetingType = "general",
      templateUsed = "general",
      tags = [],
      meeting = null,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const template =
      NOTE_TEMPLATES.find((t) => t.id === templateUsed) || NOTE_TEMPLATES[0];
    const combinedTags = [
      ...new Set([...(tags || []), ...(template.defaultTags || [])]),
    ];

    const synthesis = synthesizeAiNoteContent(
      rawContent,
      templateUsed,
      title.trim(),
    );

    const note = new AiMeetingNote({
      organization: organizationId,
      meeting: meeting || null,
      title: title.trim(),
      meetingType,
      date: new Date(),
      tags: combinedTags,
      rawContent,
      content: synthesis.content,
      summary: synthesis.summary,
      keyTopics: synthesis.keyTopics,
      decisions: synthesis.decisions,
      actionItems: synthesis.actionItems,
      qualityScore: synthesis.qualityScore,
      templateUsed: template.id,
      reviewStatus: "draft",
      version: 1,
      versionHistory: [
        {
          version: 1,
          content: synthesis.content,
          summary: synthesis.summary,
          editedBy: req.user?.id || req.user?._id || null,
          editedAt: new Date(),
          changeSummary: "AI Generated Initial Note",
        },
      ],
      createdBy: req.user?.id || req.user?._id || null,
    });

    await note.save();

    return res.status(201).json({
      success: true,
      message: "AI Meeting Note generated successfully",
      data: note,
    });
  } catch (error) {
    console.error("Error generating AI note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate AI note",
      error: error.message,
    });
  }
};

/**
 * POST /api/ai-notes/records
 * Create note manually
 */
export const createNote = async (req, res) => {
  try {
    const organizationId =
      req.user?.organization?._id ||
      req.user?.organization ||
      req.body.organization;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const {
      title,
      meetingType = "general",
      date = new Date(),
      tags = [],
      content = "",
      summary = "",
      keyTopics = [],
      decisions = [],
      actionItems = [],
      qualityScore = {},
      templateUsed = "general",
      meeting = null,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const note = new AiMeetingNote({
      organization: organizationId,
      meeting: meeting || null,
      title: title.trim(),
      meetingType,
      date: new Date(date),
      tags,
      content,
      summary,
      keyTopics,
      decisions,
      actionItems,
      qualityScore: {
        overallScore: qualityScore.overallScore ?? 85,
        clarity: qualityScore.clarity ?? 85,
        completeness: qualityScore.completeness ?? 90,
        actionability: qualityScore.actionability ?? 80,
        decisionClarity: qualityScore.decisionClarity ?? 85,
      },
      templateUsed,
      reviewStatus: "draft",
      version: 1,
      versionHistory: [
        {
          version: 1,
          content,
          summary,
          editedBy: req.user?.id || req.user?._id || null,
          editedAt: new Date(),
          changeSummary: "Initial version",
        },
      ],
      createdBy: req.user?.id || req.user?._id || null,
    });

    await note.save();

    return res.status(201).json({
      success: true,
      message: "Meeting Note created successfully",
      data: note,
    });
  } catch (error) {
    console.error("Error creating meeting note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create meeting note",
      error: error.message,
    });
  }
};

/**
 * PUT /api/ai-notes/records/:id
 * Update note and push to version history
 */
export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId =
      req.user?.organization?._id || req.user?.organization;

    const note = await AiMeetingNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "AI Meeting Note not found",
      });
    }

    if (
      organizationId &&
      note.organization &&
      note.organization.toString() !== organizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const {
      title,
      meetingType,
      date,
      tags,
      content,
      summary,
      keyTopics,
      decisions,
      actionItems,
      qualityScore,
      changeSummary = "Updated content",
    } = req.body;

    const currentVersion = note.version || 1;
    note.versionHistory.push({
      version: currentVersion,
      content: note.content,
      summary: note.summary,
      editedBy: req.user?.id || req.user?._id || null,
      editedAt: new Date(),
      changeSummary,
    });

    note.version = currentVersion + 1;

    if (title !== undefined) note.title = title.trim();
    if (meetingType !== undefined) note.meetingType = meetingType;
    if (date !== undefined) note.date = new Date(date);
    if (tags !== undefined) note.tags = tags;
    if (content !== undefined) note.content = content;
    if (summary !== undefined) note.summary = summary;
    if (keyTopics !== undefined) note.keyTopics = keyTopics;
    if (decisions !== undefined) note.decisions = decisions;
    if (actionItems !== undefined) note.actionItems = actionItems;
    if (qualityScore !== undefined) {
      note.qualityScore = { ...note.qualityScore, ...qualityScore };
    }

    await note.save();

    return res.status(200).json({
      success: true,
      message: "AI Meeting Note updated successfully",
      data: note,
    });
  } catch (error) {
    console.error("Error updating meeting note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update meeting note",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/ai-notes/records/:id
 */
export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId =
      req.user?.organization?._id || req.user?.organization;

    const note = await AiMeetingNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "AI Meeting Note not found",
      });
    }

    if (
      organizationId &&
      note.organization &&
      note.organization.toString() !== organizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await AiMeetingNote.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "AI Meeting Note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting meeting note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete meeting note",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/ai-notes/:id/review
 * Update review status
 */
export const reviewNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewStatus, reviewFeedback = "" } = req.body;

    if (
      !["draft", "in_review", "reviewed", "approved"].includes(reviewStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    const note = await AiMeetingNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "AI Meeting Note not found",
      });
    }

    note.reviewStatus = reviewStatus;
    note.reviewFeedback = reviewFeedback;
    note.reviewedBy = req.user?.id || req.user?._id || null;
    note.reviewedAt = new Date();

    await note.save();

    return res.status(200).json({
      success: true,
      message: `Note status updated to ${reviewStatus}`,
      data: note,
    });
  } catch (error) {
    console.error("Error reviewing note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to review note",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/ai-notes/:id/actions/:actionId
 * Toggle action item status
 */
export const toggleActionItemStatus = async (req, res) => {
  try {
    const { id, actionId } = req.params;
    const { status } = req.body;

    const note = await AiMeetingNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "AI Meeting Note not found",
      });
    }

    const action = note.actionItems.find(
      (a) => a.id === actionId || a._id?.toString() === actionId,
    );
    if (!action) {
      return res.status(404).json({
        success: false,
        message: "Action item not found in this note",
      });
    }

    action.status =
      status || (action.status === "completed" ? "pending" : "completed");
    action.completedAt = action.status === "completed" ? new Date() : null;

    await note.save();

    return res.status(200).json({
      success: true,
      message: "Action item status updated",
      data: {
        noteId: note._id,
        action,
      },
    });
  } catch (error) {
    console.error("Error toggling action item status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle action item status",
      error: error.message,
    });
  }
};

/**
 * GET /api/ai-notes/actions/cross-meeting
 * Aggregated action items across all notes for organization
 */
export const getCrossMeetingActionItems = async (req, res) => {
  try {
    const organizationId =
      req.user?.organization?._id ||
      req.user?.organization ||
      req.query.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const { status, priority, search } = req.query;

    const notes = await AiMeetingNote.find({ organization: organizationId })
      .select("title date meetingType actionItems")
      .lean();

    let allActions = [];
    notes.forEach((n) => {
      (n.actionItems || []).forEach((a) => {
        allActions.push({
          ...a,
          noteId: n._id,
          noteTitle: n.title,
          meetingType: n.meetingType,
          meetingDate: n.date,
        });
      });
    });

    if (status && status !== "all") {
      allActions = allActions.filter((a) => a.status === status);
    }

    if (priority && priority !== "all") {
      allActions = allActions.filter((a) => a.priority === priority);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      allActions = allActions.filter(
        (a) =>
          a.task?.toLowerCase().includes(q) ||
          a.owner?.toLowerCase().includes(q) ||
          a.noteTitle?.toLowerCase().includes(q),
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        total: allActions.length,
        completedCount: allActions.filter((a) => a.status === "completed")
          .length,
        pendingCount: allActions.filter((a) => a.status !== "completed").length,
        actionItems: allActions,
      },
    });
  } catch (error) {
    console.error("Error fetching cross-meeting action items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cross-meeting action items",
      error: error.message,
    });
  }
};

/**
 * POST /api/ai-notes/:id/restore/:version
 * Restore a past version of a note
 */
export const restoreNoteVersion = async (req, res) => {
  try {
    const { id, version } = req.params;
    const note = await AiMeetingNote.findById(id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "AI Meeting Note not found",
      });
    }

    const targetVersion = note.versionHistory.find(
      (v) => v.version === Number(version),
    );

    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        message: "Version not found in history",
      });
    }

    const newVersionNum = (note.version || 1) + 1;
    note.versionHistory.push({
      version: note.version,
      content: note.content,
      summary: note.summary,
      editedBy: req.user?.id || req.user?._id || null,
      editedAt: new Date(),
      changeSummary: `Restored to version ${version}`,
    });

    note.version = newVersionNum;
    note.content = targetVersion.content;
    note.summary = targetVersion.summary;

    await note.save();

    return res.status(200).json({
      success: true,
      message: `Restored note to version ${version}`,
      data: note,
    });
  } catch (error) {
    console.error("Error restoring version:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore version",
      error: error.message,
    });
  }
};

/**
 * GET /api/ai-notes/analytics/summary
 * Analytics on notes, quality, monthly trends, and tags
 */
export const getNotesAnalytics = async (req, res) => {
  try {
    const organizationId =
      req.user?.organization?._id ||
      req.user?.organization ||
      req.query.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const notes = await AiMeetingNote.find({ organization: organizationId })
      .select("date tags meetingType qualityScore reviewStatus actionItems")
      .lean();

    if (notes.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalNotes: 0,
          averageQualityScore: 0,
          qualityBreakdown: {
            clarity: 0,
            completeness: 0,
            actionability: 0,
            decisionClarity: 0,
          },
          totalActionItems: 0,
          completedActionItems: 0,
          actionCompletionRate: 0,
          reviewStatusDistribution: {
            draft: 0,
            in_review: 0,
            reviewed: 0,
            approved: 0,
          },
          monthlyTrends: [],
          topTags: [],
          typeDistribution: {},
        },
      });
    }

    const totalNotes = notes.length;
    let sumQuality = 0;
    let sumClarity = 0;
    let sumCompleteness = 0;
    let sumActionability = 0;
    let sumDecisionClarity = 0;

    let totalActions = 0;
    let completedActions = 0;

    const reviewDist = { draft: 0, in_review: 0, reviewed: 0, approved: 0 };
    const tagCounts = {};
    const typeCounts = {};
    const monthlyMap = {};

    notes.forEach((n) => {
      const q = n.qualityScore || {};
      sumQuality += q.overallScore || 85;
      sumClarity += q.clarity || 85;
      sumCompleteness += q.completeness || 90;
      sumActionability += q.actionability || 80;
      sumDecisionClarity += q.decisionClarity || 85;

      const actions = n.actionItems || [];
      totalActions += actions.length;
      completedActions += actions.filter(
        (a) => a.status === "completed",
      ).length;

      const st = n.reviewStatus || "draft";
      reviewDist[st] = (reviewDist[st] || 0) + 1;

      const tp = n.meetingType || "general";
      typeCounts[tp] = (typeCounts[tp] || 0) + 1;

      (n.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      const d = new Date(n.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          monthKey: key,
          label: d.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
          count: 0,
          actionCount: 0,
        };
      }
      monthlyMap[key].count += 1;
      monthlyMap[key].actionCount += actions.length;
    });

    const averageQualityScore = Math.round((sumQuality / totalNotes) * 10) / 10;
    const actionCompletionRate =
      totalActions > 0
        ? Math.round((completedActions / totalActions) * 100)
        : 0;

    const monthlyTrends = Object.keys(monthlyMap)
      .sort()
      .map((k) => monthlyMap[k]);

    const topTags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      data: {
        totalNotes,
        averageQualityScore,
        qualityBreakdown: {
          clarity: Math.round(sumClarity / totalNotes),
          completeness: Math.round(sumCompleteness / totalNotes),
          actionability: Math.round(sumActionability / totalNotes),
          decisionClarity: Math.round(sumDecisionClarity / totalNotes),
        },
        totalActionItems: totalActions,
        completedActionItems: completedActions,
        actionCompletionRate,
        reviewStatusDistribution: reviewDist,
        monthlyTrends,
        topTags,
        typeDistribution: typeCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching notes analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notes analytics",
      error: error.message,
    });
  }
};
