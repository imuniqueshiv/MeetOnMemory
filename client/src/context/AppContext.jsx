import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import AppContent from "./AppContent.js";
import { RBACProvider } from "./RBACContext.jsx";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services";
import { getBackendUrl } from "../config/backendConfig.js";

const isClerkConfigured = () =>
  Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim());

const bearerConfig = (authorization) =>
  authorization ? { headers: { Authorization: authorization } } : undefined;

export const AppContextProvider = ({ children }) => {
  const backendUrl = getBackendUrl();

  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearAuthState = useCallback(() => {
    setIsLoggedin(false);
    setUserData(null);
    localStorage.removeItem("userData");
  }, []);

  const getUserData = useCallback(async (requestConfig) => {
    try {
      const { data } = await authApi.getUserData(requestConfig);

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

  /**
   * Probe is-auth + user-data and set Mongo session state.
   * Optional `authorization` (e.g. "Bearer <jwt>") attaches the Clerk token
   * even if the shared token getter was cleared during a re-render race.
   */
  const initializeAuth = useCallback(
    async ({ authorization } = {}) => {
      const requestConfig = bearerConfig(authorization);
      try {
        const { data } = await authApi.getAuthState(requestConfig);
        if (!data.success) {
          clearAuthState();
          return null;
        }

        const user = await getUserData(requestConfig);
        if (!user) {
          clearAuthState();
          return null;
        }

        setIsLoggedin(true);
        return user;
      } catch {
        clearAuthState();
        return null;
      }
    },
    [clearAuthState, getUserData],
  );

  useEffect(() => {
    // ClerkSessionSync owns post-login bootstrap once a Bearer token exists.
    // Racing is-auth/user-data here without a token clears session and trips
    // a login ↔ dashboard redirect loop.
    if (isClerkConfigured()) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await initializeAuth();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initializeAuth]);

  const logoutUser = async () => {
    try {
      try {
        await authApi.logout();
      } catch {
        // Best-effort server acknowledgement
      }
      clearAuthState();
      window.dispatchEvent(
        new CustomEvent("meetonmemory:request-clerk-signout"),
      );
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
    setLoading,
  };

  return (
    <AppContent.Provider value={value}>
      <RBACProvider userRole={userData?.role || null}>{children}</RBACProvider>
    </AppContent.Provider>
  );
};
