import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AppContent from "../context/AppContent";
import { useRBAC } from "../hooks/useRBAC.js";
import AccessDenied from "../pages/AccessDenied.jsx";

const ProtectedRoute = ({ children, requiredPermission, resource, action, forbiddenFallback }) => {
  const { isLoggedin, userData, isLoading } = useContext(AppContent);
  const { hasPermission } = useRBAC();
  const location = useLocation();

  // Show loading while fetching user data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // If user not logged in — block access to protected routes
  if (!isLoggedin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Onboarding logic - redirect to Organization Hub
  const onboardingPages = [
    "/organizations",
    "/create-organization",
    "/join-organization",
  ];
  const isOnboardingPage = onboardingPages.includes(location.pathname);

  if (userData && !userData.hasCompletedOnboarding && !isOnboardingPage) {
    return <Navigate to="/organizations" replace />;
  }

  if (userData && userData.hasCompletedOnboarding && isOnboardingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  // RBAC: Check if user has required permission
  if (resource && action) {
    if (!hasPermission(resource, action)) {
      if (forbiddenFallback) {
        return <AccessDenied fullPage={false} />;
      }
      return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }
  } else if (requiredPermission) {
    const permResource = typeof requiredPermission === "object" ? requiredPermission.resource : requiredPermission;
    const permAction = typeof requiredPermission === "object" ? requiredPermission.action : "view";
    if (!hasPermission(permResource, permAction)) {
      if (forbiddenFallback) {
        return <AccessDenied fullPage={false} />;
      }
      return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
