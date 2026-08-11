import React from "react";
import { Route, Navigate } from "react-router-dom";

// --- Public Pages ---
import Home from "../pages/Home.jsx";
import Login from "../pages/Login.jsx";
import SignUp from "../pages/SignUp.jsx";
import PublicOrganizationProfile from "../pages/PublicOrganizationProfile.jsx";
import Privacy from "../pages/Privacy.jsx";
import Terms from "../pages/Terms.jsx";
import Security from "../pages/Security.jsx";
import Contact from "../pages/Contact.jsx";
import CookiePolicy from "../pages/CookiePolicy.jsx";
import Status from "../pages/Status.jsx";
import HelpCenter from "../pages/HelpCenter.jsx";
import Careers from "../pages/Careers.jsx";
import PublicSharedView from "../pages/PublicSharedView.jsx";
import DeveloperDocs from "../pages/DeveloperDocs.jsx";
import AcceptInvite from "../pages/AcceptInvite.jsx";
import MeetingInviteJoin from "../pages/MeetingInviteJoin.jsx";

const PublicRoutes = (
  <React.Fragment>
    <Route path="/" element={<Home />} />
    {/* Clerk path-based auth (supports /login/factor-password, SSO callbacks, etc.) */}
    <Route path="/login/*" element={<Login />} />
    <Route path="/signup/*" element={<SignUp />} />
    {/* Legacy auth routes → Clerk SignIn */}
    <Route path="/email-verify" element={<Navigate to="/login" replace />} />
    <Route path="/reset-password" element={<Navigate to="/login" replace />} />
    <Route path="/invite/:token" element={<AcceptInvite />} />
    <Route path="/meeting-invite/:code" element={<MeetingInviteJoin />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/security" element={<Security />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/cookie-policy" element={<CookiePolicy />} />
    <Route path="/status" element={<Status />} />
    <Route path="/help-center" element={<HelpCenter />} />
    <Route path="/careers" element={<Careers />} />
    <Route path="/docs" element={<DeveloperDocs />} />
    <Route path="/developer-docs" element={<DeveloperDocs />} />
    <Route
      path="/organizations/:slug"
      element={<PublicOrganizationProfile />}
    />
    <Route path="/shared/:hash" element={<PublicSharedView />} />
  </React.Fragment>
);

export default PublicRoutes;
