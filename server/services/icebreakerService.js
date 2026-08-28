import Icebreaker from "../models/icebreakerModel.js";
import Meeting from "../models/meetingModel.js";
import { generateText, parseJsonOutput } from "./GenerativeAIService.js";

export const generateIcebreakers = async (
  meetingId,
  organizationId,
  participantIds = [],
) => {
  let participantsInfo = "No participants listed yet.";
  let usedPrompts = "None";

  if (meetingId) {
    // 1. Fetch meeting participants to provide context
    const meeting = await Meeting.findById(meetingId).populate(
      "participants",
      "name department role",
    );
    if (meeting) {
      participantsInfo = meeting.participants
        .map(
          (p) =>
            `${p.name} (Dept: ${p.department || "N/A"}, Role: ${p.role || "N/A"})`,
        )
        .join("\\n");
    }

    // 2. Fetch previously used icebreakers for this meeting to avoid repetition
    const usedIcebreakers = await Icebreaker.find({
      organization: organizationId,
      usedInMeetings: meetingId,
    }).lean();

    usedPrompts = usedIcebreakers.map((ib) => ib.promptText).join("\\n");
  } else {
    // If no meetingId, try to lookup participantIds directly (useful for Create Meeting)
    const User = (await import("../models/userModel.js")).default;
    const users = await User.find({ _id: { $in: participantIds } }).select(
      "name department role",
    );
    if (users.length > 0) {
      participantsInfo = users
        .map(
          (p) =>
            `${p.name} (Dept: ${p.department || "N/A"}, Role: ${p.role || "N/A"})`,
        )
        .join("\\n");
    }
  }

  const prompt = `
You are an AI assistant tasked with creating 3 intelligent, context-aware icebreaker questions for an upcoming meeting.
The meeting has the following participants:
${participantsInfo || "No participants listed yet."}

Do NOT suggest any of the following previously used icebreakers:
${usedPrompts || "None"}

The icebreakers should vary in category: one 'fun', one 'deep', and one 'work-related'.
Ensure the questions are suitable for a professional work environment.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "icebreakers": [
    {
      "category": "fun | deep | work-related",
      "promptText": "The icebreaker question"
    }
  ]
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini icebreaker generation");
  } catch (err) {
    console.error("❌ Icebreaker generation failed:", err.message);
    throw new Error("Failed to generate icebreakers via AI.");
  }

  const parsed = parseJsonOutput(outputText);
  if (
    !parsed ||
    !Array.isArray(parsed.icebreakers) ||
    parsed.icebreakers.length === 0
  ) {
    // Fallback logic
    return [
      {
        category: "fun",
        promptText:
          "If you could have any superpower for a day, what would it be?",
      },
      {
        category: "work-related",
        promptText: "What is one thing you learned this week?",
      },
      {
        category: "deep",
        promptText: "What is a challenge you overcame recently?",
      },
    ];
  }

  return parsed.icebreakers;
};

export const selectIcebreaker = async (
  meetingId,
  organizationId,
  category,
  promptText,
) => {
  // Save or update the icebreaker in the DB
  let icebreaker = await Icebreaker.findOne({
    promptText,
    organization: organizationId,
  });

  if (!icebreaker) {
    icebreaker = new Icebreaker({
      category,
      promptText,
      organization: organizationId,
      usedInMeetings: [meetingId],
    });
  } else {
    if (!icebreaker.usedInMeetings.includes(meetingId)) {
      icebreaker.usedInMeetings.push(meetingId);
    }
  }

  await icebreaker.save();
  return icebreaker;
};
