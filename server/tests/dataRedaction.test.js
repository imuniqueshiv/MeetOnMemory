import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";
import User from "../models/userModel.js";
import RedactionAudit from "../models/redactionAuditModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import {
  encryptText,
  decryptText,
  redactTextAndAudit,
} from "../services/dataRedactionService.js";

let adminToken;
let memberToken;
let adminUser;
let memberUser;
let testMeeting;
let _testTranscript;
const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  // Clean up
  await User.deleteMany({ email: /redact-.*@example\.com/ });
  await Meeting.deleteMany({ title: "PII Redaction Test Meeting" });
  await RedactionAudit.deleteMany({ organizationId: orgId });

  // Create Users
  adminUser = await User.create({
    name: "Admin User",
    email: `redact-admin-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_admin_${Date.now()}`,
  });

  memberUser = await User.create({
    name: "Member User",
    email: `redact-member-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `clerk_member_${Date.now()}`,
  });

  adminToken = createClerkTestToken({
    clerkUserId: adminUser.clerkUserId,
    email: adminUser.email,
  });

  memberToken = createClerkTestToken({
    clerkUserId: memberUser.clerkUserId,
    email: memberUser.email,
  });

  // Create Meeting & Transcript
  testMeeting = await Meeting.create({
    title: "PII Redaction Test Meeting",
    description: "Contains secret api keys",
    uploadedBy: adminUser._id,
    organization: orgId,
    date: new Date(),
    transcript:
      "Hello! Reach me at contact@example.com or +1 555-0199. Stripe key is " +
      "sk_live_" +
      "mockstripekeywithlengthovertwentyfour",
    summary: "Decisions: Call +1 555-0199 or email contact@example.com.",
    aiNotes:
      "Stripe live token is " +
      "sk_live_" +
      "mockstripekeywithlengthovertwentyfour",
  });

  _testTranscript = await Transcript.create({
    meeting: testMeeting._id,
    organizationId: orgId,
    fullText:
      "Hello! Reach me at contact@example.com or +1 555-0199. Stripe key is " +
      "sk_live_" +
      "mockstripekeywithlengthovertwentyfour",
    segments: [
      {
        text: "Hello! Reach me at contact@example.com.",
        speaker: "Speaker 1",
        startTime: 0,
        endTime: 5,
      },
      {
        text:
          "Stripe key is " +
          "sk_live_" +
          "mockstripekeywithlengthovertwentyfour",
        speaker: "Speaker 2",
        startTime: 5,
        endTime: 10,
      },
    ],
  });
});

describe("PII Redaction & Encryption Services", () => {
  it("should encrypt and decrypt strings correctly using AES-256", () => {
    const originalText = "SuperSecretAPIKey123!";
    const encrypted = encryptText(originalText);
    expect(encrypted).toContain(":");

    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it("should mask PII sequences and save logs in RedactionAudit", async () => {
    const text =
      "Phone: +1 555-0199, Email: user@domain.com, API: " +
      "sk_live_" +
      "anothermockstripekeywithlength";
    const result = await redactTextAndAudit(text, testMeeting._id, orgId);

    expect(result.redactedText).toContain("[REDACTED_PHONE]");
    expect(result.redactedText).toContain("[REDACTED_EMAIL]");
    expect(result.redactedText).toContain("[REDACTED_API_KEY]");

    // Verify RedactionAudit entries were saved
    const audits = await RedactionAudit.find({ meetingId: testMeeting._id });
    expect(audits.length).toBe(3);
    const types = audits.map((a) => a.entityType);
    expect(types).toContain("PHONE");
    expect(types).toContain("EMAIL");
    expect(types).toContain("API_KEY");
  });
});

describe("PII Anonymization & Unmasking API Endpoints (#2557)", () => {
  it("should allow an Admin to anonymize a meeting, masking PII and encrypting originals", async () => {
    const res = await request(app)
      .post("/api/meetings/anonymize")
      .set(authHeader(adminToken))
      .send({ meetingId: testMeeting._id });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Meeting values are updated
    const updatedMeeting = await Meeting.findById(testMeeting._id);
    expect(updatedMeeting.isRedacted).toBe(true);
    expect(updatedMeeting.transcript).toContain("[REDACTED_EMAIL]");
    expect(updatedMeeting.transcript).toContain("[REDACTED_PHONE]");
    expect(updatedMeeting.transcript).toContain("[REDACTED_API_KEY]");

    // Verify Transcript segments are updated
    const updatedTranscript = await Transcript.findOne({
      meeting: testMeeting._id,
    });
    expect(updatedTranscript.fullText).toContain("[REDACTED_EMAIL]");
    expect(updatedTranscript.segments[1].text).toContain("[REDACTED_API_KEY]");

    // Verify originals are encrypted
    expect(updatedMeeting.encryptedOriginals.transcript).not.toContain(
      "contact@example.com",
    );
    expect(decryptText(updatedMeeting.encryptedOriginals.transcript)).toContain(
      "contact@example.com",
    );
  });

  it("should deny anonymization requests from non-admin members", async () => {
    const res = await request(app)
      .post("/api/meetings/anonymize")
      .set(authHeader(memberToken))
      .send({ meetingId: testMeeting._id });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should allow Admin/Owner to decrypt and view raw plaintext transcript", async () => {
    // Redact first
    await request(app)
      .post("/api/meetings/anonymize")
      .set(authHeader(adminToken))
      .send({ meetingId: testMeeting._id });

    // Fetch original decrypted values
    const res = await request(app)
      .get(`/api/meetings/${testMeeting._id}/raw`)
      .set(authHeader(adminToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.original.transcript).toContain("contact@example.com");
    expect(res.body.data.original.transcriptSegments).toContain("sk_live_mock");
  });

  it("should deny raw unredacted access to standard members", async () => {
    // Redact first
    await request(app)
      .post("/api/meetings/anonymize")
      .set(authHeader(adminToken))
      .send({ meetingId: testMeeting._id });

    const res = await request(app)
      .get(`/api/meetings/${testMeeting._id}/raw`)
      .set(authHeader(memberToken));

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
