import ExportService from "../services/ExportService.js";

describe("ExportService", () => {
  describe("generateMeetingMD", () => {
    it("should correctly format a meeting object into a markdown string", () => {
      const mockMeetingData = {
        title: "Test Meeting",
        date: "2026-07-14T10:00:00Z",
        structuredMoM: {
          title: "Quarterly Review",
          date: "2026-07-14T10:00:00Z",
          summary: "Reviewed Q2 performance.",
          attendees: ["Alice", { name: "Bob", role: "Developer" }],
          agenda: ["Sales numbers", "Product roadmap"],
          decisions: ["Launch feature X in Q3"],
          action_items: [
            {
              task: "Update docs",
              owner: "Alice",
              due_date: "2026-07-20",
              status: "Pending",
            },
            {
              task: "Fix | formatting",
              owner: "Bob",
              dueDate: "2026-07-21",
              status: "In Progress",
            }
          ],
          keywords: ["Q2", "Review"],
        },
      };

      const expectedDate = new Date(mockMeetingData.date).toLocaleDateString();

      const expectedMD = `# Minutes of Meeting

**Title:** Quarterly Review
**Date:** ${expectedDate}

## Summary
Reviewed Q2 performance.

## Attendees
- Alice 
- Bob (Developer)

## Agenda
- Sales numbers
- Product roadmap

## Decisions
- Launch feature X in Q3

## Action Items
| Task | Owner | Due Date | Status |
|---|---|---|---|
| Update docs | Alice | 2026-07-20 | Pending |
| Fix \\| formatting | Bob | 2026-07-21 | In Progress |

## Keywords
Q2, Review
`;

      const result = ExportService.generateMeetingMD(mockMeetingData);
      expect(result).toBe(expectedMD);
    });

    it("should throw an error if no meeting data is provided", () => {
      expect(() => ExportService.generateMeetingMD(null)).toThrow("Invalid meeting data provided for MD generation");
    });
  });
});
