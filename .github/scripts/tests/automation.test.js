import test from "node:test";
import assert from "node:assert/strict";
import { processClaim, processUnclaim } from "../claim.js";
import { processIssueCommentGuidance } from "../issue-comments.js";
import { processManualAssignment } from "../assignment.js";
import {
  processPrValidation,
  processPrMerged,
  processFirstContributorWelcome,
} from "../pr.js";
import { processIssueLifecycle } from "../lifecycle.js";
import { processClaimExpiration } from "../expiration.js";
import { autoLabelEcs } from "../label-ecs.js";

function createCore() {
  return { info() {}, warning() {}, error() {} };
}

function createGithub(issueFactory) {
  const state = {
    comments: [],
    assignees: {},
    issues: {},
    openPullRequests: [],
  };
  return {
    state,
    rest: {
      issues: {
        async get({ issue_number }) {
          return {
            data: issueFactory(
              issue_number,
              state,
              state.issues[issue_number] || {},
            ),
          };
        },
        async createComment({ issue_number, body }) {
          state.comments.push({
            issue_number,
            body,
            user: { login: "github-actions[bot]", type: "Bot" },
            created_at: new Date().toISOString(),
          });
          return { data: { id: state.comments.length, body } };
        },
        async updateComment({ comment_id, body }) {
          const idx = comment_id - 1;
          state.comments[idx] = { ...state.comments[idx], body };
          return { data: state.comments[idx] };
        },
        async addAssignees({ issue_number, assignees }) {
          state.assignees[issue_number] = assignees[0];
          return { data: {} };
        },
        async removeAssignees({ issue_number }) {
          delete state.assignees[issue_number];
          return { data: {} };
        },
        async update({ issue_number, body, state: issueState }) {
          state.issues[issue_number] = state.issues[issue_number] || {};
          if (body !== undefined) state.issues[issue_number].body = body;
          if (issueState !== undefined)
            state.issues[issue_number].state = issueState;
          return {
            data: issueFactory(issue_number, state, state.issues[issue_number]),
          };
        },
        async listComments() {
          return { data: state.comments };
        },
        async addLabels() {
          return { data: [] };
        },
      },
      repos: {
        async getCollaboratorPermissionLevel({ username }) {
          const permission =
            username === "maintainer"
              ? "write"
              : username === "owner"
                ? "admin"
                : "read";
          return { data: { permission } };
        },
      },
      pulls: {
        async get({ pull_number }) {
          return { data: { number: pull_number } };
        },
      },
      search: {
        async issuesAndPullRequests() {
          return { data: { items: state.openPullRequests } };
        },
      },
    },
    async paginate(apiMethod, args) {
      if (apiMethod === this.rest.issues.listComments)
        return this.rest.issues.listComments(args).then((r) => r.data);
      if (apiMethod === this.rest.search.issuesAndPullRequests)
        return state.openPullRequests;
      if (args.assignee) {
        return new Array(args.assignee === "busy-user" ? 4 : 1)
          .fill(0)
          .map((_, i) => ({
            number: i + 1,
            title: `Issue ${i + 1}`,
          }));
      }
      return Object.keys(state.assignees).map((n) => ({
        number: Number(n),
        state: "open",
        assignees: [{ login: state.assignees[n] }],
      }));
    },
  };
}

function baseContext(action = "created") {
  return {
    eventName: "issue_comment",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action,
      repository: { archived: false },
      issue: {
        number: 10,
        state: "open",
        locked: false,
        user: { login: "issue-author" },
        author_association: "CONTRIBUTOR",
        assignees: [],
      },
      comment: {
        body: "/claim",
        user: { login: "issue-author", type: "User" },
      },
    },
  };
}

function issueFactory(issueNumber, state, overrides = {}) {
  const assignee = state.assignees[issueNumber];
  return {
    number: issueNumber,
    state: overrides.state || "open",
    locked: false,
    body: overrides.body || "",
    user: overrides.user || { login: "issue-author" },
    author_association: overrides.author_association || "CONTRIBUTOR",
    assignees: overrides.assignees || (assignee ? [{ login: assignee }] : []),
    updated_at: overrides.updated_at || new Date().toISOString(),
    created_at: overrides.created_at || new Date().toISOString(),
  };
}

test("claim: first valid claim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  await processClaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], "issue-author");
});

test("claim: duplicate claim ignored", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "issue-author";
  const context = baseContext();
  await processClaim({ github, context, core: createCore() });
  assert.equal(github.state.comments.length, 0);
});

test("claim: already assigned", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "other-user";
  const context = baseContext();
  await processClaim({ github, context, core: createCore() });
  assert.ok(
    github.state.comments.some((c) => c.body.includes("currently assigned")),
  );
});

test("claim: max 4 active issues", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  context.payload.comment.user.login = "busy-user";
  context.payload.issue.user.login = "busy-user";
  github.state.issues[10] = {
    user: { login: "busy-user" },
    author_association: "CONTRIBUTOR",
  };
  await processClaim({ github, context, core: createCore() });
  assert.ok(
    github.state.comments.some((c) => c.body.includes("limit is **4**")),
  );
});

test("unclaim: unauthorized unclaim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "assigned-user";
  const context = baseContext();
  context.payload.comment.body = "/unclaim";
  context.payload.comment.user.login = "random-user";
  await processUnclaim({ github, context, core: createCore() });
  assert.ok(
    github.state.comments.some((c) => c.body.includes("Only @assigned-user")),
  );
});

test("unclaim: maintainer can unclaim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "assigned-user";
  const context = baseContext();
  context.payload.comment.body = "/unclaim";
  context.payload.comment.user.login = "maintainer";
  await processUnclaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], undefined);
});

test("issue guidance: natural language claim with cooldown", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  context.payload.comment.body = "please assign this to me";
  context.payload.comment.user.login = "contributor";
  await processIssueCommentGuidance({ github, context, core: createCore() });
  await processIssueCommentGuidance({ github, context, core: createCore() });
  const matches = github.state.comments.filter((c) =>
    c.body.toLowerCase().includes("to claim this issue"),
  );
  assert.ok(matches.length <= 1);
});

test("manual assignment: creates welcome once", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "assigned",
      sender: { login: "maintainer", type: "User" },
      issue: { number: 10 },
      assignee: { login: "new-user" },
    },
  };
  await processManualAssignment({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("now assigned")));
});

test("pr validation: missing linked issue", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "opened",
      pull_request: {
        number: 20,
        body: "Small fix",
        user: { login: "contributor" },
        head: { ref: "feature/my-fix" },
        draft: false,
      },
    },
  };
  await processPrValidation({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("Linked issue")));
});

test("pr merged: closes linked issues and preserves assignees", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[15] = "issue-author";
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "closed",
      pull_request: {
        number: 25,
        merged: true,
        body: "Closes #15",
        user: { login: "contributor" },
      },
    },
  };
  await processPrMerged({ github, context, core: createCore() });
  assert.equal(github.state.assignees[15], "issue-author");
});

test("first contributor welcome only once", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "opened",
      pull_request: {
        number: 30,
        author_association: "FIRST_TIME_CONTRIBUTOR",
        user: { login: "first-timer" },
      },
    },
  };
  await processFirstContributorWelcome({ github, context, core: createCore() });
  await processFirstContributorWelcome({ github, context, core: createCore() });
  const comments = github.state.comments.filter((c) => c.issue_number === 30);
  assert.ok(comments.length <= 1);
});

test("issue lifecycle close clears metadata and preserves assignees", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: '<!-- mom:metadata:start -->\n{"assignedAt":"2020-01-01T00:00:00.000Z"}\n<!-- mom:metadata:end -->',
      assignees: [{ login: "assigned-user" }],
    }),
  );
  github.state.assignees[10] = "assigned-user";
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: { action: "closed", issue: { number: 10 } },
  };
  await processIssueLifecycle({ github, context, core: createCore() });
  assert.ok(
    String(github.state.issues[10]?.body || "").includes('"assignedAt": null'),
  );
  assert.equal(github.state.assignees[10], "assigned-user");
});

test("expiration: expires after 48 inactive hours", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[50] = "assigned-user";
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };
  await processClaimExpiration({ github, context, core: createCore() });
  assert.equal(github.state.assignees[50], undefined);
  assert.ok(
    github.state.comments.some((c) => c.body.includes("mom:claim-expired")),
  );
  assert.ok(github.state.comments.some((c) => c.body.includes("48-hour")));
});

test("expiration: does not expire before 48 hours", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{"8":"${oldDate}","16":"${oldDate}","24":"${oldDate}","32":"${oldDate}","40":"${oldDate}"}}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[51] = "assigned-user";
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };
  await processClaimExpiration({ github, context, core: createCore() });
  assert.equal(github.state.assignees[51], "assigned-user");
  assert.equal(
    github.state.comments.filter((c) => c.body.includes("mom:claim-expired"))
      .length,
    0,
  );
});

test("expiration: posts 8-hour interval reminders without duplicates", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{}}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[52] = "assigned-user";
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };

  await processClaimExpiration({ github, context, core: createCore() });
  await processClaimExpiration({ github, context, core: createCore() });

  const reminderComments = github.state.comments.filter((c) =>
    c.body.includes("mom:reminder-8h"),
  );
  assert.equal(reminderComments.length, 1);
  assert.ok(reminderComments[0].body.includes("**8 hours**"));
  assert.equal(github.state.assignees[52], "assigned-user");
});

test("expiration: sends highest due reminder for 8h cadence", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{}}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[53] = "assigned-user";
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };

  await processClaimExpiration({ github, context, core: createCore() });

  assert.equal(
    github.state.comments.filter((c) => c.body.includes("mom:reminder-24h"))
      .length,
    1,
  );
  assert.equal(
    github.state.comments.filter((c) => c.body.includes("mom:reminder-8h"))
      .length,
    0,
  );
  assert.equal(
    github.state.comments.filter((c) => c.body.includes("mom:reminder-16h"))
      .length,
    0,
  );
  assert.equal(github.state.assignees[53], "assigned-user");
});

test("autoLabelEcs: labels contributor-created issue with ECSoC26", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const labelsAdded = [];
  const github = {
    rest: {
      issues: {
        async addLabels({ owner, repo, issue_number, labels }) {
          labelsAdded.push({ issue_number, labels });
          return { data: labels };
        },
        async update({ issue_number, body }) {
          return {
            data: {
              number: issue_number,
              body,
              user: { login: "contributor" },
              author_association: "NONE",
              created_at: new Date().toISOString(),
            },
          };
        },
      },
    },
  };
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      issue: {
        number: 42,
        user: { login: "contributor" },
        author_association: "NONE",
        labels: [],
        body: "",
        created_at: new Date().toISOString(),
      },
    },
  };
  const core = {
    info() {},
    warning() {},
    error() {},
    setFailed(msg) {
      assert.fail(`Should not call setFailed: ${msg}`);
    },
  };

  await autoLabelEcs({ github, context, core });
  assert.equal(labelsAdded.length, 1);
  assert.equal(labelsAdded[0].issue_number, 42);
  assert.deepEqual(labelsAdded[0].labels, ["ECSoC26"]);
});

test("autoLabelEcs: skips auto-labeling if author is a maintainer", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const labelsAdded = [];
  const github = {
    rest: {
      issues: {
        async addLabels({ owner, repo, issue_number, labels }) {
          labelsAdded.push({ issue_number, labels });
          return { data: labels };
        },
      },
    },
  };
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      issue: {
        number: 43,
        user: { login: "maintainer" },
        author_association: "OWNER",
        labels: [],
      },
    },
  };
  const core = {
    info() {},
    warning() {},
    setFailed(msg) {
      assert.fail(`Should not call setFailed: ${msg}`);
    },
  };

  await autoLabelEcs({ github, context, core });
  assert.equal(labelsAdded.length, 0);
});

test("autoLabelEcs: skips auto-labeling if label is already present", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const labelsAdded = [];
  const github = {
    rest: {
      issues: {
        async addLabels({ owner, repo, issue_number, labels }) {
          labelsAdded.push({ issue_number, labels });
          return { data: labels };
        },
        async update() {
          return { data: {} };
        },
      },
    },
  };
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      issue: {
        number: 44,
        user: { login: "contributor" },
        author_association: "NONE",
        labels: [{ name: "ECSoC26" }],
        body: "",
        created_at: new Date().toISOString(),
      },
    },
  };
  const core = {
    info() {},
    warning() {},
    error() {},
    setFailed(msg) {
      assert.fail(`Should not call setFailed: ${msg}`);
    },
  };

  await autoLabelEcs({ github, context, core });
  assert.equal(labelsAdded.length, 0);
});

test("expiration: open linked PR freezes expiration", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[60] = "assigned-user";
  github.state.openPullRequests = [
    {
      number: 100,
      title: "Fix",
      body: "Closes #60",
      pull_request: {},
      html_url: "https://github.com/org/repo/pull/100",
      updated_at: new Date().toISOString(),
      user: { login: "assigned-user" },
    },
  ];
  await processClaimExpiration({
    github,
    context: {
      eventName: "schedule",
      repo: { owner: "org", repo: "repo" },
      payload: {},
    },
    core: createCore(),
  });
  assert.equal(github.state.assignees[60], "assigned-user");
  assert.equal(
    github.state.comments.filter((c) => c.body.includes("mom:claim-expired"))
      .length,
    0,
  );
});

test("expiration: draft PR also freezes expiration", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[61] = "assigned-user";
  github.state.openPullRequests = [
    {
      number: 101,
      title: "WIP",
      body: "Fixes #61",
      draft: true,
      pull_request: {},
      html_url: "https://github.com/org/repo/pull/101",
      updated_at: new Date().toISOString(),
      user: { login: "assigned-user" },
    },
  ];
  await processClaimExpiration({
    github,
    context: {
      eventName: "schedule",
      repo: { owner: "org", repo: "repo" },
      payload: {},
    },
    core: createCore(),
  });
  assert.equal(github.state.assignees[61], "assigned-user");
});

test("expiration: multiple open PRs freeze when any is open", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[62] = "assigned-user";
  github.state.openPullRequests = [
    {
      number: 102,
      body: "Refs #62",
      pull_request: {},
      html_url: "https://github.com/org/repo/pull/102",
      updated_at: new Date().toISOString(),
    },
    {
      number: 103,
      body: "Also closes #62",
      pull_request: {},
      html_url: "https://github.com/org/repo/pull/103",
      updated_at: new Date().toISOString(),
    },
  ];
  await processClaimExpiration({
    github,
    context: {
      eventName: "schedule",
      repo: { owner: "org", repo: "repo" },
      payload: {},
    },
    core: createCore(),
  });
  assert.equal(github.state.assignees[62], "assigned-user");
});

test("expiration: closed PR resumes expiration", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[63] = "assigned-user";
  github.state.openPullRequests = [];
  await processClaimExpiration({
    github,
    context: {
      eventName: "schedule",
      repo: { owner: "org", repo: "repo" },
      payload: {},
    },
    core: createCore(),
  });
  assert.equal(github.state.assignees[63], undefined);
});

test("expiration: manual assignment never expires", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","manualAssignment":true,"welcomeSource":"manual"}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[64] = "assigned-user";
  await processClaimExpiration({
    github,
    context: {
      eventName: "schedule",
      repo: { owner: "org", repo: "repo" },
      payload: {},
    },
    core: createCore(),
  });
  assert.equal(github.state.assignees[64], "assigned-user");
  assert.equal(github.state.comments.length, 0);
});

test("expiration: contributor comment refreshes activity", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  const initialBody = `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- mom:metadata:end -->`;
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: state.issues[number]?.body || initialBody,
    }),
  );
  github.state.assignees[65] = "assigned-user";
  github.state.comments.push({
    issue_number: 65,
    body: "still working on this",
    user: { login: "assigned-user", type: "User" },
    created_at: recent,
  });
  await processClaimExpiration({
    github,
    context: {
      eventName: "schedule",
      repo: { owner: "org", repo: "repo" },
      payload: {},
    },
    core: createCore(),
  });
  assert.equal(github.state.assignees[65], "assigned-user");
});

test("claim: author priority blocks others while active", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  context.payload.comment.user.login = "other-contributor";
  github.state.issues[10] = {
    user: { login: "issue-author" },
    author_association: "CONTRIBUTOR",
    created_at: new Date().toISOString(),
  };
  await processClaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], undefined);
  assert.ok(github.state.comments.some((c) => c.body.includes("48-hour")));
});

test("claim: author priority expired allows public reclaim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  context.payload.comment.user.login = "other-contributor";
  const old = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  github.state.issues[10] = {
    user: { login: "issue-author" },
    author_association: "CONTRIBUTOR",
    created_at: old,
    body: `<!-- mom:metadata:start -->\n{"authorPriorityExpiresAt":"${old}"}\n<!-- mom:metadata:end -->`,
  };
  await processClaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], "other-contributor");
});

test("unclaim: assignee cannot release manual assignment", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: '<!-- mom:metadata:start -->\n{"manualAssignment":true,"welcomeSource":"manual"}\n<!-- mom:metadata:end -->',
    }),
  );
  github.state.assignees[10] = "assigned-user";
  const context = baseContext();
  context.payload.comment.body = "/unclaim";
  context.payload.comment.user.login = "assigned-user";
  await processUnclaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], "assigned-user");
  assert.ok(
    github.state.comments.some((c) =>
      c.body.includes("assigned by a maintainer"),
    ),
  );
});

test("unclaim: maintainer can release manual assignment", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: '<!-- mom:metadata:start -->\n{"manualAssignment":true,"welcomeSource":"manual"}\n<!-- mom:metadata:end -->',
    }),
  );
  github.state.assignees[10] = "assigned-user";
  const context = baseContext();
  context.payload.comment.body = "/unclaim";
  context.payload.comment.user.login = "maintainer";
  await processUnclaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], undefined);
});

test("activity: PR synchronize refreshes linked issue", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const { processPrActivityRefresh } = await import("../activity.js");
  const oldDate = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{"8":"${oldDate}"}}\n<!-- mom:metadata:end -->`,
      assignees: [{ login: "assigned-user" }],
    }),
  );
  github.state.assignees[70] = "assigned-user";
  await processPrActivityRefresh({
    github,
    context: {
      eventName: "pull_request_target",
      repo: { owner: "org", repo: "repo" },
      payload: {
        action: "synchronize",
        sender: { login: "assigned-user", type: "User" },
        pull_request: {
          number: 200,
          body: "Closes #70",
          title: "feat",
          updated_at: new Date().toISOString(),
          user: { login: "assigned-user" },
        },
      },
    },
    core: createCore(),
  });
  const body = String(github.state.issues[70]?.body || "");
  assert.ok(body.includes('"remindersSentAt": {}'));
});

test("activity: issue comment from assignee refreshes", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const { processIssueCommentActivity } = await import("../activity.js");
  const oldDate = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{"8":"${oldDate}"}}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[71] = "assigned-user";
  await processIssueCommentActivity({
    github,
    context: {
      eventName: "issue_comment",
      repo: { owner: "org", repo: "repo" },
      payload: {
        action: "created",
        issue: { number: 71 },
        comment: {
          body: "pushed a fix",
          user: { login: "assigned-user", type: "User" },
          created_at: new Date().toISOString(),
        },
      },
    },
    core: createCore(),
  });
  assert.ok(
    String(github.state.issues[71]?.body || "").includes(
      '"remindersSentAt": {}',
    ),
  );
});

test("activity: bot comments do not refresh", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const { processIssueCommentActivity } = await import("../activity.js");
  const oldDate = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{"8":"${oldDate}"}}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[72] = "assigned-user";
  await processIssueCommentActivity({
    github,
    context: {
      eventName: "issue_comment",
      repo: { owner: "org", repo: "repo" },
      payload: {
        action: "created",
        issue: { number: 72 },
        comment: {
          body: "automated note",
          user: { login: "github-actions[bot]", type: "Bot" },
          created_at: new Date().toISOString(),
        },
      },
    },
    core: createCore(),
  });
  assert.equal(github.state.issues[72], undefined);
});

test("metadata: corrupted block falls back to defaults", async () => {
  const { readMetadata } = await import("../metadata.js");
  const meta = readMetadata(
    "<!-- mom:metadata:start -->\n{not-json\n<!-- mom:metadata:end -->",
  );
  assert.equal(meta.assignedAt, null);
  assert.equal(meta.manualAssignment, false);
});

test("metadata: legacy body without new fields remains compatible", async () => {
  const { readMetadata, isManualAssignment } = await import("../metadata.js");
  const meta = readMetadata(
    '<!-- mom:metadata:start -->\n{"assignedAt":"2020-01-01T00:00:00.000Z","welcomeSource":"manual"}\n<!-- mom:metadata:end -->',
  );
  assert.equal(meta.assignedAt, "2020-01-01T00:00:00.000Z");
  assert.equal(meta.manualAssignment, false);
  assert.equal(isManualAssignment(meta), true);
});

test("manual assignment: sets manualAssignment metadata", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "assigned",
      sender: { login: "maintainer", type: "User" },
      issue: { number: 10 },
      assignee: { login: "new-user" },
    },
  };
  await processManualAssignment({ github, context, core: createCore() });
  assert.ok(
    String(github.state.issues[10]?.body || "").includes(
      '"manualAssignment": true',
    ),
  );
});

test("expiration: duplicate workflow run does not duplicate reminders", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- mom:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}","remindersSentAt":{}}\n<!-- mom:metadata:end -->`,
    }),
  );
  github.state.assignees[80] = "assigned-user";
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };
  await processClaimExpiration({ github, context, core: createCore() });
  await processClaimExpiration({ github, context, core: createCore() });
  await processClaimExpiration({ github, context, core: createCore() });
  assert.equal(
    github.state.comments.filter((c) => c.body.includes("mom:reminder-8h"))
      .length,
    1,
  );
});
