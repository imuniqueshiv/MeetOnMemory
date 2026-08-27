// server/controllers/minutesApprovalController.js

// Mock storage database schema for MoM Records
const minutesStore = {};

export const handleApprovalAction = async (req, res) => {
  try {
    const { minutesId } = req.params;
    const { userId, role, action, feedback } = req.body;
    // action: 'APPROVE' | 'REQUEST_CHANGES'

    // Authorization Guard
    if (role !== "BOARD_MEMBER" && role !== "APPROVER") {
      return res
        .status(403)
        .json({ error: "UNAUTHORIZED_ACTION: User lacks approval authority" });
    }

    if (!minutesStore[minutesId]) {
      minutesStore[minutesId] = {
        status: "PENDING",
        quorumTarget: 3, // Configurable quorum requirement threshold
        votes: {},
        auditTrail: [],
      };
    }

    const meetingMinutes = minutesStore[minutesId];

    // Persist voter choice mapping and append to log
    meetingMinutes.votes[userId] = action;
    meetingMinutes.auditTrail.push({
      userId,
      role,
      action,
      feedback: feedback || "",
      timestamp: new Date().toISOString(),
    });

    // Recalculate Quorum Gating Constraints
    const totalVotes = Object.values(meetingMinutes.votes);
    const approvalCount = totalVotes.filter((v) => v === "APPROVE").length;
    const changesRequestedCount = totalVotes.filter(
      (v) => v === "REQUEST_CHANGES",
    ).length;

    if (changesRequestedCount > 0) {
      meetingMinutes.status = "CHANGES_REQUESTED";
    } else if (approvalCount >= meetingMinutes.quorumTarget) {
      meetingMinutes.status = "APPROVED";
    } else {
      meetingMinutes.status = "PENDING";
    }

    return res.status(200).json({ success: true, data: meetingMinutes });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal approval processing fault" });
  }
};

export const exportAuditTrail = async (req, res) => {
  try {
    const { minutesId } = req.params;
    const record = minutesStore[minutesId] || { auditTrail: [] };

    // Provide file attachment download triggers back to clients
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=minutes_audit_${minutesId}.json`,
    );

    return res.status(200).send(JSON.stringify(record.auditTrail, null, 2));
  } catch (error) {
    return res.status(500).json({ error: "Audit export pipeline failure" });
  }
};
