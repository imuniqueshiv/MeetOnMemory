// client/src/components/Navbar.jsx
import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";
import {
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  Building2,
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { backendUrl, userData, setIsLoggedin, setUserData } =
    useContext(AppContent);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Unread notifications mock state
  const [unreadCount, setUnreadCount] = useState(3);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Minutes of Meeting Ready",
      description: "AI summary for 'Q3 Sprint Review' is now compiled.",
      time: "10m ago",
      unread: true,
    },
    {
      id: 2,
      title: "New Team Member Joined",
      description: "Sarah Jenkins has linked to the organization.",
      time: "2h ago",
      unread: true,
    },
    {
      id: 3,
      title: "Policy Update Alert",
      description: "The 'Privacy & Security Policy' has been updated.",
      time: "1d ago",
      unread: true,
    },
    {
      id: 4,
      title: "Welcome to MeetOnMemory",
      description:
        "Start recording or uploading meetings to generate summaries.",
      time: "3d ago",
      unread: false,
    },
  ]);

  const menuRef = useRef();
  const mobileMenuRef = useRef();
  const notificationsRef = useRef();

  // Detect scroll for navbar style
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const listener = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        !e.target.closest("button[aria-expanded]")
      ) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  // Close menus on resize / route change
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
        setMobileNotifOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(
        `${backendUrl}/api/auth/logout`,
        {},
        { withCredentials: true },
      );
      setIsLoggedin(false);
      setUserData(null);
      localStorage.removeItem("userData");
      setMenuOpen(false);
      setMobileOpen(false);
      setMobileNotifOpen(false);
      setNotificationsOpen(false);
      toast.success("Logged out successfully");
      navigate("/");
    } catch (err) {
      console.error("Logout failed", err);
      toast.error("Failed to logout. Please try again.");
    }
  };

  const handleNavLinkClick = (href) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      if (location.pathname !== "/") {
        navigate("/" + href);
      } else {
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } else {
      navigate(href);
    }
  };

  const isTabActive = (tabPath) => {
    const currentPath = location.pathname;
    if (tabPath === "/dashboard") {
      return currentPath === "/dashboard";
    }
    if (tabPath === "/meetings") {
      return (
        currentPath.startsWith("/meetings") ||
        currentPath === "/create-meeting" ||
        currentPath === "/upload-meeting" ||
        currentPath === "/summaries" ||
        currentPath === "/reports" ||
        currentPath === "/policies"
      );
    }
    if (tabPath === "/select-role") {
      return (
        currentPath === "/select-role" ||
        currentPath === "/create-organization" ||
        currentPath === "/join-organization"
      );
    }
    if (tabPath === "/ai-search") {
      return currentPath === "/ai-search";
    }
    return currentPath === tabPath;
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  const appLinks = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Meetings", href: "/meetings", icon: Calendar },
    { label: "Organizations", href: "/select-role", icon: Building2 },
    { label: "AI Search", href: "/ai-search", icon: Search },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100/80"
          : "bg-white/80 backdrop-blur-sm border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16">
        {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group focus-visible:outline-none"
            onClick={() => navigate("/")}
            role="link"
            aria-label="MeetOnMemory Home"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/")}
          >
            <div className="flex items-center justify-center">
              {/* Clean Extra Large Native Option A Infinity Symbol with scale only */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="relative w-16 h-16 transition-transform duration-300 group-hover:scale-105">
                <defs>
                  <linearGradient id="navInfinityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#2563eb" />
                    <stop offset="100%" stop-color="#7c3aed" />
                  </linearGradient>
                </defs>
                <path d="M25,50 C25,35 38,30 50,50 C62,70 75,65 75,50 C75,35 62,30 50,50 C38,70 25,65 25,50 Z" 
                      fill="none" stroke="url(#navInfinityGrad)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="25" cy="50" r="6.5" fill="#2563eb" />
                <circle cx="75" cy="50" r="6.5" fill="#7c3aed" />
              </svg>
            </div>
            {/* Clean, Consistent Text Layout (Hover effects removed) */}
            <span className="font-bold text-2xl text-gray-900 tracking-tight">
              MeetOn<span className="text-blue-600">Memory</span>
            </span>
          </div>
          {/* Desktop Navigation */}
          {userData ? (
            /* Logged In Desktop App Nav */
            <nav
              className="hidden md:flex items-center gap-1.5 bg-gray-50 border border-gray-100 p-1 rounded-2xl"
              aria-label="Application navigation"
            >
              {appLinks.map((link) => {
                const Icon = link.icon;
                const active = isTabActive(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => navigate(link.href)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                      active
                        ? "bg-white text-blue-600 shadow-xs border border-gray-100/50"
                        : "text-gray-600 border border-transparent hover:text-gray-900 hover:bg-gray-100/60"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-transform duration-200 ${
                        active ? "scale-110 text-blue-600" : "text-gray-400"
                      }`}
                    />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : (
            /* Logged Out Desktop Marketing Nav */
            <nav
              className="hidden md:flex items-center gap-1.5"
              aria-label="Marketing navigation"
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavLinkClick(link.href)}
                  className="px-3.5 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:text-blue-600 hover:bg-blue-50/70 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          )}

          {/* Right Side Controls */}
          <div className="flex items-center gap-3">
            {userData ? (
              <>
                {/* Desktop Notification Area */}
                <div
                  className="relative hidden sm:block"
                  ref={notificationsRef}
                >
                  <button
                    onClick={() => setNotificationsOpen((s) => !s)}
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                      notificationsOpen
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    }`}
                    aria-expanded={notificationsOpen}
                    aria-haspopup="true"
                    aria-label="Open notifications menu"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Popover */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                        <span className="font-bold text-gray-800 text-sm">
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-3.5 hover:bg-blue-50/20 transition-colors text-left ${
                                notif.unread ? "bg-blue-50/5" : ""
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <p className="font-semibold text-xs text-gray-800 flex items-center gap-1.5">
                                  {notif.unread && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                                  )}
                                  {notif.title}
                                </p>
                                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                                  {notif.time}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                {notif.description}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-gray-400 text-xs">
                            No notifications yet
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile / Dropdown Menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((s) => !s)}
                    className="flex items-center gap-1.5 p-1 pr-2.5 rounded-xl border border-gray-200/60 hover:bg-gray-100/50 hover:border-gray-300 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label="Open user menu"
                  >
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {userData?.name
                        ? userData.name.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                        menuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <div className="absolute right-0 mt-3 w-60 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3.5 bg-gray-50/80 border-b border-gray-100">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {userData?.name || "User"}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {userData?.email || "user@example.com"}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                            {userData?.role || "Member"}
                          </span>
                          {userData?.organization?.name && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate max-w-[120px] uppercase">
                              {userData.organization.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/dashboard");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-gray-400" />
                          Dashboard
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/profile");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          My Profile
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/settings");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <Settings className="w-3.5 h-3.5 text-gray-400" />
                          Settings
                        </button>

                        {userData?.role === "admin" && (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              navigate("/admin-panel");
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left cursor-pointer"
                            role="menuitem"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                            Admin Panel
                          </button>
                        )}
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-500" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                aria-label="Login to MeetOnMemory"
              >
                Login
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              onClick={() => setMobileOpen((s) => !s)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        ref={mobileMenuRef}
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white border-t border-gray-100 ${
          mobileOpen
            ? "max-h-[600px] opacity-100 shadow-lg"
            : "max-h-0 opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <nav
          className="px-4 py-5 flex flex-col gap-1.5"
          aria-label="Mobile navigation"
        >
          {userData ? (
            /* Logged In Mobile Nav List */
            <>
              <div className="px-3.5 py-3 bg-gray-50 border border-gray-100/60 flex items-center gap-3 rounded-2xl mb-2">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {userData?.name || "User"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {userData?.email || "user@example.com"}
                  </p>
                </div>
              </div>

              {appLinks.map((link) => {
                const Icon = link.icon;
                const active = isTabActive(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => {
                      setMobileOpen(false);
                      navigate(link.href);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                      active
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${active ? "text-blue-600" : "text-gray-400"}`}
                    />
                    <span>{link.label}</span>
                  </button>
                );
              })}

              {/* Mobile Notifications Section Toggle */}
              <button
                onClick={() => setMobileNotifOpen(!mobileNotifOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  mobileNotifOpen
                    ? "bg-blue-50/50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell
                    className={`w-4 h-4 ${mobileNotifOpen ? "text-blue-600" : "text-gray-400"}`}
                  />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} New
                  </span>
                )}
              </button>

              {/* Mobile Notifications Expandable List */}
              {mobileNotifOpen && (
                <div className="mx-2 bg-gray-50/60 rounded-xl divide-y divide-gray-100 border border-gray-100 overflow-hidden mb-2">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="p-3 text-left">
                      <div className="flex justify-between items-start gap-2 mb-0.5">
                        <p className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                          {notif.unread && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          )}
                          {notif.title}
                        </p>
                        <span className="text-[9px] text-gray-400 font-semibold">
                          {notif.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">
                        {notif.description}
                      </p>
                    </div>
                  ))}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="w-full text-center py-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white border-t border-gray-100 cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/profile");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all cursor-pointer"
              >
                <User className="w-4 h-4 text-gray-400" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/settings");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4 text-gray-400" />
                <span>Settings</span>
              </button>

              <hr className="my-1.5 border-gray-100" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            /* Logged Out Mobile Nav List */
            <>
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavLinkClick(link.href)}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/login?mode=signup");
                }}
                className="mt-3 w-full px-4 py-3 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all duration-200 text-center cursor-pointer"
              >
                Get Started — It&apos;s Free
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
