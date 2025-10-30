// client/src/context/AppContext.jsx
import axios from "axios";
import React, { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

export const AppContent = createContext();

export const AppContextProvider = (props) => {
  axios.defaults.withCredentials = true;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Restore userData from localStorage on startup
  useEffect(() => {
    const stored = localStorage.getItem("userData");
    if (stored && stored !== "undefined" && stored !== "null") {
      try {
        setUserData(JSON.parse(stored));
        setIsLoggedin(true);
      } catch {
        localStorage.removeItem("userData");
      }
    }
  }, []);

  // ✅ Save userData whenever it changes
  useEffect(() => {
    if (userData) {
      localStorage.setItem("userData", JSON.stringify(userData));
    } else {
      localStorage.removeItem("userData");
    }
  }, [userData]);

  // ✅ Fetch authentication state
  const getAuthState = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/auth/is-auth`);
      if (data.success) {
        setIsLoggedin(true);
        await getUserData();
      } else {
        setIsLoggedin(false);
      }
    } catch (error) {
      if (!isLoggingOut) toast.error("Not Authorized. Please login again.");
      setIsLoggedin(false);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch user data from backend
  const getUserData = async () => {
  try {
    const { data } = await axios.get(`${backendUrl}/api/auth/user-data`, { withCredentials: true });
    if (data.success) {
      setUserData(data.user); // user should include { name, email, role, organization }
      localStorage.setItem("userData", JSON.stringify(data.user));
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    setUserData(null);
  }
};


  useEffect(() => {
    getAuthState();
  }, []);

  // ✅ Logout function
  const logoutUser = async () => {
    setIsLoggingOut(true);
    try {
      await axios.post(`${backendUrl}/api/auth/logout`);
      setUserData(null);
      setIsLoggedin(false);
      localStorage.removeItem("userData");
    } catch (err) {
      toast.error("Failed to logout");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const value = {
    backendUrl,
    isLoggedin,
    setIsLoggedin,
    userData,
    setUserData,
    getUserData,
    setIsLoggingOut,
    logoutUser,
    loading,
  };

  return (
    <AppContent.Provider value={value}>
      {props.children}
    </AppContent.Provider>
  );
};
