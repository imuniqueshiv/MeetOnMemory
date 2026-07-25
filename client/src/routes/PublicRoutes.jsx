import React from "react";
import { Route } from "react-router-dom";

// --- Public Pages ---
import Home from "../pages/Home.jsx";
import Login from "../pages/Login.jsx";
import EmailVerify from "../pages/EmailVerify.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import PublicOrganizationProfile from "../pages/PublicOrganizationProfile.jsx";
import Privacy from "../pages/Privacy.jsx";
import Terms from "../pages/Terms.jsx";
import Security from "../pages/Security.jsx";
import Contact from "../pages/Contact.jsx";
import CookiePolicy from "../pages/CookiePolicy.jsx";
import MeetingRoom from "../pages/MeetingRoom.jsx";
import Status from "../pages/Status.jsx";
import HelpCenter from "../pages/HelpCenter.jsx";
import Careers from "../pages/Careers.jsx";
import PublicSharedView from "../pages/PublicSharedView.jsx";

const PublicRoutes = (
  <React.Fragment>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/email-verify" element={<EmailVerify />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/security" element={<Security />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/cookie-policy" element={<CookiePolicy />} />
    <Route path="/status" element={<Status />} />
    <Route path="/help-center" element={<HelpCenter />} />
    <Route path="/careers" element={<Careers />} />
    <Route
      path="/organizations/:slug"
      element={<PublicOrganizationProfile />}
    />
    <Route path="/meeting-room/:roomId" element={<MeetingRoom />} />
    <Route path="/shared/:hash" element={<PublicSharedView />} />
  </React.Fragment>
);

export default PublicRoutes;
