import Transcript from "../models/transcriptModel.js";
import RecordingSession from "../models/RecordingSession.js";
import { translateContent } from "../services/translationService.js";
import Meeting from "../models/meetingModel.js";
import Organization from "../models/organizationModel.js";
import AuditLog from "../models/auditLogModel.js";
import { transcribeFileWithSegments } from "../services/TranscriptionService.js";
import {
  indexTranscript,
  searchVectorStore,
  indexMeeting,
} from "../utils/embeddingUtils.js";
import { indexTranscriptChunks } from "../utils/transcriptEmbeddingUtils.js";
import { getContentDispositionHeader } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";
import {
  isE2eeEnabled,
  isOrgE2eeEnabled,
  isOrgE2eeEnforced,
  normalizeEncryptedTranscriptPayload,
  isMeetingTranscriptEncrypted,
} from "../utils/transcriptEncryption.js";
import fs from "fs";
import path from "path";
import os from "os";
import OpenAI from "openai";

import { sentimentAnalysisQueue } from "../services/queueService.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-tests",
});

/** In-progress statuses: "recording" (session) + legacy "active" (live chunks). */
const IN_PROGRESS_STATUSES = ["recording", "active"];

const findInProgressTranscript = (meetingId) =>
  Transcript.findOne({
    meeting: meetingId,
    status: { $in: IN_PROGRESS_STATUSES },
  });

const assertMeetingAccess = (meeting, user) => {
  const userId = user?.id || user?._id;
  const isOwner = meeting.uploadedBy?.toString() === userId?.toString();
  const isInSameOrg =
    meeting.organization &&
    user?.organization &&
    meeting.organization.toString() === user.organization.toString();
  return isOwner || isInSameOrg;
};

/**
 * @desc  Start a recording session for a meeting
 * @route POST /api/meetings/:meetingId/recording/start
 * @access Private (requires auth + org membership)
 */
export const startRecording = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Check if there's already an active recording
    const existingTranscript = await findInProgressTranscript(meetingId);

    if (existingTranscript) {
      return res.status(400).json({
        success: false,
        message: "Recording already in progress for this meeting",
      });
    }

    // Create new transcript document
    const transcript = new Transcript({
      meeting: meetingId,
      organizationId: meeting.organization,
      status: "recording",
      language: "en",
      recordingTimestamps: {
        recordingStartedAt: new Date(),
      },
    });

    await transcript.save();

    // Return room ID for Socket.IO
    const roomId = `meeting:${meetingId}:transcript`;

    res.status(200).json({
      success: true,
      message: "Recording started",
      roomId,
      transcriptId: transcript._id,
    });
  } catch (error) {
    console.error("Error starting recording:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to start recording",
    });
  }
};

/**
 * @desc  Stop a recording session and trigger transcription
 * @route POST /api/meetings/:meetingId/recording/stop
 * @access Private (requires auth + org membership)
 */
export const stopRecording = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find active recording transcript
    const transcript = await findInProgressTranscript(meetingId);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "No active recording found for this meeting",
      });
    }

    // Update transcript status to processing
    transcript.status = "processing";
    if (!transcript.recordingTimestamps) {
      transcript.recordingTimestamps = {};
    }
    transcript.recordingTimestamps.recordingEndedAt = new Date();
    transcript.recordingTimestamps.processingStartedAt = new Date();
    await transcript.save();

    // Trigger transcription in background (non-blocking)
    processTranscription(transcript._id).catch((err) => {
      console.error("Background transcription failed:", err);
    });

    res.status(200).json({
      success: true,
      message: "Recording stopped, transcription started",
      transcriptId: transcript._id,
    });
  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to stop recording",
    });
  }
};

/**
 * @desc  Upload audio chunk for transcript
 * @route POST /api/meetings/:meetingId/transcript/upload
 * @access Private (requires auth + org membership)
 */
export const uploadTranscriptAudio = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
      });
    }

    const ALLOWED_RECORDING_MIME_TYPES = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/m4a",
      "audio/x-m4a",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
      "audio/aac",
      "audio/mp4",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "application/octet-stream",
    ];

    const ALLOWED_RECORDING_EXTENSIONS = [
      ".mp3",
      ".wav",
      ".m4a",
      ".ogg",
      ".webm",
      ".flac",
      ".aac",
      ".mp4",
      ".mov",
      ".avi",
      ".mkv",
    ];

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const mimeType = req.file.mimetype;
    const isExtAllowed = !ext || ALLOWED_RECORDING_EXTENSIONS.includes(ext);
    const isMimeAllowed =
      !mimeType ||
      mimeType === "blob" ||
      ALLOWED_RECORDING_MIME_TYPES.includes(mimeType);

    if (!isExtAllowed || !isMimeAllowed) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // ignore
        }
      }
      return res.status(400).json({
        success: false,
        message: "Invalid file type or extension for meeting recording",
      });
    }

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find active recording transcript
    const transcript = await findInProgressTranscript(meetingId);

    if (!transcript) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "No active recording found for this meeting",
      });
    }

    // Store the file path for later processing
    // In a real implementation, you might stream this to AssemblyAI in real-time
    // For now, we'll store it and process on stop
    transcript.audioFilePath = req.file.path;
    await transcript.save();

    res.status(200).json({
      success: true,
      message: "Audio uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading transcript audio:", error);
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload audio",
    });
  }
};

/**
 * @desc  Upload audio chunk for live transcript and append
 * @route POST /api/meetings/:meetingId/transcript/chunk
 * @access Private
 */
export const uploadTranscriptChunk = async (req, res) => {
  let tempFilePath = null;
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No audio chunk provided",
      });
    }

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    let transcript = await Transcript.findOne({ meeting: meetingId });
    if (!transcript) {
      // Create transcript if it doesn't exist yet
      transcript = new Transcript({
        meeting: meetingId,
        organizationId: meeting.organization,
        status: "recording",
        language: "en",
        recordingTimestamps: {
          recordingStartedAt: new Date(),
        },
      });
    }

    // Write buffer to temp file for OpenAI Whisper
    const tempFileName = `chunk_${Date.now()}_${Math.floor(Math.random() * 1000)}.webm`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Call OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    const newText = transcription.text;

    if (newText && newText.trim().length > 0) {
      const segment = {
        text: newText,
        speaker: "Speaker", // Simple chunk logic might not diarize accurately
        startTime: transcript.duration,
        endTime: transcript.duration + 5, // Rough estimate
        confidence: 1.0,
      };

      transcript.segments.push(segment);
      transcript.fullText = (transcript.fullText + " " + newText).trim();
      transcript.duration += 5; // Rough estimate of chunk duration
      await transcript.save();

      // Update Meeting
      meeting.transcript = transcript.fullText;
      await meeting.save();
    }

    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // Update RecordingSession metric
    try {
      let session = await RecordingSession.findOne({
        meeting: meetingId,
        status: "IN_PROGRESS",
      });
      if (!session) {
        session = await RecordingSession.create({
          meeting: meetingId,
          user: userId,
          organization: meeting.organization || null,
          status: "IN_PROGRESS",
          startedAt: new Date(),
          lastHeartbeatAt: new Date(),
        });
      }
      session.chunkCount += 1;
      session.duration += 5;
      session.lastHeartbeatAt = new Date();
      await session.save();
    } catch (sessionErr) {
      console.warn("Failed to update RecordingSession for chunk:", sessionErr);
    }

    res.status(200).json({
      success: true,
      text: newText,
      fullText: transcript.fullText,
    });
  } catch (error) {
    console.error("Error processing transcript chunk:", error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    try {
      const { meetingId } = req.params;
      const session = await RecordingSession.findOne({
        meeting: meetingId,
        status: "IN_PROGRESS",
      });
      if (session) {
        session.retryCount += 1;
        session.failureReason =
          error.message || "Failed to process audio chunk";
        session.failureHistory.push({
          reason: error.message || "Failed to process audio chunk",
          timestamp: new Date(),
          chunkIndex: session.chunkCount,
        });
        session.lastHeartbeatAt = new Date();
        await session.save();
      }
    } catch (recErr) {
      console.warn("Failed to record error on RecordingSession:", recErr);
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to process audio chunk",
    });
  }
};

/**
 * @desc  Get transcript for a meeting
 * @route GET /api/meetings/:meetingId/transcript
 * @access Private (requires auth + org membership)
 */
export const getTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find transcript by canonical meeting field
    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "Transcript not found",
      });
    }

    res.status(200).json({
      success: true,
      transcript,
      // Issue #1335 — surface meeting-level ciphertext so clients can decrypt
      encryption: {
        enabled: isMeetingTranscriptEncrypted(meeting),
        encryptedTranscript: meeting.encryptedTranscript || null,
        e2eeFeatureEnabled: isE2eeEnabled(),
      },
    });
  } catch (error) {
    console.error("Error getting transcript:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get transcript",
    });
  }
};

/**
 * @desc  Persist a client-encrypted transcript (Issue #1335).
 * @route POST /api/meetings/:meetingId/transcript/encrypted
 * @access Private
 *
 * Server stores ciphertext only — never decrypts. Clears plaintext fields.
 */
export const storeEncryptedTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    if (!assertMeetingAccess(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Check E2EE flag at organization or server level (#2263)
    let org = null;
    if (meeting.organization) {
      if (
        typeof meeting.organization === "object" &&
        meeting.organization !== null
      ) {
        org = meeting.organization;
      } else if (
        typeof meeting.organization === "string" &&
        meeting.organization.length === 24 &&
        /^[0-9a-fA-F]{24}$/.test(meeting.organization)
      ) {
        try {
          org = await Organization.findById(meeting.organization).lean();
        } catch {
          org = null;
        }
      }
    }
    const e2eeAllowed = org ? isOrgE2eeEnabled(org) : isE2eeEnabled();

    if (!e2eeAllowed) {
      return res.status(403).json({
        success: false,
        message:
          "End-to-End Encryption is not enabled for this organization or server.",
      });
    }

    const normalized = normalizeEncryptedTranscriptPayload(req.body || {});
    if (!normalized.ok) {
      return res.status(400).json({
        success: false,
        message: normalized.message,
      });
    }

    const payload = normalized.payload;

    meeting.encryptedTranscript = payload;
    meeting.isTranscriptEncrypted = true;
    meeting.transcriptEncryptionVersion = payload.encryptionVersion;
    // Wipe plaintext — server must not retain readable transcript for E2EE meetings
    meeting.transcript = "";
    await meeting.save();

    let transcript = await Transcript.findOne({ meeting: meetingId });
    if (!transcript) {
      transcript = new Transcript({
        meeting: meetingId,
        organizationId: meeting.organization || null,
        status: "completed",
      });
    }
    transcript.encryptedFullText = payload;
    transcript.isEncrypted = true;
    transcript.fullText = "";
    transcript.segments = [];
    transcript.status = "completed";
    await transcript.save();

    return res.status(200).json({
      success: true,
      message: "Encrypted transcript stored",
      meetingId,
      isTranscriptEncrypted: true,
      encryptedTranscript: payload,
    });
  } catch (error) {
    console.error("Error storing encrypted transcript:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to store encrypted transcript",
    });
  }
};

/**
 * @desc  Retry failed transcription
 * @route POST /api/meetings/:meetingId/transcript/retry
 * @access Private (requires auth + org membership)
 */
export const retryTranscription = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find failed transcript
    const transcript = await Transcript.findOne({
      meeting: meetingId,
      status: "failed",
    });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "No failed transcript found for this meeting",
      });
    }

    // Reset status and retry
    transcript.status = "processing";
    if (!transcript.recordingTimestamps) {
      transcript.recordingTimestamps = {};
    }
    transcript.recordingTimestamps.processingStartedAt = new Date();
    transcript.errorMessage = null;
    await transcript.save();

    // Trigger transcription in background
    processTranscription(transcript._id).catch((err) => {
      console.error("Background transcription retry failed:", err);
    });

    res.status(200).json({
      success: true,
      message: "Transcription retry started",
      transcriptId: transcript._id,
    });
  } catch (error) {
    console.error("Error retrying transcription:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retry transcription",
    });
  }
};

/**
 * @desc  Voice-powered semantic search
 * @route GET /api/search/voice?query=...
 * @access Private (requires auth + org membership)
 */
export const voiceSearch = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid search query (minimum 3 characters)",
      });
    }

    const userOrg = req.user?.organization?.toString();
    if (!userOrg) {
      return res.status(400).json({
        success: false,
        message: "Organization context is required for voice search",
      });
    }

    console.log(`🎙️ Voice Search for query: "${query}"`);

    // Perform vector search across all content types scoped to user's org
    const results = await searchVectorStore(query, { organization: userOrg });

    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No relevant results found.",
        results: [],
      });
    }

    // Filter results to include only those belonging to user's organization
    const filteredResults = results.filter((r) => {
      if (!r.organization) return false;
      return r.organization.toString() === userOrg;
    });

    res.status(200).json({
      success: true,
      message: "Voice search successful",
      results: filteredResults,
    });
  } catch (error) {
    console.error("Error in voice search:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Voice search failed",
    });
  }
};

/**
 * Helper function to process transcription in background
 */
async function processTranscription(transcriptId) {
  try {
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      console.error("Transcript not found for processing");
      return;
    }

    if (!transcript.audioFilePath || !fs.existsSync(transcript.audioFilePath)) {
      throw new Error("Audio file not found");
    }

    console.log(`🎙️ Processing transcription for transcript ${transcriptId}`);

    // Transcribe audio with segments
    const transcriptionResult = await transcribeFileWithSegments(
      transcript.audioFilePath,
    );

    // Update transcript with results
    transcript.fullText = transcriptionResult.fullText;
    transcript.segments = transcriptionResult.segments;
    transcript.status = "completed";
    if (!transcript.recordingTimestamps) {
      transcript.recordingTimestamps = {};
    }
    transcript.recordingTimestamps.completedAt = new Date();
    await transcript.save();

    // Clean up audio file
    if (fs.existsSync(transcript.audioFilePath)) {
      fs.unlinkSync(transcript.audioFilePath);
    }

    console.log(`✅ Transcription completed for transcript ${transcriptId}`);

    // Index transcript in Pinecone for search
    await indexTranscript(transcript);

    // Update meeting with transcript reference
    const meetingRef = transcript.meeting?._id || transcript.meeting;
    await Meeting.findByIdAndUpdate(meetingRef, {
      transcript: transcriptionResult.fullText,
    });

    console.log(`✅ Transcript indexed and meeting updated`);

    // Queue sentiment analysis job
    if (sentimentAnalysisQueue.isActive) {
      await sentimentAnalysisQueue.add("analyze-sentiment", { transcriptId });
      console.log(
        `✅ Sentiment analysis queued for transcript ${transcriptId}`,
      );
    }
  } catch (error) {
    console.error("❌ Transcription processing failed:", error);

    // Update transcript status to failed
    const transcript = await Transcript.findById(transcriptId);
    if (transcript) {
      transcript.status = "failed";
      transcript.errorMessage = error.message;
      await transcript.save();
    }
  }
}
/**
 * Get transcript by meeting ID
 */
export const getTranscriptByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({
      meeting: meetingId,
    }).populate(
      "meeting",
      "title date participants uploadedBy organization transcript encryptedTranscript isTranscriptEncrypted fileUrl",
    );

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    const meeting = transcript.meeting;
    sendSuccess(res, {
      ...transcript.toObject(),
      encryption: {
        enabled: isMeetingTranscriptEncrypted(meeting),
        encryptedTranscript: meeting?.encryptedTranscript || null,
        e2eeFeatureEnabled: isE2eeEnabled(),
      },
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    sendError(res, 500, "Failed to fetch transcript");
  }
};

/**
 * Search within a transcript
 */
export const searchTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { query } = req.body;

    if (!query || query.trim() === "") {
      return sendError(res, 400, "Search query is required");
    }

    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    if (transcript.isEncrypted || !transcript.fullText) {
      const meeting = await Meeting.findById(meetingId).select(
        "encryptedTranscript isTranscriptEncrypted",
      );
      if (isMeetingTranscriptEncrypted(meeting) || transcript.isEncrypted) {
        return sendError(
          res,
          400,
          "Server-side search is unavailable for end-to-end encrypted transcripts. Decrypt locally to search.",
        );
      }
    }

    const searchTerms = query.toLowerCase().split(" ");
    const matchingSegments = transcript.segments.filter((segment) =>
      searchTerms.some((term) => segment.text.toLowerCase().includes(term)),
    );

    sendSuccess(res, {
      query,
      matches: matchingSegments,
      totalMatches: matchingSegments.length,
    });
  } catch (error) {
    console.error("Error searching transcript:", error);
    sendError(res, 500, "Failed to search transcript");
  }
};

/**
 * Export transcript as text
 */
export const exportTranscriptAsText = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({
      meeting: meetingId,
    }).populate("meeting", "title date");

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    const meeting = transcript.meeting;
    const textContent = [
      `Meeting: ${meeting.title}`,
      `Date: ${meeting.date?.toLocaleDateString() || "N/A"}`,
      `Duration: ${Math.floor(transcript.duration / 60)}:${Math.floor(
        transcript.duration % 60,
      )
        .toString()
        .padStart(2, "0")}`,
      "",
      "TRANSCRIPT",
      "=".repeat(50),
      "",
    ];

    transcript.segments.forEach((segment) => {
      const timestamp = formatTimestamp(segment.startTime);
      textContent.push(`[${timestamp}] ${segment.speaker}:`);
      textContent.push(segment.text);
      textContent.push("");
    });

    const filename = `transcript-${meetingId}.txt`;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", getContentDispositionHeader(filename));
    res.send(textContent.join("\n"));
  } catch (error) {
    console.error("Error exporting transcript as text:", error);
    sendError(res, 500, "Failed to export transcript");
  }
};

/**
 * Export transcript as PDF
 */
export const exportTranscriptAsPDF = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const PDFDocument = await import("pdfkit");
    const doc = new PDFDocument.default();

    const transcript = await Transcript.findOne({
      meeting: meetingId,
    }).populate("meeting", "title date");

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    const meeting = transcript.meeting;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      getContentDispositionHeader(`transcript-${meetingId}.pdf`),
    );

    doc.pipe(res);

    // Title
    doc.fontSize(20).text("Meeting Transcript", { align: "center" });
    doc.moveDown();

    // Meeting info
    doc.fontSize(12).text(`Meeting: ${meeting.title}`);
    doc.text(`Date: ${meeting.date?.toLocaleDateString() || "N/A"}`);
    doc.text(
      `Duration: ${Math.floor(transcript.duration / 60)}:${Math.floor(
        transcript.duration % 60,
      )
        .toString()
        .padStart(2, "0")}`,
    );
    doc.moveDown();

    // Transcript content
    doc.fontSize(10);
    transcript.segments.forEach((segment) => {
      const timestamp = formatTimestamp(segment.startTime);
      doc.text(`[${timestamp}] ${segment.speaker}:`, { continued: true });
      doc.text(segment.text);
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error("Error exporting transcript as PDF:", error);
    sendError(res, 500, "Failed to export transcript as PDF");
  }
};

/**
 * Finalize transcript and index in Pinecone
 */
export const finalizeTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    // Update transcript status
    transcript.status = "completed";
    await transcript.save();

    // Update meeting with full transcript
    const meeting = await Meeting.findById(meetingId);
    if (meeting) {
      meeting.transcript = transcript.fullText;
      await meeting.save();

      // Index meeting in Pinecone
      await indexMeeting(meeting);

      // Index transcript chunks for granular search
      await indexTranscriptChunks(transcript, meeting);
    }

    // Queue sentiment analysis job
    if (sentimentAnalysisQueue.isActive) {
      await sentimentAnalysisQueue.add("analyze-sentiment", {
        transcriptId: transcript._id,
      });
    }

    sendSuccess(res, null, "Transcript finalized and indexed successfully");
  } catch (error) {
    console.error("Error finalizing transcript:", error);
    sendError(res, 500, "Failed to finalize transcript");
  }
};

/**
 * Helper function to format timestamp in MM:SS format
 */
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Translate transcript (stub for translation operation)
 */
export const translateTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: "Target language configuration parameter is required.",
      });
    }

    const transcript = await Transcript.findOne({
      meeting: meetingId,
    }).populate("meeting");

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: "Target transcript identifier records not found.",
      });
    }

    const meeting = transcript.meeting;

    const isOwner = meeting.uploadedBy?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: You do not own this meeting and cannot perform translation operations",
      });
    }

    // Orchestrate live bulk translation processing
    const translatedSegments = await translateContent(
      meetingId,
      "transcript",
      targetLanguage,
    );

    // Format the translated segments to fullText equivalent
    const translatedTextOutput = translatedSegments
      .map((s) => `${s.speaker ? `[${s.speaker}] ` : ""}${s.text}`)
      .join("\n\n");

    return res.status(200).json({
      success: true,
      transcriptId: transcript._id,
      targetLanguage,
      status: "completed",
      translatedText: translatedTextOutput,
    });
  } catch (error) {
    console.error(`❌ [Translation Controller Exception]:`, error);
    return res.status(500).json({
      success: false,
      error:
        "Downstream localization processing error occurred during translation aggregation.",
    });
  }
};

/**
 * Update speaker tags in a transcript
 */
export const updateSpeakers = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldSpeaker, newSpeaker, segmentIndex } = req.body;

    if (!oldSpeaker || !newSpeaker) {
      return sendError(res, 400, "Old speaker and new speaker are required");
    }

    const transcript = await Transcript.findById(id).populate("meeting");

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    const meeting = transcript.meeting;
    const userId = (req.user._id || req.user.id)?.toString();

    const isOwner = meeting.uploadedBy?.toString() === userId;
    const isAdminInSameOrg =
      (req.user.role === "admin" || req.user.role === "owner") &&
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isAdminInSameOrg) {
      return sendError(
        res,
        403,
        "Forbidden: You don't have permission to edit this transcript",
      );
    }

    let updatedCount = 0;

    if (segmentIndex !== undefined && segmentIndex !== null) {
      // Update specific segment
      const parsedIndex = Number(segmentIndex);
      if (
        Number.isInteger(parsedIndex) &&
        parsedIndex >= 0 &&
        parsedIndex < transcript.segments.length
      ) {
        if (transcript.segments[parsedIndex].speaker === oldSpeaker) {
          transcript.segments[parsedIndex].speaker = newSpeaker;
          updatedCount = 1;
        }
      }
    } else {
      // Bulk update
      transcript.segments.forEach((segment) => {
        if (segment.speaker === oldSpeaker) {
          segment.speaker = newSpeaker;
          updatedCount++;
        }
      });
    }

    if (updatedCount > 0) {
      await transcript.save();

      // Optionally, regenerate fullText based on segments here if needed
      // Currently, it seems we don't automatically regenerate fullText to avoid losing formatting.

      // Update the meeting transcript text if required (optional)

      sendSuccess(
        res,
        transcript,
        `Successfully updated ${updatedCount} segment(s)`,
      );
    } else {
      sendSuccess(
        res,
        transcript,
        "No segments found matching the specified speaker",
      );
    }
  } catch (error) {
    console.error("Error updating speakers:", error);
    sendError(res, 500, "Failed to update speakers");
  }
};

/**
 * Update transcript segment (text, startTime, endTime, speaker) with audit logging and re-indexing (#2251)
 */
export const updateTranscriptSegment = async (req, res) => {
  try {
    const { id, meetingId, segmentIndex } = req.params;
    const { text, startTime, endTime, speaker } = req.body || {};

    if (
      text === undefined &&
      startTime === undefined &&
      endTime === undefined &&
      speaker === undefined
    ) {
      return sendError(
        res,
        400,
        "At least one field (text, startTime, endTime, speaker) is required to update segment",
      );
    }

    let transcript;
    if (id) {
      transcript = await Transcript.findById(id).populate("meeting");
    } else if (meetingId) {
      transcript = await Transcript.findOne({ meeting: meetingId }).populate(
        "meeting",
      );
    }

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    const meeting = transcript.meeting;
    if (!meeting) {
      return sendError(res, 404, "Associated meeting not found");
    }

    const userId = (req.user._id || req.user.id)?.toString();
    const isOwner = meeting.uploadedBy?.toString() === userId;
    const isAdminInSameOrg =
      (req.user.role === "admin" || req.user.role === "owner") &&
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    // Check if user is owner, org admin/owner, or has permission
    if (!isOwner && !isAdminInSameOrg) {
      return sendError(
        res,
        403,
        "Forbidden: You don't have permission to edit this transcript",
      );
    }

    if (!transcript.segments || transcript.segments.length === 0) {
      return sendError(res, 404, "Transcript has no segments to update");
    }

    // Identify target segment by index or _id
    let parsedIndex = -1;
    if (segmentIndex !== undefined && segmentIndex !== null) {
      const idx = Number(segmentIndex);
      if (
        Number.isInteger(idx) &&
        idx >= 0 &&
        idx < transcript.segments.length
      ) {
        parsedIndex = idx;
      } else {
        // Try finding by segment _id
        parsedIndex = transcript.segments.findIndex(
          (s) => s._id && s._id.toString() === segmentIndex.toString(),
        );
      }
    }

    if (parsedIndex === -1) {
      return sendError(
        res,
        400,
        `Invalid segment index or ID: ${segmentIndex}`,
      );
    }

    const targetSegment = transcript.segments[parsedIndex];

    // Validate timestamps if provided
    let newStartTime = targetSegment.startTime;
    let newEndTime = targetSegment.endTime;

    if (startTime !== undefined && startTime !== null) {
      const numStart = Number(startTime);
      if (isNaN(numStart) || numStart < 0) {
        return sendError(res, 400, "startTime must be a non-negative number");
      }
      newStartTime = numStart;
    }

    if (endTime !== undefined && endTime !== null) {
      const numEnd = Number(endTime);
      if (isNaN(numEnd) || numEnd < 0) {
        return sendError(res, 400, "endTime must be a non-negative number");
      }
      newEndTime = numEnd;
    }

    if (newEndTime < newStartTime) {
      return sendError(res, 400, "endTime cannot be less than startTime");
    }

    // Capture old values for audit logging
    const oldValues = {
      text: targetSegment.text,
      startTime: targetSegment.startTime,
      endTime: targetSegment.endTime,
      speaker: targetSegment.speaker,
    };

    // Apply updates
    if (text !== undefined && text !== null) {
      targetSegment.text = String(text);
    }
    if (speaker !== undefined && speaker !== null) {
      targetSegment.speaker = String(speaker).trim();
    }
    targetSegment.startTime = newStartTime;
    targetSegment.endTime = newEndTime;
    targetSegment.isEdited = true;
    targetSegment.editedAt = new Date();
    targetSegment.editedBy = req.user._id || req.user.id;

    // Recalculate fullText and wordCount
    transcript.fullText = transcript.segments
      .map((s) => s.text)
      .join(" ")
      .trim();
    transcript.wordCount = transcript.fullText
      ? transcript.fullText.split(/\s+/).filter(Boolean).length
      : 0;

    await transcript.save();

    // Update meeting transcript text
    meeting.transcript = transcript.fullText;
    await meeting.save();

    // Record Audit Log if in an organization
    const orgId = meeting.organization || req.user.organization;
    if (orgId) {
      try {
        await AuditLog.create({
          organization: orgId,
          actor: req.user._id || req.user.id,
          action: "TRANSCRIPT_SEGMENT_UPDATED",
          entity: "Transcript",
          entityId: transcript._id,
          details: {
            meetingId: meeting._id,
            segmentIndex: parsedIndex,
            segmentId: targetSegment._id,
            previous: oldValues,
            updated: {
              text: targetSegment.text,
              startTime: targetSegment.startTime,
              endTime: targetSegment.endTime,
              speaker: targetSegment.speaker,
            },
          },
        });
      } catch (auditError) {
        console.error(
          "Failed to create audit log for segment update:",
          auditError,
        );
      }
    }

    // Background re-indexing if transcript is completed
    if (transcript.status === "completed") {
      try {
        indexMeeting(meeting).catch((err) =>
          console.error("Failed to re-index meeting in background:", err),
        );
        indexTranscriptChunks(transcript, meeting).catch((err) =>
          console.error(
            "Failed to re-index transcript chunks in background:",
            err,
          ),
        );
      } catch (indexError) {
        console.error("Failed to trigger re-indexing:", indexError);
      }
    }

    return sendSuccess(
      res,
      {
        transcript,
        segment: targetSegment,
        segmentIndex: parsedIndex,
      },
      "Transcript segment updated successfully",
    );
  } catch (error) {
    console.error("Error updating transcript segment:", error);
    return sendError(res, 500, "Failed to update transcript segment");
  }
};

/**
 * @desc  Persist live caption chunks into transcript segments (Issue #2246)
 * @route POST /api/meetings/:meetingId/transcript/captions
 *        POST /api/transcripts/meeting/:meetingId/captions
 * @access Private (requires auth + org access)
 */
export const persistCaptionSegments = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const user = req.user;

    if (!meetingId) {
      return sendError(res, 400, "Meeting ID is required");
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return sendError(res, 404, "Meeting not found");
    }

    if (!assertMeetingAccess(meeting, user)) {
      return sendError(
        res,
        403,
        "Forbidden: You don't have access to this meeting",
      );
    }

    // Check E2EE: If meeting transcript is encrypted, plaintext captions cannot be saved
    if (isMeetingTranscriptEncrypted(meeting)) {
      return sendError(
        res,
        400,
        "Cannot persist plaintext captions for an end-to-end encrypted meeting. Use the encrypted transcript endpoint.",
      );
    }

    // Check if organization enforces E2EE org-wide (#2263)
    if (meeting.organization) {
      let org = null;
      if (
        typeof meeting.organization === "object" &&
        meeting.organization !== null
      ) {
        org = meeting.organization;
      } else if (
        typeof meeting.organization === "string" &&
        meeting.organization.length === 24 &&
        /^[0-9a-fA-F]{24}$/.test(meeting.organization)
      ) {
        try {
          org = await Organization.findById(meeting.organization).lean();
        } catch {
          org = null;
        }
      }
      if (org && isOrgE2eeEnforced(org)) {
        return sendError(
          res,
          400,
          "Organization enforces End-to-End Encryption for all transcripts. Plaintext caption data is not permitted.",
        );
      }
    }

    let rawSegments = [];
    if (Array.isArray(req.body?.segments)) {
      rawSegments = req.body.segments;
    } else if (req.body?.text && typeof req.body.text === "string") {
      rawSegments = [req.body];
    } else if (Array.isArray(req.body?.captions)) {
      rawSegments = req.body.captions;
    }

    if (!rawSegments || rawSegments.length === 0) {
      return sendError(res, 400, "No caption segments provided");
    }

    // Find existing transcript or create a new one
    let transcript = await Transcript.findOne({ meeting: meetingId });
    if (!transcript) {
      transcript = new Transcript({
        meeting: meetingId,
        organizationId: meeting.organization || null,
        status: "active",
        language: "en",
        recordingTimestamps: {
          recordingStartedAt: new Date(),
        },
        segments: [],
        fullText: "",
        duration: 0,
      });
    }

    let addedCount = 0;
    const existingSegments = transcript.segments || [];

    for (const raw of rawSegments) {
      const text = (raw.text || "").trim();
      if (!text) continue;

      const speaker = raw.speaker || "Speaker";
      const speakerId = raw.speakerId || null;
      const startTime =
        typeof raw.startTime === "number"
          ? raw.startTime
          : transcript.duration || 0;
      const endTime =
        typeof raw.endTime === "number" ? raw.endTime : startTime + 5;
      const confidence =
        typeof raw.confidence === "number" ? raw.confidence : 1.0;
      const isFinal = raw.isFinal !== undefined ? Boolean(raw.isFinal) : true;

      // Check for exact duplicate segment
      const isDuplicate = existingSegments.some((seg) => {
        const textMatch = seg.text?.trim().toLowerCase() === text.toLowerCase();
        const speakerMatch = seg.speaker === speaker;
        const timeMatch = Math.abs((seg.startTime || 0) - startTime) < 0.5;
        return textMatch && speakerMatch && timeMatch;
      });

      if (!isDuplicate) {
        existingSegments.push({
          text,
          speaker,
          speakerId,
          startTime,
          endTime,
          confidence,
          isFinal,
        });
        addedCount += 1;
      }
    }

    transcript.segments = existingSegments;
    transcript.fullText = existingSegments
      .map((s) => s.text)
      .join(" ")
      .trim();
    const maxEndTime = existingSegments.reduce(
      (max, s) => Math.max(max, s.endTime || 0),
      0,
    );
    transcript.duration = Math.max(transcript.duration || 0, maxEndTime);
    transcript.wordCount =
      transcript.fullText.length > 0
        ? transcript.fullText.split(/\s+/).length
        : 0;

    await transcript.save();

    // Sync meeting.transcript
    meeting.transcript = transcript.fullText;
    await meeting.save();

    return sendSuccess(
      res,
      {
        transcriptId: transcript._id,
        meetingId,
        segments: transcript.segments,
        addedCount,
        totalSegments: transcript.segments.length,
        fullText: transcript.fullText,
      },
      "Caption segments persisted successfully",
    );
  } catch (error) {
    console.error("Error persisting caption segments:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to persist caption segments",
    );
  }
};
