import React from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // ✅ Don’t forget CSS import

// --- Public Pages ---
import Login from "./pages/Login.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

// --- Protected Pages ---
import Home from "./pages/Home.jsx";
import MeetingListPage from "./pages/MeetingListPage.jsx";
import SelectRolePage from "./pages/SelectRolePage.jsx";
import CreateOrganizationPage from "./pages/CreateOrganizationPage.jsx";
// import JoinOrganizationPage from "./pages/JoinOrganizationPage.jsx"; // (future feature)
import Dashboard from "./pages/Dashboard.jsx";



// --- Components ---
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const App = () => {
  return (
    <>
      {/* Toast notifications (top-right by default) */}
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      {/* === Application Routes === */}
      <Routes>
        {/* === Public Routes === */}
        <Route path="/login" element={<Login />} />
        <Route path="/email-verify" element={<EmailVerify />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* === Protected Routes (require login) === */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/meetings"
          element={
            <ProtectedRoute>
              <MeetingListPage />
            </ProtectedRoute>
          }
        />

        {/* === Onboarding Routes === */}
        <Route
          path="/select-role"
          element={
            <ProtectedRoute>
              <SelectRolePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-organization"
          element={
            <ProtectedRoute>
              <CreateOrganizationPage />
            </ProtectedRoute>
          }
        />


        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />


        {/* Future addition
        <Route
          path="/join-organization"
          element={
            <ProtectedRoute>
              <JoinOrganizationPage />
            </ProtectedRoute>
          }
        /> */}
      </Routes>
    </>
  );
};

export default App;
