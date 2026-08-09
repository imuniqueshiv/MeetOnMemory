import mongoose from "mongoose";
import TemplateLibrary from "../models/templateLibraryModel.js";
import MeetingTemplate from "../models/meetingTemplateModel.js";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

/** Library listings are cheap rows; 50 is generous without being unbounded. */
const MAX_BROWSE_LIMIT = 50;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Publish a template to the library
export const publishTemplate = async (req, res) => {
  try {
    const { templateId, category, description } = req.body;
    const organizationId = req.user.organization;
    const userId = req.user._id;

    if (!isValidId(templateId)) {
      return res.status(400).json({ error: "Invalid template ID" });
    }

    const originalTemplate = await MeetingTemplate.findOne({
      _id: templateId,
      organizationId,
    });

    if (!originalTemplate) {
      return res
        .status(404)
        .json({ error: "Original template not found or unauthorized" });
    }

    const newLibraryEntry = new TemplateLibrary({
      organizationId,
      originalTemplateId: originalTemplate._id,
      name: originalTemplate.name,
      title: originalTemplate.title,
      description: description || originalTemplate.description,
      category: category || "General",
      defaultDuration: originalTemplate.defaultDuration,
      agendaBlocks: originalTemplate.agendaBlocks,
      defaultParticipants: originalTemplate.defaultParticipants,
      publishedBy: userId,
    });

    await newLibraryEntry.save();
    res.status(201).json(newLibraryEntry);
  } catch (error) {
    console.error("Error publishing template:", error);
    res.status(500).json({ error: "Failed to publish template" });
  }
};

// Browse published templates
export const browseTemplates = async (req, res) => {
  try {
    const organizationId = req.user.organization;
    const { category, sort = "newest" } = req.query;

    const query = { organizationId };
    if (category) {
      query.category = category;
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "popular") {
      sortOptions = { cloneCount: -1 };
    } else if (sort === "highestRated") {
      sortOptions = { averageRating: -1 };
    }

    // Pagination was open-coded here as
    // `(parseInt(page, 10) - 1) * parseInt(limit, 10)`, so `?limit=1000000`
    // was honoured and `?page=abc` produced `skip: NaN` (Issue #1275).
    // `parsePagination` clamps both and is the rule the rest of the codebase
    // already uses — it was added for #1071 and this endpoint predates it.
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: MAX_BROWSE_LIMIT,
    });

    const templates = await TemplateLibrary.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate("publishedBy", "firstName lastName email");

    const total = await TemplateLibrary.countDocuments(query);
    const pagination = buildPaginationMeta({ total, page, limit });

    // `templates` / `totalPages` / `currentPage` are the keys the client reads
    // today; `pagination` is added alongside rather than replacing them.
    res.status(200).json({
      templates,
      totalPages: pagination.totalPages,
      currentPage: pagination.page,
      pagination,
    });
  } catch (error) {
    console.error("Error browsing templates:", error);
    res.status(500).json({ error: "Failed to browse templates" });
  }
};

// Clone a template for personal use
export const cloneTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const organizationId = req.user.organization;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid template ID" });
    }

    // Scope the lookup to the caller's organization (Issue #1275).
    //
    // This was `TemplateLibrary.findById(id)`, the only unscoped lookup in the
    // file — `publishTemplate`, `browseTemplates` and `rateTemplate` all filter
    // on `organizationId`. `organizationId` was read from the caller and used
    // only as the *destination*, so the source was whatever `:id` pointed at:
    // any authenticated user could copy another organization's published
    // template — name, title, description, duration and full agenda — into
    // their own workspace, and `cloneCount += 1` then wrote to the victim's
    // document.
    const libraryEntry = await TemplateLibrary.findOne({
      _id: id,
      organizationId,
    });

    if (!libraryEntry) {
      return res.status(404).json({ error: "Template not found in library" });
    }

    // Build the clone from the library entry's own snapshot, not from a fresh
    // read of `MeetingTemplate.findById(libraryEntry.originalTemplateId)`.
    //
    // The library entry stores name, title, description, category, duration,
    // agenda blocks and default participants precisely so that publishing is a
    // point-in-time act. Re-reading the source meant a clone silently picked up
    // edits made after publication — so users got something other than the
    // entry they browsed and rated — and cloning a perfectly valid entry failed
    // with "Original template not found" once the source template was deleted.
    //
    // It also fixes a quieter loss: `defaultParticipants` is published with the
    // entry and supported by `MeetingTemplate`, but the old clone never copied
    // it.
    const clonedTemplate = new MeetingTemplate({
      organizationId,
      name: `${libraryEntry.name} (Clone)`,
      title: libraryEntry.title,
      description: libraryEntry.description,
      category: libraryEntry.category,
      defaultDuration: libraryEntry.defaultDuration,
      agendaBlocks: libraryEntry.agendaBlocks,
      defaultParticipants: libraryEntry.defaultParticipants,
      createdBy: userId,
      clonedFromLibraryId: libraryEntry._id,
    });

    await clonedTemplate.save();

    // Increment the clone count on the library entry
    libraryEntry.cloneCount += 1;
    await libraryEntry.save();

    res.status(201).json(clonedTemplate);
  } catch (error) {
    console.error("Error cloning template:", error);
    res.status(500).json({ error: "Failed to clone template" });
  }
};

// Rate a template
export const rateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const organizationId = req.user.organization;
    const userId = req.user._id;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid template ID" });
    }

    // `if (rating < 1 || rating > 5)` passed for `undefined` (both comparisons
    // are false against NaN) and for the string "3", which then failed schema
    // validation as a 500 instead of a 400.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Rating must be an integer between 1 and 5" });
    }

    if (review !== undefined && typeof review !== "string") {
      return res.status(400).json({ error: "Review must be text" });
    }

    const libraryTemplate = await TemplateLibrary.findOne({
      _id: id,
      organizationId,
    });

    if (!libraryTemplate) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Check if user already rated, update if so
    const existingRatingIndex = libraryTemplate.ratings.findIndex(
      (r) => r.userId.toString() === userId.toString(),
    );

    if (existingRatingIndex >= 0) {
      libraryTemplate.ratings[existingRatingIndex].rating = rating;
      libraryTemplate.ratings[existingRatingIndex].review = review;
    } else {
      libraryTemplate.ratings.push({ userId, rating, review });
    }

    libraryTemplate.calculateAverageRating();
    await libraryTemplate.save();

    res.status(200).json(libraryTemplate);
  } catch (error) {
    console.error("Error rating template:", error);
    res.status(500).json({ error: "Failed to rate template" });
  }
};
