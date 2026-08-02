import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";
import { embedText, initVectorStore } from "../utils/embeddingUtils.js";
import ChatSession from "../models/ChatSession.js";
import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const POLICY_NAMESPACE = "policies";
const PINNED_TYPES = new Set(["meeting", "policy", "knowledge"]);

export const createSession = async (organizationId, userId) => {
  const session = new ChatSession({ organizationId, userId });
  await session.save();
  return session;
};

export const getSession = async (sessionId, userId) => {
  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) throw new Error("Session not found");
  return session;
};

export const deleteSession = async (sessionId, userId) => {
  return await ChatSession.findOneAndDelete({ _id: sessionId, userId });
};

export const listSessions = async (userId) => {
  return await ChatSession.find({ userId }).sort({ updatedAt: -1 });
};

/**
 * Validate that the resource belongs to the user's organization and return a
 * normalized pinnedContext payload.
 */
export const resolvePinnedResource = async (
  organizationId,
  type,
  refId,
  titleHint = "",
) => {
  if (!PINNED_TYPES.has(type)) {
    throw new Error(
      'Invalid pin type. Expected "meeting", "policy", or "knowledge".',
    );
  }
  if (!mongoose.Types.ObjectId.isValid(refId)) {
    throw new Error("Invalid resource id.");
  }
  if (!organizationId) {
    throw new Error("Organization membership is required to pin context.");
  }

  if (type === "meeting") {
    const meeting = await Meeting.findOne({
      _id: refId,
      organization: organizationId,
    }).select("title organization");
    if (!meeting) {
      throw new Error(
        "Meeting not found or not accessible in your organization.",
      );
    }
    return {
      type: "meeting",
      refId: meeting._id,
      title: titleHint || meeting.title || "Untitled Meeting",
    };
  }

  if (type === "policy") {
    const policy = await Policy.findOne({
      _id: refId,
      organization: organizationId,
    }).select("name organization");
    if (!policy) {
      throw new Error(
        "Policy not found or not accessible in your organization.",
      );
    }
    return {
      type: "policy",
      refId: policy._id,
      title: titleHint || policy.name || "Untitled Policy",
    };
  }

  let knowledge = await Decision.findOne({
    _id: refId,
    organization: organizationId,
  }).select("text organization sourceMeetingId");

  if (!knowledge) {
    knowledge = await ActionItem.findOne({
      _id: refId,
      organization: organizationId,
    }).select("text organization sourceMeetingId");
  }

  if (!knowledge) {
    throw new Error(
      "Knowledge record not found or not accessible in your organization.",
    );
  }

  const text = knowledge.text || "Knowledge record";
  return {
    type: "knowledge",
    refId: knowledge._id,
    title: titleHint || text.slice(0, 80),
    text,
    sourceMeetingId: knowledge.sourceMeetingId || null,
  };
};

export const setPinnedContext = async (
  sessionId,
  userId,
  organizationId,
  { type, refId, title } = {},
) => {
  const session = await getSession(sessionId, userId);
  if (session.organizationId.toString() !== organizationId?.toString()) {
    throw new Error("Session does not belong to your organization.");
  }

  const resolved = await resolvePinnedResource(
    organizationId,
    type,
    refId,
    title,
  );

  session.pinnedContext = {
    type: resolved.type,
    refId: resolved.refId,
    title: resolved.title,
  };
  await session.save();
  return session;
};

export const clearPinnedContext = async (sessionId, userId) => {
  const session = await getSession(sessionId, userId);
  session.set("pinnedContext", undefined);
  await session.save();
  return session;
};

async function queryPinecone(
  organizationId,
  queryText,
  topK = 6,
  pinnedContext = null,
) {
  const queryEmbedding = await embedText(queryText);
  const index = await initVectorStore();
  const orgFilter = { organization: organizationId.toString() };
  const pinType = pinnedContext?.type || null;
  const pinId = pinnedContext?.refId?.toString?.() || null;

  const meetingFilter =
    pinType === "meeting" && pinId
      ? { ...orgFilter, meetingId: { $eq: pinId } }
      : pinType === "policy"
        ? null
        : orgFilter;

  const policyFilter =
    pinType === "policy" && pinId
      ? { ...orgFilter, policyId: { $eq: pinId } }
      : pinType === "meeting"
        ? null
        : orgFilter;

  let meetingResults = { matches: [] };
  let policyResults = { matches: [] };

  if (meetingFilter) {
    meetingResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: meetingFilter,
    });
  }

  if (policyFilter) {
    policyResults = await index.namespace(POLICY_NAMESPACE).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: policyFilter,
    });
  }

  let combined = [
    ...(meetingResults.matches || []).map((m) => ({
      ...m,
      refType: "meeting",
    })),
    ...(policyResults.matches || []).map((m) => ({ ...m, refType: "policy" })),
  ];

  // If a strict pin filter returned nothing, fall back to org-wide retrieval
  if (combined.length === 0 && pinType && pinType !== "knowledge") {
    const [fallbackMeetings, fallbackPolicies] = await Promise.all([
      index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: orgFilter,
      }),
      index.namespace(POLICY_NAMESPACE).query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: orgFilter,
      }),
    ]);
    combined = [
      ...(fallbackMeetings.matches || []).map((m) => ({
        ...m,
        refType: "meeting",
      })),
      ...(fallbackPolicies.matches || []).map((m) => ({
        ...m,
        refType: "policy",
      })),
    ];
  }

  // Knowledge pins: also prefer chunks from the source meeting when available
  if (pinType === "knowledge" && pinnedContext?.sourceMeetingId) {
    const meetingId = pinnedContext.sourceMeetingId.toString();
    const preferred = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: { ...orgFilter, meetingId: { $eq: meetingId } },
    });
    if (preferred.matches?.length) {
      combined = [
        ...preferred.matches.map((m) => ({ ...m, refType: "meeting" })),
        ...combined,
      ];
    }
  }

  combined.sort((a, b) => (b.score || 0) - (a.score || 0));
  return combined.slice(0, topK);
}

export const processMessage = async (sessionId, userId, content, socket) => {
  const session = await getSession(sessionId, userId);
  const organizationId = session.organizationId;
  const pinned = session.pinnedContext
    ? {
        type: session.pinnedContext.type,
        refId: session.pinnedContext.refId,
        title: session.pinnedContext.title,
      }
    : null;

  // Enrich knowledge pins with text for the prompt
  let pinnedKnowledgeText = "";
  if (pinned?.type === "knowledge") {
    try {
      const resolved = await resolvePinnedResource(
        organizationId,
        "knowledge",
        pinned.refId,
        pinned.title,
      );
      pinnedKnowledgeText = resolved.text || "";
      pinned.sourceMeetingId = resolved.sourceMeetingId;
    } catch (err) {
      console.warn("Pinned knowledge unavailable:", err.message);
    }
  }

  // Save user message
  session.messages.push({ role: "user", content, sources: [] });
  await session.save();

  // Retrieve context (prioritize pinned resource when set)
  const rawHits = await queryPinecone(organizationId, content, 6, pinned);

  const sources = [];
  let contextText = "";

  if (pinned) {
    contextText += `\n\n[Pinned Context] Type: ${pinned.type}, Title: ${pinned.title}`;
    if (pinnedKnowledgeText) {
      contextText += `\nContent: ${pinnedKnowledgeText}`;
      sources.push({
        refType: "knowledge",
        refId: pinned.refId,
        title: pinned.title,
        snippet: pinnedKnowledgeText.substring(0, 500),
      });
    } else {
      contextText +=
        "\nPrioritize information from this pinned resource when answering.";
    }
  }

  for (let i = 0; i < rawHits.length; i++) {
    const hit = rawHits[i];
    const meta = hit.metadata || {};

    let refId = "";
    let title = "";
    let snippet = "";

    if (hit.refType === "meeting") {
      refId = meta.meetingId || hit.id.split("-")[0];
      title = meta.title || "Untitled Meeting";
      snippet = meta.summary || meta.transcript || "";
    } else {
      refId = meta.policyId || hit.id;
      title = meta.name || "Untitled Policy";
      snippet = meta.summary || "";
    }

    if (!sources.some((s) => s.refId.toString() === refId.toString())) {
      sources.push({
        refType: hit.refType,
        refId,
        title,
        snippet: snippet.substring(0, 500),
      });
    }

    contextText += `\n\n[Source ${sources.length}] Type: ${hit.refType}, Title: ${title}\nContent: ${snippet}`;
  }

  const systemPrompt = `You are an AI meeting assistant for an organization. 
Answer the user's question STRICTLY based on the provided context below.
If a pinned context is provided, prioritize it over other sources.
If the context doesn't contain the answer, say "I couldn't find the answer in the retrieved meetings or policies."
Cite your sources using [Source X] format.

Context:
${contextText}
`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  });

  const history = session.messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history,
  });

  const result = await chat.sendMessageStream(content);

  let fullResponse = "";
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullResponse += chunkText;
    if (socket) {
      socket.emit("assistant_message_chunk", { sessionId, chunk: chunkText });
    }
  }

  if (session.title === "New Chat" && session.messages.length <= 1) {
    try {
      const titlePrompt = `Generate a short, 2-4 word title for a chat that started with this message: "${content}". Output only the title, no quotes.`;
      const titleResult = await model.generateContent(titlePrompt);
      const generatedTitle = titleResult.response
        .text()
        .trim()
        .replace(/["']/g, "");
      if (generatedTitle) {
        session.title = generatedTitle;
      }
    } catch (e) {
      console.error("Failed to generate title", e);
    }
  }

  const assistantMessage = {
    role: "assistant",
    content: fullResponse,
    sources,
  };

  session.messages.push(assistantMessage);
  await session.save();

  if (socket) {
    socket.emit("assistant_message_done", {
      sessionId,
      message: session.messages[session.messages.length - 1],
      title: session.title,
    });
  }

  return session;
};
