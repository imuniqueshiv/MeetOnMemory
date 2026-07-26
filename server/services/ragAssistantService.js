import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedText, initVectorStore } from "../utils/embeddingUtils.js";
import ChatSession from "../models/ChatSession.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const POLICY_NAMESPACE = "policies";

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

async function queryPinecone(organizationId, queryText, topK = 6) {
  const queryEmbedding = await embedText(queryText);
  const index = await initVectorStore();
  
  // 1. Query meetings (default namespace)
  const meetingResults = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter: { organization: organizationId.toString() }
  });

  // 2. Query policies (policy namespace)
  const policyResults = await index.namespace(POLICY_NAMESPACE).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter: { organization: organizationId.toString() }
  });

  // Combine and sort by score
  const combined = [
    ...(meetingResults.matches || []).map(m => ({ ...m, refType: "meeting" })),
    ...(policyResults.matches || []).map(m => ({ ...m, refType: "policy" }))
  ];

  combined.sort((a, b) => (b.score || 0) - (a.score || 0));
  return combined.slice(0, topK);
}

export const processMessage = async (sessionId, userId, content, socket) => {
  const session = await getSession(sessionId, userId);
  const organizationId = session.organizationId;
  
  // Save user message
  session.messages.push({ role: "user", content, sources: [] });
  await session.save();

  // Retrieve context
  const rawHits = await queryPinecone(organizationId, content, 6);
  
  const sources = [];
  let contextText = "";
  
  for (let i = 0; i < rawHits.length; i++) {
    const hit = rawHits[i];
    const meta = hit.metadata || {};
    
    // De-dupe sources (optional, but good practice)
    let refId = "";
    let title = "";
    let snippet = "";
    
    if (hit.refType === "meeting") {
      refId = meta.meetingId || hit.id.split('-')[0];
      title = meta.title || "Untitled Meeting";
      snippet = meta.summary || meta.transcript || "";
    } else {
      refId = meta.policyId || hit.id;
      title = meta.name || "Untitled Policy";
      snippet = meta.summary || "";
    }
    
    if (!sources.some(s => s.refId.toString() === refId.toString())) {
      sources.push({
        refType: hit.refType,
        refId,
        title,
        snippet: snippet.substring(0, 500) // keep snippet brief for DB
      });
    }
    
    contextText += `\n\n[Source ${sources.length}] Type: ${hit.refType}, Title: ${title}\nContent: ${snippet}`;
  }

  const systemPrompt = `You are an AI meeting assistant for an organization. 
Answer the user's question STRICTLY based on the provided context below.
If the context doesn't contain the answer, say "I couldn't find the answer in the retrieved meetings or policies."
Cite your sources using [Source X] format.

Context:
${contextText}
`;

  // Gemini prompt
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt 
  });
  
  const history = session.messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const chat = model.startChat({
    history
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

  // Generate title if new chat
  if (session.title === "New Chat" && session.messages.length <= 1) {
    try {
      const titlePrompt = `Generate a short, 2-4 word title for a chat that started with this message: "${content}". Output only the title, no quotes.`;
      const titleResult = await model.generateContent(titlePrompt);
      const generatedTitle = titleResult.response.text().trim().replace(/["']/g, '');
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
    sources
  };
  
  session.messages.push(assistantMessage);
  await session.save();
  
  if (socket) {
    socket.emit("assistant_message_done", { 
      sessionId, 
      message: session.messages[session.messages.length - 1],
      title: session.title
    });
  }

  return session;
};
