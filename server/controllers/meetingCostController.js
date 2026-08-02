import MeetingCostConfig from "../models/meetingCostConfigModel.js";
import meetingCostService from "../services/meetingCostService.js";
import { Parser } from "json2csv";

export const getConfig = async (req, res) => {
  try {
    const orgId = req.user.organization;
    let config = await MeetingCostConfig.findOne({ organization: orgId });

    if (!config) {
      config = new MeetingCostConfig({ organization: orgId });
      await config.save();
    }

    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error("Error fetching meeting cost config:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const updates = req.body;

    let config = await MeetingCostConfig.findOne({ organization: orgId });
    if (!config) {
      config = new MeetingCostConfig({ organization: orgId, ...updates });
    } else {
      Object.assign(config, updates);
    }

    await config.save();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error("Error updating meeting cost config:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getCostAnalytics = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const data = await meetingCostService.getOrganizationCostAnalytics(
      orgId,
      startDate,
      endDate,
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching cost analytics:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getMemberAnalytics = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const data = await meetingCostService.getMemberTimeAnalytics(
      orgId,
      startDate,
      endDate,
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching member analytics:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const exportCostReport = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const data = await meetingCostService.getMemberTimeAnalytics(
      orgId,
      startDate,
      endDate,
    );

    const fields = ["name", "email", "totalMeetings", "totalHours"];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="meeting_cost_report.csv"',
    );
    res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting cost report:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
