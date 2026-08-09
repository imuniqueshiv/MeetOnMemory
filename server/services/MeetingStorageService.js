import Meeting from "../models/meetingModel.js";
import { withActiveMeetings } from "../utils/meetingSoftDelete.js";

export const createMeetingRecord = async (data) => {
  return await Meeting.create(data);
};

export const findMeetingById = async (id) => {
  return await Meeting.findOne(withActiveMeetings({ _id: id }));
};

export const findMeetingByQuery = async (query) => {
  return await Meeting.findOne(withActiveMeetings(query));
};

export const getMeetingsQuery = async (
  query,
  skip,
  limit,
  sort = { createdAt: -1 },
) => {
  return await Meeting.find(withActiveMeetings(query))
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select(
      "title summary structuredMoM createdAt date meetingType status time duration recordingType organization",
    )
    .populate("organization", "name");
};

export const countMeetingsQuery = async (query) => {
  return await Meeting.countDocuments(withActiveMeetings(query));
};

export const deleteMeetingById = async (id) => {
  return await Meeting.findByIdAndDelete(id);
};

export const searchMeetingsRecords = async (searchQuery, filter = {}) => {
  return await Meeting.find(
    withActiveMeetings({
      $text: { $search: searchQuery },
      ...filter,
    }),
  )
    .sort({ createdAt: -1 })
    .select("title summary createdAt date meetingType organization uploadedBy");
};
