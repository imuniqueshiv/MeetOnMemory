import RecordingSession from "../models/RecordingSession.js";
import Meeting from "../models/meetingModel.js";

/**
 * @desc    Start a new recording session or get existing active session for meeting
 * @route   POST /api/recording-sessions/start
 * @access  Private
 */
export const startRecordingSession = async (req, res) => {
  try {
    const { meetingId, metadata } = req.body;
    const userId = req.user._id || req.user.id;
    const orgId = req.user.organization || null;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: "meetingId is required",
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if an IN_PROGRESS session already exists for this meeting
    let session = await RecordingSession.findOne({
      meeting: meetingId,
      status: "IN_PROGRESS",
    });

    if (session) {
      session.lastHeartbeatAt = new Date();
      if (metadata) {
        session.metadata = { ...session.metadata, ...metadata };
      }
      await session.save();
    } else {
      session = await RecordingSession.create({
        meeting: meetingId,
        user: userId,
        organization: orgId || meeting.organization || null,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        metadata: metadata || {},
      });
    }

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Error starting recording session:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start recording session",
    });
  }
};

/**
 * @desc    Record chunk processing event or heartbeat
 * @route   POST /api/recording-sessions/:sessionId/chunk
 * @access  Private
 */
export const recordChunk = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      chunkDuration = 0,
      isRetry = false,
      success = true,
      errorReason = null,
      chunkIndex = 0,
    } = req.body;

    const session = await RecordingSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Recording session not found",
      });
    }

    session.lastHeartbeatAt = new Date();
    if (chunkDuration > 0) {
      session.duration += chunkDuration;
    }

    if (success) {
      session.chunkCount += 1;
    }

    if (isRetry) {
      session.retryCount += 1;
    }

    if (errorReason || !success) {
      const reasonStr = errorReason || "Chunk transcription error";
      session.failureReason = reasonStr;
      session.failureHistory.push({
        reason: reasonStr,
        timestamp: new Date(),
        chunkIndex: chunkIndex || session.chunkCount,
      });
    }

    await session.save();

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Error recording session chunk:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record chunk metrics",
    });
  }
};

/**
 * @desc    Update session status (COMPLETED, FAILED, PAUSED)
 * @route   POST /api/recording-sessions/:sessionId/status
 * @access  Private
 */
export const updateSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, failureReason, duration } = req.body;

    const validStatuses = ["IN_PROGRESS", "COMPLETED", "FAILED", "PAUSED"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of ${validStatuses.join(", ")}`,
      });
    }

    const session = await RecordingSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Recording session not found",
      });
    }

    if (status) {
      session.status = status;
      if (status === "COMPLETED" || status === "FAILED") {
        session.endedAt = new Date();
      }
    }

    if (failureReason) {
      session.failureReason = failureReason;
      session.failureHistory.push({
        reason: failureReason,
        timestamp: new Date(),
        chunkIndex: session.chunkCount,
      });
    }

    if (typeof duration === "number" && duration > 0) {
      session.duration = duration;
    }

    session.lastHeartbeatAt = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Error updating recording session status:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update session status",
    });
  }
};

/**
 * @desc    Get aggregate BE metrics for recording sessions
 * @route   GET /api/recording-sessions/metrics
 * @access  Private
 */
export const getRecordingSessionMetrics = async (req, res) => {
  try {
    const orgId = req.user.organization || null;
    const { meetingId, thresholdMinutes = 10 } = req.query;

    const query = {};
    if (orgId) {
      query.organization = orgId;
    }
    if (meetingId) {
      query.meeting = meetingId;
    }

    const sessions = await RecordingSession.find(query)
      .populate("meeting", "title date")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const totalSessions = sessions.length;
    let totalDuration = 0;
    let totalChunkCount = 0;
    let totalRetryCount = 0;
    const statusCounts = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      FAILED: 0,
      PAUSED: 0,
    };

    const failureReasonCounts = {};
    const cutoffDate = new Date(
      Date.now() - Number(thresholdMinutes) * 60 * 1000,
    );
    const stuckSessions = [];

    sessions.forEach((s) => {
      totalDuration += s.duration || 0;
      totalChunkCount += s.chunkCount || 0;
      totalRetryCount += s.retryCount || 0;

      if (statusCounts[s.status] !== undefined) {
        statusCounts[s.status] += 1;
      }

      if (s.status === "IN_PROGRESS") {
        const lastActive = s.lastHeartbeatAt || s.updatedAt || s.startedAt;
        if (new Date(lastActive) < cutoffDate) {
          stuckSessions.push(s);
        }
      }

      if (s.failureReason) {
        failureReasonCounts[s.failureReason] =
          (failureReasonCounts[s.failureReason] || 0) + 1;
      }

      if (Array.isArray(s.failureHistory)) {
        s.failureHistory.forEach((f) => {
          if (f.reason && f.reason !== s.failureReason) {
            failureReasonCounts[f.reason] =
              (failureReasonCounts[f.reason] || 0) + 1;
          }
        });
      }
    });

    const failureReasonsList = Object.entries(failureReasonCounts).map(
      ([reason, count]) => ({
        reason,
        count,
      }),
    );

    const avgDuration =
      totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    const avgChunkCount =
      totalSessions > 0
        ? Number((totalChunkCount / totalSessions).toFixed(1))
        : 0;
    const retryRate =
      totalChunkCount > 0
        ? Number(((totalRetryCount / totalChunkCount) * 100).toFixed(1))
        : 0;
    const failureRate =
      totalSessions > 0
        ? Number(((statusCounts.FAILED / totalSessions) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      success: true,
      metrics: {
        totalSessions,
        totalDuration,
        totalChunkCount,
        totalRetryCount,
        avgDuration,
        avgChunkCount,
        retryRate,
        failureRate,
        statusCounts,
        failureReasons: failureReasonsList,
        stuckCount: stuckSessions.length,
      },
      stuckSessions,
      recentSessions: sessions.slice(0, 50),
    });
  } catch (error) {
    console.error("Error fetching recording session metrics:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch recording session metrics",
    });
  }
};

/**
 * @desc    Get stuck IN_PROGRESS recording sessions
 * @route   GET /api/recording-sessions/stuck
 * @access  Private
 */
export const getStuckSessions = async (req, res) => {
  try {
    const orgId = req.user.organization || null;
    const thresholdMinutes = Number(req.query.thresholdMinutes) || 10;
    const cutoffDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const query = {
      status: "IN_PROGRESS",
      lastHeartbeatAt: { $lt: cutoffDate },
    };
    if (orgId) {
      query.organization = orgId;
    }

    const stuckSessions = await RecordingSession.find(query)
      .populate("meeting", "title date")
      .populate("user", "name email")
      .sort({ lastHeartbeatAt: 1 });

    return res.status(200).json({
      success: true,
      stuckCount: stuckSessions.length,
      stuckSessions,
    });
  } catch (error) {
    console.error("Error fetching stuck recording sessions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch stuck recording sessions",
    });
  }
};

/**
 * @desc    Resolve stuck session (e.g. mark as FAILED or COMPLETED)
 * @route   PATCH /api/recording-sessions/:sessionId/resolve-stuck
 * @access  Private
 */
export const resolveStuckSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      targetStatus = "FAILED",
      reason = "Stuck session auto-resolved by admin",
    } = req.body;

    const session = await RecordingSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Recording session not found",
      });
    }

    session.status = targetStatus;
    session.endedAt = new Date();
    session.failureReason = reason;
    session.failureHistory.push({
      reason,
      timestamp: new Date(),
      chunkIndex: session.chunkCount,
    });

    await session.save();

    return res.status(200).json({
      success: true,
      message: `Session resolved to ${targetStatus}`,
      session,
    });
  } catch (error) {
    console.error("Error resolving stuck session:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resolve stuck session",
    });
  }
};
