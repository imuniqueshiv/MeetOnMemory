import decisionLogService from "../services/decisionLogService.js";

export const createEntry = async (req, res) => {
  try {
    const data = {
      ...req.body,
      organizationId: req.organization._id,
      decidedBy: req.user._id,
    };
    const entry = await decisionLogService.createEntry(data);
    res.status(201).json(entry);
  } catch (error) {
    console.error("Error in createEntry:", error);
    res.status(500).json({ error: "Failed to create decision log entry" });
  }
};

export const getLogByOrg = async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      outcome: req.query.outcome,
      sortBy: req.query.sortBy,
      sortOrder: parseInt(req.query.sortOrder, 10) || -1,
    };
    const result = await decisionLogService.getLogByOrg(
      req.organization._id,
      options,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getLogByOrg:", error);
    res.status(500).json({ error: "Failed to fetch decision log" });
  }
};

export const updateOutcome = async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, impactAssessment } = req.body;
    const entry = await decisionLogService.updateOutcome(
      id,
      outcome,
      impactAssessment,
    );
    res.status(200).json(entry);
  } catch (error) {
    console.error("Error in updateOutcome:", error);
    res.status(500).json({ error: "Failed to update decision outcome" });
  }
};

export const linkActionItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionItemIds } = req.body;
    if (!Array.isArray(actionItemIds)) {
      return res.status(400).json({ error: "actionItemIds must be an array" });
    }
    const entry = await decisionLogService.linkActionItems(id, actionItemIds);
    res.status(200).json(entry);
  } catch (error) {
    console.error("Error in linkActionItems:", error);
    res.status(500).json({ error: "Failed to link action items" });
  }
};

export const getDecisionTimeline = async (req, res) => {
  try {
    const timeline = await decisionLogService.getDecisionTimeline(
      req.organization._id,
    );
    res.status(200).json(timeline);
  } catch (error) {
    console.error("Error in getDecisionTimeline:", error);
    res.status(500).json({ error: "Failed to fetch decision timeline" });
  }
};

export const getOverdueReviews = async (req, res) => {
  try {
    const entries = await decisionLogService.getOverdueReviews(
      req.organization._id,
    );
    res.status(200).json(entries);
  } catch (error) {
    console.error("Error in getOverdueReviews:", error);
    res.status(500).json({ error: "Failed to fetch overdue reviews" });
  }
};

export const editEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await decisionLogService.editEntry(id, req.body);
    res.status(200).json(entry);
  } catch (error) {
    console.error("Error in editEntry:", error);
    res.status(500).json({ error: "Failed to update decision log entry" });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await decisionLogService.deleteEntry(id);
    res
      .status(200)
      .json({ success: true, message: "Decision log entry deleted" });
  } catch (error) {
    console.error("Error in deleteEntry:", error);
    res.status(500).json({ error: "Failed to delete decision log entry" });
  }
};

export const exportLog = async (req, res) => {
  try {
    const { format } = req.query;
    const data = await decisionLogService.exportLog(
      req.organization._id,
      format,
    );

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=decision-log.csv",
      );
      return res.status(200).send(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in exportLog:", error);
    res.status(500).json({ error: "Failed to export decision log" });
  }
};
