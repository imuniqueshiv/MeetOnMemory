import { normalizeAgendaItems } from "../utils/agendaOrdering.js";

describe("agenda ordering", () => {
  it("normalizes duplicate and missing positions deterministically", () => {
    const result = normalizeAgendaItems([
      { text: "Third", position: 2 },
      { text: "First", position: 0 },
      { text: "Second A", position: 1 },
      { text: "Second B", position: 1 },
      { text: "Legacy item" },
    ]);

    expect(result.map((item) => item.text)).toEqual([
      "First",
      "Second A",
      "Second B",
      "Third",
      "Legacy item",
    ]);
    expect(result.map((item) => item.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("drops empty agenda items and supports legacy title fields", () => {
    const result = normalizeAgendaItems([
      { title: "Legacy title" },
      { text: "   " },
      null,
    ]);

    expect(result).toEqual([
      expect.objectContaining({ text: "Legacy title", position: 0 }),
    ]);
  });
});
