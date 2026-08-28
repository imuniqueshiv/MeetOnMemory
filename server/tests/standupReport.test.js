import {
  categorizeStandup,
  renderStandupMarkdown,
} from "../utils/standupReport.js";

const NOW = new Date("2025-06-10T12:00:00.000Z");

describe("categorizeStandup (Issue #2426)", () => {
  it("sorts items into done / inProgress / blockers and skips cancelled", () => {
    const out = categorizeStandup(
      [
        {
          text: "Ship feature",
          status: "completed",
          completedAt: "2025-06-10T09:00:00Z",
        },
        { text: "Write tests", status: "in-progress" },
        { text: "Old task", status: "open", dueDate: "2025-06-01T00:00:00Z" }, // past due → blocker
        { text: "Explicitly overdue", status: "overdue" },
        { text: "Dropped", status: "cancelled" },
      ],
      { now: NOW },
    );
    expect(out.done.map((i) => i.text)).toEqual(["Ship feature"]);
    expect(out.inProgress.map((i) => i.text)).toEqual(["Write tests"]);
    expect(out.blockers.map((i) => i.text).sort()).toEqual([
      "Explicitly overdue",
      "Old task",
    ]);
    expect(out.counts).toEqual({ done: 1, inProgress: 1, blockers: 2 });
  });

  it("only counts done items completed within the window", () => {
    const items = [
      {
        text: "Recent",
        status: "resolved",
        completedAt: "2025-06-10T08:00:00Z",
      },
      {
        text: "Stale",
        status: "completed",
        completedAt: "2025-06-01T08:00:00Z",
      },
    ];
    const since = new Date("2025-06-09T00:00:00Z");
    const out = categorizeStandup(items, { now: NOW, since });
    expect(out.done.map((i) => i.text)).toEqual(["Recent"]);
  });

  it("is defensive against non-array input", () => {
    expect(categorizeStandup(null, { now: NOW }).counts).toEqual({
      done: 0,
      inProgress: 0,
      blockers: 0,
    });
  });
});

describe("renderStandupMarkdown", () => {
  it("renders Yesterday / Today / Blockers sections", () => {
    const md = renderStandupMarkdown({
      done: [{ text: "Did A" }],
      inProgress: [{ text: "Doing B" }],
      blockers: [],
    });
    expect(md).toContain("**Yesterday**");
    expect(md).toContain("- Did A");
    expect(md).toContain("**Today**");
    expect(md).toContain("- Doing B");
    expect(md).toContain("**Blockers**");
    expect(md).toContain("- _None_");
  });
});
