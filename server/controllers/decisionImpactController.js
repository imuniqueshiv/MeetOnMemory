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

    const updateData = {};
    const setOnInsert = {
      owner: req.user?.id || req.user?._id || "system",
    };

    if (outcomeStatus) {
      updateData.outcomeStatus = outcomeStatus;
    } else {
      setOnInsert.outcomeStatus = "pending";
    }

    if (impactScore !== undefined) {
      updateData.impactScore = impactScore;
    } else {
      setOnInsert.impactScore = null;
    }

    if (evidence) {
      updateData.evidence = evidence;
    } else {
      setOnInsert.evidence = [];
    }

    if (nextReviewDate !== undefined) {
      updateData.nextReviewDate = nextReviewDate;
    } else {
      setOnInsert.nextReviewDate = null;
    }

    const impact = await DecisionImpact.findOneAndUpdate(
      { decisionId },
      {
        $set: updateData,
        $setOnInsert: setOnInsert,
      },
      { upsert: true, new: true },
    );

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
