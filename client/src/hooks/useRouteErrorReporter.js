import { useCallback } from "react";

/**
 * Extension point for route-level error reporting (#2248).
 * Wire a monitoring service here later without changing boundary call sites.
 */
export function reportRouteError(error, errorInfo, context = {}) {
  console.error(
    "[RouteErrorBoundary]",
    context.section || "route",
    error,
    errorInfo,
  );
}

/**
 * Hook so feature code can report non-render failures through the same channel.
 */
export function useRouteErrorReporter(section = "route") {
  return useCallback(
    (error, errorInfo = {}) => {
      reportRouteError(error, errorInfo, { section });
    },
    [section],
  );
}
