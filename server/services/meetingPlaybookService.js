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

export const updatePlaybook = async (id, data) => {
  const playbook = await MeetingPlaybook.findByIdAndUpdate(id, data, {
    new: true,
  });
  if (!playbook) {
    throw new Error("Playbook not found");
  }
  return playbook;
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
