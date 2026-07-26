import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import AppContent from "./AppContent.js";
import { RBACProvider } from "./RBACContext.jsx";
import { useNavigate } from "react-router-dom";
import { authApi, csrfService } from "../services";

export const AppContextProvider = ({ children }) => {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearAuthState = useCallback(() => {
    setIsLoggedin(false);
    setUserData(null);
    localStorage.removeItem("userData");
  }, []);

  const getUserData = useCallback(async () => {
    try {
      const { data } = await authApi.getUserData();

      if (data.success && data.user) {
        setUserData(data.user);
        localStorage.setItem("userData", JSON.stringify(data.user));
        return data.user;
      }

      setUserData(null);
      localStorage.removeItem("userData");
      return null;
    } catch (err) {
      console.error("User data error:", err);
      setUserData(null);
      localStorage.removeItem("userData");
      return null;
    }
  }, []);

  // Single bootstrap path for refresh, login, and registration
  const initializeAuth = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        try {
          await csrfService.fetchToken();
        } catch (csrfErr) {
          console.error("Failed to fetch CSRF token", csrfErr);
          if (!quiet) {
            toast.error(
              "Failed to initialize secure session. Please check your connection and refresh.",
            );
          }
        }

        const { data } = await authApi.getAuthState();
        if (!data.success) {
          clearAuthState();
          return null;
        }

        const user = await getUserData();
        if (!user) {
          clearAuthState();
          return null;
        }

        setIsLoggedin(true);
        return user;
      } catch {
        console.log("User not authenticated");
        clearAuthState();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [clearAuthState, getUserData],
  );

  useEffect(() => {
    initializeAuth({ quiet: true });
  }, [initializeAuth]);

  const logoutUser = async () => {
    try {
      await authApi.logout();
      clearAuthState();
      csrfService.clearToken();

      toast.success("Logged out successfully");
      navigate("/");
    } catch {
      toast.error("Failed to logout");
    }
  };

  const value = {
    backendUrl,
    isLoggedin,
    setIsLoggedin,
    userData,
    setUserData,
    getUserData,
    initializeAuth,
    logoutUser,
    loading,
  };

  return (
    <AppContent.Provider value={value}>
      <RBACProvider userRole={userData?.role || null}>{children}</RBACProvider>
    </AppContent.Provider>
  );
};
