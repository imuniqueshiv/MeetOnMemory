import axios from "axios";
import { mapActionItemsToGithubIssue } from "./actionItemMapper.js";
import GithubSyncMapping from "../models/GithubSyncMapping.js";

export const syncMeetingToGithub = async (meeting, repoFullName, githubToken, organizationId) => {
  const issuePayload = mapActionItemsToGithubIssue(meeting, meeting.structuredMoM?.action_items || []);
  if (!issuePayload) {
    throw new Error("No action items found to sync");
  }

  try {
    const response = await axios.post(
      `https://api.github.com/repos/${repoFullName}/issues`,
      issuePayload,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json"
        }
      }
    );

    const issueNumber = response.data.number;

    const mapping = new GithubSyncMapping({
      organization: organizationId,
      meetingId: meeting._id,
      githubIssueNumber: issueNumber,
      githubRepoFullName: repoFullName
    });
    mapping.encryptToken(githubToken);
    await mapping.save();

    return response.data;
  } catch (error) {
    throw new Error(`GitHub Sync Failed: ${error.response?.data?.message || error.message}`);
  }
};
