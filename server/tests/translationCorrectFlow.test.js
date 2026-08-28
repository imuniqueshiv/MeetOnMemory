import request from "supertest";
import { app } from "../server.js";
import { describe, it, expect, beforeEach } from "vitest";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Meeting from "../models/meetingModel.js";
import RealtimeTranslationCache from "../models/TranslationCache.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let token;
let user;
let organization;
let meeting;

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /translation-flow/ }),
    Organization.deleteMany({ name: "Translation Flow Org" }),
    Meeting.deleteMany({ title: "Translation Flow Meeting" }),
    RealtimeTranslationCache.deleteMany({}),
  ]);

  user = await User.create({
    name: "Translation User",
    email: `translation-flow-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    clerkUserId: `user_trans_flow_${Date.now()}`,
  });

  organization = await Organization.create({
    name: "Translation Flow Org",
    slug: `trans-flow-${Date.now()}`,
    owner: user._id,
  });

  user.organization = organization._id;
  await user.save();

  meeting = await Meeting.create({
    uploadedBy: user._id,
    organization: organization._id,
    title: "Translation Flow Meeting",
    date: new Date(),
  });

  token = createClerkTestToken({
    clerkUserId: user.clerkUserId,
    email: user.email,
  });
});

describe("MultiLanguageTranscript Correct and Reload Flow (#2282)", () => {
  it("submits correction, persists to database cache, and reloads in-room", async () => {
    // 1. Setup translation cache record for the segment
    await RealtimeTranslationCache.create({
      meeting: meeting._id,
      segmentId: "seg-trans-1",
      sourceLanguage: "en",
      sourceText: "Welcome to our meeting",
      translations: [
        {
          language: "es",
          text: "Bienvenido a nuestra reunion",
          confidence: 0.9,
          provider: "google",
        },
      ],
      context: {
        timestamp: Date.now(),
      },
    });

    // 2. Submit manual correction via POST /api/translation/correct
    const correctRes = await request(app)
      .post("/api/translation/correct")
      .set(authHeader(token))
      .send({
        meetingId: meeting._id.toString(),
        segmentId: "seg-trans-1",
        language: "es",
        correctedText: "Bienvenidos a nuestra reunión.",
      });

    expect(correctRes.status).toBe(200);
    expect(correctRes.body.message).toBe("Correction submitted");

    // 3. Reload cache via GET /api/translation/cache/:meetingId
    const reloadRes = await request(app)
      .get(`/api/translation/cache/${meeting._id}`)
      .set(authHeader(token));

    expect(reloadRes.status).toBe(200);
    expect(reloadRes.body.translations.length).toBe(1);

    const segment = reloadRes.body.translations[0];
    expect(segment.segmentId).toBe("seg-trans-1");

    const esTranslation = segment.translations.find((t) => t.language === "es");
    expect(esTranslation.text).toBe("Bienvenidos a nuestra reunión.");
    expect(esTranslation.provider).toBe("manual");
  });
});
