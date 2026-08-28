import React, { lazy, Suspense, useContext } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PublicRoutes from "./routes/PublicRoutes.jsx";
import ProtectedRoutes from "./routes/ProtectedRoutes.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ScrollNavigator from "./components/ScrollNavigator";
import FloatingAssistant from "./components/FloatingAssistant.jsx";
import BadgeNotification from "./components/gamification/BadgeNotification.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import Footer from "./components/Footer.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AppContent from "./context/AppContent.js";

const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const RiskRegister = lazy(() => import("./pages/RiskRegister.jsx"));

const App = () => {
  const location = useLocation();
  const { isLoggedin } = useContext(AppContent);

  const hideFooterRoutes = ["/login", "/signup", "/meeting-room"];
  const shouldShowFooter = !hideFooterRoutes.some(
    (route) =>
      location.pathname === route || location.pathname.startsWith(`${route}/`),
  );

  // Only activate navigation controller panel when exactly on the landing page fold
  const shouldShowScrollNavigator = location.pathname === "/";

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
      {/* Skip Navigation Link — WCAG 2.1 SC 2.4.1 (Bypass Blocks)
          Visually hidden by default; becomes visible on keyboard focus.
          Allows keyboard-only users to skip past the Navbar to main content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-white focus:text-blue-700 focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:ring-2 focus:ring-blue-500 dark:focus:bg-gray-900 dark:focus:text-blue-300"
      >
        Skip to main content
      </a>

      <ErrorBoundary>
        {/* Global Offline/Reconnect Banner */}
        <OfflineBanner />

        {/* Toast Notifications */}
        <ToastContainer position="top-right" autoClose={3000} theme="colored" />

        {/* tabIndex="-1" allows the element to receive programmatic focus from
            the skip link without appearing in the natural Tab order */}
        <main id="main-content" tabIndex={-1} className="outline-none">
          <Suspense
            fallback={
              <div className="min-h-[40vh] flex items-center justify-center text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            }
          >
            <Routes>
              {PublicRoutes}
              {ProtectedRoutes}
              <Route
                path="/risks"
                element={
                  <ProtectedRoute>
                    <RiskRegister />
                  </ProtectedRoute>
                }
              />
              {/* ✅ Fallback route — send unknown routes to NotFound */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        {/* Floating Section Controller overlay */}
        {shouldShowScrollNavigator && <ScrollNavigator />}

        {/* Global AI Assistant floating workspace */}
        {isLoggedin && <FloatingAssistant />}

        {/* Gamification Badge Notifications */}
        {isLoggedin && <BadgeNotification />}

        {/* Global Footer */}
        {shouldShowFooter && <Footer />}
      </ErrorBoundary>
    </div>
  );
};

export default App;
