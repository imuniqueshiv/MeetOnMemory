// server/controllers/meetingController.js
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import Meeting from "../models/meetingModel.js";
import { indexMeeting } from "../utils/embeddingUtils.js";

const USE_WHISPER = false; // if you want to use OpenAI Whisper
const USE_OPENAI_SUMMARY = false; // if you want to use OpenAI summarization instead of HF

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

/* ============================================================
   Upload & Transcription
   - Saves meeting to DB + indexes it (indexMeeting)
   - Uses AssemblyAI by default (works fine for hackathon)
   ============================================================ */
export const uploadMeeting = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file uploaded. Please upload a valid meeting recording.",
      });
    }

    const filePath = req.file.path;
    let transcriptText = "";

    // Option 1: OpenAI Whisper (if enabled)
    if (USE_WHISPER) {
      console.log("🎙 Using OpenAI Whisper API for transcription...");
      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath));
      formData.append("model", "whisper-1");

      const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          ...(OPENAI_PROJECT_ID ? { "OpenAI-Project": OPENAI_PROJECT_ID } : {}),
        },
      });

      transcriptText = response.data?.text || "";
      console.log("✅ Whisper transcription completed!");
    } else {
      // Option 2: AssemblyAI (default)
      console.log("🎤 Uploading to AssemblyAI for transcription...");

      const uploadRes = await axios.post(
        "https://api.assemblyai.com/v2/upload",
        fs.readFileSync(filePath),
        {
          headers: {
            authorization: ASSEMBLYAI_API_KEY,
            "Transfer-Encoding": "chunked",
          },
        }
      );

      const audioUrl = uploadRes.data.upload_url;
      console.log("✅ File uploaded to AssemblyAI:", audioUrl);

      // Create transcription job
      const transcriptRes = await axios.post(
        "https://api.assemblyai.com/v2/transcript",
        { audio_url: audioUrl },
        { headers: { authorization: ASSEMBLYAI_API_KEY } }
      );

      const transcriptId = transcriptRes.data.id;
      console.log("⏳ Transcription job started:", transcriptId);

      // Poll for completion
      let transcriptData;
      const start = Date.now();
      while (true) {
        const checkRes = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { authorization: ASSEMBLYAI_API_KEY },
        });

        if (checkRes.data.status === "completed") {
          transcriptData = checkRes.data;
          console.log("✅ Transcription completed in", ((Date.now() - start) / 1000).toFixed(1), "s");
          break;
        } else if (checkRes.data.status === "error") {
          throw new Error(checkRes.data.error || "AssemblyAI transcription failed.");
        }

        await new Promise((r) => setTimeout(r, 3000));
      }

      transcriptText = transcriptData.text || "";
    }

    // Save meeting to DB
    const meeting = await Meeting.create({
      uploadedBy: req.user?._id || null,
      organization: req.user?.organization || null,
      title: req.body.title || `Untitled Meeting - ${Date.now()}`,
      fileUrl: req.file.path,
      transcript: transcriptText,
      summary: "",
      status: "completed",
    });

    // Index into Pinecone (await so indexing finishes or errors are logged)
    try {
      await indexMeeting(meeting);
    } catch (idxErr) {
      console.error("❌ indexMeeting error (continuing):", idxErr);
    }

    // Remove temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      // non-fatal
      console.warn("⚠️ Could not delete temp upload:", e.message || e);
    }

    return res.status(200).json({
      success: true,
      message: "Meeting transcribed successfully",
      meetingId: meeting._id,
      transcript: transcriptText,
    });
  } catch (error) {
    console.error("❌ uploadMeeting Error:", error.response?.data || error.message || error);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.error || error.message || "Server error during upload",
    });
  }
};

/* ============================================================
   Summarization endpoint — accepts:
     - { meetingId }  OR
     - { transcript }
   Falls back to Hugging Face inference router endpoint.
   Handles different response shapes.
   ============================================================ */
export const summarizeMeeting = async (req, res) => {
  try {
    const { meetingId, transcript } = req.body;

    let textToSummarize = (transcript || "").trim();

    if (!textToSummarize && meetingId) {
      // fetch meeting from DB
      const meeting = await Meeting.findById(meetingId).lean();
      if (!meeting) {
        return res.status(404).json({ success: false, message: "Meeting not found." });
      }
      textToSummarize = (meeting.transcript || "").trim();
    }

    if (!textToSummarize) {
      return res.status(400).json({ success: false, message: "No transcript provided." });
    }

    console.log("📄 Summarizing text (length):", textToSummarize.length);

    // Use Hugging Face router inference
    const hfUrl = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn";

    const hfResponse = await axios.post(
      hfUrl,
      { inputs: textToSummarize },
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000, // 2 min, summarization may take time
      }
    );

    console.log("✅ Hugging Face raw response:", typeof hfResponse.data === "object" ? hfResponse.data : "[non-json]");

    // Normalize possible response shapes
    let summaryText = "";

    if (Array.isArray(hfResponse.data) && hfResponse.data[0]?.summary_text) {
      summaryText = hfResponse.data[0].summary_text;
    } else if (hfResponse.data?.summary_text) {
      summaryText = hfResponse.data.summary_text;
    } else if (hfResponse.data?.generated_text) {
      summaryText = hfResponse.data.generated_text;
    } else if (hfResponse.data?.results?.[0]?.summary_text) {
      summaryText = hfResponse.data.results[0].summary_text;
    } else if (typeof hfResponse.data === "string") {
      summaryText = hfResponse.data;
    } else {
      // best-effort: try to stringify and fallback
      summaryText = JSON.stringify(hfResponse.data).slice(0, 2000);
    }

    // Save summary back to meeting if meetingId provided
    if (meetingId) {
      await Meeting.findByIdAndUpdate(meetingId, { summary: summaryText }, { new: true });
    }

    return res.status(200).json({ success: true, summary: summaryText });
  } catch (error) {
    console.error("❌ summarizeMeeting Error:", error.response?.data || error.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate summary.",
      error: error.response?.data || error.message,
    });
  }
};

/* ============================================================
   Fetch meetings for user (used by dashboard)
   ============================================================ */
export const getAllMeetings = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const meetings = await Meeting.find({ uploadedBy: userId })
      .sort({ createdAt: -1 })
      .select("title summary transcript createdAt");

    return res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error("❌ getAllMeetings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch meetings" });
  }
};
