/**
 * Regression tests for Issue #1157 — unescaped user input compiled into RegExp.
 *
 * The suite is deliberately split in two:
 *
 *   - The `regexUtils` block is pure logic and needs no database.
 *   - The remaining blocks exercise the five call sites against
 *     `mongodb-memory-server`, because the fix for four of them replaces a
 *     regex with a *collated equality query*, and a collation only means
 *     anything to a real server. Asserting against a mock would prove nothing.
 *
 * Confirmed load-bearing: run against `main`'s controllers and services (with
 * only `utils/regexUtils.js` added, since the suite imports it), 16 of these
 * fail — the false-collision cases in tags and glossary, the `SyntaxError`
 * cases, glossary detection of `C++`, and every speaker-mapping case.
 *
 * Per-test isolation comes from the global `afterEach` in `tests/setup.js`,
 * which wipes every collection between tests. The `countDocuments(...)`
 * assertions below are load-bearing for that too: they would fail immediately
 * if an earlier test's tags survived into a later one.
 */

import mongoose from "mongoose";

import {
  escapeRegExp,
  literalRegExp,
  wordBoundaryRegExp,
  caseInsensitiveEquals,
  CASE_INSENSITIVE_COLLATION,
} from "../utils/regexUtils.js";
import { escapeRegExp as reExportedEscape } from "../utils/meetingSoftDelete.js";

import Tag from "../models/tagModel.js";
import GlossaryTerm from "../models/glossaryTermModel.js";
import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";
import ActionItem from "../models/actionItemModel.js";
import userModel from "../models/userModel.js";

import {
  createTag,
  updateTag,
  autocomplete,
} from "../controllers/tagController.js";
import { createTerm } from "../controllers/glossaryController.js";
import glossaryService from "../services/glossaryService.js";
import speakerIdentificationService from "../services/speakerIdentificationService.js";

const ORG_A = new mongoose.Types.ObjectId();
const USER_A = new mongoose.Types.ObjectId();

/** Minimal Express double — captures status/body instead of writing a socket. */
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

/** Runs a controller and resolves with { res, error } — never rejects. */
const invoke = async (handler, req) => {
  const res = mockRes();
  let error = null;
  await handler(req, res, (err) => {
    error = err;
  });
  return { res, error };
};

/**
 * `sendSuccess` spreads its payload into the envelope, so an array payload
 * arrives as `{ success, message, 0: …, 1: … }`. This pulls the rows back out
 * without asserting on that (pre-existing, unrelated) shape.
 */
const payloadRows = (body) =>
  Object.entries(body ?? {})
    .filter(([key]) => /^\d+$/.test(key))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => value);

const asUser = (body = {}, extra = {}) => ({
  body,
  params: {},
  query: {},
  user: { _id: USER_A, organization: ORG_A },
  ...extra,
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

// ───────────────────────────────────────────────────────────────────────────
describe("regexUtils", () => {
  describe("escapeRegExp", () => {
    it("neutralizes every metacharacter it claims to", () => {
      const specials = ".*+?^${}()|[]\\";
      const pattern = new RegExp(`^${escapeRegExp(specials)}$`);
      expect(pattern.test(specials)).toBe(true);
    });

    it("turns a wildcard into a literal", () => {
      expect(new RegExp(`^${escapeRegExp(".*")}$`).test("anything")).toBe(
        false,
      );
      expect(new RegExp(`^${escapeRegExp(".*")}$`).test(".*")).toBe(true);
    });

    it("makes an otherwise-uncompilable input compile", () => {
      expect(() => new RegExp("^C++$")).toThrow(SyntaxError);
      expect(() => new RegExp(`^${escapeRegExp("C++")}$`)).not.toThrow();
    });

    it("coerces non-strings rather than throwing", () => {
      expect(escapeRegExp(undefined)).toBe("");
      expect(escapeRegExp(null)).toBe("null");
      expect(escapeRegExp(42)).toBe("42");
    });

    it("is still exported from meetingSoftDelete for existing importers", () => {
      expect(reExportedEscape).toBe(escapeRegExp);
    });
  });

  describe("literalRegExp", () => {
    it("matches the value and nothing else", () => {
      const re = literalRegExp("Q4.Budget");
      expect(re.test("Q4.Budget")).toBe(true);
      expect(re.test("Q4-Budget")).toBe(false); // `.` no longer matches `-`
    });

    it("is case-insensitive by default", () => {
      expect(literalRegExp("engineering").test("ENGINEERING")).toBe(true);
    });
  });

  describe("wordBoundaryRegExp", () => {
    it("does not match inside a longer word", () => {
      expect(
        "Speaker 10 said".replace(wordBoundaryRegExp("Speaker 1"), "X"),
      ).toBe("Speaker 10 said");
    });

    it("matches a whole-word occurrence", () => {
      expect(
        "Speaker 1 said hi".replace(wordBoundaryRegExp("Speaker 1"), "Ada"),
      ).toBe("Ada said hi");
    });

    it("treats metacharacters literally", () => {
      // The bug in one line: `\b.*\b` used to eat the entire string.
      expect("the whole summary".replace(wordBoundaryRegExp(".*"), "X")).toBe(
        "the whole summary",
      );
    });

    it("matches a label that begins with a non-word character", () => {
      // `\b#1\b` can never match — `\b` needs a word character to bound.
      expect(new RegExp("\\b#1\\b").test("from #1 today")).toBe(false);
      expect("from #1 today".replace(wordBoundaryRegExp("#1"), "Ada")).toBe(
        "from Ada today",
      );
    });

    it("matches a label that ends with a non-word character", () => {
      expect(
        "ask (host) later".replace(wordBoundaryRegExp("(host)"), "Ada"),
      ).toBe("ask Ada later");
    });

    it("still refuses to match a non-word-bounded label mid-token", () => {
      expect("x#1y".replace(wordBoundaryRegExp("#1"), "Ada")).toBe("x#1y");
    });
  });

  describe("caseInsensitiveEquals", () => {
    it("produces a plain equality filter, not a pattern", () => {
      const { filter, collation } = caseInsensitiveEquals("name", ".*");
      expect(filter).toEqual({ name: ".*" });
      expect(collation).toEqual(CASE_INSENSITIVE_COLLATION);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("tag uniqueness (Issue #1157)", () => {
  // Direction matters here: the regex is compiled from the *incoming* name and
  // evaluated against the *stored* names. So a metacharacter in the new name
  // produces a false "already exists" against an unrelated existing tag — it
  // does not, as the issue originally said, let one stored tag block all
  // future creation.
  it("does not falsely collide with an existing tag via `.`", async () => {
    await invoke(createTag, asUser({ name: "Q4-Budget" }));

    // `/^Q4.Budget$/i` matches the stored "Q4-Budget" — 400 against `main`.
    const { res, error } = await invoke(
      createTag,
      asUser({ name: "Q4.Budget" }),
    );

    expect(error).toBeNull();
    expect(res.statusCode).toBe(201);
    expect(await Tag.countDocuments({ organization: ORG_A })).toBe(2);
  });

  it("does not falsely collide via a wildcard name", async () => {
    await invoke(createTag, asUser({ name: "Engineering" }));

    // `/^.*$/i` matches everything, so `.*` could never be stored once any
    // tag existed.
    const { res, error } = await invoke(createTag, asUser({ name: ".*" }));

    expect(error).toBeNull();
    expect(res.statusCode).toBe(201);
    expect(
      await Tag.findOne({ organization: ORG_A, name: ".*" }),
    ).not.toBeNull();
  });

  it("does not falsely collide via a partial wildcard", async () => {
    await invoke(createTag, asUser({ name: "Engineering" }));

    const { res, error } = await invoke(
      createTag,
      asUser({ name: "E.gineering" }),
    );

    expect(error).toBeNull();
    expect(res.statusCode).toBe(201);
  });

  it.each(["C++", "A+", "spend (", "a{2,", "[draft]", "?", "x|y"])(
    "accepts %p as a tag name instead of failing to compile",
    async (name) => {
      const { res, error } = await invoke(createTag, asUser({ name }));
      expect(error).toBeNull();
      expect(res.statusCode).toBe(201);
      expect(await Tag.findOne({ organization: ORG_A, name })).not.toBeNull();
    },
  );

  it("still rejects a genuine case-insensitive duplicate", async () => {
    await invoke(createTag, asUser({ name: "Engineering" }));
    const { error } = await invoke(createTag, asUser({ name: "ENGINEERING" }));

    expect(error).not.toBeNull();
    expect(error.message).toMatch(/already exists/i);
  });

  it("rejects a duplicate whose name contains metacharacters", async () => {
    await invoke(createTag, asUser({ name: "C++" }));
    const { error } = await invoke(createTag, asUser({ name: "c++" }));

    expect(error).not.toBeNull();
    expect(error.message).toMatch(/already exists/i);
  });

  it("applies the same rule on rename", async () => {
    await invoke(createTag, asUser({ name: "Design" }));
    await invoke(createTag, asUser({ name: ".*" }));
    const created = await Tag.findOne({ organization: ORG_A, name: "Design" });

    // Renaming to something new must succeed even though `.*` exists.
    const renamed = await invoke(
      updateTag,
      asUser(
        { name: "Product Design" },
        { params: { id: created._id.toString() } },
      ),
    );

    expect(renamed.error).toBeNull();
    const reloaded = await Tag.findById(created._id);
    expect(reloaded.name).toBe("Product Design");
  });

  it("scopes uniqueness to the organization", async () => {
    const ORG_B = new mongoose.Types.ObjectId();
    await invoke(createTag, asUser({ name: "Shared" }));

    const otherOrg = await invoke(createTag, {
      body: { name: "Shared" },
      params: {},
      query: {},
      user: { _id: new mongoose.Types.ObjectId(), organization: ORG_B },
    });

    expect(otherOrg.error).toBeNull();
    expect(otherOrg.res.statusCode).toBe(201);
  });
});

describe("tag autocomplete", () => {
  it("prefix-matches literally rather than as a pattern", async () => {
    await Tag.create([
      { name: "Budget", organization: ORG_A, createdBy: USER_A },
      { name: "B.dget", organization: ORG_A, createdBy: USER_A },
    ]);

    const { res, error } = await invoke(
      autocomplete,
      asUser({}, { query: { q: "B." } }),
    );

    expect(error).toBeNull();
    expect(payloadRows(res.body).map((t) => t.name)).toEqual(["B.dget"]);
  });

  it("does not throw on a metacharacter query", async () => {
    const { res, error } = await invoke(
      autocomplete,
      asUser({}, { query: { q: "C++" } }),
    );

    expect(error).toBeNull();
    expect(payloadRows(res.body)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("glossary term uniqueness (Issue #1157)", () => {
  const glossaryReq = (body) => ({
    body,
    params: {},
    query: {},
    user: { _id: USER_A, organization: ORG_A },
  });

  it("does not falsely collide with an unrelated stored term", async () => {
    await GlossaryTerm.create({
      organization: ORG_A,
      term: "SLO",
      definition: "objective",
    });

    // `/^S.O$/i` matches the stored "SLO" — 400 "already exists" against `main`.
    const res = mockRes();
    await createTerm(
      glossaryReq({ term: "S.O", definition: "unrelated" }),
      res,
    );

    expect(res.statusCode).toBe(201);
  });

  it("allows a wildcard term to be stored", async () => {
    await GlossaryTerm.create({
      organization: ORG_A,
      term: "SLO",
      definition: "objective",
    });

    const res = mockRes();
    await createTerm(glossaryReq({ term: ".*", definition: "catch-all" }), res);
    expect(res.statusCode).toBe(201);
  });

  it("accepts a term with unbalanced metacharacters", async () => {
    const res = mockRes();
    await createTerm(
      glossaryReq({ term: "C++", definition: "a language" }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.term).toBe("C++");
  });

  it("still rejects a real case-insensitive duplicate", async () => {
    await GlossaryTerm.create({
      organization: ORG_A,
      term: "SLO",
      definition: "objective",
    });

    const res = mockRes();
    await createTerm(glossaryReq({ term: "slo", definition: "again" }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

describe("glossary detection", () => {
  it("finds a term containing metacharacters", async () => {
    await GlossaryTerm.create({
      organization: ORG_A,
      term: "C++",
      definition: "a language",
      approvalStatus: "approved",
    });

    const matches = await glossaryService.detectTerms(
      "We are porting the C++ service.",
      ORG_A,
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].matchedText).toBe("C++");
  });

  it("does not let one term match the entire text", async () => {
    await GlossaryTerm.create({
      organization: ORG_A,
      term: ".*",
      definition: "not a wildcard",
      approvalStatus: "approved",
    });

    const matches = await glossaryService.detectTerms("nothing here", ORG_A);
    expect(matches).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("action item owner resolution (Issue #1157)", () => {
  it("resolves an owner by name without compiling it", async () => {
    const user = await userModel.create({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "not-used-under-clerk",
      organization: ORG_A,
      clerkUserId: "clerk_ada",
    });

    const { processActionItemReminders } =
      await import("../services/actionItemReminderService.js");

    const meeting = await Meeting.create({
      uploadedBy: USER_A,
      organization: ORG_A,
      title: "Planning",
      date: new Date(),
    });

    await ActionItem.create({
      text: "Ship the thing",
      owner: "ada lovelace", // different case — collation must still match
      organization: ORG_A,
      sourceMeetingId: meeting._id,
      status: "open",
      dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const summary = await processActionItemReminders({ organization: ORG_A });
    expect(summary.upcomingCount).toBe(1);

    const { default: Notification } =
      await import("../models/notificationModel.js");
    const notifications = await Notification.find({ user: user._id });
    expect(notifications).toHaveLength(1);
  });

  it("completes promptly on an owner string that is a ReDoS pattern", async () => {
    const { processActionItemReminders } =
      await import("../services/actionItemReminderService.js");

    await userModel.create({
      name: "a".repeat(30),
      email: "long@example.com",
      password: "not-used-under-clerk",
      organization: ORG_A,
      clerkUserId: "clerk_long",
    });

    const meeting = await Meeting.create({
      uploadedBy: USER_A,
      organization: ORG_A,
      title: "Planning",
      date: new Date(),
    });

    await ActionItem.create({
      text: "Poisoned owner",
      owner: `(a+)+${"a".repeat(28)}b`,
      organization: ORG_A,
      sourceMeetingId: meeting._id,
      status: "open",
      dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const startedAt = Date.now();
    await processActionItemReminders({ organization: ORG_A });
    // Against `main` the regex engine backtracks for minutes on this input.
    expect(Date.now() - startedAt).toBeLessThan(5000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("speaker mapping (Issue #1157)", () => {
  const seedMeeting = async (overrides = {}) =>
    Meeting.create({
      uploadedBy: USER_A,
      organization: ORG_A,
      title: "Standup",
      date: new Date(),
      summary: "Speaker 1 opened. Speaker 2 raised the deploy risk.",
      ...overrides,
    });

  // The destructive path needs the label to appear in the summary as a literal
  // substring, because `applyMapping` guards the replace with
  // `summary.includes(originalLabel)`. `"."` clears that guard on essentially
  // every summary — sentences end with periods — and then `/\b.\b/g` matches
  // every single-character word.
  it("does not let a bare `.` shred the summary", async () => {
    const meeting = await seedMeeting();
    const before = meeting.summary;

    await speakerIdentificationService.applyMapping(meeting._id, ".", "Priya");

    const after = await Meeting.findById(meeting._id);
    // Against `main`:
    //   "SpeakerPriyaPriyaPriyaopened. SpeakerPriyaPriyaPriyaraised…"
    expect(after.summary).toBe(before);
  });

  it("does not let a partial wildcard rewrite unrelated words", async () => {
    const meeting = await seedMeeting({
      summary: "Ada opened. Ben raised the deploy risk.",
    });
    const before = meeting.summary;

    // `/\bA.a\b/g` matches "Ada"; the literal "A.a" does not appear.
    await speakerIdentificationService.applyMapping(
      meeting._id,
      "A.a",
      "Priya",
    );

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe(before);
  });

  it("still performs the mapping it is actually for", async () => {
    const meeting = await seedMeeting();

    await speakerIdentificationService.applyMapping(
      meeting._id,
      "Speaker 1",
      "Ada",
    );

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe("Ada opened. Speaker 2 raised the deploy risk.");
  });

  it("does not rewrite a longer label that merely contains the mapped one", async () => {
    const meeting = await seedMeeting({
      summary: "Speaker 10 and Speaker 1 disagreed.",
    });

    await speakerIdentificationService.applyMapping(
      meeting._id,
      "Speaker 1",
      "Ada",
    );

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe("Speaker 10 and Ada disagreed.");
  });

  it("handles a label containing metacharacters instead of throwing", async () => {
    const meeting = await seedMeeting({
      summary: "Speaker 1 (host) chaired the review.",
    });

    await expect(
      speakerIdentificationService.applyMapping(
        meeting._id,
        "Speaker 1 (host)",
        "Ada",
      ),
    ).resolves.not.toThrow();

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe("Ada chaired the review.");
  });

  it("maps a label that starts with a non-word character", async () => {
    const meeting = await seedMeeting({
      summary: "Then #1 asked about scope.",
    });

    await speakerIdentificationService.applyMapping(meeting._id, "#1", "Ada");

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe("Then Ada asked about scope.");
  });

  // Raised in review of #1157: escaping the *pattern* fixes only half of this.
  // `String.prototype.replace` expands `$&`, `` $` ``, `$'` and `$1`…`$9` in
  // the *replacement* string, and `mappedName` is caller-supplied too.
  describe("replacement string is inserted literally", () => {
    it("does not let a `$`` mapped name swallow the summary", async () => {
      const meeting = await seedMeeting();

      await speakerIdentificationService.applyMapping(
        meeting._id,
        "Speaker 1",
        "$`",
      );

      const after = await Meeting.findById(meeting._id);
      // With a string replacement this becomes " opened. Speaker 2 raised…",
      // i.e. the preceding text is duplicated and the label is lost.
      expect(after.summary).toBe(
        "$` opened. Speaker 2 raised the deploy risk.",
      );
    });

    it("does not let a `$'` mapped name duplicate the trailing text", async () => {
      const meeting = await seedMeeting();

      await speakerIdentificationService.applyMapping(
        meeting._id,
        "Speaker 1",
        "A$'B",
      );

      const after = await Meeting.findById(meeting._id);
      expect(after.summary).toBe(
        "A$'B opened. Speaker 2 raised the deploy risk.",
      );
    });

    it("inserts `$&` verbatim rather than re-inserting the match", async () => {
      const meeting = await seedMeeting();

      await speakerIdentificationService.applyMapping(
        meeting._id,
        "Speaker 1",
        "$&",
      );

      const after = await Meeting.findById(meeting._id);
      expect(after.summary).toBe(
        "$& opened. Speaker 2 raised the deploy risk.",
      );
    });

    it("applies the same guard to action item text", async () => {
      const meeting = await seedMeeting();

      await ActionItem.create({
        text: "Speaker 1 to confirm the rollout window",
        owner: "Speaker 1",
        organization: ORG_A,
        sourceMeetingId: meeting._id,
      });

      await speakerIdentificationService.applyMapping(
        meeting._id,
        "Speaker 1",
        "$`",
      );

      const item = await ActionItem.findOne({ sourceMeetingId: meeting._id });
      expect(item.text).toBe("$` to confirm the rollout window");
      expect(item.owner).toBe("$`");
    });

    it("still handles an ordinary name containing a dollar sign", async () => {
      const meeting = await seedMeeting();

      await speakerIdentificationService.applyMapping(
        meeting._id,
        "Speaker 1",
        "A$B Consulting",
      );

      const after = await Meeting.findById(meeting._id);
      expect(after.summary).toBe(
        "A$B Consulting opened. Speaker 2 raised the deploy risk.",
      );
    });
  });

  // Also raised in review: the label is compared against stored values, so it
  // has to be trimmed rather than merely checked for emptiness.
  it("trims a padded label so the mapping still applies", async () => {
    const meeting = await seedMeeting();

    await speakerIdentificationService.applyMapping(
      meeting._id,
      "  Speaker 1  ",
      "Ada",
    );

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe("Ada opened. Speaker 2 raised the deploy risk.");
  });

  it("trims a padded label when rewriting transcript segments", async () => {
    const meeting = await seedMeeting();

    await Transcript.create({
      meeting: meeting._id,
      segments: [
        { speaker: "Speaker 1", text: "Morning", startTime: 0, endTime: 2 },
      ],
    });

    await speakerIdentificationService.applyMapping(
      meeting._id,
      " Speaker 1 ",
      "Ada",
    );

    const transcript = await Transcript.findOne({ meeting: meeting._id });
    expect(transcript.segments[0].speaker).toBe("Ada");
  });

  it("refuses an empty label rather than rewriting the document", async () => {
    const meeting = await seedMeeting();
    const before = meeting.summary;

    await expect(
      speakerIdentificationService.applyMapping(meeting._id, "   ", "Ada"),
    ).rejects.toThrow(/must not be empty/i);

    const after = await Meeting.findById(meeting._id);
    expect(after.summary).toBe(before);
  });

  it("rewrites transcript segments and action items for a real label", async () => {
    const meeting = await seedMeeting();

    await Transcript.create({
      meeting: meeting._id,
      segments: [
        { speaker: "Speaker 1", text: "Morning", startTime: 0, endTime: 2 },
        { speaker: "Speaker 2", text: "Morning", startTime: 2, endTime: 4 },
      ],
    });

    await ActionItem.create({
      text: "Speaker 1 to confirm the rollout window",
      owner: "Speaker 1",
      organization: ORG_A,
      sourceMeetingId: meeting._id,
    });

    await speakerIdentificationService.applyMapping(
      meeting._id,
      "Speaker 1",
      "Ada",
    );

    const transcript = await Transcript.findOne({ meeting: meeting._id });
    expect(transcript.segments.map((s) => s.speaker)).toEqual([
      "Ada",
      "Speaker 2",
    ]);

    const item = await ActionItem.findOne({ sourceMeetingId: meeting._id });
    expect(item.owner).toBe("Ada");
    expect(item.text).toBe("Ada to confirm the rollout window");
  });

  it("leaves action item text untouched when a `.` label is supplied", async () => {
    const meeting = await seedMeeting();

    await ActionItem.create({
      text: "Speaker 1 to confirm the rollout window. Owner: A.",
      owner: "Speaker 1",
      organization: ORG_A,
      sourceMeetingId: meeting._id,
    });

    await speakerIdentificationService.applyMapping(meeting._id, ".", "Priya");

    const item = await ActionItem.findOne({ sourceMeetingId: meeting._id });
    expect(item.text).toBe(
      "Speaker 1 to confirm the rollout window. Owner: A.",
    );
    expect(item.owner).toBe("Speaker 1");
  });
});
