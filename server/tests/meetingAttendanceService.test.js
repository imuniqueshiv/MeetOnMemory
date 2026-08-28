import mongoose from "mongoose";
import MeetingAttendance from "../models/meetingAttendanceModel.js";
import {
  initializeAttendance,
  checkIn,
  checkOut,
  markExcused,
  finalizeMeetingAttendance,
} from "../services/meetingAttendanceService.js";
import Meeting from "../models/meetingModel.js";

describe("MeetingAttendanceService", () => {
  beforeAll(async () => {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/test",
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await MeetingAttendance.deleteMany({});
    await Meeting.deleteMany({});
  });

  const mockMeetingId = new mongoose.Types.ObjectId();
  const mockParticipants = [
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
  ];

  it("should initialize attendance for participants", async () => {
    await initializeAttendance(mockMeetingId, mockParticipants);

    const records = await MeetingAttendance.find({ meetingId: mockMeetingId });
    expect(records.length).toBe(2);
    expect(records[0].status).toBe("invited");
    expect(records[1].status).toBe("invited");
  });

  it("should check in a participant", async () => {
    await initializeAttendance(mockMeetingId, mockParticipants);
    const joinTime = new Date();
    await checkIn(mockMeetingId, "user1@example.com", joinTime);

    const record = await MeetingAttendance.findOne({
      meetingId: mockMeetingId,
      email: "user1@example.com",
    });
    expect(record.status).toBe("checked_in");
    expect(record.joinTime).toEqual(joinTime);
  });

  it("should check out a participant", async () => {
    await initializeAttendance(mockMeetingId, mockParticipants);
    const joinTime = new Date();
    await checkIn(mockMeetingId, "user1@example.com", joinTime);

    const leaveTime = new Date(joinTime.getTime() + 60000); // 1 minute later
    await checkOut(mockMeetingId, "user1@example.com", leaveTime);

    const record = await MeetingAttendance.findOne({
      meetingId: mockMeetingId,
      email: "user1@example.com",
    });
    expect(record.leaveTime).toEqual(leaveTime);
  });

  it("should mark a participant as excused", async () => {
    await initializeAttendance(mockMeetingId, mockParticipants);
    await markExcused(mockMeetingId, "user1@example.com");

    const record = await MeetingAttendance.findOne({
      meetingId: mockMeetingId,
      email: "user1@example.com",
    });
    expect(record.status).toBe("excused");
  });

  it("should finalize meeting attendance and mark remaining as no_show", async () => {
    await initializeAttendance(mockMeetingId, mockParticipants);
    await checkIn(mockMeetingId, "user1@example.com", new Date());

    await finalizeMeetingAttendance(mockMeetingId);

    const record1 = await MeetingAttendance.findOne({
      meetingId: mockMeetingId,
      email: "user1@example.com",
    });
    const record2 = await MeetingAttendance.findOne({
      meetingId: mockMeetingId,
      email: "user2@example.com",
    });

    expect(record1.status).toBe("checked_in");
    expect(record2.status).toBe("no_show");
  });
});
