import { useCallback, useEffect, useRef, useState } from "react";
import { isCancellation } from "../services/httpRetry.js";

// client/src/hooks/useApiRequest.js
//
// Issue #978 — nothing in the client could cancel an in-flight request:
//
//     $ grep -rn "AbortController\|signal" client/src/services/ client/src/hooks/
//     (no matches)
//
// Two bugs follow directly from that.
//
// **Out-of-order responses.** Any filter, search or pagination control fires a
// new request per change without cancelling the previous one, and responses are
// applied in *arrival* order rather than *request* order. Type "budget" into a
// search box on a slow connection and the response for "budg" can land after the
// response for "budget", leaving the UI showing results for a query the user has
// already moved past. This affects MeetingSearch, MeetingFilters,
// TaskFilterPanel, PolicyFilters, SearchFilters and every paginated list.
//
// **State updates after unmount.** Navigate away mid-request and the `.then`
// still runs against an unmounted component. React 19 no longer warns about
// this, which makes it harder to notice rather than less wrong.
//
// This hook fixes both by construction: each new call aborts the previous one,
// and unmount aborts whatever is outstanding.

/**
 * Runs an async request with cancellation, and exposes loading/error/data.
 *
 * The request function receives an `AbortSignal` and is expected to forward it
 * to axios (`apiClient.get(url, { signal })`).
 *
 * @template T
 * @param {(signal: AbortSignal, ...args: any[]) => Promise<T>} requestFn
 * @param {object} [options]
 * @param {boolean} [options.cancelPrevious] abort a superseded request (default true)
 * @param {T} [options.initialData]
 * @param {Function} [options.onSuccess]
 * @param {Function} [options.onError]
 */
export const useApiRequest = (requestFn, options = {}) => {
  const {
    cancelPrevious = true,
    initialData = null,
    onSuccess = null,
    onError = null,
  } = options;

  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const controllerRef = useRef(null);
  const mountedRef = useRef(true);

  // Keep the latest callbacks in refs so `execute` stays referentially stable.
  // Without this, a caller passing an inline `onSuccess` would get a new
  // `execute` every render, and a `useEffect` depending on it would loop.
  const requestRef = useRef(requestFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    requestRef.current = requestFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  /** Aborts whatever is currently in flight, if anything. */
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const execute = useCallback(
    async (...args) => {
      if (cancelPrevious) {
        // Aborting the superseded request is what makes out-of-order responses
        // impossible, rather than merely unlikely: the stale response never
        // arrives at all, so there is no race to lose.
        controllerRef.current?.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const result = await requestRef.current(controller.signal, ...args);

        // A response that arrives after the component unmounted, or after this
        // request was superseded, must not be written to state.
        if (!mountedRef.current || controller.signal.aborted) return undefined;

        setData(result);
        onSuccessRef.current?.(result);
        return result;
      } catch (err) {
        // A cancellation is the expected outcome of superseding or unmounting,
        // not a failure. Surfacing it would put an error toast on every
        // keystroke in a search box.
        if (isCancellation(err)) return undefined;
        if (!mountedRef.current) return undefined;

        setError(err);
        onErrorRef.current?.(err);
        return undefined;
      } finally {
        // Only the *current* request may clear the loading flag. A superseded
        // request finishing after its replacement started would otherwise hide
        // the spinner while the replacement is still running.
        if (mountedRef.current && controllerRef.current === controller) {
          setLoading(false);
          controllerRef.current = null;
        }
      }
    },
    [cancelPrevious],
  );

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  return { data, error, loading, execute, cancel, reset };
};

export default useApiRequest;
