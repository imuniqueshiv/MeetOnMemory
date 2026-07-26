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
          state.comments.push({ issue_number, body });
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
    },
    async paginate(apiMethod, args) {
      if (apiMethod === this.rest.issues.listComments)
        return this.rest.issues.listComments(args).then((r) => r.data);
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
    updated_at: new Date().toISOString(),
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

test("expiration: reminder and expiration paths", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
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

