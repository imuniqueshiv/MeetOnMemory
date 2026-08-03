import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgendaSection from "../AgendaSection";

const items = [
  { id: "a", text: "Review action items", position: 0 },
  { id: "b", text: "Discuss blockers", position: 1 },
  { id: "c", text: "Plan next sprint", position: 2 },
];

const renderAgenda = (overrides = {}) => {
  const reorderAgendaItem = vi.fn();
  render(
    <AgendaSection
      agendaItems={items}
      newAgenda=""
      setNewAgenda={vi.fn()}
      addAgendaItem={vi.fn()}
      removeAgendaItem={vi.fn()}
      reorderAgendaItem={reorderAgendaItem}
      {...overrides}
    />,
  );
  return { reorderAgendaItem };
};

describe("AgendaSection", () => {
  it("disables invalid first and last moves", () => {
    renderAgenda();
    expect(
      screen.getByRole("button", { name: "Move Review action items up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Plan next sprint down" }),
    ).toBeDisabled();
  });

  it("reorders with accessible move controls and announces the result", () => {
    const { reorderAgendaItem } = renderAgenda();
    fireEvent.click(
      screen.getByRole("button", { name: "Move Discuss blockers up" }),
    );

    expect(reorderAgendaItem).toHaveBeenCalledWith(1, 0);
    expect(
      screen.getByText(/Discuss blockers moved to position 1 of 3/),
    ).toBeTruthy();
  });
});
