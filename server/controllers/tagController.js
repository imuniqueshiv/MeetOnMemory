import { z } from "zod";
import Tag from "../models/tagModel.js";
import Meeting from "../models/meetingModel.js";
import { sendSuccess } from "../utils/responseHandler.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional(),
  description: z.string().max(200).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
  description: z.string().max(200).optional(),
});

export const createTag = async (req, res, next) => {
  try {
    const { name, color, description } = createTagSchema.parse(req.body);
    const orgId = req.user.organization;

    // Check uniqueness
    const existingTag = await Tag.findOne({
      organization: orgId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingTag) {
      throw new ValidationError(
        "Tag with this name already exists in your organization.",
      );
    }

    const tag = await Tag.create({
      name,
      color,
      description,
      organization: orgId,
      createdBy: req.user._id,
    });

    return sendSuccess(res, tag, "Tag created successfully", 201);
  } catch (err) {
    next(err);
  }
};

export const getOrgTags = async (req, res, next) => {
  try {
    const orgId = req.user.organization;
    const tags = await Tag.find({ organization: orgId }).sort({
      usageCount: -1,
      name: 1,
    });

    return sendSuccess(res, tags, "Tags retrieved successfully");
  } catch (err) {
    next(err);
  }
};

export const updateTag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organization;
    const updates = updateTagSchema.parse(req.body);

    const tag = await Tag.findOne({ _id: id, organization: orgId });
    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    const oldName = tag.name;

    // If name is changing, check uniqueness
    if (updates.name && updates.name.toLowerCase() !== tag.name.toLowerCase()) {
      const existingTag = await Tag.findOne({
        organization: orgId,
        name: { $regex: new RegExp(`^${updates.name}$`, "i") },
      });
      if (existingTag) {
        throw new ValidationError(
          "Tag with this name already exists in your organization.",
        );
      }
    }

    Object.assign(tag, updates);
    await tag.save();

    // Cascade rename in meetings if name changed
    if (updates.name && updates.name !== oldName) {
      await Meeting.updateMany(
        { organization: orgId, tags: oldName },
        { $set: { "tags.$": updates.name } },
      );
    }

    return sendSuccess(res, tag, "Tag updated successfully");
  } catch (err) {
    next(err);
  }
};

export const deleteTag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organization;

    const tag = await Tag.findOneAndDelete({ _id: id, organization: orgId });
    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    // Cascade delete in meetings
    await Meeting.updateMany(
      { organization: orgId },
      { $pull: { tags: tag.name } },
    );

    return sendSuccess(res, null, "Tag deleted successfully");
  } catch (err) {
    next(err);
  }
};

export const autocomplete = async (req, res, next) => {
  try {
    const { q } = req.query;
    const orgId = req.user.organization;

    if (!q) {
      return sendSuccess(res, []);
    }

    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tags = await Tag.find({
      organization: orgId,
      name: { $regex: new RegExp(`^${escapedQ}`, "i") },
    })
      .limit(10)
      .sort({ usageCount: -1 });

    return sendSuccess(res, tags);
  } catch (err) {
    next(err);
  }
};

export const getMeetingsByTag = async (req, res, next) => {
  try {
    const { name } = req.params;
    const orgId = req.user.organization;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { organization: orgId, tags: name };

    const meetings = await Meeting.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "name email");

    const total = await Meeting.countDocuments(query);

    return sendSuccess(res, {
      meetings,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
    });
  } catch (err) {
    next(err);
  }
};

export const getTagStats = async (req, res, next) => {
  try {
    const orgId = req.user.organization;

    // Top 10 tags by usage count
    const topTags = await Tag.find({ organization: orgId })
      .sort({ usageCount: -1 })
      .limit(10);

    return sendSuccess(res, {
      topTags,
    });
  } catch (err) {
    next(err);
  }
};
