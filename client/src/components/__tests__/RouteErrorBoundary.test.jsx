// @vitest-environment jsdom
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RouteErrorBoundary from "../RouteErrorBoundary.jsx";
import {
  reportRouteError,
  useRouteErrorReporter,
} from "../../hooks/useRouteErrorReporter.js";

const Boom = ({ label = "boom" }) => {
  throw new Error(label);
};

const Safe = ({ text }) => <div>{text}</div>;

describe("RouteErrorBoundary (#2248)", () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("renders children when no error occurs", () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary section="Dashboard">
          <Safe text="Dashboard OK" />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("Dashboard OK")).toBeInTheDocument();
  });

  it("shows fallback with reload section and go home actions", () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary section="Meeting Room">
          <Boom label="Room crashed" />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("route-error-fallback")).toHaveAttribute(
      "data-section",
      "Meeting Room",
    );
    expect(screen.getByText(/Meeting Room unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("Room crashed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reload section/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-error-home")).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("reloads the section without keeping the fallback", () => {
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error("transient");
      return <div>Recovered</div>;
    };

    render(
      <MemoryRouter>
        <RouteErrorBoundary section="Dashboard">
          <Flaky />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("route-error-fallback")).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByTestId("route-error-reload"));
    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("does not unmount a sibling route shell when a child throws", () => {
    render(
      <MemoryRouter initialEntries={["/meeting-room/1"]}>
        <Routes>
          <Route
            path="/meeting-room/:id"
            element={
              <RouteErrorBoundary section="Meeting Room">
                <Boom label="room fail" />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RouteErrorBoundary section="Dashboard">
                <Safe text="Dashboard still mounted" />
              </RouteErrorBoundary>
            }
          />
        </Routes>
        {/* Sibling outside the active route — still in the tree */}
        <RouteErrorBoundary section="Dashboard">
          <Safe text="Sibling shell OK" />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("route-error-fallback")).toBeInTheDocument();
    expect(screen.getByText("Sibling shell OK")).toBeInTheDocument();
    expect(screen.getByText("room fail")).toBeInTheDocument();
  });

  it("invokes onError / reportRouteError when a child throws", () => {
    const onError = vi.fn();
    render(
      <MemoryRouter>
        <RouteErrorBoundary section="Admin" onError={onError}>
          <Boom label="admin fail" />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(onError).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(() =>
      reportRouteError(
        new Error("manual"),
        { componentStack: "" },
        {
          section: "test",
        },
      ),
    ).not.toThrow();
  });

  it("useRouteErrorReporter reports through the shared channel", () => {
    const Probe = () => {
      const report = useRouteErrorReporter("Org Settings");
      return (
        <button type="button" onClick={() => report(new Error("hook report"))}>
          Report
        </button>
      );
    };

    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Report/i }));
    expect(consoleSpy).toHaveBeenCalledWith(
      "[RouteErrorBoundary]",
      "Org Settings",
      expect.any(Error),
      expect.anything(),
    );
  });
});
