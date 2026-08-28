import React, { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import { userApi } from "../services";
import AppContent from "../context/AppContent";
import { useSkillEndorsements } from "../hooks/useSkillEndorsements";
import {
  User,
  Mail,
  Building2,
  ShieldAlert,
  Calendar,
  Edit2,
  X,
  Check,
  Loader2,
  ShieldCheck,
  Globe,
  Upload,
} from "lucide-react";

const Profile = () => {
  const { userData, setUserData } = useContext(AppContent);
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePicFailed, setProfilePicFailed] = useState(false);
  const [gamificationData, setGamificationData] = useState(null);

  const [endorsements, setEndorsements] = useState([]);
  const { getUserEndorsements, loading: endorsementsLoading } =
    useSkillEndorsements();

  useEffect(() => {
    setProfilePicFailed(false);
  }, [userData?.profilePic]);

  useEffect(() => {
    if (userData) {
      axios
        .get("/api/gamification/score", { withCredentials: true })
        .then((res) => {
          if (res.data.success) {
            setGamificationData(res.data.data);
          }
        })
        .catch((err) =>
          console.error("Failed to fetch gamification score", err),
        );
    }
  }, [userData]);

  useEffect(() => {
    if (userData?._id || userData?.id) {
      const id = userData._id || userData.id;
      getUserEndorsements(id).then((data) => setEndorsements(data || []));
    }
  }, [userData, getUserEndorsements]);

  // Form State
  const [name, setName] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [bio, setBio] = useState("");

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Validation States
  const [errors, setErrors] = useState({
    name: "",
    profilePic: "",
  });

  // Load user data into form
  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setProfilePic(userData.profilePic || "");
      setPreviewUrl(userData.profilePic || "");
      setBio(userData.bio || "");
      setSelectedFile(null);
    }
  }, [userData]);

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <span className="ml-3 text-slate-500 font-medium">
            {t("profile.loading")}
          </span>
        </div>
      </div>
    );
  }

  // Get Initials Helper
  const getInitials = (userName) => {
    if (!userName) return "U";
    const parts = userName.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  // Form Validations
  const validateForm = () => {
    const newErrors = { name: "", profilePic: "" };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = t("profile.fullNameRequired");
      isValid = false;
    } else if (name.trim().length < 2) {
      newErrors.name = t("profile.fullNameMinLength");
      isValid = false;
    }

    if (profilePic.trim()) {
      try {
        const u = new URL(profilePic.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          newErrors.profilePic = t("profile.invalidImageProtocol");
          isValid = false;
        }
      } catch {
        newErrors.profilePic = t("profile.invalidImageUrl");
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle local avatar file picker
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size exceeds 5MB limit");
        return;
      }
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only images (JPEG, PNG, GIF, WebP) are allowed");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setProfilePic(""); // clear URL fallback when file uploader is active
    }
  };

  // Save changes handler
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      let finalProfilePic = profilePic.trim();

      // Upload local file first if chosen
      if (selectedFile) {
        const formData = new FormData();
        formData.append("avatar", selectedFile);

        const uploadRes = await userApi.uploadAvatar(formData);
        if (uploadRes.data?.success) {
          finalProfilePic = uploadRes.data.profilePic;
        } else {
          toast.error(uploadRes.data?.message || "Avatar upload failed");
          setLoading(false);
          return;
        }
      }

      const { data } = await userApi.updateProfile({
        name: name.trim(),
        profilePic: finalProfilePic,
        bio: bio.trim(),
      });

      if (data.success) {
        toast.success(data.message || t("profile.profileUpdated"));
        setUserData(data.user);
        localStorage.setItem("userData", JSON.stringify(data.user));
        setIsEditing(false);
        setSelectedFile(null);
      } else {
        toast.error(data.message || t("profile.profileUpdateFailed"));
      }
    } catch (err) {
      console.error("Profile update error:", err);
      const msg =
        err.response?.data?.message || t("profile.profileUpdateServerError");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Discard changes / Reset form
  const handleCancel = () => {
    setName(userData.name || "");
    setProfilePic(userData.profilePic || "");
    setPreviewUrl(userData.profilePic || "");
    setBio(userData.bio || "");
    setErrors({ name: "", profilePic: "" });
    setSelectedFile(null);
    setIsEditing(false);
  };

  // Formatted date string (e.g. Mar 2025)
  const formattedMemberSince = userData.createdAt
    ? new Date(userData.createdAt).toLocaleDateString(
        i18n.language === "hi" ? "hi-IN" : "en-US",
        {
          month: "short",
          year: "numeric",
        },
      )
    : "N/A";

  const displayRole = userData.role
    ? userData.role.charAt(0).toUpperCase() +
      userData.role.slice(1).toLowerCase()
    : t("profile.member");

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 flex flex-col justify-center">
        {/* Page title header */}
        <div className="text-center mb-8 fade-in-up stagger-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {t("profile.title")}
          </h1>
          <p className="text-slate-550 dark:text-slate-400 mt-2 text-sm max-w-md mx-auto">
            {t("profile.description")}
          </p>
        </div>

        {/* Profile Card component - exact reference design in light theme */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm relative fade-in-up stagger-2 max-w-2xl mx-auto transition-all duration-300">
          {/* Toggled content */}
          {!isEditing ? (
            // ================= VIEW STATE =================
            <div className="space-y-6">
              {/* Header section */}
              <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                  {/* Custom initials / profile image */}
                  {userData.profilePic && !profilePicFailed ? (
                    <img
                      src={userData.profilePic}
                      alt={userData.name}
                      className="w-20 h-20 rounded-full object-cover border border-slate-200 shadow-xs"
                      onError={() => {
                        toast.warning(t("profile.failedProfileImage"));
                        setProfilePicFailed(true);
                      }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl border border-blue-700/20 shadow-xs">
                      {getInitials(userData.name)}
                    </div>
                  )}

                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {userData.name}
                    </h2>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {displayRole}
                      </span>
                      {userData.isAccountVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          {t("profile.verified")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          {t("profile.unverified")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Edit2 className="w-3 h-3" />
                  {t("profile.editProfile")}
                </button>
              </div>

              {/* Grid details section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8 py-2 text-slate-600 dark:text-slate-400">
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {t("profile.email")}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 break-all">
                    {userData.email}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {t("profile.organization")}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    {userData.organization?.name || t("profile.noOrganization")}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    {t("profile.role")}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 capitalize">
                    {displayRole}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {t("profile.memberSince")}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    {formattedMemberSince}
                  </div>
                </div>
              </div>

              {/* Bio section */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  {t("profile.bio")}
                </div>
                <p className="text-sm text-slate-650 dark:text-slate-400 leading-relaxed italic">
                  {userData.bio || t("profile.noBio")}
                </p>
              </div>

              {/* Gamification section — top badge showcase (#2066) */}
              {gamificationData && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      {t("profile.trophyCase")}
                    </div>
                    <Link
                      to="/badges"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      View all badges
                    </Link>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg font-bold">
                      {gamificationData.totalPoints} {t("profile.points")}
                    </div>
                  </div>
                  {gamificationData.unlockedBadges?.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[...gamificationData.unlockedBadges]
                        .sort(
                          (a, b) =>
                            new Date(b.unlockedAt || 0) -
                            new Date(a.unlockedAt || 0),
                        )
                        .slice(0, 3)
                        .map((ub, idx) => (
                          <Link
                            key={ub.badge?._id || idx}
                            to={
                              ub.badge?._id
                                ? `/badges#badge-${ub.badge._id}`
                                : "/badges"
                            }
                            className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 border border-yellow-200 dark:border-yellow-700/50 hover:ring-2 hover:ring-yellow-300/60"
                          >
                            🏅 {ub.badge?.name || t("profile.badge")}
                          </Link>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No badges yet —{" "}
                      <Link
                        to="/badges"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        browse the gallery
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {/* Endorsements Section */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    {t("profile.endorsements") || "Peer Endorsements"}
                  </div>
                </div>

                {endorsementsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="animate-spin w-5 h-5 text-blue-500" />
                  </div>
                ) : endorsements.length > 0 ? (
                  <div className="space-y-4 mt-2">
                    {endorsements.map((skill, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-slate-800 dark:text-slate-200">
                            {skill.skillTag}
                          </h4>
                          <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            {skill.count} endorsements
                          </span>
                        </div>
                        <div className="space-y-2">
                          {skill.endorsements.map((end, eIdx) => (
                            <div
                              key={eIdx}
                              className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700"
                            >
                              {end.comment && (
                                <p className="italic mb-1">"{end.comment}"</p>
                              )}
                              <Link
                                to={`/meeting/${end.meetingId}`}
                                className="text-xs text-blue-500 hover:underline"
                              >
                                View Meeting ↗
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No endorsements yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            // ================= EDIT STATE =================
            <form onSubmit={handleSave} className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t("profile.editDetails")}
                </h3>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  aria-label={t("profile.cancelEditing")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Full Name input */}
                <div className="space-y-2">
                  <label
                    htmlFor="name-input"
                    className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    {t("profile.fullName")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("profile.fullNamePlaceholder")}
                      disabled={loading}
                      className={`w-full bg-slate-50/50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border ${
                        errors.name
                          ? "border-red-500/80"
                          : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800"
                      } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all outline-none`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-xs font-semibold text-red-500/90 mt-1 flex items-center gap-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Profile Picture Upload & Preview */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Avatar Image Upload
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Avatar preview"
                        className="w-16 h-16 rounded-full object-cover border border-slate-250 shadow-xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl border">
                        {getInitials(name)}
                      </div>
                    )}

                    <div className="flex-grow space-y-1.5 w-full">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={loading}
                        className="text-xs text-slate-650 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-slate-200 cursor-pointer"
                        data-testid="avatar-file-input"
                      />
                      <p className="text-[10px] text-slate-400 font-medium">
                        Allowed formats: JPG, PNG, GIF, WebP. Max size: 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider py-1">
                  — OR —
                </div>

                {/* Profile Picture URL input (Fallback) */}
                <div className="space-y-2">
                  <label
                    htmlFor="pic-input"
                    className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    Image URL (Fallback)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="pic-input"
                      type="text"
                      value={profilePic}
                      onChange={(e) => {
                        setProfilePic(e.target.value);
                        setPreviewUrl(e.target.value);
                        setSelectedFile(null); // Clear selected file if user inputs URL manually
                      }}
                      placeholder={t("profile.profilePicturePlaceholder")}
                      disabled={loading}
                      className={`w-full bg-slate-50/50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border ${
                        errors.profilePic
                          ? "border-red-500/80"
                          : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800"
                      } rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all outline-none`}
                    />
                  </div>
                  {errors.profilePic && (
                    <p className="text-xs font-semibold text-red-500/90 mt-1">
                      {errors.profilePic}
                    </p>
                  )}
                </div>

                {/* Bio text input */}
                <div className="space-y-2">
                  <label
                    htmlFor="bio-input"
                    className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    {t("profile.bioOptional")}
                  </label>
                  <textarea
                    id="bio-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t("profile.bioPlaceholder")}
                    disabled={loading}
                    rows="3"
                    maxLength="250"
                    className="w-full bg-slate-50/50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all outline-none resize-none"
                  />
                  <div className="flex justify-end text-[10px] text-slate-400 font-bold">
                    {bio.length}/250 {t("profile.characters")}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {t("profile.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-3 h-3" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {t("profile.saveChanges")}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
