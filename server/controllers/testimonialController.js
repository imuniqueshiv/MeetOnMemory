import { z } from "zod";
import mongoose from "mongoose";
import Testimonial, {
  TESTIMONIAL_COMMENT_MAX_LENGTH,
} from "../models/testimonialModel.js";

const commentSchema = z
  .string()
  .trim()
  .min(10, "Comment must be at least 10 characters")
  .max(
    TESTIMONIAL_COMMENT_MAX_LENGTH,
    `Comment must be at most ${TESTIMONIAL_COMMENT_MAX_LENGTH} characters`,
  );

const testimonialBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: commentSchema,
});

const statusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

const PUBLIC_USER_SELECT = "name profilePic role organization";
const PUBLIC_ORG_SELECT = "name";

const toPublicTestimonial = (doc) => {
  const user = doc.user || {};
  const organization = doc.organization || null;

  return {
    id: doc._id,
    rating: doc.rating,
    comment: doc.comment,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    user: {
      name: user.name || "Anonymous",
      profilePic: user.profilePic || "",
      role: user.role || null,
    },
    organization: organization ? { name: organization.name || null } : null,
  };
};

const toOwnerTestimonial = (doc) => ({
  ...toPublicTestimonial(doc),
  status: doc.status,
});

const toAdminTestimonial = (doc) => ({
  ...toOwnerTestimonial(doc),
  userId: doc.user?._id || doc.user,
  moderatedAt: doc.moderatedAt,
  moderatedBy: doc.moderatedBy,
  featuredOnHomepage: Boolean(doc.featuredOnHomepage),
  spotlightOrder: Number.isFinite(doc.spotlightOrder) ? doc.spotlightOrder : 0,
});

const idsSchema = z.object({
  ids: z
    .array(z.string().refine((id) => mongoose.isValidObjectId(id)))
    .min(1, "Select at least one testimonial")
    .max(100),
});

const bulkActionSchema = idsSchema.extend({
  action: z.enum(["approve", "reject", "delete"]),
});

const spotlightSchema = z.object({
  featuredOnHomepage: z.boolean(),
  spotlightOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const populatePublic = (query) =>
  query
    .populate("user", PUBLIC_USER_SELECT)
    .populate("organization", PUBLIC_ORG_SELECT);

/**
 * GET /api/testimonials
 * Public list of approved testimonials (paginated).
 */
export const listApprovedTestimonials = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
    );
    const skip = (page - 1) * limit;

    const filter = { status: "approved" };
    const [items, total] = await Promise.all([
      populatePublic(
        Testimonial.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ).lean(),
      Testimonial.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      testimonials: items.map(toPublicTestimonial),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Error listing testimonials:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load testimonials",
    });
  }
};

/**
 * GET /api/testimonials/spotlight
 * Approved testimonials curated for the marketing homepage.
 * Falls back to recent approved items when no spotlight is set.
 */
export const listSpotlightTestimonials = async (req, res) => {
  try {
    const limit = Math.min(
      24,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
    );

    const spotlightFilter = {
      status: "approved",
      featuredOnHomepage: true,
    };

    let items = await populatePublic(
      Testimonial.find(spotlightFilter)
        .sort({ spotlightOrder: 1, createdAt: -1 })
        .limit(limit),
    ).lean();

    if (!items.length) {
      items = await populatePublic(
        Testimonial.find({ status: "approved" })
          .sort({ createdAt: -1 })
          .limit(limit),
      ).lean();
    }

    return res.status(200).json({
      success: true,
      testimonials: items.map(toPublicTestimonial),
    });
  } catch (error) {
    console.error("Error listing spotlight testimonials:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load homepage testimonials",
    });
  }
};

/**
 * GET /api/testimonials/stats
 * Aggregate stats from approved testimonials only.
 */
export const getTestimonialStats = async (req, res) => {
  try {
    const [stats] = await Testimonial.aggregate([
      { $match: { status: "approved" } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        },
      },
    ]);

    const total = stats?.total || 0;
    const averageRating = total
      ? Math.round((stats.averageRating + Number.EPSILON) * 10) / 10
      : 0;

    const distribution = [5, 4, 3, 2, 1].map((stars) => {
      const count = stats?.[`star${stars}`] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return { stars, count, percent };
    });

    return res.status(200).json({
      success: true,
      stats: {
        total,
        averageRating,
        distribution,
      },
    });
  } catch (error) {
    console.error("Error computing testimonial stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load rating statistics",
    });
  }
};

/**
 * GET /api/testimonials/me
 */
export const getMyTestimonial = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const doc = await populatePublic(
      Testimonial.findOne({ user: userId }),
    ).lean();

    return res.status(200).json({
      success: true,
      testimonial: doc ? toOwnerTestimonial(doc) : null,
    });
  } catch (error) {
    console.error("Error fetching own testimonial:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load your review",
    });
  }
};

/**
 * POST /api/testimonials
 */
export const createTestimonial = async (req, res) => {
  try {
    const parsed = testimonialBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid testimonial data",
      });
    }

    const userId = req.user._id || req.user.id;
    const existing = await Testimonial.findOne({ user: userId }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "You have already submitted a review. Edit your existing review instead.",
      });
    }

    const created = await Testimonial.create({
      user: userId,
      organization: req.user.organization || null,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      status: "pending",
    });

    const doc = await populatePublic(Testimonial.findById(created._id)).lean();

    return res.status(201).json({
      success: true,
      message: "Your review has been submitted and is awaiting approval.",
      testimonial: toOwnerTestimonial(doc),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "You have already submitted a review. Edit your existing review instead.",
      });
    }
    console.error("Error creating testimonial:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  }
};

/**
 * PUT /api/testimonials/:id
 */
export const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial id",
      });
    }

    const parsed = testimonialBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid testimonial data",
      });
    }

    const userId = req.user._id || req.user.id;
    const existing = await Testimonial.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    if (existing.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own review",
      });
    }

    existing.rating = parsed.data.rating;
    existing.comment = parsed.data.comment;
    // Re-moderate after edits so pending/rejected content is not auto-published
    existing.status = "pending";
    existing.moderatedAt = null;
    existing.moderatedBy = null;
    existing.featuredOnHomepage = false;
    existing.spotlightOrder = 0;
    await existing.save();

    const doc = await populatePublic(Testimonial.findById(existing._id)).lean();

    return res.status(200).json({
      success: true,
      message: "Your review has been updated and is awaiting approval.",
      testimonial: toOwnerTestimonial(doc),
    });
  } catch (error) {
    console.error("Error updating testimonial:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update review",
    });
  }
};

/**
 * DELETE /api/testimonials/:id
 */
export const deleteOwnTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial id",
      });
    }

    const userId = req.user._id || req.user.id;
    const existing = await Testimonial.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    if (existing.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own review",
      });
    }

    await existing.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Your review has been deleted",
    });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
};

/**
 * GET /api/admin/testimonials
 */
export const listAdminTestimonials = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      populatePublic(
        Testimonial.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ).lean(),
      Testimonial.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      testimonials: items.map(toAdminTestimonial),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Error listing admin testimonials:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load testimonials for moderation",
    });
  }
};

/**
 * PATCH /api/admin/testimonials/:id/status
 */
export const updateTestimonialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial id",
      });
    }

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, approved, or rejected",
      });
    }

    const existing = await Testimonial.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    existing.status = parsed.data.status;
    existing.moderatedBy = req.user._id || req.user.id;
    existing.moderatedAt = new Date();
    if (parsed.data.status !== "approved") {
      existing.featuredOnHomepage = false;
      existing.spotlightOrder = 0;
    }
    await existing.save();

    const doc = await populatePublic(Testimonial.findById(existing._id)).lean();

    return res.status(200).json({
      success: true,
      message: `Testimonial marked as ${parsed.data.status}`,
      testimonial: toAdminTestimonial(doc),
    });
  } catch (error) {
    console.error("Error updating testimonial status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update moderation status",
    });
  }
};

/**
 * POST /api/admin/testimonials/bulk
 * Bulk approve, reject, or delete testimonials.
 */
export const bulkModerateTestimonials = async (req, res) => {
  try {
    const parsed = bulkActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid bulk action",
      });
    }

    const { ids, action } = parsed.data;
    const moderatorId = req.user._id || req.user.id;
    const now = new Date();

    if (action === "delete") {
      const result = await Testimonial.deleteMany({ _id: { $in: ids } });
      return res.status(200).json({
        success: true,
        message: `Removed ${result.deletedCount} testimonial(s)`,
        modifiedCount: result.deletedCount,
      });
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    const update = {
      status: nextStatus,
      moderatedBy: moderatorId,
      moderatedAt: now,
    };
    if (nextStatus !== "approved") {
      update.featuredOnHomepage = false;
      update.spotlightOrder = 0;
    }

    const result = await Testimonial.updateMany(
      { _id: { $in: ids } },
      { $set: update },
    );

    return res.status(200).json({
      success: true,
      message: `Marked ${result.modifiedCount} testimonial(s) as ${nextStatus}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error bulk-moderating testimonials:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to apply bulk moderation action",
    });
  }
};

/**
 * PATCH /api/admin/testimonials/:id/spotlight
 * Feature an approved testimonial on the homepage and set order.
 */
export const updateTestimonialSpotlight = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial id",
      });
    }

    const parsed = spotlightSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message:
          parsed.error.issues[0]?.message || "Invalid spotlight settings",
      });
    }

    const existing = await Testimonial.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    if (parsed.data.featuredOnHomepage && existing.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved testimonials can be featured on the homepage",
      });
    }

    existing.featuredOnHomepage = parsed.data.featuredOnHomepage;
    if (parsed.data.spotlightOrder !== undefined) {
      existing.spotlightOrder = parsed.data.spotlightOrder;
    }
    if (!existing.featuredOnHomepage) {
      existing.spotlightOrder = 0;
    }
    await existing.save();

    const doc = await populatePublic(Testimonial.findById(existing._id)).lean();

    return res.status(200).json({
      success: true,
      message: existing.featuredOnHomepage
        ? "Testimonial featured on homepage"
        : "Testimonial removed from homepage spotlight",
      testimonial: toAdminTestimonial(doc),
    });
  } catch (error) {
    console.error("Error updating testimonial spotlight:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update homepage spotlight",
    });
  }
};

/**
 * DELETE /api/admin/testimonials/:id
 */
export const adminDeleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial id",
      });
    }

    const existing = await Testimonial.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    await existing.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Testimonial removed",
    });
  } catch (error) {
    console.error("Error admin-deleting testimonial:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove testimonial",
    });
  }
};
