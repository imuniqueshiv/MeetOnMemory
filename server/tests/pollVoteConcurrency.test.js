/**
 * Issue #1072 — concurrent poll votes were silently lost.
 *
 * `castVote` loaded the poll, rebuilt `options[].votes` in memory and saved the
 * whole array back. The filter step reassigns the array, so Mongoose emitted a
 * `$set` of the entire array as it looked at *read* time — no `$push`, no
 * version guard, no unique index. Two voters in the same event-loop window
 * therefore overwrote each other, both received a 200, and both clients
 * rendered their own vote as recorded. The discrepancy only showed up to
 * whoever read the tally afterwards.
 *
 * Polls run during live meetings, where a room votes on a countdown — the
 * access pattern the old implementation could not survive.
 *
 * The headline test fires N simultaneous votes and asserts the total is N.
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import Poll from "../models/pollModel.js";
import User from "../models/userModel.js";
import { castVote } from "../controllers/pollController.js";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

const ORG = new mongoose.Types.ObjectId();
const OTHER_ORG = new mongoose.Types.ObjectId();
const MEETING = new mongoose.Types.ObjectId();
const CREATOR = new mongoose.Types.ObjectId();

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

const makeReq = (pollId, userId, optionIds, organization = ORG, io = null) => ({
  params: { id: String(pollId) },
  body: { optionIds },
  user: { id: userId, _id: userId, organization, role: "member" },
  app: { get: jest.fn(() => io) },
});

const seedPoll = (overrides = {}) =>
  Poll.create({
    meeting: MEETING,
    organization: ORG,
    createdBy: CREATOR,
    question: "Ship on Friday?",
    options: [
      { text: "Yes", votes: [] },
      { text: "No", votes: [] },
      { text: "Abstain", votes: [] },
    ],
    ...overrides,
  });

const tallyOf = (poll) => poll.options.map((o) => o.votes.length);
const totalVotes = (poll) =>
  poll.options.reduce((sum, o) => sum + o.votes.length, 0);

describe("castVote concurrency (#1072)", () => {
  it("keeps every vote when two members vote simultaneously", async () => {
    const poll = await seedPoll();
    const [optYes, optNo] = poll.options.map((o) => o._id.toString());

    const alice = new mongoose.Types.ObjectId();
    const bob = new mongoose.Types.ObjectId();

    await Promise.all([
      castVote(makeReq(poll._id, alice, [optYes]), makeRes()),
      castVote(makeReq(poll._id, bob, [optNo]), makeRes()),
    ]);

    const stored = await Poll.findById(poll._id);
    // Under the old read-modify-write this came back [0, 1] or [1, 0].
    expect(tallyOf(stored)).toEqual([1, 1, 0]);
  });

  it("records all 25 votes when a room votes at once", async () => {
    const poll = await seedPoll();
    const optionIds = poll.options.map((o) => o._id.toString());

    const voters = Array.from(
      { length: 25 },
      () => new mongoose.Types.ObjectId(),
    );

    await Promise.all(
      voters.map((voter, i) =>
        castVote(makeReq(poll._id, voter, [optionIds[i % 3]]), makeRes()),
      ),
    );

    const stored = await Poll.findById(poll._id);
    expect(totalVotes(stored)).toBe(25);

    // And every voter appears exactly once across the whole poll.
    const seen = stored.options.flatMap((o) => o.votes.map(String));
    expect(new Set(seen).size).toBe(25);
  });

  it("lets a voter change their mind under concurrency without duplicating", async () => {
    const poll = await seedPoll();
    const [optYes, optNo] = poll.options.map((o) => o._id.toString());

    const alice = new mongoose.Types.ObjectId();
    const others = Array.from(
      { length: 10 },
      () => new mongoose.Types.ObjectId(),
    );

    await Promise.all([
      castVote(makeReq(poll._id, alice, [optYes]), makeRes()),
      ...others.map((v) => castVote(makeReq(poll._id, v, [optNo]), makeRes())),
    ]);

    await castVote(makeReq(poll._id, alice, [optNo]), makeRes());

    const stored = await Poll.findById(poll._id);
    expect(totalVotes(stored)).toBe(11);
    expect(tallyOf(stored)).toEqual([0, 11, 0]);

    const aliceAppearances = stored.options
      .flatMap((o) => o.votes.map(String))
      .filter((v) => v === alice.toString());
    expect(aliceAppearances).toHaveLength(1);
  });

  it("is idempotent when the same vote is retried concurrently", async () => {
    const poll = await seedPoll();
    const optYes = poll.options[0]._id.toString();
    const alice = new mongoose.Types.ObjectId();

    // A client retry racing the original request.
    await Promise.all([
      castVote(makeReq(poll._id, alice, [optYes]), makeRes()),
      castVote(makeReq(poll._id, alice, [optYes]), makeRes()),
      castVote(makeReq(poll._id, alice, [optYes]), makeRes()),
    ]);

    const stored = await Poll.findById(poll._id);
    expect(totalVotes(stored)).toBe(1);
  });
});

describe("castVote single-choice invariants (#1072)", () => {
  it("replaces the previous vote rather than adding to it", async () => {
    const poll = await seedPoll();
    const [optYes, optNo] = poll.options.map((o) => o._id.toString());
    const alice = new mongoose.Types.ObjectId();

    await castVote(makeReq(poll._id, alice, [optYes]), makeRes());
    await castVote(makeReq(poll._id, alice, [optNo]), makeRes());

    const stored = await Poll.findById(poll._id);
    expect(tallyOf(stored)).toEqual([0, 1, 0]);
  });

  it("never leaves one voter in two options of a single-choice poll", async () => {
    const poll = await seedPoll();
    const [optYes, optNo, optAbstain] = poll.options.map((o) =>
      o._id.toString(),
    );
    const alice = new mongoose.Types.ObjectId();

    await Promise.all([
      castVote(makeReq(poll._id, alice, [optYes]), makeRes()),
      castVote(makeReq(poll._id, alice, [optNo]), makeRes()),
      castVote(makeReq(poll._id, alice, [optAbstain]), makeRes()),
    ]);

    const stored = await Poll.findById(poll._id);
    expect(totalVotes(stored)).toBe(1);
  });

  it("rejects more than one option on a single-choice poll", async () => {
    const poll = await seedPoll();
    const [optYes, optNo] = poll.options.map((o) => o._id.toString());
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [optYes, optNo]),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/single vote/i);
    expect(totalVotes(await Poll.findById(poll._id))).toBe(0);
  });
});

describe("castVote multiple-choice invariants (#1072)", () => {
  it("records a vote in each selected option", async () => {
    const poll = await seedPoll({ pollType: "multiple" });
    const [optYes, optNo] = poll.options.map((o) => o._id.toString());
    const alice = new mongoose.Types.ObjectId();

    await castVote(makeReq(poll._id, alice, [optYes, optNo]), makeRes());

    expect(tallyOf(await Poll.findById(poll._id))).toEqual([1, 1, 0]);
  });

  it("counts a duplicated option id once, not once per repetition", async () => {
    // `{ optionIds: [x, x, x] }` used to push the same voter three times, so
    // voteCount reported one person as three.
    const poll = await seedPoll({ pollType: "multiple" });
    const optYes = poll.options[0]._id.toString();
    const alice = new mongoose.Types.ObjectId();

    const res = makeRes();
    await castVote(makeReq(poll._id, alice, [optYes, optYes, optYes]), res);

    expect(res.statusCode).toBe(200);
    expect(tallyOf(await Poll.findById(poll._id))).toEqual([1, 0, 0]);
  });

  it("narrows a selection on a re-vote instead of accumulating", async () => {
    const poll = await seedPoll({ pollType: "multiple" });
    const [optYes, optNo, optAbstain] = poll.options.map((o) =>
      o._id.toString(),
    );
    const alice = new mongoose.Types.ObjectId();

    await castVote(
      makeReq(poll._id, alice, [optYes, optNo, optAbstain]),
      makeRes(),
    );
    await castVote(makeReq(poll._id, alice, [optNo]), makeRes());

    expect(tallyOf(await Poll.findById(poll._id))).toEqual([0, 1, 0]);
  });
});

describe("castVote validation and guards (#1072)", () => {
  it("rejects an option id that does not belong to the poll", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [
        new mongoose.Types.ObjectId().toString(),
      ]),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid option(s) provided");
  });

  it("rejects a mix of valid and unknown option ids", async () => {
    // Previously the unknown id was silently dropped and the vote still
    // counted, so a client bug went unnoticed.
    const poll = await seedPoll({ pollType: "multiple" });
    const optYes = poll.options[0]._id.toString();
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [
        optYes,
        new mongoose.Types.ObjectId().toString(),
      ]),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(totalVotes(await Poll.findById(poll._id))).toBe(0);
  });

  it("rejects an empty or non-array optionIds", async () => {
    const poll = await seedPoll();

    for (const optionIds of [[], null, "opt-1", {}]) {
      const res = makeRes();
      await castVote(
        makeReq(poll._id, new mongoose.Types.ObjectId(), optionIds),
        res,
      );
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects a vote on a closed poll", async () => {
    const poll = await seedPoll({ isClosed: true });
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [
        poll.options[0]._id.toString(),
      ]),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Poll is closed");
  });

  it("rejects a vote on an expired poll and closes it", async () => {
    const poll = await seedPoll({ expiresAt: new Date(Date.now() - 60000) });
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [
        poll.options[0]._id.toString(),
      ]),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Poll has expired");
    expect((await Poll.findById(poll._id)).isClosed).toBe(true);
  });

  it("accepts a vote on a poll that has not expired yet", async () => {
    const poll = await seedPoll({ expiresAt: new Date(Date.now() + 600000) });
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [
        poll.options[0]._id.toString(),
      ]),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(totalVotes(await Poll.findById(poll._id))).toBe(1);
  });

  it("rejects a voter from another organization", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await castVote(
      makeReq(
        poll._id,
        new mongoose.Types.ObjectId(),
        [poll.options[0]._id.toString()],
        OTHER_ORG,
      ),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(totalVotes(await Poll.findById(poll._id))).toBe(0);
  });

  it("returns 403, not 500, when the session has no organization", async () => {
    const poll = await seedPoll();
    const res = makeRes();

    await castVote(
      {
        params: { id: poll._id.toString() },
        body: { optionIds: [poll.options[0]._id.toString()] },
        user: { id: new mongoose.Types.ObjectId() },
        app: { get: jest.fn(() => null) },
      },
      res,
    );

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for an unknown poll and 400 for a malformed id", async () => {
    const notFound = makeRes();
    await castVote(
      makeReq(new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), [
        new mongoose.Types.ObjectId().toString(),
      ]),
      notFound,
    );
    expect(notFound.statusCode).toBe(404);

    const malformed = makeRes();
    await castVote(
      makeReq("nope", new mongoose.Types.ObjectId(), ["opt"]),
      malformed,
    );
    expect(malformed.statusCode).toBe(400);
  });
});

describe("castVote response and broadcast (#1072)", () => {
  it("returns the committed document, not a local snapshot", async () => {
    // A real User document, because `.populate("options.votes")` silently drops
    // ids that do not resolve — the response would show an empty tally for a
    // synthetic voter regardless of what was stored.
    const voter = await User.create({
      name: "Voter",
      email: `voter-${new mongoose.Types.ObjectId()}@example.com`,
      password: "hashedpw123",
    });

    const poll = await seedPoll();
    const optYes = poll.options[0]._id.toString();
    const res = makeRes();

    await castVote(makeReq(poll._id, voter._id, [optYes]), res);

    expect(res.statusCode).toBe(200);
    const stored = await Poll.findById(poll._id);
    expect(res.body.options.map((o) => o.votes.length)).toEqual(
      tallyOf(stored),
    );
    expect(tallyOf(stored)).toEqual([1, 0, 0]);
  });

  it("broadcasts poll:vote to the meeting room", async () => {
    const poll = await seedPoll();
    const emitted = [];
    const io = {
      to: jest.fn((room) => ({
        emit: jest.fn((event, payload) =>
          emitted.push({ room, event, payload }),
        ),
      })),
    };

    await castVote(
      makeReq(
        poll._id,
        new mongoose.Types.ObjectId(),
        [poll.options[0]._id.toString()],
        ORG,
        io,
      ),
      makeRes(),
    );

    expect(emitted).toHaveLength(1);
    expect(emitted[0].room).toBe(MEETING.toString());
    expect(emitted[0].event).toBe("poll:vote");
  });

  it("hides voter identities on an anonymous poll but keeps the count", async () => {
    const poll = await seedPoll({ isAnonymous: true });
    const res = makeRes();

    await castVote(
      makeReq(poll._id, new mongoose.Types.ObjectId(), [
        poll.options[0]._id.toString(),
      ]),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.options[0].votes).toEqual([]);
    expect(res.body.options[0].voteCount).toBe(1);
  });

  it("does not emit when the vote is rejected", async () => {
    const poll = await seedPoll({ isClosed: true });
    const emitted = [];
    const io = {
      to: jest.fn(() => ({ emit: jest.fn((e, p) => emitted.push({ e, p })) })),
    };

    await castVote(
      makeReq(
        poll._id,
        new mongoose.Types.ObjectId(),
        [poll.options[0]._id.toString()],
        ORG,
        io,
      ),
      makeRes(),
    );

    expect(emitted).toHaveLength(0);
  });
});
