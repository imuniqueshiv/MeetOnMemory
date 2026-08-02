import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMeetingDraftKey, useFormDraft } from "../useFormDraft";

const KEY = "meet-on-memory:test-draft";

const makeDraft = (values, savedAt = new Date().toISOString()) => ({
  version: 1,
  savedAt,
  values,
});

describe("buildMeetingDraftKey", () => {
  it("isolates drafts by user, organization, mode, and meeting", () => {
    expect(
      buildMeetingDraftKey({
        userId: "user-1",
        organizationId: "org-1",
        mode: "edit",
        meetingId: "meeting-1",
      }),
    ).toBe("meet-on-memory:meeting-draft:v1:user-1:org-1:edit:meeting-1");
  });

  it("does not create a key without authenticated scope", () => {
    expect(
      buildMeetingDraftKey({ userId: null, organizationId: "org-1" }),
    ).toBeNull();
  });
});

describe("useFormDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
  });

  it("debounces draft writes", () => {
    const { rerender } = renderHook(
      ({ values }) =>
        useFormDraft({
          key: KEY,
          values,
          debounceMs: 500,
        }),
      { initialProps: { values: { title: "Initial" } } },
    );

    rerender({ values: { title: "Updated" } });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(window.localStorage.getItem(KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(JSON.parse(window.localStorage.getItem(KEY)).values).toEqual({
      title: "Updated",
    });
  });

  it("offers a valid stored draft for recovery", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(makeDraft({ title: "Recovered meeting" })),
    );

    const { result } = renderHook(() =>
      useFormDraft({ key: KEY, values: { title: "" } }),
    );

    expect(result.current.recoverableDraft.values.title).toBe(
      "Recovered meeting",
    );
    expect(result.current.status).toBe("recovery-available");
  });

  it("restores and discards drafts through explicit actions", () => {
    const onRestore = vi.fn();
    window.localStorage.setItem(
      KEY,
      JSON.stringify(makeDraft({ title: "Recovered meeting" })),
    );

    const { result } = renderHook(() =>
      useFormDraft({
        key: KEY,
        values: { title: "" },
        onRestore,
      }),
    );

    act(() => result.current.restoreDraft());
    expect(onRestore).toHaveBeenCalledWith({ title: "Recovered meeting" });

    act(() => result.current.discardDraft());
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("removes malformed drafts without crashing", () => {
    window.localStorage.setItem(KEY, "{not-json");

    const { result } = renderHook(() =>
      useFormDraft({ key: KEY, values: { title: "" } }),
    );

    expect(result.current.recoverableDraft).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("removes expired drafts", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(
        makeDraft({ title: "Old meeting" }, "2026-07-20T12:00:00.000Z"),
      ),
    );

    const { result } = renderHook(() =>
      useFormDraft({
        key: KEY,
        values: { title: "" },
        maxAgeMs: 24 * 60 * 60 * 1000,
      }),
    );

    expect(result.current.recoverableDraft).toBeNull();
    expect(result.current.status).toBe("expired");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("does not offer an edit draft older than server data", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(
        makeDraft({ title: "Stale edit" }, "2026-08-01T10:00:00.000Z"),
      ),
    );

    const { result } = renderHook(() =>
      useFormDraft({
        key: KEY,
        values: { title: "Server title" },
        serverUpdatedAt: "2026-08-01T11:00:00.000Z",
      }),
    );

    expect(result.current.recoverableDraft).toBeNull();
    expect(result.current.status).toBe("expired");
  });

  it("clears a stored draft after successful submission", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(makeDraft({ title: "Submitted meeting" })),
    );

    const { result } = renderHook(() =>
      useFormDraft({ key: KEY, values: { title: "Submitted meeting" } }),
    );

    act(() => result.current.clearDraft());
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});
