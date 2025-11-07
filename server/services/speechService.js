/**
 * speechService.js
 * Handles voice-to-text transcription for voice-based search or meeting uploads.
 *
 * APIs Supported:
 * 1. AssemblyAI (default)
 * 2. Gemini API (fallback)
 */

import axios from "axios";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/* =========================================================
   1️⃣ TRANSCRIBE AUDIO WITH ASSEMBLYAI
   ========================================================= */
export const transcribeAudio = async (audioUrl) => {
  try {
    if (!ASSEMBLYAI_API_KEY) throw new Error("Missing AssemblyAI API key");
    if (!audioUrl) throw new Error("Audio URL is required for transcription");

    console.log("🎙️ Transcribing via AssemblyAI:", audioUrl);

    // Step 1: Start a transcription job
    const transcriptRes = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      { audio_url: audioUrl },
      {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    const transcriptId = transcriptRes.data.id;

    // Step 2: Poll for completion
    let transcriptData;
    while (true) {
      const checkRes = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        { headers: { authorization: ASSEMBLYAI_API_KEY } }
      );
      if (checkRes.data.status === "completed") {
        transcriptData = checkRes.data;
        break;
      } else if (checkRes.data.status === "error") {
        throw new Error(checkRes.data.error || "AssemblyAI transcription failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2 sec
    }

    console.log("✅ Transcription complete via AssemblyAI");
    return transcriptData.text || "";
  } catch (error) {
    console.error("❌ AssemblyAI error:", error.message);
    console.log("⚠️ Falling back to Gemini transcription...");
    return await transcribeWithGemini(audioUrl);
  }
};

/* =========================================================
   2️⃣ GEMINI FALLBACK TRANSCRIPTION
   ========================================================= */
export const transcribeWithGemini = async (audioUrl) => {
  try {
    if (!GEMINI_API_KEY) throw new Error("Missing Gemini API key");

    const body = {
      contents: [
        {
          parts: [
            { text: `Transcribe this audio file into plain text: ${audioUrl}` },
          ],
        },
      ],
    };

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateText",
      body,
      {
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("✅ Transcription completed via Gemini fallback");
    return text;
  } catch (error) {
    console.error("❌ Gemini transcription failed:", error.message);
    throw new Error("Both AssemblyAI and Gemini transcription failed");
  }
};
