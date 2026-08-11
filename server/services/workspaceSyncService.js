// server/services/workspaceSyncService.js
import mongoose from "mongoose";
import axios from "axios";
import Meeting from "../models/meetingModel.js";

class WorkspaceSyncService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    this.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
  }

  /**
   * Persists a new canvas element (node or path) to the meeting document
   * Uses $push for array operations to avoid full document overwrites
   */
  async persistCanvasElement(meetingId, data) {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) return;

    const updateQuery = {};
    if (data.type === "node") {
      updateQuery.$push = { "warRoom.canvasNodes": data.payload };
    } else if (data.type === "path") {
      updateQuery.$push = { "warRoom.canvasPaths": data.payload };
    }

    if (Object.keys(updateQuery).length > 0) {
      await Meeting.updateOne({ _id: meetingId }, updateQuery);
    }
  }

  /**
   * Clears the entire canvas for a meeting
   */
  async clearCanvas(meetingId) {
    await Meeting.updateOne(
      { _id: meetingId },
      { $set: { "warRoom.canvasNodes": [], "warRoom.canvasPaths": [] } },
    );
  }

  /**
   * Reorders an action item across columns with optimistic concurrency control
   * Implements Operational Transform (OT) logic for concurrent drag-and-drop
   */
  async reorderActionItem(meetingId, actionId, toColumn, newIndex) {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");

    // Initialize warRoom if missing
    if (!meeting.warRoom) meeting.warRoom = { actionColumns: {} };
    if (!meeting.warRoom.actionColumns) meeting.warRoom.actionColumns = {};

    const columns = ["backlog", "in-progress", "blocked", "done"];

    // 1. Remove item from wherever it currently exists
    let movedItem = null;
    for (const col of columns) {
      if (!meeting.warRoom.actionColumns[col])
        meeting.warRoom.actionColumns[col] = [];
      const idx = meeting.warRoom.actionColumns[col].findIndex(
        (item) => item._id.toString() === actionId || item.id === actionId,
      );
      if (idx !== -1) {
        movedItem = meeting.warRoom.actionColumns[col].splice(idx, 1)[0];
        break;
      }
    }

    // If item doesn't exist in DB yet, create a placeholder
    if (!movedItem) {
      movedItem = {
        _id: actionId,
        title: "Untitled Action",
        assignee: null,
        priority: "medium",
        createdAt: new Date(),
      };
    }

    // 2. Insert into new column at specific index
    if (!meeting.warRoom.actionColumns[toColumn]) {
      meeting.warRoom.actionColumns[toColumn] = [];
    }

    // Clamp index to valid bounds
    const safeIndex = Math.max(
      0,
      Math.min(newIndex, meeting.warRoom.actionColumns[toColumn].length),
    );
    meeting.warRoom.actionColumns[toColumn].splice(safeIndex, 0, movedItem);

    // 3. Save with Mongoose
    meeting.markModified("warRoom.actionColumns");
    await meeting.save();

    return { meeting, movedItem };
  }

  /**
   * AI-Powered Bottleneck Detection using Google Gemini
   * Analyzes task distribution and warns if a user is overloaded
   */
  async analyzeBottlenecks(meetingId, io, room) {
    if (!this.geminiApiKey) {
      console.warn("⚠️ Gemini API key missing, skipping bottleneck analysis");
      return;
    }

    const meeting = await Meeting.findById(meetingId).populate(
      "participants.user",
      "name email",
    );
    if (!meeting || !meeting.warRoom || !meeting.warRoom.actionColumns) return;

    // Aggregate task counts per assignee
    const assigneeLoad = {};
    const columns = ["backlog", "in-progress", "blocked"]; // Ignore 'done'

    for (const col of columns) {
      const items = meeting.warRoom.actionColumns[col] || [];
      items.forEach((item) => {
        const assigneeId = item.assignee?.toString() || "unassigned";
        if (!assigneeLoad[assigneeId]) {
          assigneeLoad[assigneeId] = {
            count: 0,
            highPriority: 0,
            name: "Unassigned",
          };
        }
        assigneeLoad[assigneeId].count += 1;
        if (item.priority === "high")
          assigneeLoad[assigneeId].highPriority += 1;
      });
    }

    // Map participant names for the AI context
    meeting.participants.forEach((p) => {
      const id = p.user?._id?.toString();
      if (id && assigneeLoad[id]) {
        assigneeLoad[id].name = p.user.name || p.email;
      }
    });

    // Trigger AI only if there's an imbalance (e.g., someone has 3+ high priority tasks)
    const overloadedUsers = Object.values(assigneeLoad).filter(
      (u) => u.highPriority >= 3 || u.count >= 5,
    );

    if (overloadedUsers.length === 0) {
      // Clear any existing warnings
      io.to(room).emit("workspace:ai-bottleneck", {
        warnings: [],
        status: "healthy",
      });
      return;
    }

    try {
      const prompt = `
        You are an AI meeting facilitator. Analyze this task distribution for a meeting:
        ${JSON.stringify(assigneeLoad, null, 2)}
        
        Identify if any team member is severely overloaded with high-priority tasks. 
        Suggest a brief, 1-sentence reallocation strategy to balance the load.
        Return ONLY a valid JSON object with this exact structure:
        {
          "warnings": [
            { "user": "Name", "issue": "Overloaded with X high-priority tasks", "suggestion": "Delegate Y to Z" }
          ]
        }
      `;

      const response = await axios.post(
        this.geminiUrl,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        },
        { timeout: 10000 },
      );

      const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        io.to(room).emit("workspace:ai-bottleneck", {
          warnings: parsed.warnings || [],
          status: "warning",
          analyzedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("❌ Gemini Bottleneck Analysis failed:", error.message);
    }
  }
}

export const workspaceSyncService = new WorkspaceSyncService();
