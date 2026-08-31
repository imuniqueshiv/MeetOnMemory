import { GoogleGenerativeAI } from "@google/generative-ai";
import { hybridRetrieve } from "../services/hybridRetrievalService.js";
import VoiceQueryLog from "../models/voiceQueryLogModel.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const handleVoiceQuery = async (req, res) => {
  const { queryText } = req.body;
  const organizationId =
    req.user?.organization || req.organization?.id || req.body.organizationId;
  const userId = req.user?.id || req.body.userId;

  if (!queryText) {
    return res
      .status(400)
      .json({ success: false, message: "queryText is required" });
  }

  if (!organizationId) {
    return res
      .status(403)
      .json({ success: false, message: "Organization context is required" });
  }

  try {
    // 1. Retrieve Context via Hybrid Search
    const searchOptions = { topK: 5 };
    const retrieval = await hybridRetrieve(
      queryText,
      organizationId,
      searchOptions,
    );
    const hits = retrieval.results || [];

    // 2. Format Context
    let contextText = "";
    if (hits.length === 0) {
      contextText = "No relevant meetings or policies found.";
    } else {
      hits.forEach((hit, i) => {
        const type = hit.type;
        const title = hit.title || "Untitled";
        const snippet = hit.summary || hit.snippet || "";
        contextText += `\n[Source ${i + 1}] Type: ${type}, Title: ${title}\nContent: ${snippet}`;
      });
    }

    // 3. Prompt Gemini
    const systemPrompt = `You are an AI meeting voice assistant. 
Answer the user's question strictly based on the provided context below.
If the context doesn't contain the answer, say "I couldn't find the answer in the retrieved memories."
Format your response as a concise, conversational spoken response. Keep it under 2 sentences. Do NOT use markdown, bullet points, or complex formatting since this will be read aloud by text-to-speech.

Context:
${contextText}`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(queryText);
    const responseText = result.response.text().trim();

    // 4. Log the query
    if (userId) {
      await VoiceQueryLog.create({
        user: userId,
        organization: organizationId,
        queryText,
        responseText,
        status: "success",
      });
    }

    return res.status(200).json({
      success: true,
      query: queryText,
      response: responseText,
    });
  } catch (error) {
    console.error("Voice Query Error:", error);

    if (userId) {
      await VoiceQueryLog.create({
        user: userId,
        organization: organizationId,
        queryText,
        status: "error",
        metadata: { error: error.message },
      }).catch(console.error); // Best effort logging
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to process voice query" });
  }
};
