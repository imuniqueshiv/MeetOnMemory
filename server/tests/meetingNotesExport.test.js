import { renderMeetingNotesMarkdown } from "../utils/meetingNotesExport.js";

describe("renderMeetingNotesMarkdown (Issue #2543)", () => {
  it("renders title, date, summary and action items", () => {
    const md = renderMeetingNotesMarkdown(
      {
        title: "Q3 Planning",
        date: new Date("2026-08-15T09:00:00.000Z"),
        summary: "Agreed on the roadmap.",
      },
      [
        {
          text: "Draft spec",
          owner: "Ada",
          status: "open",
          dueDate: "2026-08-20",
        },
        { text: "Ship it", owner: "Grace", status: "completed" },
      ],
    );

    expect(md).toContain("# Q3 Planning");
    expect(md).toContain("_2026-08-15_");
    expect(md).toContain("## Summary");
    expect(md).toContain("Agreed on the roadmap.");
    expect(md).toContain("- [ ] Draft spec — Ada, open, due 2026-08-20");
    expect(md).toContain("- [x] Ship it — Grace, completed");
  });

  it("falls back gracefully when fields are missing", () => {
    const md = renderMeetingNotesMarkdown({});
    expect(md).toContain("# Untitled Meeting");
    expect(md).toContain("_No summary available._");
    expect(md).toContain("_No action items._");
    // No date line when the meeting has no date.
    expect(md).not.toContain("_20");
  });

  it("omits the transcript unless explicitly requested", () => {
    const meeting = { title: "Sync", transcript: "hello world" };

    expect(renderMeetingNotesMarkdown(meeting, [])).not.toContain(
      "## Transcript",
    );

    const withTranscript = renderMeetingNotesMarkdown(meeting, [], {
      includeTranscript: true,
    });
    expect(withTranscript).toContain("## Transcript");
    expect(withTranscript).toContain("hello world");
  });

  it("tolerates null meeting and non-array action items", () => {
    const md = renderMeetingNotesMarkdown(null, null);
    expect(md).toContain("# Untitled Meeting");
    expect(md).toContain("_No action items._");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("labels an action item with no fields as untitled without a suffix", () => {
    const md = renderMeetingNotesMarkdown({ title: "T" }, [{}]);
    expect(md).toContain("- [ ] (untitled)");
  });
});
