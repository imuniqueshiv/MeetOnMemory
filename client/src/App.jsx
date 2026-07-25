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
      <ErrorBoundary>
        {/* Toast Notifications */}
        <ToastContainer position="top-right" autoClose={3000} theme="colored" />

        <Routes>
          {PublicRoutes}
          {ProtectedRoutes}
          {/* ✅ Fallback route — send unknown routes to Home */}
          <Route path="*" element={<Home />} />
        </Routes>

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
