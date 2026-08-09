import mongoose from "mongoose";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

const ALLOWED_ARCHIVE_TYPES = ["all", "decision", "action-item"];

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const asString = String(value);
  return mongoose.Types.ObjectId.isValid(asString)
    ? new mongoose.Types.ObjectId(asString)
    : value;
};

/**
 * Builds the $match filter shared by both memory collections for the
 * Knowledge Archive browser.
 */
export const buildArchiveMatch = ({ organization, search }) => {
  const match = {
    organization: toObjectId(organization),
    lifecycleState: "archived",
  };

  if (typeof search === "string" && search.trim()) {
    match.text = { $regex: search.trim(), $options: "i" };
  }

  return match;
};

const withTypeAndSortDate = (type) => ({
  $addFields: {
    type,
    sortDate: { $ifNull: ["$archivedAt", "$updatedAt"] },
  },
});

const meetingLookupStages = [
  {
    $lookup: {
      from: "meetings",
      localField: "sourceMeetingId",
      foreignField: "_id",
      as: "_sourceMeeting",
      pipeline: [{ $project: { title: 1, date: 1 } }],
    },
  },
  {
    $addFields: {
      sourceMeetingId: { $arrayElemAt: ["$_sourceMeeting", 0] },
    },
  },
  { $project: { _sourceMeeting: 0, sortDate: 0, embedding: 0 } },
];

/**
 * Builds the aggregation pipeline that returns one correctly paginated page
 * of archived memories. When `type` is `"all"`, decisions and action items
 * are unioned and sorted together before skip/limit so pages never skip or
 * duplicate records the way client-side merging of two independent pages did.
 */
export const buildArchivePipeline = ({
  type = "all",
  organization,
  search,
  skip = 0,
  limit = 10,
}) => {
  const match = buildArchiveMatch({ organization, search });
  const actionItemCollection = ActionItem.collection?.name || "actionitems";

  const decisionBranch = [{ $match: match }, withTypeAndSortDate("decision")];

  let prefix;
  if (type === "decision") {
    prefix = decisionBranch;
  } else if (type === "action-item") {
    prefix = [{ $match: match }, withTypeAndSortDate("action-item")];
  } else {
    prefix = [
      ...decisionBranch,
      {
        $unionWith: {
          coll: actionItemCollection,
          pipeline: [{ $match: match }, withTypeAndSortDate("action-item")],
        },
      },
    ];
  }

  return [
    ...prefix,
    { $sort: { sortDate: -1, _id: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limit }, ...meetingLookupStages],
      },
    },
  ];
};

/**
 * Fetches one page of archived knowledge items with unified pagination.
 *
 * @returns {{ memories: object[], pagination: object }}
 */
export const getArchivedMemoriesPage = async ({
  organization,
  type = "all",
  search,
  page,
  limit,
}) => {
  if (!organization) {
    const err = new Error("Organization required");
    err.statusCode = 400;
    throw err;
  }

  if (!ALLOWED_ARCHIVE_TYPES.includes(type)) {
    const err = new Error(
      `Invalid type. Allowed values: ${ALLOWED_ARCHIVE_TYPES.join(", ")}`,
    );
    err.statusCode = 400;
    throw err;
  }

  const pagination = parsePagination(
    { page, limit },
    { defaultLimit: 10, maxLimit: 100 },
  );

  const pipeline = buildArchivePipeline({
    type,
    organization,
    search,
    skip: pagination.skip,
    limit: pagination.limit,
  });

  const Model = type === "action-item" ? ActionItem : Decision;
  const [facet] = await Model.aggregate(pipeline);
  const memories = facet?.data || [];
  const total = facet?.metadata?.[0]?.total || 0;

  return {
    memories,
    pagination: buildPaginationMeta({
      total,
      page: pagination.page,
      limit: pagination.limit,
    }),
  };
};

export { ALLOWED_ARCHIVE_TYPES };
