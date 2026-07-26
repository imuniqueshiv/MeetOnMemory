/**
 * StreamingTranscriptionService.js
 * Handles real-time streaming transcription with AssemblyAI
 * Supports speaker diarization and live captioning
 */

import WebSocket from "ws";
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Active transcription sessions
const activeSessions = new Map(); // eslint-disable-line no-unused-vars

class StreamingTranscriptionService {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Start a new transcription session for a meeting
   */
  async startSession(meetingId, io) {
    try {
      if (!ASSEMBLYAI_API_KEY) {
        throw new Error("Missing ASSEMBLYAI_API_KEY");
      }

      // Check if session already exists
      if (this.sessions.has(meetingId)) {
        console.log(`Session already exists for meeting ${meetingId}`);
        return this.sessions.get(meetingId);
      }

      // Create transcript record
      const transcript = await Transcript.create({
        meeting: meetingId,
        status: "active",
      });

      // Connect to AssemblyAI real-time API
      const ws = new WebSocket(
        "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000",
        {
          headers: {
            Authorization: ASSEMBLYAI_API_KEY,
          },
        },
      );

      const session = {
        meetingId,
        transcriptId: transcript._id,
        ws,
        io,
        segments: [],
        startTime: Date.now(),
        isActive: true,
      };

      this.sessions.set(meetingId, session);

      // Handle WebSocket events
      ws.on("open", () => {
        console.log(
          `✅ Transcription session started for meeting ${meetingId}`,
        );
        // Configure for speaker diarization
        ws.send(
          JSON.stringify({
            speaker_labels: true,
          }),
        );
      });

      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.message_type === "FinalTranscript") {
            await this.handleFinalTranscript(session, message);
          } else if (message.message_type === "PartialTranscript") {
            await this.handlePartialTranscript(session, message);
          } else if (message.message_type === "SpeechStarted") {
            // Speech started event
          }
        } catch (error) {
          console.error("Error processing transcription message:", error);
        }
      });

      ws.on("error", (error) => {
        console.error(`WebSocket error for meeting ${meetingId}:`, error);
        this.endSession(meetingId);
      });

      ws.on("close", () => {
        console.log(`WebSocket closed for meeting ${meetingId}`);
        this.endSession(meetingId);
      });

      return session;
    } catch (error) {
      console.error("Failed to start transcription session:", error);
      throw error;
    }
  }

  /**
   * Handle partial (interim) transcript results
   */
  async handlePartialTranscript(session, message) {
    if (!session.isActive) return;

    const { text, words } = message; // eslint-disable-line no-unused-vars

    if (!text || text.trim() === "") return;

    // Emit partial transcript to all clients in the meeting room
    session.io.to(session.meetingId.toString()).emit("transcript-partial", {
      text,
      isFinal: false,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle final transcript results with speaker diarization
   */
  async handleFinalTranscript(session, message) {
    if (!session.isActive) return;

    const { text, words, speaker } = message;

    if (!text || text.trim() === "") return;

    // Calculate timestamps
    const startTime = words[0]?.start || 0;
    const endTime = words[words.length - 1]?.end || 0;

    // Create segment
    const segment = {
      text,
      speaker: speaker || "Unknown",
      speakerId: null, // Will be mapped from socket ID
      startTime,
      endTime,
      confidence: 1.0,
      isFinal: true,
    };

    session.segments.push(segment);

    // Update transcript in database
    await Transcript.findByIdAndUpdate(session.transcriptId, {
      $push: { segments: segment },
      $set: {
        fullText: session.segments.map((s) => s.text).join(" "),
        duration: (Date.now() - session.startTime) / 1000,
        wordCount: session.segments.reduce(
          (acc, s) => acc + s.text.split(" ").length,
          0,
        ),
      },
    });

    // Emit final transcript to all clients
    session.io.to(session.meetingId.toString()).emit("transcript-final", {
      segment,
      timestamp: Date.now(),
    });
  }

  /**
   * Process audio data from a client
   */
  processAudio(meetingId, audioData) {
    const session = this.sessions.get(meetingId);
    if (!session || !session.isActive) {
      console.log(`No active session for meeting ${meetingId}`);
      return;
    }

    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(audioData);
    }
  }

  /**
   * End a transcription session and finalize the transcript
   */
  async endSession(meetingId) {
    const session = this.sessions.get(meetingId);
    if (!session) return;

    session.isActive = false;

    // Close WebSocket
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }

    // Update transcript status
    await Transcript.findByIdAndUpdate(session.transcriptId, {
      $set: {
        status: "completed",
        duration: (Date.now() - session.startTime) / 1000,
      },
    });

    // Update meeting with transcript reference
    await Meeting.findByIdAndUpdate(meetingId, {
      $set: {
        transcript: session.segments.map((s) => s.text).join(" "),
      },
    });

    // Remove from active sessions
    this.sessions.delete(meetingId);

    console.log(`✅ Transcription session ended for meeting ${meetingId}`);
  }

  /**
   * Get active session for a meeting
   */
  getSession(meetingId) {
    return this.sessions.get(meetingId);
  }

  /**
   * Check if a session is active
   */
  isSessionActive(meetingId) {
    const session = this.sessions.get(meetingId);
    return session && session.isActive;
  }
}

// Export singleton instance
const streamingTranscriptionService = new StreamingTranscriptionService();
export default streamingTranscriptionService;
