import Transcript from "../models/transcriptModel.js";
import Decision from "../models/decisionModel.js";
import DebriefSession from "../models/debriefSessionModel.js";
import { generateText } from "./GenerativeAIService.js";

/**
 * Parses the AI response to extract citation markers and map them back
 * to the original segments.
 *
 * Example AI output: "The budget was approved [1]."
 * We need to map [1] to the actual excerpt and timestamp.
 */
function extractCitations(responseText, contextMap) {
  const citations = [];
  // Regex to find things like [1], [2]
  const regex = /\[(\d+)\]/g;
  let match;
  while ((match = regex.exec(responseText)) !== null) {
    const refIndex = match[1];
    const marker = `[${refIndex}]`;
    const contextItem = contextMap[refIndex];
    if (contextItem) {
      // Avoid duplicate citations for the same marker in the same message
      if (!citations.find((c) => c.marker === marker)) {
        citations.push({
          type: contextItem.type,
          refId: contextItem.id,
          excerpt: contextItem.text,
          timestamp: contextItem.timestamp || null,
          marker: marker,
        });
      }
    }
  }
  return citations;
}

export const askDebriefQuestion = async (meetingId, userId, question) => {
  // 1. Fetch meeting context
  const transcript = await Transcript.findOne({ meeting: meetingId });
  const decisions = await Decision.find({ sourceMeetingId: meetingId });

  if (!transcript && decisions.length === 0) {
    throw new Error("No context available for this meeting.");
  }

  // 2. Build the context map and text block for the prompt
  let contextText = "--- MEETING CONTEXT ---\n\n";
  const contextMap = {};
  let refIndex = 1;

  if (transcript && transcript.segments && transcript.segments.length > 0) {
    contextText += "TRANSCRIPT:\n";
    transcript.segments.forEach((seg) => {
      const text = `${seg.speaker}: ${seg.text}`;
      contextText += `[${refIndex}] [Time: ${seg.startTime}s] ${text}\n`;
      contextMap[refIndex] = {
        type: "transcript",
        id: transcript._id,
        text: text,
        timestamp: seg.startTime,
      };
      refIndex++;
    });
    contextText += "\n";
  } else if (transcript && transcript.fullText) {
    // fallback if segments are not available but fullText is
    contextText += "TRANSCRIPT:\n";
    contextText += `[${refIndex}] ${transcript.fullText}\n`;
    contextMap[refIndex] = {
      type: "transcript",
      id: transcript._id,
      text: transcript.fullText,
      timestamp: 0,
    };
    refIndex++;
  }

  if (decisions && decisions.length > 0) {
    contextText += "DECISIONS:\n";
    decisions.forEach((dec) => {
      contextText += `[${refIndex}] Decision: ${dec.text} (Status: ${dec.status})\n`;
      contextMap[refIndex] = {
        type: "decision",
        id: dec._id,
        text: dec.text,
      };
      refIndex++;
    });
    contextText += "\n";
  }

  // 3. Fetch chat history
  let session = await DebriefSession.findOne({ meetingId, userId });
  if (!session) {
    session = new DebriefSession({ meetingId, userId, messages: [] });
  }

  let historyText = "";
  if (session.messages.length > 0) {
    historyText = "--- CHAT HISTORY ---\n";
    session.messages.forEach((msg) => {
      historyText += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
    });
    historyText += "\n";
  }

  // 4. Construct prompt
  const prompt = `
You are a helpful meeting assistant. You must answer the user's question using ONLY the provided meeting context.
Do not invent information. If the answer is not in the context, say "I don't have enough information from the meeting to answer that."

When you use information from the context, you MUST cite the source by appending the corresponding bracketed number, e.g., [1] or [42], directly after the relevant sentence or fact.

${contextText}

${historyText}
--- NEW QUESTION ---
User: ${question}
Assistant:`;

  // 5. Call LLM
  const responseText = await generateText(prompt, "debrief_qa");

  // 6. Extract citations
  const citations = extractCitations(responseText, contextMap);

  // 7. Save to DB
  session.messages.push({
    role: "user",
    content: question,
    citations: [],
  });

  session.messages.push({
    role: "assistant",
    content: responseText,
    citations: citations,
  });

  await session.save();

  // Return the newly added assistant message with citations
  return session.messages[session.messages.length - 1];
};

export const getDebriefSession = async (meetingId, userId) => {
  return await DebriefSession.findOne({ meetingId, userId });
};
