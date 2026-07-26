/**
 * transcriptEmbeddingUtils.js
 * Handles chunking and embedding of transcript segments for Pinecone
 */

import { initVectorStore, embedText } from "./embeddingUtils.js";

/**
 * Chunk transcript segments for embedding
 * Groups segments by speaker and time windows
 */
const chunkTranscriptSegments = (segments, maxSegmentsPerChunk = 10) => {
  if (!segments || segments.length === 0) return [];

  const chunks = [];
  let currentChunk = [];
  let currentSpeaker = null;

  for (const segment of segments) {
    // Start new chunk if speaker changes or chunk is too large
    if (
      currentSpeaker !== segment.speaker ||
      currentChunk.length >= maxSegmentsPerChunk
    ) {
      if (currentChunk.length > 0) {
        chunks.push({
          segments: [...currentChunk],
          speaker: currentSpeaker,
          startTime: currentChunk[0].startTime,
          endTime: currentChunk[currentChunk.length - 1].endTime,
          text: currentChunk.map((s) => s.text).join(" "),
        });
      }
      currentChunk = [segment];
      currentSpeaker = segment.speaker;
    } else {
      currentChunk.push(segment);
    }
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push({
      segments: [...currentChunk],
      speaker: currentSpeaker,
      startTime: currentChunk[0].startTime,
      endTime: currentChunk[currentChunk.length - 1].endTime,
      text: currentChunk.map((s) => s.text).join(" "),
    });
  }

  return chunks;
};

/**
 * Index transcript chunks in Pinecone
 */
export const indexTranscriptChunks = async (transcript, meeting) => {
  try {
    const indexInstance = await initVectorStore();

    if (!transcript || !transcript.segments || transcript.segments.length === 0) {
      console.warn("⚠️ Skipping empty transcript embedding");
      return;
    }

    const chunks = chunkTranscriptSegments(transcript.segments);

    const vectors = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const contextPrefix = `Meeting: ${meeting.title}\nSpeaker: ${chunk.speaker}\n`;
      const chunkText = contextPrefix + chunk.text;

      const embedding = await embedText(chunkText);

      vectors.push({
        id: `${meeting._id.toString()}-transcript-chunk-${i}`,
        values: embedding,
        metadata: {
          meetingId: meeting._id.toString(),
          transcriptId: transcript._id.toString(),
          chunkIndex: i,
          chunkType: "transcript",
          speaker: chunk.speaker,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: chunk.text,
          title: meeting.title,
          meetingDate: meeting.date,
          createdAt: transcript.createdAt || new Date(),
        },
      });
    }

    await indexInstance.upsert(vectors);

    console.log(
      `✅ Indexed transcript chunks for meeting ${meeting.title} (${chunks.length} chunks)`
    );
  } catch (error) {
    console.error("❌ Failed to index transcript chunks:", error);
  }
};

/**
 * Search transcript chunks in Pinecone
 */
export const searchTranscriptChunks = async (query, meetingId = null) => {
  try {
    const indexInstance = await initVectorStore();

    if (!query || query.trim().length === 0) {
      throw new Error("Empty query received for transcript search");
    }

    const queryEmbedding = await embedText(query);

    const filter = meetingId ? { meetingId: { $eq: meetingId.toString() } } : {};

    const results = await indexInstance.query({
      vector: queryEmbedding,
      topK: 10,
      includeMetadata: true,
      filter,
    });

    if (!results.matches?.length) {
      console.warn("⚠️ No transcript chunks returned from Pinecone");
      return [];
    }

    const formattedResults = results.matches
      .filter((match) => match.metadata?.chunkType === "transcript")
      .map((match) => ({
        meetingId: match.metadata.meetingId,
        transcriptId: match.metadata.transcriptId,
        chunkIndex: match.metadata.chunkIndex,
        speaker: match.metadata.speaker,
        startTime: match.metadata.startTime,
        endTime: match.metadata.endTime,
        text: match.metadata.text,
        title: match.metadata.title,
        meetingDate: match.metadata.meetingDate,
        similarityScore: parseFloat(match.score?.toFixed(3)) || 0,
      }));

    return formattedResults;
  } catch (error) {
    console.error("❌ Failed to search transcript chunks:", error);
    throw error;
  }
};

/**
 * Delete transcript chunks from Pinecone
 */
export const deleteTranscriptChunks = async (transcriptId) => {
  try {
    const indexInstance = await initVectorStore();

    if (!transcriptId) {
      console.warn("⚠️ No transcriptId provided for Pinecone deletion");
      return;
    }

    await indexInstance.deleteMany({
      filter: {
        transcriptId: { $eq: transcriptId.toString() },
      },
    });

    console.log(`✅ Deleted transcript chunks from Pinecone: ${transcriptId}`);
  } catch (error) {
    console.error("❌ Failed to delete transcript chunks from Pinecone:", error);
  }
};
