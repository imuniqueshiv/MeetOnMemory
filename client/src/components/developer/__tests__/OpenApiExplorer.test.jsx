// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenApiExplorer from "../OpenApiExplorer.jsx";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue("clerk-test-token"),
  }),
}));

vi.mock("../../config/backendConfig.js", () => ({
  getBackendUrl: () => "http://localhost:4000",
}));

const spec = {
  paths: {
    "/api/auth/is-auth": {
      get: {
        tags: ["Auth"],
        summary: "GET /api/auth/is-auth",
      },
    },
    "/api/glossary": {
      post: {
        tags: ["Glossary"],
        summary: "POST /api/glossary",
        requestBody: { content: { "application/json": { schema: {} } } },
      },
    },
  },
};

describe("OpenApiExplorer (#2240)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      }),
    );
  });

  it("renders schema-backed operations", () => {
    render(<OpenApiExplorer spec={spec} />);
    expect(screen.getAllByText("/api/auth/is-auth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/api/glossary").length).toBeGreaterThan(0);
    expect(screen.getByText(/schema-backed operation/i)).toBeInTheDocument();
  });

  it("executes authenticated Try-It requests", async () => {
    render(<OpenApiExplorer spec={spec} />);
    fireEvent.click(screen.getByTestId("openapi-try-it"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4000/api/auth/is-auth",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer clerk-test-token",
          }),
        }),
      );
    });

    expect(await screen.findByText(/Response \(200\)/i)).toBeInTheDocument();
  });
});
