import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Routes ---
import PublicRoutes from "./routes/PublicRoutes.jsx";
import ProtectedRoutes from "./routes/ProtectedRoutes.jsx";

import Home from "./pages/Home.jsx"; // 👈 Fallback page

import Navbar from "./components/Navbar";
import ScrollNavigator from "./components/ScrollNavigator";
import CustomCursor from "./components/CustomCursor.jsx";

// --- Components ---
import Footer from "./components/Footer.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const App = () => {
  const location = useLocation();

  const hideFooterRoutes = ["/login"];
  const shouldShowFooter = !hideFooterRoutes.includes(location.pathname);

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
        {/* Toast Notifications */}
        <ToastContainer position="top-right" autoClose={3000} theme="colored" />

        {/* tabIndex="-1" allows the element to receive programmatic focus from
            the skip link without appearing in the natural Tab order */}
        <main id="main-content" tabIndex={-1} className="outline-none">
          <Routes>
            {PublicRoutes}
            {ProtectedRoutes}
            {/* ✅ Fallback route — send unknown routes to Home */}
            <Route path="*" element={<Home />} />
          </Routes>
        </main>

        {/* Floating Section Controller overlay */}
        {shouldShowScrollNavigator && <ScrollNavigator />}

        {/* Global Footer */}
        {shouldShowFooter && <Footer />}

        <CustomCursor />
      </ErrorBoundary>
    </div>
  );
};

export default App;
