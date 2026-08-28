import React, { lazy } from "react";
import { Route, Navigate } from "react-router-dom";

const Home = lazy(() => import("../pages/Home.jsx"));
const Login = lazy(() => import("../pages/Login.jsx"));
const SignUp = lazy(() => import("../pages/SignUp.jsx"));
const PublicOrganizationProfile = lazy(
  () => import("../pages/PublicOrganizationProfile.jsx"),
);
const Privacy = lazy(() => import("../pages/Privacy.jsx"));
const Terms = lazy(() => import("../pages/Terms.jsx"));
const Security = lazy(() => import("../pages/Security.jsx"));
const Contact = lazy(() => import("../pages/Contact.jsx"));
const CookiePolicy = lazy(() => import("../pages/CookiePolicy.jsx"));
const Status = lazy(() => import("../pages/Status.jsx"));
const HelpCenter = lazy(() => import("../pages/HelpCenter.jsx"));
const Careers = lazy(() => import("../pages/Careers.jsx"));
const PublicSharedView = lazy(() => import("../pages/PublicSharedView.jsx"));
const DeveloperDocs = lazy(() => import("../pages/DeveloperDocs.jsx"));
const AcceptInvite = lazy(() => import("../pages/AcceptInvite.jsx"));
const MeetingInviteJoin = lazy(() => import("../pages/MeetingInviteJoin.jsx"));
const Testimonials = lazy(() => import("../pages/Testimonials.jsx"));
const GuestMeetingView = lazy(() => import("../pages/GuestMeetingView.jsx"));
const GuestJoin = lazy(() => import("../pages/GuestJoin.jsx"));

const PublicRoutes = (
  <React.Fragment>
    <Route path="/" element={<Home />} />
    <Route path="/testimonials" element={<Testimonials />} />
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
    <Route path="/guest/:token" element={<GuestMeetingView />} />
    <Route path="/guest-join/:token" element={<GuestJoin />} />
  </React.Fragment>
);

export default PublicRoutes;
