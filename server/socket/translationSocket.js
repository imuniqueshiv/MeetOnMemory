import { translateSegment } from "../services/realtimeTranslationService.js";

/**
 * Translation Socket Handler
 * Handles real-time translation events via Socket.IO
 */

export default (io) => {
  io.on("connection", (socket) => {
    console.log("🌐 Translation socket connected:", socket.id);

    // Handle translation request
    socket.on("translation:request", async (data) => {
      try {
        const {
          meetingId,
          segmentId,
          sourceText,
          sourceLanguage,
          targetLanguage,
          context,
        } = data;

        console.log(
          `📝 Translation request: ${sourceLanguage} -> ${targetLanguage}`,
        );

        const translation = await translateSegment(
          meetingId,
          segmentId,
          sourceText,
          sourceLanguage,
          targetLanguage,
          context,
        );

        // Emit translation result to all participants in the meeting
        io.to(meetingId).emit("translation:result", {
          segmentId,
          sourceLanguage,
          targetLanguage,
          ...translation,
        });

        console.log(`✓ Translation completed for ${targetLanguage}`);
      } catch (error) {
        console.error("Translation socket error:", error);
        socket.emit("translation:error", {
          segmentId: data.segmentId,
          error: error.message,
        });
      }
    });

    // Handle language change
    socket.on("translation:language-change", (data) => {
      try {
        const { meetingId, language, userId } = data;

        console.log(`🔄 User ${userId} changed language to ${language}`);

        // Broadcast language change to all participants
        io.to(meetingId).emit("translation:language-change", {
          userId,
          language,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Language change error:", error);
      }
    });

    // Handle manual correction
    socket.on("translation:correction", async (data) => {
      try {
        const { meetingId, segmentId, language, correctedText, userId } = data;

        console.log(`✏️ Manual correction submitted by ${userId}`);

        // Import correction function dynamically to avoid circular dependency
        const { submitCorrection } =
          await import("../services/realtimeTranslationService.js");

        await submitCorrection(
          meetingId,
          segmentId,
          language,
          correctedText,
          userId,
        );

        // Broadcast correction to all participants
        io.to(meetingId).emit("translation:correction", {
          segmentId,
          language,
          correctedText,
          userId,
          timestamp: Date.now(),
        });

        console.log(`✓ Correction broadcasted`);
      } catch (error) {
        console.error("Correction socket error:", error);
        socket.emit("translation:error", {
          segmentId: data.segmentId,
          error: error.message,
        });
      }
    });

    // Handle quality update request
    socket.on("translation:quality-request", async (data) => {
      try {
        const { segmentId } = data;

        const { getQualityMetrics } =
          await import("../services/realtimeTranslationService.js");
        const metrics = await getQualityMetrics(segmentId);

        socket.emit("translation:quality-update", {
          segmentId,
          metrics,
        });
      } catch (error) {
        console.error("Quality update error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("🌐 Translation socket disconnected:", socket.id);
    });
  });
};
