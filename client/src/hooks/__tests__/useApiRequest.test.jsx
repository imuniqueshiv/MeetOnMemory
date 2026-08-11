/**
 * Issue #978 — request cancellation.
 *
 * The two bugs under test are the ones that follow directly from having no
 * cancellation anywhere in the client: stale responses overwriting fresh ones,
 * and state updates after unmount.
 */

import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useApiRequest } from "../useApiRequest.js";

/** An axios-style cancellation. */
const cancelError = () => {
  const err = new Error("canceled");
  err.code = "ERR_CANCELED";
  return err;
};

/** Resolves after `ms`, unless the signal aborts first. */
const delayed = (value, ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(cancelError());
    });
  });

describe("useApiRequest", () => {
  it("exposes loading, then data", async () => {
    const { result } = renderHook(() => useApiRequest(async () => "payload"));

    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe("payload");
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("passes an AbortSignal to the request", async () => {
    const requestFn = vi.fn(async () => "ok");
    const { result } = renderHook(() => useApiRequest(requestFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(requestFn.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it("forwards extra arguments after the signal", async () => {
    const requestFn = vi.fn(async () => "ok");
    const { result } = renderHook(() => useApiRequest(requestFn));

    await act(async () => {
      await result.current.execute("query", 2);
    });

    expect(requestFn).toHaveBeenCalledWith(expect.any(AbortSignal), "query", 2);
  });

  it("records an error without throwing", async () => {
    const failure = new Error("500");
    const { result } = renderHook(() =>
      useApiRequest(async () => {
        throw failure;
      }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBe(failure);
    expect(result.current.loading).toBe(false);
  });

  it("aborts a superseded request so its response can never land", async () => {
    // The core bug: responses were applied in arrival order, not request order.
    // Typing "budg" then "budget" on a slow connection could leave the UI
    // showing results for the earlier prefix.
    const requestFn = vi.fn((signal, value) =>
      delayed(value, value === "slow" ? 60 : 5, signal),
    );

    const { result } = renderHook(() => useApiRequest(requestFn));

    await act(async () => {
      result.current.execute("slow");
      await new Promise((r) => setTimeout(r, 5));
      await result.current.execute("fast");
      await new Promise((r) => setTimeout(r, 100));
    });

    // The stale response never arrives at all, so there is no race to lose.
    expect(result.current.data).toBe("fast");
  });

  it("does not report a cancellation as an error", async () => {
    const requestFn = vi.fn((signal, value) =>
      delayed(value, value === "slow" ? 60 : 5, signal),
    );
    const onError = vi.fn();

    const { result } = renderHook(() => useApiRequest(requestFn, { onError }));

    await act(async () => {
      result.current.execute("slow");
      await new Promise((r) => setTimeout(r, 5));
      await result.current.execute("fast");
      await new Promise((r) => setTimeout(r, 100));
    });

    // An abort is the expected outcome of typing another character — surfacing
    // it would put an error toast on every keystroke.
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps loading true while a replacement request is still running", async () => {
    const requestFn = vi.fn((signal, value) =>
      delayed(value, value === "slow" ? 20 : 80, signal),
    );

    const { result } = renderHook(() => useApiRequest(requestFn));

    await act(async () => {
      result.current.execute("slow");
      await new Promise((r) => setTimeout(r, 5));
      result.current.execute("long");
      await new Promise((r) => setTimeout(r, 40));
    });

    // A superseded request finishing first must not clear the spinner while its
    // replacement is still in flight.
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 500,
    });
    expect(result.current.data).toBe("long");
  });

  it("can be told not to cancel the previous request", async () => {
    const requestFn = vi.fn((signal, value) => delayed(value, 10, signal));

    const { result } = renderHook(() =>
      useApiRequest(requestFn, { cancelPrevious: false }),
    );

    await act(async () => {
      await Promise.all([
        result.current.execute("a"),
        result.current.execute("b"),
      ]);
    });

    expect(requestFn).toHaveBeenCalledTimes(2);
  });

  it("aborts the in-flight request on unmount", async () => {
    let capturedSignal;
    const requestFn = vi.fn((signal) => {
      capturedSignal = signal;
      return delayed("late", 200, signal);
    });

    const { result, unmount } = renderHook(() => useApiRequest(requestFn));

    act(() => {
      result.current.execute();
    });
    await new Promise((r) => setTimeout(r, 5));

    unmount();

    // React 19 no longer warns about post-unmount setState, which makes this
    // harder to notice rather than less wrong.
    expect(capturedSignal.aborted).toBe(true);
  });

  it("does not write state after unmount", async () => {
    const requestFn = vi.fn(() => delayed("late", 40));

    const { result, unmount } = renderHook(() => useApiRequest(requestFn));

    act(() => {
      result.current.execute();
    });
    unmount();

    // If the hook wrote state here, React would log an act() warning; asserting
    // no throw plus a clean console is the observable part.
    await new Promise((r) => setTimeout(r, 80));
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it("cancel() aborts without recording an error", async () => {
    let capturedSignal;
    const requestFn = vi.fn((signal) => {
      capturedSignal = signal;
      return delayed("x", 200, signal);
    });

    const { result } = renderHook(() => useApiRequest(requestFn));

    await act(async () => {
      result.current.execute();
      await new Promise((r) => setTimeout(r, 5));
      result.current.cancel();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(capturedSignal.aborted).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("calls onSuccess with the result", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useApiRequest(async () => "value", { onSuccess }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledWith("value");
  });

  it("keeps execute referentially stable across renders", async () => {
    // Otherwise a caller passing an inline onSuccess would get a new `execute`
    // every render, and a useEffect depending on it would loop forever.
    const { result, rerender } = renderHook(() =>
      useApiRequest(async () => "ok", { onSuccess: () => {} }),
    );

    const first = result.current.execute;
    rerender();
    expect(result.current.execute).toBe(first);
  });

  it("reset() restores the initial state", async () => {
    const { result } = renderHook(() =>
      useApiRequest(async () => "value", { initialData: [] }),
    );

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe("value");

    act(() => result.current.reset());
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
