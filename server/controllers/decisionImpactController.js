import DecisionImpact from "../models/decisionImpactModel.js";
import Decision from "../models/decisionModel.js";

// GET /api/decisions/:decisionId/impact
export const getDecisionImpact = async (req, res, next) => {
  try {
    const { decisionId } = req.params;
    let impact = await DecisionImpact.findOne({ decisionId });
    if (!impact) {
      // Return 404 or just an empty shell depending on frontend needs
      return res.status(404).json({ message: "Impact record not found" });
    }
    res.json(impact);
  } catch (error) {
    next(error);
  }
};

// PUT /api/decisions/:decisionId/impact
export const updateDecisionImpact = async (req, res, next) => {
  try {
    const { decisionId } = req.params;
    const { outcomeStatus, impactScore, evidence, nextReviewDate } = req.body;

    const decision = await Decision.findById(decisionId);
    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    let impact = await DecisionImpact.findOne({ decisionId });
    if (impact) {
      // Update existing
      if (outcomeStatus) impact.outcomeStatus = outcomeStatus;
      if (impactScore !== undefined) impact.impactScore = impactScore;
      if (evidence) impact.evidence = evidence; // expects array of strings
      if (nextReviewDate !== undefined) impact.nextReviewDate = nextReviewDate;
      await impact.save();
    } else {
      // Create new
      impact = new DecisionImpact({
        decisionId,
        owner: req.user?.id || req.user?._id || "system", // adjust based on auth
        outcomeStatus: outcomeStatus || "pending",
        impactScore: impactScore || null,
        evidence: evidence || [],
        nextReviewDate: nextReviewDate || null,
      });
      await impact.save();
    }

    res.json(impact);
  } catch (error) {
    next(error);
  }
};

// GET /api/decisions/impact/report
export const getImpactReport = async (req, res, next) => {
  try {
    // Basic report: aggregate success rates and average impact scores
    const stats = await DecisionImpact.aggregate([
      {
        $group: {
          _id: "$outcomeStatus",
          count: { $sum: 1 },
          avgImpactScore: { $avg: "$impactScore" },
        },
      },
    ]);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};
