/**
 * Issue #1070 — shared-link ownership validation was unreachable.
 *
 * The check lived inside `if (!["Meeting", "Policy"].includes(resourceType))`,
 * i.e. the branch entered only when the type is *invalid*, and that branch then
 * returned 400 a few lines later regardless. Every real request — the ones with
 * `resourceType` of `"Meeting"` or `"Policy"` — fell straight through to link
 * creation with no existence check and no organization check, so any
 * authenticated user could mint a public link for any resource in any
 * organization given only its ObjectId.
 *
 * A second bug hid in the same block: the `resourceType === "Meeting"` arm was
 * unreachable (the enclosing condition already excluded `"Meeting"`), so an
 * unknown type was looked up as a Policy and answered `"<type> not found"` —
 * leaking whether an arbitrary id exists as a Policy — instead of
 * "Invalid resource type".
 *
 * `createLink` had no test coverage at all, which is why the guard shipped
 * inverted.
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import SharedLink from "../models/sharedLinkModel.js";
import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import "../models/userModel.js";
import {
  createLink,
  parseExpirationDate,
  SHAREABLE_RESOURCE_TYPES,
} from "../controllers/sharedLinkController.js";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

const ORG_VICTIM = new mongoose.Types.ObjectId();
const ORG_ATTACKER = new mongoose.Types.ObjectId();

const victimUser = () => ({
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_VICTIM,
  role: "member",
});

const attackerUser = (role = "owner") => ({
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_ATTACKER,
  role,
});

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status: jest.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function (body) {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const makeReq = (body, user) => ({ body, user });

const seedMeeting = (organization = ORG_VICTIM) =>
  Meeting.create({
    title: "Board sync",
    date: new Date("2026-08-01T09:00:00.000Z"),
    organization,
    uploadedBy: new mongoose.Types.ObjectId(),
  });

const seedPolicy = (organization = ORG_VICTIM) =>
  Policy.create({
    name: "Expenses",
    fileUrl: "uploads/policies/expenses.pdf",
    organization,
    uploadedBy: new mongoose.Types.ObjectId(),
  });

describe("createLink resource ownership (#1070)", () => {
  describe("cross-organization sharing", () => {
    it("refuses to share another organization's meeting", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: meeting._id.toString(), resourceType: "Meeting" },
          attackerUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/does not belong to your organization/i);
      expect(await SharedLink.countDocuments({})).toBe(0);
    });

    it("refuses to share another organization's policy", async () => {
      const policy = await seedPolicy(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: policy._id.toString(), resourceType: "Policy" },
          attackerUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(403);
      expect(await SharedLink.countDocuments({})).toBe(0);
    });

    it("is not bypassed by an elevated role in the caller's own organization", async () => {
      // An owner is still an outsider to a resource they don't own.
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: meeting._id.toString(), resourceType: "Meeting" },
          attackerUser("owner"),
        ),
        res,
      );

      expect(res.statusCode).toBe(403);
    });

    it("returns 403, not 500, when the caller has no organization", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: meeting._id.toString(), resourceType: "Meeting" },
          { _id: new mongoose.Types.ObjectId(), role: "member" },
        ),
        res,
      );

      expect(res.statusCode).toBe(403);
      expect(await SharedLink.countDocuments({})).toBe(0);
    });

    it("refuses to create a shared link for a user with insufficient role permissions (#1110)", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const user = {
        _id: new mongoose.Types.ObjectId(),
        organization: ORG_VICTIM,
        role: "guest",
      };
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: meeting._id.toString(), resourceType: "Meeting" },
          user,
        ),
        res,
      );

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Insufficient permissions/i);
    });
  });

  describe("resource existence", () => {
    it("returns 404 for a well-formed id that matches no meeting", async () => {
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: new mongoose.Types.ObjectId().toString(),
            resourceType: "Meeting",
          },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Meeting not found");
      expect(await SharedLink.countDocuments({})).toBe(0);
    });

    it("returns 404 for a well-formed id that matches no policy", async () => {
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: new mongoose.Types.ObjectId().toString(),
            resourceType: "Policy",
          },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Policy not found");
    });

    it("does not create a link for a meeting id passed as a Policy", async () => {
      // The id resolves — as the wrong model. It must not be shareable.
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: meeting._id.toString(), resourceType: "Policy" },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(404);
      expect(await SharedLink.countDocuments({})).toBe(0);
    });
  });

  describe("input validation", () => {
    it("rejects an unknown resource type without querying any model", async () => {
      const meetingSpy = jest.spyOn(Meeting, "findById");
      const policySpy = jest.spyOn(Policy, "findById");
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: new mongoose.Types.ObjectId().toString(),
            resourceType: "Report",
          },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid resource type");
      // The old code queried Policy for an unknown type and answered
      // "Report not found", telling the caller whether the id existed.
      expect(meetingSpy).not.toHaveBeenCalled();
      expect(policySpy).not.toHaveBeenCalled();

      meetingSpy.mockRestore();
      policySpy.mockRestore();
    });

    it("rejects a malformed resource id with 400 rather than a CastError 500", async () => {
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: "not-an-object-id", resourceType: "Meeting" },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid resource ID");
    });

    it("still rejects missing fields", async () => {
      for (const body of [
        {},
        { resourceId: new mongoose.Types.ObjectId().toString() },
        { resourceType: "Meeting" },
      ]) {
        const res = makeRes();
        await createLink(makeReq(body, victimUser()), res);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Missing required fields");
      }
    });

    it("exposes exactly the types the SharedLink model accepts", () => {
      expect([...SHAREABLE_RESOURCE_TYPES].sort()).toEqual([
        "Meeting",
        "Policy",
      ]);
    });
  });

  describe("expiration date handling", () => {
    it("accepts a future date", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const parsed = parseExpirationDate(future);
      expect(parsed.ok).toBe(true);
      expect(parsed.value.toISOString()).toBe(future);
    });

    it("treats an absent value as no expiry", () => {
      for (const raw of [undefined, null, ""]) {
        expect(parseExpirationDate(raw)).toEqual({ ok: true, value: null });
      }
    });

    it("rejects an unparseable date instead of storing Invalid Date", () => {
      const parsed = parseExpirationDate("next tuesday-ish");
      expect(parsed.ok).toBe(false);
      expect(parsed.message).toBe("Invalid expiration date");
    });

    it("rejects a date in the past", () => {
      const parsed = parseExpirationDate(
        new Date(Date.now() - 86400000).toISOString(),
      );
      expect(parsed.ok).toBe(false);
      expect(parsed.message).toMatch(/must be in the future/i);
    });

    it("surfaces a bad expiration date as a 400 from createLink", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: meeting._id.toString(),
            resourceType: "Meeting",
            expirationDate: "whenever",
          },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(await SharedLink.countDocuments({})).toBe(0);
    });
  });

  describe("the legitimate path still works", () => {
    it("creates a link for a meeting in the caller's own organization", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const user = victimUser();
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: meeting._id.toString(), resourceType: "Meeting" },
          user,
        ),
        res,
      );

      expect(res.statusCode).toBe(201);
      expect(res.body.link.hash).toMatch(/^[a-f0-9]{32}$/);

      const stored = await SharedLink.findOne({ hash: res.body.link.hash });
      expect(stored.resourceModel).toBe("Meeting");
      expect(stored.resourceId.toString()).toBe(meeting._id.toString());
      expect(stored.organizationId.toString()).toBe(ORG_VICTIM.toString());
      expect(stored.createdBy.toString()).toBe(user._id.toString());
      expect(stored.active).toBe(true);
    });

    it("creates a link for a policy in the caller's own organization", async () => {
      const policy = await seedPolicy(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          { resourceId: policy._id.toString(), resourceType: "Policy" },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(201);
      expect(
        (await SharedLink.findOne({ hash: res.body.link.hash })).resourceModel,
      ).toBe("Policy");
    });

    it("stores the passcode hashed, never in clear text", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: meeting._id.toString(),
            resourceType: "Meeting",
            passcode: "hunter2",
          },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(201);
      expect(res.body.link.hasPasscode).toBe(true);

      const stored = await SharedLink.findOne({ hash: res.body.link.hash });
      expect(stored.passcode).not.toBe("hunter2");
      expect(stored.passcode.startsWith("$2")).toBe(true);
    });

    it("persists a valid future expiration date", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: meeting._id.toString(),
            resourceType: "Meeting",
            expirationDate: expiresAt.toISOString(),
          },
          victimUser(),
        ),
        res,
      );

      expect(res.statusCode).toBe(201);
      const stored = await SharedLink.findOne({ hash: res.body.link.hash });
      expect(stored.expirationDate.toISOString()).toBe(expiresAt.toISOString());
    });

    it("never returns the passcode hash to the client", async () => {
      const meeting = await seedMeeting(ORG_VICTIM);
      const res = makeRes();

      await createLink(
        makeReq(
          {
            resourceId: meeting._id.toString(),
            resourceType: "Meeting",
            passcode: "hunter2",
          },
          victimUser(),
        ),
        res,
      );

      expect(res.body.link.passcode).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("hunter2");
    });
  });
});
