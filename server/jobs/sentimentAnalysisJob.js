import { pipeline, env } from "@xenova/transformers";
import Transcript from "../models/transcriptModel.js";

// Ensure models are stored locally and not trying to use browser cache
env.useBrowserCache = false;

let sentimentPipeline = null;

export default async function sentimentAnalysisJob(job) {
  const { transcriptId } = job.data;
  console.log(`🤖 Starting sentiment analysis for transcript ${transcriptId}`);

  try {
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      throw new Error(`Transcript ${transcriptId} not found`);
    }

    if (!transcript.segments || transcript.segments.length === 0) {
      console.log(`ℹ️ No segments found for transcript ${transcriptId}. Skipping.`);
      return { success: true, skipped: true };
    }

    if (!sentimentPipeline) {
      console.log("⏳ Loading sentiment-analysis model...");
      sentimentPipeline = await pipeline("sentiment-analysis");
      console.log("✅ Model loaded");
    }

    let totalScore = 0;
    
    for (let i = 0; i < transcript.segments.length; i++) {
      const segment = transcript.segments[i];
      if (!segment.text || segment.text.trim().length === 0) continue;

      const result = await sentimentPipeline(segment.text);
      const prediction = result[0];
      
      let score = prediction.score;
      if (prediction.label === "NEGATIVE") {
        score = -score; // Map negative to -1 to 0 range
      }
      
      segment.sentimentScore = score;
      segment.emotionTags = [prediction.label];
      totalScore += score;
    }

    transcript.overallSentiment = totalScore / transcript.segments.length;
    transcript.overallEmotion = transcript.overallSentiment >= 0 ? "POSITIVE" : "NEGATIVE";
    
    await transcript.save();
    console.log(`✅ Sentiment analysis complete for transcript ${transcriptId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Sentiment analysis failed for transcript ${transcriptId}:`, error);
    throw error;
  }
}
