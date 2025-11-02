import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import Meeting from "../models/meetingModel.js";

// === Configuration Flags ===
const USE_WHISPER = false; // set true to use OpenAI Whisper
const USE_OPENAI_SUMMARY = false; // set true to use GPT-4-mini instead of HuggingFace

// === API Keys ===
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

/* ============================================================
   🟢 Upload & Transcription Logic
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

    // ------------------------------------------------
    // OPTION 1: OpenAI Whisper Transcription
    // ------------------------------------------------
    if (USE_WHISPER) {
      console.log("🎙 Using OpenAI Whisper API for transcription...");

      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath));
      formData.append("model", "whisper-1");

      const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Project": OPENAI_PROJECT_ID,
        },
      });

      transcriptText = response.data.text;
      console.log("✅ Whisper transcription completed!");
    }

    // ------------------------------------------------
    // OPTION 2: AssemblyAI Transcription (Default)
    // ------------------------------------------------
    else {
      console.log("🎤 Uploading to AssemblyAI for transcription...");

      // Step 1 — Upload file
      const uploadRes = await axios.post("https://api.assemblyai.com/v2/upload", fs.readFileSync(filePath), {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "Transfer-Encoding": "chunked",
        },
      });

      const audioUrl = uploadRes.data.upload_url;
      console.log("✅ File uploaded to AssemblyAI:", audioUrl);

      // Step 2 — Start transcription job
      const transcriptRes = await axios.post(
        "https://api.assemblyai.com/v2/transcript",
        { audio_url: audioUrl },
        { headers: { authorization: ASSEMBLYAI_API_KEY } }
      );

      const transcriptId = transcriptRes.data.id;
      console.log("⏳ Transcription job started:", transcriptId);

      // Step 3 — Poll for completion (every 5s)
      let transcriptData;
      const startTime = Date.now();

      while (true) {
        const checkRes = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { authorization: ASSEMBLYAI_API_KEY },
        });

        if (checkRes.data.status === "completed") {
          transcriptData = checkRes.data;
          console.log("✅ Transcription completed in", ((Date.now() - startTime) / 1000).toFixed(1), "seconds.");
          break;
        } else if (checkRes.data.status === "error") {
          throw new Error(checkRes.data.error || "AssemblyAI transcription failed.");
        }

        console.log("⌛ Waiting for AssemblyAI transcription...");
        await new Promise((r) => setTimeout(r, 5000));
      }

      transcriptText = transcriptData.text;
    }

    // ------------------------------------------------
    // Save Transcription in MongoDB
    // ------------------------------------------------
  // ✅ Save meeting record to MongoDB
const meeting = await Meeting.create({
  uploadedBy: req.user?._id, // must match schema field
  organization: req.user?.organization || null,
  title: req.body.title || "Untitled Meeting",
  fileUrl: req.file.path,
  transcript: transcriptText,
  summary: "",
  status: "completed",
});


    // Clean up temporary upload
    fs.unlinkSync(filePath);

    return res.status(200).json({
      success: true,
      message: "Meeting transcribed successfully!",
      meetingId: meeting._id,
      transcript: transcriptText,
    });
  } catch (error) {
    console.error("❌ uploadMeeting Error:", error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error || error.message || "Server error during upload",
    });
  }
};

/* ============================================================
   🧠 AI Summarization Logic
   ============================================================ */
export const summarizeMeeting = async (req, res) => {
  try {
    const { meetingId, transcript } = req.body;
    let textToSummarize = transcript;

    // Retrieve transcript from DB if only ID provided
    if (meetingId && !transcript) {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting)
        return res.status(404).json({ success: false, message: "Meeting not found" });
      textToSummarize = meeting.transcript;
    }

    if (!textToSummarize || textToSummarize.length < 40) {
      return res.status(400).json({
        success: false,
        message: "Transcript too short or missing for summarization",
      });
    }

    let summaryText = "";

    // ------------------------------------------------
    // OPTION 1: OpenAI GPT-4o-mini Summarization
    // ------------------------------------------------
    if (USE_OPENAI_SUMMARY) {
      console.log("🧠 Using OpenAI GPT-4o-mini for summarization...");
      const openaiRes = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an AI that creates clear and structured meeting summaries including topics, decisions, and action points.",
            },
            { role: "user", content: textToSummarize },
          ],
          max_tokens: 600,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Project": OPENAI_PROJECT_ID,
          },
        }
      );

      summaryText = openaiRes.data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
      console.log("✅ OpenAI summarization complete!");
    }

    // ------------------------------------------------
    // OPTION 2: Hugging Face (Default)
    // ------------------------------------------------
    else {
      console.log("📄 Summarizing with Hugging Face model...");
      const hfRes = await axios.post(
        "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
        { inputs: textToSummarize },
        {
          headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}` },
        }
      );

      if (Array.isArray(hfRes.data)) {
        summaryText = hfRes.data[0]?.summary_text || "No summary generated.";
      } else if (hfRes.data?.summary_text) {
        summaryText = hfRes.data.summary_text;
      } else {
        summaryText = "No summary generated.";
      }

      console.log("✅ Hugging Face summarization complete!");
    }

    // ------------------------------------------------
    // Save Summary to MongoDB
    // ------------------------------------------------
    if (meetingId) {
      await Meeting.findByIdAndUpdate(meetingId, { summary: summaryText }, { new: true });
    }

    return res.status(200).json({
      success: true,
      message: "AI summary generated successfully",
      summary: summaryText,
    });
  } catch (error) {
    console.error("❌ summarizeMeeting Error:", error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error || error.message || "AI summarization failed",
    });
  }
};

/* ============================================================
   📚 Get All Meetings (for dashboard)
   ============================================================ */
export const getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ uploadedBy: req.user.id })
      .sort({ createdAt: -1 })
      .select("title summary transcript createdAt");

    res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error("❌ getAllMeetings Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings",
    });
  }
};
