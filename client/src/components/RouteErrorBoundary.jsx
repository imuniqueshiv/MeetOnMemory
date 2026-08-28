import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { reportRouteError } from "../hooks/useRouteErrorReporter.js";

/**
 * Fallback UI with section reload + go-home recovery actions (#2248).
 */
function RouteErrorFallback({
  section,
  error,
  onReloadSection,
  homePath = "/dashboard",
}) {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4"
      data-testid="route-error-fallback"
      data-section={section}
      role="alert"
    >
      <div className="flex flex-col items-center text-center max-w-md p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
        <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {section ? `${section} unavailable` : "This section unavailable"}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {error?.message || "Something went wrong in this part of the app."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReloadSection}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            data-testid="route-error-reload"
          >
            <RefreshCw className="w-4 h-4" />
            Reload section
          </button>
          <Link
            to={homePath}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="route-error-home"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-route error boundary so one shell crash does not blank the whole SPA (#2248).
 */
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { section, onError } = this.props;
    reportRouteError(error, errorInfo, { section });
    onError?.(error, errorInfo, { section });
  }

  handleReloadSection = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const {
      children,
      section = "Section",
      homePath = "/dashboard",
    } = this.props;

    if (this.state.hasError) {
      return (
        <RouteErrorFallback
          section={section}
          error={this.state.error}
          onReloadSection={this.handleReloadSection}
          homePath={homePath}
        />
      );
    }

    return children;
  }
}

export default RouteErrorBoundary;
