import { jest } from "@jest/globals";
import mongoose from "mongoose";
import RecapEmailService from "../services/recapEmailService.js";
import RecapPreference from "../models/recapPreferenceModel.js";
import RecapDelivery from "../models/recapDeliveryModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import EmailService from "../services/EmailService.js";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Meeting.deleteMany({});
  await RecapPreference.deleteMany({});
  await RecapDelivery.deleteMany({});
  jest.clearAllMocks();
});

jest.spyOn(EmailService, "sendMail").mockResolvedValue(true);

describe("RecapEmailService", () => {
  let user;
  let meeting;

  beforeEach(async () => {
    user = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password",
    });

    meeting = await Meeting.create({
      title: "Test Meeting",
      date: new Date(),
      uploadedBy: user._id,
      participants: [{ name: "Test User", email: "test@example.com" }],
      status: "completed",
      summary: "This is a summary",
    });
  });

  describe("sendImmediateRecap", () => {
    it("should send email if user prefers immediate delivery", async () => {
      await RecapPreference.create({
        userId: user._id,
        deliveryTiming: "immediate",
      });

      await RecapEmailService.sendImmediateRecap(meeting._id);

      expect(EmailService.sendMail).toHaveBeenCalledTimes(1);

      const delivery = await RecapDelivery.findOne({
        meetingId: meeting._id,
        userId: user._id,
      });
      expect(delivery).toBeTruthy();
    });

    it("should NOT send email if user prefers daily delivery", async () => {
      await RecapPreference.create({
        userId: user._id,
        deliveryTiming: "daily",
      });

      await RecapEmailService.sendImmediateRecap(meeting._id);

      expect(EmailService.sendMail).not.toHaveBeenCalled();

      const delivery = await RecapDelivery.findOne({
        meetingId: meeting._id,
        userId: user._id,
      });
      expect(delivery).toBeFalsy();
    });

    it("should prevent duplicate delivery", async () => {
      await RecapPreference.create({
        userId: user._id,
        deliveryTiming: "immediate",
      });

      // First time
      await RecapEmailService.sendImmediateRecap(meeting._id);
      expect(EmailService.sendMail).toHaveBeenCalledTimes(1);

      // Second time
      await RecapEmailService.sendImmediateRecap(meeting._id);
      expect(EmailService.sendMail).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe("batchRecapsByUser", () => {
    it("should send daily digest for undelivered meetings", async () => {
      await RecapPreference.create({
        userId: user._id,
        deliveryTiming: "daily",
      });

      await RecapEmailService.batchRecapsByUser(user._id, "daily");

      expect(EmailService.sendMail).toHaveBeenCalledTimes(1);
      expect(EmailService.sendMail.mock.calls[0][0].subject).toContain("Daily");

      const delivery = await RecapDelivery.findOne({
        meetingId: meeting._id,
        userId: user._id,
      });
      expect(delivery).toBeTruthy();
    });

    it("should not send daily digest if user prefers weekly", async () => {
      await RecapPreference.create({
        userId: user._id,
        deliveryTiming: "weekly",
      });

      await RecapEmailService.batchRecapsByUser(user._id, "daily");

      expect(EmailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe("buildRecapHtml", () => {
    it("should include summary if requested", async () => {
      const prefs = { includeSummary: true };
      const html = await RecapEmailService.buildRecapHtml(meeting, prefs);
      expect(html).toContain("This is a summary");
    });

    it("should not include summary if not requested", async () => {
      const prefs = { includeSummary: false };
      const html = await RecapEmailService.buildRecapHtml(meeting, prefs);
      expect(html).not.toContain("This is a summary");
    });
  });
});
