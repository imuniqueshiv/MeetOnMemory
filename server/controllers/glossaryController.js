import mongoose from "mongoose";
import { z } from "zod";
import GlossaryTerm from "../models/glossaryTermModel.js";
import glossaryService from "../services/glossaryService.js";
import { caseInsensitiveEquals } from "../utils/regexUtils.js";
import { AppError } from "../utils/errors.js";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

/**
 * Field limits (Issue #1273).
 *
 * `createTerm` previously took `term`, `definition`, `aliases`, `category` and
 * `examples` straight off the body with only a truthiness check on the first
 * two, so `aliases: "not-an-array"` reached Mongoose as a cast failure reported
 * as a 500, and a multi-megabyte definition was stored verbatim.
 */
const MAX_TERM_LENGTH = 120;
const MAX_DEFINITION_LENGTH = 2000;
const MAX_CATEGORY_LENGTH = 60;
const MAX_LIST_ENTRIES = 25;
const MAX_LIST_ENTRY_LENGTH = 200;

const shortStringList = z
  .array(z.string().trim().min(1).max(MAX_LIST_ENTRY_LENGTH))
  .max(MAX_LIST_ENTRIES);

/**
 * The fields a client may write, and nothing else.
 *
 * `.strict()` is the load-bearing part. `updateTerm` used to pass `req.body`
 * directly into `$set`, so a request could assign **any** path on the document:
 *
 *   - `organization` — re-parents the term into another tenant. The document
 *     leaves the owner's glossary and appears in the attacker's, definition and
 *     examples included. The `findOneAndUpdate` *filter* was correctly scoped,
 *     which is exactly what made this easy to miss: the caller has to own the
 *     term to move it, but that is a low bar for any member.
 *   - `approvalStatus` — flips an AI suggestion to `approved` without going
 *     through `approveTerm`, or quietly un-approves a curated term.
 *   - `usageCount`, `isAutoSuggested`, `createdAt`, `updatedAt`, `_id`.
 *
 * Rejecting unknown keys rather than stripping them means a client sending one
 * finds out, instead of watching the write silently do nothing.
 */
const termFieldsSchema = z.object({
  term: z.string().trim().min(1).max(MAX_TERM_LENGTH),
  definition: z.string().trim().min(1).max(MAX_DEFINITION_LENGTH),
  aliases: shortStringList.optional(),
  category: z.string().trim().min(1).max(MAX_CATEGORY_LENGTH).optional(),
  examples: shortStringList.optional(),
});

const createTermSchema = termFieldsSchema.strict();

/**
 * Update accepts any subset, but at least one field — an empty body is a
 * no-op the caller almost certainly did not intend.
 */
const updateTermSchema = termFieldsSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const detectSchema = z.object({
  text: z.string().min(1).max(50000),
});

const extractSchema = z.object({
  meetingId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "meetingId must be a valid ID",
  }),
});

const rejectTermSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * Optional edits applied when approving a pending suggestion (#2245).
 */
const approveTermSchema = termFieldsSchema.partial().strict();

/**
 * Looks up a term by its exact name, ignoring case (Issue #1157).
 *
 * Previously `{ $regex: new RegExp(`^${term}$`, "i") }` — so a term stored as
 * `.*` matched every subsequent lookup and blocked all further term creation,
 * and a legitimate term like `C++` or `a{2,` threw a `SyntaxError` that
 * surfaced as "Server error creating glossary term".
 */
const findTermByName = (orgId, term) => {
  const { filter, collation } = caseInsensitiveEquals("term", term);
  return GlossaryTerm.findOne({ organization: orgId, ...filter }).collation(
    collation,
  );
};

const resolveOrgId = (req) => req.user?.organization || req.organization?._id;

const sendZodError = (res, error) =>
  res.status(400).json({
    message: "Validation error",
    errors: error.errors,
  });

/**
 * Maps an `AppError` thrown by the service onto its own status.
 *
 * Every handler in this file used to funnel *all* failures into a 500, so a
 * cross-organization extraction attempt was indistinguishable from a database
 * outage — both to the caller and in the logs.
 *
 * Returns true when it has responded.
 */
const sendAppError = (res, error) => {
  if (!(error instanceof AppError)) return false;

  res.status(error.statusCode).json({ message: error.message });
  return true;
};

/**
 * Get all glossary terms for an organization
 */
export const getTerms = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { status, search } = req.query;

    const query = { organization: orgId };

    if (status) {
      query.approvalStatus = status;
    }

    if (search) {
      if (typeof search !== "string") {
        return res
          .status(400)
          .json({ message: "Search query must be a string" });
      }
      if (search.length > 200) {
        return res
          .status(400)
          .json({ message: "Search query cannot exceed 200 characters" });
      }
      query.$text = { $search: search };
    }

    // Pagination support (Issue #1679)
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const total = await GlossaryTerm.countDocuments(query);
    const terms = await GlossaryTerm.find(query)
      .sort({ term: 1 })
      .skip(skip)
      .limit(limit);

    // If query specifically requested pagination (page or limit provided), return envelope;
    // otherwise if unpaginated query, return envelope with array in terms property & support top-level array for backwards compatibility
    if (req.query.page !== undefined || req.query.limit !== undefined) {
      return res.status(200).json({
        success: true,
        terms,
        pagination: buildPaginationMeta({ total, page, limit }),
      });
    }

    // For backwards compatibility with existing clients expecting array directly or envelope
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
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { term, definition, aliases, category, examples } =
      createTermSchema.parse(req.body);

    // Check for existing term (case-insensitive)
    const existing = await findTermByName(orgId, term);

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
    if (error instanceof z.ZodError) return sendZodError(res, error);

    console.error("Error creating glossary term:", error);
    res.status(500).json({ message: "Server error creating glossary term" });
  }
};

/**
 * Update a glossary term
 */
export const updateTerm = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid term ID" });
    }

    const updates = updateTermSchema.parse(req.body);

    // Renaming must not collide with another term in the same organization —
    // the same uniqueness rule `createTerm` applies. `findTermByName` uses a
    // collated equality match, so it is safe to call with arbitrary input.
    if (updates.term) {
      const existing = await findTermByName(orgId, updates.term);
      if (existing && existing._id.toString() !== id) {
        return res
          .status(400)
          .json({ message: "This term already exists in your glossary" });
      }
    }

    // `updates` is the parsed schema output, never `req.body`, so `organization`
    // and `approvalStatus` cannot appear here regardless of what was sent.
    const updatedTerm = await GlossaryTerm.findOneAndUpdate(
      { _id: id, organization: orgId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!updatedTerm) {
      return res.status(404).json({ message: "Term not found" });
    }

    res.status(200).json(updatedTerm);
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);

    console.error("Error updating glossary term:", error);
    res.status(500).json({ message: "Server error updating glossary term" });
  }
};

/**
 * Delete a glossary term
 */
export const deleteTerm = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid term ID" });
    }

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
 * Approve a pending term, optionally with corrected fields (#2245).
 */
export const approveTerm = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid term ID" });
    }

    const edits =
      req.body && Object.keys(req.body).length > 0
        ? approveTermSchema.parse(req.body)
        : {};

    if (edits.term) {
      const existing = await findTermByName(orgId, edits.term);
      if (existing && existing._id.toString() !== id) {
        return res
          .status(400)
          .json({ message: "This term already exists in your glossary" });
      }
    }

    const term = await GlossaryTerm.findOne({
      _id: id,
      organization: orgId,
      approvalStatus: "pending",
    });

    if (!term) {
      return res.status(404).json({ message: "Pending term not found" });
    }

    Object.assign(term, edits, {
      approvalStatus: "approved",
      rejectionReason: null,
    });
    await term.save();

    res.status(200).json(term);
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);

    console.error("Error approving glossary term:", error);
    res.status(500).json({ message: "Server error approving glossary term" });
  }
};

/**
 * Reject a pending term with a reason (#2245).
 */
export const rejectTerm = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid term ID" });
    }

    const { reason } = rejectTermSchema.parse(req.body);

    const term = await GlossaryTerm.findOneAndUpdate(
      { _id: id, organization: orgId, approvalStatus: "pending" },
      { $set: { approvalStatus: "rejected", rejectionReason: reason } },
      { new: true },
    );

    if (!term) {
      return res.status(404).json({ message: "Pending term not found" });
    }

    console.info(
      `[Glossary] Pending term rejected: id=${term._id} term="${term.term}" reason="${reason}" org=${orgId}`,
    );

    res.status(200).json(term);
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);

    console.error("Error rejecting glossary term:", error);
    res.status(500).json({ message: "Server error rejecting glossary term" });
  }
};

/**
 * Detect terms in a given text string
 */
export const detect = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { text } = detectSchema.parse(req.body);

    const matches = await glossaryService.detectTerms(text, orgId);
    res.status(200).json(matches);
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);

    console.error("Error detecting glossary terms:", error);
    res.status(500).json({ message: "Server error detecting terms" });
  }
};

/**
 * Trigger AI extraction for a specific meeting
 */
export const extract = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is missing" });
    }

    const { meetingId } = extractSchema.parse(req.body);

    const suggestions = await glossaryService.aiExtractTerms(meetingId, orgId);
    res.status(200).json(suggestions);
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);
    // 403 for a meeting outside the caller's organization, 404 for one that
    // does not exist — previously both were a 500 (Issue #1273).
    if (sendAppError(res, error)) return;

    console.error("Error extracting glossary terms:", error);
    res.status(500).json({ message: "Server error extracting terms" });
  }
};
