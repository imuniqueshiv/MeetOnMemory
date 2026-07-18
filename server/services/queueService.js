import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import eventBus from "./eventBus.js";
import Meeting from "../models/meetingModel.js";
import { indexMeeting } from "../utils/embeddingUtils.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "./knowledgeGraphService.js";
import { createAndPushNotification } from "./notificationService.js";
import userModel from "../models/userModel.js";
import membershipModel from "../models/membershipModel.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import jwt from "jsonwebtoken";
import transporter from "../config/nodeMailer.js";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const redisUri = process.env.REDIS_URI;

// BullMQ requires maxRetriesPerRequest to be null
let _producerConnection = null;
let _workerConnection = null;
let _aiQueueInstance = null;
let _dataExportQueueInstance = null;

function getProducerConnection() {
  if (!redisUri) return null;
  if (!_producerConnection) {
    _producerConnection = new Redis(redisUri, {
      maxRetriesPerRequest: 3, // Fail fast for requests adding tasks to queue
      family: 0,
    });
    _producerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Producer Redis Connection Error:", err.message);
    });
  }
  return _producerConnection;
}

function getWorkerConnection() {
  if (!redisUri) return null;
  if (!_workerConnection) {
    _workerConnection = new Redis(redisUri, {
      maxRetriesPerRequest: null, // Unlimited retries for background workers
      family: 0, // Helps with DNS resolution for some cloud providers
    });
    _workerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Worker Redis Connection Error:", err.message);
    });
  }
  return _workerConnection;
}

function getAiQueue() {
  if (!redisUri) return null;
  if (!_aiQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _aiQueueInstance = new Queue("ai-mom-generation", { connection: conn });
    }
  }
  return _aiQueueInstance;
}

function getDataExportQueue() {
  if (!redisUri) return null;
  if (!_dataExportQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _dataExportQueueInstance = new Queue("data-export-queue", { connection: conn });
    }
  }
  return _dataExportQueueInstance;
}

// Wrapper to preserve syntax compatibility
export const aiQueue = {
  add: async (...args) => {
    const q = getAiQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getAiQueue() !== null;
  }
};

export const dataExportQueue = {
  add: async (...args) => {
    const q = getDataExportQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getDataExportQueue() !== null;
  }
};

export const initAIWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. AI Worker will not start.");
    return;
  }

  const worker = new Worker(
    "ai-mom-generation",
    async (job) => {
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
          meetingToUpdate = await Meeting.create({
            uploadedBy: userId,
            title: mom.title,
            date: new Date(date),
            transcript: textToSummarize,
            summary: humanReadable,
            structuredMoM: mom,
            status: "completed",
          });
          await indexMeeting(meetingToUpdate);
        } else if (meetingToUpdate) {
          meetingToUpdate.title = mom.title;
          meetingToUpdate.date = new Date(date);
          meetingToUpdate.summary = humanReadable;
          meetingToUpdate.structuredMoM = mom;
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

          const io = app.get("io");
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
    },
    { connection, concurrency: 5 }, // Handle up to 5 concurrent jobs
  );

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job.id} failed with error:`, err.message);
  });

  console.log(
    "✅ AI Worker initialized and listening to ai-mom-generation queue",
  );
};

export const initDataExportWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. Data Export Worker will not start.");
    return;
  }

  const worker = new Worker(
    "data-export-queue",
    async (job) => {
      const { userId, email } = job.data;
      console.log(`📦 Starting data export for user ${userId}...`);

      try {
        // Fetch User Data
        const user = await userModel.findById(userId).lean();
        if (!user) throw new Error("User not found");

        // Fetch Meetings
        const meetings = await Meeting.find({ uploadedBy: userId }).lean();

        // Fetch Memberships
        const memberships = await membershipModel.find({ user: userId }).lean();

        const exportDir = path.join(__dirname, "..", "uploads", "exports");
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }

        const fileName = `export_${userId}_${Date.now()}.zip`;
        const filePath = path.join(exportDir, fileName);

        // archiver v8+ is a pure ES Module — must be loaded via dynamic import()
        const { default: archiver } = await import("archiver");

        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(filePath);
          const archive = archiver("zip", { zlib: { level: 9 } });

          output.on("close", resolve);
          archive.on("error", reject);
          archive.on("warning", (err) => {
            if (err.code === "ENOENT") console.warn(err);
            else reject(err);
          });

          archive.pipe(output);
          archive.append(JSON.stringify(user, null, 2), { name: "user_profile.json" });
          archive.append(JSON.stringify(meetings, null, 2), { name: "meetings.json" });
          archive.append(JSON.stringify(memberships, null, 2), { name: "memberships.json" });
          archive.finalize();
        });

        console.log(`✅ Data export for user ${userId} saved to ${filePath}`);

        // Generate Secure Download Link
        const jwtSecret = process.env.JWT_SECRET || "fallback_secret";
        const downloadToken = jwt.sign({ userId, fileName }, jwtSecret, { expiresIn: "24h" });
        
        // In production, BASE_URL should be configured correctly in .env
        const baseUrl = process.env.BASE_URL || "http://localhost:3000";
        const downloadUrl = `${baseUrl}/api/user/download-export/${downloadToken}`;

        // Send Email
        const mailOptions = {
          from: process.env.SMTP_USER || "no-reply@meetonmemory.com",
          to: email,
          subject: "Your Data Export is Ready",
          html: `
            <h2>Data Export Completed</h2>
            <p>Your requested data export is ready. You can download it using the link below:</p>
            <p><a href="${downloadUrl}">Download Data Export</a></p>
            <p><strong>Note:</strong> This link will expire in 24 hours.</p>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Notification email sent to ${email}`);

        const io = app.get("io");
        if (io) {
          await createAndPushNotification(
            io,
            userId,
            "Data Export Ready",
            "Your data export has been completed and emailed to you.",
            "system",
            downloadUrl,
            "Download"
          );
        }

        return { success: true, fileName };
      } catch (error) {
        console.error(`❌ Data export failed for user ${userId}:`, error.message);
        throw error;
      }
    },
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Data Export Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Data Export Job ${job.id} failed with error:`, err.message);
  });

  console.log("✅ Data Export Worker initialized and listening to data-export-queue");
};