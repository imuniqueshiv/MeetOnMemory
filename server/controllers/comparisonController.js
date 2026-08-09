import Meeting from "../models/meetingModel.js";
import ComparisonService from "../services/ComparisonService.js";

// @desc    Compare two meetings (summary, decisions, action items)
// @route   POST /api/comparison/compare
// @access  Private
export const compareMeetings = async (req, res) => {
  try {
    const { meetingIdA, meetingIdB } = req.body;

    if (
      !meetingIdA ||
      !meetingIdB ||
      typeof meetingIdA !== "string" ||
      typeof meetingIdB !== "string"
    ) {
      return res.status(400).json({
        message:
          "Both meetingIdA and meetingIdB are required and must be strings",
      });
    }

    // Fetch both meetings
    const meetingA =
      await Meeting.findById(meetingIdA).populate("organization");
    const meetingB =
      await Meeting.findById(meetingIdB).populate("organization");

    if (!meetingA || !meetingB) {
      return res
        .status(404)
        .json({ message: "One or both meetings not found" });
    }

    // Check RBAC/Ownership
    const userId = req.user._id.toString();
    const canAccessA =
      meetingA.uploadedBy.toString() === userId ||
      (meetingA.organization &&
        req.user.organizations?.includes(meetingA.organization._id.toString()));
    const canAccessB =
      meetingB.uploadedBy.toString() === userId ||
      (meetingB.organization &&
        req.user.organizations?.includes(meetingB.organization._id.toString()));

    if (!canAccessA || !canAccessB) {
      return res
        .status(403)
        .json({ message: "Not authorized to access these meetings" });
    }

    // Compute Diffs
    const actionItemsA = meetingA.structuredMoM?.action_items || [];
    const actionItemsB = meetingB.structuredMoM?.action_items || [];
    const actionItemsDiff = ComparisonService.computeItemDiff(
      actionItemsA,
      actionItemsB,
      "action_item",
    );

    const decisionsA = meetingA.structuredMoM?.decisions || [];
    const decisionsB = meetingB.structuredMoM?.decisions || [];
    const decisionsDiff = ComparisonService.computeItemDiff(
      decisionsA,
      decisionsB,
      "decision",
    );

    // Generate AI Summary
    const aiSummary = await ComparisonService.generateAiDiffSummary(
      meetingA,
      meetingB,
    );

    res.json({
      meetingA: {
        _id: meetingA._id,
        title: meetingA.title,
        date: meetingA.date,
        summary: meetingA.summary,
      },
      meetingB: {
        _id: meetingB._id,
        title: meetingB.title,
        date: meetingB.date,
        summary: meetingB.summary,
      },
      actionItemsDiff,
      decisionsDiff,
      aiSummary,
    });
  } catch (error) {
    console.error("Error in compareMeetings:", error);
    res.status(500).json({ message: "Server error during meeting comparison" });
  }
};

// @desc    Get a list of comparable meetings for a given meeting
// @route   GET /api/comparison/comparable/:meetingId
// @access  Private
export const getComparableMeetings = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const baseMeeting = await Meeting.findById(meetingId);
    if (!baseMeeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check access
    const userId = req.user._id.toString();
    const canAccess =
      baseMeeting.uploadedBy.toString() === userId ||
      (baseMeeting.organization &&
        req.user.organizations?.includes(baseMeeting.organization.toString()));
    if (!canAccess) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Find comparable meetings (same organization or user, and ideally same series or tags)
    const query = {
      _id: { $ne: baseMeeting._id },
    };

    if (baseMeeting.organization) {
      query.organization = baseMeeting.organization;
    } else {
      query.uploadedBy = req.user._id;
    }

    // We can prioritize same series if available, otherwise just fetch recent meetings
    // For now, let's just fetch the 10 most recent meetings the user has access to in this context
    const comparableMeetings = await Meeting.find(query)
      .sort({ date: -1 })
      .limit(10)
      .select("title date summary series tags");

    res.json(comparableMeetings);
  } catch (error) {
    console.error("Error in getComparableMeetings:", error);
    res
      .status(500)
      .json({ message: "Server error fetching comparable meetings" });
  }
};
