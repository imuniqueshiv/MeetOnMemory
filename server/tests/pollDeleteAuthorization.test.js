/**
 * Issue #1069 — `DELETE /api/polls/:id` returned 500 for everyone.
 *
 * `deletePoll` read `poll.organization` one statement above
 * `const poll = await Poll.findById(...)`. Reading a `const` inside its
 * temporal dead zone throws `ReferenceError: Cannot access 'poll' before
 * initialization`; the handler's catch block reported that as a generic
 * "Server Error", so the endpoint was unusable and looked like an outage.
 *
 * There was no test for `deletePoll` at all, which is why the reordering that
 * introduced it went green. These suites cover the whole authorization matrix
 * for both mutating handlers so the guards can't be reordered silently again.
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import Poll from "../models/pollModel.js";
// Registers the "User" schema that closePoll's `.populate("createdBy")` and
// `.populate("options.votes")` resolve against.
import "../models/userModel.js";
import { closePoll, deletePoll } from "../controllers/pollController.js";

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();
const MEETING = new mongoose.Types.ObjectId();

const CREATOR = new mongoose.Types.ObjectId();
const OTHER_MEMBER = new mongoose.Types.ObjectId();
const ADMIN = new mongoose.Types.ObjectId();
const OUTSIDER = new mongoose.Types.ObjectId();

// Connect directly to the in-memory server from tests/setup.js. Importing the
// app to get a connection would drag in the Pinecone/transformers module graph
// for no benefit here.
beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
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

/** Captures socket emissions so the broadcast can be asserted on. */
const makeReq = (id, user, io = null) => ({
  params: { id },
  user,
  app: { get: jest.fn(() => io) },
});

const makeIo = () => {
  const emitted = [];
  return {
    emitted,
    to: jest.fn((room) => ({
      emit: jest.fn((event, payload) => emitted.push({ room, event, payload })),
    })),
  };
};

const session = (id, organization, role = "member") => ({
  id,
  _id: id,
  organization,
  role,
});

const seedPoll = async (overrides = {}) =>
  Poll.create({
    meeting: MEETING,
    organization: ORG_A,
    createdBy: CREATOR,
    question: "Ship on Friday?",
    options: [
      { text: "Yes", votes: [] },
      { text: "No", votes: [] },
    ],
    ...overrides,
  });

describe("deletePoll authorization (#1069)", () => {
  it("deletes the poll for its creator instead of throwing a 500", async () => {
    const poll = await seedPoll();
    const io = makeIo();
    const req = makeReq(poll._id.toString(), session(CREATOR, ORG_A), io);
    const res = makeRes();

    await deletePoll(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: "Poll deleted successfully",
      id: poll._id.toString(),
    });
    expect(await Poll.findById(poll._id)).toBeNull();
  });

  it("does not report a ReferenceError to the client", async () => {
    // The exact regression: the handler used to answer 500 with
    // "Cannot access 'poll' before initialization" for a perfectly valid call.
    const poll = await seedPoll();
    const res = makeRes();

    await deletePoll(
      makeReq(poll._id.toString(), session(CREATOR, ORG_A)),
      res,
    );

    expect(res.statusCode).not.toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/before initialization/);
  });

  it("broadcasts poll:deleted to the meeting room", async () => {
    const poll = await seedPoll();
    const io = makeIo();

    await deletePoll(
      makeReq(poll._id.toString(), session(CREATOR, ORG_A), io),
      makeRes(),
    );

    expect(io.emitted).toHaveLength(1);
    expect(io.emitted[0]).toEqual({
      room: MEETING.toString(),
      event: "poll:deleted",
      payload: { id: poll._id.toString() },
    });
  });

  it("still responds 200 when Socket.IO is not configured", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await deletePoll(
      makeReq(poll._id.toString(), session(CREATOR, ORG_A), null),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(await Poll.findById(poll._id)).toBeNull();
  });

  it("lets an organization admin delete someone else's poll", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await deletePoll(
      makeReq(poll._id.toString(), session(ADMIN, ORG_A, "admin")),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(await Poll.findById(poll._id)).toBeNull();
  });

  it("lets an organization owner delete someone else's poll", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await deletePoll(
      makeReq(poll._id.toString(), session(ADMIN, ORG_A, "owner")),
      res,
    );

    expect(res.statusCode).toBe(200);
  });

  it("rejects a member of the same organization who did not create it", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await deletePoll(
      makeReq(poll._id.toString(), session(OTHER_MEMBER, ORG_A)),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/creator or admin/i);
    expect(await Poll.findById(poll._id)).not.toBeNull();
  });

  it("rejects a caller from another organization before the creator check", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    // Admin elsewhere is still an outsider here — the org guard must win.
    await deletePoll(
      makeReq(poll._id.toString(), session(OUTSIDER, ORG_B, "admin")),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/Not part of organization/i);
    expect(await Poll.findById(poll._id)).not.toBeNull();
  });

  it("returns 403, not 500, when the session has no organization", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await deletePoll(
      makeReq(poll._id.toString(), { id: OUTSIDER, _id: OUTSIDER }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(await Poll.findById(poll._id)).not.toBeNull();
  });

  it("returns 404 for a well-formed id that matches no poll", async () => {
    const res = makeRes();

    await deletePoll(
      makeReq(new mongoose.Types.ObjectId().toString(), session(ADMIN, ORG_A)),
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Poll not found");
  });

  it("returns 400 for a malformed id without touching the database", async () => {
    const findSpy = jest.spyOn(Poll, "findById");
    const res = makeRes();

    await deletePoll(makeReq("not-an-object-id", session(ADMIN, ORG_A)), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid poll ID");
    expect(findSpy).not.toHaveBeenCalled();
    findSpy.mockRestore();
  });

  it("does not emit poll:deleted when the delete is rejected", async () => {
    const poll = await seedPoll();
    const io = makeIo();

    await deletePoll(
      makeReq(poll._id.toString(), session(OTHER_MEMBER, ORG_A), io),
      makeRes(),
    );

    expect(io.emitted).toHaveLength(0);
  });
});

describe("closePoll authorization (#1069)", () => {
  it("closes the poll for its creator", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await closePoll(makeReq(poll._id.toString(), session(CREATOR, ORG_A)), res);

    expect(res.statusCode).toBe(200);
    expect((await Poll.findById(poll._id)).isClosed).toBe(true);
  });

  it("lets an admin close someone else's poll", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await closePoll(
      makeReq(poll._id.toString(), session(ADMIN, ORG_A, "admin")),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect((await Poll.findById(poll._id)).isClosed).toBe(true);
  });

  it("rejects a non-creator member", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await closePoll(
      makeReq(poll._id.toString(), session(OTHER_MEMBER, ORG_A)),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect((await Poll.findById(poll._id)).isClosed).toBe(false);
  });

  it("rejects a caller from another organization", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await closePoll(
      makeReq(poll._id.toString(), session(OUTSIDER, ORG_B, "admin")),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/Not part of organization/i);
  });

  it("returns 403, not 500, when the session has no organization", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await closePoll(
      makeReq(poll._id.toString(), { id: OUTSIDER, _id: OUTSIDER }),
      res,
    );

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for an unknown poll and 400 for a malformed id", async () => {
    const notFound = makeRes();
    await closePoll(
      makeReq(new mongoose.Types.ObjectId().toString(), session(ADMIN, ORG_A)),
      notFound,
    );
    expect(notFound.statusCode).toBe(404);

    const malformed = makeRes();
    await closePoll(makeReq("nope", session(ADMIN, ORG_A)), malformed);
    expect(malformed.statusCode).toBe(400);
  });

  it("keeps voter identities hidden on an anonymous poll", async () => {
    const poll = await seedPoll({ isAnonymous: true });
    poll.options[0].votes.push(OTHER_MEMBER);
    await poll.save();

    const res = makeRes();
    await closePoll(makeReq(poll._id.toString(), session(CREATOR, ORG_A)), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.options[0].votes).toEqual([]);
    expect(res.body.options[0].voteCount).toBe(1);
  });
});
