import {
  calculateMeetingQuality,
  getMeetingQuality,
  getOrganizationQuality,
  getQualityTrends,
  getLeaderboard,
  exportQualityReport,
} from "../services/meetingQualityService.js";
import {
  generateUserRecommendations,
  getBestPractices,
} from "../services/recommendationEngine.js";
import QualityBenchmark from "../models/QualityBenchmark.js";
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";

/**
 * Meeting Quality Controller
 * Handles HTTP requests for quality scoring and benchmarking
 */

/**
 * @desc Calculate meeting quality score
 * @route POST /api/quality/calculate/:meetingId
 * @access Private
 */
export const calculateScore = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Check meeting access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    // Calculate asynchronously
    calculateMeetingQuality(meetingId)
      .then(() => {
        console.log(`✓ Quality calculated for meeting ${meetingId}`);
      })
      .catch((err) => {
        console.error(`✗ Quality calculation failed for ${meetingId}:`, err);
      });

    res.status(202).json({
      message: "Quality calculation started",
      status: "calculating",
    });
  } catch (error) {
    console.error("Error calculating quality:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get meeting quality data
 * @route GET /api/quality/meeting/:meetingId
 * @access Private
 */
export const getMeetingQualityEndpoint = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const score = await getMeetingQuality(meetingId);

    if (!score) {
      return res.status(404).json({
        message: "Quality score not found. Trigger calculation first.",
        status: "not_calculated",
      });
    }

    // Check organization access
    if (score.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    res.status(200).json(score);
  } catch (error) {
    console.error("Error getting meeting quality:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get organization quality metrics
 * @route GET /api/quality/organization/:orgId
 * @access Private
 */
export const getOrganizationQualityEndpoint = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { period = "monthly" } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const quality = await getOrganizationQuality(orgId, period);

    res.status(200).json(quality);
  } catch (error) {
    console.error("Error getting organization quality:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get benchmark data
 * @route GET /api/quality/benchmarks/:orgId
 * @access Private
 */
export const getBenchmarks = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { type = "organization", period = "monthly" } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const benchmark = await QualityBenchmark.findOne({
      organization: orgId,
      type,
      period,
      isActive: true,
    }).sort({ updatedAt: -1 });

    if (!benchmark) {
      return res.status(404).json({
        message: "Benchmark not found. Benchmarks update weekly.",
      });
    }

    res.status(200).json(benchmark);
  } catch (error) {
    console.error("Error getting benchmarks:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get personalized recommendations
 * @route GET /api/quality/recommendations/:userId
 * @access Private
 */
export const getRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Users can only get their own recommendations (or admin)
    if (userId !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const recommendations = await generateUserRecommendations(
      userId,
      req.user.organization,
    );

    res.status(200).json(recommendations);
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get leaderboard data
 * @route GET /api/quality/leaderboard/:orgId
 * @access Private
 */
export const getLeaderboardEndpoint = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { period = "monthly" } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const leaderboard = await getLeaderboard(orgId, period);

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get quality trends
 * @route GET /api/quality/trends/:orgId
 * @access Private
 */
export const getTrends = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { period = "weekly" } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const trends = await getQualityTrends(orgId, period);

    res.status(200).json({ trends, period });
  } catch (error) {
    console.error("Error getting trends:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Export quality report
 * @route POST /api/quality/export/:orgId
 * @access Private (Admin)
 */
export const exportReport = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { format = "json" } = req.body;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    // Check admin access
    if (req.user.role !== "admin" && req.user.role !== "owner") {
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }

    const report = await exportQualityReport(orgId, format);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=quality-report-${orgId}.json`,
      );
      res.status(200).json(report);
    } else {
      res.status(400).json({ message: "Invalid format. Use 'json'" });
    }
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get best practice examples
 * @route GET /api/quality/best-practices/:orgId
 * @access Private
 */
export const getBestPracticesEndpoint = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { category } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const bestPractices = await getBestPractices(orgId, category);

    res.status(200).json({ bestPractices, count: bestPractices.length });
  } catch (error) {
    console.error("Error getting best practices:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
