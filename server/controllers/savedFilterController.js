import SavedFilter from "../models/savedFilterModel.js";
import savedFilterService from "../services/savedFilterService.js";
import { z } from "zod";

// Basic schema for validation
const savedFilterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  filters: z.record(z.any()),
  isPinned: z.boolean().optional(),
  isShared: z.boolean().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const createSavedFilter = async (req, res) => {
  try {
    const orgId = req.user.organizationId || req.user.organization;
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization context required" });
    }

    const validatedData = savedFilterSchema.parse(req.body);

    const savedFilter = new SavedFilter({
      ...validatedData,
      user: req.user._id,
      organization: orgId,
    });

    await savedFilter.save();

    // Trigger count refresh if pinned
    if (savedFilter.isPinned) {
      // Run asynchronously without blocking
      savedFilterService
        .refreshMatchCounts(req.user._id, orgId)
        .catch((err) =>
          console.error("Error refreshing match counts after creation:", err),
        );
    }

    res.status(201).json({ success: true, savedFilter });
  } catch (error) {
    console.error("Error in createSavedFilter:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSavedFilters = async (req, res) => {
  try {
    const orgId = req.user.organizationId || req.user.organization;
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization context required" });
    }

    // Refresh match counts before returning to ensure they are up to date
    await savedFilterService.refreshMatchCounts(req.user._id, orgId);

    const filters = await SavedFilter.find({
      organization: orgId,
      $or: [{ user: req.user._id }, { isShared: true }],
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, savedFilters: filters });
  } catch (error) {
    console.error("Error in getSavedFilters:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateSavedFilter = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId || req.user.organization;

    const validatedData = savedFilterSchema.partial().parse(req.body);

    const filter = await SavedFilter.findOne({ _id: id, organization: orgId });
    if (!filter) {
      return res
        .status(404)
        .json({ success: false, message: "Saved filter not found" });
    }

    // Only owner can update shared status or core details, but we'll enforce owner-only updates for simplicity
    if (filter.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this filter",
      });
    }

    Object.assign(filter, validatedData);
    await filter.save();

    if (filter.isPinned) {
      savedFilterService
        .refreshMatchCounts(req.user._id, orgId)
        .catch((err) =>
          console.error("Error refreshing match counts after update:", err),
        );
    }

    res.status(200).json({ success: true, savedFilter: filter });
  } catch (error) {
    console.error("Error in updateSavedFilter:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteSavedFilter = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId || req.user.organization;

    const filter = await SavedFilter.findOne({ _id: id, organization: orgId });
    if (!filter) {
      return res
        .status(404)
        .json({ success: false, message: "Saved filter not found" });
    }

    if (filter.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this filter",
      });
    }

    await filter.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Filter deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSavedFilter:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const togglePin = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId || req.user.organization;

    const filter = await SavedFilter.findOne({ _id: id, organization: orgId });
    if (!filter) {
      return res
        .status(404)
        .json({ success: false, message: "Saved filter not found" });
    }

    filter.isPinned = !filter.isPinned;
    await filter.save();

    res
      .status(200)
      .json({ success: true, isPinned: filter.isPinned, savedFilter: filter });
  } catch (error) {
    console.error("Error in togglePin:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
