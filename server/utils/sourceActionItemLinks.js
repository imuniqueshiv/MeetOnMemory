import mongoose from "mongoose";
import ActionItem from "../models/actionItemModel.js";
import { ValidationError, ForbiddenError } from "./errors.js";

const MAX_SOURCE_ACTION_ITEMS = 50;

/**
 * Validate optional source action-item IDs for follow-up meeting creation (#721).
 * Ensures every ID exists and belongs to the caller's organization (when set).
 *
 * @param {string|null} orgId
 * @param {string[]} rawIds
 * @returns {Promise<string[]>}
 */
export const resolveSourceActionItemIds = async (orgId, rawIds = []) => {
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return [];
  }

  const uniqueIds = [
    ...new Set(
      rawIds.map((id) => (id == null ? "" : String(id).trim())).filter(Boolean),
    ),
  ];

  if (uniqueIds.length > MAX_SOURCE_ACTION_ITEMS) {
    throw new ValidationError(
      `At most ${MAX_SOURCE_ACTION_ITEMS} source action items can be linked`,
    );
  }

  const invalidId = uniqueIds.find(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );
  if (invalidId) {
    throw new ValidationError(`Invalid source action item id: ${invalidId}`);
  }

  const items = await ActionItem.find({ _id: { $in: uniqueIds } }).populate(
    "sourceMeetingId",
    "organization",
  );

  if (items.length !== uniqueIds.length) {
    throw new ValidationError("One or more source action items were not found");
  }

  if (orgId) {
    const orgIdStr = orgId.toString();
    for (const item of items) {
      const meetingOrg = item.sourceMeetingId?.organization;
      if (meetingOrg && meetingOrg.toString() !== orgIdStr) {
        throw new ForbiddenError(
          "Source action items must belong to your organization",
        );
      }
    }
  }

  return uniqueIds;
};
