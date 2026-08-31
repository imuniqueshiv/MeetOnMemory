import MeetingPlaybook from "../models/meetingPlaybookModel.js";
import { generateText, parseJsonOutput } from "./GenerativeAIService.js";

export const createPlaybook = async (data) => {
  const playbook = new MeetingPlaybook(data);
  return await playbook.save();
};

export const getPlaybooks = async () => {
  return await MeetingPlaybook.find().sort({ createdAt: -1 });
};

export const getPlaybookById = async (id) => {
  const playbook = await MeetingPlaybook.findById(id);
  if (!playbook) {
    throw new Error("Playbook not found");
  }
  return playbook;
};

export const updatePlaybook = async (id, data, userId = null) => {
  const existing = await MeetingPlaybook.findById(id);
  if (!existing) {
    throw new Error("Playbook not found");
  }

  // Create version snapshot of previous state before updating
  const currentVersion = existing.version || 1;
  const snapshot = {
    version: currentVersion,
    name: existing.name,
    description: existing.description || "",
    steps: existing.steps
      ? existing.steps.map((s) => (s.toObject ? s.toObject() : s))
      : [],
    savedAt: new Date(),
    savedBy: userId || existing.createdBy,
  };

  const nextVersion = currentVersion + 1;
  const updatePayload = {
    ...data,
    version: nextVersion,
    $push: { versions: snapshot },
  };

  const playbook = await MeetingPlaybook.findByIdAndUpdate(id, updatePayload, {
    new: true,
  });
  return playbook;
};

export const restorePlaybookVersion = async (
  id,
  targetVersion,
  userId = null,
) => {
  const existing = await MeetingPlaybook.findById(id);
  if (!existing) {
    throw new Error("Playbook not found");
  }

  const target = (existing.versions || []).find(
    (v) => Number(v.version) === Number(targetVersion),
  );
  if (!target) {
    throw new Error(`Version ${targetVersion} not found for this playbook`);
  }

  // Snapshot current state before restoring
  const currentVersion = existing.version || 1;
  const snapshot = {
    version: currentVersion,
    name: existing.name,
    description: existing.description || "",
    steps: existing.steps
      ? existing.steps.map((s) => (s.toObject ? s.toObject() : s))
      : [],
    savedAt: new Date(),
    savedBy: userId || existing.createdBy,
  };

  const nextVersion = currentVersion + 1;
  existing.name = target.name;
  existing.description = target.description;
  existing.steps = target.steps;
  existing.version = nextVersion;
  existing.versions.push(snapshot);

  return await existing.save();
};

export const applyPlaybookToMeeting = async (playbookId, meetingId) => {
  const playbook = await MeetingPlaybook.findById(playbookId);
  if (!playbook) {
    throw new Error("Playbook not found");
  }

  const Meeting = (await import("../models/meetingModel.js")).default;
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new Error("Meeting not found");
  }

  meeting.playbook = playbook._id;
  await meeting.save();

  // Increment usage count
  playbook.usageCount = (playbook.usageCount || 0) + 1;
  await playbook.save();

  return { meeting, playbook };
};

export const deletePlaybook = async (id) => {
  const playbook = await MeetingPlaybook.findByIdAndDelete(id);
  if (!playbook) {
    throw new Error("Playbook not found");
  }
  return playbook;
};

export const generatePlaybookFromAI = async (prompt, meetingType, userId) => {
  const systemPrompt = `You are an expert meeting facilitator. 
Create a step-by-step meeting playbook based on the user's request.
The playbook should be tailored for a "${meetingType}" meeting.
The output MUST be valid JSON conforming to this structure:
{
  "name": "String",
  "description": "String",
  "steps": [
    {
      "title": "String",
      "durationMinutes": Number,
      "facilitatorPrompts": ["String", "String"],
      "expectedOutputs": ["String", "String"]
    }
  ]
}`;

  const textOutput = await generateText(systemPrompt, prompt);
  const parsed = parseJsonOutput(textOutput);

  // Validate the parsed structure loosely
  if (!parsed.name || !Array.isArray(parsed.steps)) {
    throw new Error("AI generated an invalid playbook structure");
  }

  // Save the generated playbook
  const playbookData = {
    ...parsed,
    createdBy: userId,
  };

  return await createPlaybook(playbookData);
};
