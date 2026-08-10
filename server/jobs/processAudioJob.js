import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import eventBus from "../services/eventBus.js";
import Meeting from "../models/meetingModel.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "../services/knowledgeGraphService.js";
import User from "../models/userModel.js";
import { createAndPushNotification } from "../services/notificationService.js";

export default async function processAudioJob(job, app) {
  const { meetingId, transcript, date, title, userId } = job.data;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

  let textToSummarize = (transcript || "").trim();

  // Fetch meeting transcript if only meetingId is provided
  let meeting = null;
  if (meetingId && !textToSummarize) {
    meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }
    textToSummarize = (meeting.transcript || "").trim();
  }

  if (!textToSummarize) {
    throw new Error("No transcript provided.");
  }

  console.log(`🧠 Generating MoM for ${meetingId || "transcript-only"}...`);

  // ======= Build Professional MoM Prompt =======
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

  let structured = null;
  let humanReadable = "";

  try {
    console.log(`📡 Using Gemini model: ${GEMINI_MODEL}`);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    const result = await model.generateContent(prompt);
    const outputText = result.response.text();

    try {
      structured = JSON.parse(outputText);
    } catch (e) {
      const match = outputText.match(/\{[\s\S]*\}/);
      structured = match ? JSON.parse(match[0]) : { rawText: outputText };
    }

    console.log("✅ Gemini response received");
  } catch (gemErr) {
    console.error(
      "❌ Gemini API error, falling back to HuggingFace:",
      gemErr.message,
    );

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

      structured = {
        title: title || `Meeting on ${date}`,
        date: date,
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

      console.log("✅ HuggingFace fallback completed");
    } catch (hfErr) {
      console.error("❌ HuggingFace also failed:", hfErr.message);
      throw new Error("Both Gemini and HuggingFace summarization failed");
    }
  }

  if (structured) {
    const mom = {
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
    };

    humanReadable += `📘 Overview:\n${mom.summary}\n\n`;
    humanReadable += `📅 Title: ${mom.title}\n`;
    humanReadable += `Date: ${new Date(mom.date).toLocaleDateString()}\n\n`;
    humanReadable += `📝 Summary:\n${mom.summary}\n\n`;

    if (mom.agenda.length) {
      humanReadable += "📋 Agenda:\n";
      mom.agenda.forEach(
        (item, i) => (humanReadable += `${i + 1}. ${item}\n`),
      );
      humanReadable += "\n";
    }

    if (mom.key_discussions.length) {
      humanReadable += "💬 Key Discussions:\n";
      mom.key_discussions.forEach(
        (d, i) => (humanReadable += `${i + 1}. ${d}\n`),
      );
      humanReadable += "\n";
    }

    if (mom.decisions.length) {
      humanReadable += "✅ Decisions:\n";
      mom.decisions.forEach(
        (d, i) => (humanReadable += `${i + 1}. ${d}\n`),
      );
      humanReadable += "\n";
    }

    if (mom.action_items.length) {
      humanReadable += "🎯 Action Items:\n";
      mom.action_items.forEach((a, i) => {
        const text =
          typeof a === "string"
            ? a
            : `${a.task || a.action || ""}${a.owner ? " — " + a.owner : ""}${
                a.due_date ? " (Due: " + a.due_date + ")" : ""
              }`;
        humanReadable += `${i + 1}. ${text}\n`;
      });
      humanReadable += "\n";
    }

    if (mom.attendees.length) {
      humanReadable += "👥 Attendees: " + mom.attendees.join(", ") + "\n\n";
    }
    if (mom.questions_raised.length) {
      humanReadable += "❓ Questions Raised:\n";
      mom.questions_raised.forEach(
        (q, i) => (humanReadable += `${i + 1}. ${q}\n`),
      );
      humanReadable += "\n";
    }
    if (mom.keywords.length) {
      humanReadable += "🏷 Keywords: " + mom.keywords.join(", ") + "\n\n";
    }
    if (mom.notes) {
      humanReadable += "🗒 Notes:\n" + mom.notes + "\n";
    }

    let meetingToUpdate = meeting;

    if (!meetingToUpdate && meetingId) {
      meetingToUpdate = await Meeting.findById(meetingId);
    }

    if (!meetingToUpdate && !meetingId) {
      const user = await User.findById(userId);
      const userOrg = user?.organization || null;

      meetingToUpdate = await Meeting.create({
        uploadedBy: userId,
        organization: userOrg,
        title: mom.title,
        date: new Date(date),
        transcript: "", // E2EE: Do not save plaintext
        summary: "", // E2EE: Do not save plaintext
        structuredMoM: null, // E2EE: Do not save plaintext
        status: "completed",
      });
      // Skip indexing since it's encrypted
    } else if (meetingToUpdate) {
      meetingToUpdate.title = mom.title;
      meetingToUpdate.date = new Date(date);
      // E2EE: We do not save plaintext MoM. The client will encrypt and save it via a separate PATCH request.
      await meetingToUpdate.save();
    }

    console.log("✅ MoM saved to database");

    // Trigger internal events for webhooks
    try {
      if (!meetingId) {
        eventBus.emit("meeting.created", meetingToUpdate);
      }
      eventBus.emit("mom.generated", meetingToUpdate);
    } catch (evtErr) {
      console.error(
        "⚠️ Failed to emit webhook events from queue:",
        evtErr.message,
      );
    }

    if (meetingToUpdate) {
      try {
        await detectResolutions(meetingToUpdate, mom);
        await processStructuredMoM(meetingToUpdate, mom);
      } catch (kgError) {
        console.error(
          "⚠️ Knowledge graph processing failed (non-fatal):",
          kgError,
        );
      }

      const io = app ? app.get("io") : null;
      if (io && userId) {
        try {
          await createAndPushNotification(
            io,
            userId,
            "Minutes of Meeting Generated",
            `MoM for "${meetingToUpdate.title}" is ready.`,
            "ai_processing",
            `/meeting/${meetingToUpdate._id}`,
            "View MoM",
          );
          // Send Socket.IO direct notification
          io.to(userId.toString()).emit("mom-generation-complete", {
            meetingId: meetingToUpdate._id,
            title: meetingToUpdate.title,
            summary: meetingToUpdate.summary,
            mom: meetingToUpdate.structuredMoM,
          });
        } catch (notifErr) {
          console.error(
            "⚠️ Notification error (continuing):",
            notifErr.message,
          );
        }
      }
    }

    return { success: true, meetingId: meetingToUpdate?._id };
  }

  throw new Error("No summary generated");
}
