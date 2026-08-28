import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParkingLotBacklogPage from "../ParkingLotBacklogPage.jsx";
import AppContent from "../../context/AppContent";
import { meetingApi, parkingLotApi } from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services", () => ({
  parkingLotApi: {
    getOrganizationParkingLot: vi.fn(),
    updateTopicStatus: vi.fn(),
    assignTopics: vi.fn(),
  },
  meetingApi: {
    getAllMeetings: vi.fn(),
  },
}));

const ITEMS = [
  {
    _id: "item-1",
    topic: "Follow up on vendor contract",
    status: "pending",
    submittedBy: { _id: "user-alice", name: "Alice" },
    sourceMeetingId: { _id: "meet-kickoff", title: "Kickoff" },
    scheduledForMeetingId: null,
  },
  {
    _id: "item-2",
    topic: "Review Q3 budget",
    status: "scheduled",
    submittedBy: { _id: "user-bob", name: "Bob" },
    sourceMeetingId: { _id: "meet-finance", title: "Finance Sync" },
    scheduledForMeetingId: { _id: "meet-planning", title: "Planning" },
  },
];

const MEETINGS_PAYLOAD = {
  data: {
    success: true,
    meetings: [
      { _id: "meet-kickoff", title: "Kickoff" },
      { _id: "meet-finance", title: "Finance Sync" },
      { _id: "meet-planning", title: "Planning" },
    ],
  },
};

const successPayload = (items = ITEMS) => ({
  data: {
    success: true,
    data: { items, total: items.length, page: 1, totalPages: 1 },
  },
});

const selectedUser = {
  _id: "user-1",
  role: "member",
  organization: { _id: "org-selected", name: "Selected Org" },
  organizations: [
    { _id: "org-first", name: "First Org" },
    { _id: "org-selected", name: "Selected Org" },
  ],
};

const renderPage = (userData = selectedUser, { loading = false } = {}) =>
  render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData, loading }}>
        <ParkingLotBacklogPage />
      </AppContent.Provider>
    </MemoryRouter>,
  );

describe("ParkingLotBacklogPage (#2037)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parkingLotApi.getOrganizationParkingLot.mockResolvedValue(successPayload());
    meetingApi.getAllMeetings.mockResolvedValue(MEETINGS_PAYLOAD);
    parkingLotApi.updateTopicStatus.mockResolvedValue({
      data: { success: true, item: { status: "discarded" } },
    });
    parkingLotApi.assignTopics.mockResolvedValue({
      data: {
        success: true,
        items: [
          {
            ...ITEMS[0],
            status: "scheduled",
            scheduledForMeetingId: {
              _id: "meet-planning",
              title: "Planning",
            },
          },
        ],
      },
    });
  });

  it("shows a loading state while parking lot items are fetched", () => {
    parkingLotApi.getOrganizationParkingLot.mockImplementation(
      () => new Promise(() => {}),
    );

    renderPage();

    expect(
      screen.getByLabelText(/loading parking lot backlog/i),
    ).toBeInTheDocument();
    expect(parkingLotApi.getOrganizationParkingLot).toHaveBeenCalledWith(
      "org-selected",
      { limit: 200 },
    );
  });

  it("waits for auth bootstrap before fetching or showing the no-org state", () => {
    renderPage({ _id: "user-1", role: "member" }, { loading: true });

    expect(
      screen.getByLabelText(/loading parking lot backlog/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("parking-lot-no-org")).not.toBeInTheDocument();
    expect(parkingLotApi.getOrganizationParkingLot).not.toHaveBeenCalled();
  });

  it("uses the currently selected organization instead of organizations[0]", async () => {
    renderPage();

    expect(
      await screen.findByTestId("parking-lot-backlog-page"),
    ).toHaveAttribute("data-organization-id", "org-selected");
    expect(parkingLotApi.getOrganizationParkingLot).toHaveBeenCalledWith(
      "org-selected",
      { limit: 200 },
    );
    expect(parkingLotApi.getOrganizationParkingLot).not.toHaveBeenCalledWith(
      "org-first",
      expect.anything(),
    );
  });

  it("uses a string organization id from userData when it is not populated", async () => {
    renderPage({
      ...selectedUser,
      organization: "org-string-9",
    });

    expect(
      await screen.findByTestId("parking-lot-backlog-page"),
    ).toHaveAttribute("data-organization-id", "org-string-9");
    expect(parkingLotApi.getOrganizationParkingLot).toHaveBeenCalledWith(
      "org-string-9",
      { limit: 200 },
    );
  });

  it("shows a join/create organization CTA instead of loading when the user has no org", async () => {
    renderPage({ _id: "user-1", role: "member" });

    expect(await screen.findByTestId("parking-lot-no-org")).toBeInTheDocument();
    expect(screen.getByText(/create organization/i)).toBeInTheDocument();
    expect(screen.getByText(/browse organizations/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/loading parking lot backlog/i),
    ).not.toBeInTheDocument();
    expect(parkingLotApi.getOrganizationParkingLot).not.toHaveBeenCalled();
  });

  it("renders parking lot items after a successful fetch", async () => {
    renderPage();

    expect(
      await screen.findByText("Follow up on vendor contract"),
    ).toBeInTheDocument();
    expect(screen.getByText("Review Q3 budget")).toBeInTheDocument();
  });

  it("shows an empty state when the organization has no parking lot items", async () => {
    parkingLotApi.getOrganizationParkingLot.mockResolvedValue(
      successPayload([]),
    );

    renderPage();

    expect(await screen.findByTestId("parking-lot-empty")).toHaveTextContent(
      /no parking lot items found/i,
    );
  });

  it("shows an error state when the parking lot API fails", async () => {
    parkingLotApi.getOrganizationParkingLot.mockRejectedValue({
      response: {
        data: { message: "Forbidden: Organization membership required" },
      },
    });

    renderPage();

    expect(await screen.findByTestId("parking-lot-error")).toHaveTextContent(
      /organization membership required/i,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retries the parking lot request after an API failure", async () => {
    parkingLotApi.getOrganizationParkingLot
      .mockRejectedValueOnce({
        response: { data: { message: "Server Error" } },
      })
      .mockResolvedValueOnce(successPayload());

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    expect(
      await screen.findByText("Follow up on vendor contract"),
    ).toBeInTheDocument();
    expect(parkingLotApi.getOrganizationParkingLot).toHaveBeenCalledTimes(2);
  });

  it("filters items by status", async () => {
    renderPage();

    expect(
      await screen.findByText("Follow up on vendor contract"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: "pending" },
    });

    expect(
      screen.getByText("Follow up on vendor contract"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Review Q3 budget")).not.toBeInTheDocument();
  });

  it("filters items by assignee", async () => {
    renderPage();

    expect(await screen.findByText("Review Q3 budget")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by assignee/i), {
      target: { value: "user-alice" },
    });

    expect(
      screen.getByText("Follow up on vendor contract"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Review Q3 budget")).not.toBeInTheDocument();
  });

  it("filters items by source meeting", async () => {
    renderPage();

    expect(
      await screen.findByText("Follow up on vendor contract"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by source meeting/i), {
      target: { value: "meet-finance" },
    });

    expect(screen.getByText("Review Q3 budget")).toBeInTheDocument();
    expect(
      screen.queryByText("Follow up on vendor contract"),
    ).not.toBeInTheDocument();
  });

  it("filters items by search text", async () => {
    renderPage();

    expect(await screen.findByText("Review Q3 budget")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search parking lot items/i), {
      target: { value: "vendor" },
    });

    expect(
      screen.getByText("Follow up on vendor contract"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Review Q3 budget")).not.toBeInTheDocument();
  });

  it("updates item status with the existing status API", async () => {
    renderPage();

    const statusSelect = await screen.findByLabelText(
      /update status for follow up on vendor contract/i,
    );
    fireEvent.change(statusSelect, { target: { value: "discarded" } });

    await waitFor(() => {
      expect(parkingLotApi.updateTopicStatus).toHaveBeenCalledWith("item-1", {
        status: "discarded",
      });
    });
  });

  it("updates item assignee with the existing assign API", async () => {
    renderPage();

    const assigneeSelect = await screen.findByLabelText(
      /update assignee for follow up on vendor contract/i,
    );
    fireEvent.change(assigneeSelect, { target: { value: "meet-planning" } });

    await waitFor(() => {
      expect(parkingLotApi.assignTopics).toHaveBeenCalledWith({
        topicIds: ["item-1"],
        meetingId: "meet-planning",
      });
    });
  });

  it("deep-links each item to its source meeting details page", async () => {
    renderPage();

    const sourceLink = await screen.findByRole("link", { name: /kickoff/i });
    expect(sourceLink).toHaveAttribute("href", "/meeting/meet-kickoff");
    expect(screen.getByRole("link", { name: /finance sync/i })).toHaveAttribute(
      "href",
      "/meeting/meet-finance",
    );
  });
});
