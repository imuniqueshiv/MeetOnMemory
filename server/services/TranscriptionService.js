import fs from "fs";
import axios from "axios";
import { validatePath } from "../utils/fileUtils.js";

const USE_WHISPER = false;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export const _pollAssemblyAI = async (transcriptId, intervalMs = 2500) => {
  while (true) {
    const checkRes = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { authorization: ASSEMBLYAI_API_KEY } },
    );
    if (checkRes.data.status === "completed") {
      return checkRes.data.text || "";
    }
    if (checkRes.data.status === "error") {
      throw new Error(checkRes.data.error || "AssemblyAI transcription error");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};

export const _startAssemblyAIJob = async (filePath) => {
  const uploadRes = await axios.post(
    "https://api.assemblyai.com/v2/upload",
    fs.readFileSync(validatePath(filePath)),
    {
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        "Transfer-Encoding": "chunked",
      },
    },
  );

  const audioUrl = uploadRes.data.upload_url;

  const transcriptRes = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    { audio_url: audioUrl },
    { headers: { authorization: ASSEMBLYAI_API_KEY } },
  );

  return transcriptRes.data.id;
};

export const transcribeFile = async (filePath) => {
  if (USE_WHISPER) {
    throw new Error("Whisper path not enabled in this build.");
  }
  const jobId = await _startAssemblyAIJob(filePath);
  return _pollAssemblyAI(jobId);
};

export const transcribeAudioUrl = async (audioUrl) => {
  const transcriptRes = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    { audio_url: audioUrl },
    { headers: { authorization: ASSEMBLYAI_API_KEY } },
  );
  return await _pollAssemblyAI(transcriptRes.data.id, 2000);
};

// New functions for live meeting transcription with segments
export const transcribeAudioWithSegments = async (audioUrl) => {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("Missing ASSEMBLYAI_API_KEY");
  }

  const transcriptRes = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    {
      audio_url: audioUrl,
      speaker_labels: true,
      punctuate: true,
      format_text: true,
    },
    { headers: { authorization: ASSEMBLYAI_API_KEY } },
  );

  const transcriptId = transcriptRes.data.id;

  while (true) {
    const checkRes = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { authorization: ASSEMBLYAI_API_KEY } },
    );

    if (checkRes.data.status === "completed") {
      const data = checkRes.data;
      return {
        fullText: data.text || "",
        segments: (data.utterances || []).map((utt) => ({
          speaker: utt.speaker || "Unknown",
          text: utt.text || "",
          startTime: utt.start || 0,
          endTime: utt.end || 0,
          confidence: utt.confidence || 1.0,
        })),
      };
    }

    if (checkRes.data.status === "error") {
      throw new Error(checkRes.data.error || "AssemblyAI transcription error");
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
};

export const transcribeFileWithSegments = async (filePath) => {
  const jobId = await _startAssemblyAIJob(filePath);
  
  while (true) {
    const checkRes = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${jobId}`,
      { headers: { authorization: ASSEMBLYAI_API_KEY } },
    );

    if (checkRes.data.status === "completed") {
      const data = checkRes.data;
      return {
        fullText: data.text || "",
        segments: (data.utterances || []).map((utt) => ({
          speaker: utt.speaker || "Unknown",
          text: utt.text || "",
          startTime: utt.start || 0,
          endTime: utt.end || 0,
          confidence: utt.confidence || 1.0,
        })),
      };
    }

    if (checkRes.data.status === "error") {
      throw new Error(checkRes.data.error || "AssemblyAI transcription error");
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
};
