// client/src/components/Navbar.jsx
import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AppContent } from "../context/AppContext.jsx";

const Navbar = () => {
  const navigate = useNavigate();
  const { backendUrl, userData, setUserData } = useContext(AppContent);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  // close on outside click
  useEffect(() => {
    const listener = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(`${backendUrl}/api/auth/logout`, {}, { withCredentials: true });
      setUserData(null);
      // clear local storage if used
      localStorage.removeItem("userData");
      // full refresh to clear cookies & state
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
      // graceful fallback
      window.location.href = "/login";
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img src="/favicon.svg" alt="logo" className="w-8 h-8" />
            <span className="font-semibold text-lg text-gray-800">auth</span>
          </div>

          {/* Right: role text + avatar */}
          <div className="flex items-center gap-4">
            {userData ? (
              <>
                <div className="text-sm text-gray-700 hidden sm:block">
                  {userData.role ?? "member"} {userData.organization?.name ? `| ${userData.organization.name}` : ""}
                </div>

                {/* Avatar + dropdown */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((s) => !s)}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold"
                    aria-expanded={menuOpen}
                    aria-label="Open user menu"
                  >
                    {userData?.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </button>

                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg overflow-hidden"
                      style={{ zIndex: 1000 }}
                    >
                      <button
                        onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        Dashboard
                      </button>

                      <button
                        onClick={() => { setMenuOpen(false); navigate("/profile"); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        Profile
                      </button>

                      {userData?.role === "admin" && (
                        <button
                          onClick={() => { setMenuOpen(false); navigate("/admin-panel"); }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50"
                        >
                          Admin Panel
                        </button>
                      )}

                      <button
                        onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        Settings
                      </button>

                      <div className="border-t" />

                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 rounded-full bg-blue-600 text-white"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
