import crypto from "crypto";
import GithubSyncMapping from "../models/GithubSyncMapping.js";
import Meeting from "../models/meetingModel.js";
import { syncMeetingToGithub } from "../services/githubSyncService.js";

// Keep track of processed delivery IDs for idempotency
const processedDeliveries = new Set();

export const handleGithubWebhook = async (req, res) => {
  const deliveryId = req.headers["x-github-delivery"];
  const event = req.headers["x-github-event"];
  
  // Note: For full security, we would validate x-hub-signature-256 here

  if (!deliveryId || !event) {
    return res.status(400).send("Missing GitHub headers");
  }

  // Idempotency check
  if (processedDeliveries.has(deliveryId)) {
    return res.status(200).send("Already processed");
  }

  if (event === "issues") {
    const { action, issue, repository } = req.body;
    
    if (action === "closed" || action === "reopened") {
      try {
        const mapping = await GithubSyncMapping.findOne({
          githubIssueNumber: issue.number,
          githubRepoFullName: repository.full_name
        });

        if (mapping) {
          mapping.status = action === "closed" ? "closed" : "open";
          await mapping.save();
        }
      } catch (error) {
        console.error("Webhook processing error:", error);
      }
    }
  }

  processedDeliveries.add(deliveryId);
  // Keep set size bounded
  if (processedDeliveries.size > 1000) {
    processedDeliveries.clear(); 
  }

  res.status(200).send("Webhook received");
};

export const linkMeetingToGithub = async (req, res) => {
  try {
    const { meetingId, repoFullName } = req.body;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found" });

    const result = await syncMeetingToGithub(meeting, repoFullName, req.githubToken, req.user.organization);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
