import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const generateMoMWithAI = async (textToSummarize, date, title) => {
  const prompt = `
You are an advanced AI meeting assistant responsible for preparing *formal, well-structured Minutes of Meeting (MoM)* 
from the transcript provided below.

The MoM should be factual, concise, and formatted for professional use in organizations, universities, or institutions.  
Avoid repetition, filler words, and unnecessary phrases. Capture key insights, outcomes, and responsibilities accurately.

🎯 Your goal is to return a clean JSON object with the following fields:
{
  "title": "A clear, professional meeting title (e.g., 'AI Integration Strategy Discussion')",
  "date": "${date}",
  "summary": "A concise 4–6 sentence paragraph summarizing the meeting objectives, key points discussed, and overall conclusions. Use formal tone.",
  "agenda": ["main agenda point 1", "main agenda point 2", "main agenda point 3"],
  "key_discussions": [
    "Summarize core discussion points or debates in neutral and objective language.",
    "Mention who contributed if identifiable (optional)."
  ],
  "decisions": [
    "List final decisions or outcomes agreed upon during the meeting, if any."
  ],
  "action_items": [
    {"task": "Describe the specific task or next step", "owner": "Person responsible (if mentioned)", "due_date": "Deadline or expected date, if mentioned", "status": "Status if mentioned (e.g., 'pending', 'in progress', 'completed')"}
  ],
  "questions_raised": [
    "List important unanswered questions or follow-up discussions that emerged during the meeting."
  ],
  "keywords": [
    "Extract 5-10 relevant keywords and topics discussed during the meeting."
  ],
  "attendees": ["List attendees if mentioned or infer from transcript"],
  "notes": "Include any follow-up requirements, risks, or additional remarks worth noting."
}

Transcript:
${textToSummarize}

🧠 Instructions:
- Return ONLY valid JSON (no Markdown, no commentary, no backticks).
- Write in clear, formal English.
- Ensure every array key is present — use [] or "" for missing info.
- Avoid hallucinating or adding extra information.
- Maintain factual tone based on transcript content only.
- If user provided a title: ${title || "none"}, incorporate or refine it if appropriate.
`;

  try {
    console.log(`📡 Using Gemini model: ${GEMINI_MODEL}`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const outputText = result.response.text();

    let structured;
    try {
      structured = JSON.parse(outputText);
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      structured = match ? JSON.parse(match[0]) : { rawText: outputText };
    }
    console.log("✅ Gemini response received");
    return structured;
  } catch (gemErr) {
    console.error(
      "❌ Gemini API error, falling back to HuggingFace:",
      gemErr.message,
    );
  }

  try {
    const hfUrl =
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
    const hfResp = await axios.post(
      hfUrl,
      { inputs: textToSummarize.substring(0, 1024) },
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      },
    );

    const hfText =
      Array.isArray(hfResp.data) && hfResp.data[0]?.summary_text
        ? hfResp.data[0].summary_text
        : hfResp.data?.generated_text || JSON.stringify(hfResp.data);

    console.log("✅ HuggingFace fallback completed");
    return {
      title: title || `Meeting on ${date}`,
      date,
      summary: hfText,
      agenda: [],
      key_discussions: [],
      decisions: [],
      action_items: [],
      questions_raised: [],
      keywords: [],
      attendees: [],
      notes: "Generated using fallback summarization model",
    };
  } catch (hfErr) {
    console.error("❌ HuggingFace also failed:", hfErr.message);
    throw new Error("Both Gemini and HuggingFace summarization failed");
  }
};

export const normalizeMoM = (structured, title, date) => ({
  title: structured.title || title || `Meeting on ${date}`,
  date: structured.date || date,
  summary: structured.summary || structured.rawText || "",
  agenda: structured.agenda || [],
  key_discussions: structured.key_discussions || [],
  decisions: structured.decisions || [],
  action_items: structured.action_items || structured.actions || [],
  questions_raised: structured.questions_raised || [],
  keywords: structured.keywords || [],
  attendees: structured.attendees || [],
  notes: structured.notes || "",
});

export const buildHumanReadableMoM = (mom) => {
  let text = "";
  text += `📘 Overview:\n${mom.summary}\n\n`;
  text += `📅 Title: ${mom.title}\n`;
  text += `Date: ${new Date(mom.date).toLocaleDateString()}\n\n`;
  text += `📝 Summary:\n${mom.summary}\n\n`;

  if (mom.agenda.length) {
    text += "📋 Agenda:\n";
    mom.agenda.forEach((item, i) => (text += `${i + 1}. ${item}\n`));
    text += "\n";
  }
  if (mom.key_discussions.length) {
    text += "💬 Key Discussions:\n";
    mom.key_discussions.forEach((d, i) => (text += `${i + 1}. ${d}\n`));
    text += "\n";
  }
  if (mom.decisions.length) {
    text += "✅ Decisions:\n";
    mom.decisions.forEach((d, i) => (text += `${i + 1}. ${d}\n`));
    text += "\n";
  }
  if (mom.action_items.length) {
    text += "🎯 Action Items:\n";
    mom.action_items.forEach((a, i) => {
      const t =
        typeof a === "string"
          ? a
          : `${a.task || a.action || ""}${a.owner ? " — " + a.owner : ""}${
              a.due_date ? " (Due: " + a.due_date + ")" : ""
            }`;
      text += `${i + 1}. ${t}\n`;
    });
    text += "\n";
  }
  if (mom.attendees.length) {
    text += "👥 Attendees: " + mom.attendees.join(", ") + "\n\n";
  }
  if (mom.questions_raised.length) {
    text += "❓ Questions Raised:\n";
    mom.questions_raised.forEach((q, i) => (text += `${i + 1}. ${q}\n`));
    text += "\n";
  }
  if (mom.keywords.length) {
    text += "🏷 Keywords: " + mom.keywords.join(", ") + "\n\n";
  }
  if (mom.notes) {
    text += "🗒 Notes:\n" + mom.notes + "\n";
  }
  return text;
};
