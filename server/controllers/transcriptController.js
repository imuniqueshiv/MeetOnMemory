import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import { transcribeFileWithSegments } from "../services/TranscriptionService.js";
import {
  indexTranscript,
  searchVectorStore,
  indexMeeting,
} from "../utils/embeddingUtils.js";
import { indexTranscriptChunks } from "../utils/transcriptEmbeddingUtils.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";
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

    console.log(`🎙️ Voice Search for query: "${query}"`);

    // Perform vector search across all content types
    const results = await searchVectorStore(query);

    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No relevant results found.",
        results: [],
      });
    }

    // Filter results to include only those from user's organization
    const filteredResults = results.filter((r) => {
      if (!r.organization) return true; // Allow results without org
      return r.organization === req.user.organization?.toString();
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
    }).populate("meeting", "title date participants uploadedBy organization");

    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    sendSuccess(res, transcript);
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
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
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
      `attachment; filename="transcript-${meetingId}.pdf"`,
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
    const userId = req.user._id.toString();

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
