import GlossaryTerm from "../models/glossaryTermModel.js";
import glossaryService from "../services/glossaryService.js";

/**
 * Get all glossary terms for an organization
 */
export const getTerms = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { status, search } = req.query;

    const query = { organization: orgId };

    if (status) {
      query.approvalStatus = status;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const terms = await GlossaryTerm.find(query).sort({ term: 1 });
    res.status(200).json(terms);
  } catch (error) {
    console.error("Error fetching glossary terms:", error);
    res.status(500).json({ message: "Server error fetching glossary terms" });
  }
};

/**
 * Create a new glossary term
 */
export const createTerm = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { term, definition, aliases, category, examples } = req.body;

    if (!term || !definition) {
      return res
        .status(400)
        .json({ message: "Term and definition are required" });
    }

    // Check for existing term (case-insensitive)
    const existing = await GlossaryTerm.findOne({
      organization: orgId,
      term: { $regex: new RegExp(`^${term}$`, "i") },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "This term already exists in your glossary" });
    }

    const newTerm = new GlossaryTerm({
      organization: orgId,
      term,
      definition,
      aliases: aliases || [],
      category: category || "General",
      examples: examples || [],
      approvalStatus: "approved", // User-created terms are auto-approved
    });

    await newTerm.save();
    res.status(201).json(newTerm);
  } catch (error) {
    console.error("Error creating glossary term:", error);
    res.status(500).json({ message: "Server error creating glossary term" });
  }
};

/**
 * Update a glossary term
 */
export const updateTerm = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    const { id } = req.params;

    const updatedTerm = await GlossaryTerm.findOneAndUpdate(
      { _id: id, organization: orgId },
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!updatedTerm) {
      return res.status(404).json({ message: "Term not found" });
    }

    res.status(200).json(updatedTerm);
  } catch (error) {
    console.error("Error updating glossary term:", error);
    res.status(500).json({ message: "Server error updating glossary term" });
  }
};

/**
 * Delete a glossary term
 */
export const deleteTerm = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    const { id } = req.params;

    const deletedTerm = await GlossaryTerm.findOneAndDelete({
      _id: id,
      organization: orgId,
    });

    if (!deletedTerm) {
      return res.status(404).json({ message: "Term not found" });
    }

    res.status(200).json({ message: "Term deleted successfully" });
  } catch (error) {
    console.error("Error deleting glossary term:", error);
    res.status(500).json({ message: "Server error deleting glossary term" });
  }
};

/**
 * Approve a pending term
 */
export const approveTerm = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    const { id } = req.params;

    const term = await GlossaryTerm.findOneAndUpdate(
      { _id: id, organization: orgId, approvalStatus: "pending" },
      { $set: { approvalStatus: "approved" } },
      { new: true },
    );

    if (!term) {
      return res.status(404).json({ message: "Pending term not found" });
    }

    res.status(200).json(term);
  } catch (error) {
    console.error("Error approving glossary term:", error);
    res.status(500).json({ message: "Server error approving glossary term" });
  }
};

/**
 * Detect terms in a given text string
 */
export const detect = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { text } = req.body;
    if (!text) {
      return res
        .status(400)
        .json({ message: "Text is required for detection" });
    }

    const matches = await glossaryService.detectTerms(text, orgId);
    res.status(200).json(matches);
  } catch (error) {
    console.error("Error detecting glossary terms:", error);
    res.status(500).json({ message: "Server error detecting terms" });
  }
};

/**
 * Trigger AI extraction for a specific meeting
 */
export const extract = async (req, res) => {
  try {
    const orgId = req.user?.organization || req.organization?._id;
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { meetingId } = req.body;
    if (!meetingId) {
      return res.status(400).json({ message: "Meeting ID is required" });
    }

    const suggestions = await glossaryService.aiExtractTerms(meetingId, orgId);
    res.status(200).json(suggestions);
  } catch (error) {
    console.error("Error extracting glossary terms:", error);
    res.status(500).json({ message: "Server error extracting terms" });
  }
};
