import Meeting from "../models/meetingModel.js";

export const createMeetingRecord = async (data) => {
  return await Meeting.create(data);
};

export const findMeetingById = async (id) => {
  return await Meeting.findById(id);
};

export const findMeetingByQuery = async (query) => {
  return await Meeting.findOne(query);
};

export const getMeetingsQuery = async (query, skip, limit) => {
  return await Meeting.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select(
      "title summary structuredMoM createdAt date meetingType status time duration recordingType organization",
    )
    .populate("organization", "name");
};

export const countMeetingsQuery = async (query) => {
  return await Meeting.countDocuments(query);
};

export const deleteMeetingById = async (id) => {
  return await Meeting.findByIdAndDelete(id);
};

export const searchMeetingsRecords = async (searchQuery, filter = {}) => {
  return await Meeting.find({
    $text: { $search: searchQuery },
    ...filter,
  })
    .sort({ createdAt: -1 })
    .select("title summary createdAt date meetingType organization uploadedBy");
};
