import { GoogleGenerativeAI } from "@google/generative-ai"; // eslint-disable-line no-unused-vars
import axios from "axios"; // eslint-disable-line no-unused-vars
import eventBus from "../services/eventBus.js";
import Meeting from "../models/meetingModel.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "../services/knowledgeGraphService.js";
import User from "../models/userModel.js";

import { indexMeeting } from "../utils/embeddingUtils.js";
import {
  generateMoMWithAI,
  normalizeMoM,
  buildHumanReadableMoM,
} from "../services/GenerativeAIService.js";

export default async function processAudioJob(job, _app) {
  const { meetingId, transcript, date, title, userId } = job.data;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // eslint-disable-line no-unused-vars
  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"; // eslint-disable-line no-unused-vars
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // eslint-disable-line no-unused-vars

  let textToSummarize = (transcript || "").trim();

  // Fetch meeting transcript if only meetingId is provided
  let meeting = null;
  if (meetingId && !textToSummarize) {
    meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }
    textToSummarize = (meeting.transcript || "").trim();
  }

  if (!textToSummarize) {
    throw new Error("No transcript provided.");
  }

  console.log(`🧠 Generating MoM for ${meetingId || "transcript-only"}...`);

  let structured = null;
  let humanReadable = "";

  structured = await generateMoMWithAI(textToSummarize, date, title);

  if (structured) {
    const mom = normalizeMoM(structured, title, date);
    humanReadable = buildHumanReadableMoM(mom);

    let meetingToUpdate = meeting;

    if (!meetingToUpdate && meetingId) {
      meetingToUpdate = await Meeting.findById(meetingId);
    }

    if (!meetingToUpdate && !meetingId) {
      const user = await User.findById(userId);
      const userOrg = user?.organization || null;

      meetingToUpdate = await Meeting.create({
        uploadedBy: userId,
        organization: userOrg,
        title: mom.title,
        date: new Date(date),
        transcript: textToSummarize,
        summary: humanReadable,
        structuredMoM: mom,
        status: "completed",
      });
      await indexMeeting(meetingToUpdate);
    } else if (meetingToUpdate) {
      meetingToUpdate.title = mom.title;
      meetingToUpdate.date = new Date(date);
      meetingToUpdate.summary = humanReadable;
      meetingToUpdate.structuredMoM = mom;
      await meetingToUpdate.save();
    }

    console.log("✅ MoM saved to database");

    // Trigger internal events for webhooks
    try {
      if (!meetingId) {
        eventBus.emit("meeting.created", {
          meeting: meetingToUpdate,
          membersToNotify: [],
        });
      }
      eventBus.emit("mom.generated", meetingToUpdate);
    } catch (evtErr) {
      console.error(
        "⚠️ Failed to emit webhook events from queue:",
        evtErr.message,
      );
    }

    if (meetingToUpdate) {
      try {
        await detectResolutions(meetingToUpdate, mom);
        await processStructuredMoM(meetingToUpdate, mom);
      } catch (kgError) {
        console.error(
          "⚠️ Knowledge graph processing failed (non-fatal):",
          kgError,
        );
      }
    }

    return { success: true, meetingId: meetingToUpdate?._id };
  }

  throw new Error("No summary generated");
}
