import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// --- FIX: Using relative path from component folder ---
import { AppContent } from '../context/AppContext.jsx';

const ProtectedRoute = ({ children }) => {
  // Get user status and data from your global context
  const { isLoggedin, userData, isLoading } = useContext(AppContent);
  const location = useLocation();

  // 1. Wait for user data to be loaded
  // (Assuming your context has an 'isLoading' state)
  if (isLoading) {
    // You can replace this with a full-page loading spinner
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>; 
  }

  // 2. If not logged in at all, redirect to login
  if (!isLoggedin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. User is logged in, now check onboarding status
  // Define the pages that are part of the onboarding flow
  const onboardingPages = [
    '/select-role',
    '/create-organization',
    '/join-organization'
  ];
  // Check if the user is currently on one of those pages
  const isOnboardingPage = onboardingPages.includes(location.pathname);

  // 4. If user is NOT onboarded, and NOT on an onboarding page, force them to '/select-role'
  if (userData && !userData.hasCompletedOnboarding && !isOnboardingPage) {
    return <Navigate to="/select-role" replace />;
  }

  // 5. If user IS onboarded, but tries to visit an onboarding page, force them to Home '/'
  if (userData && userData.hasCompletedOnboarding && isOnboardingPage) {
    return <Navigate to="/" replace />;
  }
  
  // 6. If all checks pass, render the component they asked for
  return children;
};

export default ProtectedRoute;