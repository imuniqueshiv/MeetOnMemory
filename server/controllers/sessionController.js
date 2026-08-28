import SessionCard from "../models/sessionCardModel.js";
import { generateSessionCardAI } from "../services/GenerativeAIService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

// @desc    Generate AI Session Card & Persist to Org Library
// @route   POST /api/sessions/generate
// @access  Private
export const generateSession = async (req, res) => {
  try {
    const { eventName, sessionTitle, speaker, speakerTitle, speakerBio } =
      req.body;

    if (!sessionTitle || sessionTitle.trim() === "") {
      return sendError(res, 400, "Session title is required.");
    }

    // Process uploaded files if any
    const videoFile =
      req.files && req.files["video"] ? req.files["video"][0] : null;
    const videoUrl = videoFile
      ? `/uploads/sessions/${videoFile.filename}`
      : null;

    const slideFiles =
      req.files && req.files["slides"] ? req.files["slides"] : [];
    const slideUrls = slideFiles.map(
      (file) => `/uploads/sessions/${file.filename}`,
    );

    const { summary, keywords } = await generateSessionCardAI(
      eventName ? eventName.trim() : "",
      sessionTitle.trim(),
      speaker ? speaker.trim() : "",
      speakerTitle ? speakerTitle.trim() : "",
      speakerBio ? speakerBio.trim() : "",
    );

    const organization = req.user?.organization || null;
    const createdBy = req.user?._id || req.user?.id || null;

    let savedSession = null;
    if (organization && createdBy) {
      savedSession = await SessionCard.create({
        organization,
        createdBy,
        eventName: eventName ? eventName.trim() : "",
        sessionTitle: sessionTitle.trim(),
        speaker: speaker ? speaker.trim() : "",
        speakerTitle: speakerTitle ? speakerTitle.trim() : "",
        speakerBio: speakerBio ? speakerBio.trim() : "",
        summary: summary || "",
        keywords: Array.isArray(keywords) ? keywords : [],
        videoUrl,
        slideUrls,
      });
    }

    return sendSuccess(
      res,
      {
        session: savedSession || {
          eventName: eventName ? eventName.trim() : "",
          sessionTitle: sessionTitle.trim(),
          speaker: speaker ? speaker.trim() : "",
          speakerTitle: speakerTitle ? speakerTitle.trim() : "",
          speakerBio: speakerBio ? speakerBio.trim() : "",
          summary,
          keywords,
          videoUrl,
          slideUrls,
        },
      },
      "Session card generated and saved successfully.",
      201,
    );
  } catch (error) {
    console.error("Error in generateSession controller:", error);
    return sendError(res, 500, "Failed to generate session card.");
  }
};

// @desc    Get all session cards for the user's organization with search and pagination
// @route   GET /api/sessions
// @access  Private
export const getSessions = async (req, res) => {
  try {
    const orgId = req.user?.organization;
    if (!orgId) {
      return sendError(
        res,
        400,
        "User is not associated with an organization.",
      );
    }

    const { page = 1, limit = 20, search, q, event, tag } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { organization: orgId };

    const searchTerm = (search || q || "").trim();
    if (searchTerm) {
      const searchRegex = new RegExp(
        searchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),
        "i",
      );
      filter.$or = [
        { sessionTitle: searchRegex },
        { eventName: searchRegex },
        { speaker: searchRegex },
        { speakerTitle: searchRegex },
        { summary: searchRegex },
        { keywords: searchRegex },
        { tags: searchRegex },
      ];
    }

    if (event && event.trim()) {
      filter.eventName = new RegExp(`^${event.trim()}$`, "i");
    }

    if (tag && tag.trim()) {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { keywords: new RegExp(`^${tag.trim()}$`, "i") },
        { tags: new RegExp(`^${tag.trim()}$`, "i") },
      );
    }

    const [sessions, total] = await Promise.all([
      SessionCard.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "name email imageUrl")
        .lean(),
      SessionCard.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      {
        sessions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
      "Session cards retrieved successfully.",
    );
  } catch (error) {
    console.error("Error in getSessions controller:", error);
    return sendError(res, 500, "Failed to retrieve session cards.");
  }
};

// @desc    Get session card by ID
// @route   GET /api/sessions/:id
// @access  Private
export const getSessionById = async (req, res) => {
  try {
    const orgId = req.user?.organization;
    const session = await SessionCard.findOne({
      _id: req.params.id,
      organization: orgId,
    })
      .populate("createdBy", "name email imageUrl")
      .lean();

    if (!session) {
      return sendError(res, 404, "Session card not found.");
    }

    return sendSuccess(
      res,
      { session },
      "Session card retrieved successfully.",
    );
  } catch (error) {
    console.error("Error in getSessionById controller:", error);
    return sendError(res, 500, "Failed to retrieve session card.");
  }
};

// @desc    Create manual session card
// @route   POST /api/sessions
// @access  Private
export const createSession = async (req, res) => {
  try {
    const orgId = req.user?.organization;
    const userId = req.user?._id || req.user?.id;

    if (!orgId) {
      return sendError(
        res,
        400,
        "User is not associated with an organization.",
      );
    }

    const {
      eventName,
      sessionTitle,
      speaker,
      speakerTitle,
      speakerBio,
      summary,
      keywords,
      videoUrl,
      slideUrls,
      tags,
    } = req.body;

    if (!sessionTitle || !sessionTitle.trim()) {
      return sendError(res, 400, "Session title is required.");
    }

    const session = await SessionCard.create({
      organization: orgId,
      createdBy: userId,
      eventName: eventName ? eventName.trim() : "",
      sessionTitle: sessionTitle.trim(),
      speaker: speaker ? speaker.trim() : "",
      speakerTitle: speakerTitle ? speakerTitle.trim() : "",
      speakerBio: speakerBio ? speakerBio.trim() : "",
      summary: summary || "",
      keywords: Array.isArray(keywords) ? keywords : [],
      videoUrl: videoUrl || null,
      slideUrls: Array.isArray(slideUrls) ? slideUrls : [],
      tags: Array.isArray(tags) ? tags : [],
    });

    return sendSuccess(
      res,
      { session },
      "Session card created successfully.",
      201,
    );
  } catch (error) {
    console.error("Error in createSession controller:", error);
    return sendError(res, 500, "Failed to create session card.");
  }
};

// @desc    Update session card
// @route   PATCH /api/sessions/:id
// @access  Private
export const updateSession = async (req, res) => {
  try {
    const orgId = req.user?.organization;
    const session = await SessionCard.findOne({
      _id: req.params.id,
      organization: orgId,
    });

    if (!session) {
      return sendError(res, 404, "Session card not found.");
    }

    const allowedUpdates = [
      "eventName",
      "sessionTitle",
      "speaker",
      "speakerTitle",
      "speakerBio",
      "summary",
      "keywords",
      "videoUrl",
      "slideUrls",
      "tags",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        session[field] = req.body[field];
      }
    });

    await session.save();

    return sendSuccess(res, { session }, "Session card updated successfully.");
  } catch (error) {
    console.error("Error in updateSession controller:", error);
    return sendError(res, 500, "Failed to update session card.");
  }
};

// @desc    Delete session card
// @route   DELETE /api/sessions/:id
// @access  Private
export const deleteSession = async (req, res) => {
  try {
    const orgId = req.user?.organization;
    const session = await SessionCard.findOneAndDelete({
      _id: req.params.id,
      organization: orgId,
    });

    if (!session) {
      return sendError(res, 404, "Session card not found.");
    }

    return sendSuccess(res, null, "Session card deleted successfully.");
  } catch (error) {
    console.error("Error in deleteSession controller:", error);
    return sendError(res, 500, "Failed to delete session card.");
  }
};
