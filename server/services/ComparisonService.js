import { computeTextSimilarity } from "../utils/textSimilarity.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

class ComparisonService {
  /**
   * Compares two lists of items (e.g. action items or decisions) using text similarity.
   * Returns an array categorizing each item as 'added', 'resolved' (or 'dropped'), or 'carriedOver'.
   */
  static computeItemDiff(itemsA, itemsB, type = "item", threshold = 0.6) {
    const listA = itemsA || [];
    const listB = itemsB || [];

    const diff = {
      resolved: [], // In A, not in B
      added: [], // In B, not in A
      carriedOver: [], // In both A and B
    };

    // Track which B items have been matched to prevent duplicate matching
    const matchedBIndices = new Set();

    // Find carried over and resolved items from A
    listA.forEach((itemA) => {
      let bestMatchIdx = -1;
      let highestSim = 0;

      const textA = this._extractText(itemA);

      listB.forEach((itemB, idx) => {
        if (matchedBIndices.has(idx)) return;

        const textB = this._extractText(itemB);
        const sim = computeTextSimilarity(textA, textB);

        if (sim > highestSim) {
          highestSim = sim;
          bestMatchIdx = idx;
        }
      });

      if (highestSim >= threshold && bestMatchIdx !== -1) {
        matchedBIndices.add(bestMatchIdx);
        diff.carriedOver.push({
          item: listB[bestMatchIdx], // we keep the most recent version
          previousItem: itemA,
          similarity: highestSim,
          status: "carriedOver",
        });
      } else {
        diff.resolved.push({
          item: itemA,
          status: type === "action_item" ? "resolved" : "dropped",
        });
      }
    });

    // Anything left in B is added
    listB.forEach((itemB, idx) => {
      if (!matchedBIndices.has(idx)) {
        diff.added.push({
          item: itemB,
          status: "added",
        });
      }
    });

    return diff;
  }

  static _extractText(item) {
    if (typeof item === "string") return item;
    // For action items
    if (item.task) return `${item.task} ${item.owner || ""}`;
    if (item.action) return `${item.action} ${item.owner || ""}`;
    // Fallback
    return JSON.stringify(item);
  }

  /**
   * Generates a natural language narrative of what changed between the two meetings.
   */
  static async generateAiDiffSummary(meetingA, meetingB) {
    if (!GEMINI_API_KEY) {
      return "AI diff summary is currently unavailable due to missing API key configuration.";
    }

    const titleA = meetingA.title || "Untitled Meeting A";
    const dateA = new Date(meetingA.date).toLocaleDateString();
    const summaryA = meetingA.summary || "No summary available.";

    const titleB = meetingB.title || "Untitled Meeting B";
    const dateB = new Date(meetingB.date).toLocaleDateString();
    const summaryB = meetingB.summary || "No summary available.";

    const prompt = `
You are an AI assistant analyzing two meetings from a recurring series or related topics.
Your goal is to provide a concise, natural-language narrative (1-2 paragraphs) summarizing what has changed, progressed, or evolved between the previous meeting and the latest meeting.

--- Previous Meeting: ${titleA} (${dateA}) ---
Summary: ${summaryA}

--- Latest Meeting: ${titleB} (${dateB}) ---
Summary: ${summaryB}

Focus on:
1. High-level progression of topics.
2. What key issues from the first meeting seem resolved or changed in the second.
3. What new major topics emerged in the latest meeting.
Keep the tone professional, objective, and brief. Do not use Markdown, just plain text paragraphs.
`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent(prompt);
      const outputText = result.response.text();
      return outputText.trim();
    } catch (error) {
      console.error("❌ Gemini diff summary generation failed:", error.message);
      return "Failed to generate AI diff summary.";
    }
  }
}

export default ComparisonService;
