import OpenAI from "openai"; // Or Anthropic SDK
import smartAssignment from "./smartAssignment.js";

// Initialize AI client (Assuming OpenAI for this implementation)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "mock-openai-key",
});

/**
 * @desc Service for extracting action items from meeting transcripts using LLMs.
 * Uses structured output / JSON mode to ensure reliable parsing of assignments,
 * deadlines, and priorities.
 */
class ActionItemExtractor {
  /**
   * Analyzes a transcript and extracts structured action items.
   * @param {string} transcript - The full meeting transcript.
   * @param {Array} participants - List of meeting participants { id, name }.
   * @returns {Promise<Array>} Array of extracted action items.
   */
  static async extractFromTranscript(transcript, participants) {
    if (!transcript || transcript.trim().length < 50) {
      return []; // Not enough context to extract meaningful items
    }

    const participantNames = participants.map((p) => p.name).join(", ");

    const systemPrompt = `
      You are an expert project manager AI. Your task is to extract actionable tasks (action items) from a meeting transcript.
      
      Rules:
      1. Only extract clear commitments to do work in the future. Ignore hypothetical discussions.
      2. Identify the assignee based on the context. If a specific person is mentioned, use their name. If ambiguous, leave assignee null.
      3. Extract deadlines if mentioned (e.g., "by Friday", "next week"). Convert relative dates to ISO 8601 format based on today's date: ${new Date().toISOString()}.
      4. Determine priority based on urgency keywords (urgent, ASAP, critical = high/urgent).
      5. Provide a confidence score (0.0 to 1.0) for how certain you are that this is a real action item.
      
      Available Participants: ${participantNames}
    `;

    const userPrompt = `
      Extract action items from the following transcript. Return ONLY a valid JSON array of objects.
      
      Transcript:
      """
      ${transcript.substring(0, 12000)} // Truncate to avoid token limits
      """
      
      Expected JSON Format:
      [
        {
          "title": "Short imperative title (max 10 words)",
          "description": "Detailed context from the transcript",
          "assigneeName": "Name of the person or null",
          "deadline": "ISO 8601 date string or null",
          "priority": "low | medium | high | urgent",
          "confidence": 0.95,
          "sourceContext": "Exact quote from transcript"
        }
      ]
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost-effective for extraction
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Low temperature for deterministic extraction
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);

      // The LLM might return { "items": [...] } or just [...]
      const rawItems = Array.isArray(parsed)
        ? parsed
        : parsed.items || parsed.action_items || [];

      // Post-process: Match assignee names to actual User IDs
      const processedItems = await Promise.all(
        rawItems.map(async (item) => {
          const assigneeId = await smartAssignment.resolveAssignee(
            item.assigneeName,
            participants,
          );

          return {
            title: item.title,
            description: item.description,
            assignee: assigneeId,
            deadline: item.deadline ? new Date(item.deadline) : null,
            priority: this.normalizePriority(item.priority),
            aiConfidence: item.confidence || 0.8,
            sourceContext: item.sourceContext || "",
          };
        }),
      );

      // Filter out low-confidence extractions to prevent noise
      return processedItems.filter((item) => item.aiConfidence >= 0.7);
    } catch (error) {
      console.error("[ActionItemExtractor] AI extraction failed:", error);
      throw new Error("Failed to extract action items. Please try again.");
    }
  }

  /**
   * Normalizes priority strings to match the Mongoose enum.
   */
  static normalizePriority(priority) {
    const p = (priority || "").toLowerCase();
    if (["urgent", "critical", "asap"].includes(p)) return "urgent";
    if (["high", "important"].includes(p)) return "high";
    if (["low", "minor", "someday"].includes(p)) return "low";
    return "medium";
  }
}

export default ActionItemExtractor;
