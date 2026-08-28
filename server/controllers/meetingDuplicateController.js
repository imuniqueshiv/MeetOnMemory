import * as duplicateService from "../services/meetingDuplicateService.js";
import Meeting from "../models/meetingModel.js";
import MergeAudit from "../models/mergeAuditModel.js";
import { sendError, sendSuccess } from "../utils/responseHandler.js";
import logger from "../utils/logger.js";

const MERGE_FIELDS = ["title", "time", "participants", "summary", "tags"];

export const normalizeFieldSelections = (selections = {}) => {
  if (!selections || typeof selections !== "object") return {};

  return MERGE_FIELDS.reduce((normalized, field) => {
    if (selections[field] === "primary" || selections[field] === "secondary") {
      normalized[field] = selections[field];
    }
    return normalized;
  }, {});
};

const cloneValue = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item.toObject === "function" ? item.toObject() : item,
    );
  }
  return value && typeof value.toObject === "function"
    ? value.toObject()
    : value;
};

export const buildFieldPatch = (primary, secondary, selections = {}) => {
  const patch = {};

  for (const field of MERGE_FIELDS) {
    if (!selections[field]) continue;
    const source = selections[field] === "secondary" ? secondary : primary;

    if (field === "time") {
      patch.date = source.date;
      patch.time = source.time || "";
    } else {
      patch[field] = cloneValue(source[field]);
    }
  }

  return patch;
};

const buildFieldSnapshot = (meeting, selections) => {
  const snapshot = {};

  for (const field of MERGE_FIELDS) {
    if (!selections[field]) continue;
    snapshot[field] =
      field === "time"
        ? { date: meeting.date, time: meeting.time || "" }
        : cloneValue(meeting[field]);
  }

  return snapshot;
};

export const detectDuplicates = async (req, res) => {
  try {
    const { id } = req.params;
    const userOrgId = req.user?.organization?.toString();

    const meeting = await Meeting.findById(id).select("organization").lean();
    if (!meeting) return sendError(res, 404, "Meeting not found");
    if (meeting.organization?.toString() !== userOrgId) {
      return sendError(res, 403, "Access denied");
    }

    const duplicates = await duplicateService.findDuplicates(id);
    if (duplicates.length === 0) {
      return sendSuccess(
        res,
        { duplicates: [] },
        "Duplicates fetched successfully",
      );
    }

    const detailMeetings = await Meeting.find({
      _id: { $in: duplicates.map((duplicate) => duplicate._id) },
      organization: userOrgId,
    })
      .select("date time participants summary tags")
      .lean();

    const detailMap = new Map(
      detailMeetings.map((candidate) => [candidate._id.toString(), candidate]),
    );

    const enrichedDuplicates = duplicates.map((duplicate) => ({
      ...duplicate,
      ...(detailMap.get(duplicate._id.toString()) || {}),
    }));

    return sendSuccess(
      res,
      { duplicates: enrichedDuplicates },
      "Duplicates fetched successfully",
    );
  } catch (error) {
    logger.error("Error detecting duplicates:", error);
    return sendError(res, 500, error.message);
  }
};

export const mergeMeetings = async (req, res) => {
  try {
    const { id: primaryId } = req.params;
    const { secondaryId, fieldSelections: rawFieldSelections = {} } = req.body;

    if (!secondaryId) {
      return sendError(res, 400, "Secondary meeting ID is required");
    }

    const fieldSelections = normalizeFieldSelections(rawFieldSelections);
    const userOrgId = req.user?.organization?.toString();
    const userId = req.user._id;

    const [primary, secondary] = await Promise.all([
      Meeting.findById(primaryId)
        .select("organization title date time participants summary tags")
        .lean(),
      Meeting.findById(secondaryId)
        .select("organization title date time participants summary tags")
        .lean(),
    ]);

    if (!primary || !secondary) {
      return sendError(res, 404, "One or both meetings not found");
    }

    if (
      primary.organization?.toString() !== userOrgId ||
      secondary.organization?.toString() !== userOrgId
    ) {
      return sendError(res, 403, "Access denied");
    }

    const primaryFieldSnapshot = buildFieldSnapshot(primary, fieldSelections);

    const result = await duplicateService.mergeMeetings(
      primaryId,
      secondaryId,
      userId,
    );

    let updatedFields = [];
    if (Object.keys(fieldSelections).length > 0) {
      const fieldPatch = buildFieldPatch(primary, secondary, fieldSelections);

      if (Object.keys(fieldPatch).length > 0) {
        await Meeting.findByIdAndUpdate(
          primaryId,
          { $set: fieldPatch },
          { new: false, runValidators: true },
        );
        updatedFields = Object.keys(fieldSelections);
      }

      await MergeAudit.findByIdAndUpdate(result.mergeAuditId, {
        $set: {
          "snapshot.primaryFieldValues": primaryFieldSnapshot,
          "snapshot.fieldSelections": fieldSelections,
        },
      });
    }

    return sendSuccess(
      res,
      {
        ...result,
        fieldSelections,
        updatedFields,
      },
      "Meetings merged successfully",
    );
  } catch (error) {
    logger.error("Error merging meetings:", error);
    return sendError(res, 500, error.message);
  }
};

export const dismissDuplicate = async (req, res) => {
  try {
    const { id: primaryId } = req.params;
    const { secondaryId } = req.body;

    if (!secondaryId) {
      return sendError(res, 400, "Secondary meeting ID is required");
    }

    const userId = req.user._id;
    await duplicateService.dismissDuplicate(primaryId, secondaryId, userId);
    return sendSuccess(res, {}, "Duplicate suggestion dismissed");
  } catch (error) {
    logger.error("Error dismissing duplicate:", error);
    return sendError(res, 500, error.message);
  }
};

export const rollbackMerge = async (req, res) => {
  try {
    const { mergeAuditId } = req.params;
    const userOrgId = req.user?.organization?.toString();
    const userId = req.user._id;

    const audit = await MergeAudit.findById(mergeAuditId).lean();
    if (!audit) return sendError(res, 404, "Merge audit record not found");
    if (audit.organization?.toString() !== userOrgId) {
      return sendError(res, 403, "Access denied");
    }

    const result = await duplicateService.rollbackMerge(mergeAuditId, userId);

    if (audit.snapshot?.primaryFieldValues) {
      const restore = {};
      for (const [field, value] of Object.entries(
        audit.snapshot.primaryFieldValues,
      )) {
        if (field === "time" && value) {
          restore.date = value.date;
          restore.time = value.time || "";
        } else {
          restore[field] = value;
        }
      }

      if (Object.keys(restore).length > 0) {
        await Meeting.findByIdAndUpdate(
          audit.primaryMeeting,
          { $set: restore },
          { runValidators: true },
        );
      }
    }

    return sendSuccess(res, result, "Merge rolled back successfully");
  } catch (error) {
    logger.error("Error rolling back merge:", error);
    return sendError(res, 500, error.message);
  }
};
